import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange, setRange, unpickDate } from "./support/entry-form";

// CAL-07 — the overload warning, shown while choosing dates and before the entry is saved.
//
// Written from 01-plan.md sections 2, 4.2 and 4.3. Every locator is a `data-testid` from the table in
// section 4.3, plus `data-type` on `<prefix>-overload-person`, which is declared in 03-impl-log.md as
// an addition: the plan requires PTO peach and WFH mint on those markers, and
// `.ai/standards/testing-standards.md` forbids asserting on a style class, so without the attribute
// that requirement is unobservable through the interface.
//
// **THE DIVISION OF LABOUR WITH tests/draft-entry.test.ts IS THE STANDARD'S.** Pure logic is at the
// unit level, "a full acceptance criterion through the interface" is here. So AC-4, AC-5, AC-8,
// AC-17 and AC-18's arithmetic is asserted there against the real `absenceCountsFor`, and this file
// asserts what a person SEES: the block, the day it names, the people on it, the save control beside
// it, and the moment the warning goes away. AC-4, AC-8 and AC-17 appear in both, because a count
// that sums correctly and renders as a different number is still a wrong screen.
//
// **AC-15 AND AC-21 ARE NOT ASSERTED ANYWHERE, and both absences are declared in 03-impl-log.md.**
// AC-15 is a claim about `.ai/standards/rbac-and-security.md`, which is not in `allowed_paths` and
// which RULE-03 forbids this ticket to touch — the diff is the evidence and a test could only
// restate it. AC-21 needs a read that FAILS or that the seam refuses as truncated: the mock's entry
// table is bounded by the fixtures and cannot reach MONTH_ENTRY_LIMIT, and no test can make
// PostgREST cap a read without a provisioned project. It is the same untested shape CAL-04 AC-11
// already carries.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise). Nothing asserted below is a refusal, which is the unusual thing about this ticket: the
// warning is an affordance end to end and the datastore is never asked to agree with it.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's entry table lives in module memory and a
// `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links and
// by `page.goBack()`, both of which react-router handles client-side — the constraint CAL-01's,
// CAL-02's, CAL-03's and CAL-04's suites all record. It is also why each test seeds its own crowded
// day.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:      quan@example.com  (FIXTURE_ADMIN, no seeded entries)
// - Member:     thanh@example.com (FIXTURE_MEMBER, no seeded entries)
// - 2nd admin:  dung@example.com  (FIXTURE_SECOND_ADMIN, no seeded entries)
// - Approved:   linh@example.com  (FIXTURE_APPROVED_MEMBER, owns FIXTURE_APPROVED_ENTRY)
//
// FIXTURE_TEAM has FOUR members with `removed_at is null` and an `overload_threshold` of 0.5, so a
// day is crowded strictly above 2.0 — which is what makes the boundary reachable here: a prospective
// 2.0 raises nothing, 2.5 and 3.0 do. FIXTURE_APPROVED_ENTRY already puts 1.0 on 14, 15 and 16
// September 2026.

const SIGNIN = "/signin";
const PASSWORD = "password123";

const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const SECOND_ADMIN_EMAIL = "dung@example.com";

// Member ids and the approved entry's id, transcribed rather than imported: the acceptance suite
// addresses the application through the browser and does not import from src/.
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const SECOND_ADMIN_ID = "88888888-8888-4888-8888-888888888888";
const OWNER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const APPROVED_ENTRY_ID = "dd000000-0000-4000-8000-000000000001";

/** 1.0 from FIXTURE_APPROVED_ENTRY, plus whatever a test seeds onto it. */
const CROWDED = "2026-09-14";
/** FIXTURE_APPROVED_ENTRY and nobody else: 1.0, so a draft takes it to exactly 2.0. AC-3. */
const NEXT_DAY = "2026-09-15";
/** Nobody at all. */
const QUIET = "2026-09-17";

/**
 * The debounce in src/components/OverloadWarning.tsx plus a margin.
 *
 * A warning that is never going to appear fires no event, so `toHaveCount(0)` on a fresh range
 * passes instantly and would pass just as well against a warning arriving 300 ms later. Every
 * NEGATIVE assertion below waits this out first. Positive ones do not need it — Playwright retries.
 */
const PAST_THE_DEBOUNCE = 1200;

const overload = (page: Page, prefix: string): Locator => page.getByTestId(`${prefix}-overload`);

const day = (page: Page, prefix: string, date: string): Locator =>
  page.locator(`[data-testid="${prefix}-overload-day"][data-date="${date}"]`);

const peopleOn = (page: Page, prefix: string, date: string): Locator =>
  day(page, prefix, date).getByTestId(`${prefix}-overload-person`);

const person = (page: Page, prefix: string, date: string, memberId: string): Locator =>
  day(page, prefix, date).locator(
    `[data-testid="${prefix}-overload-person"][data-member-id="${memberId}"]`,
  );

const ownRows = (page: Page) => page.getByTestId("own-entry-row");

const teamRow = (page: Page, entryId: string): Locator =>
  page.locator(`[data-testid="team-entry-row"][data-entry-id="${entryId}"]`);

async function signInAs(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Ends the session without a document load, so the entries an earlier step created survive into the
 *  next account's view — the whole reason these tests can seed a crowded day across accounts. */
async function signOutFromHome(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

/** `page.goBack()` replays a history entry react-router pushed, which is a popstate and not a
 *  reload. `page.goto("/")` would reset the mock's module state and lose the seed. */
async function backToHome(page: Page): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (new URL(page.url()).pathname === "/") break;
    await page.goBack();
  }
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function openOwnList(page: Page): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();
  await expect(page.getByTestId("new-entry-form")).toBeVisible();
}

/** **TWO CLICKS SINCE UIE-10**, which removed the sidebar's four admin links: the top-bar control,
 *  then the hub row UIE-09 shipped. The destination is unchanged. */
async function openTeamList(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-team-entries-link").click();
  await expect(page.getByTestId("team-entries-loading")).toBeHidden();
}

interface EntryInput {
  type?: "pto" | "wfh";
  portion?: "full" | "am" | "pm";
  start: string;
  end: string;
  tentative?: boolean;
  note?: string;
}

/** The six fields, all six SET rather than left holding whatever the control carried — the lesson
 *  CAL-01's suite records about the sticky tentative flag. */
async function fillEntry(page: Page, prefix: string, input: EntryInput): Promise<void> {
  await chooseType(page, prefix, input.type ?? "pto");
  await choosePortion(page, prefix, input.portion ?? "full");
  // SOLO, 2026-09-10. `setRange` and not `pickRange`: the two date inputs this replaces overwrote
  // whatever they held, and a picker is a toggle — so the selection is emptied before the new days
  // are chosen. Several tests below fill the same form twice.
  await setRange(page, prefix, input.start, input.end);
  await page.getByTestId(`${prefix}-tentative`).setChecked(input.tentative ?? false);
  if (input.note !== undefined) await page.getByTestId(`${prefix}-note`).fill(input.note);
}

async function createOwnEntry(page: Page, input: EntryInput): Promise<void> {
  await fillEntry(page, "new-entry", input);
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
}

/**
 * Puts a full day on `CROWDED` for each account named, through the only path there is — the owner's
 * own form — and leaves the page on the sign-in screen.
 *
 * With one account seeded the day stands at 2.0 of 4 (that account plus FIXTURE_APPROVED_ENTRY),
 * which is EXACTLY the threshold: a draft on top of it is 3.0 and crowded, and that is the shape
 * AC-1, AC-2 and AC-3 are written against.
 */
async function seedCrowdedDay(page: Page, emails: readonly string[]): Promise<void> {
  for (const email of emails) {
    await signInAs(page, email);
    await openOwnList(page);
    await createOwnEntry(page, { start: CROWDED, end: CROWDED });
    await expect(ownRows(page)).toHaveCount(1);
    await backToHome(page);
    await signOutFromHome(page);
  }
}

/** Signed in, on the new-entry form, with the seed already in place. */
async function draftAs(page: Page, email: string): Promise<void> {
  await signInAs(page, email);
  await openOwnList(page);
}

test.describe("CAL-07 the overload warning", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("AC-1, AC-2, AC-3, AC-6: the crowded day is named with the count it WILL have, and the uncrowded one is not", async ({
    page,
  }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    // Two days: the 14th stands at 2.0 of 4 and the 15th at 1.0. Nothing is saved anywhere below.
    await fillEntry(page, "new-entry", { start: CROWDED, end: NEXT_DAY });

    await expect(overload(page, "new-entry")).toBeVisible();

    // AC-2. THREE, not two: the number the day will have if this draft is saved. A warning reporting
    // the count the day already has would be reporting something the month grid already shows.
    await expect(day(page, "new-entry", CROWDED)).toHaveAttribute("data-count", "3");
    await expect(day(page, "new-entry", CROWDED)).toHaveAttribute("data-current-members", "4");
    await expect(day(page, "new-entry", CROWDED)).toContainText("3 of 4");

    // AC-3 and AC-6. The 15th reaches exactly 2.0 of 4, which is the threshold and not above it, so
    // it is not named — and the comparison being strict is the whole of it.
    await expect(day(page, "new-entry", NEXT_DAY)).toHaveCount(0);
    await expect(page.getByTestId("new-entry-overload-day")).toHaveCount(1);

    // AC-1's other half: the datastore holds no new entry. The own list is this account's, and it
    // was empty when the form opened.
    await expect(page.getByTestId("own-entries-empty")).toBeVisible();
  });

  test("AC-4: a half-day draft weighs half a day, and the day is still crowded", async ({ page }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    await fillEntry(page, "new-entry", { start: CROWDED, end: CROWDED });
    await expect(day(page, "new-entry", CROWDED)).toHaveAttribute("data-count", "3");

    // Changing the portion touches no date, so this is recomputed from the rows already held and
    // reaches the datastore not at all.
    await choosePortion(page, "new-entry", "am");
    await expect(day(page, "new-entry", CROWDED)).toHaveAttribute("data-count", "2.5");
    await expect(day(page, "new-entry", CROWDED)).toContainText("2.5 of 4");

    await choosePortion(page, "new-entry", "full");
    await expect(day(page, "new-entry", CROWDED)).toHaveAttribute("data-count", "3");
  });

  test("AC-7: the warning names everyone the count includes, the drafter among them", async ({
    page,
  }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    await fillEntry(page, "new-entry", { start: CROWDED, end: CROWDED });
    await expect(overload(page, "new-entry")).toBeVisible();

    // Three people for a count of three: the two who are already down for the day and the person
    // whose draft it is. A list short of the count is the failure this asserts against.
    await expect(peopleOn(page, "new-entry", CROWDED)).toHaveCount(3);
    await expect(person(page, "new-entry", CROWDED, OWNER_ID)).toHaveCount(1);
    await expect(person(page, "new-entry", CROWDED, MEMBER_ID)).toHaveCount(1);
    await expect(person(page, "new-entry", CROWDED, SECOND_ADMIN_ID)).toHaveCount(1);

    // The month grid's vocabulary, reused rather than reinvented (01-plan.md Open question 2):
    // FIXTURE_APPROVED_ENTRY is approved, the seeded one is pending, and the draft is the draft.
    await expect(person(page, "new-entry", CROWDED, OWNER_ID)).toHaveAttribute(
      "data-status",
      "approved",
    );
    await expect(person(page, "new-entry", CROWDED, MEMBER_ID)).toHaveAttribute(
      "data-status",
      "pending",
    );
    await expect(person(page, "new-entry", CROWDED, SECOND_ADMIN_ID)).toHaveAttribute(
      "data-draft",
      "true",
    );
    await expect(person(page, "new-entry", CROWDED, OWNER_ID)).toHaveAttribute("data-draft", "false");
    await expect(person(page, "new-entry", CROWDED, MEMBER_ID)).toHaveAttribute("data-type", "pto");
  });

  test("AC-8: a tentative draft counts toward its own warning", async ({ page }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    await fillEntry(page, "new-entry", { start: CROWDED, end: CROWDED });
    await expect(day(page, "new-entry", CROWDED)).toHaveAttribute("data-count", "3");

    await page.getByTestId("new-entry-tentative").setChecked(true);

    // INV-05. Unchanged: the same date, the same number. A warning that discounted an unsure draft
    // would be silent on exactly the days a person is least certain about.
    await expect(day(page, "new-entry", CROWDED)).toHaveAttribute("data-count", "3");
    await expect(person(page, "new-entry", CROWDED, SECOND_ADMIN_ID)).toHaveAttribute(
      "data-tentative",
      "true",
    );
  });

  test("AC-9, AC-10: the save control is unchanged, and one press saves", async ({ page }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    // The label as it stands with no warning on screen, read before the dates are chosen.
    const submit = page.getByTestId("new-entry-submit");
    const quietLabel = await submit.textContent();

    await fillEntry(page, "new-entry", { start: CROWDED, end: CROWDED });
    await expect(overload(page, "new-entry")).toBeVisible();

    // Charter refusal 6. No "Save anyway", no second label, no disabled control.
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveText(quietLabel ?? "");

    // AC-10. ONE press, and no dialog, interstitial or reason field between it and the row.
    await submit.click();
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
    await expect(ownRows(page)).toHaveCount(1);
    await expect(ownRows(page).first()).toHaveAttribute("data-status", "pending");
  });

  test("AC-13: the entry stored over a warning is the entry stored without one", async ({ page }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    // Identical in every field except the dates: one crowds a day, one does not.
    await createOwnEntry(page, { start: CROWDED, end: CROWDED, note: "one" });
    await expect(ownRows(page)).toHaveCount(1);
    await createOwnEntry(page, { start: QUIET, end: QUIET, note: "one" });
    await expect(ownRows(page)).toHaveCount(2);

    const crowdedRow = ownRows(page).filter({ hasText: `${CROWDED} → ${CROWDED}` });
    const quietRow = ownRows(page).filter({ hasText: `${QUIET} → ${QUIET}` });

    // No extra field, no different status, and nothing recording that a warning was shown. The write
    // path is byte-for-byte CAL-01's, which is what makes the warning an affordance.
    for (const [attribute, value] of [
      ["data-status", "pending"],
      ["data-type", "pto"],
      ["data-portion", "full"],
    ] as const) {
      await expect(crowdedRow).toHaveAttribute(attribute, value);
      await expect(quietRow).toHaveAttribute(attribute, value);
    }
    await expect(crowdedRow.getByTestId("own-entry-row-tentative")).toHaveCount(0);
    await expect(quietRow.getByTestId("own-entry-row-tentative")).toHaveCount(0);
  });

  test("AC-11: the warning is not the form's error channel", async ({ page }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    await createOwnEntry(page, { start: CROWDED, end: CROWDED });
    await expect(ownRows(page)).toHaveCount(1);

    // The same day again: the warning fires, and INV-01's exclusion constraint refuses the write.
    await fillEntry(page, "new-entry", { start: CROWDED, end: CROWDED });
    await expect(overload(page, "new-entry")).toBeVisible();
    await page.getByTestId("new-entry-submit").click();

    const error = page.getByTestId("new-entry-error");
    await expect(error).toBeVisible();

    // Two regions, and two roles. `alert` is the error's; the warning is `status`, because a warning
    // announced as an error is the soft block the charter refuses delivered by an ARIA attribute.
    await expect(error).toHaveAttribute("role", "alert");
    await expect(overload(page, "new-entry")).toHaveAttribute("role", "status");
    await expect(error.getByTestId("new-entry-overload")).toHaveCount(0);
    await expect(overload(page, "new-entry").getByTestId("new-entry-error")).toHaveCount(0);

    // And no field is made invalid by the warning: the refusal is about the row, not about a value
    // somebody typed. SOLO, 2026-09-10 — the two date inputs became a grid of day toggles, so the
    // assertion is over every cell of it rather than over two named inputs. Same criterion, and it
    // now covers more controls than it did.
    await expect(page.locator('[data-testid="new-entry-day"][aria-invalid="true"]')).toHaveCount(0);
    await expect(page.getByTestId("new-entry-note")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("AC-12: a save pressed before the count arrives is not deferred", async ({ page }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    // Filled and submitted with no wait in between. Whether the read has resolved by the time the
    // click lands is not something a browser test can force — the honest claim is the one asserted:
    // the save proceeds on its own and is never gated on the warning. Nothing in the component can
    // defer it, because it holds no submit state at all (01-plan.md section 4.4).
    await pickRange(page, "new-entry", CROWDED, CROWDED);
    await page.getByTestId("new-entry-submit").click();

    await expect(ownRows(page)).toHaveCount(1);
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
  });

  test("AC-19, AC-20: the warning describes the dates in the form, and nothing else", async ({
    page,
  }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, SECOND_ADMIN_EMAIL);

    await fillEntry(page, "new-entry", { start: CROWDED, end: CROWDED });
    await expect(day(page, "new-entry", CROWDED)).toBeVisible();

    // AC-20. No days chosen is not a range: the warning goes, and no count is asked for. SOLO,
    // 2026-09-10 — this was `fill("")` on the end input, which is the same state reached through the
    // control that exists now.
    await unpickDate(page, "new-entry", CROWDED);
    await expect(overload(page, "new-entry")).toHaveCount(0);
    await page.waitForTimeout(PAST_THE_DEBOUNCE);
    await expect(overload(page, "new-entry")).toHaveCount(0);

    // AC-20's other half was an INVERTED range, and SOLO made it unreachable: a set of chosen days
    // has no order to invert. The criterion is not dropped, it is held by construction, and this is
    // the assertion that says so — the picker offers no input to type a bound into, so there is no
    // way through this interface to ask the datastore about a range that ends before it starts.
    // CAL-01 AC-9's refusal still exists in the seam; what is gone is the control that could express
    // the mistake.
    await expect(page.getByTestId("new-entry-picker").locator("input")).toHaveCount(0);

    // AC-19. Moved to a quiet range: the warning never describes the range that has been left. The
    // interleaving of two in-flight answers cannot be forced through a browser, so what is asserted
    // is the observable requirement rather than the mechanism — the request-number guard in
    // src/components/OverloadWarning.tsx is what delivers it.
    await setRange(page, "new-entry", QUIET, QUIET);
    await page.waitForTimeout(PAST_THE_DEBOUNCE);
    await expect(day(page, "new-entry", CROWDED)).toHaveCount(0);
    await expect(overload(page, "new-entry")).toHaveCount(0);
  });

  test("AC-16: the warning fires on an edit that moves an entry onto a crowded day", async ({
    page,
  }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL]);
    await draftAs(page, ADMIN_EMAIL);

    // A quiet day first, and no warning while it is being chosen: 1.0 of 4.
    await createOwnEntry(page, { start: QUIET, end: QUIET });
    await expect(ownRows(page)).toHaveCount(1);

    await ownRows(page).first().getByTestId("own-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
    await page.waitForTimeout(PAST_THE_DEBOUNCE);
    await expect(overload(page, "edit-entry")).toHaveCount(0);

    // Moved onto the crowded day, and nothing saved.
    await setRange(page, "edit-entry", CROWDED, CROWDED);

    await expect(day(page, "edit-entry", CROWDED)).toBeVisible();
    await expect(day(page, "edit-entry", CROWDED)).toHaveAttribute("data-count", "3");
    await expect(person(page, "edit-entry", CROWDED, ADMIN_ID)).toHaveAttribute("data-draft", "true");
  });

  test("AC-17: an edit that changes no date does not count the entry twice", async ({ page }) => {
    // THREE on the day, so that leaving the dates alone still raises a warning and the number it
    // reports is observable. With two the day would sit at exactly the threshold and say nothing.
    await seedCrowdedDay(page, [MEMBER_EMAIL, SECOND_ADMIN_EMAIL]);
    await draftAs(page, MEMBER_EMAIL);

    await ownRows(page).first().getByTestId("own-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();

    // THREE, not four. The row being edited is replaced by the draft, never added to it — a warning
    // reporting four would be telling this person their own entry is two people.
    await expect(day(page, "edit-entry", CROWDED)).toBeVisible();
    await expect(day(page, "edit-entry", CROWDED)).toHaveAttribute("data-count", "3");
    await expect(peopleOn(page, "edit-entry", CROWDED)).toHaveCount(3);
    await expect(person(page, "edit-entry", CROWDED, MEMBER_ID)).toHaveCount(1);
  });

  test("AC-18: an admin editing another member's entry sees that member counted, not themselves", async ({
    page,
  }) => {
    await seedCrowdedDay(page, [MEMBER_EMAIL, SECOND_ADMIN_EMAIL]);

    // The admin has no entry of their own anywhere, which is what makes the attribution observable.
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);
    await teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();

    await setRange(page, "edit-entry", CROWDED, CROWDED);

    await expect(day(page, "edit-entry", CROWDED)).toBeVisible();

    // INV-07. The draft belongs to the entry's OWNER, and the admin is nowhere in the list.
    await expect(person(page, "edit-entry", CROWDED, OWNER_ID)).toHaveAttribute("data-draft", "true");
    await expect(person(page, "edit-entry", CROWDED, ADMIN_ID)).toHaveCount(0);
    await expect(peopleOn(page, "edit-entry", CROWDED)).toHaveCount(3);
    await expect(day(page, "edit-entry", CROWDED)).toHaveAttribute("data-count", "3");
  });
});
