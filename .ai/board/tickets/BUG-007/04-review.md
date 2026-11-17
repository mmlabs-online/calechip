---
ticket: BUG-007
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T03:16:47Z
inputs_read: [ .ai/board/tickets/BUG-007/01-plan.md, .ai/board/tickets/BUG-007/03-impl-log.md, .ai/board/tickets/BUG-007/ticket.yaml, .ai/registry/invariants.md, "git diff origin/main...HEAD" ]
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket BUG-007, 6 changed file(s)` / `allowed_paths: tests/e2e/tsk-02-overdue-prompt.spec.ts` / `allowed-paths: PASS`, exit 0. The only non-exempt path is `tests/e2e/tsk-02-overdue-prompt.spec.ts`, listed at `.ai/board/tickets/BUG-007/ticket.yaml:20`. `node scripts/check-carry.mjs BUG-007` → `0 uncommitted path(s)` / `PASS — nothing stray`, exit 0. |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. `tsconfig.json` `include` covers `tests`, so the changed spec is in the program. |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`, repo-wide, a superset of the one changed file) exit 0, no output. No error outside the diff to report. |
| R4 | Data-access seam | PASS | The diff touches only `tests/e2e/tsk-02-overdue-prompt.spec.ts`; the added code at `:63-70` clicks a control and reads `data-day` from `tasks-day-heading` (`src/routes/Tasks.tsx:818`). Nothing under `src/` changes; no datastore access added. |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. |
| R6 | Permission gating matches § 3 | PASS | § 3: no change. Sign-in is untouched — `signIn`/`fillSignIn` at `tests/e2e/tsk-02-overdue-prompt.spec.ts:24-36` are outside the diff hunks; no `src/` file or RBAC path is in the diff. |
| R7 | No invariant violated | PASS | `invariants_touched: []` at `ticket.yaml:14`. See R7 detail. |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD --name-only` contains neither `package.json` nor `pnpm-lock.yaml`; the spec's only import is unchanged at `tests/e2e/tsk-02-overdue-prompt.spec.ts:1`. |
| R10 | Regression test fails before, passes after | PASS | Named test: the AC-2 test, `tests/e2e/tsk-02-overdue-prompt.spec.ts:117` (`01-plan.md` § 2 AC-4, § 7). Diff has no non-test path, so per AC-4 the *before* run used the spec from `git show origin/main:tests/e2e/tsk-02-overdue-prompt.spec.ts`. Both runs: `pnpm exec playwright test <tsk-02 spec> tests/e2e/uie-10-sidebar.spec.ts --repeat-each=30 --workers=2 --retries=0`. **Before:** exit 1, 567 passed / 34 failed of 601; **AC-2 test failed 22 of 30**, every one at `addTask` `:55` (`toBeVisible` on `"Tomorrow's"`, element not found) called from `:116` — the step § 1 names; other 12 failures are `uie-10-sidebar.spec.ts:208`. **After (branch):** exit 1, 588 passed / 13 failed of 601; **AC-2 test passed 30 of 30**; 12 failures are `uie-10-sidebar.spec.ts:208` (load companion), 1 is TSK-02 AC-4 at `:160` (see Delegated decisions). Tree clean after both: `git status --porcelain` empty. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `stepDay`, inserted after `heading` with one blank line, doc comment and body as specified | `tests/e2e/tsk-02-overdue-prompt.spec.ts:62` (`heading`), `:63` (blank), `:64-66` (comment), `:67-70` (function) | Yes — `stepDay(page: Page, arrow: "tasks-prev-day" \| "tasks-next-day", day: string): Promise<void>`, body: click `arrow`, then `expect(heading(page)).toHaveAttribute("data-day", day)`; text identical to § 4.1 |
| § 4.2 origin/main `:83` → `stepDay(page, "tasks-next-day", DAY_2)` | `:91` | Yes |
| § 4.2 origin/main `:86` → `stepDay(page, "tasks-next-day", DAY_3)` | `:94` | Yes |
| § 4.2 origin/main `:115` → `stepDay(page, "tasks-next-day", DAY_2)` | `:123` | Yes |
| § 4.2 origin/main `:176` → `stepDay(page, "tasks-prev-day", DAY_2)` | `:184` | Yes |
| § 4.2 origin/main `:177` → `stepDay(page, "tasks-prev-day", DAY_1)` | `:185` | Yes |
| § 4.2 origin/main `:196` → `stepDay(page, "tasks-prev-day", DAY_2)` | `:204` | Yes |
| § 4.2 origin/main `:197` → `stepDay(page, "tasks-prev-day", DAY_1)` | `:205` | Yes |
| § 4.3 throttle never committed | `git diff origin/main...HEAD -- tests/e2e/tsk-02-overdue-prompt.spec.ts` shows only the § 4.1 insertion and the seven § 4.2 lines; no `newCDPSession` or `setCPUThrottlingRate` in the file | Yes |
| AC-1 search | `getByTestId(arrow)` at `:68` is the only arrow click; `tasks-next-day`/`tasks-prev-day` appear elsewhere only as `stepDay` arguments (`:67`, `:91`, `:94`, `:123`, `:184`, `:185`, `:204`, `:205`) | Yes |
| AC-3 assertions kept | redundant heading assertions remain at `:92`, `:95`, `:186`, `:206`; no `waitForTimeout` in the file; no `expect` removed in the diff | Yes |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:14`, reasoning in `01-plan.md` § 2). Checked each ledger ID against the diff anyway, since the only changed file is an e2e spec (`tests/e2e/tsk-02-overdue-prompt.spec.ts:63-70`, `:91`, `:94`, `:123`, `:184-185`, `:204-205`):

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap of entries | Not engaged: diff writes no entry and changes no entry validation code; only task-creation steps' timing in a test change | `.ai/registry/invariants.md:33`; diff limited to the spec lines above |
| INV-02 approval reset on edit | Not engaged: no entry edit path touched | `.ai/registry/invariants.md:34` |
| INV-03 rejection reason | Not engaged: no rejection path touched | `.ai/registry/invariants.md:35` |
| INV-04 absence count | Not engaged: tasks are not in the absence count and no `src/` file changes | `.ai/registry/invariants.md:36` |
| INV-05 tentative counts | Not engaged | `.ai/registry/invariants.md:37` |
| INV-06 one portion per entry | Not engaged | `.ai/registry/invariants.md:38` |
| INV-07 member/team counting | Not engaged: no membership or team code in diff | `.ai/registry/invariants.md:39` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

None.

## Delegated decisions

Taken under ADR-067; the verdict is judged against them.

1. **Plan AC-4's "every test in the spec passes, 30 of 30 each, with exit code 0" is not read literally.** The load companion `uie-10-sidebar.spec.ts:208` failed 12 of 30 in both the before and the after run, so the command exits 1 on any tree; that companion is out of scope (`01-plan.md` § 1). R10 is judged on the named regression test, the AC-2 test (`01-plan.md` § 7), which went from 22/30 failing to 30/30 passing.
2. **One after-run failure of TSK-02's AC-4 test (`tests/e2e/tsk-02-overdue-prompt.spec.ts:160`, `toHaveCount(0)` on `overdue-prompt-modal` after `keyboard.press("Escape")` at `:159`, 1 of 30) is not charged to this diff.** That step follows `reopen` and does not involve a day arrow. The only diff lines on its path are `:91` and `:94` in `twoOverdue`, and each is immediately followed by the same heading assertion that was already there (`:92`, `:95`), so the path waits for exactly what it waited for before. It is a separate intermittent defect in the overdue prompt's Escape handling or in the spec. It is outside `allowed_paths`' intent and outside the § 4 contract, so no loop role can fix it here. **Recommended for a human:** record it with `/bug` as its own record, like the other flakes listed out of scope in `01-plan.md` § 1.
3. **AC-6 (cause confirmed by trace) stays `suspected` in the impl log.** This review did not read a trace either. The baseline failures all sit at `:55` called from `:116`, with *Tomorrow's* absent from the next day's list, which is the symptom § 1 predicts. That is consistent evidence, not confirmation. AC-6 allows the `suspected` outcome, so it does not affect the gate.
