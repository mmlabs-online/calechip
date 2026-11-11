import { expect, test, type Locator, type Page } from "@playwright/test";

// MIR-15-c AC-17 to AC-19 — moving a team out of Org public from the system panel, against the mock
// build (01-plan.md § 2, § 4.6). AC-20 (no dedicated org) is asserted by reading the component.
//
// Every locator is a `data-testid` named in 01-plan.md § 4.5. The mock holds, at load and reset on
// reload: Org public's two teams — `CaleChip` with 3 active members and `Nhóm khác` with 1 — and one
// dedicated org, `Acme Studio`. "Signed in" is ops@calechip.test, password `calechip-demo`, code
// `246810`, as mir-18-b-org-management.spec.ts signs in.

const PANEL = "/system.html";
const OPS = "ops@calechip.test";
const CALECHIP_ID = "11111111-1111-4111-8111-111111111111";

async function signInVerified(page: Page): Promise<void> {
  await page.goto(PANEL);
  await page.getByTestId("system-signin-email").fill(OPS);
  await page.getByTestId("system-signin-password").fill("calechip-demo");
  await page.getByTestId("system-signin-submit").click();
  await page.getByTestId("system-code-input").fill("246810");
  await page.getByTestId("system-code-submit").click();
  await expect(page.getByTestId("system-teams-list")).toBeVisible();
}

function teamRow(page: Page, name: string): Locator {
  return page.getByTestId("system-team-row").filter({ has: page.getByTestId("system-team-name").getByText(name, { exact: true }) });
}

test.describe("MIR-15-c moving a team", () => {
  test.beforeEach(async ({ page }) => {
    await signInVerified(page);
  });

  test("AC-17: the panel lists Org public's teams with their active members", async ({ page }) => {
    const rows = page.getByTestId("system-teams-list").getByTestId("system-team-row");
    await expect(rows).toHaveCount(2);
    await expect(teamRow(page, "CaleChip").getByTestId("system-team-members")).toHaveText("3");
    await expect(teamRow(page, "Nhóm khác").getByTestId("system-team-members")).toHaveText("1");
    await expect(page.getByTestId("system-team-move")).toHaveCount(2);
  });

  test("AC-18: the panel moves a team", async ({ page }) => {
    await teamRow(page, "CaleChip").getByTestId("system-team-move").click();
    await expect(page.getByTestId("system-move-form")).toBeVisible();
    await page.getByTestId("system-move-target").selectOption({ label: "Acme Studio" });
    await page.getByTestId("system-move-submit").click();

    await expect(page.getByTestId("system-move-done")).toHaveText(
      "Moved CaleChip to Acme Studio — 3 members, 0 links removed.",
    );
    await expect(page.locator(`[data-testid="system-team-row"][data-team-id="${CALECHIP_ID}"]`)).toHaveCount(0);
    await expect(page.getByTestId("system-move-form")).toHaveCount(0);
  });

  test("AC-19: the panel shows a refusal and what is in the way", async ({ page }) => {
    await teamRow(page, "Nhóm khác").getByTestId("system-team-move").click();
    await page.getByTestId("system-move-target").selectOption({ label: "Acme Studio" });
    await page.getByTestId("system-move-submit").click();

    const alert = page.getByTestId("system-move-error");
    await expect(alert).toContainText(
      "Someone on this team is also on another team in Org public. They must leave one of the two teams first.",
    );
    await expect(alert).toContainText("Người nhóm khác");
    await expect(teamRow(page, "Nhóm khác")).toHaveCount(1);
  });
});
