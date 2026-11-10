---
ticket: MIR-17-e
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-09T15:44:48Z   # re-plan after REVIEW FAIL R5; first written 2026-11-09T15:04:44Z
inputs_read:
  - .ai/board/tickets/MIR-17-e/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md
  - .ai/registry/decisions/ADR-091-the-applications-manager-is-whoever-manages-a-team-and-the-rest-of-p4-2-is-mir-17-e.md
  - .ai/templates/plan.md
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - src/lib/roles.ts
  - src/routes/MemberList.tsx
  - src/routes/EditEntry.tsx
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/components/EventAttendancePanel.tsx
  - src/components/Sidebar.tsx
  - tests/role-guards.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-17-e — the entry, event and navigation affordances ask the role helpers

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:306`):

| ID | Feature | Group |
|---|---|---|
| MIR-17 | Client role checks take a team or org, every admin-only guard is replaced, and the router gains role guards | MIR |

**P4-2** (`.ai/board/plans/calechip-multi-tenancy-plan.md:240`, `:242`) says to *"replace every
`me.role !== "admin"` guard"*, and that *"`mayEditEvent` currently has no team comparison"*.
**ADR-092**, written at this PLAN, does three things:

- **decision 1** narrows MIR-17-e to the remaining entry and event components (four live sites; the
  fifth it named, `Sidebar.tsx:540`, is inside a comment, as the re-plan of 2026-11-09 found);
- **decision 2** answers the `mayEditEvent` bullet from the database rule;
- **decision 4** moves `MemberList`, the picker and router guards to MIR-17-f.

**Who gains what.** Nobody's screen changes. After this ticket, *may administer* is asked through
`mayAdminister` everywhere except `MemberList` and the picker (MIR-17-f). So the definition of the
admin affordance lives in one file, and a later change to it reaches the whole app.

`size_estimate: M`. The work is five components, the `roles.ts` comment and one test, plus the
split's board overhead.

**Out of scope — and where each goes:**

- **`MemberList`'s predicates and manager toggle**, which need a batched roster-team-role read, go
  to **MIR-17-f** (ADR-092 *Context*).
- **The viewed-team picker** (`viewed-team.ts`, `useViewedTeam.tsx`) goes to **MIR-17-f**.
- **Router role guards** go to **MIR-17-f** (ADR-089 *Context*).
- **A team comparison in `mayEditEvent`** is not added (ADR-092 decision 2).
- **The seams and the mock** are unchanged.

## 2. Acceptance criteria

Throughout: **Quan** is an admin, **Mona** a manager and **Thanh** a member. AC-1 to AC-3 are
observed in the member app against the mock build. AC-4 is observed against the source.

**AC-1 — editing an entry is offered exactly as today**
- When Quan, Mona and Thanh each open the edit screen of Thanh's entry
- Then each is offered exactly the controls and read path they are offered today: Quan as an admin,
  Mona and Thanh as non-admins (Thanh's own entry is his to edit)

**AC-2 — events are editable exactly by whom they are today**
- When Quan, the event's creator and another member each open an event
- Then the edit affordance appears for Quan and the creator, and not for the other member. The
  attendance panel's `named` branch behaves as it does today for an admin and a non-admin

**AC-3 — the sidebar is unchanged for every role**
- When Quan, Mona and Thanh are each signed in
- Then the sidebar shows each the same links as before this ticket

**AC-4 — the four components ask the helper, and the sidebar has no live literal test**
- When `EditEntry.tsx`, `EventEditor.tsx`, `EventDetail.tsx` and `EventAttendancePanel.tsx` are read
- Then none compares `role` with the literal `"admin"` or `"manager"` outside comments, and each
  imports `mayAdminister` from `@/lib/roles`
- And when `Sidebar.tsx` is read, it compares `role` with no such literal outside comments. It is not
  edited: its only occurrence (`:540`) is inside a JSX comment that has rendered nothing since UIE-10
  (*amended at the re-plan of 2026-11-09; review finding 1*)

**Invariants touched.** `[]`. No data path changes.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

There is no change. Each line below is an affordance (ADR-005), and its control is unchanged:

| Affordance | Control |
|---|---|
| `EditEntry` admin read path | `entry_update_admin` / `entry_delete_admin` (org admin sharing a team) |
| `EventEditor`, `EventDetail` *edit* | `may_manage_event`: creator with an active team, or org admin of the event's org |
| `EventAttendancePanel` `named` branch | `event_attendance` policies |
| `Sidebar` link set | each destination's own guard |

## 4. Contract

Mechanical replacements. Nothing else in these files changes:

| File | Line (2026-11-09) | Before | After |
|---|---|---|---|
| `src/routes/EditEntry.tsx` | `:88` | `me?.role === "admin"` | `me !== null && mayAdminister(me.role)` |
| `src/routes/EventEditor.tsx` | `:282` | `me?.role !== "admin"` | `!(me !== null && mayAdminister(me.role))` |
| `src/routes/EventDetail.tsx` | `:87` | `me.role === "admin"` | `mayAdminister(me.role)` |
| `src/components/EventAttendancePanel.tsx` | `:138` | `me.role === "admin"` | `mayAdminister(me.role)` |

Each file gains `import { mayAdminister } from "@/lib/roles";` unless it already has it. A comment
beside a replaced test that names the literal names the helper instead. `EventDetail.tsx:85`'s
comment cites ADR-092 decision 2 for *"creator, or admin"*.

**`src/lib/roles.ts:44-57`.** The `mayDecideEntriesOf` comment and the `eslint-disable` line's reason
say that the function is the mock's decider (`src/lib/data/mock.ts`), that the worklist decides per
owner through `listEntryOwners` (ADR-090), and that `ownerId` is unused. The code is unchanged.

**`src/components/Sidebar.tsx` is not edited.** It was listed here until the re-plan of 2026-11-09,
but its `:540` is inside a JSX comment (`:533-545`). Replacing it would add an import nothing uses,
which fails lint (review finding 1, `04-review.md`).

**`tests/role-guards.test.ts`.** `FILES` (`:20-28`) gains the four paths above and `Sidebar.tsx`. For
`Sidebar.tsx`, AC-4 requires only the no-literal-comparison case, which it already satisfies. The
describe's title says *"the twelve files"*. A new `it` asserts that `roles.ts` no longer contains *"kept for
MIR-17"*.

## 5. Seam impact

None.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-092-the-entry-and-event-affordances-ask-the-role-helpers-and-the-rest-of-p4-2-is-mir-17-f.md"
  - ".ai/board/tickets/MIR-17-f/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "src/routes/EditEntry.tsx"
  - "src/routes/EventEditor.tsx"
  - "src/routes/EventDetail.tsx"
  - "src/components/EventAttendancePanel.tsx"
  - "src/lib/roles.ts"
  - "tests/role-guards.test.ts"
```

`size: M`, from 9 paths (10 until the re-plan of 2026-11-09 removed `Sidebar.tsx`), and
`size_estimate` agrees. As ADR-091 described it, MIR-17-e was about 15
files with a migration, which is `L`. `MemberList`, the picker and router guards are MIR-17-f
(ADR-092). MIR-20 now also depends on MIR-17-f. `glossary_owed` is `[]`.

## 8. Rejected alternatives

- **Give `mayEditEvent` a team comparison**, as P4-2's bullet suggests. Rejected in ADR-092 decision
  2: the database compares none, so the client would hide an edit the database allows.
- **Include `MemberList`.** Rejected: its toggle needs a new read, which means an RPC and an ADR.
- **Delete `mayDecideEntriesOf`.** Rejected: the mock reads it for its decider, which is mock parity
  and not this ticket's to change.

## Changelog

- `2026-11-09T15:04:44Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from P4-2 and ADR-091 before the source tree was read for 3–8. Reading it found two things:
  - `may_manage_event` compares no team, which turned the `mayEditEvent` bullet into ADR-092
    decision 2 rather than a change;
  - `MemberList`'s toggle needs a read `Member` cannot give, which split it to MIR-17-f.

  Amended by `tech-lead-design`.

- `2026-11-09T15:44:48Z` — re-plan after REVIEW FAIL on R5 (`04-review.md` finding 1), raised by
  `tech-lead-review` and amended by `tech-lead-design`. `Sidebar.tsx:540`, which § 4 and AC-4 named
  as a live site, is inside a JSX comment. Its § 4 row is dropped, and AC-4 now requires the helper
  import of the four live files only. It asserts only that `Sidebar.tsx` has no literal comparison in
  code, which holds unchanged. `Sidebar.tsx` leaves `allowed_paths`, because the branch does not
  change it. ADR-092 *Context* is corrected to match. AC-1 to AC-3 are unchanged. That was a gap in
  this plan, which read the line without its surrounding comment, not a Developer defect.

## Delegated decisions

- **ADR-092**: the five entry, event and navigation components ask `mayAdminister`. `mayEditEvent`
  stays *"creator, or admin"*, which is the database's org-bounded rule. MIR-17-f takes
  `MemberList`, the picker and router guards, and MIR-20 depends on it.
