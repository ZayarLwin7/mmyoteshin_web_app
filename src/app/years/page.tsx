import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/ui/feedback";
import { listYearsWithCounts } from "@/db/queries/public";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Release years",
  description: "Browse the catalogue by release year.",
  alternates: { canonical: "/years" },
};

export default async function YearsPage() {
  const years = await listYearsWithCounts();

  return (
    <div className="container-page py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-eyebrow mb-2">Browse</p>
        <h1 className="text-title text-ink font-semibold">Release years</h1>
        <p className="text-ink-muted mt-3 text-sm">
          Years with at least one published film in the catalogue.
        </p>
      </header>

      {years.length === 0 ? (
        <EmptyState
          title="No years yet"
          description="Years appear here once films have been published."
        />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {years.map((entry) => (
            <li key={entry.year}>
              {/*
                Same three-state treatment as the buttons: hover = interactive
                (tinted fill, accent border), active = pressed (deeper fill,
                accent text, slight shrink). A chip that only changes its
                border colour on hover reads as static text.
              */}
              <Link
                href={`/years/${entry.year}`}
                className="border-line-strong bg-surface text-ink-muted hover:border-accent hover:bg-accent/10 hover:text-accent active:border-accent active:bg-accent/25 active:text-accent focus-visible:outline-accent inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]"
              >
                {entry.year}
                <span className="text-ink-subtle text-xs">{entry.movieCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
