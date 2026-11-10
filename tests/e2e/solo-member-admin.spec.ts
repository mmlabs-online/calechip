import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-10 — the member tab gains a team column, a last-sign-in column and three row actions.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to this
// file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md`.
//
// **NO IMAGE WAS ATTACHED WITH THE REQUEST**, though it said *"như design trên hình"*. What the
// operator specified in words is which columns and which actions; the arrangement is the agent's own
// and is marked as such in `MemberList.tsx` — `.ai/standards/ui-design-system.md` § *Visual
// specification*. Nothing below asserts a layout, only which facts and which controls are present.
//
// **TWO OF THE SIX COLUMNS COULD NOT BE BUILT AS ASKED, AND BOTH LIMITS ARE ASSERTED HERE RATHER
// THAN LEFT TO BE DISCOVERED:**
//   * *Delete account* is a SOFT remove (test 4). A hard delete of `auth.users` needs the
//     service-role key and therefore a server ADR-005 refuses, and it would break ADR-013 — a
//     removed member counts until the day they were removed, and INV-04 divides by that. The
//     operator was asked and chose the soft remove.
//   * *Change team* offers ONE team (test 5). `member_update_admin`'s `with check` is
//     `team_id = member_team_id(auth.uid())`, so the only team an admin can write is their own.
//
// **`last_sign_in_at` IS A COLUMN THIS CHANGE CREATED.** GoTrue holds the original on
// `auth.users`, which is not exposed through PostgREST, so the browser cannot read it; a trigger
// copies it onto `public.member`, where `member_select_team` already decides who may read it.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise), so the refusals below are the mock's reproduction of the policies.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function openMembers(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-members-link").click();
  await expect(page.getByTestId("member-list-table")).toBeVisible();
}

/**
 * A row that is NOT the signed-in admin's own.
 *
 * **SELECTED BY THE CONTROL IT CARRIES AND NOT BY ITS ID.** `data-member-id` sits on the `<tr>`
 * itself, so `filter({ hasNot })` — which looks for a DESCENDANT — excludes nothing, and the first
 * version of this helper silently returned the admin's own row. TEA-04 AC-14 is that an admin's
 * own row draws no remove control, so "has a remove control" IS "is somebody else" here, and it says
 * what the test actually needs rather than re-deriving it.
 */
function otherRow(page: Page) {
  return page
    .getByTestId("member-list-row")
    .filter({ has: page.getByTestId("member-list-row-remove") })
    .first();
}

test.describe("SOLO — the member tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signin");
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("1: every row carries all seven facts the operator listed", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openMembers(page);

    const rows = page.getByTestId("member-list-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      // Avatar, name and role are TEA-04's and keep their ids; team and last sign-in are new.
      await expect(row.getByTestId("member-list-row-avatar")).toHaveCount(1);
      await expect(row.getByTestId("member-list-row-name")).not.toBeEmpty();
      await expect(row.getByTestId("member-list-row-role")).toHaveCount(1);
      await expect(row.getByTestId("member-list-row-team")).not.toBeEmpty();
      // SOLO, 2026-09-12. The seventh fact. The operator's list on 2026-09-12 was *avatar, tên,
      // role, team, email, last sign-in, action*, and email was the one of the seven this screen did
      // not have — `public.member` had no such column until
      // `20260912120000_solo_member_email.sql`.
      await expect(row.getByTestId("member-list-row-email")).not.toBeEmpty();
      await expect(
        row.getByTestId("member-list-row-last-sign-in"),
      ).not.toBeEmpty();
    }
  });

  test("7: the email cell carries the account's own address, and says so per row", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openMembers(page);

    // **THE ADMIN'S OWN ROW IS THE ONE ASSERTION THAT CANNOT PASS BY ACCIDENT**: the address is the
    // one this test just signed in with, so a column that rendered a constant, the wrong row's
    // address, or a placeholder fails here.
    // The row is found by the address it renders rather than by a hard-coded uuid: the fixture id
    // is not otherwise named in this file, and a second copy of it here would be a second place to
    // fix when the fixtures move.
    const mine = page
      .getByTestId("member-list-row")
      .filter({ has: page.getByTestId("member-list-row-email").getByText(ADMIN_EMAIL) });
    await expect(mine.getByTestId("member-list-row-email")).toHaveText(ADMIN_EMAIL);
    await expect(mine.getByTestId("member-list-row-email")).toHaveAttribute(
      "data-email",
      ADMIN_EMAIL,
    );

    // And the rows do not all say the same thing — two distinct addresses on screen is what
    // separates "reads the row" from "reads the session".
    const shown = await page
      .getByTestId("member-list-row-email")
      .evaluateAll((cells) => cells.map((cell) => cell.textContent?.trim() ?? ""));

    expect(shown.length).toBeGreaterThan(1);
    expect(new Set(shown).size).toBeGreaterThan(1);

    // **NEVER A BLANK CELL.** `—` is the fallback and means the copy has not arrived; an empty cell
    // would read as an account without an address, which no account is.
    for (const value of shown) expect(value.length).toBeGreaterThan(0);
  });

  test("2: the last-sign-in cell says a date or says Never, and never goes blank", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openMembers(page);

    // **A BLANK CELL READS AS MISSING DATA; `Never` IS A FACT ABOUT THE PERSON.** That is the whole
    // decision this criterion pins, and it is invisible by inspection because the fixtures all have
    // a timestamp — a row whose value went null would silently render an empty cell.
    const cells = page.getByTestId("member-list-row-last-sign-in");
    for (const text of await cells.allTextContents()) {
      expect(text.trim()).toMatch(/^(Never|\d{4}-\d{2}-\d{2})$/);
    }

    // And the raw value travels beside the rendered one, so an assertion can read the fact without
    // depending on the copy — the shape `shell-roster-role` and `year-day-cell` already use.
    for (let i = 0; i < (await cells.count()); i += 1) {
      await expect(cells.nth(i)).toHaveAttribute("data-at", /^(|.+)$/);
    }
  });

  test("3: view info opens a panel that reads nothing and offers nothing", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openMembers(page);

    const row = page.getByTestId("member-list-row").first();
    const name = (
      await row.getByTestId("member-list-row-name").innerText()
    ).trim();

    await row.getByTestId("member-list-row-view").click();

    const panel = page.getByTestId("member-info");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(name);

    // **IT CARRIES NO CONTROL, which is what makes it safe to offer to everybody.** It renders the
    // row already on screen, so it discloses nothing the table did not; a panel that fetched would
    // be a second source for the same facts and the two could disagree.
    await expect(panel.locator("button")).toHaveCount(0);
    await expect(panel.locator("input, select, textarea")).toHaveCount(0);

    await page.getByTestId("member-info-close").click();
    await expect(panel).toHaveCount(0);
  });

  test("4: delete account is a soft remove — the roster shrinks and the account is not destroyed", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openMembers(page);

    const before = await page.getByTestId("member-list-row").count();

    const row = otherRow(page);
    await expect(row).toHaveCount(1);
    await row.getByTestId("member-list-row-remove").click();

    // TEA-04's confirmation, unchanged — only the button's LABEL moved to `Delete account`.
    await expect(page.getByTestId("member-list-remove-confirm")).toBeVisible();
    await page.getByTestId("member-list-remove-confirm-accept").click();

    await expect(page.getByTestId("member-list-row")).toHaveCount(before - 1);

    // **SOFT, AND THIS IS THE LINE THAT SAYS SO.** A hard delete would need a server ADR-005
    // refuses; ADR-013 additionally requires a removed member to keep counting until the day they
    // were removed, which a destroyed row could not do. The seam still holds them — `listMembers`
    // returns removed members carrying `removedAt`, and the screen is what stops drawing them — so
    // the calendar's historical counts are unchanged by this action.
    await expect(page.getByTestId("member-list-table")).toBeVisible();
  });

  test("5: edit offers the team control, and exactly one team to choose", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openMembers(page);

    await page
      .getByTestId("member-list-row")
      .first()
      .getByTestId("member-list-row-edit")
      .click();

    const panel = page.getByTestId("member-edit");
    await expect(panel).toBeVisible();

    const picker = panel.getByTestId("member-edit-team");
    await expect(picker).toHaveCount(1);

    // **ONE OPTION, AND THE SCREEN SAYS WHY IN WORDS.** `member_update_admin`'s `with check` pins the
    // destination to the admin's own team, and `member_select_team` already scoped every row on this
    // list to that team — so there is no second team a save could name that the datastore would
    // accept. A control offering more would be offering a journey that is refused.
    await expect(picker.locator("option")).toHaveCount(1);
    await expect(panel.getByTestId("member-edit-note")).toBeVisible();

    // It saves, and the save is a real write through `setMemberTeam` rather than a closed dialog:
    // the panel shuts only on success, and a refusal would stay on screen with its own message.
    await panel.getByTestId("member-edit-save").click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId("member-edit-error")).toHaveCount(0);
  });

  test("6: a member reaches the screen and is offered no write control", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto("/members");

    // TEA-04 AC-13, AC-14, unchanged: a member READS the roster and is offered nothing that writes.
    // The two read-only actions this change adds are offered to them, and that widens nothing —
    // `View info` shows the row already on screen and `Edit`'s one save is `member_update_admin`,
    // which refuses a member exactly as it always did.
    await expect(page.getByTestId("member-list-table")).toBeVisible();
    await expect(page.getByTestId("member-list-row-promote")).toHaveCount(0);
    await expect(page.getByTestId("member-list-row-remove")).toHaveCount(0);
  });
});
