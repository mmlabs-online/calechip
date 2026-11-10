// TSK-04 — the viewer's own done/total per day of a week. 01-plan.md § 4.1.
// TSK-06 — the task page's week strip and summary read the same tallies. Its 01-plan.md § 4.6.
//
// Pure: no React, no seam, no clock. **IT IS NOT AN ABSENCE COUNT AND NOTHING HERE FEEDS
// `absenceCountsFor`** — a task is not an entry, and this module imports nothing from absence,
// day-status or busy, so INV-04's one definition is not reached from here (§ 2, AC-11).
import type { DateRange, Task } from "@/lib/domain/types";
import { MONTH_NAMES, mondayIndex, shiftDay } from "@/lib/period";

/** One day's tally. `total >= 1` always — a day with no task has no entry. */
export interface DayTaskTally {
  done: number;
  total: number;
}

/** AC-1..AC-4. For each date in `range` (inclusive) that holds at least one task in `tasks`, its
 *  tally. Tasks outside `range` are ignored. Days without tasks are absent from the map. Pure; does
 *  not mutate its input. Does not filter by owner — `listTasks` returns only the caller's rows. */
export function taskTalliesFor(
  tasks: readonly Task[],
  range: DateRange,
): ReadonlyMap<string, DayTaskTally> {
  const tallies = new Map<string, DayTaskTally>();
  for (const t of tasks) {
    // `yyyy-MM-dd` compares correctly as a string, the comparison every pure module here uses.
    if (t.date < range.start || t.date > range.end) continue;
    const tally = tallies.get(t.date) ?? { done: 0, total: 0 };
    tallies.set(t.date, { done: tally.done + (t.done ? 1 : 0), total: tally.total + 1 });
  }
  return tallies;
}

/** AC-1. The badge's visible text: `${done}/${total}`. */
export function tallyText(tally: DayTaskTally): string {
  return `${tally.done}/${tally.total}`;
}

/** AC-1. The badge's accessible name: `${done} of ${total} tasks done`; "task" when total === 1. */
export function tallyLabel(tally: DayTaskTally): string {
  return `${tally.done} of ${tally.total} ${tally.total === 1 ? "task" : "tasks"} done`;
}

// ---------------------------------------------------------------------------
// TSK-06 — the task page's week strip and summary. 01-plan.md § 4.6.
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES: readonly string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** AC-11. The seven `yyyy-MM-dd` days, Monday first, of the week holding `day` — the calendar's week
 *  (`mondayIndex`). */
export function weekDaysOf(day: string): string[] {
  const monday = shiftDay(day, -mondayIndex(day));
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}

/** AC-12. "✓" when the day has tasks and all are done; "done/total" when some are not; "–" (U+2013)
 *  when it has none. */
export function stripMark(tally: DayTaskTally | undefined): string {
  if (!tally || tally.total === 0) return "–";
  return tally.done === tally.total ? "✓" : tallyText(tally);
}

/** AC-12. The cell's accessible name: *Monday 27 April, 2 of 2 tasks done*, *…, no tasks*. The count
 *  is `tallyLabel`'s, singular included, so the strip and TSK-04's badge say it one way. */
export function stripCellLabel(day: string, tally: DayTaskTally | undefined): string {
  const name = `${WEEKDAY_NAMES[mondayIndex(day)]} ${Number(day.slice(8, 10))} ${MONTH_NAMES[Number(day.slice(5, 7)) - 1]}`;
  return tally && tally.total > 0 ? `${name}, ${tallyLabel(tally)}` : `${name}, no tasks`;
}

/** AC-21. The sum over the map; `{ done: 0, total: 0 }` when it is empty. */
export function weekTotals(tallies: ReadonlyMap<string, DayTaskTally>): DayTaskTally {
  let done = 0;
  let total = 0;
  for (const t of tallies.values()) {
    done += t.done;
    total += t.total;
  }
  return { done, total };
}
