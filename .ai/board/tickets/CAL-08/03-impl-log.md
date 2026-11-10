---
ticket: CAL-08
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T16:43:37+07:00
inputs_read:
  - .ai/board/tickets/CAL-08/01-plan.md
  - .ai/board/tickets/CAL-08/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/architecture.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - .ai/registry/boundaries.json
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/routes/YearView.tsx
  - src/routes/Holidays.tsx
  - src/routes/Threshold.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - src/components/HolidayForm.tsx
  - tests/absence.test.ts
  - tests/e2e/cal-05-week-view.spec.ts
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/seam.setup.ts
  - eslint.config.js
  - ui-language.json
  - vite.config.ts
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-08 — implementation log

## Files touched

Seven files, all seven inside `allowed_paths`, and no eighth. `node scripts/check-allowed-paths.mjs`
agrees (§ *Verification run*).

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | `NonWorkingReason`, `DayStatus` and `DayStatuses` added beside `Holiday`; nothing existing changes shape, so no existing caller changes | § 4.1 |
| `src/lib/data/day-status.ts` | created | the derivation: `BRIDGE_LOOKAROUND_DAYS`, `holidayReadRange`, `dayStatusesFor`, and the module-private weekend rule | § 4.2 |
| `src/routes/MonthView.tsx` | modified | one added seam read, one memo, and the cell's two attributes plus the name and the bridge badge | § 4.3, § 4.4 |
| `src/routes/WeekView.tsx` | modified | the same read and memo; the day heading gains the two attributes, the name and the badge, and a lavender tint | § 4.3, § 4.4 |
| `src/routes/YearView.tsx` | modified | the same read and memo; a new one-row day-status strip under the month ruler, and the empty-year sentence | § 4.3, § 4.4 |
| `tests/day-status.test.ts` | created | the derivation at the level the standard assigns it, including the three criteria that are assertable nowhere else | § 2 (AC-5, AC-9, AC-15) |
| `tests/e2e/cal-08-holiday-shading.spec.ts` | created | what a person sees, through the interface, for the eleven criteria that have one | § 2, § 4.4 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `NonWorkingReason` | `src/lib/domain/types.ts:378` | verbatim from the plan |
| § 4.1 `DayStatus` | `src/lib/domain/types.ts:387` | five fields, verbatim. NOT a flat union — `bridge` is separate from `working`, which is the requirement `.ai/registry/features.md:95` puts on this type |
| § 4.1 `DayStatuses` | `src/lib/domain/types.ts:403` | `ReadonlyMap<string, DayStatus>`, every date in the range a key |
| § 4.2 `BRIDGE_LOOKAROUND_DAYS` | `src/lib/data/day-status.ts:41` | 7, and the reason it is not 1 is the comment above it |
| § 4.2 `holidayReadRange` | `src/lib/data/day-status.ts:52` | exported, and it is the only pad — the three views call it and none writes an expression |
| § 4.2 the weekend rule | `src/lib/data/day-status.ts:65-68` | module-private and never exported. `getUTCDay`, never `getDay` |
| § 4.2 `dayStatusesFor` | `src/lib/data/day-status.ts:99` | the four numbered rules of § 4.2 in order; `isWorking` is written once and asked three times per date, so the neighbour test cannot become a second definition |
| § 4.3 `MonthView` read | `src/routes/MonthView.tsx:194` | joins the existing `Promise.all`, so AC-12 lands in the `catch` that already exists |
| § 4.3 `MonthView` derivation | `src/routes/MonthView.tsx:264-270` | `useMemo` over the MONTH range, not the whole-weeks grid — which is what makes AC-14 true by construction |
| § 4.3 `WeekView` read / derivation | `src/routes/WeekView.tsx:182`, `:214-220` | same shape |
| § 4.3 `YearView` read / derivation | `src/routes/YearView.tsx:174`, `:247-250` | same shape |
| § 4.3 `YearView` AC-8 | `src/routes/YearView.tsx:530` | reads `view.holidays.length`, not the statuses — every date is a key there, so the map can never answer it |
| § 5 seam impact `none` | — | `src/lib/data/index.ts`, `mock.ts` and `supabase.ts` are untouched. `listHolidays` is called with a wider range and is not one character different |
| § 6 schema delta `none` | — | no migration, no policy, no grant. `supabase/` is untouched |

## Deviations from the design

**Three, all of them additive to the selector table, and none of them a behaviour change.**

1. **`week-day-label` gained a background class and two layout classes** (`src/routes/WeekView.tsx:341-346`).
   § 2b says a non-working holiday *"tints the section header lavender"*, and the heading was
   previously an unpadded `h2` inside the section's own padding — a tint on it would have been a
   band that did not reach the section's edges. The negative margins pull it to them. No selector
   changes and no attribute moves.

2. **The year strip carries a row label, `Calendar`, in its sticky first column**
   (`src/routes/YearView.tsx:390`). § 2b specifies the strip's cells and not its label; the totals
   strip below it already carries `Away` in the same column, and a strip with an empty label column
   reads as a row that lost its name. It carries no `data-testid`, so nothing in the selector table
   is affected.

3. **The bridge dot inside `year-daystatus-cell` is an unlabelled `aria-hidden` span**
   (`src/routes/YearView.tsx:414`). § 4.4 gives the cell `data-bridge` and no child selector, so the
   dot deliberately does NOT get a `data-testid` — the criterion turns on the attribute, and adding
   a selector the table does not name would put a second, weaker way to ask the same question in
   reach of a test.

**Everything else is § 4.1 through § 4.4 as written, including the three attribute values and not
four.** `data-day-status` carries `working`, `weekend` or `holiday`; `bridge` is `data-bridge`,
because a bridge day IS a working day and folding it in would rebuild the flat union the feature row
forbids.

**The two assumptions the plan ships under are implemented as the plan states them and are NOT
resolved here.** A1 (a bridge run is exactly one working day) and A2 (the two bounding days are any
two non-working days) are `src/lib/data/day-status.ts:130`, one predicate. Both carry a
`TODO(project)` in `tests/day-status.test.ts`, where the tests that change when the operator answers
are grouped under their own two `describe` blocks so the cost the plan predicts — *"one predicate in
`day-status.ts` and the unit tests for it"* — is visible rather than scattered.

## Invariants

`invariants_touched: []`, so this table is the argument that the empty list is right rather than a
row saying nothing was affected.

| ID | Still holds because |
|----|---------------------|
| INV-04 (declared `[]`, argued here) | Nothing in the diff reaches the absence count. `absenceCountsFor`, `absentMembersFor`, `absentEntriesFor` and `absentDatesByMember` are unmodified; `day-status.ts` imports `addDays` and `eachDateInRange` from `absence.ts` and nothing else, and exports nothing that `absence.ts` consumes. The two derivations share no argument and no module state, which is the mechanical form of *"this row must not implement suppression"*. The three views compute the count from the same call they made before this ticket, and `isOverloaded` is still the only comparison. AC-9 and AC-10 assert it from outside: `tests/day-status.test.ts` runs the arithmetic across a holiday date and gets the working day's number, and the e2e suite reads the same count off the cell with a holiday named on it and the overloaded marking still set. |

**The counter-argument is recorded rather than smoothed over**, because
`.ai/registry/invariants.md` § *How to use this file* warns that choosing the safe behaviour and then
concluding no invariant is engaged is circular. Suppression was available at three points in this
diff — the cell's count, the overload class, and the year totals strip — and was refused at all three.
On that reading INV-04 was in play. `features.md:95` says `[]` and RULE-04 makes the row the source,
so `[]` stands; check R8 has both halves here and in 01-plan.md section 2.

## Verification run

Commands actually executed, with exit codes.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | includes RULE-02's boundary rule and § Language. `day-status.ts` is new, is English throughout, and is NOT added to `ui-language.json`'s `copyDebt` — that list only ever shrinks |
| unit — `pnpm exec vitest run` | 0 | 7 files, 148 tests, all pass. 23 of them are this ticket's |
| unit under `TZ=America/Los_Angeles` | 0 | 148 pass. AC-15, and the run that would fail on a `getDay()` implementation |
| unit under `TZ=Asia/Ho_Chi_Minh` | 0 | 148 pass. The run ADR-015 *Consequences* predicts would pass regardless, kept so the three are comparable |
| end-to-end — `pnpm exec playwright test` | 0 | **145 pass, 0 fail**, seam guard included. 12 of them are this ticket's; the CAL-04, CAL-05 and CAL-06 suites pass UNEDITED, which is the role 01-plan.md section 7 assigns them |
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS` |
| `git diff --name-only` subset of `allowed_paths` | yes | seven files, all seven listed above |

**The environment needed two fixes before any of the above could run, and neither is a repository
change.** `node_modules` was absent, and the machine's Node was 18.19.1 against a recorded major of
22 (`.ai/standards/tech-stack.md:51`) — `eslint.config.js` uses an `import … with { type: "json" }`
attribute, which Node 18 cannot parse, so lint exited 2 with `SyntaxError: Unexpected token 'with'`
until Node 22 was on the path. Nothing in the repository was edited to make the commands run. It is
worth a reader knowing that **lint is not runnable on Node 18 in this repository**, and the failure
is a parse error in the config rather than anything resembling a lint finding.

## Testability contract

Every selector in 01-plan.md § 4.4, and where it now exists.

| selector | Exists at |
|----------|-----------|
| `month-cell` — `data-day-status`, `data-bridge` | `src/routes/MonthView.tsx:410-411` |
| `month-cell-holiday` — `data-kind`, text is `holiday.name` | `src/routes/MonthView.tsx:454` |
| `month-cell-bridge` | `src/routes/MonthView.tsx:464` |
| `week-day` — `data-day-status`, `data-bridge` | `src/routes/WeekView.tsx:334-335` |
| `week-day-holiday` — `data-kind`, text is `holiday.name` | `src/routes/WeekView.tsx:355` |
| `week-day-bridge` | `src/routes/WeekView.tsx:364` |
| `year-daystatus` | `src/routes/YearView.tsx:389` |
| `year-daystatus-cell` — `data-date`, `data-day-status`, `data-bridge`, `title` | `src/routes/YearView.tsx:398-403` |
| `year-holidays-empty` | `src/routes/YearView.tsx:530` |

**Every existing selector is unchanged**, which the CAL-04, CAL-05 and CAL-06 suites confirm by
passing unedited.

## Where each acceptance criterion is asserted

| AC | Unit | End-to-end |
|----|------|------------|
| AC-1 non-working holiday drawn and named | ✅ | ✅ |
| AC-2 mandated working Saturday | ✅ | ✅ |
| AC-3 bridge day marked, not a holiday | ✅ | ✅ |
| AC-4 the two-input false positive | ✅ (both directions) | ✅ |
| AC-5 bridge-ness at the range edges | ✅ | — invisible by construction, see below |
| AC-6 the week agrees with the month | — | ✅ |
| AC-7 the year carries every day | ✅ | ✅ |
| AC-8 an empty year says so | ✅ (no rows in 2027) | ✅ (the sentence) |
| AC-9 no suppression | ✅ | ✅ |
| AC-10 an overloaded holiday keeps both signals | — | ✅ |
| AC-11 the three views agree | ✅ (one derivation, month against year) | ✅ (all three, walked by the product's own links) |
| AC-12 a failed or truncated holiday read | — | — see below |
| AC-13 both roles, and no control | — | ✅ |
| AC-14 out-of-month cells carry no day status | — | ✅ |
| AC-15 timezone independence | ✅ | — |

**AC-5, AC-12 and AC-15 have no end-to-end assertion, and that is declared rather than left to be
noticed.** It is the shape CAL-05 recorded for its AC-10, AC-11 and AC-15 and CAL-06 for its AC-7,
AC-8 and AC-14.

- **AC-5** is invisible through the interface *by construction*: all three views pad their own read,
  so a screen that answered the edges wrongly would look correct. The unit test asserts both
  directions, including that the **bare** range answers `bridge: false` for 2026-10-16 — without that
  half, the criterion would pass against a function that never looked outside the range.
- **AC-12** is a throw inside the seam. The mock's holiday table holds five rows at most in this
  suite and cannot reach `HOLIDAY_LIMIT`, and no test can make PostgREST cap a read without a
  provisioned project. The BRANCH is the `unavailable` state each view already renders and each
  earlier suite already covers; what is untested is the throw arriving at it. Same untested shape as
  `ROSTER_LIMIT`, `OWN_ENTRY_LIMIT`, `TEAM_ENTRY_LIMIT`, CAL-04 AC-11 and ADM-02 AC-12.
- **AC-15** needs the process timezone changed under the derivation, which a browser test cannot do.
  The unit test flips `process.env.TZ` across UTC, ICT and `America/Los_Angeles` and — the part that
  makes the agreement mean something — also asserts that a naive local weekday read *would* differ,
  so the test is capable of failing.

## Open questions

**1. `ticket.yaml` arrived at IN_PROGRESS with `state: BACKLOG` and `branch: ""`.** 01-plan.md's
front-matter reads `gate: PASS` / `next_state: READY`, the branch `feat/CAL-08` exists and this
session ran on it, but neither field was written at PLAN — CAL-07's shell records both as
`tech-lead-design`'s at that stage. This log sets `state: REVIEW` because the command says to, and
fills `branch: "feat/CAL-08"` because it is a verified fact about the tree and an empty string
misreports it. **It does NOT touch `gates.plan`**, which CAL-07's shell records as `orchestrator`'s at
`/ship`, quoted from the artifact's front-matter. So the board never records that this ticket was
READY or IN_PROGRESS, and `/next-ticket`'s Definition of Ready grade — which leaves no file — cannot
be reconstructed for it. Worth the orchestrator's attention at `/ship`; not repairable from here
without inventing two transitions that have no artifact behind them.

**2. `.ai/standards/tech-stack.md` records Node 22 and this machine had 18.19.1**, on which
`pnpm exec eslint .` cannot start: `eslint.config.js:6` uses `import … with { type: "json" }` and
Node 18 raises `SyntaxError: Unexpected token 'with'` before any rule runs. Every command in the
table above was run under Node 22. No engines field pins it and no `.nvmrc` exists, so the next
session on a Node 18 machine will read that parse error as a broken lint config rather than as a
wrong runtime. That is steward or devops work and is named here rather than fixed — `package.json` is
outside this ticket's `allowed_paths`.

**3. A `page.goto` resets the mock's tables but NOT its session.** `src/lib/data/mock.ts:152-167`
writes the session to `localStorage`, matching `@supabase/auth-js`'s default, and restores it on
load. Every suite from CAL-01 onwards records that a reload loses the mock's state, which is true of
the tables and false of the session; AC-13 needs two people to look at one screen and therefore signs
the first one out explicitly (`signOutIfSignedIn`, declared at the helper). Found by running the
suite, not by reading. The earlier suites are not wrong — none of them signs in twice — but the
sentence they all repeat is half true, and the next person to write a two-person test will hit it.

**4. `src/lib/data/absence.ts` is now imported by a module it has nothing to do with.**
`day-status.ts` takes `addDays` and `eachDateInRange` from it, which couples the holiday calendar to
INV-04's module. 01-plan.md section 8, rejected alternative 4 records that the date vocabulary
arguably belongs in `src/lib/data/dates.ts` and rejects the extraction on footprint — it would pull
`absence.ts` and all of its importers into `allowed_paths` for a move that changes no behaviour. It
is a chore, it is worth doing, and it belongs to a session that is doing chores. Nothing here depends
on it happening.

**5. `mondayIndex` is still duplicated in `MonthView.tsx` and `WeekView.tsx`,** and this ticket adds
a third UTC weekday read — `isWeekend` in `day-status.ts`. The third one is deliberately NOT the same
function: the views' answers *"which column is this date in"* and the module's answers *"is this a
weekend"*, and 01-plan.md section 4.2 requires the weekend rule to be module-private and unexported
precisely so nothing outside can ask it. CAL-05's log already carries the first duplication as an
open question; this note is here so a reviewer does not read the third read as a fourth copy of the
same decision.
