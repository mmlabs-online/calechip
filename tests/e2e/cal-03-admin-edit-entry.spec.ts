import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange, setPartialRange } from "./support/entry-form";

// CAL-03 — edit or delete another member's entry, as an admin.
//
// Written from 01-plan.md sections 2 and 4.3. Every locator is a `data-testid` named in section 4.3,
// plus `team-entries-loading`, `team-entries-unavailable`, `team-entry-delete-cancel`,
// `team-entry-delete-error`, `team-entries-back`, `edit-entry-team-back`,
// `shell-admin-link`, `admin-hub-team-entries-link` and the `data-member-id` / `data-created-at` /
// `data-updated-at`
// attributes on `team-entry-row` — all declared in 03-impl-log.md as additions beyond the selector
// table.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so every refusal asserted below is the mock's reproduction of a policy, a column
// grant, the exclusion constraint or the trigger. The real mechanisms are in
// supabase/migrations/20260903160000_cal03_admin_entry_writes.sql and are exercised by no test until
// a project is provisioned — 01-plan.md Open questions item 3 carries that gap, and it is worth
// being plain that AC-8 below is the one it bites hardest: the one-team fixture makes the cross-team
// case an assertion against SEEDED DATA and not against a second team's real session.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's entry table lives in module memory and a
// `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links and
// by `page.goBack()`, both of which react-router handles client-side without a document load — the
// same constraint CAL-01's and CAL-02's suites record. It is also why AC-2's "reloading does not
// bring it back" is asserted as "leaving the screen and returning does not", and said so where it
// is asserted.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:      quan@example.com  (FIXTURE_ADMIN, role admin, FIXTURE_TEAM, no seeded entries)
// - Member:     thanh@example.com (FIXTURE_MEMBER, role member, FIXTURE_TEAM, no seeded entries)
// - Approved:   linh@example.com  (FIXTURE_APPROVED_MEMBER, role member, owns FIXTURE_APPROVED_ENTRY)
// - Other team: chi@other.example.com (FIXTURE_OTHER_TEAM_MEMBER, owns FIXTURE_OTHER_TEAM_ENTRY)

const SIGNIN = "/signin";
const PASSWORD = "password123";

const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const OWNER_EMAIL = "linh@example.com";
const OTHER_TEAM_EMAIL = "chi@other.example.com";

// Display names, transcribed rather than imported: the acceptance suite addresses the application
// through the browser and does not import from src/.
const OWNER_NAME = "Đã duyệt";

// FIXTURE_APPROVED_ENTRY — owned by OWNER_EMAIL, `approved` and naming an approver, 2026-09-14 to
// 2026-09-16, `updated_at` equal to `created_at`.
const APPROVED_ENTRY_ID = "dd000000-0000-4000-8000-000000000001";
const APPROVED_ENTRY_DATES = "2026-09-14 → 2026-09-16";

// FIXTURE_OTHER_TEAM_ENTRY — owned by OTHER_TEAM_EMAIL, on the OTHER team. AC-8's subject.
const OTHER_TEAM_ENTRY_ID = "dd000000-0000-4000-8000-000000000002";
const OTHER_TEAM_ENTRY_DATES = "2026-09-21 → 2026-09-22";

const teamRows = (page: Page) => page.getByTestId("team-entry-row");
const ownRows = (page: Page) => page.getByTestId("own-entry-row");

/** A team row addressed by the entry it shows, so no assertion depends on row order. */
const teamRow = (page: Page, entryId: string): Locator =>
  page.locator(`[data-testid="team-entry-row"][data-entry-id="${entryId}"]`);

async function signInAs(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Ends the session without a document load, so the entries an earlier step created survive into the
 *  next account's view. That is the whole reason these tests can set up an OWNER's calendar and then
 *  act on it as an ADMIN. */
async function signOutFromHome(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

/** `page.goBack()` replays a history entry react-router pushed, which is a popstate and not a
 *  reload. `page.goto("/")` would reset the mock's module state and lose the setup, which is the
 *  whole reason this walks the history instead of addressing the landing screen directly.
 *
 *  It steps back until it arrives, because the own-entry screen carries NO link home and the depth
 *  therefore depends on how many edits a test made on the way. */
async function backToHome(page: Page): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (new URL(page.url()).pathname === "/") break;
    await page.goBack();
  }
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** An own-entry row's entry id, read off its edit link.
 *
 *  `own-entry-row` carries `data-type`, `data-portion`, `data-status` and the two timestamps, and NOT
 *  the id — src/routes/NewEntry.tsx is CAL-01's and CAL-02's and is deliberately absent from this
 *  ticket's `allowed_paths` (01-plan.md section 7), so the attribute is not this ticket's to add. The
 *  edit link already carries the id in its href because that is the address it points at, so this
 *  reads what is there rather than changing a file to suit a test. */
async function ownEntryId(page: Page, dates: string): Promise<string> {
  const href = await ownRows(page)
    .filter({ hasText: dates })
    .first()
    .getByTestId("own-entry-row-edit")
    .getAttribute("href");
  const id = /\/entries\/([^/]+)\/edit/.exec(href ?? "")?.[1];
  expect(id, `no own-entry row found for ${dates}`).toBeTruthy();
  return id as string;
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

/** Creates an entry for the CALLER, through the only path there is. There is no admin path: AC-6. */
async function createOwnEntry(page: Page, input: EntryInput): Promise<void> {
  await chooseType(page, "new-entry", input.type ?? "pto");
  await choosePortion(page, "new-entry", input.portion ?? "full");
  await pickRange(page, "new-entry", input.start, input.end);
  await page.getByTestId("new-entry-tentative").setChecked(input.tentative ?? false);
  if (input.note !== undefined) await page.getByTestId("new-entry-note").fill(input.note);
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
}

/** Only the named fields are touched, so a test that changes one leaves the other five holding the
 *  entry's own values — which is what makes AC-4's note-only edit a note-only edit. */
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

async function openTeamEdit(page: Page, entryId: string): Promise<void> {
  await teamRow(page, entryId).getByTestId("team-entry-row-edit").click();
  await expect(page.getByTestId("edit-entry-form")).toBeVisible();
}

async function backToTeamList(page: Page): Promise<void> {
  await page.getByTestId("edit-entry-team-back").click();
  await expect(page.getByTestId("team-entries-loading")).toBeHidden();
}

/** The confirmation is deliberate: a hard delete has no undo, and this is somebody else's entry. */
async function deleteTeamRow(page: Page, entryId: string): Promise<void> {
  await teamRow(page, entryId).getByTestId("team-entry-row-delete").click();
  await teamRow(page, entryId).getByTestId("team-entry-delete-confirm").click();
}

test.describe("CAL-03 edit or delete another member's entry, as an admin", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("AC-1: an admin edits another member's entry, and it still belongs to that member", async ({
    page,
  }) => {
    // A PENDING entry of somebody else's, created the only way one can be created — by its owner.
    await signInAs(page, OWNER_EMAIL);
    await openOwnList(page);
    await createOwnEntry(page, { start: "2026-10-05", end: "2026-10-09" });
    await expect(ownRows(page)).toHaveCount(2); // the new one and FIXTURE_APPROVED_ENTRY
    const entryId = await ownEntryId(page, "2026-10-05 → 2026-10-09");
    await backToHome(page);
    await signOutFromHome(page);

    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);

    // The owner's name is the column that makes this list different from the own-entry list.
    const row = teamRow(page, entryId);
    await expect(row.getByTestId("team-entry-row-member")).toHaveText(OWNER_NAME);

    await row.getByTestId("team-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
    await submitEdit(page, { end: "2026-10-07" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    await backToTeamList(page);

    // The new dates, and STILL the owner's. An update that reassigned the row would show the admin's
    // name here, and INV-07 is what refuses it — the update grant omits `member_id` permanently.
    await expect(row.getByTestId("team-entry-row-dates")).toHaveText("2026-10-05 → 2026-10-07");
    await expect(row.getByTestId("team-entry-row-member")).toHaveText(OWNER_NAME);

    // And exactly one row for it: an update that inserted would leave two.
    await expect(row).toHaveCount(1);
  });

  test("AC-2: an admin deletes another member's entry, and leaving the screen does not bring it back", async ({
    page,
  }) => {
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);
    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveCount(1);

    // The first press only asks. A row that vanished on one click would be a colleague's absence
    // gone on a mis-click, with no undo and no trash.
    await teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-row-delete").click();
    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveCount(1);
    await teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-delete-confirm").click();

    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveCount(0);
    await expect(page.getByTestId("team-entry-delete-error")).toHaveCount(0);

    // "Reloading does not bring it back" is asserted as LEAVING AND RETURNING, and the substitution
    // is forced rather than chosen: `page.reload()` reloads the module the mock's table lives in, so
    // it would restore the seeded row and fail against a correct implementation. The property the
    // criterion is after — the delete reached the datastore rather than only the screen — is what
    // this round trip observes, because the list is re-read from the seam on every arrival.
    // SOLO 2026-09-12. The `*-back` link is gone from all six admin screens at the operator's
    // instruction; `shell-admin-link` is what TopBar.tsx:75-80 already called the way back to the
    // calendar from an admin address, and it is a client-side navigation, so the mock's module
    // state survives it where a `page.goto` would not.
    await page.getByTestId("shell-admin-link").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await openTeamList(page);
    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveCount(0);
    await expect(page.getByText(APPROVED_ENTRY_DATES)).toHaveCount(0);
  });

  test("AC-3: an admin's substantive edit revokes the approval, exactly as the owner's would", async ({
    page,
  }) => {
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);

    // The seeded row starts approved and NAMES ITS APPROVER — an entry seeded `approved` with no
    // approver would let this pass against a trigger that clears nothing.
    await expect(teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-row-status")).toHaveAttribute(
      "data-status",
      "approved",
    );

    await openTeamEdit(page, APPROVED_ENTRY_ID);
    await expect(page.getByTestId("edit-entry-approved-by")).toBeVisible();

    await submitEdit(page, { end: "2026-09-17" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    // The reset is the trigger's and it is ACTOR-BLIND by decision (ADR-016 section 2): this is the
    // same reset the owner's own edit produces, and CAL-02's AC-5 asserts that half.
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "pending");
    // The approver goes with the status. An entry reading `pending` while still naming its approver
    // is the false record INV-02 exists to prevent.
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveCount(0);

    await backToTeamList(page);
    await expect(teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-row-status")).toHaveAttribute(
      "data-status",
      "pending",
    );
  });

  test("AC-4: an admin's note-only edit leaves the approval standing", async ({ page }) => {
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);
    await openTeamEdit(page, APPROVED_ENTRY_ID);

    const approver = await page.getByTestId("edit-entry-approved-by").getAttribute("data-approved-by");
    const approvedAt = await page.getByTestId("edit-entry-approved-by").getAttribute("data-approved-at");
    expect(approver).toBeTruthy();
    expect(approvedAt).toBeTruthy();

    // Only the note. `note` is data-model.md's own carve-out from "substantive", and the trigger is
    // the only judge of that — nothing in the seam or on the screen decides it.
    await submitEdit(page, { note: "Corrected by an admin" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "approved");
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveAttribute(
      "data-approved-by",
      approver ?? "",
    );
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveAttribute(
      "data-approved-at",
      approvedAt ?? "",
    );
  });

  test("AC-5: a member cannot reach or change another member's entry", async ({ page }) => {
    await signInAs(page, MEMBER_EMAIL);

    // The link is not offered — an affordance, and the first half of AC-10.
    // **REWRITTEN ONTO `shell-admin-link` BY UIE-10 AC-4.** This line named
    // `home-team-entries-link`, which after that ticket renders for NOBODY — so it would have gone
    // on passing while asserting nothing, because an absent name is absent for every caller.
    // `shell-admin-link` renders for an admin and not for a member, so it can still fail.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);

    // Typed by address, the screen is reached and REFUSES. It lists nothing belonging to anybody.
    await page.goto("/entries/team");
    await expect(page.getByTestId("team-entries-refused")).toBeVisible();
    await expect(teamRows(page)).toHaveCount(0);

    // And the edit address answers the same thing it answers for an id that does not exist. It is
    // ONE answer on purpose: a message distinguishing "not yours" from "no such entry" would be an
    // oracle for which entry ids exist in the team.
    await page.goto(`/entries/${APPROVED_ENTRY_ID}/edit`);
    await expect(page.getByTestId("edit-entry-not-found")).toBeVisible();
    await expect(page.getByTestId("edit-entry-form")).toHaveCount(0);

    // WHAT THIS TEST CANNOT DO, said plainly, because the criterion's second half is weaker than it
    // looks. A member has no way through this interface to ISSUE the update — the form never renders
    // — so "both are refused" is observed as "neither can be attempted". That is the honest form of
    // it through a browser, and it is also why the entry's survival below proves less than it
    // appears: addressing a route is a document load, which reloads the module the mock's table
    // lives in, so what is read after it is the SEEDED row. The load-bearing assertions are the two
    // above. `entry_update_admin`'s `is_admin` half is the real control, and 01-plan.md Open
    // questions item 3 records that tests/permission-model.test.ts — which would issue the statement
    // through the seam once per role and settle this properly — still does not exist.
    await page.goto("/");
    await signOutFromHome(page);
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);
    await expect(teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-row-dates")).toHaveText(
      APPROVED_ENTRY_DATES,
    );
    await expect(teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-row-status")).toHaveAttribute(
      "data-status",
      "approved",
    );
  });

  test("AC-6: an admin is offered no way to create an entry on another member's behalf", async ({
    page,
  }) => {
    await signInAs(page, ADMIN_EMAIL);

    // The team screen writes nothing that does not already exist. Its only controls are per-row.
    await openTeamList(page);
    await expect(page.getByTestId("new-entry-form")).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);

    // And the create form an admin DOES have offers no member. Exactly two grouped controls, type
    // and portion — the same assertion CAL-01 AC-10 makes for both roles, repeated here because this
    // is the ticket that would have been tempted to add a third. SOLO, 2026-09-10: the two were
    // `<select>`s and are segmented button groups now.
    // SOLO 2026-09-12. The back link is gone; `openOwnList` clicks `home-new-entry-link`, which
    // renders on every screen inside the shell.
    await openOwnList(page);
    await expect(page.locator("#root select, form select")).toHaveCount(0);
    await expect(page.getByTestId("new-entry-form").locator('[role="group"]')).toHaveCount(2);
    await expect(page.getByTestId("new-entry-type")).toBeVisible();
    await expect(page.getByTestId("new-entry-portion")).toBeVisible();

    // The asymmetry is DECIDED (features.md CAL-03: "this row must not grow a create path"), so an
    // entry an admin creates is still their own.
    await createOwnEntry(page, { start: "2026-10-20", end: "2026-10-20" });
    await expect(ownRows(page)).toHaveCount(1);
  });

  test("AC-7: an admin editing another member's entry is offered no way to reassign it", async ({
    page,
  }) => {
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);

    const ownerId = await teamRow(page, APPROVED_ENTRY_ID).getAttribute("data-member-id");
    expect(ownerId).toBeTruthy();

    await openTeamEdit(page, APPROVED_ENTRY_ID);

    // The form carries the same six fields it carries for an owner, and a member is not among them.
    // `UpdateEntryInput` has no `memberId`, and the update grant omits the column permanently — the
    // affordance and the control agree, which is why there is no seventh field to hide.
    // SOLO, 2026-09-10: type and portion were `<select>`s and are segmented button groups now, so
    // the count moved to `role="group"`. Two controls, and nothing naming a member.
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.getByTestId("edit-entry-form").locator('[role="group"]')).toHaveCount(2);
    await expect(page.getByTestId("edit-entry-member")).toHaveCount(0);

    await submitEdit(page, { note: "Still theirs" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    await backToTeamList(page);
    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveAttribute("data-member-id", ownerId ?? "");
    await expect(teamRow(page, APPROVED_ENTRY_ID).getByTestId("team-entry-row-member")).toHaveText(
      OWNER_NAME,
    );
  });

  test("AC-8: an admin cannot see, edit or delete an entry belonging to another team", async ({
    page,
  }) => {
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);

    // Not in the list. `entry_select_team` is what withholds it, and the mock reproduces the same
    // comparison — including that `member_team_id` is NULL for a removed member and that `null =
    // null` is not true.
    await expect(teamRow(page, OTHER_TEAM_ENTRY_ID)).toHaveCount(0);
    await expect(page.getByText("Người nhóm khác")).toHaveCount(0);

    // Nor reachable by address, and the refusal says nothing about whether the id exists.
    await page.goto(`/entries/${OTHER_TEAM_ENTRY_ID}/edit`);
    await expect(page.getByTestId("edit-entry-not-found")).toBeVisible();
    await expect(page.getByTestId("edit-entry-form")).toHaveCount(0);

    // THIS IS THE CRITERION WITH THE WEAKEST OBSERVATION IN THE SUITE and it is worth naming rather
    // than burying: exactly one team exists in v1, so this is asserted against SEEDED data and not
    // against a second team's real session. A one-team fixture passes whether the team predicate is
    // in `entry_update_admin` or absent from it — which is precisely why 01-plan.md section 6 puts
    // the predicate in writing, and why the migration's step 1 comment says it cannot be caught here.
    await page.goto("/");
    await signOutFromHome(page);
    await signInAs(page, OTHER_TEAM_EMAIL);
    await openOwnList(page);
    await expect(ownRows(page)).toHaveCount(1);
    await expect(ownRows(page).first().getByTestId("own-entry-row-dates")).toHaveText(
      OTHER_TEAM_ENTRY_DATES,
    );
  });

  test("AC-9: the overlap is evaluated against the OWNER's calendar, never the admin's", async ({
    page,
  }) => {
    // The owner's two entries, on dates that do not touch.
    await signInAs(page, OWNER_EMAIL);
    await openOwnList(page);
    await createOwnEntry(page, { start: "2026-11-05", end: "2026-11-05" });
    await createOwnEntry(page, { start: "2026-11-20", end: "2026-11-20" });
    const targetId = await ownEntryId(page, "2026-11-20 → 2026-11-20");
    await backToHome(page);
    await signOutFromHome(page);

    // The admin's OWN entry, on a third date. It exists to prove the negative half below.
    await signInAs(page, ADMIN_EMAIL);
    await openOwnList(page);
    await createOwnEntry(page, { start: "2026-10-01", end: "2026-10-01" });
    await backToHome(page);
    await openTeamList(page);

    // HALF ONE. Moving the owner's 20th onto the owner's own 5th is refused, and the refusal names
    // the clash rather than reporting a database error text.
    await openTeamEdit(page, targetId);
    await submitEdit(page, { start: "2026-11-05", end: "2026-11-05" });
    const error = page.getByTestId("edit-entry-error");
    await expect(error).toBeVisible();
    const text = (await error.textContent())?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/range lower bound|23P01|daterange|exclusion/i);

    await backToTeamList(page);
    await expect(teamRow(page, targetId).getByTestId("team-entry-row-dates")).toHaveText(
      "2026-11-20 → 2026-11-20",
    );

    // HALF TWO, AND IT IS THE ONE AN IMPLEMENTATION WRITTEN FROM THE ADMIN'S POINT OF VIEW FAILS.
    // `entry_no_overlapping_portion` keys on the ROW's `member_id`, so the admin's own 1 October is
    // irrelevant to the owner's calendar and this save must SUCCEED. A comparison written against
    // the caller instead of the row refuses here — and it would also have accepted a genuine
    // double-booking of the owner, so the two halves fail together and only this half shows it.
    await openTeamEdit(page, targetId);
    await submitEdit(page, { start: "2026-10-01", end: "2026-10-01" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);

    await backToTeamList(page);
    await expect(teamRow(page, targetId).getByTestId("team-entry-row-dates")).toHaveText(
      "2026-10-01 → 2026-10-01",
    );
    await expect(teamRow(page, targetId).getByTestId("team-entry-row-member")).toHaveText(
      OWNER_NAME,
    );
  });

  test("AC-10: the team entry list is reachable by an admin and by nobody else", async ({ page }) => {
    await signInAs(page, ADMIN_EMAIL);
    // **ON THE HUB SINCE UIE-10, NOT IN THE SIDEBAR.** The criterion's substance is untouched — the
    // list is reachable by an admin and by nobody else — and only the surface the link sits on
    // moved. The admin half still follows a link rather than typing the address, which is what
    // makes it a claim about reachability.
    await expect(page.getByTestId("shell-admin-link")).toBeVisible();
    await page.getByTestId("shell-admin-link").click();
    await expect(page.getByTestId("admin-hub-team-entries-link")).toBeVisible();
    await page.getByTestId("admin-hub-team-entries-link").click();
    await expect(page.getByTestId("team-entries-loading")).toBeHidden();
    await expect(page.getByTestId("team-entries")).toBeVisible();
    await expect(page.getByTestId("team-entries-refused")).toHaveCount(0);
    // The list shows the whole team, the caller's own rows included — it is not "everybody else's".
    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveCount(1);

    // SOLO 2026-09-12. The back link is gone; `home-sign-out` is a sidebar control and is on
    // this screen already, so the hop through `/` is not needed.
    await signOutFromHome(page);

    await signInAs(page, MEMBER_EMAIL);
    // **REWRITTEN ONTO `shell-admin-link` BY UIE-10 AC-4.** This line named
    // `home-team-entries-link`, which after that ticket renders for NOBODY — so it would have gone
    // on passing while asserting nothing, because an absent name is absent for every caller.
    // `shell-admin-link` renders for an admin and not for a member, so it can still fail.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
    await page.goto("/entries/team");
    await expect(page.getByTestId("team-entries-refused")).toBeVisible();
    // It lists no entry, and it names nobody. A refusal that said what it was withholding would be
    // the read it is refusing.
    //
    // SCOPED TO THE REFUSAL AND NO LONGER PAGE-WIDE, by UIE-02 AC-24. Since UIE-02 the shell's
    // sidebar names every active team-mate on every screen, so a page-wide `getByText(OWNER_NAME)`
    // now matches the ROSTER rather than anything this screen leaked. That is not the intent stated
    // one line above: the intent is about the refusal, and the refusal is the whole of what this
    // component renders in this state (`src/routes/TeamEntries.tsx:124-136`), so the scope below IS
    // the content pane here. The roster is a read `Read the member list` grants a member outright
    // and `/members` already performs — it withholds nothing this assertion was protecting.
    await expect(teamRows(page)).toHaveCount(0);
    await expect(page.getByTestId("team-entries-refused").getByText(OWNER_NAME)).toHaveCount(0);
  });

  test("AC-11: an admin's edit records when it happened, and nothing distinguishes it from the owner's", async ({
    page,
  }) => {
    // Two entries of the owner's, identical in shape. One will be edited by the owner and one by an
    // admin, and the comparison at the end is between those two rows.
    await signInAs(page, OWNER_EMAIL);
    await openOwnList(page);
    await createOwnEntry(page, { start: "2026-12-01", end: "2026-12-01" });
    await createOwnEntry(page, { start: "2026-12-08", end: "2026-12-08" });

    const ownerEditedId = await ownEntryId(page, "2026-12-01 → 2026-12-01");
    const adminEditedId = await ownEntryId(page, "2026-12-08 → 2026-12-08");

    // The owner edits one of them, themselves.
    await ownRows(page)
      .filter({ hasText: "2026-12-01 → 2026-12-01" })
      .first()
      .getByTestId("own-entry-row-edit")
      .click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
    await submitEdit(page, { note: "By its owner" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);
    await page.getByTestId("edit-entry-back").first().click();
    await expect(page.getByTestId("new-entry-form")).toBeVisible();

    await backToHome(page);
    await signOutFromHome(page);

    // The admin edits the other.
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);

    const before = await teamRow(page, adminEditedId).getAttribute("data-updated-at");
    const created = await teamRow(page, adminEditedId).getAttribute("data-created-at");
    expect(before).toBe(created); // never edited: the two start equal, which is what makes this
    // observable at all — the seed and the mock both write them equal at insert.

    await openTeamEdit(page, adminEditedId);
    await submitEdit(page, { note: "By an admin" });
    await expect(page.getByTestId("edit-entry-error")).toHaveCount(0);
    await backToTeamList(page);

    // The when. This is the ONLY trace of the admin's edit anywhere in v1.
    const after = await teamRow(page, adminEditedId).getAttribute("data-updated-at");
    expect(after).not.toBe(created);
    expect(String(after) > String(created)).toBe(true);

    // And the who, which is not recorded. The two rows carry the SAME set of attribute names — one
    // edited by its owner, one by an admin — so nothing stored on the entry says which was which.
    // This is `rbac-and-security.md` known weakness 3, asserted rather than assumed: the criterion
    // is that the product does NOT record it, and 01-plan.md Open questions item 1 carries the
    // `updated_by` column to the operator as the operator's decision.
    const adminEditedNames = await teamRow(page, adminEditedId).evaluate((el) =>
      el.getAttributeNames().sort().join(","),
    );
    const ownerEditedNames = await teamRow(page, ownerEditedId).evaluate((el) =>
      el.getAttributeNames().sort().join(","),
    );
    expect(adminEditedNames).toBe(ownerEditedNames);
    expect(adminEditedNames).not.toMatch(/updated-by|edited-by|updated_by/i);
  });

  test("AC-12: deleting an approved entry removes its approval with it", async ({ page }) => {
    await signInAs(page, ADMIN_EMAIL);
    await openTeamList(page);

    // It names an approver before the delete — otherwise there would be no approval to lose.
    await openTeamEdit(page, APPROVED_ENTRY_ID);
    await expect(page.getByTestId("edit-entry-approved-by")).toBeVisible();
    await backToTeamList(page);

    await deleteTeamRow(page, APPROVED_ENTRY_ID);
    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveCount(0);
    await expect(page.getByTestId("team-entry-delete-error")).toHaveCount(0);

    // A HARD delete: `entry` carries no soft-delete column, so the row and its `approved_by`
    // disappear together and nothing remains referring to either. The approver was rendered in
    // exactly two places — the row's status line and the edit screen — and after the delete there is
    // no row to carry it and no edit link to reach it.
    //
    // ASSERTED CLIENT-SIDE, and the constraint is the mock's rather than a preference: addressing
    // `/entries/<id>/edit` is a document load, which reloads the module the entry table lives in and
    // restores the seeded row — so a `page.goto` here would fail against a CORRECT implementation.
    // The round trip below re-reads the list from the seam without reloading it.
    // SOLO 2026-09-12. The `*-back` link is gone from all six admin screens at the operator's
    // instruction; `shell-admin-link` is what TopBar.tsx:75-80 already called the way back to the
    // calendar from an admin address, and it is a client-side navigation, so the mock's module
    // state survives it where a `page.goto` would not.
    await page.getByTestId("shell-admin-link").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await openTeamList(page);
    await expect(teamRow(page, APPROVED_ENTRY_ID)).toHaveCount(0);
    await expect(page.getByText(APPROVED_ENTRY_DATES)).toHaveCount(0);
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveCount(0);
  });
});
