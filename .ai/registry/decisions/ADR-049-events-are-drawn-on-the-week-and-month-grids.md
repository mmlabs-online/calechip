---
doc_version: 3
last_updated: 2026-10-08
governed_by: [RULE-01, RULE-09]
---

# ADR-049 — Events are drawn on the week and month grids, as their own layer, and never counted

## Status

`ACCEPTED by the operator` — 2026-10-08, in words, at `/idea` of
`.ai/board/ideas/2026-10-08-an-event-is-invisible-from-the-calendar-it-happens-on.md` § *Evidence*.
Drafted by `product` at `/triage` of that file.

**Recorded, not authored.** The operator was shown ADR-045 decision 2 by its text, told which of
their own answers it rested on, and offered two branches. The question and the answer, verbatim
from Q1:

> *ADR-045 point 2 says an event "is not drawn on the month, week or year grids", from your Q2
> answer of 2026-09-29, "Không liên quan" — which answered whether an event relates to entries and
> the absence count. The proposal is to draw events on the grid while still creating no entry, never
> entering the absence count and never touching the overload warning. A: agree — a new ADR amends
> point 2 only, INV-04/05/07 untouched. B: no — this idea stops.*
>
> **"A đồng ý"** — and, unprompted: *"được vẽ event lên lịch, nhưng không bao giờ tính vào số người
> vắng. Event là một layer(component) hoàn toàn khác với WFH và PTO"*.

**Amends [ADR-045](ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md) decision 2 only.**
ADR-045 decisions 1 and 3 to 6 are unchanged.

## Context

- ADR-045 decision 2 reads: *"An event is a new concept and not an entry. It creates no entry, is not
  in the absence count, and is not drawn on the month, week or year grids (Q2 "Không liên quan")."*
  The operator's Q2 answer was to a question about entries and the absence count; the clause about
  the grids was carried in beside it.
- `EVT-01` and `EVT-02` shipped events on `/events` and `/events/:id` only. A member reading the week
  or month cannot see that a gathering falls on a day (the idea file's § *Problem*).
- `CLAUDE.md` § *Visual direction*: the calendar grid is the most-used screen and information density
  wins there every time.

## Decision

ADR-045 decision 2 now reads: **"An event is a new concept and not an entry. It creates no entry and
is not in the absence count. It is drawn on the week and month grids as a layer of its own, never as
an entry, and it is not drawn on either year view."** Concretely:

1. **Drawn on `/week` and `/month`; not on the year overview or the year members grid** (Q2 "a +b").
2. **A reader sees on the grid exactly the events `listEvents()` returns them** — ADR-045 decision 3's
   visibility, not widened. Events the reader takes part in are marked differently (Q3 "C").
3. **An admin viewing another team through `CAL-12`'s picker sees the events relevant to that team**:
   public events, that team's own-team events, and named-people events inviting someone on it (Q4
   "A"). This narrows what an admin already reads under ADR-045 decision 5; it widens nothing.
4. **An event is shown across its whole span, past and future**, whatever its registration deadline
   (Q5, Q7).
5. **A click navigates to `/events/:id` and does nothing else** (Q6).
6. **It never enters the absence count, the overload warning, or any day status**, and it is never
   drawn as an entry chip — the operator's *"một layer(component) hoàn toàn khác với WFH và PTO"*.
7. **Its colour is coral** (the operator's words, *"sử dụng màu coral"*), held distinguishable from PTO
   peach, the overload soft pink and holiday lavender.

## Rationale

**Rejected: keep decision 2 as written** — offered as branch B, not chosen. It keeps the grids
simplest but leaves the problem in the idea file standing.

**Rejected: draw events on every grid including the year views** — offered as options (c) and (d) of
Q2, not chosen. The year members grid has one row per member across 365 columns; an event layer
there either costs a row, which `CLAUDE.md` forbids, or shares cells with entries, which makes a
gathering read as an absence.

**Rejected: show an admin everything on another team's view** — offered as Q4-B, not chosen. Cheaper,
but an admin reads every event on every team, so the viewed team's calendar would carry gatherings
nobody on it is part of.

## Consequences

- **INV-04, INV-05 and INV-07 stay untouched by construction**, as under ADR-045. A reviewer checking
  R7 on the ticket that builds this asserts that no event value reaches `absenceCountsFor`,
  `isOverloaded` or the overload warning.
- **The week and month views take a second read** beside entries, holidays and busy days, and render
  a fourth kind of mark. That costs density on the most-used screen — the reason decision 2 was
  written as it was — and the plan must say how a busy day keeps its rows.
- **Q4-A needs a team-scoped event read for admins.** Whether it is a filter over existing reads or a
  `security definer` function in ADR-040's shape is `tech-lead-design`'s at `/plan`; if it is a
  function, that migration is this ADR's.
- **A new colour token is owed** in `.ai/standards/ui-design-system.md`.

## Revert condition

Either, one occurrence:

1. **An event changes an absence count, an overload warning, or a day status**, in the running system
   or in a test. On observation: remove the event layer from both grids; events stay on `/events`.
2. **An event is drawn on a grid for a reader `listEvents()` would not return it to.** On observation:
   the same removal, and the read is treated as an ADR-045 revert condition 1 incident.

## Affected documents

- `.ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md` — a Status note
  naming this ADR. Text unchanged; `doc_version` stays 2.
- `.ai/registry/features.md` — the `EVT-03` row cites this ADR.
- `.ai/standards/ui-design-system.md` — the coral token. Written at `/plan` of `EVT-03`, which puts the
  file in `allowed_paths`.
