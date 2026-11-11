import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseType, pickRange } from "./support/entry-form";

// ADM-04 — the worklist of entries awaiting a decision.
//
// Written from 01-plan.md sections 2, 2b, 3, 4.3 and 4.5. Every locator is a `data-testid` from the
// selector table in section 4.5; the ones this file uses that are NOT in that table —
// `sign-in-*`, `home-sign-out`, `home-new-entry-link`, `shell-admin-link`, `admin-hub-*-link`,
// `new-entry-*`,
// `own-entry-row`, `edit-entry-form`, `not-on-a-team-*` — belong to TEA-01, TEA-05, CAL-01, CAL-02
// and CAL-03 and are declared in 03-impl-log.md § Deviations.
//
// **THE DIVISION OF LABOUR WITH tests/pending-entries.test.ts IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts pure logic and seam behaviour at the unit level and "a
// full acceptance criterion through the interface" at this one. So the predicate, the order, the
// paging arithmetic and the exact count are asserted there against `listPendingEntries` directly,
// and this file asserts what an ADMIN SEES: the rows, the names on them, the two filters changing
// what is listed, the sentence an empty queue says, the link off each row, and — AC-9 — the controls
// that are not there.
//
// **AC-3, AC-4, AC-5 AND AC-16 ARE ASSERTED IN tests/pending-entries.test.ts OR NOWHERE, AND THAT IS
// DECLARED IN 03-impl-log.md.** It is the same shape CAL-05, CAL-06 and CAL-08 each recorded:
// - AC-3 and AC-4 need a matching set larger than `PENDING_PAGE_SIZE`, which is 50. Creating
//   fifty-one entries through this form would spend minutes of wall clock proving arithmetic. What
//   IS asserted here is that the paging control exists, states the page it is on, and is correctly
//   inert on a set that fits in one page.
// - AC-5 is a throw inside the seam on a page the datastore shortened. The mock's slice and its
//   count come from one array so the two cannot disagree, and no test can make PostgREST cap a read
//   without a provisioned project. The BRANCH is `pending-entries-unavailable`, which is rendered by
//   the same `catch` every other read on this screen falls into.
// - AC-16 needs the process timezone changed under the read, which a browser test cannot do.
//
// **THE PENDING ENTRIES BELOW ARE CREATED THROUGH THE PRODUCT AND NOT SEEDED, which is a declared
// deviation from 01-plan.md section 4.4.** Every active member of FIXTURE_TEAM has an own-entry list
// whose exact row count is asserted by a shipped suite — `own-entries-empty` for
// `thanh@example.com` at cal-01-create-entry.spec.ts:72, two rows for `linh@example.com` at
// cal-03-admin-edit-entry.spec.ts:183, one row for `quan@example.com` at
// cal-07-overload-warning.spec.ts:418, one row for `dung@example.com` at
// cal-07-overload-warning.spec.ts:302 — so a seeded pending entry breaks one of them whoever owns
// it, and 01-plan.md section 7 requires all of those suites to pass UNEDITED. Creating the rows is
// also the truthful route: `status` is the column default, a pending entry is exactly what CAL-01's
// form produces, and nothing here needs a state the product cannot reach.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the team scoping asserted below is the mock's reproduction of `entry_select_team`
// and `member_select_team`. This ticket ships no policy and no migration — every read it makes was
// already permitted (01-plan.md sections 3, 5 and 6).
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's tables live in module memory and a `page.goto`
// reloads the module. ITS SESSION DOES NOT RESET: mock.ts writes the session to `localStorage`
// exactly as `@supabase/auth-js` does, so switching people is done by signing out, and navigation
// within a test is done by clicking links — the constraint every suite from CAL-01 onwards records.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql). Two entries exist before any test
// runs, and BOTH must stay off this list:
// - FIXTURE_APPROVED_ENTRY — 14 to 16 September 2026, owned by `linh@example.com`, `approved`. The
//   row that appears if the status predicate is dropped (AC-1).
// - FIXTURE_OTHER_TEAM_ENTRY — 21 to 22 September 2026, owned by the OTHER team's member, and
//   already `pending`. The only thing keeping it out is the team scope, which is what makes AC-13
//   assertable at all rather than vacuous.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const APPROVED_EMAIL = "linh@example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";

const WORKLIST = "/entries/pending";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const APPROVED_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_NAME = "Thành viên";
const APPROVED_NAME = "Đã duyệt";
const APPROVED_ENTRY_ID = "dd000000-0000-4000-8000-000000000001";
const OTHER_TEAM_ENTRY_ID = "dd000000-0000-4000-8000-000000000002";

/** Permanently upcoming, and far outside every window the calendar screens are used for. */
const UPCOMING = { start: "2030-03-04", end: "2030-03-06" };
const UPCOMING_WFH = { start: "2030-03-11", end: "2030-03-11" };
/** Permanently past: before the day this ticket was planned. */
const PAST = { start: "2025-03-04", end: "2025-03-06" };

const rows = (page: Page): Locator => page.getByTestId("pending-entry-row");

const rowFor = (page: Page, startDate: string): Locator =>
  page.locator(`[data-testid="pending-entry-row"][data-start-date="${startDate}"]`);

const count = (page: Page): Locator => page.getByTestId("pending-entries-count");

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/**
 * Signed out at the worklist address, then signed in — WITHOUT a document load after the sign-in.
 *
 * The route is guarded on membership the way `/threshold` is, so a signed-out caller never reaches
 * the component: `/entries/pending` sends them to `/`, which resolves to the sign-in screen. There
 * is therefore no `pending-entries-sign-in` to click, unlike the calendar views.
 */
async function signInAt(page: Page, email: string): Promise<void> {
  await page.goto(WORKLIST);
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
}

/** Ends the session and starts another, all client-side, so the mock's tables survive. */
async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Declares one entry through CAL-01's form, from Home, and returns to Home. `owned` is how many
 *  entries the signed-in member holds afterwards — the wait that proves the write landed. */
async function declare(
  page: Page,
  fields: { start: string; end: string; type?: "pto" | "wfh" },
  owned: number,
): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();

  await pickRange(page, "new-entry", fields.start, fields.end);
  if (fields.type) await chooseType(page, "new-entry", fields.type);

  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(owned);

  await page.goBack();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Opens the worklist by the admin link this ticket adds.
 *
 *  **TWO CLICKS SINCE UIE-10.** The link this ticket added lived in the sidebar as
 *  `home-pending-entries-link`; that ticket removed the sidebar's four admin links and the address is
 *  now reached through `shell-admin-link` in the top bar and then `admin-hub-pending-link` on the hub
 *  UIE-09 shipped. AC-9 below is unchanged in substance — a link to this screen is offered to an
 *  admin, and it carries no count — and only the surface it sits on moved. */
async function openWorklist(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-pending-link").click();
  await expect(page.getByTestId("pending-entries-count")).toBeVisible();
}

test.describe("ADM-04 — the worklist of entries awaiting a decision", () => {
  test("AC-1, AC-2 and AC-13: the pending entries of this team, named, and nothing else", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    // AC-1. One row, and it is the pending one that was just created.
    await expect(rows(page)).toHaveCount(1);
    await expect(rowFor(page, UPCOMING.start)).toHaveAttribute("data-end-date", UPCOMING.end);
    await expect(rowFor(page, UPCOMING.start)).toHaveAttribute("data-member-id", MEMBER_ID);

    // AC-2. The column that makes this a worklist rather than a list of anonymous rows.
    await expect(rowFor(page, UPCOMING.start).getByTestId("pending-entry-row-member")).toHaveText(
      MEMBER_NAME,
    );

    // AC-1's other half. FIXTURE_APPROVED_ENTRY belongs to this team and is `approved`, so it is the
    // row that appears the moment the status predicate is dropped.
    await expect(
      page.locator(`[data-testid="pending-entry-row"][data-entry-id="${APPROVED_ENTRY_ID}"]`),
    ).toHaveCount(0);

    // AC-13 and INV-07. FIXTURE_OTHER_TEAM_ENTRY is PENDING, so the status predicate does not hide
    // it — the only thing keeping it off this screen is the team scope, which is what makes this
    // assertion mean something rather than pass for the wrong reason.
    await expect(
      page.locator(`[data-testid="pending-entry-row"][data-entry-id="${OTHER_TEAM_ENTRY_ID}"]`),
    ).toHaveCount(0);

    // AC-3's rendered half: the exact figure, beside the number of rows on screen.
    await expect(count(page)).toHaveAttribute("data-total", "1");
    await expect(count(page)).toHaveAttribute("data-shown", "1");
  });

  test("AC-6 and AC-7: past-dated pending entries are on the list, because there is no window to hide them", async ({
    page,
  }) => {
    // **REWRITTEN BY `solo` ON 2026-09-10, AND WHAT IT ASSERTS IS THE OPPOSITE OF WHAT IT DID.**
    // As shipped this read *"the default window hides past-dated entries, and a filter reaches
    // them"*, and drove `pending-entries-window` through all three windows. The operator removed
    // the filter — *"Bỏ phần filter"* — so there is no window control and no window to choose.
    //
    // **THE CRITERIA SURVIVE THE CONTROL, WHICH IS WHY THIS IS A REWRITE AND NOT A DELETION.** AC-6
    // was that the default hides past-dated entries; AC-7 was that they are REACHABLE and still
    // `pending`. AC-6's precondition is gone with the control, and AC-7 is now held more strongly
    // than it was: reachable in one click instead of two, because the query is pinned to `all`.
    // That pinning is the whole reason the filter could be removed without hiding anything — see
    // `src/routes/PendingEntries.tsx` at `queryFor`. Asserting it HERE is what stops a later edit
    // quietly restoring `upcoming` and making past-dated entries unreachable with no control to
    // reveal them.
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await declare(page, PAST, 2);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    // BOTH, from the first paint, with nothing chosen by anybody.
    await expect(rows(page)).toHaveCount(2);
    await expect(rowFor(page, UPCOMING.start)).toHaveCount(1);
    await expect(rowFor(page, PAST.start)).toHaveCount(1);
    await expect(count(page)).toHaveAttribute("data-total", "2");

    // AC-7's substance: the past-dated one is still `pending` — nobody ever decided it, and there
    // is no fourth `entry_status` (01-plan.md section 1, Out of scope).
    await expect(rowFor(page, PAST.start).getByTestId("entry-decision")).toHaveAttribute(
      "data-status",
      "pending",
    );

    // AND THE CONTROLS ARE GONE, asserted here rather than only in the solo spec, because a filter
    // reintroduced beside a query pinned to `all` would be a control that changes nothing.
    await expect(page.getByTestId("pending-entries-window")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-type")).toHaveCount(0);
  });

  test("AC-8: work-from-home entries are listed beside leave, with no type control to separate them", async ({
    page,
  }) => {
    // **REWRITTEN BY `solo` ON 2026-09-10.** The second half of this criterion drove
    // `pending-entries-type` and is gone with the control (*"Bỏ phần filter"*). The FIRST half is
    // 01-plan.md section 2, Open questions item 1's assumption — *a WFH entry goes through approval
    // exactly as a PTO entry does* — and it is untouched, still observable, and still the half worth
    // having: it is a claim about the product, where the filter was a claim about a widget.
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, APPROVED_EMAIL);
    // Two, because FIXTURE_APPROVED_ENTRY already belongs to this account.
    await declare(page, { ...UPCOMING_WFH, type: "wfh" }, 2);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    // Both kinds on one list, always — there is no longer any way to see one without the other.
    await expect(rows(page)).toHaveCount(2);
    await expect(count(page)).toHaveAttribute("data-total", "2");
    await expect(rowFor(page, UPCOMING.start)).toHaveAttribute("data-type", "pto");
    await expect(rowFor(page, UPCOMING_WFH.start)).toHaveAttribute("data-type", "wfh");
    await expect(rowFor(page, UPCOMING_WFH.start)).toHaveAttribute(
      "data-member-id",
      APPROVED_MEMBER_ID,
    );
    // AC-2 again, on a SECOND owner: the queue is the team's and not one person's, and the name
    // comes from the roster read rather than from the entry.
    await expect(rowFor(page, UPCOMING_WFH.start).getByTestId("pending-entry-row-member")).toHaveText(
      APPROVED_NAME,
    );
  });

  test("AC-9 and AC-15: no approve control, no reject control, and no employment vocabulary", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    await expect(rows(page)).toHaveCount(1);

    // AC-9. The denial is held by ABSENCE — 01-plan.md section 3 says so — and this is the assertion
    // from outside. `product` argued at triage that a read-only worklist is not separable from the
    // action and lost; the losing argument is what this test protects.
    for (const control of [
      "pending-entry-row-approve",
      "pending-entry-row-reject",
      "pending-entries-approve",
      "pending-entries-reject",
    ]) {
      await expect(page.getByTestId(control)).toHaveCount(0);
    }

    // Nothing that writes A FORM. ADM-05 superseded part of this assertion: it mounts
    // `entry-decision` on each row — two buttons and, once reject is pressed, one textarea — which
    // is what .ai/registry/features.md's ADM-05 row requires ("the decision surface is ADM-04's
    // list; this row adds the two controls and the mandatory reason to it"). ADM-06 superseded the
    // `input` half: AC-1 of that ticket puts a selection checkbox on every row, which is an `<input>`
    // inside this list, and its 01-plan.md section 7 puts this file in `allowed_paths` for exactly
    // this one line rather than leaving it to be discovered at IN_PROGRESS.
    //
    // WHAT SURVIVES IS ADM-04'S OWN PROPERTY and is still worth holding: this screen has no form of
    // its own and no field that edits an entry, so the row link is still the only way to CHANGE one.
    // ADM-06's batch bar sits OUTSIDE the `<ul>` precisely so that this assertion keeps meaning
    // something (that ticket's 01-plan.md section 2b).
    const list = page.getByTestId("pending-entries");
    await expect(list.locator("form")).toHaveCount(0);

    // AC-15. The object is an ENTRY and never a request, an application or an *đơn*; no quota,
    // balance, entitlement or remaining-days figure appears; and nothing reaches HR. The charter's
    // refusals 1 and 2, asserted as copy because that is where they would be broken first.
    const body = (await page.locator("body").textContent()) ?? "";
    for (const forbidden of [
      "request",
      "Request",
      "application",
      "Application",
      "đơn",
      "quota",
      "Quota",
      "balance",
      "Balance",
      "entitlement",
      "remaining",
      "Remaining",
      "days left",
      "HR",
    ]) {
      expect(body, `the worklist copy must not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  test("AC-10 and AC-12: a member is refused, and the refusal is not what protects anything", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();

    // AC-10's affordance half: no link is offered to a member.
    //
    // **REWRITTEN ONTO `shell-admin-link` BY UIE-10 AC-4, AND THAT IS NOT A COSMETIC MOVE.** This
    // line named `home-pending-entries-link`, which after that ticket renders for NOBODY — so it
    // would have gone on passing while asserting nothing, because an absent name is absent for
    // every caller. `shell-admin-link` renders for an admin and not for a member, so the assertion
    // can still fail, which is the whole of what makes it worth running.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);

    // Typing the address anyway. A reload here resets the mock's tables and keeps the session, which
    // costs nothing: this criterion reads no row.
    await page.goto(WORKLIST);
    await expect(page.getByTestId("pending-entries-refused")).toBeVisible();
    await expect(page.getByTestId("pending-entries")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-loading")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-count")).toHaveCount(0);

    // AND THE REFUSAL PROTECTS NOTHING, which is 01-plan.md section 3's point and the reason this
    // criterion is written the way it is: `entry_select_team` admits the whole team's rows to both
    // roles, so the same member reads the same entries at /entries/team. A refusal that were load
    // bearing would make this next assertion fail.
    // SOLO 2026-09-12. The back link is gone. **NOT `shell-admin-link` here** — the caller is a
    // MEMBER and that control does not render for one (it is the very thing the next assertion
    // checks). The sidebar is what a refused member leaves by, and this is that walk.
    await page.getByTestId("home-week-link").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    // Also rewritten onto `shell-admin-link` (UIE-10 AC-4). It named `home-team-entries-link` and
    // the two ids used to be different nodes; since UIE-10 both denials are carried by the one
    // control, so this reads the same locator as the line above. IT IS KEPT RATHER THAN DELETED
    // because what it observes is different: that the member is offered nothing AFTER the round
    // trip through the refusal, on the page that refusal returned them to.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
  });

  test("AC-12: a caller with no member row reaches no worklist either", async ({ page }) => {
    // The route is guarded on membership the way `/threshold` is, so this caller never reaches the
    // component — they land on the member-less screen. DECLARED in 03-impl-log.md as a deviation
    // from AC-12's letter, which expects the component's own refusal: the guard answers first, and
    // ADM-01's `/threshold` behaves identically. What the criterion is about — no list, and not a
    // loading state that never ends — holds either way.
    await signInAt(page, MEMBER_LESS_EMAIL);

    await page.goto(WORKLIST);
    await expect(page.getByTestId("pending-entries")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-count")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-loading")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("AC-11: an empty worklist says so, rather than looking like a screen that failed", async ({
    page,
  }) => {
    await signInAt(page, ADMIN_EMAIL);
    await openWorklist(page);

    // Nothing on this team is pending in the default window: the two seeded entries are an APPROVED
    // one and one belonging to the other team.
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-empty")).toBeVisible();
    await expect(count(page)).toHaveAttribute("data-total", "0");
    await expect(page.getByTestId("pending-entries-unavailable")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-loading")).toHaveCount(0);
  });

  test("AC-14 REVERSED: the row carries the whole entry and links to no edit screen", async ({
    page,
  }) => {
    // **THE ASSERTION IS FLIPPED, NOT DELETED — `solo`, 2026-09-10**, on the operator's instruction
    // against an image: *"bỏ nút open"*, *"Show đầy đủ thông tin request ngay từng row"*. AC-14 read
    // *each row links to that entry's own edit screen*; it no longer does, and a test that vanished
    // would leave no record that it once did.
    //
    // **THE ROUTE IS NOT GONE AND THIS TEST SAYS SO** at the end: `/entries/:id/edit` still renders
    // for the same entry, still for an admin, and CAL-03's team list still reaches it on every row.
    // What was removed is a door, not a room.
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    const row = rowFor(page, UPCOMING.start);
    const entryId = await row.getAttribute("data-entry-id");
    expect(entryId).toBeTruthy();

    await expect(row.getByTestId("pending-entry-row-link")).toHaveCount(0);
    await expect(row.locator("a")).toHaveCount(0);

    // What replaced it: everything a decision needs, on the row. The dates and the member were
    // always here; the note is no longer truncated and `createdAt` is drawn, which is the field that
    // previously required opening the entry.
    await expect(row.getByTestId("pending-entry-row-member")).toBeVisible();
    await expect(row.getByTestId("pending-entry-row-dates")).toBeVisible();
    await expect(row.getByTestId("pending-entry-row-declared")).toHaveAttribute(
      "data-created-at",
      /.+/,
    );
    await expect(row.getByTestId("entry-decision-approve")).toBeVisible();
    await expect(row.getByTestId("entry-decision-reject")).toBeVisible();

    // The edit screen itself is untouched and still admits this admin for this entry — reached
    // through CAL-03's team list, which is the affordance that replaced the removed link.
    //
    // CLICKED AND NEVER `page.goto`: a full navigation discards the in-memory seam's module state,
    // the session with it, so the assertion would land on the sign-in screen and say nothing about
    // the edit route. tests/e2e/cal-01-create-entry.spec.ts:30 records the same trap.
    await page.getByTestId("admin-hub-team-entries-link").click();
    await expect(page.getByTestId("team-entries-loading")).toBeHidden();
    await page
      .locator(`[data-testid="team-entry-row"][data-entry-id="${entryId}"]`)
      .getByTestId("team-entry-row-edit")
      .click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
  });

  test("AC-4: a set that fits one page offers no load-more control at all", async ({
    page,
  }) => {
    // **REWRITTEN BY `solo` ON 2026-09-10**, on the operator's instruction *"Bỏ pagination thay
    // bằng load more"*. AC-4's ARGUMENT is untouched and is why the control still exists in some
    // form: this is paging and not truncation, because a ceiling turns a long queue into an error
    // and a queue long enough to trip it is precisely the queue an admin most needs to work through
    // (01-plan.md section 8, rejected alternative 4).
    //
    // **WHAT CHANGED IS THE INERT CASE, AND IT IS NOW ABSENCE RATHER THAN DISABLEMENT.** The pager
    // rendered `Previous` and `Next` greyed out on a one-page set — two visible controls asserting
    // that somewhere else exists. A disabled "Load more" would say the same untrue thing, so the
    // control is not rendered when every row is already on screen. This is the assertion that says
    // so, and it would fail on a disabled-but-present control exactly as it fails on a working one.
    //
    // The arithmetic over a set larger than one page is asserted in `tests/pending-entries.test.ts`
    // against a set of fifty-four, and the accumulate-and-append behaviour in
    // `tests/e2e/solo-pending-approval-ui.spec.ts`. Creating fifty-one entries through the form here
    // would be a browser test that spends four minutes proving something arithmetic.
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    await expect(rows(page)).toHaveCount(1);
    await expect(count(page)).toHaveAttribute("data-total", "1");

    // Nothing to load, so nothing offering to load it — and the retired ids resolve to no node.
    await expect(page.getByTestId("pending-entries-more")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-page")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-prev")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-next")).toHaveCount(0);
  });

  test("AC-9: the admin link is offered to an admin, and it carries no count of its own", async ({
    page,
  }) => {
    await signInAt(page, ADMIN_EMAIL);

    // **ON THE HUB SINCE UIE-10, NOT ON HOME.** The criterion's substance is untouched: a link to
    // this screen is offered to an admin and it states no number. Only the surface moved.
    await page.getByTestId("shell-admin-link").click();
    const link = page.getByTestId("admin-hub-pending-link");
    await expect(link).toBeVisible();

    // No badge. A number here would need a second read, and two reads can disagree — the one
    // property .ai/registry/features.md:103 forbids this feature from having. The hub row carries a
    // name and a blurb and no figure, so the assertion is now `toContainText` on the name rather
    // than `toHaveText` on the whole row: the blurb is UIE-09's copy and not this criterion's to
    // pin. What this criterion is about — NO COUNT — is asserted directly below it, over the
    // row's whole text, and that is the half a rename could not quietly satisfy.
    await expect(link).toContainText("Pending approvals");
    expect(((await link.textContent()) ?? "").match(/\d/)).toBeNull();
  });
});
