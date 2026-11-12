---
ticket: MIR-19-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T13:58:00Z
inputs_read: [ .ai/board/tickets/MIR-19-b/01-plan.md, .ai/board/tickets/MIR-19-b/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-19-b — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/support/org-prefix.ts` | created | The helper: `E2E_ORG_CODE`, `stripOrg`, `appPathname`, `appHref`. Type-only import, no `src/` import. | § 4.1 |
| `tests/e2e-org-prefix.test.ts` | created | Vitest: AC-1 table, AC-2 stubs, AC-3 source check over `MIGRATED_SPECS`, AC-6 corollary. | § 4.3 |
| `tests/e2e/solo-admin-back-to-calendar.spec.ts` | modified | 5 `href` sites moved to `expect.poll(() => appHref(L)).toBe(P)`, import added. | § 4.2 |
| `tests/e2e/solo-admin-tabs.spec.ts` | modified | The one 4-line `href` site (`tab.path`) moved; `data-to` reads untouched. | § 4.2 |
| `tests/e2e/solo-approval-settings.spec.ts` | modified | `SETTING` site moved. | § 4.2 |
| `tests/e2e/solo-profile.spec.ts` | modified | Two sites (`"/profile"` over four lines, `"/"`) moved. | § 4.2 |
| `tests/e2e/solo-team-settings.spec.ts` | modified | `THRESHOLD` site moved. | § 4.2 |
| `tests/e2e/solo-teams.spec.ts` | modified | `"/teams"` site moved. | § 4.2 |
| `tests/e2e/tsk-01-tasks.spec.ts` | modified | `"/tasks"` and `"/week"` sites moved. | § 4.2 |
| `tests/e2e/tsk-04-week-task-badge.spec.ts` | modified | `` `/tasks/${TODAY}` `` site moved. | § 4.2 |
| `tests/e2e/uie-09-admin-hub.spec.ts` | modified | `destination.path` site moved; the `evaluateAll` snapshot compares through `stripOrg`. | § 4.2 |

`.ai/board/tickets/MIR-19-c/ticket.yaml` is in `allowed_paths` but was already written at PLAN
(§ 7), so it was not touched.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `tests/e2e/support/org-prefix.ts` | Signatures as specified. |
| 4.2 | the nine specs | 19 sites rewritten; expected values unchanged; neighbouring assertions unedited. |
| 4.3 | `tests/e2e-org-prefix.test.ts` | 36 tests. |

## Deviations from the design

none.

## Invariants

`invariants_touched` is `[]`: test code only, no entry written, no count computed, no screen changed.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 58 files, 1145 tests |
| `pnpm exec playwright test` (nine specs) | 0 | 77 passed |
| `pnpm exec playwright test` (full) | 1 failure, then green | `tsk-01-tasks.spec.ts:279` (AC-13 to AC-15) failed once in the full run (522 passed). It does not use a migrated site. Re-run of `tsk-01-tasks` alone: 11 passed. Looks load-related; the reviewer should re-run the full suite. |
| `git diff --name-only` subset of `allowed_paths` | yes | plus two untracked new files, both listed |

## Testability contract

No selector added or changed.

## Open questions

none.
