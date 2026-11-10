---
ticket: TEA-05
stage: QA
agent: qa
produced_at: 2026-09-01T15:33:00+07:00
inputs_read: [ .ai/board/tickets/TEA-05/01-plan.md, .ai/board/tickets/TEA-05/05-test-plan.md ]
consulted: []
chat_before_verdict: none
gate: FAIL
blocking_reason: "pnpm exec playwright test exits 1 (13 failures): e2e suite is unpinned (BUG-001) and runs against live Supabase project where new test accounts are unseeded"
next_state: REWORK
---

# TEA-05 Test Report

## Results

| Suite | Command | Exit code | Passed | Failed | Skipped |
|---|---|---|---|---|---|
| unit | `pnpm exec vitest run` | 0 | 2 | 0 | 0 |
| e2e | `pnpm exec playwright test` | 1 | 7 | 13 | 0 |

## AC coverage

| AC | Test name | Result |
|---|---|---|
| AC-1 | AC-1: a member signs in and lands on the board with name, avatar, and role | FAIL |
| AC-2 | AC-2: a wrong address and a wrong password are refused identically | PASS |
| AC-3 | AC-3: an unconfirmed address cannot sign in, and is told why | FAIL |
| AC-4 | AC-4: a signed-in person with no member row is told they are not on a team | FAIL |
| AC-5 | AC-5: the member-less answer is never given to a caller with no session | PASS |
| AC-6 | AC-6: signing out ends the session from Home and from member-less screen | FAIL |
| AC-7 | AC-7: a reload keeps the session | FAIL |
| AC-8 | AC-8: an expired or revoked session lands on sign-in, not on a broken screen | PASS |
| AC-9 | AC-9: with no session, the application lands on the sign-in screen | PASS |
| AC-10 | AC-10: the allow-list link is shown to an admin and to nobody else | FAIL |
| AC-11 | AC-11: signing in creates, updates and deletes nothing in member roster | FAIL |

## Failures

| # | Test | Expected | Actual | Routes to | Increments rework_count |
|---|---|---|---|---|---|
| 1 | `tests/e2e/tea-01-signup.spec.ts` (6 tests) | Seam banner present and mock signup flow passing | Banner missing and signup tests fail because runner targets live Supabase (MD-021) | `developer` (BUG-001) | No (harness defect) |
| 2 | `tests/e2e/tea-05-sign-in.spec.ts` (AC-1, AC-3, AC-4, AC-6, AC-7, AC-10, AC-11) | Sign-in and session flow succeed against test fixtures | Fails because runner targets unseeded remote Supabase instance rather than pinned mock seam | `developer` (BUG-001) | No (harness defect) |

## Invariant observations

| Invariant | Held | Evidence |
|---|---|---|
| INV-04 | Held | AC-11 probes roster stability: signing in issues no inserts, updates, or deletes to `public.member`. Under mock and contract, `useSession` performs read-only resolution. |

## Selector gaps encountered

None. All selectors used are from section 8 of `01-plan.md`.

## Verdict

`FAIL`. The end-to-end command `pnpm exec playwright test` exits with code 1. As documented in `01-plan.md` section 7 and `testing-standards.md`, the test harness does not pin the seam and runs against the live database where new test accounts are not seeded. Resolution is gated on `BUG-001`.
