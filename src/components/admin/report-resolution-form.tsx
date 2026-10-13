"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/admin/submit-button";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions/types";

/**
 * Report resolution form.
 *
 * Closing a report and disabling a link are separate decisions, so the checkbox
 * is explicit and off by default. The consequence of ticking it is spelled out
 * next to the control rather than hidden in a tooltip.
 */
export function ReportResolutionForm({
  action,
  reportId,
  currentStatus,
  hasLinkedReport,
  canResolve,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  reportId: string;
  currentStatus: string;
  hasLinkedReport: boolean;
  canResolve: boolean;
}) {
  return (
    <ActionForm
      action={action}
      className="space-y-5"
      hiddenFields={{ reportId }}
      successMessage="Report updated."
    >
      {(state) => (
        <>
          <Field
            label="Outcome"
            htmlFor="status"
            hint="Resolving or rejecting closes the report. Under review keeps it open."
            error={state.fieldErrors?.status}
          >
            <Select id="status" name="status" defaultValue={currentStatus}>
              <option value="under_review">Under review (keep open)</option>
              {canResolve ? <option value="resolved">Resolved — action taken</option> : null}
              {canResolve ? <option value="rejected">Rejected — no action needed</option> : null}
            </Select>
          </Field>

          <Field
            label="Internal notes"
            htmlFor="resolutionNotes"
            hint="Never shown publicly or to the reporter."
            error={state.fieldErrors?.resolutionNotes}
          >
            <Textarea id="resolutionNotes" name="resolutionNotes" rows={4} />
          </Field>

          {hasLinkedReport && canResolve ? (
            <Checkbox
              id="disableReportedLink"
              name="disableReportedLink"
              label="Also disable the reported link"
              hint="Takes the link out of public view permanently. It is already hidden while the report is open."
            />
          ) : null}

          {!canResolve ? (
            <p className="text-ink-subtle text-xs">
              Your role can review and annotate reports but not close them. An admin or owner must
              resolve.
            </p>
          ) : null}

          <SubmitButton>Save outcome</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
