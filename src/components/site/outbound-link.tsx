"use client";

import { useCallback } from "react";

import { readAnalyticsConsent } from "@/lib/consent";
import { publicEnv } from "@/lib/env";

/**
 * Outbound link to a third-party distribution page.
 *
 * Three things this component guarantees:
 *
 *  1. `rel="noopener noreferrer nofollow"` — the destination cannot reach back
 *     into our window, and we do not pass link equity to a download host.
 *  2. A visible external-link affordance, so a click never surprises anyone.
 *  3. Click measurement only when analytics is enabled AND the visitor has
 *     consented, and only the *host* is sent — never the full URL, which could
 *     contain a per-user token from the provider.
 */
export function OutboundLink({
  href,
  host,
  children,
  className,
}: {
  href: string;
  host: string;
  children: React.ReactNode;
  className?: string;
}) {
  const handleClick = useCallback(() => {
    if (!publicEnv.analyticsEnabled || !publicEnv.analyticsEndpoint) return;
    if (readAnalyticsConsent() !== "granted") return;

    const payload = JSON.stringify({ event: "outbound", host });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          publicEnv.analyticsEndpoint,
          new Blob([payload], { type: "application/json" }),
        );
      }
    } catch {
      // Measurement must never interfere with the navigation.
    }
  }, [host]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={handleClick}
      className={className}
    >
      {children}
      <span className="sr-only"> (opens in a new tab on an external site)</span>
    </a>
  );
}
