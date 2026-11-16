---
ticket: MIR-20-c
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-15T13:20:00Z
inputs_read: [ .ai/board/tickets/MIR-20-c/01-plan.md, .ai/board/tickets/MIR-20-c/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261115090000_mir20c_impersonated_calendar.sql` | created | `read_calendar` joins the action constraint; adds the definer `impersonated_calendar(date, date)` | § 4.1 |
| `supabase/tests/410-impersonated-calendar.test.sql` | created | pgTAP for AC-7 to AC-15, 28 assertions | § 4.4 |
| `supabase/tests/010-catalogue.test.sql` | modified | definer census lists `public.impersonated_calendar(date,date)` | § 4.4 |
| `src/lib/data/system.ts` | modified | `IMPERSONATED_CALENDAR_MAX_DAYS`, `ImpersonatedCalendarRow`, `impersonatedCalendar` on both seams, mapper, mock calendars | § 4.2 |
| `src/system/main.tsx` | modified | `ImpersonatedCalendar` section rendered after the roster while a session is live | § 4.3 |
| `tests/e2e/mir-20-c-impersonated-calendar.spec.ts` | created | AC-1 to AC-6 against the mock build | § 4.4 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 migration | `supabase/migrations/20261115090000_mir20c_impersonated_calendar.sql` | Checks run in order: system admin, live session (`impersonated_org_id()`), range (22023), session row, then the log insert, then the read. Predicate is the plan's, verbatim. |
| 4.2 seam | `src/lib/data/system.ts:321` (constant, row), `:693` (supabase), `:1463` (mock), `:1184` (`mockCalendars`) | The mock mirrors the database's order of refusal. |
| 4.3 panel | `src/system/main.tsx:1210`, rendered at `:1670` | One read on mount and one per month change, none on a timer. |
| 4.4 tests | the three test files above | |

## Deviations from the design

One, found by running the existing MIR-20 e2e after adding the section. § 4.3 says to render the
calendar "with `key={session.id}`", the same key the roster already carries. Two siblings in one
children list with an identical key is a React duplicate-key defect: on session end the roster
section was left in the DOM (`mir-20-impersonation.spec.ts` AC-5 and AC-6 failed). The calendar's key
is `` `calendar-${session.id}` ``. Nothing else differs. No consultation: it is a one-token fix inside
a file the plan lists.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The function lists entries and computes nothing: no sum, no portion weight, no per-day total, in SQL, the mock or the panel. `absenceCountsFor` is untouched and remains the only definition. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 63 files, 1228 tests |
| `pnpm exec playwright test` on the new spec and `mir-20-impersonation.spec.ts` | 0 | 14 passed. Full `pnpm e2e`: 555 passed; `tsk-02` AC-4 and `uie-10` AC-3 failed once under parallel load and pass when re-run alone (`uie-10` also passes at baseline). |
| `node scripts/check-allowed-paths.mjs` / `check-carry.mjs MIR-20-c` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | plus the three untracked new files, all listed |

**Not run: the pgTAP suites** (`410`, and `010` with its new census line). No Docker or local
PostgreSQL on this machine. The SQL was written against the migrations it reads (`entry` columns and
constraints, `stamp_org_id`, `put_on_team`) and the `390`/`400` patterns, but it has not executed.
The reviewer or CI should treat `410` as unrun.

## Testability contract

Every `data-testid` in § 4.3 exists in `src/system/main.tsx` inside `ImpersonatedCalendar` (lines
1210 to about 1370): `system-calendar`, `-prev`, `-next`, `-month`, `-loading`, `-empty`, `-error`,
`-retry`, `-row` (with `data-entry-id`), and the six cell ids.

## Open questions

None. The Playwright Chromium binary was missing on this machine and was installed with
`playwright install chromium`; no repository file changed because of it.
