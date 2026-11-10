---
ticket: ADM-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T08:46:43+07:00
inputs_read:
  - .ai/board/tickets/ADM-02/01-plan.md
  - .ai/board/tickets/ADM-02/ticket.yaml
  - .ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md
  - .ai/standards/testing-standards.md
  - supabase/db.sql
  - supabase/seed.sql
  - supabase/migrations/20260904100000_cal04_team_select.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/YearView.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - tests/seam-parity.test.ts
  - tests/ui-language.test.ts
  - tests/e2e/adm-01-threshold.spec.ts
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/seam.setup.ts
  - playwright.config.ts
  - eslint.config.js
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# ADM-02 — implementation log

## Files touched

Twelve files, twelve `allowed_paths` globs, four of them new. `node scripts/check-allowed-paths.mjs`
exits 0 and nothing outside the list changed.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260905120000_adm02_holiday.sql` | created | The enum, the table, RLS, the revoke, the select grant and `holiday_select_all`. The read half only — the three write policies and the write grant are ADM-03's. | § 6.1 |
| `supabase/migrations/20260905120100_adm02_holiday_seed.sql` | created | The data migration's shape, its `on conflict (date) do nothing` clause and the banner saying who fills it. Ships with no rows, by design. | § 6.2 |
| `supabase/seed.sql` | modified | The four synthetic rows, same literals as `src/lib/fixtures.ts`. Deliberately not the real calendar. | § 4.5 |
| `src/lib/domain/types.ts` | modified | `HolidayKind`, `Holiday` and `HOLIDAY_LIMIT`. Nothing existing changed shape. | § 4.1 |
| `src/lib/data/index.ts` | modified | `listHolidays(range)` declared on `DataSeam`, with the contract that binds both implementations. | § 4.2 |
| `src/lib/data/supabase.ts` | modified | `HolidayRow`, `HOLIDAY_COLUMNS`, `toHoliday` and `listHolidays` — the two-sided scalar filter and the truncation refusal. | § 4.3 |
| `src/lib/data/mock.ts` | modified | The mock's `holiday` table seeded from the fixtures, and `listHolidays` with the same predicate, the same sort and the same refusal. | § 4.3 |
| `src/lib/fixtures.ts` | modified | The four synthetic rows as `Holiday` constants plus `FIXTURE_HOLIDAYS`. Vietnamese names, which the `userContent` exception requires. | § 4.5 |
| `src/routes/Holidays.tsx` | created | The screen: the year in the address, one row per holiday, the past-the-horizon notice, the failure notice. | § 4.4 |
| `src/routes/Home.tsx` | modified | One `<Link>` to `/holidays`, shown to both roles under no role condition. | § 4.4, AC-15 |
| `src/App.tsx` | modified | `/holidays` and `/holidays/:year`, guarded on a session and not on a role. | § 4.4 |
| `tests/e2e/adm-02-holidays.spec.ts` | created | Twelve of the fifteen criteria through the browser; the other three are declared below. | § 2 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| § 4.1 `HolidayKind` | `src/lib/domain/types.ts:315` | Two values, naming the effect and not the label. |
| § 4.1 `Holiday` | `src/lib/domain/types.ts:319` | Five fields, no `teamId`. `date` is a string and never a `Date`. |
| § 4.1 `HOLIDAY_LIMIT` | `src/lib/domain/types.ts:341` | 1000, carrying the same `TODO(verify):` on the datastore's `max-rows` as the four limits above it. |
| § 4.2 `listHolidays(range)` | `src/lib/data/index.ts:507` | One function, no team parameter, throws on failure and on truncation. |
| § 4.3 the real implementation | `src/lib/data/supabase.ts:1072` | `gte`/`lte`/`order`/`limit`, exactly the plan's snippet. Row shape at `:197`, mapper at `:207`. |
| § 4.3 the mock | `src/lib/data/mock.ts:1151` | Table at `:313`, same two string comparisons, same sort, same refusal. |
| § 4.4 the screen | `src/routes/Holidays.tsx` | Four phases; `loading` `:133`, `unavailable` `:145`, the rows `:188`, the empty-year notice `:226`. |
| § 4.4 the route | `src/App.tsx:238` and `:244` | Both addresses, `signed-out` redirected to `/`. |
| § 4.4 the link | `src/routes/Home.tsx:166` | No role condition. |
| § 4.5 the fixtures | `src/lib/fixtures.ts:483` | Four rows plus `FIXTURE_HOLIDAYS`. |
| § 4.5 the seed | `supabase/seed.sql:610` | The same four literals. |
| § 6.1 the schema migration | `supabase/migrations/20260905120000_adm02_holiday.sql` | Transcribed from the plan without change. |
| § 6.2 the data migration | `supabase/migrations/20260905120100_adm02_holiday_seed.sql` | Transcribed from the plan; see Open questions 1. |

## Deviations from the design

Three, all additive, none changing a specified shape.

1. **Four `data-testid`s exist that section 4.4's table does not name:** `holidays-list` on the
   `<ol>`, and `holidays-row-date`, `holidays-row-name` and `holidays-row-effect` inside a row. The
   table names `holidays-row` carrying `data-date` and `data-kind`, and says a row "shows its date,
   its name and its effect". AC-3 asserts that the effect is *a word, not only a colour*, and a test
   for that needs to address the word — with only the row's own id it would have to read the whole
   row's text and match a substring, which passes when the effect appears anywhere including inside
   the name. The three ids make AC-3 an assertion about the element that carries the claim.
   `holidays-list` is the container the three sit in and costs nothing.

2. **`FIXTURE_HOLIDAYS` is exported and is deliberately NOT in date order.** Section 4.5 specifies
   four rows and does not specify an array. The mock seeds from one, and the order it seeds in is
   what makes AC-4 a real assertion: a mock that returned its table unsorted would pass a
   date-ordered fixture list by accident. The seed inserts in the same non-date order for the same
   reason.

3. **`FIXTURE_HOLIDAY_*` carry `id` and `createdAt` literals, and `supabase/seed.sql` names both
   columns.** Section 4.5 specifies the date, the name and the kind. `Holiday` has five fields and a
   fixture cannot be typed without all five; naming them in the seed rather than defaulting `id` is
   the rule this module states at its own head — the same literals in both files, so
   `on conflict (id) do nothing` behaves the way every other statement in that file does. The uuid
   prefix `cc000000-…` was checked as unused in `src/lib/fixtures.ts`, `supabase/seed.sql` and
   `src/lib/data/mock.ts` before it was chosen.

**No amendment was needed and `tech-lead-design` was not consulted.** `99-questions.md` was not
written and the `developer->tech-lead-design` budget is untouched at 0 of 6.

## Invariants

`invariants_touched: []`, and the plan states the reason rather than leaving it absent. Restated
here in the form this section asks for, so a reviewer sees the case was considered rather than
skipped.

| ID | Still holds because |
|----|---------------------|
| INV-01 | It constrains overlapping `entry` rows for one member. This ticket creates no entry, changes no entry column, and touches neither `createEntry` nor `updateEntry`; `src/lib/data/absence.ts` and the exclusion constraint are unedited. |
| INV-02 | The reset of a decision on a substantive edit is `entry_enforce_decision()`'s. No edit path exists here — the screen has no control at all (AC-13, asserted) and the seam gained a read and no write. |
| INV-03 | `rejection_reason` is a column of `entry`. `holiday` has no status and no reason, and the migration adds no check touching `entry`. |
| INV-04 | A sum over entries, and **a holiday is not an entry**. The absence count is unchanged: `absence.ts` is not in `allowed_paths`, nothing here calls `absenceCountsFor`, and a holiday does not silence the crowded-day warning — that is CAL-08's question and ADR-015 § Consequences says so. |
| INV-05 | The tentative flag is a column of `entry`. `holiday` has no such column and the screen draws no tentative state. |
| INV-06 | One portion per entry, applying to every date in its range. `holiday` has no portion — a day is `non_working` or `working` for everybody, which is the whole of ADR-015 § 1. |
| INV-07 | **The one worth naming, because it is the one that would be reached for and it does not hold here.** It constrains entries and the members they belong to; a holiday row has neither a member nor a team. That step — *"INV-07 makes team a real property of the data"* — is the load-bearing claim in the case for a `team_id`, and ADR-015 § Rationale is where it was examined and refused. `holiday_select_all` is `using (true)` and AC-14 asserts the consequence through the browser. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, the command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | lint. `src/routes/Holidays.tsx` is not on `ui-language.json`'s lists, so its copy is English and the rule is in force on it. `src/lib/fixtures.ts` is `userContent` and keeps its diacritics. |
| `pnpm exec vitest run` | 0 | **81 tests, 4 files, all pass.** `tests/seam-parity.test.ts` passes UNEDITED with `listHolidays` added, which is what section 5 asks for. `tests/ui-language.test.ts` passes, so the diacritics in the new fixture names are real characters and not escapes. |
| `pnpm exec playwright test` | 0 | **108 tests, all pass** — 13 of them this ticket's, including the seam guard. No earlier suite was edited and none regressed. |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS. `git status --porcelain` outside `.ai/board/tickets/ADM-02/` is a subset of the twelve globs. |

Neither migration was applied. Applying them is human — RULE-09 — and the seed migration must not be
applied at all until it is filled.

## Testability contract

Section 4.4's table, plus the four ids declared as deviation 1 and the two links this ticket adds.

| selector | Exists at |
|----------|-----------|
| `holidays-loading` | `src/routes/Holidays.tsx:133` |
| `holidays-unavailable` | `src/routes/Holidays.tsx:145` |
| `holidays-prev` | `src/routes/Holidays.tsx:165` |
| `holidays-year` | `src/routes/Holidays.tsx:171` (carries `data-year`) |
| `holidays-next` | `src/routes/Holidays.tsx:175` |
| `holidays-list` | `src/routes/Holidays.tsx:188` |
| `holidays-row` | `src/routes/Holidays.tsx:192` (carries `data-date` and `data-kind`) |
| `holidays-row-date` | `src/routes/Holidays.tsx:207` |
| `holidays-row-name` | `src/routes/Holidays.tsx:210` |
| `holidays-row-effect` | `src/routes/Holidays.tsx:214` |
| `holidays-beyond-calendar` | `src/routes/Holidays.tsx:226` |
| `holidays-back` | `src/routes/Holidays.tsx:233` |
| `home-holidays-link` | `src/routes/Home.tsx:166` |

## Open questions

1. **The seed migration is not valid SQL as it ships, and that is the fail-closed half of the plan's
   own decision — but a reviewer should decide whether to keep it.** Section 6.2 gives the file's
   content literally: an `insert … values` whose only rows are comments, followed by
   `on conflict (date) do nothing`. PostgreSQL rejects that at parse time. It was transcribed rather
   than "fixed", because the alternative — commenting the statement out too, or shipping a valid
   zero-row form — makes `supabase db push` succeed on an empty calendar, and the file's own banner
   says it MUST NOT be applied until a human fills it. As it stands, a push before that happens stops
   with a parse error on this file, after the schema migration beside it has already applied. The
   comment block in the file records this so the human who opens it is not surprised. If the reviewer
   reads the parse error as a defect rather than as a guard, the fix is one line and needs a design
   amendment, not a rework of anything else.

2. **Three criteria are asserted nowhere, and each is a mechanism no test in this repository can
   reach.** Declared in the spec file's header as well, so a reader of either finds it.
   - **AC-5** — `unique (date)` refusing a second row for a date. Nothing in the product can insert a
     holiday at all on this branch: that is AC-13, and it is the read-path-then-write-path split
     working. The constraint is exercised by no test until a project is provisioned.
   - **AC-11** — a failed read showing a failure. The mock never throws for transport reasons and
     there is no fault-injection hook on the seam.
   - **AC-12** — the truncation refusal. The mock's table is four fixture rows and cannot reach
     `HOLIDAY_LIMIT`; no test can make PostgREST cap a read without a provisioned project.

   What the suite *does* assert, at every point where the calendar is expected to be readable, is
   that `holidays-unavailable` has count 0 — so the failure screen and the empty-year screen can
   never be confused for each other by accident, which is the pairing AC-10, AC-11 and AC-12 exist to
   keep apart.

3. **`supabase/db.sql` is now stale and this ticket deliberately did not touch it.** Its `[OWED]
   ADM-02` markers at lines 104, 219 and 879 stop being true at `/ship`. Plan Open question 4 names
   this and puts the file outside `allowed_paths` on the CAL-04 and ADM-01 precedent; ADR-026
   decision point 6 assigns nobody the job of keeping those markers current. Recorded here so the
   reviewer meets it as a known gap rather than as an omission.

4. **`__setCurrentMember` in `src/lib/data/mock.ts` is still exported and is still unused by the
   application.** TEA-05 left a note saying "the next ticket to touch this file can delete it".
   `tests/seam-parity.test.ts` uses it for CAL-04's shape assertions, so it is not dead — and
   deleting it is not this ticket's to do anyway: that test file is deliberately outside
   `allowed_paths`. Noted so the note itself does not go stale unread.
