import { describe, expect, it } from "vitest";

import {
  ADMIN_ROLES,
  PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
} from "@/lib/auth/permissions";

/**
 * The permission matrix.
 *
 * These assertions are the specification: if someone widens a role by editing
 * the table in `lib/auth/permissions.ts`, a test fails and the change has to be
 * deliberate.
 */
describe("roleHasPermission", () => {
  it("lets an editor maintain content but not publish it", () => {
    expect(roleHasPermission("editor", "movie:write")).toBe(true);
    expect(roleHasPermission("editor", "review:write")).toBe(true);
    expect(roleHasPermission("editor", "movie:publish")).toBe(false);
    expect(roleHasPermission("editor", "review:publish")).toBe(false);
  });

  it("lets an editor disable a link, so a report can be acted on immediately", () => {
    expect(roleHasPermission("editor", "link:disable")).toBe(true);
  });

  it("does not let an editor authorise a link", () => {
    expect(roleHasPermission("editor", "link:authorize")).toBe(false);
    expect(roleHasPermission("editor", "link:write")).toBe(false);
  });

  it("does not let an editor resolve reports", () => {
    expect(roleHasPermission("editor", "report:read")).toBe(true);
    expect(roleHasPermission("editor", "report:resolve")).toBe(false);
  });

  it("lets an admin publish, authorise links and resolve reports", () => {
    expect(roleHasPermission("admin", "movie:publish")).toBe(true);
    expect(roleHasPermission("admin", "movie:archive")).toBe(true);
    expect(roleHasPermission("admin", "review:publish")).toBe(true);
    expect(roleHasPermission("admin", "link:authorize")).toBe(true);
    expect(roleHasPermission("admin", "report:resolve")).toBe(true);
    expect(roleHasPermission("admin", "audit:read")).toBe(true);
  });

  it("does not let an admin manage administrators or settings", () => {
    expect(roleHasPermission("admin", "admin:manage")).toBe(false);
    expect(roleHasPermission("admin", "settings:write")).toBe(false);
  });

  it("gives the owner every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission("owner", permission)).toBe(true);
    }
  });
});

describe("permissionsForRole", () => {
  it("is strictly increasing across the role hierarchy", () => {
    const editor = permissionsForRole("editor").length;
    const admin = permissionsForRole("admin").length;
    const owner = permissionsForRole("owner").length;

    expect(editor).toBeLessThan(admin);
    expect(admin).toBeLessThan(owner);
    expect(owner).toBe(PERMISSIONS.length);
  });

  it("returns a subset of the declared permissions for every role", () => {
    for (const role of ADMIN_ROLES) {
      for (const permission of permissionsForRole(role)) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("gives every role read access to films", () => {
    for (const role of ADMIN_ROLES) {
      expect(permissionsForRole(role)).toContain("movie:read");
    }
  });
});

describe("ADMIN_ROLES", () => {
  it("lists the roles in ascending order of authority", () => {
    expect(ADMIN_ROLES).toEqual(["editor", "admin", "owner"]);
  });
});
