import type { NextConfig } from "next";

/**
 * Image hosts are restricted to an explicit allowlist. Poster/backdrop URLs are
 * authored by administrators, but the optimiser is still locked down so a bad
 * or compromised record cannot turn the site into an open image proxy.
 *
 * Posters served from `public/posters/` need no entry here: a site-relative
 * path is read from our own filesystem and never leaves the origin. This list
 * only governs *remote* artwork.
 */
function imageRemotePatterns() {
  const raw = process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "";
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.flatMap((entry) => {
    try {
      const url = new URL(entry);
      if (url.protocol !== "https:") return [];
      const pathname = url.pathname === "/" ? "/**" : `${url.pathname.replace(/\/$/, "")}/**`;
      return [
        {
          protocol: "https" as const,
          hostname: url.hostname,
          pathname,
        },
      ];
    } catch {
      return [];
    }
  });
}

/**
 * Static security headers.
 *
 * The Content-Security-Policy is applied per response in `src/middleware.ts`.
 * It is deliberately *nonce-free* so that the public catalogue can stay on ISR
 * instead of being forced into per-request rendering. The reasoning, the
 * residual risk and the upgrade path are documented in `src/middleware.ts` and
 * in `docs/security.md`.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
   * Next 16 blocks cross-origin requests to dev resources (`/_next/*`) by
   * default, and it treats a request from `127.0.0.1` as cross-origin because
   * the dev server advertises itself as `localhost`.
   *
   * That is not academic: Playwright drives the end-to-end suite against
   * `http://127.0.0.1:3000`, so without this entry the HMR runtime and the
   * client chunks are refused, the page never hydrates, and every interactive
   * control silently stops working — the mobile menu toggle, `aria-expanded`,
   * and the search box inside it. The failure looks like a broken component
   * but is a refused asset, which is why it only ever appeared in the test run
   * and never in a real browser.
   *
   * This is a development-only list. It grants nothing in production.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: imageRemotePatterns(),
    formats: ["image/avif", "image/webp"],
    // Poster cards are small; cap the variants we generate.
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1600, 1920],
    imageSizes: [96, 128, 160, 200, 256, 342],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Admin surfaces must never be indexed or cached by intermediaries.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
