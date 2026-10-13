import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/site/prose-page";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach us about the catalogue, corrections, rights issues or partnerships.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <ProsePage
      eyebrow="Contact"
      title="Contact us"
      summary="We read everything that comes in. Rights-holder and takedown enquiries are prioritised."
    >
      <h2>Rights, takedowns and complaints</h2>
      <p>
        If you believe something on this site infringes your rights, or that a link should not be
        published, use the dedicated process on the{" "}
        <Link href="/copyright">copyright and takedown</Link> page. That route is monitored and has
        a defined response time.
      </p>
      <p>
        Email: <a href={`mailto:${publicEnv.takedownEmail}`}>{publicEnv.takedownEmail}</a>
      </p>

      <h2>Corrections and content problems</h2>
      <p>
        Spotted an error in a review, a wrong year, or a link that no longer works? Every film page
        has a <strong>Report a problem</strong> form at the bottom which records the issue against
        that specific film or link. That is the fastest route, because it captures the context we
        need automatically.
      </p>

      <h2>General enquiries</h2>
      <p>
        For anything else — editorial, partnerships, or press — email{" "}
        <a href={`mailto:${publicEnv.contactEmail}`}>{publicEnv.contactEmail}</a>.
      </p>

      <h2>What to include</h2>
      <ul>
        <li>The exact page URL, if your enquiry is about a specific film or link.</li>
        <li>A clear description of the problem or request.</li>
        <li>
          For rights enquiries: the work concerned, the right you hold, and how we can verify it.
        </li>
      </ul>

      <h2>What we cannot do</h2>
      <p>
        We cannot supply film files, provide download links that are not already published, or
        mediate licensing disputes between third parties. We do not host any film files.
      </p>
    </ProsePage>
  );
}
