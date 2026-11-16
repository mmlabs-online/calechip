---
ticket: MIR-20-c
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-15T06:22:03Z
inputs_read:
  - .ai/board/tickets/MIR-20-c/01-plan.md
  - .ai/board/tickets/MIR-20-c/03-impl-log.md
  - .ai/board/tickets/MIR-20-c/ticket.yaml
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD
  - git status --porcelain (clean)
  - supabase/migrations/20261112180000_mir20_impersonation.sql
  - supabase/migrations/20261112210000_mir20b_impersonation_log_read.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/390-impersonation.test.sql
  - supabase/tests/400-impersonation-log.test.sql
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
| R1 | Committed diff within `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` exit 0: "ticket MIR-20-c, 10 changed file(s) … allowed-paths: PASS". `node scripts/check-carry.mjs MIR-20-c` exit 0: "0 uncommitted path(s) … PASS — nothing stray". The 10 files are the 6 in `ticket.yaml` `allowed_paths` plus the ticket folder (3 files) and the ship-owned `.ai/board/backlog.md` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. Run by this reviewer |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, no output, repo-wide. Run by this reviewer |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The only new RPC is `src/lib/data/system.ts:695` (`client().rpc("impersonated_calendar", …)`), inside the panel seam; the panel calls `systemSeam.impersonatedCalendar` at `src/system/main.tsx:1226` and `src/system/main.tsx` contains no `supabase` import (grep: no match). Lint (R3) includes `supabase-client-in-seam` |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | `supabase/migrations/20261115090000_mir20c_impersonated_calendar.sql:54` `is_system_admin()` → 42501; `:57-59` `impersonated_org_id()` null → 42501; `:62-63` range → 22023; all before the only write at `:75`. Org/team predicate `:82`, `:87-90`; removed members `:83`; rejected excluded `:84`; column list `:79-80` (no notes, reasons, approvers). `:95` revokes from `public, anon`; `:96` grants `authenticated`. No write path: the panel's only buttons are prev/next (`src/system/main.tsx:1337-1360`) and retry (`:1263`), all reads |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; the only new imports are project-internal (`src/lib/data/system.ts:15`, `:19`, `:25`; `src/system/main.tsx:19`) |

Additional runs by this reviewer, not gate items: `pnpm test` exit 0 (63 files, 1228 tests);
`pnpm exec playwright test tests/e2e/mir-20-c-impersonated-calendar.spec.ts tests/e2e/mir-20-impersonation.spec.ts`
exit 0, 14 passed (AC-1 to AC-6 of this ticket and MIR-20's AC-1 to AC-7 with the new sibling section).

**The pgTAP suite `supabase/tests/410-impersonated-calendar.test.sql` was not executed** — no Docker or
`psql` on this machine either (`docker: command not found`). It runs in CI (`.github/workflows/verify.yml:81`).
It was read statically against the schema: `plan(28)` at `:20` matches the assertion count (5+3+6+6+3+1+2+2);
the expired-session row at `:180-182` satisfies `impersonation_box` (60 min) and is closed by
`start_impersonation`'s expiry sweep before the `:194` start (`20261112180000_mir20_impersonation.sql:119-129`);
the rejected entry carries a reason (`:144`, `entry_rejection_reason_iff_rejected`, `20260903103000_cal01_entry.sql:93-96`);
Lea's left membership at `:134-135` satisfies `left_at >= joined_at` and `is_primary = false`
(`20261027120000_mir11_composite_foreign_keys.sql:179-181`); AC-13's `reads = 3` matches the log's
`action not in ('start','end')` count (`20261112210000_mir20b_impersonation_log_read.sql:44`); the
identity-column output table at `:79-92` follows `390-impersonation.test.sql:91-99`, which ships.
No defect found; CI is the first execution.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 constraint `impersonation_action_known` admits `read_calendar` (drop if exists, add) | `supabase/migrations/20261115090000_mir20c_impersonated_calendar.sql:26-28` | yes |
| § 4.1 `public.impersonated_calendar(p_start date, p_end date)` returns the nine named columns, plpgsql volatile security definer, `search_path = ''` | `…_mir20c_impersonated_calendar.sql:36-48` | yes |
| § 4.1 refusal order 42501 / 42501 / 22023 before any write; one `read_calendar` row per call | `…:54-63`, insert `:75` | yes |
| § 4.1 row predicate, verbatim, order and limit | `…:78-92` | yes — identical to plan § 4.1 lines 308-322 |
| § 4.1 grants restated, one `begin … commit` | `…:20`, `:95-96`, `:98` | yes |
| § 4.2 `IMPERSONATED_CALENDAR_MAX_DAYS = 31` | `src/lib/data/system.ts:321` | yes |
| § 4.2 `ImpersonatedCalendarRow` | `src/lib/data/system.ts:324-334` | yes, nine fields as specified |
| § 4.2 `SystemSeam.impersonatedCalendar(range: DateRange)` | `src/lib/data/system.ts:90` | yes |
| § 4.2 supabase impl, error mapping via `impersonationFailureCode` / `impersonationRefusal`, never throws | `src/lib/data/system.ts:693-704` | yes |
| § 4.2 private `CalendarRpcRow`, `toCalendarRow` | `src/lib/data/system.ts:707-732` | yes |
| § 4.2 mock `mockCalendarRow`, `mockCalendars` keyed by team id | `src/lib/data/system.ts:1169-1190` | yes |
| § 4.2 mock refusal order, filter, sort (`startDate`, `displayName` `localeCompare "vi"`, `entryId`) | `src/lib/data/system.ts:1463-1484` | yes |
| § 4.3 `ImpersonatedCalendar({ session, onEnded })`, month state, read counter, range to last day, `not_permitted` → `onEnded()` | `src/system/main.tsx:1210-1243` | yes |
| § 4.3 one read on mount and per month change, no timer | `src/system/main.tsx:1245-1247` | yes |
| § 4.3 month label, cell text (type upper, portion labels, en-dash dates, status, tentative) | `src/system/main.tsx:1202`, `:1249-1254`, `:1302-1325` | yes |
| § 4.3 rendered after the roster with a per-session key | `src/system/main.tsx:1670` | yes in effect — key is `` `calendar-${session.id}` `` not `session.id`. The literal plan key would duplicate the roster's key at `:1669` in one children list; the chosen key still remounts per session, which is what the plan's key was for. Logged as the one deviation in `03-impl-log.md`. Not a contract change |
| § 4.3 every `data-testid` | `src/system/main.tsx:1260`, `:1263`, `:1270`, `:1276`, `:1298-1299`, `:1302-1323`, `:1335`, `:1340`, `:1349`, `:1353` | yes |
| § 2b visual: chip tokens, tentative `opacity-70` + dashed border, no overload colour | `src/system/main.tsx:1300`, `:1307-1310` | yes |
| § 4.4 pgTAP AC-7..AC-15 | `supabase/tests/410-impersonated-calendar.test.sql:153-311` | yes (static; see above) |
| § 4.4 census line | `supabase/tests/010-catalogue.test.sql:93-94` | yes |
| § 4.4 e2e AC-1..AC-6 with clock installed before `goto`, `fastForward("31:00")` | `tests/e2e/mir-20-c-impersonated-calendar.spec.ts:15`, `:41-141`, `:138` | yes; passes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count (`.ai/registry/invariants.md:36`) | The new server read lists entries and computes no number: no aggregate, no portion weight, no per-day grouping. The panel renders one table row per entry and no total or overload marker; the mock filters and sorts only. `absenceCountsFor` is not in the diff and is not imported by the panel. The count therefore still has exactly one definition, and this read cannot become a second one because it returns no count at all. The guarantee is in the server function itself, not in a UI affordance | `supabase/migrations/20261115090000_mir20c_impersonated_calendar.sql:78-92` (plain `select`, no `sum`/`count`/`group by`); `src/lib/data/system.ts:1471-1483` (filter/map/sort only); `src/system/main.tsx:1297-1327` (per-row cells, no arithmetic) |

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS`. MIR-20-c advances to DONE.
