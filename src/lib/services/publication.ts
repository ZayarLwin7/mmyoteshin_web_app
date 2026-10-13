import type { DownloadLink, Movie, Review } from "@/db/schema";

/**
 * Publication eligibility.
 *
 * The rule set is deliberately explicit and lives in one place so the admin UI,
 * the server actions and the tests all agree on what "ready to publish" means.
 * A blocker prevents publication; a warning is surfaced but does not.
 */

export type ReadinessIssue = {
  code: string;
  message: string;
};

export type PublicationReadiness = {
  ready: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
};

/** Minimum editorial review length, in characters, for a publishable film. */
export const MIN_REVIEW_LENGTH = 200;

/** How long a link may go unchecked before it is flagged for re-verification. */
export const LINK_RECHECK_DAYS = 180;

const MIN_SYNOPSIS_LENGTH = 80;

/**
 * The link fields the readiness rules read.
 *
 * `authorizationBasis` and `authorizedAt` are typed nullable even though the
 * `download_links.authorization_basis` column is currently `NOT NULL`. A
 * validator exists to *detect* a state, so its input type has to be able to
 * *represent* that state — a check that only accepts already-valid input
 * cannot check anything. The same reasoning is why `assertAuthorizationComplete`
 * in `links.ts` takes `string | null`.
 *
 * See `docs/implementation-plan.md` for the outstanding question of whether
 * the column should be nullable, since the
 * `download_links_active_requires_authorization` constraint, the RLS policy and
 * the `link_missing_authorization` blocker below are all written as if it were.
 */
export type ReadinessLink = {
  status: DownloadLink["status"];
  authorizationBasis: DownloadLink["authorizationBasis"] | null;
  authorizedAt: Date | null;
  lastCheckedAt: Date | null;
  destinationHost: string;
};

export type ReadinessInput = {
  movie: Pick<
    Movie,
    "title" | "slug" | "synopsis" | "releaseYear" | "posterUrl" | "metaTitle" | "metaDescription"
  >;
  genreIds: string[];
  reviews: Pick<Review, "status" | "body">[];
  links: ReadinessLink[];
  /** Injected so tests can pin "now". */
  now?: Date;
};

export function evaluatePublicationReadiness(input: ReadinessInput): PublicationReadiness {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];
  const now = input.now ?? new Date();

  const { movie } = input;

  /* ---- Required metadata ------------------------------------------------ */

  if (movie.title.trim().length === 0) {
    blockers.push({ code: "title_missing", message: "A title is required." });
  }

  if (movie.slug.trim().length === 0) {
    blockers.push({ code: "slug_missing", message: "A URL slug is required." });
  }

  if (!movie.releaseYear) {
    blockers.push({ code: "release_year_missing", message: "A release year is required." });
  }

  const synopsis = movie.synopsis?.trim() ?? "";
  if (synopsis.length < MIN_SYNOPSIS_LENGTH) {
    blockers.push({
      code: "synopsis_too_short",
      message: `Write at least ${MIN_SYNOPSIS_LENGTH} characters of original synopsis (currently ${synopsis.length}).`,
    });
  }

  if (input.genreIds.length === 0) {
    blockers.push({ code: "genres_missing", message: "Assign at least one genre." });
  }

  /* ---- Editorial content ------------------------------------------------ */

  const publishedReviews = input.reviews.filter((review) => review.status === "published");

  if (publishedReviews.length === 0) {
    blockers.push({
      code: "review_missing",
      message: "A published editorial review is required before this film can go live.",
    });
  } else if (publishedReviews.every((review) => review.body.trim().length < MIN_REVIEW_LENGTH)) {
    blockers.push({
      code: "review_too_short",
      message: `The published review must be at least ${MIN_REVIEW_LENGTH} characters of original writing.`,
    });
  }

  /* ---- Imagery ---------------------------------------------------------- */

  if (!movie.posterUrl) {
    warnings.push({
      code: "poster_missing",
      message: "No poster image. Cards will fall back to a placeholder.",
    });
  }

  if (!movie.metaDescription) {
    warnings.push({
      code: "meta_description_missing",
      message: "No meta description. Search engines will fall back to the synopsis.",
    });
  }

  /* ---- External distribution links -------------------------------------- */

  const activeLinks = input.links.filter((link) => link.status === "active");

  for (const link of activeLinks) {
    if (!link.authorizationBasis) {
      blockers.push({
        code: "link_missing_authorization",
        message: `The active link on ${link.destinationHost} has no recorded authorization basis.`,
      });
    }

    if (!link.authorizedAt) {
      blockers.push({
        code: "link_not_reviewed",
        message: `The active link on ${link.destinationHost} has never been reviewed and authorised.`,
      });
    }

    if (!link.lastCheckedAt) {
      warnings.push({
        code: "link_never_checked",
        message: `The link on ${link.destinationHost} has never been checked.`,
      });
    } else {
      const ageInDays = (now.getTime() - new Date(link.lastCheckedAt).getTime()) / 86_400_000;
      if (ageInDays > LINK_RECHECK_DAYS) {
        warnings.push({
          code: "link_check_stale",
          message: `The link on ${link.destinationHost} was last checked ${Math.floor(ageInDays)} days ago.`,
        });
      }
    }
  }

  const pendingLinks = input.links.filter((link) => link.status === "pending_review");
  if (pendingLinks.length > 0) {
    warnings.push({
      code: "links_pending_review",
      message: `${pendingLinks.length} link${pendingLinks.length === 1 ? "" : "s"} awaiting authorization review will not be shown publicly.`,
    });
  }

  return { ready: blockers.length === 0, blockers, warnings };
}

/**
 * Decide whether a link may be shown to the public.
 *
 * This mirrors the `download_links_active_requires_authorization` database
 * constraint, and is applied again in the query layer as defence in depth.
 *
 * The two nullable fields are deliberate, for the reason set out on
 * `ReadinessLink`: the whole job of this predicate is to reject an
 * unauthorised link, so its input type has to be able to describe one.
 */
export function isLinkPubliclyVisible(
  link: Pick<ReadinessLink, "status" | "authorizationBasis" | "authorizedAt">,
): boolean {
  return link.status === "active" && link.authorizationBasis !== null && link.authorizedAt !== null;
}

/**
 * Decide whether a movie record may be shown to the public.
 *
 * Only `published` is public. `draft`, `archived` and any future status are
 * excluded, and a published record must also carry a `publishedAt` stamp.
 */
export function isMoviePubliclyVisible(movie: Pick<Movie, "status" | "publishedAt">): boolean {
  return movie.status === "published" && movie.publishedAt !== null;
}

/** Short label for the admin readiness panel. */
export function readinessLabel(readiness: PublicationReadiness): string {
  if (readiness.ready && readiness.warnings.length === 0) return "Ready to publish";
  if (readiness.ready) return `Ready with ${readiness.warnings.length} warning(s)`;
  return `Blocked by ${readiness.blockers.length} issue(s)`;
}
