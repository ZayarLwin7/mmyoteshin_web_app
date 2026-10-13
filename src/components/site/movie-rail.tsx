import { LinkButton } from "@/components/ui/button";

import type { MovieCard as MovieCardData } from "@/db/queries/public";

import { MovieCard } from "./movie-card";

/**
 * Horizontal collection rail.
 *
 * Implemented as a native scroll container, so it works with touch gestures,
 * trackpads, keyboard arrows and screen readers without any JavaScript. The
 * container is focusable and labelled so keyboard users can scroll it.
 */
export function MovieRail({
  id,
  title,
  eyebrow,
  description,
  movies,
  viewAllHref,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  movies: MovieCardData[];
  viewAllHref?: string;
}) {
  if (movies.length === 0) return null;

  return (
    <section aria-labelledby={id} className="py-8">
      <div className="container-page">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow ? <p className="text-eyebrow mb-1.5">{eyebrow}</p> : null}
            <h2 id={id} className="text-heading text-ink font-semibold">
              {title}
            </h2>
            {description ? <p className="text-ink-muted mt-1.5 text-sm">{description}</p> : null}
          </div>

          {viewAllHref ? (
            <LinkButton href={viewAllHref} variant="secondary" size="sm" className="shrink-0">
              View all
            </LinkButton>
          ) : null}
        </div>
      </div>

      {/* Full-bleed scroller so cards can run to the viewport edge on mobile. */}
      <div
        className="rail container-page"
        tabIndex={0}
        role="group"
        aria-label={`${title} — scrollable list`}
      >
        {movies.map((movie) => (
          <div key={movie.id} className="w-[150px] sm:w-[180px] lg:w-[200px]">
            {/*
              No `priority` on rail posters. Every rail sits below the hero, so
              none of them is the LCP candidate — but `priority` emits a
              preload link, and on this page three Rails at three each meant ten
              preloaded posters competing with the one above the fold for
              bandwidth. `next/image` lazy-loads by default, which is correct
              here: the request only starts as the rail is scrolled toward.
            */}
            <MovieCard
              movie={movie}
              sizes="(min-width: 1024px) 200px, (min-width: 640px) 180px, 150px"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
