---
ticket: MIR-16-c
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-08T08:04:25+07:00
inputs_read:
  - .ai/board/tickets/MIR-16-c/01-plan.md
  - .ai/board/tickets/MIR-16-c/03-impl-log.md
  - .ai/board/tickets/MIR-16-c/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/migrations/20260913120000_solo_manager_decision_generated_columns.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
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

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `14 changed file(s)` … `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs MIR-16-c` → `0 uncommitted path(s)` / `PASS — nothing stray`, exit 0. Every non-board path in the diff is listed at `.ai/board/tickets/MIR-16-c/ticket.yaml:18-29` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. Run by this reviewer |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output. Run by this reviewer. `pnpm test` also run: 52 files, 1038 tests passed |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The only `src/` change is the seam itself: `src/lib/data/supabase.ts:970-971`, `:982`, `:997-998`, `:1006`. No other `src/` file in the diff |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | `member_roster_team_role`: definer, `search_path = ''` at `supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql:28-29`; revoke public/anon `:39`, grant authenticated `:40`. `roster_team_role`: invoker (no `security definer`) `:42-43`; revoke `:46`, grant `:47`. `membership_make_primary` stays owner-only `:96`. Anon refusal asserted at `supabase/tests/310-manager-read-from-membership.test.sql:148-151` |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; neither file is in the diff stat |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `member_roster_team_role(uuid) returns public.team_role`, body as specified | `supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql:28-38` | Yes — character-for-character with plan § 4.1 |
| § 4.1 `roster_team_role(public.member)` computed field | `…mir16c_manager_read_from_membership.sql:42-45` | Yes |
| § 4.1 `membership_make_primary`: `v_role` from the active primary row's `team_role`, else `'member'`, read before the close; rest verbatim | `…mir16c_manager_read_from_membership.sql:63-71` (org read, then coalesce read), close at `:79-83`, promote/insert `:85-93`. Compared against `20261105210000_mir21b_writers_write_membership.sql:39-76`: only `:46-51` (the `member.role` case) differs. No later migration re-creates the function (grep over `supabase/migrations`: only mir21b:39 and this file:56) | Yes |
| § 4.1 `drop function if exists public.may_decide(uuid)`, no `cascade` | `…mir16c_manager_read_from_membership.sql:102` | Yes. Remaining callers checked: the policy `entry_update_manager` at `20261103120000_mir13_write_path_org_bound.sql:822` and `entry_enforce_decision` at `20260913120000_solo_manager_decision_generated_columns.sql:49,81` are both superseded — grep for `may_decide\(` finds no call in `20261103210000_mir14_multi_team_decisions.sql` (`entry_enforce_decision` re-created at `:156`) or `20261107230000_mir16b_is_org_admin.sql`; the only later definition is mir16e:251, the function itself |
| § 4.1 idempotent, `begin; … commit;` | `…mir16c_manager_read_from_membership.sql:22`, `:104`; `create or replace` at `:28`, `:42`, `:56` | Yes |
| § 4.2 pgTAP `310-…`, one `plan(n)`, `tests.seed()`, roles via `tests.member_role` | `supabase/tests/310-manager-read-from-membership.test.sql:12-13`, `:28`, `:100` | Yes — `plan(25)`, 25 assertions counted |
| § 4.2 fixture T2, Rae (put_on_team, removed), pending entry by Thanh | `310-…test.sql:24-36` | Yes |
| § 4.2 AC-1 … AC-7, one assertion or more each | AC-1 `:42-56`; AC-2 `:61-68`; AC-3 `:73-74`; AC-4 `:79-91`; AC-6 precondition `:97-108` (owner sets `member.role`; the role-sync branch is gone since `20261107180000_mir21f_drop_member_team_id.sql:151-170`, so the row stays `member`); AC-5/AC-6 `:114-125`; AC-7 `hasnt_function` `:132` and decision `:133-142` | Yes |
| § 4.2 anon lacks EXECUTE on both | `310-…test.sql:147-151` | Yes |
| § 4.3 `010-catalogue`: `may_decide(uuid)` out, `member_roster_team_role(uuid)` in, invoker not added | `supabase/tests/010-catalogue.test.sql:41-42` (removal), `:56-58` (addition) | Yes |
| § 4.3 `100-mock-parity`: assertion removed, `plan(108)`, header no longer names `public.may_decide`, JSON field kept | `supabase/tests/100-mock-parity.test.sql:8-12` header, `:104` `plan(108)`, predicate block `:208-214` now two assertions per row (36×2 + 36 own-row = 108) | Yes |
| § 4.3 `300-org-admin-rename`: three AC-7 assertions removed, `plan(17)`, header note | `supabase/tests/300-org-admin-rename.test.sql:5-7`, `:15` | Yes |
| § 4.4 `MEMBER_COLUMNS` appends `team_role:roster_team_role`, keeps `team_id:roster_team_id` | `src/lib/data/supabase.ts:997-998` | Yes |
| § 4.4 `MemberRow.team_role: "member" \| "manager" \| null` | `src/lib/data/supabase.ts:982`; enum values match `20261027120000_mir11_composite_foreign_keys.sql:23` | Yes |
| § 4.4 `appRole` after `toDbRole` | `src/lib/data/supabase.ts:968-971` | Yes — verbatim |
| § 4.4 `toMember` uses `appRole(row)`; `fromDbRole`/`toDbRole` unchanged | `src/lib/data/supabase.ts:1006`; `:965-966` untouched in the diff | Yes |
| § 4.5 vitest: renamed case + three added | `tests/org-admin-role-mapping.test.ts:22-25`, `:51-72` | Yes |

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/MIR-16-c/ticket.yaml:17`). The list is empty, so there is
no ID to hold. The one invariant the changed code sits next to was checked anyway:

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 (team-on-date membership windows) | `membership_make_primary` writes `left_at = now()` on the close and `joined_at = now()` on the insert exactly as before; only the `team_role` value source changed. `member_roster_team_role` is a read and writes nothing. `may_decide` was not an input to any count | `supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql:79-93` vs `20261105210000_mir21b_writers_write_membership.sql:59-73` |

## Findings

None.

## Verdict

`PASS`. The pgTAP files were not run against a database by the Developer (`03-impl-log.md`
§ Verification run) and could not be run here. No R-check requires a pgTAP run. Assertion counts
and fixture logic were checked by reading, against the migrations cited above.
