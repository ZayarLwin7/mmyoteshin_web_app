import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { downloadLinks, movieGenres, movies, reviews, type Movie } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/guards";
import { slugify, slugifyWithSuffix } from "@/lib/utils";
import type { MovieInput } from "@/lib/validation/schemas";

import { evaluatePublicationReadiness } from "./publication";

/**
 * Movie write operations.
 *
 * All slug assignment, genre syncing, status transitions and audit writes live
 * here so the server actions stay thin and the rules cannot drift between
 * call sites.
 */

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/* -------------------------------------------------------------------------- */
/* Slugs                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Produce a slug that is not already taken.
 *
 * Tries the plain slug first, then appends `-2`, `-3`, … so a duplicate title
 * never fails the save and never silently overwrites another record.
 */
export async function reserveMovieSlug(desired: string, excludeId?: string): Promise<string> {
  const base = slugify(desired) || "film";

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? base : slugifyWithSuffix(base, String(attempt));
    const clash = await db
      .select({ id: movies.id })
      .from(movies)
      .where(
        excludeId
          ? and(eq(movies.slug, candidate), ne(movies.id, excludeId))
          : eq(movies.slug, candidate),
      )
      .limit(1);

    if (clash.length === 0) return candidate;
  }

  // Astronomically unlikely; fall back to a time-based suffix rather than loop.
  return slugifyWithSuffix(base, Date.now().toString(36));
}

/* -------------------------------------------------------------------------- */
/* Create / update                                                            */
/* -------------------------------------------------------------------------- */

function toMovieColumns(input: MovieInput) {
  return {
    title: input.title,
    originalTitle: input.originalTitle,
    releaseYear: input.releaseYear,
    releaseDate: input.releaseDate,
    runtimeMinutes: input.runtimeMinutes,
    contentKind: input.contentKind,
    seasonCount: input.contentKind === "series" ? input.seasonCount : null,
    episodeCount: input.contentKind === "series" ? input.episodeCount : null,
    synopsis: input.synopsis,
    editorialNote: input.editorialNote,
    posterUrl: input.posterUrl,
    backdropUrl: input.backdropUrl,
    imageCredit: input.imageCredit,
    languageCode: input.languageCode,
    country: input.country,
    contentRating: input.contentRating,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    featured: input.featured,
    curationWeight: input.curationWeight ?? 0,
  };
}

export async function createMovie(input: MovieInput, actor: CurrentAdmin): Promise<Movie> {
  const slug = await reserveMovieSlug(input.slug || input.title);

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(movies)
      .values({
        ...toMovieColumns(input),
        slug,
        // New records always start as a draft; publishing is a separate,
        // explicitly permissioned action.
        status: "draft",
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    const movie = inserted[0];
    if (!movie) throw new ServiceError("Failed to create the movie record.", "insert_failed");

    if (input.genreIds.length > 0) {
      await tx
        .insert(movieGenres)
        .values(input.genreIds.map((genreId) => ({ movieId: movie.id, genreId })))
        .onConflictDoNothing();
    }

    return movie;
  });
}

export async function updateMovie(
  id: string,
  input: MovieInput,
  actor: CurrentAdmin,
): Promise<Movie> {
  const existing = await db.select().from(movies).where(eq(movies.id, id)).limit(1);
  const current = existing[0];
  if (!current) throw new ServiceError("That movie no longer exists.", "not_found");

  const desiredSlugSource = input.slug || input.title;
  const slug =
    slugify(desiredSlugSource) === current.slug
      ? current.slug
      : await reserveMovieSlug(desiredSlugSource, id);

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(movies)
      .set({
        ...toMovieColumns(input),
        slug,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(movies.id, id))
      .returning();

    const movie = updated[0];
    if (!movie) throw new ServiceError("Failed to update the movie record.", "update_failed");

    // Replace the genre set wholesale — simpler and race-free compared with
    // diffing, and the join table is tiny.
    await tx.delete(movieGenres).where(eq(movieGenres.movieId, id));
    if (input.genreIds.length > 0) {
      await tx
        .insert(movieGenres)
        .values(input.genreIds.map((genreId) => ({ movieId: id, genreId })))
        .onConflictDoNothing();
    }

    return movie;
  });
}

/* -------------------------------------------------------------------------- */
/* Status transitions                                                         */
/* -------------------------------------------------------------------------- */

async function loadReadiness(movieId: string) {
  const [movieRow, genreRows, reviewRows, linkRows] = await Promise.all([
    db.select().from(movies).where(eq(movies.id, movieId)).limit(1),
    db
      .select({ genreId: movieGenres.genreId })
      .from(movieGenres)
      .where(eq(movieGenres.movieId, movieId)),
    db
      .select({ status: reviews.status, body: reviews.body })
      .from(reviews)
      .where(eq(reviews.movieId, movieId)),
    db
      .select({
        status: downloadLinks.status,
        authorizationBasis: downloadLinks.authorizationBasis,
        authorizedAt: downloadLinks.authorizedAt,
        lastCheckedAt: downloadLinks.lastCheckedAt,
        destinationHost: downloadLinks.destinationHost,
      })
      .from(downloadLinks)
      .where(eq(downloadLinks.movieId, movieId)),
  ]);

  const movie = movieRow[0];
  if (!movie) throw new ServiceError("That movie no longer exists.", "not_found");

  return evaluatePublicationReadiness({
    movie,
    genreIds: genreRows.map((row) => row.genreId),
    reviews: reviewRows,
    links: linkRows,
  });
}

/**
 * Publish a film.
 *
 * Refuses when the readiness check reports a blocker — missing metadata, no
 * published review, or an active link without a reviewed authorization basis.
 */
export async function publishMovie(id: string, actor: CurrentAdmin): Promise<Movie> {
  const readiness = await loadReadiness(id);

  if (!readiness.ready) {
    throw new ServiceError(
      `Cannot publish yet: ${readiness.blockers.map((issue) => issue.message).join(" ")}`,
      "not_ready",
    );
  }

  const updated = await db
    .update(movies)
    .set({
      status: "published",
      publishedAt: new Date(),
      archivedAt: null,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(movies.id, id))
    .returning();

  const movie = updated[0];
  if (!movie) throw new ServiceError("Failed to publish the movie.", "update_failed");

  await recordAudit({
    action: AUDIT_ACTIONS.moviePublished,
    entityType: "movie",
    entityId: id,
    summary: `Published "${movie.title}".`,
    metadata: { slug: movie.slug },
    actor,
  });

  return movie;
}

export async function archiveMovie(id: string, actor: CurrentAdmin): Promise<Movie> {
  const updated = await db
    .update(movies)
    .set({
      status: "archived",
      archivedAt: new Date(),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(movies.id, id))
    .returning();

  const movie = updated[0];
  if (!movie) throw new ServiceError("That movie no longer exists.", "not_found");

  await recordAudit({
    action: AUDIT_ACTIONS.movieArchived,
    entityType: "movie",
    entityId: id,
    summary: `Archived "${movie.title}".`,
    actor,
  });

  return movie;
}

export async function restoreMovieToDraft(id: string, actor: CurrentAdmin): Promise<Movie> {
  const updated = await db
    .update(movies)
    .set({ status: "draft", archivedAt: null, updatedBy: actor.id, updatedAt: new Date() })
    .where(eq(movies.id, id))
    .returning();

  const movie = updated[0];
  if (!movie) throw new ServiceError("That movie no longer exists.", "not_found");

  await recordAudit({
    action: AUDIT_ACTIONS.movieRestored,
    entityType: "movie",
    entityId: id,
    summary: `Moved "${movie.title}" back to draft.`,
    actor,
  });

  return movie;
}

export async function getPublicationReadiness(movieId: string) {
  return loadReadiness(movieId);
}
