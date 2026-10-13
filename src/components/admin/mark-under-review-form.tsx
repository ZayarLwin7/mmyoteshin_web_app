"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/admin/submit-button";
import { markReportUnderReviewAction } from "@/lib/actions/reports";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";

/**
 * Move a report back into review.
 *
 * This is a plain submit rather than a `ConfirmAction`: nothing destructive
 * happens and the transition is reversible, so asking the editor to confirm
 * would be friction for no gain. It is a client component purely because the
 * action has the `useActionState` signature — a bare `<form action={…}>` in a
 * server component expects `(formData) => void`, which is a different shape.
 */
export function MarkUnderReviewForm({ reportId }: { reportId: string }) {
  const [state, formAction] = useActionState(markReportUnderReviewAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="reportId" value={reportId} />

      <SubmitButton variant="secondary" size="sm" pendingLabel="Updating…">
        Mark as under review
      </SubmitButton>

      {state.status === "error" && state.message ? (
        <Alert tone="danger" className="w-full text-xs">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert tone="success" className="w-full text-xs">
          {state.message}
        </Alert>
      ) : null}
    </form>
  );
}
