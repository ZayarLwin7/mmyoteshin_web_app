import type { Metadata } from "next";

import { AdSlot } from "@/components/site/ad-slot";
import { EmptyState } from "@/components/ui/feedback";
import { HomeHero } from "@/components/site/home-hero";
import { LinkButton } from "@/components/ui/button";
import { MovieRail } from "@/components/site/movie-rail";
import {
  listCuratedMovies,
  listFeaturedMovies,
  listGenresWithCounts,
  listRecentlyPublished,
  listTopRatedMovies,
} from "@/db/queries/public";
import { publicEnv } from "@/lib/env";
import { absoluteUrl } from "@/lib/utils";
import Link from "next/link";

export const metadata: Metadata = {
  title: `${publicEnv.siteName} — Film discovery and editorial reviews`,
  description: publicEnv.siteDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${publicEnv.siteName} — Film discovery and editorial reviews`,
    description: publicEnv.siteDescription,
    url: absoluteUrl("/"),
  },
};

/**
 * Home page.
 *
 * Sections are built from real queries; when the catalogue is empty the page
 * shows an honest empty state and the seeded sample data (which is all drafts)
 * is never exposed.
 *
 * `revalidate` gives ISR: the page is rebuilt at most every five minutes, and
 * publishing a film revalidates it immediately via `revalidatePath`.
 */
export const revalidate = 300;

export default async function HomePage() {
  const [featured, latest, latestSeries, curated, topRated, genres] = await Promise.all([
    listFeaturedMovies(1),
    listRecentlyPublished(12),
    listRecentlyPublished(12, "series"),
    listCuratedMovies(12),
    listTopRatedMovies(12),
    listGenresWithCounts(),
  ]);

  const hero = featured[0] ?? latest[0] ?? latestSeries[0] ?? null;
  const populatedGenres = genres.filter((genre) => genre.movieCount > 0);

  // Neither section has anything live yet. Series count too: the site may be
  // part-published, and claiming "nothing has been published" while a series
  // rail is visible two paragraphs down would simply be wrong.
  if (!hero && latestSeries.length === 0) {
    return (
      <div className="container-page py-24">
        <EmptyState
          title="The catalogue is being prepared"
          description="No films or series have been published yet. Once the editorial team publishes the first reviews they will appear here."
          action={<LinkButton href="/about">Read about our editorial standards</LinkButton>}
        />
      </div>
    );
  }

  return (
    <>
      <HomeHero movie={hero} />

      <div className="container-page">
        <AdSlot format="leaderboard" />
      </div>

      <MovieRail
        id="rail-latest"
        eyebrow="Newly published"
        title="Latest reviews"
        description="The most recent additions to the catalogue."
        movies={latest}
        viewAllHref="/movies"
      />

      {curated.length > 0 ? (
        <MovieRail
          id="rail-curated"
          eyebrow="Editor's picks"
          title="Chosen by our editors"
          description="Films the editorial team has singled out. Ordering is a human decision, not an algorithm."
          movies={curated}
        />
      ) : null}

      <MovieRail
        id="rail-top-rated"
        eyebrow="Highest rated"
        title="Best reviewed"
        description="Ranked by our editorial score, on a documented 0–10 scale."
        movies={topRated}
      />

      {/*
        Only rendered when a series is actually published. An empty rail with a
        "View all" link to an empty section is worse than no rail at all, and
        `listRecentlyPublished(12, "series")` is scoped so this stays quiet
        until the series section has content.
      */}
      {latestSeries.length > 0 ? (
        <MovieRail
          id="rail-latest-series"
          eyebrow="Newly published"
          title="Latest series"
          description="The most recent series reviews added to the catalogue."
          movies={latestSeries}
          viewAllHref="/series"
        />
      ) : null}

      {populatedGenres.length > 0 ? (
        <section aria-labelledby="browse-genres" className="container-page py-12">
          <h2 id="browse-genres" className="text-heading text-ink mb-5 font-semibold">
            Browse by genre
          </h2>

          <ul className="flex flex-wrap gap-2">
            {populatedGenres.map((genre) => (
              <li key={genre.id}>
                <Link
                  href={`/genres/${genre.slug}`}
                  className="border-line-strong text-ink-muted hover:border-accent hover:text-accent inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors"
                >
                  {genre.name}
                  <span className="text-ink-subtle text-xs">{genre.movieCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="container-page pb-16">
        <div className="rounded-panel border-line bg-surface border px-6 py-10 text-center sm:px-12">
          <p className="text-eyebrow mb-3">How we work</p>
          <h2 className="text-title text-ink font-semibold">
            Every link has a recorded authorization basis
          </h2>
          <p className="text-ink-muted mx-auto mt-4 max-w-2xl text-sm">
            We only link to distributions we are permitted to link to, and each one is reviewed
            before it appears. If you believe something here is wrong, tell us and we will look at
            it.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/about" variant="secondary">
              Editorial standards
            </LinkButton>
            <LinkButton href="/copyright" variant="ghost">
              Report a problem
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
