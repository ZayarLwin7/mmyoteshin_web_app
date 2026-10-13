import type { Metadata } from "next";

import { ConfirmAction } from "@/components/admin/confirm-action";
import { GenreForm } from "@/components/admin/genre-form";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { listAdminGenres } from "@/db/queries/admin";
import { createGenreAction, deleteGenreAction, updateGenreAction } from "@/lib/actions/genres";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Genres" };

export default async function AdminGenresPage() {
  await requirePermission("genre:write", "/admin/genres");

  const genres = await listAdminGenres();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-heading text-ink font-semibold">Genres</h1>
        <p className="text-ink-muted mt-2 text-sm">
          Genres organise the catalogue and drive the genre collection pages.
        </p>
      </header>

      <section
        aria-labelledby="new-genre-heading"
        className="rounded-panel border-line bg-surface border p-5"
      >
        <h2 id="new-genre-heading" className="text-ink mb-4 text-base font-semibold">
          Add a genre
        </h2>
        <GenreForm action={createGenreAction} submitLabel="Create genre" />
      </section>

      <section aria-labelledby="all-genres-heading" className="space-y-4">
        <h2 id="all-genres-heading" className="text-ink text-base font-semibold">
          All genres ({genres.length})
        </h2>

        {genres.length === 0 ? (
          <Alert tone="info">No genres yet. Create at least one before publishing a film.</Alert>
        ) : (
          <ul className="space-y-4">
            {genres.map((genre) => (
              <li key={genre.id} className="rounded-panel border-line bg-surface border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-ink font-medium">{genre.name}</p>
                    <p className="text-ink-subtle font-mono text-xs">/genres/{genre.slug}</p>
                  </div>
                  <Badge tone={genre.movieCount > 0 ? "accent" : "neutral"}>
                    {genre.movieCount} film{genre.movieCount === 1 ? "" : "s"}
                  </Badge>
                </div>

                <details className="mt-4">
                  <summary className="text-accent cursor-pointer text-sm">Edit</summary>
                  <div className="mt-4">
                    <GenreForm action={updateGenreAction} genre={genre} submitLabel="Save genre" />
                  </div>
                </details>

                <div className="mt-4">
                  {genre.movieCount > 0 ? (
                    <p className="text-ink-subtle text-xs">
                      Cannot be deleted while films are assigned to it. Remove it from those films
                      first.
                    </p>
                  ) : (
                    <ConfirmAction
                      action={deleteGenreAction}
                      hiddenFields={{ id: genre.id }}
                      label="Delete genre"
                      confirmLabel="Yes, delete permanently"
                      description="This permanently removes the genre. It is not assigned to any film, so no film page will change."
                      variant="danger"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
