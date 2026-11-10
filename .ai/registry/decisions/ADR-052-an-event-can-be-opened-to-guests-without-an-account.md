---
doc_version: 3
last_updated: 2026-10-08
governed_by: [RULE-01, RULE-09]
---

# ADR-052 — An event can be opened to guests without an account, through an unguessable link

## Status

`ACCEPTED by the operator` — 2026-10-08, in words, at `/idea` of
`.ai/board/ideas/2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md` § *Evidence*.
Drafted by `product` at `/triage` of that file.

**Recorded, not authored.** Two of the operator's answers carry this ADR, verbatim:

> **Q1.** *The product gains a page anyone on the internet can read, and people without an account
> can write to the database — a new ADR. A: agree. B: no — the idea stops.* — **"A"**
>
> **F2.** *On 2026-09-29 (Q25) a named-people event was made invisible even to the creator's own team.
> Opened to guests under Q3-B, anyone with the link reads it, with the attendee names of Q4-B. A: yes
> — opening to guests overrides scope; a new ADR says it overrides ADR-045 decision 3. B: any event may
> be opened, but names show on the public page only for public-scope events.* — **"A Đúng vậy"**

Every other clause below is an answer in the same § *Evidence*, cited where it is used.

**Overrides [ADR-045](ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md) decision 3 for an
event opened to guests, and nothing else of it.** [ADR-005](ADR-005-authorization-in-rls.md) stands:
no server is added (Q7-A).

## Context

- Today no page is readable, and no row is writable, without signing in. ADR-045 decision 3 bounds
  every event read to approved members, and the 2026-09-29 Q25 made a named-people event invisible
  even to its creator's team.
- `.ai/standards/rbac-and-security.md`: the anon key ships in the bundle by design, and *"Row-level
  security is not the last line of defence. It is the only one."*
- The charter's *"Who uses it. One team of five to thirty people"* is already stale (ADR-045
  § *Context*); this ADR does not repair it either.

## Decision

1. **An event's creator, any member, may open it to guests** (Q2-A); **any event, whatever its scope**
   (Q3-B). Assumed, not asked: an admin may too, as they edit any event (ADR-045 decision 5).
2. **Opening it creates an unguessable link.** Nothing lists opened events and nothing is indexed
   (Q9-A). Closing it stops the link; guests already registered stay.
3. **Anyone holding the link reads the event and its attendee list** — members' names and guests'
   names (Q4-B, F1, F3-A) — **overriding ADR-045 decision 3 for that event** (F2-A). Nothing else is
   readable through it: no other event, no `public.member` row beyond a name, no entry.
4. **A guest registers with a name and an email**, no account (the request). A guest takes a seat and
   follows the event's capacity, approval mode and deadline exactly as a member does (Q5-A).
5. **One registration per email per event**, plus capacity and deadline, is the whole of spam control.
   No captcha, no server (Q7-A).
6. **A guest manages their registration through a secret link shown once on screen** — status and
   cancel (Q6-B). Emailing that link is a later ticket on top of `EVT-05` (Q6-C).
7. **A guest's email is readable by the event's creator and by admins only** (F1). Names are readable
   by everyone who can read the event (F1, F3-A).
8. **Guest data is kept indefinitely** (Q8, *"Không xóa data"*).
9. **A guest is not a member** — no account, no team, never in an absence count. INV-04, INV-05 and
   INV-07 are not engaged.

## Rationale

**Rejected: no guests** — Q1 branch B, offered and not chosen.

**Rejected: public-scope events only** (Q3-A) and **no attendee list on the public page** (Q4-A) —
both offered with the exposure stated, and neither chosen. F2 restated the combined consequence for a
named-people event and the operator confirmed it.

**Rejected: a captcha** (Q7-B) — it needs a server-side verifier, and ADR-051 limits the only
server-side component to mail.

**Rejected: an admin approves each opening** (Q2-C) — offered, not chosen.

## Consequences

- **The anon role gains its first read and its first write.** The fence is that both reach only an
  event that is opened *and* addressed by its link token; a policy that tested only "opened" would
  make every opened event enumerable. The exact shape — likely `security definer` functions taking
  the token, ADR-040's pattern — is `tech-lead-design`'s.
- **Member names leave the product** on every opened event, including named-people events nobody on
  the creator's own team can read inside it. That is decided (F2) and it is the largest exposure the
  product has made.
- **Personal data of people who never agreed to the product's terms is stored with no deletion path.**
  Decided (Q8); a later request to delete it has no mechanism.
- **Spam has one brake**: a fresh email address passes it. Capacity bounds the damage on a capped
  event; an uncapped, no-approval event can be filled with junk names that every reader of the event
  then sees.
- **`EVT-02`'s concurrency guarantee must hold with anonymous writers in the race.**
- **`EVT-04`, when it exists, notifies the creator of a guest's request** like a member's.

## Revert condition

Any one occurrence:

1. **An anonymous caller reads an event that is not opened, or any data but the opened event's own
   fields and its attendee names.** On observation: revoke the anon role's access; opened events go
   dark to guests, members unaffected.
2. **A guest's email is read by anyone but the creator or an admin.** On observation: revoke the read
   until the policy is fixed.
3. **An opened event's approved attendees exceed its capacity** — ADR-045 revert condition 2, now with
   guests counted.

## Affected documents

- `.ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md` — a Status note on
  decision 3. Text unchanged.
- `.ai/registry/features.md` — the `EVT-06` and `EVT-07` rows cite this ADR.
- `.ai/standards/rbac-and-security.md` — the anon role's rows. `.ai/standards/data-model.md` — the
  guest table and the event's link fields. Written at `/plan` of `EVT-06` and `EVT-07`.
- `.ai/registry/glossary.md` — *Guest link* (`EVT-06`) and *Guest* (`EVT-07`), owed under ADR-047.
- `.ai/00-charter.md` § *Who uses it* — stale since ADR-039 and more so now; not repaired here, as
  ADR-045 did not repair it.
