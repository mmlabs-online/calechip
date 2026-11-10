import { expect, test, type Page } from "@playwright/test";

// EVT-09 — inviting by email while creating a public event. 01-plan.md § 2 AC-1..AC-8, § 2b, § 4.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). The order of the two calls, every refusal and the
// thrown invitation are asserted in `tests/event-create-invitation.test.ts`; this file asserts what a
// person SEES on the form and on the page they land on.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-06-guest-link.spec.ts` records — so every
// journey stays on one page load after sign-in, and a reload cannot be driven here (AC-8). What a
// reload would read is `history.state`, and that is asserted empty instead.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
// FIXTURE_APPROVED_MEMBER on the same team.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com" };
const TEAMMATE = { email: "linh@example.com" };
const INVALID_SENTENCE = "Each address must look like name@example.com, in 254 characters or fewer.";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function openEvents(page: Page): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
}

async function openNewForm(page: Page, name: string): Promise<void> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
}

const emailsIn = (page: Page, testId: string) =>
  page.getByTestId(testId).locator("li").evaluateAll((items) => items.map((i) => i.getAttribute("data-email")));

/** What a reload of this entry would hand the router as `location.state`. */
const historyState = (page: Page) =>
  page.evaluate(() => (window.history.state as { usr?: unknown } | null)?.usr ?? null);

test.describe("EVT-09 — invite by email while creating", () => {
  // EVT-12 AC-2: drawn for every scope, after the picker when it is drawn; still never on the edit form.
  test("AC-1, EVT-12 AC-2, AC-11: the field is drawn on the create form for every scope, never on the edit form", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openNewForm(page, "Field visibility");

    await page.getByTestId("event-scope-team").check();
    await expect(page.getByTestId("event-form-invite")).toBeVisible();
    await page.getByTestId("event-form-invite-input").fill("friend@outside.example");
    await expect(page.getByTestId("event-form-invite-hint")).toContainText("then becomes Limited people");
    await page.getByTestId("event-scope-named").check();
    await expect(page.getByTestId("event-form-invite")).toBeVisible();
    await expect(page.getByTestId("event-form-invite-hint")).toContainText("added to its people");
    await expect(page.getByTestId("event-picker")).toBeVisible();
    await expect(page.getByLabel("Limited people")).toBeVisible();
    await page.getByTestId("event-form-invite-input").fill("");

    await page.getByTestId("event-scope-public").check();
    await expect(page.getByTestId("event-form-invite")).toBeVisible();
    await expect(page.getByTestId("event-picker")).toHaveCount(0);
    const input = page.getByTestId("event-form-invite-input");
    await expect(input).toBeVisible();
    expect(await input.evaluate((el) => el.tagName)).toBe("TEXTAREA");
    await expect(page.getByTestId("event-form-invite")).toContainText("Invite by email (optional)");
    await expect(page.getByTestId("event-save")).toHaveText("Create event");

    // A public event created without addresses, then its edit form: no field.
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await page.getByTestId("event-edit-button").click();
    await expect(page.getByTestId("event-form")).toBeVisible();
    await expect(page.getByTestId("event-scope-public")).toBeChecked();
    await expect(page.getByTestId("event-form-invite")).toHaveCount(0);
  });

  // EVT-12 AC-2 replaces "or a non-public scope whatever the field held": a team event's addresses are sent.
  test("AC-2: an empty field is EVT-01's creation; EVT-12 AC-2: a team event's addresses are sent", async ({ page }) => {
    await signIn(page, MEMBER.email);

    await openNewForm(page, "Empty field");
    await page.getByTestId("event-scope-public").check();
    await page.getByTestId("event-form-invite-input").fill("  ,;  \n ");
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-invite-panel")).toBeVisible();
    await expect(page.getByTestId("event-invite-result")).toHaveCount(0);
    await expect(page.getByTestId("event-invite-error")).toHaveCount(0);
    await expect(page.getByTestId("event-invited-row")).toHaveCount(0);
    await expect(page.getByTestId("event-guest-link")).toHaveCount(0);

    await openNewForm(page, "Team after typing");
    await page.getByTestId("event-scope-public").check();
    await page.getByTestId("event-form-invite-input").fill("friend@outside.example");
    await page.getByTestId("event-scope-team").check();
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-name")).toHaveText("Team after typing");
    await expect(page.getByTestId("event-scope")).toHaveText("Own team");
    await expect(page.getByTestId("event-invite-sent")).toContainText("friend@outside.example");
    await expect(page.getByTestId("event-invited-row")).toHaveCount(1);
  });

  test("AC-3, AC-7: one press creates the event, invites each distinct address, and lands with the result", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openNewForm(page, "Created with guests");
    await page.getByTestId("event-scope-public").check();
    await expect(page.getByTestId("event-form-invite")).toContainText("People outside CaleChip get the guest link by email.");
    await page
      .getByTestId("event-form-invite-input")
      .fill(`one@outside.example, two@outside.example;\nONE@outside.example  ${TEAMMATE.email}`);
    await expect(page.getByTestId("event-form-invite")).toContainText("Creating opens this event to guests.");

    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-name")).toHaveText("Created with guests");

    // AC-3. The result, each distinct address once under Invited — a member's like an outsider's.
    await expect(page.getByTestId("event-invite-result")).toBeVisible();
    expect(await emailsIn(page, "event-invite-sent")).toEqual([
      "one@outside.example",
      "two@outside.example",
      TEAMMATE.email,
    ]);
    await expect(page.getByTestId("event-invite-ignored")).toHaveCount(0);
    const shapes = await page
      .getByTestId("event-invite-sent")
      .locator("li")
      .evaluateAll((items) => items.map((i) => [i.className, [...i.attributes].map((a) => a.name).sort().join(",")]));
    expect(shapes[2]).toEqual(shapes[0]);

    // EVT-08 AC-5, AC-12. The guest link is open and each address is in the list once.
    await expect(page.getByTestId("event-guest-panel")).toBeVisible();
    await expect(page.getByTestId("event-guest-link")).toHaveValue(/\/guest\/[0-9a-f]{64}$/);
    await expect(page.getByTestId("event-invited-row")).toHaveCount(3);
    await expect(page.getByTestId("event-invite-error")).toHaveCount(0);

    // AC-7. One event, not two.
    await openEvents(page);
    await expect(page.getByTestId("event-row").filter({ hasText: "Created with guests" })).toHaveCount(1);
  });

  test("AC-4: a malformed address creates nothing, names the address, and keeps every value", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openNewForm(page, "Typo event");
    await page.getByTestId("event-scope-public").check();
    await page.getByTestId("event-location-input").fill("Phòng lớn");
    const typed = "good@outside.example, not-an-address";
    await page.getByTestId("event-form-invite-input").fill(typed);
    await page.getByTestId("event-save").click();

    const error = page.getByTestId("event-form-invite-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(INVALID_SENTENCE);
    await expect(error).toContainText("not-an-address");
    await expect(error).not.toContainText("good@outside.example");
    await expect(page.getByTestId("event-form")).toBeVisible();
    await expect(page.getByTestId("event-form-invite-input")).toHaveValue(typed);
    await expect(page.getByTestId("event-name-input")).toHaveValue("Typo event");
    await expect(page.getByTestId("event-location-input")).toHaveValue("Phòng lớn");
    await expect(page.getByTestId("event-scope-public")).toBeChecked();
    await expect(page.getByTestId("event-save")).toBeEnabled();

    await page.getByTestId("event-cancel").click();
    await openEvents(page);
    await expect(page.getByTestId("event-row").filter({ hasText: "Typo event" })).toHaveCount(0);
  });

  test("AC-5: createEvent's refusal is the form's, and the invite field keeps what was typed", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openNewForm(page, "");
    await page.getByTestId("event-scope-public").check();
    await page.getByTestId("event-form-invite-input").fill("friend@outside.example");
    await page.getByTestId("event-save").click();

    await expect(page.getByTestId("event-form-error")).toBeVisible();
    await expect(page.getByTestId("event-form-invite-error")).toHaveCount(0);
    await expect(page.getByTestId("event-form")).toBeVisible();
    await expect(page.getByTestId("event-form-invite-input")).toHaveValue("friend@outside.example");
  });

  // QUARANTINED BUG-004 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-6: a failed handoff opens the panel with the sentence and the addresses ready to resend", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openNewForm(page, "Failed send");
    await page.getByTestId("event-scope-public").check();
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    const path = new URL(page.url()).pathname;

    // The mock never refuses a creator on their own public event, so the failure is handed in as the
    // form would hand it: the router's state on a history entry, reached by a popstate.
    await openEvents(page);
    await page.evaluate((to) => {
      window.history.pushState(
        {
          usr: { kind: "failed", message: "Check your connection.", emails: ["a@outside.example", "b@outside.example"] },
          key: "evt09",
          idx: ((window.history.state as { idx?: number } | null)?.idx ?? 0) + 1,
        },
        "",
        to,
      );
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    }, path);
    await expect(page.getByTestId("event-detail")).toBeVisible();

    await expect(page.getByTestId("event-invite-error")).toHaveText(
      /^The event was created, but the invitations were not sent\. Check your connection\./,
    );
    await expect(page.getByTestId("event-invite-input")).toHaveValue("a@outside.example, b@outside.example");
    await expect(page.getByTestId("event-invite-result")).toHaveCount(0);

    // EVT-08 AC-1. The addresses are sent from there.
    await page.getByTestId("event-invite-submit").click();
    await expect(page.getByTestId("event-invite-result")).toBeVisible();
    expect(await emailsIn(page, "event-invite-sent")).toEqual(["a@outside.example", "b@outside.example"]);
    await expect(page.getByTestId("event-invite-error")).toHaveCount(0);
    await expect(page.getByTestId("event-invited-row")).toHaveCount(2);
  });

  test("AC-8: the page reached any other way shows no result, and the handoff is gone from history", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openNewForm(page, "Arrive again");
    await page.getByTestId("event-scope-public").check();
    await page.getByTestId("event-form-invite-input").fill("friend@outside.example");
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-invite-result")).toBeVisible();

    // What a reload would read.
    expect(await historyState(page)).toBeNull();

    await openEvents(page);
    await page.getByTestId("event-row").filter({ hasText: "Arrive again" }).click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-invite-panel")).toBeVisible();
    await expect(page.getByTestId("event-invite-result")).toHaveCount(0);
    await expect(page.getByTestId("event-invite-error")).toHaveCount(0);
    await expect(page.getByTestId("event-invited-row")).toHaveCount(1);
  });
});
