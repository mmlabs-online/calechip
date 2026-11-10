---
ticket: EVT-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-08T21:33:47+0700
inputs_read:
  - .ai/board/tickets/EVT-04/01-plan.md
  - .ai/board/tickets/EVT-04/03-impl-log.md
  - .ai/board/tickets/EVT-04/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/steward/context.md
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/components/NotificationBell.tsx
  - src/components/TopBar.tsx
  - tests/notifications.test.ts
  - tests/e2e/evt-04-notifications.spec.ts
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
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

# EVT-04 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carry clean | PASS | `git diff --name-only origin/main...HEAD` minus `.ai/board/tickets/EVT-04/**` and `.ai/board/backlog.md` (ship-owned) = the twelve paths of `ticket.yaml` `allowed_paths`, nothing else. `node scripts/check-carry.mjs EVT-04` → `0 uncommitted path(s)`, `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint` on the eight changed `.ts`/`.tsx` files exit 0; repo-wide `pnpm exec eslint .` exit 0 too |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/components/NotificationBell.tsx:18` imports `seam` from `@/lib/data` only; every datastore call is in `src/lib/data/supabase.ts:3359-3397`; `src/components/TopBar.tsx:43,299` only renders the child |
| R5 | Every § 4 contract item implemented | PASS | see *R5 detail* |
| R6 | Permission gating matches plan § 3 | PASS | `supabase/migrations/20261008120000_evt04_notification.sql:398-415` (both policies, no `is_admin` disjunct, `member_team_id(uid) is not null`); `:425-428` (revoke all, then `select` and `update (read_at)` only — no insert/delete grant); `:433` (`notify` revoked from `authenticated`, granted to nobody); `:129-142` (null actor writes nothing, actor skipped, `may_read_event` filter, `distinct`); `:375-388` (`mark_notifications_read` is `security invoker`). Mock: `src/lib/data/mock.ts:809` (`ownsNotification`, no admin clause), `:787` (`notify`) |
| R7 | No invariant violated | PASS | see *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; `NotificationBell.tsx:17` uses the existing `date-fns`; the glyph is inline SVG (`:58-75`) |

**Verification run by the reviewer:** `pnpm exec vitest run` — 30 files, 516 tests, exit 0.
`pnpm exec playwright test tests/e2e/evt-04-notifications.spec.ts` — 4 passed.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `NotificationKind` | `src/lib/domain/types.ts:1037` | yes — nine values, verbatim |
| § 4.1 `EventNotification` | `src/lib/domain/types.ts:1050` | yes — eight fields, nullability as specified |
| § 4.1 `NOTIFICATION_LIMIT = 50` | `src/lib/domain/types.ts:1069` | yes |
| § 4.2 `listNotifications()` | `src/lib/data/index.ts:1391`; `supabase.ts:3359` (`created_at` desc, `id` desc, `.limit(NOTIFICATION_LIMIT)`, throws); `mock.ts:3166` | yes |
| § 4.2 `countUnreadNotifications()` | `index.ts:1395`; `supabase.ts:3374` (`count: "exact", head: true`, `.is("read_at", null)`); `mock.ts:3174` | yes |
| § 4.2 `markNotificationRead(id)` | `index.ts:1399`; `supabase.ts:3385` (`rpc("mark_notifications_read", { p_ids: [id] })`); `mock.ts:3181` | yes |
| § 4.2 `markAllNotificationsRead()` | `index.ts:1403`; `supabase.ts:3393` (`{ p_ids: null }`, row count); `mock.ts:3190` | yes |
| § 4.3 enum | `supabase/migrations/20261008120000_evt04_notification.sql:61-68` | yes — guarded `do` block |
| § 4.3 table, `set null` on `event_id`, restrict on `recipient_id`/`actor_id` | migration `:70-82` | yes |
| § 4.3 index `notification_recipient_created` | migration `:85-86` | yes |
| § 4.3 `may_read_event` | migration `:97-112` | yes — clause for clause with `event_select_visible` at `20260929140000_evt02_attendance.sql:332-346`, `p_uid` for `auth.uid()` |
| § 4.3 `notify` (null actor, distinct, skip actor, read check on `p_event_id`, insert null for `event_cancelled`) | migration `:119-144` | yes — the subtle line at `:136` |
| § 4.3 `notify_event_created` (after insert, team / public / named → none) | migration `:154-179` | yes |
| § 4.3 `notify_event_updated` (after update, `when` on the nine fields) | migration `:183-214` | yes |
| § 4.3 `notify_event_cancelled` (before delete) | migration `:218-239` | yes |
| § 4.3 `notify_event_invited` (after insert on `event_invitee`) | migration `:244-267` | yes — `save_event` updates the event before inserting invitees (`20260929140000_evt02_attendance.sql:174-212`), so the read check sees the new scope |
| § 4.3 `notify_attendance_inserted` (`when new.status = 'pending'`) | migration `:271-296` | yes |
| § 4.3 `notify_attendance_changed` (after update of status, `when` distinct) | migration `:301-331` | yes |
| § 4.3 `notify_attendance_deleted` (`when` pending/attending, own row, event exists) | migration `:336-365` | yes |
| § 4.3 `mark_notifications_read` (invoker, returns count) | migration `:375-388` | yes |
| § 4.3 policies `notification_select_own`, `notification_update_own` | migration `:397-415` | yes |
| § 4.3 grants | migration `:425-452` | yes — `notify` absent from the grant list |
| § 4.4 `notificationSentence` and the nine sentences | `src/components/NotificationBell.tsx:24-45` | yes — each sentence verbatim |
| § 4.5 `notification-bell` (`aria-label`, `aria-expanded`, `data-unread`) | `NotificationBell.tsx:183-191` | yes |
| § 4.5 `notification-unread-count` (absent at 0, `9+`) | `NotificationBell.tsx:193-200` | yes |
| § 4.5 `notification-panel` (`role="dialog"`) | `NotificationBell.tsx:204-208` | yes |
| § 4.5 `notification-mark-all-read` (absent with nothing unread) | `NotificationBell.tsx:213-222` | yes |
| § 4.5 `notification-empty` | `NotificationBell.tsx:231` | yes |
| § 4.5 `notification-item` (`data-notification-id`, `data-kind`, `data-read`, `data-event-id`) | `NotificationBell.tsx:241-248` | yes |
| § 4.5 TopBar renders the bell between Events and `+ Book`, one header sentence | `src/components/TopBar.tsx:40-41,299` | yes |
| § 4.5 refresh: count on pathname; list + count on open; after a mark; directory once | `NotificationBell.tsx:127-129`, `:132-141`, `:160-176` | yes |
| § 5 mock trigger points | `mock.ts:749` (invited), `:2922` (created), `:2987` (updated, nine fields), `:3000` (cancelled, before the splice), `:3053` (requested), `:3077` (withdrawn), `:3107` (approved/rejected/removed, after the change) | yes |
| § 5 `__resetEvents()` empties the table | `mock.ts:585` | yes |
| § 6 standards entries | `.ai/standards/data-model.md:113-134`; `.ai/standards/rbac-and-security.md:68-73` | yes |
| § 5 tests | `tests/notifications.test.ts:154-567`; `tests/e2e/evt-04-notifications.spec.ts:52,91,111` | yes — admin denial by name at `tests/notifications.test.ts:368-391` |

## R7 detail

`invariants_touched: []`. Reasoned per ID because the gate requires it.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | No entry is read or written; no entry table or entry policy appears in the diff | migration `:55-454` touches only `notification`, and triggers on `event`, `event_invitee`, `event_attendance` |
| INV-02 approval does not survive an edit | Same — no entry write path changes | `src/lib/data/mock.ts` diff touches only event/attendance writers and the four new functions |
| INV-03 rejection reason | Same | as above |
| INV-04 one absence count | No policy on `public.member` created, dropped or replaced; recipients enumerated inside definer triggers that return nothing; the actor's name comes from the existing `listMemberDirectory()`; `listMembers()` asserted unchanged before/after a fan-out | migration `:154-174` (reads `member` inside a definer, returns null); `NotificationBell.tsx:136-138`; `tests/notifications.test.ts:559` |
| INV-05 tentative counts | No entry or count path changes | as INV-01 |
| INV-06 one portion | No entry path changes | as INV-01 |
| INV-07 one member, one team | No entry path changes; `member` untouched | as INV-04 |

## Findings

No failures. Two notes, neither part of the gate:

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | R6 (note) | The impl log's open question 1 — `may_read_event(uuid, uuid)` executable by `authenticated` (`migration:444`) is an oracle on who may read an event. It is the plan's grant list (§ 4.3), so not a Developer defect, and it adds no exposure: `is_event_invitee(uuid, uuid)` and `is_event_participant` are already executable by `authenticated` (`20260929120000_evt01_event.sql:348`, `20260929140000_evt02_attendance.sql:420`) and answer the same question. Revoking it is a fair follow-up chore. | none | false |
| — | — | Before the directory read resolves on first open, every actor renders as *Former member* for a moment (`NotificationBell.tsx:178`). Cosmetic; no AC is broken. | none | false |

## Verdict

PASS. Advances to DONE.
