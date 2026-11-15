---
ticket: MIR-20-b
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-12T08:37:10Z
inputs_read: [ .ai/board/tickets/MIR-20-b/01-plan.md, .ai/board/tickets/MIR-20-b/03-impl-log.md, .ai/board/tickets/MIR-20-b/ticket.yaml, .ai/registry/invariants.md, .ai/templates/review-report.md ]
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

# MIR-20-b — review

Subject: `git diff origin/main...HEAD` (commits `92c1815`, `abfa09e`) on `feat/MIR-20-b`; working tree
clean (`git status --porcelain` empty). Every command below was run by this reviewer, one per call.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` exit 0: "ticket MIR-20-b, 14 changed file(s) … allowed-paths: PASS" (the 10 code paths match `.ai/board/tickets/MIR-20-b/ticket.yaml:18-28`; the other 4 are the ticket folder and `.ai/board/backlog.md`). `node scripts/check-carry.mjs MIR-20-b` exit 0: "0 uncommitted path(s) … PASS — nothing stray" |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output; the repo-wide run reports no error outside the diff either |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The only RPC is inside the seam, `src/lib/data/supabase.ts:4470-4478`, via the module's `client()`. The screen reads through the seam's single door, `src/components/ImpersonationLog.tsx:9` (`from "@/lib/data"`) and `:28-29`; `src/routes/MemberList.tsx:17` imports the component only. `pnpm lint` (which carries the `supabase-client-in-seam` rule) exit 0 |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | org_admin disjunct `supabase/migrations/20261112210000_mir20b_impersonation_log_read.sql:46`; manager disjunct with `team_id is not null`, active membership, `team_role = 'manager'`, approved, not removed `:47-56`; system admin has no `member` row so neither matches `:46-56`; `revoke … from public, anon` / `grant execute … to authenticated` `:60-61`; no table grant or policy anywhere in the file `:18-63` (tables stay closed). Mock mirrors it: approved/not-removed gate `src/lib/data/mock.ts:4486-4488` (via `mockOrgOf`, `mock.ts:582-586`), admin-by-org / manager-by-team `mock.ts:4492-4495`. Screen gate is an affordance only, `src/routes/MemberList.tsx:699` |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; `package.json:19` `dependencies` unchanged. Only in-repo imports added: `src/components/ImpersonationLog.tsx:7-9` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `public.list_impersonation_log()`: nine columns, `language sql stable security definer set search_path = ''` | `supabase/migrations/20261112210000_mir20b_impersonation_log_read.sql:20-32` | Yes — column names and types identical to plan § 4.1 |
| § 4.1 effective end (`ended_at`, else `expires_at` when `<= now()`, else null) | `…_mir20b_impersonation_log_read.sql:40` | Yes |
| § 4.1 `reads` = actions not in (`start`,`end`) | `…_mir20b_impersonation_log_read.sql:41-44`; `action` is `text` with check `('start','end','read_roster')`, `supabase/migrations/20261112180000_mir20_impersonation.sql:50-52` | Yes |
| § 4.1 row predicate, exactly | `…_mir20b_impersonation_log_read.sql:46-56` | Yes — token-for-token with plan § 4.1 |
| § 4.1 order and bound | `…_mir20b_impersonation_log_read.sql:57-58` | Yes (`started_at desc, i.id`, `limit 200`) |
| § 4.1 grants, idempotent, one transaction | `…_mir20b_impersonation_log_read.sql:18`, `:20` (`create or replace`), `:60-61`, `:63` | Yes |
| § 4.2 `IMPERSONATION_LOG_LIMIT = 200` | `src/lib/data/index.ts:305` | Yes |
| § 4.2 `ImpersonationLogEntry` | `src/lib/data/index.ts:308-318` | Yes — nine fields, same types |
| § 4.2 `DataSeam.listImpersonationLog(): Promise<ImpersonationLogEntry[]>` | `src/lib/data/index.ts:1715` | Yes |
| § 4.2 `ImpersonationLogRow`, `toImpersonationLogEntry` | `src/lib/data/supabase.ts:142-164` | Yes |
| § 4.2 supabase method, two error messages, no `.limit()` | `src/lib/data/supabase.ts:4470-4478` (messages at `:4474`, `:4476`) | Yes |
| § 4.3 `MockImpersonation`, module state, three seeded rows L1–L3 with the plan's ids and values | `src/lib/data/mock.ts:1683-1737` | Yes — declared `const` rather than `let`; never reassigned, so the module-load reset is the same |
| § 4.3 mock `listImpersonationLog()` — approved/not removed, admin by org, manager by team, effective end at read time, sort desc, slice to the limit | `src/lib/data/mock.ts:4485-4510` (gate `:4486-4488`, filter `:4492-4495`, effective end `:4505`, sort `:4508`, slice `:4509`) | Yes |
| § 4.4 `ImpersonationLog` component: no props, loading/error/ready, retry, time format, scope, ended, reads | `src/components/ImpersonationLog.tsx:17-18` (format), `:22-41` (states and retry), `:124` (scope), `:133` (ended), `:136` (reads), `:142-146` (truncated) | Yes |
| § 4.4 every `data-testid` | `src/components/ImpersonationLog.tsx:44, 55, 66, 74, 87, 97, 113-114, 117, 120, 123, 126, 130, 135, 143` | Yes — all fourteen of the § 4.4 table |
| § 4.4 `MemberList.tsx`: import `mayDecide` and the component, render after table/empty, before modals | `src/routes/MemberList.tsx:17`, `:28`, `:698-699` | Yes — five added lines, nothing else changed |
| § 4.5 pgTAP AC-6..AC-13 + own helpers, `_isolation.psql` unedited | `supabase/tests/400-impersonation-log.test.sql:21` (`plan(29)`; AC blocks `:148-288`, assertion counts 2+1+3+7+5+3+3+4+1 = 29), helpers `:24-59` | Yes as written. **Not executed** — no PostgreSQL here (`pg_isready`: "no response", run by this reviewer). Applying and running is a person's step (RULE-09) |
| § 4.5 census entry | `supabase/tests/010-catalogue.test.sql:91-92` | Yes |
| § 4.5 Vitest AC-5 | `tests/impersonation-log.test.ts:35-73`; `pnpm test` exit 0, 63 files / 1227 tests (run by this reviewer) | Yes — see Delegated decisions on the `afterEach` clause |
| § 4.5 Playwright AC-1..AC-4 | `tests/e2e/mir-20-b-impersonation-log.spec.ts:31-98`; `pnpm exec playwright test tests/e2e/mir-20-b-impersonation-log.spec.ts` exit 0, 5 passed incl. seam guard (run by this reviewer) | Yes |

## R7 detail

`invariants_touched` is `[]` (`.ai/board/tickets/MIR-20-b/ticket.yaml:17`). Every ledger invariant is
about entries; each was checked against the diff individually. The SQL reads only `public.impersonation`,
`public.impersonation_action`, `public.membership`, `public.member` and writes nothing
(`…_mir20b_impersonation_log_read.sql:32` `stable`, `:41-56`); the mock reads only
`mockImpersonationLog` and `members` (`src/lib/data/mock.ts:4486-4495`); the screen calls one read
(`src/components/ImpersonationLog.tsx:28-29`).

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 (no overlapping portions per member/date) | No entry is created or edited; no entry table is referenced | `…_mir20b_impersonation_log_read.sql:41-56`; `mock.ts:4485-4510` |
| INV-02 (approved entry edited returns to pending) | No entry update path is added | same |
| INV-03 (rejection carries a reason) | No reject path is added | same |
| INV-04 (one definition of the absence count) | No count is computed; `reads` counts impersonation actions, not absences | `…_mir20b_impersonation_log_read.sql:41-44` |
| INV-05 (tentative counts) | No absence count touched | `…_mir20b_impersonation_log_read.sql:41-44` |
| INV-06 (one portion per entry) | No entry written | `…_mir20b_impersonation_log_read.sql:32` (`stable`, read-only) |
| INV-07 (one member, counted on every team) | `membership` is read for the caller only, never to attribute an entry | `…_mir20b_impersonation_log_read.sql:48-56` (`ms.member_id = auth.uid()`) |

## Delegated decisions

ADR-067: taken here rather than blocking.

- **Plan § 4.5 says the Vitest file "restores … any row it put, in `afterEach`"**;
  `tests/impersonation-log.test.ts:30-33` restores the current member and the dedicated-org set but not
  the three put rows. No existing export removes a mock member (`src/lib/data/mock.ts:344-348` only
  upserts), and plan § 4.3 forbids a new `__…ForTest` export, so the literal clause cannot be met inside
  the contract. Vitest's default per-file module isolation is in force (`vite.config.ts:144-147` sets no
  `isolate`/`pool` override), so the rows cannot reach another test file, and no test in this file
  reads the member list. Judged: the clause's intent — no leakage — is met; R5 passes.

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

PASS — the ticket advances to DONE. The pgTAP files (`400-impersonation-log.test.sql`, the census edit)
are unexecuted in this environment; running them against a database with the migration applied is a
person's step under RULE-09, and nothing in R1–R8 requires it.
