# Deployment

Covers staging and production setup, migrations, secrets, domain and HTTPS, monitoring, and
rollback.

> **Before you start:** the application has not yet been run anywhere. See the verification checklist
> in `docs/implementation-plan.md` §6. Do not deploy until `pnpm verify` is clean locally.

---

## 1. Topology

| Component | Recommendation | Notes |
| --- | --- | --- |
| Application | Vercel, or any Node 22 host that runs `next start` | Server actions and `revalidate` need a Node runtime, not a static export |
| Database | Supabase Postgres 17 | **Session-mode pooler, port 5432, on every host** — including serverless. See §2.1 for why the transaction pooler cannot be used. |
| DNS / TLS | Managed by the host | HTTPS is mandatory: the session cookie is `Secure` in production |

Two environments, two **separate** Supabase projects. Never point staging at the production database
— the seed script, the integration tests and any exploratory work would touch real content.

---

## 2. First-time setup

### 2.1 Provision the database

1. Create a Supabase project.
2. From **Project Settings → Database**, copy the **session-mode pooler** connection string, port
   **5432**. Use it on **every** host, serverless included.

   > **Do not use the transaction pooler (6543).** It is not merely slower here — it is unusable.
   >
   > `postgres.js` writes queries to its socket without waiting for each reply (pipelining). When
   > more queries are in flight than there are pooled connections, it pipelines the surplus onto a
   > connection that is already busy. Supavisor's **transaction** mode multiplexes many clients onto
   > one server connection and cannot route that second in-flight query, so its reply never arrives.
   >
   > The result is not an error — it is a **permanent hang**. Measured against this project's
   > database, replaying the admin dashboard's query load:
   >
   > | Pooler | 1–5 concurrent | 6 concurrent | 8 concurrent |
   > | --- | --- | --- | --- |
   > | Session (5432) | 250–280 ms | 268 ms | 260 ms |
   > | Transaction (6543) | 2 200 ms | **hangs** | **hangs** |
   >
   > The cliff sits at exactly `max + 1` pooled connections, and once crossed the client is
   > **poisoned**: every subsequent query on that instance hangs, including single queries that
   > worked moments earlier. That is why `/admin` (nine concurrent queries) hangs forever on Vercel
   > while `/admin/settings` (few queries) answers normally — and why the instance never recovers.
   >
   > No client option avoids it. `max_pipeline: 1`, `fetch_types: false`, `prepare: false` and
   > lowering `max` were each tested; the cliff moves to `max + 1` and stays. The session pooler
   > handled **20 concurrent** queries with no cliff, and was ~10× faster, because prepared
   > statements work there too.
   >
   > If the transaction pooler is ever required, the fix is a different driver: Drizzle's
   > `node-postgres` adapter queues instead of pipelining. That is a driver swap, not a config change.

   The direct connection string is not suitable either — it resolves over IPv6 only, and there is no
   pooling.

   > **The session pooler caps the whole project at 15 connections (`pool_size: 15`).** Every warm
   > serverless instance holds its own pool for as long as it lives, so the per-instance `max` in
   > `src/db/client.ts` decides how many instances fit inside that budget. At `max: 5` only **three**
   > instances fit; a fourth gets `EMAXCONNSESSION` and its Server Component render fails. On a
   > client-side navigation that surfaces as React error #441 — "Something went wrong / This page
   > cannot be loaded" — not as a retryable database error, because the failing render is the RSC
   > payload for the route being navigated to. Measured: sixteen rapid page loads (a normal
   > browse-and-prefetch burst) pinned all fifteen connections and locked the database out entirely.
   > Production therefore runs at **`max: 2`**, letting seven instances coexist; the cost is one extra
   > round trip on cold ISR renders only. Keep `max` under 3 on any serverless host.
   >
   > To reclaim connections pinned by a crashed or abandoned instance, terminate idle Supavisor
   > backends **through the transaction pooler** (the session pooler is exactly what is exhausted):
   >
   > ```bash
   > psql "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"' | sed 's/:5432/:6543/')" \
   >   -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='postgres' AND application_name='Supavisor' AND state='idle' AND pid <> pg_backend_pid();"
   > ```
3. Keep the password in the host's secret store, not in the repository.

### 2.2 Configure environment variables

Set every variable from `.env.example` in the host's environment configuration.

Minimum set for a working deployment:

```
DATABASE_URL
SESSION_SECRET              # 32+ random bytes, unique per environment
NEXT_PUBLIC_SITE_NAME
NEXT_PUBLIC_SITE_URL        # the real origin, used for canonicals and the sitemap
NEXT_PUBLIC_SITE_DESCRIPTION
NEXT_PUBLIC_IMAGE_HOSTS     # https origins only
NEXT_PUBLIC_CONTACT_EMAIL
NEXT_PUBLIC_TAKEDOWN_EMAIL
```

Generate `SESSION_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Use a different value for staging and production.** Sharing one means a staging session is valid in
production.

Leave `NEXT_PUBLIC_ADS_ENABLED=false` and `NEXT_PUBLIC_ANALYTICS_ENABLED=false` until the relevant
accounts and policies are actually in place.

Never set `ALLOW_DEV_SEED=1` in production. The seeder also refuses outright when it detects a
production environment — that guard is a backstop, not the plan.

### 2.3 Apply migrations

Migrations run as a separate step, before the app starts serving:

```bash
DATABASE_URL="<production pooler url>" pnpm db:migrate
```

Then confirm:

```bash
DATABASE_URL="<production pooler url>" pnpm db:check
```

`db:migrate` records a SHA-256 checksum per migration. An already-applied migration that has been
edited is reported as a mismatch and the run stops. Migrations are immutable once applied — add a new
file instead.

### 2.4 Create the first administrator

```bash
DATABASE_URL="<production pooler url>" pnpm admin:create
```

This is interactive and creates an `owner`. There is no public sign-up. Do not put the bootstrap
password in the environment for production — pass it at the prompt, or use
`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` for a single run and then clear them.

Immediately after signing in: create any other administrators from `/admin/settings`, give each the
**lowest** role that lets them do their job, and confirm the audit trail is recording.

### 2.5 Build and deploy

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm build` needs a reachable, migrated database. Pages with `revalidate` are rendered at build time
and read the catalogue. This is intentional; the build fails loudly rather than producing a broken
site.

### 2.6 Domain and HTTPS

1. Point the domain at the host.
2. Confirm HTTPS is enforced and HTTP redirects.
3. Set `NEXT_PUBLIC_SITE_URL` to the canonical origin (`https://…`, no trailing slash) **before** the
   final build — canonicals, Open Graph URLs and the sitemap are derived from it.
4. Confirm HSTS is being sent (`Strict-Transport-Security: max-age=63072000; …`).
5. Submit `/sitemap.xml` to search consoles.

---

## 3. Deploying to Vercel

The repository is a standard Next.js 16 App Router project. Vercel detects it automatically — no
`vercel.json` is required.

### 3.1 One-time project setup

```bash
# from the repository root, after the code is pushed to GitHub
npm i -g vercel          # or: npx vercel
vercel login
vercel link              # pick the team, then create/link the project
```

Or, in the dashboard: **Add New → Project → Import Git Repository**, and point it at the repo.
Vercel then builds and deploys on every push to `main`.

### 3.2 Environment variables

Set these under **Project → Settings → Environment Variables**, for the **Production** environment
(and separately for **Preview** if you want preview deployments to work):

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | session pooler, port **5432** | **Not** the transaction pooler — see §2.1 |
| `SESSION_SECRET` | 48 random bytes | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | **Must be set before the first build.** Canonicals, OG URLs and the sitemap derive from it, and it is inlined into the browser bundle. |
| `NEXT_PUBLIC_SITE_NAME` | `MM YoteShin` | |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | … | |
| `NEXT_PUBLIC_IMAGE_HOSTS` | `https://…` comma-separated, https only | The image optimiser allowlist |
| `NEXT_PUBLIC_CONTACT_EMAIL` | … | Shown on `/contact` |
| `NEXT_PUBLIC_TAKEDOWN_EMAIL` | … | Shown on `/copyright`; must be a monitored mailbox |
| `RATE_LIMIT_AUTH_MAX` / `_WINDOW_SECONDS` | `10` / `300` | |
| `RATE_LIMIT_REPORT_MAX` / `_WINDOW_SECONDS` | `5` / `3600` | |
| `RATE_LIMIT_SEARCH_MAX` / `_WINDOW_SECONDS` | `60` / `60` | |
| `SESSION_TTL_HOURS` | `12` | |

Leave `NEXT_PUBLIC_ADS_ENABLED=false`, `NEXT_PUBLIC_ANALYTICS_ENABLED=false`,
`ALLOW_DEV_SEED=0`. Never set `ALLOW_DEV_SEED=1` on a deployed environment.

`SESSION_SECRET` **must differ per environment.** A shared value makes a staging session valid in
production. Rotating it invalidates every active admin session.

### 3.3 Migrate and create the first administrator

Vercel does not run `pnpm db:migrate` as part of a build. Run both against the **production**
`DATABASE_URL` from your machine, before the first deploy that serves traffic:

```bash
DATABASE_URL="postgresql://…:5432/postgres" pnpm db:migrate
DATABASE_URL="postgresql://…:5432/postgres" pnpm db:check
DATABASE_URL="postgresql://…:5432/postgres" pnpm admin:create
```

`pnpm build` connects to the database to prerender the catalogue, so a database that has not been
migrated makes the build fail. That is deliberate.

`pnpm admin:create` is interactive and creates an **owner**. There is no public sign-up.

### 3.4 Deploy

```bash
vercel --prod
```

Or push to `main` if you imported the repository. After the first deploy, set the real domain
(**Project → Settings → Domains**), update `NEXT_PUBLIC_SITE_URL` to it, and redeploy so the
canonicals are right.

### 3.5 Verify

```bash
curl -fsS https://<origin>/api/health
curl -fsSI https://<origin>/ | grep -i strict-transport-security
curl -fsS https://<origin>/robots.txt
curl -fsS https://<origin>/sitemap.xml | head
curl -fsSI https://<origin>/admin | grep -i x-robots-tag
```

### 3.6 Vercel-specific caveats

- **Connection budget.** Watch Supabase's connection count in the first hour. The session pooler
  holds one server connection per pooled client for that client's lifetime, so the ceiling is
  `max` × concurrent instances. With `max: 5` that is five connections per warm instance; a pool
  only opens what it needs, so a mostly-cached public site typically holds one or two. If the count
  approaches the project's limit, lower `max` in `src/db/client.ts` before raising anything else.
- **Admin pages issue many concurrent queries.** The dashboard fires nine at once. That is fine on
  the session pooler and fatal on the transaction pooler — see §2.1.
- **Cold starts pay the TLS handshake.** A fresh serverless instance pays ~2.2 s to open its first
  Postgres connection. `idle_timeout: 300` in `src/db/client.ts` keeps warm instances from paying it
  twice, but a cold instance will.
- **`searchParams` opts catalogue routes out of ISR.** Only `/movies/[slug]` is genuinely cached on
  the CDN; `/movies` and `/search` re-render per request and hit the database.
- **Serverless has no local disk.** Everything the build needs must be in the repository or fetched
  at request time — which is why the fonts are self-hosted in `src/app/fonts/` rather than pulled
  from Google Fonts at build time.

---

## 4. Admin access — routes and the sign-in flow

### 4.1 The endpoints

| Route | Purpose |
| --- | --- |
| `GET /admin/login` | Sign-in form. Outside the guard, so it cannot lock itself out. |
| `POST /admin/login` | **Server Action** — not a REST endpoint |
| `GET /admin` | Dashboard |
| `GET /admin/forbidden` | Shown when a signed-in admin lacks the role for a page. Outside the guard. |
| `GET /api/health` | Public health check, no auth |

Sign-out is a Server Action (`signOutAction` in `src/lib/actions/auth.ts`) that clears the cookie and
redirects to `/admin/login`. **There is no `/admin/logout` route** — do not link to one.

### 4.2 Where authentication is actually enforced

`src/middleware.ts` does **not** authenticate. It only stamps the CSP header. Authentication is
enforced in the **`(dashboard)` route-group layout**, which calls `requireAdmin("/admin")`:

- No valid session → redirect to `/admin/login?next=…`
- The role is **re-read from the database on that request**, so disabling an account or changing a
  role takes effect on the very next request. The role claim inside the JWT is never trusted alone.
- Each nested page then checks the specific permission it needs.
- `/admin/login` and `/admin/forbidden` sit *outside* the route group so they stay reachable.

This is why there is no `/api/admin/*` REST surface and no public sign-up. `/admin/login` is the only
unauthenticated entry point into the admin area.

### 4.3 How a session is actually established

The sign-in form posts to the `signInAction` Server Action in `src/lib/actions/auth.ts`. There is no
`fetch` to write — the `<form>` action *is* the endpoint:

```
browser  ──POST /admin/login──▶  Next.js Server Action
                                    ├─ rateLimitAuth(fingerprint)      ← before any hashing
                                    ├─ loginSchema.safeParse(...)      ← Zod
                                    ├─ signIn(email, password)         ← Argon2id verify
                                    │    └─ per-account lockout in the service layer
                                    ├─ establishSession(...)           ← sets the cookie
                                    └─ redirect(safeInternalRedirect(redirectTo, "/admin"))
```

The cookie is `mmy_session`: **httpOnly**, `SameSite=Lax`, `Secure` in production, `Path=/`,
`maxAge = SESSION_TTL_HOURS × 3600`. It holds an HS256 JWT signed with `SESSION_SECRET` carrying
only `userId`, `email`, `displayName` and `role` — no secrets, no authorization references.

Because it is httpOnly, **you cannot log in by setting a cookie by hand** and there is no
`Authorization: Bearer` header path. The browser form is the only way in.

### 4.4 Why the browser is the only client

- **Authorization re-reads the database.** `getCurrentAdmin` re-reads the role on every request; the
  role in the token is never trusted alone. A hand-crafted token fails immediately.
- **Rate limiting and lockout** are keyed to the client fingerprint and the account, so a script that
  retries gets throttled per IP and per account.
- **CSRF is covered by the framework.** Server Actions are POST-only with origin checks, so there is
  no separate CSRF token to obtain.
- **`?next=` is allow-listed.** `safeInternalRedirect` discards any off-site target.

### 4.5 First sign-in

1. `pnpm admin:create` against the target database (§2.4).
2. Visit `https://<origin>/admin/login`.
3. Enter the email and password given at creation.
4. You land on `/admin`.

Then, from `/admin/settings`, create any further administrators and give each the **lowest** role
that lets them work. `recordAudit` records every sign-in and sign-out.

### 4.6 Scripted access, if you need it

Use Playwright, which drives the real form and keeps the httpOnly cookie for you. The suite already
does this — `signInAsAdmin` in `tests/e2e/helpers.ts`. Note that these specs **mutate live records
with no teardown**, so point them at a disposable database, never production:

```bash
E2E_ADMIN_EMAIL="you@example.com" E2E_ADMIN_PASSWORD="…" \
E2E_BASE_URL="https://<origin>" pnpm test:e2e
```

---

## 5. Routine deploys

```bash
# 1. Migrate first. Migrations are additive and backward compatible.
DATABASE_URL="…" pnpm db:migrate

# 2. Deploy the new build.
```

Order matters. Apply migrations **before** the new code is live, so the new code never meets an old
schema. Every migration in this project is written to be backward compatible with the previous
release — new columns are nullable or defaulted, and nothing is dropped in the same release that
stops using it.

The reverse order (deploy code, then migrate) will cause errors during the window between the two.

### Post-deploy smoke test

```bash
curl -fsS https://<origin>/api/health          # {"status":"ok"}
curl -fsSI https://<origin>/ | grep -i strict-transport-security
curl -fsS https://<origin>/robots.txt
curl -fsS https://<origin>/sitemap.xml | head
curl -fsSI https://<origin>/admin | grep -i x-robots-tag
```

Then in a browser: load the home page, open a film, and sign in to `/admin`.

---

## 6. Rollback

### Application

Roll back to the previous deployment in the host's dashboard. Because migrations are additive and
backward compatible, the previous release runs correctly against the migrated schema — that is the
point of the compatibility rule above.

### Database

There are no down-migrations, deliberately. Reversing a schema change in production is more
dangerous than rolling forward, and a down-migration that drops a column destroys data.

If a migration must be undone:

1. **Stop writes** — put the site into maintenance or disable the affected feature.
2. Take a fresh backup (`docs/backup-restore.md`) even if the change looks small.
3. Write a **new forward migration** that corrects the problem. Do not edit or delete the applied
   one.
4. If data was lost, restore from the pre-migration backup into a scratch database, extract what is
   missing, and reconcile deliberately. Do not restore over production.

The only case for restoring over production is total data loss, and that is a decision for the
project owner, not an on-call engineer.

---

## 7. Monitoring

### Health check

`GET /api/health` → `200 {"status":"ok", "latencyMs": n}` or `503 {"status":"degraded"}`.

It deliberately reports nothing else — no versions, no table counts, no migration state, no error
text. A public endpoint should not be a reconnaissance tool. Details go to the server log.

Point an uptime monitor at it, at 60-second intervals, and alert on two consecutive failures.

### What to watch

| Signal | Where | Threshold |
| --- | --- | --- |
| Health check | uptime monitor | 2 consecutive failures |
| Server error rate | host dashboard | > 1% of requests over 5 minutes |
| Function duration p95 | host dashboard | approaching the plan's limit |
| Database connections | Supabase dashboard | approaching the pool limit |
| Slow queries | Supabase dashboard | > 1s |
| Database size | Supabase dashboard | approaching the plan's limit |

### Error reporting

Not yet integrated. To add one (Sentry or equivalent):

1. Wrap the app in the provider's Next.js integration.
2. Configure it to **scrub** request bodies, cookies and headers — the app handles reporter contact
   details and authorization references, and neither belongs in an error report.
3. Confirm source maps upload, or stack traces will be useless.

### Logs

The app logs sanitised diagnostic context. It never logs passwords, tokens, session values or
authorization references. If a log line would be sensitive, it is not logged.

---

## 8. Scaling notes

- The database connection pool is intentionally small (2 in development, 5 in production) because
  serverless instances are short-lived and the Supabase pooler has a connection budget. Raising it
  without raising the pooler's limit moves the failure rather than fixing it.
- Public pages are ISR-cached and served without touching the database. A traffic spike should not
  reach Postgres.
- `revalidatePath` is called on content changes, so an editorial publish is visible immediately
  without waiting for the revalidation window.
- Image optimisation is bounded by `NEXT_PUBLIC_IMAGE_HOSTS` and a capped set of generated sizes, so
  the optimiser cannot be turned into an open proxy or an unbounded cache.

---

## 9. Launch checklist

- [ ] `pnpm verify` clean locally
- [ ] Staging deployed and smoke-tested
- [ ] Migrations applied to production and `db:check` passes
- [ ] First owner created; bootstrap password cleared from the environment
- [ ] `SESSION_SECRET` unique to production
- [ ] `NEXT_PUBLIC_SITE_URL` is the real origin and the build was made with it set
- [ ] HTTPS enforced; HSTS present
- [ ] `/admin` returns `X-Robots-Tag: noindex`
- [ ] Privacy, terms, copyright/takedown and advertising pages reviewed by a human
- [ ] `NEXT_PUBLIC_TAKEDOWN_EMAIL` is a monitored mailbox
- [ ] Analytics and ads are off, or their consent and approval requirements are actually met
- [ ] Uptime monitor configured against `/api/health`
- [ ] Error reporting integrated and scrubbing enabled
- [ ] A backup has been taken and **a restore has been rehearsed** (`docs/backup-restore.md`)
- [ ] Rollback path confirmed by deploying and reverting once
- [ ] Every administrator has the lowest role that lets them work
- [ ] No real content is live that has not been through the authorization review in
      `docs/content-operations.md`
