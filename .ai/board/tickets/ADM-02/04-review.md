---
ticket: ADM-02
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-05T08:53:04+07:00
inputs_read:
  - .ai/board/tickets/ADM-02/01-plan.md
  - .ai/board/tickets/ADM-02/03-impl-log.md
  - .ai/board/tickets/ADM-02/ticket.yaml
  - .ai/board/tickets/ADM-01/04-review.md
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - .ai/steward/context.md
  - scripts/check-allowed-paths.mjs
  - eslint.config.js
  - .github/workflows/verify.yml
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/routes/Holidays.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - src/hooks/useSession.ts
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20260905120100_adm02_holiday_seed.sql
  - supabase/seed.sql
  - tests/e2e/adm-02-holidays.spec.ts
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# ADM-02 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true.

`next_state` is `DONE` and not `QA`, and the invariant check below is numbered **R7**, not R8.
ADR-022 removed the QA stage; the operating model's checklist at `.ai/01-operating-model.md:125-133`
is authoritative over `.ai/templates/review-report.md:41-49`, which still ships `next_state: QA` and
still heads its invariant section `R8`. This is the same template drift ADM-01's review recorded at
`.ai/board/tickets/ADM-01/04-review.md:39-45` — known debt, not a finding against this ticket.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | Twelve working-tree paths, each matching a glob at `.ai/board/tickets/ADM-02/ticket.yaml:96-107`. Enumerated below, with a note on why the script's exit code is not the evidence. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0. The invocation named in `.ai/standards/testing-standards.md` and run at `.github/workflows/verify.yml:32-34`. |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0. `.github/workflows/verify.yml:35-37`. |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/Holidays.tsx:32` imports `@/lib/data` — the door at `src/lib/data/index.ts:532`. A tree-wide grep for `data/supabase`, `data/mock`, `createClient` and `@supabase/supabase-js` outside `src/lib/data/` returns exactly one hit and it is a comment: `src/routes/Threshold.tsx:17`. The backing lint rule is `eslint.config.js:64-77`. |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | Per-item table below. |
| R6 | Permission gating matches plan section 3 | PASS | Per-row table below. |
| R7 | No invariant violated (RULE-07) | PASS | Per-ID table below. |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` is empty and `git diff --stat` on both is empty — nothing added, removed or moved. `src/routes/Holidays.tsx:28-33` imports only `react`, `react-router-dom` and two first-party modules, all already in the manifest. |

### R1 — the note, because the script's exit code does not establish it

`node scripts/check-allowed-paths.mjs` exits 0 and prints `PASS`, but it also prints
**`0 changed file(s)`**: it diffs `origin/main...HEAD` (`scripts/check-allowed-paths.mjs:122`), and
this ticket is entirely uncommitted, as every stage before `/ship` is. Its PASS is therefore vacuous
pre-ship, and R1 was judged against the working tree instead. `03-impl-log.md:44-45` offers that exit
0 as evidence that "nothing outside the list changed"; the clause is true, but the script is not what
makes it true today. It becomes a real control on the `/ship` commit.

The twelve working-tree paths, checked by hand against the twelve globs — plus
`.ai/board/tickets/ADM-02/**`, which is the ticket's own folder and exempt at
`scripts/check-allowed-paths.mjs:130`:

`supabase/migrations/20260905120000_adm02_holiday.sql`,
`supabase/migrations/20260905120100_adm02_holiday_seed.sql`, `supabase/seed.sql`,
`src/lib/domain/types.ts`, `src/lib/data/index.ts`, `src/lib/data/supabase.ts`,
`src/lib/data/mock.ts`, `src/lib/fixtures.ts`, `src/routes/Holidays.tsx`, `src/routes/Home.tsx`,
`src/App.tsx`, `tests/e2e/adm-02-holidays.spec.ts`. A subset exactly, with nothing left over on
either side.

The files the plan named as deliberately absent are all genuinely unedited: `tests/seam-parity.test.ts`,
`src/lib/data/absence.ts`, the three calendar views, `supabase/db.sql` and `playwright.config.ts`
appear in no `git status` line.

## R5 detail

One row per contract item in `01-plan.md` section 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `HolidayKind` | `src/lib/domain/types.ts:315` | Yes — `"non_working"` and `"working"`, the two values naming the effect and not the label. |
| § 4.1 `Holiday` | `src/lib/domain/types.ts:319-325` | Yes — five fields, `date: string`, no `teamId`. |
| § 4.1 `HOLIDAY_LIMIT` | `src/lib/domain/types.ts:341` | Yes — `1000`, carrying the plan's `TODO(verify):` on the datastore's `max-rows` at `:337-339`. |
| § 4.2 `listHolidays(range)` on the seam | `src/lib/data/index.ts:507` | Yes — `listHolidays(range: DateRange): Promise<Holiday[]>`, the plan's declaration character for character. No team parameter. |
| § 4.3 the real implementation | `src/lib/data/supabase.ts:1072-1100` | Yes — `.gte("date", range.start)`, `.lte(…, range.end)`, `.order("date", { ascending: true })`, `.limit(HOLIDAY_LIMIT)`, in the plan's order. Row shape `:197-203`, columns `:205`, mapper `:207-215`. |
| § 4.3 the truncation refusal | `src/lib/data/supabase.ts:1092-1097` | Yes — `rows.length >= HOLIDAY_LIMIT` throws, the shape `listMembers` already carries. AC-12. |
| § 4.3 the mock | `src/lib/data/mock.ts:1151-1168` | Yes — table at `:313`, the same two string comparisons at `:1152-1153`, sort by `date` at `:1154`, the same refusal at `:1161-1166`. |
| § 4.3 ordering fixed above the datastore in both | `src/lib/data/supabase.ts:1078`, `src/lib/data/mock.ts:1154` | Yes — and nothing re-sorts in the view: `src/routes/Holidays.tsx:189` maps `holidays` as received. |
| § 4.4 the screen, four phases | `src/routes/Holidays.tsx:81-84` | Yes — `loading` `:130-140`, `unavailable` `:142-153`, the rows `:183-219`, the empty-year case `:220-230`. |
| § 4.4 the year is the address | `src/routes/Holidays.tsx:87`, `:94-99`, `:128` | Yes — `YEAR_PATTERN` at `:40`; an absent or malformed anchor redirects to `/holidays/<currentYear()>` inside the component and not in a second route (AC-8, AC-9). |
| § 4.4 the range requested | `src/routes/Holidays.tsx:45` | Yes — `{ start: "<year>-01-01", end: "<year>-12-31" }`. No `Date` is constructed anywhere in the file except `currentYear()` at `:57`, which the plan names as the one correct local read. |
| § 4.4 the twelve selectors | `src/routes/Holidays.tsx:133, 145, 165, 171, 175, 188, 192, 207, 210, 214, 226, 233` | Yes — all twelve at the lines `03-impl-log.md` claims. `holidays-row` carries `data-date` `:193` and `data-kind` `:198`; `holidays-year` carries `data-year` `:171`. |
| § 4.4 the effect in words, not only colour | `src/routes/Holidays.tsx:67-70`, `:214-216` | Yes — `EFFECT_LABEL` renders a word per kind, and lavender (`bg-violet-100`) is applied only to `non_working` at `:204`, which is the separation ADR-015 § 2 asks for. |
| § 4.4 the empty year is about the calendar | `src/routes/Holidays.tsx:226-229` | Yes — *"The calendar does not go as far as {year} yet"*, never "no holidays in {year}". |
| § 4.4 the route, guarded on a session and not a role | `src/App.tsx:236-249` | Yes — `/holidays` `:238` and `/holidays/:year` `:244` render for anything but `signed-out`. `Membership` has exactly three states (`src/hooks/useSession.ts:34, 59-60, 68`), so `!== "signed-out"` is precisely `member` ∪ `member-less` (AC-7). |
| § 4.4 the link on Home, no role condition | `src/routes/Home.tsx:161-167` | Yes — the `<p>` at `:162` carries no membership or role guard, unlike the three admin links below it. |
| § 4.5 the fixtures | `src/lib/fixtures.ts:440, 452, 462, 471`, `:483-488` | Yes — four rows: `2026-06-11` `non_working`, `2026-06-13` `working`, `2026-06-15` `non_working`, `2026-10-15` `non_working`. Weekdays independently recomputed — Thu, Sat, Mon, Thu — all four as the plan states, and 2027 carries no row. Names are Vietnamese with diacritics, which the `userContent` exception requires. |
| § 4.5 the seed, the same literals | `supabase/seed.sql:610-640` | Yes — the same four ids, dates, names, kinds and `created_at`, in the same non-date order as `FIXTURE_HOLIDAYS`. |
| § 6.1 the schema migration | `supabase/migrations/20260905120000_adm02_holiday.sql:14-59` | Yes — transcribed with no statement added or dropped: the enum `:14`, the table `:31-37`, `enable row level security` `:45`, the `revoke` `:46`, `grant select` `:48`, `holiday_select_all` `:58-59`. No write policy, no write grant. |
| § 6.2 the data migration | `supabase/migrations/20260905120100_adm02_holiday_seed.sql:30-33` | Yes — the statement shape and `on conflict (date) do nothing`, rows empty. See *Examined and not a finding* item 1. |

`tests/seam-parity.test.ts` passes unedited with the one function added, which is what plan § 5 asks
for: `pnpm exec vitest run` → **81 tests, 4 files, 0 fail**, and that file appears in no `git status`
line.

## R6 detail

One row per line of `01-plan.md` section 3, including the four denials it states as denials.

| Plan § 3 row | Implemented at | Verdict |
|---|---|---|
| `Read the holiday calendar` ✅ member ✅ admin | `supabase/migrations/20260905120000_adm02_holiday.sql:48` (`grant select … to authenticated`) and `:58-59` (`for select to authenticated using (true)`) | Matches — no role predicate, exactly the ✅/✅ row. |
| `Add, edit or delete a holiday` ❌ member ✅ admin — **not here** | Absent by construction: the file carries no `create policy` for insert, update or delete and no write grant, whole file `:1-59` | Matches. Under ADR-005 an RLS table with no policy for an operation refuses it to everybody, admin included (AC-13). |
| Nobody may write the table after this ticket | `src/lib/data/index.ts:474-507` declares one read and no write; `src/routes/Holidays.tsx` carries no form, button or input | Matches. Asserted through the browser at `tests/e2e/adm-02-holidays.spec.ts:244-254`. |
| `anon` reads nothing | `supabase/migrations/20260905120000_adm02_holiday.sql:46` (`revoke all … from anon, authenticated`), then `:48` grants to `authenticated` alone; the policy at `:58` is `to authenticated`, never `to public` | Matches. The `revoke` is explicit rather than inherited, which is the trap the file's own comment names at `:39-44`. |
| Nothing is scoped by team — the one allowed exception | `using (true)` at `:59`; no `.eq("team_id", …)` in `src/lib/data/supabase.ts:1072-1080`; no caller or team filter in `src/lib/data/mock.ts:1151-1155` | Matches, and the exception is warranted rather than an oversight: the table has no `team_id` column (`:31-37`), and glossary.md's sentence is carried at `:50-54`. AC-14. |
| `public.is_admin(uuid)` is not consulted | No occurrence of `is_admin` in the migration, the seam or the route | Matches. |
| The route guard is an affordance, not the control | `src/App.tsx:238-248` sends `signed-out` to `/` | Matches the plan's own framing: the grant at `:48` is the control, and the guard exists so a stranger is never shown AC-10's notice (AC-6). |

## R7 detail

`invariants_touched: []` at `.ai/board/tickets/ADM-02/ticket.yaml:69`. Reasoned through per ID rather
than asserted, because an empty list is a claim and not an absence.

**The load-bearing fact under all seven: every invariant in the registry constrains `entry`, and this
ticket creates no entry, edits no entry column and touches no entry code path.**
`src/lib/data/absence.ts` — which holds the one definition of the absence count — appears in no
`git status` line, and `entry` is named nowhere in either migration.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 | Overlap is between two `entry` rows of one member. No entry is created or changed and the exclusion constraint is untouched. | `.ai/registry/invariants.md:33`; `supabase/migrations/20260905120000_adm02_holiday.sql:31-37` creates `holiday` and names no `entry` object |
| INV-02 | The reset to `pending` on a substantive edit is `entry_enforce_decision()`'s. No edit path exists here — the seam gained `listHolidays` and nothing else. | `.ai/registry/invariants.md:34`; `src/lib/data/index.ts:474-507` |
| INV-03 | `rejection_reason` is a column of `entry`. `holiday` has no status and no reason column, and no check touching `entry` is added. | `.ai/registry/invariants.md:35`; `supabase/migrations/20260905120000_adm02_holiday.sql:31-37`, five columns and none of them a status |
| INV-04 | A sum over `pending` and `approved` **entries**, and a holiday is not an entry. Nothing here calls `absenceCountsFor`, `src/lib/data/absence.ts` is unedited, and no calendar view consumes `listHolidays` yet. | `.ai/registry/invariants.md:36`; `src/routes/Holidays.tsx:112` is the feature's only call site and it feeds a list, not a count |
| INV-05 | The tentative flag is a column of `entry`. `holiday` has no such column and the screen draws no tentative state. | `.ai/registry/invariants.md:37`; `src/lib/domain/types.ts:319-325` — no `tentative` field on `Holiday` |
| INV-06 | One portion per entry, applying to every date in its range. `holiday` has no portion: a day is `non_working` or `working` for everybody. | `.ai/registry/invariants.md:38`; `src/lib/domain/types.ts:315` |
| INV-07 | **The one worth naming, because it is the one that would be reached for.** It constrains entries and the members they belong to; a holiday row has neither, so it is outside INV-07's scope and `using (true)` does not weaken it. That step is the load-bearing claim in the case for a `team_id`, and ADR-015 § *Rationale* is where it was examined and refused. | `.ai/registry/invariants.md:39` and `:163`; `supabase/migrations/20260905120000_adm02_holiday.sql:16-20` and `:31-37` — no `team_id`, no foreign key |

An invariant held only by a UI affordance is not held — and none of the seven is relied on here at
all, because no entry data is read, written or derived on this branch.

## Findings

None. No check failed, so no routing row is engaged.

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | — | — | — |

## Examined and not a finding

Four things a reader of the diff will stop on. Each was reasoned through, none falls under R1-R8, and
they are recorded so the human merging at `/ship` meets them here rather than discovering them later.

1. **`20260905120100_adm02_holiday_seed.sql` is not valid SQL as it ships, and one of its consequences
   is not the one the plan weighed.** `insert into public.holiday (date, name, kind) values` with only
   commented rows, followed by `on conflict (date) do nothing`
   (`supabase/migrations/20260905120100_adm02_holiday_seed.sql:30-33`), does not parse. The developer
   transcribed the plan literally — `01-plan.md` § 6.2 gives that exact content — and flagged it as
   Open question 1 at `03-impl-log.md:160-169`, which is the correct handling. It is not an R5 failure:
   R5 asks whether the contract is implemented, and it is, exactly.

   **The new fact.** The plan's case for the guard reasons only about `supabase db push`. But
   `.ai/standards/data-model.md:193` and `.ai/board/estimates/2026-09-04-supabase-to-sqlite.md:287`
   both record that `supabase db reset` applies `supabase/migrations/` **and then**
   `supabase/seed.sql` — so this file also stops the documented local bootstrap, and the four
   synthetic rows this ticket adds at `supabase/seed.sql:610-640` are unreachable on that path until a
   human fills the migration. Section 6.2 does not weigh that, and it is the operator's call rather
   than this gate's: the guard still does what it claims, and CI applies no migration at all
   (`.github/workflows/verify.yml` names none), so nothing goes red. If the operator wants the local
   path back, the change is one line and belongs to `tech-lead-design` as a plan amendment, not to
   REWORK.

2. **`supabase/seed.sql:640` conflicts on `(id)` while the table is also `unique (date)`.** That
   matches every other statement in the file and is what the plan asked for, but the two keys can
   disagree: once the seed migration is filled, a real row sharing one of the four fixture dates
   (`2026-06-11`, `2026-06-13`, `2026-06-15`, `2026-10-15`) raises a `date` uniqueness violation rather
   than being skipped, because the conflict target is `id`. None of the four is a Vietnamese public
   holiday, so the collision is unlikely rather than impossible. Outside R1-R8; noted for whoever fills
   the migration.

3. **Seven of the twelve end-to-end tests have a cliff at 1 January 2027.** AC-1, AC-2, AC-3, AC-4,
   AC-10, AC-13 and AC-14 reach the calendar through `home-holidays-link`, which points at `/holidays`
   with no anchor (`src/routes/Home.tsx:166`), so they display the caller's current year and then
   assert the four 2026 fixture rows — `tests/e2e/adm-02-holidays.spec.ts:61` and `:102`. AC-10 is the
   inverse and depends on *next* landing on an empty 2027 (`:226-229`). On 1 January 2027 the first six
   fail and AC-10 asserts against a year that has become the current one. AC-9 shows the resilient
   shape at `:211`. The fixture years are ADR-015 § 5's and are not this ticket's to relocate; recorded
   because the failure will otherwise look like a regression in whatever ticket is in flight that day.

4. **`supabase/db.sql`'s `[OWED] ADM-02` markers go stale at `/ship`.** Declared by the developer at
   `03-impl-log.md:180-184`, and put outside `allowed_paths` by `01-plan.md` § 7 Open question 4 on the
   CAL-04 and ADM-01 precedent. ADR-026 decision point 6 assigns nobody the job of refreshing them.
   Unchanged by this review: a standing model gap rather than an ADM-02 defect.

The three criteria asserted by no test — AC-5, AC-11 and AC-12 — are declared in both
`03-impl-log.md:170-179` and `tests/e2e/adm-02-holidays.spec.ts:11-22`, each with the mechanism that
puts it out of reach until a project is provisioned. Declaring them unassertable is the correct
handling and matches what CAL-05 and CAL-06 each recorded. What the suite does assert everywhere the
calendar should be readable is `holidays-unavailable` at count 0 (`tests/e2e/adm-02-holidays.spec.ts:103`,
`:183`, `:241`), which keeps the failure screen and the empty-year screen from ever being mistaken for
one another.

The three deviations declared at `03-impl-log.md:139-158` — four extra `data-testid`s,
`FIXTURE_HOLIDAYS` deliberately not in date order, and `id`/`createdAt` literals in both the fixtures
and the seed — are additive, justified in place, and none changes a shape section 4 specified.
Deviation 2 in particular is what makes AC-4 a real assertion rather than one that passes by accident
(`src/lib/fixtures.ts:483-488` against `tests/e2e/adm-02-holidays.spec.ts:157`).

## Verdict

**PASS.** R1 through R8 all pass, each citing `file:line`. `next_state: DONE`.
