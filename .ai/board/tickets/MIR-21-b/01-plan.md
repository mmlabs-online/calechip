---
ticket: MIR-21-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-05T13:24:22Z
inputs_read:
  - .ai/board/tickets/MIR-21-b/ticket.yaml
  - .ai/board/tickets/MIR-21/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md
  - .ai/registry/decisions/ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20260913090000_solo_avatar_images.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261105180000_mir15_org_public_team_bound.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/create-account.sql
  - src/lib/data/supabase.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-21-b — the writer slice: every writer writes `membership` directly

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| MIR-21 | `member.team_id` is dropped once every reader has moved to `membership` |

Plan item P3-3, last step (`.ai/board/plans/calechip-multi-tenancy-plan.md:187`).

**This ticket is the second of three slices of that feature (ADR-078).** MIR-21 moved every reader
onto `membership` and shipped. This ticket moves every **writer**. MIR-21-c drops the column. Done as
one ticket, writers and drop together come to about twenty paths, which is `L`, and `L` must split
(ADR-077 decision 5 foresaw this).

**Who gains what.** No role gains a capability, and no answer changes. Today one trigger,
`member_sync_membership`, copies every change to `member.team_id` and `member.role` into
`membership`. Every admission, move and rank change writes `membership` only through that copy.
This ticket makes each of those functions write `membership` itself. That is the precondition for
dropping the column: once the column is gone, the copy has nothing to copy from. The column is still
written, by the same statements, so it stays equal to the roster team until MIR-21-c drops it
(ADR-078 decision 1).

`size_estimate: M`

**Out of scope:**

- **Dropping** `member.team_id`, `member_team_id_idx`, the column's `update` grant,
  `public.member_team_id(uuid)`, and the mirror's INSERT branch. These go to MIR-21-c.
- **Stopping the column assignments** in `admit_member`, `reject_member`, `move_member` and
  `set_member_team`. They are kept on purpose (ADR-078 decision 1) and go with the drop, in MIR-21-c.
- **Fixtures and tests that name the column**, in `_isolation.psql`, `seed.sql`, `bootstrap.sql` and
  the pgTAP files. They keep working unchanged: the mirror's INSERT branch stays. They go to
  MIR-21-c.
- **`member_decide_admin`.** It is inert for writes since ADR-064 decision 1, and its `with check`
  names the incoming column value, which has no `membership` equivalent. It goes to MIR-21-c.
- **`member_enforce_role_and_removal`'s team clause**, the ADR-064 decision 3 self lock. It still
  fires, because the writers still assign the column. Moving it onto `membership` is MIR-21-c's
  obligation (ADR-078 decision 6).
- **`stamp_org_id`'s `member` branch** and **`admit_allow_listed_member`'s column list.** Both are
  insert paths that still name the column. They go to MIR-21-c.
- **The seam.** No method changes. The three row-returning RPCs still return a true `team_id`,
  because the column stays true. MIR-21-c changes them when the column goes.
- **Removal.** It stays a table PATCH, and its `membership` close stays in the mirror's removal
  branch (ADR-078 decision 3). MIR-21-c gives that close its permanent home.
- **`.ai/standards/data-model.md`.** The column still exists, so the file stays true. It changes in
  MIR-21-c.

## 2. Acceptance criteria

Fixtures, inserted as the table owner before any authenticate. Org O1 holds teams T1, T2 and T4.
Org O2 holds team T3. Members:

- A — admin on T1
- M — member on T1
- R — member on T1
- W — member on T1, removed in AC-8
- V — member on T1, who also holds an active **non-primary** `membership` row on T2, inserted
  directly
- P1, P2 — pending sign-ups in O1, with no team and no `membership` row
- K — admin on T3

Members created with a team get their `membership` row from the mirror's INSERT branch, which this
ticket keeps.

The **mirror invariant**, used below: every member has at most one active primary `membership` row,
and exactly one when `team_id` is not null and `removed_at` is null.

**AC-1 — Admitting a sign-up writes one primary membership row**
- Given A is signed in, and P1 is pending in O1
- When A calls `admit_member(P1, T1)`
- Then P1's `status` is `approved` and `team_id` is T1
- And P1 has exactly one active `membership` row, with these values:
  - `team_id` T1, `org_id` O1, `is_primary` true, `team_role` `member`
  - `left_at` null, `joined_at` the transaction's `now()`
- And `member_roster_team_id(P1)` is T1

**AC-2 — Moving a member closes the old row and opens one on the new team**
- Given A is signed in, and M is on T1
- When A calls `move_member(M, T2)`
- Then M's `team_id` is T2
- And M's T1 row has `left_at` set and `is_primary` false
- And M has exactly one active primary row, on T2, with `team_role` `member`

**AC-3 — Moving onto a team the member already holds promotes that row**
- Given A is signed in, and V holds an active primary row on T1 and an active non-primary row on T2
- When A calls `move_member(V, T2)`
- Then V's existing T2 row becomes `is_primary` true, keeps its `id`, and has `team_role` `member`
- And no new `membership` row is inserted for V
- And V's T1 row is closed

**AC-4 — Moving a member onto their current team changes nothing**
- Given A is signed in, and M has an active primary row on T2 (after AC-2)
- When A calls `move_member(M, T2)`
- Then the call succeeds, as it does today
- And M's `membership` rows are identical before and after, in count and in every column

**AC-5 — A rank change writes the primary row's team role**
- Given A is signed in, and R is a `member` on T1
- When A calls `set_member_role(R, 'manager')`
- Then R's `role` is `manager`, and R's active primary row has `team_role` `manager`
- And when A then calls `promote_member_to_admin(R)`, R's `role` is `admin` and R's active primary
  row has `team_role` `member`

**AC-6 — Rejecting a sign-up writes no membership row**
- Given A is signed in, and P2 is pending in O1
- When A calls `reject_member(P2)`
- Then P2's `status` is `rejected`, `team_id` is null, and P2 has no `membership` row

**AC-7 — The refusals are unchanged, and a refused call writes nothing**

Each call below raises `42501` and leaves every `membership` row unchanged, compared before and after:

- K (admin of O2) calls `admit_member(P1, T1)`, `move_member(M, T3)`, `move_member(M, T1)` and
  `set_member_role(M, 'manager')`
- M (a member) calls `admit_member(P1, T1)`, `move_member(R, T2)` and `set_member_role(R, 'manager')`
- A calls `admit_member` on an approved member, `reject_member` on an approved member,
  `move_member` on a pending sign-up, and `move_member(W, T2)` once W is removed (run after AC-8)
- A calls `move_member(A, T2)`, on A's own id. It raises `42501` with the message
  `a person may not change their own role, status or team`, and A's rows are unchanged
  (ADR-064 decision 3).

**AC-8 — Removal still closes the removed member's rows**
- Given A is signed in, and W is on T1
- When A removes W (`update public.member set removed_at = now() where id = W`, the seam's removal)
- Then W has no active `membership` row
- And every closed row of W has `left_at = greatest(removed_at, joined_at)` and `is_primary` false

**AC-9 — The column stays equal to the roster team, and the mirror invariant holds, after every
writer**
- Given the fixtures, after each of AC-1 to AC-8 in turn
- When `team_id` is compared with `public.member_roster_team_id(id)` for every row of
  `public.member`, and the mirror invariant is counted
- Then every row is `is not distinct from`, and the invariant has zero violations

**AC-10 — The mirror no longer writes on a change of team or rank**
- Given the migration is applied
- When `pg_get_triggerdef` is read for the `member_sync_membership` trigger on `public.member`
- Then it fires `AFTER INSERT OR UPDATE OF removed_at`, and names neither `team_id` nor `role`

**AC-11 — Deleting a team is refused for exactly the teams it is refused for today**
- Given A is signed in
- When A calls `delete_team(T1)`, which has members (W among them, removed)
- Then it raises `23503`, and T1 still exists
- And when A calls `delete_team(T4)`, an empty team, it succeeds
- And when A calls `delete_team(T3)`, K's team in O2, it raises `42501`

**AC-12 — `set_member_team`, `grant_system_admin` and `member_update_admin` are unchanged**
- Given A is signed in, and M is on T1 (before AC-2)
- When A calls `set_member_team(M, T1)`
- Then it returns M's row with `team_id` T1, and M's `membership` rows are unchanged
- And when A calls `set_member_team(M, T2)`, it raises `42501`
- And when A removes K through a table update, zero rows change
- And as the service role:
  - `grant_system_admin` on a pending member with no `membership` row deletes that member and grants
    them a `system_admin` row;
  - `grant_system_admin` on an approved member raises `42501`, and that member's row is unchanged.

**AC-13 — No write-side predicate reads the column**
- Given the migration is applied
- When these bodies are searched:
  - the function bodies of `admit_member`, `reject_member`, `move_member`, `set_member_team`,
    `set_member_role`, `promote_member_to_admin`, `delete_team` and `grant_system_admin`;
  - the `qual` and `with_check` of the `member_update_admin` policy
- Then none contains `m.team_id`, `team_id is`, or `team_id in`
- And every `team_id =` in them is an assignment in a `set` list, or a parameter (`p_team_id`)

**AC-14 — The helper is closed to clients, and `create-account.sql` uses it**
- Given the migration is applied
- When `anon` or `authenticated` calls `public.membership_make_primary(uuid, uuid)`
- Then it is refused with `42501`
- And `supabase/create-account.sql`'s approved branch calls `public.membership_make_primary` after
  its `update public.member`

**Invariants touched:**

- **INV-04.** "Whose member was still on that team on that date" is read from `membership`'s
  `joined_at` and `left_at`. This ticket changes who writes those two columns on admit and move.
  AC-1 to AC-4 and AC-9 hold them to what the mirror wrote.
- **INV-07.** "Every team that member belongs to" is the set of active `membership` rows. The writers
  now produce that set directly, and AC-9 holds it to the column it replaces.

**Open questions.** None. Each written value is the one the mirror writes today
(`20261103120000_mir13_write_path_org_bound.sql:95-161`). The split is ADR-078.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

No screen changes in this ticket. There is no layout to specify.

## 3. Permission model

The permission model does not change. Every check stays in the database, in a definer function's
body or in RLS (ADR-005).

| Action | Who may | Who may not |
|---|---|---|
| `admit_member`, `reject_member`, `move_member` | an admin, on a person in the admin's org | a member or manager; an admin of another org; anyone on their own id (AC-7) |
| `set_member_role`, `promote_member_to_admin`, `set_member_team` | an admin, on a person whose roster team is one of the admin's teams | everyone else; anyone on their own id for a rank change (ADR-064, unchanged) |
| `delete_team` | an admin, on an empty team of the admin's org | everyone else |
| a removal, through `member_update_admin` | an admin, on a person whose roster team is one of the admin's teams | everyone else; an admin on themselves (unchanged trigger clause) |
| `grant_system_admin` | `service_role` only | `authenticated`, `anon` |
| `membership_make_primary(uuid, uuid)` | the owner only: inside a definer function, or an owner-run script | `authenticated`, `anon`, `public` (AC-14) |
| `public.membership`, directly | nobody holding a user token (unchanged, `mir11:204`) | `authenticated`, `anon` |

**The self lock stays where ADR-064 put it.** Every writer here still assigns `member.team_id` or
`member.role` before it touches `membership`, so `member_enforce_role_and_removal` raises first, and
the statement's `membership` writes roll back with it (AC-7).

## 4. Contract

One migration: `supabase/migrations/20261105210000_mir21b_writers_write_membership.sql`.

- It is **idempotent** (ADR-024): `create or replace` for every function, `drop … if exists` before
  every trigger and policy, inside `begin; … commit;`.
- Each rewritten function keeps its name, signature, return type, volatility and
  `security definer set search_path = ''`. `create or replace` therefore keeps its grants.
- Each body is the latest definition (`mir13_write_path_org_bound.sql`, `mir18_system_admin.sql`),
  changed only as stated here.
- Applying it to a hosted database is human (RULE-09).

### 4.1 The helper

```sql
-- ADR-078 decision 2. What the mirror's team-change branch did (mir13_write_path_org_bound.sql
-- :119-140): close the active primary row on another team, then promote an active row on the target
-- team, or open one. A no-op when the target is already the active primary. Owner-only.
create or replace function public.membership_make_primary(p_member_id uuid, p_team_id uuid)
  returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  v_org  uuid;
  v_role public.team_role;
begin
  select m.org_id,
         case when m.role = 'manager'::public.member_role
              then 'manager'::public.team_role else 'member'::public.team_role end
    into v_org, v_role
    from public.member m
   where m.id = p_member_id;

  if exists (select 1 from public.membership ms
              where ms.member_id = p_member_id and ms.team_id = p_team_id
                and ms.left_at is null and ms.is_primary) then
    return;
  end if;

  update public.membership ms
     set left_at = now(), is_primary = false, updated_at = now()
   where ms.member_id = p_member_id
     and ms.left_at is null
     and ms.is_primary;

  update public.membership ms
     set is_primary = true, team_role = v_role, updated_at = now()
   where ms.member_id = p_member_id
     and ms.team_id = p_team_id
     and ms.left_at is null;
  if not found then
    insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at)
    values (v_org, p_team_id, p_member_id, v_role, true, now());
  end if;
end;
$$;
revoke all on function public.membership_make_primary(uuid, uuid) from public, anon, authenticated;
```

It is `security invoker`, so it is outside `010-catalogue.test.sql`'s definer census, and that file
does not change.

### 4.2 Writers

| Function | Change |
|---|---|
| `admit_member(p_member_id uuid, p_team_id uuid)` | The `update`'s `team_id is null` becomes `public.member_roster_team_id(id) is null`. The `set` list is unchanged (`status`, `team_id`). After the `not found` check: `perform public.membership_make_primary(p_member_id, p_team_id);` |
| `reject_member(p_member_id uuid)` | `m.team_id is null` becomes `public.member_roster_team_id(m.id) is null`. The `set` list is unchanged. No `membership` write |
| `move_member(p_member_id uuid, p_team_id uuid)` | `m.team_id is not null` becomes `public.member_roster_team_id(m.id) is not null`. The `set team_id = p_team_id` is unchanged. After the `not found` check: `perform public.membership_make_primary(p_member_id, p_team_id);` |
| `set_member_team(p_member_id uuid, p_team_id uuid)` | `m.team_id in (select public.member_team_ids(…))` becomes `public.member_roster_team_id(m.id) in (…)`, and `p_team_id = m.team_id` becomes `p_team_id = public.member_roster_team_id(m.id)`. The `set` and the `returning` are unchanged. No `membership` write |
| `set_member_role(p_member_id uuid, p_role public.member_role)` | `m.team_id in (…)` becomes `public.member_roster_team_id(m.id) in (…)`. After the `not found` check: `update public.membership ms set team_role = case when p_role = 'manager'::public.member_role then 'manager'::public.team_role else 'member'::public.team_role end, updated_at = now() where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;` |
| `promote_member_to_admin(p_member_id uuid)` | `m.team_id in (…)` becomes `public.member_roster_team_id(m.id) in (…)`. After the `not found` check: `update public.membership ms set team_role = 'member'::public.team_role, updated_at = now() where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;` |
| `delete_team(p_team_id uuid)` | `exists (select 1 from public.member m where m.team_id = p_team_id)` becomes `exists (select 1 from public.member m where public.member_roster_team_id(m.id) = p_team_id)` |
| `grant_system_admin(p_user_id uuid)` | The line `and m.team_id is null` is deleted. Nothing else changes, and it stays `security invoker`, granted to `service_role` only |

The `membership` write comes **after** the `member` update in every writer, and never before it.
That order is what keeps the ADR-064 lock first (§ 3).

### 4.3 Policy

`member_update_admin` on `public.member` keeps `for update to authenticated`.

| Clause | Becomes |
|---|---|
| `using` | `public.is_admin((select auth.uid())) and public.member_roster_team_id(id) in (select public.member_team_ids((select auth.uid())))` |
| `with check` | `public.member_roster_team_id(id) in (select public.member_team_ids((select auth.uid())))` |

`member_roster_team_id` is `stable`, so inside the removal `update` it reads the row as it was at
statement start: active, on its team. `with check` therefore admits the removal exactly as the
column did.

### 4.4 The mirror

`public.member_sync_membership()` keeps its INSERT branch and its removal branch
(`old.removed_at is null and new.removed_at is not null`) **verbatim**. It loses two branches:

- the `if new.team_id is distinct from old.team_id` block;
- the `if new.role is distinct from old.role` block.

The `v_team_role` declaration stays, because the INSERT branch uses it.

```sql
drop trigger if exists member_sync_membership on public.member;
create trigger member_sync_membership
  after insert or update of removed_at on public.member
  for each row execute function public.member_sync_membership();
```

### 4.5 `supabase/create-account.sql`

In the approved branch, directly after `update public.member set team_id = v_team, status = …
where id = v_id;`, add `perform public.membership_make_primary(v_id, v_team);`. Add a comment citing
ADR-078: the mirror no longer writes on a team change. Nothing else in the file changes.

### 4.6 pgTAP — `supabase/tests/230-writers-write-membership.test.sql`

New file, using the fixtures of § 2. Write one assertion block per AC, from AC-1 to AC-14. AC-14's
second half is a source-text check, and pgTAP cannot read a file, so record that half in
`03-impl-log.md` from a `grep`. AC-9 runs after each writer step, over every row of `public.member`,
not only the fixtures.

**One existing test changes, and only its fixture** *(amended 2026-11-05, see Changelog)*:
`supabase/tests/160-read-path-org-bound.test.sql` AC-9, `:263-268`. It writes `member.team_id`
directly as the owner and relied on the mirror's team-change branch, which § 4.4 removes, to open the
`membership` row `event_attendance_guard` reads. The fixture now writes `membership` the way the
writers do:

- after the `update … set status = 'approved', team_id = tests.id('team_t')` at `:265`, add
  `select public.membership_make_primary(tests.id('pending_p'), tests.id('team_t'));`;
- after the `update … set status = 'pending', team_id = null` at `:268`, add
  `update public.membership set left_at = now(), is_primary = false, updated_at = now() where member_id = tests.id('pending_p') and left_at is null;`;
- a comment citing ADR-078 beside each, and the comment at `:263-264` may be reworded to match.

Nothing else in 160 changes: no assertion, no plan count, no other fixture. pending_p ends as it did
before this ticket — one closed row, no active row, `member_roster_team_id` null.

The writers keep assigning the column and the mirror keeps its INSERT branch, so these tests pass as
written:

- `140` AC-9: its `tests.mirror_violations()` reads `m.team_id`, which stays true;
- `220` AC-1 and AC-2;
- `040`'s control at `:80`;
- `070` and `150`'s unchanged-row checks.

If one does fail, it is a defect in this contract. Route it to `tech-lead-design`, and do not edit
the test.

## 5. Seam impact

**None.** No seam function is added, removed, re-signed or edited, and the mock is unchanged.
`setMemberRole`, `setMemberTeam` and `promoteMemberToAdmin` still map the returned row's `team_id`,
which is still true (ADR-078 *Context*).

## 6. Schema delta

**Not `none`.** The migration makes these changes:

- It adds one function.
- It rewrites eight functions and one policy.
- It narrows one trigger and its function.

It changes no table, column or constraint. Under ADR-014 a trigger or policy rewrite is a schema
delta.

Covered by [ADR-078](../../../registry/decisions/ADR-078-writers-write-membership-alongside-the-column-and-the-drop-moves-to-mir-21-c.md),
within ADR-077 decision 5 and ADR-071 decision 2. `requires_adr: true`.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-078-writers-write-membership-alongside-the-column-and-the-drop-moves-to-mir-21-c.md"
  - ".ai/board/tickets/MIR-21-c/ticket.yaml"
  - ".ai/board/tickets/MIR-16/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - ".ai/board/tickets/MIR-19/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "supabase/migrations/20261105210000_mir21b_writers_write_membership.sql"
  - "supabase/tests/230-writers-write-membership.test.sql"
  - "supabase/create-account.sql"
  - "supabase/tests/160-read-path-org-bound.test.sql"
```

Ten paths, so `size: M`.

- `160-read-path-org-bound.test.sql` is limited to its AC-9 fixture at `:263-268`, the two added
  statements and their comments of § 4.6. Added 2026-11-05 at the developer's consultation.

- `MIR-21-c/ticket.yaml` was written at this PLAN. The four other tickets gained `MIR-21-c` in
  `depends_on` at this PLAN (ADR-078 decision 7). Nothing further is owed on any of the five at
  IN_PROGRESS.
- `create-account.sql` gets one added line and a comment (§ 4.5).
- `glossary_owed` is `[]`. No glossary row is owed.
- **`size_estimate` (M) and `size` (M) agree.** The ticket as created was predicted `L`, about
  eighteen paths. That count assumed one slice for the writers and the drop. ADR-078 splits the drop
  off, and keeping the column true is what lets every existing test stand unedited here.
- Numbers checked against every `origin/*` branch on 2026-11-05: ADR-078, `230-*` and migration
  `20261105210000` are unused.

## 8. Rejected alternatives

- **Writers and drop in one ticket.** Rejected: it is about twenty paths, which is `L` (ADR-078
  *Context*).
- **Writers write only `membership`, and stop assigning the column now.** It is simpler, and every
  writer would then be in its final form. Rejected. The column would go stale for everyone admitted
  or moved after this ships. Three seam methods would then show that stale team through `toMember`
  (`supabase.ts:1224`, `:1851`, `:1865`). Fixing them here makes this ticket thirteen paths, `L`, and
  breaks `220` AC-1, `140` AC-9 and `040`'s control besides.
- **Writers write both, with the mirror left whole.** Rejected. On a move, the mirror's team-change
  branch closes the row the writer has just opened and opens another. That leaves two history rows
  for one move, and `joined_at` values a second apart.
- **A `membership` trigger that refuses the caller's own rows, added now.** Deferred to MIR-21-c
  (ADR-078 decision 6). The column lock already fires on every writer here, because each one still
  assigns the column first.
- **Inline the membership logic in each writer instead of one helper.** Rejected. It would make three
  copies of the mirror's rule: `admit_member`, `move_member` and `create-account.sql`. Copies of a
  rule drift, and AC-3 and AC-4 test exactly the edges where they would.

## Delegated decisions

- ADR-078 splits MIR-21-b again: the writers move here and keep the column true, and the drop moves
  to MIR-21-c, which MIR-16, MIR-17, MIR-19 and MIR-20 are now also blocked by. It supersedes
  nothing. It was written under ADR-067 because it re-allocates ADR-077 decision 5 and extends
  decision 6.

## Changelog

- `2026-11-05T13:24:22Z` — sections 1 to 8 written. Raised by `tech-lead-design`.
  - **Order.** The ACs were not all written before the source was read. This slice's shape could not
    be chosen without first counting which files the drop breaks. The count turned on
    `tests.seed()`, the three row-returning RPCs and `create-account.sql`.
  - **Departures from `mir_detail`, all from reading the source:**
    - `member_update_admin` joins the writers; it was missing from the list.
    - `member_decide_admin`, `stamp_org_id` and `admit_allow_listed_member` move to MIR-21-c.
    - `create-account.sql` joins this ticket.
    - The fixture list moves whole to MIR-21-c.
  - **Values.** Every written value is the mirror's, not a new choice.
- `2026-11-05T21:30:27+07:00` — § 4.6 and § 7 amended. Raised by `developer` in `99-questions.md`
  (chat use 1 of 6).
  - **Defect.** § 4.6 claimed no existing test changes. `pnpm db:test` showed
    `160-read-path-org-bound.test.sql` AC-9 fails with this migration (`attendance_not_permitted` at
    `:267`): its fixture writes `member.team_id` directly and relied on the team-change branch § 4.4
    removes. § 4's census of direct column writes in `supabase/tests/**` missed it.
  - **Resolution.** The fixture writes `membership` itself, through `membership_make_primary`, and
    closes it on the way back. No assertion changes. Keeping the mirror's team-change branch was
    rejected: it is § 8's "writers write both" double row.
  - **Size.** Ten paths, still `M`.
  - `170` test 42 fails on the baseline too. It is not this ticket's.
