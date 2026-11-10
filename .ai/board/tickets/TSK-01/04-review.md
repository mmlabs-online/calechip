---
ticket: TSK-01
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-15T16:43:43+0700
inputs_read:
  - .ai/board/tickets/TSK-01/01-plan.md
  - .ai/board/tickets/TSK-01/03-impl-log.md
  - .ai/board/tickets/TSK-01/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD
  - supabase/migrations/20260910100000_solo_member_approval.sql
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

# TSK-01 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (15 changed files, exit 0). `node scripts/check-carry.mjs TSK-01` → `0 uncommitted path(s)`, `PASS — nothing stray` (exit 0). Every source path is in `ticket.yaml` `allowed_paths`; the rest are the ticket folder and `.ai/board/backlog.md` (ship-owned) |
| R2 | typecheck exit 0, whole-program | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint` over the nine changed `.ts`/`.tsx` files → exit 0, no output |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/routes/Tasks.tsx:15` imports `seam` from `@/lib/data` only; every call goes through it (`:170`, `:212`, `:273`, `:321`, `:390`–`:391`, `:413`). No `@supabase/*` import outside `src/lib/data/supabase.ts`; the `no-restricted-imports` rule (`eslint.config.*:64`–`:69`) passed under R3 |
| R5 | Every § 4 contract item implemented | PASS | See *R5 detail* |
| R6 | Permission gating matches § 3 | PASS | `supabase/migrations/20261015120000_tsk01_task.sql:70`, `:78`, `:86`, `:98`: four policies, each `to authenticated` with exactly `member_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null` and no `is_admin`, `may_decide` or team arm. `:113`–`:116`: revoke from `anon, authenticated`, then select/delete, insert `(date, title, note)`, update `(date, title, note, done)` — `member_id`, `id`, `created_at` not writable. `member_team_id` returns null for pending, rejected and removed (`supabase/migrations/20260910100000_solo_member_approval.sql:57`–`:63`) and reads `public.member`, not `public.task`. Mock `ownsTask` (`src/lib/data/mock.ts:1434`) is the same predicate with no role clause. Seam never filters on `member_id` (`src/lib/data/supabase.ts:4132`–`:4214`). Affordances only on the page: route guard `src/App.tsx:607`, `:611`; add form only when `day >= today` `src/routes/Tasks.tsx:522`–`:525`; move `min={today}` `:282` |
| R7 | No invariant violated | PASS | `invariants_touched: []`; per-ID reasoning in *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. `date-fns` used at `src/routes/Tasks.tsx:14` is already declared, `package.json:26` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `Task` (seven fields, no time) | `src/lib/domain/types.ts:1237` | Yes |
| § 4.1 `TASK_TITLE_MAX = 200`, `TASK_NOTE_MAX = 1000` | `src/lib/domain/types.ts:1248`–`:1249` | Yes |
| § 4.1 `FailureCode` + `invalid_task_title`, `invalid_task_note`, `task_date_past`, `task_not_permitted`, before `unknown` | `src/lib/domain/types.ts:291`–`:299` | Yes |
| § 4.2 `CreateTaskInput` (no `memberId`, no `done`) | `src/lib/data/index.ts:262` | Yes |
| § 4.2 `UpdateTaskInput` (title, note) | `src/lib/data/index.ts:270` | Yes |
| § 4.2 `listTasks(from, to): Promise<Task[]>` | `src/lib/data/index.ts:1557`; `src/lib/data/supabase.ts:4132`; `src/lib/data/mock.ts:4020` | Yes — `from > to` returns `[]` without a request |
| § 4.2 `listOverdueTasks(today): Promise<Task[]>` | `src/lib/data/index.ts:1562`; `src/lib/data/supabase.ts:4151`; `src/lib/data/mock.ts:4028` | Yes — `done = false`, `date < today` |
| § 4.2 `createTask(input): Promise<Result<Task>>` | `src/lib/data/index.ts:1567`; `src/lib/data/supabase.ts:4170`; `src/lib/data/mock.ts:4036` | Yes — title, note, date refusals in order, insert without `member_id` |
| § 4.2 `updateTask(taskId, input): Promise<Result<Task>>` | `src/lib/data/index.ts:1571`; `src/lib/data/supabase.ts:4185`; `src/lib/data/mock.ts:4057` | Yes — date not written |
| § 4.2 `moveTask(taskId, date): Promise<Result<Task>>` | `src/lib/data/index.ts:1575`; `src/lib/data/supabase.ts:4191`; `src/lib/data/mock.ts:4063` | Yes — `task_date_past` before the request |
| § 4.2 `setTaskDone(taskId, done): Promise<Result<Task>>` | `src/lib/data/index.ts:1579`; `src/lib/data/supabase.ts:4198`; `src/lib/data/mock.ts:4072` | Yes |
| § 4.2 `deleteTask(taskId): Promise<Result<void>>`, zero rows refused | `src/lib/data/index.ts:1583`; `src/lib/data/supabase.ts:4203`; `src/lib/data/mock.ts:4077` | Yes |
| § 4.2 the five sentences | `src/lib/data/supabase.ts:627`–`:631` and the same five in `src/lib/data/mock.ts` | Verbatim |
| § 4.3 table, two check constraints, index, RLS | `supabase/migrations/20261015120000_tsk01_task.sql:49`–`:64` | Yes |
| § 4.3 four policies, revoke and grants | `supabase/migrations/20261015120000_tsk01_task.sql:70`–`:116` | Yes — no function, trigger, notify, publication or view in the file |
| § 4.4 `TASK_COLUMNS`, `toTask` | `src/lib/data/supabase.ts:611`, `:613` | Yes |
| § 4.4 SQLSTATE mapping (`42501`, `PGRST301`, `22P02` → `task_not_permitted`; else `unknown`) | `src/lib/data/supabase.ts:656` | Yes |
| § 4.4 zero rows on update → `task_not_permitted` | `src/lib/data/supabase.ts:670` | Yes |
| § 4.5 `tasks`, `__resetTasks()`, `ownsTask` | `src/lib/data/mock.ts:1411`, `:1419`, `:1434` | Yes |
| § 4.6 routes `/tasks`, `/tasks/:day` | `src/App.tsx:607`, `:611` | Yes |
| § 4.6 page: `eventToday()` once per render; `listTasks(day, day)` plus overdue on today; invalid day → `/tasks` | `src/routes/Tasks.tsx:377`, `:390`–`:391`, `:404` | Yes |
| § 4.6 sidebar link with `aria-current` | `src/components/Sidebar.tsx:255`, `:338` | Yes — a `Link`, no button added |
| § 4.7 selectors | `src/routes/Tasks.tsx` (listed in `03-impl-log.md` § *Testability contract*); spot-checked `:315`, `:282`, `:525` | Yes |

The two choices `03-impl-log.md` records — `noValidate` on the move form (`src/routes/Tasks.tsx:270`) and the
mock's `isTaskDate` refusing a malformed date with `unknown` after the plan's refusals — change no
contract item and no refusal order.

## R7 detail

`invariants_touched` is `[]`. Each invariant reasoned individually:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap of entries | No entry is written; `task` is a separate table and no seam function in the diff touches `entry` | `supabase/migrations/20261015120000_tsk01_task.sql:49` (only table created) |
| INV-02 approval does not survive an edit | No entry write or approval path changed | `git diff origin/main...HEAD --stat` touches no entry function; seam additions are `src/lib/data/supabase.ts:4132`–`:4214` only |
| INV-03 rejection reason | No decision path changed | same |
| INV-04 one definition of the absence count | `absence.ts`, `busy.ts`, `day-status.ts` not in the diff; no task read feeds a count. AC-21 fence test passes | `tests/tasks.test.ts:541` (passes; 41/41 with `seam-parity`) |
| INV-05 tentative counts alike | Tasks carry no tentative flag and enter no count | `src/lib/domain/types.ts:1237` |
| INV-06 one portion per entry | Tasks carry no portion | `src/lib/domain/types.ts:1237` |
| INV-07 entry belongs to one member, counted per team | A task is not an entry and is counted against no team | `src/lib/data/mock.ts:1434` (owner predicate, no team arm) |

## Findings

None.

`pnpm exec vitest run tests/tasks.test.ts tests/seam-parity.test.ts` → 2 files, 41 tests passed.

## Verdict

PASS. All eight checks pass.
