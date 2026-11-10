---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-01, RULE-09]
---

# ADR-021 — The QA waiver is reverted

## Status

`ACCEPTED by steward` — 2026-09-01.

**This is not a new decision and it is not a reversal of one.** ADR-017 named three revert
conditions and the operator accepted them with the waiver. Three of the three have fired. Executing
a revert condition an ADR wrote for itself is honouring that ADR, not superseding it — which is why
this is `ACCEPTED by steward` and did not go back to the operator as a question. ADR-017's `Status`
becomes `SUPERSEDED by ADR-021`.

## Context — what fired, with the evidence

**Condition 2 — three tickets reach DONE under the waiver.** Fired. `.ai/board/metrics.md` carries
TEA-02 at `2026-09-01T00:38:00Z`, TEA-03 at `01:27:10Z` and TEA-04 at `04:48:46Z`, each recording the
QA gate waived per ADR-017. The orchestrator recorded the third as firing this condition and left the
revert, correctly, as registry work.

**Condition 3 — a database is provisioned and the four commands run.** Fired, and this is the one
that matters, because it removes the *reason* rather than the budget. Run in this repository today:

| Role | Command | Result |
|---|---|---|
| typecheck | `pnpm exec tsc --noEmit` | exit 0 |
| lint | `pnpm exec eslint .` | exit 0 |
| unit | `pnpm exec vitest run` | 1 file, 2 tests, all pass |
| end-to-end | `pnpm exec playwright test` | 10 tests in 2 files — **4 pass, 6 fail** |

A Supabase project is provisioned and reachable. The stated cause of TEA-01's original waiver was
that none of this existed.

**Condition 1 — a defect a QA test would have caught.** Fired, in the strongest available form: the
tests exist, they are TEA-01's own acceptance tests, and **six of them fail on `main` right now**.
They were not run between TEA-01 and TEA-04 because no gate required it.

## The six failures, and what they actually mean

They are one defect, not six, and it is not a regression in shipped behaviour.

`src/lib/data/index.ts` resolves the seam with
`import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL`. TEA-01's
end-to-end suite was written when neither variable was set, so the build resolved to the in-memory
seam and `App.tsx` rendered the `seam-banner` those tests assert on. A `.env` carrying
`VITE_SUPABASE_URL` now exists, so the same suite resolves to the Supabase seam, the banner is
correctly absent, and six assertions fail.

**The suite has no pinned seam, so its result depends on an untracked local file** — and when it
resolves the way it does today it drives the live project. That is worse than a plain regression: the
acceptance suite passes or fails on machine configuration, and the QA gate this ADR re-arms reads that
suite. Recorded as MD-021.

**It is not fixed here.** Repairing a test harness is ticket work; the steward writing it would put an
artifact in the loop with a provenance nobody can audit. The ticket that does it goes ahead of CAL-01.

## Decision

**The QA stage is entered again. The loop runs `REVIEW -> QA -> DONE`.**

1. *The QA stage is waived* is **deleted** from `.ai/01-operating-model.md`, which is the reversal
   ADR-017 designed — one section out, nothing else in that document changed.
2. `/ship` requires **all three gates `passed: true`** — `plan`, `review`, `qa`. It no longer writes
   a waiver, ever.
3. Definition of Done items 3 and 4 are **restored**: the four commands exit 0, and every AC maps to
   a named test.
4. `/review` writes `next_state: QA` on PASS again. `/qa`'s retirement banner is removed.
5. RULE-05, RULE-13 and the `qa` chat budgets govern again. They were dormant, never repealed.

**Every ticket shipped under the waiver — TEA-02, TEA-03, TEA-04 — stays DONE and stays untested.**
ADR-017 owes a ticket to retire that surface and this ADR does not discharge it; see *What is owed*.

## Rationale

**Rejected: fix the end-to-end harness first, then re-arm the gate.** It is the more comfortable
order and it is the wrong one. The failing suite is exactly what the gate exists to surface, and a
gate held back until nothing it guards is broken is a gate that never arms. Arming it now means
CAL-01 stops at QA until the harness ticket lands, which is the loop working.

**Rejected: extend the waiver until the harness is fixed.** That is the shape MD-016 warned about — a
temporary switch whose expiry is negotiated each time it is reached. The conditions were written
precisely so this would not be a judgement call at the moment it became inconvenient.

**Rejected: taking this back to the operator as a question.** They accepted ADR-017 with its revert
conditions attached. Asking again at the moment the conditions fire would make every revert condition
in this repository advisory, and the operator's instruction is to decide and report.

## Consequences

- **CAL-01 will stop at QA**, and it is the right ticket for that to happen on: it creates `entry`,
  INV-01's exclusion constraint, INV-02's trigger and INV-03's check — a larger untested surface than
  the three waived tickets combined.
- **A ticket to fix the seam pinning in the end-to-end suite goes ahead of CAL-01.** Until it lands,
  no ticket can pass the QA gate, because Definition of Done item 3 requires the suites to exit 0.
- **Three shipped tickets remain untested and now sit behind an armed gate**, which is the awkward
  state ADR-017 predicted. Nothing retroactively tests them; the retirement ticket does.
- **`.ai/standards/testing-standards.md` said none of the four commands runs.** That was true when
  written and is now false. Corrected in the same change, with the real result of each.
- The loop is slower from today. That is the cost the waiver bought against, and the bill for the
  three tickets it bought is still unpaid.

## What is owed, and by whom

ADR-017's revert clause requires a ticket to retire the untested surface. **Two are owed, and neither
is the steward's to create** — `/triage` creates tickets (ADR-010):

1. **A bug ticket for the seam pinning**, ahead of CAL-01. The end-to-end suite must pin its seam
   explicitly rather than inheriting whatever `.env` the machine has, and it must never drive the
   live project.
2. **A ticket to retire the untested surface of TEA-02, TEA-03 and TEA-04** — the allow-list writes,
   the team-scoped read policy, and the admin write path with its trigger. Under ADR-005 all three are
   row-level policy work, which is the whole authorization model.

## Revert condition

**This ADR is reverted only by the QA gate proving unrunnable in practice** — specifically, three
consecutive tickets reaching QA and stopping there on tooling rather than on a real test failure. That
would mean the four commands run for the steward and not for the loop, and the honest answer would be
a fresh waiver with its own conditions rather than a quiet reversion to this one.

**It is not reverted because QA is slow.** That is the cost, it was known, and it was accepted twice.

## Affected documents

| File | Change |
|---|---|
| `.ai/registry/decisions/ADR-017-the-qa-gate-is-temporarily-waived.md` | `Status` → `SUPERSEDED by ADR-021` |
| `.ai/01-operating-model.md` | `doc_version` 5; *The QA stage is waived* deleted; DoD items 3 and 4 restored |
| `.claude/commands/ship.md` | three gates; no waiver written; full DoD |
| `.claude/commands/review.md` | `next_state: QA` on PASS |
| `.claude/commands/qa.md` | retirement banner removed |
| `.ai/templates/ticket.yaml`, `.ai/templates/plan.md` | waiver notes replaced with the record |
| `.ai/standards/testing-standards.md` | the four commands now run; results recorded |
| `.ai/board/model-debt.md` | MD-021, the unpinned seam in the end-to-end suite |
