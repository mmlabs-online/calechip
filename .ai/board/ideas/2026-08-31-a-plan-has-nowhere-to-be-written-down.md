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
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-007-triage-issues-feature-ids.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - .ai/steward/context.md
  - .ai/board/backlog.md
  - .ai/01-operating-model.md
  - .claude/commands/triage.md
consulted:
  - tech-lead-design
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# A plan has nowhere to be written down where the team can see it

## Problem

A person who knows they will be away — a trip booked four months out, a Friday working from home, an
afternoon at the clinic — has no place to put that fact where their team can find it. It goes into a
chat thread that scrolls away, into their own head, or into an HR request submitted so late that
nothing about the team's work can be rearranged around it.

The brief writes this as requirement 7.2 (*"tạo và sửa đăng ký"*), which is already a solution. The
problem underneath it is narrower and worth stating on its own: **there is no durable, shared,
editable record of an intention to be absent.** Durable matters because chat is not; shared matters
because a private note coordinates nothing; and editable matters most of all, because a plan that
cannot be changed is a plan nobody will enter four months early.

## Who has it

- **Every member**, several times a year — each trip, each recurring work-from-home day, each
  half-day appointment — and again every time one of those changes.
- **The same member, editing**, which is the case the current arrangement handles worst: a chat
  message announcing leave cannot be corrected, only contradicted further down the thread.

## Evidence

- The brief's problem section: personal travel is booked three to six months ahead while the team
  finds out at the last minute. The gap is not knowledge, it is that there is nowhere to put it.
- **Four invariants describe an entity that does not exist yet** — INV-01 (no overlap for one
  member), INV-02 (an edit revokes approval), INV-06 (one portion per entry), INV-07 (one member, one
  team). The domain model was written; the surface that produces the data was not.
- `.ai/standards/data-model.md` already fixes the entry's shape, including `portion` as a single
  enum and the trigger that implements INV-02. It is a schema waiting for a way to fill it.
- The brief's own success measure — more than 80% of members having entered at least one entry within
  two to four weeks — is a measure of exactly this and nothing else.

## Impact if ignored

Every other part of the product has no data. The calendar renders an empty grid, the overload warning
has nothing to count, and approval has nothing to approve.

And the specific consequence the brief names continues: somebody books a flight, tells nobody in a
place that persists, and the conversation happens the week before — *"em đặt vé rồi anh ơi"* — when
the only remaining options are bad for someone.

## Constraints already known

- **INV-01** — two entries of the same member may not cover the same portion of the same date.
  `.ai/standards/data-model.md` holds this with a database exclusion constraint, and records why a
  check in application code cannot: two tabs, two devices, or a retry.
- **INV-02** — an approved entry whose dates, type, portion or tentative flag change returns to
  pending; editing only the note does not.
- **INV-06** — an entry carries exactly one portion for its whole range. **A five-day `pm` entry is
  five afternoons, not a half-day at one end.** The realistic shape of a trip — leaving Wednesday
  afternoon, back Monday morning — is therefore up to three entries, and that cost was accepted
  deliberately. Anything that tries to express it as one entry is a schema migration and an ADR, not
  a story.
- **INV-05** — a tentative entry counts toward the absence count exactly as a settled one does. The
  tentative flag is a visual and social affordance, never an exemption.
- **`.ai/00-charter.md` Roles** — a member creates, edits and deletes their **own** entries; an admin
  may do the same to anyone's, which the charter amended on 2026-08-31 and whose cost is recorded as
  a known weakness in `.ai/standards/rbac-and-security.md`: until the change feed exists, an admin's
  edit is indistinguishable from the member's own.
- **A contiguous range declared in one action is one entry, not one per day.** The brief states this;
  `.ai/registry/invariants.md` records it as **considered and rejected as an invariant** and says it
  belongs in a story as an acceptance criterion. It is a constraint on this idea, from the registry,
  and it is not an invariant — a distinction worth carrying forward so nobody re-derives it.
- The brief's target of under fifteen seconds to record a range is a goal, not a criterion, and this
  idea does not turn it into one.

## Out of scope

- **Recurring declarations** — *"every Friday I work from home"*, set once for a quarter. P1 in the
  brief, and it changes what an entry is, so it does not get smuggled in here.
- **The approval workflow.** A separate idea. This one produces entries; it does not judge them.
- **The overload warning shown while choosing dates.** A separate idea, and the one that gives this
  one its point.
- **The change feed** of who registered or cancelled what. P1.
- **Leave quota, balances, or any HR consequence.** Charter refusals 1 and 2.
- **Group or joint declarations.** Charter refusal 4 — everyone registers independently.

## Open questions

1. **May a member create or edit an entry for a date in the past?** Nothing in the brief or the
   registry says. Forbidding it protects the historical record; allowing it lets somebody record the
   day they were actually out. Both are defensible and the answer changes the interface.
2. **What happens when an approved entry is deleted rather than edited?** INV-02 covers the edit
   path. Deletion removes the record entirely, and v1 has no notification channel, so an admin who
   approved something has no way to learn it is gone.
3. **May an admin create an entry on behalf of another member?** Recorded in
   `.ai/standards/rbac-and-security.md` as **denied by default rather than by decision** — nobody has
   ruled on it, and the default was chosen because a wrong denial is cheaper than a wrong permission.
4. **Is the note free text with no length limit, and is it visible to the whole team?** The brief says
   free and optional; it does not say who reads it, and the charter's transparency principle implies
   everyone, which is worth confirming before somebody writes a medical reason into it.

## Triage verdict: PROMOTE

**Decided 2026-08-31 by `product` and `tech-lead-design`**, running the two halves of triage
independently and then reconciling. Three feature rows were written to
[.ai/registry/features.md](../../registry/features.md) under ADR-007 — **CAL-01**, **CAL-02** and
**CAL-03** — each citing this file in `Notes`, and a ticket shell and a backlog row exist for each
under ADR-010.

**The run passed through `NEEDS-ADR` and did not stop there.**
[ADR-011](../../registry/decisions/ADR-011-inv-01-exclusion-constraint.md) was drafted and
self-accepted inside this triage by `tech-lead-design`, under ADR-008, because it decides inside
ADR-005's envelope rather than across it. It is cited here and deliberately not restated: it answers
what INV-01's exclusion constraint operates on, it names `date_range` and `portion_slots`, and
[.ai/standards/data-model.md](../../standards/data-model.md) absorbed it at `doc_version: 3` with
OPEN QUESTIONS item 3 struck through. Read it there rather than here.

### The two halves disagreed twice, and split the result

Recorded both ways round, because a triage presented as agreement hides which argument won.

**On the verdict, `tech-lead-design` was right and `product` was wrong.** `product` argued PROMOTE
directly, on the reasoning that the generated range column was a **name**, and that RULE-04 lets a
name exist in `data-model.md` *or* in design section 1 — the same handling `allowed_email` already
received. That reading was wrong, and the counter-argument is the whole content of ADR-011: the
name-shaped choice `portion WITH =` silently reproduces an invariant INV-01 does not state, letting a
`full` entry and an `am` entry coexist on one date with nothing erroring. **A choice that can be made
wrong without anyone noticing is a decision, not a name.** `product` also proposed satisfying
Definition of Ready item 4 by linking ADR-005 alone; that would have linked a decision that does not
contain the answer.

**On the split, `product` was right and `tech-lead-design` was wrong.** `tech-lead-design` proposed
two rows, merging edit-and-delete-own with edit-and-delete-another's on the grounds that they are one
policy surface. They are not:
[.ai/standards/rbac-and-security.md](../../standards/rbac-and-security.md) carries *Edit or delete
their own entry* and *Edit or delete another member's entry* as **two separate rows**, so it is two
policies, and the three-row split maps one-to-one onto the permission table. The cited reason stands
as well: CAL-03 is the only row carrying known weakness 3, and folding it into CAL-02 hides *"v1
records no trace of an admin's edit"* — the charter amendment of 2026-08-31 — inside a story about
something else. Three rows.

### The rows, and why the boundary sits where it does

| ID | What it is | `schema_delta` |
|---|---|---|
| CAL-01 | Create, self only. Creates the table, the enums, the two generated columns, the constraint, the check and the trigger. | ADR-005 + ADR-011 |
| CAL-02 | Edit and delete, own. Adds the update and delete policies; observes INV-02's trigger. | none |
| CAL-03 | Edit and delete, another member's, as an admin. Its own permission row and its own policy. | none |

Build order is CAL-01, CAL-02, CAL-03. Merging all three would also exceed the S-or-M that Definition
of Ready item 5 requires.

**The boundary that is easiest to cross without noticing:** brief 7.2's first bullet is *"kéo chọn
nhiều ngày liên tiếp trên lịch"* — drag-select happens **on the calendar grid**, which
`2026-08-31-the-team-cannot-see-its-own-shape.md` owns. CAL-01 owns the form and the save path only,
which is why the date-picker path has to work standalone rather than waiting for a month view to drag
on.

### The four open questions, dispositioned

1. **May a member create or edit an entry for a date in the past?** **Genuinely open, and the one
   `TODO(project):` marker on CAL-01.** Nothing settles it: the charter's *"at any time"* governs when
   the action may be taken, not which dates it may target. It is **not ADR-shaped** — neither answer
   touches the schema (`start_date` is a plain date either way), the registry, or a dependency — so it
   is one acceptance criterion once answered, and it is marked rather than guessed because an agent
   may not invent an acceptance criterion. `product`'s recommendation, for a one-word answer: **allow
   it**, because the brief's success measure counts entries and a refusal makes the *"I was actually
   out"* case unrecordable, while nothing in the product reads `start_date` as a claim about the past.

2. **What happens when an approved entry is deleted rather than edited?** **Settled by default, and
   the default is sound. No decision needed, and it blocks nothing.** `entry` carries no soft-delete
   column and nothing requires one — `member.removed_at` exists for a stated reason, INV-04's
   denominator, which has no analogue here. So a delete is a hard delete: the row and its
   `approved_by` disappear together. INV-02 is not engaged, because there is no updated row. The
   residual the question names is real and is **not a gap in this feature**: it is the missing change
   feed (brief P1) plus known weakness 3, both already recorded. Story-level, the confirmation names
   that the entry was approved.

3. **May an admin create an entry on behalf of another member?** **Denied, and buildable as denied.**
   CAL-01 is self-only and needs one insert policy. Flipping the denial would be a standards change
   and *would* be ADR-shaped, and nothing here needs it flipped. **The trap, named because it is not
   obvious:** an admin may *edit or delete* another member's entry (✅) but may not *create* one. The
   asymmetry is decided, and it is why CAL-03 must not grow a create path on the way past.

4. **Is the note free text, and who can read it?** **Already decided, by mechanical consequence.**
   *Read any entry in the team* is ✅ for a member, and under ADR-005 that check is a **row-level**
   select policy on `entry` — there is no column-level variant — so the note is readable by the whole
   team whether or not anybody intended it. No length limit exists in the schema; imposing one would
   be a check constraint and a schema change. What the concern actually buys is **one acceptance
   criterion**: the note field says, at the point of typing, that everyone on the team can read it.

### Invariants engaged, with the mechanism per ID

From `tech-lead-design`'s half, against the *Where invariants are held* table in
[.ai/standards/data-model.md](../../standards/data-model.md).

| ID | Held by | Where |
|---|---|---|
| INV-01 | `EXCLUDE USING gist (member_id WITH =, date_range WITH &&, portion_slots WITH &&)`, plus `btree_gist` | CAL-01 creates it; CAL-02 and CAL-03 are refused by it on an edit |
| INV-02 | A trigger on update, firing on dates, type, portion or tentative and not on a note-only edit, clearing `approved_by` and `approved_at` as well as resetting `status` | CAL-01 creates it; CAL-02 and CAL-03 are where it becomes observable |
| INV-03 | A check constraint tying `rejection_reason` to `status = 'rejected'` | Ships with CAL-01's table although rejection belongs to a separate idea |
| INV-06 | Column shape — one not-null enum, so a per-day portion is unrepresentable | All three |
| INV-07 | Not-null foreign key, and no path that may rewrite `member_id` | All three; sharpest on CAL-03, where an admin edits a row that is not theirs |

**INV-04 is not engaged, and this is stated rather than left blank** — `.ai/registry/invariants.md`
warns that concluding no invariant is engaged is exactly where the reasoning is usually skipped.
Creating an entry changes the absence count for those dates, but INV-04 is about the **uniqueness of
the definition**, and none of these three rows computes the count. `tech-lead-design`'s caveat is the
useful half: **the one thing that would engage it is an acceptance criterion displaying a count in the
creation form** — and if the story reaches for that, it has taken on the work of
`2026-08-31-a-crowded-day-is-discovered-too-late.md` rather than extended its own.

INV-05 is likewise not engaged: `tentative` is a column this feature writes, and nothing here counts.

### The dependency on TEA-01 belongs in `depends_on`, not in `Notes`

No CAL row can reach READY before TEA-01 is DONE, and the reason is mechanical rather than a matter of
sequencing preference: `entry.member_id` is not-null against `member(id)` (INV-07), and under ADR-005
every policy on `entry` is `member_id = auth.uid()`. There is no member row for an entry to belong to
and no identity for a policy to compare against.

**It is not recorded in the registry.** The `Columns` section of
[.ai/registry/features.md](../../registry/features.md) defines a `Notes` marker as *known-incomplete,
needs a human decision before READY* — **a dependency is neither incomplete nor a decision.** It is
Definition of Ready item 3, held in `ticket.yaml` and shown in
[.ai/board/backlog.md](../../board/backlog.md):

- `CAL-01` → `depends_on: [TEA-01]`
- `CAL-02` → `depends_on: [CAL-01]`
- `CAL-03` → `depends_on: [CAL-02]`

CAL-03 does **not** depend on TEA-04. The admin role arrives via the bootstrap seed and TEA-01, not
via promotion.

### Two consequences ADR-011 records and could not fix

Both are in that ADR's *Consequences*; they are repeated here in one line each because they land on
these rows, not because the ADR is unclear.

1. **A rejected entry still occupies its portion, and that is the likeliest path after a rejection.**
   INV-01 as written has no status carve-out, so a member whose request was rejected **cannot
   re-request the same dates**: the second insert is refused and arrives as a PostgREST `409` carrying
   SQLSTATE `23P01` — an opaque database error at the exact moment somebody is trying to correct
   something. The fix is a partial constraint, which edits `.ai/registry/invariants.md` and is
   **human-only under RULE-01**; it is **with the operator now**. Until it is decided INV-01 is held
   literally, and CAL-01 must at minimum explain the refusal rather than surfacing the SQLSTATE.
2. **Nothing requires `end_date >= start_date`.** An inverted pair fails inside the generated column
   with a range-bounds message rather than a message about dates. A `CHECK` plus a seam-level message
   would close it; it follows from no invariant, so it belongs to whoever designs CAL-01.

### Out of scope, added at triage

Four, in order of how likely each is to be absorbed by accident. The first is the largest omission in
the section above.

- **Any calendar grid or view.** The *Out of scope* section excluded the warning and the approval
  workflow and said nothing about the views — so as written, CAL-01 was entitled to build a month grid
  to have something to drag-select on. It is not.
- **Any notification, email or reminder** when an entry is created, edited or deleted. v1 has no
  channel, and open question 2 pulls straight toward acquiring one.
- **Setting the approval status directly.** This feature never writes `status`; it only causes INV-02's
  trigger to reset it. Distinct from *"the approval workflow is a separate idea"*, which reads as being
  about the admin screen.
- **A soft delete, a trash, or an undo for entries.** Nothing requires one, and naming it stops open
  question 2 being answered with a column.

### One steward chore, recorded and not fixed

[.ai/standards/ui-design-system.md](../../standards/ui-design-system.md) § *Destructive actions* says
*"Are you sure?" names nothing and is not a confirmation*, and then carries a `TODO(project)` for the
list of destructive actions and what each confirmation must name. **Deleting an entry is the first
destructive action this product gains**, and it lands on CAL-02 and CAL-03 with an empty list to be
written against — the same shape as the member-list gap that held TEA-03. The BA can state what the
confirmation names as a story acceptance criterion and the steward can generalise it afterwards, so it
blocks neither this verdict nor READY.
