// ADM-03 — the three holiday fields, their validation and their selectors, in ONE component used
// TWICE on one screen. 01-plan.md section 4.4.
//
// The extraction is the point, and it is CAL-02's reason applied one table over: two forms would be
// two places where "a blank name is refused" and "the default kind is non_working" are decided, and
// the two would agree until somebody changed one. Every `data-testid` below is built from a prefix,
// so `holiday-add-*` and `holiday-edit-*` are the same markup under two selector families.
//
// EVERYTHING HERE IS AN AFFORDANCE (ADR-005). The controls are in the database:
// `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin`, the write grant, and
// `unique (date)`. This form refuses nobody holding a token — Holidays.tsx renders it for an admin
// only (AC-14), and AC-15 exists to prove that removing that affordance changes nothing.
//
// IT DOES NOT CHECK FOR A DUPLICATE DATE, and that absence is load-bearing rather than an omission.
// The screen holds ONE YEAR, so a check here would tell an admin adding a date in a year they are
// not looking at that it is free when it is not — right most of the time, which 01-plan.md section 8
// calls the worst property a uniqueness check can have. `unique (date)` is in the database, the seam
// turns `23505` into a sentence, and this form renders the sentence (AC-6, AC-7).
import { useState } from "react";
import type { Failure, HolidayKind } from "@/lib/domain/types";

/**
 * AC-3. THE LABELS SAY THE EFFECT ON THE WORKING CALENDAR, NEVER THE VIETNAMESE LABEL — `name`
 * already carries that. A `working` row is a mandated Saturday: a weekend day that counts as a
 * working day, the exact inverse of a holiday (ADR-015 section 2).
 *
 * THIS IS THE ONE DEFINITION AND `src/routes/Holidays.tsx` IMPORTS IT, so the form a person chooses
 * in and the list they read afterwards cannot disagree about what `working` means. 01-plan.md Open
 * question 4 records that the glossary's *Holiday* row still conflates the compensatory day off with
 * the mandated working Saturday, and that fixing it is a human's edit under RULE-01; stating the
 * EFFECT here is the mitigation this ticket can make, because a person choosing between these two
 * values never has to resolve the glossary's ambiguity to get it right.
 *
 * Exported from the component rather than from the screen, which is the direction CAL-02 already
 * set with `TYPE_LABELS` and `PORTION_LABELS` on EntryForm — see 03-impl-log.md, Deviations.
 */
export const EFFECT_LABEL: Record<HolidayKind, string> = {
  non_working: "Not a working day",
  working: "A working day",
};

/** The three writable columns, and exactly the three both `AddHolidayInput` and
 *  `UpdateHolidayInput` carry. Deliberately NOT either of those: this is what a form holds, and the
 *  seam decides what a write means. `name` is trimmed here so both routes store a label one way. */
export interface HolidayFormValues {
  date: string; // yyyy-MM-dd. No Date is constructed in this file (ADR-015 Consequences).
  name: string;
  kind: HolidayKind;
}

export interface HolidayFormProps {
  /** `holiday-add` or `holiday-edit`. Every selector below is this prefix plus a suffix, the shape
   *  EntryForm already uses for its three call sites. */
  testIdPrefix: string;
  submitLabel: string;
  submittingLabel: string;
  /** AC-3 on the add form — the caller passes `non_working`, so a kind is already selected when the
   *  form opens. AC-9 on the edit form — the caller passes the row's own three values, so it opens
   *  carrying them rather than blank and rather than defaults. */
  initial: HolidayFormValues;
  /** `clear` on the add form, `keep` on the edit form — EntryForm's own vocabulary. */
  afterSubmit: "clear" | "keep";
  /** Null on success; the failure to render otherwise. The sentence is produced in the seam and
   *  rendered verbatim, so a SQLSTATE or a PostgREST message text can never reach the screen. */
  onSubmit(values: HolidayFormValues): Promise<Failure | null>;
  /** The edit form's way out. ABSENT on the add form, which is what makes `holiday-add-cancel` a
   *  selector that does not exist rather than one that is hidden. */
  onCancel?: () => void;
}

// The same three-state shape EntryForm and SignIn use, and `submitting` is never terminal: every
// path out of the handler lands back on `editing`, with or without a message. A disabled button with
// neither beside it is the failure QA found on TEA-01.
//
// The message is `{ message: string }` and NOT `Failure`, because two different things render into
// the same node: AC-5's own validation sentence, which this form composes and which has no code
// because no write was issued, and the seam's refusal, which has one. A `FailureCode` invented for
// the first would be a code no caller could ever branch on.
type FormState = { phase: "editing"; error: { message: string } | null } | { phase: "submitting" };

export default function HolidayForm({
  testIdPrefix,
  submitLabel,
  submittingLabel,
  initial,
  afterSubmit,
  onSubmit,
  onCancel,
}: HolidayFormProps) {
  const [date, setDate] = useState(initial.date);
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<HolidayKind>(initial.kind);

  const [state, setState] = useState<FormState>({ phase: "editing", error: null });

  const submitting = state.phase === "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.phase !== "editing") return;

    // AC-5. REFUSED HERE, BEFORE ANY WRITE, and the submit control is deliberately NOT disabled
    // instead: a disabled button says nothing about which field is missing, and the criterion asks
    // the screen to say what is required. The trim is what `name text not null` would NOT catch — a
    // single space satisfies the column and names nothing.
    const trimmed = name.trim();
    if (!date || trimmed === "") {
      setState({
        phase: "editing",
        error: { message: "A holiday needs both a date and a name." },
      });
      return;
    }

    setState({ phase: "submitting" });

    try {
      const failure = await onSubmit({ date, name: trimmed, kind });
      setState({ phase: "editing", error: failure });

      // On the add form the values just saved describe a row that now exists, so the date and the
      // name are cleared for the next one. `kind` is KEPT, for the reason EntryForm keeps type and
      // portion: a year's holidays are entered in runs of the same kind, and re-picking it every
      // time is where a mandated Saturday gets filed as a holiday.
      if (!failure && afterSubmit === "clear") {
        setDate("");
        setName("");
      }
    } catch {
      // Not defensive padding: expected failures are RETURNED by the seam, and the Supabase client
      // still raises on an unusable configuration before any request leaves.
      setState({
        phase: "editing",
        error: { message: "Could not save this day. Please try again." },
      });
    }
  }

  return (
    <form
      data-testid={`${testIdPrefix}-form`}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4"
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Date
          {/* NO `min` AND NO `max`. A correction to a date the calendar already passed is exactly
              what an admin is here for — ADM-02's seed can be wrong about last year — and the year
              the screen is showing is not a bound on what may be added (AC-4). */}
          <input
            data-testid={`${testIdPrefix}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          Name
          <input
            data-testid={`${testIdPrefix}-name`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      {/* AC-3. A required choice with a stated default, and both values are offered with labels
          that say the EFFECT. There is no empty option: `kind` is `not null default 'non_working'`
          in the datastore and a blank here would be a state the column cannot hold. */}
      <label className="flex flex-col gap-1 text-sm">
        Effect on the working calendar
        <select
          data-testid={`${testIdPrefix}-kind`}
          value={kind}
          onChange={(e) => setKind(e.target.value as HolidayKind)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        >
          {(Object.keys(EFFECT_LABEL) as HolidayKind[]).map((value) => (
            <option key={value} value={value}>
              {EFFECT_LABEL[value]}
            </option>
          ))}
        </select>
      </label>

      {state.phase === "editing" && state.error ? (
        <p data-testid={`${testIdPrefix}-error`} role="alert" className="text-sm text-rose-600">
          {state.error.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          data-testid={`${testIdPrefix}-submit`}
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>

        {onCancel ? (
          <button
            data-testid={`${testIdPrefix}-cancel`}
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
