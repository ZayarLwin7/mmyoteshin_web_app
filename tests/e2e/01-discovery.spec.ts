import { expect, test } from "@playwright/test";

import { CATALOGUE_HINT, movieCards, skipUnlessCatalogueHasFilms } from "./helpers";

/**
 * Flow 1 — Home → search → film details.
 *
 * The search term is derived from a film that is genuinely published, so the
 * test never depends on hard-coded fixture titles that a content edit could
 * rename out from under it.
 */
test.describe("home → search → film details", () => {
  test("a visitor can search the catalogue and open a film", async ({ page }) => {
    await skipUnlessCatalogueHasFilms(page);

    // ---- Pick a film that really is published ---------------------------
    const firstCard = movieCards(page).first();
    const title = (await firstCard.getByRole("heading", { level: 3 }).textContent())?.trim();
    expect(title, "a catalogue card must render its title").toBeTruthy();

    const term = title!.split(/\s+/).find((word) => word.length >= 4) ?? title!;

    // ---- Search from the header, which is a real GET form ---------------
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();

    await page.locator("#site-search").fill(term);
    await page.locator("#site-search").press("Enter");

    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(term);

    // ---- The film we picked must be in the results ----------------------
    const result = movieCards(page).filter({ hasText: title! }).first();
    await expect(result, `searching for "${term}" should find "${title}"`).toBeVisible();

    await result.click();

    // ---- Detail page ----------------------------------------------------
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);
    await expect(page.getByRole("heading", { name: "Authorized download options" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Report a problem" })).toBeVisible();

    // Breadcrumbs and structured data are part of the contract, not decoration.
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test("structured data is valid JSON and matches the page", async ({ page }) => {
    await skipUnlessCatalogueHasFilms(page);

    const href = await movieCards(page).first().getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!);

    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw!) as Record<string, unknown>;

    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Movie");
    expect(data.name).toBe((await page.getByRole("heading", { level: 1 }).textContent())?.trim());
  });

  test("an empty search shows guidance rather than an empty grid", async ({ page }) => {
    await page.goto("/search");

    await expect(page.getByRole("heading", { name: "Search the catalogue" })).toBeVisible();
  });

  test("a search with no matches explains what to try instead", async ({ page }) => {
    await page.goto("/search?q=zzzz-no-such-film-zzzz");

    await expect(page.getByText(/Nothing matched/)).toBeVisible();
    await expect(page.getByText(/Check the spelling/)).toBeVisible();
  });

  test("the header search box works without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      await page.goto("/");
      await page.locator("#site-search").fill("a");
      await page.locator("#site-search").press("Enter");

      await expect(page).toHaveURL(/\/search\?q=a/);
    } finally {
      await context.close();
    }
  });
});

test.describe("catalogue result count", () => {
  test("the catalogue reports how many films it holds", async ({ page }) => {
    await page.goto("/movies");
    test.skip((await movieCards(page).count()) === 0, CATALOGUE_HINT);

    await expect(page.locator('p[role="status"]').first()).toContainText(/\d+ films?/);
  });
});
