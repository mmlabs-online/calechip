---
doc_version: 3
last_updated: 2026-11-03
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-071 — Writers stamp `org_id`, `membership` mirrors `member.team_id` until MIR-21, and MIR-13 splits into a write slice and a read slice

## Status

`ACCEPTED by tech-lead-design` — 2026-11-03, at `/plan MIR-13`, under ADR-008.

This ADR supersedes and reverses no accepted ADR. It applies
[ADR-070](ADR-070-the-org-and-multi-team-membership-schema.md) § 4 (`org_id not null`,
`primary_team_id not null`, `holiday_org_id_date_key`), which MIR-12 deferred to MIR-13
(`.ai/board/tickets/MIR-12/01-plan.md` Changelog 2026-10-31T12:17:00Z). It decides four things
ADR-070 left open: who writes `org_id` on a new row, who keeps `membership` true while
`member.team_id` is still the column every writer sets, which team a team-level setting writes to
when the caller is on more than one, and how MIR-13 is cut to a size the loop accepts.

## Context

- MIR-12 backfilled every `org_id` and `membership` but left the columns nullable, because no writer
  supplied `org_id` (`090-event-boundaries.test.sql:82`, `:103`; the admission trigger
  `20260913090000_solo_avatar_images.sql:63-79`). MIR-13 owns `SET NOT NULL` and the holiday key swap.
- No writer in the product writes `public.membership`. `admit_member`, `move_member`,
  `set_member_team`, `reject_member`, the admission trigger, member removal and `set_member_role`
  all write `member.team_id`, `member.role` or `member.removed_at` only
  (`20260911180000_solo_many_teams.sql:151-206`, `20261020120000_mir02_member_self_writes.sql:172-225`,
  `20260924100000_solo_cross_team_role.sql:92-120`). `bootstrap.sql:216-217` is the one exception.
  A policy rewritten to read `membership` would therefore stop seeing every person admitted or moved
  after MIR-12.
- `setOverloadThreshold` and `setApprovalSettings` send no team id and let `team_update_admin`
  choose the row (`src/lib/data/supabase.ts:2358-2366`, `:2606-2611`). Under a set-valued team
  predicate that statement updates every team the caller is on (audit A:403-404, A:990-991).
- Plan item P3-4 (`.ai/board/plans/calechip-multi-tenancy-plan.md:189-194`) touches every policy in
  audit § 5 and about thirty definer functions. Counted against `.ai/01-operating-model.md` § Sizing
  it is `L`, which must split at PLAN.

## Decision

### 1. `org_id` is stamped by the database on insert, never required from the client

One `before insert` trigger per org-scoped table fills `org_id` **only when the inserted value is
null**, from the row's parent:

| Table | `org_id` comes from |
|---|---|
| `team` | the caller's org (`member_org_id(auth.uid())`), else the shared tenant |
| `member` | the org of `new.team_id`, else the shared tenant |
| `holiday` | the caller's org, else the shared tenant |
| `entry`, `busy_day`, `issue_report` | the `member` row of `new.member_id` |
| `event` | the `member` row of `new.creator_id` |
| `notification` | the `member` row of `new.recipient_id` |
| `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest` | the `event` row of `new.event_id` |

`entry.primary_team_id`, when null, is the author's active primary team.

**The shared tenant is the fallback** because it is the only org a row with no derivable owner can
belong to today: every team and every sign-up is in Org public (MIR-12), self-serve org signup is
out of scope (ADR-059 § *Out of scope* item 5), and routing a sign-up to a dedicated org is
MIR-19's `/{org_code}`. When MIR-19 lands, its admission path supplies `org_id` and the fallback
stops being reached for members.

A supplied value is kept. For a child table the composite foreign keys of ADR-070 § 4 refuse a
mismatched org. For `team` and `holiday`, which have no parent, the write paths in decision 4 bound
the value to the caller's org.

### 2. `membership` mirrors `member.team_id` until MIR-21

An `after insert or update` trigger on `public.member` keeps one active primary `membership` row equal
to what MIR-12's backfill rule (ADR-070 § 3) yields for the member's current row:

- `team_id` changes: the active primary row of the old team is closed (`left_at = now()`,
  `is_primary = false`). If the new value is not null, an active row on the new team becomes primary,
  or is inserted with `joined_at = now()`.
- `removed_at` goes from null to a value: every active row is closed with
  `left_at = greatest(removed_at, joined_at)` and `is_primary = false`.
- `role` changes: the active primary row's `team_role` is `'manager'` exactly when
  `role = 'manager'`.
- On insert with a non-null `team_id`, the row MIR-12's backfill would have written is inserted.

**Why a trigger, not each writer:** seven writers and the admission trigger change those columns,
and a mirror maintained in eight places is eight chances to diverge. One trigger is the single
writer. It is temporary by construction. MIR-21 drops `member.team_id`, and with it this trigger,
once the writers move to `membership` directly.

### 3. A team-level setting written without a team id writes the caller's primary team

`team_update_admin` admits only `id = member_primary_team_id(auth.uid())`. The two setters keep
their signatures (`SetOverloadThresholdInput`, `SetApprovalSettingsInput`), and their statement now
reaches exactly one row. **No client-supplied team id is trusted, because none is sent.** Choosing a
named team from a screen is a per-team role question and belongs to MIR-16 and MIR-17.

### 4. Every admin-gated write is bounded by the caller's org

Every `security definer` write function and every write policy that admits on `is_admin` also
requires the target row's org, or the target team's org, to equal `member_org_id(auth.uid())`. Every
`member_team_id(a) = member_team_id(b)` predicate on a write path becomes "`a` and `b` share an active
team" (`shares_active_team`). A `member_team_id(x) is not null` guard becomes "`x` has an active
team".

### 5. MIR-13 splits by operation: the write slice first, then the read slice

- **MIR-13** is the write slice: decisions 1 to 4, `SET NOT NULL`, the holiday key swap, and the
  helpers `member_org_id`, `member_team_ids`, `member_primary_team_id` and `shares_active_team`.
- **MIR-13-b** is the read slice: every `select` policy and every read definer function moved to
  `member_team_ids` and `org_id`, `getTeam()`, and the overload warning for a team other than the
  caller's own.

**Write first, against the operating model's usual order (read, then write).** A read moved onto
`membership` before any writer maintains it hides everybody admitted or moved after MIR-12. A write
moved first leaves every read correct, because decision 2 keeps `member.team_id` and `membership`
equal.

## Options considered

- **The client sends `org_id` on every insert.** Rejected. That needs a seam signature change on
  about ten functions (XL by `.ai/01-operating-model.md` § Sizing). It also makes the client the
  source of a tenancy boundary that the database can derive.
- **Each writer function also writes `membership`.** Rejected under decision 2. Eight copies of the
  rule, and the admission trigger's `exception when others` would hide a failure in one of them.
- **Setters gain a `teamId` and `team_update_admin` admits any team in `member_team_ids`.** Rejected
  for this ticket. It changes two seam signatures and their two screens (XL), and it trusts a
  client-supplied team id that the policy then has to re-check. That is the per-team manager surface
  MIR-17 builds.
- **One ticket, one large migration.** Rejected. Twelve tables, about forty policies and thirty
  functions in one diff is unreviewable against R1–R8. The size rule exists to stop this.
- **Read slice first.** Rejected under decision 5.

## Consequences

- After MIR-13 every `org_id` and `entry.primary_team_id` is `not null`, and `holiday` is unique per
  `(org_id, date)`.
- A member with no active team can no longer insert an `entry`, because `primary_team_id` has no
  value (ADR-070 § 4 makes the column `not null`).
- `membership` stays correct through every existing writer until MIR-21.
- MIR-21 must not start before MIR-13-b is `DONE`; its `depends_on` is amended at this plan.
- The `MIR-13` feature row stays `PLANNED` in `features.md` until MIR-13-b ships. `/ship` for MIR-13
  must not mark the feature `DONE`.

## Revert condition

If MIR-19 or MIR-18 gives sign-ups a dedicated-org admission path that supplies `org_id`, decision 1's
shared-tenant fallback for `member` is removed in that ticket. If any writer is found writing
`member.team_id` while `membership` disagrees, decision 2 is defective and the fix is MIR-21's move
of the writers onto `membership`, not a second mirror.
