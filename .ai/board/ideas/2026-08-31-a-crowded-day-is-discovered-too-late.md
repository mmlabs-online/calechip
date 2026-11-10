---
stage: TRIAGE
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/registry/glossary.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-010-triage-creates-the-ticket-shell.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - .ai/board/backlog.md
  - .ai/board/ideas/2026-08-31-the-team-cannot-see-its-own-shape.md
  - .ai/board/tickets/TEA-01/02-design.md
  - .ai/01-operating-model.md
  - .claude/commands/triage.md
consulted:
  - tech-lead-design
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# A crowded day is discovered after it is too late to change anyone's mind

## Problem

At the moment a person is choosing a date to be away — the only moment when the choice is still
free — they cannot see how many of their teammates have already chosen the same date, or who those
people are. They find out afterwards, usually days before, when at least one person has already paid
for something.

Everyone independently targets the same bridge day for the same reason, and each of them is making a
locally sensible choice with no way to see the other five people making it.

Stated as what a person cannot do: **a member cannot tell whether the day they are about to pick is
already crowded, and a lead cannot tell which upcoming days have become crowded.**

There is a second, smaller absence inside the same problem: the threshold that defines "crowded" is
meant to be configurable and there is nowhere for an admin to set it. A warning with no settable
threshold is a hard-coded opinion, so the two are recorded together rather than split — the first
cannot ship honestly without the second.

## Who has it

- **Every member, every single time they create an entry.** This is the highest-frequency moment in
  the product and the one the brief cares most about.
- **The lead**, continuously and passively. The brief says plainly they have no way to look at the
  coming quarter and warn anyone early.
- **The admin**, once at setup and rarely after, to decide what fraction of the team being away is
  too many for this particular team.

## Evidence

- The brief's problem section names the specific failure: four or five people out on the same day,
  found close to the date, with no time to hand work over.
- Brief goal 2 is written as a timing claim rather than a feature: every day over the threshold is
  detected **at the moment of registration**, not afterwards.
- **INV-04 and INV-05 already exist and have no surface.** INV-04 defines the absence count and
  insists there is exactly one definition of it in the whole system; INV-05 makes a tentative entry
  count like any other. Both were written for this warning.
- The charter's sixth refusal exists specifically to constrain this feature, which means the risk in
  it was recognised before it was built.

## Impact if ignored

The rest of the product becomes a record rather than a coordination tool: it will faithfully show
that five people are away on 30/4 and will do so on 29/4. Handovers stay rushed, deadlines keep
slipping, and the negotiation that the brief describes as the real cost — *"em đặt vé rồi anh ơi"* —
happens exactly as often as it does today, but now with a calendar that predicted it and said
nothing.

The bridge-day case degrades worst, because it is precisely where the choices are simultaneous and
independent.

## Constraints already known

- **Charter refusal 6 — a warning never blocks an action.** This is the boundary the whole idea sits
  inside. The warning is shown in detail and the person can always save. The charter states why: the
  moment the system can refuse a plan, it has become the approval gate that refusal 2 forbids.
- **INV-04** — one definition of the absence count, sum of 1 per `full` and 0.5 per `am` or `pm`, PTO
  and WFH alike, rejected entries excluded. The number in the warning, the number in a month cell and
  the number in any future notification are the same number, computed once.
- **INV-05** — tentative counts. A warning that discounted tentative entries would defeat the reason
  tentative exists.
- **The threshold is not an invariant.** `.ai/registry/invariants.md` records it as considered and
  rejected: it is configurable, default 50%, set by an admin.
- **What the threshold multiplies is settled and has a stated cost.** The team's **current** member
  count, read at evaluation time — so when somebody joins or leaves, a past date can flip between
  overloaded and normal. Recorded in the INV-04 note and in `.ai/standards/data-model.md`.
- **The absence count has no column.** `.ai/standards/data-model.md` records it as computed on read,
  deliberately, because storing it would create a second thing to keep true.

## Out of scope

- **Notifying anyone.** Telling a lead that a new overloaded day appeared, or nudging a member about
  next month's bridge days, is P1 in the brief and a different mechanism (a channel, a schedule, a
  delivery guarantee). This idea is about what a person sees while they are already looking.
- **Different thresholds for different periods** — a release week capped at 20%. Explicitly P2.
- **Role-based constraints** — "these two may not be away together". P2.
- **Preventing, blocking, queueing or requiring justification for a save.** Charter refusal 6.
- **Detecting bridge days.** A separate idea; this one consumes the marking if it exists.

## Open questions

1. ~~**Do a removed member's future entries still count toward the numerator?**~~ **Answered by the
   operator, 2026-08-31: they do not count.** The entries stay in the data and stay visible, but they
   leave the absence count the moment the member is removed, so numerator and denominator read the
   same set of current members and the ratio cannot disagree with itself. INV-04's note today records
   the denominator only; extending it to the numerator is a registry amendment and needs an ADR under
   RULE-01 — raise it at triage, not here. The same answer applies to the team-membership idea.
2. **What does the warning say for a multi-day range where only some days are over?** The brief's
   example is a single date. A five-day range crossing two crowded days needs a decision about
   whether it warns once, per day, or lists the days.
3. **Does the warning name people whose entries are still pending?** INV-04 counts pending and
   approved alike, so the number includes them; whether the listed names distinguish a settled
   absence from a pending one is a separate choice, and it interacts with the approval star.
4. **Where can an admin set the threshold, and is it per team?** v1 has one team, but INV-07 makes the
   team a real property of the data, and a threshold stored globally would have to move later.

## Triage verdict: PROMOTE

**Decided 2026-08-31 by `product` and `tech-lead-design`**, running the two halves independently and
then reconciling. Two feature rows were written to [.ai/registry/features.md](../../registry/features.md)
under ADR-007 — **CAL-07** and **ADM-01** — each citing this file in `Notes`, and a ticket shell and a
backlog row exist for each under ADR-010. **ADM-01 is the first row in the `ADM` group.**

Both halves reached PROMOTE, with the same two rows, the same dependencies and the same disposition of
every open question. Where they differed it was in emphasis, and each difference is recorded below
where it lands rather than collected into a disagreement section.

### The split is mechanical, and the bundling survives as a release claim rather than a dependency

This idea deliberately bundled two things and said the first *"cannot ship honestly without the
second"*. **Definition of Ready item 6 requires one feature group per ticket**, and these are two
groups: the warning is calendar-side (`CAL`), the threshold setting is admin-side (`ADM`). That
settles the split without an argument about scope. The permission table agrees, and it is the same
test that split CAL-02 from CAL-03: `Read the overload threshold` (✅ / ✅) and `Set the overload
threshold` (❌ / ✅) are two rows in
[rbac-and-security.md](../../standards/rbac-and-security.md).

**The idea's claim is true of the release and false of the ticket.** `team.overload_threshold` is
`numeric not null default 0.5`, so CAL-07 reads a configured value from its first day and is not a
hard-coded opinion; what the product lacks without ADM-01 is anyone able to *change* it. Making CAL-07
depend on ADM-01 would serialize an admin screen in front of the highest-frequency member-facing
moment in the product for a non-technical reason. `depends_on` therefore does not carry it, and this
paragraph is why.

### The rows

| ID | What it is | Group |
|---|---|---|
| CAL-07 | The warning raised inside CAL-01's form, over the range being chosen, before anything is saved | CAL |
| ADM-01 | The admin surface that sets `team.overload_threshold` | ADM |

**CAL-07 is smaller than this idea presents, and saying so is part of the verdict.** It adds no read,
no policy, no column and no arithmetic — `schema_delta: none`, and the entire count is CAL-04's. It
stays a feature rather than a hover handler for one reason, the prospective term (below), and because
charter refusal 6 needs a row it can be tested on. It should be sized at SPEC in that knowledge.

### Three constraints that bind CAL-04 before CAL-04 is designed

Found by `tech-lead-design`, and **written into CAL-04's `Notes` in this run rather than left for
CAL-07's DESIGN.** If they arrive later, CAL-04 will already have been built the other way and this
feature needs a second code path — which is the exact failure CAL-04's `Notes` were written to
prevent.

1. **The count function is pure and takes rows** — `absenceCountsFor(entries, range, roster)`, with
   every fetch outside it. Two structural reasons: a function that fetches its own rows **cannot be
   called with an unsaved entry**, and CAL-07's whole job is the count a day will have *if the draft
   is saved*; and a pure function taking rows cannot live in `supabase.ts` or `mock.ts` at all, which
   disposes of the seam-parity trap by construction rather than by discipline.
2. **It returns a per-date series, `Map<date, count>`, not a scalar.** *Range-shaped, not
   date-shaped* was ambiguous between *takes a range* and *returns a series over the range*. The month
   grid needs one number per cell, so it needs the series — and open question 2 below is decided by
   this return type rather than by copy.
3. **The comparison is `count / currentMembers > threshold`, strictly greater.** The threshold is a
   share and the count is a headcount; `glossary.md`'s *Overloaded day* says the count *exceeds* the
   threshold. Six members at `0.5` with a count of `3.0` is **not** overloaded. The division is
   invisible in the field names, and `>` against `>=` is one whole person on a small team.

### The `team` table needs a grant as well as a policy, and an update policy is wider than it reads

Two findings from `tech-lead-design`, confirmed against
[.ai/board/tickets/TEA-01/02-design.md](../tickets/TEA-01/02-design.md) rather than recalled.

- **A policy alone reads nothing.** That migration does `revoke all on public.team, public.member,
  public.allowed_email from anon, authenticated` and then grants `select` on `member` and
  `allowed_email` only. Reading `overload_threshold` therefore needs `grant select on public.team to
  authenticated` **and** a select policy.
- **An RLS `UPDATE` policy is row-level, so it permits updating every column of the row it admits —
  including `name`.** No permission row anywhere allows renaming the team. ADM-01 therefore needs
  `grant update (overload_threshold) on public.team to authenticated` as a column privilege beside the
  policy, or *set the threshold* silently becomes *edit the team row*.

**Ownership, settled here:** **CAL-04 owns the `team` select policy and its grant**, because the owner
should be the first consumer so the policy is exercisable at that ticket's own QA gate — which closes
the third `TODO(project):` that stood on CAL-04. **ADM-01 owns the update policy and the column
privilege**, and nothing else on that table.

### INV-04's numerator: a stop-and-ask, and it is with the operator now

**Both halves reached this independently and it does not block the verdict — it blocks READY**, on
CAL-07 and on CAL-04, where the same marker already stands.

The operator decided in words on 2026-08-31 that a removed member's future entries **do not** count
toward the numerator. `.ai/registry/invariants.md` records the denominator only. Extending INV-04 is a
registry amendment, and the reasoning that settles who may write it is this:

- **ADR-008 grants an agent the power to *accept* an ADR.** `invariants.md` withholds the power to
  ***author*** one, for that file specifically, in its own words: *"it does not author the ADR
  itself"*. Both hold at once; they are about different acts.
- **ADR-011 set the precedent this morning**, refusing exactly this move on INV-01 rather than carving
  rejected entries out of the constraint.
- **RULE-01 v2's carve-out is feature and glossary rows.** An invariant row is neither.

Two things must travel with the question, and both are `tech-lead-design`'s.

- **The amended text must say "evaluated when the count is read."** *"Belonging to a current member"*
  is otherwise ambiguous between *removed as of the date being counted* and *removed as of now*, and
  the denominator is already fixed as the latter — `removed_at is null`, evaluated at read time, per
  the INV-04 note and `data-model.md`.
- **`glossary.md`'s *Absence count* row restates the formula with no member filter.** Glossary rows
  are agent-writable under RULE-01 v2 while the ledger row is not, so an agent could mechanically
  amend the glossary into contradicting the ledger. **Neither should be touched until both can be.**

The concrete cost of the gap, so it is not abstract: a removed member's entries inflate the numerator
while their head leaves the denominator. Six members, one removed with future PTO — the day reads
4 ÷ 5 = 80% where the truth is 3 ÷ 5 = 60%. On CAL-04 that is a wrong cell; on CAL-07 it is a wrong
interruption at the only moment the choice is still free. It also lands unmarked on **TEA-04**, whose
`Notes` state the denominator half correctly and are silent on the numerator.

**No ADR is drafted here.** The coordinator is putting the question to the operator separately.

### Charter refusal 6, rendered as acceptance criteria

A principle a Developer cannot fail is not a control. Seven testable conditions, and the story must
carry them:

1. **The save control is enabled at all times, and its label does not change when a warning is
   showing.** No *"Save anyway"* — a relabelled button asks the user to confirm they are doing
   something wrong, which is a soft block wearing a warning's clothes.
2. **No confirmation dialog, no second click, no interstitial, no justification or reason field.** The
   warning is inline and non-modal.
3. **The warning never uses the form's error channel** — it sets no invalid state, participates in
   nothing that gates submission, and adds no required field.
4. **An unresolved count never delays a save.** If the number is still loading, submission proceeds. A
   warning that must finish computing before the button enables is a block nobody described as one.
5. **The write is identical with and without a warning.** Saving onto an overloaded day and onto a
   normal day issue the same shape of request, and a test asserts it.
6. **The permission table gains no row.** Saving onto an overloaded day is the same permission as
   saving anything.
7. **No RLS policy, CHECK constraint or `BEFORE INSERT/UPDATE` trigger consults the threshold.**

**Criterion 7 is the one that will be violated in good faith, and `tech-lead-design` sharpened why it
has to be asserted rather than assumed.** Under ADR-005 exactly three things can refuse a write: an
RLS policy's `WITH CHECK`, a CHECK constraint — which structurally cannot subquery other rows, so it
narrows to two — and a `BEFORE INSERT/UPDATE` trigger. **CAL-01 already ships a trigger and an
exclusion constraint.** The assertion is therefore about their *content*, not their absence: the
mechanisms are present, every other invariant in this product is held in the database, and a Developer
following the house pattern puts this there too — where it is a real refusal.
`data-model.md` already says an overloaded day is *"a comparison performed on read, not a flag"*;
criterion 7 is what makes that sentence checkable.

### Three failure modes that are silent

1. **The truncation hazard has a direction, and the direction is the insight.** PostgREST's
   server-side row cap can only make the count too **low**, so it can only *suppress* a warning and
   never raise a false one. A feature whose entire value is *the warning appears* therefore has a
   silent failure mode pointing at *no warning*: nothing is shown, nothing errors, and the day fills
   up exactly as it does today. CAL-04's function must assert completeness or page explicitly.
2. **The prospective term.** The warning shows the count the day will have *if this entry is saved*,
   not the count it has now, or it reports "3 of 6" at the instant the user is about to make it 4. The
   draft is appended to the rows handed to `absenceCountsFor` as an entry-shaped value; the component
   never adds a number itself, because a `+1` in the UI is a second implementation of INV-04 — and
   INV-06 is why it would be wrong, a five-day `pm` draft adding 0.5 to each of five days rather than
   0.5 once.
3. **Debounce and abort.** The count is recomputed as the range changes, and an in-flight request that
   is not aborted paints a count for a range the user has already left.

**And one INV-05 risk specific to this row: a *tentative* draft must still count toward its own
warning.** The flag is visual only, and a warning that discounted it would defeat the reason tentative
exists.

**INV-06 is relied on and not chosen here**, so `Invariants touched` on CAL-07 is `INV-04, INV-05,
INV-07`. Passing the draft as an entry-shaped value leaves the portion arithmetic inside CAL-04's
function — the same call made on CAL-05, and `product`'s wider proposal was dropped for consistency
with it. **ADM-01 is `[]`**, recorded rather than left blank: setting the threshold changes what is
*called* overloaded and touches no entry and no count, and `invariants.md` records the threshold under
*Considered and rejected as an invariant* for exactly that reason.

### The four open questions, dispositioned

1. **A removed member's entries in the numerator — answered by the operator, unrecorded in the
   registry.** Blocks READY on CAL-07 and CAL-04, not the verdict. Full reasoning above.

2. **What does the warning say for a multi-day range where only some days are over? Not open — the
   charter answers it**, and the answer is now a signature. Refusal 6: *"Overload is reported, **in
   detail**, at the moment of choosing."* Detail means the days are named rather than aggregated, and
   a single aggregate warning throws away the one thing that makes the warning actionable: which day
   to shift. CAL-04's function returns a per-date series, so the per-day results already exist.
   Story-level acceptance criterion, no marker.

3. **Does the warning name people whose entries are still pending? Split, and only half is open.** The
   *number* includes pending and approved alike (INV-04) — closed. Whether the *names* distinguish
   them is a display choice interacting with the approval star, and the star exists only as prose in
   `CLAUDE.md` while `ui-design-system.md` is still the shipped stub. `TODO(project):` on CAL-07,
   blocks READY. The constraint that travels with it: it reuses whatever vocabulary CAL-04 fixes
   rather than inventing a warning-specific treatment, because a warning that draws a distinction the
   grid does not is INV-04's divergence one level up, at presentation. A third part the question does
   not ask and the row needs: **does it name people at all** — yes, per *in detail* and this idea's own
   Problem section, and the `member` read is CAL-04's, inherited.

4. **Where can an admin set the threshold, and is it per team? Split.** *Per team* is **not open** —
   `overload_threshold` is a column on `team` at `data-model.md` `doc_version: 3` and INV-07 makes the
   team a property of the data, so the worry that a global store *"would have to move later"* is
   answered by the schema rather than by a decision. *Where* is open and **blocks ADM-01 reaching
   READY**: this is the product's first admin-only surface, and nothing decides whether it is its own
   screen or the first item of a general admin settings area that the approval, holiday-calendar and
   allow-list rows would inherit. `TODO(project):` on ADM-01, with the recommendation that it own one
   screen so it does not have to invent an admin area. A second marker on the same row: **the
   permitted range and granularity are unstated** — whether `0` and `1` are accepted (`0` makes every
   day overloaded, `1` makes none), and whether the value is set in whole percentage points. Nothing
   in the brief, the charter or the glossary says, and the input needs bounds.

### The dependencies

- `CAL-07` → `depends_on: [CAL-01, CAL-04]`
- `ADM-01` → `depends_on: [TEA-01]`

CAL-01 because the warning has no surface of its own — it lives inside that form, and there is no
second place it could appear. CAL-04 because it builds all three mechanisms.

**TEA-03 is deliberately not named on CAL-07**, unlike CAL-06: naming absent people reads the same
`member` rows CAL-04 already reads for avatars, so the policy dependency is inherited rather than
owned. If CAL-04's dependency on TEA-03 later reduces to `[CAL-01]` — the caveat recorded on that row
— nothing here changes.

**ADM-01 depends on TEA-01 alone.** It is an admin-only write, so it needs a `member` row with
`role = admin` and an established session, and TEA-01 creates both that and the `team` table this row
writes to. Not TEA-04 — v1's first admin comes from a seed, per TEA-01's own marker, so this does not
wait on promotion existing. Not CAL-04 or CAL-07 — the column has a default, so the setting is useful
before the warning exists and the warning works before the setting does.

**The backlog ordering is the human's.** The rows were appended at positions 10 and 11.
Recommendation: ADM-01 anywhere convenient after TEA-01, and CAL-07 last in the CAL chain.

### Out of scope, added at triage

Eight, in order of how likely each is to be absorbed without anyone noticing.

- **Re-warning after the fact.** If a day becomes overloaded because somebody *else* saved later,
  nothing tells the first person. That is the notification mechanism this idea already excludes — but
  said in this direction, because *"the warning should stay accurate"* is the one exclusion here that
  reads as a bug fix rather than as scope.
- **Any RLS policy, CHECK constraint or trigger that consults `overload_threshold`.** Criterion 7
  above, restated as scope because the mechanisms CAL-01 already ships make it a one-line change.
- **Marking an already-overloaded day in any grid.** CAL-04's, and the reciprocal of the line the
  views triage drew.
- **Excluding weekends and holidays from the warning.** A Saturday on which four people declared PTO
  is arithmetically overloaded and operationally meaningless. Deciding it means reading `holiday`,
  which carries `data-model.md` OPEN QUESTIONS item 1 — the blocking question CAL-04 was deliberately
  kept from inheriting, **and which this row must not inherit either.** Cross-referenced deliberately
  and **not marked**: a `TODO(project):` here would be this row adopting a question it does not own.
- **Suggesting an alternative date.** A warning that proposes a less crowded day is a booking tool
  (charter refusal 5), and the charter puts that negotiation between people.
- **Showing the threshold's value, its history, or who set it, inside the warning.** Members may read
  the threshold, so this is one line away; a warning that becomes a settings display is ADM-01's
  surface leaking into CAL-07's.
- **On ADM-01: a threshold per period, per role-pair, per member, or separate for PTO and WFH.** The
  first two are P2 in the brief; the last two are unprompted, and the glossary says PTO and WFH count
  alike.
- **On ADM-01: an audit trail of threshold changes.** Named as excluded rather than forgotten, since
  the row records that v1 keeps no trace and that changing the threshold silently reclassifies every
  day in the product.

**One thing moved *into* scope, flagged because it would otherwise be settled silently:** the warning
fires on an **edit** that moves an entry onto a crowded day (CAL-02, CAL-03), not only on create. This
idea says *"at the moment of choosing a date"*, and an edit is such a moment; excluding it makes the
warning avoidable by saving and then editing.

### Steward item, recorded and not settled

**`CAL-02`, `CAL-03`, `CAL-04` and now `ADM-01` all carry `schema_delta: none` while owning policy
work, and whether a policy-only migration counts as a schema delta is written down nowhere.** Four
rows now depend on the answer, and RULE-09 makes applying a migration human while
`.ai/standards/data-model.md` makes a non-`none` delta require an approved ADR before Definition of
Ready — so the answer changes what four tickets have to carry. Not settled here.

Carried forward from the previous triage and still open: `ui-design-system.md` needs Direction,
Colour, Type and Components filled before CAL-04 reaches DESIGN, and CAL-07's pending-versus-approved
marker waits on the same file.
