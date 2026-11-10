import { expect, test, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange } from "./support/entry-form";

// SOLO, 2026-09-11 — an overlap refusal says WHICH dates collide.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering is local and not `AC-n`.
// What authorises the work is `.claude/agents/solo.md`.
//
// The operator: *"lỗi này nên show cho user biết ngày nào đang bị trùng"*, and they chose ISO dates
// with an arrow — the form the own-entry list beneath the form already uses. CAL-01 AC-7 already
// asserts THAT the refusal happens and AC-8 that it is not over-broad; this file asserts only what
// the sentence now says.
//
// THE SUITE DRIVES THE MOCK SEAM, which keeps rows in module scope — so every entry below is created
// in the same document as the refusal it provokes, and nothing here calls `page.goto` mid-test.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";

async function openForm(page: Page): Promise<void> {
  await page.goto("/signin");
  const loading = page.getByTestId("app-session-loading");
  if (await loading.isVisible()) await expect(loading).toBeHidden();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(MEMBER_EMAIL);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-new-entry-link")).toBeVisible();
  await page.getByTestId("home-new-entry-link").click();
  await expect(page.getByTestId("new-entry-form")).toBeVisible();
}

async function submit(page: Page, start: string, end: string, portion: "full" | "am" | "pm" = "full"): Promise<void> {
  await chooseType(page, "new-entry", "pto");
  await choosePortion(page, "new-entry", portion);
  await pickRange(page, "new-entry", start, end);
  await page.getByTestId("new-entry-tentative").setChecked(false);
  await page.getByTestId("new-entry-submit").click();
}

test.describe("SOLO — the overlap refusal names its dates", () => {
  test("1: it names the dates that collide, as runs, and only those", async ({ page }) => {
    await openForm(page);

    // Two existing entries with a gap between them, in November 2026 where no fixture entry sits.
    // SOLO 2026-09-14: moved inside one Monday–Friday week. It spanned the 14th–15th weekend, which
    // the picker now disables, and a choice split around a weekend is two runs submitted one by one.
    await submit(page, "2026-11-09", "2026-11-11");
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
    await submit(page, "2026-11-13", "2026-11-13");
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);

    // A range spanning both. The two collisions are named separately and the free day between them
    // (the 12th) is not named at all.
    await submit(page, "2026-11-10", "2026-11-13");
    const error = page.getByTestId("new-entry-error");
    await expect(error).toContainText("2026-11-10 → 2026-11-11, 2026-11-13");
    await expect(error).not.toContainText("2026-11-12");
    await expect(error).not.toContainText("2026-11-09");
  });

  test("2: a morning beside an afternoon is not named — it is not a collision", async ({ page }) => {
    await openForm(page);

    // Morning on the 23rd, full day on the 24th. A new afternoon on 23–24 collides on the 24th only:
    // the 23rd holds a morning, and INV-01 lets an afternoon sit beside it.
    await submit(page, "2026-11-23", "2026-11-23", "am");
    await submit(page, "2026-11-24", "2026-11-24", "full");
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);

    await submit(page, "2026-11-23", "2026-11-24", "pm");
    const error = page.getByTestId("new-entry-error");
    await expect(error).toContainText("overlap an existing entry: 2026-11-24.");
    await expect(error).not.toContainText("2026-11-23");
  });
});
