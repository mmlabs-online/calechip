---
ticket: MIR-21-c
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-06T02:37:30Z
inputs_read:
  - .ai/board/tickets/MIR-21-c/ticket.yaml
  - .ai/board/tickets/MIR-21-b/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-078-writers-write-membership-alongside-the-column-and-the-drop-moves-to-mir-21-c.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20260913090000_solo_avatar_images.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - src/lib/data/supabase.ts
  - tests/roster-excludes-signups.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-21-c — the team lock reaches `membership`, and the seam reads the roster team

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| MIR-21 | `member.team_id` is dropped once every reader has moved to `membership` |

Plan item P3-3, last step (`.ai/board/plans/calechip-multi-tenancy-plan.md:187`).

**This ticket is the third slice of that feature, and the first of four that carry the drop
(ADR-080).** MIR-21 moved the readers and MIR-21-b moved the writers. Done whole, the drop is about
24 paths, which is `L`. Most of those paths are fixtures that break all at once when the column goes.
ADR-080 orders the work so that each slice stays green:

| Slice | What it does |
|---|---|
| MIR-21-c | The team lock reaches `membership`, and the seam reads the roster team. |
| MIR-21-d | Writers stop writing the column, and tests stop reading it. |
| MIR-21-e | Fixtures stop naming the column. |
| MIR-21-f | The column is dropped. |

The ticket's title names the whole drop. It was written before this split, and it is kept, as
MIR-21-b's was.

**Who gains what.** No role gains a capability, and no answer changes. This slice removes two
things that tie the next slice to the column.

- **The lock.** ADR-064 decision 3 says nobody changes their own team by any path. Today that holds
  only because every writer assigns `member.team_id` before it writes `membership`, and a clause on
  that column refuses the change. Once MIR-21-d stops the assignment, the column clause stops firing.
  This slice moves the refusal onto `membership` itself, so it no longer depends on the column
  (ADR-078 decision 6).
- **The seam.** Three seam methods take their `teamId` from the `public.member` row an RPC returns.
  That value is the column. This slice makes them read the roster team, so the column can go stale
  in MIR-21-d without any screen showing a wrong team.

`size_estimate: S`

**Out of scope:**

- **Writers stop assigning `team_id`** (`admit_member`, `reject_member`, `move_member`,
  `set_member_team`, `create-account.sql`). These go to MIR-21-d.
- **Tests that read the column**, in 030, 040, 070, 150, 160, 190 and 230, and the equivalence
  checks: `140`'s `tests.mirror_violations()`, `230` AC-9's column half, and `220` AC-1 and AC-2.
  These go to MIR-21-d and MIR-21-e.
- **Fixtures that insert the column**: `tests.seed()`, the inline fixtures, `seed.sql` and
  `bootstrap.sql`. These go to MIR-21-e.
- **The drop itself.** This covers:
  - the column, `member_team_id_idx` and the column's `update` grant;
  - `public.member_team_id(uuid)`;
  - the mirror's INSERT branch;
  - the column clause of `member_enforce_role_and_removal`;
  - `stamp_org_id`'s team lookup;
  - `member_decide_admin`;
  - `.ai/standards/data-model.md` and `rbac-and-security.md`.

  All of it goes to MIR-21-f.
- **The removal close.** The removal branch of `member_sync_membership` does not name the column.
  It stays exactly as it is, in this slice and through MIR-21-f (ADR-080 decision 4).
- **The column clause of `member_enforce_role_and_removal`.** It is not removed here. During this
  slice both locks fire on a self-move, and they raise the same message.
- **The mock** (`src/lib/data/mock.ts`). It has no column, and it already returns the team it holds.

## 2. Acceptance criteria

**Fixtures.** Insert these as the table owner, before any authenticate. No fixture names
`member.team_id` (ADR-080 decision 5).

- Teams T1 and T2 are inserted with no `org_id`, so `stamp_org_id` puts them in the shared tenant
  O. Each member is inserted with no `team_id` and no `org_id`, so it lands in O too. Each member's
  `membership` rows are then inserted directly.
- Members:
  - A — admin, approved; active primary row on T1, `team_role` `member`
  - M — member, approved; active primary row on T1
  - R — member, approved; active primary row on T1
  - W — member, approved; active primary row on T1
  - X — member, approved; active primary row on T1

"Claims name P" means `request.jwt.claims` is `{"sub": P, "role": "authenticated"}` while the
session role is still the table owner. That is the state a `security definer` function runs in when
P calls it. "Signed in as P" means `tests.authenticate_as(P)`.

**AC-1 — A write to the caller's own `membership` row is refused, whatever the statement**
- Given claims name X
- When the session runs each of these statements:
  - inserts a non-primary `membership` row for X on T2;
  - updates X's T1 row (`set updated_at = now()`);
  - deletes X's T1 row
- Then each raises `42501` with the message `a person may not change their own role, status or team`
- And X's `membership` rows are identical before and after, in count and in every column

**AC-2 — Writes to another person's rows pass, and so do owner writes**
- Given claims name A
- When the session inserts a non-primary row for X on T2, then updates it, then deletes it
- Then each statement succeeds
- And when the claims are cleared (`tests.clear_authentication()`, so `auth.uid()` is null), the
  same three statements on X's rows also succeed

**AC-3 — The definer writers work as before for a person other than the caller**
- Given A is signed in
- When A calls `set_member_role(M, 'manager')`
- And then A calls `move_member(M, T2)`
- And then A removes W (`update public.member set removed_at = now() where id = W`)
- Then each call succeeds
- And M has exactly one active primary row, on T2, with `team_role` `manager`, and M's T1 row is
  closed
- And W has no active row, and every closed row of W has
  `left_at = greatest(removed_at, joined_at)` and `is_primary` false

**AC-4 — Moving oneself is still refused with ADR-064's message**
- Given A is signed in
- When A calls `move_member(A, T2)`
- Then it raises `42501` with the message `a person may not change their own role, status or team`
- And A's `membership` rows are identical before and after

**AC-5 — The lock is a row trigger on `membership`, and clients cannot call its function**
- Given the migration is applied
- When `pg_trigger` and `pg_proc` are read
- Then `public.membership` has a trigger named `membership_refuse_own_rows`, and it is enabled
- And `pg_get_triggerdef` for that trigger contains `BEFORE`, `INSERT`, `UPDATE`, `DELETE` and
  `FOR EACH ROW`
- And `public.membership_refuse_own_rows()` has `prosecdef` false
- And neither `anon` nor `authenticated` holds `EXECUTE` on it

**AC-6 — The three row-returning RPCs carry the roster team when read the seam's way**
- Given A is signed in, and R is on T1
- When A runs each of these, in this order:
  - `select public.roster_team_id(r) from public.set_member_role(R, 'manager') r`
  - `select public.roster_team_id(r) from public.set_member_team(R, T1) r`
  - `select public.roster_team_id(r) from public.promote_member_to_admin(R) r`
- Then each returns T1

R's row was inserted with no `team_id`, so a T1 here cannot have come from the column.

**AC-7 — The seam asks for the computed field on all three calls**
- Given `src/lib/data/supabase.ts`
- When the unit test reads its source
- Then each of `rpc("set_member_role"`, `rpc("set_member_team"` and `rpc("promote_member_to_admin"`
  is followed by `.select(MEMBER_COLUMNS)` before the statement ends
- And `MEMBER_COLUMNS` contains `team_id:roster_team_id`
- And `setMemberRole`, `setMemberTeam` and `promoteMember` keep their signatures, and the
  seam-parity test passes unchanged

**AC-8 — A confirmed sign-up is admitted as before, and the trigger no longer names the column**
- Given the session is the table owner
- When an `auth.users` row S is inserted with an email and `email_confirmed_at = now()`
- Then `public.member` has a row S, with `status` `pending` and `role` `member`
- And S has no `membership` row, and `member_roster_team_id(S)` is null
- And the `prosrc` of `public.admit_allow_listed_member()` does not match `\mteam_id\M`

**AC-9 — Every existing test passes unedited**
- Given the migration is applied
- When `pnpm db:test` and the unit suite are run
- Then every file other than the two this ticket adds passes, with no edit
- This includes `220` AC-1, which proves the column still equals the roster team, and `230` AC-7,
  which proves the column lock still answers first
- The `170` test 42 failure, which MIR-21-b recorded on the baseline, is excepted if it is still
  present on `origin/main`

**Invariants touched:**

- **INV-04.** "Whose member was still on that team on that date" is read from `membership`'s
  `joined_at` and `left_at`. The new trigger sits in front of every write to those columns. AC-3
  holds the admit, move, rank and removal writes to what they write today.
- **INV-07.** "Every team that member belongs to" is the set of active `membership` rows. The
  trigger refuses only a write to the caller's own rows (AC-1). AC-2 and AC-3 hold every other write
  as it is.

**Open questions.** None. The lock's message and errcode are ADR-064's
(`20261020120000_mir02_member_self_writes.sql:61-67`). The seam's field is ADR-077's
`MEMBER_COLUMNS` (`supabase.ts:983-984`). The split is ADR-080.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

No screen changes in this ticket. There is no layout to specify.

## 3. Permission model

No role gains or loses a permission. Every check stays in the database (ADR-005).

| Action | Who may | Who may not |
|---|---|---|
| Insert, update or delete a `membership` row, through any definer function or owner script | the owner, with no user token; a definer function acting on someone other than its caller | anybody whose JWT `sub` is the row's `member_id` (AC-1, AC-4) |
| `public.membership`, directly | nobody holding a user token (unchanged, `mir11:204`) | `authenticated`, `anon` |
| `public.membership_refuse_own_rows()` | the trigger only | `public`, `anon`, `authenticated` (AC-5) |
| `set_member_role`, `set_member_team`, `promote_member_to_admin`, `move_member`, `admit_member`, `reject_member` | unchanged (MIR-21-b § 3) | unchanged |

**Where the check lives.** The trigger is `security invoker`. It reads `auth.uid()`, and that reads
the request's JWT claims. So inside a definer function the trigger still sees the caller, which is
the property the column clause relies on (`mir02:52-54`). A user token cannot reach `membership`
directly, so in practice the trigger fires only under definer functions and owner scripts.

**Order on a self-move during this slice.** `move_member` assigns the column first. The column
clause raises before `membership_make_primary` runs, so AC-4 meets the column clause. Once MIR-21-d
removes the assignment, the same call meets this trigger, with the same message.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261106130000_mir21c_membership_self_lock.sql`

- It is **idempotent** (ADR-024): `create or replace` for each function, and
  `drop trigger if exists` before the trigger, inside `begin; … commit;`.
- Applying it to a hosted database is human (RULE-09).

**The lock** (ADR-080 decision 1; ADR-078 decision 6):

```sql
-- ADR-064 decision 3, on `membership` (ADR-080 decision 1). Nobody holding a user token writes their
-- own membership rows, by any path. `security invoker`: `auth.uid()` reads the request's claims, so
-- inside a definer function it is still the caller. A null uid is the owner, a migration or a script.
create or replace function public.membership_refuse_own_rows() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null then
    if tg_op in ('INSERT', 'UPDATE') then
      if new.member_id = v_uid then
        raise exception 'a person may not change their own role, status or team'
          using errcode = '42501';
      end if;
    end if;
    if tg_op in ('UPDATE', 'DELETE') then
      if old.member_id = v_uid then
        raise exception 'a person may not change their own role, status or team'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.membership_refuse_own_rows() from public, anon, authenticated;

drop trigger if exists membership_refuse_own_rows on public.membership;
create trigger membership_refuse_own_rows
  before insert or update or delete on public.membership
  for each row execute function public.membership_refuse_own_rows();
```

It is `security invoker`, so it stays outside `010-catalogue.test.sql`'s definer census. It returns
`trigger`, so it stays outside that file's `anon` check. 010 does not change.

**The sign-up trigger.** Re-create `public.admit_allow_listed_member()` from its latest definition,
`20260913090000_solo_avatar_images.sql:46-81`. Keep it character for character, with one change:
the insert names `(id, display_name, avatar, role)` and drops the `null` value. The column takes
its default, which is null, so the row it inserts is the same row as today. Reword the comment line
that says `` `team_id` is left NULL `` to say the team is never written here, citing ADR-080. Keep
its `security definer set search_path = extensions` and its exception handler as they are. The
trigger that points at the function is not touched.

### 4.2 Seam — `src/lib/data/supabase.ts`

Make three calls, each chained with `.select(MEMBER_COLUMNS)`, then `.single<MemberRow>()`:

| Where | Becomes |
|---|---|
| `setRankThroughRpc`, `:1216-1219` | `client().rpc("set_member_role", { p_member_id: memberId, p_role: role }).select(MEMBER_COLUMNS).single<MemberRow>()` |
| `setMemberTeam`, `:1842-1845` | `client().rpc("set_member_team", { p_member_id: memberId, p_team_id: teamId }).select(MEMBER_COLUMNS).single<MemberRow>()` |
| `promoteMember`, `:1858` | `client().rpc("promote_member_to_admin", { p_member_id: memberId }).select(MEMBER_COLUMNS).single<MemberRow>()` |

Nothing else in the three bodies changes. The `error` mapping, the `isMemberRow` guard, the
refusal sentences and `toMember` all stay as they are. Add a comment beside each call that cites
ADR-080 decision 1: the column is about to go stale, so `team_id` is the roster team.

**Why the roster team is right here.** PostgREST evaluates the computed field over the returned row.
None of these three functions changes a team: `set_member_team` accepts only the current roster team
(`mir21b:187-209`). So the roster team is the same whichever snapshot reads it.

`.single()` is there so the body is always one object, whatever PostgREST does with `select=` on a
function that returns one composite row. **TODO(verify):** confirm that `.rpc(...).select(...)` and
`.single()` chain in the installed `@supabase/postgrest-js`, and that a computed field resolves over
a non-`setof` function's result. `listAllMembers` (`:2438-2441`) is the precedent for `setof` only.
If either fails, route the question to `tech-lead-design`. Do not improvise another shape.

### 4.3 Unit test — `tests/member-rpc-roster-team.test.ts`

This is a source-text test, the shape `tests/roster-excludes-signups.test.ts:54` uses. It reads
`src/lib/data/supabase.ts` and asserts AC-7:

- For each of the three RPC names, the text from `.rpc("<name>"` to the next `;` contains
  `.select(MEMBER_COLUMNS)`.
- The `MEMBER_COLUMNS` declaration contains `team_id:roster_team_id`.

Use one `it` per name. Each `it` name says which AC it covers.

### 4.4 pgTAP — `supabase/tests/250-membership-self-lock.test.sql`

This is a new file, using the fixtures of § 2.

- It defines its ids with a local `tests.m21c(text)` helper, in the style of `230`'s `tests.m21b`.
- It finds the shared tenant's id with `(select o.id from public.org o where o.is_shared_tenant)`.
- "Claims name P" is
  `select set_config('request.jwt.claims', json_build_object('sub', P, 'role', 'authenticated')::text, true);`
  with no role change.
- Write one assertion block per AC, from AC-1 to AC-8.
- AC-1 and AC-4 compare `membership` rows before and after with `results_eq` over every column.
- **No line in this file names `member.team_id`, and no `insert into public.member` names
  `team_id`** (ADR-080 decision 5). Record a `grep` of the file in `03-impl-log.md`.

AC-9 is the suite run. Record it in `03-impl-log.md`.

**If an existing test fails, it is a defect in this contract.** One way that could happen: a fixture
writes `membership` for the person whose claims are set. Route it to `tech-lead-design`, and do not
edit the test.

## 5. Seam impact

The bodies of three seam methods change: `setMemberRole` (through `setRankThroughRpc`),
`setMemberTeam` and `promoteMember`. None is added, removed or re-signed. The mock is unchanged.
Each of the three still returns `Result<Member>`, and `teamId` now comes from `roster_team_id`.
That value equals the column today (`220` AC-1).

## 6. Schema delta

**Not `none`.** The migration makes these changes:

- It adds one trigger function, `public.membership_refuse_own_rows()`.
- It adds one row trigger on `public.membership`.
- It rewrites one trigger function, `public.admit_allow_listed_member()`. It inserts the same row as
  before.

It changes no table, column, constraint, policy or grant on a table. Under ADR-014 a trigger is a
schema delta.

Covered by [ADR-080](../../../registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md)
decision 1, within ADR-078 decision 6 and ADR-064 decision 3. `requires_adr: true`.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md"
  - ".ai/board/tickets/MIR-21-d/ticket.yaml"
  - ".ai/board/tickets/MIR-21-e/ticket.yaml"
  - ".ai/board/tickets/MIR-21-f/ticket.yaml"
  - ".ai/board/tickets/MIR-16/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - ".ai/board/tickets/MIR-19/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "supabase/migrations/20261106130000_mir21c_membership_self_lock.sql"
  - "supabase/tests/250-membership-self-lock.test.sql"
  - "src/lib/data/supabase.ts"
  - "tests/member-rpc-roster-team.test.ts"
```

Twelve paths, so `size: M`.

- **The board paths are written at this PLAN.**
  - ADR-080 is new.
  - `MIR-21-d`, `-e` and `-f` are created at `BACKLOG`, and each carries its scope from ADR-080.
  - The four dependants gain `MIR-21-d`, `MIR-21-e` and `MIR-21-f` in `depends_on` (ADR-080
    decision 6).

  Nothing further is owed on any of them at IN_PROGRESS.
- `supabase.ts` is limited to the three calls of § 4.2 and their comments.
- `glossary_owed` is `[]`. No glossary row is owed.
- **`size_estimate` (S) and `size` (M) disagree.** The work is four paths. The other eight are the
  board overhead of the split. The verdict, `M`, stands (ADR-012).
- Numbers checked against all 169 remote branches on 2026-11-06: ADR-080, `250-*`, migration
  `20261106130000` and tickets `MIR-21-d` to `-f` are unused.

## 8. Rejected alternatives

- **Writers stop assigning the column in this slice too.** Rejected. It adds `create-account.sql`
  and five tests that read the column after a writer. With the board overhead that is about fifteen
  paths, which is `L` (ADR-080 *Options*).
- **Put the lock inside `membership_make_primary` instead of a trigger.** It is smaller: one helper,
  no new trigger. Rejected, because it covers one path, and ADR-064 decision 3 says "by any path".
  `set_member_role` and `promote_member_to_admin` update `team_role` directly
  (`mir21b:246`, `:281`). So does the mirror's removal branch. Any later writer would be unguarded
  until somebody remembered.
- **An RLS policy on `membership` that refuses the caller's own rows.** Rejected. The writers are
  definer functions owned by the table owner, and the owner bypasses RLS unless the table forces it.
  Forcing it would put every owner script and migration under a policy written for user tokens.
- **The seam re-reads the member through `.from("member").select(MEMBER_COLUMNS)` after each RPC.**
  Rejected. It costs two round trips for one action. It also leaves a window between the write and
  the read, and the change it is meant to show could be overtaken in that window.
- **Change the three functions to return the roster team themselves.** For example, a new return
  type, or `team_id` overwritten in `v_row`. Rejected. A changed return type is a changed RPC
  contract, which every caller must follow. Overwriting a column of a `public.member` row with a
  value from another table makes the row lie about itself.

## Delegated decisions

- **ADR-080** splits the drop of `member.team_id` into four slices, MIR-21-c to MIR-21-f, and adds
  MIR-21-d to -f to the four dependants' `depends_on`. It supersedes nothing. It was written under
  ADR-067 because it re-allocates ADR-078 decision 5 and extends decision 7.

## Changelog

- `2026-11-06T02:37:30Z` — sections 1 to 8 written. Raised by `tech-lead-design`.
  - **Order.** The split had to be chosen before the ACs, so the source was read first, as it was
    for MIR-21-b. ADR-078's own count (about 20 paths) did not include `230`, which MIR-21-b added,
    or `rbac-and-security.md`. The count turned on which tests read the column, which insert it, and
    which do both.
  - **Departures from `mir_detail`.** `mir_detail` listed the whole drop. ADR-080 gives most of it to
    MIR-21-d to -f. `member_decide_admin`, `stamp_org_id`'s team lookup and the column's
    `update` grant all go to MIR-21-f. `admit_allow_listed_member`'s column list stays here, because
    it costs no path.
