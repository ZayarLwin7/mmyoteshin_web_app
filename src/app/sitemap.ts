import type { MetadataRoute } from "next";

import { listGenresWithCounts, listPublishedSlugsForSitemap } from "@/db/queries/public";
import { absoluteUrl } from "@/lib/utils";

/**
 * XML sitemap.
 *
 * Contains canonical, published URLs only. Draft and archived films, admin
 * routes, search results and filtered catalogue views are all excluded — the
 * latter because they are canonicalised to the unfiltered listing and would
 * otherwise compete with it.
 *
 * Regenerated hourly; publishing a film also revalidates this path directly.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [movies, genres] = await Promise.all([
    listPublishedSlugsForSitemap(),
    listGenresWithCounts(),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/movies"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/genres"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/years"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/copyright"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    {
      url: absoluteUrl("/advertising"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  return [
    ...staticRoutes,

    ...movies.map((movie) => ({
      url: absoluteUrl(`/movies/${movie.slug}`),
      lastModified: movie.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),

    // Only genres that actually contain a published film.
    ...genres
      .filter((genre) => genre.movieCount > 0)
      .map((genre) => ({
        url: absoluteUrl(`/genres/${genre.slug}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
  ];
}
