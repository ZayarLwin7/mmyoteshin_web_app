/**
 * Migration runner.
 *
 *   pnpm db:migrate
 *
 * Applies every `migrations/*.sql` file in filename order, once, inside a
 * transaction. Applied files are recorded in `schema_migrations` with a
 * SHA-256 checksum so an edited migration is detected rather than silently
 * skipped.
 *
 * This is intentionally a small, dependency-light script: migrations must be
 * runnable from a clean checkout with nothing but Node and DATABASE_URL.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

function connectionString(): string {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "\n  Missing DATABASE_URL.\n" +
        "  Copy .env.example to .env.local and fill in the Supabase connection string.\n",
    );
    process.exit(1);
  }
  return url;
}

function checksum(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

async function main() {
  const sql = postgres(connectionString(), {
    max: 1,
    prepare: false,
    ssl: "require",
    onnotice: () => {},
  });

  try {
    await sql`
      create table if not exists schema_migrations (
        filename    text primary key,
        checksum    text        not null,
        applied_at  timestamptz not null default now()
      )
    `;

    const entries = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith(".sql")).sort();

    if (entries.length === 0) {
      console.log("No migration files found.");
      return;
    }

    const applied = await sql<{ filename: string; checksum: string }[]>`
      select filename, checksum from schema_migrations
    `;
    const appliedMap = new Map(applied.map((row) => [row.filename, row.checksum]));

    let appliedCount = 0;

    for (const filename of entries) {
      const contents = await readFile(join(MIGRATIONS_DIR, filename), "utf8");
      const hash = checksum(contents);
      const previous = appliedMap.get(filename);

      if (previous !== undefined) {
        if (previous !== hash) {
          console.error(
            `\n  ${filename} has changed since it was applied.\n` +
              "  Migrations are immutable once applied. Add a new migration instead.\n",
          );
          process.exit(1);
        }
        console.log(`  skipped  ${filename} (already applied)`);
        continue;
      }

      console.log(`  applying ${filename} …`);

      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`
          insert into schema_migrations (filename, checksum)
          values (${filename}, ${hash})
        `;
      });

      appliedCount += 1;
      console.log(`  applied  ${filename}`);
    }

    console.log(
      appliedCount === 0 ? "\nDatabase is up to date." : `\nApplied ${appliedCount} migration(s).`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("\nMigration failed.");
  // The message may contain connection detail; strip any password before logging.
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/:\/\/[^@]*@/g, "://***:***@"));
  process.exit(1);
});
