import { expect, test, type Locator, type Page } from "@playwright/test";

// UIE-12 — the way to join an event stays in view while its page scrolls. 01-plan.md § 2 AC-1..AC-9,
// AC-7G, AC-11..AC-13, AC-15; § 2b.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). **A `page.goto` RESETS THE MOCK'S TABLES**, as
// `evt-06-guest-link.spec.ts` records, so every page after the first is reached client-side.
//
// **A LONG DESCRIPTION IS WRITTEN STRAIGHT TO THE DATASTORE**, through `window.__calechipMockSeam`,
// as `evt-10-description.spec.ts:91-115` does — copied, not imported, because that file is frozen
// (AC-14). Typing forty paragraphs into the editor would test the editor.
//
// Widths: WIDE is 1280×720, the project's own viewport and the first at which `xl` applies; NARROW
// is 800×720, where the 216 px sidebar leaves the column under the report bubble (AC-8).
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER and linh@ FIXTURE_APPROVED_MEMBER, both
// on team CaleChip; chi@other is on the other team; quan@ is an admin on CaleChip.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com" };
const TEAMMATE = { email: "linh@example.com" };
const OTHER_TEAM = { email: "chi@other.example.com" };
const ADMIN = { email: "quan@example.com" };

const WIDE = { width: 1280, height: 720 };
const NARROW = { width: 800, height: 720 };

/** Forty paragraphs — many times a 720 px viewport at any width tested here. */
const LONG = Array.from(
  { length: 40 },
  (_, i) => `<p>Paragraph ${i + 1}. Bring a hat, some water and a friend; the walk is long and the view is worth it.</p>`,
).join("");

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
  values: { name: string; scope?: "team" | "public"; capacity?: string; deadline?: string },
): Promise<string> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(values.name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
  if (values.capacity !== undefined) await page.getByTestId("event-capacity-input").fill(values.capacity);
  if (values.deadline !== undefined) await page.getByTestId("event-deadline-input").fill(values.deadline);
  await page.getByTestId(`event-scope-${values.scope ?? "public"}`).check();
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
  const match = /\/events\/([^/?#]+)$/.exec(new URL(page.url()).pathname);
  expect(match).not.toBeNull();
  return match![1]!;
}

/** ADR-005's direct call: every field as it is, the description replaced. */
async function writeStraight(page: Page, id: string, description: string): Promise<void> {
  const ok = await page.evaluate(
    async ([eventId, html]) => {
      const seam = window.__calechipMockSeam!;
      const event = await seam.getEvent(eventId);
      if (!event) return false;
      const inviteeIds = await seam.listEventInvitees(eventId);
      const result = await seam.updateEvent(eventId, {
        name: event.name,
        description: html,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
        scope: event.scope,
        inviteeIds,
        capacity: event.capacity,
        requiresApproval: event.requiresApproval,
        registrationDeadline: event.registrationDeadline,
      });
      return result.ok;
    },
    [id, description] as const,
  );
  expect(ok).toBe(true);
}

/** A long event, created by MEMBER and reopened so the page reads the description. */
async function longEvent(page: Page, name: string, values: { capacity?: string } = {}): Promise<string> {
  const id = await createEvent(page, { name, ...values });
  await writeStraight(page, id, LONG);
  await openEvent(page, name);
  return id;
}

async function openToGuests(page: Page): Promise<string> {
  await page.getByTestId("event-guest-open-button").click();
  const link = page.getByTestId("event-guest-link");
  await expect(link).toHaveValue(/\/guest\/[0-9a-f]{64}$/);
  return link.inputValue();
}

async function navigate(page: Page, address: string): Promise<void> {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, new URL(address, "http://x").pathname);
}

/** Scrolls to the foot of the page and back to its head, asserting each locator in view at both. */
async function inViewAtBothEnds(page: Page, foot: string, head: string, locators: Locator[]): Promise<void> {
  await page.getByTestId(foot).scrollIntoViewIfNeeded();
  for (const l of locators) await expect(l).toBeInViewport();
  await page.getByTestId(head).scrollIntoViewIfNeeded();
  for (const l of locators) await expect(l).toBeInViewport();
}

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.describe("UIE-12 — the member page, /events/:id", () => {
  test("AC-1, AC-2, AC-15: the join button is in view at both ends, wide and narrow, once, in the bar", async ({
    page,
  }) => {
    await signIn(page, MEMBER.email);
    await longEvent(page, "Long walk");
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Long walk");

    const button = page.getByTestId("event-join-button");
    for (const size of [WIDE, NARROW]) {
      await page.setViewportSize(size);
      await inViewAtBothEnds(page, "event-attendees", "event-name", [button]);
      // AC-15. One element restyled, never two shown and hidden.
      await expect(page.getByTestId("event-join-bar")).toHaveCount(1);
      await expect(button).toHaveCount(1);
    }

    // AC-2.
    await expect(page.getByTestId("event-join-bar").getByTestId("event-join-button")).toHaveCount(1);
    await expect(page.getByTestId("event-attendance").getByTestId("event-join-button")).toHaveCount(0);
    for (const id of ["event-seats", "event-deadline", "event-attendees"]) {
      await expect(page.getByTestId("event-attendance").getByTestId(id)).toHaveCount(1);
    }
  });

  test("AC-3: after joining, the status is in the bar and in view", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await longEvent(page, "Long walk");
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Long walk");
    await page.setViewportSize(NARROW);

    await page.getByTestId("event-join-button").click();
    const bar = page.getByTestId("event-join-bar");
    await expect(bar.getByTestId("event-my-status")).toHaveAttribute("data-status", "attending");
    await expect(bar.getByTestId("event-leave-button")).toBeVisible();
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);

    await page.getByTestId("event-attendees").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("event-my-status")).toBeInViewport();
  });

  test("AC-4: a reader in the audience on a closed event is told so in the bar", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Closed already", deadline: "2000-01-01" });
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Closed already");

    await expect(page.getByTestId("event-join-bar").getByTestId("event-join-closed")).toHaveText(
      "Registration closed",
    );
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
  });

  test("AC-5: a reader in the audience on a full event without approval is told so in the bar", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "Lunch for one", capacity: "1" });
    await page.getByTestId("event-join-button").click();
    await expect(page.getByTestId("event-my-status")).toHaveAttribute("data-status", "attending");
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Lunch for one");

    await expect(page.getByTestId("event-join-bar").getByTestId("event-join-full")).toContainText(
      "This event is full.",
    );
    await expect(page.getByTestId("event-join-button")).toHaveCount(0);
  });

  test("AC-6: no bar for a reader with nothing to do, and the page is one column as before", async ({ page }) => {
    await signIn(page, OTHER_TEAM.email);
    await createEvent(page, { name: "Their team only", scope: "team" });
    await switchTo(page, ADMIN.email);
    await page.setViewportSize(WIDE);
    await openEvent(page, "Their team only");

    await expect(page.getByTestId("event-attendees")).toBeVisible();
    await expect(page.getByTestId("event-join-bar")).toHaveCount(0);
    // `max-w-xl` is 36 rem.
    expect((await box(page.getByTestId("event-detail"))).width).toBeLessThanOrEqual(576);
  });

  test("AC-7: wide puts the bar beside the article; narrow puts it under", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await longEvent(page, "Long walk");
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Long walk");

    const article = page.getByTestId("event-detail");
    const bar = page.getByTestId("event-join-bar");

    await page.setViewportSize(WIDE);
    await page.getByTestId("event-name").scrollIntoViewIfNeeded();
    let a = await box(article);
    let b = await box(bar);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(1);

    await page.setViewportSize(NARROW);
    a = await box(article);
    b = await box(bar);
    expect(b.y).toBeGreaterThan(a.y);
    expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(1);
  });

  test("AC-8: the bar's controls never sit under the report-issue bubble", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await longEvent(page, "Long walk");
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "Long walk");
    const bubble = page.getByTestId("report-issue-bubble");

    for (const size of [NARROW, WIDE]) {
      await page.setViewportSize(size);
      await page.getByTestId("event-attendees").scrollIntoViewIfNeeded();
      expect(intersects(await box(page.getByTestId("event-join-button")), await box(bubble))).toBe(false);
    }

    await page.getByTestId("event-join-button").click();
    await expect(page.getByTestId("event-leave-button")).toBeVisible();
    for (const size of [NARROW, WIDE]) {
      await page.setViewportSize(size);
      await page.getByTestId("event-attendees").scrollIntoViewIfNeeded();
      expect(intersects(await box(page.getByTestId("event-leave-button")), await box(bubble))).toBe(false);
    }
  });

  test("AC-9: a refused join is reported in the bar", async ({ page }) => {
    // Q2. The reader's page is drawn with a free seat; a guest takes it underneath, through the call
    // the guest link allows anyone to make.
    await signIn(page, MEMBER.email);
    await createEvent(page, { name: "One seat left", capacity: "1" });
    const address = await openToGuests(page);
    const token = new URL(address, "http://x").pathname.split("/").pop()!;
    await switchTo(page, TEAMMATE.email);
    await openEvent(page, "One seat left");
    await expect(page.getByTestId("event-join-button")).toBeVisible();

    const ok = await page.evaluate(
      async (t) => (await window.__calechipMockSeam!.registerGuest(t, "Mai", "mai@guest.example.org")).ok,
      token,
    );
    expect(ok).toBe(true);
    await page.getByTestId("event-join-button").click();

    const error = page.getByTestId("event-join-bar").getByTestId("event-join-error");
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
    await expect(page.getByTestId("event-my-status")).toHaveCount(0);
  });
});

test.describe("UIE-12 — the guest page, /guest/:token", () => {
  async function openLongGuestPage(page: Page): Promise<void> {
    await signIn(page, MEMBER.email);
    await longEvent(page, "Long picnic");
    const address = await openToGuests(page);
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await navigate(page, address);
    await expect(page.getByTestId("guest-event")).toBeVisible();
  }

  test("AC-11, AC-12, AC-15: the form is in view at both ends, wide and narrow, once, outside the card", async ({
    page,
  }) => {
    await openLongGuestPage(page);
    const controls = ["guest-register-name", "guest-register-email", "guest-register-submit"].map((id) =>
      page.getByTestId(id),
    );

    for (const size of [WIDE, NARROW]) {
      await page.setViewportSize(size);
      await inViewAtBothEnds(page, "guest-event-attendees", "guest-event-name", controls);
      await expect(page.getByTestId("guest-join-bar")).toHaveCount(1);
      await expect(page.getByTestId("guest-register-submit")).toHaveCount(1);
    }

    // AC-12.
    await expect(page.getByTestId("guest-join-bar").getByTestId("guest-register")).toHaveCount(1);
    await expect(page.getByTestId("guest-event").getByTestId("guest-register")).toHaveCount(0);
  });

  test("AC-7G: wide puts the block beside the card; narrow puts it under", async ({ page }) => {
    await openLongGuestPage(page);
    const card = page.getByTestId("guest-event");
    const bar = page.getByTestId("guest-join-bar");

    await page.setViewportSize(WIDE);
    await page.getByTestId("guest-event-name").scrollIntoViewIfNeeded();
    let a = await box(card);
    let b = await box(bar);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(1);

    await page.setViewportSize(NARROW);
    a = await box(card);
    b = await box(bar);
    expect(b.y).toBeGreaterThan(a.y);
    expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(1);
  });

  test("AC-13: after registering, the receipt stays in the block and in view", async ({ page }) => {
    await openLongGuestPage(page);
    await page.setViewportSize(NARROW);

    await page.getByTestId("guest-register-name").fill("Mai");
    await page.getByTestId("guest-register-email").fill("mai@guest.example.org");
    await page.getByTestId("guest-register-submit").click();

    await expect(page.getByTestId("guest-join-bar").getByTestId("guest-registered")).toBeVisible();
    await page.getByTestId("guest-event-attendees").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("guest-manage-link")).toBeInViewport();
  });
});

