import { expect, test, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange } from "./support/entry-form";

// CAL-01 — create an entry for themselves, over a range of dates.
//
// Written from 01-plan.md sections 2 and 4.4. Every locator is a `data-testid` named in section 4.4,
// plus `home-new-entry-link`, which section 4.4 requires as a link ("Home.tsx gains one link to it")
// without naming a selector for it — declared in 03-impl-log.md as a selector added beyond the
// table.
//
// AC-12 HAS NO TEST, and its absence is deliberate rather than an omission. It is `TODO(project)` on
// .ai/registry/features.md:87: whether a member may declare a date in the past is the operator's
// decision, both answers are defensible, and no rule is implemented in either direction. A test
// written here would fix the answer by asserting it.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Member: thanh@example.com / password123 (FIXTURE_MEMBER, role member)
// - Admin:  quan@example.com  / password123 (FIXTURE_ADMIN, role admin)

const SIGNIN = "/signin";
const MEMBER_EMAIL = "thanh@example.com";
const ADMIN_EMAIL = "quan@example.com";
const PASSWORD = "password123";

async function signInAndOpenForm(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();

  // The link is the route's only affordance from the landing screen, and clicking it keeps this one
  // page lifetime — which matters against the in-memory seam, where a full navigation would discard
  // the entries an earlier step in the same test created.
  await expect(page.getByTestId("home-new-entry-link")).toBeVisible();
  await page.getByTestId("home-new-entry-link").click();
  await expect(page.getByTestId("new-entry-form")).toBeVisible();
}

interface EntryInput {
  type?: "pto" | "wfh";
  portion?: "full" | "am" | "pm";
  start: string;
  end: string;
  tentative?: boolean;
  note?: string;
}

async function submitEntry(page: Page, input: EntryInput): Promise<void> {
  await chooseType(page, "new-entry", input.type ?? "pto");
  await choosePortion(page, "new-entry", input.portion ?? "full");
  await pickRange(page, "new-entry", input.start, input.end);
  // Set, never assumed. An `if (input.tentative) check()` inherits whatever the control was left
  // holding, so an entry this helper describes as not tentative could be saved tentative — which is
  // exactly what happened, and is how the sticky flag above was found.
  await page.getByTestId("new-entry-tentative").setChecked(input.tentative ?? false);
  if (input.note !== undefined) await page.getByTestId("new-entry-note").fill(input.note);
  await page.getByTestId("new-entry-submit").click();
}

const rows = (page: Page) => page.getByTestId("own-entry-row");

test.describe("CAL-01 create an entry over a range of dates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("AC-1: a single-day entry is stored pending and not tentative, and appears in the own list", async ({
    page,
  }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);
    await expect(page.getByTestId("own-entries-empty")).toBeVisible();

    await submitEntry(page, { start: "2026-10-12", end: "2026-10-12" });

    await expect(rows(page)).toHaveCount(1);
    const row = rows(page).first();
    await expect(row).toHaveAttribute("data-status", "pending");
    await expect(row).toHaveAttribute("data-type", "pto");
    await expect(row).toHaveAttribute("data-portion", "full");
    // `tentative` defaults to false, and the marker is present only when it is true.
    await expect(row.getByTestId("own-entry-row-tentative")).toHaveCount(0);
    await expect(row.getByTestId("own-entry-row-dates")).toHaveText("2026-10-12 → 2026-10-12");
  });

  test("AC-2: a contiguous range is ONE entry, not one per day", async ({ page }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);

    // Monday to Friday: five dates inclusive. One row is the criterion; five would be the
    // row-per-date shape 01-plan.md section 8 rejects. (Was Monday to Saturday until SOLO 2026-09-14
    // disabled weekends in the picker.)
    await submitEntry(page, { start: "2026-11-02", end: "2026-11-06" });

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first().getByTestId("own-entry-row-dates")).toHaveText(
      "2026-11-02 → 2026-11-06",
    );
  });

  test("AC-3: the end date is inclusive and reads back as the day chosen", async ({ page }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);
    await submitEntry(page, { start: "2026-10-05", end: "2026-10-09" });

    // The whole of ADR-011's canonicalisation footgun: a stored daterange reads back as
    // ['2026-10-05','2026-10-10'), so an implementation deriving the end from the range's upper
    // bound reports the 10th here. The plain `end_date` column is the 9th.
    await expect(rows(page).first().getByTestId("own-entry-row-dates")).toHaveText(
      "2026-10-05 → 2026-10-09",
    );
    await expect(rows(page).first().getByTestId("own-entry-row-dates")).not.toContainText(
      "2026-10-10",
    );
  });

  test("AC-4: WFH is a type, not a second feature", async ({ page }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);
    await submitEntry(page, {
      type: "wfh",
      portion: "am",
      start: "2026-10-19",
      end: "2026-10-21",
      tentative: true,
      note: "Ở nhà đợi thợ",
    });

    const row = rows(page).first();
    await expect(rows(page)).toHaveCount(1);
    await expect(row).toHaveAttribute("data-type", "wfh");
    // Otherwise identical in shape to a PTO entry: same status, same portions, same note, same flag.
    await expect(row).toHaveAttribute("data-status", "pending");
    await expect(row).toHaveAttribute("data-portion", "am");
    await expect(row.getByTestId("own-entry-row-tentative")).toBeVisible();
    await expect(row).toContainText("Ở nhà đợi thợ");
  });

  test("AC-5: one portion applies to the whole range, and no per-date portion is offered", async ({
    page,
  }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);
    await submitEntry(page, { portion: "pm", start: "2026-12-07", end: "2026-12-11" });

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toHaveAttribute("data-portion", "pm");

    // INV-06 observed at the interface: exactly ONE portion control exists on the form, so there is
    // no way to set a different portion for any individual date in the range.
    await expect(page.getByTestId("new-entry-portion")).toHaveCount(1);
  });

  test("AC-6: tentative and note are optional and independent of status", async ({ page }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);

    await submitEntry(page, {
      start: "2026-10-26",
      end: "2026-10-27",
      tentative: true,
      note: "Chưa đặt vé",
    });

    const tentativeRow = rows(page).first();
    await expect(tentativeRow.getByTestId("own-entry-row-tentative")).toBeVisible();
    await expect(tentativeRow).toContainText("Chưa đặt vé");
    // Tentative does NOT change the status. The two axes are kept apart deliberately.
    await expect(tentativeRow).toHaveAttribute("data-status", "pending");

    // An entry saved with neither: the marker is absent and no note text is carried.
    await submitEntry(page, { start: "2026-10-29", end: "2026-10-29" });
    await expect(rows(page)).toHaveCount(2);

    const plain = rows(page).filter({ hasText: "2026-10-29 → 2026-10-29" });
    await expect(plain.getByTestId("own-entry-row-tentative")).toHaveCount(0);
    await expect(plain).not.toContainText("Chưa đặt vé");
    await expect(plain).toHaveAttribute("data-status", "pending");
  });

  test("AC-7: an overlapping entry is refused, in a sentence", async ({ page }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);
    await submitEntry(page, { portion: "full", start: "2026-10-05", end: "2026-10-05" });
    await expect(rows(page)).toHaveCount(1);

    // `full` conflicts with everything (INV-01), so all three portions clash on the same date, and a
    // different TYPE does not make them different days.
    for (const portion of ["full", "am", "pm"] as const) {
      await submitEntry(page, { type: "wfh", portion, start: "2026-10-05", end: "2026-10-07" });

      const error = page.getByTestId("new-entry-error");
      await expect(error).toBeVisible();

      const text = (await error.textContent())?.trim() ?? "";
      expect(text.length).toBeGreaterThan(0);
      // Never a database error string and never a SQLSTATE.
      expect(text).not.toMatch(/23P01|42501|23514|PGRST|exclusion|constraint|daterange/i);

      // Nothing is stored: the refusal leaves the list exactly as it was.
      await expect(rows(page)).toHaveCount(1);
    }
  });

  test("AC-8: a morning and an afternoon on one date are both accepted", async ({ page }) => {
    await signInAndOpenForm(page, MEMBER_EMAIL);

    await submitEntry(page, { portion: "am", start: "2026-10-06", end: "2026-10-06" });
    await expect(rows(page)).toHaveCount(1);

    await submitEntry(page, { portion: "pm", start: "2026-10-06", end: "2026-10-06" });

    // The pair with AC-7 is the real test of the constraint: a constraint written `portion WITH =`
    // passes AC-7's full-versus-full case and silently permits `full` beside `am`, and a constraint
    // that compared dates alone would fail here.
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(2);
  });

  test("AC-9: an inverted range cannot be expressed through the form at all", async ({ page }) => {
    // SOLO, 2026-09-10 — THIS TEST CHANGED SHAPE BECAUSE A CONTROL WAS REMOVED, NOT BECAUSE THE
    // CRITERION MOVED. It used to type 9 October into `start` and 5 October into `end` and assert
    // the sentence that came back. The operator's design replaced both inputs with a day picker, and
    // a SET of chosen days has no order to invert — there is no longer an input the mistake can be
    // typed into.
    //
    // The refusal still exists in both seam implementations (src/lib/data/mock.ts:1060,
    // src/lib/data/supabase.ts:507) and is asserted in tests/entry-range-refusals.test.ts, which was
    // written for this move rather than the criterion being dropped. What is asserted HERE is the
    // half that is about the interface: no control on this form can produce an inverted range.
    await signInAndOpenForm(page, MEMBER_EMAIL);

    const form = page.getByTestId("new-entry-form");
    await expect(form.locator('input[type="date"]')).toHaveCount(0);
    await expect(form.getByTestId("new-entry-picker")).toBeVisible();
    await expect(form.getByTestId("new-entry-picker").locator("input")).toHaveCount(0);

    // And with no day chosen there is nothing to submit: the control is disabled, so an empty form
    // cannot ask the datastore about a range at all.
    await expect(page.getByTestId("new-entry-submit")).toBeDisabled();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByTestId("own-entries-empty")).toBeVisible();
  });

  test("AC-10: the form offers no way to create an entry for another member, for either role", async ({
    page,
  }) => {
    // The absence of a member picker is the affordance; the policy's `with check` is the control,
    // and it is uniform across roles. What is observable through the interface is that neither role
    // is offered a choice of member — the form carries exactly two grouped controls, type and
    // portion.
    //
    // SOLO, 2026-09-10: those two were `<select>`s and are segmented button groups now, so the count
    // is over `role="group"`, and the assertion that there is no `<select>` at all is added beside
    // it. The criterion is unchanged, and it still counts the controls rather than naming them.
    for (const email of [MEMBER_EMAIL, ADMIN_EMAIL]) {
      await signInAndOpenForm(page, email);

      const form = page.getByTestId("new-entry-form");
      await expect(form.locator("select")).toHaveCount(0);
      await expect(form.locator('[role="group"]')).toHaveCount(2);
      await expect(form.locator('[data-testid*="member"]')).toHaveCount(0);
      await expect(form.getByTestId("new-entry-type")).toBeVisible();
      await expect(form.getByTestId("new-entry-portion")).toBeVisible();

      // An entry created by either role belongs to that role's own caller: the admin's list does not
      // show the member's row, and each sees only their own.
      await submitEntry(page, { start: "2026-11-16", end: "2026-11-16" });
      await expect(rows(page)).toHaveCount(1);

      await page.goto("/");
      await page.getByTestId("home-sign-out").click();
      await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    }
  });

  test("AC-11: a caller cannot create an already-approved entry, whichever role they hold", async ({
    page,
  }) => {
    for (const email of [MEMBER_EMAIL, ADMIN_EMAIL]) {
      await signInAndOpenForm(page, email);

      // The form renders no status control at all — there is nothing on it that could carry
      // `status`, `approvedBy`, `approvedAt` or `rejectionReason`.
      const form = page.getByTestId("new-entry-form");
      for (const name of ["status", "approved-by", "approved-at", "rejection-reason"]) {
        await expect(form.locator(`[data-testid*="${name}"]`)).toHaveCount(0);
      }

      await submitEntry(page, { start: "2026-11-23", end: "2026-11-24" });

      // A new entry is `pending` and its approval columns are null, for both roles.
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toHaveAttribute("data-status", "pending");

      await page.goto("/");
      await page.getByTestId("home-sign-out").click();
      await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    }
  });

  test("SOLO 2026-09-14: the picker marks today and disables Saturday and Sunday", async ({ page }) => {
    // The page clock is pinned so "today" is a known Wednesday inside the month the picker opens on.
    await page.clock.setFixedTime(new Date("2026-10-07T09:00:00"));
    await signInAndOpenForm(page, MEMBER_EMAIL);
    await expect(page.getByTestId("new-entry-month")).toHaveAttribute("data-month", "2026-10");

    const today = page.locator('[data-testid="new-entry-day"][data-today="true"]');
    await expect(today).toHaveCount(1);
    await expect(today).toHaveAttribute("data-date", "2026-10-07");
    await expect(today).toHaveAttribute("aria-current", "date");

    // Saturday and Sunday are disabled, and clicking one chooses nothing.
    const saturday = page.locator('[data-testid="new-entry-day"][data-date="2026-10-10"]');
    const sunday = page.locator('[data-testid="new-entry-day"][data-date="2026-10-11"]');
    await expect(saturday).toBeDisabled();
    await expect(sunday).toBeDisabled();
    await saturday.click({ force: true });
    await expect(page.getByTestId("new-entry-picker")).toHaveAttribute("data-selected-count", "0");

    // A weekday is not.
    const friday = page.locator('[data-testid="new-entry-day"][data-date="2026-10-09"]');
    await expect(friday).toBeEnabled();
    await friday.click();
    await expect(page.getByTestId("new-entry-picker")).toHaveAttribute("data-selected-count", "1");
  });
});
