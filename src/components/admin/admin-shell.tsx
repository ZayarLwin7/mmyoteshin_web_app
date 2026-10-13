import Link from "next/link";

import { signOutAction } from "@/lib/actions/auth";
import { roleHasPermission, type Permission } from "@/lib/auth/permissions";
import type { CurrentAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

import { AdminNavLink } from "./admin-nav-link";

/**
 * Admin shell: persistent sidebar navigation plus the signed-in identity.
 *
 * Navigation entries are filtered by permission so the UI does not advertise
 * actions the account cannot perform. This is a usability measure only — every
 * route and action re-checks the permission on the server.
 */

type NavItem = {
  href: string;
  label: string;
  permission: Permission;
  /** Only highlight on an exact match (used for the overview link). */
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", permission: "movie:read", exact: true },
  { href: "/admin/movies", label: "Films", permission: "movie:read" },
  { href: "/admin/reviews", label: "Reviews", permission: "review:write" },
  { href: "/admin/genres", label: "Genres", permission: "genre:write" },
  { href: "/admin/links", label: "Links", permission: "link:write" },
  { href: "/admin/reports", label: "Reports", permission: "report:read" },
  { href: "/admin/audit", label: "Audit log", permission: "audit:read" },
  { href: "/admin/settings", label: "Settings", permission: "settings:write" },
];

export function AdminShell({
  admin,
  openReportCount,
  pendingLinkCount,
  children,
}: {
  admin: CurrentAdmin;
  openReportCount: number;
  pendingLinkCount: number;
  children: React.ReactNode;
}) {
  const visibleItems = NAV_ITEMS.filter((item) => roleHasPermission(admin.role, item.permission));

  function badgeFor(href: string) {
    if (href === "/admin/reports" && openReportCount > 0) return openReportCount;
    if (href === "/admin/links" && pendingLinkCount > 0) return pendingLinkCount;
    return null;
  }

  return (
    <div className="bg-canvas min-h-dvh">
      {/* Admin gets its own chrome; the public header/footer are suppressed by
          the route group layout. */}
      <header className="border-line bg-surface-sunken sticky top-0 z-40 border-b">
        <div className="container-page flex h-14 items-center gap-4">
          <Link href="/admin" className="text-ink text-sm font-semibold">
            MM YoteShin <span className="text-ink-subtle">· Admin</span>
          </Link>

          <Link
            href="/"
            className="text-ink-muted hover:text-accent ml-auto text-xs underline underline-offset-4"
          >
            View public site
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-ink-subtle hidden text-xs sm:inline">
              {admin.displayName} · {admin.role}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="border-line-strong text-ink-muted hover:border-accent hover:text-accent rounded-full border px-3 py-1.5 text-xs transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="container-page flex flex-col gap-8 py-8 lg:flex-row">
        <nav aria-label="Admin sections" className="lg:w-52 lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {visibleItems.map((item) => {
              const badge = badgeFor(item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <AdminNavLink
                    href={item.href}
                    exact={item.exact}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                    )}
                  >
                    <span>{item.label}</span>
                    {badge ? (
                      <span className="bg-accent text-2xs text-accent-ink rounded-full px-1.5 py-0.5 font-semibold">
                        {badge}
                      </span>
                    ) : null}
                  </AdminNavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
