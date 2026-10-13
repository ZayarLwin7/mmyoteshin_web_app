import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { countOpenReports, countLinksPendingReview } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * Authenticated admin layout.
 *
 * This is the enforcement point for "you must be signed in to be here". The
 * `requireAdmin` call redirects to sign-in when there is no valid session, and
 * re-reads the account's role from the database — so disabling an account or
 * changing a role takes effect on the very next request.
 *
 * Every nested page additionally checks the specific permission it needs; this
 * layout only establishes that *some* valid administrator is present.
 *
 * Note: this lives in the `(dashboard)` route group so that `/admin/login` and
 * `/admin/forbidden` sit outside the guard and cannot lock themselves out.
 */

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · MM YoteShin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("/admin");

  const [openReportCount, pendingLinkCount] = await Promise.all([
    countOpenReports(),
    countLinksPendingReview(),
  ]);

  return (
    <AdminShell admin={admin} openReportCount={openReportCount} pendingLinkCount={pendingLinkCount}>
      {children}
    </AdminShell>
  );
}
