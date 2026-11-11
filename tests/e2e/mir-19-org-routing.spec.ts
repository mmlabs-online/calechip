import { expect, test, type Page } from "@playwright/test";

// MIR-19 AC-1 to AC-11 — the org address is served beside the root one (01-plan.md §§ 2, 4.5, 4.6;
// ADR-097). Runs against the mock build. Every existing member is in Org public, whose code is
// `shared`; a member listed in `calechip.mock.dedicatedOrgMembers` is in the dedicated org, `acme`.
//
// The session survives `page.goto` (the mock stores it in localStorage), so each test signs in once
// and then addresses the application by URL.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const MEMBER_LESS_EMAIL = "hoa@example.com";

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

test.describe("MIR-19 the org address is served", () => {
  test("AC-1: the own org address serves the screen", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/shared/month/2026-10");
    await expect(page.getByTestId("month-grid")).toBeVisible();
    await expect(page.getByTestId("home-member-name")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/shared/month/2026-10");
  });

  test("AC-2: links inside the app keep the org", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/shared/month/2026-10");
    await expect(page.getByTestId("month-grid")).toBeVisible();

    await page.getByTestId("home-year-link").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/shared/year");

    await page.getByTestId("shell-brand-logo").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/shared");
  });

  test("AC-3: an unknown address under the org stays under the org", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/shared/no/such/page");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/shared");
    await expect(page.getByTestId("week-anchor")).toBeVisible();
  });

  test("AC-4: another org's address is not found, and reads nothing", async ({ page }) => {
    await signedInMember(page);
    for (const address of ["/acme/week", "/no-such-org"]) {
      await page.goto(address);
      await expect(page.getByTestId("org-not-found")).toBeVisible();
      await expect(page.getByTestId("home-member-name")).toHaveCount(0);
      await expect(page.getByTestId("week-anchor")).toHaveCount(0);
      await expect(page.getByTestId("month-grid")).toHaveCount(0);
    }
    await page.getByTestId("org-not-found-home").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/shared");
  });

  test("AC-5: a dedicated org's member is served at their own code only", async ({ page }) => {
    await page.addInitScript((id: string) => {
      localStorage.setItem("calechip.mock.dedicatedOrgMembers", JSON.stringify([id]));
    }, MEMBER_ID);
    await signedInMember(page);

    await page.goto("/acme/week");
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await expect(page.getByTestId("org-not-found")).toHaveCount(0);

    await page.goto("/shared/week");
    await expect(page.getByTestId("org-not-found")).toBeVisible();
  });

  test("AC-6: Back across a crossing re-reads the address", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/acme/week");
    await expect(page.getByTestId("org-not-found")).toBeVisible();

    await page.getByTestId("org-not-found-home").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/shared");
    await expect(page.getByTestId("week-anchor")).toBeVisible();

    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/acme/week");
    await expect(page.getByTestId("org-not-found")).toBeVisible();
  });

  test("AC-7: signed out at an org address, sign in and come back", async ({ page }) => {
    await page.goto("/shared/week/2026-10-07");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    const here = new URL(page.url());
    expect(here.pathname).toBe("/signin");
    expect(here.search).toBe("?next=%2Fshared%2Fweek%2F2026-10-07");

    await page.getByTestId("sign-in-email").fill(MEMBER_EMAIL);
    await page.getByTestId("sign-in-password").fill(PASSWORD);
    await page.getByTestId("sign-in-submit").click();

    await expect(page.getByTestId("week-anchor")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/shared/week/2026-10-07");
  });

  test("AC-8: signing out from inside the org", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/shared/year");
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await page.getByTestId("home-sign-out").click();

    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/signin");
  });

  test("AC-9: the account and guest addresses leave the org", async ({ page }) => {
    // Signed out.
    await page.goto("/shared/signup");
    await expect(page.getByTestId("signup-form")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/signup");

    await page.goto("/shared/signin");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/signin");

    const token = "0".repeat(64);
    await page.goto(`/shared/guest/${token}`);
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/guest/${token}`);

    // Signed in: /signin hands a session on to the signed-in landing.
    await signedInMember(page);
    await page.goto("/shared/signin");
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    await expect(page.getByTestId("sign-in-submit")).toHaveCount(0);
  });

  test("AC-10: a caller who is not an approved member is sent to the root", async ({ page }) => {
    // `member-less` (no member row). The pending state has no seeded credential in the mock, and it
    // takes the same arm in App.tsx (`membership.state !== "member"`).
    await signInAt(page, MEMBER_LESS_EMAIL);
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();
    await page.goto("/shared/week");
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("AC-11: the root addresses are unchanged", async ({ page }) => {
    await signedInMember(page);
    await page.goto("/");
    await expect(page.getByTestId("week-anchor")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");

    await page.goto("/month/2026-10");
    await expect(page.getByTestId("month-grid")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/month/2026-10");

    await page.goto("/admin");
    expect(new URL(page.url()).pathname).toBe("/admin");
    await page.goto("/events");
    expect(new URL(page.url()).pathname).toBe("/events");
  });
});
