import { expect, test, type Page } from "@playwright/test";

// TEA-05 — Sign in, sign out, and the member-less landing state.
//
// Written from sections 1, 2, and 8 of 01-plan.md only (RULE-05). Every locator below is a
// `data-testid` named in section 8; no component internals or implementation sources are read.
//
// Fixtures used:
// - Admin: quan@example.com / password123 (display: "Quản trị", avatar: "🦉", role: "admin")
// - Member: thanh@example.com / password123 (display: "Thành viên", avatar: "🐱", role: "member")
// - Member-less: hoa@example.com / password123 (display: "Chưa vào nhóm", avatar: "🐧", no member row)
// - Unconfirmed: khanh@example.com / password123 (email_confirmed_at null)

const SIGNIN = "/signin";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";
const UNCONFIRMED_EMAIL = "khanh@example.com";
const UNKNOWN_EMAIL = "khongtontai@example.com";
const PASSWORD = "password123";
const WRONG_PASSWORD = "wrong-password";

async function submitSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(password);
  await page.getByTestId("sign-in-submit").click();
}

test.describe("TEA-05 sign in, sign out, and session", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    // Wait for session resolution if loading indicator appears
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) {
      await expect(loading).toBeHidden();
    }
  });

  test("AC-9: with no session, the application lands on the sign-in screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect(page.getByTestId("sign-in-email")).toBeVisible();
    await expect(page.getByTestId("sign-in-password")).toBeVisible();

    // Any unknown route also redirects/lands on sign-in
    await page.goto("/unknown-nonexistent-path");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  });

  test("AC-5: the member-less answer is never given to a caller with no session", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect(page.getByTestId("not-on-a-team")).toHaveCount(0);
  });

  test("AC-1: a member signs in and lands on the board with name, avatar, and role", async ({
    page,
  }) => {
    await submitSignIn(page, MEMBER_EMAIL, PASSWORD);

    await expect(page.getByTestId("home-member-name")).toHaveText("Thành viên");
    await expect(page.getByTestId("home-member-avatar")).toHaveAttribute("data-avatar", "1.png");
    await expect(page.getByTestId("home-member-role")).toHaveText("Member");
  });

  test("AC-2: a wrong address and a wrong password are refused identically", async ({ page }) => {
    // 1. Unknown address
    await submitSignIn(page, UNKNOWN_EMAIL, PASSWORD);
    const errorUnknown = page.getByTestId("sign-in-error");
    await expect(errorUnknown).toBeVisible();
    const textUnknown = (await errorUnknown.textContent())?.trim();
    expect(textUnknown).toBeTruthy();

    // Reload or clear inputs
    await page.goto(SIGNIN);
    // 2. Known address with wrong password
    await submitSignIn(page, MEMBER_EMAIL, WRONG_PASSWORD);
    const errorWrongPw = page.getByTestId("sign-in-error");
    await expect(errorWrongPw).toBeVisible();
    const textWrongPw = (await errorWrongPw.textContent())?.trim();
    expect(textWrongPw).toBeTruthy();

    // Must be identical message to prevent account enumeration oracle
    expect(textUnknown).toBe(textWrongPw);
  });

  test("AC-3: an unconfirmed address cannot sign in, and is told why", async ({ page }) => {
    await submitSignIn(page, UNCONFIRMED_EMAIL, PASSWORD);
    const error = page.getByTestId("sign-in-error");
    await expect(error).toBeVisible();

    const text = (await error.textContent())?.trim();
    expect(text).toBeTruthy();

    // Compare with AC-2 message: must not be the generic invalid credentials message
    await page.goto(SIGNIN);
    await submitSignIn(page, UNKNOWN_EMAIL, PASSWORD);
    const genericErrorText = (await page.getByTestId("sign-in-error").textContent())?.trim();
    expect(text).not.toBe(genericErrorText);
  });

  test("AC-4: a signed-in person with no member row is told they are not on a team", async ({
    page,
  }) => {
    await submitSignIn(page, MEMBER_LESS_EMAIL, PASSWORD);

    await expect(page.getByTestId("not-on-a-team")).toBeVisible();
    await expect(page.getByTestId("not-on-a-team-sign-out")).toBeVisible();
  });

  test("AC-6: signing out ends the session from Home and from member-less screen", async ({
    page,
  }) => {
    // 1. Sign out from Home
    await submitSignIn(page, MEMBER_EMAIL, PASSWORD);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await page.getByTestId("home-sign-out").click();

    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await page.goto("/");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    // 2. Sign out from NotOnATeam
    await submitSignIn(page, MEMBER_LESS_EMAIL, PASSWORD);
    await expect(page.getByTestId("not-on-a-team-sign-out")).toBeVisible();
    await page.getByTestId("not-on-a-team-sign-out").click();

    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await page.goto("/");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  });

  test("AC-7: a reload keeps the session", async ({ page }) => {
    await submitSignIn(page, MEMBER_EMAIL, PASSWORD);
    await expect(page.getByTestId("home-member-name")).toHaveText("Thành viên");

    await page.reload();
    await expect(page.getByTestId("home-member-name")).toHaveText("Thành viên");
  });

  test("AC-10: the allow-list link is shown to an admin and to nobody else", async ({ page }) => {
    // **ON THE HUB SINCE UIE-10, NOT IN THE SIDEBAR.** That ticket removed the sidebar's four admin
    // links; the address is reached through `shell-admin-link` in the top bar and then
    // `admin-hub-allow-list-link`. AC-10's substance is untouched — an admin is offered a link to
    // the allow list and a member is offered none — and only the surface it sits on moved.
    //
    // `home-member-role` is READ AND NEVER WRITTEN by this ticket and it still resolves to exactly
    // one node, in the account footer. UIE-10 added the role word to every ROSTER row under the new
    // id `shell-roster-role` precisely so these three lines keep working under strict mode.

    // Admin sees link
    await submitSignIn(page, ADMIN_EMAIL, PASSWORD);
    await expect(page.getByTestId("home-member-role")).toHaveText("Admin");
    await expect(page.getByTestId("shell-admin-link")).toBeVisible();
    await page.getByTestId("shell-admin-link").click();
    await expect(page.getByTestId("admin-hub-allow-list-link")).toBeVisible();

    // Sign out
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    // Member does not see link.
    //
    // **REWRITTEN ONTO `shell-admin-link` BY UIE-10 AC-4.** This line named
    // `home-allow-list-link`, which after that ticket renders for NOBODY — so it would have gone on
    // passing while asserting nothing, because an absent name is absent for every caller.
    // `shell-admin-link` renders for an admin and not for a member, so it can still fail.
    await submitSignIn(page, MEMBER_EMAIL, PASSWORD);
    await expect(page.getByTestId("home-member-role")).toHaveText("Member");
    await expect(page.getByTestId("shell-admin-link")).toHaveCount(0);
  });

  test("AC-11: signing in creates, updates and deletes nothing in member roster", async ({
    page,
  }) => {
    // 1. Sign in as admin, check member list roster
    await submitSignIn(page, ADMIN_EMAIL, PASSWORD);
    await page.goto("/members");
    await expect(page.getByTestId("member-list-row").first()).toBeVisible();

    const rowsBefore = await page.getByTestId("member-list-row").all();
    const idsBefore = await Promise.all(
      rowsBefore.map((row) => row.getAttribute("data-member-id")),
    );

    // Sign out
    await page.goto("/");
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    // 2. Sign in as member-less user
    await submitSignIn(page, MEMBER_LESS_EMAIL, PASSWORD);
    await expect(page.getByTestId("not-on-a-team")).toBeVisible();

    // Sign out
    await page.getByTestId("not-on-a-team-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    // 3. Sign in as admin again and verify roster is unchanged
    await submitSignIn(page, ADMIN_EMAIL, PASSWORD);
    await page.goto("/members");
    await expect(page.getByTestId("member-list-row").first()).toBeVisible();

    const rowsAfter = await page.getByTestId("member-list-row").all();
    const idsAfter = await Promise.all(
      rowsAfter.map((row) => row.getAttribute("data-member-id")),
    );

    expect(idsAfter).toEqual(idsBefore);
    // Member-less auth id is 99999999-9999-4999-8999-999999999999
    expect(idsAfter).not.toContain("99999999-9999-4999-8999-999999999999");
  });
});
