import { expect, test, type Locator, type Page } from "@playwright/test";
import { pickRange } from "./support/entry-form";

// ADM-05 — approve or reject an entry, with a reason on rejection.
//
// Written from 01-plan.md sections 2, 2b, 3, 4.4 and 4.5. Every locator is a `data-testid` from the
// selector table in section 4.5; the ones this file uses that are NOT in that table — `sign-in-*`,
// `home-sign-out`, `home-new-entry-link`, `shell-admin-link`, `admin-hub-team-entries-link`,
// `admin-hub-pending-link`,
// `new-entry-*`, `own-entry-row*`, `edit-entry-form`, `edit-entry-submit`, `team-entry-row*`,
// `pending-entry-row*` — belong to TEA-01, TEA-05, CAL-01, CAL-02, CAL-03 and ADM-04 and are
// declared in 03-impl-log.md § Deviations.
//
// **THE DIVISION OF LABOUR WITH tests/entry-decision.test.ts IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts seam behaviour at the unit level and "a full acceptance
// criterion through the interface" at this one. So the transitions, the provenance and the two
// refusal codes are asserted there against `approveEntry` and `rejectEntry` directly, and this file
// asserts what an ADMIN and a MEMBER SEE: the queue shrinking, the count falling with it, the reason
// field refusing to be skipped, the reason reaching its subject with nobody telling them, the
// controls that exist on each status and the one that exists on none.
//
// **AC-6, AC-7, AC-10, AC-12, AC-13, AC-14, AC-16 AND AC-17 ARE ASSERTED IN
// tests/entry-decision.test.ts OR NOWHERE, AND THAT IS DECLARED IN 03-impl-log.md.** Each is a
// property of the write and not of a screen: the tentative flag surviving, the approver being the
// actor rather than the sender, self-approval, INV-02's reset on an edit, and the three refusals
// whose only interface consequence is a sentence this file already asserts once.
//
// **AC-8 AND AC-9 HAVE NO INTERFACE HALF TO ASSERT, AND THE ABSENCE IS ASSERTED INSTEAD.** A member
// cannot reach the panel: `/entries/pending` refuses them, and `/entries/:id/edit` mounts the panel
// for an admin only. So what is checked here is that a member standing on their own rejected entry
// is offered NO decision control at all — the affordance half — while the refusal itself is clause
// (a)'s and is demonstrated against the mock in the unit suite. 01-plan.md Open questions item 2
// states what that does and does not prove.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so every refusal observed below is src/lib/data/mock.ts reproducing
// `entry_update_admin` and clauses (a) and (b) of `public.entry_enforce_decision()`. The migration
// this ticket ships is applied by a human (RULE-09) and is not exercised here.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's entry table lives in module memory and a
// `page.goto` reloads the module. ITS SESSION DOES NOT: mock.ts writes the session to
// `localStorage`, so switching people is done by signing out, and navigation within a test is done
// by clicking links and by `page.goBack()` — the constraint every suite from CAL-01 onwards records.
//
// THE ENTRIES BELOW ARE CREATED THROUGH CAL-01'S FORM AND NOT SEEDED — 01-plan.md section 7 adds no
// fixture on purpose, and every criterion here is stronger created by the write it is testing. The
// two seeded rows both matter by staying where they are: FIXTURE_APPROVED_ENTRY is on the team list
// and off the worklist, and FIXTURE_OTHER_TEAM_ENTRY is pending and invisible to this team.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:  quan@example.com  (FIXTURE_ADMIN, role admin, FIXTURE_TEAM, no seeded entries)
// - Member: thanh@example.com (FIXTURE_MEMBER, role member, FIXTURE_TEAM, no seeded entries)

const SIGNIN = "/signin";
const PASSWORD = "password123";

const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** Permanently upcoming, and far outside every date the other suites fix. */
// Monday to Wednesday. Was Saturday to Monday until SOLO 2026-09-14 disabled weekends in the picker.
const UPCOMING = { start: "2030-05-06", end: "2030-05-08" };
const DATES = `${UPCOMING.start} → ${UPCOMING.end}`;

const FIRST_REASON = "Two people are already out that week.";
const SECOND_REASON = "Could you take the Thursday and Friday instead?";

const pendingRows = (page: Page): Locator => page.getByTestId("pending-entry-row");

const pendingRow = (page: Page): Locator =>
  page.locator(`[data-testid="pending-entry-row"][data-start-date="${UPCOMING.start}"]`);

const teamRow = (page: Page): Locator =>
  page.getByTestId("team-entry-row").filter({ hasText: DATES });

const count = (page: Page): Locator => page.getByTestId("pending-entries-count");

async function signInAs(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Ends the session without a document load, so the entry an earlier step created survives into the
 *  next account's view. That is the whole reason these tests can set a member's calendar up and then
 *  act on it as an admin. */
async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signInAs(page, email);
}

/** `page.goBack()` replays a history entry react-router pushed, which is a popstate and not a
 *  reload. `page.goto("/")` would reset the mock's module state and lose the setup. */
async function backToHome(page: Page): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (new URL(page.url()).pathname === "/") break;
    await page.goBack();
  }
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Declares one entry through CAL-01's form, the only path there is. */
async function declare(page: Page): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();
  await pickRange(page, "new-entry", UPCOMING.start, UPCOMING.end);
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(1);
  await backToHome(page);
}

/** **TWO CLICKS SINCE UIE-10**, which removed the sidebar's four admin links: the top-bar control,
 *  then the hub row UIE-09 shipped. The destination and everything asserted about it are unchanged. */
async function openWorklist(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-pending-link").click();
  await expect(count(page)).toBeVisible();
}

/** The admin's route to an entry that has left the worklist: CAL-03's team list, which lists every
 *  status. It is the reason the panel is mounted on the edit screen at all (01-plan.md section 2b). */
async function openFromTeamList(page: Page): Promise<void> {
  // Two clicks since UIE-10, for the same reason as `openWorklist` above.
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-team-entries-link").click();
  await expect(page.getByTestId("team-entries-loading")).toBeHidden();
  await teamRow(page).getByTestId("team-entry-row-edit").click();
  await expect(page.getByTestId("edit-entry-form")).toBeVisible();
}

/** One entry, declared by the member and waiting in the admin's queue. */
async function oneWaiting(page: Page): Promise<void> {
  await signInAs(page, MEMBER_EMAIL);
  await declare(page);
  await switchTo(page, ADMIN_EMAIL);
  await openWorklist(page);
  await expect(pendingRows(page)).toHaveCount(1);
  await expect(count(page)).toHaveAttribute("data-total", "1");
}

test.describe("ADM-05 approve or reject an entry, with a reason on rejection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("AC-1 and AC-19: an admin approves, the entry leaves the queue and the count falls with it", async ({
    page,
  }) => {
    await oneWaiting(page);

    // AC-1. One control, no confirmation dialog — approving is reversible by rejecting, and a dialog
    // on the commonest action in a queue is how a queue stops being worked.
    await pendingRow(page).getByTestId("entry-decision-approve").click();

    // The row is gone AND the exact figure fell. Both come from the same read, so they cannot
    // disagree — a local splice is what would let them.
    await expect(pendingRows(page)).toHaveCount(0);
    await expect(count(page)).toHaveAttribute("data-total", "0");
    await expect(page.getByTestId("pending-entries-empty")).toBeVisible();

    // The decision as the datastore recorded it, read on the screen the admin reaches it from.
    await backToHome(page);
    await openFromTeamList(page);
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "approved");
    await expect(page.getByTestId("edit-entry-approved-by")).toBeVisible();

    // AC-19. The star's meaning, said once, in the product — and said as coordination rather than as
    // permission, which is charter refusal 2 stated where somebody reads it.
    const meaning = page.getByTestId("edit-entry-star-meaning");
    await expect(meaning).toBeVisible();
    await expect(meaning).toContainText("an admin has seen this entry");
    await expect(meaning).toContainText("not permission to be away");
  });

  test("AC-3 then AC-2: a rejection with no reason is refused, and one with a reason lands", async ({
    page,
  }) => {
    await oneWaiting(page);

    await pendingRow(page).getByTestId("entry-decision-reject").click();
    await expect(pendingRow(page).getByTestId("entry-decision-reason")).toHaveAttribute(
      "data-required",
      "true",
    );

    // AC-3. Whitespace only, which is the case a `required` attribute alone would let through.
    await pendingRow(page).getByTestId("entry-decision-reason").fill("   ");
    await pendingRow(page).getByTestId("entry-decision-submit").click();

    const error = pendingRow(page).getByTestId("entry-decision-error");
    await expect(error).toBeVisible();
    // WHICH refusal, not "some" refusal — and no SQLSTATE reaches the screen, because the seam
    // refuses before the write and INV-03's check is never met.
    await expect(error).toHaveAttribute("data-code", "rejection_reason_required");
    await expect(error).not.toContainText("23514");

    // Nothing was written: the row is where it was and the count did not move.
    await expect(pendingRows(page)).toHaveCount(1);
    await expect(count(page)).toHaveAttribute("data-total", "1");
    await expect(pendingRow(page).getByTestId("entry-decision")).toHaveAttribute(
      "data-status",
      "pending",
    );

    // AC-2. The same field, now with a reason.
    await pendingRow(page).getByTestId("entry-decision-reason").fill(FIRST_REASON);
    await pendingRow(page).getByTestId("entry-decision-submit").click();

    await expect(pendingRows(page)).toHaveCount(0);
    await expect(count(page)).toHaveAttribute("data-total", "0");
  });

  test("AC-15 and AC-20: the owner reads the reason with nobody telling them, and nothing is locked", async ({
    page,
  }) => {
    await oneWaiting(page);

    await pendingRow(page).getByTestId("entry-decision-reject").click();
    await pendingRow(page).getByTestId("entry-decision-reason").fill(FIRST_REASON);
    await pendingRow(page).getByTestId("entry-decision-submit").click();
    await expect(pendingRows(page)).toHaveCount(0);

    // No message of any kind is sent — v1 has no notification channel and this ticket must not grow
    // one. The member simply opens their entry.
    await backToHome(page);
    await switchTo(page, MEMBER_EMAIL);
    await page.getByTestId("home-new-entry-link").click();

    const row = page.getByTestId("own-entry-row").first();
    await expect(row.getByTestId("own-entry-row-status")).toHaveAttribute("data-status", "rejected");

    // AC-20's first half, on the list they were refused on: the entry is still there, still theirs,
    // and both of its controls are still offered.
    await expect(row.getByTestId("own-entry-row-edit")).toBeVisible();
    await expect(row.getByTestId("own-entry-row-delete")).toBeVisible();

    await row.getByTestId("own-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();

    // AC-15. The reason, and WHEN the decision was recorded. `data-updated-at` is the trigger's own
    // timestamp; WHO is not available and 01-plan.md Open questions item 1 records why.
    await expect(page.getByTestId("edit-entry-rejection-reason")).toContainText(FIRST_REASON);
    await expect(page.getByTestId("edit-entry-decided-at")).not.toHaveAttribute("data-updated-at", "");

    // AC-20's second half: the form is still editable by its owner. Nothing in the product is
    // disabled because an entry is rejected.
    await expect(page.getByTestId("edit-entry-submit")).toBeEnabled();

    // AC-8 and AC-9, the affordance half: a member is offered no decision control anywhere. The
    // control is clause (a) and not this absence — the unit suite asserts the refusal.
    await expect(page.getByTestId("entry-decision")).toHaveCount(0);
  });

  test("AC-11, AC-5 and AC-4: every offered transition, and the one that is offered nowhere", async ({
    page,
  }) => {
    await oneWaiting(page);

    // pending → rejected.
    await pendingRow(page).getByTestId("entry-decision-reject").click();
    await pendingRow(page).getByTestId("entry-decision-reason").fill(FIRST_REASON);
    await pendingRow(page).getByTestId("entry-decision-submit").click();
    await expect(pendingRows(page)).toHaveCount(0);

    // The worklist shows pending entries by construction, so the rejected entry is reachable only
    // from the team list — which is why the panel is mounted on the edit screen at all.
    await backToHome(page);
    await openFromTeamList(page);
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "rejected");

    const panel = page.getByTestId("entry-decision");
    await expect(panel).toHaveAttribute("data-status", "rejected");
    await expect(panel.getByTestId("entry-decision-approve")).toBeVisible();

    // AC-5. rejected → rejected: the same field on the same form, opening on the wording that is
    // already there.
    await panel.getByTestId("entry-decision-reject").click();
    await expect(panel.getByTestId("entry-decision-reason")).toHaveValue(FIRST_REASON);
    await panel.getByTestId("entry-decision-reason").fill(SECOND_REASON);
    await panel.getByTestId("entry-decision-submit").click();

    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "rejected");
    await expect(page.getByTestId("edit-entry-rejection-reason")).toContainText(SECOND_REASON);
    // No approval was created or destroyed by re-wording a refusal.
    await expect(page.getByTestId("edit-entry-approved-by")).toHaveCount(0);

    // AC-4. rejected → approved, and the reason goes with it: INV-03's check is a biconditional, so
    // the two are written in one statement and a stale reason cannot survive the approval.
    await panel.getByTestId("entry-decision-approve").click();
    await expect(page.getByTestId("edit-entry-status")).toHaveAttribute("data-status", "approved");
    await expect(page.getByTestId("edit-entry-rejection-reason")).toHaveCount(0);
    await expect(page.getByTestId("edit-entry-approved-by")).toBeVisible();

    // AC-11. On an approved entry the approve control is GONE and only rejection is offered —
    // `approved → approved` is not a decision. And nothing anywhere returns an entry to `pending`:
    // that transition is named in no permission row and is not built.
    await expect(panel.getByTestId("entry-decision-approve")).toHaveCount(0);
    await expect(panel.getByTestId("entry-decision-reject")).toBeVisible();
    await expect(page.getByTestId("edit-entry-status")).not.toHaveAttribute("data-status", "pending");
  });

  test("AC-18: the copy is a coordination signal and never an employment decision", async ({
    page,
  }) => {
    await oneWaiting(page);
    await pendingRow(page).getByTestId("entry-decision-reject").click();

    // The reason field asks WHAT WOULD WORK INSTEAD rather than demanding a justification, which is
    // the concrete content of "the one thing that makes a refusal actionable".
    await expect(page.getByText("What would work instead?")).toBeVisible();

    // No quota, balance, entitlement or remaining-days figure appears — on either screen this ticket
    // touches, and in either language.
    const forbidden = /quota|balance|entitlement|remaining days|days left|đơn/i;
    await expect(page.getByText(forbidden)).toHaveCount(0);

    // And the object is an ENTRY, said in the product's own words.
    await expect(pendingRow(page)).toBeVisible();
    await expect(count(page)).toContainText("entry");

    await backToHome(page);
    await page.getByTestId("home-new-entry-link").click();
    await expect(page.getByText(forbidden)).toHaveCount(0);
  });
});
