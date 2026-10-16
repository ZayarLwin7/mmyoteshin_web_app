import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { publicEnv } from "./env";

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Slugs                                                                      */
/* -------------------------------------------------------------------------- */

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Build a URL-safe slug.
 *
 * Unicode letters and digits are preserved rather than stripped, because the
 * catalogue carries non-Latin titles (Burmese, Thai, Chinese, …) and a slug of
 * "film-3f9a2c" would be both unreadable and bad for search. Percent-encoded
 * UTF-8 paths are valid and indexable.
 *
 * Combining marks (`\p{M}`) are kept as well. Burmese and Thai write syllables
 * as a base letter plus marks, so treating a mark as a separator would turn
 * "ရုပ်ရှင်" into "ရ-ပ-ရ-င" and lose the vowels and tones that make the word
 * readable. Latin diacritics are still folded away above, because NFKD splits
 * them into the U+0300–U+036F range that `COMBINING_MARKS` removes.
 */
export function slugify(input: string, maxLength = 96): string {
  const base = input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return base;
}

/**
 * Slug with a short deterministic suffix, used when a slug is empty (e.g. the
 * title was only punctuation) or when a collision must be resolved.
 */
export function slugifyWithSuffix(input: string, suffix: string, maxLength = 96): string {
  const base = slugify(input, maxLength - suffix.length - 1);
  return base ? `${base}-${suffix}` : suffix;
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

/**
 * One line describing how long a series is, e.g. `3 seasons · 24 episodes`.
 *
 * Whichever count is present is shown on its own — a series is publishable
 * with an episode count still to be confirmed (it is a warning, not a
 * blocker), so this must not silently return `null` for "has seasons, no
 * episode total".
 */
export function formatSeriesLength(
  seasonCount: number | null | undefined,
  episodeCount: number | null | undefined,
): string | null {
  const seasons =
    seasonCount && seasonCount > 0 ? `${seasonCount} season${seasonCount === 1 ? "" : "s"}` : null;
  const episodes =
    episodeCount && episodeCount > 0
      ? `${episodeCount} episode${episodeCount === 1 ? "" : "s"}`
      : null;
  if (seasons && episodes) return `${seasons} · ${episodes}`;
  return seasons ?? episodes ?? null;
}

export function formatFileSize(bytes: string | number | null | undefined): string | null {
  if (bytes === null || bytes === undefined || bytes === "") return null;
  const value = typeof bytes === "string" ? Number.parseInt(bytes, 10) : bytes;
  if (!Number.isFinite(value) || value <= 0) return null;

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = size >= 10 || unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_FORMATTER.format(date);
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDateTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${DATE_TIME_FORMATTER.format(date)} UTC`;
}

/**
 * Render a rating with its scale so a score is never shown without context.
 * e.g. `8.5 / 10`.
 */
export function formatRating(
  rating: string | number | null | undefined,
  scale: string | number | null | undefined = 10,
): string | null {
  if (rating === null || rating === undefined || rating === "") return null;
  const value = typeof rating === "string" ? Number.parseFloat(rating) : rating;
  const max = typeof scale === "string" ? Number.parseFloat(scale) : (scale ?? 10);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
  const trimmed = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${trimmed} / ${Number.isInteger(max) ? max.toFixed(0) : max}`;
}

/**
 * Render just the top of a rating scale for display.
 *
 * `rating_scale` is a `numeric(4,1)`, so the driver hands back `"10.0"` for the
 * default ten-point scale — and `/10.0` reads like a decimal score rather than
 * a maximum. A whole number loses its trailing zero; a genuinely fractional
 * scale (a five-point scale stored as `5.0` is the same case; only something
 * like `7.5` keeps its fraction) is left alone.
 */
export function formatRatingScale(scale: string | number | null | undefined): string {
  if (scale === null || scale === undefined || scale === "") return "10";
  const value = typeof scale === "string" ? Number.parseFloat(scale) : scale;
  if (!Number.isFinite(value) || value <= 0) return "10";
  return Number.isInteger(value) ? value.toFixed(0) : String(value);
}

/** Sentence-case a database enum value for display: `pending_review` → `Pending review`. */
export function humaniseEnum(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function truncate(text: string, maxLength: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

/* -------------------------------------------------------------------------- */
/* URLs                                                                       */
/* -------------------------------------------------------------------------- */

/** Build an absolute URL against the configured canonical site origin. */
export function absoluteUrl(path = "/"): string {
  const base = publicEnv.siteUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Initials for an avatar-style fallback, e.g. "Blade Runner" → "BR". */
export function initials(value: string, max = 2): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Stable, non-cryptographic key for React lists built from strings. */
export function keyFrom(...parts: Array<string | number | null | undefined>): string {
  return parts.filter((part) => part !== null && part !== undefined).join(":");
}
