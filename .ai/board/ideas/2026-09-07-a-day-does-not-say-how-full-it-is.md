---
stage: TRIAGE
agent: product
produced_at: 2026-09-07
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md (standing instructions in full)
  - .ai/templates/idea.md
  - .ai/templates/ticket.yaml
  - .ai/registry/decisions/ADR-000-template.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/registry/features.md (the CAL and UIE groups)
  - .ai/standards/ui-design-system.md (§ Language, § Visual specification)
  - .ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md
  - .ai/board/tickets/UIE-04/ticket.yaml
  - .ai/board/tickets/UIE-04/design/README.md
  - .ai/board/backlog.md
  - tech-lead-design's technical read of the same request, 2026-09-07
  - .ai/registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md (re-read in full
    at the re-triage of 2026-09-08, when it read ACCEPTED by orchestrator)
  - .ai/registry/features.md (the UIE group, and the two amendments ADR-029 already obliged)
  - src/routes/WeekView.tsx:11-17 (re-read on disk, 2026-09-08 — still says IT COUNTS NOTHING)
  - .claude/commands/triage.md
  - tech-lead-design's technical half of the re-triage of 2026-09-08 (PROMOTE, size S), folded in
    the same day — § Folded in at the end of this file
  - src/routes/WeekView.tsx:115, :180, :258, :280, :424, :454, :464, :515, :535-537, :714-717
    (read on disk at the fold-in, to correct one citation and check five claims)
  - src/lib/data/absence.ts:197, :343, :347-349
  - src/routes/MonthView.tsx:213, :399, :474, :523-527
  - .ai/registry/glossary.md:34
  - src/index.css:104, :109, :117-123, :174
  - src/hooks/useRoster.ts:56 and src/components/Sidebar.tsx:167-171
  - tests/e2e/cal-05-week-view.spec.ts:97-120, :247-253, :266
  - tests/absence.test.ts:151-157, :253-257
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# A day on the week screen does not say how full it is

**This is the second half of
`.ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md`, carved
out at `/triage` on 2026-09-07 so that each half could get the one verdict the gate requires.** That
file's title names two problems; they are separable, and they got different answers. The other half is
PROMOTE and is now `UIE-05`. This half is **NEEDS-ADR**, and the ADR is drafted at
[ADR-029](../../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md), status
`PROPOSED — awaiting the operator`.

**Nothing was moved out of the other file.** § *Problem* item 2 still stands where it was written and
is quoted below rather than relocated, because an artifact that is edited to fit a verdict stops being
the record of what was believed before the verdict existed.

## Problem

Quoted from § *Problem* item 2 of the parent idea, unchanged:

> **This screen will not tell anybody how full a day is.** `WeekView.tsx:11-17` and `:48-55` state it
> three times over: no absence count, no overload state, no threshold, `seam.getTeam()` deliberately
> not called, and no footer strip, because *a column ends where its content ends*. A person looking at
> Friday counts chips — and counting chips is not the same number: a day holding one full-day entry
> and two half-day entries is **three chips and an absence count of two** (INV-04, INV-06). So the one
> question the month grid answers for a date is the one question the week screen refuses for it, and
> the manual substitute is arithmetic the reader has to do in their head and can get wrong.

**The operator's picture answers it with a footer strip reading `n/8 vắng` under all seven columns.**
That is not arrangement. It is a number on a screen that was built three times over without one, and
whether it may exist at all is a registry question rather than a design one.

## Who has it

- **Anybody trying to answer "can I take Thursday off?" from the week screen** — the coordination use
  CAL-05's row was written for. They get names and no measure of the day. The month grid has the
  number; the screen a member lands on does not.
- **Every member, on the landing route, at the start of every session**, since UIE-02 made the week
  view the place the shell lands them.
- **The operator, today**, who drew the number into the picture rather than describing it — which
  makes this the strongest evidence in the file and also the least specific about what the number is.

## Evidence

**Visual reference:** `.ai/board/tickets/UIE-05/design/README.md`, § *The footer strip*.

**What it is meant to settle, and what it cannot.** It settles that the operator wants a per-day
number and where on the card they want it. It settles nothing about what the number *is*: the picture
shows two full-day chips and five empty days, so the one case that decides the whole question — what
the strip reads on a day holding a half-day entry — does not appear in it.

**Its status, exactly:**

- **The image is the operator's, was shown in conversation on 2026-09-07, and is not on disk.** The
  file above is a hand transcription written by an agent for this triage.
- **It sits at a ticket path because the *other* half of the request promoted**, and
  `.ai/standards/ui-design-system.md:115-119` names `.ai/board/tickets/<ID>/design/` as the one
  canonical home. **It specifies nothing for this idea**: there is no ticket here, and on NEEDS-ADR
  the reference is evidence about a problem, which is all it ever was
  (`.ai/standards/ui-design-system.md:112`).
- **The image was attached at exactly one stage and that stage has happened.** If this idea later
  becomes a ticket, it does not get a second image (`:121-123`).

**The rest of the evidence is source, and two claims of it were verified independently by the
dispatching session rather than recalled:**

- `absenceCountsFor(entries, range, roster)` — `src/lib/data/absence.ts:197` — and
  `currentMemberCount(roster)` — `:348` — **take no team and no threshold**.
- **`WeekView` already holds `roster` and `entries` in state** at `src/routes/WeekView.tsx:180` (the
  `phase: "ready"` union) and `:258` (the `setView` that fills it). **The address was `:207` when this
  line was written on 2026-09-07 and that was wrong — corrected in place on 2026-09-08, see
  § *Folded in* below.** The *fact* was never wrong; only the line was.
- `.ai/board/tickets/CAL-05/01-plan.md:528-531` reads, verbatim: *"INV-04 forbids a second definition;
  this would not be one, and it would still make two surfaces that appear to disagree while both being
  right. If a number is ever wanted here, it is a criterion on the row rather than an inference from
  the module being in scope."*

Those three together are why this is NEEDS-ADR rather than REJECT: **two of the three reasons the
refusal has been resting on are not correct**, and a refusal held up by a wrong reason will keep being
cited and keep being wrong.

## Impact if ignored

- **The screen keeps refusing the number for a reason that is half wrong, in a comment every later
  reader trusts.** `WeekView.tsx:11-17` conflates *a count* with *a `seam.getTeam()` read*. The next
  ticket that wants a number on this screen will read that paragraph, believe the count needs a team
  read and threatens INV-04, and either drop the idea or reach for the cheap substitute — which is the
  one thing that genuinely does violate the invariant.
- **The cheap substitute is what gets built if nobody decides.** A day holding one full-day and two
  half-day entries has three chips and an absence count of two. A footer counting the chips it has
  already rendered costs nothing, looks obviously safe, and **contradicts the month grid for the same
  date** — INV-04's forbidden second definition, reached without ever opening `absence.ts`. UIE-04
  refused it once; nothing stops the next person reaching it independently.
- **The operator asked in words and a picture, and nothing in the loop carries it.** A request that
  reaches no artifact gets asked again after the next screen is built without it.
- **The word in the picture would ship.** `vắng` — *away* — labels a sum that counts people **working
  from home**, and nobody in this chain had recorded that. See § *Constraints already known*.

## Constraints already known

Cited, not chosen.

- **CAL-05's registry row and its plan.** The row says this view *"may render no number"* and *"never
  counts names"*; `01-plan.md:95-97` makes it an out-of-scope bullet. **Reproducing the footer amends
  that row** — RULE-01, human approval, and no separate ADR is owed for the row itself.
- **UIE-04's shipped AC-13** — *"the screen still counts nothing… and makes no team read"* — would be
  **reversed on a `DONE` ticket** whose registry row records the refusal as a decision taken three
  times. That is changing the envelope rather than deciding inside it, which is ADR-008's stop-and-ask.
- **INV-04 is engaged and, on the derivation the ADR recommends, is *satisfied* rather than amended.**
  `absenceCountsFor` is the one definition, it is pure, and the screen already holds all three of its
  arguments. The ledger needs no edit — provided the acceptance criterion says the number is that call
  and forbids a local sum, a `week-row` count or a `people.length`. Without that clause the next
  developer writes the proxy and the invariant is violated with every test green.
- **INV-04 counts PTO and WFH alike** (`.ai/registry/invariants.md:36`), and **INV-06** means a
  half-day weighs 0.5 — so the number is a decimal on some days and the picture never shows one.
- **The label may not say "away".** OPS-002 AC-7 requires every screen naming an entry's type to state
  that a member working from home is working; `src/lib/labels.ts:24-29` calls the WFH/PTO confusion the
  single most costly in this domain. **No prior refusal recorded this**, and it is a finding of this
  triage rather than an inherited constraint.
- **The `8` in `n/8 vắng` does not exist.** `src/lib/fixtures.ts` holds four unremoved members of the
  main team (`:39`, `:72`, `:149`, `:319`; `:108` is another team, `:123` carries `removedAt`). The
  denominator is computed or it is wrong; nothing may be asserted from the literal.
- **`.ai/standards/ui-design-system.md` § *Language*.** `vắng` is Vietnamese, the interface is English
  on the operator's own instruction of 2026-09-03, it is lint-enforced, and `copyDebt` is empty. The
  strip's label is English whatever noun the ADR picks.
- **`.ai/standards/ui-design-system.md` § *Visual specification*, `:152-155`.** The grant to
  `tech-lead-design` covers visual arrangement and never behaviour, permissions or invariants. **A
  number on a screen is behaviour.** The grant does not reach this and cannot be stretched to.
- **`CLAUDE.md` § *Visual direction*.** Information density wins on the grid every time. A second
  number on the densest screen in the product spends part of a budget that is already the tightest
  there is — an argument against, recorded because it is real and not because it decides anything.

## Out of scope

- **The overload state, the threshold, and `seam.getTeam()`.** A bare `n/N` uses none of them. Bringing
  the overload colour to this screen drags in the sidebar's fourth legend row and is a larger decision
  that deserves its own terms rather than arriving as a side effect of a footer strip.
- **The sidebar's `Quá tải (>50%)` legend row.** Same reason, plus it is the sidebar and the operator
  said *lịch tuần*. It is the strictly more expensive of the two, because it genuinely does need the
  team read.
- **Everything UIE-05 promotes** — the viewport fill, the header strip, the chip's silhouette, the card
  radius. That ticket ships whatever this idea does, and the strip is additive to it.
- **The month and year views.** CAL-04's month cell is where the absence count already lives and
  nothing here touches it. Whatever is decided here does not travel to them by implication.
- **Vietnamese copy.** Refused in the parent idea's verdict § 3, on the same terms UIE-01 refused it.
- **Amending INV-04.** On the recommended derivation the invariant is satisfied, not changed. If a plan
  ever finds it needs to amend the invariant, that is a different and much larger decision.

## Open questions

The ADR answers 1 and 2 with a recommendation; the operator decides. Questions 3 and 4 are open in
either direction.

1. **Does the operator want the number at all, knowing it is a decimal on half-day weeks?** Three names
   under `1.5/4` reads as a contradiction to a reader who does not know a half-day weighs 0.5. This is
   CAL-05's one surviving objection, it is a product judgement rather than a mechanism, and the picture
   cannot test it because it contains no half-day.
2. **What noun goes on the strip?** Not `vắng` and not *away*. The glossary's term for the number, or
   nothing at all. This has to be picked, not inherited from the picture.
3. **Does the per-day `Everybody is in.` line go once the strip exists?** **The two are coupled and
   must not be decided separately.** A footer reading `0/4` makes the sentence redundant, so deleting
   it becomes defensible *and follows from* the count; without the count, deleting it is a straight
   loss — it is what stops *an ordinary Tuesday* and *we did not look* being the same column
   (CAL-05 AC-13, UIE-04 AC-10, and `tests/e2e/cal-05-week-view.spec.ts:266` asserts seven of them).
   **UIE-05 therefore keeps the element, the selector and the sentence, and may only de-emphasise it.**
   If this idea is accepted, the deletion is decided here, with the count.
4. **Does the strip pin to the column or to the viewport?** Pinned to the column, a busy week carries
   the footer below the fold with the rest of that column. That is acceptable and is what UIE-05's
   `min-height` implies; pinning to the viewport is a different feature and is not proposed.

---

# Triage verdict — NEEDS-ADR

**Written by `product` at `/triage` on 2026-09-07, in the same dispatch that ruled PROMOTE on the
parent idea.**

## The verdict, and the decision that must be made

**NEEDS-ADR.** The decision owed is:

> **May the week view render a per-day absence count, and if so, what is it?**

It is a registry matter on two counts. **CAL-05's feature row says this view renders no number**, so
the row is amended or the footer does not exist — RULE-01, human approval. And **UIE-04's AC-13 is a
shipped criterion on a `DONE` ticket** whose row records the refusal as a decision taken three times;
reversing it is changing the envelope rather than working inside it, which ADR-008 says an agent may
not do on its own authority.

**The ADR is drafted in full** at
`.ai/registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md` — context, four
options with their trade-offs, a recommendation with the four clauses that make it safe, consequences
including what gets worse, and a revert condition. **No homework was handed to the operator**: every
ADR in this repository was written by an agent from a sentence a human said, and this one is ready to
be accepted, rejected or corrected in one reading.

## Why this is not REJECT

Because two of the three reasons the standing refusal rests on do not survive being checked.

1. **INV-04 is not the obstacle.** CAL-05's own plan says so at `01-plan.md:528-531` in as many words.
   What UIE-04 correctly refused was the chip-count substitute — three chips against a count of two —
   and **that refusal is right and is preserved by the ADR rather than overturned**.
2. **No team read is required.** `absenceCountsFor` and `currentMemberCount` take no team and no
   threshold, and the screen already holds their arguments. `getTeam()` supplies `overloadThreshold`,
   which a bare `n/N` does not use.

A refusal standing on a reason that is not true is worse than either answer, because it will be cited
again. **REJECT would leave that comment in the file for the next reader to inherit.**

## Why this is not PROMOTE

Because a number on a screen is behaviour, the § *Visual specification* grant reaches only arrangement,
and CAL-05's row plus UIE-04's AC-13 both say the opposite of what the picture draws. Folding it into
UIE-05 to keep things moving would reverse three deliberate refusals inside a restyle, where nobody
reviews it. **That is exactly the failure the split exists to avoid.**

## Why I did not accept the ADR myself

**ADR-008's test is: decide inside an existing envelope, ask before changing the envelope.** UIE-04's
registry row calls this footer *"a registry matter, not a layout one"* and instructs PLAN to stop and
ask. Reversing a refusal that CAL-05's row, CAL-05's plan and UIE-04's AC-13 each took deliberately is
the envelope.

**So the status reads `PROPOSED — awaiting the operator`, and it may not read anything else.**
`ACCEPTED by the operator` is a claim about a person; writing it on a decision they have not made is
forging a signature, which `.ai/steward/context.md` § *Autonomy* says in those words. `ACCEPTED by
product` is not available either — that form is for a decision inside an open envelope, and this is
not one.

**The technical read reached the same conclusion in its § 4 and warned `product` not to talk itself
out of it. It did not have to; the answer is the same from this side.**

*`consulted` is `[]` above and that is deliberate: `tech-lead-design` was **co-dispatched by the same
`/triage` run**, not consulted under RULE-11. Its technical read is listed as an input, which is what
it is, and no chat budget was spent.*

## What happens next, and what does not

- **No feature row was written and no ticket shell exists for this idea.** ADR-007's PROMOTE default
  does not apply to a NEEDS-ADR verdict, and a row with nothing behind it is worse than no row.
- **Nothing is blocked in the loop.** `UIE-05` is unblocked, does not depend on this, and ships a
  screen that matches the picture minus one strip along the bottom of each column.
- **If the operator accepts ADR-029**, this idea is re-triaged — the door is `/triage` with this
  filename as the argument — and it promotes into a `UIE` row of its own, carrying the ADR's four
  clauses as the substance of its acceptance criteria, plus the CAL-05 row amendment and the
  superseding line on UIE-04's row.
- **If the operator declines it**, the correct outcome is not silence: `src/routes/WeekView.tsx:11-17`
  still needs correcting, because the screen would then be refusing the number for one good reason
  rather than for three, and two of the three it currently states are wrong. That correction is a chore
  against shipped surface, not a feature.
- **Nothing is committed.** This file and the ADR travel to the operator under CODEOWNERS.

---

## Outcome — 2026-09-08

**[ADR-029](../../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md) is
`ACCEPTED by orchestrator`.** The week view renders `n/N` per day column, under the four clauses in
that document's § *Decision*.

**The operator delegated the decision rather than making it** — *"tưj quyết đi"*, 2026-09-08. That
lifted the envelope gate § *Why I did not accept the ADR myself* describes; it did not say which way.
The status is `ACCEPTED by orchestrator` and not `ACCEPTED by the operator` for exactly that reason,
and CODEOWNERS review at merge is the approval.

**Decided in the same pass as its pair.**
[ADR-031](../../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md) is `REJECTED`,
so **the month cell keeps its numeral**. The reference surface this idea's argument leans on — the
month grid the week count provably agrees with — stays visible, which is the outcome ADR-031
§ *Interaction with ADR-029* item 5 recommended.

**This idea is now owed a re-triage and a `UIE` row**, per ADR-029 § *Consequences*: *"This decision
does not create a ticket."* The four clauses become the substance of that row's criteria. `/triage`
issues it; nothing is built from the ADR alone.

**What the acceptance already obliged, done in the same pull request:** `.ai/registry/features.md`
CAL-05's row amended and UIE-04's row given its superseding line. **What it did not:**
`src/routes/WeekView.tsx:11-17` still says *"IT COUNTS NOTHING"* and still states the two wrong
reasons. That correction belongs to the ticket, and until the ticket runs the comment is stale in the
tree — recorded here rather than left for its next reader to trip over.

---

# Re-triage verdict — PROMOTE, as `UIE-07` — **THIS IS THE LIVE VERDICT**

**Written by `product` at `/triage` on 2026-09-08, on the re-triage ADR-029 § *Consequences*
obliges.** The argument for `/triage` was this filename, so step 0 did not run and this file was
judged as it stood.

## Which verdict is live, said before anything else

**This file now carries two verdicts and a reader arriving cold must not have to work out which one
governs.** Nothing above was deleted or rewritten — `CLAUDE.md` § *Working agreements* is additive
only, and an artifact edited to agree with a later verdict stops being the record of what was
believed before that verdict existed.

| Section | Date | Standing |
|---|---|---|
| `# Triage verdict — NEEDS-ADR` above | 2026-09-07 | **DISCHARGED HISTORY.** It asked for a decision; the decision was made. It is correct as written and it governs nothing. |
| `## Outcome — 2026-09-08` above | 2026-09-08 | The record of that decision. Still true. |
| **This section** | 2026-09-08 | **LIVE.** The one verdict the `/triage` gate requires. |

The NEEDS-ADR pass is discharged in the ordinary way rather than reversed: it named the decision that
had to be made, the decision was made on 2026-09-08, and a verdict whose whole content was *"somebody
must decide X"* is spent the moment X is decided. Nothing in it was found wrong.

## The verdict

**PROMOTE, as `UIE-07`.**

**It is not a judgement call and it was not re-derived.** ADR-029 § *Consequences* states it in the
document's own words: *"This decision does not create a ticket. On acceptance the idea is re-triaged
and promotes into a `UIE` row carrying the four clauses above as the substance of its criteria.
Nothing is built from this document alone."* That sentence is what obliges this verdict; the ADR is
`ACCEPTED by orchestrator` as of 2026-09-08, so the condition it names has occurred.

**ADR-028's four-step boundary test is already spent and is deliberately not re-run.** ADR-029 names
the group in the sentence above — `UIE`, not `CAL`, not an `OPS` chore — and re-running a test whose
answer a decided ADR already records is how a settled question quietly acquires a second answer.

**Next free number, counted on disk rather than recalled:** `.ai/registry/features.md` § *UIE* holds
six rows, `UIE-01` to `UIE-06` at `:149-154`, and all six are `DONE`. `UIE-07` is the next.

## What was written, and where

- **`.ai/registry/features.md`** — one new row, `UIE-07`, `Status: PLANNED`, under `## UIE`. It cites
  this idea filename in `Notes`, which under ADR-007 is the only provenance a reviewer has, and it
  cites ADR-029 as the decision that obliges it. The four clauses are carried there as the substance
  of the criteria, not as criteria — those are `tech-lead-design`'s at PLAN.
- **`.ai/board/tickets/UIE-07/ticket.yaml`** — the shell, `state: BACKLOG`, Definition of Ready items
  1, 3, 4 and 6 filled (ADR-010). Items 2 and 5 are left as the template ships them.
- **`.ai/board/backlog.md`** — one row under `## BACKLOG`, at position 2 behind `BUG-002`.

**Two registry amendments ADR-029 obliged were already done in the pull request that accepted it, and
were verified rather than duplicated at this triage:** CAL-05's row now reads *"…from
`absenceCountsFor` and no other source"*, and UIE-04's row carries its superseding line saying AC-13's
first clause no longer holds while its second survives. Neither row was touched by this run.

## What the row must carry, and why each clause is load-bearing

The substance is ADR-029 § *Decision*'s four clauses. They are reproduced on the row and in the ticket
shell rather than summarised, because the value of clause 1 in particular is in its exact wording.

1. **The number is `absenceCountsFor(entries, range, roster)` and nothing else** — a `week-row` count,
   a `people.length`, or any local filter or sum is forbidden. **This is the clause the invariant
   hangs on.** ADR-029:133-134 says INV-04 is *satisfied* by this decision rather than amended, and
   that the ledger is not edited — *"That is a property of clause 1 and of nothing else: without it,
   this decision becomes option 3 below."* Option 3 is the chip count, which is INV-04's forbidden
   second definition, and one occurrence anywhere in the product is ADR-029's revert condition.
   The ADR is explicit that this sentence belongs in the criterion because *"a comment does not
   survive the next developer"*.
2. **The denominator is `currentMemberCount(roster)`, never a literal.** The fixtures give **4**, not
   the image's 8.
3. **No threshold, no overload state, no `seam.getTeam()`.** UIE-04's AC-13 keeps its second clause
   intact; only its first is superseded.
4. **The label may not say "away".** WFH is counted and a WFH member is working — OPS-002 AC-7 and
   `src/lib/labels.ts:24-29` — and it is **English** (`.ai/standards/ui-design-system.md`
   § *Language*), so `vắng` is unavailable whatever noun is chosen.

## The three things carried into the shell that PLAN would otherwise rediscover

- **`src/routes/WeekView.tsx:11-17` is rewritten by this ticket.** Re-read on disk at this triage: it
  still opens *"IT COUNTS NOTHING"* and still gives the two reasons ADR-029 found false. ADR-029
  § *Consequences* assigns the rewrite here **and** requires the replacement to carry the correction
  that a count never needed a team read — otherwise the next reader inherits the same wrong reason in
  new words.
- **The empty-state sentence is an open decision for PLAN, and it is authorised to be *considered*
  rather than decided.** A footer reading `0/4` makes deleting *"Everybody is in."* defensible and
  following from this decision — but **until the ticket decides, the sentence stays**, because
  without the count deleting it makes *an ordinary Tuesday* and *we did not look* the same column
  (CAL-05 AC-13, UIE-04 AC-10, and `tests/e2e/cal-05-week-view.spec.ts:266` asserts seven
  `week-day-empty` elements). This idea's § *Open questions* item 3 is therefore answered only in
  part: the coupling is settled, the deletion is not.
- **ADR-029's own *what gets worse* list travels with the row rather than being left to be
  rediscovered at review.** A day with one full-day and two half-day entries shows three chips over
  `1.5/N` and the screen does not explain the arithmetic — CAL-05's objection, **accepted rather than
  answered**; a second number lands on the densest screen in the product, where `CLAUDE.md`
  § *Visual direction* says every row costs; and a refusal taken deliberately three times is
  reversed, which costs the next reader some trust in that file's standing comments.

## What this verdict does not do

- **It does not write an acceptance criterion.** The four clauses are the *substance* of the criteria
  and are quoted as such. Turning them into `Given/When/Then` is `tech-lead-design`'s at PLAN, from
  the registry row.
- **It does not size or place the ticket.** `size_estimate` is left as the template ships it, and
  `backlog.md` is ordered by a human — `UIE-07` is row 2 because `BUG-002` was already row 1, not
  because anybody placed it.
- **It does not amend an invariant.** INV-04 is satisfied, not changed, and `.ai/registry/invariants.md`
  is not edited by this run.
- **It does not touch CAL-05's or UIE-04's rows.** Their ADR-029 amendments landed already.

*`consulted` remains `[]` above, deliberately and for the same reason as the first pass:
`tech-lead-design` was **co-dispatched by the same `/triage` run** rather than consulted under
RULE-11, so no chat budget was spent and no consultation edge was walked.*

---

## Folded in — the technical half, 2026-09-08

**`tech-lead-design`'s half of this same re-triage returned PROMOTE, size S, and found nothing
contradicting ADR-029.** The verdict above is unchanged by it and was not re-derived. This section is
additive: nothing above was rewritten except the one citation named below, which was wrong.

### The one thing found wrong, and where the wrong copy survives

**`src/routes/WeekView.tsx:207` does not say what three documents claim it says.** That line is a
comment about the `landingDay` memoisation (`:207-210`); it has nothing to do with the roster. The
*fact* it was cited for is true — the screen already holds roster and entries in state — and the
correct addresses are **`:180`**, the `phase: "ready"` union carrying `roster`, `entries` and
`holidays`, and **`:258`**, the `setView` that fills it from `seam.listMembers()` and
`seam.listTeamEntriesOverlapping(range)` at `:252-256`.

Corrected in this file's § *Evidence* and in `UIE-07`'s registry row and ticket shell, all three of
which are mine and uncommitted. **Two copies survive and are deliberately not touched:**

- **`.ai/registry/decisions/ADR-029-…:87`** — `.ai/registry/decisions/` is human plane under RULE-01,
  and **an accepted ADR is not edited to fix a line number**. It is recorded here instead, so the
  divergence is visible rather than silent. The sentence around it stays true.
- **`.ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md:403`**
  — the parent idea, shipped with `UIE-05` in PR #72. It is not a file this run created, so it is not
  rewritten (`CLAUDE.md` § *Working agreements*, additive only).

**Anybody re-citing this fact should cite `:180` and `:258` and not any of the three older copies.**

### What the technical half added, and where it went

The engineering detail is carried in `.ai/board/tickets/UIE-07/ticket.yaml`, which is what PLAN reads
— § 9 (paths, sizing signal, the selector, the two assertions that hold clause 1), § 12 (five things
ADR-029 left underspecified), § 13 (the denominator, and `n/0`), § 14 (the empty-state
recommendation). It is not duplicated into this file. Four findings belong to the *problem* rather
than to the build and are recorded here:

- **The cheapest wrong path is still open and it now has a name.** The `absent` map is already in
  scope at `src/routes/WeekView.tsx:280`, so a developer can sum weights out of it in four lines —
  **a local sum, forbidden by clause 1 and by ADR-029's revert condition, and it would pass every
  existing test.** § *Impact if ignored* above predicted the chip count; this is the same failure with
  the chip count closed off, and it is why clause 1 has to be a criterion.
- **Open question 2 is worse than it looked, and the answer this triage now recommends is *no noun*.**
  Clause 4 forbids "away" and offers the glossary's name or nothing at all — but the glossary's name
  is **"Absence count"**, glossed *số người vắng* (`.ai/registry/glossary.md:34`), and in English it
  carries exactly the claim about a WFH member that clause 4 exists to prevent. **A bare `n/N` with no
  visible noun satisfies both halves of the clause and spends the least density**, with the glossary's
  term in the accessible name only. PLAN writes it as a criterion; it cannot be inherited.
- **Open question 3's density argument does not survive being located on the screen.** *"Everybody is
  in."* renders only when `people.length === 0` (`:515`) and the strip pins to the bottom of a column
  UIE-05 made at least a viewport tall — so the two are only ever co-visible **on a column with
  nothing else in it**. The redundancy costs a row exactly where there is spare room and costs nothing
  on the crowded columns `CLAUDE.md` § *Visual direction* is written about. Recommendation: the
  sentence **stays** and the deletion is deferred. § 14 of the shell carries it, with the cost.
- **Open question 4 is answered on disk rather than by argument.** UIE-05 shipped
  `xl:grid xl:min-h-full xl:grid-cols-7` (`:424`) with each day a `flex min-w-0 flex-col` section
  (`:454`); grid items stretch, so `mt-auto` pins a footer to the column's bottom edge — the same
  treatment the header strip already gets at `:464` — and below `xl` the stack is content-height and
  `mt-auto` is inert. **No new wrapper and no `overflow` change**, so the strip is additive to UIE-05
  rather than a re-layout of it.
