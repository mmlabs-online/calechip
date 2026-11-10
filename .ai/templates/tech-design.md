---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-02, RULE-03, RULE-04, RULE-05, RULE-09, RULE-14, RULE-16]
---

# Template: tech design

> **RETIRED — ADR-019.** `02-design.md` and the DESIGN stage no longer exist; both were merged into `01-plan.md`, and the
> template for it is `.ai/templates/plan.md`. This file is kept, not deleted, so a ticket
> shipped before 2026-09-01 can still be read against the template it was written from.
> Do not write a new artifact from it.


Written by `tech-lead-design` as `02-design.md`. Copy everything below the line.

**Gate:** all seven sections complete; `allowed_paths` enumerated and written back to `ticket.yaml`.

All seven are required. A section answered "none" is complete; a section left out is not, and the two
are different because "none" is a decision and an omission is a gap nobody noticed.

---

```yaml
---
ticket: <ID>
stage: DESIGN
agent: tech-lead-design
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/01-story.md, .ai/registry/invariants.md, .ai/standards/architecture.md ]
consulted:
  - with: ba
    asked: "..."
    answer: "..."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: IN_PROGRESS
---
```

## 1. Contract

Exact entry-point signatures, input schemas, and return types (RULE-04).

Exact means copy-pasteable. Every field name that will appear in the code appears here first, because
the Developer may not invent one, and a name invented at implementation time propagates into the DTO,
the mock, the datastore mapping, the schema, and the selectors before anyone reviews it.

```
// signatures, schemas, and return types, in the project language
```

## 2. Permission model

Which role gate applies to each action and each control, against
`.ai/standards/rbac-and-security.md`. Include the denials. State where the check lives — on the
server side of the boundary, always, with any interface-level gate as an affordance only.

## 3. Seam impact

Which functions in the data-access seam change, or "none". If a new function is added it appears in
every implementation of the seam with the same name and arity, or the seam-parity test fails.

## 4. Schema delta

`none`, or a description plus a link to an ADR. Anything other than `none` without an approved ADR
fails Definition of Ready, and applying a migration is human-only (RULE-09).

## 5. allowed_paths

An explicit glob list, written back into `ticket.yaml`. This is what
`.claude/hooks/guard-allowed-paths.mjs` reads and what review check R1 and CI check against.

```yaml
allowed_paths:
  - "src/..."
  - "tests/..."
```

Enumerate. A glob broad enough to be convenient is a glob broad enough to make R1 meaningless.

## 6. Testability contract

Every test selector, with the element it identifies. The attribute is named once in
`.ai/standards/testing-standards.md`.

RULE-05 makes this the only channel through which selectors reach QA. A control missing from this
table does not exist as far as QA is concerned, and check R7 verifies the reverse: every selector
here exists in the markup.

| selector | Element | Used by |
|---|---|---|
|  |  | AC-n |

## 7. Rejected alternatives

At least one, with the reason it was rejected. Not a strawman — an approach that was genuinely
plausible.

This section is what makes the design reviewable. A design with one option presented is a design
whose reasoning cannot be checked, only agreed with.

## Changelog

- `<ISO8601>` — section `<n>` `<what changed>`. Raised by `<agent>`. Amended by `<agent>`.
