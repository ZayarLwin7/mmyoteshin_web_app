# Architecture & Design — CineVault

**Document status:** Production-oriented project specification  
**Target launch:** 31 October 2026  
**Product:** A modern, searchable movie discovery and review website with authorized external download links  
**Working name:** CineVault (rename before launch if desired)

## 1. Product vision

Build a polished, fast, mobile-first movie discovery website inspired by modern movie catalogues. Visitors can discover films, read editorial reviews and metadata, browse genres and years, search the catalogue, and follow clearly labeled external links to downloads that the site is authorized to distribute or link to.

The product must be genuinely useful without relying on misleading ads, deceptive download buttons, unauthorized copyrighted copies, or unsafe file distribution.

### Core principles
- Cinematic, premium visual design with strong typography and purposeful motion.
- Fast, accessible, responsive pages on mobile, tablet, and desktop.
- Search-engine-friendly pages with reliable metadata and canonical URLs.
- Editorial quality: original reviews, accurate metadata, transparent ratings, and visible update dates.
- Safe operations: validated inputs, least-privilege access, backups, monitoring, and tested recovery.
- Monetization that preserves trust and complies with ad-network policies.

## 2. Rights, content, and distribution rules

Only publish files, links, artwork, synopses, and review material that the site has permission to use or that are permitted by the applicable license and law. A link being publicly available on a torrent index or file host does not itself establish permission.

Before a download link is published, the content manager must record its source and authorization basis, such as:
- Public-domain status verified for the relevant territory;
- An applicable open license, with required attribution and terms;
- Written permission or a distribution agreement;
- A creator/publisher-authorized distribution page.

Do not build features that scrape torrent indexes to find unauthorized copyrighted copies, automate acquisition of infringing movies, bypass access controls, or rehost files without permission. For third-party hosts, show the provider name, link destination, file/quality details where verified, and a clear external-link notice. Do not imply a host is safe or official unless verified.

Provide a copyright/contact and takedown process, retain a record of notices, and promptly review credible complaints. Get jurisdiction-specific legal advice before launch.

## 3. Goals and non-goals

### MVP goals
1. Public home page with featured, latest, popular, and curated collections.
2. Catalogue browsing, genre/year/language filters, and search.
3. Movie detail pages with poster/backdrop, metadata, synopsis, cast/crew where licensed, original review, rating, and authorized external download links.
4. Editorial review and rating display with clear methodology.
5. Admin area for managing films, reviews, genres, link records, SEO fields, and publication status.
6. Basic content reporting/takedown workflow.
7. Privacy-conscious analytics and compliant ad placements.
8. Production deployment with security controls, monitoring, backups, and tested rollback.

### Non-goals for MVP
- Hosting or transcoding movie files.
- User-uploaded movie files.
- Automated scraping of unauthorized torrent sources.
- Subscription billing, social networking, comments, or user accounts unless explicitly approved as a later phase.
- Promising that external files are malware-free.
- Copying another website's proprietary branding, text, or assets.

## 4. Recommended technology

Use the current stable versions at implementation time, pin dependencies, and document the chosen versions.

- **Framework:** Next.js App Router with TypeScript.
- **UI:** React, Tailwind CSS, and accessible primitives such as shadcn/ui where useful.
- **Database and authentication:** Supabase (managed PostgreSQL and Supabase Auth) or a comparable managed PostgreSQL service.
- **Validation:** Zod or equivalent schema validation at every trust boundary.
- **Forms:** React Hook Form where forms justify it.
- **Testing:** Vitest/Jest for unit tests, Playwright for end-to-end flows, and automated accessibility checks.
- **Hosting:** Vercel or an equivalent platform supporting Next.js; managed database with backups.
- **Media:** Licensed/authorized image CDN or object storage; use optimized responsive image delivery.
- **Monitoring:** Error reporting, uptime checks, structured server logs, and performance analytics.
- **Package manager:** Choose one (pnpm recommended) and commit its lockfile.

Do not add libraries without a clear need. Prefer server components and server-side data access by default; add client components only for interactive UI.

## 5. High-level architecture

```text
Browser
  └── Next.js App Router
       ├── Public pages (SSR/SSG/ISR as appropriate)
       ├── Search and filter UI
       ├── Admin UI (authenticated, role-checked)
       ├── Server-side domain/services layer
       │    ├── Movie catalogue service
       │    ├── Reviews and rating service
       │    ├── External-link and authorization service
       │    ├── SEO/metadata service
       │    └── Reporting/takedown service
       └── Managed PostgreSQL / Supabase
            ├── RLS / least-privilege access
            ├── Auth and admin roles
            └── Backups and migrations

External services: authorized image CDN, analytics, ad provider, error monitoring
```

### Architecture rules
- Keep database access in a clear server-side data-access layer.
- Never expose service-role secrets or private environment variables to the browser.
- Use database migrations committed to version control.
- Apply authentication and authorization on the server, not just by hiding UI.
- Validate all user-controlled data on the server.
- Avoid N+1 queries and select only fields needed for each page.
- Add caching deliberately and invalidate it when published content changes.
- Make external destinations configurable and validate protocols/hosts before saving.

## 6. Information architecture and routes

### Public routes
- `/` — Home
- `/movies` — Catalogue with pagination and filters
- `/movies/[slug]` — Movie details, review, and authorized download options
- `/genres/[slug]` — Genre collection
- `/years/[year]` — Year collection
- `/search?q=...` — Search results
- `/about` — About and editorial standards
- `/contact` — Contact
- `/privacy` — Privacy policy
- `/terms` — Terms of use
- `/copyright` — Copyright and takedown policy
- `/advertising` — Advertising disclosure
- `/sitemap.xml` and `/robots.txt`

### Admin routes
- `/admin` — Overview
- `/admin/movies` — List/search/filter
- `/admin/movies/new` — Create movie
- `/admin/movies/[id]` — Edit movie
- `/admin/reviews` — Manage editorial reviews
- `/admin/genres` — Manage genres
- `/admin/reports` — Review link/content reports
- `/admin/settings` — Site settings and permitted ad configuration

All admin routes and mutations must require an authenticated account with an authorized admin role.

## 7. User experience and visual design

### Design direction
Create a premium cinematic interface—not a generic template. Use a dark charcoal/near-black foundation, restrained warm accent color, strong contrast, generous spacing, and clear content hierarchy. The design should feel editorial and curated, not like a cluttered download directory.

### Layout and components
- Responsive top navigation with wordmark, catalogue/genre navigation, search, and a clear mobile menu.
- Home hero with a curated featured film, readable text, and a clear primary action.
- Poster cards with consistent aspect ratios, subtle hover/focus states, title, year, and optional verified rating.
- Horizontal collections that work with touch gestures and keyboard navigation.
- Search/filter controls with visible active filters and a useful empty state.
- Detail page with backdrop, poster, title, year, runtime, genres, synopsis, editorial review, metadata, and download options.
- Download options must be plainly labeled, accessible, and visually distinguishable from advertisements.
- Skeleton/loading states, empty states, error states, and image fallbacks.
- Footer with policy, contact, attribution, and advertising links.

### Interaction and accessibility
- Support keyboard navigation, visible focus, semantic landmarks, and screen-reader labels.
- Meet WCAG 2.2 AA as a target, including color contrast and reduced-motion preferences.
- Never make a control look interactive if it is not functional.
- Avoid intrusive pop-ups, forced notification prompts, fake countdowns, fake download progress, and deceptive close buttons.
- Ads must be labeled “Advertisement” or equivalent and must not mimic download controls.

### Responsive breakpoints
Define and document a consistent breakpoint system. Test at narrow mobile widths, common iPhone/Android widths, tablets, and wide desktop screens. Avoid horizontal page overflow.

## 8. Data model

Use UUID primary keys, UTC timestamps, foreign keys, indexes, and database constraints. Names below are logical names; refine the physical schema during implementation and commit migrations.

### `movies`
- `id` UUID primary key
- `title` required
- `slug` unique and indexed
- `original_title` nullable
- `release_year` nullable, validated range
- `release_date` nullable
- `runtime_minutes` nullable, positive
- `synopsis` text
- `poster_url` nullable
- `backdrop_url` nullable
- `language_code` nullable
- `country` nullable
- `content_rating` nullable
- `status` enum: `draft`, `published`, `archived`
- `featured` boolean default false
- `published_at` nullable
- `created_at`, `updated_at`

### `genres`
- `id` UUID
- `name` unique
- `slug` unique
- `description` nullable

### `movie_genres`
- `movie_id` foreign key
- `genre_id` foreign key
- Composite primary key `(movie_id, genre_id)`

### `reviews`
- `id` UUID
- `movie_id` foreign key
- `review_title` nullable
- `body` required
- `rating` nullable numeric with a documented scale and range
- `reviewer_name` or editorial author reference
- `status`: `draft`, `published`, `archived`
- `created_at`, `updated_at`, `published_at`

Reviews must be original or used with permission. Make it clear whether a score is an editorial score, a community score, or an external aggregate; do not mix them without explanation.

### `download_links`
- `id` UUID
- `movie_id` foreign key
- `provider_name` required
- `destination_url` required
- `label` required (for example, “Authorized download — 1080p”)
- `quality` nullable
- `file_size_bytes` nullable
- `language` nullable
- `authorization_basis` required
- `authorization_reference` nullable (private admin evidence or contract reference; never expose confidential evidence publicly)
- `last_checked_at` nullable
- `status`: `pending_review`, `active`, `disabled`, `reported`
- `created_at`, `updated_at`

Only active, reviewed links for approved content may appear publicly. Consider storing a normalized host separately and allow only `https` destinations unless a documented exception is approved.

### `people` and `movie_credits` (optional for MVP)
For cast/crew, store names, roles, display order, and licensed image references. Do not assume metadata or images are free to reuse.

### `content_reports`
- `id` UUID
- `movie_id` nullable foreign key
- `download_link_id` nullable foreign key
- `reporter_contact` nullable
- `reason` enum/text
- `details` text
- `status`: `new`, `under_review`, `resolved`, `rejected`
- `created_at`, `updated_at`, `resolved_at`
- Internal notes must never be public.

### `admin_profiles`
- `user_id` UUID matching auth identity
- `role` enum with least privilege (at minimum `admin`, optionally `editor`)
- `created_at`, `updated_at`

### Optional `site_settings`
Store controlled configuration for site title, default SEO metadata, analytics consent settings, ad slot enablement, and maintenance mode. Do not store secrets in this table.

## 9. Security and authorization

- Enforce least privilege in database policies and server-side route handlers.
- Public users may read only published movies, published reviews, and active approved download links.
- Only authorized staff can create, edit, publish, archive, or disable content.
- Protect admin sign-in with strong password requirements and MFA if supported.
- Rate-limit authentication, search, reporting, and other abuse-prone endpoints.
- Validate URL schemes and reject `javascript:`, `data:`, and unexpected protocols.
- Prevent stored/reflected XSS by using safe rendering and sanitization for any permitted rich text.
- Use CSRF protections where applicable and secure, HTTP-only cookies.
- Add security headers including a suitable Content Security Policy, HSTS in production, frame protections, and `X-Content-Type-Options`.
- Keep secrets in deployment environment variables; commit only `.env.example` with placeholders.
- Do not log passwords, tokens, service-role keys, or sensitive report details.
- Run dependency and secret scans in CI.
- Add audit logs for privileged changes, including link activation/deactivation and publication.
- Review redirects and external links to prevent open-redirect vulnerabilities.

## 10. Search, filtering, and catalogue quality

MVP search should support title and original title, case-insensitive matching, pagination, and useful empty states. Add database indexes for common filters. Avoid unbounded result sets.

Filters may include genre, year, language, and content rating where reliable data exists. Keep query parameters shareable and canonicalize URLs to avoid duplicate SEO pages. For larger catalogues, evaluate PostgreSQL full-text search or a dedicated search service only when justified.

## 11. SEO and content quality

- Unique title and meta description per public page.
- Canonical URLs and stable, readable slugs.
- Open Graph and social preview metadata.
- XML sitemap containing only canonical, published pages.
- Correct `robots.txt`; exclude admin, drafts, and private pages.
- Add suitable structured data only when the page genuinely satisfies its requirements; validate output and do not invent ratings or review data.
- Use descriptive alt text for meaningful images; decorative images should have empty alt text.
- Avoid thin, auto-generated pages. Each published film should contain accurate metadata and useful original editorial content.
- Do not copy reviews, synopses, posters, or artwork from other sites without permission.
- Provide clear author/editorial and update information where appropriate.

## 12. Advertising and analytics

- Use a reputable ad provider and comply with its current policies and applicable law.
- Clearly distinguish ads from editorial content and download links.
- Never place ads so they imitate system dialogs, play controls, or download buttons.
- Do not use forced redirects, pop-under chains, fake virus alerts, deceptive close buttons, or accidental-click layouts.
- Keep ad slots limited and responsive; reserve layout space to reduce layout shift.
- Load third-party scripts only when needed and respect applicable consent requirements.
- Collect the minimum analytics needed; disclose cookies/analytics in the privacy policy.
- Do not promise revenue levels. Track page views, search usage, outbound-link clicks, and performance only with appropriate disclosure and consent.
- Ensure monetization does not violate the ad provider's rules for the site's content or outbound destinations.

## 13. Performance and reliability

Targets (measure in production-like conditions and improve where needed):
- Core Web Vitals: aim for good results, especially LCP, INP, and CLS.
- Optimize and resize poster/backdrop images; use modern formats and responsive sizes.
- Lazy-load below-the-fold media; prioritize only the true hero image.
- Paginate catalogue results.
- Cache public published content where appropriate; invalidate on publish/update.
- Avoid shipping unnecessary client JavaScript.
- Use database indexes based on actual query patterns.
- Add error boundaries and user-friendly error states.
- Provide health checks and uptime monitoring.
- Document backup frequency, retention, and restore procedure; perform a restore test before launch.

## 14. Admin workflow

A content editor should be able to:
1. Create a movie as a draft.
2. Enter and validate metadata and licensed image sources.
3. Add an original review or permitted editorial content.
4. Add an external download link and record its authorization basis.
5. Preview the page.
6. Publish only after required fields and link authorization checks pass.
7. Disable a link quickly after a credible report.
8. Review and resolve reports with an audit trail.

Add confirmation dialogs for destructive or high-impact actions. Make status and validation errors explicit. Never expose private authorization references in public API responses.

## 15. Testing strategy

### Unit tests
- Slug generation and collision handling.
- Metadata and rating validation.
- URL/protocol/host validation.
- Publication eligibility and link authorization checks.
- Search/filter query construction.
- Permission rules for each role.

### Integration tests
- Public reads return published content only.
- Draft/archived records and inactive links are not exposed.
- Unauthorized users cannot access admin actions.
- Database constraints and migrations work from a clean database.
- Report submission is validated and rate-limited.

### End-to-end tests
- Home → search → movie detail.
- Filter and pagination behavior.
- Admin login → create draft → preview → publish.
- Add, disable, and report an external link.
- Mobile navigation and responsive layout.
- Privacy/cookie controls and ad labeling where applicable.

### Quality gates
- Lint, typecheck, unit tests, and production build pass in CI.
- No known critical/high security vulnerabilities without a documented mitigation.
- Accessibility review of key journeys.
- Cross-browser smoke test on current Chrome, Safari, and Firefox.
- Test production environment variables and migrations in staging before production.

## 16. Deployment and operations

Environments:
- Local development
- Preview/staging
- Production

Release checklist:
1. Configure production environment variables and domain.
2. Configure database access policies and run migrations.
3. Create the first admin account through a secure process.
4. Verify HTTPS, security headers, email/auth settings, and backups.
5. Confirm policies, contact details, attribution, and takedown process are live.
6. Verify ad provider approval and policy compliance before enabling ads.
7. Run smoke tests and check logs/monitoring.
8. Verify sitemap, canonical URLs, and analytics disclosures.
9. Test rollback and database restore procedures.
10. Enable public launch only after all launch gates pass.

Document incident response for compromised admin accounts, unauthorized links, data exposure, and downtime. Maintain a dependency update process.

## 17. Suggested delivery plan

### Phase 1 — Foundation
Repository audit, project setup, design tokens, shared layout, database schema, migrations, auth, CI.

### Phase 2 — Public catalogue
Home, movie grid, filters, search, detail pages, responsive states, SEO.

### Phase 3 — Editorial/admin
Admin dashboard, movie/review/genre CRUD, authorization checks, preview/publish workflow, audit logs.

### Phase 4 — Link governance and reports
Authorization evidence, external-link validation, report form, moderation workflow, takedown process.

### Phase 5 — Monetization and hardening
Ad slots, consent/disclosure, analytics, performance work, security review, accessibility, tests, deployment rehearsal.

### Phase 6 — Launch
Content QA, staging sign-off, production migration, smoke tests, monitoring, rollback readiness.

## 18. Definition of done

The project is ready for launch only when:
- All MVP routes work and are responsive.
- Published pages contain accurate, authorized content.
- Every public download link has a recorded authorization basis and has passed review.
- Admin access is server-enforced and tested.
- No secrets are committed or exposed client-side.
- Database migrations, backups, restore, and rollback are documented and tested.
- CI passes lint, typecheck, tests, and production build.
- Key journeys pass end-to-end tests.
- Accessibility and Core Web Vitals have been reviewed.
- SEO, privacy, terms, advertising, copyright, and contact pages are live.
- Ads are approved, clearly labeled, and compliant.
- Monitoring and an incident/takedown response path are operational.

## 19. Decisions the agent must document

Before final implementation, record:
- Exact framework/runtime/dependency versions.
- Hosting provider and domain strategy.
- Database schema and RLS policy design.
- Authentication and admin-role provisioning method.
- Image/content licensing approach.
- Search strategy and indexing plan.
- Ad provider and consent approach.
- Backup/restore schedule.
- Any feature deferred from MVP, with rationale.
