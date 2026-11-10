---
doc_version: 3
last_updated: 2026-09-29
governed_by: [RULE-01, RULE-09]
---

# ADR-047 — Owed glossary rows are named at TRIAGE and written at PLAN

## Status

`ACCEPTED by the operator` — 2026-09-29, **for the choice, not for this wording.**

The operator was offered three fixes for MD-041 by a steward run on 2026-09-29 and answered, verbatim:
*"đã merged chọn B"*. Option (b) was offered in these words:

> (b) Triage không ghi row nữa, chỉ ghi 'còn nợ' trong `ticket.yaml`; PLAN đưa `glossary.md` vào
> `allowed_paths`. Không thêm miễn trừ nào.

**The text below is the steward's and the operator has not read it.** The field name, the gate
wording and every consequence are the steward's rendering of that one sentence. Their acceptance of
the wording is the review of the pull request that carries this file, under CODEOWNERS; until that
merge, only the choice of (b) is theirs.

## Context

MD-041, `.ai/board/model-debt.md`. On the EVT PROMOTE of 2026-09-29 `/triage` wrote four rows to
`.ai/registry/glossary.md` (*Event*, *Attendee*, *Invitation*, *Capacity*). No stage could commit
them:

- `planCarry` (`scripts/lib/entry.mjs`) carries a dirty path only if it is the ticket's own, in
  `allowed_paths`, in `SHIP_OWNED`, the provenance idea, or a cited ADR. `glossary.md` was none, so
  `node scripts/check-carry.mjs EVT-01` returned exit 1 with it stray and on no ref, and `/plan`
  step 0 would have stopped.
- `/ship` commits `allowed_paths`, the ticket folder and three named files;
  `.ai/standards/git-conventions.md` put every other registry path in *Everything else*.
- `product`, which runs `/triage`, has no `Bash` tool and cannot land anything.

The rows were landed by hand on `ops/evt-glossary-rows` (PR #103).

**Nothing told triage to write the rows, and nothing told it not to.** `.claude/commands/triage.md`
had no glossary step. The write followed from RULE-01's exemption for glossary rows
(`.ai/registry/rules.md:31`), the steward's standing instruction *"Feature rows, glossary entries,
tracker fields — write them"*, and ADR-045's own *Affected documents* row
*"`.ai/registry/glossary.md` | `Event`, `Attendee`, `Invitation`, `Capacity` | glossary row write
(ADR-007)"*, which `product` wrote in the same run.

## Decision

1. **`/triage` writes no row to `.ai/registry/glossary.md`.** On PROMOTE, `product` records the terms
   the idea needs and the glossary lacks in a new `ticket.yaml` field, **`glossary_owed`** — a list of
   bare term names, `[]` meaning considered and none owed. No existing field carried this; the
   `OWED BY THIS TICKET` comment EVT-01 uses is prose no stage reads.
2. **`/plan` reads `glossary_owed`.** When it is non-empty, `tech-lead-design` adds
   `.ai/registry/glossary.md` to `allowed_paths` **first**, then writes one row per term, taking the
   meaning from the provenance idea file and the ADRs the ticket cites and citing its source in the
   row. A meaning those files do not settle becomes a placeholder and an *Open questions* entry.
3. **The PLAN gate gains one condition**: every term in `glossary_owed` has a row, and
   `glossary.md` is in `allowed_paths`.
4. **The rows ride the ticket branch as an `allowed_paths` file** — the carry rule already at
   `planCarry`'s `allowed_paths` branch — and `/ship` commits them in the ticket's one pull request
   (ADR-023's ship set, unchanged).

No rule text changes. `SHIP_OWNED` does not change. No new exemption is added to any check.

## Does this contradict an accepted decision?

Checked line by line; it does not, and the one that comes closest is named.

- **RULE-01** (`.ai/registry/rules.md:31`) exempts glossary rows from the ADR requirement and puts
  approval at CODEOWNERS on the pull request. Rows
  still need no ADR and still reach a human at merge — now on the ticket's own pull request instead
  of an `ops/` one. Consistent. This ADR exists because it changes **who** writes the rows and
  **when**, which is a process decision, not because RULE-01 asks for one per row.
- **ADR-007** decided that `product` writes **feature** rows at PROMOTE and amended RULE-01 to
  exempt feature and glossary rows (`ADR-007-triage-issues-feature-ids.md:34-39`). It assigns no
  author to glossary rows. Feature rows are untouched here.
- **ADR-023** keeps the ship-owned set at three files; this adds none. Its rejected alternative
  (`ADR-023-one-pull-request-per-ship.md:113-116`) — *"Widen the ticket's `allowed_paths` to
  include the three files at PLAN … puts registry paths in every ticket's allowed list, so the
  write-time guard would permit a developer to edit `features.md` mid-implementation"* — is the
  closest objection. It rejected a registry path in **every** ticket's list, for files `/ship`
  writes. Here the path is listed only by a ticket that owes a term, and PLAN writes it. The
  developer half of the objection does apply, and is the first cost below.
- **`.ai/01-operating-model.md`** listed PLAN's writes as `01-plan.md`, `ticket.yaml` (line 81) and
  **`.claude/agents/tech-lead-design.md:48`** said *"Edit `.ai/registry/**`. RULE-01."* Both are
  amended by this ADR rather than contradicted by it.

## Rationale

**(a) Add `glossary.md` to the ship-owned set** — rejected by the operator's choice. It widens the one
exemption RULE-03 has in CI, and makes `/ship` commit a file no command it runs wrote.

**(c) Have the runner land triage's registry output on `ops/`** — rejected by the operator's choice.
It covers every registry file triage might write, but gives an unattended process a `git push`,
which settings deliberately prompt for.

(b) adds no path to any exemption. It moves one write one stage later, to the stage that already
owns `allowed_paths`.

## Consequences

What becomes true:

- A PROMOTE that introduces a term leaves a tree `/plan` can carry. MD-041's instance cannot recur.
- The glossary rows, the feature row and the code that names fields from them arrive in one pull
  request, reviewed together.

**What becomes weaker, stated plainly:**

- **A developer may edit `glossary.md` at IMPLEMENT on such a ticket.** It is in `allowed_paths`,
  so RULE-03 and R1 permit it. ADR-023 named this cost for `features.md`. Nothing but review stops
  a developer from rewording a definition to match the code.
- **The meaning is written by `tech-lead-design`, not by `product`.** The role that heard the
  operator at `/idea` and `/triage` now only names the term. The definition must be sourced from the
  idea file and ADRs; where they are thin, PLAN stops on an *Open questions* entry rather than
  filling it.
- **`size` counts one more path** for such a ticket.
- **Only the glossary is covered.** Any other registry or standards text a triage writes still has
  no carrier. MD-041 named the class; the operator chose the fix for the instance. EVT-01's
  `ticket.yaml` comment also owes rows in `rbac-and-security.md` and `data-model.md`; they reach a
  pull request only if PLAN lists those files in `allowed_paths`, and nothing checks that it does.
- **No DoR item checks it.** Enforcement is the PLAN gate, graded by `tech-lead-design` on its own
  artifact. A DoR item graded by `/advance` was considered and deferred — see the revert condition.

## Revert condition

Either, one occurrence:

1. **A ticket reaches `/ship` with a term in `glossary_owed` and no row for it in
   `.ai/registry/glossary.md`.** The PLAN gate is not holding; add it to the Definition of Ready as
   item 7, produced at PLAN by `tech-lead-design`, so `/advance` grades it.
2. **A `glossary.md` row changes in a ticket's diff between PLAN and `/ship`** without a Changelog
   line in `01-plan.md` saying why. The developer cost above is real; reconsider (a) or (c).

## Affected documents

| File | Change | `doc_version` |
|------|--------|---------------|
| `.ai/templates/ticket.yaml` | `glossary_owed: []` and its note | — |
| `.claude/commands/triage.md` | Owed terms go in `glossary_owed`; no `glossary.md` write | — |
| `.claude/agents/product.md` | Same, as a *You do NOT* bullet | — |
| `.claude/commands/plan.md` | Artifact out, gate, § *Glossary terms owed by triage* | — |
| `.claude/agents/tech-lead-design.md` | The one registry exception | — |
| `.ai/templates/plan.md` | § 7 note | — |
| `.ai/01-operating-model.md` | TRIAGE and PLAN rows of the stage table | 9 → 10 |
| `.ai/standards/git-conventions.md` | *Everything else* excludes a registry path `allowed_paths` names | unchanged |
| `.ai/registry/glossary.md` | Header paragraph, which still said *Human-only* | unchanged |
| `.ai/board/model-debt.md` | MD-041 resolved | 8 → 9 |
| `scripts/tests/entry.test.mjs` | Pins the carrier: stray before PLAN, carried once listed | — |
