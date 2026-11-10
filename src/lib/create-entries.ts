// SOLO, 2026-09-10 — what "save" means when the form holds a SET of days.
//
// The day picker replaced two date inputs, so a member can now choose the 1st and then the 8th to
// the 12th in one gesture. `dateRuns` says that is two unbroken runs; this module is the one place
// that says two runs are TWO ENTRIES, and it exists so the two create routes — `NewEntry.tsx` and
// `MonthView.tsx` — cannot answer that question differently.
//
// **CAL-01 AC-2 IS WHY IT IS RUNS AND NOT DAYS.** A contiguous week is ONE row, not five; that
// criterion is shipped and this must not quietly reverse it. What is new is only that a selection
// with a gap in it can no longer be one row, because one row has one `start_date` and one
// `end_date`.
//
// **IT IS NOT A TRANSACTION AND DOES NOT PRETEND TO BE.** Each run is its own write, and the first
// refusal stops the rest — so a selection whose second run overlaps an existing entry stores the
// first and reports the refusal. The alternative is a batch endpoint in the seam, which is a change
// to the seam's surface and XL (.ai/01-operating-model.md:375). The stop-at-first-failure shape is
// the honest one for a per-row write: it never reports a success it did not get, and the caller
// re-reads the list either way, so what was stored is on screen beside the sentence saying what was
// not.
import { seam } from "@/lib/data";
import { dateRuns } from "@/lib/date-selection";
import type { EntryPortion, EntryType, Failure } from "@/lib/domain/types";

/** The form's values, structurally. Deliberately NOT an import of `EntryFormValues` from the
 *  component — a module under `src/lib/` that imports a component's type inverts the dependency for
 *  no gain. The shapes agree by structure, which the compiler checks at every call site. */
export interface NewEntryFields {
  type: EntryType;
  portion: EntryPortion;
  dates: readonly string[];
  tentative: boolean;
  note: string | null;
}

/**
 * One `createEntry` per unbroken run of the chosen days. Null when every run was stored; the FIRST
 * refusal otherwise, with no further writes attempted.
 *
 * An empty selection writes nothing and answers null. The form's submit control is disabled in that
 * state, so this is the second guard rather than the first.
 */
export async function createEntriesForDates(fields: NewEntryFields): Promise<Failure | null> {
  for (const run of dateRuns(fields.dates)) {
    const result = await seam.createEntry({
      type: fields.type,
      portion: fields.portion,
      startDate: run.startDate,
      endDate: run.endDate,
      tentative: fields.tentative,
      note: fields.note,
    });

    if (!result.ok) return result.error;
  }

  return null;
}
