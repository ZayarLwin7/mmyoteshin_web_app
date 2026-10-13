import { createHmac, timingSafeEqual } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { serverEnv } from "@/lib/env";

/**
 * Durable fixed-window rate limiting.
 *
 * Counters live in Postgres rather than process memory so limits hold across
 * serverless instances and survive cold starts. That matters most for the two
 * abuse-prone public endpoints: admin sign-in and report submission.
 */

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Derive a stable, non-reversible identifier for a client.
 *
 * We never store raw IP addresses. The value is an HMAC keyed by a value
 * derived from SESSION_SECRET, so the table cannot be reversed into a list of
 * visitor IPs even if it leaks.
 */
export function hashIdentifier(value: string): string {
  const key = createHmac("sha256", serverEnv().sessionSecret)
    .update("mm-yoteshin:rate-limit:v1")
    .digest();

  return createHmac("sha256", key).update(value).digest("hex").slice(0, 64);
}

/**
 * Best-effort client fingerprint from proxy headers.
 *
 * On Vercel and most managed platforms `x-forwarded-for` is appended by the
 * edge, so the *first* entry is the closest thing to the real client.
 */
export function clientFingerprint(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Record a hit against `key` and report whether the caller is still within its
 * allowance. The counter resets when the window has elapsed.
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  options: { max: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const key = `${scope}:${hashIdentifier(identifier)}`;

  const rows = await db.execute<{ hit_count: number; expires_at: Date }>(sql`
    insert into rate_limits (key, hit_count, window_started_at, expires_at)
    values (${key}, 1, now(), now() + make_interval(secs => ${options.windowSeconds}))
    on conflict (key) do update set
      hit_count = case
        when rate_limits.expires_at <= now() then 1
        else rate_limits.hit_count + 1
      end,
      window_started_at = case
        when rate_limits.expires_at <= now() then now()
        else rate_limits.window_started_at
      end,
      expires_at = case
        when rate_limits.expires_at <= now() then now() + make_interval(secs => ${options.windowSeconds})
        else rate_limits.expires_at
      end
    returning hit_count, expires_at
  `);

  const row = Array.isArray(rows) ? rows[0] : undefined;

  if (!row) {
    // Fail open rather than locking every user out because of a counting error.
    // The failure is surfaced by the caller's error logging.
    return { allowed: true, limit: options.max, remaining: options.max, retryAfterSeconds: 0 };
  }

  const hitCount = Number(row.hit_count);
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  const retryAfterSeconds = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));

  return {
    allowed: hitCount <= options.max,
    limit: options.max,
    remaining: Math.max(0, options.max - hitCount),
    retryAfterSeconds,
  };
}

/** Convenience wrappers for the three configured limits. */
export function rateLimitAuth(identifier: string) {
  const { max, windowSeconds } = serverEnv().rateLimits.auth;
  return consumeRateLimit("auth", identifier, { max, windowSeconds });
}

export function rateLimitReport(identifier: string) {
  const { max, windowSeconds } = serverEnv().rateLimits.report;
  return consumeRateLimit("report", identifier, { max, windowSeconds });
}

export function rateLimitSearch(identifier: string) {
  const { max, windowSeconds } = serverEnv().rateLimits.search;
  return consumeRateLimit("search", identifier, { max, windowSeconds });
}

/** Drop windows that have already elapsed. Safe to call opportunistically. */
export async function pruneExpiredRateLimits(): Promise<number> {
  const rows = await db.execute<{ count: number }>(sql`
    with deleted as (
      delete from rate_limits where expires_at < now() - interval '1 hour' returning 1
    )
    select count(*)::int as count from deleted
  `);

  const row = Array.isArray(rows) ? rows[0] : undefined;
  return row ? Number(row.count) : 0;
}

/**
 * Constant-time string comparison for secrets such as the CSRF token.
 * `timingSafeEqual` throws on length mismatch, so lengths are compared first.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
