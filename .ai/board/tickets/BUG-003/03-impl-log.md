---
ticket: BUG-003
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T03:45:00+00:00
inputs_read: [ .ai/board/tickets/BUG-003/01-plan.md, .ai/board/tickets/BUG-003/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# BUG-003 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/components/Sidebar.tsx` | modified | `<nav>` un-commented; admin test is `mayAdminister(member.role)` (role-guards forbids a literal); import and `NAV_LINK` comment updated, eslint-disable removed | §4.1 items 1-3 |
| `tests/e2e/adm-01-threshold.spec.ts` | modified | 1 quarantined test back to `test(`, marker comment removed | §4.2 |
| `tests/e2e/adm-02-holidays.spec.ts` | modified | 9 tests un-quarantined | §4.2 |
| `tests/e2e/adm-03-holiday-writes.spec.ts` | modified | 2 tests un-quarantined | §4.2 |
| `tests/e2e/adm-04-worklist.spec.ts` | modified | 1 test un-quarantined | §4.2 |
| `tests/e2e/cal-06-year-view.spec.ts` | modified | 1 test un-quarantined | §4.2 |
| `tests/e2e/uie-09-admin-hub.spec.ts` | modified | 3 tests un-quarantined | §4.2 |
| `tests/e2e/uie-10-sidebar.spec.ts` | modified | 3 tests un-quarantined | §4.2 |
| `docs/ops/e2e-quarantine.md` | modified | 20 BUG-003 rows deleted; BUG-004/005 rows untouched | §4.3 |

## Contract items

- §4.1 Sidebar: done as written (import line, `<nav>` block, `NAV_LINK` comment; long comment untouched).
- §4.2: 20 of 20 tests changed (per-file counts 1/9/2/1/1/3/3); titles and bodies unchanged.
- §4.3: 20 rows removed. Remaining `test.fixme` in `tests/e2e/`: only `evt-09-create-invitation.spec.ts`.

## Verification

- `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm test` 54 files, 1062 tests passed (role-guards included).
- `node scripts/check-allowed-paths.mjs` PASS.
- Playwright on the seven-spec selection: **89 passed, 0 failed, 0 skipped** (47.4 s).
- `node scripts/check-docs.mjs`: no D15 finding. It still exits non-zero on 3 D9 errors, all in
  `ADR-068` and `ADR-073` (`doc_version` below the rule version they cite) — outside allowed_paths and
  not caused by this diff.

## Deviations and environment notes

1. `grep -rn "BUG-003" tests/` is not empty as plan §4.2 predicts: two prose comments remain in
   `tests/e2e/adm-03-holiday-writes.spec.ts` (lines ~496, ~501) on the MIR-15-e AC-4 workaround. Plan §1
   out-of-scope item 3 leaves that test alone, so they were left. They are stale in wording only.
2. The sandbox had no `node_modules` (ran `pnpm install --frozen-lockfile`, no manifest change) and
   Playwright wanted chromium rev 1234 while 1243 is installed. I ran e2e with
   `PLAYWRIGHT_BROWSERS_PATH` pointing at symlinks in the scratchpad; no repo file was touched.
3. A `git stash` during a check-docs comparison briefly removed the working changes; restored with
   `git stash pop`, diff verified identical (9 files).

## Delegated decisions

none
