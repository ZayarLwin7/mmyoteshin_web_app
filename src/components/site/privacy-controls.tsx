"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { publicEnv } from "@/lib/env";
import { readAnalyticsConsent, writeAnalyticsConsent, type ConsentValue } from "@/lib/consent";
import { Button } from "@/components/ui/button";

/**
 * Privacy controls and analytics.
 *
 * Two deliberate choices:
 *
 *  1. Analytics is OFF unless NEXT_PUBLIC_ANALYTICS_ENABLED is true AND the
 *     visitor has actively accepted. No cookie is set, no identifier is stored,
 *     and the beacon carries no query string — search terms are never sent.
 *  2. The banner is only rendered when analytics is actually configured. A site
 *     that collects nothing does not nag its visitors about nothing.
 *
 * The decision is persisted in localStorage under a versioned key, so changing
 * the policy (bumping the version) re-asks everyone.
 */

type Consent = ConsentValue;

/**
 * Fired after this tab writes a decision.
 *
 * The browser only emits `storage` in *other* tabs, so without this the tab
 * that clicked "Allow" would keep reading its own stale snapshot.
 */
const CONSENT_CHANGED = "mmy:consent-changed";

function subscribeToConsent(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CONSENT_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CONSENT_CHANGED, onChange);
  };
}

/**
 * The stored decision, read as an external store.
 *
 * `useSyncExternalStore` is the supported way to read a browser store that does
 * not exist on the server: `getServerSnapshot` returns `null`, and React swaps
 * in the real value once hydration completes. Because it subscribes to
 * `storage`, revoking consent in one tab stops the beacon in every other tab.
 */
function useStoredConsent(): Consent | null {
  return useSyncExternalStore(subscribeToConsent, readAnalyticsConsent, () => null);
}

/**
 * `false` on the server and during hydration, `true` afterwards.
 *
 * Without this the banner would flash for a visitor who had already decided:
 * the first client render still sees the server snapshot (`null` consent), and
 * the stored value only arrives on the render that follows hydration.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function PrivacyControls() {
  const pathname = usePathname();
  const consent = useStoredConsent();
  const ready = useHydrated();

  const decide = useCallback((next: Consent) => {
    writeAnalyticsConsent(next);
    window.dispatchEvent(new Event(CONSENT_CHANGED));
  }, []);

  // Send one page-view beacon per navigation, only with consent.
  useEffect(() => {
    if (!publicEnv.analyticsEnabled || consent !== "granted") return;
    if (!publicEnv.analyticsEndpoint) return;
    // Admin pages are never measured.
    if (pathname.startsWith("/admin")) return;

    const payload = JSON.stringify({
      // Path only — never the query string, which could contain a search term.
      path: pathname,
      referrer: document.referrer ? new URL(document.referrer).hostname : null,
    });

    try {
      // `sendBeacon` survives the page being closed mid-navigation.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          publicEnv.analyticsEndpoint,
          new Blob([payload], { type: "application/json" }),
        );
      }
    } catch {
      // Measurement must never break navigation.
    }
  }, [pathname, consent]);

  if (!ready || !publicEnv.analyticsEnabled || consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-50 border-t px-4 py-4 shadow-lg sm:px-6"
    >
      <div className="container-page flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink-muted text-sm">
          We would like to count page views to understand which films people are looking for. This
          uses no cookies and stores no personal data, and search terms are never recorded.{" "}
          <Link href="/privacy" className="hover:text-accent underline underline-offset-2">
            Read the privacy notice
          </Link>
          .
        </p>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" onClick={() => decide("denied")}>
            No thanks
          </Button>
          <Button size="sm" onClick={() => decide("granted")}>
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}
