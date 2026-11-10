---
stage: TRIAGE
agent: product
produced_at: 2026-10-14
inputs_read:
  - .ai/registry/features.md (EVT-05 to EVT-09)
  - .ai/registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md
  - .ai/registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md
  - .ai/registry/decisions/ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
  - supabase/functions/send-event-email/template.ts
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/App.tsx
  - .ai/board/tickets/EVT-06/01-plan.md (AC-16)
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE          # not the routing input — see `verdict` below
verdict: PROMOTE
verdict_reason: "Worth doing and not covered; the only ADR it needs, ADR-061, rests on the operator's verbatim answers in § Evidence, so it is ACCEPTED by the operator and nothing waits"
ticket_id: "EVT-12, EVT-13"
awaiting_adrs: []
operator_request: "Invite by email cho event Own team và Named people — chọn 1: member ngoài phạm vi được thêm vào named; người chưa có tài khoản nhận /guest/<token>. Đối với user đã có account, bấm vào link gúest tự động về link event đã đăng nhập"
---

# A team or named-people event cannot invite anyone by email, and a signed-in member who opens a guest link is left on the guest page

## Problem

*Derived from the request above; the operator stated a solution, not a problem.*

1. **The creator of an *Own team* or *Named people* event cannot invite anyone by email**, whether
   the person is a member outside the event's reach or has no account. Only a public-scope event
   (labelled *"Every team"* in the form) shows the *Invite by email* field, on create (EVT-09) and on
   the detail page (EVT-08), and the database refuses every other scope. So a team gathering cannot
   include a colleague from another team or an outside guest without first becoming visible to every
   team.
2. **A signed-in member who opens a guest link sees the guest page**, with no way into the event as
   they would see it in the app. EVT-06 AC-16 made the page identical for every reader on purpose.

## Who has it

- The creator of an *Own team* or *Named people* event, or an admin, each time someone outside the
  event's current readers should come.
- A member who receives or is forwarded a guest link, each time they open it while signed in.

## Evidence

**What the repository does today, read from the source:**

- `src/routes/EventEditor.tsx:518` — the create form draws the invite field only when
  `values.scope === "public"`. The scope choices at `:67-71` label public as *"Every team"*.
- `src/routes/EventDetail.tsx:338` — the invite panel is drawn for managers when
  `event.scope === "public"`, or for a non-public event only when it already lists invitations.
- `supabase/migrations/20261012100000_evt08_event_email_invitation.sql:104` — `invite_to_event`
  raises `invitation_not_public` (`EV009`) for any scope but `public`.
- The same file: `email_invitation()` sends the **member version** to an address that is an approved
  member's, and the **guest version**, linking to `${APP_URL}/guest/<token>`
  (`template.ts:541`, route `src/App.tsx:153`), to any other address. `invite_to_event` always opens
  the event's guest link and **reads no `public.member` row**, by design.
- ADR-052 decision 1 already lets **any event, whatever its scope**, be opened to guests. Only the
  invitation path is limited to public.
- ADR-055 decision 1: *"Team-scope and named-people events accept none."* Decision 3: the inviter is
  told which addresses were sent and which ignored, *"never which addresses belong to members"*.
  Decision 6: a public event mails nobody on creation.
- `src/routes/GuestEvent.tsx:3-4` and EVT-06 AC-16: *"a signed-out caller and a signed-in member of
  any team, role or membership state see exactly the same page"*.
- The named list is `public.event_invitee`. EVT-04's `notify_event_invited` trigger fires once per
  row inserted, and EVT-05 emails *"invited by name"* from that notification.

**The conversation, verbatim, in order.** The first three exchanges happened in the orchestrator
session the same afternoon, before `/idea` was run.

> **Operator:** "chưa thấy UI cho Nhập email lúc tạo event public (EVT-09), hoặc sau đó trên trang chi
> tiết event (EVT-08)…"
>
> *(Answered: the field exists and appears only when the scope is "Every team", the label for public.)*
>
> **Operator:** "thay đổi tính năng , vẫn cho phép Invite by email (optional) đối với event own team
> và named peple"
>
> **Asked:** if an entered address belongs to a member who cannot read the event, then (1) add them
> to the event's named people and send the member version, (2) send them the guest version and leave
> their app access alone, or (3) ignore the address.
>
> **Operator:** "chọn 1 . nhưng link gửi cho người chưa có account là link gì"
>
> *(Answered: `<APP_URL>/guest/<token>`, one shared link per event, made when the event is opened to
> guests.)*

Then in this `/idea` session:

> **Q1.** An *Own team* event: inviting a member of another team. **A** — convert the event to *Named
> people*, snapshotting the team at that moment plus the new person (later joiners of the team will
> not see it); **B** — keep *Own team* and allow extra individuals on `event_invitee`, with the read
> policy becoming "same team, or on the list".
> **Operator: "A"**
>
> **Q2.** Adding the person to the named list shows them in the event's invited list, so the inviter
> learns that the address is a member's, against ADR-055 decision 3. **A** — accept it for *Own team*
> and *Named people* events, with public events unchanged and ADR-055 decision 3 amended; **B** —
> hide auto-added people from the visible list.
> **Operator: "A"**
>
> **Q3.** The out-of-scope member, once added to `event_invitee`, would get EVT-05's *"invited"* mail
> and EVT-08's member invitation. **A** — one mail, EVT-05's *"invited"*; the invitation is recorded
> `sent` and EVT-08 sends no member version; **B** — one mail, EVT-08's, with EVT-05's suppressed on
> this path; **C** — both.
> **Operator: "A"**
>
> **Q4.** A signed-in user opening a guest link, reversing EVT-06 AC-16. **A** — if they can read the
> event in the app, redirect to `/events/<id>`; if they cannot, the guest page as today; **B** — every
> signed-in user is redirected, and one without access meets "not found".
> **Operator: "A"**
>
> **Q5.** Confirm: entering an outside address on an *Own team* or *Named people* event opens it to
> guests, so anyone holding `/guest/<token>`, including from a forwarded mail, reads its name and
> attendee list.
> **Operator: "đồng ý"**
>
> **Q6.** Under Q1-A, the team members snapshotted onto the named list would each get an in-app
> notification and an *"invited"* mail from the EVT-04/05 triggers. **A** — notify none of them, only
> the newly added person (a suppression branch for this conversion); **B** — notify everyone.
> **Operator: "A"**

**Assumed, not asked.** Each is cheap to reverse and is the existing rule carried over.

1. Who may invite is unchanged: the event's creator or an admin (`may_manage_event`, ADR-055
   decision 1).
2. A member who can already read the event (same team on an *Own team* event, already named, or any
   member on a public event) still receives EVT-08's member version, as today.
3. Public events are unchanged in every respect, including ADR-055 decision 3.
4. Each address is still mailed at most once per event (ADR-055 decision 3, first sentence).
5. An address with no account always receives the guest version, and entering one opens the event to
   guests (ADR-055 decision 2, now for every scope, per Q5).

No screenshot was supplied. The field and panel already exist; this widens when they are drawn.

## Impact if ignored

A creator who wants one outside colleague or guest at a team event has to make it *"Every team"*,
which shows it to every team and, under EVT-05, sends mail nowhere. Or they forward the guest link
by hand. A member who opens a guest link while signed in registers as a guest instead of attending as
a member, which splits the attendee list into two kinds for the same person.

## Constraints already known

- **ADR-055 decisions 1, 3 and 6 are amended** by Q1 to Q3: invitations are accepted on every scope;
  for *Own team* and *Named people*, the inviter can see that an address is a member's; an
  out-of-scope member is put on the named list. Decision 6 (public creation mails nobody) is
  untouched.
- **ADR-052 is extended by Q4.** EVT-06 AC-16's "same page for every reader" becomes a redirect for
  a signed-in reader who can read the event. ADR-052 decisions 2 and 3 stand.
- **ADR-045 decision 4** (do not reveal membership), which ADR-055 decision 3 restates, is relaxed for
  this one path by Q2-A.
- `invite_to_event` must now resolve addresses to members, which EVT-08 AC-7 forbade. That
  constraint is replaced, not worked around.
- EVT-04's `notify_event_invited` trigger needs a branch that suppresses the snapshot rows of a
  team-to-named conversion (Q6-A) and that skips EVT-08's member mail for an auto-added person
  (Q3-A).
- **Schema delta is not `none`**: functions, a trigger and possibly a policy change. A migration that
  touches a policy, trigger or constraint is not `none` (ADR-014). RULE-09: humans apply migrations.
- INV-04, INV-05 and INV-07 (absence counts) are not engaged: guests are not members (ADR-052
  decision 9) and the named list does not count absences.

## Out of scope

- Mailing anyone automatically when an event is created, of any scope (ADR-051 decision 4 and ADR-055
  decision 6 stand). Raised the same afternoon and not taken up.
- A per-person guest link. One link per event remains (ADR-052 decision 2).
- Hiding auto-added people from the invited list (Q2-B, decided against).
- Keeping *Own team* scope with extra individuals (Q1-B, decided against).
- Renaming *"Every team"* to say *public*. Noted as a possible `/solo` change and not part of this.
- Emailing a guest their manage link (ADR-052 decision 6, a later ticket).
- Any change to who may create, edit or open an event.

## Open questions

None outstanding. Every decision a downstream stage would otherwise invent is answered above, Q1 to
Q6, or listed under *Assumed, not asked*.

**Added after the verdict, 2026-10-14 — a label change folded into `EVT-12`.**

> **Operator:** "thay đổi Named people thành limited people"

Read as the **label shown to people**, not the scope's name in the database: `event_scope` stays `'named'`, and renaming an enum value would be a schema change nobody asked for. The label is drawn at `src/routes/EventEditor.tsx:69` (the scope choice) and `src/routes/Events.tsx:24` (the scope badge), and asserted at `tests/e2e/evt-01-events.spec.ts:208`. Folded into `EVT-12` because that ticket already edits the scope choices on the same form; PLAN enumerates the paths. *Limited people* is written with a capital L, matching *Own team* and *Every team*; that is a guess and cheap to reverse. The glossary row for **Event** names the scopes, so `glossary_owed` carries the new label.

---

## Triage verdict — PROMOTE, as `EVT-12` and `EVT-13`

2026-10-14, `product`.

**Worth doing, not covered.** EVT-08 and EVT-09 stop at public scope by ADR-055 decision 1, and EVT-06 AC-16 keeps a signed-in reader on the guest page. Nothing on the board does either.

**It needed an ADR, and the ADR is written:** [ADR-061](../../registry/decisions/ADR-061-invitations-reach-every-event-scope-and-a-signed-in-reader-leaves-the-guest-page.md). It amends ADR-055 decisions 1, 3 and 7 and ADR-052 decision 3 (EVT-06 AC-16), which would ordinarily stop here for the operator. It does not stop: § *Evidence* holds the operator's answers verbatim, Q1 to Q6 and option 1, so the Status reads `ACCEPTED by the operator` with those words cited. `awaiting_adrs` stays empty.

| Ticket | Ships | Depends on | Schema |
|---|---|---|---|
| EVT-12 | Invitations on *Own team* and *Named people*: `invite_to_event`, `email_invitation`, `notify_event_invited`, the create form and the detail panel | EVT-08, EVT-09 | changed (functions, a trigger) |
| EVT-13 | The guest-link redirect for a signed-in reader who can read the event | EVT-06 | none |

Split at triage because they share no file and no table. EVT-13 can ship first.

**`glossary_owed: []`** on both. *Named people*, *guest link* and *invitation* are already used by the EVT rows. PLAN confirms against `glossary.md`.

**Not dispatched:** `tech-lead-design`. The technical half was read directly (the three migrations, both routes, the mail template) and is recorded under § *Evidence* and § *Constraints already known*. PLAN is where it designs.
