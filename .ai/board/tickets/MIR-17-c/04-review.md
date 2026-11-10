---
ticket: MIR-17-c
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-09T13:44:16Z
inputs_read:
  - .ai/board/tickets/MIR-17-c/01-plan.md
  - .ai/board/tickets/MIR-17-c/03-impl-log.md
  - .ai/board/tickets/MIR-17-c/ticket.yaml
  - git diff origin/main...HEAD
  - src/routes/PendingEntries.tsx
  - tests/pending-decide-affordance.test.ts
  - src/lib/roles.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - supabase/migrations/20261104090000_mir14b_entry_owners.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carry | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-17-c, 9 changed file(s)` … `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs MIR-17-c` → `0 uncommitted path(s)` … `PASS — nothing stray`, exit 0. Code paths changed: `src/routes/PendingEntries.tsx`, `tests/pending-decide-affordance.test.ts`, both at `.ai/board/tickets/MIR-17-c/ticket.yaml:23-24` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, no output, exit 0 (run by this reviewer) |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` → `eslint .`, no output, exit 0 repo-wide (run by this reviewer); the removed `mayDecideEntriesOf` import at `src/routes/PendingEntries.tsx:106` leaves no unused import |
| R4 | No datastore access outside the seam (RULE-02) | PASS | `src/routes/PendingEntries.tsx:103` imports only `seam` from `@/lib/data`; the new read path is `seam.listEntryOwners` at `:286` and `:351`; no `supabase` import in the file (only the comment at `:22`, `:100`) |
| R5 | Every §4 contract item implemented | PASS | see R5 detail; `pnpm exec vitest run tests/pending-decide-affordance.test.ts` → 3 passed, exit 0 |
| R6 | Permission gating matches plan §3 | PASS | screen admission `src/routes/PendingEntries.tsx:262-265` (no member row → refused) and `:293-296` (no deciding rank and no decidable owner → refused); row controls `:698` read the set `list_entry_owners` returns, which is filtered by `may_decide_entry` at `supabase/migrations/20261104090000_mir14b_entry_owners.sql:35`, whose admin half (shares an active team) and manager-of-owner's-team half are `supabase/migrations/20261107230000_mir16b_is_org_admin.sql:419` and `:420-430` — the two ✅ rows of §3. Enforcement remains the database's; no write path changed |
| R7 | No invariant violated | PASS | `invariants_touched: []` at `.ai/board/tickets/MIR-17-c/ticket.yaml:18`; see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` → empty; the new test imports only `node:fs`, `node:url`, `vitest` (`tests/pending-decide-affordance.test.ts:8-10`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| `:106` import becomes `import { mayDecide } from "@/lib/roles";` | `src/routes/PendingEntries.tsx:106` | yes |
| Load: keep `if (!me)` refusal first; move `!mayDecide(me.role)` after `owners`, as `if (!mayDecide(me.role) && owners.size === 0) { setView({ phase: "refused" }); return; }` | `src/routes/PendingEntries.tsx:262-265` (`if (!me)` first), `:284-287` (`owners` computed), `:293-296` (the refusal, verbatim) | yes |
| `:688` controls read `view.owners.has(entry.memberId)` | `src/routes/PendingEntries.tsx:698` | yes |
| Comment cites ADR-073 decision 3 and ADR-090; sentence becomes `You cannot decide this entry.` | `src/routes/PendingEntries.tsx:693-696` (comment), `:702` (sentence), test id unchanged at `:701` | yes |
| `owners` field comment states it is also the decidable set (ADR-090 decision 1) | `src/routes/PendingEntries.tsx:196-198` | yes |
| `unresolvedOwners` / `withOwners` unchanged | `src/routes/PendingEntries.tsx:203-214`; `loadMore` still merges per page at `:350-351` | yes |
| §4.1 AC-3 test: contains `view.owners.has(entry.memberId)`, not `mayDecideEntriesOf(` | `tests/pending-decide-affordance.test.ts:16-19` | yes |
| §4.1 AC-4 test: contains new sentence, not the old | `tests/pending-decide-affordance.test.ts:21-24` | yes |
| §4.1 AC-5 test: `mayDecide(me.role)` appears after `listEntryOwners(` | `tests/pending-decide-affordance.test.ts:26-33` | yes |

Mock consistency for AC-1/AC-2 (observed against the mock): the mock's `listEntryOwners` returns `[]` for a caller without a deciding rank (`src/lib/data/mock.ts:3221`), so Thanh still lands on `refused` via `src/routes/PendingEntries.tsx:293`; for a decider it returns every approved, unremoved owner on the caller's team (`src/lib/data/mock.ts:3223-3231`), which is the same team filter `listPendingEntries` applies to rows (`src/lib/data/mock.ts:3154`), so Quan and Mona keep controls on every row as before. The own-entry exclusion the replaced sentence described was already gone from `mayDecideEntriesOf` (`src/lib/roles.ts:44-57`), so no row loses controls it had today on that ground.

## R7 detail

`invariants_touched` is `[]` (`.ai/board/tickets/MIR-17-c/ticket.yaml:18`). There is no ID to reason through individually. Checked that the empty list is honest:

| Invariant | Held by | Citation |
|---|---|---|
| *(none listed)* — does the diff touch any write or enforcement path? | No. The decision component and its callback are unchanged (`src/routes/PendingEntries.tsx:699`); the only seam call added to the flow is a read already made before this ticket (`:286`); `src/lib/roles.ts` and every migration are absent from `git diff origin/main...HEAD`. The decide rule stays in the database (`supabase/migrations/20261107230000_mir16b_is_org_admin.sql:412-431`, used by the policies at `:697-698` and the trigger at `:170`, `:208`) | `src/routes/PendingEntries.tsx:293-298`, `:698` |

## Findings

None.

## Verdict

PASS.
