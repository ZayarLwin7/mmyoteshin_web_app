import Link from "next/link";

import { LinkButton } from "@/components/ui/button";

/**
 * Not-found page.
 *
 * Shown for an unknown route and for a film slug that is not published. It
 * deliberately does not distinguish "does not exist" from "exists but is not
 * published", so it cannot be used to probe for draft content.
 */
export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-eyebrow mb-4">404</p>
      <h1 className="text-title text-ink font-semibold">We could not find that page</h1>
      <p className="text-ink-muted mt-4 max-w-md text-sm">
        The page may have been moved, or the film may no longer be in the catalogue.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/movies">Browse the catalogue</LinkButton>
        <LinkButton href="/" variant="secondary">
          Go to the home page
        </LinkButton>
      </div>

      <p className="text-ink-subtle mt-10 text-xs">
        Looking for something specific?{" "}
        <Link href="/search" className="hover:text-accent underline underline-offset-2">
          Try a search
        </Link>
        .
      </p>
    </div>
  );
}
