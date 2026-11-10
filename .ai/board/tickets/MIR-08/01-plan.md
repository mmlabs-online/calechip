---
ticket: MIR-08
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-23T04:12:33Z
inputs_read:
  - .ai/board/tickets/MIR-08/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-025-db-sql-is-generated-and-never-a-second-source.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - .ai/registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md
  - .ai/registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md
  - .ai/registry/decisions/ADR-067-the-runner-pushes-merges-and-decides-blocked-questions-on-its-own.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/model-debt.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - scripts/db-test.mjs
  - .github/workflows/verify.yml
  - supabase/db.sql
  - supabase/migrations/
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-08 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md`:**

| ID | Feature | Group | Status |
|---|---|---|---|
| MIR-08 | `supabase/db.sql` is regenerated from the applied migrations or retired, and CI fails on drift | MIR | PLANNED |

The source is plan item P2-1 (`.ai/board/plans/calechip-multi-tenancy-plan.md:142-145`):
- Generate the real schema from the applied migrations.
- Replace `supabase/db.sql` with the generated dump, or delete it and document migrations as the
  only source.
- If the file is kept, add a CI check that regenerates it and fails on drift.

**Outcome chosen: retire** (ADR-068, see *Delegated decisions*).

**Who gains what.** This ticket is for anyone who designs against the schema: a human, or a Tech
Lead agent at PLAN for a phase 3 MIR ticket. They get one schema source that cannot disagree with
itself.

Today `supabase/db.sql:1` calls itself "the whole schema", but the audit (A:307-337) found it wrong
in twelve places. Two of the errors are `is_admin` and `member_team_id` bodies that predate
`status = 'approved'`. Phase 3 rewrites every policy (`multi-tenancy-plan.md:140`). A stale
reference here is the most likely way a policy gets designed against a predicate that no longer
runs.

**Out of scope.**
- **The four P2-2 clean-ups.** These are `issue.sql` transaction wrapping, the `allowed_email`
  references, the `member.team_id` index and the `overload_threshold` check. They belong to MIR-09.
- **Any change to the database.** No migration, table, policy, function or grant changes. `db.sql`
  was never a migration (ADR-026 decision 6).
- **A replacement artifact.** That means no generator, no dump, and no `check-docs.mjs` guard against
  the file coming back (section 8).
- **Standards-plane corrections.** This covers `.ai/standards/rbac-and-security.md` row A6 and
  `.ai/standards/data-model.md`. Both are human-only (RULE-01) and are listed as owed in ADR-068.
- **Closing MD-033 in `.ai/board/model-debt.md`.** That is the steward's job, on merge.
- **Historical tickets, ADRs and migration comments that cite `db.sql:<line>`.** They are records
  of their time and are left unedited.

**`size_estimate`: S.**

## 2. Acceptance criteria

**AC-1**
- Given the branch after implementation
- When the tree is listed
- Then `supabase/db.sql` does not exist

**AC-2 (refusal)**
- Given the branch after implementation
- When it is diffed against `origin/main`
- Then no path under `supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql` or
  `supabase/config.toml` has changed

**AC-3**
- Given `src/lib/data/supabase.ts` and `src/routes/MonthView.tsx`
- When they are searched for the string `db.sql`
- Then there is no match, and both comments that previously cited "(db.sql 9.1)" now cite
  `supabase/migrations/20260904100000_cal04_team_select.sql` instead. The sentence each comment
  makes is otherwise unchanged: before that migration is applied, `public.team` has no grant and no
  policy.

**AC-4**
- Given the branch after implementation
- When `pnpm typecheck`, `pnpm lint` and `pnpm test` run
- Then all three pass. Only comments changed in `src/`.

**AC-5**
- Given CI on the pull request
- When the `database` job runs (`pnpm db:test`, which builds every migration and runs pgTAP)
- Then it passes. This shows that nothing needed `db.sql` to build or test the schema. The same
  check is the drift guarantee the feature row asks for, because the only schema source is the one
  CI builds.

**AC-6**
- Given `.ai/registry/decisions/`
- When ADR-026 and ADR-068 are read
- Then ADR-026's status reads `SUPERSEDED by ADR-068`, its original status line is kept, and
  ADR-068 is `ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

**Invariants touched:** `[]`. No row, policy, function or grant changes. The file being retired
describes the schema; it is not the schema.

**Open questions:** none.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(There is no layout: this ticket has no user interface.)

## 3. Permission model

No role gains or loses any capability. No RLS policy, grant or definer function is touched, so
there is no server-side check to add and no denial changes. Applying anything to the hosted project
remains human (RULE-09), and this ticket applies nothing.

## 4. Contract

None. No entry point, type, field or schema is added or changed. The whole implementation is:
- delete `supabase/db.sql`;
- in each of the two comments, replace the parenthetical `(db.sql 9.1)` with
  ``(`supabase/migrations/20260904100000_cal04_team_select.sql`)``. The comments are at
  `src/lib/data/supabase.ts:2304` and `src/routes/MonthView.tsx:293`.

## 5. Seam impact

None. `src/lib/data/supabase.ts` changes in one comment only; no function, name or arity changes.

## 6. Schema delta

`none`. No database object is created, altered or dropped. `requires_adr: true` is set because
ADR-068 supersedes ADR-026, not because the schema changes. ADR-068 is written and linked.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-068-db-sql-is-retired-and-the-migrations-are-the-only-schema-source.md"
  - ".ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md"
  - "supabase/db.sql"
  - "src/lib/data/supabase.ts"
  - "src/routes/MonthView.tsx"
```

The two ADR paths were added before they were written. Both are already complete at PLAN, and the
Developer does not touch them.

`size: S`, which agrees with `size_estimate`. `glossary_owed` is `[]`, so no glossary row is written.

## 8. Rejected alternatives

- **Regenerate the file instead (option B).** This means a `supabase db dump --local` of the MIR-05
  stack, plus a CI step that fails on a diff. It is plausible because the stack already exists in CI.
  Rejected (ADR-068 § Rationale):
  - Every migration-bearing ticket would also have to regenerate the file.
  - The dump format follows the CLI and Postgres versions, so an upgrade causes drift that no ticket
    caused.
  - `public` alone misses the `auth.users` triggers, and adding `auth` pulls in objects Supabase owns.
- **Hand-correct the twelve discrepancies and keep ADR-026.** This is the cheapest edit. Rejected
  because it is the regime that already drifted twelve times (MD-033), and it fails the feature row,
  which requires the file to be regenerated or retired.
- **Concatenate the migrations, as ADR-025's generator would.** This needs no Docker. Rejected
  because a concatenation reproduces history rather than the resulting schema. `is_admin` would
  appear in both its TEA-01 body and its `member_approval` body, so discrepancy 10 would be restated
  rather than fixed.
- **Add a `check-docs.mjs` check that fails if `db.sql` reappears.** Not planned. The feature row
  asks for a drift check only if the file is kept, and the check would be a new piece of model
  surface (`/thuki` territory) guarding against an unlikely event.

## Delegated decisions

- ADR-068: retire `supabase/db.sql` and name `supabase/migrations/` as the only schema source. It
  supersedes ADR-026 and was taken under ADR-067. Options A (retire), B (regenerate) and C
  (hand-correct) are recorded in the ADR.

## Changelog

- `2026-10-23T03:18:50Z` — plan written, `gate: BLOCKED` on the retire-or-regenerate choice and the
  superseding ADR for ADR-026. Raised by `tech-lead-design`.
- `2026-10-23T04:12:33Z` — re-run under ADR-067. Took option A, wrote ADR-068 and marked ADR-026
  superseded. Sections 1, 2, 4, 6, 7 and 8 were rewritten for option A only; the option B ACs and
  their contract were dropped; the open questions were resolved. Gate is now PASS. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
