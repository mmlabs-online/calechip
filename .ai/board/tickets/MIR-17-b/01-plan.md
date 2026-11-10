---
ticket: MIR-17-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-08T11:19:56Z
inputs_read:
  - .ai/board/tickets/MIR-17-b/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md
  - .ai/registry/decisions/ADR-088-issue-reports-leave-the-member-app-first-and-the-rest-of-p4-2-is-mir-17-b.md
  - .ai/templates/plan.md
  - src/lib/roles.ts
  - src/routes/AdminHub.tsx
  - src/routes/NewSignups.tsx
  - src/routes/Threshold.tsx
  - src/routes/Teams.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/Holidays.tsx
  - src/components/AdminLayout.tsx
  - tests/member-rpc-roster-team.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-17-b — the admin screens ask the role helpers, and a manager is labelled a manager on Teams

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:306`):

| ID | Feature | Group |
|---|---|---|
| MIR-17 | Client role checks take a team or org, every admin-only guard is replaced, and the router gains role guards | MIR |

**P4-2** (`.ai/board/plans/calechip-multi-tenancy-plan.md:240`, `:243`) names two of the items this
slice covers:

- *"Replace every `me.role !== "admin"` guard — `AdminHub`, `NewSignups`, `Threshold`, `Teams`, …
  `TeamEntries`, `Holidays`"*;
- *"`Teams.tsx:337` labels managers as "Member" — fix"*.

**ADR-089 decision 1** (written at this PLAN) narrows MIR-17-b to these two items. The rest is
MIR-17-c.

**Who gains what.** An org admin and a manager see exactly what they see today on the admin screens.
The one visible change is on *Teams*, where a manager is labelled *Manager* instead of *Member*. The
gain is that *may administer* is asked in one place, `mayAdminister`. When MIR-17-c makes the role
checks take a team, the admin screens follow without being edited again, and no screen can drift
from the others by spelling the test differently.

`size_estimate: M`. The work is six screens, one layout and one source-text test, plus the split's
board overhead.

**Out of scope — and where each goes:**

- **Per-team decide** (`mayDecide` and `mayDecideEntriesOf` taking a team, and the read of the
  caller's team roles) goes to **MIR-17-c**.
- **`MemberList`, `EditEntry`, `EventEditor`, `EventDetail` and `EventAttendancePanel`** go to
  **MIR-17-c**.
- **The viewed-team picker** (`viewed-team.ts`, `useViewedTeam.tsx`) goes to **MIR-17-c**.
- **`Sidebar` and `TopBar`** go to **MIR-17-c**.
- **Router role guards**, and the decision between intercepting at the route and the screens'
  in-place refusals, go to **MIR-17-c** (ADR-089 *Context*).
- **`src/lib/roles.ts` itself** is unchanged. `mayAdminister` and `mayDecide` already exist.
- **The seams and the mock** are unchanged.

## 2. Acceptance criteria

Throughout: **Quan** is an admin, **Mona** a manager, and **Thanh** a member. AC-1 to AC-3 are
observed in the member app against the mock build. AC-4 is observed against the source of
`src/routes/` and `src/components/`.

**AC-1 — each admin screen admits and refuses exactly whom it does today**
- When Quan, Mona and Thanh each open `/admin`, `/signups`, `/setting`, `/teams` and `/entries/team`
- Then Quan reaches each screen, and Mona and Thanh each see that screen's existing refusal, with
  the same test id and words as before this ticket

**AC-2 — Holidays offers its controls exactly as today**
- When Quan in Org public, Quan placed in the mock's dedicated org (MIR-15-e's
  `calechip.mock.dedicatedOrgMembers` switch), Mona and Thanh each open `/holidays/2026`
- Then only Quan in the dedicated org is offered add, edit and delete. Quan in Org public sees the
  *set by a system admin* line and no control. Mona and Thanh see neither — exactly as before this
  ticket (MIR-15-e AC-1 to AC-4, whose specs stay green unchanged)

**AC-3 — Teams labels each person by their role**
- Given Quan opens `/teams` and the roster holds an admin, a manager and a member
- When the rows are read
- Then their labels are `Admin`, `Manager` and `Member` respectively

**AC-4 — the seven files ask the helpers**
- When `AdminHub.tsx`, `NewSignups.tsx`, `Threshold.tsx`, `Teams.tsx`, `TeamEntries.tsx`,
  `Holidays.tsx` and `AdminLayout.tsx` are read
- Then none contains a comparison of `role` with the literal `"admin"` or `"manager"`. Each imports
  `mayAdminister` (and `mayDecide` where it asks that question) from `@/lib/roles`. `Teams.tsx`
  imports `ROLE_LABELS`

**Invariants touched.** `[]`. No data path changes.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen moves. The *Teams* row keeps its label span (`text-xs text-ink-3`), which now prints the
role's word. It carries no badge colour, because *Teams* never coloured it.

## 3. Permission model

There is no change. Every guard named here is an affordance (ADR-005), and each keeps its present
answer for every role:

| Screen | Admin | Manager | Member |
|---|---|---|---|
| `/admin`, `/signups`, `/setting`, `/teams`, `/entries/team` | ✅ | ❌ in-place refusal | ❌ in-place refusal |
| `/holidays` write controls | ✅ dedicated org only | ❌ | ❌ |
| `AdminLayout` badge read | ✅ | no read | no read |

The controls are the database's: `is_org_admin`, `may_decide_entry` and the holiday policies.

## 4. Contract

Each replacement is mechanical, and nothing else in these files changes:

| File | Line (2026-11-08) | Before | After |
|---|---|---|---|
| `src/routes/AdminHub.tsx` | `:72` | `!me \|\| me.role !== "admin"` | `!me \|\| !mayAdminister(me.role)` |
| `src/routes/NewSignups.tsx` | `:76` | `!me \|\| me.role !== "admin"` | `!me \|\| !mayAdminister(me.role)` |
| `src/routes/Threshold.tsx` | `:125` | `!me \|\| me.role !== "admin"` | `!me \|\| !mayAdminister(me.role)` |
| `src/routes/Teams.tsx` | `:81` | `!me \|\| me.role !== "admin"` | `!me \|\| !mayAdminister(me.role)` |
| `src/routes/Teams.tsx` | `:337` | `{person.role === "admin" ? "Admin" : "Member"}` | `{ROLE_LABELS[person.role]}` |
| `src/routes/TeamEntries.tsx` | `:82` | `me.role !== "admin"` | `!mayAdminister(me.role)` |
| `src/routes/Holidays.tsx` | `:181`, `:355` | `me?.role === "admin"` | `me !== null && mayAdminister(me.role)` |
| `src/routes/Holidays.tsx` | `:275` | `… && me.role === "admin" && …` | `… && mayAdminister(me.role) && …` |
| `src/components/AdminLayout.tsx` | `:143` | `role !== "admin"` | `!mayAdminister(role)` |

Imports: `import { mayAdminister } from "@/lib/roles";` in each file that lacks it. `Teams.tsx` also
gets `ROLE_LABELS`. `AdminLayout.tsx` already imports `mayDecide` from the same module.

A comment that explains a guard's choice (for example *"a manager is refused here too"*) stays, and
names the helper where it named the literal.

### 4.1 vitest — `tests/role-guards.test.ts`

This is a source-text test, the shape of `tests/member-rpc-roster-team.test.ts`. For each of the
seven files:

- the source has no match for `/\brole\s*(!==|===)\s*"(admin|manager)"/`, after `//` line comments
  and `/* … */` blocks are stripped;
- the source imports from `"@/lib/roles"`.

Plus, for **AC-3**: `Teams.tsx` contains `ROLE_LABELS[person.role]`.

## 5. Seam impact

None.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-089-the-admin-screen-guards-go-through-the-role-helpers-first-and-the-rest-of-p4-2-is-mir-17-c.md"
  - ".ai/board/tickets/MIR-17-c/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "src/routes/AdminHub.tsx"
  - "src/routes/NewSignups.tsx"
  - "src/routes/Threshold.tsx"
  - "src/routes/Teams.tsx"
  - "src/routes/TeamEntries.tsx"
  - "src/routes/Holidays.tsx"
  - "src/components/AdminLayout.tsx"
  - "tests/role-guards.test.ts"
```

`size: M`, from 11 paths, and `size_estimate` agrees. As ADR-088 described it, MIR-17-b was about 25
files, which is `L`, so the rest is MIR-17-c (ADR-089). MIR-20 now also depends on MIR-17-c.
`glossary_owed` is `[]`.

## 8. Rejected alternatives

- **Replace the guards and add router guards together.** Rejected: a router guard that intercepts
  replaces every screen's in-place refusal, which the e2e suite asserts. That design choice belongs
  to MIR-17-c, where it is made with the screens it affects.
- **Delete the screens' guards** and rely on the router. Rejected for the same reason, and because
  the in-place refusal says why (`src/App.tsx`, `/admin` route comment).
- **Give `mayAdminister` a team or org parameter now.** Rejected: it has one possible org on the
  client (ADR-088 decision 4). A team parameter needs MIR-17-c's team-role read before it can answer
  anything different.
- **An e2e test for AC-3.** Rejected for this slice: no fixture team holds a manager visible to
  `/teams` without new fixture data. The source-text test pins the label's source, and `ROLE_LABELS`
  is already used by `MemberList`.

## Changelog

- `2026-11-08T11:19:56Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from P4-2 and ADR-088 decision 2 before the source tree was read for 3–8. Reading it found
  two things:
  - 17 files still hold literal role tests, which led to the split to MIR-17-c (ADR-089);
  - `Holidays` spells the guard three times, which put `:181` and `:355` in § 4 beside the one P4-2
    named.

  Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-089**: MIR-17-b moves the admin screens' guards onto `mayAdminister` and fixes the Teams
  label. MIR-17-c is the rest of P4-2: per-team decide with its RPC, the entry, event and member
  affordances, the picker, `Sidebar` and `TopBar`, and router guards. MIR-20 depends on MIR-17-c.
