import { describe, expect, it } from "vitest";

import {
  evaluatePublicationReadiness,
  isLinkPubliclyVisible,
  isMoviePubliclyVisible,
  LINK_RECHECK_DAYS,
  MIN_REVIEW_LENGTH,
  type ReadinessInput,
} from "@/lib/services/publication";

/**
 * The publication gate.
 *
 * These tests encode the product rule that matters most: nothing goes live
 * without required metadata, an original published review, and — for any link
 * that is active — a reviewed authorization basis.
 */

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    movie: {
      title: "The Quiet Harbour",
      slug: "the-quiet-harbour",
      synopsis: "A".repeat(120),
      releaseYear: 1974,
      posterUrl: "https://images.test/poster.jpg",
      metaTitle: "The Quiet Harbour",
      metaDescription: "A description long enough to be useful in search results.",
      contentKind: "movie",
      seasonCount: null,
      episodeCount: null,
    },
    genreIds: ["genre-1"],
    reviews: [{ status: "published", body: "B".repeat(MIN_REVIEW_LENGTH + 50) }],
    links: [],
    ...overrides,
  };
}

function blockerCodes(input: ReadinessInput) {
  return evaluatePublicationReadiness(input).blockers.map((issue) => issue.code);
}

function warningCodes(input: ReadinessInput) {
  return evaluatePublicationReadiness(input).warnings.map((issue) => issue.code);
}

describe("evaluatePublicationReadiness", () => {
  it("passes for a complete record with no links", () => {
    const result = evaluatePublicationReadiness(baseInput());
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks a record with no title", () => {
    expect(blockerCodes(baseInput({ movie: { ...baseInput().movie, title: "  " } }))).toContain(
      "title_missing",
    );
  });

  it("blocks a record with no slug", () => {
    expect(blockerCodes(baseInput({ movie: { ...baseInput().movie, slug: "" } }))).toContain(
      "slug_missing",
    );
  });

  it("blocks a record with no release year", () => {
    expect(
      blockerCodes(baseInput({ movie: { ...baseInput().movie, releaseYear: null } })),
    ).toContain("release_year_missing");
  });

  it("blocks a synopsis that is too short", () => {
    expect(
      blockerCodes(baseInput({ movie: { ...baseInput().movie, synopsis: "Too short." } })),
    ).toContain("synopsis_too_short");
  });

  it("blocks a record with no genres", () => {
    expect(blockerCodes(baseInput({ genreIds: [] }))).toContain("genres_missing");
  });

  it("blocks a record with no published review", () => {
    expect(blockerCodes(baseInput({ reviews: [] }))).toContain("review_missing");
    expect(
      blockerCodes(baseInput({ reviews: [{ status: "draft", body: "x".repeat(500) }] })),
    ).toContain("review_missing");
  });

  it("blocks a published review that is too short to be real editorial work", () => {
    expect(
      blockerCodes(baseInput({ reviews: [{ status: "published", body: "Short review." }] })),
    ).toContain("review_too_short");
  });

  it("accepts a record with an active, authorised, recently checked link", () => {
    const result = evaluatePublicationReadiness(
      baseInput({
        links: [
          {
            status: "active",
            authorizationBasis: "public_domain",
            authorizedAt: new Date("2026-01-01"),
            lastCheckedAt: new Date("2026-09-01"),
            destinationHost: "archive.org",
          },
        ],
      }),
    );
    expect(result.ready).toBe(true);
  });

  it("blocks an active link that has no authorization basis", () => {
    const codes = blockerCodes(
      baseInput({
        links: [
          {
            status: "active",
            authorizationBasis: null,
            authorizedAt: null,
            lastCheckedAt: new Date(),
            destinationHost: "sketchy.example",
          },
        ],
      }),
    );
    expect(codes).toContain("link_missing_authorization");
    expect(codes).toContain("link_not_reviewed");
  });

  it("blocks an active link that was never reviewed, even with a basis recorded", () => {
    expect(
      blockerCodes(
        baseInput({
          links: [
            {
              status: "active",
              authorizationBasis: "written_permission",
              authorizedAt: null,
              lastCheckedAt: new Date(),
              destinationHost: "example.com",
            },
          ],
        }),
      ),
    ).toContain("link_not_reviewed");
  });

  it("warns rather than blocks when a live link has never been checked", () => {
    const warnings = warningCodes(
      baseInput({
        links: [
          {
            status: "active",
            authorizationBasis: "open_license",
            authorizedAt: new Date("2026-01-01"),
            lastCheckedAt: null,
            destinationHost: "example.com",
          },
        ],
      }),
    );
    expect(warnings).toContain("link_never_checked");
  });

  it("warns when a live link has not been checked within the recheck window", () => {
    const now = new Date("2026-10-11T00:00:00Z");
    const stale = new Date(now.getTime() - (LINK_RECHECK_DAYS + 30) * 86_400_000);

    const warnings = warningCodes(
      baseInput({
        now,
        links: [
          {
            status: "active",
            authorizationBasis: "open_license",
            authorizedAt: new Date("2020-01-01"),
            lastCheckedAt: stale,
            destinationHost: "example.com",
          },
        ],
      }),
    );
    expect(warnings).toContain("link_check_stale");
  });

  it("does not block on a pending-review link, but warns that it is hidden", () => {
    const result = evaluatePublicationReadiness(
      baseInput({
        links: [
          {
            status: "pending_review",
            authorizationBasis: "public_domain",
            authorizedAt: null,
            lastCheckedAt: null,
            destinationHost: "example.com",
          },
        ],
      }),
    );
    expect(result.ready).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toContain("links_pending_review");
  });

  it("warns about missing artwork without blocking publication", () => {
    const result = evaluatePublicationReadiness(
      baseInput({ movie: { ...baseInput().movie, posterUrl: null, metaDescription: null } }),
    );
    expect(result.ready).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toContain("poster_missing");
    expect(result.warnings.map((issue) => issue.code)).toContain("meta_description_missing");
  });

  /* ---- Series shape ------------------------------------------------------ */

  it("blocks a series with no season count", () => {
    const result = evaluatePublicationReadiness(
      baseInput({
        movie: { ...baseInput().movie, contentKind: "series", seasonCount: null },
      }),
    );

    expect(result.ready).toBe(false);
    expect(result.blockers.map((issue) => issue.code)).toContain("series_seasons_missing");
  });

  it("blocks a series whose season count is zero rather than null", () => {
    // 0 is what an editor gets by typing a zero, not by leaving the field blank,
    // and it is just as unpublishable.
    const result = evaluatePublicationReadiness(
      baseInput({
        movie: { ...baseInput().movie, contentKind: "series", seasonCount: 0 },
      }),
    );

    expect(result.blockers.map((issue) => issue.code)).toContain("series_seasons_missing");
  });

  it("publishes a series that carries a season count", () => {
    const result = evaluatePublicationReadiness(
      baseInput({
        movie: { ...baseInput().movie, contentKind: "series", seasonCount: 3 },
      }),
    );

    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("warns about a series with no episode total, but does not block it", () => {
    const result = evaluatePublicationReadiness(
      baseInput({
        movie: { ...baseInput().movie, contentKind: "series", seasonCount: 3, episodeCount: null },
      }),
    );

    expect(result.ready).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toContain("series_episodes_missing");
  });

  it("never raises the series rules for a film", () => {
    const result = evaluatePublicationReadiness(baseInput());

    expect(result.ready).toBe(true);
    expect(result.blockers.map((issue) => issue.code)).not.toContain("series_seasons_missing");
    expect(result.warnings.map((issue) => issue.code)).not.toContain("series_episodes_missing");
  });

  it("reports every blocker at once rather than only the first", () => {
    const result = evaluatePublicationReadiness({
      movie: {
        title: "",
        slug: "",
        synopsis: null,
        releaseYear: null,
        posterUrl: null,
        metaTitle: null,
        metaDescription: null,
        contentKind: "movie",
        seasonCount: null,
        episodeCount: null,
      },
      genreIds: [],
      reviews: [],
      links: [],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(6);
  });
});

describe("isLinkPubliclyVisible", () => {
  it("is true only for an active, authorised link", () => {
    expect(
      isLinkPubliclyVisible({
        status: "active",
        authorizationBasis: "public_domain",
        authorizedAt: new Date(),
      }),
    ).toBe(true);
  });

  it.each([
    ["pending_review", "public_domain", new Date()],
    ["disabled", "public_domain", new Date()],
    ["reported", "public_domain", new Date()],
    ["active", null, new Date()],
    ["active", "public_domain", null],
  ] as const)("is false for status=%s basis=%s", (status, basis, authorizedAt) => {
    expect(isLinkPubliclyVisible({ status, authorizationBasis: basis, authorizedAt })).toBe(false);
  });
});

describe("isMoviePubliclyVisible", () => {
  it("is true only for a published film with a publication timestamp", () => {
    expect(isMoviePubliclyVisible({ status: "published", publishedAt: new Date() })).toBe(true);
  });

  it.each([
    ["draft", new Date()],
    ["archived", new Date()],
    ["published", null],
  ] as const)("is false for status=%s publishedAt=%s", (status, publishedAt) => {
    expect(isMoviePubliclyVisible({ status, publishedAt })).toBe(false);
  });
});
