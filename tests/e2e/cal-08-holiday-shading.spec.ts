import { expect, test, type Locator, type Page } from "@playwright/test";

// CAL-08 — holidays and bridge days drawn in the month, week and year grids.
//
// Written from 01-plan.md sections 2, 2b, 3, 4.2, 4.3 and 4.4. Every locator is a `data-testid` from
// the selector table in section 4.4; the ones this file uses that are NOT in that table —
// `month-sign-in`, `week-sign-in`, `year-sign-in`, `home-week-link`, `home-year-link`,
// `home-holidays-link`, `shell-admin-link`, `admin-hub-threshold-link`, `holiday-add-*`,
// `threshold-*` — belong to CAL-04,
// CAL-05, CAL-06, ADM-01 and ADM-03 and are declared in 03-impl-log.md § Deviations.
//
// **THE DIVISION OF LABOUR WITH tests/day-status.test.ts IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts pure logic at the unit level and "a full acceptance
// criterion through the interface" at this one. So the DERIVATION behind AC-1 to AC-4 is asserted
// there against `dayStatusesFor` directly, and this file asserts what a person SEES: the lavender
// cell and the name in it, the bridge badge that is deliberately not lavender, the strip under the
// year's month ruler, the sentence an empty year says, and — AC-13 — the controls that are not
// there. AC-1 to AC-4 appear in both, because a derivation that is right and a screen that draws it
// wrong are two different failures.
//
// **AC-5, AC-12 AND AC-15 ARE ASSERTED IN tests/day-status.test.ts OR NOWHERE, AND THAT IS DECLARED
// IN 03-impl-log.md.** It is the same shape CAL-05 recorded for its AC-10, AC-11 and AC-15 and
// CAL-06 for its AC-7, AC-8 and AC-14:
// - AC-5 (bridge-ness at the first and last day of the range) is invisible here BY CONSTRUCTION: all
//   three views pad their own read, so a screen that got it wrong would look right. The unit test
//   asserts both directions, including that the bare range answers wrongly.
// - AC-12 (a failed or truncated holiday read shows no shading and says so) is a throw inside the
//   seam. The mock's holiday table holds five rows at most in this file and cannot reach
//   `HOLIDAY_LIMIT`, and no test can make PostgREST cap a read without a provisioned project. The
//   BRANCH is the `unavailable` state each view already renders and each earlier suite already
//   covers; what is untested is the throw reaching it.
// - AC-15 (the answer does not depend on the machine's timezone) needs the process timezone changed
//   under the derivation, which a browser test cannot do.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise). This ticket ships no policy and no migration — `holiday_select_all` is ADM-02's and
// admits both roles, which is why AC-13's two halves are identical rather than a permission test
// (01-plan.md sections 3, 5 and 6).
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's tables and its session live in module memory
// and a `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links
// and by `page.goBack()`, both of which react-router handles client-side — the constraint every
// suite from CAL-01 onwards records. Two tests below EXPLOIT that reset rather than working around
// it: AC-13 opens the same address twice as two different people, which is safe precisely because
// nothing either of them did is meant to survive.
//
// Holiday fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql). ADM-02 shipped the four
// rows ADR-015 § 5 specified and THIS TICKET ADDS NONE — every weekday below was computed there
// rather than recalled, and tests/day-status.test.ts asserts them again so a wrong one fails at the
// unit level rather than here:
// - 2026-06-11 Thursday, `non_working`, "Ngày lễ thử nghiệm"
// - 2026-06-13 Saturday, `working`,     "Làm bù thử nghiệm"    — the mandated swap day
// - 2026-06-15 Monday,   `non_working`, "Nghỉ bù thử nghiệm"
// - 2026-10-15 Thursday, `non_working`, "Ngày nghỉ thử nghiệm" — Friday the 16th is the bridge day
// - 2027 carries NO ROW AT ALL, which is AC-8's fixture.
//
// Member fixtures: FIXTURE_APPROVED_ENTRY runs 14 to 16 September 2026, is `full`, `pto` and
// `approved`, and its owner is the only person away in that month. The team's `overloadThreshold` is
// 0.5 and four of the five members are active, so one person away is NOT crowded — which is why
// AC-10 lowers the threshold through ADM-01's control rather than moving three people.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const ADMIN_EMAIL = "quan@example.com";

const OCTOBER = "/month/2026-10";
const JUNE = "/month/2026-06";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const HOLIDAY_BRIDGED_NAME = "Ngày nghỉ thử nghiệm"; // 2026-10-15
const HOLIDAY_THURSDAY_NAME = "Ngày lễ thử nghiệm"; // 2026-06-11
const HOLIDAY_WORKING_SATURDAY_NAME = "Làm bù thử nghiệm"; // 2026-06-13
const HOLIDAY_COMPENSATORY_NAME = "Nghỉ bù thử nghiệm"; // 2026-06-15

/** The controls ADM-03 puts on `/holidays`. AC-13 asserts every one of them is absent from all
 *  three calendar views, for BOTH roles — the denial this ticket holds by absence. */
const HOLIDAY_CONTROLS = [
  "holiday-add-form",
  "holiday-add-submit",
  "holiday-edit-form",
  "holidays-row-edit",
  "holidays-row-delete",
];

const monthCell = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="month-cell"][data-date="${date}"]`);

const weekDay = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="week-day"][data-date="${date}"]`);

const yearDay = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="year-daystatus-cell"][data-date="${date}"]`);

/** The two attributes every one of the three surfaces carries, read off the drawn element. */
async function statusOf(cell: Locator): Promise<{ status: string | null; bridge: string | null }> {
  return {
    status: await cell.getAttribute("data-day-status"),
    bridge: await cell.getAttribute("data-bridge"),
  };
}

/**
 * Signs out if anybody is signed in, so the next `page.goto` reaches a signed-out screen.
 *
 * A DOCUMENT LOAD RESETS THE MOCK'S TABLES BUT NOT ITS SESSION: `src/lib/data/mock.ts` writes the
 * session to `localStorage`, exactly as `@supabase/auth-js` does by default, and restores it on
 * load. Discovered by running this suite rather than assumed — without this, the second person in
 * AC-13 arrives already signed in as the first.
 */
async function signOutIfSignedIn(page: Page): Promise<void> {
  await page.goto("/");
  if ((await page.getByTestId("home-sign-out").count()) > 0) {
    await page.getByTestId("home-sign-out").click();
  }
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/**
 * MIR-15-e, ADR-079 decision 5. Since MIR-15-b an admin of Org public is refused every holiday
 * write (`and not public.org_is_shared(org_id)` on all three policies), and the two tests below
 * that call `addHoliday` need that write to succeed — so Quan is placed in the mock's dedicated
 * org, through `DEDICATED_ORG_STORAGE_KEY` (`src/lib/data/mock.ts`), read once at module load.
 * MUST BE CALLED BEFORE THE FIRST `page.goto` (here, inside `openAs`) — the same ordering
 * constraint `signOutIfSignedIn`'s neighbour `openAs` already has for the session key.
 */
async function placeAdminInDedicatedOrg(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      "calechip.mock.dedicatedOrgMembers",
      JSON.stringify(["22222222-2222-4222-8222-222222222222"]),
    );
  });
}

/** Walks history back to an address. `page.goBack()` replays a react-router history entry, which is
 *  a popstate and not a reload — a `page.goto` would reset the mock's module state and lose both the
 *  session and every row the test had added. */
async function backTo(page: Page, path: string): Promise<void> {
  for (let step = 0; step < 12; step += 1) {
    if (new URL(page.url()).pathname === path) break;
    await page.goBack();
  }
  expect(new URL(page.url()).pathname).toBe(path);
}

/** What each view draws once it is ready, so `openAs` waits on the right thing for each of them. */
const READY: Record<"month" | "week" | "year", string> = {
  month: "month-grid",
  week: "week-anchor",
  year: "year-grid",
};

/** Signed out on a calendar address, then signed in and back on it — without a document load. The
 *  refusal on each of the three offers its OWN sign-in link, which is why the prefix is a parameter. */
async function openAs(
  page: Page,
  prefix: "month" | "week" | "year",
  email: string,
  path: string,
): Promise<void> {
  await page.goto(path);
  await page.getByTestId(`${prefix}-sign-in`).click();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await backTo(page, path);
  await expect(page.getByTestId(READY[prefix])).toBeVisible();
}

/**
 * Adds one row through ADM-03's form, from the home screen, and returns to the home screen.
 *
 * `expectedRows` is the count the list must reach — the wait that proves the write landed, in the
 * shape CAL-06's `declare` helper already uses. The seeded calendar holds four rows in 2026, so the
 * first add makes five.
 */
async function addHoliday(
  page: Page,
  date: string,
  name: string,
  expectedRows: number,
): Promise<void> {
  // SOLO 2026-09-12. The operator moved Public holidays into the admin panel, so an admin no longer
  // has `home-holidays-link` in the sidebar. This walks the strip instead: standing on another admin
  // screen the tab is already there, and standing on the calendar the top-bar control opens the hub
  // first. Both are client-side, so the mock's tables survive.
  {
    const tab = page.getByTestId("admin-hub-holidays-link");
    if ((await tab.count()) === 0) await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-holidays-link").click();
  }
  await expect(page.getByTestId("holiday-add-form")).toBeVisible();

  await page.getByTestId("holiday-add-date").fill(date);
  await page.getByTestId("holiday-add-name").fill(name);
  await page.getByTestId("holiday-add-kind").selectOption("non_working");
  await page.getByTestId("holiday-add-submit").click();

  // The row is in the year on screen, so it appears in the list rather than behind
  // `holidays-added-elsewhere` — asserted, because a silent add would leave every check below
  // passing against the seeded calendar.
  await expect(page.getByTestId("holidays-row")).toHaveCount(expectedRows);
  // UIE-03 AC-12. The back-link step is deleted and NOT replaced, so this helper now RETURNS ON THE
  // HOLIDAYS SCREEN. Both callers follow it with `backTo`, which walks history until the pathname
  // matches and is therefore indifferent to how many entries were pushed.
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

test.describe("CAL-08 — holidays and bridge days in the calendar views", () => {
  test("AC-1: a non-working holiday is drawn as a holiday in the month grid, and named", async ({
    page,
  }) => {
    await openAs(page, "month", MEMBER_EMAIL, OCTOBER);

    const holiday = monthCell(page, "2026-10-15");
    await expect(holiday).toHaveAttribute("data-day-status", "holiday");
    await expect(holiday.getByTestId("month-cell-holiday")).toHaveText(HOLIDAY_BRIDGED_NAME);
    await expect(holiday.getByTestId("month-cell-holiday")).toHaveAttribute(
      "data-kind",
      "non_working",
    );

    // And every other in-month day of that week is not. The Saturday and the Sunday are `weekend`
    // rather than `holiday`, which is the distinction `nonWorkingReason` exists to carry: neither
    // has a row, neither is named, and neither is drawn the way the 15th is.
    for (const date of ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16"]) {
      await expect(monthCell(page, date)).toHaveAttribute("data-day-status", "working");
      await expect(monthCell(page, date).getByTestId("month-cell-holiday")).toHaveCount(0);
    }
    for (const date of ["2026-10-17", "2026-10-18"]) {
      await expect(monthCell(page, date)).toHaveAttribute("data-day-status", "weekend");
      await expect(monthCell(page, date).getByTestId("month-cell-holiday")).toHaveCount(0);
    }
  });

  test("AC-2: a mandated working Saturday is drawn as a working day, and is named", async ({
    page,
  }) => {
    await openAs(page, "month", MEMBER_EMAIL, JUNE);

    // `kind` names the effect on the working calendar and not the Vietnamese label (ADR-015 § 2), so
    // this row is NAMED like any other and is NOT drawn as a holiday.
    const swapDay = monthCell(page, "2026-06-13");
    await expect(swapDay).toHaveAttribute("data-day-status", "working");
    await expect(swapDay.getByTestId("month-cell-holiday")).toHaveText(
      HOLIDAY_WORKING_SATURDAY_NAME,
    );
    await expect(swapDay.getByTestId("month-cell-holiday")).toHaveAttribute("data-kind", "working");

    // The Saturday before it, with no row, is an ordinary weekend — so the attribute above is the
    // row's doing and not the weekday's.
    await expect(monthCell(page, "2026-06-06")).toHaveAttribute("data-day-status", "weekend");

    // The other two June rows, both `non_working`, so the month shows all three kinds at once.
    await expect(monthCell(page, "2026-06-11").getByTestId("month-cell-holiday")).toHaveText(
      HOLIDAY_THURSDAY_NAME,
    );
    await expect(monthCell(page, "2026-06-15").getByTestId("month-cell-holiday")).toHaveText(
      HOLIDAY_COMPENSATORY_NAME,
    );
  });

  test("AC-3: a bridge day is marked, is a working day, and takes none of the holiday treatment", async ({
    page,
  }) => {
    await openAs(page, "month", MEMBER_EMAIL, OCTOBER);

    const bridge = monthCell(page, "2026-10-16");
    await expect(bridge).toHaveAttribute("data-bridge", "true");
    // A BRIDGE DAY IS A WORKING DAY (glossary.md), and the feature row calls this "the boundary a
    // well-meaning developer will cross": it gets no lavender, is named nothing, and its status is
    // `working` and not a fourth value.
    await expect(bridge).toHaveAttribute("data-day-status", "working");
    await expect(bridge.getByTestId("month-cell-bridge")).toHaveCount(1);
    await expect(bridge.getByTestId("month-cell-holiday")).toHaveCount(0);

    // The holiday that creates it is not itself a bridge day, and carries no badge.
    await expect(monthCell(page, "2026-10-15")).toHaveAttribute("data-bridge", "false");
    await expect(monthCell(page, "2026-10-15").getByTestId("month-cell-bridge")).toHaveCount(0);

    // One bridge day in the whole month, so the mark means something.
    await expect(page.getByTestId("month-cell-bridge")).toHaveCount(1);
  });

  test("AC-4: the false positive a two-input computation produces is not drawn", async ({ page }) => {
    await openAs(page, "month", MEMBER_EMAIL, JUNE);

    // Thursday a holiday, Friday working, Saturday a mandated `làm bù` working day (ADR-015 § 4).
    // Friday is NOT a bridge day, and a computation that ignored the `working` row would say it is —
    // at the exact moment the highlight is the whole value.
    await expect(monthCell(page, "2026-06-11")).toHaveAttribute("data-day-status", "holiday");
    await expect(monthCell(page, "2026-06-13")).toHaveAttribute("data-day-status", "working");
    await expect(monthCell(page, "2026-06-12")).toHaveAttribute("data-bridge", "false");
    await expect(monthCell(page, "2026-06-12").getByTestId("month-cell-bridge")).toHaveCount(0);

    // JUNE HAS NO BRIDGE DAY AT ALL. Tuesday 16 June sits between the `non_working` Monday and an
    // ordinary Wednesday, so it is not one either. Asserting the count is what stops the criterion
    // above from being satisfied by a badge that never renders anywhere.
    await expect(page.getByTestId("month-cell-bridge")).toHaveCount(0);
  });

  test("AC-6: the week view carries the same day status as the month", async ({ page }) => {
    await openAs(page, "week", MEMBER_EMAIL, "/week/2026-10-12");

    const holiday = weekDay(page, "2026-10-15");
    await expect(holiday).toHaveAttribute("data-day-status", "holiday");
    await expect(holiday.getByTestId("week-day-holiday")).toHaveText(HOLIDAY_BRIDGED_NAME);
    await expect(holiday.getByTestId("week-day-holiday")).toHaveAttribute("data-kind", "non_working");

    const bridge = weekDay(page, "2026-10-16");
    await expect(bridge).toHaveAttribute("data-bridge", "true");
    await expect(bridge).toHaveAttribute("data-day-status", "working");
    await expect(bridge.getByTestId("week-day-bridge")).toHaveCount(1);
    await expect(bridge.getByTestId("week-day-holiday")).toHaveCount(0);

    // Seven sections, every one of them answering — a week that left a day blank would make "an
    // ordinary Tuesday" and "we did not look" the same screen.
    await expect(page.getByTestId("week-day")).toHaveCount(7);
    for (const date of ["2026-10-12", "2026-10-13", "2026-10-14"]) {
      await expect(weekDay(page, date)).toHaveAttribute("data-day-status", "working");
    }
    for (const date of ["2026-10-17", "2026-10-18"]) {
      await expect(weekDay(page, date)).toHaveAttribute("data-day-status", "weekend");
    }
  });

  test("AC-7: the year view carries day status for every day of the year", async ({ page }) => {
    await openAs(page, "year", MEMBER_EMAIL, "/year/2026/members");

    // One element per date, in a strip of its own — NOT one lookup per member cell, which is the
    // 10,950-cell budget CAL-06 set for this screen (01-plan.md § 8, rejected alternative 5).
    await expect(page.getByTestId("year-daystatus")).toHaveCount(1);
    await expect(page.getByTestId("year-daystatus-cell")).toHaveCount(365);

    for (const date of ["2026-06-11", "2026-06-15", "2026-10-15"]) {
      await expect(yearDay(page, date)).toHaveAttribute("data-day-status", "holiday");
    }
    await expect(yearDay(page, "2026-06-13")).toHaveAttribute("data-day-status", "working");
    await expect(yearDay(page, "2026-10-16")).toHaveAttribute("data-bridge", "true");

    // The name reaches a reader through `title`, because a one-day-wide element has no room for
    // text — the same answer this screen already gives for a member cell's type.
    await expect(yearDay(page, "2026-10-15")).toHaveAttribute(
      "title",
      `2026-10-15 — ${HOLIDAY_BRIDGED_NAME}`,
    );

    // The member grid is UNTOUCHED: CAL-06 shipped it and this ticket adds nothing to a cell. Not a
    // cosmetic check — a day status per member cell is the 10,950 lookups the strip exists to avoid.
    await expect(page.locator('[data-testid="year-cell"][data-day-status]')).toHaveCount(0);
    await expect(page.locator('[data-testid="year-cell"][data-bridge]')).toHaveCount(0);
  });

  test("AC-8: a year the calendar does not reach says so in words", async ({ page }) => {
    await openAs(page, "year", MEMBER_EMAIL, "/year/2027/members");

    // The strip still renders 365 elements — every date is a key whether or not anything is drawn on
    // it — which is exactly why the map cannot answer this and the sentence is read off the rows.
    await expect(page.getByTestId("year-daystatus-cell")).toHaveCount(365);
    await expect(page.getByTestId("year-holidays-empty")).toBeVisible();

    // And it is absent on a year that HAS rows, or it would be a sentence about nothing.
    await page.getByTestId("year-prev").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2026");
    await expect(page.getByTestId("year-holidays-empty")).toHaveCount(0);
  });

  test("AC-9 and AC-10: a holiday changes no count, and an overloaded holiday keeps both signals", async ({
    page,
  }) => {
    await placeAdminInDedicatedOrg(page);
    await openAs(page, "month", ADMIN_EMAIL, "/month/2026-09");

    // Before anything is changed: one person is away on the 14th, the 15th and the 16th, and no day
    // is crowded — four active members at a threshold of 0.5 needs more than two.
    await expect(monthCell(page, "2026-09-15")).toHaveAttribute("data-count", "1");
    await expect(monthCell(page, "2026-09-15")).toHaveAttribute("data-overloaded", "false");

    // UIE-03 AC-12. The step onto the landing screen is deleted.
    //
    // **TWO CLICKS SINCE UIE-10.** The threshold link WAS a sidebar control and rendered on the
    // grid; that ticket removed the sidebar's four admin links, so the route is the top-bar control
    // and then the hub row. Both render on the grid, so the property this comment was recording —
    // no step onto a landing screen — still holds.
    // ADM-01's control, used to make one person away crowded — moving three people through the
    // sign-in screen would test CAL-01 rather than this. THE FIELD IS A WHOLE PERCENT and the column
    // is a share: 10 here is the 0.1 that `isOverloaded` compares against (ADM-01 01-plan.md).
    await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-threshold-link").click();
    await page.getByTestId("threshold-input").fill("10");
    await page.getByTestId("threshold-save").click();
    await expect(page.getByTestId("threshold-saved")).toBeVisible();
    // SOLO 2026-09-12. The back link is gone from every admin screen. `addHoliday` opens the
    // calendar through the strip's `admin-hub-holidays-link`, which is on this screen already.

    // ADM-03's control, used to put a holiday on a date somebody is already away on. This is the
    // only visible consequence of that ticket, which is 01-plan.md section 1's point.
    await addHoliday(page, "2026-09-15", "Ngay nghi kiem thu", 5);

    await backTo(page, "/month/2026-09");
    await expect(page.getByTestId("month-grid")).toBeVisible();

    // AC-9. NO SUPPRESSION. The count on the holiday is the number the same entry produces on the
    // working day beside it — a holiday reduces no denominator and excludes no date. ADR-015
    // Consequences: a number altered on a holiday date is a second definition of INV-04 arriving
    // through the display.
    await expect(monthCell(page, "2026-09-15")).toHaveAttribute("data-day-status", "holiday");
    await expect(monthCell(page, "2026-09-15")).toHaveAttribute("data-count", "1");
    await expect(monthCell(page, "2026-09-14")).toHaveAttribute("data-count", "1");
    await expect(monthCell(page, "2026-09-16")).toHaveAttribute("data-count", "1");

    // AC-10. BOTH SIGNALS, neither hidden by the other: the day is still marked overloaded and the
    // holiday is still named on it.
    await expect(monthCell(page, "2026-09-15")).toHaveAttribute("data-overloaded", "true");
    await expect(monthCell(page, "2026-09-15").getByTestId("month-cell-holiday")).toHaveText(
      "Ngay nghi kiem thu",
    );
    // And the working days either side are marked overloaded on the same comparison, so the
    // marking above is the count's doing and not the holiday's.
    await expect(monthCell(page, "2026-09-14")).toHaveAttribute("data-overloaded", "true");
  });

  test("AC-11: the month, the week and the year agree about a date", async ({ page }) => {
    await openAs(page, "month", MEMBER_EMAIL, OCTOBER);

    const fromTheMonth = {
      holiday: await statusOf(monthCell(page, "2026-10-15")),
      bridge: await statusOf(monthCell(page, "2026-10-16")),
      name: await monthCell(page, "2026-10-15").getByTestId("month-cell-holiday").textContent(),
    };

    // **AMENDED BY SOLO 2026-09-11, AND THE CLAUSE THAT MOVED IS NAMED RATHER THAN QUIETLY DROPPED.**
    // This read *"Switching views keeps the date ... so the month and the week are reached by walking
    // the product's links rather than by typing an address"*, and it walked `month-week` to
    // `/week/2026-10-01` and then stepped twice. `month-week` now opens TODAY's week — the operator
    // was shown the keeps-the-date contract and chose against it for this one segment — so two steps
    // land wherever this run's clock puts them, which is a test that passes or fails by the date.
    //
    // The link is still followed and its NEW contract is asserted here in passing, which is worth
    // more than the old walk was: it is the only place in the suite that would notice the segment
    // silently going back to keeping the date.
    await page.getByTestId("month-week").click();
    await expect(page.getByTestId("week-anchor")).toBeVisible();

    // **AND THEN THE OCTOBER WEEK IS REACHED BY ADDRESS, WHICH IS THE COST.** There is no link from
    // a month to a NAMED week any more, so this leg cannot be walked. A `page.goto` is safe in this
    // test and in no way a general licence: AC-11 writes nothing, and every row it reads is a
    // fixture one, so resetting the mock's module state resets it to exactly what this test reads.
    //
    // WHAT THE CRITERION IS FOR IS UNTOUCHED: three surfaces, one date, one answer. How the browser
    // arrived at the third surface was never the claim.
    await page.goto("/week/2026-10-15");
    await expect(weekDay(page, "2026-10-15")).toHaveCount(1);

    const fromTheWeek = {
      holiday: await statusOf(weekDay(page, "2026-10-15")),
      bridge: await statusOf(weekDay(page, "2026-10-16")),
      name: await weekDay(page, "2026-10-15").getByTestId("week-day-holiday").textContent(),
    };

    // CAL-10, inside ADR-032. The year is TWO screens now: `week-year` reaches the OVERVIEW at
    // `/year/2026`, and the per-member grid this criterion compares against is at
    // `/year/2026/members`, which no link from the week reaches. So this one is typed, and only
    // because the address moved. A document load is safe here — every holiday this test reads is a
    // fixture, and `src/lib/data/mock.ts` restores the session from `localStorage`.
    await page.goto("/year/2026/members");
    await expect(page.getByTestId("year-grid")).toBeVisible();

    const fromTheYear = {
      holiday: await statusOf(yearDay(page, "2026-10-15")),
      bridge: await statusOf(yearDay(page, "2026-10-16")),
      name: (await yearDay(page, "2026-10-15").getAttribute("title"))?.replace("2026-10-15 — ", ""),
    };

    expect(fromTheWeek).toEqual(fromTheMonth);
    expect(fromTheYear).toEqual(fromTheMonth);
    expect(fromTheMonth.holiday).toEqual({ status: "holiday", bridge: "false" });
    expect(fromTheMonth.bridge).toEqual({ status: "working", bridge: "true" });
    expect(fromTheMonth.name).toBe(HOLIDAY_BRIDGED_NAME);
  });

  test("AC-13: both roles see the same thing, and neither gets a control", async ({ page }) => {
    const seen: Record<string, unknown>[] = [];

    for (const email of [MEMBER_EMAIL, ADMIN_EMAIL]) {
      // A full sign-out and a fresh document load between the two. Safe here and only here: this
      // criterion reads nothing either person created, so losing the mock's tables costs nothing.
      await signOutIfSignedIn(page);
      await openAs(page, "month", email, OCTOBER);

      seen.push({
        holiday: await statusOf(monthCell(page, "2026-10-15")),
        bridge: await statusOf(monthCell(page, "2026-10-16")),
        name: await monthCell(page, "2026-10-15").getByTestId("month-cell-holiday").textContent(),
      });

      // The write denial is held by ABSENCE — 01-plan.md section 3 names it the weakest mechanism in
      // the plan, and this is the assertion from outside. An admin reaching `seam.addHoliday` from a
      // console still succeeds, correctly; what these three files guarantee is that no write reaches
      // THESE surfaces.
      for (const control of HOLIDAY_CONTROLS) {
        await expect(page.getByTestId(control)).toHaveCount(0);
      }

      await page.getByTestId("month-week").click();
      await expect(page.getByTestId("week-anchor")).toBeVisible();
      for (const control of HOLIDAY_CONTROLS) {
        await expect(page.getByTestId(control)).toHaveCount(0);
      }

      // CAL-10. `week-year` now lands on the OVERVIEW, and the member grid is at its own address.
      // BOTH are year surfaces and neither may carry a holiday control, so both are checked — the
      // criterion is about the surfaces this ticket shades, and ADR-032 turned one of them into two.
      await page.getByTestId("week-year").click();
      await expect(page.getByTestId("year-overview")).toBeVisible();
      for (const control of HOLIDAY_CONTROLS) {
        await expect(page.getByTestId(control)).toHaveCount(0);
      }

      await page.goto("/year/2026/members");
      await expect(page.getByTestId("year-grid")).toBeVisible();
      for (const control of HOLIDAY_CONTROLS) {
        await expect(page.getByTestId(control)).toHaveCount(0);
      }
    }

    expect(seen[1]).toEqual(seen[0]);
  });

  test("AC-14: the month grid's out-of-month cells carry no day status", async ({ page }) => {
    await placeAdminInDedicatedOrg(page);
    await openAs(page, "month", ADMIN_EMAIL, "/month/2026-09");

    // A holiday on the last day of September, which is one of October's LEADING cells — the fixture
    // set has no row in any month's out-of-month week, so the criterion needs one added.
    // UIE-03 AC-12. The step onto the landing screen is deleted; `addHoliday` opens with a SIDEBAR
    // link, which renders on the grid.
    await addHoliday(page, "2026-09-30", "Ngay cuoi thang chin", 5);

    await backTo(page, "/month/2026-09");
    await expect(page.getByTestId("month-grid")).toBeVisible();

    // In its own month it is drawn and named.
    const inSeptember = monthCell(page, "2026-09-30");
    await expect(inSeptember).toHaveAttribute("data-in-month", "true");
    await expect(inSeptember).toHaveAttribute("data-day-status", "holiday");
    await expect(inSeptember.getByTestId("month-cell-holiday")).toHaveCount(1);

    await page.getByTestId("month-next").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-10");

    // In October's leading week it is the SAME DATE and carries nothing at all — exactly as it
    // carries no count today (CAL-04 AC-1). The range passed to the derivation is the month and not
    // the whole-weeks grid, which is what makes this true by construction rather than by a filter.
    const inOctober = monthCell(page, "2026-09-30");
    await expect(inOctober).toHaveAttribute("data-in-month", "false");
    await expect(inOctober).toHaveAttribute("data-day-status", "");
    await expect(inOctober).toHaveAttribute("data-bridge", "false");
    await expect(inOctober).toHaveAttribute("data-count", "");
    await expect(inOctober.getByTestId("month-cell-holiday")).toHaveCount(0);
    await expect(inOctober.getByTestId("month-cell-bridge")).toHaveCount(0);
  });
});
