import Link from "next/link";

import { Badge, statusTone } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import {
  getAdminStats,
  listAdminReports,
  listAuditEntries,
  listStaleLinks,
} from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDate, formatDateTime, humaniseEnum, truncate } from "@/lib/utils";

/**
 * Admin overview.
 *
 * Answers the two operational questions that matter each morning: what needs
 * attention, and did anything change that I should know about.
 */
export default async function AdminOverviewPage() {
  const admin = await requireAdmin("/admin");

  const [stats, openReports, staleLinks, recentAudit] = await Promise.all([
    getAdminStats(),
    listAdminReports({ status: "new", limit: 5 }),
    listStaleLinks(180),
    listAuditEntries({ limit: 10 }),
  ]);

  const attentionItems: { label: string; href: string; count: number }[] = [
    {
      label: "Reports awaiting review",
      href: "/admin/reports?status=new",
      count: stats.reports.open,
    },
    {
      label: "Links awaiting authorization",
      href: "/admin/links?status=pending_review",
      count: stats.links.pendingReview,
    },
    { label: "Draft films", href: "/admin/movies?status=draft", count: stats.movies.draft },
    { label: "Links not checked recently", href: "/admin/links", count: staleLinks.length },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-heading text-ink font-semibold">Overview</h1>
        <p className="text-ink-muted mt-2 text-sm">
          Signed in as {admin.displayName} ({admin.role}).
        </p>
      </header>

      {/* ---- Counts ------------------------------------------------------ */}
      <section aria-labelledby="counts-heading">
        <h2 id="counts-heading" className="sr-only">
          Catalogue counts
        </h2>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Published films"
            value={stats.movies.published}
            sublabel={`${stats.movies.total} total · ${stats.movies.draft} draft`}
            href="/admin/movies?status=published"
          />
          <StatCard
            label="Active links"
            value={stats.links.active}
            sublabel={`${stats.links.pendingReview} awaiting review`}
            href="/admin/links?status=active"
          />
          <StatCard
            label="Published reviews"
            value={stats.reviews.published}
            sublabel={`${stats.reviews.total} total`}
            href="/admin/reviews"
          />
          <StatCard
            label="Open reports"
            value={stats.reports.open}
            sublabel={`${stats.reports.total} all time`}
            href="/admin/reports"
          />
        </dl>
      </section>

      {/* ---- Needs attention --------------------------------------------- */}
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-ink mb-4 text-base font-semibold">
          Needs attention
        </h2>

        {attentionItems.length === 0 ? (
          <Alert tone="success">Nothing is waiting. The catalogue is fully reviewed.</Alert>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {attentionItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-panel border-line bg-surface hover:border-accent flex items-center justify-between border px-4 py-3 transition-colors"
                >
                  <span className="text-ink text-sm">{item.label}</span>
                  <span className="text-accent text-lg font-semibold">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Newest reports --------------------------------------------- */}
      {openReports.length > 0 ? (
        <section aria-labelledby="reports-heading">
          <h2 id="reports-heading" className="text-ink mb-4 text-base font-semibold">
            Newest reports
          </h2>

          <ul className="divide-line rounded-panel border-line bg-surface divide-y overflow-hidden border">
            {openReports.map(({ report, movieTitle }) => (
              <li key={report.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(report.status)}>{humaniseEnum(report.status)}</Badge>
                  <span className="text-ink-subtle text-xs">
                    {humaniseEnum(report.reason)} · {formatDateTime(report.createdAt)}
                  </span>
                </div>
                <p className="text-ink mt-2 text-sm">
                  {movieTitle ?? "Unknown film"}: {truncate(report.details, 160)}
                </p>
                <Link
                  href={`/admin/reports/${report.id}`}
                  className="text-accent mt-2 inline-block text-xs underline underline-offset-4"
                >
                  Review this report
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Stale links ------------------------------------------------- */}
      {staleLinks.length > 0 ? (
        <section aria-labelledby="stale-heading">
          <h2 id="stale-heading" className="text-ink mb-4 text-base font-semibold">
            Links due a re-check
          </h2>
          <Alert tone="warning" className="mb-4">
            These links are live but have not been verified in over six months. Confirm each
            destination still resolves to the authorized distribution before leaving it up.
          </Alert>

          <ul className="divide-line rounded-panel border-line bg-surface divide-y overflow-hidden border">
            {staleLinks.slice(0, 6).map(({ link, movieTitle }) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-ink text-sm">{link.label}</p>
                  <p className="text-ink-subtle text-xs">
                    {movieTitle} · {link.destinationHost} ·{" "}
                    {link.lastCheckedAt
                      ? `checked ${formatDate(link.lastCheckedAt)}`
                      : "never checked"}
                  </p>
                </div>
                <Link
                  href={`/admin/links?status=${link.status}`}
                  className="text-accent text-xs underline underline-offset-4"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Recent activity --------------------------------------------- */}
      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-ink mb-4 text-base font-semibold">
          Recent activity
        </h2>

        {recentAudit.length === 0 ? (
          <Alert tone="info">No privileged changes recorded yet.</Alert>
        ) : (
          <ul className="divide-line rounded-panel border-line bg-surface divide-y overflow-hidden border">
            {recentAudit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-2 p-4"
              >
                <div className="min-w-0">
                  <p className="text-ink text-sm">{entry.summary}</p>
                  <p className="text-ink-subtle text-xs">
                    {entry.actorEmail ?? "system"} · {humaniseEnum(entry.action)}
                  </p>
                </div>
                <time className="text-ink-subtle text-xs" dateTime={entry.createdAt.toISOString()}>
                  {formatDateTime(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  href,
}: {
  label: string;
  value: number;
  sublabel?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-panel border-line bg-surface hover:border-accent border p-5 transition-colors"
    >
      <dt className="text-ink-subtle text-xs">{label}</dt>
      <dd className="text-ink mt-1 text-3xl font-semibold">{value}</dd>
      {sublabel ? <p className="text-ink-subtle mt-1 text-xs">{sublabel}</p> : null}
    </Link>
  );
}
