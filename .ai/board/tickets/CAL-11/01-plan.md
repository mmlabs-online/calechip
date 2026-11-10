---
ticket: CAL-11
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-22T23:46:12+0700
inputs_read:
  - .ai/board/tickets/CAL-11/ticket.yaml
  - .ai/board/tickets/CAL-12/ticket.yaml
  - .ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-039-every-admin-manages-every-team.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/tech-stack.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260911090000_solo_busy_day.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/db.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/absence.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/hooks/usePageOverload.ts
  - src/hooks/useRoster.ts
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/YearOverview.tsx
  - tests/seam-parity.test.ts
  - tests/manager-role.test.ts
  - tests/draft-entry.test.ts
  - node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.cts
  - .ai/board/tickets/CAL-11/04-review.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-11 — Plan

## 1. Problem and scope

**Feature row, transcribed from `.ai/registry/features.md:107`:**

| ID | Title | Group | Status |
|---|---|---|---|
| CAL-11 | An admin reads any team's entries and roster through the seam | CAL | PLANNED |

> **The read half of a two-row split; it has no screen of its own and CAL-12 is its only consumer.**
> Scope is ADR-040 decisions 3, 5 and 6: `security definer` functions taking a team id and testing
> `public.is_admin` in their own bodies — that team's entries (plain and date-overlapping, note
> included) and its member rows **including removed ones**, because INV-04 needs them — with a
> non-admin getting an empty set, not an error. **No table policy is widened** (ADR-039 § Rationale).
> Both seam implementations must return the same shapes as the own-team reads. **The denials are the
> load-bearing tests**, and the permission-model test is still owed
> (`.ai/standards/rbac-and-security.md` § Known weaknesses 1). `schema_delta` is a migration.
> `Invariants touched` is PLAN's.

**Who gains what.** An **admin** gains the ability to ask the data-access seam for *any* team's
entries and roster, by team id, and receive exactly what a member of that team receives from the
own-team reads — the same rows, the same shapes, the same notes. Every other caller asking the same
question receives nothing. It matters because since ADR-039 an admin administers every team and can
see only one calendar; CAL-12 cannot draw another team's week, month or year without these three
reads, and the only other way to get them — widening the `entry`, `member` or `team` select policy —
would silently change `listMembers()`, `getTeam()` and every absence count in the product (ADR-039
§ Rationale). Nothing a person can see changes when this ticket ships; that cost was accepted at
triage (idea § *Re-triage verdict*).

**The threshold needs no new read.** ADR-040 decision 5: *"The threshold comes from `list_teams()`,
which already returns the whole `team` row."* `listTeams()` already exists and is unchanged.

### Out of scope

1. **Any screen, hook or component.** The picker, the team-scoped `/week`, `/month`, `/year`, the
   sidebar roster and the hidden write affordances are CAL-12's. No file under `src/routes/`,
   `src/components/` or `src/hooks/` is touched.
2. **Any write against another team** — ADR-040 decision 2. No entry, threshold, member or approval
   write gains a team parameter.
3. **A cross-team busy-day read.** `listTeamBusyDaysOverlapping` is team-scoped and is read by
   `/week` and `/month` (`src/routes/WeekView.tsx:337`, `src/routes/MonthView.tsx:253`), but ADR-040
   decision 5 enumerates entries and member rows only, and its § Consequences counts exactly *"a
   fourth, fifth and sixth definer function"*. A seventh is outside the accepted envelope. **CAL-12
   must decide at its own PLAN whether another team's view omits busy marks or needs an ADR** — its
   `ticket.yaml:19-20` already says a missing function is BLOCKED there, not a migration.
4. **A cross-team `getTeam()`.** `listTeams()` carries `overloadThreshold`; decision 5.
5. **Any change to an own-team read** — `listMembers`, `listTeamEntries`,
   `listTeamEntriesOverlapping`, `getTeam` keep their signatures, bodies and callers. XL clause not
   engaged (§ 7).
6. **Any table policy, column grant, trigger or constraint.** ADR-039 § Rationale; ADR-014.
7. **Transcribing the new functions into `supabase/db.sql`.** That file does not carry
   `20260911180000_solo_many_teams.sql` either (verified: no `list_teams` in it); bringing it up to
   date is a separate chore.
8. **The standards ADR-039 and ADR-040 name as affected** (`rbac-and-security.md`,
   `architecture.md`, `data-model.md`). Human plane under RULE-01; `/thuki`'s on an `ops/` branch.
9. **The permission-model test against a running PostgreSQL.** No project is provisioned. This
   ticket ships the mock-level denials and a static assertion over the migration text (AC-9), and
   states plainly that neither substitutes for it.
10. **The pre-existing shape that hides a removed member's entries from the own-team read** — see
    § 2 *Invariants touched*, INV-04. Mirrored here for parity, not fixed here.

**`size_estimate: M`.** One migration creating three functions and their privilege statements,
three seam methods declared once and implemented twice, one new test file. No screen.

## 2. Acceptance criteria

Vocabulary used below, fixed so a reader cannot drift:

- **caller** — the member row whose id is `auth.uid()` (in the mock, the id set by
  `__setCurrentMember`).
- **admin caller** — a caller with `role = 'admin'` and `removed_at` null, i.e. `public.is_admin`
  answers true.
- **team T** — any team id passed to the new reads.
- **own-team view of T** — what the existing `listMembers()` / `listTeamEntries()` /
  `listTeamEntriesOverlapping(range)` return to a non-removed, approved member of T.

**AC-1 — roster of any team, removed members included**
- Given an admin caller and a team T that holds approved members, at least one of them removed
- When the caller calls `listMembersForTeam(T)`
- Then the result is every member row whose `teamId` is T — the removed ones included, each
  carrying its `removedAt` — ordered by `createdAt` ascending then `id` ascending, and contains no
  row whose `teamId` is not T and no pending sign-up.

**AC-2 — the roster equals the own-team view**
- Given an admin caller who is not on team T, and an approved member M of T
- When the admin calls `listMembersForTeam(T)`, and M calls `listMembers()`
- Then the two arrays are deep-equal, field for field and in order.

**AC-3 — entries of any team, flat, note included**
- Given an admin caller who is not on team T, and T has entries
- When the caller calls `listTeamEntriesForTeam(T)`
- Then the result equals, deep and in order, what an approved member of T receives from
  `listTeamEntries()` — every field of `Entry`, `note` included — ordered by `startDate` descending
  then `id` ascending, and contains no entry belonging to a member of another team.

**AC-4 — entries of any team, overlapping a range**
- Given an admin caller who is not on team T, and a range R
- When the caller calls `listTeamEntriesOverlappingForTeam(T, R)`
- Then the result equals, deep and in order, what an approved member of T receives from
  `listTeamEntriesOverlapping(R)`: every entry of T whose `[startDate, endDate]` overlaps R
  (inclusive at both ends, rejected entries included), ordered by `startDate` ascending then `id`
  ascending — and an entry of T that lies wholly outside R is absent.

**AC-5 — the absence count for T is the same number either way** (ADR-040 decision 6 and its revert
condition)
- Given an admin caller who is not on team T, an approved member M of T, and a range R
- When `absenceCountsFor` is given `listTeamEntriesOverlappingForTeam(T, R)` and
  `listMembersForTeam(T)` as the admin, and separately given M's `listTeamEntriesOverlapping(R)` and
  `listMembers()`
- Then the two count maps are equal for every date in R, and no second counting function exists —
  the test calls the one `absenceCountsFor` in `src/lib/data/absence.ts` both times.

**AC-6 — a member is refused with an empty set, not an error**
- Given a caller whose role is `member`, on any team
- When they call any of the three new reads with their **own** team's id, and with **another**
  team's id
- Then each call resolves to `[]` and none rejects.

**AC-7 — a manager is refused with an empty set, not an error**
- Given a caller whose role is `manager`
- When they call any of the three new reads with their own team's id and with another team's id
- Then each call resolves to `[]` and none rejects.

**AC-8 — nobody else is answered either**
- Given, in turn: no caller at all; a removed member (`FIXTURE_REMOVED_MEMBER`); an admin passing a
  team id that names no team
- When each calls each of the three new reads
- Then each call resolves to `[]` and none rejects.

*A removed **admin** is refused by `public.is_admin`'s own `removed_at is null`
(`20260831150024_tea01_membership.sql:54-62`) and by `currentAdmin()` in the mock
(`mock.ts:323-326`). No fixture is a removed admin and creating one through the seam is
irreversible in the mock, so that case is held by the shared predicate rather than by a test here.*

**AC-9 — the datastore half is shaped as the control** (static, over the migration text with `--`
comment lines stripped)
- Given the migration file this ticket adds
- When its statements are read
- Then it creates exactly the three functions named in § 4.1, each `stable security definer set
  search_path = ''`, each whose `where` clause begins with `public.is_admin((select auth.uid()))`;
  it carries `revoke all ... from public` and `grant execute ... to authenticated` for each of the
  three signatures; and it contains no `create policy`, `alter policy`, `drop policy`, and no `grant`
  of `select`, `insert`, `update` or `delete` on any table.

**AC-10 — the own-team reads are untouched**
- Given the three existing reads `listMembers`, `listTeamEntries`, `listTeamEntriesOverlapping`
- When the same fixtures and the same callers exercise them after this change
- Then every existing test that covers them passes unedited, and none of them gains a parameter
  (seam parity asserts the arity).

**AC-11 — seam parity**
- Given the mock and the Supabase implementations
- When `tests/seam-parity.test.ts` runs
- Then both export `listMembersForTeam`, `listTeamEntriesForTeam` and
  `listTeamEntriesOverlappingForTeam` with arity 1, 1 and 2 respectively.

**AC-12 — completeness, not truncation**
- Given the Supabase implementation
- When a new read cannot prove its answer complete — the flat or roster read returns a row count at
  its limit, or the overlapping read's assembled rows differ from the datastore's exact count, or a
  row repeats across pages, or the count is absent
- Then it **throws**, with a message naming the function, exactly as its own-team twin does; it never
  returns a short array. (Mock: the same refusals are written, and the overlapping one is reachable
  only by an oversized fixture — the shape CAL-09 already accepted.)

### Invariants touched

`[INV-04, INV-05, INV-07]`.

- **INV-04** — the absence count for another team's date is computed from these reads. **One half is
  held; the other half is an accepted deviation, decided by the operator on 2026-09-23 — this bullet
  is not a claim that INV-04 is satisfied. Read *Notes for the operator* 1 with it.**
  **Held:** `listMembersForTeam` returns removed members with `removedAt` (the roster
  `absenceCountsFor` requires), `listTeamEntriesOverlappingForTeam` applies no status filter, and the
  count is the single existing `absenceCountsFor` (AC-5). No arithmetic enters the seam.
  **Not held:** the entry reads apply **the same team predicate the policy does**, and that predicate
  drops a removed member's entries on every date — the paragraph below, and the reviewer's R7 finding
  (`04-review.md` § *R7 detail*), which this plan does not dispute.
  **One thing a reviewer should know, and it predates this ticket:** `entry_select_team` compares
  `public.member_team_id(member_id)`, and that function answers null for a removed member
  (`20260831150024_tea01_membership.sql:64-68`), so a removed member's entries are invisible to the
  own-team read on every date — including dates before their removal, where INV-04 says they still
  count. `src/lib/data/mock.ts:1402-1405` records the shape as deliberate. This plan **mirrors it**,
  because ADR-040's revert condition is a difference between the two views; diverging here would
  trip it. Whether the own-team shape is itself an INV-04 defect went to the operator at REVIEW under
  RULE-07 and **was answered on 2026-09-23: ship the parity shape here, fix INV-04 in a separate
  ticket** — *Notes for the operator* 1 carries the words and what that ticket owes. Fixing it is
  still not a change for this ticket (Out-of-scope 10).
- **INV-05** — tentative entries must reach the count. Held by carrying the whole row with no
  `tentative` filter (AC-4 compares every field).
- **INV-07** — an entry counts only against its member's current team. Held by the entry functions'
  predicate `public.member_team_id(e.member_id) = p_team_id`, which is `entry_select_team`'s left
  side with the caller's team replaced by the argument — the member's team **now**, never a stored
  team on the entry (there is none).

**Open questions.** None. Nothing in this plan would change an AC, and no answer is owed before
implementation starts. Two things found while writing it are recorded for the operator under *Notes
for the operator* below; neither is a question this ticket waits on.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no layout: this ticket ships no screen. The line is written because the gate requires one
of the two, and this is the true one.*

## 3. Permission model

The permission table (`.ai/standards/rbac-and-security.md`) has no row for this yet; ADR-040
§ Affected documents specifies it and transcribing it is owed (Out-of-scope 8). Planned against the
ADR:

| Action | member | manager | admin |
|---|---|---|---|
| Read another team's entries, roster and threshold | ❌ empty set | ❌ empty set | ✅ |
| Read one's own team through the **new** reads | ❌ empty set | ❌ empty set | ✅ |
| Read one's own team through the **existing** reads | ✅ unchanged | ✅ unchanged | ✅ unchanged |
| Any write on another team | ❌ | ❌ | ❌ — not added |

**Where the check lives: in the body of each function, in the datastore.** Each is `security
definer`, which bypasses row-level security by design, so its first predicate
`public.is_admin((select auth.uid()))` **is the whole control** — `is_admin` also requires
`removed_at is null`, which is what refuses a removed admin (AC-8). `revoke all ... from public`
removes PostgreSQL's default `execute` grant so `anon` is refused before the body runs; `grant
execute ... to authenticated` restores it for signed-in callers, who are then refused by the body.

**The seam checks nothing.** Neither implementation tests the role before calling — the Supabase
implementation issues the RPC and maps rows; the mock reproduces the function body, `is_admin` first,
exactly as `listTeams` / `listAllMembers` do (`src/lib/data/mock.ts:1503-1523`). A mock that skipped
the test would let AC-6–AC-8 pass against a function that forgot its first line.

**Empty, not an error**, for every denial: the shape every admin read in this product already has
(`20260911180000_solo_many_teams.sql` § 1). A screen asking is told "nothing" rather than
"forbidden".

**Exposure, stated on its own terms** (ADR-040 § Consequences): a note written for one's own team
becomes readable by every admin. Decided by the operator (Q5); nothing in this ticket tells the
author so.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20260922150000_cal11_cross_team_reads.sql`

Shape copied from `20260911180000_solo_many_teams.sql`: header comment, `begin; ... commit;`,
`create or replace`, `language sql stable security definer set search_path = ''`, schema-qualified
names throughout, idempotent. **No `order by` in the functions** — ordering is the seam's, exactly
as the own-team twins order in the seam (`.order(...)`), so paging windows are taken over one order.

```sql
-- The roster of ANY team, removed members included (INV-04 needs them), for an admin.
-- Pending sign-ups have team_id null and cannot match.
create or replace function public.list_members_for_team(p_team_id uuid)
  returns setof public.member
  language sql stable security definer set search_path = '' as $$
  select m.*
    from public.member m
   where public.is_admin((select auth.uid()))
     and m.team_id = p_team_id;
$$;

-- Every entry of ANY team, for an admin. The team predicate is entry_select_team's left side
-- verbatim, with the caller's team replaced by the argument — so a removed member's entries are
-- excluded here exactly as they are from the own-team read (parity; plan section 2, INV-04).
create or replace function public.list_team_entries_for_team(p_team_id uuid)
  returns setof public.entry
  language sql stable security definer set search_path = '' as $$
  select e.*
    from public.entry e
   where public.is_admin((select auth.uid()))
     and public.member_team_id(e.member_id) = p_team_id;
$$;

-- The same, narrowed to entries whose inclusive range overlaps [p_start, p_end]. '[]' is required:
-- the default '[)' would drop every entry touching only p_end (ADR-011 section 1).
create or replace function public.list_team_entries_overlapping_for_team(
  p_team_id uuid, p_start date, p_end date)
  returns setof public.entry
  language sql stable security definer set search_path = '' as $$
  select e.*
    from public.entry e
   where public.is_admin((select auth.uid()))
     and public.member_team_id(e.member_id) = p_team_id
     and e.date_range && daterange(p_start, p_end, '[]');
$$;

revoke all on function public.list_members_for_team(uuid) from public;
revoke all on function public.list_team_entries_for_team(uuid) from public;
revoke all on function public.list_team_entries_overlapping_for_team(uuid, date, date) from public;

grant execute on function public.list_members_for_team(uuid) to authenticated;
grant execute on function public.list_team_entries_for_team(uuid) to authenticated;
grant execute on function public.list_team_entries_overlapping_for_team(uuid, date, date) to authenticated;
```

The SQL bodies above are the contract, not a sketch: predicate, argument names and types are fixed.
PostgREST matches RPC arguments **by name**, so `p_team_id`, `p_start`, `p_end` are load-bearing
(`src/lib/data/supabase.ts` § many teams records the same).

### 4.2 Seam interface — `src/lib/data/index.ts`, added to `DataSeam`

Placed directly after `listAllMembers` (`index.ts:694`), under a `CAL-11` section comment. No new
type: `Entry`, `Member`, `DateRange` already exist.

```ts
  /**
   * CAL-11 AC-1, AC-2, AC-6, AC-7, AC-8, AC-12. Team `teamId`'s roster, REMOVED members included,
   * for an ADMIN; an empty list for anybody else. `listMembers()` is unchanged and stays the
   * caller's own team.
   * Ordered by `createdAt` ascending, then `id` ascending — `listMembers`' order.
   * THROWS on a transport failure and on a possibly-truncated answer (ROSTER_LIMIT).
   */
  listMembersForTeam(teamId: string): Promise<Member[]>;

  /**
   * CAL-11 AC-3, AC-6, AC-7, AC-8, AC-12. Every entry of team `teamId`, note included, for an
   * ADMIN; an empty list for anybody else. The cross-team twin of `listTeamEntries()`: same rows a
   * member of that team would receive, same order (`startDate` descending, then `id` ascending).
   * THROWS on a transport failure and on a possibly-truncated answer (TEAM_ENTRY_LIMIT).
   */
  listTeamEntriesForTeam(teamId: string): Promise<Entry[]>;

  /**
   * CAL-11 AC-4, AC-5, AC-6, AC-7, AC-8, AC-12. Every entry of team `teamId` whose inclusive range
   * OVERLAPS `range`, rejected rows included, for an ADMIN; an empty list for anybody else. The
   * cross-team twin of `listTeamEntriesOverlapping(range)`: same rows, same order (`startDate`
   * ascending, then `id` ascending), same page-and-assemble completeness rule (CAL-09).
   * THROWS on a transport failure and on any answer it cannot prove complete.
   */
  listTeamEntriesOverlappingForTeam(teamId: string, range: DateRange): Promise<Entry[]>;
```

Arity: **1, 1, 2**. Parameter names `teamId`, `range` are fixed.

### 4.3 Supabase implementation — `src/lib/data/supabase.ts`

Placed directly after `listAllMembers`. Each maps rows with the **existing** `toMember` / `toEntry`
and selects the **existing** `MEMBER_COLUMNS` / `ENTRY_COLUMNS` — no new row type, no new column
list, no generated column surfaced.

```ts
  async listMembersForTeam(teamId: string): Promise<Member[]> {
    // client().rpc("list_members_for_team", { p_team_id: teamId })
    //   .select(MEMBER_COLUMNS)
    //   .order("created_at", { ascending: true }).order("id", { ascending: true })
    //   .limit(ROSTER_LIMIT)
    // error -> throw new Error(`listMembersForTeam failed: ${error.message}`)
    // not an array -> throw; rows.length >= ROSTER_LIMIT -> throw (message names the function)
    // return rows.map(toMember)
  },

  async listTeamEntriesForTeam(teamId: string): Promise<Entry[]> {
    // client().rpc("list_team_entries_for_team", { p_team_id: teamId })
    //   .select(ENTRY_COLUMNS)
    //   .order("start_date", { ascending: false }).order("id", { ascending: true })
    //   .limit(TEAM_ENTRY_LIMIT)
    // error / non-array / rows.length >= TEAM_ENTRY_LIMIT -> throw, as listTeamEntries
    // return rows.map(toEntry)
  },

  async listTeamEntriesOverlappingForTeam(teamId: string, range: DateRange): Promise<Entry[]> {
    // The listTeamEntriesOverlapping loop (supabase.ts:1617-1688), with its request replaced by
    //   client().rpc("list_team_entries_overlapping_for_team",
    //       { p_team_id: teamId, p_start: range.start, p_end: range.end }, { count: "exact" })
    //     .select(ENTRY_COLUMNS)
    //     .order("start_date", { ascending: true }).order("id", { ascending: true })
    //     .range(from, to)
    // Same TEAM_ENTRY_PAGE_SIZE / TEAM_ENTRY_MAX_PAGES, same four refusals (error, null count,
    // repeated id, assembled !== matching), messages naming listTeamEntriesOverlappingForTeam.
    // NO `.filter("date_range", ...)` — the range is the function's argument.
  },
```

The comments above specify behaviour; the Developer writes the bodies. **Verified on disk, not
recalled:** `rpc(fn, args, { head, get, count })` with `count?: 'exact' | ...` —
`@supabase/postgrest-js@2.112.4/dist/index.d.cts:5263-5269`. The developer may extract the paging
loop into a private helper shared with `listTeamEntriesOverlapping` **only if** that function's
observable behaviour and messages are unchanged (AC-10); keeping two copies is equally acceptable.

### 4.4 Mock implementation — `src/lib/data/mock.ts`

Placed directly after `listAllMembers`. Each reproduces its SQL function body, **`is_admin` first**:

```ts
  async listMembersForTeam(teamId: string): Promise<Member[]> {
    // if (!currentAdmin()) return [];
    // members.filter((m) => m.teamId === teamId), sorted byCreatedAtThenId,
    // ROSTER_LIMIT raise as listMembers, return copies.
  },

  async listTeamEntriesForTeam(teamId: string): Promise<Entry[]> {
    // if (!currentAdmin()) return [];
    // entries.filter((e) => sameTeam(memberTeamId(e.memberId), teamId)),
    // sorted startDate desc then id asc, TEAM_ENTRY_LIMIT raise as listTeamEntries, return copies.
  },

  async listTeamEntriesOverlappingForTeam(teamId: string, range: DateRange): Promise<Entry[]> {
    // if (!currentAdmin()) return [];
    // entries.filter((e) => sameTeam(memberTeamId(e.memberId), teamId))
    //        .filter((e) => e.startDate <= range.end && e.endDate >= range.start),
    // then the listTeamEntriesOverlapping assembly (mock.ts:1636-1690) unchanged.
  },
```

`sameTeam`, not `===`, for the reason `mock.ts:477-482` records. `currentAdmin()` already requires
`removedAt === null` (`mock.ts:323-326`), which is `is_admin`'s removal clause.

### 4.5 Tests — `tests/cross-team-reads.test.ts` (new)

Drives the **mock** through `__setCurrentMember`, the shape `tests/seam-parity.test.ts:60-73`
documents. Fixtures used, all existing: `FIXTURE_ADMIN` (admin, `FIXTURE_TEAM`),
`FIXTURE_MEMBER`, `FIXTURE_REMOVED_MEMBER` (removed, `FIXTURE_TEAM`), `FIXTURE_OTHER_TEAM`,
`FIXTURE_OTHER_TEAM_MEMBER`, `FIXTURE_OTHER_TEAM_ENTRY` (carries a non-null `note`),
`FIXTURE_PENDING_SIGNUP`. **No fixture is added** — the e2e suite reads the same fixtures.

- AC-1: admin → `listMembersForTeam(FIXTURE_TEAM.id)` contains `FIXTURE_REMOVED_MEMBER` with its
  `removedAt`, excludes `FIXTURE_PENDING_SIGNUP` and `FIXTURE_OTHER_TEAM_MEMBER`.
- AC-2 / AC-3 / AC-4: admin's result for `FIXTURE_OTHER_TEAM.id` `toEqual` the
  `FIXTURE_OTHER_TEAM_MEMBER`'s own-team result; AC-3/AC-4 additionally assert
  `note === FIXTURE_OTHER_TEAM_ENTRY.note`, and AC-4 asserts a range excluding 2026-09-21..22 omits
  it.
- AC-5: `absenceCountsFor` both ways over `{ start: "2026-09-01", end: "2026-09-30" }`, maps equal,
  and at least one date non-zero (so equality is not two empty maps).
- AC-6: as `FIXTURE_MEMBER`, all three reads with `FIXTURE_TEAM.id` and `FIXTURE_OTHER_TEAM.id` →
  `[]`.
- AC-7: make `FIXTURE_MEMBER` a manager through `seam.setMemberRole` as `FIXTURE_ADMIN`, undo in
  `finally` — the shape `tests/manager-role.test.ts:52-57` uses — then as for AC-6.
- AC-8: `__setCurrentMember(null)`; `FIXTURE_REMOVED_MEMBER`; `FIXTURE_ADMIN` with
  `"00000000-0000-4000-8000-000000000000"` → `[]` from all three.
- AC-9: reads the migration file named in § 4.1 with `readFileSync`, strips `--` lines as
  `tests/draft-entry.test.ts:303-316` does, and asserts each clause of AC-9 by regular expression.
- AC-10, AC-11: satisfied by the existing suite and `tests/seam-parity.test.ts`, **unedited**.
- AC-12: the Supabase refusals are exercised by no test until a project is provisioned — the same
  status `listTeamEntriesOverlapping`'s had before CAL-09's paging test; the developer may add a
  stubbed-client case only if `tests/team-entries-paging.test.ts`'s existing stub reaches `.rpc()`
  without modifying that file.

## 5. Seam impact

**Three functions added, none changed.** `listMembersForTeam(teamId)`,
`listTeamEntriesForTeam(teamId)`, `listTeamEntriesOverlappingForTeam(teamId, range)` appear in
`DataSeam`, in `src/lib/data/supabase.ts` and in `src/lib/data/mock.ts` with identical names and
arity 1, 1, 2; `tests/seam-parity.test.ts` enforces it without edit. No existing export changes
name, arity, return type or body. `absenceCountsFor` is not a seam method and is untouched. RULE-02:
nothing outside `src/lib/data/` gains a client.

## 6. Schema delta

**Three new `security definer` read functions and their six privilege statements**, in
`supabase/migrations/20260922150000_cal11_cross_team_reads.sql` (§ 4.1). **No table, column, type,
policy, trigger, constraint or table grant changes** — ADR-014 has nothing to bite on, and AC-9
asserts it. Decided by [ADR-040](../../../registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md)
decision 5 on [ADR-039](../../../registry/decisions/ADR-039-every-admin-manages-every-team.md), both
`ACCEPTED by the operator`. Applying it is human (RULE-09). **Unverified against a running
PostgreSQL**, like its predecessor; the revert is `revoke execute` on the three functions (ADR-040
§ Revert condition), which returns every calendar to own-team only without touching a shipped read.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260922150000_cal11_cross_team_reads.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "tests/cross-team-reads.test.ts"
```

Five files. **`size: S`** (up to 6). **XL clause checked, not engaged:** the schema change is three
additive functions with an accepted ADR — the operative test is whether existing callers must change
(ADM-06 `ticket.yaml:41-49` records the same reading and seven precedents), and none does; no
existing seam signature changes; `src/lib/domain/types.ts` is not touched.

**`size_estimate` (M) and `size` (S) disagree.** The estimate priced the ticket as the triage framed
it — migration, seam, "tests asserting the denials" — before reading that the parity test needs no
edit, that no fixture is needed, and that no type is added. The verdict wins (ADR-012); the ticket
proceeds.

## 8. Rejected alternatives

1. **Widen `entry_select_team`, `member_select_team` and `team_select_own` with an `or
   is_admin(...)` clause.** Fewest objects, no RPC. Rejected by ADR-039 § Rationale in terms: it
   silently turns `getTeam()` into a multi-row error for every admin and `listMembers()` into every
   team's roster, which is INV-04's denominator on every calendar screen. Out of bounds per
   `ticket.yaml:22`.
2. **One function per table with the range optional** (`list_team_entries_for_team(p_team_id,
   p_start default null, p_end default null)`), one seam method with an optional `range?`. Two fewer
   objects. Rejected because `listTeamEntries` records at `index.ts:596-601` that the flat read must
   never grow a range parameter — two readings of one call are two things to keep true — and
   because an optional parameter changes the arity parity checks.
3. **Filter the range client-side** with `.filter("date_range", "ov", ...)` on the RPC result, as
   the own-team read does on the table. One fewer function. Rejected: the function would return a
   whole team's history to every page request before PostgREST narrowed it, and the `count: "exact"`
   completeness rule would then depend on PostgREST applying a filter to a set-returning function's
   output identically to a table — plausible, not verified, and the failure is a silent short
   calendar. A SQL argument is checked in one place.
4. **Omit the flat `listTeamEntriesForTeam`**, since CAL-12's three calendar screens read only the
   overlapping one and the flat read's own consumers (`/entries/team`, `EditEntry`) stay own-team by
   ADR-040 decision 2. It would remove one door that carries every note of a team and has no caller.
   **Rejected only because ADR-040 decision 5 names it** (*"plain and date-overlapping"*) and an
   agent does not narrow an accepted decision (ADR-008). Flagged to the operator: it ships unused.
5. **Reuse `listAllMembers()` and filter by team above the seam** instead of `listMembersForTeam`.
   Zero new SQL for the roster. Rejected: it hands every team's people to a screen that asked for
   one, makes the team boundary a JavaScript filter in a component, and duplicates in CAL-12 the
   predicate this plan puts in the datastore.

## Notes for the operator

**Neither of these blocked `/implement`.** **Item 1 has since been answered — `/review` escalated it
under RULE-07 and the operator decided it on 2026-09-23; the decision is recorded inside item 1
below. Item 2 is still the operator's, at leisure.** They are
two things found while writing the plan that nobody would otherwise notice, and both are already
designed around above.

1. **The removed-member shape under INV-04** — described in full in *Invariants touched* above.
   `entry_select_team` compares `public.member_team_id(member_id)`, which answers null for a removed
   member, so that member's entries are invisible to the own-team read even on dates before their
   removal, where INV-04 says they still count. This plan **mirrors** the existing shape rather than
   diverging, because ADR-040's revert condition is a difference between the two views. Whether the
   own-team shape is itself an INV-04 defect was the operator's call — **answered below** — and
   fixing it is Out-of-scope 10, a separate ticket touching own-team behaviour, not this one.

   **Decided by the operator on 2026-09-23 — option (a).** `/review CAL-11` returned `FAIL` with
   `invariant_violation: true` on R7 and routed to a human (`04-review.md` § *R7 detail* and
   § *Findings* 1). The operator answered, verbatim:

   > "Nhận shape parity, mở ticket riêng sửa INV-04 — CAL-11 giữ nguyên, đi tiếp tới /ship. Mở một
   > ticket mới sửa INV-04 cho cả own-team lẫn cross-team cùng lúc — đúng với điều kiện revert của
   > ADR-040 là hai cách xem không được lệch số. Nợ được ghi lại chứ không biến mất."

   **What that means for CAL-11, stated plainly: this ticket ships the parity shape by the operator's
   decision, not because the invariant is satisfied.** The reviewer's R7 finding stands exactly as
   written and nothing in this plan contradicts it: the two new entry reads
   (`supabase/migrations/20260922150000_cal11_cross_team_reads.sql:51` and `:63`;
   `src/lib/data/mock.ts:1562` and `:1589`) exclude every entry of a removed member on every date,
   while INV-04 as fixed by ADR-013 counts such an entry on every date strictly before `removed_at`.
   **The defect is pre-existing in the own-team reads** — `entry_select_team` compares the same
   `public.member_team_id(...)`, which answers null for a removed member
   (`20260831150024_tea01_membership.sql:64-68`), and `src/lib/data/mock.ts:1402-1405` records the
   shape — **and it is not introduced here.** What this ticket does is write that predicate into three
   new lines so the two views agree, which is what ADR-040's revert condition requires of them.
   No acceptance criterion is relaxed by this decision and none is edited: AC-5 asserts that the
   cross-team and the own-team count are **the same number**, which they are, and it never asserted
   that the number is right for a removed member. The gate stays `PASS` because PLAN's design is
   unchanged; the R7 `FAIL` remains the review's record, and this note is the answer it was waiting
   on.

   **What the separate ticket owes.** **INV-04 fixed in the own-team reads and the cross-team reads
   together, in one ticket** — `entry_select_team`, the three functions of § 4.1, and both seam
   implementations — **never one side and then the other, because ADR-040's revert condition is that
   the two views must not disagree on a count.** Fixing one side alone would make them disagree, and
   would therefore trip the revert rather than discharge the debt. The fix has to attribute an entry
   by the member's team **on the entry's dates** (ADR-013: `removed_at` null **or** strictly after
   that date) instead of by `public.member_team_id(...)` as of now; that changes a shipped own-team
   read and a policy, so it carries a schema delta under ADR-014 and is its own PLAN to price.
   Opening it needs a feature row in `.ai/registry/features.md`, which is human plane (RULE-01) — this
   plan cannot open the ticket, and names the debt instead. **The debt is recorded here, not
   discharged.**

2. **Cross-team busy days (Out-of-scope 3) are CAL-12's to decide.** This ticket ships the reads that
   would feed such a count; whether and how another team's overloaded days are shown is a question
   about a screen, and CAL-12 owns every screen here. Recorded so the decision is not lost between
   the two rows of the split.

## Changelog

- `2026-09-23T08:50:41+0700` — *Notes for the operator* 1 and section 2 *Invariants touched* (INV-04)
  amended to record the operator's decision of 2026-09-23 on the R7 escalation: the operator's words
  are quoted verbatim, CAL-11 ships the parity shape **by that decision and not because INV-04 is
  satisfied**, the defect is named as pre-existing in the own-team reads, and the separate ticket's
  obligation — INV-04 fixed in own-team and cross-team reads **together**, because ADR-040's revert
  condition is that the two views must not disagree on a count — is written down. The INV-04 bullet
  no longer opens with "Held by parity", which was the one sentence in this plan that contradicted
  `04-review.md` § *R7 detail*. Reason: RULE-14 — the answer belongs in the artifact, so the next
  `/review` cites it instead of re-deriving the same FAIL. **No AC, contract, schema delta,
  `allowed_paths`, gate or `next_state` change, and no file other than this one touched.** Raised by
  the operator through `tech-lead-review`. Amended by `tech-lead-design`.
- `2026-09-23T00:07:46+0700` — section 2 *Open questions* rewritten to the template's form: it now
  reads `None.` and carries no entry, and the two items it had recorded moved verbatim in substance
  into a new *Notes for the operator* section, with their cross-references (INV-04 above,
  Out-of-scope 10, Out-of-scope 3 / CAL-12) intact. Reason: the section was answered "none blocking"
  and then listed two items, so `openQuestionsStop` counted three entries and stopped the run at
  READY — a question there blocks, and these were never questions. No design, AC, contract or
  `allowed_paths` change; gate and `next_state` unchanged. Raised by `run-loop`. Amended by
  `tech-lead-design`.
- `2026-09-22T23:46:12+0700` — plan written. One amendment to section 2 after reading the source
  tree, the row below; the INV-04 removed-member observation and the busy-day gap were found in the source
  and recorded as notes and Out-of-scope rather than as AC changes. Raised by `tech-lead-design`.
- `2026-09-22T23:46:12+0700` — section 2 AC-8 amended: *"a removed admin"* became *"a removed
  member"*, with the removed-admin case moved to a note. Reason: reading `src/lib/fixtures.ts:173-185`
  showed the only removed fixture is a `member`, and making an admin removed through the seam cannot
  be undone in the mock. The refusal is unchanged; only what the test can observe narrowed, and the
  note says where the narrowed half is held. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
