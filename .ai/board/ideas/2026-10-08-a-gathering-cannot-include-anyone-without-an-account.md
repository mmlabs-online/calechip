---
stage: TRIAGE
agent: product
produced_at: 2026-10-08T07:38:01Z
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/templates/idea.md
  - .ai/standards/rbac-and-security.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md
  - .ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md
  - .ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: "PROMOTE"
verdict_reason: "Worth building and not covered: no event can be read or joined without an account. It overrides ADR-045 decision 3 and gives the anon role its first read and write, which the operator chose in words (Q1 \"A\", F2 \"A Đúng vậy\"), so ADR-052 is ACCEPTED by the operator. Split into the read half and the write half."
ticket_id: "EVT-06, EVT-07"
awaiting_adrs: []
operator_request: "trang event công khai, khách đăng ký bằng tên và email"
---

# A gathering cannot include anyone without an account

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

*`/triage` wrote its verdict below on 2026-10-08; the sentence above is left as `/idea` wrote it.*

## Problem

*Derived from the request above; the operator stated a solution, not a problem.*

An event can only be read and joined by an approved member (ADR-045 decision 3). A creator whose
gathering includes people outside the product — a partner, a candidate, family at a year-end party,
a speaker — has no way to show them the event or take their registration, so the headcount for those
people is kept somewhere else, by hand, and the event's capacity and attendee list in the product are
wrong by exactly that many.

## Who has it

Any member who creates an event that people without an account should attend, every time they do.
The people outside, who today learn of it by a forwarded message and register by replying to one.

## Evidence

The operator's request, verbatim above, from the brainstorm of 2026-10-08.

**Q1 — the direction.** Asked: *the product gains a page anyone on the internet can read, and people
without an account can write to the database — a new ADR. A: agree. B: no — the idea stops.*
**Answer: "A".**

**Q2 — who may open an event to guests.** A: its creator, any member; B: admins only; C: the creator,
taking effect after an admin approves. **Answer: "A".**

**Q3 — which events may be opened.** A: public-scope only; B: any scope — with the cost stated that a
team-only event would then be readable outside the product. **Answer: "B".**

**Q4 — what the public page shows.** A: name, description, location, dates, seats left — no attendee
list; B: as A, plus attendee names — with the cost stated that employee names reach the internet.
**Answer: "B".**

**Q5 — guests and the event's rules.** A: guests take seats and follow the event's capacity and
approval mode, as members do; B: a separate guest capacity. **Answer: "A".**

**Q6 — how a guest manages their registration.** A: they cannot; B: a secret link shown on screen
after registering, to see status or cancel, no email; C: a manage link by email, depending on
`EVT-05`. **Answer: "B và C khi xong ticket email".**

**Q7 — spam and bots.** A: database limits only — one registration per email per event, plus capacity
and deadline; no server. B: a captcha, whose verification needs the server component ADR-051 limits
to mail. **Answer: "A".**

**Q8 — guests' personal data.** Who sees a guest's name and email; is it deleted after the event.
**Answer: "Tất cả mọi người được xem tên khách, xong xem email. Không xóa data".**

**F1 — clarifying Q8.** Asked whether *"xong xem email"* meant nobody sees the email, or the creator and
admins, or every member. **Answer: "cho phép mọi người thấy tên khách đăng kí, nhưng không thấy email.
Email chỉ được xem bởi người tạo event và admin".**

**F2 — Q3-B with Q4-B against ADR-045.** Asked: *on 2026-09-29 (Q25) a named-people event was made
invisible even to the creator's own team. Opened to guests under Q3-B, anyone with the link reads it,
with the attendee names of Q4-B. A: yes — opening to guests overrides scope; a new ADR says it
overrides ADR-045 decision 3. B: any event may be opened, but names show on the public page only for
public-scope events.* **Answer: "A Đúng vậy".**

**F3 — whether "everyone" includes people outside.** A: yes, the public page lists guests' names
beside members'; B: no, only signed-in members see guests' names. **Answer: "A có".**

## Impact if ignored

Guests are counted outside the product, so an event with a capacity of 30 can be full in the
product and over-full in reality, and the attendee list a creator prints is not the list of who is
coming.

## Constraints already known

- **This changes what the product is**: today it has no page an unauthenticated person can read and
  no row an unauthenticated person can write. Q1 is the operator's agreement in words.
- **It overrides ADR-045 decision 3 for an event opened to guests** (Q3-B, F2-A): anyone holding the
  link reads the event and its attendee list, whatever the event's scope — including a named-people
  event that the creator's own team cannot read inside the product. F2 is the operator choosing that
  in words, against a question that quoted Q25.
- **Employee and guest names reach the internet** on an opened event (Q4-B, F1, F3-A). **Guest email
  never does**: it is readable by the event's creator and by admins only (F1). Member email is not
  shown anywhere on the public page — nothing asked for it.
- **ADR-005 stands: no server** (Q7-A). The anonymous read and the anonymous write are row-level
  security over the anon key, which `.ai/standards/rbac-and-security.md` already calls *"the only"*
  line of defence. The fence is that an anonymous caller reaches **only** an event opened to guests,
  and only through its link — never `public.member`, entries, or any other event.
- **A guest is not a member.** No account, no `public.member` row, no team; INV-04, INV-05 and INV-07
  are not engaged, and a guest never enters an absence count.
- **Guests follow the event's own rules** (Q5-A): they take seats, wait for approval when the event
  requires it, and are refused after the deadline or at capacity — `EVT-02`'s concurrency guarantee
  must hold with guests in the race.
- **Spam control is in the database only** (Q7-A): one registration per email per event, plus
  capacity and deadline. No captcha.
- **Guest data is kept indefinitely** (Q8, *"Không xóa data"*).
- **The link is unguessable, not listed, not indexed** (Q9-A).

## Out of scope

- **A captcha or any server-side check** (Q7).
- **A listing of opened events**, and search-engine indexing (Q9).
- **A separate guest capacity** (Q5).
- **Emailing a guest their manage link** — Q6-C, a later ticket once `EVT-05` exists. This idea's
  guest manages through the on-screen link only.
- **Deleting or exporting guest data** (Q8).
- **A guest becoming a member**, or a guest's registration carrying over to another event.

## Open questions

None the operator owns. Assumptions this file made rather than asked, each cheap to reverse and each
PLAN's to overrule:

1. **An admin can open or close any event to guests**, as they can edit any event (ADR-045 decision 5).
2. **Closing an event to guests keeps the guests already registered**; the link stops working, and a
   guest's own manage link keeps working.
3. **A guest is identified by name and email only**; the email's format is checked, its ownership is
   not — there is no email to verify it with until `EVT-05`.
4. **A lost manage link is lost**; the creator or an admin can remove the guest.
5. **The public page is English**, matching the UI, and follows `CLAUDE.md` § *Visual direction*.
6. **When `EVT-04` exists, the creator is notified in the app of a guest's request**, as for a member's
   (its type (e)).

# Triage verdict — PROMOTE, as `EVT-06` then `EVT-07`

`product` at /triage, 2026-10-08.

**Not REJECT.** Nothing in the product admits a person without an account to any event.

**Changing the envelope, signed by the operator.** The idea overrides ADR-045 decision 3 and gives the
anon role its first read and its first write. § *Evidence* Q1 and F2 are the operator choosing both in
words, F2 against a question that quoted the 2026-09-29 Q25 it overrides. So
[ADR-052](../../registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md) is
`ACCEPTED by the operator`, with both quotes in its Status, and a note was added to ADR-045. ADR-005
stands — Q7-A keeps the server out.

**Two rows, split here and not at PLAN (MD-017).** `EVT-06` is the anonymous **read**: opening an event,
its link, the public page with attendee names. `EVT-07` is the anonymous **write**: registration, the
manage link, guest email visibility. They are different exposures with different revert conditions,
and a reviewer should judge each alone. `EVT-07` `depends_on: [EVT-06]`.

**Neither depends on `EVT-04` or `EVT-05`.** Q6-C, emailing the manage link, is out of scope here and a
later idea on top of `EVT-05`.

**Stated for the record, because it is the largest exposure the product has decided:** on an opened
named-people event, member names reach anyone with the link while the creator's own team cannot read
the event inside the product; and guest data is never deleted.

**What this verdict wrote:** ADR-052; a Status note on ADR-045; the `EVT-06` and `EVT-07` rows,
`PLANNED`; both ticket shells at `BACKLOG`; rows 4 and 5 of `## BACKLOG`. `glossary_owed`:
`[Guest link]` on `EVT-06`, `[Guest]` on `EVT-07`.
