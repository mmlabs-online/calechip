---
ticket: EVT-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-29T15:53:05+0700
inputs_read:
  - .ai/board/tickets/EVT-02/01-plan.md
  - .ai/board/tickets/EVT-02/ticket.yaml
  - .ai/steward/context.md
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - .ai/board/tickets/EVT-01/03-impl-log.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/roles.ts
  - src/lib/ui-language.json
  - src/routes/EventDetail.tsx
  - src/routes/EventEditor.tsx
  - src/routes/Events.tsx
  - src/components/Modal.tsx
  - src/index.css
  - eslint.config.js
  - playwright.config.ts
  - tests/events.test.ts
  - tests/e2e/evt-01-events.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-02 — implementation log

## Files touched

Eleven files, exactly `allowed_paths`. `git status --porcelain` also shows `.ai/board/backlog.md`,
the idea file and `.ai/board/tickets/EVT-02/` — those were dirty before this stage (PLAN, /advance)
and this stage did not touch them other than writing this file.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260929140000_evt02_attendance.sql` | created | The enum, three columns and two constraints on `event`, the attendance table, three helpers, `save_event` recreated, both guards, one replaced and four new policies, the grants — every control this ticket has | § 4.4, § 3, § 6 |
| `src/lib/domain/types.ts` | modified | Three `CalEvent` fields, `AttendanceStatus`, `EventAttendance`, eight `FailureCode` members | § 4.1 |
| `src/lib/event-registration.ts` | created | `eventToday` and `registrationOpen` — the mock's reproduction of `event_registration_open` and the screen's affordance | § 4.2 |
| `src/lib/data/index.ts` | modified | Three optional `SaveEventInput` fields and the four new `DataSeam` functions | § 4.3 |
| `src/lib/data/supabase.ts` | modified | Selects and maps the three columns, passes them to `save_event`, two more seam-side refusals, EV003 mapping; the four functions and `toAttendanceFailure` | § 4.3, § 5 |
| `src/lib/data/mock.ts` | modified | Reproduces every predicate and trigger of § 4.4; `mayReadEvent` gains the participant clause; `__resetEvents` empties attendance; delete cascades | § 4.3, § 5 |
| `src/components/EventAttendancePanel.tsx` | created | Seats, deadline, join panel, requests, attendees, and the leave/remove confirmations | § 2 AC-27, AC-29; § 2b; § 4.5 |
| `src/routes/EventDetail.tsx` | modified | Mounts the panel beneath EVT-01's fields | § 2 AC-27 |
| `src/routes/EventEditor.tsx` | modified | The three fields between dates and scope; the edit form opens with the current values; always sends all three | § 2 AC-1, AC-28; § 4.5 |
| `tests/event-attendance.test.ts` | created | Every data-property AC (1–26) against the mock, plus the migration read for the lock, the grants and the untouched `member` policies | § 3 *Where this plan cannot be verified today* |
| `tests/e2e/evt-02-attendance.spec.ts` | created | What a person sees: AC-1, 2, 3, 6, 7, 8, 10, 11, 14, 16, 17, 21, 22, 27, 28, 29 | § 4.5 |

`tests/events.test.ts` and `tests/e2e/evt-01-events.spec.ts` pass unedited — § 7's check that the
contract broke no caller.

## Contract items

| Plan item | Implemented at | Notes |
|-----------|----------------|-------|
| § 4.1 `CalEvent` three fields | `src/lib/domain/types.ts:992` | |
| § 4.1 `AttendanceStatus`, `EventAttendance` | `src/lib/domain/types.ts:1018`, `:1022` | |
| § 4.1 eight `FailureCode` members | `src/lib/domain/types.ts:250`–`:266` | |
| § 4.2 `eventToday`, `registrationOpen` | `src/lib/event-registration.ts:25`, `:32` | |
| § 4.3 `SaveEventInput` optional fields | `src/lib/data/index.ts:237` | |
| § 4.3 four `DataSeam` functions | `src/lib/data/index.ts:1339`–`:1352` | |
| § 4.3 two new seam-side checks | `src/lib/data/supabase.ts:171`; mock's `eventInputFailure` | Capacity then deadline, after EVT-01's two |
| § 4.3 23514 told apart by input; EV003 | `src/lib/data/supabase.ts:204`–`:220` | |
| § 5 `toAttendanceFailure` | `src/lib/data/supabase.ts:302` | See Deviations 3 |
| § 5 supabase four functions | `src/lib/data/supabase.ts:3125`, `:3152`, `:3171`, `:3207` | |
| § 5 mock four functions | `src/lib/data/mock.ts:2911`, `:2927`, `:2949`, `:2971` | No `await` between check and write |
| § 5 mock `mayReadEvent` participant clause | `src/lib/data/mock.ts` `mayReadEvent`; `isEventParticipant` `:684` | |
| § 4.4 enum, columns, constraints, table | migration `:54`, `:59`, `:66`, `:73`, `:78` | |
| § 4.4 `event_registration_open`, `is_event_audience`, `is_event_participant` | migration `:100`, `:112`, `:129` | `is_event_audience` has no `is_admin` |
| § 4.4 `save_event` dropped by old signature, recreated | migration `:147`, `:149` | Body is EVT-01's plus three columns |
| § 4.4 `event_attendance_guard` | migration `:232` | First statement is the `for update` lock; see Deviations 1, 2 |
| § 4.4 `event_capacity_guard` | migration `:301` | `before update of capacity` |
| § 4.4 five policies | migration `:332`, `:352`, `:366`, `:376`, `:384` | |
| § 4.4 grants | migration `:403`–`:423` | `member_id`, `status` withheld from insert |

## Deviations from the design

1. **`event_attendance_guard` raises two refusals on INSERT that § 4.4 leaves to the policy and the
   primary key**, and raises them first: `42501` when the event is missing or the caller is not in
   its audience, then `23505` when the caller already has a row. Without them the guard, which runs
   before the `WITH CHECK` and before the unique index, would answer an outsider's join on a closed
   event with `EV002` — telling someone who cannot read an event that it exists and is closed — and
   would answer a removed person's rejoin of a full event with `EV001` instead of *already on it*.
   The policy and the primary key remain the controls; the guard only orders the answers. The mock
   reproduces the same order (audience → existing → closed → full).
2. **"Only `status` changed" is written as: `event_id`, `member_id` and `created_at` unchanged.**
   `updated_at` is set by the guard itself, so it cannot be in the comparison. Only `status` is
   granted for update anyway; this is defence in depth.
3. **`toAttendanceFailure` maps `22P02` (malformed id) and `23503` (no such event) to
   `attendance_not_permitted`** as well as § 5's list — the same "does not confirm the event exists"
   answer EVT-01's `getEvent` gives a malformed id.
4. **Two selectors beyond § 4.5:** `event-attendance` (the panel wrapper) and
   `event-attendance-error` (the `role="alert"` line for a refused join, leave or decision). § 4.5
   says none others are *required*; neither replaces a listed one.
5. **The panel sits after EVT-01's named list, not between the description and it.** § 2b says
   "beneath the description"; EVT-01's AC-22 order (which ends with the named list) is kept intact
   and the attendance block follows it.
6. **One extra line on the detail page** — *· Joining needs approval* beside the deadline when the
   mode is on. AC-1 requires the detail page to "show each of" the three values, and without it the
   mode was only inferable from the join button's wording, which is absent for someone already on
   the event.
7. **Form layout:** the switch is a checkbox with `role="switch"`; at `sm` width the grid puts Seats
   and Registration closes side by side (§ 2b) with the switch spanning the row below via CSS
   `order`, while the DOM order stays capacity → approval → deadline (AC-28, asserted in the e2e).

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The only people-read added is `event_attendance`, which carries five fields (event id, member id, state, two timestamps) and no role, team, membership status or `removed_at`; names resolve through EVT-01's `listMemberDirectory()`. No policy on `public.member` is created, dropped or replaced — `tests/event-attendance.test.ts` "AC-23: the migration touches no policy on public.member" reads the file with comments stripped — and `listMembers()` returns the same rows before and after a cross-team join (AC-23 test). |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 27 files, 454 tests |
| `pnpm exec playwright test` | 0 | 306 passed, including the 11 new and EVT-01's 11 unedited |
| `node scripts/check-docs.mjs` | 0 | errors 0, warnings 2, pending 7 — none from this ticket's files |
| `git status` subset of `allowed_paths` | yes | plus the pre-existing board files named above |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `event-capacity-input` | `src/routes/EventEditor.tsx:319` |
| `event-approval-input` | `src/routes/EventEditor.tsx:332` |
| `event-deadline-input` | `src/routes/EventEditor.tsx:345` |
| `event-seats` (`data-taken`, `data-capacity`) | `src/components/EventAttendancePanel.tsx:146` |
| `event-deadline` (`data-open`) | `src/components/EventAttendancePanel.tsx:154` |
| `event-my-status` (`data-status`) | `src/components/EventAttendancePanel.tsx:166` |
| `event-leave-button` | `src/components/EventAttendancePanel.tsx:171` |
| `event-join-button` | `src/components/EventAttendancePanel.tsx:187` |
| `event-requests` | `src/components/EventAttendancePanel.tsx:206` |
| `event-request` (`data-member-id`) | `src/components/EventAttendancePanel.tsx:212` |
| `event-request-approve` | `src/components/EventAttendancePanel.tsx:221` |
| `event-request-reject` | `src/components/EventAttendancePanel.tsx:231` |
| `event-attendees` | `src/components/EventAttendancePanel.tsx:247` |
| `event-attendees-empty` | `src/components/EventAttendancePanel.tsx:250` |
| `event-attendee` (`data-member-id`) | `src/components/EventAttendancePanel.tsx:258` |
| `event-attendee-remove` | `src/components/EventAttendancePanel.tsx:265` |
| `event-leave-*` (Modal prefix), `event-leave-cancel`, `event-leave-confirm` | `src/components/EventAttendancePanel.tsx:297`, `:308`, `:316` |
| `event-remove-*` (Modal prefix), `event-remove-cancel`, `event-remove-confirm` | `src/components/EventAttendancePanel.tsx:333`, `:342`, `:350` |

## Open questions

1. **The migration has not run against PostgreSQL, and the concurrency test ADR-045 revert
   condition 2 wants is owed.** The mock proves the decision; the lock is asserted only by reading
   the SQL (guard's `for update` precedes its count). Both are stated in the migration header.
2. **`SaveEventInput`'s three fields are optional and absent means the default — including on
   `updateEvent`.** A caller that edits an event without sending them resets capacity, mode and
   deadline, because `save_event` replaces every field. That is § 4.3's contract as written, and
   the only caller (`EventEditor`) always sends all three; a future caller must too.
3. **Owed to `/thuki`, not this ticket** (§ 6): the attendance rows in
   `.ai/standards/rbac-and-security.md` and the table and columns in `.ai/standards/data-model.md`.
