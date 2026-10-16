import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmAction } from "@/components/admin/confirm-action";
import { LinkForm } from "@/components/admin/link-form";
import { MovieForm } from "@/components/admin/movie-form";
import { ReviewForm } from "@/components/admin/review-form";
import { Badge, statusTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { getAdminMovieById, listAdminGenres } from "@/db/queries/admin";
import {
  activateLinkAction,
  createLinkAction,
  deleteLinkAction,
  disableLinkAction,
  markLinkCheckedAction,
  updateLinkAction,
} from "@/lib/actions/links";
import {
  archiveMovieAction,
  publishMovieAction,
  restoreMovieAction,
  updateMovieAction,
} from "@/lib/actions/movies";
import {
  createReviewAction,
  setReviewStatusAction,
  updateReviewAction,
} from "@/lib/actions/reviews";
import { requirePermission } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { getPublicationReadiness } from "@/lib/services/movies";
import { formatDate, formatFileSize, humaniseEnum } from "@/lib/utils";

import type { Movie } from "@/db/schema";

export const metadata: Metadata = { title: "Edit record" };

/** The public URL of a record, following its own content kind. */
function publicUrl(movie: { slug: string; contentKind: Movie["contentKind"] }): string {
  return movie.contentKind === "series" ? `/series/${movie.slug}` : `/movies/${movie.slug}`;
}

/**
 * The editorial workspace for a single film.
 *
 * This page is where the publication gate is visible: the readiness panel lists
 * exactly what is blocking publication, and the publish action re-runs the same
 * check on the server. An operator cannot publish past a blocker by editing the
 * DOM, because the decision is made in the service layer, not the UI.
 */
export default async function AdminMovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requirePermission("movie:read", `/admin/movies/${id}`);

  const detail = await getAdminMovieById(id);
  if (!detail) notFound();

  const [genres, readiness] = await Promise.all([listAdminGenres(), getPublicationReadiness(id)]);

  const { movie, reviews, links, genreIds } = detail;

  const canPublish = roleHasPermission(admin.role, "movie:publish");
  const canArchive = roleHasPermission(admin.role, "movie:archive");
  const canWriteLink = roleHasPermission(admin.role, "link:write");
  const canAuthorizeLink = roleHasPermission(admin.role, "link:authorize");
  const canDisableLink = roleHasPermission(admin.role, "link:disable");
  const canPublishReview = roleHasPermission(admin.role, "review:publish");

  return (
    <div className="space-y-12">
      {/* ---- Header ------------------------------------------------------- */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(movie.status)}>{humaniseEnum(movie.status)}</Badge>
          {movie.featured ? <Badge tone="accent">Featured</Badge> : null}
          <Badge tone={movie.contentKind === "series" ? "accent" : "neutral"}>
            {humaniseEnum(movie.contentKind)}
          </Badge>
          {movie.publishedAt ? (
            <span className="text-ink-subtle text-xs">
              Published {formatDate(movie.publishedAt)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-heading text-ink font-semibold">{movie.title}</h1>

          <div className="flex flex-wrap gap-2">
            {/*
              The public URL follows the record's kind. A series lives at
              `/series/<slug>` and answers 404 under `/movies/<slug>`, so a
              hard-coded film path here would send an editor to a dead page.
            */}
            {movie.status === "published" ? (
              <LinkButton href={publicUrl(movie)} variant="secondary" size="sm">
                View public page
              </LinkButton>
            ) : (
              <LinkButton
                href={publicUrl(movie)}
                variant="ghost"
                size="sm"
                // A draft has no public page; the preview goes through the admin
                // view instead so the link is never a dead end.
                prefetch={false}
              >
                Public URL (not live yet)
              </LinkButton>
            )}
          </div>
        </div>
      </header>

      {/* ---- Readiness ---------------------------------------------------- */}
      <section aria-labelledby="readiness-heading">
        <h2 id="readiness-heading" className="text-ink mb-4 text-base font-semibold">
          Publication readiness
        </h2>

        {readiness.ready ? (
          <Alert tone="success" title="Ready to publish">
            All required metadata, a published review and link authorization checks pass.
          </Alert>
        ) : (
          <Alert tone="danger" title="Blocked — cannot be published yet">
            <ul className="list-disc space-y-1 pl-5">
              {readiness.blockers.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </Alert>
        )}

        {readiness.warnings.length > 0 ? (
          <Alert tone="warning" className="mt-3" title="Warnings">
            <ul className="list-disc space-y-1 pl-5">
              {readiness.warnings.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </section>

      {/* ---- Status actions ------------------------------------------------ */}
      <section
        aria-labelledby="status-heading"
        className="rounded-panel border-line bg-surface border p-5"
      >
        <h2 id="status-heading" className="text-ink mb-4 text-base font-semibold">
          Publication status
        </h2>

        <div className="flex flex-wrap items-start gap-3">
          {movie.status !== "published" && canPublish ? (
            <ConfirmAction
              action={publishMovieAction}
              hiddenFields={{ id: movie.id }}
              label="Publish"
              confirmLabel="Yes, publish now"
              description="The film becomes publicly visible, appears in the catalogue, and is added to the sitemap."
              variant="primary"
            />
          ) : null}

          {movie.status === "published" && canArchive ? (
            <ConfirmAction
              action={archiveMovieAction}
              hiddenFields={{ id: movie.id }}
              label="Archive"
              confirmLabel="Yes, archive"
              description="The film is removed from the public catalogue and the sitemap. Existing links stop being visible."
            />
          ) : null}

          {movie.status === "archived" ? (
            <ConfirmAction
              action={restoreMovieAction}
              hiddenFields={{ id: movie.id }}
              label="Move back to draft"
              confirmLabel="Yes, move to draft"
              description="The film leaves the archive and returns to draft. It will not be public."
            />
          ) : null}

          {!canPublish ? (
            <p className="text-ink-subtle text-xs">
              Your role can edit content but not change publication status.
            </p>
          ) : null}
        </div>
      </section>

      {/* ---- Metadata form ------------------------------------------------- */}
      <section aria-labelledby="metadata-heading">
        <h2 id="metadata-heading" className="text-ink mb-4 text-base font-semibold">
          Metadata
        </h2>
        <MovieForm
          action={updateMovieAction}
          genres={genres}
          movie={movie}
          selectedGenreIds={genreIds}
          submitLabel="Save changes"
        />
      </section>

      {/* ---- Reviews ------------------------------------------------------- */}
      <section aria-labelledby="reviews-heading" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="reviews-heading" className="text-ink text-base font-semibold">
            Reviews ({reviews.length})
          </h2>
        </div>

        {reviews.length === 0 ? (
          <Alert tone="warning">
            No review yet. A film cannot be published without a published editorial review.
          </Alert>
        ) : (
          <ul className="space-y-4">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-panel border-line bg-surface border p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(review.status)}>{humaniseEnum(review.status)}</Badge>
                  <span className="text-ink-subtle text-xs">
                    {review.reviewerName}
                    {review.rating
                      ? ` · ${review.rating} / ${review.ratingScale}`
                      : " · no score"}{" "}
                    · {humaniseEnum(review.ratingSource)}
                  </span>
                </div>

                <p className="text-ink mt-2 text-sm font-medium">
                  {review.reviewTitle ?? "(untitled review)"}
                </p>
                <p className="text-ink-muted mt-1 line-clamp-3 text-sm">{review.body}</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {review.status !== "published" && canPublishReview ? (
                    <ConfirmAction
                      action={setReviewStatusAction}
                      hiddenFields={{ id: review.id, movieId: movie.id, status: "published" }}
                      label="Publish review"
                      confirmLabel="Yes, publish review"
                      description="This review becomes publicly visible on the film page."
                      variant="primary"
                    />
                  ) : null}

                  {review.status === "published" && canPublishReview ? (
                    <ConfirmAction
                      action={setReviewStatusAction}
                      hiddenFields={{ id: review.id, movieId: movie.id, status: "archived" }}
                      label="Archive review"
                      confirmLabel="Yes, archive"
                      description="The review stops being visible, and the film will no longer be publishable until another review is published."
                    />
                  ) : null}
                </div>

                <details className="mt-4">
                  <summary className="text-accent cursor-pointer text-sm">Edit this review</summary>
                  <div className="mt-4">
                    <ReviewForm
                      action={updateReviewAction}
                      movieId={movie.id}
                      review={review}
                      canPublish={canPublishReview}
                      submitLabel="Save review"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <details className="rounded-panel border-line bg-surface border p-5">
          <summary className="text-accent cursor-pointer text-sm font-medium">
            Write a new review
          </summary>
          <div className="mt-5">
            <ReviewForm
              action={createReviewAction}
              movieId={movie.id}
              canPublish={canPublishReview}
              submitLabel="Save review"
            />
          </div>
        </details>
      </section>

      {/* ---- External links ------------------------------------------------- */}
      <section aria-labelledby="links-heading" className="space-y-6">
        <h2 id="links-heading" className="text-ink text-base font-semibold">
          Authorized distribution links ({links.length})
        </h2>

        {links.length === 0 ? (
          <Alert tone="info">
            No links yet. A film may be published without one — only add a link when you have a
            documented authorization basis for it.
          </Alert>
        ) : (
          <ul className="space-y-4">
            {links.map((link) => (
              <li key={link.id} className="rounded-panel border-line bg-surface border p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(link.status)}>{humaniseEnum(link.status)}</Badge>
                  <span className="text-ink-subtle text-xs">
                    {humaniseEnum(link.authorizationBasis)}
                    {link.authorizedAt
                      ? ` · authorized ${formatDate(link.authorizedAt)}`
                      : " · never authorized"}
                    {link.lastCheckedAt
                      ? ` · checked ${formatDate(link.lastCheckedAt)}`
                      : " · never checked"}
                  </span>
                </div>

                <p className="text-ink mt-2 text-sm font-medium">{link.label}</p>
                <p className="text-ink-muted mt-1 text-xs">
                  {link.providerName} · {link.destinationHost}
                  {link.quality ? ` · ${link.quality}` : ""}
                  {formatFileSize(link.fileSizeBytes)
                    ? ` · ${formatFileSize(link.fileSizeBytes)}`
                    : ""}
                </p>

                {link.authorizationReference ? (
                  <p className="bg-surface-sunken text-ink-subtle mt-2 rounded px-2 py-1 text-xs">
                    <strong className="text-ink-muted">Private reference:</strong>{" "}
                    {link.authorizationReference}
                  </p>
                ) : (
                  <p className="text-danger mt-2 text-xs">
                    No private authorization reference recorded — this link cannot be activated.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  {link.status !== "active" && canAuthorizeLink ? (
                    <ConfirmAction
                      action={activateLinkAction}
                      hiddenFields={{ id: link.id, movieId: movie.id }}
                      label="Activate (make public)"
                      confirmLabel="Yes, activate"
                      description="This link will be shown publicly on the film page. Only proceed if the authorization basis and reference above are correct."
                      variant="primary"
                    />
                  ) : null}

                  {link.status === "active" && canDisableLink ? (
                    <ConfirmAction
                      action={disableLinkAction}
                      hiddenFields={{
                        id: link.id,
                        movieId: movie.id,
                        reason: "Disabled from the admin film page.",
                      }}
                      label="Disable"
                      confirmLabel="Yes, disable"
                      description="The link immediately stops being publicly visible."
                    />
                  ) : null}

                  {link.status === "active" && canWriteLink ? (
                    <ConfirmAction
                      action={markLinkCheckedAction}
                      hiddenFields={{ id: link.id, movieId: movie.id }}
                      label="Mark as checked today"
                      confirmLabel="Yes, record check"
                      description="Records that a human confirmed this destination still resolves to the authorized distribution."
                    />
                  ) : null}

                  {link.status !== "active" && canWriteLink ? (
                    <ConfirmAction
                      action={deleteLinkAction}
                      hiddenFields={{ id: link.id, movieId: movie.id }}
                      label="Delete"
                      confirmLabel="Yes, delete permanently"
                      description="This permanently removes the link record and its authorization notes."
                      variant="danger"
                    />
                  ) : null}
                </div>

                <details className="mt-4">
                  <summary className="text-accent cursor-pointer text-sm">Edit this link</summary>
                  <div className="mt-4">
                    <LinkForm
                      action={updateLinkAction}
                      movieId={movie.id}
                      link={link}
                      submitLabel="Save link"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        {canWriteLink ? (
          <details className="rounded-panel border-line bg-surface border p-5">
            <summary className="text-accent cursor-pointer text-sm font-medium">Add a link</summary>
            <div className="mt-5">
              <LinkForm action={createLinkAction} movieId={movie.id} submitLabel="Add link" />
            </div>
          </details>
        ) : (
          <Alert tone="info">Your role cannot add or authorize distribution links.</Alert>
        )}
      </section>

      <div className="border-line border-t pt-6">
        <Link
          href="/admin/movies"
          className="text-ink-muted hover:text-accent text-sm underline underline-offset-4"
        >
          ← Back to all films
        </Link>
      </div>
    </div>
  );
}
