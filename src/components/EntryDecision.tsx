// ADM-05 — the approve control, the reject control and the mandatory reason, in ONE component
// mounted TWICE. 01-plan.md sections 2b, 4.4 and 4.5.
//
// The extraction is the point, and it is ADM-03's reason applied to a decision rather than to a
// form: two copies of these controls would be two places where "a rejection carries a reason" is
// decided, and the two would agree until somebody changed one. It is mounted on each row of
// `/entries/pending`, which is the surface the feature row names, and on `/entries/:id/edit` for an
// admin, which is the only place an entry that is no longer pending is reachable at all — the
// worklist shows pending entries by construction, so AC-4 and AC-5 have nowhere else to happen.
//
// EVERYTHING HERE IS AN AFFORDANCE (ADR-005). The control is clause (a) of
// `public.entry_enforce_decision()` plus `entry_update_admin`, both in the database. This panel
// refuses nobody holding a token: a member who reached it in a debugger, or issued the PATCH by
// hand, is refused by the trigger and by nothing in `src/` (01-plan.md section 3).
//
// IT IMPORTS NO READ AND ISSUES NO QUERY. Which entries it is rendered for is the caller's decision,
// and which writes succeed is the datastore's. It calls `seam.approveEntry` and `seam.rejectEntry`
// and nothing else.
//
// IT DOES NOT CHECK THE REASON ITSELF, and that absence is deliberate. INV-03's biconditional check
// is the control and the seam already refuses a blank reason before the round trip with
// `rejection_reason_required` (AC-3); a third check here would be a third place the same rule is
// written, and it would make AC-3 unobservable through the interface by never letting the refusal
// happen. The field carries `data-required="true"` and the button submits.
//
// NO CONFIRMATION DIALOG ON APPROVE. Approving is reversible by rejecting, and a dialog on the
// commonest action in a queue is how a queue stops being worked (01-plan.md section 2b).
//
// NOTHING HERE RETURNS AN ENTRY TO `pending` (AC-11). That transition is named in no permission row
// and is not built; the only route back is INV-02's trigger on a substantive edit.
import { useState } from "react";
import { seam } from "@/lib/data";
import type { Entry, EntryType, Failure } from "@/lib/domain/types";

export interface EntryDecisionProps {
  /** The entry as the datastore last returned it. The panel reads `id` and `status` and nothing else. */
  entry: Entry;
  /**
   * The decision landed. The CALLER re-reads — this component holds no list and no count, and a
   * panel that handed back a row would invite a caller to splice it into one, which is how the
   * worklist's count and its rows come to disagree (ADM-04's whole shape).
   */
  onDecided: () => void | Promise<void>;
}

/** SOLO, 2026-09-09. The shape both decision controls share, so the pair reads as a pair. */
const DECISION_PILL =
  "shrink-0 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors " +
  "disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * SOLO, 2026-09-09. **THE APPROVE CONTROL IS THE COLOUR OF THE THING IT APPROVES** — peach for
 * leave, mint for working from home. It is the transcription's clearest idea and it costs nothing:
 * the two tokens already exist (`CLAUDE.md` § Visual direction, `src/index.css`), the sidebar's
 * legend already teaches them, and an admin working down a mixed queue can see which kind of entry
 * each row is without reading the label.
 *
 * **THE TEXT IS `text-ink` AND NOT WHITE, WHICH IS A DELIBERATE DEPARTURE FROM THE TRANSCRIPTION.**
 * It draws white on both fills; white on `--color-wfh` (#a9e2cd) is about 1.6:1, which is not a
 * contrast ratio, it is a decoration. Ink on either pastel clears AA comfortably, and a pastel fill
 * under dark text is what § Visual direction asks for in the same sentence that names the colours.
 *
 * **IT ADDS NO MEANING.** The kind of entry is already on the row as a word and as `data-type`; this
 * is the same fact in a second channel, which is why nothing is keyed to it and colour alone carries
 * nothing here.
 */
const APPROVE_FILL: Record<EntryType, string> = {
  pto: "bg-pto hover:brightness-95",
  wfh: "bg-wfh hover:brightness-95",
};

export default function EntryDecision({ entry, onDecided }: EntryDecisionProps) {
  // Three pieces of one thing. `open` is the reason field's disclosure — reject OPENS it and writes
  // nothing, so the field is where the rejection is composed rather than a prompt that has already
  // begun one.
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  async function run(write: () => Promise<{ ok: true } | { ok: false; error: Failure }>) {
    setBusy(true);
    setError(null);

    const result = await write();
    setBusy(false);

    // The refusal STAYS ON SCREEN and the panel stays open: a rejection refused for a blank reason
    // must leave the wording the admin typed where they can fix it (AC-3).
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setReason("");
    await onDecided();
  }

  return (
    <div
      data-testid="entry-decision"
      data-entry-id={entry.id}
      data-status={entry.status}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* SOLO, 2026-09-10 — **REJECT IS DRAWN FIRST AND APPROVE SECOND**, which is the order the
            operator's image puts them in on the approval queue. It reads as the safer reading order
            too: the control that needs a reason typed sits before the one that lands in a click.
            Nothing else about either control moved, and both keep their ids — the order is not
            asserted anywhere, because a spec that pinned it would be pinning a layout. */}
        {/* AC-2 and AC-5. It OPENS THE FIELD and writes nothing. On an already-rejected entry it is
            how the reason is re-worded, which is the same field on the same form. */}
        <button
          data-testid="entry-decision-reject"
          type="button"
          disabled={busy || open}
          onClick={() => {
            setOpen(true);
            setError(null);
            setReason(entry.rejectionReason ?? "");
          }}
          className={`${DECISION_PILL} border border-line bg-card text-ink-2 hover:bg-field hover:text-ink`}
        >
          {entry.status === "rejected" ? "Change the reason" : "Reject"}
        </button>

        {/* AC-11. Absent when the entry is already approved — `approved` to `approved` is not a
            decision, and a control that re-approved would rewrite `approved_at` for nothing. Every
            other transition this product offers is reachable from here. */}
        {entry.status === "approved" ? null : (
          <button
            data-testid="entry-decision-approve"
            data-type={entry.type}
            type="button"
            disabled={busy}
            onClick={() => void run(() => seam.approveEntry(entry.id))}
            className={`${DECISION_PILL} ${APPROVE_FILL[entry.type]} text-ink`}
          >
            Approve
            {/* `CLAUDE.md` § Visual direction: an approved entry carries a small star. The
                transcription puts one on the control that produces that state, which is decorative
                rather than a second meaning — so it is `aria-hidden` and sits OUTSIDE the word, and
                the accessible name of this button is still `Approve`. */}
            <span aria-hidden="true"> ★</span>
          </button>
        )}
      </div>

      {open ? (
        <div className="flex flex-col gap-2">
          {/* AC-18. The label asks WHAT WOULD WORK INSTEAD rather than demanding a justification —
              the object is an entry, the question is about the team's schedule, and nothing here
              asks the member to account for their absence. */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">What would work instead?</span>
            <textarea
              data-testid="entry-decision-reason"
              data-required="true"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1"
            />
          </label>

          {/* AC-20. A rejection removes nothing and locks nothing, and the copy has to say so: the
              entry stays on the board, stays theirs, and stays editable and deletable by them. */}
          <p className="text-sm opacity-70">
            The entry stays on the board and stays theirs to edit or remove. This is the team&rsquo;s
            schedule, not permission to be away.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              data-testid="entry-decision-submit"
              type="button"
              disabled={busy}
              onClick={() => void run(() => seam.rejectEntry(entry.id, reason))}
              className="rounded-full bg-rose-100 px-3 py-1 text-sm disabled:opacity-40"
            >
              {busy ? "Saving…" : "Reject with this reason"}
            </button>

            {/* Writes nothing, and says so by doing nothing: the field closes and the entry is
                exactly as it was. */}
            <button
              data-testid="entry-decision-cancel"
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setReason("");
                setError(null);
              }}
              className="text-sm underline disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* AC-3, AC-8 and AC-16. `data-code` carries WHICH refusal, so a test asserts the refusal it
          means rather than "some error" — and a member's forged approval, a blank reason and a row
          the policy filtered are three different sentences with three different codes.

          The message is the seam's and is rendered as it arrives: no SQLSTATE reaches this element,
          because the seam is where 42501 and 23514 become sentences. */}
      {error ? (
        <p
          data-testid="entry-decision-error"
          data-code={error.code}
          role="alert"
          className="text-sm text-rose-600"
        >
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
