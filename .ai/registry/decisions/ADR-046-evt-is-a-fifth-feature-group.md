---
doc_version: 3
last_updated: 2026-09-29
governed_by: [RULE-01, RULE-09]
---

# ADR-046 — `EVT` is a fifth feature group, for events

## Status

`ACCEPTED by product` — 2026-09-29, at `/triage` of
`.ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md`, under ADR-008.

**This is `product`'s decision, not the operator's.** The operator did not name a prefix. The idea
file, written with the operator present, left it to this stage in terms: *"None of CAL, ADM, TEA, UIE
fits cleanly; a new prefix is a `features.md` change that `/triage` proposes."* It sits inside an
envelope already open — ADR-045 (`ACCEPTED by the operator`) creates a product area that did not exist,
and ADR-028's step 2 assigns a capability to a group *by area* — and it supersedes nothing: no
issued ID moves, no group is redefined. The operator reviews it at merge under CODEOWNERS; if they
disagree, the revert below costs one prefix and one empty section, provided it happens before the
first `EVT` row is issued.

## Context

`.ai/registry/features.md` declares four groups — `CAL`, `ADM`, `TEA`, `UIE` — and says *"Extending
this set requires an ADR."* ADR-045 lifts charter refusals 4 and 5 and admits events: an announcement
with a scope, an invite list, an optional capacity, an optional approval mode and an optional
registration deadline, which members join and creators or admins decide.

Against the existing groups, applying ADR-028's test (step 2 — a capability, filed by area):

- **`CAL`** is *"viewing, creating and editing entries, and the overload warning"*. An event is not an
  entry, is not counted, and is not drawn on the grids (ADR-045 point 2). Filing it here makes `CAL`
  mean *anything with a date*, the imbalance `features.md:77` already records, made worse.
- **`TEA`** is *"members, roles, invitations and sign-in"*. Its *invitations* means joining the
  product (ADR-033). Filing event invitations under it gives one word two meanings inside one group.
- **`ADM`** is admin powers; most of this area is member-facing.
- **`UIE`** is excluded by ADR-028 step 2 itself: a new capability's screen belongs to the capability.

## Decision

`EVT` — *Events — announcing a gathering, who it is for, and who is coming* — becomes the fifth
declared group. It is added to the `<!-- id-prefixes: -->` line in `.ai/registry/features.md`, gains a
row in the prefix table and a `## EVT — Events` section, and its IDs are issued by `product` at
triage (ADR-007). ADR-028's step 2 reads *"`CAL`, `ADM`, `TEA` or `EVT`, by area"*.

**All three edits land in the same change as the first `EVT` row**, per ADR-028 § *Consequences*: the
declared prefixes and the `##` section headings are asserted to agree in both directions by
`scripts/tests/check-docs.test.mjs`, and D1 fails on a cited ID with no row.

## Rationale

**Rejected: file events under `TEA`.** Cheapest — no ADR — and the closest word match. It fails on the
word: *invitation* would mean both *let this person into the product* and *ask this person to lunch*,
and a reader of `TEA` rows could no longer tell a membership change from an event feature.

**Rejected: file events under `CAL`.** They have dates. So does everything; `CAL` would stop
distinguishing anything, and the operator explicitly kept events off the calendar (Q2).

## Consequences

- Five groups. A fifth thing `product` chooses between at triage, though this one is by subject and
  so easy to apply.
- **Email for events** (Q21, deferred) will also be `EVT` when it arrives — the area, not the
  mechanism, decides.
- `features.md` `doc_version` moves when the prefix lands.

## Revert condition

**The `EVT` table holds fewer than two rows on 2026-12-31**, or the operator rejects this at merge.
Before any `EVT` row is issued, revert is deleting the prefix, the table row and the section. After,
nothing is renumbered — issued IDs keep their prefix — and new event work is filed by a superseding
ADR.

## Affected documents

| File | `doc_version` |
|------|---------------|
| `.ai/registry/features.md` | 3 → 4 — prefix line, prefix table, a paragraph recording the fifth group beside ADR-028's, and `## EVT — Events` |
| `.ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md` | none — its step 2 list is read as extended by this ADR, not edited |
