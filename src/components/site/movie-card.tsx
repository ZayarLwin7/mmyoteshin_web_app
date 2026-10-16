import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatRating, formatRuntime, formatSeriesLength } from "@/lib/utils";
import type { MovieCard as MovieCardData } from "@/db/queries/public";

import { MetaRow } from "./meta-row";
import { Poster } from "./poster";

/**
 * Catalogue card.
 *
 * The whole card is one link target, so there is a single tab stop and no
 * nested interactive elements. The rating is only shown when a published
 * editorial review exists, and it always carries its scale.
 */
export function MovieCard({
  movie,
  priority = false,
  sizes = "(min-width: 1280px) 220px, (min-width: 768px) 25vw, 45vw",
}: {
  movie: MovieCardData;
  priority?: boolean;
  sizes?: string;
}) {
  const rating = formatRating(movie.rating, movie.ratingScale);
  const runtime = formatRuntime(movie.runtimeMinutes);
  const length = formatSeriesLength(movie.seasonCount, movie.episodeCount);

  return (
    <article className="group relative">
      <Link
        // Films and series are separate sections with separate detail routes,
        // so the card has to follow the record's own kind rather than assume
        // `/movies/`.
        href={movie.contentKind === "series" ? `/series/${movie.slug}` : `/movies/${movie.slug}`}
        className="rounded-card focus-visible:outline-accent block transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 active:scale-[0.98]"
      >
        <Poster
          src={movie.posterUrl}
          alt=""
          sizes={sizes}
          priority={priority}
          fallbackLabel={movie.title}
          className="transition-transform duration-300 ease-out group-hover:-translate-y-1"
        />

        <div className="mt-3 space-y-1.5">
          <h3 className="text-ink group-hover:text-accent group-active:text-accent text-sm leading-snug font-semibold transition-colors">
            {movie.title}
          </h3>

          <MetaRow
            className="gap-y-1 text-xs [--meta-gap:0.5rem]"
            items={[
              { key: "year", content: movie.releaseYear },
              { key: "length", content: runtime ?? length },
              {
                key: "rating",
                content: rating,
                valueClassName: "text-accent font-medium",
              },
            ]}
          />

          {movie.genres.length > 0 ? (
            <p className="text-ink-subtle truncate text-xs">
              {movie.genres.map((genre) => genre.name).join(" · ")}
            </p>
          ) : null}
        </div>
      </Link>

      {movie.contentRating ? (
        <Badge className="absolute top-2 left-2 border-black/40 bg-black/70 text-white backdrop-blur-sm">
          {movie.contentRating}
        </Badge>
      ) : null}
    </article>
  );
}

/** Loading placeholder that matches the card's real geometry to avoid layout shift. */
export function MovieCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="skeleton aspect-[2/3] w-full" />
      <div className="skeleton h-4 w-4/5 rounded" />
      <div className="skeleton h-3 w-2/5 rounded" />
    </div>
  );
}

/** Grid of skeletons used by `loading.tsx` files. */
export function MovieGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <MovieCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Full catalogue loading state — header block plus the grid.
 *
 * Used as the `<Suspense>` fallback on the catalogue routes rather than as a
 * `loading.tsx` file, and the reason is a 404.
 *
 * A `loading.tsx` at `src/app/` (or at `src/app/movies/`, `src/app/genres/`,
 * `src/app/years/`) is an **ancestor** of the detail routes, and Next streams
 * the ancestor's shell before the leaf route has run. That commits HTTP 200 to
 * the response, so a `notFound()` in the leaf route can no longer change the
 * status — every unknown or draft film slug answered 200 with the not-found
 * body. That is a soft 404, which search engines treat as a crawling and
 * indexing defect, and five end-to-end tests correctly expect a real 404.
 *
 * A `<Suspense>` boundary placed *inside* a route's own render is not an
 * ancestor of anything: the shell and skeleton still stream, and `notFound()`
 * in a sibling route still sets 404.
 */
export function CatalogueSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="container-page py-10">
      <div className="mb-8 space-y-3">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-4 w-96 max-w-full rounded" />
      </div>
      <MovieGridSkeleton count={count} />
    </div>
  );
}
