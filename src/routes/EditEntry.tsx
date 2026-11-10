// CAL-02 — edit one of the caller's own entries. 01-plan.md sections 2 and 4.3.
//
// EVERYTHING here is an affordance (ADR-005). `entry_update_own` is what decides whose entry may be
// edited (AC-9), the update grant's column list is what refuses `member_id`, `status` and
// `rejection_reason` (AC-8, AC-10), `entry_no_overlapping_portion` is INV-01 and AC-7, and
// `entry_enforce_decision()` is INV-02 and AC-5 and AC-6. This screen implements none of them; it
// shows what the datastore answered.
//
// **THE ENTRY IS LOADED FROM ONE LIST READ AND THERE IS NO `getEntryById`.** A single-row read would
// be a read whose only distinct behaviour is answering about rows the caller may not edit (CAL-02
// 01-plan.md section 4.3). It also makes `edit-entry-not-found` say nothing about whether the id
// exists: not in your list and no such entry are one answer here, as they are in the seam.
//
// **CAL-03 CHOOSES WHICH LIST BY THE CALLER'S ROLE, and that is the whole of this screen's change.**
// An admin loads `listTeamEntries()`, everybody else `listOwnEntries()`. THIS IS AN AFFORDANCE AND
// NOT A CONTROL: both reads are served by `entry_select_team`, which admits the team's rows to BOTH
// roles, so the branch decides which rows this screen OFFERS and decides nothing about which writes
// succeed. `entry_update_admin` is the control, and a member who reached an admin's list would still
// have every save refused (CAL-03 AC-5).
//
// **THE FORM ON THIS SCREEN STILL WRITES NO `status`, AND ADM-05 ADDS THREE THINGS THAT ARE NOT THE
// FORM.** CAL-02's header read "nothing on this screen writes `status` … approving is ADM-05", and
// that is now here — as a SEPARATE panel beside the form, never as a field in it. `EntryForm`'s six
// substantive fields are untouched, and a decision is not an edit.
//
//   1. **`EntryDecision`, FOR AN ADMIN ONLY** — the affordance that makes AC-4, AC-5 and AC-11
//      reachable for an entry that is no longer pending. `/entries/pending` shows pending entries by
//      construction, so `rejected → approved` and the reason edit have nowhere else to happen. The
//      role branch this file already makes for its READ decides it, and it is an affordance for the
//      same reason that branch is: clause (a) of `public.entry_enforce_decision()` is the control,
//      and a member who reached the panel would have every decision refused (AC-8, AC-9).
//   2. **The rejection reason, and when the decision was recorded — FOR BOTH ROLES (AC-15).** The
//      member is the reader this criterion is about: v1 has no notification channel and must not
//      grow one, so the reason reaches its subject ON PULL, here, with no admin telling them. The
//      time is `updated_at`, which the trigger writes from the datastore's clock and no client can
//      set. WHO rejected is not available and 01-plan.md Open questions item 1 says why: `entry` has
//      no `rejected_by`, and clause (b) nulls `approved_by` on any transition off `approved` rather
//      than park a false record there.
//   3. **One sentence on what the star means (AC-19)**, beside `edit-entry-status`, which is where
//      somebody who has just seen a star on a calendar is standing.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EntryDecision from "@/components/EntryDecision";
import EntryForm from "@/components/EntryForm";
import type { EntryFormValues } from "@/components/EntryForm";
import { seam } from "@/lib/data";
import { mayAdminister } from "@/lib/roles";
// SOLO, 2026-09-10. The picker holds days, the row holds a range: this expands one into the other on
// the way in, and `dateRuns` folds it back on the way out.
import { dateRuns, datesInRange } from "@/lib/date-selection";
import type { Entry, Failure } from "@/lib/domain/types";
// OPS-002. The status words moved to src/lib/labels.ts, which is their ONE declaration (AC-8) —
// TeamEntries.tsx held a second, already-English copy of the same three strings.
import { STATUS_LABELS } from "@/lib/labels";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";

// Three states and not two. "Still loading" and "no such entry of yours" are different facts, and
// rendering the refusal while the read is in flight would show `edit-entry-not-found` on every load
// of a perfectly valid entry — the same reason App.tsx separates `resolving` from `signed-out`.
type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; entry: Entry };

export default function EditEntry() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  // CAL-03. Held separately from `LoadState` rather than folded into its `ready` case, because
  // `onSave` replaces that case with the row the datastore returned and would have to carry the
  // role through a value that has nothing to do with it. It governs ONE link.
  const [admin, setAdmin] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!id) {
      setState({ phase: "missing" });
      return;
    }

    try {
      // CAL-03 AC-1, AC-3, AC-4, AC-9. `getCurrentMember()` is one call and no new policy — TEA-02
      // built it and `member_select_own` already serves it. A null member takes the `listOwnEntries`
      // branch, which answers `[]`, which is the refusal below: a caller with no member row has
      // nothing to edit, and INV-07 is why.
      const me = await seam.getCurrentMember();
      const isAdmin = me !== null && mayAdminister(me.role);
      setAdmin(isAdmin);

      const reachable = isAdmin ? await seam.listTeamEntries() : await seam.listOwnEntries();
      const entry = reachable.find((e) => e.id === id);
      setState(entry ? { phase: "ready", entry } : { phase: "missing" });
    } catch {
      // Both reads throw on a transport failure and on a possibly-truncated read. Neither has an
      // acceptance criterion here, and the honest consequence is the same refusal a missing entry
      // gets: this screen has nothing to edit either way.
      setState({ phase: "missing" });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // AC-1, AC-2, AC-5, AC-6, AC-7, AC-11, AC-12. The updated row is re-read rather than assumed: the
  // TRIGGER may have rewritten `status`, `approved_by`, `approved_at` and `updated_at` on the way
  // through, and a screen that painted the values it sent would show an entry as still approved
  // after the datastore had returned it to pending.
  // SOLO, 2026-09-10. ONE ROW, so one run. `selection="single-run"` is what keeps the form from
  // submitting a gapped selection at all, and this is the second guard rather than the first: the
  // control is already disabled, and a refusal here would be a failure code invented in a component
  // for a state the interface does not offer.
  async function onSave(values: EntryFormValues): Promise<Failure | null> {
    if (!id) return { code: "entry_not_permitted", message: "This entry could not be edited." };

    const [run, ...rest] = dateRuns(values.dates);
    if (run === undefined || rest.length > 0) return null;

    const result = await seam.updateEntry(id, {
      type: values.type,
      portion: values.portion,
      startDate: run.startDate,
      endDate: run.endDate,
      tentative: values.tentative,
      note: values.note,
    });
    if (!result.ok) return result.error;

    setState({ phase: "ready", entry: result.value });
    return null;
  }

  if (state.phase === "loading") {
    return (
      <p
        data-testid="edit-entry-loading"
        role="status"
        className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Loading…" />
      </p>
    );
  }

  // AC-9's read half. It says nothing about whether the id exists — a message distinguishing "not
  // yours" from "no such entry" would be an oracle for which entry ids exist in the team, which is
  // the property `updateEntry`'s single failure code protects one layer down.
  if (state.phase === "missing") {
    return (
      <section
        data-testid="edit-entry-not-found"
        className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        <p>We could not find that entry in your list.</p>
        <p>
          <Link data-testid="edit-entry-back" to="/entries/new" className="underline">
            Back to your entries
          </Link>
        </p>
      </section>
    );
  }

  const { entry } = state;

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      {/* SOLO, 2026-09-10. The card the form used to draw around itself. `EntryForm` gave up its own
          surface when it was redrawn, because inside the month view's dialog it is already on one —
          so the two routes that mount it on a page provide it here. */}
      <div className="rounded-card bg-card p-6 shadow-soft md:p-8">
      <EntryForm
        testIdPrefix="edit-entry"
        title="Edit entry"
        submitLabel="Save changes"
        submittingLabel="Saving…"
        initial={{
          type: entry.type,
          portion: entry.portion,
          // The stored range, expanded into the days the picker fills. A single-day entry is one
          // chosen day, which is CAL-01 AC-3's inclusivity seen from the other side.
          dates: datesInRange(entry.startDate, entry.endDate),
          tentative: entry.tentative,
          note: entry.note,
        }}
        afterSubmit="keep"
        onSubmit={onSave}
        selection="single-run"
        /* CAL-07, 01-plan.md section 4.5. Two props, and both values are already on this screen.

           `ownerId` is the ENTRY's member and never the caller: an admin editing somebody else's
           entry counts that member, not themselves (AC-18, INV-07). `excludeEntryId` is AC-17 — the
           fetched rows contain this entry, and appending the draft beside it would count its owner
           twice on a day they are already down for. */
        ownerId={entry.memberId}
        excludeEntryId={entry.id}
      />
      </div>

      {/* ADM-05 AC-4, AC-5, AC-10, AC-11. An ADMIN ONLY, and the branch is the one this screen
          already makes for its read — an affordance and not a control, exactly as that branch is.
          It is the SAME component the worklist mounts, so the rule that a rejection carries a reason
          is written once.

          `load` and not a local write: the trigger rewrites `status`, `approved_by`, `approved_at`
          and `rejection_reason` on the way through, and a screen that painted what it sent would
          show an entry as rejected while still naming its approver. */}
      {admin ? (
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
          <EntryDecision entry={entry} onDecided={load} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
        {/* AC-5 and AC-6. The status as the datastore returned it after the write, which is how a
            member sees that a substantive edit cost them an approval and a note-only edit did not. */}
        <span data-testid="edit-entry-status" data-status={entry.status} className="opacity-70">
          {STATUS_LABELS[entry.status]}
        </span>

        {/* ADM-05 AC-19. The star's meaning, stated ONCE, in the product — the calendar views draw
            the star and none of them explains it, and until this ticket nothing could put one there
            to be explained. Rendered on every status rather than only on an approved entry: the
            person who asks what a star means is usually looking at an entry that has not got one.

            It says what an approval IS and, deliberately, what it is not — a coordination signal
            about the team's schedule, never a decision about whether somebody may be away
            (AC-18, AC-20, charter refusal 2). */}
        <span data-testid="edit-entry-star-meaning" className="opacity-70">
          A star means an admin has seen this entry and accepted it against the team&rsquo;s
          schedule. It is not permission to be away.
        </span>

        {/* Present ONLY when the entry names an approver. Its absence after a substantive edit is
            half of AC-5: `entry_enforce_decision()` clears `approved_by` and `approved_at` together
            with the status, and an entry that still named its approver while reading `pending` is
            the false record INV-02 exists to prevent. */}
        {entry.approvedBy ? (
          <span
            data-testid="edit-entry-approved-by"
            data-approved-by={entry.approvedBy}
            data-approved-at={entry.approvedAt ?? ""}
            className="opacity-70"
          >
            Approved by {entry.approvedBy}
          </span>
        ) : null}

        {/* ADM-05 AC-15. The reason and the time, for BOTH roles — the owner of a rejected entry
            reads them here with no admin telling them, which is the member-facing half of INV-03.
            Present only when the entry is `rejected`, which is not a rendering choice but the
            constraint: `entry_rejection_reason_iff_rejected` is a BICONDITIONAL, so a reason exists
            on exactly these rows and on no others.

            WHO decided is absent, and 01-plan.md Open questions item 1 records that as a
            TODO(project) rather than dropping it quietly: `entry` has no `rejected_by` column, and
            writing the rejecter into `approved_by` would be the false record ADR-016's own revert
            condition 1 exists to detect. Closing it is a schema change and a human's. */}
        {entry.status === "rejected" ? (
          <>
            <span data-testid="edit-entry-rejection-reason" className="opacity-70">
              Why it was rejected: {entry.rejectionReason}
            </span>
            <span
              data-testid="edit-entry-decided-at"
              data-updated-at={entry.updatedAt}
              className="opacity-70"
            >
              Decision recorded {entry.updatedAt}
            </span>
          </>
        ) : null}

        {/* AC-12, carried as attributes for the same reason the own-entry row carries them. */}
        <span
          data-testid="edit-entry-timestamps"
          data-created-at={entry.createdAt}
          data-updated-at={entry.updatedAt}
          className="opacity-70"
        >
          Last edited: {entry.updatedAt}
        </span>

        {/* CAL-03. An ADDITIONAL link, and `edit-entry-back` below keeps its name, its destination
            and its position — tests/e2e/cal-02-edit-delete-entry.spec.ts clicks it and expects the
            own-entry form, and 01-plan.md section 4.3 requires that suite to pass UNEDITED.
            An admin who arrived from the team list needs the way back to the team list; sending them
            to their own entries would be the screen forgetting where they came from. Declared in
            03-impl-log.md as an addition beyond section 4.3.

            It is `admin` and not "did they arrive from /entries/team", because a role is a fact the
            seam already answered and a referrer is not. */}
        {admin ? (
          <Link data-testid="edit-entry-team-back" to="/entries/team" className="ml-auto underline">
            Back to the team&rsquo;s entries
          </Link>
        ) : null}

        <Link
          data-testid="edit-entry-back"
          to="/entries/new"
          className={admin ? "underline" : "ml-auto underline"}
        >
          Back to the list
        </Link>
      </div>
    </section>
  );
}
