import { expect, test } from "@playwright/test";

/**
 * Operational smoke checks.
 *
 * These need no credentials and no catalogue data — they assert the things that
 * should be true of any running deployment, and they are the fastest way to
 * tell "the app is broken" apart from "the fixtures are missing".
 */

test.describe("operational smoke checks", () => {
  test("the health endpoint reports a healthy database", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });

    // A health endpoint must never be cached by an intermediary.
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("the health endpoint leaks no reconnaissance detail", async ({ request }) => {
    const body = await (await request.get("/api/health")).text();

    for (const forbidden of ["version", "postgres", "supabase", "table", "migration"]) {
      expect(body.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("documents carry the production security headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");

    // Framework fingerprinting is switched off.
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the content security policy is present and restrictive", async ({ request }) => {
    const csp = (await request.get("/")).headers()["content-security-policy"];

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    // No plugin content, ever.
    expect(csp).not.toContain("unsafe-plugins");
  });

  test("admin surfaces are marked noindex and are never cached", async ({ request }) => {
    const response = await request.get("/admin/login");

    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("robots.txt excludes admin, api and search", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /search");
    expect(body).toContain("Sitemap:");
  });

  test("the sitemap is valid and contains no private routes", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("<loc>");
    expect(body).not.toContain("/admin");
    expect(body).not.toContain("/search");
    expect(body).not.toContain("/api/");
  });

  test("an unknown film slug returns a 404, not an empty page", async ({ page }) => {
    const response = await page.goto("/movies/this-slug-does-not-exist-9f3a1c");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("search results are not indexable", async ({ page }) => {
    await page.goto("/search?q=anything");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("anonymous visitors cannot reach the admin dashboard", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: "Administrator sign-in" })).toBeVisible();
  });

  test("the accessibility escape hatch is the first thing in the tab order", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: /skip to/i })).toBeFocused();
  });
});
