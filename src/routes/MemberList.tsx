// TEA-03 — Team member list. 02-design.md sections 1.3, 2 and 6.
// TEA-04 — the remove and promote controls. 01-plan.md sections 4.3 and 8.
//
// EVERYTHING in this file is an affordance (ADR-005). The check lives in row-level security and
// nowhere else: `member_select_team` scopes the rows to the caller's own team, `member_select_own`
// returns a removed caller their own row, and `member_update_admin` plus the column grant plus
// `member_enforce_role_and_removal` refuse every write this screen can issue and every write it
// cannot — whoever issues the statement.
//
// The two controls below are hidden exactly where the policy or the trigger would refuse anyway: on
// a member's own view (AC-14), on the caller's own row, and on a row that is already an admin
// (AC-13). Hiding them saves a round trip and says why; it refuses nobody holding a token, which is
// the whole of ADR-005.
import { useCallback, useEffect, useState, type ReactElement } from "react";
// The seam, through its one door. 02-design.md section 6.2: nothing above the seam names an
// implementation, and this file must never import `./supabase` or `./mock`.
import Modal from "@/components/Modal";
import { seam } from "@/lib/data";
// SOLO, 2026-09-12. `Team` added: the `ready` phase of `View` below carries `team: Team | null` and
// the type was never imported, so `pnpm typecheck` failed with `Cannot find name 'Team'`. The same
// shape of miss as `TYPE_CODES` in WeekView.tsx and `Link` here in Threshold.tsx — Vite compiles a
// module with an unresolved name and says nothing, so only `pnpm typecheck` sees it.
import type { Failure, Member, MemberRole, Team } from "@/lib/domain/types";
import { ROLE_BADGE_COLORS, ROLE_LABELS } from "@/lib/roles";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's sentence. The sentence itself is
// still announced: `Loader.tsx` keeps it as `sr-only` text, because the element below carries
// `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";

/** AC-1, AC-3. `role` is DISPLAYED and never acted on: two roles exist and a roster that does not
 *  say which of the two each person is leaves a member with no way to see whom to ask. */
// SOLO 2026-09-12, ADR-035 — see `src/lib/roles.ts`. This copy labelled a manager `Member`.
const roleLabel = (role: MemberRole): string => ROLE_LABELS[role];

/** SOLO, 2026-09-10. The shape every read-only row action shares, so the group reads as a group. */
const ROW_ACTION =
  "rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:bg-field hover:text-ink disabled:opacity-40 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// The four states of design section 1.3. `loading` MUST resolve, which is why every path out of the
// effect below sets one of the other three.
// SOLO, 2026-09-13. The sortable columns and the two sentinel filter values. Sentinels rather than
// `null` because a `<select>` value is always a string; neither can collide with a team uuid.
type SortKey = "name" | "role" | "team" | "email" | "lastSignIn";
const ALL_TEAMS = "__all__";
const NO_TEAM = "__none__";
const ROLE_RANK: Record<MemberRole, number> = { member: 0, manager: 1, admin: 2 };

/** One comparison per column, ascending. Empty values (no email, never signed in, no team) sort last
 *  ascending, so the rows with something to compare come first. */
function compareMembers(
  key: SortKey,
  a: Member,
  b: Member,
  teamNameOf: (teamId: string | null) => string,
): number {
  const text = (x: string | null, y: string | null): number => {
    if (!x && !y) return 0;
    if (!x) return 1;
    if (!y) return -1;
    return x.localeCompare(y, "vi", { sensitivity: "base" });
  };
  switch (key) {
    case "name":
      return text(a.displayName, b.displayName);
    case "role":
      return ROLE_RANK[a.role] - ROLE_RANK[b.role];
    case "team":
      return text(a.teamId ? teamNameOf(a.teamId) : null, b.teamId ? teamNameOf(b.teamId) : null);
    case "email":
      return text(a.email, b.email);
    case "lastSignIn":
      return text(a.lastSignInAt, b.lastSignInAt);
  }
}

type View =
  | { phase: "loading" }
  | { phase: "notOnATeam" } // AC-7
  | { phase: "unavailable" } // AC-8, and any throw from the read
  // SOLO, 2026-09-12. `teams` REPLACES `team`. The operator asked for every member in the system on
  // this screen, and rows from more than one team need more than one team's name to render the TEAM
  // column — one team was enough only while the roster was scoped to the caller's own.
  | { phase: "ready"; me: Member; roster: Member[]; teams: Team[] }; // AC-1, AC-3, AC-4

export default function MemberList() {
  const [view, setView] = useState<View>({ phase: "loading" });

  // TEA-04, 01-plan.md section 4.3. Three pieces of local state, following AllowList.tsx: the row
  // awaiting confirmation, whether a write is in flight, and the typed failure from either write.
  const [pending, setPending] = useState<Member | null>(null);
  // MIR-03, 01-plan.md section 4.5. The row awaiting the promotion confirmation. Never set together
  // with `pending`: the row controls are disabled while either dialog is open.
  const [promoting, setPromoting] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<Failure | null>(null);

  // SOLO, 2026-09-10. Two panels, two pieces of state, and never both open: each setter clears the
  // other implicitly because only one is ever set by a click.
  const [viewing, setViewing] = useState<Member | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);

  // SOLO, 2026-09-13. Sort and team filter, on the operator's instruction: *"ở table này, cho phép
  // sort, và filter theo Team"*. Display only — both run over rows the read already returned, and
  // neither changes what a caller may see. `null` sort keeps the read's own order until a heading is
  // clicked; a second click on the same heading reverses it.
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>(ALL_TEAMS);

  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // AC-7, and this is the whole of it. The policy scopes to the caller's team by way of the
      // caller's own member row; with no such row there is no team, and the two available answers
      // are "nothing" and "everything". The screen has to say which one it got — an empty list and
      // "you are not on a team" look the same and mean opposite things.
      if (!me) {
        setView({ phase: "notOnATeam" });
        return;
      }

      // SOLO, 2026-09-12 — **EVERY MEMBER IN THE SYSTEM, WHICH IS WHAT THE OPERATOR ASKED FOR.**
      // `listAllMembers()` replaces `listMembers()`, and `listTeams()` replaces `getTeam()`.
      //
      // **THE TWO READS ARE A PAIR AND NEITHER MAKES SENSE ALONE HERE.** `listMembers()` is the
      // caller's own team and is INV-04's denominator on every calendar screen, so it must never
      // start answering more widely; `listAllMembers()` is the separate function that exists for
      // exactly this screen, and the seam's own docblock says so. With rows from several teams on
      // screen, one `getTeam()` could name only one of them, so the TEAM column needs the list.
      //
      // **PENDING SIGN-UPS ARE NOT HERE AND THAT IS NOT AN OVERSIGHT.** They have no team, and
      // `listAllMembers` does not return them — they are `/signups`' queue, with its own decision
      // control. This screen is the roster of people who are already IN, which is why its actions
      // are promote, move and remove rather than admit and refuse.
      //
      // A team that no row references is still fetched, and costs nothing: the map below is keyed by
      // id and read per row.
      // **THE BRANCH IS AN AFFORDANCE AND NOT A CONTROL** (ADR-005), the same shape
      // `EditEntry.tsx` makes for the same reason: it decides which read this screen ISSUES, and the
      // policies decide what each read ANSWERS. `list_all_members()` and `list_teams()` both test
      // `is_admin` in their own bodies, so a member who reached the admin's branch in a debugger
      // would be answered an empty list rather than the product's roster.
      //
      // **IT EXISTS BECAUSE THIS SCREEN IS NOT ADMIN-ONLY AND MUST NOT BECOME SO.** TEA-04 AC-3 is
      // that a member sees the same cells an admin sees, and `tests/e2e/solo-member-admin.spec.ts`
      // test 6 drives a member through it. Pointing everyone at the admin reads showed a member an
      // empty roster — caught by that test, which is why it exists.
      const isAdmin = me.role === "admin";
      const [roster, teams] = await Promise.all([
        isAdmin ? seam.listAllMembers() : seam.listMembers(),
        // A member keeps `getTeam()`, which is `team_select_own` and is the only team they may read.
        // Wrapped into a one-element list so the lookup below has one shape rather than two.
        isAdmin ? seam.listTeams() : seam.getTeam().then((t) => (t ? [t] : [])),
      ]);
      setView({ phase: "ready", me, roster, teams });
    } catch {
      // AC-8, and a transport failure with it. Design section 1.3.1: folding this into
      // `notOnATeam` the way AllowList.tsx folds a throw into `refused` would be wrong twice — a
      // caller who IS on a team would be told they are not, and a truncated read would be
      // indistinguishable from a small team. The roster is INV-04's denominator, so a roster short
      // by two people raises the ratio on every date. No partial list is ever drawn.
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // MIR-03 AC-4, AC-5 — ADR-065 decision 3. Reached only from
  // `member-list-promote-confirm-accept`. TEA-04 chose no confirmation because promotion destroys
  // nothing; ADR-065 adds one because it cannot be undone — an admin cannot be demoted, so a
  // mis-click here has no way back from this screen.
  async function onConfirmPromote() {
    if (!promoting || busy) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await seam.promoteMember(promoting.id);
      if (result.ok) {
        setPromoting(null);
        await load();
      } else {
        // The dialog stays open on a refusal, with the sentence inside it, as removal does.
        setActionError(result.error);
      }
    } catch {
      // A THROW IS NOT A REFUSAL. A transport failure, or the Supabase client raising on an unusable
      // configuration before any request leaves, must not be rendered as "you are not allowed" —
      // that sentence would be false and would send an admin to ask for a permission they have.
      setActionError({
        code: "unknown",
        message: "Could not promote. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  // SOLO 2026-09-12, ADR-035. `onPromote`'s shape, kept rather than generalised: the two
  // refusals and the reload are identical, and folding them would put a direction parameter
  // through a function sixty-odd assertions already address by name.
  async function onSetManager(member: Member) {
    if (busy) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await seam.setMemberRole(
        member.id,
        member.role === "manager" ? "member" : "manager",
      );
      if (result.ok) {
        await load();
      } else {
        setActionError(result.error);
      }
    } catch {
      // A THROW IS NOT A REFUSAL. A transport failure, or the Supabase client raising on an unusable
      // configuration before any request leaves, must not be rendered as "you are not allowed" —
      // that sentence would be false and would send an admin to ask for a permission they have.
      setActionError({
        code: "unknown",
        message: "Could not change that role. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  // TEA-04 AC-1, AC-15. Reached only from `member-list-remove-confirm-accept`, which is the only
  // thing in this file that performs a removal.
  async function onConfirmRemove() {
    if (!pending || busy) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await seam.removeMember(pending.id);
      if (result.ok) {
        setPending(null);
        await load();
      } else {
        // THE DIALOG STAYS OPEN on a refusal, the same shape AllowList.tsx uses: the row the
        // sentence is about is named directly above it.
        setActionError(result.error);
      }
    } catch {
      setActionError({ code: "unknown", message: "Could not remove the member. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  // SOLO, 2026-09-10. The one write the edit panel makes. `load()` afterwards and never a splice —
  // the roster is INV-04's denominator and a list the screen edited locally could disagree with it.
  async function onSaveEdit() {
    if (!editing || busy) return;
    const teamId = editing.teamId;
    if (!teamId) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await seam.setMemberTeam(editing.id, teamId);
      if (result.ok) {
        setEditing(null);
        await load();
      } else {
        setActionError(result.error);
      }
    } catch {
      setActionError({ code: "unknown", message: "Could not save. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="member-list-loading"
        role="status"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Opening the team list…" />
      </p>
    );
  }

  if (view.phase === "notOnATeam") {
    return (
      <section
        data-testid="member-list-not-on-a-team"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">You are not on a team yet</h1>
        <p className="mt-2 text-sm opacity-70">
          This account has not been added to a team yet, so there is no member list to show. Ask an
          admin to add your address to the list of addresses allowed to join the team.
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="member-list-unavailable"
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">Could not read the team list</h1>
        <p className="mt-2 text-sm opacity-70">
          The list may be incomplete, so none of it is shown. Please reload the page.
        </p>
      </section>
    );
  }

  const { me, roster, teams } = view;

  /**
   * SOLO, 2026-09-12. A team id to its name. This REPLACES a single `teamName` string, which was
   * correct only while every row on the screen belonged to the caller's own team.
   *
   * **`—` FOR BOTH "NO TEAM" AND "NO SUCH TEAM", and the two really are the same sentence here.** A
   * member with a null `team_id` is a sign-up nobody has placed yet; an id with no team behind it
   * cannot happen — `member.team_id` is a foreign key — so the fallback is for a team the READ did
   * not return rather than for a team that does not exist. Either way the honest cell is a dash, and
   * a name invented from an id would be the one value on this screen not backed by a read.
   */
  const teamNameOf = (teamId: string | null): string =>
    teams.find((t) => t.id === teamId)?.name ?? "\u2014";

  // TEA-04 AC-13, AC-14, and they are the conditions exactly.
  //
  // `m.removedAt === null` is deliberately NOT in any predicate: the screen only ever draws active
  // members — `current` below runs first — and re-testing it here would imply the list might
  // contain one.
  //
  // MIR-03 AC-11 — ADR-065. **ALL THREE COMPARE TEAMS NOW, BECAUSE ALL THREE CONTROLS ARE OWN-TEAM.**
  // Removal is `member_update_admin`, whose `using` is the caller's own team (ADR-044 Decision 3);
  // the rank write is `public.set_member_role` and promotion is `public.promote_member_to_admin`, and
  // both carry `team_id = member_team_id(auth.uid())` since ADR-065 decision 1. These are AFFORDANCES
  // (ADR-005): each function refuses another team's row whoever issues the call.
  const canRemove = (m: Member): boolean =>
    me.role === "admin" && m.id !== me.id && m.teamId === me.teamId;
  const canPromote = (m: Member): boolean =>
    me.role === "admin" && m.id !== me.id && m.role === "member" && m.teamId === me.teamId;

  // SOLO 2026-09-12, ADR-035. **THE MANAGER RANK TOGGLES; THE ADMIN RANK DOES NOT.** `member` and
  // `manager` move both ways because ADR-035 § Decision item 6 settled that pair; an admin's row
  // draws neither control, because *Demote an admin to member* is NOT DECIDED in
  // `.ai/standards/rbac-and-security.md` and the member trigger refuses the write either way.
  const canSetManager = (m: Member): boolean =>
    me.role === "admin" && m.id !== me.id && m.role !== "admin" && m.teamId === me.teamId;

  // MIR-03, 01-plan.md section 4.5. Only one confirmation is open at a time: while either dialog is
  // open, the row write controls are disabled.
  const rowLocked = busy || pending !== null || promoting !== null;

  // AC-4, second half. The READ deliberately returns removed members carrying `removedAt` — ADR-013
  // and the INV-04 note require the counting function to be given the roster with `removedAt` per
  // member — and this line is where they stop being drawn. It is a display decision and NOT an
  // affordance: nothing about it enforces a permission. Do not push it below the seam.
  const current = roster.filter((m) => m.removedAt === null);

  // SOLO, 2026-09-13. The filter, then the sort. `NO_TEAM` is offered only when some row has no team,
  // so the menu never lists a choice that matches nothing.
  const hasNoTeam = current.some((m) => m.teamId === null);
  const filtered = current.filter((m) =>
    teamFilter === ALL_TEAMS ? true : teamFilter === NO_TEAM ? m.teamId === null : m.teamId === teamFilter,
  );
  const shown = sort
    ? [...filtered].sort((a, b) => {
        const order = compareMembers(sort.key, a, b, teamNameOf);
        return sort.dir === "asc" ? order : -order;
      })
    : filtered;

  const toggleSort = (key: SortKey): void =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const sortHeading = (key: SortKey, label: string, extra = ""): ReactElement => {
    const active = sort?.key === key;
    return (
      <th
        className={`px-4 py-3 font-bold ${extra}`}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          data-testid={`member-list-sort-${key}`}
          onClick={() => toggleSort(key)}
          className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink ${active ? "text-ink" : ""}`}
        >
          {label}
          <span aria-hidden="true" className={active ? "" : "opacity-40"}>
            {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <section className="flex w-full flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Members on the team</h1>
        {/* TEA-04. "This page is view-only" was true until this ticket and is now true for a member
            only — an admin has two controls on it. A standing sentence that stopped being true for
            half the readers is worse than no sentence. */}
        <p className="mt-2 text-sm opacity-70">
          {me.role === "admin"
            ? "Who is on the team, and what each person may do. You can remove somebody, make them a manager so they can approve entries, or promote them to admin."
            : "Who is on the team, and who is an admin. This page is view-only."}
        </p>
      </header>

      {/* AC-13. The failure from a RANK CHANGE renders here, above the table; the failure from a
          removal or a promotion renders inside its dialog, where the row it is about is named. One
          selector, and never two at once — `pending` and `promoting` decide which is on screen
          (MIR-03, 01-plan.md section 4.5). */}
      {!pending && !promoting && actionError ? (
        <p
          data-testid="member-list-action-error"
          role="alert"
          className="rounded-2xl bg-white p-4 text-sm text-rose-600 shadow-sm"
        >
          {actionError.message}
        </p>
      ) : null}

      {current.length > 0 && teams.length > 0 ? (
        <label className="flex items-center gap-2 self-start text-sm text-ink-2">
          <span className="font-semibold">Team</span>
          <select
            data-testid="member-list-team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-pill bg-card px-3 py-1.5 text-sm text-ink shadow-soft focus-visible:outline-2 focus-visible:outline-ink"
          >
            <option value={ALL_TEAMS}>All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {hasNoTeam ? <option value={NO_TEAM}>No team</option> : null}
          </select>
        </label>
      ) : null}

      {current.length === 0 ? (
        <p
          data-testid="member-list-empty"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          Nobody is on the team yet.
        </p>
      ) : (
        // SOLO, 2026-09-10. **SIX COLUMNS AND THREE ACTIONS, ON THE OPERATOR'S INSTRUCTION.** Three
        // of the columns are new — team, last sign-in, and the action group — and `Avatar`, `Name`
        // and `Role` keep their cells, their ids and their contents exactly as TEA-04 shipped them.
        //
        // **NO IMAGE WAS ATTACHED WITH THIS REQUEST, so the arrangement below is this agent's own**
        // and is marked as such — `.ai/standards/ui-design-system.md` § *Visual specification*. What
        // the operator specified in words is WHICH columns and WHICH actions; where they sit, and
        // that the two read-only actions open a modal rather than a route, are decisions taken here.
        <table
          data-testid="member-list-table"
          className="w-full overflow-hidden rounded-card bg-card text-sm shadow-soft"
        >
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-ink-3">
              <th className="px-4 py-3 font-bold">Avatar</th>
              {sortHeading("name", "Name")}
              {sortHeading("role", "Role")}
              {sortHeading("team", "Team")}
              {/* SOLO, 2026-09-12. Between TEAM and LAST SIGN-IN, which is the operator's own order:
                  *avatar, tên, role, team, email, last sign-in, action*. */}
              {sortHeading("email", "Email")}
              {/* `whitespace-nowrap`: the heading wrapped to `LAST SIGN-` / `IN` once the email
                  column took its share of the width, which reads as two headings. */}
              {sortHeading("lastSignIn", "Last sign-in", "whitespace-nowrap")}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  data-testid="member-list-filter-empty"
                  className="px-4 py-8 text-center text-sm opacity-70"
                >
                  Nobody on the team matches this filter.
                </td>
              </tr>
            ) : null}
            {shown.map((member) => (
              // `data-member-id` is how AC-1's "the caller included" is asserted — the caller's own
              // id appears as a row — and how AC-2's "no row belonging to team U" is asserted, by
              // the absence of that team's member id. No "this is you" marker is drawn: the story
              // does not ask for one and the attribute already answers the question.
              <tr
                key={member.id}
                data-testid="member-list-row"
                data-member-id={member.id}
                data-role={member.role}
                className="border-t border-line"
              >
                <td data-testid="member-list-row-avatar" data-avatar={member.avatar} className="px-4 py-3 text-xl">
                  <Avatar value={member.avatar} className="h-8 w-8" />
                </td>
                <td
                  data-testid="member-list-row-name"
                  className="px-4 py-3 font-semibold text-ink"
                >
                  {member.displayName}
                </td>
                <td className="px-4 py-3">
                  {/* AC-3. The same label for both roles from both roles' point of view: there is
                      one policy, no branch on role anywhere below the seam, and no cell an admin
                      sees that a member does not. */}
                  <span
                    data-testid="member-list-row-role"
                    className={`rounded-pill px-3 py-1 text-xs font-semibold ${ROLE_BADGE_COLORS[member.role]}`}
                  >
                    {roleLabel(member.role)}
                  </span>
                </td>

                {/* SOLO. THE TEAM. **The sentence that stood here — "every row on this list carries the
                    SAME one" — was true and is not any more**: this screen reads `listAllMembers()`
                    as of 2026-09-12, so rows from different teams sit side by side and the cell is
                    resolved per row. `data-team-id` is unchanged and is what an assertion reads; the
                    NAME is for the person. */}
                <td data-testid="member-list-row-team" data-team-id={member.teamId ?? ""} className="px-4 py-3 text-ink-2">
                  {teamNameOf(member.teamId)}
                </td>

                {/* SOLO, 2026-09-12 — THE EMAIL. A copy of `auth.users.email` kept on the member row
                    by `20260912120000_solo_member_email.sql`, because `auth` is not readable from the
                    browser at all.

                    **`—` MEANS THE COPY HAS NOT ARRIVED, NEVER THAT THE ACCOUNT HAS NO ADDRESS.**
                    Every account has one; this column can lag by a write on a path the migration's
                    trigger does not cover. A blank cell would read as the second thing.

                    **`whitespace-nowrap`, AND IT REPLACED A `break-all` THAT WAS MEASURED AND WAS
                    WRONG.** An address is one long unbreakable word, so a width cap plus `break-all`
                    split `chi@other.example.com` across two lines mid-token — an address broken
                    mid-word is one a reader cannot copy by eye and cannot trust. The row has the
                    width: the action controls already wrap onto a second line, so nothing is pushed
                    off. */}
                <td
                  data-testid="member-list-row-email"
                  data-email={member.email ?? ""}
                  className="whitespace-nowrap px-4 py-3 text-ink-2"
                >
                  {member.email ?? "\u2014"}
                </td>

                {/* SOLO. **NULL MEANS NEVER, AND THE CELL SAYS SO RATHER THAN GOING BLANK.** An empty
                    cell reads as missing data; "Never" is a fact about the person. The value is a
                    copy of `auth.users.last_sign_in_at` kept by a trigger — see the migration. */}
                <td
                  data-testid="member-list-row-last-sign-in"
                  data-at={member.lastSignInAt ?? ""}
                  className="px-4 py-3 font-mono text-xs text-ink-2"
                >
                  {member.lastSignInAt ? member.lastSignInAt.slice(0, 10) : "Never"}
                </td>

                {/* AC-13, AC-14, as affordances ONLY. A member's view draws no write control; an
                    admin's own row draws no promote and no remove. The policy and the trigger refuse
                    each of those independently for anybody who issues the statement anyway (ADR-005).

                    SOLO, 2026-09-10: **`View info` AND `Edit` ARE OFFERED TO EVERYBODY, AND THAT IS
                    NOT A WIDENED PERMISSION.** `View info` shows the same row already rendered in the
                    table, so it discloses nothing new; `Edit` opens a form whose one save is
                    `member_update_admin`, which refuses a member exactly as it always did. */}
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-2">
                    <button
                      data-testid="member-list-row-view"
                      type="button"
                      onClick={() => setViewing(member)}
                      className={ROW_ACTION}
                    >
                      View info
                    </button>

                    <button
                      data-testid="member-list-row-edit"
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setEditing(member);
                      }}
                      className={ROW_ACTION}
                    >
                      Edit
                    </button>

                    {canPromote(member) ? (
                      <button
                        data-testid="member-list-row-promote"
                        type="button"
                        disabled={rowLocked}
                        onClick={() => {
                          // MIR-03 AC-4. Opens the confirmation; nothing is written yet.
                          setActionError(null);
                          setPromoting(member);
                        }}
                        className={ROW_ACTION}
                      >
                        Promote
                      </button>
                    ) : null}

                    {/* SOLO 2026-09-12, ADR-035. ONE CONTROL AND TWO DIRECTIONS, because the rank it
                        toggles has exactly two states from here: a `member` becomes a `manager`, a
                        `manager` goes back. `data-role` carries the CURRENT rank so a spec can say
                        which direction it expects rather than reading the label. */}
                    {canSetManager(member) ? (
                      <button
                        data-testid="member-list-row-manager"
                        data-role={member.role}
                        type="button"
                        disabled={rowLocked}
                        onClick={() => {
                          void onSetManager(member);
                        }}
                        className={ROW_ACTION}
                      >
                        {member.role === "manager" ? "Remove manager" : "Make manager"}
                      </button>
                    ) : null}

                    {/* **THE LABEL SAYS `Delete account` AND THE WRITE IS A SOFT REMOVE**, which is
                        the operator's choice of 2026-09-10 when asked what the words should mean. A
                        hard delete of `auth.users` needs the service-role key and therefore a server
                        ADR-005 refuses, and it would break ADR-013: a removed member counts until
                        the day they were removed, and INV-04 divides by that. The id and the write
                        are TEA-04's, unchanged. */}
                    {canRemove(member) ? (
                      <button
                        data-testid="member-list-row-remove"
                        type="button"
                        disabled={rowLocked}
                        onClick={() => {
                          setActionError(null);
                          setPending(member);
                        }}
                        className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-danger transition-colors hover:bg-field disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        Delete account
                      </button>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* SOLO, 2026-09-10 — VIEW INFO. It renders the row that is already on screen and reads
          nothing: a panel that fetched would be a second source for facts the table just showed, and
          the two could disagree. It carries no control, so there is nothing here to refuse. */}
      {viewing ? (
        <Modal
          testIdPrefix="member-info"
          label={`About ${viewing.displayName}`}
          onClose={() => setViewing(null)}
        >
          <dl data-testid="member-info" data-member-id={viewing.id} className="flex flex-col gap-2 text-sm">
            {[
              ["Name", viewing.displayName],
              ["Role", roleLabel(viewing.role)],
              ["Team", teamNameOf(viewing.teamId)],
              // SOLO, 2026-09-12. Beside the row's own cell, for the reason the rest of this panel
              // exists: it is what a person reads when they want one member rather than the list.
              ["Email", viewing.email ?? "\u2014"],
              ["Last sign-in", viewing.lastSignInAt ?? "Never"],
              ["Joined", viewing.createdAt.slice(0, 10)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-right font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      ) : null}

      {/* SOLO, 2026-09-10 — EDIT, WHICH TODAY CHANGES THE TEAM AND NOTHING ELSE.
          The operator asked for exactly that.

          **⚠️ THE PICKER OFFERS ONE TEAM, AND THAT IS THE POLICY RATHER THAN A PLACEHOLDER.**
          `member_update_admin`'s `with check` is `team_id = member_team_id(auth.uid())`, so the only
          team an admin can write is the one they are already on — and every row on this list is
          already on it, because `member_select_team` scoped the read. So this control is honest and
          currently inert: saving writes the value the row already has.

          **MOVING SOMEBODY BETWEEN TEAMS NEEDS TWO THINGS THIS CHANGE DOES NOT DO**: a second team,
          and a policy that lets an admin write a team id they are not on. The second is a security
          decision — it would let any admin move any member anywhere — and is not one to take in
          passing. Recorded here rather than hidden behind a disabled control with no explanation. */}
      {editing ? (
        <Modal
          testIdPrefix="member-edit"
          label={`Edit ${editing.displayName}`}
          onClose={() => setEditing(null)}
        >
          <div data-testid="member-edit" data-member-id={editing.id} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-3">Team</span>
              <select
                data-testid="member-edit-team"
                data-team-id={editing.teamId ?? ""}
                defaultValue={editing.teamId ?? ""}
                className="rounded-lg border border-line bg-field px-2 py-1 text-ink"
              >
                <option value={editing.teamId ?? ""}>{teamNameOf(editing.teamId)}</option>
              </select>
            </label>

            <p data-testid="member-edit-note" className="text-xs text-ink-3">
              An admin can only move somebody to their own team, so there is one team to choose
              until this product has more than one.
            </p>

            {actionError ? (
              <p data-testid="member-edit-error" data-code={actionError.code} role="alert" className="text-sm text-danger">
                {actionError.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                data-testid="member-edit-cancel"
                type="button"
                onClick={() => setEditing(null)}
                className={ROW_ACTION}
              >
                Cancel
              </button>
              <button
                data-testid="member-edit-save"
                type="button"
                disabled={busy}
                onClick={() => void onSaveEdit()}
                className="rounded-pill bg-wfh px-4 py-1 text-xs font-semibold text-ink transition-colors hover:brightness-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* AC-15, and .ai/standards/ui-design-system.md, Destructive actions: the confirmation NAMES      {/* AC-15, and .ai/standards/ui-design-system.md, Destructive actions: the confirmation NAMES
          what is about to be lost, and "Are you sure?" names nothing. What is lost here is a
          person's presence on the roster and their contribution to the team size every overload
          warning divides by; what is NOT lost is their entries, and an admin who assumes otherwise
          will not remove anybody. So the dialog says both.

          This is not an affordance over a permission. It protects against a mis-click by somebody
          who is fully entitled to the action. */}
      {pending ? (
        <div
          data-testid="member-list-remove-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm removing the member"
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <p className="text-sm">
            Remove <strong>{pending.displayName}</strong> from the team? Their leave and WFH entries
            are kept and still show on the calendar.
          </p>

          {actionError ? (
            <p data-testid="member-list-action-error" role="alert" className="mt-2 text-sm text-rose-600">
              {actionError.message}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              data-testid="member-list-remove-confirm-accept"
              type="button"
              disabled={busy}
              onClick={() => {
                void onConfirmRemove();
              }}
              className="rounded-xl bg-rose-600 px-4 py-2 text-white disabled:opacity-40"
            >
              {busy ? "Removing…" : "Remove from team"}
            </button>
            <button
              data-testid="member-list-remove-confirm-cancel"
              type="button"
              disabled={busy}
              onClick={() => {
                setActionError(null);
                setPending(null);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* MIR-03 AC-4, AC-5 — ADR-065 decision 3. The removal dialog's shape, in the same place and
          order: the sentence, any error, the confirm button, Cancel. The confirm button is a filled
          primary button and NOT the rose danger fill, because nothing is lost; what it guards
          against is that an admin cannot be demoted. Layout is the Tech Lead's own (01-plan.md
          section 2b). */}
      {promoting ? (
        <div
          data-testid="member-list-promote-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm promoting the member"
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <p className="text-sm">
            Make <strong>{promoting.displayName}</strong> an admin? An admin cannot be demoted, so this
            cannot be undone here.
          </p>

          {actionError ? (
            <p data-testid="member-list-action-error" role="alert" className="mt-2 text-sm text-rose-600">
              {actionError.message}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              data-testid="member-list-promote-confirm-accept"
              type="button"
              disabled={busy}
              onClick={() => {
                void onConfirmPromote();
              }}
              className="rounded-xl bg-wfh px-4 py-2 font-semibold text-ink transition-colors hover:brightness-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {busy ? "Promoting…" : "Make admin"}
            </button>
            <button
              data-testid="member-list-promote-confirm-cancel"
              type="button"
              disabled={busy}
              onClick={() => {
                setActionError(null);
                setPromoting(null);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
