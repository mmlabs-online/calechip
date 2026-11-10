---
ticket: MIR-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-20T08:17:17+00:00
inputs_read:
  - .ai/board/tickets/MIR-03/01-plan.md
  - .ai/board/tickets/MIR-03/03-impl-log.md
  - .ai/board/tickets/MIR-03/99-questions.md
  - .ai/board/tickets/MIR-03/verification.md
  - .ai/board/tickets/MIR-03/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-044-an-admin-sets-a-rank-on-any-team.md
  - .ai/registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md
  - .ai/templates/review-report.md
  - "git diff origin/main...HEAD"
  - "git status --porcelain (clean)"
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

# MIR-03 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed ⊆ `allowed_paths`; uncommitted carry clean | PASS | `node scripts/check-allowed-paths.mjs MIR-03` → `allowed-paths: PASS` (17 changed files, every non-board path listed in `ticket.yaml` `allowed_paths`, incl. `tests/notifications.test.ts` and `tests/tasks.test.ts` added by the round-1 amendment, `99-questions.md`). `node scripts/check-carry.mjs MIR-03` → `PASS — nothing stray`, 0 uncommitted paths. `.ai/board/backlog.md` is ship-owned |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, repo-wide, so nothing outside the diff either |
| R4 | No datastore access outside the seam | PASS | `src/routes/MemberList.tsx:18` imports `seam` from `@/lib/data` only; the promotion goes through `seam.promoteMember` at `src/routes/MemberList.tsx:177-198`. The only new RPC call is inside the real seam, `src/lib/data/supabase.ts:1842` |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches § 3 | PASS | rank write: `is_admin` then refuse `admin` then own-team `where`, `supabase/migrations/20261020150000_mir03_bounded_role_changes.sql:92-110`; promotion: `is_admin` + own-team `where`, same file `:136-147`; record table RLS on, no policy, revoked, `:47-48`; grants `authenticated` only, `:121-122`, `:158-159`. Mock mirrors: `src/lib/data/mock.ts:433-442`, `:1817-1818`. Screen affordances: `src/routes/MemberList.tsx:351-361` |
| R7 | No invariant violated | PASS | see R7 detail |
| R8 | No dependency added | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; the new test imports only `node:fs`, `node:url`, `vitest` and repo modules, `tests/role-change-bounds.test.ts:12-23` |

Also run: `pnpm exec vitest run` → 47 files, 895 passed. Playwright not re-run here; the impl log
records two pre-existing failures in `tests/e2e/evt-10-description.spec.ts`, outside the diff.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1(a) `member_role_change` table, RLS on, no policy, revoke | `supabase/migrations/20261020150000_mir03_bounded_role_changes.sql:36-48` | yes — columns, types and `on delete restrict` as § 4.1(a) |
| 4.1(b) trigger function, definer, `search_path = ''`, `auth.uid()` actor, revoke | same file `:59-67` (`values (new.id, old.role, new.role, (select auth.uid()))` at `:63`) | yes |
| 4.1(b) `after update of role … when (old.role is distinct from new.role)` | same file `:70-75` | yes |
| 4.1(c) `set_member_role` same signature, refuses `admin`, own-team `where`, one refusal | same file `:86-122` (`:97`, `:106`, `:114`) | yes |
| 4.1(d) `promote_member_to_admin(uuid)`, admin-only, own-team, grants | same file `:130-159` (`:143`, `:158-159`) | yes |
| 4.1 `member_enforce_role_and_removal` not replaced | not present in the migration | yes |
| 4.2 `promoteMember` via its own RPC, `toRankFailure`, `isMemberRow` guard | `src/lib/data/supabase.ts:1841-1850` | yes |
| 4.2 `setMemberRole` unchanged, comments updated | `src/lib/data/supabase.ts:1855-1857`, `:1170-1177` | yes |
| 4.3 `setRank` own-team predicate | `src/lib/data/mock.ts:439` | yes |
| 4.3 `setMemberRole` refuses `"admin"` after admin check, before lookup | `src/lib/data/mock.ts:1817-1818` | yes |
| 4.3 `promoteMember` still `setRank(…, MEMBER_PROMOTE_REFUSED)`; no record in mock | `src/lib/data/mock.ts:1806-1808`, header `:413-421` | yes |
| 4.4 doc comments only | `src/lib/data/index.ts:424-431`, `:443-447` | yes — no signature change |
| 4.5 `canPromote` / `canSetManager` own-team | `src/routes/MemberList.tsx:353-361` | yes, verbatim to § 4.5 |
| 4.5 `promoting` state; *Promote* opens the dialog without a seam call | `src/routes/MemberList.tsx:96`, `:617-621` | yes |
| 4.5 confirm calls the seam; success clears and reloads; refusal and throw stay in the dialog; Cancel clears | `src/routes/MemberList.tsx:177-201`, `:858-867` | yes |
| 4.5 row write controls disabled while either dialog is open | `src/routes/MemberList.tsx:365`, used at `:616`, `:637`, `:657` | yes (impl-log deviation 2: *View info*/*Edit* not locked — they issue no guarded write; within § 2b's intent) |
| 4.5 page error only when no dialog is open | `src/routes/MemberList.tsx:429` | yes |
| 4.5 TEA-04 comment replaced, cites ADR-065 decision 3 | `src/routes/MemberList.tsx:173-176` | yes |
| § 2b dialog copy, aria, selectors | `src/routes/MemberList.tsx:830-872` | yes (deviation 3: `bg-wfh` fill, not rose — matches "not the danger fill") |
| 4.6 `tests/role-change-bounds.test.ts`, one `it` per row, names as written, promotion last | `tests/role-change-bounds.test.ts:40`, `:60`, `:75`, `:87`, `:103`, `:112`, `:132`, `:143`, `:179`, `:216` | yes |
| 4.6 `cross-team-role.test.ts` dated header, two `it`s inverted and renamed | `tests/cross-team-role.test.ts:1-6`, `:51`, `:154` | yes |
| 4.6 `notifications.test.ts` / `tasks.test.ts` fixture-only change | `tests/notifications.test.ts:138-143`, `tests/tasks.test.ts:102-109` | yes — `beforeAll` only, no `it` touched |
| 4.7 `verification.md` part 1 reproduction + AC-1–AC-11 steps, no secret | `.ai/board/tickets/MIR-03/verification.md` | yes — results left for the operator |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-07 — every entry belongs to one member and is counted against the team(s) that member belongs to (`.ai/registry/invariants.md:39`) | Both new/replaced functions `set role` only and never `team_id`; the trigger inserts only into `member_role_change`. No entry and no `member.team_id` is written by any path in this diff, so no count moves. Mock mirrors (`target.role = role` only). Tests assert `teamId` unchanged after rank change and promotion. The fixture move in two test files uses MIR-13's existing `moveMember`, not new behaviour | `supabase/migrations/20261020150000_mir03_bounded_role_changes.sql:103`, `:141`, `:63`; `src/lib/data/mock.ts:446`; `tests/role-change-bounds.test.ts:49`, `:56`, `:225` |

## Findings

None.

Noted for the operator, not a finding: the record's correctness (AC-1, AC-4, AC-9, AC-10 record
clauses) rests on `verification.md`, which has no results yet — by design until MIR-05 (plan § 4.3,
§ 4.7). `rbac-and-security.md` and `data-model.md` updates are owed (human-only, ADR-065).

## Verdict

PASS.
