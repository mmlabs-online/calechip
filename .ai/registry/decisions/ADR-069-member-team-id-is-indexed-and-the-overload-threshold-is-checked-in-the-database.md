---
doc_version: 3
last_updated: 2026-10-27
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-069 — `member.team_id` is indexed, the overload threshold is range-checked in the database, and `issue.sql` gains its transaction

## Status

`ACCEPTED by tech-lead-design` — 2026-10-23, at `/plan MIR-09`, under ADR-008.

This ADR supersedes and reverses no accepted ADR. It does reverse one *plan* decision:
`.ai/board/tickets/ADM-01/01-plan.md` § 6, *"No `check` constraint on the column, and the range
lives in the screen."* That was a plan, not a registry decision, and it is recorded here so that the
reversal is visible.

## Context

Feature MIR-09 (`.ai/registry/features.md`): *Known schema inconsistencies are cleaned up:
transaction wrapping, allow-list references, an index on `member.team_id`, a check on the overload
threshold.* The plan item is P2-2 (`.ai/board/plans/calechip-multi-tenancy-plan.md:147-151`). The
audit references are A:109, A:139, A:151-154 and A:246.

- `public.member` has a primary key and no other index (A:139). The team predicates in `cal11`, in
  `member_team_id` and in phase 3's coming `membership` backfill all read `member.team_id`.
- `team.overload_threshold numeric not null default 0.5` has no check (`tea01:27`, A:109). The range
  already exists in two written places:
  - ADM-01 AC-7 says *0% to 100% inclusive*.
  - `SetOverloadThresholdInput` (`src/lib/data/index.ts`) says *a FRACTION in [0, 1] inclusive*.

  At present only the screen enforces it. Any other caller — PostgREST directly, a future org-admin
  surface — can store `7` or `-1`.
- `20260926100000_solo_issue_report.sql` has no `begin`/`commit`, unlike the migrations written
  around it (A:246).

## Decision

1. **A new migration**, `supabase/migrations/20261023120000_mir09_schema_cleanup.sql`, wrapped in one
   `begin` … `commit`:
   - `create index if not exists member_team_id_idx on public.member (team_id);`
   - `alter table public.team drop constraint if exists team_overload_threshold_range;` then
     `alter table public.team add constraint team_overload_threshold_range check (overload_threshold >= 0 and overload_threshold <= 1);`

   **The constraint is validated immediately, not `not valid`.** If a row outside the range already
   exists, applying the migration fails loudly. A person then decides what that row should become.
   Adding the constraint silently over a bad row would leave the data inconsistent.
2. **`20260926100000_solo_issue_report.sql` gains `begin;` as its first statement and `commit;` as its
   last.** No other byte of that file changes. Projects that already applied it do not re-run it, so
   the edit matters only to a fresh environment. That is the environment the wrapping protects.
3. **The range is enforced at three layers, with one error code.**
   - The seam refuses a value that is not finite or is outside `[0, 1]` before it sends anything. The
     mock refuses the same values the same way (MIR-07: the mock is no looser than SQL).
   - SQLSTATE `23514` returned from that one write maps to the same code.
   - The code is `invalid_threshold`.

## Options considered

- **Range in the screen only (ADM-01's choice).** Rejected. With phase 3 adding org-admin writers,
  a guard that lives in one screen will not stay the only path.
- **Leave `issue.sql` alone and rely on the CLI's own per-file transaction.** Whether the Supabase
  CLI wraps each migration file is `TODO(verify)`: the CLI is on the *past reliable recall* list, and
  its help could not be read in the session that wrote this ADR. Rejected for that reason. The plan
  item asks for the wrapping, and 28 neighbouring migrations already carry it.
- **Wrap all 17 migrations that lack `begin`/`commit`.** The audit claim *"unlike its neighbours"*
  is true only locally: sixteen older files lack the wrapping too. Rejected. That would rewrite
  sixteen shipped files for a defect nobody has observed, and the plan item names one file.
- **`not valid` and validate later.** Rejected for the reason given in decision 1.

## Consequences

- An admin can no longer store a threshold outside 0–100% by any path.
- The migration fails to apply if the hosted project already holds such a value. That outcome is
  intended.
- `src/lib/data/index.ts` currently says *"NO RANGE CHECK HERE"*. That statement becomes false and
  is rewritten.
- Applying the migration is human (RULE-09).

## Revert condition

A legitimate threshold outside `[0, 1]` is decided by the product, for example a count instead of a
share. That change would redefine *Threshold* in the glossary and supersede this ADR.
