---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-09]
---

# ADR-014 — A policy-only migration is not `schema_delta: none`

## Status

`ACCEPTED by the operator` — 2026-08-31.

Recorded, not authored. Asked whether a migration that adds only a row-level security policy, and no
column, counts as `none`. The operator chose *"Không phải none — policy cần ADR"*, with the cost
stated in front of them: nearly every `TEA` and `ADM` ticket will now need an ADR.

## Context

Definition of Ready item 4 requires `schema_delta` to be `none`, or an approved ADR to be linked. Four
feature rows were waiting on what `none` means when a migration changes no table shape.

The literal reading is available and defensible: `schema_delta` describes the schema, a policy is not
a column, therefore `none`.

**ADR-005 is what makes the literal reading wrong here.** With no server, row-level security is not
one control among several — it is the entire authorization model. A policy is the security surface,
and `.ai/standards/rbac-and-security.md` records as its first known weakness that a policy written
too permissively **fails open and silently**: no error, no log, just data that should not have been
returned.

Under the literal reading, that change passes the one gate in the loop positioned to stop and look at
it, because the ticket declares `none` and nothing is linked.

## Decision

**A migration that creates, alters or drops a row-level security policy is not `schema_delta: none`.**
It needs an approved ADR linked before the ticket can pass the Definition of Ready.

This holds regardless of what the policy does. A `select` policy was considered for exemption and
rejected: a permissive `select` is precisely how data leaks, and a rule with a carve-out is a rule
whose carve-out gets argued at the gate.

The same applies to a trigger or a constraint that enforces an invariant, for the same reason — under
ADR-005 those are where the invariants live, so they carry the weight application code used to.

## Rationale

The alternative was the literal reading, which is faster and would have unblocked four rows with no
further work. It was rejected because it removes the only stop between a permission change and a
merged pull request, at a point in the model where nothing else is looking.

A middle option — `select` policies are `none`, write policies are not — was rejected as a rule with
an exception nobody will remember correctly under time pressure, protecting the case that matters
least.

## Consequences

- **Most `TEA` and `ADM` tickets now need an ADR.** This is the cost and it was accepted knowingly. It
  is not small: it puts a written decision in front of every permission change.
- The ADR requirement lands at Definition of Ready, which is *before* DESIGN — so the reasoning is
  written before the policy is, not after.
- **A ticket carrying only a `select` policy pays the same price as one granting `delete`.** That is
  deliberate, and it will feel disproportionate at least once. The alternative was a distinction
  drawn at the gate under time pressure.
- Tickets that only read and render are unaffected and stay `none`.

**Correction, 2026-08-31, same day.** This line originally read *"CAL-04 through CAL-07 add no policy
and stay `none`"*. That was false when written: CAL-04's own registry note says it **owns the `team`
select policy and the grant it needs**, and that note had already been read by the steward earlier in
the same session. The exemption was written from a general belief about read-and-render rows instead
of from the four rows it named.

It is corrected here rather than quietly rewritten, because an ADR is what everything downstream
treats as settled — a wrong fact inside one is more expensive than the same fact wrong anywhere else,
and naming no ticket is what makes this line safe to rely on.

## Revert condition

**The first ADR written under this rule that says nothing a reviewer could disagree with.** If three
consecutive policy ADRs read as paperwork — restating what the policy does with no alternative
considered and no revert condition worth having — the requirement is producing documents rather than
decisions, and the `select` carve-out becomes the better trade after all.

## Affected documents

| File | Change |
|---|---|
| `.ai/01-operating-model.md` | Definition of Ready item 4 states what `none` excludes |
| `.ai/registry/features.md` | The four rows waiting on this are unblocked |
