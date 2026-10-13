# Backup and restore

What is backed up, how often, where it lives, and — the part that actually matters — a restore
procedure that has been rehearsed rather than assumed.

> **A backup that has never been restored is a hypothesis, not a backup.** §5 is a rehearsal
> procedure. Run it before launch, and quarterly after.

---

## 1. What holds state

| Asset | Where it lives | Can it be regenerated? |
| --- | --- | --- |
| Film metadata, genres, reviews | Postgres | **No.** This is original editorial work. |
| Distribution links + **authorization evidence** | Postgres | **No.** This is the legal record of why we published something. |
| Content reports and their resolutions | Postgres | No. |
| Audit log | Postgres | No. |
| Administrator accounts and password hashes | Postgres | Partly — accounts can be recreated, but the audit trail of who did what cannot. |
| Code and configuration | Git | Yes, from the repository. |
| Secrets | The host's secret store | Partly — `SESSION_SECRET` can be regenerated (it invalidates sessions); `DATABASE_URL` can be reset at the provider. |
| Poster and backdrop images | Third-party CDNs | Yes, but only if the source still exists. |

**Everything that matters is in Postgres.** Backing up the database correctly is therefore the whole
job.

---

## 2. Policy

| Aspect | Decision |
| --- | --- |
| Method | Supabase automated backups (daily) **plus** an independent `pg_dump` to our own storage |
| Frequency | Daily automated; independent dump weekly and before every migration |
| Retention | 30 days daily; 12 months for the first-of-month dump |
| Encryption | At rest, by the storage provider; in transit, TLS |
| Access | Project owner and one named deputy. No shared credentials. |
| Storage location | A different provider from the database host |
| Restoration test | Quarterly, and before any launch |

### Why an independent dump as well

Supabase's automated backups live inside Supabase. They protect against a mistake. They do not
protect against losing the Supabase account — a billing failure, a compromised owner account, or the
project being deleted. A weekly `pg_dump` held elsewhere is the difference between an outage and a
loss.

### Retention and the rights record

The `download_links` table contains the evidence behind every published link. If that is lost, we
cannot demonstrate why a film was published, which turns a rights question into an indefensible one.
Treat this data as long-lived: the 12-month retention floor applies to the first-of-month dump.

---

## 3. Taking a backup

### Automated

Supabase takes daily backups on paid plans. Confirm in **Project Settings → Database → Backups** that
they are enabled and that the retention window is what you expect. Verify — do not assume.

### Independent dump

```bash
# Use the DIRECT connection string, not the pooler: pg_dump needs a session.
export DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p backups

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backups/mm-yoteshin-${STAMP}.dump" \
  "$DIRECT_URL"

# Record what you took, so a restore is not guesswork.
pg_dump --schema-only --no-owner "$DIRECT_URL" > "backups/mm-yoteshin-${STAMP}.schema.sql"
sha256sum "backups/mm-yoteshin-${STAMP}.dump" > "backups/mm-yoteshin-${STAMP}.dump.sha256"
```

Then move `backups/` off the machine to the independent storage location, and confirm the upload
succeeded. A dump sitting on the same laptop as the credentials is not a backup.

`--no-owner` and `--no-privileges` make the dump portable: it can be restored into a database whose
role names differ from the source, which is exactly what happens when you restore into a fresh
Supabase project.

### What this actually took, on 2026-10-13

Two things the recipe above gets wrong for *this* project, both learned by trying it:

1. **The direct host does not resolve.** `db.dvzbqemapnxeklkjeaps.supabase.co` returns NXDOMAIN, and
   `DIRECT_URL` is empty in `.env.local`. What worked instead was the **session pooler** (port 5432) —
   that is the single-session mode, so `pg_dump` holds one connection for the whole dump. The
   transaction pooler on port 6543 would *not* work, because it reassigns connections between queries.
   Use `DATABASE_URL` from `.env.local` as-is, and export `PGCONNECT_TIMEOUT=20` so a dead connection
   fails fast rather than hanging.

2. **The client version must be at least the server version.** The machine has `pg_dump` 14.18 from
   Homebrew while production runs PostgreSQL **17.11**, and v14 refuses outright:
   `pg_dump version 14.18 does not match server version 17.11`. Install a v17 `pg_dump` before
   attempting a dump — a version mismatch is refused loudly, so it cannot silently corrupt a dump,
   but it will stop the job.

The resulting command, and its output:

```bash
export PGCONNECT_TIMEOUT=20
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
pg_dump --format=custom --no-owner --no-privileges \
  --file="backups/mm-yoteshin-${STAMP}.dump" "$DATABASE_URL"
pg_dump --schema-only --no-owner "$DATABASE_URL" > "backups/mm-yoteshin-${STAMP}.schema.sql"
pg_restore --list "backups/mm-yoteshin-${STAMP}.dump" > "backups/mm-yoteshin-${STAMP}.toc.txt"
sha256sum "backups/mm-yoteshin-${STAMP}.dump" > "backups/mm-yoteshin-${STAMP}.dump.sha256"
```

That produced a 348 KB dump, a 246 KB schema dump, a 526-line TOC containing 116 `TABLE` entries, and
the checksum. `backups/.last_stamp` records the stamp so the next run has a stable name. **`backups/`
is in `.gitignore`** — these files contain private authorization evidence and password hashes and
must never be committed.

### Before every migration

```bash
pg_dump --format=custom --no-owner --no-privileges \
  --file="backups/pre-migration-$(date -u +%Y-%m-%dT%H-%M-%SZ).dump" "$DIRECT_URL"
```

Keep these longer than the routine dumps. If a migration goes wrong, the pre-migration dump is the
one you will want.

---

## 4. Restore — the short version

```bash
export TARGET_URL="postgresql://postgres:<password>@db.<new-project-ref>.supabase.co:5432/postgres"

# 1. Verify the dump before trusting it.
sha256sum -c backups/mm-yoteshin-<STAMP>.dump.sha256

# 2. Restore into an EMPTY database. pg_restore will not overwrite existing objects cleanly.
pg_restore --dbname="$TARGET_URL" --no-owner --no-privileges --clean --if-exists \
  backups/mm-yoteshin-<STAMP>.dump

# 3. Confirm the data is actually there.
psql "$TARGET_URL" -c "select count(*) from movies;"
psql "$TARGET_URL" -c "select count(*) from download_links;"
psql "$TARGET_URL" -c "select count(*) from admin_users;"

# 4. Re-apply migrations, in case the dump predates the current schema.
DATABASE_URL="$TARGET_URL" pnpm db:migrate
DATABASE_URL="$TARGET_URL" pnpm db:check
```

Then point the application at the restored database and smoke-test:

```bash
curl -fsS https://<origin>/api/health
```

---

## 5. Rehearsal procedure — do this, do not read it

The point of this section is to find out that something is wrong *before* it matters. Run it against a
throwaway database.

### 5.1 Restore rehearsal

1. Take a fresh dump from staging, using the commands in §3.
2. Create a **new, empty** Supabase project. Never rehearse into a database anyone is using.
3. Run the §4 restore against it.
4. Verify row counts against the source:

   ```sql
   select 'movies' as t, count(*) from movies
   union all select 'reviews', count(*) from reviews
   union all select 'download_links', count(*) from download_links
   union all select 'content_reports', count(*) from content_reports
   union all select 'admin_users', count(*) from admin_users
   union all select 'audit_logs', count(*) from audit_logs;
   ```

   The numbers must match the source. Not "look plausible" — match.
5. Spot-check the thing that would be worst to lose: open a `download_links` row and confirm
   `authorization_reference` is populated.
6. Point a local application at the restored database and load a film page. Confirm the authorized
   links render.
7. Sign in as an administrator. Password hashes must have survived the round trip.
8. Record the date, who ran it, and the outcome.

### 5.2 What the rehearsal is looking for

| Failure | Why it happens | Fix |
| --- | --- | --- |
| `pg_restore` errors on an extension | `gen_random_uuid()` needs `pgcrypto`, or PG13+ built-in `gen_random_uuid()`; Supabase projects also add platform extensions the app never uses | Create the extensions the app needs in the target before restoring |
| `extension "supabase_vault" is not available` | A Supabase *platform* extension, absent from a vanilla PostgreSQL install. **All application tables and rows still restore.** | Expected on a self-hosted target. Verify by row counts, not by the exit message alone. |
| Row counts lower than source | A partial dump, or one interrupted mid-run | Check `pg_restore --list` (`TABLE` entries) and the `pg_dump` exit code. A *successful* dump from the session pooler is **not** a cause — the 2026-10-13 rehearsal used the pooler and matched exactly. |
| `schema_migrations` present but migrations re-apply | Checksums recorded, files changed | Migrations are immutable; a mismatch means a file was edited |
| Application cannot connect | Wrong SSL mode, or `DATABASE_URL` re-injected over the target | `src/db/client.ts` requires TLS for non-local hosts. Watch out: `scripts/check-db.ts` re-sources `.env.local`, overriding a `DATABASE_URL` you exported — verify with `psql` rather than that script when rehearsing against a local cluster. |
| Sessions invalid after restore | `SESSION_SECRET` differs | Expected. Everyone signs in again. |

### 5.3 Rollback rehearsal

Separately, rehearse a rollback, not just a restore:

1. Deploy a trivial change to staging.
2. Roll back to the previous deployment.
3. Confirm the site works and the database is still consistent.

This verifies the additive-migration claim in `docs/deployment.md` §3 rather than trusting it.

---

## 6. Recovery objectives

| Objective | Target | How it is met |
| --- | --- | --- |
| **RPO** (acceptable data loss) | ≤ 24 hours | Daily automated backups, weekly independent dumps |
| **RTO** (time to restore service) | ≤ 4 hours | Documented procedure; rehearsed; independent dump already off-site |

If the business needs a tighter RPO, add point-in-time recovery at the database provider. That is a
plan decision, not a code change.

---

## 7. Before launch

- [ ] Automated backups confirmed enabled, with the expected retention — **not verified from here.**
  Open Supabase → Project Settings → Database → Backups and check. A CLI cannot see this.
- [x] Independent dump taken and integrity-checked (348 KB, 116 tables in the TOC)
- [ ] Independent dump **uploaded off-site** — not done. The dump currently sits in `backups/` on the
  operator's machine, which is not a backup. This is the single most important open item in this
  document.
- [x] Restore rehearsed into a throwaway database, row counts matched
- [ ] Rollback **rehearsed** — the additive-migration property it depends on is verified (no
  destructive DDL exists), but no deploy→rollback pass has run: there is no deploy host yet.
- [ ] Access limited to the owner and one named deputy — not verified
- [x] Rehearsal date and outcome recorded below

| Rehearsal date | Run by | Outcome | Notes |
| --- | --- | --- | --- |
| 2026-10-13 | Automated session | **Restore rehearsal PASSED** | Dump `backups/mm-yoteshin-2026-10-13T13-22-05Z.dump` restored into a throwaway PostgreSQL **17.11** cluster. Row counts matched the source exactly — movies 12, reviews 8, `download_links` 8, `content_reports` 0, `admin_users` 1, `audit_logs` 64. All 8 active links retained a populated `authorization_reference`; the single Argon2id admin hash survived. Migration re-apply on 17.11 was a no-op. One expected deviation: `extension "supabase_vault" is not available` — a Supabase platform extension, not application data. |
| 2026-10-13 | Automated session | **Rollback property PASSED (partial)** | Confirmed additively: `0001` is `CREATE TABLE`, `0002` is `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`, so no destructive DDL exists to roll back. A deploy→rollback rehearsal was **not** run — no deploy host exists. |

### Re-run this before every launch

The rehearsal above is from a **local** PostgreSQL 17 cluster, not from a second Supabase project.
Before launch, repeat it end to end: dump staging, restore into a fresh Supabase project, and run the
deploy→rollback pass in §5.3. The procedure is proven; only the staging infrastructure is missing.
