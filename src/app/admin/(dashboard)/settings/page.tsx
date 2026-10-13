import type { Metadata } from "next";

import { AdminActiveForm, AdminRoleForm } from "@/components/admin/admin-user-forms";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { listAdminUsers } from "@/db/queries/admin";
import { requirePermission } from "@/lib/auth/guards";
import { ROLE_DESCRIPTIONS, permissionsForRole } from "@/lib/auth/permissions";
import { publicEnv } from "@/lib/env";
import { adsAreServable } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

/**
 * Site settings and administrator accounts. Owner-only.
 *
 * The configuration panel is read-only and reflects the actual environment —
 * deliberately. Editing ad or analytics configuration at runtime, from a web
 * form, is how a site ends up collecting data nobody disclosed. Those values
 * live in environment variables and change through deployment.
 */
export default async function AdminSettingsPage() {
  const admin = await requirePermission("settings:write", "/admin/settings");

  const users = await listAdminUsers();

  const config = [
    { label: "Site name", value: publicEnv.siteName },
    { label: "Canonical URL", value: publicEnv.siteUrl },
    { label: "Contact address", value: publicEnv.contactEmail },
    { label: "Takedown address", value: publicEnv.takedownEmail },
    {
      label: "Advertising",
      value: adsAreServable
        ? "Enabled"
        : publicEnv.adsEnabled
          ? "Enabled but no ad client configured — nothing will render"
          : "Disabled",
    },
    {
      label: "Analytics",
      value: publicEnv.analyticsEnabled
        ? publicEnv.analyticsEndpoint
          ? "Enabled, consent-gated"
          : "Enabled but no endpoint configured — no data is sent"
        : "Disabled",
    },
    {
      label: "Permitted image hosts",
      value: publicEnv.imageHosts.length > 0 ? publicEnv.imageHosts.join(", ") : "None configured",
    },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-heading text-ink font-semibold">Settings</h1>
        <p className="text-ink-muted mt-2 text-sm">
          Configuration is read from environment variables. Change it through deployment, not here.
        </p>
      </header>

      {/* ---- Configuration ------------------------------------------------ */}
      <section aria-labelledby="config-heading" className="space-y-4">
        <h2 id="config-heading" className="text-ink text-base font-semibold">
          Configuration
        </h2>

        <dl className="divide-line rounded-panel border-line bg-surface divide-y overflow-hidden border">
          {config.map((entry) => (
            <div key={entry.label} className="flex flex-wrap justify-between gap-3 px-4 py-3">
              <dt className="text-ink-muted text-sm">{entry.label}</dt>
              <dd className="text-ink text-sm">{entry.value}</dd>
            </div>
          ))}
        </dl>

        <Alert tone="info" className="text-xs">
          Ad and analytics toggles are deliberately not editable at runtime. Enabling advertising
          requires provider approval, and enabling analytics requires the privacy notice to be
          updated first — both are deployment decisions.
        </Alert>
      </section>

      {/* ---- Roles -------------------------------------------------------- */}
      <section aria-labelledby="roles-heading" className="space-y-4">
        <h2 id="roles-heading" className="text-ink text-base font-semibold">
          Role permissions
        </h2>

        <ul className="space-y-3">
          {(["editor", "admin", "owner"] as const).map((role) => (
            <li key={role} className="rounded-panel border-line bg-surface border p-4">
              <p className="text-ink text-sm font-medium capitalize">{role}</p>
              <p className="text-ink-muted mt-1 text-xs">{ROLE_DESCRIPTIONS[role]}</p>
              <p className="text-2xs text-ink-subtle mt-2 font-mono">
                {permissionsForRole(role).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Accounts ----------------------------------------------------- */}
      <section aria-labelledby="accounts-heading" className="space-y-4">
        <h2 id="accounts-heading" className="text-ink text-base font-semibold">
          Administrator accounts ({users.length})
        </h2>

        <p className="text-ink-subtle text-xs">
          New accounts are created from the command line with{" "}
          <code className="bg-surface-raised rounded px-1 py-0.5">pnpm admin:create</code>. There is
          no self-service sign-up.
        </p>

        <ul className="space-y-4">
          {users.map((user) => (
            <li key={user.id} className="rounded-panel border-line bg-surface border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-ink text-sm font-medium">
                    {user.displayName}
                    {user.id === admin.id ? (
                      <span className="text-ink-subtle ml-2 text-xs">(you)</span>
                    ) : null}
                  </p>
                  <p className="text-ink-muted text-xs">{user.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {user.role ? (
                    <Badge tone={user.role === "owner" ? "accent" : "neutral"}>{user.role}</Badge>
                  ) : (
                    <Badge tone="danger">no role</Badge>
                  )}
                  <Badge tone={user.isActive ? "success" : "neutral"}>
                    {user.isActive ? "active" : "disabled"}
                  </Badge>
                </div>
              </div>

              <p className="text-ink-subtle mt-2 text-xs">
                Last signed in: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "never"}
              </p>

              <div className="mt-4 space-y-3">
                <AdminRoleForm
                  userId={user.id}
                  currentRole={user.role ?? "editor"}
                  disabled={!user.isActive}
                />
                <AdminActiveForm userId={user.id} isActive={user.isActive} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
