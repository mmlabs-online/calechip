---
doc_version: 3
last_updated: 2026-09-08
governed_by: [RULE-01, RULE-09]
---

# ADR-029 — The week view renders a per-day absence count

## Status

`ACCEPTED by orchestrator` — 2026-09-08.

**The operator delegated the decision rather than making it, and this status says so on purpose.**
Their instruction, verbatim, 2026-09-08: *"tưj quyết đi"* — *decide it yourself*. That is the human
step the quoted paragraph below required, in words that can be pointed at, and it is what lifts the
envelope gate. **It is not a decision about the substance**: the operator did not say which way, and
nothing here may be read as their having chosen `n/N` over the standing refusal.

**So this is `ACCEPTED by orchestrator` and never `ACCEPTED by the operator`.** ADR-008's table makes
that distinction load-bearing rather than cosmetic — the second form is a claim about a person, and
writing it here would be forging a signature. Under the first form the review happens **at merge,
under CODEOWNERS, like any other registry change** (ADR-008 § *Decision*). The operator's merge of the
pull request carrying this edit is the approval; declining to merge it is a `REJECTED` that costs one
click.

**ADR-008's revert condition is pointed at exactly this document.** *"The first ADR accepted by an
agent that the operator disagrees with at merge"* — not *would have worded differently*, disagrees
with the decision — *"One occurrence restores RULE-09."* This is the first agent-accepted ADR in this
repository. If the decision below is wrong, saying so at merge is not a nuisance; it is the mechanism
working as designed.

**Decided together with [ADR-031](ADR-031-the-month-cell-renders-no-absence-count.md), which is
`REJECTED` in the same pass.** § *Interaction with ADR-031* required the two to be read together and
they were. The pair resolves to **the product keeps the month count and gains a week count** — the
sequence ADR-031 § *Interaction* item 5 names as the cheap answer, and the one both drafting agents
recommended.

**Why this one is accepted, in the decider's words rather than the draft's.** Two of the three reasons
the standing refusal rested on are **false**, and both were re-verified against the files at this
decision: `absenceCountsFor` is pure and `WeekView` already holds all three of its arguments in state,
so INV-04 is not engaged; and a count needs no `seam.getTeam()`, because the denominator is
`currentMemberCount(roster)`. **A refusal held up by two wrong reasons will keep being cited and keep
being wrong** — and option 1 leaves that comment owing a correction anyway, so the standing refusal
was not actually the free option it looks like. The third reason — a decimal beside spelled-out names
invites a comparison the screen does not explain — is **real, unmeasured, and accepted rather than
answered**, on the strength of the revert condition below, which retires the strip on the first real
report instead of explaining it.

*This section read `PROPOSED — awaiting the operator` from 2026-09-07 until 2026-09-08. The paragraph
it replaces is kept verbatim below rather than deleted: it states correctly why an agent could not
sign this document unaided, and that remained true right up to the operator's instruction.*

> **It may not be accepted by an agent, and this paragraph is the reason rather than a formality.**
> ADR-008's test is: decide inside an existing envelope, ask before changing the envelope. This
> decision reverses a refusal that three artifacts took deliberately — CAL-05's feature row, CAL-05's
> `01-plan.md`, and UIE-04's shipped AC-13 — and UIE-04's own registry row calls the footer *"a
> registry matter, not a layout one"* and instructs PLAN to stop and ask. That is the envelope.
>
> So `ACCEPTED by the operator` is the only status this document can ever carry other than
> `REJECTED`, and writing it before the operator has said so is forging a signature
> (`.ai/steward/context.md` § *Autonomy*, in those words). `ACCEPTED by product` is not available:
> that form exists for decisions inside an envelope already open, and this is not one.

**Drafted by `product` at `/triage` on 2026-09-07**, on a NEEDS-ADR verdict, from
`.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md`. The technical half of that triage
was `tech-lead-design`'s and this draft reproduces its argument, with the departures marked where they
occur.

## Context

**The operator supplied an image of the week calendar on 2026-09-07** showing a footer strip under each
day column reading `n/8 vắng`. The screen refuses that number today, and the refusal has been taken
three times:

- **CAL-05's feature row** — this view *"may render no number"* and *"never counts names"*.
- **`.ai/board/tickets/CAL-05/01-plan.md:95-97`**, which makes it an out-of-scope bullet.
- **UIE-04's AC-13**, with its supporting argument in that ticket's `01-plan.md` § 4.1.

`src/routes/WeekView.tsx:11-17` records it in the file itself: *"IT COUNTS NOTHING"* — no absence
count, no overload state, no threshold, and `seam.getTeam()` deliberately not called.

**Two of the three stated reasons do not survive re-examination, and that is what makes a decision
necessary now rather than a restatement of the refusal.**

- **INV-04 is not violated by the derivation proposed here.** `absenceCountsFor(entries, range,
  roster)` — `src/lib/data/absence.ts:197` — is the one definition, it is pure, and `WeekView` already
  holds all three of its arguments in state at `src/routes/WeekView.tsx:207`. CAL-05's own plan states
  this at `01-plan.md:528-531`, verbatim: *"INV-04 forbids a second definition; **this would not be
  one**, and it would still make two surfaces that appear to disagree while both being right. **If a
  number is ever wanted here, it is a criterion on the row** rather than an inference from the module
  being in scope."* What UIE-04 refused was the **chip-count substitute** — a day holding one full-day
  and two half-day entries has three chips and an absence count of two — and **that refusal is correct
  and is preserved here unchanged**.
- **No team read is required.** `src/routes/WeekView.tsx:11-13` treats *a count* and *a `seam.getTeam()`
  read* as the same thing. They are not: `getTeam()` supplies `overloadThreshold`, which a bare `n/N`
  does not use. The denominator is `currentMemberCount(roster)` — `src/lib/data/absence.ts:348` — from
  the member list the screen already reads.

**Both of those source facts were verified independently against the files** rather than recalled:
neither function takes a team or a threshold, and the roster and the entries are already in state.

**One reason does survive, and it is a product judgement rather than a mechanism.**
`.ai/board/tickets/CAL-05/01-plan.md:526-528` — a decimal beside a list of names invites a comparison
it does not explain. Three names under `1.5/4` reads as a contradiction to a reader who does not know
that a half-day weighs 0.5 (INV-06). **The image cannot test this objection**: it shows two full-day
chips and five empty days, so the case that decides the question is the one case it does not contain.

**A fourth consideration is new and was raised in no prior refusal.** INV-04 counts PTO and WFH alike
(`.ai/registry/invariants.md:36`), so a strip labelled *away* asserts that a member working from home
is absent. That is the confusion `src/lib/labels.ts:24-29` calls the most costly in this domain, and
the thing OPS-002 AC-7 exists to prevent. **The picture's own word, `vắng`, is wrong for the number it
labels** — independently of the language question, which § *Language* already settles against it.

## Decision

**The week view renders, in a footer strip on each day column, the absence count for that day and the
team's current member count, as `n/N`.** Four clauses are the whole of what makes it safe, and each is
written as an acceptance criterion rather than as a comment:

1. **The number is `absenceCountsFor(entries, range, roster)` and nothing else** — the same call with
   the same arguments the month grid makes. **A `week-row` count, a `people.length`, or any local
   filter or sum is forbidden.** That sentence belongs in the criterion, because a comment does not
   survive the next developer.
2. **The denominator is `currentMemberCount(roster)`.** Never a literal. The fixtures give **4**, not
   the image's 8.
3. **No threshold, no overload state, no `seam.getTeam()`.** The screen still computes no overload, so
   the second clause of UIE-04's AC-13 survives intact and only its first clause is superseded.
4. **The label may not say "away".** WFH is counted and a WFH member is working (OPS-002 AC-7,
   `src/lib/labels.ts:24-29`). The strip names the absence count as the glossary names it, or it names
   nothing at all. **It is English** — `.ai/standards/ui-design-system.md` § *Language*, the operator's
   own instruction of 2026-09-03 — so `vắng` is not available whatever noun is chosen.

**INV-04 is satisfied by this decision rather than amended, and the invariant ledger is not edited.**
That is a property of clause 1 and of nothing else: without it, this decision becomes option 3 below.

## Rationale

Four options were considered. The recommendation is **option 2**.

**Option 1 — keep refusing.** No change, no ADR, no amendment.
*For:* the week view stays the one surface in the product with no arithmetic on it; CAL-05's
decimal-beside-names objection is never put in front of a real reader.
*Against:* the operator has now asked for it directly, with a picture; and the standing refusal rests
partly on an INV-04 argument that is **not correct**, so the reason written into
`src/routes/WeekView.tsx:11-17` will keep being cited and will keep being wrong. **Choosing this option
still leaves that comment owing a correction** — the screen would be refusing the number for one good
reason instead of three, two of which do not hold.

**Option 2 — render `n/N` from `absenceCountsFor`, with no threshold and no overload state.**
*For:* one call, no new seam read, no second definition, and the number **provably** agrees with the
month grid because it is the same function over the same rows. The screen a member lands on finally
answers the question the screen is for.
*Against:* the decimal-beside-names problem is real and unmeasured; it reverses a shipped acceptance
criterion on a `DONE` ticket; and it puts a second number on the densest screen in the product, where
`CLAUDE.md` § *Visual direction* says every row costs.

**Option 3 — render the day's chip count.** **Rejected outright, and it is the option the image most
cheaply suggests.** A day holding one full-day and two half-day entries has three chips and an absence
count of two, so the strip would contradict the month grid for the same date — **INV-04's forbidden
second definition, reached without ever opening `absence.ts`**. UIE-04 § 4.1 refused this and that
refusal stands unchanged. It is named here so that nobody re-derives it and reaches the other answer.

**Option 4 — bring the overload state with it.** *Rejected as out of scope.* It needs `seam.getTeam()`
and `overloadThreshold`, it drags in the sidebar's fourth legend row, and it is a larger decision that
deserves to be taken on its own terms rather than as a side effect of a footer strip.

## Interaction with ADR-031

**Added by `product` at `/triage` on 2026-09-07, later the same day, `doc_version` 1 to 2. Nothing
above or below this section was changed, and the decision, the clauses and the status are untouched.**
This section exists because a second proposal reached the operator's desk hours after this one and the
two are not readable alone.

**The operator showed a second image the same day — of the month view — and it removes the per-day
absence count from the month cell.** That went to
[ADR-031](ADR-031-the-month-cell-renders-no-absence-count.md), also `PROPOSED — awaiting the operator`.
**So one proposal adds this number to the screen that does not have it, and the other removes it from
the screen that does.**

- **No invariant and no clause is violated by the pair.** INV-04 requires the number to have **one
  definition**; it never requires the number to be rendered anywhere. Clause 1 above is about which
  function produces a displayed number, not about which screens must display one. Neither document
  forbids the other.
- **But this ADR argues for itself from the surface ADR-031 removes.** Option 2's *For* above reads:
  *"the number **provably** agrees with the month grid because it is the same function over the same
  rows"*, and option 3's rejection reads that a chip count *"would contradict the month grid for the
  same date"*. **If both are accepted, the reference surface stops printing the number this decision is
  justified by agreeing with.** The agreement stays true in code and is no longer visible anywhere.
- **And ADR-031 asks the month cell to become what option 3 above is rejected for being.** A cell with
  three avatars and a load of two would then say three, with nothing on the cell to correct it. That is
  a second *impression* rather than a second definition — `absence.ts` is untouched either way — but it
  is the same reading failure, arrived at by subtraction instead of by substitution.
- **What accepting both would be: a swap of which screen carries INV-04's number.** This screen gains
  it, with the decimal-beside-names objection accepted rather than answered; the month grid loses it,
  after one glyph in a corner had carried it since 2026-09-04.

**Nothing here changes this decision and nothing here couples the two.** They are separable, they can
be signed in either order, and each stands or falls on its own merits. **The one thing that should not
happen is each being signed without the other having been read**, which is why the same content is in
both documents — ADR-031 § *Interaction with ADR-029* — so that whichever the operator opens first
carries it.

## Consequences

- **CAL-05's feature row is amended**: *"may render no number"* becomes *"renders the absence count for
  each day, from `absenceCountsFor` and no other source"*. RULE-01 — human approval; no separate ADR is
  owed for the row itself.
- **UIE-04's row gains a line**: **AC-13's first clause is superseded by this ADR**; its second clause,
  that the screen makes no team read, is not.
- **`src/routes/WeekView.tsx:11-17` is rewritten.** *"IT COUNTS NOTHING"* stops being true, and the
  replacement must carry the correction that a count never needed a team read — otherwise the next
  reader inherits the same wrong reason in new words.
- **What gets worse, stated plainly.** A day with one full-day and two half-day entries shows three
  chips over `1.5/N`, and the week view does not explain the arithmetic. That is CAL-05's objection,
  **accepted rather than answered**. A second number appears on the screen whose density budget is
  already the tightest in the product. And a refusal taken deliberately three times is reversed, which
  makes the next reader trust the standing comments in that file slightly less — the cost of every
  correct reversal, and worth naming because it is paid by somebody who was not in this conversation.
- **The empty-state sentence becomes decidable, and only here.** A footer reading `0/4` removes the
  ambiguity that `week-day-empty` exists to remove, so deleting *"Everybody is in."* becomes
  defensible **and follows from this decision**. It is not authorised by this ADR; it is authorised to
  be *considered* by the ticket that implements it. **Until then the sentence stays** — without the
  count, deleting it makes *an ordinary Tuesday* and *we did not look* the same column
  (CAL-05 AC-13, UIE-04 AC-10, `tests/e2e/cal-05-week-view.spec.ts:266` asserts seven of them).
  *This paragraph is a departure from the draft `tech-lead-design` supplied, which proposed replacing
  the sentence with a muted glyph inside the layout ticket while this decision was still open.*
- **Test surface: one new selector and its assertions. Nothing existing is renamed**, and
  `tests/e2e/cal-05-week-view.spec.ts:266`'s count of seven `week-day-empty` elements is unaffected
  unless the sentence is also removed, which is the separate decision above.
- **The strip pins to the column, not to the viewport.** On a busy week it goes below the fold with the
  rest of its column. That is accepted; pinning to the viewport is a different feature and is not
  proposed here.
- **This decision does not create a ticket.** On acceptance the idea is re-triaged and promotes into a
  `UIE` row carrying the four clauses above as the substance of its criteria. Nothing is built from
  this document alone.

## Revert condition

**One occurrence.** A screen in this product displaying an absence count that was **not** produced by
`absenceCountsFor` — including a chip count, a `people.length`, or a locally filtered sum. If that
reaches a pull request, this ADR is reverted and the week view goes back to rendering no number,
because the only thing separating option 2 from option 3 is a discipline that nothing in the toolchain
enforces.

**Secondary, needing judgement rather than one incident:** if the decimal-beside-names confusion that
CAL-05 predicted is reported by a real reader, **the strip goes rather than being explained.** An
explanation on the grid costs a row, and the grid is where density wins.

## Affected documents

**Nothing below is amended while this document is `PROPOSED`.** The list is what acceptance would
oblige, in one pass, so the operator can see the whole cost before deciding.

| File | What changes |
|---|---|
| `.ai/registry/features.md` | CAL-05's row amended per § *Consequences*; UIE-04's row gains the superseding line; a new `UIE` row for the work, written at the re-triage that promotes it |
| `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md` | records the outcome; on acceptance it is re-triaged and promotes |
| `src/routes/WeekView.tsx` | the `:11-17` comment block rewritten; the footer strip added |
| `tests/e2e/` | one new spec file or one new block, for the new selector |

**No rule, no invariant and no other ADR is touched.** **ADR-031 is `PROPOSED` and is not superseded,
amended or accepted by this document either** — it gains a cross-reference and nothing else, and
§ *Interaction with ADR-031* is why. ADR-005, ADR-013, ADR-014 and ADR-028 are
unaffected, `.ai/registry/invariants.md` is not edited, and **INV-04 is satisfied rather than amended**
— which is the whole argument of clause 1 and the reason this ADR is about a feature row rather than
about the ledger.
