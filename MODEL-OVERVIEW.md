# CaleChip — agents, commands, flow and constraints

**Derived document. Not a source.** Everything here was read out of the files named below on
**2026-09-20**. Where this file and a source disagree, the source is right and this file is stale.

| Subject | Source of truth |
|---|---|
| Lifecycle, gates, routing, sessions, dispatch | [.ai/01-operating-model.md](.ai/01-operating-model.md) |
| The 18 rules (17 in force) | [.ai/registry/rules.md](.ai/registry/rules.md) |
| What the product refuses to do | [.ai/00-charter.md](.ai/00-charter.md) |
| Agent definitions | [.claude/agents/](.claude/agents/) |
| Command definitions | [.claude/commands/](.claude/commands/) |
| Operator preferences | [.ai/steward/context.md](.ai/steward/context.md) |
| CI/CD pipeline, secrets, release and rollback | [docs/ops/ci-cd.md](docs/ops/ci-cd.md) |

> This file sits at the repository root, which `scripts/check-docs.mjs` does not scan — its corpus is
> `.ai/**`, `.claude/**` and `CLAUDE.md` only. **No audit check will ever report that this document
> has drifted.** That is the cost of having it.

---

## 1. Agents

Ten definitions in `.claude/agents/`; eight are live.

| Agent | Model | Owns | Notable limit |
|---|---|---|---|
| `product` | opus | TRIAGE — writes the idea file, returns REJECT / NEEDS-ADR / PROMOTE, and on PROMOTE writes the feature row and the ticket shell | No `Bash`. Never writes a story, an AC, or anything downstream of an ID |
| `tech-lead-design` | opus | PLAN — `01-plan.md` (8 sections), plus `allowed_paths`, `size` and `size_estimate` into `ticket.yaml` | Never reviews an implementation |
| `developer` | sonnet | IN_PROGRESS — code inside `allowed_paths`, then `03-impl-log.md` listing every file touched with a reason | No invented field names (RULE-04); no contact with the reviewer before its verdict exists (RULE-12) |
| `tech-lead-review` | opus | REVIEW — `04-review.md`, checks R1–R8, every item citing `file:line` | **`SendMessage` is in `disallowedTools`.** It has no message channel at all — files only |
| `orchestrator` | sonnet | The loop: reads the board, prints the next command, records the returned gate, keeps `backlog.md` and `metrics.md` true. Also `/ship` | Writes no stage artifact, writes no code, never edits `ticket.yaml` to make a gate pass, never decides priority |
| `steward` | opus | The model itself — rules, hooks, checks, commands, standards, registry | Writes `.ai/**`, `.claude/**`, `scripts/**`. Never `.ai/board/tickets/**`, `backlog.md`, `metrics.md`, or product source |
| `devops` | sonnet | `.github/**`, container and build definitions, and the scripts those call | No application code, no seam changes, no registry |
| `solo` | opus | Direct work outside the loop — ADR-033 | Not for work that already has a ticket |
| ~~`ba`~~ | — | **RETIRED — ADR-019.** SPEC was merged into PLAN | Kept only so pre-2026-09-01 tickets stay readable. Do not dispatch |
| ~~`qa`~~ | — | **RETIRED — ADR-022.** The QA stage was removed | Same. Do not dispatch |

Every live agent except `orchestrator` has `mcp__clickup` in `disallowedTools` — the tracker is
reachable from one role only.

## 2. Commands

Seventeen files in `.claude/commands/`.

**The loop** — `/triage` → `/next-ticket` → `/plan` → `/implement` → `/review` → `/ship`

**Board and reporting** — `/sprint-status` `/status` `/pull-tickets` `/sync-tracker` `/docs-audit`

**The model** — `/thuki` (steward: rules, hooks, checks, registry; never ticket work)

**Outside the loop** — `/solo` (skips every stage and every gate, deliberately — ADR-033)

**Retired, files kept with a banner** — `/idea` `/spec` `/design` (ADR-019), `/qa` (ADR-022)

## 3. Lifecycle

```
TRIAGE ──PROMOTE──> BACKLOG ──> PLAN ──[DoR]──> READY ──> IN_PROGRESS ──> REVIEW ──> DONE
                       ^                                       ^             │
                       └──── DoR fail: no rework charged ──────┤             │
                                                           REWORK <──────────┘
                                                               │ rework_count >= 2 (RULE-06)
                                                               v
                                                          ESCALATED ──> human decides
```

The nine values above are the complete `state` enum in `ticket.yaml`. Check D10 verifies that the
enum and the stage-ownership table stay in agreement in both directions.

**PLAN runs directly out of BACKLOG; the DoR gate sits between PLAN and READY.** Two of DoR's six
items are produced at PLAN, so a gate placed before PLAN could never read them. A ticket that fails
DoR returns to BACKLOG with the failing item named — that is not REWORK and does not increment
`rework_count`, because nothing was built.

**A `PROMOTE` verdict writes the feature row itself** (ADR-007). Two things stop that being a licence
to invent: the ID is issued at TRIAGE by `product`, never at PLAN by the role that will write the plan
against it; and every row written this way cites the idea file it came from.

### Stage ownership

| State | Agent | Writes | Gate |
|---|---|---|---|
| TRIAGE | `product` + `tech-lead-design` | `.ai/board/ideas/**`; on PROMOTE, `features.md` and the ticket shell | An idea stating a problem, not a solution, plus a verdict with a reason |
| BACKLOG | `orchestrator` | `backlog.md` | Feature IDs exist in the registry |
| PLAN | `tech-lead-design` | `01-plan.md`, `ticket.yaml` | Sections 1–8 complete; ACs as Given/When/Then with IDs; `invariants_touched` populated; `size_estimate` and `size` set; `allowed_paths` enumerated; Out-of-scope non-empty |
| READY | `orchestrator` | `ticket.yaml`, `backlog.md` | Full DoR |
| IN_PROGRESS | `developer` | code, `03-impl-log.md` | typecheck + lint exit 0; every contract item implemented |
| REVIEW | `tech-lead-review` | `04-review.md` | R1–R8, each citing `file:line` |
| REWORK | the routed agent | its own artifact, code | The specific failed checks now pass |
| ESCALATED | human | anything | A human decides; the ticket does not self-resume |
| DONE | `orchestrator` | `ticket.yaml`, `backlog.md`, `metrics.md` | Full DoD; opens the PR — a human merges (RULE-09) |

### `01-plan.md` — eight sections, all required

1. Problem and scope, with a never-empty **Out-of-scope**
2. Acceptance criteria — Given/When/Then, each with an `AC-n` ID
3. Permission model — the role gate on each action and each control
4. Contract — exact signatures, input schemas, return types (RULE-04)
5. Seam impact — which seam functions change, or `none`
6. Schema delta — `none`, or a description plus an ADR link
7. `allowed_paths` — an explicit glob list
8. Rejected alternatives — at least one, with the reason

There were nine until ADR-022 removed the QA stage; the testability contract sat at 8 and its only
reader was QA.

**Section 7 is what `guard-allowed-paths.mjs` reads.** Until PLAN writes it, `allowed_paths` is `[]`
and every write outside the ticket folder is refused. That emptiness is a control, not an initial
value.

**Sections 1–2 are written before 3–8 are read.** With one agent writing both halves, the write order
is all that remains of the SPEC/DESIGN separation. ADR-019 records this as the cost it is, not as a
safeguard.

## 4. The orchestrator does not dispatch

It reads the board, decides what is next, and **prints the command and the session to run it in**:

```
EXA-01 is in BACKLOG. Run /plan EXA-01 in the tech-lead-design session.
```

This is what makes the session lifetimes in §7 enforceable. A subagent cannot open a fresh top-level
session for the reviewer, nor keep a session alive across tickets — an orchestrator that dispatched
would have to fake both, and RULE-13 would be back to depending on an agent's good behaviour. A
printed instruction that a human runs is a real context boundary; a nested call is not.

Each stage is fed `ARTIFACTS_FOR[state]`, never the whole ticket folder:

| State | Receives |
|---|---|
| PLAN | `ticket.yaml`, registry, standards, the source tree |
| IN_PROGRESS | `ticket.yaml`, `01-plan.md`, standards |
| REVIEW | `01-plan.md`, `03-impl-log.md`, `git diff`, registry |

A reviewer handed the whole folder reads the author's reasoning for why the code is right, which is
the one thing a review must not be given.

## 5. Gates

### Review checklist

| # | Check |
|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) |
| R2 | typecheck exit 0 |
| R3 | lint exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore (RULE-02) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) |
| R6 | Permission gating matches plan section 3 |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) |
| R8 | No dependency added without an ADR |

**An item with no `file:line` citation counts as failed** — not unverified, failed. A checklist that
accepts assertion in place of citation is one that always passes.

> **An R9 was accepted and never landed.** ADR-033 (2026-09-09) adds a ninth check comparing the
> built screen to its reference image, but the check is absent from the operating model, from
> `.ai/templates/review-report.md` and from the `/review` gate. The table above is R1–R8 because
> that is what the reviewer is actually given. See § 12.1.

### Failure routing

| Failing check | Routes to | Increments `rework_count` |
|---|---|---|
| R1, R2, R3, R4, R5 (implementable), R8 | `developer` | Yes |
| R5 impossible as specified | `tech-lead-design` | No |
| R6 | `tech-lead-design` | No |
| **R7** | **a human, immediately** | ESCALATE (RULE-07) |
| A DoR item unsatisfied at READY | `tech-lead-design` if the item is produced at PLAN, otherwise a human | No |

RULE-08: an upstream defect must not burn the downstream agent's rework budget. A developer who
correctly implemented an incoherent design has not failed.

### Definition of Ready — gates PLAN → READY

| # | Item | Produced at |
|---|---|---|
| 1 | `feature_ids` non-empty, every ID present in `features.md` | BACKLOG (`product`) |
| 2 | `invariants_touched` explicit — may be `[]`, never absent | PLAN |
| 3 | Every ticket in `depends_on` is `DONE` | BACKLOG |
| 4 | `schema_delta` is `none`, or an approved ADR is linked | BACKLOG. A migration touching a policy, trigger or constraint is **not** `none` (ADR-014) |
| 5 | `size_estimate` is S or M | PLAN |
| 6 | Exactly one feature group, or a stated split rationale | BACKLOG, or PLAN if the plan reveals a second |

`[]` and absent are different answers. `[]` says someone considered the invariants and found none
engaged. Absent says nobody looked.

### Definition of Done — all five

1. Both gates `passed: true` with timestamps — `plan` and `review`
2. The diff is a subset of `allowed_paths`
3. typecheck, lint, unit tests and end-to-end tests exit 0
4. Zero invariant violations
5. `03-impl-log.md` lists every file touched with a one-line reason

There were six until ADR-022; the one that went was *every AC maps to a named test*, which lost its
producer when QA did. Item 3 is now `/ship`'s alone.

## 6. Rules — 17 in force

RULE-05 was retired with the QA stage (ADR-022) and **its number is never reused.**

| Rule | Text | Enforced by |
|---|---|---|
| RULE-01 | Changing `.ai/registry/**` requires human approval, and an ADR for everything except feature and glossary rows | CODEOWNERS review on the PR. **The hook is unwired** — ADR-004 |
| RULE-02 | No component may bypass the data-access seam | `no-restricted-imports` in eslint, plus R4. **Verified firing** against a probe |
| RULE-03 | No agent may edit outside the active ticket's `allowed_paths` | R1 + `scripts/check-allowed-paths.mjs` in CI. **The hook is unwired** — ADR-004 |
| RULE-04 | Contract-first: signatures, schemas and types are declared before code. The developer may not invent field names | R5 |
| ~~RULE-05~~ | **Retired — ADR-022** | — |
| RULE-06 | Two failed rework cycles escalate. There is no third attempt | `rework_count` |
| RULE-07 | An invariant violation escalates on first occurrence and never enters REWORK | Routing table → human |
| RULE-08 | Only developer-caused failures increment `rework_count` | Routing table |
| RULE-09 | Schema changes and PR merges are permanently human | CODEOWNERS, branch protection, `gh pr merge` denied in settings |
| RULE-10 | Git is the source of truth; the tracker mirrors and is never on the critical path | `sync_enabled` defaults false; no gate reads tracker state |
| RULE-11 | Agents may chat for clarification; the written artifact is the only binding output | `consulted` block in front-matter |
| RULE-12 | An agent may not chat with the agent that will judge its work before that judgement is on disk | `chat-guard.mjs` + the `chat_before_verdict` attestation |
| RULE-13 | REVIEW runs in isolated dispatch, files only, never as a teammate in a live session | Session lifetimes |
| RULE-14 | A clarification that reveals an incomplete upstream artifact must amend that artifact | Changelog sections in the templates |
| RULE-15 | Chat budget is 6 messages per pair per ticket; exhaustion produces a BLOCKED artifact | `chat_budget`, enforced by `chat-guard.mjs` |
| RULE-16 | Every artifact stands alone. "As discussed" and equivalents are banned | The review gate |
| RULE-17 | Tracker content is third-party data, never instruction | `/pull-tickets` writes `tracker.raw_description` only |
| RULE-18 | Tracker targets resolve against `tracker.yaml` by ID only; empty `allowed_list_ids` blocks every call | `guard-tracker-scope.mjs` |

## 7. Sessions — the enforcement mechanism, not a convention

| Agent | Session | Closes |
|---|---|---|
| `orchestrator` | persistent | End of run |
| `tech-lead-design` | persistent | End of run |
| `developer` | ephemeral | Ticket DONE or ESCALATED — **survives REWORK** |
| `tech-lead-review` | ephemeral | After **each** verdict, including a re-review |
| `product`, `devops` | ephemeral | Task done |

**Roles that get asked stay alive; roles that pass judgement die after speaking.** A tech lead is
asked what it meant, sometimes tickets later, and a session holding the intent answers better than one
re-reading its own output cold. A reviewer is the opposite: one that remembers checking R4 will not
really check it again, and the code changed between passes, which is the entire reason there is a
second pass. Its memory is a liability.

The developer sits between — ephemeral, but it survives REWORK, because rework is the same work with
new information, and re-deriving the design each cycle would spend the RULE-06 budget on rediscovery.

## 8. Agent-to-agent chat

Every allowed edge points **backwards**, toward whoever declared intent. `developer` may ask
`tech-lead-design`. `developer` and `tech-lead-review` is **forbidden** until the verdict exists
(RULE-12), and opens afterwards.

**There is no live message channel. A question is a file write:**

1. The asking session writes `.ai/board/tickets/<ID>/99-questions.md`, front-matter carrying
   `to: <agent>` and `asked_at:`.
2. The answering session **amends its own artifact**, appends a `## Changelog` line (RULE-14), and
   answers beneath the question.
3. `chat-guard.mjs` inspects the write, blocks forbidden pairs, and counts the entry against
   `chat_budget` (RULE-15).

This is what makes RULE-14 mechanical rather than aspirational: the answer cannot be spoken and
forgotten, because speaking it means writing it down.

## 9. Standing constraints

**Two planes.** `.ai/registry/` and `.ai/standards/` are permanent and human-approved (RULE-01).
`.ai/board/` is transient and agent-writable. A ticket's working directory is `.ai/board/tickets/` —
never under the registry. That is what makes RULE-01 enforceable by a path check rather than by an
agent's judgement about whether an edit was important enough to count.

**WIP = 1, enforced by git.** One working directory, one branch, one ticket in flight (ADR-006). The
parallel-dispatch condition in the operating model is unreachable by construction and is kept only as
the reasoning for why parallelism was not bought.

**The tree stays dirty from `/plan` to `/ship`.** `/ship` is the only command in the loop that
commits: it classifies the tree, commits the ticket plus the three ship-owned board and registry files
on one branch, records the state transition and opens **one** PR (ADR-023). Chore work is not its to
commit — it names those paths and leaves them dirty for the session that wrote them. **A `git switch`
on a dirty tree is not an inconvenience, it is the loss.**

**Sizing.** S ≤ 6 files, M ≤ 12, L must split at PLAN, XL escalates. XL is for changes that break the
seam's existing contract — a migration, a changed signature existing callers must follow, a shared
type that ripples outward. *Adding* functions to the seam is ordinary feature work. Split by operation
first, then surface, then role; **never split backend from frontend alone** — that produces a ticket
that cannot be exercised end to end.

`size_estimate` gates DoR; `size` decides the split. They stay two fields though one agent writes
both, because a disagreement between an estimate and a verdict is information. When they disagree the
verdict wins and PLAN proceeds (ADR-012), with the gap recorded in plan section 7 and in `metrics.md`.

**No invention.** No invented feature IDs, acceptance criteria, database fields or invariants. Missing
information becomes a placeholder plus an `OPEN QUESTIONS` entry. One carve-out, added 2026-09-04: the
**visual arrangement of a screen**. With no image attached at `/triage` or `/plan`,
`tech-lead-design` originates the layout rather than stopping, and marks it as its own in
`01-plan.md` § 2b. Behaviour, permissions and invariants are not covered by this and are still never
invented.

**Additive only.** Do not delete or rewrite a file you did not create in the current run.

**Humans merge; agents commit at the `/advance` checkpoint and at `/ship`, and push only at `/ship`** (RULE-09, ADR-048).

**Windows-native.** No `.sh` files, no `chmod`, no shebang execution. Every hook is `.mjs` run via
`node`.

## 10. Hooks — what is actually wired

Six files in `.claude/hooks/`. Only three are wired in `.claude/settings.json`:

| Hook | Matcher | Status |
|---|---|---|
| `chat-guard.mjs` | `Edit\|Write` and `Agent\|Task\|SendMessage` | Wired — RULE-12 and RULE-15 |
| `guard-tracker-scope.mjs` | `mcp__clickup__.*` | Wired — RULE-18 |
| `guard-read-scope.mjs` | `Read\|Grep\|Glob\|NotebookEdit` | Wired, but the two roles it named (`ba`, `qa`) are both retired, so it restricts nothing |
| `guard-registry.mjs` | — | **Unwired** (ADR-004). RULE-01 falls back to CODEOWNERS at merge |
| `guard-allowed-paths.mjs` | — | **Unwired** (ADR-004). RULE-03 falls back to R1 and the CI check |
| `guard-project-root.mjs` | — | **Unwired** |

**Three of the six guards are not running, and a fourth has no subject.** The rules they carried are
enforced downstream — at review, in CI, or at merge — which means a violation is caught after it is
written rather than prevented. Worth knowing before trusting a guard to stop anything.

## 11. Audit

`scripts/check-docs.mjs` runs checks D1–D13 over `.ai/**`, `.claude/**` and `CLAUDE.md`. D8 is
advisory and never fails the run; everything else is an error.

`.ai/board/**` is deliberately **out of scope for D5, D6 and D9**, because a check aimed at an agent
mid-stage is an obstacle between it and its gate, and the cheapest way through is to satisfy the check
rather than report the finding. Both roads end at a green audit and only one of them means anything.

## 12. Known drift, as of 2026-09-20

Recorded here because someone will otherwise re-derive them. These belong to `/thuki`.

1. **An accepted ADR was never applied.**
   `ADR-033-review-check-r9-compares-the-built-screen-to-its-reference-image.md` is
   `ACCEPTED by the operator — 2026-09-09` and says R9 "is added to the checklist in
   `.ai/01-operating-model.md`, to `.ai/templates/review-report.md`, and to the `/review` gate."
   **`grep -n R9` finds it in none of those three files.** The only traces are two `description:`
   lines in `.claude/` — and `/review` itself still states its gate as "R1 through R8" at
   [.claude/commands/review.md:42](.claude/commands/review.md#L42). As things stand no reviewer runs
   a visual check, which is the entire defect that ADR was accepted to close. **Section 5 of this
   document lists R1–R8 because that is what the operating model actually says.**

2. **ADR-033 is assigned to two different decisions**, both on disk:
   `ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md` and the R9 one above.
   A third, `ADR-033-solo-engineer.md`, is cited by both [.claude/agents/solo.md:15](.claude/agents/solo.md#L15)
   and [.claude/commands/solo.md:10](.claude/commands/solo.md#L10) and **does not exist** — so
   `/solo`, the one path that skips every gate, rests on a citation that resolves to nothing.

3. **Review-check numbering disagrees in three live places.** The operating model's checklist runs
   R1–R8 with **R7** as the invariant check; `.ai/registry/rules.md` maps RULE-07 to "Review check
   **R8**"; and `.claude/agents/tech-lead-review.md` § "R8 is different" treats R8 as the invariant
   check too. Residue of the QA removal, compounded by item 1.

4. **`CLAUDE.md:164` still lists `/qa` in the loop**, though ADR-022 removed the stage. The same line
   omits `/solo`, which has both a command file and an agent definition.

5. **The chat-topology table in the operating model still lists `ba` and `qa` edges**, for two roles
   that are retired.

6. **The audit does not pass.** `node scripts/check-docs.mjs` reports **11 errors** on a clean tree
   (D1, D6, D9) — including `ADR-034-a-team-chooses-which-entry-types-need-approval.md` with no
   front-matter at all, and ADR-033's `governed_by` citing rules at a higher version than its own
   `doc_version`. Four further D6 rows are deferred with a written reason and are not defects.
