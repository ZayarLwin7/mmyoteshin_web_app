"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/feedback";
import { Button, type ButtonProps } from "@/components/ui/button";
import { SubmitButton } from "@/components/admin/submit-button";
import { IDLE_ACTION_STATE, type ActionState } from "@/lib/actions/types";

/**
 * Destructive action with an explicit confirmation step.
 *
 * Rather than `window.confirm` (which is unstyled, easily dismissed by habit,
 * and invisible to assistive technology in some browsers) this renders an
 * inline confirmation panel that states exactly what is about to happen. The
 * confirm button is never the default focus target, so an accidental Enter
 * cannot trigger the action.
 */
export function ConfirmAction({
  action,
  hiddenFields,
  label,
  confirmLabel,
  description,
  variant = "secondary",
  size = "sm",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields: Record<string, string>;
  label: string;
  confirmLabel: string;
  description: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);
  const [confirming, setConfirming] = useState(false);

  if (state.status === "success") {
    return (
      <Alert tone="success" className="text-xs">
        {state.message}
      </Alert>
    );
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        {state.status === "error" && state.message ? (
          <Alert tone="danger" className="text-xs">
            {state.message}
          </Alert>
        ) : null}
        <Button type="button" variant={variant} size={size} onClick={() => setConfirming(true)}>
          {label}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="border-warning/40 bg-warning/5 space-y-3 rounded-lg border p-3"
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <p className="text-ink-muted text-xs">{description}</p>

      <div className="flex flex-wrap gap-2">
        <SubmitButton size={size} variant={variant} pendingLabel="Working…">
          {confirmLabel}
        </SubmitButton>
        <Button type="button" size={size} variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
