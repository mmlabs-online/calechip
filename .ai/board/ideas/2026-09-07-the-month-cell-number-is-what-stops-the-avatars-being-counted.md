---
stage: TRIAGE
agent: product
produced_at: 2026-09-07
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md (standing instructions in full; session log read in part)
  - .ai/templates/idea.md
  - .ai/board/ideas/2026-09-07-the-month-grid-is-the-only-calendar-surface-still-drawn-in-defaults.md
  - .ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md
  - .ai/board/tickets/UIE-05/design/README.md
  - .ai/board/tickets/UIE-05/ticket.yaml
  - .ai/registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md
  - .ai/registry/decisions/ADR-000-template.md
  - .ai/registry/features.md (the CAL and UIE groups)
  - .ai/registry/invariants.md
  - .ai/standards/ui-design-system.md (§ Language, § Visual specification)
  - .ai/board/tickets/CAL-04/01-plan.md (AC-3, AC-7, § 2b)
  - src/routes/MonthView.tsx (:305-425 in full; the rest by search)
  - src/index.css (:98-152)
  - the month-view transcription named under Evidence, in full
  - tech-lead-design's technical read of the same request, 2026-09-07
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The month cell's number is the only thing that stops its avatars being counted as the day's load

**This is the second half of
`.ai/board/ideas/2026-09-07-the-month-grid-is-the-only-calendar-surface-still-drawn-in-defaults.md`,
carved out at `/triage` on 2026-09-07 so that each half could get the one verdict the gate requires.**
That file states the month-view request in full; the arrangement half of it is **PROMOTE** and is now
`UIE-06`. This half is **NEEDS-ADR**, and the ADR is drafted at
[ADR-031](../../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md), status
`PROPOSED — awaiting the operator`.

**This is the same split, on the same day, for the same reason as this morning's.** The week-view
image produced `UIE-05` and `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md`; that
second file went to ADR-029 because *a number on a screen is behaviour*. **This one goes to ADR-031
because the removal of a number from a screen is behaviour too**, and the symmetry is not a
coincidence — see § *Constraints already known*.

**Nothing was moved out of the parent file.** Its § *Constraints already known* first bullet still
stands where it was written and is quoted below rather than relocated, because an artifact edited to
fit a verdict stops being the record of what was believed before the verdict existed.

## Problem

Quoted from the first bullet of § *Constraints already known* of the parent idea, unchanged:

> **The image DELETES the per-day count, and that is an amendment to CAL-04, not a restyle.**
> `MonthView.tsx:391-395` renders `month-cell-count` whenever the count is above zero. The
> transcription's § 3 is explicit that the cell holds a day number and avatars and *"nothing else is
> written in the cell: no name, no count, no type label, no note."* CAL-04's AC-3 reads *"the cell for
> 14 April **carries an absence count of 1.5**"*.

**Stated as a problem rather than as a request, which is what this section is for:** the month cell is
the one surface in this product where a reader can see that **a day's load is not the number of faces
on it**. A cell holding one `full` entry and one `am` entry draws **two avatars** and weighs **1.5**
(INV-06, CAL-04 AC-3). The numeral in the corner is the only thing on the screen that says so. Remove
it and the cell shows two avatars and nothing else, and a reader counts two.

**That is not a hypothetical, it is the defect ADR-029 refuses for the week view in its own words**,
and it was the observation that produced ADR-013: `.ai/steward/context.md` records it as *a month cell
shows four avatars over a count of three*. ADR-013 answered it with the rule at
`.ai/registry/invariants.md:125` — a view draws a member's avatar exactly when that member's entry is
counted, **so the cell and the number cannot disagree.** **Deleting the numeral does not break that
rule. It removes the only screen on which the rule was ever observable** — a different loss, and a
quieter one.

## Who has it

- **Anybody reading a busy month cell on a week that contains a half-day entry.** They get a count of
  faces where the product means a count of days, and the two differ silently. The month grid is the
  product's headline screen (brief 7.1, `CLAUDE.md` § *Visual direction*), so this is every member on
  every visit to the screen the product opens on.
- **The operator, today, twice over.** They drew a picture that removes this number from the month
  view hours after drawing one that adds the same number to the week view. **Nobody has yet been asked
  to look at both at once**, and the loop has no stage that would make them.
- **Whoever plans `UIE-06`.** Removing a numeral is a one-line diff that looks like tidying, no test
  addresses `month-cell-count`, and the suite stays green. Without a decision recorded somewhere, this
  gets taken as part of a restyle by whoever meets it first.

## Evidence

**Visual reference:** `.ai/board/tickets/UIE-06/design/README.md`, § 3 and § 5.

**What it settles, and what it cannot.** It settles that the operator's picture removes the number
positively — its § 3 enumerates what the cell holds and says *nothing else is written in the cell* —
rather than by the omission that governs the six other things its § 5 lists. **It settles nothing
about what the operator wants a reader to do with a cell holding a half-day entry**, because the
picture contains no half-day and cannot: an avatar is drawn the same way for a `full` entry and for an
`am` one.

**Its status, exactly:**

- **The image is the operator's, it was shown in conversation on 2026-09-07, and it is not on disk.**
  The file above is a hand transcription written by an agent for this triage.
- **It sits at a ticket path because the *other* half of the request promoted**, and
  `.ai/standards/ui-design-system.md:115-119` names `.ai/board/tickets/<ID>/design/` as the one
  canonical home. **It specifies nothing for this idea**: there is no ticket here, and on NEEDS-ADR
  the reference is evidence about a problem, which is all it ever was (`:112`).
- **The image was attached at exactly one stage and that stage has happened** (`:103-106`, `:121-123`).
  If this idea later becomes a ticket, it does not get a second image.

**The rest of the evidence is source, read today rather than recalled.**

- `month-cell-count` is `src/routes/MonthView.tsx:391-395`, rendered when `inMonth && count > 0`.
- The value comes from `absenceCountsFor` — INV-04's single implementation — computed at
  `MonthView.tsx:225-231` and read at `:344`. **The screen holds no arithmetic of its own** (`:10-14`).
- **`data-count` on `month-cell` (`:359`) is what every test reads.** No test in this repository
  addresses `month-cell-count`; the only other reference to that name anywhere is
  `.ai/board/tickets/CAL-04/03-impl-log.md:169`. **The suite stays green after the deletion.**
- **The image is internally consistent with `>` and not `>=`** — day 28 at four of eight is not pink,
  days 17 and 29 above half are. That agrees with INV-04 and CAL-04 AC-7
  (`.ai/board/tickets/CAL-04/01-plan.md:111-118`). **It is the one domain fact the picture states
  correctly**, and it is why the deletion reads as deliberate rather than as an oversight.

## Impact if ignored

- **The deletion happens anyway, inside a restyle, and nothing notices.** It is a one-line diff, no
  acceptance criterion is written against the rendered element, no test asserts it, and CI stays
  green. **That makes it more dangerous to treat as a restyle, not less.**
- **CAL-04 AC-3 quietly becomes a criterion whose only witness is a test hook.**
  `.ai/standards/ui-design-system.md:137-138` requires an acceptance criterion to be observable from
  outside the system by a reader who cannot ask a question. `data-count` is not that.
- **Two proposals from the same day get decided in ignorance of each other.** ADR-029 argues for
  itself by saying the week strip *"provably agrees with the month grid"*. This request removes the
  surface that agreement was ever visible on. **Neither document forbids the other and no invariant
  breaks**, which is exactly why nothing in the loop would stop and say so.
- **The refusal, if it is a refusal, has no record.** If nobody decides, the next reader of
  `MonthView.tsx` finds a numeral with no stated reason and removes it for the same reason the picture
  did — it looks like clutter on a dense grid.

## Constraints already known

Cited, not chosen.

- **CAL-04 AC-3 is a domain criterion, not a layout one**
  (`.ai/board/tickets/CAL-04/01-plan.md:83-87`). It states INV-04's formula in words. **The
  § *Visual specification* grant at `.ai/standards/ui-design-system.md:152-155` covers visual
  arrangement and never behaviour, permissions or invariants**, so it does not reach this.
- **`CAL-04/01-plan.md:192` marks the count's *position* as the Tech Lead's own and *"cheap to argue
  with"* — and says nothing about its *presence*.** Position is arrangement; presence is domain. That
  one distinction is the whole reason this is a separate idea.
- **INV-04 and INV-06** (`.ai/registry/invariants.md:36`, `:38`). INV-04 fixes one definition of the
  absence count and adds *"no second definition of this number exists anywhere in the system"*.
  **A screen that renders no number holds no definition**, so the ledger is not engaged by the
  deletion — and INV-06 is what makes the deletion cost something, since a half day weighs 0.5 and an
  avatar does not.
- **ADR-013 and `.ai/registry/invariants.md:125`.** A view draws a member's avatar exactly when that
  member's entry is counted, *so the cell and the number cannot disagree*. Not reversed by this;
  **made unobservable by it.**
- **ADR-029, `PROPOSED — awaiting the operator`.** It proposes adding `n/N` to the week view and names
  the month grid three times as the surface its number agrees with. **Neither proposal violates
  anything and the pair is a swap of which screen carries INV-04's number.** ADR-031 § *Interaction
  with ADR-029* is where that is written out; it is not settled here and an idea may not settle it.
- **`month-threshold` is silence, not deletion, and the parent idea said otherwise before being
  corrected.** The transcription's § 5 lists the threshold readout among the things the image does not
  show, beside the holiday and the tentative border. `tests/e2e/adm-01-threshold.spec.ts:222-224` is
  ADM-01's only proof that a saved threshold reaches the calendar, and
  `src/routes/MonthView.tsx:327-329` records why the line exists at all. **Nothing in this idea
  proposes removing it, and ADR-031 clause 3 forbids it.**
- **`CLAUDE.md` § *Visual direction*, as an argument in both directions.** *"Information density wins
  there every time"* is an argument for spending the cell's space on avatars, and equally an argument
  against removing a fact from it — density is about how much a screen says, not how little.

## Out of scope

- **Everything `UIE-06` promotes** — the full-width grid, the ruled single card, the ~170px cells, the
  weekday strip on the page ground, the out-of-month tint and the bridge badge's position. **That
  ticket ships whatever this idea does**, and it is planned on the assumption that this decision is
  *not* taken (ADR-031 clause 4).
- **`month-threshold`.** § *Constraints already known*. It stays either way.
- **The week view's footer count.** That is ADR-029's, from the other image. This idea observes the
  interaction and decides nothing about it.
- **Amending INV-04 or INV-06.** Neither is engaged by a rendering decision, and if a plan ever finds
  it needs to amend one, that is a different and much larger decision.
- **`data-count`.** It stays on `month-cell` with the same value from the same call. Nothing here
  proposes touching the attribute, and every existing assertion keeps its subject.
- **Vietnamese interface copy.** Refused in the parent idea's verdict, on the same terms UIE-01 and
  this morning's week-view triage refused it.

## Open questions

The ADR answers 1 with a proposition and a recommendation that disagree on purpose; the operator
decides. Questions 2 and 3 are open in either direction.

1. **Does the operator want the per-day count removed from the month cell — and do they want that
   knowing ADR-029 proposes adding the same number to the week view?** **It is one question and must
   be put once, with both pictures in view.** A month cell showing three avatars over a real load of
   two would then have no way to say so, which is the confusion ADR-029 rejects outright for the week
   view in its own § *Rationale*.
2. **If the count goes, what takes the freed top-right slot — nothing, or the bridge badge?**
   `MonthView.tsx:389-396` is a `justify-between` row and the right half empties. That is arrangement
   and is `tech-lead-design`'s, but it is only *available* if this decision is taken, so the two
   cannot be sequenced independently.
3. **Is a number the right answer at all, or is the real problem that a half-day avatar looks like a
   full-day avatar?** Nobody has proposed drawing the portion on a month avatar and this idea does not
   either — it is recorded because it is the one shape of answer that would satisfy both pictures, and
   it is a bigger change than either.

---

# Triage verdict — NEEDS-ADR

**Written by `product` at `/triage` on 2026-09-07, in the second dispatch of that command, after
`tech-lead-design`'s technical read of the same request.** The sections above are the problem as it
was written before any verdict existed.

## The verdict, and the decision that is owed

**NEEDS-ADR.** The decision owed is:

> **May the month cell stop rendering the absence count?**

It is a registry matter because **CAL-04 AC-3 is a domain acceptance criterion stating INV-04's
formula**, and the only grant that would let an agent originate a change on this screen —
`.ai/standards/ui-design-system.md` § *Visual specification* — covers visual arrangement and
explicitly nothing else. `CAL-04/01-plan.md:192` hands the Tech Lead the count's **position** and is
silent on its **presence**. Position is arrangement. Presence is domain. **An idea may not move that
boundary and neither may a plan.**

**The ADR is drafted in full** at
`.ai/registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md` — context, four options
with their trade-offs, four clauses that bound the decision, a full section on the ADR-029
interaction, consequences including what gets worse, and a revert condition. **No homework was handed
to the operator**: every ADR in this repository was written by an agent from a sentence a human said,
and this one is ready to be accepted, rejected or corrected in one reading.

**ADR-031 § *Decision* states the operator's request and § *Rationale* recommends against it, and that
is deliberate rather than a defect in the document.** It means a `REJECTED` on that ADR is an answer
and not a misunderstanding: **it means the numeral stays**. Writing it the other way round — proposing
to keep the count and making the operator override their own picture to get what they drew — would
have been the more comfortable document and the less honest one.

## Why this is not REJECT

Because the operator asked for it directly, with a picture that removes the element positively rather
than by omission, and because **the picture is internally consistent about the domain** — its overload
shading agrees with INV-04 and CAL-04 AC-7 on `>` rather than `>=`, which is evidence that the
deletion was drawn deliberately.

**And because a silent refusal would not hold.** No test addresses `month-cell-count`, the suite stays
green after its removal, and the element sits in a file that a restyle ticket is about to open. A
refusal that exists only as somebody's judgement at REVIEW is a refusal that gets reversed by the next
one-line diff.

## Why this is not PROMOTE

Because it is not arrangement, and the two agents that looked at it agree on that. Folding it into
`UIE-06` to keep things moving would delete a rendered domain fact inside a restyle, **where the only
mechanism that would notice is a person remembering to look.** That is exactly the failure the split
exists to avoid, and it is the same failure the week-view triage avoided this morning by the same
means.

## Why I did not accept the ADR myself

**ADR-008's test is: decide inside an existing envelope, ask before changing the envelope.** CAL-04
AC-3 is the envelope. `ACCEPTED by product` is the form for a decision inside an open envelope and
this is not one; `ACCEPTED by the operator` is a claim about a person, and writing it on a decision
they have not made is forging a signature — `.ai/steward/context.md` § *Autonomy*, in those words.

**So the status reads `PROPOSED — awaiting the operator`, and it may not read anything else.**

## Where I depart from the technical read

It is a recommendation and it does not bind this verdict. Three departures:

- **Its § 3.5 recommends keeping the month count, and its own ADR draft decides to remove it.** Those
  cannot both be the document. Resolved by writing § *Decision* as the operator's request and marking
  the recommendation explicitly as a disagreement inside § *Rationale*, so the operator sees both and
  a one-word answer resolves it either way.
- **The ADR-029 interaction is promoted out of § *Consequences* into a section of its own**, and
  reproduced in substance in ADR-029, because whichever document the operator opens first has to carry
  it. The technical read put it in a bullet list at the end of one of the two.
- **The `month-threshold` question is closed rather than left open.** The technical read's § 0 is
  right and the parent idea was wrong: the transcription lists the readout under *silence*, not under
  *deletion*. The parent idea has been corrected in place and ADR-031 clause 3 makes the threshold's
  survival part of the decision rather than an assumption about it.

Everything else in the technical read is adopted, including the finding the dispatching session
verified independently against source: `src/index.css:141-143` and `src/components/Sidebar.tsx:62-65`
both assert that no calendar view computes an overload state and that `seam.getTeam()` is not called
by any of them, while `MonthView.tsx:175` calls it and `:347` computes `isOverloaded`. **Both comments
are false**, and they are the recorded reason the sidebar has no overload legend row — the row both of
the operator's images draw. That correction is carried into `UIE-06`'s shell as a defect to resolve
rather than to inherit; it is not this idea's.

## What happens next, and what does not

- **No feature row was written and no ticket shell exists for this idea.** ADR-007's PROMOTE default
  does not apply to a NEEDS-ADR verdict, and a row with nothing behind it is worse than no row.
- **Nothing is blocked in the loop.** `UIE-06` is unblocked, does not depend on this, and ships a
  month grid matching the picture minus one small numeral per busy cell.
- **If the operator accepts ADR-031**, this idea is re-triaged — the door is `/triage` with this
  filename as the argument — and it promotes into a `UIE` row of its own, carrying the ADR's four
  clauses as the substance of its acceptance criteria, plus the CAL-04 AC-3 rewording and the line on
  CAL-04's registry row.
- **If the operator declines it**, the numeral stays and the correct outcome is not silence: the
  reason it stays belongs in `src/routes/MonthView.tsx` beside the element, so the next person to read
  the file as clutter finds the decision instead of re-deriving it. That is a chore against shipped
  surface, not a feature.
- **Nothing is committed.** This file and the ADR travel to the operator under CODEOWNERS.

*`consulted` is `[]` above and that is deliberate: `tech-lead-design` was **co-dispatched by the same
`/triage` run**, not consulted under RULE-11. Its technical read is listed as an input, which is what
it is, and no chat budget was spent.*

---

## Outcome — 2026-09-08

**[ADR-031](../../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md) is
`REJECTED by orchestrator`. The numeral stays.** That is option 1 of that document's § *Rationale*,
which is what both agents at this triage recommended and what its own § *Status* said a `REJECTED`
would mean — not a failure, and not a sign the request was misunderstood.

**The operator delegated the decision rather than making it** — *"tưj quyết đi"*, 2026-09-08 — so
this is not the operator withdrawing the request in the image. Declining to merge the pull request
carrying this edit is how the numeral goes after all.

**The argument that settled it is § *Interaction with ADR-029* item 3**, not a preference about
density: ADR-029 rejects its own option 3 because a reader who counts three chips against a load of
two gets the wrong number, and deleting this numeral asks the month cell to become exactly that. One
document refusing a reading failure by substitution while its pair produced the same failure by
subtraction, two hours apart, from the same desk.

**Evidence that arrived after this file was written, and it is why the call was not close.** UIE-06
shipped on 2026-09-08 and its `ticket.yaml` reaches `invariants_touched: [INV-04, INV-05, INV-06]` —
the only three-invariant row in the product — **without setting out to argue with this ADR**, purely
by working out what the month cell's restyle touches. Two of its three findings are this document's
§ *Consequences* reached from the other end.

**The rest of the operator's month-view image shipped and is unaffected**: UIE-06 delivered the ruled
full-width card, the taller cells and the token migration. **This rejection costs exactly one glyph
per busy cell**, which is the whole remaining distance between the shipped screen and the picture.

**Nothing is owed.** A `REJECTED` obliges none of the edits in § *Affected documents* — that list was
what acceptance would have cost. `CAL-04` AC-3, `CAL-04/01-plan.md:192`, `MonthView.tsx:391-395` and
the feature row are all untouched and stay true. **This idea does not promote.**
