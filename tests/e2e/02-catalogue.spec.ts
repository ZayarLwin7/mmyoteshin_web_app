import { expect, test } from "@playwright/test";

import { CATALOGUE_HINT, escapeRegExp, movieCards } from "./helpers";

/**
 * Flow 2 — Filter and pagination.
 *
 * Every assertion here is about the URL, because the URL is the state. Filters
 * are a plain GET form, so a filtered view is shareable, canonical and works
 * without JavaScript. If the URL and the results ever disagree, that is the
 * bug this suite is designed to catch.
 */

test.describe("catalogue filtering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/movies");
    test.skip((await movieCards(page).count()) === 0, CATALOGUE_HINT);
  });

  test("sorting is reflected in the URL and survives a reload", async ({ page }) => {
    await page.locator("#filter-sort").selectOption("title");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/sort=title/);
    await expect(page.locator("#filter-sort")).toHaveValue("title");

    await page.reload();
    await expect(page.locator("#filter-sort")).toHaveValue("title");
  });

  test("filtering by genre narrows the results and offers a way back", async ({ page }) => {
    const genreSelect = page.locator("#filter-genre");
    const firstGenre = await genreSelect.locator("option").nth(1).getAttribute("value");
    test.skip(!firstGenre, "No genres exist yet — create one under /admin/genres.");

    await genreSelect.selectOption(firstGenre!);
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(new RegExp(`genre=${escapeRegExp(firstGenre!)}`));

    // The active filter is shown as a removable chip.
    await expect(page.getByRole("link", { name: "Clear all" })).toBeVisible();

    await page.getByRole("link", { name: "Clear all" }).click();
    await expect(page).not.toHaveURL(/genre=/);
  });

  test("a filter that matches nothing shows an empty state, not a broken grid", async ({
    page,
  }) => {
    await page.locator("#filter-q").fill("zzzz-no-such-film-zzzz");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page.getByRole("heading", { name: "No films match those filters" })).toBeVisible();
    await expect(page.getByText(/No films found/)).toBeVisible();
  });

  test("an out-of-range page number is clamped rather than 500-ing", async ({ page }) => {
    const response = await page.goto("/movies?page=99999");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("a nonsense page value does not break the schema", async ({ page }) => {
    const response = await page.goto("/movies?page=not-a-number&sort=explode");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("catalogue pagination", () => {
  test("pagination uses real links and marks the current page", async ({ page }) => {
    await page.goto("/movies");
    test.skip((await movieCards(page).count()) === 0, CATALOGUE_HINT);

    const pager = page.getByRole("navigation", { name: "Pagination" });
    test.skip(
      (await pager.count()) === 0,
      "Needs more than one page of results. Lower PAGE_SIZE or seed more films to exercise this.",
    );

    await pager.getByRole("link", { name: "Next" }).click();

    await expect(page).toHaveURL(/page=2/);
    await expect(
      page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Page 2" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("pagination preserves the active filter", async ({ page }) => {
    await page.goto("/movies?sort=title");

    const pager = page.getByRole("navigation", { name: "Pagination" });
    test.skip((await pager.count()) === 0, "Needs more than one page of results.");

    await pager.getByRole("link", { name: "Next" }).click();

    await expect(page).toHaveURL(/sort=title/);
    await expect(page).toHaveURL(/page=2/);
  });

  test("page one is canonicalised and carries no page parameter", async ({ page }) => {
    // This test lives outside the `catalogue filtering` describe, so it has no
    // `beforeEach` to navigate for it. Without an explicit `goto` it runs
    // against `about:blank`, where nothing exists, and `getAttribute` blocks for
    // the whole test timeout before the `.catch` can return null.
    await page.goto("/movies");
    test.skip((await movieCards(page).count()) === 0, CATALOGUE_HINT);

    const pager = page.getByRole("navigation", { name: "Pagination" });
    test.skip((await pager.count()) === 0, "Needs more than one page of results.");

    const href = await pager
      .getByRole("link", { name: "Page 1" })
      .getAttribute("href")
      .catch(() => null);

    // Either there is no page 1 link (we are on page 1 and it is not rendered),
    // or it points at the bare listing — never at `?page=1`. A `?page=1` URL is
    // a duplicate of the canonical listing and competes with it in search.
    expect(href === null || !href.includes("page=1")).toBe(true);
  });
});
