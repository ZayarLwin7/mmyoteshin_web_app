import type { Metadata } from "next";
import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { getCurrentAdmin } from "@/lib/auth/guards";
import { humaniseEnum } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

/**
 * Shown when a signed-in account lacks the permission for a route.
 *
 * Deliberately explicit about *which* permission was missing: the user is
 * already authenticated, so hiding the reason only generates support requests.
 * The permission name is not sensitive — it is documented in docs/security.md.
 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [admin, params] = await Promise.all([getCurrentAdmin(), searchParams]);
  const required = typeof params.required === "string" ? params.required : null;

  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-eyebrow mb-4">403</p>
      <h1 className="text-title text-ink font-semibold">You do not have access to that area</h1>

      <p className="text-ink-muted mt-4 max-w-md text-sm">
        {admin ? (
          <>
            You are signed in as <strong className="text-ink">{admin.email}</strong> with the{" "}
            <strong className="text-ink">{admin.role}</strong> role.
          </>
        ) : (
          "You are not signed in."
        )}
      </p>

      {required ? (
        <p className="text-ink-subtle mt-3 text-xs">
          That page requires the{" "}
          <code className="bg-surface-raised rounded px-1 py-0.5">{required}</code> permission (
          {humaniseEnum(required)}).
        </p>
      ) : null}

      <p className="text-ink-muted mt-4 max-w-md text-sm">
        If you need this access, ask an owner to change your role.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/admin">Back to the overview</LinkButton>
        <Link
          href="/"
          className="text-ink-muted hover:text-accent inline-flex h-10 items-center rounded-full px-5 text-sm underline underline-offset-4"
        >
          Return to the public site
        </Link>
      </div>
    </div>
  );
}
