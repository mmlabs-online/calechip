---
ticket: TSK-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-15T16:40:26+0700
inputs_read:
  - .ai/board/tickets/TSK-01/01-plan.md
  - .ai/board/tickets/TSK-01/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TSK-01 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | The `Task` type, its two bounds, and four new `FailureCode` members | § 4.1 |
| `src/lib/data/index.ts` | modified | `CreateTaskInput`, `UpdateTaskInput` and the seven seam signatures | § 4.2 |
| `src/lib/data/supabase.ts` | modified | The real seven: table calls under RLS, never filtering on `member_id`; refusals before the request | § 4.2, § 4.4 |
| `src/lib/data/mock.ts` | modified | In-memory table, `__resetTasks()`, `ownsTask` reproducing the policy predicate with no role clause | § 4.2, § 4.5 |
| `supabase/migrations/20261015120000_tsk01_task.sql` | created | Table, index, four owner-only policies, grants; no function, trigger or publication | § 4.3 |
| `src/App.tsx` | modified | `/tasks` and `/tasks/:day`, guarded on `membership.state === "member"` | § 4.6 |
| `src/components/Sidebar.tsx` | modified | One `nav-tasks-link` under `shell-brand`, `aria-current` on `/tasks` and `/tasks/<day>` | § 4.6, AC-5 |
| `src/routes/Tasks.tsx` | created | The page: day navigation, overdue section, list, add/edit/move/tick/delete | § 2b, § 4.6, § 4.7 |
| `tests/tasks.test.ts` | created | AC-6–AC-22 at the seam and by reading the migration (30 tests) | § 5 Tests |
| `tests/e2e/tsk-01-tasks.spec.ts` | created | AC-1–AC-15 through the screen, with AC-5 for member, manager and admin (9 tests) | § 5 Tests |
| `.ai/board/tickets/TSK-01/03-impl-log.md` | created | This log | gate |
| `.ai/board/tickets/TSK-01/ticket.yaml` | modified | `state: REVIEW`, which `/implement` sets itself (`.claude/commands/advance.md:35`) | gate |

`.ai/registry/glossary.md` is in `allowed_paths` and was **not** touched: PLAN wrote the *Task* and
*Overdue* rows (01-plan.md § 7).

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `Task`, `TASK_TITLE_MAX`, `TASK_NOTE_MAX` | `src/lib/domain/types.ts:1237`, `:1248` | Seven fields, none a time |
| 4.1 four `FailureCode` members | `src/lib/domain/types.ts:291`–`:301` | Before `"unknown"` |
| 4.2 `CreateTaskInput`, `UpdateTaskInput` | `src/lib/data/index.ts:262`, `:270` | No `memberId`, no `done` |
| 4.2 seven seam functions | `src/lib/data/index.ts:1557`–`:1583` | Docblocks as the plan's |
| 4.2 the five sentences | `src/lib/data/supabase.ts` and `src/lib/data/mock.ts`, `TASK_*` constants | Verbatim in both; asserted equal in `tests/tasks.test.ts` |
| 4.3 migration | `supabase/migrations/20261015120000_tsk01_task.sql` | Statements as § 4.3; header states not run against PostgreSQL and the service-role bypass |
| 4.4 `TASK_COLUMNS`, `toTask` | `src/lib/data/supabase.ts:611`, `:613` | |
| 4.4 `taskText` (trim, title then note), `toTaskFailure` (42501/PGRST301/22P02 → `task_not_permitted`, else `unknown`) | `src/lib/data/supabase.ts:635`, `:656` | |
| 4.4 the seven calls | `src/lib/data/supabase.ts:4132`–`:4203` | No `.eq("member_id", …)` anywhere; zero rows → `task_not_permitted` |
| 4.5 `tasks`, `__resetTasks`, `ownsTask` | `src/lib/data/mock.ts:1411`, `:1419`, `:1434` | Same refusals in the same order |
| 4.5 the seven calls | `src/lib/data/mock.ts:4020`–`:4077` | |
| 4.6 routes | `src/App.tsx:607`, `:611` | Beside `/events` |
| 4.6 page | `src/routes/Tasks.tsx` | One `eventToday()` per render; `listTasks(day, day)` plus `listOverdueTasks(today)` on today; reloads after each write |
| 4.6 sidebar link | `src/components/Sidebar.tsx:338` | Link, not a button — UIE-10 AC-10's one-button count holds |
| 4.7 selectors | see *Testability contract* | All of them |

## Deviations from the design

None in contract, schema, permission or selectors. Two implementation choices the plan left open, recorded so the reviewer does not have to rediscover them:

1. **The move form has `noValidate`** (`src/routes/Tasks.tsx`, the move `<form>`). The date input carries `min` = today as § 4.7 says, but without `noValidate` the browser's own constraint check swallows a submit below `min` with no sentence, and AC-11's "the message is shown beside the date field" could never render. The `min` attribute still keeps the picker from offering earlier dates.
2. **The mock refuses a malformed date with `unknown`** (`isTaskDate`, `src/lib/data/mock.ts`), reproducing the `date` column's 22007/22008, which the real seam maps to `unknown` under § 4.4's "anything else". Without it the mock would store and read back a string PostgreSQL refuses. It runs after the plan's refusals and after the ownership check, so § 4.5's order is unchanged.

## Invariants

`invariants_touched: []`, as § 2 states. INV-04, INV-05 and INV-07 are about entries and the absence count; nothing in `absence.ts`, `busy.ts` or `day-status.ts` was edited, no seam function that reads entries reads `tasks`, and `tests/tasks.test.ts` AC-21 snapshots the team entries, busy days and absence counts for a range, writes and deletes tasks in it, and asserts the snapshot unchanged. INV-01, INV-02, INV-03 and INV-06 are about entries and no entry is written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 1 | 801 of 802 pass. The failure is `tests/event-email.test.ts` › *§ 2b: table layout … never Quicksand*, which **fails identically with this ticket's changes stashed** — pre-existing, not this ticket's. `tests/tasks.test.ts` 30/30, `tests/seam-parity.test.ts` passes unedited |
| `pnpm exec playwright test` | 1 | 408 pass, 1 fails: `uie-09-admin-hub.spec.ts` AC-4, a navigation timing assertion under eight workers; **passes when re-run alone**. `tsk-01-tasks.spec.ts` 9/9, `uie-10-sidebar.spec.ts` all pass |
| `git diff --name-only` ⊆ `allowed_paths` | yes | Plus this log and `ticket.yaml`, both board plane |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `nav-tasks-link` | `src/components/Sidebar.tsx:338` |
| `tasks-page` | `src/routes/Tasks.tsx:434` |
| `tasks-day-heading` (`data-day`) | `src/routes/Tasks.tsx:440` |
| `tasks-prev-day`, `tasks-next-day` | `src/routes/Tasks.tsx:446`, `:460` |
| `tasks-today` | `src/routes/Tasks.tsx:455` |
| `tasks-list` | `src/routes/Tasks.tsx:503` |
| `tasks-empty` | `src/routes/Tasks.tsx:516` |
| `task-row` (`data-task-id`, `data-date`, `data-done`) | `src/routes/Tasks.tsx:159` |
| `task-title`, `task-note`, `task-date-chip` | `src/routes/Tasks.tsx:237`, `:244`, `:230` |
| `task-done` (`role="checkbox"`, `aria-checked`) | `src/routes/Tasks.tsx:206` |
| `task-edit`, `task-move`, `task-delete` | `src/routes/Tasks.tsx:252`, `:255`, `:258` |
| `task-edit-title`, `task-edit-note`, `task-edit-save`, `task-edit-cancel` | `src/routes/Tasks.tsx:174`, `:182`, `:193`, `:196` |
| `task-move-date` (`min`), `task-move-save`, `task-move-cancel` | `src/routes/Tasks.tsx:279`, `:287`, `:290` |
| `task-field-error` (`data-field`) | `src/routes/Tasks.tsx:89` |
| `task-delete-confirm`, `-yes`, `-no` | `src/routes/Tasks.tsx:534`, `:544`, `:552` (inside `Modal` with prefix `task-delete-confirm`, `:533`) |
| `task-add-form`, `task-add-title`, `task-add-note`, `task-add-submit` | `src/routes/Tasks.tsx:315`, `:335`, `:344`, `:357` |
| `tasks-past-day-note` | `src/routes/Tasks.tsx:525` |
| `tasks-overdue`, `tasks-overdue-count` | `src/routes/Tasks.tsx:483`, `:485` |

## Open questions

- **Owed outside this ticket, unchanged from 01-plan.md § 6:** the charter paragraph and no-time sentence, and the `task` rows in `data-model.md` and `rbac-and-security.md` — `/thuki`, text already in the plan.
- **Two pre-existing red tests** (above) are not this ticket's and were not touched; `event-email.test.ts` fails on a clean tree.
