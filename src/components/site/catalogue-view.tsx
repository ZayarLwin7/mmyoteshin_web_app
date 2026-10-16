import Link from "next/link";

import { EmptyState } from "@/components/ui/feedback";
import { Button, LinkButton } from "@/components/ui/button";
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

/** Sort option keys, with the label used both in the select and in filter chips. */
const SORT_LABELS: Record<string, string> = {
  newest: "Recently published",
  title: "Title A–Z",
  year: "Release year",
};

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

  /**
   * Build a URL for a given page, preserving every active filter.
   *
   * `omit` drops specific filters so a chip can remove *only itself*. The
   * previous version gave every chip `basePath` as its href, which cleared the
   * whole filter set — clicking the "1941" chip silently discarded the genre
   * too. Chips now remove exactly the filter they name.
   */
  function buildHref(page = 1, omit: (keyof CatalogueQuery)[] = []) {
    const drop = new Set(omit);
    const params = new URLSearchParams();
    if (filters.q && !drop.has("q")) params.set("q", filters.q);
    if (filters.genre && !locked.has("genre") && !drop.has("genre")) {
      params.set("genre", filters.genre);
    }
    if (filters.year && !locked.has("year") && !drop.has("year")) {
      params.set("year", String(filters.year));
    }
    if (filters.language && !drop.has("language")) params.set("language", filters.language);
    if (filters.rating && !drop.has("rating")) params.set("rating", filters.rating);
    if (filters.sort && filters.sort !== "newest" && !drop.has("sort")) {
      params.set("sort", filters.sort);
    }
    if (page > 1 && !drop.has("page")) params.set("page", String(page));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  /** Chips for every filter the visitor can actually remove from here. */
  const activeFilters: { key: keyof CatalogueQuery; label: string; href: string }[] = [];
  if (filters.q) {
    activeFilters.push({ key: "q", label: `“${filters.q}”`, href: buildHref(1, ["q"]) });
  }
  if (filters.genre && !locked.has("genre")) {
    const match = genres.find((genre) => genre.slug === filters.genre);
    activeFilters.push({
      key: "genre",
      label: match?.name ?? filters.genre,
      href: buildHref(1, ["genre"]),
    });
  }
  if (filters.year && !locked.has("year")) {
    activeFilters.push({
      key: "year",
      label: String(filters.year),
      href: buildHref(1, ["year"]),
    });
  }
  if (filters.language) {
    activeFilters.push({
      key: "language",
      label: filters.language,
      href: buildHref(1, ["language"]),
    });
  }
  if (filters.rating) {
    activeFilters.push({ key: "rating", label: filters.rating, href: buildHref(1, ["rating"]) });
  }
  if (filters.sort && filters.sort !== "newest") {
    activeFilters.push({
      key: "sort",
      label: SORT_LABELS[filters.sort] ?? filters.sort,
      href: buildHref(1, ["sort"]),
    });
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
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit">Apply filters</Button>

          {/*
            Only offered when there is something to clear.

            On a locked-filter route (`/genres/[slug]`, `/years/[year]`) with no
            other filters active, the href was the current URL — so clicking it
            changed nothing and the control read as broken. It now appears only
            when at least one removable filter is set.
          */}
          {activeFilters.length > 0 ? (
            <LinkButton href={basePath} variant="secondary" size="md">
              Clear all
            </LinkButton>
          ) : null}

          {activeFilters.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <li key={filter.key}>
                  {/*
                    Each chip removes only its own filter, preserving the rest.
                    The close glyph is decorative; the accessible name carries
                    the action so a screen reader announces what will happen.
                  */}
                  <Link
                    href={filter.href}
                    className="border-accent-dim bg-accent/10 text-accent hover:border-accent hover:bg-accent/20 active:bg-accent/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition duration-150 active:scale-[0.98]"
                  >
                    {filter.label}
                    <span aria-hidden="true" className="text-accent/70">
                      ×
                    </span>
                    <span className="sr-only">— remove this filter</span>
                  </Link>
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
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-6">
            {result.items.map((movie, index) => (
              <li key={movie.id}>
                {/*
                  Only the first card is the LCP candidate: text has no network
                  cost, so the first poster is the largest imageful paint on this
                  page. On a three-column phone grid the previous
                  `index < 6` preloaded two rows' worth of posters, most of
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
