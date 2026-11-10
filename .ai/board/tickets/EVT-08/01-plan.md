---
ticket: EVT-08
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-12T20:53:26+0700
inputs_read:
  - .ai/board/tickets/EVT-08/ticket.yaml
  - .ai/board/ideas/2026-10-12-a-person-outside-the-product-learns-of-a-public-event-only-by-a-forwarded-link.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-07/01-plan.md
  - .ai/board/tickets/EVT-07/ticket.yaml
  - supabase/migrations/20260912120000_solo_member_email.sql
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - supabase/functions/send-event-email/index.ts
  - supabase/functions/send-event-email/template.ts
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/routes/EventDetail.tsx
  - tests/event-email.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-08 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-08 | The creator or an admin of a public event invites people by email from the event's page, and each address is mailed once |

The row's Notes are the scope, each clause an operator answer in
`.ai/board/ideas/2026-10-12-a-person-outside-the-product-learns-of-a-public-event-only-by-a-forwarded-link.md`
§ *Evidence*, decided by ADR-055 (`ACCEPTED by the operator`, F1): public-scope events only (Q2-A);
creator, any member, or admin (Q4-A, Q10-A), from the event detail page (Q3-B); entering an address
opens the event to guests, reopening it if closed (F1); one mail per address per event, a repeat
ignored (Q11-A); an outsider gets the guest link (Q1-A), an approved member's address gets a member
version only if their event email is on (Q6-B); the inviter sees sent and ignored, **never which
addresses are members'**; the invited list is read by creator and admin and kept forever (Q9-A); no
cap (Q5-B), no unsubscribe (Q7-A), nothing more sent after edit, delete, close or a scope change
(Q12-A); English on a designed template (F2-A).

**Who gains what.** Today the creator of a public event who wants particular people there copies
the guest link and sends it by hand, outside the product, and a member named that way gets no mail
at all — `EVT-05` sends nothing for public events. This ticket gives the creator, and any admin, a
field on the event's page: type addresses, press send, and each address receives one invitation —
the guest link for someone outside the product, a link into the app for a member who has event
email on. The inviter sees which addresses were invited now and which had been invited before, and
the list of everyone invited so far. The one property that must not bend is that **nothing the
inviter sees, or can read, differs between a member's address and an outsider's** (ADR-055
revert condition 1).

**Out of scope.**

- **The same field on the create-event form** — `EVT-09`, which depends on this ticket and adds a
  surface, not a behaviour.
- **Invitations for team-scope or named-people events** (Q2-A). A team or named event's page shows
  no invite field.
- **A cap per event or per submission** (Q5-B, triage assumption 3).
- **Unsubscribe, or a blocklist for outside addresses** (Q7-A).
- **Re-sending to an address already invited for the event** (Q11-A) — including after the guest
  link was closed and reopened, which gives the event a new link (`EVT-06`); an earlier invitee's
  link is then dead and nothing re-sends it. Recorded so it is not mistaken for a defect.
- **Mail on edit, deletion, closing to guests, or a change of scope** (Q12-A).
- **Emailing a guest their manage link** (Q8-A) — still `EVT-07` Q6-C's later ticket.
- **An in-app notification for a member who is invited by email.** ADR-055 decision 4 gives them a
  *member version* of the mail, linking into the app; it creates no `public.notification` row and
  no new `notification_kind`.
- **Deleting, exporting or editing the invited list**, by anyone (Q9-A, ADR-052 decision 8).
- **Reading the invited list of a deleted event.** The rows are kept (AC-14); no screen or seam
  function reads them.
- **Verifying that an address exists or is owned**; tracking opens or clicks; pre-registering an
  invitee as a guest (idea § *Out of scope*, assumption 1).
- **Any new power for `manager`.**
- **`.ai/standards/data-model.md`'s `event_email_invitation` entity** — left to `/thuki`, the
  `EVT-06` and `EVT-07` precedent; § 7 says why. § 4.3 is its transcription source.

**`size_estimate: M`** — one migration (one table, one definer function, one trigger and its
function), a second request shape and template in the existing Edge Function, two seam functions in
both implementations, one panel on the detail page, their tests, and one registry and one standards
row.

## 2. Acceptance criteria

Vocabulary, in addition to `EVT-01`'s, `EVT-05`'s and `EVT-06`'s (*can read an event*, *may manage an
event*, *straight to the datastore*, *open to guests*, *the guest page*, *event email on*):

- **Email invitation** — glossary row written by this ticket. One address entered for one event, by
  its creator or an admin, and the at-most-one mail that follows.
- **Inviter** — the signed-in person who entered the address.
- **A member's address** — an address equal, ignoring letter case and surrounding spaces, to the
  sign-in email of an **approved, not removed** member. Every other address, including a pending or
  removed member's, is an **outsider's** (triage assumptions 1 and 2).
- **Invited** / **already invited** — the two outcomes the inviter is told for each address.

### Inviting

**AC-1 — the creator invites from a public event's page**
- Given the detail page of a public-scope event, read by its creator
- Then the card shows `event-invite-panel`, holding `event-invite-input` (a multi-line field),
  `event-invite-submit`, which reads *Send invitations*, and `event-invited-list`
- When the creator enters one or more addresses — separated by commas, semicolons, spaces or new
  lines — and presses `event-invite-submit`
- Then `event-invite-result` lists each distinct address under *Invited* (`event-invite-sent`) or
  *Already invited* (`event-invite-ignored`), `event-invite-input` is emptied, and each address
  invited now appears in `event-invited-list`
- And for every address under *Invited*, exactly one mail is handed to the sender (AC-8, AC-9) —
  none for an address under *Already invited*

**AC-2 — an admin invites too**
- Given a public event created by somebody else, read by an admin
- Then the admin sees and uses `event-invite-panel` exactly as AC-1 (Q10-A)
- And the invitation names the admin, not the creator, as the person who invited (AC-8, AC-9)

**AC-3 — nobody else invites**
- Given a public event, read by any member or manager who did not create it
- Then the page shows no `event-invite-panel`, and loading the page makes no invitation call
- And an invitation sent straight to the datastore by such a member, by a removed or not-approved
  member, or signed out, is refused, saves nothing and hands nothing to the sender
- And the refusal for an event that does not exist, or that the caller cannot read, is the same one
  answer (`event_not_permitted`)

**AC-4 — public events only**
- Given a team-scope or named-people event, read by its creator or an admin
- Then the page shows no `event-invite-input` and no `event-invite-submit`
- And an invitation sent straight to the datastore for it is refused as not public, saves nothing,
  opens nothing and hands nothing to the sender
- And an event moved from public to another scope accepts no further invitation; its guest link and
  its invited list stay as they were (Q12-A, ADR-055 decision 9)

**AC-5 — inviting opens the event to guests**
- Given a public event not open to guests — never opened, or closed since
- When its creator or an admin invites at least one address that comes back *Invited*
- Then the event is open to guests: `event-guest-panel` shows a guest link without a reload, and that
  link is the one in every outsider's mail from this submission
- And an event already open keeps its link unchanged
- And a submission in which every address comes back *Already invited* still opens a closed event
  — the inviter asked to invite, and the link is what the earlier mails would need
- *F1: "kể cả mở lại nếu đã đóng". A reopened event has a new link (`EVT-06`); mails sent before
  it closed carry the old one, which no longer works, and are not re-sent (§ 1 Out of scope).*

**AC-6 — each address is invited once per event**
- Given an address already invited for an event, by anyone
- When it is entered again for that event — in any letter case, with or without surrounding spaces,
  in a later submission or twice in the same one
- Then it appears once in `event-invite-result`: under *Already invited* if it was invited before
  this submission; under *Invited*, once, if this submission is its first
- And no second mail is handed to the sender, and no second row appears in `event-invited-list`
- And the same address is invited to a **different** event as normal (Q11-A)
- And two submissions racing with the same address invite it once; the other reports it *Already
  invited*

**AC-7 — the inviter never learns who is a member**
- Given two addresses, one a member's and one an outsider's, each not yet invited for the event
- When they are invited, in the same submission or separately
- Then both come back *Invited*, and the response, the result on screen, the error if any, and every
  row of `event-invited-list` have the same shape and fields for both
- And this holds when the member has event email off, when the member is the inviter, and when the
  address is a pending or removed member's
- And no seam function, and no table or function straight to the datastore, tells any caller which
  invited addresses are members' or which received the member version (ADR-055 decision 3,
  revert condition 1)
- *So *Invited* means "accepted and mailed at most once", not "a mail left". It cannot say more
  without saying who is a member.*

**AC-8 — an outsider's mail carries the guest link**
- Given an outsider's address invited now
- Then the sender is handed one request for it, holding the event's name, dates and location, the
  inviter's display name and the event's current guest token, and nothing about any other address
- And the mail, in English on `EVT-05`'s template: subject *`<inviter>` invited you to `<event>`*;
  the headline the same sentence with a full stop; the greeting *Hi there,*; the event panel of
  `EVT-05` (event, when, where when it has one); one button, *View & register*, to
  `<APP_URL>/guest/<token>`; and a footer sentence saying they got the email because `<inviter>`
  invited them to an event on CaleChip, with **no** profile or opt-out link
- And every interpolated value is HTML-escaped in the HTML body and left as written in the subject
  and the text body; Vietnamese diacritics survive in all three (`EVT-05` AC-10)

**AC-9 — a member's mail links into the app**
- Given a member's address invited now
- Then one request is handed to the sender **only if** that member has event email on **and** is not
  the inviter; otherwise none (Q6-B, idea assumption 5)
- And that mail is `EVT-05`'s *event_invited* email in every word, with the inviter as the actor —
  subject *`<inviter>` invited you to `<event>`*, greeting *Hi `<member's name>`,*, button *View &
  join* to `<APP_URL>/events/<id>`, and the footer pointing to their Profile to turn event email off
- And it carries no guest token

**AC-10 — what an address must look like**
- Given a submission
- When any entered address, trimmed, is longer than 254 characters or is not of the shape
  *something@something.something* with no spaces — or nothing was entered
- Then nothing is saved, nothing is opened, nothing is handed to the sender, and
  `event-invite-error` says each address must look like *name@example.com*; the panel names the
  addresses that do not, and `event-invite-input` keeps what was typed
- And the same submission sent straight to the datastore is refused whole
- And an address is stored trimmed, with its letter case as entered the first time
- *`EVT-07` AC-4's ceiling and shape, reused (idea assumption 1).*

**AC-11 — no cap**
- Given a submission of any number of distinct, well-formed addresses
- Then every one is invited; none is refused for the number of addresses in the submission or
  already on the event (Q5-B, triage assumption 3)

### The invited list

**AC-12 — the creator and admins read who was invited**
- Given a public event with email invitations
- Then its creator and every admin see `event-invited-list`, headed *Invited by email (N)*, one
  `event-invited-row` per address, newest first, each showing the address as stored, the date it was
  invited, and the inviter's name (*Former member* for somebody no longer in the directory)
- And with none, the list reads *Nobody has been invited by email yet.*
- And on an event that is no longer public, the creator and admins still see the list, with one line
  in place of the field saying invitations can only be sent for public events (AC-4)

**AC-13 — nobody else reads it**
- Given an event with email invitations
- Then every other member, manager, the guest page and a signed-out caller see no invited address
  anywhere, and `listEventEmailInvitations` returns an empty list to them
- And reading the invitations straight to the datastore as such a member returns nothing, and signed
  out is refused (ADR-055 decision 8, revert condition 3)

**AC-14 — the list is kept**
- Given an event with email invitations
- When the event is edited, closed to guests, moved off public, or deleted
- Then every invitation row still exists; nothing in the product deletes or edits one (Q9-A)
- And none of those changes hands anything to the sender (Q12-A)

### What it does not touch

**AC-15 — the rest of the product is as it was**
- Given any number of email invitations
- Then `listMembers`, `listMemberDirectory`, every entry, the absence count, every
  `public.notification` row, the event's `updatedAt`, its attendees and its guests are exactly what
  they would have been without them
- And `EVT-05`'s mails for every other event are unchanged; the signed-out caller reaches no new
  function

**Invariants touched: `[]`.** An email invitation is not an entry and not a member, and an invitee is
counted nowhere until they register as a guest (`EVT-07`) or join as a member (`EVT-02`). The one read
of `public.member` and `auth.users` — recognising a member's address — happens inside a definer
trigger that returns nothing to any caller; no policy or grant on `public.member` changes, so
`listMembers()`, INV-04's denominator, is untouched. AC-15 asserts it. INV-01–03 and INV-05–07
constrain entries, which nothing here reads or writes.

**Open questions.** None that block. This plan's own decisions, each marked where it stands and each
cheap to reverse: an all-*already invited* submission still opens a closed event (AC-5); the invitation
names the **inviter**, not the creator, overruling idea assumption 4's "the creator's display name" —
an admin's invitation would otherwise be attributed to someone who did not send it (AC-2, AC-8);
an invalid address refuses the whole submission rather than inviting the rest (AC-10); the invited
list shows the inviter (AC-12).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/EVT-08/design/` (the folder does not exist) or cited by the idea
file. Nothing below is a behaviour beyond § 2.

**The event detail page.** One new block, `event-invite-panel`, **last in the card, directly under
`EVT-06`'s `event-guest-panel`**, behind the same `border-t border-line pt-4` divider — the invitation
carries that link, so they sit together. Drawn for the creator and admins when the event is public,
or when it is not public but already has invitations.

- A small-caps heading, as *Guest link* is: **Invite by email**. Under it one `text-ink-2` line:
  *Each address gets one invitation with the guest link. Sending opens this event to guests.*
- `event-invite-input`: a `textarea`, 3 rows, full width, `rounded-card bg-field`, placeholder
  *name@example.com, another@example.com*, `aria-label` *Email addresses*.
- `event-invite-error` (role `alert`, `text-danger`) under it, followed — when the panel found
  malformed addresses — by those addresses in `font-semibold`.
- `event-invite-submit`: the primary pill, right-aligned, *Send invitations*, *Sending…* while busy,
  disabled while busy or while the field holds nothing.
- `event-invite-result` (role `status`), after a send: up to two short groups — **Invited** with the
  addresses as mint pills, **Already invited** with the addresses as `bg-field` pills. Cleared by the
  next send.
- `event-invited-list`: a heading *Invited by email (N)*, then one row per address — the address in
  `text-ink`, then the date (`12 Oct 2026`) and *by `<name>`* in `text-ink-3` — newest first, in a
  list that scrolls past ten rows (`max-h-64 overflow-y-auto`) so a long list never pushes the page.
  Empty: *Nobody has been invited by email yet.* in `text-ink-3`.
- Not public: the heading, the line *Invitations can only be sent for public events.* in place of
  the helper line, the field and the button, and the list.

**The two mails** keep `EVT-05`'s template unchanged in layout: the header with the badge
*Invitation*, the headline, the greeting, the intro, the mint event panel (`event_invited`'s tint),
the full-width button, the footer sentence and the footer strip.

- **Outsider:** intro *You're invited — no account needed. Open the event to see the details and
  who's coming, and register there.*; button *View & register*; footer sentence *You got this email
  because `<inviter>` invited you to an event on CaleChip.* with no link in it.
- **Member:** `EVT-05`'s `event_invited` words exactly.

English copy throughout (F2-A). Addresses and names are user content and render as stored.

## 3. Permission model

Server-side always: the controls are the grants, policy, definer function and trigger in § 4.3.
Every check in the seam or the interface is an affordance.

| Action | signed out (`anon`) | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|---|
| Invite addresses to a public event | ❌ | own event only | own event only — **as a manager, nothing more** | ✅ any | `invite_to_event(uuid, text[])`: `may_manage_event` → 42501; `scope = 'public'` → EV009 |
| Invite to a team-scope or named-people event | ❌ | ❌ | ❌ | ❌ | `invite_to_event` → EV009 |
| Insert, update or delete an invitation row directly | ❌ | ❌ | ❌ | ❌ | no insert, update or delete grant on `event_email_invitation` to any role |
| Open the event to guests by inviting | ❌ | own event only | own event only | ✅ any | `invite_to_event`, after the same two checks — `EVT-06`'s opener, reached by a new path (ADR-055 decision 2) |
| Choose the guest token, the inviter, the time, or which mail is sent | ❌ | ❌ | ❌ | ❌ | `invite_to_event` takes none; the table's defaults and `email_invitation()` decide |
| Read an event's invited addresses | ❌ | own event only | own event only | ✅ any | `event_email_invitation_select_manage` — `may_manage_event` |
| Learn whether an address is a member's | ❌ | ❌ | ❌ | ❌ | no column, return or read carries it; `email_invitation()` returns nothing to a caller |
| Call `email_invitation()` | ❌ | ❌ | ❌ | ❌ | a trigger function; not callable through PostgREST |
| Call `send-event-email` | ❌ | ❌ | ❌ | ❌ | the shared secret in Vault (ADR-053 decision 4) — unchanged |
| Any of the above as a removed or not-approved member | as signed out | ❌ | ❌ | ❌ | `may_manage_event` starts from `member_team_id(uid) is not null` for the creator; `is_admin` for an admin |

**Denials the tests must assert**, both implementations where the mock can express them: a
non-creator member's, a manager's and a signed-out caller's `inviteToEvent` is `event_not_permitted`
and changes nothing (AC-3); a team or named event's is `invitation_not_public` for the creator and an
admin (AC-4); `listEventEmailInvitations` is `[]` for a non-creator member and a manager (AC-13); a
member's address and an outsider's give equal results (AC-7).

**Where membership could leak, and why it does not** (AC-7). The function's return is computed from
the invitation table alone — `sent` if this call inserted the row, `ignored` if the row was there —
before anything is known about who owns the address. The member lookup happens only in the `after
insert` trigger, inside `exception when others`, whose only effect is a `pg_net` request; it raises
nothing a caller sees and writes nothing a caller reads. The table has no column for the version or
for whether a mail left. A failure to queue a mail is a `warning` in the database log, exactly as
`EVT-05`'s.

**The mock reproduces these clause for clause and cannot prove them** — the `EVT-01` precedent. The
migration is applied by a human (RULE-09); the permission-model test against a real PostgreSQL stays
owed project-wide.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Appended under a new `EVT-08` banner after `EVT-07`'s. **No existing type changes.**

```ts
// ---------------------------------------------------------------------------
// EVT-08 — email invitations to a public event. 01-plan.md section 4.1. ADR-055.
// ---------------------------------------------------------------------------

/** EVT-08. Glossary *Email invitation*. One row of `public.event_email_invitation`, as the event's
 *  creator or an admin reads it. Deliberately nothing about whether the address is a member's, or
 *  which mail it received (AC-7). */
export interface EventEmailInvitation {
  id: string;
  eventId: string;
  email: string;
  /** The inviter's member id. */
  invitedBy: string;
  createdAt: string;
}

/** EVT-08 AC-1, AC-6, AC-7. One distinct address of a submission, in the order first entered.
 *  `sent`: invited by this call. `ignored`: already invited for this event. Nothing else. */
export interface EmailInvitationOutcome {
  email: string;
  outcome: "sent" | "ignored";
}
```

Two `FailureCode` members, appended to the union after `EVT-07`'s:

```ts
  // EVT-08. Nothing entered, or an address over GUEST_EMAIL_MAX or not GUEST_EMAIL_PATTERN — AC-10.
  // `invite_to_event` (EV008). The whole submission is refused.
  | "invalid_invitation_email"
  // EVT-08. The event is not public-scope — AC-4. `invite_to_event` (EV009).
  | "invitation_not_public"
```

Refusals also reuse `event_not_permitted` (42501). Messages, English, verbatim in both
implementations:

- `invalid_invitation_email` — *Each address must look like name@example.com, in 254 characters or
  fewer.*
- `invitation_not_public` — *Invitations can only be sent for public events.*

`GUEST_EMAIL_MAX` and `GUEST_EMAIL_PATTERN` are reused, not copied.

### 4.2 Seam — `src/lib/data/index.ts`

Appended to `DataSeam` under an `EVT-08` banner after `EVT-07`'s. Both implementations, same names and
arity. **No existing function's signature changes.**

```ts
  // -------------------------------------------------------------------------
  // EVT-08 — email invitations. 01-plan.md section 4.2. ADR-055.
  //
  // Two functions. NOTHING IN THE SEAM SENDS, QUEUES OR NAMES A MAIL: `invite_to_event` writes the
  // rows and an after-insert trigger hands each to the sender (ADR-051 decision 3, ADR-055 decision
  // 7). Nothing here says whether an address belongs to a member, and nothing may (AC-7).
  // -------------------------------------------------------------------------

  /** EVT-08 AC-1..AC-11. Trims each address and drops empties; refuses the whole call before the
   *  round trip with `invalid_invitation_email` when nothing is left or any address fails § 4.1's
   *  checks. One outcome per distinct address (ignoring case), in first-entered order. Opens the
   *  event to guests when it is not open. */
  inviteToEvent(eventId: string, emails: string[]): Promise<Result<EmailInvitationOutcome[]>>;

  /** EVT-08 AC-12, AC-13. The event's invitations, newest first (`createdAt` desc, then `id`), to its
   *  creator and admins; empty to everyone else and signed out. Bounded by DATASTORE_MAX_ROWS and
   *  throws at the bound. */
  listEventEmailInvitations(eventId: string): Promise<EventEmailInvitation[]>;
```

**`src/lib/data/supabase.ts`.**
`inviteToEvent`: the client-side check, then `rpc("invite_to_event", { p_event_id, p_emails })`, rows
→ outcomes. `listEventEmailInvitations`: `from("event_email_invitation").select("id, event_id, email,
invited_by, created_at").eq("event_id", eventId).order("created_at", { ascending: false })
.order("id").limit(DATASTORE_MAX_ROWS)` — **never `select("*")`**. A `toInvitationFailure` mapper on
SQLSTATE only: `EV008`, `EV009`, `42501`/`PGRST301` → `event_not_permitted`.

**`src/lib/data/mock.ts`.** A module-level `emailInvitations` array of `{ id, eventId: string | null,
email, invitedBy, createdAt }` and an `invitationEmailOutbox`, both emptied by `__resetEvents()`.
`inviteToEvent` reproduces § 4.3's function and trigger in one synchronous block — the check order,
the opening (through the same code `openEventToGuests` uses), the case-insensitive dedupe, and the
member lookup against `Member.email` for approved, non-removed members (the `EVT-05` mock's
substitute for `auth.users`), the switch through `eventEmailOn`, and never to the inviter.
`deleteEvent` sets the event's invitations' `eventId` to null and keeps them (AC-14). A test-only
named export, **not a seam member**:

```ts
export interface MockInvitationEmail {
  invitationId: string;
  kind: "invitation_guest" | "invitation_member";
  to: string;
  eventId: string;
  inviterName: string;
  /** The guest token in the request; null for the member version. */
  guestToken: string | null;
}
export function __sentInvitationEmails(): MockInvitationEmail[];
```

### 4.3 Database — `supabase/migrations/20261012100000_evt08_event_email_invitation.sql`

One transaction, idempotent in ADR-024's shape. Names fixed here (RULE-04); the Developer writes the
SQL. Header in `EVT-05`'s shape, including the line that it is not verified against a running
PostgreSQL and that **no human step beyond applying it is needed** — the Vault secrets and the
function's environment are `EVT-05`'s, and the function is redeployed with its two changed files.

```sql
create table if not exists public.event_email_invitation (
  id          uuid primary key default gen_random_uuid(),
  -- AC-14. SET NULL, NOT CASCADE: kept indefinitely (Q9-A, ADR-052 decision 8's terms).
  event_id    uuid null references public.event(id) on delete set null,
  email       text not null,
  invited_by  uuid not null references public.member(id),
  created_at  timestamptz not null default now(),
  constraint event_email_invitation_email_shape check (
    btrim(email) = email and char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
-- AC-6. One per address per event, ignoring case.
create unique index if not exists event_email_invitation_event_email
  on public.event_email_invitation (event_id, lower(email));
alter table public.event_email_invitation enable row level security;
```

**No column for the version, the member, or whether a mail left** (AC-7).

**The function — `public.invite_to_event(p_event_id uuid, p_emails text[])`**, definer, volatile,
`set search_path = ''`, `returns table (email text, outcome text)`:

1. `may_manage_event(p_event_id, auth.uid())` false — including a null uid — → raise 42501.
2. `select scope from public.event where id = p_event_id for share`; not `public` → raise `EV009`.
3. Trim every element, drop empties; none left, or any over 254 characters or failing the shape →
   raise `EV008`. Nothing has been written yet.
4. `insert into public.event_guest_link (event_id) values (p_event_id) on conflict (event_id) do
   nothing` — opens or reopens it with a database-chosen token (AC-5).
5. For each distinct `lower(address)` in first-entered order, keeping the first spelling:
   `insert into public.event_email_invitation (event_id, email, invited_by) values (p_event_id,
   <address>, auth.uid()) on conflict do nothing returning id`; a row returned → `sent`, none →
   `ignored`. `on conflict` makes the race in AC-6 answer `ignored` rather than raise.
6. Return the outcomes. **No branch of this function reads `public.member` or `auth.users`.**

**The trigger — `public.email_invitation()`**, `after insert on public.event_email_invitation for
each row`, definer, `set search_path = ''`, its whole body inside `exception when others → raise
warning … ; return new`, returning `new` on every path — `email_notification()`'s shape:

1. The two Vault secrets `event_email_function_url` and `event_email_hook_secret`; either missing →
   nothing.
2. The event (`id`, `name`, `start_date`, `end_date`, `location`) and the inviter's
   `member.display_name`.
3. The member, if any: `public.member m join auth.users u on u.id = m.id` where `lower(u.email) =
   lower(new.email)`, `m.status = 'approved'` and `m.removed_at is null`.
   - **Found:** `m.id = new.invited_by` or `not m.event_email_enabled` → nothing. Otherwise the
     member body.
   - **Not found:** the event's `event_guest_link.token`; none → nothing. Otherwise the guest body.
4. `net.http_post(url, body, headers)` with `x-event-email-secret`, exactly as `EVT-05`.

The two bodies, the request shape `send-event-email` gains (ADR-055 decision 7):

```json
{ "invitationId": "<uuid>", "kind": "invitation_guest",  "to": "<address as stored>",
  "inviterName": "<display name>", "recipientName": null,
  "event": { "id": "<uuid>", "name": "…", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "location": "…" | null },
  "guestToken": "<64 hex>" }

{ "invitationId": "<uuid>", "kind": "invitation_member", "to": "<auth.users.email>",
  "inviterName": "<display name>", "recipientName": "<member display name>",
  "event": { … as above … },
  "guestToken": null }
```

**Policy** — `to authenticated`, `(select auth.uid())` wrapped, drop-then-create:

| Policy | On | Predicate |
|---|---|---|
| `event_email_invitation_select_manage` | select | `event_id is not null and may_manage_event(event_id, (select auth.uid()))` |

No insert, update or delete policy.

**Grants:**

```sql
revoke all on public.event_email_invitation from anon, authenticated;
grant select (id, event_id, email, invited_by, created_at) on public.event_email_invitation to authenticated;

revoke all on function public.invite_to_event(uuid, text[]) from public, anon, authenticated;
grant execute on function public.invite_to_event(uuid, text[]) to authenticated;
revoke all on function public.email_invitation() from public, anon;
grant execute on function public.email_invitation() to authenticated;   -- EVT-05's shape
```

**Nothing existing is replaced.** `event_guest_link`, its policies, `email_notification()`, every
`notify_*` trigger and every policy on `public.member` are read, not changed. Inserting into
`event_guest_link` from a definer function fires nothing — `EVT-06` § 4.3 has no trigger on it.

### 4.4 The sender — `supabase/functions/send-event-email/`

**`template.ts`.** Appended; **no existing export changes**, so `tests/event-email.test.ts` passes
untouched.

```ts
/** EVT-08. The two invitation kinds (ADR-055 decision 4). Disjoint from EventEmailKind. */
export type InvitationEmailKind = "invitation_guest" | "invitation_member";

/** EVT-08 § 4.3. The body `email_invitation()` posts. */
export interface InvitationEmailRequest {
  invitationId: string;
  kind: InvitationEmailKind;
  to: string;
  inviterName: string;
  /** Non-empty for `invitation_member`, null for `invitation_guest`. */
  recipientName: string | null;
  event: EventEmailRequest["event"];
  /** 64 lowercase hex for `invitation_guest`, null for `invitation_member`. */
  guestToken: string | null;
}

/** EVT-08 AC-8, AC-9. The request, or null unless it is exactly that shape, with the kind-dependent
 *  nullability above and `parseEventEmailRequest`'s rules for every shared field. */
export function parseInvitationEmailRequest(input: unknown): InvitationEmailRequest | null;

/** EVT-08 AC-8, AC-9, § 2b. `invitation_member` renders exactly what `renderEventEmail` renders for
 *  `event_invited` with `actorName = inviterName`. `invitation_guest` renders § 2b's outsider words,
 *  its button to `${appUrl}/guest/${guestToken}`, and no profile link. Same escaping rules. */
export function renderInvitationEmail(request: InvitationEmailRequest, appUrl: string): RenderedEmail;
```

**`index.ts`.** After the secret and the environment, unchanged: `parseEventEmailRequest(body)`, then,
if null, `parseInvitationEmailRequest(body)`; neither → 400. Rendered by the matching function. The
failure log names `invitation <id> (<kind>)` for an invitation — **never the address, the token or
the body**, as now. The answer's `notificationId` stays for an `EVT-05` request; an invitation's
answer carries `invitationId` instead. Nothing else changes.

### 4.5 Screen — `src/routes/EventDetail.tsx`

`LoadState`'s ready branch gains `invitations: EventEmailInvitation[]`, loaded **only when
`mayEditEvent(event, me)`**, beside `getEventGuestLink` — a non-manager's load makes no new call
(AC-3). A new component in the same file, `EventInvitePanel({ event, invitations, directory,
onInvited })`, rendered after `EventGuestPanel` when `canEdit && (event.scope === "public" ||
invitations.length > 0)`. `onInvited` re-reads `getEventGuestLink` and `listEventEmailInvitations`
into state, so the guest panel shows the link the invitation opened (AC-5).

Two exported pure helpers in the same file, for the panel and the unit test:

```ts
/** EVT-08 AC-1. Splits on commas, semicolons and whitespace; drops empties. Order kept. */
export function parseInvitationInput(text: string): string[];
/** EVT-08 AC-10. The entries failing GUEST_EMAIL_MAX or GUEST_EMAIL_PATTERN, in order. */
export function invalidInvitationEmails(emails: string[]): string[];
```

### 4.6 Selectors

| Selector | Where | AC |
|---|---|---|
| `event-invite-panel` | detail card, creator and admins | AC-1, AC-2, AC-3, AC-12 |
| `event-invite-input`, `event-invite-submit`, `event-invite-error` | the panel, public events only | AC-1, AC-4, AC-10 |
| `event-invite-result`, `event-invite-sent`, `event-invite-ignored` (each a list of `li` with `data-email`) | after a send | AC-1, AC-6, AC-7 |
| `event-invited-list`, `event-invited-row` (with `data-email`) | the panel | AC-12 |
| `event-invite-not-public` | the panel, non-public event with invitations | AC-4, AC-12 |

`EVT-06`'s `event-guest-*` selectors are unchanged and asserted by AC-5.

## 5. Seam impact

Two functions added to `DataSeam` and to both implementations with the same names and arity:
`inviteToEvent`, `listEventEmailInvitations`. **No existing signature changes.** One existing mock
function changes behaviour without a signature change: `deleteEvent` also sets the event's
invitations' `eventId` to null. With no invitations it returns what it returned before, so no
existing test changes. `listMembers()` and every policy on `public.member` are untouched.

## 6. Schema delta

**Not `none`.** One table with a check constraint and a unique expression index, one select policy
and a column grant; one definer function granted to `authenticated`; one trigger and its definer
function posting through `pg_net`. Nothing existing is replaced. Decided by
[ADR-055](../../../registry/decisions/ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md),
`ACCEPTED by the operator` — `requires_adr: true` is met.

**Agrees with `ticket.yaml`'s triage description**, made exact in two places: the table's event
reference is `on delete set null` (AC-14), and the function opens the link with `on conflict do
nothing` rather than reading it first. `schema_delta` is amended to say both.

**Why the member lookup is in the trigger and not the function.** The function's answer must not
depend on membership (AC-7); keeping every read of `member` and `auth.users` out of the function
makes that a property of its text, which a reviewer checks by reading it, rather than of a branch
that must be shown to return the same thing either way.

**Why `on conflict do nothing` and not a pre-check.** Two inviters racing on one address would both
pass a pre-check and one would raise 23505 — a different answer for the same input. The unique index
decides and the loser reads `ignored` (AC-6).

**Applying it is human** (RULE-09), and so is redeploying `send-event-email` with its two changed
files. `supabase/db.sql` is not updated (MD-033).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261012100000_evt08_event_email_invitation.sql"
  - "supabase/functions/send-event-email/template.ts"
  - "supabase/functions/send-event-email/index.ts"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/EventDetail.tsx"
  - "tests/event-invitation.test.ts"
  - "tests/e2e/evt-08-event-invitation.spec.ts"
```

**Glossary:** *Email invitation*, written at this stage (ADR-047). *Invitation* and *Guest link*
already have rows and are not rewritten; the new row says how it differs from both.

**Standards written by this ticket:** `.ai/standards/rbac-and-security.md` — § 3's rows added to the
permission table. The *Signed out* paragraph is unchanged: no function is granted to `anon`.
**`.ai/standards/data-model.md`'s `event_email_invitation` entity goes to `/thuki`**, as `EVT-06`'s
and `EVT-07`'s did: a thirteenth path makes this L.

**Deliberately absent:** a separate `src/components/EventInvitePanel.tsx` — the panel is a component
inside `EventDetail.tsx`, as `EventGuestPanel` is, and a thirteenth path would make this L;
`tests/event-email.test.ts` (no existing template export changes — if it needs an edit, the contract
broke a caller and the Developer stops); `tests/guest-link.test.ts` and its e2e spec (the guest
link's table and reads are unchanged); `src/routes/EventEditor.tsx` (`EVT-09`).

**`size: M`** — twelve paths. Agrees with `size_estimate: M`. A thirteenth makes this `L`, which must
split; the Developer stops rather than add one.

## 8. Rejected alternatives

**1. Write invitations as `public.notification` rows and reuse `email_notification()`.** No new
trigger and no new request shape. Rejected: a notification row is addressed to a member
(`recipient_id not null references member`) and is the in-app list's source — an outsider has no
member row, and a member would gain an in-app row ADR-055 does not give them. It would also make
`notification` carry rows nobody may read in the app.

**2. Resolve member versus outsider in `invite_to_event` and store it on the row.** One place
decides, and the row records what was sent. Rejected: the creator and admins read the row (Q9-A), so
the stored version is the membership disclosure ADR-055 revert condition 1 names; hiding it with a
column grant leaves a function whose answer is computed from membership and has to be shown not to
leak through timing, errors or a future edit. Deciding in the trigger keeps the function's text free
of it (§ 6).

**3. A second Edge Function for invitations.** Cleaner separation of the two templates. Rejected by
ADR-055 § *Rationale*: a second secret and a second deployment for the same job, against ADR-053
decision 1.

**4. Invite the valid addresses and report the malformed ones.** Kinder to a long paste with one
typo. Rejected for now: a third outcome per address widens AC-7's surface, and the panel already
names the malformed addresses before the round trip, so the fix is one edit and one press (AC-10).
Cheap to reverse.

**5. A dedicated `src/components/EventInvitePanel.tsx`.** `EventAttendancePanel`'s shape. Rejected
for size alone — the thirteenth path makes the ticket `L` — and `EventGuestPanel` already sets the
in-file precedent for the panel it sits under.

## Changelog

- 2026-10-12T20:53:26+0700 — created. Sections 1 and 2 were written from the feature row, the idea
  and ADR-055 before the source was read. On reading `EventDetail.tsx`, AC-5 gained its sentence on
  a reopened link being new (`EVT-06`'s close dialog says so) and § 1 Out of scope the matching
  non-re-send line; on reading `template.ts`, AC-9 was tightened from "a member version" to
  `EVT-05`'s `event_invited` words exactly. No AC was loosened. Idea assumption 4 overruled (the
  inviter is named, not the creator) — § 2 *Open questions*. `schema_delta` in `ticket.yaml`
  amended (§ 6). Raised by `tech-lead-design`. Amended by `tech-lead-design`.
