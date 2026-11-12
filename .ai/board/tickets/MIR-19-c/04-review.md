---
ticket: MIR-19-c
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-12T00:56:00Z
inputs_read: [ .ai/board/tickets/MIR-19-c/01-plan.md, .ai/board/tickets/MIR-19-c/03-impl-log.md, .ai/board/tickets/MIR-19-c/ticket.yaml, .ai/registry/invariants.md, .ai/standards/architecture.md, .ai/templates/review-report.md, "git diff origin/main...HEAD (77efa17..571c5b0)" ]
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
| R1 | Committed diff within `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-19-c, 16 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-19-c` → `0 uncommitted path(s)` … `PASS — nothing stray`. Non-board paths in the diff are exactly the 11 test files of `ticket.yaml` `allowed_paths` (e.g. `tests/e2e-org-prefix.test.ts:7`, `tests/e2e/cal-08-holiday-shading.spec.ts:2`); `.ai/board/tickets/MIR-19-d/ticket.yaml` is also listed. `tests/e2e/evt-09-create-invitation.spec.ts` is not in the diff (AC-6) |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` → `eslint .`, exit 0, no output (repo-wide, so the changed files are covered) |
| R4 | No datastore access outside the seam (RULE-02) | PASS | Seam is `src/lib/data/` (`.ai/standards/architecture.md:17`). The diff touches nothing under `src/`, `supabase/`; the only new import in each spec is the test helper, e.g. `tests/e2e/adm-05-approve-reject.spec.ts:3`, which reads `page.url()` only (`tests/e2e/support/org-prefix.ts:35-36`) |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. Unit tests: `pnpm test` → `Test Files 58 passed (58)`, `Tests 1175 passed (1175)`. Playwright on the ten specs: `94 passed (55.1s)`. Whole-suite clause of AC-2: see Delegated decisions |
| R6 | Permission gating matches plan § 3 (none changed) | PASS | No file under `src/` in the diff; the specs' role assertions are untouched, e.g. the post-walk `home-sign-out` assertion at `tests/e2e/cal-03-admin-edit-entry.spec.ts:89` and the member-less walk caller in `tests/e2e/cal-10-year-overview.spec.ts:70` keep their existing checks |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml`); per-ID reasoning in R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` contains no `package.json` or lockfile; the only added imports are the local `./support/org-prefix` (e.g. `tests/e2e/cal-10-year-overview.spec.ts:27`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `appPathname(page: Pick<Page,"url">): string`, used not changed | `tests/e2e/support/org-prefix.ts:35-37`; not in the diff | yes |
| 4.2 import placement (after `./support/entry-form`, else after `@playwright/test`) | after entry-form: `adm-05:3`, `cal-03:3`, `cal-04:3`, `cal-05:3`, `cal-06:3`, `cal-07:3`, `cal-10:27`, `solo-pending-approval-ui:3`, `uie-07:3`; after `@playwright/test` (no entry-form import): `cal-08:2` (all `tests/e2e/<spec>.spec.ts`) | yes |
| 4.2 adm-05 `backToHome` vs `"/"` | `tests/e2e/adm-05-approve-reject.spec.ts:99` | yes; bound `< 8`, assertion unchanged |
| 4.2 cal-03 `backToHome` vs `"/"` | `tests/e2e/cal-03-admin-edit-entry.spec.ts:87` | yes |
| 4.2 cal-04 `backToMonth` vs `MONTH` | `tests/e2e/cal-04-month-view.spec.ts:72` (bound `:71`, `month-grid` `:75`) | yes |
| 4.2 cal-05 `backToWeek` + `declare` capture | `tests/e2e/cal-05-week-view.spec.ts:84`, `:104` | yes (AC-4) |
| 4.2 cal-06 `backToYear` + `declare` capture | `tests/e2e/cal-06-year-view.spec.ts:109`, `:142` | yes (AC-4) |
| 4.2 cal-07 `backToHome` vs `"/"` | `tests/e2e/cal-07-overload-warning.spec.ts:116` | yes |
| 4.2 cal-08 `backTo` + post-loop `expect(appPathname(page)).toBe(path)` | `tests/e2e/cal-08-holiday-shading.spec.ts:148`, `:151`; bound `< 12` unchanged | yes |
| 4.2 cal-10 `backTo` + `declare` capture | `tests/e2e/cal-10-year-overview.spec.ts:70`, `:92`; bound `< 10` unchanged | yes (AC-4) |
| 4.2 solo-pending-approval-ui `backToHome` vs `"/"` | `tests/e2e/solo-pending-approval-ui.spec.ts:85` | yes |
| 4.2 uie-07 `backToWeek` + `declare` capture | `tests/e2e/uie-07-week-absence-count.spec.ts:106`, `:131` | yes (AC-4) |
| 4.2 AC-1: no `new URL(page.url()).pathname` left in the ten | Grep of `tests/e2e/` finds it only in `support/org-prefix.ts`, evt-09/10/11/14, uie-12 and mir-19-org-routing, none of the ten | yes |
| 4.2 AC-6: evt-09 not edited | `tests/e2e/evt-09-create-invitation.spec.ts:197` still raw; file absent from the diff | yes |
| 4.3 `WALK_SPECS`, ten names, above `MIGRATED_SPECS` | `tests/e2e-org-prefix.test.ts:7-19` | yes |
| 4.3 `...WALK_SPECS` appended last, nine names kept in order | `tests/e2e-org-prefix.test.ts:32` | yes |
| 4.3 `describe("walk specs")` / `it("reads no raw pathname")` | `tests/e2e-org-prefix.test.ts:93-101`, regex at `:98` | yes |
| 4.3 no other describe/it edited | `tests/e2e-org-prefix.test.ts:79-91` unchanged in the diff | yes |
| AC-2 test counts unchanged, nothing skipped | the diff edits no `test(`/`it(` line in the ten specs; Grep for `test.skip`/`test.fixme` in the ten returns nothing | yes |

## R7 detail

`invariants_touched` is `[]`. Each registered invariant considered against the diff, which edits only e2e spec helpers and one unit test:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Untouched: no write path changed; the diff edits only the pathname read in walk loops | `.ai/registry/invariants.md:33`; e.g. `tests/e2e/cal-05-week-view.spec.ts:84` |
| INV-02 approval resets on edit | Untouched: no entry-edit code in the diff; cal-03's edit tests unchanged apart from `backToHome` | `.ai/registry/invariants.md:34`; `tests/e2e/cal-03-admin-edit-entry.spec.ts:87` |
| INV-03 rejection reason | Untouched: adm-05's reject flow unchanged apart from the walk read | `.ai/registry/invariants.md:35`; `tests/e2e/adm-05-approve-reject.spec.ts:99` |
| INV-04 one absence-count definition | Untouched: no count computed anywhere in the diff; uie-07/cal-07 count assertions not edited | `.ai/registry/invariants.md:36`; `tests/e2e/uie-07-week-absence-count.spec.ts:106`, `:131` |
| INV-05 tentative counts | Untouched: no counting code changed | `.ai/registry/invariants.md:37`; `tests/e2e/cal-05-week-view.spec.ts:104` |
| INV-06 one portion per entry | Untouched: no entry shape changed | `.ai/registry/invariants.md:38`; `tests/e2e/cal-06-year-view.spec.ts:142` |
| INV-07 one member, every team | Untouched: no membership or team code changed | `.ai/registry/invariants.md:39`; `tests/e2e/cal-10-year-overview.spec.ts:92` |

## Delegated decisions

ADR-067. **AC-2's "and the whole suite passes" clause.** Full `pnpm exec playwright test` on HEAD 571c5b0: `520 passed`, `3 failed` (`tsk-01-tasks.spec.ts:279`, `tsk-02-overdue-prompt.spec.ts:109`, `uie-10-sidebar.spec.ts:208`). None of the three files is in the diff, and none imports a changed file (`tsk-01` imports `./support/org-prefix`, unchanged; the other two import only `@playwright/test`). Re-runs: `uie-10:208` passes alone (flaky); `tsk-01:279` passes 3/3 on HEAD and fails 1/3 on origin/main 77efa17 (flaky, pre-existing); `tsk-02:109` fails deterministically on **origin/main 77efa17 as well** (`addTask` at `tests/e2e/tsk-02-overdue-prompt.spec.ts:55` never sees the task title). Decision taken: judge AC-2 on its subject, the ten specs (94 passed) plus no regression introduced by this diff, by the same reasoning ADR-041 applies to R3. These files are outside `allowed_paths`, so RULE-03 forbids the Developer from fixing them and a FAIL would deadlock the ticket. **For a human:** `tsk-02` AC-2 is red on `main` and should become an `OPS-nnn` chore; `tsk-01` AC-13 and `uie-10` AC-3 are flaky. MIR-19-d's full-suite run at the flip will hit the same failure.

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | none | — | — |

## Verdict

PASS.
