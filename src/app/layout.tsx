import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { PrivacyControls } from "@/components/site/privacy-controls";
import { publicEnv } from "@/lib/env";

import "./globals.css";

/**
 * Editorial serif for headings, neutral sans for everything else.
 * `display: swap` keeps first paint fast; the fallback metrics are close
 * enough that the swap does not shift layout noticeably.
 *
 * ---------------------------------------------------------------------------
 * Why the fonts are self-hosted rather than pulled from `next/font/google`
 * ---------------------------------------------------------------------------
 * `next/font/google` fetches the font files from Google at **build** time and
 * rewrites them into the bundle. That makes the build depend on Google being
 * reachable, and on a package (`@vercel/turbopack-next`) that is not a
 * declared dependency of `next` and is therefore absent from a plain
 * `pnpm install`. The visible symptom was a cold `.next` directory failing to
 * compile with:
 *
 *   Module not found: Can't resolve
 *     '@vercel/turbopack-next/internal/font/google/font'
 *
 * It was intermittent in a way that made it look transient — a second build
 * often succeeded — which is worse than a hard failure, because it invites the
 * conclusion that the build is merely flaky rather than non-deterministic.
 *
 * Self-hosting removes all of it: the bytes are in the repository, the build is
 * hermetic, and at runtime the browser makes no third-party connection for type
 * (one fewer DNS lookup, TLS handshake and third-party request, which is also
 * the privacy-conscious default the specification asks for).
 *
 * Both files are the **latin** subset, matching the previous
 * `subsets: ["latin"]` exactly — no change in glyph coverage.
 *
 * Source: Google Fonts. Inter and Fraunces are both licensed under the SIL Open
 * Font License 1.1, which permits redistribution, so vendoring them is allowed.
 * If these are ever replaced, replace the `.woff2` files here and keep this note
 * accurate.
 */
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

const fraunces = localFont({
  src: "./fonts/fraunces-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: `${publicEnv.siteName} — Film discovery and editorial reviews`,
    template: `%s · ${publicEnv.siteName}`,
  },
  description: publicEnv.siteDescription,
  applicationName: publicEnv.siteName,
  openGraph: {
    type: "website",
    siteName: publicEnv.siteName,
    title: publicEnv.siteName,
    description: publicEnv.siteDescription,
    url: publicEnv.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: publicEnv.siteName,
    description: publicEnv.siteDescription,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="focus:bg-accent focus:text-accent-ink sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>

        <SiteHeader siteName={publicEnv.siteName} />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter />
        <PrivacyControls />
      </body>
    </html>
  );
}
