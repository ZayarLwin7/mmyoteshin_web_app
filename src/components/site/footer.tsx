import Link from "next/link";

import { publicEnv } from "@/lib/env";

/**
 * Site footer.
 *
 * Carries the disclosure links that the launch checklist requires: privacy,
 * terms, copyright/takedown, advertising and contact. The editorial-standards
 * note is deliberately visible rather than buried, because the site's whole
 * proposition is that its links are authorized.
 */

const SECTIONS = [
  {
    title: "Browse",
    links: [
      { href: "/movies", label: "All films" },
      { href: "/genres", label: "Genres" },
      { href: "/years", label: "Years" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "About & editorial standards" },
      { href: "/contact", label: "Contact" },
      { href: "/advertising", label: "Advertising disclosure" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms of use" },
      { href: "/copyright", label: "Copyright & takedown" },
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-line bg-surface-sunken mt-24 border-t">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p
              className="text-ink text-lg font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {publicEnv.siteName}
            </p>
            <p className="text-ink-muted mt-3 max-w-xs text-sm">
              A curated catalogue of films with original editorial writing and clearly labelled
              links to authorized distribution.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h2 className="text-eyebrow mb-3">{section.title}</h2>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-ink-muted hover:text-accent text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-line mt-10 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-subtle text-xs">
            © {year} {publicEnv.siteName}. Editorial content is original. Film metadata and artwork
            remain the property of their respective rights holders.
          </p>
          <p className="text-ink-subtle text-xs">
            <Link href="/copyright" className="hover:text-accent underline underline-offset-2">
              Report a problem
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
