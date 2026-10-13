import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { movies, reviews, type Review } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import type { CurrentAdmin } from "@/lib/auth/guards";
import { normalisePlainText } from "@/lib/security/sanitize";
import type { ReviewInput } from "@/lib/validation/schemas";

import { ServiceError } from "./movies";

/**
 * Editorial review operations.
 *
 * Review bodies are stored as normalised *plain text*. They are rendered as
 * React text nodes on the public site, which removes the XSS class entirely
 * rather than relying on a sanitiser.
 */

function toReviewColumns(input: ReviewInput) {
  return {
    reviewTitle: input.reviewTitle,
    body: normalisePlainText(input.body),
    // Numeric columns take strings in Drizzle; the schema enforces the range.
    rating: input.rating === null ? null : input.rating.toFixed(1),
    ratingSource: input.ratingSource,
    reviewerName: input.reviewerName,
  };
}

async function assertMovieExists(movieId: string) {
  const rows = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);
  if (rows.length === 0) throw new ServiceError("That film no longer exists.", "not_found");
}

/** A film may have at most one published review (enforced by a partial index). */
async function assertNoOtherPublishedReview(movieId: string, excludeId?: string) {
  const rows = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.movieId, movieId),
        eq(reviews.status, "published"),
        excludeId ? ne(reviews.id, excludeId) : undefined,
      ),
    )
    .limit(1);

  if (rows.length > 0) {
    throw new ServiceError(
      "This film already has a published review. Archive it before publishing another.",
      "duplicate_published_review",
    );
  }
}

export async function createReview(input: ReviewInput, actor: CurrentAdmin): Promise<Review> {
  await assertMovieExists(input.movieId);
  if (input.status === "published") {
    await assertNoOtherPublishedReview(input.movieId);
  }

  const inserted = await db
    .insert(reviews)
    .values({
      ...toReviewColumns(input),
      movieId: input.movieId,
      reviewerId: actor.id,
      status: input.status,
      publishedAt: input.status === "published" ? new Date() : null,
    })
    .returning();

  const review = inserted[0];
  if (!review) throw new ServiceError("Failed to save the review.", "insert_failed");

  await recordAudit({
    action:
      input.status === "published" ? AUDIT_ACTIONS.reviewPublished : AUDIT_ACTIONS.reviewCreated,
    entityType: "review",
    entityId: review.id,
    summary:
      input.status === "published"
        ? `Published a review for film ${input.movieId}.`
        : `Created a draft review for film ${input.movieId}.`,
    metadata: { movieId: input.movieId, rating: review.rating, ratingSource: review.ratingSource },
    actor,
  });

  return review;
}

export async function updateReview(
  id: string,
  input: ReviewInput,
  actor: CurrentAdmin,
): Promise<Review> {
  const existing = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  const current = existing[0];
  if (!current) throw new ServiceError("That review no longer exists.", "not_found");

  if (input.status === "published") {
    await assertNoOtherPublishedReview(input.movieId, id);
  }

  const becomingPublished = input.status === "published" && current.status !== "published";

  const updated = await db
    .update(reviews)
    .set({
      ...toReviewColumns(input),
      status: input.status,
      publishedAt: becomingPublished ? new Date() : current.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, id))
    .returning();

  const review = updated[0];
  if (!review) throw new ServiceError("Failed to update the review.", "update_failed");

  await recordAudit({
    action: becomingPublished ? AUDIT_ACTIONS.reviewPublished : AUDIT_ACTIONS.reviewUpdated,
    entityType: "review",
    entityId: id,
    summary: becomingPublished
      ? `Published the review for film ${review.movieId}.`
      : `Updated the review for film ${review.movieId}.`,
    actor,
  });

  return review;
}

export async function setReviewStatus(
  id: string,
  status: Review["status"],
  actor: CurrentAdmin,
): Promise<Review> {
  const existing = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  const current = existing[0];
  if (!current) throw new ServiceError("That review no longer exists.", "not_found");

  if (status === "published") {
    await assertNoOtherPublishedReview(current.movieId, id);
  }

  const updated = await db
    .update(reviews)
    .set({
      status,
      publishedAt:
        status === "published" ? (current.publishedAt ?? new Date()) : current.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, id))
    .returning();

  const review = updated[0];
  if (!review) throw new ServiceError("Failed to update the review status.", "update_failed");

  await recordAudit({
    action: status === "published" ? AUDIT_ACTIONS.reviewPublished : AUDIT_ACTIONS.reviewArchived,
    entityType: "review",
    entityId: id,
    summary: `Review for film ${review.movieId} set to ${status}.`,
    actor,
  });

  return review;
}
