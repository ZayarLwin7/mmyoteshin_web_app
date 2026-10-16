import { cn, formatRatingScale } from "@/lib/utils";

/**
 * The editorial score, as a star in the corner of a poster.
 *
 * It sits in the **top-right** corner, which is where a reader's eye lands after
 * the artwork and where it cannot collide with the certification badge in the
 * bottom-left. The two are different facts — "what it is rated" and "what we
 * scored it" — and putting them in opposite corners keeps them legible on a
 * three-column phone grid, where the card is barely 100px wide.
 *
 * The scale is stated on the badge itself, as `/10`, rather than only in prose
 * elsewhere on the page. A bare number next to a star is ambiguous: readers
 * reasonably assume 5, or 100, and neither is true here.
 *
 * The backdrop is a dark scrim rather than a palette colour so the score stays
 * legible over any artwork, including a pale poster where an amber fill would
 * disappear.
 */
export function RatingBadge({
  rating,
  scale,
  className,
  size = "md",
}: {
  /** The score as stored, e.g. `"8.5"`. Null means there is no published review. */
  rating: string | null;
  /** The top of the scale the score is measured against, e.g. `"10"`. */
  scale?: string;
  className?: string;
  /** `sm` for the narrowest cards, `md` everywhere else. */
  size?: "sm" | "md";
}) {
  if (!rating) return null;

  // `scale` arrives straight from a `numeric(4,1)` column, i.e. `"10.0"`.
  const max = formatRatingScale(scale);

  const star = size === "sm" ? "size-3" : "size-3.5";

  return (
    <span
      className={cn(
        "border-accent/40 text-accent inline-flex items-center gap-1 rounded-full border bg-black/75 font-semibold tabular-nums backdrop-blur-sm",
        size === "sm" ? "text-2xs px-1.5 py-0.5" : "px-2 py-1 text-xs",
        className,
      )}
    >
      {/*
        The star is drawn as a path rather than a glyph so it renders identically
        on every platform — a Unicode ★ is missing from several of the fonts that
        ship with the self-hosted type stack, and falls back to a tofu box.
      */}
      <svg viewBox="0 0 24 24" className={star} fill="currentColor" aria-hidden="true">
        <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
      </svg>
      <span>{rating}</span>
      {/*
        Announced as part of the score rather than rendered as visible text: on a
        three-column card there is no room for "out of 10" at a readable size,
        and the visible "/10" plus this accessible string covers both the sighted
        and the screen-reader case.
      */}
      <span className="sr-only">out of {max}</span>
      <span aria-hidden="true" className="text-accent/70">
        /{max}
      </span>
    </span>
  );
}

/**
 * The score as it appears in a page's masthead — larger, and with the scale
 * spelled out in full because there is room for it.
 */
export function RatingSummary({
  rating,
  scale,
  source,
}: {
  rating: string | null;
  /** The raw `numeric(4,1)` value, e.g. `"10.0"`. Normalised for display here. */
  scale?: string | null;
  source?: string;
}) {
  if (!rating) return null;

  const max = formatRatingScale(scale);

  return (
    <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-accent inline-flex items-center gap-2 text-3xl leading-none font-semibold">
        <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
          <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
        </svg>
        {rating}
        <span className="text-ink-subtle text-base font-normal">/ {max}</span>
      </span>
      <span className="text-ink-subtle text-xs">
        Editorial score
        {source && source !== "editorial" ? ` (${source})` : ""}
      </span>
    </p>
  );
}
