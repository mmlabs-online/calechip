---
stage: TRIAGE
agent: product
produced_at: 2026-09-08
inputs_read:
  - .ai/steward/context.md
  - CLAUDE.md
  - .ai/templates/idea.md
  - .ai/board/ideas/2026-09-08-two-row-limits-sit-above-the-cap-they-were-written-to-stay-under.md
  - .ai/board/backlog.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/00-charter.md
  - product_brief.md
  - .ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md
  - .ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md
  - .ai/board/tickets/CAL-04/01-plan.md
  - .ai/board/tickets/CAL-06/01-plan.md
  - .ai/board/tickets/BUG-002/01-plan.md
  - src/lib/domain/types.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/YearView.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/EditEntry.tsx
  - tests/row-limits.test.ts
  - tests/seam-parity.test.ts
  - tests/pending-entries.test.ts
  - playwright.config.ts
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# The year view refuses a team of the size the brief targets

## Problem

**A member of a team large enough to fill a year cannot open the year view at all.** The screen does
not render a short year, a slow year or a year with holes — it renders no year: `phase: "unavailable"`,
the failure state, on a read that failed for no reason other than the team having declared more
absences than one request returns (`src/routes/YearView.tsx:165-181`).

The product's own written target for that screen is thirty members across 365 columns
(`product_brief.md:110`, transcribed into `.ai/registry/features.md:102`), and the read behind it
returns at most 1000 rows. **So the size at which the calendar stops existing is inside the size the
product says it is for**, and the person who reaches it is told nothing except that the screen is
unavailable.

**This is not BUG-002's defect and it must not be restated as one.** That defect — a truncation
assertion that could never fire, so a short year was summed into a believable wrong count — is fixed
and shipped (PR #76, 2026-09-08). What is described here is the cost that fix recorded in the same
breath, in its own words: *"a large team's year view CAN legitimately exceed 1000 rows, and after this
change it sees a refusal instead of a silently short year. That is what CAL-06 AC-14 requires and is
strictly better than a believable wrong calendar, but it is a refusal, not a calendar"*
(`src/lib/domain/types.ts:344-349`). **The refusal is correct.** CAL-06 AC-14 requires exactly it
(`.ai/board/tickets/CAL-06/01-plan.md:203-207`). A correct refusal is still not a calendar, and that
distinction is the whole of this idea.

### What the person actually experiences

Nothing distinguishes the two failures the screen collapses together. `src/routes/YearView.tsx:172-181`
is one `catch` around three reads, and it renders the same state for a network error, an expired
session's transport failure and a year that is simply too full. A reader of that screen cannot tell
*the datastore is down* from *your team declared too much*, and only one of those goes away by waiting.

### Why it is the year and not the other screens

`listTeamEntriesOverlapping` serves the month, the week, the year and the draft-entry overload warning
through one constant. The month's and week's ranges are a twelfth and a fifty-second of the year's, so
for the same team the year is the read that reaches the ceiling first and by a wide margin — and it is
the only one of the four whose range was never what the constant was sized for
(`src/lib/domain/types.ts:338-342`, `.ai/board/tickets/CAL-06/01-plan.md:372-382`).

## Who has it

- **Every member and every admin of a team whose entries overlapping one calendar year exceed 1000
  rows, every time any of them opens `/year/:yyyy`.** It is not intermittent and it is not per-person:
  the ceiling is a property of the team's data, so on the day it is crossed the year view stops
  working for everybody at once and stays broken until entries age out of the range — which for a year
  range means the following January.
- **It arrives at the year first and silently threatens the rest.** The same constant bounds
  `MonthView`, `WeekView` and the overload warning inside the entry form. Nothing warns that the year
  is close to the ceiling, so the first signal any of these consumers gets is one screen going dark.
- **A person planning around Tết is the likeliest first reporter.** The read orders `start_date`
  ascending (`src/lib/data/supabase.ts:1166`), which mattered before the fix because the *latest* rows
  were the ones dropped; it no longer decides what is lost, but it is still the far end of the year —
  the part nobody opens until somebody plans the holiday — that a year view exists to show.
- **Nobody has reported it, because no team of that size has ever run this product.** Stated here so
  the row above is not read as a support volume.

## Evidence

Every item was read on disk during this triage. Nothing here is recalled.

**1. The refusal branch exists and is the whole screen.** `src/routes/YearView.tsx:165-169` issues
three reads in one `Promise.all` — `listMembers()`, `listTeamEntriesOverlapping(range)`,
`listHolidays(holidayReadRange(range))`. `:172-181` catches any of them and sets
`setView({ phase: "unavailable" })`. Its own comment names the cause: *"All three reads throw on a
transport failure and on a possibly-truncated answer (`MONTH_ENTRY_LIMIT`, reused rather than joined
by a second constant — section 4.2). This branch is the refusal: no grid at all, rather than one
missing the entries the read dropped."*

**2. The ceiling is 1000 and it is now reachable, which is what BUG-002 changed.**
`src/lib/domain/types.ts:353` — `export const MONTH_ENTRY_LIMIT = 1000;`
`src/lib/data/supabase.ts:1168` asks for exactly that many rows and `:1181` throws on
`rows.length >= MONTH_ENTRY_LIMIT`. `src/lib/data/mock.ts:1227` and `:1232` are the same shape. The
cap it is written against is named in the repository for the first time as
`DATASTORE_MAX_ROWS = 1000` (`src/lib/domain/types.ts:184`), cited to the installed client's own
documentation by package rather than by line (`:161-172`).

**3. The consequence was recorded by the ticket that caused it, not discovered afterwards.** Two
places say it in the same words: `src/lib/domain/types.ts:344-349`, and
`.ai/board/tickets/BUG-002/01-plan.md:217-222` as Open questions item 2 — *"A year read over 365 days
for a team logging WFH daily can exceed 1000 legitimately. After this fix they see a refusal instead
of a silently short year — which is what CAL-06 AC-14 requires and is strictly better than today — but
it is a refusal, not a calendar."*

**4. The board has been carrying it since that ship and names it as this command's.**
`.ai/board/backlog.md:45-50` lists four outstanding items and makes this item 1: *"After BUG-002 a
year read that legitimately exceeds 1000 now REFUSES rather than silently shortening, which is better
and is still not a calendar. This is the one that wants `/triage`."*

**5. The arithmetic, given as arithmetic and never as a measurement.** No row-count measurement of a
live team exists anywhere in this repository, and this idea does not claim one. What can be computed:

- A contiguous range declared in one action is one entry, not one per day
  (`.ai/registry/invariants.md:172-176`, recorded there as an acceptance criterion rather than an
  invariant). A member who records a recurring work-from-home day one date at a time therefore
  produces one row per occurrence.
- Two such days a week is roughly 100 rows a year for one person; thirty such members is roughly 3000
  rows against a ceiling of 1000.
- The crossing point is lower than that and is already written down: `.ai/registry/features.md:102`
  puts it at *"roughly 34 entries per member per year"* for thirty members.
- The read is an **overlap** read (`src/lib/data/supabase.ts:1165`, `date_range=ov.[start,end]`), so
  an entry starting in December of the previous year and ending in January counts toward the year's
  1000 as well. The arithmetic above is a floor, not a ceiling.

**6. Nothing in the repository can exercise this today, and that is a fact PLAN needs rather than a
reason to widen anything.** The seeded roster on the main team is **five members**
(`.ai/board/tickets/CAL-06/01-plan.md:243`), the acceptance suite is pinned to the mock
(`playwright.config.ts:49-51`), and the mock's own truncation assertion says it is decorative:
*"this array is bounded by the fixtures so it never fires"* (`src/lib/data/mock.ts:1230-1231`).

**7. `listTeamEntries` reaches the cap before the year read does, and it has no date filter at all.**
`src/lib/data/supabase.ts:1027-1034` selects the team's entries with `.order("start_date", desc)`,
`.order("id", asc)` and `.limit(TEAM_ENTRY_LIMIT)` — **and no range predicate of any kind**, so it
reads the team's entire history forever and grows monotonically. Its two consumers are
`src/routes/TeamEntries.tsx:76` and `src/routes/EditEntry.tsx:84`. Since BUG-002 lowered
`TEAM_ENTRY_LIMIT` to 1000 (`src/lib/domain/types.ts:293`) that read throws too, at a smaller team and
sooner, and one of its consumers is the admin edit path. **Whether it belongs in the same work is an
open question below, not a decision taken here.**

**8. `MONTH_ENTRY_LIMIT` is not read by any route.** Outside the seam it appears in comments only —
`src/routes/YearView.tsx:174` and `src/routes/WeekView.tsx:296`. The real references are
`src/lib/data/supabase.ts`, `src/lib/data/mock.ts`, `src/lib/domain/types.ts` and
`tests/row-limits.test.ts`. The four surfaces usually called its "callers" call the *function*
`listTeamEntriesOverlapping`. Recorded because the relationship is easy to state backwards, and
because it decides which files a fix can touch under RULE-02.

**9. There is a shipped precedent for a paged read in this codebase, and for testing one.**
ADM-04's `listPendingEntries` (`src/lib/data/supabase.ts:1373-1433`) uses
`.select(ENTRY_COLUMNS, { count: "exact" })` at `:1381` and `.range(from, to)` at `:1399`, and its
short-page assertion at `:1425` detects a shortened window **without knowing the cap's value** —
`:1417-1420` says so explicitly. `tests/pending-entries.test.ts` drives the mock implementation
directly rather than through `@/lib/data`, because the row order and the paging are invisible to the
parity test (`:8-13`); it also declares plainly that its own AC-5 is *asserted nowhere* (`:21-27`).

**10. No datastore change is pending that would remove the cap.** ADR-027 is
`WITHDRAWN by the operator` before it entered any commit
(`.ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md:11`).

**Visual reference: none.** No image is attached to this request. One would settle nothing: the screen
in question renders a single failure state that is already built, tested and correct — what is missing
is a calendar, and there is no picture of the calendar that is not being drawn.

## Impact if ignored

**The product has a hard size limit that nothing states and no screen explains.** The charter says the
system is for a team of five to thirty (`.ai/00-charter.md:30`) and the brief carries *"View năm chịu
được 30 người mà vẫn cuộn mượt"* as an acceptance checkbox (`product_brief.md:110`). Today the honest
statement is narrower than either and appears nowhere a user or a reviewer would find it.

**The failure lands on the screen with the longest planning horizon and the least tolerance for
absence.** The year view is the only surface that answers *who is thin on the ground in August* and
the only one that shows a member with no entries at all — losing it does not degrade the other views,
it removes a capability.

**It is a cliff rather than a slope.** There is no warning band, no partial year, no "showing the
first ten months". The team crosses 1000 overlapping rows on some ordinary Tuesday and the screen
stops working, with a message that says only *unavailable* — which is also what it says when the
network is down.

**It gets worse on exactly the teams the feature was built for.** Absence rows accumulate with team
size and with the discipline the product is trying to create: the brief's whole aim is people
declaring three to four weeks ahead rather than days ahead (`.ai/00-charter.md:33-35`). Adoption
succeeding is the mechanism that breaks this screen.

**A second read is already at the same ceiling with a worse failure.** `listTeamEntries` has no date
filter, so its 1000 rows are the team's entire history and it can only ever grow. When it throws,
`src/routes/EditEntry.tsx:84` is the admin path for correcting somebody else's entry.

**And the year view's own acceptance criteria now disagree with each other in this case, without
either being wrong.** AC-1 says `/year/2026` renders 365 day columns
(`.ai/board/tickets/CAL-06/01-plan.md:129-132`) and AC-3 says every member of the roster has exactly
one row (`:139-143`); AC-14 says a read at the row limit is refused and no grid is drawn (`:203-207`).
Above 1000 rows AC-14 wins by design and the first two are unobservable. Nothing in the repository
records that this is the intended reading of the three together.

## Constraints already known

Cited, not chosen. Each bounds what an eventual ticket may do.

- **RULE-02 and the seam.** The data-access seam is `src/lib/data/` (`CLAUDE.md`,
  `.ai/standards/architecture.md`), enforced by `no-restricted-imports` in `eslint.config.js`. Any
  paging loop, count request or completeness check lives inside the seam or in the constants module
  the seam already imports; no route may reach past it. `src/lib/domain/types.ts:196-199` records why
  the constants sit in `domain/` and not in the seam — both implementations need them at runtime and
  `index.ts` imports both, which would be a load-time cycle.
- **ADR-005 — there is no server.** The browser talks to PostgREST directly, so there is nowhere
  server-side to page, cache or pre-aggregate on a caller's behalf. Whatever is done happens in the
  browser or in the datastore's own configuration.
- **CAL-04's plan authorises paging in words, and it is the only artifact that does.**
  `.ai/board/tickets/CAL-04/01-plan.md:176-180` — *"AC-11 is written so that the implementation must
  assert completeness or page explicitly whatever the cap is, which is correct under any value."*
- **`ADR-015` does NOT authorise paging, and five places in this repository say it does. That claim is
  false and is a finding of this triage, not a constraint.** `grep -n "pag\|range("` over
  `.ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md` returns
  **zero matches**. What `:379-381` actually offers is two **non-paging** mitigations — *"request with
  an explicit limit above the widest possible range (366 plus margin) and assert the row count is
  below it, or use `Prefer: count=exact` and compare"* — and it is scoped to the **holiday** read, not
  the entry read. The false half is repeated at `.ai/registry/features.md:102`,
  `.ai/board/tickets/BUG-002/01-plan.md:104` and `:221`, `src/lib/domain/types.ts:347-348`, and
  `.ai/board/backlog.md:47-48`. **The registry copy is human plane under RULE-01 and correcting it is
  `/thuki`'s, not this idea's and not an eventual ticket's.** Cite CAL-04's plan for the
  pre-authorisation and nothing else.
- **CAL-06 AC-14 stands and must not be weakened.** `.ai/board/tickets/CAL-06/01-plan.md:203-207`. A
  possibly-truncated read is refused rather than under-reported. Anything that renders a partial year
  without saying it is partial reintroduces the defect BUG-002 just closed.
- **INV-04 has exactly one implementation and nothing may create a second.** `absenceCountsFor` in
  `src/lib/data/absence.ts` is pure and takes rows, with four consumers
  (`.ai/registry/features.md:100-102`, ADR-029 adds the week strip). It cannot detect truncation
  itself — completeness has to be established before it is called, which is why the check is in the
  seam.
- **The read carries a deterministic order and both implementations must keep it.**
  `src/lib/data/supabase.ts:1166-1167` orders `start_date` ascending then `id` ascending;
  `src/lib/data/mock.ts:1222-1226` sorts identically above the array. Any paging strategy depends on
  that order being stable across requests. **`tests/seam-parity.test.ts` does not police it** — it
  compares exported key sets and arity only, and says so itself at `:1-9`: *"Parity is necessary and
  NOT sufficient."* ADM-04 hit exactly this and recorded it (`src/lib/data/supabase.ts:1364-1367`).
- **`playwright.config.ts:49-51` pins the whole acceptance suite to the mock** (`VITE_DATA_SEAM:
  "mock"`, `VITE_SUPABASE_URL: ""`). That pin shipped as BUG-001 and is deliberate. The only
  implementation that can be truncated by a server is the one no runner drives.
- **`tests/pending-entries.test.ts` is the shipped precedent for testing a paged read**: it imports
  `@/lib/data/mock` directly, asserts predicate, order, paging and count at the unit level, and
  declares in its own header which criterion is asserted nowhere and why (`:1-27`).
- **ADM-04's paged read already exists in the seam** — `src/lib/data/supabase.ts:1373-1433`, with
  `count: "exact"` at `:1381`, `.range(from, to)` at `:1399`, and a short-page assertion at `:1425`
  that detects a lowered cap without knowing its value.
- **`DATASTORE_MAX_ROWS` is a figure this repository asserts, not the value the project serves.**
  `src/lib/domain/types.ts:178-182` states the limit of what it buys: nothing in the tree can read the
  real setting, the anon key cannot, and ADR-024 declined a drift detector.
- **`tests/row-limits.test.ts` asserts every ceiling is `<=` the named cap**, and `:14-19` records that
  the relation is reachability rather than margin. A fix that removes a ceiling has to say what that
  test then asserts about the read it removed it from.
- **ADR-027 is `WITHDRAWN`**, so the cap is not going away on its own.
- **`.ai/registry/features.md` is the only valid source of feature IDs (`CLAUDE.md`), and this idea
  carries none.** An idea has no ID.

## Out of scope

Written now, because everything adjacent to this looks like the same problem.

- **Re-opening BUG-002's constants.** `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` at 1000
  (`src/lib/domain/types.ts:293`, `:353`) are correct: 1000 is the largest value either ceiling can
  take and still be reachable, and the reasoning is written beside each. Raising either one back above
  the cap restores the silent-truncation defect that shipped this morning.
- **The `>=` false positive on exactly 1000 rows.** A team with exactly 1000 overlapping entries is
  refused although nothing was truncated. It is deliberate, it is the established shape across
  `ROSTER_LIMIT`, `OWN_ENTRY_LIMIT` and `HOLIDAY_LIMIT`, and BUG-002 recorded the choice at
  `.ai/board/tickets/BUG-002/01-plan.md:212-216`. It is one row of imprecision on a problem that is
  about thousands.
- **`HOLIDAY_LIMIT`.** It is 1000, equal to the cap, correct for that reason
  (`src/lib/domain/types.ts:174-176`), and its consumers are the holiday reads rather than the entry
  read. A year of holidays is tens of rows. Nothing here touches it.
- **Raising the Supabase project's `max-rows` API setting.** BUG-002 fenced this off in its own shell
  and its plan explains why at `.ai/board/tickets/BUG-002/01-plan.md:100-103`: it adds a deployment
  step that does not exist and makes a correctness property depend on a value no file records and no
  check can verify. It is not this idea's answer either, and if a later stage concludes it is, that is
  a stop-and-ask rather than a quiet configuration change.
- **Provisioning a real Supabase project so truncation is observable behaviourally.** Standing up a
  project, seeding more than a thousand rows and wiring credentials into CI is its own decision with
  its own cost. The 2026-09-01 seam-pinning idea already refused the same expansion, and BUG-002
  listed it as a fix shape it did not take (`.ai/board/tickets/BUG-002/01-plan.md:108-109`).
- **Re-opening the end-to-end seam pinning.** `playwright.config.ts:49-51` is cited above as the
  reason no shipped runner can observe truncation. That pin shipped as BUG-001 and is not to be
  loosened here.
- **The absence arithmetic in `src/lib/data/absence.ts`.** INV-04's single implementation is not
  implicated: it sums correctly over whatever rows it is handed, and the problem is entirely upstream
  of it. The same boundary BUG-002 drew.
- **CAL-06's performance target.** *Thirty members and 365 columns, still scrolling smoothly* is
  about rendering, not about fetching. `.ai/board/tickets/CAL-06/01-plan.md:236-246` records that the
  performance half is deliberately unasserted and that closing it properly needs a seeded
  thirty-member roster or a component-test environment with a render budget — both their own work.
  Making a year *arrive* and making it *scroll* are different problems that happen to share a number.
- **The three other stale board items** at `.ai/board/backlog.md:51-60`: the `§ Colour` / `§ Type` /
  breakpoint stubs, the product showing two names, and `PLAN -> READY` being a loop step no command
  runs. All three are `/thuki`'s and none is this.
- **Correcting the ADR-015 citation in `.ai/registry/features.md:102`.** Human plane under RULE-01.
  Recorded above as a finding; the correction is `/thuki`'s.

## Open questions

**No fix shape is chosen here, deliberately.** Paging is the answer written down in advance, and it is
a candidate rather than a conclusion — a problem stated as *the paging is missing* has already skipped
the step where the problem gets checked.

1. **Is the answer to fetch the whole year, or to stop needing to?** Explicit `range()` paging is the
   shape everything on this board points at (`.ai/board/tickets/CAL-04/01-plan.md:176-180`,
   `.ai/board/tickets/BUG-002/01-plan.md:104`). It is not the only one available: a narrower column
   set on this read, a per-quarter or per-month read the year view stitches, or a server-side
   aggregate are all shapes that change how many rows cross the wire. The last of those would be a
   second implementation of INV-04's inputs and is very likely an ADR — CAL-06's registry row already
   says so in a related case (`.ai/registry/features.md:102`: *"moving the computation into SQL is a
   second implementation of INV-04 and is a decision rather than a workaround"*).
2. **Does `listTeamEntries` belong in the same work?** It reaches 1000 sooner than the year read does,
   it has no date filter at all (`src/lib/data/supabase.ts:1027-1034`), and its failure hits the admin
   edit path. Fixing both together is one loop written once; fixing them separately keeps a bug ticket
   small. **This idea does not decide it** — but the answer changes the size, the `feature_ids` and
   possibly the ID scheme of whatever follows.
3. **What does the year view do while a paged read is in flight, and what does it do if page four
   fails?** Today there is one `catch` and one failure state. A multi-request read has a partial
   outcome that the current screen has no vocabulary for, and CAL-06 AC-14 forbids drawing a grid that
   is missing rows. Whether that is a loading state, a retry, or the same refusal is a behaviour
   decision and belongs in acceptance criteria that do not exist yet.
4. **Is there a ceiling at all after this, and what asserts it?** `tests/row-limits.test.ts` holds
   every ceiling against `DATASTORE_MAX_ROWS`. If a read pages instead of asking for a fixed maximum,
   that read has no ceiling for the test to hold — and ADM-04's precedent replaced the ceiling with a
   short-page assertion rather than with nothing (`src/lib/data/supabase.ts:1417-1431`). What the
   equivalent is here, and whether an unbounded loop needs its own bound, is open.
5. **How would a fix be proved?** Every runner drives the mock (`playwright.config.ts:49-51`), the
   mock's arrays are bounded by fixtures (`src/lib/data/mock.ts:1230-1231`), and the seeded roster is
   five members. `tests/pending-entries.test.ts` is the precedent — a paged read asserted at the unit
   level against the mock, with the untestable half declared rather than hidden — but a mock that
   cannot truncate proves paging is *implemented*, not that it *fixes* anything. This must be answered
   before a Definition of Done item 4 can be written, and it is the same question BUG-002 answered
   with a static test and an honest note about its limit.
6. **What is the real row count of a live team?** Unmeasured, everywhere. It decides how urgent this
   is. It does not decide whether the product can render a year for the team size it targets, which is
   a property of two numbers already in the repository.
7. **Should the refusal say why while it is still the behaviour?** A screen that says *unavailable* for
   both a network failure and a too-full year costs a reader the one distinction that tells them
   whether waiting helps (`src/routes/YearView.tsx:172-181`). That is a smaller change than paging and
   it is a different one; whether it belongs to the same work, to a `UIE` row, or nowhere is open.
8. **Does anything need to say, in a document, what team size this product supports today?** The
   charter says five to thirty (`.ai/00-charter.md:30`); the year view's real limit is a row count
   derived from two constants and stated in no document. Whichever way the fix goes, somebody will ask
   what the supported size is, and today the answer is only computable.

---

## What is promised in writing about a rendered year, established on disk

Recorded here because it is the load-bearing question for the verdict that follows, and because both
halves of the answer are true.

**It is promised, twice, and neither is an acceptance criterion.**

- `product_brief.md:110` — a checkbox in the brief's acceptance list: *"View năm chịu được 30 người mà
  vẫn cuộn mượt."* `product_brief.md:61` sets the target scale: *"Quy mô mục tiêu: team 5–30 người."*
- `.ai/registry/features.md:102`, the CAL-06 row, transcribes it into the registry: *"Brief 7.1's
  long-range view, carrying the brief's own acceptance target: thirty members and 365 columns, still
  scrolling smoothly."* This is the only place the target appears in the permanent plane.
- `.ai/00-charter.md:30` states the product's scale — *"One team of five to thirty people"* — and says
  nothing about the year view or about rendering.

**No invariant is engaged.** `.ai/registry/invariants.md` INV-01 through INV-07 govern entries,
portions, counts and team scoping. None of them says a view renders, and none is violated by a screen
that refuses.

**And CAL-06's own plan split that target deliberately, recording which half it would assert.**
`.ai/board/tickets/CAL-06/01-plan.md:236-246`, Open questions item 1: the **structural** half is AC-1
and AC-3 and is observable today; the **performance** half *"is not, and this plan does not invent a
threshold for it, because there is none in the brief, the charter or the registry and an invented
number would be indistinguishable from a decided one."* Two reasons are given and both were verified:
`vite.config.ts` sets `test.environment: "node"` so there is no component-render level, and the seeded
roster is five members so no end-to-end run can reach thirty. What shipped instead is the pure
derivation asserted at 30 × 365 in a unit test.

**So the honest summary is:** the brief and the registry both promise a year view that works at thirty
members; **no acceptance criterion anywhere promises that a year read exceeding 1000 rows renders**,
and the one criterion that speaks to the case — CAL-06 AC-14 — requires the opposite. The promise and
the criteria are not in conflict about behaviour; they are in conflict about scale, and nothing on
disk resolves which one governs.

---

# Verdict — PROMOTE, as CAL-09

**Decided 2026-09-08 by `product`, on the technical half `tech-lead-design` returned in the same run
(RULE-11; recorded in `consulted:` above).** The problem above was written first, in a separate
session and without a verdict, and nothing in it is rewritten here. Everything below was read on disk
during this half; where a claim of the consult was not confirmed by that reading it is corrected by
name rather than dropped.

**The reason, in one sentence:** after paging, a team whose year legitimately exceeds one datastore
page can see its year — which it cannot do today — and no written statement about this surface is
contradicted by what shipped, so this is a capability the product gains rather than a defect it
carries.

## 1. The ID question — `CAL-nn` against `BUG-nnn`, resolved rather than restated

**ADR-028's four-step boundary test (`:61-83`) is the instrument, applied in its own order. The first
step that answers *yes* decides the prefix.** Step 1 is the whole of the question here; steps 2, 3 and
4 fall out of it.

### Step 1 — *does something written down say what this surface should be, and does the surface not match it?* **No.**

Four written statements govern a truncated entry read, and **every one of them is satisfied by what
BUG-002 shipped.** Each was opened and read, not recalled:

- **CAL-06 AC-14** (`.ai/board/tickets/CAL-06/01-plan.md:203-207`) — *"Given a year whose entries come
  back at the row limit ... Then it shows the failure state and draws no grid."* This is not merely
  satisfied; it is the criterion that **requires** the behaviour the problem section describes.
- **CAL-04 AC-11** (`:138-144`) — the refusal on a truncated read, with the gloss at `:176-180`
  requiring the implementation to *"assert completeness or page explicitly whatever the cap is."* A
  disjunction; the first disjunct holds.
- **CAL-05 AC-15** (`.ai/board/tickets/CAL-05/01-plan.md:200-204`) — the same shape for the week.
- **The CAL-07 registry row** (`.ai/registry/features.md:103`) — *"The read must assert completeness or
  page, per CAL-04."* Again a disjunction, again satisfied.

**That much is the consult's argument and it is correct as far as it goes. It is not far enough, and
two things it does not address are what actually decide this step.**

**(a) The scale promise is a written statement and it had to be tested on its own terms, not
dismissed.** `product_brief.md:110` — *"View năm chịu được 30 người mà vẫn cuộn mượt"* — and its
transcription at `.ai/registry/features.md:102` are the only written statements about this surface
that speak to size, and both were verified on disk at this triage. They are not acceptance criteria
and they are not invariants, but ADR-028 step 1 does not require either: it asks whether *something
written down* says what the surface should be. So the question is real.

**It answers no, and the reason is arithmetic rather than status.** The promise names a **member
count**. The failure is keyed to a **row count**. Nothing written anywhere in this repository connects
the two — no document states how many entries a member records in a year, and the charter, which is
the other place scale is stated (`.ai/00-charter.md:30`, *"One team of five to thirty people"*), is
silent on it as well. A team of thirty recording ten entries each is 300 rows and works today; the
same thirty recording thirty-four each is refused (`.ai/registry/features.md:102` puts the crossing at
*"roughly 34 entries per member per year"*). **To point at a contradiction between the promise and the
surface, a reader must first supply an entries-per-member figure that exists in no file.** ADR-028's
own signal for step 1 is that *"a reader can point at the contradiction without exercising taste"*
(`:66-68`), and supplying a missing number is exactly exercising taste.

**A second reason, independent and sufficient on its own:** the brief's line is about **scrolling**,
and CAL-06's plan split that target deliberately and recorded which half it would assert
(`.ai/board/tickets/CAL-06/01-plan.md:236-246`). The structural half became AC-1 and AC-3; the
performance half *"is not [asserted], and this plan does not invent a threshold for it, because there
is none in the brief, the charter or the registry and an invented number would be indistinguishable
from a decided one."* The written form of the promise closest to this problem is one that a shipped
plan deliberately declined to make assertable. It cannot now be read as a criterion the surface fails.

**(b) The strongest case for `BUG-nnn` is not the promise at all — it is CAL-06's own criteria
disagreeing with each other, and the idea above found it.** AC-1 (`:129-132`) is written without a
row-limit condition: *"Given a signed-in member, When they open `/year/2026`, Then the grid renders 365
day columns."* AC-14 (`:203-207`) requires that no grid be drawn when the read comes back at the row
limit. **Above 1000 rows the two cannot both be observed**, and a reader can point at that without any
taste at all.

**It still answers no, and this is the part of the verdict that is a judgement rather than a
reading.** The clash is between two criteria in the same document, not between a criterion and the
surface. AC-1's `Given` does not enumerate the row-limit case and AC-14's does, so AC-14 is the
criterion that governs it, and the surface implements AC-14 exactly. Concluding otherwise means
deciding that the general criterion beats the specific one written later in the same list to cover
precisely that case — which nobody would say of a screen doing what a criterion explicitly requires
of it. **The taste is in resolving the clash, and a step-1 *yes* may not rest on a resolution somebody
has to make.**

**What that leaves behind is real and is carried into the ticket rather than closed here:** nothing in
the repository records that AC-14 governs over AC-1 in this case. `CAL-09` is the work that removes the
clash by making AC-14's precondition unreachable, and its plan is the right place to say so. Recorded
in `ticket.yaml` § 3.

### Step 2 — *could the product do something afterwards that it could not do before?* **Yes.**

A team whose year exceeds one datastore page can open its year view. Today it cannot, for anybody, on
any day, until entries age out of the range (`src/routes/YearView.tsx:165-181`). That is a capability,
and the area is the calendar, so the group is `CAL`. **Steps 3 and 4 are not reached** — and neither
would have fitted: the deliverable is not the appearance of an existing surface (two competent people
produce the same output here, a complete grid), and it is not mechanical (there is a real design
decision about what the read does and what the screen does while it is in flight).

**One hazard in this ordering, named because it is the way this test gets misused:** step 2 is broad
enough to swallow every defect, since a fixed bug also lets the product do something it could not do.
The ordering is what prevents that, and the ordering only works if step 1 is genuinely worked rather
than waved through. It was worked above, in three parts, and the closest of the three went against the
verdict before the specific-over-general reading settled it.

### Where this departs from the consult

**Same conclusion, and I do not depart from it.** `CAL-09`, not `BUG-nnn`, and explicitly not a
`Notes` sentence on a parent row in the BUG-001/BUG-002 precedent.

**I depart on the sufficiency of its argument.** The consult reached step 1 by observing that all four
governing statements are disjunctions that hold, and concluded there was *"no contradiction a reader
can point at without exercising taste."* Two contradictions can in fact be pointed at — the scale
promise, and AC-1 against AC-14 — and neither is disposed of by the disjunction argument, because
neither is one of the four disjunctions. A verdict that rested on that argument alone would have been
right for reasons that do not survive being checked. The tension the idea file left open was left open
because it is a real question, and it is answered above rather than assumed away.

**One factual correction to the consult, verified on disk, because a plan will be written against
it.** It describes ADM-04's shipped read as *"a `range()` walk ... terminating on a short page and
asserting assembled length equals count"*. **There is no walk.** `listPendingEntries`
(`src/lib/data/supabase.ts:1373-1433`) fetches **one** page whose index the caller supplies
(`:1374-1375`, `:1399`) and asserts only that a short page is the last page
(`rows.length < PENDING_PAGE_SIZE && from + rows.length < count`, `:1425-1431`). `.range(` occurs
**once** in the whole seam and there is no loop of any kind in that file — checked, not recalled. So
ADM-04 is a precedent for the *ingredients* (`count: "exact"`, `.range()`, and a short-page assertion
that detects a lowered cap **without knowing its value**, `:1417-1420`) and **not** for assembling a
complete result from several pages, which is what a year view needs because `absenceCountsFor` must be
handed every row before it is called. **The loop, its termination and its bound are new work with no
precedent in this tree**, and a plan that treats ADM-04 as the template will find half of it missing.
Carried into `ticket.yaml` § 5.

## 2. The four `/triage` tests

| Test | Answer |
|---|---|
| Supersedes or reverses an accepted ADR? | **No.** |
| Registry change beyond a `Notes` sentence? | **Yes — one feature row, `CAL-09`.** |
| Schema change? | **`none`, with a fence.** |
| Requires an ADR? | **No, with the same fence BUG-002 carried.** |

**Supersedes nothing.** The ceilings this work removes were never recorded in an ADR — BUG-002 shipped
`requires_adr: false` and set them in a source file. ADR-027, the one decision that would have removed
the cap by changing the datastore, is `WITHDRAWN by the operator` before it entered any commit. So
superseding BUG-002's decisions about `MONTH_ENTRY_LIMIT` costs no ADR. **The consult checked ADR-005,
ADR-011, ADR-013/INV-04, ADR-014 and ADR-027 and found nothing; I did not re-derive that list, and it
is recorded here as its finding rather than as mine.**

**Registry.** One feature row, written below. RULE-01 exempts feature rows from the ADR requirement
and ADR-007 assigns the row to `product` at triage. Nothing else under `.ai/registry/**` is touched.

**`schema_delta: none`, and the fence is that the literal reading is what ADR-014 exists to
distrust.** Offset `range()` over the order the read already carries needs no migration. **If PLAN
reaches for a keyset predicate and wants an index on `(start_date, id)`, that may be a migration** —
ADR-014 names policies, triggers and constraints and does not name indexes, so the literal reading
says `none` and the literal reading is precisely the one ADR-014 was written against. **This is not
resolved here.** It is carried into `ticket.yaml` § 6 for PLAN to answer with the shape it chooses.

**No ADR, with the fence BUG-002 carried and for a sharper reason.** Raising the Supabase project's
`max-rows` API setting is out of bounds inside this ticket
(`.ai/board/tickets/BUG-002/01-plan.md:100-103` gives the reasoning; the idea's *Out of scope* repeats
it). It is **more** tempting here than it was there, because it is the one shape that makes the whole
ticket unnecessary. **If PLAN concludes it is the answer, the correct verdict from PLAN is `BLOCKED`
with `requires_adr: true`, not a quiet configuration change** — ADR-008's test, decide inside the
envelope and ask before changing it. `ticket.yaml` § 7.

## 3. Two consequences that belong in the verdict rather than in the ticket

**(a) Check D1 fails any document citing `CAL-09` before the row exists, so the row and its first
citation land in one change.** Verified rather than taken on the consult's word:
`scripts/check-docs.mjs:194-198` builds the group set from the `<!-- id-prefixes: -->` marker in
`.ai/registry/features.md`, `:224-225` compiles the pattern from it, and `:234-238` reports every
citation of an ID in a declared group with no row in that file. The scanned set is `allDocs`
(`:95-98`) — **every `.md` under `.ai/` and `.claude/`, plus `CLAUDE.md`.** So this idea file and
`.ai/board/backlog.md` are scanned and `ticket.yaml` is not, and all three writes below happen in this
one run.

**(b) Paging does not *fix* CAL-04 AC-11, CAL-06 AC-14, CAL-05 AC-15 or the CAL-07 row's sentence — it
retires their preconditions, and four shipped acceptance criteria become vacuously true.** Each is
conditioned on the read *"coming back at the row limit"* or on the seam refusing; after paging the
entry read never comes back at a limit, so the `Given` never occurs. **That is defensible and it is
not quiet.** Stated here so no later reader finds four green-by-vacuity criteria and concludes
somebody weakened them. What replaces the ceiling is ADM-04's own answer — an assertion that detects a
shortened window without knowing the cap's value (`src/lib/data/supabase.ts:1417-1420`) — and **what
`tests/row-limits.test.ts` then asserts about a read with no ceiling is open** and is the idea's open
question 4, carried unchanged.

## 4. What is deliberately NOT in this promotion

- **`listTeamEntries` is OUT, and it does not get a row today.** It reaches the cap sooner than the
  year read does and has no date filter at all (`src/lib/data/supabase.ts:1027-1034`), which the idea
  records as open question 2. It stays out for a reason on disk rather than for scope hygiene:
  `src/lib/data/index.ts:418-423` forbids that read growing a range parameter *in words* — *"it must
  not grow a range parameter — the moment it does there are two team-entry reads and one of them will
  be the one nobody updated."* An unbounded admin list wants a paged **screen**, like ADM-04's
  worklist — a different surface with its own criteria and its own row. **No row is written for it**,
  because no idea file states that problem as its own and a row with no provenance is the one thing
  ADR-007's citation rule exists to prevent. It is named in `ticket.yaml` § 8 and in the backlog
  paragraph as work that wants its own `/triage`.
- **`absenceCountsFor` stays one implementation.** Assemble the rows, then count once. A per-page sum
  is INV-04's forbidden second definition reached by an ordinary-looking optimisation.
- **Open question 7** — whether the refusal should say *why* while it is still the behaviour — is not
  promoted here. It is a smaller and different change, and after `CAL-09` the too-full branch it would
  distinguish no longer exists on the year read. If it is still wanted for the transport case, it is
  its own idea.
- **Open question 8** — whether a document should state the team size this product supports — is a
  question about the charter and the registry, both human plane under RULE-01. Not this ticket's, and
  not created as a row.
- **Everything in the idea's own *Out of scope* section**, unchanged and not reopened: the two
  constants, the `>=` boundary at exactly 1000, `HOLIDAY_LIMIT`, raising `max-rows`, provisioning a
  real project, the end-to-end seam pin, `absence.ts`, CAL-06's performance target, and the three
  other stale board items.

## 5. The ADR-015 citation, and what this verdict cites instead

The idea establishes that **`ADR-015` does not authorise paging** — `grep` over that file returns zero
matches for `pag` or `range(` — and that the false half is repeated in five places including
`.ai/registry/features.md:102`. **Every citation in this verdict, in the row below and in the ticket
shell names CAL-04's plan (`:176-180`) and nothing else.** The `features.md` copy is human plane under
RULE-01: it is recorded as a finding for `/thuki` and is **not** corrected here, and the new `CAL-09`
row does not repeat it.

## 6. What this verdict wrote

1. **`.ai/registry/features.md`** — the `CAL-09` row. Next free number in the group (`CAL-01` to
   `CAL-08` are issued), `Status: PLANNED`, `Notes` citing this idea file, which is the only provenance
   a reviewer gets.
2. **`.ai/board/tickets/CAL-09/ticket.yaml`** — from `.ai/templates/ticket.yaml`, `state: BACKLOG`,
   Definition of Ready items 1, 3, 4 and 6 filled. **Items 2 and 5 — `invariants_touched` and
   `size_estimate` — are left exactly as the template ships them.** They are PLAN's, and the gate sits
   after PLAN so that they can be.
3. **`.ai/board/backlog.md`** — one row appended to `## BACKLOG`, and item 1 of the four-item paragraph
   marked discharged in place rather than deleted, on that file's own convention.

**No image is attached, so there is no `design/` folder and none is to be created.**

**No acceptance criteria are written here.** They are PLAN's, from the registry row.

## 7. What could not be verified

- **The real row count of any live team.** Unmeasured, everywhere; the idea says so and this verdict
  claims nothing more. It decides urgency and not whether the promotion is right.
- **That paging fixes anything observable in this repository.** Every runner drives the mock
  (`playwright.config.ts:49-51`), so a test can prove the loop is *implemented* and cannot prove it
  *repairs* a truncation the mock cannot produce. The real implementation's count-against-assembled
  comparison is unreachable in the mock and must be declared rather than glossed —
  `tests/pending-entries.test.ts` is the shipped precedent for declaring exactly that. The page size
  constrains the test directly: `PENDING_PAGE_SIZE` is 50 (`src/lib/domain/types.ts:556`) because
  crossing a boundary at 1000 would mean creating 1001 rows.
- **The consult's ADR sweep** (ADR-005, ADR-011, ADR-013/INV-04, ADR-014, ADR-027). ADR-027's
  `WITHDRAWN` status is verified in the idea's evidence item 10; the other four were not independently
  re-read in this half, and the "supersedes nothing" answer rests on the consult for them.
