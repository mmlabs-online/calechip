---
ticket: EVT-12
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-14T22:41:22+0700
inputs_read:
  - .ai/board/tickets/EVT-12/ticket.yaml
  - .ai/board/ideas/2026-10-14-a-team-or-named-event-cannot-invite-anyone-by-email.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-061-invitations-reach-every-event-scope-and-a-signed-in-reader-leaves-the-guest-page.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/standards/rbac-and-security.md
  - .ai/board/tickets/EVT-08/01-plan.md
  - .ai/board/tickets/EVT-09/01-plan.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
  - supabase/migrations/20261012230000_evt10_description_html.sql
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/routes/EventDetail.tsx
  - src/routes/EventEditor.tsx
  - src/routes/Events.tsx
  - src/components/EventAttendancePanel.tsx
  - tests/event-invitation.test.ts
  - tests/event-create-invitation.test.ts
  - tests/e2e/evt-01-events.spec.ts
  - tests/e2e/evt-08-event-invitation.spec.ts
  - tests/e2e/evt-09-create-invitation.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-12 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-12 | The creator or an admin of an *Own team* or *Limited people* event invites people by email, a member outside its reach is added to its named list, and *Named people* is relabelled *Limited people* |

The row's Notes are the scope, each clause an operator answer in
`.ai/board/ideas/2026-10-14-a-team-or-named-event-cannot-invite-anyone-by-email.md` § *Evidence*,
decided by ADR-061 (`ACCEPTED by the operator`): *"`invite_to_event` and both surfaces (create form,
detail panel) accept *Own team* and *Named people*; an approved member who cannot read the event is
added to `event_invitee`, converting an *Own team* event to *Named people* with the team snapshotted
(Q1-A); the snapshot is not notified (Q6-A); the added member gets EVT-05's *"invited"* mail only
(Q3-A); any other address gets the guest version and opens the event to guests (Q5). Public events
unchanged. **The scope label *Named people* becomes *Limited people*** wherever it is shown
(operator, 2026-10-14, verbatim in the idea's § *Evidence*); the database value `named` is
unchanged."*

**Who gains what.** Since `EVT-08` and `EVT-09` a creator, or an admin, can invite addresses by
email — but only to an event visible to every team. A team gathering that should include one
colleague from another team, or one person outside CaleChip, has to become visible to everyone
first, or its guest link has to be forwarded by hand. This ticket puts the same field on the same two
surfaces for *Own team* and *Limited people* events. An outsider is mailed the guest link, exactly as
on a public event. A member who cannot yet see the event is put on its named list — the event becomes
theirs to see in the app, with their own account, and they are told once, by the in-app notification
and the *"invited"* mail they would get had they been named at creation. The price, which the
operator accepted (Q1-A, Q2-A), is that an *Own team* event receiving such a member stops following
its team, and that the inviter can now tell such an address is a member's, because the person appears
among the event's people. **On a public event nothing changes**, including the rule that nothing
tells the inviter who is a member.

The relabelling rides along because this ticket edits the same scope choices: what the database calls
`named` is shown as *Limited people* wherever a person reads it.

**Out of scope.**

- **Any change to public events' invitations** — `EVT-08` AC-1 to AC-15 hold for them as written,
  AC-7's membership blindness included (ADR-061 decision 5, revert condition 1). The public branch of
  `invite_to_event` keeps its text: no read of `public.member` or `auth.users`.
- **Keeping *Own team* scope with extra individuals** (Q1-B, decided against). An *Own team* event
  that takes in an outside member becomes *Limited people*.
- **Hiding auto-added people from the event's people** (Q2-B, decided against).
- **Notifying the team members snapshotted at a conversion**, in the app or by mail (Q6-A).
- **Two mails to an auto-added member** — the member version of `EVT-08` is not sent to them (Q3-A).
- **Converting back** — a converted event stays *Limited people*; changing its scope is the edit
  form's, as for any event, and this ticket does not change the edit form's behaviour.
- **The invite field on the edit form** — `EVT-09` AC-1 stands: the edit form draws none, for any
  scope.
- **The guest-link redirect for a signed-in reader** — `EVT-13`, independent of this ticket.
- **Mail on creation, of any scope** (ADR-051 decision 4, ADR-055 decision 6), beyond what `EVT-05`
  already sends for an *Own team* event and for each named person.
- **A per-person guest link** (ADR-052 decision 2); **emailing a guest their manage link**
  (ADR-052 decision 6).
- **Renaming *Every team*** — noted in the idea as a possible `/solo` change.
- **Renaming the database value `named`**, or any identifier, type or selector that spells it
  (`event-scope-named`, `EventScope`'s `"named"`). Only text a person reads changes.
- **Removing the `invitation_not_public` failure code** from `src/lib/domain/types.ts` and its
  `EV009` mapping in `src/lib/data/supabase.ts`. Both become unreachable; removing them is two more
  paths and a shared-type edit (§ 7). Left for a cleanup.
- **The registry's other stale text** — the glossary's *Event* and *Email invitation* rows still say
  *named people* and *public*, and ADR-055's Status carries no amendment note. Rewriting a definition
  or an ADR is not a PLAN output (§ 7); `/thuki` owns both.
- **Any change to who may create, edit, open or read an event**, and any new power for `manager`.

**`size_estimate: M`** — one migration replacing one function and three trigger functions, two
screens whose existing conditions widen, one label, the mock reproducing the new branch, their tests,
one glossary row and one standards table.

## 2. Acceptance criteria

Vocabulary as `EVT-01`'s, `EVT-04`'s, `EVT-05`'s, `EVT-06`'s, `EVT-08`'s and `EVT-09`'s (*can read
an event*, *may manage an event*, *straight to the datastore*, *open to guests*, *email invitation*,
*invited* / *already invited*, *a member's address*, *an outsider's address*, *event email on*, *the
create form*, *the invite field*). Additionally:

- ***Own team* event**, ***Limited people* event**, **public event** — an event whose scope is
  respectively own team, named people (*Limited people* on screen, `named` in the database), or every
  team.
- **The event's people** — on a *Limited people* event, the members named on it (`event_invitee`),
  listed to its creator and admins in `event-invitees`.
- **A member outside its reach** — for a given event, the holder of a member's address (approved, not
  removed — `EVT-08` § 2) who **cannot read the event** at the moment the address is invited.
- **A conversion** — an *Own team* event becoming a *Limited people* event because a member outside
  its reach was invited to it.
- **The snapshot** — the members a conversion names on the event so that everyone on its team who
  could read it before still can.

### Inviting on every scope

**AC-1 — the panel on an *Own team* or *Limited people* event**
- Given the detail page of an *Own team* or *Limited people* event, read by its creator or by an admin
- Then the card shows `event-invite-panel` with `event-invite-hint`, `event-invite-input`,
  `event-invite-submit` and `event-invited-list`, exactly as `EVT-08` AC-1 shows them on a public
  event
- And pressing `event-invite-submit` with one or more addresses lists each distinct address once under
  *Invited* or *Already invited*, empties the field, and adds each address invited now to
  `event-invited-list`
- And `event-invite-not-public` is drawn on no event

**AC-2 — the field on the create form for every scope**
- Given the create form
- When *Own team*, *Limited people* or *Every team* is chosen
- Then `event-form-invite` is drawn, holding `event-form-invite-input`
- And creating the event with addresses in it creates the event first and then invites every address
  exactly as AC-1 and AC-4 to AC-8 describe for that scope, with the creator as the inviter — `EVT-09`
  AC-3 to AC-7 hold for all three scopes
- And a field holding addresses is never ignored because of the scope chosen — `EVT-09` AC-2's
  "a scope other than public … whatever the field held" no longer exists
- And the edit form still draws no `event-form-invite`, for any scope

**AC-3 — who may invite is unchanged**
- Given an *Own team* or *Limited people* event
- Then a member or manager who did not create it sees no `event-invite-panel`, and an invitation sent
  straight to the datastore by them, by a removed or not-approved member, or signed out, is refused
  with `event_not_permitted`, saves nothing, opens nothing, adds nobody to the event's people,
  converts nothing and hands nothing to the sender — `EVT-08` AC-3, now for every scope
- And no invitation, on any scope, is refused as not public

### What each address gets, on an *Own team* or *Limited people* event

**AC-4 — an outsider gets the guest link, and the event opens to guests**
- Given an *Own team* or *Limited people* event and an outsider's address not yet invited to it
- When its creator or an admin invites it
- Then it comes back *Invited*, and the sender is handed exactly `EVT-08` AC-8's guest mail, carrying
  the event's current guest token
- And the event is open to guests afterwards — opened if it was not, reopened if it was closed, kept
  with its link if it was open — and `event-guest-panel` shows that link without a reload
- And the event's people, its scope and its readers in the app are unchanged by that address

**AC-5 — a member who can already read it gets the member version**
- Given an *Own team* or *Limited people* event and a member's address whose holder can already read
  the event — on its team for an *Own team* event, among its people for a *Limited people* event,
  taking part in it, or an admin
- When its creator or an admin invites it
- Then it comes back *Invited*, and `EVT-08` AC-9's member mail is handed to the sender under
  `EVT-08` AC-9's conditions (event email on, not the inviter) — no other mail and no in-app row
- And the event's people and its scope are unchanged by that address
- And a submission holding only such addresses does not open the event to guests

**AC-6 — a member outside its reach on a *Limited people* event is added to its people**
- Given a *Limited people* event and the address of a member outside its reach
- When its creator or an admin invites it
- Then it comes back *Invited*, and that member is among the event's people afterwards — listed in
  `event-invitees` without a reload — and can read the event in the app
- And that member receives `EVT-04`'s *invited* notification once, and `EVT-05`'s *invited* mail once
  if their event email is on — the same two they would receive had they been named when the event was
  created (Q3-A)
- And `EVT-08`'s member version is **not** sent to them, and nothing else is: one mail at most, one
  in-app row
- And the invitation for that address is in `event-invited-list` like any other
- And the people already on the event, and its attendees, receive nothing
- And that address alone does not open the event to guests

**AC-7 — a member outside its reach on an *Own team* event converts it**
- Given an *Own team* event and the address of a member outside its reach
- When its creator or an admin invites it
- Then the event is a *Limited people* event afterwards, and its people are every approved, not
  removed member of its team at that moment other than its creator — the snapshot — plus the newly
  added member (Q1-A)
- And every member who could read it before still can; the newly added member now can; a member who
  joins that team afterwards cannot
- And the newly added member is notified exactly as AC-6
- And **no member of the snapshot, and no attendee, receives anything** — no in-app row and no mail,
  of any kind, including the notification that an event they take part in was edited (Q6-A, ADR-061
  revert condition 2)
- And the event's attendees, guests, guest link, capacity, approval mode, deadline, name, dates,
  location and description are unchanged
- And the detail page shows `event-scope` as *Limited people* and `event-invitees` with the snapshot
  and the new member, without a reload

**AC-8 — several addresses in one submission**
- Given an *Own team* event and a submission holding an outsider's address, the address of a member
  on its team, and the addresses of two members of other teams
- When its creator or an admin invites them
- Then the event is converted once, each of the two members of other teams is added and notified
  exactly as AC-6, the team member gets the member version as AC-5, and the outsider gets the guest
  mail as AC-4
- And every address appears once under *Invited*
- And each address is handled as if the submission's distinct addresses were invited one after
  another, in the order first entered, each seeing the scope and the people the earlier ones left
- And two submissions racing on the same event are handled one after the other, never interleaved

**AC-9 — what an address already invited gets**
- Given an address already invited for an *Own team* or *Limited people* event, by anyone, under any
  scope the event has had
- When it is entered again — any letter case, surrounding spaces, a later submission or twice in one
- Then it is *Already invited* as `EVT-08` AC-6, nothing is handed to the sender, nobody is added to
  the event's people, the event is not converted, and no notification is written
- And if it is an outsider's address, the event is opened to guests as AC-4 says, so that the link
  the earlier mail carried would work if the event is open with the same link — `EVT-08` AC-5's
  reasoning, for this scope

**AC-10 — what the inviter is told**
- Given a submission on an *Own team* or *Limited people* event
- Then each address comes back *Invited* or *Already invited* and nothing else — the response and the
  result on screen carry no field saying which addresses are members' or which were added
- And the inviter may nonetheless learn that an address is a member's from the event's people and its
  scope, which the page shows (Q2-A, ADR-061 decision 5)

**AC-11 — the conversion is announced before it happens**
- Given an *Own team* event's `event-invite-panel`, or the create form with *Own team* chosen and an
  address in the invite field
- Then `event-invite-hint` (panel) or `event-form-invite-hint` (form) says that inviting a member of
  another team turns the event into *Limited people* — its team as it is now, plus them — and that
  people who join the team later will not see it
- And on a *Limited people* event, or with *Limited people* chosen, the hint says a member who cannot
  see the event is added to its people
- And on every scope the hint says that anyone else gets the guest link, which opens the event to
  guests

### Public events

**AC-12 — public events are unchanged**
- Given a public event
- Then every one of `EVT-08` AC-1 to AC-3 and AC-5 to AC-15 holds for it unchanged — in particular
  AC-5 (any submission opens it to guests) and AC-7 (nothing anywhere tells the inviter, or anyone
  else, which invited addresses are members')
- And inviting to a public event never adds anybody to any event's people, and never changes its
  scope

**AC-13 — an address's outcome follows the scope at the moment it is invited**
- Given an event whose scope is changed with the edit form after some addresses were invited
- When further addresses are invited
- Then each is handled under the scope the event has at that moment — AC-4 to AC-9 for *Own team* and
  *Limited people*, AC-12 for public — and the addresses invited earlier are not revisited
- And `EVT-08` AC-4's refusal of invitations to an event moved off public no longer exists

### The label

**AC-14 — *Named people* reads *Limited people***
- Given any screen that shows an event's scope to a person — the create and edit forms' scope choice
  (`event-scope-named`'s label), the events list's scope badge, the detail page's `event-scope`
- Then the scope stored as `named` is shown as *Limited people*, with a capital L
- And the words *Named people* appear on no screen, in no button, label, badge, hint or error message
- And the scope's value in the database, the seam and the selectors is unchanged

### What it does not touch

**AC-15 — the rest of the product is as it was**
- Given any number of invitations to an *Own team* or *Limited people* event
- Then `listMembers`, `listMemberDirectory`, every entry, the absence count, and every member's team
  are exactly what they would have been without them
- And every `public.notification` row and every `EVT-05` mail is what it would have been without them,
  except those AC-6 and AC-7 give the newly added member
- And `EVT-05`'s mail for creating an event, and `EVT-04`'s notification for it, are unchanged — an
  *Own team* event created through the create form with addresses notifies its team on creation
  exactly as one created without, and the conversion that may follow notifies nobody but the added
  member
- And an edit made with the edit form, including a change of scope, notifies exactly as `EVT-04`
  says — the silence of AC-7 belongs to the conversion alone

**Invariants touched: `[]`.** An invitation, a named person and a conversion are not entries and
change no member's team; nothing here reads or writes `public.entry` or computes a count. The new
reads of `public.member` and `auth.users` — recognising a member's address on an *Own team* or
*Limited people* event, and the snapshot — happen inside definer functions that return nothing about
them to any caller; no policy or grant on `public.member` changes, so `listMembers()`, INV-04's
denominator, is untouched. AC-15 asserts it. INV-01–03 and INV-05–07 constrain entries, which nothing
here reads or writes.

**Open questions.** None that block. This plan's own readings, each marked and cheap to reverse:

1. **When a team or limited event opens to guests.** ADR-061 decision 6 ties opening to *"an address
   that is not an approved member's"*; `EVT-08` AC-5 opens a public event on every submission. Read
   here as: an *Own team* or *Limited people* event opens when the submission holds at least one
   outsider's address, invited now or already (AC-4, AC-5, AC-9). A submission of members only
   leaves it as it was, so inviting a colleague never exposes the event by link.
2. **Who the snapshot is.** ADR-061 decision 2: *"the creator's team as it stands at that moment"*.
   Read as every approved, not removed member whose team is the event's team (`may_read_event`'s own
   `team` clause), **without the creator**, who reads it as its creator — matching how the create
   form's picker leaves the creator off a *Named people* event (`EventEditor.tsx:22`). Attendees from
   outside the team keep reading as participants and are not named.
3. **An admin's address counts as one who can already read** (AC-5) — `may_read_event` says so, and
   ADR-061 decision 2 adds only members who *cannot*.
4. **A conversion moves `updatedAt`** — `event_stamp` runs on every update and is not suppressed; the
   attendance panel keyed on it reloads (AC-7), and nothing is notified.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/EVT-12/design/` (the folder does not exist) or cited by the idea
file (*"No screenshot was supplied. The field and panel already exist; this widens when they are
drawn."*). Nothing below is a behaviour beyond § 2.

**The event detail page.** `EVT-08`'s panel, in the same place (last in the card, under
`event-guest-panel`), now drawn for the creator and admins on every scope. The
`event-invite-not-public` branch is removed. The helper line under *Invite by email* becomes
`event-invite-hint`, one `text-ink-2` paragraph whose words follow the scope:

- **Every team** — unchanged: *Each address gets one invitation with the guest link. Sending opens
  this event to guests.*
- **Own team** — *Members of other teams are added to this event, which then becomes Limited people:
  this team as it is now, plus them. People who join the team later won't see it. Anyone else gets
  the guest link, which opens this event to guests.*
- **Limited people** — *Members who can't see this event yet are added to its people. Anyone else
  gets the guest link, which opens this event to guests.*

After a send, the page re-reads the event and its people as well as the guest link and the invited
list, so the scope badge, `event-invitees` and the attendance panel follow a conversion in place.

**The create form.** `event-form-invite` sits where `EVT-09` put it, directly under the *Who is it
for?* fieldset — **below `event-picker` when *Limited people* is chosen**, so the two questions read
in order: pick people you know, then type addresses. The hint under the label gains
`data-testid="event-form-invite-hint"`; while the field is empty it reads *People outside CaleChip
get the guest link by email.* for every scope; with an address in it, *Every team* keeps `EVT-09`'s
sentence (*… Creating opens this event to guests.*), and *Own team* and *Limited people* read the
panel's two sentences above verbatim.

**The label.** *Limited people* replaces *Named people* in the scope choice and the badge; the badge
keeps its lavender, and the choice keeps its hint *Only the people you pick, from any team*.

English copy throughout (ADR-055 F2-A).

## 3. Permission model

Server-side always: the controls are `invite_to_event`, the three trigger functions and the
unchanged policies in § 4.2. Every check in the seam or the interface is an affordance.

| Action | signed out (`anon`) | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|---|
| Invite addresses to an event of any scope | ❌ | own event only | own event only — **as a manager, nothing more** | ✅ any | `invite_to_event`: `may_manage_event` → 42501. **No scope check** (ADR-061 decision 1) |
| Add a member to an event's people by inviting their address | ❌ | own *Own team* or *Limited people* event only, and only a member who cannot read it | same as member | ✅ any such event | `invite_to_event`, team/named branch, after `may_manage_event`; inserts into `event_invitee` as definer |
| Convert an *Own team* event to *Limited people* by inviting | ❌ | own event only | own event only | ✅ any | `invite_to_event`, the same branch; updates `event.scope` as definer |
| Add a member, or convert, on a public event | ❌ | ❌ | ❌ | ❌ | `invite_to_event`'s public branch reads no member and writes no `event_invitee` |
| Choose who is snapshotted, or suppress a notification | ❌ | ❌ | ❌ | ❌ | `invite_to_event` takes neither; the snapshot is computed inside it, and the suppression marker is set and cleared inside it (§ 4.2) |
| Learn whether an address is a member's, on a public event | ❌ | ❌ | ❌ | ❌ | unchanged — ADR-055 revert condition 1 |
| Learn whether an address is a member's, on an *Own team* or *Limited people* event | ❌ | creator, from the event's people | creator, same | ✅ | not from the response (AC-10); from `event_invitee_select_manage`, unchanged — ADR-061 decision 5 |
| Everything else in `EVT-08` § 3 | unchanged | unchanged | unchanged | unchanged | |

**Denials the tests must assert**, in the mock: a non-creator member's, a manager's and a signed-out
caller's `inviteToEvent` on an *Own team* event is `event_not_permitted`, and the event's scope, its
people and every notification are unchanged (AC-3); inviting a member of another team to a **public**
event leaves `event_invitee` empty and the scope public (AC-12); the snapshot gets no notification
and no mail (AC-7); an auto-added member gets exactly one `event_invited` notification, one
`event_invited` event email when on, and **no** `invitation_member` mail (AC-6).

**The suppression marker.** The conversion's silence is held by a transaction-local setting,
`calechip.event_conversion`, which `invite_to_event` sets to the event's id immediately before the
conversion's `update` and snapshot `insert`, and clears immediately after — before the added
member's own `event_invitee` row, which must notify. `notify_event_updated` and
`notify_event_invited` return without notifying when it equals the row's event id. **A caller cannot
set it**: PostgREST exposes only the `public` schema's functions and its own `request.*` settings,
and no function in `public` takes a setting name. If one ever could, the worst it buys is a missing
notification on an event the caller already updates — never a read.

**The mock reproduces these and cannot prove them** — the `EVT-01` precedent. The migration is
applied by a human (RULE-09); the permission-model test against a real PostgreSQL stays owed
project-wide.

## 4. Contract

**No seam signature, domain type or failure code changes.** `inviteToEvent(eventId, emails)` and
`listEventEmailInvitations(eventId)` keep `EVT-08` § 4.2's names, arity and return types;
`EmailInvitationOutcome` keeps `"sent" | "ignored"` and nothing else (AC-10). `FailureCode`'s
`invitation_not_public` stays in the union and is no longer produced (§ 1 Out of scope).

### 4.1 The migration — `supabase/migrations/20261014090000_evt12_invite_every_scope.sql`

One transaction, idempotent in ADR-024's shape, every function `create or replace` with its existing
signature, so no grant or trigger is dropped. Header in `EVT-08`'s shape, including the line that it
is not verified against a running PostgreSQL and that no human step beyond applying it is needed.
Grants restated exactly as their original migrations wrote them.

**`public.invite_to_event(p_event_id uuid, p_emails text[]) returns table (email text, outcome
text)`** — definer, volatile, `set search_path = ''`, `#variable_conflict use_column`, as now.

1. `may_manage_event(p_event_id, auth.uid())` false — including a null uid — → raise 42501. Unchanged.
2. `select e.scope, e.team_id, e.creator_id from public.event e where e.id = p_event_id for update`
   — **`for update`, not `for share`**: two submissions on one event serialise (AC-8), and a scope
   change or delete waits. The `invitation_not_public` raise is **removed**.
3. Trim, drop empties, validate, dedupe by `lower()` keeping the first spelling → `EV008` on failure.
   Unchanged.
4. **Public** (`v_scope = 'public'`): `EVT-08`'s steps 4–6 **verbatim** — open the link, insert each
   address `on conflict do nothing`, `sent`/`ignored`. **No read of `public.member` or `auth.users`
   in this branch.**
5. **Team or named**:
   1. For each clean address, resolve `v_member uuid`: `select m.id from public.member m join
      auth.users u on u.id = m.id where lower(u.email) = lower(<address>) and m.status = 'approved'
      and m.removed_at is null limit 1` — `email_invitation()`'s lookup, the same text. Keep the ids
      in an array parallel to the addresses.
   2. If any resolved id is null: `insert into public.event_guest_link (event_id) values
      (p_event_id) on conflict (event_id) do nothing` (AC-4, AC-9, § 2 open question 1).
   3. For each address, in order:
      - `insert into public.event_email_invitation (event_id, email, invited_by) values (…)
        on conflict do nothing returning id`. None → `ignored`; `return next`; continue (AC-9).
      - `sent`. If the id is null, or `public.may_read_event(p_event_id, v_member)` is true:
        `return next`; continue (AC-4, AC-5 — the trigger has mailed).
      - Otherwise (AC-6, AC-7) — **after** the invitation row, so its trigger has already seen a
        member who cannot read and sent nothing:
        - If `v_scope = 'team'`: `perform set_config('calechip.event_conversion', p_event_id::text,
          true)`; `update public.event set scope = 'named' where id = p_event_id`; `insert into
          public.event_invitee (event_id, member_id) select p_event_id, m.id from public.member m
          where public.member_team_id(m.id) = v_team_id and m.id <> v_creator on conflict do
          nothing`; `perform set_config('calechip.event_conversion', '', true)`; `v_scope :=
          'named'`.
        - `insert into public.event_invitee (event_id, member_id) values (p_event_id, v_member) on
          conflict do nothing` — `notify_event_invited` fires for this row, `notify` writes the
          `event_invited` row, and `EVT-05`'s `email_notification` mails it when on (Q3-A).
        - `return next`.
6. Nothing else is returned. The function never returns whether an address was a member's.

**`public.email_invitation()`** — `EVT-08`'s body, with one added line after the member lookup:
member found **and `not public.may_read_event(new.event_id, v_member_id)`** → `return new` (nothing
sent; `invite_to_event` is about to add them, and `EVT-05` mails them — AC-6). On a public event every
approved member can read it, so the public path is unchanged (AC-12).

**`public.notify_event_updated()`** — `EVT-04`'s body, preceded by: `if
coalesce(current_setting('calechip.event_conversion', true), '') = new.id::text then return null;
end if;`. The trigger and its `when` clause are unchanged.

**`public.notify_event_invited()`** — `EVT-04`'s body, preceded by the same test on
`new.event_id::text`.

**Nothing else is replaced.** No table, column, index, constraint, policy or grant changes;
`event_select_visible`, `event_invitee_*` policies, `may_read_event`, `notify`, `email_notification`
and `save_event` are read, not changed.

### 4.2 The mock — `src/lib/data/mock.ts`

Reproduces § 4.1 in one synchronous block, as `EVT-08`'s does. The section banner's sentence *"The
function half NEVER READS `members`"* becomes *"on a public event"*.

- `inviteToEvent`: the `invitation_not_public` line and `INVITATION_NOT_PUBLIC` are removed. Public
  scope → the existing body. Team or named → resolve each address with the same lookup
  `emailInvitation` uses (approved, not removed, `Member.email` ignoring case); open the guest link
  when any is unresolved; then per address in order: insert or `ignored`; **call `emailInvitation`
  for that row immediately** (not after the loop — the trigger fires per statement, before the add);
  then, for a member who cannot read (`mayReadEvent`), convert when `team` — set `scope` to `named`,
  stamp `updatedAt`, push the snapshot rows into `eventInvitees` **without** `notify` — and push the
  member's row and `notify([memberId], "event_invited", event)`.
- `emailInvitation`: member found and `!mayReadEvent(event, member.id)` → return.
- No new export. `__sentInvitationEmails`, `__resetEvents` and the event-email outbox are read by the
  tests as they are.

### 4.3 Screens

**`src/routes/EventDetail.tsx`.**
- The panel is rendered when `canEdit`, whatever the scope. `EventInvitePanel` loses its `isPublic`
  branch and `event-invite-not-public`; its helper line gains `data-testid="event-invite-hint"` and
  § 2b's three sentences, chosen by `event.scope`.
- `onInvited` re-reads `getEvent`, `listEventInvitees`, `getEventGuestLink` and
  `listEventEmailInvitations` together and puts all four into state (AC-6, AC-7). An event that comes
  back `null` leaves state as it is (the next load decides).
- One exported pure helper, for the panel and the form:

```ts
/** EVT-12 § 2b, AC-11. The invite hint for a scope; `verb` is "Sending" on the panel and "Creating"
 *  on the create form, used only in the public sentence. */
export function inviteHint(scope: EventScope, verb: "Sending" | "Creating"): string;
```

**`src/routes/EventEditor.tsx`.**
- `createEventWithInvitations`: `emails` is `parseInvitationInput(inviteText)` for every scope — the
  `input.scope === "public"` gate is removed, and its doc comment's first bullet becomes "no address
  after parsing".
- The field is drawn when `!editing`, whatever the scope, after `event-picker` when it is drawn.
- The hint gains `event-form-invite-hint`: with an address, `inviteHint(values.scope, "Creating")`;
  empty, the existing sentence.
- `SCOPE_CHOICES`' `named` label: *Limited people*. The comments naming *Named people* follow.

**`src/routes/Events.tsx`.** `SCOPE_LABELS.named`: *Limited people*; the comment at `:28` follows.

### 4.4 Selectors

| Selector | Where | AC |
|---|---|---|
| `event-invite-hint` | the detail panel, every scope | AC-1, AC-11 |
| `event-form-invite-hint` | the create form's invite field | AC-11 |
| `event-invite-not-public` | **removed** | AC-1 |
| `event-invitees`, `event-scope` | unchanged, asserted after a send | AC-6, AC-7, AC-14 |

Every other `event-invite-*`, `event-invited-*`, `event-form-invite-*` and `event-guest-*` selector is
unchanged.

## 5. Seam impact

**None to the interface.** No function is added to `DataSeam` and no signature changes, so the
seam-parity test is untouched. `src/lib/data/supabase.ts` is not edited: it calls
`invite_to_event` as it does today, and its `EV009` mapping becomes unreachable (§ 1). One mock
function changes behaviour without a signature change — `inviteToEvent`, as § 4.2 — and one private
mock helper, `emailInvitation`. `listMembers()` and every policy on `public.member` are untouched.

## 6. Schema delta

**Not `none`.** One definer function and three trigger functions replaced in place
(`invite_to_event`, `email_invitation`, `notify_event_updated`, `notify_event_invited`). No table,
column, index, constraint, policy or grant changes — triage's expectation, confirmed. A migration
that changes a trigger's behaviour is not `none` (ADR-014). Decided by
[ADR-061](../../../registry/decisions/ADR-061-invitations-reach-every-event-scope-and-a-signed-in-reader-leaves-the-guest-page.md),
`ACCEPTED by the operator` — `requires_adr: true` is met.

**Agrees with `ticket.yaml`'s triage description**, made exact in three places, and `schema_delta`
is amended to say them: `notify_event_updated` is a fourth function (a conversion is an `update` of
`scope`, which `EVT-04` notifies attendees of — AC-7 forbids it); the lock becomes `for update`; and
the suppression is a transaction-local setting, not a column.

**Why the invitation row is inserted before the member is added.** `email_invitation()` then sees a
member who cannot read and sends nothing, with a one-line rule that is a no-op on a public event.
Adding first would make the trigger see a reader and send `EVT-08`'s member version — the second
mail revert condition 2 names.

**Applying it is human** (RULE-09). `supabase/db.sql` is not updated (MD-033). No Edge Function
change and no redeploy.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261014090000_evt12_invite_every_scope.sql"
  - "src/lib/data/mock.ts"
  - "src/routes/EventDetail.tsx"
  - "src/routes/EventEditor.tsx"
  - "src/routes/Events.tsx"
  - "tests/event-invitation.test.ts"
  - "tests/event-create-invitation.test.ts"
  - "tests/e2e/evt-01-events.spec.ts"
  - "tests/e2e/evt-08-event-invitation.spec.ts"
  - "tests/e2e/evt-09-create-invitation.spec.ts"
```

**Glossary:** *Limited people*, written at this stage (ADR-047). *Event*, *Invitation* and *Email
invitation* already have rows and are **not rewritten**, although after this ticket *Event* still
says *named people* and *Email invitation* still says *public* — a definition rewrite is a registry
change for `/thuki`, with ADR-061 as its source.

**Standards written by this ticket:** `.ai/standards/rbac-and-security.md` — the `EVT-08` rows
"Invite addresses by email to a public event", "Invite by email to a team-scope or named-people
event" and "Learn whether an invited address is a member's" amended to § 3, and a row added for
adding a member and converting by inviting.

**Why each test path.** `event-invitation.test.ts` asserts `invitation_not_public` today (AC-1, AC-3
change it) and takes the new mock cases; `event-create-invitation.test.ts` asserts that a non-public
scope makes no invitation call (AC-2 reverses it); `evt-01-events.spec.ts:208` asserts the old label
(AC-14); `evt-08-event-invitation.spec.ts:173` asserts `event-invite-not-public` and takes this
ticket's e2e cases in an `EVT-12` `describe`; `evt-09-create-invitation.spec.ts` AC-1 and AC-2 assert
the field hidden for team and named.

**Deliberately absent:** `src/lib/domain/types.ts` and `src/lib/data/supabase.ts` (§ 1, § 5 — a
thirteenth path, and a shared type module); a new `tests/e2e/evt-12-*.spec.ts` (the cases sit in the
`EVT-08` spec beside the panel they drive); `supabase/functions/send-event-email/**` (no request
shape or template changes); `.ai/registry/decisions/ADR-055-*.md`'s Status note (ADR-061 § *Affected
documents*; `/thuki`); `src/routes/GuestEvent.tsx` (`EVT-13`).

**`size: M`** — twelve paths. Agrees with `size_estimate: M`. A thirteenth makes this `L`, which must
split; the Developer stops rather than add one.

## 8. Rejected alternatives

**1. Keep *Own team* and allow extra individuals (Q1-B).** No snapshot, no conversion, no frozen
team. Rejected by the operator at Q1, and on its merits: it edits `event_select_visible` and
`may_read_event` — the read rule every event surface, `notify` and the guest-page redirect depend
on — where Q1-A reuses the named scope's rule unchanged.

**2. A column to mark silent rows** — `event_invitee.silent boolean`, read by `notify_event_invited`.
Explicit, visible in the data, and testable by reading a row. Rejected: a column on a table
`event_invitee_insert_manage` lets creators insert into, so it needs its own column grant to stay out
of their hands; it says nothing to `notify_event_updated`, which needs silence for the `scope`
update too; and it records forever a fact that matters for one statement. The transaction-local
setting covers both triggers and leaves nothing behind.

**3. Disable the two triggers around the conversion**, as `EVT-10`'s data migration did. Rejected:
`alter table … disable trigger` is DDL, takes an exclusive lock on `public.event` for every reader,
needs the table owner, and would silence a concurrent edit's notifications on other events too.

**4. Decide member versus outsider in `email_invitation()` alone and add the member there.** One
place reads `auth.users`. Rejected: the trigger is `exception when others → warning`, so a failed add
would vanish into the log while the inviter is told *Invited*; and a trigger that writes
`event_invitee` and updates `event` is a hidden second writer of both. The function owns the write;
the trigger keeps its one job of handing a mail to the sender.

**5. Open the guest link on every submission, as on a public event.** One rule for all scopes.
Rejected: inviting a colleague from another team would expose a team event to anyone holding a link
nobody asked for, which ADR-061 decision 6 ties to an outside address (§ 2 open question 1).

## Changelog

- 2026-10-14T22:41:22+0700 — created. Sections 1 and 2 were written from the feature row, the idea
  and ADR-061 before the source was read. On reading the source: AC-6 and AC-7 gained the selectors
  they are observed through (`event-invitees`, `event-scope`), and AC-7 the attendees among those who
  receive nothing — `EVT-04`'s `notify_event_updated` fires on a `scope` change, which the first draft
  did not know; AC-7's snapshot was made exact from `may_read_event`'s `team` clause (open question
  2); AC-5 gained participants and its last line, AC-6 its last line, and AC-9 its outsider line, from
  open question 1; AC-1 and AC-11 (new) gained the hint, and AC-15 its last line on the edit form's
  notifications; AC-12 now excludes `EVT-08` AC-4, which AC-13 replaces. No AC was loosened.
  `schema_delta` in `ticket.yaml` amended (§ 6). Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
