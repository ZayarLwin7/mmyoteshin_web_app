"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Site header.
 *
 * Client-side only because of the mobile disclosure and the active-route
 * styling. Everything it renders is a real link or a real form — the search
 * box submits a GET to /search, so it works without JavaScript.
 */

const NAV_LINKS = [
  { href: "/movies", label: "Films" },
  { href: "/genres", label: "Genres" },
  { href: "/years", label: "Years" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader({ siteName }: { siteName: string }) {
  const pathname = usePathname();
  /**
   * Which route the menu was opened on, rather than a plain boolean.
   *
   * The menu must close when the visitor navigates. Recording *where* it was
   * opened makes that structural: `menuOpen` is derived from the current
   * pathname, so a navigation closes it during the same render with no effect
   * and no second pass.
   */
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const menuOpen = menuOpenFor === pathname;
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on Escape, and return focus to the control that opened it.
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpenFor(null);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="border-line bg-canvas/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Link
          href="/"
          className="text-ink hover:text-accent active:text-accent text-lg font-semibold tracking-tight transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {siteName}
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm transition-colors active:scale-[0.98]",
                    isActive(link.href)
                      ? "bg-accent/15 text-accent"
                      : "text-ink-muted hover:bg-surface-raised hover:text-ink active:bg-accent/15 active:text-accent",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form action="/search" method="get" role="search" className="hidden sm:block">
            <label htmlFor="site-search" className="sr-only">
              Search films
            </label>
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Search films…"
              autoComplete="off"
              className="border-line-strong bg-surface-sunken text-ink placeholder:text-ink-subtle focus-visible:outline-accent h-9 w-44 rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 lg:w-64"
            />
          </form>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMenuOpenFor(menuOpen ? null : pathname)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            className="border-line-strong text-ink-muted hover:text-ink active:border-accent active:bg-accent/15 active:text-accent inline-flex size-9 items-center justify-center rounded-full border transition-colors active:scale-[0.98] md:hidden"
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div id={menuId} hidden={!menuOpen} className="border-line bg-canvas border-t md:hidden">
        <nav aria-label="Mobile" className="container-page py-3">
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-2 py-3 text-base transition-colors active:scale-[0.98]",
                    isActive(link.href)
                      ? "bg-accent/15 text-accent font-medium"
                      : "text-ink-muted hover:bg-surface-raised hover:text-ink active:bg-accent/15 active:text-accent",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <form action="/search" method="get" role="search" className="mt-3 sm:hidden">
            <label htmlFor="mobile-search" className="sr-only">
              Search films
            </label>
            <input
              id="mobile-search"
              name="q"
              type="search"
              placeholder="Search films…"
              autoComplete="off"
              className="border-line-strong bg-surface-sunken text-ink placeholder:text-ink-subtle h-11 w-full rounded-lg border px-4 text-base"
            />
          </form>
        </nav>
      </div>
    </header>
  );
}
