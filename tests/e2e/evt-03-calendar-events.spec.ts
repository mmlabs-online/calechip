import { expect, test, type Page } from "@playwright/test";

// EVT-03 — events drawn on the week and month grids. 01-plan.md § 2, § 4.8.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). The selection rules — taking part, the admin's
// other-team narrowing, the order — are asserted in `tests/event-layer.test.ts`; this file asserts
// what a person SEES on the two grids, and that nothing about absence moved.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-01-events.spec.ts` records, and the event tables
// start empty. So every journey creates its events by clicking, and reaches a calendar address with
// `walkTo` (a pushState plus a popstate), the helper `solo-busy-day.spec.ts` uses for this reason.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
// FIXTURE_APPROVED_MEMBER on the same team, chi@ is FIXTURE_OTHER_TEAM_MEMBER on team B, and quan@ is
// FIXTURE_ADMIN. The week of 2026-09-14 carries fixture entries (`cal-05-week-view.spec.ts`).

const PASSWORD = "password123";
const MEMBER = "thanh@example.com";
const TEAMMATE = "linh@example.com";
const OTHER_TEAM = "chi@other.example.com";
const ADMIN = "quan@example.com";
const TEAM_B = "44444444-4444-4444-8444-444444444444";

const NAMES = { member: "Thành viên", teammate: "Đã duyệt", otherTeam: "Người nhóm khác" };

async function fillSignIn(page: Page, email: string): Promise<void> {
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await fillSignIn(page, email);
}

async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await fillSignIn(page, email);
}

/** Move to an address WITHOUT a document load, so the mock keeps the events created above. */
async function walkTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => window.history.pushState({}, "", to), path);
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
}

async function createEvent(
  page: Page,
  values: {
    name: string;
    start: string;
    end: string;
    scope?: "team" | "named" | "public";
    invite?: string;
    inviteEmail?: string;
  },
): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(values.name);
  await page.getByTestId("event-start-input").fill(values.start);
  await page.getByTestId("event-end-input").fill(values.end);
  await page.getByTestId(`event-scope-${values.scope ?? "public"}`).check();
  if (values.invite !== undefined) {
    await page
      .getByTestId("event-picker")
      .getByTestId("event-picker-option")
      .filter({ hasText: values.invite })
      .click();
  }
  if (values.inviteEmail !== undefined) {
    await page.getByTestId("event-form-invite-input").fill(values.inviteEmail);
  }
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
}

const weekDay = (page: Page, date: string) =>
  page.locator(`[data-testid="week-day"][data-date="${date}"]`);
const monthCell = (page: Page, date: string) =>
  page.locator(`[data-testid="month-cell"][data-date="${date}"]`);
const chip = (page: Page, surface: "week" | "month", date: string, name: string) =>
  page.locator(`[data-testid="${surface}-event"][data-date="${date}"]`).filter({ hasText: name });

/** Every absence-side attribute of every day on the screen, for AC-15's before/after comparison. */
async function absenceSnapshot(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.map((n) =>
      [
        n.getAttribute("data-date"),
        n.getAttribute("data-count"),
        n.getAttribute("data-day-status"),
        n.getAttribute("data-bridge"),
        n.getAttribute("data-overloaded"),
        n.querySelectorAll('[data-testid="week-row"]').length,
        n.querySelectorAll('[data-testid="month-avatar"]').length,
        n.querySelectorAll('[data-testid="week-day-empty"]').length,
        n.querySelector('[data-testid="week-day-busy"]')?.getAttribute("data-busy-count") ?? "",
        n.querySelector('[data-testid="month-cell-busy"]')?.getAttribute("data-busy-count") ?? "",
        n.querySelector('[data-testid="week-day-count"]')?.textContent ?? "",
      ].join("|"),
    ),
  );
}

test.describe("EVT-03 — events on the week and month grids", () => {
  test("AC-1, AC-6, AC-7, AC-15, AC-16, AC-20: drawn across the span, marked when taking part, and no count moves", async ({ page }) => {
    await signIn(page, MEMBER);
    await walkTo(page, "/week/2026-09-14");
    await expect(page.getByTestId("week-day")).toHaveCount(7);
    // AC-20: no event, no furniture.
    await expect(page.getByTestId("week-event")).toHaveCount(0);
    await expect(page.getByTestId("week-events-unavailable")).toHaveCount(0);
    // The overload warning is drawn in the entry form, from the same counts `data-count` carries;
    // the month's overload fill is `data-overloaded`. Both are in the snapshot through those.
    const weekBefore = await absenceSnapshot(page, '[data-testid="week-day"]');

    await walkTo(page, "/month/2026-09");
    await expect(page.getByTestId("month-cell").first()).toBeVisible();
    const monthBefore = await absenceSnapshot(page, '[data-testid="month-cell"]');

    // AC-7: the creator takes part in their own event.
    await createEvent(page, { name: "Offsite", start: "2026-09-15", end: "2026-09-17" });
    // AC-6: an event the reader has no row on is not theirs.
    await switchTo(page, TEAMMATE);
    await createEvent(page, { name: "Workshop", start: "2026-09-15", end: "2026-09-15" });
    await switchTo(page, MEMBER);

    await walkTo(page, "/week/2026-09-14");
    await expect(page.getByTestId("week-day")).toHaveCount(7);
    for (const date of ["2026-09-15", "2026-09-16", "2026-09-17"]) {
      await expect(chip(page, "week", date, "Offsite")).toHaveCount(1);
      await expect(chip(page, "week", date, "Offsite")).toHaveAttribute("data-taking-part", "true");
    }
    await expect(page.getByTestId("week-event").filter({ hasText: "Offsite" })).toHaveCount(3);
    await expect(chip(page, "week", "2026-09-15", "Workshop")).toHaveAttribute("data-taking-part", "false");
    await expect(page.getByTestId("week-event").filter({ hasText: "Workshop" })).toHaveCount(1);
    await expect(page.getByTestId("week-events-unavailable")).toHaveCount(0);

    // AC-15, AC-16: every count, status, row and empty state is what it was without events.
    expect(await absenceSnapshot(page, '[data-testid="week-day"]')).toEqual(weekBefore);

    await walkTo(page, "/month/2026-09");
    for (const date of ["2026-09-15", "2026-09-16", "2026-09-17"]) {
      await expect(chip(page, "month", date, "Offsite")).toHaveCount(1);
    }
    await expect(page.getByTestId("month-event").filter({ hasText: "Offsite" })).toHaveCount(3);
    await expect(page.getByTestId("month-events-unavailable")).toHaveCount(0);
    expect(await absenceSnapshot(page, '[data-testid="month-cell"]')).toEqual(monthBefore);

    // AC-20: a week with no event has no event furniture.
    await walkTo(page, "/week/2026-10-05");
    await expect(page.getByTestId("week-day")).toHaveCount(7);
    await expect(page.getByTestId("week-event")).toHaveCount(0);
  });

  test("AC-2: a span is clipped to the month, never drawn on an out-of-month cell", async ({ page }) => {
    await signIn(page, MEMBER);
    await createEvent(page, { name: "Crossing", start: "2026-09-29", end: "2026-10-02" });

    await walkTo(page, "/month/2026-10");
    await expect(monthCell(page, "2026-10-01").getByTestId("month-event")).toHaveCount(1);
    await expect(monthCell(page, "2026-10-02").getByTestId("month-event")).toHaveCount(1);
    await expect(page.getByTestId("month-event")).toHaveCount(2);

    await walkTo(page, "/month/2026-09");
    await expect(monthCell(page, "2026-09-29").getByTestId("month-event")).toHaveCount(1);
    await expect(monthCell(page, "2026-09-30").getByTestId("month-event")).toHaveCount(1);
    await expect(page.getByTestId("month-event")).toHaveCount(2);
  });

  test("AC-13, AC-14: a click or Enter opens the event and nothing else", async ({ page }) => {
    await signIn(page, MEMBER);
    await createEvent(page, { name: "Retro", start: "2026-09-22", end: "2026-09-22" });

    await walkTo(page, "/month/2026-09");
    const onMonth = chip(page, "month", "2026-09-22", "Retro");
    await expect(onMonth).toHaveAccessibleName("Retro");
    const id = await onMonth.getAttribute("data-event-id");
    await onMonth.click();
    await expect(page).toHaveURL(new RegExp(`/events/${id}$`));
    await expect(page.getByTestId("event-name")).toHaveText("Retro");
    await expect(page.getByTestId("month-entry-modal")).toHaveCount(0);

    await walkTo(page, "/week/2026-09-21");
    const onWeek = chip(page, "week", "2026-09-22", "Retro");
    await onWeek.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/events/${id}$`));
  });

  test("AC-17, AC-18: a month cell draws two and says how many more; the week draws all four", async ({ page }) => {
    await signIn(page, MEMBER);
    for (const name of ["Delta", "Alpha", "Charlie", "Bravo"]) {
      await createEvent(page, { name, start: "2026-09-24", end: "2026-09-24" });
    }

    await walkTo(page, "/month/2026-09");
    const cell = monthCell(page, "2026-09-24");
    await expect(cell.getByTestId("month-event")).toHaveText(["● Alpha", "● Bravo"]);
    const more = cell.getByTestId("month-cell-events-more");
    await expect(more).toHaveText("+2 more");
    await expect(more).toHaveAttribute("data-hidden-count", "2");
    await expect(more).toHaveAttribute("title", "Charlie, Delta");

    await walkTo(page, "/week/2026-09-21");
    await expect(weekDay(page, "2026-09-24").getByTestId("week-event")).toHaveText([
      "● Alpha",
      "● Bravo",
      "● Charlie",
      "● Delta",
    ]);
  });

  test("AC-4, AC-9, AC-11: what a member cannot read is not drawn; an admin on team B sees team B's events", async ({ page }) => {
    await signIn(page, OTHER_TEAM);
    await createEvent(page, { name: "B team day", start: "2026-09-23", end: "2026-09-23", scope: "team" });
    await switchTo(page, MEMBER);
    await createEvent(page, { name: "Open day", start: "2026-09-23", end: "2026-09-23" });
    await createEvent(page, { name: "A team day", start: "2026-09-23", end: "2026-09-23", scope: "team" });
    // 2026-10-21, MIR-04 / ADR-066 1: the picker no longer offers another team; named by email instead.
    await createEvent(page, {
      name: "Named B",
      start: "2026-09-23",
      end: "2026-09-23",
      scope: "named",
      inviteEmail: OTHER_TEAM,
    });
    await createEvent(page, {
      name: "Named A",
      start: "2026-09-23",
      end: "2026-09-23",
      scope: "named",
      invite: NAMES.teammate,
    });

    // AC-4: team B's own-team event is not the member's to read, so it is not drawn.
    await walkTo(page, "/week/2026-09-21");
    const day = weekDay(page, "2026-09-23");
    await expect(day.getByTestId("week-event")).toHaveCount(4);
    await expect(day.getByTestId("week-event").filter({ hasText: "B team day" })).toHaveCount(0);

    // AC-9: on team B's view, public + team B's own + named inviting someone on team B.
    await switchTo(page, ADMIN);
    await walkTo(page, `/week/2026-09-21?team=${TEAM_B}`);
    const bDay = weekDay(page, "2026-09-23");
    await expect(bDay.getByTestId("week-event")).toHaveText(["B team day", "Named B", "Open day"]);
    for (const el of await bDay.getByTestId("week-event").all()) {
      // AC-11: the admin takes part in none of them.
      await expect(el).toHaveAttribute("data-taking-part", "false");
    }
  });
});
