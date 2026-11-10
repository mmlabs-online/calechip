---
ticket: CAL-12
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-01T08:03:56Z
inputs_read:
  - .ai/board/tickets/CAL-12/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - .ai/registry/decisions/ADR-042-inv-04-accepts-the-removed-member-shape-until-both-sides-are-fixed.md
  - .ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md
  - .ai/board/tickets/CAL-11/01-plan.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/testing-standards.md
  - .ai/standards/tech-stack.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - src/App.tsx
  - src/components/AppShell.tsx
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/hooks/useRoster.ts
  - src/hooks/usePageOverload.ts
  - src/lib/data/index.ts
  - src/lib/period.ts
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/YearOverview.tsx
  - src/lib/fixtures.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-12 — plan

## 1. Problem and scope

**Feature implemented**, transcribed from `.ai/registry/features.md` without paraphrase:

| ID | Title | Group |
|---|---|---|
| CAL-12 | An admin chooses which team the three calendar screens and the sidebar roster show, read-only | CAL |

Notes column of that row, verbatim: *"Depends on CAL-11. Scope is ADR-040 decisions 1, 2 and 4, from
the operator's answers Q1–Q4 quoted verbatim in the idea: `/week`, `/month`, `/year` and the sidebar
roster take the selected team's entries, roster and **threshold**; the admin-panel screens stay on the
admin's own team; the roster row stays avatar, display name, role. **Read-only**: no write against
another team is added anywhere, and write affordances are hidden while another team is in view — an
affordance, not a control (ADR-005). The absence count is INV-04's one function handed the viewed
team's roster, never a second counting path. The six defaults the idea records under *Assumptions
this file made rather than asked* are not operator decisions and PLAN may overrule them; where the
picker's state lives (URL or component) is open question 1 and PLAN's. No image was attached, so the
layout is `tech-lead-design`'s to originate under `CLAUDE.md` § *No invention*."*

Provenance: `.ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md`
(Q1–Q5, verbatim), decided by ADR-040 on ADR-039, both `ACCEPTED by the operator`.

**An admin gains the ability to look at any team's calendar the way that team's own members see it.**
Since ADR-039 an admin administers every team — creates it, admits people onto it, moves people
between teams — and until now could see the consequence of none of those acts, because every
calendar screen draws exactly one team: the admin's own. CAL-11 shipped the reads that make another
team's entries and roster available to an admin and to nobody else; this ticket is the only consumer
of them. The question the charter says this product exists to answer in ten seconds — *what does next
month look like?* — becomes answerable for every team, by the one role responsible for all of them,
without that role being able to change anything on a team that is not theirs.

**The six defaults in the idea's § *Assumptions* are adopted unchanged**, and each one is now an AC
below rather than an assumption: default to own team (AC-1), the viewed team's own threshold (AC-6),
write affordances hidden (AC-9), removed members filtered from the displayed roster (AC-5), picker
only for an admin and only with more than one team (AC-2, AC-3), holidays unchanged (AC-8). **Open
question 1 of the idea — where the selection lives — is decided here: a URL query parameter**, so a
link to another team's month is shareable and survives a reload. The rejected alternative is § 8.

**Out of scope** — the idea's seven items, carried, plus what this plan adds:

1. **Any write against a team that is not the admin's own** (Q3, ADR-040 decision 2). No approve,
   reject, edit, delete or create on another team's entries; no threshold, role or removal on its
   people. No seam write method changes, and none gains a team argument.
2. **The admin-panel screens** (Q4). `/entries/pending`, `/entries/team`, `/members`, `/setting` stay
   on the admin's own team and do not read the selection.
3. **Any new field on a roster row** (Q2). Avatar, display name, role — nothing else.
4. **A narrower entry shape** (Q5). The note is shown on another team's entry exactly as on one's own.
5. **Anything for a `manager` or a `member`.** They get no picker and the selection is ignored for
   them (AC-3).
6. **Creating an entry on somebody else's behalf** — still denied, untouched.
7. **A change to `/teams`.**
8. **The INV-04 removed-member deviation** recorded by ADR-042. This ticket renders what CAL-11's
   reads return and inherits the parity shape exactly; the fix is ADR-042 decision 3's own ticket,
   which has no feature row yet.
9. **Transcribing ADR-039 / ADR-040 into `.ai/standards/rbac-and-security.md`,
   `architecture.md` and `data-model.md`.** Human plane, owed to `/thuki`, as the re-triage verdict
   records.
10. **Any migration, any new seam method, any change to CAL-11's three reads.** `schema_delta: none`.
    If the design finds it needs a read CAL-11 did not deliver, that is BLOCKED, not a migration here.
11. **Remembering the last-viewed team across sessions** (storage, profile field). The URL carries it;
    a fresh visit with no parameter is the admin's own team.
12. **A picker on any other screen** — the event screens, `/teams`, the profile.
13. **Another team's busy days.** `/week` and `/month` draw the own team's busy strip from
    `listTeamBusyDaysOverlapping`, which has no cross-team twin; ADR-040 decision 5 scopes the
    cross-team read to entries and member rows, and a busy day is not an entry (it is not in the
    absence count). While another team is viewed the strip is not drawn (AC-9). Adding the read is a
    migration and a new ADR-040 scope question, not this ticket.
14. **A component-test environment.** None exists (no jsdom, no testing library); the screens are
    exercised end to end, as every calendar ticket before this one was.

**`size_estimate: M`** — interface only, on reads that already exist: one selection hook, a picker,
the roster and three calendar screens rewired to it, and write affordances hidden.

## 2. Acceptance criteria

Terms used below. **Own team**: the team of the signed-in member. **Viewed team**: the team the three
calendar screens and the sidebar roster currently draw. **Another team**: a viewed team that is not
the own team. **The calendar screens**: `/week`, `/month`, `/year`.

**AC-1 — default context is the own team**
- Given an admin whose own team is A, on a system with teams A and B
- When they open any calendar screen with no team in the address
- Then the viewed team is A: the grid, the counts, the overload colouring and the sidebar roster are
  exactly what they were before this ticket, and the picker shows A as selected.

**AC-2 — the picker exists for an admin when there is more than one team**
- Given an admin, on a system with two or more teams
- When a calendar screen (or `/`, which is the week screen) is shown
- Then the sidebar shows a team picker above the roster, listing every team by name, alphabetically,
  with the own team marked as theirs.
- And on any other screen inside the shell the picker is not rendered, and the roster is the own
  team's.
- And given a system with exactly one team, the picker is not rendered at all.

**AC-3 — nobody else gets a picker, and the address cannot give them one**
- Given a `member` or a `manager` of team A, on a system with teams A and B
- When they open `/month?team=<B's id>` (or the same on `/week`, `/year`)
- Then no picker is rendered, and the screen shows team A exactly as it does with no parameter — the
  parameter is ignored, not an error.

**AC-4 — choosing a team changes the calendar to that team**
- Given an admin of team A, on `/week`, `/month` or `/year`
- When they choose team B in the picker
- Then the address gains `team=<B's id>`, the page does not reload, the visible period is unchanged,
  and the grid draws B's `pending` and `approved` entries — tentative ones included, with their
  dashed style; approved ones with their star — and no entry of team A.
- And on `/week`, an entry of B shows its note — in its row and in its tooltip — exactly as it does
  to a member of B (Q5).

**AC-5 — the sidebar roster follows the viewed team**
- Given an admin viewing team B
- Then the sidebar roster lists B's members who are not removed, grouped under the same role headings
  and in the same order rule as the own-team roster, each row showing avatar, display name and role
  and nothing else (Q2) — and lists no member of A.

**AC-6 — counts and overload are the viewed team's, by the one definition**
- Given an admin viewing team B on `/month` or `/year`, and a member of B looking at the same period
  with no parameter
- Then every date shows the same absence count to both, and the same dates are coloured overloaded
  for both — the count from INV-04's single function given B's roster, the threshold B's own
  `overload_threshold` multiplied by B's current member count, never A's.

**AC-7 — the selection survives moving between the calendar screens and a reload**
- Given an admin viewing team B on one calendar screen
- When they move to another calendar screen or period by the app's own navigation — the top bar's
  previous, next, Today and Week/Month/Year controls, a year overview's month link, or an address
  without a period that the screen completes (`/month` → `/month/<current>`) — or reload the page
- Then team B is still the viewed team.
- And when they move to a screen outside the calendar screens and back by the app's navigation, the
  viewed team is the own team again (the selection lives in the address of the calendar screens
  only).

**AC-8 — public holidays are unchanged**
- Given any viewed team
- Then the holidays drawn are the same national calendar as on the own team's view.

**AC-9 — read-only: write affordances are absent while another team is viewed**
- Given an admin viewing another team
- Then no control that creates an entry is rendered — the top bar's new-entry link is absent, and
  pressing or dragging across `/month` day cells opens no entry form — and no entry of that team
  carries a control that edits, deletes, approves or rejects it.
- And the busy-day strip and its toggle are absent on `/week` and `/month` (another team's busy days
  have no read; Out-of-scope 13).
- And a read-only notice naming the viewed team is shown above the grid.
- And choosing the own team again restores every one of those controls, and the notice disappears.

**AC-10 — the admin-panel screens ignore the selection**
- Given an admin who has been viewing team B
- When they open `/entries/pending`, `/entries/team`, `/members` or `/setting`
- Then each shows the own team's data exactly as before this ticket.

**AC-11 — an address that names no visible team falls back to the own team**
- Given an admin
- When they open a calendar screen with `team=` set to an id that is not a team (malformed, deleted,
  or never existed)
- Then the screen shows the own team, the picker shows the own team selected, and the parameter is
  removed from the address. No error is shown.
- And `team=<own team's id>` is treated as no parameter: full write affordances, no notice.

**AC-12 — a failed read of another team shows an error, never the own team's data**
- Given an admin viewing team B
- When the read of B's entries or roster fails
- Then the grid shows the screen's existing error state and draws no entry and no roster row of any
  team — the own team's data is never substituted for B's.

**AC-13 — the denial holds below the interface**
- Given a `member` or `manager` whose client is made to call the cross-team reads for team B directly
- Then they receive empty sets (CAL-11 AC-6/AC-7, unchanged), so nothing of B is drawn even if the
  affordance in AC-3 were bypassed.

**Invariants touched**

- **INV-04** — every count on another team's view must come from the one existing function, handed
  B's full roster (removed members included) and B's entries. A second computation, or handing it
  the filtered display roster, would violate it. ADR-042's accepted deviation is inherited unchanged.
- **INV-05** — tentative entries of another team are drawn and counted exactly as on the own team.
- **INV-07** — the viewed team's count takes only entries whose member belongs to B now; this is what
  CAL-11's reads return, and the screen must not merge A's entries into B's view (AC-4, AC-12).

**Open questions**

None that block. ADR-042 decision 3's ticket is owed and out of scope (item 8).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*Amended 2026-10-01 (99-questions.md).* The picker sits in the sidebar between the brand and the
roster, as a short vertical list of team **links** under a small uppercase `Team` heading — the
selected team drawn as the selected pill, like the top bar's Week/Month/Year segment. Not a
`<select>`: UIE-10 AC-10 holds the pane to no form control (§ 4.4).

## 3. Permission model

**No row of the permission table changes.** This ticket adds no capability; it renders, for an
admin, what CAL-11's reads already return to an admin and to nobody else.

| Action | member | manager | admin |
|---|---|---|---|
| See the team picker | ❌ not rendered | ❌ not rendered | ✅ on a calendar screen, more than one team |
| View another team on `/week` `/month` `/year` and in the sidebar roster | ❌ parameter ignored, own team drawn | ❌ parameter ignored, own team drawn | ✅ read-only |
| Create an entry, toggle a busy day, while another team is viewed | — | — | ❌ affordance absent (AC-9) |
| Any write on another team's entries, threshold or people | ❌ | ❌ | ❌ — no path exists, none added |
| Admin-panel screens (`/entries/pending`, `/entries/team`, `/members`, `/setting`) | unchanged | unchanged | unchanged, own team (AC-10) |

**Where the check lives: in the datastore, and it is CAL-11's.** `list_teams`,
`list_members_for_team` and `list_team_entries_overlapping_for_team` are `security definer`
functions whose first predicate is `public.is_admin((select auth.uid()))`; a non-admin receives an
empty set (CAL-11 AC-6–AC-8). That is the control for AC-13.

**Everything this ticket adds is an affordance** (ADR-005):

- The picker's role test (`role === "admin"`, via `mayAdminister`) and `resolveViewedTeam`'s refusal
  of a parameter for a non-admin are display decisions. Bypassing them reaches the definer functions,
  which return nothing.
- Hiding the new-entry link, the `/month` drag-to-create and the busy toggles while another team is
  viewed is an affordance. The writes behind them (`createEntry`, `setOwnBusyDay`) act on the
  **caller's own** member row and own team under the existing policies whatever screen invokes them —
  they cannot reach team B. They are hidden because an entry created while looking at B would land on
  A and vanish from the screen that created it (INV-07), not because they would be a breach.

**Exposure, unchanged from ADR-040 § Consequences:** another team's notes become visible on an
admin's `/week`. Decided by the operator (Q5).

## 4. Contract

Every name below is fixed. No other exported name is added.

### 4.1 `src/lib/viewed-team.ts` (new) — pure logic and the one read switch

Imports only types from `@/lib/domain/types` and the `DataSeam` type from `@/lib/data`; it takes the
seam as an argument so tests can hand it the mock.

```ts
import type { DataSeam } from "@/lib/data";
import type { BusyDay, DateRange, Entry, Member, MemberRole, Team } from "@/lib/domain/types";

/** The one query-parameter name. */
export const TEAM_PARAM = "team";

/** Which team the calendar screens and the sidebar roster draw. */
export type ViewedTeam =
  | { kind: "own" }                       // the caller's team, through the existing own-team reads
  | { kind: "resolving" }                 // an admin's parameter is present, list_teams in flight
  | { kind: "unavailable" }               // an admin's parameter is present, list_teams failed
  | { kind: "other"; team: Team };        // another team, read-only, its row from listTeams()

export interface ViewedTeamResolution {
  viewed: ViewedTeam;
  /** True only when an ADMIN's parameter names no listed team, or names the own team (AC-11). */
  dropParam: boolean;
}

/**
 * Rules, in order:
 *  1. role !== "admin"                       -> own, dropParam false   (AC-3: ignored, not stripped)
 *  2. requested null or ""                   -> own, dropParam false   (AC-1)
 *  3. requested === ownTeamId                -> own, dropParam true    (AC-11)
 *  4. teams === null                         -> resolving, false
 *  5. teams === "failed"                     -> unavailable, false     (AC-12)
 *  6. teams has a row with id === requested  -> other(that row), false (AC-4)
 *  7. otherwise                              -> own, dropParam true    (AC-11)
 */
export function resolveViewedTeam(input: {
  role: MemberRole;
  ownTeamId: string | null;
  requested: string | null;
  teams: readonly Team[] | null | "failed";
}): ViewedTeamResolution;

/** True for "/", "/week", "/week/<x>", "/month", "/month/<x>", "/year", "/year/<x>",
 *  "/year/<x>/members" — and for nothing else (AC-2, AC-7, AC-10). Trailing slash tolerated. */
export function isCalendarPath(pathname: string): boolean;

/** The picker's options: [] unless role === "admin" AND teams.length > 1 (AC-2, AC-3); otherwise
 *  every team sorted by name with localeCompare, then id. */
export function pickableTeams(role: MemberRole, teams: readonly Team[]): Team[];

/** True whenever the write affordances must be absent: viewed.kind !== "own" (AC-9). */
export function isReadOnly(viewed: ViewedTeam): boolean;

/** `to` with the `team` value of `search` carried across (AC-7). Returns `to` unchanged when `search`
 *  has no `team`; appends with "?" or "&" as `to` requires; value through encodeURIComponent. */
export function withTeamParam(to: string, search: string): string;

/** The four reads every calendar screen and the roster make, for the viewed team. */
export interface TeamReads {
  team(): Promise<Team | null>;
  roster(): Promise<Member[]>;                                // removed members INCLUDED (INV-04)
  entriesOverlapping(range: DateRange): Promise<Entry[]>;
  busyDaysOverlapping(range: DateRange): Promise<BusyDay[]>;
}

/**
 * own   -> seam.getTeam(), seam.listMembers(), seam.listTeamEntriesOverlapping(range),
 *          seam.listTeamBusyDaysOverlapping(range)  — byte-for-byte today's calls.
 * other -> Promise.resolve(viewed.team), seam.listMembersForTeam(viewed.team.id),
 *          seam.listTeamEntriesOverlappingForTeam(viewed.team.id, range), Promise.resolve([]).
 * An `other` TeamReads NEVER calls an own-team read, so a failure cannot fall back to team A (AC-12).
 */
export function teamReadsFor(
  seam: DataSeam,
  viewed: { kind: "own" } | { kind: "other"; team: Team },
): TeamReads;
```

### 4.2 `src/hooks/useViewedTeam.tsx` (new) — the provider, resolved once per shell

```tsx
export interface ViewedTeamValue {
  /** Always { kind: "own" } when !isCalendarPath(pathname). */
  viewed: ViewedTeam;
  /** pickableTeams(member.role, loaded teams); [] while loading, after a failure, off-calendar. */
  teams: readonly Team[];
  ownTeamId: string | null;
  /** The address that views `teamId`: current pathname + current search with TEAM_PARAM deleted
   *  when teamId === ownTeamId, else set to teamId; other search params kept; "?" only when the
   *  search is non-empty. Off the calendar screens: pathname unchanged. Followed by a <Link>, so a
   *  PUSH navigation (Back works), path unchanged (AC-4).
   *  (Amended 2026-10-01: replaces `select(teamId): void` — 99-questions.md.) */
  hrefFor(teamId: string): string;
}

export function ViewedTeamProvider(props: { member: Member; children: ReactNode }): JSX.Element;
export function useViewedTeam(): ViewedTeamValue;
```

Behaviour the Developer must hold:

- Reads `useSearchParams()` / `useLocation()` from `react-router-dom` — **verified on disk**:
  `useSearchParams(defaultInit?): [URLSearchParams, SetURLSearchParams]`, setter
  `(nextInit | (prev) => nextInit, navigateOpts?: NavigateOptions)` —
  `node_modules/.pnpm/react-router@7.18.3_*/…/index-react-server-client-BjY-eKuf.d.ts:3021`, `:3050`.
- `seam.listTeams()` is called **only when `member.role === "admin"`**, on mount and again whenever
  the requested parameter changes to an id not in the loaded list. A throw stores `"failed"`.
- When the resolution's `dropParam` is true, delete `TEAM_PARAM` with `{ replace: true }` (AC-11).
- **Default context value** (no provider — a screen rendered under `BareLayout` for a signed-out
  visitor): `{ viewed: { kind: "own" }, teams: [], ownTeamId: null, hrefFor: () => "" }` —
  unreachable, since `teams` is `[]` and no picker renders.
- The context value is memoised on `viewed`'s identity key (`kind` + team id) so consumers can key
  effects on it — the warning in `AppShell.tsx:99-103` about context objects in dependency lists.

### 4.3 `src/components/AppShell.tsx`

- Wraps its whole return in `<ViewedTeamProvider member={member}>`, so `Sidebar`, `TopBar` and the
  outlet share one resolution. `AppShellProps` and `ShellContext` are unchanged.
- Directly above `<Outlet>`, when `viewed.kind === "other"`:

```tsx
<div data-testid="shell-viewing-other-team" data-team-id={viewed.team.id} role="status">
  Viewing {viewed.team.name} — read only.
  <Link data-testid="shell-back-to-own-team" to={pathname}>Back to my team</Link>
</div>
```

  `to={pathname}` (no search) is the own team. Existing tokens only (`bg-card`, `text-ink-2`,
  `border-line`, rounded); no new colour. English copy (`ui-design-system.md` § Language).

### 4.4 `src/components/Sidebar.tsx`

- **Picker**, between `shell-brand` and the roster block, rendered iff `teams.length > 0` (which
  already encodes admin, >1 team, calendar path):

```tsx
<nav data-testid="shell-team-picker" aria-labelledby="shell-team-picker-label">
  <p id="shell-team-picker-label" data-testid="shell-team-picker-label">Team</p>
  <ul>
    {teams.map((t) => (
      <li key={t.id}>
        <Link data-testid="shell-team-option" data-team-id={t.id} data-own={t.id === ownTeamId}
              aria-current={t.id === selectedId ? "true" : undefined} to={hrefFor(t.id)}>
          {t.id === ownTeamId ? `${t.name} (your team)` : t.name}
        </Link>
      </li>
    ))}
  </ul>
</nav>
```

  `selectedId` = `viewed.team.id` when `other`, else `ownTeamId`. **Links, not a `<select>` and not
  a button** — UIE-10 AC-10 (`tests/e2e/uie-10-sidebar.spec.ts:442`–`:445`) holds this pane to zero
  `form`, zero `input`, zero `select` and exactly one `button` (`home-sign-out`), for an admin on
  `/week`. Choosing a team is a change of address (§ 1), so a link is also the honest element, and
  the same move `Sidebar.tsx` made for the roster toggle (`<details>`, not `<button>`).
  *Amended 2026-10-01 from a `<label>`/`<select>` — 99-questions.md.* Styling: existing tokens only;
  the `aria-current` link drawn as the selected pill.
- **Roster**: `useRoster(viewed)` replaces `useRoster()`. The team name in `shell-roster-count` is
  `viewed.team.name` when `other`, else today's `getTeam()` name. `shell-roster-count` gains
  `data-team-id` (the viewed team's id, or the own `member.teamId`). Every other id unchanged.

### 4.5 `src/hooks/useRoster.ts`

`useRoster(viewed: ViewedTeam): RosterState` (its only caller is `Sidebar.tsx`). `resolving` →
`loading`; `unavailable` → `unavailable`; `own`/`other` → `teamReadsFor(seam, viewed).roster()`,
then the existing `removedAt === null` filter (AC-5). Effect keyed on the viewed key; phase reset to
`loading` on change.

### 4.6 `src/components/TopBar.tsx`

- `const { viewed } = useViewedTeam(); const { search } = useLocation();`
- Every period `Link` — `${kind}-prev`, `${kind}-next`, `shell-period-today`, the three segments —
  takes `to={withTeamParam(<today's target>, search)}`. `TopBarProps` unchanged.
- `home-new-entry-link` is rendered iff `!isReadOnly(viewed)` (AC-9). `shell-admin-link` and
  `nav-events-link` unchanged and do not carry the parameter (AC-7 second half, AC-10).

### 4.7 The four screens — `WeekView.tsx`, `MonthView.tsx`, `YearView.tsx`, `YearOverview.tsx`

Common to all four:

- `const { viewed } = useViewedTeam(); const { search } = useLocation();`
- `viewed.kind === "resolving"` → the screen's existing loading phase; `"unavailable"` → its existing
  unavailable phase (AC-12).
- Otherwise `const reads = teamReadsFor(seam, viewed)` and, inside the existing `load()`, the calls
  are replaced one for one: `seam.getTeam()` → `reads.team()`, `seam.listMembers()` →
  `reads.roster()`, `seam.listTeamEntriesOverlapping(range)` → `reads.entriesOverlapping(range)`,
  `seam.listTeamBusyDaysOverlapping(range)` → `reads.busyDaysOverlapping(range)`.
  `seam.getCurrentMember()` and `seam.listHolidays(...)` are unchanged (AC-8).
- The load effect's dependencies gain the viewed key; on a change the view is set to its loading
  phase **before** the new reads start, and the existing `live` guard drops a stale answer — so A's
  rows are never drawn under B's notice (AC-12).
- Counting is unchanged: `absenceCountsFor`, `absentEntriesFor`, `absentMembersFor`,
  `currentMemberCount`, `isOverloaded` are called with the same arguments, now fed by `reads`.
- Every `<Navigate>` that completes an address carries the parameter:
  `to={withTeamParam(`/week/${currentDay()}`, search)}` — `WeekView.tsx:500`, `MonthView.tsx:431`,
  `YearView.tsx:270`, `YearOverview.tsx:232`, `YearOverview.tsx:523` (AC-7).

Per screen:

- **WeekView** — when `isReadOnly(viewed)`, the busy strip (`week-day-busy` and its count) is not
  rendered. The row note (`week-row-note`) and `EntryTooltip` are unchanged (AC-4). An approver who
  is not in B's roster resolves to `undefined`, the path `EntryTooltip` already handles.
- **MonthView** — `team` (threshold, `month-threshold`'s `data-threshold`/`data-current-members`)
  comes from `reads.team()` (AC-6). When `isReadOnly(viewed)`: `month-cell` gets no `onMouseDown` /
  `onMouseEnter`, the draft `Modal` cannot open, and `month-cell-busy` is not rendered (AC-9).
- **YearView**, **YearOverview** — reads only. `year-month-card-link` takes
  `to={withTeamParam(`/month/${month}`, search)}` (AC-7).

### 4.8 Tests

**`tests/viewed-team.test.ts` (new, Vitest, node)** — imports `seam, __setCurrentMember` from
`@/lib/data/mock` and the fixtures, as `tests/cross-team-reads.test.ts` does.

- AC-1, AC-3, AC-11, AC-12: `resolveViewedTeam` table — each of rules 1–7 once, plus a `manager`
  and a `member` with a valid other-team id → `own`, `dropParam: false`.
- AC-2: `pickableTeams` — admin with one team → `[]`; member/manager with two → `[]`; admin with
  two → sorted by name.
- AC-7, AC-10: `isCalendarPath` — true for the eight shapes, false for `/entries/pending`,
  `/entries/team`, `/members`, `/setting`, `/events`, `/teams`, `/profile`. `withTeamParam` — no
  param, param, `to` already carrying `?`.
- AC-6 (counts): as `FIXTURE_ADMIN`, take `FIXTURE_OTHER_TEAM`'s row from `seam.listTeams()`; then
  `absenceCountsFor` over 2026-09-01..30 from `teamReadsFor(seam, other)` equals the same computed as
  `FIXTURE_OTHER_TEAM_MEMBER` from `teamReadsFor(seam, { kind: "own" })`; 2026-09-21 is non-zero.
  `reads.team()` resolves to the `listTeams()` row (its `overloadThreshold`), not `getTeam()`'s.
- AC-12: `teamReadsFor(stub, other)` over a stub whose own-team methods throw if called and whose
  `*ForTeam` methods reject — every read rejects and no own-team method is called.
- AC-13: as `FIXTURE_MEMBER`, `teamReadsFor(seam, other)` roster and entries are `[]`.
- AC-9 (pure half): `isReadOnly` true for `other`, `resolving`, `unavailable`; false for `own`.

**`tests/e2e/cal-12-team-picker.spec.ts` (new, Playwright, mock seam)** — ids transcribed, not
imported, as `cal-05-week-view.spec.ts:57-58` records. Team A `11111111-1111-4111-8111-111111111111`,
team B `44444444-4444-4444-8444-444444444444` (*Nhóm khác*), B's member
`66666666-6666-4666-8666-666666666666` (`chi@other.example.com`), B's entry
`dd000000-0000-4000-8000-000000000002` (2026-09-21..22, pending, note *Nghỉ của nhóm khác*). Admin
`quan@example.com`, member `thanh@example.com`, password `password123`. Test names carry the AC id.

- AC-1: admin on `/month/2026-09` — the `shell-team-option` with `aria-current="true"` has
  `data-team-id` A, `shell-roster-count[data-team-id]` is A, no `shell-viewing-other-team`.
- AC-2: two `shell-team-option`, alphabetical, the own one `data-own="true"`; on `/events` and
  `/setting` no `shell-team-picker`. And, admin on `/week` with the picker rendered: inside
  `shell-sidebar`, `select`, `input` and `form` count 0 (UIE-10 AC-10's property, asserted from the
  side that would break it).
- AC-3: member on `/month/2026-09?team=<B>` — no picker, `month-cell[data-date="2026-09-21"]`
  `data-count` equals the no-parameter value, no `shell-viewing-other-team`.
- AC-4: admin clicks B's `shell-team-option` on `/month/2026-09` — URL has `team=<B>`, `month-anchor` still 2026-09, a
  `month-avatar` on 2026-09-21; on `/week/2026-09-21?team=<B>` a `week-row` with B's entry id and
  `week-row-note` text *Nghỉ của nhóm khác*; no `week-row` of a team-A member.
- AC-5: roster rows are exactly B's non-removed members (`data-member-id` B's member), each with
  `shell-roster-role`.
- AC-6: `data-count` of 2026-09-21 and 2026-09-22, and `month-threshold`'s `data-threshold` /
  `data-current-members`, equal between admin-viewing-B and `chi@other.example.com` with no param.
- AC-7: from B on `/month/2026-09`: `month-next`, `month-year`, `year-month-card-link`, `year-week`,
  and `page.reload()` each keep `team=<B>`; `/month?team=<B>` lands on `/month/<current>?team=<B>`;
  `nav-events-link` then back via `shell-admin-link`/`/` shows the own team.
- AC-8: `month-cell-holiday` set identical with and without the parameter.
- AC-9: with B viewed: `home-new-entry-link`, `week-day-busy`, `month-cell-busy` count 0; mouse
  down/up on a `month-cell` → `month-entry-panel` count 0; `shell-viewing-other-team` names B.
  `shell-back-to-own-team` → all three return and the notice is gone.
- AC-10: from B, `/entries/pending`, `/entries/team`, `/members`, `/setting` show what they show
  without the parameter (row counts / `data-*` equal).
- AC-11: `team=not-a-uuid`, `team=00000000-0000-4000-8000-000000000000`, `team=<A>` — own team, no
  notice, `team` absent from `page.url()`.
- AC-12, AC-13: unit only (above) — the mock seam cannot be made to fail from the browser, and the
  denial is below the interface.

**No existing test is edited.** In particular `uie-10-sidebar.spec.ts` AC-10 (`:442`–`:445`: no
form, no input, no select, one button) and the fifteen specs that click `home-new-entry-link` after
sign-in (no parameter → own team) must pass unchanged.

*Amended 2026-10-01 (99-questions.md).* As first written this cited only `:445` and concluded from
it — the one negative assertion that constrained the element rejected, not the one at `:444` that
constrained the element chosen. Negative assertions about a surface this ticket adds to are read in
full, not for the line that agrees.

### How each invariant is held

- **INV-04** — held by the existing `absenceCountsFor` in `src/lib/data/absence.ts`, the only
  counting function, now fed by `teamReadsFor(...).roster()` (full roster, removed included) and
  `.entriesOverlapping()`. No count is computed in `viewed-team.ts`, the hook or any view beyond
  today's calls. The sidebar's removed-member filter is display-only and never reaches a count.
  ADR-042's deviation is inherited from CAL-11's reads, unchanged.
- **INV-05** — held by `absenceCountsFor` (tentative counted) and the screens' existing drawing;
  nothing in this ticket filters on `tentative`.
- **INV-07** — held by CAL-11's `public.member_team_id(e.member_id) = p_team_id` in the datastore,
  and in the interface by `teamReadsFor` returning B's reads **only**, never merged with A's (AC-12
  unit test).

## 5. Seam impact

**None.** No seam method is added, renamed or re-signed; `src/lib/data/**` is not in
`allowed_paths`. Consumed, all existing: `listTeams()`, `listMembersForTeam(teamId)`,
`listTeamEntriesOverlappingForTeam(teamId, range)`, plus the own-team reads already called today.
`listTeamEntriesForTeam(teamId)` (CAL-11) has no consumer here — no calendar screen uses the flat
`listTeamEntries()` either. RULE-02: every read goes through `seam` from `@/lib/data`;
`viewed-team.ts` imports only the `DataSeam` **type**.

## 6. Schema delta

`none`. No migration, no policy, trigger or constraint (ADR-014 does not apply). `requires_adr:
false` — ADR-040 decisions 1, 2, 4 are the envelope.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/viewed-team.ts"
  - "src/hooks/useViewedTeam.tsx"
  - "src/hooks/useRoster.ts"
  - "src/components/AppShell.tsx"
  - "src/components/Sidebar.tsx"
  - "src/components/TopBar.tsx"
  - "src/routes/WeekView.tsx"
  - "src/routes/MonthView.tsx"
  - "src/routes/YearView.tsx"
  - "src/routes/YearOverview.tsx"
  - "tests/viewed-team.test.ts"
  - "tests/e2e/cal-12-team-picker.spec.ts"
```

`.ai/board/tickets/CAL-12/**` is exempt by the hook and not listed. No `glossary_owed` field in
`ticket.yaml`, so no glossary row is owed and `glossary.md` is not listed.

**`size: M`** — twelve files, exactly on the M ceiling. **Agrees with `size_estimate: M`.** The
read-only notice was folded into `AppShell.tsx` rather than given its own component to stay at twelve;
a thirteenth file would make this `L` and force a split that would leave a picker with no screens or
screens with no picker.

## 8. Rejected alternatives

1. **Selection in component state (the idea's open question 1, other branch).** Simpler — no
   parameter to carry, no redirects to amend. Rejected: lost on reload, not shareable, and the top
   bar's period links are address-only (`periodNavFor` reads the pathname), so every period move would
   have needed the state threaded to `TopBar` anyway. The address already holds the period; the team
   is the same kind of fact about what is on screen.
2. **Branching inside each screen** — `viewed.kind === "other" ? seam.listMembersForTeam(...) :
   seam.listMembers()` written at each of the four screens and the roster. Fewer indirections.
   Rejected: five copies of the switch, and one missed branch silently draws team A's rows under
   team B's notice — an INV-07 violation that looks correct. `teamReadsFor` is one switch, unit-tested
   against the mock, and is the place AC-12 is proved.
3. **Persisting the last-viewed team** (`localStorage` or a profile field). Rejected: AC-1 makes the
   own team the default on every load, which the idea argues for; a remembered other team would land
   an admin on a read-only calendar with the new-entry link missing and no obvious reason.
4. **A picker on every screen inside the shell.** Rejected: Q4 keeps the admin-panel screens on the
   own team, so a picker there would offer a choice the screen ignores.

## Changelog

- 2026-10-01T08:03:56Z — sections 1, 2 and 2b written before the source tree was read. Raised by
  `tech-lead-design`.
- 2026-10-01T08:40:00Z — sections 1 and 2 amended after reading the source tree, before 3–8 were
  written. Raised by `tech-lead-design`. Amended by `tech-lead-design`. Every amendment narrows or
  makes observable; none relaxes an outcome:
  - **AC-2**: the picker renders on calendar screens only — the selection is ignored off them (Q4), so
    a picker there would offer a choice the screen discards.
  - **AC-4**: "opening an entry" became the `/week` row and tooltip — `/month` and `/year` draw no
    note for any team (`MonthView.tsx:824`, `YearView.tsx:438`), so there is nothing to open there.
  - **AC-7**: names the navigation that must carry the parameter — the top bar's links are built from
    the pathname and drop any query (`TopBar.tsx:85`), and four screens redirect an incomplete address.
  - **AC-9**: names the actual write affordances — the top bar's new-entry link on every shell route,
    `/month` drag-to-create, and the busy toggles on `/week` and `/month`; no calendar screen has an
    edit, delete, approve or reject control today.
  - **Out-of-scope 13, 14** added: busy days have no cross-team read (`listTeamBusyDaysOverlapping`
    only), and there is no component-test environment.
- 2026-10-01T15:41:51+0700 — § 2b, § 4.2, § 4.4 and § 4.8 amended. Raised by `developer` in
  `99-questions.md` (developer->tech-lead-design, message 1): § 4.4's `<select>` fails UIE-10 AC-10
  at `tests/e2e/uie-10-sidebar.spec.ts:444` (admin, `/week`, `select` count 0), measured. Amended by
  `tech-lead-design`. The picker becomes a list of `<Link>`s in the same sidebar position;
  `ViewedTeamValue.select(teamId): void` is replaced by `hrefFor(teamId): string`; option links gain
  `data-team-id` and `aria-current`; the e2e locators follow, plus a sidebar no-form-control
  assertion under AC-2. **No AC changes, § 7 unchanged (twelve paths, `size: M`), UIE-10 stays
  unedited.** Rejected: adding `uie-10-sidebar.spec.ts` to `allowed_paths` (thirteen files is `L`,
  must split, and AC-10's property is still true and keepable); moving the picker to the top bar
  (rewords AC-2 to protect a test, and separates the picker from the roster it governs).
