import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { adminProfiles, adminUsers } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { getDummyPasswordHash, verifyPassword } from "@/lib/auth/password";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Sign-in.
 *
 * Two properties matter here:
 *
 *  1. The response must not reveal whether an email exists. Unknown accounts
 *     still run an Argon2 verification against a dummy hash, and every failure
 *     returns the same message.
 *  2. Repeated failures lock the account for a cooling-off period, so a
 *     password cannot be brute-forced even if the per-IP limiter is evaded.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Deliberately identical for every failure mode. */
const GENERIC_FAILURE = "Incorrect email or password.";

export type SignInSuccess = {
  ok: true;
  session: SessionPayload;
};

export type SignInFailure = {
  ok: false;
  message: string;
  /** Seconds the caller should wait before retrying, when applicable. */
  retryAfterSeconds?: number;
};

export type SignInResult = SignInSuccess | SignInFailure;

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const normalisedEmail = email.trim().toLowerCase();

  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      passwordHash: adminUsers.passwordHash,
      isActive: adminUsers.isActive,
      lockedUntil: adminUsers.lockedUntil,
      failedLoginCount: adminUsers.failedLoginCount,
      role: adminProfiles.role,
    })
    .from(adminUsers)
    .leftJoin(adminProfiles, eq(adminProfiles.userId, adminUsers.id))
    .where(eq(adminUsers.email, normalisedEmail))
    .limit(1);

  const account = rows[0];

  if (!account) {
    // Equalise timing so a missing account is indistinguishable from a wrong
    // password.
    await verifyPassword(await getDummyPasswordHash(), password);
    await recordAudit({
      action: AUDIT_ACTIONS.adminSignInFailed,
      entityType: "admin_user",
      summary: "Failed sign-in attempt for an unknown email address.",
      actorEmail: normalisedEmail,
    });
    return { ok: false, message: GENERIC_FAILURE };
  }

  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil((account.lockedUntil.getTime() - Date.now()) / 1000);
    return {
      ok: false,
      message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      retryAfterSeconds,
    };
  }

  if (!account.isActive) {
    await verifyPassword(await getDummyPasswordHash(), password);
    return { ok: false, message: GENERIC_FAILURE };
  }

  const passwordMatches = await verifyPassword(account.passwordHash, password);

  if (!passwordMatches) {
    const nextFailureCount = account.failedLoginCount + 1;
    const shouldLock = nextFailureCount >= MAX_FAILED_ATTEMPTS;

    await db
      .update(adminUsers)
      .set({
        failedLoginCount: shouldLock ? 0 : nextFailureCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, account.id));

    await recordAudit({
      action: AUDIT_ACTIONS.adminSignInFailed,
      entityType: "admin_user",
      entityId: account.id,
      summary: shouldLock
        ? `Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} failed attempts.`
        : `Failed sign-in attempt (${nextFailureCount} of ${MAX_FAILED_ATTEMPTS}).`,
      actorEmail: account.email,
    });

    return { ok: false, message: GENERIC_FAILURE };
  }

  // A user without a role row has no authority. Refuse rather than defaulting.
  if (!account.role) {
    await recordAudit({
      action: AUDIT_ACTIONS.adminSignInFailed,
      entityType: "admin_user",
      entityId: account.id,
      summary: "Sign-in refused: the account has no role assigned.",
      actorEmail: account.email,
    });
    return { ok: false, message: "This account is not fully set up. Contact an administrator." };
  }

  await db
    .update(adminUsers)
    .set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(adminUsers.id, account.id));

  await recordAudit({
    action: AUDIT_ACTIONS.adminSignedIn,
    entityType: "admin_user",
    entityId: account.id,
    summary: `${account.displayName} signed in.`,
    actor: { id: account.id, email: account.email },
  });

  return {
    ok: true,
    session: {
      userId: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
    },
  };
}

export async function recordSignOut(actor: { id: string; email: string }): Promise<void> {
  await recordAudit({
    action: AUDIT_ACTIONS.adminSignedOut,
    entityType: "admin_user",
    entityId: actor.id,
    summary: "Signed out.",
    actor,
  });
}

export async function setAdminRole(
  userId: string,
  role: "owner" | "admin" | "editor",
  actor: { id: string; email: string },
): Promise<void> {
  await db
    .update(adminProfiles)
    .set({ role, updatedAt: new Date() })
    .where(eq(adminProfiles.userId, userId));

  await recordAudit({
    action: AUDIT_ACTIONS.adminRoleChanged,
    entityType: "admin_user",
    entityId: userId,
    summary: `Role changed to ${role}.`,
    actor,
  });
}

export async function setAdminActive(
  userId: string,
  isActive: boolean,
  actor: { id: string; email: string },
): Promise<void> {
  await db
    .update(adminUsers)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(adminUsers.id, userId));

  await recordAudit({
    action: isActive ? AUDIT_ACTIONS.adminCreated : AUDIT_ACTIONS.adminDeactivated,
    entityType: "admin_user",
    entityId: userId,
    summary: isActive ? "Account re-enabled." : "Account disabled.",
    actor,
  });
}

/** Guard against locking everyone out of the admin area. */
export async function countActiveOwners(): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminUsers)
    .innerJoin(adminProfiles, eq(adminProfiles.userId, adminUsers.id))
    .where(sql`${adminUsers.isActive} = true and ${adminProfiles.role} = 'owner'`);

  return rows[0]?.total ?? 0;
}
