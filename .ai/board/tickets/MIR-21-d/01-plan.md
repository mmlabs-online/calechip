---
ticket: MIR-21-d
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-07T04:15:39Z
inputs_read:
  - .ai/board/tickets/MIR-21-d/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md
  - .ai/templates/plan.md
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261106130000_mir21c_membership_self_lock.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/create-account.sql
  - supabase/tests/030-member-reads.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-21-d — writers stop writing `member.team_id`, and no test reads it

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:310`):

| ID | Feature | Group |
|---|---|---|
| MIR-21 | `member.team_id` is dropped once every reader has moved to `membership` | MIR |

**ADR-080 decision 2, the slice this ticket ships:** *"MIR-21-d: writers stop writing the column, and
tests stop reading it. `admit_member`, `reject_member`, `move_member` and `set_member_team` stop
assigning `team_id`, and so does `create-account.sql`. Every test that reads the column reads
`member_roster_team_id(id)` instead: 030, 040, 070, 150, 160, 190 and 230. The tests that assert the
column is true are retired: `140`'s `tests.mirror_violations()` and `230` AC-9's column half."*

**Who gains what.** Nobody sees a change on a screen. The gain is for the next two slices: after this
ticket the column is written only by fixture inserts and read for an answer by nothing, so MIR-21-e
can stop the fixtures naming it and MIR-21-f can drop it. It also makes MIR-21-c's lock on
`membership` the only thing between an admin and moving themselves. Before this ticket the column
clause in `member_enforce_role_and_removal` refused first.

`size_estimate: M`. One migration that replaces four functions, one new pgTAP file, one script, and
eight changed pgTAP files.

**Out of scope — and where each goes:**

- **Fixtures that insert the column**: `tests.seed()`, the inline fixtures of 100, 120, 140, 150,
  160, 190, 210, 220 and 230, plus `seed.sql` and `bootstrap.sql`. Also `220` AC-1 and AC-2. All
  **MIR-21-e** (ADR-080 decision 3).
- **The drop** of the column, `member_team_id_idx`, the column's grant, `public.member_team_id(uuid)`,
  the mirror's INSERT branch, the column clause of `member_enforce_role_and_removal`, `stamp_org_id`'s
  team lookup and `member_decide_admin`. All **MIR-21-f** (decision 4).
- **The catalogue and self-lock tests that name the column** (010, 100, 110), and 040's catalogue
  half. These are **MIR-21-f**. This ticket changes only 040's *reads* of the column.
- **`set_member_role`, `promote_member_to_admin`, `delete_team`, `grant_system_admin`**. None of them
  assigns the column today (MIR-21-b), so they are unchanged.
- **The seam** (`src/lib/data/supabase.ts`) and the mock. MIR-21-c already moved the seam onto
  `roster_team_id`, and the mock does not model the column.
- **`.ai/standards/data-model.md`, `rbac-and-security.md`**. A standards edit, human-only, in MIR-21-f.

## 2. Acceptance criteria

Throughout: **O1** is an org holding teams **T1** and **T2**. **A** is an approved admin on T1.
**M** is an approved member on T1. **P1** and **P2** are pending in O1, with no `membership` row. AC-1
to AC-6 are observed as the caller, against the database. No criterion below reads `member.team_id`
(ADR-080 decision 5).

**AC-1 — admitting a sign-up still puts them on the team**
- Given A is signed in
- When A calls `admit_member(P1, T1)`
- Then P1's status is `approved`, `member_roster_team_id(P1)` is T1, and P1 has exactly one active,
  primary `membership` row, on T1

**AC-2 — rejecting a sign-up still rejects them and puts them on no team**
- Given A is signed in
- When A calls `reject_member(P2)`
- Then P2's status is `rejected`, `member_roster_team_id(P2)` is null, and P2 has no `membership` row

**AC-3 — moving a member still moves them**
- Given A is signed in
- When A calls `move_member(M, T2)`
- Then `member_roster_team_id(M)` is T2, M's T1 row is closed and not primary, and M's only active row
  is T2, primary

**AC-4 — `set_member_team` still returns the member on their own team, and refuses any other**
- Given A is signed in and M is on T1
- When A calls `set_member_team(M, T1)`, then `set_member_team(M, T2)`
- Then the first returns M's row, and `roster_team_id` of that row is T1. The second is refused with
  `42501`. M's `membership` rows are unchanged by both calls

**AC-5 — an admin still cannot move themselves, and the lock on `membership` is now the one that
answers**
- Given A is signed in
- When A calls `move_member(A, T2)`
- Then it is refused with `42501` and the message `a person may not change their own role, status or
  team`, and every `membership` row is unchanged

**AC-6 — no writer assigns the column**
- When the source of `admit_member`, `reject_member`, `move_member` and `set_member_team` is read from
  the catalogue
- Then no body contains an assignment of `team_id` (`\mteam_id\s*=`). `p_team_id` does not match
  `\m`

**AC-7 — `create-account.sql` approves without the column**
- Given `calechip.new_approved` is `yes` and there is exactly one team
- When the script runs
- Then its `update public.member` sets `status` only, and `membership_make_primary` still writes the
  primary row. This is checked against the source text and recorded in `03-impl-log.md`, as MIR-21-b
  AC-14's second half was

**AC-8 — no test in scope reads the column**
- When 030, 040, 070, 140, 150, 160, 190 and 230 are read
- Then none reads `member.team_id` for an answer. Each such read now reads `member_roster_team_id(id)`,
  or the assertion is retired as § 4.4 says. Fixture `insert`s that name the column are untouched
  (MIR-21-e)

**Invariants touched.** `[]`. No entry path, count or window changes. INV-04 (a removed member stops
counting) is carried by `membership.left_at`, written by the mirror's removal branch. This ticket does
not touch that branch.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

There is no new permission and no change to who may call what. Every refusal is the one MIR-21-b
shipped, kept on the server side of the boundary, inside the same `security definer` bodies:

| Caller | `admit_member` / `reject_member` | `move_member` | `set_member_team` |
|---|---|---|---|
| Admin, same org | ✅ pending, no roster team | ✅ approved, not removed, on a roster team | ✅ own roster team only |
| Admin, own id | n/a (an admin is not pending) | ❌ 42501, **now raised by `membership_refuse_own_rows`** (AC-5) | ✅ returns own row, writes nothing |
| Admin, other org | ❌ 42501 | ❌ 42501 | ❌ 42501 |
| Member / manager | ❌ 42501 | ❌ 42501 | ❌ 42501 |

**What changes:** a self-move used to be refused first by the column clause of
`member_enforce_role_and_removal`. It is now refused only by MIR-21-c's `membership` trigger, with the
same message and SQLSTATE. The tests assert that refusal (AC-5, and 230's existing AC-7 self-move
case).

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql`

Idempotent (ADR-024). Wrapped in `begin; … commit;`. Every body is the latest definition
(`20261105210000_mir21b_writers_write_membership.sql` § 2), changed only as stated. Each keeps its
name, signature, return type, volatility, `security definer` and `set search_path = ''`, so
`create or replace` keeps its grants. No table, column, constraint, policy, trigger or grant changes.

```sql
-- admit_member(p_member_id uuid, p_team_id uuid) returns void
--   :125-126 becomes
  update public.member
     set status = 'approved'::public.member_status
   where id = p_member_id
     and public.member_roster_team_id(id) is null
     and status = 'pending'::public.member_status
     and org_id = public.member_org_id((select auth.uid()));
--   everything else verbatim, including `perform public.membership_make_primary(p_member_id, p_team_id);`

-- reject_member(p_member_id uuid) returns void
--   :146-147 becomes
  update public.member m
     set status = 'rejected'::public.member_status
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) is null
     and m.status = 'pending'::public.member_status
     and m.org_id = public.member_org_id((select auth.uid()));

-- move_member(p_member_id uuid, p_team_id uuid) returns void
--   the `update public.member m set team_id = p_team_id where …` (:170-176) becomes an existence
--   check with the SAME five predicates and the SAME refusal:
  if not exists (
    select 1 from public.member m
     where m.id = p_member_id
       and public.member_roster_team_id(m.id) is not null
       and m.status = 'approved'::public.member_status
       and m.removed_at is null
       and m.org_id = public.member_org_id((select auth.uid()))
  ) then
    raise exception 'that person cannot be moved' using errcode = '42501';
  end if;

  perform public.membership_make_primary(p_member_id, p_team_id);

-- set_member_team(p_member_id uuid, p_team_id uuid) returns public.member
--   the `update … set team_id = p_team_id … returning m.* into v_row` (:197-202) becomes
  select m.* into v_row
    from public.member m
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and p_team_id = public.member_roster_team_id(m.id);
--   followed by the unchanged `if not found then raise … '42501'` and `return v_row;`
```

The file header states, citing ADR-080 decision 2, two facts. The column is stale from here on for
anybody admitted, rejected or moved. And the self-move refusal is now `membership_refuse_own_rows`'s.

### 4.2 pgTAP — `supabase/tests/260-writers-stop-writing-team-id.test.sql`

One file, one `plan(n)`. It uses `\ir _isolation.psql` and its own fixture, in the shape of
`250-membership-self-lock.test.sql`. Labels come from a helper `tests.m21d(text)`, with ids
`c2600000-0000-4000-8000-0000000000nn`. Per ADR-080 decision 5, **members are inserted without
`team_id`, and their `membership` rows are inserted directly** (`org_id`, `team_id`, `member_id`,
`team_role`, `is_primary`). The fixture is O1 with T1 and T2; A, admin on T1; M, member on T1; and P1
and P2, pending with no `membership` row. Assertions:

- **AC-1 to AC-5**, one block each, with the observations their *Then* names. AC-5 uses `throws_ok`
  with the exact message, and compares a `membership` digest before and after (the shape of
  `tests.m21b_ms`).
- **AC-6**: `is(count of the four bodies matching '\mteam_id\s*=', 0)`, read from `pg_proc` by name.
  The file names `team_id` only inside that regex and in `membership` columns. It never reads
  `member.team_id`.

### 4.3 `supabase/create-account.sql`

`:152-155` becomes `update public.member set status = 'approved'::public.member_status where id = v_id;`.
The comment at `:150-151` is reworded: "the one column `decideMember`'s RPC still writes". The comment
at `:21` keeps "with a null `team_id`", which stays true.

### 4.4 Changed pgTAP — reads move to the roster team

The rule: every read of `public.member.team_id` that decides an assertion becomes
`public.member_roster_team_id(<member id>)`. `plan(n)` is unchanged unless an assertion is retired.
The reads found at PLAN:

| File | Lines | Change |
|---|---|---|
| `030-member-reads.test.sql` | `:12`, `:33`, `:60`, `:76` | the expected-set queries' `where team_id = …` / `team_id is null` become `where public.member_roster_team_id(id) = …` / `… is null` |
| `040-member-self-writes.test.sql` | `:43`, `:80` | the `team_id` column of the selected tuple becomes `public.member_roster_team_id(id)` |
| `070-definer-callers.test.sql` | `:62`, `:70` | the same |
| `140-org-stamping-and-membership-mirror.test.sql` | `:33-39`, `:225`, `:236`, `:253`, `:264`, `:285`, `:307`; `:178` | **retired**: `tests.mirror_violations()` and its six `is(…)` are deleted and `plan(n)` drops by 6. `:178`'s `team_id` becomes `public.member_roster_team_id(id)`. The header comment (`:1-3`) stops saying the table mirrors the column |
| `150-write-path-org-bound.test.sql` | `:128`, `:133` | roster team |
| `160-read-path-org-bound.test.sql` | `:95`, `:108` | `where team_id = …` becomes `where public.member_roster_team_id(id) = …` |
| `190-system-admin.test.sql` | `:129` | `m.team_id = …` becomes `public.member_roster_team_id(m.id) = …` |
| `230-writers-write-membership.test.sql` | `:40-48`; `:230`, `:249`, `:331` | **column half retired**. `tests.m21b_drift()` loses its `member_roster_team_id(m.id) is distinct from m.team_id` disjunct. Its last disjunct reads `public.member_roster_team_id(m.id) is not null` in place of `m.team_id is not null`, so the "at most one / exactly one active primary" half stays. `:249`'s assertion becomes `is(public.member_roster_team_id(tests.m21b('m')), tests.m21b('t2'), 'AC-2: M''s roster team is T2')`. `:230` and `:331` read the roster team. The header (`:1-2`) drops "the column stays equal to the roster team" |

A read the Developer finds beyond this table follows the same rule and is listed in `03-impl-log.md`.
Fixture `insert into public.member (… team_id …)` statements are not reads and are not touched.

## 5. Seam impact

None. No `DataSeam` or `SystemSeam` function changes. The three row-returning RPCs
(`set_member_role`, `set_member_team`, `promote_member_to_admin`) still return `public.member`. The
seam reads that row's `team_id:roster_team_id` (MIR-21-c), so the now-stale column reaches no screen.
The mock does not model the column.

## 6. Schema delta

**Not `none`.** One migration replaces four `security definer` function bodies (§ 4.1). No table,
column, constraint, index, policy, trigger or grant changes, and no data is rewritten.
**ADR-080** decision 2 is the decision. It is accepted, so no new ADR is needed. Applying the migration to the hosted
project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql"
  - "supabase/tests/260-writers-stop-writing-team-id.test.sql"
  - "supabase/create-account.sql"
  - "supabase/tests/030-member-reads.test.sql"
  - "supabase/tests/040-member-self-writes.test.sql"
  - "supabase/tests/070-definer-callers.test.sql"
  - "supabase/tests/140-org-stamping-and-membership-mirror.test.sql"
  - "supabase/tests/150-write-path-org-bound.test.sql"
  - "supabase/tests/160-read-path-org-bound.test.sql"
  - "supabase/tests/190-system-admin.test.sql"
  - "supabase/tests/230-writers-write-membership.test.sql"
```

`size: M`, from 11 paths. `size_estimate` and `size` agree, and both match ADR-080's prediction of
"about eleven". `glossary_owed` is `[]`, so no glossary row is written. No new function is added, so
`010-catalogue.test.sql`'s definer census is unchanged and stays out.

## 8. Rejected alternatives

- **Assert the column is left unchanged (null) after each writer.** This is the most direct evidence
  that the writers stopped. Rejected: ADR-080 decision 5 forbids a new test that names
  `member.team_id`, and MIR-21-f would have to delete the assertion again. AC-6 reads the function
  bodies instead, and AC-1 to AC-4 show the observable behaviour is unchanged.
- **Keep `move_member`'s `update public.member` as a no-op touch** (`set status = status`) so a member
  write still happens. It would keep `member_enforce_role_and_removal` on the path. Rejected: a
  self-move then meets no column clause anyway, because the team does not change. The touch would buy
  nothing except an `updated`-row side effect for a trigger that no longer decides anything.
- **Rewrite `tests.mirror_violations()` against the roster team** instead of retiring it. Rejected:
  ADR-080 decision 2 names it for retirement. Its "exactly one when on a team" half is circular once
  the roster team is itself read from `membership`. 230's `m21b_drift` keeps the non-circular "at most
  one active primary" check.

## Changelog

- `2026-11-07T04:15:39Z`: all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket and ADR-080 before the source tree was read for 3–8. Reading it added AC-5:
  the column clause no longer answers a self-move, so the remaining lock must be asserted. It also
  added AC-4's "writes nothing", because `set_member_team` changes from an `update` to a `select`.
  Amended by `tech-lead-design`.
