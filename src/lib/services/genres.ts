import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { genres, movieGenres, type Genre } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/guards";
import { slugify, slugifyWithSuffix } from "@/lib/utils";
import type { GenreInput } from "@/lib/validation/schemas";

import { ServiceError } from "./movies";

/** Reserve a unique genre slug, appending a counter on collision. */
export async function reserveGenreSlug(desired: string, excludeId?: string): Promise<string> {
  const base = slugify(desired) || "genre";

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? base : slugifyWithSuffix(base, String(attempt));
    const clash = await db
      .select({ id: genres.id })
      .from(genres)
      .where(
        excludeId
          ? and(eq(genres.slug, candidate), ne(genres.id, excludeId))
          : eq(genres.slug, candidate),
      )
      .limit(1);

    if (clash.length === 0) return candidate;
  }

  return slugifyWithSuffix(base, Date.now().toString(36));
}

export async function createGenre(input: GenreInput, actor: CurrentAdmin): Promise<Genre> {
  const slug = await reserveGenreSlug(input.slug || input.name);

  const inserted = await db
    .insert(genres)
    .values({
      name: input.name,
      slug,
      description: input.description,
      displayOrder: input.displayOrder ?? 0,
    })
    .returning();

  const genre = inserted[0];
  if (!genre) throw new ServiceError("Failed to create the genre.", "insert_failed");

  await recordAudit({
    action: AUDIT_ACTIONS.genreCreated,
    entityType: "genre",
    entityId: genre.id,
    summary: `Created genre "${genre.name}".`,
    actor,
  });

  return genre;
}

export async function updateGenre(
  id: string,
  input: GenreInput,
  actor: CurrentAdmin,
): Promise<Genre> {
  const existing = await db.select().from(genres).where(eq(genres.id, id)).limit(1);
  const current = existing[0];
  if (!current) throw new ServiceError("That genre no longer exists.", "not_found");

  const desired = input.slug || input.name;
  const slug =
    slugify(desired) === current.slug ? current.slug : await reserveGenreSlug(desired, id);

  const updated = await db
    .update(genres)
    .set({
      name: input.name,
      slug,
      description: input.description,
      displayOrder: input.displayOrder ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(genres.id, id))
    .returning();

  const genre = updated[0];
  if (!genre) throw new ServiceError("Failed to update the genre.", "update_failed");

  await recordAudit({
    action: AUDIT_ACTIONS.genreUpdated,
    entityType: "genre",
    entityId: genre.id,
    summary: `Updated genre "${genre.name}".`,
    actor,
  });

  return genre;
}

/**
 * Delete a genre.
 *
 * Refuses while films still reference it — silently detaching a genre from
 * published films would change live pages without an editorial decision.
 */
export async function deleteGenre(id: string, actor: CurrentAdmin): Promise<void> {
  const existing = await db.select().from(genres).where(eq(genres.id, id)).limit(1);
  const genre = existing[0];
  if (!genre) throw new ServiceError("That genre no longer exists.", "not_found");

  const usage = await db
    .select({ movieId: movieGenres.movieId })
    .from(movieGenres)
    .where(eq(movieGenres.genreId, id))
    .limit(1);

  if (usage.length > 0) {
    throw new ServiceError(
      `"${genre.name}" is still assigned to one or more films. Remove it from them first.`,
      "genre_in_use",
    );
  }

  await db.delete(genres).where(eq(genres.id, id));

  await recordAudit({
    action: AUDIT_ACTIONS.genreDeleted,
    entityType: "genre",
    entityId: id,
    summary: `Deleted genre "${genre.name}".`,
    actor,
  });
}
