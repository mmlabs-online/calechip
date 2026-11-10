---
doc_version: 1
last_updated: 2026-10-12
governed_by: [RULE-01]
---

# Multi-tenancy audit — reproduction details for the phase 0 items

**The reproduction steps the phase 0 tickets deliberately leave out.** MIR-01…MIR-04 and the
standards entry state what will change; how the current system can be reached is here and only here.
Every line is transcribed from [the audit](multi-tenancy-audit-2026-10-12.md) or
[the plan](../plans/calechip-multi-tenancy-plan.md), with its line. Nothing below was run: the audit
is static reading, and it says so (audit:14).

## MIR-01 — the service role key

- `.gitignore:16-19` records that `.env` was committed once at `5a29434` on `origin/ops/architecture`,
  carrying a live `SUPABASE_SERVICE_ROLE_KEY`. The repository does not say whether that key has been
  rotated (audit:721-722).
- Under ADR-005 that key bypasses row-level security entirely (`.gitignore:17`); until it is rotated
  every RLS analysis in the audit is moot (plan:74).
- **Verification step (plan:68, 71):** confirm whether the key from `5a29434` is still accepted
  before rotation, and that it is rejected after.

## MIR-02 — self-escalation on `member`

The audit's most severe finding (audit:11-36), verbatim in substance:

- Any approved member can set their own `role`, `status` or `team_id` with one direct PATCH, because
  the `authenticated` role holds `update (role, removed_at)` (`tea04:29`) and
  `update (status, team_id)` (`member_approval:173`), the policy `member_update_own`
  (`profile_self_update:61-64`) admits the caller's own row, and the trigger
  `member_enforce_role_and_removal` (`profile_self_update:117-204`) does not refuse a person changing
  their own `role`, `status` or `team_id`.
- Because `is_admin` is global, the result is admin over every team (audit:32).
- **Reproduction (plan:77):** from an ordinary member account,
  `PATCH /rest/v1/member?id=eq.<self>` with `{"role":"admin"}`. Record the result.
- No test can catch it today: the mock's `updateOwnProfile` writes only name and avatar (audit:35-36).

## MIR-03 — `set_member_role`

- `set_member_role` (`cross_team_role:92-120`) is `security definer`, gated only by `is_admin`, with
  no team condition (audit:572-576).
- Any admin can promote anyone on any team to admin through it: `promoteMember` →
  `setRankThroughRpc(memberId, "admin", …)`, `supabase.ts:1628-1634` (audit:582-584).
- Combined with MIR-02, the gate the cross-team seam relies on — "nobody can grant themselves admin"
  — does not hold (audit:580-584).

## MIR-04 — the member directory

- `list_member_directory` (`evt01:154-163`, called from `supabase.ts:3285-3292`) returns every
  approved member of every team to **any** member, not only admins (audit:394).
- The invitee check in `save_event` (`evt01:215-220` / `evt02:192-197`) only requires the invitee to
  have a team, so members of other teams can be invited (audit:427, audit:763).
