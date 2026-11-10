---
ticket: EVT-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-08T10:26:05+0000
inputs_read:
  - .ai/board/tickets/EVT-03/01-plan.md
  - .ai/board/tickets/EVT-03/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - src/lib/viewed-team.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/date-selection.ts
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - tests/e2e/evt-02-attendance.spec.ts
  - tests/e2e/solo-busy-day.spec.ts
  - tests/event-attendance.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-03 — implementation log

## Branch

**Built on `claude/beautiful-sagan-3s52z4`, not `feat/EVT-03`, by the operator's decision at step 0
(2026-10-08).** `feat/EVT-03` exists on no ref: PLAN checkpointed on this cloud session's branch
(`c66dfac`, "EVT-03: checkpoint after PLAN — gate PASS"), and `/implement` may not create a `feat/`
branch. The consequence the reviewer needs to know: `guard-allowed-paths.mjs` exits 0 on any
non-`feat/` branch, so **RULE-03 was not enforced by the hook during this stage**. It was held by
hand, and R1 can verify it from `git diff --name-only` — every path below is in `allowed_paths`,
plus this file and `ticket.yaml`.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/event-layer.ts` | created | The pure selection rules — overlap, per-day grouping and order, taking part, Q4-A relevance, the month cap — with no import from absence/day-status/busy | § 4.2 |
| `src/lib/data/index.ts` | modified | Declares the two new seam reads with the plan's docblocks | § 4.3, § 5 |
| `src/lib/data/supabase.ts` | modified | Real implementations: own attendance filtered by `member_id = auth uid`; team-narrowed events from one `event` select with an `event_invitee(member_id)` embed, in parallel with `listMembersForTeam` | § 4.3 |
| `src/lib/data/mock.ts` | modified | Mock implementations reproducing the same policies (invitees only where `mayManageEvent`) | § 4.3 |
| `src/lib/viewed-team.ts` | modified | `TeamReads.events()` — own → `listEvents`, other → `listEventsForTeam`; the switch stays written once | § 4.4 |
| `src/components/EventChip.tsx` | created | The chip: a `Link` to `/events/:id`, filled/outlined coral, `●` marker, mousedown stopped so the month cell's drag never starts | § 4.5, § 2b |
| `src/routes/WeekView.tsx` | modified | Second, non-fatal event read after the grid is stored; separate memos; every chip under the day label; AC-19 notice | § 4.6, § 4.8 |
| `src/routes/MonthView.tsx` | modified | Same read and memos; two chips then `+N more` under the date row, in-month cells only; AC-19 notice in the header | § 4.6, § 4.8 |
| `src/index.css` | modified | `--color-event` / `--color-event-ink` tokens | § 4.7 |
| `.ai/standards/ui-design-system.md` | modified | Exactly § 4.7's one line under § Colour, the TODO kept | § 4.7 |
| `tests/event-layer.test.ts` | created | Unit tests owed by § 7: every § 4.2 function, both seam reads against the mock, `teamReadsFor().events` own/other with throwing stubs | § 7 Tests owed |
| `tests/e2e/evt-03-calendar-events.spec.ts` | created | Acceptance journeys through the § 4.8 selectors | § 7 Tests owed |
| `.ai/board/tickets/EVT-03/03-impl-log.md` | created | This log | gate |
| `.ai/board/tickets/EVT-03/ticket.yaml` | modified | `state: REVIEW`, as the command instructs on PASS | gate |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 no domain types | — | `types.ts` not opened |
| 4.2 `eventsOverlapping` | `src/lib/event-layer.ts:16` | |
| 4.2 `eventsByDate` | `src/lib/event-layer.ts:29` | Iterates days with `datesInRange` from `@/lib/date-selection` (pure, no data import) |
| 4.2 `takingPartIds` | `src/lib/event-layer.ts:48` | |
| 4.2 `eventsRelevantToTeam` | `src/lib/event-layer.ts:67` | Imported by both seam implementations so the rule is written once |
| 4.2 `MONTH_EVENT_LIMIT` | `src/lib/event-layer.ts:13` | |
| 4.3 `listOwnEventAttendance` | `index.ts:1369`, `supabase.ts:3240`, `mock.ts:3004` | Ordered `event_id` asc, DATASTORE_MAX_ROWS bound and throw |
| 4.3 `listEventsForTeam` | `index.ts:1376`, `supabase.ts:3268`, `mock.ts:3021` | Roster through `seam.` not `this.` (destructuring-safe) |
| 4.4 `TeamReads.events` | `src/lib/viewed-team.ts:108`, `:130`, `:141` | |
| 4.5 `EventChip` | `src/components/EventChip.tsx:21` | See Deviations: one prop added |
| 4.6 screens | `WeekView.tsx:377-396`, `:479-494`; `MonthView.tsx:310-329`, `:410-425` | Inner try/catch, so an event failure never reaches the `unavailable` phase |
| 4.7 token | `src/index.css:211-212`; `.ai/standards/ui-design-system.md` § Colour | |
| 5 seam parity | — | `tests/seam-parity.test.ts` passes unedited |
| 6 schema | — | none; no migration |

## Deviations from the design

1. **`EventChipProps` has a fourth prop, `date: string`.** § 4.5 lists `event`, `takingPart`,
   `surface`; § 4.8 requires the chip to carry `data-date`, and a multi-day event has one chip per day,
   so the chip cannot derive the date from the event. Resolving that contradiction within the plan's
   own selector table, not a new field name in the domain. No consultation.
2. **The chip also stops `click` propagation**, not only `mousedown` (§ 4.5). Defensive: no ancestor
   handles `click` today, so behaviour is identical; it means a future cell `onClick` cannot fire
   under a chip (AC-13).
3. **AC-19's failure half is not exercised end-to-end.** The mock has no fault injection and adding
   one would widen `mock.ts` beyond § 4.3. The success half (no notice when reads succeed) is asserted
   in the e2e spec; the failure path is two lines per screen (`WeekView.tsx:393-396`,
   `MonthView.tsx:326-329`) for the reviewer to read. See Open questions.
4. **The AC-9 e2e and unit fixtures have two teams, not three.** The fixtures carry team A and team B
   only, so "public, created on team C" is a public event created on team A. Scope `public` is
   relevant whatever its team, so the case is preserved.

## Invariants

| ID | Still holds because |
|----|---------------------|
| INV-04 | `event-layer.ts` imports nothing from `absence.ts`; the screens' event memos (`eventDays`, `takingPart`) are separate from `counts`/`absent`, and neither is passed to `absenceCountsFor`, `absentEntriesFor` or `dayStatusesFor`. The e2e AC-15 test snapshots every day's `data-count`, `data-day-status`, `data-bridge`, `data-overloaded`, rows, avatars, empty state and busy count before and after three events, and they are identical. |
| INV-05 | No event is an entry: the chip carries neither PTO nor WFH tokens nor the dashed tentative treatment, and no entry is created, read differently or reweighted. |
| INV-07 | The admin's narrowing uses team B's roster only to test named invitees, inside `listEventsForTeam`; that roster never reaches a count. Team B's counts are still computed from `reads.entriesOverlapping` and `reads.roster()` exactly as before, and the event read runs after them. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 29 files, 490 tests; `seam-parity` and `viewed-team` unedited |
| `pnpm exec playwright test` evt-03, cal-04, cal-05, cal-12, evt-01, evt-02, solo-busy-day, uie-07 | 0 | 69 passed. Run with the container's headless shell aliased to the revision Playwright expects (an environment fix outside the repository) |
| `node scripts/check-docs.mjs` | 0 | 0 errors; the 2 D8 warnings are pre-existing and about unrelated files |
| `git diff --name-only` ⊆ `allowed_paths` | yes | plus the ticket's own `03-impl-log.md` and `ticket.yaml` |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `week-event` | `src/components/EventChip.tsx:25` (`${surface}-event`), used at `WeekView.tsx:866` |
| `month-event` | `src/components/EventChip.tsx:25`, used at `MonthView.tsx:801` |
| `month-cell-events-more` | `src/routes/MonthView.tsx:811` |
| `week-events-unavailable` | `src/routes/WeekView.tsx:698` |
| `month-events-unavailable` | `src/routes/MonthView.tsx:605` |

## Open questions

1. **AC-19's failure path has no automated test.** Proving it needs either a fault-injection hook in
   the mock (outside § 4.3) or a component-test harness (none in the repository). Either is a small
   follow-up; neither belongs in this ticket's twelve paths.
2. **Plan § 2 open questions 1 and 2 still stand as decided by the plan:** coral `#ff7f50` distinct
   from busy `#ffb3a7`, and `+N more` is not a link.
