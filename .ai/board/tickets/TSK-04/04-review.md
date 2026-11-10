---
ticket: TSK-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-18T04:56:00Z
inputs_read: [ .ai/board/tickets/TSK-04/01-plan.md, .ai/board/tickets/TSK-04/03-impl-log.md, .ai/board/tickets/TSK-04/ticket.yaml, .ai/registry/invariants.md, .ai/templates/review-report.md, src/lib/week-tasks.ts, src/routes/WeekView.tsx, src/hooks/useViewedTeam.tsx, src/lib/data/index.ts, package.json ]
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

# TSK-04 — REVIEW

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket TSK-04, 8 changed file(s)` … `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs TSK-04` → `0 uncommitted path(s)` … `PASS — nothing stray`, exit 0. Non-ticket paths in diff: `src/lib/week-tasks.ts`, `src/routes/WeekView.tsx`, `tests/week-tasks.test.ts`, `tests/e2e/tsk-04-week-task-badge.spec.ts`, plus ship-owned `.ai/board/backlog.md` |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint` on the four changed source/test files → exit 0; repo-wide `pnpm exec eslint .` → exit 0, nothing outside the diff to route |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/routes/WeekView.tsx:146` imports `seam` from `@/lib/data`; the task read is `seam.listTasks(...)` at `src/routes/WeekView.tsx:419`. `src/lib/week-tasks.ts:6` imports types only |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | Cross-team suppression: `src/routes/WeekView.tsx:417` (`if (viewed.kind !== "own") return;`), with `tasks: []` initialised at `src/routes/WeekView.tsx:386`. Owner-only rows: the seam's `listTasks` (`src/lib/data/index.ts:1557`), unchanged. No task write imported or called — the only task call in `WeekView.tsx` is `listTasks` at `:419` |
| R7 | No invariant violated | PASS | `invariants_touched: []`; INV-04 reasoned in R7 detail. `absenceCountsFor(view.entries, range, view.roster)` at `src/routes/WeekView.tsx:464` takes no task input |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; `lucide-react` was already at `package.json:28` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `DayTaskTally { done; total }` | `src/lib/week-tasks.ts:9-12` | yes |
| 4.1 `taskTalliesFor(tasks: readonly Task[], range: DateRange): ReadonlyMap<string, DayTaskTally>` — inclusive range, out-of-range ignored, taskless days absent, input not mutated | `src/lib/week-tasks.ts:17-29` (range filter `:24`, fresh map `:21`) | yes |
| 4.1 `tallyText` → `${done}/${total}` | `src/lib/week-tasks.ts:32-34` | yes |
| 4.1 `tallyLabel` → `${done} of ${total} tasks done`, `task` when total === 1 | `src/lib/week-tasks.ts:37-39` | yes |
| 4.2 `ready` gains `tasks: Task[]`, `tasksFailed: boolean` | `src/routes/WeekView.tsx:260-261`, initialised `:386-387` | yes |
| 4.2 read only when `viewed.kind === "own"`, `seam.listTasks(range.start, range.end)` | `src/routes/WeekView.tsx:416-419` | yes |
| 4.2 post-grid, parallel with the event layer, caught separately, `stale()` guarded | `src/routes/WeekView.tsx:394-427` — `eventLayer` and `taskLayer` each with own `try/catch`, joined by `Promise.all` at `:427` | yes |
| 4.2 on throw: `tasksFailed: true`, `tasks` stays `[]` | `src/routes/WeekView.tsx:422-424` | yes |
| 4.2 `tallies` memo over `view.tasks` and `range` | `src/routes/WeekView.tsx:593-596` | yes |
| 4.2 badge inside the date-line span after the date, `ListChecks`, `aria-label`/`title` = `tallyLabel`, text `tallyText` | `src/routes/WeekView.tsx:887-899` | yes |
| 4.2 `week-tasks-unavailable` beside `week-events-unavailable`, text `Your task counts could not be loaded.` | `src/routes/WeekView.tsx:743-747` | yes |
| 4.3 `week-day-tasks` with `data-done`, `data-total`, `aria-label` | `src/routes/WeekView.tsx:889-892` | yes |
| 4.3 existing `data-testid`s unchanged | `git diff origin/main...HEAD -- src/routes/WeekView.tsx` removes no `data-testid` line | yes |

## R7 detail

`invariants_touched` is `[]`. The one invariant the plan names as nearest is reasoned below.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 (not touched; checked because the badge sits beside the absence count) | The tally is a separate function over a separate read and never reaches the count: `week-tasks.ts` imports only types (`src/lib/week-tasks.ts:6`); the absence count is still computed from `view.entries` alone (`src/routes/WeekView.tsx:464`); a failed task read sets only `tasksFailed` and never the `unavailable` phase (`src/routes/WeekView.tsx:422-424`) | `src/lib/week-tasks.ts:6`, `src/routes/WeekView.tsx:464` |

## Findings

None.

## Verdict

PASS.
