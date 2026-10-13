import type { Metadata } from "next";
import Link from "next/link";

import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { listAdminReports } from "@/db/queries/admin";
import { requirePermission } from "@/lib/auth/guards";
import { formatDateTime, humaniseEnum, truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const STATUSES = ["all", "new", "under_review", "resolved", "rejected"] as const;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("report:read", "/admin/reports");

  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "all";
  const status = (STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as (typeof STATUSES)[number])
    : "all";

  const reports = await listAdminReports({ status });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-heading text-ink font-semibold">Content reports</h1>
        <p className="text-ink-muted mt-2 text-sm">
          Reports about links are taken out of public view automatically when they arrive. Review
          each one and record an outcome.
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/reports" : `/admin/reports?status=${value}`}
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

      {reports.length === 0 ? (
        <EmptyState title="No reports match" description="Nothing in this queue." />
      ) : (
        <ul className="divide-line rounded-panel border-line bg-surface divide-y overflow-hidden border">
          {reports.map(({ report, movieTitle, linkLabel, linkProvider }) => (
            <li key={report.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(report.status)}>{humaniseEnum(report.status)}</Badge>
                <Badge tone="neutral">{humaniseEnum(report.reason)}</Badge>
                <span className="text-ink-subtle text-xs">{formatDateTime(report.createdAt)}</span>
              </div>

              <p className="text-ink mt-2 text-sm">{truncate(report.details, 200)}</p>

              <p className="text-ink-muted mt-1 text-xs">
                {movieTitle ?? "Unknown film"}
                {linkLabel ? ` · ${linkProvider} — ${linkLabel}` : " · film-level report"}
                {report.reporterContact ? " · contact provided" : " · anonymous"}
              </p>

              <Link
                href={`/admin/reports/${report.id}`}
                className="text-accent mt-2 inline-block text-xs underline underline-offset-4"
              >
                Open and resolve
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
