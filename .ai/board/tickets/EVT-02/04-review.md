---
ticket: EVT-02
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-29T15:58:39+0700
inputs_read: [ .ai/board/tickets/EVT-02/01-plan.md, .ai/board/tickets/EVT-02/03-impl-log.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

# EVT-02 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | **Committed:** nothing is committed on the branch — `git diff --name-only origin/main...HEAD` is empty. **Uncommitted:** `node scripts/check-carry.mjs EVT-02` exits 0 | PASS | `check-carry: ticket EVT-02, 16 uncommitted path(s)` … `check-carry: PASS — nothing stray`, exit 0. Carried: `.ai/board/backlog.md` (ship-owned), the promoting idea file, the three ticket files, and the eleven `allowed_paths` (`ticket.yaml:37-48`) |
| R2 | typecheck exit 0, whole program | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint` on the ten changed `.ts`/`.tsx` files → exit 0; repo-wide `pnpm exec eslint .` → exit 0, nothing outside the diff to route |
| R4 | Nothing outside the seam reaches the datastore | PASS | Every datastore call is in `src/lib/data/supabase.ts:3125`, `:3152`, `:3171`, `:3207`; the screens import only `seam` — `src/components/EventAttendancePanel.tsx:18`, `src/routes/EventDetail.tsx:19`, `src/routes/EventEditor.tsx:27`. `grep` for `supabase-js`, `createClient`, `.rpc(`, `from("event` under `src/` outside `src/lib/data/` returns nothing; `eslint.config.js:64` holds the rule and R3 is clean |
| R5 | Every contract item in plan § 4 is implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | `supabase/migrations/20260929140000_evt02_attendance.sql:352-391` (the four policies), `:401-407` (grants: `member_id` and `status` withheld from insert, only `status` updatable), `:112-125` (`is_event_audience`, no `is_admin`), `:378` (`may_manage_event`, never `may_decide`), `:238` (the `for update` lock), `:267-274` (transitions). Affordances sit over them: `src/components/EventAttendancePanel.tsx:55-66`, `:129`, `:205`, `:224`, `:263`; `src/routes/EventDetail.tsx:215` with `mayEditEvent` at `src/routes/EventDetail.tsx:44-46` |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main -- package.json pnpm-lock.yaml` is empty. New imports are in-repo or existing (`date-fns`, `react`) — `src/components/EventAttendancePanel.tsx:16-22` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `CalEvent.capacity`, `requiresApproval`, `registrationDeadline` | `src/lib/domain/types.ts:992-996` | Yes |
| § 4.1 `AttendanceStatus` | `src/lib/domain/types.ts:1018` | Yes — the enum's four values |
| § 4.1 `EventAttendance` (five fields) | `src/lib/domain/types.ts:1022-1028` | Yes |
| § 4.1 eight `FailureCode` members | `src/lib/domain/types.ts:250-266` | Yes, all eight names |
| § 4.2 `eventToday(now?)` | `src/lib/event-registration.ts:25` | Yes (defaulted parameter) |
| § 4.2 `registrationOpen(event, today)` | `src/lib/event-registration.ts:32` | Yes |
| § 4.3 `SaveEventInput` three optional fields | `src/lib/data/index.ts:237-241` | Yes |
| § 4.3 `listEventAttendance`, `joinEvent`, `leaveEvent`, `decideAttendance` on `DataSeam` | `src/lib/data/index.ts:1339`, `:1343`, `:1348`, `:1352` | Yes; `tests/seam-parity.test.ts` passes unedited |
| § 4.3 two new seam-side checks, after EVT-01's two | `src/lib/data/supabase.ts:171-183`; mock `eventInputFailure` in `src/lib/data/mock.ts` | Yes, capacity then deadline |
| § 4.3 23514 told apart by input; `EV003` → `event_capacity_below_attendees` | `src/lib/data/supabase.ts:202-220` | Yes |
| § 4.4 enum, three columns, two named constraints | migration `:53-76` | Yes, guarded `do` blocks |
| § 4.4 `event_attendance` table, PK, cascade on `event_id`, restrict on `member_id` | migration `:78-91` | Yes |
| § 4.4 `event_registration_open` | migration `:100-108` | Yes, `Asia/Ho_Chi_Minh` date compare |
| § 4.4 `is_event_audience`, no admin clause | migration `:112-125` | Yes |
| § 4.4 `is_event_participant` | migration `:129-137` | Yes |
| § 4.4 `save_event` dropped by old signature, recreated with three defaulted trailing params, invoker | migration `:147-218` | Yes |
| § 4.4 `event_attendance_guard`, lock first, volatile, definer | migration `:232-297` | Yes. Two refusals raised ahead of § 4.4's list (audience 42501, existing row 23505) — impl-log Deviation 1; they order answers the policy and PK would give anyway and loosen nothing |
| § 4.4 `event_capacity_guard`, `before update of capacity` | migration `:301-322` | Yes |
| § 4.4 `event_select_visible` replaced with one disjunct | migration `:331-346` | Yes — EVT-01's predicate (`20260929120000_evt01_event.sql:250-263`) clause for clause plus `is_event_participant` |
| § 4.4 four new policies | migration `:351-391` | Yes, predicates as tabulated |
| § 4.4 grants and execute grants | migration `:401-423` | Yes |
| § 4.5 selectors | form `src/routes/EventEditor.tsx:319`, `:332`, `:345`; panel `src/components/EventAttendancePanel.tsx:146`, `:154`, `:166`, `:171`, `:187`, `:206`, `:212`, `:221`, `:231`, `:247`, `:250`, `:258`, `:265`; Modal prefixes `event-leave`, `event-remove` | Yes; two extras (`event-attendance`, `event-attendance-error`) replace none |
| § 5 supabase: table calls under RLS, `toAttendanceFailure` on SQLSTATE only | `src/lib/data/supabase.ts:302-320`, `:3125-3230` | Yes. Adds `22P02`, `23503` → `attendance_not_permitted` (Deviation 3), which confirms no event's existence |
| § 5 mock: in-memory table, emptied by `__resetEvents`, no `await` between check and write, `mayReadEvent` gains participant clause | `src/lib/data/mock.ts:644-656`, `:684`, `:691`, `:2911-2990`; `:2858` for `EV003` | Yes |
| AC-28 edit form opens with current values; editor always sends all three | `src/routes/EventEditor.tsx:121-123`, `:248-250` | Yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| `INV-04` | The only people-read added is `event_attendance`, whose row type carries five columns and no role, team, membership status or `removed_at`; names resolve through EVT-01's directory. No policy on `public.member` is created, dropped or replaced, so `listMembers()` — INV-04's denominator — returns the same rows. Held in the database, not by an affordance: the migration contains no statement on `public.member`, and the test reads the file to assert it | `supabase/migrations/20260929140000_evt02_attendance.sql:78-89`, `:331-391` (every policy is on `event` or `event_attendance`); `src/lib/data/supabase.ts` `ATTENDANCE_COLUMNS` in the attendance block after `:260`; `src/components/EventAttendancePanel.tsx:68-80` (names from `directory` only); `tests/event-attendance.test.ts:569` |

No entry is written, read or counted by this diff, so INV-01, 02, 03, 05, 06 and 07 are not reached — agreeing with plan § 2's closing paragraph.

## Findings

None.

Recorded, not a finding: the lock that holds AC-9 is asserted by reading the migration, not by two sessions racing a real PostgreSQL. Plan § 3 and the migration header (`:12-15`) both declare that test owed; it is outside this ticket's gate.

## Verdict

`PASS`. The ticket advances to DONE at `/ship`.
