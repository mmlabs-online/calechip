---
ticket: MIR-15-d
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T07:54:00Z
inputs_read: [ .ai/board/tickets/MIR-15-d/01-plan.md, .ai/board/tickets/MIR-15-d/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-15-d — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/data/mock.ts` | modified | `public` events are read, joined and notified by the event's own team only (Org public); comment on the directory | § 4.1 (1)-(4) |
| `tests/events.test.ts` | modified | AC-6 retitled to the fence; AC-9 and AC-14 readers moved to own team; one new block for AC-3, AC-8 (join refused for admin on another team's event), AC-9 (re-join refused) | § 4.2 |
| `tests/member-directory-scope.test.ts` | modified | public events no longer reach another team (AC-5, AC-6); (d) and notification-actor points kept on named events (AC-7); listMembers widening via a named event (AC-11) | § 4.2 |
| `tests/event-attendance.test.ts` | modified | seat-fillers/joiners are own-team; AC-16 keeps the cross-team decider on a named event; other team's join refused | § 4.2 |
| `tests/notifications.test.ts` | modified | AC-1 asserts own team notified and other team not (AC-4); AC-4/6/7 joiners are own-team (added `FIXTURE_APPROVED_MEMBER` import) | § 4.2 |
| `tests/event-email.test.ts` | modified | in-app `event_created` read by an own-team recipient, other team has none; AC-3/AC-4 joiners own-team (added import) | § 4.2 |
| `tests/event-invitation.test.ts` | modified | AC-10: other team's address is `sent`, mails nobody, names nobody; own-team address mailed; comment cites plan § 1 | § 4.2 |
| `tests/guest-link.test.ts` | modified | AC-10 attendees own-team; other team moves to the `null` assertions (AC-2) | § 4.2 |
| `tests/guest-registration.test.ts` | modified | AC-14/AC-15 member attendees own-team; other team's member joins the "gets nothing" set | § 4.2 |
| `tests/event-layer.test.ts` | modified | other attendee is an own-team member (added import) | § 4.2 |
| `tests/e2e/evt-02-attendance.spec.ts` | modified | non-attending reader and second requester are `ADMIN` (Team A); `OTHER_TEAM` opens Events and the event is absent (AC-12) | § 4.2 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 (1) `mayReadEvent` | `src/lib/data/mock.ts:818` | `scope === "public" && teamId === mine` |
| 4.1 (2) `isEventAudience` | `src/lib/data/mock.ts:867` | same |
| 4.1 (3) `createEvent` notify | `src/lib/data/mock.ts:3630` | filter is `memberTeamId(id) === row.teamId` |
| 4.1 (4) comments | `src/lib/data/mock.ts:3557` | directory unchanged in code |
| 4.2 census | the test files above | 23 failing vitest blocks all changed; none removed, none skipped |

## Deviations from the design

none in intent. Three detail choices inside the plan's rule, recorded so the reviewer need not rediscover them:

- `tests/events.test.ts`: the new AC-8 admin-join assertion uses an event created by Bob (Team B). `FIXTURE_ADMIN` is on Team A, so on a Team A event the admin is in the audience as a teammate; the "no admin clause" point only shows on another team's event.
- `tests/e2e/evt-02-attendance.spec.ts`: with `ADMIN` as the non-attending reader, `event-attendee-remove` absent is no longer asserted (an admin manages events and is offered it). Replaced by the AC-12 absence check for the other team.
- `tests/event-attendance.test.ts` AC-16: the second requester is named on a `named` event (cross-team decider point kept on a mechanism that still crosses teams), since Team B has only one other member there.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | Its denominator is `listMembers()`, which no edit reaches; `listMemberDirectory` only narrows via `mayReadEvent`. Asserted in `member-directory-scope.test.ts` ("listMembers answers the same for every caller") with a widening named-event connection. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 54 files, 1065 tests (1063 before; +2 from the new block and the split directory test) |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `pnpm e2e` | 1 | 507 passed, 1 failed: `tsk-01-tasks.spec.ts` "AC-13 to AC-15" — **flaky and unrelated**: re-run alone, with the changes in place, it failed once and passed twice; with the changes stashed it passed. It touches tasks and a fixed clock, no event or notification. `evt-02` alone: 11 passed. |

## Testability contract

No selector added or renamed; AC-12 uses the existing `event-row`.

## Open questions

- AC-10 (an other-team address on a public event is accepted and reaches nobody) is transcribed, not decided; plan § 1 sends it to `/idea`.
- The `tsk-01` flake above is outside this ticket's paths.
