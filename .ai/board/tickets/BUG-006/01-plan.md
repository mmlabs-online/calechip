---
ticket: BUG-006
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T00:59:16Z
inputs_read:
  - .ai/board/tickets/BUG-006/ticket.yaml
  - .ai/board/tickets/BUG-006/00-bug-report.md
  - .ai/registry/features.md                     # TSK-01 row, :253
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-101-a-defect-is-recorded-by-bug-and-fixed-by-the-loop-with-a-regression-test.md  # decision 7
  - .ai/board/tickets/TSK-01/01-plan.md          # § 2 AC-13, AC-14, AC-15; § 4.7 test IDs
  - .ai/board/tickets/BUG-005/01-plan.md         # sibling shape: a test acting before its screen caught up
  - .ai/01-operating-model.md                    # R10, :144
  - docs/ops/e2e-quarantine.md                   # tsk-01 is not registered
  - playwright.config.ts                         # fullyParallel :11, retries :13, webServer :38-39
  - tests/e2e/tsk-01-tasks.spec.ts
  - src/App.tsx                                  # <BrowserRouter> :714, no useTransitions
  - src/routes/Tasks.tsx                         # AddTaskForm :478-535, load :636-657, goTo :666-668, ready :701, heading :818, arrows :842-859, loader :867-870, form :930
  - node_modules/.pnpm/react-router@7.18.3_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/react-router/dist/development/chunk-BV7QT456.mjs  # BrowserRouter :10489-10524
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-006 — the TSK-01 spec acts on the next day before the next day is on screen

## 1. Problem and scope

**Feature implemented, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| TSK-01 | A member keeps a private list of tasks for each day, and only they can read or change it |

TSK-01 is `DONE`. This ticket changes none of its behaviour. It makes the end-to-end spec
`tests/e2e/tsk-01-tasks.spec.ts` deterministic under a two-worker run, chiefly the test
`AC-13 to AC-15: overdue shows on today, oldest first, and empties as tasks are handled`, which four
reviews (MIR-19-b, -c, -e, -f) recorded failing on `origin/main` and waived by hand. The capability
regained is the reviewer's and the operator's: a full-suite run at two workers that is red only when
something is actually broken, so a red result is read rather than waived.

**Root cause — `suspected` in the report, settled here from the source, to be confirmed by trace at
IMPLEMENT (AC-6).** `src/App.tsx:714` mounts `<BrowserRouter>` with no `useTransitions` prop, and
react-router 7.18.3's `BrowserRouter` then applies every history change inside
`React.startTransition` (`chunk-BV7QT456.mjs:10504-10510`). The URL changes at once; the rendered
route catches up when React gets to the transition, which under CPU load can be after Playwright's
next discrete input. Until then the previous day is still on screen and live: its arrows, and its
`<AddTaskForm key={day}>` (`src/routes/Tasks.tsx:930`), which posts `date: day` for the **old** day
(`:493`). The spec clicks `tasks-next-day` at `:283` and calls `addTask` at `:284` with no wait in
between, so `fill` and `click` can land on the 12th's form: the title is lost when the 13th's form
mounts, or the task is created on the 12th; either way *From the 13th* never appears in the 13th's
`tasks-list` and `:59` times out — exactly what was recorded. A wait on the day heading closes the
window: `tasks-day-heading` carries `data-day={day}` (`:818`) and renders outside the list, and the
moment it shows the new day, the old form is gone (`ready` is null until the new day's read lands,
`:701`, `:867`), so `fill` auto-waits for the new day's form.

**The same window opens at every other day-arrow click in the file.** Three of them are live
defects of the same shape, not hypothetical: two clicks in a row (`:138-139`, `:255-256`) and a
next-then-previous (`:212-213`) each compute the second target from whatever day is still rendered
(`goTo(shiftDay(day, ±1))`, `:846`, `:855`), so a second click landing on the previous screen ends
on the wrong day. The rest (`:85`, `:106`, `:132`, `:187`, `:194`, `:301`) are followed by an
auto-retrying assertion and are safe today, but are the same unwaited step one edit away from the
next flake. **Decision (report open question 2): every day-arrow click in the spec goes through one
helper that waits for the heading** — uniform, and checkable by searching the file.

**Decision (report open question 1): test only.** A person cannot type into a form within the
frame between pressing an arrow and React committing the next day; the spec can. `useTransitions={false}`
app-wide changes navigation on every route to serve one spec (§ 8 alternative 1).

**Out of scope:**

- **Any change to `src/`.** Neither `useTransitions={false}` on `<BrowserRouter>` (§ 8 alternative 1)
  nor a staleness guard in `load` (`src/routes/Tasks.tsx:636-657`). The missing guard is a latent
  app defect in its own right — a slow read of a day the member has already left can overwrite the
  newer day's state and leave the loader on screen (`ready` stays null, `:701`) — but nothing in this
  spec reaches it, because every `addTask` waits for its own read. It is a candidate for its own
  `/bug`, recorded here and not fixed.
- **`tests/e2e/tsk-02-overdue-prompt.spec.ts`** — BUG-007 owns it (the report's open question 3).
  The helper here is not shared into a support module, so neither ticket edits the other's file.
- **Other TSK specs** (`tsk-03` … `tsk-06`) and any other spec with day or period arrows. None is
  reported here; each flakes into its own record if it does.
- **`playwright.config.ts`.** `workers`, `fullyParallel` and `retries` are the load the spec must
  survive, not the defect.
- **Any assertion, title or fixture in the spec.** Every existing `expect` stays, including the
  heading assertions the helper now makes redundant (`:134`, `:140`, `:257`, `:292`).
- **`docs/ops/e2e-quarantine.md`.** The spec is not registered there, so there is no row to delete.

**`size_estimate: S`** — one file: a five-line helper and thirteen one-line call-site replacements.

## 2. Acceptance criteria

Vocabulary: *the spec* is `tests/e2e/tsk-01-tasks.spec.ts`. *The overdue test* is the test in it
titled exactly `AC-13 to AC-15: overdue shows on today, oldest first, and empties as tasks are handled`.
*An arrow click* is a click on `tasks-next-day` or `tasks-prev-day`. *The load companion* is
`tests/e2e/uie-10-sidebar.spec.ts`, run alongside only to put a second worker under load.
*The baseline* is the spec as it is on `origin/main`.

**AC-1 — every arrow click waits for the day it leads to**
- Given the spec after this ticket
- When any test presses a day arrow
- Then it does so only through `stepDay` (§ 4.1), which clicks the arrow and then waits, with an
  auto-retrying `expect`, until `tasks-day-heading` has `data-day` equal to the day the arrow leads to
- And no other statement in the spec clicks `tasks-next-day` or `tasks-prev-day`: a search of the
  spec for `getByTestId("tasks-next-day")` and `getByTestId("tasks-prev-day")` finds them only inside
  `stepDay`'s parameter type and body

**AC-2 — the overdue test adds its 13th tasks on the 13th**
- Given the overdue test
- When it has pressed `tasks-next-day` from the 12th
- Then the heading shows `2030-03-13` before `addTask(page, "From the 13th")` runs

**AC-3 — no assertion of TSK-01 is weakened**
- Given the spec after this ticket
- Then every test's title is unchanged character for character, and the number of tests is unchanged
- And every `expect` on `origin/main` is still present with the same matcher and the same expected
  value, in the same order
- And the only changes are the `stepDay` function and its comment (§ 4.1) and the thirteen
  replacements in § 4.2
- And no `waitForTimeout` is added and no timeout or retry is raised anywhere

**AC-4 — regression criterion (ADR-101 decision 7): the overdue test fails on `origin/main` and
passes after the change**
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts tests/e2e/uie-10-sidebar.spec.ts --repeat-each=20 --workers=2 --retries=0`
  runs against **the baseline** spec
- Then the overdue test fails at least once, and `03-impl-log.md` § *Regression test* records the
  command, the exit code, the pass and fail counts, and the failing assertion
- And when the same command runs against the spec after this ticket, every test in the spec passes,
  20 of 20 each, with exit code 0, recorded beside it
- And if the baseline run does not fail, it is repeated once with the temporary throttle of § 4.3;
  if it still does not fail, the impl-log says the failure was not reproduced on this machine and
  cites the four failures already recorded in `00-bug-report.md` § *Actual* — the change still ships
- **How R10 reads this on a test-only fix:** the diff has no non-test path, so "restore the non-test
  paths from `origin/main`" restores nothing. The reviewer's *before* run is the AC-4 command with
  the spec itself taken from `origin/main` (`git show origin/main:tests/e2e/tsk-01-tasks.spec.ts`);
  the *after* run is the same command on the branch.

**AC-5 — the full suite, once, at two workers**
- Given the same build
- When `pnpm exec playwright test --workers=2 --retries=0` runs once
- Then every test in the spec passes, and `03-impl-log.md` records the suite's totals
- And failures elsewhere in the suite are recorded by spec and title, not fixed

**AC-6 — the suspected cause is confirmed or left open, in writing**
- Given a failing baseline run from AC-4, repeated with `--trace=retain-on-failure`
- When the trace of the overdue test's failure is read at the step from `:284`
- Then `03-impl-log.md` states which day's add form received the `fill`, or on which date the task
  was created, and whether that matches § 1
- And if no baseline run failed, it says the cause remains `suspected`

**AC-7 — refusals of the change itself**
- Given this ticket's diff
- Then it touches no file but the spec: no `src/` file, no `playwright.config.ts`, no other spec, no
  support module
- And it adds no `data-testid` and no import

**Invariants touched: `[]`.** One spec's ordering. No entry, member, team, task or count is read or
written by anything that changes; INV-01 to INV-07 constrain entries, membership and the absence
count, and a task is in no absence count (TSK-01 row).

**Open questions.** None that block. The latent staleness gap in `load` is recorded in Out of scope
as a candidate `/bug`, not decided here.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(Nothing is laid out: no screen, element or class changes. The line is written because the gate
requires exactly one.)

## 3. Permission model

None changes. The spec signs in as `thanh@example.com` (FIXTURE_MEMBER), `linh@example.com` and
`quan@example.com` exactly as on `origin/main`; ADR-057's owner-only task rule and the TSK-01 rows of
`.ai/standards/rbac-and-security.md` are untouched, and nothing on either side of the boundary is
edited. The helper only clicks an existing control and reads an existing attribute.

## 4. Contract

### 4.1 `stepDay` — new, in the spec

Insert directly after line 65 (`const heading = (page: Page) => page.getByTestId("tasks-day-heading");`),
preceded by one blank line, exactly:

```ts
/** BUG-006. Presses a day arrow and returns only once the page shows `day`. The router commits each
 *  navigation inside a React transition, so until it does the previous day — its arrows and its add
 *  form — is still on screen and still takes clicks and typing. */
async function stepDay(page: Page, arrow: "tasks-prev-day" | "tasks-next-day", day: string): Promise<void> {
  await page.getByTestId(arrow).click();
  await expect(heading(page)).toHaveAttribute("data-day", day);
}
```

Names introduced, and no others: `stepDay`, its parameters `page`, `arrow`, `day`. `expect` and
`Page` are already imported at `:1`. `tasks-day-heading`, `tasks-prev-day` and `tasks-next-day` are
existing test IDs (TSK-01 plan § 4.7; `src/routes/Tasks.tsx:818`, `:843`, `:852`).

### 4.2 The thirteen call sites — each line replaced whole, indentation kept

Line numbers are `origin/main`'s (before § 4.1's insertion shifts them).

| Line | Test | `origin/main` | Replaced by |
|---|---|---|---|
| 85 | AC-5 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TOMORROW);` |
| 106 | top bar's Tasks pill | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TOMORROW);` |
| 132 | AC-1, AC-2, AC-4 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", YESTERDAY);` |
| 138 | AC-1, AC-2, AC-4 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TODAY);` |
| 139 | AC-1, AC-2, AC-4 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TOMORROW);` |
| 187 | AC-6, AC-8 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TOMORROW);` |
| 194 | AC-7 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", YESTERDAY);` |
| 212 | AC-9, AC-10 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TOMORROW);` |
| 213 | AC-9, AC-10 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", TODAY);` |
| 255 | AC-11 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TOMORROW);` |
| 256 | AC-11 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", DAY_AFTER);` |
| 283 | AC-13 to AC-15 | `await page.getByTestId("tasks-next-day").click();` | `await stepDay(page, "tasks-next-day", TOMORROW);` |
| 301 | AC-13 to AC-15 | `await page.getByTestId("tasks-prev-day").click();` | `await stepDay(page, "tasks-prev-day", "2030-03-14");` |

Why each expected day holds: every test pins today to `2030-03-12` through `signIn` (`:43`), and
`openTasks` lands on `/tasks`, i.e. today, so `:85`, `:106`, `:132`, `:187`, `:194`, `:212`, `:255`
and `:283` start on the 12th; `:138` starts on the 11th after `:132`; `:213` on the 13th after
`:212`; `:256` on the 13th after `:255`; `:301` on the 15th, after `:290` moves the clock and `:292`
asserts it. If any expected day is wrong the test fails at the helper, which is the point.

Every other line of the spec is unchanged, the redundant heading assertions at `:134`, `:140`, `:257`
and `:292` included (AC-3).

### 4.3 The throttle for AC-4 — temporary, never committed

Only if the baseline AC-4 run does not fail: as the first two lines inside the overdue test's body
of the **baseline** spec, for that one repeat:

```ts
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
```

Removed before commit; `git diff origin/main -- tests/e2e/tsk-01-tasks.spec.ts` shows only § 4.1
and § 4.2.

## 5. Seam impact

None. No function in `src/lib/data/` changes, and the spec calls nothing on the seam it did not call
before.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/tsk-01-tasks.spec.ts"
```

The regression test (§ 2 AC-4) lives in this file; it is the overdue test itself, made deterministic.
`glossary_owed` is `[]`; no glossary row is written. `size: S` from one path; agrees with
`size_estimate: S`, ADR-012 not engaged.

## 8. Rejected alternatives

1. **`<BrowserRouter useTransitions={false}>` in `src/App.tsx`.** Removes the window at its source,
   for every spec at once. Rejected: it changes how every route in the application commits a
   navigation, to serve a test; a person is not affected by the window, so there is no user-facing
   defect to justify it; and it would put `src/App.tsx` under a review judged against features it
   was never planned against. If the window ever shows up as a user-visible defect, it gets its own
   record and an ADR.
2. **A staleness guard in `load` (`src/routes/Tasks.tsx:636-657`).** A real latent gap (§ 1 Out of
   scope), but it is not this failure: the old form posts the old day whatever `load` does, so the
   spec would still flake.
3. **Fix only `:283`, the reported line.** Smallest diff. Rejected: `:138-139`, `:212-213` and
   `:255-256` race in the same way and can end on the wrong day, and leaving them means the next
   flake in this file is already written.
4. **Wait on `toHaveURL` after each click.** Rejected: the history entry changes before the
   transition commits, so the URL is right while the previous day is still on screen — `:85-86`
   already does this and proves nothing about the rendered day.
5. **Share `stepDay` with BUG-007 through a module under `tests/e2e/support/`.** One helper for two
   specs. Rejected: each ticket owns its spec (report open question 3), a shared module would put a
   third path in both tickets' scope, and the helper is five lines.
6. **Run the spec serially, or lower `workers`.** Rejected: it hides the ordering defect rather than
   removing it, and `playwright.config.ts` is shared by every test.

## Changelog

- `2026-11-17T00:59:16Z` — all sections written. Report open questions 1 and 2 decided in § 1 (test only; every arrow click). Raised by `tech-lead-design`. Amended by `tech-lead-design`.
