---
ticket: MIR-19-d
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-12T01:41:00Z
inputs_read: [ .ai/board/tickets/MIR-19-d/01-plan.md, .ai/board/tickets/MIR-19-d/ticket.yaml, src/App.tsx, src/lib/org-path.ts ]
consulted:
  - with: tech-lead-design
    asked: "01-plan § 4.1 / AC-7 examples `/no/such/page` and `/signins` have org-shaped first segments, so § 4.1's own rule returns null for them; which is wrong, the rule or the examples?"
    answer: "pending — see 99-questions.md"
    resulted_in_amendment: false
chat_before_verdict: none
gate: BLOCKED
blocking_reason: "Plan defect: § 4.1 docblock examples `/no/such/page` and `/signins` and AC-7 contradict § 4.1's rule (first segment an org code gives null) and MIR-19 AC-4. Question in 99-questions.md. Implementation is otherwise complete."
next_state: IN_PROGRESS
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/org-path.ts` | modified | adds `ROOT_ONLY_SEGMENTS` and `ownOrgAddress` | § 4.1 |
| `src/App.tsx` | modified | `ownOrg`, capture-phase popstate rewrite, `EnterOwnOrg`, flip arm of the root route table | § 4.2, § 4.3 |
| `tests/org-path.test.ts` | modified | `describe("MIR-19-d ownOrgAddress")` | § 4.4 |
| `tests/e2e/mir-19-d-flip.spec.ts` | created | AC-1 to AC-9 | § 4.5 |
| `tests/e2e/mir-19-org-routing.spec.ts` | modified | AC-11 amended to the flip | § 4.5 |
| `tests/e2e/evt-14-guest-sign-in.spec.ts` | modified | one import and four member landings | § 4.5 |
| `.ai/board/tickets/MIR-19-d/99-questions.md` | created | the question to tech-lead-design | — |

`.ai/board/tickets/MIR-19-e/ticket.yaml` and `MIR-19-f/ticket.yaml` already exist from PLAN; not touched.

## Contract items

All of § 4.1 to § 4.5 are implemented as written, including the two examples that contradict the rule
(the code follows the rule).

## Deviations from the design

None in code. The rule in § 4.1 is implemented; two docblock examples fail against it (see blocking_reason).

## Invariants

`invariants_touched` is `[]`: routing only.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 1 | 2 failures: `/no/such/page` and `/signins` examples in the new describe |
| playwright (mir-19-d-flip, mir-19-org-routing, evt-14, tsk-02) | 1 | 47 passed; AC-7 fails on `/no/such/page`; tsk-02 AC-10 and AC-6 pass, so the capture-phase ordering is confirmed |

The full playwright suite was not run: the gate is blocked first.

## Open questions

The one in `99-questions.md`.
