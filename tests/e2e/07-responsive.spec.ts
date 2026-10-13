import { expect, test } from "@playwright/test";

import { CATALOGUE_HINT } from "./helpers";

/**
 * Flow 7 — Mobile navigation and responsive states.
 *
 * Runs only in the `mobile-chromium` project (a phone viewport). The questions
 * here are about *layout*, not browser engines: does the disclosure work, does
 * the page avoid horizontal overflow, and are the tap targets big enough.
 *
 * "Test mobile layouts and fix overflow rather than merely shrinking desktop
 * UI" is an explicit requirement, so the overflow assertion is the important
 * one in this file.
 */

const OVERFLOW_TOLERANCE_PX = 1;

async function horizontalOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("mobile navigation", () => {
  test("the menu opens, closes on Escape, and closes on navigation", async ({ page }) => {
    await page.goto("/");

    // Desktop navigation is not offered at this width.
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();

    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();

    await toggle.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();

    // Escape closes the disclosure and returns focus where it came from.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();

    // Navigating closes it too.
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("navigation", { name: "Mobile" })
      .getByRole("link", { name: "Films" })
      .click();

    await expect(page).toHaveURL(/\/movies/);
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  });

  test("the toggle reports its expanded state to assistive technology", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("search is reachable from the mobile menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();

    const input = page.locator("#mobile-search");
    await expect(input).toBeVisible();

    await input.fill("a");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=a/);
  });
});

test.describe("responsive layout", () => {
  test("key pages do not overflow horizontally", async ({ page }) => {
    for (const path of ["/", "/movies", "/genres", "/years", "/about", "/contact", "/copyright"]) {
      await page.goto(path);

      const overflow = await horizontalOverflow(page);
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(
        OVERFLOW_TOLERANCE_PX,
      );
    }
  });

  test("the catalogue is a two-column grid rather than a squeezed desktop layout", async ({
    page,
  }) => {
    await page.goto("/movies");
    test.skip((await page.locator('a[href^="/movies/"]').count()) === 0, CATALOGUE_HINT);

    const cards = page.locator('a[href^="/movies/"]');
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();

    test.skip(!first || !second, "Needs at least two films to compare card positions.");

    // Two cards side by side: same row, different column.
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(8);
    expect(second!.x).toBeGreaterThan(first!.x);
  });

  test("tap targets meet the 24px WCAG 2.2 minimum", async ({ page }) => {
    await page.goto("/");

    const toggle = await page.getByRole("button", { name: "Open menu" }).boundingBox();
    expect(toggle).toBeTruthy();
    expect(toggle!.width).toBeGreaterThanOrEqual(24);
    expect(toggle!.height).toBeGreaterThanOrEqual(24);
  });

  test("a film page is usable at phone width", async ({ page }) => {
    await page.goto("/movies");
    test.skip((await page.locator('a[href^="/movies/"]').count()) === 0, CATALOGUE_HINT);

    await page.locator('a[href^="/movies/"]').first().click();

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authorized download options" })).toBeVisible();

    const overflow = await horizontalOverflow(page);
    expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
  });

  test("the mobile header does not cover the page content", async ({ page }) => {
    await page.goto("/movies");

    const header = await page.getByRole("banner").boundingBox();
    expect(header).toBeTruthy();

    // The header is sticky, so it must stay a sensible height rather than
    // swallowing the viewport on a small screen.
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    expect(header!.height).toBeLessThan(viewport!.height * 0.25);
  });
});
