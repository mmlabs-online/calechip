import { expect, test, type Locator, type Page } from "@playwright/test";

// EVT-14 — a signed-out reader of a guest link is offered sign-in and sign-up, and signing in returns
// them to the event. 01-plan.md § 2 AC-1..AC-12; § 2b; § 4.4.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). **A `page.goto` RESETS THE MOCK'S TABLES**, as
// `evt-06-guest-link.spec.ts` records, so the guest page of an event created in the test is reached
// client-side, and a RELOAD is not available to AC-6: it would empty the datastore and the token with
// it. AC-6's "shown again on reload" is asserted as what a reload is to this page — a remount — by
// leaving the address and coming back to it. Only the not-found journeys use `goto`.
//
// AC-9's refusal list is asserted value by value in `tests/return-to.test.ts`; this file drives the
// route that applies it, with one hostile value of each shape.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER (team CaleChip), linh@ is
// FIXTURE_APPROVED_MEMBER on the same team, chi@other is FIXTURE_OTHER_TEAM_MEMBER, and hoa@ is
// FIXTURE_MEMBER_LESS — a session with no member row.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com" };
const TEAMMATE = { email: "linh@example.com" };
const OTHER_TEAM = { email: "chi@other.example.com" };
const MEMBER_LESS = { email: "hoa@example.com" };

// AC-5's two viewports.
const NARROW = { width: 390, height: 844 };
const WIDE = { width: 1440, height: 900 };

/** Forty paragraphs — many times either viewport. */
const LONG = Array.from(
  { length: 40 },
  (_, i) => `<p>Paragraph ${i + 1}. Bring a hat, some water and a friend; the walk is long and the view is worth it.</p>`,
).join("");

async function submitSignIn(page: Page, email: string): Promise<void> {
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await submitSignIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function signOut(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

async function openEvents(page: Page): Promise<void> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
}

async function createEvent(page: Page, values: { name: string; scope?: "team" | "public" }): Promise<string> {
  await openEvents(page);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(values.name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
  await page.getByTestId(`event-scope-${values.scope ?? "public"}`).check();
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
  const match = /\/events\/([^/?#]+)$/.exec(new URL(page.url()).pathname);
  expect(match).not.toBeNull();
  return match![1]!;
}

/** ADR-005's direct call: every field as it is, the description replaced — as `uie-12-sticky-join.spec.ts`. */
async function writeLongDescription(page: Page, id: string): Promise<void> {
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
    [id, LONG] as const,
  );
  expect(ok).toBe(true);
}

async function openToGuests(page: Page): Promise<string> {
  await page.getByTestId("event-guest-open-button").click();
  const link = page.getByTestId("event-guest-link");
  await expect(link).toHaveValue(/\/guest\/[0-9a-f]{64}$/);
  return new URL(await link.inputValue()).pathname;
}

/** A client-side navigation: the router follows it without reloading, so the mock keeps its tables. */
async function navigate(page: Page, path: string): Promise<void> {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/**
 * An event created by MEMBER, open to guests, and its guest page reached signed out. Returns the
 * event's id and the guest page's path.
 */
async function guestPageSignedOut(
  page: Page,
  values: { name: string; scope?: "team" | "public"; long?: boolean },
): Promise<{ id: string; path: string }> {
  await signIn(page, MEMBER.email);
  const id = await createEvent(page, values);
  if (values.long) {
    await writeLongDescription(page, id);
    // Reopened, so the detail page — and the guest page after it — reads the description.
    await openEvents(page);
    await page.getByTestId("event-row").filter({ hasText: values.name }).click();
    await expect(page.getByTestId("event-detail")).toBeVisible();
  }
  const path = await openToGuests(page);
  await signOut(page);
  await navigate(page, path);
  await expect(page.getByTestId("guest-event")).toBeVisible();
  return { id, path };
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

/** Everything the dismissal could have written to: AC-6. */
async function persisted(page: Page): Promise<string> {
  const stores = await page.evaluate(() =>
    JSON.stringify({
      local: Object.entries(localStorage).sort(),
      session: Object.entries(sessionStorage).sort(),
      cookie: document.cookie,
      url: window.location.href,
    }),
  );
  return stores;
}

test.describe("EVT-14 — the prompt", () => {
  test("AC-1: a signed-out reader is offered both ways in, once, with the approval sentence", async ({ page }) => {
    await guestPageSignedOut(page, { name: "Open picnic" });

    const prompt = page.getByTestId("guest-auth-prompt");
    await expect(prompt).toHaveCount(1);
    await expect(prompt).toBeVisible();
    await expect(prompt.getByTestId("guest-auth-prompt-signin")).toHaveText("Sign in");
    await expect(prompt.getByTestId("guest-auth-prompt-signup")).toHaveText("Sign up");
    await expect(prompt).toContainText("New accounts are approved by an admin before they can be used.");
  });

  test("AC-2: a signed-in member who cannot read the event is not offered it, and sees the same page otherwise", async ({
    page,
  }) => {
    const { path } = await guestPageSignedOut(page, { name: "Team only", scope: "team" });
    const signedOutIds = await page
      .locator("[data-testid]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));

    await navigate(page, "/");
    await submitSignIn(page, OTHER_TEAM.email);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await navigate(page, path);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page.getByTestId("guest-auth-prompt")).toHaveCount(0);

    // Exactly one element differs — the prompt and its three controls.
    const signedInIds = await page
      .locator("[data-testid]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(signedOutIds.filter((id) => !id!.startsWith("guest-auth-prompt"))).toEqual(signedInIds);
  });

  test("AC-2: a member-less session is not offered it either", async ({ page }) => {
    const { path } = await guestPageSignedOut(page, { name: "Open picnic" });
    await navigate(page, "/");
    await submitSignIn(page, MEMBER_LESS.email);
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();
    await navigate(page, path);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page.getByTestId("guest-auth-prompt")).toHaveCount(0);
  });

  test("AC-3: not on the not-found screen", async ({ page }) => {
    await page.goto(`/guest/${"0".repeat(64)}`);
    await expect(page.getByTestId("guest-event-not-found")).toBeVisible();
    await expect(page.getByTestId("guest-auth-prompt")).toHaveCount(0);
  });

  test("AC-3: not on the manage page", async ({ page }) => {
    await page.goto(`/guest/registration/${"0".repeat(64)}`);
    await expect(page.getByTestId("app-session-loading")).toHaveCount(0);
    await expect(page.getByTestId("guest-auth-prompt")).toHaveCount(0);
  });

  test("AC-4, AC-5: both ways in stay at the top of the view, never over the join bar, and a guest can still register", async ({
    page,
  }) => {
    await guestPageSignedOut(page, { name: "Long picnic", long: true });
    const prompt = page.getByTestId("guest-auth-prompt");
    const links = [page.getByTestId("guest-auth-prompt-signin"), page.getByTestId("guest-auth-prompt-signup")];
    const barControls = ["guest-register-name", "guest-register-email", "guest-register-submit"].map((id) =>
      page.getByTestId(id),
    );
    const promptControls = [...links, page.getByTestId("guest-auth-prompt-dismiss")];

    for (const size of [NARROW, WIDE]) {
      await page.setViewportSize(size);
      for (const end of ["guest-event-attendees", "guest-event-name"]) {
        await page.getByTestId(end).scrollIntoViewIfNeeded();
        for (const l of links) await expect(l).toBeInViewport();
        for (const c of barControls) await expect(c).toBeInViewport();
        for (const p of promptControls) {
          for (const c of [...barControls, page.getByTestId("guest-join-bar")]) {
            expect(intersects(await box(p), await box(c))).toBe(false);
          }
        }
      }
      // AC-5. At the foot of the page the prompt is pinned to the top of the viewport.
      await page.getByTestId("guest-event-attendees").scrollIntoViewIfNeeded();
      expect((await box(prompt)).y).toBeLessThanOrEqual(1);
    }

    // AC-4. The register block is EVT-07's and UIE-12's, in the bar, and it works beside the prompt.
    await expect(page.getByTestId("guest-join-bar").getByTestId("guest-register")).toHaveCount(1);
    await page.getByTestId("guest-register-name").fill("Mai");
    await page.getByTestId("guest-register-email").fill("mai@guest.example.org");
    await page.getByTestId("guest-register-submit").click();
    await expect(page.getByTestId("guest-join-bar").getByTestId("guest-registered")).toBeVisible();
    await expect(prompt).toBeVisible();
  });

  test("AC-6: dismissed for this page view only, and nothing is written anywhere", async ({ page }) => {
    const { path } = await guestPageSignedOut(page, { name: "Open picnic" });
    const before = await persisted(page);
    const idsBefore = await page
      .locator("[data-testid]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));

    await page.getByTestId("guest-auth-prompt-dismiss").click();
    await expect(page.getByTestId("guest-auth-prompt")).toHaveCount(0);
    expect(await persisted(page)).toBe(before);
    const idsAfter = await page
      .locator("[data-testid]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(idsAfter).toEqual(idsBefore.filter((id) => !id!.startsWith("guest-auth-prompt")));

    // A remount — what a reload is to this page — shows it again.
    await navigate(page, "/");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await navigate(page, path);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page.getByTestId("guest-auth-prompt")).toBeVisible();
  });
});

test.describe("EVT-14 — signing in from it", () => {
  test("AC-7, AC-8: Sign in names the way back; a reader of the event ends on it, and Back skips the sign-in screen", async ({
    page,
  }) => {
    const { id, path } = await guestPageSignedOut(page, { name: "Team picnic", scope: "team" });

    await page.getByTestId("guest-auth-prompt-signin").click();
    await expect(page).toHaveURL(`/signin?next=${encodeURIComponent(path)}`);
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    // AC-12, EVT-06 AC-15. The guest page's two tags left with it.
    await expect(page.locator('meta[name="referrer"], meta[name="robots"]')).toHaveCount(0);

    await submitSignIn(page, TEAMMATE.email);
    await expect(page).toHaveURL(`/events/${id}`);
    await expect(page.getByTestId("event-detail")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("app-session-loading")).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/signin/);
    await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);
  });

  test("AC-8: a member who cannot read the event ends on the guest page, without the prompt", async ({ page }) => {
    const { path } = await guestPageSignedOut(page, { name: "Team picnic", scope: "team" });

    await page.getByTestId("guest-auth-prompt-signin").click();
    await submitSignIn(page, OTHER_TEAM.email);
    await expect(page).toHaveURL(path);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page.getByTestId("guest-auth-prompt")).toHaveCount(0);

    await page.goBack();
    await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);
  });

  test("AC-8: a member-less session ends on the guest page, without the prompt", async ({ page }) => {
    const { path } = await guestPageSignedOut(page, { name: "Open picnic" });

    await page.getByTestId("guest-auth-prompt-signin").click();
    await submitSignIn(page, MEMBER_LESS.email);
    await expect(page).toHaveURL(path);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page.getByTestId("guest-auth-prompt")).toHaveCount(0);
  });

  for (const hostile of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "/a%0Ab"]) {
    test(`AC-9: next=${hostile} lands on /`, async ({ page }) => {
      await page.goto("/");
      await navigate(page, `/signin?next=${encodeURIComponent(hostile)}`);
      await submitSignIn(page, TEAMMATE.email);
      await expect(page.getByTestId("home-sign-out")).toBeVisible();
      // The browser never left the application's origin.
      expect(new URL(page.url()).origin).toBe("http://localhost:4173");
      await expect(page).toHaveURL("/");
    });
  }

  test("AC-10: /signin without next is unchanged — a caller already signed in is sent to /", async ({ page }) => {
    await signIn(page, TEAMMATE.email);
    await navigate(page, "/signin");
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
  });

  test("AC-9: a caller already signed in at /signin?next=<in-app path> is sent to it", async ({ page }) => {
    await signIn(page, TEAMMATE.email);
    await navigate(page, `/signin?next=${encodeURIComponent("/events")}`);
    await expect(page).toHaveURL("/events");
  });
});

test.describe("EVT-14 — signing up from it", () => {
  test("AC-11: Sign up goes to /signup with no query string", async ({ page }) => {
    await guestPageSignedOut(page, { name: "Open picnic" });

    await page.getByTestId("guest-auth-prompt-signup").click();
    await expect(page).toHaveURL("/signup");
    expect(new URL(page.url()).search).toBe("");
    await expect(page.getByTestId("signup-form")).toBeVisible();
  });
});

test.describe("EVT-14 — what it does not touch", () => {
  test("AC-12: no application navigation, and the prompt carries no link but its two", async ({ page }) => {
    await guestPageSignedOut(page, { name: "Open picnic" });

    await expect(page.getByTestId("nav-events-link")).toHaveCount(0);
    await expect(page.getByTestId("home-sign-out")).toHaveCount(0);
    await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);
    await expect(page.getByTestId("guest-auth-prompt").locator("a")).toHaveCount(2);
    await expect(page.locator('meta[name="referrer"]')).toHaveCount(1);
  });
});
