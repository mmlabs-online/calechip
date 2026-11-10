---
ticket: EVT-08
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-12T21:14:02+0700
inputs_read:
  - .ai/board/tickets/EVT-08/01-plan.md
  - .ai/board/tickets/EVT-08/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - supabase/migrations/20261009150000_evt07_guest_registration.sql
  - supabase/functions/send-event-email/template.ts
  - supabase/functions/send-event-email/index.ts
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/EventDetail.tsx
  - tests/guest-link.test.ts
  - tests/event-email.test.ts
  - tests/e2e/evt-06-guest-link.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-08 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261012100000_evt08_event_email_invitation.sql` | created | The table, unique index, definer function, trigger, select policy and grants that are the controls for every permission row in § 3 | § 4.3 |
| `supabase/functions/send-event-email/template.ts` | modified | The second request shape, its parser and its two renderings; the layout extracted into a private `renderLayout` so both mails share it | § 4.4 `template.ts` |
| `supabase/functions/send-event-email/index.ts` | modified | Accept the invitation shape after EVT-05's, render it, log the invitation id and kind, answer with `invitationId` | § 4.4 `index.ts` |
| `src/lib/domain/types.ts` | modified | `EventEmailInvitation`, `EmailInvitationOutcome`, two `FailureCode` members | § 4.1 |
| `src/lib/data/index.ts` | modified | The two seam members | § 4.2 |
| `src/lib/data/supabase.ts` | modified | `inviteToEvent` (rpc) and `listEventEmailInvitations` (table read), row mapper, SQLSTATE mapper, sentences | § 4.2 |
| `src/lib/data/mock.ts` | modified | Reproduces function, trigger and policy; `__sentInvitationEmails`; `deleteEvent` keeps invitations; `__resetEvents` empties them; open-link code shared | § 4.2, § 5 |
| `src/routes/EventDetail.tsx` | modified | `EventInvitePanel`, the managers-only load, `onInvited` re-read, two exported helpers | § 4.5, § 4.6, § 2b |
| `.ai/standards/rbac-and-security.md` | modified | § 3's rows added; two EVT-05 rows that the new trigger made untrue amended in place | § 7 *Standards written by this ticket* |
| `tests/event-invitation.test.ts` | created | AC-1..AC-15 against the mock, the template and the migration's text | § 3 *Denials the tests must assert* |
| `tests/e2e/evt-08-event-invitation.spec.ts` | created | What a person sees: AC-1, 2, 3, 4, 5, 6, 7, 10, 12 | § 4.6 |
| `.ai/board/tickets/EVT-08/03-impl-log.md` | created | This log | gate |

`.ai/registry/glossary.md` is in `allowed_paths` and **was not touched**: the *Email invitation* row was
already written at PLAN (glossary line 56), so `glossary_owed` is met.

## Contract items

| § item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `EventEmailInvitation`, `EmailInvitationOutcome` | `src/lib/domain/types.ts:1185`, `:1196` | Verbatim |
| 4.1 `invalid_invitation_email`, `invitation_not_public` | `src/lib/domain/types.ts:280`, `:282` | Messages verbatim in both implementations |
| 4.2 `inviteToEvent` | `src/lib/data/index.ts:1512`; `supabase.ts:3930`; `mock.ts:3786` | Client check before the round trip in both |
| 4.2 `listEventEmailInvitations` | `src/lib/data/index.ts:1517`; `supabase.ts:3952`; `mock.ts:3831` | Named columns, `created_at desc, id`, bounded and throws at the bound |
| 4.2 `toInvitationFailure` | `src/lib/data/supabase.ts:549` | SQLSTATE only |
| 4.2 mock `emailInvitations`, outbox, `__sentInvitationEmails` | `src/lib/data/mock.ts:1082`, `:1116` | Reset at `:612`; `deleteEvent` sets `eventId` null at `:3328` |
| 4.2 mock opens "through the same code `openEventToGuests` uses" | `src/lib/data/mock.ts:817` (`openGuestLink`) | Extracted from `openEventToGuests`, which now calls it; behaviour unchanged (EVT-06 tests pass) |
| 4.3 table, unique index | migration `:57`, `:71` | |
| 4.3 `invite_to_event` | migration `:86` | Reads neither `public.member` nor `auth.users` — asserted by the unit test on the function's text |
| 4.3 `email_invitation()` and trigger | migration `:151`, `:252` | Whole body in `exception when others`, returns `new` on every path |
| 4.3 policy, grants | migration `:264`, `:275`–`:280` | No insert/update/delete policy or grant; nothing to `anon` |
| 4.4 `InvitationEmailKind`, `parseInvitationEmailRequest`, `renderInvitationEmail` | `template.ts:446`, `:465`, `:509` | Member version delegates to `renderEventEmail` with `event_invited` |
| 4.4 `index.ts` dispatch | `index.ts:107` | Log line names `invitation <id> (<kind>)` only |
| 4.5 load, panel, `onInvited`, helpers | `EventDetail.tsx:115`, `:521`, `:156`, `:73`, `:78` | |

## Deviations from the design

1. **`renderEventEmail`'s body moved into a private `renderLayout`** (`template.ts:294`). The plan says
   no existing export changes, and none did: its signature is the same and its output is **byte-identical**
   — checked by rendering all five kinds, with and without a location, through the HEAD version and this
   one and comparing the JSON (0 differences), and `tests/event-email.test.ts` passes untouched. Done so
   the guest mail keeps EVT-05's layout without a second copy of it.
2. **`toInvitationFailure` also maps `22P02` to `event_not_permitted`**, and the refusal carries a
   sentence the plan did not name: *Invitations could not be sent for this event.* An id that is not a
   uuid must give the same answer as one that does not exist (AC-3); `toGuestLinkFailure` is the
   precedent for both.
3. **`index.ts`'s dispatch binds its result to a variable named `parsed`** with a `to` field, rather than
   the plainer `to` local first written. `tests/event-email.test.ts:581` asserts the mail is sent to
   `parsed.to`; the plan forbids editing that file, and the property it guards (the mail goes to the
   request's own address and nobody else) holds for both shapes, so the code was shaped to keep it
   literally.
4. **The mock's `openEventToGuests` now calls a shared `openGuestLink`** — what § 4.2 asks for ("through
   the same code `openEventToGuests` uses"); listed because it changes an EVT-06 function's body.

No field name was added beyond § 4.

## Invariants

`invariants_touched: []`.

| ID | Still holds because |
|----|---------------------|
| INV-04 | `listMembers()` and every policy and grant on `public.member` are unchanged; the one read of `member`/`auth.users` is inside the definer trigger, returns nothing to a caller. AC-15's unit test asserts `listMembers()` is equal before and after inviting a member's address. |
| INV-01–03, 05–07 | They constrain entries; nothing here reads or writes an entry. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 34 files, 642 tests; `tests/event-invitation.test.ts` 48 of them |
| `pnpm exec playwright test tests/e2e/evt-0` | 0 | 51 passed — EVT-01..08, including this ticket's 6 |
| `node scripts/check-docs.mjs` | 0 | errors 0, warnings 2 (both pre-existing, `features.md`) |
| `git diff --name-only` + untracked ⊆ `allowed_paths` | yes | plus this file in the ticket folder |

**Not run:** the migration against a PostgreSQL, and the Edge Function under Deno. Both are human
(RULE-09), as for EVT-05..07.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `event-invite-panel` | `src/routes/EventDetail.tsx:568` |
| `event-invite-input` | `:577` |
| `event-invite-error` | `:586` |
| `event-invite-submit` | `:595` |
| `event-invite-result` | `:605` |
| `event-invite-sent` (`li[data-email]`) | `:609` |
| `event-invite-ignored` (`li[data-email]`) | `:625` |
| `event-invite-not-public` | `:642` |
| `event-invited-list` | `:647` |
| `event-invited-row` (`data-email`) | `:656` |

## Open questions

- **A manager is not exercised in either suite** — there is no manager fixture, and the plan forbids
  editing fixtures. The refusal rests on `may_manage_event`/`mayManageEvent`, which key on `is_admin`
  and never on `may_decide`, the predicate EVT-06 already tests.
- **`btrim` in the function strips spaces only**, as the table's check does; a direct datastore call
  with an address padded by a tab is refused as EV008 rather than trimmed. The seam splits on all
  whitespace first, so no path through the product reaches it.
- **Human steps after merge:** apply the migration, then `supabase functions deploy send-event-email
  --no-verify-jwt`. Until the redeploy, an invitation's request is a 400 and nothing is mailed; the
  invitation itself still commits.
