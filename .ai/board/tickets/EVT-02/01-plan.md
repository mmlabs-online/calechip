---
ticket: EVT-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-29T11:51:56+0700
inputs_read:
  - .ai/board/tickets/EVT-02/ticket.yaml
  - .ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/board/tickets/EVT-01/ticket.yaml
  - .ai/board/tickets/EVT-01/01-plan.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .claude/commands/plan.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/EventDetail.tsx
  - src/routes/EventEditor.tsx
  - src/routes/Events.tsx
  - src/components/Modal.tsx
  - tests/events.test.ts
  - tests/e2e/evt-01-events.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-02 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT — Events without paraphrase:**

| ID | Title |
|----|-------|
| EVT-02 | A member joins an event they can read, within its capacity, approval mode and deadline, and everyone who can read it sees who is coming |

The row's Notes column is the scope, each clause an operator answer in
`.ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md` § *Evidence*:
the creator sets an optional capacity and an approval mode per event (Q7), and an optional
registration deadline on or before the end date, registration otherwise open until the end date
(Q16, Q19); with approval off, joining is immediate; with it on, every requester waits, invitees
included — an invitation is not a pre-approval (Q22); the creator takes no seat (Q23); pending
requests hold no seat and only approved attendees count, so no approval is possible once the cap is
reached (Q10); capacity may never be set below the current approved count, and changing mode or
scope leaves those already in as they are (Q13); an attendee withdraws, or cancels a pending request,
before the deadline (Q18); creator and admin decide requests and remove attendees, admin on any event
(Q17, Q24); a rejection needs no reason and INV-03 does not extend to it (Q12); whoever can read the
event reads its attendee list (Q8). Two approvals of the last seat, or an instant join racing an
approval, must not exceed the cap, and a read-then-write check does not hold it (ADR-045
§ *Consequences*). The attendee list reads through the same narrow projection as `EVT-01`'s picker,
never a widened `member` policy.

**Who gains what.** EVT-01 lets a member say a gathering exists and who it is for; this ticket lets
the people it is for say *I'm coming*, and lets the organiser hold a cap and, if they want, a say over
who gets in. Every reader of the event sees the same list of who is coming, which is the headcount
the organiser was keeping by hand in a chat thread. The organiser — and any admin — decides requests
and can take someone off the list. The one property that must not bend is the cap: however many
people press the button at once, the number of attendees never passes it.

**Out of scope.**

- **A waitlist.** Full means full (idea § *Out of scope*). A request made to a full approval-required
  event stays pending and is never promoted automatically.
- **Email and any other notification** (Q20, Q21). A requester learns the decision by opening the
  event. A later idea with its own ADR against ADR-005.
- **Any link to entries, the absence count or the calendar grids** (Q2, ADR-045 point 2).
- **A reason on a rejection** — no field is offered (Q12).
- **Reinstating a rejected or removed person.** § 2 AC-19 closes their own path back; no control lets
  the creator or an admin reopen it. If that proves wrong it is a later ticket, not a gap here.
- **Showing rejected or removed people to anyone but themselves** — the creator and admins see
  attendees and pending requests only.
- **A seat count, or the caller's own status, on the events list rows.** The list (`/events`) is
  unchanged; everything this ticket adds is on the detail page and the form.
- **Any new power for `manager`** (Q9, Q17, Q24).
- **The standards rows ADR-045 § *Affected documents* lists** for join, withdraw, decide and remove
  in `.ai/standards/rbac-and-security.md`, and the attendance table in `.ai/standards/data-model.md`.
  Human plane; EVT-01's plan set the precedent that `/thuki` lands them. § 3 and § 4 here are their
  transcription source.

**`size_estimate: M`** — one migration (one table, triggers, policies, and a changed `save_event`),
four seam functions in both implementations, two changed screens and their tests. Section 7 counts
the verdict.

## 2. Acceptance criteria

Vocabulary used below, in addition to EVT-01's (*approved member*, *pending sign-up*, *can read an
event*, the three scopes).

- **Audience** of an event — the people who may join it: its creator; for **own team**, every approved
  member of the creator's team; for **every team**, every approved member; for **named people**, each
  person named. Being able to read an event is not the same as being in its audience (AC-11).
- **Registration is open** while today's date in `Asia/Ho_Chi_Minh` is on or before the registration
  deadline, or, when no deadline is set, on or before the event's end date. It closes at the end of
  that day.
- **An attendance** is one person's standing on one event, in exactly one of four states:
  **pending** (requested, not decided), **attending** (approved, or joined an event needing no
  approval), **rejected**, **removed**. Withdrawing or cancelling deletes it; there is no fifth state.
- **Attendees** are attendances in the **attending** state. **Seats taken** is their count.
- **Straight to the datastore** means a request with the caller's own token that does not go through
  the screens — the refusals below are properties of the database, not of the interface.

### Setting it up

**AC-1 — capacity, approval mode and deadline are set on the event**
- Given the create form, or the edit form of an event the caller may edit (EVT-01 AC-14, AC-16)
- When they set a capacity, choose whether joining needs approval, and set a registration deadline
- Then the event saves with those three values, and its detail page shows each of them
- And when capacity is left empty the event has no limit; when the approval choice is left alone
  joining needs no approval; when the deadline is left empty registration is open until the end date

**AC-2 — a capacity is a whole number of at least one**
- Given the form
- When capacity is zero, negative, or not a whole number
- Then nothing is saved and `event-form-error` names the capacity field
- And the same value sent straight to the datastore is refused

*AC-2 is a derivation, not an operator answer: Q7 offers "a limit or no limit", and a limit of zero
is an event nobody can join, which "no limit" already is not. Recorded so it is not mistaken for a
stated rule.*

**AC-3 — the deadline is on or before the end date**
- Given the form
- When the registration deadline is after the event's end date, or the end date is moved before an
  existing deadline
- Then nothing is saved and `event-form-error` says so; the same write straight to the datastore is
  refused (Q19)
- And a deadline already in the past is accepted — it means registration is closed

**AC-4 — capacity may not go below seats taken**
- Given an event with N attendees
- When its creator or an admin saves a capacity below N
- Then nothing is saved and `event-form-error` says capacity cannot be below the number of people
  already attending; the same write straight to the datastore is refused (Q13)
- And a capacity of exactly N saves, and the event is then full
- And this holds when the capacity change and an approval or join arrive at the same moment: after
  both, seats taken is never above capacity (AC-9)

**AC-5 — changing the event leaves people where they are**
- Given an event with attendees and pending requests
- When its creator switches the approval mode either way, changes the scope, or removes a named person
- Then every attendance keeps its state: attendees stay attending, pending requests stay pending and
  are still decided by the creator or an admin (Q13)
- And a person whose attendance is pending or attending keeps being able to read the event, even
  when the new scope or the named list would no longer include them — they must still see it to
  withdraw, and the list they are on must stay true

*The pending-stays-pending half confirms product's guess (idea § Guesses). The keeps-reading half is
this plan's derivation from Q13: "those already in stay as they are" is not true of a person who can
no longer see the event they are in.*

### Joining

**AC-6 — no approval: joining is immediate**
- Given an event needing no approval, with registration open and a seat free (or no capacity)
- When a person in its audience presses `event-join-button`
- Then they are an attendee at once, they appear in `event-attendees`, and seats taken goes up by one

**AC-7 — approval required: everyone waits, invitees too**
- Given an event needing approval, with registration open
- When a person in its audience — named on it or not — presses `event-join-button`
- Then their attendance is **pending**, they see `event-my-status` reading that the request is
  waiting, they do not appear in `event-attendees`, and seats taken is unchanged (Q10, Q22)
- And a request is accepted even when the event is full; it holds no seat

**AC-8 — full**
- Given an event whose seats taken equals its capacity
- Then the detail page reads *Full* in `event-seats`
- And for an event needing no approval, a person who is not already on it sees no join control, and a
  join sent straight to the datastore is refused
- And for an event needing approval, the approve control on every pending request is disabled, and
  an approval sent straight to the datastore is refused (Q10)

**AC-9 — the cap holds under concurrency**
- Given an event with exactly one seat free
- When two approvals of two different pending requests, or an approval and an instant join, or an
  approval and a capacity reduction, arrive at the datastore at the same moment
- Then at most one of them takes the seat, the other is refused as full, and seats taken never
  exceeds capacity at any moment (ADR-045 § *Consequences*, revert condition 2)

**AC-10 — registration closed**
- Given an event whose registration is closed (its deadline, or failing that its end date, is before
  today in `Asia/Ho_Chi_Minh`)
- Then the detail page shows *Registration closed* in place of the join control
- And a join or request straight to the datastore is refused
- And on the last open day registration is still open, until that day ends

**AC-11 — only the audience joins**
- Given an event
- Then a person outside its audience sees no join control and a join sent straight to the datastore
  is refused — this includes an **admin** outside the audience, who can read every event (EVT-01
  AC-8) but reads it to manage it, not to attend
- And a pending sign-up, a rejected sign-up, or a member with `removed_at` set cannot join any event
- And a `manager` joins exactly as a `member` does, and no otherwise

*The admin clause is a default denial (`.ai/standards/rbac-and-security.md`: deny until decided), not
an operator answer. Q22 says an invitation decides who can "see and request"; nobody was asked
whether an admin's read-everything also lets them request everything.*

**AC-12 — the creator takes no seat unless they join**
- Given a newly created event
- Then its creator is not an attendee and seats taken is zero (Q23)
- And the creator may join their own event like anyone in its audience, under its mode; on an
  approval-required event they may then approve their own request

*The second clause confirms product's guess (idea § Guesses).*

**AC-13 — one attendance per person per event**
- Given a person with an attendance on an event, in any state
- When they join or request again, through the screen or straight to the datastore
- Then nothing new is created; the screen offers no join control while an attendance exists

### Leaving

**AC-14 — withdrawing and cancelling, while registration is open**
- Given an attendee, or a person with a pending request, on an event whose registration is open
- When they press `event-leave-button` and confirm
- Then their attendance is gone, seats taken drops by one if they were attending, and they may join
  or request again while registration stays open (Q18)

**AC-15 — no leaving after registration closes**
- Given the same person, once registration is closed
- Then no leave control is shown, and a withdrawal sent straight to the datastore is refused (Q18)

### Deciding

**AC-16 — the creator and admins approve and reject**
- Given a pending request on an event
- When its creator, or any admin — on any event, any scope, any team — approves it
- Then it becomes attending, the person appears in `event-attendees`, and seats taken goes up by one
- And when they reject it instead, no reason is asked for or stored, and the requester sees in
  `event-my-status` that the request was declined (Q12, Q17, Q24)

**AC-17 — the creator and admins remove an attendee**
- Given an attendee on an event
- When its creator or any admin removes them and confirms
- Then they leave `event-attendees`, seats taken drops by one, and they see in `event-my-status` that
  they were removed (Q17)

**AC-18 — deciding does not close with registration**
- Given an event whose registration is closed
- Then its creator and admins can still approve, reject and remove, subject to capacity

*This plan's decision, not the operator's: without it, requests pending at the deadline could never be
decided at all.*

**AC-19 — rejected and removed are final for that person**
- Given a person whose request was rejected, or who was removed
- Then they see no join control on that event, and a new join or request straight to the datastore is
  refused
- And they cannot delete their own rejected or removed attendance to start over

*This overturns product's guess that a rejected or removed person may request again. On an event
needing no approval that guess would make removal undo itself: the removed person joins again at once
and the creator's decision lasts one click. Reinstating is Out of scope.*

**AC-20 — no one else decides, and no one decides for themselves by writing their own state**
- Given an approved `member` or `manager` who did not create an event
- Then they see no approve, reject or remove control on it, and any such change sent straight to the
  datastore is refused and changes nothing
- And no person — creator and admins included — can create their own attendance directly as
  attending on an event needing approval, or change their own pending request to attending except by
  the approve action AC-16 grants the creator and admins

### Who sees who is coming

**AC-21 — whoever reads the event reads its attendees**
- Given a person who can read an event (EVT-01 AC-5 to AC-8, or AC-5 here)
- Then they see `event-attendees`, listing every attendee by display name and avatar, whatever team
  each is on, and `event-seats` showing seats taken and, when set, the capacity (Q8)
- And a person who cannot read the event receives no attendance of it, pending or otherwise — an
  empty list, never an error that confirms the event exists
- And an attendee who has since been removed from the product is shown as **Former member**

**AC-22 — pending requests are seen by who decides them, and by the requester**
- Given an event with pending requests
- Then its creator and every admin see them in `event-requests`, each with approve and reject
- And a requester sees their own state in `event-my-status`
- And every other reader sees neither the pending requests nor anyone's rejected or removed state

*A default denial, not an operator answer: Q8 names "the attendee list", and a pending requester is
not an attendee (glossary *Attendee*).*

**AC-23 — the member roster does not widen**
- Given this ticket is shipped
- When an approved `member` or `manager` of team A opens the member list, or calls `listMembers()`
- Then they receive exactly the rows they received before this ticket — no row whose team is not A
  (ADR-045 revert condition 1)
- And reading an attendance returns, per person, only the event id, the member id, the attendance
  state and when it was made and last changed — never a role, a team, a membership status or
  `removed_at`; names and avatars come from EVT-01's directory read and nowhere else

### What it does not touch

**AC-24 — attending is not an entry**
- Given attendances of every state on events covering some dates
- Then no entry exists for them, and the month, week and year views, the absence count and the
  overload state of every date are unchanged (Q2)

**AC-25 — deleting an event deletes its attendances**
- Given an event with attendances of every state
- When its creator or an admin deletes it (EVT-01 AC-15, AC-16)
- Then every attendance of it is gone with it

*Confirms product's guess (idea § Guesses).*

**AC-26 — a member later removed from their team keeps their seat in the data**
- Given an attendee whose member row later gets `removed_at`
- Then their attendance stays, still counts toward seats taken, and is shown as **Former member**
  (AC-21); the creator or an admin frees the seat by removing them (AC-17)
- And they themselves can no longer read, join, leave or change anything (EVT-01 AC-9)

*Confirms product's guess that such a member "keeps their created events and attendances in the
data". That the seat stays taken follows from counting attendances rather than people.*

### The screens (layout — see § 2b)

**AC-27 — the detail page**
- Given a person who can read an event
- When its detail page opens
- Then below EVT-01's fields it shows, top to bottom: `event-seats`; `event-deadline`, reading when
  registration closes, or *Registration closed*; the join panel — exactly one of `event-join-button`,
  `event-my-status` with `event-leave-button`, `event-my-status` alone, or nothing — per AC-6 to AC-19;
  then `event-requests`, for the creator and admins only and only when there is at least one pending
  request; then `event-attendees`
- And `event-join-button` reads *Join* on an event needing no approval and *Request to join* on one
  needing approval
- And with no attendees, `event-attendees` shows a short empty line instead of a list

**AC-28 — the form**
- Given the create or edit form (EVT-01 AC-23)
- Then after the date fields and before scope it shows: `event-capacity-input` (empty means no
  limit), `event-approval-input` (a single on/off choice, off by default), and
  `event-deadline-input` (optional date)
- And the edit form opens holding the event's current three values

**AC-29 — removing and leaving are confirmed**
- Given the remove control on an attendee, or `event-leave-button`
- When it is pressed
- Then a confirmation names the person or the event, and nothing changes until it is confirmed;
  cancelling changes nothing

**Invariants touched: `[INV-04]`.** The attendee list shows people across team boundaries, which is
the chain ADR-045 point 4 fences: `listMembers()` returns whatever `public.member`'s select policies
return and is INV-04's denominator, so any design that reads attendee identity by widening those
policies silently changes every team's absence count. INV-04 is plausibly reached through that chain
even though no entry is touched; AC-23 asserts the fence from outside. No other invariant is
reachable: an attendance is not an entry (INV-01, 02, 03, 05, 06 constrain entries, and AC-16 records
that INV-03 does not extend to a rejected request), and INV-07 counts entries, which no attendance
creates (AC-24). Capacity is **not** an invariant (ADR-045 § *Consequences*) and is not listed.

**Open questions.** None. Every behaviour above is an operator answer in the idea's § *Evidence*; a
product guess confirmed (AC-5, AC-12, AC-25, AC-26) or overturned (AC-19) and marked; a derivation
marked (AC-2, AC-5); this plan's own decision marked (AC-18); or a default denial marked (AC-11,
AC-22). The one remaining product guess — registration closes at the end of the deadline date in
`Asia/Ho_Chi_Minh` — is confirmed in the vocabulary above. The screen arrangement is this plan's own
— § 2b.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

**The layout, as a whole.** No new route, no change to `/events` or to any calendar screen. Everything
lands on the two EVT-01 screens.

- **`/events/:id`** — the card from EVT-01 keeps its order (AC-22 of EVT-01) and grows one block
  beneath the description, separated by the same hairline the named list uses: a **seats line**
  (`3 going · 12 seats`, `12 going · Full`, or `3 going` with no capacity) beside a **deadline line**
  (`Registration open until 14 Oct 2026` or `Registration closed`); under them the **join panel**, one
  pill button or one status sentence with a quiet text-button to leave; then, for the creator and
  admins, a **Requests** list (avatar, name, *Approve* and *Reject* as two small pills), drawn only
  when non-empty; then **Going**, the attendees as the same avatar-and-name pills EVT-01's named list
  uses, wrapping, with a small × on each for the creator and admins. *Full* uses the soft pink the
  design system reserves for an overloaded day — a state, not an alarm. Remove and leave each confirm
  in the existing `Modal`, never stacked on another dialog.
- **The form** — three fields between the dates and the scope choice: *Seats* (a narrow number input
  with placeholder *No limit*), *Needs approval* (one switch), *Registration closes* (a date input with
  placeholder *At the end date*). Capacity and deadline sit side by side at desktop width, as the two
  event dates do, and stack at phone width.

## 3. Permission model

**Every check below is held in PostgreSQL** — policies, column grants, two check constraints and two
triggers — per ADR-005. Every check in the seam or the interface is an affordance and carries a
comment saying so.

| Action | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|
| Set capacity, approval mode, deadline on an event they may edit | creator only | creator only | ✅ any (Q9) | EVT-01's `event_update_manage` / `event_insert_own`, plus the three columns added to both column grants |
| Capacity below one, deadline after end date | ❌ | ❌ | ❌ | `event_capacity_positive`, `event_deadline_by_end` (23514) |
| Capacity below seats taken | ❌ | ❌ | ❌ | `event_capacity_guard` trigger (`EV003`), under the event row's lock (Q13) |
| Join or request, in the audience, registration open | ✅ | ✅ | ✅ | `event_attendance_insert_own` via `public.is_event_audience`; `event_attendance_guard` for open-ness and capacity |
| Join or request, outside the audience | ❌ | ❌ | ❌ · (AC-11) | `event_attendance_insert_own` |
| Choose one's own state on joining | ❌ | ❌ | ❌ | `status` withheld from the insert grant; `event_attendance_guard` sets it from `requires_approval` (Q22) |
| Join when full, or approve into a full event | ❌ | ❌ | ❌ | `event_attendance_guard` (`EV001`), under the event row's lock (Q10) |
| Join after registration closes | ❌ | ❌ | ❌ | `event_attendance_guard` (`EV002`) |
| A second attendance on the same event, including after rejection or removal | ❌ | ❌ | ❌ | primary key `(event_id, member_id)` (23505) — AC-13, AC-19 |
| Withdraw or cancel their own, registration open | ✅ | ✅ | ✅ | `event_attendance_delete_own`: own row, state `pending` or `attending`, registration open (Q18) |
| Delete their own rejected or removed row | ❌ | ❌ | ❌ | same policy — state clause (AC-19) |
| Approve, reject, remove on an event they created | ✅ | ✅ | ✅ | `event_attendance_update_manage` via EVT-01's `public.may_manage_event` |
| Approve, reject, remove on someone else's event | ❌ | ❌ **decided — Q17, Q24** | ✅ | same |
| An illegal transition (anything but pending→attending, pending→rejected, attending→removed) | ❌ | ❌ | ❌ | `event_attendance_guard` (22023) |
| Read attendees of an event they can read | ✅ | ✅ | ✅ | `event_attendance_select_visible` — the `attending` clause (Q8) |
| Read pending, rejected, removed rows | own only · | own only · | ✅ (as manager of every event) | same — the self clause and the `may_manage_event` clause (AC-22) |
| Read an event they are pending on or attending, outside the current scope | ✅ | ✅ | ✅ | `event_select_visible` gains `public.is_event_participant` (AC-5) |
| Anything above as a pending, rejected or removed person | ❌ | ❌ | ❌ | every predicate starts from `member_team_id(uid) is not null`, directly or through a helper that does |

`·` marks a denial by this plan's default rather than an operator answer. Every other cell cites its
answer.

**What a manager must not be able to do**, stated because a wrong helper would grant it silently:
every "someone else's event" predicate is `may_manage_event`, which is keyed on `is_admin` — never on
`may_decide`, which is true for a manager and is for entry decisions alone (ADR-035).

**Why the cap holds under concurrency** (AC-9). Every path that can raise seats taken — an insert that
the guard makes `attending`, and an update to `attending` — runs `event_attendance_guard`, whose first
statement is `select … from public.event where id = new.event_id for update`. Every capacity change is
an `UPDATE` of that same row, which takes the same lock. So on any one event these writes are
serialised, and the count each one reads is taken **after** it holds the lock, by a fresh statement
under `READ COMMITTED` — it sees every seat committed before it. A read-then-write in the seam or the
client (the thing ADR-045 rules out) is not the mechanism; the seam's pre-checks are affordances only.

**Interface affordances, not controls:** the join button renders only for the audience, with
registration open, no attendance, and — without approval — a seat free; approve is disabled when full;
the leave button only while registration is open; request and attendee controls only for the creator
and admins. Each sits over the policy or trigger in the table above.

**Where this plan cannot be verified today.** As EVT-01 § 3 records, `tests/permission-model.test.ts`
against a real PostgreSQL is still owed project-wide. The mock reproduces every refusal above with the
same `FailureCode`, and its check-and-write runs with no `await` between them, so `Promise.all`
against it proves the **decision** is right, not the **lock**. The lock is asserted by reading the
migration (the test reads the file, as `tests/events.test.ts` does). A concurrency test against a
running PostgreSQL is the proof ADR-045 revert condition 2 wants, and it is owed; the migration header
says so.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

`CalEvent` gains three fields. **Readers are unaffected**; the only constructors are `mock.ts` and
`supabase.ts`'s `toEvent`, both in `allowed_paths`.

```ts
  // Added to `CalEvent`, after `scope`:
  /** EVT-02. Glossary *Capacity*. Null is no limit; otherwise a whole number ≥ 1. */
  capacity: number | null;
  /** EVT-02. True: every join is a request the creator or an admin decides (Q22). */
  requiresApproval: boolean;
  /** EVT-02. `yyyy-MM-dd`, on or before `endDate`, or null — registration then runs to `endDate`. */
  registrationDeadline: string | null;
```

```ts
/** EVT-02. The four states of one person's standing on one event. The database enum's values,
 *  verbatim. Withdrawing deletes the row; there is no fifth state. */
export type AttendanceStatus = "pending" | "attending" | "rejected" | "removed";

/** EVT-02. One row of `public.event_attendance`, and nothing else — no name, avatar, team or role
 *  (AC-23). Names come from `listMemberDirectory()`. */
export interface EventAttendance {
  eventId: string;
  memberId: string;
  status: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
}
```

Eight `FailureCode` members, appended to the union:

```ts
  // EVT-02. Capacity is not a whole number ≥ 1 — AC-2. `event_capacity_positive` (23514).
  | "invalid_event_capacity"
  // EVT-02. Deadline after the end date — AC-3. `event_deadline_by_end` (23514).
  | "invalid_event_deadline"
  // EVT-02. Capacity below seats taken — AC-4. `event_capacity_guard` (EV003).
  | "event_capacity_below_attendees"
  // EVT-02. No seat — AC-8, AC-9. `event_attendance_guard` (EV001).
  | "event_full"
  // EVT-02. Registration is closed — AC-10, AC-15. `event_attendance_guard` (EV002), or a
  // withdrawal the delete policy filtered once registration closed.
  | "event_registration_closed"
  // EVT-02. The caller already has an attendance of any state — AC-13, AC-19. 23505.
  | "already_on_event"
  // EVT-02. Not a transition the guard allows — AC-16, AC-17. 22023.
  | "invalid_attendance_change"
  // EVT-02. A policy refused, or the write touched zero rows — AC-11, AC-20. 42501. Never
  // confirms that the event exists.
  | "attendance_not_permitted"
```

### 4.2 Registration open-ness — `src/lib/event-registration.ts` (new)

```ts
/** EVT-02. Today's date in Asia/Ho_Chi_Minh as `yyyy-MM-dd` — the zone the database compares in.
 *  `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })`, which formats as ISO. */
export function eventToday(now?: Date): string;

/** EVT-02. `today <= (registrationDeadline ?? endDate)`. The mock's reproduction of
 *  `public.event_registration_open`, and the screen's affordance. Not a control. */
export function registrationOpen(
  event: Pick<CalEvent, "registrationDeadline" | "endDate">,
  today: string,
): boolean;
```

### 4.3 Seam — `src/lib/data/index.ts`

`SaveEventInput` gains three **optional** fields, so no existing caller has to change
(`tests/events.test.ts:44` builds one literally). Absent means the default: no limit, no approval, no
deadline. The editor always sends all three.

```ts
  // Added to `SaveEventInput`:
  /** EVT-02. Absent or null: no limit. */
  capacity?: number | null;
  /** EVT-02. Absent: false. */
  requiresApproval?: boolean;
  /** EVT-02. Absent or null: registration runs to `endDate`. */
  registrationDeadline?: string | null;
```

The seam-side affordances in `eventInputFailure` (both implementations) gain two checks after the
existing two: capacity present and not an integer ≥ 1 → `invalid_event_capacity`; deadline present
and after `endDate` → `invalid_event_deadline`. `toEventFailure`'s 23514 branch tells the four checks
apart by the input, in that order, as it does today; `EV003` maps to
`event_capacity_below_attendees`.

```ts
// Added to `DataSeam`:

/** EVT-02. The attendance rows of one event the caller may read (§ 3): every `attending` row to any
 *  reader of the event; every row to its creator and admins; the caller's own row to the caller.
 *  Empty for an event the caller cannot read. Ordered `createdAt` ascending, then `memberId`.
 *  Bounded by `DATASTORE_MAX_ROWS` and throws at the bound, as `listEvents` does. */
listEventAttendance(eventId: string): Promise<EventAttendance[]>;

/** EVT-02. AC-6, AC-7, AC-8, AC-10, AC-11, AC-13, AC-19. Inserts the caller's row; the DATABASE
 *  decides whether it is `pending` or `attending`. No parameter can name a member or a state. */
joinEvent(eventId: string): Promise<Result<EventAttendance>>;

/** EVT-02. AC-14, AC-15. Deletes the caller's own `pending` or `attending` row. Zero rows deleted is
 *  a refusal: `event_registration_closed` when the caller can read a row of theirs that is pending
 *  or attending (so the only clause left is the date), otherwise `attendance_not_permitted`. */
leaveEvent(eventId: string): Promise<Result<void>>;

/** EVT-02. AC-16, AC-17, AC-18. `attending` approves a pending row, `rejected` rejects it,
 *  `removed` removes an attendee. Zero rows updated is `attendance_not_permitted`. */
decideAttendance(
  eventId: string,
  memberId: string,
  status: "attending" | "rejected" | "removed",
): Promise<Result<EventAttendance>>;
```

Every failure `message` is English (ui-design-system.md § *Language*), written by the Developer, one
sentence each, repeated verbatim in both implementations as EVT-01's are. `event_full`'s sentence
must not promise a waitlist.

### 4.4 Database — `supabase/migrations/20260929140000_evt02_attendance.sql`

Names below are fixed by this plan (RULE-04). The Developer writes the SQL; these are its shapes.

```sql
create type public.attendance_status as enum ('pending', 'attending', 'rejected', 'removed');

alter table public.event
  add column if not exists capacity              integer null,
  add column if not exists requires_approval     boolean not null default false,
  add column if not exists registration_deadline date    null;
-- added as named constraints, guarded so a re-run does not fail:
--   event_capacity_positive  check (capacity is null or capacity >= 1)
--   event_deadline_by_end    check (registration_deadline is null or registration_deadline <= end_date)

create table public.event_attendance (
  event_id   uuid not null references public.event(id) on delete cascade,
  member_id  uuid not null default auth.uid() references public.member(id),   -- restrict
  status     public.attendance_status not null,                             -- set by the guard
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
```

Functions — `set search_path = ''`, schema-qualified throughout:

- **`public.event_registration_open(p_event_id uuid) returns boolean`** — definer, `stable`:
  `(now() at time zone 'Asia/Ho_Chi_Minh')::date <= coalesce(registration_deadline, end_date)`.
- **`public.is_event_audience(p_event_id uuid, p_uid uuid) returns boolean`** — definer, `stable`:
  `member_team_id(p_uid) is not null` and the event exists and (`creator_id = p_uid` or
  `scope = 'public'` or (`scope = 'team'` and `team_id = member_team_id(p_uid)`) or (`scope = 'named'`
  and `is_event_invitee(id, p_uid)`)). **No `is_admin` clause** — AC-11.
- **`public.is_event_participant(p_event_id uuid, p_uid uuid) returns boolean`** — definer,
  `stable`: a row of `event_attendance` for that pair with state `pending` or `attending`. Exists so
  `event`'s select policy can consult attendance without recursing through its policy.
- **`public.event_attendance_guard()`**, `before insert or update` on `event_attendance`, definer,
  **volatile** (so each statement inside takes a fresh snapshot). First statement: lock the event row
  `for update`. Then — on insert: raise `EV002` unless `event_registration_open`; set
  `new.status := case when requires_approval then 'pending' else 'attending' end`, ignoring the wire.
  On update: raise 22023 unless `old.status → new.status` is one of pending→attending,
  pending→rejected, attending→removed, and unless only `status` changed; set `updated_at := now()`.
  In both, when `new.status = 'attending'` and `capacity` is not null and the count of `attending`
  rows for the event (excluding this row) is `>= capacity`, raise `EV001`.
- **`public.event_capacity_guard()`**, `before update of capacity` on `event`, definer, volatile:
  raise `EV003` when `new.capacity` is not null and below the count of `attending` rows. The update
  already holds the row's lock.
- **`public.save_event`** — **dropped by its old eight-argument signature and recreated** with three
  trailing parameters, `p_capacity integer default null`, `p_requires_approval boolean default false`,
  `p_registration_deadline date default null`, written into the insert and the update. Still
  `security invoker`; nothing else in its body changes. The defaults keep an eight-argument call
  valid.

Policies — `to authenticated`, `(select auth.uid())` wrapped, `drop … if exists` then `create`:

| Policy | On | Predicate |
|---|---|---|
| `event_select_visible` (**replaced**) | `event` select | EVT-01's predicate, with one more disjunct inside the parentheses: `or public.is_event_participant(id, uid)` |
| `event_attendance_select_visible` | `event_attendance` select | `member_team_id(uid) is not null and exists (select 1 from public.event e where e.id = event_id) and (status = 'attending' or member_id = uid or may_manage_event(event_id, uid))` — the `exists` runs under the caller's own `event` policy |
| `event_attendance_insert_own` | `event_attendance` insert | check `member_id = uid and is_event_audience(event_id, uid)` |
| `event_attendance_update_manage` | `event_attendance` update | using and check `may_manage_event(event_id, uid)` |
| `event_attendance_delete_own` | `event_attendance` delete | `member_id = uid and member_team_id(uid) is not null and status in ('pending', 'attending') and event_registration_open(event_id)` |

Grants — `to authenticated`, never `public`; `revoke all … from anon, authenticated` first, as EVT-01:

```sql
grant insert (capacity, requires_approval, registration_deadline) on public.event to authenticated;
grant update (capacity, requires_approval, registration_deadline) on public.event to authenticated;
grant select, delete on public.event_attendance to authenticated;
grant insert (event_id) on public.event_attendance to authenticated;
grant update (status)   on public.event_attendance to authenticated;
-- execute: revoke from public, anon; grant to authenticated — the five new functions and the new
-- save_event signature
```

`member_id` and `status` are withheld from the insert grant: a request naming either is refused
`42501` before a policy runs (AC-20, TEA-04's shape).

### 4.5 Selectors

`data-testid` values — every one the ACs name, and no others are required:

| Id | Where | AC |
|---|---|---|
| `event-capacity-input`, `event-approval-input`, `event-deadline-input` | the form, between dates and scope | AC-1, AC-28 |
| `event-seats` | detail; carries `data-taken` and `data-capacity` (empty when none) | AC-8, AC-21, AC-27 |
| `event-deadline` | detail; carries `data-open="true"|"false"` | AC-10, AC-27 |
| `event-join-button` | detail join panel | AC-6, AC-7, AC-27 |
| `event-my-status` | detail; carries `data-status` = the caller's `AttendanceStatus` | AC-7, AC-16, AC-17 |
| `event-leave-button`, `event-leave-confirm`, `event-leave-cancel` | leave and its confirmation, which names the event | AC-14, AC-29 |
| `event-requests`, `event-request` (with `data-member-id`), `event-request-approve`, `event-request-reject` | creator and admins, only when non-empty | AC-16, AC-22 |
| `event-attendees`, `event-attendee` (with `data-member-id`), `event-attendees-empty` | detail | AC-21, AC-27 |
| `event-attendee-remove`, `event-remove-confirm`, `event-remove-cancel` | creator and admins; confirmation names the person | AC-17, AC-29 |

`Modal` is reused with `testIdPrefix` `event-leave` and `event-remove`, as EVT-01 uses `event-delete`.

## 5. Seam impact

**Four functions added:** `listEventAttendance`, `joinEvent`, `leaveEvent`, `decideAttendance` —
each in `index.ts`, `supabase.ts` and `mock.ts` with the same name and arity, which
`tests/seam-parity.test.ts` checks without edit.

**Two existing functions widen without a signature change.** `createEvent` and `updateEvent` accept
the three optional `SaveEventInput` fields and return the three new `CalEvent` fields; `listEvents` and
`getEvent` select and map the three new columns. No existing caller must change — the test in
`.ai/01-operating-model.md` § *Sizing* for XL — and nothing in `src/` or `tests/` switches
exhaustively over `FailureCode`.

- **`supabase.ts`**: attendance reads through `from("event_attendance")` under RLS; `joinEvent` is a
  table insert of `{ event_id }` with `.select()` to read back the state the guard set;
  `decideAttendance` a `.update({ status }).eq(…).eq(…).select()`, zero rows → refusal; `leaveEvent`
  a `.delete().eq("event_id", …).eq("member_id", <caller>).select(…)`. A separate
  `toAttendanceFailure` mapper, on SQLSTATE only: `EV001`, `EV002`, `23505`, `22023`, `42501` /
  `PGRST301`.
- **`mock.ts`**: an in-memory `eventAttendance` array, emptied by the existing `__resetEvents()`. It
  reproduces every predicate and trigger in § 4.4 over `members`, `memberTeamId`, `mayManageEvent`
  and the new `registrationOpen(…, eventToday())`, and `mayReadEvent` gains the participant clause.
  **Check and write run with no `await` between them** — § 3.
- **`listMembers()` and every policy on `public.member` are untouched.**

**Invariants — how each is held (R8).** **INV-04:** the only people-read this ticket adds returns ids
and states, and names resolve through EVT-01's `list_member_directory()`; no policy on
`public.member` changes, so `listMembers()` — INV-04's denominator — returns what it returned before.
AC-23 asserts it from outside; a test also reads the migration and asserts it contains no
`on public.member` policy statement.

## 6. Schema delta

**One enum, one table, three columns and two named constraints on `event`, two triggers, five
functions (four new, `save_event` recreated with three trailing defaulted parameters), one replaced
and four new policies, and their grants** — § 4.4. `ticket.yaml`'s `schema_delta` said this in
outline; it stands.

**ADR:** [ADR-045](../../../registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md),
`ACCEPTED by the operator`, § *Consequences* on capacity, and decision points 3–6. `requires_adr:
false` stands. Inside its fence: capacity is held by the database under concurrency, not by a
read-then-write (§ 3), and the attendee list exposes no `member` column.

**A replaced policy is a policy change** — `event_select_visible` gains one disjunct. ADR-014 applies:
this is not `none`, and it is listed.

**One more cascade, chosen**, for the same reason as EVT-01's `event_invitee`: an attendance has no
meaning without its event, and AC-25 requires it to go with the event. `member_id` stays restrict.

**Two new SQLSTATE values.** The project so far raises only `42501` and `22023`. `EV001`–`EV003` are
custom codes — PostgreSQL accepts any five-character SQLSTATE in `raise … using errcode` — because
the mapper matches on SQLSTATE and never on message text, and "full", "closed" and "below attendees"
need three distinct sentences. The migration header says so.

**Applying it is human** (RULE-09). Idempotent in ADR-024's shape (guarded `do` blocks for the enum and
the two constraints, `add column if not exists`, `create table if not exists`, `drop function if
exists` for the old `save_event` signature, `create or replace` for the rest, `drop … if exists` then
`create` for triggers and policies), one transaction, and its header says it has not been run against
PostgreSQL and that the concurrency test is owed. `supabase/db.sql` is not updated — MD-033.

**Owed to `/thuki`, not this ticket:** the attendance rows in `.ai/standards/rbac-and-security.md`
(§ 3 is their source) and the table and three columns in `.ai/standards/data-model.md` (§ 4.4) —
ADR-045 § *Affected documents*.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260929140000_evt02_attendance.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/event-registration.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/EventDetail.tsx"
  - "src/routes/EventEditor.tsx"
  - "src/components/EventAttendancePanel.tsx"
  - "tests/event-attendance.test.ts"
  - "tests/e2e/evt-02-attendance.spec.ts"
```

**Eleven paths: `size: M`, agreeing with `size_estimate: M`.** **Deliberately absent:**
`src/routes/Events.tsx` (the list is unchanged — Out of scope); `src/App.tsx` (no new route);
`tests/events.test.ts` and `tests/e2e/evt-01-events.spec.ts` (the optional fields keep them compiling
and passing unedited — if either needs a change, that is a sign the contract broke a caller, and the
Developer stops); `src/lib/fixtures.ts` and `supabase/seed.sql` (the unit test acts as the existing
fixture people through `__setCurrentMember`, as EVT-01's does). `.ai/registry/glossary.md` is absent:
`ticket.yaml` carries no `glossary_owed`, and *Event*, *Attendee*, *Invitation* and *Capacity* already
have rows. **A twelfth file is still M; a thirteenth makes this `L`**, which must split — the Developer
stops and says so rather than adding one.

## 8. Rejected alternatives

**1. Holding the cap with a `security definer` `join_event` / `decide_attendance` function that
counts and writes, instead of a trigger on the table.** Genuinely plausible: one function per action
is easy to read, it is the RPC shape `save_event` already uses, and it could take the same row lock.
Rejected because the lock would then protect only the paths that go through those functions, and the
table stays writable by PostgREST directly. Every grant would have to be withdrawn to make the
function the only door, and a later ticket that adds one grant back reopens the race without an error
anywhere. A trigger runs on every write whatever its source, which is what "held in the database"
has to mean for ADR-045 revert condition 2.

**2. `SERIALIZABLE` isolation, or an advisory lock keyed on the event id, instead of `select … for
update` on the event row.** Serializable needs every caller to retry on `40001`, and PostgREST
requests do not; an advisory lock is a second lock namespace a capacity edit would also have to
remember to take. The event row is the thing the cap lives on, and an `UPDATE` of capacity already
takes its lock for free.

**3. Letting a rejected or removed person request again** — product's guess. Rejected in AC-19: on an
event needing no approval, removal would last until the removed person's next click.

**4. A separate attendee-read `security definer` function returning names, as the directory does.**
It would give the screen names in one call. Rejected: the directory already exposes exactly those
columns to every approved member, so a second function adds a second place a lost clause leaks names,
for no new information. The attendance table is new, so a select policy changes no existing read, and
it fails closed — EVT-01 § 8's first reason, again.

## Changelog

- `2026-09-29T11:51:56+0700` — section 2, AC-23. Written as *"only an id and a state — never … a
  status"*: the attendance row necessarily carries its own `status` and two timestamps, which "a
  status" appeared to forbid. Reworded to name exactly the five fields and to say *membership* status.
  The protection is unchanged — no role, team, membership status or `removed_at`. Raised by
  `tech-lead-design` on writing § 4.1. Amended by `tech-lead-design`.
