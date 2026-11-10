---
doc_version: 3
last_updated: 2026-10-09
governed_by: [RULE-01, RULE-03, RULE-09]
---

# ADR-054 — R1 exempts the ticket's own promoting idea file

## Status

`ACCEPTED by the operator` — 2026-10-09, **for the choice, not for this wording.**

Recorded, not authored. Offered two ways out of a failing `check-allowed-paths` on `feat/EVT-05`, the
operator chose **"2"**: keep the commit on `feat/EVT-05`, and make R1's committed check accept a
ticket's own source idea file. **Provenance of those words:** the operator gave them in the
orchestrator's session, and the steward received them relayed in that session's instruction to
`/thuki`; they are not quoted from a file. If that relay is wrong, this ADR is wrong and the
revert below applies at once.

**What the operator decided** is the exemption and its subject — the ticket's *own* promoting idea
file, and no other. **What is the steward's** is the mechanism: that the definition of "own" is the
one `planCarry` already uses, extracted as `isOwnIdea`, and that a deletion is not exempt.

Amends ADR-023 decision 2 (the exempt set was three names) and ADR-043's committed half (*"with
ADR-041's exemptions"*). Supersedes nothing.

## Context

On 2026-10-09 the orchestrator recorded the operator's answer to Q6 — the question EVT-05 was
blocked on at PLAN — in the idea both EVT-04 and EVT-05 were promoted from,
`.ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md`, and committed
that two-line change on `feat/EVT-05` as `6af1204`. `node scripts/check-allowed-paths.mjs` then
failed on exactly that path: the committed half of R1 exempted the ticket folder and the three
ship-owned names (ADR-023), and an idea file is neither.

**The uncommitted half already accepted it.** `planCarry` — the function behind
`scripts/check-carry.mjs`, which is R1's uncommitted half since ADR-043 — carries *"an idea file
whose front-matter `ticket_id` is this ticket, or whose path this ticket's `ticket.yaml` cites"*.
So the same file was legitimate while dirty and a violation once committed on the same branch. Two
halves of one check disagreeing about one path is the class ADR-043 closed for siblings; this is the
same class on the idea file.

**And `planCarry`'s definition had a defect of its own, found by this case.** It compared
`ticket_id` as one whole string. `/triage` writes a split PROMOTE as one string naming both tickets —
`ticket_id: "EVT-04, EVT-05"` and `"EVT-06, EVT-07"` are on disk — which matched neither ticket. So
before this ADR, even the uncommitted half would have called this idea file stray for EVT-05; it
passed only because the file was not dirty.

MD-042 named this file's class as an orphan with two fix shapes, (a) and (b), and left the choice to
the operator. This ADR settles the R1 half of it. It does **not** settle MD-042 — see *Consequences*.

## Decision

1. **`scripts/check-allowed-paths.mjs` exempts the ticket's own promoting idea file**, beside the
   ticket folder and the ship-owned set. A changed path is exempt under this clause when it matches
   `.ai/board/ideas/<file>.md`, still exists, and `isOwnIdea` returns true for it.

2. **"Own" has one definition, and it is `isOwnIdea` in `scripts/lib/entry.mjs`**: the idea's
   front-matter `ticket_id` names the ticket, or the ticket's `ticket.yaml` cites the idea's path.
   `planCarry` calls the same function. There is no second, hand-written copy — in the check, in the
   review template, or in the operating model, which cite the function rather than restate it.

3. **`ticket_id` is read as a list.** A comma-separated string, or a YAML list, names each ticket in
   it. The fix is in `isOwnIdea`, so both halves of R1 and the runner's preflight get it at once.

4. **Every other idea file stays a violation**, and so does deleting the ticket's own. The exemption
   is one file per ticket, derived from that file's content — not the `.ai/board/ideas/` prefix.
   ADR-023 decision 2's reason holds: a prefix exemption is the moment RULE-03 stops being
   enforceable in CI.

5. **`/ship`'s and `/handoff`'s ship set is unchanged.** They still do not commit the idea file.
   Whether they should is MD-042 option (a), and the operator has not chosen it.

## Rationale

**Rejected: name the file in `SHIP_OWNED`.** It is a different file per ticket; a fourth name would
have been wrong for the next ticket.

**Rejected: exempt `.ai/board/ideas/**`.** That is a category, and ADR-023 decision 2 refuses one for
the reason it gives. A ticket branch could then carry any idea's edits — another ticket's verdict
included — past CI.

**Rejected: a separate predicate in the check.** It is ten lines either way, and two copies is how
R1's two halves came to disagree in the first place.

## Consequences

**What gets better.** A committed record of an operator decision in a ticket's own idea file — the
place `/idea` and `/triage` put such decisions — no longer fails CI or R1. R1's two halves now agree
about the idea file. The second ticket of a split PROMOTE recognises its own idea in the preflight,
in R1 and in CI.

**What gets worse, and it is real.** CI is one path weaker per ticket: a Developer who edits the
ticket's own idea file at IN_PROGRESS — rewriting the verdict, or an answered question — now passes
`allowed-paths`. Behind it stand the `exempt` line the check prints for the file — which R1 quotes
into `04-review.md`, so the exemption is visible rather than silent — and the pull request, which
shows the diff. That is the same cost ADR-023 accepted for `backlog.md`.

**`check-allowed-paths.mjs` now imports from `scripts/lib/`.** It had no imports before, so it ran on
any Node that runs ESM. `entry.mjs` evaluates `import.meta.dirname` at load, which needs Node 20.11
or later. `TODO(verify):` the Node version on the `ubuntu-latest` runner the `allowed-paths`
workflow uses; `.github/workflows/allowed-paths.yml` pins none.

**MD-042 is not closed.** A dirty edit to the idea file is still in no ship set, so nothing commits
it unless a session commits it by hand, as the orchestrator did here. This ADR makes that hand
commit pass; it does not make it happen. MD-043 records what remains.

**A second consumer of `ticket_id` has the same split-string defect and is not fixed here.**
`scripts/run-loop.mjs` uses `readVerdict(...).ticketId` as one ticket ID, so an unattended run on a
split PROMOTE stops at *"PROMOTE names ticket EVT-04, EVT-05 but its ticket.yaml does not exist"*.
Recorded as MD-044 — a runner change is not part of the operator's choice.

## Revert condition

A ticket branch reaching `main` with an edit to its own idea file that changed a `verdict`,
`verdict_reason` or `ticket_id` and was not made by `/triage` or recorded as an operator answer.
That is the exemption hiding authorship of a decision. Narrow the clause to additions below the
front-matter, or drop it and return to MD-042 (b).

## Affected documents

| File | To doc_version |
|---|---|
| `scripts/check-allowed-paths.mjs` | n/a — the exemption, via `isOwnIdea` |
| `scripts/lib/entry.mjs` | n/a — `ideaTicketIds`, `isOwnIdea`; `planCarry` calls the latter |
| `.ai/registry/rules.md` | 5 |
| `.ai/01-operating-model.md` | 12 |
| `.ai/templates/review-report.md` | 6 |
| `.ai/standards/git-conventions.md` | 5 |
| `.claude/commands/ship.md` | n/a — DoD item 2 names the file; the ship set is unchanged |
| `.claude/agents/orchestrator.md` | n/a — one parenthesis: CI passes the file, the ship set does not take it |
| `scripts/check-carry.mjs` | n/a — header comment only |
| `.ai/board/model-debt.md` | 11 — MD-043, MD-044 |
