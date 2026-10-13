# Implementation plan, decisions and current status

> **Status: RELEASE REHEARSAL IN PROGRESS.**
> Phases 1–7 are **verified**: `format:check`, `lint` and `typecheck` are clean; 182 unit tests pass;
> 15 integration tests pass against the live database; `next build` produces 27 routes; and the
> production build passes a local smoke test. Phase 8 (release rehearsal) is under way — the
> independent `pg_dump` backup has been taken and integrity-checked, and a restore into a throwaway
> PostgreSQL 17 cluster reproduced the source data **exactly** (row counts matched, authorization
> evidence intact, admin password hash survived). See [§6 Verification status](#6-verification-status)
> for the current checklist, including the items still blocked on infrastructure (a second Supabase
> staging project and a deploy host).

---

## 1. Scope

Build MM YoteShin: a movie discovery and review catalogue that publishes only authorized
distribution links, each with a recorded authorization basis, plus the admin workflow that enforces
that rule.

Working name was CineVault; renamed to **MM YoteShin** at the project owner's instruction. The name
is used in the database, the UI wordmark, metadata and documentation.

## 2. Phases

| Phase | Scope | Code | Verified |
| --- | --- | --- | --- |
| 1 | Foundation: scaffold, TypeScript strict, lint, design tokens, scripts, env, CI | Done | ✅ |
| 2 | Schema, security, auth: migrations, RLS, roles, validation, rate limiting | Done | ✅ |
| 3 | Public experience: layout, home, catalogue, search, filters, detail pages, SEO | Done | ✅ |
| 4 | Admin workflow: CRUD, preview/publish, reviews, link authorization, audit | Done | ✅ |
| 5 | Reporting and policies: report workflow, takedown, legal pages | Done | ✅ |
| 6 | Monetization: configurable ad slots, analytics, consent | Done | ✅ |
| 7 | Hardening: tests, accessibility, performance, headers | Done | ✅ |
| 8 | Release rehearsal: staging migration, smoke tests, backup/restore, rollback | In progress | ⏳ |

Phase 8 can now proceed — the application runs and the release gate is green. The local rehearsal
parts (independent backup, dump-integrity check, restore into a throwaway PostgreSQL 17 cluster, local
production smoke test, migration re-apply idempotency, additive-migration verification) are **done**.
The parts that need infrastructure a CLI cannot create — a **second** Supabase staging project and a
deploy host — are **blocked**: the remote staging migration, the smoke test against a real deployed
origin, and the deploy→rollback rehearsal.

---

## 3. Decisions

### 3.1 Backend: Supabase Postgres

The project owner supplied a live Supabase connection string and asked for Supabase. That is
recorded as an accepted decision rather than re-litigated.

Consequences worth knowing:

- The application connects as the **table owner**, so Row Level Security does not constrain it. RLS
  is therefore defence-in-depth for Supabase's PostgREST surface, not the primary control. The
  primary control is the service layer. This is stated plainly in `docs/security.md` and in the
  header of `migrations/0002_rls_policies.sql` rather than being presented as a stronger guarantee.
- The connection uses the **session-mode pooler**, which cannot route prepared statements across
  pooled sessions, so the driver is configured with `prepare: false`.
- TLS is required for any non-local host. `src/db/client.ts` relaxes that only for loopback and
  `host.docker.internal`, so a local or CI Postgres can run without TLS.

### 3.2 ORM: Drizzle, with hand-authored SQL migrations

Prisma was the initial recommendation and was rejected for two concrete reasons: Prisma 7 changed
architecture in a way that would have been disruptive mid-build, and Prisma 8 was still a release
candidate. Drizzle is SQL-first, adds no engine binary, and keeps committed SQL authoritative.

`migrations/*.sql` is the source of truth. A small runner applies them and records a SHA-256
checksum per file, so an edited migration is detected rather than silently skipped.
`drizzle-kit generate` is deliberately **not** part of the workflow.

### 3.3 Authentication

Custom session cookies rather than a hosted auth provider:

- Argon2id password hashing (`@node-rs/argon2`) with OWASP parameters — 19 MiB memory, t=2, p=1.
- HS256 JWT in an `httpOnly`, `SameSite=Lax`, `Secure`-in-production cookie (`mmy_session`).
- The role is **re-read from the database on every request** rather than trusted from the token, so
  revoking or changing a role takes effect immediately instead of when the token expires.
- Sign-in failures are indistinguishable between "no such account" and "wrong password", with a
  dummy hash comparison so the timing matches too.
- Five consecutive failures lock an account for fifteen minutes.
- There is no public sign-up. Administrators are created with `pnpm admin:create`.

### 3.4 Authorization model

Three layers, in order of authority:

1. **Service layer** — every mutation re-checks permission server-side.
2. **Row Level Security** — enabled on all tables; public `SELECT` policies scoped to published and
   authorized rows; no policies at all for private tables, plus `REVOKE ALL` from `anon` and
   `authenticated`.
3. **CHECK constraints** — a final backstop. An active link must have an authorization basis and an
   authorized-at timestamp; every destination must be `https`; a published film must have a
   publication timestamp; admin emails must be lowercase.

Roles are `editor < admin < owner`, with a single permission matrix in
`src/lib/auth/permissions.ts`. That matrix is asserted directly by a unit test, so the specification
is executable rather than prose.

### 3.5 Public/admin read separation

`src/db/queries/public.ts` is the only path an unauthenticated page uses to read the catalogue, and
its detail query selects an explicit column list that **omits `authorization_reference`**. The
private evidence behind a link is structurally unreachable from public code, not merely not
rendered. `src/db/queries/admin.ts` deliberately does select private fields.

A DB-backed integration test asserts both that the field is absent from the payload object and that
its value does not appear anywhere in the serialised result.

### 3.6 Content Security Policy without a nonce

A per-request nonce would force every public route out of static generation into per-request
rendering — a direct cost to TTFB and Core Web Vitals on the pages that matter most. The policy is
therefore nonce-free with `script-src 'self' 'unsafe-inline'`, and everything else locked down
(`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`).

The residual risk is bounded by the rest of the architecture: no user-supplied HTML is ever
rendered, review and synopsis text is stored as plain text and rendered as React text nodes, and any
rich text that is stored goes through a strict `sanitize-html` allowlist. The upgrade path — nonce
for the already-dynamic `/admin/*` routes, then a hash-based policy for public routes — is written
up in `docs/security.md`.

### 3.7 Slugs preserve Unicode

The catalogue carries non-Latin titles (Burmese, Thai, Chinese). `slugify` preserves Unicode letters
and digits rather than stripping them, because `film-3f9a2c` would be unreadable and bad for search.
Percent-encoded UTF-8 paths are valid and indexable.

### 3.8 Caching

Public content uses ISR (`revalidate`) with `revalidatePath` called on content changes, so a publish
is visible immediately while ordinary traffic is served from cache. The CSP decision in 3.6 exists
to keep this possible.

### 3.9 Rate limiting in the database

Counters live in Postgres rather than process memory, so limits survive serverless cold starts and
hold across instances. Raw IP addresses are never stored: the key is an HMAC of the client
fingerprint, derived from `SESSION_SECRET`.

### 3.10 Validation written against Zod-independent primitives

Zod 4 moved `.email()` and `.uuid()` to top-level `z.email()` / `z.uuid()`. `uuidSchema` and
`emailSchema` are written as explicit regexes so behaviour is identical across Zod majors and an
upgrade cannot silently change validation.

---

## 4. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Nothing has ever been committed.** `git log` reports no commits on `main`; every file — including `pnpm-lock.yaml`, which now exists and is 218 KB — is untracked. Until the first commit, there is no recoverable history. | High | Make one initial commit once the working tree is green, and add `backups/` and `.env*` to `.gitignore` first. Both are already ignored. |
| `backups/` held database dumps **inside** the repository working tree, and was not ignored. A dump contains `download_links.authorization_reference` — the private legal evidence — and the Argon2id hash for the administrator account. | High — a careless `git add .` would have committed both | `backups/` is now in `.gitignore`. Move the dumps to the independent off-site store described in §3 of `docs/backup-restore.md`; a dump on the same machine as the credentials is not a backup. |
| Prettier formatting normalised, then the `repo` grew faster than the checks were run. | Medium — `format:check` fails on drift | `pnpm format:check` is part of `pnpm verify`; run it before committing. |
| RLS does not constrain the application, which connects as table owner. | Medium | Documented, not hidden. The service layer is the real control. If the app is ever moved to a restricted role, RLS becomes load-bearing and must be re-reviewed. |
| `script-src 'unsafe-inline'` is the weakest directive in the CSP. | Medium | No user-supplied HTML is rendered anywhere; sanitisation is applied to any stored rich text. Upgrade path documented. |
| Build requires a live database, because `revalidate`d pages are rendered at build time. | Medium | CI provisions its own Postgres service container. Documented in the README. |
| Advertising is built but no provider is integrated. | Low | Intentional. Ads stay off until the network account and site are approved. |
| No real content has been entered, so no page has been seen rendering real data. | High | Editorial entry is a launch task; see `docs/content-operations.md`. |

---

## 5. Deferred work

These are known gaps, recorded rather than quietly omitted.

1. **Link-scoped reporting is unreachable from the UI.** `ReportForm` accepts a `downloadLinkId` and
   the service layer automatically moves a reported link to `reported` (hiding it immediately), but
   no public control passes a link id — only the film-level form is wired. The capability exists and
   is tested at the service layer; the UI affordance does not. Either wire a "report this link"
   control or remove the unused branch.

2. **Phase 8 is partly done, and the remainder is blocked on infrastructure.** The local rehearsal
   parts are complete: an independent `pg_dump` backup was taken and integrity-checked, a restore into
   a throwaway PostgreSQL 17 cluster reproduced the source exactly, migration re-apply was verified
   idempotent, the additive-migration property was confirmed, and the production build passes a local
   smoke test. What remains needs a **second Supabase staging project** and a **deploy host** — neither
   of which can be created from a CLI session — and those gate the remote staging migration, the smoke
   test against a real deployed origin, and the deploy→rollback rehearsal. See §6.

3. **`people` / `movie_credits` are not implemented.** The specification marks them optional and the
   editorial workflow does not need them yet.

4. **`site_settings` exists in the schema but has no admin UI.** Settings are environment-driven for
   now, which is simpler to operate and harder to misconfigure.

5. **No coverage threshold is enforced.** `pnpm test:coverage` reports, but nothing fails the build
   on a drop. A threshold should be set once the suite has been run and the real number is known —
   setting one now would be guesswork.

6. **Accessibility has been designed for, not audited.** Semantic landmarks, a skip link,
   `aria-current`, focus-visible rings, reduced-motion support and real image fallbacks are all in
   place, and the E2E suite checks tap-target size and horizontal overflow. There has been no
   screen-reader pass and no axe-core run, because nothing could be executed.

7. **No monitoring or error-reporting integration.** `/api/health` exists and is monitorable;
   wiring an error reporter (Sentry or equivalent) is a deployment-time task, documented in
   `docs/deployment.md`.

---

## 6. Verification status

Everything in the sequence below has now been run. The order is still the order; the status column is
what actually happened. Nothing is marked as passed on the strength of having been written.

| Step | Command | Status |
| --- | --- | --- |
| 1 | `pnpm install` | ✅ Done — `pnpm-lock.yaml` exists (218 KB) |
| 2 | `pnpm format` | ✅ Done — `format:check` clean |
| 3 | `pnpm lint` | ✅ Clean |
| 4 | `pnpm typecheck` | ✅ Clean |
| 5 | `pnpm db:migrate` | ✅ Applied on the live project; re-apply on PostgreSQL 17.11 verified a **no-op** |
| 6 | `pnpm db:check` | ✅ Clean against the live project |
| 7 | `pnpm test` | ✅ **182 unit tests pass** (first run; now **190** — see §6.3) |
| 8 | `RUN_DB_TESTS=1 pnpm test tests/integration` | ✅ **15 pass** against the live database |
| 9 | `pnpm build` | ✅ **27 routes** produced (now **35** — see §6.3) |
| 10 | `pnpm admin:create` | ✅ Run — 1 administrator exists, and the Argon2id hash survived the restore rehearsal intact |
| 11 | `pnpm test:e2e` | ⚠️ **31 passed, 5 failed, 15 skipped** (first run; now **35 passed, 0 failed, 16 skipped** against a production build — §6.3) |

This table records the **first** time each step was run, so the failures below are preserved rather
than erased. The current, verified numbers are in §6.3.

Per the specification: *"never hide a failed check or claim a test ran when it did not."* Five E2E
assertions fail. They are **not** hidden, and they are **not** caused by the poster work:

| Failure | Cause |
| --- | --- |
| `00-smoke` — unknown-slug returns 404 | The documented soft-404 defect in §5 of the project memory: the root `loading.tsx` boundary commits 200 before `notFound()` runs. |
| `02-catalogue` — page-1 canonicalisation | `Pagination`, untouched by the poster change. |
| `07-responsive` × 3 — mobile menu | `header.tsx`, untouched by the poster change. |

The two components named above have not been touched by any recent change. Root-cause them as separate
work; do **not** relax the 404 assertion — it is correct as written.

The blocking environment fault described in an earlier revision of this document (`sandbox-exec: data
object length … exceeds maximum`) no longer reproduces. Shell commands, `ripgrep`, and process
execution all work. The recorded history of that fault is kept because the *workaround* it forced — a
`mv .next /tmp/…` step to satisfy the safe-delete guard — is still occasionally needed; see the
project memory.

### 6.1 Phase 8 rehearsal — what has actually been executed

| Rehearsal | Result |
| --- | --- |
| Independent `pg_dump` (custom format, `--no-owner --no-privileges`) | ✅ 348 KB dump + 246 KB schema dump + `sha256` + `pg_restore --list` integrity check — 526 TOC lines, 116 `TABLE` entries |
| Restore into a throwaway PostgreSQL **17.11** cluster | ✅ Row counts matched the source **exactly**: movies 12, reviews 8, `download_links` 8, `content_reports` 0, `admin_users` 1, `audit_logs` 64 |
| Authorization evidence survives a round trip | ✅ All 8 active links retained a populated `authorization_reference` |
| Administrator credentials survive | ✅ 1 administrator, 1 Argon2id hash |
| Migration re-apply idempotency | ✅ `db:check` clean on PostgreSQL 17.11; no migration re-applied |
| Additive-migration / rollback property | ✅ No destructive DDL exists: `0001` is `CREATE TABLE`, `0002` is `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`. There is nothing for a rollback to undo. |
| Local production smoke test | ✅ `/api/health` → 200 `ok`; HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` all present; `/robots.txt`, `/sitemap.xml` served; `/admin` carries `X-Robots-Tag: noindex`; home and film detail pages render |

**One expected deviation.** `pg_restore` reports `extension "supabase_vault" is not available`. That
is a Supabase *platform* extension the application does not use, so it is absent from a vanilla
PostgreSQL install. Every application table and every row restored. This is recorded so that a future
reader does not interpret the message as a data loss.

### 6.2 What is blocked, and on what

| Rehearsal | Blocker |
| --- | --- |
| Migration against a **staging** Supabase project | A **second** Supabase project. Cannot be created from a CLI session. |
| Smoke test against a real deployed origin | A deploy host. |
| Deploy → rollback rehearsal | A deploy host *and* a staging project. |

These are infrastructure decisions, not engineering unknowns. Everything that can be rehearsed
without them has been, and has passed.

### 6.3 Phase 1–7 conformance review

Phases 1–7 were reviewed against `Architecture & Design.md` on 2026-10-14 — spec conformance, code
quality, and performance. Five genuine defects were found and fixed; each is listed with the evidence
that it was real and the evidence that the fix worked.

| Area | Verdict |
| --- | --- |
| Data model (§8) | **Exceeds spec.** Every field, enum, constraint and index present, plus `rating_source`/`rating_scale` (§8 asks for both), `destinationHost`, `authorization_notes`, `imageCredit`, `curationWeight`, `reporterIpHash`. |
| Routes (§6) | **All present**, including `/admin/settings`, read-only by deliberate documented design. |
| SEO (§11) | **Strong.** Canonical on every page, `metadataBase` set, absolute OG poster URLs, honest JSON-LD (no invented `aggregateRating`), sitemap excludes drafts and empty genres. |
| Security (§9) | **Strong.** CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`; SSRF and open-redirect defences in `url.ts` are genuinely good; every mutation is a Server Action, so CSRF is covered by the framework; one API route (`/api/health`). |

Defects found and fixed:

| Defect | Evidence it was real | Fix | Verification |
| --- | --- | --- | --- |
| **Ten poster preloads on the home page.** `priority={index < 3}` on three rails plus a hero meant 10 preload links competing with the LCP image. | Counted in the served HTML. | `priority` on the first rail card only; removed from `movie-rail.tsx` and narrowed to `index === 0` in `catalogue-view.tsx`. | Served HTML now carries 1 poster preload. |
| **`rateLimitSearch` was defined but never called.** Search was unrated on a public, DB-hitting route. | Grepped call sites: zero. | Wired into `src/app/search/page.tsx` before the query, with a warning alert on refusal. | New structural test `tests/unit/rate-limit-wiring.test.ts` (8 tests) asserts the call exists *and* precedes `listPublishedMovies(`. Proven non-vacuous by neutralising the call — the test failed, then passed on restore. |
| **Film pages were `ƒ` (on-demand), not prerendered.** Every film view paid a database round trip from Sydney (~275 ms). | Route table showed `ƒ /movies/[slug]`. | `generateStaticParams` using the existing `listPublishedSlugsForSitemap()`, bounded at 5,000 with a comment on the scaling cliff; `dynamicParams` stays `true`. | Build output now shows `● /movies/[slug]` — 8 paths, ISR 5m, CDN expiry 1y. |
| **Fonts loaded from Google Fonts via `next/font/google`.** The loader needs `@vercel/turbopack-next`, which is undeclared and absent from `node_modules`, so the build failed on a cold `.next` — and a plain `pnpm install` cannot fix it. | Reproduced on a cold `.next` in dev: `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`. | Self-hosted: Inter and Fraunces (both SIL OFL 1.1) in `src/app/fonts/`, `next/font/local` in `layout.tsx`. Both records kept in a comment, including the licence provenance. | Cold build exits 0 with zero error lines; cold dev returns 200; both fonts now serve same-origin and the built HTML contains no reference to a Google host. |
| **Soft 404 on unknown and draft slugs.** A root `loading.tsx` boundary committed HTTP 200 before `notFound()` ran. | Verified against `pnpm start` — the body was the not-found UI but the status was 200. | Deleted `src/app/loading.tsx`; wrapped the catalogue grid in `<Suspense fallback={<CatalogueSkeleton />}>` instead. | 15 URLs status-checked against the production build; all correct, including `/movies/does-not-exist-at-all`, `/genres/no-such-genre`, `/years/not-a-year` → 404. |

Two supporting fixes were needed to make the suite trustworthy rather than merely green:

- **`next.config.ts` added** with `allowedDevOrigins: ["127.0.0.1", "localhost"]`. Next 16 blocks cross-origin
  dev requests from `127.0.0.1`, which silently killed client hydration and failed three mobile-menu
  assertions. Probed production with a throwaway Playwright script: the menu opens correctly
  (`Open menu` → `Close menu`, `aria-expanded` false→true, no console errors). The failure was dev-only.
  Mobile tests went 3 failing → 8 passing.
- **`tests/e2e/02-catalogue.spec.ts`** — the canonicalisation test had no `page.goto()`, so it ran
  against `about:blank` and timed out. Navigation added.

Final state of the suites:

| Suite | Result |
| --- | --- |
| `pnpm format:check` / `lint` / `typecheck` | ✅ Clean |
| Unit | ✅ **190 tests** |
| Integration (needs `DATABASE_URL`) | ✅ **15 tests** |
| `pnpm build` | ✅ **35 routes**, exit 0 |
| E2E against the **production build** | ✅ **35 passed, 0 failed, 16 skipped** |

The 16 skips are not silent passes, and they are the single largest honest gap in this number. Sixteen
specs — admin authentication, the publication lifecycle, link activation, and the report queue — skip
because `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` are not set. They were deliberately **not** run this
time: they create and mutate real records with no teardown (one of them *disables an authorized
download link*), and no v17 `pg_dump` is currently available to take a rollback point. Mutating the
authorization record to buy a green checkmark is not a trade this project should make. Those specs
need the disposable staging database from §6.2 to run safely — which is to say, the gap and the
Phase 8 blocker are the same problem.

### 6.4 Still open, and deliberately not fixed

| Item | Why it is still open |
| --- | --- |
| Monitoring / error reporting | No integration chosen. Nothing is currently watching production. |
| Cross-browser smoke test limited to Chromium | `mobile-safari` (WebKit) is opt-in and needs a large manual download; documented in `docs/testing.md`. |
| No axe-core accessibility pass | Never run. Layout is keyboard- and screen-reader-conscious, but that is a claim, not a measurement. |
| E2E runs against a dev server by default | Production-only behaviour (ISR revalidation, CDN cache headers) is not exercised by the suite. This run pointed the suite at the production build to close that for one pass. |
| `authorization_basis` is `NOT NULL`, yet three code paths assume it is nullable | The `download_links_active_requires_authorization` check clause, the `0002` RLS policy, and `link_missing_authorization` in `publication.ts` are all dead. Decide one way: make the column nullable and all three become live, or keep `NOT NULL` and delete the dead clauses. Today a basis must be chosen at creation, so a `pending_review` link cannot lack one — which is the stricter reading. |
| No coverage threshold | Needs the real number first; a threshold set blind either fails the build or means nothing. |
| No editorial content beyond the 8 demo films | The 8 are public-domain or CC-BY colour films. The catalogue is a demo, not a publication. |

---

## 7. What to do next

1. **Make the first commit.** Nothing has ever been committed. `.gitignore` now excludes `backups/`
   and `.env*`, so `git add .` is safe to run. Commit the whole working tree — the lockfile included —
   as one initial commit, so there is a recoverable point before any further work.
2. **Move `backups/` off this machine** to the independent storage location described in
   `docs/backup-restore.md` §3, and confirm the upload. A dump sitting next to the credentials is not
   a backup.
3. ~~Root-cause the three pre-existing E2E failures~~ — **done.** The soft 404, the `Pagination`
   canonicalisation and the mobile-menu assertions were all root-caused and fixed on 2026-10-14; the
   suite is now 35 passed, 0 failed against a production build. See §6.3.
4. **Provision a second Supabase project as staging**, then finish Phase 8: run the §3 migration
   against it, deploy the build, and run the §5 rehearsal end to end — staging dump, restore into a
   third throwaway project, and a deploy→rollback pass. This also unblocks the 16 skipped admin E2E
   specs, which need a disposable database to run without mutating live authorization evidence.
5. **Set `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` in CI** once staging exists, so the admin specs stop
   skipping rather than being quietly ignored.
6. **Set a coverage threshold** in `vitest.config.ts` once the real number is known, so a coverage
   drop fails the build.
7. **Resolve the `authorization_basis` nullability question** (§6.4). It is a schema decision with a
   legal edge; pick one and delete the dead code.
8. **Wire the link-scoped report control** or remove the unused `downloadLinkId` branch (§5.1). The
   capability exists and is tested at the service layer; the UI affordance does not.
9. **Add monitoring** — error reporting at minimum. The application is not currently observable in
   production.
