import { expect, test, type Page } from "@playwright/test";

// MIR-19-d AC-1 to AC-9 — the root addresses send a member to their org (01-plan.md §§ 2, 4.5;
// ADR-097 decision 5.2). Runs against the mock build. Every existing member is in Org public, whose
// code is `shared`.
//
// The session survives `page.goto` (the mock stores it in localStorage), so tests address the app by
// URL, except AC-5 (Back) and AC-6 (pushState), which must not reload. Pathnames are read raw: the
// subject here is the exact address.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";

const pathnameOf = (page: Page) => (): string => new URL(page.url()).pathname;

async function signInAt(page: Page, email: string, url = "/signin"): Promise<void> {
  await page.goto(url);
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Signs in at the root and waits for the shell, so a later `goto` finds a stored session. */
async function signedInMember(page: Page): Promise<void> {
  await signInAt(page, MEMBER_EMAIL);
  await expect(page.getByTestId("home-member-name")).toBeVisible();
}

test.describe("MIR-19-d the root addresses send a member to their org", () => {
  test("AC-1: the landing is the org address", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/");
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await expect(page.getByTestId("home-member-name")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared");
  });

  test("AC-2: every org-less app address keeps its path and its query", async ({ page }) => {
    await signedInMember(page);

    await page.goto("/month/2026-10");
    await expect(page.getByTestId("month-grid")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared/month/2026-10");

    await page.goto("/admin");
    await expect.poll(pathnameOf(page)).toBe("/shared/admin");

    await page.goto("/events");
    await expect(page.getByTestId("events-new-button")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared/events");

    await page.goto("/events?probe=1");
    await expect(page.getByTestId("events-new-button")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared/events");
    expect(new URL(page.url()).search).toBe("?probe=1");
  });

  test("AC-3: signing in lands under the org", async ({ page }) => {
    await signInAt(page, MEMBER_EMAIL);
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared");

    await page.evaluate(() => window.localStorage.clear());
    await signInAt(page, MEMBER_EMAIL, `/signin?next=${encodeURIComponent("/events")}`);
    await expect(page.getByTestId("events-new-button")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared/events");
  });

  test("AC-4: a member already signed in at /signin is sent on under the org", async ({ page }) => {
    await signedInMember(page);

    await page.goto("/signin");
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared");
    await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);

    await page.goto(`/signin?next=${encodeURIComponent("/events")}`);
    await expect(page.getByTestId("events-new-button")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared/events");
    await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);
  });

  test("AC-5: the flip adds no history entry", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/month/2026-10");
    await expect(page.getByTestId("month-grid")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared/month/2026-10");

    await page.getByTestId("home-year-link").click();
    await expect.poll(pathnameOf(page)).toBe("/shared/year");

    await page.goBack();
    await expect.poll(pathnameOf(page)).toBe("/shared/month/2026-10");
    await expect(page.getByTestId("month-grid")).toBeVisible();
  });

  test("AC-6: a popstate to an org-less address lands under the org, and the shell is not remounted", async ({
    page,
  }) => {
    await signedInMember(page);
    await expect.poll(pathnameOf(page)).toBe("/shared");
    const before = await page.getByTestId("home-member-name").elementHandle();

    await page.evaluate(() => {
      window.history.pushState({}, "", "/events");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await expect(page.getByTestId("events-new-button")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/shared/events");
    expect(await before!.evaluate((el) => el.isConnected)).toBe(true);
  });

  test("AC-7: an address the app does not route still ends on the org landing, without a loop", async ({
    page,
  }) => {
    await signedInMember(page);
    for (const address of ["/no/such/page", "/guest"]) {
      await page.goto(address);
      await expect(page.getByTestId("week-anchor")).toBeVisible();
      await expect.poll(pathnameOf(page)).toBe("/shared");
    }
  });

  test("AC-8: the account and guest addresses stay at the root for a member", async ({ page }) => {
    await signedInMember(page);

    await page.goto("/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    expect(pathnameOf(page)()).toBe("/signup");

    const guest = `/guest/${"0".repeat(64)}`;
    await page.goto(guest);
    await expect(page.getByTestId("guest-event-not-found")).toBeVisible();
    expect(pathnameOf(page)()).toBe(guest);
  });

  test("AC-9: the callers who are not approved members stay at the root", async ({ page }) => {
    await signInAt(page, MEMBER_LESS_EMAIL);
    await page.goto("/");
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();
    expect(pathnameOf(page)()).toBe("/");

    await page.goto("/month/2026-10");
    await expect(page.getByTestId("month-not-on-a-team")).toBeVisible();
    expect(pathnameOf(page)()).toBe("/month/2026-10");

    await page.evaluate(() => window.localStorage.clear());
    await page.goto("/");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect.poll(pathnameOf(page)).toBe("/signin");
  });
});
