import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy.
 *
 * ---------------------------------------------------------------------------
 * Why there is no nonce here
 * ---------------------------------------------------------------------------
 * The textbook policy for a Next.js app uses a per-request nonce. The catch is
 * that Next.js can only stamp its bootstrap scripts with a nonce on routes it
 * renders *dynamically* — reading `headers()` in a page opts that route out of
 * static generation. Applying a nonce globally therefore converts the whole
 * public catalogue from ISR to per-request rendering, which is a direct cost to
 * TTFB and Core Web Vitals on exactly the pages that matter most.
 *
 * The trade-off taken here is deliberate and documented in docs/security.md:
 *
 *   - `script-src` allows `'unsafe-inline'`, which Next.js needs for its inline
 *     hydration bootstrap. This is the weakest directive in the policy.
 *   - Everything else is locked down hard: no plugins, no framing, no form
 *     posts off-origin, no `<base>` hijacking, and connect/img restricted.
 *
 * The residual risk is bounded by the rest of the architecture: no user-supplied
 * HTML is ever rendered (review and synopsis text are plain text rendered as
 * React text nodes), any rich text that is stored is sanitised through a strict
 * allowlist, and React escapes interpolated values by default. In other words,
 * there is no known path to inject a script tag in the first place.
 *
 * The upgrade path — move `/admin/*` (already dynamic) to a nonce policy, then
 * migrate the public routes to a hash-based policy — is written up in
 * docs/security.md.
 * ---------------------------------------------------------------------------
 */

const isDevelopment = process.env.NODE_ENV !== "production";

function buildCsp(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      // Turbopack's dev server evaluates modules at runtime.
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(isDevelopment ? ["ws:", "wss:"] : [])],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    // Only in production: dev runs over plain http on localhost.
    ...(isDevelopment ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([directive, values]) =>
      values.length > 0 ? `${directive} ${values.join(" ")}` : directive,
    )
    .join("; ");
}

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", buildCsp());
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on document requests only. Static assets, the image optimiser and the
     * generated robots/sitemap responses are skipped — they are not documents
     * and the headers are applied by next.config.ts instead.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
