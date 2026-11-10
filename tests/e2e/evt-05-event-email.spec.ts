import { expect, test, type Page } from "@playwright/test";

// EVT-05 — the event email switch on `/profile`. 01-plan.md § 2 AC-14, § 2b, § 4.6.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). Who is emailed, the switch's refusals and the
// email itself are asserted in `tests/event-email.test.ts`; this file asserts what a person does on
// the screen.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-04-notifications.spec.ts` records — a browser
// reload would put every switch back to its default and prove nothing. So "on reload it shows the
// saved value" is driven as the screen being LEFT AND OPENED AGAIN by clicking, which unmounts
// `/profile` and runs its `load()` against the seam once more. The real datastore's reload is the
// same read.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER; the password is `password123`.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";

async function openProfile(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(MEMBER_EMAIL);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
  await page.getByTestId("home-profile-link").click();
  await expect(page.getByTestId("profile")).toBeVisible();
}

/** Leave `/profile` and come back by clicking — the screen is unmounted and reads the seam again. */
async function reopenProfile(page: Page): Promise<void> {
  await page.getByTestId("profile-calendar").click();
  await expect(page.getByTestId("profile")).toHaveCount(0);
  await page.getByTestId("home-profile-link").click();
  await expect(page.getByTestId("profile")).toBeVisible();
}

test.describe("EVT-05 — the event email switch", () => {
  test("AC-7, AC-14: on by default, and labelled as a switch", async ({ page }) => {
    await openProfile(page);
    const toggle = page.getByTestId("profile-event-email");
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("role", "switch");
    await expect(toggle).toHaveAttribute("aria-label", "Event email");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(toggle).toHaveAttribute("data-enabled", "true");
  });

  test("AC-14: switching it off and saving is saved, reported, and still off when the screen is opened again", async ({
    page,
  }) => {
    await openProfile(page);
    const toggle = page.getByTestId("profile-event-email");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(toggle).toHaveAttribute("data-enabled", "false");

    await page.getByTestId("profile-save").click();
    // A switch-only change is a change: never *Nothing to save*.
    await expect(page.getByTestId("profile-outcome")).toHaveAttribute("data-kind", "ok");
    await expect(page.getByTestId("profile-outcome")).toHaveText("Profile saved.");

    await reopenProfile(page);
    await expect(page.getByTestId("profile-event-email")).toHaveAttribute("data-enabled", "false");

    // And back on, the same way.
    await page.getByTestId("profile-event-email").click();
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-outcome")).toHaveText("Profile saved.");
    await reopenProfile(page);
    await expect(page.getByTestId("profile-event-email")).toHaveAttribute("data-enabled", "true");
  });

  test("AC-14: pressing the switch saves nothing until save is pressed", async ({ page }) => {
    await openProfile(page);
    await page.getByTestId("profile-event-email").click();
    await expect(page.getByTestId("profile-event-email")).toHaveAttribute("data-enabled", "false");
    await expect(page.getByTestId("profile-outcome")).toHaveCount(0);

    await reopenProfile(page);
    await expect(page.getByTestId("profile-event-email")).toHaveAttribute("data-enabled", "true");

    // Unchanged, save answers *Nothing to save* as it always has.
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-outcome")).toHaveText("Nothing to save.");
  });
});
