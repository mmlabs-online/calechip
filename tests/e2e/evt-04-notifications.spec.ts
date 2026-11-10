import { expect, test, type Page } from "@playwright/test";

// EVT-04 — the bell and its panel. 01-plan.md § 2 AC-13 to AC-16, § 2b, § 4.5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). Every recipient rule and every denial is asserted
// in `tests/notifications.test.ts`; this file asserts what a person SEES in the top bar.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-01-events.spec.ts` records. So a journey that
// creates an event and then looks at it as somebody else moves by clicking, and the second person is
// reached by signing out and in on the same document.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip) and linh@ is
// FIXTURE_APPROVED_MEMBER on the same team.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com", name: "Thành viên" };
const TEAMMATE = { email: "linh@example.com" };

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

/** An own-team event, created through the form by clicking. Ends on its detail page. */
async function createTeamEvent(page: Page, name: string): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
  await page.getByTestId("event-scope-team").check();
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
}

test.describe("EVT-04 — notifications", () => {
  test("AC-13, AC-14: a teammate sees the count, opens the item, lands on the event, and the count drops", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const bell = page.getByTestId("notification-bell");
    await expect(bell).toBeVisible();
    await expect(bell).toHaveAttribute("data-unread", "0");
    await expect(page.getByTestId("notification-unread-count")).toHaveCount(0);

    await createTeamEvent(page, "Team Retro");
    // The actor is not notified of their own event.
    await expect(bell).toHaveAttribute("data-unread", "0");

    await switchTo(page, TEAMMATE.email);
    await expect(bell).toHaveAttribute("data-unread", "1");
    await expect(page.getByTestId("notification-unread-count")).toHaveText("1");

    await bell.click();
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    const panel = page.getByTestId("notification-panel");
    await expect(panel).toBeVisible();
    const item = panel.getByTestId("notification-item");
    await expect(item).toHaveCount(1);
    await expect(item).toHaveAttribute("data-kind", "event_created");
    await expect(item).toHaveAttribute("data-read", "false");
    await expect(item).toContainText(`${MEMBER.name} announced Team Retro.`);

    const eventId = await item.getAttribute("data-event-id");
    expect(eventId).toBeTruthy();
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`));
    await expect(page.getByTestId("event-name")).toHaveText("Team Retro");
    await expect(panel).toHaveCount(0);
    await expect(bell).toHaveAttribute("data-unread", "0");
    await expect(page.getByTestId("notification-unread-count")).toHaveCount(0);

    // Read now, and still listed.
    await bell.click();
    await expect(panel.getByTestId("notification-item")).toHaveAttribute("data-read", "true");
  });

  test("AC-15: mark all read clears the count and then is absent", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createTeamEvent(page, "Standup party");
    await createTeamEvent(page, "Planning day");
    await switchTo(page, TEAMMATE.email);

    const bell = page.getByTestId("notification-bell");
    await expect(bell).toHaveAttribute("data-unread", "2");
    await bell.click();
    const panel = page.getByTestId("notification-panel");
    // Newest first.
    await expect(panel.getByTestId("notification-item").first()).toContainText("Planning day");
    await panel.getByTestId("notification-mark-all-read").click();

    await expect(bell).toHaveAttribute("data-unread", "0");
    await expect(page.getByTestId("notification-unread-count")).toHaveCount(0);
    await expect(panel.getByTestId("notification-mark-all-read")).toHaveCount(0);
    await expect(panel.locator('[data-testid="notification-item"][data-read="false"]')).toHaveCount(0);
  });

  test("AC-14, AC-16: the empty state, and Escape, the bell and a press outside each close the panel", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const bell = page.getByTestId("notification-bell");
    const panel = page.getByTestId("notification-panel");

    await bell.click();
    await expect(panel.getByTestId("notification-empty")).toBeVisible();
    await expect(panel.getByTestId("notification-item")).toHaveCount(0);
    await expect(panel.getByTestId("notification-mark-all-read")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);

    await bell.click();
    await expect(panel).toBeVisible();
    await bell.click();
    await expect(panel).toHaveCount(0);

    await bell.click();
    await expect(panel).toBeVisible();
    await page.getByTestId("shell-topbar").click({ position: { x: 5, y: 5 } });
    await expect(panel).toHaveCount(0);
  });
});
