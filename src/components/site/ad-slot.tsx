"use client";

import { useEffect, useRef } from "react";

import { adsAreServable, publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

/**
 * Advertisement slot.
 *
 * Design rules this component enforces (spec §9 and §12):
 *
 *   - Nothing renders at all unless ads are explicitly enabled AND a client id
 *     is configured. A half-configured deploy shows no ad markup.
 *   - The slot is always labelled "Advertisement" so it can never be mistaken
 *     for editorial content or for a download control.
 *   - Space is reserved with a fixed minimum height, so a late-filling ad does
 *     not shift the page (CLS).
 *   - If the provider fails or is blocked, the container collapses to a neutral
 *     labelled box rather than leaving a hole in the layout.
 *
 * The provider is not enabled until its account and site are approved — see
 * docs/content-operations.md.
 */

type AdFormat = "leaderboard" | "inline";

const FORMAT_CLASSES: Record<AdFormat, string> = {
  // 970×90-ish on desktop, 320×100 on mobile; reserved so nothing jumps.
  leaderboard: "min-h-[100px] sm:min-h-[90px]",
  inline: "min-h-[250px]",
};

export function AdSlot({
  format = "inline",
  className,
}: {
  format?: AdFormat;
  className?: string;
}) {
  const pushed = useRef(false);

  const slotId =
    format === "leaderboard" ? publicEnv.adSlots.leaderboard : publicEnv.adSlots.inline;

  useEffect(() => {
    if (!adsAreServable || !slotId || pushed.current) return;
    pushed.current = true;

    try {
      // Standard provider bootstrap. Wrapped because a blocked script throws.
      const target = window as unknown as { adsbygoogle?: unknown[] };
      target.adsbygoogle = target.adsbygoogle ?? [];
      target.adsbygoogle.push({});
    } catch {
      // Ads are best-effort by design; a failure must never break the page.
    }
  }, [slotId]);

  if (!adsAreServable || !slotId) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={cn("my-8 flex flex-col items-center gap-2", className)}
    >
      <span className="text-2xs text-ink-subtle tracking-[0.16em] uppercase">Advertisement</span>

      <div
        className={cn(
          "border-line bg-surface-sunken flex w-full max-w-4xl items-center justify-center overflow-hidden rounded-lg border",
          FORMAT_CLASSES[format],
        )}
      >
        {/* The provider fills this element. */}
        <ins
          className="adsbygoogle block w-full"
          style={{ display: "block" }}
          data-ad-client={publicEnv.adClient}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
