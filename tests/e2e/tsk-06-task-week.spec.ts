import { expect, test, type Page } from "@playwright/test";

// TSK-06 — the task page shows the week around the viewed day, with progress, and a task may carry
// an optional time of day. 01-plan.md §§ 2 and 4.7. ADR-062.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). The data half of every AC — the order clause for
// clause, the refusals, who can read the time — is in `tests/task-time.test.ts`; this file asserts
// what a person SEES.
//
// **AC-4's page message is not driven here.** The browser's own time field (§ 1 decision 7) will not
// hold a value that is not `HH:MM`, so the page cannot be made to send one; the seam's refusal and its
// sentence are asserted in `tests/task-time.test.ts`.
//
// Helpers and fixtures are TSK-01's, copied as `tests/e2e/tsk-05-optimistic-tick.spec.ts` copies
// them: a `page.goto` resets the mock's tables, so every journey moves by clicking; "today" is pinned
// with `page.clock.setFixedTime` at 10:00 in Asia/Ho_Chi_Minh. 2030-03-12 is a Tuesday, so the week
// is Monday 11 to Sunday 17 March.

const PASSWORD = "password123";
const MEMBER = "thanh@example.com";
const TEAMMATE = "linh@example.com";

const TODAY = "2030-03-12";
const TOMORROW = "2030-03-13";
const WEEK = ["2030-03-11", "2030-03-12", "2030-03-13", "2030-03-14", "2030-03-15", "2030-03-16", "2030-03-17"];

const at = (day: string): Date => new Date(`${day}T10:00:00+07:00`);

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

/** Through the sidebar, never `goto` — the tables survive. */
async function openTasks(page: Page): Promise<void> {
  await page.getByTestId("nav-tasks-link").click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByTestId("tasks-page")).toBeVisible();
}

async function addTask(page: Page, title: string, time?: string): Promise<void> {
  await page.getByTestId("task-add-title").fill(title);
  if (time !== undefined) await page.getByTestId("task-add-time").fill(time);
  await page.getByTestId("task-add-submit").click();
  await expect(page.getByTestId("tasks-list").getByTestId("task-title").filter({ hasText: title })).toBeVisible();
}

const row = (page: Page, title: string) =>
  page.getByTestId("task-row").filter({ has: page.getByTestId("task-title").filter({ hasText: title }) });

const titles = (page: Page) => page.getByTestId("tasks-list").getByTestId("task-title");

const cell = (page: Page, day: string) => page.locator(`[data-testid="tasks-week-day"][data-day="${day}"]`);

test.describe("TSK-06 — the task week", () => {
  test("AC-1: a timed task shows HH:MM, an untimed one shows no time, and the fields clear", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await expect(page.getByTestId("task-add-time")).toHaveValue("");

    await addTask(page, "Stand-up", "09:30");
    await expect(row(page, "Stand-up").getByTestId("task-time")).toHaveText("09:30");
    await expect(row(page, "Stand-up").getByTestId("task-time")).toHaveAttribute("data-time", "09:30");
    await expect(page.getByTestId("task-add-title")).toHaveValue("");
    await expect(page.getByTestId("task-add-time")).toHaveValue("");

    await addTask(page, "Whenever");
    await expect(row(page, "Whenever").getByTestId("task-time")).toHaveCount(0);
  });

  test("AC-2, AC-3: edit sets, changes and clears the time; cancel changes nothing; a move keeps it", async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Review");

    await row(page, "Review").getByTestId("task-edit").click();
    await expect(page.getByTestId("task-edit-time")).toHaveValue("");
    await page.getByTestId("task-edit-time").fill("14:00");
    await page.getByTestId("task-edit-save").click();
    await expect(row(page, "Review").getByTestId("task-time")).toHaveText("14:00");

    await row(page, "Review").getByTestId("task-edit").click();
    await expect(page.getByTestId("task-edit-time")).toHaveValue("14:00");
    await page.getByTestId("task-edit-time").fill("08:15");
    await page.getByTestId("task-edit-cancel").click();
    await expect(row(page, "Review").getByTestId("task-time")).toHaveText("14:00");

    await row(page, "Review").getByTestId("task-move").click();
    await page.getByTestId("task-move-date").fill(TOMORROW);
    await page.getByTestId("task-move-save").click();
    await expect(page.getByTestId("tasks-empty")).toBeVisible();
    await cell(page, TOMORROW).click();
    await expect(row(page, "Review").getByTestId("task-time")).toHaveText("14:00");

    await row(page, "Review").getByTestId("task-edit").click();
    await page.getByTestId("task-edit-time").fill("");
    await page.getByTestId("task-edit-save").click();
    await expect(row(page, "Review")).toBeVisible();
    await expect(row(page, "Review").getByTestId("task-time")).toHaveCount(0);
  });

  test("AC-8, AC-9: timed first by time, untimed after; a tick stays put until the next read", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "U1");
    await addTask(page, "A", "16:30");
    await addTask(page, "C", "14:00");
    await expect(titles(page)).toHaveText(["C", "A", "U1"]);

    await row(page, "C").getByTestId("task-done").click();
    await expect(row(page, "C")).toHaveAttribute("data-done", "true");
    await expect(titles(page)).toHaveText(["C", "A", "U1"]);

    await page.getByTestId("tasks-next-day").click();
    await page.getByTestId("tasks-prev-day").click();
    await expect(titles(page)).toHaveText(["A", "U1", "C"]);
  });

  test("AC-11, AC-12, AC-15: seven days Monday first, marks, today and the viewed day", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await expect(page.getByTestId("tasks-week-label")).toHaveText("Week 11 Mar – 17 Mar 2030");
    await expect(page.getByTestId("tasks-day-heading")).toHaveText("Today · Tuesday, 12 March 2030");

    const cells = page.getByTestId("tasks-week-day");
    await expect(cells).toHaveCount(7);
    for (const [i, day] of WEEK.entries()) await expect(cells.nth(i)).toHaveAttribute("data-day", day);
    await expect(cells.nth(0)).toContainText("Mon");
    await expect(cells.nth(6)).toContainText("Sun");
    await expect(cell(page, TODAY)).toHaveAttribute("aria-current", "date");
    await expect(cell(page, TODAY)).toHaveAttribute("data-today", "true");
    await expect(page.locator('[data-testid="tasks-week-day"][data-today="true"]')).toHaveCount(1);
    // 2026-10-19: today's weekday is a `Today` pill, on today's cell only.
    await expect(cell(page, TODAY).getByTestId("tasks-week-day-today")).toHaveText("Today");
    await expect(cell(page, TODAY)).not.toContainText("Tue");
    await expect(page.getByTestId("tasks-week-day-today")).toHaveCount(1);

    await addTask(page, "One");
    await addTask(page, "Two");
    await addTask(page, "Three");
    await row(page, "One").getByTestId("task-done").click();
    await expect(cell(page, TODAY).getByTestId("tasks-week-day-mark")).toHaveText("1/3");
    await expect(cell(page, TODAY)).toHaveAttribute("aria-label", "Tuesday 12 March, 1 of 3 tasks done");
    await expect(cell(page, TOMORROW).getByTestId("tasks-week-day-mark")).toHaveText("–");
    await expect(cell(page, TOMORROW)).toHaveAttribute("aria-label", "Wednesday 13 March, no tasks");

    await row(page, "Two").getByTestId("task-done").click();
    await row(page, "Three").getByTestId("task-done").click();
    await expect(cell(page, TODAY).getByTestId("tasks-week-day-mark")).toHaveText("✓");
  });

  test("AC-13, AC-14: a cell opens its day; the week arrows move seven days; the day arrows stay", async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await openTasks(page);

    await cell(page, "2030-03-15").click();
    await expect(page).toHaveURL(/\/tasks\/2030-03-15$/);
    await expect(page.getByTestId("tasks-day-heading")).toHaveText("Friday, 15 March 2030");
    await expect(cell(page, "2030-03-15")).toHaveAttribute("aria-current", "date");

    await page.getByTestId("tasks-next-week").click();
    await expect(page).toHaveURL(/\/tasks\/2030-03-22$/);
    await expect(page.getByTestId("tasks-week-label")).toHaveText("Week 18 Mar – 24 Mar 2030");

    await page.getByTestId("tasks-prev-week").click();
    await page.getByTestId("tasks-prev-week").click();
    await expect(page).toHaveURL(/\/tasks\/2030-03-08$/);

    await page.getByTestId("tasks-next-day").click();
    await expect(page).toHaveURL(/\/tasks\/2030-03-09$/);
    // 2026-10-19: `Today` sits in the week strip's nav row, no longer in the page header.
    await expect(page.getByTestId("tasks-week-strip").getByTestId("tasks-today")).toBeVisible();
    await page.getByTestId("tasks-today").click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByTestId("tasks-today")).toHaveCount(0);
  });

  test("AC-16, AC-21: the day's progress and the week summary follow a tick at once", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await expect(page.getByTestId("tasks-day-progress")).toHaveCount(0);
    const summary = page.getByTestId("tasks-week-summary");
    await expect(summary).toHaveAttribute("data-total", "0");
    await expect(page.getByTestId("tasks-week-done")).toHaveText("0");
    await expect(page.getByTestId("tasks-week-left")).toHaveText("0");

    await addTask(page, "Today one");
    await addTask(page, "Today two");
    await cell(page, TOMORROW).click();
    // The add form is remounted per day; wait for the new day's before typing into it.
    await expect(page.getByTestId("tasks-empty")).toBeVisible();
    await addTask(page, "Tomorrow one");
    await cell(page, TODAY).click();
    await expect(titles(page)).toHaveCount(2);

    const progress = page.getByTestId("tasks-day-progress");
    await expect(progress).toHaveAttribute("data-total", "2");
    await expect(progress).toHaveAttribute("data-done", "0");
    await expect(summary).toHaveAttribute("data-total", "3");

    await row(page, "Today one").getByTestId("task-done").click();
    await expect(progress).toHaveAttribute("data-done", "1");
    await expect(progress).toContainText("1/2");
    await expect(summary).toHaveAttribute("data-done", "1");
    await expect(page.getByTestId("tasks-week-done")).toHaveText("1");
    await expect(page.getByTestId("tasks-week-left")).toHaveText("2");
  });

  test("AC-18: three icon actions, hidden at rest and shown on hover with tooltips", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Hover me");
    await page.mouse.move(0, 0);
    await page.getByTestId("tasks-week-label").click();

    const actions = row(page, "Hover me").getByRole("button", { name: /Edit task|Move to a date|Delete task/ });
    await expect(actions).toHaveCount(3);
    const edit = row(page, "Hover me").getByTestId("task-edit");
    await expect(edit.locator("xpath=../..")).toHaveCSS("opacity", "0");

    await row(page, "Hover me").hover();
    await expect(edit.locator("xpath=../..")).toHaveCSS("opacity", "1");
    await expect(edit).toHaveAttribute("aria-label", "Edit task");
    await expect(row(page, "Hover me").getByTestId("task-move")).toHaveAttribute("aria-label", "Move to a date");
    await expect(row(page, "Hover me").getByTestId("task-delete")).toHaveAttribute("aria-label", "Delete task");

    await row(page, "Hover me").getByTestId("task-delete").click();
    await expect(page.getByTestId("task-delete-confirm")).toBeVisible();
    await page.getByTestId("task-delete-confirm-no").click();
  });

  test("AC-22: the strip and the summary count my tasks only", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Mine");
    await page.getByTestId("home-sign-out").click();

    await fillSignIn(page, TEAMMATE);
    await openTasks(page);
    await expect(cell(page, TODAY).getByTestId("tasks-week-day-mark")).toHaveText("–");
    await expect(page.getByTestId("tasks-week-summary")).toHaveAttribute("data-total", "0");
  });
});
