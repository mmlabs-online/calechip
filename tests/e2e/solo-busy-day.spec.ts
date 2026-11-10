import { expect, test, type Locator, type Page } from "@playwright/test";

// SOLO, 2026-09-11 — a member marks a day busy, and the team sees how many people did.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n` — an `AC-` prefix is a claim that a plan document states
// the criterion. What authorises the work is `.claude/agents/solo.md`.
//
// **WHAT THIS IS, IN THE OPERATOR'S WORDS.** *"cho phép user mark ngày cụ thể nào đó là bận, người
// khác sẽ thấy được số member bận trong ngày đó ... để khi người tổ chức event cho team biết được
// ngày nào có người bận hay không bận. Bận ở đây chỉ là task nhiều hoặc có plan sau ngày nghỉ chứ
// vẫn đi làm bình thường. Nên không cần approve."* Three of those clauses are decisions and each has
// a test below: the count is visible to everybody, there is no approval anywhere, and a busy person
// is PRESENT.
//
// **THE LAST ONE IS THE TEST THAT MATTERS.** A busy day must never enter INV-04's absence count.
// `tests/busy-counts.test.ts` proves that of the arithmetic; test 5 proves it of the SCREEN, which
// is where somebody would actually be misled — a strip reading `3/4` on a day when nobody is away
// would tell an organiser the team is short-staffed when every one of them is at their desk.
//
// **THE OPERATOR CHOSE COUNT PLUS NAMES** when asked, and chose a press on the day itself over a
// form with a date range. Both choices are asserted rather than assumed.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise). The mock's `busy_day` table starts EMPTY, unlike `entry`: a busy day is reachable
// through the product with one press, so a seeded row would be a row every count has to subtract.
//
// Fixtures (`src/lib/fixtures.ts`): FIXTURE_TEAM carries two admins and two members.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const ADMIN_EMAIL = "quan@example.com";

/** Monday of the week FIXTURE_APPROVED_ENTRY sits in — 14 to 16 September 2026, `full`, `pto`,
 *  approved. Its presence is what makes test 5's separation observable. */
const WEEK = "/week/2026-09-14";
const MONTH = "/month/2026-09";

/** A day in that week that NO fixture entry covers. Nobody is away on it, so a busy mark here cannot
 *  be confused with an absence. */
const QUIET = "2026-09-17";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const MEMBER_NAME = "Thành viên";
const ADMIN_NAME = "Quản trị";

const day = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="week-day"][data-date="${date}"]`);

const busyControl = (page: Page, date: string): Locator =>
  day(page, date).getByTestId("week-day-busy");

const cell = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="month-cell"][data-date="${date}"]`);

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  const loading = page.getByTestId("app-session-loading");
  if (await loading.isVisible()) await expect(loading).toBeHidden();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/**
 * Move to an address WITHOUT a document load. The mock keeps its rows in module scope, so a
 * `page.goto` mid-test discards every mark an earlier step created — the same trap five shipped spec
 * files avoid with `page.goBack()` helpers.
 */
async function walkTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => window.history.pushState({}, "", to), path);
  // A `pushState` from outside React does not notify the router, so nudge it with a popstate.
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
}

test.describe("SOLO — marking a day busy", () => {
  test("1: a member marks a day, and the control says so without a reload", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto(WEEK);

    const control = busyControl(page, QUIET);
    await expect(control).toHaveAttribute("data-mine", "false");
    await expect(control).toHaveAttribute("data-busy-count", "0");
    await expect(control).toHaveAttribute("aria-pressed", "false");

    // SOLO, 2026-09-11 (second pass) — **THE ASSERTION THIS TEST'S NAME HAS ALWAYS CLAIMED AND NEVER
    // MADE.** Stamp a property on a DIFFERENT day's column, in the browser, before the press. A
    // property survives a re-render and does NOT survive the node being unmounted and rebuilt, which
    // is exactly what the old `await load()` did to all seven columns to move one number. If this
    // reads `undefined` after the press, the calendar reloaded.
    await day(page, "2026-09-15").evaluate((node) => {
      (node as HTMLElement & { __survives?: string }).__survives = "yes";
    });

    await control.click();

    // The count moves immediately: the press is OPTIMISTIC (the operator chose that shape on
    // 2026-09-11 over a scoped re-read), so this is the prediction `withOwnBusyMark` made, and the
    // write behind it only ever puts the number back on a refusal.
    await expect(control).toHaveAttribute("data-mine", "true");
    await expect(control).toHaveAttribute("data-busy-count", "1");
    await expect(control).toHaveAttribute("aria-pressed", "true");

    // Still the same node. Nothing unmounted.
    const survived = await day(page, "2026-09-15").evaluate(
      (node) => (node as HTMLElement & { __survives?: string }).__survives,
    );
    expect(survived).toBe("yes");

    // And the in-flight ring is gone once the write settles — it is drawn only while the press is
    // unresolved, so a spinner still on screen here would mean a promise that never finished.
    await expect(day(page, QUIET).getByTestId("week-day-busy-spinner")).toHaveCount(0);
  });

  test("2: pressing it again unmarks the day — the same control, both ways", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto(WEEK);

    await busyControl(page, QUIET).click();
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-busy-count", "1");

    await busyControl(page, QUIET).click();
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-busy-count", "0");
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-mine", "false");

    // ONE CONTROL AND NOT TWO. The operator chose a press on the day; a separate "unmark" would be a
    // second control for the same fact, and a toggle is what `aria-pressed` announces.
    await expect(day(page, QUIET).getByTestId("week-day-busy")).toHaveCount(1);
  });

  test("3: everybody on the team sees the count, and who it is", async ({ page }) => {
    // The whole point of the feature: an organiser is not the person who marked the day.
    await signIn(page, MEMBER_EMAIL);
    await page.goto(WEEK);
    await busyControl(page, QUIET).click();
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-busy-count", "1");

    // A DIFFERENT PERSON, without a document load — so the mark made above survives into this half.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await page.getByTestId("sign-in-email").fill(ADMIN_EMAIL);
    await page.getByTestId("sign-in-password").fill(PASSWORD);
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await walkTo(page, WEEK);
    await expect(page.getByTestId("week-anchor")).toBeVisible();

    // The COUNT — what the operator asked for.
    const seen = busyControl(page, QUIET);
    await expect(seen).toHaveAttribute("data-busy-count", "1");
    // And it is somebody else's mark, so this caller's own state is untouched: a shared number is
    // not a shared button.
    await expect(seen).toHaveAttribute("data-mine", "false");

    // The NAMES — the half the operator added when asked. The avatar carries the member id and the
    // display name, which is how the month cell already names the people it draws.
    const avatar = day(page, QUIET).getByTestId("week-day-busy-avatar");
    await expect(avatar).toHaveCount(1);
    await expect(avatar).toHaveAttribute("title", MEMBER_NAME);

    // Two people on one day, and the count follows the list rather than being asserted separately —
    // they come from one pass and can only disagree if that pass is wrong.
    await seen.click();
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-busy-count", "2");
    await expect(day(page, QUIET).getByTestId("week-day-busy-avatar")).toHaveCount(2);
    await expect(
      day(page, QUIET).getByTestId("week-day-busy-avatar").nth(0),
    ).toHaveAttribute("title", ADMIN_NAME);
  });

  test("4: the mark is on the month grid too, and pressing a cell's badge does not open the form", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto(WEEK);
    await busyControl(page, QUIET).click();
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-busy-count", "1");

    await walkTo(page, MONTH);
    await expect(page.getByTestId("month-grid")).toBeVisible();

    const badge = cell(page, QUIET).getByTestId("month-cell-busy");
    await expect(badge).toHaveAttribute("data-busy-count", "1");
    await expect(badge).toHaveAttribute("data-mine", "true");
    await expect(badge).toHaveAttribute("title", MEMBER_NAME);

    // **THE CELL STARTS A DATE-RANGE DRAG ON MOUSE DOWN (CAL-04 AC-13).** Without
    // `stopPropagation` on this button a press would both toggle the mark AND open the entry form on
    // a one-day range, which is the specific defect this assertion exists to catch.
    await badge.click();
    await expect(page.getByTestId("month-entry-panel")).toHaveCount(0);
    await expect(cell(page, QUIET).getByTestId("month-cell-busy")).toHaveCount(0);

    // A cell nobody marked carries no badge at all — the rule `month-cell-count` already follows, so
    // a quiet month is not 35 pieces of furniture.
    await expect(cell(page, "2026-09-18").getByTestId("month-cell-busy")).toHaveCount(0);
  });

  test("5: a busy day is NOT an absence — the two numbers are separate on screen", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto(WEEK);

    // 17 September: no fixture entry covers it, so the absence strip reads 0 of the active team.
    const before = await day(page, QUIET).getAttribute("data-count");
    expect(before).toBe("0");

    await busyControl(page, QUIET).click();
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-busy-count", "1");

    // **THE ASSERTION THE WHOLE DESIGN IS FOR.** `data-count` is INV-04's absence count and it has
    // not moved: the person is at work. A product that incremented it here would tell somebody
    // arranging an event that the team was short-staffed on a day when nobody was away.
    await expect(day(page, QUIET)).toHaveAttribute("data-count", "0");
    await expect(day(page, QUIET).getByTestId("week-day-count")).toContainText("0/");

    // And the same on the month grid, where the absence count drives the crowded-day fill.
    await walkTo(page, MONTH);
    await expect(page.getByTestId("month-grid")).toBeVisible();
    await expect(cell(page, QUIET)).toHaveAttribute("data-count", "0");
    await expect(cell(page, QUIET)).toHaveAttribute("data-overloaded", "false");
    await expect(cell(page, QUIET).getByTestId("month-cell-busy")).toHaveAttribute(
      "data-busy-count",
      "1",
    );
  });

  test("6: there is no approval anywhere near it", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto(WEEK);
    await busyControl(page, QUIET).click();
    await expect(busyControl(page, QUIET)).toHaveAttribute("data-busy-count", "1");

    // The operator: *"Nên không cần approve"*. The row has no status, so nothing about it can be
    // pending — and the admin's approval queue, which is where a pending thing would surface, does
    // not grow by one.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await page.getByTestId("sign-in-email").fill(ADMIN_EMAIL);
    await page.getByTestId("sign-in-password").fill(PASSWORD);
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();

    await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-pending-link").click();
    await expect(page.getByTestId("pending-entries-count")).toBeVisible();

    // The queue lists ENTRIES. A busy day is not one, and the marked day above put nothing here.
    await expect(page.getByTestId("pending-entries-row")).toHaveCount(0);
  });

  test("7: the labels are English", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto(WEEK);

    // § Language: artifacts and the interface are English. Asserted as PAINTED, which is the half
    // the lint rule cannot check — eslint reads the source and a diacritic could still arrive
    // through a fixture or a seam message.
    const DIACRITIC = /[À-ɏḀ-ỿ]/;
    expect(await busyControl(page, QUIET).innerText()).not.toMatch(DIACRITIC);
  });
});
