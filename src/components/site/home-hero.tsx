import { LinkButton } from "@/components/ui/button";
import { formatRuntime, formatSeriesLength } from "@/lib/utils";
import type { MovieCard as MovieCardData } from "@/db/queries/public";

import { MetaRow } from "./meta-row";
import { Poster } from "./poster";
import { RatingBadge, RatingSummary } from "./rating-badge";

/**
 * Home hero — the featured record, staged.
 *
 * The poster sits in its **own frame** at a size that reads as the subject of
 * the section (128px on a phone, up to 240px on a desktop) rather than as a
 * catalogue thumbnail pinned beside a title. It carries the same corner badges
 * as every card — certification top-left, editorial star top-right — so the
 * hero and the grid speak the same visual language.
 *
 * Behind it, the artwork is blown up and blurred into a wash that fades into
 * the canvas, and a vignette darkens the left edge so the title stays legible
 * whatever the artwork's brightness. It is the same image, so it costs no extra
 * request, and it is requested at a deliberately small `sizes` because at this
 * blur and opacity the browser would be downloading detail nobody can see.
 *
 * The section has no `min-height`: the poster sets the height, so there is no
 * empty band between the header and the title, and the layout cannot break on
 * artwork of any aspect ratio.
 */
export function HomeHero({ movie }: { movie: MovieCardData }) {
  const runtime = formatRuntime(movie.runtimeMinutes);
  const length = formatSeriesLength(movie.seasonCount, movie.episodeCount);
  // A series can be the featured entry when no film is, so the hero follows
  // the record's own kind rather than assuming a film.
  const detailHref =
    movie.contentKind === "series" ? `/series/${movie.slug}` : `/movies/${movie.slug}`;

  return (
    <section
      aria-labelledby="hero-title"
      className="border-line bg-surface relative isolate overflow-hidden border-b"
    >
      {/* Decorative wash and vignette — hidden from assistive technology. */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <Poster
          src={movie.posterUrl}
          alt=""
          aspect="aspect-auto h-full w-full"
          sizes="320px"
          className="h-full w-full scale-125 rounded-none opacity-40 blur-3xl saturate-150"
        />
        {/* Fade the wash into the canvas at the bottom, and darken the left
            half so the title is readable over bright artwork. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-canvas)_8%,color-mix(in_oklab,var(--color-canvas)_80%,transparent)_60%,transparent_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-canvas)_0%,color-mix(in_oklab,var(--color-canvas)_60%,transparent)_45%,transparent_75%)]" />
      </div>

      <div className="container-page grid grid-cols-[112px_minmax(0,1fr)] items-center gap-5 py-10 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-8 sm:py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14 lg:py-16">
        <div className="relative">
          {/*
            The ring and shadow lift the poster off the wash — a framed print
            on a wall rather than an image floating in a rectangle.
          */}
          <div className="rounded-card ring-accent/20 shadow-surface-raised/50 relative overflow-hidden shadow-2xl ring-1">
            <Poster
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              sizes="(min-width: 1024px) 240px, (min-width: 640px) 168px, 112px"
              priority
            />
            {movie.contentRating ? (
              <span className="border-accent/25 text-ink text-2xs absolute top-2 left-2 inline-flex items-center rounded-full border bg-black/75 px-2 py-0.5 font-semibold tracking-wide backdrop-blur-sm">
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

        <div className="min-w-0">
          <p className="text-eyebrow mb-3">
            {movie.contentKind === "series" ? "Featured series" : "Featured film"}
          </p>

          <h1
            id="hero-title"
            className="text-display text-ink text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl"
          >
            {movie.title}
          </h1>

          {/*
            Year, length and genres. The score is on the poster as a star in the
            corner, and the masthead's own rating line sits below the title —
            putting it here too would say it three times.
          */}
          <MetaRow
            className="mt-4 text-sm"
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

          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href={detailHref} size="lg">
              Read the review
            </LinkButton>
            <LinkButton href="/movies" variant="secondary" size="lg">
              Browse the catalogue
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
