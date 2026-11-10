---
doc_version: 3
last_updated: 2026-09-09
governed_by: [RULE-01, RULE-09]
---

# ADR-032 — The year view replaces its member grid with twelve month cards

## Status

**`ACCEPTED by the operator` — 2026-09-09.**

**This file is a rewrite, not a status edit.** A first draft of ADR-032 was written on 2026-09-08 and
left `PROPOSED — awaiting the operator`. **It exists on no ref** — `git log --all --diff-filter=A`
finds no add for it — while **eight documents cite it**, which is 8 of the 9 errors `main`'s own
documentation audit currently fails with. That is recorded as **MD-031**
(`.ai/board/model-debt.md:29`), together with the mechanism: `/triage`'s outputs live in the bucket
`/ship` is forbidden to commit, while the `features.md` row that cites them rides the ticket branch.
**This document is written at the exact filename those eight citations already name**, deliberately,
so that landing it closes them. Nothing below is recovered from the lost draft; it is written from the
surviving citations, the operator's answer, and the source read at this triage.

**The two answers, recorded as they were given and not paraphrased into anything stronger.** The
operator's originating instruction, verbatim, 2026-09-09: *"thay đổi calendar year view như ảnh này"*
— change the calendar year view like this picture. Asked the two questions the first draft left open,
they answered each explicitly, in this conversation:

1. **Keep BOTH.** The year view gains the twelve-month-card overview **and retains** the per-member
   365-column grid. The change is additive; nothing is deleted.
2. **The overview is the DEFAULT.** `/year/:yyyy` renders the overview, as the image draws it. The
   member grid moves to `/year/:yyyy/members`.

**What the operator did not decide, and what may therefore not be read into this document:** the
definitions of the four summary numbers, how a day carrying both a PTO and a WFH entry is drawn,
anything about copy, and anything about the sidebar. Those are open questions on the idea and are
PLAN's or are refused there.

Reviewed at merge under CODEOWNERS, like every registry change.

## Context

**The year view is a member × day matrix and it aggregates nothing.** One row per member, 365 day
columns, a month ruler above — `src/routes/YearView.tsx:321` (the `9rem repeat(n, 0.5rem)` template),
`:348` (`year-month-label`), `:409` (`year-row`), `:433` (`year-cell`). That file's own comment puts
the render at **10,950 cells** (`:339`). Every fact on the screen is one person on one day. A per-day
total exists — CAL-06 AC-9 and AC-10 — but there is no number anywhere for a month, a quarter or the
year.

**The brief gives this screen long-range planning as its job** (`product_brief.md:105`, *"Lập kế
hoạch dài hạn"*) and then specifies the layout that cannot do it. The problem is stated in full at
`.ai/board/ideas/2026-09-09-the-year-view-cannot-answer-what-the-year-looked-like.md`.

**The operator's picture is on disk for the first time in this repository** —
`.ai/board/tickets/CAL-10/design/year-overview-2026-09-08.jpg`, a real JPEG rather than a hand
transcription. It draws a four-card summary band above twelve month mini-calendars, each card
carrying a header count or the word `Trống`, a Monday-first weekday row, pill-shaped day cells tinted
by type, and a footer with overlapping avatars and a `Xem →` link. The prose description written on
2026-09-08 without the file is `.ai/board/tickets/UIE-08/design/README.md` § 1.4; it is now checkable
against the image for the first time.

**The request was split on 2026-09-08 and only the repaint half shipped.** UIE-08 recoloured the grid
that exists; the restructure half was ruled NEEDS-ADR and became the draft described above. The
backlog recorded the cost of that split in terms — *"if ADR-032 is accepted, that paint is thrown
away rather than adjusted"* (`.ai/board/backlog.md:40-46`). **The operator's first answer retires
that concern**, and § *Consequences* item 6 says so.

**The reads this needs already exist.** `listTeamEntriesOverlapping` is paged and complete-or-throw
since CAL-09 (`src/lib/data/index.ts:506-512`), `listMembers` is `:232`, `listHolidays` is `:546`, and
the avatars come from `absentMembersFor` (`src/lib/data/absence.ts:220`), derived from the same pass
as the counts. **No schema change is implied by any option below.** That is what makes this a decision
about the surface and the route, and not about the data.

## Options

### Option 1 — replace outright

`/year/:yyyy` becomes the overview and the member grid is deleted.

**For:** one screen, one layout, exactly the picture. Nothing to keep in agreement.

**Against:** it deletes a capability the brief specifies. `product_brief.md:105` describes the year
view as *"Mỗi người một hàng, 365 cột nhỏ"* and `:110` accepts *"View năm chịu được 30 người mà vẫn
cuộn mượt"* — both become false statements about the product rather than unmet ones. Seven CAL-06
criteria (AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-10) would become unobservable, and CAL-08 AC-7 and
AC-11 with them. And it removes the one screen that shows **who declared nothing** — a member with an
empty row is visible on the matrix and invisible on any aggregate.

### Option 2 — keep both, the member grid stays the default

`/year/:yyyy` keeps the grid; the overview lives at a sub-route.

**For:** every shipped acceptance criterion stays true, word for word. Nothing is reworded, no
deep link changes, and the risk of the change is confined to a route nothing yet points at.

**Against:** it answers the operator's picture with a screen most people will never reach. The problem
is that opening the year gives no answer; leaving the default alone leaves the problem alone, and
converts a decision into a feature nobody finds.

### Option 3 — keep both, the overview is the default *(chosen)*

`/year/:yyyy` renders the overview. The member grid is retained, unchanged in behaviour, at
`/year/:yyyy/members`.

**For:** the person who opens the year gets the aggregate they came for, and the person who needs
per-member detail can still get it. Nothing is deleted, so the brief stays true and no criterion
becomes unobservable.

**Against, and it is the whole cost of this option:** it moves the address five shipped acceptance
criteria are written against, so five criteria must be reworded. Rewording a shipped criterion is
exactly the act this repository distrusts — `.ai/registry/features.md`'s CAL-04 row insists a
criterion is *"not to be rewritten"* when code fails to hold it. **The distinction is that these
criteria are not failing; their address is being moved by a decision recorded here.** That is the
difference between editing a criterion to match a defect and editing it to match a decision, and it
is why this option needs an ADR at all.

## Decision

**`/year/:yyyy` renders a year overview: a summary band of four numbers above twelve month cards, one
card per month, each showing that month's days as tinted cells with a header count and a link to the
month view. The per-member 365-column grid is not deleted — it is retained, behaviourally unchanged,
at `/year/:yyyy/members`.** The five acceptance criteria listed under § *Consequences* are reworded to
name `/year/:yyyy/members` where they name `/year/:yyyy` today, and no other shipped criterion is
touched. No invariant is amended: INV-04 remains the single definition of the absence count, and every
number on the new screen either **is** that number or is declared a different quantity and named as
one. `schema_delta` is `none`.

## Rationale

**Option 1 was refused because the brief specifies the grid and this decision has no mandate to
delete it.** The operator was asked and said keep both; the ADR records that rather than improving on
it.

**Option 2 was refused because it does not solve the stated problem.** The problem is what happens
when a person opens the year, and option 2 changes nothing about that.

**Option 3's cost is five reworded criteria, and it is payable because it is enumerable.** They are
listed below by `file:line`, all five are address changes rather than substance changes, and the
seven criteria that survive untouched are listed too so a reviewer can see that the boundary was
drawn rather than asserted.

## Consequences

**1. Five shipped acceptance criteria must be reworded, and here they are.**

| Criterion | Line | What must change |
|---|---|---|
| CAL-06 AC-1 | `.ai/board/tickets/CAL-06/01-plan.md:129-132` | *"they open `/year/2026`"* → `/year/2026/members` |
| CAL-06 AC-2 | `:134-137` | *"they open `/year/2028`"* → `/year/2028/members` |
| CAL-06 AC-13 | `:197-201` | *"`/year/2026` is opened"* in each of three non-list states → `/year/2026/members`, and the overview needs its own three |
| CAL-06 AC-14 | `:203-207` | *"draws no grid"* — no address, but *the grid* now names a different screen; the refusal must hold on both |
| CAL-08 AC-7 | `.ai/board/tickets/CAL-08/01-plan.md:178-183` | *"they open `/year/2026`"* → `/year/2026/members` |

**Nine criteria are deliberately NOT touched**, and a reviewer should check this list as carefully as
the one above. CAL-06 AC-3, AC-4, AC-5, AC-6, AC-8, AC-9 and AC-10 all open *"When the year
renders"*, carry no address, and describe the retained grid. **CAL-08 AC-11** (`:203-207`) says *"the
year grid"* in a three-surface comparison and stays true as written. **CAL-06 AC-12** (`:191-195`)
requires the year view to offer *"a link back to the month"*; the card footer's `Xem →` satisfies it
**if it targets `/month/yyyy-MM`**, which binds PLAN rather than changing the criterion.

**2. A half day becomes indistinguishable from a full day on the overview, and this is the identical
argument that decided ADR-031, arriving on a new surface.** The picture's day cell is a pill that
already carries the day-of-month numeral, rendered in white on every tinted fill
(`.ai/board/tickets/UIE-08/design/README.md:112-114`, `:122`). **There is no room for a second
numeral.** ADR-031 was rejected — the month cell keeps its count — precisely because that glyph is
INV-06's only surface on that screen and the only in-cell explanation of a marking. The overview
reintroduces the loss at a different scale: a member's `am` half day and their `full` day tint the
same pill the same way. **This is accepted, not solved**, and it is the reason the month cell's
numeral must not be reconsidered as a consequence of this change.

**3. The month card's header count is fractional the moment it is defined in INV-04's units.** One
half day makes a month read `20.5`. The picture draws an integer (`21 Lượt`,
`UIE-08/design/README.md:108-109`), so **the picture cannot be transcribed into a definition** — PLAN
must write the definition as an acceptance criterion and say what the unit is.

**4. `NGÀY PTO` and `NGÀY WFH` split the year by `type`, and INV-04's implementation is documented as
never doing that.** `src/lib/data/absence.ts:190-191` states it in terms — *"`type` is never
consulted, so PTO and WFH weigh the same (AC-3)"* — and INV-04 itself says *"No second definition of
this number exists anywhere in the system"* (`.ai/registry/invariants.md:36`). **The two cards are
therefore a NEW quantity, not INV-04's, and must be declared as one.** The binding constraint, and it
belongs in an acceptance criterion: **the PTO figure and the WFH figure must sum exactly to INV-04's
total for the same period.** Two numbers that can drift apart from the one they decompose is the
failure INV-04 exists to prevent, arriving by addition instead of by copying.

**5. Existing `/year/2026` links land on a different screen.** Anything shared, bookmarked or
asserted against that address now resolves to the overview. The specs that assert against it are the
five criteria in item 1; the humans who have shared the link are not enumerable.

**6. UIE-08's repaint is NOT thrown away, and that reverses a cost the board recorded.**
`.ai/board/backlog.md:40-46` warned that accepting this ADR would discard UIE-08's work rather than
adjust it. **Under the operator's first answer the grid survives**, so UIE-08's four semantic tokens,
`--radius-card` and `--shadow-soft` continue to apply to it at its new address. The warning was
correct against option 1 and is retired by option 3.

**7. Two calendar surfaces now have to stay in agreement about the same year.** CAL-08 AC-11 already
requires the month, the week and the year grid to report the same day status; the overview is a
fourth surface reading the same four seam calls. The mitigation is structural rather than procedural
— both screens take their numbers from `absenceCountsFor` and their avatars from `absentMembersFor`,
neither derives anything locally, and this document forbids a second arithmetic anywhere.

**8. The audit stops failing on this file, and this file becomes load-bearing for eight citations.**
Landing it closes 8 of the 9 errors on `main` (MD-031). The corollary is that this document is now
what those eight documents mean, and none of them was written against this text — a reader following
one of those citations should read this document and not assume it says what the citing sentence
implies.

## Revert condition

**The observable signal is a number on the overview that disagrees with INV-04.** Concretely: the
`NGÀY PTO` and `NGÀY WFH` figures failing to sum to `absenceCountsFor`'s total for the same year, or
any month card's count computed from a source other than `absenceCountsFor`. **One occurrence,
anywhere in the product, retires the summary band** — the four cards are removed and `/year/:yyyy`
keeps the twelve month calendars alone. The band is the part of this decision that introduces a new
quantity, and a new quantity that cannot be reconciled with INV-04 is the thing INV-04 was written to
make impossible.

**The secondary condition is about the route rather than the numbers.** If members report reaching
`/year/:yyyy` and needing `/year/:yyyy/members` most of the time, the answer is **option 2, not option
1**: the two screens swap defaults and nothing is deleted. That reversal costs the same five
criteria's addresses again and no more, which is why the reversal is cheap enough to name.

## Affected documents

| File | Change | `doc_version` moves to |
|---|---|---|
| `.ai/registry/features.md` | The `CAL-10` row, citing this ADR and the idea | **unchanged, and that is measured** — the file is `doc_version: 3`, `last_updated: 2026-09-05` while carrying rows through `CAL-09` added on 2026-09-08, so a promoted row does not move it |
| `.ai/board/tickets/CAL-06/01-plan.md` | AC-1, AC-2, AC-13, AC-14 reworded — **at CAL-10's PLAN, by `tech-lead-design`, not here** | set at PLAN |
| `.ai/board/tickets/CAL-08/01-plan.md` | AC-7 reworded — same, at PLAN | set at PLAN |
| `product_brief.md:105` | Stays true and needs no edit under option 3 — the row-per-member year still exists. Listed so that a reader checks rather than assumes | unchanged |

**`.ai/registry/invariants.md` is deliberately absent from this table.** No invariant is amended. The
PTO/WFH split is a new quantity constrained to agree with INV-04, which is a criterion at PLAN and not
a change to the invariant.
