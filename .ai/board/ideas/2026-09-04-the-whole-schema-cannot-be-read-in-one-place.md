---
stage: TRIAGE
agent: product
produced_at: 2026-09-04
inputs_read:
  - CLAUDE.md
  - .ai/templates/idea.md
  - .ai/steward/context.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/standards/data-model.md
  - .ai/registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md
  - .ai/board/ideas/2026-09-03-nobody-can-sign-in-with-the-credentials-the-repository-documents.md
  - .github/CODEOWNERS
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - .ai/registry/decisions/ADR-025-db-sql-is-generated-and-never-a-second-source.md
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

## Problem

**Nobody can read the whole database schema in one place.** The question *"what does this product's
database actually contain right now — every table, enum, function, trigger, policy and grant?"* has
no artifact that answers it. Answering it today means opening seven files in
`supabase/migrations/`, reading them in filename order, and composing the result by hand, including
the parts that were replaced by a later file rather than added.

There is a second half, and it is the one the operator's request is really about. The question
*"what will the database have to contain when the product is finished?"* has no answer either, and
it is not the same question. `.ai/standards/data-model.md` (doc_version 5) specifies five entities;
the migrations create four. `holiday`, and the `holiday_kind` enum, are fully specified in that file
and in ADR-015 and exist in **no migration** — they belong to ADM-02 and ADM-03, both `PLANNED`. For
the eleven other `PLANNED` rows in `.ai/registry/features.md`, no document states whether they need
DDL at all. So the repository holds a specification that is one entity ahead of the database and a
feature list whose schema consequences have never been totalled.

**The two questions have different answers and they are being asked as one.** A file describing what
exists is a derived record that must never disagree with the migrations. A file describing what the
product will need is a design that has to be decided, feature by feature, at PLAN. Naming them both
`db.sql` is what makes the request look like one piece of work.

## Who has it

- **The operator, whenever they need a database that matches this repository.** They cannot obtain
  one from a single read or a single paste. This is the occasion that produced the request.
- **`tech-lead-design`, at every PLAN whose ticket has `schema_delta` other than `none`.** They must
  reconstruct the current shape from the migration set before they can design the next one, and under
  ADR-014 that is most `TEA` and `ADM` tickets rather than a rare case. Seven files today; the number
  only grows.
- **The reviewer at R6 and R8**, who has to say where each invariant in `invariants_touched` is held.
  The mechanisms are spread across the same seven files, and the table that would collect them
  (`.ai/standards/data-model.md` § *Where invariants are held*) carries an unpaid `TODO(project)`
  saying to cite the migration file and the constraint name for each row *once migrations exist*.
  Migrations have existed since 2026-08-31 and the citations are still not there.
- **Anyone standing up a fresh Supabase project** — which BUG-001 and ADR-024's revert condition both
  contemplate. Nobody has done it since TEA-01, and no document records how.

Frequency: once per schema-touching ticket, plus once per person who ever needs a database.

## Evidence

**The operator asked for it, in these words, on 2026-09-04:** *"hey I need to first scan all feature
of product and makeing an Database design. Write whole db.sql for project that all feature will
follow. And the SQL I will execute in supabase"*. Two separate needs are stated in one sentence — a
scan of all features producing a design, and a single file to execute — and the second half is
already governed: applying it is human under RULE-09 and ADR-024 decision point 2, which is exactly
what *"I will execute in supabase"* describes.

**Measured in the repository, this run:**

- **Seven migration files, and nothing that composes them.**
  `20260831150024_tea01_membership.sql`, `20260901090000_tea02_allow_list_writes.sql`,
  `20260901093000_tea03_member_select_team.sql`, `20260901120000_tea04_member_writes.sql`,
  `20260903103000_cal01_entry.sql`, `20260903143000_cal02_own_entry_writes.sql`,
  `20260903160000_cal03_admin_entry_writes.sql`. Between them: four tables, four enums, five
  functions, four triggers, RLS on four tables, eleven policies and the grants. No file in the
  repository states that total; it was arrived at by reading all seven.
- **The specification and the database already disagree by one entity.**
  `supabase/migrations/20260831150024_tea01_membership.sql:8` says plainly that `entry`, `holiday`
  and ADR-011's exclusion constraint are *"deliberately NOT here"*. `entry` arrived with CAL-01.
  `holiday` never did, and `.ai/standards/data-model.md` describes it in full with a field table, a
  unique constraint and a policy. A reader with only the standard would write code against a table
  that does not exist.
- **`supabase/migrations/` has no CODEOWNERS entry.** `.github/CODEOWNERS:19-21` still carries
  `TODO(project): add the schema or migrations directory once the datastore is chosen`. Under ADR-005
  the migrations *are* the entire authorization surface, and they are the one directory in this
  repository holding a security control that no review rule names.
- **`.ai/standards/data-model.md` § *Migrations* carries `TODO(verify)` on where migrations live and
  the one command that applies them.** ADR-024 measured both — they live in `supabase/migrations/`,
  and `supabase db push --db-url <conn>` is present in the installed CLI at 2.116.0 — and could not
  write them down, because that file is standards plane. So the document a person would consult to
  get this schema into a database is stale in a way already recorded as owed to a human.
- **The nearest prior art is one layer down and it cost a day.** ADR-024 decided the contract for
  `supabase/seed.sql` — a *different* file, holding *data* — and recorded that nothing in the
  repository compares the repository's idea of the database to the hosted project's. The
  consequence was measured, not imagined: an account the repository documents in four spec files
  could not sign in, and establishing why took a full diagnostic pass
  (`.ai/board/ideas/2026-09-03-nobody-can-sign-in-with-the-credentials-the-repository-documents.md`).
  **This idea is the same absence, one layer up: rows drifted because nothing compared them; the
  schema is in exactly the same position, and has simply not been caught yet.**

## Impact if ignored

- **Every schema-touching PLAN pays the composition cost again, and a wrong composition is silent.**
  A design written against a mis-remembered column shape produces a migration that fails on apply at
  best, and at worst applies against a different shape than the designer believed. Nothing in the
  loop compares a design's assumption to the migration set.
- **The gap between `.ai/standards/data-model.md` and the migrations widens by one entity per unbuilt
  feature, and nothing measures it.** It is one entity today. It is `holiday` plus whatever the
  eleven `PLANNED` rows turn out to need, and the person who discovers each gap is the one who
  assumed it was there.
- **The invariant-to-mechanism table stays a claim.** `.ai/registry/invariants.md` warns that an
  invariant claimed and not held is worse than one never claimed, and `.ai/standards/data-model.md`
  repeats the warning beside its own unpaid `TODO(project)`. Seven invariants are asserted to be held
  by the database, and no artifact names the constraint that holds each one.
- **Standing up a database stays undocumented, so it gets done from memory.** The realistic failure
  is not that nobody can do it; it is that somebody composes DDL by hand and pastes it into the
  Supabase SQL editor against a project that already holds tables. ADR-024 decision point 4 already
  establishes that blind application to a project written by something other than the file is unsafe
  for *data*, and DDL is worse: the file is not wrapped in a transaction, `create table` on an
  existing table raises rather than skipping, and a partially applied file leaves half a schema.
- **The next person answers the operator's question by writing a file nobody keeps true.** A flat
  `db.sql` sitting beside seven migrations, with no rule about which one wins, is a second copy of
  the schema — and `CLAUDE.md` § Stack states the failure directly: *the copy is always the one that
  goes stale*. Ignoring this idea does not prevent that file; it just means it arrives without the
  decision that would have made it safe.

## Constraints already known

Read in this run, not assumed.

- **ADR-005 — there is no server, and RLS is the whole authorization model.** So a description of
  this database that omits policies and grants is not a description of it: it describes a schema
  that fails open. Any artifact answering *"what is the schema"* must carry RLS, policies, grants,
  functions and triggers, not just tables and columns.
- **ADR-014 — a policy-only migration is not `schema_delta: none`.** Four of the seven migrations are
  policy-and-grant migrations. They are part of the schema in this project's sense of the word, and
  an answer that only collects `create table` statements would omit more than half of what matters.
- **RULE-09 and ADR-024 decision point 2 — applying is a human action, named and never performed by
  an agent.** The operator's *"the SQL I will execute in supabase"* is already the governed shape.
  Nothing here proposes an agent running anything against a database.
- **RULE-04 and the no-invention rule in `CLAUDE.md`.** A field name must exist in
  `.ai/standards/data-model.md` or in a plan's section 4 before a developer may write it. This is the
  constraint that bounds *"all feature will follow"*: DDL for a feature that has not been through
  PLAN would be inventing names, and it would invent them into the one file everything else is told
  to follow.
- **RULE-01 — `.ai/standards/data-model.md` is human-owned and CODEOWNERS-reviewed.** Whatever is
  produced, an agent does not silently amend the specification to match it.
- **ADR-009, ADR-011, ADR-015 and ADR-016 are embedded in the DDL rather than beside it.** The
  exclusion constraint and its two generated columns, the `admit_allow_listed_member` trigger, the
  status guard that runs before the INV-02 reset, and `holiday.kind` naming the effect rather than
  the label — each is a decision whose reasoning lives in an ADR and whose expression lives in a
  migration. A composed schema file that loses the link is a set of statements nobody can argue with.
- **INV-01 to INV-07, and the charter.** The database is where they are held. In particular, charter
  refusal 6 and CAL-07's note forbid any policy, CHECK or `BEFORE INSERT/UPDATE` trigger from
  consulting the overload threshold — a live constraint on any DDL written ahead of the features that
  would need it.
- **ADR-024 decision point 3 — no gate may compare the repository to the hosted project**, because
  the credential to do it has nowhere to live. That bound applies to schema exactly as it applies to
  data: whatever is decided here, it cannot be a check that reads the live database.

## Out of scope

- **Applying anything to any database.** Human, per RULE-09 and ADR-024 decision point 2. This idea
  produces no execution and no credential use.
- **The seed, and the row-level drift ADR-024 is about.** `supabase/seed.sql` holds data; this is
  about structure. They are adjacent and they are not the same file or the same decision.
- **Auditing what the live project currently contains.** Already owed to a human by
  `.ai/board/tickets/BUG-001/ticket.yaml` §10 and named again in ADR-024. Any answer here may
  *depend* on that listing; it does not perform it.
- **Replacing or retiring the Supabase CLI migration mechanism.** It is named by
  `.ai/standards/tech-stack.md` and by `.ai/standards/data-model.md` § Migrations, and nothing in
  this problem argues against it. An answer that quietly makes migrations optional has changed the
  mechanism rather than described it.
- **Building any new gate that reads a hosted database.** ADR-024 decision point 3, and its revert
  condition names the separate decision that would reopen it.
- **Amending `.ai/standards/data-model.md`, `.ai/standards/tech-stack.md` or `.github/CODEOWNERS`.**
  Three stale or unpaid markers are named above as evidence. Each is human plane, and two are already
  recorded as owed by ADR-024. Naming them is not fixing them.
- **Deciding the schema of any `PLANNED` feature.** ADM-01 through ADM-06 and CAL-04 through CAL-08
  reach their DDL at PLAN, with an ADR where `schema_delta` requires one. This idea does not
  pre-empt any of them, and the second open question below is precisely whether it may.

## Open questions

**The first two are being put to `tech-lead-design` in parallel with this file, and the verdict waits
on them.** Neither is answerable from the product side: both are about what an artifact of this kind
*is*, and getting them wrong in either direction produces a file that is worse than none.

1. **Is such a file derived from the migrations, or authoritative over them?** *Derived* means the
   migrations remain the only thing ever applied, the file is regenerated and never hand-edited, and
   the open question becomes what regenerates it and what fails when it is stale. *Authoritative*
   means the file is what a fresh project is built from, and the migration set becomes the history of
   how the existing project got there — which changes what `/plan` produces and what `/ship` names.
   The two readings produce the same text today and diverge permanently on the next migration. A file
   whose standing is undeclared will be read both ways by different people, which is the specific
   failure mode ADR-024 records for the seed: two things nobody declared to be different.
2. **May it carry DDL for features that have not been through PLAN?** The operator asked for a schema
   *"that all feature will follow"*, and eleven of the nineteen rows in `.ai/registry/features.md`
   are `PLANNED`. `holiday` is the easy case — fully specified in `.ai/standards/data-model.md` and
   decided by ADR-015, so its DDL would be transcription rather than invention. Everything else is
   not: no document states whether ADM-01's threshold write, ADM-04's worklist, ADM-06's batch
   rejection or CAL-04's absence count need any column at all, and `.ai/standards/data-model.md`
   OPEN QUESTIONS item 5 (`updated_by`) is an open schema decision sitting directly in the path.
   Writing DDL for those is inventing field names into the file everything is told to follow, against
   RULE-04 and the no-invention rule. Refusing to write them means the file answers *"what exists"*
   and not *"what all features will follow"* — which is a narrower artifact than the one requested,
   and the operator should be told so rather than handed it quietly.

Three further questions, product-side, that do not block the verdict but do bind whatever follows:

3. **Which of the two needs in the operator's sentence is urgent right now?** *"Scan all features and
   make a database design"* and *"give me one file I can execute"* have different answers, different
   sizes and different risks. If the immediate need is a working database, the second is a small
   piece of work with a known hazard; if it is design coverage across the remaining eleven features,
   that is a sequence of PLAN-stage decisions and no single file discharges it.
4. **Is the target a fresh project or the existing one?** ADR-024 decision point 4 establishes that
   the hosted project may hold rows written by something other than this repository. For DDL the
   equivalent is stronger: against a project that already holds these tables, a composed schema file
   is not idempotent by default and fails partway through. Which target is intended changes what is
   safe to hand over.
5. **Does anything else in the repository claim to describe the database?** The invariant-to-mechanism
   table in `.ai/standards/data-model.md`, the entity tables in the same file, and the per-ticket
   design sections each assert facts about schema. If a new artifact answers the same question, the
   count of things claiming to describe one database goes from three to four, and nothing says which
   one a reader should believe.

## Triage verdict: NEEDS-ADR

**Decided 2026-09-04 by `product`, on the ADR `tech-lead-design` wrote in the same run.** One verdict,
and the reason is that both blocking questions above are questions about *what an artifact of this kind
is* — the standing of the file against the migrations, and whether it may carry DDL that no PLAN gate
has seen. Neither is answerable from the product side, and the second one reaches ADR-014, which is
`ACCEPTED by the operator`. A file written without settling them would have been the second answer to
*"what is the schema"* that this idea exists to prevent.

**The ADR is
[ADR-025](../../registry/decisions/ADR-025-db-sql-is-generated-and-never-a-second-source.md),
`ACCEPTED by tech-lead-design` under ADR-008.** It is not summarised here; it is the record, and it
supersedes nothing.

**It answers both blocking questions, which is what this verdict turns on:**

- **Open question 1 — derived, not authoritative.** ADR-025 decision points 1 and 5. `supabase/db.sql`
  is generated from `supabase/migrations/` in filename order, carries no authority, and a check in
  `scripts/check-docs.mjs` regenerates it and fails on any difference. Both sides of that comparison
  are files in this repository, which is the thing ADR-024 could not have.
- **Open question 2 — no.** ADR-025 decision point 2 refuses every object whose owning ticket has not
  shipped a migration. That refusal is what made the ADR self-acceptable: writing ADM-02's, ADM-03's,
  ADM-05's and ADM-06's statements in today would spend four tickets' `schema_delta` before their
  PLANs run, which is ADR-014 walked past rather than applied.

**Product-side questions 3, 4 and 5 do not block this verdict and are not all closed.** ADR-025
decision point 3 disposes of question 4 mechanically — the file is fresh-database-only and its preamble
says so — and its *Consequences* record that the operator asked for the target schema and receives the
shipped one. That gap is question 3, and closing it is the operator's: ADR-025 *Revert condition* 1
names the form the answer takes, and it is a decision `ACCEPTED by the operator`, not an amendment an
agent may make.

**No feature row, no feature ID, no ticket and no backlog row are issued here.** ADR-007 authorises a
row on `PROMOTE` only, and this is not one. The four agent-owed files in ADR-025's *Changed by this
ADR* are `ops/<slug>` steward work; the two human-owed rows are RULE-01 and are the operator's.

**`next_state` stays `TRIAGE`.** Same reason as
[nobody-can-join](2026-08-31-nobody-can-join-the-board.md): the state enum in
[.ai/01-operating-model.md](../../01-operating-model.md) carries no value meaning *waiting on a human
at the board plane*, and this idea has no ticket that could hold `ESCALATED`.

**Three findings this triage surfaced by accident are recorded in
[.ai/board/model-debt.md](../model-debt.md) as MD-023, MD-024 and MD-025.** Each is a true statement
about the repository that nobody asked about, none is fixable from here under `CLAUDE.md` §
*Working agreements*, and none has a ticket to carry it: `public.team` is RLS-enabled with no policy
and no grant so no client can read it; the ADM-05 registry row still claims `entry_update_admin` is
owed, which CAL-03 shipped; and the synthetic holiday set that `.ai/standards/data-model.md` §
*Seed data* describes in the present tense appears in neither of the two files it names.
