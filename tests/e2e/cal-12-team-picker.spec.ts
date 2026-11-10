// CAL-12 — an admin chooses which team the calendar screens and the sidebar roster show, read-only.
// 01-plan.md § 4.8 (amended 2026-10-01: the picker is a list of links — 99-questions.md).
//
// Ids are TRANSCRIBED from src/lib/fixtures.ts, not imported, as cal-05-week-view.spec.ts:57-58
// records. Nothing here writes, so a `page.goto` resetting the mock's entry table costs nothing; the
// session itself survives it (the mock persists it, as the real client does).
//
// AC-12 and AC-13 are unit-only (tests/viewed-team.test.ts): the mock seam cannot be made to fail
// from the browser, and the denial is below the interface.
import { expect, test, type Locator, type Page } from "@playwright/test";

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const OTHER_MEMBER_EMAIL = "chi@other.example.com";

const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "44444444-4444-4444-8444-444444444444";
const TEAM_B_NAME = "Nhóm khác";
const TEAM_B_MEMBER = "66666666-6666-4666-8666-666666666666";
const TEAM_B_ENTRY = "dd000000-0000-4000-8000-000000000002";
const TEAM_B_NOTE = "Nghỉ của nhóm khác";

const MONTH = "/month/2026-09";
const MONTH_B = `${MONTH}?team=${TEAM_B}`;
const WEEK_B = `/week/2026-09-21?team=${TEAM_B}`;

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

async function signInAt(page: Page, path: string, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await page.goto(path);
  await expect(page.getByTestId("shell-sidebar")).toBeVisible();
}

async function signOut(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

const cell = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="month-cell"][data-date="${date}"]`);

const selectedOption = (page: Page): Locator =>
  page.locator('[data-testid="shell-team-option"][aria-current="true"]');

const option = (page: Page, teamId: string): Locator =>
  page.locator(`[data-testid="shell-team-option"][data-team-id="${teamId}"]`);

const teamParam = (page: Page): string | null => new URL(page.url()).searchParams.get("team");

async function monthReady(page: Page): Promise<void> {
  await expect(page.getByTestId("month-grid")).toBeVisible();
}

/** Waits until no loading phase is on screen — the screen and the sidebar have both answered. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('[data-testid$="-loading"]')).toHaveCount(0);
}

async function holidayDates(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid="month-cell"]:has([data-testid="month-cell-holiday"])')
    .evaluateAll((cells) => cells.map((c) => c.getAttribute("data-date") ?? ""));
}

test.describe("CAL-12 — the team picker", () => {
  test("AC-1: with no team in the address an admin sees their own team, selected", async ({ page }) => {
    await signInAt(page, MONTH, ADMIN_EMAIL);
    await monthReady(page);

    await expect(selectedOption(page)).toHaveAttribute("data-team-id", TEAM_A);
    await expect(page.getByTestId("shell-roster-count")).toHaveAttribute("data-team-id", TEAM_A);
    await expect(page.getByTestId("shell-viewing-other-team")).toHaveCount(0);
  });

  test("AC-2: two options, alphabetical, own marked; calendar screens only; no form control", async ({ page }) => {
    await signInAt(page, MONTH, ADMIN_EMAIL);
    await monthReady(page);

    const options = page.getByTestId("shell-team-option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveAttribute("data-team-id", TEAM_A); // "CaleChip"
    await expect(options.nth(1)).toHaveAttribute("data-team-id", TEAM_B); // "Nhóm khác"
    await expect(option(page, TEAM_A)).toHaveAttribute("data-own", "true");
    await expect(option(page, TEAM_B)).toHaveAttribute("data-own", "false");

    // UIE-10 AC-10's property, asserted from the side that would break it.
    await page.goto("/week");
    await expect(page.getByTestId("shell-team-picker")).toBeVisible();
    const sidebar = page.getByTestId("shell-sidebar");
    await expect(sidebar.locator("select")).toHaveCount(0);
    await expect(sidebar.locator("input")).toHaveCount(0);
    await expect(sidebar.locator("form")).toHaveCount(0);

    for (const path of ["/events", "/setting"]) {
      await page.goto(path);
      await settled(page);
      await expect(page.getByTestId("shell-team-picker")).toHaveCount(0);
      await expect(page.getByTestId("shell-roster-count")).toHaveAttribute("data-team-id", TEAM_A);
    }
  });

  test("AC-3: a member gets no picker, and the address cannot give them one", async ({ page }) => {
    await signInAt(page, MONTH, MEMBER_EMAIL);
    await monthReady(page);
    const plain = await cell(page, "2026-09-21").getAttribute("data-count");

    await page.goto(MONTH_B);
    await monthReady(page);
    await expect(page.getByTestId("shell-team-picker")).toHaveCount(0);
    await expect(page.getByTestId("shell-viewing-other-team")).toHaveCount(0);
    await expect(cell(page, "2026-09-21")).toHaveAttribute("data-count", plain ?? "");
    await expect(page.getByTestId("shell-roster-count")).toHaveAttribute("data-team-id", TEAM_A);
  });

  test("AC-4: choosing a team draws that team's entries, the period unchanged", async ({ page }) => {
    await signInAt(page, MONTH, ADMIN_EMAIL);
    await monthReady(page);

    await option(page, TEAM_B).click();
    await expect.poll(() => teamParam(page)).toBe(TEAM_B);
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-09");
    await expect(page.getByTestId("shell-viewing-other-team")).toBeVisible();
    await expect(
      cell(page, "2026-09-21").locator(`[data-testid="month-avatar"][data-member-id="${TEAM_B_MEMBER}"]`),
    ).toHaveCount(1);

    await page.goto(WEEK_B);
    const rows = page.locator('[data-testid="week-day"][data-date="2026-09-21"] [data-testid="week-row"]');
    const bRow = rows.and(page.locator(`[data-entry-id="${TEAM_B_ENTRY}"]`));
    await expect(bRow).toHaveCount(1);
    await expect(bRow.getByTestId("week-row-note")).toHaveText(TEAM_B_NOTE);
    const memberIds = await page
      .getByTestId("week-row")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-member-id")));
    expect(memberIds.length).toBeGreaterThan(0);
    expect(memberIds.every((id) => id === TEAM_B_MEMBER)).toBe(true);
  });

  test("AC-5: the sidebar roster lists the viewed team's members, and only them", async ({ page }) => {
    await signInAt(page, MONTH_B, ADMIN_EMAIL);
    await monthReady(page);

    const count = page.getByTestId("shell-roster-count");
    await expect(count).toHaveAttribute("data-team-id", TEAM_B);
    await expect(count).toContainText(TEAM_B_NAME);
    const rows = page.getByTestId("shell-roster-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-member-id", TEAM_B_MEMBER);
    await expect(rows.first().getByTestId("shell-roster-role")).toBeVisible();
  });

  test("AC-6: counts and the threshold match what the team's own member sees", async ({ page }) => {
    const read = async () => ({
      d21: await cell(page, "2026-09-21").getAttribute("data-count"),
      d22: await cell(page, "2026-09-22").getAttribute("data-count"),
      threshold: await page.getByTestId("month-threshold").getAttribute("data-threshold"),
      members: await page.getByTestId("month-threshold").getAttribute("data-current-members"),
    });

    await signInAt(page, MONTH_B, ADMIN_EMAIL);
    await monthReady(page);
    await expect(page.getByTestId("shell-viewing-other-team")).toBeVisible();
    const asAdmin = await read();

    await signOut(page);
    await signInAt(page, MONTH, OTHER_MEMBER_EMAIL);
    await monthReady(page);
    const asMember = await read();

    expect(asAdmin).toEqual(asMember);
    expect(Number(asAdmin.d21)).toBeGreaterThan(0);
  });

  test("AC-7: the selection survives the app's own navigation and a reload, and not leaving", async ({ page }) => {
    await signInAt(page, MONTH_B, ADMIN_EMAIL);
    await monthReady(page);

    await page.getByTestId("month-next").click();
    await expect(page).toHaveURL(new RegExp(`/month/2026-10\\?team=${TEAM_B}$`));

    await page.getByTestId("month-year").click();
    await expect(page).toHaveURL(new RegExp(`/year/2026\\?team=${TEAM_B}$`));

    await page.getByTestId("year-month-card-link").first().click();
    await expect(page).toHaveURL(new RegExp(`/month/2026-01\\?team=${TEAM_B}$`));

    await page.getByTestId("month-year").click();
    await page.getByTestId("year-week").click();
    await expect(page).toHaveURL(new RegExp(`/week/\\d{4}-\\d{2}-\\d{2}\\?team=${TEAM_B}$`));

    await page.reload();
    await expect(page.getByTestId("shell-viewing-other-team")).toBeVisible();
    expect(teamParam(page)).toBe(TEAM_B);

    await page.goto(`/month?team=${TEAM_B}`);
    await expect(page).toHaveURL(new RegExp(`/month/\\d{4}-\\d{2}\\?team=${TEAM_B}$`));
    await expect(page.getByTestId("shell-viewing-other-team")).toBeVisible();

    await page.getByTestId("nav-events-link").click();
    await expect(page).toHaveURL(/\/events$/);
    await page.getByTestId("shell-brand-logo").click();
    await expect(page.getByTestId("week-day").first()).toBeVisible();
    expect(teamParam(page)).toBeNull();
    await expect(page.getByTestId("shell-viewing-other-team")).toHaveCount(0);
    await expect(selectedOption(page)).toHaveAttribute("data-team-id", TEAM_A);
  });

  test("AC-8: the public holidays are the same national calendar on any team", async ({ page }) => {
    await signInAt(page, MONTH, ADMIN_EMAIL);
    await monthReady(page);
    const own = await holidayDates(page);

    await page.goto(MONTH_B);
    await monthReady(page);
    await expect(page.getByTestId("shell-viewing-other-team")).toBeVisible();
    expect(await holidayDates(page)).toEqual(own);
  });

  test("AC-9: no write affordance while another team is viewed, all back on the own team", async ({ page }) => {
    await signInAt(page, MONTH_B, ADMIN_EMAIL);
    await monthReady(page);

    await expect(page.getByTestId("shell-viewing-other-team")).toContainText(TEAM_B_NAME);
    await expect(page.getByTestId("home-new-entry-link")).toHaveCount(0);
    await expect(page.getByTestId("month-cell-busy")).toHaveCount(0);
    await cell(page, "2026-09-08").hover();
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByTestId("month-entry-panel")).toHaveCount(0);

    await page.goto(WEEK_B);
    await expect(page.getByTestId("shell-viewing-other-team")).toBeVisible();
    await expect(page.getByTestId("week-day").first()).toBeVisible();
    await expect(page.getByTestId("week-day-busy")).toHaveCount(0);

    await page.getByTestId("shell-back-to-own-team").click();
    await expect(page.getByTestId("shell-viewing-other-team")).toHaveCount(0);
    expect(teamParam(page)).toBeNull();
    await expect(page.getByTestId("home-new-entry-link")).toHaveCount(1);
    await expect(page.getByTestId("week-day-busy")).toHaveCount(7);

    await page.getByTestId("week-month").click();
    await monthReady(page);
    await cell(page, "2026-09-08").hover();
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByTestId("month-entry-panel")).toHaveCount(1);
  });

  test("AC-10: the admin-panel screens ignore the selection", async ({ page }) => {
    const screens: [string, () => Promise<string | null>][] = [
      ["/entries/pending", async () => String(await page.getByTestId("pending-entry-row").count())],
      ["/entries/team", async () => String(await page.getByTestId("team-entry-row").count())],
      ["/members", async () => String(await page.getByTestId("member-list-row").count())],
      ["/setting", () => page.getByTestId("threshold-current").getAttribute("data-threshold")],
    ];

    await signInAt(page, MONTH_B, ADMIN_EMAIL);
    await monthReady(page);

    for (const [path, measure] of screens) {
      await page.goto(path);
      await settled(page);
      const plain = await measure();

      await page.goto(`${path}?team=${TEAM_B}`);
      await settled(page);
      expect(await measure(), path).toBe(plain);
      await expect(page.getByTestId("shell-viewing-other-team")).toHaveCount(0);
      await expect(page.getByTestId("shell-roster-count")).toHaveAttribute("data-team-id", TEAM_A);
    }
  });

  test("AC-11: an address naming no other team falls back to the own team, and is cleaned", async ({ page }) => {
    await signInAt(page, MONTH, ADMIN_EMAIL);
    await monthReady(page);

    for (const value of ["not-a-uuid", "00000000-0000-4000-8000-000000000000", TEAM_A]) {
      await page.goto(`${MONTH}?team=${value}`);
      await monthReady(page);
      await expect.poll(() => teamParam(page), value).toBeNull();
      await expect(page.getByTestId("shell-viewing-other-team")).toHaveCount(0);
      await expect(selectedOption(page)).toHaveAttribute("data-team-id", TEAM_A);
      await expect(page.getByTestId("home-new-entry-link")).toHaveCount(1);
    }
  });
});
