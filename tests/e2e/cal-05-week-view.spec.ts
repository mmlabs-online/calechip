import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange } from "./support/entry-form";

// CAL-05 — the week view: who is away this week, for how much of each day, why, and who agreed.
//
// Written from 01-plan.md sections 2, 2b, 3, 4.2 and 4.3. Every locator is a `data-testid` from the
// selector table in section 4.3; the two this file uses that are NOT in that table — `week-sign-in`
// and `home-week-link` — are declared in 03-impl-log.md § Deviations.
//
// **THE DIVISION OF LABOUR WITH tests/absence.test.ts IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts pure logic at the unit level and "a full acceptance
// criterion through the interface" at this one. So AC-2's, AC-4's, AC-5's, AC-9's and AC-12's
// derivation is asserted there against `absentEntriesFor` directly, and this file asserts what a
// person SEES: the seven sections, the portions, the notes, the approver, the empty day, the address
// bar, and — AC-8 — the controls that are not there. AC-4 and AC-12 appear in both, because a
// five-day afternoon that derives correctly and renders as a whole day is still a wrong screen.
//
// **AC-10, AC-11 AND AC-15 ARE ASSERTED IN tests/absence.test.ts OR NOWHERE, AND THAT IS DECLARED
// IN 03-impl-log.md.**
// - AC-10 (a rejected entry is not listed) — nothing in the product can set `status` to `rejected`:
//   the insert grant excludes it, `entry_update_admin` excludes it, and ADM-05 does not exist. The
//   criterion has no interface to be observed through, so it is a unit test against the derivation.
// - AC-11 (a removed member's entries stop on the removal day) — nothing can remove a member partway
//   through a displayed week either; TEA-04's control writes `removed_at` as `now()`. Unit test.
// - AC-15 (a truncated read is refused) — a `>= MONTH_ENTRY_LIMIT` throw inside the seam. The mock's
//   entry table is bounded by the fixtures and cannot reach 2000 rows, and no test can make
//   PostgREST cap a read without a provisioned project. It is the same untested shape ROSTER_LIMIT,
//   OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT and CAL-04's AC-11 already carry.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the team scoping asserted below is the mock's reproduction of `entry_select_team`
// and `member_select_team`. This ticket ships no policy and no migration — every read it makes was
// already permitted (01-plan.md sections 3, 5 and 6).
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's tables and its session live in module memory
// and a `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links
// and by `page.goBack()`, both of which react-router handles client-side — the constraint CAL-01's,
// CAL-02's, CAL-03's and CAL-04's suites all record.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:      quan@example.com  (FIXTURE_ADMIN, "Quản trị", owl) — approved FIXTURE_APPROVED_ENTRY
// - Member:     thanh@example.com (FIXTURE_MEMBER, "Thành viên", cat) — owns nothing
// - Approved:   linh@example.com  (FIXTURE_APPROVED_MEMBER, "Đã duyệt") owns FIXTURE_APPROVED_ENTRY
// - Other team: chi@other.example.com (FIXTURE_OTHER_TEAM_MEMBER) owns FIXTURE_OTHER_TEAM_ENTRY
//
// FIXTURE_APPROVED_ENTRY runs 14 to 16 September 2026 — a Monday to a Wednesday — is `full`, `pto`,
// `approved` by FIXTURE_ADMIN, and carries a note. FIXTURE_OTHER_TEAM_ENTRY runs 21 to 22 September
// and belongs to the other team, which is what makes the following week empty rather than untested.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const ADMIN_EMAIL = "quan@example.com";

/** Monday of the week FIXTURE_APPROVED_ENTRY sits in. */
const WEEK = "/week/2026-09-14";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const APPROVED_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const ADMIN_NAME = "Quản trị";
const APPROVED_NOTE = "Nghỉ đã được duyệt";

const day = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="week-day"][data-date="${date}"]`);

const rowsOn = (page: Page, date: string): Locator => day(page, date).getByTestId("week-row");

const rowFor = (page: Page, date: string, memberId: string): Locator =>
  day(page, date).locator(`[data-testid="week-row"][data-member-id="${memberId}"]`);

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Walks history back to a week address. `page.goBack()` replays a react-router history entry, which
 *  is a popstate and not a reload — a `page.goto` would reset the mock's module state and lose both
 *  the session and every entry the test had created. */
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

/** Declares one entry through CAL-01's form and returns to the week, all client-side. */
async function declare(
  page: Page,
  fields: { start: string; end: string; portion?: string; type?: string; note?: string; tentative?: boolean },
): Promise<void> {
  const path = new URL(page.url()).pathname;

  // UIE-03 AC-12. The trip to the landing screen is deleted, not replaced: the create link is in
  // the TOP BAR and renders on the week itself.
  await page.getByTestId("home-new-entry-link").click();

  await pickRange(page, "new-entry", fields.start, fields.end);
  if (fields.portion) await choosePortion(page, "new-entry", fields.portion);
  if (fields.type) await chooseType(page, "new-entry", fields.type);
  if (fields.note) await page.getByTestId("new-entry-note").fill(fields.note);
  if (fields.tentative) await page.getByTestId("new-entry-tentative").check();

  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(1);

  await backToWeek(page, path);
}

test.describe("CAL-05 — week view", () => {
  test("AC-1: seven day sections, Monday to Sunday, anchored by the URL", async ({ page }) => {
    // The anchor is a WEDNESDAY, and the screen is the same one every other day of that week
    // produces — which is what makes a link from any date work (01-plan.md section 4.3).
    await openWeekAs(page, MEMBER_EMAIL, "/week/2026-09-16");

    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", "2026-09-14");
    await expect(page.getByTestId("week-day")).toHaveCount(7);

    const dates = await page.getByTestId("week-day").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-date")),
    );
    expect(dates).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);

    // Each section is labelled with its own date, so a person reading one row knows which day it is
    // on without counting from the top.
    await expect(day(page, "2026-09-14").getByTestId("week-day-label")).toContainText("Monday");
    await expect(day(page, "2026-09-20").getByTestId("week-day-label")).toContainText("Sunday");
  });

  test("AC-2 and AC-5: each absent person is named on each day they are away, and on no other", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    // FIXTURE_APPROVED_ENTRY runs 14 to 16 September inclusive.
    for (const date of ["2026-09-14", "2026-09-15", "2026-09-16"]) {
      await expect(rowFor(page, date, APPROVED_MEMBER_ID)).toHaveCount(1);
      await expect(rowFor(page, date, APPROVED_MEMBER_ID).getByTestId("week-row-name")).toHaveText(
        "Đã duyệt",
      );
      await expect(rowFor(page, date, APPROVED_MEMBER_ID).getByTestId("week-row-avatar")).toHaveCount(1);
    }
    await expect(rowsOn(page, "2026-09-17")).toHaveCount(0);

    // AC-5. An entry on this week's Monday and Tuesday shows on those days and on no other day of it.
    // **SOLO 2026-09-14: NARROWED.** This declared the SATURDAY BEFORE this week to its Tuesday — the
    // clamp, seen through the interface. The picker now disables weekends and does not join runs
    // across one, so no single entry can start before a Monday through the form any more; the clamp
    // itself is still asserted against `absentEntriesFor` in tests/absence.test.ts.
    await declare(page, { start: "2026-09-14", end: "2026-09-15" });

    await expect(rowFor(page, "2026-09-14", MEMBER_ID)).toHaveCount(1);
    await expect(rowFor(page, "2026-09-15", MEMBER_ID)).toHaveCount(1);
    await expect(rowFor(page, "2026-09-16", MEMBER_ID)).toHaveCount(0);
    await expect(rowFor(page, "2026-09-17", MEMBER_ID)).toHaveCount(0);
  });

  test("AC-3: a half day and a whole day on one day read as different values", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    // FIXTURE_APPROVED_ENTRY is already a `full` day on the 15th; this adds a MORNING beside it.
    await declare(page, { start: "2026-09-15", end: "2026-09-15", portion: "am" });

    await expect(rowsOn(page, "2026-09-15")).toHaveCount(2);
    await expect(
      rowFor(page, "2026-09-15", APPROVED_MEMBER_ID).getByTestId("week-row-portion"),
    ).toHaveAttribute("data-portion", "full");
    await expect(
      rowFor(page, "2026-09-15", MEMBER_ID).getByTestId("week-row-portion"),
    ).toHaveAttribute("data-portion", "am");

    // Two DIFFERENT values, and not both merely reading as absent — which is the whole criterion.
    const portions = await day(page, "2026-09-15")
      .getByTestId("week-row-portion")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-portion")));
    expect(new Set(portions).size).toBe(2);
  });

  test("AC-4 and INV-06: a five-day pm entry is five afternoons", async ({ page }) => {
    // The registry row calls this the only surface where INV-06 is visible, and the failure it names
    // is a half-day at ONE END with whole days in between. Monday to Friday of the displayed week.
    await openWeekAs(page, MEMBER_EMAIL);
    await declare(page, { start: "2026-09-14", end: "2026-09-18", portion: "pm" });

    for (const date of ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]) {
      await expect(
        rowFor(page, date, MEMBER_ID).getByTestId("week-row-portion"),
      ).toHaveAttribute("data-portion", "pm");
    }
    // And no sixth day: the weekend is untouched, so the five above are about this entry and not
    // about every row on the screen having turned into an afternoon.
    await expect(rowFor(page, "2026-09-19", MEMBER_ID)).toHaveCount(0);
    await expect(rowFor(page, "2026-09-20", MEMBER_ID)).toHaveCount(0);
  });

  test("AC-6, AC-7 and AC-9: the note, the approver and the tentative mark", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    // AC-7. FIXTURE_APPROVED_ENTRY is approved by FIXTURE_ADMIN, and the row names them — resolved
    // against the roster, so it is a display name and never a bare uuid.
    const approved = rowFor(page, "2026-09-15", APPROVED_MEMBER_ID);
    // SOLO 2026-09-13: the name is the star's accessible name and in the chip's hover card, no
    // longer chip text.
    await expect(approved.getByTestId("week-row-approver")).toHaveAttribute(
      "aria-label",
      `Approved by ${ADMIN_NAME}`,
    );
    await expect(approved).not.toContainText("Approved by");
    // AC-6. It carries a note, and the note is readable by the whole team — `entry_select_team` is a
    // row-level select policy (ADR-005), so this is a consequence of the policy and not of the view.
    await expect(approved.getByTestId("week-row-note")).toHaveText(APPROVED_NOTE);

    // A tentative entry with NO note, declared by somebody else on the same day.
    await declare(page, { start: "2026-09-15", end: "2026-09-15", portion: "am", tentative: true });
    const mine = rowFor(page, "2026-09-15", MEMBER_ID);

    // AC-9. Listed exactly as the settled entry is (INV-05), and additionally marked.
    await expect(mine).toHaveCount(1);
    // SOLO 2026-09-13: the word is screen-reader only; the dashed border is the visible mark.
    await expect(mine.getByTestId("week-row-tentative")).toHaveClass(/\bsr-only\b/);
    await expect(mine.getByTestId("week-row-tentative")).toHaveText("Tentative");
    // AC-7's other half: a pending entry shows NO approver, rather than an empty one.
    await expect(mine.getByTestId("week-row-approver")).toHaveCount(0);
    // AC-6's other half: no note element at all, rather than one with nothing in it.
    await expect(mine.getByTestId("week-row-note")).toHaveCount(0);
  });

  test("SOLO 2026-09-13: hovering or focusing a chip shows its full details, and leaving hides them", async ({
    page,
  }) => {
    await openWeekAs(page, MEMBER_EMAIL);
    const approved = rowFor(page, "2026-09-15", APPROVED_MEMBER_ID);
    const tooltip = page.getByTestId("week-row-tooltip");

    await expect(tooltip).toHaveCount(0);
    await approved.hover();
    await expect(tooltip).toBeVisible();
    // FIXTURE_APPROVED_ENTRY: leave, full day, 14 to 16 September, approved by the admin, with a note.
    await expect(tooltip.getByTestId("week-row-tooltip-kind")).toHaveText("Leave · Full day");
    await expect(tooltip.getByTestId("week-row-tooltip-dates")).toHaveText("14/09 → 16/09");
    await expect(tooltip.getByTestId("week-row-tooltip-status")).toHaveText("Approved");
    await expect(tooltip.getByTestId("week-row-tooltip-approver")).toHaveText(`⭐ Approved by ${ADMIN_NAME}`);
    await expect(tooltip.getByTestId("week-row-tooltip-note")).toHaveText(APPROVED_NOTE);
    const name = await approved.getByTestId("week-row-name").textContent();
    await expect(tooltip.getByTestId("week-row-tooltip-name")).toHaveText(name ?? "");

    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);

    // The keyboard reaches the same card, and the chip names it as its description.
    await approved.focus();
    await expect(tooltip).toBeVisible();
    await expect(approved).toHaveAttribute("aria-describedby", (await tooltip.getAttribute("id")) ?? "");
  });

  test("AC-8: displaying who approved is not approving — an admin sees exactly what a member sees", async ({ page }) => {
    await openWeekAs(page, ADMIN_EMAIL);

    // The approver's name is on screen (in the chip's hover card since SOLO 2026-09-13), which is
    // the whole of what this surface does with approval.
    await rowFor(page, "2026-09-15", APPROVED_MEMBER_ID).hover();
    await expect(page.getByTestId("week-row-tooltip-approver")).toHaveText(`⭐ Approved by ${ADMIN_NAME}`);

    // And there is no control over an ENTRY — for either role, since the screen branches on neither.
    // 01-plan.md section 3 names this the weakest mechanism in the plan: the denial is held by
    // ABSENCE, and this is where the absence is checked rather than assumed.
    await expect(page.locator('[data-testid="week-row"] button')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-row"] input')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"] form')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"] select')).toHaveCount(0);
    await expect(page.locator('[data-testid="week-day"] textarea')).toHaveCount(0);

    // **NARROWED BY SOLO 2026-09-11, AND THE CLAUSE THAT MOVED IS NAMED RATHER THAN QUIETLY
    // DROPPED.** This line read `'[data-testid="week-day"] button'` → 0. That was the right
    // assertion while the day column held nothing anybody could press; the busy control is a button
    // inside `week-day`, so the literal count is now 7 and the old line would fail.
    //
    // **WHAT THE CRITERION IS FOR SURVIVES, AND IS STILL CAPABLE OF FAILING.** AC-8 is about
    // APPROVAL — *"displaying who approved is not approving"* — and about this screen offering no
    // way to act on an ENTRY. A busy day is not an entry: it is the caller's own statement about
    // their own workload, it has no status, and nobody approves it. So the rule becomes *every
    // button inside a week day is the busy toggle, and there are exactly seven of them* — one per
    // day, none of them touching an entry. An approve, reject, edit or delete control added here
    // later still fails this test, which a bare `toHaveCount(7)` would not.
    //
    // **NARROWED AGAIN 2026-10-19.** Each day's foot now also carries `week-day-task-panel`, which
    // opens the viewer's OWN tasks for the day — not an entry, and not approval. So each day holds
    // exactly two buttons, the busy toggle and then the task panel, and anything else still fails.
    const dayButtons = page.locator('[data-testid="week-day"] button');
    await expect(dayButtons).toHaveCount(14);
    expect(
      await dayButtons.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-testid")),
      ),
    ).toEqual(Array.from({ length: 7 }, () => ["week-day-busy", "week-day-task-panel"]).flat());
    // No edit or delete route is offered either: the only links on this screen are the four in the
    // header, which are navigation and not action.
    await expect(page.locator('[data-testid="week-day"] a')).toHaveCount(0);
  });

  test("AC-13 and INV-07: a week with nobody away renders all seven days, each saying so", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    // The following week holds exactly one fixture entry, FIXTURE_OTHER_TEAM_ENTRY on 21 and 22
    // September — and it belongs to the OTHER TEAM, so this week is empty for this caller. That is
    // the assertion `entry_select_team` exists for (INV-07), and a one-team fixture could not make it.
    await page.getByTestId("week-next").click();
    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", "2026-09-21");

    await expect(page.getByTestId("week-day")).toHaveCount(7);
    await expect(page.getByTestId("week-day-empty")).toHaveCount(7);
    await expect(page.getByTestId("week-row")).toHaveCount(0);
    await expect(page.getByTestId("week-loading")).toHaveCount(0);
    await expect(page.getByTestId("week-unavailable")).toHaveCount(0);
  });

  test("AC-14: moving between weeks, and switching to the month, keeps the date", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL, "/week/2026-10-07");
    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", "2026-10-05");

    // The previous week is the seven days ENDING 2026-10-04.
    await page.getByTestId("week-prev").click();
    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", "2026-09-28");
    await expect(day(page, "2026-10-04")).toHaveCount(1);
    await expect(day(page, "2026-10-05")).toHaveCount(0);

    // And the next is the seven BEGINNING 2026-10-12, two presses on from there.
    await page.getByTestId("week-next").click();
    await page.getByTestId("week-next").click();
    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", "2026-10-12");
    await expect(day(page, "2026-10-12")).toHaveCount(1);
    await expect(day(page, "2026-10-18")).toHaveCount(1);

    // The address alone produces the same screen, so a week can be shared.
    await expect(page).toHaveURL(/\/week\/2026-10-12$/);
  });

  test("AC-12 and AC-14: the week and the month name the same people on a shared date", async ({ page }) => {
    await openWeekAs(page, MEMBER_EMAIL);

    // Two people on the 15th: FIXTURE_APPROVED_ENTRY, plus a morning declared here — so the sets
    // compared below are not both empty, which is the way this criterion passes without meaning
    // anything.
    await declare(page, { start: "2026-09-15", end: "2026-09-15", portion: "am" });

    const named = await day(page, "2026-09-15")
      .getByTestId("week-row")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-member-id")));
    expect(new Set(named)).toEqual(new Set([APPROVED_MEMBER_ID, MEMBER_ID]));

    // AC-14's second half: the link opens the month containing the week just left, client-side.
    await page.getByTestId("week-month").click();
    await expect(page.getByTestId("month-anchor")).toHaveAttribute("data-month", "2026-09");

    const drawn = await page
      .locator('[data-testid="month-cell"][data-date="2026-09-15"]')
      .getByTestId("month-avatar")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-member-id")));

    // The same SET of members. The month cell draws one avatar per person and the week lists one row
    // per entry, so the counts may differ where somebody holds an `am` and a `pm` — the identity
    // INV-04 requires is of the set, and a week naming somebody the month does not draw is exactly
    // the divergence the feature row names.
    expect(new Set(drawn)).toEqual(new Set(named));

    // And the month's own link comes back to a week inside that month, which is what makes the two
    // views a pair rather than two addresses.
    await page.getByTestId("month-week").click();
    await expect(page.getByTestId("week-anchor")).toBeVisible();
  });
});
