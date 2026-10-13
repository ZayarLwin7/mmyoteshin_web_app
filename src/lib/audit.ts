import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import type { CurrentAdmin } from "@/lib/auth/guards";

/**
 * Audit trail for privileged changes.
 *
 * Every publish, archive, link status change, report resolution and role
 * change writes a row here. Metadata is deliberately limited to non-sensitive
 * scalars — never store authorization evidence, tokens or report bodies.
 *
 * This module is the **write** path only. Reads live in
 * `src/db/queries/admin.ts` (`listAuditEntries`), which is the single
 * authenticated read path. Do not add read helpers here.
 */

export const AUDIT_ACTIONS = {
  movieCreated: "movie.created",
  movieUpdated: "movie.updated",
  moviePublished: "movie.published",
  movieArchived: "movie.archived",
  movieRestored: "movie.restored",
  genreCreated: "genre.created",
  genreUpdated: "genre.updated",
  genreDeleted: "genre.deleted",
  reviewCreated: "review.created",
  reviewUpdated: "review.updated",
  reviewPublished: "review.published",
  reviewArchived: "review.archived",
  linkCreated: "link.created",
  linkUpdated: "link.updated",
  linkActivated: "link.activated",
  linkDisabled: "link.disabled",
  linkChecked: "link.checked",
  reportResolved: "report.resolved",
  reportStatusChanged: "report.status_changed",
  adminSignedIn: "admin.signed_in",
  adminSignInFailed: "admin.sign_in_failed",
  adminSignedOut: "admin.signed_out",
  adminCreated: "admin.created",
  adminRoleChanged: "admin.role_changed",
  adminDeactivated: "admin.deactivated",
  settingsUpdated: "settings.updated",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

type AuditEntityType =
  | "movie"
  | "genre"
  | "review"
  | "download_link"
  | "content_report"
  | "admin_user"
  | "site_settings";

export type AuditInput = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  /** Omit for system-initiated events (e.g. a failed sign-in). */
  actor?: Pick<CurrentAdmin, "id" | "email"> | null;
  actorEmail?: string | null;
};

/**
 * Write an audit row.
 *
 * Auditing must never break the operation it describes, so failures are logged
 * and swallowed. The alternative — rolling back a legitimate publish because
 * the audit insert failed — would be worse for the operator.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("[audit] failed to record entry", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
