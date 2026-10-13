import type { Metadata } from "next";
import Link from "next/link";

import { PolicyContactNote, ProsePage } from "@/components/site/prose-page";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Copyright & takedown",
  description:
    "How to report content that infringes your rights, what we do when we receive a notice, and how quickly.",
  alternates: { canonical: "/copyright" },
};

/**
 * Copyright and takedown policy.
 *
 * This page is the public counterpart to the code: a credible report on a live
 * link removes it from public view immediately, before a human reviews the
 * queue. The page states that behaviour so it is a commitment rather than an
 * implementation detail.
 */
export default function CopyrightPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Copyright and takedown"
      summary="How to report infringing content, and what we do when you do."
      lastUpdated="11 October 2026"
    >
      <h2>Our position</h2>
      <p>
        We do not host film files. We do not knowingly link to unauthorized copies, and we do not
        accept a link simply because it is publicly reachable elsewhere. Every published link has a
        recorded authorization basis that was reviewed before the link went live.
      </p>
      <p>
        That said, we are a small operation and we can be wrong. If we are, we want to hear from you
        and we will act quickly.
      </p>

      <h2>How to send a notice</h2>
      <p>
        Email <a href={`mailto:${publicEnv.takedownEmail}`}>{publicEnv.takedownEmail}</a> with the
        subject line <strong>&ldquo;Takedown notice&rdquo;</strong>. To let us act without delay,
        please include:
      </p>
      <ul>
        <li>the exact URL on this site where the material appears;</li>
        <li>identification of the work you say is infringed;</li>
        <li>your name, organisation (if any), and a reply address;</li>
        <li>
          a statement that you hold the right concerned, or are authorized to act for the holder,
          and that you believe the use is not authorized;
        </li>
        <li>
          any supporting reference we can check — a distribution agreement, a rights registry entry,
          or equivalent.
        </li>
      </ul>
      <p>
        A statement does not need to be in any particular legal form. Clarity and verifiability
        matter more than formality.
      </p>

      <h2>What happens next</h2>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          <strong>Immediately.</strong> If your notice identifies a specific link, that link is
          taken out of public view as soon as the report is recorded — this happens automatically,
          before a person has read the notice.
        </li>
        <li>
          <strong>Within 3 working days.</strong> A person reviews the notice and the recorded
          authorization basis for the link.
        </li>
        <li>
          <strong>Outcome.</strong> If we cannot substantiate the authorization, the link is
          disabled permanently and the film page is updated. If we believe the authorization is
          valid, we will explain what it rests on and keep the link disabled while we discuss it
          with you.
        </li>
        <li>
          <strong>Record.</strong> The notice and our resolution are retained as part of the
          moderation record.
        </li>
      </ol>

      <h2>Counter-notices</h2>
      <p>
        If you are the operator of a distribution we have removed and you believe the removal was
        mistaken, write to the same address with evidence of your authorization. We will reinstate a
        link only when the basis is documented and reviewed.
      </p>

      <h2>Reporting something other than a rights issue</h2>
      <p>
        For a broken link, incorrect metadata, or a destination that looks unsafe, use the{" "}
        <strong>Report a problem</strong> form on the film page — it records the context
        automatically and is faster for those cases. You can also{" "}
        <Link href="/contact">contact us</Link> directly.
      </p>

      <h2>Repeat concerns</h2>
      <p>
        If we receive credible notices about the same provider repeatedly, we will stop publishing
        links to that provider rather than reviewing them case by case.
      </p>

      <PolicyContactNote purpose="copyright and takedown notices" />
    </ProsePage>
  );
}
