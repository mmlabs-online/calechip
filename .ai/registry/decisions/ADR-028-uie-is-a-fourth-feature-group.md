---
doc_version: 3
last_updated: 2026-09-05
governed_by: [RULE-01, RULE-09]
---

# ADR-028 — `UIE` is a fourth feature group, for work whose deliverable is how a surface looks

## Status

`ACCEPTED by the operator` — 2026-09-05.

**Recorded, not authored.** The operator's instruction, verbatim, on this question and no other:

> nhưng ticket liên quan UI enhancement tôi đề nghị mở 1 feature group riêng sử dụng UIE (UI
> enhancement)

That sentence is what makes this a recording rather than an authoring. It names the three letters, it
names the expansion, and it names the shape of the change — a feature group of its own — so nothing
in the Decision below is inferred from a preference the operator did not state. What *is* inferred,
and marked as such where it appears, is the boundary test and the treatment of the already-issued
`OPS` IDs: the operator did not speak to either, and both are consequences an agent may settle inside
the envelope the quote opens (ADR-008).

`.ai/steward/context.md` permits the steward to record a decision the operator made in words that can
be pointed at, and forbids writing one on their behalf. The quote above is the thing pointed at.

## Context

**Three groups were fixed on 2026-08-31** — `CAL`, `ADM`, `TEA` — chosen by the operator from options
of three, four and six. The cost of under-splitting was written into `.ai/registry/features.md:77` at
the time and stands unchanged: v1 has six areas of requirement and three groups, so most tickets are
`CAL-nn`, and a prefix that stops distinguishing anything stops carrying information.

**Two other schemes sit beside those three, and neither is a feature group.**
`.ai/01-operating-model.md:317` declares `BUG-nnn` for defects and `OPS-nnn` for chores. Both are
ticket IDs only. Neither appears on the machine-readable prefix line in `.ai/registry/features.md`,
so neither has a row in the feature registry and **neither is policed by check D1** — an `OPS-nnn`
citation that resolves to nothing has never failed an audit, and cannot.

**A restyle arrived on 2026-09-05 and was filed under that second scheme.** Triage returned PROMOTE
on `.ai/board/ideas/2026-09-05-the-first-screen-does-not-look-like-the-product.md` and created a
chore ticket in the `OPS` series with no feature row, following the precedent `BUG-001` and `OPS-002`
had set. The argument for doing so is written out at length in three places: the idea file's verdict
section, and a paragraph appended to each of the `TEA-01` and `TEA-05` rows in
`.ai/registry/features.md`. It reasons that the registry records what the product *contains*, that a
row reading *"the sign-up screen looks like the product"* would file an appearance as a capability,
and that a chore therefore belongs in the `OPS` series.

**The operator overruled that**, in the words quoted above. This ADR records the overruling and
settles the three questions it leaves open: where the boundary runs, what happens to the IDs already
issued, and what has to land together so the audit does not break.

## Decision

`UIE` — *UI enhancement* — becomes the fourth declared feature group. It is added to the
machine-readable prefix line in `.ai/registry/features.md`, gains a row in the prefix table and a
`## UIE` section of its own, and its IDs are issued by `product` at triage exactly as the other three
are (ADR-007). The prefix set is now four: `CAL`, `ADM`, `TEA`, `UIE`.

### The boundary, as a test rather than a definition

Applied in this order. The first question that answers *yes* decides the prefix.

1. **Does something written down say what this surface should be, and does the surface not match
   it?** Then it is a defect — `BUG-nnn`. A stated acceptance criterion, an invariant, or a standard
   the surface was built against. The signal is that a reader can point at the contradiction without
   exercising taste.
2. **Could the product do something afterwards that it could not do before?** Then it is a
   capability — `CAL`, `ADM` or `TEA`, by area. **A new capability brings its own screen, and that
   screen is part of the capability**, not a separate `UIE` row. This is the boundary most likely to
   be got wrong, because almost every capability ticket contains visual work.
3. **Is the deliverable the appearance or the interaction of a surface that already exists, such
   that more than one output would be acceptable and somebody has to look at the result and judge
   it?** Then it is `UIE-nn`. The test is the judgement, not the pixels: a restyle, a density pass, a
   layout rework, an interaction that is being designed rather than transcribed.
4. **Otherwise it is `OPS-nnn`** — mechanical work with no design decision in it. There is one
   acceptable output and it can be reached without taste: a translation sweep against a written
   standard, a dependency bump, a rename, a lint fix.

The distinguishing question between 3 and 4 is *"is a design decision being made here"*, and the
usable form of it is: **could two competent people do this work and produce visibly different results
that are both correct?** If yes, `UIE`. If no, `OPS`.

### `OPS-001` and `OPS-002` are not renumbered

`.ai/registry/features.md:81` already states the principle, written for a hypothetical `CAL` split
and applying unchanged here: **IDs already issued keep their prefix, so the set is mixed rather than
migrated.**

`OPS-002` — *UI copy to English* — is the awkward case and is named here so nobody re-derives it and
reaches the other answer. It is UI-adjacent, and a reader scanning for visual work will find it. It
stays `OPS` for two independent reasons, either sufficient:

- **It comes out `OPS` under the test above anyway.** Its target is dictated by a written standard,
  the language section of `.ai/standards/ui-design-system.md`; there is one acceptable output and no
  design decision is made. Two people doing it produce the same result.
- **Renumbering would break every citation and change no reading.** `OPS-002` is cited by name in the
  `Notes` of **seven** feature rows — `CAL-01`, `CAL-02`, and all five `TEA` rows — plus its own
  ticket shell and three paragraphs of `.ai/board/backlog.md`. `OPS-001` is cited by five. Not one of
  those cells would read differently after a renumber.

`BUG-001` likewise stays. Nothing already issued moves.

## Rationale

**Option A — keep the chore treatment, and refuse the request.** Rejected: the operator asked for the
opposite, and the request has a real argument behind it that the `OPS` treatment answered badly.
Under `OPS`, visual work is invisible in the feature registry, so a reader asking *what has this
product's interface been through* has only ticket folders and backlog archive rows to read; and
because `OPS` is undeclared, a dangling `OPS-nnn` citation is never reported by any check.

**Option B — no new group: file visual work as a row in the capability group of the surface it
touches.** A restyle of the sign-in screen becomes a second `TEA` row. Rejected on two costs. It
files an appearance as a capability inside the very group that already owns that surface's behaviour,
so a group whose rows meant *one thing the product can do* stops meaning that. And it does not
survive a restyle that crosses areas: the current one spans sign-in and sign-up and so happens to sit
inside `TEA`, but a density pass over the calendar and the admin screens would have to be split
across `CAL` and `ADM` or arbitrarily assigned to one of them.

**Option C — declare `OPS` and `BUG` as feature prefixes instead**, so D1 polices them and they gain
rows. Rejected. It does not give what was asked for — the operator asked for a feature group, whose
rows carry `Status`, `Invariants touched` and `Notes` in `.ai/registry/features.md`, and defects and
chores are deliberately not that. It is also expensive in one step: every existing `OPS-nnn` and
`BUG-nnn` citation across the registry and the board becomes a D1 error the moment the prefixes are
declared, and clearing it means backfilling four rows for tickets that are already merged.

**Option D — `UIE`, and this is the decision.** It gives visual work a place in the registry without
redefining what the three capability groups mean, and it costs one prefix and one section. Its costs
are below and none of them is hidden.

## Consequences

### The one that can break the build, and it has an ordering constraint

Check D1 builds its group set by reading the `<!-- id-prefixes: ... -->` marker out of
`.ai/registry/features.md` — `scripts/check-docs.mjs:154` — and then reports, at
`scripts/check-docs.mjs:196`, any document citing an ID in a declared group that has no row in that
file. That file itself and `.ai/templates/` are the only exemptions.

**Declaring the prefix on its own breaks nothing.** What breaks the audit is the first document that
cites a `UIE-nn` before that row exists — and the handover that follows this ADR rewrites the two
`TEA` `Notes` paragraphs, the idea file's verdict and one `.ai/board/backlog.md` row to point at
exactly such an ID. **So the first row and every citation of it must land in the same change.** The
window between them is a red audit, and there is no way to narrow it other than doing both at once.

A second, quieter constraint lands in the same place: a real-file test at
`scripts/tests/check-docs.test.mjs:240` asserts in both directions that the declared prefixes and the
`##` group section headings agree. A prefix declared with no section fails it. Both the prefix and
its section are written in the change that carries this ADR, so that test stays green.

### What gets worse

- **It narrows nothing about the problem `.ai/registry/features.md:77` already records.** Most
  tickets are still `CAL-nn`. `UIE` takes work out of the `OPS` series, not out of `CAL`. There are
  now four groups carrying the same imbalance that three carried, and the fourth is the smallest.
- **The boundary is a judgement call, made once, by one agent, under no gate.** `product` applies the
  test at triage. Nothing downstream re-checks it, and no check can — the test turns on whether a
  design decision is being made, which is not a property of any file. A wrong call is cheap to make
  and awkward to undo: once the row is issued the ID is permanent, per the no-renumbering rule
  restated above, so a misfiled ticket is corrected by deferring a row and issuing another, which
  leaves both standing in the registry.
- **The repository now holds both arguments, and a reader has to know which one won.** The chore
  reasoning is not merely obsolete — it was correct under the model as it stood earlier the same day,
  and it is written out persuasively in three places. Those three are rewritten by the handover, but
  the earlier form survives in git history and in the pull requests that carried it. This ADR is the
  marker that says the second answer is the live one. **Where that reasoning is rewritten it is not
  deleted**, on the same principle the `TEA-01` and `TEA-02` status corrections already follow.
- **`UIE` rows will carry an empty `Invariants touched` almost always.** A restyle that changes an
  invariant is not a restyle. A column that is structurally empty for a whole group trains a reader
  to stop reading it, and there is no fix that does not make the table inconsistent with the other
  three groups. Recorded, not solved.
- **A fourth prefix is a fourth thing `product` chooses between at triage**, and the new one is the
  only choice in the set that turns on intent rather than on subject area.

### What gets better

- **Visual work becomes policed.** A `UIE-nn` citation that resolves to no row fails the audit. No
  `OPS-nnn` or `BUG-nnn` citation ever has.
- **A shipped restyle is recorded where a reader looks for what the product is.** It gains a `Status`
  that reaches `DONE` at ship, and a `Notes` cell citing the idea file it came from — the provenance
  ADR-007 requires of every row, which the chore treatment had to substitute with a hand-written
  sentence inside somebody else's `Notes` cell.

## Revert condition

Any one of the three below. Each is readable off `.ai/registry/features.md` without a judgement call.

1. **A row is re-filed after its ID was issued** — a `UIE-nn` row goes `DEFERRED` and the same work
   reappears under `CAL`, `ADM` or `TEA`, or the reverse. **One occurrence.** This is the "cheap to
   make, awkward to undo" cost above actually landing.
2. **Three consecutive `UIE` rows carry a non-empty `Invariants touched`.** The group has drifted
   into capability work and step 2 of the test is not being applied.
3. **The `UIE` table holds fewer than two rows on 2026-12-31.** The group was not needed, and a
   prefix that names one ticket distinguishes nothing.

**What happens when one is observed:** the group is not deleted and nothing is renumbered — IDs
already issued keep their prefix either way. This ADR is superseded by one that either narrows the
test at the step that failed, or returns new visual work to the `OPS` series and leaves the `UIE`
rows standing as a closed set.

## Affected documents

| File | `doc_version` |
|------|---------------|
| `.ai/registry/features.md` | 2 → 3 — the prefix marker, the prefix table, the paragraph recording the original three-way choice, and a new `## UIE` section with no rows |

**No change is required to `.ai/01-operating-model.md`.** Its ID scheme section states that a ticket
ID equals its feature ID in the 1:1 case and then enumerates only the non-feature forms — `BUG-nnn`,
`OPS-nnn`, `ADR-nnn`. `UIE` is a feature prefix, so it is covered by the first sentence and belongs
on the prefix line in `.ai/registry/features.md`, which is the single place that list is kept.

**No rule changes.** RULE-01 already requires an ADR for a registry change that is not a feature or
glossary row, which is what this is; nothing about how prefixes are declared or policed is altered.
ADR-007 continues to give the row itself to `product`, and this change deliberately writes none.
