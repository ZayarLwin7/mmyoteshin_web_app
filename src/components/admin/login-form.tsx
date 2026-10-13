"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { signInAction } from "@/lib/actions/auth";
import { IDLE_ACTION_STATE } from "@/lib/actions/types";

/** Administrator sign-in form. */
export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState(signInAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" htmlFor="password" required error={state.fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className="text-ink-subtle text-xs">
        Accounts are created by an existing owner using{" "}
        <code className="bg-surface-raised rounded px-1 py-0.5">pnpm admin:create</code>. There is
        no public sign-up.
      </p>
    </form>
  );
}
