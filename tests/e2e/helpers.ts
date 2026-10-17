import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Shared helpers for the end-to-end suite.
 *
 * ---------------------------------------------------------------------------
 * Two rules this file follows deliberately
 * ---------------------------------------------------------------------------
 * 1. A test that cannot run because a precondition is missing is *skipped with
 *    a reason*, never allowed to pass. A green test that asserted nothing is
 *    worse than no test, because it hides the gap.
 *
 * 2. Admin flows need a real account and a real database. Rather than mocking
 *    those away — which would test the mock, not the app — the suite requires
 *    `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` and skips with instructions when
 *    they are absent. See `docs/testing.md`.
 * ---------------------------------------------------------------------------
 */

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

export const hasAdminCredentials = ADMIN_EMAIL !== "" && ADMIN_PASSWORD !== "";

export const CREDENTIALS_HINT =
  "Requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD. Create the account with `pnpm admin:create` " +
  "and export both variables. See docs/testing.md.";

export const CATALOGUE_HINT =
  "Requires at least one published film. Run `pnpm db:seed` against a development database, " +
  "or publish a film through /admin.";

export const GENRE_HINT =
  "Requires at least one genre. Create one under /admin/genres, or run `pnpm db:seed`.";

/* -------------------------------------------------------------------------- */
/* Small utilities                                                            */
/* -------------------------------------------------------------------------- */

/** Short, unique, URL-safe string used to keep fixtures from colliding. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every card on a catalogue page is a single link to the film. */
export function movieCards(page: Page): Locator {
  return page.locator('a[href^="/movies/"]');
}

/** The `<details>` block whose summary matches, e.g. "Add a link". */
export function disclosure(page: Page, summaryText: string): Locator {
  return page.locator("details").filter({ hasText: summaryText });
}

/**
 * Open the catalogue filter panel.
 *
 * The panel is a collapsed `<details>` so a listing opens on films rather than
 * on a four-field form. Playwright's actions (`fill`, `selectOption`, `click`)
 * wait for visibility, so a test that drives those controls has to open the
 * panel first — exactly as a visitor does. Assertions like `toHaveValue` do
 * not, which is why the round-trip tests need no change.
 */
export async function openCatalogueFilters(page: Page): Promise<void> {
  const panel = disclosure(page, "Search and filters").first();
  if ((await panel.count()) === 0) return;

  const isOpen = await panel.evaluate((element) => (element as HTMLDetailsElement).open);
  if (!isOpen) await panel.locator("summary").click();
}

/* -------------------------------------------------------------------------- */
/* Preconditions                                                              */
/* -------------------------------------------------------------------------- */

export async function skipUnlessCatalogueHasFilms(page: Page): Promise<void> {
  await page.goto("/movies");
  const count = await movieCards(page).count();
  test.skip(count === 0, CATALOGUE_HINT);
}

export async function skipUnlessAdminCredentials(): Promise<void> {
  test.skip(!hasAdminCredentials, CREDENTIALS_HINT);
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export async function signInAsAdmin(page: Page, next = "/admin"): Promise<void> {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(next)}$`));
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

export type PublishedFilm = {
  title: string;
  slug: string;
  /** Public path, e.g. `/movies/my-film`. */
  publicPath: string;
  /** Admin path, e.g. `/admin/movies/<uuid>`. */
  adminPath: string;
};

const SYNOPSIS =
  "A deliberately unremarkable synopsis written for the end-to-end suite. It exists only so that " +
  "the publication readiness check has something to evaluate, and it carries no editorial meaning " +
  "whatsoever. Real catalogue entries must use original wording supplied by the editorial team.";

/**
 * Must exceed `MIN_REVIEW_LENGTH` (200) in `src/lib/services/publication.ts`,
 * otherwise the publication gate legitimately blocks the film and every
 * dependent assertion fails for the wrong reason.
 */
const REVIEW_BODY =
  "This review exists so the end-to-end suite can exercise the publication gate from the inside. " +
  "It is intentionally longer than the two hundred character minimum enforced by the service " +
  "layer, because a shorter body is rejected before the film can be published at all. The wording " +
  "is filler and makes no claim about any real film. It is never committed to a production " +
  "database: the suite is documented as a development and staging tool only.";

/** Read the film's public path from the admin film page. */
async function readPublicPath(page: Page): Promise<string> {
  const link = page.locator('a[href^="/movies/"]').first();
  const href = await link.getAttribute("href");
  if (!href) throw new Error("Could not find the film's public URL on the admin film page.");
  return href;
}

/**
 * Drive the full editorial workflow: create a draft, write and publish a
 * review, then publish the film. Returns the resulting public path.
 *
 * Used as a fixture by the link-management and reporting specs so those tests
 * exercise *their* subject rather than re-testing the lifecycle.
 */
export async function createPublishedFilm(page: Page): Promise<PublishedFilm> {
  const title = `E2E Test Film ${uniqueSuffix()}`;

  await page.goto("/admin/movies/new");

  const genreCheckbox = page.locator('input[name="genreIds"]').first();
  test.skip((await genreCheckbox.count()) === 0, GENRE_HINT);

  await page.locator("#title").fill(title);
  await page.locator("#releaseYear").fill("2024");
  await page.locator("#runtimeMinutes").fill("101");
  await page.locator("#languageCode").fill("en");
  await page.locator("#country").fill("Testland");
  await page.locator("#synopsis").fill(SYNOPSIS);
  await genreCheckbox.check();

  await page.getByRole("button", { name: "Create draft" }).click();

  await expect(page).toHaveURL(/\/admin\/movies\/[0-9a-fA-F-]{36}$/);
  const adminPath = new URL(page.url()).pathname;

  // A brand-new draft must be blocked, and must not be publicly reachable.
  await expect(page.getByText("Blocked — cannot be published yet")).toBeVisible();

  const publicPath = await readPublicPath(page);
  const slug = publicPath.replace("/movies/", "");

  const draftResponse = await page.goto(publicPath);
  expect(draftResponse?.status(), "an unpublished film must 404 on the public site").toBe(404);

  // ---- Write and publish the review -------------------------------------
  await page.goto(adminPath);
  const reviewDisclosure = disclosure(page, "Write a new review");
  await reviewDisclosure.locator("summary").click();

  await reviewDisclosure.locator("#body").fill(REVIEW_BODY);
  await reviewDisclosure.locator("#reviewerName").fill("End-to-end suite");
  await reviewDisclosure.locator("#rating").fill("7.5");
  await reviewDisclosure.locator("#status").selectOption("published");
  await reviewDisclosure.getByRole("button", { name: "Save review" }).click();
  await expect(reviewDisclosure.getByRole("status")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Ready to publish")).toBeVisible();

  // ---- Publish ----------------------------------------------------------
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Yes, publish now" }).click();
  await expect(page.getByRole("link", { name: "View public page" })).toBeVisible();

  // ---- Confirm it is genuinely live -------------------------------------
  const liveResponse = await page.goto(publicPath);
  expect(liveResponse?.status(), "a published film must be reachable").toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  return { title, slug, publicPath, adminPath };
}
