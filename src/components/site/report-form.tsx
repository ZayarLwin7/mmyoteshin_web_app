"use client";

import { useActionState, useId } from "react";

import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { submitReportAction } from "@/lib/actions/report";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";

/**
 * Public report form.
 *
 * Progressive enhancement: this is a real form backed by a server action, and
 * the server re-validates everything it receives. The client-side `useActionState`
 * only exists to render the result without a full page reload.
 *
 * The honeypot field is visually hidden and marked `aria-hidden` so it is
 * skipped by screen readers, while remaining attractive to naive bots.
 */

const REASONS = [
  { value: "broken_link", label: "The link is broken or leads somewhere unexpected" },
  { value: "copyright", label: "Copyright or rights issue" },
  { value: "unauthorized_distribution", label: "This distribution is not authorized" },
  { value: "malware_or_unsafe", label: "The destination looks unsafe" },
  { value: "misleading_listing", label: "The listing is misleading or inaccurate" },
  { value: "metadata_error", label: "Incorrect film information" },
  { value: "other", label: "Something else" },
] as const;

export function ReportForm({
  movieId,
  downloadLinkId,
  linkLabel,
}: {
  movieId?: string;
  downloadLinkId?: string;
  linkLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState(submitReportAction, IDLE_ACTION_STATE);
  const fieldId = useId();

  if (state.status === "success") {
    return (
      <Alert tone="success" title="Report received">
        <p>{state.message}</p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {movieId ? <input type="hidden" name="movieId" value={movieId} /> : null}
      {downloadLinkId ? <input type="hidden" name="downloadLinkId" value={downloadLinkId} /> : null}

      {/* Honeypot — hidden from people and from assistive technology. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor={`${fieldId}-website`}>Website</label>
        <input
          id={`${fieldId}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      {linkLabel ? (
        <p className="text-ink-muted text-sm">
          Reporting the link: <span className="text-ink">{linkLabel}</span>
        </p>
      ) : null}

      <Field
        label="What is wrong?"
        htmlFor={`${fieldId}-reason`}
        required
        error={state.fieldErrors?.reason}
      >
        <Select id={`${fieldId}-reason`} name="reason" required defaultValue="broken_link">
          {REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Details"
        htmlFor={`${fieldId}-details`}
        required
        hint="At least 20 characters. Please include what you saw and where."
        error={state.fieldErrors?.details}
      >
        <Textarea
          id={`${fieldId}-details`}
          name="details"
          required
          minLength={20}
          maxLength={4000}
          rows={5}
          placeholder="Describe the problem…"
        />
      </Field>

      <Field
        label="Your email (optional)"
        htmlFor={`${fieldId}-contact`}
        hint="Only if you would like a reply. We do not publish it."
        error={state.fieldErrors?.reporterContact}
      >
        <Input id={`${fieldId}-contact`} name="reporterContact" type="email" autoComplete="email" />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Submit report"}
        </Button>
        <p className="text-ink-subtle text-xs">
          Reports about a live link remove it from public view immediately while we investigate.
        </p>
      </div>
    </form>
  );
}
