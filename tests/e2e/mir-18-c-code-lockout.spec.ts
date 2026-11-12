import { expect, test, type Page } from "@playwright/test";

// MIR-18-c AC-13 to AC-16 — the second factor's lockout, against the mock build (01-plan.md § 2, § 4.7).
// The mock models the database hook's numbers (five wrong codes in fifteen minutes); the hook itself is
// pgTAP's and AC-17's. Fixtures are MIR-18's: `ops@calechip.test` has an authenticator set up, the
// password is `calechip-demo`, the one valid code is `246810`.

const PANEL = "/system.html";
const PASSWORD = "calechip-demo";
const CODE = "246810";
const WRONG = "000000";
const OPS = "ops@calechip.test";
const WRONG_CODE_TEXT = "That code did not match. Try again.";
const LOCKED_TEXT = "Too many incorrect codes. Try again in 15 minutes.";

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId("system-signin-email").fill(email);
  await page.getByTestId("system-signin-password").fill(password);
  await page.getByTestId("system-signin-submit").click();
}

async function submitCode(page: Page, code: string): Promise<void> {
  await page.getByTestId("system-code-input").fill(code);
  await page.getByTestId("system-code-submit").click();
}

/** AC-13's four wrong codes, then AC-14's fifth. Leaves the page on the sign-in form. */
async function lockOut(page: Page): Promise<void> {
  await signIn(page, OPS, PASSWORD);
  await expect(page.getByTestId("system-verify")).toBeVisible();
  for (let i = 0; i < 4; i += 1) {
    await submitCode(page, WRONG);
    await expect(page.getByTestId("system-code-error")).toHaveText(WRONG_CODE_TEXT);
  }
  await submitCode(page, WRONG);
  await expect(page.getByTestId("system-signin-form")).toBeVisible();
}

test.describe("MIR-18-c the second factor's lockout", () => {
  test("AC-13: under the limit, a wrong code says so and stays on the code screen", async ({ page }) => {
    await page.goto(PANEL);
    await signIn(page, OPS, PASSWORD);
    await expect(page.getByTestId("system-verify")).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      await submitCode(page, WRONG);
      await expect(page.getByTestId("system-code-error")).toHaveText(WRONG_CODE_TEXT);
      await expect(page.getByTestId("system-verify")).toBeVisible();
    }
  });

  test("AC-14: the fifth wrong code ends the attempt and says why", async ({ page }) => {
    await page.goto(PANEL);
    await lockOut(page);
    await expect(page.getByTestId("system-signin-error")).toHaveText(LOCKED_TEXT);
  });

  test("AC-15: while locked, the right code does not let you in", async ({ page }) => {
    await page.goto(PANEL);
    await lockOut(page);
    await signIn(page, OPS, PASSWORD);
    await submitCode(page, CODE);
    await expect(page.getByTestId("system-signin-form")).toBeVisible();
    await expect(page.getByTestId("system-signin-error")).toHaveText(LOCKED_TEXT);
    await expect(page.getByTestId("system-signed-in")).toHaveCount(0);
  });

  test("AC-16: after the window, the right code lets you in", async ({ page }) => {
    await page.clock.install();
    await page.goto(PANEL);
    await lockOut(page);
    await page.clock.fastForward("15:01");
    await signIn(page, OPS, PASSWORD);
    await submitCode(page, CODE);
    await expect(page.getByTestId("system-signed-in")).toBeVisible();
  });
});
