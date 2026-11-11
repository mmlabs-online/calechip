---
ticket: BUG-004
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T04:08:29+00:00
inputs_read: [ .ai/board/tickets/BUG-004/01-plan.md, .ai/board/tickets/BUG-004/03-impl-log.md, .ai/board/tickets/BUG-004/ticket.yaml, .ai/registry/invariants.md, .ai/standards/architecture.md, "git diff origin/main...HEAD (b2bc2e2..a49c7ae)" ]
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
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket BUG-004, 6 changed file(s)` / `allowed-paths: PASS`. Non-board paths in `git diff --stat origin/main...HEAD`: `tests/e2e/evt-09-create-invitation.spec.ts`, `docs/ops/e2e-quarantine.md` — both in `ticket.yaml` `allowed_paths`; the rest is the ticket folder and `.ai/board/backlog.md` (ship-owned). `node scripts/check-carry.mjs BUG-004` → `0 uncommitted path(s)` / `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, run by this reviewer |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, run by this reviewer |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The only code change is a test whose sole import is `@playwright/test` (`tests/e2e/evt-09-create-invitation.spec.ts:1`); 0 occurrences of `supabase` in the file. Seam defined at `.ai/standards/architecture.md:17`. No `src/` file in the diff |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | Plan § 3: none changes. No `src/` file in the diff; the test still signs in as the member creator (`tests/e2e/evt-09-create-invitation.spec.ts:192`) |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml`); per-ID reasoning in R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; `package.json:19` and `:35` unchanged |

Also run, not gate items: `pnpm test` exit 0 (54 files, 1062 tests). Plan AC-4:
`pnpm exec playwright test tests/e2e/evt-09-create-invitation.spec.ts --repeat-each=10 --retries=0`
→ `71 passed`, the AC-6 test (`:191`) 10 of 10. Plan AC-5: `node scripts/check-docs.mjs` reports no
D15 finding; it exits 1 on three D9 errors in
`.ai/registry/decisions/ADR-068-…md` and `ADR-073-…md`, which this diff does not touch — pre-existing,
registry-owned, outside `allowed_paths`.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 delete the `// QUARANTINED BUG-004 …` comment | removed above `tests/e2e/evt-09-create-invitation.spec.ts:191`; `grep fixme\|test.skip` on the file returns nothing | yes |
| § 4.1 `test.fixme(` → `test(`, title unchanged | `tests/e2e/evt-09-create-invitation.spec.ts:191` | yes — title byte-identical in the diff |
| § 4.1 the four-line comment, `openEvents`, and the two waits | `tests/e2e/evt-09-create-invitation.spec.ts:201-207` | yes — text identical to the plan block; placed after the pre-existing two-line comment at `:199-200`, which the plan did not ask to remove |
| § 4.1 every other line unchanged (plan AC-2 pushState/popstate, AC-3 assertions) | `tests/e2e/evt-09-create-invitation.spec.ts:208-233` | yes — diff touches no line there; no timeout raised, no `waitForTimeout` |
| § 4.1 test IDs exist | `event-detail` at `src/routes/EventDetail.tsx:302`; `event-row` at `src/routes/Events.tsx:97` | yes |
| § 4.2 delete the AC-6 register row only | `docs/ops/e2e-quarantine.md:26` (former) — diff is `1 -`; the two `flaky` rows remain at `:26-27`; `grep evt-09` on the file returns nothing | yes |
| § 4.3 throttle never committed | `grep CPUThrottling tests/e2e/evt-09-create-invitation.spec.ts` returns nothing; measurement recorded in `03-impl-log.md` § *AC-6 measurement*, cause stated as unconfirmed as plan AC-6 requires | yes |

## R7 detail

`invariants_touched` is `[]`. Each registered invariant is checked against the diff individually;
the diff changes one e2e test and one doc row, and no file under `src/` or `supabase/`.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Unchanged entry write path; the diff writes no entry | `.ai/registry/invariants.md:33`; diff limited to `tests/e2e/evt-09-create-invitation.spec.ts:191-207`, `docs/ops/e2e-quarantine.md` |
| INV-02 approval does not survive an edit | No entry edit path touched | `.ai/registry/invariants.md:34`; same diff scope |
| INV-03 rejection reason | No rejection path touched | `.ai/registry/invariants.md:35`; same diff scope |
| INV-04 absence count | No count computation touched; the test creates a public event, not an entry | `.ai/registry/invariants.md:36`; `tests/e2e/evt-09-create-invitation.spec.ts:193-195` |
| INV-05 tentative counts | No count or tentative logic touched | `.ai/registry/invariants.md:37`; same diff scope |
| INV-06 one portion per entry | No entry shape touched | `.ai/registry/invariants.md:38`; same diff scope |
| INV-07 one member, every team | No membership or entry ownership touched | `.ai/registry/invariants.md:39`; same diff scope |

## Findings

None.

## Verdict

PASS. Ticket advances to DONE.
