---
ticket: EVT-12
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-14T23:19:48+0700
inputs_read:
  - .ai/board/tickets/EVT-12/01-plan.md
  - .ai/board/tickets/EVT-12/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-12 — implementation log

## Files touched

Twelve paths are allowed; eleven are touched in this stage. `.ai/registry/glossary.md` (the
*Limited people* row) was written at PLAN and is already in the PLAN checkpoint commit.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261014090000_evt12_invite_every_scope.sql` | created | The four functions ADR-061 changes, replaced in place with their signatures and grants | § 4.1 |
| `src/lib/data/mock.ts` | modified | The mock reproduces § 4.1: scope branch, member resolution, conversion, silent snapshot, per-row trigger timing | § 4.2 |
| `src/routes/EventDetail.tsx` | modified | Panel on every scope, scope-dependent hint, `onInvited` re-reads the event and its people | § 4.3, § 4.4 |
| `src/routes/EventEditor.tsx` | modified | Invite field and its sending for every scope; hint selector; *Limited people* label | § 4.3, § 4.4 |
| `src/routes/Events.tsx` | modified | The scope badge's label | § 4.3 (AC-14) |
| `.ai/standards/rbac-and-security.md` | modified | The EVT-08 invitation rows amended to § 3, three rows added | § 7 |
| `tests/event-invitation.test.ts` | modified | EVT-08 AC-4's `invitation_not_public` tests replaced by EVT-12 AC-1..AC-13 cases and migration-shape checks | § 3 denials, § 4.1 |
| `tests/event-create-invitation.test.ts` | modified | EVT-09 AC-2's "non-public scope is not invited" reversed by EVT-12 AC-2 | § 4.3 |
| `tests/e2e/evt-01-events.spec.ts` | modified | Asserted the old label | AC-14 |
| `tests/e2e/evt-08-event-invitation.spec.ts` | modified | EVT-08 AC-4's two tests replaced by an `EVT-12` describe | AC-1, AC-4, AC-6, AC-7, AC-10, AC-11, AC-13 |
| `tests/e2e/evt-09-create-invitation.spec.ts` | modified | AC-1 and AC-2 asserted the field hidden and unsent for team and named | AC-2, AC-11 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 `invite_to_event` | `supabase/migrations/20261014090000_evt12_invite_every_scope.sql:51` | `for update`; no scope refusal; the public branch is EVT-08's text with no read of `member` or `auth.users`; the team/named branch inserts the invitation row before the add, sets and clears `calechip.event_conversion` around the conversion |
| 4.1 `email_invitation()` | same file `:185` | One added `if not may_read_event(...) then return new` after the member lookup |
| 4.1 `notify_event_updated()` | same file `:294` | Early return under the setting |
| 4.1 `notify_event_invited()` | same file `:318` | Early return under the setting |
| 4.2 mock `inviteToEvent` | `src/lib/data/mock.ts:3811` | `emailInvitation` runs per row as it is inserted; snapshot pushed without `notify`; `updatedAt` stamped on conversion |
| 4.2 mock `emailInvitation` | `src/lib/data/mock.ts:1111` | Skips a member who cannot read; lookup shared through `approvedMemberByEmail` (`:1094`) |
| 4.3 `inviteHint` | `src/routes/EventDetail.tsx:91` | § 2b's three sentences |
| 4.3 panel on every scope | `src/routes/EventDetail.tsx:363`, `:648` | `event-invite-not-public` removed |
| 4.3 `onInvited` | `src/routes/EventDetail.tsx:222` | Reads `getEvent`, `listEventInvitees`, `getEventGuestLink`, `listEventEmailInvitations`; a null event leaves state |
| 4.3 create form | `src/routes/EventEditor.tsx:101`, `:520`, `:524` | No scope gate; field after the picker; `event-form-invite-hint` |
| 4.3 label | `src/routes/EventEditor.tsx:71`, `src/routes/Events.tsx:24` | *Limited people* |

No field, type or failure code was added. `invitation_not_public` stays in `src/lib/domain/types.ts`
and `src/lib/data/supabase.ts`, unreachable, as § 1 Out of scope says.

## Deviations from the design

none

## Invariants

`invariants_touched: []`. Checked rather than assumed: the migration writes only
`event_email_invitation`, `event_guest_link`, `event.scope` and `event_invitee`, and reads
`member`/`auth.users` only inside the definer function and trigger, returning `sent`/`ignored` alone.
No policy or grant on `public.member` changes, so `listMembers()` — INV-04's denominator — is as it
was; no entry is read or written, so INV-01–07 have nothing to act on. The mock's `inviteToEvent`
touches the same four collections and nothing else.

## Verification run

On `feat/EVT-12`, 2026-10-14:

- `pnpm exec tsc --noEmit` — exit 0
- `pnpm exec eslint .` — exit 0
- `pnpm exec vitest run` — exit 0, 37 files, 726 tests passed
- `pnpm exec playwright test tests/e2e/evt-01-events.spec.ts tests/e2e/evt-08-event-invitation.spec.ts tests/e2e/evt-09-create-invitation.spec.ts`
  — 26 passed, 1 skipped (`evt-09` AC-6 at `:192`, skipped in the file before this ticket). **The
  full Playwright suite was not run**; only the three specs this ticket edits.

The migration is **UNAPPLIED** against a running PostgreSQL; every behaviour above is asserted against
the mock, and the SQL is checked by reading its shape (`tests/event-invitation.test.ts`).
