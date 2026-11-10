import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-11 — the team's settings: its name, its size, and the threshold.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md`.
//
// **WHAT THE OPERATOR ASKED FOR AND WHAT THEY CHOSE.** *"tôi muốn có nơi quản lí list Teams ở
// admin"*. Shown three shapes and what each costs, they chose the single-team one: a place that
// shows the team's name, size and created date, with the name and the threshold editable. They did
// NOT choose multi-team, and test 5 is the standing assertion that this change did not quietly
// deliver it anyway.
//
// **WHY MULTI-TEAM WAS A DECISION AND NOT A PREFERENCE.** `public.team` has no insert policy and no
// delete policy; `.ai/standards/data-model.md` says *"One row in v1"* and *"Refuse. No delete path
// exists for a team in v1"*. More than one team would also make two documented, accepted-because-
// hypothetical costs live at once — `member_select_pending_admin` is deliberately not team-scoped,
// so every admin would see every pending sign-up and could claim one for their own team
// (`rbac-and-security.md:93-96`), and the holiday calendar is national, so any admin would rewrite
// everybody's Tết (`data-model.md:211`).
//
// **THE ADDRESS IS STILL `/threshold` AND THAT IS THE ACCEPTED MISMATCH.** Re-addressing a shipped
// screen is what UIE-09's plan refused in terms, and six specs point there. The TAB reads `Team`.
//
// **SUPERSEDED LATER THE SAME DAY, BY THE OPERATOR.** When the approval switches joined this screen
// they chose to re-address it to `/setting` and name the tab `Settings`; `/threshold` redirects. The
// constant below and the tab's text follow that decision, and nothing else in this file moved.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise). Fixtures (`src/lib/fixtures.ts`): FIXTURE_TEAM carries two admins, two members and one
// REMOVED member, which is what makes the member count a real assertion rather than an array length.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

const THRESHOLD = "/setting";

/** FIXTURE_TEAM's seeded name, transcribed rather than imported — the acceptance suite addresses the
 *  application through the browser and does not import from `src/`. */
const SEEDED_NAME = "CaleChip";

/** Four active members plus one removed. `currentMemberCount` applies ADR-013's rule, so the screen
 *  must say 4 and never 5 — the whole reason it calls that function instead of `roster.length`. */
const ACTIVE_MEMBERS = "4";

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

/**
 * Leave the screen and come back WITHOUT a document load, by walking the admin tab strip.
 *
 * **`page.goto` WOULD MAKE THE ASSERTION VACUOUS AND NOT MERELY SLOW.** The mock seam keeps its rows
 * in module scope, so a document load resets the team's name to the fixture's — a test that renamed
 * the team, reloaded, and then asserted the new name would fail, and one that asserted the OLD name
 * would pass while proving nothing. Written with `goto` first and caught by the failure; five
 * shipped spec files avoid the same trap with `page.goBack()` helpers.
 *
 * The strip renders on every admin address (`AdminLayout`), so the round trip is two clicks and the
 * component genuinely unmounts and re-reads.
 */
async function reopen(page: Page): Promise<void> {
  await page.getByTestId("admin-hub-members-link").click();
  await expect(page.getByTestId("team-settings")).toHaveCount(0);
  await page.getByTestId("admin-hub-threshold-link").click();
  await expect(page.getByTestId("team-settings")).toBeVisible();
}

test.describe("SOLO — team settings", () => {
  test("1: an admin reaches it from the Admin tab strip, and the tab is named Settings", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();

    // The id and the address are UIE-09's and are deliberately unchanged; only the word an admin
    // reads moved, because the screen now carries more than the threshold.
    const tab = page.getByTestId("admin-hub-threshold-link");
    await expect(tab).toHaveText("Settings");
    await expect(tab).toHaveAttribute("href", THRESHOLD);

    await tab.click();
    await expect(page.getByTestId("team-settings")).toBeVisible();
  });

  test("2: it shows the name, the active member count and the created date", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.goto(THRESHOLD);

    await expect(page.getByTestId("team-name-input")).toHaveValue(SEEDED_NAME);

    // **FOUR AND NOT FIVE.** The fixture team holds a removed member, and `currentMemberCount` is
    // INV-04's denominator — the same function the week view's `0/4` strip uses. A count written
    // here with a `.filter()` would be a second definition of "currently a member" and this is the
    // assertion that would not notice it, so the attribute is read rather than the sentence.
    await expect(page.getByTestId("team-member-count")).toHaveAttribute(
      "data-member-count",
      ACTIVE_MEMBERS,
    );

    // The created date is drawn from the stored instant by slicing the ISO string, so this asserts
    // the attribute rather than the rendering — the rendering is `dd/MM/yyyy` and carries no locale.
    await expect(page.getByTestId("team-created")).toBeVisible();
    const createdAt = await page.getByTestId("team-created").getAttribute("data-created-at");
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("3: an admin renames the team, and the name is the one the datastore returned", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.goto(THRESHOLD);

    // **WITH SURROUNDING SPACES, WHICH IS THE POINT.** The seam trims; the field is refilled from
    // the row that came back, so what is on screen afterwards is what is stored rather than what was
    // typed. A screen that echoed the typed string would show a name with spaces nobody can see.
    await page.getByTestId("team-name-input").fill("  Nhóm Kế hoạch  ");
    await page.getByTestId("team-name-save").click();

    await expect(page.getByTestId("team-name-saved")).toBeVisible();
    await expect(page.getByTestId("team-name-input")).toHaveValue("Nhóm Kế hoạch");
    await expect(page.getByTestId("team-name-error")).toHaveCount(0);

    // It survives leaving and coming back — which is the read being real rather than the form
    // holding its own copy.
    await reopen(page);
    await expect(page.getByTestId("team-name-input")).toHaveValue("Nhóm Kế hoạch");
  });

  test("4: an empty name is refused, and the refusal is the seam's", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.goto(THRESHOLD);

    // The button is disabled on an empty field — an affordance, not the control (ADR-005).
    await page.getByTestId("team-name-input").fill("   ");
    await expect(page.getByTestId("team-name-save")).toBeDisabled();

    // And the name is unchanged: an affordance that hid a write is not the same as one that
    // prevented it, and this is the half that says nothing was sent. Through the strip and not
    // through `goto`, which would reset the mock and make this pass however the product behaved.
    await reopen(page);
    await expect(page.getByTestId("team-name-input")).toHaveValue(SEEDED_NAME);
  });

  test("5: it offers no way to create a team and no way to delete one", async ({ page }) => {
    // **THE FENCE, AND IT IS THE MOST IMPORTANT TEST IN THIS FILE.** The operator chose the
    // single-team shape knowing what a second team would cost. `public.team` has no insert policy
    // and no delete policy, so a control here would be one the datastore refuses — which teaches an
    // admin the product can do something it cannot, and is how the multi-team holes get opened by
    // somebody who assumed the screen implied support.
    await signIn(page, ADMIN_EMAIL);
    await page.goto(THRESHOLD);
    await expect(page.getByTestId("team-settings")).toBeVisible();

    const screen = page.getByTestId("team-settings");
    const buttons = await screen.locator("button").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-testid")),
    );
    // Exactly the saves, named. Anything else — Add team, Delete team, Leave team — fails here by name
    // rather than by count.
    //
    // SOLO, 2026-09-11, later the same day — `approval-save` JOINS THE LIST, and that is this fence
    // working as written rather than being loosened. It is the third SAVE, for the approval switches
    // the operator asked for, and it writes two columns of the same one row. The fence exists to stop
    // a control that creates or deletes a team; a name is added here only for a control that does
    // neither.
    expect(buttons.sort()).toEqual(["approval-save", "team-name-save", "threshold-save"]);

    // ONE TEAM ON THE SCREEN. `team_select_own` returns the caller's own row and nothing else, so a
    // list would be a list of one; there is no roster of teams to render and none is rendered.
    await expect(page.getByTestId("team-name-input")).toHaveCount(1);
  });

  test("6: a member is refused, and reads nothing about the team", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto(THRESHOLD);

    // ADM-01 AC-4 and AC-6, unchanged by this work and re-asserted because the screen grew: the
    // refusal must still name no team and show no field. A member learning the team's NAME from a
    // screen that refuses them would be a disclosure this change introduced.
    await expect(page.getByTestId("threshold-refused")).toBeVisible();
    await expect(page.getByTestId("team-settings")).toHaveCount(0);
    await expect(page.getByTestId("team-name-input")).toHaveCount(0);
    await expect(page.getByTestId("team-member-count")).toHaveCount(0);
    expect(await page.getByTestId("threshold-refused").innerText()).not.toContain(SEEDED_NAME);

    // And the tab that leads here is not offered to them at all.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
  });

  test("7: the threshold still works, on the same screen and under its own ids", async ({
    page,
  }) => {
    // ADM-01's own suite asserts this in full and passes unedited. Asserted once more here because
    // the two forms now share a screen, and the failure this guards is a shared piece of state
    // between them — a rename that cleared the threshold's saved banner, or a threshold save that
    // greyed out the name's button.
    await signIn(page, ADMIN_EMAIL);
    await page.goto(THRESHOLD);

    await page.getByTestId("team-name-input").fill("Nhóm Thử");
    await page.getByTestId("team-name-save").click();
    await expect(page.getByTestId("team-name-saved")).toBeVisible();

    // The threshold's own controls are untouched by the rename that just happened.
    await expect(page.getByTestId("threshold-save")).toBeEnabled();
    await expect(page.getByTestId("threshold-saved")).toHaveCount(0);

    await page.getByTestId("threshold-input").fill("60");
    await page.getByTestId("threshold-save").click();
    await expect(page.getByTestId("threshold-saved")).toBeVisible();
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.6");

    // And the name the rename stored is still on screen after the threshold write — the two saves
    // do not overwrite each other, which is why they are two seam functions and not one.
    await expect(page.getByTestId("team-name-input")).toHaveValue("Nhóm Thử");
    await expect(page.getByTestId("team-member-count")).toHaveAttribute(
      "data-member-count",
      ACTIVE_MEMBERS,
    );
  });
});
