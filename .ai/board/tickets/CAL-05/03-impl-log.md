---
ticket: CAL-05
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-04T14:50:30+07:00
inputs_read:
  - .ai/board/tickets/CAL-05/01-plan.md
  - .ai/board/tickets/CAL-05/ticket.yaml
  - .ai/steward/context.md
  - .ai/standards/testing-standards.md
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/routes/MonthView.tsx
  - src/routes/Home.tsx
  - src/routes/NewEntry.tsx
  - src/components/EntryForm.tsx
  - tests/absence.test.ts
  - tests/e2e/cal-04-month-view.spec.ts
  - tests/ui-language.test.ts
  - eslint.config.js
  - playwright.config.ts
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-05 — implementation log

## Files touched

Eight files, exactly the eight in `allowed_paths`. Two created.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | `AbsenceDetail` had to exist before either the derivation or the view could name it, and § 4.1 puts it here beside `AbsenceCounts` so a component holds it without importing the seam | §4.1 item 1 |
| `src/lib/data/absence.ts` | modified | the third derivation, `absentEntriesFor`, plus the ordering comparator § 4.1 fixes here rather than leaving to the datastore | §4.1 items 2, 3 |
| `src/routes/WeekView.tsx` | created | the screen: seven day sections, one row per absent person per day, and the three non-list states | §4.2, §4.3 |
| `src/routes/MonthView.tsx` | modified | one header link, `month-week`, and nothing else in the file | §4.3, §7 |
| `src/routes/Home.tsx` | modified | one link, `home-week-link`, and nothing else in the file — without it the week view is reachable only by address | §7 |
| `src/App.tsx` | modified | the two routes `/week` and `/week/:day`, mirroring how `/month` and `/month/:month` are declared | §4.3 |
| `tests/absence.test.ts` | modified | the unit half: the derivation's contract, its ordering, and AC-10 and AC-11, which have no interface | §4.1 |
| `tests/e2e/cal-05-week-view.spec.ts` | created | the interface half: what a person sees, and — AC-8 — the controls that are not there | §4.3 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 item 1 — `AbsenceDetail { entry, member }` | `src/lib/domain/types.ts:292` | field names and types exactly as the plan writes them; nothing added |
| §4.1 item 2 — `absentEntriesFor(entries, range, roster)` | `src/lib/data/absence.ts:263` | signature and return type character-for-character the plan's. It calls `walk` and narrows nothing itself, so INV-04's rules are read and never restated |
| §4.1 item 3 — ordering: `displayName`, then `portion` as `full, am, pm`, then `entry.id` | `src/lib/data/absence.ts:166-171` | `PORTION_ORDER` is the plan's stated order. The collation is pinned to `vi` — see Deviations item 1 |
| §4.2 — exactly three seam calls, no fourth, no write | `src/routes/WeekView.tsx:153-168` | `getCurrentMember`, `listMembers`, `listTeamEntriesOverlapping`. `getTeam` is absent, so is every write. The file's whole import list is four lines and a reviewer checks AC-8 from it |
| §4.2 — `MONTH_ENTRY_LIMIT` reused, no new constant | nothing added | no constant was written; the limit is enforced inside the seam and AC-15 renders the throw it already performs |
| §4.3 — route `/week/:day`, plus `/week` redirecting to the current week | `src/App.tsx:182-183`, `src/routes/WeekView.tsx:201` | the redirect is the component's, not a second route's — "what day is it" is a fact about the caller's clock and `App.tsx` holds none, the same split `/month` already uses |
| §4.3 — any day of a week resolves to its Monday | `src/routes/WeekView.tsx:136-139` | the URL is NOT rewritten to the Monday: the anchor keeps the date the caller arrived with, and `week-anchor` carries the resolved Monday as `data-week-start` |
| §4.3 — header: home, previous, anchor, next, month | `src/routes/WeekView.tsx:249-279` | |
| §4.3 — seven sections, always, in reading order | `src/routes/WeekView.tsx:284-290` | driven by `eachDateInRange`, so "seven" is the range and not a literal |
| §4.3 — one row per absent person per day, in §4.1's order | `src/routes/WeekView.tsx:308-399` | keyed by `entry.id`, not by member: one person's `am` and `pm` are two rows here and one avatar on the month |
| §4.3 — palette per `CLAUDE.md` § Visual direction | `src/routes/WeekView.tsx:335-343`, `:396` | PTO peach, WFH mint, tentative dashed at reduced opacity, approved carrying a star. No overload colour anywhere |
| §4.3 — the selector table | see § Testability contract below | every one exists; two more were added and are declared |
| §5 — seam impact none | nothing touched | `src/lib/data/index.ts`, `mock.ts`, `supabase.ts` and `tests/seam-parity.test.ts` are unmodified |
| §6 — schema delta none | nothing touched | no `.sql` file of any kind was written |

## Deviations from the design

Five, all additive and all in the layout half of the plan. Nothing about behaviour, permissions,
field names or invariants deviates.

1. **The ordering comparator names the collation.** § 4.1 says *by member `displayName` ascending*
   and stops there. `localeCompare` with no locale argument reads the host's, so the same rows would
   order one way in CI and another on a laptop — which is precisely the divergence the plan puts the
   ordering above the seam to prevent, arriving through a different door. It is pinned to `vi`
   (`src/lib/data/absence.ts:169`), which is also the right answer for these names: `Đ` sorts after
   `D` and not after `T`.

2. **`week-sign-in` is a selector the § 4.3 table does not list.** The table says the three non-list
   states mirror `month-loading`, `month-not-on-a-team` and `month-unavailable`, and
   `month-not-on-a-team` carries a `month-sign-in` link inside it — so mirroring it means carrying
   the link. It is also load-bearing for the suite: the mock's session lives in module memory, a
   `page.goto` after signing in loses it, and without a sign-in link on this screen no test can reach
   the week view as a signed-in member without a document load.

3. **`home-week-link` is the name of Home's one link.** § 7 grants Home *one link and nothing else*
   and does not name its selector. `home-` is that file's existing convention
   (`home-allow-list-link`, `home-team-entries-link`, `home-new-entry-link`). It points at `/week`
   with no anchor so the date is resolved in the one place that resolves dates.

4. **`week-row-approver` carries `data-approver-id` as well as the name.** One extra attribute, so a
   test can assert *which* admin without matching a display name that § Language may later reword.
   Additive; nothing in the table changed.

5. **`mondayIndex` is a three-line copy of the same helper in `MonthView.tsx`.** § 7 gives that file
   *one link and nothing else*, so lifting the helper into `@/lib/data/absence` and rewriting the
   month's import is scope this ticket does not have. Recorded again in § Open questions.

**Two targets the plan leaves open, decided here and worth a reviewer's eye:**

- **`month-week` points at the first of the displayed month** (`src/routes/MonthView.tsx:322`). The
  month's anchor is a month, not a date, so there is no date to keep; the first is the only
  non-arbitrary one.
- **`week-month` points at the month of the day in the URL, not the month of the Monday**
  (`src/routes/WeekView.tsx:273-277`). AC-14 is titled *keeps the date*, and for a week spanning a month
  boundary those two are different months — the Monday's would drop the date the caller was
  looking at.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The view derives nothing. `absentEntriesFor` reads the same `walk` that `absenceCountsFor` and `absentMembersFor` read, so the rejected exclusion, the tentative blindness, the removal clause and the range clamp are applied once and read three times. There is no `.filter`, no `.status` test and no date comparison anywhere in `WeekView.tsx` — a week list could only disagree with a month cell if `walk` itself were wrong, and `tests/absence.test.ts` "CAL-05 AC-12" re-derives the month's count from the week's rows on every date of a week holding four rows, three people and 2.5 to prove it |
| `INV-05` | `walk` never reads `tentative`, so membership of the list cannot turn on it; the marking is what the view does with the flag it is handed. The unit test lists a tentative and a settled entry on one date and asserts both are present, and the e2e suite asserts the tentative row is listed AND additionally marked |
| `INV-07` | No read is added. `entry_select_team` and `member_select_team` already scope both reads to the caller's team, and the approver is resolved against the roster those same reads returned — so no name from another team can reach the screen even as an approver. The e2e suite asserts it positively: the week of 21 September holds exactly one fixture entry, it belongs to the other team, and all seven days render empty |
| `INV-06` (relied on, not chosen) | The row calls this the only surface where it is visible. `portion` is read off the entry on every date the entry covers, so a five-day `pm` renders five afternoons and cannot render a whole day in the middle. Asserted at both levels — `tests/absence.test.ts` "CAL-05 AC-4" and the e2e test of the same name |
| `INV-01`, `INV-02`, `INV-03` | Unreachable. This surface issues no write of any kind: no seam write function is imported, and AC-8's e2e test asserts the absence of every button, input, select, textarea, form and link inside `week-day` |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the typecheck command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | same. `WeekView.tsx` is new, so § Language covers it from its first line — every string in it is English and it is **not** in `copyDebt` |
| `pnpm exec vitest run` | 0 | 3 files, **57 tests**, all pass — 14 of them CAL-05's |
| `pnpm exec playwright test` | 0 | **73 tests, all pass.** `tests/e2e/cal-04-month-view.spec.ts` passes **unedited**, which is what § 7 puts it there for: it is the safety net for the one-line `MonthView.tsx` change |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | eight files changed, and they are the eight globs |

## Testability contract

Every selector from § 4.3, and the two declared above.

| selector | Exists at |
|----------|-----------|
| `week-anchor` (carries `data-week-start`) | `src/routes/WeekView.tsx:261` |
| `week-home` | `src/routes/WeekView.tsx:250` |
| `week-prev` | `src/routes/WeekView.tsx:258` |
| `week-next` | `src/routes/WeekView.tsx:264` |
| `week-month` | `src/routes/WeekView.tsx:273` |
| `week-day` (carries `data-date`) | `src/routes/WeekView.tsx:290` |
| `week-day-label` | `src/routes/WeekView.tsx:295` |
| `week-day-empty` | `src/routes/WeekView.tsx:303` |
| `week-row` (carries `data-member-id`, `data-entry-id`) | `src/routes/WeekView.tsx:328` |
| `week-row-name` | `src/routes/WeekView.tsx:348` |
| `week-row-avatar` | `src/routes/WeekView.tsx:345` |
| `week-row-type` (carries `data-type`) | `src/routes/WeekView.tsx:352` |
| `week-row-portion` (carries `data-portion`) | `src/routes/WeekView.tsx:361` |
| `week-row-note` | `src/routes/WeekView.tsx:382` |
| `week-row-approver` (carries `data-approver-id`) | `src/routes/WeekView.tsx:392` |
| `week-row-tentative` | `src/routes/WeekView.tsx:371` |
| `week-loading` | `src/routes/WeekView.tsx:206` |
| `week-not-on-a-team` | `src/routes/WeekView.tsx:218` |
| `week-unavailable` | `src/routes/WeekView.tsx:232` |
| `week-sign-in` — declared, Deviations item 2 | `src/routes/WeekView.tsx:222` |
| `month-week` — § 7 | `src/routes/MonthView.tsx:322` |
| `home-week-link` — declared, Deviations item 3 | `src/routes/Home.tsx:127` |

## Where each acceptance criterion is asserted

`.ai/standards/testing-standards.md` § Test naming requires the AC id in the test name. Three
criteria have no interface to be observed through, and saying so here is cheaper than a reviewer
searching for them.

| AC | Unit | End-to-end |
|----|------|------------|
| AC-1 seven days, anchored by the URL | — | yes — the anchor used is a **Wednesday**, so "any day produces the same screen" is what is tested |
| AC-2 each person named on each day | yes | yes |
| AC-3 half-days distinguished | — | yes — two different `data-portion` values on one day, not merely two rows |
| AC-4 a five-day `pm` is five afternoons | yes | yes |
| AC-5 clamped to the days inside the week | yes | yes |
| AC-6 the note is shown when there is one | — | yes — and absent, not empty, when there is none |
| AC-7 an approved entry names who approved it | yes (the entry is carried) | yes — and a pending entry shows no approver |
| AC-8 displaying who approved is not approving | — | yes — asserted as an **admin**, and by the absence of every control |
| AC-9 a tentative entry is listed and marked | yes | yes |
| **AC-10 a rejected entry is not listed** | **yes, and here only** | **impossible.** Nothing in the product can set `status` to `rejected`: the insert grant excludes it, `entry_update_admin` excludes it, and ADM-05 does not exist |
| **AC-11 a removed member's entries stop** | **yes, and here only** | **impossible.** Nothing can remove a member partway through a displayed week — TEA-04's control writes `removed_at` as `now()` |
| AC-12 the week and the month agree | yes — the count is re-derived from the week's rows on every date | yes — the same member set on a shared date, in both directions |
| AC-13 all seven days render, empty ones say so | yes | yes |
| AC-14 moving between weeks and to the month | — | yes |
| **AC-15 a truncated read is refused** | — | **not asserted anywhere.** A `>= MONTH_ENTRY_LIMIT` throw inside the seam: the mock's entry table is bounded by the fixtures and cannot reach 2000 rows, and no test can make PostgREST cap a read without a provisioned project. The same untested shape `ROSTER_LIMIT`, `OWN_ENTRY_LIMIT`, `TEAM_ENTRY_LIMIT` and CAL-04's AC-11 already carry. The branch itself is one `catch` and is visible at `src/routes/WeekView.tsx:172-177` |

## Open questions

1. **`mondayIndex` now exists twice**, at `src/routes/MonthView.tsx:84` and
   `src/routes/WeekView.tsx:68`. Both convert through UTC and both carry the comment saying why, so
   they cannot drift silently — but they are the same three lines. The fix is one function in
   `@/lib/data/absence`, which already owns the date vocabulary (`addDays`, `eachDateInRange`), plus
   one import change in each view. It was not done here because § 7 gives `MonthView.tsx` one link
   and nothing else, and a reviewer should be able to read that file's diff in one glance. **Whoever
   next opens `MonthView.tsx` for a real reason should take it.**

2. **`tests/absence.test.ts` now carries two tickets' AC ids.** CAL-04's describes are bare `AC-n`
   and CAL-05's are prefixed `CAL-05 AC-n`. § Test naming requires the id in the name and does not
   anticipate one file serving two tickets; splitting the file would put two halves of INV-04's
   coverage in two places, which is worse. The prefix convention is stated in a banner at the top of
   the CAL-05 section so the next ticket to add to this module follows it rather than inventing a
   third form.

3. **A week spanning a month boundary has two reasonable answers for `week-month`, and this ticket
   picked one** — see Deviations. Nothing in the plan or the registry decides it, and if the
   operator prefers the Monday's month it is one expression at `src/routes/WeekView.tsx:273-277`.

4. **01-plan.md's own Open questions 1, 2 and 3 are unchanged by this implementation.** Whether a
   `rejected` entry is *drawn* anywhere is still the `TODO(project)` on CAL-04's registry row; § Direction,
   § Colour and § Type in `.ai/standards/ui-design-system.md` are still stubs, so the palette here is
   cited to `CLAUDE.md` § Visual direction exactly as CAL-04's is; and the Vui/Gọn density toggle is
   not built here for the reason the plan gives — no shipped view has it.
