---
doc_version: 3
last_updated: 2026-10-12
governed_by: [RULE-01, RULE-09]
---

# ADR-058 — `TSK` is a sixth feature group, for a member's own tasks

## Status

`ACCEPTED by product` — 2026-10-12, at `/triage` of
`.ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md`,
under ADR-008. The group was proposed by `tech-lead-design`, consulted, and chosen by `product`.

**This is `product`'s decision, not the operator's.** The operator did not name a prefix. It sits
inside an envelope already open: [ADR-057](ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md)
(`ACCEPTED by the operator`) creates a product area that did not exist, and ADR-028's step 2 assigns
a capability to a group *by area*. That is the shape
[ADR-046](ADR-046-evt-is-a-fifth-feature-group.md) used for `EVT`. It supersedes nothing: no issued ID
moves, and no group is redefined. The operator reviews it at merge under CODEOWNERS.

## Context

`.ai/registry/features.md` declares five groups (`CAL`, `ADM`, `TEA`, `UIE`, `EVT`) and says
*"Extending this set requires an ADR."* ADR-057 admits tasks: a member's own dated list, readable by
nobody else, two states, no time.

Against the existing groups, applying ADR-028's step 2 (a capability, filed by area):

- **`CAL`** is *"viewing, creating and editing entries, and the overload warning"*. A task is not an
  entry. It is not counted, is not approved, and is not seen by the team. Two of the four rows touch a
  `CAL` surface (the PTO form, the week view), but what each delivers is about tasks. Filing them here
  makes `CAL` mean *anything with a date*, the imbalance `features.md` already records.
- **`EVT`** is a gathering, who it is for and who is coming, which is shared by definition. A task is
  private by definition.
- **`TEA`** and **`ADM`** are membership and admin powers. ADR-057 denies admins this area outright.
- **`UIE`** is excluded by ADR-028 step 2 itself: a new capability's screen belongs to the
  capability.

## Decision

`TSK`, *Tasks — a member's own private, dated list*, becomes the sixth declared group. It is added
to the `<!-- id-prefixes: -->` line in `.ai/registry/features.md`, gains a row in the prefix table and
a `## TSK — Tasks` section, and its IDs are issued by `product` at triage (ADR-007). ADR-028's step 2
reads *"`CAL`, `ADM`, `TEA`, `EVT` or `TSK`, by area"*.

**All three edits land in the same change as the first `TSK` rows**, per ADR-028 § *Consequences*.

## Rationale

**Rejected: file tasks under `CAL`.** No ADR, and three of the four rows show on or beside a calendar
surface. It fails on the privacy line. Every `CAL` row is about something the team reads, and a
reviewer reading `CAL-nn` would assume the team-readable default that ADR-057 exists to deny.

**Rejected: file the PTO reminder (`TSK-03`) and the week badge (`TSK-04`) under `CAL` or `UIE` and
only the task page under a new group.** It splits one area across groups by which screen hosts it,
which is the test ADR-028 step 2 rejects.

## Consequences

- Six groups, one more thing `product` chooses between at triage. This one is by subject and easy to
  apply.
- **Handover** (direction B) and **recurring tasks**, both deferred by the operator as later ideas,
  will be `TSK` when they arrive. Handover is the first that would make a task visible to someone
  other than its owner, so it needs a new ADR superseding ADR-057 before it can be a row.
- `features.md` `doc_version` moves when the prefix lands.

## Revert condition

**The `TSK` table holds fewer than two `DONE` rows on 2026-12-31**, or the operator rejects this at
merge. Revert before any `TSK` row is issued means deleting the prefix, the table row and the section.
This ADR lands with four rows, so in practice nothing is renumbered: issued IDs keep their prefix, and
new task work is filed by a superseding ADR.

## Affected documents

| File | `doc_version` |
|------|---------------|
| `.ai/registry/features.md` | 4 → 5 — prefix line, prefix table, a paragraph recording the sixth group, and `## TSK — Tasks`, all written at this triage with the four rows |
| `.ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md` | none — its step 2 list is read as extended by this ADR, not edited |
