import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-09 — the sidebar's roster is grouped by role and each group collapses.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n`: an `AC-` prefix is a claim that a plan document states
// the criterion, and no plan document states these. What authorises the work is
// `.claude/agents/solo.md`; the `ADR-033-solo-engineer.md` that both solo files cite is NOT on disk
// — decisions stop at ADR-032, and `Sidebar.tsx`'s SOLO header records the gap. What this file
// asserts is what the operator asked for, read off the transcription they attached, plus the two
// properties the existing suite could not defend once a roster row acquired a parent.
//
// **WHY THE GROUPING KEY IS `role` AND NOT SUB-TEAM.** The transcription grouped by sub-team —
// `CORE ENGINEERING`, `FRONTEND TEAM`, `QA / TESTING` — and no such field exists anywhere: `Member`
// carries `teamId` and nothing else that partitions a roster, INV-07 makes it one team per member,
// and `member_select_team` scopes `listMembers()` to the caller's own team, so `teamId` yields
// exactly one group forever. The operator was asked and chose `role`. `Sidebar.tsx`'s SOLO header
// note carries the same reasoning at the source.
//
// **THE PROPERTY THAT MATTERS MOST HERE IS ONE UIE-10 AC-10 ALREADY HOLDS, AND IT IS NOT RESTATED.**
// That criterion asserts the pane renders exactly one `<button>` — `home-sign-out` — and it is the
// reason the toggle here is a native `<summary>` rather than a button. It passes UNEDITED;
// re-asserting it here would put one fact in two places and make the shipped copy look optional.
// What IS asserted below is the half of it no existing test can see: that a `<summary>` is what the
// disclosure actually is (test 4).
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise). Fixtures (`src/lib/fixtures.ts`): FIXTURE_TEAM carries four ACTIVE members, TWO
// admins and TWO members — which is what makes a two-group assertion a test rather than a
// tautology, because a roster that fell into one group fails on the count.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** § Language's own pattern, from `ui-language.json` and copied from `uie-10-sidebar.spec.ts`. The
 *  group headers are copy this component authors, so they fall under the same rule the rest of the
 *  pane's copy does. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

/** The two groups, in the order the pane must render them. Admins first: an admin is who you look
 *  for when you need something decided. */
// SOLO 2026-09-13: `manager` sits between the two. FIXTURE_TEAM has no manager and an empty group is
// not rendered, so on the fixtures the page still shows the admin and member groups only.
const GROUPS = [
  { role: "admin", label: "Admins" },
  { role: "member", label: "Members" },
];

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Signed in, then standing on `path`. The sign-in always happens at `/` for the reason
 *  `uie-10-sidebar.spec.ts:102-112` records in full: six routes inside the shell render their own
 *  refusal to a caller with no session rather than redirecting, so a signed-out `goto("/week")`
 *  never shows `sign-in-submit` at all. */
async function signInAt(
  page: Page,
  path: string,
  email: string,
): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
  await page.goto(path);
  await expect(page.getByTestId("shell-sidebar")).toBeVisible();
}

test.describe("SOLO — the roster groups by role and collapses", () => {
  test("1: two groups, admins first, each labelled and counted", async ({
    page,
  }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    const groups = page.getByTestId("shell-roster-group");
    await expect(groups).toHaveCount(2);

    // ORDER IS ASSERTED BY INDEX, not by presence. Both groups being on the page says nothing about
    // which one a reader meets first, and "admins at the top" is the whole of why the order was
    // chosen rather than left to the roster's arrival order.
    for (const [i, group] of GROUPS.entries()) {
      const node = groups.nth(i);
      await expect(node).toHaveAttribute("data-role", group.role);
      await expect(node.getByTestId("shell-roster-group-label")).toHaveText(
        group.label,
      );
    }
  });

  test("2: a group's count pill equals the rows inside it, and the groups partition the team", async ({
    page,
  }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    const groups = page.getByTestId("shell-roster-group");
    await expect(groups.first()).toBeVisible();

    let summed = 0;
    for (let i = 0; i < (await groups.count()); i += 1) {
      const group = groups.nth(i);
      const rows = group.getByTestId("shell-roster-row");
      const n = await rows.count();
      expect(n, "a rendered group must hold at least one row").toBeGreaterThan(
        0,
      );

      // The pill states the number of rows under it. A pill computed from anything other than the
      // rows it sits above is the defect this asserts against, and it is invisible by inspection.
      await expect(group.getByTestId("shell-roster-group-count")).toHaveText(
        String(n),
      );
      await expect(group).toHaveAttribute("data-count", String(n));

      // And every row in an `admin` group really is an admin. Grouping is a display decision over
      // `role`, and this is the line that says the display agrees with the fact.
      const expected = await group.getAttribute("data-role");
      for (let r = 0; r < n; r += 1) {
        await expect(
          rows.nth(r).getByTestId("shell-roster-role"),
        ).toHaveAttribute("data-role", expected ?? "");
      }
      summed += n;
    }

    // **`shell-roster-count` IS INV-04's DENOMINATOR EVERYWHERE ELSE IN THE PRODUCT**, so the groups
    // partitioning the roster — losing nobody and counting nobody twice — is the property that
    // matters most here. FIXTURE_TEAM's two admins and two members make the split real: a roster
    // that fell into a single group would pass every assertion above and fail this one.
    const count = page.getByTestId("shell-roster-count");
    await expect(count).toHaveAttribute("data-count", String(summed));
    await expect(
      page.getByTestId("shell-roster-row"),
      "no row may sit outside a group",
    ).toHaveCount(summed);
    expect(summed).toBeGreaterThan(1);
  });

  test("3: a group opens by default and closes on click, and the team count survives it", async ({
    page,
  }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    const group = page.getByTestId("shell-roster-group").first();
    const rows = group.getByTestId("shell-roster-row");

    // OPEN ON FIRST PAINT. The transcription shows every chevron up, and a roster that greets a new
    // session closed hides the one thing this pane exists to show.
    await expect(group).toHaveAttribute("open", "");
    await expect(rows.first()).toBeVisible();

    await group.getByTestId("shell-roster-group-summary").click();

    // CLOSED MEANS THE ROWS ARE NOT VISIBLE — asserted on visibility rather than on the attribute
    // alone, because `<details>` losing `open` while its content stays painted is exactly the CSS
    // failure a `list-none` reset can cause, and an attribute check would miss it.
    await expect(group).not.toHaveAttribute("open", "");
    await expect(rows.first()).toBeHidden();

    // **THE HEADER AND THE TEAM COUNT ARE STILL THERE.** `shell-roster-count` sits OUTSIDE the
    // groups on purpose; a closed drawer taking INV-04's denominator off the screen with it is the
    // regression this line exists for.
    await expect(group.getByTestId("shell-roster-group-label")).toBeVisible();
    await expect(group.getByTestId("shell-roster-group-count")).toBeVisible();
    await expect(page.getByTestId("shell-roster-count")).toBeVisible();

    // And it reopens. A one-way toggle passes every assertion above.
    await group.getByTestId("shell-roster-group-summary").click();
    await expect(group).toHaveAttribute("open", "");
    await expect(rows.first()).toBeVisible();
  });

  test("4: the disclosure is a native summary, keyboard-operable, and writes nothing", async ({
    page,
  }) => {
    await signInAt(page, "/week", MEMBER_EMAIL);

    const group = page.getByTestId("shell-roster-group").first();
    const summary = group.getByTestId("shell-roster-group-summary");

    // **THE ELEMENT ITSELF, AND THIS IS THE ASSERTION THE REST OF THE SUITE CANNOT MAKE.** UIE-10
    // AC-10 asserts the pane holds exactly one `<button>` and that it is `home-sign-out`; that stays
    // true only for as long as the toggle is not a button, and nothing anywhere states WHAT the
    // toggle is. This does. A refactor reaching for `<button onClick>` fails here first, with a
    // message that says why, instead of failing AC-10 with a count.
    await expect(summary).toHaveJSProperty("tagName", "SUMMARY");
    await expect(group).toHaveJSProperty("tagName", "DETAILS");

    // Keyboard, through the element's own behaviour rather than through a handler. `Enter` on a
    // focused `<summary>` toggles it natively — the reason no key handler was written.
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(group).not.toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(group).toHaveAttribute("open", "");

    // A disclosure writes nothing. The seam is not touched by opening a drawer, and the clearest
    // available proof is that the roster is identical on both sides of a toggle.
    const before = await group.getByTestId("shell-roster-row").count();
    await summary.click();
    await summary.click();
    await expect(group.getByTestId("shell-roster-row")).toHaveCount(before);
  });

  test("5: the group headers are interface copy and carry no diacritic", async ({
    page,
  }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    // § Language, and the same distinction UIE-10 AC-11 draws: a group LABEL is copy this component
    // authors, while a roster's display names are seeded data belonging to the people on the team.
    // Only the copy is read here.
    for (const text of await page
      .getByTestId("shell-roster-group-label")
      .allInnerTexts()) {
      expect(text).not.toMatch(DIACRITIC);
    }
    for (const text of await page
      .getByTestId("shell-roster-group-count")
      .allInnerTexts()) {
      expect(text).toMatch(/^\d+$/);
    }
  });

  test("6: the grouping is the same for both roles", async ({ page }) => {
    // A member and an admin see the SAME roster in the SAME two groups. Grouping by `role` displays
    // a role and grants nobody anything — the property `Sidebar.tsx` states in words — and a pane
    // whose shape depended on the caller is what UIE-10 AC-1 removed from this file.
    const shapes: string[] = [];
    for (const email of [ADMIN_EMAIL, MEMBER_EMAIL]) {
      // **SIGN OUT FIRST, AND THIS IS WHY `signInAt` CANNOT DO IT.** That helper goes to `/`, which
      // resolves by MEMBERSHIP — for a caller still holding the previous session it is `/week` and
      // not the sign-in screen, so the second iteration would wait forever for `sign-in-submit`.
      // The mock keeps the session in `localStorage` (`src/lib/data/mock.ts:167`) and it survives a
      // `goto`. `uie-10-sidebar.spec.ts` AC-10 ends each of its own iterations the same way.
      if (shapes.length > 0) {
        await page.getByTestId("home-sign-out").click();
        await expect(page.getByTestId("sign-in-submit")).toBeVisible();
      }
      await signInAt(page, "/week", email);

      const groups = page.getByTestId("shell-roster-group");
      await expect(groups).toHaveCount(2);
      shapes.push(
        (
          await groups.evaluateAll((nodes) =>
            nodes.map(
              (n) =>
                `${n.getAttribute("data-role")}:${n.getAttribute("data-count")}`,
            ),
          )
        ).join("|"),
      );
    }
    expect(shapes[0]).toBe(shapes[1]);
  });

  test("SOLO 2026-09-13: the roster header names the team instead of the word Team", async ({ page }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    const count = page.getByTestId("shell-roster-count");
    const members = await count.getAttribute("data-count");
    // FIXTURE_TEAM is named `CaleChip` (src/lib/fixtures.ts).
    await expect(count).toHaveText(`CaleChip (${members})`);
  });
});
