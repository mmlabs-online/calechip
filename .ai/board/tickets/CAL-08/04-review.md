---
ticket: CAL-08
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-05T17:02:44+07:00
inputs_read: [ .ai/board/tickets/CAL-08/01-plan.md, .ai/board/tickets/CAL-08/03-impl-log.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-08 — review report

Isolated dispatch, files only. No channel to the Developer existed and none was used. Every command
below was run in this session; nothing in the table is quoted from 03-impl-log.md.

**`next_state` is `DONE` and not `QA`.** ADR-022 removed the QA stage and its enum value; the
lifecycle it fixes is `… IN_PROGRESS -> REVIEW -> DONE`. `.ai/templates/review-report.md:30` still
carries `next_state: QA` in its front-matter example — see *Findings outside the gate*.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | seven code paths, each named at `.ai/board/tickets/CAL-08/ticket.yaml:57-63`; `node scripts/check-allowed-paths.mjs` exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `node node_modules/eslint/bin/eslint.js .` exit 0, under Node 22 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/lib/data/day-status.ts:30-31`, `src/routes/MonthView.tsx:194`, `src/routes/WeekView.tsx:182`, `src/routes/YearView.tsx:174` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | table below |
| R6 | Permission gating matches plan section 3 | PASS | `src/routes/MonthView.tsx:194`, `src/routes/WeekView.tsx:182`, `src/routes/YearView.tsx:174` — `listHolidays` and no other holiday call; no `member.role` branch in any of the three |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) | PASS | table below |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` returns empty |

### R1 — the file list

`git status --porcelain` reports ten paths. Seven are code and every one is an `allowed_paths` glob
at `ticket.yaml:57-63`:

- modified — `src/lib/domain/types.ts`, `src/routes/MonthView.tsx`, `src/routes/WeekView.tsx`,
  `src/routes/YearView.tsx`
- created — `src/lib/data/day-status.ts`, `tests/day-status.test.ts`,
  `tests/e2e/cal-08-holiday-shading.spec.ts`

The other three are the ticket's own working directory — `ticket.yaml`, `01-plan.md`,
`03-impl-log.md` — which RULE-03 does not govern.

**The paths 01-plan.md section 7 names as deliberately absent are absent, verified rather than
assumed.** `git status --porcelain` is empty for `src/lib/data/absence.ts`, `index.ts`, `mock.ts`,
`supabase.ts`, `src/lib/fixtures.ts`, `package.json` and `pnpm-lock.yaml`. `supabase/` is untouched,
which is `schema_delta: none` held mechanically.

`check-allowed-paths.mjs` prints `0 changed file(s)` because it diffs `origin/main...HEAD` and
nothing is committed until `/ship` — the same reading CAL-07's review recorded. The subset claim
above is from `git status --porcelain` against `ticket.yaml:57-63`, not from that script's count.

### R2, R3 — the commands, and the runtime they need

| Command | Exit |
|---|---|
| `pnpm exec tsc --noEmit` | 0 |
| `node node_modules/eslint/bin/eslint.js .` (Node 22) | 0 |
| `node node_modules/vitest/vitest.mjs run` | 0 — 7 files, 148 tests |
| the same under `TZ=America/Los_Angeles` | 0 — 148 pass |
| the same under `TZ=Asia/Ho_Chi_Minh` | 0 — 148 pass |
| `node node_modules/@playwright/test/cli.js test` | 0 — 145 pass, 0 fail |
| `node scripts/check-allowed-paths.mjs` | 0 — `allowed-paths: PASS` |

**03-impl-log.md § Open questions 2 is confirmed, not taken on trust.** This machine's default `node`
is v18.19.1 and `pnpm exec eslint .` exits **2** on it with `SyntaxError: Unexpected token 'with'`,
raised while loading `eslint.config.js` and before any rule runs. R3 was run under a Node 22.11.0
toolchain installed outside the repository. **No repository file was edited to make any command
above run**, and `git status --porcelain` is unchanged from the list in R1.

The three timezone runs are AC-15 and they are this reviewer's, not a re-quote: the ICT run and the
UTC-default run would both pass against a `getDay()` implementation, and the Los Angeles run is the
one that would not.

## R5 detail

One row per contract item in 01-plan.md section 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `NonWorkingReason = "weekend" \| "holiday"` | `src/lib/domain/types.ts:378` | yes, verbatim |
| § 4.1 `DayStatus` — five fields | `src/lib/domain/types.ts:387-397` | yes. `working` and `bridge` are separate booleans, so *"is this a working day"* is readable without knowing `bridge` implies it — the requirement `.ai/registry/features.md:95` puts on this type. Not a flat union |
| § 4.1 `DayStatuses = ReadonlyMap<string, DayStatus>` | `src/lib/domain/types.ts:403` | yes |
| § 4.2 `BRIDGE_LOOKAROUND_DAYS` | `src/lib/data/day-status.ts:41` | yes, `7`, with § 4.2's reason for not being 1 |
| § 4.2 `holidayReadRange(range): DateRange` | `src/lib/data/day-status.ts:52-55` | yes, exported. It is the **only** pad: `grep` finds `BRIDGE_LOOKAROUND_DAYS` at `day-status.ts:41,53,54` and `tests/day-status.test.ts:241-245` and nowhere else, so no view writes the expression |
| § 4.2 the weekend rule, module-private and never exported | `src/lib/data/day-status.ts:65-68` | yes. `WEEKEND_UTC_DAYS` and `isWeekend` carry no `export`, and `getUTCDay` is read at `:68` — never `getDay` |
| § 4.2 `dayStatusesFor(holidays, range): DayStatuses` | `src/lib/data/day-status.ts:99` | yes, arity and types as written |
| § 4.2 rule 1 — the row wins over the weekend rule | `src/lib/data/day-status.ts:107-111` | yes. `rows.get(date)` first, `!isWeekend(date)` only when absent |
| § 4.2 rule 2 — `nonWorkingReason` | `src/lib/data/day-status.ts:121-125` | yes. `null` when `working`; `"holiday"` when a row is present and the day is not working, which can only be a `non_working` row because a `working` row makes `working` true at `:109` |
| § 4.2 rule 3 — `holiday` is the row of either kind | `src/lib/data/day-status.ts:116` | yes, `rows.get(date) ?? null`, no `kind` filter |
| § 4.2 rule 4 — `bridge` | `src/lib/data/day-status.ts:130` | yes. `working && !isWorking(date-1) && !isWorking(date+1)`; both neighbours go through the same `isWorking` written at `:107`, so the neighbour test is not a second definition |
| § 4.2 every comparison on `yyyy-MM-dd`, no local accessor | `src/lib/data/day-status.ts:68` | yes. The one `Date` in the file is `new Date(\`${date}T00:00:00Z\`)` read with `getUTCDay`. `addDays` and `eachDateInRange` come from `./absence` at `:30` |
| § 4.3 `MonthView` — one added read, padded, in the existing `Promise.all` |  `src/routes/MonthView.tsx:186-196` | yes; the `catch` at `:207-220` is the one that already existed, which is AC-12 |
| § 4.3 `MonthView` — derivation over the MONTH range | `src/routes/MonthView.tsx:257-270` against `range` at `:166-169` | yes. `range` is `{ month-01, lastDateOf(month) }`; the grid's whole-weeks `cells` is a separate value at `:325`, so the leading and trailing cells have no key — AC-14 by construction, reinforced at `:395` by `inMonth ? … : undefined` |
| § 4.3 `WeekView` — read and derivation | `src/routes/WeekView.tsx:182`, `:214-220` | yes, same shape |
| § 4.3 `YearView` — read and derivation | `src/routes/YearView.tsx:174`, `:247-250` | yes, same shape. `range` at `:143` is `yearRange(year)` and the strip walks `eachDateInRange(yearRange(anchorYear))` at `:311`, so every strip element has a key |
| § 4.3 `YearView` AC-8 reads the ROWS, not the statuses |  `src/routes/YearView.tsx:530` | yes, `view.holidays.length === 0`. Reached only after the loading, not-on-a-team and unavailable early returns at `:270-308`, so `view` is narrowed to `ready` |
| § 4.4 `month-cell` + `data-day-status`, `data-bridge` |  `src/routes/MonthView.tsx:410-411` | yes. Three values — `status.nonWorkingReason ?? "working"` — and empty on an out-of-month cell |
| § 4.4 `month-cell-holiday` + `data-kind`, text `holiday.name` | `src/routes/MonthView.tsx:452-461` | yes, rendered only when a row exists, of either kind |
| § 4.4 `month-cell-bridge` | `src/routes/MonthView.tsx:462-469` | yes, only when `status.bridge` |
| § 4.4 `week-day` + the two attributes | `src/routes/WeekView.tsx:334-335` | yes |
| § 4.4 `week-day-holiday` + `data-kind` | `src/routes/WeekView.tsx:353-361` | yes |
| § 4.4 `week-day-bridge` | `src/routes/WeekView.tsx:362-369` | yes |
| § 4.4 `year-daystatus` |  `src/routes/YearView.tsx:389` | yes, one row, sharing `columns` from `:325` |
| § 4.4 `year-daystatus-cell` + `data-date`, `data-day-status`, `data-bridge`, `title` | `src/routes/YearView.tsx:396-407` | yes; `title` carries the name when there is one |
| § 4.4 `year-holidays-empty` |  `src/routes/YearView.tsx:530` | yes |
| § 5 seam impact `none` | — | held. `src/lib/data/index.ts`, `mock.ts`, `supabase.ts` are unmodified (R1), and `tests/seam-parity.test.ts` passes unedited |
| § 6 schema delta `none` | — | held. `supabase/` unmodified (R1) |

**The three deviations 03-impl-log.md declares are each additive and none reaches the selector
table.** `week-day-label`'s new classes are at `src/routes/WeekView.tsx:340-347` and its
`data-testid` is unchanged at `:339`; the `Calendar` row label at `src/routes/YearView.tsx:389`
carries no `data-testid`; the bridge dot at `src/routes/YearView.tsx:414` is `aria-hidden` with no
`data-testid`, so the criterion still turns on `data-bridge` and no second, weaker way to ask the
same question exists.

**A1 and A2 ship as the plan states them**, one predicate at `src/lib/data/day-status.ts:130`, and
the tests that change if the operator answers otherwise are the two `describe` blocks at
`tests/day-status.test.ts:351` and `:376`, both carrying `TODO(project)`. That is the cost 01-plan.md
section 2 predicted, and it is where it was predicted to be.

## R7 detail

`invariants_touched: []` — `ticket.yaml:43`, from `.ai/registry/features.md:95`, which RULE-04 makes
the source. There is no ID to reason through, so what follows is the reasoning for the one invariant
both 01-plan.md section 2 and 03-impl-log.md § Invariants argue was in play. Reasoning through it is
this check; agreeing with the empty list without doing so would not be.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | The diff does not reach the arithmetic. `src/lib/data/absence.ts` is unmodified (R1), so `absenceCountsFor`, `absentMembersFor`, `absentEntriesFor` and `absentDatesByMember` are byte-identical. `day-status.ts` imports `addDays` and `eachDateInRange` from it and nothing else (`src/lib/data/day-status.ts:30`) and exports nothing `absence.ts` consumes. | `src/lib/data/day-status.ts:30` |
| INV-04 — no suppression at the count | The month cell's count is still `data-count={inMonth ? count : ""}` and `count` is still read from the same `absenceCountsFor` memo; nothing in the diff adds a `status`-dependent term to it. | `src/routes/MonthView.tsx:404` |
| INV-04 — no suppression at the overload comparison | `overloaded` is still `inMonth && isOverloaded(count, active, team.overloadThreshold)`, unchanged by the diff, and the holiday tint is written so the pink wins the background rather than replacing the state: `inMonth && !overloaded && status?.nonWorkingReason === "holiday"`. AC-10 is that both signals survive. | `src/routes/MonthView.tsx:392`, `:429` |
| INV-04 — asserted from outside, not only by construction | `absenceCountsFor` is run across a holiday date and returns the working day's number; `dayStatusesFor` is not in the call and shares no argument with it. | `tests/day-status.test.ts:294-308` |

**The counter-argument is on the record and is not dismissed.**
`.ai/registry/invariants.md` § *How to use this file* warns that choosing the safe behaviour and then
concluding no invariant is engaged is circular. Suppression was available at three points in this
diff — the cell count, the overload class, and the year totals strip — and was refused at all three.
The registry row says `[]` and RULE-04 makes it the source, so `[]` stands and this check passes on
the citations above rather than on the declaration.

**INV-05, INV-06, INV-07** are untouched for a mechanical reason worth stating once: all three are
statements about `entry` rows, and nothing in this diff reads, writes, filters or counts an entry.
The only seam call added is `listHolidays` (R6).

## R6 detail

01-plan.md section 3 is ✅✅ on the read and ❌❌ on every write, so a missing `is_admin` test is the
expected finding and its absence is the check.

- **The read.** `seam.listHolidays(holidayReadRange(range))` at `src/routes/MonthView.tsx:194`,
  `src/routes/WeekView.tsx:182`, `src/routes/YearView.tsx:174`. That is the whole of what these three
  screens ask of the holiday table; `holiday_select_all` admits both roles and nothing is scoped by
  team, which is correct — the calendar is national (ADR-015 § 1).
- **The writes are held by absence, and the absence is verified.** `grep -n "addHoliday\|updateHoliday\|deleteHoliday"` over the three views returns nothing. No control that adds, edits or deletes a holiday exists on any of them.
- **Nothing branches on role.** `grep -n "role\|isAdmin"` over the three views returns only `role="status"`, `role="alert"` and prose in comments — no `member.role` test in any render path. AC-13's e2e case opens all three screens as a member and as an admin and finds the same markup, at `tests/e2e/cal-08-holiday-shading.spec.ts:432`.

## Findings

None. No check failed and there is no routing row to apply.

## Findings outside the gate

Recorded because they are true, are not CAL-08's to fix, and change no verdict.

1. **`.ai/templates/review-report.md` still tells a reviewer to write a retired state.** Its
   front-matter example reads `next_state: QA` at `:30`, and its two closing sections read
   *"R8 detail — one row per ID in `invariants_touched`"* (`:55-63`) and *"R8 does not route to
   REWORK … per RULE-07 it escalates"* (`:76-77`). Both are the pre-ADR-022 numbering left in place:
   after the renumbering in ADR-022 § Decision 6, invariants are **R7** and dependencies are **R8**,
   which is what `.ai/01-operating-model.md:133-134` says. `.ai/board/tickets/CAL-07/04-review.md:10`
   wrote `next_state: QA` — a value ADR-022 removed from the enum — which is the defect arriving in
   an artifact rather than staying in a template. Steward work; the template is not in this ticket's
   `allowed_paths` and a reviewer does not edit it.

2. **Lint cannot run on Node 18 in this repository, and nothing in the tree says so.**
   `eslint.config.js:6` uses an `import … with { type: "json" }` attribute; Node 18.19.1 raises
   `SyntaxError: Unexpected token 'with'` before any rule runs. `.ai/standards/tech-stack.md:51`
   records Node 22, but no `engines` field and no `.nvmrc` pins it, so the failure presents as a
   broken lint config rather than a wrong runtime. 03-impl-log.md § Open questions 2 raised it; this
   session reproduced it. Steward or devops.

3. **The board never recorded READY or IN_PROGRESS for this ticket.** `ticket.yaml:8` carries the
   Developer's note that it arrived at `/implement` reading `BACKLOG`, and `gates.plan` at `:88` is
   still `{ passed: false, at: null }` while `01-plan.md`'s front-matter reads `gate: PASS`. This
   review does not touch `ticket.yaml` — the verdict is this artifact's front-matter and the
   orchestrator moves the board. Named so `/ship` does not have to rediscover it;
   03-impl-log.md § Open questions 1 carries the same.

## Verdict

**PASS.** R1 through R8 each pass with a citation, every contract item in section 4 exists at the
signature it was specified with, and INV-04 is held by four independent citations rather than by the
empty list alone. `next_state: DONE`.
