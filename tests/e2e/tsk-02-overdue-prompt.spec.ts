import { expect, test, type Page } from "@playwright/test";

// TSK-02 — each time the app opens, a member is shown their overdue tasks. 01-plan.md §§ 2 and 5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it), and **a `page.goto` resets the mock's tables**
// (`tsk-01-tasks.spec.ts`' header). So the opening under test is a SIGN-OUT AND SIGN-IN in the same
// page: tasks are created on `/tasks`, the clock is moved forward with `page.clock.setFixedTime`, and
// the member signs out and in again — which AC-1 and AC-3 both name as an opening.
//
// The failure paths of AC-6 and AC-8 are asserted in `tests/overdue-prompt.test.ts` and
// `tests/task-tick.test.ts`: the mock has no fault switch.
//
// Helpers are TSK-01's, copied as `tests/e2e/tsk-05-optimistic-tick.spec.ts` copies them.

const PASSWORD = "password123";
const MEMBER = "thanh@example.com";

const DAY_1 = "2030-03-12";
const DAY_2 = "2030-03-13";
const DAY_3 = "2030-03-14";

const at = (day: string): Date => new Date(`${day}T10:00:00+07:00`);

async function fillSignIn(page: Page, email: string): Promise<void> {
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.clock.setFixedTime(at(DAY_1));
  await page.goto("/");
  await fillSignIn(page, email);
}

/** An opening without a page load: sign out, then sign in again. The prompt must be closed first —
 *  its backdrop covers the sidebar. */
async function reopen(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await fillSignIn(page, MEMBER);
}

/** Through the sidebar, never `goto` — the tables survive. */
async function openTasks(page: Page): Promise<void> {
  await page.getByTestId("nav-tasks-link").click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByTestId("tasks-page")).toBeVisible();
}

async function addTask(page: Page, title: string): Promise<void> {
  await page.getByTestId("task-add-title").fill(title);
  await page.getByTestId("task-add-submit").click();
  await expect(page.getByTestId("tasks-list").getByTestId("task-title").filter({ hasText: title })).toBeVisible();
}

/** The titles in the day's list, sorted — the list's own order under a frozen clock is not the point. */
const todayTitles = async (page: Page): Promise<string[]> =>
  (await page.getByTestId("tasks-list").getByTestId("task-title").allTextContents()).sort();

const heading = (page: Page) => page.getByTestId("tasks-day-heading");
const prompt = (page: Page) => page.getByTestId("overdue-prompt");
const promptRow = (page: Page, title: string) =>
  page.getByTestId("overdue-prompt-row").filter({ has: page.getByTestId("overdue-prompt-title").filter({ hasText: title }) });

/**
 * DAY_1: "Oldest" and "Finished" (ticked done). DAY_2: "Second". DAY_3: "For today". Then the clock
 * moves to DAY_3 and the member opens the app again: "Oldest" and "Second" are overdue.
 */
async function twoOverdue(page: Page): Promise<void> {
  await signIn(page, MEMBER);
  await openTasks(page);
  await addTask(page, "Oldest");
  await addTask(page, "Finished");
  await page
    .getByTestId("task-row")
    .filter({ hasText: "Finished" })
    .getByTestId("task-done")
    .click();
  await expect(page.getByTestId("task-row").filter({ hasText: "Finished" })).toHaveAttribute("data-done", "true");

  await page.getByTestId("tasks-next-day").click();
  await expect(heading(page)).toHaveAttribute("data-day", DAY_2);
  await addTask(page, "Second");
  await page.getByTestId("tasks-next-day").click();
  await expect(heading(page)).toHaveAttribute("data-day", DAY_3);
  await addTask(page, "For today");

  await page.clock.setFixedTime(at(DAY_3));
  await reopen(page);
}

test.describe("TSK-02 — the overdue prompt", () => {
  test("AC-1: shown at sign-in, counting and listing the overdue tasks oldest first, with chips", async ({ page }) => {
    await twoOverdue(page);

    await expect(prompt(page)).toBeVisible();
    await expect(page.getByTestId("overdue-prompt-count")).toHaveText("2");
    await expect(prompt(page)).toContainText("You have 2 overdue tasks");
    const rows = page.getByTestId("overdue-prompt-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.getByTestId("overdue-prompt-title")).toHaveText(["Oldest", "Second"]);
    await expect(rows.getByTestId("overdue-prompt-date-chip")).toHaveText(["Tue 12 Mar", "Wed 13 Mar"]);
    await expect(rows.nth(0)).toHaveAttribute("data-date", DAY_1);
    await expect(rows.nth(0)).toHaveAttribute("data-done", "false");
  });

  test("AC-2: nothing overdue — no prompt", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Done already");
    await page.getByTestId("task-done").click();
    await expect(page.getByTestId("task-row")).toHaveAttribute("data-done", "true");
    await page.getByTestId("tasks-next-day").click();
    await addTask(page, "Tomorrow's");

    await page.clock.setFixedTime(at(DAY_2));
    await reopen(page);
    await openTasks(page);
    await expect(heading(page)).toHaveAttribute("data-day", DAY_2);
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);
  });

  test("AC-3: once per opening — not after navigating, again after signing out and in", async ({ page }) => {
    await twoOverdue(page);
    await expect(prompt(page)).toBeVisible();
    await page.getByTestId("overdue-prompt-dismiss").click();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);

    await page.getByTestId("nav-events-link").click();
    await expect(page).toHaveURL(/\/events/);
    await openTasks(page);
    await expect(page.getByTestId("tasks-overdue")).toBeVisible();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);

    await reopen(page);
    await expect(prompt(page)).toBeVisible();
    await expect(page.getByTestId("overdue-prompt-count")).toHaveText("2");
  });

  test("AC-4: the round control, Escape and Close each dismiss it, changing nothing", async ({ page }) => {
    await twoOverdue(page);

    await expect(prompt(page)).toBeVisible();
    await page.getByTestId("overdue-prompt-close").click();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);

    await reopen(page);
    await expect(prompt(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);

    await reopen(page);
    await expect(prompt(page)).toBeVisible();
    await page.getByTestId("overdue-prompt-dismiss").click();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);

    await openTasks(page);
    await expect(page.getByTestId("tasks-overdue-count")).toHaveText("2");
  });

  test("AC-5: a tick shows at once, stays in place, drops the count, and persists", async ({ page }) => {
    await twoOverdue(page);

    const oldest = promptRow(page, "Oldest");
    await oldest.getByTestId("overdue-prompt-done").click();
    await expect(oldest).toHaveAttribute("data-done", "true");
    await expect(page.getByTestId("overdue-prompt-count")).toHaveText("1");
    await expect(prompt(page)).toContainText("You have 1 overdue task");
    await expect(page.getByTestId("overdue-prompt-row")).toHaveCount(2);

    await page.getByTestId("overdue-prompt-dismiss").click();
    await openTasks(page);
    await expect(page.getByTestId("tasks-overdue-count")).toHaveText("1");
    await page.getByTestId("tasks-prev-day").click();
    await page.getByTestId("tasks-prev-day").click();
    await expect(heading(page)).toHaveAttribute("data-day", DAY_1);
    await expect(page.getByTestId("task-row").filter({ hasText: "Oldest" })).toHaveAttribute("data-done", "true");
  });

  test("AC-7: Move all re-dates the not-done rows to today and closes; a ticked row keeps its date", async ({
    page,
  }) => {
    await twoOverdue(page);

    await promptRow(page, "Oldest").getByTestId("overdue-prompt-done").click();
    await expect(promptRow(page, "Oldest")).toHaveAttribute("data-done", "true");
    await page.getByTestId("overdue-prompt-move-all").click();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);

    await openTasks(page);
    await expect(page.getByTestId("tasks-overdue")).toHaveCount(0);
    await expect(page.getByTestId("tasks-list").getByTestId("task-title")).toHaveCount(2);
    await expect(todayTitles(page)).resolves.toEqual(["For today", "Second"]);
    await page.getByTestId("tasks-prev-day").click();
    await page.getByTestId("tasks-prev-day").click();
    await expect(heading(page)).toHaveAttribute("data-day", DAY_1);
    await expect(page.getByTestId("task-row").filter({ hasText: "Oldest" })).toHaveAttribute("data-done", "true");
  });

  test("AC-9: every row ticked — Move all is disabled", async ({ page }) => {
    await twoOverdue(page);

    const move = page.getByTestId("overdue-prompt-move-all");
    await expect(move).toBeEnabled();
    await promptRow(page, "Oldest").getByTestId("overdue-prompt-done").click();
    await promptRow(page, "Second").getByTestId("overdue-prompt-done").click();
    await expect(page.getByTestId("overdue-prompt-count")).toHaveText("0");
    await expect(move).toBeDisabled();
    await page.getByTestId("overdue-prompt-dismiss").click();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);
  });

  test("AC-10: /tasks beneath the prompt shows the moves once it closes, with no reload", async ({ page }) => {
    await twoOverdue(page);
    await expect(prompt(page)).toBeVisible();

    // The router moves to /tasks without a load, so the mock's tables survive.
    await page.evaluate(() => {
      window.history.pushState({}, "", "/tasks");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByTestId("tasks-overdue")).toBeVisible();
    await expect(prompt(page)).toBeVisible();

    await page.getByTestId("overdue-prompt-move-all").click();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);
    await expect(page.getByTestId("tasks-overdue")).toHaveCount(0);
    await expect(page.getByTestId("tasks-list").getByTestId("task-title")).toHaveCount(3);
    await expect(todayTitles(page)).resolves.toEqual(["For today", "Oldest", "Second"]);
  });
});
