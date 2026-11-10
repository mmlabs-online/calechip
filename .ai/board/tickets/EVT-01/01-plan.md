---
ticket: EVT-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-29T10:24:22+0700
inputs_read:
  - .ai/board/tickets/EVT-01/ticket.yaml
  - .ai/board/tickets/EVT-02/ticket.yaml
  - .ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/registry/decisions/ADR-046-evt-is-a-fifth-feature-group.md
  - .ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md
  - .ai/00-charter.md
  - .ai/01-operating-model.md
  - .ai/board/model-debt.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/tech-stack.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/coding-standards.md
  - .ai/templates/plan.md
  - .ai/board/tickets/CAL-11/ticket.yaml
  - .ai/board/tickets/CAL-11/01-plan.md
  - .ai/board/tickets/UIE-10/ticket.yaml
  - supabase/db.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260922150000_cal11_cross_team_reads.sql
  - src/App.tsx
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - tests/seam-parity.test.ts
  - tests/e2e/seam.setup.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-01 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT — Events without paraphrase:**

| ID | Title |
|----|-------|
| EVT-01 | A member announces an event to their own team, to named people, or to every team, and those it is for can read it |

The row's Notes column is the scope, each clause an operator answer in
`.ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md` § *Evidence*:
any approved member of any rank creates (Q3); name required, description and location optional free
text (Q14); a start date and an end date, no times (Q11); three scopes — own team only (Q6), named
people from any team (Q5), or public to every approved member of every team with pending sign-ups
excluded (Q4); a named-people event is invisible to everyone else including the creator's own team
(Q25); creator and admin edit and delete (Q9); admin reads every event regardless of scope or team
(Q24); manager gains nothing (Q9, Q24). The invitee picker reads a narrow projection through a
dedicated read, and `member_select_team` and every other select policy on `public.member` are never
widened (ADR-045 point 4).

**Who gains what.** Every approved member — `member`, `manager` and `admin` alike — gains the power to
announce a gathering and to say exactly who it is for: their own team, a hand-picked set of people
from any team, or everyone. The people it is for can find it in one place instead of in a chat
thread; the people it is not for cannot see that it exists. That second half is the whole of the
risk: this is the first read a non-admin has ever had across a team boundary, so the denials are
specified as carefully as the grants.

**Out of scope.**

- **Joining, requesting, withdrawing, deciding a request, removing an attendee, capacity, approval
  mode, registration deadline and the attendee list** — all `EVT-02`, which depends on this ticket.
  No column, control or copy for any of them lands here.
- **Email, in every form** (Q20). A later idea with its own ADR against ADR-005.
- **Any rendering on the month, week or year grids, and any link to an entry or the absence count**
  (Q2, ADR-045 point 2).
- **Times of day** (Q11).
- **A team scope naming another team** (Q6).
- **Pending, rejected or removed people seeing events or appearing in the picker** (Q4, Q5).
- **Any new power for `manager`** (Q9, Q24).
- **Recurring events, reminders, comments, calendar export** — not requested.
- **The standards rows ADR-045 § *Affected documents* lists** — the event rows in
  `.ai/standards/rbac-and-security.md` and the tables in `.ai/standards/data-model.md`. The ticket
  shell says they are owed by this ticket; `CLAUDE.md` § *Two planes* makes `.ai/standards/**`
  human-only and no shipped ticket has ever carried a standards path in `allowed_paths` (CAL-11's
  shell records the same rows as `/thuki`'s). This plan's § 3 and § 4 are the transcription source;
  landing them is `/thuki`'s, on an `ops/` branch.
- **The charter amendment.** Already on disk — `.ai/00-charter.md:53-75` carries *Amended 2026-09-29
  by ADR-045*, landed by `c3e00cc`. Not in `allowed_paths`.

**`size_estimate: M`** — one migration (two tables, their policies, one definer read), the seam in
both implementations, three screens and their tests. Section 7 counts the verdict.

## 2. Acceptance criteria

Vocabulary used below. *Approved member*: a `public.member` row with `status = 'approved'`, a team,
and `removed_at` null, of any role. *Pending sign-up*: a row with `status = 'pending'`. *Scope* is one
of **own team**, **named people**, **every team**. *Can read an event*: the event appears on the
caller's events list and its detail page opens; through the data seam, `listEvents()` includes it and
`getEvent(id)` returns it. *Cannot read*: the event is absent from the list, the detail page shows the
not-found state, and `getEvent(id)` returns `null` — never an error that confirms the event exists.

### Creating

**AC-1 — any approved member creates an event**
- Given an approved member of any role (`member`, `manager` or `admin`)
- When they submit the create form with a name, a start date, an end date and a scope
- Then the event is saved with them as its creator, and they land on its detail page showing every
  field they entered

**AC-2 — the name is required; description and location are not**
- Given the create form
- When the name is empty or only whitespace
- Then nothing is saved and the form shows `event-form-error` naming the name field
- And when description and location are both left empty, the event saves, and its detail page shows
  neither field rather than an empty label

**AC-3 — dates only, and the end is not before the start**
- Given the create form
- When the end date is before the start date
- Then nothing is saved and `event-form-error` says so
- And the same write sent straight to the datastore with the caller's own token is refused by the
  database
- And the form offers no time-of-day input anywhere (Q11)

*AC-3's refusal is a derivation, not an operator answer: Q11 says "a start date and an end date", and
an end before the start describes no dates at all. Recorded so it is not mistaken for a stated rule.*

**AC-4 — the creator and the team are the caller's, whatever the request says**
- Given an approved member of team A
- When they create an event by a request straight to the datastore, with their own token, naming a
  creator id that is not their own
- Then the write is refused
- And when a create or an edit sent the same way names any team at all, it is refused; an
  **own team** event is always scoped to its creator's team, and there is no control, and no
  accepted input, that selects another team (Q6)

### Who can read it

**AC-5 — own team**
- Given an **own team** event created by a member of team A
- Then every approved member of team A — `member`, `manager` and `admin` — can read it
- And an approved `member` or `manager` of team B cannot read it

**AC-6 — every team**
- Given an **every team** event created by a member of team A
- Then every approved member of every team can read it
- And a pending sign-up cannot read it, nor any other event (Q4)

**AC-7 — named people**
- Given a **named people** event created by member X of team A, naming member Y of team B
- Then X can read it, Y can read it, and every admin can read it
- And an approved `member` or `manager` of team A who is not named cannot read it — being on the
  creator's team grants nothing (Q25)
- And an approved `member` or `manager` of team B who is not named cannot read it

**AC-8 — admin reads everything**
- Given events of every scope created by members of teams A and B
- When an admin of either team lists events
- Then every one of them appears (Q24)

**AC-9 — nobody outside the product reads anything**
- Given a person who is a pending sign-up, a rejected sign-up, or a member with `removed_at` set
- Then they can read no event, including one they created or were named on before they were removed
- And they cannot create one

*The removed-member clause is product's guess in the idea (§ Guesses), confirmed here: it is how every
other read in the product already treats a removed member.*

### Choosing who is named

**AC-10 — the picker lists approved members of every team, and only a narrow projection of them**
- Given the create or edit form with scope **named people**
- When the picker opens
- Then it lists every approved member of every team except the caller, grouped under their team's
  name, each showing display name and avatar
- And it lists no pending sign-up, no rejected sign-up, and no member with `removed_at` set
- And the read behind it returns, per person, their id, display name, avatar, team id and team name —
  and no role, no status, no `removed_at`
- And a pending sign-up calling the same read receives an empty list

**AC-11 — only an approved member can be named**
- Given a named-people event
- When a save — through the form, or straight to the datastore — names an id that is a pending
  sign-up, a rejected sign-up, a removed member, or no member at all
- Then that write is refused

**AC-12 — the roster does not widen**
- Given this ticket is shipped
- When an approved `member` or `manager` of team A opens the member list, or calls `listMembers()`
- Then they receive exactly the rows they received before this ticket — no row whose team is not A
  (ADR-045 revert condition 1, ADR-018's revert condition)

**AC-13 — who sees the invite list**
- Given a named-people event
- Then its creator and every admin see the list of people named on its detail page
- And a person who is named sees the event but not who else is named

*AC-13's denial is the default convention of `.ai/standards/rbac-and-security.md` — deny until
decided — not an operator answer. Nobody was asked whether invitees see each other. Widening it later
is a policy change and a decision; narrowing it after ship would be a leak already made.*

### Changing and removing it

**AC-14 — the creator edits every field**
- Given the creator of an event
- When they change its name, description, location, dates, scope or the people named
- Then the change is saved, and who can read the event follows the new state at once: a person
  removed from the named list, or left out by a narrower scope, can no longer read it; a person added,
  or included by a wider scope, can

**AC-15 — the creator deletes an event**
- Given the creator on the event's detail page
- When they choose delete, the confirmation names the event, and they confirm
- Then the event and its named list are gone for every reader, and they land on the events list
- And when they cancel the confirmation, nothing changes

**AC-16 — an admin edits and deletes any event, and the creator stays the creator**
- Given an admin and an event created by someone else, in any scope, on any team
- When the admin edits it or deletes it
- Then the change is saved as for the creator (AC-14, AC-15)
- And after an edit the event's creator is still the original creator, and an **own team** event
  stays scoped to the creator's team, not the admin's

**AC-17 — no one else edits or deletes**
- Given an approved `member` or `manager` who did not create an event they can read
- Then its detail page shows no edit or delete control
- And an update or delete sent straight to the datastore with their own token is refused, and the
  event is unchanged
- And the same holds for every write to its named list

### What it does not touch

**AC-18 — an event is not an entry**
- Given an event covering some dates
- Then no entry is created for anyone, the month, week and year views are unchanged, and the absence
  count and overload state of every date are unchanged (Q2)

### The screens (layout — see § 2b)

**AC-19 — where it lives**
- Given any approved member on any screen with the app's navigation
- Then the navigation carries an **Events** link, `nav-events-link`, which opens the events list

**AC-20 — the events list at rest**
- Given an approved member who can read at least one event
- When the events list opens
- Then the top of the page carries the heading and a `events-new-button` control
- And events whose end date is today or later appear under **Upcoming**, soonest start first; events
  whose end date is before today appear under **Past**, most recent start first
- And each event is one row, `event-row`, showing name, date range, a scope badge
  (`Own team` / `Named people` / `Every team`) and the creator's display name
- And activating a row opens that event's detail page

**AC-21 — the events list, empty**
- Given an approved member who can read no event
- When the events list opens
- Then `events-empty` shows a short invitation to create the first one, with the same create control;
  no empty **Upcoming** or **Past** heading is drawn

**AC-22 — the detail page**
- Given a person who can read an event
- When its detail page opens
- Then it shows, top to bottom: name; date range; scope badge; creator; location (if set);
  description (if set); and, for the creator and admins on a named-people event, the named list
  (AC-13)
- And for the creator and admins, `event-edit-button` and `event-delete-button` sit beside the name
- And for anyone who cannot read the event, or for an id that does not exist, the page shows
  `event-not-found` and nothing else — the two are indistinguishable

**AC-23 — the form**
- Given the create form, or the edit form for an event the caller may edit
- Then it shows, top to bottom: name; start date and end date side by side; scope as three choices;
  the picker, only while **Named people** is chosen; location; description; save and cancel
- And the edit form opens holding the event's current values, including the people named
- And a creator who creates the event lands on its detail page; cancelling returns to where they came
  from without saving

**Invariants touched: `[INV-04]`.** INV-04's denominator is `listMembers()` for a team, which returns
whatever the select policies on `public.member` return — the 2026-09-11 migration header and ADR-045
§ *Rationale* both record that a widened member policy silently changes the absence count for every
team. This ticket introduces the first cross-team read of member identity, so INV-04 is plausibly
reached through that chain even though no entry is touched. Held by: the picker read is a separate
definer function and no policy on `public.member` changes — AC-12 asserts it from outside. No other
invariant is reachable: an event is not an entry (INV-01, 02, 03, 05, 06 constrain entries), and
INV-07 counts entries, which no event creates (AC-18).

**Open questions.** None. Every behaviour above is an operator answer in the idea's § *Evidence*, a
guess of product's confirmed here and marked (AC-9), a derivation marked (AC-3), or a default denial
marked (AC-13). The screen arrangement is this plan's own — § 2b.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

**The layout, as a whole.** One new top-bar control, three new screens, no change to any existing
screen's arrangement. An **Events** pill sits in the top bar immediately before **+ Book**, on every
shell screen for every role (AC-19). `/events` is a single column: heading and **New event** on one
line, then **Upcoming**, then **Past**, each a stack of compact rows (AC-20), or the empty state alone
(AC-21). `/events/:id` is a single card, read top to bottom (AC-22). `/events/new` and
`/events/:id/edit` are one form (AC-23). Scope badges reuse the pastel set: **Own team** mint,
**Named people** lavender, **Every team** peach — decorative only, never the sole carrier of the scope,
which is always also written as text. The picker is an inline, scrollable checklist grouped under
team-name subheadings with a text filter above it — not a modal, so the form never stacks a dialog on
a dialog when the delete confirmation exists on the same route family. Nothing here touches the
calendar grids (AC-18).

## 3. Permission model

**Every check below is held in PostgreSQL** — policies, column grants, a constraint, and two
`security definer` helpers — per ADR-005. Every check in the seam or the interface is an affordance
and carries a comment saying so.

| Action | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|
| Create an event (any scope) | ✅ | ✅ | ✅ | `event_insert_own`: `creator_id = auth.uid()` and the caller has a team (approved, not removed) |
| Create or edit naming a creator or a team | ❌ | ❌ | ❌ | **Withheld column privilege** on `creator_id`, `team_id`, `created_at`, `updated_at` — refused `42501` before any policy runs (TEA-04's shape) |
| Read an own-team event of their own team | ✅ | ✅ | ✅ | `event_select_visible` |
| Read an own-team event of another team | ❌ | ❌ | ✅ (Q24) | `event_select_visible` |
| Read an every-team event | ✅ | ✅ | ✅ | `event_select_visible` |
| Read a named-people event they created or are named on | ✅ | ✅ | ✅ | `event_select_visible` via `public.is_event_invitee` |
| Read a named-people event they neither created nor are named on | ❌ (Q25) | ❌ (Q25) | ✅ (Q24) | `event_select_visible` |
| Edit or delete an event they created | ✅ | ✅ | ✅ | `event_update_manage`, `event_delete_manage` |
| Edit or delete someone else's event | ❌ | ❌ **decided — Q9** | ✅ (Q9) | same two policies |
| Read the named list of an event they may edit | ✅ | ✅ | ✅ | `event_invitee_select_manage` via `public.may_manage_event` |
| Read the named list of an event they may only read | ❌ · | ❌ · | — | same — **default denial, AC-13** |
| Add or remove a person on the named list | creator only | creator only | ✅ | `event_invitee_insert_manage`, `event_invitee_delete_manage` |
| Name a pending, rejected or removed person | ❌ | ❌ | ❌ | `event_invitee_insert_manage`: `member_team_id(member_id) is not null` |
| Read the member directory (the picker) | ✅ | ✅ | ✅ | `public.list_member_directory()` — definer, caller must have a team |
| Anything above, as a pending, rejected or removed person | ❌ | ❌ | ❌ | every predicate starts from `member_team_id(auth.uid()) is not null`, or from `is_admin`, which carries the same clause |

`·` marks a denial by this plan's default rather than an operator answer, as in
`.ai/standards/rbac-and-security.md`. Every other cell is an operator answer cited in § 1.

**What a manager must not be able to do**, stated because a wrong helper would grant it silently:
every "someone else's event" predicate is keyed on `public.is_admin`, never on `public.may_decide`.
`may_decide` answers true for a manager and is for entry decisions alone (ADR-035).

**Interface affordances, not controls:** the edit and delete buttons render only for the creator and
admins (AC-17, AC-22); the form refuses an empty name and reversed dates before sending (AC-2, AC-3);
the picker omits the caller (AC-10). Each is a comment-carrying affordance over the policy above.

**Where this plan cannot be verified today.** The denials in AC-4, the direct-request half of AC-3,
AC-11 and AC-17 are properties of the policies and grants, and `tests/permission-model.test.ts`
against a real PostgreSQL is still owed project-wide (`rbac-and-security.md` § *Known weaknesses* 1;
CAL-11's migration header says the same). This ticket's unit tests assert the same denials against the
mock seam, which must refuse them identically; the migration header must say it was not run against
PostgreSQL, as CAL-11's does.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

```ts
/** EVT-01. Glossary *Event*. `named` is the glossary's "named people"; `team` is the creator's own
 *  team and never another (Q6). The values are the database enum's, verbatim. */
export type EventScope = "team" | "named" | "public";

/** EVT-01. Named `CalEvent`, not `Event`, because `Event` is the DOM global and shadowing it in
 *  every file that imports this one is a trap. */
export interface CalEvent {
  id: string;
  creatorId: string;
  /** The creator's team at creation, set by the database. Meaningful for `scope: "team"`; carried
   *  for every scope because it never changes and is the only team an event has. */
  teamId: string;
  name: string;
  /** Null, never "", when absent — AC-2. */
  description: string | null;
  location: string | null;
  /** `yyyy-MM-dd`, inclusive both ends, as `Entry` does. */
  startDate: string;
  endDate: string;
  scope: EventScope;
  createdAt: string;
  updatedAt: string;
}

/** EVT-01, ADR-045 point 4. THE NARROW PROJECTION: exactly these five fields, and never `role`,
 *  `status`, `removedAt`, `email` or anything else on `Member`. It is NOT a `Member` and must never
 *  be widened into one — the reason is INV-04's denominator. */
export interface DirectoryMember {
  id: string;
  displayName: string;
  avatar: string;
  teamId: string;
  teamName: string;
}
```

Four `FailureCode` members, appended to the union:

```ts
  // EVT-01. The name is empty once trimmed — AC-2. `event_name_present` (23514).
  | "empty_event_name"
  // EVT-01. End before start — AC-3. `event_dates_ordered` (23514). Not `invalid_date_range`,
  // whose sentence is written about entries.
  | "invalid_event_dates"
  // EVT-01. A named person is not an approved member — AC-11. Raised by `save_event` as 22023.
  | "invalid_event_invitee"
  // EVT-01. A policy or a withheld column refused the write, or the row is not the caller's to
  // change — AC-4, AC-17. 42501, or an update/delete that touched zero rows.
  | "event_not_permitted"
```

### 4.2 Seam — `src/lib/data/index.ts`

```ts
/** EVT-01. NO `creatorId` AND NO `teamId`: both are the database's (AC-4), and a field here would
 *  invite a caller to pass somebody else's. `inviteeIds` is ignored and stored empty unless
 *  `scope === "named"`. `description` and `location` are sent as null when blank after trimming. */
export interface SaveEventInput {
  name: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  scope: EventScope;
  inviteeIds: string[];
}

// Added to `DataSeam`:

/** Every event the caller may read (§ 3), ordered by `startDate` ascending, then `id`. The policy
 *  does the filtering; this function adds none. */
listEvents(): Promise<CalEvent[]>;

/** One event, or null when it does not exist OR the caller may not read it — deliberately the same
 *  answer (AC-22). */
getEvent(eventId: string): Promise<CalEvent | null>;

/** The member ids named on an event. Empty for a caller who may not edit it (AC-13) — the policy
 *  returns no rows, and that is the whole mechanism. */
listEventInvitees(eventId: string): Promise<string[]>;

/** The picker's source (AC-10): every approved, non-removed member of every team, the caller
 *  included, ordered by `teamName` then `displayName`. Empty for a caller with no team. */
listMemberDirectory(): Promise<DirectoryMember[]>;

/** AC-1, AC-2, AC-3, AC-11. One call to `public.save_event`, so the row and its named list are
 *  written in one transaction. */
createEvent(input: SaveEventInput): Promise<Result<CalEvent>>;

/** AC-14, AC-16, AC-17. Replaces every field and the named list. */
updateEvent(eventId: string, input: SaveEventInput): Promise<Result<CalEvent>>;

/** AC-15, AC-16, AC-17. The named list goes with the row (`on delete cascade`, § 6). A delete that
 *  touches zero rows is `event_not_permitted`, not success. */
deleteEvent(eventId: string): Promise<Result<void>>;
```

Every failure `message` is English (ui-design-system.md § *Language*). The Developer writes the four
sentences; each names what to change, and `event_not_permitted` never confirms the event exists.

### 4.3 Database — `supabase/migrations/20260929120000_evt01_event.sql`

Names below are fixed by this plan (RULE-04). The Developer writes the SQL; these are the shapes it
must have.

```sql
create type public.event_scope as enum ('team', 'named', 'public');

create table public.event (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null default auth.uid() references public.member(id),   -- restrict
  team_id     uuid not null references public.team(id),                        -- restrict; set by trigger
  name        text not null,
  description text null,
  location    text null,
  start_date  date not null,
  end_date    date not null,
  scope       public.event_scope not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint event_name_present  check (btrim(name) <> ''),
  constraint event_dates_ordered check (end_date >= start_date)
);

create table public.event_invitee (
  event_id   uuid not null references public.event(id) on delete cascade,
  member_id  uuid not null references public.member(id),                       -- restrict
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
```

- **`public.event_stamp()`**, `before insert or update` on `event`, `security definer`,
  `set search_path = ''`: on insert sets `team_id := public.member_team_id(new.creator_id)`; on update
  sets `updated_at := now()`. It never reads the wire's `team_id` — that column is ungranted anyway.
- **`public.is_event_invitee(p_event_id uuid, p_uid uuid) returns boolean`** — definer, `stable`,
  reads `event_invitee`. Exists so `event`'s select policy can consult the named list without
  recursing through `event_invitee`'s own policy.
- **`public.may_manage_event(p_event_id uuid, p_uid uuid) returns boolean`** — definer, `stable`:
  the event exists and (`creator_id = p_uid` and `member_team_id(p_uid) is not null`) or
  `is_admin(p_uid)`. Exists for the same reason in the other direction.
- **`public.list_member_directory()`** returning
  `table (id uuid, display_name text, avatar text, team_id uuid, team_name text)` — definer, `stable`,
  `member join team`, where the **caller** has a team and the **row** is `approved` with `removed_at`
  null. No `order by` (CAL-11's migration header: ordering is the seam's).
- **`public.save_event(p_event_id uuid, p_name text, p_description text, p_location text,
  p_start_date date, p_end_date date, p_scope public.event_scope, p_invitee_ids uuid[])
  returns public.event`** — **`security invoker`**, plpgsql. Every statement inside runs under the
  caller's policies and grants; the function adds atomicity and nothing else. Null `p_event_id`
  inserts, otherwise updates and raises `42501` when no row was updated. Before touching invitees it
  raises `22023` with message `invalid_event_invitee` if any id in `p_invitee_ids` has
  `member_team_id(id) is null` — a clearer code than the policy's, while the policy stays the control.
  Then it deletes every invitee row of the event not in the array (all of them when `p_scope <>
  'named'`) and inserts the missing ones when `p_scope = 'named'`.

Policies — `to authenticated`, `(select auth.uid())` wrapped, `drop … if exists` then `create`:

| Policy | On | Predicate |
|---|---|---|
| `event_select_visible` | `event` select | `member_team_id(uid) is not null and (is_admin(uid) or creator_id = uid or scope = 'public' or (scope = 'team' and team_id = member_team_id(uid)) or (scope = 'named' and is_event_invitee(id, uid)))` |
| `event_insert_own` | `event` insert | check `creator_id = uid and member_team_id(uid) is not null` |
| `event_update_manage` | `event` update | using and check: `(creator_id = uid and member_team_id(uid) is not null) or is_admin(uid)` |
| `event_delete_manage` | `event` delete | using: same as update |
| `event_invitee_select_manage` | `event_invitee` select | `may_manage_event(event_id, uid)` |
| `event_invitee_insert_manage` | `event_invitee` insert | check `may_manage_event(event_id, uid) and member_team_id(member_id) is not null` |
| `event_invitee_delete_manage` | `event_invitee` delete | `may_manage_event(event_id, uid)` |

Grants — `to authenticated`, never `public`:

```sql
grant select, delete on public.event to authenticated;
grant insert (name, description, location, start_date, end_date, scope) on public.event to authenticated;
grant update (name, description, location, start_date, end_date, scope) on public.event to authenticated;
grant select, delete on public.event_invitee to authenticated;
grant insert (event_id, member_id) on public.event_invitee to authenticated;
-- execute: revoke from public, grant to authenticated, for all five functions above
```

No update grant on `event_invitee`: a named person is added or removed, never edited.

### 4.4 Routes and selectors

| Route | File | Guard |
|---|---|---|
| `/events` | `src/routes/Events.tsx` | inside the shell layout, `membership.state === "member"`, as the calendar routes |
| `/events/new` | `src/routes/EventEditor.tsx` | same |
| `/events/:id` | `src/routes/EventDetail.tsx` | same |
| `/events/:id/edit` | `src/routes/EventEditor.tsx` | same; an id the caller may not edit renders `event-not-found` |

`data-testid` values — every one the ACs name, and no others are required:

| Id | Where | AC |
|---|---|---|
| `nav-events-link` | `TopBar.tsx`, before `home-new-entry-link` | AC-19 |
| `events-new-button` | list heading row, and inside `events-empty` | AC-20, AC-21 |
| `events-upcoming`, `events-past` | the two section wrappers; absent when empty | AC-20, AC-21 |
| `event-row` | one per event; carries `data-event-id` | AC-20 |
| `event-row-scope` | the badge inside a row; carries `data-scope` = the enum value | AC-20 |
| `events-empty` | list empty state | AC-21 |
| `event-detail` | the card | AC-22 |
| `event-name`, `event-dates`, `event-scope`, `event-creator`, `event-location`, `event-description` | detail fields; location and description absent when null | AC-2, AC-22 |
| `event-invitees` | detail named list; rendered only when the caller may edit and scope is `named` | AC-13, AC-22 |
| `event-edit-button`, `event-delete-button` | detail; creator and admins only | AC-17, AC-22 |
| `event-delete-confirm`, `event-delete-cancel` | the confirmation, which names the event | AC-15 |
| `event-not-found` | detail and edit, for unknown or unreadable ids | AC-22 |
| `event-form`, `event-name-input`, `event-start-input`, `event-end-input`, `event-location-input`, `event-description-input` | form fields | AC-23 |
| `event-scope-team`, `event-scope-named`, `event-scope-public` | the three scope choices | AC-23 |
| `event-picker`, `event-picker-filter`, `event-picker-option` (with `data-member-id`), `event-picker-group` | the picker, rendered only while `named` is chosen | AC-10, AC-23 |
| `event-save`, `event-cancel`, `event-form-error` | form actions and the one error line | AC-2, AC-3, AC-23 |

A creator no longer in the directory (removed) is shown as **Former member**, never as a raw id.
Dates render as `d MMM yyyy`, or `d MMM – d MMM yyyy` for a range, with `date-fns` as the product does
elsewhere; "today" for Upcoming/Past is the caller's local date, as the calendar screens resolve it.

## 5. Seam impact

**Seven functions added, none changed:** `listEvents`, `getEvent`, `listEventInvitees`,
`listMemberDirectory`, `createEvent`, `updateEvent`, `deleteEvent` — each in `index.ts`, `supabase.ts`
and `mock.ts` with the same name and arity, which `tests/seam-parity.test.ts` checks without edit.

- **`supabase.ts`**: reads through `from("event")` and `from("event_invitee")` under RLS, the
  directory through `rpc("list_member_directory")`, both writes through `rpc("save_event")`, and
  delete through `from("event").delete().eq("id", …).select("id")` so zero rows is detectable.
- **`mock.ts`**: in-memory `events` and `eventInvitees` arrays, starting empty, with an exported
  `__resetEvents()` test hook beside `__resetIssueReports()`. It implements every predicate in § 3
  over `members` and the existing `memberTeamId`, and every refusal with the same `FailureCode`.
- **`listMembers()` is untouched**, and so is every policy on `public.member` — AC-12 and INV-04.

**Not XL** (operating model § *Sizing*): no existing seam signature changes; `types.ts` gains three
new types and four union members, and no existing caller has to change — nothing in `src/` or
`tests/` switches exhaustively over `FailureCode` (checked: no `Record<FailureCode, …>`).

## 6. Schema delta

**Two tables, one enum, one trigger, five functions, seven policies and their grants** — § 4.3. No
existing table, column, policy or function is altered.

**ADR:** [ADR-045](../../../registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md),
`ACCEPTED by the operator`, decision points 3–6; the ticket's `requires_adr: false` stands. Inside its
fence: `member_select_team` is not touched, and the cross-team exposure is exactly
`list_member_directory()`'s five columns (ADR-045 point 4).

**One cascade, chosen.** `.ai/standards/data-model.md` § *Relationships* says the model has no cascade
*"and that is a decision rather than an omission"* — the objection is to a cascade nobody chose.
This one is chosen: an `event_invitee` row has no meaning without its event, is not a record anybody
reads on its own, and AC-15 requires it to go with the event. The alternative, a delete function
removing both, is the same effect with one more function to keep in parity. `creator_id`,
`team_id` and `member_id` stay restrict, as every other reference to `member` and `team` does.

**Applying it is human** (RULE-09). The migration is idempotent in the shape ADR-024 requires
(a guarded `do` block for the enum as `supabase/db.sql` uses, `create table if not exists`,
`create or replace` for functions, `drop … if exists` then `create` for the trigger and policies), in one transaction, and its header says it has not been run
against PostgreSQL.

**`supabase/db.sql` is not updated here**, and not by oversight: CAL-11 shipped a migration without it,
and MD-033 records that the file already lags three migrations. Bringing it level is that debt's.

**Owed to `/thuki`, not this ticket:** the event rows in `.ai/standards/rbac-and-security.md` (§ 3 is
their source) and the two tables in `.ai/standards/data-model.md` (§ 4.3 is theirs) — ADR-045
§ *Affected documents*. Human plane.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260929120000_evt01_event.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/App.tsx"
  - "src/components/TopBar.tsx"
  - "src/routes/Events.tsx"
  - "src/routes/EventDetail.tsx"
  - "src/routes/EventEditor.tsx"
  - "tests/events.test.ts"
  - "tests/e2e/evt-01-events.spec.ts"
```

**Twelve paths: `size: M`, agreeing with `size_estimate: M`.** It is at the top of M and one file
away from L. **Deliberately absent:** `src/lib/fixtures.ts` and `supabase/seed.sql` — the unit test
creates events through the mock seam as the fixture members that already exist
(`FIXTURE_MEMBER`, `FIXTURE_OTHER_TEAM_MEMBER`, `FIXTURE_PENDING_SIGNUP`, `FIXTURE_REMOVED_MEMBER`,
`FIXTURE_ADMIN`) via `__setCurrentMember`, so no new fixture literal is needed and none can drift from
the seed. Also absent: `src/components/Sidebar.tsx`, whose navigation block is commented out, so
the link goes in the top bar; and `tests/seam-parity.test.ts`, which compares key sets without
naming them. **A thirteenth file makes
this `L`, which must split** — the Developer stops and says so rather than adding one.

## 8. Rejected alternatives

**1. A `security definer` read of events, as CAL-11 did for admins, instead of a select policy.**
Genuinely plausible: it keeps every cross-team rule inside one function body, the shape ADR-040
already uses, and it would let the list return the creator's display name in the same call. Rejected
because CAL-11's reason for a function does not apply here — there it was that a widened policy on an
*existing* table changes reads other screens already make, and `event` is new, so no existing read
changes. A definer function bypasses RLS entirely, so its body becomes the only control and a
forgotten clause fails open for every team at once — ADR-045 § *Consequences* names exactly that
("a definer function that loses its filter leaks names across every team"). A policy fails closed on
an unhandled case. The one definer read this plan keeps, the directory, is the one ADR-045 point 4
requires to be separate from `member`'s policies.

**2. Widening `member_select_team` so the picker reads `member` directly.** One line. Rejected by
ADR-045 point 4 and § *Rationale*: `listMembers()` returns what that policy returns and is INV-04's
denominator, so every team's roster would silently join every team's absence arithmetic.

**3. Writing the event and its named list as separate PostgREST requests from the seam.** No new
function, and the pattern `createIssueReport` uses. Rejected because a failure between the two leaves
a named-people event naming nobody — visible to its creator and admins only, looking saved — or,
on edit, half the old list and half the new. `save_event` as `security invoker` buys the transaction
without moving any authorization out of the policies.

**4. Splitting EVT-01 again, into read and write tickets.** Rejected: the ticket counts to twelve,
and a read-only half has no event to read without seed data that the write half would then have to
retire — the backend-without-frontend shape the operating model forbids, one layer over.

## Changelog

- `2026-09-29T10:24:22+0700` — section 2, AC-4. Written as *"the event is scoped to team A even if
  the request names team B"* — a silent override. Amended after reading TEA-04's column-grant shape in
  `supabase/db.sql` § 7: withholding the `team_id` privilege refuses such a request outright with
  `42501`, which is the stronger guarantee and removes a code path that would have quietly rewritten
  input. The behaviour a person sees through the form is unchanged. Raised by `tech-lead-design`.
  Amended by `tech-lead-design`.
- `2026-09-29T10:24:22+0700` — section 2, AC-3, AC-4, AC-11, AC-17. *"Sent directly through the data
  seam"* reworded to *"straight to the datastore with the caller's own token"*: `SaveEventInput` has no
  creator or team field, so the seam cannot be used to send one, and the refusal is a property of the
  policies, not of the seam. No behaviour changed. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
