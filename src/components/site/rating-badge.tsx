import { cn, formatRatingScale } from "@/lib/utils";

/**
 * The editorial score, as a star in the corner of a poster.
 *
 * It sits in the **top-right** corner, opposite the certification badge in the
 * **top-left**. The two are different facts — "what it is rated" and "what we
 * scored it" — and keeping them in opposite corners of the same edge keeps them
 * legible on a three-column phone grid, where the card is barely 100px wide.
 *
 * The number is shown on its own, without a `/10`. The scale is stated once, in
 * the methodology note on each detail page, rather than repeated on every card
 * — a bare star and number reads as a rating everywhere else on the web, and the
 * repetition added noise at card size.
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
  scale?: string | null;
  className?: string;
  /** `sm` for the narrowest cards, `md` everywhere else. */
  size?: "sm" | "md";
}) {
  if (!rating) return null;

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
        The scale is announced rather than rendered: screen-reader users get
        "7.8 out of 10", sighted users see the star and the number, and neither
        gets a `/10` repeated across every card on the page.
      */}
      <span className="sr-only">out of {formatRatingScale(scale)}</span>
    </span>
  );
}

/**
 * The score as it appears in a page's masthead — larger, and still carrying its
 * scale, because here there is room for it.
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
