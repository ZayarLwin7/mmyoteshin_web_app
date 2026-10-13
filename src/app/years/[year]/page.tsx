import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogueView } from "@/components/site/catalogue-view";
import {
  listGenresWithCounts,
  listPublishedMovies,
  listYearsWithCounts,
} from "@/db/queries/public";
import { catalogueQuerySchema } from "@/lib/validation/schemas";

export const revalidate = 300;

const MIN_YEAR = 1888;
const MAX_YEAR = 2200;

async function parseYear(params: Promise<{ year: string }>) {
  const { year } = await params;
  const parsed = Number.parseInt(year, 10);
  if (!Number.isInteger(parsed) || parsed < MIN_YEAR || parsed > MAX_YEAR) return null;
  return parsed;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const year = await parseYear(params);
  if (year === null) return { title: "Year not found" };

  return {
    title: `Films from ${year}`,
    description: `Films released in ${year}, with original editorial reviews and authorized distribution links.`,
    alternates: { canonical: `/years/${year}` },
  };
}

/**
 * No `<Suspense>` and no `loading.tsx`, for the same reason as
 * `/genres/[slug]`: `notFound()` must be able to set the status code, and a
 * boundary that has already streamed a fallback commits 200 first. See the note
 * on `GenrePage` — this was verified against `next start`, not assumed.
 */
export default async function YearPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [year, rawFilters] = await Promise.all([parseYear(params), searchParams]);
  if (year === null) notFound();

  const filters = catalogueQuerySchema.parse(rawFilters);

  const [result, genres, years] = await Promise.all([
    listPublishedMovies({
      page: filters.page,
      q: filters.q ?? null,
      genreSlug: filters.genre ?? null,
      year,
      sort: filters.sort,
    }),
    listGenresWithCounts(),
    listYearsWithCounts(),
  ]);

  return (
    <CatalogueView
      eyebrow="Release year"
      heading={`Films from ${year}`}
      result={result}
      filters={filters}
      genres={genres}
      years={years.map((entry) => entry.year)}
      basePath={`/years/${year}`}
      lockedFilterKeys={["year"]}
      emptyTitle={`Nothing from ${year} yet`}
      emptyDescription="No films from this year have been published."
    />
  );
}
