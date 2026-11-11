---
ticket: BUG-005
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T04:57:00+00:00
inputs_read: [ .ai/board/tickets/BUG-005/01-plan.md, .ai/board/tickets/BUG-005/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/evt-02-attendance.spec.ts` | modified | AC-28 test waits for `event-form` before the raw `evaluateAll` | §4.1 |
| `tests/e2e/evt-10-description.spec.ts` | modified | `onLine` drains one animation frame first and polls the editor's own selection after; adds the `EditorRoot` type | §4.2 |
| `docs/ops/e2e-quarantine.md` | modified | the two `BUG-005` register rows deleted; header and separator kept | §4.3 |
| `.ai/board/tickets/BUG-005/03-impl-log.md` | created | this log | n/a |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `tests/e2e/evt-02-attendance.spec.ts:85-87` | text exactly as specified |
| 4.2 | `tests/e2e/evt-10-description.spec.ts:133-175` | text exactly as specified; format test body untouched; no import added; no `waitForTimeout`, no timeout raised |
| 4.3 | `docs/ops/e2e-quarantine.md:24-25` | table now has header and separator only |
| 4.4 | not committed | throttle applied to temporary copies only, originals restored; `grep setCPUThrottling tests/e2e` finds nothing |

## Deviations from the design

none

## Invariants

`invariants_touched: []`. Only two test files and two register rows change; no entry, member, team,
event or count is read or written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `node scripts/check-docs.mjs` | 1 | 3 errors, all D9 (`doc_version` vs RULE cites on ADR-073), pre-existing and outside `allowed_paths`; **no D15 finding** (AC-7) |
| `pnpm exec playwright test <both files> --repeat-each=10 --retries=0` | 0 | 171 passed, 0 failed (AC-5); AC-28 test and format test pass every repeat |
| `pnpm exec playwright test --retries=0` (full suite) | 1 | 504 passed, 1 failed: `uie-10-sidebar.spec.ts:208` AC-3 (timeout waiting for `shell-week`). Not in scope, recorded not fixed. AC-28 test and format test both passed (AC-5) |
| `git diff --name-only` subset of `allowed_paths` | yes | three files |

`pnpm test` (unit) was not run: no `src/` or unit file changed.

## AC-6 — CPU throttle (rate 6), `--repeat-each=10 --retries=0`, `-g` on the one test

The reporter counts 11 per run (10 repeats plus one more matched/setup entry); failures are out of that.

| test | without change | with change |
|------|----------------|-------------|
| EVT-02 AC-28 | 9 passed, 2 failed | 11 passed |
| EVT-10 AC-2/3/4 | 11 passed, 0 failed | 11 passed |

EVT-02 cause **confirmed** (fails without, passes with). EVT-10 cause **remains unconfirmed**: the
unfixed test did not fail under this throttle. The change still ships (plan §1).

## Testability contract

No new selectors; `event-form` already exists (`src/routes/EventEditor.tsx:364`).

## Open questions

Both register rows expire 2026-11-12; if this ticket has not merged by then D15 would fail, but the
rows are now deleted on this branch. The pre-existing D9 errors on ADR-073 and the UIE-10 AC-3
failure belong to other tickets.
