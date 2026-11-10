---
doc_version: 3
last_updated: 2026-10-14
governed_by: [RULE-01, RULE-09]
---

# ADR-061 — Email invitations reach every event scope, and a signed-in reader is taken from the guest page into the event

## Status

`ACCEPTED by the operator` — 2026-10-14, in words, at `/idea` of
`.ai/board/ideas/2026-10-14-a-team-or-named-event-cannot-invite-anyone-by-email.md`, § *Evidence*.
The operator's answers, verbatim: the request *"vẫn cho phép Invite by email (optional) đối với event
own team và named peple"*, option 1 *"chọn 1"*, then **Q1 "A"**, **Q2 "A"**, **Q3 "A"**, **Q4 "A"**,
**Q5 "đồng ý"**, **Q6 "A"**. Recorded by `product` at `/triage`. It does not decide anything the
operator did not answer.

**Amends** ADR-055 decisions 1, 3 and 7 for *Own team* and *Named people* events, and ADR-052
decision 3 together with EVT-06 AC-16 for a signed-in reader. ADR-055 decisions 2, 4 to 6 and 8 to 10,
and ADR-052 decisions 1, 2 and 4 to 9, stand.

## Context

- ADR-055 decision 1 limits email invitations to public-scope events: *"Team-scope and named-people
  events accept none."* `invite_to_event` raises `invitation_not_public` for any other scope
  (`supabase/migrations/20261012100000_evt08_event_email_invitation.sql:104`), and both surfaces
  draw the field only for public (`src/routes/EventEditor.tsx:518`, `src/routes/EventDetail.tsx:338`).
- ADR-052 decision 1 already lets **any** event be opened to guests. Only the invitation path is
  narrower.
- ADR-055 decision 3: the inviter is never told which addresses belong to members. `invite_to_event`
  reads no `public.member` row for that reason (EVT-08 AC-7).
- EVT-06 AC-16 shows a signed-in member the same guest page as a stranger (`src/routes/GuestEvent.tsx:3-4`).
- The named list is `public.event_invitee`. EVT-04's `notify_event_invited` fires once per inserted
  row, and EVT-05 mails *"invited by name"* from it.

The operator asked for invitations on *Own team* and *Named people* events, and for a signed-in member
who opens a guest link to land on the event in the app.

## Decision

1. **The creator of an event of any scope, or an admin, may enter email addresses as invitees**, on
   create and from the detail page. This amends ADR-055 decision 1. Public events are unchanged.
2. **On an *Own team* or *Named people* event, an address that is an approved member's who cannot
   already read the event is added to the event's named list** (option 1). On an *Own team* event this
   **converts the event to *Named people***: the creator's team as it stands at that moment, plus the
   new person (Q1-A). Later joiners of that team do not see the event.
3. **On that conversion, the snapshotted team members are not notified**, in the app or by mail. Only
   the newly added person is (Q6-A).
4. **The person added under decision 2 receives one mail: EVT-05's *"invited"*.** The invitation row
   is recorded `sent`, and EVT-08's member version is not sent to them (Q3-A).
5. **For *Own team* and *Named people* events, the inviter may learn that an address is a member's**,
   because the person appears on the named list (Q2-A). This amends ADR-055 decision 3 for those two
   scopes only. On a public event, ADR-055 decision 3 stands as written.
6. **An address that is not an approved member's receives the guest version, linking to
   `/guest/<token>`, and entering it opens the event to guests**, on every scope (Q5 *"đồng ý"*).
   Anyone holding that link can read the event's name and attendee list, including from a forwarded
   mail, as ADR-052 decision 3 already allows for an opened event.
7. **A member who can already read the event** — same team on an *Own team* event, already named, or
   any member on a public event — still receives EVT-08's member version, as today. *Assumed, not
   asked*: it is the existing rule carried over.
8. **A signed-in user who opens `/guest/<token>` and can read that event in the app is redirected to
   `/events/<id>`. One who cannot read it sees the guest page as today** (Q4-A). This replaces EVT-06
   AC-16's "the same page for every reader" for the first case only. No reader gains anything they
   could not already read.
9. **ADR-055 decision 7 is amended in letter**: `invite_to_event` resolves addresses to members on
   *Own team* and *Named people* events. The function still decides inside the database. The mail
   function still reads nothing and holds no database credential.

## Rationale

- **Option 1 over the alternatives** (the guest version for an out-of-scope member, or ignoring the
  address): a member gets the event inside the app, with their account, and not as a second identity
  through the guest form. The cost is decision 5.
- **Q1-A over Q1-B** (keep *Own team* and allow extra individuals): Q1-A reuses the *Named people*
  scope and its policy unchanged, so the event read policy is not edited. The cost is that the team
  is frozen at the moment of conversion, and that decision 3 needs a suppression branch in a trigger.
- **Q3-A over Q3-B or Q3-C**: one mail, and it is the one a named person already receives.
- **Q4-A over Q4-B** (redirect every signed-in user): a signed-in member with no access can still
  register as a guest, as they can today, instead of meeting "not found".

## Consequences

- `invite_to_event` gains a member lookup, which EVT-08 AC-7 forbade. Its response must still not
  distinguish member from non-member on a public event.
- `notify_event_invited` (EVT-04) gains two exceptions: the conversion snapshot, and EVT-08's member
  mail for an auto-added person. Two silent paths in a notifier are harder to reason about than none.
- An *Own team* event that receives one outside member stops following its team. A creator who
  expected later joiners to see it will be surprised. The form shows the scope as *Named people*
  afterwards.
- An internal team event can now be read by anyone holding its guest link, once an outside address is
  entered. That was already true of any event opened by hand under ADR-052.
- The guest page reads the session for the first time. `GuestEvent.tsx` is no longer session-blind.

## Revert condition

Any one occurrence:

1. **On a public event, the inviter can tell whether an entered address belongs to a member.** That is
   ADR-055 revert condition 1, unchanged for public. On observation: disable invitations until fixed.
2. **A snapshotted team member is notified at a conversion**, or **an auto-added member receives two
   mails**. On observation: fix the trigger before the next release.
3. **A signed-in user is redirected to an event they cannot read**, or **a signed-out user is
   redirected at all**. On observation: restore EVT-06 AC-16's behaviour until fixed.
4. **The operator observes creators converting team events by accident and losing later joiners.** On
   observation: re-open Q1, with Q1-B as the alternative.

## Affected documents

- `.ai/registry/decisions/ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md` — a
  Status note: decisions 1, 3 and 7 amended by ADR-061 for *Own team* and *Named people*. Text
  unchanged.
- `.ai/registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md` — a Status
  note: a signed-in reader who can read the event is redirected (ADR-061 decision 8). Text unchanged.
- `.ai/standards/rbac-and-security.md` — the invitation row, if it names the public scope. PLAN checks.
- `.ai/registry/features.md` — the rows this ADR licenses.
