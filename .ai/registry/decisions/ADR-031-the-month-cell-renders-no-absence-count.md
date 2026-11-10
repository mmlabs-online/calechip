---
doc_version: 3
last_updated: 2026-09-08
governed_by: [RULE-01, RULE-09]
---

# ADR-031 — The month cell renders no absence count

## Status

`REJECTED by orchestrator` — 2026-09-08. **The numeral stays.** That is option 1 below, which is what
both agents at this triage recommended and what § *Status* already said a `REJECTED` would mean: not a
failure, and not a sign the request was misunderstood.

**The operator delegated the decision rather than making it.** Their instruction, verbatim,
2026-09-08: *"tưj quyết đi"* — *decide it yourself*. That is the human step the quoted paragraph below
required, and it is what lifts the envelope gate. **It is not a decision about the substance**: the
operator did not say which way, and nothing here may be read as their having withdrawn the request in
the image. Reviewed at merge under CODEOWNERS, like any other registry change (ADR-008 § *Decision*);
merging the pull request that carries this edit is the approval, and declining to merge it is how the
numeral goes after all.

**Decided together with [ADR-029](ADR-029-the-week-view-renders-a-per-day-absence-count.md), which is
`ACCEPTED by orchestrator` in the same pass.** § *Interaction with ADR-029* required the two to be
read together and they were. The pair resolves to **the product keeps the month count and gains a week
count**, which is item 5 of that section in its own words: *"keep the month count and let ADR-029
stand or fall on its own merits — that costs one glyph and preserves the surface ADR-029's own
argument leans on."*

**Why this one is rejected, in the decider's words rather than the draft's.** § *Interaction* item 3
is the argument that settles it, and it is not a preference: **ADR-029 rejects its own option 3
because a reader who counts three chips against a load of two gets the wrong number — and deleting
this numeral asks the month cell to become exactly that.** Accepting both would have had one document
refusing a reading failure by substitution while the other produced the same failure by subtraction,
two hours apart, from the same desk. The picture is evidence and it was weighed: its `>` versus `>=`
shading is correct, so the deletion was drawn deliberately rather than overlooked. It is outweighed by
what the glyph is load-bearing for — CAL-04 AC-3's only visible witness, INV-06's only surface on this
screen, and after UIE-06 the only in-cell explanation of why a cell is pink.

**Evidence the drafters did not have, and it is the reason this is not a close call.** UIE-06 was
planned and shipped on 2026-09-08, after this document was drafted, and its
`ticket.yaml` reaches `invariants_touched: [INV-04, INV-05, INV-06]` — the only three-invariant row in
the product. It arrived there **without setting out to argue with this ADR**, purely by working out
what the month cell's restyle touches, and two of its three findings are this document's § *Consequences*
restated from the other end: that one-avatar-per-member reads correctly *only* because the count
carries the arithmetic, and that the count is the only surface on which a half day is expressible on
this screen. **A second agent reaching the same conclusion from a different task is worth more than
the recommendation already recorded here.**

**What is not decided here.** The rest of the operator's month-view image is unaffected and shipped:
UIE-06 delivered the ruled full-width card, the taller cells and the token migration. **This rejection
costs exactly one glyph per busy cell**, which is the whole distance between the shipped screen and
the picture.

*This section read `PROPOSED — awaiting the operator` from 2026-09-07 until 2026-09-08. The paragraphs
it replaces are kept verbatim below rather than deleted: they state correctly why an agent could not
sign this document unaided, and that remained true right up to the operator's instruction.*

> **It may not be accepted by an agent.** ADR-008's test is: decide inside an existing envelope, ask
> before changing the envelope. The envelope here is **CAL-04 AC-3**, a *domain* acceptance criterion
> that states INV-04's formula in words — *"the cell for 14 April carries an absence count of `1.5`"*
> (`.ai/board/tickets/CAL-04/01-plan.md:83-87`). `.ai/standards/ui-design-system.md:152-155` puts
> behaviour, permissions and invariants explicitly outside the grant that lets `tech-lead-design`
> originate a layout. **`CAL-04/01-plan.md:192` marks the count's *position* as the Tech Lead's own
> and *"cheap to argue with"*; it says nothing about its *presence*.** Position is arrangement.
> Presence is domain.
>
> So `ACCEPTED by the operator` is the only status this document can carry other than `REJECTED`, and
> writing the first before the operator has said so is forging a signature
> (`.ai/steward/context.md` § *Autonomy*, in those words). `ACCEPTED by product` is not available.
>
> **Read § *Decision* and § *Rationale* together before signing, because they do not agree, and that
> is deliberate.** § *Decision* states the operator's own request as the proposition being put.
> § *Rationale* records that both agents at this triage recommend **against** it. A `REJECTED` on this
> document is not a failure and does not mean the request was misunderstood — **it means the numeral
> stays**, which is option 1 below.

**Drafted by `product` at `/triage` on 2026-09-07**, on a NEEDS-ADR verdict, from
`.ai/board/ideas/2026-09-07-the-month-cell-number-is-what-stops-the-avatars-being-counted.md`. The
technical half of that triage was `tech-lead-design`'s and supplied a full draft; the departures from
it are marked where they occur.

**Supersession test, run first.** It supersedes and reverses **no `ACCEPTED` ADR**. ADR-005, ADR-013,
ADR-014, ADR-015 and ADR-028 are untouched. **INV-04 is neither violated nor amended and the invariant
ledger is not edited** — a screen that renders no number holds no definition of one. ADR-013's rule
that a view draws a member's avatar exactly when that member's entry is counted
(`.ai/registry/invariants.md:125`) is not reversed either: avatars still follow the count exactly.
**It does bear on ADR-029, which is `PROPOSED` and not accepted** — see § *Interaction with ADR-029*.
It cannot supersede a proposal; it changes what accepting that proposal would mean.

## Renumbered from ADR-030 on 2026-09-07

**This document was drafted as `ADR-030` and is `ADR-031`, because two ADRs were written as 030 on
the same afternoon by two sessions that could not see each other.** The other is
[ADR-030](ADR-030-the-first-admin-arrives-by-a-password-free-bootstrap-file.md), the first-admin
bootstrap; it reached `main` first in PR #68 and keeps the number it landed with. This one was
renumbered at the merge, together with every reference to it in
`.ai/board/ideas/`, `.ai/board/tickets/UIE-06/`, `.ai/board/backlog.md`, `.ai/registry/features.md`
and ADR-029's *Interaction* section.

**Git did not report this and could not have.** The two files have different names, so there was no
conflict to resolve — the collision was in the ID, and it was found only because a human resolving a
neighbouring conflict in `backlog.md` looked at what else had arrived. `.ai/board/model-debt.md`
already records the same shape for its own register: *"There is no ID allocator. Two sessions
appending in parallel will both reach the next number."* That paragraph was written about `MD-nnn`
and is now demonstrated for `ADR-nnn`, in the plane where RULE-01 says the numbers matter most.

**Nothing about the decision changed.** The number is the whole of the edit.

## Context

**The operator's request, verbatim, 2026-09-07:** *"thay đổi UI của calendar month view like this
design in image"*. The image was shown in conversation and **is not on disk**; the hand transcription
written for this triage is `.ai/board/tickets/UIE-06/design/README.md`.

**The transcription distinguishes deletion from silence, and only one rendered fact is deleted.** Its
§ 3 says the cell holds a day number and avatars and that *"nothing else is written in the cell: no
name, no count, no type label, no note."* Its § 5 separately lists what the image does **not show** —
a holiday, the overload threshold readout, the tentative treatment, the approved star, the empty
state, the create panel — which is silence, on the same terms as the holiday nobody would read as a
removal. **`month-cell-count` is the only rendered fact this image positively removes**, and this
document is about that one element and nothing else.

**What the count is, and what it is not.** `month-cell-count` is `src/routes/MonthView.tsx:391-395`,
rendered top-right of the cell when a day's count is above zero. Its value is a lookup into
`absenceCountsFor(entries, range, roster)` — `src/lib/data/absence.ts:197`, INV-04's single
implementation — computed once at `MonthView.tsx:225-231` and read at `:344`. The screen holds no
arithmetic of its own and says so at `:10-14`. **Removing the numeral removes a display and no
computation.** The value stays on the cell as `data-count` (`:359`), the overload comparison at `:347`
is untouched, and `absence.ts` is not opened.

**What is asserted, and it is less than it looks.** **No test in this repository addresses
`month-cell-count`.** Every count assertion — `tests/e2e/cal-04-month-view.spec.ts:211`, `:238`,
`tests/e2e/cal-08-holiday-shading.spec.ts:501` and the overload spec — reads the `data-count`
**attribute** on `month-cell`. **The suite stays green after the deletion.** That is precisely why
this needs a decision rather than a verdict at REVIEW: nothing in the toolchain would notice.

**What the count is for, stated by the ticket that shipped it.** CAL-04 AC-3 requires a cell holding
one `full` entry and one `am` entry to carry an absence count of `1.5`. **That cell draws two
avatars.** The numeral is the only thing on the screen saying the load is 1.5 and not 2, and it is
therefore the product's only rendering of INV-06 on this surface — the role the portion pill plays on
the week view.

`.ai/steward/context.md` records the observation that produced ADR-013 in those words: *a month cell
shows four avatars over a count of three*. ADR-013 resolved it with the rule at
`.ai/registry/invariants.md:125` — a view draws a member's avatar exactly when that member's entry is
counted, **so the cell and the number cannot disagree**. **That rule is not broken by this deletion.
The surface on which it was ever observable is.**

**One thing the picture gets right and it is worth saying.** The image is internally consistent with
`>` and not `>=`: against its roster of eight, day 28 carries four avatars (50%) and is **not** pink,
while day 17 carries five (62.5%) and day 29 six (75%) and both **are**. That agrees exactly with
INV-04 and with CAL-04 AC-7 (`.ai/board/tickets/CAL-04/01-plan.md:111-118`). It is the one domain fact
the picture states correctly, and it is evidence that the deletion was drawn deliberately rather than
overlooked.

## Decision

**The month cell renders no absence count. `month-cell-count` is removed from
`src/routes/MonthView.tsx`.** Four clauses bound it.

1. **`data-count` stays on `month-cell`** (`:359`), same value, from the same call. Every existing
   assertion keeps its subject and nothing is renamed.
2. **No computation changes.** `absenceCountsFor` is still called once, the overload comparison at
   `:347` is unchanged, `isOverloaded` remains the only place the state is written, and **no filter,
   sum or `.length` is introduced anywhere in the file.** The comment block at `:10-14` stays true and
   stays.
3. **`month-threshold` is NOT removed** (`MonthView.tsx:330-332`). **The image is silent about it, not
   negative** — § 5 of the transcription lists it beside the holiday and the tentative border — and
   after this decision it becomes the only thing on the screen that explains the pink. Removing both
   in one pass is the state § *Revert condition* names as the one nobody chose.
4. **The freed slot is a layout question and is answered in the ticket, not here.**
   `MonthView.tsx:389-396` is a `justify-between` row holding the numeral left and the count right.
   If this decision is accepted the right half is empty; whether the bridge badge moves into it is
   `tech-lead-design`'s at PLAN under `.ai/standards/ui-design-system.md:140-155`. **UIE-06 is planned
   on the assumption that this decision is not taken**, and must not anticipate it.

## Rationale

Four options. **Option 2 is what is proposed above, because it is what the operator asked for.
Option 1 is what both agents at this triage recommend.** Those are different sentences and both are
true; the operator resolves them.

**Option 1 — keep the count.**
*For:* it is one glyph on the densest screen in the product, in a corner that costs no avatar row. It
is the only visible statement of CAL-04 AC-3 and the only visible rendering of INV-06 on this surface.
It is the reference ADR-029 argues from (§ *Interaction with ADR-029*). And after the UIE-06 restyle it
is the only in-cell explanation of why a cell is pink.
*Against:* **the operator asked for its removal directly, with a picture that deletes it positively
rather than by omission.** That is not a small objection and it is the reason this option is not
written into § *Decision*.

**Option 2 — remove it, as § *Decision* states.**
*For:* it is what the image asks for; the cell gets its top-right corner and a line of vertical space
back for avatars, which is what `CLAUDE.md` § *Visual direction* says this grid should spend space on;
the number stays available to tests and to any future surface through `data-count`; and no arithmetic,
no seam call and no invariant moves.
*Against:* § *Consequences*, in full. The short form is that a cell with three avatars and a load of
two then says three, and nothing on the screen corrects it.

**Option 3 — remove it below the threshold and keep it on overloaded days.** *Rejected.* It makes the
numeral's presence a second signal for overload, encoding one fact twice in two ways, and teaches a
reader to read the absence of a number as *not crowded* — which is false on every zero-count day. It
also puts a conditional inside the cell for a display rule, which is where a second arithmetic
eventually gets written.

**Option 4 — replace the numeral with a `title` or an `aria-label` on the cell.** *Rejected, and it is
the option that looks like a compromise.* It satisfies nobody. A hover tooltip is not observable by
scanning, which is the property `CAL-04/01-plan.md:194-195` says this grid is built for, and an
`aria-label` stating a number no sighted reader can see makes the two audiences disagree about what is
on the screen.

**Why the recommendation is option 1, stated once and not repeated.** The picture removes the number
from the one screen that has it on the same day another picture by the same person asks for the same
number on a screen that does not (§ *Interaction with ADR-029*). Taken together the product does not
gain or lose a number; it moves one — **from the surface where it sits beside anonymous chips at the
smallest scale in the product, where it is a cheap disambiguator, to the surface where the names are
spelled out and a decimal beside three names invites the comparison ADR-029 itself accepts as
unanswered.** That looks backwards from here. It may not look backwards from the operator's chair, and
they are the ones who drew both pictures.

## Interaction with ADR-029 — the section this document exists to put in front of the operator

**Two proposals from the same day are now on the operator's desk and neither is readable alone.**
[ADR-029](ADR-029-the-week-view-renders-a-per-day-absence-count.md) proposes **adding** a per-day
absence count to the week view. This document proposes **removing** the per-day absence count from the
month view. Both are `PROPOSED`, both came from images the operator showed on 2026-09-07, and **nothing
in the loop has a stage that would make anybody read them together.**

**1. No invariant and no clause is violated by the pair.** INV-04
(`.ai/registry/invariants.md:36`) ends *"No second definition of this number exists anywhere in the
system."* It requires the number to have **one definition**. **It never requires the number to be
rendered anywhere.** ADR-029's clause 1 is about which function produces a displayed number, not about
which screens must display one. Adding `n/N` to the week view and removing the numeral from the month
cell breaks nothing in the ledger, and neither document forbids the other.

**2. But ADR-029 argues for itself from the surface this document removes.** It names the month grid
three times. Its option 2 *For* reads: *"the number **provably** agrees with the month grid because it
is the same function over the same rows"*; its option 3 *Rejected* reads that a chip count *"would
contradict the month grid for the same date"*. **Accept both and the reference surface stops printing
the number the new surface is justified by agreeing with.** The agreement stays true in code and is no
longer visible anywhere. That is not a contradiction — it is the removal of the evidence for a claim
made two hours earlier.

**3. The sharper problem: this document asks the month view to become what ADR-029 refuses to let the
week view be.** ADR-029 rejects its option 3 because *a day holding one full-day and two half-day
entries has three chips and an absence count of two* — a reader counts chips and gets the wrong
number. **Today the month cell is immune to exactly that, for exactly one reason: it prints the real
number beside the avatars.** Delete the numeral and the cell shows three avatars and nothing else, and
a reader counts three. It is **not** a second definition — `absence.ts` is untouched — it is a second
*impression*, reached by subtraction instead of by substitution, with nothing on screen to correct it.

**4. What accepting both would actually be: a swap of which screen carries INV-04's number.** The week
view gains it — new, contested, with the decimal-beside-names objection recorded as accepted rather
than answered (`.ai/board/tickets/CAL-05/01-plan.md:526-528`). The month view loses it — shipped
2026-09-04, one glyph, top-right, costing nothing. **And after both changes an overloaded month cell
has no explanation inside it at all**: the cell is pink, the count is gone, and the sidebar legend has
no overload row and no `--color-overload` token (`src/components/Sidebar.tsx:62-66`,
`src/index.css:141-143`, UIE-02 AC-11). `month-threshold` is then the only thing on the whole screen
that says what pink means, which is why clause 3 above refuses to let it go quietly.

**5. What is recommended, and it is a sequence rather than a coupling.** **Decide them separately, in
either order, but read them together once.** Nothing in this document depends on ADR-029 and nothing
in ADR-029 depends on this. If the operator wants a coherent product rather than two locally
defensible decisions, the cheap answer is to **keep the month count and let ADR-029 stand or fall on
its own merits** — that costs one glyph and preserves the surface ADR-029's own argument leans on.
**This paragraph is a recommendation and binds nothing.** The two documents are not merged, because
merging them would make one signature answer two questions.

*This section is reproduced in substance in ADR-029 § Interaction with ADR-031, so that whichever
document the operator opens first carries it.*

## Consequences

- **CAL-04's acceptance criteria are amended, and this is the substance of the decision.** AC-3's
  *"the cell for 14 April carries an absence count of `1.5`"* becomes observable only through
  `data-count`. **The plan must reword AC-3** rather than leave a criterion whose only witness is a
  test hook — `.ai/standards/ui-design-system.md:137-138` requires an acceptance criterion to be
  observable from outside the system by a reader who cannot ask a question. RULE-01: human approval;
  the row amendment owes no separate ADR.
- **CAL-04's registry row gains a line** recording that the month grid no longer displays the number
  that row introduced, and that `absenceCountsFor` is unchanged.
- **`CAL-04/01-plan.md:192` is reversed** — *"Each cell carries the date numeral top-left, the absence
  count top-right"*. That sentence is marked in § 2b as the Tech Lead's own layout and *"cheap to
  argue with"*, so reversing the **position** was always available; reversing the **presence** is what
  this document is for.
- **What gets worse, stated plainly and not softened.**
  - **A month cell with three avatars and a load of two says three.** A member holding an `am` and a
    member holding a `pm` on the same date each draw an avatar and together weigh 1 (INV-06). Nothing
    on the cell corrects the impression.
  - **INV-06 loses its only surface on this screen.** A five-day `pm` entry and a five-day `full`
    entry become indistinguishable in the month grid.
  - **An overloaded day is a colour with a thinner explanation.** `MonthView.tsx:327-329` gives the
    reason the threshold line exists at all: *"an overloaded day is otherwise a colour with no
    explanation, and the two numbers behind it are the whole of INV-04."* After this decision one of
    those two numbers is gone from the cell. Clause 3 keeps the other.
  - **The suite stays green through the change**, so the deletion is invisible to CI and to the review
    checks. That is a property of this change and a reason it needed a decision.
- **UIE-06 is unaffected either way and does not wait on this.** It is promoted on the arrangement
  half of the same request and ships a month grid that matches the picture except for one small
  numeral per busy cell. **If this is accepted after UIE-06 has planned or shipped, the removal is a
  one-line diff on a screen that has just been rebuilt** — which is cheaper than the reverse and is
  the reason the two were split rather than folded.
- **Test surface: none added, none removed, none renamed.** One element deleted. If a plan chooses to
  assert the absence, that is one line.

## Revert condition

**One occurrence.** A reader — the operator, a member or a reviewer — reading a month cell's avatar
count as that day's load, on any date holding a half-day entry, where the two differ. **The failure is
specifically a cell whose avatars outnumber its count; a cell where they agree proves nothing.** If it
happens the numeral comes back, because the only thing that ever prevented it was the numeral.

**Secondary, needing judgement rather than one incident:** if `month-threshold` is later removed or
relocated for any reason, this decision is revisited **in the same pass**. Together they leave an
overloaded cell as a pink rectangle with no explanation anywhere on the screen, and **neither change
alone produces that state** — which is exactly how a state nobody chose gets reached.

## Affected documents

**Nothing below is amended while this document is `PROPOSED`.** The list is what acceptance would
oblige, in one pass, so the operator can see the whole cost before deciding.

| File | What changes |
|---|---|
| `.ai/registry/features.md` | CAL-04's row gains the line in § *Consequences*; a new `UIE` row for the work, written at the re-triage that promotes it |
| `.ai/board/tickets/CAL-04/01-plan.md` | AC-3 reworded; the § 2b sentence at `:192` corrected |
| `.ai/board/ideas/2026-09-07-the-month-cell-number-is-what-stops-the-avatars-being-counted.md` | records the outcome; on acceptance it is re-triaged and promotes |
| `src/routes/MonthView.tsx` | `:391-395` removed; `:389` collapses to the numeral alone |
| `tests/e2e/` | nothing required; optionally one assertion of absence |

**No rule, no invariant and no other ADR is touched.** `.ai/registry/invariants.md` is not edited and
**INV-04 is satisfied rather than amended** — a screen rendering no number holds no definition of one.
ADR-029 is `PROPOSED` and is **not** superseded, amended or accepted by this document; it gains a
cross-reference and nothing else.
