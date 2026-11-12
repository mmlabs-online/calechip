import { expect, test, type Page } from "@playwright/test";

// MIR-19-e AC-8 — the system panel's mock refuses `tasks` as an org code, as the database does
// (01-plan.md § 2, § 4.5). The mock holds two orgs at load (shared, acme), reset on reload. Every
// locator is a `data-testid` named in AC-8. Sign-in is copied from mir-18-b-org-management.spec.ts.

const PANEL = "/system.html";
const OPS = "ops@calechip.test";

async function signInVerified(page: Page): Promise<void> {
  await page.goto(PANEL);
  await page.getByTestId("system-signin-email").fill(OPS);
  await page.getByTestId("system-signin-password").fill("calechip-demo");
  await page.getByTestId("system-signin-submit").click();
  await page.getByTestId("system-code-input").fill("246810");
  await page.getByTestId("system-code-submit").click();
  await expect(page.getByTestId("system-orgs")).toBeVisible();
}

test.describe("MIR-19-e: the panel's mock reserved list", () => {
  test("AC-8: tasks is refused as an org code", async ({ page }) => {
    await signInVerified(page);

    await page.getByTestId("system-org-new").click();
    const form = page.getByTestId("system-org-create-form");
    await page.getByTestId("system-org-create-code").fill("tasks");
    await page.getByTestId("system-org-create-name").fill("Tasks Org");
    await page.getByTestId("system-org-create-submit").click();

    await expect(page.getByTestId("system-org-create-error")).toBeVisible();
    await expect(form).toBeVisible();
    await expect(
      page.locator('[data-testid="system-org-row"][data-org-code="tasks"]'),
    ).toHaveCount(0);

    await page.getByTestId("system-org-create-cancel").click();
    await expect(page.getByTestId("system-org-row")).toHaveCount(2);
  });
});
