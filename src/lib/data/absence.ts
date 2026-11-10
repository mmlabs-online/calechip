// CAL-04 — INV-04's ONE definition of the absence count. 01-plan.md sections 4 and 5.
//
// It is in src/lib/data/ because .ai/registry/features.md:91 puts it there by name: "a pure function
// in one shared module inside `src/lib/data/`, imported by both seam implementations and
// reimplemented in neither". 01-plan.md section 8 records the disagreement — this is a domain
// computation and src/lib/domain/ is arguably its home — and resolves it in the registry's favour,
// because RULE-04 makes the registry row the source. Moving it costs one `git mv` and one import.
//
// **NEITHER SEAM IMPLEMENTATION CALLS IT, AND THAT IS THE DECISION (01-plan.md section 5).** The
// registry's fear is two arithmetics that tests/seam-parity.test.ts cannot see: same names, same
// arity, different maths. With zero copies inside the seam there is nothing for the parity test to
// miss — mock.ts and supabase.ts return ROWS and count nothing, and the month view imports this
// module directly.
//
// **IT FETCHES NOTHING.** Every input is passed in. That is what makes it usable by CAL-07, which
// must compute the count a day WILL have if the draft in the form is saved — an unsaved entry has no
// row, so a datastore-side aggregate could not be the only implementation and INV-04 would need a
// second one in TypeScript. That is the whole reason a PostgreSQL view was rejected (section 8).
//
// This file imports nothing from ./index and nothing from either implementation. It may be imported
// from any layer; it names no column and constructs no client.
import type {
  AbsenceCounts,
  AbsenceDetail,
  DateRange,
  Entry,
  EntryPortion,
  Member,
} from "../domain/types";

// ---------------------------------------------------------------------------
// The date vocabulary. `yyyy-MM-dd` strings throughout, and every arithmetic goes through UTC.
//
// `new Date('2026-04-30')` parses as UTC midnight and a day-of-month read west of UTC yields the
// previous day — CAL-01 01-plan.md section 4.5 records that trap, and `Entry.startDate` is a string
// because of it. So the two helpers below convert to a UTC instant and back, and no local-timezone
// accessor (`getDate`, `getMonth`, `getFullYear`) appears anywhere in this file or in its callers.
// The round trip is exact for every date the product can hold.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** `yyyy-MM-dd` to the UTC midnight instant it names. */
const toInstant = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** The inverse. `toISOString` is UTC by definition, so this cannot drift with the machine. */
const toDate = (instant: number): string => new Date(instant).toISOString().slice(0, 10);

/** `date` moved by `days`, which may be negative. Exported: the month grid needs the same one. */
export const addDays = (date: string, days: number): string =>
  toDate(toInstant(date) + days * DAY_MS);

/**
 * Every date in `range`, inclusive at both ends, ascending. Empty when `end` is before `start`.
 *
 * Exported because the month grid walks the same vocabulary, and two walkers would be two places
 * where "inclusive" is decided.
 */
export function eachDateInRange(range: DateRange): string[] {
  const dates: string[] = [];
  const last = toInstant(range.end);
  for (let at = toInstant(range.start); at <= last; at += DAY_MS) dates.push(toDate(at));
  return dates;
}

/**
 * The predicate `listTeamEntriesOverlapping` asks the datastore for, written once here so a caller
 * that already holds rows narrows them the same way the read did. OVERLAP, not containment: an entry
 * running 2026-03-28 to 2026-04-02 overlaps April.
 */
export const overlapsRange = (entry: Entry, range: DateRange): boolean =>
  entry.startDate <= range.end && entry.endDate >= range.start;

// ---------------------------------------------------------------------------
// INV-04.
// ---------------------------------------------------------------------------

/**
 * AC-3. `full` is one whole person-day, `am` and `pm` are half of one each.
 *
 * `type` IS NEVER CONSULTED: a PTO day and a WFH day weigh the same, because the count answers "how
 * much of the team is not in the office" and a WFH member is not in the office. A WFH member IS
 * working — glossary.md calls that the single most costly confusion in the domain — and that fact
 * changes what the screen SAYS about a person, never what the day costs the room.
 */
const WEIGHT: Record<EntryPortion, number> = {
  full: 1,
  am: 0.5,
  pm: 0.5,
};

/**
 * The one place INV-04's membership clause is written: an entry counts on a date only when its
 * member has `removedAt` null, or `removedAt` STRICTLY AFTER that date.
 *
 * AC-6 and ADR-013. A member removed at 2026-04-15T00:00:00Z counts on 14 April and not on 15 April,
 * which is why the comparison is against the removal instant's DATE and is strict. `removedAt` is an
 * ISO 8601 timestamp and `date` is `yyyy-MM-dd`, so the first ten characters are the comparable part
 * and the lexicographic comparison is the chronological one.
 *
 * An entry whose member is not in `roster` counts for NOBODY. That is not defensive coding: the
 * roster and the entries come from the same team-scoped reads, so a member-less entry means the two
 * disagree, and counting a person the screen cannot draw would break INV-04's own clause that a view
 * shows a member's avatar exactly when that member's entry is counted.
 */
const countsOn = (member: Member | undefined, date: string): member is Member =>
  member !== undefined && (member.removedAt === null || member.removedAt.slice(0, 10) > date);

/** `roster` as a lookup. Built once per call rather than once per entry per date. */
const byId = (roster: readonly Member[]): Map<string, Member> =>
  new Map(roster.map((member) => [member.id, member]));

/**
 * Which entries touch which date, with the membership and status rules already applied. ONE pass,
 * and it is the reason `absenceCountsFor` and `absentMembersFor` cannot disagree: both read this.
 *
 * `status: "rejected"` contributes nothing (AC-4). `tentative` is never consulted, so a tentative
 * entry counts on the same terms as any other (AC-5, INV-05) — glossary.md keeps `tentative` and
 * `status` apart as two axes, and this function reads exactly one of them.
 */
function walk(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
  visit: (date: string, entry: Entry, member: Member) => void,
): void {
  const members = byId(roster);

  for (const entry of entries) {
    // AC-4. The ONLY status test in the product, and the reason `listTeamEntriesOverlapping` returns
    // rejected rows rather than filtering them: a second copy of this line inside the seam is
    // exactly what INV-04 exists to prevent.
    if (entry.status === "rejected") continue;

    const member = members.get(entry.memberId);

    // The dates this entry contributes to, clamped to the range. An entry may start before it and
    // end after it — that is what OVERLAP means — and the clamp is what keeps a key outside the
    // requested range from ever appearing in the answer.
    const from = entry.startDate > range.start ? entry.startDate : range.start;
    const to = entry.endDate < range.end ? entry.endDate : range.end;

    for (const date of eachDateInRange({ start: from, end: to })) {
      if (!countsOn(member, date)) continue; // AC-6, ADR-013
      visit(date, entry, member);
    }
  }
}

/**
 * CAL-05. The order rows appear in within one date, fixed HERE rather than left to the datastore.
 *
 * Two implementations returning rows in different orders is the divergence
 * `tests/seam-parity.test.ts` cannot see — it compares names and arity, not row order — so the
 * screen would be stable on the mock and shuffle on Supabase with nothing reporting it. Sorting
 * above the seam makes the order a property of this module instead.
 *
 * By `displayName` ascending, then by `portion` in the order `full`, `am`, `pm`, then by `entry.id`.
 * The last is what makes the render deterministic when one member holds an `am` and a `pm` on one
 * day, which is the only case where the first two both tie.
 *
 * The collation is explicitly `vi` rather than the host default. `localeCompare` with no locale
 * reads the machine's, so the same rows would order differently in CI and on a developer's laptop
 * — and these are Vietnamese display names, where `Đ` sorts after `D` and not after `T`.
 */
const PORTION_ORDER: Record<EntryPortion, number> = { full: 0, am: 1, pm: 2 };

const byDisplayThenPortionThenId = (a: AbsenceDetail, b: AbsenceDetail): number =>
  a.member.displayName.localeCompare(b.member.displayName, "vi") ||
  PORTION_ORDER[a.entry.portion] - PORTION_ORDER[b.entry.portion] ||
  (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0);

/** Every date in `range` at zero. AC-9 and the contract on `AbsenceCounts`: a caller never has to
 *  distinguish an absent key from a zero, because there are no absent keys. */
const zeroed = (range: DateRange): Map<string, number> =>
  new Map(eachDateInRange(range).map((date) => [date, 0]));

/**
 * THE one definition of the absence count (INV-04). Pure, takes rows, fetches nothing.
 *
 * @param entries every entry overlapping `range`, REJECTED ONES INCLUDED — this function excludes
 *                them, and it is the only thing that may.
 * @param range   inclusive at both ends.
 * @param roster  the team's members, INCLUDING removed ones: ADR-013 needs `removedAt` per member to
 *                decide each date, so a pre-filtered roster cannot answer AC-6. `listMembers`
 *                returns the roster in exactly that shape, and 02-design.md section 3 records that
 *                a seam which filtered it would make INV-04 uncomputable for every past date.
 *
 * Rules, each one an acceptance criterion: 1 for `full` and 0.5 for `am` or `pm` (AC-3); `type` is
 * never consulted, so PTO and WFH weigh the same (AC-3); `status: "rejected"` contributes nothing
 * (AC-4); `tentative` is never consulted, so a tentative entry counts (AC-5); an entry counts on a
 * date only when its member has `removedAt` null or `removedAt` strictly after that date (AC-6).
 *
 * INV-01 makes the sum safe from double-counting a person: two entries of the same member cannot
 * overlap on the same slot, so `am` plus `pm` on one date is 1.0 and never 1.5.
 */
export function absenceCountsFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): AbsenceCounts {
  const counts = zeroed(range);
  walk(entries, range, roster, (date, entry) => {
    counts.set(date, (counts.get(date) ?? 0) + WEIGHT[entry.portion]);
  });
  return counts;
}

/**
 * The members whose avatar is drawn on each date. Derived from the SAME pass as the counts, not from
 * a second filter — INV-04 says a view shows a member's avatar exactly when that member's entry is
 * counted, and two passes are two chances to disagree (AC-2, AC-4, AC-6).
 *
 * A member holding two entries on one date (`am` and `pm`) appears ONCE. The count is 1.0 and the
 * grid draws one person, which is the same fact told two ways.
 *
 * Every date in `range` is present, carrying an empty array where nobody is away — the same contract
 * `absenceCountsFor` keeps, so a caller iterating one map can index the other without a fallback.
 */
export function absentMembersFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): ReadonlyMap<string, readonly Member[]> {
  const seen = new Map<string, Map<string, Member>>();
  for (const date of eachDateInRange(range)) seen.set(date, new Map());

  walk(entries, range, roster, (date, _entry, member) => {
    seen.get(date)?.set(member.id, member);
  });

  return new Map(
    [...seen].map(([date, members]) => [date, [...members.values()]] as [string, readonly Member[]]),
  );
}

/**
 * CAL-05. Every absent person on every date in `range`, WITH the entry that puts them there, derived
 * from the SAME `walk` that produces `absenceCountsFor` and `absentMembersFor`.
 *
 * **This is the third derivation and not a second definition.** INV-04's rules — rejected excluded,
 * tentative never consulted, a member counting only while `removedAt` is null or strictly after the
 * date, an entry clamped to the requested range — are applied exactly once, inside `walk`, and all
 * three exported functions read that one pass. A week list that disagreed with a month cell would
 * require `walk` itself to be wrong, which is the only failure mode INV-04 leaves open. The
 * alternative — filtering `entries` inside the view — is CAL-05 01-plan.md section 8, rejected
 * alternative 1, and it is rejected because those four lines ARE these rules written a second time.
 *
 * **ONE MEMBER MAY APPEAR TWICE ON ONE DATE, and that is correct here where it is not in
 * `absentMembersFor`:** an `am` entry and a `pm` entry are two facts about the day, and per-person
 * detail is this derivation's whole job. The count for that date is still 1.0 and the month grid
 * still draws one avatar — the same fact told three ways, which is what INV-04 requires.
 *
 * Every date in `range` is present, carrying an empty array where nobody is away — the contract the
 * other two keep, so a caller iterating one map can index the others without a fallback (AC-13).
 *
 * @param entries every entry overlapping `range`, REJECTED ONES INCLUDED — `walk` excludes them, and
 *                it is the only thing that may (AC-10).
 * @param range   inclusive at both ends.
 * @param roster  the team's members, INCLUDING removed ones, exactly as `absenceCountsFor` takes
 *                them: ADR-013 needs `removedAt` per member to decide each date (AC-11).
 */
export function absentEntriesFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): ReadonlyMap<string, readonly AbsenceDetail[]> {
  const found = new Map<string, AbsenceDetail[]>();
  for (const date of eachDateInRange(range)) found.set(date, []);

  walk(entries, range, roster, (date, entry, member) => {
    found.get(date)?.push({ entry, member });
  });

  for (const details of found.values()) details.sort(byDisplayThenPortionThenId);

  return found;
}

/**
 * CAL-06. For each member of `roster`, the set of dates in `range` on which they are away — derived
 * from the SAME `walk` that produces `absenceCountsFor`, `absentMembersFor` and `absentEntriesFor`.
 *
 * **This is the fourth derivation and not a second definition.** INV-04's rules — rejected excluded,
 * tentative never consulted, a member counting only while `removedAt` is null or strictly after the
 * date, an entry clamped to the requested range — are applied exactly once, inside `walk`, and all
 * four exported functions read that one pass. A filled cell that disagreed with a day's total would
 * require `walk` itself to be wrong, which is the only failure mode INV-04 leaves open (CAL-06 AC-9,
 * AC-10). The alternative — transposing `absentEntriesFor` in the component, or filtering `entries`
 * there — is CAL-06 01-plan.md section 8, rejected alternative 3.
 *
 * **EVERY MEMBER OF `roster` IS A KEY, carrying an empty set where they are away on no date.** That
 * is CAL-06 AC-3, and it is the property that makes the year view the only screen enumerating
 * members with no entries: a map built from the entries alone would silently omit them, and the
 * omission would look like a member who is never away rather than a member the grid forgot. It is
 * the same contract the other three derivations keep along the date axis, turned the other way
 * round.
 *
 * **A member holding an `am` and a `pm` entry on one date yields that date ONCE.** The set answers
 * "is this member away on this day", the day's total is still 1.0, and the two are the same fact
 * told twice — which is what INV-04 requires rather than forbids.
 *
 * @param entries every entry overlapping `range`, REJECTED ONES INCLUDED — `walk` excludes them, and
 *                it is the only thing that may.
 * @param range   inclusive at both ends.
 * @param roster  the team's members, INCLUDING removed ones, exactly as the other three take them:
 *                ADR-013 needs `removedAt` per member to decide each date (CAL-06 AC-8).
 */
export function absentDatesByMember(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): ReadonlyMap<string, ReadonlySet<string>> {
  // Keyed on the ROSTER and not on the entries, which is the whole of AC-3.
  const away = new Map<string, Set<string>>(roster.map((member) => [member.id, new Set<string>()]));

  // `walk` only ever visits a member it found in `roster` (`countsOn` refuses an undefined one), so
  // every key it reaches was created above and no fallback is needed here.
  walk(entries, range, roster, (date, _entry, member) => {
    away.get(member.id)?.add(date);
  });

  return away;
}

/**
 * AC-7, AC-8. `count / currentMembers > threshold`, STRICTLY greater.
 *
 * Strict is not a detail: a team of six at a threshold of 0.5 with three people away is EXACTLY the
 * threshold and is NOT overloaded, and `>=` would light up that day. INV-04 fixes the comparison and
 * .ai/registry/features.md:91 restates it.
 *
 * `currentMembers` is the roster with `removedAt === null` counted AT READ TIME — the current count,
 * not the membership as it stood on the date being judged. A past date is therefore re-evaluated
 * against today's team and may change between overloaded and normal when somebody joins (AC-8).
 * INV-04 records that consequence as accepted; it is not a bug to be fixed here.
 *
 * Returns false when `currentMembers` is 0 rather than dividing. A team with no active members has
 * nobody to be short of, and `0/0` is NaN, which compares false against everything and would hide
 * the case rather than decide it.
 */
export function isOverloaded(count: number, currentMembers: number, threshold: number): boolean {
  if (currentMembers <= 0) return false;
  return count / currentMembers > threshold;
}

/** INV-04's denominator, in one place: the team's members with `removedAt === null`. */
export const currentMemberCount = (roster: readonly Member[]): number =>
  roster.filter((member) => member.removedAt === null).length;

// ---------------------------------------------------------------------------
// CAL-10. 01-plan.md section 4.1.
// ---------------------------------------------------------------------------

/** The part of INV-04's total contributed by each entry type. Both halves, always present. */
export interface AbsenceByType {
  pto: number;
  wfh: number;
}

/**
 * CAL-10 AC-6. INV-04's total for `range`, SPLIT BY `type`.
 *
 * **NOT A SECOND DEFINITION, AND THE CONSTRUCTION IS THE ARGUMENT.** It walks the SAME `walk` as
 * `absenceCountsFor`, applies the SAME `WEIGHT`, and inherits the same rejected-entry, tentative,
 * removed-member and range-clamp rules; the only thing it adds is which of two accumulators receives
 * the weight. Because every counted entry has exactly one `type`, `pto + wfh` equals
 * `absenceCountsFor`'s total over the same range for every dataset — an IDENTITY, not an assertion
 * that could drift.
 *
 * ADR-032 § Consequences item 4 is the reason this function exists at all and the reason it is HERE:
 * `absenceCountsFor` is documented above as never consulting `type` (:189-190) and INV-04 forbids a
 * second definition of the number, so the split had to be a NEW quantity derived from the ONE pass
 * rather than a filter written on a screen. CAL-10 01-plan.md section 8, rejected alternative 1
 * records what the filter would have cost: it applies none of the four rules above, so it disagrees
 * with the total beside it the first time a member is removed mid-year — and disagrees QUIETLY,
 * because both numbers look plausible.
 *
 * **THIS IS THE FIFTH DERIVATION AND THE FIRST THAT READS `type`.** That is not a contradiction of
 * the `WEIGHT` comment above: the weight is still blind to `type`, so a PTO day and a WFH day still
 * cost the room the same. This function does not re-weigh anything — it only asks which bucket an
 * already-weighted day belongs to.
 *
 * @param entries every entry overlapping `range`, REJECTED ONES INCLUDED — `walk` excludes them, and
 *                it is the only thing that may.
 * @param range   inclusive at both ends.
 * @param roster  the team's members, INCLUDING removed ones, exactly as the other four take them:
 *                ADR-013 needs `removedAt` per member to decide each date.
 */
export function absenceByTypeFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): AbsenceByType {
  const split: AbsenceByType = { pto: 0, wfh: 0 };
  walk(entries, range, roster, (_date, entry) => {
    split[entry.type] += WEIGHT[entry.portion];
  });
  return split;
}
