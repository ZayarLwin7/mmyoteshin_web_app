import { describe, expect, it } from "vitest";

import {
  PAGE_SIZE,
  adminUserCreateSchema,
  canonicalCatalogueQuery,
  catalogueQuerySchema,
  downloadLinkInputSchema,
  emailSchema,
  genreInputSchema,
  loginSchema,
  movieInputSchema,
  reportResolutionSchema,
  reportSubmissionSchema,
  reviewInputSchema,
  slugSchema,
  uuidSchema,
} from "@/lib/validation/schemas";

/**
 * Validation is the first trust boundary, so these tests are written as a
 * specification of what the boundary must accept and refuse — not as coverage
 * for its own sake.
 */

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("uuidSchema", () => {
  it("accepts a canonical UUID in either case", () => {
    expect(uuidSchema.safeParse(UUID).success).toBe(true);
    expect(uuidSchema.safeParse(UUID.toUpperCase()).success).toBe(true);
  });

  it("refuses anything that is not a UUID", () => {
    for (const value of ["", "not-a-uuid", "123", `${UUID}-extra`, "1"]) {
      expect(uuidSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("trims surrounding whitespace before validating", () => {
    expect(uuidSchema.safeParse(`  ${UUID}  `).success).toBe(true);
  });
});

describe("emailSchema", () => {
  it("accepts ordinary addresses", () => {
    expect(emailSchema.safeParse("editor@example.com").success).toBe(true);
  });

  it("normalises to lowercase so lookups are case-insensitive", () => {
    expect(emailSchema.parse("Editor@Example.COM")).toBe("editor@example.com");
  });

  it("refuses addresses without a domain", () => {
    for (const value of [
      "editor",
      "editor@",
      "@example.com",
      "editor@example",
      "a b@example.com",
    ]) {
      expect(emailSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("slugSchema", () => {
  it("accepts hyphen-separated words", () => {
    expect(slugSchema.safeParse("the-long-goodbye").success).toBe(true);
  });

  it("accepts non-Latin letters, because the catalogue is not English-only", () => {
    expect(slugSchema.safeParse("မိုးရွာသောနေ့").success).toBe(true);
    expect(slugSchema.safeParse("夜の海").success).toBe(true);
  });

  it("refuses leading, trailing or doubled hyphens", () => {
    for (const value of [
      "-leading",
      "trailing-",
      "double--hyphen",
      "has space",
      "has_underscore",
    ]) {
      expect(slugSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("movieInputSchema", () => {
  it("requires a title", () => {
    expect(movieInputSchema.safeParse({}).success).toBe(false);
    expect(movieInputSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("applies safe defaults so a minimal draft is valid", () => {
    const parsed = movieInputSchema.parse({ title: "Arrival" });

    expect(parsed.status).toBe("draft");
    expect(parsed.genreIds).toEqual([]);
    expect(parsed.featured).toBe(false);
    expect(parsed.slug).toBeNull();
  });

  it("coerces the checkbox value a browser actually sends", () => {
    expect(movieInputSchema.parse({ title: "A", featured: "on" }).featured).toBe(true);
    expect(movieInputSchema.parse({ title: "A", featured: "true" }).featured).toBe(true);
    expect(movieInputSchema.parse({ title: "A", featured: undefined }).featured).toBe(false);
    expect(movieInputSchema.parse({ title: "A", featured: "" }).featured).toBe(false);
  });

  it("rejects a release year outside the plausible range", () => {
    expect(movieInputSchema.safeParse({ title: "A", releaseYear: "1887" }).success).toBe(false);
    expect(movieInputSchema.safeParse({ title: "A", releaseYear: "2201" }).success).toBe(false);
    expect(movieInputSchema.safeParse({ title: "A", releaseYear: "1994" }).success).toBe(true);
  });

  it("treats an empty form field as null rather than as zero or an empty string", () => {
    const parsed = movieInputSchema.parse({
      title: "A",
      releaseYear: "",
      synopsis: "",
      country: "",
    });

    expect(parsed.releaseYear).toBeNull();
    expect(parsed.synopsis).toBeNull();
    expect(parsed.country).toBeNull();
  });

  it("refuses a poster URL that is not a public https address", () => {
    const bad = [
      "http://example.com/poster.jpg",
      "javascript:alert(1)",
      "https://127.0.0.1/poster.jpg",
      "https://localhost/poster.jpg",
      // Protocol-relative and backslash forms are attempts to smuggle a host
      // into something shaped like a path.
      "//evil.example.com/poster.jpg",
      "/\\evil.example.com/poster.jpg",
    ];

    for (const posterUrl of bad) {
      expect(movieInputSchema.safeParse({ title: "A", posterUrl }).success, posterUrl).toBe(false);
    }

    expect(
      movieInputSchema.safeParse({ title: "A", posterUrl: "https://cdn.example.com/p.jpg" })
        .success,
    ).toBe(true);
  });

  it("accepts a site-relative poster path, which is read from our own origin", () => {
    const parsed = movieInputSchema.parse({ title: "A", posterUrl: "/posters/charade.jpg" });
    expect(parsed.posterUrl).toBe("/posters/charade.jpg");
  });

  it("rejects a genre list that is not a list of UUIDs", () => {
    expect(movieInputSchema.safeParse({ title: "A", genreIds: ["nope"] }).success).toBe(false);
    expect(movieInputSchema.safeParse({ title: "A", genreIds: [UUID] }).success).toBe(true);
  });

  it("rejects a release date that is not ISO formatted", () => {
    expect(movieInputSchema.safeParse({ title: "A", releaseDate: "14/10/1994" }).success).toBe(
      false,
    );
    expect(movieInputSchema.safeParse({ title: "A", releaseDate: "1994-10-14" }).success).toBe(
      true,
    );
  });
});

describe("genreInputSchema", () => {
  it("requires a name of at least two characters", () => {
    expect(genreInputSchema.safeParse({ name: "D" }).success).toBe(false);
    expect(genreInputSchema.safeParse({ name: "Drama" }).success).toBe(true);
  });
});

describe("reviewInputSchema", () => {
  const base = { movieId: UUID, reviewerName: "A Reviewer" };

  it("requires an original body of at least 50 characters", () => {
    expect(reviewInputSchema.safeParse({ ...base, body: "Too short." }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, body: "x".repeat(50) }).success).toBe(true);
  });

  it("requires a reviewer name, because an unsigned review is not attributable", () => {
    expect(reviewInputSchema.safeParse({ movieId: UUID, body: "x".repeat(60) }).success).toBe(
      false,
    );
  });

  it("bounds the rating to the documented 0–10 scale", () => {
    expect(
      reviewInputSchema.safeParse({ ...base, body: "x".repeat(60), rating: "10.5" }).success,
    ).toBe(false);
    expect(
      reviewInputSchema.safeParse({ ...base, body: "x".repeat(60), rating: "-1" }).success,
    ).toBe(false);
    expect(
      reviewInputSchema.safeParse({ ...base, body: "x".repeat(60), rating: "8.5" }).success,
    ).toBe(true);
  });

  it("allows a review with no score at all", () => {
    const parsed = reviewInputSchema.parse({ ...base, body: "x".repeat(60), rating: "" });
    expect(parsed.rating).toBeNull();
  });

  it("defaults the rating source to editorial rather than an unnamed origin", () => {
    expect(reviewInputSchema.parse({ ...base, body: "x".repeat(60) }).ratingSource).toBe(
      "editorial",
    );
  });
});

describe("downloadLinkInputSchema", () => {
  const base = {
    movieId: UUID,
    providerName: "Example Archive",
    label: "Authorized download",
    authorizationBasis: "written_permission",
  };

  it("requires an https destination", () => {
    expect(
      downloadLinkInputSchema.safeParse({ ...base, destinationUrl: "http://example.com/f" })
        .success,
    ).toBe(false);
    expect(
      downloadLinkInputSchema.safeParse({ ...base, destinationUrl: "https://example.com/f" })
        .success,
    ).toBe(true);
  });

  it("refuses internal and loopback destinations", () => {
    for (const destinationUrl of [
      "https://localhost/f",
      "https://10.0.0.5/f",
      "https://192.168.1.10/f",
      "https://172.16.0.1/f",
      "https://[::1]/f",
    ]) {
      expect(
        downloadLinkInputSchema.safeParse({ ...base, destinationUrl }).success,
        destinationUrl,
      ).toBe(false);
    }
  });

  it("refuses a destination carrying embedded credentials", () => {
    expect(
      downloadLinkInputSchema.safeParse({
        ...base,
        destinationUrl: "https://user:pass@example.com/f",
      }).success,
    ).toBe(false);
  });

  it("defaults new links to pending review, never to active", () => {
    const parsed = downloadLinkInputSchema.parse({
      ...base,
      destinationUrl: "https://example.com/f",
    });
    expect(parsed.status).toBe("pending_review");
  });

  it("requires a recognized authorization basis", () => {
    expect(
      downloadLinkInputSchema.safeParse({
        ...base,
        authorizationBasis: "because-i-said-so",
        destinationUrl: "https://example.com/f",
      }).success,
    ).toBe(false);
  });
});

describe("reportSubmissionSchema", () => {
  const base = { reason: "broken_link", details: "The link now points somewhere else entirely." };

  it("requires enough detail to act on", () => {
    expect(reportSubmissionSchema.safeParse({ ...base, details: "broken" }).success).toBe(false);
    expect(reportSubmissionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a filled honeypot", () => {
    expect(
      reportSubmissionSchema.safeParse({ ...base, website: "http://spam.example" }).success,
    ).toBe(false);
    expect(reportSubmissionSchema.safeParse({ ...base, website: "" }).success).toBe(true);
  });

  it("accepts a report against a film or against a single link", () => {
    expect(reportSubmissionSchema.safeParse({ ...base, movieId: UUID }).success).toBe(true);
    expect(reportSubmissionSchema.safeParse({ ...base, downloadLinkId: UUID }).success).toBe(true);
  });
});

describe("reportResolutionSchema", () => {
  it("only accepts the four real statuses", () => {
    for (const status of ["new", "under_review", "resolved", "rejected"]) {
      expect(reportResolutionSchema.safeParse({ reportId: UUID, status }).success, status).toBe(
        true,
      );
    }
    expect(reportResolutionSchema.safeParse({ reportId: UUID, status: "closed" }).success).toBe(
      false,
    );
  });

  it("defaults the link-disabling checkbox to false", () => {
    expect(
      reportResolutionSchema.parse({ reportId: UUID, status: "resolved" }).disableReportedLink,
    ).toBe(false);
  });
});

describe("catalogueQuerySchema", () => {
  it("falls back to sensible defaults for an empty query", () => {
    const parsed = catalogueQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.sort).toBe("newest");
    expect(parsed.q).toBeUndefined();
  });

  it("never throws on hostile input, because a public URL is untrusted", () => {
    const parsed = catalogueQuerySchema.parse({
      page: "not-a-number",
      sort: "explode",
      year: "1800",
      q: "x".repeat(5000),
    });

    expect(parsed.page).toBe(1);
    expect(parsed.sort).toBe("newest");
    expect(parsed.year).toBeUndefined();
    expect(parsed.q).toBeUndefined();
  });

  it("clamps an absurd page number instead of trusting it", () => {
    expect(catalogueQuerySchema.parse({ page: "999999" }).page).toBe(1);
    expect(catalogueQuerySchema.parse({ page: "12" }).page).toBe(12);
  });

  it("coerces a valid year from the query string", () => {
    expect(catalogueQuerySchema.parse({ year: "1994" }).year).toBe(1994);
  });
});

describe("canonicalCatalogueQuery", () => {
  it("produces nothing for the default view, so the canonical URL is the bare path", () => {
    expect(canonicalCatalogueQuery(catalogueQuerySchema.parse({}))).toBe("");
  });

  it("omits page 1 and the default sort", () => {
    const query = catalogueQuerySchema.parse({ page: "1", sort: "newest" });
    expect(canonicalCatalogueQuery(query)).toBe("");
  });

  it("preserves real filters and the page number", () => {
    const query = catalogueQuerySchema.parse({ q: "dune", page: "2", sort: "title" });
    const canonical = canonicalCatalogueQuery(query);

    expect(canonical).toContain("q=dune");
    expect(canonical).toContain("page=2");
    expect(canonical).toContain("sort=title");
  });
});

describe("loginSchema", () => {
  it("requires both a valid email and a password", () => {
    expect(loginSchema.safeParse({ email: "editor@example.com", password: "" }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ email: "nope", password: "secret" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "editor@example.com", password: "secret" }).success).toBe(
      true,
    );
  });
});

describe("adminUserCreateSchema", () => {
  const valid = {
    email: "new@example.com",
    displayName: "New Editor",
    password: "CorrectHorse1",
    role: "editor",
  };

  it("accepts a compliant account", () => {
    expect(adminUserCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces a minimum password length", () => {
    expect(adminUserCreateSchema.safeParse({ ...valid, password: "Short1" }).success).toBe(false);
  });

  it("requires mixed character classes", () => {
    expect(adminUserCreateSchema.safeParse({ ...valid, password: "alllowercase1" }).success).toBe(
      false,
    );
    expect(adminUserCreateSchema.safeParse({ ...valid, password: "ALLUPPERCASE1" }).success).toBe(
      false,
    );
    expect(adminUserCreateSchema.safeParse({ ...valid, password: "NoNumbersHere" }).success).toBe(
      false,
    );
  });

  it("only accepts the three real roles", () => {
    expect(adminUserCreateSchema.safeParse({ ...valid, role: "superuser" }).success).toBe(false);
  });
});

describe("PAGE_SIZE", () => {
  it("is a fixed, documented page size so pagination is cacheable", () => {
    expect(PAGE_SIZE).toBe(12);
  });
});
