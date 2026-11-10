---
ticket: MIR-13-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-03T06:55:00Z
inputs_read:
  - .ai/board/tickets/MIR-13-b/ticket.yaml
  - .ai/board/tickets/MIR-13/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md
  - .ai/registry/decisions/ADR-067-the-runner-pushes-merges-and-decides-blocked-questions-on-its-own.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - supabase/migrations/ (latest definition of every policy and function, inventoried 2026-11-03 after MIR-13)
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20260922150000_cal11_cross_team_reads.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20261020180000_mir04_scoped_member_directory.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261015120000_tsk01_task.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - src/lib/data/supabase.ts
  - src/lib/viewed-team.ts
  - src/hooks/usePageOverload.ts
  - src/components/OverloadWarning.tsx
  - src/components/EntryForm.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-13-b — the read slice: every read off `member_team_id()`, count-feeding reads on the primary team, admin reads bounded by org

## 1. Problem and scope

**Feature — MIR-13** (`.ai/registry/features.md:302`). MIR-13-b is its second ticket (ADR-071
decision 5):

> The policy layer is rewritten against `membership` and `org_id`, and no definer function trusts a client-supplied team id alone

MIR-13 rewrote the write path. This ticket rewrites the read path. Three things remain after MIR-13:

- **Readers of `member_team_id()`.** Eleven policies and six functions still read a single-valued
  helper over `member.team_id`.
- **Admin reads that reach every org.** Twelve reads admitted on `is_admin`, or on
  `scope = 'public'`, reach every org: `list_teams`, `list_all_members` and the three `cal11`
  functions trust `p_team_id` with no org check (audit A:370-371, A:383).
- **A live defect.** `notify_event_created` notifies every member of the deployment for a public
  event. Since MIR-13 stamps each notification with its recipient's org,
  `notification_event_org_fk` refuses the first recipient in another org. Creating a public event
  then fails as soon as a second org has a member.

**Who gains what.** No role gains a capability. An admin loses every read of another org. A member
on several teams sees the events and notifications of all of them. The calendar and the overload
warning stay on the member's primary team, so the absence count is never taken over a mixed
roster (ADR-072).

**Out of scope:**

- **A member viewing a secondary team's calendar.** No feature specifies the screen. It must be
  triaged before any writer creates a second active membership (ADR-072 decision 5).
- **Any change to `src/`, `tests/` or the mock.**
  - `getTeam()`'s `.maybeSingle()` cannot see two rows, because `team_select_own` stays single-valued
    on the primary team (ADR-072 decision 1).
  - The overload warning cannot count against a team other than the one whose entries it reads
    (ADR-072 *Consequences*).
  - No seam function changes signature or answer for a caller in one org on one team.
- **Dropping `member_team_id()`** — MIR-21, with `member.team_id` (ADR-072 decision 4).
- **Moving readers of the `member.team_id` column** (ADR-072 *Consequences* lists them) — MIR-21.
- **Org public special cases.** These are:
  - team-only directory in a shared tenant;
  - public events not reaching outside the team;
  - notifications not crossing teams in a shared tenant.

  They belong to MIR-15. Here, `scope = 'public'` reaches the caller's whole org, which today is the
  whole deployment's only populated org.
- **Approval queues across teams** — MIR-14.
- **Applying the migration to the hosted project** — human-only (RULE-09).

`size_estimate: M`

## 2. Acceptance criteria

`verification_required: true`. The pgTAP run is the verification. Its output goes in `03-impl-log.md`.

Fixture names, as MIR-13's plan used them:

- **Org A** is the shared tenant.
- **Org B** is a dedicated org.
- **Admin A** is an approved admin of Org A, with primary team **T1**.
- **T3** is a second team of Org A.
- **K** is an approved member of Org A, with primary membership on T1 and an active non-primary
  membership on T3. The test inserts the non-primary row as the owner.
- **N** is an approved member with primary T3.
- **T2** is a team of Org B. Its rows are:
  - approved member **M2** and pending sign-up **P2**;
  - entry **E2**, busy day **B2**, issue report **R2**, and an issue image under folder `M2`;
  - public event **V2**.

**AC-1 — No policy or function reads `member_team_id()` any more**
- Given the migration is applied
- When `pg_policies` (`qual`, `with_check`, every schema) and `pg_proc.prosrc` (schema `public`, `proname <> 'member_team_id'`) are searched for the regex `member_team_id\(`
- Then both counts are `0`
- And `public.member_team_id(uuid)` still exists

**AC-2 — Own-team reads return the primary team only, so `getTeam()` sees one row**
- Given K is authenticated
- When K selects from `public.team`
- Then exactly one row is returned, and it is T1
- And when K selects from `public.member` where `team_id is not null`, every row has `team_id = T1` or is K's own row
- And when K selects from `public.entry`, every row's author has primary team T1, and N's entries are not returned
- And when K selects from `public.busy_day`, every row's member is on T1

**AC-3 — Own-team reads are unchanged for a member on one team**
- Given the migration and the existing suite
- When `pnpm db:test` runs
- Then `020-entry-reads`, `030-member-reads`, `060-removed-and-pending`, `070-definer-callers`, `090-event-boundaries` and `100-mock-parity` pass with no edit

**AC-4 — Visibility reads span every active team**
- Given N creates an event with `scope = 'team'` (its `team_id` is T3)
- When K selects it, and `may_read_event(<it>, K)` is evaluated
- Then K reads the row, and the function is `true`
- And K receives an `event_created` notification for it
- And `list_member_directory()` called by K returns N (T3 is one of K's teams)

**AC-5 — `scope = 'public'` reaches the caller's org and no further**
- Given Admin A and K are authenticated in turn
- When each selects V2, and `may_read_event(V2, <caller>)` is evaluated
- Then no row is returned and the function is `false`, including for Admin A

**AC-6 — Creating a public event notifies the creator's org only, and succeeds**
- Given Org B has an approved member M2
- When a member of Org A inserts an event with `scope = 'public'`
- Then the insert succeeds
- And `event_created` notifications exist for the other approved members of Org A, and none exists for M2

**AC-7 — Admin cross-team reads are bounded by org and do not trust `p_team_id`**
- Given Admin A is authenticated
- When `list_members_for_team(T2)`, `list_team_entries_for_team(T2)` and `list_team_entries_overlapping_for_team(T2, <a range containing E2>)` are called
- Then each returns zero rows
- And when the same three are called with T3, they return T3's members and their entries, as before
- And `list_teams()` returns T1 and T3 and not T2
- And `list_all_members()` returns no member of Org B

**AC-8 — Every other `is_admin` read is bounded by org**
- Given Admin A is authenticated
- When Admin A selects `public.member` where `status <> 'approved'`
- Then P2 is not returned
- And `public.issue_report` does not return R2
- And `storage.objects` in bucket `issue-report` does not return M2's image
- And `list_member_directory()` does not return M2
- And `public.event` does not return V2

**AC-9 — The guards still refuse a person on no team**
- Given a pending sign-up of Org A is authenticated, with a `task`, a `notification` and an `event_attendance` row inserted for it by the owner
- When it selects each of those tables, and calls `list_member_directory()`
- Then every read returns zero rows

**AC-10 — `save_event` treats an invitee with no active team as before**
- Given an event whose invitee list holds a removed member
- When `save_event` is called by the creator with that invitee
- Then it answers exactly as before this migration (`090-event-boundaries` passes unchanged)

**AC-11 — The new pgTAP file covers AC-1, AC-2 and AC-4 to AC-9, and everything is green**
- Given `supabase/tests/160-read-path-org-bound.test.sql`
- When `pnpm db:test` and the four commands in `.ai/standards/testing-standards.md` run
- Then all exit 0

**AC-12 — Nothing in the datastore consults the threshold**
- Given the new migration
- When `tests/draft-entry.test.ts` AC-14 scans `supabase/migrations/`
- Then it passes. No statement in the migration mentions `overload_threshold`

**Invariants touched:**

- **INV-04** — `member_select_team`, `entry_select_team`, `busy_day_select_team` and
  `team_select_own` are the inputs `absenceCountsFor` receives. They are rewritten to one team, the
  primary, so the count is taken over one team's roster and entries, against that team's threshold
  (AC-2). Held by those four policies. `absenceCountsFor` is not touched, so no second definition
  appears.
- **INV-07** — An entry stays visible to and counted on its author's primary team. Counting it on
  each further team needs the secondary-team view that ADR-072 decision 5 leaves to a future
  feature. Under ADR-071's mirror no member has a further team, so the invariant holds today, by
  `membership_one_active_primary_idx` plus the absence of any writer of non-primary rows.

**Open questions:** none.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

This ticket changes no screen. There is no layout to originate.

## 3. Permission model

All enforced in the database. No interface gate changes.

| Read | Who sees what | Must not | Where |
|---|---|---|---|
| Roster, entries, busy days, own team row | the caller's primary team | another team, even one the caller is on (ADR-072 decision 1) | `member_select_team`, `entry_select_team`, `busy_day_select_team`, `team_select_own` |
| Own row, own entries, own tasks | the caller | — | unchanged own-row policies; `task_*` guard on any active team |
| Events, attendance, guests | events the caller may read: own, invited, participating, team-scope on any of the caller's teams, public in the caller's org, any in the caller's org for an admin | another org's events, public or not (AC-5, AC-8) | `event_select_visible`, `may_read_event`, `event_attendance_select_visible`, `event_guest_select_visible` |
| Notifications | own, while on a team | — | `notification_select_own` |
| Directory | ADR-066's set, within the caller's org; own team means any of the caller's teams | anyone in another org | `list_member_directory` |
| Pending sign-ups, issue reports, issue images, every team, every roster, any team's entries | an admin, in the admin's own org | an admin reading another org (AC-7, AC-8) | `member_select_pending_admin`, `issue_report_select_admin`, `issue_image_select_admin`, `list_*` |

Check R6 reads this table.

## 4. Contract

**One migration file**, `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql`, in one
transaction. **No new function, no new table, no new column, no grant change.** Every rewritten
object keeps its name, signature, return type, volatility and `security definer set search_path = ''`.
Every policy is `drop policy if exists` then `create policy`, with the same table, command and
`to authenticated`.

The helpers are MIR-13's: `member_org_id`, `member_team_ids`, `member_primary_team_id`. `caller` below
stands for `(select auth.uid())`, written out in full in the SQL. `has_team(x)` stands for
`exists (select 1 from public.member_team_ids(x))`.

### 4.1 Count-feeding policies — primary team (ADR-072 decision 1)

| Policy | `using` after |
|---|---|
| `member_select_team` | `team_id = public.member_primary_team_id(caller)` |
| `team_select_own` | `id = public.member_primary_team_id(caller)` |
| `entry_select_team` | `public.member_primary_team_id(member_id) = public.member_primary_team_id(caller)` |
| `busy_day_select_team` | `exists (select 1 from public.member m where m.id = public.busy_day.member_id and m.team_id = public.member_primary_team_id(caller))` |

### 4.2 Visibility policies and functions — every team (ADR-072 decision 2), org-bounded (decision 3)

```sql
-- may_read_event(p_event_id uuid, p_uid uuid) returns boolean
select exists (select 1 from public.member_team_ids(p_uid))
   and exists (
     select 1 from public.event e
      where e.id = p_event_id
        and e.org_id = public.member_org_id(p_uid)
        and (public.is_admin(p_uid)
             or e.creator_id = p_uid
             or e.scope = 'public'::public.event_scope
             or (e.scope = 'team'::public.event_scope
                 and e.team_id in (select public.member_team_ids(p_uid)))
             or (e.scope = 'named'::public.event_scope
                 and public.is_event_invitee(e.id, p_uid))
             or public.is_event_participant(e.id, p_uid))
   );
```

| Object | After |
|---|---|
| `event_select_visible` | `has_team(caller) and org_id = public.member_org_id(caller) and (is_admin(caller) or creator_id = caller or scope = 'public' or (scope = 'team' and team_id in (select public.member_team_ids(caller))) or (scope = 'named' and is_event_invitee(id, caller)) or is_event_participant(id, caller))` |
| `event_attendance_select_visible`, `event_guest_select_visible`, `notification_select_own`, `task_select_own`, `task_insert_own`, `task_update_own`, `task_delete_own` | `member_team_id(caller) is not null` becomes `has_team(caller)`; nothing else changes |
| `notify_event_created()` | recipients: `m.org_id = new.org_id and has_team(m.id) and (new.scope = 'public' or new.team_id in (select public.member_team_ids(m.id)))` |
| `save_event(...)` | `public.member_team_id(i.member_id) is null` becomes `not has_team(i.member_id)`; nothing else changes |
| `list_member_directory()` | adds `and m.org_id = public.member_org_id(caller)` to the outer `where`. `member_team_id(caller) is not null` becomes `has_team(caller)`. `m.team_id = member_team_id(caller)` becomes `m.team_id in (select public.member_team_ids(caller))`. Every other disjunct is unchanged (ADR-066) |

### 4.3 Admin reads — bounded by org (ADR-072 decision 3)

`team_in_org(t)` stands for
`exists (select 1 from public.team t2 where t2.id = t and t2.org_id = public.member_org_id(caller))`.

| Object | After |
|---|---|
| `list_teams()` | `where public.is_admin(caller) and t.org_id = public.member_org_id(caller)` |
| `list_all_members()` | `where public.is_admin(caller) and m.org_id = public.member_org_id(caller) and m.team_id is not null` |
| `list_members_for_team(p_team_id)` | `where public.is_admin(caller) and team_in_org(p_team_id) and m.team_id = p_team_id` |
| `list_team_entries_for_team(p_team_id)` | `where public.is_admin(caller) and team_in_org(p_team_id) and public.member_primary_team_id(e.member_id) = p_team_id` |
| `list_team_entries_overlapping_for_team(p_team_id, p_start, p_end)` | as above, `and e.date_range && daterange(p_start, p_end, '[]')` |
| `member_select_pending_admin` | adds `and org_id = public.member_org_id(caller)` |
| `issue_report_select_admin` | `public.is_admin(caller) and org_id = public.member_org_id(caller)` |
| `issue_image_select_admin` (`storage.objects`) | `bucket_id = 'issue-report' and public.is_admin(caller) and exists (select 1 from public.member m where m.id::text = (storage.foldername(name))[1] and m.org_id = public.member_org_id(caller))` |

`member_primary_team_id(e.member_id)` replaces `member_team_id(e.member_id)` with the same answer
under ADR-071's mirror. Both helpers filter out removed and unapproved members, so the set of
entries returned does not change.

### 4.4 Seam and types

No change. `getTeam`, `listMembers`, `listTeams`, `listAllMembers`, the three `*_for_team` reads,
and every RPC argument name are untouched. No new definer function appears, so
`010-catalogue.test.sql`'s census is unchanged.

## 5. Seam impact

None. No seam function is added, renamed or re-signed. For a caller in one org on one team, every
rewritten predicate gives the answer it gave before (AC-3). The mock and `100-mock-parity` need no
edit.

## 6. Schema delta

**Non-none.** Policies and definer functions change (ADR-014). No table, column, constraint or
trigger changes. The rules come from:

- [ADR-072](../../../registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md),
  which amends
  [ADR-071](../../../registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md)
  decision 5;
- [ADR-070](../../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md)'s org
  model.

No migration is applied by this ticket (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md"
  - "supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql"
  - "supabase/tests/160-read-path-org-bound.test.sql"
```

`glossary_owed` is `[]`, so no glossary rows are owed.

**`size`: 3 paths → S.** `size_estimate` was M, written from the ticket shell's
`mir_detail`, which assumed `getTeam()`, the overload warning and the mock would change. ADR-072
decision 1 makes all three unnecessary, so the verdict (S) and the estimate (M) disagree for that
reason.

**`/ship` for MIR-13-b closes feature MIR-13**, because both slices are then `DONE`. The `MIR-13` row
in `features.md` may go `DONE` at that ship.

## 8. Rejected alternatives

**1. Every read on `member_team_ids`, as ADR-071 decision 5 worded it.** Plausible because it is the
literal plan item, and it gives a multi-team member "every team they belong to" everywhere.
Rejected because the own-team calendar's four reads take no team argument. Under a set-valued
predicate they would return two teams' rosters and entries against one team's threshold. That is a
second, unnamed definition of the absence count (INV-04), and `getTeam()` would raise. ADR-072
records it.

**2. Keep the set-valued predicates, and re-route the own-team calendar through `*_for_team` for each
of the caller's teams**, opening those functions to members of the team. This is correct, and it is
where a multi-team member's calendar ends up. Rejected here for three reasons:
- it changes `viewed-team.ts`, both overload readers, the mock and the parity table;
- it changes who may call three RPCs;
- it needs a team picker for members that no feature describes.

That makes it `L`, with an invented screen. ADR-072's revert condition names when it becomes right.

**3. Fix `getTeam()` in the client with a new `get_own_team()` RPC.** Rejected: it adds a definer
function, a census row and a seam change to fix a read that a single-valued policy already keeps to
one row.

## Delegated decisions

- ADR-072 amends ADR-071 decision 5: count-feeding reads resolve to the primary team, not to
  `member_team_ids`. Accepted under ADR-067.

## Changelog

- `2026-11-03T06:55:00Z` — initial plan. tech-lead-design.
  - Sections 1 and 2 were first drafted with every read on `member_team_ids`. Reading `viewed-team.ts`
    and the two overload readers showed the four count-feeding reads take no team argument, so AC-2
    was rewritten to the primary team (ADR-072). The original reading is Rejected alternative 1.
  - The ticket shell's title promises that `getTeam()` and the overload warning "survive a member on
    several teams". Under this design they survive by construction (AC-2), with no client edit.
