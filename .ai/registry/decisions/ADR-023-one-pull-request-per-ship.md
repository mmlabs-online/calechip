---
doc_version: 3
last_updated: 2026-09-03
governed_by: [RULE-01, RULE-03, RULE-09]
---

# ADR-023 — One pull request per ship

## Status

`ACCEPTED by the operator` — 2026-09-03.

Recorded, not authored. The operator's instruction, verbatim: *"đổi flow, khi call /ship chỉ mở duy
nhất 1 PR"* — change the flow so `/ship` opens exactly one pull request. The steward did not
disagree; the split this replaces was already carried as a `high` defect in
`.ai/board/model-debt.md` as MD-015, and had already failed once in practice.

## Context

`/ship` step 3 writes three files that sit outside every ticket's `allowed_paths`:

- `.ai/board/backlog.md` — the row moves to `## ARCHIVE`
- `.ai/board/metrics.md` — one appended row
- `.ai/registry/features.md` — the feature's `Status` becomes `DONE`

`scripts/check-allowed-paths.mjs` is RULE-03's live mechanism in CI — the hook has been unwired since
ADR-004 — and it exempted exactly one path prefix, the ticket's own folder. So a ticket branch
carrying any of those three failed the `allowed-paths` check, and branch protection then blocked the
merge a human was waiting to perform.

The old `/ship` resolved this by splitting: the ticket set on `feat/<ID>`, everything else on an
`ops/<slug>` branch cut from `main`, and **two pull requests**.

That resolution was internally contradictory before it was ever run. Step 4 placed `backlog.md` and
`metrics.md` in the *ticket* set — stating, correctly, that "a board that records a ship in a separate
pull request from the ship is a board that can be merged out of order" — and step 5 then committed
them on `feat/<ID>`, which CI must fail. MD-015 named this on 2026-08-31 and predicted where it would
break.

It broke exactly there on 2026-09-03, at BUG-001's `/ship`. `check-allowed-paths.mjs` returned FAIL
naming both board files, the commit was split, and the ship became PR #27 and PR #28 — two pull
requests that have to be merged together or the board asserts a ship that `main` does not carry. The
cost stopped being an argument and became an artifact.

**And then a second time, hours later, on the happy path.** CAL-01 shipped the same day as
[#32](https://github.com/didi-code0980/calechip/pull/32) with its board and registry edit trailing in
[#34](https://github.com/didi-code0980/calechip/pull/34) — recorded in that feature's own `Notes`
row. BUG-001 could be read as a bugfix-branch oddity; CAL-01 is an ordinary feature ship, so the
split is the rule and not the exception. Every ship splits, because step 3 always writes
`features.md`.

## Decision

**A ship is one branch and one pull request.**

1. **The ship-owned set.** `.ai/board/backlog.md`, `.ai/board/metrics.md` and
   `.ai/registry/features.md` are exempted **by name** in `scripts/check-allowed-paths.mjs`, beside
   the existing ticket-folder exemption, so they ride on `feat/<ID>` with the ticket.

2. **The set is three names, not a category.** `.ai/board/` is not exempt; `.ai/registry/` is not
   exempt. Adding a fourth path is an edit to the array plus an ADR, never a judgement made at ship
   time. The moment the exemption becomes a prefix, RULE-03 stops being enforceable in CI and the
   check stops being worth running.

3. **`/ship` step 8 is retired.** It no longer cuts an `ops/<slug>` branch and never opens a second
   pull request. The step number is kept, carrying a retirement note, so tickets shipped before
   2026-09-03 stay readable against the command that produced them.

4. **Anything else dirty in the tree is not committed.** `/ship` names every such path in its reply
   and leaves it in the working tree. Model, hook, standards and tooling work belongs to the session
   that wrote it — `/thuki` for the model — and lands on `ops/<slug>` from there.

5. **`features.md` is still a CODEOWNERS path.** `/ship` step 7 names it explicitly in the pull
   request body. RULE-01 is untouched: recording a `Status` transition is not authoring a registry
   decision, and a human still approves it at merge.

## Consequences

**What gets better.** The board and the ship merge atomically — there is no ordering in which `main`
carries one and not the other. `/ship` step 6 now passes on the branch `/ship` step 5 actually
produces, which it never did before. And the one-PR shape is what the operator reviews: one branch
name, one link, one merge.

**What gets worse, and it is real.** RULE-03's CI check is three paths weaker than it was. A developer
who writes `.ai/registry/features.md` at IN_PROGRESS now passes `allowed-paths`, where before CI
caught it. Two things stand behind that gap: review check R1, which reads the diff against
`allowed_paths` with no exemptions, and CODEOWNERS, which forces a human onto every `features.md`
change at merge. Neither is as cheap as a failing check, and this is the cost the decision accepts.

**A ship into a dirty tree now leaves it dirty.** Before, `/ship` swept unrelated work onto an `ops/`
branch; now it declines it. That work is more visible — it is named in the reply, and the next
command's step 0 stops on it — but it is also nobody's until a human routes it. This is the correct
shape of MD-013's finding: a tree holding several sessions' work is a two-writer problem, and making
`/ship` a better classifier was always treating the symptom.

**Revert condition.** If a ticket branch reaches `main` carrying a `features.md` edit that was not a
`Status` transition written by `/ship` step 3, the exemption is doing harm the review layer did not
catch. Narrow it to `backlog.md` and `metrics.md`, and send `features.md` back to a second pull
request — accepting the ordering hazard as the lesser cost.

## Alternatives rejected

**Exempt only `backlog.md` and `metrics.md`, keep `features.md` on an `ops/` branch.** This is what
MD-015 proposed, written before BUG-001 shipped. It leaves two pull requests whenever `/ship` runs —
which is every ship, since step 3 always writes `features.md` — so it does not answer the instruction
at all. It is kept above as the revert condition, where it belongs.

**Let `/ship` commit the whole dirty tree onto `feat/<ID>` and drop the check's teeth.** One PR, no
exemption list, no classification. Rejected: it launders any out-of-scope write from any earlier stage
through the one command that is allowed to commit, which is precisely the write RULE-03 exists to
catch.

**Widen the ticket's `allowed_paths` to include the three files at PLAN.** Rejected twice over. It
puts registry paths in every ticket's allowed list, so the write-time guard would permit a developer
to edit `features.md` mid-implementation; and it asks `tech-lead-design` to enumerate paths that have
nothing to do with the design, in every plan, forever.

## Changed by this ADR

- `scripts/check-allowed-paths.mjs` — `SHIP_OWNED`, and the exemption in the violation filter
- `scripts/tests/check-allowed-paths.test.mjs` — new; nine tests, both directions
- `.claude/hooks/guard-allowed-paths.mjs` — `SHIP_OWNED` and the exemption in the loop. Unwired
  since ADR-004, so this is the copy that has to agree rather than the one that enforces
- `.claude/hooks/tests/guard-allowed-paths.test.mjs` — five cases mirroring the CI tests
- `.claude/commands/ship.md` — steps 3, 4, 5, 6, 7, 10; step 8 retired
- `.claude/commands/triage.md`, `.claude/agents/orchestrator.md`
- `.ai/standards/git-conventions.md` — *What it does not decide*, *Pull requests*
- `.ai/registry/features.md` — the `Status` field description
- `.ai/registry/rules.md` — RULE-03's enforcement row
- `.ai/board/model-debt.md` — MD-015 resolved, MD-022 opened
