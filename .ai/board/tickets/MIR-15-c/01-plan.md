---
ticket: MIR-15-c
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T07:10:00Z
inputs_read:
  - .ai/board/tickets/MIR-15-c/ticket.yaml
  - .ai/board/tickets/MIR-15/ticket.yaml
  - .ai/board/tickets/MIR-15/01-plan.md
  - .ai/board/tickets/MIR-15-b/ticket.yaml
  - .ai/board/tickets/MIR-15-d/ticket.yaml
  - .ai/board/tickets/MIR-15-e/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md
  - .ai/registry/decisions/ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md
  - .ai/registry/decisions/ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md
  - .ai/registry/decisions/ADR-079-org-public-holidays-are-written-through-four-system-admin-rpcs-and-each-org-reads-only-its-own.md
  - .ai/templates/plan.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261009150000_evt07_guest_registration.sql
  - supabase/migrations/20261015120000_tsk01_task.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/migrations/20261105120000_mir18b_org_management.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261106130000_mir21c_membership_self_lock.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - src/lib/data/system.ts
  - src/system/main.tsx
  - src/lib/fixtures.ts
  - tests/e2e/mir-18-b-org-management.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-15-c — a system admin moves a team out of Org public into a dedicated org, from the system panel

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:304`):

| ID | Feature | Group |
|---|---|---|
| MIR-15 | In Org public, the directory, public events and event notifications stay within the team, only system_admin sets its holidays, and a team can be moved to another org | MIR |

**Plan item P3-6, the bullet this ticket ships** (`.ai/board/plans/calechip-multi-tenancy-plan.md:211`):

- Build "move a team to another org" in the system panel — needed the day a customer buys a licence

MIR-15 shipped the first three bullets, MIR-15-b and MIR-15-e the fourth; MIR-15-d (the mock half of
MIR-15) is still open. The feature row stays `PLANNED` until MIR-15-d ships too.

**Who gains what.** Every unlicensed team lives in Org public (ADR-059 decision 2), where it sees
nothing of any other team. The day such a team buys a licence it needs its own org — its own
holidays, org-wide `public` events, and an org boundary nobody else shares. Today a system admin can
create that org (MIR-18-b) but cannot put anybody in it: there is no path from Org public to a
dedicated org for a team that already has people, entries and events. After this ticket a system
admin picks an Org public team in the panel, picks a dedicated org, and moves the team; its people
and everything they wrote go with it, and nothing of it remains visible to Org public.

**The three questions MIR-15-c's `mir_detail` carried are settled by ADR-093** (delegated, ADR-067):
a member on the moved team and on another team refuses the move (decision 4, `MT001`); the rows that
move, the links that are cut and the links that refuse are decision 3, 5 and 4; the move runs only
from Org public into a dedicated org, and caps do not refuse it (decisions 1 and 2).

`size_estimate: M` — one migration (two RPCs, nineteen constraint alterations, two guard clauses),
its pgTAP, the census, two seam functions in both implementations, one panel section, one e2e spec.

**Out of scope — and where each goes:**

- **Moving a team between two dedicated orgs, back into Org public, or several teams at once.**
  Refused or not offered (ADR-093 decision 1). An `/idea` when a customer needs one — the operator's
  own pre-MIR teams, which share history with each other, are the likely first case.
- **Enforcing `max_members` or `max_teams` on a move** — ADR-059 § Out of scope items 3–4, ADR-075
  decision 6. A move over a cap succeeds (AC-11).
- **Appointing the first org admin of a dedicated org.** No path exists anywhere; a move carries
  `member.role` unchanged and does not try to solve it (ADR-093 *Consequences*).
- **Resolving a refusal from the panel.** Ending a membership (`MT001`), deleting an event (`MT002`)
  and editing an entry (`MT003`) are done by people in the member app with the rights they already
  have. The panel shows what is in the way and nothing else.
- **A preview of what a move would cut** before it runs. The result reports the count afterwards.
- **Undo.** There is none in the panel (ADR-093 *Consequences*).
- **`allowed_email` rows naming the team.** The table carries no `org_id` and nothing reads it since
  sign-ups stopped consulting it (`20261106130000_mir21c_membership_self_lock.sql`, the
  `admit_allow_listed_member` body); the rows are left alone.
- **Event guests whose event was deleted** (`event_guest.event_id is null`). They are tied to no
  team and stay where they are.
- **`.ai/standards/data-model.md` and `.ai/standards/rbac-and-security.md`.** Human-owned; both keep
  ADR-070's description of the keys. Recorded in ADR-093 *Consequences*.
- **The mock seam of the member app** (`src/lib/data/mock.ts`). It models one tenant; a move has no
  meaning there.

## 2. Acceptance criteria

Throughout, the database cases: **Org public** is the org with `is_shared_tenant = true`; **Org D**
is a dedicated org (`is_shared_tenant = false`) with one team **D1** and an approved member **Dee**
on it. In Org public: team **T** (the team moved) and team **U**. **Tam** is an approved member,
active only on T, and T's manager (`role_in_team = 'manager'`). **Alice** is an approved member,
active only on T, who was on U before (an ended membership row on U, and an entry whose
`primary_team_id` is U). **Rex** is a removed member whose removal closed a row on T. **Bob** is an
approved member active only on U. **Carol** is an approved member active only on U who was on T
before (an ended row on T, and an entry whose `primary_team_id` is T). **Sam** is a system admin
signed in at `aal2`. "Moves" means `move_team_to_org(T, D)` called as Sam. "Unchanged" means every
row of every org-stamped table is as it was before the call.

**AC-1 — the team and its people move**
- Given the cast above, with no decision, event or entry crossing between T's people and U's
- When Sam moves T to Org D
- Then `team` T, `member` Tam, Alice and Rex, and every `membership`, `entry`, `busy_day` and
  `issue_report` row of Tam, Alice and Rex carry Org D's id
- And the call returns `moved_members = 3`
- And Bob and Carol, U, and their rows still carry Org public's id

**AC-2 — the team's events move with everything hanging off them**
- Given an event created by Tam on T, with an invitee Alice, an attendance by Tam, a guest link and
  a guest registration
- When Sam moves T to Org D
- Then the event, its `event_invitee`, `event_attendance`, `event_guest_link` and `event_guest` rows
  carry Org D's id, and the event's `scope`, dates and name are unchanged

**AC-3 — nothing about a moved entry changes but its org and its team**
- Given Tam has an approved entry that Tam decided, Alice a pending entry and Rex a rejected one
- When Sam moves T to Org D
- Then each entry's `status`, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`,
  `rejection_reason`, `self_approved`, dates, type, portion and note are unchanged
- And Alice's entry whose `primary_team_id` was U now has `primary_team_id = T`

**AC-4 — a person who stays keeps their entries on a team that stays**
- When Sam moves T to Org D
- Then Carol's entry whose `primary_team_id` was T has `primary_team_id = U`, and Carol's ended
  membership row on T no longer exists
- And Alice's ended membership row on U no longer exists

**AC-5 — links across the new boundary are cut, and counted**
- Given Bob attends and is invited to Tam's event on T; Alice attends and is invited to an event Bob
  created on U; Alice holds an `event_created` notification for Bob's event; Bob holds a notification
  whose actor is Alice
- When Sam moves T to Org D
- Then none of those six rows exists
- And `deleted_links` in the result equals the number of rows deleted (those six, plus the two
  membership rows of AC-4)

**AC-6 — the move writes no notification and no email**
- Given the cast of AC-5
- When Sam moves T to Org D
- Then no `notification` row was inserted by the call (none has a `created_at` within it)

**AC-7 — after the move, Org public sees nothing of T and T sees its new org**
- Given the moves of AC-1 and AC-2, and that Tam's event has scope `public`
- When Bob lists events and reads the directory, and Dee lists events
- Then Bob reads neither Tam's event nor Tam, Alice or Rex in the directory
- And Dee reads Tam's event (a dedicated org's `public` event reaches every team, ADR-076)
- And Tam's holiday read (`select` on `public.holiday`) returns Org D's rows and not Org public's

**AC-8 — the manager still manages, the team keeps its settings**
- When Sam moves T to Org D
- Then Tam's membership on T still has `role_in_team = 'manager'` and `is_primary` as before, and T's
  `overload_threshold`, `wfh_need_approve` and `pto_need_approve` are unchanged

**AC-9 — a member on another team refuses the move** (`MT001`)
- Given Bob also holds an active membership on T
- When Sam moves T to Org D
- Then the call fails with SQLSTATE `MT001` and a `detail` naming Bob's display name
- And everything is unchanged

**AC-10 — an event that would be split refuses the move** (`MT002`)
- Given Bob created an event whose `team_id` is T — or, separately, Alice created an event whose
  `team_id` is U
- When Sam moves T to Org D
- Then the call fails with SQLSTATE `MT002` and a `detail` naming that event
- And everything is unchanged

**AC-11 — a decision that would be split refuses the move** (`MT003`)
- Given Alice's entry was approved by Bob — or, separately, Carol's entry was approved by Tam
- When Sam moves T to Org D
- Then the call fails with SQLSTATE `MT003` and a `detail` naming the entry's owner
- And everything is unchanged

**AC-12 — a stayer with nowhere to keep an entry refuses the move** (`MT004`)
- Given a member who stays holds active memberships but no primary one, and an entry whose
  `primary_team_id` is T
- When Sam moves T to Org D
- Then the call fails with SQLSTATE `MT004`, and everything is unchanged

**AC-13 — only from Org public, only into a dedicated org**
- When Sam moves D1 to Org public, moves T to Org public, moves D1 to Org D, moves an unknown team,
  or moves T to an unknown org
- Then the first three fail with `22023` and the last two with `P0002`, and everything is unchanged

**AC-14 — the target org's caps do not refuse a move** (ADR-075 decision 6)
- Given Org D has `max_members = 1` and `max_teams = 1`
- When Sam moves T to Org D
- Then the move succeeds

**AC-15 — only a system admin, only at `aal2`**
- When `move_team_to_org` or `list_shared_teams` is called by Tam, by an `org_admin` of Org public, by
  Sam at `aal1`
- Then each fails with `42501` and nothing is changed
- And `anon` holds no `EXECUTE` on either function

**AC-16 — the list names Org public's teams and nothing else**
- When Sam calls `list_shared_teams()`
- Then it returns T and U, each with its count of active members (T: 2 before the move, Rex being
  removed), ordered by name, and no team of Org D
- And after Sam moves T, it returns U only

**AC-17 — the panel lists Org public's teams** (against the mock build)
- Given the panel signed in and verified
- When the page settles
- Then a section "Teams in Org public" lists `CaleChip` with 3 active members and `Nhóm khác` with 1,
  each with a **Move** button

**AC-18 — the panel moves a team**
- Given AC-17
- When Sam presses **Move** on `CaleChip`, chooses `Acme Studio` and presses **Move team**
- Then a status line says `CaleChip` moved to `Acme Studio` with 3 members, and `CaleChip` is no
  longer in the list

**AC-19 — the panel shows a refusal and what is in the way**
- Given AC-17
- When Sam moves `Nhóm khác` to `Acme Studio`
- Then an alert shows the `member_on_other_team` sentence and names `Người nhóm khác`, and `Nhóm khác`
  is still in the list

**AC-20 — the panel offers no target when there is none**
- Given the mock holds no dedicated org (Acme Studio is not loaded — the mock exposes no way to
  remove it, so this is asserted by the form's own rule: the target list is the orgs with
  `isSharedTenant = false`)
- When the move form is open and that list is empty
- Then the form says to create an org first and **Move team** is disabled

AC-20 is observable only against a build whose org list is empty; the e2e spec covers AC-17 to AC-19
and AC-20 is asserted by reading the component (§ 4.5) at review.

**Invariants touched.** `[INV-04, INV-07, INV-02]`.
- **INV-04** — deleting ended `membership` rows (AC-4) changes the windows a past count is taken
  over: U's past counts lose Alice's entries on the dates she was on U, T's lose Carol's. The count
  keeps its one definition and is taken over the rows that exist; the entries those windows would
  have counted are in another org and unreadable from it (ADR-093 *Consequences*).
- **INV-07** — `entry.primary_team_id` is rewritten (AC-3, AC-4). Each entry still belongs to its one
  member and is counted against every team that member belongs to; `primary_team_id` decides no
  count.
- **INV-02** — `entry_enforce_decision` fires on every moved entry. `org_id` and `primary_team_id`
  are not among its substantive columns, so no approved entry returns to `pending` (AC-3).
- INV-01, INV-03, INV-05 and INV-06 are not reached: no entry's dates, portion, status or reason is
  written.

**Open questions.** None that block. Every answer is ADR-093's, delegated under ADR-067.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

A new section, **below Orgs and above National holidays**, in the panel's existing style
(`src/system/main.tsx` `OrgManagement`):

- Heading `Teams in Org public`, with the count in the muted style the Orgs heading uses.
- A table, `whitespace-nowrap`, columns **Team** and **Active members** (right-aligned), and an
  unlabelled actions column holding a **Move** text button per row.
- Pressing **Move** opens one inline form above the table, the way **Edit** opens `EditOrgForm`:
  a sentence `Move <team name> to`, a `<select>` of the dedicated orgs by name, one muted line
  *"Its members, their entries and the team's events go with it. Links to people who stay in Org
  public are removed. This cannot be undone from the panel."*, then **Move team** (primary) and
  **Cancel**. One form at a time; pressing another row's **Move** replaces it.
- On success the form closes, the list re-reads, and a status line above the table reads
  `Moved <team> to <org> — <n> members, <k> links removed.`
- On refusal the form stays open with the alert under the buttons: the code's sentence, then, when
  the database named something, `In the way: <detail>`.
- Empty list: `No teams in Org public.` With no dedicated org, the form shows `Create an org first.`
  in place of the select, and **Move team** is disabled.

## 3. Permission model

Every check is in the database. The panel's gate (`systemSeam.gate()`) is an affordance only.

| Action | System admin, `aal2` | System admin, `aal1` | `org_admin` (any org) | Member | `anon` |
|---|---|---|---|---|---|
| `list_shared_teams()` | ✅ | ❌ `42501` | ❌ `42501` | ❌ `42501` | ❌ no `EXECUTE` |
| `move_team_to_org(team, org)` | ✅ subject to AC-9–AC-13 | ❌ `42501` | ❌ `42501` | ❌ `42501` | ❌ no `EXECUTE` |
| Update `org_id` on `event_attendance` / `event_guest` through PostgREST | ❌ no column grant (unchanged) | ❌ | ❌ | ❌ | ❌ |

- **The gate is `public.is_system_admin()`** — the `system_admin` row and a JWT at `aal2` (ADR-074
  decision 4) — checked first in each function, before any row is read.
- **The guard clause of § 4.1 item 4 grants nothing.** `authenticated` holds `update (status)` only
  on both tables (`20260929140000_evt02_attendance.sql:407`,
  `20261009150000_evt07_guest_registration.sql:483`), and the composite keys admit only the event's
  own org.
- **Deferring the keys is the function's alone.** `set constraints` in a member's transaction is
  harmless: a member can reach no write that changes `org_id`.
- **Inside the move, member-facing triggers see the system admin's `auth.uid()`, which is never a
  member** (`member_refuse_system_admin`). So `membership_refuse_own_rows`, the self-lock of
  `member_enforce_role_and_removal` and `notify_attendance_deleted` (which returns early unless the
  deleter is the attendee) do not fire; `entry_enforce_decision` clause (a) does not fire because no
  decision column is written.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261111120000_mir15c_move_team_to_org.sql`

`begin; … commit;`, idempotent (ADR-024): `create or replace`, `alter constraint` restated, grants
restated. Header comment names ADR-093 and RULE-09.

**Item 1 — the nineteen keys become deferrable** (ADR-093 decision 6). One statement each, exactly:

```sql
alter table public.membership       alter constraint membership_team_org_fk         deferrable initially immediate;
alter table public.membership       alter constraint membership_member_org_fk       deferrable initially immediate;
alter table public.entry            alter constraint entry_member_org_fk            deferrable initially immediate;
alter table public.entry            alter constraint entry_primary_team_org_fk      deferrable initially immediate;
alter table public.entry            alter constraint entry_approved_by_org_fk       deferrable initially immediate;
alter table public.entry            alter constraint entry_rejected_by_org_fk       deferrable initially immediate;
alter table public.busy_day         alter constraint busy_day_member_org_fk         deferrable initially immediate;
alter table public.issue_report     alter constraint issue_report_member_org_fk     deferrable initially immediate;
alter table public.event            alter constraint event_creator_org_fk           deferrable initially immediate;
alter table public.event            alter constraint event_team_org_fk              deferrable initially immediate;
alter table public.event_invitee    alter constraint event_invitee_event_org_fk     deferrable initially immediate;
alter table public.event_invitee    alter constraint event_invitee_member_org_fk    deferrable initially immediate;
alter table public.event_attendance alter constraint event_attendance_event_org_fk  deferrable initially immediate;
alter table public.event_attendance alter constraint event_attendance_member_org_fk deferrable initially immediate;
alter table public.event_guest_link alter constraint event_guest_link_event_org_fk  deferrable initially immediate;
alter table public.event_guest      alter constraint event_guest_event_org_fk       deferrable initially immediate;
alter table public.notification     alter constraint notification_recipient_org_fk  deferrable initially immediate;
alter table public.notification     alter constraint notification_actor_org_fk      deferrable initially immediate;
alter table public.notification     alter constraint notification_event_org_fk      deferrable initially immediate;
```

**Item 2 — the list** (ADR-093 decision 8). Every column reference qualified, as `list_orgs` does.

```sql
create or replace function public.list_shared_teams()
  returns table (
    id             uuid,
    name           text,
    active_members integer,
    created_at     timestamptz
  )
  language plpgsql stable security definer set search_path = '' as $$
-- 42501 'not a system admin' unless public.is_system_admin().
-- Teams whose org has is_shared_tenant; active_members = count of membership rows on the team
-- with left_at is null; ordered by t.name, t.id.
$$;
```

**Item 3 — the move** (ADR-093 decisions 1–6).

```sql
create or replace function public.move_team_to_org(p_team_id uuid, p_target_org_id uuid)
  returns table (moved_members integer, deleted_links integer)
  language plpgsql volatile security definer set search_path = '' as $$
$$;
```

The body, in this order. Each refusal is `raise exception '<message>' using errcode = '<code>'`, with
`detail = <list>` where a list is named; the list is `string_agg(distinct …, ', ' order by …)`.

1. `42501` `'not a system admin'` unless `public.is_system_admin()`.
2. Lock the team: `select … from public.team where id = p_team_id for update`; not found →
   `P0002` `'team not found'`. Lock the target: `select … from public.org where id = p_target_org_id
   for update`; not found → `P0002` `'org not found'`.
3. The team's org is not `is_shared_tenant` → `22023` `'only a team of Org public can be moved'`.
   The target is `is_shared_tenant` → `22023` `'a team cannot be moved into Org public'`.
4. **Movers** into `v_movers uuid[]`: every `member_id` with a `membership` row on `p_team_id` where
   `left_at is null`; plus every member with no `membership` row where `left_at is null` whose row
   with the greatest `left_at` (ties: greatest `joined_at`, then `id`) is on `p_team_id`.
5. `MT001` `'a member of this team is on another team'`, detail = the movers' `display_name`s, when a
   mover holds a `membership` row with `left_at is null` on a team other than `p_team_id`.
6. `MT002` `'an event would be split from its creator'`, detail = the events' `name`s, for every
   `event` in the source org where `(team_id = p_team_id)` is distinct from
   `(creator_id = any (v_movers))`.
7. `MT003` `'an entry would be split from who decided it'`, detail = the owners' `display_name`s, for
   every `entry` in the source org where `approved_by is not null` and `(member_id = any (v_movers))`
   is distinct from `(approved_by = any (v_movers))` — and the same for `rejected_by`.
8. **Home team of a stayer** — for a member not in `v_movers` with an `entry` whose
   `primary_team_id = p_team_id`: their `membership` row with `left_at is null and is_primary`; if
   they hold no active row at all, the team of their row with the greatest `left_at` (as step 4).
   `MT004` `'a member who stays has no team to keep an entry on'`, detail = `display_name`s, if any
   such member has none.
9. `set constraints <the nineteen names of item 1, comma-separated> deferred;`
10. **Cut** (ADR-093 decision 5), all `where org_id = <source org>`, summing `row_count` into
    `deleted_links`. "Side" of a member is `= any (v_movers)`; of an event, `team_id = p_team_id`.
    - `notification` where the recipient's side differs from the actor's (`actor_id is not null`) or
      from the event's (`event_id is not null`);
    - `event_invitee` and `event_attendance` where the member's side differs from the event's;
    - `membership` where `left_at is not null` and `(member_id = any (v_movers))` is distinct from
      `(team_id = p_team_id)`.
11. **Re-point** `entry.primary_team_id`: a mover's entry with `primary_team_id <> p_team_id` gets
    `p_team_id`; a stayer's entry with `primary_team_id = p_team_id` gets the home team of step 8.
12. **Move** — `set org_id = p_target_org_id` on: `team` `p_team_id`; `member` in `v_movers`;
    `membership`, `entry`, `busy_day`, `issue_report` of `v_movers`; `notification` whose
    `recipient_id` is in `v_movers`; `event` with `team_id = p_team_id`; `event_invitee`,
    `event_attendance`, `event_guest_link` and `event_guest` whose `event_id` is one of those events.
    No other column is named in these statements.
13. `set constraints <the same nineteen> immediate;`
14. `return query select cardinality(v_movers), deleted_links;` (`coalesce(…, 0)` on an empty array).

**Item 4 — two guard clauses** (ADR-093 decision 7). `event_attendance_guard()` and
`event_guest_guard()` are re-created from their latest bodies
(`supabase/migrations/20261009150000_evt07_guest_registration.sql`), **copied character for
character**, with this one clause inserted as the first statement after `begin`:

```sql
  -- MIR-15-c, ADR-093 decision 7. A team moving to another org rewrites org_id and nothing else.
  if tg_op = 'UPDATE'
     and new.org_id is distinct from old.org_id
     and (to_jsonb(new) - 'org_id') = (to_jsonb(old) - 'org_id') then
    return new;
  end if;
```

The triggers that point at them are not touched.

**Item 5 — privileges.**

```sql
revoke all on function public.list_shared_teams() from public, anon;
revoke all on function public.move_team_to_org(uuid, uuid) from public, anon;
grant execute on function public.list_shared_teams() to authenticated;
grant execute on function public.move_team_to_org(uuid, uuid) to authenticated;
```

**Triggers that fire inside the move, read for this plan:** `entry_enforce_decision` (bumps
`updated_at`, writes nothing else when no decision column moves), `event_stamp` (bumps
`updated_at` on `event`; accepted, and AC-2 does not assert it — § 7 note),
`member_enforce_role_and_removal`, `membership_refuse_own_rows`,
`notify_attendance_deleted` (returns early). `notify_event_updated`'s `when` list does not name
`org_id` or `team_id`, so it does not fire.

### 4.2 pgTAP `supabase/tests/350-move-team-to-org.test.sql`

One file, one `plan(n)`. Seeded by `tests.seed()` (whose org is Org public), creating Org D, D1,
Dee, T, U and the cast of § 2 the way `160-read-path-org-bound.test.sql` and
`200-org-management.test.sql` create theirs, and signing Sam in at `aal2` the way
`200-org-management.test.sql` does. One assertion or more per AC-1 to AC-16. Each refusal case
(AC-9 to AC-13, AC-15) runs inside a savepoint and asserts "unchanged" by comparing the `org_id` of
every row of the cast before and after. Plus:

- a `pg_constraint` check: all nineteen constraints of § 4.1 item 1 have
  `condeferrable = true` and `condeferred = false`;
- an `event_attendance` update by a member that changes only `status` still meets
  `invalid_attendance_change` when the transition is not allowed (the guard clause did not widen).

### 4.3 Census — `supabase/tests/010-catalogue.test.sql`

`'public.list_shared_teams()'` and `'public.move_team_to_org(uuid,uuid)'` are added to the definer
census under a comment `-- MIR-15-c RPCs, 350-move-team-to-org.test.sql`, after the MIR-16 RPCs.

### 4.4 Panel seam — `src/lib/data/system.ts`

New section `// MIR-15-c — moving a team out of Org public. 01-plan.md § 4.4, ADR-093.`

```ts
/** One row of `public.list_shared_teams()`. ADR-093. */
export interface SharedTeam {
  id: string;
  name: string;
  activeMembers: number;
  createdAt: string;
}

export interface MoveTeamInput {
  teamId: string;
  targetOrgId: string;
}

/** The row `public.move_team_to_org()` returns. */
export interface TeamMoveSummary {
  movedMembers: number;
  deletedLinks: number;
}

export type MoveFailureCode =
  | "not_permitted" // 42501
  | "move_target_missing" // P0002
  | "invalid_move" // 22023
  | "member_on_other_team" // MT001
  | "event_split" // MT002
  | "decision_split" // MT003
  | "no_team_to_keep" // MT004
  | "network"; // anything else, or a throw

export type MoveResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: MoveFailureCode; message: string; detail: string | null } };

export const MOVE_FAILURE_MESSAGES: Record<MoveFailureCode, string> = {
  not_permitted: "You do not have permission to do that.",
  move_target_missing: "That team or org no longer exists. Reload to see the current list.",
  invalid_move: "Only a team of Org public can be moved, and only into a dedicated org.",
  member_on_other_team:
    "Someone on this team is also on another team in Org public. They must leave one of the two teams first.",
  event_split:
    "An event would end up in one org and its creator in the other. Delete that event first.",
  decision_split:
    "An entry was approved or rejected by someone who would end up in the other org.",
  no_team_to_keep:
    "Someone staying in Org public has an entry tied to this team and no other team to keep it on.",
  network: "Could not reach the server. Try again.",
};
```

Added to `interface SystemSeam`, after `issueImageUrls`:

```ts
  /** `rpc("list_shared_teams")`, mapped to camelCase. Never throws. MIR-15-c. */
  listSharedTeams(): Promise<MoveResult<SharedTeam[]>>;
  /** `rpc("move_team_to_org", { p_team_id, p_target_org_id })`, first row. Never throws. */
  moveTeamToOrg(input: MoveTeamInput): Promise<MoveResult<TeamMoveSummary>>;
```

Private to the module: `interface SharedTeamRpcRow { id: string; name: string; active_members:
number; created_at: string }`, `interface TeamMoveRpcRow { moved_members: number; deleted_links:
number }`, `toSharedTeam(row)`, `moveFailureCode(error: { code?: string }): MoveFailureCode` (the
mapping in the comments above), and `moveRefusal(code, detail: string | null = null)`. The Supabase
implementation puts PostgREST's `error.details` (string or absent) into `detail`.

**Mock implementation**, in the same file, beside `mockOrgs`. It imports `FIXTURE_TEAM`,
`FIXTURE_OTHER_TEAM` and `FIXTURE_OTHER_TEAM_MEMBER` from `@/lib/fixtures` (already imported from
there) and nothing from `./mock`:

```ts
const mockSharedTeams: SharedTeam[] = [
  { id: FIXTURE_TEAM.id, name: FIXTURE_TEAM.name, activeMembers: 3, createdAt: FIXTURE_TEAM.createdAt },
  { id: FIXTURE_OTHER_TEAM.id, name: FIXTURE_OTHER_TEAM.name, activeMembers: 1, createdAt: FIXTURE_OTHER_TEAM.createdAt },
];
```

- `listSharedTeams`: `not_permitted` unless `mockMaySeeOrgs()`; copies sorted by `name`.
- `moveTeamToOrg`: `not_permitted` unless `mockMaySeeOrgs()`; `move_target_missing` for an unknown
  team or org id; `invalid_move` when the target org `isSharedTenant`; `member_on_other_team` with
  `detail = FIXTURE_OTHER_TEAM_MEMBER.displayName` when the team is `FIXTURE_OTHER_TEAM`; otherwise
  the team is spliced out of `mockSharedTeams` and the value is
  `{ movedMembers: team.activeMembers, deletedLinks: 0 }`.

### 4.5 Panel — `src/system/main.tsx`

A new component `SharedTeams({ orgs }: { orgs: OrgSummary[] | null })`, rendered by
`OrgManagement` between the Orgs `<section>` and `<NationalHolidays />`, passed `OrgManagement`'s
`orgs` state. Layout § 2b. Every element named here carries exactly this `data-testid`:

| Element | `data-testid` |
|---|---|
| the `<section>` | `system-teams` |
| loading line | `system-teams-loading` |
| list error, and its retry | `system-teams-error`, `system-teams-retry` |
| empty line | `system-teams-empty` |
| the table wrapper | `system-teams-list` |
| a row, with `data-team-id={team.id}` | `system-team-row` |
| its name cell, its count cell | `system-team-name`, `system-team-members` |
| its **Move** button | `system-team-move` |
| the inline form | `system-move-form` |
| the target `<select>` (options: orgs with `isSharedTenant = false`, value = `id`, label = `name`) | `system-move-target` |
| `Create an org first.` | `system-move-no-target` |
| **Move team**, **Cancel** | `system-move-submit`, `system-move-cancel` |
| the refusal alert (`role="alert"`) | `system-move-error` |
| the success line (`role="status"`) | `system-move-done` |

The success line's text is exactly
`` `Moved ${team.name} to ${org.name} — ${movedMembers} members, ${deletedLinks} links removed.` ``.
The refusal alert's text is the message, then — only when `detail` is non-null — a second line
`` `In the way: ${detail}` ``. **Move team** is disabled while the call is in flight and when there is
no target. The list re-reads after a success (the `load` pattern of `OrgManagement`).

### 4.6 E2E — `tests/e2e/mir-15-c-move-team.spec.ts`

Against the mock build, signed in as `mir-18-b-org-management.spec.ts` signs in. Three tests: AC-17
(two rows, names and counts), AC-18 (move `CaleChip` to `Acme Studio`; `system-move-done` has the
exact text `Moved CaleChip to Acme Studio — 3 members, 0 links removed.`; no `system-team-row` with
`data-team-id` `11111111-1111-4111-8111-111111111111`), AC-19 (move `Nhóm khác`; `system-move-error`
contains the `member_on_other_team` sentence and `Người nhóm khác`; the row is still there).

## 5. Seam impact

**Member seam (`DataSeam`, `src/lib/data/index.ts`): none.** No function added, removed or
re-shaped.

**Panel seam (`SystemSeam`, `src/lib/data/system.ts`): two functions added**, `listSharedTeams()`
and `moveTeamToOrg(input)`, in both implementations in that file (`supabaseSystemSeam`,
`mockSystemSeam`) with the same names and arity. The panel seam has no parity test (the member
seam's `tests/seam-parity.test.ts` does not cover it, as for MIR-18-b and MIR-15-b); the type
`SystemSeam` is what holds the two objects to one shape.

## 6. Schema delta

**Not `none`** (ADR-014): two `security definer` functions added (`list_shared_teams()`,
`move_team_to_org(uuid, uuid)`); nineteen foreign-key constraints altered to `deferrable initially
immediate`; trigger functions `event_attendance_guard()` and `event_guest_guard()` replaced with one
clause added. No table, column, index or policy is added or dropped, and the migration updates no
row. **ADR-093**, accepted under ADR-067 at this PLAN. Applying it to the hosted project is
human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-093-a-system-admin-moves-one-team-out-of-org-public-and-every-link-to-a-person-who-stays-is-cut.md"
  - "supabase/migrations/20261111120000_mir15c_move_team_to_org.sql"
  - "supabase/tests/350-move-team-to-org.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/system.ts"
  - "src/system/main.tsx"
  - "tests/e2e/mir-15-c-move-team.spec.ts"
```

`size: M` — 7 paths. `size_estimate` and `size` agree at M. `glossary_owed` is `[]`; *Org public*,
*Membership* and *System admin* already have rows (`.ai/registry/glossary.md:64-66`), so no row is
written.

**Developer note on AC-2's `updated_at`.** `event_stamp` sets `new.updated_at := now()` on every
update of `public.event` (`20261103120000_mir13_write_path_org_bound.sql`), so step 12 as written
moves it. `event_stamp` is not in this list and is not to be edited; AC-2's `updated_at` clause is
therefore **withdrawn** in the Changelog below, and the assertion is `scope`, dates and name only.

## 8. Rejected alternatives

- **Cut every cross-org link, decisions included** — null the decider, delete the straddling event.
  Never refuses. Rejected: it erases the only record of who approved or rejected an entry (CAL-01's
  own comment, ADR-016 § 1), deletes an event other people attend, and needs a third trigger change
  to get past `entry_enforce_decision`. ADR-093 *Options considered*.
- **Refuse on every cross-org link, connections included.** Nothing is ever deleted. Rejected:
  before MIR-15 every `public` event notified every team, so nearly every existing team holds a
  cross-team notification or attendance nobody in the app can remove, and the move would refuse for
  all of them.
- **One statement of data-modifying CTEs, leaving the keys non-deferrable.** No constraint change.
  Rejected: correctness would rest on when PostgreSQL fires the referential checks queued by
  sub-statements — behaviour no test in this repository names — and a fourteen-CTE statement is the
  least reviewable thing the migration could contain.
- **A separate preview RPC listing everything a move would cut and everything in its way.** Better
  for the operator; rejected for this ticket because the refusals already name what is in the way
  (`detail`) and the cut is reported in the result. It is a second definer function with the same
  sides logic to keep in step with the first.

## Changelog

- `2026-11-11T07:10:00Z` — all sections written. Raised by `tech-lead-design`. **Sections 1 and 2
  were drafted after the schema was read, not before**: the ticket's three open questions are about
  which rows the composite keys allow, and could not be answered without the migrations. The order
  `/plan` asks for was not kept, and this is the record of it.
- `2026-11-11T07:10:00Z` — ADR-093 was written before its path was added to `allowed_paths`,
  the reverse of `/plan` § *Schema and ADRs* step 1. No guard refused it (ADR-004); the path is in
  the list now. Raised by `tech-lead-design`.
- `2026-11-11T07:10:00Z` — § 2 AC-2: *"and `updated_at`"* is withdrawn from the unchanged-columns
  clause. `event_stamp` bumps it on any update and is outside this ticket's paths (§ 7 note).
  Raised by `tech-lead-design`. Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-093** — one team per move, from Org public into a dedicated org only; caps do not refuse;
  movers are the team's active members plus team-less members whose last team it was; a split
  decision (`MT003`), a split event (`MT002`), a member on another team (`MT001`) or a stayer with
  nowhere to keep an entry (`MT004`) refuses the move; cross-org connections (notifications,
  invitations, attendances, ended memberships) are deleted; the nineteen composite keys become
  deferrable; two EVT guards let an `org_id`-only update through. Narrows ADR-070 § 3.
