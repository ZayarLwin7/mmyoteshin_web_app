import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/guards";
import { ServiceError } from "@/lib/services/movies";

import { actionError, type ActionState } from "./types";

/**
 * Translate a thrown error into a user-safe action result.
 *
 * Anything unrecognised is logged with its message (never its stack, which can
 * contain connection strings) and reported as a generic failure. The point is
 * that a database error must not surface as a stack trace or a raw Postgres
 * message in the browser.
 */
export function toActionError(error: unknown, scope = "action"): ActionState {
  if (error instanceof UnauthenticatedError) {
    return actionError("Your session has expired. Please sign in again.");
  }

  if (error instanceof ForbiddenError) {
    return actionError("You do not have permission to perform that action.");
  }

  if (error instanceof ServiceError) {
    return actionError(error.message);
  }

  console.error(`[${scope}] unexpected failure`, {
    error: error instanceof Error ? error.message : String(error),
  });

  return actionError("Something went wrong. Please try again.");
}
