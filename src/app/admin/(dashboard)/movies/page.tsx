import type { Metadata } from "next";
import Link from "next/link";

import { Badge, statusTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination } from "@/components/site/pagination";
import { listAdminMovies } from "@/db/queries/admin";
import { requirePermission } from "@/lib/auth/guards";
import { formatDate, humaniseEnum } from "@/lib/utils";

export const metadata: Metadata = { title: "Films" };

const STATUS_FILTERS = ["all", "draft", "published", "archived"] as const;

export default async function AdminMoviesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("movie:read", "/admin/movies");

  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "all";
  const status = (STATUS_FILTERS as readonly string[]).includes(rawStatus)
    ? (rawStatus as (typeof STATUS_FILTERS)[number])
    : "all";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);

  const result = await listAdminMovies({ status, q, page });

  function buildHref(targetPage: number) {
    const search = new URLSearchParams();
    if (status !== "all") search.set("status", status);
    if (q) search.set("q", q);
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return query ? `/admin/movies?${query}` : "/admin/movies";
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-heading text-ink font-semibold">Films</h1>
          <p className="text-ink-muted mt-2 text-sm">
            {result.total} record{result.total === 1 ? "" : "s"}
            {status !== "all" ? ` · ${humaniseEnum(status)}` : ""}
          </p>
        </div>

        <LinkButton href="/admin/movies/new">New film</LinkButton>
      </header>

      {/* ---- Filters ------------------------------------------------------ */}
      <form
        method="get"
        action="/admin/movies"
        className="rounded-panel border-line bg-surface flex flex-wrap items-end gap-3 border p-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-q" className="text-ink-muted text-xs font-medium">
            Search
          </label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Title"
            className="border-line-strong bg-surface-sunken text-ink placeholder:text-ink-subtle h-10 w-56 rounded-lg border px-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-status" className="text-ink-muted text-xs font-medium">
            Status
          </label>
          <select
            id="admin-status"
            name="status"
            defaultValue={status}
            className="border-line-strong bg-surface-sunken text-ink h-10 rounded-lg border px-3 text-sm"
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : humaniseEnum(value)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="bg-accent text-accent-ink hover:bg-accent-strong h-10 rounded-full px-5 text-sm font-medium transition-colors"
        >
          Apply
        </button>

        <Link
          href="/admin/movies"
          className="text-ink-muted hover:text-accent text-sm underline underline-offset-4"
        >
          Clear
        </Link>
      </form>

      {/* ---- Table -------------------------------------------------------- */}
      {result.items.length === 0 ? (
        <EmptyState
          title="No films match"
          description="Adjust the filters, or create a new film record."
          action={<LinkButton href="/admin/movies/new">New film</LinkButton>}
        />
      ) : (
        <>
          <div className="rounded-panel border-line bg-surface overflow-x-auto border">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">Film records</caption>
              <thead className="border-line text-ink-subtle border-b text-xs">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Title
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Year
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Genres
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Active links
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {result.items.map((movie) => (
                  <tr key={movie.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/movies/${movie.id}`}
                          className="text-ink hover:text-accent font-medium"
                        >
                          {movie.title}
                        </Link>
                        {/*
                          A series is a different section of the site, not just a
                          longer film, so the list says which one this record is.
                        */}
                        {movie.contentKind === "series" ? (
                          <Badge tone="accent">Series</Badge>
                        ) : null}
                      </div>
                      <p className="text-ink-subtle mt-0.5 font-mono text-xs">/{movie.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(movie.status)}>{humaniseEnum(movie.status)}</Badge>
                      {movie.featured ? (
                        <Badge tone="accent" className="ml-1">
                          Featured
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-ink-muted px-4 py-3">{movie.releaseYear ?? "—"}</td>
                    <td className="text-ink-muted px-4 py-3">{movie.genreCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={movie.activeLinkCount > 0 ? "text-success" : "text-ink-subtle"}
                      >
                        {movie.activeLinkCount}
                      </span>
                    </td>
                    <td className="text-ink-subtle px-4 py-3 text-xs">
                      {formatDate(movie.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/movies/${movie.id}`}
                        className="text-accent text-xs underline underline-offset-4"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}
