---
ticket: BUG-012
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T12:28:41Z
inputs_read:
  - .ai/board/tickets/BUG-012/ticket.yaml
  - .ai/board/tickets/BUG-012/00-bug-report.md
  - .ai/registry/features.md                     # TSK-02 row, :254
  - .ai/registry/invariants.md
  - .ai/board/tickets/TSK-02/01-plan.md          # § 2 AC-4 :125, selector table :345
  - .ai/board/tickets/BUG-007/01-plan.md         # sibling: same spec, same regression-criterion shape
  - .ai/standards/testing-standards.md
  - playwright.config.ts                         # fullyParallel :11, retries :13, webServer
  - docs/ops/e2e-quarantine.md                   # tsk-02 is not registered
  - src/components/Modal.tsx                     # Escape listener in useEffect :30-36
  - src/components/OverduePrompt.tsx             # setOpen(true) inside listOverdueTasks(...).then, :91-95
  - src/components/TaskDayDialog.tsx             # a Modal user; no nested modal, :133-134
  - src/components/NotificationBell.tsx          # its own document Escape listener, :143-147, not a Modal
  - tests/e2e/tsk-02-overdue-prompt.spec.ts      # AC-4 test :150-169
  - experiment, scratch copy of origin/main 47bbdd0 (never committed) - see § 4.3
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-012 — Escape pressed as the overdue prompt appears does not close it

## 1. Problem and scope

**Feature implemented, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| TSK-02 | Each time the app opens, a member is shown their overdue tasks and can tick them or move them all to today |

TSK-02 is `DONE`. Its AC-4 (`.ai/board/tickets/TSK-02/01-plan.md:125`, *never blocks*) says Escape
closes the prompt. `Modal` attaches its Escape listener in a passive effect, and the prompt opens
from a promise (`OverduePrompt.tsx`, `setOpen(true)` inside `listOverdueTasks(...).then`). React runs
a passive effect for a render like that in a later task, after the browser paints. So the modal is
in the DOM and visible for a short time with no Escape listener attached. A key pressed then is lost.
No person can press a key that fast. The end-to-end AC-4 test can, and does about one run in thirty
under a two-worker load. This ticket attaches the listener in the same task that puts the modal in
the DOM, so no gap exists. The member gains nothing visible. The reviewer and the operator get back
a full-suite run that is red only when something is broken.

**Root cause: confirmed at PLAN** (the report had it as *suspected*). On a copy of
`origin/main` `47bbdd0`, the regression test in § 4.2 dispatches Escape in a `MutationObserver`
callback. That callback runs as a microtask right after React's commit task, which is before the
passive-effect task. The test **failed 5 of 5**. After the one-line change in § 4.1, it **passed 10
of 10**, and the whole spec passed 91 of 91 (`--repeat-each=10 --workers=2 --retries=0`). The
mechanism is now deterministic, not probabilistic, so a regression test can pin it.

**Out of scope:**

- **Escape handling for any component that is not `Modal`.** `NotificationBell.tsx:143-147` binds
  its own document listener in `useEffect`, so it has the same shape of gap. It opens from a click,
  and React flushes a discrete event's passive effects synchronously, so no flake has been recorded
  against it. If one is, it goes to its own `/bug`.
- **A key handler on the dialog card with focus moved into it on open** — the report's second open
  question. That is a behaviour and accessibility change (focus management, focus trap, return of
  focus on close). It belongs in an `/idea`, not a defect fix. § 8 alternative 2.
- **The other flakes the operator listed with this one** (`adm-04` AC-11, `evt-09` AC-6, `mir-14-b`
  AC-13, the stale load in `src/routes/Tasks.tsx:636-657`). Each is its own `BUG-nnn`.
- **Any change to the existing AC-4 test** (`:150-169`). It stays as it is. It becomes deterministic
  because the component no longer has the gap, not because the test waits longer.
- **Timeouts, retries, `waitForTimeout`, and `playwright.config.ts`.** None of these change.

`size_estimate: S`, for one component line plus its comment, and one test.

## 2. Acceptance criteria

**AC-1 — Escape closes a `Modal` from the first moment it is in the DOM**
- Given any screen that renders `Modal` (`src/components/Modal.tsx`)
- When a `keydown` with `key === "Escape"` reaches `document` at any point after the `Modal`'s
  backdrop element (`data-testid="<prefix>-modal"`) has been inserted into the DOM, including in a
  microtask straight after that insertion
- Then `onClose` is called once for that key press

**AC-2 — TSK-02 AC-4 holds under the race: the overdue prompt closes on an Escape pressed the moment
it appears**
- Given a member with two overdue tasks who signs out and in again (the spec's `twoOverdue` and
  `reopen`)
- When Escape reaches `document` in the first microtask after `overdue-prompt-modal` is inserted
- Then `overdue-prompt-modal` has count 0, and no task changed because the prompt closed (the
  existing AC-4 test's last assertion, `tasks-overdue-count` = `2`, still passes)

**AC-3 — nothing else about `Modal` changes**
- Given every existing caller of `Modal` (`OverduePrompt`, `TaskDayDialog`, `ReportIssueButton`,
  `EventJoinBar`, `EventAttendancePanel`, `GuestEvent`, `Tasks`, `MonthView`, `MemberList`,
  `EventDetail`)
- When the change in § 4.1 is applied
- Then `ModalProps`, the markup, every `data-testid`, the backdrop guard and the close button are
  byte-identical to `origin/main`. The diff to `src/components/Modal.tsx` is only the import line,
  the hook name, and the comment in § 4.1.
- And a non-Escape key still does not call `onClose`, and unmounting the `Modal` still removes the
  listener (the cleanup function is unchanged)

**AC-4 — regression criterion (ADR-101): the new test fails on `origin/main` and passes after the
change**
- Test file: `tests/e2e/tsk-02-overdue-prompt.spec.ts`. Test: `BUG-012, AC-4: Escape pressed the
  moment the prompt is attached closes it` (§ 4.2). End to end, because the defect lives between a
  real browser's task scheduling and React's passive effects. A unit render with Testing Library
  flushes effects synchronously and cannot see it (`00-bug-report.md` § *Regression test,
  proposed*).
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts -g "BUG-012" --repeat-each=10 --workers=2 --retries=0`
  runs with the new test and **`src/components/Modal.tsx` restored from `origin/main`**
- Then it fails 10 of 10 at the final `toHaveCount(0)`, and `03-impl-log.md` § *Regression test*
  records the command, the exit code, the counts and the failing assertion
- And when the same command runs with the change in § 4.1, it passes 10 of 10 with exit code 0
- And `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts --repeat-each=10 --workers=2 --retries=0`
  passes every test in the spec, the existing AC-4 test included, recorded beside it

**Invariants touched:** `[]`. INV-01 to INV-07 are about entries, absence counts and portions. A
listener's attach timing in a presentational component reaches none of them.

**Open questions:** none. The report's two questions are settled as PLAN decisions under ADR-067.
Neither changes behaviour, a permission or an invariant, so neither needs an ADR:
1. *Fix the app or the test?* **The app**, § 4.1. The race is a real property of the component, the
   test only exposed it, and no test-side wait can prove the listener is attached (§ 8 alternative 1).
2. *A key handler on the card, with focus moved in?* **No**, out of scope (§ 1). It is a behaviour
   change.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(No layout is in play. Nothing visual changes.)

## 3. Permission model

None. `Modal` is presentational and imports nothing but React (`Modal.tsx` header). No role check
is added, removed or moved, and no read or write is touched. The overdue prompt's owner-only scope
(ADR-057) is enforced by the seam and the policies, and both are unchanged.

## 4. Contract

### 4.1 `src/components/Modal.tsx` — the only production change

The import line, whole:

```tsx
import { useLayoutEffect, type JSX, type ReactNode } from "react";
```

The listener block (`:28-36` on `origin/main`), whole, replacing the comment and the `useEffect`
call. The body and the cleanup are unchanged:

```tsx
  // Escape closes. Bound on the document rather than on the card, so it works before anything inside
  // has taken focus.
  //
  // **A LAYOUT EFFECT, NOT A PASSIVE ONE** — BUG-012. A dialog opened from a promise (the overdue
  // prompt opens when `listOverdueTasks` answers) has its passive effects run in a later task,
  // after paint. Until then the dialog was on screen with no listener, and an Escape pressed in that
  // gap was lost. A layout effect runs in the same task that inserts the backdrop, so nothing outside
  // React ever sees the dialog without its listener.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
```

`ModalProps` and the default export's signature are unchanged:

```tsx
export default function Modal({ testIdPrefix, label, onClose, children }: ModalProps): JSX.Element
```

### 4.2 `tests/e2e/tsk-02-overdue-prompt.spec.ts` — one new test

Inserted inside `test.describe("TSK-02 — the overdue prompt", …)`, right after the `AC-4: the round
control, Escape and Close each dismiss it, changing nothing` test and before `AC-5`. No other line of
the file changes. The `window` property name `__escapeAtAttach` is fixed here:

```ts
  /** BUG-012. Escape is dispatched in the microtask right after the prompt's backdrop is inserted —
   *  before React's passive effects, which is where `Modal` used to attach its listener. The flag
   *  proves the key was sent while the prompt was in the DOM, so a pass cannot come from the key
   *  never being sent. */
  test("BUG-012, AC-4: Escape pressed the moment the prompt is attached closes it", async ({ page }) => {
    await twoOverdue(page);
    await expect(prompt(page)).toBeVisible();
    await page.getByTestId("overdue-prompt-close").click();
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);

    await page.evaluate(() => {
      const w = window as unknown as { __escapeAtAttach?: boolean };
      w.__escapeAtAttach = false;
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[data-testid="overdue-prompt-modal"]')) return;
        observer.disconnect();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        w.__escapeAtAttach = true;
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await reopen(page);

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __escapeAtAttach?: boolean }).__escapeAtAttach))
      .toBe(true);
    await expect(page.getByTestId("overdue-prompt-modal")).toHaveCount(0);
  });
```

Why it is shaped like this, so the Developer does not "simplify" it:
- **The first opening is closed by the round control** because `reopen` clicks `home-sign-out`, and
  the open prompt's backdrop covers it (`reopen`'s own comment).
- **`page.evaluate` runs before `reopen`**, and the observer has to be armed before the sign-in that
  opens the prompt. `page.evaluate` survives `reopen` because `reopen` does not load a page.
- **`document.dispatchEvent`, not `page.keyboard.press`.** Only an in-page dispatch can land inside
  the gap deterministically. `Modal` listens on `document`, so this is the same path a real key takes.

### 4.3 The verification already run — scratch copy, never committed

Recorded so the reviewer knows the expected counts. These are not ACs. Ran on a `git archive` copy of
`origin/main` `47bbdd0` with § 4.2 added: `-g "BUG-012" --repeat-each=5 --workers=2 --retries=0`
gave **5 failed**, each at the final `toHaveCount(0)` with *"14 × locator resolved to 1 element"*.
That is the same signature as the report's flake at `:160`. With § 4.1 applied as well, the whole
spec at `--repeat-each=10 --workers=2 --retries=0` gave **91 passed**. `pnpm exec eslint` on both
files exited 0.

## 5. Seam impact

None. `Modal` imports no seam function, and no seam function changes.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/components/Modal.tsx"
  - "tests/e2e/tsk-02-overdue-prompt.spec.ts"
```

The ticket folder `.ai/board/tickets/BUG-012/**` is always writable and is not listed. No glossary
terms are owed (`glossary_owed: []`). No ADR is written.

`size: S` (two paths) agrees with `size_estimate: S`.

## 8. Rejected alternatives

1. **Fix the test only: wait for something that proves the listener is attached.** This is the
   report's first option and the shape BUG-007 took for its flake. Rejected because nothing on the
   page shows that a passive effect has run. To get a signal, `Modal` would need something like a
   `data-ready` attribute set from inside the effect. That is a production change made only to serve
   a test, and the gap would still be in the product. Every other spec that presses Escape on a
   `Modal` would need the same wait, and a new spec would be flaky again by default.
2. **A key handler on the dialog card, with focus moved into it on open.** Better for accessibility,
   and it removes the document listener entirely. Rejected for this ticket because it changes
   behaviour: where focus goes on open, whether Escape works after focus leaves the card, and where
   focus returns on close. Each of those is a decision for an `/idea`, not something a defect fix
   should settle quietly. It would also touch all ten callers' focus expectations.
3. **Add `await page.waitForTimeout(…)` or a retry before the Escape at `:159`.** Rejected because
   it hides the gap and does not close it. Testing standards and BUG-007 § 2 AC-3 both refuse added
   timeouts as a fix.
4. **Open the prompt with `flushSync` in `OverduePrompt`, so its passive effects flush
   synchronously.** That fixes this one caller. Any other `Modal` that opens from a promise would
   still have the gap. Today the other nine open from clicks (for example `EventJoinBar.tsx:139`,
   `GuestEvent.tsx:636`), so they are not affected yet. The defect is in `Modal`, so `Modal` is where
   it gets fixed.

## Changelog

- `2026-11-17T12:28:41Z` — plan written. The root cause in `00-bug-report.md` moved from *suspected*
  to *confirmed* by the experiment in § 4.3. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
