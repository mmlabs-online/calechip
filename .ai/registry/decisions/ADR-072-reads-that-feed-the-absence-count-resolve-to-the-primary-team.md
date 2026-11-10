---
doc_version: 3
last_updated: 2026-11-03
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-072 — Reads that feed the absence count resolve to the caller's primary team; visibility reads use every team; admin reads are bounded by org

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)` — 2026-11-03, at
`/plan MIR-13-b`.

**This ADR amends [ADR-071](ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md)
decision 5.** That decision gave the read slice as *"every `select` policy and every read definer
function moved to `member_team_ids` and `org_id`"*. Moving every read to `member_team_ids` breaks
INV-04, for the reason in *Context* below. Some policies therefore move to
`member_primary_team_id` instead. ADR-071's other decisions stand.

## Context

- **The own-team calendar takes its roster, entries, busy days and threshold from four
  policy-filtered reads, and none of them takes a team argument.**
  - The reads are `listMembers` (`member_select_team`), `listTeamEntriesOverlapping`
    (`entry_select_team`), `listTeamBusyDaysOverlapping` (`busy_day_select_team`) and `getTeam`
    (`team_select_own`). See `src/lib/viewed-team.ts:113-133`, `src/hooks/usePageOverload.ts:117-121`
    and `src/components/OverloadWarning.tsx:122-127`.
  - `absenceCountsFor` computes the count from whatever those reads return.
- **Under a set-valued predicate, a member on teams T1 and T3 would get the union of both rosters and
  both teams' entries, against one team's threshold.** That is a count for no team: a second
  definition of the number, which INV-04 forbids. `getTeam()`'s `.maybeSingle()` would also raise
  (audit A:980, A:996).
- **The other reads do not feed the count.** They are event visibility, attendance, guests,
  notifications, the directory, and the "is on a team" guard on tasks. Under INV-07 and ADR-059 a
  member sees what each of their teams sees, so these reads should use every team.
- **Today every member has at most one active membership.** No writer creates a second one
  (ADR-071 decision 2). So the choice changes no answer today. It decides what is correct on the day
  a second membership first appears.

## Decision

1. **Reads that feed the absence count resolve to the caller's primary team** —
   `member_primary_team_id(auth.uid())`:
   - `member_select_team`
   - `entry_select_team`
   - `busy_day_select_team`
   - `team_select_own`

   Each is the same single-valued predicate it was under `member_team_id`, so `getTeam()` cannot see
   two rows, and its `.maybeSingle()` is correct by construction. This is the same move ADR-071
   decision 3 made for `team_update_admin`.
2. **Visibility reads use every active team** — `member_team_ids(auth.uid())`:
   - `event_select_visible`, `may_read_event` and `notify_event_created` (`scope = 'team'`)
   - `list_member_directory` (own-team clause)
   - every `member_team_id(x) is not null` guard

   The guards are in `event_attendance_select_visible`, `event_guest_select_visible`,
   `notification_select_own`, `task_*`, `save_event`, `may_read_event`, `event_select_visible` and
   `list_member_directory`.
3. **Every read admitted on `is_admin`, and every `scope = 'public'` reach, is bounded by the caller's
   org.** The target row's `org_id`, or the target team's `org_id`, must equal
   `member_org_id(auth.uid())`. This covers:
   - `list_teams`, `list_all_members`
   - `list_members_for_team`, `list_team_entries_for_team`, `list_team_entries_overlapping_for_team`
   - `list_member_directory`, `member_select_pending_admin`
   - `issue_report_select_admin`, `issue_image_select_admin`
   - `event_select_visible`, `may_read_event`, `notify_event_created`
4. **`member_team_id()` is left with no reader**, and is not dropped here. MIR-21 drops it with
   `member.team_id`, which it reads. Dropping it now would break the 100-mock-parity case table
   (`supabase/tests/100-mock-parity.test.sql:200`), which is outside this slice.
5. **A non-primary team is reached only through the explicit `*_for_team` reads**, and only by an
   admin of that team's org, as today. A member reading a secondary team of their own needs a
   screen, and no feature provides one. It must be triaged before any writer creates a second active
   membership.

## Options considered

- **Every read on `member_team_ids`, as ADR-071 decision 5 worded it.** Rejected: it breaks INV-04
  (see *Context*).
- **Every read on `member_team_ids`, with the own-team calendar re-routed through `*_for_team(teamId)`
  for each of the caller's teams.** This is correct, and it is where a multi-team member's calendar
  will end up. Rejected for this ticket for three reasons:
  - It changes `viewed-team.ts`'s own branch, both overload readers and the mock.
  - It changes who may call `*_for_team` (members as well as admins), together with its parity and
    unit tests.
  - It needs a team picker for members that no feature specifies. That is `L` and invents a screen.
- **A new `get_own_team()` RPC for `getTeam()`.** Rejected: it adds a definer function to fix a read
  the policy can make single-valued itself.

## Consequences

- The four own-team policies keep exactly today's answer under ADR-071's mirror. Every
  same-org pgTAP and vitest case keeps passing unchanged.
- A member on two teams sees the events and notifications of both, but sees the calendar and the
  overload warning of their primary team only. The warning is therefore never computed over a mixed
  roster. Audit A:995 (the warning using the caller's own team while another is viewed) cannot occur:
  - an `other` view is read-only and mounts no entry form (`isReadOnly`, `src/lib/viewed-team.ts:90-92`);
  - an entry the caller can open is, by `entry_select_team`, an entry of the caller's primary team.
- `member.team_id` (the column) still has readers after this ADR: `member_select_team`,
  `busy_day_select_team`, `list_members_for_team`, `list_all_members`, `list_member_directory`,
  `delete_team`, and the seam's `.not("team_id", "is", null)`. Moving them is MIR-21's job.

## Revert condition

When a feature gives a member a view of a secondary team, decision 1 is replaced in that ticket. The
own-team reads take a team argument, and the four policies move to `member_team_ids`.
