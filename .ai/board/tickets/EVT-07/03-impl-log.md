---
ticket: EVT-07
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-09T11:40:04+0700
inputs_read:
  - .ai/board/tickets/EVT-07/01-plan.md
  - .ai/board/tickets/EVT-07/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/registry/glossary.md
  - .ai/steward/context.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/event-registration.ts
  - src/components/EventAttendancePanel.tsx
  - src/components/Modal.tsx
  - src/routes/GuestEvent.tsx
  - src/routes/EventDetail.tsx
  - src/routes/EventEditor.tsx
  - src/App.tsx
  - tests/guest-link.test.ts
  - tests/e2e/evt-06-guest-link.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-07 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261009150000_evt07_guest_registration.sql` | created | The enum, `event_guest`, its guard and trigger, the four replaced functions, the five new definer functions, two policies and the grants — § 4.3 transcribed | § 4.3, § 6 |
| `src/lib/domain/types.ts` | modified | `GuestStatus`, `EventGuest`, `GuestRegistrationTerms`, `GuestRegistrationReceipt`, `GuestRegistrationView`, the three AC-4 constants, five `FailureCode` members | § 4.1 |
| `src/lib/data/index.ts` | modified | The six seam functions on `DataSeam` under an EVT-07 banner, and their type imports | § 4.2 |
| `src/lib/data/mock.ts` | modified | The guest table reproduced (hash only), the guard/policies/definer functions as six functions; `seatsTaken` counts guests; `deleteEvent` sets guests' event null; `getGuestEvent` merges guest names | § 4.2 (mock paragraph), § 5 |
| `src/lib/data/supabase.ts` | modified | The six functions as four `rpc`s and two table calls on `event_guest` with the granted column list; `toGuestFailure` on SQLSTATE | § 4.2 (supabase paragraph) |
| `src/routes/GuestEvent.tsx` | modified | Terms read beside `getGuestEvent`; `GuestRegisterPanel`; the manage page `GuestRegistration`; `guestManageUrl`, `guestRegistrationProblem` | § 4.4, § 2b |
| `src/components/EventAttendancePanel.tsx` | modified | Loads `listEventGuests`; guests merged into Requests and Going by join order and counted; approve/reject/remove through `decideGuest`; the remove modal | § 4.4, § 2b |
| `src/App.tsx` | modified | `/guest/registration/:token` beside `/guest/:token` in the same `BareLayout`, no guard | § 4.4 |
| `.ai/standards/rbac-and-security.md` | modified | Ten guest rows in the permission table; the *Signed out* paragraph corrected from two functions to six, the old wording kept as an amendment note | § 7 *Standards written by this ticket* |
| `tests/guest-registration.test.ts` | created | AC-1..AC-22 through the mock, and the migration read for the lock, grants, hash and `set null` | § 3 *Denials the tests must assert* |
| `tests/e2e/evt-07-guest-registration.spec.ts` | created | What a guest, the creator and a teammate see: register, copy, manage, cancel, request, approve, email visibility, remove, not-found | § 4.5 |
| `.ai/board/tickets/EVT-07/03-impl-log.md` | created | This log | gate |
| `.ai/board/tickets/EVT-07/ticket.yaml` | modified | `state: REVIEW` | gate |

`.ai/registry/glossary.md` is in `allowed_paths` and was **not touched**: the *Guest* row was written
at PLAN and is already committed on this branch (`e891083`, `glossary.md:54`).

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `GuestStatus`, `EventGuest`, `GuestRegistrationTerms`, `GuestRegistrationReceipt`, `GuestRegistrationView` | `src/lib/domain/types.ts:1124-1166` | Verbatim from § 4.1 |
| 4.1 `GUEST_NAME_MAX`, `GUEST_EMAIL_MAX`, `GUEST_EMAIL_PATTERN` | `src/lib/domain/types.ts:1169-1171` | |
| 4.1 five `FailureCode` members | `src/lib/domain/types.ts:267-277` | Appended after `attendance_not_permitted`, before `unknown` |
| 4.2 six `DataSeam` functions | `src/lib/data/index.ts:1472-1495` | Same names and arity in both implementations (seam-parity test passes) |
| 4.2 mock | `src/lib/data/mock.ts:3510-3660`; table `:827`; `seatsTaken` `:735`; `deleteEvent` `:3213` | Token from `crypto.getRandomValues`, stored as `crypto.subtle` SHA-256; the one `await` (the digest) precedes check-and-write |
| 4.2 supabase | `src/lib/data/supabase.ts:3719-3855`; `toGuestFailure` `:472` | `select("*")` never used on `event_guest` |
| 4.3 table, index, RLS | migration `:61-84` | |
| 4.3 `event_guest_guard` + trigger | migration `:92-186` | Lock is the first statement after the `set null` branch |
| 4.3 replaced `event_attendance_guard`, `event_capacity_guard` | migration `:192-279` | EVT-02 bodies verbatim plus the guest count |
| 4.3 replaced `get_guest_event`, `list_guest_event_attendees` | migration `:284-321` | Same signatures; not re-granted |
| 4.3 five new functions | migration `:329-442` | |
| 4.3 policies | migration `:454-473` | |
| 4.3 grants | migration `:480-499` | |
| 4.4 route | `src/App.tsx:157` | |
| 4.4 guest page, `GuestRegisterPanel`, `GuestRegistration`, `guestManageUrl`, `guestRegistrationProblem` | `src/routes/GuestEvent.tsx:47, 53, 120, 253, 451` | |
| 4.4 panel | `src/components/EventAttendancePanel.tsx:158, 192` | `EventDetail.tsx` unchanged |

## Deviations from the design

Three, each inside latitude § 4.3 gives the Developer ("the Developer writes the SQL"), declared so the
reviewer does not have to find them:

1. **`cancel_guest_registration` raises `EV002` for a registration whose event was deleted**, before
   the update. Without it the guard's lock finds no event and raises `EV004`, which the seam would map
   to *guest_link_not_found* — a wrong sentence for a link that does work. The manage page draws no
   cancel control for a deleted event (AC-20), so this only shapes the direct-to-datastore answer. The
   mock does the same (`mock.ts:3601`).
2. **`register_guest` checks name, then email, then the token**, in § 4.3's order; the **seam** checks
   the token's *shape* first, as § 4.2's docblock orders it ("a token failing the pattern is
   `guest_link_not_found` with no round trip"). A well-shaped dead token with a bad name therefore
   answers `invalid_guest_name` from both the seam and the database.
3. **`decideGuest` refuses with the sentence "This guest's place could not be changed."**, not EVT-02's
   "This request could not be changed.", because the same function also removes an attending guest.
   The code is `attendance_not_permitted` as § 3 requires.

`event_name` is the snapshot taken at registration (§ 4.3: "written by the guard from the event at
insert"). AC-20 says the manage page shows "the event's name as it was"; after a rename followed by a
delete it shows the name at registration time. Recorded under *Open questions*.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | Guests live in `event_guest`, which has no reference to `public.member` and no column a member read touches; the migration creates, drops or replaces no policy or grant on `public.member` (asserted: `guest-registration.test.ts` AC-19 greps the migration for `on public.member` and `references public.member`). `listMembers`, `listMemberDirectory` and `listEventAttendance` return identical results before and after a registration for a member, a teammate and an admin (AC-19 test). No entry is read or written, so the absence count's numerator is untouched too. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm exec eslint .` | **1** | **One error, not this ticket's:** `scripts/check-allowed-paths.mjs:144` `no-useless-assignment` (`let fm = {};`), present on `main` since `53dad58`. Outside `allowed_paths`, so RULE-03 forbids the one-line fix here. `npx eslint src tests` — every file this ticket touched — exits 0. |
| `pnpm test` | 0 | 33 files, 590 tests; the 568 that existed before pass unchanged |
| `npx playwright test` evt-02, evt-06, evt-07 specs | 0 | 23 passed — EVT-02's and EVT-06's suites unchanged and green |
| `node scripts/check-allowed-paths.mjs EVT-07` | 0 | PASS |
| `pnpm docs:audit` | 0 | errors 0 |

The migration was **not** applied to any database (RULE-09). The permission-model and concurrency
tests against a real PostgreSQL stay owed, as the migration header says.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `guest-register` | `src/routes/GuestEvent.tsx:358, 370, 381` |
| `guest-register-name`, `-email`, `-error`, `-submit` | `src/routes/GuestEvent.tsx:390, 401, 410, 415` |
| `guest-register-closed`, `guest-register-full` | `src/routes/GuestEvent.tsx:360, 372` |
| `guest-registered`, `guest-registered-status` (`data-status`) | `src/routes/GuestEvent.tsx:308, 311` |
| `guest-manage-link`, `guest-manage-copy-button`, `guest-manage-copied` | `src/routes/GuestEvent.tsx:327, 336, 344` |
| `guest-registration`, `-event`, `-dates`, `-location`, `-name`, `-status` (`data-status`) | `src/routes/GuestEvent.tsx:559, 560, 568, 574, 583, 588` |
| `guest-registration-cancel-button`, `guest-cancel-confirm`, `guest-cancel-cancel` | `src/routes/GuestEvent.tsx:607, 524, 516` (modal `testIdPrefix="guest-cancel"` `:508`) |
| `guest-registration-error` | `src/routes/GuestEvent.tsx:599` |
| `guest-registration-not-found` | `src/routes/GuestEvent.tsx:492` |
| `event-guest-attendee` (`data-guest-id`), `event-guest-attendee-remove` | `src/components/EventAttendancePanel.tsx:361, 368` |
| `event-guest-remove-confirm`, `event-guest-remove-cancel` | `src/components/EventAttendancePanel.tsx:506, 498` (modal `:485`) |
| `event-guest-request` (`data-guest-id`), `-approve`, `-reject` | `src/components/EventAttendancePanel.tsx:281, 290, 300` |
| `event-guest-email` | `src/components/EventAttendancePanel.tsx:98` |

`event-seats`' `data-taken` counts guests (`EventAttendancePanel.tsx:192`).

## Open questions

1. **AC-20's "name as it was"** — the stored name is the one at registration, not at deletion. Making
   it the name at deletion needs a `before delete` trigger on `event` writing `event_guest.event_name`,
   which § 4.3 does not name. Cheap to add in a later ticket if the difference matters.
2. **The pre-existing lint error** in `scripts/check-allowed-paths.mjs:144` makes the repository's lint
   command exit 1 on any branch from `main`. It needs a chore outside this ticket.
