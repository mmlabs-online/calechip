---
doc_version: 3
last_updated: 2026-09-04
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-025 — `supabase/db.sql` is generated from the migrations, carries only what has shipped, and is never a second source

## Status

`SUPERSEDED by ADR-026` — 2026-09-04.

**The whole document below is left exactly as it was written**, including the recommendation this
supersession reverses. It is the record of what was believed and argued before the operator answered,
and its *Rationale* is now the strongest account a reviewer has of what option B costs. Correcting it
to agree with the present would destroy the only evidence that the cost was put in front of anybody.

Its original status line, kept: `ACCEPTED by tech-lead-design` — 2026-09-04, at `/triage`, under
ADR-008 and `.claude/commands/triage.md`.

Accepted rather than referred, because every clause below sits **inside** what ADR-005, ADR-014,
ADR-015, ADR-016, ADR-023 and ADR-024 have already decided. Decision point 2 is the load-bearing one
and it is a **refusal**, not an opening: it forbids the consolidated file from carrying anything a
PLAN gate has not already passed, in the same terms ADR-014 already uses. Nothing here supersedes or
reverses an accepted ADR, and `.ai/standards/data-model.md` § Migrations keeps naming the mechanism
it already names.

**The operator asked for the target schema, and this ADR gives them the shipped schema.** That gap is
deliberate and is argued in *Rationale* under option B. If the operator wants the target schema
instead, that is a decision only they can take, it supersedes this document rather than amending it,
and *Revert condition* names it.

## Context

The operator's request, verbatim: *"hey I need to first scan all feature of product and makeing an
Database design. Write whole db.sql for project that all feature will follow. And the SQL I will
execute in supabase"*.

`.ai/standards/data-model.md` § Migrations names Supabase CLI migrations as the mechanism, and
`supabase/migrations/` holds seven files, one per shipped ticket, in filename order:
TEA-01, TEA-02, TEA-03, TEA-04, CAL-01, CAL-02, CAL-03. There is no consolidated file. A person who
wants to know what the schema is reads seven files and holds the order in their head; a person who
wants to stand up a fresh project has no single thing to paste.

### The measured gap between the seven shipped migrations and the complete model

Read off the files rather than recalled. *Decided* means a document already states the object in a
form that can be transcribed without a choice being made; *undecided* means somebody would have to
design it.

| Missing object | Owed by | Decided? | Where, or what is missing |
|---|---|---|---|
| `public.holiday_kind` enum | ADM-02 | **decided** | ADR-015 §2 and §3 write the statement out |
| `public.holiday` table, incl. `date date not null unique` | ADM-02 | **decided** | ADR-015 §3; `.ai/standards/data-model.md` § `holiday` |
| `enable row level security`, `revoke all … from anon, authenticated`, `grant select on public.holiday to authenticated`, policy `holiday_select_all using (true)` | ADM-02 | **decided** | ADR-015 §3, verbatim, with the `using (true)` comment it requires |
| The several-years national holiday rows, `insert … on conflict (date) do nothing` | ADM-02 | **mechanism decided, content undecided** | ADR-015 §5 writes one row and then an ellipsis. How many years is an open `TODO(project)` on the ADM-02 row, and the dates themselves are facts about Vietnamese government announcements that no file here carries |
| Policies `holiday_insert_admin`, `holiday_update_admin` (needs both `using` and `with check`), `holiday_delete_admin`, and `grant insert, update, delete on public.holiday to authenticated` | ADM-03 | **decided** | ADR-015 §3, verbatim |
| A small synthetic holiday set in `supabase/seed.sql` and `src/lib/fixtures.ts` | ADM-02 | **shape decided, literals undecided** | ADR-015 §5 fixes the shape — one `non_working`, one compensatory day off, one `working` Saturday, one bridge day, one empty year. Both files contain zero occurrences of the word today |
| `grant update (status, rejection_reason) on public.entry to authenticated` | ADM-05 | **decided** | ADR-016 *Consequences* names the full column list; `supabase/migrations/20260903143000_cal02_own_entry_writes.sql` step 1 defers exactly these two by name and says why |
| `public.entry_enforce_decision()` clauses (a) the admin guard and (b) provenance, by `create or replace` | ADM-05 | **decided verbatim** | ADR-016 §1 carries the whole function body. The shipped form is `updated_at` plus clause (c) only |
| Policy `entry_update_admin` | — | **already shipped** | `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql`. The ADM-05 row in `.ai/registry/features.md` still lists it as owed; that sentence was written before CAL-03 shipped and is now stale |
| `grant select on public.team to authenticated`, and a select policy on `public.team` | **CAL-04** — not ADM-01 | **grant decided, policy undecided** | The CAL-04 row in `.ai/registry/features.md` assigns both, and closes the marker "as scope rather than as a question". No accepted document names the policy or its predicate. ADM-01's plan proposes `team_select_own`, but that plan is board plane and carries `gate: BLOCKED` |
| `grant update (overload_threshold) on public.team to authenticated`, and policy `team_update_admin` | ADM-01 | **grant decided, policy undecided, and the ticket is blocked** | The ADM-01 row writes the grant out verbatim and explains why an RLS `UPDATE` policy alone turns *set the threshold* into *edit the team row*. The policy predicate exists only in a BLOCKED plan, and the blocking question is a `.ai/registry/features.md` ownership change, which is RULE-01 human-only |
| `public.reject_entries(p_ids uuid[], p_reason text)`, `security invoker`, with `revoke all … from public` and `grant execute … to authenticated` | ADM-06 | **decided verbatim** | ADR-016 §4 carries the whole function |

**Confirmations and corrections to the read this triage was given.**

- **`public.team` has RLS enabled and no grant and no policy at all — confirmed.**
  `supabase/migrations/20260831150024_tea01_membership.sql:138` enables RLS, `:145` revokes all on
  `team`, `member` and `allowed_email` from `anon` and `authenticated`, and `:146-147` grant `select`
  on `member` and `allowed_email` **only**. No `team` policy is created in any of the seven files. So
  no client can read `overload_threshold` today, and RLS default-deny means the table is closed
  rather than open — the failure is a feature that cannot be built, not a leak.
- **What ADM-01 owes is the `update` half, not the `select` half.** The CAL-04 row owns the select
  policy and its grant; the ADM-01 row says so in terms — *"CAL-04 owns the matching select policy
  and grant"* — and CAL-04's row says the same in the other direction. ADM-01 owes
  `grant update (overload_threshold)` plus one admin update policy. The operator's provisional list
  attributed the select half to ADM-01.
- **ADM-05 does not owe the admin decision policy.** CAL-03 shipped `entry_update_admin` on
  2026-09-03. ADM-05 owes the two-column grant and the two trigger clauses, both already written out
  in ADR-016 and neither requiring a design choice.
- **CAL-04 through CAL-08 do *not* all carry no schema delta.** CAL-05, CAL-06, CAL-07 and CAL-08 are
  `none` and that is confirmed. **CAL-04 is not `none`** — it owns the `team` select policy and grant,
  which is ADR-014's own *Correction* of 2026-08-31, recorded there because an earlier sentence in
  that ADR exempted "CAL-04 through CAL-07" by name and was wrong.

### Three measured facts that bound what a consolidated file can be

- **Concatenating the seven migrations is not idempotent, and cannot be made so without changing
  their semantics.** Every `create type`, `create table`, `create policy` and `create trigger` in
  them is unqualified. The concatenation runs correctly exactly once, against an empty database.
  Rewriting each to `if not exists` is a transformation, not a generation, and it is worse than the
  failure it removes: `create table if not exists` silently accepts a table whose columns differ,
  which is precisely the drift the file would exist to eliminate.
- **Dumping the schema out of the hosted project is not available.** `supabase db dump --db-url`
  exists in the installed CLI, and reaching for the connection string is the credential decision
  ADR-024 §3 declines to take. A dump would also answer a different question — what the project holds
  — and ADR-024's whole Context is that the project and the repository are two different rosters.
- **ADR-014 makes each of the missing policies a gated event.** `ACCEPTED by the operator`: a
  migration that creates a row-level security policy is not `schema_delta: none`, so it needs an ADR
  linked and it passes Definition of Ready once, per ticket. Under ADR-005 those policies *are* the
  authorization model, and `.ai/standards/rbac-and-security.md` records as its first known weakness
  that a permissive policy fails open and silently.

## Decision

**1. `supabase/db.sql` exists, and it is derived.**

It is produced by concatenating every file in `supabase/migrations/` in filename order, unmodified,
each preceded by a comment naming its source file. Not one statement is rewritten, reordered or
merged. The generator is a Node script under `scripts/`, named `build-db-sql.mjs`, run with `node`
per the Windows-native working agreement in `CLAUDE.md`. It takes no dependency, so review check R9
is not engaged.

**`supabase/migrations/` stays the source. `db.sql` is a view of it and carries no authority.**
`.ai/standards/data-model.md` § Migrations is untouched and still names the mechanism. Where the two
ever disagree, the migrations are right by construction and the generated file is stale — which is
what decision point 5 exists to make impossible.

**2. It carries only shipped migrations. Nothing else may be written into it.**

Every object in the gap table above stays out until the ticket that owns it ships a migration. This
is the refusal that makes the file safe to accept without the operator: writing ADM-02's, ADM-03's,
ADM-05's and ADM-06's statements into it today would spend four tickets' `schema_delta` before any of
their PLANs run, and would put four sets of RLS policies into the repository without any of them
passing the one gate ADR-014 exists to put in front of them.

The two `team` policies are refused for a second and independent reason: they are not decided
anywhere, and one of them is the subject of a BLOCKED ticket whose blocking question is a RULE-01
registry edit.

**3. The file is fresh-database-only, and its first line says so.**

The preamble states, in the file itself rather than only here: that it is generated and must never be
hand-edited; the name of the last migration it contains; that it is **not** idempotent and will fail
against a database that already holds these objects; that against the existing hosted project the
correct action is `supabase db push`, per ADR-024 decision point 2; and that applying it is a human
action under RULE-09.

**4. Regeneration is owed by the ticket that adds or edits a migration — not by `/ship`.**

A ticket whose `allowed_paths` already contain a file under `supabase/migrations/` adds
`supabase/db.sql` to that list at PLAN and regenerates in the same change. This is a deliberate
choice against putting it in `/ship`: `/ship` writing a path outside `allowed_paths` would require a
fourth name in the exemption array in `scripts/check-allowed-paths.mjs`, and ADR-023 §2 fixes that
set at three names precisely so RULE-03's CI check does not weaken one convenience at a time. The
mechanism ADR-023 names for adding a fourth is available and is not used, because it is not needed.

**5. A check regenerates the file and fails on a difference.**

`node scripts/check-docs.mjs` gains a check that runs the generator into memory and compares it to
`supabase/db.sql`, failing on any difference and passing when the file is absent-and-unclaimed only
if nothing under `supabase/migrations/` exists. This is the detector ADR-024 could not have and said
so: there, the comparison needed a credential no place in this repository may hold; here **both sides
are files in the repository**, so the drift this decision could otherwise introduce is mechanically
impossible to commit.

**6. RULE-04 is unaffected.** Field names still come from `.ai/standards/data-model.md` and plan
section 1. A generated file is not a place a name may be invented, and nothing may cite `db.sql` as
the origin of a column.

## Rationale

Three options were weighed. They differ only in **what the file contains**; all three agree the file
is generated, human-applied and subordinate.

### A — derived, shipped-only. Chosen.

Additive. Reverses nothing. Supersedes nothing. The operator can run it today against a fresh
Supabase project and get exactly the schema CAL-03 left, with no statement in it that any reviewer has
not already approved on a merged pull request.

**The single strongest reason: it is the only one of the three whose contents are already true.**
Every line in it has passed a PLAN gate, a review and a merge. B and C both put statements into the
repository that no gate has seen, and under ADR-005 an unreviewed policy is not a rough draft — it is
the authorization model.

Its cost is that it does not answer the question the operator asked. That cost is real and is not
smoothed over: *see Consequences*.

### B — the whole target schema now. Rejected, and partly unavailable.

This is the literal request. Splitting it by what it would actually take:

**Transcription of a decided document — available, and the majority of it.** `holiday_kind`, the
`holiday` table with `unique (date)`, its RLS, revoke, grant and `holiday_select_all`; the three
admin holiday policies and their grant; the `status`/`rejection_reason` grant; clauses (a) and (b) of
`entry_enforce_decision()`; and `public.reject_entries` with its revoke and grant. All of it is
written out verbatim in ADR-015 §3 and §5 and ADR-016 §1 and §4, and copying it invents nothing.

**Design work ahead of a PLAN that has not run — not available.** The select policy and grant on
`public.team`, and the update policy beside `grant update (overload_threshold)`. No accepted document
names either policy or its predicate. Worse, ADM-01's plan is **BLOCKED** on exactly this: the
question is whether ADM-01 may take the select policy that the CAL-04 row in `.ai/registry/features.md`
assigns to CAL-04, and moving that ownership is a registry edit under RULE-01. A `db.sql` that
contains those two statements answers a blocked ticket's blocking question by writing the answer down
somewhere else. That is the envelope, not the inside of it.

**Facts about the world — not available.** The several years of Vietnamese national holidays. ADR-015
§5 gives one row and an ellipsis; how many years is an open `TODO(project)`; and the dates come from
government announcements, not from a file in this repository. Writing them from recall is the exact
thing `.ai/standards/tech-stack.md` § *past reliable recall* forbids, in a table where a wrong date
silently moves bridge-day detection for the whole team.

**And the tickets whose `schema_delta` would be spent before they are planned:** ADM-02, ADM-03,
ADM-05 and ADM-06 — four, plus ADM-01 and CAL-04 partially. ADR-014 was accepted by the operator
knowing it would make most `ADM` and `TEA` tickets need an ADR; its stated purpose is that a policy
gets looked at once, deliberately, by the one gate positioned to stop. B does not weaken that gate —
it walks five tickets past it in a single file. **That is a reversal of an accepted ADR, so it is not
an agent's to take.**

### C — tables and constraints now, grants and policies with their tickets. Rejected.

The apparent middle, and the worst of the three.

Under ADR-005 the policies **are** the authorization model, so C ships a schema that is one of two
things and neither is acceptable. If C creates `holiday` with `enable row level security` and no
policy, the table is closed to every client and the feature is unbuildable — the file is safe and
useless, and it is a strictly worse copy of A. If C creates it without enabling RLS, it is **silently
open**: Supabase's default grants reach `anon` and `authenticated`, the anon key ships in the browser
bundle by design, and nothing in the model catches it, because `.ai/standards/rbac-and-security.md`
known weakness 1 records that RLS is not the last line of defence but the only one.

The split C proposes is also the wrong axis. `.ai/01-operating-model.md` splits by **operation** —
read path, then write path — which is exactly why ADM-02 and ADM-03 are two rows. C splits by
**mechanism**, which produces a database object with no reachable behaviour and nothing to exercise
at a gate.

### A fourth option, named because it is the one a reader thinks of next

**Generate the file by dumping the hosted project.** It would be authoritative about what actually
runs, which no repository file is. Rejected under ADR-024 §3: it needs the database URL or the
service-role key, which is the deferred credential decision, and it would make the file a statement
about the project rather than about the repository — so the two could still disagree, only now
silently and in the other direction.

## Consequences

- **The operator does not get what they asked for, and this is the cost of the decision rather than
  an oversight.** They asked for the schema every feature will follow; they get the schema the
  features that shipped already follow. The gap table in *Context* is the compensation: it names
  every missing object, who owns it, and whether it is a transcription or a design — which is the
  part of B that was genuinely available and can be delivered as knowledge without being delivered as
  SQL.
- **`db.sql` fails loudly against the existing hosted project.** It is a fresh-project artifact. An
  operator who pastes it into the SQL editor of the project named in `.env` will get "type
  member_role already exists" on the second statement, and — since the file is not wrapped in a
  transaction, exactly as `supabase/seed.sql` is not — a partially applied state. The preamble says
  so; that is a warning, not a guard.
- **One more file must be regenerated in every migration-bearing ticket.** That is friction on every
  ADM ticket left in the queue, all of which carry a migration. It is bounded by decision point 5:
  forgetting fails the audit rather than shipping stale.
- **`.ai/standards/data-model.md` § Migrations now has a neighbour it does not mention.** A reader
  arriving at that section learns the migrations are the mechanism and does not learn that a
  generated consolidation exists beside them. That file is standards plane and human-only under
  RULE-01, so this ADR does not edit it; the correction is owed to a human and is named in
  *Changed by this ADR* so it is not lost. This is the same shape as ADR-024's stale `tech-stack.md`
  rows.
- **Two checks and one generator become model surface that has to keep working.** A generator that
  breaks silently produces a file that looks current, which is why the check is part of the decision
  and not a follow-up. The check is also a new place the audit can fail for a reason unrelated to
  documents, and `node scripts/check-docs.mjs` is run at several gates.
- **Nothing about the gap becomes any easier to close.** ADM-01 is still blocked, the holiday dates
  are still unknown, and ADM-02's seed horizon is still an open question. This ADR makes the gap
  legible; it closes none of it.

## Revert condition

**Two observable signals, either one.**

1. **The operator decides they want the target schema in the file.** That reverses decision point 2
   and walks ADR-014's gate for the tickets named in *Rationale* option B, so it supersedes this ADR
   rather than amending it, and the superseding document carries `ACCEPTED by the operator`. It also
   cannot be satisfied in full: the two `team` policies and the holiday dates are unavailable to any
   agent for the reasons stated, so the superseding decision has to say what it does about them.
2. **`supabase/db.sql` is found edited by hand, or found disagreeing with a regeneration on `main`.**
   Either means decision point 5 is not doing its work, and the file has become the second answer to
   "what is the schema" that this ADR exists to prevent. The remedy is to delete the file and the
   generator, not to fix them: a consolidated schema nobody can trust is worse than seven files
   somebody has to read in order.

## Changed by this ADR

| File | Change | Plane |
|---|---|---|
| `supabase/db.sql` | created, generated, fresh-database-only | agent, owed |
| `scripts/` — `build-db-sql.mjs` | the generator; concatenation in filename order, no transformation | agent, owed |
| `scripts/check-docs.mjs` | a check that regenerates and fails on a difference | agent, owed |
| `.ai/templates/plan.md` | a ticket adding a migration lists `supabase/db.sql` in `allowed_paths` | agent, owed |
| `.ai/standards/data-model.md` | § Migrations should name the generated consolidation beside the source | **human, owed** |
| `.ai/registry/features.md` | the ADM-05 row still lists `entry_update_admin` as owed; CAL-03 shipped it | **human, owed** |
| `.claude/commands/ship.md` | nothing. Decision point 4 keeps `/ship` out of this. | — |
| `supabase/migrations/` | nothing. The seven files are the source and are unchanged. | — |

**No file is written by this ADR**, and that is decision point 1's own consequence: the first four
rows are `ops/<slug>` steward work, and the two human rows are RULE-01 and are owed to the operator.
