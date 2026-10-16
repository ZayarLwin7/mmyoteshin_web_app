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

/**
 * Series catalogue.
 *
 * Structurally a twin of `/movies`: same query schema, same filter bar, same
 * grid and pager. The only differences are the fixed `contentKind` filter and
 * the genre/year dropdowns, which are scoped to series so a film year never
 * appears as an option here.
 *
 * Series and films live in one table with a `content_kind` discriminator rather
 * than in two tables. They share a genre join table, reviews and download
 * links, and the alternative would duplicate every one of those joins.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filters = catalogueQuerySchema.parse(await searchParams);
  const canonical = `/series${canonicalCatalogueQuery({ ...filters, page: 1 })}`;

  return {
    title: filters.genre || filters.year ? "Series" : "All series",
    description:
      "Every series we have reviewed, with original editorial writing and clearly labelled, authorized distribution links.",
    alternates: { canonical },
    robots: filters.page > 1 ? { index: false, follow: true } : undefined,
  };
}

/** Same reasoning as `/movies`: an in-page `<Suspense>`, never a `loading.tsx`. */
export default function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <SeriesResults searchParams={searchParams} />
    </Suspense>
  );
}

async function SeriesResults({
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
      contentKind: "series",
    }),
    listGenresWithCounts("series"),
    listYearsWithCounts("series"),
  ]);

  return (
    <CatalogueView
      eyebrow="Catalogue"
      heading="Every series we have reviewed"
      description="Original editorial writing, accurate episode counts, and links only to distributions we are authorized to reference."
      result={result}
      filters={filters}
      genres={genres}
      years={years.map((entry) => entry.year)}
      basePath="/series"
      itemNoun="series"
      emptyTitle="No series match those filters"
      emptyDescription="Try removing a filter or searching for a different title."
    />
  );
}
