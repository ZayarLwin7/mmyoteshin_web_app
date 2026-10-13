import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * Health check.
 *
 * Returns a minimal body: `{"status":"ok"}` or `{"status":"degraded"}`. It
 * deliberately does not report versions, table counts, migration state or error
 * messages — a public endpoint should not be a reconnaissance tool.
 *
 * Details go to the server log, where an operator (and only an operator) can
 * see them. Point an uptime monitor at this route.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.execute(sql`select 1`);

    return Response.json(
      { status: "ok", latencyMs: Date.now() - startedAt },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error("[health] database check failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return Response.json(
      { status: "degraded" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
