---
doc_version: 3
last_updated: 2026-11-05
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-077 — A member's roster team is read from `membership`, not `member.team_id`; MIR-21 splits by operation, reads first, and the column is dropped in MIR-21-b

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-05 — at `/plan MIR-21` (ADR-008, ADR-067).

This ADR supersedes and reverses no accepted ADR. It carries out
[ADR-071](ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md)
decision 2 (*"MIR-21 drops `member.team_id`, and with it this trigger, once the writers move to
`membership` directly"*) and
[ADR-072](ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md) decision 4 and
*Consequences* (*"Moving them is MIR-21's job"*). Both still hold for feature MIR-21; this ADR
decides how its two tickets divide the work and what replaces the column for a reader.

## Context

- **`member.team_id` still has readers and writers.** Read from the latest definition of each object
  in `supabase/migrations/`:
  - Read policies and read functions: `member_select_team`, `member_select_pending_admin`,
    `busy_day_select_team`, `list_all_members`, `list_members_for_team`, `list_member_directory`
    (`20261103180000_mir13b_read_path_org_bound.sql`).
  - The seam: `MEMBER_COLUMNS` selects `team_id` (`src/lib/data/supabase.ts:979-980`), and
    `listMembers`, `listPendingMembers` and `countPendingMembers` filter on it (`:1667`, `:1750`,
    `:3391`). `listAllMembers` takes `list_all_members`'s whole row (`:2432`).
  - Writers and write-side predicates: `admit_member`, `move_member`, `set_member_team`,
    `reject_member`, `set_member_role`, `promote_member_to_admin`, `delete_team`,
    `grant_system_admin`, `member_decide_admin`, `member_enforce_role_and_removal`,
    `admit_allow_listed_member`, `stamp_org_id` (the `member` branch) and the mirror
    `member_sync_membership` itself.
  - Fixtures that insert `member.team_id`: thirteen pgTAP files, `supabase/seed.sql`,
    `supabase/bootstrap.sql` and `supabase/create-account.sql`.
- **Done in one ticket it is `L`.** About eighteen paths, against `.ai/01-operating-model.md`
  § *Sizing*. `L` must split at PLAN.
- **A removed member keeps `member.team_id`, but their `membership` rows are closed.** The mirror
  closes every active row at removal with `left_at = greatest(removed_at, joined_at)` and
  `is_primary = false` (`20261103120000_mir13_write_path_org_bound.sql`, `member_sync_membership`).
  `member_primary_team_id` returns null for them.
- **The roster must still carry removed members, with their team.** `listMembers` deliberately does
  not filter on `removed_at`, because INV-04 counts a removed member's entries on the dates they were
  still on the team (ADR-013; `supabase.ts:1729-1731`). `member_select_team` and
  `busy_day_select_team` admit a removed member's row today because they compare the column, not an
  active membership.
- **"No team" means a waiting or rejected sign-up.** `admit_member` sets the column and
  `reject_member` nulls it. An approved member always has one. So `team_id is null` is the queue's
  definition (`member_select_pending_admin`, `listPendingMembers`, `countPendingMembers`).

## Decision

1. **A member's roster team is read from `membership`.** It is the team of the member's active
   primary row. For a removed member it is the team of the row their removal closed
   (`left_at = greatest(member.removed_at, joined_at)`). Otherwise it is null. Under ADR-071's
   mirror this equals `member.team_id` for every row, by construction.
2. **One SQL helper carries it, and one PostgREST computed field exposes it.**
   - `public.member_roster_team_id(uuid)` is the helper. Policies and definer functions call it.
   - `public.roster_team_id(public.member)` is the computed field. The seam selects it as
     `team_id:roster_team_id` and filters on `roster_team_id`. `MemberRow` and `toMember` keep their
     shape, so no shared type changes.
3. **Every reader moves in MIR-21; every writer moves, and the column goes, in MIR-21-b.** The order
   is the reverse of ADR-071 decision 5. There, writes moved first so that the reads would stay
   correct. Here the mirror already keeps the two sources equal, so either order is safe while the
   column exists. Reads go first because:
   - each read can be proved equal to the column it replaces while the column is still there;
   - once nothing reads the column, MIR-21-b's fixture edits change no read result.
4. **The read slice changes no answer.** Every replaced predicate returns the same rows under the
   mirror. The directory reports the primary team of each member it lists, so a member on two teams
   still produces one directory row.
5. **MIR-21-b moves every writer onto `membership` directly.** It then drops the
   `member_sync_membership` trigger and function, `public.member_team_id(uuid)` and the
   `member.team_id` column. It also rewrites the fixtures. It plans its own contract, and splits
   again at its own PLAN if its count is `L`.
6. **Features MIR-16, MIR-17, MIR-19 and MIR-20 are blocked by MIR-21-b as well as MIR-21.** They
   were blocked on the column being dropped. MIR-16 and MIR-19 also rewrite the writer functions
   MIR-21-b rewrites.

## Options considered

- **One ticket: readers, writers, the drop and every fixture.** Rejected: it is `L` (*Context*).
- **Writers first, readers second, as ADR-071 decision 5 ordered MIR-13.** Rejected. A writer that
  stops setting the column makes every reader still on the column wrong for every person admitted or
  moved afterwards, unless the trigger is also reversed to write the column from `membership`. A
  two-way mirror is the "eight copies" ADR-071 decision 2 rejected, in a new direction.
- **Name the computed field `team_id`, so the seam needs no edit after the drop.** Rejected. While
  the column exists, PostgREST resolves `team_id` to the column, so the read slice could not show
  that the computed field gives the same answer. It would also keep a single-valued "team of a
  member" under the column's old name, which multi-team membership has made untrue.
- **A view (`member_with_team`) for the seam to read.** Rejected. A view needs its own RLS reasoning
  (`security_invoker`), and every `.from("member")` in the seam would have to move to it. The
  computed field keeps the table, its policies and every call site.
- **Roster team = active primary only, dropping removed members from the roster.** Rejected: it
  changes INV-04 for every past date a removed member was on the team (ADR-013).

## Consequences

- `supabase/tests/010-catalogue.test.sql`'s definer census gains `member_roster_team_id(uuid)`.
- While the column exists, a pgTAP test can assert, for every row of `public.member`, that
  `team_id is not distinct from member_roster_team_id(id)`. MIR-21-b cannot repeat that test after
  the drop, so this is where the equivalence is proved.
- `member_select_team`, `busy_day_select_team`, `member_select_pending_admin`, `list_all_members`,
  `list_members_for_team` and `list_member_directory` stop reading the column. After MIR-21, its only
  remaining uses are by writers.
- `list_all_members` and `list_members_for_team` still `return setof public.member`, so after the
  drop their rows carry no team column. The seam reads the team from the computed field on both
  (`.select(MEMBER_COLUMNS)`), as `listMembersForTeam` already does.
- Calling `member_roster_team_id` with any id tells an authenticated caller that member's team uuid.
  `member_primary_team_id` and `member_team_ids` already allow the same. This ADR adds no new kind of
  exposure, and it does not close the existing one either.

## Revert condition

A feature gives a member a view of a secondary team (ADR-072 *Revert condition*). The roster stops
being single-valued per member, and the computed field is replaced by a team-scoped roster read.
