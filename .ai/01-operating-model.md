---
doc_version: 12
last_updated: 2026-10-09
governed_by: [RULE-01, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08, RULE-09, RULE-10, RULE-11, RULE-12, RULE-13, RULE-14, RULE-15, RULE-16, RULE-17]
---

# Operating model

How work moves from an idea to an open pull request, who owns each step, and what must be true for it
to advance.

This document cites rule IDs. It does not restate rule text; `.ai/registry/rules.md` holds it, once.

**Domain-free by construction.** Nothing below names a product, a framework, or a datastore. Where an
example is needed it uses a neutral one — `EXA-01`, an order, the invoice list. The places this
document defers to the project are marked `TODO(project):` and are all the same shape: the name of a
command the project runs, or the name of a directory the project chose.

## Two planes

|  | Registry plane | Board plane |
|---|---|---|
| Path | `.ai/registry/`, `.ai/standards/` | `.ai/board/` |
| Lifetime | Permanent | Transient |
| Writes | Humans only (RULE-01) | Agents |

A ticket's working directory is `.ai/board/tickets/` — never under `.ai/registry/`. This is not a
filing convention. It is what makes RULE-01 enforceable by a path check
(`.claude/hooks/guard-registry.mjs`) instead of by an agent's judgement about whether an edit was
important enough to count.

## Lifecycle

```
TRIAGE -> [PROMOTE writes the feature row and the ticket shell] -> BACKLOG
  -> PLAN -> [DoR] -> READY -> IN_PROGRESS -> REVIEW -> DONE
                                   ^            |
                                   +-- REWORK <-+
                                          |  (rework_count >= 2, RULE-06)
                                          v
                                    ESCALATED -> human
```

**A `PROMOTE` verdict writes the feature row itself** — ADR-007 removed the human step that used to
sit here. A ticket still cannot pass DoR unless its feature IDs exist in
`.ai/registry/features.md`; what changed is who puts them there.

Two things keep that from becoming a licence to invent a feature. **The ID is issued at TRIAGE by
`product`, never at PLAN by `tech-lead-design`** — the role that will write the plan is not the role
that grants the ID it writes against. And **every row written this way cites the idea file it came
from**, so a
fabricated feature has no provenance and the pull request has something concrete to check. The
operator's approval did not disappear; it moved to CODEOWNERS review at merge, which is where RULE-01
always said enforcement lives.

**PLAN runs directly out of BACKLOG. The DoR gate sits between PLAN and READY.** Two of its six items
are produced at PLAN, so a gate placed before PLAN could never read them. READY means "planned,
sized, and safe to build" — the last checkpoint before implementation effort is spent.

**There is no separate IDEA stage and no separate SPEC stage** — ADR-019. TRIAGE absorbed the first
and PLAN absorbed the second. What each cost and what each was carrying is in that ADR; this document
records only the shape that resulted.

A ticket that fails DoR after PLAN returns to BACKLOG with the failing item named. That is not REWORK
and does not increment `rework_count`: nothing has been built, and the defect is in the specification
or in the registry, not in an implementation.

## State enum

`TRIAGE` `BACKLOG` `PLAN` `READY` `IN_PROGRESS` `REVIEW` `REWORK` `ESCALATED` `DONE`

These nine values are the complete enum for `ticket.yaml`'s `state` field. Check D10 verifies that
this list and the stage ownership table below stay in agreement in both directions.

## Stage ownership

| State | Agent | Reads | Writes | Gate |
|---|---|---|---|---|
| TRIAGE | `product` + `tech-lead-design` | the raw request, registry | `.ai/board/ideas/**`; `features.md` and the ticket shell on PROMOTE — owed glossary terms go in the shell's `glossary_owed`, never in `glossary.md` (ADR-047) | An idea file exists stating a problem and not a solution, **and** `verdict` is REJECT, NEEDS-ADR or PROMOTE in its front-matter with `verdict_reason` beside it — ADR-037. On PROMOTE, `ticket_id` names the ticket and a feature row exists citing that idea file |
| BACKLOG | `orchestrator` | `features.md`, `backlog.md` | `backlog.md` | Feature IDs exist in the registry |
| PLAN | `tech-lead-design` | registry, standards, `ticket.yaml`, the source tree | `01-plan.md`, `ticket.yaml`; the `glossary_owed` rows in `glossary.md`, which goes in `allowed_paths` (ADR-047) | Sections 1-8 complete; ACs in Given/When/Then each with an ID; `invariants_touched` populated; `size_estimate` and `size` set; `allowed_paths` enumerated; Out-of-scope non-empty; every `glossary_owed` term has a row |
| READY | `orchestrator`, via `/advance` | `ticket.yaml`, `01-plan.md`, `features.md` | `ticket.yaml`, `backlog.md` | Full DoR, below |
| IN_PROGRESS | `developer` | the plan first, then the source tree within `allowed_paths` | code, `03-impl-log.md` | typecheck + lint exit 0; every contract item implemented |
| REVIEW | `tech-lead-review` | plan, impl-log, `git diff` | `04-review.md` | R1-R8, each citing `file:line` |
| REWORK | routed agent | the failing verdict plus its own prior artifact | its own artifact, code | The specific failed checks now pass |
| ESCALATED | human | everything | anything | A human decides; the ticket does not self-resume |
| DONE | `orchestrator` | all | `ticket.yaml`, `backlog.md`, `metrics.md` | Full DoD; opens PR (human merges, RULE-09) |

**`verdict` is a field, not a heading.** Until ADR-037 the TRIAGE verdict existed only as prose:
`gate:` is `PASS` on every file in `.ai/board/ideas/` including the one that was REJECTed, and the
verdict itself is written in at least eight different heading shapes. Nothing could route on it.

**"A problem and not a solution" is a property of the idea file, not a test the request must pass.**
Most requests arrive as solutions, because that is how people think. TRIAGE derives the problem, marks
the derivation as its own, and keeps the request verbatim in `operator_request`. Rejecting a request
for its shape is not one of the three verdicts, and ADR-037 forbids it in terms.

The three rows from PLAN through REVIEW are the implementation loop. The other six exist so that every
value in the state enum has a declared owner — a state nobody owns is a state where a ticket stops
silently.

## `01-plan.md` sections — all eight required

Sections 1 and 2 are what `01-story.md` used to carry; 3 through 8 are what `02-design.md` used to
carry. One artifact, one author, one gate — ADR-019.

**There were nine until ADR-022 removed the QA stage.** The testability contract sat at 8 and its only
reader was QA; *Rejected alternatives* moved up into its number.

1. **Problem and scope** — what this ticket does, and an explicit **Out-of-scope** that is never empty
2. **Acceptance criteria** — Given/When/Then, each with an `AC-n` ID
3. **Permission model** — which role gate applies to each action and each control
4. **Contract** — exact function or endpoint signatures, input schemas, return types (RULE-04)
5. **Seam impact** — which functions in the data-access seam change, or "none"
6. **Schema delta** — `none`, or a description plus an ADR link
7. **allowed_paths** — explicit glob list
8. **Rejected alternatives** — at least one, with the reason

Section 8 is what makes the plan reviewable, and it carries more weight than it did as one section of
nine. With SPEC gone and QA gone, it is the only place a reader sees that the author considered a
different shape.

Section 7 is what `.claude/hooks/guard-allowed-paths.mjs` reads. Until PLAN writes it,
`allowed_paths` is `[]` and the hook blocks every write outside the ticket folder. That emptiness is
a control, not an initial value.

**Sections 1 and 2 are written before 3 through 9 are read.** The order is the whole of what survives
of the SPEC/DESIGN separation: one agent now writes both halves, so the only thing standing between an
acceptance criterion and the design that finds it convenient is the order they are written in.
ADR-019 records this as the cost it is, not as a safeguard.

## Review checklist

| # | Check |
|---|---|
| R1 | **Committed:** `git diff --name-only origin/main...HEAD`, minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file, is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (RULE-03, ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs <ID>` exits 0 (ADR-043) |
| R2 | typecheck exit 0 — whole-program |
| R3 | lint exit 0 **on the changed lintable files** (ADR-041) |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) |
| R6 | Permission gating matches plan section 3 |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) |
| R8 | No dependency added without an ADR |

**An item with no `file:line` citation counts as failed.** Not "counts as unverified" — failed. A
reviewer that cannot point at a line has not checked anything, and a checklist that accepts assertion
in place of citation is a checklist that always passes.

**R1 and R3 judge what the Developer wrote, and nothing else** — ADR-041. Both exemptions exist
because the check and the mandate had different subjects, and a ticket was failing for writes RULE-03
never prohibited.

- **R1 has two subjects and two rules** — ADR-043. A ticket's tree holds *committed* changes, which
  belong on the branch, and *uncommitted* ones — until ADR-048 the whole ticket for its whole life,
  since then at most the stage since the last `/advance` checkpoint. One rule applied to both is what failed CAL-11 twice.
  - **Committed** — `git diff --name-only origin/main...HEAD` must be a subset of `allowed_paths`,
    exempting `SHIP_OWNED` plus the ticket folder: `.ai/board/backlog.md`, `.ai/board/metrics.md`,
    `.ai/registry/features.md`, `.ai/board/tickets/<ID>/**` — **and, since ADR-054, the ticket's own
    promoting idea file**, decided by `isOwnIdea` in `scripts/lib/entry.mjs`, the predicate
    `planCarry` uses for the uncommitted half. Do not decide "own" by hand: run
    `node scripts/check-allowed-paths.mjs`, which prints the file as `exempt` when it is. Every other
    idea file, and deleting the ticket's own, is still a violation. Apart from that file, this is the set
    `scripts/check-allowed-paths.mjs` has exempted since ADR-023, so CI and R1 now agree. `/triage`
    and `/advance` write `backlog.md` on every ticket, so without this R1 fails every ticket.
  - **Uncommitted** — `node scripts/check-carry.mjs <ID>`, a CLI over the same `planCarry` the
    runner's preflight uses. A path is a violation when and only when it comes back **stray**;
    **carried** paths are listed in the review and are not violations. Do not re-derive the exempt
    set by hand here — the one written into this document on 2026-09-22 was incomplete the day it
    was written, and that is what ADR-043 stopped maintaining.
- **R3 is scoped to the lintable files in the diff.** A lint error in a file the diff does not touch
  is reported under R3 with its `file:line` and routed as an `OPS-nnn` chore; it does **not** fail
  the gate. No loop role may fix it — the file is outside `allowed_paths` and RULE-03 forbids the
  edit — so failing the gate on it deadlocks the ticket. The repo-wide run is DoD item 3 at `/ship`,
  and since ADR-041 it is the only backstop.

R2 is not scoped. A typecheck is whole-program, and a per-file typecheck would report errors the
build does not have and miss errors it does.

## Failure routing

| Failing check | Route to | Increments `rework_count` |
|---|---|---|
| R1, R2, R3, R4, R5 implementable, R8 | `developer` | Yes |
| R5 impossible as specified | `tech-lead-design` | No |
| R6 | `tech-lead-design` | No |
| **R7** | **human, immediately** | ESCALATE (RULE-07) |
| A lint error outside the diff, reported under R3 | a human, as an `OPS-nnn` chore — **the gate still passes** (ADR-041) | No |
| DoR item unsatisfied at the READY gate | `tech-lead-design` if the item is produced at PLAN, otherwise a human | No |

Per RULE-08, upstream defects must not burn the downstream agent's rework budget. A Developer who
correctly implemented an incoherent design has not failed, and charging that failure to the Developer
would exhaust the budget under RULE-06 for a defect it did not cause and cannot fix.

## Handoff and bounded chat

Clarification and adjudication are different things, and the distinction is the whole basis of the
chat model. See `.ai/registry/decisions/ADR-001-bounded-agent-chat.md`.

|  | Clarification | Adjudication |
|---|---|---|
| Shape | question then answer | position, negotiation, verdict |
| Direction | downstream asks upstream about intent | judge and judged converge |
| Effect on artifact | improves accuracy | contaminates it |

### Chat topology

Every allowed edge points **backwards**, toward whoever declared intent.

| Pair | Before verdict | After verdict |
|---|---|---|
| `developer` to `tech-lead-design` | allowed | allowed |
| `developer` and `tech-lead-review` | **forbidden** (RULE-12) | allowed |

**Two rows, because those are the two live roles that can reach each other** — ADR-041. This table had
nine rows and four of them named `ba` (retired, ADR-019) or `qa` (retired, ADR-022); two of its three
prohibitions were between two retired roles. Of the five `99-questions.md` files on the board, every
one is `developer -> tech-lead-design`.

The rows were cut rather than kept as history because **this table is read as an instruction by a live
agent deciding whether an edge is allowed**, not as a record — unlike a retired command file, which is
only read by someone running that command. ADR-019 and ADR-022 hold the history.

RULE-11, RULE-12, RULE-14, RULE-15 and RULE-16 are unchanged and in force. What was dead was the
table, not the rules.

Enforced by `.claude/hooks/chat-guard.mjs`, which also enforces the RULE-15 budget of six messages
per pair per ticket, tracked in `ticket.yaml` under `chat_budget`.

### Transport: chat is a file, not a message

There is no live message channel between agents. A question is a **file write**, and the answer is an
**amendment to the answering agent's own artifact**. See `.ai/standards/session-model.md`.

1. The asking session writes `.ai/board/tickets/<ID>/99-questions.md`, whose front-matter carries
   `to: <agent>` and `asked_at: <ISO8601>`.
2. The answering session amends its own artifact — the story, the design — appends a `## Changelog`
   line per RULE-14, and answers in `99-questions.md` beneath the question.
3. `chat-guard.mjs` inspects writes to `99-questions.md` and blocks when `to:` names a pair the
   topology forbids before a verdict exists (RULE-12). The same hook counts entries against
   `chat_budget` (RULE-15).

This is what makes RULE-14 mechanical rather than aspirational. A clarification that reveals an
incomplete upstream artifact **must** amend that artifact, and here there is nowhere else for the
answer to live — it cannot be spoken and forgotten, because speaking it means writing it down.

### Session lifecycle

RULE-13's requirement is that REVIEW sees files only, with no message channel and no inherited
context. That is delivered by session lifetime, not by tearing down a shared team session.

| Agent | Session | Closes when |
|---|---|---|
| `orchestrator` | persistent | end of run |
| `tech-lead-design` | persistent | end of run |
| `developer` | ephemeral | ticket DONE or ESCALATED — **survives REWORK** |
| `tech-lead-review` | ephemeral | after **each** verdict, including a re-review |
| `product`, `devops` | ephemeral | task done |

The `ba` and `qa` rows were removed by ADR-041, for the reason the chat topology table gives: both
roles are retired and this table is read as an instruction, not as a record.

**Roles that get asked stay alive; roles that pass judgement die after speaking.**

The Tech Lead is asked to explain what it meant, sometimes several tickets later, and a session that
remembers the intent behind a decision answers better than one re-reading its own output cold.

A reviewer is the opposite. A `tech-lead-review` session that remembers checking R4 last time will
not really check it again — but the code changed between passes, which is the entire reason there is
a second pass. Its memory is a liability, so it dies after each verdict.

The Developer sits between: ephemeral, but it **survives REWORK**. Rework is a continuation of the
same work with new information, and making the Developer re-derive the design from scratch on every
cycle would burn the RULE-06 budget on rediscovery rather than on fixing what the reviewer found.

## Artifact front-matter

Every artifact opens with:

```yaml
---
ticket: <ID>
stage: PLAN
agent: tech-lead-design
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/ticket.yaml, .ai/registry/invariants.md ]
consulted:
  - with: product
    asked: "..."
    answer: "..."
    resulted_in_amendment: true
chat_before_verdict: none    # required and must be `none` on 04-review.md and 06-test-report.md
gate: PASS                   # PASS | FAIL | BLOCKED
blocking_reason: ""
next_state: IN_PROGRESS
---
```

`chat_before_verdict: none` is an attestation (RULE-12). If a reviewer cannot truthfully write it,
the review is void and the stage re-runs in a clean session.

An artifact whose content reflects a chat but whose `consulted` block is empty is a gate failure. That
is a provenance lie, and provenance is how a bad output is diagnosed six tickets later.

## Orchestrator loop

**The orchestrator is the lead session, not a dispatched subagent.** It reads the board, decides what
is next, and **prints the command to run and the session to run it in**. It does not invoke the stage
owner.

That is what makes the session lifecycle above enforceable. A subagent cannot open a fresh top-level
session for the reviewer, nor keep the BA's session alive across tickets — so an orchestrator that
dispatched would have to fake both, and RULE-13 would come back to depending on an agent's good
behaviour instead of on how the sessions are actually started. A printed instruction that **a human
or the runner** runs is a real context boundary; a nested call is not.

**Since ADR-036 the reader of that instruction may be `scripts/run-loop.mjs`.** Nothing above
changes, and that is the point. The runner reads the board, decides the next step in deterministic
code, and spawns it as its own top-level `claude` process with `--agent` and its own session id —
which is the same boundary a person typing the command produces, made by a script instead of by
hands. The orchestrator still does not dispatch: it is one of the agents the runner spawns.

**A separate process is what makes RULE-13 a mechanism rather than a description.** A subagent
inherits its parent's context, so a reviewer dispatched that way is isolated only by its own
willingness to ignore what it has already read. Before ADR-036, whether the reviewer was fresh
depended on which window someone typed into; the session table above was a description of careful
behaviour. It is now enforced, and asserted in `scripts/tests/run-loop.test.mjs`.

`/next-ticket` therefore emits something like:

```
EXA-01 is in BACKLOG. Run /plan EXA-01 in the tech-lead-design session.
```

```
loop:
  tickets = read all .ai/board/tickets/*/ticket.yaml
  if any state == ESCALATED:            notify human; halt that ticket
  if count(state in PLAN..REVIEW) >= WIP:  wait
  t = first ordered ticket in backlog.md whose state != DONE
  if t.state == BACKLOG:                PRINT "/plan <id> in the tech-lead-design session"; continue
  if t.state == PLAN and gate passed:   evaluate DoR
                                          pass -> t.state = READY
                                          fail -> demote to BACKLOG; name the failing item; continue
  if t.state == REVIEW:                 require a FRESH session (RULE-13); never reuse a prior one
  PRINT the next command and the session it belongs in     <-- does not dispatch
  read result front-matter                                 <-- /advance does this
  PASS -> t.state = next_state ; FAIL -> REWORK, route per table
  write ticket.yaml; repair backlog.md; append metrics.md
  checkpoint: commit the ship set on feat/<id>, no push      <-- /advance's last step, ADR-048
```

**The recording step is `/advance <ID>`** — `.claude/commands/advance.md`, added by ADR-036. It
reads the front-matter of the artifact the last stage produced and transcribes the gate and the next
state into `ticket.yaml`, evaluating the Definition of Ready on the way out of PLAN. It transcribes
and does not judge: front-matter that is absent or self-contradictory stops it, and it writes
nothing.

Until ADR-036 this step had no file. The loop above specified it, `.ai/standards/session-model.md`
assigned it to `/next-ticket`, and `/next-ticket` says in its own words that it writes nothing — so
`state` never passed through `PLAN`, `READY` or `REWORK`, and `gates.plan` and `gates.review` were
written by nobody, although `/ship` requires both. Eighteen tickets went `BACKLOG -> REVIEW` on disk.

**Routing reads `invariant_violation` and `route_to` from `04-review.md`, never a check number.**
The numbers drifted across four files between ADR-022 and ADR-036, and the number that meant
"invariant" in the review template was the number the table below sends to `developer` with the
rework counter incrementing — RULE-07 failing while everything looked ordinary.

`ARTIFACTS_FOR[state]`, never the whole ticket folder. Feeding an agent every artifact defeats the
isolation the model depends on: a reviewer given the whole folder reads the author's reasoning for
why the code is right, which is the one thing a review must not be handed.

| State | ARTIFACTS_FOR |
|---|---|
| PLAN | `ticket.yaml`, registry, standards, the source tree |
| IN_PROGRESS | `ticket.yaml`, `01-plan.md`, standards |
| REVIEW | `01-plan.md`, `03-impl-log.md`, `git diff`, registry |

## Backlog

`.ai/board/backlog.md` is an **ordered list, not a scored one**. A human reorders rows; the
orchestrator takes the top. There is deliberately no priority algorithm — scoring invites agents to
argue about priority, which is not their job and not a thing they are good at.

Sections: `## READY`, `## BACKLOG`, `## BLOCKED`, `## ARCHIVE (last 20)`.

`backlog.md` is a view. `ticket.yaml` is authoritative. On disagreement the orchestrator repairs
`backlog.md` and does not touch `ticket.yaml` to make the view right.

## ID scheme

Ticket ID equals feature ID in the 1:1 case. Splits get `-a`, `-b`. Defects are `BUG-nnn`, chores are
`OPS-nnn`, decisions are `ADR-nnn`.

## Definition of Ready

**DoR gates the PLAN to READY transition.** The question it answers is not "may this ticket be
specified" but "is this ticket safe to design and build". Four of its six items are produced at
BACKLOG, by `/triage` when it creates the ticket (ADR-010); two are produced at PLAN. Every item names its producing stage, and every
producing stage sits at or before the gate.

Checked mechanically by the orchestrator.

| # | Item | Produced at | By |
|---|------|-------------|-----|
| 1 | `feature_ids` non-empty, and every ID present in `.ai/registry/features.md` | BACKLOG | `product`, when promoting the idea (ADR-007) |
| 2 | `invariants_touched` explicit — may be `[]`, never absent | PLAN | `tech-lead-design` |
| 3 | Every ticket in `depends_on` is `DONE` | BACKLOG | `product`, when creating the shell (ADR-010) |
| 4 | `schema_delta` is `none`, or an approved ADR is linked | BACKLOG | `product` + `tech-lead-design`; a schema change needs its ADR before the ticket exists (RULE-09). **A migration touching a policy, trigger or constraint is not `none`** — ADR-014 |
| 5 | `size_estimate` is S or M | PLAN | `tech-lead-design`, from plan section 1 and its Out-of-scope |
| 6 | Exactly one feature group, or a stated split rationale | BACKLOG | `product`, or `tech-lead-design` at PLAN if the plan reveals a second group |

`[]` and absent are different answers. `[]` says the BA considered the invariants and found none
engaged. Absent says nobody looked, and check R8 has nothing to reason through.

Two earlier versions of this document placed the DoR gate before the stage that produced items 2 and
5, which made them unsatisfiable: the producing stage was downstream of the gate that required them.
Moving the owner of item 5 earlier did not fix it, because the gate itself was in the wrong place.
Check D13 exists because of that defect and verifies that no DoR item names a producing stage later
than the gate.

## Definition of Done

1. both gates `passed: true` with timestamps — `plan` and `review`
2. diff is a subset of `allowed_paths`
3. typecheck, lint, unit tests and end-to-end tests exit 0
4. zero invariant violations
5. `03-impl-log.md` lists every file touched with a one-line reason

All five are required. **There were six until ADR-022 removed the QA stage**; the one that went was
*every AC maps to a named test*, which had no producer once QA did. Item 3 stays and is now `/ship`'s
alone: the four commands in `.ai/standards/testing-standards.md` must exit 0, whoever last touched
the tests.

*Items 3 and 4 were also suspended from 2026-09-01 while ADR-017 waived QA, and restored by ADR-021
that afternoon. Recorded because two of this list's five items changed meaning three times in one
day.*

**TODO(project): name the four commands.** Typecheck, lint, unit and end-to-end are roles, not
command names. Write the exact invocations into `.ai/standards/testing-standards.md` once, and let
every other document go on referring to the role.

## Sizing

| Size | Files | Handling |
|---|---|---|
| S | up to 6 | proceed |
| M | up to 12 | proceed |
| L | more than 12 | must split at PLAN |
| XL | any size, if it changes the schema, or changes the signature of an existing seam function, or changes a shared type module | escalate |

Adding new functions to the data-access seam is ordinary feature work, not XL — every feature ticket
does it. XL is for changes that break the seam's existing contract: a schema migration, a changed
signature that existing callers must follow, or a shared type shape that ripples outward. The test is
whether existing callers must change, not whether the seam was touched at all. An earlier wording
read "touches the seam", under which every feature ticket escalated and the table meant nothing.

Split by operation first (read path, then write path), then by surface, then by role. **Never split
backend from frontend alone.** That produces a ticket that cannot be exercised end to end — which
mattered most when a QA gate had to run against it, and still matters now that none does: a half
ticket reaches DONE having demonstrated nothing.

Two fields, one owner now. `size_estimate` is read from plan section 1 and its Out-of-scope, and it
gates DoR. `size` is read from the enumerated `allowed_paths` in section 7, and it decides whether the
ticket splits. Both are written at PLAN, by `tech-lead-design`.

**They stay two fields even though one agent writes both**, because they are read at different moments
by different readers and one of them is a gate input. Collapsing them would put the gate's input and
the splitting verdict in the same cell, and a disagreement between an estimate and a verdict is
information — ADR-012 exists because of one.

They are separate because the gate needs an estimate and only design produces a verdict. A single
field could not be both without making one of the two stages impossible to reach.

**When they disagree, the verdict wins and PLAN proceeds** — ADR-012. There is no longer anyone to
ask: the estimate and the verdict are the same agent's, written minutes apart. The second pass would read the same design and
reach the same size, because the size comes from the enumerated `allowed_paths` rather than from
anything the story could have said differently.

The gap is recorded rather than routed: plan section 7 states both numbers and one line on why they
differ, and `.ai/board/metrics.md` keeps the pair, so a BA whose estimates are consistently low shows
up in the data. Per RULE-08 nothing increments `rework_count`.

**The table above is untouched by that.** An `L` still must split at PLAN and an `XL` still
escalates — a ticket that designs out to L is stopped by the split requirement, not by the
disagreement. ADR-012 removes one of the two reasons such a ticket stops; it does not remove the
other. Its revert condition is three consecutive tickets whose `size` exceeds `size_estimate`, which
nothing will stop for and which therefore has to be watched in the metrics.

## WIP

**WIP = 1** for the validation run.

Parallel dispatch is permitted only when `allowed_paths` are pairwise disjoint after glob expansion,
there is no mutual dependency, each ticket has its own working tree, and combined WIP is 3 or less.

**Since ADR-006 that condition is unreachable, not merely hard to satisfy.** There is one working
directory, so one branch is checked out and one ticket is in flight. WIP is 1 because git makes it 1,
and the paragraph below is kept as the reasoning behind why parallelism was not worth buying.

**Read that condition against your own codebase before relying on it.** In the origin project it
turned out to be unsatisfiable for exactly the tickets it governed: every feature added a type to one
shared module, so no two feature tickets ever had disjoint `allowed_paths`. The arrangement that
worked instead is in `.ai/standards/session-model.md` — a single writer, so overlapping lists are
harmless. If your codebase has a file every ticket touches,
the same will be true here, and the honest move is to say so rather than to assert a condition
nothing can meet.
