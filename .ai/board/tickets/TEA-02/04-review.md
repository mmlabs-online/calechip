---
ticket: TEA-02
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-01T00:33:50+07:00
inputs_read:
  - .ai/board/tickets/TEA-02/01-story.md
  - .ai/board/tickets/TEA-02/02-design.md
  - .ai/board/tickets/TEA-02/03-impl-log.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# TEA-02 — Manage the allow-list — review report

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `ticket.yaml:15-26` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `eslint.config.js:32-51`, `src/lib/data/supabase.ts:1-10` |
| R5 | Every contract item in design section 1 is implemented (RULE-04) | PASS | `src/lib/domain/types.ts:41-63`, `src/lib/data/index.ts:22-84`, `src/lib/data/mock.ts:64-210`, `src/lib/data/supabase.ts:212-295`, `src/lib/fixtures.ts:58-69`, `src/routes/AllowList.tsx:115-310`, `src/App.tsx:37` |
| R6 | Permission gating matches design section 2 | PASS | `supabase/migrations/20260901090000_tea02_allow_list_writes.sql:15-45`, `src/routes/AllowList.tsx:47-50,242-255`, `src/App.tsx:37` |
| R7 | Every selector in design section 6 exists in the markup | PASS | `src/App.tsx:14,22`, `src/routes/AllowList.tsx:118,130,151,167,177,183,194,200,215,223,236,244,268,287,296` |
| R8 | No invariant violated (RULE-07) | PASS | `supabase/migrations/20260901090000_tea02_allow_list_writes.sql:26-33`, `src/lib/data/mock.ts:176`, `src/lib/data/supabase.ts:246` |
| R9 | No dependency added without an ADR | PASS | `.ai/standards/tech-stack.md:80-85`, `.ai/registry/decisions/ADR-005-authorization-in-rls.md` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §1.1 `AllowedEmail` interface | `src/lib/domain/types.ts:54-60` | Yes |
| §1.1 `AllowedEmailState` type | `src/lib/domain/types.ts:63` | Yes |
| §1.1 `FailureCode` additions | `src/lib/domain/types.ts:41-43` | Yes |
| §1.2 `AddAllowedEmailInput` interface | `src/lib/data/index.ts:22-24` | Yes |
| §1.2 `getCurrentMember(): Promise<Member \| null>` | `src/lib/data/index.ts:67`, `src/lib/data/mock.ts:141`, `src/lib/data/supabase.ts:212` | Yes |
| §1.2 `listAllowedEmails(): Promise<AllowedEmail[]>` | `src/lib/data/index.ts:74`, `src/lib/data/mock.ts:147`, `src/lib/data/supabase.ts:219` | Yes |
| §1.2 `addAllowedEmail(input: AddAllowedEmailInput): Promise<Result<AllowedEmail>>` | `src/lib/data/index.ts:80`, `src/lib/data/mock.ts:161`, `src/lib/data/supabase.ts:235` | Yes |
| §1.2 `removeAllowedEmail(email: string): Promise<Result<void>>` | `src/lib/data/index.ts:83`, `src/lib/data/mock.ts:192`, `src/lib/data/supabase.ts:264` | Yes |
| §1.3 Screen states (`loading`, `refused`, `empty`, `list`) | `src/routes/AllowList.tsx:115-310`, `src/App.tsx:37` | Yes |
| §1.4 `__setCurrentMember(id: string \| null): void` | `src/lib/data/mock.ts:64-66` | Yes |
| §1.5 `FIXTURE_MEMBER` | `src/lib/fixtures.ts:58-66` | Yes |
| §1.5 `FIXTURE_OTHER_TEAM_ID` | `src/lib/fixtures.ts:69` | Yes |

## R8 detail

| Invariant | Held by | Citation |
|---|---|---|
| `INV-07` | Held by RLS policy `allowed_email_insert_admin`'s `with check (team_id = public.member_team_id((select auth.uid())))` ensuring an allow-list entry always belongs to the admin's team. In the seam, neither implementation accepts a caller-supplied `team_id`. When a member signs up, trigger `admit_allow_listed_member` (TEA-01) copies `allowed_email.team_id` onto `member.team_id`. One member belongs to exactly one team. | `supabase/migrations/20260901090000_tea02_allow_list_writes.sql:26-33`, `src/lib/data/mock.ts:176`, `src/lib/data/supabase.ts:246` |

## Findings

None. All checks pass.

## Verdict

`PASS`. The ticket advances to QA (`next_state: QA`).
