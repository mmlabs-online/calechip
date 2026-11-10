---
ticket: MIR-02
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-20T14:29:18+0700
inputs_read:
  - .ai/board/tickets/MIR-02/01-plan.md
  - .ai/board/tickets/MIR-02/03-impl-log.md
  - .ai/board/tickets/MIR-02/ticket.yaml
  - .ai/board/tickets/MIR-02/verification.md
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20260910093000_solo_profile_self_update.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20260924100000_solo_cross_team_role.sql
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/index.ts
  - tests/member-self-writes.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

# MIR-02 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted is stray | PASS | `node scripts/check-allowed-paths.mjs MIR-02` → `allowed-paths: PASS` (12 changed files, `.ai/board/backlog.md` is ship-owned); `node scripts/check-carry.mjs MIR-02` → `0 uncommitted path(s) … PASS — nothing stray`. The one non-ticket file not created by this run, `supabase/migrations/20260910093000_solo_profile_self_update.sql:19-23`, gains only `--` lines, as § 4.2 requires |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint src/lib/data/index.ts src/lib/data/mock.ts src/lib/data/supabase.ts tests/member-self-writes.test.ts` → exit 0; repo-wide `pnpm exec eslint .` → exit 0, nothing outside the diff to report |
| R4 | Nothing outside the seam reaches the datastore | PASS | The only new datastore calls are inside the seam: `src/lib/data/supabase.ts:1691` (`rpc("reject_member")`), `src/lib/data/supabase.ts:1820` (`rpc("set_member_team")`). The test drives the mock seam only (`tests/member-self-writes.test.ts:17`) and reads the migration as text (`tests/member-self-writes.test.ts:191`) |
| R5 | Every § 4 contract item implemented | PASS | See *R5 detail* |
| R6 | Permission gating matches § 3 | PASS | Self `role`/`status`/`team_id` refused on every path: `supabase/migrations/20261020120000_mir02_member_self_writes.sql:61-67`; table writes of the three refused for everybody: `…mir02_member_self_writes.sql:163`, and no table-level `update` exists to survive a column revoke (`20260831150024_tea01_membership.sql:145-146`); reject = any admin: `…mir02_member_self_writes.sql:175-183`; edit-panel save = admin, own team both sides: `…mir02_member_self_writes.sql:208-216`; `set_member_role`/`move_member` are definer and unchanged (`20260924100000_solo_cross_team_role.sql:92-98`, `20260911180000_solo_many_teams.sql:186`); `anon` cannot execute either new function: `…mir02_member_self_writes.sql:232-235`; name/avatar and `removed_at` grants untouched (revoke names only the three columns, `:163`) |
| R7 | No invariant violated | PASS | See *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` contains no `package.json` or lockfile; no new import outside `node:fs`/`node:url`/existing modules (`tests/member-self-writes.test.ts:14-26`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 header: ADR-064, plan, supersedes the *"caller included"* sentence; `begin; … commit;` | `supabase/migrations/20261020120000_mir02_member_self_writes.sql:1-31`, `:33`, `:237` | yes |
| 4.1 (a) trigger: self clause first, rest of body unchanged | `…mir02_member_self_writes.sql:45-151`, clause `:61-67`. `diff` of `:45-151` against `20260910093000_solo_profile_self_update.sql:117-204` shows only the inserted clause and its comment (plus the header comment, which is outside the function) | yes — `create or replace`, trigger not recreated |
| 4.1 (b) revoke | `…mir02_member_self_writes.sql:163` | yes |
| 4.1 (c) `reject_member(uuid) returns void`, definer, `is_admin`, pending+teamless, 42501 on not found | `…mir02_member_self_writes.sql:172-188` | yes, verbatim |
| 4.1 (d) `set_member_team(uuid, uuid) returns public.member`, own team both sides | `…mir02_member_self_writes.sql:201-224` | yes, verbatim |
| 4.1 (e) execute revoked from `public`, granted to `authenticated` | `…mir02_member_self_writes.sql:232-235` | yes |
| 4.2 dated correction below lines 13-17, comment lines only | `supabase/migrations/20260910093000_solo_profile_self_update.sql:19-23` | yes |
| 4.3 `decideMember` reject → `rpc("reject_member")`, `toTeamFailure(…, "That sign-up could not be decided. It may already have been.")` | `src/lib/data/supabase.ts:1691-1698`; mapper 42501 → `not_permitted` at `src/lib/data/supabase.ts:1144-1146` | yes; approve branch unchanged |
| 4.3 `setMemberTeam` → `rpc("set_member_team")`, `toTeamFailure(…, "That member could not be moved.")`, `!isMemberRow` → `unknown` | `src/lib/data/supabase.ts:1819-1830` | yes |
| 4.3 comments brought true (`decideMember`, `setMemberTeam`, `updateOwnProfile`) | `src/lib/data/supabase.ts:1661-1669`, `:1812-1818`, `:1858-1862` | yes |
| 4.4 mock `moveMember` refuses own id before the move | `src/lib/data/mock.ts:2568` | yes |
| 4.4 mock `decideMember` / `setMemberTeam` keep their behaviour | conditions unchanged at `src/lib/data/mock.ts:1669-1678`, `:1792-1797`; only the refusal strings changed, to the sentences AC-9/AC-10 name (impl-log *Deviations*) | yes — behaviour kept; strings aligned to the ACs |
| 4.5 interface doc comments only, no signature change | `src/lib/data/index.ts:351`, `:477`, `:867` | yes; seam-parity tests pass in the full run |
| 4.6 tests, ten `it`s named as written | `tests/member-self-writes.test.ts:37`, `:50`, `:60`, `:77`, `:91`, `:101`, `:124`, `:132`, `:154`, `:190` | yes; `pnpm exec vitest run` → 46 files, 884 tests, all pass |
| 4.7 manual verification, before and after parts, AC-1–AC-6, AC-8, AC-10 | `.ai/board/tickets/MIR-02/verification.md:67`, `:85`, `:89-163` | yes; results left for the operator |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-07 — every entry belongs to one member and is counted against every team that member belongs to | No token can write `team_id` through the table, and nobody can change their own `team_id` on any path, so a person cannot carry their entries into another team's counts by their own act. The remaining writers (`move_member`, `admit_member`, `set_member_team`, `reject_member`) are definer functions gated on `is_admin`; `set_member_team` only ever writes the team the row already holds. No other SQL path writes `team_id`: the remaining `update public.member` statements write `last_sign_in_at`, `email` or `avatar` only | `supabase/migrations/20261020120000_mir02_member_self_writes.sql:163`, `:61-67`, `:212-216`; `20260910140000_solo_member_last_sign_in.sql:54-56`; `20260912120000_solo_member_email.sql:85-88` |
| INV-04 — the count is over entries whose member was still on that team on that date | Membership of the set moves only through `status`/`team_id`, now writable only by bounded definer functions and never by the person themselves. `removed_at`, which the date condition is defined against, keeps its grant and every trigger clause on it, reproduced unchanged | `…mir02_member_self_writes.sql:163` (the revoke names only `role, status, team_id`), `:125-147` (removal clauses unchanged) |

## Findings

None.

## Verdict

**PASS.** Applying the migration and filling `verification.md` remain human (RULE-09; plan:81), and
the pull request must link that file as the verification of record until MIR-05.
