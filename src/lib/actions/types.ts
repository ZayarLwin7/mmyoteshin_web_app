/**
 * Shared shape for form action results.
 *
 * Kept in its own module because a file marked `"use server"` may only export
 * async functions — types and constants have to live outside it.
 */

export type ActionState = {
  status: "idle" | "success" | "error";
  /** Top-level message, safe to show to the user. */
  message?: string;
  /** Per-field messages, keyed by the form field name. */
  fieldErrors?: Record<string, string>;
  /** Values echoed back so a failed submit does not lose the user's input. */
  values?: Record<string, string>;
};

export const IDLE_ACTION_STATE: ActionState = { status: "idle" };

export function actionError(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors };
}

export function actionSuccess(message: string): ActionState {
  return { status: "success", message };
}

/**
 * Flatten a Zod error into `{ field: message }`.
 * Only the first message per field is kept — the forms show one at a time.
 */
export function zodFieldErrors(
  issues: { path: (string | number | symbol)[]; message: string }[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
