---
ticket: EVT-06
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-09T10:38:51+0700
inputs_read:
  - .ai/board/tickets/EVT-06/01-plan.md
  - .ai/board/tickets/EVT-06/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/registry/glossary.md
  - .ai/steward/context.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/routes/EventDetail.tsx
  - src/routes/Events.tsx
  - src/App.tsx
  - tests/event-attendance.test.ts
  - tests/events.test.ts
  - tests/e2e/evt-02-attendance.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-06 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261009120000_evt06_guest_link.sql` | created | The table, three policies, two anon-callable definer reads and their grants, § 4.3 transcribed with a header in EVT-05's shape | § 4.3 |
| `src/lib/domain/types.ts` | modified | `EventGuestLink`, `GuestEvent`, `GUEST_LINK_TOKEN_PATTERN` under a new EVT-06 banner | § 4.1 |
| `src/lib/data/index.ts` | modified | The four seam functions on `DataSeam`, plus the two type imports | § 4.2 |
| `src/lib/data/mock.ts` | modified | The four functions reproducing the policies and definer reads; the link store; `deleteEvent`'s cascade and `__resetEvents` clear it | § 4.2 (mock paragraph), § 5 |
| `src/lib/data/supabase.ts` | modified | The four functions as table calls and two `rpc`s; row types, mappers, refusal sentences and SQLSTATE mapper | § 4.2 (supabase paragraph) |
| `src/routes/GuestEvent.tsx` | created | The guest page, its two `<meta>` tags, and `guestSeatsLabel` for the unit test | § 4.4, § 2b |
| `src/routes/EventDetail.tsx` | modified | `EventGuestPanel` for managers, the link loaded only for them, and `guestLinkUrl` | § 4.4, § 2b |
| `src/App.tsx` | modified | `/guest/:token` inside the first `BareLayout`, no guard | § 4.4 |
| `.ai/standards/rbac-and-security.md` | modified | The guest-link rows in § *The permission table* and the signed-out note (the anon role's first rows) | § 7 *Standards written by this ticket* |
| `tests/guest-link.test.ts` | created | Every data-side AC through the mock, and the migration read for AC-6, AC-12 and AC-14's shape | § 3 *Denials the tests must assert* |
| `tests/e2e/evt-06-guest-link.spec.ts` | created | What a person sees on the panel and the guest page, AC-1 to AC-18 | § 4.5 |
| `.ai/board/tickets/EVT-06/03-impl-log.md` | created | This log | gate |

`.ai/registry/glossary.md` is in `allowed_paths` and was **not touched**: the *Guest link* row was
written at PLAN and is already committed on this branch (`55fbd4b`, `glossary.md:53`).

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `EventGuestLink` | `src/lib/domain/types.ts:1077` | verbatim |
| 4.1 `GuestEvent` | `src/lib/domain/types.ts:1087` | verbatim; exactly the eight keys AC-12 lists |
| 4.1 `GUEST_LINK_TOKEN_PATTERN` | `src/lib/domain/types.ts:1104` | verbatim |
| 4.2 `getEventGuestLink` | `index.ts:1437`, `mock.ts:3341`, `supabase.ts:3508` | supabase: 42501/PGRST301/22P02 → null, so a signed-out caller gets null (AC-14) rather than a throw |
| 4.2 `openEventToGuests` | `index.ts:1442`, `mock.ts:3350`, `supabase.ts:3525` | sends `{ event_id }` only; 23505 reads back via `getEventGuestLink`, null read-back → `event_not_permitted` |
| 4.2 `closeEventToGuests` | `index.ts:1446`, `mock.ts:3363`, `supabase.ts:3545` | zero rows back → `event_not_permitted` |
| 4.2 `getGuestEvent` | `index.ts:1454`, `mock.ts:3374`, `supabase.ts:3563` | pattern check before any round trip; `seatsTaken` from `get_guest_event`; attendee read `.limit(DATASTORE_MAX_ROWS)` and throws at the bound |
| 4.2 mock `deleteEvent` cascade | `mock.ts:3120` | and `__resetEvents` at `mock.ts:595` |
| 4.3 table, check, unique, cascade | migration § 1 | as § 4.3 |
| 4.3 three policies | migration § 2 | `to authenticated`, `may_manage_event(event_id, (select auth.uid()))` |
| 4.3 `get_guest_event`, `list_guest_event_attendees` | migration § 3 | as § 4.3, character for character in the statements |
| 4.3 grants | migration § 4 | as § 4.3 |
| 4.4 route | `src/App.tsx:151` | inside the `BareLayout` beside `/signup` |
| 4.4 `GuestEvent` default export | `src/routes/GuestEvent.tsx:54` | states `loading` / `ready` / `missing`; a thrown read is `missing` |
| 4.4 `<meta>` on mount, removed on unmount | `src/routes/GuestEvent.tsx:34` | `useGuestMeta` |
| 4.4 `guestSeatsLabel` | `src/routes/GuestEvent.tsx:26` | |
| 4.4 load only for managers | `src/routes/EventDetail.tsx:86` | see Deviations 1 |
| 4.4 `EventGuestPanel` | `src/routes/EventDetail.tsx:292`, rendered at `:239` when `canEdit` | |
| 4.4 `guestLinkUrl` | `src/routes/EventDetail.tsx:56` | |

## Deviations from the design

1. **The link read is not in `EventDetail`'s `Promise.all`; it runs after it.** § 4.4 says the load
   "adds `seam.getEventGuestLink(id)` to its `Promise.all` only when `mayEditEvent(event, me)`". The
   predicate needs `event` and `me`, which are that `Promise.all`'s own results, so the call cannot be
   inside it. It runs straight after, under the same predicate (`EventDetail.tsx:86`). What § 4.4
   needs — a non-manager makes no extra call (AC-18) — holds. The cost is one sequential round trip
   for a manager.
2. **Two refusal sentences the plan did not write.** § 4.1 reuses the `event_not_permitted` code and
   says "whose sentence already fits", without naming which sentence. The two existing ones are
   *"This event could not be saved."* and *"…could not be deleted."*, and neither describes opening
   or closing a link. So `EVENT_GUEST_OPEN_REFUSED` (*"This event could not be opened to guests."*) and
   `EVENT_GUEST_CLOSE_REFUSED` (*"The guest link could not be closed."*) are new, repeated verbatim
   in both seams in the usual way. Neither says whether the event exists. No new code, field or type.
3. **`openEventToGuests` and `closeEventToGuests` map 22P02 and 23503 to `event_not_permitted` in the
   supabase seam** (`toGuestLinkFailure`). § 4.2 names only 42501 and 23505. A non-uuid id (22P02)
   or a deleted event (23503) is otherwise `unknown`, and a different sentence there would show
   which event ids exist. `deleteEvent` already treats 22P02 this way.
4. **Copy the plan did not write:** the clipboard-refused line (*"Copying is blocked here. Select the
   address and copy it yourself."*, AC-8) and *"Nobody has joined yet."* (AC-10). § 2 states what each
   one has to say and gives no wording. Both are in English, with no diacritics.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The migration has no statement on `public.member`: no policy, grant or column. `tests/guest-link.test.ts` asserts that `on public.member` does not appear in its SQL. The only path from the anon key to a name is `list_guest_event_attendees`, a definer function that returns one `text` column, and only for an open event's token. `listMembers()` is unchanged in both seams. AC-18's test snapshots `listMembers`, `listMemberDirectory`, `listEvents`, `getEvent` and `listEventAttendance` for five callers before opening, after opening and after closing, and all three snapshots are equal. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint <every touched .ts/.tsx>` | 0 | nine files |
| `pnpm exec eslint .` | **1** | **One error, and it is not in this ticket:** `scripts/check-allowed-paths.mjs:144` `no-useless-assignment` (`let fm = {}` is overwritten in `try`/`catch`). It came in with `53dad58` (ADR-054) and is already on `main`. The file is outside `allowed_paths`, so RULE-03 stops this stage from fixing it. See Open questions 1 |
| `pnpm exec vitest run` | 0 | 32 files, 567 tests |
| `pnpm exec playwright test tests/e2e/evt-06-guest-link.spec.ts` | 0 | 8 tests, including the seam guard |
| `pnpm exec playwright test` (full) | 1 | 334 passed, 20 failed, 1 flaky. **All 20 failures are in specs this ticket does not touch, and they fail the same way with this ticket's changes stashed** (`git stash -u`, same command): `adm-02-holidays` ×10, `adm-03-holiday-writes` ×2, `adm-01` AC-13, `adm-04` AC-10/12, `uie-09-admin-hub` ×3, `uie-10-sidebar` ×3, `cal-06-year-view` AC-12. `evt-02-attendance` AC-28 (the event form) was flaky both with and without the changes. See Open questions 2 |
| `node scripts/check-allowed-paths.mjs` | 0 | It checks committed changes. Every uncommitted path listed in `git status --porcelain` is in `allowed_paths` or in the ticket folder |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `event-guest-panel` | `src/routes/EventDetail.tsx:345` |
| `event-guest-open-button` | `src/routes/EventDetail.tsx:404` |
| `event-guest-link` | `src/routes/EventDetail.tsx:355` |
| `event-guest-copy-button` | `src/routes/EventDetail.tsx:364` |
| `event-guest-copied` | `src/routes/EventDetail.tsx:372` |
| `event-guest-close-button` | `src/routes/EventDetail.tsx:391` |
| `event-guest-close-confirm` | `src/routes/EventDetail.tsx:437` |
| `event-guest-close-cancel` | `src/routes/EventDetail.tsx:429` |
| `event-guest-close-modal` (from `Modal`'s `testIdPrefix`) | `src/routes/EventDetail.tsx:416` |
| `event-guest-error` | `src/routes/EventDetail.tsx:383` (panel), `:423` (inside the close confirmation, where the panel's copy is hidden) |
| `guest-event` | `src/routes/GuestEvent.tsx:101` |
| `guest-event-name` | `src/routes/GuestEvent.tsx:102` |
| `guest-event-dates` | `src/routes/GuestEvent.tsx:106` |
| `guest-event-location` | `src/routes/GuestEvent.tsx:111` |
| `guest-event-description` | `src/routes/GuestEvent.tsx:118` |
| `guest-event-seats` | `src/routes/GuestEvent.tsx:126` |
| `guest-event-attendees` | `src/routes/GuestEvent.tsx:134` |
| `guest-event-attendee` | `src/routes/GuestEvent.tsx:146` |
| `guest-event-attendees-empty` | `src/routes/GuestEvent.tsx:137` |
| `guest-event-not-found` | `src/routes/GuestEvent.tsx:85` |

## Open questions

1. **`pnpm exec eslint .` fails on `main` today**, on `scripts/check-allowed-paths.mjs:144`. The fix is
   one line: `let fm;` in place of `let fm = {};`. It belongs on an `ops/` branch or with `/thuki`,
   not on this ticket. This gate counts lint as passed because every file the ticket touched lints
   clean. A reviewer who reads "lint exits 0" literally will find this line and should know it
   predates the branch.
2. **Twenty e2e tests fail on the base commit**, mostly holidays, sidebar and admin-hub. They were
   not investigated, because they fail identically without this ticket. They look like they depend
   on today's date (2026-10-09) or on a sidebar change, but that is a guess, not something checked.
   This is worth a bug ticket.
3. **The mock's `getGuestEvent` does not throw at `DATASTORE_MAX_ROWS`.** The mock's
   `listEventAttendance` does not either. Only the supabase seam carries the bound, as § 4.2
   specifies for it.
4. **Not proved against PostgreSQL**, as the plan's § 3 already says. That covers the migration's
   grants, the definer functions' behaviour for `anon`, and the concurrent-open race (AC-6) under
   the primary key. The project-wide permission-model test is still owed. Applying the migration is
   human (RULE-09).
