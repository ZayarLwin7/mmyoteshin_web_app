import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * Unit and integration tests run here. End-to-end tests live in `tests/e2e`
 * and are driven by Playwright (see playwright.config.ts) — they are explicitly
 * excluded below so `pnpm test` never tries to boot a browser.
 *
 * The `@/` alias mirrors tsconfig.json so test imports match application code.
 */

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // Integration tests talk to Postgres and need more headroom than units.
    // `hookTimeout` matters as much as `testTimeout` here: `beforeAll` inserts
    // several rows one statement at a time, and against a database in another
    // region each round trip can take the better part of a second. Left at the
    // 10s default the hook times out before the fixtures are even written.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    restoreMocks: true,
  },
});
