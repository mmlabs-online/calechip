---
doc_version: 3
last_updated: 2026-10-23
governed_by: [RULE-01, RULE-09]
---

# ADR-067 — The runner pushes, merges on a green gate, and a stage that would stop for a decision takes its own recommended option

## Status

`ACCEPTED by the operator` on 2026-10-23, in the orchestrator session that shipped MIR-06 and MIR-07.
The operator asked, verbatim: *"update lại loop để có thể tự chạy full flow mà không cần tôi can
thiệp"*. Then the orchestrator asked three questions, each with options, and the operator chose:

> **Push** — *"Cho push feat/\* (Recommended)"*
> **Merge** — *"Auto-merge khi CI xanh"*
> **BLOCKED** — *"Agent tự chọn recommended"*

After that, the operator chose *"1"* when Claude Code's auto-mode classifier refused the change and
the orchestrator offered three ways forward. Choice 1 meant that the operator lifts the refusal
themselves and the work goes ahead as asked. The operator then left auto mode and replied *"rồi"*.

Written by `orchestrator`. It records the operator's decision. It supersedes the clauses named
below; that supersession is the operator's, not the agent's.

## Context

The runner (`scripts/run-loop.mjs`, ADR-036) took one ticket from BACKLOG to an open pull request,
and only if nothing on the way needed a person. On 2026-10-23 every ticket needed one at least
three times:

1. **`git push` was deliberately not on the allow list** (`.claude/PERMISSIONS.md`, *The push prompt,
   and the unattended runner*). The runner therefore refused to start `/ship`.
2. **Merging was permanently human** (RULE-09 v2). Every ticket is cut from `origin/main`, so the next
   ticket could not start until a person merged the last one.
3. **A decision that would supersede an accepted ADR stopped the stage** (ADR-008, `plan.md`
   § *Schema and ADRs*, `triage.md`). MIR-08 stopped this way the same morning: plan item P2-1 has two
   outcomes, both reverse ADR-026 decision 1, and the plan recommended one of them.

Two defects of the runner also stopped runs that day. Neither was a rule: the preflight refused a
clean tree sitting on the last ticket's merged branch, although `/plan` step 0 accepts that; and one
denied read-only command (`supabase db dump --help`) failed a step whose artifact had already been
written with a valid gate.

**One fact shaped decision 2.** Since 2026-10-17, `verify.yml` runs on `release/**` only, so no
check reports on a pull request into `main` and `main` has no required status check. "Auto-merge when
CI is green" has no CI signal to wait for today.

## Decision

1. **`/ship` may push a ticket branch.** `Bash(git push origin feat/*)` and
   `Bash(git push -u origin feat/*)` join the allow list. `git push --force` and `git push origin main`
   stay denied.
2. **The runner merges, an agent never does.** After `/ship` opens the pull request, the runner's
   own deterministic code merges it with a merge commit. No agent is involved. It merges only when the
   **merge gate** passes:
   - if any check reports on the pull request, every check has concluded and none failed;
   - if no check reports, the runner itself runs `pnpm exec tsc --noEmit`, `pnpm exec eslint .` and
     `pnpm exec vitest run` on the ticket branch, and all three exit 0.

   A failed gate stops the run with the pull request open. `gh pr merge` **stays denied to every
   agent** in `.claude/settings.json`, so the only actor that merges is the runner process, which is
   code a person can read.
3. **RULE-09 v2 → v3.** Old: *"Schema changes and PR merges are permanently human. An ADR may be
   accepted by an agent, recorded under that agent's name; `ACCEPTED by the operator` remains a claim
   about a person."* New: *"Applying a schema change to a hosted database is permanently human. A pull
   request is merged by a person, or by the runner's own code when its merge gate passes (ADR-067);
   never by an agent. An ADR may be accepted by an agent, recorded under that agent's name;
   `ACCEPTED by the operator` remains a claim about a person."*
4. **A stage that would stop for an operator decision takes the option it recommends, and goes on.**
   This is a standing delegation, and it holds in an interactive session too. It covers a PLAN, TRIAGE
   or REVIEW that would otherwise set `gate: BLOCKED` because the decision would supersede or reverse
   an accepted ADR, and a `99-questions.md` addressed to the operator. The agent:
   - takes the option it already marked recommended;
   - writes the ADR under its own name: `ACCEPTED by <agent> under the operator's delegation
     (ADR-067)`, with the options, the one taken and the reason, and **never** `ACCEPTED by the
     operator`;
   - lists the ADR in its artifact's `## Delegated decisions` and continues to a PASS or FAIL gate.
     `/ship` names every delegated ADR in the pull request body.

   **Still stops:** an invariant violation (RULE-07); the rework cap (RULE-06); a decision for which
   the agent can name no option it would recommend; a fact only a person holds (a credential, an
   account, data nobody has written down); applying a migration to the hosted project (decision 3);
   and any of the four refusals in `.ai/00-charter.md`. A decision taken by delegation never invents a
   feature ID, an invariant or an acceptance criterion.
5. **The runner chains.** `--chain` makes the runner, after a ticket merges, take the next ticket of
   the same feature group whose `depends_on` are all `DONE`, lowest number first, and run it the same
   way. `--no-merge` keeps the old ending, an open pull request.
6. **Two runner defects fixed as part of this change.** These are not decisions. When `/plan` is
   next, the preflight accepts any branch on a tree with nothing stray, which matches `/plan` step 0.
   A permission denial is recorded in `REPORT.md` as a warning, and the step is judged by the
   artifact's front-matter and by the board, as every other step is.

## Rationale

The operator named the cost: being needed three times per ticket for steps whose outcome was already
decided. That covers a push of a branch the loop named, a merge of a pull request the reviewer
passed, and a choice the plan had already recommended.

**Why the runner merges and not `/ship`.** An agent that can merge can merge anything it is told to,
and the deny rule on `gh pr merge` is what holds that line. The runner is code with a fixed condition
in it. Moving the merge there keeps "no agent merges" literally true, and puts the condition in one
reviewable function.

**Why a local gate when no check reports.** Skipping the gate would make the merge unconditional.
Waiting for CI would wait forever, since none reports on `main` today. The local gate is the closest
honest reading of *"khi CI xanh"*. When `verify.yml` is pointed at `main` again, the first branch of
the gate applies with no change here.

**Rejected: let the agent write `ACCEPTED by the operator` for a delegated choice.** That is the
forged signature ADR-008 exists to prevent. The delegation is real and the operator gave it, but each
choice under it is the agent's. Recording it under the agent's name is what lets the operator find
every one of them later.

## Consequences

- **A wrong delegated choice merges before anyone reads it.** CODEOWNERS review of the registry path
  no longer happens before merge when the runner merges. What replaces it is the record: every
  delegated ADR carries the agent's name and ADR-067 in its status, and `/ship` lists them in the pull
  request body.
- **`ESCALATED` and the four refusals are the only stops the loop has left**, apart from the merge
  gate and the step and budget caps.
- **CICD-08 should move up.** It is what makes "CI is green" mean CI again.

## Revert condition

The operator disagrees, after the fact, with a decision the loop took by delegation, **and** that
decision had already merged. Then decision 2 reverts to an open pull request (`--no-merge` becomes
the default), and decision 4 stays: a decision taken by delegation that is wrong but not yet merged
costs nothing.

## Supersedes

- **RULE-09 v2**, by decision 3.
- **ADR-008**, the sentence *"An agent still asks rather than decides when the ADR would supersede or
  reverse an accepted one"*. It now does so by delegation, under decision 4. The rest of ADR-008
  stands.
- **`.claude/PERMISSIONS.md`**, *The push prompt, and the unattended runner*, by decision 1.
