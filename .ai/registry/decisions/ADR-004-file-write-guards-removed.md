---
doc_version: 3
last_updated: 2026-08-23
governed_by: [RULE-01, RULE-03, RULE-09]
---

# ADR-004 — The three file-write guards are removed

> **Inherited from the origin project this kit was extracted from.** ADR-004 was decided
> there, against a real loop, and is carried into this template unchanged in substance because the
> decision is about the process rather than about that product. It is in force here as written. If
> this project reaches a different conclusion, supersede it with a new ADR rather than editing this
> one — the record of what was decided first is what makes the second decision legible.

## Status

`ACCEPTED` — 2026-08-23, by the operator of the origin project. In force in this template as
shipped: `.claude/settings.json` wires `chat-guard.mjs` and the two non-write guards, and leaves the
three file-write guards on disk and unwired.

The operator chose this from a written menu of four options that named the cost of each, then made
the `settings.json` change by hand. The steward did not make it: two independent controls — the
project's own `guard-registry.mjs` and the harness — declined to let an agent modify the guards that
constrain it, including in the conservative narrowing direction. **That refusal is itself part of the
record, and it is the strongest evidence the model has produced that the controls were real.**

This ADR was written by an agent, which before that day was impossible. That is the change.

## Context

`.claude/settings.json` wired four hooks to the `Edit|Write` matcher:

| Hook | Rule | What it stopped |
|---|---|---|
| `guard-project-root.mjs` | — | writes outside the repository, invisible to `git status` and CI |
| `guard-registry.mjs` | RULE-01 | any write under `.ai/registry/**`, for every agent |
| `guard-allowed-paths.mjs` | RULE-03 | writes outside the active ticket's `allowed_paths` |
| `chat-guard.mjs` | RULE-12, RULE-15 | writes to `99-questions.md` addressed to a judging role |

The friction that produced this decision was concrete and one-sided. Every registry change the
operator was asked to paste by hand during the 2026-08-23 session was `.ai/registry/features.md` — a
work queue. None was ever `rules.md` or `invariants.md`. The guard did not distinguish between them,
because it is a path-prefix test, and it could not be scoped to one agent because sessions carry no
role identity — carried into `.ai/board/model-debt.md` as one of the known defects that arrive with
this kit.

The operator also cannot use a terminal in this environment, so the escape hatch the model assumed —
a human runs one command — was not available. The remaining option was hand-editing files in an
editor for every feature row.

## Decision

The first three hooks are unwired from the `Edit|Write` matcher. `chat-guard.mjs` stays. The three
hook files stay on disk, unwired, so restoring them is one edit rather than a rewrite.

The other three matchers are untouched: `guard-tracker-scope.mjs` on ClickUp calls,
`chat-guard.mjs` on `Agent|Task|SendMessage`, and `guard-read-scope.mjs` on `Read|Grep|Glob`. None of
them guards a file write.

## Consequences

**RULE-01 changes from a mechanism to a policy.** Its text is amended at v2: changing the registry
still requires an ADR and human approval, but enforcement is now `.github/CODEOWNERS` review on the
pull request. The control moved from before the write to before the merge. That is weaker in one
specific way — a bad registry change now exists in a branch and a diff, where before it could not be
typed — and unchanged in the way that matters most, because merging was already permanently human
under RULE-09.

**RULE-03 loses its pre-write enforcement.** Review check R1 and `scripts/check-allowed-paths.mjs` in
CI remain. Both run after the fact, and the CI check passes vacuously on any branch not
named `feat/<ID>` — also carried into `.ai/board/model-debt.md`. An agent writing outside `allowed_paths` on an `ops/` branch is now
caught by nothing.

**Two recorded defects become history rather than debt** — that `guard-allowed-paths.mjs` is wired
to `Edit|Write` only and so misses a write through `Bash`, and that the CI check is skipped on any
branch not named `feat/<ID>`. Both describe holes in guards that no longer run. They are kept in
`.ai/board/model-debt.md` because a defect that was recorded is the cheapest evidence for what a
proposal costs, and if these guards are ever restored both apply again unchanged.

**A charter that refuses to let agents change the rules they are judged by can no longer say so.**
That refusal was true, and this ADR is the counter-example: an agent wrote it, and amended RULE-01 in
the same commit. `.ai/00-charter.md` is amended rather than quietly left standing — which is a
standing obligation on any project adopting this kit, not a one-time edit made here.

**`features.md` says `/pull-tickets` is forbidden from writing to it.** That sentence now has no
mechanism behind it. Check D1 in `scripts/check-docs.mjs` fails the audit on a feature ID that does
not resolve, which catches an invented ID after the write instead of preventing it.

## What would reverse this

Restoring the three objects in `.claude/settings.json`. The hook files are unchanged on disk and
their tests still pass, so the cost of going back is one edit and one test-list update.

The signal to watch for is a registry change appearing in a pull request that the operator had not
asked for. Under the old design that could not happen; under this one it is what review is for.

## Rejected alternative

**Narrowing `guard-registry.mjs` to an allowlist** — `features.md`, `glossary.md` and `tracker.yaml`
writable, `rules.md`, `invariants.md` and `decisions/` still blocked. This was the steward's
recommendation and it would have removed all of the observed friction while keeping the part the
charter actually names.

It was rejected by the operator in favour of the broader change. Recorded here because it remains the
obvious middle position if this decision is revisited, and because the reasoning behind it does not
expire: the registry holds a work queue and a rulebook in one directory, and only one of them is what
an agent must not be able to edit.
