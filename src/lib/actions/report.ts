"use server";

import { headers } from "next/headers";

import { clientFingerprint, rateLimitReport } from "@/lib/security/rate-limit";
import { submitReport } from "@/lib/services/reports";
import { reportSubmissionSchema } from "@/lib/validation/schemas";

import { actionError, actionSuccess, zodFieldErrors, type ActionState } from "./types";

/**
 * Public report submission.
 *
 * Trust boundary: everything in `formData` is untrusted. The payload is parsed
 * with Zod before it reaches the service layer, a honeypot field catches naive
 * bots, and the request is rate limited per client fingerprint.
 *
 * Server Actions are same-origin by default — Next.js rejects a POST whose
 * Origin does not match the host — which is our CSRF protection here.
 */
export async function submitReportAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestHeaders = await headers();
  const fingerprint = clientFingerprint(requestHeaders);

  // Rate limit before doing any work, so a flood cannot reach the database.
  const limit = await rateLimitReport(fingerprint);
  if (!limit.allowed) {
    return actionError(
      `Too many reports from this connection. Please try again in ${Math.ceil(
        limit.retryAfterSeconds / 60,
      )} minute(s).`,
    );
  }

  const raw = {
    movieId: formData.get("movieId")?.toString() || null,
    downloadLinkId: formData.get("downloadLinkId")?.toString() || null,
    reason: formData.get("reason")?.toString() ?? "",
    details: formData.get("details")?.toString() ?? "",
    reporterContact: formData.get("reporterContact")?.toString() || null,
    website: formData.get("website")?.toString() ?? "",
  };

  // Honeypot: a real person never sees this field, so a filled value means a bot.
  if (raw.website !== "") {
    // Respond as though it succeeded so the bot does not learn it was caught.
    return actionSuccess("Thank you — your report has been received.");
  }

  const parsed = reportSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ...actionError("Please check the form and try again."),
      fieldErrors: zodFieldErrors(parsed.error.issues),
    };
  }

  try {
    await submitReport(parsed.data, fingerprint);
  } catch (error) {
    // Log the diagnostic server-side; show the user something safe.
    console.error("[report] submission failed", {
      reason: parsed.data.reason,
      error: error instanceof Error ? error.message : "unknown",
    });
    return actionError(
      "We could not record your report just now. Please try again shortly, or email us directly.",
    );
  }

  return actionSuccess(
    "Thank you — your report has been received and will be reviewed. If a link was reported, it has been taken out of public view while we investigate.",
  );
}
