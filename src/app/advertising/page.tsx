import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/site/prose-page";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Advertising disclosure",
  description:
    "How advertising works on this site, how it is labelled, and the placements we refuse to use.",
  alternates: { canonical: "/advertising" },
};

/**
 * Advertising disclosure.
 *
 * The page states the rules the AdSlot component enforces: labelled, reserved
 * space, never imitating a download control, and disabled until a provider
 * account and site are approved.
 */
export default function AdvertisingPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Advertising disclosure"
      summary="What advertising looks like here, and what it will never look like."
      lastUpdated="11 October 2026"
    >
      <h2>Our approach</h2>
      <p>
        This site may display advertising to fund the editorial work. Advertising is always visually
        separated from editorial content and from distribution links, and it is always labelled
        &ldquo;Advertisement&rdquo;.
      </p>

      <h2>How ads are labelled</h2>
      <p>
        Every advertising slot carries a visible <strong>Advertisement</strong> label directly above
        it. The label is part of the page, not something an ad can cover or hide.
      </p>

      <h2>What we will not do</h2>
      <p>
        We consider the following practices deceptive, and we do not use them regardless of what a
        network permits:
      </p>
      <ul>
        <li>ads designed to look like download buttons or file links;</li>
        <li>ads that imitate system dialogs, warnings, or error messages;</li>
        <li>
          fake download progress bars, fake countdowns, or fake &ldquo;your download is ready&rdquo;
          prompts;
        </li>
        <li>forced redirects, pop-unders, and redirect chains;</li>
        <li>misleading or deliberately hard-to-find close controls;</li>
        <li>layouts that make an ad easy to click by accident.</li>
      </ul>
      <p>
        If you ever see something on this site that looks like one of the above, please{" "}
        <Link href="/contact">tell us</Link> — it is a bug we want to know about.
      </p>

      <h2>Placement and layout</h2>
      <p>
        Ad slots are limited in number and reserve their space when the page loads, so content does
        not jump around as ads arrive. The site is fully usable when advertising is disabled or when
        a blocker prevents ads from loading — nothing breaks and no content is withheld.
      </p>

      <h2>Approval and compliance</h2>
      <p>
        Advertising is disabled by default and remains disabled until the network account and this
        site have been approved under the provider&apos;s current policies. We do not enable
        advertising before that, and we do not promise any revenue figures.
      </p>

      <h2>Editorial independence</h2>
      <p>
        Advertisers have no influence over what we review, how we score a film, or which
        distribution links we publish. A link appears on a film page only because it has a recorded
        authorization basis, never because someone paid for it.
      </p>

      <h2>Affiliate links</h2>
      <p>
        This site does not currently use affiliate links. If that ever changes, any page carrying an
        affiliate link will say so explicitly, next to the link, in plain language.
      </p>

      <h2>Contact</h2>
      <p>
        Advertising enquiries:{" "}
        <a href={`mailto:${publicEnv.contactEmail}`}>{publicEnv.contactEmail}</a>
      </p>
    </ProsePage>
  );
}
