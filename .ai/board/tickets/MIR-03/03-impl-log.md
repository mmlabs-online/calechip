---
ticket: MIR-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-20T08:15:00+00:00
inputs_read:
  - .ai/board/tickets/MIR-03/01-plan.md
  - .ai/board/tickets/MIR-03/ticket.yaml
  - .ai/standards/testing-standards.md
  - supabase/migrations/20260924100000_solo_cross_team_role.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/MemberList.tsx
  - tests/cross-team-role.test.ts
  - tests/member-self-writes.test.ts
  - .ai/board/tickets/MIR-02/verification.md
consulted:
  - with: tech-lead-design
    asked: "tests/notifications.test.ts:140 and tests/tasks.test.ts:105 seed another team's admin with setMemberRole(<other-team id>, \"admin\"), which ADR-065 refuses twice; both files are outside allowed_paths. Add them for a beforeAll-only fixture change (approve onto own team, promoteMember, moveMember to the other team)?"
    answer: "Approved. Both added to allowed_paths for the beforeAll fixture setup only; no it, assertion or other line changes. Plan § 4.6, § 7 and Changelog amended (99-questions.md round 1)."
    resulted_in_amendment: true
chat_before_verdict: "one round: 99-questions.md round 1, developer → tech-lead-design"
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-03 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261020150000_mir03_bounded_role_changes.sql` | created | the record table, the recording trigger, the bounded rank write and the promotion function | § 4.1 (a)–(d) |
| `src/lib/data/supabase.ts` | modified | `promoteMember` calls `promote_member_to_admin`; ADR-044 comments brought up to date | § 4.2 |
| `src/lib/data/mock.ts` | modified | `setRank` gains the own-team predicate, `setMemberRole` refuses `"admin"`, comments cite ADR-065 | § 4.3 |
| `src/lib/data/index.ts` | modified | doc comments on `promoteMember` and `setMemberRole` only | § 4.4 |
| `src/routes/MemberList.tsx` | modified | own-team predicates, promotion confirmation dialog, row controls locked while a dialog is open | § 4.5, § 2b |
| `tests/role-change-bounds.test.ts` | created | MIR-03's AC tests against the mock, plus the static migration guard | § 4.6 |
| `tests/cross-team-role.test.ts` | modified | dated MIR-03 header; the two cross-team-success tests now assert the refusal, renamed | § 4.6 |
| `tests/notifications.test.ts` | modified | `beforeAll` seeds the other team's admin by approve-own-team → promote → move | § 4.6 (amended, 99-questions.md round 1) |
| `tests/tasks.test.ts` | modified | same `beforeAll` change; comment re-cited from ADR-044 to ADR-065 | § 4.6 (amended, 99-questions.md round 1) |
| `.ai/board/tickets/MIR-03/verification.md` | created | manual verification steps for the operator to run and fill in | § 4.7 |
| `.ai/board/tickets/MIR-03/99-questions.md` | created | the consultation above, with tech-lead-design's answer | — (RULE-12 channel) |
| `.ai/board/tickets/MIR-03/03-impl-log.md` | created | this file | gate |
| `.ai/board/tickets/MIR-03/01-plan.md` | modified by tech-lead-design | § 4.6, § 7 and Changelog amended for the two test paths | — (consultation) |
| `.ai/board/tickets/MIR-03/ticket.yaml` | modified | `allowed_paths` (+2, by tech-lead-design), `chat_budget` used 1, `state: REVIEW` | — |

Not touched: both ADR files in `allowed_paths`. ADR-065 exists and ADR-044 already carries the
supersession note under § Status, both written at PLAN; nothing in § 4 asked the developer for more.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 (a) table, RLS on, no policy, revoke | `20261020150000_mir03_bounded_role_changes.sql:36-48` | as specified |
| 4.1 (b) trigger function + `after update of role … when (old.role is distinct from new.role)` | same file `:59-75` | `revoke all … from public` on the function |
| 4.1 (c) `set_member_role` own-team, refuses `admin` | same file `:86-122` | `m.team_id is not null` dropped, one-line comment kept saying why |
| 4.1 (d) `promote_member_to_admin` + grants | same file `:130-159` | |
| 4.2 `promoteMember` via its own RPC | `src/lib/data/supabase.ts:1841-1850` | `toRankFailure(error, MEMBER_PROMOTE_REFUSED)`, `isMemberRow` guard |
| 4.2 `setMemberRole` unchanged, comments updated | `src/lib/data/supabase.ts:1170-1177`, `:1852-1857` | also `isMemberRow` / `toRankFailure` docblocks name the new RPC |
| 4.3 own-team predicate | `src/lib/data/mock.ts:439` | replaces `m.teamId !== null` |
| 4.3 `setMemberRole` refuses `"admin"` after admin check | `src/lib/data/mock.ts:1817-1818` | |
| 4.3 `setRank` header | `src/lib/data/mock.ts:409-423` | |
| 4.4 doc comments | `src/lib/data/index.ts:424-431`, `:443-447` | no signature changes |
| 4.5 `canPromote`, `canSetManager` | `src/routes/MemberList.tsx:353-361` | comment block rewritten: all three compare teams |
| 4.5 `promoting` state, confirm/cancel, errors in dialog | `src/routes/MemberList.tsx:96-98`, `:173-200`, `:830-872` | |
| 4.5 row controls disabled while either dialog is open | `src/routes/MemberList.tsx:365` (`rowLocked`) | used by *Promote*, *Make/Remove manager*, *Delete account* |
| 4.5 page error only when no dialog is open | `src/routes/MemberList.tsx:429` | |
| 4.6 new test file | `tests/role-change-bounds.test.ts` | every `it` named as in the table; promotion last |
| 4.6 `cross-team-role.test.ts` | header + the two renamed `it`s | no other test needed re-aiming |
| 4.7 verification | `.ai/board/tickets/MIR-03/verification.md` | results left for the operator |

## Deviations from the design

1. **Two test files outside the original `allowed_paths`**, edited after consultation (above). Plan
   § 4.6 did not list them; without the change both fail in `beforeAll` and 56 tests are skipped.
2. **"Row-level buttons" read as the three write controls.** `rowLocked` disables *Promote*,
   *Make/Remove manager* and *Delete account*. *View info* and *Edit* are not disabled: they open
   their own panels and issue none of the writes a confirmation guards. Same for the removal flow,
   whose rows were previously disabled only on `busy`.
3. **The confirm button's class.** § 2b says "the screen's existing primary filled button class".
   The only filled non-danger button on the screen is the edit panel's *Save* (`bg-wfh`, pill). The
   dialog uses that fill with the removal dialog's `rounded-xl px-4 py-2` shape, so the two dialogs'
   buttons line up.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-07` | Both functions' `update` sets `role` only; the trigger inserts only into `member_role_change`. No path in this ticket writes `member.team_id` or an entry, so no entry is counted against a different team. `role-change-bounds.test.ts` asserts `teamId` unchanged after the rank change and after the promotion. The test fixtures' approve → promote → move uses `moveMember`, which is MIR-13's existing path, not new behaviour. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 47 files, 895 passed, 0 skipped. Before the two fixture fixes: 2 files failed in `beforeAll`, 56 skipped |
| `pnpm exec playwright test` | 1 | 447 passed, 21 skipped, 2 failed — both in `tests/e2e/evt-10-description.spec.ts` (`:244` AC-2–4, `:375` AC-7). **Pre-existing and unrelated**: the same two fail on a clean worktree of `HEAD` (`aa904d9`) without this change. Every Members spec passes, including `tsk-01-tasks.spec.ts:72` and `tsk-04-week-task-badge.spec.ts:196` (*Make manager* on a teammate) and `solo-member-admin.spec.ts` |
| `git diff --name-only` ⊆ `allowed_paths` | yes | after the amendment |

The migration is **not run** against a database (RULE-09). The static test is a guard, not
verification; `verification.md` is the verification of record until MIR-05.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `member-list-row-promote` | `src/routes/MemberList.tsx:614` — now opens the dialog |
| `member-list-row-manager` | `src/routes/MemberList.tsx:634` — own-team rows only |
| `member-list-promote-confirm` | `src/routes/MemberList.tsx:832` |
| `member-list-promote-confirm-accept` | `src/routes/MemberList.tsx:851` |
| `member-list-promote-confirm-cancel` | `src/routes/MemberList.tsx:862` |
| `member-list-action-error` | `src/routes/MemberList.tsx:844` inside the promotion dialog (also `:431` page, `:792` removal dialog) |

## Open questions

None for the reviewer. Owed outside this ticket, as the plan says: `rbac-and-security.md` and
`data-model.md` updates (human-only, ADR-065 *Affected documents*), and running `verification.md`.
