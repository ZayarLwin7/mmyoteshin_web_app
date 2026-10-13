"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Poster/backdrop image with a real fallback.
 *
 * A missing or unreachable image is a normal condition in a catalogue — the
 * artwork may not be licensed yet, or a host may be briefly unavailable. Rather
 * than showing a broken image icon, we render a designed placeholder that keeps
 * the grid aligned and the page looking intentional.
 */

type PosterProps = {
  src: string | null | undefined;
  alt: string;
  /** Tailwind aspect-ratio class. Every poster slot uses the same frame so the grid stays uniform. */
  aspect?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Rendered inside the placeholder when there is no image. */
  fallbackLabel?: string;
  /**
   * How the image fits the (uniform) frame.
   *
   * `"cover"` (the default) — the image expands until it fills the frame,
   * cropping any overflow. Every card shares the same frame, so this is the
   * uniform "poster grid" look. A landscape source is cropped on its left and
   * right edges; that is the unavoidable cost of showing it in a portrait frame.
   *
   * `"contain"` — shows the whole image, letterboxed. Used for the hero backdrop,
   * where cropping the featured film's artwork would be worse than the bands.
   */
  wideFit?: "cover" | "contain";
};

export function Poster({
  src,
  alt,
  aspect = "aspect-[2/3]",
  sizes,
  priority = false,
  className,
  fallbackLabel,
  wideFit = "cover",
}: PosterProps) {
  const [failed, setFailed] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const showImage = Boolean(src) && !failed;
  const letterbox = wideFit === "contain" && isWide;

  return (
    <div
      className={cn("rounded-card bg-surface-raised relative overflow-hidden", aspect, className)}
    >
      {showImage ? (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          // Posters are decorative next to the card's own heading; the card
          // supplies the accessible name, so a duplicate alt here is noise.
          className={letterbox ? "object-contain" : "object-cover"}
          onLoad={(event) => {
            // `contain` letterboxes only artwork wider than tall; `cover`
            // fills the frame for everything else.
            if (wideFit !== "contain") return;
            const image = event.currentTarget;
            if (image.naturalWidth > image.naturalHeight) setIsWide(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(150deg,var(--color-surface-raised),var(--color-surface-sunken))] p-4 text-center"
        >
          <svg
            viewBox="0 0 24 24"
            className="text-ink-subtle size-7"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 5h16v14H4z M4 15l4.5-4.5 3 3L15 10l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {fallbackLabel ? (
            <span className="text-2xs text-ink-subtle font-medium tracking-wide uppercase">
              {fallbackLabel}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
