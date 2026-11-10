---
ticket: EVT-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-08T20:52:55+0700
inputs_read:
  - .ai/board/tickets/EVT-04/ticket.yaml
  - .ai/board/tickets/EVT-05/ticket.yaml
  - .ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-050-in-app-notifications-for-events-are-written-by-the-database.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-02/01-plan.md
  - .ai/board/tickets/EVT-03/01-plan.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/components/TopBar.tsx
  - src/components/AppShell.tsx
  - src/components/EventAttendancePanel.tsx
  - src/App.tsx
  - tests/seam-parity.test.ts
  - tests/ui-language.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-04 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT — Events without paraphrase:**

| ID | Title |
|----|-------|
| EVT-04 | A person is notified in the app when an event concerns them |

The row's Notes column is the scope, each clause the operator's answer in
`.ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md` § *Evidence*,
decided by ADR-050 (`ACCEPTED by product`, inside ADR-005 — no server): Q2 *"a đến e, bỏ f"* —
(a) a new event for my team or public; (b) invited by name; (c) my join request approved, rejected or
removed; (d) an event I take part in edited or cancelled; (e) the creator learns of a join request or
a withdrawal. **No reminders.** Rows are written by database triggers, one per recipient; a recipient
is only ever someone who can read the event (ADR-045 decision 3); nobody, admin included, reads
another person's notifications; the actor is not notified of their own action.

**Who gains what.** Today every event change is silent: an invitee finds out by browsing `/events`, a
requester by reopening the event, an attendee of a cancelled event on the day, and a creator's
pending requests wait until they happen to look (`EVT-02` 01-plan.md § *Out of scope*, *"A requester
learns the decision by opening the event"*). This ticket gives every approved member a bell in the top
bar that counts what is new for them and lists it, each line leading to the event. It is the first
thing in the product that is addressed to one person rather than shown to a team.

**Out of scope.**

- **Email in every form** — `EVT-05`, ADR-051, blocked on a provider (idea Q6). Nothing here sends,
  queues or stores anything for email, and the email sender ADR-051 admits must never write these rows
  (ADR-050 § *Rationale*, third rejection).
- **Reminders** before an event or a deadline (Q2-f) — they need a scheduler; none is added.
- **Any setting for in-app notifications** — no opt-out, no per-kind switch (idea § *Out of scope*).
- **Notifications about entries** — PTO/WFH approved or rejected, and anything else not an event.
- **Push, SMS, chat integrations, browser `Notification` API, sound.**
- **Live delivery.** No realtime subscription and no polling: the count refreshes when the shell
  loads, on every navigation, and when the panel opens (AC-17). A notification written while a person
  sits still on one screen appears at their next navigation.
- **Pruning and paging.** Rows are kept; the panel shows the 50 newest (AC-16). Overturns the idea's
  assumption 3 (*"kept 90 days"*): deleting old rows would need either a scheduler (ADR-050 decision
  6 forbids one) or a delete riding someone's unrelated write, and nothing in the product reads past
  the 50 newest anyway. If the table's growth proves a problem, pruning is a later ticket.
- **Marking unread, deleting or dismissing a notification.** Read is one-way.
- **Notifying people newly brought into an event by an edit** — widening an event's scope from named
  to own team or every team on edit notifies nobody under (a); (a) is for a *new* event. Newly
  **named** people are notified, under (b) (AC-3).
- **Notifying a creator when an admin edits, cancels or decides on their event**, and notifying admins
  of anything as admins. (d) is for people who *take part*; (e) is for the creator and is about
  joining and withdrawing only.
- **A notification for an instant join** on an event that needs no approval — (e) names *a join
  request*; on such an event there is no request (AC-7).
- **The `rbac-and-security.md` and `data-model.md` rows for `event`, `event_invitee` and
  `event_attendance`**, still owed to `/thuki` since `EVT-01`. This ticket writes only the
  notification rows ADR-050 § *Affected documents* assigns it.
- **`supabase/db.sql`** — MD-033 owns bringing it level, as for `EVT-01` and `EVT-02`.

**`size_estimate: M`** — one migration (one enum, one table, two policies, one RPC, one read helper,
one insert helper, seven trigger functions), four seam functions in both implementations, one new component in the top
bar, two tests, the glossary row and two standards entries. Section 7 counts the verdict.

## 2. Acceptance criteria

Vocabulary, in addition to `EVT-01`'s and `EVT-02`'s (*approved member*, *pending sign-up*, *can read
an event*, *audience*, *attendance*, *attendee*):

- **Approved member** — a member whose status is approved and who has not been removed. A pending or
  rejected sign-up and a removed member are not.
- **Takes part in** an event — has an attendance on it that is **pending** or **attending**. Matches
  the `EVT-03` marking and the database's `is_event_participant`.
- **The actor** — the signed-in person whose write caused the notification.
- **The bell** — `notification-bell` in the top bar; **the panel** — `notification-panel`, which it
  opens.
- **Straight to the datastore** — a request with the caller's own token that does not go through the
  screens; every refusal below is a property of the database.

### Who is notified, and of what

**AC-1 — (a) a new event for my team, or for everyone**
- Given an approved member creates an event whose scope is **own team**
- Then every other approved member of the creator's team receives one `event_created` notification,
  and nobody else does — not another team's members, and not an admin on another team, who can read
  the event but is not who it is for
- And when the scope is **every team**, every other approved member of every team receives one
- And when the scope is **named people**, nobody receives `event_created`; the named receive AC-2's

*A derivation: (a) is "a new event for my team or public", and a named-people event is neither — its
people are told by (b).*

**AC-2 — (b) invited by name**
- Given an event whose scope is **named people**
- When a person is named on it — at creation, or added on an edit
- Then that person receives one `event_invited` notification, unless they are the actor
- And a person already named, when the event is saved again, receives nothing new; a person taken off
  the list and later named again receives a second one

**AC-3 — (b) on an edit is for the newly named only**
- Given an event is edited so that its scope becomes named people, or new people are added to its list
- Then exactly the people newly on the list receive `event_invited`
- And widening a scope on an edit — named to own team, or anything to every team — sends no
  `event_created` to anyone (Out of scope)

**AC-4 — (c) my request approved, rejected, or my place removed**
- Given a person with a pending request on an event
- When the creator or an admin approves it, the person receives `attendance_approved`; when they
  reject it, the person receives `attendance_rejected`
- And given an attendee, when the creator or an admin removes them, the person receives
  `attendance_removed`
- And a creator who approves their own request on their own event (`EVT-02` AC-12) receives nothing

**AC-5 — (d) an event I take part in is changed**
- Given an event with people who take part in it
- When its creator or an admin saves a change to its name, description, location, start date, end
  date, scope, capacity, approval mode or registration deadline
- Then each person who takes part in it, other than the actor, receives one `event_updated`
- And a save that changes none of those nine — only the named list, or nothing at all — sends no
  `event_updated`
- And people who are named on the event or in its scope but do not take part receive nothing

*"Take part in" is read as the vocabulary above defines it — pending or attending — because a
pending requester is waiting on the event exactly as an attendee is, and both still read it after a
scope change (`EVT-02` AC-5). Rejected and removed people no longer take part.*

**AC-6 — (d) an event I take part in is cancelled**
- Given an event with people who take part in it
- When its creator or an admin deletes it
- Then each of them, other than the actor, receives one `event_cancelled`
- And that notification survives the event's deletion, still names the event, and no longer leads to
  it (AC-14)

**AC-7 — (e) the creator learns of a join request or a withdrawal**
- Given an event needing approval
- When a person in its audience requests to join, the creator receives `attendance_requested`
- And given anyone who takes part in an event — on an event needing approval or not — when they
  withdraw or cancel their own request (`EVT-02` AC-14), the creator receives `attendance_withdrawn`
- And a join on an event needing no approval sends nothing (Out of scope)
- And the creator is the actor when they join or leave their own event, and receives nothing then
- And attendances deleted because their event was deleted send no `attendance_withdrawn`

*A withdrawal is read as both leaving and cancelling a pending request: either way the creator's
picture of who is coming, or waiting, changed by someone else's hand. This plan's reading, marked.*

**AC-8 — never to someone who cannot read the event**
- Given any notification AC-1 to AC-7 would write
- Then it is written only when its recipient can read the event at that moment (`EVT-01` AC-5 to
  AC-8, `EVT-02` AC-5) — and so never to a pending sign-up, a rejected sign-up or a removed member
- And in particular a person whose request is rejected, or who is removed, on a named-people event
  they are no longer named on, receives **no** `attendance_rejected` / `attendance_removed` — once
  the attendance stops being pending or attending, nothing lets them read that event

*The second clause is ADR-050 decision 3 applied without exception. It is the one case where (c)
says nothing; recorded so it is not mistaken for a defect.*

**AC-9 — never to the actor, and only from a person**
- Given any write above
- Then the actor never receives a notification about it
- And a write made with no signed-in person — from the database console — writes no notification

*The second clause is this plan's decision: a notification names who caused it, and a console write
has nobody to name.*

**AC-10 — one row per recipient per occurrence**
- Given any single write
- Then each recipient receives at most one notification for it, whatever path reached them — an
  admin who is also an attendee of an edited event gets one `event_updated`, not two

### Reading them

**AC-11 — a person reads their own, and nobody reads anyone else's**
- Given notifications addressed to several people
- Then each approved member reads exactly the ones addressed to them, through the panel and straight
  to the datastore
- And no role — admin included — reads, counts or marks another person's notifications; a request
  for one straight to the datastore returns nothing and changes nothing (ADR-050 decision 4, revert
  condition 2)
- And a pending sign-up, a rejected sign-up or a removed member reads none, including ones written to
  them before their removal

**AC-12 — nobody writes or deletes one**
- Given any person, any role
- When they insert a notification, delete one, or change any of its fields other than marking it read,
  straight to the datastore
- Then it is refused and nothing changes (ADR-050 decision 2)

**AC-13 — the bell and its count**
- Given an approved member, on any screen inside the shell
- Then the top bar shows `notification-bell`
- And when they have unread notifications, `notification-unread-count` shows how many, reading `9+`
  above nine; with none it is absent
- And `notification-bell` carries `data-unread` with the exact number, `0` included

**AC-14 — the panel**
- Given the bell
- When it is pressed
- Then `notification-panel` opens, listing the caller's notifications newest first, each a
  `notification-item` with one English sentence naming the event, when it happened, and — unread —
  a dot
- And each sentence is per kind, as § 4.4 fixes, with the actor shown by display name, or as
  **Former member** when the directory no longer lists them
- And pressing an item marks it read and, when its event still exists, goes to `/events/:id` and
  closes the panel; an `event_cancelled` item is marked read and leads nowhere
- And pressing the bell again, pressing Escape, or pressing outside closes the panel

**AC-15 — mark all read**
- Given the panel with at least one unread item
- Then `notification-mark-all-read` is shown; pressing it marks every one of the caller's
  notifications read — not only those on screen — and the count disappears
- And with nothing unread the control is absent

**AC-16 — the 50 newest, and the empty state**
- Given a person with more than 50 notifications
- Then the panel lists the 50 newest, and the count still counts every unread one
- And given a person with none, the panel shows `notification-empty`, a short friendly line, instead
  of a list

**AC-17 — when the count refreshes**
- Given a notification is written for a signed-in person
- Then it appears in their count no later than their next navigation inside the shell, or the next
  time they open the panel — no reload needed

**AC-18 — opening an event it no longer lets me read**
- Given a notification whose event still exists but which its recipient can no longer read — they were
  taken off its named list since
- When they press it
- Then they reach `/events/:id`, which shows `EVT-01`'s existing *not found* state, and nothing about
  the event is disclosed beyond the name the notification already carried

### What it does not touch

**AC-19 — nothing about entries, the count or the grids changes**
- Given every write above
- Then no entry is created or changed, and the absence count, the overload state and every calendar
  view are unchanged; the member roster — `listMembers()` — returns exactly what it did before

**Invariants touched: `[]`.** Considered, none reachable. A notification is not an entry, so INV-01,
02, 03, 05, 06 and 07, which constrain entries, cannot be reached. INV-04 was considered through the
chain `EVT-01` and `EVT-02` listed it for — a cross-team read of people — and is not reached here:
recipients are enumerated inside `security definer` triggers that return nothing to any caller, no
policy on `public.member` is created, dropped or replaced, and the only person-identity a notification
carries is the actor's id, resolved to a name through `EVT-01`'s existing `list_member_directory()`.
`listMembers()` returns what it returned before; AC-19 asserts it. The idea's § *Constraints* reaches
the same conclusion for INV-04, INV-05 and INV-07.

**Open questions.** None. Every kind and every recipient rule is an operator answer (Q2) or an ADR-050
decision; a derivation (AC-1's named exclusion), this plan's reading (AC-5's *take part*, AC-7's
*withdrawal*) or this plan's decision (AC-9's console clause, AC-16's window and the retention change
in § 1) is marked where it is made. Of the idea's six assumptions: 2 (bell, count, mark all read) is
confirmed in AC-13 to AC-15; 3 (90 days) is overturned in § 1; 4 (actor not notified) is ADR-050
decision 5 and AC-9; 5 (cancelled stays readable and no longer links) is confirmed in AC-6 and AC-14;
1 and 6 are `EVT-05`'s.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

- **The bell** sits in the top bar's right cluster between `nav-events-link` and `+ Book`, as the same
  32-pixel round icon button the period arrows use (`ICON_BUTTON`), drawing a bell glyph, on every
  screen inside the shell, for every role. The unread count is a small pill in the primary colour
  overlapping its top-right corner, bold, white text.
- **The panel** drops below the bell, right-aligned to it, a card (`rounded-card`, `shadow-soft`) about
  360 pixels wide and at most 70% of the viewport tall, scrolling inside. At phone width it spans the
  pane with a 16-pixel gutter. Header row: *Notifications* on the left, *Mark all read* as a quiet text
  button on the right. Below, the list: each row is the sentence in `text-sm`, the time under it in
  `text-xs` grey (`8 Oct, 14:05`, the reader's local time), and a small primary-colour dot on the left
  when unread; unread rows sit on the faint card tint, read rows on plain card. An `event_cancelled`
  row has no hover state and its event name is struck through.
- **Empty:** a centred line, *All quiet. When an event concerns you, it lands here.* — one of the few
  places charm is allowed (`CLAUDE.md` § *Visual direction*).
- No new route, no change to `/events`, `/events/:id` or any calendar screen.

## 3. Permission model

**Every check below is held in PostgreSQL** — one select and one update policy, column grants, and
seven `security definer` trigger functions — per ADR-005. Nothing here is a server. Anything the seam
or the screen does first is an affordance and says so in a comment.

| Action | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|
| Read own notifications | ✅ | ✅ | ✅ | `notification_select_own`: `recipient_id = uid and member_team_id(uid) is not null` |
| Read another person's | ❌ | ❌ | ❌ **ADR-050 decision 4** | same — no admin clause, deliberately |
| Mark own read | ✅ | ✅ | ✅ | `notification_update_own` (same predicate, using and check); `update (read_at)` is the only update grant |
| Mark another person's read | ❌ | ❌ | ❌ | same |
| Change any other column of one | ❌ | ❌ | ❌ | no update grant on any column but `read_at` (42501) |
| Insert a notification | ❌ | ❌ | ❌ | no insert grant, no insert policy; only the definer triggers write (ADR-050 decision 2) |
| Delete a notification | ❌ | ❌ | ❌ | no delete grant, no delete policy |
| Anything above as a pending, rejected or removed person | ❌ | ❌ | ❌ | `member_team_id(uid) is not null` in both policies |
| Be a recipient | only while they can read the event | same | same | every trigger filters recipients through `public.may_read_event(event_id, recipient)` (AC-8) |
| Be notified of one's own action | ❌ | ❌ | ❌ | every trigger excludes `auth.uid()`, and writes nothing when it is null (AC-9) |

**What an admin must not be able to do**, stated because every other events policy has an admin
clause and copying one here would be the natural mistake: read, count or mark anybody else's
notifications. `notification_select_own` and `notification_update_own` have **no `is_admin`
disjunct**, and the test asserts the admin's denial by name.

**Why the triggers are `security definer`.** The writer is the database acting on a user's write, and
the rows it writes are addressed to other people — exactly the insert ADR-050 § *Rationale* refuses to
give any client. A definer function inserting under the table owner is the only writer; no grant
lets a session insert. Each trigger function computes recipients from a fixed predicate over `member`,
`event`, `event_invitee` and `event_attendance` and returns nothing to the caller.

**`may_read_event` is a second copy of `event_select_visible`'s predicate**, keyed on a given uid
instead of `auth.uid()`. It must stay clause-for-clause equal to the policy; § 8 alternative 2 records
why the policy is not rewritten to call it, and the unit test asserts both say the same thing over the
mock's single `mayReadEvent`. A future change to `event_select_visible` must change both — the
migration header and the helper's own comment say so.

**Interface affordances, not controls:** the bell renders only inside the shell, which only an
approved member reaches; the panel only lists what the seam returned.

**Where this plan cannot be verified today.** As `EVT-01` § 3 records, `tests/permission-model.test.ts`
against a real PostgreSQL is still owed project-wide. The mock reproduces every policy and every
trigger above; the migration is asserted by reading the file, as `tests/events.test.ts` does. The
migration header says it has not been run against PostgreSQL.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Appended after the `EVT-02` block. **Additive; no existing type changes.**

```ts
// ---------------------------------------------------------------------------
// EVT-04 — notifications. 01-plan.md section 4.1. ADR-050.
// ---------------------------------------------------------------------------

/** EVT-04. The nine kinds, the database enum's values verbatim. (a) `event_created`; (b)
 *  `event_invited`; (c) `attendance_approved`, `attendance_rejected`, `attendance_removed`;
 *  (d) `event_updated`, `event_cancelled`; (e) `attendance_requested`, `attendance_withdrawn`. */
export type NotificationKind =
  | "event_created"
  | "event_invited"
  | "event_updated"
  | "event_cancelled"
  | "attendance_requested"
  | "attendance_withdrawn"
  | "attendance_approved"
  | "attendance_rejected"
  | "attendance_removed";

/** EVT-04. Glossary *Notification*. One row of `public.notification`. Named `EventNotification`, not
 *  `Notification`, because `Notification` is the DOM global — `CalEvent`'s reason. */
export interface EventNotification {
  id: string;
  /** Always the caller — the policy returns nothing else. Carried so the row is the table's shape. */
  recipientId: string;
  kind: NotificationKind;
  /** Null once the event is deleted (`event_cancelled` is written with null from the start). */
  eventId: string | null;
  /** The event's name when the notification was written. Survives the event's deletion. */
  eventName: string;
  /** Who caused it. Resolved to a name through `listMemberDirectory()`, or *Former member*. */
  actorId: string;
  createdAt: string;
  /** Null while unread. */
  readAt: string | null;
}

/** EVT-04, AC-16. The panel's window: the newest this many, never more. NOT a truncation of a
 *  derivation — nothing is computed from the list — so it is a window, not a bound that throws. Must
 *  not exceed DATASTORE_MAX_ROWS. */
export const NOTIFICATION_LIMIT = 50;
```

No new `FailureCode`. The two writes can fail only on the network or an unexpected error, which map to
the existing `network` and `unknown` with an English sentence; a row that is not the caller's is
filtered by the policy and changes nothing, which is not a failure the caller can act on (§ 4.3).

### 4.2 Seam — `src/lib/data/index.ts`

```ts
  // -------------------------------------------------------------------------
  // EVT-04 — notifications. 01-plan.md section 4.2. ADR-050.
  //
  // Four functions. Every row is written by a trigger in
  // `supabase/migrations/20261008120000_evt04_notification.sql`; NO SEAM FUNCTION WRITES ONE. Reads
  // and marks are the caller's own rows only — the policy has no admin clause (AC-11).
  // -------------------------------------------------------------------------

  /** EVT-04 AC-14, AC-16. The caller's notifications, newest first (`createdAt` desc, then `id`
   *  desc), at most NOTIFICATION_LIMIT. Empty for a caller with no member row or no team. Throws on a
   *  read failure, as the other reads do. */
  listNotifications(): Promise<EventNotification[]>;

  /** EVT-04 AC-13. The exact number of the caller's notifications with `readAt` null — all of them,
   *  not only the window. 0 for a caller with no member row or no team. Throws on a read failure. */
  countUnreadNotifications(): Promise<number>;

  /** EVT-04 AC-14. Sets `readAt` on one of the caller's notifications if it is unread. Already read,
   *  or not the caller's: ok, and nothing changes — the same answer, so it confirms nothing. */
  markNotificationRead(notificationId: string): Promise<Result<void>>;

  /** EVT-04 AC-15. Sets `readAt` on every unread notification of the caller's, beyond the window too.
   *  Returns how many were marked. */
  markAllNotificationsRead(): Promise<Result<number>>;
```

Both writes call one RPC, `public.mark_notifications_read`, so `readAt` is the database's clock, not
the browser's. Failure sentences are English, written by the Developer, repeated verbatim in both
implementations as the event sentences are.

### 4.3 Database — `supabase/migrations/20261008120000_evt04_notification.sql`

Names are fixed by this plan (RULE-04). The Developer writes the SQL; these are its shapes.

```sql
create type public.notification_kind as enum (
  'event_created', 'event_invited', 'event_updated', 'event_cancelled',
  'attendance_requested', 'attendance_withdrawn',
  'attendance_approved', 'attendance_rejected', 'attendance_removed'
);

create table public.notification (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.member(id),                       -- restrict
  kind         public.notification_kind not null,
  event_id     uuid null references public.event(id) on delete set null,          -- § 6
  event_name   text not null,
  actor_id     uuid not null references public.member(id),                       -- restrict
  created_at   timestamptz not null default now(),
  read_at      timestamptz null
);

create index if not exists notification_recipient_created
  on public.notification (recipient_id, created_at desc);
```

Functions — `set search_path = ''`, schema-qualified throughout:

- **`public.may_read_event(p_event_id uuid, p_uid uuid) returns boolean`** — definer, `stable`.
  `event_select_visible`'s predicate as `EVT-02` left it, clause for clause, with `p_uid` for
  `auth.uid()`: `member_team_id(p_uid) is not null` and the event exists and (`is_admin(p_uid)` or
  `creator_id = p_uid` or `scope = 'public'` or (`scope = 'team'` and `team_id =
  member_team_id(p_uid)`) or (`scope = 'named'` and `is_event_invitee(id, p_uid)`) or
  `is_event_participant(id, p_uid)`).
- **`public.notify(p_recipients uuid[], p_kind public.notification_kind, p_event_id uuid,
  p_event_name text)`** — definer, `volatile`, returns `void`. The single insert path. Writes nothing
  when `auth.uid()` is null (AC-9). Inserts one row per **distinct** recipient (AC-10), skipping
  `auth.uid()` (AC-9) and, when `p_event_id` is not null, any recipient for whom
  `may_read_event(p_event_id, recipient)` is false (AC-8); `actor_id := auth.uid()`. For
  `event_cancelled`, called with the event id for the read check and inserting `event_id` null (the
  row is about to go).

  *Recorded precisely because it is the one subtle line:* the read check uses `p_event_id`, the insert
  uses `case when p_kind = 'event_cancelled' then null else p_event_id end`.
- **Seven trigger functions**, each definer, each calling `notify` once:

| Function | Trigger | Fires | Recipients → kind |
|---|---|---|---|
| `notify_event_created()` | `notify_event_created` | `after insert on event`, row | scope `team`: approved members with `member_team_id(m) = new.team_id`; scope `public`: every approved member; scope `named`: none → `event_created` |
| `notify_event_updated()` | `notify_event_updated` | `after update on event`, row, **when** any of `name, description, location, start_date, end_date, scope, capacity, requires_approval, registration_deadline` is distinct | members whose attendance is `pending` or `attending` → `event_updated` |
| `notify_event_cancelled()` | `notify_event_cancelled` | **`before delete`** on `event`, row — before the attendance cascade empties the table | same participants → `event_cancelled` |
| `notify_event_invited()` | `notify_event_invited` | `after insert on event_invitee`, row | `new.member_id` → `event_invited` |
| `notify_attendance_inserted()` | `notify_attendance_inserted` | `after insert on event_attendance`, row, **when** `new.status = 'pending'` | the event's `creator_id` → `attendance_requested` |
| `notify_attendance_changed()` | `notify_attendance_changed` | `after update of status on event_attendance`, row, **when** `old.status is distinct from new.status` | `new.member_id` → `attendance_approved` / `attendance_rejected` / `attendance_removed` by `new.status` |
| `notify_attendance_deleted()` | `notify_attendance_deleted` | `after delete on event_attendance`, row, **when** `old.status in ('pending','attending')` | the event's `creator_id` → `attendance_withdrawn` — **only when `old.member_id = auth.uid()` and the event still exists** (so neither a cascade from the event's deletion nor any other path fires it, AC-7) |

"Approved member" in the recipient column is `member_team_id(m.id) is not null`, which
carries `status = 'approved'` and `removed_at is null`.

- **`public.mark_notifications_read(p_ids uuid[] default null) returns integer`** — **security
  invoker**, `volatile`. `update public.notification set read_at = now() where recipient_id =
  (select auth.uid()) and read_at is null and (p_ids is null or id = any (p_ids))`; returns the row
  count. Invoker, so it adds a server clock and nothing else — the policy and the grant still decide.

Policies — `to authenticated`, `(select auth.uid())` wrapped, `drop … if exists` then `create`:

| Policy | On | Predicate |
|---|---|---|
| `notification_select_own` | `notification` select | `recipient_id = uid and member_team_id(uid) is not null` |
| `notification_update_own` | `notification` update | using and check: the same |

Grants — `revoke all … from anon, authenticated` first (Supabase's default privileges), then:

```sql
grant select on public.notification to authenticated;
grant update (read_at) on public.notification to authenticated;
-- execute: revoke from public, anon on every function above; grant to authenticated on
-- may_read_event, mark_notifications_read and the seven trigger functions; NOT on notify — no
-- session calls it directly. The trigger functions reach it as its definer.
```

`notify` gets **no** execute grant to `authenticated`: called through the RPC surface it would let a
caller write notifications to anyone. Trigger functions run with their owner's rights and reach it.

### 4.4 The sentences — `src/components/NotificationBell.tsx`

Exported pure function, so the unit test reads it without rendering:

```ts
/** EVT-04 AC-14. One English sentence per kind. `actor` is a display name or "Former member";
 *  `event` is `EventNotification.eventName`. */
export function notificationSentence(kind: NotificationKind, actor: string, event: string): string;
```

| Kind | Sentence |
|---|---|
| `event_created` | `{actor} announced {event}.` |
| `event_invited` | `{actor} invited you to {event}.` |
| `event_updated` | `{actor} changed {event}.` |
| `event_cancelled` | `{actor} cancelled {event}.` |
| `attendance_requested` | `{actor} asked to join {event}.` |
| `attendance_withdrawn` | `{actor} withdrew from {event}.` |
| `attendance_approved` | `Your request to join {event} was approved.` |
| `attendance_rejected` | `Your request to join {event} was declined.` |
| `attendance_removed` | `You were removed from {event}.` |

The three (c) sentences deliberately do not name who decided, as `EVT-02`'s `event-my-status` does not.

### 4.5 Selectors

| Id | Where | AC |
|---|---|---|
| `notification-bell` | top bar button, `aria-label="Notifications"`, `aria-expanded`; carries `data-unread` | AC-13 |
| `notification-unread-count` | the pill on the bell; absent at 0; `9+` above 9 | AC-13 |
| `notification-panel` | the panel, `role="dialog"`, `aria-label="Notifications"` | AC-14 |
| `notification-item` | each row; `data-notification-id`, `data-kind`, `data-read="true"|"false"`, `data-event-id` (empty when null) | AC-14, AC-16 |
| `notification-mark-all-read` | panel header; absent when nothing unread | AC-15 |
| `notification-empty` | panel, instead of the list | AC-16 |

**`TopBar.tsx` renders `<NotificationBell />`** between `nav-events-link` and the `+ Book` link,
outside every condition. Its header says it makes no seam call; the bell is a child component that
does, as `ReportIssueButton` is beside the shell — the header gains one sentence saying so and nothing
else in the file changes.

**Refresh (AC-17):** `countUnreadNotifications()` on mount and whenever `useLocation().pathname`
changes; `listNotifications()` and the count each time the panel opens; both again after a mark. The
actor names come from one `listMemberDirectory()` call on the first open, cached for the life of the
component.

## 5. Seam impact

**Four functions added:** `listNotifications`, `countUnreadNotifications`, `markNotificationRead`,
`markAllNotificationsRead` — each in `index.ts`, `supabase.ts` and `mock.ts` with the same name and
arity, which `tests/seam-parity.test.ts` checks without edit.

**No existing function changes signature.** The mock's `createEvent`, `updateEvent`, `deleteEvent`,
`joinEvent`, `leaveEvent`, `decideAttendance` and its invitee writer gain the trigger reproduction in
their bodies; their contracts are unchanged.

- **`supabase.ts`**: `from("notification").select(<the eight columns>).order("created_at", { ascending:
  false }).order("id", { ascending: false }).limit(NOTIFICATION_LIMIT)`; the count is a `head: true`,
  `count: "exact"` select `.is("read_at", null)`; both marks are `rpc("mark_notifications_read", {
  p_ids: [id] })` and `{ p_ids: null }`. A `toNotification` row mapper beside `toEvent`.
- **`mock.ts`**: an in-memory `notifications` array, emptied by the existing `__resetEvents()` (a
  notification is about an event). One `notify(recipients, kind, event, actorId)` helper reproducing
  § 4.3's `notify` over the existing `mayReadEvent` and `memberTeamId`, called from each of the seven
  trigger points **after** the write it reacts to — except `event_cancelled`, called **before** the
  event and its attendances are removed. Reads and marks filter on `recipientId === currentMemberId`
  and `memberTeamId(currentMemberId) !== null`, with no admin clause.
- **`listMembers()` and every policy on `public.member` are untouched.**

**Invariants — how each is held (R8).** None touched (§ 2). The INV-04 fence `EVT-01` and `EVT-02`
hold is not disturbed: the test reads the migration and asserts it contains no `on public.member`
policy statement, and asserts `listMembers()` returns the same rows before and after a fan-out
(AC-19).

**Tests — `tests/notifications.test.ts`** against the mock, one `describe` per AC group; at minimum
every AC-1 to AC-12 recipient rule, each denial in § 3 by role (the admin's by name), AC-10's
single-row case, AC-16's window, the migration-reading assertions above, and `notificationSentence`
for all nine kinds. **`tests/e2e/evt-04-notifications.spec.ts`** drives AC-13 to AC-16 through the
screen: one member creates a team event, a teammate sees the count, opens the panel, presses the item,
lands on the event, and the count drops; mark all read; the empty state.

## 6. Schema delta

**One enum, one table and its index, one read helper, one insert helper, seven trigger functions and
seven triggers on `event`, `event_invitee` and `event_attendance`, one RPC, two policies, and their
grants** — § 4.3. Not `none`: triggers and policies (ADR-014).

**ADR:** [ADR-050](../../../registry/decisions/ADR-050-in-app-notifications-for-events-are-written-by-the-database.md),
`ACCEPTED by product`, which `ticket.yaml`'s `requires_adr: true` cites. Inside its fence: rows are
written by the database (decision 2), to readers only (3), read by their recipient only (4), never to
the actor (5), with no scheduler (6).

**No existing policy, trigger or function is replaced.** `event_select_visible`, every `EVT-02`
guard and `save_event` are untouched; the new triggers are additional. On `event` the existing
`before` triggers (`event_stamp`, `event_capacity_guard`) run first and may refuse; an `after`
trigger only runs on a write that succeeded. `notify_event_cancelled` is a `before delete` trigger,
so a delete the policy filters never reaches it, and a delete that later fails rolls its rows back
with it.

**The reference to the event is `on delete set null`, chosen** (ADR-050 § *Consequences*: *"cannot
cascade-delete them"*). It is the first `set null` in the schema; data-model.md objects to a cascade
nobody chose, and this one is chosen here. `event_name` is the snapshot that makes a nulled reference
still readable. `recipient_id` and `actor_id` stay restrict, as every other reference to `member`
does — a member row is never deleted (ADR-013).

**Growth.** A public event writes one row per approved member (ADR-050 § *Consequences*). Nothing
prunes (§ 1). The index serves the only two reads.

**Applying it is human** (RULE-09). Idempotent in ADR-024's shape — a guarded `do` block for the enum,
`create table if not exists`, `create index if not exists`, `create or replace` for functions, `drop …
if exists` then `create` for triggers and policies — one transaction, and the header says it has not
been run against PostgreSQL. `supabase/db.sql` is not updated (MD-033).

**Standards written by this ticket** (ADR-050 § *Affected documents*): a `### notification` entity in
`.ai/standards/data-model.md` § *Entities*, transcribed from § 4.3 including the `set null` choice, and
the § 3 rows in `.ai/standards/rbac-and-security.md` § *The permission table*. Nothing else in either
file changes.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - ".ai/standards/data-model.md"
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261008120000_evt04_notification.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/components/NotificationBell.tsx"
  - "src/components/TopBar.tsx"
  - "tests/notifications.test.ts"
  - "tests/e2e/evt-04-notifications.spec.ts"
```

**Glossary:** the *Notification* row was written at this stage (ADR-047), and is the only glossary
change.

**Twelve paths: `size: M`, agreeing with `size_estimate: M` — at the ceiling.** A thirteenth makes this
`L`, which must split; the Developer stops and says so rather than adding one. **Deliberately absent:**
`src/components/AppShell.tsx` (the bell lives in the top bar); `src/App.tsx` (no route);
`src/routes/EventDetail.tsx` (AC-18 is its existing not-found state); `tests/events.test.ts`,
`tests/event-attendance.test.ts` and the `evt-0x` specs (no contract they use changes — if one fails,
a write path's behaviour changed, and the Developer stops); `supabase/db.sql` (MD-033). The schema
change is covered by an accepted ADR, which is how `EVT-01` and `EVT-02` were sized M under the same
table.

## 8. Rejected alternatives

**1. One generic trigger function on each table, branching on `tg_op` and columns, instead of seven
narrow ones.** Fewer objects, one place to read. Rejected: the recipient rule is different for every
kind, and a single function per table becomes a switch whose branches share nothing but a name — the
`when` clause on each trigger would have to move inside, so every write to `event` would enter the
function to discover it has nothing to do. Seven triggers, each with its `when`, say in the catalogue
exactly which write notifies whom.

**2. Rewriting `event_select_visible` to call `may_read_event(id, auth.uid())`, so there is one copy of
the predicate.** Genuinely attractive — it removes § 3's drift risk. Rejected for this ticket: it
replaces a policy every event read depends on, in a ticket whose subject is not reading events, and
`EVT-01` § 8 rejected exactly that shape (a definer function that loses a clause leaks across every
team at once, where a policy fails closed). The drift risk is held instead by the mock having one
function for both, the parity assertion in the test, and comments at both sites. Unifying them is a
fair later ticket with its own review.

**3. Deriving notifications on read, with only a per-person *last seen* timestamp.** ADR-050
§ *Rationale* rejected the no-table form; this is the cheaper variant with one column. Rejected: it
cannot say an event was cancelled (the event is gone), cannot say a request was declined without
storing per-attendance history, and a per-person timestamp makes *mark one read* impossible — AC-14.

**4. Pruning rows older than 90 days inside `notify`** — the idea's assumption 3, riding an existing
write as ADR-050 § *Consequences* allows. Rejected: it makes every event write delete other people's
rows as a side effect, under a definer function, which is a write nobody asked for in a place nobody
reviews it; and with a 50-row window nothing older is ever shown. Recorded in § 1 as a later ticket if
growth demands it.

## Changelog

- `2026-10-08T20:52:55+0700` — process note, not a content change. The *Notification* glossary row
  was appended a moment before `.ai/registry/glossary.md` was written into `allowed_paths`, the
  reverse of `/plan`'s ordering instruction (RULE-03 reads the list at the edit). The row and the path
  are both as intended. Raised by `tech-lead-design`.
