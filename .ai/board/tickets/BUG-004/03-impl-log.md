---
ticket: BUG-004
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T04:08:00+00:00
inputs_read: [ .ai/board/tickets/BUG-004/01-plan.md, .ai/board/tickets/BUG-004/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/evt-09-create-invitation.spec.ts` | modified | AC-6 test un-quarantined (`test.fixme` to `test`, QUARANTINED comment removed) and the list-rendered wait added before the handoff `pushState` | §4.1 |
| `docs/ops/e2e-quarantine.md` | modified | the AC-6 register row deleted (one line) | §4.2 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `tests/e2e/evt-09-create-invitation.spec.ts:191` and `:202-208` | exact text from the plan; no other line of the file changed (`git diff`: +7 -3 net of comment) |
| 4.2 | `docs/ops/e2e-quarantine.md` (former line 26) | the other two rows untouched |
| 4.3 | not committed, by design | throttle used only for the two measurement runs below; `grep -c CPUThrottling` on the committed file is 0 |

## Deviations from the design

none

## AC-6 measurement (plan AC-6)

Test: the AC-6 test with `Emulation.setCPUThrottlingRate` rate 6, `-g "AC-6" --repeat-each=10 --retries=0`.

| run | pass count |
|-----|-----------|
| without the two added `expect` lines (throttled) | 10 of 10 |
| with the two added `expect` lines (throttled) | 10 of 10 |

The run without the wait did not fail, so **the CI cause remains unconfirmed**. The wait still ships
per plan section 1: handing history state in from a screen the test has not confirmed it is on is wrong
regardless. (A rate-6 CPU throttle on this machine did not reproduce the fold; CI's actual load may differ.)

## Invariants

`invariants_touched: []`. A test's ordering and a register row; no entry, member, team or count is read or written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 54 files, 1062 tests |
| `pnpm exec playwright test tests/e2e/evt-09-create-invitation.spec.ts --repeat-each=10 --retries=0` | 0 | 71 passed, AC-6 included 10 of 10. Needed a symlink `/opt/pw-browsers/chromium_headless_shell-1234` to the installed `-1243` because the sandbox had no matching browser; outside the repo, no tracked file affected |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-docs.mjs` | 1 | no D15 finding. Three D9 errors, all in `.ai/registry/decisions/ADR-068` and `ADR-073` (doc_version behind cited rule versions); pre-existing, registry-owned, not touched by this ticket (RULE-01) |

`git diff --name-only` is a subset of `allowed_paths`: yes (two files).

## Testability contract

No selectors added or renamed. Used existing `event-detail` and `event-row`.

## Open questions

The register row expired 2026-11-12 is now deleted; if this ticket merges after that date nothing else
is needed. The D9 errors above are the operator's or the steward's to fix and will fail the audit
independent of this ticket.
