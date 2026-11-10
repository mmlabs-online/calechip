---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-011 — INV-01 becomes an exclusion constraint over two generated range columns

## Status

`ACCEPTED by tech-lead-design` — 2026-08-31.

**This decision sits inside ADR-005, not across it.** ADR-005 already says, in words, that *"INV-01
becomes a PostgreSQL exclusion constraint, INV-03 a check constraint, and INV-02 a trigger"*. What
that sentence does not say is what the constraint operates on, and that is the only thing decided
here. Under ADR-008 an agent may accept an ADR that decides inside an existing envelope, and must ask
rather than decide when it would supersede or reverse an accepted one.

**Two paths were available here that would have reversed an accepted ADR. Both were refused:**

- **Holding INV-01 in the seam as a read-then-write check.** This reverses ADR-005, which chose the
  database as the single enforcement layer, and it is the specific failure `.ai/registry/invariants.md`
  names under INV-01: *"two tabs, two devices, or a retry"*. Not taken.
- **Carving rejected entries out of the constraint.** INV-01 as written has no status carve-out.
  Adding one edits `.ai/registry/invariants.md`, which is human-only under RULE-01, and that file
  says in words that an agent does not author that ADR. INV-01 is therefore held literally, and the
  consequence is recorded below for the operator rather than designed around.

## Context

`.ai/standards/data-model.md` OPEN QUESTIONS item 3 declares itself blocking: *"The generated range
column for INV-01 … The column's name is a choice nobody has made. **Blocks:** the migration that
creates INV-01's constraint."* No story that touches entry creation can reach Definition of Ready
while that name does not exist, because RULE-04 forbids the Developer inventing it at implementation
time.

Three facts constrain the answer.

- **INV-01 compares portions, not dates alone.** `.ai/registry/invariants.md`: *"`full` conflicts
  with everything; `am` and `pm` do not conflict with each other."* The note under it adds that two
  entries conflict when their date ranges intersect *and* their portions intersect.
- **INV-06 puts one portion on the whole range.** A five-day `pm` entry is five afternoons, so the
  comparison is well defined without a per-day expansion.
- **`end_date` is inclusive.** `.ai/standards/data-model.md`: *"Equal to `start_date` for a single
  day."*

**Nothing is provisioned.** `.ai/standards/tech-stack.md` lists the Supabase CLI, its migration
layout and the PostgreSQL major behind the hosted project as *past reliable recall*, and none of the
three is installed. The `TODO(verify):` markers below are load-bearing, not decoration.

## Decision

### 1. Two generated columns on `entry`, both `stored`

```sql
ALTER TABLE entry
  ADD COLUMN date_range daterange
    GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED,
  ADD COLUMN portion_slots int4range
    GENERATED ALWAYS AS (
      CASE portion
        WHEN 'full' THEN int4range(0, 2)
        WHEN 'am'   THEN int4range(0, 1)
        WHEN 'pm'   THEN int4range(1, 2)
      END
    ) STORED;
```

The names are `date_range` and `portion_slots`. Under RULE-04 they are now real: they are the names
that appear in the migration, in the seam's row type, and in any design section 1 that touches
`entry`.

**The `'[]'` constructor is required by the inclusive `end_date`.** `daterange(start_date, end_date)`
defaults to `'[)'` and would silently drop the last day of every entry.

**PostgreSQL canonicalises discrete ranges to `[)` on storage.** A one-day entry written as
`daterange('2026-01-01','2026-01-01','[]')` is stored, and read back, as
`['2026-01-01','2026-01-02')`. The upper bound is the day *after* the entry ends.

This is in a decision record rather than a code comment because it is a fact about stored data that
crosses the seam. **Anyone who compares a stored literal against the constructor without knowing it
writes a wrong seam query** — an equality test against `daterange(d, d, '[]')` and an equality test
against the stored value are the same, but an equality test against `'[2026-01-01,2026-01-01]'` as a
string, or a bound read as "the last day of the entry", is not. The bug is silent and off by one day.

### 2. Stored columns, not bare expressions — and the reason is PostgREST, not the constraint

**An exclusion constraint accepts an expression.** This is legal:

```sql
EXCLUDE USING gist ((daterange(start_date, end_date, '[]')) WITH &&, ...)
```

So `data-model.md` overstates the need when it says an exclusion constraint *"needs a range to
operate on, so `start_date` and `end_date` need a generated `daterange` beside them"*. The constraint
alone does not force a column.

**What forces it is ADR-005.** With no server, the browser talks to PostgREST directly, and
**PostgREST filters on columns, not on expressions**. The calendar's central read — *entries
overlapping this month* — has to be expressible as a filter on a named column:

```
entry?date_range=ov.[2026-01-01,2026-02-01)
```

An expression cannot appear on the left of that. Without the column, the month read degrades into
`start_date <= month_end AND end_date >= month_start`, which is two filters, is not served by the
GiST index the constraint already builds, and restates the overlap semantics a second time in a
second place.

**`STORED` is also the only kind of generated column usable in an exclusion constraint or an index.**
A virtual generated column has no stored value to index. So even where the choice were otherwise
open, `stored` is what the constraint requires.

TODO(verify): the PostgreSQL major behind the hosted Supabase project. `tech-stack.md` records it as
past reliable recall and no project is provisioned. Virtual generated columns are a recent addition;
`STORED` is the long-standing form and is what is written above, so the migration does not depend on
the answer — but the read of `data-model.md`'s eventual "Held by" row does.

### 3. How `portion` participates, and the full constraint

`portion_slots` maps the enum onto a two-slot day: slot 0 is the morning, slot 1 the afternoon.

| `portion` | `portion_slots` |
|---|---|
| `full` | `[0,2)` |
| `am` | `[0,1)` |
| `pm` | `[1,2)` |

```sql
ALTER TABLE entry
  ADD CONSTRAINT entry_no_overlapping_portion
  EXCLUDE USING gist (
    member_id     WITH =,
    date_range    WITH &&,
    portion_slots WITH &&
  );
```

Two rows conflict when all three hold: same member, intersecting dates, intersecting slots. The three
cases INV-01 names:

| Pair | Slot test | Result | INV-01 requires |
|---|---|---|---|
| `full` vs `am` | `[0,2) && [0,1)` | **true** — refused | `full` conflicts with everything ✅ |
| `am` vs `pm` | `[0,1) && [1,2)` | **false** — allowed | `am` and `pm` do not conflict ✅ |
| `full` vs `full` | `[0,2) && [0,2)` | **true** — refused | conflicts ✅ |

**Rejected alternative: `portion WITH =`.** It is the obvious shape — three enum values, compare them
for equality — and it is **wrong in a way that passes every test written from the happy path**. With
`WITH =`, two rows conflict only when their portions are *equal*. A `full` entry and an `am` entry on
the same date have unequal portions, so the constraint does not fire and **both rows are accepted** —
directly contradicting INV-01's *"`full` conflicts with everything"*.

Nothing errors. The second insert succeeds, and the member is recorded as both fully absent and
half absent on one day, which INV-04 then counts as 1.5 people away for a single person. The
invariant would be claimed in `data-model.md`'s *Where invariants are held* table and not held —
which `.ai/registry/invariants.md` calls worse than never claiming it.

A rejected alternative that is merely worse teaches nothing. This one is subtly wrong, and it is the
reason this ADR exists rather than a line in a migration.

### 4. `btree_gist`

`member_id WITH =` puts a `uuid` equality test inside a GiST index, and core GiST has no operator
class for that. The extension supplies it:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Without it the `ALTER TABLE` fails at migration time with *"data type uuid has no default operator
class for access method gist"*.

TODO(verify): whether `btree_gist` is available on a hosted Supabase project, and **into which schema
it is created**. Supabase's convention is an `extensions` schema rather than `public`; if that holds,
that schema must be on the `search_path` in force when the constraint is created, or the operator
class will not resolve even though the extension is installed. Supabase is on the *past reliable
recall* list — read its own extension documentation before writing the migration, do not write this
line from memory.

TODO(verify): where migrations live and the one command that applies one. `data-model.md` carries the
same marker; fill both together. Applying a migration is human under RULE-09 either way.

## Rationale

The decision is shaped by ADR-005 twice over, and both times in the same direction: the database is
the only enforcement layer, and the browser is a direct PostgREST client. That makes a **stored,
filterable, indexed** column the answer to a question that a constraint alone would have left open,
and it makes the seam's convenience irrelevant to whether the constraint is correct.

Alternatives and what each costs:

- **A bare expression in the constraint** (no columns). Costs the month read: two filters instead of
  one, no index on the overlap, and the `[]` semantics restated in client-built filter strings where
  the canonicalisation footgun in part 1 is at its most dangerous. Cheaper migration, more expensive
  everywhere else.
- **`portion WITH =`.** Costs correctness, silently. Detailed above.
- **Expanding a range into one row per day** and constraining on `(member_id, date, portion)`. Holds
  INV-01 with a plain unique index and no extension — but it contradicts INV-06, which makes the
  entry the unit carrying one portion for its whole range, and it turns a five-day request into five
  rows that approval, rejection and the audit trail would each have to keep in step.
- **Holding INV-01 in the seam**, and **carving rejected entries out**. Both refused under ADR-008,
  for the reasons in the Status section.

## Consequences

What becomes true:

- The migration blocked by OPEN QUESTIONS item 3 can be drafted. Two names exist, so RULE-04 is
  satisfied for any story touching `entry`.
- One GiST index serves both the constraint and the calendar's overlap read.
- INV-01 holds against two tabs, two devices and a retry, because only the database sees both writes.

**What becomes harder, including two findings this ADR does not fix:**

- **A rejected entry still occupies its portion, and this is the likeliest path after a rejection.**
  INV-01 as written has no status carve-out, so a member whose request was rejected **cannot
  re-request the same dates**. The second insert is refused by the constraint and arrives in the
  browser as a PostgREST `409` carrying SQLSTATE `23P01` — an opaque database error at the exact
  moment a member is trying to correct something. Making the constraint partial
  (`WHERE status <> 'rejected'`) would fix it and would edit `.ai/registry/invariants.md`, which is
  human-only under RULE-01. **This goes to the operator as a decision, not to a designer as a
  workaround.** Until it is decided, INV-01 is held literally and the interface must at minimum
  explain the refusal rather than surfacing the SQLSTATE.

- **Nothing requires `end_date >= start_date`.** An inverted pair does not fail a validation rule; it
  fails inside the generated column, at insert time, with *"range lower bound must be less than or
  equal to range upper bound"*. That is a database error text in place of a message about dates. A
  `CHECK (end_date >= start_date)` plus a seam-level message would close it; both belong to whoever
  designs the entry-creation story, and neither is decided here because neither follows from an
  invariant.

- **The INV-02 trigger must clear `approved_by` and `approved_at`, not only reset `status`.**
  `data-model.md` specifies the trigger as returning the entry to `pending` and says nothing about
  the two approval columns. An entry that is `pending` while still naming its approver and the moment
  of approval is **exactly the false record INV-02 exists to prevent** — `.ai/registry/invariants.md`
  says the failure is that the data is wrong, not merely stale, and `approved_by` is the only audit
  trail v1 has. This is a finding about a neighbouring mechanism, recorded so the trigger is designed
  with it; INV-02's text is unchanged and needs no change.

- **Two more columns cross the seam.** `date_range` and `portion_slots` are generated, so they are
  never written, and the seam's insert and update types must exclude them while the row type includes
  them. A DTO that accepts them invites a write that the database will reject.

- **The migration depends on an extension**, which is one more thing that can differ between a local
  Supabase container and the hosted project. See the `TODO(verify)` markers.

## Revert condition

**Two observable signals, either one:**

1. **A pair of entries that INV-01 permits is refused by the database** — most likely an `am` and a
   `pm` on one date, or two entries whose dates touch but do not overlap. That means the slot mapping
   or the `'[]'` bound is wrong, and one occurrence is enough: it is a false refusal of a legitimate
   request, which is the failure mode the portion refinement of INV-01 was written to avoid. Record
   it in the invariant decision log in `.ai/board/metrics.md` and correct the mapping.

2. **A second `ESCALATED` row naming INV-01** in `.ai/board/metrics.md`. That file already reads a
   second escalation on the same invariant as *"a modelling problem"* rather than a ticket problem —
   here it would mean the two-slot day is the wrong model, and the per-day expansion alternative
   returns for a decision on its own terms.

Separately, if the calendar's month read turns out not to be expressible as a PostgREST filter on
`date_range`, part 2's rationale collapses and the bare-expression alternative becomes correct: the
columns would then be cost without benefit. This is a design-time check, not a production signal.

## Affected documents

| File | Change | doc_version |
|---|---|---|
| `.ai/standards/data-model.md` | OPEN QUESTIONS item 3 struck through and answered in place; the two generated columns and the constraint named | 2 → 3 |
| `.ai/registry/invariants.md` | **No change.** INV-01 is held as written; the rejected-entry carve-out is an operator decision, not an agent's | unchanged |
| `.ai/standards/rbac-and-security.md` | **No change.** The constraint is an integrity control, not a permission | unchanged |
