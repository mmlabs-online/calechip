---
ticket: UIE-12
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-15T12:26:56+0700
inputs_read:
  - .ai/board/tickets/UIE-12/01-plan.md
  - .ai/board/tickets/UIE-12/03-impl-log.md
  - .ai/board/tickets/UIE-12/99-questions.md
  - .ai/board/tickets/UIE-12/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - git diff origin/main...HEAD
  - git diff (working tree)
  - src/components/EventJoinBar.tsx
  - src/components/EventAttendancePanel.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/components/AppShell.tsx
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

# UIE-12 — review

The implementation is uncommitted: no `/advance` checkpoint followed IMPLEMENT, so the branch diff
`origin/main...HEAD` holds only the PLAN checkpoint (`backlog.md`, `01-plan.md`, `ticket.yaml`) and
the code was read from the working tree. Both subjects of R1 were checked.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed subset of `allowed_paths`; uncommitted carry clean | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (3 changed files, exit 0). `node scripts/check-carry.mjs UIE-12` → `PASS — nothing stray`, 11 paths carried: 4 ticket files (`<- this ticket`); `src/components/EventJoinBar.tsx`, `src/components/EventAttendancePanel.tsx`, `src/routes/EventDetail.tsx`, `src/routes/GuestEvent.tsx`, `src/components/AppShell.tsx`, `tests/event-join-bar.test.ts`, `tests/e2e/uie-12-sticky-join.spec.ts` (`<- allowed_paths`). `AppShell.tsx` is in `ticket.yaml` `allowed_paths` and plan § 7, added under `99-questions.md` Q1 before the edit at `src/components/AppShell.tsx:117` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` over the 7 changed source and test files → exit 0; repo-wide `pnpm exec eslint .` → exit 0, so nothing to route as a chore |
| R4 | Nothing bypasses the seam (RULE-02) | PASS | Every write and read goes through `seam` from `@/lib/data`: `src/components/EventJoinBar.tsx:13`, `:121`, `:190`; `src/components/EventAttendancePanel.tsx:77-80`. No changed file imports a Supabase client or anything under `src/lib/data/` but the seam's index (grep: no match) |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | `joinBarState` at `src/components/EventJoinBar.tsx:40-52` offers the button exactly when the removed `canJoin` did: `rows !== null` (`:40`), no own row (`:41-48`), `inAudience` (`:49`, body unchanged at `src/components/EventAttendancePanel.tsx:129`), `open` (`:50`), and `requiresApproval \|\| !full` (`:51`) with `taken` from `seatsTaken` (`src/components/EventAttendancePanel.tsx:112-117`), the same count as the panel's `taken` (`:225`). Withdraw is offered under the old condition, `open && (pending \|\| attending)` (`src/components/EventJoinBar.tsx:46`). The guest block shows only for non-null terms (`src/routes/GuestEvent.tsx:170`, `:196`) with `GuestRegisterPanel`'s gating unchanged. The two new states (`:147-157`) offer no control. No guard, policy or seam function changed (§ 5) |
| R7 | No invariant violated | PASS | `invariants_touched: []`; see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main -- package.json pnpm-lock.yaml` is empty; new imports are internal (`src/components/EventJoinBar.tsx:12-17`, `src/routes/EventDetail.tsx:55-61`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `JoinBarState` | `src/components/EventJoinBar.tsx:20-25` | Yes — five variants as specified |
| 4.1 `joinBarState(input)` and its six-row table, first match wins | `src/components/EventJoinBar.tsx:28-53` | Yes — rows 1–6 at `:40`, `:41-48`, `:49`, `:50`, `:51`, `:52` |
| 4.1 `EventJoinBarProps` | `src/components/EventJoinBar.tsx:70-75` | Yes |
| 4.1 `EventJoinBar` default export; `null` on hidden | `src/components/EventJoinBar.tsx:77-95` | Yes |
| 4.1 markup: `event-join-bar`, heading, `event-join-button`, `event-my-status` + `data-status`, `event-leave-button`, `event-join-closed`, `event-join-full`, `event-join-error` `role="alert"` | `src/components/EventJoinBar.tsx:110`, `:113`, `:118`, `:129`, `:134`, `:148`, `:152`, `:160` | Yes |
| 4.1 `MY_STATUS` and leave dialog moved unchanged, `testIdPrefix="event-leave"` | `src/components/EventJoinBar.tsx:55-60`, `:165-198` | Yes — wording identical to the removed lines |
| 4.1 join → `attendance.run(seam.joinEvent)`, leave → `attendance.run(seam.leaveEvent)`, error cleared on next click | `src/components/EventJoinBar.tsx:97-100`, `:121`, `:190` | Yes |
| 4.2 `EventAttendanceLoad` | `src/components/EventAttendancePanel.tsx:53-63` | Yes |
| 4.2 `useEventAttendance(event)`, reload on `event.id` and `event.updatedAt` | `src/components/EventAttendancePanel.tsx:67-107` (`[eventId]` at `:90`, `[load, updatedAt]` at `:95`) | Yes |
| 4.2 `inAudience` exported unchanged | `src/components/EventAttendancePanel.tsx:129` | Yes |
| 4.2 `seatsTaken` | `src/components/EventAttendancePanel.tsx:112` | Yes |
| 4.2 `EventAttendancePanelProps` without `me`, `invitees`; with `attendance` | `src/components/EventAttendancePanel.tsx:42-48`, `:199-204` | Yes |
| 4.2 panel keeps `event-attendance-error` for failed load and its own writes | `src/components/EventAttendancePanel.tsx:210-215`, `:229` | Yes |
| 4.3 `EventDetail` calls the hook once, feeds both, no `key` | `src/routes/EventDetail.tsx:272`, `:372`, `:399`, `:446-455` | Yes — via a private wrapper because the hook cannot follow the page's early returns; impl-log deviation 1, no boundary crosses it |
| 4.3 layout decided from `joinBarState`; hidden → today's column (AC-6) | `src/routes/EventDetail.tsx:275-289` | Yes |
| 4.4 `GuestEventCard` loses `register` | `src/routes/GuestEvent.tsx:217` | Yes |
| 4.4 `guest-join-bar` sibling after the card, only for non-null terms | `src/routes/GuestEvent.tsx:193-209` | Yes |
| 4.4 `GuestRegisterPanel` internals and ids unchanged, outer classes only | `src/routes/GuestEvent.tsx:418` (field row); remaining hunks remove `border-t pt-4` only | Yes |
| § 7 amendment (Q1) `AppShell.tsx` one class | `src/components/AppShell.tsx:117` | Yes — only that class and its comment changed |

Sanity, not a gate item: `CI=1 pnpm exec playwright test --retries=0` over
`uie-12-sticky-join.spec.ts` and AC-14's five frozen specs — 50 passed; `vitest run
tests/event-join-bar.test.ts` — 8 passed.

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml`, plan § 2). The registry's INV-01 to INV-07 each govern
entries (PTO/WFH rows) or the absence count derived from them. No changed file reads, writes or counts
an entry: the only seam calls are `listEventAttendance`, `listEventGuests`
(`src/components/EventAttendancePanel.tsx:77-80`), `joinEvent` and `leaveEvent`
(`src/components/EventJoinBar.tsx:121`, `:190`) — all on event attendance, all present before this
ticket.

| Invariant | Held by | Citation |
|---|---|---|
| — (none touched) | n/a | `src/components/EventJoinBar.tsx:121`, `:190`; `src/components/EventAttendancePanel.tsx:77-80` |

## Findings

None.

## Verdict

PASS.
