import { expect, test } from "@playwright/test";

import {
  CREDENTIALS_HINT,
  GENRE_HINT,
  createPublishedFilm,
  disclosure,
  hasAdminCredentials,
  signInAsAdmin,
} from "./helpers";

/**
 * Flow 4 — Create draft → preview → publish.
 *
 * This is the spec that proves the publication gate is real. The most
 * important assertion in the whole suite is the one right after the draft is
 * created: a film that has not been through the gate must return 404 to the
 * public, no matter that an administrator can see it.
 */

test.describe("film publication lifecycle", () => {
  test("a draft is private, blocked, and only becomes public once it is ready", async ({
    page,
  }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    await page.goto("/admin/movies/new");

    const genreCheckbox = page.locator('input[name="genreIds"]').first();
    test.skip((await genreCheckbox.count()) === 0, GENRE_HINT);

    const title = `E2E Lifecycle ${Date.now().toString(36)}`;

    // ---- Create the draft ------------------------------------------------
    await page.locator("#title").fill(title);
    await page.locator("#releaseYear").fill("2023");
    await page.locator("#runtimeMinutes").fill("118");
    await page.locator("#languageCode").fill("en");
    await page.locator("#country").fill("Testland");
    await page
      .locator("#synopsis")
      .fill(
        "A synopsis written for the lifecycle end-to-end test. It exists so the readiness check has " +
          "content to evaluate and makes no claim about any real film.",
      );
    await genreCheckbox.check();

    await page.getByRole("button", { name: "Create draft" }).click();

    await expect(page).toHaveURL(/\/admin\/movies\/[0-9a-fA-F-]{36}$/);
    const adminPath = new URL(page.url()).pathname;

    // ---- It must be blocked, and it must not be public --------------------
    await expect(page.getByText("Blocked — cannot be published yet")).toBeVisible();

    const publicPath = await page.locator('a[href^="/movies/"]').first().getAttribute("href");
    expect(publicPath).toBeTruthy();

    const draftResponse = await page.goto(publicPath!);
    expect(draftResponse?.status(), "an unpublished film must 404").toBe(404);

    // Publishing must be refused while a blocker remains, even if the operator
    // somehow triggers the action directly.
    await page.goto(adminPath);
    const publish = page.getByRole("button", { name: "Publish", exact: true });
    if ((await publish.count()) > 0) {
      await publish.click();
      await page.getByRole("button", { name: "Yes, publish now" }).click();

      // Still blocked: the service layer refuses, not just the UI.
      const stillBlocked = await page.goto(publicPath!);
      expect(
        stillBlocked?.status(),
        "the gate must hold even when publish is triggered directly",
      ).toBe(404);
    }

    // ---- Satisfy the gate: write and publish a review ---------------------
    await page.goto(adminPath);
    const reviewDisclosure = disclosure(page, "Write a new review");
    await reviewDisclosure.locator("summary").click();

    await reviewDisclosure
      .locator("#body")
      .fill(
        "This review exists so the end-to-end suite can exercise the publication gate from the " +
          "inside. It is intentionally longer than the two hundred character minimum enforced by " +
          "the service layer, because a shorter body is rejected before the film can be published " +
          "at all. The wording is filler and makes no claim about any real film.",
      );
    await reviewDisclosure.locator("#reviewerName").fill("End-to-end suite");
    await reviewDisclosure.locator("#rating").fill("8");
    await reviewDisclosure.locator("#status").selectOption("published");
    await reviewDisclosure.getByRole("button", { name: "Save review" }).click();
    await expect(reviewDisclosure.getByRole("status")).toBeVisible();

    // ---- The gate now passes ---------------------------------------------
    await page.reload();
    await expect(page.getByText("Ready to publish")).toBeVisible();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Yes, publish now" }).click();
    await expect(page.getByRole("link", { name: "View public page" })).toBeVisible();

    // ---- And it is genuinely live ----------------------------------------
    const liveResponse = await page.goto(publicPath!);
    expect(liveResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    // The review is public, and the score carries its scale.
    await expect(page.getByText("Editorial score")).toBeVisible();
    await expect(page.getByText("8 / 10")).toBeVisible();
    await expect(page.getByText("Rating methodology")).toBeVisible();
  });

  test("archiving a published film removes it from the public site", async ({ page }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);

    // Use a deterministic fixture rather than "whatever happens to be first in
    // the list", so this test either runs properly or fails loudly.
    const film = await createPublishedFilm(page);

    await page.goto(film.adminPath);
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.getByRole("button", { name: "Yes, archive" }).click();

    // Archiving removes it from the public catalogue entirely.
    const archivedResponse = await page.goto(film.publicPath);
    expect(archivedResponse?.status(), "an archived film must 404").toBe(404);

    // The decision is recorded in the audit trail.
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toContainText(/archive/i);

    // Leave the fixture in a tidy state so the run is repeatable.
    await page.goto(film.adminPath);
    await page.getByRole("button", { name: "Move back to draft" }).click();
    await page.getByRole("button", { name: "Yes, move to draft" }).click();
  });
});
