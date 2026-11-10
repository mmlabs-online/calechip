---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-005 — Authorization lives in row-level security, and there is no server

## Status

`ACCEPTED by the operator` — 2026-08-31.

**Amended 2026-10-08 by [ADR-051](ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md)**, `ACCEPTED by the operator`: one server-side component may exist, only to send event email, and it authorizes nothing. *"No server-side API is written"* below still holds for every read and write of product data. Text below unchanged.

Recorded, not authored. The operator's words, verbatim, in answer to a question that offered a
server-side seam as the alternative: *"sử dụng Auth của supabase hoàn toàn, Không cần Viết authen API
luôn."*

## Context

`.ai/standards/tech-stack.md` names Supabase as the datastore. The interface is a Vite single-page
application; there is no server component and none is planned.

That arrangement has a property worth stating plainly, because it decides this ADR: **the browser
talks to PostgREST directly, holding the user's own token.** Any check written in client-side
TypeScript can be skipped by calling the API with that token from anywhere else. A permission rule
enforced only in the seam is therefore an affordance, not a control — the exact thing
`.ai/registry/invariants.md` says is never sufficient.

`.ai/standards/architecture.md` requires **one** answer to where authorization lives, on the grounds
that two enforcing layers agree until they do not and the disagreement is invisible until a role is
added. This project has two candidate layers and had to choose.

The permission surface being chosen for is small: two roles, and members may write only their own
entries. `.ai/00-charter.md` carries the whole of it.

## Decision

**Supabase Auth provides authentication. Row-level security provides authorization, and is the only
mechanism that enforces it.** No server-side API is written.

The data-access seam remains, and remains mandatory under RULE-02 — but its job is typing, shaping
and a single import site for the client library, not enforcement. Any permission check that appears
in the seam is a user-experience affordance and must be commented as one.

Domain invariants are enforced in the database for the same reason: INV-01 becomes a PostgreSQL
exclusion constraint, INV-03 a check constraint, and INV-02 a trigger. A read-then-write check in the
client cannot hold any of them against two tabs.

## Rationale

The alternative considered was a thin server seam — every write through a Supabase Edge Function,
authorization in TypeScript, RLS enabled underneath as defence in depth with this ADR naming the
function authoritative.

It was rejected on two counts. First, **it does not remove the second layer, it adds a third**: RLS
still has to be on, or the database is open to any token holder, so the drift `architecture.md`
warns about would exist either way and would now span two languages. Second, the permission surface
does not justify it. *A member may write only their own entries; an admin may also approve, reject,
and edit the holiday calendar* is four policies of one line each. Re-expressing that in TypeScript,
deploying it, and keeping it in step with the policies underneath is real cost for no additional
guarantee.

The invariants pushed the same way. INV-01 wants a constraint that holds against concurrent writes,
which is a database feature and not an application one.

## Consequences

What becomes true:

- There is one enforcement point, and it is the one the attacker also has to go through.
- INV-01 through INV-05 are held by constraints and triggers rather than by convention.
- No deploy target beyond static hosting for the interface and the Supabase project itself.

**What becomes harder, and it is not trivial:**

- **Review checks R6 and R8 now read SQL.** A reviewer citing `file:line` for a permission decision
  cites a migration, not a TypeScript module. `.ai/standards/rbac-and-security.md` must present the
  role matrix in terms a policy can be compared against.
- **The permission-model test in `.ai/standards/testing-standards.md` can no longer be a unit test.**
  Asserting the truth table across every role, in both directions, means executing against a real
  PostgreSQL with a token per role. That is a slower test and a heavier local setup.
- **Migrations become the security surface.** RULE-09 already makes applying one permanently human;
  `.github/CODEOWNERS` should name the migrations directory the moment it exists, which its own
  `TODO(project)` already says.
- **A policy is easy to write and easy to get subtly wrong**, and a permissive one fails open and
  silently. The permission test asserting denials is the only thing that catches it.

## Revert condition

**The first permission requirement that cannot be expressed as an RLS policy without duplicating the
rule in application code.**

The brief's P2 list contains a plausible candidate: *"hai người này không được nghỉ cùng ngày"* —
role-based constraints between members. If that or anything like it arrives and the policy needs
state a policy cannot reach, this decision is wrong and a server seam supersedes it with a new ADR.

A second, weaker signal: if the permission-model test cannot be made to run in CI at all, the cost of
the chosen layer has exceeded what it bought.

## Affected documents

| File | Moves to |
|---|---|
| `.ai/standards/architecture.md` | `doc_version: 1` — written against this decision |
| `.ai/registry/boundaries.json` | gains the `supabase-client-in-seam` boundary |
| `.ai/registry/rules.md` | enforcement map names the lint rule for RULE-02 |
| `.ai/standards/rbac-and-security.md` | `TODO(project)` — the role matrix, stated so a policy can be compared to it |
| `.ai/standards/testing-standards.md` | `TODO(project)` — the permission-model test is an integration test, and its command belongs in the table |
| `.github/CODEOWNERS` | `TODO(project)` — add the migrations directory once it exists |
