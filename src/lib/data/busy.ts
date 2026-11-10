// SOLO, 2026-09-11 — the ONE definition of "how many people called this day busy".
//
// **THIS IS NOT INV-04 AND MUST NEVER BE FOLDED INTO IT.** INV-04 governs the ABSENCE count — who is
// away — and it is what the crowded-day warning is computed from. A busy person is at work. The two
// numbers answer different questions about the same date and are never added, compared, or drawn as
// one figure. `src/lib/domain/types.ts` carries the argument for why a busy day is not an `Entry` at
// all; this file is the arithmetic that follows from it.
//
// **IT SITS BESIDE `absence.ts` AND COPIES ITS DISCIPLINE ON PURPOSE.** That module's header records
// the rule and `.ai/registry/features.md:91` is where it comes from: one pure function, in one shared
// module inside `src/lib/data/`, imported by the views and reimplemented in neither seam. The fear
// that rule answers is two arithmetics that `tests/seam-parity.test.ts` cannot see — it compares
// names and arity, not maths. With zero copies inside the seam there is nothing for it to miss.
//
// **NEITHER SEAM IMPLEMENTATION IMPORTS THIS FILE.** `mock.ts` and `supabase.ts` return ROWS and
// count nothing, exactly as they do for entries and for day statuses.
//
// **IT FETCHES NOTHING.** Every input is passed in. It constructs no client and names no column.
//
// **EVERY COMPARISON IS ON `yyyy-MM-dd` STRINGS AND NO LOCAL DATE ACCESSOR APPEARS HERE.** ADR-015
// names the trap and predicts it passes every test run in Vietnam: `new Date('2026-06-11')` parses as
// UTC midnight, so a weekday read west of UTC yields the previous day. `eachDateInRange` comes from
// `./absence`, which does its arithmetic through UTC for the same reason.
import { eachDateInRange } from "./absence";
import type { BusyCounts, BusyDay, DateRange, Member } from "../domain/types";

/**
 * The one pass. Every derivation below reads it and none filters on its own, for the reason
 * `absence.ts` gives at length: a second filter is a second chance to disagree.
 *
 * **THE REMOVED-MEMBER RULE IS COPIED FROM ADR-013 DELIBERATELY, AND IT IS THIS MODULE'S OWN RULE
 * RATHER THAN INV-04's.** A member counts on a date when `removedAt` is null or strictly after that
 * date. The reason is the same one ADR-013 gives for absences — somebody who left in June was still
 * on the team in March, and a past week that silently loses them tells the reader the team was
 * smaller than it was. Stating it here rather than citing INV-04 is the point: this number is not
 * governed by that invariant and must not start borrowing its authority.
 *
 * A row whose member is not in `roster` at all contributes nothing. That is another team's row, or a
 * row belonging to somebody the read did not return, and counting it would be counting a person the
 * screen cannot name.
 */
function walk(
  busyDays: readonly BusyDay[],
  range: DateRange,
  roster: readonly Member[],
  visit: (date: string, member: Member) => void,
): void {
  const byId = new Map(roster.map((m) => [m.id, m]));

  for (const row of busyDays) {
    if (row.date < range.start || row.date > range.end) continue;

    const member = byId.get(row.memberId);
    if (!member) continue;
    if (member.removedAt !== null && member.removedAt <= row.date) continue;

    visit(row.date, member);
  }
}

/**
 * How many members marked each date busy.
 *
 * **A PERSON COUNTS ONCE PER DATE.** The datastore's `unique (member_id, date)` makes two rows for
 * one person on one date unrepresentable, and the `Set` below holds that here too rather than
 * trusting it — the mock has no constraint, and a count that disagreed with the database under one
 * seam and not the other is the exact failure this module's single-definition rule exists to prevent.
 *
 * **A WHOLE NUMBER, NEVER A HALF.** A busy day has no portion, so there is no 0.5 here and nothing
 * to round. `absenceCountsFor` deals in halves; the two numbers are never drawn as one.
 *
 * Every date in `range` is present, carrying 0 where nobody is busy.
 *
 * @param busyDays every busy-day row overlapping `range`. The seam returns rows and filters nothing
 *                 beyond its own team scope.
 * @param range    inclusive at both ends.
 * @param roster   the team's members, INCLUDING removed ones — `walk` needs `removedAt` per member
 *                 to decide each date, so a pre-filtered roster cannot answer a past week.
 *                 `listMembers` returns the roster in exactly that shape.
 */
export function busyCountsFor(
  busyDays: readonly BusyDay[],
  range: DateRange,
  roster: readonly Member[],
): BusyCounts {
  const seen = new Map<string, Set<string>>();
  for (const date of eachDateInRange(range)) seen.set(date, new Set());

  walk(busyDays, range, roster, (date, member) => {
    seen.get(date)?.add(member.id);
  });

  return new Map([...seen].map(([date, ids]) => [date, ids.size] as [string, number]));
}

/**
 * Who marked each date busy, derived from the SAME pass as the counts rather than from a second
 * filter. The operator chose "count plus names" when asked, and this is the names half: the count
 * and the list can only ever disagree if `walk` itself is wrong.
 *
 * Sorted by display name, then by id so the order is total and a render is stable across reads — two
 * people sharing a display name would otherwise swap places between loads.
 *
 * Every date in `range` is present, carrying an empty array where nobody is busy — the contract
 * `busyCountsFor` keeps, so a caller iterating one map can index the other without a fallback.
 */
export function busyMembersFor(
  busyDays: readonly BusyDay[],
  range: DateRange,
  roster: readonly Member[],
): ReadonlyMap<string, readonly Member[]> {
  const seen = new Map<string, Map<string, Member>>();
  for (const date of eachDateInRange(range)) seen.set(date, new Map());

  walk(busyDays, range, roster, (date, member) => {
    seen.get(date)?.set(member.id, member);
  });

  return new Map(
    [...seen].map(([date, members]) => {
      const people = [...members.values()].sort((a, b) =>
        a.displayName === b.displayName
          ? a.id.localeCompare(b.id)
          : a.displayName.localeCompare(b.displayName),
      );
      return [date, people] as [string, readonly Member[]];
    }),
  );
}

/**
 * The dates in `range` that `memberId` has marked, as a set the caller can test in constant time.
 *
 * **IT IS WHAT MAKES A PRESS A TOGGLE**, and it is derived from the same rows everybody else is
 * counted from rather than from a second read of the caller's own rows. A screen holding its own
 * private copy of "which days are mine" is a second answer to a question the team-wide read already
 * answers, free to disagree with the number drawn beside it.
 *
 * **IT DOES NOT APPLY THE REMOVED-MEMBER RULE**, and that asymmetry is deliberate: this answers
 * *does a row exist for me on this date*, which decides whether a press creates or deletes. A removed
 * member reaches no screen that renders the control, and making the control's state depend on the
 * counting rule would let the button disagree with the datastore about what a press will do.
 */
export function busyDatesOf(
  busyDays: readonly BusyDay[],
  range: DateRange,
  memberId: string,
): ReadonlySet<string> {
  const dates = new Set<string>();
  for (const row of busyDays) {
    if (row.memberId !== memberId) continue;
    if (row.date < range.start || row.date > range.end) continue;
    dates.add(row.date);
  }
  return dates;
}

/**
 * The caller's own mark, applied to the rows a view is holding, WITHOUT a read.
 *
 * **THIS IS THE OPTIMISTIC PREDICTION AND IT LIVES HERE FOR THE REASON THE HEADER GIVES.** The
 * operator asked, 2026-09-11, that a press update the busy figure without the calendar reloading:
 * the press writes, the number moves immediately, and only a REFUSED write puts it back. That makes
 * the on-screen count briefly a number this application predicted rather than one the datastore
 * produced — the trade the operator chose, knowing it — so the prediction is one function in the
 * module that does the counting, never a splice written inside a view. Two views predicting
 * separately is exactly the second arithmetic this file exists to prevent.
 *
 * **IT PREDICTS ONLY THE CALLER'S OWN ROW, WHICH IS ALL A PRESS CAN KNOW.** Somebody else marking
 * the same date between the last read and this press is not represented here and cannot be: the
 * next read of the range carries them. The prediction is therefore exact for the half it covers —
 * `busy_day` is `unique (member_id, date)`, so marking a date I already hold changes nothing and
 * unmarking one I do not hold changes nothing, both of which this function returns unchanged.
 *
 * **THE SYNTHETIC ROW'S `id` AND `createdAt` NEVER REACH A SCREEN.** `busyCountsFor`,
 * `busyMembersFor` and `busyDatesOf` read `memberId` and `date` and nothing else; the two remaining
 * fields exist because `BusyDay` has them. `id` is marked so a row that somehow outlived its write
 * is recognisable in a debugger rather than looking like a datastore id.
 *
 * @returns a new array. The caller's previous array is untouched and is what a failed write is
 *          reverted to.
 */
export function withOwnBusyMark(
  busyDays: readonly BusyDay[],
  memberId: string,
  date: string,
  busy: boolean,
): BusyDay[] {
  const without = busyDays.filter((row) => !(row.memberId === memberId && row.date === date));
  if (!busy) return without;

  return [
    ...without,
    { id: `optimistic:${memberId}:${date}`, memberId, date, createdAt: new Date().toISOString() },
  ];
}
