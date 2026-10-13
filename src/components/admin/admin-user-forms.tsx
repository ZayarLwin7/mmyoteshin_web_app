"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/admin/submit-button";
import { setAdminActiveAction, updateAdminRoleAction } from "@/lib/actions/admins";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";

/** Role selector for an administrator account. */
export function AdminRoleForm({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(updateAdminRoleAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />

      <label htmlFor={`role-${userId}`} className="sr-only">
        Role
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={currentRole}
        className="border-line-strong bg-surface-sunken text-ink h-9 rounded-lg border px-2 text-sm"
      >
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
        <option value="owner">Owner</option>
      </select>

      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
        Update role
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
      {disabled ? (
        <p className="text-ink-subtle w-full text-xs">
          Account disabled — re-enable it to sign in.
        </p>
      ) : null}
    </form>
  );
}

/** Enable/disable toggle for an administrator account. */
export function AdminActiveForm({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [state, formAction] = useActionState(setAdminActiveAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />

      <SubmitButton size="sm" variant={isActive ? "danger" : "secondary"} pendingLabel="Saving…">
        {isActive ? "Disable account" : "Re-enable account"}
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
