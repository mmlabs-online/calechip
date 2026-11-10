// CAL-08 — the ONE definition of "is this a working day", and of which working day is a bridge day.
// 01-plan.md sections 4.1 and 4.2.
//
// It is in src/lib/data/ because .ai/registry/features.md:95 puts it there by name: "one module,
// `dayStatusesFor`, inside `src/lib/data/` beside the `absenceCountsFor` function CAL-04 builds,
// imported by both seam implementations and reimplemented in neither". The same sentence CAL-04
// answered, answered the same way.
//
// **NEITHER SEAM IMPLEMENTATION IMPORTS THIS FILE, AND THAT IS THE DECISION (01-plan.md section
// 4.2).** The registry's fear is two answers that tests/seam-parity.test.ts cannot see — it compares
// names and arity — and with zero copies inside the seam there is nothing for it to miss. mock.ts
// and supabase.ts return ROWS and derive nothing; the three views import this module directly,
// exactly as they already import ./absence.
//
// **IT FETCHES NOTHING.** Every input is passed in. It constructs no client and names no column, so
// .ai/registry/boundaries.json's one boundary is untouched even though this file sits inside the
// directory that boundary exempts.
//
// **THE WEEKEND RULE IS MODULE-PRIVATE AND IS NEVER EXPORTED.** The registry row: "a component
// asking `isSaturday(d)` on its own is the second definition." Exporting it would be publishing
// exactly that second definition. The only way to read it from outside is
// `DayStatus.nonWorkingReason === "weekend"`.
//
// **EVERY COMPARISON IS ON `yyyy-MM-dd` STRINGS AND NO LOCAL DATE ACCESSOR APPEARS HERE.** ADR-015
// Consequences names the trap and predicts it passes every test run in Vietnam:
// `new Date('2026-06-11')` parses as UTC midnight, so a weekday read west of UTC yields the previous
// day and the bridge day moves. `addDays` and `eachDateInRange` come from ./absence, which does its
// arithmetic through UTC for the same reason; the weekend rule below reads `getUTCDay` and never
// `getDay`. AC-15 is the assertion.
import { addDays, eachDateInRange } from "./absence";
import type { DateRange, DayStatus, DayStatuses, Holiday, NonWorkingReason } from "../domain/types";

/**
 * How far outside the requested range `holidays` must reach. See `holidayReadRange`.
 *
 * Assumption A1 (01-plan.md section 2, Open questions 1) needs exactly 1. It is 7 because that
 * question is still the operator's: a pad of 1 encodes the answer at every call site, and 7 covers
 * any run a week or shorter, so changing the predicate later changes the predicate and nothing else.
 * The cost is at most fourteen extra rows against a calendar of roughly fifteen a year.
 */
export const BRIDGE_LOOKAROUND_DAYS = 7;

/**
 * The range to pass to `seam.listHolidays` when the dates you intend to draw are `range`.
 *
 * `dayStatusesFor` IS NOT TOTAL ON ITS OWN RANGE (.ai/registry/features.md:95): deciding whether the
 * first day of a range is a bridge day needs the day before it. Exported so the three views share
 * one pad rather than each writing an expression — a call site that fetched the bare range would be
 * wrong only at the two edges of a screen, which is the failure nobody reports (01-plan.md section
 * 8, rejected alternative 2).
 */
export const holidayReadRange = (range: DateRange): DateRange => ({
  start: addDays(range.start, -BRIDGE_LOOKAROUND_DAYS),
  end: addDays(range.end, BRIDGE_LOOKAROUND_DAYS),
});

/**
 * The weekend rule, and the third of the three inputs ADR-015 section 4 requires. Saturday and
 * Sunday, read in UTC.
 *
 * `getUTCDay` returns 0 for Sunday and 6 for Saturday. It is NOT `mondayIndex` from the views: those
 * answer "which column is this date in" and this answers "is this a weekend", and folding the two
 * would make a layout decision load-bearing for the calendar.
 */
const WEEKEND_UTC_DAYS: ReadonlySet<number> = new Set([0, 6]);

const isWeekend = (date: string): boolean =>
  WEEKEND_UTC_DAYS.has(new Date(`${date}T00:00:00Z`).getUTCDay());

/**
 * The status of every date in `range`, inclusive at both ends.
 *
 * @param holidays every `holiday` row in `holidayReadRange(range)`, BOTH KINDS. The function cannot
 *                 tell a date with no row from a date you did not fetch, so passing the bare range
 *                 silently mis-answers the two edges (01-plan.md section 2, Open questions 4).
 * @param range    the dates to report. Keys outside it never appear in the answer.
 *
 * Pure. Fetches nothing, constructs no client, names no column.
 *
 * The derivation, from 01-plan.md section 4.2:
 *
 * 1. `working` is false when a `non_working` row falls on the date; true when a `working` row does;
 *    otherwise the weekend rule decides. THE ROW ALWAYS WINS OVER THE RULE — that is what makes a
 *    mandated Saturday representable and is the whole of ADR-015 section 2. `unique (date)` makes it
 *    single-valued (ADR-015 section 3), so there is no precedence between two rows to invent.
 * 2. `nonWorkingReason` is "holiday" when a `non_working` row exists, "weekend" when the rule alone
 *    decided it, and null when `working` is true.
 * 3. `holiday` is the row on that date whatever its `kind`, so a `working` Saturday can be named.
 * 4. `bridge` is true when `working` is true AND the day before and the day after are both not
 *    working. That is A1 and A2 together, and every input it needs for the edges of `range` comes
 *    from the padded read.
 *
 * THREE INPUTS, ONE ARRAY. `Holiday.kind` discriminates the non-working and working overrides inside
 * one array and the weekend rule is the module constant above, so all three facts ADR-015 section 4
 * requires reach the derivation. Two parameters would put a `.filter(h => h.kind === …)` at every
 * call site — the second definition in a different costume, 01-plan.md section 8, rejected
 * alternative 3.
 */
export function dayStatusesFor(holidays: readonly Holiday[], range: DateRange): DayStatuses {
  // `unique (date)` on the table makes this single-valued, so a later row cannot be a second answer
  // for a date — there is no precedence to invent and none is written.
  const rows = new Map<string, Holiday>(holidays.map((holiday) => [holiday.date, holiday]));

  // Rule 1, written ONCE and asked three times per date — for the date itself and for both of its
  // neighbours. A `bridge` test that re-derived "not working" for the neighbours would be the second
  // definition this module exists to prevent, two lines below the comment saying so.
  const isWorking = (date: string): boolean => {
    const row = rows.get(date);
    if (row) return row.kind === "working";
    return !isWeekend(date);
  };

  const statuses = new Map<string, DayStatus>();

  for (const date of eachDateInRange(range)) {
    const holiday = rows.get(date) ?? null;
    const working = isWorking(date);

    // Rule 2. `holiday` wins over `weekend` on a `non_working` Sunday: the row is the more specific
    // fact and it carries a name to draw.
    const nonWorkingReason: NonWorkingReason | null = working
      ? null
      : holiday !== null
        ? "holiday"
        : "weekend";

    // Rule 4. AC-3, AC-4 and AC-5. Both neighbours are read through `isWorking`, so the mandated
    // working Saturday of 2026-06-13 makes Friday 2026-06-12 an ordinary working day and not a
    // bridge day — the false positive a two-input computation produces (ADR-015 section 4).
    const bridge = working && !isWorking(addDays(date, -1)) && !isWorking(addDays(date, 1));

    statuses.set(date, { date, working, nonWorkingReason, holiday, bridge });
  }

  return statuses;
}
