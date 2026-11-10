---
ticket: CAL-06
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-04T16:00:27+07:00
inputs_read:
  - .ai/board/tickets/CAL-06/ticket.yaml
  - .ai/board/tickets/CAL-04/01-plan.md
  - .ai/board/tickets/CAL-05/01-plan.md
  - .ai/board/ideas/2026-08-31-the-team-cannot-see-its-own-shape.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-013-a-removed-member-counts-until-removal.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/App.tsx
  - tests/absence.test.ts
  - vite.config.ts
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-06 — Year view: one row per member across 365 days

## 1. Problem and scope

### The feature row, transcribed

`.ai/registry/features.md:93`, `CAL-06`, group `CAL`, status `PLANNED`, invariants touched
`INV-04, INV-05, INV-07`:

> From 2026-08-31-the-team-cannot-see-its-own-shape.md. Brief 7.1's long-range view, carrying the
> brief's own acceptance target: thirty members and 365 columns, still scrolling smoothly. URL anchor
> `/year/:yyyy`. **It is the only view that enumerates members who have no entries**, which is why
> rbac-and-security.md carries `Read the member list` — a row recorded there as derived from this
> layout rather than decided by the operator, and marked for confirmation. It consumes CAL-04's
> absence-count function; if a year of counts cannot be served that way, moving the computation into
> SQL is a second implementation of INV-04 and is a decision rather than a workaround. **The prototype
> is not evidence for this row and copying it reproduces INV-04's failure twice:** `_figma/src/App.tsx`
> computes the absence count **inline in two separate places**, with a hard-coded denominator and
> threshold, and never consults `status`, so a rejected entry counts; it also draws 48 random dots per
> person rather than 365 columns, so the thirty-people target has never been demonstrated at the
> specified shape. **Decided 2026-08-31**: a removed member keeps a row for the part of the year they
> were on the team, and it is empty after `removed_at`. This follows ADR-013 rather than adding to it
> — a view draws an entry exactly when that entry is counted — so the roster query filters on
> `removed_at` per date and needs no display rule of its own.

### What this gives whom

Every **member** gains the long-range shape of the team. The month grid answers *how crowded is that
day*, the week view answers *who, and for how much of the day*; neither can answer *who is thin on
the ground in August* or *has anybody taken a break since March*. This view is one row per person
across the whole year, and it is the only one where a person with **no** entries is visible at all —
on the other two screens somebody who has declared nothing simply does not appear.

That last property is why this ticket touches the permission model's weakest row.
`.ai/standards/rbac-and-security.md` grants `Read the member list` to both roles and records it as
**derived from this layout rather than decided by the operator**, then confirmed. This is the layout
it was derived from, and section 3 states what that means rather than treating the row as settled.

**`size_estimate`: M.** Eight files, one of them new, no migration, no seam function and no new read.
Not `S`: fourteen criteria, a fourth derivation inside INV-04's module, and a rendering target the
brief states in words. Not `L`: every read exists, every rule exists, and the ticket sits entirely
above the seam.

### § 2b — the visual reference

**None was attached, at either stage, and the layout in section 4 is my own.**

Checked rather than assumed: `.ai/board/tickets/CAL-06/design/` does not exist, the ticket folder
holds only `ticket.yaml`, `find .ai/board -type f` matches no image of any extension, and the idea
file this row cites carries no image and no `Evidence` attachment.

**The layout is the Tech Lead's own and was never specified.** That is § *Visual specification*'s
obligation, and it matters more on this ticket than on CAL-05, because there **is** a picture of a
year view in this repository and it is not a specification. The feature row disposes of it in
advance: *the prototype is not evidence for this row and copying it reproduces INV-04's failure
twice.* `_figma/src/App.tsx` computes the absence count inline in two places with a hard-coded
denominator and threshold, never consults `status` so a rejected entry counts, and draws 48 random
dots per person rather than 365 columns — so it has never demonstrated the target it appears to
illustrate. **It is not read, not cited and not copied**, and it is excluded from `allowed_paths` by
being absent from it.

What is **not** invented: the feature ID, the behaviour, the permissions, the invariants, the removed-
member rule and every field name — all from the row above, ADR-013 and the modules CAL-04 shipped.

### Out of scope

- **Any write.** No create, edit, delete, approve or reject. This is a read-only view for both roles
  and section 3 states it as a denial.
- **Half-day detail, notes and approver names.** CAL-05 is the per-person detail view and already
  renders all three. A year cell is one day wide; putting a note in it would make the densest screen
  in the product the one carrying the most text.
- **The overload warning while choosing dates.** CAL-07.
- **Holidays, bridge days and weekend shading.** ADM-02 and CAL-08. CAL-08's row already says it
  draws day status on this surface later; this ticket must not acquire a notion of a non-working day.
- **Moving any computation into SQL.** The row forbids it as a workaround and the ticket shell's
  item 4 repeats it: if a year of counts cannot be served by the seam's function, that is *a decision
  at PLAN*, not a schema delta this ticket may assume. Section 4.2 records that it can be served, and
  section 8 records what would have to be true before the question reopens.
- **Copying, reading or citing `_figma/`.** § 2b.
- **`src/components/EntryForm.tsx`, `src/lib/data/mock.ts`, `src/lib/data/supabase.ts`,
  `src/routes/EditEntry.tsx`, `src/routes/NewEntry.tsx`** — OPS-002's five remaining `copyDebt`
  files. None is touched, so the two tickets cannot collide.
- **Renaming `MONTH_ENTRY_LIMIT`.** It now serves three range-shaped callers and its name names one.
  *Open questions* item 2 — the rename would put both seam implementations in `allowed_paths` and
  collide with OPS-002 for no behaviour change.

## 2. Acceptance criteria

Observable through the interface or through `pnpm test`. The selector attribute is `data-testid`.

**AC-1 — the year is anchored by the URL and renders every day of it**
- **Given** a signed-in member
- **When** they open `/year/2026/members`
- **Then** the grid renders 365 day columns, the first being 2026-01-01 and the last 2026-12-31

**AC-2 — a leap year renders 366 days**
- **Given** a signed-in member
- **When** they open `/year/2028/members`
- **Then** the grid renders 366 day columns, ending 2028-12-31

**AC-3 — one row per member of the team, including members with no entries**
- **Given** a team in which at least one member has declared nothing all year
- **When** the year renders
- **Then** every member of the roster has exactly one row, and the member with no entries has a row
  with no filled cells rather than no row

**AC-4 — a cell is filled exactly on the days that member is away**
- **Given** a member with one PTO entry running 2026-03-02 to 2026-03-06
- **When** the year renders
- **Then** that member's row has filled cells on those five dates and on no others

**AC-5 — PTO and WFH are distinguishable in a cell**
- **Given** one member with a PTO entry and another with a WFH entry, on the same date
- **When** the year renders
- **Then** each filled cell states its own type, and the two are different values rather than both
  reading as absent

**AC-6 — a tentative entry fills its cells (INV-05)**
- **Given** a `tentative` entry
- **When** the year renders
- **Then** its member's cells are filled on the same terms as a non-tentative entry, and are
  additionally marked tentative

**AC-7 — a rejected entry fills nothing**
- **Given** an entry with `status` `rejected`
- **When** the year renders
- **Then** its member's cells for those dates are not filled by it — the grid draws exactly what the
  count sums

**AC-8 — a removed member keeps a row for the part of the year they were on the team**
- **Given** a member removed partway through the displayed year, holding an entry spanning the
  removal
- **When** the year renders
- **Then** that member has a row, its cells are filled on dates before the removal date, and no cell
  is filled on or after it

**AC-9 — the per-day totals are the same numbers the month grid shows (INV-04)**
- **Given** any date visible in both views
- **When** the year's total for that date and the month cell's count for that date are compared
- **Then** they are the same number

**AC-10 — the grid and the totals cannot disagree about who is away (INV-04)**
- **Given** any date in the displayed year
- **When** the filled cells in that date's column are counted against the day's total
- **Then** every member with a filled cell contributes to that total, and no member without one does

**AC-11 — moving between years, and switching views, keeps the date**
- **Given** a member on `/year/2026`
- **When** they move to the previous year, then the next, then follow the link to the month view
- **Then** `/year/2025` and `/year/2027` render in turn, and the month view opens on a month of the
  year they left

**AC-12 — the year view is reachable from the month and the week, and returns to them**
- **Given** a member on the month view, and a member on the week view
- **When** each follows the year link
- **Then** both reach the year containing the period they were looking at, and the year view offers a
  link back to the month

**AC-13 — the three non-list states**
- **Given** a caller with no session, a signed-in caller with no member row, and a read that fails
- **When** `/year/2026/members` is opened in each case
- **Then** the first is sent to sign in, the second sees the member-less state, and the third sees a
  failure state and no grid

**AC-14 — a possibly-truncated read is refused rather than under-reported**
- **Given** a year whose entries come back at the row limit
- **When** the screen resolves
- **Then** it shows the failure state and draws no grid, rather than a grid missing the entries the
  read dropped — and this holds on BOTH year screens, the member grid at `/year/:yyyy/members` and
  the overview at `/year/:yyyy`, each refusing in place with its own failure state

### Invariants touched

`[INV-04, INV-05, INV-07]` — exactly the three the feature row lists. This plan adds none and removes
none.

- **INV-04** — held by consuming CAL-04's module. This view renders **two** things derived from the
  same numbers: which cells are filled, and the per-day totals. Section 4.1 adds a fourth derivation
  from the **same single pass** that already produces the counts, the avatars and the week rows, so
  a filled cell and a total cannot disagree without `walk` itself being wrong. AC-7, AC-8, AC-9 and
  AC-10 are the observations. **AC-9 is the one that matters**: it compares this screen against the
  month grid, and a divergence between them is invisible on either alone — the same reasoning CAL-05
  applied to its AC-12.
- **INV-05** — held by that same pass, which never reads `tentative`. AC-6 asserts a tentative entry
  fills its cells on the same terms; the marking is visual and changes nothing about which cells fill.
- **INV-07** — held by `entry_select_team` and `member_select_team`, both already shipped. Every row
  and every entry comes from a team-scoped read; this ticket introduces no read of its own, so no
  member and no entry of another team can reach the screen.

**INV-06 is absent and, unlike on CAL-05, nothing here makes it visible.** A year cell is one day
wide and carries no portion, so a five-day `pm` entry fills five cells exactly as a five-day `full`
one does — which is INV-06 being relied on, not chosen, and not rendered. CAL-05's row calls itself
*the only surface where INV-06 is visible* and that stays true.

**INV-01, INV-02 and INV-03 are absent and unreachable.** Nothing on this surface writes.

### Open questions

1. **The brief's target — *thirty members and 365 columns, still scrolling smoothly* — is asserted
   in two halves, and the second half is not asserted at all.** The structural half is AC-1 and AC-3
   and is observable today. The performance half is not, and this plan does not invent a threshold
   for it, because there is none in the brief, the charter or the registry and an invented number
   would be indistinguishable from a decided one. Two facts make it unassertable rather than merely
   unasserted, both verified: `vite.config.ts` sets `test.environment: "node"`, so there is **no DOM
   and no component-render level** in this repository; and the seeded roster on the main team is
   **five members**, so no end-to-end run can reach thirty. What section 4.3 does instead is state
   the rendering constraints that make the target achievable and assert the pure derivation at 30 ×
   365 in a unit test. **Not blocking.** Closing it properly is a decision — a seeded thirty-member
   roster, or a component-test environment with a render budget — and both are their own work.

2. **`MONTH_ENTRY_LIMIT` now names one caller and serves three.** CAL-04 declared it, CAL-05 reused
   it for a week, and this ticket reuses it for a year. The name is wrong and the constant is not:
   section 4.2 explains why the value still holds. **Not blocking, and deliberately not renamed** —
   the rename touches `src/lib/data/supabase.ts` and `src/lib/data/mock.ts`, both of which are
   OPS-002's remaining `copyDebt` files, and a cosmetic rename is not worth the two-writer hazard
   ADR-006 exists to prevent.

3. **`Read the member list` is still marked as derived-then-confirmed rather than decided.**
   `.ai/standards/rbac-and-security.md` records that the row exists *because of this layout*, and
   this is the ticket that builds the layout. The confirmation already happened on 2026-08-31 and the
   row is ✅ for both roles, so nothing is blocked. Recorded because a reader who finds the marking
   later should know which ticket made the row load-bearing, and because if the operator ever
   narrows that permission, this screen is the one that stops working.

---

*Sections 1 and 2 above were written before the source tree was read for this ticket. Sections 3 to 8
were written after. Nothing in 1 or 2 was amended.*

---

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **No permission changes, no policy ships, no grant
ships**, and every read this view issues is one the caller could already make.

| Action | `member` | `admin` | Where the decision is made |
|---|---|---|---|
| Read the member list | ✅ | ✅ | `member_select_team`, TEA-03, untouched — **and this is the row this layout derived** |
| Read any entry in the team | ✅ | ✅ | `entry_select_team`, CAL-01, untouched |
| Read the overload threshold | ✅ | ✅ | `team_select_own`, CAL-04 — **not read here**, section 4.2 |
| Approve, reject, edit, delete or create from this screen | ❌ | ❌ | **no control exists.** Section 4.3 |

**This is the layout `Read the member list` was derived from, and that deserves saying plainly rather
than being inherited quietly.** That file records the row as *"derived from this layout rather than
decided by the operator"*, then confirmed on 2026-08-31, and gives the derivation: a member can
already read every entry in the team, and this view renders one row per member, so a member who could
not read the member list could still enumerate it from the entries they are entitled to read. **The
derivation only holds because of this screen.** Nothing changes here — the permission is already
granted and already used by TEA-03's own screen — but this is the ticket that makes it load-bearing,
and *Open questions* item 3 says what breaks if it is ever narrowed.

**The read-only denial is held by absence, and that is the weakest mechanism in this plan.** There is
no policy to point at: an admin reaching `seam.updateEntry` from a console still succeeds, correctly,
because CAL-03 granted it. What this ticket guarantees is that no admin action reaches *this surface*
— held by the view calling no write function and rendering no write control. **A reviewer checks it
by reading the imports and the seam calls in `YearView.tsx`**, which section 4.2 enumerates exactly
for that purpose. It is the same shape CAL-05 used and the same shape a reviewer should expect on
CAL-08.

**A removed member's row is visible to everyone, and that is not a new disclosure.** `listMembers`
already returns removed members with `removedAt`, TEA-03's screen already reads it, and ADR-013
requires the roster to carry it so INV-04 can be computed for past dates. This view draws that row;
it exposes no field the roster read did not already return.

## 4. Contract

No entry point, no schema, no field name and no seam signature changes. What section 4 pins is the
fourth derivation, the reads the screen is permitted, and the arrangement § 2b makes mine.

### 4.1 One addition to INV-04's module — `src/lib/data/absence.ts`

The year grid is indexed the other way round from every screen before it. `absenceCountsFor`,
`absentMembersFor` and `absentEntriesFor` are all **date-first**: given a date, what is true. The year
view asks **member-first**: given a member, which days.

**The wrong fix is to transpose in the component, or to filter `entries` there.** The second is a
verbatim second implementation of INV-04's rules; the first is subtler and is the one worth naming —
a transposition looks safe because it consumes the right answer, but building it over 365 dates and
30 members means walking a 10,950-cell product in the render path, and the temptation to skip the
intermediate map and filter directly is exactly how the second implementation arrives.

**The right fix is a fourth derivation from the same pass**, which is the shape the module already
establishes three times over:

```ts
/**
 * CAL-06. For each member of `roster`, the set of dates in `range` on which they are away —
 * derived from the SAME `walk` that produces `absenceCountsFor`, `absentMembersFor` and
 * `absentEntriesFor`.
 *
 * This is the fourth derivation and not a second definition. INV-04's rules — rejected excluded,
 * tentative never consulted, a member counting only while `removedAt` is null or strictly after the
 * date, an entry clamped to the requested range — are applied exactly once, inside `walk`. A filled
 * cell that disagreed with a day's total would require `walk` itself to be wrong, which is the only
 * failure mode INV-04 leaves open (AC-9, AC-10).
 *
 * EVERY MEMBER OF `roster` IS A KEY, carrying an empty set where they are away on no date. That is
 * AC-3 and it is the property that makes this the only view enumerating members with no entries: a
 * map built from the entries alone would silently omit them, and the omission would look like a
 * member who is never away rather than a member the grid forgot.
 *
 * A member holding an `am` and a `pm` entry on one date yields that date ONCE. The set is "is this
 * member away on this day", the day's total is still 1.0, and the two are the same fact told twice —
 * which is what INV-04 requires.
 */
export function absentDatesByMember(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): ReadonlyMap<string, ReadonlySet<string>>;
```

**No new domain type and no new constant.** The return is a map of existing primitives, so
`src/lib/domain/types.ts` is untouched and absent from `allowed_paths` — the first calendar ticket
for which that is true.

**Type is carried separately, not in the set.** AC-5 needs a cell to say `pto` or `wfh`, and a
`Set<string>` cannot. The component reads that from `absentEntriesFor`, which is already exported and
already keyed by date — one lookup per filled cell rather than per cell. Section 4.3 fixes it.

### 4.2 The reads this screen may make, and the two it may not

```ts
seam.getCurrentMember()                          // membership state
seam.listMembers()                               // the roster, INCLUDING removed members (ADR-013)
seam.listTeamEntriesOverlapping({ start, end })  // Jan 1 to Dec 31 of the anchored year
```

**No fourth call and no write call at any point.** `getTeam()` is deliberately absent for the second
time: it supplies `overloadThreshold`, this view renders per-day totals but **no overload state**, and
calling it would be the first step toward a colour this ticket has not designed. `listTeamEntries` —
the flat read CAL-03 added — is also absent: this is a range read and it already exists.

**`MONTH_ENTRY_LIMIT` is reused and no new constant is added, and here that needs a real argument
rather than CAL-05's.** On CAL-05 the reuse was safe because a week is smaller than a month. A year
is twelve times larger, so the headroom argument inverts and the limit becomes genuinely
load-bearing. It is still the right call, on two grounds. First, the limit is a property of
`listTeamEntriesOverlapping`, which is one read serving three callers — a second constant would have
to move whenever the first did, and the read would then have to choose between them by range length,
which is a rule nobody would maintain. Second and decisively, **the failure is loud rather than
silent**: both implementations throw when the row count reaches the limit rather than returning a
short list, so a team that outgrows 2000 entries in a year gets AC-14's failure state and not a grid
with holes in it. The `TODO(verify)` on the datastore's own `max-rows` cap, already carried by
CAL-04, ADM-02 and ADM-04, is unchanged and undischarged.

### 4.3 The layout — mine, per § 2b

Route `/year/:year`, plus `/year` redirecting to the current year, matching how `/month` and `/week`
already ship. `:year` is `yyyy`; anything else redirects to the current year rather than rendering an
empty grid.

**Header**, one row: link home, previous year, the year label, next year, and a link to the month
view for January of the displayed year — AC-11 and AC-12.

**Body**, a grid with one row per member and one column per day of the year, plus a totals strip.

- **Row order**: `displayName` ascending, then `id` — deterministic, and the same tiebreaker
  `listMembers` already uses so the two orders cannot disagree.
- **Every member of the roster gets a row**, including one with no filled cells (AC-3) and including
  a removed member (AC-8).
- **A month ruler** above the columns, so a column can be located without counting.
- **The totals strip** carries one number per day from `absenceCountsFor` over the same range —
  this is the *"year of counts"* the feature row names, and it is what makes AC-9 comparable against
  the month grid.

**The rendering constraints, which are the whole reason this screen is different from the other
two.** 30 × 365 is 10,950 cells and the brief asks for it to scroll smoothly:

- **No React component per cell.** A cell is an element in a CSS grid, not a component with props and
  its own reconciliation.
- **Nothing is computed per cell.** Every cell reads a precomputed lookup — the member's date set
  from `absentDatesByMember`, and its type from the date-keyed map — so the render is a walk over
  data that is already shaped, not a filter per cell.
- **The two maps are built once**, in a `useMemo` keyed on the entries, the roster and the range, the
  same shape `MonthView` and `WeekView` already use.
- **Horizontal scroll is the grid's, not the page's.** The member column stays visible while the days
  scroll, or the view stops being readable at the width it exists for.

Following `CLAUDE.md` § *Visual direction*: PTO peach, WFH mint, tentative at reduced opacity. **No
overload colour appears**, because no overload state is computed. Charm belongs in the empty states;
this is the densest grid in the product and information density wins.

| `data-testid` | What it is |
|---|---|
| `year-anchor` | the year label, carrying `data-year` |
| `year-home`, `year-prev`, `year-next`, `year-month` | the five header links |
| `year-grid` | the grid container |
| `year-row` | one per member, carrying `data-member-id` |
| `year-row-name`, `year-row-avatar` | who |
| `year-cell` | one per member per day, carrying `data-date` and, when filled, `data-type` — **AC-4, AC-5** |
| `year-cell-tentative` | the tentative marking — **AC-6** |
| `year-total` | one per day in the totals strip, carrying `data-date` and `data-count` — **AC-9** |
| `year-month-label` | the month ruler |
| `year-loading`, `year-not-on-a-team`, `year-unavailable` | the three non-list states — **AC-13, AC-14** |

**`data-type` and `data-count` are the attributes the criteria turn on**, not the rendered colour or
the rendered digit. Asserting the attribute keeps AC-5 and AC-9 true when § *Language* fixes wording
and when the palette is finally written into `.ai/standards/ui-design-system.md`.

**Every string on this screen is English.** `src/routes/YearView.tsx` is new, so the § *Language* lint
rule covers it from its first line; it is not in `copyDebt` and must never be added to it.

## 5. Seam impact

**None.** No function is added, removed or changed. `tests/seam-parity.test.ts` is untouched and
unaffected, and is not in `allowed_paths`.

This is the second ticket running for which that is true, and it is the same evidence CAL-05 gave:
CAL-04 decided `absenceCountsFor` is **not** a seam method and that neither implementation calls it,
so the seam returns rows and counts nothing. A third view over the same rows therefore needs no new
read, no new implementation in `mock.ts`, no new implementation in `supabase.ts`, and gives the
parity test nothing new to miss. The entire cost of this feature is one exported function above the
seam and one screen.

`src/lib/data/absence.ts` imports nothing from `./index` and nothing from either implementation, so
adding to it crosses no boundary and RULE-02's lint rule is untouched.

## 6. Schema delta

**`none`.** No migration, no table, no column, no enum, no policy, no trigger, no constraint, no
grant. ADR-014 does not engage: this ticket ships no `.sql` file of any kind.

Every policy this view depends on exists and is untouched — `entry_select_team` from CAL-01,
`member_select_team` from TEA-03. `team_select_own` from CAL-04 exists and is deliberately not used.

**The shell's item 4 warning is discharged rather than inherited.** It says: *if the 365-column read
cannot be served by the seam's count function, moving that computation into SQL is a second
implementation of INV-04 and needs a decision at DESIGN — it is not a schema delta this ticket may
assume.* Section 4.2 records that it **can** be served: one range read for the year, one pass over
the rows, four derivations from it. No SQL aggregate, no view, no function in the database, and
therefore no decision owed. Section 8 records what would have to become true before the question
reopens.

`ticket.yaml` already carries `schema_delta: none` and `requires_adr: false`, and **both are correct
as they stand.** Neither is changed.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/data/absence.ts"
  - "src/routes/YearView.tsx"
  - "src/routes/MonthView.tsx"
  - "src/routes/WeekView.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "tests/absence.test.ts"
  - "tests/e2e/cal-06-year-view.spec.ts"
```

Eight globs, eight files; two are new — `src/routes/YearView.tsx` and the spec.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Eight is well inside M's ceiling of twelve, and it is the same eight CAL-05 needed for the same
reason: CAL-04's boundary, not this ticket's restraint.

**`MonthView.tsx` and `WeekView.tsx` each take one header link and nothing else** — AC-12. CAL-05
added month→week; this adds month→year and week→year, which is the third view arriving and the
switcher becoming complete. **Both links go in the header, never on a cell**: a month cell already
carries CAL-04's draft-panel click, and a second target there would put this ticket's routing on top
of another ticket's shipped criteria. `Home.tsx` takes one nav link, as it did for the month and the
week.

**No collision with OPS-002.** Its five remaining `copyDebt` files are `src/components/EntryForm.tsx`,
`src/lib/data/mock.ts`, `src/lib/data/supabase.ts`, `src/routes/EditEntry.tsx` and
`src/routes/NewEntry.tsx`. None appears above — which is also why *Open questions* item 2 declines
the `MONTH_ENTRY_LIMIT` rename.

**Deliberately absent, each with its reason:**

- **`src/lib/domain/types.ts`** — nothing is added. The fourth derivation returns a map of existing
  primitives and no new constant is declared. The first calendar ticket for which this file is
  untouched.
- **`_figma/**`** — § 2b. Not evidence, not read, not copied. It is also already outside every lint
  and audit scope, and its absence here is the record that it was considered and refused.
- **`src/lib/data/index.ts`, `supabase.ts`, `mock.ts`** — no seam change (section 5), and the last
  two are OPS-002's.
- **`tests/e2e/cal-04-month-view.spec.ts` and `tests/e2e/cal-05-week-view.spec.ts`** — **the safety
  nets for the two one-line header changes, and both must pass unedited.** If a header link breaks a
  selector on either screen, those suites are what report it.
- **`tests/seam-parity.test.ts`, `tests/ui-language.test.ts`** — pass unedited; neither has anything
  to change.
- **`ui-language.json`** — nothing translated, nothing de-listed. `YearView.tsx` is new so the rule
  covers it immediately and it must never be added to `copyDebt`; the list only ever shrinks.
- **`src/lib/fixtures.ts`, `supabase/seed.sql`** — no fixture is added. *Open questions* item 1
  records that a thirty-member roster is what the brief's target would need and that adding one is
  its own decision, not a side effect of this ticket.
- **Every migration** — never edited, and none is added.
- **`.ai/standards/rbac-and-security.md`** — the `Read the member list` row is consumed and its
  marking is reported in *Open questions* item 3, never amended. Human plane, RULE-01.
- **`.ai/registry/features.md`** — registry plane; the `Status` column is `/ship`'s.

## 8. Rejected alternatives

**1. Serving the year from a SQL aggregate — a view or a function returning per-member, per-day
rows.** The strongest alternative on paper, and the one the feature row anticipates by name. A year
of entries for thirty people is the largest read in the product, the database is very good at exactly
this shape, and it would cut the client's work to rendering. It is rejected because the row forecloses
it as a *workaround* and permits it only as a *decision* — and the decision fails on its own merits
today. Under ADR-005 there is no server, so a SQL aggregate is a second implementation of INV-04
living in a place `tests/seam-parity.test.ts` cannot compare and `tests/absence.test.ts` cannot
execute: the two would agree until somebody changed the removal rule or the rejected-status rule in
one of them, and the symptom would be a year grid disagreeing with a month cell — the exact failure
INV-04 exists to forbid. It also cannot serve CAL-07, which needs the count a day *will* have if an
unsaved draft is saved, and an unsaved entry has no row for SQL to aggregate. **What would reopen it:**
a measured render that misses the brief's target with the constraints in 4.3 applied, at a roster
size that actually exists. That is a measurement nobody can take today (*Open questions* item 1), and
taking it is the first step, not writing the SQL.

**2. Rendering only the months that contain entries, or collapsing empty stretches.** Genuinely
plausible and it is what a reader worried about 10,950 cells reaches for: most teams have long empty
runs, and a grid that skipped them would be a fraction of the size and arguably easier to read. It is
rejected because it destroys the one thing this view is for. The row calls it *the only view that
enumerates members who have no entries*, and the same logic runs along the other axis — a year with
a three-month gap is **information**, and a grid that collapses the gap makes "nobody was away in
August" and "August is not shown" the same picture. It is the same argument CAL-05 settled for its
seven always-rendered days, one dimension up, and the cost is the honest one: the screen is large
because the year is.

**3. Transposing `absentEntriesFor` in the component instead of adding `absentDatesByMember`.**
Superficially the tidiest option — no new export, no new unit tests, and it consumes an answer that
is already correct, so it cannot be a second implementation of INV-04. It is rejected on two grounds.
The first is AC-3: `absentEntriesFor` is keyed by **date** and its values name only the members who
are away, so a member with no entries never appears in it, and a transposition would silently drop
exactly the rows this view exists to show — the failure would look like a member who is never away.
The second is where it leads: the transposition is a 365-key walk building 30 sets in the render path,
and the obvious optimisation is to skip the intermediate map and filter `entries` per member, which
**is** the second implementation. A derivation from `walk` costs one function, keys on every roster
member by construction, and removes the pressure that would produce the bad version later.

## Changelog

- `2026-09-04T16:00:27+07:00` — sections 1 to 8 written, § 2b recording that no image was attached at
  either stage and that the layout is the Tech Lead's own. Sections 1 and 2 written before the source
  tree was read; nothing in either was amended afterwards. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
- `2026-09-09T11:38:02:z` — **AC-1, AC-2, AC-13 and AC-14 reworded by CAL-10, and by nothing else.** ADR-032,
  `ACCEPTED by the operator` 2026-09-09, made the twelve-month overview the DEFAULT year screen: this
  grid moves from `/year/:yyyy` to `/year/:yyyy/members` and is otherwise untouched — its behaviour,
  its markup, its test ids and UIE-08's repaint of it all survive (ADR-032 § *Consequences* items 1
  and 6). **NO CRITERION'S SUBSTANCE MOVED.** AC-1, AC-2 and AC-13 changed an address they named
  literally; AC-14 named no address and was reworded because its subject is *the grid*, which now
  names one of two screens while its refusal must hold at both. **AC-3 to AC-12 ARE DELIBERATELY
  UNTOUCHED** — AC-3, AC-4, AC-5, AC-6, AC-8, AC-9 and AC-10 open *"When the year renders"* and carry
  no address; AC-7 and AC-11 likewise; and AC-12's *link back to the month* is satisfied unchanged by
  the top bar's `Month` segment and again by the overview card footer's `View →`, which CAL-10
  targets at `/month/yyyy-MM` precisely so that this criterion did not have to move. Written by
  `developer` at CAL-10's IN_PROGRESS, which is the stage ADR-032 assigns the edit.
