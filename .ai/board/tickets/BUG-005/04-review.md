---
ticket: BUG-005
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T05:00:17+00:00
inputs_read: [ .ai/board/tickets/BUG-005/01-plan.md, .ai/board/tickets/BUG-005/03-impl-log.md, .ai/board/tickets/BUG-005/ticket.yaml, .ai/registry/invariants.md, .ai/templates/review-report.md ]
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

Diff reviewed: `git diff origin/main...HEAD` (commits `2503330`, `7b8c4d6`); working tree clean
(`git status --porcelain` empty). Every command below was run by this reviewer, one per call.

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket BUG-005, 7 changed file(s)` … `allowed-paths: PASS`. Non-ticket, non-ship-owned paths in the diff: `tests/e2e/evt-02-attendance.spec.ts`, `tests/e2e/evt-10-description.spec.ts`, `docs/ops/e2e-quarantine.md` — exactly `ticket.yaml` `allowed_paths`. `node scripts/check-carry.mjs BUG-005` → `0 uncommitted path(s)` / `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. Covers the new `EditorRoot` type at `tests/e2e/evt-10-description.spec.ts:135-148` |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output — repo-wide, so the three changed files are included |
| R4 | No datastore access outside the seam (RULE-02) | PASS | No file under `src/` is in the diff. The only new in-page code is a read of TipTap's DOM `editor` property, `tests/e2e/evt-10-description.spec.ts:164-175`, and a `requestAnimationFrame` drain at `:157`; neither touches `src/lib/data/` or `window.__calechipMockSeam` |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 ("None changes") | PASS | No route, component or `.ai/standards/rbac-and-security.md` change in the diff; both specs still sign in as before — the only EVT-02 change is `tests/e2e/evt-02-attendance.spec.ts:85-87`, the only EVT-10 change is `tests/e2e/evt-10-description.spec.ts:133-177` |
| R7 | No invariant violated (RULE-07) | PASS | `ticket.yaml` `invariants_touched: []`; per-ID reasoning in R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --stat origin/main...HEAD` lists 7 files, none of them `package.json` or `pnpm-lock.yaml`; no import added — `tests/e2e/evt-10-description.spec.ts:1` unchanged (single hunk, `:130-180`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — wait for `event-form` before the `evaluateAll` | `tests/e2e/evt-02-attendance.spec.ts:85-87`; the click is `:83`, the read `:89-92` | Yes. Text identical to the plan block. One whitespace difference: the original blank line `:84` was kept rather than replaced, so a blank line sits between the click and the comment. No statement intervenes — AC-1's "next statement waits" holds. `event-form` exists at `src/routes/EventEditor.tsx:364`. Assertions `:94-101` unchanged (AC-2); title `:80` unchanged |
| § 4.2 — `EditorRoot` type and new `onLine` | `tests/e2e/evt-10-description.spec.ts:133-148` (type), `:150-177` (`onLine`) | Yes, character-identical to the plan block. Frame drain `:157`; click/End/Shift+Home `:158-160`; read-only selection poll `:163-177` with `toEqual({ line, oneBlock, selected, caretAtEnd })`. Probe reads `root.editor`, which TipTap sets at `@tiptap/core` `dist/index.js:6635` (`dom.editor = this`). No write to the editor. The file diff is one hunk, so the format test (`:284`, formerly `:244`) and every other test are byte-identical (AC-4). `grep` for `waitForTimeout`, `setCPUThrottling`, `timeout:` in both specs: no match (AC-4, AC-6) |
| § 4.3 — delete the two register rows | `docs/ops/e2e-quarantine.md:24-25` now header + separator, file ends at `:25` | Yes. Diff deletes exactly the two `BUG-005` rows, nothing else. `node scripts/check-docs.mjs`: no D15 finding (AC-7). Its exit 1 is three D9 errors on `.ai/registry/decisions/ADR-068-…md` and `ADR-073-…md`, files this branch does not touch — pre-existing, not this ticket's |
| § 4.4 — throttle never committed | absent from both specs (grep above) | Yes |

Independent run: `pnpm exec playwright test tests/e2e/evt-02-attendance.spec.ts tests/e2e/evt-10-description.spec.ts --retries=0`
→ `18 passed (16.3s)`, including `evt-02-attendance.spec.ts:80` (AC-28) and
`evt-10-description.spec.ts:284` (AC-2/3/4) and the other `onLine` caller, AC-7 at `:415`. The
`--repeat-each=10`, full-suite and throttled runs (AC-5, AC-6) are taken from `03-impl-log.md`; they
are not R-checks and were not re-run.

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/BUG-005/ticket.yaml`). The ledger holds INV-01–INV-07
(`.ai/registry/invariants.md:33-39`); each considered against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping portions per member | Unchanged entry code; diff touches no entry path | diff limited to `tests/e2e/evt-02-attendance.spec.ts:85-87`, `tests/e2e/evt-10-description.spec.ts:133-177`, `docs/ops/e2e-quarantine.md:26-27` (deleted) |
| INV-02 — approved entry returns to pending on edit | Unchanged; no entry edit path in diff | same three ranges |
| INV-03 — rejection carries a reason | Unchanged; no approval code in diff | same three ranges |
| INV-04 — single definition of the absence count | Unchanged; nothing computes or reads a count | same three ranges |
| INV-05 — tentative counts | Unchanged; as INV-04 | same three ranges |
| INV-06 — one portion per entry | Unchanged; no entry shape touched | same three ranges |
| INV-07 — one member per entry, counted on every team | Unchanged; no membership or entry code | same three ranges |

The only runtime code added runs inside the test browser and reads editor state
(`tests/e2e/evt-10-description.spec.ts:164-175`); it writes nothing, so it cannot engage any of the
seven.

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — R1 to R8 hold. Next state `DONE`.
