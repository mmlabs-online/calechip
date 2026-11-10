import { expect, test, type Page } from "@playwright/test";

// EVT-01 — a member announces an event, and those it is for can read it. 01-plan.md § 2 and § 4.4.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it; `tests/e2e/seam.setup.ts` refuses the run
// otherwise). The permission half of every AC — who can read, who can change — is asserted
// exhaustively in `tests/events.test.ts`; this file asserts what a person SEES on the three screens.
//
// **A `page.goto` RESETS THE MOCK'S TABLES, AND THE EVENT TABLE STARTS EMPTY.** So every journey
// that creates an event and then looks at it moves by clicking, never by `goto`. Where a journey
// needs a second person to look at the first person's event, it signs out with `home-sign-out` and
// signs in again on the same document — the session lives in storage, the tables in the module.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
// FIXTURE_APPROVED_MEMBER on the same team, chi@ is FIXTURE_OTHER_TEAM_MEMBER on "Nhóm khác", and
// quan@ is FIXTURE_ADMIN.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com", name: "Thành viên" };
const TEAMMATE = { email: "linh@example.com", name: "Đã duyệt" };
const OTHER_TEAM = { email: "chi@other.example.com", name: "Người nhóm khác", team: "Nhóm khác" };
const ADMIN = { email: "quan@example.com", name: "Quản trị" };

async function fillSignIn(page: Page, email: string): Promise<void> {
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await fillSignIn(page, email);
}

/** Another person, same document — the events created so far survive. */
async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await fillSignIn(page, email);
}

async function openEvents(page: Page): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
}

async function startNew(page: Page): Promise<void> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
}

async function fillEvent(
  page: Page,
  values: { name: string; start: string; end: string; scope?: "team" | "named" | "public"; location?: string; description?: string },
): Promise<void> {
  await page.getByTestId("event-name-input").fill(values.name);
  await page.getByTestId("event-start-input").fill(values.start);
  await page.getByTestId("event-end-input").fill(values.end);
  await page.getByTestId(`event-scope-${values.scope ?? "team"}`).check();
  if (values.location !== undefined) await page.getByTestId("event-location-input").fill(values.location);
  if (values.description !== undefined) {
    await page.getByTestId("event-description-input").fill(values.description);
  }
}

test.describe("EVT-01 — events", () => {
  test("AC-19: every role has an Events link in the navigation, and it opens the list", async ({ page }) => {
    for (const who of [MEMBER, ADMIN]) {
      await signIn(page, who.email);
      for (const address of ["/week", "/month", "/profile"]) {
        await page.goto(address);
        await expect(page.getByTestId("nav-events-link")).toBeVisible();
      }
      await openEvents(page);
      await page.getByTestId("home-sign-out").click();
      await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    }
  });

  test("AC-21: with no events the list is the empty state alone, with the create control", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openEvents(page);
    await expect(page.getByTestId("events-empty")).toBeVisible();
    await expect(page.getByTestId("events-new-button")).toHaveCount(1);
    await expect(page.getByTestId("events-empty").getByTestId("events-new-button")).toBeVisible();
    await expect(page.getByTestId("events-upcoming")).toHaveCount(0);
    await expect(page.getByTestId("events-past")).toHaveCount(0);
  });

  test("AC-1, AC-22, AC-23: a member creates an event and lands on its detail page", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await startNew(page);

    // AC-3 (Q11): dates only — no time of day anywhere on the form.
    await expect(page.locator('[data-testid="event-form"] input[type="time"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="event-form"] input[type="datetime-local"]')).toHaveCount(0);
    // AC-23: the picker is drawn only while Limited people is chosen.
    await expect(page.getByTestId("event-picker")).toHaveCount(0);

    await fillEvent(page, {
      name: "Team lunch",
      start: "2099-03-10",
      end: "2099-03-12",
      scope: "public",
      location: "Pho 24",
      description: "Bring your appetite",
    });
    await page.getByTestId("event-save").click();

    await expect(page).toHaveURL(/\/events\/[^/]+$/);
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-name")).toHaveText("Team lunch");
    await expect(page.getByTestId("event-dates")).toHaveText("10 Mar – 12 Mar 2099");
    await expect(page.getByTestId("event-scope")).toHaveAttribute("data-scope", "public");
    await expect(page.getByTestId("event-scope")).toHaveText("Public");
    await expect(page.getByTestId("event-creator")).toContainText(MEMBER.name);
    await expect(page.getByTestId("event-location")).toContainText("Pho 24");
    await expect(page.getByTestId("event-description")).toHaveText("Bring your appetite");
    await expect(page.getByTestId("event-edit-button")).toBeVisible();
    await expect(page.getByTestId("event-delete-button")).toBeVisible();
  });

  test("AC-2: an empty name is refused on the form; blank location and description draw nothing", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await startNew(page);
    await fillEvent(page, { name: "   ", start: "2099-04-01", end: "2099-04-01" });
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-form-error")).toContainText("name");
    await expect(page).toHaveURL(/\/events\/new$/);

    await page.getByTestId("event-name-input").fill("Quiz night");
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-location")).toHaveCount(0);
    await expect(page.getByTestId("event-description")).toHaveCount(0);
  });

  test("AC-3: an end date before the start date is refused on the form", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await startNew(page);
    await fillEvent(page, { name: "Backwards", start: "2099-04-10", end: "2099-04-09" });
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-form-error")).toContainText("end date");
    await expect(page).toHaveURL(/\/events\/new$/);
  });

  test("AC-20: upcoming soonest first, past most recent first, each row with its badge and creator", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const make = async (name: string, start: string, end: string, scope: "team" | "public"): Promise<void> => {
      await startNew(page);
      await fillEvent(page, { name, start, end, scope });
      await page.getByTestId("event-save").click();
      await expect(page.getByTestId("event-detail")).toBeVisible();
    };
    await make("Later", "2099-09-01", "2099-09-01", "team");
    await make("Sooner", "2099-02-01", "2099-02-02", "public");
    await make("Long ago", "2001-01-01", "2001-01-01", "team");
    await make("Less long ago", "2005-06-01", "2005-06-03", "team");

    await openEvents(page);
    const upcoming = page.getByTestId("events-upcoming").getByTestId("event-row");
    const past = page.getByTestId("events-past").getByTestId("event-row");
    await expect(upcoming).toHaveCount(2);
    await expect(past).toHaveCount(2);
    await expect(upcoming.nth(0)).toContainText("Sooner");
    await expect(upcoming.nth(1)).toContainText("Later");
    await expect(past.nth(0)).toContainText("Less long ago");
    await expect(past.nth(1)).toContainText("Long ago");

    const first = upcoming.nth(0);
    await expect(first.getByTestId("event-row-scope")).toHaveAttribute("data-scope", "public");
    await expect(first.getByTestId("event-row-scope")).toHaveText("Public");
    await expect(first).toContainText("1 Feb – 2 Feb 2099");
    await expect(first).toContainText(MEMBER.name);
    await expect(upcoming.nth(1).getByTestId("event-row-scope")).toHaveText("Own team");

    await first.click();
    await expect(page.getByTestId("event-name")).toHaveText("Sooner");
  });

  // 2026-10-21, MIR-04 / ADR-066 1: superseded "the picker groups every other member by team".
  test("AC-10, AC-13, AC-23 (ADR-066): the picker offers the caller's own team, and the creator sees who is named", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await startNew(page);
    await fillEvent(page, { name: "Design review", start: "2099-05-05", end: "2099-05-05", scope: "named" });

    const picker = page.getByTestId("event-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId("event-picker-group")).toHaveCount(1);
    await expect(picker).toContainText("CaleChip");
    // The caller is not offered to themselves, and nobody from another team is offered.
    await expect(picker.getByTestId("event-picker-option").filter({ hasText: MEMBER.name })).toHaveCount(0);
    await expect(picker.getByTestId("event-picker-option").filter({ hasText: OTHER_TEAM.name })).toHaveCount(0);
    await expect(picker.getByTestId("event-picker-option").filter({ hasText: TEAMMATE.name })).toHaveCount(1);

    await page.getByTestId("event-picker-filter").fill("duyệt");
    await expect(picker.getByTestId("event-picker-group")).toHaveCount(1);
    await expect(picker.getByTestId("event-picker-option")).toHaveCount(1);
    await picker.getByTestId("event-picker-option").filter({ hasText: TEAMMATE.name }).click();
    await page.getByTestId("event-picker-filter").fill("");

    // Scope away and back: the picker is drawn only while Limited people is chosen.
    await page.getByTestId("event-scope-team").check();
    await expect(page.getByTestId("event-picker")).toHaveCount(0);
    await page.getByTestId("event-scope-named").check();
    await expect(page.getByTestId("event-picker")).toBeVisible();

    await page.getByTestId("event-save").click();
    // EVT-12 AC-14. The label only; the value stays `named`.
    await expect(page.getByTestId("event-scope")).toHaveText("Limited people");
    await expect(page.getByTestId("event-invitees")).toContainText(TEAMMATE.name);

    // AC-13: the named person sees the event, and not who else is named.
    await switchTo(page, TEAMMATE.email);
    await openEvents(page);
    await page.getByTestId("event-row").filter({ hasText: "Design review" }).click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-invitees")).toHaveCount(0);
    await expect(page.getByTestId("event-edit-button")).toHaveCount(0);

    // AC-7: someone who is not named cannot see it at all.
    await switchTo(page, OTHER_TEAM.email);
    await openEvents(page);
    await expect(page.getByTestId("events-empty")).toBeVisible();
  });

  test("AC-14, AC-23: the edit form opens with the current values, including who is named", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await startNew(page);
    await fillEvent(page, { name: "Offsite", start: "2099-07-01", end: "2099-07-02", scope: "named", location: "Da Lat" });
    await page.getByTestId("event-picker-option").filter({ hasText: TEAMMATE.name }).click();
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();

    await page.getByTestId("event-edit-button").click();
    await expect(page.getByTestId("event-name-input")).toHaveValue("Offsite");
    await expect(page.getByTestId("event-start-input")).toHaveValue("2099-07-01");
    await expect(page.getByTestId("event-end-input")).toHaveValue("2099-07-02");
    await expect(page.getByTestId("event-location-input")).toHaveValue("Da Lat");
    await expect(page.getByTestId("event-scope-named")).toBeChecked();
    await expect(
      page.getByTestId("event-picker-option").filter({ hasText: TEAMMATE.name }).locator("input"),
    ).toBeChecked();

    await page.getByTestId("event-name-input").fill("Offsite 2099");
    await page.getByTestId("event-scope-public").check();
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-name")).toHaveText("Offsite 2099");
    await expect(page.getByTestId("event-scope")).toHaveAttribute("data-scope", "public");

    // Cancelling an edit changes nothing and goes back.
    await page.getByTestId("event-edit-button").click();
    await page.getByTestId("event-name-input").fill("Not saved");
    await page.getByTestId("event-cancel").click();
    await expect(page.getByTestId("event-name")).toHaveText("Offsite 2099");
  });

  test("AC-15: the creator deletes an event after a confirmation that names it", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await startNew(page);
    await fillEvent(page, { name: "Farewell", start: "2099-08-08", end: "2099-08-08" });
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();

    await page.getByTestId("event-delete-button").click();
    await expect(page.getByRole("dialog")).toContainText("Farewell");
    await page.getByTestId("event-delete-cancel").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("event-name")).toHaveText("Farewell");

    await page.getByTestId("event-delete-button").click();
    await page.getByTestId("event-delete-confirm").click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByTestId("events-empty")).toBeVisible();
  });

  test("AC-16, AC-17: an admin edits another member's event; a teammate sees it without controls", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await startNew(page);
    await fillEvent(page, { name: "Board games", start: "2099-10-10", end: "2099-10-10", scope: "team" });
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();

    await switchTo(page, TEAMMATE.email);
    await openEvents(page);
    await page.getByTestId("event-row").filter({ hasText: "Board games" }).click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-edit-button")).toHaveCount(0);
    await expect(page.getByTestId("event-delete-button")).toHaveCount(0);

    // AC-5: team B does not see team A's own-team event.
    await switchTo(page, OTHER_TEAM.email);
    await openEvents(page);
    await expect(page.getByTestId("events-empty")).toBeVisible();

    await switchTo(page, ADMIN.email);
    await openEvents(page);
    await page.getByTestId("event-row").filter({ hasText: "Board games" }).click();
    await page.getByTestId("event-edit-button").click();
    await page.getByTestId("event-name-input").fill("Board games night");
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-name")).toHaveText("Board games night");
    // The creator is still the creator.
    await expect(page.getByTestId("event-creator")).toContainText(MEMBER.name);
  });

  test("AC-22: an unknown event id shows the not-found state and nothing else", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await page.goto("/events/ec000000-0000-4000-8000-000000000999");
    await expect(page.getByTestId("event-not-found")).toBeVisible();
    await expect(page.getByTestId("event-detail")).toHaveCount(0);
    await page.goto("/events/ec000000-0000-4000-8000-000000000999/edit");
    await expect(page.getByTestId("event-not-found")).toBeVisible();
    await expect(page.getByTestId("event-form")).toHaveCount(0);
  });
});
