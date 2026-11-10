---
ticket: MIR-16-e
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-07T13:49:07Z
inputs_read:
  - .ai/board/tickets/MIR-16-e/01-plan.md
  - .ai/board/tickets/MIR-16-e/03-impl-log.md
  - .ai/board/tickets/MIR-16-e/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/migrations/20260912100000_solo_manager_role.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - tests/org-admin-role-mapping.test.ts
  - src/lib/data/supabase.ts
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

# MIR-16-e — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-16-e, 16 changed file(s)` … `allowed-paths: PASS` (the 16 are the 12 paths at `ticket.yaml:19-30`, the three ticket-folder files and `.ai/board/backlog.md`, which is ship-owned). `node scripts/check-carry.mjs MIR-16-e` → `0 uncommitted path(s)` … `PASS — nothing stray`. Working tree clean (`git status --porcelain` empty). |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. Run by this reviewer. |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, no output. Covers `src/lib/data/supabase.ts` and `tests/org-admin-role-mapping.test.ts`. |
| R4 | Nothing outside the data-access seam reaches the datastore (RULE-02) | PASS | The only `src/` change is inside the seam, `src/lib/data/supabase.ts:960-966, 976, 1000, 1227`. The new vitest reads source text only and imports `node:fs`, `node:url` and `vitest`, nothing from Supabase (`tests/org-admin-role-mapping.test.ts:7-9`). `pnpm lint` exit 0 means the `no-restricted-imports` boundary rule is clean. |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. `pnpm test` → 52 files, 1034 tests passed. `pnpm db:test` → `300-org-admin-rename.test.sql … ok`, and the five edited fixture files plus `290` all `ok`. |
| R6 | Permission gating matches plan § 3 | PASS | Promotion is gated by `is_org_admin` (`…mir16e….sql:60-62`) and only reaches a non-`org_admin` (`:70`). The rank door gates on `is_org_admin` (`:98-100`), refuses `p_role = 'org_admin'` with 42501 (`:103-106`) and never touches an `org_admin` row (`:116`). Demotion is refused for every caller, owner included, in the trigger (`:208-210`). All are server-side. The seam only translates the value (`src/lib/data/supabase.ts:965-966`). |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail. |
| R8 | No dependency added without an ADR | PASS | `git diff --stat origin/main...HEAD` lists no `package.json` or `pnpm-lock.yaml`. The only new import is in `tests/org-admin-role-mapping.test.ts:7-9`: `node:fs` and `node:url` are built-ins, and `vitest` is already a dependency. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 the guarded rename, inside `begin; … commit;` | `supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql:15, 22-29, 262` | Yes. The `pg_enum` guard is the plan's own text. |
| § 4.1 `is_org_admin(uuid, uuid)` | same file `:36-48` | Yes. Language, volatility, definer and `search_path` match `20261107230000…:25-38`. The only change is `'org_admin'` at `:46`, and the "Still reads 'admin'" comment is dropped. |
| § 4.1 `promote_member_to_admin(uuid)` | same file `:51-86` | Yes. It matches `20261107230000…:507-542` line for line except `:65` and `:70`. |
| § 4.1 `set_member_role(uuid, public.member_role)` | same file `:89-135` | Yes. It matches `20261107230000…:595-641` except `:103` and `:116`. |
| § 4.1 `member_enforce_role_and_removal()` and the message `an org admin may not be demoted` | same file `:139-247` | Yes. It matches `20261107180000…:37-142` except `:208-209`, plus the added comment `:206-207`. The trigger is not re-created. |
| § 4.1 `may_decide(uuid)` | same file `:251-260` | Yes. It matches `20260912100000…:55-64` except `:258`. |
| § 4.1 catalogue re-check: no other live body spells the value | `supabase/tests/300-org-admin-rename.test.sql:93-104` passes under `pnpm db:test`. The one other historical `'admin'::public.member_role` body, `is_admin` (`20260910100000…:69-78`), is dropped at `20261107230000…:810`. | Yes |
| § 4.2 pgTAP AC-1…AC-8 and the helper read-back, `plan(n)` on `tests.seed()` | `300-org-admin-rename.test.sql:11-12`. AC-1 `:17`, AC-2 `:23-41`, AC-3 `:46-52`, AC-4 `:57-60`, AC-5 `:65-70`, AC-6 `:75-81`, AC-7 `:86-88`, AC-8 `:93-104`, helper `:108-109` | Yes. 20 assertions, `plan(20)`, `ok` under `pnpm db:test` |
| § 4.3 `_isolation.psql` branch and its comment tense | `supabase/tests/_isolation.psql:92-93, 97` | Yes |
| § 4.3 the five fixture files | `250…:48`, `260…:46`, `270-issue-reports…:68`, `280…:54`, `270-member-team-id-dropped…:151` | Yes. Each file `ok` under `pnpm db:test`, and `plan(n)` is untouched (single-line diffs). |
| § 4.3 `bootstrap.sql` three sites | `supabase/bootstrap.sql:142, 161, 208` | Yes. The `raise` texts are unchanged. |
| § 4.3 `seed.sql` three sites and the comment | `supabase/seed.sql:96, 117, 155, 310` | Yes |
| § 4.4 `DbMemberRole`, `fromDbRole`, `toDbRole` | `src/lib/data/supabase.ts:963, 965, 966` | Yes. Verbatim from plan § 4.4. |
| § 4.4 `MemberRow.role: DbMemberRole` | `src/lib/data/supabase.ts:976` | Yes |
| § 4.4 `toMember` → `fromDbRole(row.role)` | `src/lib/data/supabase.ts:1000`. Every `MemberRow` read reaches the app through `toMember` (`:1234, 1278, 1696, 1795, 1842, 1872, 1891, 1978, 2476, 2508`), and no other row type in `src/lib/data/` carries `role`. | Yes |
| § 4.4 `setRankThroughRpc` → `p_role: toDbRole(role)`, `.select(MEMBER_COLUMNS)` kept | `src/lib/data/supabase.ts:1227-1228` | Yes. `tests/member-rpc-roster-team.test.ts` passes in `pnpm test`. |
| § 4.5 vitest: AC-9, AC-10 and the `MemberRow` type | `tests/org-admin-role-mapping.test.ts:15-20, 22-25, 27-33, 35-40, 42-48` | Yes. 5 tests, all passing. |

## R7 detail

`invariants_touched: []` (`ticket.yaml:17`). The migration re-creates exactly five functions (`…mir16e….sql:36, 51, 89, 139, 251`) and touches no table, policy or entry function. Each ledger ID is still checked below.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 (no overlapping portions) | Held by the `entry` exclusion constraint, which this diff does not touch. None of the five bodies reads or writes `entry`. | `…mir16e….sql:36-260`: no `public.entry` reference |
| INV-02 (approved entry edit returns to pending) | Held by `entry_enforce_decision`, which is not re-created. `may_decide` keeps its boolean outcome, true for org_admin and manager and false for member (`300…:86-88`). Who may decide does not change. | `…mir16e….sql:251-260` |
| INV-03 (rejection carries a reason) | Not read or written by any of the five bodies. | `…mir16e….sql:36-260` |
| INV-04 (single absence count; membership on the date) | The `removed_at` provenance clause, which INV-04's denominator depends on, is carried verbatim. So are the one-way removal clause and the self-removal guard. | `…mir16e….sql:221-223, 232-235, 241-243` (cf. `20261107180000…:116-118, 127-130, 136-138`) |
| INV-05 (tentative counts) | No count is computed in the diff. | `…mir16e….sql:36-260` |
| INV-06 (one portion per entry) | No entry column is touched. | `…mir16e….sql:36-260` |
| INV-07 (entry belongs to one member, counted on every team) | No membership or entry-ownership write is added. The membership updates in promotion and rank change are verbatim from their sources. | `…mir16e….sql:77-81, 124-130` (cf. `20261107230000…:533-537, 630-636`) |

## Findings

None against this ticket.

**Out of scope, recorded for a human, with no gate effect.** `pnpm db:test` exits 1 on one pre-existing failure: `170-multi-team-decisions.test.sql` test 42, `AC-20: admin_u does not select E`, have 1, want 0. MIR-16-b's `03-impl-log.md:86, 96` already records the same failure, and it reproduces there with that ticket's migration removed. The diff touches none of the entry-select functions. `pnpm db:test` is not one of R1–R8, and no loop role holding this ticket's `allowed_paths` can edit that file. It still has no owner and should become an `OPS-nnn` chore or a model-debt row. That needs `/ship` or the steward, because this stage has no tracker or board write.

## Verdict

PASS
