---
ticket: MIR-14-b
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-04T10:48:55+07:00
inputs_read:
  - .ai/board/tickets/MIR-14-b/01-plan.md
  - .ai/board/tickets/MIR-14-b/03-impl-log.md
  - .ai/board/tickets/MIR-14-b/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20261104090000_mir14b_entry_owners.sql
  - supabase/tests/180-entry-owners.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/routes/PendingEntries.tsx
  - tests/entry-owners.test.ts
  - tests/e2e/mir-14-b-worklist-teams.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs <ID>` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-14-b/ticket.yaml:18-29` — `node scripts/check-allowed-paths.mjs` exited 0 (`allowed-paths: ticket MIR-14-b, 15 changed file(s) ... allowed-paths: PASS`); `node scripts/check-carry.mjs MIR-14-b` exited 0 (`check-carry: ticket MIR-14-b, 0 uncommitted path(s) / check-carry: PASS — nothing stray`) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 with 0 errors |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`) exited 0 with 0 errors across the repository |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/PendingEntries.tsx:103-104` imports only `seam` from `@/lib/data` and types from `@/lib/domain/types`; all datastore RPC and mock state access lives inside `src/lib/data/supabase.ts:3109-3140` and `src/lib/data/mock.ts:3113-3147` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261104090000_mir14b_entry_owners.sql:26-44`, `supabase/tests/180-entry-owners.test.sql:10-143`, `supabase/tests/010-catalogue.test.sql:58-59`, `src/lib/domain/types.ts:1264-1279`, `src/lib/data/index.ts:1148`, `src/lib/data/supabase.ts:137-143`, `:3109-3140`, `src/lib/data/mock.ts:3113-3147`, `src/routes/PendingEntries.tsx:196`, `:284-287`, `:341-355`, `:436-442`, `:618-636`, `tests/entry-owners.test.ts:26-84`, `tests/e2e/mir-14-b-worklist-teams.spec.ts:151-238` (`pnpm test` exited 0: 50 files, 1007 tests passed) |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261104090000_mir14b_entry_owners.sql:28-42` (`security definer set search_path = ''`, filtered row-by-row via `public.may_decide_entry((select auth.uid()), m.id)`, revoked from `public, anon`, granted to `authenticated`); `src/lib/data/mock.ts:3122-3133` (gates on `me.status === "approved" && me.removedAt === null && mayDecide(me.role)` and matching `teamId`); `.ai/standards/rbac-and-security.md:54` |
| R7 | No invariant violated (RULE-07) | PASS | `supabase/migrations/20261104090000_mir14b_entry_owners.sql:31-37`, `supabase/tests/180-entry-owners.test.sql:79-95`, `:106-117`, `src/routes/PendingEntries.tsx:618-636` |
| R8 | No dependency added without an ADR | PASS | `package.json:1-53` — `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; no dependency added or modified |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 Migration `public.list_entry_owners(p_member_ids uuid[])` + grants (`revoke all ... from public, anon`, `grant execute ... to authenticated`, wrapped in `begin; ... commit;`, header cites ADR-073 decisions 1, 7 and 9) | `supabase/migrations/20261104090000_mir14b_entry_owners.sql:4-10`, `:26-44` | Yes — verbatim SQL body, return signature `table (member_id uuid, display_name text, avatar text, team_id uuid, team_name text)`, `language sql stable security definer set search_path = ''`, and grants |
| § 4.2 pgTAP `supabase/tests/180-entry-owners.test.sql` covering AC-1 to AC-7 | `supabase/tests/180-entry-owners.test.sql:10-143` | Yes — `_isolation.psql`, `plan(18)`, `tests.seed()`, `rollback`, and labelled assertions for AC-1 through AC-7 |
| § 4.2 Definer census in `supabase/tests/010-catalogue.test.sql` | `supabase/tests/010-catalogue.test.sql:58-59` | Yes — adds `'public.list_entry_owners(uuid[])'` under `-- MIR-14-b RPC, 180-entry-owners.test.sql` |
| § 4.3 `EntryOwnerTeam` and `EntryOwner` in `src/lib/domain/types.ts` (additions only) | `src/lib/domain/types.ts:1264-1279` | Yes — exact interface names and fields (`id`, `name`; `memberId`, `displayName`, `avatar`, `teams: EntryOwnerTeam[]`) |
| § 4.4 Seam declaration `listEntryOwners(memberIds: string[]): Promise<EntryOwner[]>` in `src/lib/data/index.ts` | `src/lib/data/index.ts:17`, `:1148` | Yes — exact signature and arity 1 |
| § 4.4 Supabase implementation (`EntryOwnerRow`, de-duplication, `PENDING_PAGE_SIZE` bound throw, `[]` short-circuit, RPC call, error throw, grouping by `member_id` keeping team order) | `src/lib/data/supabase.ts:137-143`, `:3109-3140` | Yes — exact error messages and grouping into `EntryOwner[]` |
| § 4.4 Mock implementation (same bound and de-duplication, current member and owner checks, `teams` from mock `teams` store) | `src/lib/data/mock.ts:3113-3147` | Yes — matches all conditions and bound sentence |
| § 4.5 `PendingEntries.tsx` (`owners` on `ready` phase, `reload` inside `try`, `loadMore` with unresolved ids, `ownerName`/`ownerAvatar` fallback order, teams line TSX) | `src/routes/PendingEntries.tsx:196`, `:284-287`, `:341-355`, `:436-442`, `:618-636` | Yes — exact `data-testid="pending-entry-row-teams"`, `data-team-ids`, `data-testid="pending-entry-row-team"`, `data-team-id`, classes, and placement between dates line and note |
| § 4.6 Unit tests `tests/entry-owners.test.ts` (AC-8, AC-9) and E2E spec `tests/e2e/mir-14-b-worklist-teams.spec.ts` (AC-10 to AC-13) | `tests/entry-owners.test.ts:26-84`, `tests/e2e/mir-14-b-worklist-teams.spec.ts:151-238` | Yes — covers AC-8 and AC-9 in unit tests (both seams) and AC-10 through AC-13 in Playwright E2E |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| `INV-07` | Each entry's affected teams are derived at read time from the owner's active `membership` rows via `join public.team t on t.id in (select public.member_team_ids(m.id))` in `public.list_entry_owners(uuid[])`, never stored on `entry`. When a member leaves a team (`left_at` set), `member_team_ids` immediately excludes that team on the next read. `member_select_team`, `listMembers`, `listPendingEntries`, and `absenceCountsFor` are untouched, so no primary-team roster or absence count denominator changes. | `supabase/migrations/20261104090000_mir14b_entry_owners.sql:31-37`, `supabase/tests/180-entry-owners.test.sql:85-95`, `:106-117`, `src/routes/PendingEntries.tsx:618-636` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — all eight checks R1 through R8 pass. The ticket advances to `DONE`.
