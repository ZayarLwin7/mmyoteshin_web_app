import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { CatalogueSkeleton } from "@/components/site/movie-card";
import { CatalogueView } from "@/components/site/catalogue-view";
import { Alert, EmptyState } from "@/components/ui/feedback";
import {
  listGenresWithCounts,
  listPublishedMovies,
  listYearsWithCounts,
} from "@/db/queries/public";
import { clientFingerprint, rateLimitSearch } from "@/lib/security/rate-limit";
import { catalogueQuerySchema } from "@/lib/validation/schemas";

/**
 * Search results.
 *
 * Search is deliberately not indexed: result pages are thin, and letting them
 * into the index competes with the film pages themselves. `noindex, follow`
 * keeps link equity flowing while keeping the pages out of results.
 */
export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const filters = catalogueQuerySchema.parse(await searchParams);
  const term = filters.q?.trim();

  return {
    title: term ? `Search: ${term}` : "Search",
    description: "Search the catalogue by title or original title.",
    robots: { index: false, follow: true },
  };
}

/**
 * Shell only. It must not `await`, so the `<Suspense>` boundary below is this
 * route's own and not an ancestor of anything — a `loading.tsx` here would
 * stream a shell for `/movies/[slug]` too and soft-404 it. See
 * `CatalogueSkeleton`.
 */
export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <SearchResults searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = catalogueQuerySchema.parse(await searchParams);
  const term = filters.q?.trim() ?? "";

  if (term === "") {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Search the catalogue"
          description="Enter a film title in the search box above. Results include both the release title and the original title."
        />
      </div>
    );
  }

  /*
   * Rate limit before touching the database.
   *
   * `/search` reads `searchParams`, so it is rendered per request — the
   * `revalidate` above cannot apply to it. That makes it the one public route
   * that runs a query against an arbitrary visitor-supplied term, and the
   * query is `ILIKE '%term%'`, a leading-wildcard pattern that cannot use an
   * index and therefore scans. The database sits in another region, so each
   * scan also costs a round trip; an unthrottled crawler could make that
   * expensive very quickly. Spec §9 requires search to be rate-limited
   * alongside authentication and reporting.
   *
   * The limit is consumed before the query, so a throttled request costs one
   * cheap counter row and zero catalogue work.
   */
  const limit = await rateLimitSearch(clientFingerprint(await headers()));
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return (
      <div className="container-page py-16">
        <Alert tone="warning" className="mx-auto max-w-xl">
          <h1 className="text-ink text-base font-semibold">Too many searches</h1>
          <p className="mt-2">
            You have made a lot of searches in a short time. Please wait about {minutes} minute
            {minutes === 1 ? "" : "s"} and try again. This limit exists to keep the catalogue fast
            for everyone.
          </p>
          <p className="text-ink-subtle mt-3">
            {limit.remaining > 0
              ? `${limit.remaining} searches left in this window.`
              : "No searches left in this window."}
          </p>
        </Alert>
      </div>
    );
  }

  const [result, genres, years] = await Promise.all([
    listPublishedMovies({
      page: filters.page,
      q: term,
      genreSlug: filters.genre ?? null,
      year: filters.year ?? null,
      sort: filters.sort,
    }),
    listGenresWithCounts(),
    listYearsWithCounts(),
  ]);

  return (
    <CatalogueView
      eyebrow="Search"
      heading={`Results for “${term}”`}
      result={result}
      filters={{ ...filters, q: term }}
      genres={genres}
      years={years.map((entry) => entry.year)}
      basePath="/search"
      // Search spans both sections, so the count uses a neutral noun rather
      // than claiming every hit is a film.
      itemNoun="result"
      emptyTitle={`Nothing matched “${term}”`}
      emptyDescription="Check the spelling, or try a shorter part of the title."
    />
  );
}
