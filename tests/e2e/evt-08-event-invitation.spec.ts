import { expect, test, type Page } from "@playwright/test";

// EVT-08 — email invitations to a public event. 01-plan.md § 2 AC-1..AC-12, § 2b, § 4.5, § 4.6.
// EVT-12 — on every scope. Its 01-plan.md § 2 AC-1, AC-4, AC-6, AC-7, AC-10, AC-11, AC-13.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). Every refusal straight to the datastore, which
// mail goes to whom, and the membership-blindness of every answer are asserted in
// `tests/event-invitation.test.ts`; this file asserts what a person SEES on the detail page.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-06-guest-link.spec.ts` records — so every
// journey stays on one page load after sign-in and moves between people with the in-app sign-out.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
// FIXTURE_APPROVED_MEMBER on the same team, and quan@ is FIXTURE_ADMIN.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com", name: "Thành viên" };
const TEAMMATE = { email: "linh@example.com" };
const ADMIN = { email: "quan@example.com" };
// EVT-12. FIXTURE_OTHER_TEAM_MEMBER, on the other team.
const OTHER_TEAM = { email: "chi@other.example.com", name: "Người nhóm khác" };

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

async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await fillSignIn(page, email);
}

async function openEvents(page: Page): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
}

async function openEvent(page: Page, name: string): Promise<void> {
  await openEvents(page);
  await page.getByTestId("event-row").filter({ hasText: name }).click();
  await expect(page.getByTestId("event-name")).toHaveText(name);
}

async function createEvent(page: Page, name: string, scope: "public" | "team" = "public"): Promise<void> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
  await page.getByTestId(`event-scope-${scope}`).check();
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId("event-invite-input").fill(text);
  await page.getByTestId("event-invite-submit").click();
}

const emailsIn = (page: Page, testId: string) =>
  page.getByTestId(testId).locator("li").evaluateAll((items) => items.map((i) => i.getAttribute("data-email")));

test.describe("EVT-08 — email invitations", () => {
  test("AC-1, AC-5, AC-6, AC-12: the creator invites, the event opens to guests, and the list grows", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite party");

    const panel = page.getByTestId("event-invite-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("event-invite-submit")).toHaveText("Send invitations");
    await expect(page.getByTestId("event-invite-submit")).toBeDisabled();
    await expect(page.getByTestId("event-invited-list")).toContainText("Invited by email (0)");
    await expect(page.getByTestId("event-invited-list")).toContainText("Nobody has been invited by email yet.");
    await expect(page.getByTestId("event-guest-link")).toHaveCount(0);

    // AC-1. Commas, semicolons, spaces and new lines; a repeat in another case counts once (AC-6).
    await send(page, "one@outside.example, two@outside.example;\nONE@outside.example  linh@example.com");
    await expect(page.getByTestId("event-invite-result")).toBeVisible();
    expect(await emailsIn(page, "event-invite-sent")).toEqual([
      "one@outside.example",
      "two@outside.example",
      "linh@example.com",
    ]);
    await expect(page.getByTestId("event-invite-ignored")).toHaveCount(0);
    await expect(page.getByTestId("event-invite-input")).toHaveValue("");

    // AC-5. Without a reload.
    await expect(page.getByTestId("event-guest-link")).toHaveValue(/\/guest\/[0-9a-f]{64}$/);

    // AC-12. One row each, the inviter named.
    await expect(page.getByTestId("event-invited-list")).toContainText("Invited by email (3)");
    await expect(page.getByTestId("event-invited-row")).toHaveCount(3);
    await expect(page.getByTestId("event-invited-row").first()).toContainText(`by ${MEMBER.name}`);

    // AC-6. A later submission: the earlier address is already invited, the new one is invited.
    const link = await page.getByTestId("event-guest-link").inputValue();
    await send(page, "Two@Outside.example three@outside.example");
    expect(await emailsIn(page, "event-invite-ignored")).toEqual(["Two@Outside.example"]);
    expect(await emailsIn(page, "event-invite-sent")).toEqual(["three@outside.example"]);
    await expect(page.getByTestId("event-invited-row")).toHaveCount(4);
    await expect(page.getByTestId("event-guest-link")).toHaveValue(link);
  });

  test("AC-7: a member's address and an outsider's look the same on screen", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite blind");
    await send(page, "linh@example.com stranger@outside.example");
    const rows = page.getByTestId("event-invite-sent").locator("li");
    await expect(rows).toHaveCount(2);
    const shapes = await rows.evaluateAll((items) =>
      items.map((i) => [i.className, [...i.attributes].map((a) => a.name).sort().join(",")]),
    );
    expect(shapes[0]).toEqual(shapes[1]);
  });

  test("AC-10: a malformed address stops the send and is named; the field keeps what was typed", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite typo");
    const typed = "good@outside.example, not-an-address";
    await send(page, typed);
    const error = page.getByTestId("event-invite-error");
    await expect(error).toContainText("name@example.com");
    await expect(error).toContainText("not-an-address");
    await expect(page.getByTestId("event-invite-input")).toHaveValue(typed);
    await expect(page.getByTestId("event-invite-result")).toHaveCount(0);
    await expect(page.getByTestId("event-invited-row")).toHaveCount(0);
    await expect(page.getByTestId("event-guest-link")).toHaveCount(0);
  });

  test("AC-2, AC-3: an admin invites on somebody else's event; another member sees no panel", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite admin");

    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Invite admin");
    await expect(page.getByTestId("event-invite-panel")).toHaveCount(0);
    await expect(page.getByTestId("event-invited-list")).toHaveCount(0);

    await switchTo(page, ADMIN.email);
    await openEvent(page, "Invite admin");
    await send(page, "admin-guest@outside.example");
    expect(await emailsIn(page, "event-invite-sent")).toEqual(["admin-guest@outside.example"]);
    await expect(page.getByTestId("event-invited-row")).toHaveCount(1);
  });

  // EVT-08 AC-4 ("public events only") is replaced by EVT-12 — the cases below.
});

test.describe("EVT-12 — invitations on every scope", () => {
  test("AC-1, AC-11: a team event shows the panel, and its hint names the conversion", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite team only", "team");
    await expect(page.getByTestId("event-invite-panel")).toBeVisible();
    await expect(page.getByTestId("event-invite-input")).toBeVisible();
    await expect(page.getByTestId("event-invite-hint")).toContainText("then becomes Limited people");
    await expect(page.getByTestId("event-invite-hint")).toContainText("won't see it");
    await expect(page.getByTestId("event-invite-not-public")).toHaveCount(0);
  });

  test("AC-4: an outsider on a team event opens it to guests and leaves the scope alone", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite team guest", "team");
    await send(page, "friend@outside.example");
    expect(await emailsIn(page, "event-invite-sent")).toEqual(["friend@outside.example"]);
    await expect(page.getByTestId("event-guest-link")).toBeVisible();
    await expect(page.getByTestId("event-scope")).toHaveText("Own team");
  });

  test("AC-6, AC-7, AC-10: a member of another team converts the event in place, and can read it", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite team convert", "team");
    await send(page, OTHER_TEAM.email);
    expect(await emailsIn(page, "event-invite-sent")).toEqual([OTHER_TEAM.email]);
    await expect(page.getByTestId("event-scope")).toHaveText("Limited people");
    await expect(page.getByTestId("event-invitees")).toContainText(OTHER_TEAM.name);
    await expect(page.getByTestId("event-invitees")).toContainText("Đã duyệt");
    await expect(page.getByTestId("event-invite-hint")).toContainText("added to its people");
    // No guest link: the only address was a member's.
    await expect(page.getByTestId("event-guest-link")).toHaveCount(0);

    await switchTo(page, OTHER_TEAM.email);
    await openEvent(page, "Invite team convert");
  });

  test("AC-13: moved off public, invitations go on under the new scope, and the list stays", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, "Invite moved");
    await send(page, "kept@outside.example");
    await expect(page.getByTestId("event-invited-row")).toHaveCount(1);

    await page.getByTestId("event-edit-button").click();
    await expect(page.getByTestId("event-form")).toBeVisible();
    await page.getByTestId("event-scope-team").check();
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();

    await expect(page.getByTestId("event-invite-input")).toBeVisible();
    await send(page, "another@outside.example");
    await expect(page.getByTestId("event-invited-row")).toHaveCount(2);
    await expect(page.getByTestId("event-scope")).toHaveText("Own team");
  });
});
