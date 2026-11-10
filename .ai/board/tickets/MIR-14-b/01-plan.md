---
ticket: MIR-14-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-04T01:23:40Z
inputs_read:
  - .ai/board/tickets/MIR-14-b/ticket.yaml
  - .ai/board/tickets/MIR-14/01-plan.md
  - .ai/board/tickets/MIR-14/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/170-multi-team-decisions.test.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/routes/PendingEntries.tsx
  - tests/seam-parity.test.ts
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-14-b — the queue slice: a decider's worklist names a multi-team owner and shows the teams each entry affects

## 1. Problem and scope

**Feature — MIR-14** (`.ai/registry/features.md:303`), transcribed:

> A multi-team member's entry needs approval if any of their teams requires it, the first decision wins, any rejection rejects, and both approver and rejecter are recorded

MIR-14-b is the second of two tickets on that row, split by operation (ADR-073 decision 9). MIR-14
shipped the decision: `may_decide_entry`, `entry_select_decider`, and the three decision columns.
This ticket is the queue that reads them (plan P3-5, `calechip-multi-tenancy-plan.md:196-204`:
*"Record which teams an entry affects, so each relevant manager sees it in their queue"*, *"Fall back
to `org_admin` when a team has no manager"*, *"UI shows which teams an entry affects"*).

**Who gains what.** A decider — the manager of any of the owner's active teams, or an admin sharing
one with them — opens `/pending` and sees, on every row they may decide, **who the entry belongs to**
and **which teams it affects**. Since MIR-14, a second-team manager's queue already *contains* the
entry (`entry_select_decider`), but the roster that names owners is primary-team only (ADR-072
decision 1), so the row shows a bare uuid. A row nobody can attribute is not a decision anyone can
make well. The teams are derived from `membership` at read time and never stored (ADR-073
decision 1).

When a team has no active manager, its admin is the decider (ADR-073 decision 7), and that admin's
queue lists and names those entries like any other.

As in MIR-14, no writer creates a second active membership yet (ADR-072 decision 5). In production
every owner has exactly one team, so the visible change today is one team chip per row. The
multi-team half is proven against fixtures.

**Out of scope:**

- **Showing `rejected_by`, `rejected_at` or `self_approved` on any screen.** Adding them to `Entry`
  in `src/lib/domain/types.ts` changes a shared type that `toEntry`, the mock, the fixtures,
  `WeekView.tsx` and `EditEntry.tsx` all build or read — XL under `.ai/01-operating-model.md`
  § Sizing. MIR-14's feature row asks that the rejecter be *recorded*, which MIR-14 did; no source
  names a screen for it. **No ticket owns the display.** It needs its own row (see Open questions).
  **This narrows the ticket's `title`**, whose last clause reads *"and the decision records are
  shown"*. The title was written at `/plan MIR-14` with the cost unsized; `mir_detail` made the item
  conditional (*"if a screen shows them — size it"*), and sized, it is XL. The title is left as
  written; this line is the record.
- **Moving the client's decide affordance onto `team_role`** — MIR-17. `mayDecideEntriesOf` stays
  global, so the decision controls on a row are drawn exactly as today.
- **The stale `pending-entries-own-entry` sentence** ("Your own entry — an admin decides it."). Since
  MIR-14 it is reached only by a caller the `refused` phase already turns away, so it is dead copy.
  Removing it is MIR-17's, with the affordance.
- **`org_admin` deciding across the org** — MIR-16 (ADR-073 decision 7).
- **A team with neither a manager nor an admin** — nobody decides it, as MIR-14 left it.
- **A team switch, filter or per-team count on `/pending`.** The queue stays one list over every entry
  the caller can read.
- **A writer that creates a second active membership** — unowned (ADR-072 decision 5).
- **The absence count, the calendar and the roster** — primary-team, unchanged (ADR-072 decision 1).

`size_estimate: M`.

## 2. Acceptance criteria

Fixtures come from `supabase/tests/_isolation.psql`: `admin_t`, `manager_t`, `member_t`, `member_t2`
on T (`team_t`, named `Team T`); `admin_u`, `manager_u`, `member_u`, `member_u2` on U (`team_u`,
named `Team U`). All in Org public. A **second-team row** is one active `membership` row with
`is_primary = false`, inserted by the test, with its `team_role` stated.

**AC-1 — a second-team decider gets the owner's name and both teams**
- Given `member_t` has a second-team row on U (`team_role = 'member'`)
- When `manager_u` calls `public.list_entry_owners(array[<member_t>])`
- Then two rows come back, both with `member_id = member_t` and `member_t`'s `display_name` and
  `avatar`, one with `team_name = 'Team T'` and one with `team_name = 'Team U'`, ordered by team name

**AC-2 — a single-team owner gets one team**
- Given `member_t` is on T only
- When `manager_t` calls `public.list_entry_owners(array[<member_t>])`
- Then exactly one row comes back, with `team_name = 'Team T'`

**AC-3 — nobody but a decider learns an owner's teams**
- Given `member_t` has a second-team row on U (`team_role = 'member'`)
- When `member_u` calls `public.list_entry_owners(array[<member_t>])`, then no row comes back
- And when `admin_u` calls it with `member_t` on T only (no shared team), no row comes back
- And when `manager_u` calls it with `member_t` on T only, no row comes back

**AC-4 — a manager may name their own entry's teams**
- When `manager_t` calls `public.list_entry_owners(array[<manager_t>])`
- Then one row comes back, for `manager_t` and `Team T` (ADR-073 decision 3: they decide their own)

**AC-5 — the fallback decider is named too**
- Given T has no active manager (`manager_t` demoted to member by `admin_t` with `set_member_role`)
- When `admin_t` calls `public.list_entry_owners(array[<member_t>])`
- Then one row comes back, for `member_t` and `Team T`

**AC-6 — a left team stops being affected**
- Given `member_t` had a second-team row on U, and its `left_at` is now set
- When `manager_t` calls `public.list_entry_owners(array[<member_t>])`, only `Team T` comes back
- And when `manager_u` calls it, no row comes back

**AC-7 — the read is bounded and closed to anon**
- Given an empty array, or `null`, the call returns no row
- And ids the caller may not decide are dropped without error, while ids they may decide in the same
  call still come back
- And `anon` has no `EXECUTE` on `public.list_entry_owners(uuid[])`

**AC-8 — the seam returns one owner per id, with every team (both seams)**
- Given the mock seam with the current member set to the team's admin
- When `listEntryOwners([<an approved teammate's id>, <an unknown id>])` is called
- Then it resolves to exactly one `EntryOwner`, whose `memberId`, `displayName` and `avatar` match
  that teammate, and whose `teams` is `[{ id: <team id>, name: <team name> }]`
- And `listEntryOwners([])` resolves to `[]` without a request
- And with the current member set to an ordinary member, the same call resolves to `[]`

**AC-9 — the seam refuses an oversized call**
- When `listEntryOwners` is called with more than `PENDING_PAGE_SIZE` distinct ids
- Then it throws, in both seams, before any request is sent

**AC-10 — each worklist row names its owner and shows the teams it affects**
- Given the mock seam signed in as the admin, with a pending entry from a teammate
- When `/pending` loads
- Then that row's `pending-entry-row-member` shows the teammate's display name
- And the row carries `pending-entry-row-teams` holding one `pending-entry-row-team` per team, each
  with `data-team-id` set and the team's name as its text

**AC-11 — the name falls back to the roster, and the teams line is absent without a read**
- Given a row whose owner is on the caller's roster but not returned by `listEntryOwners` (a removed
  owner, ADR-013)
- Then the row still shows the roster's display name (ADM-04 AC-2 unchanged)
- And `pending-entry-row-teams` is not rendered on that row

**AC-12 — load more names the new rows**
- Given more than one page of pending entries
- When the caller presses `pending-entries-more`
- Then the appended rows also show their owner's name and teams, and `listEntryOwners` is called only
  with ids not already resolved

**AC-13 — a failed owner read fails the screen, not the row**
- Given `listEntryOwners` throws on the first load
- Then `/pending` shows `pending-entries-unavailable`, and no partial list is drawn
- And given it throws during load more, the rows already shown stay, and the control returns

**AC-14 — ADM-04 is unchanged**
- `tests/pending-entries.test.ts` and `tests/e2e/adm-04-worklist.spec.ts` pass unedited

**Invariants touched:** `[INV-07]`

- **INV-07.** "Every team that member belongs to" is what the teams line shows: the owner's active
  `membership` rows, through `member_team_ids`, read at the moment of the question (ADR-073
  decision 1). Nothing is stored and no count moves (AC-1, AC-6).

**Open questions:**

1. **Who owns showing the rejecter and a self-approval on screen?** Out of scope here because it is a
   shared-type change (XL). It needs a feature row and a ticket via `/idea` → `/triage`. It does not
   block this ticket: MIR-14's row asks for the record, and the record exists.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

- The teams line is a **third line in the row's text column**, after the dates line and before the
  note. The order becomes: name + type + portion; dates + tentative + declared; **teams**; note;
  crowded-day sentences.
- It reads `Affects` in `text-ink-3`, followed by one pill per team in `bg-field text-ink-2`,
  `rounded-pill px-2 py-0.5 text-[11px] font-semibold`. No team colour — none exists, and lavender
  is holidays (`CLAUDE.md` § Visual direction).
- It is drawn on every row whose owner came back from `listEntryOwners`, including a single-team
  owner. One small pill on a queue that is not the calendar grid costs no row; always drawing it
  means the line's absence tells the reader something (AC-11).
- No new empty state. The manager-less team's queue is the same list, read by its admin (AC-5).

## 3. Permission model

The server side is the control. The client is the affordance (ADR-005).

| Action | Who may | Who may not | Where it is checked |
|---|---|---|---|
| Read an entry's owner name, avatar and active teams | a caller for whom `may_decide_entry(auth.uid(), owner)` is true — a manager on any of the owner's active teams, an admin sharing one, the owner themselves if they are such a decider (AC-1, AC-2, AC-4, AC-5) | every other caller, including a same-org admin with no shared team and a second-team ordinary member (AC-3); `anon` (AC-7) | `public.list_entry_owners`, `security definer`, filtered row by row through `may_decide_entry` |
| Read the pending entries themselves | unchanged — `entry_select_team`, `entry_select_decider` (MIR-14) | unchanged | the existing select policies |
| Decide an entry | unchanged — MIR-14 | unchanged | `entry_update_*`, `entry_enforce_decision()` |

The read reveals nothing a decider could not already reach: they can already select the entry
(`entry_select_decider`), and they decide on behalf of every team it affects (ADR-073 decision 4).
Team names are revealed only for the owner's own active teams.

**Row in `.ai/standards/rbac-and-security.md`.** The permission table gains one row, *Read the name
and teams of an entry's owner, for an entry they may decide* — member ❌, manager ✅, admin ✅ —
citing ADR-073 decisions 1 and 8 and this ticket.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261104090000_mir14b_entry_owners.sql`

One `begin; … commit;`, idempotent (ADR-024). Applying it to a remote project is human-only
(RULE-09). The header cites ADR-073 decisions 1, 7 and 9.

```sql
create or replace function public.list_entry_owners(p_member_ids uuid[])
  returns table (member_id uuid, display_name text, avatar text, team_id uuid, team_name text)
  language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.avatar, t.id, t.name
    from public.member m
    join public.team t on t.id in (select public.member_team_ids(m.id))
   where m.id = any (coalesce(p_member_ids, '{}'::uuid[]))
     and public.may_decide_entry((select auth.uid()), m.id)
   order by m.id, t.name, t.id;
$$;
revoke all on function public.list_entry_owners(uuid[]) from public, anon;
grant execute on function public.list_entry_owners(uuid[]) to authenticated;
```

No table, column, policy, trigger or constraint changes.

### 4.2 pgTAP

- **`supabase/tests/180-entry-owners.test.sql`** — new. Header pattern of `170-multi-team-decisions`:
  `_isolation.psql`, `tests.seed()`, an explicit `plan(n)`, `rollback`. AC-1 to AC-7 each have at
  least one assertion labelled `AC-n`.
- **`supabase/tests/010-catalogue.test.sql`** — the definer census gains, under
  `-- MIR-14-b RPC, 180-entry-owners.test.sql`: `'public.list_entry_owners(uuid[])'`.

### 4.3 Types — `src/lib/domain/types.ts`, additions only

No existing type changes, so no existing caller changes (not XL, § Sizing).

```ts
/** MIR-14-b. One of the teams an entry's owner actively belongs to (ADR-073 decision 1). */
export interface EntryOwnerTeam {
  id: string;
  name: string;
}

/**
 * MIR-14-b. The owner of an entry the caller may decide: who they are, and every team the entry
 * affects. Derived at read time from `membership`, never stored.
 */
export interface EntryOwner {
  memberId: string;
  displayName: string;
  avatar: string;
  /** Ordered by name. Never empty: an owner with no active team is not returned. */
  teams: EntryOwnerTeam[];
}
```

### 4.4 Seam — `src/lib/data/index.ts`, one new function

```ts
/**
 * MIR-14-b. The owners among `memberIds` whose entries the caller may decide, each with every active
 * team they belong to. An id the caller may not decide, or that names nobody, is absent from the
 * result — never an error. Order is not significant; callers key by `memberId`.
 *
 * `[]` resolves to `[]` without a request. THROWS before any request when `memberIds` holds more
 * than PENDING_PAGE_SIZE distinct ids — the one caller passes one page's owners — and on a
 * transport failure.
 */
listEntryOwners(memberIds: string[]): Promise<EntryOwner[]>;
```

**`src/lib/data/supabase.ts`:**

- De-duplicates `memberIds`. Throws `listEntryOwners was asked for <n> owners, more than one page (<PENDING_PAGE_SIZE>)` above the bound. Returns `[]` on an empty set.
- Calls `client().rpc("list_entry_owners", { p_member_ids: ids })`, typed by a module-private
  `interface EntryOwnerRow { member_id: string; display_name: string; avatar: string; team_id: string; team_name: string }`.
- Throws `listEntryOwners failed: <message>` on an error.
- Groups rows by `member_id` into `EntryOwner`, keeping the rows' team order.

**`src/lib/data/mock.ts`:** the same bound and de-duplication. The mock models one team per member,
so an owner is returned when all of these hold:

- the current member is approved, not removed, and `mayDecide(role)`;
- the owner is approved, not removed, and has a `teamId`;
- `owner.teamId === me.teamId`.

`teams` is `[{ id, name }]` from the mock's `teams` store.

### 4.5 Screen — `src/routes/PendingEntries.tsx`

- `View`'s `ready` phase gains `owners: Map<string, EntryOwner>`.
- `reload` reads the first page and the roster as today. It then calls
  `seam.listEntryOwners(<distinct memberIds of the page>)` inside the same `try`. A throw lands on
  `unavailable` (AC-13).
- `loadMore` calls it with the new page's ids not already in `owners`, and merges the result. A throw
  there is silent, as today (AC-13).
- `ownerName(id)` resolves the roster first, then `owners`, then the bare id. `ownerAvatar` resolves
  the same way (AC-11).
- The teams line, per § 2b:

```tsx
{owner && owner.teams.length > 0 ? (
  <p
    data-testid="pending-entry-row-teams"
    data-team-ids={owner.teams.map((t) => t.id).join(",")}
    className="flex flex-wrap items-center gap-1.5 text-xs"
  >
    <span className="text-ink-3">Affects</span>
    {owner.teams.map((t) => (
      <span
        key={t.id}
        data-testid="pending-entry-row-team"
        data-team-id={t.id}
        className="rounded-pill bg-field px-2 py-0.5 text-[11px] font-semibold text-ink-2"
      >
        {t.name}
      </span>
    ))}
  </p>
) : null}
```

Every other `data-testid` on the screen is unchanged.

### 4.6 Tests

- **`tests/entry-owners.test.ts`** — new, mock seam driven directly, as `tests/pending-entries.test.ts`
  is: AC-8, AC-9. AC-9's supabase half asserts the throw without a client.
- **`tests/e2e/mir-14-b-worklist-teams.spec.ts`** — new, against the mock build
  (`playwright.config.ts`, `VITE_DATA_SEAM: "mock"`): AC-10, AC-11, AC-12, AC-13.

## 5. Seam impact

**One function added: `listEntryOwners(memberIds)`**, arity 1, in `index.ts`, `mock.ts` and
`supabase.ts`. `tests/seam-parity.test.ts` checks names and arity and needs no edit. No existing
function changes signature or behaviour. `listPendingEntries` and `listMembers` are untouched.

## 6. Schema delta

**Not `none`:** one new `security definer` function, `public.list_entry_owners(uuid[])`, with its
grants. It touches no table, policy, trigger or constraint.

ADR: **ADR-073** (accepted 2026-11-03), decisions 1, 7 and 9, which settle that the teams are derived
from `membership`, that the team's admin is the fallback decider, and that this queue is MIR-14-b.
No new ADR. `requires_adr: true`. Applying the migration is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261104090000_mir14b_entry_owners.sql"
  - "supabase/tests/180-entry-owners.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/supabase.ts"
  - "src/routes/PendingEntries.tsx"
  - "tests/entry-owners.test.ts"
  - "tests/e2e/mir-14-b-worklist-teams.spec.ts"
```

Eleven paths, so `size: M`, which agrees with `size_estimate: M`.

- **`src/lib/domain/types.ts`** — additions only (§ 4.3). The shared-type XL test is whether existing
  callers must change, and none do.
- **`.ai/standards/rbac-and-security.md`** — the one permission row in § 3. The MIR-14 paragraph and
  audit row A10 are not touched.

**`glossary_owed` is `[]`.** No glossary row is written.

## 8. Rejected alternatives

1. **Widen `member_select_team` to every active team**, so `listMembers()` names the owner. Rejected.
   ADR-072 decision 1 keeps that policy on the primary team because it feeds the absence count. Widening
   it would put second-team members on the roster, the calendar and INV-04's denominator — the change
   ADR-072 refused.
2. **Add `teams` (and the owner's name) to `Entry`, or embed them in `PendingEntryPage.rows`.**
   Rejected: a changed shared type and a changed return shape of an existing seam function, both XL.
   A separate read, keyed by owner, carries the same facts with no existing caller changing.
3. **Store the affected teams on the entry.** Rejected by ADR-073 *Options considered*: a stored copy
   drifts the day a member joins or leaves a team.
4. **Key the new read by entry id instead of owner id.** Plausible, since the screen holds entries.
   Rejected: every entry of one owner affects the same teams, so a queue of six entries from two people
   would return the same facts three times over. It would also need a second filter (status, the
   select policies) that `may_decide_entry` already decides by owner.
5. **Draw the teams line only for owners with more than one team.** Rejected: in production today that
   is nobody, so the line would never appear, and AC-10 would be unobservable outside fixtures. Always
   drawing it also makes its absence mean something (AC-11).

## Changelog

- 2026-11-04T01:23:40Z — created. Sections 1 and 2 were written from `features.md:303`, `ticket.yaml`
  (`mir_detail`), MIR-14's plan and ADR-073 before the source was read. After reading it, three
  amendments: the `Entry` fields item moved to Out of scope, because the source showed four existing
  consumers of `Entry` (XL); AC-11 was added, because `listMembers()` is the only thing naming a
  removed owner today and the new read cannot; and the teams line was changed from multi-team-only to
  every row (§ 8 alternative 5). Raised by tech-lead-design. Amended by tech-lead-design.
