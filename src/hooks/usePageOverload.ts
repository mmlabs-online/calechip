// SOLO, 2026-09-09 — the crowded-day warning on a worklist row.
//
// **ONE SET OF READS FOR THE WHOLE PAGE, NOT ONE PER ROW, AND THAT IS THE WHOLE REASON THIS FILE
// EXISTS.** The obvious way to put the warning the operator's transcription shows on each row is to
// mount `OverloadWarning` inside the row — it draws exactly this block and it is already written.
// It also issues THREE reads on mount plus a debounced entries read per range (`OverloadWarning.tsx`
// § the three range-independent reads), so a page of ten rows would be about forty requests to say
// something about ten days. The operator was asked and chose the shared read.
//
// **IT COMPUTES NO COUNT OF ITS OWN.** Every number here comes from `absenceCountsFor` and
// `isOverloaded` in `@/lib/data/absence` — INV-04's single implementation, untouched. What this file
// adds is the SPAN: one range wide enough to cover every row on the page, read once, and then each
// row's crowded dates sliced out of the same map. A per-row sum, or a second count derived from the
// pending rows themselves, is the forbidden second definition — `.ai/registry/features.md`'s CAL-05
// row states it and ADR-029's revert condition fires on one occurrence of it anywhere.
//
// **THE PENDING ENTRY IS COUNTED IN ITS OWN WARNING, AND THAT IS DELIBERATE.** `walk` skips only
// `rejected` rows (`absence.ts:133`), so a pending entry contributes to the day exactly as an
// approved one does. The sentence the row shows is therefore *what the day looks like if this stays*
// — which is the question an admin holding an approve control is actually asking. It is the same
// arithmetic the month grid paints, so a row and a cell can never disagree.
//
// **IT IS AN AFFORDANCE AND IT REFUSES NOTHING** (charter refusal 6). It renders a sentence or it
// renders nothing; it disables no control, blocks no approval and is not consulted by the decision
// panel. `OverloadWarning.tsx` states the same property for the same reason.
//
// **A FAILED READ SAYS NOTHING RATHER THAN SAYING ZERO.** `crowded` comes back empty on a throw and
// on an unresolved read alike, so no row draws a warning — a warning is the only thing this hook
// says, and it has nothing to say about a read it did not get. That is `OverloadWarning`'s AC-21
// applied here, and it is why the worklist gains no failure state of its own: the queue still lists,
// filters, counts and pages exactly as it did when this read fails.
//
// **RECOMPUTING IS NOT REFETCHING**, which is `OverloadWarning.tsx`'s own sentence and is why the
// two halves below are split. The effect fetches and holds the COUNTS; the rows are sliced out of
// them synchronously on every render. So an approval — which rebuilds the page's rows without moving
// its boundaries — costs no request at all, and a row that arrives between reads is never missing
// from the answer. A map built inside the effect would have gone stale on exactly that case.
import { useEffect, useMemo, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
// INV-04's single implementation, imported DIRECTLY rather than through the seam — the same import
// `OverloadWarning.tsx` and `MonthView.tsx` make, and for the reason CAL-04 01-plan.md § 5 records:
// neither seam implementation counts anything, so there is no second arithmetic for seam-parity to
// miss.
import {
  absenceCountsFor,
  currentMemberCount,
  eachDateInRange,
  isOverloaded,
} from "@/lib/data/absence";
import type { Entry } from "@/lib/domain/types";

/** One crowded date on one row: the date, and how many people are away on it. */
export interface CrowdedDate {
  date: string;
  count: number;
}

/**
 * For each entry id, the dates within that entry's own range that are crowded.
 *
 * An id absent from the map, and an id present with an empty array, mean the same thing to a caller
 * — draw nothing — and both are reachable: the first before the read resolves or after it failed,
 * the second when the row is simply not crowded.
 */
export type PageOverload = ReadonlyMap<string, readonly CrowdedDate[]>;

const EMPTY: PageOverload = new Map();

/** What one set of reads yields, held whole. A warning drawn from two of the three would be a
 *  believable partial answer, which is the failure `OverloadWarning.tsx` names for its own `Base`. */
interface Counted {
  counts: ReadonlyMap<string, number>;
  members: number;
  threshold: number;
}

/**
 * The crowded dates for every entry on one page, from one set of reads.
 *
 * `entries` is the page the screen is holding. The hook re-reads whenever the SPAN those entries
 * cover changes — not whenever the array identity changes, which for a screen that rebuilds its rows
 * on every decision would be a read per approval. The span is a string, so the comparison is a
 * string comparison and a page whose rows changed without moving its boundaries costs nothing.
 */
export function usePageOverload(entries: readonly Entry[]): PageOverload {
  const [counted, setCounted] = useState<Counted | null>(null);

  // The widest range the page touches, as one comparable key. Dates are `yyyy-MM-dd`, so `<` on the
  // strings is `<` on the days — the timezone-free comparison this product uses everywhere and the
  // reason no `new Date(...)` appears on this path.
  let start = "";
  let end = "";
  for (const entry of entries) {
    if (start === "" || entry.startDate < start) start = entry.startDate;
    if (end === "" || entry.endDate > end) end = entry.endDate;
  }
  const span = start === "" ? "" : `${start}..${end}`;

  useEffect(() => {
    if (span === "") {
      setCounted(null);
      return;
    }

    let live = true;
    // Split back into the pair `span` was built from. Indexed rather than destructured: TypeScript
    // types `split` as possibly-short, and a `DateRange` will not take `string | undefined`.
    const parts = span.split("..");
    const range = { start: parts[0] ?? "", end: parts[1] ?? "" };

    void (async () => {
      try {
        // THREE READS, AND THREE REGARDLESS OF HOW MANY ROWS ARE ON THE PAGE. `listMembers()`
        // returns REMOVED members carrying `removedAt`, which is what `absenceCountsFor` needs to
        // decide each date under ADR-013 — a pre-filtered roster would make INV-04 uncomputable.
        const [team, roster, rows] = await Promise.all([
          seam.getTeam(),
          seam.listMembers(),
          seam.listTeamEntriesOverlapping(range),
        ]);

        // A null team leaves the threshold unknown, and a threshold nobody knows cannot call any day
        // crowded. Nothing is drawn, rather than a guess at the default.
        if (!live) return;
        if (!team) {
          setCounted(null);
          return;
        }

        setCounted({
          counts: absenceCountsFor(rows, range, roster),
          members: currentMemberCount(roster),
          threshold: team.overloadThreshold,
        });
      } catch {
        // A transport failure, or the client raising on an unusable configuration. Say nothing.
        if (live) setCounted(null);
      }
    })();

    return () => {
      live = false;
    };
    // `span` AND NOTHING ELSE. It is the fact that decides the READ; the rows are sliced out of the
    // result below, on every render. A page whose rows moved without moving its boundaries — the
    // shape every approval produces — must not cost three requests.
  }, [span]);

  // The slice, synchronous and derived. Nothing here reads or counts: `counts` already holds INV-04's
  // answer for every date in the span, and each row asks it about its own dates.
  return useMemo<PageOverload>(() => {
    if (!counted) return EMPTY;

    const byEntry = new Map<string, readonly CrowdedDate[]>();
    for (const entry of entries) {
      const dates: CrowdedDate[] = [];
      for (const date of eachDateInRange({
        start: entry.startDate,
        end: entry.endDate,
      })) {
        const count = counted.counts.get(date);

        // `undefined` means the date fell outside the span the read covered, which cannot happen
        // while `span` is derived from these same rows — but a missing key read as 0 would draw
        // "nobody is away" as a fact, and this hook never states a count it did not fetch.
        if (count === undefined) continue;
        if (isOverloaded(count, counted.members, counted.threshold)) {
          dates.push({ date, count });
        }
      }
      byEntry.set(entry.id, dates);
    }
    return byEntry;
  }, [counted, entries]);
}
