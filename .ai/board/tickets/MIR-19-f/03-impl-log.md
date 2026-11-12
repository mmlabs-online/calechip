---
ticket: MIR-19-f
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-12T03:57:00Z
inputs_read: [ .ai/board/tickets/MIR-19-f/01-plan.md, .ai/board/tickets/MIR-19-f/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261112150000_mir19f_sign_up_lands_in_org.sql` | created | Re-creates `admit_allow_listed_member()` so it writes `org_id` from `org_code` and raises `P0002` on an unknown code | § 4.1 |
| `supabase/tests/380-sign-up-lands-in-org.test.sql` | created | pgTAP for AC-9.1 to 9.8 (17 assertions) | § 4.6 |
| `src/lib/data/index.ts` | modified | `SignUpInput.orgCode`, `signUp` docblock sentence | § 4.2 |
| `src/lib/data/supabase.ts` | modified | Sends `org_code` in `options.data` only when set | § 4.3 |
| `src/lib/data/mock.ts` | modified | `mockRowOrgOf`, unknown-code refusal, org of the new row, org-bounded pending list/count/decide | § 4.4 |
| `src/routes/SignUp.tsx` | modified | Optional `orgCode` prop passed to `seam.signUp` | § 4.5 |
| `src/App.tsx` | modified | Org-base `/signup` renders `<SignUp orgCode={base.slice(1)} />` inside `BareLayout` | § 4.5 |
| `tests/signup-org.test.ts` | created | Vitest for AC-10.1 to 10.4 | § 4.7 |
| `tests/e2e/mir-19-f-org-signup.spec.ts` | created | Playwright for AC-1 to AC-7 | § 4.8 |
| `tests/e2e/mir-19-org-routing.spec.ts` | modified | AC-9 amended (title, `/shared/signup` stays), header line | § 4.8, AC-11 |

ADR-099 (in `allowed_paths`) already existed from PLAN and was not touched.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | migration file | Body as specified; comments from the 21c definition kept; no grant change |
| 4.2 | `src/lib/data/index.ts` `SignUpInput` | |
| 4.3 | `src/lib/data/supabase.ts` `signUp` | `toFailure` untouched |
| 4.4 | `src/lib/data/mock.ts` | No export added to `seam` |
| 4.5 | `SignUp.tsx`, `App.tsx` | Root route unchanged |
| 4.6 / 4.7 / 4.8 | test files above | |

## Deviations from the design

- **SQL test uses `tests.member_role('admin')` for Fay, not the literal `'org_admin'`** the plan names in § 4.6. `_isolation.psql:103-111` maps `'admin'` to `org_admin`, and the sibling tests (280) use that helper. Same value.
- Added a local `tests.shared_org_380()` helper (as 280 does) to name Org public's id while authenticated.

Otherwise none.

## Invariants

`invariants_touched: []`. A sign-up writes a pending member row with no team and no entry; no count changes.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 62 files, 1216 tests |
| `pnpm exec playwright test` | non-zero | 535 passed, 5 failed in the full run; see below |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | |

**Playwright.** All new and amended specs pass. Of the 5 full-run failures: `tsk-01-tasks` AC-13 to AC-15 fails identically on a stashed baseline (pre-existing, unrelated: it is the task screen). `mir-19-d-flip` AC-5 and `uie-10-sidebar` AC-3 pass in isolation with my changes (22 of 22) and on baseline; `evt-07-guest-registration` failed on a different test in each of two runs. Those three read as load flakiness (2 workers), not as a result of this diff. Not fixed: out of scope.

**pgTAP not run.** No PostgreSQL is reachable in this environment (`pg_isready`: no response), so `380-sign-up-lands-in-org.test.sql` and the migration are unexecuted. Written against the sibling tests' helpers; the reviewer or CI should run `pnpm db:test`. `TODO(verify)` per plan § 4.3: the exact GoTrue code for a failing `auth.users` trigger.

## Testability contract

No selector added. Used as existing: `signup-form`, `signup-email`, `signup-password`, `signup-display-name`, `signup-avatar-option`, `signup-submit`, `signup-error`, `signup-confirm-notice`, `auth-tab-signup`, `auth-tab-signin`, `sign-in-submit`.

## Open questions

none
