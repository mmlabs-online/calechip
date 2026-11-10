---
ticket: TEA-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-01T01:20:08Z
inputs_read: [ .ai/board/tickets/TEA-03/01-story.md, .ai/board/tickets/TEA-03/02-design.md, .ai/board/tickets/TEA-03/03-impl-log.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `ticket.yaml:33-44`, `03-impl-log.md:43-53` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/MemberList.tsx:11`, `src/App.tsx:7` |
| R5 | Every contract item in design section 1 is implemented (RULE-04) | PASS | `02-design.md:46-197`, `03-impl-log.md:57-72` |
| R6 | Permission gating matches design section 2 | PASS | `supabase/migrations/20260901093000_tea03_member_select_team.sql:34-36`, `src/lib/data/mock.ts:258-264`, `src/routes/MemberList.tsx:3-7` |
| R7 | Every selector in design section 6 exists in the markup | PASS | `src/App.tsx:15`, `:23`, `src/routes/MemberList.tsx:61`, `:73`, `:88`, `:120`, `:126`, `:142-144`, `:147`, `:150`, `:158` |
| R8 | No invariant violated (RULE-07) | PASS | `supabase/migrations/20260901093000_tea03_member_select_team.sql:34-36`, `src/lib/data/supabase.ts:320-340`, `src/lib/data/mock.ts:261-275` |
| R9 | No dependency added without an ADR | PASS | `package.json:1-40` |

## R5 detail

One row per contract item from design section 1, with where it is implemented. A summary sentence is
not this section.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §1.1 `ROSTER_LIMIT = 500` | `src/lib/domain/types.ts:111` | Yes |
| §1.1 Domain types (`Member`, `MemberRole`, no `FailureCode`) | `src/lib/domain/types.ts:3-13` | Yes |
| §1.2 `listMembers(): Promise<Member[]>` seam declaration | `src/lib/data/index.ts:114` | Yes |
| §1.2 `listMembers()` Supabase implementation | `src/lib/data/supabase.ts:317-343` | Yes |
| §1.2 `listMembers()` Mock implementation | `src/lib/data/mock.ts:257-278` | Yes |
| §1.3 `MemberList.tsx` four-state view | `src/routes/MemberList.tsx:21-25`, `:30-51` | Yes |
| §1.3 `removedAt` display filter (AC-4 second half) | `src/routes/MemberList.tsx:107` | Yes |
| §1.3 Role display label (`Quản trị viên` / `Thành viên`) | `src/routes/MemberList.tsx:16-17`, `:158-166` | Yes |
| §1.3.1 Error state `unavailable` | `src/routes/MemberList.tsx:44-50`, `:85-99` | Yes |
| §1.4 Ordering `created_at asc, id asc` | `src/lib/data/supabase.ts:321-322`, `src/lib/data/mock.ts:55-56`, `:269` | Yes |
| §1.5 `FIXTURE_OTHER_TEAM` | `src/lib/fixtures.ts:83-87` | Yes |
| §1.5 `FIXTURE_OTHER_TEAM_MEMBER` | `src/lib/fixtures.ts:90-98` | Yes |
| §1.5 `FIXTURE_REMOVED_MEMBER` | `src/lib/fixtures.ts:105-113` | Yes |
| Route `/members` registration | `src/App.tsx:43` | Yes |
| §4 Migration `member_select_team` | `supabase/migrations/20260901093000_tea03_member_select_team.sql:34-36` | Yes |
| §4.1 Seed data | `supabase/seed.sql:161-244` | Yes |

## R8 detail

**One row per ID in `invariants_touched`.** Reason through each individually and cite the line that
holds it. "No invariants affected" without per-ID reasoning is a failed check, not a pass.

| Invariant | Held by | Citation |
|---|---|---|
| `INV-07` — one member, one team | Held in database by `member_select_team` RLS policy using `team_id = public.member_team_id((select auth.uid()))` for `select to authenticated`; held in mock by filtering `m.teamId === me.teamId`. `listMembers()` takes no team parameter and applies no bypass. | `supabase/migrations/20260901093000_tea03_member_select_team.sql:34-36`, `src/lib/data/mock.ts:264` |
| `INV-04` — one definition of the absence count | Held by `listMembers()` returning removed members carrying `removedAt` in both datastore and mock implementations without filtering them below the seam, so the single absence counting function can receive the full roster with `removedAt` per member as required by ADR-013. The filter `removedAt === null` is only in UI presentation. In addition, truncation is prevented via explicit `ROSTER_LIMIT` check and throw in both implementations. | `src/lib/data/supabase.ts:320-340`, `src/lib/data/mock.ts:261-275`, `src/routes/MemberList.tsx:107` |

An invariant that is held only by a UI affordance is not held.

## Findings

None. All checks pass.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

Routing is from the failure routing table in `.ai/01-operating-model.md`. Per RULE-08 only
Developer-caused failures increment the count; an R7 failure is a design defect and must not be
charged to the Developer.

**R8 does not route to REWORK.** Per RULE-07 it escalates to a human on first occurrence. If R8
fails, set `gate: FAIL`, `next_state: ESCALATED`, and state the invariant ID in `blocking_reason`.

## Verdict

`PASS` and the ticket advances to `DONE` under ADR-017 (`.ai/01-operating-model.md`, *The QA stage is waived*).

There is no "pass with comments". A comment worth making is either a finding or is not part of this
gate.
