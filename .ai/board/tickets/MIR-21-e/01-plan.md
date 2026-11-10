---
ticket: MIR-21-e
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-07T05:10:56Z
inputs_read:
  - .ai/board/tickets/MIR-21-e/ticket.yaml
  - .ai/board/tickets/MIR-21-f/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261106130000_mir21c_membership_self_lock.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/tests/210-org-public-team-bound.test.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/260-writers-stop-writing-team-id.test.sql
  - supabase/seed.sql
  - supabase/bootstrap.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-21-e — no fixture names `member.team_id`: every fixture writes `membership` itself

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:310`):

| ID | Feature | Group |
|---|---|---|
| MIR-21 | `member.team_id` is dropped once every reader has moved to `membership` | MIR |

**ADR-080 decision 3, the slice this ticket ships:** *"MIR-21-e: fixtures stop naming the column.
Every `insert into public.member` that names `team_id` writes `membership` itself instead. Where a
fixture relied on `stamp_org_id`'s team lookup to get an org, it names `org_id`."* It also says
*"`220` AC-1 and AC-2 are retired"*, and that the slice needs no migration.

**Who gains what.** No user sees a change. After this ticket the only writers of the column left
outside migrations are the fixtures of 100, 160 and 240. MIR-21-f rewrites those in the same change
as the drop (ADR-081). So the drop no longer breaks every pgTAP file at once, and `supabase db reset`
plus `bootstrap.sql` still produce a working local project with the same `membership` rows they
produce today.

`size_estimate: M`. Ten fixture or seed files, one ADR, and one sibling `ticket.yaml`.

**Out of scope — and where each goes:**

- **The fixtures of 100, 160 and 240** go to **MIR-21-f** (ADR-081, written at this PLAN because
  thirteen files is `L`).
- **The drop itself**, the mirror's INSERT branch, `stamp_org_id`'s team lookup and
  `public.member_team_id(uuid)` are all **MIR-21-f** (ADR-080 decision 4). The INSERT branch stays in
  this ticket. It simply finds `team_id` null in every fixture changed here.
- **Migrations.** Historical migration bodies that name the column — `tea01_membership`,
  `solo_member_approval`, `solo_avatar_images` — are superseded definitions. They are never edited
  (ADR-024).
- **Catalogue and regex assertions that name `team_id` as text** (010, 040, 100, 110, 160; 220 AC-8;
  230 AC-13). They read `pg_proc` or `pg_policies`, not the column, and they are **MIR-21-f**'s.
- **The mock seam and `src/lib/fixtures.ts`.** The mock does not model the column.

## 2. Acceptance criteria

The observer is the pgTAP suite (`supabase test db`) and a fresh local project
(`supabase db reset`, then `bootstrap.sql`).

**AC-1 — no in-scope fixture names the column**
- When `_isolation.psql`, 120, 140, 150, 190, 210, 220, 230, `seed.sql` and `bootstrap.sql` are
  searched for an `insert into public.member` whose column list names `team_id`
- Then there is none

**AC-2 — the seed's people are on the same teams as before**
- Given `tests.seed()` has run
- When `public.member_roster_team_id(id)` is read for each of its twelve people
- Then each of the eleven approved people answers the team in their seed row, and `pending_p`
  answers null

**AC-3 — a fixture's `membership` row is the row the mirror wrote**
- Given a member is inserted by a changed fixture with a team, with or without `removed_at`
- When their `membership` row is read
- Then it has the member's `org_id`, the team, `team_role` `manager` for a manager and `member`
  otherwise, `is_primary = (removed_at is null)`, `joined_at = created_at`, and
  `left_at = greatest(removed_at, created_at)` when removed, else null. These are the values of the
  mirror's INSERT branch (`20261105210000_mir21b_writers_write_membership.sql:348-362`)

**AC-4 — a member on another org's team names that org**
- Given a changed fixture puts a member on a team of a non-shared org (Org B in 140 and 150, Org D in
  210, O1/O2 in 220 and 230, Org A/B in 120)
- When the member's `org_id` is read
- Then it is that team's org, and it is set by the fixture's own `org_id`, not by `stamp_org_id`

**AC-5 — every pgTAP file passes**
- When `supabase test db` runs the whole suite
- Then every file passes. The `plan(n)` counts change only where § 4.3 retires an assertion

**AC-6 — a fresh local project still seeds and bootstraps**
- When `supabase db reset` applies `seed.sql`, and `bootstrap.sql` runs on a project with no admin
- Then both succeed. Every seeded team member has exactly one active primary `membership` row on
  their seed team, the removed one has a closed row, and admin zero has one active primary row on
  the one team, `team_role` `member`

**Invariants touched.** `[]`. INV-04 (a removed member stops counting) is carried by
`membership.left_at`. AC-3 keeps the fixtures' values identical to the mirror's, and no product code
changes.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

No permission changes, and no code a user reaches changes. Every fixture insert runs as the owner,
with `auth.uid()` null. That is why MIR-21-c's `membership_refuse_own_rows` admits it
(`20261106130000_mir21c_membership_self_lock.sql:38`). `bootstrap.sql` runs the same way, in the SQL
editor as the owner. `tests.put_on_team` (§ 4.1) lives in the `tests` schema, which no client role can
reach (`_isolation.psql`).

## 4. Contract

### 4.1 Helper — `supabase/tests/_isolation.psql`

Defined before `tests.seed()`:

```sql
-- MIR-21-e (ADR-080 decision 3). Writes the one `membership` row the mirror's INSERT branch wrote for
-- a member inserted with a team (20261105210000_mir21b_writers_write_membership.sql:348-362), so a
-- fixture that no longer names `member.team_id` gets the same row. Owner only; call it after the
-- member insert and before any entry, event or busy_day of that member (their stamps read the
-- primary team from `membership`).
create function tests.put_on_team(p_member_id uuid, p_team_id uuid) returns void
  language sql security invoker set search_path = '' as $$
  insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at)
  select m.org_id, p_team_id, m.id,
         case when m.role = 'manager'::public.member_role
              then 'manager'::public.team_role else 'member'::public.team_role end,
         m.removed_at is null,
         m.created_at,
         case when m.removed_at is null then null else greatest(m.removed_at, m.created_at) end
    from public.member m
   where m.id = p_member_id;
$$;
```

`tests.seed()`: the member insert at `:102-108` drops `team_id` and its `case` value. Directly after
it, inside the loop:
`if v_person.team is not null then perform tests.put_on_team(tests.id(v_person.label), tests.id(v_person.team)); end if;`

### 4.2 Inline fixtures — the same three-step rule in every file

1. Delete `team_id` and its value from the `insert into public.member` column list.
2. Where the team belongs to an org other than the shared tenant, name `org_id` with that org. Where
   the file already names it, keep it.
3. After the insert, and before any row that stamps from the member's primary team, call
   `tests.put_on_team(<member>, <team>)` once per member the insert put on a team.

| File | Inserts | Notes |
|---|---|---|
| `120-composite-fks.test.sql` | `:264-267` | `org_id` already named. `on conflict … do update set team_id = excluded.team_id, org_id = …` becomes `do update set org_id = excluded.org_id`. Then `put_on_team` for Ada (Engineering) and Cy (Design), before the event insert at `:270` |
| `140-org-stamping-and-membership-mirror.test.sql` | `:40-44`, `:91-92` | M2 and Admin B gain `org_id = tests.m13('org_b')`, then `put_on_team(…, team_2)`. P2 and X lose the null `team_id`. **`:95-96` (*"AC-5: member on T2 -> T2's org"*) is retired** and `plan(36)` becomes `plan(35)`: the fixture now names the org, so the assertion would test the fixture, and the team lookup it covered is dropped by MIR-21-f. The `:33` comment is reworded |
| `150-write-path-org-bound.test.sql` | `:37-40` | M2 gains `org_id = tests.m13('org_b')`, then `put_on_team(M2, team_2)` before the entry at `:41`. P2 loses the null `team_id` |
| `190-system-admin.test.sql` | `:103-104` | Inside a `throws_ok`. Drop `team_id` and its `null`. No `put_on_team` |
| `210-org-public-team-bound.test.sql` | `:51-56` | Split into two inserts. Dan and Dee name `org_id = tests.m15('org_d')`, then `put_on_team` on D1 and D2. Alice, Bob and Carol take the shared tenant by default, then `put_on_team` on `team_t`, `team_u` and `team_t`. All five calls come **before** Carol's non-primary row at `:59-60`. The `:58` comment stops saying "the mirror" |
| `220-roster-team-from-membership.test.sql` | `:34-39` | A and K drop `team_id` (their `org_id` is already named), then `put_on_team(A, t1)` and `put_on_team(K, t3)`. The pending five drop the null. **AC-1's first assertion (`:64-69`) and AC-2 (`:78-82`) are retired**, since both compare the column. `plan(27)` becomes `plan(25)`. AC-1's four roster-team checks (`:70-73`) stay, and the header comment heading AC-1 becomes "the roster team of each decided member". The header (`:1-7`) stops saying A and K are inserted "the way the seed inserts a member" through the mirror |
| `230-writers-write-membership.test.sql` | `:76-84` | Drop `team_id` from all three inserts. Then `put_on_team` for A (t1), K (t3), and M, R, W and V (t1), **before** V's non-primary T2 row at `:85-87`. The header (`:4-6`) stops saying the mirror writes their rows |

A fixture insert the Developer finds beyond this table, inside these files, follows the same rule and
is listed in `03-impl-log.md`.

### 4.3 Retired assertions — complete list

| File | Lines | `plan` |
|---|---|---|
| 140 | `:95-96` | 36 → 35 |
| 220 | `:64-69`, `:78-82` | 27 → 25 |

No other `plan(n)` changes.

### 4.4 `supabase/seed.sql`

All seven `insert into public.member (id, team_id, display_name, avatar, role, status, removed_at,
created_at)` drop `team_id` and its value. Every seed team is stamped into the shared tenant, so no
`org_id` is added. Directly after the last member insert (`:478`), and before the first `entry`
insert (`:507`), one statement writes the mirror's rows:

```sql
-- MIR-21-e (ADR-080 decision 3). The rows the mirror's INSERT branch wrote while the member inserts
-- above named their team, with the same values (20261105210000_mir21b_writers_write_membership.sql
-- :348-362). Before the entries below: their stamp reads the author's primary team from here.
insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at)
select m.org_id, v.team_id, m.id,
       case when m.role = 'manager'::public.member_role
            then 'manager'::public.team_role else 'member'::public.team_role end,
       m.removed_at is null,
       m.created_at,
       case when m.removed_at is null then null else greatest(m.removed_at, m.created_at) end
  from (values
    ('22222222-2222-4222-8222-222222222222'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('33333333-3333-4333-8333-333333333333'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('66666666-6666-4666-8666-666666666666'::uuid, '44444444-4444-4444-8444-444444444444'::uuid),
    ('77777777-7777-4777-8777-777777777777'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('88888888-8888-4888-8888-888888888888'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('55555555-5555-4555-8555-555555555555'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, '11111111-1111-4111-8111-111111111111'::uuid)
  ) as v(member_id, team_id)
  join public.member m on m.id = v.member_id;
```

The pairs are the seven `team_id` values the member inserts carry today, read at PLAN. Any member
whose `team_id` there is null is left out of the list. The Developer confirms each pair against the
line it replaces and records any difference in `03-impl-log.md`. Comments in `seed.sql` that say the
mirror writes these rows are reworded.

### 4.5 `supabase/bootstrap.sql`

`:201-211` drops `team_id` and `v_team_id,` from the member insert. `org_id = v_org_id` stays. Directly
after it:

```sql
  -- MIR-21-e (ADR-080 decision 3). Admin zero's one active primary row, written here rather than by
  -- the mirror's INSERT branch, which the member insert above no longer reaches. `member` is the team
  -- role: `admin` is not one.
  insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at)
  values (v_org_id, v_team_id, v_uid, 'member'::public.team_role, true, now());
```

The `:213-217` comment (*"No `membership` insert here …"*) is replaced by the one above. `joined_at` is
`now()`, the same instant as the member's defaulted `created_at` inside the one `do` block.

## 5. Seam impact

None. No seam, mock or `src/` file changes.

## 6. Schema delta

`none`. No migration, and no table, column, constraint, policy, trigger, function or grant changes.
The helper of § 4.1 is in the `tests` schema, which exists only inside a pgTAP run.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-081-the-fixtures-of-100-160-and-240-move-to-the-drop.md"
  - ".ai/board/tickets/MIR-21-f/ticket.yaml"
  - "supabase/tests/_isolation.psql"
  - "supabase/tests/120-composite-fks.test.sql"
  - "supabase/tests/140-org-stamping-and-membership-mirror.test.sql"
  - "supabase/tests/150-write-path-org-bound.test.sql"
  - "supabase/tests/190-system-admin.test.sql"
  - "supabase/tests/210-org-public-team-bound.test.sql"
  - "supabase/tests/220-roster-team-from-membership.test.sql"
  - "supabase/tests/230-writers-write-membership.test.sql"
  - "supabase/seed.sql"
  - "supabase/bootstrap.sql"
```

`size: M`, from 12 paths. That is after the split. As ADR-080 allotted it, the work counted 13 files
(240 was missing from its list), which is `L`. ADR-081 moved 100, 160 and 240 to MIR-21-f, which
already edits 100 and 160, and it costs this ticket two paths: the ADR and MIR-21-f's `ticket.yaml`.
`size_estimate` and `size` agree. `glossary_owed` is `[]`, so no glossary row is written.

## 8. Rejected alternatives

- **Inline `insert into public.membership` in every pgTAP file**, the shape 250 and 260 use. It needs
  no helper. Rejected for the changed files: each would restate the mirror's six computed values. A
  fixture that got `joined_at` or `left_at` wrong would silently change INV-04 windows that 140, 150
  and 230 assert. One helper written against the mirror's body is one thing to review.
- **Retire nothing in 140 and 220, and keep the column assertions until MIR-21-f.** Rejected: with
  the fixtures no longer writing the column, 220's AC-1 and AC-2 fail outright, because the column is
  null and the roster team is not. 140's T2 assertion would pass only because the fixture names the
  org, so it would test the fixture.
- **Retire all of 220 AC-1.** That is the literal reading of ADR-080's "AC-1 and AC-2 are retired".
  Rejected for its four roster-team checks (`:70-73`): they never read the column, and they are the
  only direct evidence that admit, move and reject leave the right roster team.
- **Split off `seed.sql` and `bootstrap.sql` as their own ticket**, and the other options ADR-081
  records.

## Changelog

- `2026-11-07T05:10:56Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket and ADR-080 before the source tree was read for 3–8. Reading it found 240,
  which ADR-080 did not list, and that made the count 13 (`L`). ADR-081 moved 100, 160 and 240 to
  MIR-21-f, and § 1 *Out of scope* records it. Reading also showed 140 `:95` tests the team lookup
  through a fixture, so it is retired. And it showed 220 AC-1's four roster checks do not read the
  column, so they are kept (§ 8). Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-081**: the fixtures of pgTAP files 100, 160 and 240 stop naming `member.team_id` in
  MIR-21-f instead of MIR-21-e. This amends ADR-080 decisions 3 and 4's allocation so that MIR-21-e
  is `M`, with no new ticket.
