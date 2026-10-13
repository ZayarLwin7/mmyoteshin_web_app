/**
 * Database health check.
 *
 *   pnpm db:check
 *
 * Verifies connectivity, reports which migrations have been applied, and prints
 * row counts for the operational tables. Useful as a smoke test after a
 * deployment and as a first step when diagnosing an incident.
 *
 * Exit code is non-zero when the connection fails or a migration is missing.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

const TABLES = [
  "movies",
  "genres",
  "movie_genres",
  "reviews",
  "download_links",
  "content_reports",
  "admin_users",
  "admin_profiles",
  "audit_logs",
  "site_settings",
] as const;

async function main() {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("\n  Missing DATABASE_URL. See .env.example.\n");
    process.exit(1);
  }

  const sql = postgres(url, {
    max: 1,
    prepare: false,
    ssl: "require",
    onnotice: () => {},
    connect_timeout: 15,
  });

  try {
    const version = await sql<{ version: string }[]>`select version() as version`;
    console.log(`\n  Connected. ${version[0]?.version.split(",")[0] ?? "unknown server"}\n`);

    /* ---- Migrations ---------------------------------------------------- */

    const available = (await readdir(join(process.cwd(), "migrations")))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    let applied: string[] = [];
    try {
      const rows = await sql<{ filename: string }[]>`
        select filename from schema_migrations order by filename
      `;
      applied = rows.map((row) => row.filename);
    } catch {
      console.log("  schema_migrations table does not exist — run `pnpm db:migrate`.\n");
      process.exitCode = 1;
    }

    console.log("  Migrations");
    for (const filename of available) {
      const state = applied.includes(filename) ? "applied" : "PENDING";
      console.log(`    ${state.padEnd(8)} ${filename}`);
    }

    const pending = available.filter((name) => !applied.includes(name));
    if (pending.length > 0) {
      console.log(`\n  ${pending.length} migration(s) pending. Run \`pnpm db:migrate\`.`);
      process.exitCode = 1;
    }

    /* ---- Row counts ----------------------------------------------------- */

    console.log("\n  Row counts");
    for (const table of TABLES) {
      try {
        const rows = await sql<{ count: string }[]>`
          select count(*)::text as count from ${sql(table)}
        `;
        console.log(`    ${table.padEnd(18)} ${rows[0]?.count ?? "0"}`);
      } catch {
        console.log(`    ${table.padEnd(18)} (table missing)`);
      }
    }

    /* ---- Content integrity --------------------------------------------- */

    const publishedWithoutReview = await sql<{ count: string }[]>`
      select count(*)::text as count
      from movies m
      where m.status = 'published'
        and not exists (
          select 1 from reviews r
          where r.movie_id = m.id and r.status = 'published'
        )
    `;
    console.log(
      `\n  Published films without a published review: ${publishedWithoutReview[0]?.count ?? "0"}`,
    );

    const unauthorisedActiveLinks = await sql<{ count: string }[]>`
      select count(*)::text as count
      from download_links
      where status = 'active'
        and (authorization_basis is null or authorized_at is null)
    `;
    console.log(
      `  Active links missing authorization:        ${unauthorisedActiveLinks[0]?.count ?? "0"}`,
    );

    const openReports = await sql<{ count: string }[]>`
      select count(*)::text as count
      from content_reports
      where status in ('new', 'under_review')
    `;
    console.log(`  Open content reports:                      ${openReports[0]?.count ?? "0"}`);

    console.log("");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("\nDatabase check failed.");
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/:\/\/[^@]*@/g, "://***:***@"));
  process.exit(1);
});
