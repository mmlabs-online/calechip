---
ticket: TSK-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-17T23:31:55+0700
inputs_read: [ .ai/board/tickets/TSK-03/01-plan.md, .ai/board/tickets/TSK-03/03-impl-log.md, .ai/board/tickets/TSK-03/ticket.yaml, .ai/templates/review-report.md ]
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

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (10 changed files; the six source/test paths are exactly ticket.yaml `allowed_paths`, the rest are the ticket folder and ship-owned `.ai/board/backlog.md`). `node scripts/check-carry.mjs TSK-03` → `0 uncommitted path(s) … PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` on the six files → exit 0; repo-wide `eslint .` → exit 0 |
| R4 | No datastore access outside the seam | PASS | Only `seam` from `@/lib/data` is used: `src/components/PtoTaskWarning.tsx:16`, `:56`, `:88`; `src/routes/Tasks.tsx:420`. `src/lib/pto-tasks.ts:6` imports types only |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches § 3 | PASS | Owner check before any tasks read: `src/components/PtoTaskWarning.tsx:43`, `:47-65`, `:77`, `:104`; edit route passes owner `src/routes/EditEntry.tsx:196`; `listTasks` takes no member `src/components/PtoTaskWarning.tsx:88`; flag reads own entries only `src/lib/data/mock.ts:2073`, `src/lib/data/supabase.ts:2109`, and re-filters on `member.id` `src/routes/Tasks.tsx:518`, `src/lib/pto-tasks.ts:32`. No write anywhere in the diff; no `useViewedTeam` |
| R7 | No invariant violated | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; `lucide-react` and `date-fns` already declared (`src/components/PtoTaskWarning.tsx:14-15`, `src/routes/Tasks.tsx:24`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `openTasksOnDays(tasks, dates): Task[]` — not done, date in `dates`, order date/createdAt/id, no mutation | `src/lib/pto-tasks.ts:13-21` (`filter` returns a new array before `sort`) | yes |
| § 4.1 `ptoCovering(entries, memberId, day): Entry \| null` — own, pto, pending/approved, covering, earliest start then smallest id | `src/lib/pto-tasks.ts:29-39` | yes |
| § 4.1 `ptoFlagSuffix(portion, tentative, openCount): string` | `src/lib/pto-tasks.ts:44-49` | yes |
| § 4.2 `PtoTaskWarningProps` — `ownerId`, `type`, `dates`, `testIdPrefix`; default export returning `JSX.Element \| null` | `src/components/PtoTaskWarning.tsx:24-40` | yes |
| § 4.2 owner check on mount keyed on `ownerId`; null → own; not own / null member / throw → never reads | `src/components/PtoTaskWarning.tsx:43`, `:47-65`, gate at `:77` | yes |
| § 4.2 read after 300 ms, `listTasks(first, last)`, latest request only, clear before new read, throw → nothing | `src/components/PtoTaskWarning.tsx:22`, `:80-100`; paint guard `:104` | yes |
| § 4.2 type change does not refetch; renders null while not PTO | `src/components/PtoTaskWarning.tsx:77-78`, `:104` | yes (mechanism recorded as impl-log deviation 1; behaviour as specified) |
| § 4.2 render — `openTasksOnDays`, empty → null, `role="status"`, `aria-live="polite"`, chip `EEE d MMM` | `src/components/PtoTaskWarning.tsx:106-113`, `:139` | yes |
| § 4.3 form element after overload warnings, no `EntryFormProps` change | `src/components/EntryForm.tsx:312`; `ownerId` default `:159` | yes |
| § 4.3 page — `member` from `useShellContext` | `src/routes/Tasks.tsx:398` | yes |
| § 4.3 page — `ownEntries` state, own `useEffect`, throw leaves null, apart from `load()` | `src/routes/Tasks.tsx:414-429` | yes |
| § 4.3 page — `pto`, `openCount` via `ticker.shown(t).done` | `src/routes/Tasks.tsx:518-519` | yes |
| § 4.3 page — pill `On PTO{ptoFlagSuffix(…)}` beside `tasks-day-heading` | `src/routes/Tasks.tsx:530-551` | yes |
| § 4.4 selectors `<p>-task-warning`, `-count`, `-task` (`data-task-id`, `data-date`), `-date-chip`, `-title` | `src/components/PtoTaskWarning.tsx:111`, `:119`, `:130-132`, `:136`, `:141` | yes |
| § 4.4 `tasks-pto-flag` with `data-entry-id`, `data-portion`, `data-tentative`, `data-open-count` | `src/routes/Tasks.tsx:537-541` | yes |
| § 4.4 copy | `src/components/PtoTaskWarning.tsx:119-120`, `:149`; `src/lib/pto-tasks.ts:45-47`; `src/routes/Tasks.tsx:548` | yes |
| § 5 tests | `tests/pto-tasks.test.ts` (12 pass); `tests/e2e/tsk-03-pto-task-warning.spec.ts` (9 pass, run at review) | yes |

## R7 detail

`invariants_touched: []` (ticket.yaml, plan § 2). No ID to tabulate. Checked anyway that the empty
set is true: the diff edits none of `absence.ts`, `busy.ts`, `day-status.ts`, `OverloadWarning.tsx`,
`draft-entry.ts` or any seam file (`git diff --stat origin/main...HEAD` lists only the six allowed
paths in `src/` and `tests/`); the warning gives nothing to the submit control
(`src/components/EntryForm.tsx:312` passes four read-only props), so no save is blocked (charter
refusal 6); the flag counts tasks, not entries (`src/routes/Tasks.tsx:519`), so no absence count is
altered.

| Invariant | Held by | Citation |
|---|---|---|
| — (none touched) | — | — |

## Findings

None.

## Verdict

PASS — ticket advances to DONE.
