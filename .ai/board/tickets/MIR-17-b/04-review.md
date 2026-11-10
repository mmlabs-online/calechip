---
ticket: MIR-17-b
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-08T18:28:00+07:00
inputs_read:
  - .ai/board/tickets/MIR-17-b/01-plan.md
  - .ai/board/tickets/MIR-17-b/03-impl-log.md
  - .ai/board/tickets/MIR-17-b/ticket.yaml
  - .ai/templates/review-report.md
  - src/lib/roles.ts
  - git diff origin/main...HEAD
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
| R1 | Committed ⊆ `allowed_paths`; uncommitted carried | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-17-b, 15 changed file(s)` … `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs MIR-17-b` → `0 uncommitted path(s)` … `PASS — nothing stray`, exit 0. Non-ticket paths in the diff are all in `ticket.yaml:18-29`; `.ai/board/backlog.md` is ship-owned |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. The `MemberRole \| null` case is handled at `src/components/AdminLayout.tsx:143` |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, no output. That covers all eight changed `src/`/`tests/` files |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The diff adds no data import. The only new imports are `@/lib/roles` (`AdminHub.tsx:37`, `NewSignups.tsx:32`, `Threshold.tsx:49`, `Teams.tsx:32`, `TeamEntries.tsx:37`, `Holidays.tsx:48`, `AdminLayout.tsx:60`), and `src/lib/roles.ts:14` imports only domain types. The test reads files with `node:fs` (`tests/role-guards.test.ts:8`) |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. The vitest run of `tests/role-guards.test.ts` gives 15/15. `pnpm test` gives 53 files and 1047 tests passing |
| R6 | Permission gating matches plan § 3 | PASS | `mayAdminister` is `role === "admin"` (`src/lib/roles.ts:24`), so each replaced guard has the same truth table: admin admitted, manager and member refused. Holidays write is still conjoined with `orgShared === "no"` (`src/routes/Holidays.tsx:276`). AdminLayout badges read only for admin (`src/components/AdminLayout.tsx:143`) |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:17`). See R7 detail |
| R8 | No dependency added without an ADR | PASS | `package.json` and the lockfile are absent from `git diff --name-status origin/main...HEAD`. The new test imports only `node:fs`, `node:url` and `vitest` (`tests/role-guards.test.ts:8-10`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| `AdminHub.tsx:72` → `!me \|\| !mayAdminister(me.role)` | `src/routes/AdminHub.tsx:73` | yes |
| `NewSignups.tsx:76` → `!me \|\| !mayAdminister(me.role)` | `src/routes/NewSignups.tsx:77` | yes |
| `Threshold.tsx:125` → `!me \|\| !mayAdminister(me.role)` | `src/routes/Threshold.tsx:126` | yes |
| `Teams.tsx:81` → `!me \|\| !mayAdminister(me.role)` | `src/routes/Teams.tsx:82` | yes |
| `Teams.tsx:337` → `{ROLE_LABELS[person.role]}` | `src/routes/Teams.tsx:338`; the labels come from `src/lib/roles.ts:67-71` (`Admin`/`Manager`/`Member`, AC-3) | yes |
| `TeamEntries.tsx:82` → `!mayAdminister(me.role)` | `src/routes/TeamEntries.tsx:83` | yes |
| `Holidays.tsx:181` → `me !== null && mayAdminister(me.role)` | `src/routes/Holidays.tsx:182` | yes |
| `Holidays.tsx:275` → `… && mayAdminister(me.role) && …` | `src/routes/Holidays.tsx:276` | yes |
| `Holidays.tsx:355` → `me !== null && mayAdminister(me.role)` | `src/routes/Holidays.tsx:356` | yes |
| `AdminLayout.tsx:143` → `!mayAdminister(role)` | `src/components/AdminLayout.tsx:143`: `role === null \|\| !mayAdminister(role)` | It differs from the contract only by the null disjunct that the prop's `MemberRole \| null` type forces. A null role was refused before (`null !== "admin"`) and is refused now. The deviation is logged in `03-impl-log.md` § Deviations, and behaviour is identical |
| Imports: `mayAdminister` in each file; `ROLE_LABELS` in Teams; AdminLayout extends its existing import | `AdminHub.tsx:37`, `NewSignups.tsx:32`, `Threshold.tsx:49`, `Teams.tsx:32`, `TeamEntries.tsx:37`, `Holidays.tsx:48`, `AdminLayout.tsx:60` | yes |
| § 4.1 vitest: literal pattern absent after comment strip, `@/lib/roles` imported, `ROLE_LABELS[person.role]` present | `tests/role-guards.test.ts:16-18` (strip), `:31` (the plan's exact regex), `:38-44` (the per-file pair, ×7), `:49-53` (AC-3) | yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| *(none — `invariants_touched: []`)* | Every changed line is a client affordance (ADR-005, `src/lib/roles.ts:3-6`). The datastore controls are not in the diff: `is_org_admin`, `may_decide_entry` and the holiday policies. The diff has no seam, mock, schema or migration path, so no data path an invariant governs could have moved. The one widening risk named in ADR-035, `mayAdminister` admitting a manager, does not occur, because `mayAdminister` is unchanged at `role === "admin"` | `ticket.yaml:17`; `src/lib/roles.ts:24`; `git diff --name-status origin/main...HEAD` (only `src/routes/*`, `src/components/AdminLayout.tsx`, `tests/role-guards.test.ts` outside `.ai/`) |

## Findings

None.

## Verdict

PASS.
