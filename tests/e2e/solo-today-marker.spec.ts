import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-11 — the week opens on today, and today is marked.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md`.
//
// **THE OPERATOR'S REQUEST WAS TWO THINGS AND THE FIRST ONE WAS ALREADY HALF TRUE.** *"khi mở lịch
// tuần default luôn là today"* — `/week` and `/` already resolved to this week before this change,
// and `WeekView.tsx`'s redirect is what did it. The gap was the `Week` SEGMENT of the top-bar
// switcher: from a month or a year it kept the date, so it opened that period's FIRST week. UIE-02
// AC-14 states that contract in as many words; the operator was shown it and chose against it for
// this one segment.
//
// **EVERY OTHER SWITCHER TARGET STILL KEEPS THE DATE**, and test 3 is what would notice if a later
// change took the rule further than the operator asked.
//
// **THE CLOCK IS THE MACHINE'S AND THE TESTS NEVER NAME A DATE.** A test that hard-coded "today"
// would pass on one day and fail for ever afterwards, which is the specific way a today-marker test
// rots. Everything below is written against `data-today`, against the count of marked cells, and
// against the browser's own clock read in the page.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise).

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";

/** The browser's own local day, in `yyyy-MM-dd`. The SAME arithmetic `src/lib/period.ts`'s
 *  `currentDay()` does — local parts, not `toISOString()`, which is UTC and yields the previous day
 *  west of Greenwich. Read from the page rather than from Node so that the clock under test and the
 *  clock in the assertion are the same one. */
async function todayInBrowser(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  });
}

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

test.describe("SOLO — the week opens on today, and today is marked", () => {
  test("1: the Week segment opens today's week, from a month and from a year", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    const today = await todayInBrowser(page);

    // **A MONTH FAR FROM THIS ONE**, so "today's week" and "this month's first week" cannot be the
    // same answer by accident. April 2027 is chosen for being neither.
    await page.goto("/month/2027-04");
    await expect(page.getByTestId("month-grid")).toBeVisible();

    await page.getByTestId("month-week").click();
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    // The day itself is on the screen, which is the whole of what the operator asked for. Asserted
    // through the day column rather than through the URL: the address is `/week/<today>` today and
    // the anchor is the MONDAY of that week, so a URL assertion would be testing the redirect's
    // spelling rather than the outcome.
    await expect(
      page.locator(`[data-testid="week-day"][data-date="${today}"]`),
    ).toHaveCount(1);

    // And from a YEAR, where the old target was the 1st of January — a date "keeping the date" had
    // to invent, since a year names no week.
    await page.goto("/year/2027");
    await expect(page.getByTestId("year-anchor")).toBeVisible();

    await page.getByTestId("year-week").click();
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await expect(
      page.locator(`[data-testid="week-day"][data-date="${today}"]`),
    ).toHaveCount(1);
  });

  test("2: the addresses that already opened on today still do", async ({ page }) => {
    // The half of the request that needed no change. Asserted anyway: it is the property the
    // operator asked for, and nothing in the suite stated it about `/` before.
    await signIn(page, MEMBER_EMAIL);
    const today = await todayInBrowser(page);

    for (const path of ["/", "/week"]) {
      await page.goto(path);
      await expect(page.getByTestId("week-anchor")).toBeVisible();
      await expect(
        page.locator(`[data-testid="week-day"][data-date="${today}"]`),
      ).toHaveCount(1);
    }
  });

  test("3: every other switcher target still keeps the date", async ({ page }) => {
    // **THE FENCE.** The operator asked for one segment to stop keeping the date. This is what
    // would fail if a later change took the rule to the other five, which would silently undo
    // UIE-02 AC-14 everywhere rather than in the one place it was argued.
    await signIn(page, MEMBER_EMAIL);

    await page.goto("/month/2027-04");
    await page.getByTestId("month-year").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2027");

    await page.goto("/week/2027-04-07");
    await page.getByTestId("week-month").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2027-04");

    await page.goto("/week/2027-04-07");
    await page.getByTestId("week-year").click();
    await expect(page.getByTestId("year-anchor")).toHaveAttribute("data-year", "2027");

    await page.goto("/year/2027");
    await page.getByTestId("year-month").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2027-01");
  });

  test("4: the week view marks today, and exactly one day of the seven", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    const today = await todayInBrowser(page);

    await page.goto("/week");
    await expect(page.getByTestId("week-anchor")).toBeVisible();

    // EXACTLY ONE, which is the assertion a bare "today is marked" would miss: a predicate wrong in
    // the other direction marks all seven and still passes a single-cell check.
    const marked = page.locator('[data-testid="week-day"][data-today="true"]');
    await expect(marked).toHaveCount(1);
    await expect(marked).toHaveAttribute("data-date", today);

    // The badge, which is the half a border does not answer — a ring is a difference somebody has to
    // notice and then guess the meaning of, and it reaches a screen reader not at all.
    await expect(marked.getByTestId("week-day-today")).toHaveCount(1);
    await expect(marked.getByTestId("week-day-today")).toHaveText("Today");

    // And it is on the marked column ALONE: six badges on six other days would satisfy a page-wide
    // count of one badge per screen but not this.
    await expect(page.getByTestId("week-day-today")).toHaveCount(1);
  });

  test("5: a week that is not this week carries no marker at all", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);

    // ABSENT, not a badge saying so. Today is not on this screen and the honest rendering of that is
    // nothing — the same reasoning the period cluster uses for a route with no period.
    await page.goto("/week/2027-04-07");
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await expect(page.locator('[data-testid="week-day"][data-today="true"]')).toHaveCount(0);
    await expect(page.getByTestId("week-day-today")).toHaveCount(0);
  });

  test("6: the month grid marks today too, and only in the month that holds it", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);
    const today = await todayInBrowser(page);

    await page.goto("/month");
    await expect(page.getByTestId("month-grid")).toBeVisible();

    const marked = page.locator('[data-testid="month-cell"][data-today="true"]');
    await expect(marked).toHaveCount(1);
    await expect(marked).toHaveAttribute("data-date", today);
    await expect(marked.getByTestId("month-cell-today")).toHaveText("Today");

    // A month far away draws thirty-five cells and none of them is today. The grid spans whole
    // weeks, so this also covers the leading and trailing cells of the neighbouring months.
    await page.goto("/month/2027-04");
    await expect(page.getByTestId("month-grid")).toBeVisible();
    await expect(page.locator('[data-testid="month-cell"][data-today="true"]')).toHaveCount(0);
    await expect(page.getByTestId("month-cell-today")).toHaveCount(0);
  });

  test("7: the marker adds no control and no link", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto("/week");
    await expect(page.getByTestId("week-anchor")).toBeVisible();

    // It is a label about a date, not a way to go anywhere — the `Today` BUTTON in the top bar is
    // `shell-period-today` and is a different thing with a different id. Two controls to one meaning
    // is how a product acquires two names for one destination.
    const badge = page.getByTestId("week-day-today");
    expect(await badge.evaluate((node) => node.tagName)).toBe("SPAN");
    await expect(page.locator('[data-testid="week-day-today"] a')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day-today"] button')).toHaveCount(0);

    // § Language: the interface is English, asserted as PAINTED rather than from the source.
    expect(await badge.innerText()).not.toMatch(/[À-ɏḀ-ỿ]/);
  });
});
