---
description: Interrogate a request until every decision is settled, then write the idea file
argument-hint: "<the request, in words>"
---

Run in the **Product session**. **You are `product`; nothing is dispatched.**

That is not a formality. This command is a conversation with the operator, and a dispatched
subagent has no channel to hold one — `product` holds `Read, Grep, Glob, Write, Edit, SendMessage`
and none of those asks a person a question. A dispatch here can only guess at the answers it was
sent to obtain, which is the failure this command exists to prevent.

*Corrected 2026-09-22, the day this file was written. It opened with an instruction to dispatch
`product` as a subagent; the first real run ignored that, ran in the session, and said why. It was
right.*

> **Un-retired 2026-09-22 — ADR-038, and with a different job from the one ADR-019 retired.**
> The old `/idea` was the first half of a two-command sequence: write the idea, then `/triage` it.
> ADR-019 folded that into `/triage` and retired this file.
>
> **This is now the interactive half of an unattended pipeline.** The loop runs without a person,
> so every decision a person owns has to exist *before* it starts. This command is where they are
> made — in conversation, with the operator present, taking as long as it takes. The loop then
> reads the file and asks nothing.

## The shape of the whole thing

```
/idea "<request>"        ← here. Ask. Iterate. Write the file.
node scripts/run-loop.mjs auto <name>     ← no questions, start to pull request
```

`<name>` is any unambiguous fragment of the filename — the slug, a word from it, the whole name.

## What you do

**1. Read before asking.** `.ai/00-charter.md`, `.ai/registry/invariants.md`,
`.ai/registry/glossary.md`, `.ai/standards/rbac-and-security.md`, `.ai/standards/data-model.md`, the
ADRs, and the source. **Also read `supabase/migrations/` and `supabase/seed.sql`.** A decision the
operator already made can be sitting in a migration that the registry has not caught up with, and
asking them to re-decide it is worse than not asking at all.

**But a decision found there is not yet a decision on record, and `/triage` will not treat it as
one.** If the idea rests on a decision that exists only in a migration header, a source comment or
an agent's summary — anything other than an ADR whose `## Status` is `ACCEPTED` — **ask the operator
to confirm it, in words, here**, and record the answer verbatim under `## Evidence`. Quote what the
migration says and ask *"is this what you decided?"* — that is confirming, not re-deciding.

*Added 2026-09-22.* The first idea written by this command cited *"the operator's decision"* of
2026-09-11 from a migration header and asked nothing about it. `/triage` then found no ADR, correctly
refused to sign `ACCEPTED by the operator` on an agent's paraphrase, and stopped the unattended run
at NEEDS-ADR — asking the operator the one question this command, with the operator present, should
have asked. Also check `.ai/registry/decisions/` for a `PROPOSED` ADR the idea depends on: its
acceptance is the operator's, and this is the place to get it. You still write nothing under
`.ai/registry/**`; the verbatim answer in the idea file is what lets `/triage` write
`ACCEPTED by the operator` with a quote to point at, rather than stopping to ask.

**2. Ask everything that is genuinely theirs, and nothing that is not.** Unlike the runner's intake
step there is no cap here, because there is no cost to a question a person is sitting in front of.
But the same four filters apply, and they apply harder — a question you could have answered yourself
spends the operator's attention, which is the scarce thing:

1. **Is it in the repository?** Read it.
2. **Is it the layout of a screen?** Yours, by the carve-out in `CLAUDE.md`. Never ask.
3. **Can `tech-lead-design` decide it and record the rejected alternative in plan section 8?**
4. **Would a wrong guess be cheap to reverse?** Then guess, and say in the file that you guessed.

**Iterate.** An answer that opens a new question is normal; ask the new one. Stop when you cannot
name a decision that a downstream stage would have to invent.

**3. Say what each answer costs, in two branches.** Not "should admins see other teams?" but
"under A we add a policy, a row in the RBAC table and an ADR; under B there is nothing to build".
The operator is choosing between two amounts of work, and they can only do that if you name both.

**4. Write the file.** `.ai/templates/idea.md`, at `.ai/board/ideas/<yyyy-mm-dd>-<kebab-slug>.md`.
The slug states the **problem**, not the solution — it is what the operator will type to start the
loop, and it is what `features.md` will cite for ever.

- `operator_request` — their words, **verbatim**. Never tidied.
- Every question and its answer, verbatim, under `## Evidence`.
- The problem statement, **marked as your derivation**.
- `## Out of scope` — what was decided *against*. This is what stops the ticket growing at PLAN.
- `verdict`, `verdict_reason`, `ticket_id` — **leave empty.** You capture here; `/triage` judges.
  Issuing an ID before the verdict burns one on an idea that may be rejected (ADR-007).

**5. Print the next command**, with the filename filled in, ready to paste.

## You do NOT

- **Issue a feature ID, or write to `.ai/registry/**`.** RULE-01, ADR-007. Not even a placeholder.
- **Decide the verdict.** A file that already says PROMOTE has skipped the only gate TRIAGE has.
- **Write a solution.** `.ai/templates/idea.md` § *When the request is shaped like a solution*:
  keep their sentence, derive the problem, mark the derivation.
- **Stop because the request is shaped like a solution.** Most are. Derive and continue.
- **Leave a question you thought of unasked because the answer seems obvious.** Obvious to you is an
  assumption downstream, and downstream has nobody to check with.

## Your reply

Per `## Replying` in `CLAUDE.md` — the questions while you are asking them, then the file path and
the next command. The operator should be able to copy one line and walk away.
