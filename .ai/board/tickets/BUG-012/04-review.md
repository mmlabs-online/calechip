---
ticket: BUG-012
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T12:36:43Z
inputs_read:
  - .ai/board/tickets/BUG-012/01-plan.md
  - .ai/board/tickets/BUG-012/03-impl-log.md
  - .ai/board/tickets/BUG-012/ticket.yaml
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD   # origin/main 47bbdd0, HEAD 78c34e6
  - src/components/Modal.tsx
  - tests/e2e/tsk-02-overdue-prompt.spec.ts
  - playwright.config.ts
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

# BUG-012 — review

Branch `feat/BUG-012`, two commits ahead of `origin/main` (`5337070`, `78c34e6`). Working tree clean
before and after the review (`git status --porcelain` empty both times). No server was listening on
`:4173` before the e2e runs, so `reuseExistingServer` (`playwright.config.ts:40`) could not serve a
stale build: each run rebuilt from the tree it ran against.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket BUG-012, 7 changed file(s)` / `allowed-paths: PASS`. Non-exempt paths: `src/components/Modal.tsx`, `tests/e2e/tsk-02-overdue-prompt.spec.ts`, both in `ticket.yaml:15-17`. `node scripts/check-carry.mjs BUG-012` → `0 uncommitted path(s)` / `PASS — nothing stray` |
| R2 | typecheck exit 0, whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`), exit 0, no diagnostics |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`, repo-wide, so it covers both changed files), exit 0, no diagnostics. No out-of-diff errors to route |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/components/Modal.tsx:15`, the file's only import is `react`. The test file is e2e and drives the browser only (`tests/e2e/tsk-02-overdue-prompt.spec.ts:175-198`) |
| R5 | Every plan § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches plan § 3 ("None") | PASS | `src/components/Modal.tsx:15` imports nothing but React, and `:27-42` hold no role check. The diff adds or moves no gate. That matches plan § 3 |
| R7 | No invariant violated | PASS | `ticket.yaml:14` `invariants_touched: []`. See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD --name-only -- package.json pnpm-lock.yaml` is empty. `Modal.tsx:15` swaps one named import from the existing `react` dependency |
| R10 | Regression test fails on the unfixed code and passes on the branch | PASS | Both runs below |

### R10 runs

Test: `tests/e2e/tsk-02-overdue-prompt.spec.ts:175`, `BUG-012, AC-4: Escape pressed the moment the
prompt is attached closes it`, as named in `01-plan.md` § 2 AC-4. Diff's only non-test path:
`src/components/Modal.tsx`.

1. `git checkout origin/main -- src/components/Modal.tsx`, then
   `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts -g "BUG-012" --repeat-each=10 --workers=2 --retries=0`
   → **exit 1, 10 failed, 1 passed** (the passing one is the `seam-guard` setup). Every failure is at
   `tests/e2e/tsk-02-overdue-prompt.spec.ts:197`, `toHaveCount(0)`: *"Expected: 0, Received: 1 …
   14 × locator resolved to 1 element"*. The `__escapeAtAttach` poll at `:194-196` passed, so the key
   was sent while the prompt was in the DOM. The failure is the defect, not a test that never fired.
2. `git checkout HEAD -- src/components/Modal.tsx`, same command → **exit 0, 11 passed** (10 repeats
   plus `seam-guard`).
3. AC-4's last clause: the whole spec,
   `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts --repeat-each=10 --workers=2 --retries=0`
   → **exit 0, 91 passed**, including the existing AC-4 test at `:150`.

`git status --porcelain` was empty after step 2.

Also run (DoD `test` is not an R-check, recorded only): `pnpm test` → exit 0, 63 files, 1227 tests passed.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 import line `import { useLayoutEffect, type JSX, type ReactNode } from "react";` | `src/components/Modal.tsx:15` | Yes, verbatim |
| § 4.1 listener block: comment plus `useLayoutEffect`, body and cleanup unchanged | `src/components/Modal.tsx:28-42`; comment `:28-35`, hook `:36`, Escape-only guard `:38`, cleanup `:41`, deps `[onClose]` `:42` | Yes. The diff hunk changes only the import, the hook name and adds comment lines `:30-35` |
| § 4.1 `ModalProps` and default export signature unchanged | `src/components/Modal.tsx:17-25`, `:27` | Yes. No diff lines in that range |
| § 4.2 new test, placed after AC-4 and before AC-5, verbatim | `tests/e2e/tsk-02-overdue-prompt.spec.ts:171-198`, between AC-4 (`:150`) and AC-5 (`:200`) | Yes. The diff is a 29-line pure insertion, and no other line of the file changes |

Plan § 2 ACs against the code: AC-1 and AC-2 are shown by the R10 run 2. AC-3 is shown by
`Modal.tsx:38` (non-Escape ignored), `:41` (cleanup unchanged) and markup `:44+` being outside the
diff. AC-4 is shown by the R10 runs 1 to 3.

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:14`), so no ID needs a row. That empty list was checked,
not taken on trust. The registry declares INV-01 to INV-07 (`.ai/registry/invariants.md:33-39`). All
seven constrain entries: overlap, approval reset, rejection reason, absence count, tentative
counting, portion, membership. The diff touches no entry, no count, no read and no write.
`Modal.tsx:15` imports React alone, and the only behaviour change is when the `keydown` listener is
attached (`:36`). The test file only reads the DOM and dispatches a key
(`tests/e2e/tsk-02-overdue-prompt.spec.ts:181-191`), and its last data assertion is unchanged in the
existing AC-4 test (`:168`). No invariant is reachable from this diff.

| Invariant | Held by | Citation |
|---|---|---|
| none in `invariants_touched` | n/a: the diff reaches no entry data | `ticket.yaml:14`; `src/components/Modal.tsx:15`, `:36` |

## Findings

None.

## Verdict

`PASS`. Advances to DONE.
