import { expect, test, type Page } from "@playwright/test";

// UIE-10 — the sidebar gives up its admin links and restyles its roster.
//
// Written from 01-plan.md § 2 and § 4. Every locator is a `data-testid`: the one id this ticket
// introduces (`shell-roster-role`), the four it removes, the three it keeps, `shell-admin-link` and
// the `admin-hub-*-link` rows UIE-09 shipped, plus `sign-in-*` and each destination's own refusal —
// the last group is READ and never written, which is what AC-6 is.
//
// **THIS FILE IS THE ONLY PLACE THE SUITE STATES THE MIGRATION AS A PROPERTY RATHER THAN AS AN
// EDIT.** Nine other spec files were amended so that they keep passing; those amendments say what
// each of those tickets still means. What is here is what UIE-10 itself bought, and AC-5 in
// particular is a claim about the WHOLE suite that no other file is positioned to make.
//
// **WHY AC-4 AND AC-5 EXIST AT ALL, because it is the hazard this ticket was triaged around.** Six
// assertions across four files stated that a member is offered no admin surface, each by naming one
// of the four `home-*` admin ids and asserting `toHaveCount(0)`. After AC-1 those four ids render
// for NOBODY, so all six pass VACUOUSLY — an assertion that a named node is absent is satisfied by
// the name never having existed. Six green assertions would then be showing a reader nothing. Each
// was rewritten onto `shell-admin-link`, which renders for an admin and not for a member and can
// therefore still fail; AC-5 is the standing check that no seventh one was introduced here.
//
// `page.goto` IS USED FREELY, which is unusual for this suite and is safe for the reason
// `uie-09-admin-hub.spec.ts` gives: this ticket writes nothing, so a document load has no entry to
// lose, and the mock stores the session in `localStorage` (`src/lib/data/mock.ts:167`).
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so every refusal below is the mock's reproduction of the roles the real policies hold.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql) — FIXTURE_TEAM carries four ACTIVE
// members, two admins and two members, which is what AC-7 needs:
// - Admin:  quan@example.com  (FIXTURE_ADMIN, role admin, `Quản trị`)
// - Member: thanh@example.com (FIXTURE_MEMBER, role member, `Thành viên`)

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** § Language's own pattern, from `ui-language.json`. AC-11 is the assertion the lint rule cannot
 *  make: eslint reads the SOURCE, and this reads what the browser actually painted. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

/** The four ids AC-1 removes. They are named here, retired, for the same reason
 *  `uie-09-admin-hub.spec.ts` keeps its own copy: a name nothing mentions is a name somebody re-adds. */
const REMOVED_ADMIN_LINKS = [
  "home-pending-entries-link",
  "home-team-entries-link",
  "home-allow-list-link",
  "home-threshold-link",
];

/** The two AC-2 keeps for EVERY role. § 1 refuses to empty the nav block on a verified fact: the
 *  top bar renders no period cluster at all on the eight non-period routes, so on three of those
 *  these are the only route back to a calendar. */
const KEPT_LINKS = ["home-week-link", "home-year-link"];

/** **SOLO 2026-09-12 — THE THIRD LINK, NOW A MEMBER'S AND NOT AN ADMIN'S.** As shipped, AC-2 kept
 *  three links for both roles, on the ground that `/holidays` was linked from exactly one place in
 *  the product while being guarded on a session rather than a role. The operator moved Public
 *  holidays into the admin panel; an admin's route is the tab, a member's is this link, and the
 *  criterion is asserted in both directions below rather than narrowed to the half that still
 *  passes — an admin still carrying it would be a second route AND a second node for the id. */
const MEMBER_ONLY_LINK = "home-holidays-link";

/** The four addresses the sidebar gave up, each with its hub row and its own screen's refusal. The
 *  hub's fifth row, `/members`, is UIE-09's and is not one of the four this ticket migrated. */
const MIGRATED: readonly {
  hubLink: string;
  path: string;
  landmark: string;
  refusal: string;
}[] = [
  {
    hubLink: "admin-hub-pending-link",
    path: "/entries/pending",
    landmark: "pending-entries-count",
    refusal: "pending-entries-refused",
  },
  {
    hubLink: "admin-hub-team-entries-link",
    path: "/entries/team",
    landmark: "team-entries",
    refusal: "team-entries-refused",
  },
  {
    hubLink: "admin-hub-allow-list-link",
    path: "/signups",
    // SOLO, 2026-09-10. The screen's landmark is its COUNT and not its list: the list is absent
    // when nobody is waiting, and `signups-count` renders in the ready phase either way.
    landmark: "signups-count",
    refusal: "signups-refused",
  },
  {
    hubLink: "admin-hub-threshold-link",
    path: "/setting", // SOLO, 2026-09-11 — re-addressed from `/threshold` by the operator
    landmark: "threshold-current",
    refusal: "threshold-refused",
  },
];

/** Every route inside the shell that AC-1, AC-2 and AC-4 are quantified over — one period route,
 *  one route with no period at all, and the hub itself, which is where a relocated id would show up. */
const SHELL_ROUTES = ["/week", "/holidays", "/admin"];

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/**
 * Signed in, and then standing on `path`.
 *
 * **THE SIGN-IN ALWAYS HAPPENS AT `/`, AND NOT AT `path`, WHICH IS A FACT ABOUT THIS PRODUCT RATHER
 * THAN A CONVENIENCE.** Six routes inside the shell — `/week`, `/month`, `/year`, `/allow-list`,
 * `/members` and `/holidays` — render their OWN refusal to a caller with no session instead of
 * redirecting, so a signed-out `goto("/week")` shows `week-sign-in` and no `sign-in-submit` at all
 * (`Sidebar.tsx`'s sign-out comment records the six, and `cal-08` reaches them through
 * `<prefix>-sign-in`). `/` resolves by membership and IS the sign-in screen for a signed-out caller,
 * which is the same door `uie-09-admin-hub.spec.ts` uses through `/admin`.
 */
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

/**
 * SOLO 2026-09-11. Stand on the calendar, pressing the way back only when off a period screen.
 * *Until 2026-10-19: "pressing the top-bar control only if it is currently showing its `Calendar`
 * face — which it is on the six admin addresses and nowhere else."*
 *
 * **IT PRESSES A CONTROL RATHER THAN CALLING `page.goto("/")`**, which would be one line shorter and
 * would reload the document: the mock seam keeps its state in module scope, so a reload inside a
 * test discards whatever earlier steps created. Five shipped spec files already avoid `goto` in
 * mid-test helpers for exactly this reason.
 */
async function returnToCalendar(page: Page): Promise<void> {
  // AMENDED 2026-10-19. The control no longer has a `Calendar` face; the period group is drawn on
  // every shell screen, so off a period screen its Week segment (`shell-week`) is the way back.
  const back = page.getByTestId("shell-week");
  if ((await back.count()) > 0) {
    await back.click();
    await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}$/);
  }
  await expect(page.getByTestId("shell-admin-link")).toHaveAttribute("data-state", "admin");
}

test.describe("UIE-10 — the sidebar after the migration", () => {
  test("AC-1: the four admin links are gone from the sidebar, for both roles", async ({
    page,
  }) => {
    for (const email of [ADMIN_EMAIL, MEMBER_EMAIL]) {
      await signInAt(page, "/week", email);

      for (const path of SHELL_ROUTES) {
        await page.goto(path);
        await expect(page.getByTestId("shell-sidebar")).toBeVisible();
        for (const id of REMOVED_ADMIN_LINKS) {
          await expect(
            page.getByTestId(id),
            `${id} must render for nobody on ${path}, and did for ${email}`,
          ).toHaveCount(0);
        }
      }

      // Sign out WITHOUT a document load, so the next role runs against the same page lifetime.
      await page.goto("/week");
      await page.getByTestId("home-sign-out").click();
      await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    }
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-2: the general links stay, and the holidays link is a member's alone", async ({
    page,
  }) => {
    for (const email of [ADMIN_EMAIL, MEMBER_EMAIL]) {
      await signInAt(page, "/week", email);

      for (const path of SHELL_ROUTES) {
        await page.goto(path);
        for (const id of KEPT_LINKS) {
          await expect(
            page.getByTestId(id),
            `${id} must resolve to exactly one node on ${path} for ${email}`,
          ).toHaveCount(1);
        }

        await expect(
          page.getByTestId(MEMBER_ONLY_LINK),
          `${MEMBER_ONLY_LINK} is a member's route and an admin's is the tab — on ${path} for ${email}`,
        ).toHaveCount(email === MEMBER_EMAIL ? 1 : 0);
      }

      await page.goto("/week");
      await page.getByTestId("home-sign-out").click();
      await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    }
  });

  test("AC-3: every address the sidebar gave up is still reachable in two steps", async ({
    page,
  }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    // Not one character typed after the sign-in: the top-bar control, then the hub row. That is the
    // whole of what this ticket cost an admin, and it is asserted rather than assumed.
    //
    // **THE TWO STEPS ARE COUNTED FROM THE CALENDAR, AND SOLO 2026-09-11 IS WHY THAT SENTENCE HAD TO
    // BE WRITTEN DOWN.** The loop used to press the control from wherever the previous iteration
    // left it — which, after the first destination, was an admin screen. The control now has two
    // faces and on an admin screen it is the way back to the calendar, so the loop returns there
    // FIRST and then counts. The claim UIE-10 AC-3 makes is unchanged: an address the sidebar gave
    // up is two steps from the screen an admin lands on, and the return itself is not one of them.
    for (const destination of MIGRATED) {
      await returnToCalendar(page);

      await page.getByTestId("shell-admin-link").click();
      await expect(page.getByTestId("admin-hub")).toBeVisible();

      await page.getByTestId(destination.hubLink).click();
      await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
      // The screen at the far end renders exactly as it does today — asserted by an id belonging to
      // that screen's own ticket, which this one never touches.
      await expect(page.getByTestId(destination.landmark)).toBeVisible();
    }
  });

  test("AC-4: the member denial is asserted against a node that exists", async ({
    page,
  }) => {
    await signInAt(page, "/week", MEMBER_EMAIL);

    for (const path of SHELL_ROUTES) {
      await page.goto(path);
      // The shell IS rendered for this caller — they are on the team — so this is a claim about the
      // control being absent and not about the page having failed to load.
      await expect(page.getByTestId("shell-topbar")).toBeVisible();
      await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
    }

    // And the same node renders for an admin on every one of those routes, which is the property
    // that makes the assertions above capable of failing. Without this half, `shell-admin-link`
    // would be exactly the vacuous subject the four removed ids became.
    await page.goto("/week");
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await signIn(page, ADMIN_EMAIL);
    for (const path of SHELL_ROUTES) {
      await page.goto(path);
      await expect(page.getByTestId("shell-admin-link")).toHaveCount(1);
    }
  });

  test("AC-5: no assertion in the suite passes because its subject stopped existing", async ({
    page,
  }) => {
    // **THE ONE CRITERION HERE THAT READS THE SUITE RATHER THAN THE PRODUCT**, and it is a criterion
    // because six assertions would otherwise have gone on passing while stating nothing. A negative
    // assertion is only worth running if its subject renders for SOMEBODY; the four ids below render
    // for nobody, so no `toHaveCount(0)` anywhere may still name one.
    //
    // Read off the shipped files rather than listed by hand, so an eighth site added later by a
    // ticket that never read this comment is caught too.
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    // **`fileURLToPath` AND NOT `.pathname`, WHICH NEVER RAN ON WINDOWS.** A file URL's pathname is
    // `/D:/TMA/vibe%20code/...` — a leading slash the drive letter does not want, and `%20` for
    // every space — so `readdirSync` was handed `D:\D:\TMA\vibe%20code\...` and threw ENOENT before
    // reading a single file. Fixed by `solo` on 2026-09-09, OUTSIDE ITS SCOPE and named as such:
    // this criterion reads the SUITE rather than the product, and a criterion that throws before
    // reading anything is the one kind of test that cannot fail usefully. Nothing about what it
    // asserts is changed, and it now genuinely passes rather than being red for a reason unrelated
    // to what it checks.
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const offenders: string[] = [];

    for (const file of readdirSync(dir).filter((f) => f.endsWith(".spec.ts"))) {
      const lines = readFileSync(join(dir, file), "utf8").split("\n");
      lines.forEach((line, index) => {
        // Executable lines only: a comment naming a retired id is how a file records what it used
        // to assert, and `uie-09-admin-hub.spec.ts` and this file both do exactly that on purpose.
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
        if (!/toHaveCount\(0\)|toBeHidden\(\)|not\.toBeVisible\(\)/.test(line))
          return;
        for (const id of REMOVED_ADMIN_LINKS) {
          if (line.includes(id)) offenders.push(`${file}:${index + 1} — ${id}`);
        }
      });
    }

    expect(
      offenders,
      "these assert the absence of an id that renders for nobody, so they cannot fail",
    ).toEqual([]);

    // And the product half of the same claim, so this test is not purely a text scan: the four are
    // absent for an admin too, which is what makes every one of those assertions vacuous.
    await signInAt(page, "/week", ADMIN_EMAIL);
    for (const id of REMOVED_ADMIN_LINKS) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
  });

  test("AC-6: a member who types an address is still refused by the screen", async ({
    page,
  }) => {
    await signInAt(page, "/week", MEMBER_EMAIL);

    // Removing a link refuses nobody, and this is the criterion that says so. The four screens keep
    // their own refusals exactly as they had them — none of them is touched by this ticket.
    for (const destination of MIGRATED) {
      await page.goto(destination.path);
      await expect(page.getByTestId(destination.refusal)).toBeVisible();
      await expect(page.getByTestId(destination.landmark)).toHaveCount(0);
    }
  });

  test("AC-7: each roster row shows the member's role", async ({ page }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    const rows = page.getByTestId("shell-roster-row");
    const roles = page.getByTestId("shell-roster-role");
    await expect(rows.first()).toBeVisible();

    // ONE ROLE NODE PER ROW, counted rather than sampled — a row that lost its role word would
    // otherwise pass on the strength of its neighbours.
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    await expect(roles).toHaveCount(rowCount);
    for (let i = 0; i < rowCount; i += 1) {
      await expect(rows.nth(i).getByTestId("shell-roster-role")).toHaveCount(1);
    }

    // The word matches the fact. `data-role` carries the raw value beside the rendered word so an
    // assertion can read one against the other without depending on the copy.
    for (let i = 0; i < rowCount; i += 1) {
      const role = roles.nth(i);
      const raw = await role.getAttribute("data-role");
      expect(raw, "every roster role must carry its raw value").toMatch(
        /^(admin|member)$/,
      );
      await expect(role).toHaveText(raw === "admin" ? "Admin" : "Member");
    }

    // BOTH WORDS ACTUALLY APPEAR, which is what makes the loop above a test rather than a tautology:
    // FIXTURE_TEAM carries two admins and two members, so a mapping stuck on one answer fails here.
    //
    // `allTextContents` AND NOT `allInnerTexts`, WHICH IS THE SAME DISTINCTION UIE-02 AC-7 DREW FOR
    // `home-member-role`: the class carries `uppercase`, so `innerText` reports what was PAINTED —
    // `ADMIN` — while the string `roleLabel` returns is `Admin`. The strings are the shared thing
    // (`MemberList.tsx` renders the same two, without the transform), the casing is one screen's
    // presentation, and this criterion is about the words.
    const rendered = await roles.allTextContents();
    expect(new Set(rendered.map((t) => t.trim()))).toEqual(
      new Set(["Admin", "Member"]),
    );
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-8: the roster's role word is a new selector and collides with nothing", async ({
    page,
  }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    // `home-member-role` is the ACCOUNT FOOTER's line and `tests/e2e/tea-05-sign-in.spec.ts` reads
    // it by text at :65, :146 and :155. It must still resolve to exactly one node: a second node
    // under that name fails UIE-02 AC-6's count and breaks those three lines under strict mode.
    await expect(page.getByTestId("home-member-role")).toHaveCount(1);
    await expect(page.getByTestId("home-member-role")).toHaveText("Admin");

    // And the new id is genuinely new. Read off the page rather than asserted one at a time, so an
    // id introduced in passing by a later edit is caught by the criterion that already exists.
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-testid]")).map(
        (node) => node.getAttribute("data-testid") ?? "",
      ),
    );
    expect(ids.filter((id) => id === "home-member-role")).toHaveLength(1);
    expect(
      ids.filter((id) => id === "shell-roster-role").length,
    ).toBeGreaterThan(0);

    // The singular ids of the shell each still resolve to exactly one node. `shell-roster-row` and
    // `shell-roster-role` are the two that do not, deliberately: they name a row and there is one
    // per member, the way `year-month-card` already does.
    for (const id of [
      "shell-sidebar",
      "shell-brand",
      "shell-roster-count",
      "home-member-name",
      "home-member-avatar",
      "home-sign-out",
      ...KEPT_LINKS,
    ]) {
      await expect(
        page.getByTestId(id),
        `${id} must resolve to exactly one node`,
      ).toHaveCount(1);
    }
  });

  test("AC-9: the signed-in member is still marked, and the roster is otherwise unchanged", async ({
    page,
  }) => {
    await signInAt(page, "/week", MEMBER_EMAIL);

    const rows = page.getByTestId("shell-roster-row");
    const count = page.getByTestId("shell-roster-count");
    await expect(count).toBeVisible();

    // `shell-roster-count` still states the number of members, and it is still the same number as
    // the rows — the count is INV-04's denominator everywhere else in the product.
    const rowCount = await rows.count();
    await expect(count).toHaveAttribute("data-count", String(rowCount));
    await expect(count).toContainText(String(rowCount));

    // `(You)` is still appended to the caller's own name, and it is on the NAME line rather than
    // beside the role word: moved down there it would read as a second role (01-plan.md § 2b).
    const mine = rows.filter({ hasText: "(You)" });
    await expect(mine).toHaveCount(1);
    await expect(mine.getByTestId("shell-roster-role")).toHaveText("Member");
    await expect(mine.getByTestId("shell-roster-role")).not.toContainText(
      "(You)",
    );
  });

  test("AC-10: the sidebar renders no control", async ({ page }) => {
    for (const email of [ADMIN_EMAIL, MEMBER_EMAIL]) {
      await signInAt(page, "/week", email);

      const sidebar = page.getByTestId("shell-sidebar");

      // Nothing in the pane approves, rejects, removes, promotes or writes anything. `home-sign-out`
      // is the ONE button and it ends a session rather than changing a row; every other element is
      // a link or text. A form or a select here would be a write surface this pane has never had.
      await expect(sidebar.locator("form")).toHaveCount(0);
      await expect(sidebar.locator("input")).toHaveCount(0);
      await expect(sidebar.locator("select")).toHaveCount(0);
      await expect(sidebar.locator("button")).toHaveCount(1);
      await expect(sidebar.locator("button")).toHaveAttribute(
        "data-testid",
        "home-sign-out",
      );

      // And the role word is TEXT rather than a control — a `<span>`, not a link, a button or
      // anything with a click handler's affordances. Displaying a role neither grants nor withholds
      // anything, which is why `invariants_touched` is empty.
      const roles = sidebar.getByTestId("shell-roster-role");
      const roleCount = await roles.count();
      for (let i = 0; i < roleCount; i += 1) {
        await expect(roles.nth(i)).toHaveJSProperty("tagName", "SPAN");
        await expect(
          roles.nth(i).locator("a, button, input, select"),
        ).toHaveCount(0);
      }

      await page.getByTestId("home-sign-out").click();
      await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    }
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-11: the interface is in English", async ({ page }) => {
    await signInAt(page, "/week", ADMIN_EMAIL);

    // **WHAT IS READ HERE IS INTERFACE COPY, AND THE TWO EXCLUSIONS ARE BOTH NAMED BY AC-11 OR BY
    // WHAT A ROSTER IS.** The product name `Ai Nghỉ?` is a NAME and not copy — AC-11 says so, and
    // `Sidebar.tsx` composes its one accented character from a code point for exactly that reason.
    // The roster's display names are seeded DATA belonging to the people on the team; a rule that
    // forbade a diacritic there would forbid Vietnamese names in a Vietnamese team's product, which
    // is the opposite of what § Language is for. Everything the component itself authors is below.
    for (const id of [
      ...KEPT_LINKS,
      "shell-roster-count",
      "home-sign-out",
      "home-member-role",
    ]) {
      expect(
        await page.getByTestId(id).innerText(),
        `${id} renders interface copy and must carry no diacritic`,
      ).not.toMatch(DIACRITIC);
    }

    for (const text of await page
      .getByTestId("shell-legend-row")
      .allInnerTexts()) {
      expect(text).not.toMatch(DIACRITIC);
    }
    for (const text of await page
      .getByTestId("shell-roster-role")
      .allInnerTexts()) {
      expect(text).not.toMatch(DIACRITIC);
    }

    // The brand block, with the product name removed — so the TAGLINE beneath it, which has no id of
    // its own, is covered by this criterion rather than by nothing.
    const brand = await page.getByTestId("shell-brand").innerText();
    // SOLO 2026-09-13: the product name is now `CaleChip`, beside a logo that links to `/`.
    const productName = "CaleChip";
    expect(brand).toContain(productName);
    expect(brand.replace(productName, "")).not.toMatch(DIACRITIC);
  });

  test("SOLO 2026-09-13: the brand is the CaleChip logo, and it links back to /", async ({ page }) => {
    await signInAt(page, "/profile", ADMIN_EMAIL);

    const logo = page.getByTestId("shell-brand-logo");
    await expect(logo).toHaveText("CaleChip");
    await expect(logo.locator("img")).toHaveAttribute("src", /\/logo\.svg$/);
    await expect(page.getByTestId("shell-brand")).not.toContainText(`Ai Ngh${String.fromCodePoint(0x1ec9)}?`);

    await logo.click();
    await expect(page).not.toHaveURL(/\/profile$/);
  });
});
