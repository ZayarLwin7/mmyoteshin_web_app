# Testing

How the suite is organised, what each tier needs, how to run it, and — the part that matters most —
what is currently unverified.

---

## 1. Current status

**No test has been executed.** The environment where this was written could not launch any process
(see `docs/implementation-plan.md` §6), so every file below is written but unrun. Treat the first
`pnpm test` as a debugging session, not a confirmation.

This document describes what the suite is *designed* to do. It is not evidence that it does it.

---

## 2. Tiers

| Tier | Location | Needs | Runs in CI |
| --- | --- | --- | --- |
| Unit | `tests/unit/` | Nothing | Yes |
| Integration | `tests/integration/` | A migrated database, opt-in | Yes (own Postgres) |
| End-to-end | `tests/e2e/` | A running app, a database, an admin account | On demand only |

### Unit — `tests/unit/`

Pure logic. No database, no network, no browser. This is where the security-critical rules live,
because they are the ones worth testing exhaustively.

| File | Covers |
| --- | --- |
| `slug.test.ts` | Slug generation and uniqueness, including non-Latin titles |
| `url-validation.test.ts` | Protocol allow-listing, private/loopback/internal address rejection, the open-redirect guard |
| `publication.test.ts` | The publication gate: required metadata, review length, link authorization |
| `permissions.test.ts` | The role matrix, asserted as specification |
| `formatting-and-sanitize.test.ts` | `sanitizeRichText`, plain-text normalisation, formatting helpers |
| `validation.test.ts` | Every Zod schema at every trust boundary |
| `rate-limit.test.ts` | Identifier hashing, client fingerprinting, constant-time comparison |

### Integration — `tests/integration/`

Real database, real SQL, real constraints. These are the tests that prove the visibility rules rather
than describing them.

`public-access.test.ts` covers:

- a published film appears in the catalogue;
- a draft film does not, and is **not resolvable by slug** — guessing a slug is not a way to discover
  unpublished content;
- only active, authorized links are returned;
- the private authorization reference is absent from the payload object **and** from its serialised
  form;
- the sitemap lists published films only;
- archiving removes a film from public view;
- a published film with a null `published_at` is still hidden;
- an active link with no authorization timestamp is hidden.

**These write real rows.** They are skipped unless explicitly enabled, and they must never run against
production.

```bash
RUN_DB_TESTS=1 DATABASE_URL="postgresql://…/mm_yoteshin_test" pnpm test tests/integration
```

Every fixture is suffixed with a timestamp and random string, and `afterAll` removes everything it
created, so a crashed run cannot collide with the next one.

### End-to-end — `tests/e2e/`

Playwright, driving a real browser against a real server. The seven required journeys plus a smoke
suite:

| File | Flow |
| --- | --- |
| `00-smoke.spec.ts` | Health, security headers, CSP, robots, sitemap, 404, admin noindex, skip link |
| `01-discovery.spec.ts` | Home → search → film details |
| `02-catalogue.spec.ts` | Filtering and pagination |
| `03-admin-auth.spec.ts` | Admin sign-in, rejection, tampered cookie, session hardening |
| `04-movie-lifecycle.spec.ts` | Create draft → blocked → review → publish → archive |
| `05-links.spec.ts` | Add / activate / disable an authorized link, and non-disclosure |
| `06-reports.spec.ts` | Submit and resolve a report |
| `07-responsive.spec.ts` | Mobile navigation and responsive layout |

Two conventions the suite follows deliberately:

**Skipped, never falsely green.** A test whose precondition is missing is skipped *with a reason*.
A green test that asserted nothing is worse than no test, because it hides the gap.

**Assertions target real markup.** Selectors use roles, labels and `name` attributes rather than CSS
classes, so a styling change does not break the suite but a semantics change does.

---

## 3. What needs credentials or data

| Requirement | Affects | Absent → |
| --- | --- | --- |
| `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` | All admin E2E flows | Tests skip with instructions |
| At least one published film | Discovery, catalogue, responsive | Tests skip with instructions |
| At least one genre | Film creation | Test skips with instructions |
| More than one page of results | Pagination | Test skips with instructions |
| A migrated database | Integration tier | Tier is skipped entirely |

There is **no mock substitute** for these, and that is a considered choice: the behaviour under test
*is* the interaction between the service layer, the database constraints and the rendered page.
Mocking any of it would test the mock.

The safe local alternative is a scratch database plus seed data:

```bash
# 1. Point at a scratch database. Never production.
export DATABASE_URL="postgresql://…/mm_yoteshin_dev"

# 2. Migrate and seed.
pnpm db:migrate
ALLOW_DEV_SEED=1 pnpm db:seed

# 3. Create an admin for the suite.
export BOOTSTRAP_ADMIN_EMAIL="e2e@example.test"
export BOOTSTRAP_ADMIN_PASSWORD="E2e-Password-1"
pnpm admin:create
```

### The seeder does not create published content

`pnpm db:seed` creates **drafts** only — no reviews, no links. Nothing it produces can become publicly
visible. That is deliberate: the seed script must not be able to fabricate a review or invent an
authorization basis.

The consequence is that a freshly seeded database has no published films, so the catalogue tests will
skip. The E2E lifecycle spec creates and publishes its own film through the admin UI, which is the
honest way to get published content. `tests/e2e/helpers.ts` exposes `createPublishedFilm()` for
exactly this, and the link and report specs use it as a fixture.

### `pnpm db:seed:series` — five published sample series

`scripts/seed-series.ts` publishes five genuine public-domain American series (The Cisco Kid, Ramar
of the Jungle, Highway Patrol, Science Fiction Theatre, Sea Hunt), each with an original synopsis, an
original review of 1,700–1,900 characters, and a score out of 10. It is how the `/series` section
gets content for a demo or a local run.

Two deliberate omissions:

- **No download links.** A series may publish with none, and the script refuses to invent an
  authorization basis — which is the rule the whole product rests on.
- **`posterUrl: null`.** We hold no artwork we have the right to display, so the cards fall back to
  the designed title placeholder rather than a hotlinked image.

```bash
pnpm db:seed:series          # idempotent — safe to re-run
pnpm db:seed:series -- --remove   # deletes them again, by their `demo-` slug prefix
```

It is resumable: if a previous run died after creating a draft but before publishing it, the next run
finishes the job instead of skipping the record. It also closes its database pool on every exit path —
a script that exits without doing so leaks one idle session pooler backend per failed run, and the
project only has 15.

---

## 4. Running the suite

```bash
# Unit only — fast, no external dependencies.
pnpm test tests/unit

# Unit + integration, against a scratch database.
RUN_DB_TESTS=1 pnpm test

# Watch mode.
pnpm test:watch

# Coverage report (no threshold is enforced yet).
pnpm test:coverage
```

### End-to-end

```bash
# Install a browser once.
pnpm exec playwright install chromium

export E2E_ADMIN_EMAIL="e2e@example.test"
export E2E_ADMIN_PASSWORD="E2e-Password-1"

pnpm test:e2e
```

Playwright starts `pnpm dev` automatically and reuses an already-running server outside CI. To run
against an existing deployment:

```bash
E2E_BASE_URL=https://staging.example.com pnpm test:e2e
```

Setting `E2E_BASE_URL` also stops Playwright starting a local server.

Useful extras:

```bash
pnpm test:e2e --project=chromium          # skip the mobile project
pnpm test:e2e tests/e2e/01-discovery.spec.ts
pnpm test:e2e --ui                        # interactive runner
pnpm exec playwright show-report
```

### Rate limits during a run

The suite signs in repeatedly and will eventually trip the sign-in limit (10 per 5 minutes by
default). Raise it in `.env.local` while testing:

```
RATE_LIMIT_AUTH_MAX=200
```

CI already sets this for the end-to-end job.

### Browsers

Chromium runs by default. The responsive spec runs in a separate `mobile-chromium` project because
"does the mobile menu work" is a question about a viewport, not about a browser engine — running the
whole suite twice would double CI time for no extra signal.

WebKit and Firefox are not enabled by default, because they need large extra downloads most
contributors will not have. To add them, install the browser and add a project to
`playwright.config.ts`.

---

## 5. Adding a test

**A pure rule** → `tests/unit/`. Prefer testing the rule as a specification: assert the boundary
values, not just the happy path.

**A database rule** → `tests/integration/`. Suffix every fixture, and clean up in `afterAll`.

**A user journey** → `tests/e2e/`. Use roles and labels, derive data from the page rather than
hard-coding it, and skip with a reason when a precondition is missing.

Three rules the suite holds to:

1. **Never assert on nothing.** If a test cannot establish its precondition, skip it.
2. **Never weaken an assertion to make it pass.** A failing test is information. A suppressed check is
   lost information.
3. **Never depend on execution order across spec files.** Each spec establishes what it needs.

---

## 6. Continuous integration

`.github/workflows/ci.yml` runs three jobs.

**`verify`** — on every push and pull request:

1. `pnpm install --frozen-lockfile`
2. `pnpm format:check`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm db:migrate` against a **throwaway Postgres 17 service container**
6. `pnpm db:check`
7. `pnpm test` with `RUN_DB_TESTS=1`
8. `pnpm build`

CI provisions its own database rather than pointing at a shared environment. That keeps builds
hermetic, stops a test run from mutating real content, and — usefully — proves the migrations are
reproducible from scratch on every run.

**`security`** — `pnpm audit --audit-level=high` and a `gitleaks` scan over full history.

**`e2e`** — `workflow_dispatch` only. Provisions a database, migrates, seeds, creates an admin, builds,
installs Chromium and runs the suite, uploading the report as an artifact.

### Two things CI will need first

- **`pnpm-lock.yaml` must be committed.** `--frozen-lockfile` fails without it, and the lockfile does
  not exist yet because the initial install never completed.
- **Formatting must be normalised.** Run `pnpm format` once and commit, or `format:check` will fail on
  files that were hand-written to be close to Prettier's output rather than produced by it.

---

## 7. Not yet covered

Recorded so the gaps are visible rather than implied.

| Gap | Why it matters |
| --- | --- |
| Accessibility audit (axe-core, screen reader) | The design targets WCAG 2.2 AA and the E2E suite checks tap targets and overflow, but there has been no automated or manual audit. |
| Visual regression | No snapshot testing; a layout regression would not be caught. |
| Load and performance testing | Core Web Vitals targets are designed for but never measured. |
| The link-scoped report path | The service layer hides a reported link immediately, but no public control passes a link id, so the journey is unreachable. See `docs/implementation-plan.md` §5. |
| Backup restore | Rehearsal procedure is written in `docs/backup-restore.md` and has not been run. |
| Coverage threshold | Reported, not enforced. Set one once the real number is known. |
