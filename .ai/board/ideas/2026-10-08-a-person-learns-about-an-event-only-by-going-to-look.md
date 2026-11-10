---
stage: TRIAGE
agent: product
produced_at: 2026-10-08T07:20:00Z
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/templates/idea.md
  - .ai/standards/tech-stack.md
  - .ai/standards/ui-design-system.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md
  - .ai/board/tickets/EVT-02/01-plan.md
  - supabase/
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: "PROMOTE"
verdict_reason: "Worth building and not covered: no event change reaches anyone who does not go to look. In-app sits inside ADR-005 (ADR-050, ACCEPTED by product); email reverses ADR-005 and ADR-045 decision 6, which the operator agreed to in words (Q5 \"a\"), so ADR-051 is ACCEPTED by the operator. Two rows on Q7; EVT-05 is blocked at PLAN on Q6."
ticket_id: "EVT-04, EVT-05"
awaiting_adrs: []
operator_request: "thông báo trong app và email cho event"
---

# A person learns about an event only by going to look

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

*`/triage` wrote its verdict below on 2026-10-08; the sentence above is left as `/idea` wrote it.*

## Problem

*Derived from the request above; the operator stated a solution, not a problem.*

Nothing in the product tells a person that something about an event has happened to them. A member
invited by name, a member whose join request was approved, rejected or removed, a member whose event
was edited or cancelled, and a creator with join requests waiting all find out only by opening
`/events` or `/events/:id` and noticing. `EVT-02`'s plan records it in as many words: *"A requester
learns the decision by opening the event"* (`.ai/board/tickets/EVT-02/01-plan.md`, § Out of scope).
A person who does not go to look does not find out, and a creator who does not go to look leaves
requests pending.

## Who has it

- **Every approved member**, whenever an event is created for their team or for everyone, or names
  them, or decides their request.
- **Every event creator**, every time somebody asks to join or withdraws.

## Evidence

The operator's request, verbatim above, from the brainstorm of 2026-10-08. The 2026-09-29 idea had
already split email out: Q20 *"Tách thành ticket sau"*.

**Q1 — confirming the 2026-09-29 email triggers.** That idea's Q21 answer, which exists in no ADR:
*"Event mới cho team/public, Được mời đích danh, Đơn được duyệt/từ chối/bị gỡ"*, and not on edit or
delete. Asked whether it still holds. **Answer: "đúng".**

**Q2 — in-app notification types.** (a) a new event for my team or public; (b) invited by name;
(c) my request approved, rejected or removed; (d) an event I take part in edited or cancelled;
(e) the creator learns of a join request or a withdrawal; (f) reminders before the event or the
deadline — cost stated: a scheduled job (pg_cron), unlike (a)–(e), which a user action triggers.
**Answer: "a đến e, bỏ f".**

**Q3 — email for a public event.** A: send it — every member of every team, a mass send per public
event. B: in-app only; email only to one's own team and to people invited by name.
**Answer: "b".**

**Q4 — opting out of email.** A: one switch for all email; B: per type; C: none. Cost stated: A is a
column and a control on Profile, B a settings table, C nothing.
**Answer: "a".**

**Q5 — amending ADR-005.** Asked: *Email needs something running server-side. A new ADR would say
"a server-side component exists only to send mail and is never used for authorization; RLS stays the
only authorization mechanism". A: agree. B: no — in-app only, email dropped.*
**Answer: "a".**

**Q6 — email provider, who holds the key, and the sending domain.** **Answer: "chưa có".**

*Answered later the same day, 2026-10-08, recorded by `orchestrator` from the operator's words:* **Gmail, over SMTP with an App Password** (*"chọn cách B"*, chosen over the Gmail API with OAuth). **No sending domain** — mail goes from a Gmail address, so no SPF/DKIM records are owed. Credentials go in a gitignored env file (*"setup trong file .env"*): `supabase/functions/.env`, pushed with `supabase secrets set`. **Still open for PLAN:** which Gmail account, and who holds it. Supabase blocks outgoing ports 25 and 587 from hosted Edge Functions, so the sender uses 465 — TODO(verify) with one real send. *Then, 2026-10-09, from the operator:* the sending account is **`didi00889900@gmail.com`**, App Password supplied and written to the gitignored env file only, From header **`CaleChip <calechip.app@gmail.com>`**. Option B confirmed. **Who holds the account is not stated** and is PLAN's to carry as an open question if it matters. Gmail replaces a From address that is not a verified *Send mail as* alias of the authenticating account, so the From above holds only if `calechip.app@gmail.com` is added as an alias of `didi00889900@gmail.com`; otherwise mail goes out from the account address. TODO(verify). *Superseded the same morning by the operator:* From is **`CaleChip <didi00889900@gmail.com>`**, the account address itself, so no alias is needed and the TODO above is closed.

**Q7 — two tickets, in-app first, email second and depending on it.** **Answer: "đúng tách 2
ticket".**

**Q8 — email language.** Proposed: English, matching the UI.
**Answer: "dùng tiếng anh và có template đẹp."**

## Impact if ignored

Join requests sit pending until a creator happens to open the event; an invitation is seen only by
someone who browses `/events`; a cancelled event is discovered on the day. Events stay a feature
people have to remember to check, which is the same problem `EVT-03` solves for the calendar.

## Constraints already known

- **Two halves, two decisions on record:**
  - **In-app** needs no ADR change. Every trigger in Q2 (a)–(e) is a user action on `public.event` or
    its attendance, so a row can be written in the database under ADR-005 as it stands. Who receives
    a notification is bounded by ADR-045 decision 3 — **a notification never tells a person about an
    event they could not read.**
  - **Email** reverses ADR-005's *"No server-side API is written"* and ADR-045 decision 6, *"ADR-005
    stands. No server, no email"*. Q5 is the operator's agreement, in words, to an ADR that admits a
    server-side component **for sending mail only, never for authorization**.
- **Email triggers are Q1's, narrowed by Q3:** a new event for **one's own team** (not public),
  invited by name, request approved / rejected / removed. Not on edit, delete, a join request or a
  withdrawal — those are in-app only.
- **Email can be switched off with one control** (Q4-A). The switch never affects in-app
  notifications.
- **Email is English** (Q8) and its template follows `CLAUDE.md` § *Visual direction* — pastel,
  rounded, Nunito or Baloo 2 with correct Vietnamese diacritics in names. The layout is
  `tech-lead-design`'s to originate under the § *No invention* carve-out.
- **The email half has no provider, no key and no sending domain** (Q6). It cannot pass PLAN until
  one exists; see § Open questions.
- **No server is needed for in-app, and none may be added for it.** The email ADR's server-side
  component must not become the place in-app notifications are written.
- **Nothing here touches entries, the absence count or the grids** — INV-04, INV-05, INV-07 are not
  engaged.

## Out of scope

- **Reminders** before an event or a deadline (Q2-f) — they need a scheduler.
- **Email for public events** (Q3) and **email on edit, delete, join request or withdrawal** (Q1).
- **Per-type email settings** (Q4) and **any setting for in-app notifications**.
- **Notifications about entries** — PTO/WFH approved or rejected, and so on. The bell is built for
  events; another producer is another idea.
- **Push notifications, SMS, chat integrations.**
- **The public event page** — a separate idea from the same brainstorm.

## Open questions

1. **Email provider, the account and key holder, and the sending domain with its SPF/DKIM records
   (Q6: "chưa có").** This changes what can be built and who pays, so it is the operator's. It
   blocks **the email ticket only**, at PLAN; the in-app ticket does not wait on it.

Assumptions this file made rather than asked, each cheap to reverse and each PLAN's to overrule:

2. **The bell sits in the top bar with an unread count**; opening a notification marks it read and
   navigates to `/events/:id`; there is a *mark all read*.
3. **Notifications are kept 90 days**, read or not.
4. **The actor is not notified of their own action** — a creator does not get "new event" for the
   event they just made.
5. **A deleted event's notifications stay readable** and say it was cancelled; they no longer link.
6. **The email opt-out switch lives on `/profile`** (`TEA-10`'s screen) and defaults to on.

# Triage verdict — PROMOTE, as `EVT-04` then `EVT-05`

`product` at /triage, 2026-10-08.

**Not REJECT.** `EVT-02`'s plan states the gap in its own words — *"A requester learns the decision
by opening the event"* — and nothing shipped since closes it.

**Two ADRs, signed differently, because they sit on different sides of the envelope.**

- **[ADR-050](../../registry/decisions/ADR-050-in-app-notifications-for-events-are-written-by-the-database.md),
  `ACCEPTED by product`.** In-app needs a table and triggers — a schema change, so RULE-09 wants an
  ADR before the ticket exists — but it adds no server and widens no read: recipients are bounded by
  ADR-045 decision 3. That is deciding inside what is decided.
- **[ADR-051](../../registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md),
  `ACCEPTED by the operator`.** Email reverses ADR-005's *"No server-side API is written"* and ADR-045
  decision 6. That is changing the envelope, and § *Evidence* Q5 is the operator choosing it in words
  against a question that named the clause. Status notes were added to ADR-005 and ADR-045; their
  text is unchanged.

**Two rows, on the operator's Q7.** `EVT-04` is in-app; `EVT-05` is email and `depends_on: [EVT-04]`.
Split at triage, not PLAN, for MD-017's reason.

**`EVT-05` is promoted although it cannot be planned yet.** Q6 is *"chưa có"*: no provider, key
holder or sending domain. That is not a reason to withhold the ID — the decision to build email is
made and recorded — but PLAN cannot name the sender or its secret, so the row and the backlog both
say it is blocked on the operator. This file's § *Open questions* 1 is that decision.

**What this verdict wrote:** ADR-050; ADR-051; Status notes on ADR-005 and ADR-045; the `EVT-04` and
`EVT-05` rows in `.ai/registry/features.md`, `PLANNED`; both ticket shells at `BACKLOG`; rows 2 and 3
of `## BACKLOG`. DoR items 1, 3, 4 and 6 are filled; 2 and 5 are PLAN's. `glossary_owed:
[Notification]` on `EVT-04`.
