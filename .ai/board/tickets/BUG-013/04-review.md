---
ticket: BUG-013
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T12:44:38Z
inputs_read: [ .ai/board/tickets/BUG-013/01-plan.md, .ai/board/tickets/BUG-013/03-impl-log.md, .ai/board/tickets/BUG-013/ticket.yaml, .ai/registry/invariants.md ]
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
| R1 | Committed diff within `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → "ticket BUG-013, 7 changed file(s) … allowed-paths: PASS". Non-exempt paths are `src/routes/Tasks.tsx` and `tests/e2e/tsk-01-tasks.spec.ts`, both in `ticket.yaml` `allowed_paths`. `node scripts/check-carry.mjs BUG-013` → "0 uncommitted path(s) … PASS — nothing stray" |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. Run by the reviewer |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint src/routes/Tasks.tsx tests/e2e/tsk-01-tasks.spec.ts` exit 0. Repo-wide `pnpm lint` (`eslint .`) also exit 0, so there is nothing outside the diff to route as a chore |
| R4 | Nothing bypasses the data-access seam | PASS | The only reads touched go through `seam`, imported at `src/routes/Tasks.tsx:28`: `seam.listTasks` `:650`, `seam.listOverdueTasks` `:651`. The diff adds no import. The test reaches the mock seam object via `window.__calechipMockSeam` (`tests/e2e/tsk-01-tasks.spec.ts:340`), which is test code and not a component |
| R5 | Every plan § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | Plan § 3 says "unchanged", with no control, action or read added. The diff adds no read: `load`'s calls at `src/routes/Tasks.tsx:650-651` are the same as on `origin/main`, and the only additions are `:636-639`, `:642-643`, `:653` and `:663` |
| R7 | No invariant violated | PASS | `invariants_touched: []`. See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. `useRef` was already imported at `src/routes/Tasks.tsx:25` |
| R10 | Regression test fails before the fix and passes after | PASS | See R10 detail |

### R10 detail

The test is `tests/e2e/tsk-01-tasks.spec.ts:331`, "AC-2 (BUG-013): a slow read of a day already left does not hold the day on screen on its loader". This is the test `01-plan.md` § 2 AC-R1 names. The only non-test path in the diff is `src/routes/Tasks.tsx`.

- **Unfixed run: fails as required.** The harness's auto-mode classifier denied the in-place `git checkout origin/main -- src/routes/Tasks.tsx` on the working tree. So the run used an isolated copy of the tree in the session scratchpad, with `src/routes/Tasks.tsx` replaced by `git show origin/main:src/routes/Tasks.tsx` (checked byte-identical with `diff`). The run was `CI=1 pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts -g BUG-013 --retries=0`. `CI=1` forces a fresh `vite build`, not a reused server. Result: **1 failed** at `tests/e2e/tsk-01-tasks.spec.ts:372`, `expect(getByTestId('tasks-page').getByTestId('loader')).toHaveCount(0)`, which got "Expected: 0, Received: 1". This is the failure the plan predicts.
- **Branch run: passes.** In the repository, the same command (`CI=1 … -g BUG-013 --retries=0`) gave **2 passed**: seam-guard and the test. The full file, `pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts`, gave **12 passed**, so there is no regression in the other TSK-01 tests.
- **Tree clean afterwards.** `git status --porcelain` is empty, so the working tree was never modified.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `loadSeq = useRef(0)` beside `tickerRef` | `src/routes/Tasks.tsx:639` (`tickerRef` at `:607`) | yes |
| § 4.1 `const seq = ++loadSeq.current; const stale = …` at the top of `load` | `src/routes/Tasks.tsx:642-643` | yes |
| § 4.1 `if (stale()) return;` after the `Promise.all` await, before reconcile/`setState` ready | `src/routes/Tasks.tsx:653` | yes |
| § 4.1 `if (stale()) return;` in `catch`, before `setState({ phase: "failed" })` | `src/routes/Tasks.tsx:663-664` | yes |
| § 4.1 `load` keeps type `() => Promise<void>` and its dependency list; the effect and `ready` are unchanged | `src/routes/Tasks.tsx:641`, deps `:666`, effect `:668-670`, `ready` `:710` (unchanged lines; the diff hunks touch none of them) | yes |
| § 4.2 `HeldRead` type in the spec, not in `src/` | `tests/e2e/tsk-01-tasks.spec.ts:32-36` | yes |
| § 4.2 step 1: sign in, open, step to TOMORROW, `tasks-empty` visible | `tests/e2e/tsk-01-tasks.spec.ts:332-335` | yes |
| § 4.2 step 2: hold the next `listTasks` call only, restore the original on that call, set `__bug013Held`; `__bug013Release` gates, awaits, then `setTimeout(0)` and rAF | `tests/e2e/tsk-01-tasks.spec.ts:338-361` | yes |
| § 4.2 step 3: step to DAY_AFTER, wait for `__bug013Held` | `tests/e2e/tsk-01-tasks.spec.ts:363-364` | yes |
| § 4.2 step 4: step back to TOMORROW, `tasks-empty` visible | `tests/e2e/tsk-01-tasks.spec.ts:365-366` | yes |
| § 4.2 step 5: release the stale read | `tests/e2e/tsk-01-tasks.spec.ts:369` | yes |
| § 4.2 step 6: heading `data-day` = TOMORROW, loader count 0, empty-state text | `tests/e2e/tsk-01-tasks.spec.ts:371-373` | yes |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml`), which means invariants were considered and none is engaged. The registry list was checked against the diff one ID at a time:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 (entry overlap) | Not reachable. The diff writes no entry. Its only state write is the page's own `setState` at `src/routes/Tasks.tsx:655`/`:664`, now guarded at `:653`/`:663` | `.ai/registry/invariants.md:33` |
| INV-02 (approval resets on edit) | Not reachable. No entry is edited | `.ai/registry/invariants.md:34` |
| INV-03 (rejection reason) | Not reachable. No rejection path is involved | `.ai/registry/invariants.md:35` |
| INV-04 (one absence count) | Not reachable. Tasks are in no absence count (ADR-057), and the diff computes no count | `.ai/registry/invariants.md:36` |
| INV-05 (tentative counts) | Not reachable, for the same reason as INV-04 | `.ai/registry/invariants.md:37` |
| INV-06 (one portion per entry) | Not reachable. No entry is built | `.ai/registry/invariants.md:38` |
| INV-07 (entry belongs to one member) | Not reachable. Task ownership stays enforced by the seam/RLS and not by this diff; the reads at `src/routes/Tasks.tsx:650-651` are unchanged | `.ai/registry/invariants.md:39` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | none | — | — |

## Verdict

`PASS`. The ticket advances to DONE.
