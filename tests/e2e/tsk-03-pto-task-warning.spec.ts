import { expect, test, type Locator, type Page } from "@playwright/test";
import { choosePortion, chooseType, pickDate, setRange } from "./support/entry-form";

// TSK-03 — a member declaring PTO is warned about their own tasks on those days, without being
// stopped. 01-plan.md § 2 and § 5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it; `tests/e2e/seam.setup.ts` refuses the run
// otherwise). The rules the two surfaces share — open, chosen, PTO — are asserted exhaustively in
// `tests/pto-tasks.test.ts`; this file asserts what a person SEES.
//
// **A `page.goto` RESETS THE MOCK'S TABLES, AND THE TASK TABLE STARTS EMPTY.** So every journey
// creates its tasks on `/tasks` and then reaches the form or the page by clicking, and changes user
// by signing out and in on the same document, as TSK-01 and TSK-02 do.
//
// **"TODAY" IS PINNED** with `page.clock.setFixedTime`, at 10:00 in Asia/Ho_Chi_Minh, as TSK-01.
//
// AC-8, AC-9 and AC-13's failure paths are not driven here: the mock has no fault switch and adding
// one is a seam-file change (01-plan.md § 5). They are held by PtoTaskWarning's and Tasks' structure.

const PASSWORD = "password123";
const MEMBER = "thanh@example.com";
const TEAMMATE = "linh@example.com";
const ADMIN = "quan@example.com";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";

const TODAY = "2030-03-12";
const TOMORROW = "2030-03-13";
const DAY_AFTER = "2030-03-14";

const at = (day: string): Date => new Date(`${day}T10:00:00+07:00`);

/** The debounce in src/components/PtoTaskWarning.tsx plus a margin. A warning that is never going to
 *  appear fires no event, so every NEGATIVE assertion below waits this out first, as CAL-07's does. */
const PAST_THE_DEBOUNCE = 1200;

async function fillSignIn(page: Page, email: string): Promise<void> {
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.clock.setFixedTime(at(TODAY));
  await page.goto("/");
  await fillSignIn(page, email);
}

async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await fillSignIn(page, email);
}

/** Through the sidebar, never `goto` — the tables survive. Lands on today. */
async function openTasks(page: Page): Promise<void> {
  await page.getByTestId("nav-tasks-link").click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByTestId("tasks-page")).toBeVisible();
}

/** Today, then one `›` per day — each step waits for the heading, so no click lands on a stale page. */
async function openTasksOn(page: Page, day: typeof TOMORROW | typeof DAY_AFTER): Promise<void> {
  await openTasks(page);
  const heading = page.getByTestId("tasks-day-heading");
  await expect(heading).toHaveAttribute("data-day", TODAY);
  for (const next of day === TOMORROW ? [TOMORROW] : [TOMORROW, DAY_AFTER]) {
    await page.getByTestId("tasks-next-day").click();
    await expect(heading).toHaveAttribute("data-day", next);
  }
}

async function addTask(page: Page, title: string): Promise<void> {
  await page.getByTestId("task-add-title").fill(title);
  await page.getByTestId("task-add-submit").click();
  await expect(page.getByTestId("tasks-list").getByTestId("task-title").filter({ hasText: title })).toBeVisible();
}

const taskRow = (page: Page, title: string): Locator =>
  page.getByTestId("task-row").filter({ has: page.getByTestId("task-title").filter({ hasText: title }) });

async function tick(page: Page, title: string): Promise<void> {
  await taskRow(page, title).getByTestId("task-done").click();
  await expect(taskRow(page, title)).toHaveAttribute("data-done", "true");
}

/** The top bar's `+ Book`, which every shell screen carries. */
async function openNewEntry(page: Page): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();
  await expect(page.getByTestId("new-entry-form")).toBeVisible();
}

async function saveNewEntry(page: Page): Promise<void> {
  const before = await page.getByTestId("own-entry-row").count();
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
  await expect(page.getByTestId("own-entry-row")).toHaveCount(before + 1);
}

const warning = (page: Page, prefix: string): Locator => page.getByTestId(`${prefix}-task-warning`);
const warningCount = (page: Page, prefix: string): Locator => page.getByTestId(`${prefix}-task-warning-count`);
const warningTitles = (page: Page, prefix: string): Locator => page.getByTestId(`${prefix}-task-warning-title`);
const flag = (page: Page): Locator => page.getByTestId("tasks-pto-flag");

test.describe("TSK-03 — PTO warns about my own tasks", () => {
  test("AC-1, AC-2: open tasks on the chosen days are listed by date, done and unchosen ones are not", async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "Draft the report");
    await addTask(page, "Call the supplier");
    await addTask(page, "Already finished");
    await tick(page, "Already finished");
    await page.getByTestId("tasks-next-day").click();
    await expect(page.getByTestId("tasks-day-heading")).toHaveAttribute("data-day", DAY_AFTER);
    await addTask(page, "Ship the release");

    await openNewEntry(page);
    await chooseType(page, "new-entry", "pto");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);

    await expect(warning(page, "new-entry")).toBeVisible();
    await expect(warning(page, "new-entry")).toHaveAttribute("role", "status");
    await expect(warningCount(page, "new-entry")).toHaveText("2");
    await expect(warning(page, "new-entry")).toContainText("You have 2 open tasks on these days");
    await expect(warningTitles(page, "new-entry")).toHaveText(["Draft the report", "Call the supplier"]);
    await expect(page.getByTestId("new-entry-task-warning-date-chip")).toHaveText(["Wed 13 Mar", "Wed 13 Mar"]);

    await pickDate(page, "new-entry", DAY_AFTER);
    await expect(warningCount(page, "new-entry")).toHaveText("3");
    await expect(warningTitles(page, "new-entry")).toHaveText([
      "Draft the report",
      "Call the supplier",
      "Ship the release",
    ]);
    await expect(page.getByTestId("new-entry-task-warning-task").last()).toHaveAttribute("data-date", DAY_AFTER);

    // A day with no open task: no block at all.
    await setRange(page, "new-entry", TODAY, TODAY);
    await page.waitForTimeout(PAST_THE_DEBOUNCE);
    await expect(warning(page, "new-entry")).toHaveCount(0);
  });

  test("AC-3, AC-4: WFH hides it, PTO brings it back, portion and tentative change nothing", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "Only one");

    await openNewEntry(page);
    await chooseType(page, "new-entry", "pto");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);
    await expect(warningCount(page, "new-entry")).toHaveText("1");
    await expect(warning(page, "new-entry")).toContainText("You have 1 open task on these days");

    await chooseType(page, "new-entry", "wfh");
    await expect(warning(page, "new-entry")).toHaveCount(0);
    await chooseType(page, "new-entry", "pto");
    await expect(warningTitles(page, "new-entry")).toHaveText(["Only one"]);

    await choosePortion(page, "new-entry", "am");
    await expect(warningTitles(page, "new-entry")).toHaveText(["Only one"]);
    await page.getByTestId("new-entry-tentative").setChecked(true);
    await expect(warningTitles(page, "new-entry")).toHaveText(["Only one"]);
  });

  test("AC-5: saving is never blocked and no task changes", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "Keep me");

    await openNewEntry(page);
    await chooseType(page, "new-entry", "pto");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);
    await expect(warning(page, "new-entry")).toBeVisible();
    await expect(page.getByTestId("new-entry-submit")).toBeEnabled();
    await saveNewEntry(page);

    await openTasksOn(page, TOMORROW);
    await expect(page.getByTestId("tasks-list").getByTestId("task-title")).toHaveText(["Keep me"]);
    await expect(taskRow(page, "Keep me")).toHaveAttribute("data-done", "false");
  });

  test("AC-6: an admin sees no warning on another member's entry, and their own tasks on their own", async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "Member's task");
    await openNewEntry(page);
    await chooseType(page, "new-entry", "pto");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);
    await saveNewEntry(page);

    await switchTo(page, ADMIN);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "Admin's task");

    // The member's entry, through the team list.
    await page.getByTestId("shell-admin-link").click();
    await page.getByTestId("admin-hub-team-entries-link").click();
    await expect(page.getByTestId("team-entries-loading")).toBeHidden();
    await page
      .locator(`[data-testid="team-entry-row"][data-member-id="${MEMBER_ID}"]`)
      .filter({ hasText: TOMORROW })
      .getByTestId("team-entry-row-edit")
      .click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
    await page.waitForTimeout(PAST_THE_DEBOUNCE);
    await expect(warning(page, "edit-entry")).toHaveCount(0);

    // The admin's own PTO on the same day.
    await openNewEntry(page);
    await chooseType(page, "new-entry", "pto");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);
    await saveNewEntry(page);
    await page.getByTestId("own-entry-row").first().getByTestId("own-entry-row-edit").click();
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
    await expect(warningTitles(page, "edit-entry")).toHaveText(["Admin's task"]);
  });

  test("AC-7: a teammate's tasks never appear", async ({ page }) => {
    await signIn(page, TEAMMATE);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "Teammate's task");

    await switchTo(page, MEMBER);
    await openNewEntry(page);
    await chooseType(page, "new-entry", "pto");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);
    await page.waitForTimeout(PAST_THE_DEBOUNCE);
    await expect(warning(page, "new-entry")).toHaveCount(0);
  });

  test("AC-10, AC-12: a PTO day is flagged on the task page, and the count follows a tick", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "First");
    await addTask(page, "Second");

    await openNewEntry(page);
    await chooseType(page, "new-entry", "pto");
    await choosePortion(page, "new-entry", "am");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);
    await page.getByTestId("new-entry-tentative").setChecked(false);
    await saveNewEntry(page);

    await openTasksOn(page, TOMORROW);
    await expect(flag(page)).toHaveText("On PTO · morning · 2 open tasks");
    await expect(flag(page)).toHaveAttribute("data-portion", "am");
    await expect(flag(page)).toHaveAttribute("data-open-count", "2");

    await tick(page, "First");
    await expect(flag(page)).toHaveText("On PTO · morning · 1 open task");
    await expect(flag(page)).toHaveAttribute("data-open-count", "1");
  });

  test("AC-11: WFH, and a day with no entry, are not flagged", async ({ page }) => {
    await signIn(page, MEMBER);
    await openNewEntry(page);
    await chooseType(page, "new-entry", "wfh");
    await choosePortion(page, "new-entry", "full");
    await setRange(page, "new-entry", TOMORROW, TOMORROW);
    await saveNewEntry(page);

    await openTasks(page);
    await expect(page.getByTestId("tasks-day-heading")).toHaveAttribute("data-day", TODAY);
    await expect(flag(page)).toHaveCount(0);
    await page.getByTestId("tasks-next-day").click();
    await expect(page.getByTestId("tasks-day-heading")).toHaveAttribute("data-day", TOMORROW);
    await expect(page.getByTestId("tasks-empty")).toBeVisible();
    await expect(flag(page)).toHaveCount(0);
  });

  test("AC-1: the month view's dialog warns too", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasksOn(page, TOMORROW);
    await addTask(page, "From the month");

    // The brand logo lands on the week; its Month segment opens the current month.
    await page.getByTestId("shell-brand-logo").click();
    await page.getByTestId("week-month").click();
    await expect(page.getByTestId("month-grid")).toBeVisible();

    const cell = page.locator(`[data-testid="month-cell"][data-date="${TOMORROW}"]`);
    await cell.hover();
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByTestId("month-entry-form")).toBeVisible();
    await chooseType(page, "month-entry", "pto");

    await expect(warningTitles(page, "month-entry")).toHaveText(["From the month"]);
  });
});
