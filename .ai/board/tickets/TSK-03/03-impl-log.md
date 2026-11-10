---
ticket: TSK-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-17T23:24:33+0700
inputs_read:
  - .ai/board/tickets/TSK-03/01-plan.md
  - .ai/board/tickets/TSK-03/ticket.yaml
  - .ai/standards/testing-standards.md
  - src/components/EntryForm.tsx
  - src/components/OverloadWarning.tsx
  - src/routes/Tasks.tsx
  - src/lib/domain/types.ts
  - tests/e2e/tsk-01-tasks.spec.ts
  - tests/e2e/cal-07-overload-warning.spec.ts
  - tests/e2e/cal-04-month-view.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TSK-03 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/pto-tasks.ts` | created | the three pure rules both surfaces share — open, chosen, PTO-covering — decided once | § 4.1 |
| `src/components/PtoTaskWarning.tsx` | created | the owner-only, debounced, stale-safe task read and its `role="status"` block | § 4.2, § 4.4 |
| `src/components/EntryForm.tsx` | modified | one element after the per-run overload warnings, fed `dates` (not a run) | § 4.3 (form) |
| `src/routes/Tasks.tsx` | modified | own-entries read apart from `load()`, and the `tasks-pto-flag` pill beside the day heading | § 4.3 (page), § 4.4 |
| `tests/pto-tasks.test.ts` | created | unit coverage of § 4.1 as § 5 lists it | § 5 |
| `tests/e2e/tsk-03-pto-task-warning.spec.ts` | created | the journeys § 5 lists, against the mock seam | § 5 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `openTasksOnDays` | `src/lib/pto-tasks.ts:13` | filter + sort on a new array; input untouched |
| 4.1 `ptoCovering` | `src/lib/pto-tasks.ts:29` | earliest `startDate`, then smallest `id` |
| 4.1 `ptoFlagSuffix` | `src/lib/pto-tasks.ts:44` | |
| 4.2 props | `src/components/PtoTaskWarning.tsx:24` | exactly the four props of § 4.2 |
| 4.2 owner check | `src/components/PtoTaskWarning.tsx:47-65` | `ownerId === null` → own; else `getCurrentMember()`; not own / null / throw → never reads `listTasks` |
| 4.2 read, 300 ms, latest only | `src/components/PtoTaskWarning.tsx:74-101` | request counter (AC-9); throw → nothing (AC-8) |
| 4.2 type switch does not refetch | `src/components/PtoTaskWarning.tsx:75-78`, `:104` | see Deviations, item 1 |
| 4.2 render | `src/components/PtoTaskWarning.tsx:104-151` | `role="status"`, `aria-live="polite"`; nothing reaches the submit control |
| 4.3 form element | `src/components/EntryForm.tsx:312` | no prop of `EntryFormProps` changed; no route edited |
| 4.3 page: `member` | `src/routes/Tasks.tsx:398` | |
| 4.3 page: `ownEntries` read | `src/routes/Tasks.tsx:412-428` | own `useEffect` on mount; a throw leaves `null` (AC-13) |
| 4.3 page: `pto`, `openCount` | `src/routes/Tasks.tsx:518-519` | count from `ticker.shown(t).done`, so a tick moves it at once (AC-12) |
| 4.3 page: pill | `src/routes/Tasks.tsx:537` | `On PTO{ptoFlagSuffix(…)}`; tentative = dashed border, reduced opacity |

## Deviations from the design

1. **How "type changing does not refetch" is held.** § 4.2 says the read is issued when own, PTO and
   days are chosen, and that a type switch holds the fetched tasks. The component stores the tasks
   *with the key of the days they were read for* (`{ key, tasks }`); the effect returns early while
   the type is not PTO, and returns early again when the held key equals the current days. So no read
   is issued while WFH, nothing is cleared on the switch, and switching back to PTO on the same days
   paints what is held without a read. It is the plan's behaviour; stated because the mechanism is
   one the plan did not spell out. The render also refuses tasks held for other days
   (`fetched.key !== key`), which is a second guard for AC-9.
2. **Flag wrapper.** The heading `<p data-testid="tasks-day-heading">` now sits inside a flex-wrap
   `div` beside the pill, so the pill shares the line and wraps under it at phone width (§ 2b). The
   heading's selector, attribute and text are unchanged; the `mt-0.5` moved to the wrapper.
3. **Glyphs** are `lucide-react`'s `ListChecks` (warning) and `Sun` (flag), a declared dependency.
   § 2b names "a small check-list glyph" and "a small sun glyph" without a source.

## Invariants

`invariants_touched: []`. None of `absence.ts`, `busy.ts`, `day-status.ts`, `OverloadWarning.tsx`,
`draft-entry.ts`, a calendar route or the notification code is edited (AC-14's fence). The warning
reads tasks only; the flag reads the member's own entries and counts nothing, so INV-04, INV-05 and
INV-07 are not engaged; nothing writes an entry, so INV-01, INV-02, INV-03 and INV-06 are not either.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 43 files, 838 tests; `tests/pto-tasks.test.ts` 12 of them |
| `pnpm exec playwright test tests/e2e/tsk-03-pto-task-warning.spec.ts` | 0 | 8 journeys + seam guard |
| `pnpm exec playwright test` (full) | 0 | 428 passed, 21 skipped; no existing spec needed a change |
| `git diff --name-only` + untracked ⊆ `allowed_paths` | yes | six paths, exactly § 7 |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `<p>-task-warning` | `src/components/PtoTaskWarning.tsx:111` |
| `<p>-task-warning-count` | `src/components/PtoTaskWarning.tsx:119` |
| `<p>-task-warning-task` (`data-task-id`, `data-date`) | `src/components/PtoTaskWarning.tsx:130` |
| `<p>-task-warning-date-chip` | `src/components/PtoTaskWarning.tsx:136` |
| `<p>-task-warning-title` | `src/components/PtoTaskWarning.tsx:141` |
| `tasks-pto-flag` (`data-entry-id`, `data-portion`, `data-tentative`, `data-open-count`) | `src/routes/Tasks.tsx:537` |

## Open questions

- **AC-8, AC-9, AC-13 failure paths are held by structure, not driven** — as § 5 records: the mock
  has no fault switch. R5 reads `PtoTaskWarning.tsx:47-101` and `Tasks.tsx:412-428` for them.
- **The month view is not reachable from the sidebar.** The e2e month journey reaches it through the
  brand logo (`/`, the week) and the `week-month` segment, because the sidebar's period links are
  commented out (`Sidebar.tsx:531`). Not this ticket's to change; noted so a reviewer does not look
  for a shorter path.
