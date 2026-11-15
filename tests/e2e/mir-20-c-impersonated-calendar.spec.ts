import { expect, test, type Locator, type Page } from "@playwright/test";

// MIR-20-c AC-1 to AC-6 — the calendar a live impersonation unlocks, against the mock build
// (01-plan.md § 2). Every locator is a `data-testid` named in 01-plan.md § 4.3.
//
// The clock is installed at 2026-09-10 before the first `goto`, so the panel's first month is
// September 2026 — the month the member app's fixture entries sit in. "Signed in" is
// ops@calechip.test, password `calechip-demo`, code `246810`, as mir-20-impersonation.spec.ts signs in.

const PANEL = "/system.html";
const OPS = "ops@calechip.test";
const NOTHING = "Nothing on the calendar this month.";

async function signIn(page: Page): Promise<void> {
  await page.clock.install({ time: new Date("2026-09-10T03:00:00Z") });
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

async function startOn(page: Page, org: string, team: string | null, minutes = "30"): Promise<void> {
  await orgRow(page, org).getByTestId("system-org-impersonate").click();
  if (team) await page.getByTestId("system-impersonate-team").selectOption({ label: team });
  await page.getByTestId("system-impersonate-reason").fill("Customer ticket 4411");
  await page.getByTestId("system-impersonate-minutes").selectOption(minutes);
  await page.getByTestId("system-impersonate-submit").click();
  await expect(page.getByTestId("system-impersonation-banner")).toBeVisible();
}

test.describe("MIR-20-c impersonated calendar", () => {
  test("AC-1: a session on a team of Org public shows that team's month", async ({ page }) => {
    await signIn(page);
    await startOn(page, "Org public", "CaleChip");

    const calendar = page.getByTestId("system-calendar");
    await expect(calendar).toBeVisible();
    const afterRoster = await page.evaluate(() => {
      const roster = document.querySelector('[data-testid="system-roster"]');
      const cal = document.querySelector('[data-testid="system-calendar"]');
      return !!roster && !!cal && !!(roster.compareDocumentPosition(cal) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(afterRoster).toBe(true);

    await expect(page.getByTestId("system-calendar-month")).toHaveText("September 2026");
    const rows = calendar.getByTestId("system-calendar-row");
    await expect(rows).toHaveCount(1);
    await expect(rows).toHaveAttribute("data-entry-id", "dd000000-0000-4000-8000-000000000001");
    await expect(rows.getByTestId("system-calendar-name")).toHaveText("Đã duyệt");
    await expect(rows.getByTestId("system-calendar-type")).toHaveText("PTO");
    await expect(rows.getByTestId("system-calendar-portion")).toHaveText("Full day");
    await expect(rows.getByTestId("system-calendar-dates")).toHaveText("2026-09-14 – 2026-09-16");
    await expect(rows.getByTestId("system-calendar-status")).toHaveText("approved");
    await expect(rows.getByTestId("system-calendar-tentative")).toHaveText("");
  });

  test("AC-2: the other team's month is the other team's", async ({ page }) => {
    await signIn(page);
    await startOn(page, "Org public", "Nhóm khác");

    const rows = page.getByTestId("system-calendar").getByTestId("system-calendar-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.getByTestId("system-calendar-name")).toHaveText("Người nhóm khác");
    await expect(rows.getByTestId("system-calendar-type")).toHaveText("PTO");
    await expect(rows.getByTestId("system-calendar-portion")).toHaveText("Full day");
    await expect(rows.getByTestId("system-calendar-dates")).toHaveText("2026-09-21 – 2026-09-22");
    await expect(rows.getByTestId("system-calendar-status")).toHaveText("pending");
    await expect(rows.getByTestId("system-calendar-tentative")).toHaveText("");
    await expect(page.getByTestId("system-calendar")).not.toContainText("Đã duyệt");
  });

  test("AC-3: stepping through months", async ({ page }) => {
    await signIn(page);
    await startOn(page, "Org public", "CaleChip");
    const month = page.getByTestId("system-calendar-month");
    const rows = page.getByTestId("system-calendar-row");
    const empty = page.getByTestId("system-calendar-empty");
    await expect(rows).toHaveCount(1);

    await page.getByTestId("system-calendar-prev").click();
    await expect(month).toHaveText("August 2026");
    await expect(rows).toHaveCount(0);
    await expect(empty).toHaveText(NOTHING);

    await page.getByTestId("system-calendar-next").click();
    await expect(month).toHaveText("September 2026");
    await page.getByTestId("system-calendar-next").click();
    await expect(month).toHaveText("October 2026");
    await expect(empty).toBeVisible();

    await page.getByTestId("system-calendar-prev").click();
    await expect(month).toHaveText("September 2026");
    await expect(rows).toHaveCount(1);
  });

  test("AC-4: a dedicated org with no entries", async ({ page }) => {
    await signIn(page);
    await startOn(page, "Acme Studio", null);

    await expect(page.getByTestId("system-calendar")).toBeVisible();
    await expect(page.getByTestId("system-calendar-empty")).toHaveText(NOTHING);
  });

  test("AC-5: the calendar offers no write", async ({ page }) => {
    await signIn(page);
    await startOn(page, "Org public", "CaleChip");

    const calendar = page.getByTestId("system-calendar");
    await expect(page.getByTestId("system-calendar-row")).toHaveCount(1);
    await expect(calendar.locator("input, select, textarea, a")).toHaveCount(0);
    const buttons = calendar.locator("button");
    await expect(buttons).toHaveCount(2);
    await expect(calendar.getByTestId("system-calendar-prev")).toBeVisible();
    await expect(calendar.getByTestId("system-calendar-next")).toBeVisible();
  });

  test("AC-6: no calendar without a live session", async ({ page }) => {
    await signIn(page);
    await expect(page.getByTestId("system-calendar")).toHaveCount(0);

    await startOn(page, "Acme Studio", null);
    await expect(page.getByTestId("system-calendar")).toBeVisible();
    await page.getByTestId("system-impersonation-end").click();
    await expect(page.getByTestId("system-impersonation-banner")).toHaveCount(0);
    await expect(page.getByTestId("system-calendar")).toHaveCount(0);

    await startOn(page, "Acme Studio", null, "30");
    await expect(page.getByTestId("system-calendar")).toBeVisible();
    await page.clock.fastForward("31:00");
    await expect(page.getByTestId("system-calendar")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId("system-impersonation-expired")).toBeVisible();
  });
});
