---
ticket: EVT-07
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-09T11:11:00+0700
inputs_read:
  - .ai/board/tickets/EVT-07/ticket.yaml
  - .ai/board/ideas/2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-02/01-plan.md
  - .ai/board/tickets/EVT-06/01-plan.md
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/components/EventAttendancePanel.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/App.tsx
  - tests/guest-link.test.ts
  - tests/e2e/evt-06-guest-link.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-07 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-07 | A guest registers for an opened event with a name and an email, and manages it from a link shown once |

The row's Notes are the scope, each clause an operator answer in
`.ai/board/ideas/2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md` § *Evidence*,
decided by ADR-052 (`ACCEPTED by the operator`): a name and an email, no account (the request); a
guest takes a seat and follows the event's capacity, approval mode and deadline as a member does
(Q5-A); one registration per email per event plus capacity and deadline is the whole spam control —
no captcha, no server (Q7-A); a secret manage link shown once on screen, for status and cancel
(Q6-B) — emailing it is a later ticket on `EVT-05` (Q6-C); guests' names are readable by everyone who
can read the event, guests' emails by the creator and admins only (F1); guest data is never deleted
(Q8). `EVT-02`'s concurrency guarantee must hold with anonymous writers in the race. A guest is not a
member and never enters an absence count.

**Who gains what.** `EVT-06` lets anyone holding an event's guest link see it; this ticket lets them
say *I'm coming* without an account. The organiser — and any admin — then sees guests beside members
in the list of who is coming, decides their requests and can take them off the list, and is the only
one who sees a guest's email. The guest keeps one secret address, shown once, from which they check
whether they are in and cancel. What changes for the event is that its seat count and its attendee
list are finally the whole headcount. The two properties that must not bend: the cap holds however
many members and guests press the button at once, and a guest's email reaches nobody but the creator
and admins.

**Out of scope.**

- **Emailing a guest anything** — their manage link (Q6-C), a decision, a change or a cancellation.
  A later ticket on top of `EVT-05`. A guest learns a decision by opening their manage link.
- **Notifying the creator in the app of a guest's request or cancellation.** ADR-052
  § *Consequences* expects it once `EVT-04` exists, and `EVT-04` does; but `notification.actor_id`
  is `not null references public.member(id)` and `public.notify` writes nothing without a signed-in
  actor (`20261008120000_evt04_notification.sql`), so it needs a change to `EVT-04`'s table and
  function and a way to render an actor who is not a member. The feature row does not list it. A
  later ticket; recorded here so nobody assumes it shipped.
- **A captcha, a rate limit, or any server-side check** (Q7-A).
- **Verifying that a guest owns their email.** Its shape is checked, nothing more (idea assumption 3).
- **Recovering a lost manage link.** Lost is lost; the creator or an admin can remove the guest
  (idea assumption 4).
- **Deleting, exporting or anonymising guest data**, by anyone (Q8). Nothing in this ticket deletes a
  guest row, including deleting the event (AC-20).
- **Reading guests of a deleted event**, for anyone. The rows are kept (AC-20); no screen or seam
  function reads them.
- **A separate guest capacity** (Q5) and **a guest becoming a member**, or carrying a registration to
  another event.
- **Reinstating a guest who was rejected, removed or who cancelled** — the `EVT-02` AC-19 shape;
  AC-9 here.
- **Showing guests' emails on the guest page**, ever (F1) — and showing **member** emails anywhere.
- **Any new power for `manager`.**
- **`.ai/standards/data-model.md`'s `event_guest` entity** — left to `/thuki`, the `EVT-01`,
  `EVT-02` and `EVT-06` precedent; § 7 says why. § 4.3 is its transcription source.

**`size_estimate: M`** — one migration (one table, one trigger, four replaced functions, five new
ones), six seam functions in both implementations, one changed panel, the guest page's form, one new
page in the same file, one route, their tests, and two registry/standards rows.

## 2. Acceptance criteria

Vocabulary, in addition to `EVT-01`'s, `EVT-02`'s and `EVT-06`'s (*can read an event*, *registration
is open*, *seats taken*, *straight to the datastore*, *may manage an event*, *signed out*, *the guest
page*, *open to guests*):

- **Guest** — glossary row written by this ticket. A person who registered through a guest link. Not
  a member and not an *attendee* in the glossary's sense.
- **A guest registration** — one guest's standing on one event, in exactly one of five states:
  **pending**, **attending**, **rejected**, **removed** — `EVT-02`'s four, with the same meanings —
  and **cancelled**, which the guest chose. A cancelled registration is kept, not deleted (Q8).
- **Seats taken** — from this ticket, attending members **plus attending guests**. Every place that
  shows or enforces seats taken counts both.
- **The manage link** — the address `<origin>/guest/registration/<manage-token>`, where
  `<manage-token>` is 64 lowercase hexadecimal characters. **The manage page** is what it opens.

### Registering

**AC-1 — a guest registers on an event needing no approval**
- Given the guest page of an event open to guests, needing no approval, registration open, a seat
  free or no capacity, and a signed-out caller
- When they enter a name in `guest-register-name` and an email in `guest-register-email` and press
  `guest-register-submit`, which reads *Register*
- Then the form is replaced by `guest-registered`, whose `guest-registered-status` reads that they
  are going
- And their name appears in `guest-event-attendees`, and `guest-event-seats` counts them
- And members reading the event in the product see the guest in `event-attendees` and counted in
  `event-seats` (AC-12)

**AC-2 — approval required: a guest waits, as a member does**
- Given the same, on an event needing approval
- Then `guest-register-submit` reads *Request to join*
- And after submitting, `guest-registered-status` reads that the request is waiting for the
  organiser's decision; the guest is not in `guest-event-attendees` and seats taken is unchanged
- And a request is accepted even when the event is full; it holds no seat (`EVT-02` AC-7, Q5-A)

**AC-3 — the manage link is shown once**
- Given `guest-registered` on screen after a registration
- Then it shows `guest-manage-link`, a read-only field holding the full manage link, with
  `guest-manage-copy-button` beside it, and a sentence saying the link is shown only this once and is
  the only way to see the registration's status or cancel it
- And `guest-manage-copy-button` behaves as `EVT-06` AC-8's copy does, through `guest-manage-copied`
- And reloading the guest page shows the form again, not the link; no read anywhere in the product —
  the guest page, the event detail page, any seam function, any table or function straight to the
  datastore, as any role — returns the manage token after the registration that created it
  (Q6-B, ADR-052 decision 6)

**AC-4 — what a guest gives, and what is refused**
- Given the form
- When the name is blank after trimming or longer than 100 characters, or the email is longer than
  254 characters or not of the shape *something@something.something* with no spaces
- Then nothing is saved and `guest-register-error` names the field; the same values sent straight to
  the datastore are refused
- And both are stored trimmed of surrounding spaces; the email's letter case is kept as entered
- *The two lengths are this plan's ceilings, not operator answers: a column an anonymous caller can
  write must be bounded, as `issue_report`'s are. The shape check is idea assumption 3.*

**AC-5 — one registration per email per event**
- Given an event with a guest registration under an email, in any state including cancelled
- When anyone registers on that event again with the same email, in any letter case, with or without
  surrounding spaces
- Then nothing is saved and `guest-register-error` says that email is already registered for this
  event
- And the same email registers on a **different** event as normal (Q7-A, ADR-052 decision 5)
- *Saying "already registered" tells the caller that an email they typed is on the event. This plan
  accepts that: the caller must already hold the link and the address, it reveals no email they did
  not supply, and the alternative — answering a duplicate as if it succeeded — would hand out a
  manage link that manages nothing. ADR-052 revert condition 2 is about an email being read, and this
  reads none.*

**AC-6 — full**
- Given an event needing no approval whose seats taken equals its capacity
- Then the guest page shows `guest-register-full` reading that the event is full, and no form
- And a registration sent straight to the datastore is refused as full (`EVT-02` AC-8)

**AC-7 — registration closed**
- Given an event whose registration is closed (`EVT-02`'s definition, `Asia/Ho_Chi_Minh`)
- Then the guest page shows `guest-register-closed` reading *Registration closed*, and no form
- And a registration sent straight to the datastore is refused; on the last open day it is still
  accepted until the day ends (`EVT-02` AC-10)

**AC-8 — only through an open guest link**
- Given a token that never existed, is malformed, or belongs to an event closed to guests or deleted
- When a registration is sent with it straight to the datastore
- Then it is refused with one answer, the same in every one of those cases, and nothing is saved
- And closing an event to guests leaves every registration already made exactly as it was — counted,
  listed, and manageable from its manage link (ADR-052 decision 2, idea assumption 2)

**AC-9 — rejected, removed and cancelled are final for that email**
- Given a guest registration that was rejected, removed or cancelled
- Then registering on that event again with that email is refused as AC-5 refuses it
- *`EVT-02` AC-19's reason, for the same event: on an event needing no approval, a removal would
  otherwise last until the guest's next submit. Extended to cancelled because the row is kept (Q8)
  and the email is still on it — this plan's decision, cheap to reverse with a partial index.*

**AC-10 — the cap holds with guests in the race**
- Given an event with exactly one seat free
- When any two of these arrive at the datastore at the same moment — a guest registration on an
  event needing no approval, a member's instant join, an approval of a member's request, an approval
  of a guest's request, a capacity reduction
- Then at most one takes the seat, the other is refused as full (or, for the capacity change, as
  below attendees), and seats taken never exceeds capacity at any moment (ADR-052 § *Consequences*,
  revert condition 3; ADR-045 revert condition 2)
- And capacity may not be set below seats taken counting guests (`EVT-02` AC-4)

### The manage page

**AC-11 — a guest reads their registration**
- Given a manage link, opened by anyone, signed in or out
- Then `guest-registration` shows, top to bottom: `guest-registration-event` (the event's name),
  `guest-registration-dates`, `guest-registration-location` when it has one,
  `guest-registration-name` (the guest's name), and `guest-registration-status`, whose `data-status`
  is the state and whose sentence is one of: waiting for a decision; going; declined; taken off the
  list; cancelled
- And it shows no email, no other guest, no attendee list and no seat count
- And it works whether or not the event is still open to guests (AC-8)
- And the page carries the two `<meta>` tags of `EVT-06` AC-15

**AC-12 — a guest cancels, while registration is open**
- Given the manage page of a pending or attending registration, registration open
- When the guest presses `guest-registration-cancel-button` and confirms in the dialog
  (`guest-cancel-confirm`)
- Then `guest-registration-status` reads cancelled, the guest leaves `guest-event-attendees` and every
  attendee list, and seats taken drops by one if they were attending
- And `guest-cancel-cancel` changes nothing
- And no cancel control is shown, and a cancel sent straight to the datastore is refused, once
  registration is closed or the registration is already rejected, removed or cancelled (`EVT-02`
  AC-15, Q18 by Q5-A)

**AC-13 — a manage link that does not work**
- Given a manage token that never existed or is malformed
- When the manage page is opened with it
- Then it shows `guest-registration-not-found`, the same wording in both cases, and nothing on it
  distinguishes them
- And a cancel sent straight to the datastore with it is refused with that same one answer

### What members see

**AC-14 — every reader of the event sees attending guests by name**
- Given a member who can read an event with attending guests
- Then `event-attendees` lists each attending guest as `event-guest-attendee`, by the name they gave,
  marked *Guest*, beside the members, all in the order they joined
- And `event-seats` counts them
- And a pending, rejected, removed or cancelled guest is not listed and not counted
- And the guest page's `guest-event-attendees` lists attending guests' names among the members',
  unmarked, in join order, and `guest-event-seats` counts them (F3-A)

**AC-15 — only the creator and admins see a guest's email**
- Given an event with guests
- Then its creator and every admin see each guest's email in `event-guest-email`, beside that guest
  in `event-attendees` and in `event-requests`
- And every other member — a manager, an attendee, a named person, the guest's fellow guests — sees no
  email on any screen, and `listEventGuests` returns `email: null` for every guest to them
- And reading guests' emails straight to the datastore as such a member, or signed out, returns
  nothing or is refused (F1, ADR-052 decision 7, revert condition 2)

**AC-16 — the creator and admins decide guests' requests**
- Given a pending guest registration
- Then its event's creator and every admin see it in `event-requests` as `event-guest-request`,
  marked *Guest*, with `event-guest-request-approve` and `event-guest-request-reject`
- And approving makes it attending — refused as full when no seat is free, the approve control
  disabled then — and rejecting makes it rejected, with no reason asked for (`EVT-02` AC-16)
- And the guest sees the new state on the manage page
- And deciding does not close with registration (`EVT-02` AC-18)

**AC-17 — the creator and admins remove a guest**
- Given an attending guest
- When the creator or an admin presses `event-guest-attendee-remove` and confirms with
  `event-guest-remove-confirm` in a dialog naming the guest
- Then they leave every attendee list, seats taken drops by one, and the manage page reads that they
  were taken off the list; `event-guest-remove-cancel` changes nothing
- *Idea assumption 4.*

**AC-18 — nobody else decides or writes**
- Given a member or manager who did not create the event, or a signed-out caller
- Then they see no approve, reject or remove control for a guest, and any change to a guest
  registration sent straight to the datastore is refused and changes nothing
- And nobody — creator and admins included — can create a guest registration except through a guest
  link, set a registration's state to cancelled except through its manage link, choose a
  registration's state on creating it, or change its name, email or event
- And only these changes exist: pending → attending, pending → rejected, attending → removed (the
  creator and admins); pending → cancelled, attending → cancelled (the manage link, registration
  open)

### What it does not touch

**AC-19 — a guest is not a member**
- Given any number of guest registrations in any state
- Then `listMembers`, `listMemberDirectory`, the roster screens, every entry, the absence count and
  the overload state of every date are exactly what they were (ADR-052 decision 9)
- And no guest registration creates, changes or reads a row of `public.member`

**AC-20 — guest data is kept**
- Given an event with guest registrations
- When it is deleted (`EVT-01` AC-15)
- Then every one of its guest registrations still exists, and its manage page shows the event's name
  as it was and says the event was cancelled, with no cancel control
- And no action in the product deletes a guest registration (Q8, ADR-052 decision 8)

**AC-21 — the anon key reaches only the guest functions**
- Given a signed-out caller going straight to the datastore with the anon key
- Then it may call exactly six functions: `EVT-06`'s two guest reads, and this ticket's
  `get_guest_event_terms`, `register_guest`, `get_guest_registration` and `cancel_guest_registration`
- And reading or writing `event_guest` or any other table, and calling `list_event_guest_emails` or
  any other function, is refused
- And no function returns a guest's email, a manage token, a guest's id, or anything of an event but
  `EVT-06` AC-12's fields and the two of AC-22
- *Supersedes `EVT-06` AC-14's "any other function but the two guest reads is refused" by naming four
  more, each taking a token and nothing an anonymous caller could widen.*

**AC-22 — the guest page learns two more facts, from its own read**
- Given the guest page with a valid token
- Then it learns whether joining needs approval and whether registration is open, through
  `getGuestRegistrationTerms`, and from nothing else
- And `getGuestEvent` returns exactly `EVT-06` AC-12's fields, unchanged
- *ADR-052 decision 4: a guest follows the approval mode and deadline, and cannot follow what they
  are not told. Kept out of `GuestEvent` so `EVT-06` AC-12 stays literally true.*

**Invariants touched: `[INV-04]`.** Guests are shown among attendees and counted in seats taken, the
nearest the product has come to a second kind of person. INV-04's denominator is what `listMembers()`
returns; a design that stored a guest as a `public.member` row, or reached guests' names through a
widened `member` policy, would change every team's absence count. It is held by § 4.3: guests live in
their own table with no reference to `member`, no policy or grant on `public.member` changes, and no
entry is read or written. AC-19 asserts it from outside. INV-01–03 and INV-05–07 constrain entries,
which nothing here touches; ADR-052 decision 9 records that INV-05 and INV-07 are not engaged.

**Open questions.** None that block. This plan's own decisions, each marked where it stands and each
cheap to reverse: the length ceilings (AC-4), answering a duplicate email plainly (AC-5), cancelled is
final for that email (AC-9), and the anonymous terms read (AC-22).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/EVT-07/design/` (the folder does not exist) or cited by the idea
file. Nothing below is a behaviour beyond § 2.

**The guest page** keeps `EVT-06`'s card and order and gains one block, `guest-register`, between
`guest-event-seats` and `guest-event-attendees`, behind the card's `border-t border-line pt-4`
divider:

- A heading, small caps as *Going* is: **Register** (no approval) or **Request to join** (approval),
  and under it, for approval, one muted line: *The organiser approves each request.*
- Two stacked fields, full width, *Your name* and *Your email*, the email `type="email"`
  `autoComplete="email"`; then the primary pill `guest-register-submit`. `guest-register-error`
  (role `alert`) above the button.
- **Closed** or **full**: the block holds only `guest-register-closed` or `guest-register-full`, one
  muted sentence; *Full* in the overloaded-day pink pill, never red.
- **After submitting**: the block becomes `guest-registered` — the status sentence; then a soft
  lavender callout holding `guest-manage-link` (read-only, full width, selects itself on focus),
  `guest-manage-copy-button` **Copy**, `guest-manage-copied`, and the sentence *Save this link. It is
  shown only once, and it is the only way to check your registration or cancel it.*

**The manage page — `/guest/registration/:token`**, in `BareLayout` beside `/guest/:token`: the same
centred `max-w-xl` card under the muted product name. Event name as the heading, dates and location
in `text-ink-2`, a divider, *Registered as* and the guest's name, then the status as a pill (peach
for waiting, mint for going, the field grey for the other three), and for pending or attending with
registration open, `guest-registration-cancel-button` **Cancel my registration** as a text-style
button in `text-danger`. The confirmation is the shared `Modal`, `testIdPrefix="guest-cancel"`,
heading *Cancel your registration?*, body *Your seat or request will be given up. You cannot register
again with this email.* `guest-registration-not-found` is `EVT-06`'s not-found card with *This link
does not work. Check that you copied the whole address.*

**The event detail page** — `EventAttendancePanel` only. Guests sit in the existing **Requests** and
**Going** lists, merged with members by join order: a guest pill has no avatar, the name, and a small
*Guest* tag in `text-ink-3`; for the creator and admins the email follows in `text-ink-3` inside the
same pill. Remove confirms in the shared `Modal`, `testIdPrefix="event-guest-remove"`, heading
*Remove <name>?*, body *They will be taken off the list for "<event>" and cannot register again with
this email.* The *Going (N)* and *Requests (N)* counts include guests.

English copy throughout (idea assumption 5); no Vietnamese diacritic in interface copy. Names are
user content and render as stored.

## 3. Permission model

Server-side always: the controls are the grants, policies, trigger and definer functions in § 4.3.
Every check in the seam or the interface is an affordance.

| Action | signed out (`anon`) | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|---|
| Register on an event, through its open guest link | ✅ | ✅ | ✅ | ✅ | `register_guest(text, text, text)`; `event_guest_guard` for open-ness, capacity, duplicates |
| Register through any other token, or with no token | ❌ | ❌ | ❌ | ❌ | `register_guest` raises `EV004`; no insert grant on `event_guest` to anyone |
| Choose the state, the manage token, or the event id | ❌ | ❌ | ❌ | ❌ | `register_guest` takes none; the guard sets the state |
| Read whether an open event needs approval and is open for registration | ✅ | ✅ | ✅ | ✅ | `get_guest_event_terms(text)` |
| Read one's own registration, with its manage token | ✅ | ✅ | ✅ | ✅ | `get_guest_registration(text)` |
| Cancel one's own registration, registration open | ✅ | ✅ | ✅ | ✅ | `cancel_guest_registration(text)`; the guard checks open-ness and the transition |
| Read attending guests' names and states, of an event they can read | ❌ | ✅ | ✅ | ✅ | `event_guest_select_visible`; column grant excludes `email` and `manage_token_hash` |
| Read pending, rejected, removed, cancelled guests | ❌ | own event only | own event only | ✅ any | same policy — the `may_manage_event` clause |
| Read guests' emails | ❌ | own event only | own event only — **as a manager, nothing more** | ✅ any | `list_event_guest_emails(uuid)` — `may_manage_event`, never `may_decide` |
| Read a manage token, or its hash | ❌ | ❌ | ❌ | ❌ | column grant; the plain token is stored nowhere |
| Approve, reject, remove a guest | ❌ | own event only | own event only | ✅ any | `event_guest_update_manage`; column grant `update (status)` |
| Set a guest's state to cancelled | ❌ | ❌ | ❌ | ❌ | the update policy's `with check (status <> 'cancelled')`; only `cancel_guest_registration` writes it |
| Change a guest's name, email or event | ❌ | ❌ | ❌ | ❌ | column grant `update (status)` only; the guard refuses it too |
| Delete a guest registration | ❌ | ❌ | ❌ | ❌ | no delete grant; the event reference is `on delete set null` (AC-20) |
| Any of the above as a removed or not-approved member | as signed out | ❌ | ❌ | ❌ | every member predicate starts from `member_team_id(uid) is not null`; the four guest functions treat them as anyone holding a token |

**Denials the tests must assert**, both implementations where the mock can express them: a
non-manager reader gets `email: null` for every guest and no pending guest (AC-15); a manager gets the
same (AC-15); a non-manager's and a signed-out caller's `decideGuest` is `attendance_not_permitted`
(AC-18); `decideGuest(…, "cancelled")` is refused for everyone (AC-18); `registerGuest` with a dead,
closed or malformed token is `guest_link_not_found` (AC-8); `cancelGuestRegistration` with an unknown
token is `guest_registration_not_found` (AC-13); no seam return carries a manage token except
`registerGuest`'s (AC-3).

**Why the cap holds with guests** (AC-10). `EVT-02` § 3's argument, widened by one table. Every write
that can raise seats taken — an `event_attendance` insert or update to `attending`, an `event_guest`
insert or update to `attending` — runs a guard whose first statement is `select … from public.event
where id = … for update`; every capacity change is an `UPDATE` of that row. On one event they are
serialised, and each counts attending members **and** attending guests by a fresh statement after it
holds the lock. `event_attendance_guard` and `event_capacity_guard` are replaced to count guests; the
new `event_guest_guard` counts members. A guard that counted only its own table would let a member
and a guest take the last seat together — the exact failure ADR-052 § *Consequences* names.

**The definer functions are not the fence for the cap**; the trigger is (`EVT-02` § 8 alternative
1). `register_guest` is the only door for an anonymous *insert* because no role holds an insert grant
on `event_guest`; the guard runs on every write whatever its source.

**The mock reproduces these clause for clause and cannot prove them** — the `EVT-01` precedent. The
lock is asserted by reading the migration. The migration is applied by a human (RULE-09); the
permission-model test and the concurrency test against a real PostgreSQL stay owed project-wide.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Appended under a new `EVT-07` banner after `EVT-06`'s. **No existing type changes** — `GuestEvent`
keeps exactly `EVT-06`'s keys (AC-22).

```ts
// ---------------------------------------------------------------------------
// EVT-07 — guest registration. 01-plan.md section 4.1. ADR-052.
// ---------------------------------------------------------------------------

/** EVT-07. The five states of one guest's registration — `EVT-02`'s four and `cancelled`, which only
 *  the guest's manage link writes. The database enum `public.guest_status`, verbatim. A cancelled
 *  row is kept (Q8). */
export type GuestStatus = "pending" | "attending" | "rejected" | "removed" | "cancelled";

/** EVT-07. Glossary *Guest*. One row of `public.event_guest`, as a member reads it. `email` is null
 *  to everyone but the event's creator and admins (AC-15) — never omitted, always present. */
export interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  email: string | null;
  status: GuestStatus;
  createdAt: string;
  updatedAt: string;
}

/** EVT-07 AC-22. The two facts the guest page needs to offer the right form. Not part of
 *  `GuestEvent` on purpose — `EVT-06` AC-12. */
export interface GuestRegistrationTerms {
  requiresApproval: boolean;
  /** `EVT-02`'s *registration is open*, by the database's clock. */
  registrationOpen: boolean;
}

/** EVT-07 AC-1, AC-2, AC-3. What a successful registration returns — the ONLY place a manage token
 *  ever leaves the database. */
export interface GuestRegistrationReceipt {
  manageToken: string;
  status: "pending" | "attending";
}

/** EVT-07 AC-11, AC-20. What the manage page reads. No email, no id, no other person. */
export interface GuestRegistrationView {
  /** The live name, or the name as it was when the event was deleted. */
  eventName: string;
  /** Null once the event is deleted (AC-20). */
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  guestName: string;
  status: GuestStatus;
  /** False once the event is deleted. */
  registrationOpen: boolean;
  eventDeleted: boolean;
}

/** EVT-07 AC-4. The ceilings and the shape, as the database's checks state them. */
export const GUEST_NAME_MAX = 100;
export const GUEST_EMAIL_MAX = 254;
export const GUEST_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
```

Five `FailureCode` members, appended to the union after `EVT-02`'s:

```ts
  // EVT-07. Name blank after trimming, or over GUEST_NAME_MAX — AC-4. `register_guest` (EV006).
  | "invalid_guest_name"
  // EVT-07. Email over GUEST_EMAIL_MAX or not GUEST_EMAIL_PATTERN — AC-4. `register_guest` (EV007).
  | "invalid_guest_email"
  // EVT-07. That email already has a registration on this event, in any state — AC-5, AC-9. 23505.
  | "guest_already_registered"
  // EVT-07. The guest link is not an open event's — AC-8. `register_guest` (EV004). One sentence for
  // every cause.
  | "guest_link_not_found"
  // EVT-07. The manage token matches no registration — AC-13. `cancel_guest_registration` (EV005).
  | "guest_registration_not_found"
```

Refusals also reuse `event_full`
(EV001), `event_registration_closed` (EV002), `invalid_attendance_change` (22023) and
`attendance_not_permitted` (42501, or zero rows). Every `message` is English, one sentence, verbatim
in both implementations; `guest_link_not_found`'s and `guest_registration_not_found`'s say the link
does not work and nothing about why.

### 4.2 Seam — `src/lib/data/index.ts`

Appended to `DataSeam` under an `EVT-07` banner after `EVT-06`'s. Both implementations, same names and
arity. **No existing function's signature changes.**

```ts
  // -------------------------------------------------------------------------
  // EVT-07 — guest registration. 01-plan.md section 4.2. ADR-052.
  //
  // Six functions. Four work with no session and take only a token: they are the anon role's only
  // writes. Members read guests through `event_guest`'s select policy; emails through a definer
  // function that answers the creator and admins only. The cap is `event_guest_guard`'s, under the
  // event row's lock — nothing here counts seats to decide a write.
  // -------------------------------------------------------------------------

  /** EVT-07 AC-22. Null for a token failing GUEST_LINK_TOKEN_PATTERN (no round trip) and for one that
   *  is not an open event's. Throws on a read failure. */
  getGuestRegistrationTerms(token: string): Promise<GuestRegistrationTerms | null>;

  /** EVT-07 AC-1..AC-10. Works with no session. Trims both values. A token failing the pattern is
   *  `guest_link_not_found` with no round trip; name and email failing § 4.1's checks are refused
   *  before the round trip with the same codes the database would give. */
  registerGuest(token: string, name: string, email: string): Promise<Result<GuestRegistrationReceipt>>;

  /** EVT-07 AC-11, AC-13, AC-20. Works with no session. Null for a malformed or unknown manage token.
   *  Throws on a read failure. */
  getGuestRegistration(manageToken: string): Promise<GuestRegistrationView | null>;

  /** EVT-07 AC-12, AC-13. Works with no session. A malformed token is `guest_registration_not_found`
   *  with no round trip. */
  cancelGuestRegistration(manageToken: string): Promise<Result<void>>;

  /** EVT-07 AC-14, AC-15, AC-16. The guests of one event the caller may read: attending guests to any
   *  reader; every guest to its creator and admins. `email` filled only for the creator and admins.
   *  Empty for an event the caller cannot read, and signed out. Ordered `createdAt`, then `id`.
   *  Bounded by DATASTORE_MAX_ROWS and throws at the bound. */
  listEventGuests(eventId: string): Promise<EventGuest[]>;

  /** EVT-07 AC-16, AC-17, AC-18. `attending` approves a pending guest, `rejected` rejects one,
   *  `removed` removes an attending one. Zero rows updated is `attendance_not_permitted`. */
  decideGuest(guestId: string, status: "attending" | "rejected" | "removed"): Promise<Result<EventGuest>>;
```

**`src/lib/data/supabase.ts`.**
`getGuestRegistrationTerms`: `rpc("get_guest_event_terms", { p_token })`, zero rows → null.
`registerGuest`: `rpc("register_guest", { p_token, p_name, p_email })`, one row → receipt.
`getGuestRegistration`: `rpc("get_guest_registration", { p_manage_token })`.
`cancelGuestRegistration`: `rpc("cancel_guest_registration", { p_manage_token })`.
`listEventGuests`: `from("event_guest").select("id, event_id, name, status, created_at,
updated_at").eq("event_id", eventId).order("created_at").order("id").limit(DATASTORE_MAX_ROWS)`, then
`rpc("list_event_guest_emails", { p_event_id })` merged by id — **never `select("*")`**, which the
column grant refuses. `decideGuest`: `from("event_guest").update({ status }).eq("id",
guestId).select(<the same six columns>)`, zero rows → refusal; the returned row's email is null (the
panel reloads through `listEventGuests`). A `toGuestFailure` mapper on SQLSTATE only: `EV001`,
`EV002`, `EV004`, `EV005`, `EV006`, `EV007`, `23505`, `22023`, `42501`/`PGRST301`. **Nothing else in
`supabase.ts` changes** — the guards and the two guest reads are replaced in the database, and
`getGuestEvent`'s calls are unchanged.

**`src/lib/data/mock.ts`.** A module-level `eventGuests` array of `{ id, eventId: string | null,
eventName, name, email, manageTokenHash, status, createdAt, updatedAt }`, emptied by
`__resetEvents()`. The manage token is 32 bytes from `crypto.getRandomValues`, hex-encoded; the row
keeps a SHA-256 of it (`crypto.subtle.digest`), never the token. **The existing `seatsTaken` helper
counts attending guests too**, which carries `joinEvent`, `decideAttendance`, the capacity check in
`updateEvent` and `getGuestEvent`'s `seatsTaken` with it; `getGuestEvent`'s `attendeeNames` merge
attending guests' names by `createdAt`. `deleteEvent` sets the event's guests' `eventId` to null and
keeps them (AC-20). Check and write run with no `await` between them (`EVT-02` § 3).

### 4.3 Database — `supabase/migrations/20261009150000_evt07_guest_registration.sql`

One transaction, idempotent in ADR-024's shape. Names fixed here (RULE-04); the Developer writes the
SQL.

```sql
do $$ begin
  create type public.guest_status as enum ('pending', 'attending', 'rejected', 'removed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.event_guest (
  id                uuid primary key default gen_random_uuid(),
  -- AC-20. SET NULL, NOT CASCADE: guest data is never deleted (Q8). The second `set null` in the
  -- schema after EVT-04's notification.
  event_id          uuid null references public.event(id) on delete set null,
  -- Written by the guard from the event at insert; read only once the event is gone.
  event_name        text not null,
  name              text not null,
  email             text not null,
  -- encode(sha256(convert_to(<token>, 'UTF8')), 'hex'). The token itself is stored nowhere (AC-3).
  manage_token_hash text not null unique,
  status            public.guest_status not null,          -- set by the guard
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint event_guest_name_shape  check (btrim(name) = name and name <> '' and char_length(name) <= 100),
  constraint event_guest_email_shape check (btrim(email) = email and char_length(email) <= 254
                                            and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint event_guest_hash_shape  check (manage_token_hash ~ '^[0-9a-f]{64}$')
);
-- AC-5, AC-9. Any state, cancelled included.
create unique index if not exists event_guest_event_email on public.event_guest (event_id, lower(email));
alter table public.event_guest enable row level security;
```

`sha256(bytea)` is core PostgreSQL 11+; no extension is needed.

**The guard — `public.event_guest_guard()`**, `before insert or update` on `event_guest`, definer,
volatile, `set search_path = ''`:

- **Update with `old.event_id` not null and `new.event_id` null** (the `set null` from deleting the
  event): every other column unchanged → `return new` at once, no lock. Anything else → 22023.
- **Otherwise, first statement**: `select * into v_event from public.event where id = new.event_id
  for update`. Not found → `EV004`.
- **Insert**: a row for `(new.event_id, lower(new.email))` exists → 23505 `guest_already_registered`
  (raised here so EV001/EV002 never mask it); `public.event_registration_open(new.event_id)` false →
  `EV002`; `new.status := case when v_event.requires_approval then 'pending' else 'attending' end`;
  `new.event_name := v_event.name`; both timestamps `now()`.
- **Update**: only `status` and `updated_at` may differ, and only pending→attending, pending→rejected,
  attending→removed, pending→cancelled, attending→cancelled; else 22023. To `cancelled`:
  `event_registration_open(new.event_id)` false → `EV002`. `new.updated_at := now()`.
- **Both**: when `new.status = 'attending'` and `capacity` is not null, count attending rows of
  `event_attendance` for the event **plus** attending rows of `event_guest` for it other than
  `new.id`; `>= capacity` → `EV001`.

**Replaced, same signature, `create or replace`** (ADR-014 — listed in § 6):

- `public.event_attendance_guard()` — `EVT-02`'s body verbatim, with its seat count gaining
  `+ (select count(*) from public.event_guest g where g.event_id = new.event_id and g.status =
  'attending')`.
- `public.event_capacity_guard()` — `EVT-02`'s body verbatim, with the same addition for `new.id`.
- `public.get_guest_event(text)` — `EVT-06`'s body verbatim, `seats_taken` gaining the guest count.
- `public.list_guest_event_attendees(text)` — `EVT-06`'s rows `union all` attending guests' `name`
  for the same token, ordered by `created_at` then the row's id as text. Return type unchanged.

**New functions** — definer, `set search_path = ''`, schema-qualified:

```sql
-- AC-22. Zero rows for any token but an open event's.
public.get_guest_event_terms(p_token text)
  returns table (requires_approval boolean, registration_open boolean)            -- stable

-- AC-1..AC-10. Trims; EV006 / EV007 for § 4.1's checks; resolves the token through
-- event_guest_link (no match, or failing ^[0-9a-f]{64}$ → EV004); draws a 64-hex token from two
-- gen_random_uuid(); inserts (event_id, name, email, manage_token_hash) — event_name and status are
-- the guard's; returns the plain token and the state the guard set.
public.register_guest(p_token text, p_name text, p_email text)
  returns table (manage_token text, status public.guest_status)                    -- volatile

-- AC-11, AC-20. Looks up by the hash. Zero rows for an unknown or malformed token. Event fields from
-- the live event when it exists; otherwise event_name, nulls, registration_open false, event_deleted
-- true.
public.get_guest_registration(p_manage_token text)
  returns table (event_name text, start_date date, end_date date, location text,
                 guest_name text, status public.guest_status,
                 registration_open boolean, event_deleted boolean)                 -- stable

-- AC-12, AC-13. Updates to 'cancelled' by the hash; the guard refuses a closed registration (EV002)
-- or an illegal transition (22023). No row for the hash → EV005.
public.cancel_guest_registration(p_manage_token text) returns public.guest_status  -- volatile

-- AC-15. Zero rows unless may_manage_event(p_event_id, auth.uid()).
public.list_event_guest_emails(p_event_id uuid)
  returns table (guest_id uuid, email text)                                        -- stable
```

**Policies** — `to authenticated`, `(select auth.uid())` wrapped, drop-then-create:

| Policy | On | Predicate |
|---|---|---|
| `event_guest_select_visible` | select | `member_team_id(uid) is not null and exists (select 1 from public.event e where e.id = event_id) and (status = 'attending' or may_manage_event(event_id, uid))` — the `exists` runs under the caller's own `event` policy |
| `event_guest_update_manage` | update | using `may_manage_event(event_id, uid)`; check `may_manage_event(event_id, uid) and status <> 'cancelled'` |

No insert or delete policy. The definer functions write as their owner, as `EVT-04`'s `notify`
inserts into `notification` with no insert policy.

**Grants:**

```sql
revoke all on public.event_guest from anon, authenticated;
grant select (id, event_id, name, status, created_at, updated_at) on public.event_guest to authenticated;
grant update (status) on public.event_guest to authenticated;

-- revoke all … from public, anon, authenticated on each new function first, then:
grant execute on function public.get_guest_event_terms(text)             to anon, authenticated;
grant execute on function public.register_guest(text, text, text)         to anon, authenticated;
grant execute on function public.get_guest_registration(text)             to anon, authenticated;
grant execute on function public.cancel_guest_registration(text)          to anon, authenticated;
grant execute on function public.list_event_guest_emails(uuid)            to authenticated;
-- event_guest_guard(): revoke from public, anon; grant to authenticated (EVT-02's shape).
```

**`create or replace` keeps a function's existing grants**, so the four replaced functions keep
`EVT-02`'s and `EVT-06`'s; the migration does not re-grant them.

### 4.4 Screens

**`src/App.tsx`.** One route, beside `/guest/:token` in the same `BareLayout`, no guard:

```tsx
<Route path="/guest/registration/:token" element={<GuestRegistration />} />
```

**`src/routes/GuestEvent.tsx`.** The default export loads `getGuestEvent` and
`getGuestRegistrationTerms` together; a null or thrown terms read leaves the page as `EVT-06` draws
it with no `guest-register` block. A new component in the file, `GuestRegisterPanel({ token, event,
terms, onRegistered })`, draws § 2b's block and calls `onRegistered` so the page re-reads
`getGuestEvent`. **A named export `GuestRegistration(): JSX.Element`** in the same file is the manage
page, sharing `useGuestMeta` and the card; states `loading`, `ready`, `missing` (null *or* thrown —
AC-13). Exports `guestManageUrl(origin: string, token: string): string` returning
`` `${origin}/guest/registration/${token}` ``, and `guestRegistrationProblem(name: string, email:
string): "invalid_guest_name" | "invalid_guest_email" | null` for the form and the unit test.

**`src/components/EventAttendancePanel.tsx`.** `load` adds `seam.listEventGuests(event.id)` beside
`listEventAttendance`. `taken` becomes attending members plus attending guests; `full` follows.
Requests and Going merge members and guests by `createdAt`. Guest rows render as § 2b says, with the
§ 4.5 selectors; approve, reject and remove call `seam.decideGuest`. `EventDetail.tsx` does not
change.

### 4.5 Selectors

| Selector | Where | AC |
|---|---|---|
| `guest-register` | guest page block | AC-1, AC-2 |
| `guest-register-name`, `guest-register-email`, `guest-register-submit`, `guest-register-error` | guest page form | AC-1, AC-2, AC-4, AC-5 |
| `guest-register-full`, `guest-register-closed` | guest page block | AC-6, AC-7 |
| `guest-registered`, `guest-registered-status` (with `data-status`) | after registering | AC-1, AC-2 |
| `guest-manage-link`, `guest-manage-copy-button`, `guest-manage-copied` | after registering | AC-3 |
| `guest-registration`, `guest-registration-event`, `guest-registration-dates`, `guest-registration-location`, `guest-registration-name`, `guest-registration-status` (with `data-status`) | manage page | AC-11, AC-20 |
| `guest-registration-cancel-button`, `guest-cancel-confirm`, `guest-cancel-cancel` | manage page and its modal | AC-12 |
| `guest-registration-error` | manage page | AC-12 |
| `guest-registration-not-found` | manage page | AC-13 |
| `event-guest-attendee` (with `data-guest-id`), `event-guest-attendee-remove` | detail, Going | AC-14, AC-17 |
| `event-guest-remove-confirm`, `event-guest-remove-cancel` | its modal | AC-17 |
| `event-guest-request` (with `data-guest-id`), `event-guest-request-approve`, `event-guest-request-reject` | detail, Requests | AC-16 |
| `event-guest-email` | inside a guest row, creator and admins only | AC-15 |

`event-seats`' `data-taken` counts guests (AC-14). `EVT-02`'s and `EVT-06`'s selectors are otherwise
unchanged.

## 5. Seam impact

Six functions added to `DataSeam` and to both implementations with the same names and arity:
`getGuestRegistrationTerms`, `registerGuest`, `getGuestRegistration`, `cancelGuestRegistration`,
`listEventGuests`, `decideGuest`. **No existing signature changes.** Two existing functions change
behaviour without a signature change, both to count guests: the mock's `seatsTaken` helper (and so
`joinEvent`, `decideAttendance`, `updateEvent`'s capacity check and `getGuestEvent`), and the mock's
`deleteEvent`, which keeps the event's guests with a null event. With no guests, every one of them
returns what it returned before — so no existing test changes, and this is not XL (operating model
§ *Sizing*). `listMembers()` and every policy on `public.member` are untouched.

## 6. Schema delta

**Not `none`.** One enum, one table with three check constraints, a unique column and a unique
index, one trigger and its function, two policies and column grants; five new definer functions,
four granted to `anon`; and **four existing functions replaced with the same signatures** —
`event_attendance_guard` and `event_capacity_guard` (`EVT-02`), `get_guest_event` and
`list_guest_event_attendees` (`EVT-06`). A replaced trigger function is a trigger change, so ADR-014
applies and they are listed. Decided by
[ADR-052](../../../registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md),
`ACCEPTED by the operator` — `requires_adr: true` is met.

**Departs from `ticket.yaml`'s triage description** in one word: *a secret manage token* is stored
as its SHA-256, never in plain (AC-3 — "shown once" is then a property of the schema). The rest —
a guest registration table counted with attendance, a unique email per event, the anon role's first
write — stands. `schema_delta` is rewritten to say so.

**Why `set null` and a name snapshot** rather than `EVT-02`'s cascade: ADR-052 decision 8 keeps guest
data indefinitely, and a cascade is a deletion path. `EVT-04`'s `notification.event_id` is the
precedent for both. The guard's first branch exists because the `set null` is itself an `UPDATE`
that fires it.

**Why the anonymous writes are definer functions and not an `anon` insert policy**: `EVT-06` § 6's
reason — a policy cannot see the token the caller holds, so it could test only "is open", which makes
every open event writable by anyone who learns an event id. The cap is still the trigger's.

**`EVT-02`'s concurrency guarantee is extended, not weakened** — § 3. The concurrency test against
a real PostgreSQL stays owed; the migration header says so.

**Applying it is human** (RULE-09). `supabase/db.sql` is not updated (MD-033).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261009150000_evt07_guest_registration.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/components/EventAttendancePanel.tsx"
  - "src/routes/GuestEvent.tsx"
  - "src/App.tsx"
  - "tests/guest-registration.test.ts"
  - "tests/e2e/evt-07-guest-registration.spec.ts"
```

**Glossary:** *Guest*, written at this stage (ADR-047). *Attendee* and *Capacity* already have rows
and are not rewritten; the *Guest* row states that guests count against capacity.

**Standards written by this ticket:** `.ai/standards/rbac-and-security.md` — § 3's guest rows added
to the permission table, and the *Signed out* paragraph corrected from "exactly two functions" to the
six of AC-21. That paragraph would be false the moment this ships, which is why it is here and not
deferred. **`.ai/standards/data-model.md`'s `event_guest` entity goes to `/thuki`**, as `EVT-06`'s
entity did: a thirteenth path makes this L.

**Deliberately absent:** `src/routes/EventDetail.tsx` (the panel loads its own guests);
`tests/guest-link.test.ts` and `tests/e2e/evt-06-guest-link.spec.ts` (`GuestEvent`'s keys and the
`EVT-06` migration's grants are unchanged, and with no guests every `EVT-06` read answers as before
— if either test needs an edit, the contract broke a caller and the Developer stops);
`tests/event-attendance.test.ts` (same reason); the manage page has no file of its own — it is a
named export of `GuestEvent.tsx`, which shares its meta hook and card.

**`size: M`** — twelve paths. Agrees with `size_estimate: M`. A thirteenth makes this `L`, which must
split; the Developer stops rather than add one.

## 8. Rejected alternatives

**1. Guests as rows of `event_attendance`**, with `member_id` made nullable and a name and email
added. One table, so the cap would need no change and the attendee read would carry guests for free.
Rejected: `event_attendance` is keyed `(event_id, member_id)` with `member_id default auth.uid()`
and a column grant built on it, and `EVT-04`'s four attendance triggers assume a member in every row
— `notify_attendance_changed` would notify a null recipient, `notify_attendance_deleted` compares
`old.member_id` to `auth.uid()`, and `is_event_participant` would answer for nobody. Every one would
need a guest branch, under `EVT-02`'s and `EVT-04`'s tests. A second table costs one count in three
guards and touches no member path.

**2. Cancel deletes the row, and deleting the event cascades**, as `EVT-02` does for members.
Simplest, and a cancelled guest could register again. Rejected: ADR-052 decision 8 keeps guest data
indefinitely and § *Consequences* says it has "no deletion path"; both would be deletion paths.

**3. Store the manage token in plain**, like `EVT-06`'s guest link. One fewer function call and the
creator could re-send it. Rejected: the guest link is meant to be read by those who manage the event;
a manage token is one guest's secret, and a plain column readable by anyone with table access — a
future grant, a backup, an admin in the SQL editor — would make "shown once" a matter of interface
manners. The hash makes it a property of the schema.

**4. Put `requiresApproval` and `registrationOpen` on `GuestEvent`.** One read instead of two.
Rejected: `EVT-06` AC-12 defines `GuestEvent` as exactly its eight fields, and its test asserts the
key set; widening it would edit a shipped ticket's acceptance criterion through a side door. A
separate function makes the widening its own signature, which a reviewer sees.

**5. An `anon` insert policy on `event_guest` checking the token through a request header.** No
definer function for the write. Rejected: PostgREST does not pass an arbitrary header into a policy
without a pre-request hook, which is server configuration ADR-005 keeps out, and without it the
policy can test only "is open" — `EVT-06` § 6's enumerable shape.

## Changelog

- 2026-10-09T11:11:00+0700 — created. `schema_delta` in `ticket.yaml` amended to say the manage token
  is stored as a hash (§ 6). Sections 1 and 2 were written before the source was read; on reading
  `tests/guest-link.test.ts`, AC-22 was added and the guest page's two facts moved off `GuestEvent`
  into their own read, so that `EVT-06` AC-12 stays true — no other AC was amended. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
