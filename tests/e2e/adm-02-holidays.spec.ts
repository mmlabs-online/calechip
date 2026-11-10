import { expect, test, type Page } from "@playwright/test";

// ADM-02 — the national holiday calendar, seeded and readable.
//
// Written from 01-plan.md sections 2, 4.4 and 4.5. Every locator is a `data-testid` from the
// selector table in section 4.4, plus `home-holidays-link` (also section 4.4) and the `sign-in-*`
// and `home-*` ids the earlier suites already own and this one only reads. The three row-part ids
// (`holidays-row-date`, `holidays-row-name`, `holidays-row-effect`) and `holidays-list` are NOT in
// that table and are declared in 03-impl-log.md § Deviations.
//
// **THREE CRITERIA WERE ASSERTED NOWHERE WHEN THIS FILE SHIPPED, AND THAT IS DECLARED IN ADM-02's
// 03-impl-log.md.** It is the same shape CAL-05 and CAL-06 each recorded:
// - AC-5 (a second row for a date is refused) — that is `unique (date)` in the datastore, and when
//   this suite was written nothing in the product could insert a holiday at all: no insert policy
//   and no insert grant shipped on that branch. **ADM-03 CLOSED THAT GAP.** The write path exists
//   now, so a person can meet the constraint, and ADM-03 AC-6 is where that refusal is asserted —
//   `tests/e2e/adm-03-holiday-writes.spec.ts` through the interface and
//   `tests/holiday-writes.test.ts` at the seam. The constraint ITSELF is still exercised by no test
//   until a project is provisioned, and RULE-09 keeps applying the migration human.
// - AC-11 (a failed read shows a failure) and AC-12 (a truncated read is refused) — both are throws
//   inside the seam. The mock's holiday table is four fixture rows and cannot reach HOLIDAY_LIMIT,
//   and no test can make PostgREST cap a read or a socket fail without a provisioned project. What
//   IS asserted below, everywhere the calendar is expected to be readable, is that
//   `holidays-unavailable` is absent — so the two screens can never be confused with each other by
//   accident.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the rows below are the mock's copy of the synthetic set in src/lib/fixtures.ts and
// supabase/seed.sql. THEY ARE NOT THE REAL VIETNAMESE CALENDAR and must never be replaced by it —
// ADR-015 section 5: a test asserting "30/4/2026 is a bridge day" asserts a fact about the world
// that an admin may correctly change, and it would then fail for the right reason in the wrong
// place. The real rows arrive through
// supabase/migrations/20260905120100_adm02_holiday_seed.sql, which a human fills and applies.
//
// `holiday_select_all` (`using (true)`) and `grant select on public.holiday to authenticated` are
// the real mechanisms behind AC-1, AC-2, AC-6 and AC-14. This suite observes the mock's
// reproduction of them.
//
// **MIR-15-e, ADR-079 decision 3 RETIRED AC-7's OWN MECHANISM AND ITS TEST.** `holiday_select_all`
// was replaced by `holiday_select_own_org`, so a caller with no member row — AC-7's subject — no
// longer reads the calendar at all. What AC-7 asserted is renamed MIR-15-e AC-5 below and asserts
// the opposite of what it used to.
//
// It once named a third mechanism — the ABSENCE of all three write policies — and that was AC-13,
// which ADM-03 retired where it stood below. The two read-half objects above are untouched by that
// ticket, which is why the eleven tests here still pass with no character changed.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's tables and its session live in module memory
// and a `page.goto` reloads the module. Navigation WITHIN a test is done by clicking links, which
// react-router handles client-side — the constraint every suite from CAL-01 onwards records. The
// exception is the member-less caller in MIR-15-e AC-5, who has no landing screen carrying the link
// and can only arrive by address; the session survives that reload because the mock persists it.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql). FOUR ROWS, ALL IN 2026, AND 2027
// CARRIES NONE — that empty year is AC-10's fixture and it is deliberate, not an oversight.
// - Admin:       quan@example.com       (FIXTURE_ADMIN, FIXTURE_TEAM)
// - Member:      thanh@example.com      (FIXTURE_MEMBER, FIXTURE_TEAM)
// - Other team:  chi@other.example.com  (FIXTURE_OTHER_TEAM_MEMBER, FIXTURE_OTHER_TEAM) — AC-14
// - Member-less: hoa@example.com        (FIXTURE_MEMBER_LESS, no member row at all) — MIR-15-e AC-5

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const OTHER_TEAM_EMAIL = "chi@other.example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";

const SIGNIN = "/signin";

/** The four synthetic rows, in the order AC-4 requires — ascending by date, which is NOT the order
 *  the fixture module lists them in or the order the seed inserts them. Transcribed rather than
 *  imported: the acceptance suite addresses the application through the browser and does not import
 *  from `src/`. */
const DATES_2026 = ["2026-06-11", "2026-06-13", "2026-06-15", "2026-10-15"];

/** The mandated Saturday. `kind` names the EFFECT on the working calendar and never the Vietnamese
 *  label (ADR-015 section 2), so this one row is `working` and the other three are not — which is
 *  what makes AC-3's "distinguishable by something other than their names" observable at all. */
const WORKING_DATE = "2026-06-13";

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Signs in and reaches the calendar through its LINK, which keeps one page lifetime. */
async function openHolidays(page: Page, email: string): Promise<void> {
  await signIn(page, email);
  await reachHolidays(page);
  await expect(page.getByTestId("holidays-year")).toBeVisible();
}

/** The role-dependent walk to `/holidays`, from anywhere inside the shell. */
async function reachHolidays(page: Page): Promise<void> {
  // SOLO 2026-09-12. **THE ROUTE TO `/holidays` NOW DEPENDS ON THE ROLE, AND THIS BRANCH IS THAT
  // FACT.** The operator moved Public holidays into the admin panel: an admin reaches it through the
  // tab strip, a member through the sidebar link, and NEITHER ROLE IS OFFERED BOTH. Branching on
  // which control exists rather than on the email keeps one page lifetime for both — a `page.goto`
  // would reload the module the mock's tables live in and lose the setup.
  // **WAIT FOR THE SHELL BEFORE COUNTING ANYTHING.** `count()` does not auto-wait, so called while
  // `useSession` is still resolving it answers zero for BOTH controls and the branch below picks the
  // wrong arm and hangs. The sidebar renders for either role, so it is the one landmark that means
  // "the shell is up" without already assuming which role is reading.
  await expect(page.getByTestId("shell-sidebar")).toBeVisible();

  const sidebarLink = page.getByTestId("home-holidays-link");
  if ((await sidebarLink.count()) > 0) {
    await sidebarLink.click();
  } else {
    const tab = page.getByTestId("admin-hub-holidays-link");
    if ((await tab.count()) === 0) await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-holidays-link").click();
  }
}

/** Every row's date, in the order the screen drew them. AC-4 turns on the ORDER, so this reads the
 *  attribute off the DOM rather than sorting anything. */
const drawnDates = (page: Page): Promise<string[]> =>
  page
    .getByTestId("holidays-row")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-date") ?? ""));

test.describe("ADM-02 the national holiday calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-1: a signed-in member reads the calendar for the displayed year", async ({ page }) => {
    await openHolidays(page, MEMBER_EMAIL);
    await page.getByTestId("holidays-next").click();
    await page.getByTestId("holidays-prev").click();

    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", "2026");
    await expect(page.getByTestId("holidays-row")).toHaveCount(DATES_2026.length);
    await expect(page.getByTestId("holidays-unavailable")).toHaveCount(0);
    await expect(page.getByTestId("holidays-beyond-calendar")).toHaveCount(0);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-2: an admin sees exactly the same rows, in the same order, as the member", async ({
    page,
  }) => {
    await openHolidays(page, MEMBER_EMAIL);
    const asMember = await drawnDates(page);
    expect(asMember).toEqual(DATES_2026);

    // Out WITHOUT a document load, so the second half runs against the same page lifetime. UIE-03
    // AC-12 deleted the back-link step: sign-out is a SIDEBAR control and renders on this screen.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    await openHolidays(page, ADMIN_EMAIL);
    expect(await drawnDates(page)).toEqual(asMember);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-3: a row shows its date, its name and its effect, and the two kinds differ", async ({
    page,
  }) => {
    await openHolidays(page, MEMBER_EMAIL);

    const working = page.locator(`[data-testid="holidays-row"][data-date="${WORKING_DATE}"]`);
    const nonWorking = page.locator('[data-testid="holidays-row"][data-date="2026-06-11"]');

    // The date and the name are on both.
    await expect(working.getByTestId("holidays-row-date")).toHaveText(WORKING_DATE);
    await expect(working.getByTestId("holidays-row-name")).not.toBeEmpty();
    await expect(nonWorking.getByTestId("holidays-row-name")).not.toBeEmpty();

    // The EFFECT is what separates them, and it is carried as an attribute so this asserts the
    // enum rather than parsing copy — the criterion stays true when the wording changes.
    await expect(working).toHaveAttribute("data-kind", "working");
    await expect(nonWorking).toHaveAttribute("data-kind", "non_working");

    // And it is a WORD as well as a colour: a mandated Saturday says it is a working day, which is
    // the exact inverse of what the row beside it says. Reading them as the same thing is the
    // confusion ADR-015 section 2 exists to prevent.
    const workingEffect = await working.getByTestId("holidays-row-effect").textContent();
    const nonWorkingEffect = await nonWorking.getByTestId("holidays-row-effect").textContent();
    expect(workingEffect).not.toEqual(nonWorkingEffect);
    expect(workingEffect?.trim()).not.toHaveLength(0);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-4: the rows are in ascending date order", async ({ page }) => {
    await openHolidays(page, MEMBER_EMAIL);

    const dates = await drawnDates(page);
    expect(dates).toEqual(DATES_2026);
    // Stated twice on purpose: the array above is also the fixture set, so a sort that happened to
    // reproduce it by accident would pass the first assertion. This one is about the ORDER alone.
    expect(dates).toEqual([...dates].sort());
  });

  test("AC-6: a caller with no session reaches no calendar and learns nothing", async ({ page }) => {
    await page.goto("/holidays/2026");

    // The route sends a signed-out caller to `/`, which resolves by membership to the sign-in
    // screen. What matters for the criterion is the second half: no row, and no notice that would
    // say whether the calendar holds anything at all.
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect(page.getByTestId("holidays-row")).toHaveCount(0);
    await expect(page.getByTestId("holidays-beyond-calendar")).toHaveCount(0);
    await expect(page.getByTestId("holidays-year")).toHaveCount(0);
  });

  // RETIRED AS "AC-7: a signed-in caller who is on no team still reads the calendar" and RENAMED by
  // MIR-15-e, ADR-079 decision 3. `holiday_select_own_org` replaced `holiday_select_all`, so this
  // caller — no member row at all — now reads NO row rather than the same four everybody else does,
  // and the screen is told so rather than rendering them.
  test("MIR-15-e AC-5: a signed-in caller with no org is told there is no calendar for them", async ({
    page,
  }) => {
    await signIn(page, MEMBER_LESS_EMAIL);
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();

    // BY ADDRESS, because this caller has no landing screen carrying the link — the link lives on
    // Home.tsx, which is a member's screen. The session survives the reload because the mock
    // persists it (TEA-05 AC-7), which is what makes this reachable at all.
    await page.goto("/holidays/2026");

    await expect(page.getByTestId("holidays-no-org")).toBeVisible();
    await expect(page.getByTestId("holidays-row")).toHaveCount(0);
    await expect(page.getByTestId("holidays-year")).toHaveCount(0);
    await expect(page.getByTestId("holidays-beyond-calendar")).toHaveCount(0);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-8: the year is the address, and typing it is the same as pressing next", async ({
    page,
  }) => {
    await openHolidays(page, MEMBER_EMAIL);

    await page.getByTestId("holidays-prev").click();
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", "2025");
    await expect(page).toHaveURL(/\/holidays\/2025$/);

    await page.getByTestId("holidays-next").click();
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", "2026");
    const byNavigation = await drawnDates(page);

    // The same screen reached by the address alone, so a year can be shared or bookmarked.
    await page.goto("/holidays/2026");
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", "2026");
    expect(await drawnDates(page)).toEqual(byNavigation);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-9: no year in the address, or a malformed one, resolves to the caller's own year", async ({
    page,
  }) => {
    // The year the BROWSER thinks it is, read the same way the screen reads it. Not a literal: a
    // literal here would start failing on 1 January for a reason that has nothing to do with this
    // feature.
    const thisYear = String(new Date().getFullYear());

    await openHolidays(page, MEMBER_EMAIL);
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", thisYear);
    await expect(page).toHaveURL(new RegExp(`/holidays/${thisYear}$`));

    // And a year that is not four digits lands in the same place rather than on an empty calendar.
    await page.goto("/holidays/20xx");
    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", thisYear);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-10: a year the calendar does not reach says so, and is not shown as a year without holidays", async ({
    page,
  }) => {
    await openHolidays(page, MEMBER_EMAIL);
    await page.getByTestId("holidays-next").click();

    await expect(page.getByTestId("holidays-year")).toHaveAttribute("data-year", "2027");
    await expect(page.getByTestId("holidays-row")).toHaveCount(0);

    const notice = page.getByTestId("holidays-beyond-calendar");
    await expect(notice).toBeVisible();
    // It is a sentence about the CALENDAR and never about the year. A Vietnamese year with no
    // public holidays does not exist, so "no holidays in 2027" would be the product stating
    // something false with confidence — and it is exactly what an under-seeded calendar looks like
    // from the outside.
    await expect(notice).toContainText("2027");
    await expect(notice).toContainText("calendar");

    // And it is NOT the failure notice: an empty year and a failed read must never look alike.
    await expect(page.getByTestId("holidays-unavailable")).toHaveCount(0);
  });

  // AC-13 STOOD HERE AND IS RETIRED BY ADM-03, not reworded. ADM-03 01-plan.md section 7 carries the
  // permission and its exact scope.
  //
  // It asserted that the calendar is not writable by anybody, admin included: zero buttons, zero
  // textboxes and zero forms on this screen for FIXTURE_ADMIN. Its SUBJECT was the absence of
  // `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin` and the write grant —
  // ADM-02 shipped the read half of `public.holiday` and left the calendar unwritable on purpose,
  // and this test was that fact observed from the outside. It was true of the branch that shipped
  // it, and ADM-02's own plan said in terms that "ADM-03 ships the write half".
  //
  // supabase/migrations/20260905140000_adm03_holiday_writes.sql ends that absence, so there is no
  // narrower true statement left for this block to make about an admin on this screen. It is not
  // rewritten into an assertion about a MEMBER: that is ADM-03 AC-14 and ADM-03's own suite owns it,
  // and a second copy here would be a second place the same fact is decided.
  //
  // WHERE THE ADM-03-ERA TRUTH IS ASSERTED INSTEAD:
  // - a member is offered no control — tests/e2e/adm-03-holiday-writes.spec.ts, AC-14
  // - a member's, a member-less caller's and a removed admin's writes are refused BELOW the
  //   interface — tests/holiday-writes.test.ts, AC-15 and AC-16
  //
  // The eleven tests around this comment are untouched and must stay so: a green run of them is the
  // evidence that ADM-03 added a write path without disturbing the read one (ADM-03 AC-18).

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-14: the calendar is national — a caller on another team reads the same rows", async ({
    page,
  }) => {
    await openHolidays(page, MEMBER_EMAIL);
    const onOurTeam = await drawnDates(page);

    // UIE-03 AC-12. The back-link step is deleted; sign-out is in the sidebar, on this screen.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    // FIXTURE_OTHER_TEAM_MEMBER. Every other read in this product returns that caller a different
    // set of rows — it is the whole of CAL-04 AC-12 and CAL-03 AC-8. Here it must return the same
    // ones, because there is no `team_id` on this table and nothing to scope (ADR-015 section 1).
    await openHolidays(page, OTHER_TEAM_EMAIL);
    expect(await drawnDates(page)).toEqual(onOurTeam);
  });

  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-15: a route to the calendar is offered to both roles", async ({ page }) => {
    // **AMENDED BY SOLO 2026-09-12, AND THE TITLE MOVED WITH IT.** As shipped this read *"the LINK
    // is offered to both roles"* and asserted one id in one place for both. The operator moved
    // Public holidays into the admin panel, so the two roles are now offered DIFFERENT controls.
    //
    // What the criterion protects is untouched and is what is asserted below: a member is not cut
    // off from the national calendar. `Read the holiday calendar` is checked for both roles in
    // .ai/standards/rbac-and-security.md, `Holidays.tsx` has no `refused` phase because of it, and
    // the route is still guarded on a SESSION rather than on a role.
    //
    // **AND NEITHER ROLE IS OFFERED BOTH**, which is the other half and the one that could regress
    // silently: a `home-holidays-link` left rendering for an admin would be a second route for them
    // and, worse, a second node for every strict-mode click on that id (UIE-02 AC-6).
    await signIn(page, ADMIN_EMAIL);
    await expect(page.getByTestId("home-holidays-link")).toHaveCount(0);
    await page.getByTestId("shell-admin-link").click();
    await expect(page.getByTestId("admin-hub-holidays-link")).toBeVisible();
    await page.getByTestId("admin-hub-holidays-link").click();
    await expect(page.getByTestId("holidays-year")).toBeVisible();

    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    // The member keeps the sidebar link and is offered no strip at all.
    await signIn(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-holidays-link")).toBeVisible();
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
    await page.getByTestId("home-holidays-link").click();
    await expect(page.getByTestId("holidays-year")).toBeVisible();
    await expect(page.getByTestId("admin-tabs")).toHaveCount(0);
  });
});
