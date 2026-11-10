---
ticket: TEA-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-01T11:46:50+07:00
inputs_read:
  - .ai/board/tickets/TEA-04/01-plan.md
  - .ai/board/tickets/TEA-04/03-impl-log.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | [.ai/board/tickets/TEA-04/ticket.yaml:36-45](file:///Users/mpa/Downloads/aifw-template/.ai/board/tickets/TEA-04/ticket.yaml#L36-L45); `scripts/check-allowed-paths.mjs` exits 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | [src/routes/MemberList.tsx:17](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L17); [eslint.config.js:30-55](file:///Users/mpa/Downloads/aifw-template/eslint.config.js#L30-L55) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | [src/lib/data/index.ts:139,148](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L139-L148); [src/lib/data/supabase.ts:371,400](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L371-L400); [src/lib/data/mock.ts:307,345](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L307-L345); [src/routes/MemberList.tsx:38-40,74-97,101-121,173-175](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L38-L175) |
| R6 | Permission gating matches plan section 3 | PASS | [supabase/migrations/20260901120000_tea04_member_writes.sql:29,42-50,59-111](file:///Users/mpa/Downloads/aifw-template/supabase/migrations/20260901120000_tea04_member_writes.sql#L29-L111); [src/routes/MemberList.tsx:173-175,268-294](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L173-L294) |
| R7 | Every test selector in plan section 8 exists in the markup | PASS | [src/App.tsx:15,23](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L15-L23); [src/routes/MemberList.tsx:126,138,153,202,212,218,235,240,243,251,269,282,312,324,331,342](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L126-L342) |
| R8 | No invariant violated (RULE-07) | PASS | INV-04 and INV-07 verified; see detail below |
| R9 | No dependency added without an ADR | PASS | [package.json:1-47](file:///Users/mpa/Downloads/aifw-template/package.json#L1-L47) untouched in diff |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 No domain type / FailureCode added | [src/lib/domain/types.ts](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts) untouched | Yes |
| §4.2 `removeMember(memberId: string): Promise<Result<Member>>` (DataSeam) | [src/lib/data/index.ts:139](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L139) | Yes |
| §4.2 `removeMember` (Supabase seam) | [src/lib/data/supabase.ts:371](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L371) | Yes |
| §4.2 `removeMember` (Mock seam) | [src/lib/data/mock.ts:307](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L307) | Yes |
| §4.2 `promoteMember(memberId: string): Promise<Result<Member>>` (DataSeam) | [src/lib/data/index.ts:148](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L148) | Yes |
| §4.2 `promoteMember` (Supabase seam) | [src/lib/data/supabase.ts:400](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L400) | Yes |
| §4.2 `promoteMember` (Mock seam) | [src/lib/data/mock.ts:345](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L345) | Yes |
| §4.2 No existing seam signatures changed | [src/lib/data/index.ts](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts) prior 8 methods untouched | Yes |
| §4.3 Affordance predicates `canRemove` / `canPromote` | [src/routes/MemberList.tsx:173-175](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L173-L175) | Yes |
| §4.3 Local state `pending` / `busy` / `actionError` | [src/routes/MemberList.tsx:38-40](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L38-L40) | Yes |
| §4.3 `onPromote` calls `seam.promoteMember(member.id)` directly | [src/routes/MemberList.tsx:74-97](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L74-L97) | Yes |
| §4.3 `onConfirmRemove` calls `seam.removeMember(pending.id)` with dialog remaining open on refusal | [src/routes/MemberList.tsx:101-121,312](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L101-L312) | Yes |
| §4.3 Confirmation sentence naming member & surviving entries | [src/routes/MemberList.tsx:318-321](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L318-L321) | Yes |

## R8 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | Ticket computes no count and adds no arithmetic. `removed_at` defines the denominator and the per-date numerator condition. Soft-delete only (`member.id references auth.users(id) on delete restrict`; no delete policy/grant; `UPDATE` only). Caller-supplied or backdated timestamps are discarded and overwritten with server `now()` via BEFORE UPDATE trigger (AC-3). Trigger refuses undoing or re-dating removal. `team_id` writes are prevented by withholding column from update grant. | [supabase/migrations/20260901120000_tea04_member_writes.sql:29,81-83,101-103](file:///Users/mpa/Downloads/aifw-template/supabase/migrations/20260901120000_tea04_member_writes.sql#L29-L103); [src/lib/data/supabase.ts:371-377](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L371-L377) |
| INV-07 — one member, one team | `team_id` is withheld from the column-level update grant (`grant update (role, removed_at) on public.member to authenticated;`), so writing `team_id` fails with PostgreSQL 42501 before policies run (AC-7). Policy `member_update_admin` scopes writes to caller's own team in `using` and `with check` (AC-11). Both new seam functions write only `role` or `removed_at`. | [supabase/migrations/20260901120000_tea04_member_writes.sql:29,42-50](file:///Users/mpa/Downloads/aifw-template/supabase/migrations/20260901120000_tea04_member_writes.sql#L29-L50); [src/lib/data/supabase.ts:374,403](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L374-L403) |

## Findings

None. All checks pass.

## Verdict

`PASS`. Under ADR-017 waiving the QA stage, `next_state` is `DONE`.
