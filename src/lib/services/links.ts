import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { downloadLinks, movies, type DownloadLink } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/guards";
import { validateExternalUrl } from "@/lib/security/url";
import { humaniseEnum } from "@/lib/utils";
import type { DownloadLinkInput } from "@/lib/validation/schemas";

import { ServiceError } from "./movies";

/**
 * External distribution link operations.
 *
 * This is the highest-risk area of the product, so the rules are strict:
 *
 *  - A destination is only accepted if it passes `validateExternalUrl`
 *    (https only, no credentials, no private or loopback hosts).
 *  - A link may only be created or updated into `active` when a recorded
 *    authorization basis *and* a private authorization reference exist.
 *  - Activation always stamps `authorized_by` / `authorized_at`, which the
 *    public query layer requires before a link is ever shown.
 *
 * The database enforces the same invariant with
 * `download_links_active_requires_authorization`, so a future code path that
 * forgets these checks still cannot publish an unauthorised link.
 */

async function assertMovieExists(movieId: string) {
  const rows = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);
  if (rows.length === 0) throw new ServiceError("That film no longer exists.", "not_found");
}

function normaliseDestination(rawUrl: string) {
  const result = validateExternalUrl(rawUrl);
  if (!result.ok) {
    throw new ServiceError(`Destination rejected: ${result.message}`, "invalid_destination");
  }
  return result;
}

/**
 * Guard the "go live" transition.
 *
 * Both pieces of evidence are mandatory: the *basis* says what legal ground we
 * rely on, the *reference* says where that can be verified.
 */
function assertAuthorizationComplete(input: {
  authorizationBasis: string | null;
  authorizationReference: string | null;
}) {
  if (!input.authorizationBasis) {
    throw new ServiceError(
      "Record an authorization basis before a link can be activated.",
      "missing_authorization_basis",
    );
  }

  if (!input.authorizationReference || input.authorizationReference.trim().length < 4) {
    throw new ServiceError(
      "Record a private authorization reference (contract, permission email or licence URL) before activating this link.",
      "missing_authorization_reference",
    );
  }
}

export async function createLink(
  input: DownloadLinkInput,
  actor: CurrentAdmin,
): Promise<DownloadLink> {
  await assertMovieExists(input.movieId);

  const destination = normaliseDestination(input.destinationUrl);

  // New links are always created in a non-public state. Activation is a
  // separate, explicitly authorised step.
  const status = "pending_review" as const;

  const inserted = await db
    .insert(downloadLinks)
    .values({
      movieId: input.movieId,
      providerName: input.providerName,
      destinationUrl: destination.url,
      destinationHost: destination.host,
      label: input.label,
      quality: input.quality,
      fileSizeBytes: input.fileSizeBytes === null ? null : String(input.fileSizeBytes),
      language: input.language,
      authorizationBasis: input.authorizationBasis,
      authorizationReference: input.authorizationReference,
      authorizationNotes: input.authorizationNotes,
      status,
    })
    .returning();

  const link = inserted[0];
  if (!link) throw new ServiceError("Failed to create the link.", "insert_failed");

  await recordAudit({
    action: AUDIT_ACTIONS.linkCreated,
    entityType: "download_link",
    entityId: link.id,
    summary: `Added a pending ${link.label} link from ${link.providerName} (${link.destinationHost}).`,
    metadata: { movieId: link.movieId, host: link.destinationHost },
    actor,
  });

  return link;
}

export async function updateLink(
  id: string,
  input: DownloadLinkInput,
  actor: CurrentAdmin,
): Promise<DownloadLink> {
  const existing = await db.select().from(downloadLinks).where(eq(downloadLinks.id, id)).limit(1);
  const current = existing[0];
  if (!current) throw new ServiceError("That link no longer exists.", "not_found");

  const destination = normaliseDestination(input.destinationUrl);

  // Editing a live link must not be a way to swap in an unauthorised
  // destination while keeping its authorised status.
  const destinationChanged = destination.url !== current.destinationUrl;
  let status = current.status;

  if (current.status === "active" && destinationChanged) {
    status = "pending_review";
  }

  if (input.status === "active" || status === "active") {
    assertAuthorizationComplete({
      authorizationBasis: input.authorizationBasis,
      authorizationReference: input.authorizationReference,
    });
  }

  const updated = await db
    .update(downloadLinks)
    .set({
      providerName: input.providerName,
      destinationUrl: destination.url,
      destinationHost: destination.host,
      label: input.label,
      quality: input.quality,
      fileSizeBytes: input.fileSizeBytes === null ? null : String(input.fileSizeBytes),
      language: input.language,
      authorizationBasis: input.authorizationBasis,
      authorizationReference: input.authorizationReference,
      authorizationNotes: input.authorizationNotes,
      status,
      updatedAt: new Date(),
    })
    .where(eq(downloadLinks.id, id))
    .returning();

  const link = updated[0];
  if (!link) throw new ServiceError("Failed to update the link.", "update_failed");

  await recordAudit({
    action: AUDIT_ACTIONS.linkUpdated,
    entityType: "download_link",
    entityId: id,
    summary: destinationChanged
      ? `Changed the destination for "${link.label}" and returned it to review.`
      : `Updated "${link.label}".`,
    metadata: { destinationChanged, host: link.destinationHost },
    actor,
  });

  return link;
}

/**
 * Take a link live.
 *
 * Requires a recorded basis plus a private reference, and stamps the reviewer
 * so the public layer's `authorized_at IS NOT NULL` condition is satisfied.
 */
export async function activateLink(id: string, actor: CurrentAdmin): Promise<DownloadLink> {
  const existing = await db.select().from(downloadLinks).where(eq(downloadLinks.id, id)).limit(1);
  const current = existing[0];
  if (!current) throw new ServiceError("That link no longer exists.", "not_found");

  // Re-validate the stored destination on every activation so a record that
  // predates a rule change cannot be quietly re-enabled.
  const destination = normaliseDestination(current.destinationUrl);

  assertAuthorizationComplete({
    authorizationBasis: current.authorizationBasis,
    authorizationReference: current.authorizationReference,
  });

  const updated = await db
    .update(downloadLinks)
    .set({
      status: "active",
      destinationUrl: destination.url,
      destinationHost: destination.host,
      authorizedBy: actor.id,
      authorizedAt: new Date(),
      lastCheckedAt: new Date(),
      lastCheckedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(downloadLinks.id, id))
    .returning();

  const link = updated[0];
  if (!link) throw new ServiceError("Failed to activate the link.", "update_failed");

  await recordAudit({
    action: AUDIT_ACTIONS.linkActivated,
    entityType: "download_link",
    entityId: id,
    summary: `Activated "${link.label}" from ${link.providerName} under ${humaniseEnum(link.authorizationBasis)}.`,
    metadata: { host: link.destinationHost, basis: link.authorizationBasis },
    actor,
  });

  return link;
}

/**
 * Take a link offline. Available to editors as well as admins so a credible
 * report can be acted on immediately.
 */
export async function disableLink(
  id: string,
  actor: CurrentAdmin,
  reason?: string,
): Promise<DownloadLink> {
  const updated = await db
    .update(downloadLinks)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(downloadLinks.id, id))
    .returning();

  const link = updated[0];
  if (!link) throw new ServiceError("That link no longer exists.", "not_found");

  await recordAudit({
    action: AUDIT_ACTIONS.linkDisabled,
    entityType: "download_link",
    entityId: id,
    summary: `Disabled "${link.label}" from ${link.providerName}${reason ? ` — ${reason}` : "."}`,
    metadata: { host: link.destinationHost },
    actor,
  });

  return link;
}

/** Flag a link as reported so it appears in the moderation queue. */
export async function flagLinkAsReported(id: string, actor: CurrentAdmin | null): Promise<void> {
  await db
    .update(downloadLinks)
    .set({ status: "reported", updatedAt: new Date() })
    .where(eq(downloadLinks.id, id));

  await recordAudit({
    action: AUDIT_ACTIONS.linkUpdated,
    entityType: "download_link",
    entityId: id,
    summary: "Link flagged as reported and moved out of the public view.",
    actor,
  });
}

/** Record that a human confirmed the destination still works. */
export async function markLinkChecked(id: string, actor: CurrentAdmin): Promise<DownloadLink> {
  const updated = await db
    .update(downloadLinks)
    .set({ lastCheckedAt: new Date(), lastCheckedBy: actor.id, updatedAt: new Date() })
    .where(eq(downloadLinks.id, id))
    .returning();

  const link = updated[0];
  if (!link) throw new ServiceError("That link no longer exists.", "not_found");

  await recordAudit({
    action: AUDIT_ACTIONS.linkChecked,
    entityType: "download_link",
    entityId: id,
    summary: `Re-checked "${link.label}" from ${link.providerName}.`,
    actor,
  });

  return link;
}

export async function deleteLink(id: string, actor: CurrentAdmin): Promise<void> {
  const existing = await db.select().from(downloadLinks).where(eq(downloadLinks.id, id)).limit(1);
  const link = existing[0];
  if (!link) throw new ServiceError("That link no longer exists.", "not_found");

  if (link.status === "active") {
    throw new ServiceError(
      "Disable the link before deleting it, so the change is recorded in the audit trail.",
      "delete_active_link",
    );
  }

  await db.delete(downloadLinks).where(eq(downloadLinks.id, id));

  await recordAudit({
    action: AUDIT_ACTIONS.linkDisabled,
    entityType: "download_link",
    entityId: id,
    summary: `Deleted the ${link.label} link from ${link.providerName}.`,
    actor,
  });
}

/** Disable every live link attached to a film — the takedown action. */
export async function disableAllLinksForMovie(
  movieId: string,
  actor: CurrentAdmin,
  reason: string,
): Promise<number> {
  const affected = await db
    .update(downloadLinks)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(
      and(
        eq(downloadLinks.movieId, movieId),
        // Only links that are currently reachable by the public need disabling;
        // drafts and already-disabled rows are left untouched.
        inArray(downloadLinks.status, ["active", "reported"]),
      ),
    )
    .returning({ id: downloadLinks.id });

  if (affected.length > 0) {
    await recordAudit({
      action: AUDIT_ACTIONS.linkDisabled,
      entityType: "movie",
      entityId: movieId,
      summary: `Disabled ${affected.length} link(s) for the film — ${reason}`,
      actor,
    });
  }

  return affected.length;
}
