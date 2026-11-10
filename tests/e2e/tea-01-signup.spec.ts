import { expect, test, type Page } from "@playwright/test";

// TEA-01 — sign up and establish the member record.
//
// Written from 01-story.md and section 6 of 02-design.md only (RULE-05). Every locator below is a
// `data-testid` named in that table; no class, DOM path or route beyond `/signup` is addressed.
//
// What is NOT here, and why. AC-2, AC-3, AC-9, AC-11 and AC-12 have no interface in this ticket,
// and AC-1, AC-4 and AC-7 are only half observable through it: with email confirmation on there is
// no mailbox, so the `member` row those criteria are about cannot be reached from a browser.
// Section 6.4 routes all of that to `tests/permission-model.test.ts` against a real database, and
// records that the database does not exist yet. See 05-test-plan.md for the mapping.
//
// **This suite drives the in-memory seam, and the first test below proves it rather than assuming
// it.** Section 6.2 resolves a build with no `VITE_SUPABASE_URL` to the mock, which is what the
// end-to-end command named in .ai/standards/testing-standards.md produces. Section 6.2 is explicit
// that such a run "proves the screen and the mock's imitation of the trigger" and "proves nothing
// about the policies or the real trigger". Nothing below may be read as covering those.

const SIGNUP = "/signup";

// Both addresses are transcribed from the acceptance criteria, not invented here: `an@example.com`
// is AC-1's allow-listed address and `khach@example.com` is AC-5's unlisted one. AC-5 makes the two
// indistinguishable from the browser, which is exactly what these tests assert — so no test below
// depends on knowing which address the running seam actually holds an allow-list entry for.
const ALLOW_LISTED = "an@example.com";
const NOT_ALLOW_LISTED = "khach@example.com";
const PASSWORD = "correct-horse-battery-staple";
const DISPLAY_NAME = "Nguyễn Văn An";

async function fillSignUpForm(
  page: Page,
  opts: { email: string; withAvatar?: boolean },
): Promise<void> {
  await page.getByTestId("signup-email").fill(opts.email);
  await page.getByTestId("signup-password").fill(PASSWORD);
  await page.getByTestId("signup-display-name").fill(DISPLAY_NAME);
  if (opts.withAvatar !== false) {
    await page.getByTestId("signup-avatar-option").first().click();
  }
}

test.describe("TEA-01 sign-up", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNUP);
    await expect(page.getByTestId("signup-form")).toBeVisible();
  });

  // Section 6.2. Not an acceptance criterion — it is the guard that keeps every criterion below from
  // being over-claimed. If a future build ever resolves to the real seam, this fails loudly and the
  // report that cites this suite stops being true quietly.
  test("6.2: this run drives the in-memory seam, and the page says so", async ({ page }) => {
    const banner = page.getByTestId("seam-banner");
    await expect(banner, "no seam-banner: the build did not resolve to the mock").toBeVisible();
    await expect(banner).toHaveAttribute("data-seam", "mock");
  });

  test("AC-8: the person supplies a display name and an avatar before sign-up is offered", async ({
    page,
  }) => {
    const submit = page.getByTestId("signup-submit");
    await expect(submit).toBeDisabled();

    // Email and password alone are not enough — the two fields AC-8 adds are what release the
    // control, and they are released only once BOTH are supplied.
    await page.getByTestId("signup-email").fill(ALLOW_LISTED);
    await page.getByTestId("signup-password").fill(PASSWORD);
    await expect(submit).toBeDisabled();

    await page.getByTestId("signup-display-name").fill(DISPLAY_NAME);
    await expect(submit, "a display name without an avatar must not be enough").toBeDisabled();

    await page.getByTestId("signup-avatar-option").first().click();
    await expect(submit).toBeEnabled();
  });

  test("AC-8: the avatar picker offers distinct, addressable choices", async ({ page }) => {
    await expect(page.getByTestId("signup-avatar-picker")).toBeVisible();

    const options = page.getByTestId("signup-avatar-option");
    const count = await options.count();
    expect(count, "a picker with fewer than two options is not a choice").toBeGreaterThan(1);

    // `data-avatar` is section 6's stated mechanism for a test to choose a known avatar and later
    // assert the same value reached the `member` row. The row half is in the permission-model test;
    // what is checkable here is that the value exists and identifies one option.
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      const value = await options.nth(i).getAttribute("data-avatar");
      expect(value, `option ${i} carries no data-avatar`).toBeTruthy();
      values.push(value as string);
    }
    expect(new Set(values).size, "two options share a data-avatar value").toBe(count);
  });

  test("AC-1: an allow-listed address completes sign-up and is told to confirm the address", async ({
    page,
  }) => {
    await fillSignUpForm(page, { email: ALLOW_LISTED });
    await page.getByTestId("signup-submit").click();

    await expect(page.getByTestId("signup-confirm-notice")).toBeVisible();
    await expect(page.getByTestId("signup-error")).toHaveCount(0);
  });

  test("AC-4: the address matches without regard to case", async ({ page }) => {
    await fillSignUpForm(page, { email: "An@Example.COM" });
    await page.getByTestId("signup-submit").click();

    // The form must not reject a differently-cased address before the trigger ever sees it. Whether
    // the entry was actually consumed is AC-4's other half and belongs to the permission-model test.
    await expect(page.getByTestId("signup-confirm-notice")).toBeVisible();
    await expect(page.getByTestId("signup-error")).toHaveCount(0);
  });

  test("AC-5: an address that is not on the allow-list returns the same result as one that is", async ({
    page,
  }) => {
    await fillSignUpForm(page, { email: NOT_ALLOW_LISTED });
    await page.getByTestId("signup-submit").click();
    const unlisted = page.getByTestId("signup-confirm-notice");
    await expect(unlisted).toBeVisible();
    const unlistedText = (await unlisted.textContent())?.trim();

    await page.goto(SIGNUP);
    await expect(page.getByTestId("signup-form")).toBeVisible();
    await fillSignUpForm(page, { email: ALLOW_LISTED });
    await page.getByTestId("signup-submit").click();
    const listed = page.getByTestId("signup-confirm-notice");
    await expect(listed).toBeVisible();
    const listedText = (await listed.textContent())?.trim();

    // Identical text and identical selector, per section 6. If these ever diverge, sign-up has
    // become an address-enumeration oracle, which is the reason AC-5 is written the way it is.
    expect(unlistedText, "the unlisted notice is empty, so sameness proves nothing").toBeTruthy();
    expect(unlistedText).toBe(listedText);
  });

  test("AC-13: sign-up ends on its own answer and does not redirect to a signed-in view", async ({
    page,
  }) => {
    await fillSignUpForm(page, { email: ALLOW_LISTED });
    await page.getByTestId("signup-submit").click();

    await expect(page.getByTestId("signup-confirm-notice")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${SIGNUP}/?$`));
  });

  test("AC-7: no signed-in view is reached before the address is confirmed", async ({ page }) => {
    await fillSignUpForm(page, { email: ALLOW_LISTED });
    await page.getByTestId("signup-submit").click();

    await expect(page.getByTestId("signup-confirm-notice")).toBeVisible();

    // The screen still shows the confirm notice after a reload — nothing about submitting the form
    // has produced a session. That the `member` row does not yet exist is the other half, and it is
    // only assertable against a database.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${SIGNUP}/?$`));
  });

  // Section 6.3. The property this asserts is the one the previous QA pass found missing: after
  // `signup-submit` is clicked the screen reaches exactly one terminal state, and the button is
  // never left disabled with neither of them on screen. That failure showed as a permanently
  // disabled button reading "Đang gửi…" and no `signup-error`.
  //
  // Section 6.3's third row — `signUp` *throws* — is the row the defect actually lived in, and it is
  // NOT reachable here: under the mock the call neither throws nor returns a failure. It becomes
  // reachable only against the real seam. Recorded in 06-test-report.md rather than faked.
  test("AC-1 and AC-5: the screen reaches one terminal state and never strands signup-submit", async ({
    page,
  }) => {
    for (const email of [ALLOW_LISTED, NOT_ALLOW_LISTED]) {
      await page.goto(SIGNUP);
      await fillSignUpForm(page, { email });
      await page.getByTestId("signup-submit").click();

      const notice = page.getByTestId("signup-confirm-notice");
      const error = page.getByTestId("signup-error");
      await expect(notice.or(error).first(), `${email} reached no terminal state`).toBeVisible();

      const notices = await notice.count();
      const errors = await error.count();
      expect(notices + errors, `${email} reached ${notices + errors} terminal states, not one`).toBe(
        1,
      );
    }
  });
});

