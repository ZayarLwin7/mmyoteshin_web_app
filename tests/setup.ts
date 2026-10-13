import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Global test setup.
 *
 * The application modules read environment variables at import time (see
 * `src/lib/env.ts`). Tests that touch those modules need a valid-looking
 * environment, so a deterministic set is provided here rather than relying on
 * the developer's `.env.local`.
 *
 * These values are deliberately fake. No test in this suite connects to a real
 * database unless DATABASE_URL is explicitly provided.
 */

/**
 * `@types/node` declares `NODE_ENV` read-only, so it cannot be assigned — and
 * bracket access does not help, because TypeScript still resolves the literal
 * key to the declared property. `vi.stubEnv` is Vitest's supported way to write
 * it. Vitest already defaults it to "test"; this only pins it in case the shell
 * overrode it.
 */
vi.stubEnv("NODE_ENV", process.env.NODE_ENV ?? "test");

process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "test-only-session-secret-that-is-long-enough-1234567890";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://test:test@127.0.0.1:5432/test_placeholder";

process.env.NEXT_PUBLIC_SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "MM YoteShin";
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.test";
process.env.NEXT_PUBLIC_IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "https://images.test";
