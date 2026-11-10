import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickRange } from "./support/entry-form";

// SOLO, 2026-09-11 — which entries need an admin's approval, set per team on `/setting`.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to this
// file and deliberately NOT `AC-n`. What authorises the work is `.claude/agents/solo.md`.
//
// **WHAT THIS IS, IN THE OPERATOR'S WORDS.** *"WFH_NEED_APPROVE và PTO_NEED_APPROVE. nếu
// WFH_NEED_APPROVE = true: thì khi đăng kí WFH phải được admin approve, ngược lại không cần APPROVE mà
// tự động approved. Tương tự với PTO_NEED_APPROVE cho đăng kí PTO. Đặt tính năng setting này trong tab
// Setting (/setting) của admin panel."* Asked four questions, they chose: re-address the team screen
// to `/setting`; keep entries already pending as they are when a switch is turned off; give an
// auto-approved entry the ordinary star; and re-approve an edited entry automatically — that last
// one waits for an ADR amending INV-02 and is NOT asserted here, because the product does not do it
// yet. Test 5 is the one that holds the line in the meantime.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise), and **THE MOCK KEEPS ITS ROWS IN MODULE SCOPE, SO A DOCUMENT LOAD DISCARDS EVERY WRITE.**
// Every test below changes a switch, then changes the person, without a `page.goto` in between —
// `switchUser` signs out and back in through the form, and `walkTo` moves the router without loading.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

const SETTING = "/setting";

/** Dates in November 2026, where no fixture entry for the member sits — so no insert here can be
 *  refused on INV-01 for a reason that has nothing to do with approval. */
const WFH_DAY = "2026-11-02";
const PTO_DAY = "2026-11-03";
const WAITING_DAY = "2026-11-04";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  const loading = page.getByTestId("app-session-loading");
  if (await loading.isVisible()) await expect(loading).toBeHidden();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** A different person, in the same document — so what the last person saved is still in the mock. */
async function switchUser(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Move the router WITHOUT a document load — `solo-busy-day.spec.ts` records the trap it avoids. */
async function walkTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => window.history.pushState({}, "", to), path);
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
}

/** Leave the settings screen and come back through the tab strip, so it unmounts and re-reads. */
async function reopen(page: Page): Promise<void> {
  await page.getByTestId("admin-hub-members-link").click();
  await expect(page.getByTestId("team-settings")).toHaveCount(0);
  await page.getByTestId("admin-hub-threshold-link").click();
  await expect(page.getByTestId("team-settings")).toBeVisible();
}

/** One full-day entry on `date`, declared through the form from the landing screen. */
async function declare(page: Page, type: "pto" | "wfh", date: string): Promise<void> {
  if (!(await page.getByTestId("new-entry-form").isVisible())) {
    await page.getByTestId("home-new-entry-link").click();
    await expect(page.getByTestId("new-entry-form")).toBeVisible();
  }
  await chooseType(page, "new-entry", type);
  await choosePortion(page, "new-entry", "full");
  await pickRange(page, "new-entry", date, date);
  await page.getByTestId("new-entry-tentative").setChecked(false);
  await page.getByTestId("new-entry-submit").click();
}

/** The caller's own row for a one-day entry on `date`, found by its dates rather than its position. */
const ownRow = (page: Page, date: string): Locator =>
  page.getByTestId("own-entry-row").filter({
    has: page.getByTestId("own-entry-row-dates").filter({ hasText: `${date} → ${date}` }),
  });

test.describe("SOLO — which entries need approval", () => {
  test("1: the screen lives at /setting, the old address still lands there, and the tab says Settings", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);

    // A bookmark from before the move. It must arrive, not fall through to `/` with no word about why.
    await page.goto("/threshold");
    await expect(page).toHaveURL(/\/setting$/);
    await expect(page.getByTestId("team-settings")).toBeVisible();

    const tab = page.getByTestId("admin-hub-threshold-link");
    await expect(tab).toHaveText("Settings");
    await expect(tab).toHaveAttribute("href", SETTING);
  });

  test("2: both switches start on — the product as it was before this work", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.goto(SETTING);

    await expect(page.getByTestId("approval-wfh")).toBeChecked();
    await expect(page.getByTestId("approval-pto")).toBeChecked();
    const current = page.getByTestId("approval-current");
    await expect(current).toHaveAttribute("data-wfh-need-approve", "true");
    await expect(current).toHaveAttribute("data-pto-need-approve", "true");
  });

  test("3: WFH approval off — a member's new WFH entry is approved at once, and PTO still waits", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.goto(SETTING);

    await page.getByTestId("approval-wfh").uncheck();
    await page.getByTestId("approval-save").click();
    await expect(page.getByTestId("approval-saved")).toBeVisible();

    // What is STORED, and it survives the screen unmounting — the row came back from the seam and
    // was not merely left sitting in the checkbox.
    const current = page.getByTestId("approval-current");
    await expect(current).toHaveAttribute("data-wfh-need-approve", "false");
    await expect(current).toHaveAttribute("data-pto-need-approve", "true");
    await reopen(page);
    await expect(page.getByTestId("approval-wfh")).not.toBeChecked();
    await expect(page.getByTestId("approval-pto")).toBeChecked();

    // **THE ASSERTION THE FEATURE IS FOR.** A member, not the admin who flipped the switch.
    await switchUser(page, MEMBER_EMAIL);
    await declare(page, "wfh", WFH_DAY);
    await expect(ownRow(page, WFH_DAY)).toHaveAttribute("data-status", "approved");

    // One switch never moves the other type.
    await declare(page, "pto", PTO_DAY);
    await expect(ownRow(page, PTO_DAY)).toHaveAttribute("data-status", "pending");
  });

  test("4: a member cannot reach the switches", async ({ page }) => {
    // The screen's refusal is an affordance; `team_update_admin` and the column grant are the control,
    // and `tests/approval-settings.test.ts` calls the seam past this screen to prove it.
    await signIn(page, MEMBER_EMAIL);
    await page.goto(SETTING);

    await expect(page.getByTestId("threshold-refused")).toBeVisible();
    await expect(page.getByTestId("approval-wfh")).toHaveCount(0);
    await expect(page.getByTestId("approval-save")).toHaveCount(0);
  });

  test("5: turning approval off does not approve what is already waiting", async ({ page }) => {
    // The operator's choice over a sweep: a switch applies to entries written from then on, and a
    // backlog is still an admin's to decide in Pending approvals.
    await signIn(page, MEMBER_EMAIL);
    await declare(page, "wfh", WAITING_DAY);
    await expect(ownRow(page, WAITING_DAY)).toHaveAttribute("data-status", "pending");

    await switchUser(page, ADMIN_EMAIL);
    await walkTo(page, SETTING);
    await expect(page.getByTestId("team-settings")).toBeVisible();
    await page.getByTestId("approval-wfh").uncheck();
    await page.getByTestId("approval-save").click();
    await expect(page.getByTestId("approval-saved")).toBeVisible();

    await switchUser(page, MEMBER_EMAIL);
    await page.getByTestId("home-new-entry-link").click();
    await expect(ownRow(page, WAITING_DAY)).toHaveAttribute("data-status", "pending");
  });
});
