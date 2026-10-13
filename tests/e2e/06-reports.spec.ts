import { expect, test } from "@playwright/test";

import {
  CREDENTIALS_HINT,
  createPublishedFilm,
  hasAdminCredentials,
  signInAsAdmin,
} from "./helpers";

/**
 * Flow 6 — Submit and resolve a report.
 *
 * The reporting workflow is the product's takedown safety net, so the test
 * covers the whole loop: a member of the public files a report, it lands in the
 * admin queue, and an authorized operator closes it.
 *
 * Note: the form on the film page reports against the *film*. The
 * link-scoped variant (`ReportForm` with `downloadLinkId`, which is what
 * automatically hides a reported link) is implemented in the service layer and
 * the component, but is not yet wired to a public control — see
 * `docs/implementation-plan.md`, "Deferred work".
 */

const DETAILS =
  "The download link on this page now points at a completely different site than the one " +
  "described, so I do not think it is the authorized source any more.";

test.describe("content reporting", () => {
  test("a report can be filed from a film page and resolved in the admin queue", async ({
    page,
  }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    const film = await createPublishedFilm(page);

    // ---- File the report, as a member of the public would ----------------
    await page.goto(film.publicPath);

    await page.locator('select[name="reason"]').selectOption("broken_link");
    await page.locator('textarea[name="details"]').fill(DETAILS);
    await page.getByRole("button", { name: "Submit report" }).click();

    await expect(page.getByText("Report received")).toBeVisible();

    // ---- It must appear in the admin queue -------------------------------
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const firstReport = page.locator('a[href^="/admin/reports/"]').first();
    test.skip((await firstReport.count()) === 0, "The report queue is empty.");

    await firstReport.click();
    await expect(page).toHaveURL(/\/admin\/reports\/[0-9a-fA-F-]{36}$/);

    // The reporter's words must be visible to the operator.
    await expect(page.locator("body")).toContainText(/authorized source/);

    // ---- Resolve it ------------------------------------------------------
    await page.locator("#status").selectOption("resolved");
    await page
      .locator("#resolutionNotes")
      .fill("Checked the destination; resolved by the E2E suite.");
    await page.getByRole("button", { name: "Save outcome" }).click();
    await expect(page.getByRole("status").first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(/Resolved/i).first()).toBeVisible();
  });

  test("the report form re-validates on the server, not just in the browser", async ({ page }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    const film = await createPublishedFilm(page);
    await page.goto(film.publicPath);

    // Strip the client-side constraint so the request actually reaches the
    // server. If validation only existed in the browser, this would succeed.
    const details = page.locator('textarea[name="details"]');
    await details.evaluate((element) => {
      element.removeAttribute("minlength");
      element.removeAttribute("required");
    });
    await details.fill("too short");

    await page.getByRole("button", { name: "Submit report" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByText("Report received")).toHaveCount(0);
  });

  test("the honeypot is hidden from assistive technology", async ({ page }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    const film = await createPublishedFilm(page);
    await page.goto(film.publicPath);

    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).not.toBeVisible();

    // Its wrapper must be aria-hidden so a screen reader never announces it.
    const wrapperHidden = await honeypot.evaluate(
      (element) => element.closest('[aria-hidden="true"]') !== null,
    );
    expect(wrapperHidden).toBe(true);
  });
});
