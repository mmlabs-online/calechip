---
ticket: MIR-17-c
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-09T13:41:00Z
inputs_read:
  - .ai/board/tickets/MIR-17-c/01-plan.md
  - .ai/board/tickets/MIR-17-c/ticket.yaml
  - .ai/registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md
  - src/lib/roles.ts
  - src/lib/domain/types.ts
  - src/routes/PendingEntries.tsx
  - tests/member-rpc-roster-team.test.ts
  - .ai/standards/testing-standards.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/PendingEntries.tsx` | modified | import drops `mayDecideEntriesOf`; the global-rank refusal moves to after `owners` is read and is now gated on `owners.size === 0`; a row's controls read `view.owners.has(entry.memberId)`; the not-decidable sentence and its comment are corrected; the `owners` field comment records that it is also the decidable set | §4 items `:106`, `:252-265`, `:688`, `:684-686`/`:692`, `:194-196` |
| `tests/pending-decide-affordance.test.ts` | created | source-text test pinning AC-3, AC-4 and AC-5 against `PendingEntries.tsx`, in the shape `tests/member-rpc-roster-team.test.ts` uses, because the mock models one team per person and cannot exercise the second-team case | §4.1 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `:106` import | `src/routes/PendingEntries.tsx:106` | `import { mayDecide } from "@/lib/roles";` — `mayDecideEntriesOf` no longer imported |
| `:252-265` (load) | `src/routes/PendingEntries.tsx:256-296` | `if (!me)` refusal kept first; `if (!mayDecide(me.role) && owners.size === 0)` added immediately after `owners` is computed, before `setView({ phase: "ready", ... })` |
| `:688` row controls | `src/routes/PendingEntries.tsx:697` | `mayDecideEntriesOf(view.me, entry.memberId)` → `view.owners.has(entry.memberId)` |
| `:684-686`/`:692` sentence and comment | `src/routes/PendingEntries.tsx:690-701` | comment now cites MIR-17-c, ADR-073 decision 3 and ADR-090; sentence is `You cannot decide this entry.` |
| `:194-196` owners comment | `src/routes/PendingEntries.tsx:194-198` | comment extended to say `owners` is also the decidable set per ADR-090 decision 1 |
| 4.1 vitest | `tests/pending-decide-affordance.test.ts` | three tests, named `AC-3`, `AC-4`, `AC-5`, asserting the source text per the plan's exact wording |

AC-1 and AC-2 are covered unchanged by the existing worklist specs (`adm-04`, `adm-05`, `mir-14-b`);
confirmed by running the full unit suite (see Verification run) rather than re-reading each spec,
since none of their assertions depend on the lines this ticket touched.

## Deviations from the design

`none`. The `me` field on the `ready` branch of `View` is now written but no longer read inside this
file — the plan's contract (§4) did not list its removal, and removing a field not named in the
contract would be scope growth beyond what was specified, so it is left in place.

## Invariants

`invariants_touched: []` (`ticket.yaml`). No entry is written by this change and no new write path is
added; `EntryDecision`, `approveEntry` and `rejectEntry` are untouched, and the database's own rule
(`may_decide_entry`) is still the sole enforcement — the screen only reads its result through
`listEntryOwners`, which was already called for every page owner before this ticket.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | PASS — all 6 changed files (5 committed at the PLAN checkpoint, plus this stage's 2) are within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-17-c` | 0 | PASS — nothing stray; both uncommitted paths carried from `allowed_paths` |
| `pnpm exec tsc --noEmit` | 0 | typecheck |
| `pnpm exec eslint .` | 0 | lint |
| `pnpm exec vitest run` | 0 | 54 files, 1050 tests, all pass — includes the new `pending-decide-affordance.test.ts` and the unchanged `adm-04`/`adm-05`/`mir-14-b` worklist specs |
| `git diff --name-only` subset of `allowed_paths` | yes | only `src/routes/PendingEntries.tsx` (tracked, modified) and `tests/pending-decide-affordance.test.ts` (untracked, new) — both listed in `allowed_paths` |

`pnpm exec playwright test` was not run: the gate for this stage names only typecheck and lint, the
plan's own AC-1/AC-2/AC-4 observations are against the mock build and the source text respectively
(01-plan.md § 2), and no e2e spec in the repository exercises these lines (confirmed by grep — see
Open questions).

## Testability contract

Plan section 4.1 is the testability contract for this ticket (no plan section 6 — this plan predates
the QA stage's removal of that numbering and names its tests directly in §4.1).

| selector | Exists at |
|----------|-----------|
| `pending-entries-refused` | `src/routes/PendingEntries.tsx:401` (unchanged) |
| `pending-entries-own-entry` | `src/routes/PendingEntries.tsx:701` (sentence changed, id unchanged) |

## Open questions

None that block. Grepped the repository for `pending-entries-own-entry` and `Your own entry` outside
this ticket's two files — no e2e or component test references either, confirming the plan's note
(01-plan.md § 2, AC-4) that AC-1/AC-2/AC-4 run against the mock and AC-3/AC-5 against source text
only, with no existing test asserting the sentence this ticket changed.
