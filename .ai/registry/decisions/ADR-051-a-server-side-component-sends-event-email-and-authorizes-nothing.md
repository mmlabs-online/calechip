---
doc_version: 3
last_updated: 2026-10-08
governed_by: [RULE-01, RULE-09]
---

# ADR-051 — A server-side component sends event email, and authorizes nothing

## Status

`ACCEPTED by the operator` — 2026-10-08, in words, at `/idea` of
`.ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md` § *Evidence*.
Drafted by `product` at `/triage` of that file.

**Decisions 2 and 4 amended 2026-10-12 by [ADR-055](ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md)**, `ACCEPTED by the operator`: the creator or an admin of a public event may enter any address, and each is mailed one invitation carrying the guest link, or an in-app link if it is a member's. Mail for a public event goes only to entered addresses. Revert condition 2 is read as excluding those addresses. The text below is left as written.

**Recorded, not authored.** The operator was told that email needs something running server-side,
shown the clause of ADR-005 it reverses, and offered two branches. The question and the answer,
verbatim from Q5:

> *Email needs something running server-side. A new ADR would say "a server-side component exists
> only to send mail and is never used for authorization; RLS stays the only authorization
> mechanism". A: agree. B: no — in-app only, email dropped.*
>
> **"a"**

**Amends [ADR-005](ADR-005-authorization-in-rls.md)** — its *"No server-side API is written"* — and
**[ADR-045](ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md) decision 6**, *"ADR-005 stands.
No server, no email (Q20)"*. Everything else in both stands, ADR-005's authorization model above all.

## Context

- ADR-005: *"Supabase Auth provides authentication. Row-level security provides authorization, and
  is the only mechanism that enforces it. No server-side API is written."*
- A browser holding the anon key cannot send email without exposing a provider's secret, so mail needs
  a component that runs where the secret can be kept.
- On 2026-09-29 the operator split email out of `EVT-01`/`EVT-02` (Q20 *"Tách thành ticket sau"*)
  and chose when it is sent (Q21). Today they confirmed that list (Q1 *"đúng"*), narrowed it to exclude
  public events (Q3 *"b"*), chose a single opt-out (Q4 *"a"*), English with a designed template
  (Q8), and have **no provider, key or sending domain yet** (Q6 *"chưa có"*).

## Decision

1. **One server-side component exists, and its whole job is sending event email.** The mechanism —
   a Supabase Edge Function invoked by a database webhook, `pg_net` from a trigger, or another — is
   `tech-lead-design`'s at `/plan` of `EVT-05`.
2. **It authorizes nothing.** It never decides who may read, write or see anything; row-level
   security remains the only enforcement, as ADR-005 says. It sends mail to recipients the database
   has already determined, under the same rule as ADR-050 decision 3: never to someone who cannot
   read the event.
3. **It is not an API.** Nothing in the browser calls it to read or write product data.
4. **Email is sent for** a new event scoped to the recipient's own team, being invited by name, and a
   join request approved, rejected or removed (Q1, narrowed by Q3). **Not** for public events, edits,
   deletions, join requests or withdrawals.
5. **A member can switch all event email off with one control** (Q4-A). The switch never affects
   in-app notifications.
6. **English, on a designed template** (Q8) that follows `CLAUDE.md` § *Visual direction*.
7. **The provider, the key holder and the sending domain are the operator's**, and are not chosen here
   (Q6). `EVT-05` cannot pass PLAN until they exist.

## Rationale

**Rejected: no email** — branch B of Q5, offered and not chosen.

**Rejected: a general server** that the client calls for data. That would move authorization out of
row-level security, which is what ADR-005 protects and the operator did not agree to change.

**Rejected: Supabase Auth's own mailer.** It sends authentication email only and cannot be pointed at
product events.

## Consequences

- **The product has a server-side runtime for the first time**, with a secret in it. Deploying it is a
  new manual step beside `pnpm build` (`CHANGELOG.md` § v1.0.0), and RULE-09 keeps it human.
- **A provider costs money or quota**, and its account belongs to somebody. That is Q6, open.
- **DNS records (SPF, DKIM) on a domain the operator controls** are needed before mail is delivered
  rather than filed as spam.
- **A send can fail after the action that caused it succeeded.** The action is never rolled back for
  a failed email; whether a failure is retried or only logged is PLAN's.
- **The opt-out is a new member column** — a schema change on `public.member`, whose write grants are
  fenced (TEA-04, TEA-10). PLAN states the grant.

## Revert condition

Either, one occurrence:

1. **The component is used to authorize anything, or the browser calls it to read or write product
   data.** On observation: remove the call; this ADR's decision 2 or 3 has been broken.
2. **An email reaches someone who cannot read the event, or someone who switched email off.** On
   observation: disable the sender until fixed. In-app is unaffected.

## Affected documents

- `.ai/registry/decisions/ADR-005-authorization-in-rls.md` — a Status note naming this ADR. Text
  unchanged.
- `.ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md` — a Status note on
  decision 6. Text unchanged.
- `.ai/registry/features.md` — the `EVT-05` row cites this ADR.
- `.ai/standards/tech-stack.md` — the server-side runtime and the provider, once Q6 is answered.
  Written at `/plan` of `EVT-05`.
- `.ai/standards/data-model.md`, `.ai/standards/rbac-and-security.md` — the opt-out column and its
  grant. Written at `/plan` of `EVT-05`.
