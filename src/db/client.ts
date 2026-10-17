import { drizzle } from "drizzle-orm/postgres-js";
import type { SQLWrapper } from "drizzle-orm";
import postgres from "postgres";

import { serverEnv } from "@/lib/env";

import * as schema from "./schema";

/**
 * Postgres connection used by every server-side data access path.
 *
 * The pool is cached on `globalThis` so Next.js dev-mode hot reloads do not
 * leak connections.
 */
declare global {
  var __mmYoteshinSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Prepared statements, where the pooler can actually support them.
 *
 * Supabase's **transaction**-mode pooler (port 6543) multiplexes many client
 * connections onto a single server connection, so a statement prepared by one
 * client may later be executed against a different backend. It cannot use
 * prepared statements, and `prepare` must stay off there.
 *
 * The **session**-mode pooler (port 5432) pins one server connection per
 * client for the lifetime of that connection, so prepared statements are safe
 * and are cached per connection.
 *
 * The difference is not academic — it is the single largest performance
 * factor in this application. Without a cached statement the driver has to
 * describe the result set before executing, which costs a *second network
 * round trip on every parameterised query*. Measured against this project's
 * database (Sydney, ~275 ms per round trip):
 *
 *   prepare: false — parameterised query    ~550 ms (every call)
 *   prepare: true  — parameterised query    ~275 ms (once prepared)
 *
 * Every query this application issues is parameterised, so this halves the
 * database time of every page.
 *
 * ---------------------------------------------------------------------------
 * Do not deploy on the transaction pooler
 * ---------------------------------------------------------------------------
 * This function exists so that a transaction-pooler URL degrades safely rather
 * than failing to prepare. It does **not** make that pooler usable.
 *
 * `postgres.js` pipelines: it writes queries to the socket without waiting for
 * each reply, so when more queries are in flight than there are pooled
 * connections the surplus is pipelined onto a connection that is already busy.
 * Supavisor's transaction mode cannot route that second in-flight query and
 * its reply never arrives. The client does not error — it **hangs, permanently**,
 * and every later query on that instance hangs with it.
 *
 * Measured against this project's database, replaying the admin dashboard's
 * nine concurrent queries: the session pooler answered in 260–680 ms at every
 * concurrency level tested up to 20; the transaction pooler hung at `max + 1`
 * (six queries with `max: 5`) and never recovered. `max_pipeline: 1`,
 * `fetch_types: false` and lowering `max` all failed to avoid it — the cliff
 * simply moved to the new `max + 1`.
 *
 * Keep `DATABASE_URL` on port **5432**. See `docs/deployment.md` §2.1. The only
 * supported route to the transaction pooler is swapping Drizzle's driver for
 * `node-postgres`, which queues rather than pipelines.
 */
function supportsPreparedStatements(url: string): boolean {
  // The transaction pooler is always port 6543; the session pooler and a
  // direct connection are 5432.
  return !/:6543(?:\/|$|\?)/.test(url);
}

/**
 * Managed Postgres (Supabase, Neon, RDS, …) always speaks TLS, and requiring it
 * is the safe default. A database running on the local machine or in a CI
 * service container usually has TLS switched off, so demanding it there would
 * make the test and CI setups impossible to run.
 *
 * The check is deliberately narrow: only loopback and the Docker-internal
 * hostname are treated as local. Anything else — including a private address on
 * a remote host — keeps `require`.
 */
function isLocalDatabase(url: string): boolean {
  return /@(?:localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)(?::|\/)/.test(url);
}

function createSqlClient() {
  const env = serverEnv();

  return postgres(env.databaseUrl, {
    /*
     * Serverless instances are short-lived, so production keeps the pool small
     * to avoid exhausting the pooler's connection budget across many lambdas.
     *
     * The Supabase **session** pooler caps the whole project at 15 connections
     * (port 5432), and every warm Vercel function instance holds its own pool
     * for as long as it lives. At `max: 5` only **three** instances fit inside
     * that budget — a fourth gets `EMAXCONNSESSION` and its render fails, which
     * on a client-side navigation surfaces as "Something went wrong" rather
     * than as a retryable error. Measured: sixteen rapid page loads (a normal
     * browse-and-prefetch burst) pinned all fifteen connections and locked the
     * database out entirely.
     *
     * `max: 2` lets **seven** instances coexist. The cost is bounded: pages
     * issue their queries in one `Promise.all`, so a batch of three now runs as
     * two waves instead of one, adding a single ~275 ms round trip — and only
     * on a cache miss, since the catalogue pages are ISR-cached. Availability
     * beats a cold-render round trip.
     *
     * Development is the opposite case: one long-lived process, and a single
     * page render issues several queries concurrently. With `max: 2` the third
     * of those waits for a free connection, which adds a full round trip to a
     * database that may be on the other side of the world. A larger local pool
     * lets them run truly in parallel — measured, four concurrent queries cost
     * the same as one once the connections exist.
     */
    max: env.isProduction ? 2 : 10,
    /*
     * Kept alive well past the 20 s this used to be.
     *
     * Opening a connection to Supabase costs a **~2.2 s TLS handshake**, which
     * dwarfs everything else in a page render (a warm round trip is ~275 ms).
     * At a 20 s idle timeout any pause longer than that — reading a page before
     * clicking a filter, switching tabs, a short break — threw the connection
     * away, so the next request paid the handshake again. Measured on this
     * project: 0.35 s warm, **2.66 s** for the first request after a 25 s
     * pause.
     *
     * Five minutes covers the pauses in a normal browsing session while still
     * releasing connections from a genuinely abandoned session, so the pooler's
     * connection budget is not held open indefinitely.
     */
    idle_timeout: 300,
    connect_timeout: 15,
    prepare: supportsPreparedStatements(env.databaseUrl),
    ssl: isLocalDatabase(env.databaseUrl) ? false : "require",
    // Supabase emits a lot of NOTICE traffic (e.g. "relation already exists").
    // Dropping it keeps logs readable and avoids leaking schema detail.
    onnotice: () => {},
  });
}

export const sql = globalThis.__mmYoteshinSql ?? createSqlClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__mmYoteshinSql = sql;
}

export const db = drizzle(sql, { schema });

const preparedStatementsSupported = supportsPreparedStatements(serverEnv().databaseUrl);

/**
 * The label handed to `query.prepare()`.
 *
 * Drizzle uses that argument **only as a flag** — `postgres-js/session.js`
 * turns it into `prepare = name !== void 0` and never forwards the name, so
 * postgres.js generates the real statement name itself
 * (`statementId + statementCount++`). A constant label is therefore safe and
 * cannot collide across pooled connections.
 */
const PREPARED_STATEMENT_LABEL = "mm-yoteshin:prepared";

/** A Drizzle query builder, which can build a prepared form of itself. */
type PreparableQuery = {
  prepare(name: string): { execute(): Promise<unknown[]> };
};

function isPreparable(query: unknown): query is PreparableQuery {
  return typeof (query as { prepare?: unknown }).prepare === "function";
}

/**
 * Run a Drizzle query with a **server-side prepared statement**.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * Drizzle's postgres-js driver only prepares a statement when the query was
 * explicitly created with `.prepare(name)`. For every other query it calls
 * `client.unsafe(sql, params, { prepare: false })` — the flag is hardcoded to
 * `false` unless a name was given (see `postgres-js/session.js`), so passing
 * `prepare: true` to `postgres()` alone changes nothing, because the per-query
 * option wins.
 *
 * Prepared execution needs **both** switches on, which is easy to get wrong:
 *
 *   client `prepare: false` + per-query `{ prepare: true }`  → still 2 round trips
 *   client `prepare: true`  + per-query `{ prepare: true }`  → 1 round trip
 *
 * Without a prepared statement the driver must *describe* the result set
 * before it can execute, which costs a **second network round trip on every
 * parameterised query**. Against a database in another region that is the
 * single largest cost in this application. Measured against this project's
 * Supabase instance, at roughly 275 ms per round trip:
 *
 *   ordinary execution       ~550 ms  (2 round trips)
 *   prepared execution       ~275 ms  (1 round trip)
 *
 * A page's cost is the number of *sequential* waits, and a wait is only as
 * short as the slowest query in it — so every query in a batch has to take
 * this path for the batch to benefit.
 *
 * ---------------------------------------------------------------------------
 * How — and the trap this helper exists to close
 * ---------------------------------------------------------------------------
 * This delegates to Drizzle's **own** prepared-query object rather than
 * executing the SQL through the driver directly:
 *
 *   builder query  →  query.prepare(label).execute()   (Drizzle maps the rows)
 *   raw SQL        →  sql.unsafe(text, params, { prepare })
 *
 * Delegating is not a convenience, it is a **correctness requirement**. Two
 * things must happen after the rows arrive, and only Drizzle can do them:
 *
 *   1. **Positional renaming.** Drizzle does not alias columns in the SQL it
 *      generates. It selects them positionally and renames them afterwards in
 *      `mapResultRow`, using field metadata it holds in memory. Executing the
 *      SQL through the driver returns rows keyed by the *Postgres* column
 *      names instead — `{ release_year: 2021 }`, not `{ year: 2021 }` — so
 *      every camelCase key silently becomes `undefined`. That still renders a
 *      page rather than throwing: dropdowns empty out, ratings vanish, and
 *      React reports missing `key` props.
 *
 *   2. **Value decoding.** `drizzle-orm/postgres-js` deliberately replaces
 *      postgres.js's date parsers with an identity function — see
 *      `client.options.parsers["1184"] = (val) => val` in its `driver.js`. The
 *      driver therefore returns **raw strings** for every date/time type, and
 *      each column's `mapFromDriverValue` does the conversion. Skipping that
 *      step leaks `"2026-10-11 17:03:53.502+00"` into the application where a
 *      `Date` is expected — and because a non-empty string is truthy, the
 *      failure surfaces as `publishedAt.toISOString is not a function` rather
 *      than as a null-safety error.
 *
 * Both were real, shipped bugs in this project. Routing through
 * `query.prepare(...).execute()` closes both by construction, because it runs
 * Drizzle's `mapResultRow` over Drizzle's own field list.
 *
 * ---------------------------------------------------------------------------
 * Constraints
 * ---------------------------------------------------------------------------
 * 1. **Never call this inside `db.transaction()`.** It executes on the shared
 *    pool client rather than the transaction's connection, so the statement
 *    would run outside the transaction and would not see its uncommitted
 *    writes. It is intended for standalone reads, which is all the public
 *    query layer does.
 * 2. **Do not wrap a select map in `sql\`${column}\`.as(key)`.** Result mapping
 *    is positional, so aliases are unnecessary — and they are actively
 *    harmful: a `SQL.Aliased` carries `noopDecoder` instead of the column's
 *    decoder, which silently reintroduces bug 2 above. An earlier version of
 *    this helper did exactly that and shipped the bug twice.
 * 3. It falls back to ordinary execution when the connection string points at
 *    a pooler that cannot route prepared statements (Supabase's transaction
 *    pooler). Correctness is preserved; only speed is lost.
 *
 * The first execution of each distinct statement on each pooled connection
 * still costs two round trips, because that is where the statement is
 * prepared. After that it is one.
 */
export async function executePrepared<TRow>(
  query: SQLWrapper & PromiseLike<TRow[]>,
): Promise<TRow[]>;
export async function executePrepared<TRow = Record<string, unknown>>(
  query: SQLWrapper,
): Promise<TRow[]>;
export async function executePrepared(query: SQLWrapper): Promise<unknown[]> {
  if (isPreparable(query)) {
    // Drizzle's own execution path, prepared. Its field metadata and column
    // decoders apply, so the rows come back correctly named and correctly
    // typed. See the doc comment above for why this must not be hand-rolled.
    return preparedStatementsSupported
      ? await query.prepare(PREPARED_STATEMENT_LABEL).execute()
      : await (query as unknown as PromiseLike<unknown[]>);
  }

  // A raw SQL fragment carries no field metadata, so there is nothing to map
  // against and the caller is responsible for the shape of these rows.
  const { sql: text, params } = dialect().sqlToQuery(query.getSQL());
  // Drizzle renders parameters as `unknown[]` while the driver's signature is
  // generic over the parameter tuple. The values are the same either way, so
  // the cast is confined to this one call.
  return (await sql.unsafe(text, params as never[], {
    prepare: preparedStatementsSupported,
  })) as unknown[];
}

/**
 * `dialect` is present on the runtime database object but is not declared on
 * Drizzle's public `PostgresJsDatabase` type, so it is reached through a
 * narrow assertion rather than a cast to `any`. It is only used to render a
 * raw SQL fragment to text and parameters.
 */
function dialect() {
  return (
    db as unknown as {
      dialect: { sqlToQuery(query: SQLWrapper): { sql: string; params: unknown[] } };
    }
  ).dialect;
}

export { schema };
export type Database = typeof db;
