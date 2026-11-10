import { expect, test, type Page } from "@playwright/test";

// EVT-06 — the guest link. 01-plan.md § 2 AC-1..AC-18, § 2b, § 4.5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). Every refusal is asserted in
// `tests/guest-link.test.ts`; this file asserts what a person SEES on the detail page and the guest
// page.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-01-events.spec.ts` records. So the guest page of
// an event created in the test is reached by a client-side navigation — `history.pushState` and a
// `popstate`, which the router follows without reloading — never by `goto`. Only the not-found
// journeys, which need no event, use `goto`.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
// FIXTURE_APPROVED_MEMBER on the same team, quan@ is FIXTURE_ADMIN, and chi@other is
// FIXTURE_OTHER_TEAM_MEMBER.
//
// EVT-13 — ADR-061 decision 8 replaces AC-16 for a signed-in reader of the event: they are taken to
// the event page. AC-10's empty page is now asserted signed out; a signed-in non-reader keeps the
// guest page.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com", name: "Thành viên" };
const TEAMMATE = { email: "linh@example.com", name: "Đã duyệt" };
const ADMIN = { email: "quan@example.com" };
const OTHER_TEAM = { email: "chi@other.example.com" };

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

async function createEvent(
  page: Page,
  values: {
    name: string;
    capacity?: string;
    location?: string;
    description?: string;
    scope?: "team" | "named" | "public";
  },
): Promise<void> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(values.name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
  if (values.location !== undefined) await page.getByTestId("event-location-input").fill(values.location);
  if (values.description !== undefined) {
    await page.getByTestId("event-description-input").fill(values.description);
  }
  if (values.capacity !== undefined) await page.getByTestId("event-capacity-input").fill(values.capacity);
  await page.getByTestId(`event-scope-${values.scope ?? "public"}`).check();
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
  }, new URL(address).pathname);
}

async function meta(page: Page, name: string): Promise<string | null> {
  return page.evaluate(
    (n) => document.head.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? null,
    name,
  );
}

test.describe("EVT-06 — the guest link", () => {
  test("AC-1, AC-8: the creator opens it, sees the full address, and copies it", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest copy" });

    await expect(page.getByTestId("event-guest-panel")).toBeVisible();
    await expect(page.getByTestId("event-guest-link")).toHaveCount(0);
    const address = await openToGuests(page);
    const origin = new URL(page.url()).origin;
    expect(address).toMatch(new RegExp(`^${origin}/guest/[0-9a-f]{64}$`));

    await page.getByTestId("event-guest-copy-button").click();
    await expect(page.getByTestId("event-guest-copied")).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  });

  test("AC-8: a refused clipboard asks the reader to copy it themselves, and the address stays", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest no clipboard" });
    const address = await openToGuests(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
    });
    await page.getByTestId("event-guest-copy-button").click();
    await expect(page.getByTestId("event-guest-copied")).toContainText("copy it yourself");
    await expect(page.getByTestId("event-guest-link")).toHaveValue(address);
  });

  test("AC-9, AC-10, AC-15: signed out, the guest page shows the event and who is coming, and is not indexed", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, {
      name: "Guest picnic",
      capacity: "5",
      location: "Tao Dan park",
      description: "Bring a hat",
    });
    await page.getByTestId("event-join-button").click();
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Guest picnic");
    await page.getByTestId("event-join-button").click();
    await switchTo(page, MEMBER.email);
    await openEvent(page, "Guest picnic");
    const address = await openToGuests(page);

    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await navigate(page, address);

    const card = page.getByTestId("guest-event");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);
    await expect(page.getByTestId("nav-events-link")).toHaveCount(0);

    const order = await card
      .locator("[data-testid]")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-testid")));
    const at = (id: string): number => order.indexOf(id);
    for (const [a, b] of [
      ["guest-event-name", "guest-event-dates"],
      ["guest-event-dates", "guest-event-location"],
      ["guest-event-location", "guest-event-description"],
      ["guest-event-description", "guest-event-seats"],
      ["guest-event-seats", "guest-event-attendees"],
    ] as const) {
      expect(at(a)).toBeGreaterThanOrEqual(0);
      expect(at(a)).toBeLessThan(at(b));
    }
    await expect(page.getByTestId("guest-event-name")).toHaveText("Guest picnic");
    await expect(page.getByTestId("guest-event-location")).toContainText("Tao Dan park");
    await expect(page.getByTestId("guest-event-description")).toHaveText("Bring a hat");
    await expect(page.getByTestId("guest-event-seats")).toHaveText("3 of 5 seats left");
    await expect(page.getByTestId("guest-event-attendee")).toHaveText([MEMBER.name, TEAMMATE.name]);

    expect(await meta(page, "robots")).toBe("noindex, nofollow");
    expect(await meta(page, "referrer")).toBe("no-referrer");
    // AC-12. Nothing but those fields: no creator, scope or avatar on the page.
    await expect(page.getByTestId("event-creator")).toHaveCount(0);
    await expect(page.getByTestId("event-scope")).toHaveCount(0);
    await expect(card.locator("img")).toHaveCount(0);

    // AC-15. Leaving takes both tags with it.
    await page.goBack();
    await expect(page.getByTestId("guest-event")).toHaveCount(0);
    expect(await meta(page, "robots")).toBeNull();
    expect(await meta(page, "referrer")).toBeNull();
  });

  test("AC-10: signed out, a page with nobody joined yet", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest empty" });
    const address = await openToGuests(page);
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await navigate(page, address);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page).toHaveURL(/\/guest\/[0-9a-f]{64}$/);
    await expect(page.getByTestId("nav-events-link")).toHaveCount(0);
    await expect(page.getByTestId("guest-event-seats")).toHaveText("No seat limit");
    await expect(page.getByTestId("guest-event-attendees-empty")).toBeVisible();
    await expect(page.getByTestId("guest-event-location")).toHaveCount(0);
    await expect(page.getByTestId("guest-event-description")).toHaveCount(0);
  });

  test("EVT-13 AC-1: a signed-in reader is taken to the event page, and Back does not return to the link", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest redirect" });
    const detail = page.url();
    const address = await openToGuests(page);
    await navigate(page, address);
    await expect(page).toHaveURL(detail);
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-name")).toHaveText("Guest redirect");
    await expect(page.getByTestId("guest-event")).toHaveCount(0);

    // The redirect replaced the guest link's history entry: Back lands where the reader was before.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/guest\//);
    await expect(page.getByTestId("guest-event")).toHaveCount(0);
  });

  test("EVT-13 AC-3: a signed-in member who cannot read the event sees the guest page, with no redirect", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest own team", scope: "team" });
    const address = await openToGuests(page);
    await switchTo(page, OTHER_TEAM.email);
    await navigate(page, address);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page.getByTestId("guest-event-name")).toHaveText("Guest own team");
    await expect(page).toHaveURL(/\/guest\/[0-9a-f]{64}$/);
    await expect(page.getByTestId("event-detail")).toHaveCount(0);
    await expect(page.getByTestId("nav-events-link")).toHaveCount(0);
  });

  test("AC-3, AC-18: a reader who may not manage it sees no panel; AC-2: an admin does", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest panel" });
    await openToGuests(page);

    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Guest panel");
    await expect(page.getByTestId("event-attendance")).toBeVisible();
    await expect(page.getByTestId("event-guest-panel")).toHaveCount(0);
    await expect(page.getByTestId("event-guest-link")).toHaveCount(0);

    await switchTo(page, ADMIN.email);
    await openEvent(page, "Guest panel");
    await expect(page.getByTestId("event-guest-panel")).toBeVisible();
    await expect(page.getByTestId("event-guest-link")).toHaveValue(/\/guest\/[0-9a-f]{64}$/);
  });

  test("AC-4, AC-5: cancel keeps it; closing kills the old address; reopening makes a new one", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Guest close" });
    const first = await openToGuests(page);

    await page.getByTestId("event-guest-close-button").click();
    await expect(page.getByTestId("event-guest-close-modal")).toContainText(
      "stop working for everyone who has it",
    );
    await page.getByTestId("event-guest-close-cancel").click();
    await expect(page.getByTestId("event-guest-link")).toHaveValue(first);

    await page.getByTestId("event-guest-close-button").click();
    await page.getByTestId("event-guest-close-confirm").click();
    await expect(page.getByTestId("event-guest-link")).toHaveCount(0);
    await expect(page.getByTestId("event-guest-open-button")).toBeVisible();

    const second = await openToGuests(page);
    expect(second).not.toBe(first);

    await navigate(page, first);
    await expect(page.getByTestId("guest-event-not-found")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("event-detail")).toBeVisible();
    // EVT-13 AC-1. The creator would now be sent to the event page; the guest page is a signed-out view.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await navigate(page, second);
    await expect(page.getByTestId("guest-event")).toBeVisible();
  });

  test("AC-13, AC-15: an unknown or malformed token is one not-found page, also not indexed", async ({ page }) => {
    const texts: string[] = [];
    for (const path of [`/guest/${"0".repeat(64)}`, "/guest/not-a-token"]) {
      await page.goto(path);
      const missing = page.getByTestId("guest-event-not-found");
      await expect(missing).toBeVisible();
      await expect(missing.locator("a")).toHaveCount(0);
      await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);
      texts.push((await missing.textContent()) ?? "");
      expect(await meta(page, "robots")).toBe("noindex, nofollow");
      expect(await meta(page, "referrer")).toBe("no-referrer");
    }
    expect(texts[0]).toBe(texts[1]);
  });
});
