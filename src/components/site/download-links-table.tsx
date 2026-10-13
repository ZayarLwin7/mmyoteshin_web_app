import Link from "next/link";

import { formatFileSize } from "@/lib/utils";

/**
 * Authorized download options, as a table.
 *
 * Columns mirror what a visitor actually compares when choosing a source:
 * which server, how large the file is, and at what resolution. The server name
 * is the only interactive element, and it leads to our own ad-supported
 * hand-off page (`/download/[id]`) rather than straight off-site, so the
 * destination is disclosed before anyone leaves the site.
 *
 * Only links that are `active` AND carry a recorded authorization basis reach
 * this component — the filtering happens in the public query layer, not here.
 */

export type PublicDownloadLink = {
  id: string;
  providerName: string;
  destinationHost: string;
  label: string;
  quality: string | null;
  fileSizeBytes: string | null;
  language: string | null;
};

/** Resolution badge. The label always states the value, never colour alone. */
function ResolutionBadge({ quality }: { quality: string | null }) {
  if (!quality) {
    return <span className="text-ink-subtle text-xs">—</span>;
  }

  const normalised = quality.trim().toLowerCase();
  const isFullHd = normalised.startsWith("1080");
  const isHd = normalised.startsWith("720");

  const tier = isFullHd ? "FULL HD" : isHd ? "HD" : null;

  return (
    <span
      className={
        "inline-flex min-w-[4.5rem] flex-col items-center justify-center rounded border px-2 py-1 leading-none " +
        (isFullHd
          ? "border-accent-dim bg-accent/10 text-accent"
          : isHd
            ? "border-warning/40 bg-warning/10 text-warning"
            : "border-line-strong bg-surface-raised text-ink-muted")
      }
    >
      <span className="text-sm font-semibold">{normalised}</span>
      {tier ? (
        <span className="mt-0.5 text-[0.5rem] font-medium tracking-wider">{tier}</span>
      ) : null}
    </span>
  );
}

export function DownloadLinksTable({ links }: { links: PublicDownloadLink[] }) {
  return (
    <div className="rounded-panel border-line bg-surface overflow-x-auto border">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">
          Authorized download options, with the file size and resolution of each
        </caption>

        <thead className="border-line text-ink-subtle border-b text-xs">
          <tr>
            <th scope="col" className="w-16 px-4 py-3 font-medium">
              No
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Server Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Size
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Resolution
            </th>
          </tr>
        </thead>

        <tbody className="divide-line divide-y">
          {links.map((link, index) => {
            const size = formatFileSize(link.fileSizeBytes);

            return (
              <tr key={link.id} className="align-middle">
                <td className="text-ink-subtle px-4 py-4 tabular-nums">{index + 1}</td>

                <td className="px-4 py-4">
                  <Link
                    href={`/download/${link.id}`}
                    className="text-accent font-medium underline-offset-4 hover:underline"
                  >
                    {link.providerName}
                  </Link>
                  <span className="sr-only">
                    {" "}
                    — {link.label}, opens a page with the download option
                  </span>
                  <p className="text-2xs text-ink-subtle mt-0.5">{link.label}</p>
                </td>

                <td className="text-ink-muted px-4 py-4 whitespace-nowrap">
                  {size ?? <span className="text-ink-subtle">—</span>}
                </td>

                <td className="px-4 py-4">
                  <ResolutionBadge quality={link.quality} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
