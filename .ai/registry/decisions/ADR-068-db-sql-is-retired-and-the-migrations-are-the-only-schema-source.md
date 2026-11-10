---
doc_version: 2
last_updated: 2026-10-23
governed_by: [RULE-01, RULE-09]
---

# ADR-068 — `supabase/db.sql` is retired, and `supabase/migrations/` is the only source of the schema

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)` — 2026-10-23, at `/plan
MIR-08`.

**Supersedes ADR-026**, which was `ACCEPTED by the operator`. That supersession is made under
ADR-067's delegation, not by the operator in person. ADR-026 is left as it was written except for
its status line. ADR-025 stays `SUPERSEDED`. This decision takes ADR-025's revert remedy, not
ADR-025's generator.

## Context

Feature MIR-08 (`.ai/registry/features.md`): *`supabase/db.sql` is regenerated from the applied
migrations or retired, and CI fails on drift.* Plan item P2-1
(`.ai/board/plans/calechip-multi-tenancy-plan.md:142-145`) leaves two outcomes open: replace the file
with a generated dump, or delete it and name the migrations as the only source.

The multi-tenancy audit (`.ai/board/audits/multi-tenancy-audit-2026-10-12.md`, A:307-337) found
`db.sql` wrong in twelve places, even though line 1 calls it "the whole schema". Two of the errors
are the `is_admin` and `member_team_id` bodies without `status = 'approved'`. MD-033 has recorded
the drift since 2026-09-10. ADR-064 and ADR-065 both left the file deliberately not updated, naming
this ticket.

ADR-026's own revert condition 2 is *"Group 1 is found disagreeing with `supabase/migrations/` on
`main` … One occurrence is enough."* That condition has fired. ADR-025's revert condition 2 names the
remedy: *"delete the file and the generator, not … fix them: a consolidated schema nobody can trust
is worse than seven files somebody has to read in order."*

ADR-026's group 2 no longer has a reason to exist. All four tickets it was written for (ADM-02,
ADM-03, ADM-05, ADM-06) now have their own migrations under `supabase/migrations/`.

## Options

- **A — retire.** Delete `supabase/db.sql` and remove the two code comments that cite it as a fact.
  The migrations are the only source.
- **B — regenerate.** Replace the file with `supabase db dump --local` of the stack that MIR-05
  builds, and add a CI step that regenerates the file and fails on a diff.
- **C — hand-correct the twelve discrepancies and keep ADR-026.** This is not a fix. It is the
  regime that produced the drift.

## Decision

**A.** `supabase/db.sql` is deleted, and nothing replaces it in the repository. To read the
schema, run `pnpm db:test` (or `supabase db reset --local`) to build it, then inspect the local
database. The files in `supabase/migrations/`, in filename order, are the only written statement of
the schema.

## Rationale

- B keeps a second artifact that every migration-bearing ticket must regenerate. ADR-025 named that
  friction, and B adds a file to every such ticket's `allowed_paths`.
- B's dump format belongs to the Supabase CLI and the Postgres version, and both are on the *past
  reliable recall* list in `.ai/standards/tech-stack.md`. A CLI upgrade would produce drift that no
  ticket caused.
- B also has to choose between dumping `public` only, which misses the `auth.users` sync triggers
  (audit discrepancy 6), and dumping `auth` as well, which includes Supabase-owned objects. Neither
  is clean.
- A matches the remedy that both earlier ADRs wrote for exactly this failure.
- With nothing left to drift, *"CI fails on drift"* holds trivially. CI's `database` job already
  builds the schema from every migration on every pull request (MIR-05).

## Consequences

- No single file can be pasted into a fresh project. A fresh environment uses `supabase db reset`,
  which is the mechanism `.ai/standards/data-model.md` § Migrations already names.
- Readers who want the whole schema in one place lose that convenience. They build the local stack
  and inspect it. Phase 3 planners must cite migrations, not `db.sql`.
- Historical plans and reviews that cite `db.sql:<line>` become citations into git history only.
  They are left unedited.

## Revert condition

A ticket's PLAN is found citing a schema fact that no migration supports, because no single readable
source existed. That would be evidence for B. B would then supersede this ADR, keeping its
regeneration check.

## Changed by this ADR

| File | Change | Plane |
|---|---|---|
| `supabase/db.sql` | deleted | agent, MIR-08 |
| `src/lib/data/supabase.ts`, `src/routes/MonthView.tsx` | the comments citing "db.sql 9.1" no longer cite it | agent, MIR-08 |
| `.ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md` | status line to `SUPERSEDED by ADR-068` | agent, MIR-08 |
| `.ai/standards/rbac-and-security.md` | row A6 should record the file as retired | **human, owed** |
| `.ai/board/model-debt.md` | MD-033 closes on merge | steward, owed |
