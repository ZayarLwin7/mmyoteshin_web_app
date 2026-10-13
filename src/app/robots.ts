import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/utils";

/**
 * robots.txt.
 *
 * Admin, API and search routes are disallowed. `X-Robots-Tag: noindex` is also
 * set on /admin/* in next.config.ts, so the exclusion holds even if a crawler
 * ignores this file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/search", "/search/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
