# aifw-template

An agent operating model with no product in it. Clone it, stamp it, and a new repository starts with
a lifecycle, gates, nine agents, sixteen commands, six hooks and a documentation audit that already
works — instead of with a `CLAUDE.md` somebody wrote from memory on the first afternoon.

It is a process, not a stack. Nothing here assumes a language, a framework, a datastore or a test
runner.

## What is in it

| Directory | What it holds |
|---|---|
| [.ai/registry/](.ai/registry/) | Rules, invariants, features, glossary, ADRs. Permanent, human-only, and the only valid source of feature IDs |
| [.ai/standards/](.ai/standards/) | Tech stack, architecture, coding, data model, RBAC, testing, UI, git, sessions, integrations |
| [.ai/board/](.ai/board/) | Transient and agent-writable: backlog, tickets, metrics, ideas. Ships empty |
| [.ai/templates/](.ai/templates/) | The nine stage artifacts — story, design, impl log, review, test plan, test report |
| [.claude/agents/](.claude/agents/) | The nine agents and what each one may not do |
| [.claude/commands/](.claude/commands/) | The loop — `/triage` `/plan` `/implement` `/review` `/qa` `/ship` — and `/thuki`, which maintains the loop itself. `/idea`, `/spec` and `/design` are retired (ADR-019) and kept only so shipped tickets stay readable |
| [.claude/hooks/](.claude/hooks/) | Six guards, with tests. Three are wired; three are documented as deliberately unwired |
| [scripts/](scripts/) | The documentation audit and the branch-scope check, with tests |

The two planes matter and are enforced socially rather than by a hook: `.ai/registry/` and
`.ai/standards/` are permanent and human-only — changing them needs an ADR and a CODEOWNERS review
under RULE-01 — while `.ai/board/` is transient and agent-writable. Merging is permanently human
under RULE-09.

## Standing up a project

```
node scripts/check-docs.mjs
node --test .claude/hooks/tests/*.test.mjs scripts/tests/*.test.mjs
```

Both must be green — the audit exits 0 and the suites pass. A guard nobody has watched fire is a
belief about a guard, and the audit is the one thing in here you do not have to trust.

**The bootstrap that stamped this repository has been run and removed**; SETUP.md step 0.5 says why,
and `git log -- scripts/init-project.mjs` has it if it is ever wanted.

**Then read [SETUP.md](SETUP.md).** It is ten ordered steps, each saying what gates on it and what it
gates. The charter is first because nothing can be checked against an absent one.

## What it deliberately does not contain

No charter, no invariants, no architecture, no role matrix, no feature rows, no build tooling and no
product code. Those are not oversights and the bootstrap will not fill them either. An invariant
inherited from someone else's product is worse than a missing one: every agent in every session
reads it as true, and no check in the audit can tell that a plausible sentence describes a different
system.

## Honestly

This kit was extracted from a working project, and the extraction is younger than the model it
carries. The audit passes and every test passes. No ticket has yet run end to end through a clone —
so "the operating model works" is a claim about the origin, and about these files it is still a
claim about files. The first ticket through a fresh clone is the first real evidence.
