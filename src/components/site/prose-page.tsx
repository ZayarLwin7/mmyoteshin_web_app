import type { ReactNode } from "react";

import { publicEnv } from "@/lib/env";

/**
 * Shared layout for editorial and policy pages.
 *
 * Long-form text is set at a comfortable measure with generous leading, and the
 * "last updated" line is rendered on every policy page — a policy without a
 * date is not much use to a reader deciding whether to rely on it.
 */
export function ProsePage({
  eyebrow,
  title,
  summary,
  lastUpdated,
  children,
}: {
  eyebrow?: string;
  title: string;
  summary?: string;
  lastUpdated?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page py-12">
      <article className="mx-auto max-w-[68ch]">
        <header className="border-line mb-10 border-b pb-8">
          {eyebrow ? <p className="text-eyebrow mb-3">{eyebrow}</p> : null}
          <h1 className="text-title text-ink font-semibold">{title}</h1>
          {summary ? <p className="text-ink-muted mt-4 text-base">{summary}</p> : null}
          {lastUpdated ? (
            <p className="text-ink-subtle mt-4 text-xs">Last updated {lastUpdated}</p>
          ) : null}
        </header>

        <div className="text-ink-muted [&_a:hover]:text-accent [&_h2]:text-heading [&_h2]:text-ink [&_h3]:text-ink [&_strong]:text-ink space-y-6 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:font-semibold [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </div>
  );
}

/** Standard footer block pointing readers at the takedown route. */
export function PolicyContactNote({ purpose }: { purpose: string }) {
  return (
    <div className="rounded-panel border-line bg-surface mt-10 border p-5">
      <h2 className="text-ink text-sm font-semibold">Contacting us</h2>
      <p className="text-ink-muted mt-2 text-sm">
        For {purpose}, email{" "}
        <a href={`mailto:${publicEnv.takedownEmail}`} className="text-accent">
          {publicEnv.takedownEmail}
        </a>
        . General enquiries go to{" "}
        <a href={`mailto:${publicEnv.contactEmail}`} className="text-accent">
          {publicEnv.contactEmail}
        </a>
        .
      </p>
    </div>
  );
}
