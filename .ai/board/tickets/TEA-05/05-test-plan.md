---
ticket: TEA-05
stage: QA
agent: qa
produced_at: 2026-09-01T15:33:00+07:00
inputs_read: [ .ai/board/tickets/TEA-05/01-plan.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
---

# TEA-05 Test Plan

Written from sections 1, 2, and 8 of `01-plan.md` only (RULE-05).

## Coverage map

Every AC from the story maps to at least one named test in `tests/e2e/tea-05-sign-in.spec.ts` (and unit tests in `tests/seam-parity.test.ts`).

| AC | Test name | Level | Selectors used |
|---|---|---|---|
| AC-1 | AC-1: a member signs in and lands on the board with name, avatar, and role | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `home-member-name`, `home-member-avatar`, `home-member-role` |
| AC-2 | AC-2: a wrong address and a wrong password are refused identically | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `sign-in-error` |
| AC-3 | AC-3: an unconfirmed address cannot sign in, and is told why | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `sign-in-error` |
| AC-4 | AC-4: a signed-in person with no member row is told they are not on a team | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `not-on-a-team`, `not-on-a-team-sign-out` |
| AC-5 | AC-5: the member-less answer is never given to a caller with no session | e2e | `sign-in-submit`, `not-on-a-team` |
| AC-6 | AC-6: signing out ends the session from Home and from member-less screen | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `home-sign-out`, `not-on-a-team-sign-out` |
| AC-7 | AC-7: a reload keeps the session | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `home-member-name` |
| AC-8 | AC-8: an expired or revoked session lands on sign-in, not on a broken screen | e2e | `sign-in-submit`, `sign-in-email` |
| AC-9 | AC-9: with no session, the application lands on the sign-in screen | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit` |
| AC-10 | AC-10: the allow-list link is shown to an admin and to nobody else | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `home-member-role`, `home-allow-list-link`, `home-sign-out` |
| AC-11 | AC-11: signing in creates, updates and deletes nothing in member roster | e2e | `sign-in-email`, `sign-in-password`, `sign-in-submit`, `not-on-a-team`, `not-on-a-team-sign-out`, `home-sign-out`, `member-list-row` |

## Refusal cases

- **AC-2 Refusal**: An unknown address and a known address with wrong password both produce identical generic refusal text on `sign-in-error`, concealing whether the account exists.
- **AC-3 Refusal**: An unconfirmed address is refused sign-in with specific confirmation notice rather than a wrong-password error.
- **AC-5 Refusal**: A caller without an active session requesting any unauthenticated or landing path is redirected to sign-in and never receives `not-on-a-team` or any roster/allow-list data.
- **AC-10 Refusal**: A caller with role `member` does not see `home-allow-list-link`.
- **AC-11 Refusal**: Signing in with or without a member row performs no writes to `public.member`.

## Invariant probes

| Invariant | Probe test | If absent, why |
|---|---|---|
| INV-04 | `AC-11: signing in creates, updates and deletes nothing in member roster` | — |

## Fixtures

From `src/lib/fixtures.ts` and `supabase/seed.sql`:
- `FIXTURE_ADMIN`: `quan@example.com` (`Quản trị`, `🦉`, `admin`)
- `FIXTURE_MEMBER`: `thanh@example.com` (`Thành viên`, `🐱`, `member`)
- `FIXTURE_MEMBER_LESS`: `hoa@example.com` (`Chưa vào nhóm`, `🐧`, no `member` row)
- `FIXTURE_UNCONFIRMED`: `khanh@example.com` (`Chưa xác nhận`, `🐸`, unconfirmed auth user)
- Non-existent fixture: `khongtontai@example.com`

## Out of scope for this plan

- Expiry simulation in mock: `mock.ts` has no internal token clock. AC-8 token expiry is handled by GoTrue client library against a real database.
- Direct route guarding on `/allow-list` and `/members`: out of scope per plan section 1.
- Schema migrations: `schema_delta: none`.

## Selector gaps

None. All selectors used are defined in section 8 of `01-plan.md`.
