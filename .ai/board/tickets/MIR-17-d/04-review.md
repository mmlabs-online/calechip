---
ticket: MIR-17-d
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-09T21:06:00+07:00
inputs_read:
  - .ai/board/tickets/MIR-17-d/01-plan.md
  - .ai/board/tickets/MIR-17-d/03-impl-log.md
  - .ai/board/tickets/MIR-17-d/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-091-the-applications-manager-is-whoever-manages-a-team-and-the-rest-of-p4-2-is-mir-17-e.md
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/tests/_isolation.psql
  - "git diff origin/main...HEAD"
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
| R1 | Committed subset of `allowed_paths`; uncommitted carry clean | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-17-d, 12 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-17-d` → `0 uncommitted path(s)`, `PASS — nothing stray`. The five non-board paths match `ticket.yaml:20-27` |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. `MemberRow.team_role` was removed at `src/lib/data/supabase.ts:982` and nothing else in `src/` reads it (grep: no `team_role` reader outside the comment at `src/lib/roles.ts:47`) |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, no output — repo-wide, so the changed files `src/lib/data/supabase.ts` and `tests/org-admin-role-mapping.test.ts` are covered |
| R4 | Nothing outside the data-access seam reaches the datastore | PASS | The only application change is inside the seam: `src/lib/data/supabase.ts:971`, `:982`, `:998`. No component is in the diff. Every reader of `MEMBER_COLUMNS` is in the same file (`:1234`, `:1282`, `:1698`, `:1781`, `:1838`, `:1874`, `:1892`, `:1974`, `:2475`, `:2501`) |
| R5 | Every contract item in plan § 4 implemented | PASS | See R5 detail. `pnpm test` → `Test Files 54 passed (54)`, `Tests 1051 passed (1051)` |
| R6 | Permission gating matches plan § 3 | PASS | `member_manages_a_team(uuid)` definer, `search_path = ''`, stable: `supabase/migrations/20261109120000_mir17d_manages_a_team.sql:31`; anon/public revoked `:43`, authenticated granted `:44`. `manages_a_team(public.member)` invoker, stable: `:51`; revoked `:54`, granted `:55`. No policy, write path or grant on an existing object changes (`:30-57` is the whole body) |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:18`). Per-ID reasoning over INV-01 to INV-07 below; the migration is two `stable` reads with no write (`20261109120000_mir17d_manages_a_team.sql:30-55`) |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` lists no `package.json` or `pnpm-lock.yaml`; the only TS change, `src/lib/data/supabase.ts:968-998`, adds no import |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `member_manages_a_team(uuid)`, definer, stable, `search_path = ''`, body as specified | `supabase/migrations/20261109120000_mir17d_manages_a_team.sql:30-42` | Yes — character-for-character against `01-plan.md` § 4.1 |
| § 4.1 revoke from `public, anon`; grant to `authenticated` | `…manages_a_team.sql:43-44` | Yes |
| § 4.1 `manages_a_team(public.member)` computed field, invoker | `…manages_a_team.sql:50-53` | Yes |
| § 4.1 revoke/grant on the computed field | `…manages_a_team.sql:54-55` | Yes |
| § 4.1 idempotent (`create or replace`), wrapped in `begin; … commit;` | `…manages_a_team.sql:23`, `:30`, `:50`, `:57` | Yes |
| § 4.2 one `plan(n)`, on `tests.seed()` | `supabase/tests/340-manages-a-team.test.sql:15-16` | Yes — `plan(13)`; 13 assertions counted at `:31`, `:46`, `:55`, `:61`, `:63`, `:69`, `:71`, `:73`, `:79`, `:81`, `:89`, `:99`, `:101` |
| § 4.2 fixture: T2 + non-primary active manager row for `member_t` (Vu) | `340-manages-a-team.test.sql:27`, `:31-39` | Yes |
| § 4.2 fixture: Rae via `tests.put_on_team(…, 'manager')`, then removed | `340-manages-a-team.test.sql:42-50` | Yes; roles named through `tests.member_role` (`:44`) |
| § 4.2 AC-1 Mona true | `340-manages-a-team.test.sql:55` | Yes |
| § 4.2 AC-2 Vu true, roster role `member` | `340-manages-a-team.test.sql:61-64` | Yes |
| § 4.2 AC-3 Thanh (`member_t2`), Ada (`admin_t`), pending false | `340-manages-a-team.test.sql:69-74`; `admin_t` holds `team_role = 'member'` via `supabase/tests/_isolation.psql:75-76`, `:129`, `:155` | Yes |
| § 4.2 AC-4 Rae true, roster role `manager` | `340-manages-a-team.test.sql:79-82` | Yes |
| § 4.2 AC-5 as `admin_t` via `tests.authenticate_as`; anon refused on both signatures | `340-manages-a-team.test.sql:88-95`, `:98-103` | Yes — plan named `has_function_privilege`; the file asserts the refusal itself with `throws_ok … '42501'`, which observes the same AC-5 clause ("`anon` holds no `EXECUTE`") directly. Not a contract signature, so not a deviation |
| § 4.3 census gains `member_manages_a_team(uuid)` after `member_roster_team_role(uuid)`; invoker not listed | `supabase/tests/010-catalogue.test.sql:58-61` | Yes |
| § 4.4 `MEMBER_COLUMNS` selects `manages_a_team`, not `roster_team_role`; `team_id:roster_team_id` stays | `src/lib/data/supabase.ts:997-998` | Yes |
| § 4.4 `MemberRow.manages_a_team: boolean;` | `src/lib/data/supabase.ts:982` | Yes |
| § 4.4 `appRole` body and doc comment | `src/lib/data/supabase.ts:968-971` | Yes — verbatim |
| § 4.4 `fromDbRole`, `toDbRole`, `toMember`, `setRankThroughRpc` unchanged | `src/lib/data/supabase.ts:965-966`, `:1000`; diff touches only `:968-998` | Yes |
| § 4.5 describe renamed; three cases changed | `tests/org-admin-role-mapping.test.ts:51-74` | Yes; passes in `pnpm test` |

The pgTAP file was not executed against Postgres by the Developer or by this review (no instance reachable; `03-impl-log.md` says so rather than claiming a run). Fixture correctness was checked against `_isolation.psql:118-157` and `20261108090000_mir16c_manager_read_from_membership.sql:28-40`.

## R7 detail

`invariants_touched` is `[]`. Each registry invariant is reasoned through individually.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 (no overlapping portions per member) | No entry is written; both functions are `stable` reads of `membership`/`member` only | `supabase/migrations/20261109120000_mir17d_manages_a_team.sql:31-41`, `:51-52` |
| INV-02 (edit of an approved entry returns to `pending`) | No entry write path or trigger changes; who may decide is still `may_decide_entry` (ADR-073), untouched | `…manages_a_team.sql:30-55` (whole body: no trigger, no `entry` reference) |
| INV-03 (rejection carries a reason) | No rejection path changes; the seam change affects only the `role` label on `Member` | `src/lib/data/supabase.ts:970-971` |
| INV-04 (one definition of the absence count) | No count or window is read or defined; functions do not reference `entry` | `…manages_a_team.sql:34-41` |
| INV-05 (tentative counts as non-tentative) | As INV-04 — no count logic touched | `…manages_a_team.sql:34-41` |
| INV-06 (one portion per entry) | No `entry` column, constraint or write touched | `…manages_a_team.sql:30-55` |
| INV-07 (entry belongs to one member, counted on every team) | `membership` is read, never written; team membership unchanged | `…manages_a_team.sql:34-40` |

The widened manager label is an affordance only; the authority to decide stays in the database (`may_decide_entry`, plan § 3), so no invariant rests on the UI change.

## Findings

None.

## Verdict

PASS. MIR-17-d advances to DONE.
