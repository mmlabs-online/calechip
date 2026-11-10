---
ticket: CAL-10
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-09T13:41:53+0700
inputs_read:
  - .ai/board/tickets/CAL-10/01-plan.md
  - .ai/board/tickets/CAL-10/03-impl-log.md
  - .ai/board/tickets/CAL-10/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - src/App.tsx
  - src/routes/YearOverview.tsx
  - src/routes/YearView.tsx
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/lib/period.ts
  - eslint.config.js
  - tests/absence.test.ts
  - tests/e2e/cal-10-year-overview.spec.ts
  - .ai/board/tickets/CAL-06/01-plan.md
  - .ai/board/tickets/CAL-08/01-plan.md
  - .claude/hooks/guard-allowed-paths.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-10 — review report

**`next_state: DONE`, not `QA`.** ADR-022 removed the QA stage and the lifecycle at
`.ai/01-operating-model.md:36` runs `IN_PROGRESS -> REVIEW -> DONE`. `.ai/templates/review-report.md:30`
still prints `next_state: QA` in its front-matter block; that is a stale line in the template, not a
state this board has.

**One template heading is stale in the same way, and this report follows the operating model.**
The checklist rows are right: `.ai/templates/review-report.md:44-45` labels R7 *invariants* and R8
*dependencies*, matching `.ai/01-operating-model.md:133-134`. But the heading at
`.ai/templates/review-report.md:55` asks for one row per `invariants_touched` ID under **R8 detail**,
and `:76` says R8 escalates under RULE-07 — the pre-ADR-022 numbering surviving in two lines the
renumber missed. `.ai/01-operating-model.md:147` is authoritative: **R7 is the check that escalates**,
so the per-ID reasoning is under *R7 detail* below.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/CAL-10/ticket.yaml:72-81` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/YearOverview.tsx:41` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `src/lib/data/absence.ts:390-399` and the R5 table |
| R6 | Permission gating matches plan section 3 | PASS | `src/App.tsx:347-349` |
| R7 | No invariant violated — reasoned per ID in `invariants_touched` (RULE-07) | PASS | `src/lib/data/absence.ts:396-397` and the R7 table |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` absent from `git status --porcelain` |

### R1 detail

Thirteen paths are dirty. Ten are `allowed_paths` character for character
(`.ai/board/tickets/CAL-10/ticket.yaml:72-81`). The other three — `01-plan.md`, `03-impl-log.md` and
`ticket.yaml` — are all under `.ai/board/tickets/CAL-10/`, which the guard exempts unconditionally at
`.claude/hooks/guard-allowed-paths.mjs:207`. Nothing outside the union is touched; in particular
`src/routes/YearView.tsx`, `src/components/TopBar.tsx` and `src/components/Sidebar.tsx` are unmodified,
which matters because § 4.2 promised the grid unchanged and § 1 Out-of-scope forbade a shell edit.

`package.json`, `pnpm-lock.yaml`, `.ai/registry/**` and `.ai/standards/**` are all clean — RULE-01 is
not engaged, and the two shipped plan files edited are board plane
(`.ai/board/tickets/CAL-06/01-plan.md:129`, `.ai/board/tickets/CAL-08/01-plan.md:180`).

### R4 detail

`src/routes/YearOverview.tsx:37-57` is the whole import list. `seam` comes from `@/lib/data`
(`:41`), and the three derivation modules imported directly — `@/lib/data/absence` (`:45-51`),
`@/lib/data/day-status` (`:54`), `@/lib/period` (`:56`) — are the identical set `YearView.tsx` and
`MonthView.tsx` already carry. No `@supabase/*` import, no `./mock`, no `./supabase` anywhere in the
diff, so the restricted-import rule at `eslint.config.js:64-77` has nothing to fire on and R3's clean
exit is the mechanical half of this check. `src/lib/data/absence.ts` is inside the seam directory, so
the added function is not a bypass of it.

Every datastore read goes through the seam object and there are exactly four of them —
`src/routes/YearOverview.tsx:135`, `:155`, `:156`, `:157`.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `AbsenceByType` — both halves always present | `src/lib/data/absence.ts:356-359` | Yes — `{ pto: number; wfh: number }`, exported interface |
| § 4.1 `absenceByTypeFor(entries, range, roster)` | `src/lib/data/absence.ts:390-399` | Yes — the three parameters in that order, `readonly Entry[]` / `DateRange` / `readonly Member[]`, returning `AbsenceByType` |
| § 4.1 "nothing else in that module changes" | `git diff src/lib/data/absence.ts` — purely additive after `:349` | Yes — `absenceCountsFor` (`:197-206`), `absentMembersFor`, `absentEntriesFor`, `absentDatesByMember` are byte-identical |
| § 4.2 the three routes | `src/App.tsx:347-349` | Deviation 1: `/year/:year/members` renders `YearMembers`, not `YearView` — accepted, see below |
| § 4.2 no `/year/members` route | `src/App.tsx:347-349` | Yes — three lines, none of that shape |
| § 4.3 the four-phase `View` union | `src/routes/YearOverview.tsx:109-113` | Yes — `loading` / `not-on-a-team` / `unavailable` / `ready` |
| § 4.3 the reads in one `Promise.all`, no `getTeam()` | `src/routes/YearOverview.tsx:154-158`; absence of `getTeam` confirmed by the grep at `:135`-`:157` being the complete list | Yes |
| § 4.3 the four derivations, all imported | `:177` `absenceCountsFor`, `:187` `absenceByTypeFor`, `:195` `absentMembersFor`, `:222` `dayStatusesFor` | Yes |
| § 4.3 figure — summary card 1 = sum of `counts` over the year | `src/routes/YearOverview.tsx:281`, `:286` | Yes — `sumOver` reduces `counts.get(date)` and nothing else |
| § 4.3 figure — cards 2 and 3 = `byType.pto` / `byType.wfh` | `:298-299` | Yes |
| § 4.3 figure — card 4 = dates whose status is a non-working holiday | `:291-293` | Yes — filters `statuses.values()` on `nonWorkingReason === "holiday"`, so the mandated working Saturday is excluded by `dayStatusesFor`'s own decision |
| § 4.3 figure — month header = that month's sum, or the empty word | `:337`, `:372` | Yes |
| § 4.3 figure — day-cell tint | `:410-423` | Deviation 2: reads `absentEntriesFor` (`:205-217`), not `absentMembersFor` — accepted, see below |
| § 4.3 figure — footer faces, union over the month in roster order | `:349-353` | Yes — `view.roster.filter` preserves roster order |
| § 4.3 "no `.filter`, `.reduce` or comparison over an `Entry` in this file" | `:282` is the only `reduce` and it sums numbers already produced; `:292` and `:353` filter a `DayStatus` and a `Member`, not an `Entry` | Yes |
| § 4.4 all twelve selectors | `:305`, `:232`, `:244`, `:258`, `:317-320`, `:358-362`, `:482`, `:380`, `:410-413`, `:456-458`, `:468-470` | Yes, with one addition — Deviation 3 |
| § 4.5 `prevTo` / `nextTo` keep the `/members` suffix | `src/lib/period.ts:365-366`, `:385-386` | Yes |
| § 4.5 `yearTo` deliberately takes no suffix | `src/lib/period.ts:392` | Yes — `/year/${anchor}`, unsuffixed |
| § 4.5 `weekTo` and `monthTo` unchanged | `src/lib/period.ts:390-391` | Yes |
| § 4.5 `todayTo` | `src/lib/period.ts:379` | Deviation 5: anchored on the grid — accepted, see below |
| § 4.6 the copy | `:298-301` labels, `:327` the unit word `days`, `:372` `Empty`, `:486` `View →` | Yes, all English |

**The five declared deviations, each judged rather than accepted on the Developer's word.** All five
are cases where § 4's prose and § 2's criteria disagreed and the criterion was followed. RULE-04 asks
that the contract be implemented; a sketch that cannot be executed as written is not the contract, and
none of the five changes a signature, an address or an observable.

1. **`YearMembers` wrapping `YearView` (`src/routes/YearOverview.tsx:514-522`).** Verified against the
   cause: `src/routes/YearView.tsx:265` redirects a malformed anchor to `/year/${currentYear()}`,
   which ADR-032 made the *overview*. Three plain route lines therefore cannot satisfy AC-3's third
   clause, and `src/routes/YearView.tsx` is not in `allowed_paths`
   (`.ai/board/tickets/CAL-10/ticket.yaml:72-81`) — fixing it there would have been the RULE-03
   violation. The wrapper validates and redirects to `/year/<currentYear>/members`
   (`src/routes/YearOverview.tsx:517-519`) and otherwise renders `YearView` untouched (`:521`). AC-2's
   promise that the grid is unchanged survives, because the wrapper adds no prop and no state.
2. **The tint reads `absentEntriesFor` (`src/routes/YearOverview.tsx:205-217`).** § 4.3's table says
   the tint comes from *"the types present in `faces`' entries"*, but `absentMembersFor` returns
   `Member`, which carries no `type` — the sentence is not executable. `absentEntriesFor` comes from
   the same `walk` (`src/lib/data/absence.ts:271`), so AC-12 is untouched: it is still one pass.
   `absentMembersFor` is still what the footer faces read (`:195`, `:347`).
3. **`year-overview-sign-in` (`src/routes/YearOverview.tsx:248`).** One selector beyond § 4.4's table,
   under the prefix that table establishes, so no existing `year-` id is shadowed. AC-14 requires a
   caller with no session be *sent to sign in* and § 3 forbids a redirect; a link is the only remaining
   mechanism.
4. **Two `cal-08` legs type the address rather than following a link.** Correct and forced:
   `src/lib/period.ts:392` deliberately points `yearTo` at the overview, so no link in the product now
   reaches `/year/:yyyy/members`. Substance is unchanged in both
   (`tests/e2e/cal-08-holiday-shading.spec.ts`, and the whole suite passes).
5. **`todayTo` anchored on the grid (`src/lib/period.ts:379`).** § 4.5's sketch would have produced
   `/year/members`, which `src/App.tsx:347-349` does not route and which would match `/year/:year`
   with a year of `members`, fail `isRealYear` (`src/lib/period.ts:353`) and land the caller on the
   overview — the outcome AC-16 exists to prevent. The intent is kept; `currentDay()` is the module's
   one clock and was already imported.

**The five reworded criteria are address changes and nothing else**, checked line by line against
ADR-032 § *Consequences* item 1: CAL-06 AC-1 (`.ai/board/tickets/CAL-06/01-plan.md:131`), AC-2
(`:136`), AC-13 (`:199`), AC-14 (`:207-208`) and CAL-08 AC-7
(`.ai/board/tickets/CAL-08/01-plan.md:180`). The nine that the ticket and the plan both list as
untouched are untouched — the diff on those two files contains no other criterion line.

## R6 detail

Plan § 3 asserts three things and all three hold.

**Neither route is guarded**, matching `/month` and `/week`: `src/App.tsx:347-349` are plain `Route`
elements inside the same layout parent, with no wrapper of the kind `/allow-list` (`src/App.tsx:220`)
and `/members` (`:223`) carry. A caller with no member row reaches the component and is refused by it
(`src/routes/YearOverview.tsx:241-253`), which is what AC-14 asks for.

**The screen is read-only for both roles.** `src/routes/YearOverview.tsx:135`, `:155`, `:156` and
`:157` are every `seam.` call in the file, and all four are reads. No write function is called and no
control renders one — the same mechanism, and the same acknowledged weakness, `YearView` already has.

**No policy is added and no role is branched on.** The file contains no `role` comparison and no
`isAdmin` test; `seam.getCurrentMember()` is used only to distinguish *no member row* from *ready*
(`:135-142`). The three controls named in § 3 — `entry_select_team`, `member_select_team`,
`holiday_select_all` — are inherited unchanged because the reads are the ones the year grid already
makes (`src/lib/data/index.ts:232`, `:506-512`, `:546`).

**`seam.getTeam()` is not called**, which § 3 and § 1 Out-of-scope both require, so no
`--color-overload` state can be computed on this screen.

## R7 detail

One row per ID in `invariants_touched`, reasoned individually.

| Invariant | Held by | Citation |
|---|---|---|
| **INV-04** — one definition of the absence count, no second definition anywhere | The construction, not an assertion. `absenceByTypeFor` calls the **same `walk`** with the **same `WEIGHT`** as `absenceCountsFor` and adds only which accumulator receives the already-computed weight; since `EntryType` is exactly `"pto" \| "wfh"` (`src/lib/domain/types.ts:217`), `pto + wfh = total` is an identity over any dataset. `walk` is the sole place the rejected-entry, membership and clamp rules live, so the split inherits all three rather than restating any. On the screen, every figure is a sum over `counts` or a lookup beside it — the only reduction in the file adds numbers the derivation already produced. | `src/lib/data/absence.ts:396-397` against `absenceCountsFor` at `:197-206`, whose own visitor is `:203-205`; `WEIGHT` at `:86-90`; `walk` at `:121-148`; `src/lib/domain/types.ts:217`; `src/routes/YearOverview.tsx:281-286` |
| **INV-05** — a tentative entry counts exactly as a non-tentative one | Held by reuse and by the absence of anything. `walk` never reads `tentative` (`src/lib/data/absence.ts:117-119` states it; the body at `:121-148` contains no such test), `absenceByTypeFor` adds no predicate of its own, and `YearOverview.tsx` adds none either — its only `Entry`-shaped loop copies `entry.type` into a tint map without filtering. Asserted at the unit level over the five shapes INV-04 distinguishes, tentative among them. | `src/lib/data/absence.ts:121-148`, `:396-397`; `src/routes/YearOverview.tsx:205-217`; `tests/absence.test.ts:874` |
| **INV-07** — an entry is counted only against its member's team | The summary band is the first whole-year, whole-team aggregate in the product, so this is the ID with real exposure. It is held by scope inheritance: the three reads are `listMembers()`, `listTeamEntriesOverlapping(range)` and `listHolidays(...)` — the identical set and combination the year grid already makes — so `entry_select_team` and `member_select_team` scope them and no fourth read and no policy is added. Held observably as well: the other team's two September `full` days would push the total to 5, and the painted band reads 3. The refused sub-team subtitles appear nowhere in the file. | `src/routes/YearOverview.tsx:154-158` against `src/lib/data/index.ts:506-512`; `tests/e2e/cal-10-year-overview.spec.ts:229-232` |

**INV-01, INV-02, INV-03 and INV-06 are decided not engaged, not omitted.** This ticket writes no
entry, edits none and constructs no entry value — `src/routes/YearOverview.tsx:135-157` is every seam
call in the diff and all four are reads, and `src/lib/data/absence.ts` gained one pure function
(`:390-399`). INV-06's usual surface, the in-cell count, is ADR-032 § *Consequences* item 2's declared
accepted loss on this screen and is carried on `data-types` instead (`src/routes/YearOverview.tsx:413`),
so no invariant is amended and `.ai/registry/invariants.md` is unmodified.

## R8 detail

No dependency was added, removed or upgraded. `package.json` and `pnpm-lock.yaml` do not appear in
`git status --porcelain`, and `git diff --stat` lists nine files, none of them a manifest. No new
import of an external package appears in the diff: `src/routes/YearOverview.tsx:37-38` imports `react`
and `react-router-dom`, both already direct dependencies used by every other route file. No ADR is
therefore owed on this check.

## Findings

None.

## Verdict

`PASS`. R1 through R8 all pass, each citing `file:line`. `next_state: DONE`.

**One thing outside this gate, recorded because it is the orchestrator's and not the Developer's.**
`ticket.yaml` shows `gates.plan.passed: false` with a null timestamp
(`.ai/board/tickets/CAL-10/ticket.yaml:98`) while `state` reads `REVIEW`
(`.ai/board/tickets/CAL-10/ticket.yaml:8`): `/next-ticket` never ran, so PLAN, READY and IN_PROGRESS
were never written. That is a gap in the board's record of how the work got here, not in the work, and
it is not an R-check — but Definition of Done requires both gates `passed: true` with timestamps, so
the plan gate is owed before `/ship`, carrying `/plan`'s own finish time
(`.ai/board/tickets/CAL-10/01-plan.md:5`) rather than a back-filled later one. This report writes no
ticket row.
