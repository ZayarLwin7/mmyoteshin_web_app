import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogueView } from "@/components/site/catalogue-view";
import {
  getGenreBySlug,
  listGenresWithCounts,
  listPublishedMovies,
  listYearsWithCounts,
} from "@/db/queries/public";
import { catalogueQuerySchema } from "@/lib/validation/schemas";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenreBySlug(slug);
  if (!genre) return { title: "Genre not found" };

  return {
    title: `${genre.name} films`,
    description:
      genre.description ?? `Films in the ${genre.name} genre, with original editorial reviews.`,
    alternates: { canonical: `/genres/${genre.slug}` },
  };
}

/**
 * Deliberately **not** wrapped in `<Suspense>`, and deliberately without a
 * `loading.tsx`.
 *
 * Both of those would break the 404. A `loading.tsx` at this level (or at the
 * root) is an ancestor of `/movies/[slug]`, so Next streams its shell before the
 * film route runs and commits HTTP 200 — every unknown or draft film slug then
 * answers 200 with a not-found body, which is a soft 404.
 *
 * A `<Suspense>` inside this page has the same effect on *this* route's own
 * `notFound()`: the error is thrown after the boundary has already streamed its
 * fallback, so the status stays 200. Verified against `next start` — with the
 * boundary in place `/genres/no-such-genre` answered 200 with the not-found
 * body; without it, 404.
 *
 * The cost of dropping the boundary is that this route blocks until its data
 * arrives instead of streaming a skeleton. That is the honest trade for a
 * correct status code, and it is the same behaviour the film detail page has.
 */
export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, rawFilters] = await Promise.all([params, searchParams]);

  const filters = catalogueQuerySchema.parse(rawFilters);

  // The genre lookup runs *alongside* the listing, not before it. The listing
  // filters on `slug`, which we already have from the route, so awaiting the
  // genre row first would buy nothing and cost a full round trip — and against
  // a database in another region a round trip is the dominant cost of the
  // page. `notFound()` is still reached before anything is rendered.
  const [genre, result, genres, years] = await Promise.all([
    getGenreBySlug(slug),
    listPublishedMovies({
      page: filters.page,
      q: filters.q ?? null,
      genreSlug: slug,
      year: filters.year ?? null,
      sort: filters.sort,
    }),
    listGenresWithCounts(),
    listYearsWithCounts(),
  ]);

  if (!genre) notFound();

  return (
    <CatalogueView
      eyebrow="Genre"
      heading={genre.name}
      description={genre.description ?? undefined}
      result={result}
      filters={filters}
      genres={genres}
      years={years.map((entry) => entry.year)}
      basePath={`/genres/${genre.slug}`}
      // The genre is fixed by the route, so it is not offered as an editable filter.
      lockedFilterKeys={["genre"]}
      emptyTitle={`No ${genre.name} films yet`}
      emptyDescription="Nothing has been published in this genre yet."
    />
  );
}
