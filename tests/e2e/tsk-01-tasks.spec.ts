import { expect, test, type Page } from "@playwright/test";

// TSK-01 — a member keeps a private list of tasks for each day. 01-plan.md § 2 and § 4.7.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it; `tests/e2e/seam.setup.ts` refuses the run
// otherwise). The permission half of every AC — who can read, who can change — is asserted
// exhaustively in `tests/tasks.test.ts`; this file asserts what a person SEES on the page.
//
// **A `page.goto` RESETS THE MOCK'S TABLES, AND THE TASK TABLE STARTS EMPTY.** So every journey that
// creates a task and then looks at it moves by clicking, never by `goto`.
//
// **"TODAY" IS PINNED** with `page.clock.setFixedTime`, at 10:00 in Asia/Ho_Chi_Minh so the browser's
// zone cannot move the day. AC-13 moves the clock forward to make a task overdue.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER, linh@ is FIXTURE_APPROVED_MEMBER on
// the same team, quan@ is FIXTURE_ADMIN.

const PASSWORD = "password123";
const MEMBER = "thanh@example.com";
const TEAMMATE = "linh@example.com";
// The roster shows the member row's copied address, which for this fixture is not the sign-in one;
// the row is found by name.
const TEAMMATE_NAME = "Đã duyệt";
const ADMIN = "quan@example.com";

const TODAY = "2030-03-12";
const YESTERDAY = "2030-03-11";
const TOMORROW = "2030-03-13";
const DAY_AFTER = "2030-03-14";

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

test.describe("TSK-01 — my tasks", () => {
  test("AC-5: one My tasks link for a member, a manager and an admin, current on /tasks only", async ({ page }) => {
    // Make the teammate a manager, as an admin does, on the same document.
    await signIn(page, ADMIN);
    await page.goto("/members");
    const linh = page.getByTestId("member-list-row").filter({ hasText: TEAMMATE_NAME });
    await linh.getByTestId("member-list-row-manager").click();
    await expect(linh.getByTestId("member-list-row-manager")).toHaveAttribute("data-role", "manager");
    await page.getByTestId("home-sign-out").click();

    for (const who of [MEMBER, TEAMMATE, ADMIN]) {
      await fillSignIn(page, who);
      const link = page.getByTestId("nav-tasks-link");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveText("My tasks");
      await expect(link).not.toHaveAttribute("aria-current", "page");
      await openTasks(page);
      await expect(link).toHaveAttribute("aria-current", "page");
      await page.getByTestId("tasks-next-day").click();
      await expect(page).toHaveURL(new RegExp(`/tasks/${TOMORROW}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
      await page.getByTestId("home-sign-out").click();
    }
  });

  test("the top bar's Tasks pill: every role, every shell screen, filled on /tasks only", async ({ page }) => {
    // Added 2026-10-19 with the top bar's Tasks link. The sidebar's `My tasks` above is unchanged.
    for (const who of [MEMBER, ADMIN]) {
      await signIn(page, who);
      const pill = page.getByTestId("shell-tasks-link");
      await expect(pill).toHaveCount(1);
      await expect(pill).toHaveText("Tasks");
      await expect(pill).toHaveAttribute("href", "/tasks");
      await expect(pill).not.toHaveAttribute("aria-current", "page");

      await pill.click();
      await expect(page).toHaveURL(/\/tasks$/);
      await expect(page.getByTestId("tasks-page")).toBeVisible();
      await expect(pill).toHaveAttribute("aria-current", "page");
      await page.getByTestId("tasks-next-day").click();
      await expect(page).toHaveURL(new RegExp(`/tasks/${TOMORROW}$`));
      await expect(pill).toHaveAttribute("aria-current", "page");

      // The period group is drawn here too, off a period screen, named `shell-<kind>`.
      await expect(page.getByTestId("shell-week")).toHaveAttribute("href", "/week");
      await expect(page.getByTestId("shell-week")).not.toHaveAttribute("aria-current", "page");

      // And on a screen with no period at all.
      await page.goto("/entries/new");
      await expect(pill).toHaveCount(1);
      await expect(pill).not.toHaveAttribute("aria-current", "page");
      await page.getByTestId("home-sign-out").click();
    }
  });

  test("AC-1, AC-2, AC-4: opens on today, moves a day at a time, and Today comes back", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);

    await expect(heading(page)).toHaveAttribute("data-day", TODAY);
    // TSK-06 AC-15: prefixed "Today · " when the day is today.
    await expect(heading(page)).toHaveText("Today · Tuesday, 12 March 2030");
    await expect(page.getByTestId("tasks-today")).toHaveCount(0);
    await expect(page.getByTestId("tasks-empty")).toHaveText("Nothing planned yet. Add the first task below.");

    await page.getByTestId("tasks-prev-day").click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${YESTERDAY}$`));
    await expect(heading(page)).toHaveAttribute("data-day", YESTERDAY);
    await expect(page.getByTestId("tasks-empty")).toHaveText("Nothing was planned for this day.");
    await expect(page.getByTestId("tasks-today")).toBeVisible();

    await page.getByTestId("tasks-next-day").click();
    await page.getByTestId("tasks-next-day").click();
    await expect(heading(page)).toHaveAttribute("data-day", TOMORROW);
    await expect(page.getByTestId("tasks-empty")).toHaveText("Nothing planned yet. Add the first task below.");

    await page.getByTestId("tasks-today").click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(heading(page)).toHaveAttribute("data-day", TODAY);
    await expect(page.getByTestId("tasks-today")).toHaveCount(0);
  });

  test("AC-3: an address that is not a calendar day lands on today", async ({ page }) => {
    await signIn(page, MEMBER);
    for (const bad of ["not-a-day", "2030-02-30", "2030-3-1"]) {
      await page.goto(`/tasks/${bad}`);
      await expect(page).toHaveURL(/\/tasks$/);
      await expect(heading(page)).toHaveAttribute("data-day", TODAY);
    }
  });

  test("AC-6, AC-8: create in order, trimmed and cleared; bounds refused beside the field", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);

    await addTask(page, "  Write the notes  ", "  bring slides  ");
    await addTask(page, "Second");
    await expect(page.getByTestId("task-add-title")).toHaveValue("");
    await expect(page.getByTestId("task-add-note")).toHaveValue("");

    const titles = page.getByTestId("tasks-list").getByTestId("task-title");
    await expect(titles).toHaveText(["Write the notes", "Second"]);
    await expect(row(page, "Write the notes").getByTestId("task-note")).toHaveText("bring slides");
    await expect(row(page, "Write the notes")).toHaveAttribute("data-done", "false");
    await expect(row(page, "Second").getByTestId("task-note")).toHaveCount(0);

    await page.getByTestId("task-add-title").fill("   ");
    await page.getByTestId("task-add-submit").click();
    await expect(page.locator('[data-testid="task-field-error"][data-field="title"]')).toHaveText(
      "Give the task a title of at most 200 characters.",
    );
    await page.getByTestId("task-add-title").fill("Fine");
    await page.getByTestId("task-add-note").fill("y".repeat(1001));
    await page.getByTestId("task-add-submit").click();
    await expect(page.locator('[data-testid="task-field-error"][data-field="note"]')).toHaveText(
      "Keep the note to at most 1000 characters.",
    );
    await expect(titles).toHaveCount(2);

    // Not on any other day.
    await page.getByTestId("tasks-next-day").click();
    await expect(page.getByTestId("tasks-empty")).toBeVisible();
  });

  test("AC-7: an earlier day has no add form", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await page.getByTestId("tasks-prev-day").click();
    await expect(page.getByTestId("task-add-form")).toHaveCount(0);
    await expect(page.getByTestId("tasks-past-day-note")).toHaveText("Past days take no new tasks.");
  });

  test("AC-9, AC-10: tick, untick and edit keep the task in place", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Alpha");
    await addTask(page, "Beta");

    await row(page, "Alpha").getByTestId("task-done").click();
    await expect(row(page, "Alpha")).toHaveAttribute("data-done", "true");
    await expect(row(page, "Alpha").getByTestId("task-done")).toHaveAttribute("aria-checked", "true");
    await expect(row(page, "Alpha").getByTestId("task-title")).toHaveClass(/line-through/);
    await expect(page.getByTestId("tasks-list").getByTestId("task-title")).toHaveText(["Alpha", "Beta"]);

    // Persists across a reload of the page (a re-read, not a `goto`, which would reset the mock).
    await page.getByTestId("tasks-next-day").click();
    await page.getByTestId("tasks-prev-day").click();
    await expect(row(page, "Alpha")).toHaveAttribute("data-done", "true");

    await row(page, "Alpha").getByTestId("task-done").click();
    await expect(row(page, "Alpha")).toHaveAttribute("data-done", "false");

    // Edit, then cancel an edit.
    await row(page, "Beta").getByTestId("task-edit").click();
    await page.getByTestId("task-edit-title").fill("Beta two");
    await page.getByTestId("task-edit-note").fill("a note");
    await page.getByTestId("task-edit-save").click();
    await expect(row(page, "Beta two").getByTestId("task-note")).toHaveText("a note");

    await row(page, "Beta two").getByTestId("task-edit").click();
    await page.getByTestId("task-edit-title").fill("Discarded");
    await page.getByTestId("task-edit-cancel").click();
    await expect(row(page, "Beta two")).toBeVisible();
    await expect(page.getByTestId("tasks-list").getByTestId("task-title")).toHaveText(["Alpha", "Beta two"]);
  });

  test("AC-11: move to a later day; the date field offers nothing earlier than today", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Movable", "keep me");
    await row(page, "Movable").getByTestId("task-done").click();
    await expect(row(page, "Movable")).toHaveAttribute("data-done", "true");

    await row(page, "Movable").getByTestId("task-move").click();
    await expect(page.getByTestId("task-move-date")).toHaveAttribute("min", TODAY);

    // A date before today, typed past the picker's minimum, is refused beside the field.
    await page.getByTestId("task-move-date").fill(YESTERDAY);
    await page.getByTestId("task-move-save").click();
    await expect(page.locator('[data-testid="task-field-error"][data-field="date"]')).toHaveText(
      "A task can be dated today or later.",
    );
    await expect(row(page, "Movable")).toHaveAttribute("data-date", TODAY);

    await page.getByTestId("task-move-date").fill(DAY_AFTER);
    await page.getByTestId("task-move-save").click();
    await expect(page.getByTestId("tasks-empty")).toBeVisible();

    await page.getByTestId("tasks-next-day").click();
    await page.getByTestId("tasks-next-day").click();
    await expect(heading(page)).toHaveAttribute("data-day", DAY_AFTER);
    await expect(row(page, "Movable")).toHaveAttribute("data-done", "true");
    await expect(row(page, "Movable").getByTestId("task-note")).toHaveText("keep me");
  });

  test("AC-12: delete asks first; cancel keeps, confirm removes", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "Doomed");

    await row(page, "Doomed").getByTestId("task-delete").click();
    await expect(page.getByTestId("task-delete-confirm")).toContainText("Delete this task?");
    await page.getByTestId("task-delete-confirm-no").click();
    await expect(page.getByTestId("task-delete-confirm")).toHaveCount(0);
    await expect(row(page, "Doomed")).toBeVisible();

    await row(page, "Doomed").getByTestId("task-delete").click();
    await page.getByTestId("task-delete-confirm-yes").click();
    await expect(page.getByTestId("task-delete-confirm")).toHaveCount(0);
    await expect(page.getByTestId("tasks-empty")).toBeVisible();
  });

  test("AC-13 to AC-15: overdue shows on today, oldest first, and empties as tasks are handled", async ({ page }) => {
    await signIn(page, MEMBER);
    await openTasks(page);
    await addTask(page, "From the 12th");
    await page.getByTestId("tasks-next-day").click();
    await addTask(page, "From the 13th");
    await addTask(page, "Done on the 13th");
    await row(page, "Done on the 13th").getByTestId("task-done").click();
    await expect(row(page, "Done on the 13th")).toHaveAttribute("data-done", "true");

    // The clock moves to the 15th: the 12th and the 13th are past.
    await page.clock.setFixedTime(at("2030-03-15"));
    await page.getByTestId("nav-tasks-link").click();
    await expect(heading(page)).toHaveAttribute("data-day", "2030-03-15");

    const overdue = page.getByTestId("tasks-overdue");
    await expect(overdue).toBeVisible();
    await expect(page.getByTestId("tasks-overdue-count")).toHaveText("2");
    await expect(overdue.getByTestId("task-title")).toHaveText(["From the 12th", "From the 13th"]);
    await expect(overdue.getByTestId("task-date-chip")).toHaveText(["Tue 12 Mar", "Wed 13 Mar"]);

    // AC-15. Absent on any other day.
    await page.getByTestId("tasks-prev-day").click();
    await expect(page.getByTestId("tasks-overdue")).toHaveCount(0);
    await page.getByTestId("tasks-today").click();

    // AC-14, as amended by TSK-05 AC-9. Tick one: it stays in the section, shown done, until the page
    // next loads. Then move the other to today; that save is the next load.
    await row(page, "From the 12th").getByTestId("task-done").click();
    await expect(page.getByTestId("tasks-overdue-count")).toHaveText("1");
    await expect(overdue.getByTestId("task-row").filter({ hasText: "From the 12th" })).toHaveAttribute("data-done", "true");
    await row(page, "From the 13th").getByTestId("task-move").click();
    await page.getByTestId("task-move-date").fill("2030-03-15");
    await page.getByTestId("task-move-save").click();
    await expect(page.getByTestId("tasks-overdue")).toHaveCount(0);
    await expect(page.getByTestId("tasks-list").getByTestId("task-title")).toHaveText(["From the 13th"]);
  });
});
