import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/feedback";
import { listAuditEntries } from "@/db/queries/admin";
import { requirePermission } from "@/lib/auth/guards";
import { formatDateTime, humaniseEnum } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

/**
 * Audit log.
 *
 * Every privileged change is recorded: publishing, archiving, link
 * activation/deactivation, report resolution, role changes. Metadata is limited
 * to non-sensitive scalars — no authorization evidence, tokens or report bodies
 * are stored here.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("audit:read", "/admin/audit");

  const params = await searchParams;
  const entityType = typeof params.entity === "string" ? params.entity : undefined;

  const entries = await listAuditEntries({ entityType, limit: 200 });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-heading text-ink font-semibold">Audit log</h1>
        <p className="text-ink-muted mt-2 text-sm">
          A record of privileged changes. Entries cannot be edited or deleted from the application.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          title="No audit entries yet"
          description="Privileged changes will appear here."
        />
      ) : (
        <div className="rounded-panel border-line bg-surface overflow-x-auto border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Audit log entries</caption>
            <thead className="border-line text-ink-subtle border-b text-xs">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Actor
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="text-ink-subtle px-4 py-3 text-xs whitespace-nowrap">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="text-ink-muted px-4 py-3 text-xs">
                    {entry.actorEmail ?? "system"}
                  </td>
                  <td className="text-ink-muted px-4 py-3 text-xs">{humaniseEnum(entry.action)}</td>
                  <td className="text-ink px-4 py-3">{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
