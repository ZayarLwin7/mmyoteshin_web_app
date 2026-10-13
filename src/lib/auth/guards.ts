import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { adminProfiles, adminUsers } from "@/db/schema";

import { roleHasPermission, type AdminRole, type Permission } from "./permissions";
import { readSessionToken } from "./session";

/**
 * Authorisation guards for server components, server actions and route
 * handlers.
 *
 * The role is re-read from the database on every request rather than trusted
 * from the session token. That means revoking an account, demoting a role, or
 * disabling a user takes effect immediately instead of when the token expires.
 */

export type CurrentAdmin = {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
};

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission | null) {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Unauthenticated");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Resolve the signed-in administrator, or `null`.
 *
 * Wrapped in React's `cache` so a page that checks permissions in several
 * components performs one database round trip per request.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await readSessionToken();
  if (!session) return null;

  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      isActive: adminUsers.isActive,
      lockedUntil: adminUsers.lockedUntil,
      role: adminProfiles.role,
    })
    .from(adminUsers)
    .leftJoin(adminProfiles, eq(adminProfiles.userId, adminUsers.id))
    .where(eq(adminUsers.id, session.userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.isActive) return null;
  if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) return null;

  // A user with no role row has no authority. Fail closed.
  if (!row.role) return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
  };
});

/** For pages: redirect to sign-in when there is no valid session. */
export async function requireAdmin(nextPath?: string): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    const target = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/admin/login${target}`);
  }
  return admin;
}

/** For pages: redirect to the access-denied page when the role is insufficient. */
export async function requirePermission(
  permission: Permission,
  nextPath?: string,
): Promise<CurrentAdmin> {
  const admin = await requireAdmin(nextPath);
  if (!roleHasPermission(admin.role, permission)) {
    redirect(`/admin/forbidden?required=${encodeURIComponent(permission)}`);
  }
  return admin;
}

/** For server actions: throw so the caller can return a structured error. */
export async function assertPermission(permission: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new UnauthenticatedError();
  if (!roleHasPermission(admin.role, permission)) throw new ForbiddenError(permission);
  return admin;
}

/** For route handlers: same as `assertPermission` but returns a 401/403 response. */
export async function guardApi(
  permission: Permission,
): Promise<{ ok: true; admin: CurrentAdmin } | { ok: false; status: 401 | 403; message: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, status: 401, message: "Authentication required." };
  if (!roleHasPermission(admin.role, permission)) {
    return {
      ok: false,
      status: 403,
      message: "You do not have permission to perform this action.",
    };
  }
  return { ok: true, admin };
}
