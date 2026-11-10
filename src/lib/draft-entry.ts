// CAL-07 — the unsaved draft, as a row. 01-plan.md section 4.1.
//
// **THIS MODULE COMPUTES NOTHING.** It builds the argument that `absenceCountsFor`,
// `absentEntriesFor` and `isOverloaded` are then handed, and every rule about what a day costs stays
// where INV-04 puts it: `src/lib/data/absence.ts`, which is not in this ticket's `allowed_paths` and
// gains no line here. A `+ weight(portion)` written in a component would be a second implementation
// of INV-04 — 01-plan.md section 8 rejects exactly that, and INV-06 is why it would be wrong rather
// than merely duplicated: a five-day `am` draft adds 0.5 to EACH of five days, not 0.5 once.
//
// It is in `src/lib/` and NOT in `src/lib/data/`: `absence.ts` sits inside the seam directory only
// because .ai/registry/features.md:91 puts it there by name, and nothing puts this there
// (01-plan.md section 5). It imports types and nothing else, so RULE-02's boundary — which
// eslint.config.js enforces as a ban on `@supabase/*` outside `src/lib/data/` — is not in play.
import type { Entry, EntryPortion, EntryType } from "@/lib/domain/types";

/**
 * The fields of the form that can change what a day costs, plus the two that decide how the draft is
 * DRAWN.
 *
 * It is deliberately NOT `EntryFormValues`: `note` cannot change a count, and a shape carrying it
 * would invite a caller to believe otherwise. `memberId` is here and is not optional — INV-07, and
 * 01-plan.md section 2: a draft attributed to nobody vanishes from the count silently.
 *
 * Declared HERE rather than in `src/lib/domain/types.ts`, which is a shared type module and one of
 * the three things .ai/01-operating-model.md:375 makes XL (01-plan.md section 4.1).
 */
export interface DraftEntryInput {
  memberId: string;
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive
  tentative: boolean;
}

/**
 * The id the unsaved draft carries. Exported so a test and a component both recognise the draft row
 * without matching on a string literal in two places.
 *
 * It is NOT a uuid: nothing may ever write it, and a value that cannot be mistaken for a real id is
 * the cheapest way to say so.
 */
export const DRAFT_ENTRY_ID = "draft";

/**
 * The rows to hand to `absenceCountsFor`, `absentEntriesFor` and `isOverloaded`: the team's saved
 * entries with the row being edited REMOVED and the draft appended.
 *
 * `excludeEntryId` is the whole of AC-17. On the edit path the fetched rows contain the entry the
 * form is editing, and appending the draft beside it counts that member twice. On the create path it
 * is null and nothing is removed.
 *
 * The draft is `status: "pending"` on every path — 01-plan.md Open question 3 records the one case
 * where that is inexact (a note-only edit of a REJECTED entry, which `entry_enforce_decision()`
 * leaves rejected) and why reproducing that trigger's substantive-edit test here would be worse: it
 * is a second implementation of INV-02 in TypeScript, one invariant over from the failure INV-04's
 * single-definition rule exists to prevent.
 *
 * `tentative` is carried through and NOT consulted here: `walk` in absence.ts never reads it
 * (INV-05, AC-8), and it is present so the warning can draw the draft with the same dashed border
 * the month grid uses.
 *
 * Every field of `Entry` that is not the draft's own is fixed rather than guessed: `rejectionReason`,
 * `note`, `approvedBy` and `approvedAt` are null, and `createdAt` and `updatedAt` are the empty
 * string — nothing in absence.ts reads either, and a fabricated timestamp would be a value a
 * component could render.
 *
 * The input array is never mutated: a component holds it in state and passes it here on every
 * keystroke.
 */
export function withDraft(
  entries: readonly Entry[],
  draft: DraftEntryInput,
  excludeEntryId: string | null,
): Entry[] {
  const saved =
    excludeEntryId === null ? entries : entries.filter((entry) => entry.id !== excludeEntryId);

  return [
    ...saved,
    {
      id: DRAFT_ENTRY_ID,
      memberId: draft.memberId,
      type: draft.type,
      portion: draft.portion,
      startDate: draft.startDate,
      endDate: draft.endDate,
      tentative: draft.tentative,
      status: "pending",
      rejectionReason: null,
      note: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: "",
      updatedAt: "",
    },
  ];
}

/**
 * True when the range is usable: both dates present and `end` not before `start`. AC-20.
 *
 * The ONE place that emptiness test lives, so the component and the test agree by construction. The
 * comparison is lexicographic on `yyyy-MM-dd` and constructs no `Date` — the same reason absence.ts
 * gives, one module over: `new Date('2026-04-30')` parses as UTC midnight and a local read west of
 * UTC yields the previous day.
 */
export function isUsableRange(startDate: string, endDate: string): boolean {
  return startDate !== "" && endDate !== "" && startDate <= endDate;
}
