import type { Metadata } from "next";

import { MovieForm } from "@/components/admin/movie-form";
import { Alert } from "@/components/ui/feedback";
import { listAdminGenres } from "@/db/queries/admin";
import { createMovieAction } from "@/lib/actions/movies";
import { requirePermission } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New film" };

/**
 * Create a film.
 *
 * The record is always created as a draft — publishing is a separate,
 * permissioned action that runs the readiness check.
 */
export default async function NewMoviePage() {
  await requirePermission("movie:write", "/admin/movies/new");

  const genres = await listAdminGenres();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-heading text-ink font-semibold">New film</h1>
        <p className="text-ink-muted mt-2 text-sm">
          The record is saved as a draft. You can add a review and authorized links, then publish it
          from the film page.
        </p>
      </header>

      {genres.length === 0 ? (
        <Alert tone="warning" title="No genres exist yet">
          A film cannot be published without at least one genre. Create genres first — the record
          can still be saved as a draft.
        </Alert>
      ) : null}

      <MovieForm action={createMovieAction} genres={genres} submitLabel="Create draft" />
    </div>
  );
}
