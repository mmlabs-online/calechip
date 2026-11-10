---
ticket: MIR-17-c
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-09T13:34:27Z
inputs_read:
  - .ai/board/tickets/MIR-17-c/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/registry/decisions/ADR-089-the-admin-screen-guards-go-through-the-role-helpers-first-and-the-rest-of-p4-2-is-mir-17-c.md
  - .ai/templates/plan.md
  - supabase/migrations/20261104090000_mir14b_entry_owners.sql
  - src/routes/PendingEntries.tsx
  - src/lib/roles.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-17-c — the approval worklist decides per row, per team

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:306`):

| ID | Feature | Group |
|---|---|---|
| MIR-17 | Client role checks take a team or org, every admin-only guard is replaced, and the router gains role guards | MIR |

**P4-2** (`.ai/board/plans/calechip-multi-tenancy-plan.md:239`): *"`mayAdminister`, `mayDecide`,
`mayDecideEntriesOf` all take a team or org parameter"*. **ADR-090 decision 1** (written at this PLAN)
narrows MIR-17-c to the worklist. A row's controls follow the database's per-team decider, read
through `listEntryOwners`. The rest of P4-2 is MIR-17-d.

**Who gains what.** A person who manages a team that is not their roster team can open *Pending
approvals* and decide that team's entries. Until now the screen refused them because their global
rank said *member*, even though the database would accept their decision (ADR-073 decision 2). For
everyone else the worklist behaves exactly as today, except that a row nobody on this screen may
decide says so truthfully.

`size_estimate: S` — one screen and one source-text test, plus the split's board overhead.

**Out of scope — and where each goes:**

- **The links that lead to the worklist** — `TopBar`'s pending link, `AdminLayout`'s strip and
  `AdminTabs`' manager tab — still ask the global rank. They go to **MIR-17-d** (ADR-090 decision 2).
- **`MemberList`, `EditEntry`, `EventEditor`, `EventDetail`, `EventAttendancePanel`, the picker,
  `Sidebar` and router guards** go to **MIR-17-d**.
- **`src/lib/roles.ts`** is unchanged. `mayDecideEntriesOf` stays, and the mock reads it.
- **The mock seam** models one team per person and is unchanged. It cannot show a second-team
  manager.
- **The decision itself** (`EntryDecision`, `approveEntry`, `rejectEntry`) is unchanged, and so is
  the database's refusal.

## 2. Acceptance criteria

Throughout: **Quan** is an admin and **Mona** a manager of T; **Thanh** is a member of T. AC-1, AC-2
and AC-4 are observed in the member app against the mock build. AC-3 and AC-5 are observed against
the source of `src/routes/PendingEntries.tsx`.

**AC-1 — today's deciders see today's worklist**
- When Quan, and then Mona, open `/entries/pending` with pending entries from T
- Then each sees the rows and the approve and reject controls they see today

**AC-2 — a member who may decide nothing is still refused**
- When Thanh opens `/entries/pending`
- Then he sees the screen's existing refusal (`pending-entries-refused`, or whichever id the refusal
  carries today) and no row

**AC-3 — a row's controls follow the per-team decider**
- When the worklist renders a row
- Then its approve and reject controls are drawn exactly when the row's owner is among the owners
  `listEntryOwners` returned for the loaded pages. The global rank alone never draws them

**AC-4 — a row nobody here may decide says so**
- Given a row whose owner the caller may not decide
- When it renders
- Then it shows `You cannot decide this entry.` in place of the controls (test id
  `pending-entries-own-entry`, unchanged)

**AC-5 — the screen admits a deciding rank, or anyone with something to decide**
- When the screen loads
- Then it refuses only a caller with no member row, or a caller whose rank is neither admin nor
  manager *and* who was returned no owner for the first page. In every other case it shows the
  worklist

**Invariants touched.** `[]`. No entry is written by this change, and the decision's own path and
its refusals are unchanged.

**Open questions.** None that block. A second-team manager reaches this screen by its address until
MIR-17-d re-keys the links (ADR-090 *Consequences*).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No layout changes. AC-4's sentence takes the place and style (`text-xs text-ink-3`) of the sentence
it replaces.

## 3. Permission model

No permission changes. The control is the database: `entry_update_admin`, `entry_update_manager` and
`entry_enforce_decision`, all through `may_decide_entry`. The screen's affordance now reads that same
rule per owner, through `list_entry_owners` (ADR-090 *Context*).

| Caller | Opens the worklist | Controls on a row |
|---|---|---|
| Admin | ✅ | when the owner shares an active team (the database's admin half) |
| Manager of the owner's team, primary or not | ✅ **new for a second team** | ✅ |
| Member who manages no team | ❌ refused | n/a |
| No member row | ❌ refused | n/a |

## 4. Contract

All changes are in `src/routes/PendingEntries.tsx`.

- **`:106`** — the import becomes `import { mayDecide } from "@/lib/roles";`. `mayDecideEntriesOf` is
  no longer used here.
- **`:252-265` (load)** — the `!mayDecide(me.role)` refusal before the reads moves after them. Keep
  `if (!me) { setView({ phase: "refused" }); return; }` first. After `owners` is computed (`:284-287`):

  ```ts
  if (!mayDecide(me.role) && owners.size === 0) {
    setView({ phase: "refused" });
    return;
  }
  ```
- **`:688`** — `mayDecideEntriesOf(view.me, entry.memberId)` becomes `view.owners.has(entry.memberId)`.
- **`:684-686` and `:692`** — the comment cites ADR-073 decision 3 and ADR-090. The sentence becomes
  `You cannot decide this entry.`.
- **`:194-196`** — the comment on `owners` says that it is also the set of decidable owners (ADR-090
  decision 1).

The `unresolvedOwners` and `withOwners` helpers are unchanged. They already request every owner on
each loaded page.

### 4.1 vitest — `tests/pending-decide-affordance.test.ts`

This is a source-text test of `src/routes/PendingEntries.tsx`, in the shape of
`tests/member-rpc-roster-team.test.ts`:

- **AC-3:** the source contains `view.owners.has(entry.memberId)` and does not contain
  `mayDecideEntriesOf(`;
- **AC-4:** it contains `You cannot decide this entry.` and not `Your own entry — an admin decides
  it.`;
- **AC-5:** the `mayDecide(me.role)` check appears after the `listEntryOwners(` call in the load
  function's text.

AC-1 and AC-2 are covered unchanged by the existing worklist specs (`adm-04`, `adm-05`, `mir-14-b`),
which run against the mock.

## 5. Seam impact

None. `listEntryOwners` is unchanged and already called with every page owner.

## 6. Schema delta

`none`. `list_entry_owners` already filters by `may_decide_entry` (ADR-090 *Context*). The ticket's
predicted RPC is not needed.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md"
  - ".ai/board/tickets/MIR-17-d/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "src/routes/PendingEntries.tsx"
  - "tests/pending-decide-affordance.test.ts"
```

`size: S`, from 5 paths, and `size_estimate` agrees. As ADR-089 described it, MIR-17-c was about 18
files, which is `L`, so the rest is MIR-17-d (ADR-090). MIR-20 now also depends on MIR-17-d.
`glossary_owed` is `[]`.

## 8. Rejected alternatives

- **A `list_my_team_roles()` RPC and a team-taking `mayDecideEntriesOf`.** Rejected in ADR-090:
  that is a second definition of `may_decide_entry` on the client.
- **Show only decidable rows.** Rejected: the server-side page counts and totals would no longer
  match what is drawn.
- **Keep the refusal before the reads.** It saves three reads for a plain member. Rejected: the
  refusal can only know "nothing to decide" after the owners are read.

## Changelog

- `2026-11-09T13:34:27Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from P4-2, ADR-073 and ADR-089 before the source tree was read for 3–8. Reading it found
  two things:
  - `list_entry_owners` already answers `may_decide_entry` for every page owner, which dropped the
    predicted RPC and the schema change;
  - the not-decidable sentence was false since ADR-073, which added AC-4.

  The rest of the ticket's scope moved to MIR-17-d (ADR-090). Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-090**: the worklist draws a row's controls when `listEntryOwners` returned its owner, and
  refuses only a caller with no deciding rank and nothing to decide. No new RPC. MIR-17-d is the
  rest of P4-2, and MIR-20 depends on it.
