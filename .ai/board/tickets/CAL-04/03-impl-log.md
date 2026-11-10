---
ticket: CAL-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-04T10:40:00+07:00
inputs_read:
  - .ai/board/tickets/CAL-04/01-plan.md
  - .ai/board/tickets/CAL-04/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/tech-stack.md
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/NewEntry.tsx
  - src/components/EntryForm.tsx
  - supabase/db.sql
  - supabase/seed.sql
  - eslint.config.js
  - ui-language.json
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-04 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260904100000_cal04_team_select.sql` | created | `public.team` had no grant and no policy, so `overload_threshold` was unreadable and AC-7 unsatisfiable. Grants `select` and creates `team_select_own`; grants no `update` to anybody | § 6 |
| `src/lib/domain/types.ts` | modified | `Team`, `DateRange`, `MONTH_ENTRY_LIMIT` and `AbsenceCounts` — the four names § 4 declares. `MONTH_ENTRY_LIMIT` is here and not in `index.ts` for the reason `ROSTER_LIMIT` already records: both implementations need it at runtime and `index.ts` imports both | § 4 items 1–4 |
| `src/lib/data/index.ts` | modified | The two seam declarations, `getTeam()` and `listTeamEntriesOverlapping(range)`, and the `Team`/`DateRange` type imports | § 4 items 5–6 |
| `src/lib/data/absence.ts` | created | INV-04's single implementation, plus the date vocabulary it needs. Called by neither seam implementation, which is § 5's decision | § 4 items 7–9 |
| `src/lib/data/mock.ts` | modified | `teams` table seeded from both team fixtures, and the two reads. Reproduces `team_select_own` and the `date_range=ov.…` predicate, and counts nothing | § 4 items 5–6, § 5 |
| `src/lib/data/supabase.ts` | modified | `TeamRow`, `TEAM_COLUMNS`, `toTeam`, and the two reads. `date_range=ov.[start,end]` is the whole of the month read | § 4 items 5–6, § 5 |
| `src/lib/fixtures.ts` | modified | `FIXTURE_TEAM` and `FIXTURE_OTHER_TEAM` were untyped inline literals; they are now `Team` and carry the `createdAt` the seed already inserts. No value changed and no row was added | § 4 item 1 |
| `src/routes/MonthView.tsx` | created | The screen. Four view states, the Monday-first whole-week grid, avatars, the crowded-day background, month navigation and drag-select | § 2, § 2b, § 4 |
| `src/App.tsx` | modified | `/month` and `/month/:month`, unguarded — the screen renders its own refusal, as `/allow-list` and `/members` do | § 4, "The route" |
| `tests/seam-parity.test.ts` | modified | Parity is necessary and not sufficient: adds the two shapes it cannot see — `getTeam` never answering another team's row, and the read's overlap semantics and absence of a `status` filter | § 4 items 5–6 |
| `tests/absence.test.ts` | created | AC-2 to AC-9 against the pure function, which is where `.ai/standards/testing-standards.md` puts pure logic | § 4 items 7–9 |
| `tests/e2e/cal-04-month-view.spec.ts` | created | AC-1, AC-2, AC-3, AC-7, AC-9, AC-10, AC-12, AC-13, AC-14 through the interface | § 2 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| `Team` | `src/lib/domain/types.ts:225` | Four fields, as declared |
| `DateRange` | `src/lib/domain/types.ts:240` | Inclusive at both ends |
| `MONTH_ENTRY_LIMIT` | `src/lib/domain/types.ts:264` | 2000, as declared |
| `AbsenceCounts` | `src/lib/domain/types.ts:271` | `ReadonlyMap<string, number>` |
| `getTeam()` | `src/lib/data/index.ts:400`, `mock.ts:1018`, `supabase.ts:902` | No parameter; `maybeSingle` in the real one so zero rows is null rather than an error |
| `listTeamEntriesOverlapping(range)` | `src/lib/data/index.ts:425`, `mock.ts:1039`, `supabase.ts:937` | `.filter("date_range", "ov", "[start,end]")`; no `status` filter |
| `absenceCountsFor(entries, range, roster)` | `src/lib/data/absence.ts:167` | Exact signature |
| `absentMembersFor(entries, range, roster)` | `src/lib/data/absence.ts:190` | Same `walk` pass as the counts, so the two cannot disagree |
| `isOverloaded(count, currentMembers, threshold)` | `src/lib/data/absence.ts:223` | Strictly greater; false at zero members |
| The route `/month/:yyyy-MM`, `/month` redirecting | `src/App.tsx:165-166`, `MonthView.tsx:250` | The redirect is in the component, not a second route — see Deviations item 3 |

**Three exported names in `absence.ts` are not in § 4 and are declared here rather than left to be
found:** `addDays`, `eachDateInRange` and `overlapsRange` (the date vocabulary), and
`currentMemberCount`. None is a field name, a database column or an acceptance criterion, so RULE-04
is not engaged — it governs the contract's *names in the data*, and these are local helpers. They are
exported rather than private because `MonthView.tsx` builds the whole-week grid from the same
arithmetic, and a second `addDays` in the view is a second place the UTC rule can be got wrong.
`currentMemberCount` exists so INV-04's denominator — the roster with `removedAt === null` — is
written once instead of at every call site of `isOverloaded`.

## Deviations from the design

**1. The drag-select form is rendered ON the month view, rather than the member being sent to
`/entries/new`.** § 1 says drag-select "hands a date range to CAL-01's existing form", and AC-13
requires that form to open with `start_date` and `end_date` already set.

**It cannot be done by navigation, and this is the one place the plan and `allowed_paths` disagree.**
`src/routes/NewEntry.tsx` passes `initial` with empty dates and reads no search parameter, and it is
not in `allowed_paths` — nor is `EntryForm.tsx`. So `/entries/new?start=…&end=…` would land on a form
that ignores both values, and AC-13 would be unsatisfiable inside RULE-03.

What is built instead: `MonthView.tsx` imports `EntryForm` and renders it with `initial` carrying the
dragged dates. **`EntryForm.tsx` is unchanged** — § 1's "no change to `EntryForm` beyond receiving
pre-filled dates" is satisfied literally, since `initial` is a prop it already takes. **No new save
path exists either**: `onSubmit` calls `seam.createEntry`, which is CAL-01's, and `entry_insert_own`
is what decides the write. The reading of "the grid has no save path" taken here is *this ticket adds
no write mechanism of its own*, and AC-13's "nothing has been written" holds exactly as written — the
form opens on release and stores nothing until the button is pressed.

**A reviewer who reads that sentence as "no form may appear on this screen at all" should route this
back**, and the fix is one of two things: add `NewEntry.tsx` to `allowed_paths` so it can read the
dates off the URL, or drop AC-13. Both are the Tech Lead's, not mine.

**2. `getTeam()` returning null puts the screen in `unavailable`, not in a partial grid.** § 4 says
null is the NotOnATeam answer, and it is — but this screen reaches `getTeam` only *after*
`getCurrentMember` has already answered non-null, so a null team there means the threshold could not
be read while the caller does have a member row. In practice that is one thing: a build where this
ticket's migration has not been applied, since `public.team` carries no policy until then. Drawing
the counts without the overload comparison would be the failure AC-11 is written about one read over
— a believable partial answer with nothing on screen saying the comparison was skipped.
`MonthView.tsx:191`.

**3. `/month` with no anchor redirects from inside the component, not from a second route.**
§ 4 specifies the behaviour and not its location. `App.tsx` holds no clock, and "the current month" is
a fact about the caller's clock; putting `currentMonth()` in the route table would have put a local
date read into the routed shell. The same branch also catches a malformed anchor, for which no
criterion exists and for which a grid of "this month" is the useful answer.

**4. `tests/absence.test.ts` constructs its `Entry` arguments inline.** `.ai/standards/testing-standards.md`
§ Fixtures forbids tests inventing entities, because a fixture living in one test file drifts from
`supabase/seed.sql`. The six shapes INV-04 distinguishes — rejected, tentative, half-day, owned by a
removed member, spanning the range boundary — exist in neither the seed nor the fixture module, and
`supabase/seed.sql` is not in `allowed_paths`, so adding fixtures for them would create exactly the
drift the rule forbids. Every one is spread from `FIXTURE_APPROVED_ENTRY`, so the shape stays the
seed's, and every **member** is imported from the shared module because members are entities and AC-6
turns on a real `removedAt`. The file says so at the top.

**5. `tests/seam-parity.test.ts` grows a second concern.** The standard says "where a shape is
subtle, assert it separately", and the only other test files in `allowed_paths` are `absence.test.ts`
(the pure function) and the acceptance suite. The two mock-behaviour describes sit at the bottom of
the parity file under a heading that says what they are, because the file's own header already frames
the gap they fill. They use `__setCurrentMember`, the test-only hook `mock.ts` already exports beside
`seam` — which mock.ts calls redundant and deletable. It is no longer either.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | **Built here, and in exactly one place.** `absenceCountsFor` (`absence.ts:167`) is the only arithmetic in the product: neither seam implementation counts anything, `MonthView.tsx` calls it rather than filtering, and the only `status` test anywhere is `absence.ts:126`. Every clause is a test: the weights and the type-blindness (`absence.test.ts` AC-3), the exclusion of rejected (AC-4), the removal rule (AC-6), the avatar-follows-the-count rule (asserted on both maps in AC-4 and AC-6), and the current-roster denominator (AC-8). The strict `>` is `absence.ts:225` and is asserted at exactly 3.0-of-6-at-0.5. |
| `INV-05` | `walk` (`absence.ts:114`) reads `status` and never reads `tentative`, so a tentative entry weighs what any other entry weighs. `absence.test.ts` asserts it twice: once directly, and once by comparing a tentative entry against an approved one — the second fails if `tentative` is ever consulted while the first still passes. The dashed reduced-opacity treatment is a class on the chip and touches no count. |
| `INV-07` | No function added here takes a `teamId`, so no caller can ask for another team's data even incorrectly. `getTeam` resolves the team from `member_team_id(auth.uid())` in the policy and from `memberTeamId(currentMemberId)` in the mock; `listTeamEntriesOverlapping` carries no team filter at all in the real implementation, leaving `entry_select_team` as the only scope. Both directions are asserted — the other team's row is present in the mock and never returned, and its own member does receive it. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | includes the § Language rule; `absence.ts`, `MonthView.tsx` and both new test files are English and are not on `copyDebt` |
| `pnpm exec vitest run` | 0 | 3 files, 43 tests, all pass — 36 of them new |
| `pnpm exec playwright test` | 0 | 64 tests, all pass. 9 are new; the other 55 are the existing suites, unedited |
| `node scripts/check-allowed-paths.mjs` | 0 | reports `0 changed file(s)` — see Open questions item 3 |
| `node scripts/check-docs.mjs` | 0 | 0 errors, 2 pre-existing D8 warnings, neither in this ticket's paths |
| `git status --porcelain` subset of `allowed_paths` | yes | 12 paths, plus this ticket's own artifacts |

## Testability contract

01-plan.md carries no selector table — § 2b records that `.ai/standards/ui-design-system.md`
§ Components is `TODO(project)`. Every selector below is therefore declared here, which is what
RULE-16 asks for.

| selector | Exists at |
|----------|-----------|
| `month-loading` | `src/routes/MonthView.tsx:256` |
| `month-not-on-a-team` | `src/routes/MonthView.tsx:264` |
| `month-sign-in` | `src/routes/MonthView.tsx:266` |
| `month-unavailable` | `src/routes/MonthView.tsx:275` |
| `month-home` | `src/routes/MonthView.tsx:298` |
| `month-prev` | `src/routes/MonthView.tsx:304` |
| `month-anchor`, attribute `data-month` | `src/routes/MonthView.tsx:307` |
| `month-next` | `src/routes/MonthView.tsx:310` |
| `month-threshold`, attributes `data-threshold`, `data-current-members` | `src/routes/MonthView.tsx:317` |
| `month-grid` | `src/routes/MonthView.tsx:322` |
| `month-weekday` | `src/routes/MonthView.tsx:324` |
| `month-cell`, attributes `data-date`, `data-in-month`, `data-count`, `data-overloaded` | `src/routes/MonthView.tsx:340` |
| `month-cell-count` | `src/routes/MonthView.tsx:365` |
| `month-avatar`, attributes `data-member-id`, `data-type`, `data-tentative`, `data-status` | `src/routes/MonthView.tsx:383` |
| `month-empty` | `src/routes/MonthView.tsx:419` |
| `month-entry-panel` | `src/routes/MonthView.tsx:428` |
| `month-entry-*` (`-form`, `-type`, `-portion`, `-start`, `-end`, `-tentative`, `-note`, `-error`, `-submit`) | `src/components/EntryForm.tsx`, from the `testIdPrefix` passed at `MonthView.tsx:432` |
| `month-entry-cancel` | `src/routes/MonthView.tsx:446` |

**The counts and the overload verdict are carried as attributes rather than only rendered**, for the
reason CAL-02 carried its two timestamps that way: `2.5` and `2` are one character apart on screen
and a cell is small, and the crowded state is a background colour, which no selector can read.

## Open questions

1. **AC-11 is implemented and asserted by nothing.** Both implementations refuse a read at
   `>= MONTH_ENTRY_LIMIT` and `MonthView.tsx` renders `month-unavailable` on the throw, but no test
   reaches it: the mock's entry table is bounded by the fixtures and cannot approach 2000 rows, and
   making PostgREST cap a read needs a provisioned project. It is the same untested shape
   `ROSTER_LIMIT`, `OWN_ENTRY_LIMIT` and `TEAM_ENTRY_LIMIT` already carry, and the plan's own
   `TODO(verify):` about the datastore's `max-rows` is the reason. **A test hook on the mock —
   a `__seedEntries` beside `__setCurrentMember` — would close this and three earlier tickets'
   equivalents at once**, and it is a chore rather than this ticket's.

2. **The month view is reachable by address only.** `src/routes/Home.tsx` is not in `allowed_paths`,
   so nothing links to `/month` from the landing screen — the same state `/allow-list` and `/members`
   were left in by TEA-02 and TEA-03. The registry calls this the product's DEFAULT view, so somebody
   owes it a link; it is one line in `Home.tsx` and needs a ticket that may touch that file.

3. **`scripts/check-allowed-paths.mjs` reported PASS on `0 changed file(s)` with eight tracked files
   modified.** It diffs `origin/main...HEAD` (line 123), so it sees committed work only — and under
   ADR-006/ADR-023 a ticket stays uncommitted until `/ship`. The check that enforces RULE-03 is
   therefore structurally blind during the only stage that could violate it. **Not touched here**:
   the standing instruction forbids patching the model while a ticket is mid-stage, and this is the
   steward's. The subset assertion in the Verification run above was made by hand from
   `git status --porcelain` instead.

4. **`supabase/db.sql` § 9.1 will stop being true when this merges** and § 6 of the plan already says
   so: the file is regenerated after merge and that block is deleted in the same edit. It is not in
   `allowed_paths` and was not touched.
