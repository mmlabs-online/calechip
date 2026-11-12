---
ticket: MIR-19-c
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-12T00:50:00Z
inputs_read: [ .ai/board/tickets/MIR-19-c/01-plan.md, .ai/board/tickets/MIR-19-c/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/adm-05-approve-reject.spec.ts` | modified | walk reads pathname via `appPathname`; import added | §4.2 |
| `tests/e2e/cal-03-admin-edit-entry.spec.ts` | modified | same | §4.2 |
| `tests/e2e/cal-04-month-view.spec.ts` | modified | same | §4.2 |
| `tests/e2e/cal-05-week-view.spec.ts` | modified | walk compare and `declare` capture via helper | §4.2 |
| `tests/e2e/cal-06-year-view.spec.ts` | modified | same | §4.2 |
| `tests/e2e/cal-07-overload-warning.spec.ts` | modified | walk reads pathname via helper | §4.2 |
| `tests/e2e/cal-08-holiday-shading.spec.ts` | modified | walk compare and post-loop `expect` via helper | §4.2 |
| `tests/e2e/cal-10-year-overview.spec.ts` | modified | walk compare and capture via helper | §4.2 |
| `tests/e2e/solo-pending-approval-ui.spec.ts` | modified | walk reads pathname via helper | §4.2 |
| `tests/e2e/uie-07-week-absence-count.spec.ts` | modified | walk compare and capture via helper | §4.2 |
| `tests/e2e-org-prefix.test.ts` | modified | `WALK_SPECS` added, appended to `MIGRATED_SPECS`, new `walk specs` describe | §4.3 |

`.ai/board/tickets/MIR-19-d/ticket.yaml` was already present from PLAN and is not touched here.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `tests/e2e/support/org-prefix.ts` | used, unchanged |
| 4.2 | the ten specs | only the read side changed; literals, loop bounds and assertions untouched; evt-09 not edited (AC-6) |
| 4.3 | `tests/e2e-org-prefix.test.ts` | nine existing names kept in order, `...WALK_SPECS` last |

## Deviations from the design

none

## Invariants

`invariants_touched` is `[]`. Test code only: no entry written, no count computed, no screen changed.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 58 files, 1175 tests |
| `pnpm exec playwright test` on the ten specs | 0 | 94 passed; full suite left to `/ship` |
| `git diff --name-only` subset of `allowed_paths` | yes | 11 files |

## Testability contract

None added or changed.

## Open questions

none
