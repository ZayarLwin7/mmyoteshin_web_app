import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * Two projects run by default:
 *   - `chromium`        — every spec except the responsive one.
 *   - `mobile-chromium` — only the responsive spec, on a phone viewport.
 *
 * The responsive spec is split out because "does the mobile menu work" is a
 * question about a *viewport*, not about a browser engine. Running the whole
 * suite twice would double CI time for no extra signal.
 *
 * `mobile-safari` (WebKit) is deliberately not enabled by default: it needs
 * `pnpm exec playwright install webkit`, which is a large download most
 * contributors will not have. `docs/testing.md` explains how to turn it on.
 *
 * Set `E2E_BASE_URL` to point the suite at an already-running deployment
 * (staging, preview). When it is set, Playwright will not start a local server.
 */

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);
const externalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",

  // The admin specs create and mutate records, so they must not race each
  // other. Correctness beats wall-clock time here.
  fullyParallel: false,
  workers: 1,

  forbidOnly: isCI,
  retries: isCI ? 1 : 0,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "UTC",
    // Any uncaught page error is a bug; surface it in the trace.
    ignoreHTTPSErrors: false,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /07-responsive\.spec\.ts$/,
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /07-responsive\.spec\.ts$/,
    },
  ],

  webServer: externalServer
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
});
