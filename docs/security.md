# Security

This document covers the authorization model, the secrets involved, the HTTP security posture, the
reporting and takedown path, and what to do when something goes wrong.

It deliberately states where the guarantees are weaker than they might appear. An honest threat
model is more useful than a reassuring one.

---

## 1. Roles and permissions

Three roles, strictly ordered: `editor` < `admin` < `owner`.

The single source of truth is the permission matrix in `src/lib/auth/permissions.ts`. It is
asserted directly by a unit test (`tests/unit/permissions.test.ts`), so the specification is
executable rather than prose.

| Permission | editor | admin | owner |
| --- | :---: | :---: | :---: |
| `movie:read` | ✓ | ✓ | ✓ |
| `movie:write` | ✓ | ✓ | ✓ |
| `movie:publish` | | ✓ | ✓ |
| `movie:archive` | | ✓ | ✓ |
| `review:read` / `review:write` | ✓ | ✓ | ✓ |
| `review:publish` | | ✓ | ✓ |
| `link:read` | ✓ | ✓ | ✓ |
| `link:write` | ✓ | ✓ | ✓ |
| `link:authorize` | | ✓ | ✓ |
| `link:disable` | ✓ | ✓ | ✓ |
| `report:read` | ✓ | ✓ | ✓ |
| `report:resolve` | | ✓ | ✓ |
| `admin:manage` | | | ✓ |
| `settings:write` | | | ✓ |

The important asymmetries, and why:

- **An editor can write content but cannot publish it.** Drafting and publishing are separate
  decisions, and the second one is the one that carries legal exposure.
- **An editor can disable a link but cannot authorize one.** Disabling is a safety action and should
  be available to whoever notices the problem; authorizing is a legal assertion.
- **An editor can annotate a report but cannot close it.** Closing a report is a decision about
  whether the site was wrong.
- **Only an owner can manage administrators or write settings.** Privilege escalation requires the
  highest role.

### Enforcement

Hiding a control in the UI is **not** authorization. Every mutation re-checks permission server-side
via `assertPermission` / `requirePermission`. A request that forges a form post for an action the
caller cannot perform is rejected in the service layer, regardless of what the UI showed them.

The role is re-read from the database on every request rather than trusted from the session token,
so demoting an administrator takes effect on their next request rather than when their token
expires.

---

## 2. Authentication

- **Hashing:** Argon2id via `@node-rs/argon2`, OWASP parameters — 19 MiB memory, t=2, p=1.
- **Session:** an HS256 JWT in a cookie named `mmy_session`, `httpOnly`, `SameSite=Lax`, and
  `Secure` when `NODE_ENV=production`. Lifetime defaults to 12 hours.
- **Signing key:** `SESSION_SECRET`. Rotating it invalidates every active session immediately.
- **No public sign-up.** Administrators are created with `pnpm admin:create`, which is the
  documented first-admin provisioning procedure.
- **Account lockout:** five consecutive failures locks the account for fifteen minutes.
- **Failure messages are non-committal.** "No such account" and "wrong password" are
  indistinguishable in the response, and a dummy hash comparison keeps the timing similar, so the
  endpoint cannot be used to enumerate accounts.
- **Accounts with no role are refused** rather than defaulting to something.

---

## 3. Database authorization

### Service layer — the primary control

Every read and write goes through `src/lib/services/*`, which enforces the business rules. This is
what actually protects the data.

### Row Level Security — defence in depth

RLS is enabled on every table (`migrations/0002_rls_policies.sql`):

- Public `SELECT` policies expose only rows that are published and authorized.
- Private tables (`admin_users`, `admin_profiles`, `audit_logs`, `rate_limits`) have **no** policies.
- `REVOKE ALL` is issued to `anon` and `authenticated` on private tables and on all writes.

**Be clear about what this does and does not do.** The application connects to Postgres as the
**table owner**, and a table owner bypasses RLS. RLS therefore does **not** constrain the
application — it constrains Supabase's PostgREST surface, which is reachable with the project's
anon key. That is a real and useful protection, but it is not the same as "the database enforces
the rules against our own app".

If the application is ever moved to a restricted role (which would be an improvement), RLS becomes
load-bearing and the policies must be re-reviewed and tested as the primary control. That is a
deliberate future change, not something to drift into.

### CHECK constraints — the backstop

The schema refuses inconsistent rows outright:

- `download_links_active_requires_authorization` — an active link must have an authorization basis.
- `download_links_destination_https` — every destination must be `https`.
- `movies_published_requires_timestamp` — a published film must have a publication timestamp.
- `movies_series_requires_seasons` — a series must carry a season count.
- `movies_has_no_seasons_when_movie` — a film must not carry a season or episode count.
- `movies_season_count_positive` / `movies_episode_count_positive` — the counts, when set, are ≥ 1.
- `reviews_published_requires_timestamp` — same for reviews.
- `admin_users_email_lowercase` — admin emails are stored lowercase.
- A partial unique index allows only one **published** review per film.

The series shape is enforced in three places, in this order of convenience: the Zod schema
(`movieInputSchema`) returns a field error, `evaluatePublicationReadiness` blocks publication with
`series_seasons_missing`, and the CHECK constraints refuse the row outright. The schema check exists
so an editor gets an actionable message; the CHECK exists so that even a direct SQL write cannot
create a series with no seasons.

### The private evidence field

`download_links.authorization_reference` holds contract ids, permission-email references and licence
URLs. It is:

- never selected by `src/db/queries/public.ts`;
- never returned by any public server action or route handler;
- excluded by an explicit column list in the detail query, so a future `select *` refactor would have
  to be deliberate;
- asserted absent by an integration test that also checks its *value* does not appear anywhere in the
  serialised payload.

---

## 4. Secrets

| Secret | Where it lives | Notes |
| --- | --- | --- |
| `DATABASE_URL` | environment only | Contains the database password. Never logged. |
| `SESSION_SECRET` | environment only | 32+ random bytes. Rotating invalidates all sessions. |
| `BOOTSTRAP_ADMIN_PASSWORD` | environment, **bootstrap only** | Should be blank in production. |

Rules:

- `.env.local` is git-ignored. `.env.example` contains placeholders only and is committed, because it
  documents what a checkout needs.
- Nothing secret is ever placed in a `NEXT_PUBLIC_*` variable — those are embedded in the browser
  bundle.
- Passwords, tokens and session values are never logged. Error logging records a message and a
  correlation context, not the payload.
- CI runs `gitleaks` over full history and `pnpm audit --audit-level=high`.

If a secret is committed: rotate it first, then clean history. Rotating is the part that actually
reduces risk; history rewriting is cosmetic if the value is still live.

---

## 5. HTTP security posture

Set in `next.config.ts` and applied to every response:

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Powered-By` | removed |

Admin surfaces additionally receive `X-Robots-Tag: noindex, nofollow, noarchive` and
`Cache-Control: no-store, max-age=0`.

### Content Security Policy

Applied per response in `src/middleware.ts`:

```
default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self';
manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests
```

**The policy is nonce-free, and that is a deliberate trade-off.**

A per-request nonce is the textbook approach, but Next.js can only stamp its bootstrap scripts with a
nonce on routes it renders *dynamically*. Reading `headers()` in a page opts that route out of static
generation, so a global nonce would convert the entire public catalogue from ISR to per-request
rendering — a direct cost to TTFB and Core Web Vitals on exactly the pages that matter most.

The consequence is that `script-src 'unsafe-inline'` is the weakest directive here. The residual risk
is bounded by the rest of the architecture:

- No user-supplied HTML is ever rendered. Review bodies and synopses are stored as plain text and
  rendered as React text nodes.
- Any stored rich text passes through `sanitizeRichText` (strict allowlist, `sanitize-html`), and
  external links in it get `rel="noopener noreferrer nofollow"`.
- React escapes interpolated values by default.
- JSON-LD is serialised with `<` escaped so a value containing `</script>` cannot close the block.

In other words, there is no known path to inject a `<script>` tag in the first place. That is the
argument — not that `'unsafe-inline'` is harmless.

**Upgrade path**, in order of value for effort:

1. Move `/admin/*` to a nonce-based policy. Those routes are already dynamic, so there is no
   caching cost.
2. Replace inline styles with a stylesheet so `style-src` can drop `'unsafe-inline'`.
3. Migrate public routes to a hash-based policy generated at build time from the emitted scripts.

---

## 6. Input validation and output safety

- Every value crossing a trust boundary is parsed with Zod in `src/lib/validation/schemas.ts` before
  it reaches a service. Browser-side validation is a convenience, never the control.
- External URLs pass `validateExternalUrl`: `https` only, no embedded credentials, and no loopback,
  private, link-local, CGNAT, IPv6 ULA or reserved-TLD hosts. This blocks SSRF-ish destinations and
  keeps a compromised admin record from pointing at internal infrastructure.
- Open redirects are blocked by `safeInternalRedirect`, which allow-lists a same-origin path. The
  admin sign-in `next` parameter goes through it — an off-site target is discarded.
- Rich text is sanitised with a strict allowlist; `<script>`, `<iframe>`, `<object>`, `<embed>`,
  event-handler attributes and `javascript:` URLs are all removed.
- LIKE patterns from user input are escaped with `escapeLikePattern` so a search term cannot become
  a wildcard scan.
- The public report form carries a honeypot field that is hidden from assistive technology and
  rejected if filled.

---

## 7. Rate limiting and abuse

Counters live in Postgres, not process memory, so limits hold across serverless instances and
survive cold starts.

| Scope | Default | Window |
| --- | --- | --- |
| Admin sign-in | 10 | 5 minutes |
| Report submission | 5 | 1 hour |
| Search | 60 | 1 minute |

**Raw IP addresses are never stored.** The key is `HMAC(SESSION_SECRET-derived-key, client-fingerprint)`,
so the table cannot be reversed into a list of visitor IPs even if it leaks. Elapsed windows are
pruned opportunistically.

The limiter **fails open** on a database error — a counting failure should not lock every user out —
and the failure is surfaced through the caller's error logging.

---

## 8. Reporting and takedown

The reporting workflow is the safety net for both rights issues and broken links.

**Public path:** every film page carries a report form. Submitting a report is rate-limited, stored
with a keyed IP hash (never the raw address), and requires enough detail to act on.

**Link-scoped reports** automatically move the reported link to `reported`, which removes it from
public view immediately — before any human looks at it. *(Note: the service layer and component
support this, but no public control currently passes a link id. See the deferred work in
`docs/implementation-plan.md`.)*

**Admin path:** reports land in `/admin/reports`. An editor can review and annotate; an admin or
owner resolves or rejects. Resolving can optionally disable the reported link permanently.

**Takedown contact:** `NEXT_PUBLIC_TAKEDOWN_EMAIL`, published on `/copyright`. The process and
response targets are in `docs/content-operations.md`.

**Copyright policy:** the site publishes only authorized distributions. Where authorization is
unknown, the link stays in a non-public pending state. There is no scraping, no rehosting, no
proxying, and no deceptive download UI — no fake buttons, fake progress bars, countdowns or
misleading close controls anywhere in the product.

---

## 9. Incident response

### A link is reported as unauthorized

1. **Contain first.** Disable the link from the film page (editors can do this). It stops being
   publicly visible immediately.
2. Verify the report against the recorded authorization basis and reference.
3. If the authorization does not hold: disable the link permanently, record the outcome on the
   report, and check whether the same provider or basis was used elsewhere — `/admin/links` lists
   every link with its basis and last-checked date.
4. If the authorization does hold: reject the report with a note explaining why.
5. If the same basis is implicated across several links, treat it as a content-policy failure and
   review every film using it.

### Suspected credential compromise

1. Rotate the affected secret.
   - `SESSION_SECRET` → every session is invalidated. Everyone signs in again.
   - `DATABASE_URL` password → rotate in Supabase, then redeploy.
2. Review `/admin/audit` for privileged actions around the exposure window.
3. Review administrator accounts at `/admin/settings`; deactivate anything unrecognised.
4. Record what happened, the window, and what was changed.

### Suspected data exposure

1. Identify which table and which columns.
2. If `authorization_reference` is implicated, treat it as a rights-evidence leak and notify the
   affected rights holders — that is the harm, not the technical exposure.
3. If reporter contact details are implicated, notify affected reporters.
4. Fix the cause, then rotate anything that was exposed.

### A migration breaks production

See the rollback procedure in `docs/deployment.md`.

---

## 10. Standing review items

- `script-src 'unsafe-inline'` — see the upgrade path in §5.
- RLS is not load-bearing for the application. If the connection role changes, re-review.
- No error-reporting integration is wired up yet.
- Accessibility has been designed for but not audited with a screen reader or axe-core.
- `pnpm audit` runs in CI at `--audit-level=high`. If an advisory cannot be fixed promptly, record
  it here with a review date rather than lowering the threshold.
