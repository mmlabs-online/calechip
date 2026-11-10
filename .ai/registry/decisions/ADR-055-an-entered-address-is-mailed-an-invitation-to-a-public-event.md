---
doc_version: 3
last_updated: 2026-10-12
governed_by: [RULE-01, RULE-09]
---

# ADR-055 — A creator or an admin may mail an invitation to any address for a public event

## Status

`ACCEPTED by the operator` — 2026-10-12, in words, at `/idea` of
`.ai/board/ideas/2026-10-12-a-person-outside-the-product-learns-of-a-public-event-only-by-a-forwarded-link.md`
§ *Evidence*. Drafted by `product` at `/triage` of that file, 2026-10-12T09:35:14Z, from a technical
half supplied by `tech-lead-design`, consulted and writing nothing.

**Recorded, not authored.** The operator was shown the decision as one sentence, with the two
ADR-051 decisions it amends named by number, and confirmed it. The question and the answer, verbatim
from F1:

> *"Creator hoặc admin có thể nhập email bất kỳ cho một event public; việc nhập tự mở event cho guest
> (kể cả mở lại nếu đã đóng); mỗi địa chỉ nhận một mail mời có guest link, hoặc có link trong app nếu
> là member. Điều này sửa ADR-051 quyết định 2 (gửi cho người không đọc được event) và quyết định 4
> (có mail cho event public, nhưng chỉ tới địa chỉ được nhập); các phần khác của ADR-051/052/053 giữ
> nguyên." Đúng ý anh/chị không?*
>
> **"A: Đúng"**

Q1 carries the direction it confirms — **"A: Guest link"**. Every other clause below is an answer in
the same § *Evidence*, cited where it is used.

**Amends [ADR-051](ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md)
decisions 2 and 4** — the operator's, F1.

**Amends the letter of
[ADR-053](ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md)
decisions 2 and 3, and not its substance — this part is `product`'s, not the operator's.** Decision 2
names `public.notification` as the only table whose trigger posts to the function; decision 3 says
every row the function is handed is *"already addressed to someone who can read the event"*. Neither
sentence survives an invitation to an outsider as written. ADR-053 is `ACCEPTED by tech-lead-design`,
so amending its letter is inside the agent envelope (RULE-09, ADR-008), and it is named here so that
nobody reads F1's *"các phần khác của ADR-051/052/053 giữ nguyên"* as a claim that ADR-053's text is
untouched. **What ADR-053 protects holds unchanged:** the database calls the function and nothing else
does; the function authorizes nothing, reads nothing and holds no database credential; the database
decides every recipient. The operator reviews this paragraph at merge (CODEOWNERS).

[ADR-052](ADR-052-an-event-can-be-opened-to-guests-without-an-account.md) stands in full. Its
decision 1 already lets the creator open any event, and assumes an admin may too; opening by inviting
adds no new opener.

## Context

- ADR-051 decision 2: the sender mails *"never to someone who cannot read the event"*. Decision 4:
  email is **not** sent for public events.
- ADR-052 lets a creator open any event to guests through an unguessable link (`EVT-06`), and lets a
  guest register with a name and an email (`EVT-07`). Nothing in the product tells anyone the link
  exists; the creator copies it and sends it by hand, outside the product.
- ADR-053: one Edge Function, `send-event-email`, posted to by an `after insert` trigger on
  `public.notification` through `pg_net`; the request carries everything the message needs; mail leaves
  from the shared Gmail account `didi00889900@gmail.com`, whose daily limit is the product's.
- The operator asked: *"Khi tạo event public cho phép user nhập email cụ thể để gửi mail thông báo mời
  event"*, and answered twelve questions and two confirmations at `/idea` on 2026-10-12.

## Decision

1. **The creator of a public-scope event, or an admin, may enter any email addresses as invitees**
   (Q2-A *"Chỉ public"*, Q4-A *"Creator (mọi member)"*, Q10-A *"Creator + admin"*) — while creating
   the event and afterwards from its detail page (Q3-B *"Lúc tạo và về sau"*). Team-scope and
   named-people events accept none.
2. **Entering an address opens the event to guests** if it is not already open, reopening it if it
   was closed (F1 *"kể cả mở lại nếu đã đóng"*). This is ADR-052 decision 1's opening, reached by a
   new path.
3. **Each address is mailed at most once per event** (Q11-A *"Một lần mỗi event"*). A repeat is
   ignored, and the inviter is told which addresses were sent and which were ignored — **never which
   addresses belong to members** (ADR-045 decision 4, the idea's § *Constraints*).
4. **The database decides which version an address receives.** An address that is not an approved
   member's receives the guest-link invitation (Q1-A). An address that is an approved member's
   receives a member version linking into the app, and only if that member has event email switched on
   (Q6-B *"Gửi bản cho member"*, `member.event_email_enabled`).
5. **ADR-051 decision 2, amended:** mail may reach an address that cannot read the event inside the
   product, **only** where that address was entered under decision 1 of this ADR, for a public event,
   and the mail carries that event's guest link. Every other rule of ADR-051 decision 2 stands.
6. **ADR-051 decision 4, amended:** a public event now has mail — **only** to addresses entered under
   decision 1. A public event still mails nobody on creation, edit, deletion, join request or
   withdrawal.
7. **ADR-053 decisions 2 and 3, amended in letter:** an `after insert` trigger on the table of invited
   addresses posts to the same function through `pg_net`, with a request shape of its own. The
   function still reads nothing and holds no database credential; the request carries everything the
   message needs; the authorization of the inviter and the choice of version happen in the database
   before the row exists. ADR-053 decisions 1, 4, 5 and 6 stand as written — one function, a shared
   secret, Gmail SMTP on 465, a failed send logged and never retried.
8. **The invited list is readable by the event's creator and by admins only, and is kept
   indefinitely** (Q9-A *"Creator + admin, giữ mãi"*), on the terms of ADR-052 decisions 7 and 8.
9. **No cap** on invitations (Q5-B *"Không giới hạn"*), **no unsubscribe** for an outside address
   (Q7-A *"Không"*), **no further mail** when the event is edited, deleted, closed to guests or moved
   off public (Q12-A *"Không gửi gì thêm"*). An event that is no longer public accepts no new
   invitations; its guest link stays as it is.
10. **English, on a designed template** (F2-A *"Tiếng Anh, template đẹp"*), as ADR-051 decision 6.

## Rationale

**Rejected: a sign-up link into CaleChip instead of the guest link** — Q1-B, offered and not chosen.
It would have left ADR-051 decision 2 intact, at the price of asking every outsider to create an
account to attend one event.

**Rejected: admins only** (Q4-B) **and creator plus admin at creation** (Q4-C) — offered with the risk
stated: any member can mail any address from the shared account. Not chosen.

**Rejected: a per-event cap** (Q5-A) — offered with the shared-quota consequence stated. Not chosen.

**Rejected: send the outsider version to a member's address** (Q6-A) — a member could register as a
guest and be counted twice. **Rejected: skip it and tell the creator** (Q6-C) — telling the creator is
exactly the membership disclosure decision 3 forbids.

**Rejected, technically: a second Edge Function for invitations.** ADR-053 decision 1 makes
`send-event-email` the product's only server-side code; a second one is a second secret and a second
deployment for the same job.

**Rejected, technically: the function resolves member versus outsider itself.** That needs a
database credential in the one component ADR-051 says authorizes nothing — ADR-053's own rejected
alternative, for the same reason.

**Rejected, technically: the browser asks the function to send.** ADR-051 decision 3 forbids it.

## Consequences

- **Any member can mail any address from the shared Gmail account**, with no cap and no unsubscribe.
  That is decided (Q4-A, Q5-B, Q7-A). What it risks: one large or careless invitation uses up the
  day's quota and `EVT-05` mail for that day is lost (ADR-053 § *Consequences*); and complaints from
  recipients can get the account limited or suspended, **which stops all event email**, not only
  invitations.
- **Mail reaches people who never agreed to the product's terms, and their addresses are kept with
  no deletion path** — the same exposure ADR-052 accepted for guests, now for people who never chose
  to register.
- **Membership must not leak through the invitation path.** The inviter's response, and anything the
  inviter can read, must be identical for a member's address and an outsider's. It is the easiest
  property here to break by accident — an error message, a count, a different status — and it is a
  revert condition.
- **The function gains a second caller-shaped input** — a second trigger and a second request shape.
  The shared secret and the "reads nothing" property are what keep that safe; neither changes.
- **ADR-051 revert condition 2** — *"An email reaches someone who cannot read the event"* — now
  excludes an address entered under decision 1 for a public event. Read literally after this ADR it
  would fire on every outside invitation.
- **Who holds the Gmail account is still not recorded** (ADR-053 § *Consequences*), and this ADR
  raises what that person can see: every reply and bounce from outside addresses.

## Revert condition

Any one occurrence:

1. **The inviter can tell, from any response or any read, whether an entered address belongs to a
   member.** On observation: disable invitations until fixed.
2. **An invitation is mailed for an event that is not public, or entered by someone who is neither the
   event's creator nor an admin.** On observation: disable invitations until fixed.
3. **An invited address is read by anyone but the event's creator or an admin.** On observation:
   revoke the read until the policy is fixed — ADR-052 revert condition 2's shape.
4. **The Gmail account is limited or suspended, or a day's `EVT-05` mail is lost, because of
   invitation volume.** On observation: the operator decides between a cap (Q5-A) and withdrawing
   invitations for members; this ADR is not reverted silently.

ADR-051's and ADR-053's revert conditions apply on top, with ADR-051 condition 2 read as amended
above.

## Affected documents

- `.ai/registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md`
  — a Status note on decisions 2 and 4. Text unchanged.
- `.ai/registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md`
  — a Status note on decisions 2 and 3. Text unchanged.
- `.ai/registry/features.md` — the `EVT-08` and `EVT-09` rows cite this ADR.
- `.ai/registry/glossary.md` — *Email invitation*, owed under ADR-047 and written at `/plan` of
  `EVT-08`. Distinct from the existing *Invitation*, which names a person on a named-people event.
- `.ai/standards/data-model.md`, `.ai/standards/rbac-and-security.md` — the invited-address table, its
  read rule, the invite function and the trigger. Written at `/plan` of `EVT-08`.
