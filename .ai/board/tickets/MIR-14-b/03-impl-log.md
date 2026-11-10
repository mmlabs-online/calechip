---
ticket: MIR-14-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-04T03:45:02Z
inputs_read:
  - .ai/board/tickets/MIR-14-b/01-plan.md
  - .ai/board/tickets/MIR-14-b/ticket.yaml
  - .ai/board/tickets/MIR-14/03-impl-log.md
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/170-multi-team-decisions.test.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/fixtures.ts
  - src/routes/PendingEntries.tsx
  - tests/pending-entries.test.ts
  - tests/entry-range-refusals.test.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/support/entry-form.ts
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-14-b — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261104090000_mir14b_entry_owners.sql` | created | the definer read that names a decider's owners and their active teams, with its grants | § 4.1 |
| `supabase/tests/180-entry-owners.test.sql` | created | pgTAP for AC-1 to AC-7, each assertion labelled `AC-n`, `plan(18)` | § 4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | the definer census names `public.list_entry_owners(uuid[])` | § 4.2 |
| `src/lib/domain/types.ts` | modified | `EntryOwnerTeam` and `EntryOwner`, appended; no existing type changes | § 4.3 |
| `src/lib/data/index.ts` | modified | `listEntryOwners(memberIds)` on `DataSeam`, and the `EntryOwner` import | § 4.4 |
| `src/lib/data/supabase.ts` | modified | `listEntryOwners` over the RPC, grouped by owner; module-private `EntryOwnerRow` | § 4.4 |
| `src/lib/data/mock.ts` | modified | `listEntryOwners` as a one-team mock models it | § 4.4 |
| `src/routes/PendingEntries.tsx` | modified | `owners` on the `ready` phase, read on first load and load more; name/avatar fall back to it; the teams line | § 4.5 |
| `.ai/standards/rbac-and-security.md` | modified | the one permission row of plan § 3 | § 3 |
| `tests/entry-owners.test.ts` | created | AC-8, AC-9 against both seams | § 4.6 |
| `tests/e2e/mir-14-b-worklist-teams.spec.ts` | created | AC-10 to AC-13 against the mock build | § 4.6 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `public.list_entry_owners(uuid[])` | `supabase/migrations/20261104090000_mir14b_entry_owners.sql:28-37` | Body is the plan's, verbatim. `revoke … from public, anon` and `grant … to authenticated` at :41-42 |
| 4.2 pgTAP | `supabase/tests/180-entry-owners.test.sql` | Part 1 T only (AC-2, AC-3 no-shared-team, AC-4, AC-7 bound); part 2 second-team row on U (AC-1, AC-3 second-team, AC-6 via `left_at`); part 3 demotion (AC-5); catalogue (AC-7) |
| 4.2 census | `supabase/tests/010-catalogue.test.sql:58-59` | under `-- MIR-14-b RPC, 180-entry-owners.test.sql` |
| 4.3 `EntryOwnerTeam`, `EntryOwner` | `src/lib/domain/types.ts:1264-1279` | |
| 4.4 seam declaration | `src/lib/data/index.ts:1148` | |
| 4.4 supabase | `src/lib/data/supabase.ts:3109-3140`, row type `:137` | De-dup, bound throw, `[]` before `client()`, `listEntryOwners failed: <message>`, grouped keeping row order. Also throws on a non-list body, the `listMembersForTeam` shape |
| 4.4 mock | `src/lib/data/mock.ts:3113-3147` | The three conditions of § 4.4, `teams` from the mock's `teams` store |
| 4.5 `owners` on `ready` | `src/routes/PendingEntries.tsx:196` | |
| 4.5 `reload` | `src/routes/PendingEntries.tsx:284-287` | inside the existing `try`, after the page and roster |
| 4.5 `loadMore` | `src/routes/PendingEntries.tsx:339-354` | only ids not in `owners` (`unresolvedOwners`, :200); a throw is the existing silent catch |
| 4.5 `ownerName` / `ownerAvatar` | `src/routes/PendingEntries.tsx:436-442` | roster, then `owners`, then the id / `""` |
| 4.5 teams line | `src/routes/PendingEntries.tsx:618-636` | the plan's TSX, after the dates line and before the note |
| 4.6 unit | `tests/entry-owners.test.ts` | |
| 4.6 e2e | `tests/e2e/mir-14-b-worklist-teams.spec.ts` | |

No field or function name appears that is not in plan § 4.

## Deviations from the design

1. **The e2e spec rewrites the served bundle to reach AC-11 and AC-13.** The mock's
   `listPendingEntries` and `listEntryOwners` admit the same owners and neither fails, so neither
   branch is reachable through the UI. `withOwnerHook` (`tests/e2e/mir-14-b-worklist-teams.spec.ts`)
   intercepts the JS asset with `page.route` and puts one guard at the top of `listEntryOwners`,
   driven by `globalThis.__mir14b` (`pass` records the ids asked for, `empty` names nobody, `throw`
   fails). It asserts the method matches exactly once, so a build that stops matching fails rather
   than passing vacuously. Nothing in `src/` carries a test hook. See *Delegated decisions* 1.
2. **AC-11's precondition (a removed owner) is not reproduced.** The mock never lists a removed
   member's entry (`memberTeamId` is null for them), so `empty` stands in for "the roster names the
   owner and `listEntryOwners` does not" — the branch AC-11 is about.

## Delegated decisions

1. **How to make AC-11 and AC-13 observable in the browser.** Options: (a) bundle rewrite in the
   spec; (b) a test-only switch in `mock.ts` (e.g. a `localStorage` key) — rejected, because the mock
   is also the build's fallback when `VITE_SUPABASE_URL` is unset, and it would ship a fault switch;
   (c) declare them unasserted, the ADM-04 precedent — rejected, the plan assigns them to e2e and (a)
   is cheap. Took (a).
2. **AC-12 is asserted with 51 entries through the form**, not declared unasserted as ADM-04 AC-4
   was. It runs in about ten seconds; 50 are `thanh`'s on consecutive weekdays from 2027-01-04 (the
   form disables weekends), the 51st is `linh`'s, last by start date, so the second page holds an
   owner the first did not. One test covers AC-12 and the load-more half of AC-13 so the 51 entries
   are created once.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-07` | The teams line shows the owner's active `membership` rows through `member_team_ids`, read when `/pending` loads — never stored (migration :31-33). A left team drops out on the next read (pgTAP AC-6). The absence count, roster and calendar are untouched: `listMembers`, `listPendingEntries` and every policy are unchanged, so no denominator moves. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 50 files, 1007 tests; `tests/pending-entries.test.ts` unedited (AC-14) |
| `pnpm exec playwright test tests/e2e/adm-04-worklist.spec.ts tests/e2e/adm-05-approve-reject.spec.ts tests/e2e/solo-pending-approval-ui.spec.ts tests/e2e/mir-14-b-worklist-teams.spec.ts` | 0 | 23 passed, 1 skipped (pre-existing `adm-04-worklist.spec.ts:323`); ADM-04's spec unedited (AC-14). Full e2e suite not run |
| `pnpm db:test` | 1 | **not executed**: `docker: command not found (podman also not found)`. The migration and `180-entry-owners.test.sql` have not run against PostgreSQL here; CI's `database` job runs the same command |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-14-b` | 0 | PASS — 11 paths, all carried by `allowed_paths` |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `pending-entry-row-teams` (with `data-team-ids`) | `src/routes/PendingEntries.tsx:620` |
| `pending-entry-row-team` (with `data-team-id`) | `src/routes/PendingEntries.tsx:628` |

Every other `data-testid` on the screen is unchanged.

## Open questions

- **The pgTAP file is unexecuted** (above). The reviewer should treat AC-1 to AC-7 as written, not
  run, until CI's `database` job reports.
- Plan § 2 Open question 1 (who shows `rejected_by` / `self_approved` on screen) is unchanged and not
  this ticket's.
