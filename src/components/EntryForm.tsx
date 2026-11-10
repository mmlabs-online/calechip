// CAL-02 — the six entry fields, their validation and their selectors, EXTRACTED from
// NewEntry.tsx rather than written a second time. 01-plan.md section 4.3.
//
// The extraction is the point: two forms would be two places where "an empty note is null" and "the
// submit button is disabled until the days are chosen" are decided, and the two would agree until
// somebody changed one.
//
// EVERYTHING here is an affordance (ADR-005). The controls are in the database: the insert and
// update policies' `with check (member_id = auth.uid())`, the two column grants' lists, and
// `entry_no_overlapping_portion`. This form refuses nobody holding a token; it saves a round trip
// and says why.
//
// **THERE IS NO MEMBER PICKER AND NO STATUS CONTROL, and both absences are load-bearing.** The
// first is the affordance for CAL-01 AC-10 and CAL-02 AC-8 (INV-07); the second for CAL-01 AC-11 and
// CAL-02 AC-10 — `status`, `rejection_reason`, `approved_by` and `approved_at` are absent from both
// grants, so no control here could carry one. Adding either would offer a journey that always ends
// in a refusal.
//
// Dates in the past are DELIBERATELY UNCONSTRAINED in either direction, on both routes. It is a
// `TODO(project)` on .ai/registry/features.md:87 and CAL-02 01-plan.md Open questions item 1, and it
// names editing explicitly: whether a member may move an entry onto a past date is the operator's
// decision. So the picker greys out nothing and neither seam function carries a past-date check.
//
// ---------------------------------------------------------------------------------------------
// SOLO, 2026-09-10 — THE FORM IS REDRAWN TO THE OPERATOR'S DESIGN, AND THE TWO DATE INPUTS ARE
// GONE. `/solo` with an image attached: no story, no review, no gate.
//
// The authority is `.claude/commands/solo.md` and `.claude/agents/solo.md`. Those two cite
// `.ai/registry/decisions/ADR-033-solo-engineer.md`, **which is not on disk** — ADR-033 in this
// repository is `a-person-joins-by-signing-up-and-an-admin-decides-afterwards`, so the number is
// taken and the solo exception has no ADR. `src/components/Sidebar.tsx:43` recorded the same
// discrepancy before this run; it is repeated rather than resolved, because writing that ADR is
// `.ai/registry/**` and RULE-01 makes it the operator's.
//
// Four changes, and the first is the one with consequences:
//
//   1. **`From` and `To` became a month grid** (`DayPicker`), so the form now holds a SET of days.
//      `EntryFormValues.dates` replaces `startDate` and `endDate`, and `dateRuns` gathers the set
//      into unbroken runs on the way out — **one entry per run**, which is how a datastore that
//      stores `start_date`/`end_date` receives a selection with gaps in it. CAL-01 AC-2 is unchanged
//      and is the reason it is runs and not one row per day: a contiguous week is ONE entry. The
//      design's own mock shows a gapped selection, so the gap is the specification.
//   2. **Type and portion became segmented controls** rather than `<select>`s. INV-06 is untouched:
//      still ONE portion for the whole selection, still no per-date control.
//   3. **The overload warning moved up, to sit directly under the grid**, where the design puts it
//      and where the days it is about are. It is drawn ONCE PER RUN — passing the outer bounds of a
//      gapped selection would count the days in the gap and warn about a day nobody chose.
//   4. **`onCancel` is new and optional.** The create routes draw the dialog's `Cancel`; the edit
//      route passes nothing and the control is absent, because a route has its own way back.
//
// **WHAT DID NOT CHANGE: this form still refuses nothing, still writes no `status`, and still
// carries no member picker.** The submit control keeps its `disabled` on an incomplete form, which
// is the same condition it always had, restated over days instead of over two inputs.
//
// **AN INVERTED RANGE IS NOW UNREACHABLE THROUGH THE INTERFACE** — a set of days has no order to
// invert. CAL-01 AC-9's refusal still exists in the seam and is still returned and rendered; what is
// gone is the control that could express the mistake. The spec that drove it through the two inputs
// is amended rather than deleted, and says so.
import { useState, type JSX } from "react";
import DayPicker from "@/components/DayPicker";
import OverloadWarning from "@/components/OverloadWarning";
import PtoTaskWarning from "@/components/PtoTaskWarning";
import { dateRuns } from "@/lib/date-selection";
import type { EntryPortion, EntryType, Failure } from "@/lib/domain/types";
// OPS-002. The two label sets moved to src/lib/labels.ts, which is now their ONE declaration
// (AC-8). They were exported from here because the own-entry list rendered the same two maps; five
// screens ended up declaring them, so the shared home is a module rather than a component.
import { PORTION_LABELS, TYPE_LABELS } from "@/lib/labels";
import { currentDay } from "@/lib/period";

// CAL-01 AC-4. WFH is a TYPE and not a second feature: one control, two values, and everything
// downstream of it is identical. CAL-01 AC-5 and INV-06 do the same for the portion: one value for
// the WHOLE selection, and deliberately no per-date control.
//
// The two maps themselves are in src/lib/labels.ts as of OPS-002 — the reasoning that used to sit
// here, about a WFH member being at work, moved with them.

/** The six substantive fields, and exactly the six both grants carry. It is deliberately NOT
 *  `CreateEntryInput` or `UpdateEntryInput`: this is what a form holds, and the seam decides what a
 *  write means. `note` is already trimmed to null here, so both routes store "no note" one way.
 *
 *  `dates` is the SET the picker holds and not a range — see the SOLO note above. The caller runs it
 *  through `dateRuns` and decides what more than one run means on its own route. */
export interface EntryFormValues {
  type: EntryType;
  portion: EntryPortion;
  dates: readonly string[];
  tentative: boolean;
  note: string | null;
}

export interface EntryFormProps {
  /** `new-entry`, `edit-entry` or `month-entry`. Every selector below is this prefix plus a suffix,
   *  so three routes render the same markup under three selector families. */
  testIdPrefix: string;
  title: string;
  submitLabel: string;
  submittingLabel: string;
  initial: EntryFormValues;
  /** What the form holds after a SUCCESSFUL submit.
   *
   *  `clear` is CAL-01's behaviour and is unchanged: type and portion are kept, because declaring a
   *  run of days usually means declaring several with the same shape; the days, the note and
   *  `tentative` are cleared, because all three describe the entry that was just saved. `tentative`
   *  left sticky silently marks the following entry uncertain.
   *
   *  `keep` is the edit route's: the values on screen ARE the entry now, and clearing them would
   *  show an empty form for a row that still exists. */
  afterSubmit: "clear" | "keep";
  /** Null on success; the failure to render otherwise. The sentence is produced in the seam and
   *  rendered verbatim — this component never composes one of its own about why a write was
   *  refused, so a SQLSTATE or a PostgREST message text can never reach the screen. */
  onSubmit(values: EntryFormValues): Promise<Failure | null>;

  /** SOLO, 2026-09-10. `runs` — any selection is savable, and the caller writes one entry per
   *  unbroken run. `single-run` — the days must form ONE run before the form will submit, which is
   *  the edit route: it updates one row, and a gapped selection there would have to invent a second
   *  row nobody asked for. The refusal is a disabled control and a sentence, never a thrown
   *  failure. */
  selection?: "runs" | "single-run";

  /** Drawn as `Cancel` beside the submit control when given. The create routes pass the dialog's
   *  dismiss; the edit route passes nothing and no control is drawn. */
  onCancel?: () => void;

  /** CAL-07, 01-plan.md section 4.4. The draft's owner, or null for the caller.
   *
   *  OPTIONAL, and that is the most load-bearing thing about it: `NewEntry.tsx` and `MonthView.tsx`
   *  pass nothing and get the caller, which is correct on both. `EditEntry.tsx` passes the entry's
   *  `memberId`, which is what makes AC-18 true for an admin editing another member's entry. */
  ownerId?: string | null;

  /** CAL-07. The saved row this form is editing, so it is not counted BESIDE the draft (AC-17).
   *  Optional for the same reason: on a create there is no row to exclude. */
  excludeEntryId?: string | null;
}

// The same three-state shape SignIn.tsx uses, and `submitting` is never terminal: every path out of
// the handler lands back on `editing`, with or without an error. A disabled button with neither
// beside it is the failure QA found on TEA-01.
type FormState = { phase: "editing"; error: Failure | null } | { phase: "submitting" };

// UIE-01 AC-4's vocabulary, reused: a selected segment is distinguished by MORE THAN COLOUR — a
// filled pill, a heavier weight, and `aria-pressed`, which is the half a screen reader gets.
const SEGMENT_BASE =
  "flex-1 rounded-xl py-2 text-center text-sm transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function EntryForm({
  testIdPrefix,
  title,
  submitLabel,
  submittingLabel,
  initial,
  afterSubmit,
  onSubmit,
  selection = "runs",
  onCancel,
  ownerId = null,
  excludeEntryId = null,
}: EntryFormProps): JSX.Element {
  const [type, setType] = useState<EntryType>(initial.type);
  const [portion, setPortion] = useState<EntryPortion>(initial.portion);
  const [dates, setDates] = useState<readonly string[]>(initial.dates);
  const [tentative, setTentative] = useState(initial.tentative);
  const [note, setNote] = useState(initial.note ?? "");

  const [state, setState] = useState<FormState>({ phase: "editing", error: null });

  const runs = dateRuns(dates);
  // The one place "this form is ready" is decided. On the edit route a gapped selection is NOT
  // ready, and the sentence below says why rather than leaving a disabled control unexplained.
  const gapped = selection === "single-run" && runs.length > 1;
  const complete = runs.length > 0 && !gapped;
  const submitting = state.phase === "submitting";

  // Which month the grid opens on: the first day already chosen, else today. Read once by
  // `DayPicker`, which owns the stepper from then on.
  const openMonth = (dates[0] ?? currentDay()).slice(0, 7);

  function toggle(date: string): void {
    setDates((chosen) =>
      chosen.includes(date)
        ? chosen.filter((existing) => existing !== date)
        : [...chosen, date].sort(),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!complete || state.phase !== "editing") return;

    setState({ phase: "submitting" });

    try {
      // CAL-01 AC-6. An empty note is stored as null and not as an empty string — two
      // representations of "no note" is one more than the column needs, and `btrim` is what the
      // datastore's own INV-03 check uses on the sibling column.
      const failure = await onSubmit({
        type,
        portion,
        dates,
        tentative,
        note: note.trim() === "" ? null : note.trim(),
      });

      setState({ phase: "editing", error: failure });

      if (!failure && afterSubmit === "clear") {
        setDates([]);
        setNote("");
        setTentative(false);
      }
    } catch {
      // Not defensive padding: expected failures are RETURNED by the seam, and the Supabase client
      // still raises on an unusable configuration before any request leaves.
      setState({
        phase: "editing",
        error: { code: "unknown", message: "This entry could not be saved. Please try again." },
      });
    }
  }

  return (
    <form
      data-testid={`${testIdPrefix}-form`}
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-5"
    >
      <h1
        data-testid={`${testIdPrefix}-title`}
        className="pr-10 font-display text-xl font-bold text-ink md:text-2xl"
      >
        {title}
      </h1>

      {/* CAL-01 AC-4. Two values, one control. The container keeps the selector the routes' specs
          already read, so `<prefix>-type` still names the type control and still appears exactly
          once — a group of two buttons now, instead of a `<select>` of two options. */}
      <div
        data-testid={`${testIdPrefix}-type`}
        data-value={type}
        role="group"
        aria-label="Type"
        className="flex gap-1 rounded-card border border-line bg-bg p-1"
      >
        {(Object.keys(TYPE_LABELS) as EntryType[]).map((value) => (
          <button
            key={value}
            data-testid={`${testIdPrefix}-type-${value}`}
            data-active={type === value}
            type="button"
            aria-pressed={type === value}
            onClick={() => setType(value)}
            className={[
              SEGMENT_BASE,
              // `text-ink` and NOT `text-pto`/`text-wfh`, which is where this departs from the
              // mock: `--color-pto` is #ffcbaa and `--color-wfh` #a9e2cd, both around 1.5:1 as text
              // on `--color-card`. The mock draws its label in a more saturated orange than this
              // product's peach, and re-picking that hex is a charter-level choice
              // (`CLAUDE.md` § Visual direction), so the label takes the ink and the selected state
              // keeps the white pill, the elevation, the weight and `aria-pressed` — which is
              // UIE-01 AC-4's own rule that selection is never carried by colour alone.
              type === value
                ? "bg-card font-bold text-ink shadow-soft"
                : "font-semibold text-ink-2 hover:text-ink",
            ].join(" ")}
          >
            {TYPE_LABELS[value]}
          </button>
        ))}
      </div>

      <DayPicker
        testIdPrefix={testIdPrefix}
        label="Dates"
        selected={dates}
        onToggle={toggle}
        initialMonth={openMonth}
        accent={type === "wfh" ? "wfh" : "pto"}
      />

      {/* CAL-07, 01-plan.md sections 4.3 and 4.4, MOVED by SOLO to sit under the grid — the design
          puts it there, beside the days it is about.

          ONE PER RUN. A gapped selection has no single pair of bounds, and handing this component
          the outer bounds would count every day in the gap: it builds a draft ROW from `startDate`
          and `endDate` (`withDraft`), so a selection of the 1st and the 8th would warn about the 2nd
          through the 7th, days nobody chose.

          It is fed from the state this form already holds and it is given no way to reach the submit
          control below — which is AC-9, AC-10 and AC-12 held by construction. There is no "Save
          anyway" and nothing here can add one (charter refusal 6). */}
      {runs.map((run) => (
        <OverloadWarning
          key={`${run.startDate}:${run.endDate}`}
          ownerId={ownerId}
          excludeEntryId={excludeEntryId}
          type={type}
          portion={portion}
          startDate={run.startDate}
          endDate={run.endDate}
          tentative={tentative}
          testIdPrefix={testIdPrefix}
        />
      ))}

      {/* TSK-03, 01-plan.md § 4.3. The viewer's own open tasks on the chosen days, beside the overload
          warning. ONE FOR THE WHOLE SELECTION and fed `dates`, not a run: a task in the gap of a gapped
          selection is on a day nobody chose (AC-2). Like the block above it is given nothing that
          reaches the submit control — a notice, never a gate (AC-5, charter refusal 6). */}
      <PtoTaskWarning ownerId={ownerId} type={type} dates={dates} testIdPrefix={testIdPrefix} />

      {/* SOLO. The edit route updates ONE row. This says so, and the submit control is disabled
          while it is true — an affordance about what this screen can save, never a rule about what a
          member may declare: the same days are savable on the create route, as two entries. */}
      {gapped ? (
        <p data-testid={`${testIdPrefix}-single-run`} className="text-sm text-ink-2">
          One entry covers one unbroken run of days. Choose days that are next to each other, or
          declare the rest as a separate entry.
        </p>
      ) : null}

      {/* CAL-01 AC-5 and INV-06: ONE portion for the whole selection, and deliberately no per-date
          control. `<prefix>-portion` still names it and still appears exactly once. */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-ink-2">Time</span>
        <div
          data-testid={`${testIdPrefix}-portion`}
          data-value={portion}
          role="group"
          aria-label="Time"
          className="flex gap-2"
        >
          {(Object.keys(PORTION_LABELS) as EntryPortion[]).map((value) => (
            <button
              key={value}
              data-testid={`${testIdPrefix}-portion-${value}`}
              data-active={portion === value}
              type="button"
              aria-pressed={portion === value}
              onClick={() => setPortion(value)}
              className={[
                SEGMENT_BASE,
                portion === value
                  ? "bg-primary font-bold text-white"
                  : "bg-bg font-medium text-ink-2 hover:bg-line",
              ].join(" ")}
            >
              {PORTION_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {/* CAL-01 AC-6. Tentative is INDEPENDENT of status: it changes how the entry is drawn and
          nothing else, it is counted in every calculation (INV-05), and it never makes an entry
          approved or pending. Nothing on this form writes `status`. */}
      <label className="flex items-center gap-3 border-t border-line pt-4 text-sm font-medium text-ink">
        <input
          data-testid={`${testIdPrefix}-tentative`}
          type="checkbox"
          checked={tentative}
          onChange={(e) => setTentative(e.target.checked)}
          className="h-5 w-5 rounded border-line"
        />
        Not certain
      </label>

      <input
        data-testid={`${testIdPrefix}-note`}
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        aria-label="Note"
        className="w-full rounded-xl bg-field px-3 py-3 text-sm text-ink placeholder:text-ink-3"
      />

      {state.phase === "editing" && state.error ? (
        <p data-testid={`${testIdPrefix}-error`} role="alert" className="text-sm text-danger">
          {state.error.message}
        </p>
      ) : null}

      <div className="flex gap-3 pt-1">
        {onCancel ? (
          <button
            data-testid={`${testIdPrefix}-cancel`}
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-bg px-6 py-3 text-sm font-bold text-ink-2 transition-colors hover:bg-line"
          >
            Cancel
          </button>
        ) : null}

        <button
          data-testid={`${testIdPrefix}-submit`}
          type="submit"
          disabled={!complete || submitting}
          className={[
            // `text-ink` for the reason the type tabs carry it: white on #ffcbaa is about 1.7:1.
            "flex-1 rounded-xl py-3 text-sm font-bold text-ink shadow-soft transition-colors disabled:opacity-40",
            type === "wfh" ? "bg-wfh" : "bg-pto",
          ].join(" ")}
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
