import { expect, test, type Page } from "@playwright/test";

// TSK-05 — ticking a task changes on screen at once. 01-plan.md §§ 2 and 5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). The mock has no hook to make `setTaskDone` fail or
// wait, so a refusal, a superseded refusal and the before-the-answer ordering (AC-1, AC-3, AC-5) are
// asserted against the module in `tests/task-tick.test.ts`. This file asserts what a person SEES.
//
// Helpers and fixtures are TSK-01's, copied as `tests/e2e/tsk-01-tasks.spec.ts` defines them: a
// `page.goto` resets the mock's tables, so every journey moves by clicking; "today" is pinned with
// `page.clock.setFixedTime` at 10:00 in Asia/Ho_Chi_Minh.

const PASSWORD = "password123";
const MEMBER = "thanh@example.com";

const TODAY = "2030-03-12";

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

async function addTask(page: Page, title: string, note?: string): Promise<void> {
  await page.getByTestId("task-add-title").fill(title);
  if (note !== undefined) await page.getByTestId("task-add-note").fill(note);
  await page.getByTestId("task-add-submit").click();
  await expect(page.getByTestId("tasks-list").getByTestId("task-title").filter({ hasText: title })).toBeVisible();
}

const row = (page: Page, title: string) =>
  page.getByTestId("task-row").filter({ has: page.getByTestId("task-title").filter({ hasText: title }) });

const heading = (page: Page) => page.getByTestId("tasks-day-heading");

test.describe("TSK-05 — the optimistic tick", () => {
  test("AC-1: a click flips the row with the box enabled, no loader, and focus kept; Space flips it back", async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Water the plants");

    const box = row(page, "Water the plants").getByTestId("task-done");
    await expect(box).toHaveAttribute("aria-checked", "false");
    await box.click();

    await expect(box).toBeEnabled();
    await expect(box).toHaveAttribute("aria-checked", "true");
    await expect(row(page, "Water the plants")).toHaveAttribute("data-done", "true");
    await expect(page.getByTestId("tasks-page").getByRole("status")).toHaveCount(0);
    await expect(box).toBeFocused();

    await page.keyboard.press("Space");
    await expect(box).toHaveAttribute("aria-checked", "false");
    await expect(row(page, "Water the plants")).toHaveAttribute("data-done", "false");
    await expect(box).toBeFocused();
  });

  test("AC-4: five clicks in a row land on done, and a re-read shows done", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Pay the bill");

    const box = row(page, "Pay the bill").getByTestId("task-done");
    for (let i = 0; i < 5; i += 1) await box.click();
    await expect(box).toHaveAttribute("aria-checked", "true");

    // A re-read: next day, then back.
    await page.getByTestId("tasks-next-day").click();
    await expect(heading(page)).toHaveAttribute("data-day", "2030-03-13");
    await page.getByTestId("tasks-prev-day").click();
    await expect(heading(page)).toHaveAttribute("data-day", TODAY);
    await expect(row(page, "Pay the bill")).toHaveAttribute("data-done", "true");
  });

  test("AC-7: a ticked overdue task stays in the section, shown done, and the count follows", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "From the 12th");
    await addTask(page, "Second overdue");

    // The clock moves to the 15th: both are overdue.
    await page.clock.setFixedTime(at("2030-03-15"));
    await page.getByTestId("nav-tasks-link").click();
    await expect(heading(page)).toHaveAttribute("data-day", "2030-03-15");

    const overdue = page.getByTestId("tasks-overdue");
    const count = page.getByTestId("tasks-overdue-count");
    await expect(count).toHaveText("2");

    const first = overdue.getByTestId("task-row").filter({ hasText: "From the 12th" });
    await first.getByTestId("task-done").click();
    await expect(first).toHaveAttribute("data-done", "true");
    await expect(first.getByTestId("task-date-chip")).toHaveText("Tue 12 Mar");
    await expect(count).toHaveText("1");

    await first.getByTestId("task-done").click();
    await expect(first).toHaveAttribute("data-done", "false");
    await expect(count).toHaveText("2");

    await first.getByTestId("task-done").click();
    await overdue.getByTestId("task-row").filter({ hasText: "Second overdue" }).getByTestId("task-done").click();
    await expect(overdue).toBeVisible();
    await expect(overdue.getByTestId("task-row")).toHaveCount(2);
    await expect(count).toHaveText("0");

    // The next load: next day, then Today.
    await page.getByTestId("tasks-next-day").click();
    await expect(heading(page)).toHaveAttribute("data-day", "2030-03-16");
    await page.getByTestId("tasks-today").click();
    await expect(heading(page)).toHaveAttribute("data-day", "2030-03-15");
    await expect(page.getByTestId("tasks-empty")).toBeVisible();
    await expect(page.getByTestId("tasks-overdue")).toHaveCount(0);
  });
});
