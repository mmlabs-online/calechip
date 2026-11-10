import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange } from "./support/entry-form";

// SOLO, 2026-09-09 — the approval queue's row, redrawn.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to this
// file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md`.
//
// **WHAT CHANGED IS THE ROW, AND WHAT DID NOT CHANGE IS EVERYTHING THE ROW CARRIES.** ADM-04's list,
// filters, count and paging, ADM-05's decision panel and ADM-06's selection checkbox are all exactly
// where they were — the operator was asked whether the transcription's omission of them was an
// instruction to remove them and said it was not. Their three suites pass UNEDITED, which is the
// strongest statement available that this is a re-layout; test 4 is the standing version of it.
//
// **TWO THINGS ARE GENUINELY NEW**, and they are the two the transcription is emphatic about:
//   1. The approve control is the COLOUR OF THE ENTRY IT APPROVES — peach for leave, mint for
//      working from home (test 1).
//   2. A row whose dates are already crowded says so (tests 2 and 3).
//
// **THE WARNING REFUSES NOTHING**, which is charter refusal 6 and is the property test 3 exists for.
// A warning beside an approve control is exactly the shape that turns into a block by accident, and
// the only way to know it did not is to approve a crowded day and watch it work.
//
// **THE COUNT IS INV-04's AND NOT THIS SCREEN'S.** `usePageOverload` reads once for the whole page
// and derives every row from `absenceCountsFor`, so a row and a month cell cannot disagree. Test 2
// pins the number rather than merely the presence of a sentence, because a warning that appears with
// the wrong figure is worse than none.
//
// **AMENDED 2026-09-10 — THREE CONTROLS WERE REMOVED FROM THIS SCREEN AND TEST 4 NOW ASSERTS THEIR
// ABSENCE.** The filters, the bulk-rejection bar and the pager are gone on the operator's explicit
// instruction, which arrived the day after they were explicitly kept. Test 4 was flipped rather than
// deleted, because an assertion that reversed is a better record than one that disappeared.
//
// **⚠️ A DECLARED GAP: THE LOAD-MORE CONTROL'S APPEND BEHAVIOUR IS ASSERTED NOWHERE IN A BROWSER.**
// `PENDING_PAGE_SIZE` is 50 and the only way to create an entry is CAL-01's form, so reaching a
// second page here means fifty-one form submissions — a browser test that spends minutes proving
// something arithmetic, which is the reason `tests/pending-entries.test.ts` already carries the
// paging arithmetic against a set of fifty-four at the seam. What IS asserted through the interface
// is the case that fits one page: `tests/e2e/adm-04-worklist.spec.ts` AC-4 requires the control to
// be ABSENT — not disabled — when every row is on screen. The append itself is unverified, and this
// note is here so nobody reads the green suite as covering it.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise).
//
// Fixtures (`src/lib/fixtures.ts`, and `cal-07-overload-warning.spec.ts` § the arithmetic):
// FIXTURE_TEAM has FOUR active members and an `overload_threshold` of 0.5, so a day is crowded above
// 2.0 — 2.0 raises nothing, 3.0 does. FIXTURE_APPROVED_ENTRY already puts 1.0 on 2026-09-14, so two
// seeded entries take it to 3.0.

const SIGNIN = "/signin";
const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const SECOND_ADMIN_EMAIL = "dung@example.com";

/** 1.0 from FIXTURE_APPROVED_ENTRY, plus the two this file seeds onto it: 3.0 of 4, and crowded. */
const CROWDED = "2026-09-14";
/** FIXTURE_APPROVED_ENTRY and nobody else: 1.0 of 4, and never crowded. */
const QUIET = "2026-09-15";

const rows = (page: Page): Locator => page.getByTestId("pending-entry-row");
const rowOn = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="pending-entry-row"][data-start-date="${date}"]`);

async function signInAs(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Ends the session without a document load, so entries an earlier step created survive into the
 *  next account's view — the whole reason this file can seed a crowded day across accounts. */
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

/** Declares one entry through CAL-01's form, the only path there is. */
async function declare(
  page: Page,
  input: { type: "pto" | "wfh"; date: string },
): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();
  await expect(page.getByTestId("new-entry-form")).toBeVisible();
  await chooseType(page, "new-entry", input.type);
  await choosePortion(page, "new-entry", "full");
  await pickRange(page, "new-entry", input.date, input.date);
  await page.getByTestId("new-entry-tentative").setChecked(false);
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
  await backToHome(page);
}

/** **THREE CLICKS SINCE SOLO's TAB STRIP**, and the first two are UIE-09's and UIE-10's: the top-bar
 *  control, then the strip's approvals tab. The destination is unchanged. */
async function openWorklist(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-pending-link").click();
  await expect(page.getByTestId("pending-entries-count")).toBeVisible();
}

/**
 * Two entries on `CROWDED` — one leave, one working from home — plus one on `QUIET`, all waiting in
 * the admin's queue, with the page left on the worklist as `ADMIN_EMAIL`.
 *
 * With both `CROWDED` entries in place the day stands at 3.0 of 4 against a threshold of 2.0. The
 * `QUIET` one stands at 2.0, which is EXACTLY the threshold and therefore not crowded — INV-04 is
 * compared with `>` and never `>=`, and that boundary is what makes test 2's negative half a test.
 */
async function seed(page: Page): Promise<void> {
  await signInAs(page, MEMBER_EMAIL);
  await declare(page, { type: "pto", date: CROWDED });
  await declare(page, { type: "pto", date: QUIET });
  await signOutFromHome(page);

  await signInAs(page, SECOND_ADMIN_EMAIL);
  await declare(page, { type: "wfh", date: CROWDED });
  await signOutFromHome(page);

  await signInAs(page, ADMIN_EMAIL);
  await openWorklist(page);
  await expect(rows(page)).toHaveCount(3);
}

test.describe("SOLO — the approval queue's row", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("1: the approve control is the colour of the entry it approves", async ({
    page,
  }) => {
    await seed(page);

    // **THE FILL FOLLOWS `data-type`, ASSERTED AGAINST THE ROW'S OWN TYPE RATHER THAN AGAINST A
    // LIST.** A control coloured from a constant would pass a check that only looked at one row;
    // this reads each row's declared type and demands the matching token.
    const count = await rows(page).count();
    expect(count).toBeGreaterThan(1);

    const seenTypes = new Set<string>();
    for (let i = 0; i < count; i += 1) {
      const row = rows(page).nth(i);
      const type = await row.getAttribute("data-type");
      expect(type, "every row declares its type").toMatch(/^(pto|wfh)$/);
      seenTypes.add(type ?? "");

      const approve = row.getByTestId("entry-decision-approve");
      await expect(approve).toHaveAttribute("data-type", type ?? "");
      await expect(approve).toHaveClass(
        new RegExp(`\\bbg-${type === "pto" ? "pto" : "wfh"}\\b`),
      );

      // **SOLO, 2026-09-10 — THE ROW ITSELF CARRIES THE TYPE NOW, NOT JUST THE CONTROL.** The
      // operator's instruction: *"Tôi muốn UI của row WFH và row PTO khác nhau"*. Two places say
      // it — the left edge and the type pill — and both are read against the row's own `data-type`
      // rather than against a list, for the reason the block above records.
      await expect(row).toHaveClass(
        new RegExp(`\\bborder-l-${type === "pto" ? "pto" : "wfh"}\\b`),
      );

      const badge = row.getByTestId("pending-entry-row-type");
      await expect(badge).toHaveAttribute("data-type", type ?? "");
      await expect(badge).toHaveClass(
        new RegExp(`\\bbg-${type === "pto" ? "pto" : "wfh"}\\b`),
      );

      // **AND THE COLOUR IS NEVER THE ONLY SIGNAL** — UIE-01 AC-4's rule. The word is on the row in
      // full, so the distinction survives a reader who cannot separate peach from mint.
      await expect(badge).toHaveText(type === "pto" ? "Leave" : "Working from home");
    }

    // BOTH TOKENS ACTUALLY APPEAR, which is what makes the loop a test rather than a tautology: a
    // control stuck on one fill passes every line above until this one.
    expect(seenTypes).toEqual(new Set(["pto", "wfh"]));

    // The accessible name is still the word. The star `CLAUDE.md` § Visual direction gives an
    // approved entry sits on this control as decoration, `aria-hidden`, outside the word — so the
    // control an admin's screen reader announces did not change when its look did.
    await expect(
      rows(page).first().getByTestId("entry-decision-approve"),
    ).toContainText("Approve");
  });

  test("2: a crowded row says so, with the count INV-04 gives, and a quiet row says nothing", async ({
    page,
  }) => {
    await seed(page);

    // THE CROWDED DAY. 3.0 of 4 against a threshold of 2.0 — the two seeded entries plus
    // FIXTURE_APPROVED_ENTRY. Both rows on that date carry the sentence, because it is a fact about
    // the DAY and not about whose row it is.
    const crowded = rowOn(page, CROWDED);
    await expect(crowded).toHaveCount(2);

    for (let i = 0; i < 2; i += 1) {
      const warning = crowded.nth(i).getByTestId("pending-entry-row-overload");
      await expect(warning).toHaveCount(1);
      await expect(warning).toHaveAttribute("data-date", CROWDED);

      // **THE NUMBER, NOT JUST THE SENTENCE.** A warning that appears with the wrong figure is worse
      // than none, and the figure is INV-04's — the same arithmetic the month grid paints, so this
      // row and that cell cannot disagree.
      await expect(warning).toHaveAttribute("data-count", "3");
      await expect(warning).toContainText("3");
      await expect(warning).toContainText(CROWDED);
    }

    // **THE QUIET DAY STANDS AT EXACTLY 2.0, WHICH IS THE THRESHOLD AND NOT ABOVE IT.** INV-04 is
    // compared with `>` and never `>=`; a boundary read as `>=` would light this row, so this is the
    // half of the criterion that catches an off-by-one rather than an absence.
    const quiet = rowOn(page, QUIET);
    await expect(quiet).toHaveCount(1);
    await expect(quiet.getByTestId("pending-entry-row-overload")).toHaveCount(0);
  });

  test("3: the warning refuses nothing — a crowded day is still approvable", async ({
    page,
  }) => {
    await seed(page);

    const crowded = rowOn(page, CROWDED).first();
    await expect(
      crowded.getByTestId("pending-entry-row-overload"),
    ).toBeVisible();

    // **CHARTER REFUSAL 6, AND THE ONLY WAY TO KNOW IT HOLDS IS TO USE THE CONTROL.** A warning
    // beside an approve button is exactly the shape that becomes a block by accident — a `disabled`
    // added in passing, a guard in the click handler — and a test that only asserted the sentence
    // was visible would pass through every one of those.
    const approve = crowded.getByTestId("entry-decision-approve");
    await expect(approve).toBeEnabled();
    await approve.click();

    // It left the queue, and the count fell with it. ADM-05 AC-1's behaviour, unchanged.
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByTestId("pending-entries-count")).toHaveAttribute(
      "data-total",
      "2",
    );
  });

  test("4: everything the row already carried is still on it", async ({
    page,
  }) => {
    await seed(page);

    const row = rows(page).first();

    // **AMENDED 2026-09-10 AND THE LINK'S ASSERTION IS NOW THE REVERSE OF WHAT STOOD HERE**, which
    // is this test's own convention two paragraphs down. It used to assert ADM-04's `Open` link had
    // an `href` to the edit screen, written on 2026-09-09 from the operator's answer that the
    // transcription's silence about it was not an instruction. The instruction came on 2026-09-10
    // with an image: *"bỏ nút open"*. So the same name is asserted ABSENT, in the same test.
    //
    // ADM-05's decision panel is untouched and is still asserted present, as it always was.
    await expect(row.getByTestId("pending-entry-row-link")).toHaveCount(0);

    // And what the instruction's other half put there instead: *"Show đầy đủ thông tin request ngay
    // từng row"*. The note is no longer truncated into the dates line and `createdAt` is drawn.
    await expect(row.getByTestId("pending-entry-row-declared")).toHaveCount(1);

    await expect(row.getByTestId("entry-decision")).toHaveCount(1);
    await expect(row.getByTestId("entry-decision-reject")).toHaveCount(1);
    await expect(page.getByTestId("pending-entries-count")).toBeVisible();

    // **AMENDED 2026-09-10, AND THE AMENDMENT IS THE REVERSE OF WHAT STOOD HERE.** This block used
    // to assert that ADM-06's selection checkbox and ADM-04's two filters and pager were all still
    // present — written on 2026-09-09 from the operator's answer that the transcription's silence
    // about them was not an instruction. The next day the instruction came explicitly: *"Bỏ phần
    // filter"*, *"Bỏ phần Select entries to reject them together"*, *"Bỏ pagination thay bằng load
    // more"*. So the same names are asserted ABSENT, in the same test, rather than the test being
    // deleted — an assertion that flipped is a better record than one that vanished.
    for (const id of [
      "pending-entry-row-select",
      "pending-entries-window",
      "pending-entries-type",
      "pending-entries-prev",
      "pending-entries-next",
      "bulk-reject-submit",
      "bulk-reject-reason",
    ]) {
      await expect(
        page.getByTestId(id),
        `${id} was removed on 2026-09-10 and must render for nobody`,
      ).toHaveCount(0);
    }

    // **AND THE PANE HOLDS NO SECOND WRITE SURFACE.** ADM-04 AC-9's own suite asserts that the list
    // holds no `form`; the bulk bar was the one form on this screen outside the list, and with it
    // gone the only remaining `textarea` is the one a per-row rejection opens — which is closed
    // here, so there should be none at all.
    await expect(page.locator("textarea")).toHaveCount(0);

    // And the row still declares every fact a test elsewhere reads off it. These attributes are the
    // interface eight other criteria in three suites address, and they survived the redraw.
    for (const attribute of [
      "data-entry-id",
      "data-member-id",
      "data-type",
      "data-portion",
      "data-start-date",
      "data-end-date",
      "data-tentative",
    ]) {
      await expect(row).toHaveAttribute(attribute, /.+/);
    }
  });
});
