// SOLO, 2026-09-10 — what a set of chosen days means, and the month grid one is chosen on.
//
// The entry form used to hold two `<input type="date">` controls, so "which days" was already a
// range by the time any code saw it. The picker the operator's design asks for hands over a SET of
// days instead — the mock shows the 1st selected on its own beside a run of the 8th to the 12th —
// and something has to say what a set means to a datastore whose entry row carries `start_date` and
// `end_date`. That is `dateRuns`, and its answer is: one entry per unbroken run.
//
// **PURE, AND IT IMPORTS NOTHING FROM `src/lib/data/`,** exactly as `@/lib/period` does and for the
// same reason. It is string arithmetic over `yyyy-MM-dd`; it fetches nothing, names no column and
// holds no clock. RULE-02 holds here by construction — there is no import for eslint.config.js to
// fire on.
//
// **AND IT DECIDES NOTHING ABOUT WHAT A DAY COSTS.** INV-04 lives in `src/lib/data/absence.ts` and
// this module never counts, weighs or compares anybody. It groups dates.
import { mondayIndex, shiftDay, shiftMonth } from "@/lib/period";

/** One unbroken run of chosen days, in the shape the seam's create and update inputs already take.
 *  `endDate` is INCLUSIVE — CAL-01 AC-3, and the same meaning the column has. */
export interface DateRun {
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive
}

/** Every `yyyy-MM-dd` from `startDate` to `endDate` inclusive, ascending. An inverted pair yields
 *  the empty list rather than looping: this is a display helper, and the seam is what refuses. */
export function datesInRange(startDate: string, endDate: string): string[] {
  if (startDate === "" || endDate === "" || startDate > endDate) return [];

  const out: string[] = [];
  for (let day = startDate; day <= endDate; day = shiftDay(day, 1)) out.push(day);
  return out;
}

/** `dates` with `date` added if it was absent and removed if it was present, always sorted and
 *  without duplicates. The picker's whole interaction, in one pure function, so the component holds
 *  no rule about what a second click means. */
export function toggleDate(dates: readonly string[], date: string): string[] {
  const next = dates.includes(date)
    ? dates.filter((existing) => existing !== date)
    : [...dates, date];
  return [...new Set(next)].sort();
}

/**
 * The chosen days gathered into unbroken runs, ascending.
 *
 * `['2026-04-01', '2026-04-08', '2026-04-09']` is TWO runs — the 1st alone, and the 8th to the 9th.
 * This is the whole reason a set of days can reach a datastore that stores ranges, and it is the
 * one place that translation happens: three call sites (the two create paths and the edit path) all
 * read it, so none of them can decide it differently.
 *
 * Duplicates and disorder in the input are tolerated and normalised. The empty set is no runs, which
 * is what makes an empty picker an incomplete form rather than a write of nothing.
 */
export function dateRuns(dates: readonly string[]): DateRun[] {
  const [head, ...rest] = [...new Set(dates)].filter((date) => date !== "").sort();
  // `head === undefined` and not `length === 0`: `noUncheckedIndexedAccess` is on, and the check
  // that narrows the type is the check that states the case.
  if (head === undefined) return [];

  const runs: DateRun[] = [];
  let start = head;
  let previous = head;

  for (const day of rest) {
    // The comparison is `shiftDay(previous, 1)` and never a subtraction of two parsed dates: the
    // strings are the values everywhere else in this product, and a `new Date(...)` here would be
    // the local-midnight trap CAL-01 01-plan.md § 4.5 records.
    if (day !== shiftDay(previous, 1)) {
      runs.push({ startDate: start, endDate: previous });
      start = day;
    }
    previous = day;
  }

  runs.push({ startDate: start, endDate: previous });
  return runs;
}

/**
 * The whole weeks a `yyyy-MM` is drawn on, Monday first — 35 or 42 days, including the leading and
 * trailing days of the neighbouring months.
 *
 * The same shape `src/routes/MonthView.tsx` builds for the calendar grid, which is deliberate: the
 * picker in the modal and the grid behind it should not disagree about which column a date is in.
 * That screen builds it from `@/lib/data/absence`; this module may not import the seam directory, so
 * the two are built from the same `mondayIndex` and differ in nothing else.
 */
export function monthGridDays(month: string): string[] {
  const first = `${month}-01`;
  // The last of the month, without a table of month lengths: the day before the first of the next.
  const last = shiftDay(`${shiftMonth(month, 1)}-01`, -1);
  return datesInRange(shiftDay(first, -mondayIndex(first)), shiftDay(last, 6 - mondayIndex(last)));
}
