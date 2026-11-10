---
doc_version: 3
last_updated: 2026-09-23
governed_by: [RULE-01, RULE-09]
---

# ADR-041 — R1 and R3 judge what the Developer wrote

## Status

`ACCEPTED by steward`, 2026-09-23.

Recorded under RULE-09's second form, not the operator's. The operator's instruction was
*"tôi muốn đơn giản hóa flow và rule hiện tại để chạy loop"* — a directive to simplify so the loop
runs, which authorises the shape of this change but does not name its contents. The contents are the
steward's, and CODEOWNERS reviews them at merge like any other registry change.

This ADR does not supersede or reverse any accepted ADR. It extends ADR-023's exemption set from CI
to the review check that reads the same diff, and it scopes R3 to the same files RULE-03 scopes the
Developer to.

## Context

CAL-11's review (`.ai/board/tickets/CAL-11/04-review.md`, 2026-09-23) returned `FAIL` on three
checks, and **two of the three were the model failing itself**:

- **R1** failed because `.ai/board/backlog.md` was in the diff. The review says in terms who wrote
  it: `product` at `/triage` and the `orchestrator` at `/advance` — not the Developer. RULE-03
  governs *an agent* editing outside *the active ticket's* `allowed_paths`; R1 reads a diff produced
  by three agents across three stages and charges all of it to one. `scripts/check-allowed-paths.mjs`
  already exempts the ticket folder and the three ship-owned paths for exactly this reason
  (ADR-023, `check-allowed-paths.mjs:25-27`); `.ai/registry/rules.md:59` said *"R1 has no
  exemptions"*, so CI and the review gate read the same diff to opposite verdicts.
- **R3** failed on five ESLint errors in `scripts/run-loop.mjs` and `src/components/Sidebar.tsx`.
  The review established that both files are byte-identical to the branch point, so the errors
  pre-date the ticket — and neither file is in `allowed_paths`, so **no loop role may fix them
  under RULE-03.** A repo-wide gate judged against a path-scoped mandate is a deadlock: the check
  cannot pass and the agent that fails it cannot act. It was broken out of once by hand, on
  `ops/lint-clean-main` (81a06ea, *"clear the five eslint errors on main so R3 can pass"*), which is
  a human paying a toll the model invented.

Neither is a defect in CAL-11's code. The one real finding was R7 — an INV-04 question that
escalated correctly and is still the operator's to answer.

The same two shapes will fail every future ticket: `/triage` and `/advance` write `backlog.md` on
every ticket by construction, and one stray lint error anywhere in the tree blocks every ticket until
a human clears it.

Alongside them, two structures measured dead on 38 shipped tickets:

- **The chat topology table has nine rows; four name retired roles.** `ba` (ADR-019) and `qa`
  (ADR-022) appear in four rows, and two of the three prohibitions are between two retired roles.
  Of the five `99-questions.md` files on the board, **every one is `developer -> tech-lead-design`**
  (one is from the retired `qa`). Since ADR-036 each stage is its own `claude` process, so the
  forbidden pairs have no channel to use.
- **`guard-read-scope.mjs` is wired on `Read|Grep|Glob|NotebookEdit` and fails open for every live
  agent.** Its `RESTRICTED` set is `{ba, qa}` (`guard-read-scope.mjs:28`) and its own header says
  *"no live agent matches RESTRICTED and it fails open for everyone"* (`:8`). It spawns a Node
  process per read tool call, in every stage of every unattended run, to exit 0.

## Decision

**R1 exempts what `scripts/check-allowed-paths.mjs` already exempts.** The subject of R1 is the diff
minus the ticket's own folder and minus the three ship-owned paths (`.ai/board/backlog.md`,
`.ai/board/metrics.md`, `.ai/registry/features.md`) — the `SHIP_OWNED` constant, which
`scripts/lib/entry.mjs:455` and `check-allowed-paths.mjs:27` already hold identically under a test.
Everything else in the diff must still be a subset of `allowed_paths`, with no further exemption.
RULE-03's text does not change and neither does its `v`: the Developer still may not edit outside
`allowed_paths`, and R1 still reports it when they do.

**R3 is scoped to the changed lintable files.** A lint error in a file the diff does not touch is
recorded in the review under R3 with its `file:line`, routed to a human as an `OPS-nnn` chore, and
**does not fail the gate**. R2 stays whole-program, because a typecheck is whole-program by nature
and cannot be scoped without lying. The repo-wide lint run stays where the whole tree is the
subject: DoD item 3 at `/ship`.

**The chat topology is the two live rows.** `developer -> tech-lead-design` allowed before and after
verdict; `developer` and `tech-lead-review` forbidden before verdict (RULE-12), allowed after. The
rows naming `ba` and `qa` are deleted, as are their rows in the session lifecycle table. RULE-11,
RULE-12, RULE-14, RULE-15 and RULE-16 are unchanged in text and in force — the mechanism is used,
five times in 38 tickets, and it is the table that was carrying dead roles, not the rules.

**`guard-read-scope.mjs` is unwired from `.claude/settings.json`.** The file and its tests stay, and
the header records that re-wiring is one block in `settings.json` if a read-restricted role ever
returns. RULE-05 stays retired and its number stays unused.

**The `settings.json` edit is owed and is the operator's**, not because it needs approval but because
the harness refuses an agent edit to `.claude/settings.json` under its self-modification rule. The
exact block to delete is in the hook's own header and in MD-036. Until it is deleted the decision is
recorded and not executed, and the hook keeps firing harmlessly — the cost is runtime, not
correctness.

## Rationale

The alternative for R1 was **to keep it absolute and move the board writes elsewhere** — have
`/triage` and `/advance` not touch `backlog.md`, or have `/ship` write it. That is the more principled
answer and it costs more than it buys: `backlog.md` is the view the orchestrator repairs as it goes,
so deferring every write to `/ship` means the board is wrong for the whole life of a ticket, which is
the one window a human looks at it. The exemption already exists in CI and has been reviewed once
under ADR-023; two readers of one diff disagreeing is a worse defect than a named exemption.

The alternative for R3 was **to require main's lint clean as a precondition and stop the ticket if it
is not** — which is what happened by hand on 81a06ea. It works, and it puts the cost in the wrong
place: a ticket that is entirely correct is blocked on unrelated debt, and the agent told to fix it
is forbidden by RULE-03 from doing so. Recording the error and routing it as a chore keeps the
finding without the deadlock.

The alternative for the chat topology was **to leave the retired rows as history**, the way retired
commands keep a banner. Rejected because the two tables are read as instructions by a live agent
deciding whether an edge is allowed, not as a record — unlike a command file, which is only read by
someone running that command. History lives in ADR-019 and ADR-022.

## Consequences

**What becomes easier.** CAL-11's review re-run fails on R7 alone — the real finding. No future
ticket fails for writing the board, and no future ticket is blocked by a lint error it did not cause.
Four rows leave the topology table and two leave the session table. One Node spawn per read tool call
leaves every unattended run.

**What becomes harder, and is the price.** R1 no longer reports a Developer that writes
`backlog.md`, `metrics.md` or `features.md` outside its `allowed_paths` — three paths where a silent
write now passes review and is caught only by CODEOWNERS at merge. `features.md` is the one that
matters: it is registry. RULE-01's CODEOWNERS review is the remaining guard and it is a human
reading a diff, not a check.

**R3 no longer notices the tree rotting.** A lint error outside the diff is recorded and routed, and
a chore that nobody runs means errors accumulate invisibly between ships. `/ship` is the backstop and
it is the *only* backstop.

**Unwiring `guard-read-scope.mjs` removes a guard that would have to be re-wired deliberately.** A
future read-restricted role will be created by someone who does not know the hook exists.

## Revert condition

**R1** — one Developer write to any of the three ship-owned paths reaching `main` unnoticed by
review. Observable in `git log --follow` on those three paths: a commit whose ticket's
`allowed_paths` does not list the path. On observation, R1 returns to absolute and the board writes
move to `/ship`, which is the alternative rejected above.

**R3** — three consecutive `/ship` runs where DoD item 3 fails on a lint error that a scoped R3 had
already recorded and routed. That means the chore route is not being run and the scoping traded a
loud failure for a silent one. On observation, main's lint becomes a `/plan` step 0 precondition.

**The chat topology** — any `99-questions.md` whose `to:` names a pair the collapsed table does not
cover. That means the table was cut too far and the missing edge is named by the file that needed it.

## Affected documents

| File | To doc_version |
|---|---|
| `.ai/01-operating-model.md` | 8 |
| `.ai/registry/rules.md` | 3 |
| `.ai/templates/review-report.md` | 4 |
| `.ai/standards/git-conventions.md` | 3 — its § *ship-owned set* said the exemption was CI's, and CAL-11's review cited those lines to reach the verdict this ADR overturns |
| `.ai/board/model-debt.md` | 5 — MD-036, the owed `settings.json` edit |
| `.claude/settings.json` | n/a — not a versioned document |
| `.claude/hooks/guard-read-scope.mjs` | n/a — not a versioned document |
