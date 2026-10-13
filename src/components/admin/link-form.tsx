"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions/types";
import type { DownloadLink } from "@/db/schema";

/**
 * Create/edit an external distribution link.
 *
 * The `status` selector is deliberately absent. A link created here always
 * starts in `pending_review`, and activation happens through the explicit
 * "Activate" action on the film page — which requires the `link:authorize`
 * permission and a recorded private reference.
 */

const BASES = [
  { value: "public_domain", label: "Public domain (verified for the relevant territory)" },
  { value: "open_license", label: "Open licence (attribution/terms satisfied)" },
  { value: "distribution_agreement", label: "Distribution agreement" },
  { value: "written_permission", label: "Written permission from the rights holder" },
  { value: "publisher_authorized_page", label: "Publisher-authorized distribution page" },
  { value: "other_documented", label: "Other — documented" },
] as const;

export function LinkForm({
  action,
  movieId,
  link,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  movieId: string;
  link?: DownloadLink;
  submitLabel: string;
}) {
  return (
    <ActionForm
      action={action}
      className="space-y-5"
      hiddenFields={{ movieId, ...(link ? { id: link.id } : {}) }}
      successMessage="Link saved in review. Activate it to make it public."
    >
      {(state) => (
        <>
          <Alert tone="info" className="text-xs">
            A link is never public until it is activated, and it cannot be activated without a
            recorded authorization basis <em>and</em> a private reference. The reference is stored
            for our records and is never returned to a public client.
          </Alert>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Provider name"
              htmlFor="providerName"
              required
              error={state.fieldErrors?.providerName}
            >
              <Input
                id="providerName"
                name="providerName"
                required
                maxLength={160}
                defaultValue={link?.providerName ?? ""}
                placeholder="e.g. Internet Archive"
              />
            </Field>

            <Field
              label="Label"
              htmlFor="label"
              required
              hint="Shown on the film page."
              error={state.fieldErrors?.label}
            >
              <Input
                id="label"
                name="label"
                required
                maxLength={200}
                defaultValue={link?.label ?? ""}
                placeholder="Authorized download — 1080p"
              />
            </Field>
          </div>

          <Field
            label="Destination URL"
            htmlFor="destinationUrl"
            required
            hint="HTTPS only. Private, loopback and internal hosts are rejected."
            error={state.fieldErrors?.destinationUrl}
          >
            <Input
              id="destinationUrl"
              name="destinationUrl"
              type="url"
              required
              placeholder="https://…"
              defaultValue={link?.destinationUrl ?? ""}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Quality" htmlFor="quality" error={state.fieldErrors?.quality}>
              <Input
                id="quality"
                name="quality"
                maxLength={40}
                defaultValue={link?.quality ?? ""}
                placeholder="1080p"
              />
            </Field>

            <Field
              label="File size (bytes)"
              htmlFor="fileSizeBytes"
              error={state.fieldErrors?.fileSizeBytes}
            >
              <Input
                id="fileSizeBytes"
                name="fileSizeBytes"
                type="number"
                min={0}
                defaultValue={link?.fileSizeBytes ?? ""}
              />
            </Field>

            <Field label="Language" htmlFor="language" error={state.fieldErrors?.language}>
              <Input
                id="language"
                name="language"
                maxLength={60}
                defaultValue={link?.language ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Authorization basis"
            htmlFor="authorizationBasis"
            required
            hint="What legal ground do we rely on for publishing this link?"
            error={state.fieldErrors?.authorizationBasis}
          >
            <Select
              id="authorizationBasis"
              name="authorizationBasis"
              required
              defaultValue={link?.authorizationBasis ?? "publisher_authorized_page"}
            >
              {BASES.map((basis) => (
                <option key={basis.value} value={basis.value}>
                  {basis.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Private authorization reference"
            htmlFor="authorizationReference"
            hint="Contract ID, permission email reference, or licence URL. Required before activation. Never shown publicly."
            error={state.fieldErrors?.authorizationReference}
          >
            <Input
              id="authorizationReference"
              name="authorizationReference"
              maxLength={1000}
              defaultValue={link?.authorizationReference ?? ""}
            />
          </Field>

          <Field
            label="Authorization notes"
            htmlFor="authorizationNotes"
            hint="Internal only."
            error={state.fieldErrors?.authorizationNotes}
          >
            <Textarea
              id="authorizationNotes"
              name="authorizationNotes"
              rows={3}
              defaultValue={link?.authorizationNotes ?? ""}
            />
          </Field>

          <SubmitButton>{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
