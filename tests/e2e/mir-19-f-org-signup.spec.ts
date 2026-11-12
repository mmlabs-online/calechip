import { expect, test, type Page } from "@playwright/test";

// MIR-19-f AC-1 to AC-7 — a sign-up at an org address (01-plan.md § 2; ADR-099). Runs against the mock
// build, which pins Confirm email ON. Each test uses its own email.

const PASSWORD = "correct-horse-battery-staple";
const MEMBER_EMAIL = "thanh@example.com";

const pathOf = (page: Page) => new URL(page.url()).pathname;

async function fillAndSubmit(page: Page, email: string): Promise<void> {
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(PASSWORD);
  await page.getByTestId("signup-display-name").fill("Nguyễn Văn An");
  await page.getByTestId("signup-avatar-option").first().click();
  await page.getByTestId("signup-submit").click();
}

test.describe("MIR-19-f sign-up at an org address", () => {
  test("AC-1: the sign-up screen is served at an org address", async ({ page }) => {
    await page.goto("/acme/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    expect(pathOf(page)).toBe("/acme/signup");
    await expect(page.getByTestId("auth-tab-signup")).toHaveAttribute("aria-current", "page");
  });

  test("AC-2: a sign-up at an org address completes there", async ({ page }) => {
    await page.goto("/acme/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    await fillAndSubmit(page, "mir19f-ac2@example.com");
    await expect(page.getByTestId("signup-confirm-notice")).toBeVisible();
    expect(pathOf(page)).toBe("/acme/signup");
  });

  test("AC-3: Org public's address is the same as the root", async ({ page }) => {
    await page.goto("/shared/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    expect(pathOf(page)).toBe("/shared/signup");
    await fillAndSubmit(page, "mir19f-ac3@example.com");
    await expect(page.getByTestId("signup-confirm-notice")).toBeVisible();
  });

  test("AC-4: a code that names no org is refused", async ({ page }) => {
    await page.goto("/no-such-org/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    await fillAndSubmit(page, "mir19f-ac4@example.com");
    await expect(page.getByTestId("signup-error")).toBeVisible();
    await expect(page.getByTestId("signup-confirm-notice")).toHaveCount(0);
    expect(pathOf(page)).toBe("/no-such-org/signup");
    await expect(page.getByTestId("signup-submit")).toBeEnabled();
  });

  test("AC-5: a reserved first segment is not a sign-up address", async ({ page }) => {
    await page.goto("/www/signup");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect(page.getByTestId("signup-form")).toHaveCount(0);
    expect(pathOf(page)).toBe("/signin");
  });

  test("AC-6: the sign-in tab leaves the org", async ({ page }) => {
    await page.goto("/acme/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    await page.getByTestId("auth-tab-signin").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    expect(pathOf(page)).toBe("/signin");
  });

  test("AC-7: a signed-in member at an org's sign-up address is shown the form", async ({ page }) => {
    await page.goto("/signin");
    await page.getByTestId("sign-in-email").fill(MEMBER_EMAIL);
    await page.getByTestId("sign-in-password").fill("password123");
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-member-name")).toBeVisible();
    await page.goto("/shared/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    expect(pathOf(page)).toBe("/shared/signup");
  });
});
