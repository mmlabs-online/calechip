---
ticket: TSK-06
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-18T20:19:00+0700
inputs_read:
  - .ai/board/tickets/TSK-06/01-plan.md
  - .ai/board/tickets/TSK-06/ticket.yaml
  - .ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.png
  - .ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time-row-actions-2.png
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
consulted:
  - with: tech-lead-design
    asked: "Task.timeOfDay is required (§ 4.1); three test files outside allowed_paths build Task literals and fail tsc. Add them to allowed_paths for a one-line `timeOfDay: null,` each, or make the field optional?"
    answer: "Option 1. tests/overdue-prompt.test.ts, tests/pto-tasks.test.ts and tests/task-tick.test.ts added to allowed_paths, one line each; optional field refused. size corrected M to L (17 paths) — the operator's call whether to continue or split."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TSK-06 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261018120000_tsk06_task_time_of_day.sql` | created | ADR-062's column, shape check and re-issued grants, as § 6 gives them | § 6 |
| `src/lib/domain/types.ts` | modified | `Task.timeOfDay` and `invalid_task_time`; the "no time field" doc comment amended with the old wording kept | § 4.1 |
| `src/lib/data/index.ts` | modified | `CreateTaskInput.timeOfDay?`, `UpdateTaskInput.timeOfDay`; doc comments for `listTasks` order, refusal order, move keeps time | § 4.2 |
| `src/lib/data/supabase.ts` | modified | column in `TaskRow`/`TASK_COLUMNS`, `toTask` slices `HH:MM`, `taskTime`, the new `order by`, insert and update write the time | § 4.3, § 4.4 |
| `src/lib/data/mock.ts` | modified | `taskTime`, `byDayOrder` for `listTasks` (overdue keeps `byTaskOrder`), create and update write the time | § 4.3, § 4.5 |
| `src/lib/week-tasks.ts` | modified | `weekDaysOf`, `stripMark`, `stripCellLabel`, `weekTotals` | § 4.6 |
| `src/routes/Tasks.tsx` | modified | the page rearranged per § 2b: one week read, strip, day card with progress, summary, icon row actions with tooltips, time fields | § 4.7, § 2b |
| `tests/task-time.test.ts` | created | AC-1 to AC-5, AC-7, AC-8, AC-10 through the seams | § 2 |
| `tests/week-tasks.test.ts` | modified | the four new helpers; `timeOfDay: null` in its `Task` fixture | § 4.6 |
| `tests/tasks.test.ts` | modified | AC-20 narrowed per AC-6 (TSK-06 migration read too), key list gains `timeOfDay`, `updateTask` calls gain `timeOfDay: null`, AC-9's read order amended per AC-8 | § 7 |
| `tests/e2e/tsk-06-task-week.spec.ts` | created | what a person sees: AC-1, 2, 3, 8, 9, 11 to 16, 18, 21, 22 | § 2 |
| `tests/e2e/tsk-01-tasks.spec.ts` | modified | one assertion: today's heading now reads `Today · …` (AC-15) | § 7 |
| `tests/overdue-prompt.test.ts` | modified | `timeOfDay: null,` in its `Task` fixture — the one line the consultation allowed | § 7 as amended |
| `tests/pto-tasks.test.ts` | modified | same, before `...over` | § 7 as amended |
| `tests/task-tick.test.ts` | modified | same | § 7 as amended |
| `.ai/board/tickets/TSK-06/99-questions.md` | created | the consultation above | — |
| `.ai/board/tickets/TSK-06/03-impl-log.md` | created | this file | — |
| `.ai/board/tickets/TSK-06/ticket.yaml` | modified | `state: REVIEW` (the amendment's edits are `tech-lead-design`'s) | — |

`.ai/registry/glossary.md` and the ADR-062 file are in `allowed_paths` and were **not** touched: both rows were already written at PLAN, and the ADR is not the Developer's.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 `Task.timeOfDay` | `src/lib/domain/types.ts:1248` | |
| 4.1 `invalid_task_time` | `src/lib/domain/types.ts:296` | |
| 4.2 `CreateTaskInput.timeOfDay?` / `UpdateTaskInput.timeOfDay` | `src/lib/data/index.ts:267`, `:277` | |
| 4.2 `listTasks` order doc | `src/lib/data/index.ts:1559` | |
| 4.3 `TASK_TIME_INVALID`, `taskTime` | `supabase.ts:635`, `:656`; `mock.ts:1443`, `:1463` | regex `^([01]\d|2[0-3]):[0-5]\d$` |
| 4.4 columns, mapper | `supabase.ts:613`, `:622` | |
| 4.4 order | `supabase.ts:4158` | `date, done, time_of_day nulls last, created_at, id` |
| 4.4 create / update write | `supabase.ts:4199`, `:4211` | refusal order title, note, time, date |
| 4.5 `byDayOrder` | `mock.ts:1493`, used `:4049` | overdue keeps `byTaskOrder` |
| 4.5 create / update write | `mock.ts:4077`, `:4090` | |
| 4.6 helpers | `src/lib/week-tasks.ts:59`, `:66`, `:73`, `:79` | |
| 4.7 one week read | `Tasks.tsx:623` | day list = filter of it |
| 4.7 outcome applied to `week` | `Tasks.tsx:599` | |
| 4.7 `rowKey` gains time | `Tasks.tsx:677` | |
| 4.7 `fieldOf` → `time` | `Tasks.tsx:105` | |
| 4.7 add / edit send `timeOfDay` | `Tasks.tsx:473`, `:304` | |

## Deviations from the design

1. **The day heading is an `h2`, and the overdue heading moved from `h2` to `h3`.** The heading moved
   into the day card. `data-testid` and `data-day` are unchanged. Done for the outline: page `h1`, then
   card `h2`s, then the overdue section inside the day card.
2. **AC-4's on-page message is not driven end to end.** The native time field (§ 1 decision 7) cannot
   hold a non-`HH:MM` value, so the page cannot send one. The field error is wired (`fieldOf` → `time`,
   `FieldError field="time"` in both forms), and the seam's refusal and sentence are asserted in
   `tests/task-time.test.ts`. Recorded in the spec's header.
3. **`stripCellLabel` uses the singular for one task** (*… 1 of 1 task done*) because it reuses
   TSK-04's `tallyLabel`. AC-12 gives only plural examples. One phrasing for the strip and the badge.
4. **The strip's marks are blank while the week is being read**, not `–`. Otherwise a day with tasks
   would claim "no tasks" for a moment.

Otherwise `none`.

## Invariants

`invariants_touched: []`. The time enters no count: `taskTalliesFor` reads `date` and `done` only,
and `listOverdueTasks` filters on `date` and `done` (AC-5, asserted in `tests/task-time.test.ts`). No
module that feeds `absenceCountsFor` was edited.

## Verification run

Run 2026-10-18 at about 20:14 to 20:18 +0700.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 45 files, 873 tests |
| `pnpm exec playwright test` | 0 | 447 passed, 21 skipped (pre-existing skips) |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, subset of `allowed_paths` |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `tasks-week-strip` | `Tasks.tsx:711` |
| `tasks-week-label` | `Tasks.tsx:722` |
| `tasks-prev-week`, `tasks-next-week` | `Tasks.tsx:714`, `:726` |
| `tasks-week-day` | `Tasks.tsx:742` |
| `tasks-week-day-mark` | `Tasks.tsx:759` |
| `tasks-day-heading` | `Tasks.tsx:789` |
| `tasks-day-progress` | `Tasks.tsx:846` |
| `tasks-week-summary` | `Tasks.tsx:913` |
| `tasks-week-done`, `tasks-week-left` | `Tasks.tsx:922`, `:928` |
| `task-time` | `Tasks.tsx:222` |
| `task-add-time`, `task-edit-time` | `Tasks.tsx:511`, `:326` |
| `task-edit`, `task-move`, `task-delete` | `Tasks.tsx:398`, `:401`, `:405` |

Every TSK-01 to TSK-05 `data-testid` keeps its name and meaning. All five earlier `tsk-0*` specs pass.

## Open questions

1. **Size L vs M.** `tech-lead-design` corrected `size` to L at the consultation (17 paths). Whether
   TSK-06 goes on as L or is split is the operator's decision. The work is complete as one unit.
2. **The consultation's `asked_at` (20:40) was written by hand, and it is wrong.** The machine clock
   read about 20:10 when the question was asked. The record is left as it is, per the template, and
   corrected here.
3. **Applying the migration is human (RULE-09).** It has not been run against a real PostgreSQL.
   § 6 says the same.
4. **Owed to `/thuki`** (§ 6): ADR-057's Status note, `data-model.md`, `rbac-and-security.md`, and the
   charter sentence.
