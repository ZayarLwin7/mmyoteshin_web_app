# Implementation Prompt — CineVault

You are the senior full-stack engineer, software architect, product designer, security reviewer, and QA lead responsible for implementing this project. Follow `Architecture & Design.md` as the source of truth. Deliver a maintainable, tested, production-ready application—not merely a mockup or a set of disconnected screens.

## 1. Start by inspecting the repository

Before editing:

1. Inspect the current repository, package manager, framework, routes, components, database setup, environment files, tests, and Git status.
2. Identify existing work worth preserving. Do not overwrite functioning features or delete user work without a clear reason.
3. If the repository is empty, scaffold the agreed stack.
4. Write a concise implementation plan and list assumptions/risks in `docs/implementation-plan.md`.
5. Add or update `README.md`, `.env.example`, and project scripts.
6. Use the package manager already established by the repository; if none exists, choose pnpm and commit the lockfile.

Do not stop after reporting the plan. Continue through implementation in sensible phases unless a genuinely blocking decision or missing credential requires the user.

## 2. Product and legal boundaries

Build a movie discovery/review catalogue with links only to authorized distributions. Do not implement scraping or automation intended to acquire unauthorized copyrighted movies from torrent sites, bypass access controls, or distribute files without permission. Do not build deceptive download flows or fake safety claims.

Every download link must have an authorization basis recorded in the admin system. If permission is unknown, keep the link in a non-public pending state. Implement a clear reporting/takedown workflow and content-policy pages. Use original editorial copy and assets that the project has permission to use.

## 3. Engineering standards

- Use TypeScript with strict settings.
- Follow current stable versions of the chosen stack and pin dependencies through the lockfile.
- Keep code modular, readable, and cohesive; avoid giant components and duplicate logic.
- Prefer server components/server-side data access by default in Next.js; use client components only when interaction requires them.
- Keep data access in a server-side repository/service layer.
- Validate input at every trust boundary with a schema validation library.
- Add database migrations to version control.
- Use proper loading, empty, error, and success states.
- Do not use placeholder buttons, fake data in production paths, dead links, or TODOs for core requirements.
- Never expose service-role keys, private authorization references, or other secrets to the browser.
- Do not silently swallow errors. Log useful, sanitized diagnostic context and show a safe user-facing message.
- Avoid premature abstractions and unnecessary dependencies.
- Keep code formatted and linted consistently.

## 4. Design and UX requirements

The site must feel premium, cinematic, modern, and editorial. Avoid a generic dashboard template or a cluttered link directory.

Use:

- A dark charcoal/near-black base, restrained warm accent, accessible contrast, and a consistent spacing/type scale.
- Strong editorial typography and generous whitespace.
- Consistent poster ratios and carefully composed movie cards.
- A high-quality home hero and curated horizontal collections.
- Polished hover/focus states, subtle motion, and reduced-motion support.
- Responsive layouts for narrow mobile, tablet, laptop, and wide desktop.
- Clear visual separation between editorial controls, authorized download links, and advertisements.
- Skeletons, empty states, image fallbacks, and error recovery.
- Accessible keyboard navigation, focus indicators, semantic HTML, and screen-reader labels.

Do not use:

- Fake download buttons, fake progress bars, fake countdowns, forced redirects, misleading close controls, or ad designs that imitate download links.
- Excessive gradients, excessive glassmorphism, decorative animation that harms usability, or oversized empty hero areas.
- Nonfunctional UI controls or hardcoded sample content presented as real catalogue data.

Create a coherent design system in shared tokens and reusable components. Test mobile layouts and fix overflow rather than merely shrinking desktop UI.

## 5. Required public functionality

Implement:

- Home page with featured content and curated sections.
- Catalogue page with pagination and filters.
- Search by title/original title.
- Genre and year collection pages.
- Movie detail pages with metadata, synopsis, editorial review, rating methodology, and authorized external links.
- About, contact, privacy, terms, copyright/takedown, and advertising-disclosure pages.
- Sitemap and robots configuration.
- Useful not-found and error pages.

Only published records should be visible publicly. Draft, archived, pending-review, disabled, and reported links must not leak through page data, server actions, route handlers, or APIs.

## 6. Required admin functionality

Implement a protected admin area with:

- Overview and basic catalogue counts.
- Movie create/edit/preview/publish/archive flows.
- Genre management.
- Review management.
- External link management with authorization basis, provider, destination, quality/details where verified, status, and last-checked date.
- Content/link report review and resolution.
- Audit history for privileged changes.

Enforce permissions on the server and at the database layer where supported. Hiding admin links in the UI is not authorization. Require appropriate role checks for every mutation. Use confirmation steps for destructive actions. Never return private authorization evidence to public clients.

Publication should be blocked when required metadata is missing or a download link lacks a reviewed authorization basis. A movie may be published without a download link if that makes sense for the editorial catalogue.

## 7. Data and backend

Implement the schema from `Architecture & Design.md`, adapting it to the chosen backend while preserving its security requirements:

- movies
- genres
- movie_genres
- reviews
- download_links
- content_reports
- admin_profiles
- optional people/movie_credits and site_settings if useful

Use UUIDs, foreign keys, constraints, indexes, timestamps, and migrations. Define and test role-based access policies. Create seed data only for development and label it clearly; do not seed fabricated reviews or pretend external links are real. Provide safe seed instructions.

Validate external URLs: permit only approved protocols (normally HTTPS), reject dangerous schemes, and prevent open redirects. Keep external-link handling simple and transparent. Do not proxy or download remote movie files.

## 8. Authentication and security

- Implement secure admin authentication using the selected auth provider.
- Establish a documented, secure first-admin provisioning procedure.
- Use least privilege and server-side role checks.
- Configure database row-level security where available.
- Add rate limiting for authentication and public report submission; protect search against abuse.
- Use secure cookies and CSRF protections where applicable.
- Add suitable production security headers and a practical Content Security Policy.
- Sanitize permitted rich text and prevent XSS.
- Do not commit `.env`, credentials, API keys, or service-role secrets.
- Add `.env.example` with placeholder values and explain required configuration.
- Add dependency/secret scanning where supported by the CI platform.
- Add audit logs for publishing, archiving, and link status changes.
- Do not log passwords, tokens, secrets, or unnecessary personal information.

## 9. SEO, privacy, ads, and analytics

SEO:

- Unique page titles/descriptions and canonical URLs.
- Open Graph metadata.
- Sitemap containing canonical published pages only.
- Robots rules excluding admin/private/draft pages.
- Structured data only when accurate and appropriate.
- Meaningful alt text and optimized images.
- No thin auto-generated SEO pages or copied content without permission.

Advertising:

- Build configurable, clearly labeled ad slots; keep the site usable when ads are disabled or blocked.
- Do not imitate download controls or use deceptive placements, forced redirects, pop-unders, fake warnings, or accidental-click patterns.
- Do not enable a real provider until its account/site approval and policy requirements are satisfied.
- Reserve ad space to reduce layout shift.

Privacy/analytics:

- Implement only necessary analytics and document the event data collected.
- Respect applicable consent requirements and disclose cookies/analytics.
- Track outbound clicks only in a transparent, privacy-conscious manner.
- Complete privacy, terms, advertising, and contact disclosures before launch.

## 10. Performance and accessibility

- Optimize images with the framework's supported image pipeline or an appropriate CDN.
- Lazy-load below-the-fold images; prioritize only the hero image.
- Paginate results and add indexes for actual query patterns.
- Avoid unnecessary client-side JavaScript.
- Cache public content thoughtfully and invalidate after content changes.
- Target good Core Web Vitals; inspect LCP, INP, and CLS in production-like tests.
- Test keyboard operation and reduced-motion preferences.
- Aim for WCAG 2.2 AA on core journeys.
- Verify narrow-screen layouts and current Chrome, Safari, and Firefox behavior.

## 11. Testing and CI

Create tests for:

- Validation, slug creation, and uniqueness.
- URL/protocol validation.
- Publication eligibility and authorization checks.
- Role-based permissions.
- Public access filtering (published content only).
- Inactive/draft link non-disclosure.
- Search, filters, and pagination.
- Report submission and rate limiting where practical.

Add end-to-end tests for:

1. Home → search → movie details.
2. Filter and pagination.
3. Admin login and unauthorized access rejection.
4. Create draft → preview → publish.
5. Add/disable an authorized external link.
6. Submit and resolve a report.
7. Mobile navigation and responsive states.

Configure CI to run formatting/lint, typecheck, unit/integration tests, and production build. Fix failures rather than suppressing checks. Document any test that requires external credentials and provide a safe mock or local test alternative.


## 12. Documentation and operations

Update:
- `README.md` — overview, prerequisites, setup, scripts, architecture, and common troubleshooting.
- `.env.example` — all required environment variable names with safe placeholders.
- `docs/implementation-plan.md` — decisions, phases, risks, and deferred work.
- `docs/deployment.md` — staging/production setup, migrations, secrets, domain/HTTPS, and rollback.
- `docs/security.md` — roles, policies, secrets, headers, reports/takedowns, and incident steps.
- `docs/content-operations.md` — content entry, authorization review, attribution, publication, and takedowns.
- `docs/backup-restore.md` — backup policy and a tested restore procedure.

Provide a health check or equivalent operational verification if supported by the deployment platform. Document monitoring, error reporting, backup retention, restore tests, and incident response.

## 13. Execution workflow

Work in these phases and keep the app runnable after each phase:

1. **Audit and foundation:** inspect repo, establish plan, configure scripts, types, linting, CI, and design tokens.
2. **Schema and security:** migrations, auth, roles, access policies, seed strategy, validation.
3. **Public experience:** layout, home, catalogue, search, filters, detail pages, responsive states, SEO.
4. **Admin/editorial workflow:** CRUD, preview/publish, review management, link authorization and audit logs.
5. **Reporting and policies:** reporting workflow, takedown handling, legal/contact/disclosure pages.
6. **Monetization:** configurable labeled ad slots, analytics, privacy/consent handling.
7. **Hardening:** tests, accessibility, performance, security headers, dependency review.
8. **Release rehearsal:** staging migration, smoke tests, backup/restore and rollback verification.

If parallel agents are available, delegate bounded tasks (for example, design system, schema/security review, or tests) with clear interfaces. Integrate and review their work; do not let parallel work overwrite the same files or bypass architecture decisions.

After each phase:
- Run relevant checks.
- Fix regressions before moving on.
- Summarize files changed and tests executed.
- Record unresolved issues and whether they block production.

## 14. Final acceptance criteria

Do not declare the project production-ready unless:
- The application installs from a clean checkout using documented commands.
- Lint, typecheck, tests, and production build pass.
- All required public routes and admin workflows function.
- Authorization is enforced server-side and tested.
- Only approved content and reviewed authorized links are publicly visible.
- No secrets are committed or exposed to client bundles.
- Database migrations and policies are reproducible.
- Security headers, error handling, logging, and monitoring are configured.
- Key end-to-end flows pass.
- Responsive behavior and accessibility have been checked.
- SEO, privacy, terms, copyright/takedown, contact, and advertising disclosures are present.
- Ads are clearly labeled and can remain disabled until provider approval.
- Backup, restore, rollback, and launch procedures are documented.
- Any remaining blocker is explicitly listed; never hide a failed check or claim a test ran when it did not.

## 15. Final response from the coding agent

When implementation is complete, report:
1. What was implemented.
2. Main architecture and important decisions.
3. Files/routes/schema/migrations added or changed.
4. Commands run and actual test/build results.
5. Required environment variables and setup steps.
6. Deployment steps.
7. Known limitations and remaining blockers.
8. A clear status: **production-ready**, **staging-ready**, or **not ready**, justified by evidence.

Start by inspecting the repository, then execute the plan. Do not stop at a proposal.
