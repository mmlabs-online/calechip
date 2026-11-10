import { expect, test, type Locator, type Page } from "@playwright/test";

// UIE-09 — the admin hub at `/admin`, and the one top-bar control that reaches it.
//
// Written from 01-plan.md § 2 and § 4.5. Every locator is a `data-testid` from the selector table in
// § 4.5, plus `sign-in-*`, `home-*` and the five destinations' own screen ids — the last group is
// READ and never written, which is what AC-4 and AC-10 are.
//
// **`page.goto` IS USED FREELY HERE, WHICH IS UNUSUAL FOR THIS SUITE AND IS SAFE FOR ONE REASON.**
// Every other acceptance file navigates by clicking, because the mock seam's tables live in module
// memory and a document load resets them — so a `goto` after a write loses the entry the test just
// created. THIS TICKET WRITES NOTHING: it adds no form, no seam write and no state to lose, and the
// SESSION does survive a reload (the mock stores it in `localStorage`, `src/lib/data/mock.ts:167`).
// Typing an address is also the only way to express half of these criteria — AC-6 and AC-7 are both
// about a caller for whom no link exists.
//
// **THE `unavailable` BRANCH IS ASSERTED NEGATIVELY, WHICH IS THIS SUITE'S ESTABLISHED READING.**
// AC-8's two halves are one `catch`, and the mock seam does not fail on demand — `cal-04`, `cal-05`,
// `adm-02`, `adm-04` and `cal-10` all assert their own `*-unavailable` with `toHaveCount(0)` for
// exactly this reason, and `cal-10`'s header states it in terms. So what is asserted below is that a
// SUCCESSFUL read never renders it and that a REFUSAL never renders it either, which is the half of
// AC-8 that matters: a denial and a transport failure must not read alike. Nothing here claims to
// have exercised a throwing read.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the refusals below are the mock's reproduction of the roles the real policies hold.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:       quan@example.com  (FIXTURE_ADMIN, role admin)
// - Member:      thanh@example.com (FIXTURE_MEMBER, role member)
// - Member-less: hoa@example.com   (FIXTURE_MEMBER_LESS, signed in, no member row at all) — AC-7

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";

const ADMIN = "/admin";

/** § Language's own pattern, from `ui-language.json`. AC-12 is the assertion the lint rule cannot
 *  make: eslint reads the SOURCE, and this reads what the browser actually painted. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

/**
 * The five destinations of AC-3, in the order § 2b puts them in, each with the ids the screen at the
 * far end renders once it is READY — which is how AC-4 knows the link opened the screen it names and
 * not merely an address.
 *
 * SOME SCREENS HAVE TWO SUCH IDS BECAUSE THEY HAVE A LIST AND AN EMPTY STATE, and which of the two
 * the seed produces is that screen's own ticket's business and not this one's. Asserting either
 * keeps AC-4 about *the screen opened* rather than about how many rows the fixtures happen to hold —
 * a coupling that would make this suite fail when somebody edits `supabase/seed.sql`.
 */
const DESTINATIONS: readonly {
  testId: string;
  path: string;
  landmarks: readonly [string, ...string[]];
}[] = [
  {
    testId: "admin-hub-pending-link",
    path: "/entries/pending",
    landmarks: ["pending-entries-count"],
  },
  {
    testId: "admin-hub-team-entries-link",
    path: "/entries/team",
    landmarks: ["team-entries", "team-entries-empty"],
  },
  {
    testId: "admin-hub-members-link",
    path: "/members",
    landmarks: ["member-list-table", "member-list-empty"],
  },
  {
    testId: "admin-hub-allow-list-link",
    path: "/signups",
    landmarks: ["signups", "signups-empty"],
  },
  // SOLO, 2026-09-26 added an eighth destination here, Reports (`to: "/reports"`, landmarks
  // `["reports", "reports-empty"]`). **MIR-17, ADR-088 REMOVES IT.** Since MIR-16 an org admin reads
  // no report at all (ADR-082 decision 1), the hub's card for it is gone with the tab
  // (`AdminTabs.tsx`) — `/reports` is still a real address, but it is no longer one the hub lists, so
  // it has no `admin-hub-*-link` id and no place in this array. AC-3's title below returns to the
  // sentence it carried before the eighth joined: back to seven, and `DESTINATIONS.length` says so
  // without anybody having to notice and fix a literal.
  {
    testId: "admin-hub-threshold-link",
    path: "/setting", // SOLO, 2026-09-11 — re-addressed from `/threshold` by the operator
    landmarks: ["threshold-current"],
  },
  // SOLO, 2026-09-11 — many teams. The sixth destination, on the operator's choice of a tab of its
  // own. Every loop below now walks it too, which is what makes AC-4 and AC-9 cover the new screen.
  // SOLO 2026-09-12 — Public holidays, moved into the panel on the operator's instruction. BEFORE
  // `Teams`, which is the order `ADMIN_TABS` declares and § 2b's rule for it: the swap days are
  // announced once a year, which is rarer than everything above and commoner than creating a team.
  {
    testId: "admin-hub-holidays-link",
    path: "/holidays",
    landmarks: ["holidays-year"],
  },
  {
    testId: "admin-hub-teams-link",
    path: "/teams",
    landmarks: ["teams-list"],
  },
];

/** Either of a screen's ready-phase ids — see `DESTINATIONS`. The first id is taken as the seed and
 *  the rest folded on with `.or()`, so the caller writes one locator whichever branch rendered. */
const landmarkOf = (page: Page, landmarks: readonly [string, ...string[]]): Locator =>
  landmarks
    .slice(1)
    .reduce((locator, id) => locator.or(page.getByTestId(id)), page.getByTestId(landmarks[0]));

/**
 * The four admin-only sidebar links UIE-09 had to leave alone and **UIE-10 has now removed**.
 *
 * THE ARRAY IS KEPT AND ITS MEANING IS INVERTED, WHICH IS DELIBERATE. UIE-09's AC-9 and AC-10 each
 * looped over it asserting `toHaveCount(1)` for an admin — a promise that the migration ticket still
 * had four ids to migrate. UIE-10 AC-1 removes them for BOTH roles, so those loops now assert
 * `toHaveCount(0)` everywhere, and the four names survive here as the list of what must never come
 * back. Deleting the array instead would have deleted the only place the suite states that these
 * four names are retired, and a name nothing mentions is a name somebody re-adds.
 *
 * Both amendments are recorded in `.ai/board/tickets/UIE-09/01-plan.md` § *Amended by UIE-10*.
 */
const RETIRED_SIDEBAR_ADMIN_LINKS = [
  "home-pending-entries-link",
  "home-team-entries-link",
  "home-allow-list-link",
  "home-threshold-link",
];

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/**
 * Signed out at the hub's address, then signed in. `/admin` is guarded on membership the way
 * `/threshold` and `/entries/pending` are, so a signed-out caller never reaches the component: the
 * route sends them to `/`, which resolves to the sign-in screen. Signing in there lands the caller
 * on `/` — the current week, inside the shell — which is where the top-bar control lives.
 */
async function signInAtHub(page: Page, email: string): Promise<void> {
  await page.goto(ADMIN);
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
}

/** Signed in as an admin and on the hub, reached through the control rather than by address — which
 *  is AC-1 and AC-5's "without typing a URL" in one helper. */
async function openHubAsAdmin(page: Page): Promise<void> {
  await signInAtHub(page, ADMIN_EMAIL);
  await expect(page.getByTestId("shell-admin-link")).toBeVisible();
  await page.getByTestId("shell-admin-link").click();
  await expect(page.getByTestId("admin-hub")).toBeVisible();
}

test.describe("UIE-09 — the admin hub", () => {
  // **AMENDED BY SOLO 2026-09-11, AND THE TITLE CHANGED WITH IT.** As shipped this read *"on any
  // route inside the shell"*, and its second half proved it by standing on `/signups` — which is one
  // of the six ADMIN addresses. That control now has two faces: on an admin address it reads
  // `Calendar` and goes to `/`, which is the operator's request and which makes the old second half
  // assert the opposite of what the product does.
  //
  // **THE SUBSTANCE THE CRITERION WAS PROTECTING IS UNTOUCHED AND IS STILL ASSERTED HERE**: the
  // control is OUTSIDE the `nav !== null` condition, so it renders on a route with no period at all
  // where the whole left cluster is absent. `/entries/new` is such a route and is not administrative
  // — `TopBar.tsx`'s AC-15 comment names it in that list — so it proves the same property the old
  // line did without asserting a destination that changed. AC-11 below reads the same fact across
  // every kind of route and needed no edit.
  test("AC-1: an admin reaches the hub from the top bar, on any non-admin route inside the shell", async ({
    page,
  }) => {
    await signInAtHub(page, ADMIN_EMAIL);

    // On the week view, which is where signing in lands.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(1);
    await expect(page.getByTestId("shell-admin-link")).toHaveAttribute("data-state", "admin");
    await page.getByTestId("shell-admin-link").click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("admin-hub")).toBeVisible();

    // And on a route with no period at all, where the whole left cluster is absent. The control is
    // outside that condition, which is what "on any non-admin route inside the shell" means.
    await page.goto("/entries/new");
    await expect(page.getByTestId("shell-period-today")).toHaveCount(0);
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(1);
    await expect(page.getByTestId("shell-admin-link")).toHaveAttribute("data-state", "admin");
    await page.getByTestId("shell-admin-link").click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("admin-hub")).toBeVisible();
  });

  test("AC-2: a member is not offered the control — absent, not disabled", async ({ page }) => {
    await signInAtHub(page, MEMBER_EMAIL);

    // The shell is rendered for this caller — they are a member of the team — so the bar is there
    // and the control is not. `toHaveCount(0)` and not `toBeDisabled`: a disabled control asserts
    // that an area exists and is merely unavailable.
    await expect(page.getByTestId("shell-topbar")).toBeVisible();
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);

    await page.goto("/signups");
    await expect(page.getByTestId("shell-topbar")).toBeVisible();
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
  });

  test("AC-3: the hub lists exactly seven destinations and no eighth", async ({ page }) => {
    await openHubAsAdmin(page);

    // **AMENDED TWICE, AND THE TITLE MOVED EACH TIME.** SOLO 2026-09-11: five became six, when the
    // operator put team management in a tab of its own. SOLO 2026-09-12: six became seven, when the
    // operator moved Public holidays into the panel. What the criterion is for is unchanged and
    // still able to fail: the list is exactly `DESTINATIONS`, in order, and nothing else crept in.
    const rows = page.getByTestId("admin-hub-link");
    await expect(rows).toHaveCount(DESTINATIONS.length);

    // The five addresses, read off the rows rather than off the copy — and in § 2b's order, which is
    // by how often an admin needs each and not alphabetical.
    const addresses = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-to")),
    );
    expect(addresses).toEqual(DESTINATIONS.map((d) => d.path));

    // Each is also individually named, so AC-4 can follow one rather than a row.
    for (const destination of DESTINATIONS) {
      await expect(page.getByTestId(destination.testId)).toHaveCount(1);
      await expect(page.getByTestId(destination.testId)).toHaveAttribute("href", destination.path);
    }

    // NO SIXTH LINK. Everything anchored inside the list is one of the five — `/holidays` in
    // particular is not one of them (01-plan.md § 1, Out of scope: it is already in the sidebar for
    // both roles), and nothing else crept in.
    const hrefs = await page
      .locator('[data-testid="admin-hub-link"] a')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    expect(hrefs).toEqual(DESTINATIONS.map((d) => d.path));

    // A successful read renders neither the refusal nor the failure state. See the header.
    await expect(page.getByTestId("admin-hub-refused")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-unavailable")).toHaveCount(0);
  });

  test("AC-4: each destination opens the screen it names", async ({ page }) => {
    await openHubAsAdmin(page);

    for (const destination of DESTINATIONS) {
      await page.getByTestId(destination.testId).click();
      await expect(page).toHaveURL(new RegExp(`${destination.path}$`));

      // The screen at the far end renders exactly as it does today — asserted by an id that belongs
      // to that screen's own ticket and that this one never touches.
      await expect(landmarkOf(page, destination.landmarks)).toBeVisible();

      // **BACK TO THE HUB THROUGH THE CONTROL, WHICH IS NOW TWO PRESSES OF IT AND NOT ONE.** SOLO
      // 2026-09-11: standing on a destination the control is the way back to the CALENDAR, so the
      // return leg is `Calendar` and then `Admin`. What this criterion is for is unchanged and is
      // what the two lines still buy — the whole loop is one page lifetime and one session, with no
      // address typed, so the next destination is followed from a freshly rendered list rather than
      // from a page that was reloaded out from under the mock seam's module state.
      // AMENDED 2026-10-19: the control has one face again, so the way back to the hub is one press.
      await expect(page.getByTestId("shell-admin-link")).toHaveAttribute("data-state", "admin");
      await page.getByTestId("shell-admin-link").click();
      await expect(page.getByTestId("admin-hub")).toBeVisible();
    }
  });

  test("AC-5: the member list is reachable without typing an address", async ({ page }) => {
    // The hole this ticket closes, and it predates the request: `/members` was a route with no link
    // anywhere in `src/` (01-plan.md § 1). Two clicks, and not one character typed after the
    // sign-in that every test begins with.
    await signInAtHub(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-members-link").click();

    await expect(page).toHaveURL(/\/members$/);
    await expect(landmarkOf(page, ["member-list-table", "member-list-empty"])).toBeVisible();
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-6: a member who types the address is refused by the screen", async ({ page }) => {
    await signInAtHub(page, MEMBER_EMAIL);
    // Typed rather than followed: AC-2 is that there IS no control for this caller, so the address
    // bar is the only way in and the refusal has to come from the screen itself.
    await page.goto(ADMIN);

    await expect(page.getByTestId("admin-hub-refused")).toBeVisible();

    // NOT REDIRECTED AWAY. The refusal is what says why, and a bounce to `/` would leave somebody
    // who mistyped with nothing to read.
    await expect(page).toHaveURL(/\/admin$/);

    // None of the five, and no list at all.
    await expect(page.getByTestId("admin-hub")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-link")).toHaveCount(0);
    for (const destination of DESTINATIONS) {
      await expect(page.getByTestId(destination.testId)).toHaveCount(0);
    }

    // A denial is not a transport failure. AC-8's second half, asserted from the other side.
    await expect(page.getByTestId("admin-hub-unavailable")).toHaveCount(0);

    // And there is a way out. **IT IS THE SIDEBAR NOW AND NOT THIS SCREEN'S OWN LINK** — the
    // operator removed `admin-hub-back` from all six admin screens on 2026-09-12. The criterion
    // is about a refused caller not being stranded, which is still asserted; what changed is
    // which control carries it. `shell-admin-link` cannot be the answer here: the caller is a
    // member and it does not render for one.
    await expect(page.getByTestId("admin-hub-back")).toHaveCount(0);
    await expect(page.getByTestId("home-week-link")).toBeVisible();
  });

  test("AC-7: a caller with no member row is sent to `/`, which resolves by membership", async ({
    page,
  }) => {
    await signInAtHub(page, MEMBER_LESS_EMAIL);
    await page.goto(ADMIN);

    // Exactly what `/entries/new`, `/entries/team`, `/entries/pending` and `/threshold` already do.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("admin-hub")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-refused")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-link")).toHaveCount(0);
  });

  test("AC-8: a successful read never renders the failure state, and never reads as a refusal", async ({
    page,
  }) => {
    // The negative half of AC-8 — see the header for why it is the whole of what this suite can
    // claim. What it does prove is that the two states are DIFFERENT screens: the failure state is
    // absent when the read succeeded (below) and absent when the caller was refused (AC-6), so
    // neither answer can be mistaken for the other.
    await openHubAsAdmin(page);
    await expect(page.getByTestId("admin-hub-unavailable")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-refused")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-loading")).toHaveCount(0);
    // Read off `DESTINATIONS` rather than typed: the number moved twice (five to six on 2026-09-11,
    // six to seven on 2026-09-12) and a literal here went stale each time.
    await expect(page.getByTestId("admin-hub-link")).toHaveCount(DESTINATIONS.length);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-9: the hub's selectors are new, and collide with nothing", async ({ page }) => {
    await openHubAsAdmin(page);

    // Every id this ticket introduces begins `admin-hub-` or is `shell-admin-link`. Read off the
    // page rather than asserted one at a time, so an id added in passing is caught too.
    const introduced = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-testid]"))
        .map((node) => node.getAttribute("data-testid") ?? "")
        .filter((id) => id.startsWith("admin-hub") || id === "shell-admin-link"),
    );
    const unexpected = introduced.filter(
      (id) => !(id === "admin-hub" || id.startsWith("admin-hub-") || id === "shell-admin-link"),
    );
    expect(unexpected).toEqual([]);

    // **AC-9 AMENDED BY UIE-10, AND THE CLAUSE THAT MOVED IS NAMED RATHER THAN QUIETLY DROPPED.**
    // As shipped this read *"no `home-*` id is added, moved, renamed or removed"*. That was a
    // promise about UIE-09's OWN change and it stays true of UIE-09; read as a standing property of
    // the product it is false the moment UIE-10 lands, which is what UIE-10 § 4.5 records.
    //
    // What the criterion is really for survives untouched: NO `home-*` ID IS RENAMED, AND NONE IS
    // DUPLICATED ONTO THE HUB. UIE-02 AC-6 requires each surviving `home-*` id to resolve to exactly
    // one node and Playwright strict mode fails a click matching two, so a `home-*-link` rendered on
    // the hub as well as in the sidebar would have broken the migration. It never was: UIE-10
    // REMOVED the four rather than relocating them, and the hub's rows kept the `admin-hub-*-link`
    // names UIE-09 shipped.
    for (const id of RETIRED_SIDEBAR_ADMIN_LINKS) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
    await expect(page.getByTestId("home-new-entry-link")).toHaveCount(1);
    await expect(page.getByTestId("home-week-link")).toHaveCount(1);
    await expect(page.getByTestId("home-year-link")).toHaveCount(1);
    // SOLO 2026-09-12. Zero FOR AN ADMIN, and this caller is one: the operator moved Public holidays
    // into the admin panel, so an admin's route to it is the tab and a member's is still this link.
    // The clause this criterion is really about is unchanged — no `home-*` id is RENAMED, and none
    // is DUPLICATED onto the hub, which is what would break a strict-mode click.
    await expect(page.getByTestId("home-holidays-link")).toHaveCount(0);

    // The singular new ids each resolve to exactly one node on this page. `admin-hub-link` is the
    // one that does not, deliberately: it names a ROW and there are five, the way
    // `shell-roster-row` and `year-month-card` already do.
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(1);
    await expect(page.getByTestId("admin-hub")).toHaveCount(1);
    // SOLO 2026-09-12. Zero, not one: the back link is gone from all six admin screens. Kept as
    // an assertion rather than dropped from this list, for the reason the list exists — it is
    // about which ids this screen owns, and "none" is an answer.
    await expect(page.getByTestId("admin-hub-back")).toHaveCount(0);
    for (const destination of DESTINATIONS) {
      await expect(page.getByTestId(destination.testId)).toHaveCount(1);
    }
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-10: the sidebar keeps its general links, and the third is a member's alone", async ({ page }) => {
    // **AMENDED BY UIE-10, AND THE TITLE CHANGED WITH IT.** As shipped this criterion read *"the
    // sidebar is unchanged … including all four `home-*-link` admin links for the admin"*, and it
    // described the DOUBLE EXPOSURE UIE-09 deliberately left behind: the four links in the sidebar
    // and the five rows on the hub, both on screen at once. UIE-10 is the migration that ends it, so
    // the clause about the four is false by design and the clause about the three is the half that
    // was ever meant to be permanent. `.ai/board/tickets/UIE-09/01-plan.md` § *Amended by UIE-10*
    // carries the same wording; this is the assertion.
    await signInAtHub(page, ADMIN_EMAIL);

    await expect(page.getByTestId("shell-sidebar")).toBeVisible();
    for (const id of RETIRED_SIDEBAR_ADMIN_LINKS) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
    // And on the hub itself — the sidebar renders on every route inside the shell, so if any of the
    // four had been RELOCATED here rather than removed this loop is where it would show up.
    await page.getByTestId("shell-admin-link").click();
    await expect(page.getByTestId("admin-hub")).toBeVisible();
    for (const id of RETIRED_SIDEBAR_ADMIN_LINKS) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }

    // Sign out WITHOUT a document load, so the second half runs against the same page lifetime.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await signIn(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();

    // For a member the four are absent too — and that is now the SAME sentence as the line above
    // rather than the opposite one, which is exactly why UIE-10 AC-4 moved every denial in this
    // suite onto `shell-admin-link`. Asserted here anyway: the length of this pane no longer depends
    // on who is reading it, and that is the property UIE-10 AC-1 bought.
    await expect(page.getByTestId("shell-sidebar")).toBeVisible();
    for (const id of RETIRED_SIDEBAR_ADMIN_LINKS) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
    await expect(page.getByTestId("home-week-link")).toHaveCount(1);
    await expect(page.getByTestId("home-year-link")).toHaveCount(1);
    // **SOLO 2026-09-12 — ONE FOR A MEMBER, AND ZERO FOR THE ADMIN ABOVE.** The operator moved
    // Public holidays into the admin panel, so an admin's route is the tab and a member's is still
    // this link. Asserting BOTH sides here is what makes the criterion able to fail in either
    // direction: the admin keeping it would be a duplicate route and a second node for the id, and
    // the member losing it would cut them off from a calendar they are entitled to read.
    await expect(page.getByTestId("home-holidays-link")).toHaveCount(1);
  });

  test("AC-11: the period cluster is unaffected on every kind of route", async ({ page }) => {
    await signInAtHub(page, ADMIN_EMAIL);

    const withPeriod: readonly { path: string; kind: string }[] = [
      { path: "/week/2026-04-06", kind: "week" },
      { path: "/month/2026-04", kind: "month" },
      { path: "/year/2026", kind: "year" },
    ];

    for (const { path, kind } of withPeriod) {
      await page.goto(path);
      await expect(page.getByTestId(`${kind}-anchor`)).toBeVisible();
      await expect(page.getByTestId(`${kind}-prev`)).toHaveCount(1);
      await expect(page.getByTestId(`${kind}-next`)).toHaveCount(1);
      await expect(page.getByTestId("shell-period-today")).toHaveCount(1);
      await expect(page.getByTestId(`${kind}-week`)).toHaveCount(1);
      await expect(page.getByTestId(`${kind}-month`)).toHaveCount(1);
      await expect(page.getByTestId(`${kind}-year`)).toHaveCount(1);
      await expect(page.getByTestId("shell-admin-link")).toHaveCount(1);
    }

    // A route with no period: the whole cluster is absent exactly as it is today, and the new
    // control is present anyway — which is what makes it a property of the shell rather than of a
    // period screen.
    await page.goto("/signups");
    await expect(page.getByTestId("shell-period-today")).toHaveCount(0);
    await expect(page.getByTestId("week-anchor")).toHaveCount(0);
    await expect(page.getByTestId("month-anchor")).toHaveCount(0);
    await expect(page.getByTestId("year-anchor")).toHaveCount(0);
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(1);
  });

  test("AC-12: the interface is in English", async ({ page }) => {
    await openHubAsAdmin(page);

    // The control and the hub, as PAINTED — which is the half the lint rule cannot check, since
    // eslint reads the source and a diacritic could still arrive through a fixture or a seam
    // message.
    expect(await page.getByTestId("shell-admin-link").innerText()).not.toMatch(DIACRITIC);
    // The whole screen, heading and blurbs included — not one string at a time, so a sentence added
    // later is covered by the criterion that already exists.
    expect(await page.getByTestId("admin-hub").innerText()).not.toMatch(DIACRITIC);

    // The refusal too, which is the one string on this screen a member ever reads.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await signIn(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await page.goto(ADMIN);
    expect(await page.getByTestId("admin-hub-refused").innerText()).not.toMatch(DIACRITIC);
  });
});
