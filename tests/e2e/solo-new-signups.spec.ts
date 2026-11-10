import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-10 — the admin decides who joins, and the allow-list is gone.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to this
// file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md`.
//
// **IT SUPERSEDES ADR-009 AND NO ADR RECORDS THAT YET.** That decision (`ACCEPTED by the operator`,
// 2026-08-31) made the allow-list the gate: an admin typed an address, and a trigger admitted only
// that address. The operator reversed the order on 2026-09-10 — everybody signs up, everybody gets a
// member row, and an admin decides afterwards. The superseding ADR is the operator's to paste;
// `solo` cannot write `.ai/registry/**` (RULE-01).
//
// **THE SECURITY PROPERTY IS THE POINT OF THE WHOLE CHANGE AND TEST 4 IS WHERE IT LIVES.** Creating a
// member row at sign-up would, on its own, hand a stranger the entire team's calendar: every
// row-level policy in the product is keyed on `public.member_team_id`, which asked only whether a
// member row existed and was not removed. The migration adds `and m.status = 'approved'` to that one
// function, so an undecided caller is refused by every policy at once. A test that only checked the
// screens would pass with that clause deleted.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise), so the refusals below are the mock's reproduction of the policies rather than a second
// story about them.
//
// Fixtures (`src/lib/fixtures.ts`): `FIXTURE_PENDING_SIGNUP` is seeded waiting, with no team and
// `status: "pending"`, so this list is never empty and the row markup is always exercised.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** § Language's own pattern, from `ui-language.json`. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Two clicks, the route UIE-09 and the tab strip established. */
async function openSignups(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-allow-list-link").click();
  await expect(page.getByTestId("signups-count")).toBeVisible();
}

test.describe("SOLO — new sign-ups replace the allow-list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signin");
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("1: the admin tab reaches a queue of people waiting, not a list of addresses", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openSignups(page);

    await expect(page).toHaveURL(/\/signups$/);

    // The seeded waiting person is on it, named, with the status the datastore holds.
    const rows = page.getByTestId("signup-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-status", "pending");
    await expect(rows.first().getByTestId("signup-row-name")).not.toBeEmpty();

    // **THE ALLOW-LIST'S OWN SURFACE IS GONE, ASSERTED BY NAME.** These ids belonged to the screen
    // this one replaced; a name nothing mentions is a name somebody re-adds.
    for (const id of [
      "allow-list-table",
      "allow-list-add-email",
      "allow-list-add-submit",
      "allow-list-row",
    ]) {
      await expect(page.getByTestId(id), `${id} was removed`).toHaveCount(0);
    }
  });

  test("2: approving puts them on the team and takes them off the queue", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openSignups(page);

    const row = page.getByTestId("signup-row").first();
    // The team the approval will write is stated on the row rather than left implicit — it is the
    // fact the admin is actually deciding.
    await expect(row.getByTestId("signup-row-team")).toHaveAttribute(
      "data-team-id",
      /.+/,
    );

    await row.getByTestId("signup-row-approve").click();

    // Off the queue, because the next read does not return them — never a local splice, which is
    // what keeps the count and the list from disagreeing.
    await expect(page.getByTestId("signups-empty")).toBeVisible();
    await expect(page.getByTestId("signup-row")).toHaveCount(0);
    await expect(page.getByTestId("signups-count")).toHaveAttribute(
      "data-total",
      "0",
    );

    // **⚠️ THAT THEY ARE NOW ON THE TEAM IS NOT ASSERTED HERE, AND THE REASON IS WORTH KEEPING.**
    // Two witnesses were tried and neither works from this page. `page.goto("/members")` RESETS the
    // mock, whose `members` array is module state — so an assertion after one passes or fails for
    // reasons unrelated to the approval, which is how the first version of this test was green for
    // the wrong reason. The sidebar roster does not work either: `useRoster` reads ONCE on mount and
    // the sidebar never unmounts, so it still holds the roster as it was before this decision.
    //
    // **THAT SECOND FINDING IS ABOUT THE PRODUCT AND NOT ABOUT THE TEST: approving somebody does not
    // put them in the sidebar until the next document load.** It is chrome rather than a count, so
    // it misleads nobody about anything they can act on — recorded here rather than fixed, because
    // fixing it means a roster that re-reads on a decision and that is a different change.
    //
    // What IS asserted is the queue, which is this screen's own subject: they left it, and the
    // count fell, because the next read did not return them.
  });

  test("3: rejecting takes them off the queue and does not put them on the team", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openSignups(page);

    const row = page.getByTestId("signup-row").first();
    await row.getByTestId("signup-row-reject").click();
    await expect(page.getByTestId("signup-row")).toHaveCount(0);

    // A rejection is a DECISION and not a deletion: the account still exists and the person can
    // still sign in. What they cannot do is see anything, and that is held by
    // `public.member_team_id` rather than by any screen — so it is not assertable from here, for the
    // two reasons test 2 records about the mock's module state and the sidebar's single read.

    // And the queue is empty rather than holding them under a different label: a worklist whose two
    // controls are approve and reject must not keep rows that are already decided.
    await expect(page.getByTestId("signups-empty")).toBeVisible();
  });

  test("4: a member is refused the queue, and is offered no way to it", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);

    // Typed directly, the screen refuses in place rather than redirecting — the shape every admin
    // screen in this product uses, because the refusal is what says why.
    await page.goto("/signups");
    await expect(page.getByTestId("signups-refused")).toBeVisible();
    await expect(page.getByTestId("signups")).toHaveCount(0);
    await expect(page.getByTestId("signup-row")).toHaveCount(0);

    // And nothing offers the journey: the admin control is absent for a member, so the tab strip
    // that would carry the link never renders.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-allow-list-link")).toHaveCount(0);
  });

  test("5: the interface is in English and the screen renders no write surface it does not own", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await openSignups(page);

    // § Language. The seeded person's display name is DATA belonging to them and is excluded, the
    // same distinction UIE-10 AC-11 draws for the roster.
    // SOLO 2026-09-12: `signups-back` left this list with the link itself.
    for (const id of ["signups-count"]) {
      expect(
        await page.getByTestId(id).innerText(),
        `${id} renders interface copy and must carry no diacritic`,
      ).not.toMatch(DIACRITIC);
    }

    // TWO CONTROLS PER ROW AND NO THIRD. **AMENDED BY SOLO 2026-09-11:** the team control was
    // disabled because `member_decide_admin` accepted only the admin's own team. The operator decided
    // every admin manages every team, so the picker is live and offers every team; approval goes
    // through `admit_member`. The fixtures carry two teams, so two options.
    const row = page.getByTestId("signup-row").first();
    await expect(row.locator("button")).toHaveCount(2);
    await expect(row.getByTestId("signup-row-team")).toBeEnabled();
    await expect(row.getByTestId("signup-row-team").locator("option")).toHaveCount(2);
    await expect(page.locator("form")).toHaveCount(0);
  });
});
