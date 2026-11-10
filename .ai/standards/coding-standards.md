---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-02, RULE-04]
---

# Coding standards

**What a coding standard in this repository is for.** It is read by the Developer before writing and
by the reviewer at R4 and R5. Every rule below either has a lint mechanism behind it or is a review
check; a rule that is neither is a preference and belongs in a code review comment, not here.

The sections marked `TODO(project):` are the ones no template can fill. They are not optional — the
Developer will invent an answer for each of them on the first ticket, and the invented answer becomes
the convention whether or not anybody agreed to it.

## Language

TODO(project): the compiler or interpreter settings that are non-negotiable, and the escape hatches
that are forbidden. Write them as things a reviewer can point at.

The shape that has held up:

- Strictest available type checking on, with no per-file opt-out.
- No escape valve used to silence the checker rather than to express something true. If a value can
  be absent, absence is handled.
- Exported functions carry explicit return types. Inference is fine internally; at a module boundary
  the type is documentation and a change detector.

## Naming

- Files, components, functions and variables each get one casing convention. TODO(project): state
  the three.
- **Data-access functions read as verbs against an entity** — `listOrders`, `getOrderById`,
  `createOrder`, `updateOrder`, `deleteOrder`. Every implementation of the seam uses the same names.
  This is what makes a seam swap a configuration change rather than a rewrite, and it is what the
  seam-parity test asserts.
- Booleans read as predicates: `isPrimary`, `canAssign`, `hasOwner`.
- No abbreviations that are not already in `.ai/registry/glossary.md`.

## Imports

TODO(project): the import convention, and the exact name of the lint rule that enforces RULE-02.

Two things are true whatever the stack:

- The rule enforcing RULE-02 is not to be disabled with an inline comment. A suppression on that rule
  is a review failure under R4 **regardless of the justification given** — if the justification is
  good, it belongs in an ADR that widens the rule, not in a comment that exempts one line.
- The seam has one door. A second import path into the datastore is the drift `.ai/registry/boundaries.json`
  and check D12 exist to catch; declare it there so the audit fails rather than a reviewer having to
  remember.

## The write path

Every entry point that mutates state, in this order:

1. Parse input with the schema named in design section 1
2. Check permission against the role model in design section 2
3. Call the seam
4. Return a typed result

Never return a raw error object to a client. Never trust a role passed in the payload.

TODO(project): replace step 1 and step 2 with the concrete mechanism — the validation library and the
permission helper — once they exist. The order does not change.

## Error handling

- Throw for programmer errors. Return a typed failure for expected ones — a duplicate name, a
  conflicting state, a permission denial.
- An invariant that cannot be satisfied is not an expected failure. It means state is already wrong,
  and per RULE-07 it escalates rather than being handled.
- Do not cache a value an invariant defines as derived. A cached copy is a second source of truth.

## Comments

Comments explain why, not what. A comment restating the line below it is noise. **A comment naming an
invariant ID at the point that upholds it is valuable**, because the next person to edit that line
will otherwise not know it is load-bearing.

No emoji in source files.

## Formatting

One formatter, with the project's lint config as the arbiter on conflict. Line endings are LF, fixed
by `.gitattributes`; do not configure an editor to override it.

## What not to do

- Do not add a dependency without an ADR. Check R9.
- Do not widen a function's responsibility because it was convenient. A function that both reads and
  writes cannot be reasoned about at the seam.
- Do not write a `TODO` without a `(verify)` or an owner. An unowned TODO is a comment.
