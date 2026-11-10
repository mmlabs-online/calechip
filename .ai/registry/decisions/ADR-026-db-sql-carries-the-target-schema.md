---
doc_version: 3
last_updated: 2026-09-04
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-026 — `supabase/db.sql` carries the target schema, including objects whose tickets have not been planned

## Status

`SUPERSEDED by ADR-068` — 2026-10-23, under the operator's delegation (ADR-067). Original status, kept:

`ACCEPTED by the operator` — 2026-09-04, in answer to the `/triage` question recorded in Context
below.

**Supersedes ADR-025**, which was `ACCEPTED by tech-lead-design` earlier the same day and recommended
the opposite. ADR-025 is left standing in full, status changed and nothing else — its *Rationale* is
the record of what this decision costs, and it was put to the operator before they answered.

## Context

ADR-025 measured the gap between the seven shipped migrations and the complete data model, and that
measurement is **not restated here**. It is the input to this decision and it stands: read ADR-025
§ Context, including its four corrections to the read that triage was originally given.

ADR-025 recommended carrying only shipped migrations, and closed by naming one thing the operator had
to decide. That question was put to them as a two-option choice, and both options were shown with
their costs attached rather than as a preference between styles.

**Option A, as shown:** *only the seven shipped migrations.*

**Option B, as shown:** *the target schema, decided objects too* — carrying, in the option text
itself, that it walks ADR-014's gate for ADM-02, ADM-03, ADM-05 and ADM-06; that those four tickets'
`schema_delta` is spent before their PLAN runs; that under ADR-005 the RLS policies involved **are**
the authorization model and would land unreviewed; and that the result is incomplete either way,
because both `team` policy predicates and the real national holiday dates are undecided and no agent
can supply them.

**The operator chose B**, having been shown all four of those costs.

Per `.ai/steward/context.md` § Autonomy — *disagree once, then comply fully* — the disagreement was
already made, in ADR-025 § Rationale option B, and is not repeated. This document is the compliance
half, and it is written to be as useful as the decision permits rather than as a grudging record.

**What is available to transcribe, and what is not.** The distinction ADR-025 drew is what bounds
this decision, and it survives the change of answer unchanged:

- **Transcription of an accepted document** — copying a statement that a merged ADR already writes
  out in full, where copying it makes no choice. Available.
- **Design ahead of a PLAN that has not run** — the select and update policies on `public.team`. No
  accepted document names either predicate. Not available, and worse than unavailable: ADM-01's plan
  carries `gate: BLOCKED` on precisely whether it may take the select policy that the CAL-04 row in
  `.ai/registry/features.md` assigns to CAL-04, and that is a RULE-01 registry-ownership question.
- **Facts about the world** — the several years of Vietnamese national holidays. ADR-015 §5 gives one
  row and an ellipsis, the year horizon is an open `TODO(project)` on the ADM-02 row, and the dates
  come from government announcements rather than from any file here. Writing them from recall is what
  `.ai/standards/tech-stack.md` § *past reliable recall* forbids, in the one table where a wrong date
  silently moves bridge-day detection for the whole team.

## Decision

**1. `supabase/db.sql` carries the target schema, not the shipped schema.**

It holds two groups, and a reader must be able to tell them apart from the file alone:

- **Group 1 — the seven shipped migrations.** Transcribed from the files in
  `supabase/migrations/`, in filename order within each object class. Nothing restated from memory.
- **Group 2 — the decided-verbatim objects whose migrations have not shipped.** Exactly four, and no
  fifth:
  1. `public.holiday_kind`, `public.holiday` with `date … unique`, its `enable row level security`,
     `revoke`, `grant select` and policy `holiday_select_all` — ADR-015 §3, owed by **ADM-02**.
  2. Policies `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin` and
     `grant insert, update, delete on public.holiday` — ADR-015 §3, owed by **ADM-03**.
  3. `grant update (status, rejection_reason) on public.entry`, and clauses (a) and (b) of
     `public.entry_enforce_decision()` — ADR-016 §1 and *Consequences*, owed by **ADM-05**.
  4. `public.reject_entries(uuid[], text)` with its `revoke` and `grant execute` — ADR-016 §4, owed
     by **ADM-06**.

**2. The boundary is transcription, and it is not a judgement made while writing.**

An object enters group 2 only if an ADR that is `ACCEPTED` writes its statement out in full. Nothing
is adapted, completed, renamed or inferred. This is what keeps the decision inside ADR-015 and
ADR-016 rather than extending them: the operator chose to move *when* these statements land, not
*what* they say.

**3. Every group-2 object carries a comment naming the ADR clause it came from and the ticket that
still owes its migration.** A reader who cannot tell which lines have been through a gate is holding a
file that has quietly become a second source, which is the thing ADR-025 §Decision point 1 exists to
prevent and which this ADR does not reverse.

**4. The three undecided things stay out, and their absence is declared in the file.**

`supabase/db.sql` carries a marked block naming: the missing select policy and `grant select` on
`public.team` (CAL-04); the missing `grant update (overload_threshold)` and update policy (ADM-01,
blocked); and the missing national holiday rows (ADM-02). For `team` the block states the consequence
in terms of behaviour — **the table is unreadable by every client until that policy exists**, because
RLS is enabled with no policy and nothing is granted. The operator will run this file, and must not
discover that from behaviour.

**5. It is idempotent throughout, wrapped in one transaction, and applied by a human.**

Enums are created inside a guarded `do` block, tables with `if not exists`, the exclusion constraint
under a `pg_constraint` guard, policies and triggers as `drop … if exists` followed by `create`, and
functions as `create or replace`. The whole file is one `begin` … `commit`, so a failure leaves
nothing partially applied — which is the property `supabase/seed.sql` does not have and ADR-024
decision point 4 records as a real hazard. `RULE-09`: applying it is human, and no agent runs it.

**6. `supabase/migrations/` is still the mechanism, and `db.sql` is not a migration.**

`.ai/standards/data-model.md` § Migrations is untouched and keeps naming Supabase CLI migrations.
**Applying `db.sql` does not discharge the migration ADM-02, ADM-03, ADM-05 or ADM-06 still owes.**
Each of those tickets writes its own file under `supabase/migrations/` when it is planned, and that
file is what a fresh environment and the CLI's own history read. A ticket that skips its migration
because "the object already exists in the project" has broken the mechanism for every environment
that is not this one.

## Rationale

**The operator's reading is coherent, and it is worth stating rather than merely obeyed.** The four
group-2 objects are already decided, in writing, in two merged ADRs. Transcribing them makes no
design choice, and a reviewer reading `db.sql` sees the same statements they would see in four future
migrations. ADR-025's objection was never that the statements are wrong — it was about **when** the
gate runs. The operator has decided that having one runnable, complete, readable answer to *"what is
the schema"* today is worth running that gate late.

There is a second thing on their side that ADR-025 undersold: the product has **no** working
end-to-end environment for the holiday calendar or the approval path, and four separate tickets each
need one before they can be exercised. A single file that stands the whole target schema up in a
fresh Supabase project makes that possible now instead of after four ships.

**The alternative rejected is ADR-025 option A**, and its argument is not repeated here because the
document is still in the repository, unedited, one number below this one. That is deliberate: an
alternative summarised by the decision that beat it is an alternative nobody can check.

**Option C from ADR-025 — tables now, policies later — is rejected again and for the same reason.**
Under ADR-005 the policies are the authorization model, so a table shipped without them is either
closed and useless or silently open. The operator's choice does not revive it.

## Consequences

**What gets worse, named rather than implied.**

- **Four tickets' `schema_delta` is spent before their PLAN runs: ADM-02, ADM-03, ADM-05 and
  ADM-06.** Their PLAN now *inherits* a schema rather than designing one. A tech lead planning ADM-02
  will find the `holiday` table already written and will be transcribing a file instead of deriving
  from ADR-015 — which is the same result when the file is right and an unreviewable result when it
  is not.
- **ADR-014's gate is walked for four sets of RLS policies.** ADR-014 was `ACCEPTED by the operator`
  on the argument that a policy gets looked at once, deliberately, by the one gate positioned to stop.
  Those policies now reach `main` on a chore branch under CODEOWNERS review instead. CODEOWNERS is a
  real control and it is not the same control: it reviews a diff, where the gate reviews a design
  against acceptance criteria.
- **The file cannot be regenerated mechanically.** ADR-025 decision point 5 proposed a check that
  regenerates from `supabase/migrations/` and fails on a difference — buildable there because both
  sides were files in the repository. It is **not available for group 2**, which has no source to
  regenerate from. So group 1 can drift out of step with the migrations and nothing will say so. This
  is the single largest thing lost, and it is lost as a direct consequence of the choice.
- **`create table if not exists` and the guarded `create type` accept a divergent existing object
  silently.** Idempotency was required and this is its price: run against a project whose `entry`
  table differs, the file reports success and changes nothing. It is safe on a fresh project and it
  is not a repair tool. The file says so in its own preamble.
- **`.ai/standards/data-model.md` § Migrations now has a neighbour it does not mention**, and the
  neighbour contains objects no migration has created. That file is standards plane and human-only
  under RULE-01, so this ADR does not edit it; the correction is owed and is named below.
- **ADM-01 stays blocked and `public.team` stays unreadable.** Nothing in this decision moves either.
  A reader of `db.sql` who assumes "the target schema" means "everything works" will find the
  threshold unreadable; decision point 4 is the whole mitigation and it is a comment, not a control.
- **The `.ai/registry/features.md` ADM-05 row is still stale** — it lists `entry_update_admin` as
  owed, and CAL-03 shipped it on 2026-09-03. Named again here because a plan written against that row
  would add a policy that already exists.

**What gets better.** One file answers *what is the schema*, in an order a person can read, runnable
against a fresh Supabase project in one paste, with every unshipped line labelled by the clause that
decided it and the ticket that owes it. Four features become testable end to end against a real
PostgreSQL before four more ships.

## Revert condition

**Two observable signals, either one.**

1. **A ticket among ADM-02, ADM-03, ADM-05 and ADM-06 ships without its own migration under
   `supabase/migrations/`, on the grounds that `db.sql` already created the object.** That is decision
   point 6 failing, and it breaks the mechanism for every environment that is not the operator's
   current project. The remedy is to delete group 2 from `db.sql` and fall back to ADR-025 option A,
   which is why ADR-025 is left intact and not rewritten.
2. **Group 1 is found disagreeing with `supabase/migrations/` on `main`.** With no regeneration check
   available, this is the drift that has no detector, so it will be found by a person rather than by
   CI. One occurrence is enough: a consolidated schema nobody can trust is worse than seven files
   somebody has to read in order.

## Changed by this ADR

| File | Change | Plane |
|---|---|---|
| `supabase/db.sql` | created; groups 1 and 2, idempotent, one transaction, human-applied | agent, this run |
| `.ai/registry/decisions/ADR-025-db-sql-is-generated-and-never-a-second-source.md` | `Status` to `SUPERSEDED by ADR-026`; nothing else | agent, this run |
| `.ai/standards/data-model.md` | § Migrations should name `supabase/db.sql` and state that it discharges no ticket's migration | **human, owed** |
| `.ai/registry/features.md` | the ADM-05 row lists `entry_update_admin` as owed; CAL-03 shipped it | **human, owed** |
| `.ai/templates/plan.md` | a ticket in the four named above regenerates its group-2 block in `db.sql` | agent, owed |
| `supabase/migrations/` | nothing. The seven files are the source of group 1 and are unchanged. | — |
