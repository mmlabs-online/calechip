---
ticket: MIR-21-f
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-07T07:30:13Z
inputs_read:
  - .ai/board/tickets/MIR-21-f/ticket.yaml
  - .ai/board/tickets/MIR-21-d/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md
  - .ai/registry/decisions/ADR-081-the-fixtures-of-100-160-and-240-move-to-the-drop.md
  - .ai/templates/plan.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261023120000_mir09_schema_cleanup.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/110-schema-cleanup.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/240-org-public-holidays.test.sql
  - tests/mock-sql-parity.test.ts
  - src/lib/data/supabase.ts
consulted:
  - developer — 99-questions.md, 2026-11-07T07:42:15Z (070 names member.team_id; § 4.12 added)
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-21-f — `member.team_id`, `member_team_id()` and the mirror's insert branch are dropped

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:310`):

| ID | Feature | Group |
|---|---|---|
| MIR-21 | `member.team_id` is dropped once every reader has moved to `membership` | MIR |

**ADR-080 decision 4, the slice this ticket ships:** *"MIR-21-f: the drop. It drops: the column,
`member_team_id_idx` and the column's `update` grant; `public.member_team_id(uuid)`; the mirror's
INSERT branch; the column clause of `member_enforce_role_and_removal`; `stamp_org_id`'s team lookup;
`member_decide_admin`. It rewrites the catalogue and self-lock tests that name the column (010, 040,
100, 110, 160), and `.ai/standards/data-model.md` and `rbac-and-security.md`. The removal branch of
`member_sync_membership` stays verbatim."* **ADR-081 decision 2** adds: *"MIR-21-f does the same for
the fixtures of 100, 160 and 240, in the same change as its drop."*

**Who gains what.** Nobody sees a change on a screen. After this ticket `public.membership` is the
only place a person's team is recorded, so there is one answer to "which team is this person on"
instead of a live one and a stale one. That is what MIR-16, MIR-17, MIR-19 and MIR-20 are blocked on
(ADR-080 decision 6). It also removes three mechanisms that existed only to keep the column and
`membership` in step: the mirror's INSERT branch, `stamp_org_id`'s team lookup and the inert
`member_decide_admin` policy.

`size_estimate: M`. One migration, one new pgTAP file, seven changed pgTAP files, two standards files.

**Out of scope — and where each goes:**

- **Comments in `src/` and `tests/*.ts` that name `member_team_id` or `member_decide_admin`**
  (`src/hooks/useSession.ts:85`, `src/lib/data/index.ts:354,462,485,956`, `src/lib/data/mock.ts`,
  `src/lib/data/supabase.ts`, several e2e specs). They are prose; nothing runs them. Rewriting them
  is a docs chore, not part of the drop. To `.ai/board/model-debt.md` at `/ship` if the reviewer
  agrees.
- **`150-write-path-org-bound.test.sql:157-160`**, whose label says *"deciding P2 through
  member_decide_admin affects zero rows"*. The assertion (zero rows) stays true after the policy goes:
  no remaining policy admits that update. Only the label goes stale. Not edited here; same chore.
- **`supabase/create-account.sql:21`**, a comment naming `team_id`. Same chore.
- **`.ai/registry/invariants.md:183`**, a dated note (*"the deployed schema gives a member one team
  (`member.team_id`)"*). It is a registry file and a statement about 2026-10-13. Not touched.
- **`tests/mock-sql-parity.test.ts`, `src/lib/data/mock.ts` and the seam.** The shared case table in
  100 keeps every byte (§ 4.4), so the vitest side does not move. The seam already reads
  `team_id:roster_team_id` (MIR-21-c).
- **`supabase/tests/150`, `120`, `140`, `190`, `210`, `220`, `250`, `260`.** They no longer name the
  column in a write or a read (MIR-21-d, MIR-21-e). Their prose comments that mention it are history.
  *`070` is not on this list: its line 118 reads `team_id` off `list_members_for_team`'s
  `setof public.member` rows, which the sweep missed. It is in scope (§ 4.12, Changelog
  2026-11-07T07:42:15Z).*
- **MIR-16, MIR-17, MIR-19, MIR-20.** Unblocked by this ticket, not started by it.

## 2. Acceptance criteria

Throughout: the seed of `supabase/tests/_isolation.psql` (`tests.seed()`), in the shared tenant
**O1**. **A** is `admin_t`, an approved admin on **T1** (`team_t`). **M** is `member_t`, approved on
T1. **T2** is `team_u`. **P** is `pending_p`, pending with no `membership` row. Criteria are observed
against the database after every migration has run. AC-1 to AC-3 read the catalogue; AC-4 to AC-10
are observed as the caller.

**AC-1 — the column, its index and its foreign key are gone**
- Given the migrations have run
- When the catalogue of `public.member` is read
- Then `public.member` has no column `team_id`, no index `member_team_id_idx`, and no foreign key
  that references `public.team`

**AC-2 — `public.member_team_id(uuid)` and `member_decide_admin` are gone**
- Given the migrations have run
- When `pg_proc` and `pg_policies` are read
- Then there is no function `public.member_team_id(uuid)`, and `public.member` has no policy named
  `member_decide_admin`

**AC-3 — the mirror trigger fires only on a removal, and its function has no insert branch**
- Given the migrations have run
- When the definition of trigger `member_sync_membership` on `public.member` and the source of
  `public.member_sync_membership()` are read
- Then the trigger fires `AFTER UPDATE OF removed_at` and not on `INSERT`, and the function source
  does not contain `tg_op` or `team_id`

**AC-4 — inserting a member writes no `membership` row**
- Given an `auth.users` row for a new person Q
- When the table owner inserts `public.member` for Q with no `org_id`
- Then Q's `org_id` is O1 (the shared tenant), and Q has no `membership` row

**AC-5 — a member inserted with an `org_id` keeps it**
- Given an org **O2** that is not the shared tenant, and an `auth.users` row for a new person R
- When the table owner inserts `public.member` for R with `org_id = O2`
- Then R's `org_id` is O2

**AC-6 — admitting and rejecting a sign-up still work**
- Given A is signed in, P is pending, and a second pending person P2 exists in O1
- When A calls `admit_member(P, T1)`, then `reject_member(P2)`
- Then P is `approved` with `member_roster_team_id(P) = T1`, and P2 is `rejected` with
  `member_roster_team_id(P2)` null. Neither call raises

**AC-7 — a person still cannot change their own role, status or team**
- Given A's JWT claims are the request's, and the statement runs as the table owner — the position a
  `security definer` writer is in when it updates the caller's own row
- When `update public.member set role = 'manager' where id = A` runs, then
  `update public.member set status = 'rejected' where id = A`, then (signed in as A)
  `move_member(A, T2)`
- Then each is refused with `42501` and the message `a person may not change their own role, status
  or team`, and A's role, status and every `membership` row are unchanged

**AC-8 — a removal still closes the removed member's rows on the removal day**
- Given A is signed in and M has one active primary `membership` row on T1
- When A sets M's `removed_at`
- Then M's `removed_at` is the statement time (not the supplied value), M's T1 row has
  `left_at = greatest(removed_at, joined_at)` and `is_primary = false`, and
  `member_roster_team_id(M)` is still T1

**AC-9 — a person still edits their own profile, and only their own**
- Given M is signed in
- When M updates their own `display_name`, then A (signed in) updates M's `display_name`
- Then M's update affects one row and is stored trimmed; A's is refused with `42501`

**AC-10 — a table update naming `team_id` is refused and changes nothing**
- Given M is signed in
- When M runs `update public.member set team_id = T2 where id = M`
- Then it raises `42703` (undefined column), and M's row and `membership` rows are unchanged

**AC-11 — the existing suite passes against the dropped schema**
- Given `supabase/tests/` as changed by this ticket (§ 4.3 to § 4.9, and § 4.12)
- When the whole pgTAP suite and the vitest suite run
- Then every test passes, and `100-mock-parity.test.sql`'s case table is byte-identical to its
  pre-ticket content, so `tests/mock-sql-parity.test.ts` passes unchanged

**Invariants touched.**

- **INV-04** — the absence count reads "was still on that team on that date" from `membership`'s
  `left_at`. The removal branch that writes `left_at` is kept verbatim (ADR-078 decision 6); AC-8
  asserts it.
- **INV-07** — after the drop, `membership` is the only record of which teams a member belongs to.
  Nothing reads a second one, so no count can be taken against a stale team.

**Open questions.** None. Every object to drop is named in ADR-080 decision 4; every fixture in
ADR-081 decision 2.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

No permission is added or removed. The checks all stay on the server side, in triggers and
`security definer` bodies:

| Action | Who | Where the check lives | After this ticket |
|---|---|---|---|
| Change own `role` / `status` | nobody with a user token | column revoke (MIR-02), then `member_enforce_role_and_removal` clause on definer paths | unchanged (AC-7) |
| Change own team | nobody with a user token | `membership_refuse_own_rows` (MIR-21-c) | now the **only** lock: the column clause goes with the column (AC-7) |
| Decide a sign-up | admin of the same org | `admit_member` / `reject_member` | unchanged (AC-6) |
| Decide a sign-up by table `update` | — | was `member_decide_admin`, inert since MIR-02 revoked `status`/`team_id` | policy dropped; still impossible, because `status` has no column grant |
| Remove a member | admin of their roster team | `member_update_admin` + trigger | unchanged (AC-8) |
| Write `team_id` by `update` | — | column grant revoked by MIR-02 | the column does not exist (AC-10) |

**Denials kept:** a member or manager calls none of the writers; an admin never moves or re-ranks
themselves; nobody restores or re-dates a removal; nobody edits another person's display name.

**The column's `update` grant** named in ADR-080 decision 4 was already revoked by
`20261020120000_mir02_member_self_writes.sql:163`. The drop takes any column privilege with it, so the
migration has no `revoke` statement (§ 6).

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql`

One transaction (`begin;` … `commit;`). A header comment cites ADR-080 decision 4, ADR-081, and
"Applying this file is human (RULE-09)". The steps run in this order, because each step removes a
dependant of the column before the column goes. **No `cascade` anywhere**: a dependant this plan
missed must fail the migration rather than vanish silently.

1. **`drop policy if exists member_decide_admin on public.member;`** It names the column in `using`
   and `with check` (`20261103120000_mir13_write_path_org_bound.sql:769-786`), so the column cannot
   drop while it exists.

2. **`create or replace function public.member_enforce_role_and_removal()`**. The body is
   `20261020120000_mir02_member_self_writes.sql:45-150`, **copied character for character, comments
   included**, with exactly these changes:
   - the condition of the first clause loses its third line, so it reads:
     ```sql
     if v_uid is not null and old.id = v_uid
        and (new.role    is distinct from old.role
          or new.status  is distinct from old.status) then
       raise exception 'a person may not change their own role, status or team'
         using errcode = '42501';
     end if;
     ```
   - the comment line `` -- `is distinct from`, so `team_id`, which is nullable, compares correctly
     against a null. `` is removed;
   - one comment line is added above the clause:
     `-- MIR-21-f: the team half of this lock is membership_refuse_own_rows (MIR-21-c, ADR-080).`

   The message stays as it is, so a self-move and a self-promotion meet one sentence (ADR-080
   decision 1). Same name, `returns trigger`, `language plpgsql security invoker set search_path = ''`.
   The trigger itself is not touched.

3. **`create or replace function public.member_sync_membership()`**, removal branch only. The removal
   `if` block and its comment are `20261105210000_mir21b_writers_write_membership.sql:366-371`,
   **verbatim**:
   ```sql
   create or replace function public.member_sync_membership() returns trigger
     language plpgsql security definer set search_path = '' as $$
   begin
     -- The day ADR-013 stops counting a removed member is the day their window closes (INV-04).
     if old.removed_at is null and new.removed_at is not null then
       update public.membership ms
          set left_at = greatest(new.removed_at, ms.joined_at), is_primary = false, updated_at = now()
        where ms.member_id = new.id
          and ms.left_at is null;
     end if;

     return null;
   end;
   $$;
   revoke all on function public.member_sync_membership() from public, anon;

   drop trigger if exists member_sync_membership on public.member;
   create trigger member_sync_membership
     after update of removed_at on public.member
     for each row execute function public.member_sync_membership();
   ```

4. **`create or replace function public.stamp_org_id()`**. The body is
   `20261103120000_mir13_write_path_org_bound.sql:178-217`, **copied character for character**, except
   the `when 'member'` arm, which becomes:
   ```sql
       when 'member' then
         -- MIR-21-f: a member has no team column to look up. A sign-up lands in the shared tenant
         -- (ADR-071 decision 1); an owner-side insert into another org names `org_id`.
         new.org_id := v_shared;
   ```
   Same name, signature and attributes. No trigger is touched; the `revoke` line after the body is
   repeated as it stands.

5. **`drop function public.member_team_id(uuid);`** No policy and no function body reads it
   (`160-read-path-org-bound.test.sql` AC-1).

6. **`drop index if exists public.member_team_id_idx;`** then
   **`alter table public.member drop column team_id;`** The column's foreign key to `public.team`
   goes with the column.

Nothing else: no data is rewritten, no other function, policy, trigger, grant or table changes.

### 4.2 New pgTAP — `supabase/tests/270-member-team-id-dropped.test.sql`

`begin; \ir _isolation.psql`, `select plan(n)` with `n` the exact count, `select tests.seed();`,
`finish()`, `rollback;`. One assertion group per AC-1 to AC-10, each label prefixed `AC-n:`. The file
names `team_id` only as a string in AC-1's catalogue reads, AC-3's `doesnt_match` and AC-10's refused
statement (ADR-080 decision 5).

| AC | pgTAP |
|---|---|
| AC-1 | `hasnt_column('public','member','team_id', …)`; `hasnt_index('public','member','member_team_id_idx', …)`; `is((select count(*)::int from pg_catalog.pg_constraint where conrelid = 'public.member'::regclass and contype = 'f' and confrelid = 'public.team'::regclass), 0, …)` |
| AC-2 | `hasnt_function('public','member_team_id', array['uuid'], …)`; `ok(not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'member' and policyname = 'member_decide_admin'), …)` |
| AC-3 | `matches(pg_get_triggerdef(...), 'AFTER UPDATE OF removed_at ON public\.member ', …)`; `doesnt_match(pg_get_triggerdef(...), 'INSERT', …)`; `doesnt_match(prosrc of member_sync_membership(), '\m(tg_op|team_id)\M', …)` |
| AC-4 | owner inserts `auth.users` + `public.member` for Q (`a2700000-0000-4000-8000-0000000000q1`-style ids from a `tests.m21f(label)` helper), no `org_id`; `is(org_id, tests.org_a())`; `is(count of membership for Q, 0)` |
| AC-5 | owner inserts `public.org` O2 (`is_shared_tenant = false`), then R with `org_id = O2`; `is(org_id, O2)` |
| AC-6 | owner inserts P2 pending in O1; `authenticate_as(A)`; `lives_ok` on `admit_member(P, T1)` and `reject_member(P2)`; `results_eq` on `status::text, member_roster_team_id(id)` for both |
| AC-7 | owner: `set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true)` without changing `role`, then `throws_ok` on the two `update`s; then `tests.authenticate_as(A)` and `throws_ok` on `move_member(A, T2)`. Each with `'42501', 'a person may not change their own role, status or team'`. Owner re-read of A's role and status, and an md5 of every `membership` row taken before and after. (`set_member_role(A, …)` cannot be the probe: its `m.role <> 'admin'` filter refuses an admin before the trigger runs) |
| AC-8 | `authenticate_as(A)`; `update public.member set removed_at = '2000-01-01' where id = M`; owner re-read: `removed_at > '2000-01-01'`, T1 row `left_at = greatest(removed_at, joined_at)` and `not is_primary`, `member_roster_team_id(M) = T1` |
| AC-9 | as M: `tests.rows_affected(update … display_name = '  M renamed  ' …) = 1`, owner re-read `'M renamed'`; as A: `throws_ok(update M's display_name, '42501', …)` |
| AC-10 | as M: `throws_ok('update public.member set team_id = … where id = …', '42703', …)`; owner re-read of M's row (`to_jsonb`) and `membership` md5, unchanged |

AC-11 is not a file: it is the suite run in CI (`.github/workflows/verify.yml`, the pgTAP job, and
vitest).

### 4.3 `supabase/tests/010-catalogue.test.sql`

Remove the line `'public.member_team_id(uuid)',` from the AC-12 census (line 42). `plan(5)` is
unchanged.

### 4.4 `supabase/tests/100-mock-parity.test.sql`

**The text between the two `$parity$` markers does not change by one byte** (AC-11). Outside it:

- the header comment's citation of `public.member_team_id` (line 9) names `public.member_primary_team_id`
  (`20261103120000_mir13_write_path_org_bound.sql:54-64`) instead. The marker string is not written in
  the comment;
- `tests.parity_subject` inserts the member **without** `team_id`, then, when `p_on_team`, calls
  `perform tests.put_on_team(tests.parity_id(p_case_id), tests.id('team_t'));`. The seed's teams and
  these members are both in the shared tenant, so no `org_id` is named;
- the AC-5 `has_team` assertion reads
  `public.member_primary_team_id(tests.parity_id(c->>'id')) is not null`, label
  `'AC-5 %s: member_primary_team_id is not null'`. For every P-row it gives the table's `has_team`
  value: both functions are non-null only for an approved, unremoved member with an active primary
  row, and `put_on_team` writes that row only when `removed_at` is null;
- `tests.parity_own_update` catches `undefined_column` beside `insufficient_privilege`:
  `exception when insufficient_privilege or undefined_column then v_n := 0;`. A comment says why: the
  six `team_id` cases are still the attack — a PATCH naming the column — and it is still refused, now
  because the column does not exist. The unchanged-row check after it stays as it is.

`plan(144)` is unchanged.

### 4.5 `supabase/tests/040-member-self-writes.test.sql`

Delete the `throws_ok` on `update public.member set team_id = …` (lines 19-20) from
`tests.self_writes`. `plan(29)` becomes `plan(26)`. The self-move is still covered in the same function
by `move_member(self, U)` and `set_member_team(self, U)`.

### 4.6 `supabase/tests/110-schema-cleanup.test.sql`

AC-1 becomes
`select hasnt_index('public', 'member', 'member_team_id_idx', 'AC-1: member_team_id_idx is dropped with member.team_id (MIR-21-f)');`,
with its comment rewritten to match. `plan(13)` is unchanged.

### 4.7 `supabase/tests/160-read-path-org-bound.test.sql`

- **M2:** `insert into public.member (id, org_id, display_name, avatar, role, status, email)` with
  `org_id = tests.m13b('org_b')`, then `select tests.put_on_team(tests.m13b('m2'), tests.m13b('team_2'));`
  before the `entry` insert (its stamp reads the primary team).
- **P2:** the column list and values lose `team_id` / `null`.
- **AC-1, third assertion:** `select hasnt_function('public', 'member_team_id', array['uuid'], 'AC-1: public.member_team_id(uuid) is dropped (MIR-21-f)');`
- **AC-9:** the two `update public.member` statements lose `team_id = …`: they set only `status`.

`plan(49)` is unchanged.

### 4.8 `supabase/tests/230-writers-write-membership.test.sql`

AC-10's first assertion matches `'AFTER UPDATE OF removed_at ON public\.member '`, label
`'AC-10: member_sync_membership fires AFTER UPDATE OF removed_at (MIR-21-f dropped the INSERT event)'`.
`plan(84)` is unchanged.

### 4.9 `supabase/tests/240-org-public-holidays.test.sql`

Dora and Dan are inserted with `org_id = tests.m15b('org_d')` and no `team_id`, then
`select tests.put_on_team(tests.m15b('dora'), tests.m15b('team_d1'));` and the same for Dan, before
`grant_system_admin`. The header comment at line 8 (*"the membership mirror gives each a membership on
D1"*) says the fixture writes it. `plan(54)` is unchanged.

### 4.10 `.ai/standards/data-model.md`

Additive, in the file's own style: the old sentence is kept in italics with its date.

- **`member` table, `team_id` row (line 39):** the Notes cell becomes
  `**Dropped 2026-11-07 by MIR-21-f** (ADR-080 decision 4). A member's teams are their `public.membership` rows; the roster team is `public.member_roster_team_id(id)`. *Until then: nullable since ADR-033 …*`
  followed by the old text.
- **`status` row (line 43):** `public.member_team_id returns a team only for an approved member, and
  every row-level policy in the product resolves through that function` becomes
  `public.member_team_ids and public.member_primary_team_id return a team only for an approved, unremoved member, and every team-scoped policy resolves through one of them`,
  with *"Until 2026-11-07 this named `public.member_team_id`, dropped by MIR-21-f."*
- **Line 51:** `leaves team_id null` becomes `writes no membership row`.
- **MIR-11 table, `member` row (line 375):** `team_id and member_team_id_idx kept until MIR-21 drops
  both` becomes `team_id and member_team_id_idx dropped by MIR-21-f (2026-11-07)`.

### 4.11 `.ai/standards/rbac-and-security.md`

- **Line 161:** the sentence about `member_decide_admin` gains, after it:
  `*Since 2026-11-07 (MIR-21-f) the policy is dropped. It had been inert since MIR-02 revoked the column grants; a decision is made only through `admit_member` and `reject_member`, which admit only a pending row with no roster team.*`
- **Line 186:** `public.member_team_id returns a team only for an approved member, every row-level
  policy in the product resolves through that function` becomes
  `public.member_team_ids and public.member_primary_team_id return a team only for an approved member, every team-scoped policy resolves through one of them`,
  with *"Until 2026-11-07 this named `public.member_team_id`."*
- The A2 and A6 rows of the audit table are history and are not edited.

### 4.12 `supabase/tests/070-definer-callers.test.sql`

`public.list_members_for_team(uuid)` returns `setof public.member`
(`20261105150000_mir21_reads_off_member_team_id.sql:102`), so after the drop its rows carry no
`team_id`. Line 117 changes from

```sql
  $$select 1 from public.list_members_for_team(tests.id('team_t')) where team_id = tests.id('team_u')$$,
```

to

```sql
  $$select 1 from public.list_members_for_team(tests.id('team_t')) where public.member_roster_team_id(id) = tests.id('team_u')$$,
```

Nothing else in the file changes: the label on line 118, every other assertion and `plan(73)` stay as
they are. The assertion is the same (no member of U in T's roster), now read from `membership`.
`member_roster_team_id(uuid)` is executable by `authenticated` (`20261105150000_mir21_reads_off_member_team_id.sql:49`),
and the statement runs as `admin_t`.

## 5. Seam impact

None. No `DataSeam` or `SystemSeam` function changes. `set_member_role`, `set_member_team` and
`promote_member_to_admin` still return `public.member`; the seam selects
`team_id:roster_team_id` from it (`src/lib/data/supabase.ts:983-984`), and that computed field
(`public.roster_team_id(public.member)`) reads only `p_member.id`, so it survives the drop. The mock
does not model the column.

## 6. Schema delta

**Not `none`.** `20261107180000_mir21f_drop_member_team_id.sql` (§ 4.1): drops column
`public.member.team_id` with its foreign key, index `member_team_id_idx`, function
`public.member_team_id(uuid)` and policy `member_decide_admin`; replaces
`member_enforce_role_and_removal`, `member_sync_membership` and `stamp_org_id`; recreates trigger
`member_sync_membership` as `after update of removed_at`. The column's `update` grant was already
revoked (`20261020120000_mir02_member_self_writes.sql:163`) and goes with the column. No data is
rewritten.

**ADR-080** decision 4, amended by **ADR-081** decision 2, is the decision. Both are accepted, so no
new ADR is needed. Applying the migration to the hosted project is human-only (RULE-09), and is
**irreversible for the column's data**: after the drop, the old `team_id` values exist only in
backups. Nothing reads them since MIR-21-d.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql"
  - "supabase/tests/270-member-team-id-dropped.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/040-member-self-writes.test.sql"
  - "supabase/tests/100-mock-parity.test.sql"
  - "supabase/tests/110-schema-cleanup.test.sql"
  - "supabase/tests/160-read-path-org-bound.test.sql"
  - "supabase/tests/230-writers-write-membership.test.sql"
  - "supabase/tests/240-org-public-holidays.test.sql"
  - "supabase/tests/070-definer-callers.test.sql"
  - ".ai/standards/data-model.md"
  - ".ai/standards/rbac-and-security.md"
```

`size: M`, from 12 paths. `size_estimate` and `size` agree. ADR-081 predicted about ten; the eleventh
is `230`, whose AC-10 asserts the trigger's `INSERT` event, which the drop of the insert branch
removes. The twelfth is `070` (§ 4.12), added at /implement on the developer's measurement. 12 is the
split threshold, not past it, so the ticket does not split. `glossary_owed` is `[]`, so no glossary row is written. No new definer function is added, so
`010`'s only change is the removed census line.

## 8. Rejected alternatives

- **Remove the six `team_id` rows from 100's shared case table.** That is the literal reading of
  "the column is gone, so the case is gone". Rejected: the table is read by
  `tests/mock-sql-parity.test.ts`, which asserts 36 own-update rows over six columns. Removing them
  moves two more files (that test and its `Column` type) and deletes the attack case — a PATCH naming
  `team_id` — that MIR-07 wrote on purpose. Treating `42703` as a refusal keeps the case and leaves the
  vitest side untouched (§ 4.4).
- **`alter table … drop column team_id cascade`.** One statement instead of six steps. Rejected:
  `cascade` would silently drop any dependant this plan missed. Without it, a missed policy or view
  fails the migration, and someone has to name it.
- **Keep the mirror trigger on `INSERT` with an empty insert path**, so `230` needs no edit. Rejected:
  a trigger that fires on every member insert to do nothing is the dead mechanism ADR-080 decision 4
  removes.
- **Leave `stamp_org_id`'s member arm as `coalesce(…, v_shared)` with the team lookup removed.** It
  would be the same thing in more words. Rejected for the shorter form.

## Delegated decisions

None. No ADR was written at this stage.

## Changelog

- `2026-11-07T07:30:13Z`: all sections written. Raised by `tech-lead-design`. **The order was not
  kept**: the source tree was read before sections 1 and 2 were written. The paths had to be counted
  and the dependants of the column found before any criterion could be stated. Reading the code is
  what added AC-3 (the trigger's `INSERT` event, and so `230` to the paths), AC-9 (the trigger body is
  replaced, so its other clauses must be shown to still fire) and AC-10 (100's `team_id` cases now
  meet `42703`). No AC was narrowed to fit the build. Amended by `tech-lead-design`.
- `2026-11-07T07:32:00Z`: AC-7 rewritten. As first written, it probed the role clause with
  `set_member_role(A, 'manager')`. That function's `m.role <> 'admin'` filter refuses an admin before
  the trigger runs, so the probe would have passed even if the clause were gone. The probe now sets
  A's JWT claims under the owner's role, which is the position a definer writer is in. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
- `2026-11-07T07:42:15Z`: § 4.12 added, `070-definer-callers.test.sql` added to § 7 (12 paths), § 1
  and AC-11 updated to cite it. The sweep missed one reader: `070`'s AC-9 admin row filters
  `list_members_for_team`'s `setof public.member` rows on `team_id`, so the drop aborts the file
  (`column "team_id" does not exist`, 67 of 73 run), measured with `pnpm db:test`. The filter now reads
  `public.member_roster_team_id(id)`; assertion, label and `plan(73)` unchanged. Without it AC-11
  could not be met. No AC narrowed. Raised by `developer` (99-questions.md). Amended by
  `tech-lead-design`.
