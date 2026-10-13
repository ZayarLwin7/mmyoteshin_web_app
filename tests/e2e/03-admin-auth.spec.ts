import { expect, test } from "@playwright/test";

import { CREDENTIALS_HINT, hasAdminCredentials, signInAsAdmin } from "./helpers";

/**
 * Flow 3 — Admin login and unauthorized access rejection.
 *
 * The point of this spec is the *rejection* half. Hiding a link in the UI is
 * not authorization, so the assertions below are about what the server does
 * when someone asks for a protected resource directly.
 */

test.describe("admin access control", () => {
  test("every protected admin route redirects an anonymous visitor", async ({ page }) => {
    const protectedRoutes = [
      "/admin",
      "/admin/movies",
      "/admin/movies/new",
      "/admin/reviews",
      "/admin/links",
      "/admin/genres",
      "/admin/reports",
      "/admin/audit",
      "/admin/settings",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);

      await expect(page, `${route} must not be reachable anonymously`).toHaveURL(/\/admin\/login/);
    }
  });

  test("the sign-in page remembers where the visitor was heading", async ({ page }) => {
    await page.goto("/admin/movies");

    await expect(page).toHaveURL(/next=/);
    await expect(page.getByRole("heading", { name: "Administrator sign-in" })).toBeVisible();
  });

  test("an off-site redirect target is discarded", async ({ page }) => {
    await page.goto("/admin/login?next=https%3A%2F%2Fevil.example.com%2Fsteal");

    // The form must not carry the attacker-controlled destination through.
    const hidden = page.locator('input[name="redirectTo"]');
    const value = (await hidden.count()) > 0 ? await hidden.getAttribute("value") : null;

    expect(value ?? "/admin").not.toContain("evil.example.com");
  });

  test("a wrong password is refused with a non-committal message", async ({ page }) => {
    await page.goto("/admin/login");

    await page.getByLabel("Email").fill("nobody-at-all@example.com");
    await page.getByLabel("Password").fill("definitely-not-the-right-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Still on the sign-in page, with an error surfaced.
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("alert")).toBeVisible();

    // The message must not reveal whether the account exists.
    const message = (await page.getByRole("alert").textContent())?.toLowerCase() ?? "";
    expect(message).not.toContain("no such user");
    expect(message).not.toContain("unknown account");
    expect(message).not.toContain("user not found");
  });

  test("no session cookie is issued for a failed sign-in", async ({ page, context }) => {
    await page.goto("/admin/login");

    await page.getByLabel("Email").fill("nobody-at-all@example.com");
    await page.getByLabel("Password").fill("definitely-not-the-right-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === "mmy_session")).toBeUndefined();
  });
});

test.describe("admin session", () => {
  test("a valid administrator reaches the dashboard and the session cookie is hardened", async ({
    page,
    context,
  }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const session = (await context.cookies()).find((cookie) => cookie.name === "mmy_session");
    expect(session, "a session cookie must be set on success").toBeTruthy();
    expect(session!.httpOnly, "the session cookie must not be readable from JS").toBe(true);
    expect(session!.sameSite).toBe("Lax");
  });

  test("a tampered session cookie is rejected", async ({ page, context }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);

    const session = (await context.cookies()).find((cookie) => cookie.name === "mmy_session");
    expect(session).toBeTruthy();

    // Flip the last two characters of the signed token.
    const tampered = `${session!.value.slice(0, -2)}xy`;
    expect(tampered).not.toBe(session!.value);

    await context.addCookies([{ ...session!, value: tampered }]);
    await page.goto("/admin");

    await expect(page, "a forged token must not authenticate").toHaveURL(/\/admin\/login/);
  });

  test("signing out ends the session", async ({ page }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);

    const signOut = page.getByRole("button", { name: /sign out|log out/i });
    test.skip((await signOut.count()) === 0, "No sign-out control found in the admin shell.");

    await signOut.first().click();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a signed-in administrator never sees the sign-in page again", async ({ page }) => {
    test.skip(!hasAdminCredentials, CREDENTIALS_HINT);

    await signInAsAdmin(page);
    await page.goto("/admin/login");

    await expect(page).toHaveURL(/\/admin$/);
  });
});
