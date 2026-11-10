---
doc_version: 3
last_updated: 2026-10-20
governed_by: [RULE-01, RULE-09]
---

# ADR-063 — `MIR` is an eighth feature group, one row per multi-tenancy plan item

## Status

`ACCEPTED by the operator` — 2026-10-20, as the argument to `/thuki`, relayed verbatim to the
steward by the launching session (not quoted from a file). Recorded by the steward.

> **"ADR: MIR là group prefix + features.md rows MIR-01..21"**

The argument as relayed ends in a trailing *"—"* and may have been cut short. Nothing after it was
received, and nothing here is inferred from what it might have said.

Earlier the same day the operator placed the 21 MIR tickets on the backlog (*"tôi muốn start MIR"*),
and `orchestrator` recorded that they fail Definition of Ready items 1 and 6 and that *"the operator
chose the remedy the same day: an ADR registering `MIR` as a group prefix with a `features.md` row per
item, written by `/thuki`"* — `.ai/board/backlog.md`, the note under the *Ready* table. That note was
uncommitted when this ADR was written.

**What the operator's words settle:** `MIR` is a group prefix, and `features.md` carries rows
`MIR-01` to `MIR-21`. **What they do not settle**, and what this ADR therefore does not decide, is
listed under *Not decided here*. Two choices below are the steward's, not the operator's, and say so.

## Context

- **Every MIR ticket fails DoR items 1 and 6.** Each of the 21 MIR tickets under
  `.ai/board/tickets/` carries `feature_ids: []` and `group: ""`, with the comment
  *"MIR is a plan family, not a registry group — features.md: extending the prefixes needs an ADR"*.
  The DoR (`.ai/01-operating-model.md` § *Definition of Ready*) requires item 1, *"`feature_ids`
  non-empty, and every ID present in `.ai/registry/features.md`"*, and item 6, *"Exactly one feature
  group"*. `scripts/run-loop.mjs` `validateEntry` refuses a ticket with no `feature_ids`, so the
  runner cannot start any of them.
- **`features.md` declares seven groups** — `CAL ADM TEA UIE EVT TSK CICD` — and says *"Extending
  this set requires an ADR."*
- **MIR is already an ID family with its own rules.** `.ai/board/plans/multi-tenancy-status.md` §
  *The MIR family*: one ID per plan item, MIR-01 onward, in plan order; permanent once assigned;
  a cancelled item keeps its ID as `WONTDO`; the number does not imply execution order; new items
  are appended with the next free number. The IDs are embedded in migration and test filenames, and
  `.github/scripts/check-mir-tracking.mjs` keys on them.
- **The plan's subject is already accepted.** [ADR-059](ADR-059-calechip-becomes-multi-tenant-system-org-team.md)
  (`ACCEPTED by the operator`) makes CaleChip multi-tenant and names the MIR items that build it.
- **Unlike every other group, MIR is not a product area.** It is the items of one migration plan,
  and they cut across areas: MIR-01 rotates keys, MIR-05 stands up a test harness, MIR-16 splits a
  role. ADR-028 step 2 files a capability *by area*; MIR is filed *by plan*. The precedent closest
  to it is `CICD` ([ADR-059](ADR-059-delivery-work-is-a-seventh-feature-group.md)), the first group
  that is not a capability a role gains.

## Decision

1. **`MIR`, *Multi-tenancy — one row per item of the multi-tenancy migration plan*, is the eighth
   declared group.** It is added to the `<!-- id-prefixes: -->` line in `.ai/registry/features.md`,
   gains a row in the prefix table, a paragraph recording the eighth group, and a
   `## MIR — Multi-tenancy` section. *The expansion text is the steward's*, built from the title of
   `multi-tenancy-status.md` (*"Multi-tenancy — MIR status index"*) and its rule *"One ID per plan
   item"*. The operator named the prefix, not its expansion, and nothing on disk says what the three
   letters stand for; this ADR does not claim to know.
2. **Rows `MIR-01` to `MIR-21` are written in the same change**, one per existing ticket, `Status`
   `PLANNED`. Each `Title` is the `title` of that ticket's `ticket.yaml`, transcribed without
   paraphrase. Each `Notes` cell cites the ticket, its plan item and phase. `Invariants touched` is
   left empty: every MIR `ticket.yaml` carries `invariants_touched: []` as a template default, set at
   PLAN, and no MIR ticket has been planned.
3. **The MIR family's own rules govern the group.** IDs are issued in plan order when an item is
   appended to `multi-tenancy-status.md`, not by `product` at `/triage` and not from an idea file.
   This is the one place the group departs from `features.md` § *Status* (*"Rows arrive one at a time
   as ideas are promoted, written by `product` at `/triage`"*): no MIR item was promoted from an idea,
   and each ticket's header says so.
4. **`MIR-23` is listed under `## Unissued IDs`.** *The steward's choice, not the operator's.* Two
   board files use it as a worked example, not as an item: `.ai/board/plans/multi-tenancy-source.md:78`
   and `:85`, and `.ai/board/plans/feature-change-log.md:22`. Once `MIR` is a declared prefix, check D1
   reports both as citations of a feature that does not exist. Listing the token as unissued makes it
   citable and never usable, the arrangement `TEA-07` already has. The cost: if the plan grows to a
   twenty-third item, that item skips number 23. The alternative — rewriting the two examples to `MIR-nn` —
   edits one file that records the operator's own prompt verbatim, which the additive-only working
   agreement forbids. Either answer is reversible until a 23rd item exists.

## Not decided here

- **Whether `MIR` is a triage-time choice.** ADR-028 step 2 reads *"`CAL`, `ADM`, `TEA`, `EVT` or
  `TSK`, by area"* and is **not** extended by this ADR. A new multi-tenancy request arriving through
  `/idea` and `/triage` is filed by area as before, unless the operator decides otherwise.
- **Who writes `feature_ids` and `group` into the 21 `ticket.yaml`.** *Decided 2026-10-20 — see the
  paragraph after this one; the question as written at acceptance is kept.* DoR items 1 and 6 name
  `product` at BACKLOG, through `/triage` on PROMOTE of an idea file. No MIR ticket has one, so no
  command currently writes those two fields, and the steward does not write `.ai/board/tickets/**`.
  The rows this ADR lands are necessary for DoR and not sufficient.

  **Decided by the operator, 2026-10-20: the steward writes both fields into all 21 `ticket.yaml`,
  in one change** — `feature_ids: [MIR-NN]` and `group: MIR`, each ID the ticket's own. Asked in the
  orchestrator session who should write them, with three options — `tech-lead-design` by re-running
  `/plan`, the steward for all 21, or the operator by hand — the operator chose **"/thuki ghi cả 21
  ticket"** (relayed to the steward by the launching session, not quoted from a file). It is a
  deliberate, one-time exception to *"the steward does not write `.ai/board/tickets/**`"*, scoped to
  these two fields in these 21 files. It does not say who writes them for a MIR item appended later.
- **Whether a MIR row is `DONE` on merge like every other row.** `multi-tenancy-status.md` adds a
  `Verified` requirement for phases 0 and 3 before an item is `DONE` there. `features.md` `DONE`
  means merged into `main`. The two may disagree for a phase 0 or phase 3 item; which governs the
  registry row is not settled.

## Rationale

**Rejected: leave MIR outside the registry and exempt MIR tickets from DoR items 1 and 6.** It is
what the ticket comments assumed, and it is the larger change: it would amend the DoR for one family
and leave `run-loop.mjs` refusing the tickets. The operator chose the registry.

**Rejected: file each MIR item under the existing group it touches most.** MIR-16 is `TEA`, MIR-01 is
nothing, MIR-05 is nothing. The family's IDs are already in filenames and in a CI check; a second ID
per item would be two names for one thing.

## Consequences

- **Eight groups.** `features.md` `doc_version` 6 → 7.
- **D1 now polices every `MIR-nn` token** in every scanned document. All 22 distinct tokens on disk
  at the time of writing resolve: 21 to rows, `MIR-23` to the unissued table.
- **The rows are `PLANNED` and stay so until the ship that merges each item.** `/ship` writes the
  status, per ADR-023, as for every other row.
- **Every MIR ticket is still blocked** until its `feature_ids` and `group` are written — see *Not
  decided here*. *Resolved 2026-10-20: the steward wrote both fields into all 21 on the operator's
  decision recorded there. MIR-01's copy travels with that ticket's own uncommitted PLAN work on
  `feat/MIR-01`; the other twenty landed on `ops/mir-ticket-feature-ids`.*

## Revert condition

The operator rejects this at merge. Nothing has been issued against these rows yet, so a revert
before the first MIR ship deletes the prefix, the table row, the paragraph, the section and the
unissued entry, and the MIR tickets return to failing DoR. After a MIR ship, issued IDs keep their
prefix, as for every group.

## Affected documents

| File | `doc_version` |
|------|---------------|
| `.ai/registry/features.md` | 6 → 7 — prefix line, prefix table row, a paragraph recording the eighth group, `## MIR — Multi-tenancy` with 21 rows, and `MIR-23` under `## Unissued IDs` |
| `.ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md` | none — its step 2 list is deliberately not extended |
| each MIR `ticket.yaml` under `.ai/board/tickets/` | none — not the steward's to write; owed, see *Not decided here*. *2026-10-20: `feature_ids` and `group` written by the steward on the operator's decision recorded there* |
