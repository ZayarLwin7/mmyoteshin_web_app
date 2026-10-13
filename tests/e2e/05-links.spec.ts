import { expect, test } from "@playwright/test";

import {
  CREDENTIALS_HINT,
  createPublishedFilm,
  disclosure,
  hasAdminCredentials,
  signInAsAdmin,
} from "./helpers";

/**
 * Flow 5 — Add and disable an authorized external link.
 *
 * This is the highest-risk area of the product, so the assertions are written
 * to catch the two failures that would actually matter:
 *
 *   1. A link becoming publicly visible before it is authorized.
 *   2. The private authorization reference leaking to a public client.
 *
 * Both are checked against the real public page, not against the admin UI.
 */

const PRIVATE_REFERENCE = "LICENCE-REF-E2E-0042-DO-NOT-PUBLISH";

test.describe("authorized distribution links", () => {
  test("a link stays private until it is activated, and private evidence never leaks", async ({
    page,
  }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    const film = await createPublishedFilm(page);

    await page.goto(film.adminPath);

    // ---- Add the link ----------------------------------------------------
    const addDisclosure = disclosure(page, "Add a link");
    await addDisclosure.locator("summary").click();

    await addDisclosure.locator("#providerName").fill("Example Archive");
    await addDisclosure.locator("#label").fill("Authorized download — E2E");
    await addDisclosure.locator("#destinationUrl").fill("https://example.com/authorized/e2e-film");
    await addDisclosure.locator("#quality").fill("1080p");
    await addDisclosure.locator("#authorizationBasis").selectOption("written_permission");
    await addDisclosure.locator("#authorizationReference").fill(PRIVATE_REFERENCE);

    await addDisclosure.getByRole("button", { name: "Add link" }).click();
    await expect(addDisclosure.getByRole("status")).toBeVisible();

    // ---- It must be pending, and invisible to the public -----------------
    await page.reload();
    await expect(page.getByText("Pending review").first()).toBeVisible();

    await page.goto(film.publicPath);
    await expect(
      page.getByText(/No external distribution link is currently published/),
    ).toBeVisible();
    await expect(page.getByText("Example Archive")).toHaveCount(0);
    expect(
      await page.content(),
      "the private authorization reference must never reach a public client",
    ).not.toContain(PRIVATE_REFERENCE);

    // ---- Activate it -----------------------------------------------------
    await page.goto(film.adminPath);
    await page.getByRole("button", { name: "Activate (make public)" }).click();
    await page.getByRole("button", { name: "Yes, activate" }).click();

    await page.reload();
    await expect(page.getByText("Active").first()).toBeVisible();

    // ---- Now it is public, and still leaks nothing -----------------------
    await page.goto(film.publicPath);
    const serverLink = page.getByRole("link", { name: /Example Archive/ });
    await expect(serverLink).toBeVisible();

    expect(
      await page.content(),
      "the private authorization reference must never reach the public film page",
    ).not.toContain(PRIVATE_REFERENCE);

    // ---- The hand-off page names the destination before anyone leaves -----
    await serverLink.click();
    await page.waitForURL(/\/download\//);
    await expect(page.getByText("example.com").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Continue to Example Archive/ })).toBeVisible();

    // The authorization basis is disclosed; the evidence behind it is not.
    await expect(page.getByText(/Written permission/i).first()).toBeVisible();
    expect(
      await page.content(),
      "the private authorization reference must still not be present on the hand-off page",
    ).not.toContain(PRIVATE_REFERENCE);
  });

  test("disabling a link removes it from public view immediately", async ({ page }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    const film = await createPublishedFilm(page);

    await page.goto(film.adminPath);

    // Create and activate a link in one pass.
    const addDisclosure = disclosure(page, "Add a link");
    await addDisclosure.locator("summary").click();
    await addDisclosure.locator("#providerName").fill("Example Archive");
    await addDisclosure.locator("#label").fill("Authorized download — disable test");
    await addDisclosure.locator("#destinationUrl").fill("https://example.com/authorized/disable");
    await addDisclosure.locator("#authorizationBasis").selectOption("public_domain");
    await addDisclosure.locator("#authorizationReference").fill("PD-REF-E2E-0001");
    await addDisclosure.getByRole("button", { name: "Add link" }).click();
    await expect(addDisclosure.getByRole("status")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Activate (make public)" }).click();
    await page.getByRole("button", { name: "Yes, activate" }).click();
    await page.reload();

    await page.goto(film.publicPath);
    await expect(page.getByRole("link", { name: /Example Archive/ })).toBeVisible();

    // ---- Disable ---------------------------------------------------------
    await page.goto(film.adminPath);
    await page.getByRole("button", { name: "Disable", exact: true }).click();
    await page.getByRole("button", { name: "Yes, disable" }).click();
    await page.reload();

    await page.goto(film.publicPath);
    await expect(page.getByRole("link", { name: /Example Archive/ })).toHaveCount(0);
    await expect(
      page.getByText(/No external distribution link is currently published/),
    ).toBeVisible();
  });

  test("a non-HTTPS or internal destination is rejected", async ({ page }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    const film = await createPublishedFilm(page);
    await page.goto(film.adminPath);

    const addDisclosure = disclosure(page, "Add a link");
    await addDisclosure.locator("summary").click();

    await addDisclosure.locator("#providerName").fill("Sketchy Source");
    await addDisclosure.locator("#label").fill("Should never be accepted");
    await addDisclosure.locator("#destinationUrl").fill("http://127.0.0.1:8080/internal");
    await addDisclosure.locator("#authorizationBasis").selectOption("other_documented");
    await addDisclosure.locator("#authorizationReference").fill("nope");
    await addDisclosure.getByRole("button", { name: "Add link" }).click();

    // The form reports a field error and nothing is persisted.
    await expect(addDisclosure.getByRole("alert").first()).toBeVisible();

    await page.reload();
    await expect(page.getByText("Sketchy Source")).toHaveCount(0);
  });

  test("a link cannot be activated without a recorded authorization reference", async ({
    page,
  }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    const film = await createPublishedFilm(page);
    await page.goto(film.adminPath);

    const addDisclosure = disclosure(page, "Add a link");
    await addDisclosure.locator("summary").click();
    await addDisclosure.locator("#providerName").fill("Example Archive");
    await addDisclosure.locator("#label").fill("No evidence attached");
    await addDisclosure.locator("#destinationUrl").fill("https://example.com/authorized/no-ref");
    await addDisclosure.locator("#authorizationBasis").selectOption("public_domain");
    // Deliberately leave the private reference blank.
    await addDisclosure.getByRole("button", { name: "Add link" }).click();
    await expect(addDisclosure.getByRole("status")).toBeVisible();

    await page.reload();

    // The admin UI states the consequence plainly...
    await expect(page.getByText(/cannot be activated/i).first()).toBeVisible();

    // ...and the server refuses even if the action is invoked.
    await page.getByRole("button", { name: "Activate (make public)" }).click();
    await page.getByRole("button", { name: "Yes, activate" }).click();
    await page.reload();

    await page.goto(film.publicPath);
    await expect(page.getByText("Example Archive")).toHaveCount(0);
  });
});
