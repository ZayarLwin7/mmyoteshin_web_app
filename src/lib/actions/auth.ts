"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/guards";
import { clearSession, establishSession } from "@/lib/auth/session";
import { clientFingerprint, rateLimitAuth } from "@/lib/security/rate-limit";
import { safeInternalRedirect } from "@/lib/security/url";
import { recordSignOut, signIn } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validation/schemas";

import { actionError, zodFieldErrors, type ActionState } from "./types";

/**
 * Admin sign-in.
 *
 * Layered protection:
 *   - per-IP rate limit (before any hashing work)
 *   - per-account lockout after repeated failures (in the service layer)
 *   - a single generic error message, so the response never reveals whether an
 *     email address exists
 *   - server-side redirect allow-listing, so `?next=` cannot be used to bounce
 *     an authenticated admin to another origin
 */
export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestHeaders = await headers();
  const fingerprint = clientFingerprint(requestHeaders);

  const limit = await rateLimitAuth(fingerprint);
  if (!limit.allowed) {
    return actionError(
      `Too many sign-in attempts. Please wait ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s) and try again.`,
    );
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
    redirectTo: formData.get("redirectTo")?.toString() || undefined,
  });

  if (!parsed.success) {
    return {
      ...actionError("Please check your details and try again."),
      fieldErrors: zodFieldErrors(parsed.error.issues),
    };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    return actionError(result.message);
  }

  await establishSession(result.session);

  // `redirect` throws a control-flow exception, so it must sit outside any
  // try/catch that would swallow it.
  redirect(safeInternalRedirect(parsed.data.redirectTo, "/admin"));
}

export async function signOutAction(): Promise<void> {
  const admin = await getCurrentAdmin();
  if (admin) {
    await recordSignOut({ id: admin.id, email: admin.email });
  }
  await clearSession();
  redirect("/admin/login");
}
