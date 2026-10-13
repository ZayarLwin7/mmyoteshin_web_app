# MM YoteShin

A cinematic film discovery and review catalogue with **authorized** external distribution links.

MM YoteShin publishes editorial coverage of films and, where we have a recorded right to do so,
a clearly labelled link to an authorized distribution. It does not host, mirror, proxy or scrape
anything. Every published link carries an authorization basis and a private reference that was
reviewed before the link went live.

---

## Contents

- [What this is](#what-this-is)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [How publication works](#how-publication-works)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)

---

## What this is

**Public site** — home page with curated rails, a filterable and paginated catalogue, title search,
genre and year collections, film detail pages with metadata, synopsis, an editorial review with a
documented rating methodology, and the authorized download options. Plus about, contact, privacy,
terms, copyright/takedown and advertising-disclosure pages, a sitemap and robots rules.

**Admin area** — a permissioned editorial workspace covering film create/edit/publish/archive,
genre management, review management, external link management with authorization evidence, a
content-report queue, an audit trail, and administrator management.

The design intent is a premium, editorial, cinematic feel — dark charcoal base, a restrained warm
accent, strong typography and generous whitespace. It is explicitly *not* a link directory.

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 22 or newer | `engines.node` is enforced |
| pnpm | 10.34.4 | Pinned via `packageManager`; `corepack enable` is the easiest route |
| PostgreSQL | 15+ | Supabase Postgres 17 is what this is built against |

```bash
corepack enable
```

---

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Create your environment file and fill it in
cp .env.example .env.local

# 3. Apply the schema
pnpm db:migrate

# 4. Confirm the schema landed correctly
pnpm db:check

# 5. Create the first administrator (interactive)
pnpm admin:create

# 6. Optional: seed a handful of draft films for local UI work
ALLOW_DEV_SEED=1 pnpm db:seed

# 7. Run it
pnpm dev
```

The site is at <http://localhost:3000> and the admin area at <http://localhost:3000/admin>.

### About `pnpm db:seed`

The seeder refuses to run unless `ALLOW_DEV_SEED=1` is set, and it refuses outright in production.
It creates **draft** films only — no reviews and no links — so nothing it produces can become
publicly visible. It never fabricates reviews, and it never invents an authorization basis.

---

## Environment variables

Every variable is documented with a safe placeholder in [`.env.example`](./.env.example). The
categories are:

- **Database** — `DATABASE_URL`, optional `DIRECT_URL`.
- **Session signing** — `SESSION_SECRET` (32+ random bytes; rotating it invalidates every session),
  `SESSION_TTL_HOURS`.
- **Site identity** — `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_DESCRIPTION`,
  `NEXT_PUBLIC_IMAGE_HOSTS`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_TAKEDOWN_EMAIL`.
- **Advertising** — `NEXT_PUBLIC_ADS_ENABLED` plus slot identifiers. Off by default.
- **Analytics** — `NEXT_PUBLIC_ANALYTICS_ENABLED` plus an optional endpoint. Off by default.
- **Rate limiting** — `RATE_LIMIT_*`.
- **Bootstrap / development** — `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `ALLOW_DEV_SEED`.

Anything prefixed `NEXT_PUBLIC_` is embedded in the browser bundle. **Never** put a secret in one.

> `NEXT_PUBLIC_IMAGE_HOSTS` is an allowlist. A poster URL whose host is not listed will not load,
> because the Next.js image optimiser refuses to fetch it.

---

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest |
| `pnpm test:e2e` | Playwright |
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm db:check` | Verify tables, enums, constraints and policies exist |
| `pnpm db:seed` | Development seed data (guarded) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm admin:create` | Create an administrator |
| `pnpm verify` | Format check → lint → typecheck → test → build |

`pnpm verify` is the same sequence CI runs. If it passes locally, CI should pass.

---

## Architecture

```
src/
  app/                    Next.js App Router
    (public routes)       /, /movies, /movies/[slug], /search, /genres, /years, policy pages
    admin/                sign-in, then the permissioned dashboard route group
    api/health/           operational health check
  components/
    site/                 public UI
    admin/                editorial UI
    ui/                   design-system primitives
  db/
    schema.ts             Drizzle schema (mirrors the SQL)
    client.ts             pooled connection
    queries/
      public.ts           unauthenticated read layer — the visibility rules live here
      admin.ts            authenticated read layer
  lib/
    actions/              server actions, one module per domain
    auth/                 session, guards, permission matrix, password hashing
    security/             URL validation, rate limiting, sanitisation
    services/             business rules (publication gate, link lifecycle, …)
    validation/           Zod schemas — every trust boundary
  middleware.ts           Content Security Policy
migrations/               hand-authored SQL — the source of truth for the schema
scripts/                  migrate, check, seed, create-admin
tests/
  unit/                   pure logic
  integration/            DB-backed (opt-in, see Testing)
  e2e/                    Playwright journeys
```

### Key decisions

**Migrations are hand-written SQL, not generated.** `migrations/*.sql` is the source of truth and
is applied by a small runner that records a SHA-256 checksum per file, so an edited migration is
detected rather than silently skipped. `drizzle-kit generate` is deliberately not part of the
workflow — the schema is small enough that generated diffs would be harder to review than the SQL.

**Drizzle over Prisma.** At the time of writing Prisma 7 had changed architecture and Prisma 8 was
still a release candidate. Drizzle is SQL-first, adds no engine binary, and lets the committed SQL
migrations stay authoritative.

**Public and admin reads are separate modules.** `db/queries/public.ts` is the only way an
unauthenticated page reads the catalogue, and its detail query selects an explicit column list that
**omits `authorization_reference`**. The private evidence behind a link is therefore structurally
unreachable from a public code path, not merely un-rendered.

**Defence in depth for authorization.** Three layers:

1. The **service layer** is the primary control. Every mutation re-checks the caller's permission
   server-side; hiding a button in the UI is not authorization.
2. **Row Level Security** is enabled on every table, with public `SELECT` policies scoped to
   published and authorized rows. The application connects as the table owner, so RLS does not
   constrain it — it exists to constrain Supabase's PostgREST surface. This trade-off is written up
   honestly in `docs/security.md` rather than presented as a stronger guarantee than it is.
3. **CHECK constraints** are the final backstop, e.g. an active link must have an authorization
   basis and a timestamp, and every destination must be `https`.

**The CSP is nonce-free, deliberately.** A per-request nonce would force every public route out of
static generation and into per-request rendering, which is a direct cost to TTFB on exactly the
pages that matter. The trade-off, its residual risk and the upgrade path are documented in
`src/middleware.ts` and `docs/security.md`.

**Consent-gated, cookieless analytics.** No analytics script loads until the visitor opts in, and
the outbound-click beacon stores no identifier.

---

## How publication works

A film is visible to the public only when **all** of the following hold:

- `movies.status = 'published'` **and** `movies.published_at IS NOT NULL`;
- the film has a **published** editorial review of at least 200 characters;
- required metadata is present (title, slug, release year, synopsis, at least one genre);
- and for each link that is shown: `status = 'active'` with an authorization basis **and** an
  authorized-at timestamp.

The admin film page shows a readiness panel listing every blocker, and the publish action re-runs
the same check in the service layer. An operator cannot publish past a blocker by editing the DOM.

A film **may** be published with no link at all — the editorial catalogue is the point, and a
missing link is not a defect.

Link lifecycle:

```
create ──▶ pending_review ──▶ active ──▶ disabled
                 │                │
                 │                └──▶ reported (automatic, on a report)
                 └── delete (only while not active)
```

Changing the destination of an **active** link returns it to `pending_review`. Links are re-checked
periodically; the admin link list surfaces any that have not been checked within 180 days.

---

## Testing

```bash
pnpm test                    # unit + integration (integration skipped unless enabled)
pnpm test:e2e                # Playwright
```

The suite has three tiers, described in full in [`docs/testing.md`](./docs/testing.md):

- **Unit** — validation, slugging, URL and protocol rules, the publication gate, the permission
  matrix, sanitisation, formatting. No database, no network.
- **Integration** — the public access rules (published content only, inactive links non-disclosure,
  the private reference never appearing in a payload). These write real rows, so they are skipped
  unless you opt in:

  ```bash
  RUN_DB_TESTS=1 pnpm test tests/integration
  ```

  Point `DATABASE_URL` at a development or staging database. Never at production.

- **End-to-end** — the seven required journeys, driven with Playwright. Admin journeys need an
  account and are skipped with instructions if `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are unset.

A skipped test is reported as skipped, never as passed.

---

## Deployment

Short version: provision Postgres, set the environment variables, run `pnpm db:migrate`, build and
serve. The full procedure — staging and production, secrets, domain and HTTPS, migrations, rollback,
monitoring and incident response — is in [`docs/deployment.md`](./docs/deployment.md).

The health check is `GET /api/health`. It returns `{"status":"ok"}` or `{"status":"degraded"}` and
deliberately reveals nothing else; point an uptime monitor at it.

---

## Troubleshooting

**`SESSION_SECRET` must be at least 32 characters.**
Generate one and put it in `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Images do not load.**
The host is not in `NEXT_PUBLIC_IMAGE_HOSTS`. It must be an `https://` origin, and the app must be
restarted after changing it — the allowlist is read at build time.

**`db:migrate` reports a checksum mismatch.**
A migration file was edited after it had been applied. Migrations are immutable once applied. Add a
new migration instead of editing an old one; if the change was never applied anywhere, remove the
row from `schema_migrations` and re-run.

**"Prepared statements are not supported" / pooler errors.**
The client sets `prepare: false` for pgbouncer compatibility. If you see this, check you are using
the Supabase **pooler** connection string and not the direct one.

**Sign-in succeeds but every page redirects back to the login screen.**
The session cookie is `Secure` in production. Serving production over plain HTTP will drop it — use
HTTPS, or run `pnpm dev` locally.

**`pnpm build` fails with a database error.**
Pages with `revalidate` are rendered at build time and read the catalogue, so a reachable, migrated
database is required to build. This is intentional, and it is why CI provisions its own Postgres.

**End-to-end tests fail with "too many requests" partway through.**
The suite signs in repeatedly and will trip the sign-in rate limit. Raise `RATE_LIMIT_AUTH_MAX` in
`.env.local` while running the suite locally.

**Formatting check fails on a file you did not touch.**
Run `pnpm format` once and commit the result.

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/implementation-plan.md`](./docs/implementation-plan.md) | Decisions, phases, risks, deferred work, current status |
| [`docs/deployment.md`](./docs/deployment.md) | Staging and production setup, migrations, rollback, monitoring |
| [`docs/security.md`](./docs/security.md) | Roles, policies, secrets, headers, takedowns, incident response |
| [`docs/content-operations.md`](./docs/content-operations.md) | Content entry, authorization review, publication, takedowns |
| [`docs/backup-restore.md`](./docs/backup-restore.md) | Backup policy and a tested restore procedure |
| [`docs/testing.md`](./docs/testing.md) | Test tiers, what needs credentials, how to run each tier |

---

## Licence and content rights

The application code is private to the project. Film metadata, synopses, reviews, artwork and
distribution links are **not** covered by any code licence — each is published only where the
project holds a documented right to do so. See `/copyright` on the running site.
