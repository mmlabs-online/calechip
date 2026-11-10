---
ticket: UIE-09
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-09T14:26:04+0700
inputs_read:
  - .ai/board/tickets/UIE-09/01-plan.md
  - .ai/board/tickets/UIE-09/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/steward/context.md
  - src/App.tsx
  - src/components/AppShell.tsx
  - src/components/TopBar.tsx
  - src/components/Sidebar.tsx
  - src/routes/Threshold.tsx
  - src/routes/YearOverview.tsx
  - src/lib/period.ts
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/fixtures.ts
  - eslint.config.js
  - ui-language.json
  - tests/e2e/adm-01-threshold.spec.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/cal-10-year-overview.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-09 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/AdminHub.tsx` | created | The hub screen: one seam read, four phases, five destinations declared once as data. | § 4.4, § 4.5, § 4.6 |
| `src/App.tsx` | modified | One import and one guarded route line for `/admin`. No existing route is re-addressed. | § 4.1 |
| `src/components/TopBar.tsx` | modified | The `isAdmin` prop, the `shell-admin-link` control, and the amended *IT TAKES NO PROPS* comment. | § 4.2 |
| `src/components/AppShell.tsx` | modified | Passes `member.role === "admin"` to the bar, in the file that already holds the member row. | § 4.3 |
| `tests/e2e/uie-09-admin-hub.spec.ts` | created | AC-1 to AC-12 through the interface. | § 2, § 4.5 |

`.ai/board/tickets/UIE-09/03-impl-log.md` — this file, in the ticket folder the path guard exempts.

**No other file in the tree changed.** `src/components/Sidebar.tsx` is untouched and so is every
existing spec file, which is the property the two-row split exists to buy — verified by
`git status --porcelain` and by the whole suite passing unedited (below).

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 the route | `src/App.tsx:387-390`, import at `:11` | Verbatim from the plan: guarded on `member`, `<Navigate to="/" replace />` otherwise. No children. |
| § 4.2 `TopBarProps` | `src/components/TopBar.tsx:63-69` | `isAdmin: boolean`, the only prop. |
| § 4.2 the control | `src/components/TopBar.tsx:210-214` | In the right cluster, between the switcher and `home-new-entry-link`, reusing `PILL_OUTLINE`. Outside the `nav !== null` condition, so it renders on every route inside the shell. |
| § 4.2 the amended comment | `src/components/TopBar.tsx:3-15` | `ticket.yaml` § 6's required sentence. The superseded wording is quoted rather than deleted, and the paragraph beside it says what the sentence was protecting — the *period* derivation — and that it is untouched. |
| § 4.3 the shell | `src/components/AppShell.tsx:41-49` | `AppShellProps` unchanged. The expression is the one `Sidebar.tsx:127` already uses. |
| § 4.4 the `View` union | `src/routes/AdminHub.tsx:34-38` | The four phases verbatim, in the order the plan gives them. |
| § 4.4 the seam call | `src/routes/AdminHub.tsx:100-110` | `seam.getCurrentMember()` and nothing else. |
| § 4.4 `DESTINATIONS` | `src/routes/AdminHub.tsx:52-88` | The five, in § 2b's order, with the plan's field names — `testId`, `to`, `name`, `blurb` — and the `blurb` placeholders filled with English copy. |
| § 4.4 no write function imported | `src/routes/AdminHub.tsx:23` | `import { seam } from "@/lib/data"` is the file's only data-layer import and `seam.getCurrentMember` its only member. |
| § 4.5 selectors | see the table below | All ten, all new. |
| § 4.6 copy | `src/routes/AdminHub.tsx:59-88`, `:139-150`, `:160-172`, `:180-211`; `TopBar.tsx:212` | English. `Admin` on the pill, `Admin` as the heading, one sentence beneath it, a name and one line per destination, `Back to the start` on the return link. |

## Deviations from the design

**One, and it is a resolution rather than a change of shape.**

**`admin-hub-link` is on the row element and the five individual ids are on the anchors inside it.**
§ 4.5 names `admin-hub-link` as *"every destination row, so the list can be counted"* and the five as
*"the five, individually"*, and one element carries exactly one `data-testid` — so the two names
cannot both sit on the anchor. The `<li>` is the row and carries `admin-hub-link`; the `<Link>`
inside it carries `admin-hub-pending-link` and its four siblings. This is the reading § 4.5's own
wording gives, and it is recorded here because the alternative — putting `admin-hub-link` on the
anchor and the specific id on the row — would make AC-4 click a list item rather than a link.

The row also carries `data-to`, which § 4.5 does not name. It is an attribute and not a selector: it
lets AC-3 assert the five ADDRESSES and their ORDER off the rows in one read instead of five, and
§ 2b's ordering claim has nothing else to hang on. Declared here as CAL-02 and CAL-03 declared
`data-created-at` and `data-updated-at` on `team-entry-row` for the same reason.

Everything else in § 4.1 to § 4.6 is built as written.

**`view.me` is held and not read.** § 4.4 declares `{ phase: "ready"; me: Member }` and the ready
screen renders nothing from the member row, so the field is carried and never used. It is kept
because it is the contract and because the same union in `Threshold.tsx:48` carries `me` on the same
terms; it is named here so a reviewer does not have to decide whether it was an oversight.

## Invariants

`invariants_touched: []`, and 01-plan.md § 2 reasons through every ID rather than dismissing them as
a group. What the implementation adds to that reasoning is that it is now checkable rather than
predicted:

| ID | Still holds because |
|----|---------------------|
| INV-01, INV-02, INV-03, INV-06 | No entry is created, edited, approved, rejected or read anywhere in this ticket. `src/routes/AdminHub.tsx` imports no entry type and calls no entry function; the other three files changed by one prop, one route line and one control. |
| INV-04, INV-05 | No count is computed, displayed or passed. `src/lib/data/absence.ts` is imported by none of the four files — the hub renders five constant strings and five constant addresses (`AdminHub.tsx:52-88`). |
| INV-07 | `/members` becomes two clicks from any screen for an admin, and what may be DONE there is unchanged: TEA-04's writes are refused by `member_update_admin` for anybody who is not an admin whether they arrive by link or by keyboard, and this ticket ships no migration and no policy. The exposure changes; the invariant does not. 01-plan.md § 3 states it on its own terms. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, the command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | lint, same. Covers AC-12 at the source level and RULE-02's `no-restricted-imports` |
| `pnpm exec vitest run` | 0 | 12 files, 208 tests, all pass. None edited |
| `pnpm exec playwright test` | 0 | **197 tests in 19 spec files, all pass.** 184 before this ticket, 13 added here, and **no existing spec file was edited** — which is the two-row split's defining property, measured rather than asserted |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, ticket UIE-09 |
| `git diff --name-only` subset of `allowed_paths` | yes | `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/TopBar.tsx` modified; `src/routes/AdminHub.tsx`, `tests/e2e/uie-09-admin-hub.spec.ts` new. `src/components/Sidebar.tsx` untouched |

**The testing-standards table records 171 e2e tests as of 2026-09-08 and the suite now holds 197.**
That file is not in `allowed_paths` and this ticket does not edit it. It is noted here because
that table has gone stale twice and the standard itself asks for it to be corrected the moment the
number moves — a chore for the session that owns that path, not for this one.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `shell-admin-link` | `src/components/TopBar.tsx:211` |
| `admin-hub` | `src/routes/AdminHub.tsx:179` |
| `admin-hub-loading` | `src/routes/AdminHub.tsx:126` |
| `admin-hub-refused` | `src/routes/AdminHub.tsx:138` |
| `admin-hub-unavailable` | `src/routes/AdminHub.tsx:159` |
| `admin-hub-link` | `src/routes/AdminHub.tsx:195` (the row; five of them, plus `data-to`) |
| `admin-hub-pending-link` | `src/routes/AdminHub.tsx:59`, rendered at `:197` |
| `admin-hub-team-entries-link` | `src/routes/AdminHub.tsx:65`, rendered at `:197` |
| `admin-hub-members-link` | `src/routes/AdminHub.tsx:71`, rendered at `:197` |
| `admin-hub-allow-list-link` | `src/routes/AdminHub.tsx:77`, rendered at `:197` |
| `admin-hub-threshold-link` | `src/routes/AdminHub.tsx:83`, rendered at `:197` |
| `admin-hub-back` | `src/routes/AdminHub.tsx:148`, `:170`, `:209` — one per phase, so exactly one on any page |

No `home-*` id is added, moved, renamed or removed. AC-9 asserts this from the rendered page rather
than from the diff.

## Open questions

1. **AC-8's failing read is asserted negatively, and the log says so rather than the suite implying
   otherwise.** The mock seam cannot be made to throw on demand, so what
   `tests/e2e/uie-09-admin-hub.spec.ts` proves is that `admin-hub-unavailable` is absent when the
   read SUCCEEDED and absent when the caller was REFUSED — which is the half of AC-8 that matters,
   that a denial and a transport failure are different screens. Nothing here claims to have exercised
   a throwing read. This is the reading `cal-04`, `cal-05`, `adm-02`, `adm-04` and `cal-10` all
   already take, and `cal-10`'s header states it in terms.

2. **The double exposure is live and it is deliberate.** While this row ships, an admin sees the four
   `home-*-link` admin links in the sidebar AND the five destinations on the hub, and AC-10 asserts
   exactly that. It is the cost of the additive half; UIE-10 is the migration that removes it.

3. **`ticket.yaml` read `state: BACKLOG` when this stage started, and it now reads `REVIEW`.**
   Nothing is wrong with PLAN: `.claude/commands/plan.md:114` tells it to set nothing about state and
   it set nothing, and `gates.plan` is `orchestrator`'s to fill at /ship from the artifacts'
   front-matter — ADM-04's shell records that convention in terms, so `passed: false` there is
   correct and is deliberately left alone. What did not happen is `/next-ticket`, which grades the
   Definition of Ready and moves BACKLOG -> READY: `/implement` was invoked directly on the branch
   `/plan` had already created. So this ticket's READY and IN_PROGRESS transitions happened in fact
   and were never written down. `.claude/commands/implement.md:60` makes the move to REVIEW the
   Developer's, and it was made — the comment above the field says what value it replaced, so the
   skipped grading is visible at /ship rather than inferred from a state that looks orderly.
