// CAL-03 — the team's entries, and an admin's edit and delete controls over them.
// 01-plan.md sections 2, 3 and 4.3.
//
// EVERYTHING here is an affordance (ADR-005). The controls are in the database and nowhere else:
// `entry_update_admin` and `entry_delete_admin` are what decide whose entry an admin may write
// (AC-5, AC-8), the update grant's column list is what refuses `member_id` (AC-7),
// `entry_insert_own` is what refuses creating on somebody's behalf (AC-6),
// `entry_no_overlapping_portion` is INV-01 and AC-9, and `entry_enforce_decision()` is INV-02 and
// AC-3 and AC-4. This screen implements none of them.
//
// **THE REFUSAL BELOW IS AN AFFORDANCE AND NOT A CONTROL, and it is worth being explicit because a
// screen that says "this page is for admins" reads exactly like one.** What stops a member editing
// somebody else's entry is `entry_update_admin`; a member who types this address still reaches this
// component, and if the refusal were deleted they would see the list and every write would still be
// refused. `entry_select_team` admits the whole team's rows to BOTH roles — the read is not the
// capability. AC-10 asserts the affordance; AC-5 asserts the control, by issuing the write rather
// than by looking for a button. The same shape AllowList.tsx and MemberList.tsx already use, which
// is why neither of those files is in this ticket's `allowed_paths`.
//
// **NOTHING ON THIS SCREEN WRITES `status`.** Approving and rejecting are ADM-04 and ADM-05. The
// status is DISPLAYED because AC-3 and AC-4 turn on it — an admin's substantive edit returns an
// approved entry to pending and a note-only edit does not, and an admin who could not see that would
// be revoking a colleague's approval without being told.
//
// **AND NOTHING HERE RECORDS WHO EDITED.** `.ai/standards/rbac-and-security.md` known weakness 3 is
// made real by this screen and is not closed by it: `updated_at` moves and says WHEN, never WHO.
// `data-model.md` OPEN QUESTIONS item 5 offers `updated_by`, it is a schema change, and RULE-09
// makes it the operator's. 01-plan.md Open questions item 1 carries it.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
import { useShellContext } from "@/components/AppShell";
import type { Entry, Failure, Member } from "@/lib/domain/types";
import { PORTION_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { mayAdminister } from "@/lib/roles";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";

// OPS-002 is the ticket the paragraph that stood here named: "the ticket that translates the other
// thirteen files folds these into one place." The three maps are now in src/lib/labels.ts and this
// file imports them — the wording is unchanged, and it is these values that AC-8 kept.

// Four states, and they are four for the reason MemberList.tsx records. "Still loading", "you are
// not an admin" and "the read failed" are three different facts, and folding any two of them would
// tell somebody something untrue: a partial list drawn after a truncated read would hide from an
// admin the exact entries they are here to correct.
type View =
  | { phase: "loading" }
  | { phase: "refused" } // AC-10, and the state a caller with no member row lands on
  | { phase: "unavailable" } // a throw from either read, including the truncation assertion
  | { phase: "ready"; rows: Entry[]; roster: Member[] };

export default function TeamEntries() {
  // **THE CALLER'S OWN ROW COMES FROM THE SHELL, NOT FROM A READ OF OUR OWN**, which is the change
  // `src/routes/Profile.tsx` already made and `AppShell.tsx`'s `ShellContext.member` exists to
  // permit. `getCurrentMember()` is TWO network round trips in the real seam — `auth.getUser()` and
  // then the `member` select — and `App.tsx`'s single `useSession()` has paid for both before this
  // component renders. The duplicate was visible in the network panel on this screen.
  //
  // **IT NARROWS THE `refused` FORK AND LOSES NOTHING.** The old test was `!me || me.role !==
  // "admin"`, and the `!me` half is unreachable from here: `App.tsx:310` renders this component only
  // for `membership.state === "member"`, which is the state that HOLDS a member row. What remains is
  // the role, and the refusal is an affordance either way — `entry_update_admin` and
  // `entry_delete_admin` are the controls, exactly as the header says.
  const { member: me } = useShellContext();
  const [view, setView] = useState<View>({ phase: "loading" });

  // The same three pieces of local state the own-entry list carries, and `confirming` is an id
  // rather than a boolean for the same reason: two rows must never hold the confirmation at once,
  // and a boolean plus a separate id is two pieces of state that can disagree.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Failure | null>(null);

  const load = useCallback(async (): Promise<void> => {
    // AC-10. `refused` still fails CLOSED and is still an affordance: a member who types this
    // address reaches the component and is refused BY it, and every write they could issue is
    // refused by the datastore whatever this line says.
    if (!mayAdminister(me.role)) {
      setView({ phase: "refused" });
      return;
    }

    try {

      // Two reads, and the roster costs no new policy: `listMembers` is TEA-03's and returns the
      // caller's team including removed members. The owner's display name is the column that makes
      // this list different from the own-entry list, and joining here is cheaper than a view.
      const [rows, roster] = await Promise.all([seam.listTeamEntries(), seam.listMembers()]);
      setView({ phase: "ready", rows, roster });
    } catch {
      // Both reads throw on a transport failure and on a possibly-truncated answer. Folding this
      // into `refused` would be wrong twice: an admin would be told they are not one, and a
      // truncated read would be indistinguishable from a quiet team.
      setView({ phase: "unavailable" });
    }
  }, [me.role]);

  useEffect(() => {
    void load();
  }, [load]);

  // AC-2 and AC-12. The confirmation is not decoration: a hard delete has no undo and no trash, the
  // row's `approved_by` goes with it, and this is somebody ELSE's entry — the second press is the
  // only thing between a mis-click and a colleague's absence disappearing without their knowing.
  async function onDelete(entryId: string): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await seam.deleteEntry(entryId);
      if (!result.ok) setDeleteError(result.error);
      else setConfirming(null);
      await load();
    } catch {
      setDeleteError({ code: "unknown", message: "Could not delete this entry. Please try again." });
    } finally {
      setDeleting(false);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="team-entries-loading"
        role="status"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Loading…" />
      </p>
    );
  }

  // AC-10. It names no entry and no member — a refusal that listed what it was withholding would be
  // the read it is refusing.
  if (view.phase === "refused") {
    return (
      <section
        data-testid="team-entries-refused"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">This page is for admins</h1>
        <p className="mt-2 text-sm opacity-70">
          Only an admin can edit or delete another member&rsquo;s entry.
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="team-entries-unavailable"
        role="alert"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">The team&rsquo;s entries could not be loaded</h1>
        {/* No partial list is ever drawn. An admin acting on a list that is short by two entries
            would be correcting a calendar they cannot see all of. */}
        <p className="mt-2 text-sm opacity-70">Please reload the page.</p>
      </section>
    );
  }

  const { rows, roster } = view;

  // The owner's display name, from the roster already read. An id is shown when no roster row
  // matches, which under `entry_select_team` and `member_select_team` cannot happen — both are
  // scoped to the same team by the same helper — so it is a fallback for a state the policies
  // exclude rather than a case with a design.
  const ownerName = (memberId: string): string =>
    roster.find((m) => m.id === memberId)?.displayName ?? memberId;

  return (
    <section className="flex w-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">The team&rsquo;s entries</h1>
        <p className="mt-1 text-sm opacity-70">
          You can correct or remove any of these. The member is not notified.
        </p>
      </header>

      {deleteError ? (
        <p data-testid="team-entry-delete-error" role="alert" className="text-sm text-rose-600">
          {deleteError.message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p
          data-testid="team-entries-empty"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          Nobody on the team has declared anything yet.
        </p>
      ) : (
        <ul data-testid="team-entries" className="flex flex-col gap-2">
          {rows.map((entry) => (
            <li
              key={entry.id}
              data-testid="team-entry-row"
              data-entry-id={entry.id}
              data-member-id={entry.memberId}
              data-type={entry.type}
              data-portion={entry.portion}
              /* AC-11. The two timestamps as the datastore returned them, carried as attributes
                 rather than rendered — an admin's edit must move `updated_at` past `created_at`, and
                 that is the ONLY trace of the edit anywhere in v1. Declared in 03-impl-log.md as an
                 addition beyond 01-plan.md section 4.3's selector table, as CAL-02 declared the same
                 two on `own-entry-row`. */
              data-created-at={entry.createdAt}
              data-updated-at={entry.updatedAt}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
            >
              {/* The column that makes this list different from the own-entry list. Without it an
                  admin is editing an anonymous row, which is how the wrong person's leave gets
                  deleted. */}
              <span data-testid="team-entry-row-member" className="font-medium">
                {ownerName(entry.memberId)}
              </span>

              {/* BOTH BOUNDS, always, as `d → d` for a single day — the form CAL-01 fixed, and for
                  its reason: a single date shown once makes the inclusivity of `end_date`
                  unobservable on exactly the case where an off-by-one is easiest to introduce. The
                  strings render as they arrive; no `new Date(...)` anywhere on this path. */}
              <span data-testid="team-entry-row-dates">
                {entry.startDate} → {entry.endDate}
              </span>

              <span className="opacity-70">{TYPE_LABELS[entry.type]}</span>
              <span className="opacity-70">{PORTION_LABELS[entry.portion]}</span>
              {entry.tentative ? <span className="opacity-70">Tentative</span> : null}
              {entry.note ? <span className="opacity-70">{entry.note}</span> : null}

              {/* AC-3 and AC-4 are read off this attribute. Shown as well as carried, because an
                  admin whose edit costs a colleague an approval has to see that it did. */}
              <span
                data-testid="team-entry-row-status"
                data-status={entry.status}
                className="opacity-70"
              >
                {STATUS_LABELS[entry.status]}
              </span>

              <span className="ml-auto flex items-center gap-3">
                {/* AC-1. The SAME route the owner's own edit uses. EditEntry.tsx chooses its read by
                    the caller's role, so there is one edit screen and not an admin copy of one — a
                    second form would be a second place the six editable fields are decided. */}
                <Link
                  data-testid="team-entry-row-edit"
                  to={`/entries/${entry.id}/edit`}
                  className="underline"
                >
                  Edit
                </Link>

                {confirming === entry.id ? (
                  <>
                    <button
                      data-testid="team-entry-delete-confirm"
                      type="button"
                      disabled={deleting}
                      onClick={() => void onDelete(entry.id)}
                      className="rounded-lg bg-rose-600 px-2 py-1 text-white disabled:opacity-40"
                    >
                      {deleting ? "Deleting…" : "Delete for good"}
                    </button>
                    <button
                      data-testid="team-entry-delete-cancel"
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirming(null)}
                      className="underline disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    data-testid="team-entry-row-delete"
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setConfirming(entry.id);
                    }}
                    className="underline"
                  >
                    Delete
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
