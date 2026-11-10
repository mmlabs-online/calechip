---
stage: TRIAGE
agent: product
produced_at: 2026-10-12T09:28:34Z
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md
  - .ai/registry/features.md
  - .ai/templates/idea.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md
  - .ai/registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md
  - .ai/registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md
  - .ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md
  - .ai/board/ideas/2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - supabase/migrations/20261009150000_evt07_guest_registration.sql
  - .claude/commands/triage.md
  - .ai/registry/decisions/ADR-000-template.md
  - .ai/registry/glossary.md
  - .ai/templates/ticket.yaml
  - .ai/board/backlog.md
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: "PROMOTE"
verdict_reason: "Worth building and not covered: no event can invite anyone by email, and a public event mails nobody. It amends ADR-051 decisions 2 and 4, which the operator confirmed in words (F1 \"A: Đúng\"), so ADR-055 is ACCEPTED by the operator; it amends ADR-053 decisions 2 and 3 in letter, inside the agent envelope. Split by surface: the detail page and the pipe, then the create form."
ticket_id: "EVT-08, EVT-09"
awaiting_adrs: []
operator_request: "Khi tạo event public cho phép user nhập email cụ thể để gửi mail thông báo mời event"
---

# A person outside the product learns of a public event only by a forwarded link

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

*`/triage` wrote its verdict below on 2026-10-12; the sentence above is left as `/idea` wrote it.*

## Problem

*Derived from the request above; the operator stated a solution, not a problem.*

Since `EVT-06` a public event can be opened to guests, but the product never tells anyone that the
event exists. The creator has to copy the guest link and send it to each outside person themselves,
by hand and outside the product. `EVT-05` sends no mail for public events (ADR-051 decision 4), and
ADR-051 decision 2 forbids mailing anyone who cannot read the event, which today covers every person
without an account. So a creator who knows exactly whom they want at a public event cannot invite
them from the product, whether those people have an account or not.

## Who has it

Any member who creates a public event and wants specific people at it, every time they do. Also
the invitees: outside people who hear about it through a forwarded message, and members, who get no
email for a public event.

## Evidence

The operator's request, verbatim above. On 2026-10-08 (idea
`2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md`, Q6-C) the operator had already
deferred emailing guests to "a later ticket on top of `EVT-05`". This idea is a different mail from
that one; see Q8.

Asked at `/idea` on 2026-10-12. Each answer is the option label the operator picked, verbatim.

**Q1: where the invitation leads.** Asked: *Người nhận nằm ngoài hệ thống. ADR-051 quyết định 2 hiện
cấm gửi mail cho người không đọc được event, mà event public thì chỉ member đã duyệt mới đọc được.
Mail mời sẽ dẫn họ tới đâu?* A: guest link. Entering an email opens the event to guests (EVT-06) and
the mail carries the guest link. Needs a new ADR amending ADR-051 decisions 2 and 4. B: a sign-up
link into CaleChip, with no anon access involved. C: the idea stops.
**Answer: "A: Guest link".**

**Q2: which scopes.** A: public only; B: every scope (ADR-052 allows any scope to be opened).
**Answer: "A: Chỉ public".**

**Q3: when emails are entered.** A: only while creating; B: while creating and later, from the event
detail page (one more surface and one more permission).
**Answer: "B: Lúc tạo và về sau".**

**Q4: who may enter emails.** The mail leaves from the shared Gmail account `didi00889900@gmail.com`
(ADR-053). A: the creator, i.e. any member, with the stated risk that a member can mail any address
from the shared account; B: admins only; C: creator + admin.
**Answer: "A: Creator (mọi member)".**

**Q5: a limit.** Gmail caps the account at roughly 500 mails a day, shared with `EVT-05`. A: a cap
per event, rejected above it; B: no cap, so a large event can use up the day's quota and `EVT-05`
mail is lost.
**Answer: "B: Không giới hạn".**

**Q6: an entered email that belongs to a member.** A: send the outsider mail anyway (the member may
register as a guest and be counted twice); B: the database recognises the member's email and sends a
member version linking into the app, respecting their event-email switch (EVT-05); C: skip it and
tell the creator.
**Answer: "B: Gửi bản cho member".**

**Q7: unsubscribe for outside recipients.** A: none, nothing built, and a person can be invited again
and again; B: an unsubscribe link that blocklists the address (a new anon write and a page).
**Answer: "A: Không".**

**Q8: also mail the guest's manage link (EVT-07 Q6-C)?** A: no, keep it separate; B: fold it in.
**Answer: "A: Không, để riêng".**

**Q9: who sees the invited list, and how long it is kept.** A: creator + admin, kept forever (as guest
emails, ADR-052 decisions 7 and 8); B: creator + admin, deleted after the event (needs a scheduled
job the product does not have); C: everyone who can read the event.
**Answer: "A: Creator + admin, giữ mãi".**

**Q10: who may invite more later (Q3-B).** A: creator + admin (admin edits any event, ADR-045
decision 5); B: creator only.
**Answer: "A: Creator + admin".**

**Q11: the same email entered again for the same event.** A: once per event, a repeat is ignored;
B: a repeat re-sends.
**Answer: "A: Một lần mỗi event".**

**Q12: after invitations, the event is edited, deleted, closed to guests, or moved off public.** A:
nothing more is sent, as EVT-05. A sent link dies if the guest link closes or the event is deleted.
An event no longer public accepts no new invitations, and its guest link stays open. B: mail the
invitees on cancellation or a date change.
**Answer: "A: Không gửi gì thêm".**

**F1: confirming the ADR.** Asked, verbatim: *"Creator hoặc admin có thể nhập email bất kỳ cho một
event public; việc nhập tự mở event cho guest (kể cả mở lại nếu đã đóng); mỗi địa chỉ nhận một mail
mời có guest link, hoặc có link trong app nếu là member. Điều này sửa ADR-051 quyết định 2 (gửi cho
người không đọc được event) và quyết định 4 (có mail cho event public, nhưng chỉ tới địa chỉ được
nhập); các phần khác của ADR-051/052/053 giữ nguyên." Đúng ý anh/chị không?*
**Answer: "A: Đúng".**

**F2: language.** A: English on a designed template, as EVT-05; B: Vietnamese; C: bilingual.
**Answer: "A: Tiếng Anh, template đẹp".**

## Impact if ignored

Creators keep sending guest links by hand through chat. The people they forget never hear of the
event. Members named for a public event get no mail, because `EVT-05` excludes public events.

## Constraints already known

- **A new ADR is owed, and F1 is its operator acceptance in words.** It amends ADR-051 decision 2
  (mail may reach an address that cannot read the event inside the product) and decision 4 (mail for
  a public event, only to an entered address). ADR-051 decisions 1, 3, 5, 6 and 7, all of ADR-052
  and all of ADR-053 stand: one Edge Function, which authorizes nothing, is never called by the
  browser and reads no database. The database decides every recipient.
- **ADR-052 decision 1 already lets the creator open any event**, so opening one by inviting
  (F1: *"kể cả mở lại nếu đã đóng"*) adds no new opener. Admins may too (Q10).
- **ADR-052 decision 7: guest emails are readable by the creator and admins only.** Invited
  addresses follow the same rule (Q9-A), and decision 8 (never deleted) applies to them too.
- **EVT-05's event-email switch** (`member.event_email_enabled`) governs the member version (Q6-B).
  An outsider has no switch (Q7-A).
- **ADR-053 § Consequences: the Gmail account's daily limit is the product's.** With no cap (Q5-B),
  one large invitation can use up the day's quota for `EVT-05` mail too. Decided, and recorded so it
  is not a surprise.
- **Recognising a member's email (Q6-B)** reads `public.member` emails inside the database only. No
  member's existence or email may be revealed to the person inviting (ADR-045 decision 4, ADR-018).
- INV-04, INV-05 and INV-07 are not engaged. An invitation is not an entry, and an invitee is not
  counted anywhere until they register.

## Out of scope

Each item was decided against at `/idea`:

- **Invitations for team or named-scope events** (Q2-A).
- **A cap on the number of invitations** (Q5-B).
- **Unsubscribe or a blocklist for outside addresses** (Q7-A).
- **Emailing a guest their manage link** (Q8-A). That is still EVT-07 Q6-C's later ticket.
- **Deleting or exporting the invited list** (Q9-A).
- **Re-sending an invitation** to an address already invited for that event (Q11-A).
- **Mail on edit, deletion, closing to guests, or a change of scope** (Q12-A).
- **A sign-up link** into the product instead of the guest link (Q1-B).
- Pre-registering an invitee, or tracking whether they opened the mail.

## Open questions

None the operator owns. Assumptions this file made rather than asked, each cheap to reverse and each
PLAN's to overrule:

1. **The email's format is checked and its ownership is not**, as for guests (EVT-07).
2. **The creator sees which entered addresses were sent and which were ignored as already invited**
   (Q11-A). The creator does **not** see which addresses belong to members (see *Constraints*).
3. **A failed send is logged and never retried**, per ADR-053 decision 6.
4. **The invitation names the event, its dates and the creator's display name.** Its content and
   layout are `tech-lead-design`'s, under `CLAUDE.md` § *Visual direction*.
5. **The member version (Q6-B) is never sent to the person who entered it.** This matches ADR-050's
   "never to the actor".

# Triage verdict — PROMOTE, as `EVT-08` then `EVT-09`

`product` at /triage, 2026-10-12T09:35:14Z. `tech-lead-design` was consulted for the technical half
and wrote nothing.

**Not REJECT.** Nothing in the product lets anyone invite a person to an event by email, and a public
event mails nobody (ADR-051 decision 4). `EVT-05` and `EVT-06` are the parts this is built on, not a
cover for it.

**Changing the envelope, signed by the operator.** The idea amends ADR-051 decisions 2 and 4.
§ *Evidence* F1 is the operator confirming exactly that, against a question that named both decisions
by number. So
[ADR-055](../../registry/decisions/ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md)
is `ACCEPTED by the operator`, with F1 quoted in its Status, and a Status note was added to ADR-051.

**One part of ADR-055 is not the operator's, and it is named rather than folded in.** It also amends
the letter of ADR-053 decisions 2 and 3: the trigger is no longer on `public.notification` only, and
an invitation row is not *"already addressed to someone who can read the event"*. F1 told the operator
*"các phần khác của ADR-051/052/053 giữ nguyên"*. ADR-053 is `ACCEPTED by tech-lead-design`, so its
letter is inside the agent envelope (ADR-008), and what it protects is unchanged — the database calls
the function, the function authorizes nothing, reads nothing and holds no credential. A Status note
was added to ADR-053. The operator sees it at merge.

**Two rows, split by surface here and not at PLAN (MD-017).** `EVT-08` is the event detail page and
the whole pipe: the invited-address table, the definer function, the trigger, the new request shape
and template in `send-event-email`, the member version, and the invited list for creator and admin.
`depends_on: [EVT-05, EVT-06]`. `EVT-09` is the same field on the create-event form, adding a surface
and no behaviour. `depends_on: [EVT-08]`.

**Assumptions handed to PLAN, not decided here:**

1. **An entered address matches a member's email case-insensitively.**
2. **A pending or removed member's address is treated as an outsider's** — only an approved member
   gets the member version.
3. **No per-request cap either** — Q5-B decided no cap per event, and this reads it as no cap per
   submission too.

The five assumptions in § *Open questions* above stand as PLAN's to overrule.

**What this verdict wrote:** ADR-055; Status notes on ADR-051 and ADR-053; the `EVT-08` and `EVT-09`
rows, `PLANNED`; both ticket shells at `BACKLOG`; rows 1 and 2 of `## BACKLOG`. `glossary_owed`:
`[Email invitation]` on `EVT-08` — distinct from the existing *Invitation* — and `[]` on `EVT-09`.
