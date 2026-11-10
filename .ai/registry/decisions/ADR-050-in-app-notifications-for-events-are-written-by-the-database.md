---
doc_version: 3
last_updated: 2026-10-08
governed_by: [RULE-01, RULE-09]
---

# ADR-050 — In-app notifications for events are rows the database writes, to people who can read the event

## Status

`ACCEPTED by product` — 2026-10-08, at `/triage` of
`.ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md`.

**Inside the envelope, so accepted by the agent (RULE-09, ADR-008).** ADR-005 stands unchanged: no
server is added, and authorization stays in row-level security. Every behavioural clause below is the
operator's answer in that idea's § *Evidence*; what this ADR adds is the mechanism, which is the schema
change RULE-09 requires an ADR for before the ticket exists. The operator reviews it at merge.

## Context

- A person learns of an invitation, a decision on their join request, or a change to an event only by
  opening `/events` or `/events/:id`, and a creator learns of a join request the same way (the idea's
  § *Problem*).
- The operator chose five in-app notification types (Q2 *"a đến e, bỏ f"*): (a) a new event for my
  team or public; (b) invited by name; (c) my request approved, rejected or removed; (d) an event I
  take part in edited or cancelled; (e) the creator learns of a join request or a withdrawal.
- All five are caused by a write a user makes to `public.event` or its attendance. None needs a
  clock.
- ADR-045 decision 3 bounds who may read an event; ADR-005 puts authorization in row-level security
  with no server.

## Decision

1. **A notification is a row in a new table**, one per recipient, carrying its kind, the event it is
   about, who caused it, when, and whether it has been read. The exact columns are `tech-lead-design`'s
   at `/plan`.
2. **The database writes them**, from triggers on the writes that cause (a)–(e). No client inserts a
   notification for somebody else, and no server writes one.
3. **A recipient is only ever a person who can read the event under ADR-045 decision 3** at the moment
   the notification is written. A notification never discloses an event to someone who could not open
   it.
4. **A person reads and marks read their own notifications, and nobody else's** — row-level security,
   keyed on the recipient. No role, admin included, reads another person's notifications.
5. **The actor is not notified of their own action.**
6. **No reminders** (Q2-f): nothing is written on a schedule, so no scheduler is added.

## Rationale

**Rejected: the client writes the notifications** after each action. It would need an insert policy
letting one person write rows addressed to another, which is the exact hole ADR-005's model exists to
avoid, and a client that crashed between the action and the notification would lose it silently.

**Rejected: derive notifications on read** from the event and attendance tables with no stored row.
No table means no *read* state, so there is no unread count and no *mark all read*, and an event
deleted since leaves nothing to say it was cancelled.

**Rejected: a server-side writer**, the shape ADR-051 admits for email. ADR-051 limits that component to
sending mail; letting it also write in-app rows would make in-app depend on the email ticket and on a
provider the operator does not yet have (Q6).

## Consequences

- **A new table, its policies and triggers on the event and attendance tables** — a migration that
  touches triggers, so `schema_delta` is not `none` (ADR-014).
- **Every write that fires (a)–(e) costs one insert per recipient.** A public event (a) writes a row
  for every approved member of every team. That is the operator's Q3 choice for in-app, and the count
  grows with the product.
- **A deleted event's notifications must survive its deletion**, so the reference to the event cannot
  cascade-delete them. How that is held is PLAN's.
- **Retention is a decision PLAN states** — the idea assumes 90 days. Nothing deletes rows on a
  schedule (decision 6), so pruning, if any, rides an existing write.

## Revert condition

Either, one occurrence:

1. **A person receives a notification about an event they cannot read**, in the running system or in
   a test. On observation: stop the triggers writing (a) and (b); (c)–(e) are about events the person
   already took part in.
2. **A person reads another person's notification.** On observation: revoke `select` on the table
   until the policy is fixed.

## Affected documents

- `.ai/registry/features.md` — the `EVT-04` row cites this ADR.
- `.ai/standards/data-model.md` and `.ai/standards/rbac-and-security.md` — the new table and its rows.
  Written at `/plan` of `EVT-04`, which puts both in `allowed_paths`.
- `.ai/registry/glossary.md` — *Notification*, owed by `EVT-04` (ADR-047).
