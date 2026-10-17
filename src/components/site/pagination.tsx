import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Pagination.
 *
 * Rendered as real links carrying the current filters, so pages are shareable,
 * crawlable and work without JavaScript. The current page is marked with
 * `aria-current` rather than being a disabled control.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const windowSize = 2;
  const first = Math.max(1, page - windowSize);
  const last = Math.min(totalPages, page + windowSize);

  const pages: number[] = [];
  for (let index = first; index <= last; index += 1) pages.push(index);

  const linkClasses =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm " +
    "transition-colors duration-150 active:scale-[0.98]";

  /** Every page link that is not the current one. */
  const idleClasses =
    "border-line-strong text-ink-muted hover:border-accent hover:text-accent " +
    "active:border-accent active:bg-accent/15 active:text-accent";

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      {page > 1 ? (
        <Link href={buildHref(page - 1)} rel="prev" className={cn(linkClasses, idleClasses)}>
          Previous
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className={cn(linkClasses, "border-line text-ink-subtle opacity-50")}
        >
          Previous
        </span>
      )}

      {first > 1 ? (
        <>
          <Link href={buildHref(1)} className={cn(linkClasses, idleClasses)}>
            1
          </Link>
          {first > 2 ? <span className="text-ink-subtle px-1">…</span> : null}
        </>
      ) : null}

      {pages.map((pageNumber) => (
        <Link
          key={pageNumber}
          href={buildHref(pageNumber)}
          aria-current={pageNumber === page ? "page" : undefined}
          className={cn(
            linkClasses,
            pageNumber === page
              ? "border-accent bg-accent text-accent-ink active:bg-accent-dim active:brightness-100"
              : "border-line-strong text-ink-muted hover:border-accent hover:bg-accent/10 hover:text-accent active:border-accent active:bg-accent/25 active:text-accent",
          )}
        >
          <span className="sr-only">Page </span>
          {pageNumber}
        </Link>
      ))}

      {last < totalPages ? (
        <>
          {last < totalPages - 1 ? <span className="text-ink-subtle px-1">…</span> : null}
          <Link href={buildHref(totalPages)} className={cn(linkClasses, idleClasses)}>
            {totalPages}
          </Link>
        </>
      ) : null}

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} rel="next" className={cn(linkClasses, idleClasses)}>
          Next
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className={cn(linkClasses, "border-line text-ink-subtle opacity-50")}
        >
          Next
        </span>
      )}
    </nav>
  );
}
