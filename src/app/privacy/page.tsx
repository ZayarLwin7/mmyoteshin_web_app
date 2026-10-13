import type { Metadata } from "next";

import { PolicyContactNote, ProsePage } from "@/components/site/prose-page";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What data this site collects, why, how long it is kept, and how to exercise your rights.",
  alternates: { canonical: "/privacy" },
};

/**
 * Privacy notice.
 *
 * Written to match what the code actually does, not an aspirational policy:
 * analytics is off by default and consent-gated, no cookies are set by us,
 * reporter IPs are stored only as a keyed hash, and moderation notes are never
 * published.
 */
export default function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy notice"
      summary="What we collect, why we collect it, and what we deliberately do not."
      lastUpdated="11 October 2026"
    >
      <h2>Summary</h2>
      <ul>
        <li>We do not require an account to browse, search, or read reviews.</li>
        <li>We do not set advertising or tracking cookies.</li>
        <li>Page-view analytics is off unless you actively allow it, and it uses no cookies.</li>
        <li>We never store your IP address in readable form.</li>
      </ul>

      <h2>What we collect, and when</h2>

      <h3>If you just browse</h3>
      <p>
        Nothing that identifies you is stored. Our servers process the request in the ordinary
        course of serving a page (IP address, user agent, timestamp) in transient logs used for
        security and reliability. We do not build a profile from this.
      </p>

      <h3>If you allow analytics</h3>
      <p>
        We count page views to understand which parts of the catalogue people actually use. When
        enabled and consented to:
      </p>
      <ul>
        <li>
          The <strong>page path</strong> is recorded — never the query string, so a search term you
          typed is never transmitted.
        </li>
        <li>
          The <strong>referring host</strong> is recorded, not the full referring URL.
        </li>
        <li>
          No cookie is set, no device fingerprint is taken, and no identifier is assigned to you.
        </li>
        <li>
          Outbound clicks on distribution links record only the <strong>destination host</strong>,
          never the full link.
        </li>
      </ul>
      <p>
        You can decline, and you can change your mind at any time by clearing the site&apos;s stored
        preference for this browser. Declining has no effect on what you can access.
      </p>

      <h3>If you submit a report</h3>
      <p>
        We store what you write, the reason you selected, the film or link concerned, and — if you
        provide one — your email address so we can reply. We also store a{" "}
        <strong>keyed cryptographic hash</strong> derived from your IP address. This exists solely
        to rate-limit abusive submissions and cannot be reversed into your address.
      </p>
      <p>
        Reports are not published. Moderation notes are internal and are never shown to the public
        or to the person who filed the report.
      </p>

      <h3>If you are an administrator</h3>
      <p>
        Administrator accounts hold an email address, a display name, a hashed password, and a role.
        Passwords are stored only as Argon2id hashes and are never logged. Privileged changes —
        publishing, archiving, activating or disabling links, resolving reports, changing roles —
        are recorded in an audit log with the acting account and a timestamp.
      </p>

      <h2>Cookies</h2>
      <p>
        We set exactly one cookie: a strictly-necessary session cookie for administrators, which is
        HTTP-only, same-site, and secure in production. It is not used for tracking and is not
        present for ordinary visitors.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell or rent personal data. Data is processed by our hosting and database
        providers strictly to run the service. Advertising, where enabled, is labelled, and we do
        not pass personal data to an ad network ourselves.
      </p>

      <h2>Retention</h2>
      <ul>
        <li>Rate-limit counters are deleted shortly after their window closes.</li>
        <li>
          Reports and their resolution notes are retained as a record of how complaints were
          handled.
        </li>
        <li>
          Audit entries are retained to preserve the integrity of the privileged-change record.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, or delete personal
        data we hold about you, and to object to certain processing. To make a request, contact us
        using the details below. Because we hold so little, we may need you to supply enough
        information for us to identify the record you mean.
      </p>

      <h2>Changes</h2>
      <p>
        If this notice changes materially we will update the date at the top. Where a change affects
        what we collect, we will ask for consent again rather than assuming the previous choice
        still applies.
      </p>

      <PolicyContactNote purpose="privacy questions and data requests" />
      <p className="mt-4 text-xs">
        This notice describes our practice; it is not legal advice. Operators deploying this site
        should have it reviewed for the jurisdictions they serve. See{" "}
        <strong>{publicEnv.siteName}</strong> documentation for the deployment checklist.
      </p>
    </ProsePage>
  );
}
