---
ticket: MIR-17-e
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-09T15:48:10Z
inputs_read:
  - .ai/board/tickets/MIR-17-e/01-plan.md
  - .ai/board/tickets/MIR-17-e/ticket.yaml
  - .ai/board/tickets/MIR-17-e/04-review.md
  - .ai/registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md
  - .ai/registry/decisions/ADR-091-the-applications-manager-is-whoever-manages-a-team-and-the-rest-of-p4-2-is-mir-17-e.md
  - .ai/registry/decisions/ADR-092-the-entry-and-event-affordances-ask-the-role-helpers-and-the-rest-of-p4-2-is-mir-17-f.md
  - .ai/standards/testing-standards.md
  - src/lib/roles.ts
  - src/routes/EditEntry.tsx
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/components/EventAttendancePanel.tsx
  - src/components/Sidebar.tsx
  - tests/role-guards.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

**Rework note.** This is the second `/implement` pass on this ticket. The first pass's code was
reviewed and FAILed on R5 for a defect in `01-plan.md` itself (`04-review.md` finding 1):
§4's `Sidebar.tsx` row and AC-4's import clause named `src/components/Sidebar.tsx:540`, a line
inside a JSX comment that has rendered nothing since UIE-10 — satisfying the row would have added
an unused import and failed lint (R3). The review routed that finding to `tech-lead-design`
(`route_to: tech-lead-design`, `increments_rework: false`), which re-planned `01-plan.md`: the
`Sidebar.tsx` row is dropped, AC-4 is reworded to require only the four live files' import and
`Sidebar.tsx`'s absence of a live literal, and `Sidebar.tsx` left `allowed_paths`. The code from the
first pass already matched this outcome — it never touched `Sidebar.tsx` — so no source file changes
in this pass. This log is rewritten against the corrected plan so it no longer frames the
`Sidebar.tsx` exclusion as a developer deviation; it is now what §4 specifies.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/EditEntry.tsx` | modified | import `mayAdminister` and replace the literal admin check at the old `:88` with it (§4 row 1) | §4 row 1 |
| `src/routes/EventEditor.tsx` | modified | import `mayAdminister` and replace the literal admin check at the old `:282` with its negated form (§4 row 2) | §4 row 2 |
| `src/routes/EventDetail.tsx` | modified | import `mayAdminister`, replace the literal admin check inside `mayEditEvent` at the old `:87`, and reword the doc comment above it to name the helper and cite ADR-092 decision 2 (§4 row 3, §4 "comment beside a replaced test") | §4 row 3 |
| `src/components/EventAttendancePanel.tsx` | modified | import `mayAdminister` and replace the literal admin check inside `inAudience`'s `named` branch at the old `:138` with it (§4 row 4) | §4 row 4 |
| `src/lib/roles.ts` | modified | reworded the `mayDecideEntriesOf` doc comment and the `eslint-disable-next-line` reason to say it is the mock's decider, that the worklist decides per owner through `listEntryOwners` (ADR-090), and that `ownerId` is unused — code unchanged (§4 "src/lib/roles.ts:44-57") | §4 roles.ts item |
| `tests/role-guards.test.ts` | modified | added the four live MIR-17-e paths plus `Sidebar.tsx` to `FILES`, retitled the describe to "the twelve files", and added an `it` asserting `roles.ts` no longer contains `"kept for MIR-17"` (§4 "tests/role-guards.test.ts") | §4 test item |

`src/components/Sidebar.tsx` is read (it is in `inputs_read` and in the test's `FILES` array) but not
written — §4 says explicitly *"`src/components/Sidebar.tsx` is not edited"*, and it is no longer in
`allowed_paths`. It appears in no row of this table because its diff against `HEAD` is empty.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `EditEntry.tsx` row | `src/routes/EditEntry.tsx:88-89` (import at `:47`) | `me !== null && mayAdminister(me.role)`, exactly the table's After text |
| `EventEditor.tsx` row | `src/routes/EventEditor.tsx:282-283` (import at `:37`) | `!(me !== null && mayAdminister(me.role))`, exactly the table's After text |
| `EventDetail.tsx` row | `src/routes/EventDetail.tsx:86-89` (import at `:40`) | comment reworded per §4's instruction for `:85`'s comment, citing ADR-092 decision 2 |
| `EventAttendancePanel.tsx` row | `src/components/EventAttendancePanel.tsx:138` (import at `:31`) | unchanged otherwise |
| `src/lib/roles.ts:44-57` | `src/lib/roles.ts:51-58` | comment and eslint-disable reason reworded; `mayDecideEntriesOf`'s body is byte-identical to before |
| `tests/role-guards.test.ts` | `tests/role-guards.test.ts:20-33`, `:57-63` | `FILES` gains the four live paths and `Sidebar.tsx` (five total), describe title says "the twelve files", new `it` block added |
| `src/components/Sidebar.tsx` is not edited | n/a | §4 states this explicitly; AC-4's `Sidebar.tsx` clause (no live literal outside comments) already held before this ticket and still holds — verified by `tests/role-guards.test.ts`'s `LITERAL_ROLE_TEST` check on the file, which passes |

## Deviations from the design

`none`. The first pass's exclusion of `Sidebar.tsx` was recorded as a delegated decision in the prior
version of this log; the review (R5 FAIL, routed to `tech-lead-design`) and the subsequent re-plan
confirmed that decision was correct and folded it into §2 AC-4 and §4 directly, so it is no longer a
deviation — it is what the current plan specifies. No other change was made in this pass.

## Invariants

`invariants_touched: []` (`ticket.yaml`). No data path changes — every edit replaces one client-side
boolean expression with an equivalent call to the same already-shipped helper (`mayAdminister`); no
control, policy or trigger is touched.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | 14 changed files total across history; all within the current `allowed_paths` (9 entries, `Sidebar.tsx` absent) |
| `node scripts/check-carry.mjs MIR-17-e` | 0 | 0 uncommitted paths — this pass's code was already committed at the prior `/advance`; nothing stray |
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run tests/role-guards.test.ts` | 0 | 26/26 passed, including the new `it` |
| `git diff --name-only origin/main...HEAD -- src tests` | — | `EventAttendancePanel.tsx`, `roles.ts`, `EditEntry.tsx`, `EventDetail.tsx`, `EventEditor.tsx`, `role-guards.test.ts` — `Sidebar.tsx` is not among them |
| `git diff --name-only` subset of `allowed_paths` | yes | working tree is clean (all committed); vacuously true, and the committed set above is a subset of `allowed_paths` |

## Testability contract

None — plan section 2b names no layout and section 6 is unused by this plan (no selectors listed;
this ticket changes no screen).

## Open questions

None that block.
