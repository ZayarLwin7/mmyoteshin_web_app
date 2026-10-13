/**
 * Role-based permission model.
 *
 * Roles are strictly ordered (editor < admin < owner) and each permission
 * declares the minimum role that holds it. Keeping the mapping in one table
 * makes the matrix auditable — `docs/security.md` mirrors this list, and the
 * unit tests assert it.
 */

export const ADMIN_ROLES = ["editor", "admin", "owner"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  "movie:read",
  "movie:write",
  "movie:publish",
  "movie:archive",
  "genre:write",
  "review:write",
  "review:publish",
  "link:write",
  "link:authorize",
  "link:disable",
  "report:read",
  "report:resolve",
  "audit:read",
  "settings:write",
  "admin:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_RANK: Record<AdminRole, number> = {
  editor: 1,
  admin: 2,
  owner: 3,
};

const MINIMUM_ROLE: Record<Permission, AdminRole> = {
  // Editors can prepare and maintain content.
  "movie:read": "editor",
  "movie:write": "editor",
  "genre:write": "editor",
  "review:write": "editor",
  // Anything that changes what the public can see needs a second tier.
  "movie:publish": "admin",
  "movie:archive": "admin",
  "review:publish": "admin",
  // External distribution links carry legal weight, so only admins authorise them.
  "link:write": "admin",
  "link:authorize": "admin",
  // Fast takedown must not wait for an admin to be online.
  "link:disable": "editor",
  "report:read": "editor",
  "report:resolve": "admin",
  "audit:read": "admin",
  "settings:write": "owner",
  "admin:manage": "owner",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function roleHasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[MINIMUM_ROLE[permission]];
}

export function permissionsForRole(role: AdminRole): Permission[] {
  return PERMISSIONS.filter((permission) => roleHasPermission(role, permission));
}

/** Human-readable summary used in the admin UI and docs. */
export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  editor:
    "Creates and maintains catalogue entries, genres and reviews. Cannot publish or authorise links.",
  admin:
    "Publishes and archives content, authorises external links, and resolves reports. Cannot manage administrator accounts.",
  owner: "Full control, including administrator accounts and site settings.",
};
