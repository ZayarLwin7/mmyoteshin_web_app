import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db/client";
import {
  adminProfiles,
  adminUsers,
  auditLogs,
  contentReports,
  downloadLinks,
  genres,
  movieGenres,
  movies,
  reviews,
  type DownloadLink,
  type Movie,
  type Review,
} from "@/db/schema";
import { escapeLikePattern } from "@/lib/security/sanitize";

/**
 * Authenticated admin read layer.
 *
 * Unlike `queries/public.ts` this module *does* select private fields such as
 * `authorization_reference`. Every caller must already have passed a
 * permission check — the guards live in `lib/auth/guards.ts` and the pages
 * call them before touching this module.
 */

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

export type AdminStats = {
  movies: { total: number; published: number; draft: number; archived: number };
  reviews: { total: number; published: number };
  links: {
    total: number;
    active: number;
    pendingReview: number;
    disabled: number;
    reported: number;
  };
  reports: { open: number; total: number };
  genres: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const [movieRows, reviewRows, linkRows, reportRows, genreRows] = await Promise.all([
    db
      .select({ status: movies.status, total: sql<number>`count(*)::int` })
      .from(movies)
      .groupBy(movies.status),
    db
      .select({ status: reviews.status, total: sql<number>`count(*)::int` })
      .from(reviews)
      .groupBy(reviews.status),
    db
      .select({ status: downloadLinks.status, total: sql<number>`count(*)::int` })
      .from(downloadLinks)
      .groupBy(downloadLinks.status),
    db
      .select({ status: contentReports.status, total: sql<number>`count(*)::int` })
      .from(contentReports)
      .groupBy(contentReports.status),
    db.select({ total: sql<number>`count(*)::int` }).from(genres),
  ]);

  const movieTotal = movieRows.reduce((sum, row) => sum + row.total, 0);
  const reviewTotal = reviewRows.reduce((sum, row) => sum + row.total, 0);
  const linkTotal = linkRows.reduce((sum, row) => sum + row.total, 0);
  const reportTotal = reportRows.reduce((sum, row) => sum + row.total, 0);

  const byStatus = <T extends string>(rows: { status: T; total: number }[], status: T) =>
    rows.find((row) => row.status === status)?.total ?? 0;

  return {
    movies: {
      total: movieTotal,
      published: byStatus(movieRows, "published"),
      draft: byStatus(movieRows, "draft"),
      archived: byStatus(movieRows, "archived"),
    },
    reviews: {
      total: reviewTotal,
      published: byStatus(reviewRows, "published"),
    },
    links: {
      total: linkTotal,
      active: byStatus(linkRows, "active"),
      pendingReview: byStatus(linkRows, "pending_review"),
      disabled: byStatus(linkRows, "disabled"),
      reported: byStatus(linkRows, "reported"),
    },
    reports: {
      open: byStatus(reportRows, "new") + byStatus(reportRows, "under_review"),
      total: reportTotal,
    },
    genres: genreRows[0]?.total ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Movies                                                                     */
/* -------------------------------------------------------------------------- */

export type AdminMovieListItem = {
  id: string;
  title: string;
  slug: string;
  status: Movie["status"];
  releaseYear: number | null;
  posterUrl: string | null;
  featured: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  genreCount: number;
  activeLinkCount: number;
  /** Drives the Series badge in the admin list. */
  contentKind: Movie["contentKind"];
};

export async function listAdminMovies(options: {
  q?: string | null;
  status?: Movie["status"] | "all";
  page?: number;
  pageSize?: number;
}): Promise<{ items: AdminMovieListItem[]; total: number; page: number; totalPages: number }> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
  const requestedPage = Math.max(options.page ?? 1, 1);

  const conditions: SQL[] = [];
  if (options.status && options.status !== "all") {
    conditions.push(eq(movies.status, options.status));
  }
  const term = options.q?.trim();
  if (term) {
    const pattern = `%${escapeLikePattern(term)}%`;
    const match = or(ilike(movies.title, pattern), ilike(movies.originalTitle, pattern));
    if (match) conditions.push(match);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRows, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(movies)
      .where(where),
    db
      .select({
        id: movies.id,
        title: movies.title,
        slug: movies.slug,
        status: movies.status,
        releaseYear: movies.releaseYear,
        posterUrl: movies.posterUrl,
        featured: movies.featured,
        publishedAt: movies.publishedAt,
        updatedAt: movies.updatedAt,
        contentKind: movies.contentKind,
        genreCount: sql<number>`(select count(*)::int from ${movieGenres} where ${movieGenres.movieId} = ${movies.id})`,
        activeLinkCount: sql<number>`(select count(*)::int from ${downloadLinks} where ${downloadLinks.movieId} = ${movies.id} and ${downloadLinks.status} = 'active')`,
      })
      .from(movies)
      .where(where)
      .orderBy(desc(movies.updatedAt))
      .limit(pageSize)
      .offset((requestedPage - 1) * pageSize),
  ]);

  const total = countRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { items: rows, total, page: Math.min(requestedPage, totalPages), totalPages };
}

export type AdminMovieDetail = {
  movie: Movie;
  genreIds: string[];
  reviews: Review[];
  links: DownloadLink[];
};

/** Full record including private authorization fields. Admin-only. */
export async function getAdminMovieById(id: string): Promise<AdminMovieDetail | null> {
  const movieRows = await db.select().from(movies).where(eq(movies.id, id)).limit(1);
  const movie = movieRows[0];
  if (!movie) return null;

  const [genreRows, reviewRows, linkRows] = await Promise.all([
    db
      .select({ genreId: movieGenres.genreId })
      .from(movieGenres)
      .where(eq(movieGenres.movieId, id)),
    db.select().from(reviews).where(eq(reviews.movieId, id)).orderBy(desc(reviews.updatedAt)),
    db
      .select()
      .from(downloadLinks)
      .where(eq(downloadLinks.movieId, id))
      .orderBy(desc(downloadLinks.updatedAt)),
  ]);

  return {
    movie,
    genreIds: genreRows.map((row) => row.genreId),
    reviews: reviewRows,
    links: linkRows,
  };
}

/** Minimal shape for the publish-readiness panel. */
export async function getMovieReadinessInput(id: string) {
  const detail = await getAdminMovieById(id);
  if (!detail) return null;
  return {
    movie: detail.movie,
    genreIds: detail.genreIds,
    reviews: detail.reviews,
    links: detail.links,
  };
}

export async function movieSlugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: movies.id })
    .from(movies)
    .where(
      excludeId
        ? and(eq(movies.slug, slug), sql`${movies.id} <> ${excludeId}`)
        : eq(movies.slug, slug),
    )
    .limit(1);
  return rows.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Genres                                                                     */
/* -------------------------------------------------------------------------- */

export async function listAdminGenres() {
  return db
    .select({
      id: genres.id,
      name: genres.name,
      slug: genres.slug,
      description: genres.description,
      displayOrder: genres.displayOrder,
      updatedAt: genres.updatedAt,
      movieCount: sql<number>`(select count(*)::int from ${movieGenres} where ${movieGenres.genreId} = ${genres.id})`,
    })
    .from(genres)
    .orderBy(asc(genres.displayOrder), asc(genres.name));
}

export async function genreSlugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: genres.id })
    .from(genres)
    .where(
      excludeId
        ? and(eq(genres.slug, slug), sql`${genres.id} <> ${excludeId}`)
        : eq(genres.slug, slug),
    )
    .limit(1);
  return rows.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

export async function listAdminReviews(
  options: { status?: Review["status"] | "all"; limit?: number } = {},
) {
  const conditions: SQL[] = [];
  if (options.status && options.status !== "all") {
    conditions.push(eq(reviews.status, options.status));
  }

  return db
    .select({
      id: reviews.id,
      reviewTitle: reviews.reviewTitle,
      rating: reviews.rating,
      ratingScale: reviews.ratingScale,
      ratingSource: reviews.ratingSource,
      reviewerName: reviews.reviewerName,
      status: reviews.status,
      publishedAt: reviews.publishedAt,
      updatedAt: reviews.updatedAt,
      movieId: reviews.movieId,
      movieTitle: movies.title,
      movieSlug: movies.slug,
      bodyLength: sql<number>`length(${reviews.body})::int`,
    })
    .from(reviews)
    .innerJoin(movies, eq(movies.id, reviews.movieId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reviews.updatedAt))
    .limit(Math.min(options.limit ?? 100, 200));
}

export async function getAdminReviewById(id: string) {
  const rows = await db
    .select({
      review: reviews,
      movieTitle: movies.title,
      movieSlug: movies.slug,
    })
    .from(reviews)
    .innerJoin(movies, eq(movies.id, reviews.movieId))
    .where(eq(reviews.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Download links                                                             */
/* -------------------------------------------------------------------------- */

export async function listAdminLinks(
  options: { status?: DownloadLink["status"] | "all"; movieId?: string } = {},
) {
  const conditions: SQL[] = [];
  if (options.status && options.status !== "all") {
    conditions.push(eq(downloadLinks.status, options.status));
  }
  if (options.movieId) {
    conditions.push(eq(downloadLinks.movieId, options.movieId));
  }

  return db
    .select({
      link: downloadLinks,
      movieTitle: movies.title,
      movieSlug: movies.slug,
    })
    .from(downloadLinks)
    .innerJoin(movies, eq(movies.id, downloadLinks.movieId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(downloadLinks.updatedAt))
    .limit(200);
}

export async function getAdminLinkById(id: string) {
  const rows = await db.select().from(downloadLinks).where(eq(downloadLinks.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Links that are live but have not been re-checked within `days`. */
export async function listStaleLinks(days = 180) {
  return db
    .select({
      link: downloadLinks,
      movieTitle: movies.title,
      movieSlug: movies.slug,
    })
    .from(downloadLinks)
    .innerJoin(movies, eq(movies.id, downloadLinks.movieId))
    .where(
      and(
        eq(downloadLinks.status, "active"),
        or(
          sql`${downloadLinks.lastCheckedAt} is null`,
          sql`${downloadLinks.lastCheckedAt} < now() - make_interval(days => ${days})`,
        ),
      ),
    )
    .orderBy(asc(downloadLinks.lastCheckedAt))
    .limit(100);
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export async function listAdminReports(options: { status?: string; limit?: number } = {}) {
  const conditions: SQL[] = [];
  if (options.status && options.status !== "all") {
    conditions.push(sql`${contentReports.status} = ${options.status}`);
  }

  return db
    .select({
      report: contentReports,
      movieTitle: movies.title,
      movieSlug: movies.slug,
      linkLabel: downloadLinks.label,
      linkProvider: downloadLinks.providerName,
    })
    .from(contentReports)
    .leftJoin(movies, eq(movies.id, contentReports.movieId))
    .leftJoin(downloadLinks, eq(downloadLinks.id, contentReports.downloadLinkId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contentReports.createdAt))
    .limit(Math.min(options.limit ?? 100, 200));
}

export async function getAdminReportById(id: string) {
  const rows = await db
    .select({
      report: contentReports,
      movie: movies,
      link: downloadLinks,
    })
    .from(contentReports)
    .leftJoin(movies, eq(movies.id, contentReports.movieId))
    .leftJoin(downloadLinks, eq(downloadLinks.id, contentReports.downloadLinkId))
    .where(eq(contentReports.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function countOpenReports(): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(contentReports)
    .where(inArray(contentReports.status, ["new", "under_review"]));
  return rows[0]?.total ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Administrators and audit                                                   */
/* -------------------------------------------------------------------------- */

export async function listAdminUsers() {
  return db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      isActive: adminUsers.isActive,
      lastLoginAt: adminUsers.lastLoginAt,
      createdAt: adminUsers.createdAt,
      role: adminProfiles.role,
    })
    .from(adminUsers)
    .leftJoin(adminProfiles, eq(adminProfiles.userId, adminUsers.id))
    .orderBy(asc(adminUsers.email));
}

export async function getAdminUserByEmail(email: string) {
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      passwordHash: adminUsers.passwordHash,
      isActive: adminUsers.isActive,
      lockedUntil: adminUsers.lockedUntil,
      failedLoginCount: adminUsers.failedLoginCount,
      role: adminProfiles.role,
    })
    .from(adminUsers)
    .leftJoin(adminProfiles, eq(adminProfiles.userId, adminUsers.id))
    .where(eq(adminUsers.email, email.toLowerCase()))
    .limit(1);

  return rows[0] ?? null;
}

export async function countAdmins(): Promise<number> {
  const rows = await db.select({ total: sql<number>`count(*)::int` }).from(adminUsers);
  return rows[0]?.total ?? 0;
}

export async function listAuditEntries(options: { limit?: number; entityType?: string } = {}) {
  const conditions: SQL[] = [];
  if (options.entityType) {
    conditions.push(eq(auditLogs.entityType, options.entityType));
  }

  return db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(options.limit ?? 100, 300));
}

/** Links whose host differs from the one recorded, used by the review queue. */
export async function countLinksPendingReview(): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(downloadLinks)
    .where(
      and(eq(downloadLinks.status, "pending_review"), isNotNull(downloadLinks.destinationUrl)),
    );
  return rows[0]?.total ?? 0;
}

export { count };
