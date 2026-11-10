---
doc_version: 3
last_updated: 2026-09-22
governed_by: [RULE-01, RULE-07, RULE-09, RULE-17]
---

# ADR-038 — The asking moves out of the loop, and `/idea` is un-retired to hold it

## Status

`PROPOSED` — 2026-09-22, by the steward, at the operator's instruction: *"loop sẽ chạy sau khi có
tất cả quyết định và yêu cầu để khi chạy loop không cần hỏi tôi bất kì yêu cầu nào"* — the loop runs
once every decision exists, so that running it asks nothing.

**Not `ACCEPTED`.** It un-retires a command ADR-019 retired and changes what `/triage` may be handed.
Both sit behind the operator's approval at the pull request. It extends ADR-036 and ADR-037 and
shares their status.

## Context

ADR-037 gave the runner an intake step: `product` proposes questions, the operator answers at the
terminal, and the answers go to TRIAGE verbatim. It works, and three live runs showed why it is the
wrong shape.

**A run that asks is not an unattended run.** The operator has to be at the keyboard at the moment
the runner reaches intake, and stay there. Miss it and the process sits on a prompt; answer it
badly under time pressure and the answer is in the ticket for ever. The second live run was
abandoned mid-intake for exactly this reason.

**Intake questions are cheap to ask and expensive to answer well.** The bar was tightened twice —
from *"would change the work"* to *"the plan cannot be written without it"*, with four filters the
agent must fail before it may ask. That took a real request from five questions to zero, and the
remaining questions were the right ones. But the tightening was aimed at the wrong thing: **the
problem was never the number of questions. It was that they arrive inside a process the operator is
supposed to be able to walk away from.**

**A question asked in a batch cannot be followed up.** Intake runs once, with a cap, and reads the
answers into a prompt. When an answer opens a new question — which is normal, and happened on every
live run — there is nowhere to put it. The operator's own request had narrowed scope with *"giả định
team đã tồn tại"*, and the honest follow-up, *no second team exists and nothing creates one*, had no
turn to be asked in.

**And a real one: `product` asked the operator to re-decide something they had already decided.**
The glossary says *"Exactly one team exists in v1; multiple teams are deferred"*. On disk,
`supabase/migrations/20260911180000_solo_many_teams.sql` records the operator making three explicit
multi-team decisions eleven days earlier, and `supabase/seed.sql` carries two teams. The migration
is unapplied and its ADR was never written, so the registry is not wrong exactly — it has not caught
up. `product` read the registry correctly and asked a settled question anyway. **A batch intake has
no room to go and check; a conversation does.**

## Decision

### The interrogation becomes its own command, and the loop asks nothing

```
/idea "<request>"                          ← ask, iterate, write the file
node scripts/run-loop.mjs auto <name>      ← no questions, start to pull request
```

**`/idea` is un-retired with a different job from the one ADR-019 retired.** The old `/idea` was the
first half of *write the idea, then triage it*, and folding it into `/triage` was right when a human
ran every stage. Under a runner the two halves have different audiences: one needs a person in the
room, the other must not have one. The name is kept because the job is still *capture the idea*; what
changed is that capture is now interactive by design rather than by accident.

It runs in a session, with no cap on questions, because a question costs nothing when the person is
already sitting there. The four filters still apply and apply harder — a question the repository
answers spends the operator's attention, which is the scarce thing. **It reads
`supabase/migrations/` and `seed.sql` as well as the registry**, so a decision recorded in a
migration is not asked about again.

It writes the idea file with `verdict`, `verdict_reason` and `ticket_id` **empty**. Capture is not
judgement: a file that already says PROMOTE has skipped the only gate TRIAGE has, and issuing an ID
before the verdict burns one on an idea that may be rejected (ADR-007).

### An idea file with no verdict is triaged, with no intake

The runner previously took an idea file, looked for a verdict, and errored when it found none — the
path ADR-037 specified and did not build. It now runs `/triage` against the file, **and skips intake
entirely**. Not suppressed, not defaulted: there is no question, because the file is the answers.

Nothing is relayed. `/triage` is handed the path and reads it, which is how every other stage in the
loop already works; `triagePrompt` exists only because a request typed at a terminal is not on disk
until TRIAGE writes it there.

**If TRIAGE finds a decision genuinely missing, the answer is BLOCKED — never a guess.** The run
stops with the gap named. A guess at this stage reaches the schema, the permission model and the
acceptance criteria before anyone looks at it.

**And TRIAGE is told to check the registry against the file.** Where they disagree it says so and
prefers NEEDS-ADR to REJECT, because a REJECT on the strength of a stale line loses work the
operator has already approved. That instruction exists because of the multi-team case above.

### The file is named by any fragment of its name

A filename like `2026-09-22-an-admin-cannot-see-another-teams-roster.md` — dated, slugged, and
carrying the whole problem statement — is not something anyone types. Any unambiguous fragment resolves — the slug, a word from it, the whole filename, with or
without `.md`.

Two rules keep that from becoming a guess. **Ambiguity is an error that lists the candidates**,
never a first match: running the wrong idea file runs the wrong triage, and the operator finds out at
the pull request. And **only a single token is matched**, so a sentence cannot resolve to a file by
accident and silently re-run a triage the operator meant to start fresh.

**The operator asked for the file to be named `UIA-01.md`.** It is not, and this is the one place
this ADR does not do as it was asked. A feature ID at capture time is an ID issued before the verdict
exists, which is what ADR-007 arranged the stages to avoid — `product` issues the ID at TRIAGE, on
PROMOTE, and a rejected idea consumes none. Fragment matching gives the same ergonomics without
spending an ID: `auto roster` is shorter than `auto UIA-01`. If the operator wants the ID anyway it
is a one-line change and an amendment here.

## Consequences

**The loop becomes genuinely unattended.** Between `/idea` and the pull request there is no moment
that needs a person, except the ones the rules reserve for one — an invariant violation, a route to
a human, a BLOCKED artifact, a split, two failed reworks, and the push.

**The operator's attention moves to where it is worth most.** All of it is spent in one conversation,
before anything is written, when changing the answer is free. None is spent watching a process.

**Intake stays, for free text.** `auto "<request>"` still asks, because there is no file to read. It
is now the shortcut rather than the main path, and the tightened bar makes it cheap.

**A question that arrives late still stops the run.** `/idea` cannot anticipate everything. What it
buys is that the questions it does not anticipate surface as `OPEN QUESTIONS` at PLAN or as a BLOCKED
triage — both of which stop with the gap named, rather than being answered by whichever stage finds
them inconvenient.

**Two `/idea` files now exist in the history with different meanings.** Tickets shipped before
2026-09-01 cite the retired one. The banner in the command file says which is which, and no ticket
artifact is rewritten.

## Alternatives rejected

**Keep tightening the intake bar.** It was tightened twice and the second tightening worked — five
questions to zero on a real request. It still leaves the questions inside the run, which is the
property the operator asked to remove.

**Let intake loop until the operator says stop.** It turns the runner into a chat client, in a
process that is meant to be startable and walked away from, and it puts a conversation inside
something with a per-step budget and a step cap.

**Have `/idea` also triage.** One command, one file, no second step. It also means the agent that
wrote the idea judges it, which is the separation `/triage`'s verdict exists to provide, and it puts
a REJECT in front of the operator at the end of a conversation they just spent effort on.

**Name the file `UIA-01.md`.** Answered above: it issues a feature ID before the verdict.

## Changed by this ADR

| File | Change |
|---|---|
| `.claude/commands/idea.md` | **Un-retired**, with a new job: interrogate until settled, then write the file |
| `scripts/lib/entry.mjs` | `matchIdeaFile`; resolver order so a ticket still wins, then an idea fragment, then an error |
| `scripts/lib/prompts.mjs` | `triageFromFilePrompt` — reads the file, asks nothing, BLOCKS on a real gap |
| `scripts/run-loop.mjs` | An idea file with no verdict is triaged with no intake |
| `scripts/tests/entry.test.mjs` | Naming, ambiguity, the sentence guard, the ticket-wins rule |
| `CLAUDE.md` | The command list |
