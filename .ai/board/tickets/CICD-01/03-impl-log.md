---
ticket: CICD-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-13T10:40:00+00:00
inputs_read: [ .ai/board/tickets/CICD-01/01-plan.md, .ai/board/tickets/CICD-01/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CICD-01 — Implementation log

Branch is `claude/epic-hawking-g9l2n8` by session override (plan § 0); no branch created or switched,
nothing committed. The CI path guard does not resolve this ticket on that branch, so RULE-03 was policed
by hand: every path below is in `allowed_paths` or is this ticket's folder. No `src/**` file and not
`playwright.config.ts` was touched, including the commented-out nav at `Sidebar.tsx:507-519`.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `.github/workflows/verify.yml` | modified | action majors to checkout v7, pnpm/action-setup v6, setup-node v7; "exactly two status checks" comment replaced | § 4.6 |
| `.github/workflows/allowed-paths.yml` | modified | checkout v7; "second of exactly two" comment replaced | § 4.6 |
| `.github/workflows/mir-tracking.yml` | modified | checkout v4 to v7 | § 4.6 |
| `tests/e2e/adm-01-threshold.spec.ts` | modified | 1 test quarantined (BUG-003) | § 4.1, § 4.2 #1 |
| `tests/e2e/adm-02-holidays.spec.ts` | modified | 9 tests quarantined (BUG-003) | § 4.1, § 4.2 #2-10 |
| `tests/e2e/adm-03-holiday-writes.spec.ts` | modified | 2 tests quarantined (BUG-003) | § 4.1, § 4.2 #11-12 |
| `tests/e2e/adm-04-worklist.spec.ts` | modified | 1 test quarantined (BUG-003) | § 4.1, § 4.2 #13 |
| `tests/e2e/cal-06-year-view.spec.ts` | modified | 1 test quarantined (BUG-003) | § 4.1, § 4.2 #14 |
| `tests/e2e/uie-09-admin-hub.spec.ts` | modified | 3 tests quarantined (BUG-003) | § 4.1, § 4.2 #15-17 |
| `tests/e2e/uie-10-sidebar.spec.ts` | modified | 3 tests quarantined (BUG-003) | § 4.1, § 4.2 #18-20 |
| `tests/e2e/evt-09-create-invitation.spec.ts` | modified | 1 test quarantined (BUG-004) | § 4.1, § 4.2 #21 |
| `docs/ops/e2e-quarantine.md` | created | the ADR-060 register: preamble and 23 rows (21 fixme, 2 flaky), expiry 2026-11-12 | § 4.3 |
| `scripts/check-docs.mjs` | modified | check D15 and the functions/constants named in § 4.4 | § 4.4 |
| `scripts/tests/check-docs.test.mjs` | modified | 20 D15 tests, both directions, dates computed from the clock | § 4.5 |
| `.ai/standards/testing-standards.md` | modified | doc_version 4; ADR-060 exception sentence; results table re-measured; paragraph sentence added | § 4.7 |
| `.ai/board/tickets/BUG-003/ticket.yaml` | created | tracking shell, group A | § 4.8 |
| `.ai/board/tickets/BUG-004/ticket.yaml` | created | tracking shell, EVT-09 AC-6 | § 4.8 |
| `.ai/board/tickets/BUG-005/ticket.yaml` | created | tracking shell, the two flaky tests | § 4.8 |
| `.ai/board/tickets/CICD-01/03-impl-log.md` | created | this log | command |

`.ai/registry/glossary.md` is in `allowed_paths` but was not touched here: the `Quarantine` row was written at PLAN
and is already on disk (one row, verified).

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 annotation | each of the 21 declarations in the eight spec files | comment line above, `test(` to `test.fixme(`, no other test edit; diff shows exactly 21 added comment lines and 21 changed declaration lines |
| 4.2 the 21 tests | as above | titles matched exactly, one hit each, script-asserted |
| 4.3 register | `docs/ops/e2e-quarantine.md` | header and Test-cell format exactly as specified |
| 4.4 D15 | `scripts/check-docs.mjs`, section before `// --- Report` | names and shapes as specified; all 15 findings |
| 4.5 tests | end of `scripts/tests/check-docs.test.mjs` | the 20 named tests, helpers `registerWith`, `specWith`, `ticketShell` |
| 4.6 workflows | the three `.yml` | no other change |
| 4.7 standards | `.ai/standards/testing-standards.md` | figures measured below |
| 4.8 shells | `.ai/board/tickets/BUG-00{3,4,5}/ticket.yaml` | template comments kept; first line replaced; evidence blocks after `gates:` |

## Deviations from the design

- The `:227` and `:33-36` line numbers in § 4.7 are stale; the bullet and table were found by content, not line.
- The new D15 test file helper `rowOf`/`d15`/`utcDay` and the constants `SPEC`/`TITLE` are test-local conveniences beyond the helper names the plan lists; no field or contract name is affected.
- BUG shells keep the template's `# EXA-01 is a placeholder` note comment, as § 4.8 says to keep the template's comments.
- `ticket.yaml` `state` for CICD-01 was left at READY for `/advance` to transcribe (ADR-036); not set to REVIEW by hand.

Otherwise none.

## Invariants

`invariants_touched: []`. No `src/**`, seam or schema change; the 21 quarantined tests assert navigation and an invitation handoff, none an INV-nn.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 37 files, 710 tests passed |
| `node scripts/check-docs.mjs` | 0 | errors: 0, warnings: 2, pending: 7; D15 active, no FAIL D15 with the real register. Before the register and shells existed it reported 21 then 23 D15 errors, so it does fire on this tree |
| `node --test .claude/hooks/tests/*.test.mjs scripts/tests/*.test.mjs` | 0 | 376 tests, 376 pass, 0 fail (check-docs file: 126, incl. 20 D15) |
| `node --test scripts/tests/ticket-yaml.test.mjs` | 0 | 15 pass |
| `CI=1 pnpm exec playwright test` | 0 | 366 passed, 21 skipped, 0 flaky, 0 failed; 387 tests in 47 spec files, 3.4 min |
| `git diff --name-only` subset of `allowed_paths` + ticket folder | yes | plus untracked: three BUG shells, `docs/ops/e2e-quarantine.md`, this log |

## Testability contract

None: no selector is added or changed.

## Open questions

- The Vietnamese word *cách ly* in the glossary row still carries its `TODO(verify)` (plan open question 2).
- The two flaky tests did not flake in this run, so the table says 0 flaky; they keep their register rows per ADR-060.
- `git-conventions.md:276` and `SETUP.md:181` still say "exactly two status checks"; out of scope, CICD-02 inherits them.
