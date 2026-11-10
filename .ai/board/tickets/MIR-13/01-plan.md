---
ticket: MIR-13
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-03T01:55:00Z
inputs_read:
  - .ai/board/tickets/MIR-13/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-067-the-runner-pushes-merges-and-decides-blocked-questions-on-its-own.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/01-operating-model.md
  - .ai/standards/testing-standards.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-12/01-plan.md
  - .ai/board/tickets/MIR-21/ticket.yaml
  - supabase/migrations/ (latest definition of every policy and function, inventoried 2026-11-03)
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20260924100000_solo_cross_team_role.sql
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261014090000_evt12_invite_every_scope.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260912100000_solo_manager_role.sql
  - supabase/migrations/20260913090000_solo_avatar_images.sql
  - supabase/bootstrap.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/130-backfill-org-public.test.sql
  - supabase/tests/_isolation.psql
  - src/lib/data/supabase.ts
  - tests/draft-entry.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-13 — the write slice: writers stamp `org_id`, `membership` is kept true, `NOT NULL`, and every admin write is org-bounded

## 1. Problem and scope

**Feature — MIR-13** (`.ai/registry/features.md:302`):

> The policy layer is rewritten against `membership` and `org_id`, and no definer function trusts a client-supplied team id alone

Plan item P3-4 (`.ai/board/plans/calechip-multi-tenancy-plan.md:189-194`), plus the two steps MIR-12
moved here (`.ai/board/tickets/MIR-12/01-plan.md` Changelog 2026-10-31T12:17:00Z): `SET NOT NULL` on
every `org_id` and `entry.primary_team_id`, and the `holiday` unique swap.

**The feature is split by operation. This ticket is the write slice** (ADR-071 decision 5). The read
slice is **MIR-13-b**, created by this plan (§ 7). The write slice goes first because no writer
maintains `membership` today. A read moved onto `membership` first would hide everyone admitted or
moved after MIR-12.

**Who gains what.** No role gains a capability. An admin loses the ability to write any row of
another org. Today that ability exists in every admin-gated function and policy (audit A:370-408,
A:540-584). It is harmless only because one org holds every row. After this ticket a second org can
be created (MIR-18) without inheriting that hole. The database also becomes the only author of
`org_id`, so no seam function changes shape.

**Out of scope:**

- **Every `select` policy and every read definer function** — MIR-13-b: `member_select_team`,
  `member_select_pending_admin`, `team_select_own`, `entry_select_team`, `busy_day_select_team`,
  `issue_report_select_admin`, `issue_image_select_admin`, `event_select_visible`,
  `event_attendance_select_visible`, `event_guest_select_visible`, `notification_select_own`,
  `list_teams`, `list_all_members`, `list_members_for_team`, `list_team_entries_for_team`,
  `list_team_entries_overlapping_for_team`, `list_member_directory`, `may_read_event`,
  `is_event_participant`, `notify_event_created`.
- **`getTeam()` `.maybeSingle()`** (`supabase.ts:2313-2321`) and the overload warning for a viewed
  team (`usePageOverload.ts:118-135`, `OverloadWarning.tsx:199`) — MIR-13-b. Under this ticket every
  member still has at most one active membership (§ 2 AC-9), so `getTeam()` cannot yet see two rows.
- **A team id on `setOverloadThreshold` / `setApprovalSettings`.** Their statement is scoped to one
  row in the database instead (ADR-071 decision 3). Choosing a named team is MIR-16/MIR-17.
- **Dropping `member_team_id()` or `member.team_id`.** This ticket moves the write-path readers off
  `member_team_id()`. MIR-13-b moves the rest, and MIR-21 drops the column, the function and the
  mirror trigger.
- **Approval across several teams, `rejected_by`, `self_approved`** — MIR-14.
- **Org public special cases** (directory, public events, notifications, holiday writes by
  `system_admin` only) — MIR-15. Here an admin writes the holidays of their own org, which today is
  Org public, exactly as now.
- **`allowed_email`, `event_email_invitation`, `task`.** They carry no `org_id` (ADR-070 § 4 lists
  twelve tables), and their policies are unchanged.
- **`entry_enforce_decision`, `member_enforce_role_and_removal`, `reject_entries`.** They read no
  team. They inherit the org bound from the policies in § 4.4.
- **`src/`, `tests/` (vitest), `src/lib/data/mock.ts`.** No seam function changes signature or
  behaviour for a single-org caller. `100-mock-parity` predicates are unchanged (§ 5).
- **Applying either migration to the hosted project** — human-only (RULE-09).

`size_estimate: M`

## 2. Acceptance criteria

`verification_required: true`. A passing pgTAP run is necessary and not sufficient. AC-3 and AC-4 are
verified against a database that held MIR-12's state with null-`org_id` rows written after it, by
the procedure in AC-3. The psql output goes in `03-impl-log.md`.

Fixture names used below: **Org A** is the shared tenant (Org public). **Org B** is a dedicated org
(`is_shared_tenant = false`). **Admin A** is an approved admin of Org A on team **T1** (primary).
**T3** is a second team of Org A. **T2** is a team of Org B, with approved member **M2**, pending
sign-up **P2**, entry **E2**, holiday **H2**, issue report **R2** and event **V2**.

**AC-1 — Every `org_id` and `entry.primary_team_id` is `NOT NULL`**
- Given both migrations are applied
- When `information_schema.columns` is read for `org_id` on `team, member, entry, holiday, busy_day, issue_report, event, event_invitee, event_attendance, event_guest_link, event_guest, notification`, and for `entry.primary_team_id`
- Then all thirteen have `is_nullable = 'NO'`

**AC-2 — `holiday` is unique per org and date**
- Given the migrations are applied
- When the constraints on `public.holiday` are read
- Then `holiday_org_id_date_key unique (org_id, date)` exists and `holiday_date_key` does not
- And a holiday on date *d* in Org A and another on *d* in Org B are both accepted
- And a second holiday on *d* in Org A is refused with `23505`

**AC-3 — Rows written with a null `org_id` after MIR-12 are backfilled before `NOT NULL`**
- Given a database at MIR-12's last migration, holding a `team`, a `member` on it, an `entry`, a `busy_day` and a `holiday` inserted as the table owner with `org_id` null
- When MIR-13's migrations are applied (procedure: `supabase db reset --version 20261031120000`, the owner-side inserts, then `supabase migration up`; `TODO(verify)` both flags against the installed CLI before relying on them, and record the commands actually run)
- Then the migrations succeed, and every one of those rows has the shared tenant's `org_id`, and the entry's `primary_team_id` is its member's team

**AC-4 — An entry with no derivable `primary_team_id` stops the migration**
- Given a database at MIR-12 holding an entry whose member has `team_id is null`
- When MIR-13's first migration is applied
- Then it raises an exception naming the number of such entries, and no column becomes `NOT NULL`

**AC-5 — `org_id` is stamped from the parent when the inserted value is null**
- Given the migrations are applied
- When a row is inserted with no `org_id` into each table of ADR-071 decision 1
- Then its `org_id` is that table's source in the ADR-071 table: the caller's org for `team` and `holiday` (the shared tenant when there is no caller), the team's org for `member` (the shared tenant when `team_id` is null), the member's org for `entry`, `busy_day`, `issue_report`, `event` and `notification`, and the event's org for the four event child tables
- And an `entry` inserted with no `primary_team_id` gets its author's active primary team

**AC-6 — A sign-up still lands, pending, in the shared tenant**
- Given the migrations are applied
- When an `auth.users` row with a confirmed email is inserted (the admission trigger path)
- Then a `member` row exists with `status = 'pending'`, `team_id is null`, and `org_id` = the shared tenant's id, and no `membership` row exists for it

**AC-7 — A supplied `org_id` is kept, and a mismatched one is refused**
- Given the migrations are applied
- When an `entry` for M2 (Org B) is inserted as the owner with `org_id` = Org A
- Then it is refused with `23503` (`entry_member_org_fk`)
- And when an `entry` for M2 is inserted with `org_id` = Org B, it is accepted unchanged

**AC-8 — A member with no active team cannot insert an entry**
- Given a pending sign-up authenticated as itself
- When it inserts an `entry` with `member_id = auth.uid()`
- Then the insert is refused with `23502` on `primary_team_id`

**AC-9 — `membership` mirrors `member.team_id` through every existing writer**
- Given the migrations are applied, as Admin A
- When `admit_member(P, T1)` is called for a pending sign-up P of Org A
- Then P has exactly one active `membership` row: `team_id = T1`, `is_primary = true`, `left_at is null`
- And when `move_member(P, T3)` is then called, the T1 row has `left_at` set and `is_primary = false`, and one active primary row on T3 exists
- And when `set_member_role(P, 'manager')` is then called, the active primary row has `team_role = 'manager'`
- And when P is removed (`removed_at` set through `member_update_admin`), P has no active `membership` row, and every closed row has `left_at >= joined_at`
- And for every member, after every step, the count of active primary rows is at most 1, and it is 1 exactly when `team_id is not null` and `removed_at is null`

**AC-10 — `bootstrap.sql` writes one membership row, not two**
- Given a fresh project with the migrations applied and `bootstrap.sql` run
- When `membership` is read for admin zero
- Then exactly one active primary row exists

**AC-11 — A team-level setting writes only the caller's primary team**
- Given Admin A has an active primary membership on T1 and an active non-primary membership on T3 (inserted by the test as the owner)
- When Admin A runs `update public.team set overload_threshold = 0.3 where id is not null`, and then `update public.team set wfh_need_approve = true, pto_need_approve = true where id is not null` (the two setters' statements)
- Then each statement returns exactly one row, T1, and T3's three columns are unchanged

**AC-12 — Every admin-gated definer function refuses a target in another org**
- Given Admin A is authenticated
- When each call below is made
- Then each raises `42501`, and the target row read back as the owner is unchanged:
  - `admit_member(P2, T2)` and `admit_member(P2, T1)`
  - `reject_member(P2)`
  - `move_member(M2, T1)`
  - `rename_team(T2, 'x')` and `delete_team(T2)`
  - `set_member_role(M2, 'manager')` and `promote_member_to_admin(M2)`
  - `set_member_team(M2, T2)`
- And `create_team('New')` returns a team whose `org_id` is Org A

**AC-13 — Every admin-gated write policy admits no row of another org**
- Given Admin A is authenticated
- When Admin A updates or deletes E2, updates or deletes H2, updates R2, updates M2 through `member_update_admin`, decides P2 through `member_decide_admin`, and updates or deletes V2
- Then each statement affects zero rows, and each row read back as the owner is unchanged
- And when Admin A inserts a holiday with `org_id` = Org B, it is refused with `42501`
- And when Admin A inserts a holiday with no `org_id`, it is accepted with `org_id` = Org A

**AC-14 — "Same team" on a write path means "share an active team"**
- Given a manager K with primary T1 and member N with primary T3, both of Org A
- When K updates N's entry through `entry_update_manager`
- Then zero rows are affected
- And when N is given an active non-primary membership on T1 and K repeats the update, one row is affected

**AC-15 — Event management is bounded by org**
- Given Admin A is authenticated
- When `may_manage_event(V2, Admin A)` is evaluated
- Then it is `false`
- And `invite_to_event(V2, array['x@example.com'])` raises `42501`
- And `is_event_audience(V2, Admin A)` is `false` even when V2 has `scope = 'public'`

**AC-16 — An address belonging to another org's member is an outsider to `invite_to_event`**
- Given Admin A manages a `named` event V1 of Org A, and M2's email is known
- When `invite_to_event(V1, array[<M2's email>])` is called
- Then the result row's `outcome` is `'sent'`, an `event_email_invitation` row exists for that address, and no `event_invitee` row exists for M2

**AC-17 — Same-org behaviour is unchanged**
- Given the migrations and the test changes in § 7
- When `pnpm db:test` and the four commands in `.ai/standards/testing-standards.md` run
- Then all exit 0
- And the only existing assertions changed are these:
  - `130-backfill-org-public.test.sql` AC-8 now asserts the thirteen columns are `NOT NULL`, and AC-9 now asserts the per-org key. MIR-12 wrote both as "until MIR-13".
  - `120-composite-fks.test.sql`'s same-org `membership` acceptance (`:299-305`) still asserts a same-org insert is accepted. It is rewritten so that it does not collide with the row the mirror trigger already wrote.
  - `010-catalogue.test.sql`'s definer census gains the functions in § 4.1 and § 4.2.

**AC-18 — The new helpers are callable by `authenticated` and not by `public`**
- Given the migrations are applied
- When `has_function_privilege` is read for `member_org_id(uuid)`, `member_team_ids(uuid)`, `member_primary_team_id(uuid)` and `shares_active_team(uuid,uuid)`
- Then `authenticated` holds `EXECUTE`, and none of them is granted to `public`

**AC-19 — Nothing in the datastore consults the threshold**
- Given the new migration files
- When `tests/draft-entry.test.ts` AC-14 scans `supabase/migrations/`
- Then it passes. No new statement that can refuse a write mentions `overload_threshold` (refusal 6)

**Invariants touched:**

- **INV-04** — The count reads a team's members as of the date (ADR-070 § 5). This ticket starts
  writing the `membership` windows that count will read. The mirror trigger is the mechanism that
  holds it: a removal closes the window at `removed_at` (AC-9), the same day ADR-013 stops counting.
  `absenceCountsFor` is untouched, so no second definition appears.
- **INV-07** — `entry.primary_team_id` becomes `NOT NULL` and is stamped from the author's active
  primary team. `entry_member_org_fk` keeps an entry in its member's org (AC-7). Because each member
  has exactly one active team under this ticket (AC-9), "every team that member belongs to" is still
  one team. MIR-13-b and MIR-14 widen it.
- **INV-02** — `entry_update_admin` and `entry_update_manager` are rewritten. The reset to `pending`
  is held by `entry_enforce_decision()`, which is actor-blind (`cal03:31`) and not touched here, so a
  rewritten policy cannot bypass it.

**Open questions:** none that change an AC. The two CLI flags in AC-3 are `TODO(verify)` for the
Developer. They are not a decision.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

This ticket changes no screen. There is no layout to originate.

## 3. Permission model

Everything is enforced in the database. No interface gate changes.

| Action | Who may | Who must not | Where |
|---|---|---|---|
| Admit, reject, move a sign-up or member | admin of the target's org; for admit, the team is also in that org | admin of another org (AC-12) | function body, `42501` |
| Create a team | admin; the team lands in the admin's org | — | `create_team` + stamping trigger |
| Rename, delete a team | admin of the team's org | admin of another org | function body |
| Change a rank, promote to admin | admin of the target's org (`set_member_role`); admin sharing an active team (`promote_member_to_admin`) | admin of another org | function body |
| Update a member row as admin | admin sharing an active team with the row | any other admin | `member_update_admin` |
| Decide a pending sign-up by update | admin of the sign-up's org, admitting to one of the admin's own teams | admin of another org | `member_decide_admin` |
| Set threshold, approval switches | admin, on the admin's **primary** team only | any team that is not the caller's primary (AC-11) | `team_update_admin` |
| Edit or delete another's entry | admin or decider sharing an active team with the author | anyone else | `entry_update_admin`, `entry_delete_admin`, `entry_update_manager` |
| Write a holiday | admin, in their own org | admin writing another org's row, or supplying another org's id (AC-13) | `holiday_*_admin` |
| Update an issue report | admin of the report's org | admin of another org | `issue_report_update_admin` |
| Manage an event (update, delete, invitees, attendance, guest link, guests) | its creator while on a team, or an admin of the event's org | admin of another org (AC-15) | `may_manage_event`, `event_update_manage`, `event_delete_manage` |
| Write `org_id` | nobody needs to; the database stamps it | a client supplying a mismatched org (composite FK, AC-7; holiday policy, AC-13) | triggers, FKs, `with check` |
| Write `membership` | nobody directly; only the mirror trigger | `authenticated` holds no grant on it (MIR-11) | trigger, definer |

Check R6 reads this table.

## 4. Contract

**One migration file**, `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql`, in one
transaction. Its sections run in this order, because each depends on the one before:

1. helpers (§ 4.1)
2. the mirror trigger (§ 4.2)
3. stamping triggers (§ 4.3)
4. re-run of MIR-12's backfill, then the AC-4 guard, then `SET NOT NULL` and the holiday key swap (§ 4.5)
5. the rewritten functions and policies (§ 4.4)

Every definer function: `language … security definer set search_path = ''`, then
`revoke all on function … from public;` and `grant execute … to authenticated;` for the callable
ones. Trigger functions get no grant. This is the house pattern (`solo_manager_role:66-70`).

### 4.1 Helpers — new, exact

```sql
-- The caller's org, under the same three conjuncts as is_admin / member_team_id.
create or replace function public.member_org_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.org_id from public.member m
   where m.id = p_uid
     and m.removed_at is null
     and m.status = 'approved'::public.member_status;
$$;

-- Every active team of an approved, unremoved member. Set-returning (P3-4).
create or replace function public.member_team_ids(p_uid uuid) returns setof uuid
  language sql stable security definer set search_path = '' as $$
  select ms.team_id
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_uid
     and ms.left_at is null
     and m.removed_at is null
     and m.status = 'approved'::public.member_status;
$$;

create or replace function public.member_primary_team_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select ms.team_id
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_uid
     and ms.left_at is null
     and ms.is_primary
     and m.removed_at is null
     and m.status = 'approved'::public.member_status;
$$;

create or replace function public.shares_active_team(p_a uuid, p_b uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.member_team_ids(p_a) a(team_id)
      join public.member_team_ids(p_b) b(team_id) on a.team_id = b.team_id
  );
$$;
```

### 4.2 Mirror trigger — new

```sql
create or replace function public.member_sync_membership() returns trigger
  language plpgsql security definer set search_path = '' as $$ … $$;   -- body: ADR-071 decision 2

create trigger member_sync_membership
  after insert or update of team_id, role, removed_at on public.member
  for each row execute function public.member_sync_membership();
```

Rules, exactly ADR-071 decision 2:

- `team_role` is `case when new.role = 'manager' then 'manager'::public.team_role else 'member'::public.team_role end`.
  The column is `team_role` as MIR-11 shipped it. ADR-070 calls it `role_in_team`.
- **Insert** with `team_id` not null: insert the row MIR-12 would have written:
  - `joined_at = new.created_at`
  - `left_at = case when new.removed_at is null then null else greatest(new.removed_at, new.created_at) end`
  - `is_primary = (new.removed_at is null)`
- **Update**, when `team_id` changes:
  1. Close the active primary row (`left_at = now()`, `is_primary = false`).
  2. If `new.team_id` is not null and `new.removed_at` is null, make an existing active row on
     `new.team_id` primary, or insert one with `joined_at = now()`, `is_primary = true`, and
     `org_id = new.org_id`.
- **Update**, when `removed_at` goes from null to a value: close every active row with
  `left_at = greatest(new.removed_at, joined_at)` and `is_primary = false`.
- **Update**, when `role` changes: set `team_role` on the active primary row.
- The trigger never inserts a second active row for the same `(team_id, member_id)`.
  `membership_active_team_member_idx` would refuse one, and AC-9 asserts it never comes to that.

### 4.3 Stamping — new

```sql
create or replace function public.stamp_org_id() returns trigger
  language plpgsql security definer set search_path = '' as $$ … $$;   -- branches on tg_table_name
```

- The shared tenant is `(select o.id from public.org o where o.is_shared_tenant)`.
- The function sets `new.org_id` only when it is null, from the sources in the table in ADR-071
  decision 1. For `entry` it also sets `new.primary_team_id := public.member_primary_team_id(new.member_id)`,
  when null.
- The parent lookups (`member`, `event`, `team`) read the row directly by id. They do not use
  `member_org_id`. The composite FK binds the row to its parent's org whatever that member's
  status, and a status filter here would turn a legitimate owner-side insert into a `23502`.
- Triggers, one per table, all `before insert … for each row`:
  `team_stamp_org_id`, `member_stamp_org_id`, `entry_stamp_org_id`, `holiday_stamp_org_id`,
  `busy_day_stamp_org_id`, `issue_report_stamp_org_id`, `event_stamp_org_id`,
  `event_invitee_stamp_org_id`, `event_attendance_stamp_org_id`, `event_guest_link_stamp_org_id`,
  `event_guest_stamp_org_id`, `notification_stamp_org_id`.

### 4.4 Rewritten — same names, same signatures, same error codes and messages

**Rewrite rules**, applied to each body listed below and nowhere else:

| Was | Becomes |
|---|---|
| `public.member_team_id(a) = public.member_team_id(b)` | `public.shares_active_team(a, b)` |
| `public.member_team_id(x) is not null` | `exists (select 1 from public.member_team_ids(x))` |
| `team_id = public.member_team_id((select auth.uid()))` (a row's team is the caller's) | `team_id in (select public.member_team_ids((select auth.uid())))` |
| an `is_admin(caller)` gate over a target row or team | the same gate, `and <target>.org_id = public.member_org_id(caller)` |

**Functions:**

| Function | Change |
|---|---|
| `create_team(text)` | none in the body; the stamping trigger supplies the caller's org (AC-12) |
| `rename_team(uuid,text)`, `delete_team(uuid)` | `where id = p_team_id and org_id = public.member_org_id(auth.uid())`; `delete_team`'s occupancy check unchanged |
| `admit_member(uuid,uuid)` | the team-exists check also requires `t.org_id = member_org_id(caller)`; the update also requires `org_id = member_org_id(caller)` |
| `reject_member(uuid)`, `move_member(uuid,uuid)`, `set_member_role(uuid,member_role)` | the update also requires `m.org_id = member_org_id(caller)`; `move_member`'s team check also requires the team's org to be the caller's |
| `promote_member_to_admin(uuid)` | `m.team_id = member_team_id(caller)` becomes `m.team_id in (select member_team_ids(caller))` |
| `set_member_team(uuid,uuid)` | `v_team` is removed; the condition is `m.team_id in (select member_team_ids(caller)) and p_team_id = m.team_id` |
| `may_manage_event(uuid,uuid)` | `(e.creator_id = p_uid and exists (select 1 from member_team_ids(p_uid))) or (is_admin(p_uid) and e.org_id = member_org_id(p_uid))` |
| `is_event_audience(uuid,uuid)` | the rewrite rules, plus `e.org_id = public.member_org_id(p_uid)` on the whole disjunction; `e.team_id = member_team_id(p_uid)` becomes `e.team_id in (select member_team_ids(p_uid))` |
| `invite_to_event(uuid,text[])` | the address lookup adds `and m.org_id = (select e.org_id from public.event e where e.id = p_event_id)`; `member_team_id(m.id) = v_team` becomes `v_team in (select public.member_team_ids(m.id))` |
| `event_stamp()` | `new.team_id := public.member_primary_team_id(new.creator_id)` |

**Policies** (`drop policy if exists` then `create policy`; `to authenticated`; same command):

| Policy | `using` / `with check` after |
|---|---|
| `member_update_admin` | `is_admin(caller) and team_id in (select member_team_ids(caller))` / `team_id in (select member_team_ids(caller))` |
| `member_decide_admin` | unchanged, plus `and org_id = member_org_id(caller)` in both clauses; the approved branch's `team_id = member_team_id(caller)` becomes `team_id in (select member_team_ids(caller))` |
| `team_update_admin` | `id = member_primary_team_id(caller) and is_admin(caller)` in both clauses (ADR-071 decision 3) |
| `entry_update_admin`, `entry_delete_admin` | `is_admin(caller) and shares_active_team(member_id, caller)`; `with check` `shares_active_team(member_id, caller)` |
| `entry_update_manager` | `may_decide(caller) and not is_admin(caller) and shares_active_team(member_id, caller)`; `with check` `shares_active_team(member_id, caller)` |
| `holiday_insert_admin` | `with check (is_admin(caller) and org_id = member_org_id(caller))` |
| `holiday_update_admin` | `using` and `with check` `(is_admin(caller) and org_id = member_org_id(caller))` |
| `holiday_delete_admin` | `using (is_admin(caller) and org_id = member_org_id(caller))` |
| `issue_report_update_admin` | `using` and `with check` `(is_admin(caller) and org_id = member_org_id(caller))` |
| `busy_day_insert_own`, `busy_day_delete_own`, `event_insert_own`, `event_attendance_delete_own`, `notification_update_own` | the second rewrite rule only |
| `event_update_manage`, `event_delete_manage` | `(creator_id = caller and exists (select 1 from member_team_ids(caller))) or (is_admin(caller) and org_id = member_org_id(caller))`, in each clause it has |
| `event_invitee_insert_manage` | `may_manage_event(event_id, caller) and exists (select 1 from member_team_ids(member_id))` |

`caller` above is `(select auth.uid())`, written out in full in the SQL, the way the existing policies
write it.

Every policy that calls `may_manage_event` (`event_invitee_select/delete_manage`,
`event_attendance_update_manage`, `event_guest_link_*`, `event_guest_update_manage`, and through it
`list_event_guest_emails`) inherits the org bound without being re-created.

### 4.5 Constraint steps

1. Re-run MIR-12's backfill statements, which are idempotent
   (`20261031120000_mir12_backfill_org_public.sql`), copied into this file. A migration must not
   `\i` another one.
2. `do $$ … if (select count(*) from public.entry where primary_team_id is null) > 0 then raise exception 'MIR-13: % entries have no primary team', n; end if; $$` (AC-4).
3. `alter table public.<t> alter column org_id set not null` for the twelve tables, and
   `alter table public.entry alter column primary_team_id set not null`.
4. `alter table public.holiday drop constraint holiday_date_key, add constraint holiday_org_id_date_key unique (org_id, date);`

A header comment says the `SET NOT NULL` scans each table inline, as MIR-12 § 8 Alt 3 recorded.

### 4.6 `bootstrap.sql`

The explicit `insert into public.membership` (`:213-217`) is removed. The mirror trigger writes that
row from the member insert above it (AC-10). The comment says so.

### 4.7 Seam and types

No change. `SetOverloadThresholdInput`, `SetApprovalSettingsInput`, and every `.rpc()` argument name
are unchanged.

## 5. Seam impact

None. No function in `src/lib/data/` is added, renamed or re-signed, and the seam-parity test is
unaffected. For a caller in one org on one team, every rewritten predicate gives the answer it gave
before. That is why `100-mock-parity`'s case table, written against `is_admin`, `member_team_id` and
`may_decide`, stays true without edits. The mock has no org, and MIR-13-b decides whether it gains
one.

## 6. Schema delta

**Non-none.** Policies, triggers, constraints and definer functions all change (ADR-014).
- [ADR-070](../../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) § 4 covers `NOT NULL` and the holiday key.
- [ADR-071](../../../registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md) covers stamping, the mirror, the primary-team setting and the split.

No migration is applied by this ticket (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md"
  - ".ai/board/tickets/MIR-13-b/ticket.yaml"
  - ".ai/board/tickets/MIR-21/ticket.yaml"
  - "supabase/migrations/20261103120000_mir13_write_path_org_bound.sql"
  - "supabase/bootstrap.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/120-composite-fks.test.sql"
  - "supabase/tests/130-backfill-org-public.test.sql"
  - "supabase/tests/140-org-stamping-and-membership-mirror.test.sql"
  - "supabase/tests/150-write-path-org-bound.test.sql"
```

**Coverage.** `140` covers AC-1, AC-2 and AC-5 to AC-10. `150` covers AC-11 to AC-16 and AC-18.
AC-3 and AC-4 are covered by the psql procedure in `03-impl-log.md`.

`glossary_owed` is `[]`, so no glossary rows are owed.

**`size`: 10 paths → M.** It matches `size_estimate: M`. As planned in one piece, P3-4 counted
past 12 and was L. That forced the split in ADR-071 decision 5:
- the ADR and the two board files were written at PLAN;
- `MIR-13-b` was created in `BACKLOG`;
- `MIR-21.depends_on` gained `MIR-13-b`, so `member.team_id` cannot be dropped while read policies still use it.

Two notes on the split:
- MIR-13-b is ticket ID `MIR-13-b` under feature `MIR-13`, following the operating model's `-a`/`-b`
  convention. This ticket keeps the bare ID, because its branch already exists.
- **`/ship` for MIR-13 must leave the `MIR-13` feature row `PLANNED`**, because MIR-13-b still owes
  part of it.

**ADR-071 is in the ship set's registry plane, not among the three ship-owned files.** It is listed
here so that `/ship` commits it on this branch (ADR-067 step 1).

## 8. Rejected alternatives

**1. Keep P3-4 as one ticket with one migration.** It is plausible because there are fewer moving
parts, and each policy is rewritten once. Rejected for two reasons:
- About forty policies and thirty functions in one diff cannot be reviewed item by item against R6
  and R8.
- The operating model makes `L` split at PLAN. It does not let a ticket stay `L` because its file
  count happens to be small.

**2. Split read first, then write** (the operating model's usual order). Rejected: reads moved onto
`membership` before any writer maintains it hide every person admitted or moved after MIR-12. That
is a silent outage of the calendar for new members. ADR-071 decision 5 has the full argument.

**3. Make the client send `org_id` and a `teamId`.** This is explicit, and the plan item names the
setters. Rejected because it changes about ten seam signatures and two screens (`XL`), and it makes
the client the source of a tenancy boundary the database can derive. ADR-071 records the options.

**4. Write `membership` inside each writer function instead of one trigger.** Rejected because it
needs eight copies of one rule. One of them sits behind the admission trigger's
`exception when others`, which turns a failed mirror write into a sign-up with no warning anyone
reads.

## Delegated decisions

None. ADR-071 supersedes nothing. It is accepted under ADR-008 and not under ADR-067's delegation.

## Changelog

- `2026-11-03T01:55:00Z` — initial plan. The feature was planned at `L` and split by operation
  (ADR-071 decision 5). This ticket is the write slice, and MIR-13-b, created here, is the read
  slice. After reading the source, the scope paragraph moved `getTeam()` and the overload warning to
  MIR-13-b: under one active membership per member they cannot fail yet (AC-9). That is a scope
  move, not an AC reshaped. tech-lead-design.
