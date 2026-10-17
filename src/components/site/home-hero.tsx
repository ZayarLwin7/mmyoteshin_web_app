import { LinkButton } from "@/components/ui/button";
import { formatRuntime, formatSeriesLength } from "@/lib/utils";
import type { MovieCard as MovieCardData } from "@/db/queries/public";

import { MetaRow } from "./meta-row";
import { Poster } from "./poster";
import { RatingBadge, RatingSummary } from "./rating-badge";

/**
 * Home hero — the featured record, as an editorial spotlight.
 *
 * ---------------------------------------------------------------------------
 * Why it is composed this way
 * ---------------------------------------------------------------------------
 * The previous version was a poster pinned beside a column of text, centred in
 * a full-width band. Everything was one size, one weight and one alignment, so
 * the eye had nowhere to land: it read as a catalogue row that happened to be
 * at the top of the page rather than as the thing the page is recommending.
 *
 * This version builds a deliberate hierarchy instead:
 *
 *   1. **A label, not a label-shaped paragraph.** "Featured film" is a pill with
 *      an accent dot, so it is unmistakably a status marker rather than a
 *      heading that lost its styling.
 *   2. **One very large thing.** The title is the only element at display size,
 *      with tight leading and negative tracking. On a wide viewport the poster
 *      moves to the right and grows, so the two halves of the composition are
 *      asymmetric — which is what makes it read as designed rather than filled.
 *   3. **Quiet metadata.** Year, length and genres sit in micro-caps at low
 *      contrast. They are reference data; they should be findable, not loud.
 *   4. **The score, once.** The star sits in the poster's corner and the score
 *      with its scale sits under the metadata. Repeating it a third time in the
 *      button row would be noise.
 *
 * The poster keeps a hairline accent mount offset behind it — the same trick a
 * framed print uses — which separates it from the backdrop without a heavy
 * border. The mount is decorative and `aria-hidden`.
 *
 * Behind everything, the artwork is blown up, blurred and desaturated into a
 * wash, with a warm radial glow in the corner the poster sits in. It is the
 * same image, so it costs no extra request, and it is requested at a
 * deliberately small `sizes` because at this blur and opacity the browser would
 * otherwise be downloading detail nobody can see.
 *
 * The section has no `min-height`: the content sets the height, so there is no
 * empty band between the header and the title, and the layout cannot break on
 * artwork of any aspect ratio.
 */
export function HomeHero({ movie }: { movie: MovieCardData }) {
  const runtime = formatRuntime(movie.runtimeMinutes);
  const length = formatSeriesLength(movie.seasonCount, movie.episodeCount);
  // A series can be the featured entry when no film is, so the hero follows
  // the record's own kind rather than assuming a film.
  const isSeries = movie.contentKind === "series";
  const detailHref = isSeries ? `/series/${movie.slug}` : `/movies/${movie.slug}`;

  return (
    <section
      aria-labelledby="hero-title"
      className="border-line bg-canvas relative isolate overflow-hidden border-b"
    >
      {/* Decorative wash and glow — hidden from assistive technology. */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <Poster
          src={movie.posterUrl}
          alt=""
          aspect="aspect-auto h-full w-full"
          sizes="320px"
          className="h-full w-full scale-110 rounded-none opacity-30 blur-[72px] saturate-125"
        />
        {/* A warm bloom behind the poster corner. It is what stops the wash
            reading as a flat grey smudge on artwork with a dark palette. */}
        <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_82%_16%,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent_62%)]" />
        {/* Fade the wash into the canvas so the section has no visible edge. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-canvas)_6%,color-mix(in_oklab,var(--color-canvas)_70%,transparent)_55%,transparent_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-canvas)_0%,color-mix(in_oklab,var(--color-canvas)_55%,transparent)_50%,transparent_80%)]" />
      </div>

      {/*
        The outer `container-page` keeps the section's left edge on the same
        vertical line as the rails below it; the *inner* track is the part that
        is capped at `max-w-6xl`. Capping the outer element instead would let
        `container-page`'s `margin-inline: auto` centre the hero, and the title
        would start ~190px to the right of every heading on the page.
      */}
      <div className="container-page py-12 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 gap-7 md:grid-cols-[176px_minmax(0,1fr)] md:items-center md:gap-9 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-14">
          {/* ---- Poster ---------------------------------------------------- */}
          <div className="lg:order-2">
            <div className="relative mx-auto w-[150px] md:mx-0 md:w-[176px] lg:w-[288px]">
              {/*
              The mount: a hairline outline offset behind the artwork. Purely
              decorative, so it is hidden from assistive technology.
            */}
              <div
                aria-hidden="true"
                className="border-accent/35 absolute -inset-2.5 rounded-[1.1rem] border md:-inset-3 lg:-inset-4 lg:rounded-[1.4rem]"
              />
              <div className="rounded-card ring-line-strong/60 shadow-surface-raised/40 relative overflow-hidden shadow-2xl ring-1">
                <Poster
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  sizes="(min-width: 1024px) 288px, (min-width: 768px) 176px, 150px"
                  priority
                />
                {movie.contentRating ? (
                  <span className="border-accent/30 text-ink text-2xs absolute top-2 left-2 inline-flex items-center rounded-full border bg-black/75 px-2 py-0.5 font-semibold tracking-wide backdrop-blur-sm">
                    {movie.contentRating}
                  </span>
                ) : null}
                <RatingBadge
                  rating={movie.rating}
                  scale={movie.ratingScale}
                  className="absolute top-2 right-2"
                />
              </div>
            </div>
          </div>

          {/* ---- Title block ------------------------------------------------ */}
          <div className="min-w-0 lg:order-1">
            <span className="border-accent/30 bg-accent/10 text-accent inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
              <span aria-hidden="true" className="bg-accent size-1.5 rounded-full" />
              {isSeries ? "Featured series" : "Featured film"}
            </span>

            <h1
              id="hero-title"
              className="text-ink mt-4 text-[2.125rem] leading-[1.02] font-semibold tracking-[-0.025em] md:text-[2.5rem] lg:mt-5 lg:text-[3.75rem]"
            >
              {movie.title}
            </h1>

            {/*
            Year, length and genres as micro-caps. They are reference data, so
            they are tracked out and held at low contrast — present, legible,
            and out of the way of the title.
          */}
            <MetaRow
              className="text-ink-subtle mt-4 text-[0.625rem] font-medium tracking-[0.12em] uppercase [--meta-gap:0.55rem] md:text-[0.6875rem]"
              items={[
                { key: "year", content: movie.releaseYear },
                { key: "length", content: runtime ?? length },
                {
                  key: "genres",
                  content:
                    movie.genres.length > 0 ? movie.genres.map((g) => g.name).join(" · ") : null,
                },
              ]}
            />

            <RatingSummary rating={movie.rating} scale={movie.ratingScale} />

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 lg:mt-8">
              <LinkButton href={detailHref} size="lg" className="w-full sm:w-auto">
                Read the review
              </LinkButton>
              {/*
              A quiet link rather than a second filled button: two competing
              buttons at the same weight made the primary action ambiguous.
            */}
              <LinkButton
                href={isSeries ? "/series" : "/movies"}
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto"
              >
                Browse the catalogue
              </LinkButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
