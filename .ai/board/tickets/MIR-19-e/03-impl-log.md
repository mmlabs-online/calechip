---
ticket: MIR-19-e
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-12T02:48:11Z
inputs_read: [ .ai/board/tickets/MIR-19-e/01-plan.md, .ai/board/tickets/MIR-19-e/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-19-e — implementation log

## Files touched

ADR-098 was written at PLAN and is already committed; it is not touched here.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261112090000_mir19e_email_org_code.sql` | created | Re-creates `email_notification()` and `email_invitation()` so each request carries `orgCode`; bodies generated from the two previous definitions plus the four marked lines | § 4.1 |
| `supabase/functions/send-event-email/template.ts` | modified | `orgCode` on both request types, parser (`readOrgCode`), `memberBase` for the event button and Profile link; still imports nothing | § 4.2 |
| `docker/nginx.conf` | modified | `location /` fallback is `try_files $uri /index.html;` | § 4.3 |
| `src/lib/data/system.ts` | modified | `"tasks"` appended to `MOCK_RESERVED_ORG_CODES`; comment updated | § 4.4 |
| `tests/email-org-links.test.ts` | created | AC-1 to AC-6 | § 4.5 |
| `tests/nginx-spa-fallback.test.ts` | created | AC-7 | § 4.5 |
| `tests/system-reserved-org-codes.test.ts` | created | AC-9 | § 4.5 |
| `tests/e2e/mir-19-e-reserved-tasks.spec.ts` | created | AC-8 | § 4.5 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `supabase/migrations/20261112090000_mir19e_email_org_code.sql:38`, `:148`, `:166` | The `left join` is in `email_notification()`; the two added lines each contain `org`, no other added line does. Four grant lines last, before `commit;` |
| 4.2 | `template.ts:41` (shape), `:52` and `:499` (fields), `:106` (`readOrgCode`), `:115` (`memberBase`), `:138`, `:527` (parsers), `:294` (render), `:564` (invitation) | `orgCode` is spread into the parsed result only when the input had the key. A guest request with a string `orgCode` returns `null` |
| 4.3 | `docker/nginx.conf` `location /` | The comment avoids the literal `$uri/` |
| 4.4 | `src/lib/data/system.ts` `MOCK_RESERVED_ORG_CODES` | 51 tokens, `tasks` last |
| 4.5 | the four test files above | Names start with the AC ID |

## Deviations from the design

none.

## Invariants

`invariants_touched` is `[]`. The migration adds a key to a request body and a `left join` that keeps
every recipient row, so no `where` changes and no entry, portion, approval state or count is read or
written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 61 files, 1211 tests |
| `pnpm exec playwright test tests/e2e/mir-19-e-reserved-tasks.spec.ts tests/e2e/mir-18-b-org-management.spec.ts` | 0 | 8 passed |
| `pnpm exec playwright test` (full) | 0 on rerun | First run: 531 passed, 2 failed (`mir-19-d-flip` AC-5, `tsk-02-overdue-prompt` AC-2; files this ticket does not touch). Both passed on rerun of their files (18 passed), so load flakes at 2 workers |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |

## Testability contract

Selectors used by `tests/e2e/mir-19-e-reserved-tasks.spec.ts` already exist (MIR-18-b): `system-org-new`,
`system-org-create-form`, `system-org-create-code`, `system-org-create-name`, `system-org-create-submit`,
`system-org-create-error`, `system-org-create-cancel`, `system-org-row`. None added or renamed.

## Open questions

The human steps of plan § 6
(apply the migration, redeploy `send-event-email`, the two `TODO(verify)` checks) are untouched.
