import type { Metadata } from "next";
import Link from "next/link";

import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { listAdminReviews } from "@/db/queries/admin";
import { requirePermission } from "@/lib/auth/guards";
import { formatDate, humaniseEnum } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

const STATUSES = ["all", "draft", "published", "archived"] as const;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("review:write", "/admin/reviews");

  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "all";
  const status = (STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as (typeof STATUSES)[number])
    : "all";

  const reviews = await listAdminReviews({ status });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-heading text-ink font-semibold">Reviews</h1>
        <p className="text-ink-muted mt-2 text-sm">
          Editorial reviews across the catalogue. Edit a review from its film page.
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/reviews" : `/admin/reviews?status=${value}`}
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

      {reviews.length === 0 ? (
        <EmptyState
          title="No reviews match"
          description="Write a review from the film's admin page."
        />
      ) : (
        <ul className="divide-line rounded-panel border-line bg-surface divide-y overflow-hidden border">
          {reviews.map((review) => (
            <li key={review.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(review.status)}>{humaniseEnum(review.status)}</Badge>
                <span className="text-ink-subtle text-xs">
                  {review.reviewerName}
                  {review.rating
                    ? ` · ${review.rating} / ${review.ratingScale}`
                    : " · no score"} · {humaniseEnum(review.ratingSource)}
                </span>
                <span className="text-ink-subtle text-xs">
                  {review.bodyLength} chars · updated {formatDate(review.updatedAt)}
                </span>
              </div>

              <p className="text-ink mt-2 text-sm font-medium">
                {review.reviewTitle ?? "(untitled review)"}
              </p>

              <p className="text-ink-muted mt-1 text-xs">
                For{" "}
                <Link
                  href={`/admin/movies/${review.movieId}`}
                  className="text-accent underline underline-offset-4"
                >
                  {review.movieTitle}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
