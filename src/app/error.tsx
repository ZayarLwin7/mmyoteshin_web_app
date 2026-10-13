"use client";

import { useEffect } from "react";

import { Button, LinkButton } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Next.js passes a `digest` rather than the underlying message, so nothing
 * internal is exposed to the visitor. The digest is shown so it can be quoted
 * when reporting the problem, and it is what appears in the server logs.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side breadcrumb only; the server logs the authoritative entry.
    console.error("[ui] route error", { digest: error.digest });
  }, [error.digest]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-eyebrow mb-4">Something went wrong</p>
      <h1 className="text-title text-ink font-semibold">This page could not be loaded</h1>
      <p className="text-ink-muted mt-4 max-w-md text-sm">
        The problem has been logged. You can try again, or head back to the catalogue.
      </p>

      {error.digest ? (
        <p className="text-ink-subtle mt-4 font-mono text-xs">Reference: {error.digest}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/movies" variant="secondary">
          Browse the catalogue
        </LinkButton>
      </div>
    </div>
  );
}
