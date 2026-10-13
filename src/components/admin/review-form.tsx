"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions/types";
import type { Review } from "@/db/schema";

/**
 * Create/edit an editorial review.
 *
 * The body is stored as plain text and rendered as text nodes, so no HTML
 * sanitisation is involved — and none is possible to get wrong. The rating is
 * always paired with a scale and a source, so a number can never be displayed
 * without saying what it means.
 */
export function ReviewForm({
  action,
  movieId,
  review,
  canPublish,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  movieId: string;
  review?: Review;
  /** Editors cannot publish; the option is hidden rather than rejected on save. */
  canPublish: boolean;
  submitLabel: string;
}) {
  return (
    <ActionForm
      action={action}
      className="space-y-5"
      hiddenFields={{ movieId, ...(review ? { id: review.id } : {}) }}
      successMessage="Review saved."
    >
      {(state) => (
        <>
          <Alert tone="info" className="text-xs">
            Write this yourself. Reviews must be original — do not paraphrase or copy another
            publication&apos;s review, and do not use an automatically generated draft as the
            published text.
          </Alert>

          <Field label="Review title" htmlFor="reviewTitle" error={state.fieldErrors?.reviewTitle}>
            <Input
              id="reviewTitle"
              name="reviewTitle"
              maxLength={240}
              defaultValue={review?.reviewTitle ?? ""}
            />
          </Field>

          <Field
            label="Review body"
            htmlFor="body"
            required
            hint="At least 50 characters. Blank lines create paragraphs."
            error={state.fieldErrors?.body}
          >
            <Textarea id="body" name="body" rows={14} required defaultValue={review?.body ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Rating"
              htmlFor="rating"
              hint="0–10. Leave blank to publish without a score."
              error={state.fieldErrors?.rating}
            >
              <Input
                id="rating"
                name="rating"
                type="number"
                step="0.1"
                min={0}
                max={10}
                defaultValue={review?.rating ?? ""}
              />
            </Field>

            <Field
              label="Rating source"
              htmlFor="ratingSource"
              hint="What kind of score is this?"
              error={state.fieldErrors?.ratingSource}
            >
              <Select
                id="ratingSource"
                name="ratingSource"
                defaultValue={review?.ratingSource ?? "editorial"}
              >
                <option value="editorial">Editorial (our own score)</option>
                <option value="community">Community score</option>
                <option value="external_aggregate">External aggregate</option>
              </Select>
            </Field>

            <Field
              label="Reviewer name"
              htmlFor="reviewerName"
              required
              hint="Shown publicly."
              error={state.fieldErrors?.reviewerName}
            >
              <Input
                id="reviewerName"
                name="reviewerName"
                required
                maxLength={120}
                defaultValue={review?.reviewerName ?? ""}
              />
            </Field>
          </div>

          <Field label="Status" htmlFor="status" error={state.fieldErrors?.status}>
            <Select id="status" name="status" defaultValue={review?.status ?? "draft"}>
              <option value="draft">Draft</option>
              {canPublish ? <option value="published">Published</option> : null}
              {review ? <option value="archived">Archived</option> : null}
            </Select>
          </Field>

          {!canPublish ? (
            <p className="text-ink-subtle text-xs">
              Your role can save drafts. An admin or owner must publish the review.
            </p>
          ) : null}

          <SubmitButton>{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
