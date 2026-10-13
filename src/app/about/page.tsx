import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/site/prose-page";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "About & editorial standards",
  description:
    "How we choose films, write our reviews, score them, and decide which distribution links we are willing to publish.",
  alternates: { canonical: "/about" },
};

/**
 * The editorial-standards page.
 *
 * This is the public statement of the policy the product enforces in code:
 * authorization basis is recorded per link, publication is blocked without it,
 * and ratings always carry their scale and provenance.
 */
export default function AboutPage() {
  return (
    <ProsePage
      eyebrow="About"
      title="About and editorial standards"
      summary={`${publicEnv.siteName} is a curated film catalogue. We write about films we have actually watched, and we only link to distributions we are permitted to link to.`}
    >
      <h2>What this site is</h2>
      <p>
        We publish original editorial writing about films, alongside accurate metadata, so that a
        reader can decide what to watch and understand why we recommend it. The catalogue is
        curated: not everything belongs here, and we would rather publish twenty films properly than
        two thousand carelessly.
      </p>

      <h2>Our writing</h2>
      <p>
        Every review is written for this site. We do not copy synopses, reviews, or artwork from
        other publications. Where we reference a film&apos;s plot, we describe it in our own words.
        When we use an image, we record its source and credit it.
      </p>
      <p>
        We do not publish a review until a human has finished it. There is no automatic generation
        of editorial copy, and no placeholder text is presented as if it were a real assessment.
      </p>

      <h2>How we score films</h2>
      <p>
        Scores are <strong>editorial scores</strong>, awarded on a documented{" "}
        <strong>0–10 scale</strong>. They represent the opinion of the reviewer who watched the
        film, and nothing else.
      </p>
      <ul>
        <li>They are not user ratings, and we do not solicit votes.</li>
        <li>
          They are not aggregates from other websites, and we never merge a score from elsewhere
          into ours.
        </li>
        <li>Where a score appears, its scale is shown with it, so a number is never ambiguous.</li>
        <li>
          If a film has no score, that means we chose not to give one — not that the score is zero.
        </li>
      </ul>

      <h2>How we choose distribution links</h2>
      <p>
        This is the part of the site we are most careful about. A film being available somewhere on
        the internet does not mean we are allowed to point at it.
      </p>
      <p>
        Before a link appears publicly, the person managing the catalogue records an{" "}
        <strong>authorization basis</strong> — for example a public-domain determination for a
        relevant territory, an applicable open licence, a distribution agreement, written
        permission, or a publisher-authorized distribution page. A private reference for that basis
        is stored alongside it.
      </p>
      <p>
        The system enforces this: a link without a recorded and reviewed authorization basis cannot
        be activated, and only activated links are visible to the public. Links awaiting review, or
        that have been disabled or reported, are never shown.
      </p>
      <p>
        We do not scrape torrent indexes to find copies, we do not automate the acquisition of
        infringing material, and we do not rehost files. We are not a download host — we are a
        catalogue that, where it is appropriate, points to an authorized source.
      </p>

      <h2>What we do not claim</h2>
      <p>
        We do not host the files you may reach through an external link, and we cannot verify their
        contents. We do not claim a third-party destination is &ldquo;official&rdquo; or
        &ldquo;safe&rdquo; unless we have confirmed that. What we can tell you is that we recorded
        why we believed we were allowed to link there, and when we last checked it.
      </p>

      <h2>Advertising</h2>
      <p>
        Advertising, where it appears, is labelled as advertising and is visually separated from
        editorial content and from distribution links. We do not use ads that imitate download
        buttons, fake system dialogs, countdowns, or close controls.
      </p>

      <h2>Corrections and complaints</h2>
      <p>
        If we have got something wrong — a factual error, an incorrect score, a link that should not
        be there — tell us. Rights-holder complaints are handled through the{" "}
        <Link href="/copyright">copyright and takedown process</Link>, and a credible report about a
        link takes it out of public view while we investigate.
      </p>
    </ProsePage>
  );
}
