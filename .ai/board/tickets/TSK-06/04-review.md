---
ticket: TSK-06
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-18T20:22:25+0700
inputs_read:
  - .ai/board/tickets/TSK-06/01-plan.md
  - .ai/board/tickets/TSK-06/03-impl-log.md
  - .ai/board/tickets/TSK-06/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD (28 files); working tree clean
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

# TSK-06 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs TSK-06` → "28 changed file(s) … exempt .ai/board/ideas/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.md <- the idea that promoted TSK-06 (ADR-054) … allowed-paths: PASS", exit 0. `node scripts/check-carry.mjs TSK-06` → "0 uncommitted path(s) … PASS — nothing stray", exit 0. Allowed list at `.ai/board/tickets/TSK-06/ticket.yaml:16-36` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint <diff .ts/.tsx>` → exit 0; repo-wide `pnpm exec eslint .` → exit 0, nothing outside the diff to note |
| R4 | No datastore access outside the seam | PASS | The page reaches data only through `seam` (`src/routes/Tasks.tsx:28`, calls at `:304`, `:424`, `:473`, `:575`, `:590`, `:623-624`, `:653`); `src/lib/week-tasks.ts:7-8` imports types and `@/lib/period` only; no `@supabase` import outside `src/lib/data/` |
| R5 | Every § 4 contract item implemented | PASS | R5 detail below |
| R6 | Permission gating matches § 3 | PASS | Grants re-issued with `time_of_day` in insert and update only, `anon` revoked: `supabase/migrations/20261018120000_tsk06_task_time_of_day.sql:38-41`; no policy created or altered (file holds no `policy`), so `task_*_own` from `supabase/migrations/20261015120000_tsk01_task.sql:69-98` cover the column; `member_id` stays out of both grants (`…tsk06_task_time_of_day.sql:40-41`); seam passes no member on the read (`src/lib/data/supabase.ts:4152-4161`) and the mock filters `ownsTask` (`src/lib/data/mock.ts:4048`) |
| R7 | No invariant violated | PASS | R7 detail below |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; `lucide-react` icons at `src/routes/Tasks.tsx:42` come from an existing dependency |

Supporting run, not a gate item: `pnpm exec vitest run` → 45 files, 873 tests passed, exit 0.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `Task.timeOfDay: string \| null` | `src/lib/domain/types.ts:1248` | Yes |
| § 4.1 `FailureCode` `"invalid_task_time"` after `invalid_task_note` | `src/lib/domain/types.ts:294-296` | Yes |
| § 4.2 `CreateTaskInput.timeOfDay?: string \| null` | `src/lib/data/index.ts:266-267` | Yes |
| § 4.2 `UpdateTaskInput.timeOfDay: string \| null` (required) | `src/lib/data/index.ts:276-277` | Yes |
| § 4.2 `listTasks` order doc; `listOverdueTasks` order unchanged doc; refusal order doc; `moveTask` keeps time doc | `src/lib/data/index.ts:1559-1561`, `:1566-1567`, `:1569-1571`, `:1581` | Yes |
| § 4.3 `TASK_TIME_INVALID`, `taskTime` (real) | `src/lib/data/supabase.ts:635`, `:654-664` | Yes — regex `^([01]\d\|2[0-3]):[0-5]\d$`, "" / null → no time |
| § 4.3 `TASK_TIME_INVALID`, `taskTime` (mock) | `src/lib/data/mock.ts:1443`, `:1461-1471` | Yes, identical |
| § 4.4 `TaskRow.time_of_day`, `TASK_COLUMNS`, `toTask` slice to `HH:MM` | `src/lib/data/supabase.ts:606`, `:613`, `:622` | Yes |
| § 4.4 `updateTaskRow` values gain `time_of_day` | `src/lib/data/supabase.ts:688` | Yes |
| § 4.4 `listTasks` order date, done, time_of_day nulls last, created_at, id | `src/lib/data/supabase.ts:4156-4160` | Yes |
| § 4.4 `listOverdueTasks` order unchanged | `src/lib/data/supabase.ts:4176-4178` | Yes |
| § 4.4 create inserts `time_of_day`; refusal order title, note, time, date | `src/lib/data/supabase.ts:4190-4199` | Yes |
| § 4.4 update writes `{ title, note, time_of_day }` | `src/lib/data/supabase.ts:4207-4211` | Yes |
| § 4.5 `byDayOrder` clause for clause; `listTasks` uses it; overdue keeps `byTaskOrder` | `src/lib/data/mock.ts:1493-1500`, `:4049` | Yes |
| § 4.5 create row gains `timeOfDay`; update writes it; `updateOwnTask` type gains it | `src/lib/data/mock.ts:4064-4077`, `:4088-4090`, `:1511` | Yes |
| § 4.6 `weekDaysOf`, `stripMark`, `stripCellLabel`, `weekTotals` | `src/lib/week-tasks.ts:59-62`, `:66-69`, `:73-76`, `:79-87` | Yes — `stripCellLabel` reuses `tallyLabel`'s singular (impl-log deviation 3); AC-12 gives only plural examples and the signature matches |
| § 4.7 one week read; day list is its filter; `LoadState.ready.week` | `src/routes/Tasks.tsx:543`, `:622-633` | Yes |
| § 4.7 tallies from `week.map(ticker.shown)` | `src/routes/Tasks.tsx:688-692` | Yes |
| § 4.7 `applyOutcome` applied to `week` | `src/routes/Tasks.tsx:599` | Yes |
| § 4.7 `rowKey` gains `timeOfDay` | `src/routes/Tasks.tsx:677-678` | Yes |
| § 4.7 `Field` gains `"time"`, `fieldOf` maps it, `Errors.time` | `src/routes/Tasks.tsx:96`, `:105-106`, `:117` | Yes |
| § 4.7 `AddTaskForm` sends `timeOfDay: time`, clears on success | `src/routes/Tasks.tsx:473`, `:482` | Yes |
| § 4.7 edit form opens on `task.timeOfDay ?? ""`, sends `timeOfDay` | `src/routes/Tasks.tsx:250`, `:271`, `:304` | Yes |
| § 4.6 selectors: strip, label, week arrows, day cells with `data-day` / `data-today` / `aria-current` / `aria-label` | `src/routes/Tasks.tsx:711`, `:722`, `:714-716`, `:726-728`, `:742-746` | Yes |
| selectors: `tasks-week-day-mark`, `tasks-day-progress` with `data-done`/`data-total` | `src/routes/Tasks.tsx:759`, `:846` | Yes |
| selectors: `tasks-week-summary` with `data-done`/`data-total`, `tasks-week-done`, `tasks-week-left` | `src/routes/Tasks.tsx:913-915`, `:922`, `:928` | Yes |
| selectors: `task-time` with `data-time`; `task-add-time`, `task-edit-time` `type="time"`, `aria-label` *Time (optional)* | `src/routes/Tasks.tsx:222`, `:174-178`, `:511`, `:326` | Yes |
| selectors: `task-field-error` `data-field="time"` | `src/routes/Tasks.tsx:130`, `:327`, `:522` | Yes |
| AC-18 row actions in order with labels, `peer` tooltip, pink bin hover | `src/routes/Tasks.tsx:69-71`, `:188-217`, `:397-411` | Yes |
| § 6 migration as transcribed | `supabase/migrations/20261018120000_tsk06_task_time_of_day.sql:27-43` | Yes, statement for statement |

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/TSK-06/ticket.yaml:15`). There are no IDs to list
row by row. Reasoned against each invariant in `.ai/registry/invariants.md` anyway, since an empty
list is itself the claim under review:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01, INV-02, INV-03, INV-06 | Concern entries; no entry module, table or seam method is in the diff | `git diff --name-only origin/main...HEAD` lists no entry file |
| INV-04, INV-05, INV-07 | A task is in no absence count and the time enters no count: `taskTalliesFor` reads `date` and `done` only; `week-tasks.ts` imports nothing that feeds `absenceCountsFor` | `src/lib/week-tasks.ts:7-8`, `:19-31` |
| ADR-062 decision 4 (time drives no overdue test) | Overdue order and filter untouched by `time_of_day` | `src/lib/data/supabase.ts:4176-4178`; `src/lib/data/mock.ts:4049` vs overdue's `byTaskOrder` |

## Findings

None.

## Verdict

PASS.
