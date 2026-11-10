// CAL-10 — the year overview, through the browser. 01-plan.md section 2, inside ADR-032.
//
// **WHAT IS ASSERTED HERE AND WHAT IS ASSERTED IN `tests/absence.test.ts`.**
// `.ai/standards/testing-standards.md` puts pure logic at the unit level and rendering at this one.
// AC-6's partition identity and AC-8's fraction are properties of `absenceByTypeFor` and are proved
// against `absenceCountsFor` over the same fixtures there — the cheapest possible check of ADR-032's
// revert condition. What this file adds is that the SCREEN shows those numbers: a derivation that is
// right and a card that reads a different value are the same defect to a person looking at it.
//
// **THE `unavailable` BRANCH IS ASSERTED NEGATIVELY, WHICH IS THIS SUITE'S ESTABLISHED READING.**
// AC-14's third state and AC-15 are the same `catch`, and the mock seam does not fail on demand —
// `cal-04`, `cal-05`, `adm-02` and `adm-04` all assert their own `*-unavailable` with
// `toHaveCount(0)` for exactly this reason. So the assertion below is that a SUCCESSFUL read never
// renders it, which is what keeps "the year is quiet" and "the read failed" from ever being the same
// screen. Nothing here claims to have exercised a throwing read.
//
// Fixtures this file leans on, from `src/lib/fixtures.ts`:
// - FIXTURE_APPROVED_ENTRY runs 14 to 16 September 2026, `full`, `pto`, `approved`, owned by
//   FIXTURE_APPROVED_MEMBER. It is the ONLY entry the caller's team holds in 2026, which is what
//   makes every figure below a small number somebody can check by hand.
// - FIXTURE_OTHER_TEAM_ENTRY runs 21 to 22 September 2026 and belongs to the OTHER TEAM, so INV-07
//   is observable: it must be in no figure on this screen.
// - Three NON-WORKING 2026 holidays (11 June, 15 June, 15 October) and one WORKING Saturday
//   (13 June, a mandated make-up day). AC-7 turns on the mandated Saturday not being counted.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange } from "./support/entry-form";

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";

const OVERVIEW = "/year/2026";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const APPROVED_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";

/** § Language's own pattern, from `ui-language.json`. AC-17 is the assertion the lint rule cannot
 *  make: eslint reads the SOURCE, and this reads what the browser actually painted. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

/** § 1 Out-of-scope, and charter refusal 1. No label on this screen may make it read as a quota. */
const BALANCE_WORDS = ["remaining", "left", "balance", "quota", "allowance"];

const card = (page: Page, kind: string): Locator =>
  page.locator(`[data-testid="year-summary-card"][data-kind="${kind}"]`);

const monthCard = (page: Page, month: string): Locator =>
  page.locator(`[data-testid="year-month-card"][data-month="${month}"]`);

const dayCell = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="year-day-cell"][data-date="${date}"]`);

const valueOf = async (locator: Locator): Promise<number> =>
  Number(await locator.getAttribute("data-value"));

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Walks history back to an address. `page.goBack()` replays a react-router history entry, which is
 *  a popstate and not a reload — a `page.goto` would reset the mock's module state and lose every
 *  entry the test had created. */
async function backTo(page: Page, path: string): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    if (new URL(page.url()).pathname === path) break;
    await page.goBack();
  }
}

/** Signed out on the overview, then signed in and back on it — without a document load. */
async function openOverviewAs(page: Page, email: string, path: string = OVERVIEW): Promise<void> {
  await page.goto(path);
  await page.getByTestId("year-overview-sign-in").click();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await backTo(page, path);
  await expect(page.getByTestId("year-overview")).toBeVisible();
}

/** Declares one entry through CAL-01's form and returns to the overview, all client-side. `owned` is
 *  how many entries the signed-in member holds afterwards — the wait that proves the write landed. */
async function declare(
  page: Page,
  fields: { start: string; end: string; portion?: string; type?: string },
  owned = 1,
): Promise<void> {
  const path = new URL(page.url()).pathname;

  // The create link is in the TOP BAR and renders on every route inside the shell (UIE-03 AC-12).
  await page.getByTestId("home-new-entry-link").click();

  await pickRange(page, "new-entry", fields.start, fields.end);
  if (fields.portion) await choosePortion(page, "new-entry", fields.portion);
  if (fields.type) await chooseType(page, "new-entry", fields.type);

  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(owned);

  await backTo(page, path);
  await expect(page.getByTestId("year-overview")).toBeVisible();
}

test.describe("CAL-10 — year overview", () => {
  test("AC-1: /year/:yyyy renders the summary band and twelve cards, and no member grid", async ({
    page,
  }) => {
    await openOverviewAs(page, MEMBER_EMAIL);

    await expect(page.getByTestId("year-overview")).toHaveAttribute("data-year", "2026");
    await expect(page.getByTestId("year-summary-card")).toHaveCount(4);
    await expect(page.getByTestId("year-month-card")).toHaveCount(12);

    // THE DEFAULT YEAR IS THE OVERVIEW NOW — ADR-032 option 3. Not one per-member row and not one
    // of the 365 columns appears here, which is the half of AC-1 that says these are two screens
    // rather than one screen with a section added to it.
    await expect(page.getByTestId("year-grid")).toHaveCount(0);
    await expect(page.getByTestId("year-row")).toHaveCount(0);
    await expect(page.getByTestId("year-cell")).toHaveCount(0);

    // A successful read never renders the failure state. See the header: this is how the whole
    // suite asserts a branch the mock cannot be made to take.
    await expect(page.getByTestId("year-overview-unavailable")).toHaveCount(0);
  });

  test("AC-2: the member grid is retained at its new address, unchanged", async ({ page }) => {
    await page.goto("/year/2026/members");
    await page.getByTestId("year-sign-in").click();
    await signIn(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await backTo(page, "/year/2026/members");

    // Everything CAL-06 shipped, at the new address and otherwise untouched: one row per member of
    // the team INCLUDING those who declared nothing, 365 day columns, the day-status strip and the
    // per-day totals. ADR-032 § Consequences item 6 — it moves address and nothing else.
    await expect(page.getByTestId("year-grid")).toBeVisible();
    await expect(page.getByTestId("year-row")).toHaveCount(5);
    await expect(page.getByTestId("year-total")).toHaveCount(365);
    await expect(page.getByTestId("year-daystatus-cell")).toHaveCount(365);
    await expect(page.getByTestId("year-overview")).toHaveCount(0);
  });

  test("AC-3: an anchorless or malformed year resolves on the screen it was asked for", async ({
    page,
  }) => {
    // The year the BROWSER thinks it is, read the same way the screens read it. Not a literal: a
    // literal would make this test start failing on 1 January.
    const thisYear = String(new Date().getFullYear()).padStart(4, "0");

    await openOverviewAs(page, MEMBER_EMAIL, OVERVIEW);

    // Anchorless, and malformed — both resolve to the current year ON THE OVERVIEW.
    for (const path of ["/year", "/year/banana"]) {
      await page.goto(path);
      await expect(page.getByTestId("year-overview")).toHaveAttribute("data-year", thisYear);
      await expect(page).toHaveURL(new RegExp(`/year/${thisYear}$`));
    }

    // AND THE THIRD ONE IS THE WHOLE POINT OF THE CRITERION: a malformed year under `/members`
    // resolves on the MEMBER GRID, for the current year. A mistyped address must never move the
    // caller between the two screens — before this the grid's own redirect sent them to `/year/…`,
    // which ADR-032 turned into the overview.
    await page.goto("/year/banana/members");
    await expect(page.getByTestId("year-grid")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/year/${thisYear}/members$`));
    await expect(page.getByTestId("year-overview")).toHaveCount(0);
  });

  test("AC-4: twelve month cards, in calendar order, Monday first, each holding only its own dates", async ({
    page,
  }) => {
    await openOverviewAs(page, MEMBER_EMAIL);

    const months = await page
      .getByTestId("year-month-card")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-month")));
    expect(months).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
      "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
    ]);

    // Seven labels per card, reading Mon to Sun — not `T2`…`CN`, which is § 1 Out-of-scope.
    await expect(page.getByTestId("year-month-weekday")).toHaveCount(84);
    const first = await monthCard(page, "2026-01")
      .getByTestId("year-month-weekday")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent));
    expect(first).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

    // One cell per DATE of the month and no date of any other month. February 2026 is 28 days;
    // April is 30. The leading blanks carry no test id, so this counts dates and not grid positions.
    await expect(monthCard(page, "2026-02").getByTestId("year-day-cell")).toHaveCount(28);
    await expect(monthCard(page, "2026-04").getByTestId("year-day-cell")).toHaveCount(30);
    await expect(page.getByTestId("year-day-cell")).toHaveCount(365);

    const april = await monthCard(page, "2026-04")
      .getByTestId("year-day-cell")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-date")));
    expect(april[0]).toBe("2026-04-01");
    expect(april[april.length - 1]).toBe("2026-04-30");
    expect(april.every((date) => date?.startsWith("2026-04"))).toBe(true);
  });

  test("AC-5, AC-6 and AC-7: the band is INV-04's total, its exact partition, and the holiday count", async ({
    page,
  }) => {
    await openOverviewAs(page, MEMBER_EMAIL);

    // AC-5. FIXTURE_APPROVED_ENTRY is three `full` days and is the team's only 2026 entry, so the
    // year's total is 3 — the same number and the same unit the member grid's per-day totals carry.
    expect(await valueOf(card(page, "total"))).toBe(3);

    // AC-6. The partition, and the identity is asserted ON THE SCREEN rather than only in the unit
    // test: the whole reason the band was designed this way is that a person can check it by eye.
    const pto = await valueOf(card(page, "pto"));
    const wfh = await valueOf(card(page, "wfh"));
    expect(pto).toBe(3);
    expect(wfh).toBe(0);
    expect(pto + wfh).toBe(await valueOf(card(page, "total")));

    // AC-7. THREE non-working holidays in 2026 — and the mandated WORKING Saturday of 13 June is
    // not among them, which is the half of the criterion a count of holiday ROWS would get wrong.
    expect(await valueOf(card(page, "holidays"))).toBe(3);
    await expect(dayCell(page, "2026-06-13")).toHaveAttribute("data-day-status", "working");

    // INV-07. FIXTURE_OTHER_TEAM_ENTRY is two `full` days in September and belongs to the other
    // team. If it were in scope the total would be 5, so this is the assertion that the first
    // whole-year aggregate in the product is still one team's.
    await expect(monthCard(page, "2026-09")).toHaveAttribute("data-count", "3");
    await expect(dayCell(page, "2026-09-21")).toHaveAttribute("data-types", "");
  });

  test("AC-8: a fractional total is shown as a fraction and never rounded", async ({ page }) => {
    // 2027 holds no entry and no holiday, so ONE am half day is the whole of the year — which is
    // what the criterion asks for and what the 2026 fixture cannot give.
    await openOverviewAs(page, MEMBER_EMAIL, "/year/2027");
    await declare(page, { start: "2027-04-07", end: "2027-04-07", portion: "am", type: "pto" });

    // Neither `0` nor `1`. Both are plausible and both are wrong, which is why this is a criterion.
    expect(await valueOf(card(page, "total"))).toBe(0.5);
    expect(await valueOf(card(page, "pto"))).toBe(0.5);
    await expect(card(page, "total")).toContainText("0.5");
    await expect(monthCard(page, "2027-04")).toHaveAttribute("data-count", "0.5");
    await expect(monthCard(page, "2027-04")).toContainText("0.5");
  });

  test("AC-9: a month card states its own count, and says so in words when it is zero", async ({
    page,
  }) => {
    await openOverviewAs(page, MEMBER_EMAIL);

    // September carries the fixture's three days, in the same unit as the band.
    await expect(monthCard(page, "2026-09")).toHaveAttribute("data-count", "3");
    await expect(monthCard(page, "2026-09")).toHaveAttribute("data-empty", "false");
    await expect(monthCard(page, "2026-09")).toContainText("September");
    await expect(monthCard(page, "2026-09")).toContainText("3");

    // AND AN EMPTY MONTH SAYS SO IN WORDS. A `0` in that slot reads as a number somebody measured;
    // the card is trying to say there was nothing to measure.
    await expect(monthCard(page, "2026-03")).toHaveAttribute("data-count", "0");
    await expect(monthCard(page, "2026-03")).toHaveAttribute("data-empty", "true");
    await expect(monthCard(page, "2026-03")).toContainText("Empty");
    await expect(page.locator('[data-testid="year-month-card"][data-empty="true"]')).toHaveCount(11);
  });

  test("AC-10: a day cell is tinted by what is declared on it, and carries its numeral", async ({
    page,
  }) => {
    await openOverviewAs(page, MEMBER_EMAIL, "/year/2027");

    // Four dates, four cases. The `am` and the `pm` on 8 April are two entries of ONE member on one
    // date, which INV-01 permits because the slots do not overlap — and it is the only way one
    // person produces a day carrying both types.
    await declare(page, { start: "2027-04-06", end: "2027-04-06", type: "pto" }, 1);
    await declare(page, { start: "2027-04-07", end: "2027-04-07", type: "wfh" }, 2);
    await declare(page, { start: "2027-04-08", end: "2027-04-08", portion: "am", type: "pto" }, 3);
    await declare(page, { start: "2027-04-08", end: "2027-04-08", portion: "pm", type: "wfh" }, 4);

    await expect(dayCell(page, "2027-04-06")).toHaveAttribute("data-types", "pto");
    await expect(dayCell(page, "2027-04-07")).toHaveAttribute("data-types", "wfh");
    await expect(dayCell(page, "2027-04-08")).toHaveAttribute("data-types", "pto wfh");
    await expect(dayCell(page, "2027-04-09")).toHaveAttribute("data-types", "");

    // Every cell carries the day-of-month numeral, tinted or not — the picture draws them and § 2b
    // makes it a criterion, because a pill with no number cannot be found by date.
    await expect(dayCell(page, "2027-04-06")).toHaveText("6");
    await expect(dayCell(page, "2027-04-09")).toHaveText("9");

    // The two halves of 8 April are one person-day, so the tint above is not a doubled count.
    await expect(monthCard(page, "2027-04")).toHaveAttribute("data-count", "3");
  });

  test("AC-11: a non-working holiday is lavender and outranks the type tint, and still counts", async ({
    page,
  }) => {
    await openOverviewAs(page, MEMBER_EMAIL, "/year/2026");

    // 15 October 2026 is a seeded NON-WORKING holiday. Declaring on it makes the date both things
    // at once, which is the case the criterion is about.
    await declare(page, { start: "2026-10-15", end: "2026-10-15", type: "pto" });

    await expect(dayCell(page, "2026-10-15")).toHaveAttribute("data-day-status", "holiday");

    // THE COLOUR IS LAVENDER AND THE TYPE TINT DOES NOT SHOW — that is the accepted loss § 2 Open
    // questions 3 records. `data-types` is where the fact stays observable, which is exactly why
    // § 4.4 put the attribute on this element.
    await expect(dayCell(page, "2026-10-15")).toHaveClass(/bg-holiday/);
    await expect(dayCell(page, "2026-10-15")).not.toHaveClass(/bg-pto/);
    await expect(dayCell(page, "2026-10-15")).toHaveAttribute("data-types", "pto");

    // AND NO NUMBER LIES. The entry is counted in the month and in the band, exactly as it would be
    // on an ordinary Thursday — a holiday changes what a day LOOKS like and never what it costs.
    await expect(monthCard(page, "2026-10")).toHaveAttribute("data-count", "1");
    expect(await valueOf(card(page, "total"))).toBe(4);
    expect(await valueOf(card(page, "pto"))).toBe(4);
  });

  test("AC-12: the counts and the faces come from one pass and cannot disagree", async ({ page }) => {
    await openOverviewAs(page, MEMBER_EMAIL);

    // September's three days are FIXTURE_APPROVED_MEMBER's, so exactly one face and it is theirs.
    const faces = monthCard(page, "2026-09").getByTestId("year-month-face");
    await expect(faces).toHaveCount(1);
    await expect(faces.first()).toHaveAttribute("data-member-id", APPROVED_MEMBER_ID);

    // A month with no count has no faces, and the two facts move together rather than separately.
    await expect(monthCard(page, "2026-03").getByTestId("year-month-face")).toHaveCount(0);

    // Declaring puts the SAME person in both the number and the footer, in the same render — which
    // is what "one pass" buys and what a second filter on this screen would break.
    await declare(page, { start: "2026-03-10", end: "2026-03-11", type: "wfh" });
    await expect(monthCard(page, "2026-03")).toHaveAttribute("data-count", "2");
    const march = monthCard(page, "2026-03").getByTestId("year-month-face");
    await expect(march).toHaveCount(1);
    await expect(march.first()).toHaveAttribute("data-member-id", MEMBER_ID);

    // The other team's entry puts nobody in September, so the faces are team-scoped too (INV-07).
    await expect(monthCard(page, "2026-09").getByTestId("year-month-face")).toHaveCount(1);
  });

  test("AC-13: every card links into the month view", async ({ page }) => {
    await openOverviewAs(page, MEMBER_EMAIL);

    // Twelve cards, twelve links — including the eleven empty ones, whose footer holds the link
    // alone (§ 2b's first arrangement decision).
    await expect(page.getByTestId("year-month-card-link")).toHaveCount(12);

    await monthCard(page, "2026-04").getByTestId("year-month-card-link").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-04");

    // CAL-06 AC-12 is NOT reworded by this ticket, and this is why: it requires a link back to the
    // month, and the card footer satisfies it as long as it targets `/month/yyyy-MM`.
    await expect(page).toHaveURL(/\/month\/2026-04$/);
  });

  test("AC-14: no session and no member row both land on the member-less state", async ({ page }) => {
    // The route is NOT guarded, deliberately (§ 3): the screen reads, so it refuses in place and
    // says why. A redirect would leave somebody who followed a shared year link with nothing to read.
    await page.goto(OVERVIEW);
    await expect(page.getByTestId("year-overview-not-on-a-team")).toBeVisible();
    await expect(page.getByTestId("year-summary-card")).toHaveCount(0);
    await expect(page.getByTestId("year-month-card")).toHaveCount(0);
    await expect(page.getByTestId("year-overview-sign-in")).toBeVisible();

    // A signed-in caller with NO MEMBER ROW reaches the same state, and correctly: there is no team
    // whose year this could be.
    await page.getByTestId("year-overview-sign-in").click();
    await signIn(page, MEMBER_LESS_EMAIL);
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();
    await backTo(page, OVERVIEW);
    await expect(page.getByTestId("year-overview-not-on-a-team")).toBeVisible();
    await expect(page.getByTestId("year-month-card")).toHaveCount(0);

    // AC-15 and AC-14's third state are the same `catch`, asserted the way this suite asserts every
    // failure branch: it is absent whenever the read succeeded. The header says why.
    await expect(page.getByTestId("year-overview-unavailable")).toHaveCount(0);
  });

  test("AC-16: stepping the year from the member grid stays on the member grid", async ({ page }) => {
    await page.goto("/year/2026/members");
    await page.getByTestId("year-sign-in").click();
    await signIn(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await backTo(page, "/year/2026/members");
    await expect(page.getByTestId("year-grid")).toBeVisible();

    // The suffix survives the step. Without it a member pressing "next" on the matrix silently
    // arrives at the overview, which is the one navigation failure nothing on the page explains.
    await page.getByTestId("year-prev").click();
    await expect(page).toHaveURL(/\/year\/2025\/members$/);
    await expect(page.getByTestId("year-grid")).toBeVisible();

    await page.getByTestId("year-next").click();
    await page.getByTestId("year-next").click();
    await expect(page).toHaveURL(/\/year\/2027\/members$/);
    await expect(page.getByTestId("year-grid")).toBeVisible();
    await expect(page.getByTestId("year-overview")).toHaveCount(0);

    // And the `Year` segment of the switcher is the route BACK to the overview — the only one the
    // shell can offer without a new control, which § 1 Out-of-scope forbids (§ 4.5).
    await page.getByTestId("year-year").click();
    await expect(page.getByTestId("year-overview")).toBeVisible();
    await expect(page.getByTestId("year-grid")).toHaveCount(0);
  });

  test("AC-17: the interface is in English, and no label reads as a balance", async ({ page }) => {
    await openOverviewAs(page, MEMBER_EMAIL);

    // Every string the screen RENDERS, read off the painted DOM rather than off the source — which
    // is the assertion eslint cannot make. `innerText` deliberately excludes the `title` attributes,
    // where a holiday's own Vietnamese name is USER CONTENT and is the standard's stated exception.
    const painted = await page.getByTestId("year-overview").innerText();
    expect(painted.length).toBeGreaterThan(0);
    expect(DIACRITIC.test(painted)).toBe(false);

    // Charter refusal 1 is BRUSHED and not crossed: counting what was declared is not a quota, and
    // the boundary is verbal. No allowance figure appears and no word implies one.
    for (const word of BALANCE_WORDS) {
      expect(painted.toLowerCase()).not.toContain(word);
    }

    // And the picture's own card title is not translated either — it names *total leave requests*,
    // which contradicts the two cards beneath it (§ 2 Open questions 1).
    await expect(card(page, "total")).toContainText("Total absence 2026");
    await expect(card(page, "pto")).toContainText("PTO days");
    await expect(card(page, "wfh")).toContainText("WFH days");
    await expect(card(page, "holidays")).toContainText("Public holidays");
  });
});
