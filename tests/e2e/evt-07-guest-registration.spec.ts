import { expect, test, type Page } from "@playwright/test";

// EVT-07 — guest registration. 01-plan.md § 2 AC-1..AC-17, § 2b, § 4.5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). Every refusal is asserted in
// `tests/guest-registration.test.ts`; this file asserts what a person SEES on the guest page, the
// manage page and the detail page.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-06-guest-link.spec.ts` records. So every page
// after the first is reached by a client-side navigation — `history.pushState` and a `popstate` —
// never by `goto`. Only the not-found journey, which needs no event, uses `goto`.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
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

async function openEvents(page: Page): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
}

async function openEvent(page: Page, name: string): Promise<void> {
  await openEvents(page);
  await page.getByTestId("event-row").filter({ hasText: name }).click();
  await expect(page.getByTestId("event-name")).toHaveText(name);
}

async function createEvent(
  page: Page,
  values: { name: string; capacity?: string; approval?: boolean; location?: string },
): Promise<void> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(values.name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
  if (values.location !== undefined) await page.getByTestId("event-location-input").fill(values.location);
  if (values.capacity !== undefined) await page.getByTestId("event-capacity-input").fill(values.capacity);
  if (values.approval) await page.getByTestId("event-approval-input").check();
  await page.getByTestId("event-scope-public").check();
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
}

/** Opens the event on screen to guests and returns the address the panel shows. */
async function openToGuests(page: Page): Promise<string> {
  await page.getByTestId("event-guest-open-button").click();
  const link = page.getByTestId("event-guest-link");
  await expect(link).toHaveValue(/\/guest\/[0-9a-f]{64}$/);
  return link.inputValue();
}

/** A client-side navigation: the router follows it and the mock's tables survive. */
async function navigate(page: Page, address: string): Promise<void> {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, new URL(address, "http://x").pathname);
}

async function signOut(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

/** Back from a guest page to the sign-in screen, without reloading. */
async function signInAgain(page: Page, email: string): Promise<void> {
  await navigate(page, "/");
  await fillSignIn(page, email);
}

async function registerAsGuest(page: Page, name: string, email: string): Promise<string> {
  await page.getByTestId("guest-register-name").fill(name);
  await page.getByTestId("guest-register-email").fill(email);
  await page.getByTestId("guest-register-submit").click();
  await expect(page.getByTestId("guest-registered")).toBeVisible();
  const link = page.getByTestId("guest-manage-link");
  await expect(link).toHaveValue(/\/guest\/registration\/[0-9a-f]{64}$/);
  return link.inputValue();
}

test.describe("EVT-07 — guest registration", () => {
  test("AC-1, AC-3, AC-11, AC-12, AC-14: a guest registers, keeps the link, reads it and cancels", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest supper", capacity: "5", location: "Hoi An" });
    const address = await openToGuests(page);
    await signOut(page);
    await navigate(page, address);

    await expect(page.getByTestId("guest-register-submit")).toHaveText("Register");
    const manage = await registerAsGuest(page, "Mai Anh", "mai@example.com");
    await expect(page.getByTestId("guest-registered-status")).toHaveAttribute("data-status", "attending");
    await expect(page.getByTestId("guest-registered")).toContainText("shown only once");
    await expect(page.getByTestId("guest-event-attendee")).toHaveText(["Mai Anh"]);
    await expect(page.getByTestId("guest-event-seats")).toHaveText("4 of 5 seats left");

    await page.getByTestId("guest-manage-copy-button").click();
    await expect(page.getByTestId("guest-manage-copied")).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(manage);

    // AC-3. Coming back to the guest page shows the form, not the link.
    await navigate(page, "/");
    await navigate(page, address);
    await expect(page.getByTestId("guest-register-name")).toBeVisible();
    await expect(page.getByTestId("guest-manage-link")).toHaveCount(0);

    // AC-11. The manage page.
    await navigate(page, manage);
    await expect(page.getByTestId("guest-registration-event")).toHaveText("Guest supper");
    await expect(page.getByTestId("guest-registration-location")).toContainText("Hoi An");
    await expect(page.getByTestId("guest-registration-name")).toHaveText("Mai Anh");
    await expect(page.getByTestId("guest-registration-status")).toHaveAttribute("data-status", "attending");
    await expect(page.getByTestId("guest-registration")).not.toContainText("mai@example.com");

    // AC-12. Keep it, then cancel it.
    await page.getByTestId("guest-registration-cancel-button").click();
    await page.getByTestId("guest-cancel-cancel").click();
    await expect(page.getByTestId("guest-registration-status")).toHaveAttribute("data-status", "attending");
    await page.getByTestId("guest-registration-cancel-button").click();
    await page.getByTestId("guest-cancel-confirm").click();
    await expect(page.getByTestId("guest-registration-status")).toHaveAttribute("data-status", "cancelled");
    await expect(page.getByTestId("guest-registration-cancel-button")).toHaveCount(0);

    await navigate(page, address);
    await expect(page.getByTestId("guest-event-attendees-empty")).toBeVisible();
  });

  test("AC-4, AC-5: a bad field and a repeated email are named, and nothing is saved", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest checks" });
    const address = await openToGuests(page);
    // EVT-13 AC-1. The creator would be sent to the event page; a guest registers signed out.
    await signOut(page);
    await navigate(page, address);

    await page.getByTestId("guest-register-email").fill("ok@example.com");
    await page.getByTestId("guest-register-submit").click();
    await expect(page.getByTestId("guest-register-error")).toContainText("your name");
    await page.getByTestId("guest-register-name").fill("Lan");
    await page.getByTestId("guest-register-email").fill("not-an-email");
    await page.getByTestId("guest-register-submit").click();
    await expect(page.getByTestId("guest-register-error")).toContainText("email");
    await expect(page.getByTestId("guest-event-attendees-empty")).toBeVisible();

    await registerAsGuest(page, "Lan", "lan@example.com");
    await navigate(page, "/");
    await navigate(page, address);
    await page.getByTestId("guest-register-name").fill("Lan again");
    await page.getByTestId("guest-register-email").fill(" LAN@example.com ");
    await page.getByTestId("guest-register-submit").click();
    await expect(page.getByTestId("guest-register-error")).toHaveText(
      "That email is already registered for this event.",
    );
  });

  test("AC-2, AC-15, AC-16: a request waits; the creator sees the email and approves", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest gated", approval: true });
    const address = await openToGuests(page);
    await signOut(page);
    await navigate(page, address);

    await expect(page.getByTestId("guest-register-submit")).toHaveText("Request to join");
    const manage = await registerAsGuest(page, "Asker", "asker@example.com");
    await expect(page.getByTestId("guest-registered-status")).toHaveAttribute("data-status", "pending");
    await expect(page.getByTestId("guest-event-attendee")).toHaveCount(0);

    await signInAgain(page, MEMBER.email);
    await openEvent(page, "Guest gated");
    const request = page.getByTestId("event-guest-request");
    await expect(request).toContainText("Asker");
    await expect(request).toContainText("Guest");
    await expect(request.getByTestId("event-guest-email")).toHaveText("asker@example.com");
    await request.getByTestId("event-guest-request-approve").click();
    const attendee = page.getByTestId("event-guest-attendee");
    await expect(attendee).toContainText("Asker");
    await expect(page.getByTestId("event-seats")).toHaveAttribute("data-taken", "1");

    // AC-15. A teammate sees the guest and no email.
    await page.getByTestId("home-sign-out").click();
    await fillSignIn(page, TEAMMATE.email);
    await openEvent(page, "Guest gated");
    await expect(page.getByTestId("event-guest-attendee")).toContainText("Asker");
    await expect(page.getByTestId("event-guest-email")).toHaveCount(0);
    await expect(page.getByTestId("event-guest-attendee-remove")).toHaveCount(0);

    await navigate(page, manage);
    await expect(page.getByTestId("guest-registration-status")).toHaveAttribute("data-status", "attending");
  });

  test("AC-17: the creator removes a guest after confirming", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest removal", capacity: "3" });
    const address = await openToGuests(page);
    // EVT-13 AC-1. The creator would be sent to the event page; the guest registers signed out.
    await signOut(page);
    await navigate(page, address);
    const manage = await registerAsGuest(page, "Leaving", "leaving@example.com");

    await signInAgain(page, MEMBER.email);
    await navigate(page, "/events");
    await page.getByTestId("event-row").filter({ hasText: "Guest removal" }).click();
    const attendee = page.getByTestId("event-guest-attendee");
    await expect(attendee).toContainText("Leaving");
    await attendee.getByTestId("event-guest-attendee-remove").click();
    await expect(page.getByTestId("event-guest-remove-modal")).toContainText("Remove Leaving?");
    await page.getByTestId("event-guest-remove-cancel").click();
    await expect(attendee).toBeVisible();
    await attendee.getByTestId("event-guest-attendee-remove").click();
    await page.getByTestId("event-guest-remove-confirm").click();
    await expect(page.getByTestId("event-guest-attendee")).toHaveCount(0);

    await navigate(page, manage);
    await expect(page.getByTestId("guest-registration-status")).toHaveAttribute("data-status", "removed");
    await expect(page.getByTestId("guest-registration-cancel-button")).toHaveCount(0);
  });

  test("AC-13: an unknown or malformed manage token is one not-found page", async ({ page }) => {
    for (const token of ["0".repeat(64), "not-a-token"]) {
      await page.goto(`/guest/registration/${token}`);
      await expect(page.getByTestId("guest-registration-not-found")).toHaveText(
        "This link does not work. Check that you copied the whole address.",
      );
      await expect(page.getByTestId("guest-registration")).toHaveCount(0);
    }
  });
});
