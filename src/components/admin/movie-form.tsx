"use client";

import { useState } from "react";

import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions/types";
import type { Genre, Movie } from "@/db/schema";

/**
 * Film and series create/edit form.
 *
 * `status` is intentionally not editable here. New records are always created
 * as drafts, and moving a record to published or archived goes through the
 * dedicated actions on the film page — which run the publication-eligibility
 * check and write an audit entry.
 */

type MovieFormValues = Pick<
  Movie,
  | "title"
  | "slug"
  | "originalTitle"
  | "releaseYear"
  | "releaseDate"
  | "runtimeMinutes"
  | "contentKind"
  | "seasonCount"
  | "episodeCount"
  | "synopsis"
  | "editorialNote"
  | "posterUrl"
  | "backdropUrl"
  | "imageCredit"
  | "languageCode"
  | "country"
  | "contentRating"
  | "metaTitle"
  | "metaDescription"
  | "featured"
  | "curationWeight"
>;

export function MovieForm({
  action,
  genres,
  movie,
  selectedGenreIds,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  genres: Pick<Genre, "id" | "name">[];
  movie?: MovieFormValues;
  selectedGenreIds?: string[];
  submitLabel: string;
}) {
  const selected = new Set(selectedGenreIds ?? []);

  /**
   * Which kind the record is, so the season and episode fields only appear for
   * a series.
   *
   * The hidden-by-default fields are still *submitted* — a hidden input is not
   * submitted, so a blank season count arrives as `null` and the schema's
   * "a series needs a season count" rule fires with a field error rather than
   * silently saving. The reveal is a convenience, never the control: the same
   * rule is enforced by `movieInputSchema` and by the
   * `movies_series_requires_seasons` CHECK constraint.
   */
  const [contentKind, setContentKind] = useState<Movie["contentKind"]>(
    movie?.contentKind ?? "movie",
  );
  const isSeries = contentKind === "series";

  return (
    <ActionForm action={action} className="space-y-10" successMessage="Saved.">
      {(state) => (
        <>
          {/* ---- Identity ------------------------------------------------ */}
          <fieldset className="space-y-5">
            <legend className="text-ink mb-1 text-base font-semibold">Identity</legend>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Title" htmlFor="title" required error={state.fieldErrors?.title}>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={300}
                  defaultValue={movie?.title ?? ""}
                />
              </Field>

              <Field
                label="Original title"
                htmlFor="originalTitle"
                hint="Leave blank if it matches the title."
                error={state.fieldErrors?.originalTitle}
              >
                <Input
                  id="originalTitle"
                  name="originalTitle"
                  maxLength={300}
                  defaultValue={movie?.originalTitle ?? ""}
                />
              </Field>
            </div>

            <Field
              label="URL slug"
              htmlFor="slug"
              hint="Generated from the title when left blank. Changing it changes the public URL."
              error={state.fieldErrors?.slug}
            >
              <Input id="slug" name="slug" maxLength={120} defaultValue={movie?.slug ?? ""} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                label="Release year"
                htmlFor="releaseYear"
                error={state.fieldErrors?.releaseYear}
              >
                <Input
                  id="releaseYear"
                  name="releaseYear"
                  type="number"
                  min={1888}
                  max={2200}
                  defaultValue={movie?.releaseYear ?? ""}
                />
              </Field>

              <Field
                label="Release date"
                htmlFor="releaseDate"
                hint="YYYY-MM-DD"
                error={state.fieldErrors?.releaseDate}
              >
                <Input
                  id="releaseDate"
                  name="releaseDate"
                  placeholder="1994-10-14"
                  defaultValue={movie?.releaseDate ?? ""}
                />
              </Field>

              <Field
                label="Runtime (minutes)"
                htmlFor="runtimeMinutes"
                hint={isSeries ? "Films only" : undefined}
                error={state.fieldErrors?.runtimeMinutes}
              >
                <Input
                  id="runtimeMinutes"
                  name="runtimeMinutes"
                  type="number"
                  min={1}
                  max={1440}
                  defaultValue={movie?.runtimeMinutes ?? ""}
                  disabled={isSeries}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                label="Type"
                htmlFor="contentKind"
                hint="Series live at /series, films at /movies."
                error={state.fieldErrors?.contentKind}
              >
                <select
                  id="contentKind"
                  name="contentKind"
                  value={contentKind}
                  onChange={(event) => setContentKind(event.target.value as Movie["contentKind"])}
                  className="border-line-strong bg-surface-sunken text-ink h-10 rounded-lg border px-3 text-sm"
                >
                  <option value="movie">Film</option>
                  <option value="series">Series</option>
                </select>
              </Field>

              {/*
                Kept mounted and merely hidden rather than conditionally
                rendered: a removed input is not submitted, and the server-side
                schema is what actually enforces the rule, so this is only the
                editor-facing hint that the two counts belong to a series.
              */}
              <div className={isSeries ? undefined : "hidden"}>
                <Field
                  label="Seasons"
                  htmlFor="seasonCount"
                  hint="Required before a series can be published."
                  error={state.fieldErrors?.seasonCount}
                >
                  <Input
                    id="seasonCount"
                    name="seasonCount"
                    type="number"
                    min={1}
                    max={200}
                    defaultValue={movie?.seasonCount ?? ""}
                  />
                </Field>
              </div>

              <div className={isSeries ? undefined : "hidden"}>
                <Field
                  label="Episodes"
                  htmlFor="episodeCount"
                  hint="Total across all seasons. Optional."
                  error={state.fieldErrors?.episodeCount}
                >
                  <Input
                    id="episodeCount"
                    name="episodeCount"
                    type="number"
                    min={1}
                    max={5000}
                    defaultValue={movie?.episodeCount ?? ""}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* ---- Classification ------------------------------------------ */}
          <fieldset className="space-y-5">
            <legend className="text-ink mb-1 text-base font-semibold">Classification</legend>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                label="Language code"
                htmlFor="languageCode"
                hint="ISO 639-1, e.g. en"
                error={state.fieldErrors?.languageCode}
              >
                <Input
                  id="languageCode"
                  name="languageCode"
                  maxLength={12}
                  defaultValue={movie?.languageCode ?? ""}
                />
              </Field>

              <Field label="Country" htmlFor="country" error={state.fieldErrors?.country}>
                <Input
                  id="country"
                  name="country"
                  maxLength={80}
                  defaultValue={movie?.country ?? ""}
                />
              </Field>

              <Field
                label="Content rating"
                htmlFor="contentRating"
                hint="As certified, e.g. PG, 15"
                error={state.fieldErrors?.contentRating}
              >
                <Input
                  id="contentRating"
                  name="contentRating"
                  maxLength={24}
                  defaultValue={movie?.contentRating ?? ""}
                />
              </Field>
            </div>

            <div>
              <p className="text-ink mb-2 text-sm font-medium">Genres</p>
              {genres.length === 0 ? (
                <p className="text-ink-subtle text-xs">
                  No genres exist yet. Create one under Genres before publishing.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {genres.map((genre) => (
                    <Checkbox
                      key={genre.id}
                      id={`genre-${genre.id}`}
                      name="genreIds"
                      value={genre.id}
                      label={genre.name}
                      defaultChecked={selected.has(genre.id)}
                    />
                  ))}
                </div>
              )}
              {state.fieldErrors?.genreIds ? (
                <p role="alert" className="text-danger mt-2 text-xs">
                  {state.fieldErrors.genreIds}
                </p>
              ) : null}
            </div>
          </fieldset>

          {/* ---- Editorial ------------------------------------------------ */}
          <fieldset className="space-y-5">
            <legend className="text-ink mb-1 text-base font-semibold">Editorial</legend>

            <Field
              label="Synopsis"
              htmlFor="synopsis"
              hint="Original wording only — never copied from another site. Plain text; blank lines create paragraphs."
              error={state.fieldErrors?.synopsis}
            >
              <Textarea
                id="synopsis"
                name="synopsis"
                rows={6}
                defaultValue={movie?.synopsis ?? ""}
              />
            </Field>

            <Field
              label="Internal editorial note"
              htmlFor="editorialNote"
              hint="Not shown publicly. Use for production notes and sourcing reminders."
              error={state.fieldErrors?.editorialNote}
            >
              <Textarea
                id="editorialNote"
                name="editorialNote"
                rows={3}
                defaultValue={movie?.editorialNote ?? ""}
              />
            </Field>
          </fieldset>

          {/* ---- Artwork -------------------------------------------------- */}
          <fieldset className="space-y-5">
            <legend className="text-ink mb-1 text-base font-semibold">Artwork</legend>

            <p className="text-ink-subtle text-xs">
              Only use artwork you have permission to display. The host must also be present in
              <code className="bg-surface-raised mx-1 rounded px-1 py-0.5">
                NEXT_PUBLIC_IMAGE_HOSTS
              </code>
              or the image will not load.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Poster URL" htmlFor="posterUrl" error={state.fieldErrors?.posterUrl}>
                <Input
                  id="posterUrl"
                  name="posterUrl"
                  type="url"
                  placeholder="https://…"
                  defaultValue={movie?.posterUrl ?? ""}
                />
              </Field>

              <Field
                label="Backdrop URL"
                htmlFor="backdropUrl"
                error={state.fieldErrors?.backdropUrl}
              >
                <Input
                  id="backdropUrl"
                  name="backdropUrl"
                  type="url"
                  placeholder="https://…"
                  defaultValue={movie?.backdropUrl ?? ""}
                />
              </Field>
            </div>

            <Field
              label="Artwork credit"
              htmlFor="imageCredit"
              hint="Shown on the film page."
              error={state.fieldErrors?.imageCredit}
            >
              <Input
                id="imageCredit"
                name="imageCredit"
                maxLength={300}
                defaultValue={movie?.imageCredit ?? ""}
              />
            </Field>
          </fieldset>

          {/* ---- Curation & SEO ------------------------------------------- */}
          <fieldset className="space-y-5">
            <legend className="text-ink mb-1 text-base font-semibold">Curation and search</legend>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Curation weight"
                htmlFor="curationWeight"
                hint="Higher sorts earlier in the Editor's picks rail. 0 excludes it."
                error={state.fieldErrors?.curationWeight}
              >
                <Input
                  id="curationWeight"
                  name="curationWeight"
                  type="number"
                  min={-1000}
                  max={1000}
                  defaultValue={movie?.curationWeight ?? 0}
                />
              </Field>

              <div className="flex items-end pb-2">
                <Checkbox
                  id="featured"
                  name="featured"
                  label="Featured"
                  hint="Eligible for the home hero."
                  defaultChecked={movie?.featured ?? false}
                />
              </div>
            </div>

            <Field
              label="Meta title"
              htmlFor="metaTitle"
              hint="Overrides the page title in search results. Leave blank to use the film title."
              error={state.fieldErrors?.metaTitle}
            >
              <Input
                id="metaTitle"
                name="metaTitle"
                maxLength={200}
                defaultValue={movie?.metaTitle ?? ""}
              />
            </Field>

            <Field
              label="Meta description"
              htmlFor="metaDescription"
              hint="Aim for 120–160 characters."
              error={state.fieldErrors?.metaDescription}
            >
              <Textarea
                id="metaDescription"
                name="metaDescription"
                rows={3}
                maxLength={320}
                defaultValue={movie?.metaDescription ?? ""}
              />
            </Field>
          </fieldset>

          <div className="border-line flex items-center gap-4 border-t pt-6">
            <SubmitButton>{submitLabel}</SubmitButton>
            <p className="text-ink-subtle text-xs">
              Saving keeps the current publication status. Publishing is a separate step.
            </p>
          </div>
        </>
      )}
    </ActionForm>
  );
}
