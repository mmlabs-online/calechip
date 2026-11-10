import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion } from "./support/entry-form";

// CAL-04 — the month grid: who is away on each day, and which days are crowded.
//
// Written from 01-plan.md sections 2, 2b and 4. Every locator is a `data-testid` declared in
// 03-impl-log.md, since 01-plan.md carries no selector table for this ticket.
//
// **THE DIVISION OF LABOUR WITH tests/absence.test.ts IS DELIBERATE AND IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts pure logic at the unit level and "a full acceptance
// criterion through the interface" at this one. So AC-3's arithmetic, AC-4, AC-5, AC-6 and AC-8 are
// asserted there against `absenceCountsFor` directly, and this file asserts what a person SEES:
// the grid, the avatars, the crowded day, the address bar and the drag. AC-3 and AC-7 appear in
// both, because a half-day that sums correctly and renders as a whole one is still a wrong screen.
//
// **AC-11 IS NOT ASSERTED ANYWHERE AND THAT IS DECLARED IN 03-impl-log.md.** The truncation refusal
// is a `>= MONTH_ENTRY_LIMIT` throw in both implementations; the mock's entry table is bounded by
// the fixtures and cannot reach 2000 rows, and no test can make PostgREST cap a read without a
// provisioned project. It is the same untested shape ROSTER_LIMIT, OWN_ENTRY_LIMIT and
// TEAM_ENTRY_LIMIT already carry.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the team scoping asserted below is the mock's reproduction of `entry_select_team`
// and `team_select_own`. The real policies are in
// supabase/migrations/20260904100000_cal04_team_select.sql and are exercised by no test until a
// project is provisioned.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's entry table lives in module memory and a
// `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links and
// by `page.goBack()`, both of which react-router handles client-side — the constraint CAL-01's,
// CAL-02's and CAL-03's suites all record.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:      quan@example.com  (FIXTURE_ADMIN, avatar owl)
// - Member:     thanh@example.com (FIXTURE_MEMBER, avatar cat)
// - 2nd admin:  dung@example.com  (FIXTURE_SECOND_ADMIN, avatar fox)
// - Approved:   linh@example.com  (FIXTURE_APPROVED_MEMBER, owns FIXTURE_APPROVED_ENTRY)
// - Other team: chi@other.example.com (FIXTURE_OTHER_TEAM_MEMBER, owns FIXTURE_OTHER_TEAM_ENTRY)
//
// FIXTURE_TEAM has FOUR members with `removed_at is null` and an `overload_threshold` of 0.5, so a
// day is crowded above 2.0. FIXTURE_APPROVED_ENTRY already puts 1.0 on 14, 15 and 16 September.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const SECOND_ADMIN_EMAIL = "dung@example.com";

const MONTH = "/month/2026-09";

// FIXTURE_APPROVED_MEMBER's id and avatar, transcribed rather than imported: the acceptance suite
// addresses the application through the browser and does not import from src/.
const APPROVED_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_TEAM_MEMBER_ID = "66666666-6666-4666-8666-666666666666";

const cell = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="month-cell"][data-date="${date}"]`);

const avatarsIn = (page: Page, date: string): Locator =>
  cell(page, date).getByTestId("month-avatar");

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Walks history back to the month grid. `page.goBack()` replays a react-router history entry, which
 *  is a popstate and not a reload — a `page.goto` would reset the mock's module state and lose every
 *  entry the test had created, which is the whole reason the setup can span three accounts. */
async function backToMonth(page: Page): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (new URL(page.url()).pathname === MONTH) break;
    await page.goBack();
  }
  await expect(page.getByTestId("month-grid")).toBeVisible();
}

/** Signed out, on the month grid, then signed in and back on it — without a document load. */
async function openMonthAs(page: Page, email: string): Promise<void> {
  await page.goto(MONTH);
  await page.getByTestId("month-sign-in").click();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await backToMonth(page);
}

/** Ends the session and starts another, all client-side, and returns to the grid. */
async function switchTo(page: Page, email: string): Promise<void> {
  // UIE-03 AC-12. The click on the landing-screen link is deleted, and NO shell control stands in
  // for it: sign-out is a SIDEBAR control now and is clicked wherever the caller already stands.
  //
  // **`goForward` is here because that click also pushed a HISTORY ENTRY, and `backToMonth` below
  // walks history.** Signing out and signing back in each REPLACE the current entry rather than
  // pushing one, so from the grid alone the walk back would find `about:blank` behind it and the
  // grid would be unreachable — the collateral AC-12's first clause contemplates. Stepping forward
  // into the entry `openMonthAs` left in FRONT of the grid restores the depth the walk needs without
  // clicking anything, which is why it is a harness call and not a navigation.
  await page.goForward();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();

  await page.getByTestId("home-sign-out").click();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await backToMonth(page);
}

/** Drags across the grid and releases, which is what opens the form (AC-13). */
async function dragAcross(page: Page, from: string, to: string): Promise<void> {
  await cell(page, from).hover();
  await page.mouse.down();
  await cell(page, to).hover();
  await page.mouse.up();
}

/** SOLO, 2026-09-10. One cell of the entry form's day picker. `.first()` because the grid draws
 *  whole weeks, so a date at a month boundary can appear on two of them. */
const dayCell = (page: Page, prefix: string, date: string) =>
  page.locator(`[data-testid="${prefix}-day"][data-date="${date}"]`).first();

test.describe("CAL-04 — month view", () => {
  test("AC-1: the grid renders every date of the month in the URL, exactly once", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL);

    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-09");

    // Whole weeks, Monday first: 1 September 2026 is a Tuesday and 30 September a Wednesday, so the
    // grid is five rows of seven with one leading cell and four trailing ones.
    await expect(page.getByTestId("month-cell")).toHaveCount(35);
    await expect(page.locator('[data-testid="month-cell"][data-in-month="true"]')).toHaveCount(30);

    for (const date of ["2026-09-01", "2026-09-15", "2026-09-30"]) {
      await expect(cell(page, date)).toHaveCount(1);
      await expect(cell(page, date)).toHaveAttribute("data-in-month", "true");
    }

    // The leading and trailing cells are out-of-month: no avatars and no overload state.
    const outside = page.locator('[data-testid="month-cell"][data-in-month="false"]');
    await expect(outside).toHaveCount(5);
    await expect(outside.getByTestId("month-avatar")).toHaveCount(0);
    await expect(cell(page, "2026-08-31")).toHaveAttribute("data-overloaded", "false");
    await expect(cell(page, "2026-10-01")).toHaveAttribute("data-overloaded", "false");
  });

  test("AC-2: an absent member's avatar appears on every date their entry covers", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL);

    // FIXTURE_APPROVED_ENTRY runs 14 to 16 September inclusive.
    for (const date of ["2026-09-14", "2026-09-15", "2026-09-16"]) {
      await expect(
        cell(page, date).locator(`[data-testid="month-avatar"][data-member-id="${APPROVED_MEMBER_ID}"]`),
      ).toHaveCount(1);
      await expect(cell(page, date)).toHaveAttribute("data-count", "1");
    }

    await expect(avatarsIn(page, "2026-09-13")).toHaveCount(0);
    await expect(avatarsIn(page, "2026-09-17")).toHaveCount(0);
    await expect(cell(page, "2026-09-13")).toHaveAttribute("data-count", "0");
  });

  test("AC-12: no entry and no avatar from another team is drawn", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL);

    // FIXTURE_OTHER_TEAM_ENTRY runs 21 to 22 September and belongs to the other team. Those two days
    // must be empty — this is the assertion `entry_select_team` exists for, and the one a one-team
    // fixture could not make.
    for (const date of ["2026-09-21", "2026-09-22"]) {
      await expect(cell(page, date)).toHaveAttribute("data-count", "0");
      await expect(avatarsIn(page, date)).toHaveCount(0);
    }
    await expect(
      page.locator(`[data-testid="month-avatar"][data-member-id="${OTHER_TEAM_MEMBER_ID}"]`),
    ).toHaveCount(0);
  });

  test("AC-9: a month with no entries renders empty rather than as an error", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL);

    // November 2026 holds no fixture entry at all.
    await page.getByTestId("month-next").click();
    await page.getByTestId("month-next").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-11");

    await expect(page.getByTestId("month-empty")).toBeVisible();
    await expect(page.getByTestId("month-avatar")).toHaveCount(0);
    await expect(page.getByTestId("month-loading")).toHaveCount(0);
    await expect(page.getByTestId("month-unavailable")).toHaveCount(0);
    await expect(cell(page, "2026-11-16")).toHaveAttribute("data-count", "0");
    await expect(cell(page, "2026-11-16")).toHaveAttribute("data-overloaded", "false");
  });

  test("AC-10: the anchor is the URL, both ways", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL);

    await page.getByTestId("month-next").click();
    await expect(page).toHaveURL(/\/month\/2026-10$/);
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-10");

    await page.getByTestId("month-prev").click();
    await expect(page).toHaveURL(/\/month\/2026-09$/);

    // The other direction: the address alone produces the same screen, so a month can be shared.
    await page.goto("/month/2026-10");
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-10");
  });

  test("AC-13: drag-select opens the entry form with the dates pre-filled, and writes nothing", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL);

    await expect(page.getByTestId("month-entry-form")).toHaveCount(0);
    await dragAcross(page, "2026-09-06", "2026-09-08");

    await expect(page.getByTestId("month-entry-form")).toBeVisible();

    // SOLO, 2026-09-10. The two date inputs became a month grid, so "pre-filled" is now three days
    // drawn as chosen rather than two values. The criterion is unchanged: the drag reaches the form,
    // and it reaches it carrying exactly the dragged dates and nothing either side of them.
    for (const date of ["2026-09-06", "2026-09-07", "2026-09-08"]) {
      await expect(dayCell(page, "month-entry", date)).toHaveAttribute("data-selected", "true");
    }
    await expect(dayCell(page, "month-entry", "2026-09-05")).toHaveAttribute("data-selected", "false");
    await expect(dayCell(page, "month-entry", "2026-09-09")).toHaveAttribute("data-selected", "false");

    // Nothing has been written: the three days are still empty behind the form.
    for (const date of ["2026-09-06", "2026-09-07", "2026-09-08"]) {
      await expect(cell(page, date)).toHaveAttribute("data-count", "0");
      await expect(avatarsIn(page, date)).toHaveCount(0);
    }

    await page.getByTestId("month-entry-cancel").click();
    await expect(page.getByTestId("month-entry-form")).toHaveCount(0);
  });

  test("AC-14: the threshold is read and shown, and no control on this screen changes it", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL);

    // The overload state is computed at all, which is only possible if `overload_threshold` was read
    // — rbac-and-security.md:47 grants that read to both roles, and this member is not an admin.
    const threshold = page.getByTestId("month-threshold");
    await expect(threshold).toHaveAttribute("data-threshold", "0.5");
    await expect(threshold).toHaveAttribute("data-current-members", "4");

    // And nothing anywhere on the screen could change it. `Set the overload threshold` is ADM-01's,
    // and this ticket's migration grants no `update` on `public.team` to anybody.
    await expect(threshold.locator("input, select, button")).toHaveCount(0);
    await expect(page.locator('[data-testid="month-grid"] input')).toHaveCount(0);
  });

  test("AC-3 and AC-7: a half day is 0.5, and a day is crowded only ABOVE the threshold", async ({ page }) => {
    // FIXTURE_TEAM has four active members at a threshold of 0.5, so a day is crowded above 2.0.
    // FIXTURE_APPROVED_ENTRY already puts 1.0 on 15 September.
    await openMonthAs(page, MEMBER_EMAIL);
    await expect(cell(page, "2026-09-15")).toHaveAttribute("data-count", "1");

    // A second full day takes it to exactly 2.0 — the threshold, and NOT over it. This is the half
    // of AC-7 that a `>=` comparison would fail, and it is asserted before the crowded case so a
    // regression there cannot hide behind the one after it.
    await dragAcross(page, "2026-09-15", "2026-09-15");
    await page.getByTestId("month-entry-submit").click();
    await expect(cell(page, "2026-09-15")).toHaveAttribute("data-count", "2");
    await expect(cell(page, "2026-09-15")).toHaveAttribute("data-overloaded", "false");

    // A MORNING from a third member adds 0.5, not 1 — AC-3 through the interface — and 2.5 is over
    // the threshold, so the day is drawn crowded.
    await switchTo(page, SECOND_ADMIN_EMAIL);
    await dragAcross(page, "2026-09-15", "2026-09-15");
    await choosePortion(page, "month-entry", "am");
    await page.getByTestId("month-entry-submit").click();

    await expect(cell(page, "2026-09-15")).toHaveAttribute("data-count", "2.5");
    await expect(cell(page, "2026-09-15")).toHaveAttribute("data-overloaded", "true");
    await expect(avatarsIn(page, "2026-09-15")).toHaveCount(3);

    // And the neighbouring day, which nobody added to, is untouched — so the assertion above is
    // about that date and not about the grid having turned crowded everywhere.
    await expect(cell(page, "2026-09-17")).toHaveAttribute("data-count", "0");
    await expect(cell(page, "2026-09-17")).toHaveAttribute("data-overloaded", "false");
  });
});
