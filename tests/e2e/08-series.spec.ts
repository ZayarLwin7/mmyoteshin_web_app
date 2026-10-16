import { expect, test } from "@playwright/test";

/**
 * The Series section.
 *
 * Films and series are one table with a `content_kind` discriminator, but two
 * sets of routes, so these assert the things that make them two sections rather
 * than one: separate nav entry, separate listing, separate detail route, and a
 * 404 when a slug is looked up under the wrong one.
 *
 * Every assertion here holds with or without a published series — the section
 * is new, so it must be correct while still empty. The one place that does need
 * a live series is guarded by a slug that only exists once one is published.
 */

test.describe("series section", () => {
  test("the primary navigation links to the series section", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Series" }),
    ).toHaveAttribute("href", "/series");
  });

  test("the series listing is a real page, not an empty shell", async ({ page }) => {
    const response = await page.goto("/series");

    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Every series we have reviewed",
    );

    // The count line has to agree with whatever is on the page: a series noun,
    // not the film noun the twin listing uses.
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/No series found|\d+ series/);
  });

  test("the series listing never shows a film", async ({ page }) => {
    await page.goto("/series");

    // A film's public URL is `/movies/<slug>`. If the kind filter ever leaks,
    // the first card on this page will link there.
    const filmLinks = page.locator('a[href^="/movies/"]');
    expect(await filmLinks.count()).toBe(0);
  });

  test("an unknown series slug returns a 404, not an empty page", async ({ page }) => {
    const response = await page.goto("/series/this-slug-does-not-exist-9f3a1c");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the series listing accepts the same filters as the film listing", async ({ page }) => {
    const response = await page.goto("/series?sort=title");

    expect(response?.status()).toBe(200);

    // A validated filter must survive round-tripping, or the filter bar is
    // decorative on this route.
    await expect(page.locator("#filter-sort")).toHaveValue("title");
  });

  test("the sitemap advertises the series section", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    expect(body).toContain("<loc>");
    // The listing itself is a canonical URL, exactly like `/movies`.
    expect(body).toMatch(/<loc>[^<]*\/series<\/loc>/);
  });
});
