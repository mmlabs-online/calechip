import { expect, test, type Page } from "@playwright/test";

// ADM-03 — add, edit or delete a holiday or swap day.
//
// Written from 01-plan.md sections 2, 4.4 and 4.5. Every locator is a `data-testid` from the
// selector table in section 4.5, plus the `holidays-*` ids ADM-02 shipped and this suite only reads,
// and the `sign-in-*` and `home-*` ids the earlier suites own.
//
// **THREE CRITERIA ARE ASSERTED NOWHERE HERE, AND THAT IS DECLARED IN 03-impl-log.md.**
// - AC-15 (a write refused below the interface) and AC-16 (a removed admin refused) — this suite
//   drives the browser and cannot call a seam function with a chosen caller. They are
//   tests/holiday-writes.test.ts's, which is the file 01-plan.md section 7 exists for.
// - AC-17 (the permission table gains no row) — a fact about
//   `.ai/standards/rbac-and-security.md`, checked by reading the file, not by a browser.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so what it observes is the mock's reproduction of `holiday_insert_admin`,
// `holiday_update_admin`, `holiday_delete_admin`, the write grant and `unique (date)`. The real
// mechanisms are in supabase/migrations/20260905140000_adm03_holiday_writes.sql and are exercised by
// no test until a project is provisioned — RULE-09 keeps applying it human.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's tables and its session live in module memory
// and a `page.goto` reloads the module. That is what makes a suite of writes safe to run in any
// order: nothing any test adds, edits or deletes survives into the next one. Navigation WITHIN a
// test is done by clicking links, which react-router handles client-side — the constraint every
// suite from CAL-01 onwards records.
//
// THE DATES BELOW ARE IN 2028, WHICH THE FIXTURES LEAVE EMPTY, so a test that adds a row never meets
// `unique (date)` by accident. The four seeded rows are all in 2026 and 2027 carries none — and this
// suite never edits or deletes one of them, so ADM-02's own assertions about them stay true.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:  quan@example.com   (FIXTURE_ADMIN)
// - Member: thanh@example.com  (FIXTURE_MEMBER)
//
// **MIR-15-e, ADR-079 decision 5.** Since MIR-15-b an admin of Org public is refused all three
// writes (`holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin` each gained
// `and not public.org_is_shared(org_id)`), so every test ABOVE this paragraph that exercises a
// successful write now runs as Quan-D — the same account, placed in the mock's dedicated org by
// `page.addInitScript`, writing `DEDICATED_ORG_STORAGE_KEY` (`src/lib/data/mock.ts`) before the
// app's first load, the way TEA-05 AC-7 already pins `SESSION_STORAGE_KEY` the same way. There is
// no fixture account in a dedicated org (01-plan.md § 1 *Out of scope*): this is the test switch
// that reaches that path without one. The `MIR-15-e` describe block at the bottom is Quan
// (Org public's own admin) and Quan-D side by side, where the criterion is about the difference.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
/** FIXTURE_ADMIN.id (src/lib/fixtures.ts). Transcribed rather than imported: the acceptance suite
 *  addresses the application through the browser and does not import from `src/`. */
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";

const SIGNIN = "/signin";

/** MIR-15-e. Places Quan in the mock's dedicated org before the app's first load — Quan-D,
 *  01-plan.md § 4.3. Must be called before the first `page.goto`. */
async function placeAdminInDedicatedOrg(page: Page): Promise<void> {
  await page.addInitScript((adminId: string) => {
    localStorage.setItem("calechip.mock.dedicatedOrgMembers", JSON.stringify([adminId]));
  }, ADMIN_ID);
}

/** An empty year, so an add lands in a list holding only what the test put there. */
const EMPTY_YEAR = "2028";
const A_DATE = "2028-04-30";
const ANOTHER_DATE = "2028-09-02";
/** In a DIFFERENT year from the one the screen shows, which is the whole of AC-4. */
const NEXT_YEAR_DATE = "2029-01-01";

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Signs in and reaches the calendar through its LINK, then walks to the empty year. Keeps one page
 *  lifetime, so the mock's tables survive the whole test. */
async function openCalendar(page: Page, email: string, year = EMPTY_YEAR): Promise<void> {
  await signIn(page, email);
  await reachHolidays(page);
  await expect(page.getByTestId("holidays-year")).toBeVisible();

  // By address rather than by pressing *next* the right number of times, so this helper does not
  // depend on which year the machine running it thinks it is.
  await page.goto(`/holidays/${year}`);
  await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", year);
}

/** Fills the add form and saves. Every field, every time — the form keeps `kind` between saves, so
 *  setting it explicitly is what stops one test's choice leaking into the next assertion. */
async function add(page: Page, date: string, name: string, kind: string): Promise<void> {
  await page.getByTestId("holiday-add-date").fill(date);
  await page.getByTestId("holiday-add-name").fill(name);
  await page.getByTestId("holiday-add-kind").selectOption(kind);
  await page.getByTestId("holiday-add-submit").click();
}

const rowFor = (page: Page, date: string) =>
  page.locator(`[data-testid="holidays-row"][data-date="${date}"]`);

const drawnDates = (page: Page): Promise<string[]> =>
  page
    .getByTestId("holidays-row")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-date") ?? ""));

test.describe("ADM-03 add, edit or delete a holiday or swap day", () => {
  test.beforeEach(async ({ page }) => {
    // MIR-15-e. Every test below is Quan-D's — see the paragraph above the fixtures list.
    await placeAdminInDedicatedOrg(page);

    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  // -------------------------------------------------------------------------
  // Adding.
  // -------------------------------------------------------------------------

  test("AC-1: an admin adds a holiday, and it is still there when the year is re-opened", async ({
    page,
  }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await expect(page.getByTestId("holidays-beyond-calendar")).toBeVisible();

    await add(page, A_DATE, "A national day", "non_working");

    await expect(rowFor(page, A_DATE)).toBeVisible();
    await expect(rowFor(page, A_DATE).getByTestId("holidays-row-name")).toHaveText("A national day");

    // RE-OPENED, so this is the stored row and not the one the form was holding. Away by link and
    // back by link, which keeps the page lifetime and therefore the mock's table.
    await page.getByTestId("holidays-prev").click();
    await page.getByTestId("holidays-next").click();
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", EMPTY_YEAR);
    await expect(rowFor(page, A_DATE)).toBeVisible();
  });

  test("AC-2: a mandated working Saturday is presented as a working day", async ({ page }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "A mandated working Saturday", "working");

    const row = rowFor(page, A_DATE);
    await expect(row).toBeVisible();
    // The ATTRIBUTE carries the criterion, so it asserts the enum rather than parsing copy — and the
    // words beside it must say the opposite of what a holiday's row says, which is the confusion
    // ADR-015 section 2 exists to prevent.
    await expect(row).toHaveAttribute("data-kind", "working");

    await add(page, ANOTHER_DATE, "An ordinary holiday", "non_working");
    const holiday = rowFor(page, ANOTHER_DATE);
    await expect(holiday).toHaveAttribute("data-kind", "non_working");

    const workingEffect = await row.getByTestId("holidays-row-effect").textContent();
    const holidayEffect = await holiday.getByTestId("holidays-row-effect").textContent();
    expect(workingEffect?.trim()).not.toHaveLength(0);
    expect(workingEffect).not.toEqual(holidayEffect);
  });

  test("AC-3: the kind is already chosen when the form opens, and both values are offered", async ({
    page,
  }) => {
    await openCalendar(page, ADMIN_EMAIL);

    const kind = page.getByTestId("holiday-add-kind");
    // A STATED DEFAULT, and it is the column's own — a form opening on `working` would file every
    // holiday entered by somebody who did not look at this control as its exact inverse.
    await expect(kind).toHaveValue("non_working");

    const values = await kind
      .locator("option")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value));
    expect(values).toEqual(["non_working", "working"]);

    // The labels say the EFFECT on the working calendar rather than repeating the row's name, which
    // is what lets a person choose correctly while glossary.md still conflates the two Vietnamese
    // labels (01-plan.md Open question 4).
    const labels = await kind
      .locator("option")
      .evaluateAll((nodes) => nodes.map((n) => (n.textContent ?? "").trim()));
    expect(labels[0]).not.toEqual(labels[1]);
    for (const label of labels) expect(label).not.toHaveLength(0);
  });

  test("AC-4: a row added outside the displayed year says where it went", async ({ page }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, NEXT_YEAR_DATE, "A day next year", "non_working");

    // Without this the row is saved and then invisible, which is indistinguishable from a save that
    // failed. It NAMES the year rather than saying the add worked.
    const notice = page.getByTestId("holidays-added-elsewhere");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("2029");

    // And the year on screen has NOT quietly changed underneath the person.
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", EMPTY_YEAR);
    await expect(rowFor(page, NEXT_YEAR_DATE)).toHaveCount(0);

    // The way there is offered, and the row is on the other end of it.
    await notice.getByRole("link").click();
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", "2029");
    await expect(rowFor(page, NEXT_YEAR_DATE)).toBeVisible();
  });

  test("AC-5: an empty name or a missing date is refused before any write", async ({ page }) => {
    await openCalendar(page, ADMIN_EMAIL);

    // A name of spaces only. `name text not null` would accept it and the row would name nothing.
    await page.getByTestId("holiday-add-date").fill(A_DATE);
    await page.getByTestId("holiday-add-name").fill("   ");
    await page.getByTestId("holiday-add-submit").click();

    await expect(page.getByTestId("holiday-add-error")).toBeVisible();
    await expect(page.getByTestId("holidays-row")).toHaveCount(0);

    // And a name with no date.
    await page.getByTestId("holiday-add-date").fill("");
    await page.getByTestId("holiday-add-name").fill("A day with no date");
    await page.getByTestId("holiday-add-submit").click();

    await expect(page.getByTestId("holiday-add-error")).toBeVisible();
    await expect(page.getByTestId("holidays-row")).toHaveCount(0);
    // The year is still the empty one, so nothing was stored anywhere else either.
    await expect(page.getByTestId("holidays-beyond-calendar")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // The constraint a person meets.
  // -------------------------------------------------------------------------

  test("AC-6: a second row for a date already in the calendar is refused, and says so", async ({
    page,
  }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "The first observance", "non_working");
    await expect(rowFor(page, A_DATE)).toBeVisible();

    await add(page, A_DATE, "A second observance", "non_working");

    const error = page.getByTestId("holiday-add-error");
    await expect(error).toBeVisible();
    // A SENTENCE AND NOT A DATABASE ERROR. `23505` is turned into words in the seam; nothing that
    // looks like a SQLSTATE or a constraint name may reach this node.
    await expect(error).not.toContainText("23505");
    await expect(error).not.toContainText("holiday_date");

    // And nothing was stored: one row for that date, still carrying the first name.
    await expect(page.getByTestId("holidays-row")).toHaveCount(1);
    await expect(rowFor(page, A_DATE).getByTestId("holidays-row-name")).toHaveText(
      "The first observance",
    );
  });

  test("AC-7: moving a row onto an occupied date is refused, and both rows are unchanged", async ({
    page,
  }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "The one being edited", "non_working");
    await add(page, ANOTHER_DATE, "The one already there", "working");
    await expect(page.getByTestId("holidays-row")).toHaveCount(2);

    await rowFor(page, A_DATE).getByTestId("holidays-row-edit").click();
    await page.getByTestId("holiday-edit-date").fill(ANOTHER_DATE);
    await page.getByTestId("holiday-edit-submit").click();

    const error = page.getByTestId("holiday-edit-error");
    await expect(error).toBeVisible();
    await expect(error).not.toContainText("23505");

    // BOTH rows unchanged, and still two of them — a refused edit that had written half of itself
    // would show here as a moved date with the old name.
    expect(await drawnDates(page)).toEqual([A_DATE, ANOTHER_DATE]);
    await expect(rowFor(page, A_DATE).getByTestId("holidays-row-name")).toHaveText(
      "The one being edited",
    );
    await expect(rowFor(page, ANOTHER_DATE).getByTestId("holidays-row-name")).toHaveText(
      "The one already there",
    );
  });

  // -------------------------------------------------------------------------
  // Editing.
  // -------------------------------------------------------------------------

  test("AC-8: an admin corrects a row's date, name and kind, and no second row appears", async ({
    page,
  }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "Before", "non_working");

    await rowFor(page, A_DATE).getByTestId("holidays-row-edit").click();
    await page.getByTestId("holiday-edit-date").fill(ANOTHER_DATE);
    await page.getByTestId("holiday-edit-name").fill("After");
    await page.getByTestId("holiday-edit-kind").selectOption("working");
    await page.getByTestId("holiday-edit-submit").click();

    await expect(page.getByTestId("holidays-row")).toHaveCount(1);
    const row = rowFor(page, ANOTHER_DATE);
    await expect(row.getByTestId("holidays-row-name")).toHaveText("After");
    await expect(row).toHaveAttribute("data-kind", "working");
    // The old date is gone, which is what separates an UPDATE from an insert.
    await expect(rowFor(page, A_DATE)).toHaveCount(0);
  });

  test("AC-9: the edit form opens carrying the row's current values", async ({ page }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "A working Saturday", "working");

    await rowFor(page, A_DATE).getByTestId("holidays-row-edit").click();

    // NOT BLANK AND NOT DEFAULTS. `kind` is the one that matters most: an edit form opening on
    // `non_working` would silently flip a mandated Saturday for anybody correcting only its name.
    await expect(page.getByTestId("holiday-edit-date")).toHaveValue(A_DATE);
    await expect(page.getByTestId("holiday-edit-name")).toHaveValue("A working Saturday");
    await expect(page.getByTestId("holiday-edit-kind")).toHaveValue("working");
  });

  test("AC-10: editing one row leaves every other row alone", async ({ page }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "The one being edited", "non_working");
    await add(page, ANOTHER_DATE, "The neighbour", "working");

    await rowFor(page, A_DATE).getByTestId("holidays-row-edit").click();
    await page.getByTestId("holiday-edit-name").fill("Edited");
    await page.getByTestId("holiday-edit-submit").click();

    const neighbour = rowFor(page, ANOTHER_DATE);
    await expect(neighbour.getByTestId("holidays-row-name")).toHaveText("The neighbour");
    await expect(neighbour).toHaveAttribute("data-kind", "working");
    await expect(neighbour.getByTestId("holidays-row-date")).toHaveText(ANOTHER_DATE);
  });

  // -------------------------------------------------------------------------
  // Deleting.
  // -------------------------------------------------------------------------

  test("AC-11: deleting takes two presses, and the confirmation names the date and the label", async ({
    page,
  }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "The one going away", "non_working");

    await rowFor(page, A_DATE).getByTestId("holidays-row-delete").click();

    // NOTHING IS REMOVED YET. The first press opens a question; it does not answer it.
    await expect(rowFor(page, A_DATE)).toBeVisible();

    const confirm = page.getByTestId("holidays-row-delete-confirm");
    await expect(confirm).toBeVisible();
    // It names BOTH, because either alone is ambiguous on this table: the date without the name does
    // not say which observance is going, and the name without the date does not say which year's
    // row. "Are you sure?" names nothing (.ai/standards/ui-design-system.md, Destructive actions).
    await expect(confirm).toContainText(A_DATE);
    await expect(confirm).toContainText("The one going away");

    await page.getByTestId("holidays-row-delete-confirm-accept").click();

    await expect(rowFor(page, A_DATE)).toHaveCount(0);
    // Gone from the DATASTORE and not only from the list: re-reading the year finds nothing.
    await page.getByTestId("holidays-prev").click();
    await page.getByTestId("holidays-next").click();
    await expect(page.getByTestId("holidays-row")).toHaveCount(0);
    await expect(page.getByTestId("holidays-beyond-calendar")).toBeVisible();
  });

  test("AC-12: a delete can be abandoned", async ({ page }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "Staying put", "working");

    await rowFor(page, A_DATE).getByTestId("holidays-row-delete").click();
    await expect(page.getByTestId("holidays-row-delete-confirm")).toBeVisible();
    await page.getByTestId("holidays-row-delete-confirm-cancel").click();

    await expect(page.getByTestId("holidays-row-delete-confirm")).toHaveCount(0);
    const row = rowFor(page, A_DATE);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("holidays-row-name")).toHaveText("Staying put");
    await expect(row).toHaveAttribute("data-kind", "working");
  });

  test("AC-13: only the confirmed row is deleted", async ({ page }) => {
    await openCalendar(page, ADMIN_EMAIL);
    await add(page, A_DATE, "Going", "non_working");
    await add(page, ANOTHER_DATE, "Staying", "working");

    await rowFor(page, A_DATE).getByTestId("holidays-row-delete").click();
    await page.getByTestId("holidays-row-delete-confirm-accept").click();

    expect(await drawnDates(page)).toEqual([ANOTHER_DATE]);
    await expect(rowFor(page, ANOTHER_DATE).getByTestId("holidays-row-name")).toHaveText("Staying");
  });

  // -------------------------------------------------------------------------
  // Permission, and the read that did not change.
  // -------------------------------------------------------------------------

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-14: a member is offered no control and still sees the whole calendar", async ({
    page,
  }) => {
    // The seeded year, so there is a calendar to see rather than an empty one — the criterion is
    // that the CALENDAR is shown in full and the CONTROLS are not shown at all.
    await openCalendar(page, MEMBER_EMAIL, "2026");

    await expect(page.getByTestId("holidays-row")).toHaveCount(4);
    await expect(page.getByTestId("holiday-add-form")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-edit")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-delete")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-delete-confirm")).toHaveCount(0);
    await expect(page.getByTestId("holidays-unavailable")).toHaveCount(0);

    // It is an AFFORDANCE and never the check: `holiday_insert_admin`, `holiday_update_admin` and
    // `holiday_delete_admin` are what refuse this member, and tests/holiday-writes.test.ts is where
    // that is asserted (AC-15).
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-18: an admin and a member read the same rows, in the same order", async ({ page }) => {
    await openCalendar(page, MEMBER_EMAIL, "2026");
    const asMember = await drawnDates(page);
    expect(asMember).toHaveLength(4);

    // UIE-03 AC-12. The back-link step is deleted; sign-out is in the sidebar, on this screen.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    await openCalendar(page, ADMIN_EMAIL, "2026");
    // The admin now has controls on the screen, and the ROWS are still identical — adding the write
    // half changed nothing about who reads what or in what order.
    await expect(page.getByTestId("holiday-add-form")).toBeVisible();
    expect(await drawnDates(page)).toEqual(asMember);
  });
});

// ---------------------------------------------------------------------------
// MIR-15-e, ADR-079 decision 5. 01-plan.md §§ 2, 4.6. Quan (Org public's own admin) and Quan-D side
// by side — the two halves of the permission table (01-plan.md § 3) the describe block above cannot
// show, because every test there is Quan-D's.
//
// NO SHARED `beforeEach` NAVIGATES HERE, AND THAT IS DELIBERATE. `DEDICATED_ORG_STORAGE_KEY` is read
// once at module load (`src/lib/data/mock.ts`), so `placeAdminInDedicatedOrg` must run BEFORE the
// app's first `page.goto` — a shared `beforeEach` that navigated first, the way the describe block
// above does, would make AC-3 and AC-6's own call to it arrive one document load too late and leave
// Quan reading Org public throughout. `startSignedOut` below is the two lines that beforeEach used
// to own, called by every test here in whichever order its own criterion needs.
// ---------------------------------------------------------------------------

/** The two lines `test.beforeEach` owns in the describe block above, extracted so a test that needs
 *  `placeAdminInDedicatedOrg` first can call it first. */
async function startSignedOut(page: Page): Promise<void> {
  await page.goto(SIGNIN);
  const loading = page.getByTestId("app-session-loading");
  if (await loading.isVisible()) await expect(loading).toBeHidden();
}

test.describe("MIR-15-e — Org public's holidays are the system admin's, through the interface", () => {
  test("MIR-15-e AC-1: an admin of Org public is offered no holiday write", async ({ page }) => {
    await startSignedOut(page);
    await openCalendar(page, ADMIN_EMAIL, "2026");

    await expect(page.getByTestId("holidays-row")).toHaveCount(4);
    await expect(page.getByTestId("holiday-add-form")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-edit")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-delete")).toHaveCount(0);
  });

  test("MIR-15-e AC-2: and is told who sets the calendar", async ({ page }) => {
    await startSignedOut(page);
    await openCalendar(page, ADMIN_EMAIL, "2026");

    await expect(page.getByTestId("holidays-set-by-system")).toBeVisible();
    await expect(page.getByTestId("holidays-set-by-system")).toContainText(
      "set by a system admin",
    );
  });

  test("MIR-15-e AC-3: a dedicated org's admin keeps all three controls", async ({ page }) => {
    await placeAdminInDedicatedOrg(page);
    await startSignedOut(page);

    await openCalendar(page, ADMIN_EMAIL);
    await expect(page.getByTestId("holidays-set-by-system")).toHaveCount(0);

    await add(page, A_DATE, "Quan-D's own day", "non_working");
    const row = rowFor(page, A_DATE);
    await expect(row).toBeVisible();

    await row.getByTestId("holidays-row-edit").click();
    await page.getByTestId("holiday-edit-name").fill("Edited by Quan-D");
    await page.getByTestId("holiday-edit-submit").click();
    await expect(row.getByTestId("holidays-row-name")).toHaveText("Edited by Quan-D");

    await row.getByTestId("holidays-row-delete").click();
    await page.getByTestId("holidays-row-delete-confirm-accept").click();
    await expect(row).toHaveCount(0);
  });

  // BY ADDRESS, NOT THROUGH `openCalendar`/`reachHolidays`. BUG-003 (docs/ops/e2e-quarantine.md)
  // has removed `home-holidays-link` from the sidebar for every role, which is what every OTHER
  // member-role test reaching this screen through the link is quarantined over; the sidebar click
  // hangs forever when there is no admin tab to fall back to either. This criterion is about the
  // SCREEN a member reaches, not the link, and AC-4's own wording ("he opens /holidays/2026") is
  // already an address — matching the route by address sidesteps BUG-003 rather than working
  // around it.
  test("MIR-15-e AC-4: a member is still offered nothing, and sees no system-admin line", async ({
    page,
  }) => {
    await startSignedOut(page);
    await signIn(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();

    await page.goto("/holidays/2026");
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", "2026");

    await expect(page.getByTestId("holidays-row")).toHaveCount(4);
    await expect(page.getByTestId("holiday-add-form")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-edit")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-delete")).toHaveCount(0);
    await expect(page.getByTestId("holidays-set-by-system")).toHaveCount(0);
  });

  // MIR-15-e AC-6. AS QUAN-D, DELIBERATELY — a dedicated org's admin is who the database would
  // otherwise let write, so a failure here must still show no control for a REASON OTHER THAN "this
  // is Org public's admin". The route-rewrite pattern of
  // tests/e2e/mir-14-b-worklist-teams.spec.ts:71-90: the mock bundle's `async isOwnOrgShared(){` is
  // prefixed with a throw, asserted to match exactly once, so a build that stops matching fails
  // loudly here rather than letting AC-6 pass for the wrong reason.
  test("MIR-15-e AC-6: when whether the org is shared cannot be read, no write control is shown", async ({
    page,
  }) => {
    await placeAdminInDedicatedOrg(page);

    await page.route(/\/assets\/.*\.js$/, async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const pattern = /async isOwnOrgShared\(\)\{/g;
      const matches = source.match(pattern) ?? [];
      if (matches.length === 0) {
        await route.fulfill({ response, body: source });
        return;
      }
      expect(matches, "isOwnOrgShared appears once in the mock bundle").toHaveLength(1);
      const body = source.replace(
        pattern,
        () => `async isOwnOrgShared(){throw Error("MIR-15-e AC-6 injected failure");`,
      );
      await route.fulfill({ response, body });
    });

    await startSignedOut(page);
    await openCalendar(page, ADMIN_EMAIL, "2026");

    await expect(page.getByTestId("holidays-row")).toHaveCount(4);
    await expect(page.getByTestId("holiday-add-form")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-edit")).toHaveCount(0);
    await expect(page.getByTestId("holidays-row-delete")).toHaveCount(0);
    await expect(page.getByTestId("holidays-set-by-system")).toHaveCount(0);
  });
});

/** The role-dependent walk to `/holidays`, from anywhere inside the shell. */
async function reachHolidays(page: Page): Promise<void> {
  // SOLO 2026-09-12. **THE ROUTE TO `/holidays` NOW DEPENDS ON THE ROLE, AND THIS BRANCH IS THAT
  // FACT.** The operator moved Public holidays into the admin panel: an admin reaches it through the
  // tab strip, a member through the sidebar link, and NEITHER ROLE IS OFFERED BOTH. Branching on
  // which control exists rather than on the email keeps one page lifetime for both — a `page.goto`
  // would reload the module the mock's tables live in and lose the setup.
  // **WAIT FOR THE SHELL BEFORE COUNTING ANYTHING.** `count()` does not auto-wait, so called while
  // `useSession` is still resolving it answers zero for BOTH controls and the branch below picks the
  // wrong arm and hangs. The sidebar renders for either role, so it is the one landmark that means
  // "the shell is up" without already assuming which role is reading.
  await expect(page.getByTestId("shell-sidebar")).toBeVisible();

  const sidebarLink = page.getByTestId("home-holidays-link");
  if ((await sidebarLink.count()) > 0) {
    await sidebarLink.click();
  } else {
    const tab = page.getByTestId("admin-hub-holidays-link");
    if ((await tab.count()) === 0) await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-holidays-link").click();
  }
}
