import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { downloadLinks, movies, reviews } from "@/db/schema";
import {
  getPublishedMovieBySlug,
  listGenresWithCounts,
  listPublishedMovies,
  listPublishedSlugsForSitemap,
  listYearsWithCounts,
} from "@/db/queries/public";

/**
 * Public access filtering — the rule that only approved content is visible.
 *
 * ---------------------------------------------------------------------------
 * These tests are SKIPPED unless `RUN_DB_TESTS=1` is set.
 * ---------------------------------------------------------------------------
 * They write real rows, so they must never run against production. Point
 * DATABASE_URL at a development or staging database and run:
 *
 *   RUN_DB_TESTS=1 pnpm test tests/integration
 *
 * Everything created here is removed in `afterAll`, and every slug is suffixed
 * so a crashed run cannot collide with the next one.
 */

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";

const SUFFIX = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const PUBLISHED_SLUG = `mm-yoteshin-it-published-${SUFFIX}`;
const DRAFT_SLUG = `mm-yoteshin-it-draft-${SUFFIX}`;

/** The private evidence string. It must never appear in a public payload. */
const PRIVATE_REFERENCE = "IT-PRIVATE-AUTHORIZATION-REFERENCE-DO-NOT-LEAK";

let publishedMovieId = "";
let draftMovieId = "";
let activeLinkId = "";
let pendingLinkId = "";
let reviewId = "";

/**
 * A body long enough to satisfy the editorial publication rule, so this fixture
 * could also be published through the real service layer.
 */
const REVIEW_BODY =
  "An integration-test review body. It exists so the detail query has a " +
  "published review to hydrate, which is what exercises the date decoding on " +
  "`reviews.published_at` — the exact path that once returned a raw string and " +
  "made `publishedAt.toISOString()` fail at render time.";

/**
 * Assert that Postgres refuses a write with a specific check-constraint
 * violation.
 *
 * Drizzle wraps the driver error, so the constraint name and SQLSTATE live on
 * `cause` rather than on `error.message` — matching on the message would only
 * ever see "Failed query: update …". Asserting the SQLSTATE (`23514`,
 * check_violation) as well as the constraint name means a *different*
 * constraint firing cannot be mistaken for the expected one.
 */
async function expectConstraintViolation(
  promise: Promise<unknown>,
  constraintName: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const pgError = (error as { cause?: { code?: string; constraint_name?: string } }).cause;
    expect(pgError?.code).toBe("23514");
    expect(pgError?.constraint_name).toBe(constraintName);
    return;
  }

  throw new Error(
    `Expected the write to be refused by "${constraintName}", but it succeeded. ` +
      "The constraint may have been dropped or altered.",
  );
}

describe.skipIf(!RUN_DB_TESTS)("public access filtering", () => {
  beforeAll(async () => {
    const published = await db
      .insert(movies)
      .values({
        title: "Integration Test — Published",
        slug: PUBLISHED_SLUG,
        status: "published",
        publishedAt: new Date(),
        /*
         * Deliberately chosen column types, so the assertions further down can
         * tell a correctly decoded value from a raw string:
         *   release_year     integer                  → number
         *   release_date     timestamp, mode "string" → string
         *   runtime_minutes  integer                  → number
         */
        releaseYear: 2011,
        releaseDate: "2011-01-01 00:00:00",
        runtimeMinutes: 100,
      })
      .returning({ id: movies.id });

    publishedMovieId = published[0]!.id;

    const review = await db
      .insert(reviews)
      .values({
        movieId: publishedMovieId,
        reviewTitle: "Integration Test — Review",
        body: REVIEW_BODY,
        rating: "7.5",
        ratingScale: "10.0",
        ratingSource: "editorial",
        reviewerName: "Integration Test Reviewer",
        status: "published",
        publishedAt: new Date(),
      })
      .returning({ id: reviews.id });

    reviewId = review[0]!.id;

    const draft = await db
      .insert(movies)
      .values({
        title: "Integration Test — Draft",
        slug: DRAFT_SLUG,
        status: "draft",
      })
      .returning({ id: movies.id });

    draftMovieId = draft[0]!.id;

    // A fully authorized, live link.
    const active = await db
      .insert(downloadLinks)
      .values({
        movieId: publishedMovieId,
        providerName: "Integration Test Provider",
        label: "Authorized download — integration test",
        destinationUrl: "https://example.com/authorized/integration-test",
        destinationHost: "example.com",
        status: "active",
        authorizationBasis: "written_permission",
        authorizedAt: new Date(),
        authorizationReference: PRIVATE_REFERENCE,
      })
      .returning({ id: downloadLinks.id });

    activeLinkId = active[0]!.id;

    // A link that has been created but never authorized.
    const pending = await db
      .insert(downloadLinks)
      .values({
        movieId: publishedMovieId,
        providerName: "Integration Test Provider",
        label: "Pending download — integration test",
        destinationUrl: "https://example.com/pending/integration-test",
        destinationHost: "example.com",
        status: "pending_review",
        authorizationBasis: "written_permission",
        authorizationReference: "PENDING-NOT-YET-AUTHORIZED",
      })
      .returning({ id: downloadLinks.id });

    pendingLinkId = pending[0]!.id;
  });

  afterAll(async () => {
    if (reviewId) {
      await db.delete(reviews).where(eq(reviews.id, reviewId));
    }

    const ids = [activeLinkId, pendingLinkId].filter(Boolean);
    if (ids.length > 0) {
      await db.delete(downloadLinks).where(inArray(downloadLinks.id, ids));
    }

    const movieIds = [publishedMovieId, draftMovieId].filter(Boolean);
    if (movieIds.length > 0) {
      await db.delete(movies).where(inArray(movies.id, movieIds));
    }
  });

  it("a published film appears in the catalogue", async () => {
    const page = await listPublishedMovies({ pageSize: 60 });

    expect(page.items.map((item) => item.slug)).toContain(PUBLISHED_SLUG);
  });

  it("a draft film is absent from the catalogue", async () => {
    const page = await listPublishedMovies({ pageSize: 60 });

    expect(page.items.map((item) => item.slug)).not.toContain(DRAFT_SLUG);
  });

  it("a draft film is not resolvable by slug", async () => {
    // Guessing the slug must not be a way to discover unpublished content.
    expect(await getPublishedMovieBySlug(DRAFT_SLUG)).toBeNull();
  });

  it("a published film is resolvable by slug", async () => {
    const detail = await getPublishedMovieBySlug(PUBLISHED_SLUG);

    expect(detail).not.toBeNull();
    expect(detail!.movie.slug).toBe(PUBLISHED_SLUG);
  });

  it("only active, authorized links are returned for a published film", async () => {
    const detail = await getPublishedMovieBySlug(PUBLISHED_SLUG);

    expect(detail).not.toBeNull();
    expect(detail!.links.map((link) => link.id)).toEqual([activeLinkId]);
    expect(detail!.links.map((link) => link.id)).not.toContain(pendingLinkId);
  });

  it("the private authorization reference is not part of the public payload", async () => {
    const detail = await getPublishedMovieBySlug(PUBLISHED_SLUG);

    expect(detail).not.toBeNull();
    expect(detail!.links[0]).not.toHaveProperty("authorizationReference");
    expect(detail!.links[0]).not.toHaveProperty("authorizationNotes");

    // The strongest form of the check: it must not appear anywhere in the
    // serialised object that a page or route handler would send.
    expect(JSON.stringify(detail)).not.toContain(PRIVATE_REFERENCE);
  });

  it("the sitemap lists published films only", async () => {
    const entries = await listPublishedSlugsForSitemap();
    const slugs = entries.map((entry) => entry.slug);

    expect(slugs).toContain(PUBLISHED_SLUG);
    expect(slugs).not.toContain(DRAFT_SLUG);
  });

  it("archiving a published film removes it from public view", async () => {
    await db.update(movies).set({ status: "archived" }).where(eq(movies.id, publishedMovieId));

    try {
      expect(await getPublishedMovieBySlug(PUBLISHED_SLUG)).toBeNull();

      const page = await listPublishedMovies({ pageSize: 60 });
      expect(page.items.map((item) => item.slug)).not.toContain(PUBLISHED_SLUG);
    } finally {
      await db.update(movies).set({ status: "published" }).where(eq(movies.id, publishedMovieId));
    }
  });

  it("a published film cannot exist without a published_at timestamp", async () => {
    /*
     * The public query requires `status = 'published' AND published_at IS NOT
     * NULL`. The first draft of this test set `published_at` to null and then
     * asserted the query hid the row — which cannot be done, because
     * `movies_published_requires_timestamp` makes that row impossible to write
     * in the first place.
     *
     * So assert the guarantee at the layer that actually provides it. This is
     * the *stronger* claim: the inconsistent row cannot exist, rather than
     * existing and being filtered out. The query-layer condition remains as
     * defence in depth for the case where the constraint is ever dropped.
     */
    await expectConstraintViolation(
      db.update(movies).set({ publishedAt: null }).where(eq(movies.id, publishedMovieId)),
      "movies_published_requires_timestamp",
    );

    // Nothing changed, so the film is still publicly readable.
    expect(await getPublishedMovieBySlug(PUBLISHED_SLUG)).not.toBeNull();
  });

  it("an active link cannot exist without an authorization timestamp", async () => {
    // Same reasoning as the test above: `download_links_active_requires_
    // authorization` refuses the write, so the public query's
    // `authorized_at IS NOT NULL` condition never has an inconsistent row to
    // filter out. The constraint is what enforces this, not the query.
    await expectConstraintViolation(
      db
        .update(downloadLinks)
        .set({ authorizedAt: null })
        .where(eq(downloadLinks.id, activeLinkId)),
      "download_links_active_requires_authorization",
    );

    // The link is still active and still publicly listed.
    const detail = await getPublishedMovieBySlug(PUBLISHED_SLUG);
    expect(detail!.links.map((link) => link.id)).toContain(activeLinkId);
  });

  /*
   * ---------------------------------------------------------------------------
   * Value fidelity through the prepared read path
   * ---------------------------------------------------------------------------
   * Every public read runs as a server-side prepared statement through
   * `executePrepared`, which must delegate to Drizzle's own prepared query.
   * Two things only Drizzle can do have to happen after the rows arrive:
   * positional renaming and per-column value decoding.
   *
   * Skipping either was a shipped bug in this project:
   *
   *   1. Rows came back keyed by *Postgres* column names, so every camelCase
   *      key — `year`, `movieCount`, `releaseYear` — was silently `undefined`.
   *      That emptied the year dropdown and the genre list on the catalogue
   *      filter bar, and made React warn about missing `key` props.
   *   2. `drizzle-orm/postgres-js` replaces postgres.js's date parsers with an
   *      identity function (`client.options.parsers["1184"] = (val) => val`),
   *      so date/time columns arrive as raw strings and each column's
   *      `mapFromDriverValue` performs the conversion. Without it,
   *      `review.publishedAt` was the truthy string
   *      `"2026-10-11 17:03:53.502+00"` and `publishedAt.toISOString()` threw
   *      `is not a function` at render time.
   *
   * Both failures still rendered a page rather than throwing at the data layer,
   * so only assertions on the *types* of the returned values catch them.
   */
  describe("value fidelity through the prepared read path", () => {
    it("decodes timestamp columns to Date", async () => {
      const detail = await getPublishedMovieBySlug(PUBLISHED_SLUG);

      expect(detail).not.toBeNull();
      expect(detail!.movie.publishedAt).toBeInstanceOf(Date);
      expect(detail!.review?.publishedAt).toBeInstanceOf(Date);

      const entries = await listPublishedSlugsForSitemap();
      const entry = entries.find((row) => row.slug === PUBLISHED_SLUG);
      expect(entry?.updatedAt).toBeInstanceOf(Date);
    });

    it('leaves a `mode: "string"` timestamp as a string', async () => {
      // `movies.release_date` is declared `mode: "string"` precisely so it is
      // never shifted by a timezone conversion. Decoding it to a Date would
      // break the declared type, so this guards the opposite direction.
      const detail = await getPublishedMovieBySlug(PUBLISHED_SLUG);

      expect(typeof detail!.movie.releaseDate).toBe("string");
      expect(detail!.movie.releaseDate).toContain("2011-01-01");
    });

    it("keeps integer and numeric columns in their declared types", async () => {
      const detail = await getPublishedMovieBySlug(PUBLISHED_SLUG);

      expect(detail!.movie.releaseYear).toBe(2011);
      expect(detail!.movie.runtimeMinutes).toBe(100);
      // Postgres `numeric` is arbitrary precision, so the driver returns a
      // string and `MovieDetail` declares it as one.
      expect(typeof detail!.review?.rating).toBe("string");
      expect(detail!.review?.rating).toBe("7.5");
    });

    it("returns collection counts under their camelCase keys", async () => {
      // Bug 1 above: these keys were `undefined`.
      const years = await listYearsWithCounts();
      const year = years.find((row) => row.year === 2011);

      expect(year).toBeDefined();
      expect(typeof year!.movieCount).toBe("number");
      expect(year!.movieCount).toBeGreaterThanOrEqual(1);

      const genres = await listGenresWithCounts();
      expect(genres.length).toBeGreaterThan(0);
      for (const genre of genres) {
        expect(typeof genre.movieCount).toBe("number");
        expect(typeof genre.slug).toBe("string");
      }
    });

    it("returns catalogue cards with their declared value types", async () => {
      // This path is a raw SQL aggregate, so it exercises the other branch of
      // `executePrepared` — the one with no Drizzle field metadata to map with.
      const page = await listPublishedMovies({ pageSize: 60 });
      const card = page.items.find((item) => item.slug === PUBLISHED_SLUG);

      expect(card).toBeDefined();
      expect(card!.releaseYear).toBe(2011);
      expect(typeof card!.rating).toBe("string");
      expect(card!.ratingScale).toBe("10.0");
      expect(typeof page.total).toBe("number");
    });
  });
});
