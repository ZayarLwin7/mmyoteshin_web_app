import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * IMPORTANT — how schema changes work in this project:
 *
 *   The source of truth for the database structure is the hand-written SQL in
 *   `migrations/`. Those files are applied by `pnpm db:migrate`, which records
 *   each one in `schema_migrations` with a checksum.
 *
 *   `drizzle-kit generate` is therefore NOT part of the workflow: it would try
 *   to derive migrations from `src/db/schema.ts` and would duplicate or
 *   contradict the SQL we already maintain. `src/db/schema.ts` mirrors the SQL
 *   so the application gets type-safe queries — when you change one, change the
 *   other in the same commit.
 *
 *   `pnpm db:studio` is still useful: it gives a browser UI over the live
 *   database for inspecting rows during development.
 */

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "",
  },
  strict: true,
  verbose: true,
});
