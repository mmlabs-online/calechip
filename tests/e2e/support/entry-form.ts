// SOLO, 2026-09-10 — how a spec drives the entry form now that it has no date inputs.
//
// **NOT A SPEC FILE, AND THE DIRECTORY IS WHY.** `playwright.config.ts` matches `.*\.spec\.ts$` for
// the `chromium` project and `seam\.setup\.ts$` for the guard, so nothing here is collected as a
// test. It is a helper, imported by the thirteen suites that used to fill `<prefix>-start` and
// `<prefix>-end`.
//
// It exists because those two `fill` calls became a sequence of clicks on a month grid, and thirteen
// copies of that sequence would be thirteen places to fix when the picker's selectors change. Every
// suite keeps its own assertions; only the typing moved here.
import { expect, type Page } from "@playwright/test";


/**
 * Every `yyyy-MM-dd` from `start` to `end` inclusive.
 *
 * Written here rather than imported from `@/lib/date-selection`, deliberately: a spec that walked
 * the dates with the same function the product walks them with could not catch that function being
 * wrong. The arithmetic is UTC for the reason the product's own is — `new Date('2026-04-30')` parses
 * as UTC midnight and a local read west of UTC yields the previous day.
 */
export function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let ms = Date.parse(`${start}T00:00:00Z`); ms <= Date.parse(`${end}T00:00:00Z`); ms += 86_400_000) {
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

const dayCell = (page: Page, prefix: string, date: string) =>
  page.locator(`[data-testid="${prefix}-day"][data-date="${date}"]`);

/**
 * Step the picker until `date` has a cell, and hand it back.
 *
 * A cell may exist in two months — the grid draws whole weeks, so 30 April appears on April's grid
 * and on March's trailing row. Whichever is on screen is clicked; both carry the same `data-date`.
 */
async function reach(page: Page, prefix: string, date: string) {
  const cell = dayCell(page, prefix, date);

  // 300 months is twenty-five years either way. It was 36 and that was three, which two suites
  // exceeded on their first run — they declare entries in 2030 and the picker opens on today.
  for (let step = 0; step < 300; step += 1) {
    if ((await cell.count()) > 0) return cell.first();

    const shown = await page.getByTestId(`${prefix}-month`).getAttribute("data-month");
    if (shown === null) throw new Error(`no ${prefix} day picker on screen`);

    await page.getByTestId(date.slice(0, 7) < shown ? `${prefix}-month-prev` : `${prefix}-month-next`).click();
  }

  throw new Error(`the ${prefix} picker could not reach ${date} in 300 steps`);
}

/**
 * The days the picker is currently showing as chosen, ascending.
 *
 * It reads the VISIBLE grid, which is enough for what it is used for: the edit form opens on the
 * month its entry starts in, and the grid draws whole weeks either side of it. A saved range longer
 * than about five weeks would run off the bottom of it, and no suite has one.
 */
export async function currentSelection(page: Page, prefix: string): Promise<string[]> {
  const dates = await page
    .locator(`[data-testid="${prefix}-day"][data-selected="true"]`)
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-date") ?? ""));

  return [...new Set(dates)].filter((date) => date !== "").sort();
}

/**
 * Replace one or both ends of what is already chosen.
 *
 * This is what a spec means by `submitEdit({ end: "2026-10-07" })`: with two date inputs, naming one
 * of them left the other holding the entry's own value. A picker has no two values to name, so the
 * bound that was not given is read back off the grid and the whole range is chosen again.
 */
export async function setPartialRange(
  page: Page,
  prefix: string,
  start?: string,
  end?: string,
): Promise<void> {
  const chosen = await currentSelection(page, prefix);
  const nextStart = start ?? chosen[0];
  const nextEnd = end ?? chosen[chosen.length - 1];

  if (nextStart === undefined || nextEnd === undefined) {
    throw new Error(`the ${prefix} picker holds no days, so there is no bound to keep`);
  }

  await setRange(page, prefix, nextStart, nextEnd);
}

/** Choose `date` if it is not already chosen. Idempotent, because the control is a toggle and a
 *  blind second click would unchoose it. */
export async function pickDate(page: Page, prefix: string, date: string): Promise<void> {
  const cell = await reach(page, prefix, date);
  if ((await cell.getAttribute("data-selected")) !== "true") await cell.click();
  await expect(cell).toHaveAttribute("data-selected", "true");
}

/** Unchoose `date` if it is chosen. */
export async function unpickDate(page: Page, prefix: string, date: string): Promise<void> {
  const cell = await reach(page, prefix, date);
  if ((await cell.getAttribute("data-selected")) === "true") await cell.click();
  await expect(cell).toHaveAttribute("data-selected", "false");
}

/**
 * Empty the selection.
 *
 * It clicks every chosen cell the grid is currently showing and steps no months: the forms that
 * arrive with days already chosen — the edit route, and the month view's drag — open on the month
 * those days are in, so this is enough. A selection reached by stepping away and choosing more is
 * the caller's to undo.
 */
export async function clearDates(page: Page, prefix: string): Promise<void> {
  const chosen = page.locator(`[data-testid="${prefix}-day"][data-selected="true"]`);

  for (let guard = 0; guard < 60 && (await chosen.count()) > 0; guard += 1) {
    await chosen.first().click();
  }

  await expect(chosen).toHaveCount(0);
}

/** The replacement for `fill(start)` + `fill(end)`: every day of the range, chosen. */
export async function pickRange(page: Page, prefix: string, start: string, end: string): Promise<void> {
  for (const date of datesInRange(start, end)) await pickDate(page, prefix, date);
}

/** Empty the selection, then choose exactly the range given. What a spec wants when it is REPLACING
 *  the days on a form that already carries some. */
export async function setRange(page: Page, prefix: string, start: string, end: string): Promise<void> {
  await clearDates(page, prefix);
  await pickRange(page, prefix, start, end);
}

/** The segmented type control — the replacement for `selectOption`.
 *
 *  `type` is a plain `string` and not a union: several suites carry their own `type?: string` field
 *  and a union here would make this helper the thing that decides their shape. The value names a
 *  selector, and a wrong one fails loudly at the click. */
export async function chooseType(page: Page, prefix: string, type: string): Promise<void> {
  await page.getByTestId(`${prefix}-type-${type}`).click();
}

/** The segmented portion control. A plain `string` for the reason `chooseType` records. */
export async function choosePortion(page: Page, prefix: string, portion: string): Promise<void> {
  await page.getByTestId(`${prefix}-portion-${portion}`).click();
}
