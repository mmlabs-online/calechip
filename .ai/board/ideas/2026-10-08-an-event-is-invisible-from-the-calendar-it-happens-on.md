---
stage: TRIAGE
agent: product
produced_at: 2026-10-08T07:10:00Z
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/templates/idea.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md
  - .ai/board/tickets/EVT-02/01-plan.md
  - src/lib/data/index.ts
  - src/App.tsx
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: "PROMOTE"
verdict_reason: "Worth building and not covered: events exist only on /events. ADR-045 decision 2 forbade drawing them on the grids; the operator agreed in words (Q1 \"A đồng ý\") to amend that point alone, so ADR-049 is written ACCEPTED by the operator in this run and nothing is left waiting."
ticket_id: "EVT-03"
awaiting_adrs: []
operator_request: "Event hiện trên calendar view, click vào ra trang chi tiết"
---

# An event is invisible from the calendar it happens on

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

*`/triage` wrote its verdict below on 2026-10-08; the sentence above is left as `/idea` wrote it.*

## Problem

*Derived from the request above; the operator stated a solution, not a problem.*

A member reading the week or the month cannot tell that anything is happening on a day except who is
away. Events exist (`EVT-01`, `EVT-02`), but only on `/events` and `/events/:id`, so a person
planning around a date has to leave the calendar to find out whether a gathering falls on it, and
someone who never opens `/events` does not learn of it at all. The calendar is the screen people
already read; the event list is one they have to remember to visit.

## Who has it

Every approved member, every time they read the week or the month view: the event they would go to
is not on the screen they plan from. An admin reading another team's calendar through `CAL-12`'s
picker has the same gap for that team.

## Evidence

The operator's request, verbatim above, raised in a brainstorm on 2026-10-08 alongside in-app and
email notifications and a public event page — both recorded as separate ideas, not here.

**Q1 — reversing ADR-045 decision 2.** Asked: *ADR-045 point 2 says an event "is not drawn on the
month, week or year grids", from your Q2 answer of 2026-09-29, "Không liên quan" — which answered
whether an event relates to entries and the absence count. The proposal is to draw events on the
grid while still creating no entry, never entering the absence count and never touching the overload
warning. A: agree — a new ADR amends point 2 only, INV-04/05/07 untouched. B: no — this idea stops.*
**Answer: "A đồng ý".** And, unprompted: *"được vẽ event lên lịch, nhưng không bao giờ tính vào số
người vắng. Event là một layer(component) hoàn toàn khác với WFH và PTO"*.

**Q2 — which views.** Options: (a) week, (b) month, (c) year overview, (d) year members.
**Answer: "a +b".**

**Q3 — which events a person sees.** A: every event they can read; B: only those they joined,
were approved for, or created; C: A, with the events they take part in marked differently.
**Answer: "C".**

**Q4 — an admin viewing another team through `CAL-12`'s picker.** A: events *relevant to the
viewed team* — public events, that team's team-scoped events, and events inviting someone on that
team, which needs a new team-filtered read. B: everything the admin can read, as on `/events`.
**Answer: "A".**

**Q5 — shown before it happens.** Proposed: shown across its whole span, start date to end date,
whatever the registration deadline. **Answer: "có".**

**Q6 — what a click does.** Proposed: it navigates to `/events/:id` and nothing else; a join control
on the calendar is out of scope. **Answer: "đúng".**

**Q7 — past events.** Proposed: shown when the reader pages back, because the calendar is a record.
**Answer: "có".**

**Colour, unprompted:** *"sử dụng màu coral"*.

## Impact if ignored

An event is learned about by visiting `/events` or by word of mouth. A member choosing a PTO date
from the month view can pick the day of the team outing without seeing it there, and an event's reach
is bounded by how many people remember a second screen exists.

## Constraints already known

- **ADR-045 decision 2 forbids this as written.** Q1 is the operator's agreement, in words, to
  amend that one point. **ADR-045's other five decisions stand**, decision 6 included (no server, no
  email).
- **INV-04, INV-05, INV-07 must stay untouched by construction.** The operator's words: an event is
  *"một layer(component) hoàn toàn khác với WFH và PTO"* and is *"không bao giờ tính vào số người
  vắng"*. Nothing on this surface may feed `absenceCountsFor`, `isOverloaded` or the overload
  warning, and an event is never drawn as an entry chip.
- **Visibility is ADR-045 decision 3's and is not widened.** A member sees on the grid exactly the
  events `listEvents()` already returns them (`src/lib/data/index.ts:1296`). Q4-A is a narrowing for
  admins, not a widening for anyone.
- **Q4-A is a new read.** "Relevant to the viewed team" means: scope public; scope own-team where
  the team is the viewed one; scope named-people where an invitee is on the viewed team. ADR-040 is
  the shape for a cross-team admin read; the exact signature is `tech-lead-design`'s.
- **`CLAUDE.md` § Visual direction:** the grid's density wins every time. Coral must stay
  distinguishable from PTO peach and from the overload soft pink, and must not be holiday lavender.
- **Charter refusal 6 is untouched** — nothing here warns or blocks.

## Out of scope

- **The year views** — overview and members (Q2).
- **Any action on the calendar** — joining, withdrawing, deciding. A click navigates; that is all
  (Q6).
- **Any change to the absence count, the overload warning, entries, or day statuses.**
- **Notifications, in-app or email**, and **a public event page** — separate ideas from the same
  brainstorm.
- **Changing who may read an event.** Visibility stays ADR-045 decision 3's.
- **The events list page** (`/events`) and the detail page itself — unchanged.

## Open questions

None the operator owns. Assumptions this file made rather than asked, each cheap to reverse and each
PLAN's to overrule:

1. **"Take part in" (Q3-C) means approved attendee or creator.** A pending request is not marked as
   taking part; whether it gets a third treatment is PLAN's.
2. **A multi-day event is drawn across every day of its span**, on both views.
3. **On `CAL-12`'s other-team view, Q3-C's marking is the admin's own participation**, not the
   viewed team's.
4. **A new colour token is owed** in `.ai/standards/ui-design-system.md`; its exact value is
   `tech-lead-design`'s, held to the contrast constraint above.

# Triage verdict — PROMOTE, as `EVT-03`

`product` at /triage, 2026-10-08.

**Not REJECT.** Nothing shipped draws an event anywhere but `/events` and `/events/:id`; the problem
stands as stated.

**NEEDS-ADR was the verdict on the registry as found, and it was closed in the same run.** ADR-045
decision 2 says an event *"is not drawn on the month, week or year grids"*, so the idea reversed part
of an accepted ADR. The test for that is whether the operator decided it in words: § *Evidence* Q1
quotes them choosing branch A, *"A đồng ý"*, against a question that named the clause and its source.
That quote is the signature, so
[ADR-049](../../registry/decisions/ADR-049-events-are-drawn-on-the-week-and-month-grids.md) is
written `ACCEPTED by the operator`, amends decision 2 only, and `awaiting_adrs` stays empty.

**Group `EVT`, not `CAL`.** ADR-028 step 2 sorts by area: the deliverable is where events surface,
and nothing about entries, absence or the count changes.

**One ticket, not split.** Two views, one read, one layer; the admin read of Q4-A is the only part
that could grow, and PLAN sizes it. Split at PLAN if it does not fit M — MD-017's caveat applies.

**What this verdict wrote:** ADR-049; a Status note on ADR-045 (text unchanged); the `EVT-03` row in
`.ai/registry/features.md`, `PLANNED`; `.ai/board/tickets/EVT-03/ticket.yaml` at `BACKLOG`; row 1 of
`## BACKLOG`. DoR items 1, 3, 4 and 6 are filled; 2 and 5 are PLAN's. `glossary_owed: []` — Event,
Attendee, Invitation and Capacity already have rows.
