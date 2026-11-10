---
doc_version: 1
last_updated: 2026-09-01
governed_by: [RULE-03, RULE-04, RULE-08, RULE-15, RULE-16]
---

# Template: implementation log

Written by `developer` as `03-impl-log.md` in the ticket folder. Copy everything below the line.

**Gate:** typecheck and lint exit 0; every contract item in plan section 4 implemented; every file
touched appears in the table below with a one-line reason. The Definition of Done requires that list
to be complete — a file changed but not listed is an incomplete log, and R1 will find it anyway from
`git diff --name-only`.

**Sources:** `01-plan.md` first and in full, then the source tree within
`allowed_paths`.

**Standing alone:** RULE-16. The reviewer receives this file, the story, the design, and the diff —
and no message channel. Anything the reviewer needs in order to understand a decision has to be
written here. "As discussed" is banned and means nothing to a reader who was not in the room.

---

```yaml
---
ticket: <ID>
stage: IN_PROGRESS
agent: developer
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/01-plan.md, .ai/board/tickets/<ID>/ticket.yaml ]
consulted:
  - with: tech-lead-design
    asked: "..."
    answer: "..."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---
```

## Files touched

Every file, without exception. `created` or `modified`. The reason is one line and says why the
change was necessary, not what the diff already shows. The last column ties the file back to a
numbered item in plan section 4 — a file that satisfies no contract item is either scope growth or
a missing contract item, and both are worth catching here rather than at R5.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/...` | created | ... | §1 item `<n>` |
| `src/...` | modified | ... | §1 item `<n>` |

## Contract items

Each numbered item from plan section 4, and where it now lives. RULE-04: no field name appears in
the code that did not appear in the contract first. If one had to, it was a consultation and an
amendment, and both are recorded — in `consulted` above and in the design's own Changelog.

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| `<n>` | `file:line` | ... |

## Deviations from the design

Anything built differently from what section 1 through 7 specified, with the reason and the
consultation that authorised it. **An undeclared deviation is worse than a declared one**: declared,
it is a design amendment; undeclared, it is a defect the reviewer finds by diffing intent against
code, and it costs a rework cycle charged to this agent (RULE-08).

`none` is the expected answer and must be written explicitly.

## Invariants

Each ID in `invariants_touched`, with the reasoning that shows it still holds. Not "unaffected" —
the sentence that makes it obvious the case was considered. An invariant violation escalates to a
human on first occurrence and never enters rework (RULE-07); finding one here and stopping is a good
outcome.

| ID | Still holds because |
|----|---------------------|
| `INV-<nn>` | ... |

## Verification run

Commands actually executed, with exit codes. Not intentions.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck | 0 | the command named in `.ai/standards/testing-standards.md` |
| lint | 0 | same |
| unit tests | 0 | same |
| `git diff --name-only` subset of `allowed_paths` | yes/no | |

Those are R1 through R5 and R7 run early. Running them here is not duplicated effort — it is the
difference between one dispatch and three.

## Testability contract

Every selector from design section 6, and the file and line where it now exists. QA receives section
6 and never reads the implementation source (RULE-05), so a selector renamed in passing breaks the QA
gate with no way for QA to discover why.

| selector | Exists at |
|----------|-----------|
| `<id>` | `file:line` |

## Open questions

Anything unresolved that a reviewer should not have to rediscover. A question here is cheaper than a
rework cycle.
