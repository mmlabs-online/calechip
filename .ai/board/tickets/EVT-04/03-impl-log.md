---
ticket: EVT-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-08T21:23:29+0700
inputs_read:
  - .ai/board/tickets/EVT-04/01-plan.md
  - .ai/board/tickets/EVT-04/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/steward/context.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/components/TopBar.tsx
  - src/components/DayPicker.tsx
  - src/components/ReportIssueButton.tsx
  - tests/event-attendance.test.ts
  - tests/events.test.ts
  - tests/ui-language.test.ts
  - tests/e2e/evt-02-attendance.spec.ts
  - node_modules/@supabase/postgrest-js/dist/index.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-04 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261008120000_evt04_notification.sql` | created | The enum, table, index, `may_read_event`, `notify`, seven trigger functions and triggers, `mark_notifications_read`, two policies and the grants — the whole control | § 4.3, § 6 |
| `src/lib/domain/types.ts` | modified | `NotificationKind`, `EventNotification`, `NOTIFICATION_LIMIT`, appended after the EVT-02 block | § 4.1 |
| `src/lib/data/index.ts` | modified | The four seam signatures and the `EventNotification` import | § 4.2 |
| `src/lib/data/supabase.ts` | modified | `NotificationRow`, `toNotification`, the mark failure mapper and the four functions over `from("notification")` and `rpc("mark_notifications_read")` | § 4.2, § 5 |
| `src/lib/data/mock.ts` | modified | The in-memory table, `notify` reproducing the migration's, the seven trigger points in the existing writers, the four functions, and `__resetEvents()` emptying the table | § 5 |
| `src/components/NotificationBell.tsx` | created | The bell, the count pill, the panel, and the exported `notificationSentence` | § 2b, § 4.4, § 4.5 |
| `src/components/TopBar.tsx` | modified | Renders `<NotificationBell />` between `nav-events-link` and `+ Book`; one header sentence | § 4.5 |
| `tests/notifications.test.ts` | created | AC-1 to AC-16, AC-18, AC-19 against the mock, the migration's shape by reading it, and the nine sentences | § 5 *Tests* |
| `tests/e2e/evt-04-notifications.spec.ts` | created | AC-13 to AC-16 through the screen | § 5 *Tests* |
| `.ai/standards/data-model.md` | modified | The `### notification` entity under § *Entities*, including the chosen `set null` | § 6 *Standards written by this ticket* |
| `.ai/standards/rbac-and-security.md` | modified | Six notification rows in § *The permission table* | § 6 *Standards written by this ticket* |
| `.ai/board/tickets/EVT-04/ticket.yaml` | modified | `state: REVIEW`, `branch: feat/EVT-04` | `/implement` on PASS |
| `.ai/board/tickets/EVT-04/03-impl-log.md` | created | This file | gate |

`.ai/registry/glossary.md` is in `allowed_paths` and dirty, but was written at PLAN (01-plan.md § 7) —
not touched here. `.ai/board/backlog.md` likewise carries PLAN's change only.

## Contract items

| Plan item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `NotificationKind` | `src/lib/domain/types.ts:1037` | Verbatim |
| § 4.1 `EventNotification` | `src/lib/domain/types.ts:1050` | Verbatim |
| § 4.1 `NOTIFICATION_LIMIT = 50` | `src/lib/domain/types.ts:1069` | |
| § 4.2 `listNotifications` | `index.ts:1391`, `supabase.ts:3359`, `mock.ts:3166` | `created_at` desc, `id` desc, `.limit(50)`; a window, no throw at the bound |
| § 4.2 `countUnreadNotifications` | `index.ts:1395`, `supabase.ts:3374`, `mock.ts:3174` | `head: true`, `count: "exact"`, `.is("read_at", null)` |
| § 4.2 `markNotificationRead` | `index.ts:1399`, `supabase.ts:3385`, `mock.ts:3181` | `rpc("mark_notifications_read", { p_ids: [id] })`; not-mine and already-read both ok |
| § 4.2 `markAllNotificationsRead` | `index.ts:1403`, `supabase.ts:3393`, `mock.ts:3190` | `{ p_ids: null }`; returns the row count |
| § 4.3 enum, table, index | migration `:62`, `:70`, `:85` | `event_id … on delete set null`; `recipient_id`, `actor_id` restrict |
| § 4.3 `may_read_event` | migration `:97` | `event_select_visible` as EVT-02 left it, clause for clause; the test compares the two clause by clause |
| § 4.3 `notify` | migration `:119` | Null actor → nothing; `distinct`; skip actor; `may_read_event` on `p_event_id`; insert `null` for `event_cancelled` |
| § 4.3 seven triggers | migration `:154`–`:361` | Timing and `when` clauses as § 4.3's table |
| § 4.3 `mark_notifications_read` | migration `:375` | Security invoker; `get diagnostics … row_count` |
| § 4.3 policies | migration `:398`, `:406` | No `is_admin` disjunct |
| § 4.3 grants | migration `:425`–`:452` | Select + `update (read_at)` only; `notify` revoked from `authenticated` too and granted to nobody |
| § 4.4 `notificationSentence` | `src/components/NotificationBell.tsx:24` | The nine sentences of the table |
| § 4.5 `TopBar` renders the bell | `src/components/TopBar.tsx:299` | Outside every condition |
| § 4.5 refresh (AC-17) | `NotificationBell.tsx` `useEffect` on `pathname`; on open; after each mark | Directory read once on first open |
| § 5 mock trigger points | `mock.ts:749` (invited), `:2920` (created), `:2987` (updated), `:3000` (cancelled, before the delete), `:3053` (requested), `:3077` (withdrawn), `:3107` (approved/rejected/removed) | `notify` at `mock.ts:787` |

## Deviations from the design

1. **`BELL_BUTTON` repeats TopBar's `ICON_BUTTON` string (plus `relative`) inside
   `NotificationBell.tsx`** rather than importing it. § 4.5 limits `TopBar.tsx` to one render and one
   header sentence, and exporting the constant would be a third change. The comment at the copy names
   its source.
2. **Mock ordering of `event_created` vs `event_invited`.** The SQL fires `event_created` after the
   event insert and before the invitee inserts; the mock notifies invitees inside
   `writeEventInvitees` and `event_created` after it. Unobservable: a named event sends no
   `event_created`, and a non-named one has no invitees.
3. **Mark failures are not shown on screen.** The seam returns `network` / `unknown` with an English
   sentence (§ 4.1); the bell refreshes the list and count after the call either way, so a failed mark
   simply leaves the item unread. § 2b specifies no error surface for the panel; a list read that
   throws shows *Notifications could not be loaded. Please try again.* in the panel.

## Invariants

`invariants_touched: []`. Considered as § 2 did:

| ID | Still holds because |
|----|---------------------|
| INV-04 | No policy on `public.member` is created, dropped or replaced (asserted by reading the migration), and `listMembers()` returns identical rows before and after a public event's fan-out (`tests/notifications.test.ts`, *AC-19 / INV-04*). Recipients are enumerated inside definer triggers that return nothing to a caller. |
| INV-01, 02, 03, 05, 06, 07 | Constrain entries; no entry is read or written by anything in this ticket. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 30 files, 516 tests |
| `pnpm exec playwright test tests/e2e/evt-04-notifications.spec.ts` | 0 | 4 passed (seam guard + 3) |
| `pnpm exec playwright test` | 1 | 325 passed, **20 failed — the same 20 EVT-01's log records** (Open questions 3); none is in the EVT-04 spec and none touches the top bar |
| `node scripts/check-docs.mjs` | 0 | 0 errors |
| `git status` paths ⊆ `allowed_paths` + ticket folder | yes | |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `notification-bell` (`data-unread`, `aria-expanded`, `aria-label`) | `src/components/NotificationBell.tsx:185` |
| `notification-unread-count` | `src/components/NotificationBell.tsx:195` |
| `notification-panel` (`role="dialog"`) | `src/components/NotificationBell.tsx:205` |
| `notification-mark-all-read` | `src/components/NotificationBell.tsx:216` |
| `notification-empty` | `src/components/NotificationBell.tsx:231` |
| `notification-item` (`data-notification-id`, `data-kind`, `data-read`, `data-event-id`) | `src/components/NotificationBell.tsx:243` |

## Open questions

1. **`may_read_event(uuid, uuid)` is executable by `authenticated`, as § 4.3 lists.** That makes it
   an oracle: any approved member can ask whether a given uid may read a given event id — e.g. probe
   who is on a named list, given both uuids. Nothing calls it from a session; the triggers reach it
   as definer. Revoking it from `authenticated` would cost nothing that I can find. Built as
   specified; raised for the reviewer rather than changed (RULE-04).
2. The migration has not been run against PostgreSQL (header says so). In particular the `when`
   clause on `notify_event_updated` compares nine columns with `is distinct from`, and the trigger
   functions return `null` from `after` triggers — both standard, neither executed.
3. **20 end-to-end failures pre-date this ticket.** All are in `adm-01`, `adm-02`, `adm-03`, `adm-04`,
   `cal-06`, `uie-09` and `uie-10`, and each looks for a sidebar link (`home-week-link`, the holidays
   link) that the navigation block in `src/components/Sidebar.tsx` has carried commented out since
   `2259136` (2026-09-12). `Sidebar.tsx` is unchanged on this branch and outside `allowed_paths`;
   `.ai/board/tickets/EVT-01/03-impl-log.md` § Open questions recorded the same 20 on a clean worktree.
