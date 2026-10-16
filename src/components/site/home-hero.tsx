import { LinkButton } from "@/components/ui/button";
import { formatRating, formatRuntime, formatSeriesLength } from "@/lib/utils";
import type { MovieCard as MovieCardData } from "@/db/queries/public";

import { MetaRow } from "./meta-row";
import { Poster } from "./poster";

/**
 * Home hero.
 *
 * The film's poster is shown in its **own frame**, next to the title, rather
 * than stretched across the whole section. The previous full-bleed treatment
 * used the artwork as a `cover` backdrop, which for a film whose only artwork
 * is a landscape still or a title card meant a small image blown up to the
 * viewport width and cropped — and the crop was the most noticeable thing about
 * it. A framed poster keeps the same 2:3 frame as the catalogue cards, so the
 * hero and the grid look uniform — the image fills the frame and landscape
 * artwork is cropped on its sides, exactly as on the cards.
 *
 * The blurred wash behind it keeps the section from being a flat rectangle. It
 * is the same artwork, so it costs no extra request, and it is requested at a
 * deliberately small `sizes` because at this blur and opacity the browser would
 * be downloading detail nobody can see.
 */
export function HomeHero({ movie }: { movie: MovieCardData }) {
  const rating = formatRating(movie.rating, movie.ratingScale);
  const runtime = formatRuntime(movie.runtimeMinutes);
  const length = formatSeriesLength(movie.seasonCount, movie.episodeCount);
  // A series can be the featured entry when no film is, so the hero follows
  // the record's own kind rather than assuming a film.
  const detailHref =
    movie.contentKind === "series" ? `/series/${movie.slug}` : `/movies/${movie.slug}`;

  return (
    <section
      aria-labelledby="hero-title"
      className="border-line relative isolate overflow-hidden border-b"
    >
      {/* Decorative wash — hidden from assistive technology. */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <Poster
          src={movie.posterUrl}
          alt=""
          aspect="aspect-auto h-full w-full"
          sizes="320px"
          className="h-full w-full scale-110 rounded-none opacity-30 blur-3xl"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-canvas)_10%,color-mix(in_oklab,var(--color-canvas)_75%,transparent)_55%,transparent_100%)]" />
      </div>

      {/*
       * No `min-height`. The section used to reserve up to 40rem and push the
       * content to the bottom of it, which left a large empty band between the
       * header and the title. The poster now sets the height, so the spacing
       * above the title is just the padding.
       *
       * The poster column is present at **every** width. An earlier revision
       * hid it below `sm`, which left phones with no artwork at all — the
       * full-bleed backdrop it replaced had been visible everywhere. It is
       * simply narrower on small screens rather than absent.
       */}
      <div className="container-page grid grid-cols-[104px_minmax(0,1fr)] items-start gap-5 py-8 sm:grid-cols-[136px_minmax(0,1fr)] sm:items-center sm:gap-8 sm:py-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 lg:py-12">
        <Poster
          src={movie.posterUrl}
          alt={`${movie.title} poster`}
          sizes="(min-width: 1024px) 200px, (min-width: 640px) 136px, 104px"
          priority
        />

        <div className="min-w-0">
          <p className="text-eyebrow mb-3">
            {movie.contentKind === "series" ? "Featured series" : "Featured film"}
          </p>

          <h1 id="hero-title" className="text-display text-ink font-semibold">
            {movie.title}
          </h1>

          <MetaRow
            className="mt-5 text-sm"
            items={[
              { key: "year", content: movie.releaseYear },
              { key: "length", content: runtime ?? length },
              {
                key: "rating",
                content: rating ? `Editorial score ${rating}` : null,
                valueClassName: "text-accent",
              },
              {
                key: "genres",
                content:
                  movie.genres.length > 0 ? movie.genres.map((g) => g.name).join(" · ") : null,
              },
            ]}
          />

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
