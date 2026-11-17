---
ticket: BUG-013
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T12:40:10Z
inputs_read:
  - .ai/board/tickets/BUG-013/ticket.yaml
  - .ai/board/tickets/BUG-013/00-bug-report.md
  - .ai/registry/features.md                  # TSK-01 row, :253
  - .ai/registry/invariants.md                # INV-01..INV-07, none about tasks
  - .ai/board/tickets/TSK-01/01-plan.md       # § 2 AC-2, :123-128
  - .ai/board/tickets/BUG-006/01-plan.md      # out of scope :74-80, the stepDay helper
  - .ai/standards/testing-standards.md        # levels table; no component renderer installed
  - docs/ops/e2e-quarantine.md                # tsk-01 spec is not registered
  - playwright.config.ts                      # vite build + preview (no StrictMode double effects), mock seam pinned :49-51
  - package.json                              # no DOM renderer among devDependencies
  - src/main.tsx                              # window.__calechipMockSeam, :10-15
  - src/lib/data/index.ts                     # seam is the mock object itself, :1740
  - src/lib/data/mock.ts                      # listTasks, :4414-4420
  - src/routes/Tasks.tsx                      # load :636-657, effect :659-661, ready :701, loader :867-870, tasks-empty :923
  - src/routes/WeekView.tsx                   # loadSeq pattern, :325-334
  - src/routes/MonthView.tsx                  # loadSeq pattern, :235-247
  - src/routes/YearView.tsx                   # loadSeq pattern, :151-160
  - src/components/Loader.tsx                 # data-testid="loader"
  - tests/e2e/tsk-01-tasks.spec.ts            # helpers signIn, openTasks, stepDay, heading :34-73
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-013 — a slow read of a day already left can hold the task page on its loader

## 1. Problem and scope

**Feature implemented, from `.ai/registry/features.md:253`, verbatim:**

| ID | Title | Group | Status |
|----|-------|-------|--------|
| TSK-01 | A member keeps a private list of tasks for each day, and only they can read or change it | TSK | DONE |

A member moving day by day on the task page expects each day to load. Today, if they move on before
the previous day's read has come back, and that older read lands after the read for the day they
moved to, the page stays on its loader for the day they are looking at. It shows no error and no
tasks until something else reloads the page. Every press of a day or week arrow starts its own read,
and nothing stops an older one from writing over a newer one. That breaks TSK-01 AC-2 (day
navigation) on a slow network. This ticket makes the latest load the only one that can write the
page's state, so the member always sees the day they are on. The week, month and year screens already
work this way.

**Root cause, settled at PLAN (the report marked it `suspected`).** Confirmed by reading the code:
`load` (`src/routes/Tasks.tsx:636-657`) calls `setState({ phase: "ready", day, … })` with the `day`
its closure captured, whenever its read resolves. The render accepts the state only when
`state.day === day` (`:701`). When an older load resolves after a newer one, it writes its own day,
`ready` becomes `null` for the day on screen, and the loader (`:867-870`) stays. The effect at
`:659-661` does not run again because `load`, `valid` and `tasksRevision` have not changed. The same
gap applies to the `catch` branch: a stale failure can replace a newer `ready`. The regression test
in § 2 reproduces the defect deterministically before the fix (see AC-R1).

**Report open questions, decided:**

1. *Drop a stale result, or cancel the earlier read?* **Drop.** The seam's `listTasks` takes no
   cancellation signal, and adding one changes the seam's contract on both implementations (§ 8
   alternative 1). Dropping keeps `load`'s signature and the seam unchanged, and is the pattern
   already in `WeekView.tsx:325-334`, `MonthView.tsx:235-247` and `YearView.tsx:151-160` (`loadSeq`).
2. *Does the same pattern exist in the week, month and year screens?* **No.** All three already
   number their loads and drop superseded results (the `loadSeq` lines above). Nothing to record.

**Out of scope:**

- **The seam** (`src/lib/data/**`). No cancellation, no new parameter, no change to `listTasks` or
  `listOverdueTasks`.
- **The entries read on the task page** (`Tasks.tsx`, the `listOwnEntries` effect). It already
  guards itself with `live`, and it is read once per mount, not per day.
- **The tick ticker** (`createTaskTicker`, TSK-05). Its `mark`/`reconcile` contract with a load is
  unchanged; a dropped load reconciles nothing and writes nothing.
- **`TaskDayDialog.tsx` and `PtoTaskWarning.tsx`**, the other `listTasks` callers. Neither is
  reported here. Each gets its own record if it shows the same defect.
- **Any other assertion, helper or test in `tests/e2e/tsk-01-tasks.spec.ts`.** One test is added.
  `stepDay`, `heading`, `signIn` and `openTasks` are reused unchanged.
- **The report's proposed unit or component level for the regression test.** There is no DOM
  renderer among the devDependencies (`package.json`), so a component test would add a dependency
  and need an ADR (check R8). The end-to-end level holds the stale read on a promise the test
  releases, so the resolve order is exact, not just likely (§ 2, § 8 alternative 2).

`size_estimate: S`. One source file and one spec file. The change is a guard in one function.

## 2. Acceptance criteria

**AC-1 — the latest load is the only one that writes the page**
- Given the member is on the task page for day D, and a load of the page's tasks is still out
- When another load starts before the first resolves (day navigation, a reload after a change, or
  `tasksRevision` rising), and the first one then resolves or fails after it
- Then the first load's result and its failure are both discarded. The page's list, its overdue
  section, its tallies and its failure message come from the latest load only.

**AC-2 — TSK-01 AC-2 holds when reads resolve out of order** (`.ai/board/tickets/TSK-01/01-plan.md:123-128`, unchanged)
- Given the member is on the task page for day D, and the read for a day they have already left is
  still out
- When that older read resolves after the read for D
- Then the page shows day D (`tasks-day-heading` `data-day` = D) and lists D's tasks, or D's empty
  state (`tasks-empty`), and no loader (`data-testid="loader"`) is left inside `tasks-page`.

**AC-R1 — regression criterion (ADR-101, review check R10)**
- Test file: `tests/e2e/tsk-01-tasks.spec.ts`
- Test: `"AC-2 (BUG-013): a slow read of a day already left does not hold the day on screen on its loader"`
- Level: end to end. The defect is visible on screen, and the held promise (§ 4.2) fixes the resolve
  order exactly.
- **Fails on `origin/main`** (the page stays on its loader for TOMORROW, so `tasks-empty` never shows
  and the loader count is 1). **Passes after the change.** Review runs it both ways: with
  `src/routes/Tasks.tsx` restored from `origin/main` it must fail, and on the branch it must pass.

**Refusals.** None new. The page is the member's own, as in TSK-01 (ADR-057). This ticket changes
no read, write or permission.

**Invariants touched.** `[]`. INV-01 to INV-07 are about entries and absence counts. A task is in
no absence count (ADR-057), and this change alters only which of two reads the page keeps.

**Open questions.** None. Both of the report's questions are decided in § 1.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(Nothing on screen changes. The page shows the same loader, list and empty state it already shows,
only for the right day.)

## 3. Permission model

Unchanged. `/tasks` and `/tasks/:day` are the signed-in member's own page. The reads are
`listTasks` and `listOverdueTasks`, enforced owner-only by the server (RLS, ADR-057) and by the mock's
`ownsTask`. This ticket adds no control, no action and no read. Denials are as TSK-01 § 3: no admin,
manager or other member reads another member's tasks. Nothing in this ticket can reach that check.

## 4. Contract

### 4.1 `src/routes/Tasks.tsx` — inside `Tasks()`

`load` keeps its type, `() => Promise<void>`, and its dependency list. One ref is added beside
`tickerRef`. `useRef` is already imported. Field and helper names are fixed here:

```tsx
// BUG-013. Numbers each load; only the latest may write `state`. A slower, older read — of a day the
// member has already left, or of the same day before a reload — is dropped, as WeekView, MonthView
// and YearView already do (`loadSeq`).
const loadSeq = useRef(0);

const load = useCallback(async (): Promise<void> => {
  const seq = ++loadSeq.current;
  const stale = (): boolean => seq !== loadSeq.current;
  // TSK-05 AC-6. A tick that ends while this load is out wins over what the load read.
  const mark = ticker.mark();
  try {
    const [week, overdue] = await Promise.all([
      seam.listTasks(weekStart, weekEnd),
      isToday ? seam.listOverdueTasks(today) : Promise.resolve([]),
    ]);
    if (stale()) return;
    // … unchanged: reconcile, then setState({ phase: "ready", day, week, tasks, overdue })
  } catch {
    if (stale()) return;
    setState({ phase: "failed" });
  }
}, [day, weekStart, weekEnd, isToday, today, ticker]);
```

Nothing else in the file changes. `ready` (`:701`), the effect (`:659-661`), `confirmDelete` and
`onChanged={load}` stay as they are. A caller that awaits a superseded `load` still resolves, to
`undefined`, as before.

### 4.2 `tests/e2e/tsk-01-tasks.spec.ts` — one test, inside `test.describe("TSK-01 — my tasks")`

The test reaches the mock seam through `window.__calechipMockSeam` (`src/main.tsx:10-15`). That is
the same object `Tasks.tsx` calls through `seam` (`src/lib/data/index.ts:1740`), so replacing its
`listTasks` property affects the page's next read. The two window fields the test adds are typed in
the spec, not in `src/`:

```ts
/** BUG-013. Two handles the test puts on the page's window to hold one `listTasks` read. */
type HeldRead = Window & {
  __bug013Held?: boolean;
  __bug013Release?: () => Promise<void>;
};
```

Steps, with the spec's existing constants (`TODAY` 2030-03-12, `TOMORROW` 2030-03-13, `DAY_AFTER`
2030-03-14, all in the week of Monday 2030-03-11, so no read is for today and no overdue read runs):

1. `signIn(page, MEMBER)`, `openTasks(page)`, then `stepDay(page, "tasks-next-day", TOMORROW)` and
   wait until `tasks-empty` is visible. From here on every address is `/tasks/:day`, so the page does
   not remount.
2. `page.evaluate`: replace `__calechipMockSeam.listTasks` with a wrapper that **holds the next call
   only**. On that call it restores the original property, sets `__bug013Held = true`, and returns a
   promise that calls the original with the same arguments only after `__bug013Release()` runs.
   `__bug013Release` releases the gate, awaits the held read, then waits one `setTimeout(0)` and one
   `requestAnimationFrame`, so React has committed whatever the read wrote before it returns.
3. `stepDay(page, "tasks-next-day", DAY_AFTER)`, then
   `page.waitForFunction(() => (window as HeldRead).__bug013Held === true)`. DAY_AFTER's read is now
   held.
4. `stepDay(page, "tasks-prev-day", TOMORROW)`, then expect `tasks-empty` to be visible. TOMORROW's
   read went through unheld and the page is ready.
5. `page.evaluate(() => (window as HeldRead).__bug013Release!())`. The stale DAY_AFTER read lands
   now, after TOMORROW's.
6. Expect `heading(page)` to have `data-day` = TOMORROW. Expect
   `page.getByTestId("tasks-page").getByTestId("loader")` to have count 0. Expect `tasks-empty` to
   have the text `"Nothing planned yet. Add the first task below."`.

On `origin/main`, step 5 writes `{ day: DAY_AFTER }`, `ready` is `null` for TOMORROW, and step 6's
loader assertion fails. With § 4.1 the read is dropped and step 6 passes.

## 5. Seam impact

None. No function in `src/lib/data/` changes, and seam parity is untouched.

## 6. Schema delta

`none`. No table, column, policy, trigger, constraint or grant.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/routes/Tasks.tsx"
  - "tests/e2e/tsk-01-tasks.spec.ts"
```

`size: S` (two paths), the same as `size_estimate: S`. `glossary_owed` is `[]`, so there are no rows
to write.

## 8. Rejected alternatives

1. **Cancel the earlier read with an `AbortSignal` passed to `listTasks`.** This would stop the work
   as well as the write. Rejected: it changes the seam's signature on both implementations and the
   parity test, so it becomes a seam change for a client-only defect. The supabase client would also
   need wiring this ticket has no reason to own. Dropping the result fixes the same symptom, and it
   matches the three sibling screens.
2. **A component test with a DOM renderer, as the report proposed.** It would give the most exact
   control over resolve order. Rejected: no renderer is installed, and adding one is a dependency
   that needs an ADR (check R8). The end-to-end test in § 4.2 holds the read on a promise the test
   releases, so its order is just as exact, at the level where the defect is seen.
3. **Guard by day instead of by sequence** (drop a result when its `day` is not the day now in the
   address, read through a ref). Rejected: it misses an older load of the *same* day. For example,
   a reload after a delete (`confirmDelete`) racing a `tasksRevision` reload could still let the older
   list overwrite the newer one. The sequence number covers both cases with one comparison.
4. **A `live` flag cleared in the effect's cleanup** (the `listOwnEntries` effect's pattern). Rejected:
   `load` is also called from `confirmDelete` and from each row's `onChanged`, outside the effect.
   A flag owned by the effect would leave those calls unguarded.

## Changelog

- `2026-11-17T12:40:10Z` — section 1: root cause moved from `suspected` to confirmed by reading;
  both report open questions decided; regression level moved from the report's proposed unit or
  component level to end to end, because no DOM renderer is installed (§ 8 alternative 2). Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
