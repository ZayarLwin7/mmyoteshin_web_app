import { z } from "zod";

import { externalUrlSchema, imageSourceSchema } from "@/lib/security/url";

/**
 * Every value that crosses a trust boundary is parsed here before it reaches
 * the service layer. Server actions and route handlers must call these — the
 * browser-side validation is a convenience, never the control.
 */

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The `.default(...)` calls below are load-bearing, not decoration.
 *
 * In Zod 4 a union that merely *contains* `z.undefined()` still leaves the key
 * **required**: a plain object that omits the field is rejected with
 * "expected nonoptional". `.default()` is what marks the key optional. Both
 * call shapes have to work — a form post always sends every key (as `""`), but
 * a caller building an object programmatically will usually omit the ones it
 * has nothing to say about.
 */

/** Optional text: empty string, null and undefined all normalise to `null`. */
const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value === undefined || value === null || value === "" ? null : value))
    .default(null);

/** Optional integer coming from a form field (always a string). */
const optionalInt = (min: number, max: number) =>
  z
    .union([z.string().trim(), z.number(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine(
      (value) => value === null || (Number.isInteger(value) && value >= min && value <= max),
      {
        message: `Must be a whole number between ${min} and ${max}.`,
      },
    )
    .default(null);

/** Checkbox: an unchecked box is not submitted at all, so absent means false. */
const checkboxBoolean = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((value) => value === true || value === "true" || value === "on" || value === "1")
  .default(false);

const isoDate = z
  .union([z.string().trim(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value === undefined || value === null || value === "" ? null : value))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use the YYYY-MM-DD format.",
  })
  .default(null);

/**
 * Where a poster or backdrop may be loaded from: a public `https://` URL, or a
 * site-relative path such as `/posters/charade.jpg`. See `imageSourceSchema`
 * for why the local form is allowed.
 */
const optionalImageSource = z
  .union([z.string().trim(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value === undefined || value === null || value === "" ? null : value))
  .refine(
    (value) => value === null || imageSourceSchema.safeParse(value).success,
    "Use a public https:// URL or a site-relative path such as /posters/example.jpg.",
  )
  .default(null);

/**
 * Slug: Unicode letters, digits, marks and single hyphens.
 *
 * `\p{M}` (combining marks) is included because scripts such as Burmese, Thai
 * and Devanagari build syllables from base letters plus marks. Without it,
 * "မိုးရွာသောနေ့" is rejected outright and a Myanmar-language catalogue cannot
 * name its own films.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120, "Slug is too long.")
  .regex(
    /^[\p{L}\p{N}\p{M}]+(?:-[\p{L}\p{N}\p{M}]+)*$/u,
    "Use letters, numbers and single hyphens only.",
  );

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/** Written as a regex rather than `z.uuid()` so it behaves identically across Zod majors. */
export const uuidSchema = z.string().trim().regex(UUID_PATTERN, "Expected a UUID.");

/**
 * Exported because it is a shared trust-boundary primitive: it normalises case,
 * which every caller depends on for case-insensitive account lookup, so its
 * behaviour is worth testing directly rather than only through `loginSchema`.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .regex(EMAIL_PATTERN, "Enter a valid email address.")
  .transform((value) => value.toLowerCase());

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(200),
  redirectTo: z.string().optional(),
});

export const adminUserCreateSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(2, "Name is required.").max(120),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(200, "Password is too long.")
    .refine((value) => /[a-z]/.test(value), "Include a lowercase letter.")
    .refine((value) => /[A-Z]/.test(value), "Include an uppercase letter.")
    .refine((value) => /[0-9]/.test(value), "Include a number."),
  role: z.enum(["owner", "admin", "editor"]),
});

/* -------------------------------------------------------------------------- */
/* Movies                                                                     */
/* -------------------------------------------------------------------------- */

export const movieStatusSchema = z.enum(["draft", "published", "archived"]);

export const movieInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(300),
  /**
   * Blank or absent both mean "derive the slug from the name", and both
   * normalise to `null` so the value is never a bare `undefined`. That matters
   * downstream: Drizzle treats `undefined` in `.values()` as "column not
   * supplied" but writes an explicit NULL for `null`, and the two diverge on
   * update.
   */
  slug: z
    .union([slugSchema, z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value === undefined || value === null || value === "" ? null : value))
    .default(null),
  originalTitle: optionalText(300),
  releaseYear: optionalInt(1888, 2200),
  releaseDate: isoDate,
  runtimeMinutes: optionalInt(1, 1440),
  synopsis: optionalText(8000),
  editorialNote: optionalText(8000),
  posterUrl: optionalImageSource,
  backdropUrl: optionalImageSource,
  imageCredit: optionalText(300),
  languageCode: optionalText(12),
  country: optionalText(80),
  contentRating: optionalText(24),
  metaTitle: optionalText(200),
  metaDescription: optionalText(320),
  featured: checkboxBoolean,
  curationWeight: optionalInt(-1000, 1000),
  status: movieStatusSchema.default("draft"),
  genreIds: z.array(uuidSchema).max(20).default([]),
});

export type MovieInput = z.infer<typeof movieInputSchema>;

/* -------------------------------------------------------------------------- */
/* Genres                                                                     */
/* -------------------------------------------------------------------------- */

export const genreInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  /**
   * Blank or absent both mean "derive the slug from the name", and both
   * normalise to `null` so the value is never a bare `undefined`. That matters
   * downstream: Drizzle treats `undefined` in `.values()` as "column not
   * supplied" but writes an explicit NULL for `null`, and the two diverge on
   * update.
   */
  slug: z
    .union([slugSchema, z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value === undefined || value === null || value === "" ? null : value))
    .default(null),
  description: optionalText(2000),
  displayOrder: optionalInt(-1000, 1000),
});

export type GenreInput = z.infer<typeof genreInputSchema>;

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

export const reviewStatusSchema = z.enum(["draft", "published", "archived"]);

export const reviewInputSchema = z.object({
  movieId: uuidSchema,
  reviewTitle: optionalText(240),
  body: z.string().trim().min(50, "An editorial review needs at least 50 characters.").max(20_000),
  rating: z
    .union([z.string().trim(), z.number(), z.literal(""), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = typeof value === "number" ? value : Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => value === null || (value >= 0 && value <= 10), {
      message: "Rating must be between 0 and 10.",
    })
    .default(null),
  ratingSource: z.enum(["editorial", "community", "external_aggregate"]).default("editorial"),
  reviewerName: z.string().trim().min(2, "Reviewer name is required.").max(120),
  status: reviewStatusSchema.default("draft"),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

/* -------------------------------------------------------------------------- */
/* Download links                                                             */
/* -------------------------------------------------------------------------- */

export const linkStatusSchema = z.enum(["pending_review", "active", "disabled", "reported"]);

export const authorizationBasisSchema = z.enum([
  "public_domain",
  "open_license",
  "distribution_agreement",
  "written_permission",
  "publisher_authorized_page",
  "other_documented",
]);

export const downloadLinkInputSchema = z.object({
  movieId: uuidSchema,
  providerName: z.string().trim().min(2, "Provider name is required.").max(160),
  destinationUrl: externalUrlSchema,
  label: z.string().trim().min(2, "Label is required.").max(200),
  quality: optionalText(40),
  fileSizeBytes: optionalInt(0, Number.MAX_SAFE_INTEGER),
  language: optionalText(60),
  authorizationBasis: authorizationBasisSchema,
  authorizationReference: optionalText(1000),
  authorizationNotes: optionalText(2000),
  status: linkStatusSchema.default("pending_review"),
});

export type DownloadLinkInput = z.infer<typeof downloadLinkInputSchema>;

/* -------------------------------------------------------------------------- */
/* Public report submission                                                   */
/* -------------------------------------------------------------------------- */

export const reportReasonSchema = z.enum([
  "broken_link",
  "copyright",
  "unauthorized_distribution",
  "malware_or_unsafe",
  "misleading_listing",
  "metadata_error",
  "other",
]);

export const reportSubmissionSchema = z.object({
  movieId: uuidSchema.nullable().optional(),
  downloadLinkId: uuidSchema.nullable().optional(),
  reason: reportReasonSchema,
  details: z
    .string()
    .trim()
    .min(20, "Please describe the problem in at least 20 characters.")
    .max(4000, "Please keep the description under 4000 characters."),
  reporterContact: optionalText(320),
  /** Hidden honeypot — bots fill it, humans never see it. */
  website: z.string().max(0, "Unexpected value.").optional().default(""),
});

export type ReportSubmission = z.infer<typeof reportSubmissionSchema>;

export const reportResolutionSchema = z.object({
  reportId: uuidSchema,
  status: z.enum(["new", "under_review", "resolved", "rejected"]),
  resolutionNotes: z.string().trim().max(4000).optional(),
  /** When true, every active link for the reported movie is disabled. */
  disableReportedLink: checkboxBoolean,
});

/* -------------------------------------------------------------------------- */
/* Catalogue query parameters                                                 */
/* -------------------------------------------------------------------------- */

export const catalogueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).catch(1),
  q: z.string().trim().max(120).optional().catch(undefined),
  genre: z.string().trim().max(96).optional().catch(undefined),
  year: z.coerce.number().int().min(1888).max(2200).optional().catch(undefined),
  language: z.string().trim().max(12).optional().catch(undefined),
  rating: z.string().trim().max(24).optional().catch(undefined),
  sort: z.enum(["newest", "title", "year"]).catch("newest"),
});

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

/**
 * Films shown per catalogue page.
 *
 * Twelve is two full rows of the widest grid (`xl:grid-cols-6`), which keeps a
 * page scannable and makes the pager appear on smaller catalogues. It is a
 * fixed constant rather than a query parameter so that every filtered view has
 * exactly one canonical URL, which is what makes these routes cacheable.
 */
export const PAGE_SIZE = 12;

/** Turn a validated catalogue query into a canonical, shareable URL. */
export function canonicalCatalogueQuery(query: CatalogueQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.genre) params.set("genre", query.genre);
  if (query.year) params.set("year", String(query.year));
  if (query.language) params.set("language", query.language);
  if (query.rating) params.set("rating", query.rating);
  if (query.sort && query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}
