import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/site/prose-page";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms on which you may use this site and the catalogue it publishes.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms of use"
      summary="Plain terms for using this site. By browsing, you accept them."
      lastUpdated="11 October 2026"
    >
      <h2>What this site provides</h2>
      <p>
        {publicEnv.siteName} is a catalogue of film information and original editorial reviews. We
        are not a download host, a streaming service, or a file-sharing platform. We do not store,
        transmit, or distribute film files.
      </p>
      <p>
        Where we link to a third-party distribution, that link is provided for convenience. The
        destination is operated by someone else and is governed by their terms.
      </p>

      <h2>Using the site</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          attempt to access unpublished, draft, archived, or administrative areas without
          authorisation;
        </li>
        <li>circumvent rate limits, authentication, or any other technical control;</li>
        <li>submit reports that are knowingly false, abusive, or automated;</li>
        <li>
          scrape the site in a way that degrades service for others, or republish our editorial
          content wholesale;
        </li>
        <li>use the site for any unlawful purpose.</li>
      </ul>

      <h2>Our editorial content</h2>
      <p>
        The reviews, editorial notes, and page copy on this site are our own work and are protected
        by copyright. You may quote briefly with a link back and clear attribution. You may not
        republish substantial portions without permission.
      </p>
      <p>
        Film titles, artwork, and factual metadata remain the property of their respective rights
        holders and are used here for identification and commentary.
      </p>

      <h2>External links</h2>
      <p>
        We take care to only publish links whose authorization basis we have recorded and reviewed.
        Even so, we do not control external destinations, cannot guarantee their availability, and
        cannot verify the contents of any file. We make no warranty about any third-party site, and
        we are not responsible for what happens there.
      </p>
      <p>
        If you believe a link should not be published, see the{" "}
        <Link href="/copyright">copyright and takedown</Link> process.
      </p>

      <h2>No warranty</h2>
      <p>
        The site is provided &ldquo;as is&rdquo;. We work to keep information accurate, but we do
        not warrant that it is complete, current, or error-free. Scores and opinions are editorial
        judgements, not statements of fact.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, we are not liable for indirect or consequential loss arising
        from your use of this site or of any third-party destination you reach through it.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top of the page shows the current version, and
        continued use after a change constitutes acceptance.
      </p>
    </ProsePage>
  );
}
