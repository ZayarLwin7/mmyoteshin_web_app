import type { Metadata } from "next";
import { Suspense } from "react";

import { CatalogueView } from "@/components/site/catalogue-view";
import { CatalogueSkeleton } from "@/components/site/movie-card";
import {
  listGenresWithCounts,
  listPublishedMovies,
  listYearsWithCounts,
} from "@/db/queries/public";
import { catalogueQuerySchema, canonicalCatalogueQuery } from "@/lib/validation/schemas";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filters = catalogueQuerySchema.parse(await searchParams);
  const canonical = `/movies${canonicalCatalogueQuery({ ...filters, page: 1 })}`;

  // Filtered and paginated views are canonicalised to the unfiltered listing so
  // they do not compete as duplicate pages in search results.
  return {
    title: filters.genre || filters.year ? "Catalogue" : "All films",
    description:
      "Browse every film in the catalogue with original editorial reviews and clearly labelled, authorized distribution links.",
    alternates: { canonical },
    robots: filters.page > 1 ? { index: false, follow: true } : undefined,
  };
}

/**
 * Shell only — it must not `await` anything.
 *
 * The data is fetched by the child inside `<Suspense>`. That is deliberate: a
 * `loading.tsx` file here would be an ancestor of `/movies/[slug]`, and Next
 * would stream its shell before the film route ran, committing HTTP 200 and
 * turning every unknown or draft slug into a soft 404. An in-page Suspense
 * boundary keeps the skeleton without costing the status code. See
 * `CatalogueSkeleton` for the full explanation.
 */
export default function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <MoviesResults searchParams={searchParams} />
    </Suspense>
  );
}

async function MoviesResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = catalogueQuerySchema.parse(await searchParams);

  const [result, genres, years] = await Promise.all([
    listPublishedMovies({
      page: filters.page,
      q: filters.q ?? null,
      genreSlug: filters.genre ?? null,
      year: filters.year ?? null,
      language: filters.language ?? null,
      contentRating: filters.rating ?? null,
      sort: filters.sort,
      // Films only. Series live at /series; without this the seeded series
      // appeared in this grid, linking to /series/<slug> detail pages.
      contentKind: "movie",
    }),
    listGenresWithCounts("movie"),
    listYearsWithCounts("movie"),
  ]);

  return (
    <CatalogueView
      eyebrow="Catalogue"
      heading="Every film we have reviewed"
      description="Original editorial writing, accurate metadata, and links only to distributions we are authorized to reference."
      result={result}
      filters={filters}
      genres={genres}
      years={years.map((entry) => entry.year)}
      basePath="/movies"
    />
  );
}
