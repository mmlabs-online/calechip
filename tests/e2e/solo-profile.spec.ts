import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-10 — the profile screen: view, and edit avatar, display name and password.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n` — that prefix claims a plan document states the criterion.
// The authority is `.claude/agents/solo.md` and ADR-033.
//
// **WHAT THIS SUITE CAN AND CANNOT REACH.** It drives the browser, so it asserts the JOURNEY: the
// controls exist, one save writes everything, a refusal lands beside the box that caused it, and the
// sidebar stops disagreeing with the profile the moment a name is saved. The refusals BELOW the
// interface — a blank name, an avatar outside the offered set, the old password ceasing to work —
// are in `tests/profile-writes.test.ts`, where they cost four calls instead of four navigations.
//
// **A CHANGED PASSWORD CANNOT ESCAPE THE DOCUMENT THAT CHANGED IT.** The mock keeps it in module
// state, which a page load resets — so no test here needs a restore step and test 8 deliberately
// signs out with the BUTTON rather than by navigating, because a `page.goto` would silently put the
// old password back in the middle of the assertion. `fullyParallel` gives each test its own page,
// so nothing crosses between them either. A renamed MEMBER is a different matter and test 4 does
// restore that: the rename survives inside its own document and that document keeps running.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise). Fixtures (`src/lib/fixtures.ts`): FIXTURE_ADMIN is `Quản trị` 🦉 on team `CaleChip`;
// FIXTURE_MEMBER is `Thành viên` 🐱 on the same team; the password for both is `password123`.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function openProfile(page: Page, email: string): Promise<void> {
  await signIn(page, email);
  await page.goto("/profile");
  await expect(page.getByTestId("profile")).toBeVisible();
}

test.describe("SOLO — the profile screen", () => {
  test("1: the account footer is the way in, and it lands on the profile", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);

    // The affordance is the row that already shows the name, the avatar and the role — not a fourth
    // nav link. Following it is the whole navigation contract of this screen.
    await expect(page.getByTestId("home-profile-link")).toHaveAttribute(
      "href",
      "/profile",
    );
    await page.getByTestId("home-profile-link").click();

    await expect(page.getByTestId("profile")).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("2: the identity card shows the caller's own saved row", async ({
    page,
  }) => {
    await openProfile(page, MEMBER_EMAIL);

    await expect(page.getByTestId("profile-name")).toHaveText("Thành viên");
    await expect(page.getByTestId("profile-avatar")).toHaveAttribute("data-avatar", "1.png");
    // SOLO, 2026-09-13. The stored file name is drawn as the image it names, not printed.
    await expect(page.getByTestId("profile-avatar").locator("img")).toHaveAttribute("src", /\/images\/1\.png$/);
    await expect(page.getByTestId("profile-email")).toHaveText(MEMBER_EMAIL);
    // `data-role` beside the word: the fact is asserted without depending on the copy.
    await expect(page.getByTestId("profile-role")).toHaveAttribute(
      "data-role",
      "member",
    );
    await expect(page.getByTestId("profile-team")).toHaveText("CaleChip");
  });

  test("3: the form is seeded from the saved row and the picker marks the current avatar", async ({
    page,
  }) => {
    await openProfile(page, ADMIN_EMAIL);

    await expect(page.getByTestId("profile-display-name")).toHaveValue(
      "Quản trị",
    );

    const options = page.getByTestId("profile-avatar-option");
    const count = await options.count();
    expect(count, "a picker with fewer than two options is not a choice").toBeGreaterThan(1);
    // EXACTLY ONE is checked, and it is the saved one. Two checked options in a `radiogroup` is the
    // bug this catches — the state is derived from `avatar`, so it can only happen if two options
    // carry the same value, which the next assertion rules out.
    await expect(options.filter({ has: page.locator("[aria-checked='true']") })).toHaveCount(0);
    await expect(page.locator("[data-testid='profile-avatar-option'][aria-checked='true']")).toHaveCount(1);
    await expect(
      page.locator("[data-testid='profile-avatar-option'][aria-checked='true']"),
    ).toHaveAttribute("data-avatar", "1.png");

    const values: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const value = await options.nth(i).getAttribute("data-avatar");
      expect(value, `option ${i} carries no data-avatar`).toBeTruthy();
      values.push(value as string);
    }
    expect(new Set(values).size, "two options share a data-avatar value").toBe(count);
  });

  test("4: one save writes the name and the avatar, and the sidebar stops disagreeing", async ({
    page,
  }) => {
    await openProfile(page, MEMBER_EMAIL);

    await page.getByTestId("profile-display-name").fill("Renamed Here");
    await page
      .locator("[data-testid='profile-avatar-option'][data-avatar='2.png']")
      .click();

    // NOT SAVED YET, BUT PREVIEWED. The identity card follows the controls live (operator,
    // 2026-09-13); the save below is still what writes them.
    await expect(page.getByTestId("profile-name")).toHaveText("Renamed Here");
    await expect(page.getByTestId("profile-avatar")).toHaveAttribute("data-avatar", "2.png");

    await page.getByTestId("profile-display-name").fill("");
    await expect(page.getByTestId("profile-name")).toHaveText("Thành viên");
    await page.getByTestId("profile-display-name").fill("Renamed Here");

    await page.getByTestId("profile-save").click();

    await expect(page.getByTestId("profile-outcome")).toHaveAttribute(
      "data-kind",
      "ok",
    );
    await expect(page.getByTestId("profile-name")).toHaveText("Renamed Here");
    await expect(page.getByTestId("profile-avatar")).toHaveAttribute("data-avatar", "2.png");

    // **THE REASON `refreshMembership` EXISTS.** The sidebar draws this name from a membership
    // resolved above the router, and a table write emits no auth event — so without the refresh this
    // assertion fails while everything above it passes.
    await expect(page.getByTestId("home-member-name")).toHaveText("Renamed Here");
    await expect(page.getByTestId("home-member-avatar")).toHaveAttribute("data-avatar", "2.png");

    // Restore, so nothing after this test in this document sees a renamed member.
    await page.getByTestId("profile-display-name").fill("Thành viên");
    await page
      .locator("[data-testid='profile-avatar-option'][data-avatar='1.png']")
      .click();
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-name")).toHaveText("Thành viên");
  });

  test("5: a blank display name is refused beside the box, and nothing is saved", async ({
    page,
  }) => {
    await openProfile(page, MEMBER_EMAIL);

    await page.getByTestId("profile-display-name").fill("   ");
    await page.getByTestId("profile-save").click();

    await expect(page.getByTestId("profile-display-name-error")).toBeVisible();
    // Beside the field and NOT under the button: a member with four inputs on screen has to be told
    // which one to fix.
    await expect(page.getByTestId("profile-outcome")).toHaveCount(0);
    await expect(page.getByTestId("profile-name")).toHaveText("Thành viên");
  });

  test("6: the three password boxes are all-or-nothing, and the pair must match", async ({
    page,
  }) => {
    await openProfile(page, MEMBER_EMAIL);

    // One box filled means a password change was intended, so the other two are required. Reading it
    // as "all three filled" would let this form save the name and ignore the password in silence.
    await page.getByTestId("profile-new-password").fill("longenough");
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-current-password-error")).toBeVisible();

    await page.getByTestId("profile-current-password").fill(PASSWORD);
    await page.getByTestId("profile-confirm-password").fill("something-else");
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-confirm-password-error")).toBeVisible();

    // A refusal at this stage sends no request, so the password is untouched — asserted by signing
    // in again with the original one.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await signIn(page, MEMBER_EMAIL);
  });

  test("7: a wrong current password is refused beside the current-password box", async ({
    page,
  }) => {
    await openProfile(page, MEMBER_EMAIL);

    await page.getByTestId("profile-current-password").fill("not-my-password");
    await page.getByTestId("profile-new-password").fill("a-good-new-password");
    await page.getByTestId("profile-confirm-password").fill("a-good-new-password");
    await page.getByTestId("profile-save").click();

    await expect(page.getByTestId("profile-current-password-error")).toBeVisible();
    // NEVER beside the new-password box. The message names the box that is wrong, and the new one is
    // not wrong.
    await expect(page.getByTestId("profile-new-password-error")).toHaveCount(0);
  });

  test("8: the password changes, and the new one is what signs in", async ({
    page,
  }) => {
    const NEXT = "a-brand-new-password";
    await openProfile(page, MEMBER_EMAIL);

    await page.getByTestId("profile-current-password").fill(PASSWORD);
    await page.getByTestId("profile-new-password").fill(NEXT);
    await page.getByTestId("profile-confirm-password").fill(NEXT);
    await page.getByTestId("profile-save").click();

    await expect(page.getByTestId("profile-outcome")).toHaveAttribute(
      "data-kind",
      "ok",
    );
    // Emptied on success only. A failed attempt that cleared them would make a member retype three
    // boxes to correct one.
    await expect(page.getByTestId("profile-current-password")).toHaveValue("");
    await expect(page.getByTestId("profile-new-password")).toHaveValue("");
    await expect(page.getByTestId("profile-confirm-password")).toHaveValue("");

    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    await page.getByTestId("sign-in-email").fill(MEMBER_EMAIL);
    await page.getByTestId("sign-in-password").fill(NEXT);
    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();

    // **NO RESTORE STEP, AND THE FIRST DRAFT OF THIS TEST HAD ONE THAT FAILED.** The mock holds a
    // changed password in module state, which lives for the life of the DOCUMENT — so any
    // `page.goto` reverts it, including the one a restore step would need in order to reach this
    // screen again. The changed password cannot outlive this test, and the sign-out above is a
    // button rather than a navigation precisely so that the sign-in below still meets it.
  });

  test("9: the reveal control shows the password and does not submit the form", async ({
    page,
  }) => {
    await openProfile(page, MEMBER_EMAIL);

    const box = page.getByTestId("profile-current-password");
    await box.fill("visible-please");
    await expect(box).toHaveAttribute("type", "password");

    await page.getByTestId("profile-current-password-reveal").click();
    await expect(box).toHaveAttribute("type", "text");

    // **A BUTTON WITH NO TYPE INSIDE A FORM IS A SUBMIT BUTTON.** If that were the case here,
    // revealing a password would save the page — and with only one of three boxes filled, the save
    // would land on the all-or-nothing refusal. No outcome and no error means nothing was submitted.
    await expect(page.getByTestId("profile-outcome")).toHaveCount(0);
    await expect(page.getByTestId("profile-current-password-error")).toHaveCount(0);

    await page.getByTestId("profile-current-password-reveal").click();
    await expect(box).toHaveAttribute("type", "password");
  });

  test("11: the Calendar control returns to a calendar, and saves nothing on the way", async ({
    page,
  }) => {
    // SOLO, 2026-09-12. The operator asked for a way back to the calendar from this screen, against
    // an image of an outline pill reading `Calendar`. It exists because the shell's own calendar nav
    // is commented out in `src/components/Sidebar.tsx`, so without it this screen has no way home.
    await openProfile(page, MEMBER_EMAIL);

    const calendar = page.getByTestId("profile-calendar");
    await expect(calendar).toBeVisible();
    await expect(calendar).toHaveAttribute("href", "/");

    // **AN ANCHOR AND NOT A BUTTON, which is the assertion that matters inside a `<form>`.** A
    // `<button>` with no `type` submits — the trap test 9 records for the reveal controls — so a
    // control that went home by submitting the page would save an edit nobody asked to save.
    await expect(calendar).toHaveJSProperty("tagName", "A");

    // Type something and leave WITHOUT saving: the navigation is what is asserted, and that no
    // outcome message was produced on the way out.
    await page.getByTestId("profile-display-name").fill("Không lưu");
    await calendar.click();

    await expect(page.getByTestId("week-day").first()).toBeVisible();
    await expect(page.getByTestId("profile")).toHaveCount(0);
    await expect(page.getByTestId("profile-outcome")).toHaveCount(0);
  });

  test("10: signed out, the address goes nowhere near a profile", async ({
    page,
  }) => {
    // The route is member-guarded and redirects to `/`, which resolves by membership to sign-in.
    await page.goto("/profile");

    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect(page.getByTestId("profile")).toHaveCount(0);
  });
});
