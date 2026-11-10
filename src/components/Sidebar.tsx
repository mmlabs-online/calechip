// UIE-02 — the persistent sidebar. 01-plan.md § 4.2, § 4.8 and § 4.9.
//
// **EVERY `home-*` ID HERE IS RELOCATED AND UNRENAMED, AND THAT IS THE WHOLE CUT OF THIS TICKET.**
// Eleven of the twelve ids that lived in `src/routes/Home.tsx` move into this file letter for
// letter; the twelfth, `home-new-entry-link`, moves into `TopBar.tsx` (AC-19). Fifteen spec files
// address them and NONE is in scope here — every assertion on them is a visibility, click or text
// check that passes wherever the node lives, provided the name and the count are unchanged. AC-6 is
// the count and AC-7 is the two role strings.
//
// **NOTHING HERE IS A CONTROL.** Every element is an affordance over a row-level-security policy
// that already exists and is not touched (01-plan.md § 3, ADR-005). A caller who types one of the
// admin addresses still reaches the screen and is still refused BY IT — `allow-list-refused`,
// `team-entries-refused`, `threshold-refused`, `pending-entries-refused`. Hiding a link saves a
// pointless journey and refuses nobody. That was true when the links were here and it is exactly as
// true now that they are not.
//
// -----------------------------------------------------------------------------------------------
// **UIE-10 — THE MIGRATION HALF. THIS FILE NO LONGER RENDERS ANYTHING ROLE-DEPENDENT.**
// 01-plan.md § 4.1 and § 4.2. Two changes, and the second reverses a decision UIE-02 wrote down:
//
// 1. THE FOUR ADMIN-ONLY LINKS ARE GONE, FOR BOTH ROLES (AC-1). `home-pending-entries-link`,
//    `home-team-entries-link`, `home-allow-list-link` and `home-threshold-link` are removed rather
//    than relocated, and `isAdmin` is removed with them. UIE-09's hub at `/admin` carries the same
//    four addresses under its own `admin-hub-*-link` ids, reached from `shell-admin-link` in the top
//    bar. The paragraph above about UIE-02's relocation trick describes THAT ticket and is left
//    standing as its record; it does not describe this one.
// 2. EVERY ROSTER ROW NOW SHOWS THE MEMBER'S ROLE (AC-7), under the new id `shell-roster-role`.
//    This reverses the first clause of the sentence at the roster row below — *"No role badge, no
//    count and no control on a row"* — and only the first clause. The reversal is marked at that
//    comment and in AC-7, because a reversal nobody marked is what
//    `.ai/standards/ui-design-system.md` § *Visual specification* exists to prevent.
//
// WHAT THIS COSTS THE SUITE, AND WHY IT IS PAID HERE. Nine spec files clicked or asserted those four
// ids. The nine navigation sites each gained one step — reach the hub, then click its link — and the
// SIX NEGATIVE ASSERTIONS THAT SAID A MEMBER IS OFFERED NOTHING WERE REWRITTEN ONTO
// `shell-admin-link` (AC-4). Left naming a removed id they would have passed VACUOUSLY: an assertion
// that a named node is absent is satisfied by the name never having existed, for anybody. AC-5 is
// the criterion that says no such assertion survives anywhere in the suite.
//
// -----------------------------------------------------------------------------------------------
// **SOLO, 2026-09-09 — THE ROSTER IS GROUPED AND EACH GROUP COLLAPSES.** No ticket, no gate;
// `.claude/agents/solo.md` is what authorises that. **THAT FILE AND `.claude/commands/solo.md` BOTH
// CITE `.ai/registry/decisions/ADR-033-solo-engineer.md`, WHICH IS NOT ON DISK** — the decisions
// directory stops at ADR-032. The citation is repeated here as a pointer to that gap and not as
// evidence; the agent definition is the thing that actually exists.
//
// **THE GROUPING KEY IS `role`, AND IT IS NOT WHAT THE TRANSCRIPTION SHOWED.** The operator attached
// an image grouping the roster by sub-team — `CORE ENGINEERING`, `FRONTEND TEAM`, `QA / TESTING` —
// and NO SUCH FIELD EXISTS. `Member` carries `teamId` and nothing else that partitions a roster
// (`src/lib/domain/types.ts`), INV-07 makes it one team per member, and `member_select_team` scopes
// `listMembers()` to the caller's own team — so grouping by `teamId` yields exactly one group,
// always, and a drawer with nothing beside it is not a drawer. Inventing a `sub_team` column is what
// `CLAUDE.md` § *No invention* forbids and would touch `.ai/standards/data-model.md`, which is the
// human-only plane. **The operator was asked and chose `role`**, which needs no read this file did
// not already make: `useRoster` has returned `role` on every member since TEA-03 and UIE-10 already
// draws it on every row.
//
// **THE TOGGLE IS `<details>`/`<summary>` AND NOT A `<button>`, AND THAT IS LOAD-BEARING.** UIE-10
// AC-10 (`tests/e2e/uie-10-sidebar.spec.ts`) asserts the pane renders EXACTLY ONE `<button>` and
// that it is `home-sign-out` — the criterion that says this pane writes nothing. A disclosure toggle
// writes nothing either, so the criterion is right and it is the ELEMENT that had to give way.
// Native disclosure costs no state, no `aria-expanded` to keep true and no key handler, and it keeps
// a shipped assertion passing UNEDITED rather than relaxing it to admit this change.
//
// **NOTHING ABOUT A ROW CHANGED.** `shell-roster-row`, `shell-roster-role` and `shell-roster-count`
// keep their names, their count and their text; the rows are the same nodes under two parents
// instead of one. `shell-roster-count` stays OUTSIDE the groups — it is INV-04's denominator
// everywhere else in the product and must not leave the screen with a closed drawer.
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useRoster } from "@/hooks/useRoster";
import { useViewedTeam } from "@/hooks/useViewedTeam";
import { seam } from "@/lib/data";
import type { Member, MemberRole, Result } from "@/lib/domain/types";
import { ROLE_LABELS } from "@/lib/roles";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";
import BrandLogo from "@/components/BrandLogo";
import { useAppVersion } from "@/hooks/useAppVersion";

export interface SidebarProps {
  member: Member;
  signOut(): Promise<Result<void>>;
}

/** AC-7. `role` is DISPLAYED and never acted on. Moved from `Home.tsx:29` unchanged — the two
 *  strings are letter for letter what a shipped spec asserts, and any uppercase presentation below
 *  is a CSS transform rather than a different string. `MemberList.tsx` still carries its own copy
 *  of this mapping; folding the two is not this ticket's (Home.tsx's own note, and § 7). */
// SOLO 2026-09-12, ADR-035. **THE TERNARY THAT STOOD HERE LABELLED A MANAGER `Member`.** One
// declaration now, in `src/lib/roles.ts`, for the reason OPS-002 AC-8 folded the entry label sets.
const roleLabel = (role: MemberRole): string => ROLE_LABELS[role];

// SOLO 2026-09-13. The product name `Ai Nghỉ?` that stood here is gone: the brand is `CaleChip` and
// a logo linking to `/`, drawn once in `BrandLogo` for this sidebar and the auth card alike.

// § Language. The transcription's tagline is `Lịch vắng mặt team` and the interface is English, so
// this is an English line rather than a translation of that one — 01-plan.md § 1 Out of scope item
// 10. It describes what the board holds and asserts no capability.
const TAGLINE = "Leave and working from home";

// Used only by the <nav> a /solo run commented out on 2026-09-12, when the third link moved into
// the admin panel. Kept so restoring that block is one edit rather than two.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NAV_LINK =
  "block rounded-pill px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition-colors " +
  "hover:bg-field hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// TSK-01 § 2b. The shell's nav-link look, which is `NAV_LINK` above. Written as its own constant
// rather than by reviving that one, whose disable directive records that it is held for one edit.
const TASKS_LINK =
  "block rounded-pill px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition-colors " +
  "hover:bg-field hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** AC-11. Exactly three rows and no fourth. The three colours are `CLAUDE.md` § Visual direction —
 *  PTO peach, WFH mint, holidays lavender — through the tokens added to `src/index.css` beside
 *  UIE-01's.
 *
 *  NO OVERLOAD ROW: it needs `overloadThreshold` and a `seam.getTeam()` call this shell does not
 *  make, and no calendar view computes an overload state today (`WeekView.tsx:11`). NO BRIDGE-DAY
 *  ROW: a swatch is a fill and a bridge day has no fill — it is a working day carrying an outlined
 *  badge (01-plan.md Open question 3). Both are absent rather than disabled (AC-20). */
const LEGEND: readonly { label: string; swatch: string }[] = [
  { label: "Leave (PTO)", swatch: "bg-pto" },
  { label: "Working from home (WFH)", swatch: "bg-wfh" },
  { label: "Holiday", swatch: "bg-holiday" },
];

/** The roster chip and the account-footer chip are the same 26px circle, so it is written once. */
function AvatarChip({ avatar, testId }: { avatar: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      data-avatar={avatar}
      aria-hidden
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-pill bg-field p-[3px] text-[13px]"
    >
      <Avatar value={avatar} />
    </span>
  );
}

/** SOLO. The roster's groups, in this order and for this reason: an admin is who you look for when
 *  you need something decided, so that drawer is the one at the top of the pane.
 *
 *  These are PLURALS and `roleLabel` above returns SINGULARS, kept as separate strings rather than
 *  derived by suffixing an `s`. `roleLabel`'s two words are letter for letter what shipped specs
 *  assert (`tests/e2e/tea-05-sign-in.spec.ts` at :65, :146, :155 and UIE-10 AC-7), and a header built
 *  out of them would make a group label's copy a hostage to a row's. They are two pieces of copy
 *  about the same fact and they are allowed to differ. */
// SOLO 2026-09-13. **MANAGERS ADDED, between the two.** With only `admin` and `member` here, every
// manager (ADR-035) was filtered out of the roster while still counted in `shell-roster-count`, so
// the header said 7 and the drawers listed 6. Every role now has a group, which is what keeps the
// groups a partition of the team.
const ROLE_GROUPS: readonly { role: MemberRole; label: string }[] = [
  { role: "admin", label: "Admins" },
  { role: "manager", label: "Managers" },
  { role: "member", label: "Members" },
];

/** The disclosure chevron. Drawn pointing DOWN and rotated to point up while the group is open,
 *  which is the state the transcription shows.
 *
 *  Inline SVG rather than `lucide-react`. The package is a dependency and NO file under `src/`
 *  imports it today — `grep -rn "lucide-react" src/` returns nothing — and a request to make one
 *  list collapse is not the change that should decide whether this product carries an icon set.
 *
 *  `aria-hidden`, and it carries no state of its own: `<details>` owns the open/closed fact and
 *  announces it natively, so a second announcement here would be a duplicate that can disagree. */
function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="ml-auto h-3 w-3 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One roster row, lifted out of the map unchanged when the map moved inside a group. Every id,
 *  attribute and string below is UIE-02's or UIE-10's and none of them is this change's. */
function RosterRow({ member, isMe }: { member: Member; isMe: boolean }) {
  return (
    <li
      data-testid="shell-roster-row"
      data-member-id={member.id}
      className="flex items-center gap-2"
    >
      <AvatarChip avatar={member.avatar} />
      {/* UIE-02 AC-9. `(You)` marks the signed-in member, appended to the name rather than
          replacing it — the roster is who is on the team, and the caller is one of them. It stays
          on the NAME line: moved down beside the role word it would read as a second role (UIE-10
          01-plan.md § 2b).

          **UIE-10 AC-7 REVERSES THE FIRST CLAUSE OF WHAT THIS COMMENT USED TO SAY.** It read *"No
          role badge, no count and no control on a row"*; a row now carries the role word. THE OTHER
          TWO CLAUSES STAND — no count and no control on a row (UIE-10 AC-10) — and the reversal is
          marked here rather than made silently, which is what
          `.ai/standards/ui-design-system.md` § *Visual specification* asks of a decision that
          changes. **THE COUNT CLAUSE STILL STANDS AFTER SOLO**: the count pill the transcription
          shows sits on a GROUP HEADER, which is not a row. */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] text-ink-2">
          {isMe ? `${member.displayName} (You)` : member.displayName}
        </span>
        {/* UIE-10 AC-7 and AC-8. `shell-roster-role` and NEVER `home-member-role`: that name
            belongs to the account footer below and `tests/e2e/tea-05-sign-in.spec.ts` reads it by
            text at :65, :146 and :155, so a second node under it resolves to two under strict mode
            and breaks UIE-02 AC-6's exactly-one count. The prefix is `shell-`, which is what this
            file already uses for what the shell owns rather than a screen.

            `data-role` carries the RAW value beside the rendered word, so an assertion can read the
            fact without depending on the copy — the shape `year-day-cell` and `month-cell` already
            use.

            NO NEW READ. `useRoster` has returned `role` on every member since TEA-03; the rows have
            held this all along and chose not to draw it (§ 5). It is DISPLAYED and never acted on,
            the same property `roleLabel` above records — displaying a role neither grants nor
            withholds anything. **It is now also what the row is GROUPED by, which is still a
            display decision and still grants nobody anything.** */}
        <span
          data-testid="shell-roster-role"
          data-role={member.role}
          className="text-[9px] uppercase tracking-wider text-ink-3"
        >
          {roleLabel(member.role)}
        </span>
      </div>
    </li>
  );
}

export default function Sidebar({ member, signOut }: SidebarProps) {
  // CAL-12 § 4.4. The roster follows the viewed team; the picker's options are already filtered to
  // an admin, more than one team, and a calendar screen (`pickableTeams`, `useViewedTeam`).
  const { viewed, teams, ownTeamId, hrefFor } = useViewedTeam();
  const roster = useRoster(viewed);
  const selectedTeamId = viewed.kind === "other" ? viewed.team.id : ownTeamId;
  const navigate = useNavigate();
  // TSK-01 AC-5. `/tasks` and `/tasks/<day>`; `/tasksX` is not the page.
  const { pathname } = useLocation();
  const onTasks = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const [signingOut, setSigningOut] = useState(false);
  const appVersion = useAppVersion();

  // SOLO 2026-09-13. The team's NAME for the roster header, in place of the word `Team`. One read
  // through the seam (RULE-02), re-run when the caller's team changes. It fails to `null`, and the
  // header then says `Team` as it did before — the count beside it never waits on this.
  const [teamName, setTeamName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    seam
      .getTeam()
      .then((team) => {
        if (live) setTeamName(team?.name ?? null);
      })
      .catch(() => {
        if (live) setTeamName(null);
      });
    return () => {
      live = false;
    };
  }, [member.teamId]);

  // Moved from `Home.tsx:34-44`, and it gained ONE line. 03-impl-log.md § Deviations carries this
  // in full; the short version is that `Home.tsx` got its redirect for free and this file cannot.
  //
  // That screen WAS the `/` route, and `/` resolves by membership — so ending the session
  // re-rendered `/` and the router sent the caller to the sign-in screen with no navigation
  // written anywhere. TEA-05 AC-6 is that behaviour and a shipped spec asserts it.
  //
  // This control is now on FOURTEEN routes, and SIX OF THEM ARE DELIBERATELY UNGUARDED (AC-3):
  // /week, /month, /year, /allow-list, /members and /holidays render their own refusal for a
  // caller with no session rather than redirecting, which is the whole reason this ticket exists.
  // Signing out on one of them therefore ends the session and leaves the caller reading
  // `week-not-on-a-team` — a true sentence, no way back to the sign-in screen, and TEA-05 AC-6
  // broken by relocation rather than by anybody changing it. Fifty-two acceptance tests measured
  // it. The redirect the route table used to supply implicitly is written here explicitly.
  //
  // ONLY ON `ok`. A sign-out that failed leaves the session alive, and navigating away from a live
  // session to the sign-in screen would show a signed-in person a sign-in form.
  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const result = await signOut();
      if (result.ok) {
        // `replace`, so the browser Back button does not return to a screen this member can no
        // longer read. `/signin` and not `/`: `/` now sends a member to `/week` (AC-5), and the
        // membership has not necessarily re-resolved by the time this line runs.
        navigate("/signin", { replace: true });
        return;
      }
    } finally {
      // Only reached when the sign-out FAILED, or when the navigation above has already left. A
      // control left disabled would be a session nobody can end, which is what TEA-05 AC-6 is for.
      setSigningOut(false);
    }
  }

  // `const isAdmin = member.role === "admin";` stood here until UIE-10. The four admin-only links
  // were its only reader, so removing them leaves it unused — and an unused binding is a lint error
  // rather than a harmless leftover. The role condition now lives once, in `TopBar.tsx`, on
  // `shell-admin-link`. `member.role` is still read in this file, by the account footer and now by
  // every roster row, but only ever to DISPLAY a word.

  return (
    // § 4.9. A fixed 216px pane on `--color-card`, full height, NO BORDER — separated from the
    // content pane by colour alone. `shrink-0` so the grid pane, not the sidebar, absorbs a narrow
    // viewport; `overflow-y-auto` so a long roster scrolls inside the pane rather than pushing the
    // legend and the footer off the bottom.
    <aside
      data-testid="shell-sidebar"
      className="flex w-[216px] shrink-0 flex-col gap-5 overflow-y-auto bg-card px-4 pt-5 pb-1"
    >
      <div data-testid="shell-brand">
        <BrandLogo testId="shell-brand-logo" />
        <p className="mt-1.5 text-[11px] text-ink-3">{TAGLINE}</p>
      </div>

      {/* TSK-01 AC-5, 01-plan.md § 4.6. One link, for every role, directly under the brand. A LINK and
          not a button: UIE-10 AC-10 holds this pane to exactly one button. `aria-current` on
          `/tasks` and on `/tasks/<day>`, and nowhere else. */}
      <nav aria-label="My tasks" className="flex flex-col gap-0.5">
        <Link
          data-testid="nav-tasks-link"
          to="/tasks"
          aria-current={onTasks ? "page" : undefined}
          className={`${TASKS_LINK} ${onTasks ? "bg-field text-ink" : ""}`}
        >
          My tasks
        </Link>
      </nav>

      {/* CAL-12 AC-2. The team picker, between the brand and the roster it governs. LINKS, and not
          a `<select>` or a button: UIE-10 AC-10 (`tests/e2e/uie-10-sidebar.spec.ts:442`-`:445`)
          holds this pane to no form, no input, no select and exactly one button, and choosing a
          team is a change of address (`?team=`), which is what a link is — the same move this file
          made for the roster toggle (`<details>`). Absent, not disabled, for everybody `teams`
          excludes: a member, a manager, a one-team system and every non-calendar screen. */}
      {teams.length > 0 ? (
        <nav data-testid="shell-team-picker" aria-labelledby="shell-team-picker-label" className="flex flex-col gap-1">
          <p
            id="shell-team-picker-label"
            data-testid="shell-team-picker-label"
            className="text-[10px] font-bold uppercase tracking-wider text-ink-3"
          >
            Team
          </p>
          <ul className="flex flex-col gap-0.5 rounded-card bg-track p-0.5">
            {teams.map((t) => {
              const selected = t.id === selectedTeamId;
              return (
                <li key={t.id}>
                  <Link
                    data-testid="shell-team-option"
                    data-team-id={t.id}
                    data-own={t.id === ownTeamId}
                    aria-current={selected ? "true" : undefined}
                    to={hrefFor(t.id)}
                    className={[
                      "block truncate rounded-pill px-3 py-1 text-xs transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      selected ? "bg-card font-bold text-ink shadow-soft" : "font-semibold text-ink-3 hover:text-ink-2",
                    ].join(" ")}
                  >
                    {t.id === ownTeamId ? `${t.name} (your team)` : t.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {/* AC-9 and AC-10. Three phases and three different sentences. `shell-roster-count` is
          rendered ONLY in the ready phase, so a failed read never reads as a team of nobody. */}
      <div>
        {roster.phase === "loading" ? (
          <p
            data-testid="shell-roster-loading"
            role="status"
            className="text-[10px] uppercase tracking-wider text-ink-3"
          >
            <Loader label="Loading the team…" size="sm" />
          </p>
        ) : roster.phase === "unavailable" ? (
          <p
            data-testid="shell-roster-unavailable"
            role="status"
            className="text-[11px] text-ink-3"
          >
            The team list could not be read.
          </p>
        ) : (
          <>
            <p
              data-testid="shell-roster-count"
              data-count={roster.members.length}
              data-team-id={viewed.kind === "other" ? viewed.team.id : (member.teamId ?? undefined)}
              className="text-[10px] font-bold uppercase tracking-wider text-ink-3"
            >
              {(viewed.kind === "other" ? viewed.team.name : teamName) ?? "Team"} ({roster.members.length})
            </p>
            {/* SOLO. One `<details>` per group, both OPEN on first paint — the transcription shows
                every chevron up, and a roster that greets a new session closed hides the one thing
                this pane exists to show.

                **A GROUP WITH NO MEMBERS IS NOT RENDERED AT ALL** rather than rendered as an empty
                drawer. A team whose only admin is the caller would otherwise carry a `Members 0`
                header that opens onto nothing, which states a fact nobody asked for in the space
                the roster needs.

                **THE OPEN/CLOSED STATE IS DOM STATE AND IS NOT PERSISTED**, which is a limit rather
                than an oversight. `<details>` remembers it for as long as the node lives, and this
                pane is the layout route's element (`AppShell.tsx`) so it survives every navigation
                inside the shell — a closed drawer stays closed while the caller moves between
                `/week`, `/year` and `/holidays`. A RELOAD reopens both. Nothing in the request asked
                for more, and anything more means a store this component does not have. */}
            <div className="mt-2 flex flex-col gap-2">
              {ROLE_GROUPS.map((group) => {
                const rows = roster.members.filter((m) => m.role === group.role);
                if (rows.length === 0) return null;
                return (
                  <details
                    key={group.role}
                    open
                    data-testid="shell-roster-group"
                    data-role={group.role}
                    data-count={rows.length}
                    className="group"
                  >
                    {/* `list-none` and the `::-webkit-details-marker` reset remove the native
                        triangle, which is drawn at the START of the line and would sit where the
                        transcription puts nothing; the chevron this file draws is at the END. Both
                        are needed — the pseudo-element is Safari's and `list-none` is everyone
                        else's.

                        NO `role`, NO `aria-expanded` AND NO `tabIndex`. A `<summary>` is already a
                        focusable disclosure control with its state announced; every one of those
                        attributes written by hand would be a second copy of a fact the element
                        maintains, and the copy is the one that goes wrong. */}
                    <summary
                      data-testid="shell-roster-group-summary"
                      className="flex cursor-pointer list-none items-center gap-1.5 rounded-pill py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-3 transition-colors hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&::-webkit-details-marker]:hidden"
                    >
                      <span data-testid="shell-roster-group-label">
                        {group.label}
                      </span>
                      {/* The count pill. It counts the GROUP and `shell-roster-count` counts the
                          team; the two are different numbers and are deliberately different nodes,
                          so no assertion on INV-04's denominator can pick one up for the other. */}
                      <span
                        data-testid="shell-roster-group-count"
                        className="rounded-pill bg-field px-1.5 py-0.5 text-[9px] font-bold leading-none text-ink-3"
                      >
                        {rows.length}
                      </span>
                      <Chevron />
                    </summary>
                    {/* The guide rail the transcription draws down the left of a group's rows. It
                        is a `border-l` on the list rather than a node of its own, so it is exactly
                        as tall as the rows it belongs to and disappears with them when the group
                        closes. */}
                    <ul className="mt-1.5 ml-3.25 flex flex-col gap-1.5 border-l border-line pb-0.5 pl-3">
                      {rows.map((m) => (
                        <RosterRow
                          key={m.id}
                          member={m}
                          isMe={m.id === member.id}
                        />
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* **THREE NAV ITEMS, AND UIE-10 AC-1 IS WHY THERE ARE NO LONGER SEVEN.** The four admin-only
          links — `home-pending-entries-link`, `home-team-entries-link`, `home-allow-list-link` and
          `home-threshold-link` — are REMOVED, for both roles, and the `isAdmin` condition that wrapped
          them is removed with them. The same four addresses are reached through `shell-admin-link` in
          the top bar and then the hub's own `admin-hub-*-link` rows, which UIE-09 shipped. The
          sidebar's length is no longer a function of the caller's role.

          **THE FOUR IDS ARE NOT RELOCATED, WHICH IS THE ONE THING UIE-02 DID AND THIS DOES NOT.**
          UIE-09 shipped `admin-hub-*-link` on those exact rows and asserts each resolves to one node;
          a row cannot carry two `data-testid` values, so adopting a `home-*` name on the hub would
          mean renaming away from a name a shipped spec already asserts (UIE-10 01-plan.md § 1). Every
          navigation site needed the inserted hub step either way, so relocation would have saved the
          id text on nine lines and nothing else.

          **TWO OF THE THREE GENERAL LINKS STAY UNCONDITIONALLY (AC-2), and that is a decision
          rather than an omission.** The top bar renders no switcher at all on the eight non-period
          routes — `periodNavFor` returns null (`src/lib/period.ts`) and `TopBar.tsx` gates the whole
          cluster on it — so on three of those the week and year links here are the only route back
          to a calendar.

          **THE THIRD IS NOW RENDERED FOR A MEMBER AND NOT FOR AN ADMIN — SOLO, 2026-09-12.** The
          paragraph that stood here said `/holidays` was linked from exactly one place in the product
          while being guarded on a session rather than a role, so that no admin control could adopt
          it "without breaking ADM-02 AC-15 and taking the national calendar away from every member".
          The operator instructed the move into the admin panel; the condition below is what lets the
          tab exist without the consequence that warning named. AN ADMIN'S ROUTE IS THE TAB, A
          MEMBER'S IS THIS LINK, AND NEITHER ROLE IS OFFERED TWO — which is also what keeps UIE-02
          AC-6 true, since a second node carrying this id would fail every strict-mode click on it.

          ADM-02 AC-15 — *the link is offered to both roles* — is REWORDED rather than broken: what
          it protects is that a member is not cut off from the national calendar, and that still
          holds. The route is still guarded on a session and not on a role, so an admin who types
          `/holidays` and a member who types it are answered identically.

          Each of the three is linked with NO anchor, so the screen resolves the current period from
          the caller's clock — a date computed here would be a second clock in a second file, and this
          component holds none. */}
      {/* <nav className="flex flex-col gap-0.5">
        <Link data-testid="home-week-link" to="/week" className={NAV_LINK}>
          This week
        </Link>
        <Link data-testid="home-year-link" to="/year" className={NAV_LINK}>
          The year
        </Link>
        {member.role === "admin" ? null : (
          <Link data-testid="home-holidays-link" to="/holidays" className={NAV_LINK}>
            Public holidays
          </Link>
        )}
      </nav> */}

      {/* § 4.9. The spacer that pins the legend and the account footer to the bottom. */}
      <div className="flex-1" />

      <div className="rounded-card bg-field px-3 py-2.5">
        <ul className="flex flex-col gap-1.5">
          {LEGEND.map((row) => (
            <li
              key={row.label}
              data-testid="shell-legend-row"
              className="flex items-center gap-2"
            >
              <span
                aria-hidden
                className={`h-2.5 w-2.5 shrink-0 rounded-pill ${row.swatch}`}
              />
              <span className="text-[11px] text-ink-2">{row.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The account footer. Four relocated ids, unrenamed. The palette icon the transcription
          shows beside the sign-out control is deliberately absent (AC-20): what a control DOES is
          behaviour, and the § Visual specification grant does not reach behaviour. */}
      <div className="flex items-center gap-2">
        {/* **SOLO, 2026-09-10 — the chip is now a LINK to `/profile`, and that is the only way in.**
            The three ids inside it — `home-member-avatar`, `home-member-name`, `home-member-role` —
            KEEP their names, their text and their nesting order, because `tea-05-sign-in.spec.ts`
            reads all three by text at :65, :66, :67 and :146 and a rename here breaks a suite this
            change has no business touching. What moved is the element AROUND them.

            NOT A FOURTH NAV LINK ABOVE (`home-profile-link` is not in the `<nav>`): the pane's nav
            block is where the team's screens live, and a caller looking for their own account looks
            at their own name. The account footer already draws the name, the avatar and the role —
            the three facts the destination is about — so the affordance is the row that shows them.

            NO NEW READ AND NO NEW STATE. Every value here was already on screen; the anchor is
            wrapped around what was drawn. */}
        <Link
          data-testid="home-profile-link"
          to="/profile"
          title="Your profile"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-pill py-0.5 transition-colors hover:bg-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <AvatarChip avatar={member.avatar} testId="home-member-avatar" />
          <div className="flex min-w-0 flex-col">
            <p
              data-testid="home-member-name"
              className="truncate text-xs font-semibold text-ink"
            >
              {member.displayName}
            </p>
            <p
              data-testid="home-member-role"
              className="text-[9px] uppercase tracking-wider text-ink-3"
            >
              {roleLabel(member.role)}
            </p>
          </div>
        </Link>
        <button
          data-testid="home-sign-out"
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          title="Sign out"
          className="ml-auto shrink-0 rounded-pill px-2 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-ink-3">
        <span data-testid="shell-copyright" className="truncate">
          © {new Date().getFullYear()} mmlabs.online
        </span>
        <span data-testid="shell-version" className="shrink-0 tabular-nums">
          {appVersion}
        </span>
      </div>
    </aside>
  );
}
