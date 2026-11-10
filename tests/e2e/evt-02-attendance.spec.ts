import { expect, test, type Page } from "@playwright/test";

// EVT-02 — joining an event, and who is coming. 01-plan.md § 2 AC-27 to AC-29, § 2b, § 4.5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). Every refusal and every concurrency clause is
// asserted in `tests/event-attendance.test.ts`; this file asserts what a person SEES on the detail
// page and the form.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-01-events.spec.ts` records. So every journey
// that creates an event and then looks at it moves by clicking, and a second person is reached by
// signing out and in on the same document.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
// FIXTURE_APPROVED_MEMBER on the same team, chi@ is FIXTURE_OTHER_TEAM_MEMBER on "Nhóm khác", and
// quan@ is FIXTURE_ADMIN.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com", name: "Thành viên" };
const TEAMMATE = { email: "linh@example.com", name: "Đã duyệt" };
const OTHER_TEAM = { email: "chi@other.example.com", name: "Người nhóm khác" };
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

async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await fillSignIn(page, email);
}

async function openEvents(page: Page): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
}

/** Opens the named event from the list, by clicking. */
async function openEvent(page: Page, name: string): Promise<void> {
  await openEvents(page);
  await page.getByTestId("event-row").filter({ hasText: name }).click();
  await expect(page.getByTestId("event-name")).toHaveText(name);
}

async function createEvent(
  page: Page,
  values: {
    name: string;
    start?: string;
    end?: string;
    scope?: "team" | "named" | "public";
    capacity?: string;
    approval?: boolean;
    deadline?: string;
  },
): Promise<void> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(values.name);
  await page.getByTestId("event-start-input").fill(values.start ?? "2099-03-10");
  await page.getByTestId("event-end-input").fill(values.end ?? "2099-03-12");
  if (values.capacity !== undefined) await page.getByTestId("event-capacity-input").fill(values.capacity);
  if (values.approval) await page.getByTestId("event-approval-input").check();
  if (values.deadline !== undefined) await page.getByTestId("event-deadline-input").fill(values.deadline);
  await page.getByTestId(`event-scope-${values.scope ?? "public"}`).check();
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
}

test.describe("EVT-02 — attendance", () => {
  test("AC-28: the three fields sit after the dates and before the scope, empty and off by default", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openEvents(page);
    await page.getByTestId("events-new-button").click();

    const ids = await page
      .getByTestId("event-form")
      .locator("[data-testid]")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-testid")));
    const at = (id: string): number => ids.indexOf(id);
    expect(at("event-end-input")).toBeLessThan(at("event-capacity-input"));
    expect(at("event-capacity-input")).toBeLessThan(at("event-approval-input"));
    expect(at("event-approval-input")).toBeLessThan(at("event-deadline-input"));
    expect(at("event-deadline-input")).toBeLessThan(at("event-scope-team"));

    await expect(page.getByTestId("event-capacity-input")).toHaveValue("");
    await expect(page.getByTestId("event-approval-input")).not.toBeChecked();
    await expect(page.getByTestId("event-deadline-input")).toHaveValue("");
  });

  test("AC-1, AC-27, AC-28: the three values save, show on the detail page, and reopen in the edit form", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Offsite", capacity: "12", approval: true, deadline: "2099-03-05" });

    await expect(page.getByTestId("event-seats")).toHaveText("0 going · 12 seats");
    await expect(page.getByTestId("event-seats")).toHaveAttribute("data-capacity", "12");
    await expect(page.getByTestId("event-deadline")).toHaveText("Registration open until 5 Mar 2099");
    await expect(page.getByTestId("event-deadline")).toHaveAttribute("data-open", "true");
    await expect(page.getByTestId("event-join-button")).toHaveText("Request to join");
    await expect(page.getByTestId("event-attendees-empty")).toBeVisible();
    // AC-12: the creator takes no seat.
    await expect(page.getByTestId("event-seats")).toHaveAttribute("data-taken", "0");

    await page.getByTestId("event-edit-button").click();
    await expect(page.getByTestId("event-capacity-input")).toHaveValue("12");
    await expect(page.getByTestId("event-approval-input")).toBeChecked();
    await expect(page.getByTestId("event-deadline-input")).toHaveValue("2099-03-05");
  });

  test("AC-2, AC-3: a zero capacity and a deadline after the end are refused on the form", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openEvents(page);
    await page.getByTestId("events-new-button").click();
    await page.getByTestId("event-name-input").fill("Too small");
    await page.getByTestId("event-start-input").fill("2099-03-10");
    await page.getByTestId("event-end-input").fill("2099-03-10");
    await page.getByTestId("event-capacity-input").fill("0");
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-form-error")).toContainText("Seats");
    await expect(page).toHaveURL(/\/events\/new$/);

    await page.getByTestId("event-capacity-input").fill("");
    await page.getByTestId("event-deadline-input").fill("2099-03-11");
    await page.getByTestId("event-save").click();
    await expect(page.getByTestId("event-form-error")).toContainText("end date");
    await expect(page).toHaveURL(/\/events\/new$/);
  });

  test("AC-6, AC-8, AC-21: joining is immediate, the last seat makes it Full, and every reader sees who is coming", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Lunch for one", capacity: "1" });

    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Lunch for one");
    await expect(page.getByTestId("event-join-button")).toHaveText("Join");
    await page.getByTestId("event-join-button").click();
    await expect(page.getByTestId("event-my-status")).toHaveAttribute("data-status", "attending");
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
    await expect(page.getByTestId("event-seats")).toHaveText("1 going · Full");
    await expect(page.getByTestId("event-attendee")).toHaveCount(1);
    await expect(page.getByTestId("event-attendee")).toContainText(TEAMMATE.name);

    // A reader on another team: sees the list, and no join control on a full event.
    await switchTo(page, OTHER_TEAM.email);
    await openEvent(page, "Lunch for one");
    await expect(page.getByTestId("event-attendee")).toContainText(TEAMMATE.name);
    await expect(page.getByTestId("event-seats")).toHaveAttribute("data-taken", "1");
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
    await expect(page.getByTestId("event-my-status")).toHaveCount(0);
    await expect(page.getByTestId("event-attendee-remove")).toHaveCount(0);
  });

  test("AC-7, AC-16, AC-22: a request waits, the creator approves or rejects it, and the requester sees the outcome", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Workshop", approval: true, capacity: "5" });

    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Workshop");
    await page.getByTestId("event-join-button").click();
    await expect(page.getByTestId("event-my-status")).toHaveAttribute("data-status", "pending");
    await expect(page.getByTestId("event-attendee")).toHaveCount(0);
    await expect(page.getByTestId("event-requests")).toHaveCount(0);

    await switchTo(page, OTHER_TEAM.email);
    await openEvent(page, "Workshop");
    await page.getByTestId("event-join-button").click();
    await expect(page.getByTestId("event-my-status")).toHaveAttribute("data-status", "pending");

    await switchTo(page, MEMBER.email);
    await openEvent(page, "Workshop");
    const requests = page.getByTestId("event-request");
    await expect(requests).toHaveCount(2);
    await requests.filter({ hasText: TEAMMATE.name }).getByTestId("event-request-approve").click();
    await expect(page.getByTestId("event-attendee")).toContainText(TEAMMATE.name);
    await expect(page.getByTestId("event-seats")).toHaveText("1 going · 5 seats");
    await requests.filter({ hasText: OTHER_TEAM.name }).getByTestId("event-request-reject").click();
    await expect(page.getByTestId("event-requests")).toHaveCount(0);

    await switchTo(page, OTHER_TEAM.email);
    await openEvent(page, "Workshop");
    await expect(page.getByTestId("event-my-status")).toHaveAttribute("data-status", "rejected");
    // AC-19: rejected is final — no control to try again.
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
    await expect(page.getByTestId("event-leave-button")).toHaveCount(0);
  });

  test("AC-8: on a full approval event the approve control is disabled", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Tiny", approval: true, capacity: "1" });
    await page.getByTestId("event-join-button").click();
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Tiny");
    await page.getByTestId("event-join-button").click();

    await switchTo(page, MEMBER.email);
    await openEvent(page, "Tiny");
    await page
      .getByTestId("event-request")
      .filter({ hasText: MEMBER.name })
      .getByTestId("event-request-approve")
      .click();
    await expect(page.getByTestId("event-seats")).toHaveText("1 going · Full");
    await expect(
      page.getByTestId("event-request").filter({ hasText: TEAMMATE.name }).getByTestId("event-request-approve"),
    ).toBeDisabled();
  });

  test("AC-14, AC-29: leaving confirms, names the event, and cancelling changes nothing", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Picnic", capacity: "3" });
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Picnic");
    await page.getByTestId("event-join-button").click();
    await expect(page.getByTestId("event-seats")).toHaveAttribute("data-taken", "1");

    await page.getByTestId("event-leave-button").click();
    await expect(page.getByTestId("event-leave-modal")).toContainText("Picnic");
    await page.getByTestId("event-leave-cancel").click();
    await expect(page.getByTestId("event-leave-modal")).toHaveCount(0);
    await expect(page.getByTestId("event-my-status")).toHaveAttribute("data-status", "attending");

    await page.getByTestId("event-leave-button").click();
    await page.getByTestId("event-leave-confirm").click();
    await expect(page.getByTestId("event-my-status")).toHaveCount(0);
    await expect(page.getByTestId("event-seats")).toHaveAttribute("data-taken", "0");
    await expect(page.getByTestId("event-join-button")).toBeVisible();
  });

  test("AC-17, AC-29: an admin removes an attendee after a confirmation naming them", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Karaoke" });
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Karaoke");
    await page.getByTestId("event-join-button").click();
    await expect(page.getByTestId("event-attendee")).toHaveCount(1);

    await switchTo(page, ADMIN.email);
    await openEvent(page, "Karaoke");
    await page.getByTestId("event-attendee-remove").click();
    await expect(page.getByTestId("event-remove-modal")).toContainText(TEAMMATE.name);
    await page.getByTestId("event-remove-cancel").click();
    await expect(page.getByTestId("event-attendee")).toHaveCount(1);

    await page.getByTestId("event-attendee-remove").click();
    await page.getByTestId("event-remove-confirm").click();
    await expect(page.getByTestId("event-attendees-empty")).toBeVisible();

    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Karaoke");
    await expect(page.getByTestId("event-my-status")).toHaveAttribute("data-status", "removed");
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
  });

  test("AC-10: once registration has closed the page says so and offers no join", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Closed already", deadline: "2000-01-01" });
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Closed already");
    await expect(page.getByTestId("event-deadline")).toHaveText("Registration closed");
    await expect(page.getByTestId("event-deadline")).toHaveAttribute("data-open", "false");
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
  });

  test("AC-11: an admin outside an own-team event reads it and its list, but is offered no join", async ({ page }) => {
    await signIn(page, OTHER_TEAM.email);
    await createEvent(page, { name: "Their team only", scope: "team" });
    await switchTo(page, ADMIN.email);
    await openEvent(page, "Their team only");
    await expect(page.getByTestId("event-attendees")).toBeVisible();
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
  });
});
