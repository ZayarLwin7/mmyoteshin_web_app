import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { contentReports, downloadLinks, movies, type ContentReport } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/guards";
import { hashIdentifier } from "@/lib/security/rate-limit";
import { normalisePlainText } from "@/lib/security/sanitize";
import type { ReportSubmission } from "@/lib/validation/schemas";

import { flagLinkAsReported } from "./links";
import { ServiceError } from "./movies";

/**
 * Content and link reporting.
 *
 * The submission path is public, so it is deliberately narrow: it can only
 * reference content that is already publicly visible, it stores no raw IP
 * address, and it never echoes internal state back to the reporter.
 */

export type SubmitReportResult = { id: string };

export async function submitReport(
  input: ReportSubmission,
  clientFingerprint: string,
): Promise<SubmitReportResult> {
  let movieId: string | null = input.movieId ?? null;
  const linkId: string | null = input.downloadLinkId ?? null;

  if (!movieId && !linkId) {
    throw new ServiceError("Choose what you are reporting.", "missing_target");
  }

  // A link reference must resolve to a link that is genuinely reachable by the
  // public. This stops the form being used to enumerate draft records.
  if (linkId) {
    const rows = await db
      .select({
        id: downloadLinks.id,
        movieId: downloadLinks.movieId,
        status: downloadLinks.status,
      })
      .from(downloadLinks)
      .innerJoin(movies, eq(movies.id, downloadLinks.movieId))
      .where(and(eq(downloadLinks.id, linkId), eq(movies.status, "published")))
      .limit(1);

    const link = rows[0];
    if (!link) {
      throw new ServiceError("That link could not be found.", "unknown_link");
    }

    // Trust the database relationship over the submitted movie id.
    movieId = link.movieId;
  } else if (movieId) {
    const rows = await db
      .select({ id: movies.id })
      .from(movies)
      .where(and(eq(movies.id, movieId), eq(movies.status, "published")))
      .limit(1);

    if (rows.length === 0) {
      throw new ServiceError("That film could not be found.", "unknown_movie");
    }
  }

  const inserted = await db
    .insert(contentReports)
    .values({
      movieId,
      downloadLinkId: linkId,
      reason: input.reason,
      details: normalisePlainText(input.details, 4000),
      reporterContact: input.reporterContact,
      status: "new",
      // Store a keyed hash for abuse control only — never the address itself.
      reporterIpHash: hashIdentifier(clientFingerprint),
    })
    .returning({ id: contentReports.id });

  const report = inserted[0];
  if (!report) throw new ServiceError("Failed to record the report.", "insert_failed");

  // A credible report on a live link should remove it from public view
  // immediately, before a human has reviewed the queue.
  if (linkId) {
    await flagLinkAsReported(linkId, null);
  }

  return { id: report.id };
}

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

export async function setReportStatus(
  reportId: string,
  status: ContentReport["status"],
  actor: CurrentAdmin,
  resolutionNotes?: string,
): Promise<ContentReport> {
  const existing = await db
    .select()
    .from(contentReports)
    .where(eq(contentReports.id, reportId))
    .limit(1);

  const current = existing[0];
  if (!current) throw new ServiceError("That report no longer exists.", "not_found");

  const isClosing = status === "resolved" || status === "rejected";

  const updated = await db
    .update(contentReports)
    .set({
      status,
      resolutionNotes: resolutionNotes
        ? normalisePlainText(resolutionNotes, 4000)
        : current.resolutionNotes,
      resolvedBy: isClosing ? actor.id : null,
      resolvedAt: isClosing ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(contentReports.id, reportId))
    .returning();

  const report = updated[0];
  if (!report) throw new ServiceError("Failed to update the report.", "update_failed");

  await recordAudit({
    action: isClosing ? AUDIT_ACTIONS.reportResolved : AUDIT_ACTIONS.reportStatusChanged,
    entityType: "content_report",
    entityId: reportId,
    summary: `Report marked ${status.replace(/_/g, " ")}.`,
    metadata: { reason: report.reason, movieId: report.movieId, linkId: report.downloadLinkId },
    actor,
  });

  return report;
}

/**
 * Close a report, optionally disabling the reported link at the same time.
 * Disabling is a separate permission and is checked by the caller.
 */
export async function resolveReport(
  reportId: string,
  actor: CurrentAdmin,
  options: { status: "resolved" | "rejected"; resolutionNotes?: string; disableLink?: boolean },
): Promise<ContentReport> {
  if (options.disableLink) {
    const rows = await db
      .select({ downloadLinkId: contentReports.downloadLinkId })
      .from(contentReports)
      .where(eq(contentReports.id, reportId))
      .limit(1);

    const linkId = rows[0]?.downloadLinkId;
    if (linkId) {
      await db
        .update(downloadLinks)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(eq(downloadLinks.id, linkId));

      await recordAudit({
        action: AUDIT_ACTIONS.linkDisabled,
        entityType: "download_link",
        entityId: linkId,
        summary: "Link disabled while resolving a content report.",
        actor,
      });
    }
  }

  return setReportStatus(reportId, options.status, actor, options.resolutionNotes);
}

export async function reopenReport(reportId: string, actor: CurrentAdmin): Promise<ContentReport> {
  return setReportStatus(reportId, "under_review", actor);
}
