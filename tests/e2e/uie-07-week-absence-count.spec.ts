import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, pickRange } from "./support/entry-form";

// UIE-07 — the week view renders a per-day absence count.
//
// Written from 01-plan.md sections 2, 2b, 4.2, 4.3 and 7. Every locator is a `data-testid`;
// `week-day-count` is the one this ticket adds and `data-count` / `data-current-members` are the two
// attributes it borrows verbatim from the month grid.
//
// **THE DIVISION OF LABOUR WITH tests/absence.test.ts IS THE STANDARD'S**, and this file exists for
// the half it cannot reach. `tests/absence.test.ts:151-157` already fixes the arithmetic — one
// member's `am` and `pm` on one date is 1 and not 1.5 or 2 — at the unit level, against
// `absenceCountsFor` directly. What is asserted below is that the SCREEN shows what the module says.
// That is the whole of the ticket: INV-04 permits this number on a second surface and forbids a
// second definition of it, and the cheapest wrong path — a local sum over the `absent` map already
// in scope three lines from the strip — needs no new data, reads as reuse, and would pass every
// existing test. AC-3 and AC-4 are the two assertions that catch it.
//
// **AC-9 (`n/0`) IS ASSERTED NOWHERE, AND THAT IS DECLARED IN 03-impl-log.md.** It needs a roster on
// which every member carries a `removedAt`, and nothing in the product can empty a team: TEA-04's
// control writes `removed_at` on one member at a time and the fixture team's four current members
// include the caller, who cannot remove themselves out of the read. The criterion is held by the
// code shape instead — nothing in the strip divides, so there is no `NaN` branch to reach — which is
// the same untested shape CAL-05 AC-10, AC-11 and AC-15 already carry.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), and EACH TEST GETS FRESH MOCK STATE, so navigation WITHIN a test is by clicking links
// and by `page.goBack()` — a `page.goto` reloads the module and loses both the session and every
// entry the test created.
//
// Fixtures (src/lib/fixtures.ts). The team holds FIVE members and ONE of them carries a `removedAt`,
// so the denominator is FOUR on every assertion below — computed by `currentMemberCount`, never a
// literal in the product. `tests/e2e/cal-04-month-view.spec.ts:226` reads the same 4 off
// `month-threshold`. FIXTURE_APPROVED_ENTRY runs 14 to 16 September 2026, is `full` and `approved`;
// FIXTURE_OTHER_TEAM_ENTRY runs 21 to 22 September and belongs to the other team, which is what
// makes the week of 21 September empty for this caller rather than untested.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";

/** Monday of the week FIXTURE_APPROVED_ENTRY sits in, and Monday of the week that is empty. */
const WEEK = "/week/2026-09-14";
const EMPTY_WEEK = "/week/2026-09-21";

/** The seven dates of `WEEK`, and of `EMPTY_WEEK`. Every criterion below that says "all seven"
 *  iterates one of these rather than counting elements, so a strip that renders on six days and a
 *  wrong element on the seventh cannot pass by arithmetic. */
const WEEK_DATES = [
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
] as const;

const EMPTY_WEEK_DATES = [
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
] as const;

const day = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="week-day"][data-date="${date}"]`);

const countOn = (page: Page, date: string): Locator => day(page, date).getByTestId("week-day-count");

const rowsOn = (page: Page, date: string): Locator => day(page, date).getByTestId("week-row");

/** The VISIBLE text of a strip: its own text, with every `sr-only` descendant removed.
 *
 *  **AC-10 IS TWO ASSERTIONS ABOUT ONE ELEMENT AND THEY NEED TWO READS.** `toHaveText` reads
 *  `textContent`, which includes the visually hidden name — so asserting the visible half through it
 *  would assert the opposite of what the criterion says. The accessible half is asserted with plain
 *  `toHaveText` further down, because a screen reader reading a `<p>` reads exactly that string:
 *  "Absence count: 0.5/4". `toHaveAccessibleName` is NOT used and that is deliberate — `role=
 *  paragraph` takes no name from its content, so it reports empty here, which says nothing about
 *  what is announced. The plan chose the sr-only span over an `aria-label` for that reason: it adds
 *  the name to the READING ORDER without overriding the numbers. */
const visibleText = (strip: Locator): Promise<string> =>
  strip.evaluate((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
    return (clone.textContent ?? "").trim();
  });

const monthCell = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="month-cell"][data-date="${date}"]`);

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Walks history back to a week address. `page.goBack()` replays a react-router history entry, which
 *  is a popstate and not a reload — a `page.goto` would reset the mock's module state. */
async function backToWeek(page: Page, path: string): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (new URL(page.url()).pathname === path) break;
    await page.goBack();
  }
  await expect(page.getByTestId("week-anchor")).toBeVisible();
}

/** Signed out on a week address, then signed in and back on it — without a document load. */
async function openWeekAs(page: Page, email: string, path: string = WEEK): Promise<void> {
  await page.goto(path);
  await page.getByTestId("week-sign-in").click();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await backToWeek(page, path);
}

/** Declares one entry through CAL-01's form and returns to the week, all client-side.
 *
 *  CAL-05's own helper is not reused: it asserts `own-entry-row` `toHaveCount(1)` after the submit,
 *  and AC-4 needs the SAME member to hold TWO entries on one date. `ownRows` is that count, passed
 *  in rather than relaxed to a `>= 1`, so the second declaration still proves it landed. */
async function declare(
  page: Page,
  fields: { start: string; end: string; portion: string },
  ownRows: number,
): Promise<void> {
  const path = new URL(page.url()).pathname;

  await page.getByTestId("home-new-entry-link").click();
  await pickRange(page, "new-entry", fields.start, fields.end);
  await choosePortion(page, "new-entry", fields.portion);
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(ownRows);

  await backToWeek(page, path);
}

test.describe("UIE-07 — the week view's per-day absence count", () => {
  test("AC-1, AC-6 and AC-8: every day carries one count element, two numbers and a slash", async ({
    page,
  }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    // AC-1. Seven columns, seven count elements, one each.
    await expect(page.getByTestId("week-day")).toHaveCount(7);
    await expect(page.getByTestId("week-day-count")).toHaveCount(7);

    // AC-8 and AC-10. The VISIBLE text is the two numbers and the slash and NOTHING ELSE — no noun,
    // no word in any language, no `%`. The regex is anchored on both ends so an added label fails
    // it, and it permits a decimal because INV-06 requires one on a half day.
    for (const date of WEEK_DATES) {
      expect(await visibleText(countOn(page, date))).toMatch(/^\d+(\.\d+)?\/\d+$/);
    }

    // AC-6. The denominator is the SAME on all seven, and it is the four current members of a
    // five-member team — computed from `removedAt`, never a literal. `cal-04-month-view.spec.ts:226`
    // reads the same 4 off `month-threshold`, which is what makes the two screens agree by
    // derivation rather than by two authors typing the same digit.
    // Asserted per column rather than on the seven at once, because "the SAME number on all seven"
    // is the criterion and a single assertion over a multi-element locator cannot say it.
    for (const date of WEEK_DATES) {
      await expect(countOn(page, date)).toHaveAttribute("data-current-members", "4");
      expect(await visibleText(countOn(page, date))).toContain("/4");
    }

    // FIXTURE_APPROVED_ENTRY is one `full` entry on Monday to Wednesday and nothing else is in this
    // week, so the first three days read 1 and the last four read 0.
    expect(await visibleText(countOn(page, "2026-09-14"))).toBe("1/4");
    expect(await visibleText(countOn(page, "2026-09-16"))).toBe("1/4");
    expect(await visibleText(countOn(page, "2026-09-17"))).toBe("0/4");
  });

  test("AC-3 and INV-06: a half day is a half — one row over 0.5", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL, EMPTY_WEEK);
    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", "2026-09-21");

    // A single `am` entry on the Wednesday, on a week that is otherwise empty for this caller.
    await declare(page, { start: "2026-09-23", end: "2026-09-23", portion: "am" }, 1);

    // ONE row and the count reads 0.5 — not 0, and not 1. This is the case the operator's image
    // cannot show, and the one CAL-05's objection (three chips over 1.5/N) is about.
    await expect(rowsOn(page, "2026-09-23")).toHaveCount(1);
    expect(await visibleText(countOn(page, "2026-09-23"))).toBe("0.5/4");

    // AC-8's "no rounding", stated on the attribute as well as the text so a `toFixed(0)` cannot
    // pass by rendering `1` beside a `week-row-portion` pill that reads Morning.
    await expect(day(page, "2026-09-23")).toHaveAttribute("data-count", "0.5");
    await expect(rowsOn(page, "2026-09-23").getByTestId("week-row-portion")).toHaveText("Morning");

    // AC-5. The neighbouring days still read 0, so the number is the date's own and not the week's.
    expect(await visibleText(countOn(page, "2026-09-22"))).toBe("0/4");
    expect(await visibleText(countOn(page, "2026-09-24"))).toBe("0/4");
  });

  test("AC-4 and AC-5: one member's morning and afternoon on one date is TWO rows over 1", async ({
    page,
  }) => {
    await openWeekAs(page, MEMBER_EMAIL, EMPTY_WEEK);

    await declare(page, { start: "2026-09-24", end: "2026-09-24", portion: "am" }, 1);
    await declare(page, { start: "2026-09-24", end: "2026-09-24", portion: "pm" }, 2);

    // **THE DIRECT RENDERED REFUTATION OF BOTH WRONG PATHS.** The day's chip count would read 2 and
    // a local sum over the `absent` map would read 1.5; INV-04 says 1, because one member away for a
    // morning and an afternoon of the same date is away for one day. The row count and the number
    // are asserted TOGETHER on purpose — either alone is satisfiable by the wrong derivation.
    await expect(rowsOn(page, "2026-09-24")).toHaveCount(2);
    expect(await visibleText(countOn(page, "2026-09-24"))).toBe("1/4");
    await expect(day(page, "2026-09-24")).toHaveAttribute("data-count", "1");
  });

  test("AC-2: the number is the one the month grid shows for the same date", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    // A half day on the Thursday of the fixture week, so the comparison below is made on a date
    // where the number is NOT whole — the case a rounding on either screen would break.
    await declare(page, { start: "2026-09-17", end: "2026-09-17", portion: "am" }, 1);
    expect(await visibleText(countOn(page, "2026-09-17"))).toBe("0.5/4");

    const whole = await day(page, "2026-09-14").getAttribute("data-count");
    const half = await day(page, "2026-09-17").getAttribute("data-count");
    expect(whole).toBe("1");
    expect(half).toBe("0.5");

    // The same two dates on the month grid, read through the attribute the week borrowed from it.
    // ADR-031 is REJECTED, so `month-cell-count` stays exactly where it is and the agreement between
    // the two screens stays VISIBLE — which is the whole argument for the strip.
    await page.getByTestId("week-month").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-09");

    await expect(monthCell(page, "2026-09-14")).toHaveAttribute("data-count", whole ?? "");
    await expect(monthCell(page, "2026-09-17")).toHaveAttribute("data-count", half ?? "");
    await expect(monthCell(page, "2026-09-17").getByTestId("month-cell-count")).toHaveText("0.5");
  });

  test("AC-7 and AC-13: an empty week keeps all seven strips, at 0/4, and renames nothing", async ({
    page,
  }) => {
    await openWeekAs(page, MEMBER_EMAIL, EMPTY_WEEK);
    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", "2026-09-21");

    // AC-7. The strip does NOT follow `month-cell-count`, which renders only when the count is
    // greater than zero — following it here would make all seven vanish on exactly the week where
    // `0/4` is what makes keeping "Everybody is in." arguable (01-plan.md § 8 alternative 1).
    await expect(page.getByTestId("week-day-count")).toHaveCount(7);
    for (const date of EMPTY_WEEK_DATES) {
      expect(await visibleText(countOn(page, date))).toBe("0/4");
    }

    // AC-13. The shipped empty state keeps its element, its selector and its sentence, and all seven
    // still render — `cal-05-week-view.spec.ts:266` asserts the same count and is unedited by this
    // ticket. The strip is an ADDITION and the middle path of emptying `week-day-empty` was refused.
    await expect(page.getByTestId("week-day-empty")).toHaveCount(7);
    await expect(page.getByTestId("week-day-empty").first()).toHaveText("Everybody is in.");
    await expect(page.getByTestId("week-row")).toHaveCount(0);
  });

  test("AC-10, AC-11 and AC-12: named to a screen reader, not on screen; no state, no control", async ({
    page,
  }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    const monday = countOn(page, "2026-09-14");

    // AC-10. The ACCESSIBLE reading carries the glossary's own English term and the visible one does
    // not. `sr-only` keeps the name in the reading order without overriding the numbers, which an
    // `aria-label` on the `<p>` would have done.
    // The reading order — what is ANNOUNCED — carries the glossary's exact English term.
    await expect(monday).toHaveText("Absence count: 1/4");
    // And the same element, read as it is SEEN, carries no noun and no word in any language.
    expect(await visibleText(monday)).toBe("1/4");

    // AC-11. No overload state reaches this screen: no threshold is read, so `month-threshold` — the
    // element that carries it on the month grid — has no counterpart here, and the strip carries no
    // overload attribute of its own.
    await expect(page.getByTestId("month-threshold")).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"][data-overloaded]')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day-count"][data-overloaded]')).toHaveCount(0);

    // AC-12. The strip is a `<p>` holding two `<span>`s, so CAL-05 AC-8's absence mechanism is
    // untouched. Re-asserted here rather than inferred from a spec file this ticket never opens.
    //
    // **THE STRIP ITSELF IS STILL EXACTLY WHAT AC-12 SAYS IT IS**, and these two lines are the half
    // of the criterion that did not move: whatever else the day column grows, `week-day-count`
    // holds no control and no link.
    await expect(page.locator('[data-testid="week-day-count"] button')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day-count"] a')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"] form')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"] select')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"] textarea')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"] a')).toHaveCount(0);

    // **NARROWED BY SOLO 2026-09-11, THE SAME WAY AND FOR THE SAME REASON AS CAL-05 AC-8** — which
    // this block says in its own first sentence it is re-asserting, so the two had to move together
    // or stop agreeing. The line that stood here read `'[data-testid="week-day"] button'` → 0, and
    // the busy toggle is a button inside `week-day`.
    //
    // WHAT AC-12 IS FOR SURVIVES AND CAN STILL FAIL: the absence count grew no control, and the
    // only button in the column is the busy toggle — one per day, touching no entry and no
    // threshold. An overload control, an approve button or an edit link added to this column later
    // still fails here, which a bare `toHaveCount(7)` would not.
    //
    // **NARROWED AGAIN 2026-10-19, WITH CAL-05 AC-8.** The column's foot now carries the viewer's
    // own task panel too, which opens their tasks and touches no entry and no threshold — so two
    // buttons per day, the busy toggle and then the task panel, and nothing else.
    const dayButtons = page.locator('[data-testid="week-day"] button');
    await expect(dayButtons).toHaveCount(14);
    expect(
      await dayButtons.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-testid")),
      ),
    ).toEqual(Array.from({ length: 7 }, () => ["week-day-busy", "week-day-task-panel"]).flat());
  });
});
