---
ticket: MIR-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-21T08:28:58+07:00
inputs_read:
  - .ai/board/tickets/MIR-04/01-plan.md
  - .ai/board/tickets/MIR-04/03-impl-log.md
  - .ai/board/tickets/MIR-04/99-questions.md
  - .ai/board/tickets/MIR-04/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md
  - git diff origin/main...HEAD
  - git status --porcelain (clean)
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

# MIR-04 — REVIEW

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted is stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (17 changed files, exit 0). `node scripts/check-carry.mjs MIR-04` → `check-carry: PASS — nothing stray`, 0 uncommitted paths, exit 0. The only path outside the list, `.ai/board/backlog.md`, is ship-owned (SHIP_OWNED) |
| R2 | typecheck exit 0, whole program | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint` over the 8 changed `.ts`/`.tsx` files exit 0. Repo-wide `pnpm exec eslint .` also exit 0, so no OPS chore is owed |
| R4 | Nothing outside the seam reaches the datastore (RULE-02) | PASS | `src/routes/EventDetail.tsx:39` and `src/routes/EventEditor.tsx:36` import only `@/lib/data`. The new call is `seam.listMemberDirectory()` at `src/routes/EventDetail.tsx:241`. The `no-restricted-imports` rule on `@supabase/*` is at `eslint.config.js:64-70`, and R3 is clean |
| R5 | Every § 4 contract item is implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | Admin, all teams: `supabase/migrations/20261020180000_mir04_scoped_member_directory.sql:29`, mock `src/lib/data/mock.ts:3355` (`eventIsAdmin`, `mock.ts:690-691`). Own team: migration `:31`. Connected people only: migration `:33-48`. No team → empty: migration `:24`, `mock.ts:3341`. No `anon` execute: migration `:52-53`. Invitee check unchanged: no edit to `save_event` or the policies (the diff touches neither). Picker affordance for non-admins: `src/routes/EventEditor.tsx:281-286`. A manager gains nothing, because `mayManageEvent` keys on `is_admin`, not on role (`mock.ts:699-700`) |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git log origin/main..HEAD -- package.json pnpm-lock.yaml` is empty. Neither file is in the diff |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 migration: the five-clause `create or replace`, the select list text kept, `begin/commit` | `supabase/migrations/20261020180000_mir04_scoped_member_directory.sql:16-55`. The clauses at `:29`, `:31`, `:33-39`, `:40-45`, `:46-48` match plan § 4.1 character for character | yes. `returns table (...)` is unchanged at `:19` |
| § 4.1 grants restated | `…mir04_scoped_member_directory.sql:52-53` | yes |
| § 4.1 header (ADR-066, supersedes ADR-045 D3, no policy, NOT VERIFIED line) | `…mir04_scoped_member_directory.sql:1-14` | n/a |
| § 4.2 real seam unchanged | `src/lib/data/supabase.ts` is not in the diff | yes |
| § 4.3 mock reproduces the five clauses, early return, filter, one row per id | `src/lib/data/mock.ts:3338-3383`. Helpers `mayManageEventId` at `:3342` and `attendanceVisibleTo` at `:3347-3352`, which equals `listEventAttendance`'s filter (`mock.ts:3541-3543`) minus the caller's own row. Comment rewritten at `:3333-3337` | yes, `listMemberDirectory(): Promise<DirectoryMember[]>` |
| § 4.4 doc comments only | `src/lib/data/index.ts:1354-1356`, `:1371-1375`. No signature change | yes |
| § 4.5 picker filter keyed on `initial.inviteeIds`, plus the comments | `src/routes/EventEditor.tsx:281-286`, deps at `:293`, comments at `:23-26` and `:272-275` | yes |
| § 4.5b `onInvited` re-reads the directory as the fifth `Promise.all` element | `src/routes/EventDetail.tsx:233` (comment), `:236-246`. `load()` is unchanged (`:180` predates this ticket) | yes, exactly as the plan's snippet |
| § 4.6 new test file, one `it` per row, names as written | `tests/member-directory-scope.test.ts:108`, `:120`, `:127`, `:137`, `:153`, `:170`, `:181`, `:197`, `:203`, `:210`, `:219`, `:244`. The no-policy assertion is at `:258` | yes. The AC-5 fixture deviation (teammate as the fellow invitee) is logged in `03-impl-log.md` and keeps the assertion falsifiable |
| § 4.6 `tests/events.test.ts` rename and re-assertion | `tests/events.test.ts:310-331` | yes |
| § 4.6 `evt-01` two tests re-aimed at `TEAMMATE` | `tests/e2e/evt-01-events.spec.ts:183-227`, `:233`, `:244` | yes |
| § 4.6 `evt-03` `inviteEmail` and "Named B" by email | `tests/e2e/evt-03-calendar-events.spec.ts:52-59`, `:76-78`, `:226-233` | yes |
| § 4.6 `evt-08` unchanged | not in the diff | yes |
| § 4.7 manual verification | `.ai/board/tickets/MIR-04/verification.md` exists. The operator has not yet filled in the results, which ticket.yaml `verification_required: true` makes a merge-time item, not a REVIEW check | n/a |

`pnpm exec vitest run`: 48 files, 908 tests passed, re-run at review time. The full Playwright run was
not repeated here. `03-impl-log.md` records 5 failures that it attributes to `HEAD` 6410b17 as well.
None of those 5 is in a file this ticket touches.

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04: one definition of the absence count, with `listMembers()` as its denominator | The ticket changes only the definer function `list_member_directory()`. It does not create, drop or alter any policy on `public.member`, and does not touch `listMembers()` or any absence-count code. The migration contains only the one `create or replace function` and its grants. `listMembers()` is asserted unchanged for C, X and an admin across a widening connection | `supabase/migrations/20261020180000_mir04_scoped_member_directory.sql:18-53`, `tests/member-directory-scope.test.ts:219-242`, `:258`. `src/lib/data/mock.ts` diff is confined to `:3333-3383` |

## Findings

None.

## Verdict

PASS.
