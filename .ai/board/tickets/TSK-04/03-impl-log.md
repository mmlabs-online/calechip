---
ticket: TSK-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-17T16:47:00Z
inputs_read:
  - .ai/board/tickets/TSK-04/01-plan.md
  - .ai/board/tickets/TSK-04/ticket.yaml
  - .ai/standards/testing-standards.md
  - src/routes/WeekView.tsx
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/lib/pto-tasks.ts
  - src/components/PtoTaskWarning.tsx
  - src/components/TopBar.tsx
  - src/components/BrandLogo.tsx
  - tests/pto-tasks.test.ts
  - tests/e2e/tsk-01-tasks.spec.ts
  - tests/e2e/tsk-03-pto-task-warning.spec.ts
  - tests/e2e/cal-12-team-picker.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TSK-04 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/week-tasks.ts` | created | The pure tally helper and the badge's two strings, so the rule is unit-testable apart from the screen | § 4.1 |
| `src/routes/WeekView.tsx` | modified | The task read (own team only, post-grid, separately caught), the `tasks`/`tasksFailed` state, the badge on the date line, and the unavailable notice | § 4.2, § 4.3 |
| `tests/week-tasks.test.ts` | created | AC-1..AC-4 and AC-12's empty-map half against the pure helper; both strings incl. the singular | § 4.1, § 5 |
| `tests/e2e/tsk-04-week-task-badge.spec.ts` | created | What a person sees for AC-1..AC-11, AC-12's success half, AC-13's signed-out half | § 2, § 4.3 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `DayTaskTally` | `src/lib/week-tasks.ts:9` | |
| 4.1 `taskTalliesFor` | `src/lib/week-tasks.ts:17` | Range inclusive both ends; string comparison of `yyyy-MM-dd`; builds a fresh map, input untouched |
| 4.1 `tallyText` | `src/lib/week-tasks.ts:32` | |
| 4.1 `tallyLabel` | `src/lib/week-tasks.ts:37` | `task` when `total === 1` |
| 4.2 `ready` gains `tasks`, `tasksFailed` | `src/routes/WeekView.tsx:258-261`, initialised at `:386-387` | |
| 4.2 read only when `viewed.kind === "own"` | `src/routes/WeekView.tsx:416` | |
| 4.2 `seam.listTasks(range.start, range.end)` | `src/routes/WeekView.tsx:418` | |
| 4.2 parallel with the event layer, caught separately, `stale()` guarded | `src/routes/WeekView.tsx:394-427` | See Deviations — the event block was wrapped, not changed |
| 4.2 `tallies` memo | `src/routes/WeekView.tsx:593` | Typed `ReadonlyMap<string, DayTaskTally>` so `new Map()` and the helper's result unify |
| 4.2 badge in the date-line span, after the date | `src/routes/WeekView.tsx:887-899` | `ListChecks` 12px, `text-[11px] tabular-nums`, `opacity-60` like the date; no colour token |
| 4.2 `week-tasks-unavailable` beside `week-events-unavailable` | `src/routes/WeekView.tsx:743-747` | Guarded on `view.phase === "ready"`, so AC-13's phases cannot render it |

## Deviations from the design

none in behaviour. One structural note the reviewer would otherwise find by diffing: to run the task
read "in parallel with" the event layer as § 4.2 says, the existing EVT-03 `try`/`catch` was moved
verbatim into a local `eventLayer` function, and a sibling `taskLayer` was added; both are awaited
with one `Promise.all`. Each catches its own error, so neither rejection reaches the other or the
outer `unavailable` branch. The event layer's reads, guards and state writes are unchanged.

## Invariants

`invariants_touched: []`. INV-04 considered (§ 2): `week-tasks.ts` imports nothing from
`@/lib/data/absence`, `counts` is still `absenceCountsFor(view.entries, …)` alone, and the badge
reads only `tallies`. AC-11's e2e asserts `data-count` and `week-day-count` are unchanged.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 44 files, 846 tests |
| `pnpm exec playwright test tests/e2e/tsk-04-week-task-badge.spec.ts` | 0 | 12 passed |
| `pnpm exec playwright test` on the 8 other specs that read `week-day` | 0 | 69 passed — cal-05, cal-08, cal-12, evt-03, solo-busy-day, solo-profile, solo-today-marker, uie-07 |
| `git diff --name-only` + untracked ⊆ `allowed_paths` | yes | The four paths above, plus this log |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `week-day-tasks` (`data-done`, `data-total`, `aria-label`) | `src/routes/WeekView.tsx:889-892` |
| `week-tasks-unavailable` | `src/routes/WeekView.tsx:744` |

## Open questions

- The task read sets no DOM signal when it lands, so the e2e spec's negative assertions (AC-5's
  no-task member, AC-6, AC-7, AC-8, AC-13) wait a fixed 800 ms after the grid settles, the pattern
  TSK-03 uses for its debounce. A `data-tasks-loaded` attribute would remove the wait, but it is not
  in § 4.3 and adding it would be a field the contract did not name (RULE-04).
- The spec reaches the week by clicking `shell-brand-logo` (`/`), because `shell-calendar-link`
  renders on the events screens only and the sidebar's period links are commented out.
