/**
 * Environment access.
 *
 * Two hard rules:
 *  1. Secrets are read through `serverEnv()` only. Nothing in this module is
 *     imported by a client component.
 *  2. `NEXT_PUBLIC_*` values are referenced with literal `process.env.X` syntax
 *     so the Next.js compiler can inline them into the browser bundle. A
 *     dynamic lookup would silently yield `undefined` in the client.
 */

class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new EnvError(
      `Missing required environment variable "${name}". ` +
        `Copy .env.example to .env.local and fill it in — see README.md.`,
    );
  }
  return value;
}

function integer(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new EnvError(
      `Environment variable "${name}" must be a positive integer, got "${value}".`,
    );
  }
  return parsed;
}

function boolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalised = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalised)) return true;
  if (["0", "false", "no", "off"].includes(normalised)) return false;
  throw new EnvError(`Environment variable "${name}" must be a boolean, got "${value}".`);
}

/* -------------------------------------------------------------------------- */
/* Server-only                                                                */
/* -------------------------------------------------------------------------- */

export type ServerEnv = {
  databaseUrl: string;
  directUrl: string;
  sessionSecret: string;
  sessionTtlHours: number;
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  rateLimits: {
    auth: { max: number; windowSeconds: number };
    report: { max: number; windowSeconds: number };
    search: { max: number; windowSeconds: number };
  };
  allowDevSeed: boolean;
};

let cachedServerEnv: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const databaseUrl = required("DATABASE_URL", process.env.DATABASE_URL);
  const sessionSecret = required("SESSION_SECRET", process.env.SESSION_SECRET);

  if (sessionSecret.length < 32) {
    throw new EnvError(
      "SESSION_SECRET must be at least 32 characters. Generate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }

  const nodeEnv = (process.env.NODE_ENV ?? "development") as ServerEnv["nodeEnv"];

  cachedServerEnv = {
    databaseUrl,
    directUrl: process.env.DIRECT_URL?.trim() || databaseUrl,
    sessionSecret,
    sessionTtlHours: integer("SESSION_TTL_HOURS", process.env.SESSION_TTL_HOURS, 12),
    nodeEnv,
    isProduction: nodeEnv === "production",
    rateLimits: {
      auth: {
        max: integer("RATE_LIMIT_AUTH_MAX", process.env.RATE_LIMIT_AUTH_MAX, 10),
        windowSeconds: integer(
          "RATE_LIMIT_AUTH_WINDOW_SECONDS",
          process.env.RATE_LIMIT_AUTH_WINDOW_SECONDS,
          300,
        ),
      },
      report: {
        max: integer("RATE_LIMIT_REPORT_MAX", process.env.RATE_LIMIT_REPORT_MAX, 5),
        windowSeconds: integer(
          "RATE_LIMIT_REPORT_WINDOW_SECONDS",
          process.env.RATE_LIMIT_REPORT_WINDOW_SECONDS,
          3600,
        ),
      },
      search: {
        max: integer("RATE_LIMIT_SEARCH_MAX", process.env.RATE_LIMIT_SEARCH_MAX, 60),
        windowSeconds: integer(
          "RATE_LIMIT_SEARCH_WINDOW_SECONDS",
          process.env.RATE_LIMIT_SEARCH_WINDOW_SECONDS,
          60,
        ),
      },
    },
    allowDevSeed: boolean("ALLOW_DEV_SEED", process.env.ALLOW_DEV_SEED, false),
  };

  return cachedServerEnv;
}

/* -------------------------------------------------------------------------- */
/* Public                                                                     */
/* -------------------------------------------------------------------------- */

export const publicEnv = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "MM YoteShin",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, ""),
  siteDescription:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
    "A curated catalogue of films with editorial reviews and clearly labelled, authorized distribution links.",
  imageHosts: (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@example.com",
  takedownEmail: process.env.NEXT_PUBLIC_TAKEDOWN_EMAIL?.trim() || "takedown@example.com",
  adsEnabled: boolean("NEXT_PUBLIC_ADS_ENABLED", process.env.NEXT_PUBLIC_ADS_ENABLED, false),
  adClient: process.env.NEXT_PUBLIC_AD_CLIENT?.trim() || "",
  adSlots: {
    leaderboard: process.env.NEXT_PUBLIC_AD_SLOT_LEADERBOARD?.trim() || "",
    inline: process.env.NEXT_PUBLIC_AD_SLOT_INLINE?.trim() || "",
  },
  analyticsEnabled: boolean(
    "NEXT_PUBLIC_ANALYTICS_ENABLED",
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
    false,
  ),
  analyticsEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim() || "",
} as const;

/**
 * Ads only render when the operator has explicitly enabled them *and* a client
 * id is configured. This prevents a half-configured deploy from emitting
 * broken or untracked ad markup.
 */
export const adsAreServable = publicEnv.adsEnabled && publicEnv.adClient !== "";
