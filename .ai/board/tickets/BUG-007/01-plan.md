---
ticket: BUG-007
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T02:10:05Z
inputs_read:
  - .ai/board/tickets/BUG-007/ticket.yaml
  - .ai/board/tickets/BUG-007/00-bug-report.md
  - .ai/registry/features.md                     # TSK-02 row, :254
  - .ai/registry/invariants.md
  - .ai/board/tickets/TSK-02/01-plan.md          # § 2 AC-2 :112-115
  - origin/feat/BUG-006:.ai/board/tickets/BUG-006/01-plan.md   # sibling: same mechanism, same fix shape, its § 8 alternative 5
  - playwright.config.ts                         # fullyParallel :11, retries :13, webServer
  - docs/ops/e2e-quarantine.md                   # tsk-02 is not registered
  - tests/e2e/tsk-02-overdue-prompt.spec.ts
  - src/App.tsx                                  # <BrowserRouter> :714, no useTransitions
  - src/routes/Tasks.tsx                         # createTask date: day :493, ready :701, heading :818, arrows :842-859, loader :867-870, form :930
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-007 — the TSK-02 spec adds a task on the next day before the next day is on screen

## 1. Problem and scope

**Feature implemented, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| TSK-02 | Each time the app opens, a member is shown their overdue tasks and can tick them or move them all to today |

TSK-02 is `DONE`. This ticket changes none of its behaviour. It makes the end-to-end spec
`tests/e2e/tsk-02-overdue-prompt.spec.ts` deterministic under a two-worker run, chiefly the test
`AC-2: nothing overdue — no prompt`, which five records (MIR-04, MIR-18, MIR-19-c, -d, -e) noted
failing and waived as pre-existing. The capability regained is the reviewer's and the operator's: a
full-suite run at two workers that is red only when something is actually broken.

**Root cause — `suspected` in the report, settled here from the source, to be confirmed by trace at
IMPLEMENT (AC-6).** It is BUG-006's mechanism, verified on this tree: `src/App.tsx:714` mounts
`<BrowserRouter>` with no `useTransitions` prop, so each history change is applied inside a React
transition. The URL changes at once; the rendered day catches up later. Until it does, the previous
day's `<AddTaskForm key={day}>` (`src/routes/Tasks.tsx:930`) is still on screen and posts
`date: day` for the **old** day (`:493`). The test clicks `tasks-next-day` at `:115` and calls
`addTask(page, "Tomorrow's")` at `:116` with no wait, so `fill` and `click` can land on the 12th's
form: the title is lost when the 13th's form mounts, or the task is created on the 12th. Either way
*Tomorrow's* never appears in the 13th's `tasks-list` and `:55` times out, as recorded. Waiting for
`tasks-day-heading` (`:818`, `data-day={day}`) to show the new day closes the window: once it does,
the old form is gone (`ready` is null until the new day's read lands, `:701`, `:867`), and `fill`
auto-waits for the new day's form. `twoOverdue` already waits this way at `:84` and `:87`, which is
why AC-1 and AC-3 to AC-10 do not race at those clicks. `OverduePrompt` module state is not involved:
the failure comes before `reopen` (`:119`).

**The same window opens at two more places in the file.** AC-5 (`:176-177`) and AC-7 (`:196-197`)
each press `tasks-prev-day` twice in a row. The second target is computed from whatever day is still
rendered (`goTo(shiftDay(day, -1))`, `Tasks.tsx:846`), so a second click that lands on the previous
screen ends on the 13th instead of the 12th, and `:178` / `:198` fail. They are less exposed than
`:115` but have the same defect.

**Decision (report open question 1): test only**, as BUG-006 decided. A person cannot type into a
form in the frame between pressing an arrow and React committing the next day; the spec can.
`useTransitions={false}` would change navigation on every route to serve one spec (§ 8 alternative 1).

**Decision (report open question 2): one helper per spec, not one shared helper.** BUG-006 put
`stepDay` inside `tests/e2e/tsk-01-tasks.spec.ts` and rejected a shared module (its § 8 alternative
5) so that neither ticket edits the other's file. This plan copies the same five-line helper into
this spec, with the same name and signature, so the two specs read alike. This file's own header
(`:13`) already says its helpers are copies of TSK-01's.

**Decision (report open question 3): re-baseline with a repeat run.** One record called the failure
deterministic and the others did not. AC-4 measures it on the baseline before the change and after.

**Out of scope:**

- **Any change to `src/`.** Neither `useTransitions={false}` (§ 8 alternative 1) nor disabling the
  add form while the old day is shown (§ 8 alternative 2). BUG-006 § 1 also recorded the latent
  staleness gap in `load` as a candidate `/bug`. It is not repeated or fixed here.
- **`tests/e2e/tsk-01-tasks.spec.ts`**, which is BUG-006's, and any shared module under
  `tests/e2e/support/`.
- **Other specs with day or period arrows** (`tsk-03` … `tsk-06`, the calendar views). None is
  reported here. Any that flakes gets its own record.
- **The other flaky tests named in the operator's request** (`tsk-01:279`, `uie-10:208`,
  `uie-09:247`, `evt-07`, `mir-19-d-flip` AC-5). Each is its own record.
- **`playwright.config.ts`.** `workers`, `fullyParallel` and `retries` are the load the spec must
  survive, not the defect.
- **Any assertion, title or fixture in the spec.** Every existing `expect` stays, including the
  heading assertions the helper makes redundant (`:84`, `:87`, `:121`, `:178`, `:198`).
- **`docs/ops/e2e-quarantine.md`.** The spec is not registered there, so there is no row to delete.

**`size_estimate: S`** — one file: a five-line helper and seven one-line call-site replacements.

## 2. Acceptance criteria

Vocabulary: *the spec* is `tests/e2e/tsk-02-overdue-prompt.spec.ts`. *The AC-2 test* is the test in
it titled exactly `AC-2: nothing overdue — no prompt`. *An arrow click* is a click on
`tasks-next-day` or `tasks-prev-day`. *The load companion* is `tests/e2e/uie-10-sidebar.spec.ts`. It
runs alongside only to put a second worker under load. *The baseline* is the spec as it is on
`origin/main`.

**AC-1 — every arrow click waits for the day it leads to**
- Given the spec after this ticket
- When any test presses a day arrow
- Then it does so only through `stepDay` (§ 4.1), which clicks the arrow and then waits, with an
  auto-retrying `expect`, until `tasks-day-heading` has `data-day` equal to the day the arrow leads to
- And no other statement in the spec clicks `tasks-next-day` or `tasks-prev-day`: a search of the
  spec for `getByTestId("tasks-next-day")` and `getByTestId("tasks-prev-day")` finds no match outside
  `stepDay`'s body. `stepDay`'s parameter type may contain the two test IDs as string literals.

**AC-2 — the AC-2 test adds "Tomorrow's" on the 13th**
- Given the AC-2 test
- When it has pressed `tasks-next-day` from the 12th
- Then the heading shows `2030-03-13` before `addTask(page, "Tomorrow's")` runs

**AC-3 — no assertion of TSK-02 is weakened**
- Given the spec after this ticket
- Then every test's title is unchanged character for character, and the number of tests is unchanged
- And every `expect` on `origin/main` is still present with the same matcher and the same expected
  value, in the same order
- And the only changes are the `stepDay` function and its comment (§ 4.1) and the seven
  replacements in § 4.2
- And no `waitForTimeout` is added and no timeout or retry is raised anywhere

**AC-4 — regression criterion (ADR-101): the AC-2 test fails on `origin/main` and passes after the
change**
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts tests/e2e/uie-10-sidebar.spec.ts --repeat-each=30 --workers=2 --retries=0`
  runs against **the baseline** spec
- Then the AC-2 test fails at least once, and `03-impl-log.md` § *Regression test* records the
  command, the exit code, the pass and fail counts, and the failing assertion
- And when the same command runs against the spec after this ticket, every test in the spec passes,
  30 of 30 each, with exit code 0, recorded beside it
- And if the baseline run does not fail, repeat it once with the temporary throttle in § 4.3. If it
  still does not fail, the impl-log says the failure was not reproduced on this machine and cites
  the records in `00-bug-report.md` § *Actual*. The change still ships.
- **How R10 reads this on a test-only fix:** the diff has no non-test path, so "restore the non-test
  paths from `origin/main`" restores nothing. The reviewer's *before* run is the AC-4 command with
  the spec itself taken from `origin/main`
  (`git show origin/main:tests/e2e/tsk-02-overdue-prompt.spec.ts`). The *after* run is the same
  command on the branch.

**AC-5 — the full suite, once, at two workers**
- Given the same build
- When `pnpm exec playwright test --workers=2 --retries=0` runs once
- Then every test in the spec passes, and `03-impl-log.md` records the suite's totals
- And failures elsewhere in the suite are recorded by spec and title, not fixed

**AC-6 — the suspected cause is confirmed or left open, in writing**
- Given a failing baseline run from AC-4, repeated with `--trace=retain-on-failure`
- When the trace of the AC-2 test's failure is read at the step from `:116`
- Then `03-impl-log.md` states which day's add form received the `fill`, or on which date the task
  was created, and whether that matches § 1
- And if no baseline run failed, it says the cause remains `suspected`

**AC-7 — refusals of the change itself**
- Given this ticket's diff
- Then it touches no file but the spec: no `src/` file, no `playwright.config.ts`, no other spec, no
  support module
- And it adds no `data-testid` and no import

**Invariants touched: `[]`.** Only the order of steps in one spec changes. Nothing that changes
reads or writes an entry, member, team, task or count. INV-01 to INV-07 constrain entries,
membership and the absence count, and no task is in any absence count (TSK-04 row).

**Open questions.** None that block. The report's three are decided in § 1.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(Nothing is laid out: no screen, element or class changes. The line is written because the gate
requires exactly one.)

## 3. Permission model

None changes. The spec signs in as `thanh@example.com` exactly as on `origin/main`. ADR-057's
owner-only task rule and the TSK rows of `.ai/standards/rbac-and-security.md` are untouched, and
nothing on either side of the boundary is edited. The helper only clicks an existing control and
reads an existing attribute.

## 4. Contract

### 4.1 `stepDay` — new, in the spec

Insert directly after line 62 (`const heading = (page: Page) => page.getByTestId("tasks-day-heading");`),
preceded by one blank line, exactly:

```ts
/** BUG-007, as BUG-006 in tsk-01-tasks.spec.ts. Presses a day arrow and returns only once the page
 *  shows `day`. The router commits each navigation inside a React transition, so until it does the
 *  previous day — its arrows and its add form — is still on screen and still takes clicks and typing. */
async function stepDay(page: Page, arrow: "tasks-prev-day" | "tasks-next-day", day: string): Promise<void> {
  await page.getByTestId(arrow).click();
  await expect(heading(page)).toHaveAttribute("data-day", day);
}
```

Names introduced, and no others: `stepDay`, its parameters `page`, `arrow`, `day`. `expect` and
`Page` are already imported at `:1`. `heading` is the existing `const` at `:62`, so `stepDay` must
come after it. `tasks-day-heading`, `tasks-prev-day` and `tasks-next-day` are existing test IDs
(`src/routes/Tasks.tsx:818`, `:843`, `:852`).

### 4.2 The seven call sites — each line replaced whole, indentation kept

Line numbers are `origin/main`'s (before § 4.1's insertion shifts them).

| Line | Where | `origin/main` | Replaced by |
|---|---|---|---|
| 83 | `twoOverdue` | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", DAY_2);` |
| 86 | `twoOverdue` | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", DAY_3);` |
| 115 | AC-2 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", DAY_2);` |
| 176 | AC-5 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", DAY_2);` |
| 177 | AC-5 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", DAY_1);` |
| 196 | AC-7 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", DAY_2);` |
| 197 | AC-7 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", DAY_1);` |

Why each expected day holds. `signIn` pins the clock to `DAY_1` (`:33`), and `openTasks` lands on
`/tasks`, which is today, so `:83` and `:115` start on the 12th. `:86` starts on the 13th, after
`:83` and its assertion at `:84`. In AC-5 and AC-7, `twoOverdue` has moved the clock to `DAY_3`
(`:90`) and `openTasks` (`:174`, `:192`) lands on the 14th, so `:176` and `:196` lead to the 13th,
and `:177` and `:197` lead to the 12th. If any expected day is wrong, the test fails at the helper,
which is the point.

Every other line of the spec is unchanged, including the now-redundant heading assertions at `:84`,
`:87`, `:178` and `:198` (AC-3).

### 4.3 The throttle for AC-4 — temporary, never committed

Only if the baseline AC-4 run does not fail: as the first two lines inside the AC-2 test's body of
the **baseline** spec, for that one repeat:

```ts
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
```

Remove it before commit. `git diff origin/main -- tests/e2e/tsk-02-overdue-prompt.spec.ts` must show
only § 4.1 and § 4.2.

## 5. Seam impact

None. No function in `src/lib/data/` changes, and the spec calls nothing on the seam it did not call
before.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/tsk-02-overdue-prompt.spec.ts"
```

The regression test (§ 2 AC-4) is in this file: it is the AC-2 test itself, made deterministic.
`glossary_owed` is `[]`, so no glossary row is written. `size: S` from one path, which agrees with
`size_estimate: S`. ADR-012 is not engaged.

## 8. Rejected alternatives

1. **`<BrowserRouter useTransitions={false}>` in `src/App.tsx`.** Removes the window at its source
   for every spec at once. Rejected for BUG-006's reasons: it changes how every route commits a
   navigation, to serve a test. No person is affected by the window. And it would put `src/App.tsx`
   under a review judged against features it was never planned against.
2. **Disable the add form until the new day's read lands** (the report's second app-side option).
   Rejected: the form is already absent until `ready` matches the new day (`Tasks.tsx:701`, `:867`).
   The race is in the frames *before* the router commits the new day, when the old day's form is
   still enabled and correct for the day it shows. No change to the form closes that window without
   reaching into the router.
3. **Fix only `:115`, the reported line.** Smallest diff. Rejected: `:176-177` and `:196-197` race
   in the same way and can end on the wrong day. Leaving them means the next flake in this file is
   already written. Routing `:83` and `:86` through the helper too keeps AC-1 checkable by search.
4. **Wait on `toHaveURL` after each click.** Rejected: the history entry changes before the
   transition commits, so the URL is right while the previous day is still on screen.
5. **Share `stepDay` with BUG-006 through `tests/e2e/support/`.** One helper for two specs, the
   report's second open question. Rejected: BUG-006 already shipped its copy inside its own spec on
   `feat/BUG-006` and rejected the shared module (its § 8 alternative 5). A shared module now would
   make this ticket edit BUG-006's spec. The helper is five lines, and the two copies are identical.
6. **Run the spec serially, or lower `workers`.** Rejected: it hides the ordering defect instead of
   removing it, and `playwright.config.ts` is shared by every test.

## Changelog

- `2026-11-17T02:10:05Z` — all sections written. Report open questions 1 to 3 decided in § 1 (test only; one helper per spec, copied from BUG-006; re-baseline by repeat run). Raised by `tech-lead-design`. Amended by `tech-lead-design`.
