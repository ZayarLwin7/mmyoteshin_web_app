"use server";

import { revalidatePath } from "next/cache";

import { assertPermission } from "@/lib/auth/guards";
import { reopenReport, resolveReport, setReportStatus } from "@/lib/services/reports";
import { reportResolutionSchema } from "@/lib/validation/schemas";

import { toActionError } from "./errors";
import { formToObject } from "./form";
import { actionError, actionSuccess, zodFieldErrors, type ActionState } from "./types";

function revalidateReportSurfaces() {
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

/**
 * Move a report into review. Available to editors.
 */
export async function markReportUnderReviewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reportId = formData.get("reportId")?.toString() ?? "";

  try {
    const admin = await assertPermission("report:read");
    await reopenReport(reportId, admin);
    revalidateReportSurfaces();

    return actionSuccess("Report marked as under review.");
  } catch (error) {
    return toActionError(error, "reports");
  }
}

/**
 * Close a report.
 *
 * Resolving is an admin action because it can also disable a live link, which
 * changes what the public can see.
 */
export async function resolveReportAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const parsed = reportResolutionSchema.safeParse(
      formToObject(formData, { checkboxes: ["disableReportedLink"] }),
    );

    if (!parsed.success) {
      return {
        ...actionError("Please check the form and try again."),
        fieldErrors: zodFieldErrors(parsed.error.issues),
      };
    }

    const admin = await assertPermission("report:resolve");

    if (parsed.data.status !== "resolved" && parsed.data.status !== "rejected") {
      const report = await setReportStatus(
        parsed.data.reportId,
        parsed.data.status,
        admin,
        parsed.data.resolutionNotes,
      );
      revalidateReportSurfaces();
      return actionSuccess(`Report set to ${report.status}.`);
    }

    await resolveReport(parsed.data.reportId, admin, {
      status: parsed.data.status,
      resolutionNotes: parsed.data.resolutionNotes,
      disableLink: parsed.data.disableReportedLink,
    });

    revalidateReportSurfaces();
    revalidatePath("/movies");
    revalidatePath("/");

    return actionSuccess(
      parsed.data.disableReportedLink
        ? "Report closed and the reported link was disabled."
        : "Report closed.",
    );
  } catch (error) {
    return toActionError(error, "reports");
  }
}
