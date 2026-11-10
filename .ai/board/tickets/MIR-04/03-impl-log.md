---
ticket: MIR-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-21T08:22:29+07:00
inputs_read:
  - .ai/board/tickets/MIR-04/01-plan.md
  - .ai/board/tickets/MIR-04/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - tests/events.test.ts
  - tests/e2e/evt-01-events.spec.ts
  - tests/e2e/evt-03-calendar-events.spec.ts
  - tests/e2e/evt-08-event-invitation.spec.ts
  - .ai/board/tickets/MIR-03/verification.md
consulted:
  - with: tech-lead-design
    asked: "Two e2e failures caused by MIR-04 need files outside allowed_paths: (1) evt-08-event-invitation.spec.ts:178, where an invitee added by email draws as Former member because EventDetail.tsx onInvited() does not re-read listMemberDirectory(); (2) evt-03-calendar-events.spec.ts:210, which names another team's member through the picker, which AC-10 now forbids. Add src/routes/EventDetail.tsx and tests/e2e/evt-03-calendar-events.spec.ts?"
    answer: "Both granted as proposed. § 4.5b: onInvited re-reads the directory as a fifth Promise.all element. § 4.6: evt-03 'Named B' is named by email through event-form-invite-input. Both paths added to allowed_paths. size stays M."
    resulted_in_amendment: true
chat_before_verdict: "one round: 99-questions.md, developer → tech-lead-design, 2026-10-21"
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-04: implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261020180000_mir04_scoped_member_directory.sql` | created | Replaces `list_member_directory()` with the five-clause predicate and restates the grants. The file was already in the tree from an earlier, unfinished run of this stage; it was checked line by line against § 4.1 and is identical | § 4.1 |
| `.ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md` | modified | Adds the supersession note for the picker clause of Decision 3, under § Status only. Already in the tree from the same earlier run; checked and kept | § 6 |
| `src/lib/data/mock.ts` | modified | The mock `listMemberDirectory()` now reproduces the five clauses, through the local helpers `mayManageEventId` and `attendanceVisibleTo` | § 4.3 |
| `src/lib/data/index.ts` | modified | Two doc comments say what the directory now returns. No signature changes | § 4.4 |
| `src/routes/EventEditor.tsx` | modified | The picker offers a non-admin only their own team, plus anyone in `initial.inviteeIds`. The header and the `groups` comment are rewritten | § 4.5 |
| `src/routes/EventDetail.tsx` | modified | `onInvited()` re-reads the directory, so an invitee whose name only the invite admits resolves without a reload | § 4.5b (added by amendment) |
| `tests/member-directory-scope.test.ts` | created | One `it` per row of the § 4.6 table, plus the static read of the migration | § 4.6 |
| `tests/events.test.ts` | modified | The superseded AC-10 test is renamed and re-asserted for own team, with a dated comment line | § 4.6 |
| `tests/e2e/evt-01-events.spec.ts` | modified | The two picker tests are re-aimed at `TEAMMATE` | § 4.6 |
| `tests/e2e/evt-03-calendar-events.spec.ts` | modified | "Named B" is named by email (new optional `inviteEmail` on `createEvent`) instead of by a picker click | § 4.6 (added by amendment) |
| `.ai/board/tickets/MIR-04/99-questions.md` | created | The consultation above | n/a |
| `.ai/board/tickets/MIR-04/verification.md` | created | Manual verification steps. The operator fills in the results | § 4.7 |
| `.ai/board/tickets/MIR-04/03-impl-log.md` | created | This file | gate |
| `.ai/board/tickets/MIR-04/ticket.yaml` | modified | Developer: `chat_budget` used 0 → 1 (`chat-guard.mjs` did not count the Write) and state → REVIEW. `allowed_paths` +2 was written by `tech-lead-design` | n/a |
| `.ai/board/tickets/MIR-04/01-plan.md` | modified | Written by `tech-lead-design`, not by the developer: § 4.5b, § 4.6, § 7 and the Changelog | n/a |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 migration | `supabase/migrations/20261020180000_mir04_scoped_member_directory.sql:17-55` | Matches the plan's SQL exactly. The select list text is unchanged |
| 4.2 real seam | none | No change, by contract |
| 4.3 mock | `src/lib/data/mock.ts:3333-3383` | The early `memberTeamId(uid) === null → []`, the approved/not-removed/has-team filter and the one-row-per-id rule are kept |
| 4.4 seam interface | `src/lib/data/index.ts:1354-1356`, `:1371-1376` | Comments only |
| 4.5 screen | `src/routes/EventEditor.tsx:21-27`, `:272-293` | Keyed on `initial.inviteeIds` and added to the `useMemo` deps. The invitee check is untouched (Q2 B) |
| 4.5b detail re-read | `src/routes/EventDetail.tsx:229-252` | `load()` and the `catch` are unchanged |
| 4.6 tests | `tests/member-directory-scope.test.ts`, `tests/events.test.ts:310-331`, `tests/e2e/evt-01-events.spec.ts:183-226`, `:229-243`, `tests/e2e/evt-03-calendar-events.spec.ts:50-76`, `:226-233` | `evt-08-event-invitation.spec.ts` is unedited and passes |
| 4.7 verification | `.ai/board/tickets/MIR-04/verification.md` | `save_event` argument names were checked against `20260929140000_evt02_attendance.sql:150-160` |

## Deviations from the design

- **AC-5's fellow invitee is on team T, not team U.** `tests/member-directory-scope.test.ts`, the AC-5
  `it`. AC-5 describes Z2 as "of team U". With Z2 on U, own-team clause (b) lists Z to Z2 anyway, so
  "not, by that clause" would assert nothing. The test therefore names `TEAMMATE` (team T) as the
  fellow invitee. AC-5's clause stays the same; only the test fixture differs so the assertion can
  fail. The same `it` also covers the by-email path that AC-5 names.
- **The AC-3 positive half also admits X through clause (e).** X's public event notifies C, so C is
  connected to X by a notification as well as by being able to read X's event. The mock cannot write
  an event without its trigger, so (c) is not isolated in that half. The negative half (a Limited
  people event) isolates the creator clause. AC-6 isolates (e).

Nothing else deviates.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | `listMembers()` and every policy on `public.member` are untouched. The migration has no `create`/`drop`/`alter policy` (static test), and `tests/member-directory-scope.test.ts` AC-13 asserts that `listMembers()` returns the same roster for C, X and an admin before and after a connection widens the directory |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 48 files, 908 tests |
| `pnpm exec playwright test` | 1 | 444 passed, 21 skipped, 5 failed. **None of the 5 failures is caused by this ticket.** Each one also fails on `HEAD` 6410b17, checked in a separate worktree: `evt-10-description.spec.ts:244` and `:375`, `tsk-01-tasks.spec.ts:278`, `evt-14-guest-sign-in.spec.ts:328`, and `uie-09-admin-hub.spec.ts:249` (that one is intermittent on both trees). `tsk-02-overdue-prompt.spec.ts:109` fails on both trees too, and on this run it passed. Every test this ticket touched or relies on passes: `evt-01`, `evt-03` and `evt-08`, 25/25 |
| `git diff --name-only` plus untracked files, a subset of `allowed_paths` | yes | All 14 paths are listed or under `.ai/board/tickets/MIR-04/**` |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `event-picker` | `src/routes/EventEditor.tsx` (unchanged) |
| `event-picker-group` | `src/routes/EventEditor.tsx` (unchanged) |
| `event-picker-option` | `src/routes/EventEditor.tsx` (unchanged) |
| `event-invitees` | `src/routes/EventDetail.tsx` (unchanged) |

## Open questions

- The real-database behaviour is unverified until the operator runs `verification.md` (P0 exit
  criterion, plan:98).
- The five pre-existing e2e failures listed above belong to no ticket on this branch. They are worth
  a chore. They are not owed by MIR-04.
