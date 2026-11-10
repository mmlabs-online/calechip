---
ticket: MIR-08
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-23T06:57:19Z
inputs_read:
  - .ai/board/tickets/MIR-08/01-plan.md
  - .ai/board/tickets/MIR-08/ticket.yaml
  - .ai/board/tickets/MIR-08/99-questions.md
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - .ai/registry/decisions/ADR-068-db-sql-is-retired-and-the-migrations-are-the-only-schema-source.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - src/lib/data/supabase.ts
  - src/routes/MonthView.tsx
  - supabase/migrations/
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-08 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/db.sql` | deleted | Retire the file per ADR-068/option A — it is a second, drifted source of the schema; `supabase/migrations/` remains the only source. | §4 item 1 |
| `src/lib/data/supabase.ts` | modified | Replaced the stale `(db.sql 9.1)` citation at line ~2304 with the migration file that actually grants/policies `public.team`, so the comment's claim stays checkable after `db.sql` is gone. | §4 item 2 |
| `src/routes/MonthView.tsx` | modified | Same replacement, at line ~293, in the comment explaining the `unavailable` phase before that migration is applied. | §4 item 2 |
| `.ai/board/tickets/MIR-08/99-questions.md` | created | Raised the lint-gate blocker (resolved externally, see Verification run and Open questions) to `tech-lead-design` — recorded under RULE-12/RULE-15 provenance, not a contract item. | n/a — process record, not a contract item |

No other file was touched. `.ai/registry/decisions/ADR-068-...md` and `ADR-026-...md` are in
`allowed_paths` but were already complete at PLAN (01-plan.md §7: "the Developer does not touch
them") — confirmed unchanged by reading both before starting and not editing either.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 1. delete `supabase/db.sql` | file removed from the tree (`git status --porcelain` shows `D supabase/db.sql`) | No replacement artifact added — no generator, no dump, no new check-docs.mjs guard (explicitly out of scope, §1). |
| 2. replace `(db.sql 9.1)` with the migration path in both comments | `src/lib/data/supabase.ts:2303-2304`, `src/routes/MonthView.tsx:292-294` | Both now cite `` `supabase/migrations/20260904100000_cal04_team_select.sql` `` and the sentence each comment makes ("before that migration is applied, `public.team` has no grant and no policy") is otherwise unchanged, per AC-3's wording. |

## Deviations from the design

`none`.

## Invariants

`invariants_touched: []` in `ticket.yaml`. No row, policy, function or grant was created, altered or
dropped — the only change to the database-adjacent surface is deleting a documentation file that was
never a migration (ADR-026 decision 6) and was not read by any code or CI step. Confirmed by: the
`database` CI job builds the schema from `supabase/migrations/` only (it never referenced
`db.sql`), and `git grep`-equivalent search found no reference to `db.sql` anywhere under `src/`
except the two comments edited here.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| typecheck (`pnpm exec tsc --noEmit`) | 0 | clean |
| lint (`pnpm exec eslint .`) | 0 | Re-run at 2026-10-23T06:57Z, after the previously BLOCKED run of this ticket (checkpoint `01dc09d`): clean. The blocking error was `scripts/run-loop.mjs:46:7 'PROTECTED_BRANCHES' is assigned a value but never used`, outside `allowed_paths` and not caused by this ticket (see Open questions). It was fixed independently in `4f9197e` ("fix(runner): lint error from ADR-067, re-run a BLOCKED /implement, two allow rules"), whose message confirms the stop was correct: *"MIR-08's developer stopped BLOCKED on it, correctly: the file is outside its allowed_paths."* That commit is now in this branch's history (`git log --oneline` includes it above `01dc09d`). Both files this ticket touched (`src/lib/data/supabase.ts`, `src/routes/MonthView.tsx`) were already lint-clean on their own; `supabase/db.sql` was deleted, not linted. |
| unit tests (`pnpm exec vitest run`) | 0 | 49 files, 987 tests, all pass (re-confirmed 2026-10-23T06:57Z) |
| `git diff --name-only` subset of `allowed_paths` | yes | Working tree is clean (all prior edits already committed at checkpoint `01dc09d`); the ticket's own code diff against `origin/main` remains exactly `src/lib/data/supabase.ts`, `src/routes/MonthView.tsx`, `supabase/db.sql` (deleted) — all three in `allowed_paths`. The wider `git diff origin/main --name-only` also lists `.ai/board/backlog.md`, `.ai/board/tickets/MIR-08/{01-plan.md,03-impl-log.md,99-questions.md,ticket.yaml}` and the two ADR paths — all either ship-owned, the ticket's own artifacts, or already-complete `allowed_paths` entries untouched by me (confirmed in Files touched above). `node scripts/check-allowed-paths.mjs` could not be run directly in this sandboxed session (tool denied the subprocess) and was verified manually instead. |

AC-5 (the CI `database` job / `pnpm db:test`) is a CI-only check per the AC's own text ("Given CI on
the pull request") and was not run locally; nothing in this change touches `supabase/migrations/`,
so there is nothing new for it to exercise. AC-6 (ADR status lines) was verified by reading both
ADR files, not by editing them — both already read as the AC requires.

## Testability contract

Not applicable — this ticket has no user interface and plan §2b records no layout. No selector is
added, renamed or removed.

## Open questions

None left open. `99-questions.md` recorded a question to `tech-lead-design` (never answered by a
live session) about whether this ticket's gate could pass with `pnpm exec eslint .` red on a
pre-existing, unrelated, out-of-`allowed_paths` failure in `scripts/run-loop.mjs`. Rather than
self-resolve it, I reported the first run `gate: BLOCKED` and stopped (checkpoint `01dc09d`, Fri Oct
23 2026 11:25:55 +0700). The underlying file was fixed independently, outside this ticket, in `4f9197e` —
which confirms the stop was the correct call, not an overcautious one. On this re-run `pnpm exec
eslint .` is clean, so the question is moot and nothing in `01-plan.md` needed amending.

## Delegated decisions

None. No decision was self-resolved by the Developer. The one blocking question raised in
`99-questions.md` was reported and left for someone with authority over `allowed_paths` (plan §7) to
act on; it was resolved by a fix to the out-of-scope file itself, not by a scope reinterpretation on
my part.
