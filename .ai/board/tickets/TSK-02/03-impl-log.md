---
ticket: TSK-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-17T22:45:06+0700
inputs_read:
  - .ai/board/tickets/TSK-02/01-plan.md
  - .ai/board/tickets/TSK-02/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - src/components/AppShell.tsx
  - src/components/Modal.tsx
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/routes/Tasks.tsx
  - src/lib/task-tick.ts
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - tests/tasks.test.ts
  - tests/e2e/tsk-01-tasks.spec.ts
  - tests/e2e/tsk-05-optimistic-tick.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TSK-02 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/overdue-prompt.ts` | created | the once-per-opening gate and the sequential, never-throwing move-all, pure and seam-free (RULE-02) | § 4.1 |
| `src/components/OverduePrompt.tsx` | created | the dialog: opening read, optimistic tick, move all, close-with-change signal | § 4.2, § 4.4, § 2b |
| `src/components/AppShell.tsx` | modified | mounts the prompt once for every screen, carries `tasksRevision` in the outlet context, forgets the gate on a successful sign-out | § 4.3 |
| `src/routes/Tasks.tsx` | modified | reloads when `tasksRevision` rises, so the page beneath agrees once the prompt closes | § 4.3, AC-10 |
| `tests/overdue-prompt.test.ts` | created | AC-3, AC-7, AC-8, AC-11 against the module and the mock seam | § 5 |
| `tests/e2e/tsk-02-overdue-prompt.spec.ts` | created | AC-1 to AC-5, AC-7, AC-9, AC-10 through the screen | § 5 |
| `.ai/board/tickets/TSK-02/03-impl-log.md` | created | this log | — |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `claimOverduePrompt` | `src/lib/overdue-prompt.ts:18` | a module `Set` of member ids |
| 4.1 `forgetOverduePrompt` | `src/lib/overdue-prompt.ts:25` | clears the set |
| 4.1 `MoveWrite`, `MOVE_FAILED`, `MoveAllResult` | `src/lib/overdue-prompt.ts:30-41` | as declared |
| 4.1 `moveAllToToday` | `src/lib/overdue-prompt.ts:44` | `await` in a loop — one at a time; a throw or rejection becomes `unknown` / `MOVE_FAILED` |
| 4.2 `OverduePromptProps`, default export | `src/components/OverduePrompt.tsx:38-45` | |
| 4.2 on mount: claim, `eventToday()` once, `listOverdueTasks`, not discarded on cleanup | `src/components/OverduePrompt.tsx:87` | a rejected read is `console.error` and nothing (AC-12) |
| 4.2 ticks via `createTaskTicker` + `applyOutcome` | `src/components/OverduePrompt.tsx:66`, `:118` | `src/lib/task-tick.ts` unchanged |
| 4.2 count = rows shown not done | `src/components/OverduePrompt.tsx:115` | |
| 4.2 move all: shown-not-done only, disabled while running, drop `moved`, error per `failed`, close when none failed | `src/components/OverduePrompt.tsx:124` | |
| 4.2 close calls `onTasksChanged` once if anything saved | `src/components/OverduePrompt.tsx:103` | see Deviations for a tick that lands after close |
| 4.3 `ShellContext.tasksRevision` | `src/components/AppShell.tsx:78`, `:113`, `:163` | |
| 4.3 `<OverduePrompt>` beside `ReportIssueButton` | `src/components/AppShell.tsx:174` | outside the scrolling pane |
| 4.3 `Sidebar` gets a `signOut` that forgets on `ok` only | `src/components/AppShell.tsx:118`, `:139` | `AppShellProps` unchanged |
| 4.3 `Tasks.tsx` reloads on `tasksRevision` | `src/routes/Tasks.tsx:396`, `:456` | added to the effect's deps, not `load`'s |

## Deviations from the design

1. **A tick still in flight when the prompt closes reports when it lands.** § 4.2 says close calls
   `onTasksChanged()` once if a `saved` tick outcome was recorded. A tick pressed just before Close
   has no outcome yet at that moment, so `/tasks` beneath would miss it (AC-10). The ticker's
   `saved` handler therefore calls `onTasksChanged()` directly when the prompt is already closed
   (`src/components/OverduePrompt.tsx:76-77`). No new field name; the prop's meaning is unchanged —
   *a task in the prompt was saved, reload*.
2. **e2e AC-3 navigates through `nav-events-link`, not the week view.** `home-week-link` is
   commented out in `Sidebar.tsx`; the criterion is "moves between screens", which any in-app link
   satisfies.

## Invariants

`invariants_touched: []`. The prompt writes only `done` and `date` on the caller's own tasks through
`setTaskDone` and `moveTask`; a task is not an entry, so no absence count, overload or entry
invariant (INV-01 to INV-07) is reached. No file under `src/lib/data/`, no calendar route and no
notification code is edited (AC-13).

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 42 files, 826 tests |
| `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts` | 0 | 9 passed (incl. seam guard) |
| `pnpm exec playwright test` (full) | 0 | 420 passed, 21 skipped |
| `git diff --name-only` ⊆ `allowed_paths` | yes | plus this log |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `overdue-prompt-modal` | `src/components/Modal.tsx` via `testIdPrefix`, `src/components/OverduePrompt.tsx:149` |
| `overdue-prompt-close` | same |
| `overdue-prompt` | `src/components/OverduePrompt.tsx:150` |
| `overdue-prompt-count` | `src/components/OverduePrompt.tsx:159` |
| `overdue-prompt-row` | `src/components/OverduePrompt.tsx:172` |
| `overdue-prompt-done` | `src/components/OverduePrompt.tsx:181` |
| `overdue-prompt-date-chip` | `src/components/OverduePrompt.tsx:200` |
| `overdue-prompt-title` | `src/components/OverduePrompt.tsx:204` |
| `overdue-prompt-row-error` | `src/components/OverduePrompt.tsx:211` |
| `overdue-prompt-move-all` | `src/components/OverduePrompt.tsx:223` |
| `overdue-prompt-dismiss` | `src/components/OverduePrompt.tsx:231` |

## Open questions

None.
