---
ticket: TSK-02
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-17T22:49:00+0700
inputs_read:
  - .ai/board/tickets/TSK-02/01-plan.md
  - .ai/board/tickets/TSK-02/03-impl-log.md
  - .ai/board/tickets/TSK-02/ticket.yaml
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
  - src/lib/overdue-prompt.ts
  - src/components/OverduePrompt.tsx
  - src/components/AppShell.tsx
  - src/routes/Tasks.tsx
  - src/lib/data/index.ts
  - eslint.config.js
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

# TSK-02 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS`, exit 0 (10 changed files: the six allowed paths, the ticket folder, `.ai/board/backlog.md` ship-owned). `node scripts/check-carry.mjs TSK-02` → `0 uncommitted path(s)`, `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` on the six changed source/test files exit 0; repo-wide `eslint .` exit 0 |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/components/OverduePrompt.tsx:15` imports only `seam` from `@/lib/data`; calls at `:67`, `:91`, `:129`. `src/lib/overdue-prompt.ts:10` imports types only; the write is injected (`:30`, `:50`). No Supabase import in either file; the `no-restricted-imports` rule at `eslint.config.js:64` passed |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches § 3 | PASS | Reads/writes only through `listOverdueTasks`, `setTaskDone`, `moveTask` as declared at `src/lib/data/index.ts:1562`, `:1579`, `:1575`; `listOverdueTasks(today)` takes no member (`src/components/OverduePrompt.tsx:91`); `memberId` is used only as the gate key (`:88`); no `useViewedTeam` or member read in the file. Mounted only inside the shell (`src/components/AppShell.tsx:174`) |
| R7 | No invariant violated | PASS | `invariants_touched: []`; see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; new imports (`date-fns`, `react`) are existing dependencies (`src/components/OverduePrompt.tsx:13-14`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `claimOverduePrompt(memberId): boolean` | `src/lib/overdue-prompt.ts:18` | yes — module `Set`, true once per member |
| 4.1 `forgetOverduePrompt(): void` | `src/lib/overdue-prompt.ts:25` | yes |
| 4.1 `MoveWrite` | `src/lib/overdue-prompt.ts:30` | yes |
| 4.1 `MOVE_FAILED` | `src/lib/overdue-prompt.ts:33` | yes, same string |
| 4.1 `MoveAllResult` | `src/lib/overdue-prompt.ts:35-40` | yes |
| 4.1 `moveAllToToday` — sequential, never stops, throw → `unknown`/`MOVE_FAILED` | `src/lib/overdue-prompt.ts:44-58` | yes — `await` in loop `:50`, catch `:51-53` |
| 4.2 `OverduePromptProps`, default export | `src/components/OverduePrompt.tsx:38-45` | yes |
| 4.2 on mount: claim, `eventToday()` once, `listOverdueTasks`, empty → nothing, throw → `console.error`, not discarded on cleanup | `src/components/OverduePrompt.tsx:87-101` | yes — no cleanup returned |
| 4.2 ticks via `createTaskTicker` + `applyOutcome`, unchanged | `src/components/OverduePrompt.tsx:66-81`, `:118-121` | yes |
| 4.2 count = rows shown not done | `src/components/OverduePrompt.tsx:114-115` | yes |
| 4.2 move all: shown-not-done only, disabled while running, drop `moved`, per-row `failed`, close when none failed | `src/components/OverduePrompt.tsx:124-146`, `:225` | yes |
| 4.2 close → `onTasksChanged()` once if anything saved | `src/components/OverduePrompt.tsx:103-110` | yes; deviation 1 (in-flight tick reported on landing, `:75`) keeps the prop's meaning and serves AC-10 |
| 4.3 `ShellContext.tasksRevision: number` | `src/components/AppShell.tsx:78`, `:113`, `:163` | yes |
| 4.3 `<OverduePrompt>` beside `ReportIssueButton` | `src/components/AppShell.tsx:174` | yes |
| 4.3 `Sidebar` gets `signOut` that forgets on `ok` only; `AppShellProps` unchanged | `src/components/AppShell.tsx:118-122`, `:139` | yes |
| 4.3 `Tasks.tsx` reloads on `tasksRevision`, effect deps not `load`'s | `src/routes/Tasks.tsx:396`, `:456` | yes |
| 4.4 selectors (all eleven) | `src/components/OverduePrompt.tsx:149` (`-modal`, `-close` via `Modal` prefix), `:150`, `:159`, `:172-175`, `:181-184`, `:200`, `:204`, `:211`, `:223`, `:231` | yes, incl. `data-task-id`/`data-date`/`data-done`, `role="checkbox"`, `aria-checked`, `role="alert"` |
| 4.4 copy and `aria-label` | `src/components/OverduePrompt.tsx:149`, `:159-162`, `:229`, `:232` | yes |
| § 5 tests | `tests/overdue-prompt.test.ts` (5 passed), `tests/e2e/tsk-02-overdue-prompt.spec.ts` (9 passed) | yes |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml`, plan § 2). Reasoned per the plan's own fence, not by
assertion:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 – INV-07 (entry and absence-count invariants) | The only writes are `setTaskDone` and `moveTask` on tasks, which are not entries; no file under `src/lib/data/`, no calendar route, `absence.ts`, `busy.ts`, `day-status.ts` or notification code is in the diff | `src/components/OverduePrompt.tsx:67`, `:129`; `git diff --stat origin/main...HEAD` lists only the six allowed paths plus board files |

## Findings

None.

## Verdict

PASS.
