import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/ui/feedback";
import { listGenresWithCounts } from "@/db/queries/public";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Genres",
  description: "Browse the catalogue by genre.",
  alternates: { canonical: "/genres" },
};

export default async function GenresPage() {
  const genres = await listGenresWithCounts();
  const populated = genres.filter((genre) => genre.movieCount > 0);

  return (
    <div className="container-page py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-eyebrow mb-2">Browse</p>
        <h1 className="text-title text-ink font-semibold">Genres</h1>
        <p className="text-ink-muted mt-3 text-sm">
          Every genre with at least one published film. Counts reflect what is live right now.
        </p>
      </header>

      {populated.length === 0 ? (
        <EmptyState
          title="No genres yet"
          description="Genres appear here once films have been published into them."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {populated.map((genre) => (
            <li key={genre.id}>
              <Link
                href={`/genres/${genre.slug}`}
                className="rounded-panel border-line bg-surface hover:border-accent block h-full border p-5 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-heading text-ink font-semibold">{genre.name}</h2>
                  <span className="text-ink-subtle text-xs">
                    {genre.movieCount} film{genre.movieCount === 1 ? "" : "s"}
                  </span>
                </div>
                {genre.description ? (
                  <p className="text-ink-muted mt-2 text-sm">{genre.description}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
