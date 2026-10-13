import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/site/ad-slot";
import {
  ExternalLinkNotice,
  authorizationBasisLabel,
} from "@/components/site/external-link-notice";
import { OutboundLink } from "@/components/site/outbound-link";
import { Alert } from "@/components/ui/feedback";
import { getPublicDownloadLinkById } from "@/db/queries/public";
import { formatFileSize } from "@/lib/utils";

/**
 * Download hand-off.
 *
 * Clicking a server name in the download table lands here rather than going
 * straight off-site. The reasons are, in order of importance:
 *
 *  1. The destination is disclosed *before* anyone leaves. The visitor sees the
 *     host they are about to be sent to, the file size and the resolution, and
 *     can back out. A link that silently redirects somewhere unexpected is the
 *     failure mode this page exists to prevent.
 *  2. It is the one place an ad is shown, which is what funds the site. The ad
 *     is labelled "Advertisement", it is never a download control, and there is
 *     exactly one further click — no chains of interstitials.
 *  3. It keeps the referral policy in one place: the outbound link carries
 *     `rel="noopener noreferrer nofollow"`.
 *
 * The page is `noindex` and never cached, so a link that is disabled or
 * de-authorized stops working immediately rather than lingering in a CDN.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Continue to download",
  robots: { index: false, follow: false },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DownloadHandoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Reject a malformed id before it reaches the database: passing a non-UUID
  // into a `uuid` column is an error, not an empty result.
  if (!UUID_PATTERN.test(id)) notFound();

  const link = await getPublicDownloadLinkById(id);
  if (!link) notFound();

  const size = formatFileSize(link.fileSizeBytes);
  const basis = authorizationBasisLabel(link.authorizationBasis);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="text-ink-subtle flex flex-wrap items-center gap-2 text-xs">
            <li>
              <Link href="/movies" className="hover:text-accent">
                Films
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/movies/${link.movieSlug}`} className="hover:text-accent">
                {link.movieTitle}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink-muted">Download</li>
          </ol>
        </nav>

        <header>
          <h1 className="text-title text-ink font-semibold">Continue to your download</h1>
          <p className="text-ink-muted mt-2 text-sm">
            {link.movieTitle} — {link.label}
          </p>
        </header>

        {/* ---- What you are about to open ---------------------------------- */}
        <section aria-labelledby="target-heading" className="mt-8">
          <h2 id="target-heading" className="text-eyebrow mb-3">
            You are opening
          </h2>

          <div className="rounded-panel border-line bg-surface border p-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-ink-subtle text-xs">Server</dt>
                <dd className="text-ink text-sm">{link.providerName}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle text-xs">Destination</dt>
                <dd className="text-ink text-sm break-all">{link.destinationHost}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle text-xs">Size</dt>
                <dd className="text-ink text-sm">{size ?? "Not stated"}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle text-xs">Resolution</dt>
                <dd className="text-ink text-sm">{link.quality ?? "Not stated"}</dd>
              </div>
              {basis ? (
                <div>
                  <dt className="text-ink-subtle text-xs">Authorization basis</dt>
                  <dd className="text-ink text-sm">{basis}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        {/* ---- Advertisement ----------------------------------------------- */}
        {/*
          `mb-0` because the spacing below belongs to the section that follows,
          not to the ad. When ads are disabled `AdSlot` renders nothing at all,
          so an ad-owned margin would disappear and leave the button flush
          against the card above — which is exactly what happened before.
        */}
        <AdSlot format="leaderboard" className="mt-8 mb-0" />

        {/* ---- The one click that matters ---------------------------------- */}
        <section aria-labelledby="continue-heading" className="mt-8 text-center">
          <h2 id="continue-heading" className="sr-only">
            Continue to the download
          </h2>

          <OutboundLink
            href={link.destinationUrl}
            host={link.destinationHost}
            className="bg-accent text-accent-ink hover:bg-accent-strong inline-flex h-12 items-center rounded-full px-8 text-sm font-semibold transition-colors"
          >
            Continue to {link.providerName}
          </OutboundLink>

          <p className="text-ink-subtle mt-3 text-xs">Opens {link.destinationHost} in a new tab.</p>
        </section>

        {/* ---- Honesty about what this page is ------------------------------ */}
        <Alert tone="info" className="mt-8 text-xs leading-relaxed">
          <p>
            This page shows an advertisement, which is how the catalogue is funded. It is not a
            download button and it does not affect the file — the link below the ad always goes
            straight to {link.destinationHost}.
          </p>
        </Alert>

        <div className="mt-6">
          <ExternalLinkNotice />
        </div>

        <p className="mt-6 text-center text-xs">
          <Link
            href={`/movies/${link.movieSlug}`}
            className="text-accent underline underline-offset-4"
          >
            Back to {link.movieTitle}
          </Link>
        </p>
      </div>
    </div>
  );
}
