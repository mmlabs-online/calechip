---
ticket: TSK-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-16T08:04:02+0700
inputs_read:
  - .ai/board/tickets/TSK-05/01-plan.md
  - .ai/board/tickets/TSK-05/03-impl-log.md
  - .ai/board/tickets/TSK-05/ticket.yaml
  - .ai/templates/review-report.md
  - src/lib/task-tick.ts
  - src/routes/Tasks.tsx
  - tests/task-tick.test.ts
  - tests/e2e/tsk-01-tasks.spec.ts
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

Second pass, after the REVIEW FAIL of 2026-10-15 (R5, routed to `tech-lead-design`; `01-plan.md`
Changelog 2026-10-16). The previous report is in commit `51c6974`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted nothing stray | PASS | `node scripts/check-allowed-paths.mjs` → `11 changed file(s)`, `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs TSK-05` → `carried .ai/board/ideas/2026-10-15-ticking-a-task-done-waits-two-round-trips-and-locks-the-box.md <- the idea that promoted it`, `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint src/lib/task-tick.ts src/routes/Tasks.tsx tests/task-tick.test.ts tests/e2e/tsk-05-optimistic-tick.spec.ts tests/e2e/tsk-01-tasks.spec.ts` exit 0; `pnpm exec eslint .` exit 0 |
| R4 | No datastore access outside the seam | PASS | The tick's only write is `seam.setTaskDone` at `src/routes/Tasks.tsx:411`, passed into the module; `src/lib/task-tick.ts:14` imports types only |
| R5 | Every § 4 contract item implemented | PASS | Detail below; the amended § 4.2 `onOutcome` is at `src/routes/Tasks.tsx:413-427`, `applyOutcome` at `src/lib/task-tick.ts:61-71` |
| R6 | Permission gating matches § 3 | PASS | No gating added or removed; the write stays `seam.setTaskDone(id, done)` at `src/routes/Tasks.tsx:411`; a refusal rolls back at `src/lib/task-tick.ts:106-108`, is written into the lists at `src/routes/Tasks.tsx:418` and surfaced at `:424-425` |
| R7 | No invariant violated | PASS | `invariants_touched: []`; see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; the new import at `src/routes/Tasks.tsx:22` is an in-repo module |

Also run: `pnpm exec vitest run tests/task-tick.test.ts` — 19 passed; `pnpm exec playwright test
tests/e2e/tsk-05-optimistic-tick.spec.ts tests/e2e/tsk-01-tasks.spec.ts` — 13 passed.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `TickWrite` | `src/lib/task-tick.ts:17` | yes |
| 4.1 `TICK_FAILED` | `src/lib/task-tick.ts:20` | yes |
| 4.1 `TickOutcome` (`saved`, `failed`, `settled`) | `src/lib/task-tick.ts:23-30` | yes |
| 4.1 `TaskTicker` (`tap`, `shown`, `mark`, `reconcile`) | `src/lib/task-tick.ts:32-43`, `:128-152` | yes |
| 4.1 `createTaskTicker(write, onChange, onOutcome)` | `src/lib/task-tick.ts:75-80` | yes |
| 4.1 `applyOutcome(list, outcome)` — `saved` replaces the task, `failed`/`settled` replace `done`, absent task or no change returns the same array | `src/lib/task-tick.ts:61-71` | yes |
| 4.1 one run per task; `tap` opens it, flips `desired`, bumps `seq`, calls `onChange` before sending | `src/lib/task-tick.ts:129-137` | yes |
| 4.1 one write in flight per task | `src/lib/task-tick.ts:87`, `:102`, `:137` | yes |
| 4.1 throw or reject → `unknown` + `TICK_FAILED` | `src/lib/task-tick.ts:73`, `:90-98` | yes |
| 4.1 answer: success sets `confirmed`; superseded failure `console.error`s; resend when `desired !== confirmed`; else close with one outcome and `{ done, at: ++counter }` | `src/lib/task-tick.ts:101-125` | yes — impl-log deviation 1 (a current failure rolls `desired` back first, `:108`) is the reading AC-3 needs |
| 4.1 no clock, timer or debounce | `src/lib/task-tick.ts:1-154` (none present) | yes |
| 4.2 one ticker via `useRef`, `write = seam.setTaskDone`, `onChange` bumps a render counter | `src/routes/Tasks.tsx:406-413` | yes |
| 4.2 `onOutcome` writes every outcome into both lists; `saved` clears the error; `failed` sets it; `settled` nothing further | `src/routes/Tasks.tsx:418`, `:421-426` | yes |
| 4.2 tick errors `Record<string, string>`, cleared before `ticker.tap` | `src/routes/Tasks.tsx:404`, `:482-485` | yes |
| 4.2 `load` reads `mark` before its requests, reconciles both lists | `src/routes/Tasks.tsx:434`, `:443-444` | yes |
| 4.2 rows get `ticker.shown(task)`, `onTick` with the unshown task, `tickError` | `src/routes/Tasks.tsx:556`, `:561-562`, `:574`, `:579-580` | yes |
| 4.2 box `onClick={onTick}`, no `disabled` on the box; save controls keep `disabled={busy}` | `src/routes/Tasks.tsx:221`; `:202`, `:296`, `:366` | yes |
| 4.2 `errors.general ?? tickError` in view and move modes | `src/routes/Tasks.tsx:307` | yes |
| 4.2 row keys drop `done` | `src/routes/Tasks.tsx:488` | yes |
| 4.2 overdue count from shown values; section condition unchanged | `src/routes/Tasks.tsx:549`; `:543` | yes |
| 4.2 no `setTaskDone` inside `run`; the tick never calls `load` or `onChanged` | the only `setTaskDone` is `src/routes/Tasks.tsx:411` | yes |
| 4.3 selectors unchanged | `src/routes/Tasks.tsx:168`, `:216`, `:548` | yes |
| § 5 tests, rework shapes (a) and (b), and `applyOutcome` | `tests/task-tick.test.ts:301`, `:320`, `:345`, `:353`, `:360` | yes — impl-log reads shape (b) as the third tap after write 1 answers, the only order in which a superseded failure follows a success |
| § 5 TSK-01 AC-14 amended (AC-9) | `tests/e2e/tsk-01-tasks.spec.ts:273-278` | yes |

**Last pass's Finding 1 is closed.** A run that ends `failed` or `settled` after an earlier
successful write now writes its `done` (`src/lib/task-tick.ts:122-123`, the `confirmed` set at
`:105`) into both lists (`src/routes/Tasks.tsx:418`) before `shown` falls back to them (run deleted at
`src/lib/task-tick.ts:119`), and both shapes are asserted at `tests/task-tick.test.ts:301` and `:320`.

## R7 detail

`invariants_touched: []`, written explicitly at PLAN (`01-plan.md` § 2). No ID to reason through.
The diff (`git diff --stat origin/main...HEAD`) touches no file under `src/lib/domain/`, nor any
entry path; the tick writes the same `done` column through the unchanged `seam.setTaskDone`
(`src/routes/Tasks.tsx:411`).

| Invariant | Held by | Citation |
|---|---|---|
| — (none touched) | n/a | `src/routes/Tasks.tsx:411` is the only write the ticket adds |

## Findings

None.

## Verdict

`PASS` — R1 to R8 hold; the ticket advances to DONE.
