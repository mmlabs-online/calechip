---
ticket: MIR-17-e
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-09T22:50:54+07:00   # re-review after the re-plan; first review FAILed R5 at 2026-11-09T22:17:39+07:00
inputs_read:
  - .ai/board/tickets/MIR-17-e/01-plan.md
  - .ai/board/tickets/MIR-17-e/03-impl-log.md
  - .ai/board/tickets/MIR-17-e/ticket.yaml
  - .ai/registry/decisions/ADR-092-the-entry-and-event-affordances-ask-the-role-helpers-and-the-rest-of-p4-2-is-mir-17-f.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `ticket MIR-17-e, 14 changed file(s) … allowed-paths: PASS`; `node scripts/check-carry.mjs MIR-17-e` → `0 uncommitted path(s) … PASS — nothing stray`. Every non-ticket, non-ship-owned path in `git diff --name-only origin/main...HEAD` is listed at `ticket.yaml:20-28`; `src/components/Sidebar.tsx` is absent from both the diff and `allowed_paths` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no diagnostics |
| R3 | lint exit 0 on changed files | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, no output |
| R4 | No datastore access outside the seam | PASS | The only new imports are `import { mayAdminister } from "@/lib/roles"` (`src/routes/EditEntry.tsx:47`, `src/routes/EventEditor.tsx:37`, `src/routes/EventDetail.tsx:40`, `src/components/EventAttendancePanel.tsx:31`); `roles.ts` imports domain types only (`src/lib/roles.ts:14`); no file under `supabase/` or `src/lib/data/` is in the diff |
| R5 | Every § 4 contract item implemented | PASS | Per-row below. The re-planned § 4 (`01-plan.md:116-137`) drops the `Sidebar.tsx` row, and `Sidebar.tsx` is unchanged |
| R6 | Permission gating matches § 3 | PASS | § 3 (`01-plan.md:103-110`) changes nothing. `mayAdminister` is `role === "admin"` (`src/lib/roles.ts:24`), and `me` is `Member \| null` (`src/lib/data/index.ts:329`, `src/routes/EventEditor.tsx:247`), so each replacement has the literal's truth table: `src/routes/EditEntry.tsx:89`, `src/routes/EventEditor.tsx:283`, `src/routes/EventDetail.tsx:89`, `src/components/EventAttendancePanel.tsx:139`. No policy or migration is in the diff |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:18`); reasoning below |
| R8 | No dependency added without an ADR | PASS | Neither `package.json` nor `pnpm-lock.yaml` is in `git diff --name-only origin/main...HEAD`; the new import is the in-repo `@/lib/roles` (`src/routes/EditEntry.tsx:47`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| `EditEntry.tsx:88` → `me !== null && mayAdminister(me.role)`, plus import | `src/routes/EditEntry.tsx:89`, import `:47` | Yes |
| `EventEditor.tsx:282` → `!(me !== null && mayAdminister(me.role))`, plus import | `src/routes/EventEditor.tsx:283`, import `:37` | Yes |
| `EventDetail.tsx:87` → `mayAdminister(me.role)`, plus import | `src/routes/EventDetail.tsx:89`, import `:40` | Yes |
| `EventDetail.tsx:85` comment cites ADR-092 decision 2 and names the helper | `src/routes/EventDetail.tsx:85-87` | Yes |
| `EventAttendancePanel.tsx:138` → `mayAdminister(me.role)`, plus import | `src/components/EventAttendancePanel.tsx:139`, import `:31` | Yes |
| `Sidebar.tsx` is not edited | Not in the diff; `src/components/Sidebar.tsx:540` remains inside the JSX comment `:533-545`; AC-4's code-level clause is pinned by `tests/role-guards.test.ts:33`, `:44-46` | Yes |
| `roles.ts:44-57` comment: the mock's decider, `listEntryOwners` (ADR-090), `ownerId` unused; eslint reason reworded; code unchanged | `src/lib/roles.ts:55-58`, `:60`; body `:61-62` is not in the diff hunk | Yes |
| `tests/role-guards.test.ts`: `FILES` gains the four paths and `Sidebar.tsx` | `tests/role-guards.test.ts:28-33` | Yes |
| describe titled "the twelve files" | `tests/role-guards.test.ts:39` (12 entries at `:21-33`) | Yes |
| new `it`: `roles.ts` lacks "kept for MIR-17" | `tests/role-guards.test.ts:62-68`; `pnpm exec vitest run tests/role-guards.test.ts` → 26 passed | Yes |
| AC-4: the four files have no literal role comparison in code and import `mayAdminister` | `tests/role-guards.test.ts:44-50` across `:29-32`, passing; grep finds no `role ===/!== "admin"\|"manager"` in those four files | Yes |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:18`), so there is no ID to work through. Each registry
invariant the diff could plausibly reach was checked against what the diff actually changes:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01, INV-02, INV-03, INV-06 (entry shape and transitions) | The database. The diff has no migration, no seam code and no entry write. `EditEntry` changes only the expression that chooses its read path, and that expression has the same truth table | `src/routes/EditEntry.tsx:89-92`; no `supabase/` or `src/lib/data/` path in the diff |
| INV-04, INV-05 (absence count) | Untouched. No count or threshold code is in the diff | diff file list: five `src/` files and one test, none of them count code |
| INV-07 (one owner per entry) | Unchanged. A `null` member still yields `isAdmin = false`, which takes `listOwnEntries` | `src/routes/EditEntry.tsx:89`, `:92` |

## Findings

None.

## Verdict

`PASS`. All four live sites ask `mayAdminister`, `roles.ts`'s comment is updated as § 4 specifies,
and the test pins AC-4. The re-planned § 4 removed the `Sidebar.tsx` row, and Sidebar is untouched. R1 to R8 pass, each against its own run
or line.
