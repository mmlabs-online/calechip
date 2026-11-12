import { expect, test, type Locator, type Page } from "@playwright/test";

// MIR-20 AC-1 to AC-7 — impersonation from the system panel, against the mock build (01-plan.md § 2).
//
// Every locator is a `data-testid` named in 01-plan.md § 4.3. The mock holds, at load and reset on
// reload: Org public (teams `CaleChip`, with three members, and `Nhóm khác`, with one) and the
// dedicated org `Acme Studio`, which has no members. "Signed in" is ops@calechip.test, password
// `calechip-demo`, code `246810`, as mir-15-c-move-team.spec.ts signs in.

const PANEL = "/system.html";
const OPS = "ops@calechip.test";

async function signIn(page: Page): Promise<void> {
  await page.goto(PANEL);
  await page.getByTestId("system-signin-email").fill(OPS);
  await page.getByTestId("system-signin-password").fill("calechip-demo");
  await page.getByTestId("system-signin-submit").click();
  await page.getByTestId("system-code-input").fill("246810");
  await page.getByTestId("system-code-submit").click();
  await expect(page.getByTestId("system-orgs")).toBeVisible();
}

function orgRow(page: Page, name: string): Locator {
  return page
    .getByTestId("system-org-row")
    .filter({ has: page.getByTestId("system-org-name").getByText(name, { exact: true }) });
}

async function startOnAcme(page: Page): Promise<void> {
  await orgRow(page, "Acme Studio").getByTestId("system-org-impersonate").click();
  await page.getByTestId("system-impersonate-reason").fill("Customer ticket 4411");
  await page.getByTestId("system-impersonate-submit").click();
  await expect(page.getByTestId("system-impersonation-banner")).toBeVisible();
}

test.describe("MIR-20 impersonation", () => {
  test("AC-1: a session starts on a dedicated org", async ({ page }) => {
    await signIn(page);
    await orgRow(page, "Acme Studio").getByTestId("system-org-impersonate").click();
    await expect(page.getByTestId("system-impersonate-team")).toHaveCount(0);
    const minutes = page.getByTestId("system-impersonate-minutes");
    await expect(minutes.locator("option")).toHaveText(["30 minutes", "45 minutes", "60 minutes"]);
    await expect(minutes).toHaveValue("30");

    await page.getByTestId("system-impersonate-reason").fill("Customer ticket 4411");
    await page.getByTestId("system-impersonate-submit").click();

    await expect(page.getByTestId("system-impersonation-banner")).toBeVisible();
    await expect(page.getByTestId("system-impersonation-org")).toHaveText("Acme Studio");
    await expect(page.getByTestId("system-impersonation-reason")).toHaveText("Customer ticket 4411");
    await expect(page.getByTestId("system-impersonation-left")).toHaveText("30 min left");
    await expect(page.getByTestId("system-roster")).toBeVisible();
    await expect(page.getByTestId("system-roster-empty")).toBeVisible();
  });

  test("AC-2: Org public needs a team, and the roster is that team's", async ({ page }) => {
    await signIn(page);
    await orgRow(page, "Org public").getByTestId("system-org-impersonate").click();
    const team = page.getByTestId("system-impersonate-team");
    await expect(team.locator("option")).toHaveText(["", "CaleChip", "Nhóm khác"]);
    await expect(team).toHaveValue("");
    await expect(page.getByTestId("system-impersonate-submit")).toBeDisabled();

    await team.selectOption({ label: "CaleChip" });
    await page.getByTestId("system-impersonate-reason").fill("Customer ticket 4412");
    await page.getByTestId("system-impersonate-minutes").selectOption("60");
    await page.getByTestId("system-impersonate-submit").click();

    await expect(page.getByTestId("system-impersonation-org")).toHaveText("Org public — CaleChip");
    await expect(page.getByTestId("system-impersonation-left")).toHaveText("60 min left");
    const rows = page.getByTestId("system-roster").getByTestId("system-roster-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.getByTestId("system-roster-name")).toHaveText(["Đã duyệt", "Quản trị", "Thành viên"]);
    await expect(rows.getByTestId("system-roster-teams")).toHaveText(["CaleChip", "CaleChip", "CaleChip"]);
    await expect(page.getByTestId("system-roster")).not.toContainText("Người nhóm khác");
  });

  test("AC-3: a blank reason is refused and nothing starts", async ({ page }) => {
    await signIn(page);
    await orgRow(page, "Acme Studio").getByTestId("system-org-impersonate").click();
    const refusal = "A reason is required, up to 500 characters.";

    await page.getByTestId("system-impersonate-submit").click();
    await expect(page.getByTestId("system-impersonate-error")).toHaveText(refusal);

    await page.getByTestId("system-impersonate-reason").fill("    ");
    await page.getByTestId("system-impersonate-submit").click();
    await expect(page.getByTestId("system-impersonate-error")).toHaveText(refusal);
    await expect(page.getByTestId("system-impersonate-form")).toBeVisible();
    await expect(page.getByTestId("system-impersonation-banner")).toHaveCount(0);
  });

  test("AC-4: one session at a time, and the banner stays in view", async ({ page }) => {
    await signIn(page);
    await startOnAcme(page);
    await expect(page.getByTestId("system-org-impersonate")).toHaveCount(0);

    await page.getByTestId("system-issues").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId("system-impersonation-banner")).toBeInViewport();
  });

  test("AC-5: ending a session", async ({ page }) => {
    await signIn(page);
    await startOnAcme(page);
    await page.getByTestId("system-impersonation-end").click();

    await expect(page.getByTestId("system-impersonation-banner")).toHaveCount(0);
    await expect(page.getByTestId("system-roster")).toHaveCount(0);
    await expect(page.getByTestId("system-org-impersonate")).toHaveCount(2);
  });

  test("AC-6: the box closes on its own", async ({ page }) => {
    await page.clock.install();
    await signIn(page);
    await startOnAcme(page);

    await page.clock.fastForward("31:00");

    await expect(page.getByTestId("system-impersonation-banner")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId("system-roster")).toHaveCount(0);
    await expect(page.getByTestId("system-impersonation-expired")).toHaveText(
      "The impersonation session has ended.",
    );
  });

  test("AC-7: signing out ends the session", async ({ page }) => {
    await signIn(page);
    await startOnAcme(page);
    await page.getByTestId("system-signout").click();

    await page.getByTestId("system-signin-email").fill(OPS);
    await page.getByTestId("system-signin-password").fill("calechip-demo");
    await page.getByTestId("system-signin-submit").click();
    await page.getByTestId("system-code-input").fill("246810");
    await page.getByTestId("system-code-submit").click();
    await expect(page.getByTestId("system-orgs")).toBeVisible();
    await expect(page.getByTestId("system-impersonation-banner")).toHaveCount(0);
  });
});
