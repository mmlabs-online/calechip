---
ticket: MIR-21
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-05T09:32:02Z
inputs_read:
  - .ai/board/tickets/MIR-21/ticket.yaml
  - .ai/board/tickets/MIR-13-b/01-plan.md
  - .ai/board/tickets/MIR-13-b/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md
  - .ai/registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md
  - .ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md
  - .ai/01-operating-model.md
  - .ai/standards/tech-stack.md
  - .ai/templates/plan.md
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260913090000_solo_avatar_images.sql
  - supabase/migrations/20261023120000_mir09_schema_cleanup.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/data/supabase.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-21 — the read slice: every reader of `member.team_id` reads the roster team from `membership`

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| MIR-21 | `member.team_id` is dropped once every reader has moved to `membership` |

Plan item P3-3, last step (`.ai/board/plans/calechip-multi-tenancy-plan.md:187`): *"Drop
`member.team_id` only after all readers move to `membership`"*.

**This ticket is the first half of that feature, split by operation (ADR-077 decision 3).** Done
whole, the feature is `L`: about eighteen paths, most of them pgTAP fixtures that insert the column.
This ticket moves **every reader** off the column. MIR-21-b then moves every writer, drops the column,
and rewrites the fixtures. The feature row stays `PLANNED` until MIR-21-b ships.

**Who gains what.** No role gains a capability, and no answer changes. Today the roster, the sign-up
queue, busy days, the admin member lists and the directory all ask `member.team_id` which team a
person is on. `membership` is the table that can answer for a person on several teams (ADR-070). This
ticket makes it the source of that answer. Until it is, the column cannot be dropped, and a second
membership cannot be created without these reads going wrong for that person.

**The answer moves without changing.** A member's *roster team* is the team of their active
primary membership. For a removed member it is the team of the membership row their removal closed.
Otherwise it is null (ADR-077 decision 1). Under ADR-071's mirror this equals `member.team_id` for
every row. AC-1 proves that while the column still exists to compare against.

`size_estimate: M`

**Out of scope:**

- **Writers of the column**, and the write-side predicates on it: `admit_member`, `move_member`,
  `set_member_team`, `reject_member`, `set_member_role`, `promote_member_to_admin`, `delete_team`,
  `grant_system_admin`, `admit_allow_listed_member`, `member_decide_admin`,
  `member_enforce_role_and_removal`, and the `member` branch of `stamp_org_id`. They go to MIR-21-b.
- **Dropping** `member.team_id`, its index `member_team_id_idx`, `public.member_team_id(uuid)` and
  the `member_sync_membership` trigger and function. These go to MIR-21-b.
- **Fixtures** that insert `member.team_id` (pgTAP, `seed.sql`, `bootstrap.sql`,
  `create-account.sql`). These go to MIR-21-b, which can edit them only once nothing reads the column.
- **`.ai/standards/data-model.md`**, where it documents the column. It is changed when the column is
  dropped, in MIR-21-b.
- **A member's view of a secondary team.** ADR-072 decision 5 and its revert condition cover it. No
  feature provides it.
- **`list_entry_owners`** (MIR-14-b) and the four count-feeding policies ADR-072 already put on
  `member_primary_team_id`. They do not read the column.
- **The mock** (`src/lib/data/mock.ts`). It holds `teamId` on the domain `Member`, not a column, and
  its answers do not change.

## 2. Acceptance criteria

Fixtures: org O1 holds teams T1 and T2. Org O2 holds team T3. Members:

- A — admin on T1
- M — member on T1
- R — removed from T1 (`removed_at` set)
- P — a pending sign-up
- J — a rejected sign-up
- V — moved from T1 to T2 by `move_member`
- K — admin on T3

Every fixture is created by today's writers, so the mirror maintains `membership`.

**AC-1 — The roster team equals the column for every member**
- Given the fixtures above, and every other row `public.member` holds in the test database
- When `public.member_roster_team_id(id)` is read for every row of `public.member`
- Then for every row it `is not distinct from` that row's `team_id`
- And it is T1 for R, T2 for V, and null for P and J

**AC-2 — The computed field gives the same answer**
- Given the fixtures above
- When `select m.team_id, public.roster_team_id(m) from public.member m` is run as the table owner
- Then the two columns are equal, `is not distinct from`, on every row

**AC-3 — The roster read is unchanged**
- Given M is signed in
- When M reads `public.member`
- Then M sees exactly A, M and R. That is the active and removed members whose roster team is T1.
- And M does not see P, J, V or K

**AC-4 — Busy days are unchanged**
- Given R and M each have a `busy_day` row, and so does V
- When M reads `public.busy_day`
- Then M sees R's row and M's own row, and not V's

**AC-5 — The sign-up queue is unchanged, and so are its refusals**
- Given A is signed in
- When A reads `public.member` filtered to rows whose `roster_team_id` is null
- Then A sees P and J, and no approved member
- And when M is signed in and runs the same read, M sees no row of P or J
- And when K is signed in and runs the same read, K sees no row of P or J. K is an admin of another
  org.

**AC-6 — The admin member lists are unchanged, and bounded by org**
- Given A is signed in
- When A calls `list_all_members()`
- Then the result is every O1 member whose roster team is not null, removed members included, and no
  O2 member
- And when A calls `list_members_for_team(T2)`, the result is exactly V
- And when A calls `list_members_for_team(T3)`, the result is empty
- And when M calls either function, the result is empty

**AC-7 — The directory is unchanged**
- Given M is signed in, and no event or notification links M to V
- When M calls `list_member_directory()`
- Then A and M each appear once, with `team_id` T1 and T1's name
- And V, R, P, J and K do not appear
- And when A calls `list_member_directory()`, V appears once with `team_id` T2 and T2's name, and K
  does not appear

**AC-8 — No read policy or read function reads the column**
- Given the migration is applied
- When `pg_policies` is searched (`cmd = 'SELECT'`, `qual`) for a reference to `member.team_id` or
  `m.team_id`, or to a bare `team_id` in a policy on `public.member`
- Then no policy matches
- And when the bodies of `list_all_members`, `list_members_for_team` and `list_member_directory` are
  searched for `m.team_id`, none matches

**AC-9 — The seam reads the roster team, not the column**
- Given the real seam (`src/lib/data/supabase.ts`)
- When the strings it sends to PostgREST are searched
- Then no `select` names the bare column `team_id` on `member`. It selects
  `team_id:roster_team_id`.
- And no filter names `team_id` on `member`. Every such filter names `roster_team_id`.
- And `listMembers`, `listPendingMembers`, `countPendingMembers`, `listAllMembers` and
  `listMembersForTeam` return the same `Member` values as before against the fixtures (AC-3, AC-5,
  AC-6)

**AC-10 — The helpers are closed to `anon`**
- Given the migration is applied
- When `anon` calls `public.member_roster_team_id(uuid)` or `public.roster_team_id(public.member)`
- Then it is refused with `42501`

**Invariants touched:**

- **INV-04.** The roster and busy days feed the absence count, and removed members must still be on
  the roster for past dates. AC-1, AC-3 and AC-4 hold the answer equal to today's, so no second
  definition of the count appears.
- **INV-07.** "Every team that member belongs to" now has a single source for these reads:
  `membership`. The answer stays single-valued, on the primary team (ADR-072 decision 1).

**Open questions.** None. The removed-member rule is settled in ADR-077 decision 1 from the mirror's
own definition. It is not a guess about intent.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

No screen changes in this ticket. There is no layout to specify.

## 3. Permission model

The permission model does not change. Every check stays in the database, in RLS or a definer
function's `where` (ADR-005).

| Read | Who may | Who may not |
|---|---|---|
| `public.member`, through `member_select_team` | anyone with an active primary team: rows whose roster team is that team | anyone, for a row on another team or org. A pending, rejected or removed caller sees no team roster: `member_primary_team_id` is null for them, as today |
| `public.member`, through `member_select_pending_admin` | an admin: rows in the admin's org whose roster team is null and status is not `approved` | a member or manager; an admin of another org (AC-5) |
| `public.busy_day`, through `busy_day_select_team` | the owner's roster-team colleagues | anyone else |
| `list_all_members()`, `list_members_for_team(uuid)` | an admin, within the admin's org | everyone else gets zero rows (AC-6) |
| `list_member_directory()` | unchanged (ADR-066, ADR-072) | unchanged |
| `member_roster_team_id(uuid)` | `authenticated` | `anon` (AC-10), `public` |
| `roster_team_id(public.member)` | `authenticated`, through PostgREST on a row it can already read | `anon`, `public` |

`member_roster_team_id(uuid)` takes any id and returns that member's team uuid to any authenticated
caller. `member_primary_team_id` and `member_team_ids` already do the same. This ticket adds no new
kind of exposure and does not close the existing one (ADR-077 *Consequences*).

## 4. Contract

One migration: `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql`. It is
**idempotent** (ADR-024): `create or replace` for every function, and `drop policy if exists` before
every policy, inside `begin; … commit;`. Applying it to a hosted database is human (RULE-09).

### 4.1 Helper and computed field

```sql
-- ADR-077 decision 1. The active primary row; for a removed member, the row the removal closed;
-- otherwise null. No status filter: the roster carries removed members (ADR-013, INV-04).
create or replace function public.member_roster_team_id(p_member uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select ms.team_id
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_member
     and (   (m.removed_at is null     and ms.left_at is null and ms.is_primary)
          or (m.removed_at is not null and ms.left_at = greatest(m.removed_at, ms.joined_at)))
   order by ms.joined_at desc, ms.id
   limit 1;
$$;
revoke all on function public.member_roster_team_id(uuid) from public, anon;
grant execute on function public.member_roster_team_id(uuid) to authenticated;

-- ADR-077 decision 2. A PostgREST computed field: the seam selects it as `team_id:roster_team_id`.
-- Invoker, so a caller only ever passes a row its policies already let it read.
create or replace function public.roster_team_id(p_member public.member) returns uuid
  language sql stable set search_path = '' as $$
  select public.member_roster_team_id(p_member.id);
$$;
revoke all on function public.roster_team_id(public.member) from public, anon;
grant execute on function public.roster_team_id(public.member) to authenticated;
```

`ms.id` is `membership`'s primary key (`20261027120000_mir11_composite_foreign_keys.sql:162`). The
`order by` is a tiebreak only, and it never decides the answer under the mirror.

### 4.2 Policies

Each keeps its table, its command and `to authenticated`.

| Policy | `using` becomes |
|---|---|
| `member_select_team` on `public.member` | `public.member_roster_team_id(id) = public.member_primary_team_id((select auth.uid()))` |
| `member_select_pending_admin` on `public.member` | `public.is_admin((select auth.uid())) and public.member_roster_team_id(id) is null and status <> 'approved'::public.member_status and org_id = public.member_org_id((select auth.uid()))` |
| `busy_day_select_team` on `public.busy_day` | `public.member_roster_team_id(public.busy_day.member_id) = public.member_primary_team_id((select auth.uid()))` |

### 4.3 Read functions

Each keeps its name, signature, return type, volatility and `security definer set search_path = ''`.
`create or replace` therefore keeps its grants.

| Function | Changes |
|---|---|
| `list_all_members()` | `and m.team_id is not null` becomes `and public.member_roster_team_id(m.id) is not null` |
| `list_members_for_team(p_team_id uuid)` | `and m.team_id = p_team_id` becomes `and public.member_roster_team_id(m.id) = p_team_id` |
| `list_member_directory()` | the select list's `m.team_id` and the join `t.id = m.team_id` both become `public.member_primary_team_id(m.id)`. Clause (b), `m.team_id in (select public.member_team_ids(...))`, becomes `public.shares_active_team(m.id, (select auth.uid()))`. Nothing else changes. The output column stays named `team_id` |

The directory already excludes removed and non-approved members. For every row it lists, the roster
team and the primary team are therefore the same, and `member_primary_team_id` is the narrower name.

### 4.4 The seam — `src/lib/data/supabase.ts`

`MemberRow`, `toMember` and every exported signature are unchanged.

```ts
const MEMBER_COLUMNS =
  "id, team_id:roster_team_id, display_name, avatar, role, status, email, last_sign_in_at, removed_at, created_at";
```

| Method | Change |
|---|---|
| `listPendingMembers` | `.is("team_id", null)` becomes `.is("roster_team_id", null)` |
| `countPendingMembers` | `.is("team_id", null)` becomes `.is("roster_team_id", null)` |
| `listMembers` | `.not("team_id", "is", null)` becomes `.not("roster_team_id", "is", null)`. `tests/roster-excludes-signups.test.ts:67-69` pins this string and moves with it (§ 7) |
| `listAllMembers` | `.rpc("list_all_members")` gains `.select(MEMBER_COLUMNS)` before `.limit`, the shape `listMembersForTeam` already uses |
| every other `.select(MEMBER_COLUMNS)` | none; the constant carries the change |

Comments in the file that name the `team_id` filter (`:1653-1655`, `:1737-1747`, `:3380-3383`) are
updated to name `roster_team_id` and ADR-077. Their reasoning is unchanged.

**`TODO(verify)` for the Developer, against the running stack, not from recall.** PostgREST must
honour three things:

- the alias form `team_id:roster_team_id` on a computed field;
- an `is` filter on a computed field;
- `.select(...)` with a computed field on an RPC that `returns setof public.member`.

PostgREST is on the "past reliable recall" list in `.ai/standards/tech-stack.md`. If any of the three
is refused, stop and route to `tech-lead-design`. Do not substitute a view or a second RPC: that is
ADR-077's rejected option.

### 4.5 pgTAP — `supabase/tests/220-roster-team-from-membership.test.sql`

New file. Fixtures as in § 2, created through today's writers (`admit_member`, `move_member`,
`reject_member`, removal). One assertion block per AC-1 to AC-8 and AC-10. AC-1 runs over every row
of `public.member`, not just the fixtures.

### 4.6 Catalogue — `supabase/tests/010-catalogue.test.sql`

The definer census (`:15-18`, `where … p.prosecdef`) gains `'public.member_roster_team_id(uuid)'`,
under a `-- MIR-21 helper, 220-roster-team-from-membership.test.sql` comment.
`roster_team_id(public.member)` is an invoker function, so it is not in that census. The anon
census (`:98-113`) needs no new entry: both functions revoke `anon`, and AC-10 asserts it.

## 5. Seam impact

**No seam function is added, removed or re-signed.** `MEMBER_COLUMNS` and four method bodies change
(§ 4.4), and nothing else. The mock is unchanged, so the seam-parity test has nothing new to compare.

## 6. Schema delta

**Not `none`.** The migration adds two functions and their grants, rewrites three policies, and
rewrites three definer functions (§ 4). It changes no table, column, constraint or trigger. Under
ADR-014 a policy rewrite is a schema delta.

Covered by [ADR-077](../../../registry/decisions/ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md),
within ADR-072 and ADR-071. `requires_adr: true`.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md"
  - ".ai/registry/decisions/ADR-076-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md"
  - ".ai/board/tickets/MIR-21-b/ticket.yaml"
  - ".ai/board/tickets/MIR-16/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - ".ai/board/tickets/MIR-19/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql"
  - "supabase/tests/220-roster-team-from-membership.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/supabase.ts"
  - "tests/roster-excludes-signups.test.ts"
```

Twelve paths, so `size: M`.

- The ADR-076 path is the source side of the 09:53:29Z renumber. It is a deletion, not an edit: the
  file's content is ADR-077, and the old name is still at `7a50eaa`. It is listed only so that R1,
  `check-allowed-paths` and `check-carry` count the rename as the ticket's own. Nothing may write
  that path.

- `tests/roster-excludes-signups.test.ts` gets one edit only. In the source-text assertion at `:67-69`,
  the regex and the test title name `roster_team_id` instead of `team_id`, and a comment cites ADR-077.
  The mock half (`:1-49`) and the body extractor do not change. The assertion still pins the filter
  that keeps `member_select_pending_admin`'s rows off the roster (TEA-09). Only the column it filters
  on changes (§ 4.4, AC-9).

- The four other tickets' `ticket.yaml` gain `MIR-21-b` in `depends_on` (ADR-077 decision 6). That
  edit was made at this PLAN and needs nothing further at IN_PROGRESS.
- `MIR-21-b/ticket.yaml` was written at this PLAN.
- `glossary_owed` is `[]`. No glossary row is owed.
- `size_estimate` (M) and `size` (M) agree. The feature as transcribed was `L`, and the split is what
  made them agree.

## 8. Rejected alternatives

- **The whole feature in one ticket.** Readers, writers, the drop and the fixtures, about eighteen
  paths. Rejected: `L` must split at PLAN (`.ai/01-operating-model.md` § *Sizing*).
- **Writers first, as ADR-071 decision 5 ordered MIR-13.** Rejected. Every reader still on the column
  would go wrong for anyone admitted or moved after the writers stop setting it, unless the mirror
  were reversed. A two-way mirror is the duplication ADR-071 decision 2 rejected (ADR-077
  *Options*).
- **A computed field named `team_id`, so that the seam is untouched after the drop.** Rejected. While
  the column exists, PostgREST resolves `team_id` to the column, so AC-2 and AC-9 could not show that
  the field gives the same answer.
- **The roster team as the active primary team only (`member_primary_team_id`).** It is simpler, and
  it is the helper every other policy already uses. Rejected: it drops removed members from
  `member_select_team` and `busy_day_select_team`. INV-04 then loses their entries for every past
  date they were on the team (ADR-013; `supabase.ts:1730-1731`).

## Delegated decisions

- ADR-077 — MIR-21 splits reads first; the roster team is read from `membership` through
  `member_roster_team_id` and the computed field `roster_team_id`. It supersedes nothing. It was
  written under ADR-067 because it re-scopes a feature that other tickets are blocked by.

## Changelog

- `2026-11-05T09:32:02Z` — sections 1 to 8 written. Raised by `tech-lead-design`. Sections 1 and 2
  were drafted from the feature row, plan item P3-3, ADR-071 and ADR-072. Reading
  `member_sync_membership` then added the removed-member half of the roster-team rule. That came from
  the mirror's definition, not from convenience: without it AC-3 and AC-4 would change today's
  answer.
- `2026-11-05T09:53:29Z` — sections 1, 4, 5, 6, 7, 8 and *Delegated decisions*: the ADR renumbered from 076 to ADR-077, and
  `supabase/tests/210-roster-team-from-membership.test.sql` renamed to
  `220-roster-team-from-membership.test.sql`. PR #191 (MIR-15) already uses ADR number 076 and
  `supabase/tests/210-*`. Numbers only; no content changed. Raised by the operator. Amended by
  `tech-lead-design`.
- `2026-11-05T10:13:13Z` — sections 4.4 and 7: `allowed_paths` gains
  `tests/roster-excludes-signups.test.ts`, which brings the count to eleven, so size stays M. That test's
  source-text regex pins `listMembers`' old `.not("team_id", "is", null)` filter, so § 4.4 as written
  breaks it. Only its regex and title change, to `roster_team_id`. Keeping the old filter would fail
  AC-9 and block MIR-21-b. Deleting the assertion would leave TEA-09 unpinned. The gate is unchanged.
  Raised by `developer`. Amended by `tech-lead-design`.
- `2026-11-05T10:14:40Z` — section 7: `allowed_paths` gains the ADR-076 path, the deleted source side of the 09:53:29Z
  renumber, because R1, `check-allowed-paths` and `check-carry` counted the staged rename as outside
  the ticket. It is listed as a deletion only, so no content changes. Twelve paths, so size stays M.
  The gate is unchanged. Raised by `developer`. Amended by `tech-lead-design`.
