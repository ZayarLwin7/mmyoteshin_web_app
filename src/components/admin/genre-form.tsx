"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions/types";
import type { Genre } from "@/db/schema";

/**
 * Only the fields this form actually reads.
 *
 * Narrowing the prop keeps the form usable with list queries that do not
 * select every column — `listAdminGenres` returns a count instead of the full
 * row, and demanding the whole `Genre` type would force that query to fetch
 * columns nobody displays.
 */
type GenreFormValues = Pick<Genre, "id" | "name" | "slug" | "description" | "displayOrder">;

/** Create or edit a genre. */
export function GenreForm({
  action,
  genre,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  genre?: GenreFormValues;
  submitLabel: string;
}) {
  return (
    <ActionForm
      action={action}
      className="space-y-4"
      hiddenFields={genre ? { id: genre.id } : undefined}
      successMessage="Genre saved."
    >
      {(state) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" required error={state.fieldErrors?.name}>
              <Input
                id="name"
                name="name"
                required
                maxLength={80}
                defaultValue={genre?.name ?? ""}
              />
            </Field>

            <Field
              label="Slug"
              htmlFor="slug"
              hint="Generated from the name when blank."
              error={state.fieldErrors?.slug}
            >
              <Input id="slug" name="slug" maxLength={96} defaultValue={genre?.slug ?? ""} />
            </Field>
          </div>

          <Field label="Description" htmlFor="description" error={state.fieldErrors?.description}>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={genre?.description ?? ""}
            />
          </Field>

          <Field
            label="Display order"
            htmlFor="displayOrder"
            hint="Lower numbers appear first."
            error={state.fieldErrors?.displayOrder}
          >
            <Input
              id="displayOrder"
              name="displayOrder"
              type="number"
              min={-1000}
              max={1000}
              defaultValue={genre?.displayOrder ?? 0}
            />
          </Field>

          <SubmitButton size="sm">{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
