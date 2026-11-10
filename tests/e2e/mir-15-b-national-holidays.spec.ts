import { expect, test, type Locator, type Page } from "@playwright/test";

// MIR-15-b AC-14 to AC-20 — Org public's holidays in the system panel, against the mock build
// (01-plan.md § 2, § 4.7).
//
// Every locator is a `data-testid` named in 01-plan.md § 4.6. "Signed in" is as
// `mir-18-b-org-management.spec.ts` does it: ops@calechip.test, `calechip-demo`, code `246810`.
//
// The mock seeds Org public's calendar with copies of FIXTURE_HOLIDAYS (src/lib/fixtures.ts).
// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from `src/`. All four rows are in 2026; 2027 carries none. The years
// below come from these rows, never from the clock — only "the current year" the section opens on
// is read from the clock, because that is what AC-14 asserts.

const PANEL = "/system.html";
const OPS = "ops@calechip.test";

const NOT_WORKING = "Not a working day";
const WORKING = "A working day";

interface Row {
  date: string;
  name: string;
  effect: string;
}

/** Ascending by date. */
const FIXTURE_ROWS: readonly Row[] = [
  { date: "2026-06-11", name: "Ngày lễ thử nghiệm", effect: NOT_WORKING },
  { date: "2026-06-13", name: "Làm bù thử nghiệm", effect: WORKING },
  { date: "2026-06-15", name: "Nghỉ bù thử nghiệm", effect: NOT_WORKING },
  { date: "2026-10-15", name: "Ngày nghỉ thử nghiệm", effect: NOT_WORKING },
];
const FIXTURE_YEAR = 2026;
const EMPTY_YEAR = 2027;

async function signInVerified(page: Page): Promise<void> {
  await page.goto(PANEL);
  await page.getByTestId("system-signin-email").fill(OPS);
  await page.getByTestId("system-signin-password").fill("calechip-demo");
  await page.getByTestId("system-signin-submit").click();
  await page.getByTestId("system-code-input").fill("246810");
  await page.getByTestId("system-code-submit").click();
  await expect(page.getByTestId("system-orgs")).toBeVisible();
}

function section(page: Page): Locator {
  return page.getByTestId("system-holidays");
}

function rows(page: Page): Locator {
  return section(page).getByTestId("system-holiday-row");
}

function row(page: Page, date: string): Locator {
  return section(page).locator(`[data-testid="system-holiday-row"][data-date="${date}"]`);
}

async function shownYear(page: Page): Promise<number> {
  return Number(await section(page).getByTestId("system-holidays-year").getAttribute("data-year"));
}

/** Presses ‹ or › until the section shows `target`. */
async function goToYear(page: Page, target: number): Promise<void> {
  let year = await shownYear(page);
  while (year !== target) {
    await section(page).getByTestId(year < target ? "system-holidays-next" : "system-holidays-prev").click();
    year += year < target ? 1 : -1;
    await expect(section(page).getByTestId("system-holidays-year")).toHaveAttribute("data-year", String(year));
  }
}

async function expectRows(page: Page, expected: readonly Row[]): Promise<void> {
  await expect(rows(page)).toHaveCount(expected.length);
  for (const [index, want] of expected.entries()) {
    const r = rows(page).nth(index);
    await expect(r).toHaveAttribute("data-date", want.date);
    await expect(r.getByTestId("system-holiday-row-date")).toHaveText(want.date);
    await expect(r.getByTestId("system-holiday-row-name")).toHaveText(want.name);
    await expect(r.getByTestId("system-holiday-row-effect")).toHaveText(want.effect);
  }
}

function fixtureRowsOf(year: number): readonly Row[] {
  return FIXTURE_ROWS.filter((r) => r.date.startsWith(`${year}-`));
}

async function expectYearLoaded(page: Page, year: number): Promise<void> {
  await expect(section(page).getByTestId("system-holidays-year")).toHaveAttribute("data-year", String(year));
  await expect(section(page).getByTestId("system-holidays-loading")).toHaveCount(0);
}

test.describe("MIR-15-b national holidays in the system panel", () => {
  test.beforeEach(async ({ page }) => {
    await signInVerified(page);
  });

  test("AC-14: the panel shows Org public's calendar for a year", async ({ page }) => {
    const current = new Date().getFullYear();
    await expect(section(page)).toBeVisible();
    await expect(section(page)).toContainText("National holidays");
    await expect(section(page)).toContainText("Org public");
    await expect(section(page).getByTestId("system-holidays-year")).toHaveAttribute("data-year", String(current));
    await expect(section(page).getByTestId("system-holidays-year")).toHaveText(String(current));

    // Below the orgs table.
    const orgsBox = await page.getByTestId("system-orgs").boundingBox();
    const holidaysBox = await section(page).boundingBox();
    expect(orgsBox).not.toBeNull();
    expect(holidaysBox).not.toBeNull();
    expect(holidaysBox!.y).toBeGreaterThan(orgsBox!.y + orgsBox!.height - 1);

    await goToYear(page, FIXTURE_YEAR);
    await expectRows(page, FIXTURE_ROWS);
  });

  test("AC-15: the panel moves between years", async ({ page }) => {
    const current = new Date().getFullYear();
    await expectYearLoaded(page, current);

    await section(page).getByTestId("system-holidays-next").click();
    await expectYearLoaded(page, current + 1);
    await expectRows(page, fixtureRowsOf(current + 1));

    await section(page).getByTestId("system-holidays-prev").click();
    await expectYearLoaded(page, current);
    await expectRows(page, fixtureRowsOf(current));

    // And a year that has rows, reached from either side.
    await goToYear(page, FIXTURE_YEAR - 1);
    await section(page).getByTestId("system-holidays-next").click();
    await expectYearLoaded(page, FIXTURE_YEAR);
    await expectRows(page, FIXTURE_ROWS);
  });

  test("AC-16: the panel says when a year has no rows", async ({ page }) => {
    await goToYear(page, EMPTY_YEAR);
    await expect(section(page).getByTestId("system-holidays-empty")).toHaveText(`No holidays in ${EMPTY_YEAR}.`);
    await expect(rows(page)).toHaveCount(0);
  });

  test("AC-17: the panel adds a day", async ({ page }) => {
    await goToYear(page, FIXTURE_YEAR);
    await section(page).getByTestId("system-holiday-new").click();
    const form = section(page).getByTestId("system-holiday-form");
    await expect(form).toBeVisible();
    await form.getByTestId("system-holiday-form-date").fill(`${EMPTY_YEAR}-02-10`);
    await form.getByTestId("system-holiday-form-name").fill("Tết thử nghiệm");
    await form.getByTestId("system-holiday-form-kind").selectOption("working");
    await form.getByTestId("system-holiday-form-submit").click();

    await expect(form).toHaveCount(0);
    // The section follows the added date's year.
    await expectYearLoaded(page, EMPTY_YEAR);
    await expectRows(page, [{ date: `${EMPTY_YEAR}-02-10`, name: "Tết thử nghiệm", effect: WORKING }]);
  });

  test("AC-18: the panel edits a day", async ({ page }) => {
    await goToYear(page, FIXTURE_YEAR);
    await row(page, "2026-10-15").getByTestId("system-holiday-row-edit").click();
    const form = section(page).getByTestId("system-holiday-form");
    await expect(form.getByTestId("system-holiday-form-date")).toHaveValue("2026-10-15");
    await expect(form.getByTestId("system-holiday-form-name")).toHaveValue("Ngày nghỉ thử nghiệm");
    await form.getByTestId("system-holiday-form-name").fill("Ngày nghỉ đổi tên");
    await form.getByTestId("system-holiday-form-kind").selectOption("working");
    await form.getByTestId("system-holiday-form-submit").click();

    await expect(form).toHaveCount(0);
    await expect(row(page, "2026-10-15").getByTestId("system-holiday-row-name")).toHaveText("Ngày nghỉ đổi tên");
    await expect(row(page, "2026-10-15").getByTestId("system-holiday-row-effect")).toHaveText(WORKING);
    await expect(rows(page)).toHaveCount(FIXTURE_ROWS.length);
  });

  test("AC-19: the panel removes a day only after a confirmation that names it", async ({ page }) => {
    await goToYear(page, FIXTURE_YEAR);
    const target = row(page, "2026-06-15");
    const confirm = section(page).getByTestId("system-holiday-delete-confirm");

    await target.getByTestId("system-holiday-row-delete").click();
    await expect(confirm).toBeVisible();
    await expect(confirm).toHaveAttribute("role", "alertdialog");
    await expect(confirm).toContainText("Remove 2026-06-15 — Nghỉ bù thử nghiệm from the national calendar?");
    await expect(target).toHaveCount(1);

    await confirm.getByTestId("system-holiday-delete-cancel").click();
    await expect(confirm).toHaveCount(0);
    await expect(target).toHaveCount(1);
    await expect(rows(page)).toHaveCount(FIXTURE_ROWS.length);

    await target.getByTestId("system-holiday-row-delete").click();
    await section(page).getByTestId("system-holiday-delete-accept").click();
    await expect(confirm).toHaveCount(0);
    await expect(target).toHaveCount(0);
    await expectRows(page, FIXTURE_ROWS.filter((r) => r.date !== "2026-06-15"));
  });

  test("AC-20: the panel says why a write was refused", async ({ page }) => {
    await goToYear(page, FIXTURE_YEAR);
    await section(page).getByTestId("system-holiday-new").click();
    const form = section(page).getByTestId("system-holiday-form");
    const error = form.getByTestId("system-holiday-form-error");

    await form.getByTestId("system-holiday-form-date").fill("2026-06-11");
    await form.getByTestId("system-holiday-form-name").fill("Again");
    await form.getByTestId("system-holiday-form-submit").click();
    await expect(error).toHaveText("The calendar already has a row for that date. Edit that row instead.");
    await expect(form).toBeVisible();

    await form.getByTestId("system-holiday-form-date").fill("2026-06-20");
    await form.getByTestId("system-holiday-form-name").fill("   ");
    await form.getByTestId("system-holiday-form-submit").click();
    await expect(error).toHaveText("A date and a name are required.");
    await expect(form).toBeVisible();

    await expectRows(page, FIXTURE_ROWS);
  });
});
