import { EmptyState } from "@/components/ui/feedback";
import { LinkButton } from "@/components/ui/button";
import type { CataloguePage, GenreWithCount } from "@/db/queries/public";
import type { CatalogueQuery } from "@/lib/validation/schemas";

import { MovieCard } from "./movie-card";
import { Pagination } from "./pagination";

/**
 * Shared catalogue view.
 *
 * Used by /movies, /genres/[slug], /years/[year] and /search so the grid,
 * filter bar, empty state and pagination behave identically everywhere.
 *
 * The filter bar is a plain GET form: it works with JavaScript disabled, every
 * filtered view has a shareable and canonical URL, and there is no client-side
 * state to get out of sync with the URL.
 */

type CatalogueViewProps = {
  heading: string;
  description?: string;
  eyebrow?: string;
  result: CataloguePage;
  filters: CatalogueQuery;
  genres: GenreWithCount[];
  years: number[];
  /** Path without the query string, e.g. `/genres/drama`. */
  basePath: string;
  /** Filters that are fixed by the route and should not be editable here. */
  lockedFilterKeys?: (keyof CatalogueQuery)[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export function CatalogueView({
  heading,
  description,
  eyebrow,
  result,
  filters,
  genres,
  years,
  basePath,
  lockedFilterKeys = [],
  emptyTitle = "No films match those filters",
  emptyDescription = "Try removing a filter or searching for a different title.",
}: CatalogueViewProps) {
  const locked = new Set(lockedFilterKeys);

  /** Build a URL for a given page, preserving every active filter. */
  function buildHref(page: number) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.genre && !locked.has("genre")) params.set("genre", filters.genre);
    if (filters.year && !locked.has("year")) params.set("year", String(filters.year));
    if (filters.language) params.set("language", filters.language);
    if (filters.rating) params.set("rating", filters.rating);
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const activeFilters: { label: string; href: string }[] = [];
  if (filters.q) activeFilters.push({ label: `“${filters.q}”`, href: basePath });
  if (filters.genre && !locked.has("genre")) {
    const match = genres.find((genre) => genre.slug === filters.genre);
    activeFilters.push({ label: match?.name ?? filters.genre, href: basePath });
  }
  if (filters.year && !locked.has("year")) {
    activeFilters.push({ label: String(filters.year), href: basePath });
  }

  return (
    <div className="container-page py-10">
      <header className="mb-8 max-w-3xl">
        {eyebrow ? <p className="text-eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-title text-ink font-semibold">{heading}</h1>
        {description ? <p className="text-ink-muted mt-3 text-sm">{description}</p> : null}
        <p className="text-ink-subtle mt-3 text-sm" role="status">
          {result.total === 0
            ? "No films found"
            : `${result.total} film${result.total === 1 ? "" : "s"}`}
          {result.totalPages > 1 ? ` · page ${result.page} of ${result.totalPages}` : ""}
        </p>
      </header>

      {/* ---- Filters ---------------------------------------------------- */}
      <form
        method="get"
        action={basePath}
        className="rounded-panel border-line bg-surface mb-8 border p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-q" className="text-ink-muted text-xs font-medium">
              Title
            </label>
            <input
              id="filter-q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder="Search titles"
              className="border-line-strong bg-surface-sunken text-ink placeholder:text-ink-subtle h-10 rounded-lg border px-3 text-sm"
            />
          </div>

          {!locked.has("genre") ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-genre" className="text-ink-muted text-xs font-medium">
                Genre
              </label>
              <select
                id="filter-genre"
                name="genre"
                defaultValue={filters.genre ?? ""}
                className="border-line-strong bg-surface-sunken text-ink h-10 rounded-lg border px-3 text-sm"
              >
                <option value="">All genres</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.slug}>
                    {genre.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!locked.has("year") ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-year" className="text-ink-muted text-xs font-medium">
                Year
              </label>
              <select
                id="filter-year"
                name="year"
                defaultValue={filters.year ? String(filters.year) : ""}
                className="border-line-strong bg-surface-sunken text-ink h-10 rounded-lg border px-3 text-sm"
              >
                <option value="">Any year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-sort" className="text-ink-muted text-xs font-medium">
              Sort
            </label>
            <select
              id="filter-sort"
              name="sort"
              defaultValue={filters.sort}
              className="border-line-strong bg-surface-sunken text-ink h-10 rounded-lg border px-3 text-sm"
            >
              <option value="newest">Recently published</option>
              <option value="title">Title A–Z</option>
              <option value="year">Release year</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="bg-accent text-accent-ink hover:bg-accent-strong h-10 rounded-full px-5 text-sm font-medium transition-colors"
          >
            Apply filters
          </button>
          <LinkButton href={basePath} variant="secondary" size="md">
            Clear all
          </LinkButton>

          {activeFilters.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <li key={filter.label}>
                  <span className="border-accent-dim bg-accent/10 text-accent rounded-full border px-3 py-1 text-xs">
                    {filter.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </form>

      {/* ---- Results ---------------------------------------------------- */}
      {result.items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {result.items.map((movie, index) => (
              <li key={movie.id}>
                {/*
                  Only the first card is the LCP candidate: text has no network
                  cost, so the first poster is the largest imageful paint on this
                  page. On a two-column phone grid the previous
                  `index < 6` preloaded three rows' worth of posters, most of
                  them below the fold, and each preload competes with the LCP
                  image for bandwidth (spec §13: prioritize only the true hero
                  image).
                */}
                <MovieCard movie={movie} priority={index === 0} />
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            buildHref={buildHref}
            className="mt-12"
          />
        </>
      )}
    </div>
  );
}
