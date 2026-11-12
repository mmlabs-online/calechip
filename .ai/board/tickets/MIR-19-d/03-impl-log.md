---
ticket: MIR-19-d
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-12T01:52:00Z
inputs_read: [ .ai/board/tickets/MIR-19-d/01-plan.md, .ai/board/tickets/MIR-19-d/ticket.yaml, .ai/board/tickets/MIR-19-d/99-questions.md, src/App.tsx, src/lib/org-path.ts, tests/e2e/cal-08-holiday-shading.spec.ts, tests/e2e/support/org-prefix.ts ]
consulted:
  - with: tech-lead-design
    asked: "01-plan § 4.1 / AC-7 examples /no/such/page and /signins have org-shaped first segments; which is wrong, the rule or the examples?"
    answer: "The examples. Amended to /x/such/page and /signin.html, with /no/such/page -> null as counter-example."
    resulted_in_amendment: true
  - with: tech-lead-design
    asked: "cal-08 AC-9/AC-10 and AC-14 fail because a dedicated-org (acme) admin is flipped to /acme/... and appPathname strips only /shared; cal-08 is outside allowed_paths. How to fix?"
    answer: "pending — see 99-questions.md (second question)"
    resulted_in_amendment: false
chat_before_verdict: none
gate: BLOCKED
blocking_reason: "Plan defect: § 1 and AC-12 say no existing spec needs an edit, but tests/e2e/cal-08-holiday-shading.spec.ts AC-9/AC-10 (:375) and AC-14 (:537) fail with the flip, because they place the admin in the dedicated org `acme` and appPathname strips only `shared`. cal-08 is outside allowed_paths (RULE-03). Question in 99-questions.md. Code is otherwise complete."
next_state: IN_PROGRESS
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/org-path.ts` | modified | adds `ROOT_ONLY_SEGMENTS` and `ownOrgAddress` | § 4.1 |
| `src/App.tsx` | modified | `ownOrg`, capture-phase popstate rewrite, `EnterOwnOrg`, flip arm of the root route table | § 4.2, § 4.3 |
| `tests/org-path.test.ts` | modified | `describe("MIR-19-d ownOrgAddress")` | § 4.4 |
| `tests/e2e/mir-19-d-flip.spec.ts` | created | AC-1 to AC-9 (AC-7 uses `/x/such/page` after the amendment) | § 4.5 |
| `tests/e2e/mir-19-org-routing.spec.ts` | modified | AC-11 amended to the flip | § 4.5 |
| `tests/e2e/evt-14-guest-sign-in.spec.ts` | modified | one import and four member landings | § 4.5 |
| `.ai/board/tickets/MIR-19-d/99-questions.md` | created | the question to tech-lead-design | — |

`.ai/board/tickets/MIR-19-e/ticket.yaml` and `MIR-19-f/ticket.yaml` already exist from PLAN; not touched.

## Contract items

All of § 4.1 to § 4.5 are implemented as written, including the two examples that contradict the rule
(the code follows the rule).

## Deviations from the design

None. The AC-7 and docblock strings follow the 2026-11-12T01:27:00Z amendment.

## Invariants

`invariants_touched` is `[]`: routing only.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 1188 passed |
| `pnpm exec playwright test` | 1 | 529 passed, 3 failed. `tsk-02` AC-2 is a timing flake (passes on rerun). `cal-08` AC-9/AC-10 and AC-14 fail because of the flip and pass at ad49668 (checked by restoring that `src/App.tsx` and `src/lib/org-path.ts`). tsk-02 AC-10 and mir-19-d AC-6 pass, so the capture-phase ordering is confirmed |
| `git diff --name-only` subset of `allowed_paths` | yes | |

## Open questions

The second question in `99-questions.md`: how cal-08 is to be fixed, since it is outside `allowed_paths`.
