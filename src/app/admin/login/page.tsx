import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { getCurrentAdmin } from "@/lib/auth/guards";
import { safeInternalRedirect } from "@/lib/security/url";

/**
 * Admin sign-in.
 *
 * Lives outside the authenticated route group so it does not guard itself.
 * An already-signed-in visitor is sent straight through, and the `next`
 * parameter is allow-listed to a same-origin path before it is used.
 */
export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const existing = await getCurrentAdmin();
  if (existing) redirect("/admin");

  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : undefined;
  const redirectTo = rawNext ? safeInternalRedirect(rawNext, "/admin") : undefined;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-ink text-lg font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            MM YoteShin
          </Link>
          <h1 className="text-heading text-ink mt-6 font-semibold">Administrator sign-in</h1>
          <p className="text-ink-muted mt-2 text-sm">
            This area is for the editorial team. All activity is logged.
          </p>
        </div>

        <div className="rounded-panel border-line bg-surface border p-6">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}
