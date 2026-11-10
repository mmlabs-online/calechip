// SOLO, 2026-09-11 — WHICH dates an entry collides on, so the refusal can say them.
//
// The operator: *"'You already have an entry covering these dates and this portion…' lỗi này nên
// show cho user biết ngày nào đang bị trùng"*. They chose ISO dates with an arrow for a run, because
// that is the form the own-entry list directly beneath the form already uses — a person reads the
// refusal, looks down, and finds the row.
//
// **INV-01 IS STILL ENFORCED BY THE DATASTORE AND ONLY BY IT.** The exclusion constraint decides that
// a write collides; this module only EXPLAINS the collision after the fact. `supabase.ts` reaches it
// after a 23P01, with a follow-up read of the member's own entries; the mock, which has no
// constraint, uses `clashingDates` as its stand-in for one — so the refusal and the list of dates in
// it come from one predicate there and cannot disagree.
//
// **THE PREDICATE IS INV-01's, WORD FOR WORD.** Same member; date ranges intersect; portions share a
// slot — `full` is both halves, `am` the first, `pm` the second, so `am` + `pm` on one date is two
// entries and no clash (ADR-011 section 3). A date is listed only when BOTH hold on that date: a
// morning entry beside a new afternoon entry is not a collision and must never be named as one.
//
// IT FETCHES NOTHING, and every date is a `yyyy-MM-dd` string walked through `eachDateInRange`, which
// does its arithmetic in UTC — ADR-015's trap, where a local read west of UTC yields the previous day.
import { eachDateInRange } from "./absence";
import type { Entry, EntryPortion } from "../domain/types";

/** The write being attempted — the three fields INV-01 compares, and nothing else. */
export interface OverlapCandidate {
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive
  portion: EntryPortion;
}

/** An existing row, narrowed to what the comparison reads. */
type Existing = Pick<Entry, "id" | "memberId" | "startDate" | "endDate" | "portion">;

/** ADR-011 section 3's slots. Slot 0 is the morning, slot 1 the afternoon. */
const SLOTS: Record<EntryPortion, readonly number[]> = { full: [0, 1], am: [0], pm: [1] };

const portionsCollide = (a: EntryPortion, b: EntryPortion): boolean =>
  SLOTS[a].some((slot) => SLOTS[b].includes(slot));

/**
 * The dates on which `candidate` would collide with one of `memberId`'s existing entries, sorted and
 * without repeats. EMPTY means no collision.
 *
 * @param excludeId the entry being EDITED, which must not collide with itself — `null` on create.
 *                  The same exclusion the constraint gets for free by comparing a row against others.
 */
export function clashingDates(
  existing: readonly Existing[],
  memberId: string,
  candidate: OverlapCandidate,
  excludeId: string | null = null,
): string[] {
  const hit = new Set<string>();

  for (const row of existing) {
    if (row.memberId !== memberId || row.id === excludeId) continue;
    if (!portionsCollide(row.portion, candidate.portion)) continue;

    const start = row.startDate > candidate.startDate ? row.startDate : candidate.startDate;
    const end = row.endDate < candidate.endDate ? row.endDate : candidate.endDate;
    if (start > end) continue;

    for (const date of eachDateInRange({ start, end })) hit.add(date);
  }

  return [...hit].sort();
}

/**
 * The dates as a person reads them: consecutive dates collapse into `start → end`, separate runs are
 * joined with commas — `2026-10-12 → 2026-10-14, 2026-10-20`.
 *
 * Runs are found by walking the whole span once through `eachDateInRange` rather than by adding a day
 * to each date here, so this file does no date arithmetic of its own.
 */
export function formatDateRuns(dates: readonly string[]): string {
  const sorted = [...new Set(dates)].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return "";
  const wanted = new Set(sorted);

  const runs: string[] = [];
  let runStart: string | null = null;
  let previous: string | null = null;

  for (const date of eachDateInRange({ start: first, end: last })) {
    if (wanted.has(date)) {
      if (runStart === null) runStart = date;
      previous = date;
    } else if (runStart !== null && previous !== null) {
      runs.push(runStart === previous ? runStart : `${runStart} → ${previous}`);
      runStart = null;
    }
  }
  if (runStart !== null && previous !== null) {
    runs.push(runStart === previous ? runStart : `${runStart} → ${previous}`);
  }

  return runs.join(", ");
}

/**
 * The sentence both seams return with `overlapping_entry`.
 *
 * **NOT "YOU ALREADY HAVE…".** CAL-03 lets an admin edit somebody else's entry, and the collision is
 * then with the OWNER's calendar, not the admin's; a sentence in the second person would tell the
 * admin they hold an entry they do not. "An existing entry" is true for both callers.
 *
 * **WITH NO DATES, IT SAYS NOTHING ABOUT DATES** rather than inventing any — that is the Supabase
 * seam's fallback when its follow-up read fails, and a refusal with no dates is still correct where
 * one with wrong dates would send a person to edit the wrong row.
 */
export function overlapMessage(dates: readonly string[]): string {
  const runs = formatDateRuns(dates);
  return runs === ""
    ? "These dates overlap an existing entry. Edit that entry, or choose a different range."
    : `These dates overlap an existing entry: ${runs}. Edit that entry, or choose a different range.`;
}
