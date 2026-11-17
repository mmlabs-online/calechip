---
ticket: BUG-012
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-17T12:22:54Z
inputs_read:
  - tests/e2e/tsk-02-overdue-prompt.spec.ts
  - src/components/Modal.tsx
  - .ai/board/tickets/TSK-02/01-plan.md
  - .ai/board/tickets/BUG-007/04-review.md
  - pnpm exec playwright test --workers=2 --retries=0 (full suite, twice, origin/main 47bbdd0)
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S3
found_in: "local full-suite Playwright runs at 2 workers, origin/main 47bbdd0 (2026-11-17)"
introduced_in: "unknown — `git log -S` on the listener in `src/components/Modal.tsx:30-36` ends at the squashed `41b0a1e` ("first commit")"
root_cause: suspected
batch: ops/record-bug-012
regression_of: ""
---

# BUG-012 — TSK-02 AC-4 e2e test fails intermittently: Escape pressed as the overdue prompt appears does not close it

## Report

Operator, 2026-11-17: "ghi các flake còn lại thành bug đi", after the orchestrator listed the flakes still unrecorded at the end of the BUG-006 to BUG-011 batch: TSK-02 AC-4 (the Escape step), `adm-04` AC-11, `evt-09` AC-6, `mir-14-b` AC-13, and the stale load in `src/routes/Tasks.tsx:636-657`. No image attached.

## Environment

- Where: local, `pnpm exec playwright test` against the mock seam, origin/main `47bbdd0`
- Role and scope: member, fixture `MEMBER` of the TSK-02 spec
- Browser: Playwright Chromium, default viewport

## Steps to reproduce

1. On `main`: `pnpm exec playwright test --workers=2 --retries=0` (the full suite, for load).
2. Observe an intermittent failure of `tests/e2e/tsk-02-overdue-prompt.spec.ts:150` at `:160`.
3. Alone (`tests/e2e/tsk-02-overdue-prompt.spec.ts:150 --repeat-each=20 --workers=4`) it passed 20 of 20.

## Expected

`.ai/board/tickets/TSK-02/01-plan.md` § 2 **AC-4 — never blocks**: *"When the member presses `overdue-prompt-close`, presses Escape, or presses the backdrop / Then the prompt closes, no task changes because it closed, and the screen beneath is usable."* Feature row `TSK-02` (`.ai/registry/features.md:254`). The spec must pass on every run.

## Actual

`expect(getByTestId('overdue-prompt-modal')).toHaveCount(0)` failed at `tests/e2e/tsk-02-overdue-prompt.spec.ts:160`, *"Expected: 0, Received: 1, Timeout: 5000ms … 14 × locator resolved to 1 element"*, right after `page.keyboard.press("Escape")` at `:159`. Seen: 1 failure in 2 full-suite runs at 2 workers on origin/main `47bbdd0` (2026-11-17, this record); 1 of 30 in BUG-007's after-run (`.ai/board/tickets/BUG-007/04-review.md:31`, `:75`). The close control (`:154-155`) and the round control (`:164-165`) never failed.

## Root cause

**suspected.** `src/components/Modal.tsx:30-36` binds the Escape listener on `document` inside `useEffect`, which React runs after the browser paints the committed tree. `:158` waits only for the prompt to be visible, so under load Playwright can press Escape in the gap between paint and the effect, when no listener is attached yet; the key is lost and the modal stays. The close and backdrop paths do not have the gap: they are React props bound at commit. Confirm: `--repeat-each=50 --workers=2` with a CPU throttle and a trace, and read whether `keydown` fires before `addEventListener` runs. `Modal` is shared, so every modal that is closed by Escape right after opening has the same window.

## Severity

S3 — a person cannot press Escape within the milliseconds between paint and effect, so the prompt behaves as AC-4 says for every user; the cost is a red full-suite gate about one run in thirty.

## Regression test, proposed

End-to-end, in the same spec: the race is between a real browser's paint, React's passive effects and Playwright's key dispatch. A unit render with Testing Library flushes effects synchronously and cannot see it. Acceptance evidence: `--repeat-each` under `--workers=2` with 0 failures, before and after.

## Open questions

- Fix the app (bind the listener so it exists at commit, for every `Modal`) or the test (wait for something that proves the listener is attached)? The first changes a shared component that every modal uses.
- If the app: is a key handler on the card, with focus moved into it on open, preferable for accessibility? That is a behaviour change and may need an ADR.

## Further reports

None.
