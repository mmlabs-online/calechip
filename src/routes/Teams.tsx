// SOLO, 2026-09-11 — the Teams tab: every team on the system, managed by any admin.
//
// **THE OPERATOR'S THREE DECISIONS, asked as explicit questions with the costs stated:** every admin
// manages every team (two roles, as the charter says — no third); only an EMPTY team may be deleted;
// an approved member may be moved between teams and their history follows them. The fourth — a tab
// of its own rather than a section of `/setting` — is why this is a new screen and not an edit of
// `Threshold.tsx`, which is one team's settings.
//
// **NOTHING HERE IS THE CONTROL (ADR-005).** Every write is one of the `security definer` functions
// in `supabase/migrations/20260911180000_solo_many_teams.sql`, and each begins by testing
// `is_admin` in its own body. A member who reached this screen in a debugger reads nothing —
// `list_teams()` and `list_all_members()` answer an empty set — and any write they issued by hand is
// refused by the function, not by anything in `src/`.
//
// **EVERY WRITE RE-READS, AND NOTHING IS SPLICED LOCALLY.** A move changes two teams' counts and can
// change which team is the caller's own; a delete removes a row; a create adds one. Predicting any of
// those here would be a second copy of the datastore's answer, free to disagree with it — the rule
// `NewSignups.tsx` states for its queue.
//
// **THE SIDEBAR ROSTER DOES NOT FOLLOW A MOVE UNTIL THE NEXT DOCUMENT LOAD**, the same limit
// `tests/e2e/solo-new-signups.spec.ts` records for an approval: `useRoster` reads once on mount and
// the sidebar never unmounts. Recorded rather than fixed — a roster that re-reads on a write is a
// different change.
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
// INV-04's denominator, so a team's "N members" here and the `0/N` on that team's week view are the
// same number by construction rather than by agreement.
import { currentMemberCount } from "@/lib/data/absence";
import type { Failure, Member, Result, Team } from "@/lib/domain/types";
import { mayAdminister, ROLE_LABELS } from "@/lib/roles";
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";

/**
 * The four phases every admin screen in this product carries, so a reader meets no new shape.
 * `refused` AND `unavailable` STAY SEPARATE: an admin whose read threw is not being told they are not
 * an admin.
 */
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "unavailable" }
  | { phase: "ready"; me: Member; teams: Team[]; everyone: Member[] };

/** `dd/MM/yyyy` sliced from the stored ISO instant — no `Date`, no locale; `Threshold.tsx` records
 *  why a local read of a stored date is the trap this codebase avoids. */
const dayOf = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const INPUT =
  "min-w-0 flex-1 rounded-xl border border-line bg-field px-3 py-1.5 text-sm text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const BUTTON_PRIMARY =
  "shrink-0 rounded-pill bg-primary px-4 py-1.5 text-sm font-semibold text-white transition-opacity " +
  "hover:opacity-90 disabled:opacity-40 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const BUTTON_QUIET =
  "shrink-0 rounded-pill border border-line bg-card px-4 py-1.5 text-sm font-semibold text-ink-2 " +
  "transition-colors hover:bg-field hover:text-ink disabled:opacity-40 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function Teams() {
  const [view, setView] = useState<View>({ phase: "loading" });

  const [newName, setNewName] = useState("");
  // Each team's rename field, keyed by team id and seeded from the read. One map rather than a
  // component per row so the whole screen re-seeds from ONE read after every write.
  const [names, setNames] = useState<Record<string, string>>({});
  // What is mid-write: `"create"`, a team id, or a member id. ONE AT A TIME — every write here
  // re-reads the whole screen, and two in flight would race to draw it.
  const [busy, setBusy] = useState<string | null>(null);
  // A refusal stays beside the thing it was about, keyed the same way as `busy`.
  const [failure, setFailure] = useState<{ at: string; error: Failure } | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // Fails CLOSED, as every admin screen here does. The functions would answer a member with two
      // empty sets anyway; refusing in place says why instead of drawing "0 teams".
      if (!me || !mayAdminister(me.role)) {
        setView({ phase: "refused" });
        return;
      }

      const [teams, everyone] = await Promise.all([seam.listTeams(), seam.listAllMembers()]);
      setNames(Object.fromEntries(teams.map((team) => [team.id, team.name])));
      setView({ phase: "ready", me, teams, everyone });
    } catch {
      // Both reads throw on a transport failure and on a possibly-truncated answer. A short list of
      // teams would hide a team from the one screen that manages them.
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every write goes through here: one at a time, a refusal kept beside its row, a re-read on
   *  success. */
  async function run(at: string, write: () => Promise<Result<unknown>>): Promise<void> {
    if (busy !== null) return;
    setBusy(at);
    setFailure(null);
    try {
      const result = await write();
      if (!result.ok) {
        setFailure({ at, error: result.error });
        return;
      }
      if (at === "create") setNewName("");
      await load();
    } catch {
      setFailure({ at, error: { code: "unknown", message: "Something went wrong. Please try again." } });
    } finally {
      setBusy(null);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="teams-loading"
        role="status"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
      >
        <Loader label="Loading the teams…" />
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="teams-refused"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">This page is for admins</h1>
        {/* It names no team: somebody who is not an admin learns here only that admins exist. */}
        <p className="mt-2 text-sm text-ink-2">Only an admin manages the teams.</p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="teams-unavailable"
        role="alert"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">The teams could not be read</h1>
        <p className="mt-2 text-sm text-ink-2">Try again in a moment.</p>
      </section>
    );
  }

  const { me, teams, everyone } = view;

  return (
    <section data-testid="teams-list" className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-ink">Teams</h1>
        <p data-testid="teams-count" data-total={teams.length} className="mt-1 text-sm text-ink-2">
          {teams.length === 1 ? "1 team" : `${teams.length} teams`}. Any admin can create, rename or
          delete a team and move people between teams. Each team&rsquo;s own settings are under
          Settings.
        </p>
      </header>

      <form
        aria-label="Create a team"
        onSubmit={(event) => {
          event.preventDefault();
          void run("create", () => seam.createTeam({ name: newName }));
        }}
        className="flex items-center gap-2 rounded-card bg-card p-3 shadow-soft"
      >
        <input
          data-testid="teams-create-input"
          type="text"
          value={newName}
          placeholder="New team name"
          aria-label="New team name"
          onChange={(event) => {
            setNewName(event.target.value);
            if (failure?.at === "create") setFailure(null);
          }}
          className={INPUT}
        />
        {/* Disabled on an empty field — an affordance. `create_team` and both seam
            implementations refuse an empty name themselves (`empty_team_name`). */}
        <button
          data-testid="teams-create-save"
          type="submit"
          disabled={busy !== null || newName.trim() === ""}
          className={BUTTON_PRIMARY}
        >
          {busy === "create" ? "Creating…" : "Create team"}
        </button>
      </form>
      {failure?.at === "create" ? (
        <p data-testid="teams-create-error" data-code={failure.error.code} role="alert" className="text-sm text-danger">
          {failure.error.message}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {teams.map((team) => {
          // Grouping by team is not INV-04's rule and is not a second definition of anything. The
          // "is this person current" half IS a rule, and it is `currentMemberCount`'s for the number;
          // the list below filters on the same `removedAt === null` for display, the choice
          // `MemberList.tsx` makes above the seam for the same reason.
          const people = everyone.filter((member) => member.teamId === team.id);
          const current = people.filter((member) => member.removedAt === null);
          const removed = people.length - current.length;
          const count = currentMemberCount(people);
          const mine = team.id === me.teamId;
          // THE FOREIGN KEY'S DEFINITION OF EMPTY: any member row at all, removed ones included.
          // `delete_team` refuses on exactly this test, so the button cannot promise more than it.
          const deletable = people.length === 0;
          const draft = names[team.id] ?? team.name;

          return (
            <li
              key={team.id}
              data-testid="team-row"
              data-team-id={team.id}
              data-team-name={team.name}
              data-mine={mine}
              data-member-count={count}
              data-member-rows={people.length}
              className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-2">
                <form
                  aria-label={`Rename ${team.name}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(team.id, () => seam.renameTeam(team.id, { name: draft }));
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <input
                    data-testid="team-row-name-input"
                    type="text"
                    value={draft}
                    aria-label={`Name of ${team.name}`}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNames((all) => ({ ...all, [team.id]: value }));
                    }}
                    className={INPUT}
                  />
                  <button
                    data-testid="team-row-name-save"
                    type="submit"
                    disabled={busy !== null || draft.trim() === "" || draft.trim() === team.name}
                    className={BUTTON_QUIET}
                  >
                    {busy === team.id ? "Saving…" : "Rename"}
                  </button>
                </form>

                {mine ? (
                  <span
                    data-testid="team-row-mine"
                    className="shrink-0 rounded-pill bg-field px-2.5 py-1 text-xs font-semibold text-ink-2"
                  >
                    Your team
                  </span>
                ) : null}

                {/* PRESENT AND DISABLED WHEN THE TEAM IS NOT EMPTY, rather than absent: the control
                    exists for this team the moment its last person leaves, and the title says what
                    stands in the way. That is the opposite of the admin link, which is absent for a
                    member because no condition would ever enable it. */}
                <button
                  data-testid="team-row-delete"
                  type="button"
                  disabled={busy !== null || !deletable}
                  title={
                    deletable
                      ? `Delete ${team.name}`
                      : removed > 0
                        ? "Somebody removed from this team is kept on it for history, so it can never be deleted."
                        : "Move everybody to another team first."
                  }
                  onClick={() => void run(team.id, () => seam.deleteTeam(team.id))}
                  className={BUTTON_QUIET}
                >
                  Delete
                </button>
              </div>

              <p className="text-xs text-ink-3">
                <span data-testid="team-row-member-count">
                  {count === 1 ? "1 member" : `${count} members`}
                </span>
                {removed > 0 ? (
                  <span data-testid="team-row-removed">
                    {" "}
                    · {removed} removed, kept for history
                  </span>
                ) : null}
                {" "}· Created {dayOf(team.createdAt)}
              </p>

              {failure?.at === team.id ? (
                <p data-testid="team-row-error" data-code={failure.error.code} role="alert" className="text-sm text-danger">
                  {failure.error.message}
                </p>
              ) : null}

              {current.length === 0 ? (
                <p data-testid="team-row-empty" className="text-sm text-ink-3">
                  Nobody is on this team.
                </p>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {current.map((person) => (
                    <li
                      key={person.id}
                      data-testid="team-member"
                      data-member-id={person.id}
                      className="flex flex-wrap items-center gap-3 py-2 text-sm"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        <Avatar value={person.avatar} className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {person.displayName}
                        {person.id === me.id ? " (you)" : ""}
                      </span>
                      <span className="text-xs text-ink-3">
                        {ROLE_LABELS[person.role]}
                      </span>

                      {/* THE MOVE. A select whose value is the team the person is on; choosing another
                          moves them at once. HISTORY FOLLOWS THE PERSON — their past absences leave this
                          team's calendar and appear in the new team's past; the operator chose that
                          knowing it, and `moveMember`'s contract says so. */}
                      <label className="flex items-center gap-2 text-xs text-ink-3">
                        <span>Team</span>
                        <select
                          data-testid="team-member-move"
                          value={team.id}
                          disabled={busy !== null || teams.length < 2}
                          onChange={(event) => {
                            const to = event.target.value;
                            if (to !== team.id) {
                              void run(person.id, () => seam.moveMember(person.id, to));
                            }
                          }}
                          className="rounded-lg border border-line bg-field px-2 py-1 text-ink-2 disabled:opacity-60"
                        >
                          {teams.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      {failure?.at === person.id ? (
                        <p
                          data-testid="team-member-error"
                          data-code={failure.error.code}
                          role="alert"
                          className="basis-full text-sm text-danger"
                        >
                          {failure.error.message}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
