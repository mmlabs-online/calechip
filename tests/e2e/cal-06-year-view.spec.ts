import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange } from "./support/entry-form";

// CAL-06 — the year view: one row per member across every day of the year.
//
// Written from 01-plan.md sections 2, 2b, 3, 4.1, 4.2 and 4.3. Every locator is a `data-testid` from
// the selector table in section 4.3; the two this file uses that are NOT in that table —
// `year-sign-in` and `home-year-link` — are declared in 03-impl-log.md § Deviations.
//
// **THE DIVISION OF LABOUR WITH tests/absence.test.ts IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts pure logic at the unit level and "a full acceptance
// criterion through the interface" at this one. So the DERIVATION behind AC-4, AC-6, AC-9 and AC-10
// is asserted there against `absentDatesByMember` directly, and this file asserts what a person
// SEES: the 365 columns, the row for somebody who declared nothing, the two types telling themselves
// apart, the totals strip, the address bar, and — the read-only denial — the controls that are not
// there. AC-9 and AC-10 appear in both, because a derivation that agrees with the count and a screen
// that draws it wrong are two different failures.
//
// **AC-7, AC-8 AND AC-14 ARE ASSERTED IN tests/absence.test.ts OR NOWHERE, AND THAT IS DECLARED IN
// 03-impl-log.md.** It is the same shape CAL-05 recorded for its AC-10, AC-11 and AC-15:
// - AC-7 (a rejected entry fills nothing) — nothing in the product can set `status` to `rejected`:
//   the insert grant excludes it, `entry_update_admin` excludes it, and ADM-05 does not exist.
// - AC-8 (a removed member's row stops on the removal day) — nothing can remove a member partway
//   through a displayed year either; TEA-04's control writes `removed_at` as `now()`.
// - AC-14 (a truncated read is refused) — a `>= MONTH_ENTRY_LIMIT` throw inside the seam. The mock's
//   entry table is bounded by the fixtures and cannot reach 2000 rows, and no test can make
//   PostgREST cap a read without a provisioned project.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the team scoping asserted below is the mock's reproduction of `entry_select_team`
// and `member_select_team`. This ticket ships no policy and no migration — every read it makes was
// already permitted (01-plan.md sections 3, 5 and 6).
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's tables and its session live in module memory
// and a `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links
// and by `page.goBack()`, both of which react-router handles client-side — the constraint every
// suite from CAL-01 onwards records.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql). THE ROSTER OF THE MAIN TEAM IS FIVE
// MEMBERS, which is what makes AC-3 observable: only one of them owns an entry in 2026.
// - Admin:      quan@example.com  (FIXTURE_ADMIN, "Quan tri", owl) — owns nothing
// - Member:     thanh@example.com (FIXTURE_MEMBER, "Thanh vien", cat) — owns nothing
// - Second admin: FIXTURE_SECOND_ADMIN — owns nothing, no credential
// - Approved:   linh@example.com  (FIXTURE_APPROVED_MEMBER) owns FIXTURE_APPROVED_ENTRY
// - Removed:    FIXTURE_REMOVED_MEMBER — removed 2026-08-31, owns nothing
// - Member-less: hoa@example.com (FIXTURE_MEMBER_LESS) has no member row at all
//
// FIXTURE_APPROVED_ENTRY runs 14 to 16 September 2026, is `full`, `pto` and `approved`.
// FIXTURE_OTHER_TEAM_ENTRY runs 21 to 22 September and belongs to the OTHER TEAM, which is what
// makes the emptiness asserted below scoping rather than an empty datastore.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";

// CAL-10, inside ADR-032 § Consequences item 1. **THE GRID MOVED ADDRESS AND NOTHING ELSE.**
// `/year/:yyyy` is the twelve-month OVERVIEW since CAL-10 and the per-member matrix this file is
// about is at `/year/:yyyy/members`. Every assertion below is the one CAL-06 shipped; only the
// address it is made at has changed, which is exactly what AC-1, AC-2, AC-13 and AC-14 were
// reworded to say (.ai/board/tickets/CAL-06/01-plan.md).
const YEAR = "/year/2026/members";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const SECOND_ADMIN_ID = "88888888-8888-4888-8888-888888888888";
const APPROVED_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REMOVED_MEMBER_ID = "77777777-7777-4777-8777-777777777777";

const ROSTER = [ADMIN_ID, MEMBER_ID, SECOND_ADMIN_ID, APPROVED_MEMBER_ID, REMOVED_MEMBER_ID];

const rowFor = (page: Page, memberId: string): Locator =>
  page.locator(`[data-testid="year-row"][data-member-id="${memberId}"]`);

const cellIn = (page: Page, memberId: string, date: string): Locator =>
  rowFor(page, memberId).locator(`[data-testid="year-cell"][data-date="${date}"]`);

/** The filled cells of one row — `data-type` is present only where the member is away (AC-4). */
const filledIn = (page: Page, memberId: string): Locator =>
  rowFor(page, memberId).locator('[data-testid="year-cell"][data-type]');

const totalFor = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="year-total"][data-date="${date}"]`);

/** Everybody with a filled cell in one date's column, read off the grid rather than off the model. */
async function drawnOn(page: Page, date: string): Promise<Set<string>> {
  const ids = await page
    .locator(`[data-testid="year-cell"][data-date="${date}"][data-type]`)
    .evaluateAll((nodes) =>
      nodes.map((node) => node.closest('[data-testid="year-row"]')?.getAttribute("data-member-id")),
    );
  return new Set(ids.filter((id): id is string => id !== null && id !== undefined));
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Walks history back to a year address. `page.goBack()` replays a react-router history entry, which
 *  is a popstate and not a reload — a `page.goto` would reset the mock's module state and lose both
 *  the session and every entry the test had created. */
async function backToYear(page: Page, path: string): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (new URL(page.url()).pathname === path) break;
    await page.goBack();
  }
}

/** Signed out on a year address, then signed in and back on it — without a document load. */
async function openYearAs(page: Page, email: string, path: string = YEAR): Promise<void> {
  await page.goto(path);
  await page.getByTestId("year-sign-in").click();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await backToYear(page, path);
  await expect(page.getByTestId("year-grid")).toBeVisible();
}

/** The same, starting on the MONTH address — its refusal offers `month-sign-in`, not `year-sign-in`.
 *  AC-12 begins there because the criterion is about arriving at the year FROM the month. */
async function openMonthAs(page: Page, email: string, path: string): Promise<void> {
  await page.goto(path);
  await page.getByTestId("month-sign-in").click();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await backToYear(page, path);
  await expect(page.getByTestId("month-anchor")).toBeVisible();
}

/** Declares one entry through CAL-01's form and returns to the year, all client-side. `owned` is how
 *  many entries the signed-in member will hold afterwards — the wait that proves the write landed. */
async function declare(
  page: Page,
  fields: { start: string; end: string; portion?: string; type?: string; tentative?: boolean },
  owned = 1,
): Promise<void> {
  const path = new URL(page.url()).pathname;

  // UIE-03 AC-12. The trip to the landing screen is deleted, not replaced: the create link is in
  // the TOP BAR and renders on the year itself.
  await page.getByTestId("home-new-entry-link").click();

  await pickRange(page, "new-entry", fields.start, fields.end);
  if (fields.portion) await choosePortion(page, "new-entry", fields.portion);
  if (fields.type) await chooseType(page, "new-entry", fields.type);
  if (fields.tentative) await page.getByTestId("new-entry-tentative").check();

  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(owned);

  await backToYear(page, path);
  await expect(page.getByTestId("year-grid")).toBeVisible();
}

test.describe("CAL-06 — year view", () => {
  test("AC-1: 365 day columns, anchored by the URL, January 1st to December 31st", async ({ page }) => {
    await openYearAs(page, MEMBER_EMAIL);

    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2026");

    // Every row carries the whole year, and so does the totals strip — the three grids share one
    // column template, so a mismatch here is a grid that has drifted out of alignment.
    await expect(rowFor(page, MEMBER_ID).getByTestId("year-cell")).toHaveCount(365);
    await expect(page.getByTestId("year-total")).toHaveCount(365);

    const dates = await page
      .getByTestId("year-total")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-date")));
    expect(dates[0]).toBe("2026-01-01");
    expect(dates[dates.length - 1]).toBe("2026-12-31");

    // The month ruler, so a column can be found without counting from January (01-plan.md § 4.3).
    await expect(page.getByTestId("year-month-label")).toHaveCount(12);
  });

  test("AC-2: a leap year renders 366 days, ending 2028-12-31", async ({ page }) => {
    await openYearAs(page, MEMBER_EMAIL, "/year/2028/members");

    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2028");
    await expect(page.getByTestId("year-total")).toHaveCount(366);
    await expect(rowFor(page, MEMBER_ID).getByTestId("year-cell")).toHaveCount(366);

    // February 29th exists and is a column of its own, which is the whole of the criterion.
    await expect(totalFor(page, "2028-02-29")).toHaveCount(1);
    await expect(cellIn(page, MEMBER_ID, "2028-12-31")).toHaveCount(1);
  });

  test("AC-3: one row per member, including the four who declared nothing", async ({ page }) => {
    await openYearAs(page, MEMBER_EMAIL);

    // FIVE ROWS FOR FIVE MEMBERS, and only one of them owns an entry in 2026. This is the criterion
    // the year view exists for: on the month grid and the week list the other four do not appear at
    // all, and a screen that omitted them would make "never away" and "not shown" the same picture.
    await expect(page.getByTestId("year-row")).toHaveCount(ROSTER.length);
    for (const memberId of ROSTER) {
      await expect(rowFor(page, memberId)).toHaveCount(1);
      await expect(rowFor(page, memberId).getByTestId("year-row-name")).toHaveCount(1);
      await expect(rowFor(page, memberId).getByTestId("year-row-avatar")).toHaveCount(1);
    }

    // A row with no filled cells rather than no row.
    await expect(filledIn(page, ADMIN_ID)).toHaveCount(0);
    await expect(rowFor(page, ADMIN_ID).getByTestId("year-cell")).toHaveCount(365);

    // And it is not vacuous: the one member who DOES own an entry has exactly its three days.
    await expect(filledIn(page, APPROVED_MEMBER_ID)).toHaveCount(3);
  });

  test("AC-4: a cell is filled exactly on the days that member is away", async ({ page }) => {
    await openYearAs(page, MEMBER_EMAIL);

    // The criterion's own dates: one PTO entry running 2026-03-02 to 2026-03-06.
    await declare(page, { start: "2026-03-02", end: "2026-03-06" });

    for (const date of ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]) {
      await expect(cellIn(page, MEMBER_ID, date)).toHaveAttribute("data-type", "pto");
    }
    // On no others — the days either side, and the whole rest of the year.
    await expect(cellIn(page, MEMBER_ID, "2026-03-01")).not.toHaveAttribute("data-type", /.*/);
    await expect(cellIn(page, MEMBER_ID, "2026-03-07")).not.toHaveAttribute("data-type", /.*/);
    await expect(filledIn(page, MEMBER_ID)).toHaveCount(5);
  });

  test("AC-5: PTO and WFH state their own type rather than both reading as absent", async ({ page }) => {
    // FIXTURE_APPROVED_ENTRY is `pto` on 15 September; this puts a `wfh` day beside it, owned by
    // somebody else, so the two are on one column and can be compared there.
    await openYearAs(page, MEMBER_EMAIL);
    await declare(page, { start: "2026-09-15", end: "2026-09-15", type: "wfh" });

    await expect(cellIn(page, APPROVED_MEMBER_ID, "2026-09-15")).toHaveAttribute("data-type", "pto");
    await expect(cellIn(page, MEMBER_ID, "2026-09-15")).toHaveAttribute("data-type", "wfh");

    // TWO DIFFERENT VALUES, and not both merely reading as absent — which is the whole criterion. A
    // WFH member IS working, and glossary.md calls conflating the two the most costly confusion in
    // the domain.
    const types = await page
      .locator('[data-testid="year-cell"][data-date="2026-09-15"][data-type]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-type")));
    expect(new Set(types)).toEqual(new Set(["pto", "wfh"]));
  });

  test("AC-6 and INV-05: a tentative entry fills its cells, and is additionally marked", async ({ page }) => {
    await openYearAs(page, MEMBER_EMAIL);
    await declare(page, { start: "2026-05-04", end: "2026-05-06", tentative: true });

    // Filled on exactly the same terms as any other entry — three days, carrying a type.
    await expect(filledIn(page, MEMBER_ID)).toHaveCount(3);
    for (const date of ["2026-05-04", "2026-05-05", "2026-05-06"]) {
      await expect(cellIn(page, MEMBER_ID, date)).toHaveAttribute("data-type", "pto");
      // And additionally marked. A one-day-wide cell has no room for a label, so the marking is
      // there for a screen reader as well as for this assertion.
      await expect(cellIn(page, MEMBER_ID, date).getByTestId("year-cell-tentative")).toHaveCount(1);
    }

    // The settled entry beside it carries no marking at all, rather than an empty one — otherwise
    // "is away" and "is settled" would be the same cell.
    await expect(
      cellIn(page, APPROVED_MEMBER_ID, "2026-09-15").getByTestId("year-cell-tentative"),
    ).toHaveCount(0);
  });

  test("AC-9 and AC-10: the totals are the month grid's numbers, and they match the filled cells", async ({ page }) => {
    await openYearAs(page, MEMBER_EMAIL);

    // Two people away on 15 September: FIXTURE_APPROVED_ENTRY, plus a MORNING declared here — so the
    // total under test is 1.5, which is the number that separates "counts the people" from "counts
    // the day". A criterion asserted against 1 and 1 would pass on either.
    await declare(page, { start: "2026-09-15", end: "2026-09-15", portion: "am" });

    // AC-10. Every member with a filled cell contributes, and no member without one does.
    expect(await drawnOn(page, "2026-09-15")).toEqual(new Set([APPROVED_MEMBER_ID, MEMBER_ID]));
    await expect(totalFor(page, "2026-09-15")).toHaveAttribute("data-count", "1.5");

    // A day nobody is away on carries a zero rather than no attribute: a missing total and a zero
    // are different answers, and only one of them is true here.
    expect(await drawnOn(page, "2026-09-18")).toEqual(new Set());
    await expect(totalFor(page, "2026-09-18")).toHaveAttribute("data-count", "0");

    // AC-9. THE ASSERTION THAT MATTERS, because a divergence between the year and the month is
    // invisible on either screen alone: the same date, read off both, is the same number.
    await page.getByTestId("year-month").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-01");
    await page.getByTestId("month-next").click();
    for (let step = 0; step < 7; step += 1) await page.getByTestId("month-next").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-09");

    await expect(
      page.locator('[data-testid="month-cell"][data-date="2026-09-15"]'),
    ).toHaveAttribute("data-count", "1.5");

    // And the same SET of people, so the two screens agree about who as well as about how many.
    const drawn = await page
      .locator('[data-testid="month-cell"][data-date="2026-09-15"]')
      .getByTestId("month-avatar")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-member-id")));
    expect(new Set(drawn)).toEqual(new Set([APPROVED_MEMBER_ID, MEMBER_ID]));
  });

  test("AC-11: moving between years, and switching views, keeps the year", async ({ page }) => {
    await openYearAs(page, MEMBER_EMAIL);

    await page.getByTestId("year-prev").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2025");
    await expect(totalFor(page, "2025-12-31")).toHaveCount(1);

    await page.getByTestId("year-next").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2026");
    await page.getByTestId("year-next").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2027");

    // The address alone produces the same screen, so a year can be shared or bookmarked. CAL-10
    // AC-16: the `/members` suffix survives every step, so a member stepping years on the matrix
    // stays on the matrix instead of silently arriving at the overview.
    await expect(page).toHaveURL(/\/year\/2027\/members$/);

    // And the month link opens on a month of the year just left, rather than on today's month.
    await page.getByTestId("year-month").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2027-01");
  });

  test("AC-12: the year is reachable from the month and from the week, and returns to the month", async ({ page }) => {
    await openMonthAs(page, MEMBER_EMAIL, "/month/2026-09");

    // Reached from the MONTH, on the year containing the month being looked at.
    await page.getByTestId("month-year").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2026");

    // The link back, which is what makes the three views a set rather than three addresses.
    await page.getByTestId("year-month").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-01");

    // Reached from the WEEK, on the year containing the day in the URL.
    await page.getByTestId("month-week").click();
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await page.getByTestId("week-year").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2026");

    // And from the sidebar, for both roles — the link is not an affordance over a policy, because
    // nothing on this screen is refused. UIE-03 AC-12 deleted the step onto the landing screen that
    // used to precede this click; the sidebar link renders everywhere inside the shell, so the
    // assertion below is reached the same way.
    await page.getByTestId("home-year-link").click();
    // CAL-10. The sidebar link is UNTOUCHED and still points at `/year`, which is the OVERVIEW since
    // ADR-032 made it the default year screen. The criterion is that the link reaches the year, and
    // it does; which of the two year screens it lands on is ADR-032's decision and not CAL-06's.
    await expect(page.getByTestId("year-overview")).toBeVisible();
  });

  test("AC-13: no session and no member row both land on the member-less state", async ({ page }) => {
    // The route is NOT guarded, deliberately (App.tsx): the screen reads, so it refuses in place and
    // says why. A redirect would leave somebody who followed a shared year link with nothing to read.
    await page.goto(YEAR);
    await expect(page.getByTestId("year-not-on-a-team")).toBeVisible();
    await expect(page.getByTestId("year-grid")).toHaveCount(0);
    // The way out is the sign-in link, which is what "sent to sign in" means on a screen that
    // refuses in place.
    await expect(page.getByTestId("year-sign-in")).toBeVisible();

    // A signed-in caller with NO MEMBER ROW reaches the same state, and correctly: there is no team
    // whose year this could be. `member_team_id` filters `removed_at is null` inside its own body,
    // so a removed member lands here too.
    await page.getByTestId("year-sign-in").click();
    await signIn(page, MEMBER_LESS_EMAIL);
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();
    await backToYear(page, YEAR);
    await expect(page.getByTestId("year-not-on-a-team")).toBeVisible();
    await expect(page.getByTestId("year-grid")).toHaveCount(0);
  });

  test("INV-07 and the read-only denial: an admin sees exactly what a member sees, and no control", async ({ page }) => {
    await openYearAs(page, ADMIN_EMAIL);

    // INV-07. FIXTURE_OTHER_TEAM_ENTRY runs 21 to 22 September and belongs to the other team, so
    // those columns are empty here — and the other team's member has no row at all. A one-team
    // fixture could not make this assertion.
    expect(await drawnOn(page, "2026-09-21")).toEqual(new Set());
    await expect(totalFor(page, "2026-09-21")).toHaveAttribute("data-count", "0");
    await expect(page.getByTestId("year-row")).toHaveCount(ROSTER.length);

    // The three days the caller's own team IS away are still drawn, so the emptiness above is
    // scoping rather than a screen that draws nothing.
    await expect(filledIn(page, APPROVED_MEMBER_ID)).toHaveCount(3);

    // And there is no control of any kind — for either role, since the screen branches on neither.
    // 01-plan.md section 3 names this the weakest mechanism in the plan: the denial is held by
    // ABSENCE, and this is where the absence is checked rather than assumed.
    await expect(page.locator('[data-testid="year-grid"] button')).toHaveCount(0);
    await expect(page.locator('[data-testid="year-grid"] input')).toHaveCount(0);
    await expect(page.locator('[data-testid="year-grid"] select')).toHaveCount(0);
    await expect(page.locator('[data-testid="year-grid"] textarea')).toHaveCount(0);
    await expect(page.locator('[data-testid="year-grid"] form')).toHaveCount(0);
    // No route out of a cell either: every link on this screen is in the header, where it is
    // navigation and not action.
    await expect(page.locator('[data-testid="year-grid"] a')).toHaveCount(0);
    // And no overload state anywhere — `seam.getTeam()` is not called, so there is no threshold to
    // compare against and no colour this ticket has not designed (01-plan.md section 4.2).
    await expect(page.getByTestId("month-threshold")).toHaveCount(0);
  });
});
