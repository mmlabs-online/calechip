---
ticket: EVT-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-08T19:34:08+0700
inputs_read:
  - .ai/board/tickets/EVT-03/01-plan.md
  - .ai/board/tickets/EVT-03/03-impl-log.md
  - .ai/board/tickets/EVT-03/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - git diff c66dfac cbd2cd6 (the IN_PROGRESS checkpoint; see "Subject of R1")
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

# EVT-03 — review

## Subject of R1 — the implementation is already on `origin/main`

`git log origin/main..HEAD` is empty: the IN_PROGRESS checkpoint `cbd2cd6` was merged to `main` by
PR #112 (`121f58e`) before this review ran, and `feat/EVT-03` fast-forwarded to that merge. So
`git diff origin/main...HEAD` is empty and cannot be the subject of R1. The implementation was read
as `git diff c66dfac cbd2cd6` — the commit `/advance` made after IN_PROGRESS, parented on the PLAN
checkpoint. This is not a check failure of the Developer's, but **a human merged an unreviewed
implementation**; this verdict reviews it after the fact. Noted for the operator, not routed.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carry clean | PASS | `git diff --name-only c66dfac cbd2cd6` → 14 paths: the 12 of `ticket.yaml:16-28` exactly, plus `.ai/board/tickets/EVT-03/03-impl-log.md` and `ticket.yaml` (ticket folder). `node scripts/check-carry.mjs EVT-03` → `0 uncommitted path(s)`, `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` on the 10 changed `.ts/.tsx` files → exit 0; `pnpm exec eslint .` → exit 0 |
| R4 | No datastore access outside the seam | PASS | `src/lib/event-layer.ts:9-10` imports only `date-selection` and types; `src/components/EventChip.tsx:8-9` only `react-router-dom` and types; screens reach data only via `reads.events()` / `seam.listOwnEventAttendance()` at `src/routes/WeekView.tsx:386-387`, `src/routes/MonthView.tsx:319-320`; `client()` used only in `src/lib/data/supabase.ts:3240-3296` |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | Other-team reads only for an admin: `src/lib/viewed-team.ts:61` (non-admin → `own`) and `:141`; own view is `seam.listEvents()` unchanged, `:130`; narrowing is a filter over the same policy-filtered `select`, `src/lib/data/supabase.ts:3270-3276` vs `:2993-2999`; invitees only through the RLS-filtered embed `:3272`, mirrored by `mayManageEvent` in `src/lib/data/mock.ts:3027`; own attendance filtered `member_id = auth uid`, `supabase.ts:3248`; chip issues no seam call, `EventChip.tsx:23-47` |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `package.json` and the lockfile are absent from `git diff --name-only c66dfac cbd2cd6`; the only new import is the in-repo `@/lib/event-layer` (`mock.ts:33`, `supabase.ts:15`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 no domain types | `src/lib/domain/types.ts` not in the diff | yes |
| § 4.2 `eventsOverlapping` | `src/lib/event-layer.ts:16-18` | yes |
| § 4.2 `eventsByDate` (every key present, order startDate/name/id) | `src/lib/event-layer.ts:21-25`, `:29-44` | yes |
| § 4.2 `takingPartIds` (creator or own `attending`) | `src/lib/event-layer.ts:48-62` | yes |
| § 4.2 `eventsRelevantToTeam` (Q4-A) | `src/lib/event-layer.ts:67-78` | yes |
| § 4.2 `MONTH_EVENT_LIMIT = 2` | `src/lib/event-layer.ts:13` | yes |
| § 4.2 no import from absence/day-status/busy | `src/lib/event-layer.ts:9-10` | yes |
| § 4.3 `listOwnEventAttendance()` — interface | `src/lib/data/index.ts:1369` | yes |
| § 4.3 `listOwnEventAttendance()` — supabase (auth uid, order, bound, throw) | `src/lib/data/supabase.ts:3240-3261` | yes |
| § 4.3 `listOwnEventAttendance()` — mock (empty without member row) | `src/lib/data/mock.ts:3004-3016` | yes |
| § 4.3 `listEventsForTeam(teamId)` — interface | `src/lib/data/index.ts:1376` | yes |
| § 4.3 `listEventsForTeam` — supabase (embed, parallel roster via `seam.`, approved & not removed, bound, throw) | `src/lib/data/supabase.ts:3268-3296` | yes |
| § 4.3 `listEventsForTeam` — mock (invitees only where `mayManageEvent`) | `src/lib/data/mock.ts:3021-3038` | yes |
| § 4.4 `TeamReads.events()` own/other | `src/lib/viewed-team.ts:108`, `:130`, `:141` | yes |
| § 4.5 `EventChip` — Link, mousedown stopped, title/aria-label | `src/components/EventChip.tsx:21-47` | yes, plus `date` prop (impl-log deviation 1, required by § 4.8 `data-date`) |
| § 4.6 second non-fatal read after grid stored, separate memos | `src/routes/WeekView.tsx:368-396`, `:479-494`; `src/routes/MonthView.tsx:300-329`, `:410-425` | yes |
| § 4.7 token | `src/index.css:208-212`; `.ai/standards/ui-design-system.md:20` (exactly § 4.7's line, TODO kept) | yes |
| § 4.8 `week-event` / `month-event` | `src/components/EventChip.tsx:25-28`; used `WeekView.tsx:866`, `MonthView.tsx:801` | yes |
| § 4.8 `month-cell-events-more` (`data-date`, `data-hidden-count`, `title`) | `src/routes/MonthView.tsx:810-819` | yes |
| § 4.8 `week-events-unavailable` / `month-events-unavailable` | `src/routes/WeekView.tsx:697-700`; `src/routes/MonthView.tsx:604-607` | yes |
| § 5 seam parity | `pnpm exec vitest run` → 29 files, 490 tests passed, `tests/seam-parity.test.ts` unedited | yes |
| § 6 schema none | no `supabase/migrations/**` in the diff | yes |
| § 7 tests owed | `tests/event-layer.test.ts`; `tests/e2e/evt-03-calendar-events.spec.ts` → `playwright test` 6 passed | yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 | The count is computed from `view.entries`, `range`, `view.roster` only; the event memos are separate and feed no count, status or overload input. `event-layer.ts` imports nothing from `absence.ts` and returns no shape it accepts. | `src/routes/WeekView.tsx:433` vs `:479-494`; `src/routes/MonthView.tsx:364` vs `:410-425`; `src/lib/event-layer.ts:9-10` |
| INV-05 | No event is an entry: the chip has no PTO/WFH token and no dashed tentative treatment; no entry is created or reweighted (the chip issues no seam call). | `src/components/EventChip.tsx:35-43`; `dayStatusesFor(view.holidays, range)` unchanged at `WeekView.tsx:563`, `MonthView.tsx:493` |
| INV-07 | Team B's roster is used inside `listEventsForTeam` only to test named invitees and is returned nowhere; team B's counts still come from `reads.entriesOverlapping` / `reads.roster()`, and the event read runs after them. | `src/lib/data/supabase.ts:3291-3295`; `src/lib/data/mock.ts:3034-3037`; `src/routes/WeekView.tsx:368-387` |

## Findings

None that fail a check.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

Two notes for a human, neither a gate item: (1) the implementation was merged to `main` (PR #112)
before REVIEW — see *Subject of R1*; (2) AC-19's failure path has no automated test (impl-log open
question 1); the code path was read at `WeekView.tsx:393-396` and `MonthView.tsx:326-329` and is
correct.

## Verdict

`PASS`.
