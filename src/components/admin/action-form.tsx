"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

import { Alert } from "@/components/ui/feedback";
import { IDLE_ACTION_STATE, type ActionState } from "@/lib/actions/types";

/**
 * Form wrapper for a server action.
 *
 * Renders the action result inline (success or failure) and scrolls the message
 * into view so a failed save near the bottom of a long form is not missed.
 *
 * `children` is a render function so individual fields can display their own
 * errors from `state.fieldErrors`.
 */
export function ActionForm({
  action,
  children,
  hiddenFields,
  className,
  successMessage,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState) => ReactNode;
  hiddenFields?: Record<string, string>;
  className?: string;
  /** Overrides the message shown on success. */
  successMessage?: string;
}) {
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "idle") {
      feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [state]);

  return (
    <form action={formAction} className={className}>
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div ref={feedbackRef}>
        {state.status === "error" && state.message ? (
          <Alert tone="danger" className="mb-5">
            {state.message}
          </Alert>
        ) : null}

        {state.status === "success" ? (
          <Alert tone="success" className="mb-5">
            {successMessage ?? state.message ?? "Saved."}
          </Alert>
        ) : null}
      </div>

      {children(state)}
    </form>
  );
}
