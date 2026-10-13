import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge, statusTone } from "@/components/ui/badge";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { listAdminLinks, listStaleLinks } from "@/db/queries/admin";
import { activateLinkAction, disableLinkAction, markLinkCheckedAction } from "@/lib/actions/links";
import { requirePermission } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatDate, formatFileSize, humaniseEnum } from "@/lib/utils";

export const metadata: Metadata = { title: "Links" };

const STATUSES = ["all", "pending_review", "active", "disabled", "reported"] as const;

/**
 * Link governance queue.
 *
 * This is the page an operator works from when reviewing authorization, and the
 * page they open first when a report comes in. Links are grouped by status so
 * the queue is obvious rather than buried.
 */
export default async function AdminLinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePermission("link:write", "/admin/links");

  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "all";
  const status = (STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as (typeof STATUSES)[number])
    : "all";

  const [links, stale] = await Promise.all([listAdminLinks({ status }), listStaleLinks(180)]);

  const canAuthorize = roleHasPermission(admin.role, "link:authorize");
  const canDisable = roleHasPermission(admin.role, "link:disable");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-heading text-ink font-semibold">Authorized links</h1>
        <p className="text-ink-muted mt-2 text-sm">
          Every link must carry a recorded authorization basis and a private reference before it can
          be activated. Only active links are shown publicly.
        </p>
      </header>

      {stale.length > 0 ? (
        <Alert tone="warning" title={`${stale.length} link(s) overdue a re-check`}>
          Live links that have not been verified in over six months. Confirm the destination still
          resolves to the authorized distribution.
        </Alert>
      ) : null}

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/links" : `/admin/links?status=${value}`}
            aria-current={value === status ? "page" : undefined}
            className={
              value === status
                ? "border-accent bg-accent/10 text-accent rounded-full border px-3 py-1.5 text-xs"
                : "border-line-strong text-ink-muted hover:border-accent hover:text-accent rounded-full border px-3 py-1.5 text-xs transition-colors"
            }
          >
            {value === "all" ? "All" : humaniseEnum(value)}
          </Link>
        ))}
      </nav>

      {links.length === 0 ? (
        <EmptyState
          title="No links match"
          description="Links are added from a film's admin page."
        />
      ) : (
        <ul className="space-y-4">
          {links.map(({ link, movieTitle, movieSlug }) => (
            <li key={link.id} className="rounded-panel border-line bg-surface border p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(link.status)}>{humaniseEnum(link.status)}</Badge>
                <span className="text-ink-subtle text-xs">
                  {humaniseEnum(link.authorizationBasis)}
                  {link.authorizedAt ? ` · authorized ${formatDate(link.authorizedAt)}` : ""}
                  {link.lastCheckedAt
                    ? ` · checked ${formatDate(link.lastCheckedAt)}`
                    : " · never checked"}
                </span>
              </div>

              <p className="text-ink mt-2 text-sm font-medium">{link.label}</p>
              <p className="text-ink-muted mt-1 text-xs">
                {movieTitle} · {link.providerName} · {link.destinationHost}
                {link.quality ? ` · ${link.quality}` : ""}
                {formatFileSize(link.fileSizeBytes)
                  ? ` · ${formatFileSize(link.fileSizeBytes)}`
                  : ""}
              </p>

              <p className="text-ink-subtle mt-1 text-xs">
                Public URL:{" "}
                <Link
                  href={`/movies/${movieSlug}`}
                  className="text-accent underline underline-offset-4"
                >
                  /movies/{movieSlug}
                </Link>
              </p>

              {link.status !== "active" && !link.authorizationReference ? (
                <p className="text-danger mt-2 text-xs">
                  Missing private authorization reference — this link cannot be activated.
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                {link.status !== "active" && canAuthorize ? (
                  <ConfirmAction
                    action={activateLinkAction}
                    hiddenFields={{ id: link.id, movieId: link.movieId }}
                    label="Activate"
                    confirmLabel="Yes, activate"
                    description="The link becomes publicly visible on the film page."
                    variant="primary"
                  />
                ) : null}

                {link.status === "active" && canDisable ? (
                  <ConfirmAction
                    action={disableLinkAction}
                    hiddenFields={{
                      id: link.id,
                      movieId: link.movieId,
                      reason: "Disabled from the link queue.",
                    }}
                    label="Disable"
                    confirmLabel="Yes, disable"
                    description="The link immediately stops being publicly visible."
                  />
                ) : null}

                {link.status === "active" ? (
                  <ConfirmAction
                    action={markLinkCheckedAction}
                    hiddenFields={{ id: link.id, movieId: link.movieId }}
                    label="Mark checked"
                    confirmLabel="Yes, record check"
                    description="Records that the destination was verified today."
                  />
                ) : null}

                <Link
                  href={`/admin/movies/${link.movieId}`}
                  className="text-ink-muted hover:text-accent inline-flex h-8 items-center rounded-full px-3 text-sm underline underline-offset-4"
                >
                  Open film
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
