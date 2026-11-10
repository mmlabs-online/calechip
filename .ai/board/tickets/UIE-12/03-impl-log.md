---
ticket: UIE-12
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-15T11:24:32+0700
inputs_read:
  - .ai/board/tickets/UIE-12/01-plan.md
  - .ai/board/tickets/UIE-12/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - .ai/board/tickets/EVT-13/99-questions.md
  - src/components/EventAttendancePanel.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/components/AppShell.tsx
  - src/App.tsx
  - src/lib/fixtures.ts
  - tests/e2e/evt-02-attendance.spec.ts
  - tests/e2e/evt-07-guest-registration.spec.ts
  - tests/e2e/evt-10-description.spec.ts
consulted:
  - with: tech-lead-design
    asked: "Q1: the shell's content pane never scrolls — the document does — so nothing sticky inside it sticks; add src/components/AppShell.tsx to allowed_paths for flex-1 → flex-[1_1_0px]?"
    answer: "Agreed; only that class and its comment; the full e2e suite must pass"
    resulted_in_amendment: true
  - with: tech-lead-design
    asked: "Q2: AC-9's deadline move cannot be made by the reader (only the creator may update the event); fill the last seat with a guest via registerGuest instead?"
    answer: "Agreed; AC-9's Given/When amended, Then unchanged"
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-12 — implementation log

**Both consultations were answered in the session that implemented them.** The operator ran `/plan`
and `/implement` in one session, so `tech-lead-design` and `developer` were the same context, and
RULE-13's separation did not hold for Q1 or Q2. Both are written out in `99-questions.md`, with the
evidence a reviewer needs to judge them without that context.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/components/EventJoinBar.tsx` | created | The reader's own join, status, withdraw and leave dialog, moved out of the panel into a block that stays in view, plus `joinBarState` | § 4.1 |
| `src/components/EventAttendancePanel.tsx` | modified | The load moved into `useEventAttendance` so the bar and the panel share one list and one `busy`. The reader's row and the leave dialog removed. `inAudience` exported, `seatsTaken` added | § 4.2 |
| `src/routes/EventDetail.tsx` | modified | Calls the hook once, feeds both components, and lays out two columns from `xl` only when the bar shows | § 4.3 |
| `src/routes/GuestEvent.tsx` | modified | The register block moved out of the card into `guest-join-bar`, a sticky sibling. The two fields sit side by side from `sm` | § 4.4 |
| `src/components/AppShell.tsx` | modified | The row's `flex-1` → `flex-[1_1_0px]`, so the content pane actually scrolls and a sticky element in it can stick. Without it the member page fails AC-1 | § 7 amendment, Q1 |
| `tests/event-join-bar.test.ts` | created | AC-16: one case per row of § 4.1's table | § 7 |
| `tests/e2e/uie-12-sticky-join.spec.ts` | created | AC-1 to AC-9, AC-7G, AC-11 to AC-13, AC-15 | § 7 |
| `.ai/board/tickets/UIE-12/99-questions.md` | created | Q1 and Q2, with the answers | — |
| `.ai/board/tickets/UIE-12/01-plan.md` | modified | Amendments from Q1 (§ 7, `size`, `consulted`) and Q2 (AC-9), with changelog lines | — |
| `.ai/board/tickets/UIE-12/ticket.yaml` | modified | `allowed_paths` + `AppShell.tsx`, `size` S → M, `chat_budget` 2/6, `state: REVIEW` | — |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `JoinBarState`, `joinBarState` | `src/components/EventJoinBar.tsx:20-51` | The table's six rows in order, first match wins |
| 4.1 `EventJoinBarProps`, `EventJoinBar` | `src/components/EventJoinBar.tsx:69-200` | `event-join-bar`, `-button`, `-closed`, `-full`, `-error`, `event-my-status`, `event-leave-*`; heading *Join* / *Request to join* / *Your place* |
| 4.2 `EventAttendanceLoad`, `useEventAttendance` | `src/components/EventAttendancePanel.tsx:53-107` | Reloads on `event.id` and on `event.updatedAt`, the job the removed `key` did |
| 4.2 `inAudience` exported, `seatsTaken` | `src/components/EventAttendancePanel.tsx:112`, `:129` | `inAudience` unchanged in body |
| 4.2 `EventAttendancePanelProps` | `src/components/EventAttendancePanel.tsx:42-48`, `:199` | Loses `me`, `invitees` and the reader's row. `event-attendance-error` now shows a failed load or the panel's own write |
| 4.3 `EventDetail` | `src/routes/EventDetail.tsx:272-440` | `joinBarState(...).kind !== "hidden"` chooses the grid. Hidden leaves today's `max-w-xl` column (AC-6) |
| 4.4 `GuestEvent` | `src/routes/GuestEvent.tsx:170-215`, `:217` | `GuestEventCard` lost `register`. The block shows only for non-null terms. `GuestRegisterPanel`'s states and ids are unchanged |
| § 2b placement | bar `EventJoinBar.tsx:110-112`; guest `GuestEvent.tsx:197-200` | `sticky bottom-0` below `xl` and `xl:top-6` beside the article. Member bar has `pr-16` below `xl` (AC-8). The wrapper is `display: contents` below `xl`, so the sticky range is the whole column |

## Deviations from the design

1. **`WithEventAttendance`, a private render-prop component in `EventDetail.tsx:446`.** § 4.3 says the
   page "calls `useEventAttendance(event)` once". The event exists only after `EventDetail`'s
   loading and missing early returns, and a hook may not be called after an early return. So the
   ready page calls it inside this six-line wrapper. It is not exported and carries no field or
   name that crosses a boundary.
2. **`src/components/AppShell.tsx` is touched.** Authorised by Q1 and added to `allowed_paths`
   before the edit.
3. **AC-9's setup.** Authorised by Q2 and amended in the plan before the test was written.

## Invariants

`invariants_touched: []`. The code here reads `event_attendance` and `event_guest` rows through the
seam, the same reads as before, and writes nothing new. No entry is read, written or counted, so
INV-01 to INV-07, which are all about entries and the absence count, have nothing to act on.

## Verification

- **typecheck** `pnpm exec tsc --noEmit`: exit 0.
- **lint** `pnpm exec eslint .`: exit 0.
- **unit** `pnpm exec vitest run`: 742 passed, 1 failed. The failure is
  `tests/event-email.test.ts:437`, which expects `…/logo.png` while
  `supabase/functions/send-event-email/template.ts:304` builds `…/logo.png?v=2`. That mismatch came
  from `be22c3b` on `main` (*chore(email): logo URL versioned*). It predates this ticket, and the file
  is outside `allowed_paths`. `tests/event-join-bar.test.ts`: 8 passed.
- **end-to-end** `CI=1 pnpm exec playwright test --retries=0`, the full suite as Q1 requires.
  - First run: 380 passed, 21 skipped, 1 failed: `uie-09-admin-hub.spec.ts:249` AC-4, a `toHaveURL`
    timeout. It passed alone. It also passed in 3 repeats alongside every `evt-*` spec
    (`--repeat-each=3`, 208 passed).
  - Second full run: **381 passed, 21 skipped, 0 failed.**
  - So the first-run failure is load-dependent and did not reproduce. It is not attributed to the
    pane scroll change, but that cannot be ruled out from two runs.
- `tests/e2e/uie-12-sticky-join.spec.ts`: 12 passed. AC-14's five frozen specs pass unedited.
