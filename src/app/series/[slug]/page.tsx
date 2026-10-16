import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/site/ad-slot";
import { DownloadLinksTable } from "@/components/site/download-links-table";
import { ExternalLinkNotice } from "@/components/site/external-link-notice";
import { MetaRow } from "@/components/site/meta-row";
import { MovieRail } from "@/components/site/movie-rail";
import { Poster } from "@/components/site/poster";
import { RatingBadge, RatingSummary } from "@/components/site/rating-badge";
import { ReportForm } from "@/components/site/report-form";
import { Alert } from "@/components/ui/feedback";
import {
  getPublishedMovieBySlug,
  listPublishedSlugsForSitemap,
  listRelatedMovies,
} from "@/db/queries/public";
import { publicEnv } from "@/lib/env";
import { toParagraphs } from "@/lib/security/sanitize";
import {
  absoluteUrl,
  formatDate,
  formatRating,
  formatRatingScale,
  formatSeriesLength,
} from "@/lib/utils";

export const revalidate = 300;

/**
 * Prerender every published series at build time.
 *
 * Deliberately scoped to `contentKind === "series"`. `/movies/[slug]` also calls
 * `listPublishedSlugsForSitemap()`, and without the filter *both* routes would
 * prerender every slug — the film route would then render the series page's
 * not-found guard for series slugs and vice versa. Next would also build the
 * same path twice under two route trees.
 */
export async function generateStaticParams() {
  const entries = await listPublishedSlugsForSitemap();
  return entries
    .filter((entry) => entry.contentKind === "series")
    .map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getPublishedMovieBySlug(slug);

  if (!detail || detail.movie.contentKind !== "series") {
    return { title: "Series not found", robots: { index: false, follow: false } };
  }

  const { movie, review } = detail;
  const title = movie.metaTitle ?? movie.title;
  const description =
    movie.metaDescription ??
    movie.synopsis?.slice(0, 300) ??
    `Editorial review and metadata for the series ${movie.title}.`;

  return {
    title,
    description,
    alternates: { canonical: `/series/${movie.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(`/series/${movie.slug}`),
      // Posters are usually site-relative now, and Open Graph consumers require
      // an absolute URL — a bare path is silently ignored by most crawlers.
      images: movie.posterUrl
        ? [{ url: absoluteUrl(movie.posterUrl), alt: `${movie.title} poster` }]
        : undefined,
    },
    other: review?.rating
      ? { "film:rating": formatRating(review.rating, review.ratingScale) ?? "" }
      : {},
  };
}

/**
 * Escape `<` so a value containing `</script>` cannot terminate the JSON-LD
 * block early. This is the documented safe way to inline JSON in HTML.
 */
function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Both queries are keyed on the slug, so neither has to wait for the other.
  // The database may be in another region, so saving one round trip is the
  // single biggest win available on this page.
  const [detail, related] = await Promise.all([
    getPublishedMovieBySlug(slug),
    listRelatedMovies(slug, 6, "series"),
  ]);

  // A published film is *not* a series. Rendering it under `/series/...` would
  // publish the same content at two URLs, which is a duplicate-content defect,
  // so the wrong kind is a 404 rather than a redirect.
  if (!detail || detail.movie.contentKind !== "series") notFound();

  const { movie, genres, review, links } = detail;

  const rating = review ? formatRating(review.rating, review.ratingScale) : null;
  const length = formatSeriesLength(movie.seasonCount, movie.episodeCount);
  const synopsisParagraphs = toParagraphs(movie.synopsis);
  const reviewParagraphs = review ? toParagraphs(review.body) : [];

  /**
   * Structured data is emitted only for facts we actually hold. A rating is
   * included only when there is a published editorial review, and it is marked
   * as a review of *our* publication — never as an aggregate we do not have.
   */
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: movie.title,
    url: absoluteUrl(`/series/${movie.slug}`),
    ...(movie.originalTitle ? { alternateName: movie.originalTitle } : {}),
    ...(movie.releaseYear ? { datePublished: String(movie.releaseYear) } : {}),
    ...(movie.synopsis ? { description: movie.synopsis } : {}),
    ...(movie.posterUrl ? { image: absoluteUrl(movie.posterUrl) } : {}),
    // `numberOfSeasons` is a publication blocker, so it is always present on a
    // live series. `numberOfEpisodes` is only a warning, hence the spread.
    ...(movie.seasonCount ? { numberOfSeasons: movie.seasonCount } : {}),
    ...(movie.episodeCount ? { numberOfEpisodes: movie.episodeCount } : {}),
    ...(genres.length > 0 ? { genre: genres.map((genre) => genre.name) } : {}),
    ...(movie.country ? { countryOfOrigin: movie.country } : {}),
    ...(review
      ? {
          review: {
            "@type": "Review",
            name: review.reviewTitle ?? `Review of ${movie.title}`,
            reviewBody: review.body.slice(0, 2000),
            author: { "@type": "Person", name: review.reviewerName },
            publisher: { "@type": "Organization", name: publicEnv.siteName },
            ...(review.publishedAt ? { datePublished: review.publishedAt.toISOString() } : {}),
            ...(review.rating
              ? {
                  reviewRating: {
                    "@type": "Rating",
                    ratingValue: review.rating,
                    bestRating: review.ratingScale,
                    worstRating: "0",
                  },
                }
              : {}),
          },
        }
      : {}),
  };

  return (
    <article>
      <script
        type="application/ld+json"
        // Serialised with `<` escaped; see `serializeJsonLd` above.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* ---- Masthead ---------------------------------------------------- */}
      <header className="border-line relative isolate overflow-hidden border-b">
        <div className="absolute inset-0 -z-10">
          <Poster
            src={movie.backdropUrl ?? movie.posterUrl}
            alt=""
            aspect="aspect-auto h-full w-full"
            sizes="100vw"
            priority
            className="h-full w-full rounded-none opacity-25"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-canvas)_5%,color-mix(in_oklab,var(--color-canvas)_65%,transparent)_55%,transparent_100%)]" />
        </div>

        <div className="container-page py-12">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="text-ink-subtle flex flex-wrap items-center gap-2 text-xs">
              <li>
                <Link href="/" className="hover:text-accent">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/series" className="hover:text-accent">
                  Series
                </Link>
              </li>
              {genres[0] ? (
                <>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link href={`/genres/${genres[0].slug}`} className="hover:text-accent">
                      {genres[0].name}
                    </Link>
                  </li>
                </>
              ) : null}
            </ol>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
            <div className="hidden lg:block">
              <div className="relative">
                <Poster
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  sizes="220px"
                  priority
                />
                <RatingBadge
                  rating={rating}
                  scale={review?.ratingScale}
                  className="absolute top-2 right-2"
                />
              </div>
            </div>

            <div>
              <h1 className="text-title text-ink font-semibold">{movie.title}</h1>

              {movie.originalTitle && movie.originalTitle !== movie.title ? (
                <p className="text-ink-muted mt-2 text-base italic">{movie.originalTitle}</p>
              ) : null}

              <MetaRow
                className="mt-5 text-sm"
                items={[
                  { key: "year", content: movie.releaseYear },
                  { key: "length", content: length },
                  {
                    key: "rating",
                    content: movie.contentRating ? `Rated ${movie.contentRating}` : null,
                  },
                  { key: "country", content: movie.country },
                  {
                    key: "language",
                    content: movie.languageCode ? movie.languageCode.toUpperCase() : null,
                  },
                ]}
              />

              {genres.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <li key={genre.id}>
                      <Link
                        href={`/genres/${genre.slug}`}
                        className="border-line-strong text-ink-muted hover:border-accent hover:text-accent inline-flex rounded-full border px-3 py-1 text-xs transition-colors"
                      >
                        {genre.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <RatingSummary
                rating={rating}
                scale={review?.ratingScale}
                source={review?.ratingSource}
              />

              <div className="mt-6">
                <a
                  href="#downloads"
                  className="bg-accent text-accent-ink hover:bg-accent-strong inline-flex h-10 items-center rounded-full px-5 text-sm font-medium transition-colors"
                >
                  {links.length > 0 ? "Jump to download options" : "Jump to the review"}
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container-page py-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-12">
            {/* ---- Synopsis -------------------------------------------- */}
            {synopsisParagraphs.length > 0 ? (
              <section aria-labelledby="synopsis-heading">
                <h2 id="synopsis-heading" className="text-heading text-ink mb-4 font-semibold">
                  Synopsis
                </h2>
                <div className="text-ink-muted space-y-4 text-sm leading-relaxed">
                  {synopsisParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ---- Authorized links ------------------------------------ */}
            <section id="downloads" aria-labelledby="downloads-heading" className="scroll-mt-24">
              <h2 id="downloads-heading" className="text-heading text-ink mb-4 font-semibold">
                Authorized download options
              </h2>

              {links.length === 0 ? (
                <Alert tone="info">
                  <p>
                    No external distribution link is currently published for this series. We only
                    list links whose authorization we have recorded and reviewed, so this may mean a
                    suitable authorized source has not been confirmed yet.
                  </p>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <ExternalLinkNotice />

                  <DownloadLinksTable links={links} />

                  <p className="text-ink-subtle text-xs">
                    Choosing a server opens a short page that names the destination and shows the
                    advertisement which funds the catalogue, before you leave this site.
                  </p>
                </div>
              )}
            </section>

            {/* ---- Editorial review ------------------------------------ */}
            {review ? (
              <section aria-labelledby="review-heading">
                <h2 id="review-heading" className="text-heading text-ink mb-4 font-semibold">
                  {review.reviewTitle ?? "Our review"}
                </h2>

                <p className="text-ink-subtle mb-6 text-xs">
                  By {review.reviewerName}
                  {review.publishedAt ? ` · published ${formatDate(review.publishedAt)}` : ""}
                </p>

                <div className="text-ink-muted space-y-4 text-sm leading-relaxed">
                  {reviewParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>

                {rating ? (
                  <div className="rounded-panel border-line bg-surface mt-8 border p-5">
                    <p className="text-eyebrow mb-2">Rating methodology</p>
                    <p className="text-ink-muted text-sm">
                      This is an <strong className="text-ink">editorial score of {rating}</strong>{" "}
                      out of {formatRatingScale(review.ratingScale)}, awarded by{" "}
                      {publicEnv.siteName} on a documented{" "}
                      {Number.parseInt(formatRatingScale(review.ratingScale), 10)}-point scale. It
                      reflects the editorial team&apos;s own assessment and is not an aggregate of
                      user votes or of any third-party service. Scores are shown with their scale
                      everywhere they appear, and are never combined with a different rating system.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : (
              <Alert tone="info" title="No review published yet">
                <p>
                  This series is in the catalogue but our editorial review has not been published
                  yet.
                </p>
              </Alert>
            )}

            {/* ---- Report ---------------------------------------------- */}
            <section aria-labelledby="report-heading">
              <h2 id="report-heading" className="text-heading text-ink mb-4 font-semibold">
                Report a problem
              </h2>
              <p className="text-ink-muted mb-4 text-sm">
                If something on this page is wrong — a broken link, a rights issue, or incorrect
                information — tell us and we will review it.
              </p>
              <ReportForm movieId={movie.id} />
            </section>
          </div>

          {/* ---- Sidebar ----------------------------------------------- */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <AdSlot format="inline" className="my-0" />

            <div className="rounded-panel border-line bg-surface border p-5">
              <h2 className="text-eyebrow mb-3">Details</h2>
              <dl className="space-y-3 text-sm">
                {movie.originalTitle ? (
                  <div>
                    <dt className="text-ink-subtle text-xs">Original title</dt>
                    <dd className="text-ink">{movie.originalTitle}</dd>
                  </div>
                ) : null}
                {movie.releaseDate ? (
                  <div>
                    <dt className="text-ink-subtle text-xs">Release date</dt>
                    <dd className="text-ink">{formatDate(movie.releaseDate)}</dd>
                  </div>
                ) : null}
                {movie.seasonCount ? (
                  <div>
                    <dt className="text-ink-subtle text-xs">Seasons</dt>
                    <dd className="text-ink">{movie.seasonCount}</dd>
                  </div>
                ) : null}
                {movie.episodeCount ? (
                  <div>
                    <dt className="text-ink-subtle text-xs">Episodes</dt>
                    <dd className="text-ink">{movie.episodeCount}</dd>
                  </div>
                ) : null}
                {movie.imageCredit ? (
                  <div>
                    <dt className="text-ink-subtle text-xs">Artwork credit</dt>
                    <dd className="text-ink">{movie.imageCredit}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {links.length > 0 ? (
              <div className="rounded-panel border-line bg-surface border p-5">
                <h2 className="text-eyebrow mb-3">Download options</h2>
                <ul className="space-y-2 text-sm">
                  {links.map((link) => (
                    <li key={link.id}>
                      <a href="#downloads" className="text-ink-muted hover:text-accent">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {related.length > 0 ? (
        <MovieRail
          id="rail-related"
          eyebrow="More like this"
          title="Related series"
          movies={related}
        />
      ) : null}
    </article>
  );
}
