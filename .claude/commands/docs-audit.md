---
description: Run the documentation audit and report findings
---

Run `node scripts/check-docs.mjs` and report its output verbatim.

**Report only. Never fix.** A tool that repairs the thing it measures stops being a measurement, and
the repair it makes is the one nobody reviewed. Findings go to the operator.

| # | Check |
|---|---|
| D1 | Every feature ID referenced exists in `.ai/registry/features.md` |
| D2 | Every `INV-nn` referenced is in the ledger, or listed under `## Unissued IDs` |
| D3 | Every `RULE-nn` referenced exists in `.ai/registry/rules.md` |
| D4 | Every agent named in prose has a file in `.claude/agents/` |
| D5 | Every slash command referenced in a **human-owned** doc has a file in `.claude/commands/` |
| D6 | Every relative path mentioned in a **human-owned** `.ai/` doc exists on disk |
| D7 | Rules marked `verbatim_in:` match their copy character-for-character |
| D8 | No rule text appears near-verbatim elsewhere unless marked `verbatim_in:` — advisory |
| D9 | Every **human-owned** doc has front-matter, and its `governed_by` cites rules whose version is at most its `doc_version` |
| D10 | Every state in the `ticket.yaml` enum appears in the gate table, and the reverse |
| D11 | Every `ADR-nnn` referenced has a file in `.ai/registry/decisions/` |
| D12 | Every boundary declared in `.ai/registry/boundaries.json` still holds |
| D13 | Every Definition of Ready item names a producing stage at or before the gate |

D8 is advisory and never fails the run; it is a prompt for human judgement, because a paraphrase can
be a legitimate summary or a second source of truth and only a person can tell which.

Exit code 1 means at least one non-advisory check failed.

## Three checks are configuration-driven, and say so when they are unconfigured

A fresh repository has no features, no invariants and no declared boundaries. Rather than pass
silently — which is indistinguishable from a check that is broken — each of these prints a line
saying it checked nothing, and why.

**D1 reads the `id-prefixes` line in `.ai/registry/features.md`.** That is the complete list of
three-letter group prefixes the audit will police. **While it is empty, D1 checks nothing.** The line
exists rather than the prefixes being inferred from the rows, because inferring them would make an
entire unused group invisible: a document citing a reserved prefix that has no rows yet is exactly
the citation worth catching, and it was caught that way more than once in the origin project.

**D2 recognises deliberately unissued IDs.** An ID listed in the `## Unissued IDs` table of
`invariants.md` is valid to cite and never valid to use. The alternative was making the author write
the number in pieces to get past the audit, which is a check rewriting the prose it measures.

**D12 reads `.ai/registry/boundaries.json`, which ships with an empty list.** A boundary is an ADR
decision about what may depend on what, written so the audit enforces it instead of trusting somebody
to remember. Each entry can check three places, and the three are deliberately different in kind:

| Place | The finding is | Why |
|---|---|---|
| the dependency manifest | a package under the watched prefix that is not permitted | the SDK entering the tree is the fact |
| the lint config | the **absence** of a restriction, once such a package is in the tree | an inversion: unrestricted is the dangerous state |
| the source tree | an import of the prefix outside the exempt directories | this is the breach itself |

The lint list is a symptom; the dependency is the fact; an import outside the exemption is the breach.

**The lint branch is quieter than it looks, and this is deliberate rather than unnoticed.** It catches
an exemption written with a vendor-flavoured path, because that literal contains both halves it
matches on. It does **not** catch a seam path being added to an existing exemption block: that string
names no vendor, and telling it apart from a legitimate exemption beside it would mean parsing the
config's structure rather than scanning its strings. The source-tree branch covers the consequence
instead — a widened exemption is only dangerous once something uses it. **The guard can be loosened
silently; the door cannot be opened silently.**

Only string literals count. A comment explaining why a package is absent is not a second door, and a
check that fired on its own rationale would teach people to delete the rationale. This is a scanner
rather than a regular expression for a reason: stripping comments with a regular expression is wrong
on exactly the file it exists to read, because glob patterns and block comments share punctuation.

## D5, D6 and D9 share one scope, and it excludes the board

They read the registry plane, the standards, the templates, the charter and the operating model; D5
also reads all of `.claude/**`, which is human-authored configuration that no stage writes. Board
artifacts — tickets, stage artifacts, `backlog.md`, `metrics.md` — are agent output and belong to the
gates in `.ai/01-operating-model.md`, not to this audit. See "What a check may be scoped to" in
`.ai/standards/testing-standards.md`.

Each was narrowed after a real false positive, and all three are the same mistake:

- **D9** required `doc_version` on every `.md` under `.ai/`. The first story written hit it and had
  the three fields pasted in to clear the failure — satisfied rather than reported, which is what a
  check on agent output gets by default.
- **D5** read a route path in a design as a slash command with no definition. The agent reported the
  finding rather than renaming the route, which is the right behaviour and exactly the one not to
  design around.
- **D6** would report a design's `allowed_paths` as missing files. They are missing: creating them is
  the next stage's job, and the design naming them first is the point.

A narrowing fails by narrowing to nothing, so each has tests in both directions — the artifact that
must not be reported, and the same bytes under a human-owned path, which must be.

**D5's matcher is quieter than it looks.** Its token pattern excludes a trailing full stop, so a
command name written at the end of a sentence is invisible to it. This cuts false positives and is
deliberate, but a genuinely missing command written that way would not be caught.

## D6 is phase-aware, per scaffold root

`SCAFFOLD_ROOTS` in `scripts/check-docs.mjs` lists the directories the implementation will create.
**A path under a root that does not exist yet is reported as PENDING rather than as a failure**, and
becomes strict the moment that root appears on disk. That is per root, not global: a repository with
a source tree but no test tree gets strict checking on one and deferred checking on the other.

TODO(project): if the implementation source or the tests live somewhere other than `src/` and
`tests/`, change `SCAFFOLD_ROOTS` and `PATH_ROOTS` in `scripts/check-docs.mjs`, and `SOURCE_ROOTS` in
`.claude/hooks/guard-read-scope.mjs`. Those three constants are the only places a directory layout is
assumed.

**D11 exists because D6 cannot see an ADR.** D6 checks references written as paths; ADRs are cited by
ID. Without D11 a decision can be cited by several documents while the file recording it does not
exist — and since RULE-09 makes the ADR the only artifact that carries a human decision, the citation
reads as evidence of a decision that was never made. It scans `.yaml` under `.ai/` too, because a
ticket links its approved ADR in `schema_delta` and that link sits on the Definition of Ready.

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** It is not a footer on the reply —
for most runs it *is* the reply. Do not stop at the step above and leave the operator to work out who
answered, whether it passed, where the repository is, and what runs next.

This command writes no artifact and passes no gate, so the first line ends `gate n/a`. *Tiếp theo* names
whatever the board says runs next, **with the session it belongs in** — not a topic, a command.
Read the two values rather than recalling them:

```
date '+%Y-%m-%d %H:%M %Z'
git branch --show-current
```

A remembered timestamp or branch is the one part of this block that can be wrong while looking right.
