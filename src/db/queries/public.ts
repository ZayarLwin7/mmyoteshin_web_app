import { cache } from "react";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db, executePrepared } from "@/db/client";
import { downloadLinks, genres, movieGenres, movies, reviews, type Movie } from "@/db/schema";
import { escapeLikePattern } from "@/lib/security/sanitize";
import { PAGE_SIZE } from "@/lib/validation/schemas";

/**
 * Public (unauthenticated) read layer.
 *
 * This module is the *only* way public pages and public APIs read the
 * catalogue, and it enforces the visibility rules in one place:
 *
 *   - movies:  status = 'published' AND published_at IS NOT NULL
 *   - reviews: status = 'published'
 *   - links:   status = 'active' AND authorization_basis IS NOT NULL
 *              AND authorized_at IS NOT NULL
 *
 * `authorization_reference` — the private evidence field — is never selected
 * here, so it cannot leak into a page, a server action result or an API body.
 */

/** A movie summary as shown on cards and rails. */
export type MovieCard = {
  id: string;
  title: string;
  slug: string;
  releaseYear: number | null;
  posterUrl: string | null;
  contentRating: string | null;
  runtimeMinutes: number | null;
  /** Series only; null for a film. */
  seasonCount: number | null;
  /** Series only; null for a film. */
  episodeCount: number | null;
  languageCode: string | null;
  genres: { name: string; slug: string }[];
  rating: string | null;
  ratingScale: string;
  ratingSource: string;
  contentKind: "movie" | "series";
};

/** A full detail-page payload. */
export type MovieDetail = {
  movie: Movie;
  genres: { id: string; name: string; slug: string }[];
  review: {
    id: string;
    reviewTitle: string | null;
    body: string;
    rating: string | null;
    ratingScale: string;
    ratingSource: string;
    reviewerName: string;
    publishedAt: Date | null;
  } | null;
  links: {
    id: string;
    providerName: string;
    destinationUrl: string;
    destinationHost: string;
    label: string;
    quality: string | null;
    fileSizeBytes: string | null;
    language: string | null;
    authorizationBasis: string;
    lastCheckedAt: Date | null;
  }[];
};

/* -------------------------------------------------------------------------- */
/* Conditions                                                                 */
/* -------------------------------------------------------------------------- */

/** The single source of truth for "a member of the public may see this film". */
export function publishedMovieCondition(): SQL {
  return and(eq(movies.status, "published"), isNotNull(movies.publishedAt)) as SQL;
}

function publishedReviewCondition(): SQL {
  return eq(reviews.status, "published");
}

/** Links that are live and carry a reviewed authorization basis. */
export function publiclyVisibleLinkCondition(): SQL {
  return and(
    eq(downloadLinks.status, "active"),
    isNotNull(downloadLinks.authorizationBasis),
    isNotNull(downloadLinks.authorizedAt),
  ) as SQL;
}

/* -------------------------------------------------------------------------- */
/* Hydration helpers                                                          */
/* -------------------------------------------------------------------------- */

type MovieRow = Pick<
  Movie,
  | "id"
  | "title"
  | "slug"
  | "releaseYear"
  | "posterUrl"
  | "contentRating"
  | "runtimeMinutes"
  | "seasonCount"
  | "episodeCount"
  | "languageCode"
  | "contentKind"
>;

/**
 * Attach genres and the editorial rating to a page of movies using two batched
 * queries rather than one query per card.
 */
async function decorateMovieRows(rows: MovieRow[]): Promise<MovieCard[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const [genreRows, reviewRows] = await Promise.all([
    executePrepared(
      db
        .select({
          movieId: movieGenres.movieId,
          name: genres.name,
          slug: genres.slug,
          displayOrder: genres.displayOrder,
        })
        .from(movieGenres)
        .innerJoin(genres, eq(genres.id, movieGenres.genreId))
        .where(inArray(movieGenres.movieId, ids))
        .orderBy(asc(genres.displayOrder), asc(genres.name)),
    ),
    executePrepared(
      db
        .select({
          movieId: reviews.movieId,
          rating: reviews.rating,
          ratingScale: reviews.ratingScale,
          ratingSource: reviews.ratingSource,
        })
        .from(reviews)
        .where(and(inArray(reviews.movieId, ids), publishedReviewCondition())),
    ),
  ]);

  const genresByMovie = new Map<string, { name: string; slug: string }[]>();
  for (const row of genreRows) {
    const list = genresByMovie.get(row.movieId) ?? [];
    list.push({ name: row.name, slug: row.slug });
    genresByMovie.set(row.movieId, list);
  }

  const reviewByMovie = new Map<string, (typeof reviewRows)[number]>();
  for (const row of reviewRows) {
    if (!reviewByMovie.has(row.movieId)) reviewByMovie.set(row.movieId, row);
  }

  return rows.map((row) => {
    const review = reviewByMovie.get(row.id);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      releaseYear: row.releaseYear,
      posterUrl: row.posterUrl,
      contentRating: row.contentRating,
      runtimeMinutes: row.runtimeMinutes,
      seasonCount: row.seasonCount,
      episodeCount: row.episodeCount,
      languageCode: row.languageCode,
      genres: genresByMovie.get(row.id) ?? [],
      rating: review?.rating ?? null,
      ratingScale: review?.ratingScale ?? "10.0",
      ratingSource: review?.ratingSource ?? "editorial",
      contentKind: row.contentKind,
    };
  });
}

const CARD_COLUMNS = {
  id: movies.id,
  title: movies.title,
  slug: movies.slug,
  releaseYear: movies.releaseYear,
  posterUrl: movies.posterUrl,
  contentRating: movies.contentRating,
  runtimeMinutes: movies.runtimeMinutes,
  seasonCount: movies.seasonCount,
  episodeCount: movies.episodeCount,
  languageCode: movies.languageCode,
  contentKind: movies.contentKind,
} as const;

/* -------------------------------------------------------------------------- */
/* Catalogue listing                                                          */
/* -------------------------------------------------------------------------- */

export type CatalogueFilters = {
  page?: number;
  pageSize?: number;
  q?: string | null;
  genreSlug?: string | null;
  year?: number | null;
  language?: string | null;
  contentRating?: string | null;
  sort?: "newest" | "title" | "year";
  /**
   * Restrict the listing to one kind. Omit for "everything", which is what the
   * search page wants — a visitor searching "tears of steel" should not have to
   * know whether it is filed as a film or a series.
   */
  contentKind?: "movie" | "series" | null;
};

export type CataloguePage = {
  items: MovieCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function buildCatalogueConditions(filters: CatalogueFilters): SQL[] {
  const conditions: SQL[] = [publishedMovieCondition()];

  if (filters.contentKind) {
    conditions.push(eq(movies.contentKind, filters.contentKind));
  }

  const term = filters.q?.trim();
  if (term) {
    const pattern = `%${escapeLikePattern(term)}%`;
    const match = or(ilike(movies.title, pattern), ilike(movies.originalTitle, pattern));
    if (match) conditions.push(match);
  }

  if (filters.genreSlug) {
    conditions.push(
      sql`exists (
        select 1
        from ${movieGenres}
        inner join ${genres} on ${genres.id} = ${movieGenres.genreId}
        where ${movieGenres.movieId} = ${movies.id}
          and ${genres.slug} = ${filters.genreSlug}
      )`,
    );
  }

  if (filters.year) {
    conditions.push(eq(movies.releaseYear, filters.year));
  }

  if (filters.language) {
    conditions.push(eq(movies.languageCode, filters.language));
  }

  if (filters.contentRating) {
    conditions.push(eq(movies.contentRating, filters.contentRating));
  }

  return conditions;
}

function catalogueOrderBy(sort: CatalogueFilters["sort"]) {
  switch (sort) {
    case "title":
      return [asc(movies.title)];
    case "year":
      return [desc(movies.releaseYear), asc(movies.title)];
    default:
      return [desc(movies.publishedAt), desc(movies.createdAt)];
  }
}

/**
 * A row of the single-query catalogue listing, as Postgres returns it.
 *
 * Column names are snake_case because this shape mirrors the wire format
 * rather than the Drizzle schema; `catalogueRowToCard` is the only place that
 * translates. `numeric` columns arrive as strings — Postgres `numeric` is
 * arbitrary precision and the driver will not silently narrow it to a float.
 */
type CatalogueRow = {
  id: string;
  title: string;
  slug: string;
  release_year: number | null;
  poster_url: string | null;
  content_rating: string | null;
  runtime_minutes: number | null;
  season_count: number | null;
  episode_count: number | null;
  language_code: string | null;
  genres: { name: string; slug: string }[] | null;
  rating: string | null;
  rating_scale: string | null;
  rating_source: string | null;
  content_kind: "movie" | "series";
};

function catalogueRowToCard(row: CatalogueRow): MovieCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    releaseYear: row.release_year,
    posterUrl: row.poster_url,
    contentRating: row.content_rating,
    runtimeMinutes: row.runtime_minutes,
    seasonCount: row.season_count,
    episodeCount: row.episode_count,
    languageCode: row.language_code,
    genres: row.genres ?? [],
    rating: row.rating,
    ratingScale: row.rating_scale ?? "10.0",
    ratingSource: row.rating_source ?? "editorial",
    contentKind: row.content_kind,
  };
}

export async function listPublishedMovies(filters: CatalogueFilters = {}): Promise<CataloguePage> {
  const pageSize = Math.min(Math.max(filters.pageSize ?? PAGE_SIZE, 1), 60);
  const requestedPage = Math.max(filters.page ?? 1, 1);
  const conditions = buildCatalogueConditions(filters);
  const where = and(...conditions);
  // Clamp the offset so a huge page number cannot force a full scan.
  const offset = (Math.min(requestedPage, 500) - 1) * pageSize;
  const orderBy = catalogueOrderBy(filters.sort);

  const [countRows, rows] = await Promise.all([
    executePrepared(
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(movies)
        .where(where),
    ),

    // One query, not three. Genres and the editorial rating are aggregated per
    // film here rather than fetched afterwards in a second batch, so a
    // catalogue page costs one network wait instead of two.
    //
    // The laterals are safe to `limit 1` on the review because
    // `reviews_movie_published_key` is unique on
    // `(movie_id) where status = 'published'` — a film has at most one
    // published review, so there is nothing to disambiguate.
    executePrepared<CatalogueRow>(sql`
      select
        movies.id,
        movies.title,
        movies.slug,
        movies.release_year,
        movies.poster_url,
        movies.content_rating,
        movies.runtime_minutes,
        movies.season_count,
        movies.episode_count,
        movies.content_kind,
        movies.language_code,
        coalesce(film_genres.list, '[]'::json) as genres,
        film_review.rating,
        film_review.rating_scale,
        film_review.rating_source
      from movies
      left join lateral (
        select json_agg(
                 json_build_object('name', g.name, 'slug', g.slug)
                 order by g.display_order, g.name
               ) as list
        from movie_genres mg
        inner join genres g on g.id = mg.genre_id
        where mg.movie_id = movies.id
      ) as film_genres on true
      left join lateral (
        select r.rating, r.rating_scale, r.rating_source
        from reviews r
        where r.movie_id = movies.id and r.status = 'published'
        limit 1
      ) as film_review on true
      where ${where}
      order by ${sql.join(orderBy, sql`, `)}
      limit ${pageSize}
      offset ${offset}
    `),
  ]);

  const total = countRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return {
    items: rows.map(catalogueRowToCard),
    total,
    page,
    pageSize,
    totalPages,
  };
}

/* -------------------------------------------------------------------------- */
/* Home page collections                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Home-page collections.
 *
 * Every one of these takes a `contentKind` and defaults to `"movie"`, which is
 * what preserves the existing home page: the rails there are film rails. The
 * series page passes `"series"` so it never shows a film.
 */
export async function listFeaturedMovies(
  limit = 5,
  contentKind: "movie" | "series" = "movie",
): Promise<MovieCard[]> {
  const rows = await executePrepared(
    db
      .select(CARD_COLUMNS)
      .from(movies)
      .where(
        and(
          publishedMovieCondition(),
          eq(movies.contentKind, contentKind),
          eq(movies.featured, true),
        ),
      )
      .orderBy(desc(movies.curationWeight), desc(movies.publishedAt))
      .limit(limit),
  );

  return decorateMovieRows(rows);
}

export async function listRecentlyPublished(
  limit = 12,
  contentKind: "movie" | "series" = "movie",
): Promise<MovieCard[]> {
  const rows = await executePrepared(
    db
      .select(CARD_COLUMNS)
      .from(movies)
      .where(and(publishedMovieCondition(), eq(movies.contentKind, contentKind)))
      .orderBy(desc(movies.publishedAt))
      .limit(limit),
  );

  return decorateMovieRows(rows);
}

/**
 * "Editor's picks" — ordered by the manual curation weight an editor sets,
 * never by a fabricated popularity metric.
 */
export async function listCuratedMovies(
  limit = 12,
  contentKind: "movie" | "series" = "movie",
): Promise<MovieCard[]> {
  const rows = await executePrepared(
    db
      .select(CARD_COLUMNS)
      .from(movies)
      .where(
        and(
          publishedMovieCondition(),
          eq(movies.contentKind, contentKind),
          sql`${movies.curationWeight} <> 0`,
        ),
      )
      .orderBy(desc(movies.curationWeight), desc(movies.publishedAt))
      .limit(limit),
  );

  return decorateMovieRows(rows);
}

/** Highest-rated published entries, by editorial score. */
export async function listTopRatedMovies(
  limit = 12,
  contentKind: "movie" | "series" = "movie",
): Promise<MovieCard[]> {
  const rows = await executePrepared(
    db
      .select(CARD_COLUMNS)
      .from(movies)
      .innerJoin(reviews, and(eq(reviews.movieId, movies.id), publishedReviewCondition()))
      .where(
        and(
          publishedMovieCondition(),
          eq(movies.contentKind, contentKind),
          isNotNull(reviews.rating),
        ),
      )
      .orderBy(desc(reviews.rating), desc(movies.publishedAt))
      .limit(limit),
  );

  return decorateMovieRows(rows);
}

/* -------------------------------------------------------------------------- */
/* Detail page                                                                */
/* -------------------------------------------------------------------------- */

async function loadPublishedMovieBySlug(slug: string): Promise<MovieDetail | null> {
  const movieRows = await executePrepared(
    db
      .select(getTableColumns(movies))
      .from(movies)
      .where(and(eq(movies.slug, slug), publishedMovieCondition()))
      .limit(1),
  );

  const movie = movieRows[0];
  if (!movie) return null;

  const [genreRows, reviewRows, linkRows] = await Promise.all([
    executePrepared(
      db
        .select({
          id: genres.id,
          name: genres.name,
          slug: genres.slug,
          displayOrder: genres.displayOrder,
        })
        .from(movieGenres)
        .innerJoin(genres, eq(genres.id, movieGenres.genreId))
        .where(eq(movieGenres.movieId, movie.id))
        .orderBy(asc(genres.displayOrder), asc(genres.name)),
    ),

    executePrepared(
      db
        .select({
          id: reviews.id,
          reviewTitle: reviews.reviewTitle,
          body: reviews.body,
          rating: reviews.rating,
          ratingScale: reviews.ratingScale,
          ratingSource: reviews.ratingSource,
          reviewerName: reviews.reviewerName,
          publishedAt: reviews.publishedAt,
        })
        .from(reviews)
        .where(and(eq(reviews.movieId, movie.id), publishedReviewCondition()))
        .limit(1),
    ),

    // Note the explicit column list: `authorization_reference` is absent by
    // design and can never reach the client.
    executePrepared(
      db
        .select({
          id: downloadLinks.id,
          providerName: downloadLinks.providerName,
          destinationUrl: downloadLinks.destinationUrl,
          destinationHost: downloadLinks.destinationHost,
          label: downloadLinks.label,
          quality: downloadLinks.quality,
          fileSizeBytes: downloadLinks.fileSizeBytes,
          language: downloadLinks.language,
          authorizationBasis: downloadLinks.authorizationBasis,
          lastCheckedAt: downloadLinks.lastCheckedAt,
        })
        .from(downloadLinks)
        .where(and(eq(downloadLinks.movieId, movie.id), publiclyVisibleLinkCondition()))
        .orderBy(asc(downloadLinks.label)),
    ),
  ]);

  return {
    movie,
    genres: genreRows.map(({ id, name, slug }) => ({ id, name, slug })),
    review: reviewRows[0] ?? null,
    links: linkRows,
  };
}

/**
 * The film detail payload, memoised per request.
 *
 * `generateMetadata` and the page component both need this record, and without
 * deduplication every detail page issues the same query twice — four round
 * trips to the database instead of two. On a pooled remote database that
 * latency is the dominant cost of opening a film, so it is worth removing.
 *
 * `cache` is scoped to a single server request, so this is not a stale-data
 * risk: nothing is shared between requests.
 */
export const getPublishedMovieBySlug = cache(loadPublishedMovieBySlug);

/**
 * A single authorized link, for the ad-supported hand-off page.
 *
 * Returns `null` unless the link is live *and* its film is published, so a link
 * id cannot be used to reach content on a film that is still a draft. As
 * everywhere in this module, `authorization_reference` is never selected.
 */
export async function getPublicDownloadLinkById(id: string) {
  const rows = await executePrepared(
    db
      .select({
        id: downloadLinks.id,
        providerName: downloadLinks.providerName,
        destinationUrl: downloadLinks.destinationUrl,
        destinationHost: downloadLinks.destinationHost,
        label: downloadLinks.label,
        quality: downloadLinks.quality,
        fileSizeBytes: downloadLinks.fileSizeBytes,
        language: downloadLinks.language,
        authorizationBasis: downloadLinks.authorizationBasis,
        lastCheckedAt: downloadLinks.lastCheckedAt,
        movieTitle: movies.title,
        movieSlug: movies.slug,
      })
      .from(downloadLinks)
      .innerJoin(movies, eq(movies.id, downloadLinks.movieId))
      .where(
        and(eq(downloadLinks.id, id), publiclyVisibleLinkCondition(), publishedMovieCondition()),
      )
      .limit(1),
  );

  return rows[0] ?? null;
}

/**
 * Related films sharing at least one genre.
 *
 * Ordering is deterministic (most recently published first) rather than
 * shuffled, so the page can be cached and does not flicker between requests.
 *
 * Keyed on the *slug* rather than a movie id plus its genre ids. That is
 * deliberate: it means this query does not have to wait for the detail query to
 * resolve first, so the two can run concurrently. On a database in another
 * region one saved round trip is worth more than the subquery costs.
 */
/**
 * Entries sharing a genre with the one being viewed.
 *
 * Scoped to the same `contentKind` so a series never recommends films and a
 * film never recommends series — the two are separate sections of the site, and
 * mixing them in the "related" rail would undercut that.
 */
export async function listRelatedMovies(
  slug: string,
  limit = 6,
  contentKind: "movie" | "series" = "movie",
): Promise<MovieCard[]> {
  const genresOfThisFilm = db
    .select({ genreId: movieGenres.genreId })
    .from(movieGenres)
    .innerJoin(movies, eq(movies.id, movieGenres.movieId))
    .where(and(eq(movies.slug, slug), publishedMovieCondition()));

  const sharesGenre = db
    .select({ id: movieGenres.movieId })
    .from(movieGenres)
    .where(inArray(movieGenres.genreId, genresOfThisFilm));

  const rows = await executePrepared(
    db
      .select(CARD_COLUMNS)
      .from(movies)
      .where(
        and(
          publishedMovieCondition(),
          eq(movies.contentKind, contentKind),
          ne(movies.slug, slug),
          inArray(movies.id, sharesGenre),
        ),
      )
      .orderBy(desc(movies.publishedAt))
      .limit(limit),
  );

  return decorateMovieRows(rows);
}

/* -------------------------------------------------------------------------- */
/* Collections: genres and years                                              */
/* -------------------------------------------------------------------------- */

export type GenreWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  movieCount: number;
};

/**
 * Genres with a count of published entries that carry them.
 *
 * `contentKind` scopes the counts to one kind, so the filter dropdown on
 * `/series` lists series genres rather than film ones. Omit it for everything.
 */
export async function listGenresWithCounts(
  contentKind?: "movie" | "series",
): Promise<GenreWithCount[]> {
  const rows = await executePrepared(
    db
      .select({
        id: genres.id,
        name: genres.name,
        slug: genres.slug,
        description: genres.description,
        displayOrder: genres.displayOrder,
        movieCount: sql<number>`count(${movies.id})::int`,
      })
      .from(genres)
      .leftJoin(movieGenres, eq(movieGenres.genreId, genres.id))
      .leftJoin(
        movies,
        and(
          eq(movies.id, movieGenres.movieId),
          publishedMovieCondition(),
          contentKind ? eq(movies.contentKind, contentKind) : undefined,
        ),
      )
      .groupBy(genres.id, genres.name, genres.slug, genres.description, genres.displayOrder)
      .orderBy(asc(genres.displayOrder), asc(genres.name)),
  );

  return rows.map(({ displayOrder: _ignored, ...genre }) => genre);
}

async function loadGenreBySlug(slug: string) {
  const rows = await executePrepared(
    db.select(getTableColumns(genres)).from(genres).where(eq(genres.slug, slug)).limit(1),
  );
  return rows[0] ?? null;
}

/**
 * A genre, memoised per request.
 *
 * `generateMetadata` and the page component both resolve the genre for the
 * same slug. Without deduplication that is two round trips to a database in
 * another region instead of one — the same reasoning as
 * `getPublishedMovieBySlug` below. `cache` is request-scoped, so nothing is
 * shared between requests and there is no staleness risk.
 */
export const getGenreBySlug = cache(loadGenreBySlug);

export type YearWithCount = { year: number; movieCount: number };

export async function listYearsWithCounts(
  contentKind?: "movie" | "series",
): Promise<YearWithCount[]> {
  const rows = await executePrepared(
    db
      .select({
        year: movies.releaseYear,
        movieCount: sql<number>`count(*)::int`,
      })
      .from(movies)
      .where(
        and(
          publishedMovieCondition(),
          isNotNull(movies.releaseYear),
          contentKind ? eq(movies.contentKind, contentKind) : undefined,
        ),
      )
      .groupBy(movies.releaseYear)
      .orderBy(desc(movies.releaseYear)),
  );

  return rows
    .filter((row): row is { year: number; movieCount: number } => row.year !== null)
    .map((row) => ({ year: row.year, movieCount: row.movieCount }));
}

/* -------------------------------------------------------------------------- */
/* Sitemap / feed support                                                     */
/* -------------------------------------------------------------------------- */

export type SitemapEntry = { slug: string; updatedAt: Date; contentKind: "movie" | "series" };

export async function listPublishedSlugsForSitemap(limit = 5000): Promise<SitemapEntry[]> {
  return executePrepared(
    db
      .select({
        slug: movies.slug,
        updatedAt: movies.updatedAt,
        contentKind: movies.contentKind,
      })
      .from(movies)
      .where(publishedMovieCondition())
      .orderBy(desc(movies.updatedAt))
      .limit(limit),
  );
}

export async function countPublishedMovies(): Promise<number> {
  const rows = await executePrepared(
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(movies)
      .where(publishedMovieCondition()),
  );
  return rows[0]?.total ?? 0;
}
