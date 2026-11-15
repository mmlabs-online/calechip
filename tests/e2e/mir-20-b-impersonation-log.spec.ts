import { expect, test, type Page } from "@playwright/test";

// MIR-20-b AC-1 to AC-4 — the support log on the Members screen (01-plan.md § 2 and § 4.4).
//
// THE SUITE DRIVES THE MOCK SEAM (tests/e2e/seam.setup.ts refuses the run otherwise), so the rows are
// the three sessions the mock seeds. The database's own read is supabase/tests/400-impersonation-log.test.sql.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
/** FIXTURE_ADMIN.id (src/lib/fixtures.ts), transcribed: the acceptance suite does not import `src/`. */
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function openMembers(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-members-link").click();
}

const STARTED = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/;
const LIVE = /^Live until \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/;

test("AC-1 Org public's org admin sees every session on Org public, newest first", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await openMembers(page);
  await expect(page.getByTestId("member-list-table")).toBeVisible();
  await expect(page.getByTestId("impersonation-log")).toBeVisible();

  const follows = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="member-list-table"]');
    const b = document.querySelector('[data-testid="impersonation-log"]');
    return !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(follows).toBe(true);

  const rows = page.getByTestId("impersonation-log-table").getByTestId("impersonation-log-row");
  await expect(rows).toHaveCount(3);

  const cell = (n: number, name: string) => rows.nth(n).getByTestId(`impersonation-log-${name}`);
  await expect(cell(0, "scope")).toHaveText("CaleChip");
  await expect(cell(0, "actor")).toHaveText("ops@calechip.test");
  await expect(cell(0, "reason")).toHaveText("Customer ticket 4411");
  await expect(cell(0, "started")).toHaveText(STARTED);
  await expect(cell(0, "ended")).toHaveText(LIVE);
  await expect(cell(0, "reads")).toHaveText("1");

  await expect(cell(1, "scope")).toHaveText("Nhóm khác");
  await expect(cell(1, "actor")).toHaveText("ops@calechip.test");
  await expect(cell(1, "reason")).toHaveText("Sign-up stuck for a new member");
  await expect(cell(1, "started")).toHaveText("2026-11-10 09:00 UTC");
  await expect(cell(1, "ended")).toHaveText("2026-11-10 09:20 UTC");
  await expect(cell(1, "reads")).toHaveText("2");

  await expect(cell(2, "scope")).toHaveText("CaleChip");
  await expect(cell(2, "actor")).toHaveText("support@calechip.test");
  await expect(cell(2, "reason")).toHaveText("Calendar shows a wrong holiday");
  await expect(cell(2, "started")).toHaveText("2026-11-08 14:00 UTC");
  await expect(cell(2, "ended")).toHaveText("2026-11-08 14:30 UTC");
  await expect(cell(2, "reads")).toHaveText("0");

  await expect(page.getByTestId("impersonation-log-truncated")).toHaveCount(0);
});

test("AC-2 a member sees no log", async ({ page }) => {
  await signIn(page, MEMBER_EMAIL);
  await page.goto("/members");
  await expect(page.getByTestId("member-list-table")).toBeVisible();
  await expect(page.getByTestId("impersonation-log")).toHaveCount(0);
});

test("AC-3 a dedicated org's org admin sees none of Org public's sessions", async ({ page }) => {
  await page.addInitScript((adminId: string) => {
    localStorage.setItem("calechip.mock.dedicatedOrgMembers", JSON.stringify([adminId]));
  }, ADMIN_ID);
  await signIn(page, ADMIN_EMAIL);
  await openMembers(page);
  await expect(page.getByTestId("impersonation-log-empty")).toHaveText(
    "No support session is on record for you.",
  );
  await expect(page.getByTestId("impersonation-log-row")).toHaveCount(0);
});

test("AC-4 the log offers no control", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL);
  await openMembers(page);
  await expect(page.getByTestId("impersonation-log-table")).toBeVisible();
  await expect(
    page.getByTestId("impersonation-log").locator("button, input, select, a"),
  ).toHaveCount(0);
});
