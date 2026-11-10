import { expect, test, type Locator, type Page } from "@playwright/test";

// SOLO, 2026-09-11 — the Teams tab: many teams, managed by every admin.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md`.
//
// **THE OPERATOR'S DECISIONS, each asserted below rather than assumed:** every admin manages every
// team (tests 3 to 6 act on a team the admin is not on); only an EMPTY team may be deleted (test 4);
// an approved member may be moved and their history follows them (test 5); a sign-up may be admitted
// onto any team (test 6); and the whole thing is a tab of its own (test 1).
//
// **NO `page.goto` AFTER A WRITE.** The mock seam keeps its rows in module scope, so a document load
// throws away every team this file creates — the trap `solo-team-settings.spec.ts` fell into and
// recorded. Every return trip below walks the admin tab strip.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). Fixtures (`src/lib/fixtures.ts`): the admin is on
// FIXTURE_TEAM, "CaleChip", with four active people and one removed; FIXTURE_OTHER_TEAM, "Nhóm
// khác", holds one member; FIXTURE_PENDING_SIGNUP is waiting with no team.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

// Transcribed rather than imported: the acceptance suite does not import from `src/`.
const OWN_TEAM = "CaleChip";
const OTHER_TEAM = "Nhóm khác";
const OTHER_TEAM_MEMBER_ID = "66666666-6666-4666-8666-666666666666";
const PENDING_ID = "88888888-8888-4888-8888-888888888888";

/** § Language's own pattern, from `ui-language.json`. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

const teamRow = (page: Page, name: string): Locator =>
  page.locator(`[data-testid="team-row"][data-team-name="${name}"]`);

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  const loading = page.getByTestId("app-session-loading");
  if (await loading.isVisible()) await expect(loading).toBeHidden();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Into the admin area and onto the Teams tab, without a document load. */
async function openTeams(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-teams-link").click();
  await expect(page.getByTestId("teams-list")).toBeVisible();
}

/** Away to another tab and back, so the screen unmounts and re-reads — never `page.goto`. */
async function reopen(page: Page): Promise<void> {
  await page.getByTestId("admin-hub-members-link").click();
  await expect(page.getByTestId("teams-list")).toHaveCount(0);
  await page.getByTestId("admin-hub-teams-link").click();
  await expect(page.getByTestId("teams-list")).toBeVisible();
}

async function createTeam(page: Page, name: string): Promise<void> {
  await page.getByTestId("teams-create-input").fill(name);
  await page.getByTestId("teams-create-save").click();
  // The row carries the STORED name, which the seam trims — so the wait is on the trimmed one.
  // Written first against the typed string, and the test that types surrounding spaces failed on it.
  await expect(teamRow(page, name.trim())).toHaveCount(1);
}

test.describe("SOLO — the Teams tab", () => {
  test("1: an admin reaches it from the strip, and it lists every team on the system", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();

    const tab = page.getByTestId("admin-hub-teams-link");
    await expect(tab).toHaveText("Teams");
    await expect(tab).toHaveAttribute("href", "/teams");
    await tab.click();

    // BOTH teams — the admin's own AND one they are not on. `getTeam()` would only ever have
    // answered one; this is `list_teams()`.
    await expect(page.getByTestId("team-row")).toHaveCount(2);
    await expect(teamRow(page, OWN_TEAM)).toHaveAttribute("data-mine", "true");
    await expect(teamRow(page, OTHER_TEAM)).toHaveAttribute("data-mine", "false");

    // Four and not five on the admin's team: the removed person is counted out by
    // `currentMemberCount`, INV-04's own denominator, and is still said to be there for history.
    await expect(teamRow(page, OWN_TEAM)).toHaveAttribute("data-member-count", "4");
    await expect(teamRow(page, OWN_TEAM).getByTestId("team-row-removed")).toBeVisible();
    await expect(teamRow(page, OTHER_TEAM)).toHaveAttribute("data-member-count", "1");

    // The top bar's admin control is current on this address too — `ADMIN_ADDRESSES` derives from
    // the tab list, so no second list had to be told about `/teams`. *Until 2026-10-19 it asserted
    // the control's `Calendar` face, which no longer exists.*
    await expect(page.getByTestId("shell-admin-link")).toHaveAttribute("aria-current", "page");
  });

  test("2: an admin creates a team, and it starts empty with every default", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await openTeams(page);

    // Disabled on a blank name — an affordance; the seam refuses one too (`empty_team_name`).
    await page.getByTestId("teams-create-input").fill("   ");
    await expect(page.getByTestId("teams-create-save")).toBeDisabled();

    await createTeam(page, "  Nhóm Kế hoạch  ");
    // TRIMMED — the row carries what was stored, not what was typed.
    const row = teamRow(page, "Nhóm Kế hoạch");
    await expect(row).toHaveAttribute("data-member-count", "0");
    await expect(row.getByTestId("team-row-empty")).toBeVisible();
    await expect(page.getByTestId("teams-count")).toHaveAttribute("data-total", "3");
    await expect(page.getByTestId("teams-create-input")).toHaveValue("");
  });

  test("3: an admin renames a team they are not on", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await openTeams(page);

    const row = teamRow(page, OTHER_TEAM);
    await row.getByTestId("team-row-name-input").fill("Nhóm Hỗ trợ");
    await row.getByTestId("team-row-name-save").click();
    await expect(teamRow(page, "Nhóm Hỗ trợ")).toHaveCount(1);

    // It survives leaving and coming back, which is the read being real.
    await reopen(page);
    await expect(teamRow(page, "Nhóm Hỗ trợ")).toHaveCount(1);
    await expect(teamRow(page, OTHER_TEAM)).toHaveCount(0);
  });

  test("4: only an empty team can be deleted", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await openTeams(page);

    // **THE FENCE.** Both seeded teams have people on them, and the admin's own also holds somebody
    // removed — kept for history, so that team can never be deleted at all.
    await expect(teamRow(page, OWN_TEAM).getByTestId("team-row-delete")).toBeDisabled();
    await expect(teamRow(page, OTHER_TEAM).getByTestId("team-row-delete")).toBeDisabled();

    await createTeam(page, "Nhóm Tạm");
    const empty = teamRow(page, "Nhóm Tạm");
    await expect(empty.getByTestId("team-row-delete")).toBeEnabled();
    await empty.getByTestId("team-row-delete").click();

    await expect(teamRow(page, "Nhóm Tạm")).toHaveCount(0);
    await expect(page.getByTestId("teams-count")).toHaveAttribute("data-total", "2");
  });

  test("5: an admin moves somebody between two teams they are not on, and an emptied team can then go", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openTeams(page);
    await createTeam(page, "Nhóm Mới");

    // The person on the OTHER team, moved to the new one — neither team is the admin's own.
    const person = teamRow(page, OTHER_TEAM).locator(
      `[data-testid="team-member"][data-member-id="${OTHER_TEAM_MEMBER_ID}"]`,
    );
    await person.getByTestId("team-member-move").selectOption({ label: "Nhóm Mới" });

    // Two counts move at once, both read back from the datastore rather than predicted.
    await expect(teamRow(page, "Nhóm Mới")).toHaveAttribute("data-member-count", "1");
    await expect(teamRow(page, OTHER_TEAM)).toHaveAttribute("data-member-count", "0");
    await expect(
      teamRow(page, "Nhóm Mới").locator(`[data-testid="team-member"][data-member-id="${OTHER_TEAM_MEMBER_ID}"]`),
    ).toHaveCount(1);

    // The team they left had nobody removed from it, so it is now truly empty — the foreign key's
    // definition — and the delete the fence refused in test 4 is now allowed.
    const emptied = teamRow(page, OTHER_TEAM);
    await expect(emptied.getByTestId("team-row-delete")).toBeEnabled();
    await emptied.getByTestId("team-row-delete").click();
    await expect(teamRow(page, OTHER_TEAM)).toHaveCount(0);
  });

  test("6: a sign-up can be admitted onto a team the admin is not on", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-allow-list-link").click();

    const row = page.locator(`[data-testid="signup-row"][data-member-id="${PENDING_ID}"]`);
    await row.getByTestId("signup-row-team").selectOption({ label: OTHER_TEAM });
    await expect(row.getByTestId("signup-row-team")).not.toHaveAttribute("data-team-id", /^1111/);
    await row.getByTestId("signup-row-approve").click();
    await expect(row).toHaveCount(0);

    // And they are on THAT team — read from the Teams tab, which is the witness the sign-up spec
    // could not use because it had no cross-team read.
    await page.getByTestId("admin-hub-teams-link").click();
    await expect(
      teamRow(page, OTHER_TEAM).locator(`[data-testid="team-member"][data-member-id="${PENDING_ID}"]`),
    ).toHaveCount(1);
    await expect(teamRow(page, OTHER_TEAM)).toHaveAttribute("data-member-count", "2");
  });

  test("7: a member is refused, reads no team, and is offered no way in", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto("/teams");

    await expect(page.getByTestId("teams-refused")).toBeVisible();
    await expect(page.getByTestId("team-row")).toHaveCount(0);
    expect(await page.getByTestId("teams-refused").innerText()).not.toContain(OTHER_TEAM);
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
  });

  test("8: the interface copy is English", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await openTeams(page);

    // Team names and people's names are DATA and are excluded — the distinction UIE-10 AC-11 draws
    // for the roster. What is checked is copy this screen authors.
    // SOLO 2026-09-12: `teams-back` left this list with the link itself.
    for (const id of ["teams-count", "teams-create-save"]) {
      expect(await page.getByTestId(id).innerText(), `${id} must carry no diacritic`).not.toMatch(
        DIACRITIC,
      );
    }
  });
});
