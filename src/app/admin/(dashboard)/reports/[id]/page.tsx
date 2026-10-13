import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkUnderReviewForm } from "@/components/admin/mark-under-review-form";
import { ReportResolutionForm } from "@/components/admin/report-resolution-form";
import { Badge, statusTone } from "@/components/ui/badge";
import { Alert } from "@/components/ui/feedback";
import { getAdminReportById } from "@/db/queries/admin";
import { resolveReportAction } from "@/lib/actions/reports";
import { requirePermission } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatDateTime, humaniseEnum } from "@/lib/utils";

export const metadata: Metadata = { title: "Report" };

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requirePermission("report:read", `/admin/reports/${id}`);

  const row = await getAdminReportById(id);
  if (!row) notFound();

  const { report, movie, link } = row;
  const canResolve = roleHasPermission(admin.role, "report:resolve");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(report.status)}>{humaniseEnum(report.status)}</Badge>
          <Badge tone="neutral">{humaniseEnum(report.reason)}</Badge>
          <span className="text-ink-subtle text-xs">Filed {formatDateTime(report.createdAt)}</span>
        </div>
        <h1 className="text-heading text-ink font-semibold">Report details</h1>
      </header>

      {report.reporterContact ? (
        <Alert tone="info">
          Reporter left a contact address:{" "}
          <strong className="text-ink">{report.reporterContact}</strong>
        </Alert>
      ) : (
        <Alert tone="info">Filed anonymously — no reply address was provided.</Alert>
      )}

      <section className="rounded-panel border-line bg-surface border p-5">
        <h2 className="text-ink mb-3 text-sm font-semibold">What the reporter said</h2>
        <p className="text-ink-muted text-sm whitespace-pre-line">{report.details}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-panel border-line bg-surface border p-5">
          <h2 className="text-ink mb-3 text-sm font-semibold">Film</h2>
          {movie ? (
            <>
              <p className="text-ink text-sm">{movie.title}</p>
              <p className="text-ink-subtle mt-1 text-xs">
                Status: {humaniseEnum(movie.status)}
                {movie.publishedAt ? ` · published ${formatDateTime(movie.publishedAt)}` : ""}
              </p>
              <Link
                href={`/admin/movies/${movie.id}`}
                className="text-accent mt-3 inline-block text-xs underline underline-offset-4"
              >
                Open the film in admin
              </Link>
            </>
          ) : (
            <p className="text-ink-muted text-sm">The film record no longer exists.</p>
          )}
        </div>

        <div className="rounded-panel border-line bg-surface border p-5">
          <h2 className="text-ink mb-3 text-sm font-semibold">Reported link</h2>
          {link ? (
            <>
              <p className="text-ink text-sm">{link.label}</p>
              <p className="text-ink-subtle mt-1 text-xs">
                {link.providerName} · {link.destinationHost}
              </p>
              <p className="mt-2">
                <Badge tone={statusTone(link.status)}>{humaniseEnum(link.status)}</Badge>
              </p>
              <p className="text-ink-subtle mt-2 text-xs">
                Authorization basis: {humaniseEnum(link.authorizationBasis)}
                {link.authorizedAt
                  ? ` · authorized ${formatDateTime(link.authorizedAt)}`
                  : " · never authorized"}
              </p>
            </>
          ) : (
            <p className="text-ink-muted text-sm">
              This is a film-level report, or the link record has been removed.
            </p>
          )}
        </div>
      </section>

      {report.resolutionNotes ? (
        <Alert tone="info" title="Existing internal notes">
          <p className="whitespace-pre-line">{report.resolutionNotes}</p>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-ink text-base font-semibold">Record an outcome</h2>

        <div className="rounded-panel border-line bg-surface border p-5">
          <ReportResolutionForm
            action={resolveReportAction}
            reportId={report.id}
            currentStatus={report.status}
            hasLinkedReport={Boolean(link)}
            canResolve={canResolve}
          />
        </div>

        {canResolve ? <MarkUnderReviewForm reportId={report.id} /> : null}
      </section>

      <div className="border-line border-t pt-6">
        <Link
          href="/admin/reports"
          className="text-ink-muted hover:text-accent text-sm underline underline-offset-4"
        >
          ← Back to all reports
        </Link>
      </div>
    </div>
  );
}
