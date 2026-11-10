import { expect, test, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange, setPartialRange } from "./support/entry-form";

// CAL-02 — edit or delete their own entry.
//
// Written from 01-plan.md sections 2 and 4.3. Every locator is a `data-testid` named in section 4.3,
// plus `own-entry-delete-cancel`, `own-entry-delete-error`, `edit-entry-loading`,
// `edit-entry-timestamps` and the two `data-created-at` / `data-updated-at` attributes, which are
// declared in 03-impl-log.md as additions beyond the selector table.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the refusals asserted below are the mock's reproductions of the policy, the column
// grant, the exclusion constraint and the trigger. The real mechanisms are in
// supabase/migrations/20260903143000_cal02_own_entry_writes.sql and are not exercised by any test
// until a project is provisioned — 01-plan.md Open questions item 2 carries that gap.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's entry table lives in module memory and a
// `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links,
// which react-router handles client-side and which keeps the entries an earlier step created — the
// same constraint tests/e2e/cal-01-create-entry.spec.ts records.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Member:   thanh@example.com / password123 (FIXTURE_MEMBER, role member, no seeded entries)
// - Approved: linh@example.com  / password123 (FIXTURE_APPROVED_MEMBER, owns FIXTURE_APPROVED_ENTRY)
// - FIXTURE_APPROVED_ENTRY: 2026-09-14 → 2026-09-16, pto, full, status approved, approved by the
//   seeded admin. It is seeded because nothing in the product can create an approved entry.

const SIGNIN = "/signin";
const MEMBER_EMAIL = "thanh@example.com";
const APPROVED_EMAIL = "linh@example.com";
const PASSWORD = "password123";

// FIXTURE_APPROVED_ENTRY.id, transcribed rather than imported: the acceptance suite addresses the
// application through the browser and does not import from src/.
const APPROVED_ENTRY_ID = "dd000000-0000-4000-8000-000000000001";
const APPROVED_ENTRY_DATES = "2026-09-14 → 2026-09-16";

const rows = (page: Page) => page.getByTestId("own-entry-row");

async function signInAndOpenList(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();

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

async function createEntry(page: Page, input: EntryInput): Promise<void> {
  await chooseType(page, "new-entry", input.type ?? "pto");
  await choosePortion(page, "new-entry", input.portion ?? "full");
  await pickRange(page, "new-entry", input.start, input.end);
  await page.getByTestId("new-entry-tentative").setChecked(input.tentative ?? false);
  if (input.note !== undefined) await page.getByTestId("new-entry-note").fill(input.note);
  await page.getByTestId("new-entry-submit").click();
}

/** Fills the edit form with whatever is named and submits it. Only the named fields are touched, so
 *  a test that changes one field leaves the other five holding the entry's own values — which is
 *  what makes AC-6's note-only edit a note-only edit. */
async function submitEdit(page: Page, input: Partial<EntryInput>): Promise<void> {
  if (input.type) await chooseType(page, "edit-entry", input.type);
  if (input.portion) await choosePortion(page, "edit-entry", input.portion);
  // SOLO, 2026-09-10. The two date inputs are a month grid now. Naming ONE bound used to leave the
  // other holding the entry's own value, and `setPartialRange` is that behaviour over a picker: the
  // bound that was not named is read back off the grid, and the whole range is chosen again.
  if (input.start !== undefined || input.end !== undefined) {
    await setPartialRange(page, "edit-entry", input.start, input.end);
  }
  if (input.tentative !== undefined) {
    await page.getByTestId("edit-entry-tentative").setChecked(input.tentative);
  }
  if (input.note !== undefined) await page.getByTestId("edit-entry-note").fill(input.note);
  await page.getByTestId("edit-entry-submit").click();
}

async function openEdit(page: Page, row = 0): Promise<void> {
  await rows(page).nth(row).getByTestId("own-entry-row-edit").click();
  await expect(page.getByTestId("edit-entry-form")).toBeVisible();
}

async function backToList(page: Page): Promise<void> {
  await page.getByTestId("edit-entry-back").first().click();
  await expect(page.getByTestId("new-entry-form")).toBeVisible();
}

/** The confirmation is deliberate: a hard delete has no undo, so the row is removed only after a
 *  second, separate press. */
async function deleteRow(page: Page, row = 0): Promise<void> {
  await rows(page).nth(row).getByTestId("own-entry-row-delete").click();
  await rows(page).nth(row).getByTestId("own-entry-delete-confirm").click();
}

test.describe("CAL-02 edit or delete their own entry", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("AC-1: an edit changes the entry in place and creates no second entry", async ({ page }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { start: "2026-10-05", end: "2026-10-09" });
    await expect(rows(page)).toHaveCount(1);

    await openEdit(page);
    await submitEdit(page, { end: "2026-10-07" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    await backToList(page);

    // ONE row, with the new range. Two rows here would be an update that inserted.
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first().getByTestId("own-entry-row-dates")).toHaveText(
      "2026-10-05 → 2026-10-07",
    );
  });

  test("AC-2: every substantive field is editable in one edit", async ({ page }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { start: "2026-11-02", end: "2026-11-03" });

    await openEdit(page);
    await submitEdit(page, {
      type: "wfh",
      portion: "am",
      start: "2026-11-09",
      end: "2026-11-13",
      tentative: true,
      note: "Đổi hết",
    });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    await backToList(page);

    const row = rows(page).first();
    await expect(rows(page)).toHaveCount(1);
    await expect(row).toHaveAttribute("data-type", "wfh");
    await expect(row).toHaveAttribute("data-portion", "am");
    await expect(row.getByTestId("own-entry-row-dates")).toHaveText("2026-11-09 → 2026-11-13");
    await expect(row.getByTestId("own-entry-row-tentative")).toBeVisible();
    await expect(row).toContainText("Đổi hết");
  });

  test("AC-3: a deleted entry is gone from the list and stays gone on the next read", async ({
    page,
  }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { start: "2026-10-12", end: "2026-10-12" });
    await createEntry(page, { start: "2026-10-19", end: "2026-10-19" });
    await expect(rows(page)).toHaveCount(2);

    const doomed = rows(page).filter({ hasText: "2026-10-19 → 2026-10-19" });
    await doomed.getByTestId("own-entry-row-delete").click();
    await doomed.getByTestId("own-entry-delete-confirm").click();

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first().getByTestId("own-entry-row-dates")).toHaveText(
      "2026-10-12 → 2026-10-12",
    );

    // The row is gone from the DATASTORE and not only from the screen: leaving and returning re-reads
    // the seam. A full page reload is deliberately NOT the assertion here — against the in-memory
    // seam a reload discards every entry the test created, so it would pass whether the delete
    // reached the seam or not.
    await openEdit(page);
    await backToList(page);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).not.toContainText("2026-10-19");
  });

  test("AC-4: deleting frees the dates it occupied, and a new entry on them is accepted", async ({
    page,
  }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { portion: "full", start: "2026-10-05", end: "2026-10-05" });
    await expect(rows(page)).toHaveCount(1);

    // INV-01 while the row stands.
    await createEntry(page, { portion: "full", start: "2026-10-05", end: "2026-10-05" });
    await expect(page.getByTestId("new-entry-error")).toBeVisible();
    await expect(rows(page)).toHaveCount(1);

    await deleteRow(page);
    await expect(page.getByTestId("own-entries-empty")).toBeVisible();

    // The same dates, now free. This is the half a test written from the happy path would miss: a
    // delete that only hid the row would leave the constraint refusing this write.
    await createEntry(page, { portion: "full", start: "2026-10-05", end: "2026-10-05" });
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
  });

  test("AC-5: a substantive edit to an approved entry returns it to pending and drops the approver", async ({
    page,
  }) => {
    await signInAndOpenList(page, APPROVED_EMAIL);

    const approved = rows(page).filter({ hasText: APPROVED_ENTRY_DATES });
    await expect(approved.getByTestId("own-entry-row-status")).toHaveAttribute(
      "data-status",
      "approved",
    );

    await approved.getByTestId("own-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "approved");
    await expect(page.getByTestId("edit-entry-approved-by")).toBeVisible();

    await submitEdit(page, { start: "2026-09-21", end: "2026-09-23" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    // INV-02, observed rather than implemented: the reset is `entry_enforce_decision()`'s, and the
    // approver and the approval time go with the status. An entry reading `pending` while still
    // naming its approver is the false record the invariant exists to prevent.
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "pending");
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveCount(0);

    await backToList(page);
    const edited = rows(page).filter({ hasText: "2026-09-21 → 2026-09-23" });
    await expect(edited.getByTestId("own-entry-row-status")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  test("AC-6: editing only the note does not revoke an approval", async ({ page }) => {
    await signInAndOpenList(page, APPROVED_EMAIL);

    const approved = rows(page).filter({ hasText: APPROVED_ENTRY_DATES });
    await approved.getByTestId("own-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();

    const approvedAt = await page
      .getByTestId("edit-entry-approved-by")
      .getAttribute("data-approved-at");
    const approvedBy = await page
      .getByTestId("edit-entry-approved-by")
      .getAttribute("data-approved-by");

    await submitEdit(page, { note: "Chỉ sửa ghi chú" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    // `note` alone is NOT substantive — data-model.md's own carve-out, and the trigger is the only
    // thing that decides it. The same approver, the same approval time.
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "approved");
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveAttribute(
      "data-approved-by",
      approvedBy ?? "",
    );
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveAttribute(
      "data-approved-at",
      approvedAt ?? "",
    );

    await backToList(page);
    const still = rows(page).filter({ hasText: APPROVED_ENTRY_DATES });
    await expect(still.getByTestId("own-entry-row-status")).toHaveAttribute(
      "data-status",
      "approved",
    );
    await expect(still).toContainText("Chỉ sửa ghi chú");
  });

  test("AC-7: an edit that would overlap another of the member's own entries is refused", async ({
    page,
  }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { portion: "full", start: "2026-10-05", end: "2026-10-05" });
    await createEntry(page, { portion: "full", start: "2026-10-20", end: "2026-10-20" });
    await expect(rows(page)).toHaveCount(2);

    const second = rows(page).filter({ hasText: "2026-10-20 → 2026-10-20" });
    await second.getByTestId("own-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();

    await submitEdit(page, { start: "2026-10-05", end: "2026-10-07" });

    const error = page.getByTestId("edit-entry-error");
    await expect(error).toBeVisible();

    const text = (await error.textContent())?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    // Never a database error string and never a SQLSTATE.
    expect(text).not.toMatch(/23P01|42501|23514|PGRST|exclusion|constraint|daterange/i);

    // NEITHER entry changed. A refusal that half-applied would leave the second row on the new dates.
    await backToList(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).filter({ hasText: "2026-10-05 → 2026-10-05" })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: "2026-10-20 → 2026-10-20" })).toHaveCount(1);
  });

  test("AC-8: the edit screen offers no way to move an entry to another member", async ({
    page,
  }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { start: "2026-11-16", end: "2026-11-16" });
    await openEdit(page);

    // The absence of a member picker is the affordance; `member_id` being absent from the update
    // grant, and `entry_update_own`'s `with check`, are the control. What is observable through the
    // interface is that the form carries exactly two selects, type and portion, and nothing naming a
    // member.
    const form = page.getByTestId("edit-entry-form");
    // SOLO, 2026-09-10: the two `<select>`s became segmented button groups, so the count is over
    // `role="group"`. Two controls, type and portion, and nothing naming a member.
    await expect(form.locator("select")).toHaveCount(0);
    await expect(form.locator('[role="group"]')).toHaveCount(2);
    await expect(form.getByTestId("edit-entry-type")).toBeVisible();
    await expect(form.getByTestId("edit-entry-portion")).toBeVisible();
    await expect(form.locator('[data-testid*="member"]')).toHaveCount(0);

    // And after the edit the entry is still the caller's: `listOwnEntries` narrows to
    // `member_id = auth.uid()`, so a row that had moved to another member would leave this list.
    await submitEdit(page, { note: "Vẫn là của mình" });
    await backToList(page);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Vẫn là của mình");
  });

  test("AC-9: a member may not edit or delete somebody else's entry", async ({ page }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);

    // Another member's entry, addressed by its id. Reaching it takes a typed address, because the
    // list this member reads holds only their own rows — the narrowing is an affordance and the
    // policy is the control.
    await page.goto(`/entries/${APPROVED_ENTRY_ID}/edit`);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();

    await expect(page.getByTestId("edit-entry-not-found")).toBeVisible();
    await expect(page.getByTestId("edit-entry-form")).toHaveCount(0);
    await expect(page.getByTestId("edit-entry-submit")).toHaveCount(0);

    // It says nothing about whether the id exists: "not yours" and "no such entry" are one answer
    // here and one failure code in the seam, or the screen would be an oracle for which entry ids
    // exist in the team.
    await expect(page.getByTestId("edit-entry-not-found")).not.toContainText(APPROVED_ENTRY_ID);

    // The entry is untouched, read as its owner. Signing out first, not navigating to /signin: a
    // caller who already holds a session is routed away from that screen (TEA-05 AC-5).
    await page.goto("/");
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await signInAndOpenList(page, APPROVED_EMAIL);
    const approved = rows(page).filter({ hasText: APPROVED_ENTRY_DATES });
    await expect(approved).toHaveCount(1);
    await expect(approved.getByTestId("own-entry-row-status")).toHaveAttribute(
      "data-status",
      "approved",
    );
  });

  test("AC-10: a member may not set status through an edit", async ({ page }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { start: "2026-11-23", end: "2026-11-24" });
    await openEdit(page);

    // The form renders no control that could carry a decision column. `status` and
    // `rejection_reason` are absent from the update grant, so a statement naming either is refused
    // with 42501 before any policy runs; this is the affordance over that.
    const form = page.getByTestId("edit-entry-form");
    for (const name of ["status", "approved-by", "approved-at", "rejection-reason"]) {
      await expect(form.locator(`[data-testid*="${name}"]`)).toHaveCount(0);
    }

    await submitEdit(page, { note: "Vẫn chờ duyệt" });
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "pending");
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveCount(0);

    await backToList(page);
    await expect(rows(page).first().getByTestId("own-entry-row-status")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  test("AC-11: an inverted range cannot be expressed on the edit screen either", async ({ page }) => {
    // SOLO, 2026-09-10 — the same move CAL-01 AC-9's test records, on the edit route. The two date
    // inputs became a day picker, so the inverted range this test used to type is unreachable
    // through the interface. The seam still refuses it, and tests/entry-range-refusals.test.ts
    // asserts that on `updateEntry` directly.
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { start: "2026-12-07", end: "2026-12-11" });
    await openEdit(page);

    const form = page.getByTestId("edit-entry-form");
    await expect(form.locator('input[type="date"]')).toHaveCount(0);
    await expect(form.getByTestId("edit-entry-picker").locator("input")).toHaveCount(0);

    // The entry keeps the days it had, and they are the ones drawn as chosen.
    for (const date of ["2026-12-07", "2026-12-11"]) {
      await expect(
        page.locator(`[data-testid="edit-entry-day"][data-date="${date}"]`).first(),
      ).toHaveAttribute("data-selected", "true");
    }

    await page.getByTestId("edit-entry-submit").click();

    await backToList(page);
    await expect(rows(page).first().getByTestId("own-entry-row-dates")).toHaveText(
      "2026-12-07 → 2026-12-11",
    );
  });

  test("AC-12: an edit records when it happened", async ({ page }) => {
    await signInAndOpenList(page, MEMBER_EMAIL);
    await createEntry(page, { start: "2026-12-14", end: "2026-12-15" });

    const row = rows(page).first();
    const createdAt = await row.getAttribute("data-created-at");
    expect(createdAt).toBeTruthy();
    // A row that has never been edited carries the two equal, which is what `default now()` stores.
    await expect(row).toHaveAttribute("data-updated-at", createdAt ?? "");

    await openEdit(page);
    await submitEdit(page, { note: "Đã sửa" });
    await backToList(page);

    const updatedAt = await rows(page).first().getAttribute("data-updated-at");
    await expect(rows(page).first()).toHaveAttribute("data-created-at", createdAt ?? "");
    // ISO 8601 in UTC sorts lexicographically, so a string comparison is a time comparison and no
    // Date is constructed. The value is the datastore's own clock, never the client's.
    expect(updatedAt ?? "").not.toBe(createdAt);
    expect((updatedAt ?? "") > (createdAt ?? "")).toBe(true);
  });
});
