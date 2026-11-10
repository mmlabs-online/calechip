---
ticket: CAL-10
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-09T11:46:13:z
inputs_read:
  - .ai/board/tickets/CAL-10/01-plan.md
  - .ai/board/tickets/CAL-10/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/01-operating-model.md
  - src/App.tsx
  - src/routes/YearView.tsx
  - src/routes/MonthView.tsx
  - src/components/TopBar.tsx
  - src/components/Sidebar.tsx
  - src/components/EntryForm.tsx
  - src/lib/period.ts
  - src/lib/data/absence.ts
  - src/lib/data/day-status.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/index.css
  - eslint.config.js
  - ui-language.json
  - tests/absence.test.ts
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - .ai/board/tickets/CAL-06/01-plan.md
  - .ai/board/tickets/CAL-08/01-plan.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-10 — implementation log

## Files touched

Ten files, which is exactly `allowed_paths`. Nothing outside it was written; `ticket.yaml` and this
log are in the active ticket's own folder, which the guard exempts
(`.claude/hooks/guard-allowed-paths.mjs:205-206`).

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/YearOverview.tsx` | created | The screen: the four-card summary band, the twelve month cards, and the three non-list states. Also holds `YearMembers`, the malformed-anchor wrapper AC-3 needs — see § Deviations 1. | § 4.3, § 4.4, § 4.6 |
| `src/App.tsx` | modified | Three route lines where there were two: the overview takes `/year` and `/year/:yyyy`, the member grid moves to `/year/:yyyy/members`. | § 4.2 |
| `src/lib/data/absence.ts` | modified | The one added derivation, `absenceByTypeFor` and its `AbsenceByType`, beside the pass they read. Nothing existing changed. | § 4.1 |
| `src/lib/period.ts` | modified | `periodNavFor`'s year branch keeps the `/members` suffix on `prevTo`, `nextTo` and `todayTo`, so stepping a year from the grid stays on the grid. | § 4.5 |
| `tests/absence.test.ts` | modified | Six tests for the partition identity and the fraction, asserted against `absenceCountsFor` over the same fixtures. | § 7, AC-6 and AC-8 |
| `tests/e2e/cal-10-year-overview.spec.ts` | created | Fourteen named tests, one per AC the plan assigns to this file plus AC-2, AC-5, AC-7 and AC-16. | § 7 |
| `tests/e2e/cal-06-year-view.spec.ts` | modified | Address changes to `/year/2026/members` and `/year/2028/members`, and the sidebar leg of AC-12 now lands on the overview. | § 7 |
| `tests/e2e/cal-08-holiday-shading.spec.ts` | modified | Address changes for AC-7 and AC-8; AC-11 and AC-13 reach the grid by address because no link from the week does — see § Deviations 4. | § 7 |
| `.ai/board/tickets/CAL-06/01-plan.md` | modified | AC-1, AC-2, AC-13 and AC-14 reworded, plus a Changelog line naming CAL-10 and ADR-032. | § 1, ADR-032 § Consequences item 1 |
| `.ai/board/tickets/CAL-08/01-plan.md` | modified | AC-7 reworded, plus the same Changelog line. | § 1, ADR-032 § Consequences item 1 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `AbsenceByType` | `src/lib/data/absence.ts:356` | Both halves always present; asserted by a test of its own. |
| § 4.1 `absenceByTypeFor` | `src/lib/data/absence.ts:390` | Signature exactly as contracted. Three lines: it calls the same `walk` with the same `WEIGHT` and adds only which accumulator receives it, so `pto + wfh = total` is an identity. |
| § 4.2 the three routes | `src/App.tsx:347-349` | `YearView` is imported and rendered unchanged; only the path it is mounted at moves. No `/year/members` route, as specified. |
| § 4.3 the four phases | `src/routes/YearOverview.tsx:110-113` | The same `View` union the three period screens use. |
| § 4.3 the three reads | `src/routes/YearOverview.tsx:154-158` | One `Promise.all`, identical to `YearView.tsx:161-171`. `seam.getTeam()` is not called. |
| § 4.3 the derivations | `:177`, `:187`, `:195`, `:205`, `:222` | All imported, none written locally. `tints` is the one addition — § Deviations 2. |
| § 4.3 the figures table | `:286` (card 1), `:291` (card 4), `:297` (the band), `:281` and `:337` (month header) | Every figure is a sum over `counts` or a lookup in the maps beside it. No `.filter`, `.reduce` or comparison over an `Entry` is written in the file beyond `sumOver`, which sums values the derivations already produced. |
| § 4.4 the selectors | § Testability contract below | All twelve, plus one addition — § Deviations 3. |
| § 4.5 the period cluster | `src/lib/period.ts:365-386` | `yearTo` deliberately takes no suffix, as contracted. `todayTo` differs — § Deviations 5. |
| § 4.6 the copy | `src/routes/YearOverview.tsx:297-302`, `:372`, `:486` | `Total absence <yyyy>`, `PTO days`, `WFH days`, `Public holidays`, the unit word `days`, `Empty`, `View →`. Asserted painted, not just written, by AC-17's test. |

## Deviations from the design

Five, all declared, none consulted — each is a place where the plan's prose and its own criteria
disagreed, and in every case the criterion was followed and the sketch was not. The chat budget
(`developer->tech-lead-design`, 0 of 6 used) was not spent, because none of the five needed a
decision the plan had not already made somewhere in itself.

**1 — `YearMembers`, a wrapper over `YearView`, at `src/routes/YearOverview.tsx:514`.** § 4.2
contracts three plain route lines and says `YearView` is rendered exactly as it is today. That cannot
satisfy AC-3's third clause. `YearView.tsx:265` redirects a malformed anchor to
`/year/<currentYear>` — which was the member grid before ADR-032 and is the OVERVIEW after it — so
`/year/banana/members` would silently move the caller between the two screens, which is precisely
what AC-3 forbids. `src/routes/YearView.tsx` is **not in `allowed_paths`**, so fixing it there would
be a RULE-03 violation. The wrapper is the only remaining move: it validates the anchor, redirects to
`/year/<currentYear>/members` when it is malformed, and otherwise renders `YearView` untouched. It
lives in `YearOverview.tsx` rather than in `App.tsx` so that file keeps the property four of its own
route comments assert — *this file holds no clock* — and so the redirect stays in a component, which
is the reason `/month`, `/week` and `/year` each resolve their own anchor today.

**2 — the day-cell tint reads `absentEntriesFor`, not `absentMembersFor`.** § 4.3's figures table
says the tint comes from *"the types present in `faces`' entries for that date"*, but `faces` is
`absentMembersFor`, which returns `Member` and carries no `type` — the sentence cannot be executed as
written. `absentEntriesFor` is the derivation that carries the entry, it is already exported, and it
comes from the **same `walk`**, so AC-12 is unaffected: this is the identical lookup
`YearView.tsx:216-232` already makes for its cell marks. `absentMembersFor` is still used, for the
footer faces, which is what § 4.3 wanted it for.

**3 — one selector beyond § 4.4's table: `year-overview-sign-in`.** AC-14 requires that a caller with
no session *"is sent to sign in"*, and this screen refuses in place rather than redirecting (§ 3), so
the way out has to be a link. `YearView` solves the same problem with `year-sign-in`; the table
simply does not list this screen's counterpart. Named under the `year-overview-` prefix the table
itself establishes, so no existing year selector is shadowed and UIE-02 AC-6 still holds.

**4 — two `cal-08` legs reach the member grid by address rather than by a link.** § 7 calls the two
shipped spec edits *"address changes only"*, and for AC-7 and AC-8 that is exactly what they are.
AC-11 and AC-13 are different: both walked `week-year` to the grid, and `week-year` is
`periodNavFor`'s `yearTo`, which § 4.5 **deliberately** points at the overview. No link anywhere in
the product now reaches `/year/:yyyy/members`, by design — § 1 Out-of-scope forbids adding a control
and § 4.5 forbids pointing the switcher at it. So those two legs type the address. A document load is
safe at both: every holiday they read is a fixture, and `mock.ts` restores the session from
`localStorage`. AC-13 gained a second assertion rather than losing one — it now checks BOTH year
surfaces are free of a holiday control, since ADR-032 turned one surface into two.

**5 — `todayTo` on the member grid is anchored, at `src/lib/period.ts:379`.** § 4.5's sketch reads
`/year${suffix}`, which for the grid is `/year/members` — an address § 4.2 explicitly refuses to
route, and which would in fact match `/year/:year` with a year of `members`, fail `isRealYear`, and
bounce the caller to the **overview**: the exact outcome the same paragraph asks to prevent. The
intent is kept and the expression is not — the current year is resolved for this one target, from
`currentDay()`, which is already this module's one clock. On the overview `todayTo` stays the
anchorless `/year`, as `/week` and `/month` are.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | Every number on this screen is INV-04's number or the declared decomposition of it. Card 1 and each month header are sums over `absenceCountsFor`'s own map (`:286`, `:352`); cards 2 and 3 are `absenceByTypeFor`, which walks the **same `walk`** with the **same `WEIGHT`** and differs only in which accumulator receives the weight — so `pto + wfh = total` is an identity by construction, asserted against `absenceCountsFor` over six datasets in `tests/absence.test.ts` and on the painted screen in AC-5/AC-6's test. The overview writes no arithmetic over an `Entry`: the only reduction in the file is `sumOver`, which adds numbers the derivation already produced. The second definition ADR-032 § Consequences item 4 warns about was the filter-on-a-screen shape, and § 8 alternative 1 records why it was refused. |
| `INV-05` | Held by reuse and by the absence of anything. `walk` never consults `tentative`, `absenceByTypeFor` adds no filter of its own, and the overview adds none either — so a tentative entry counts here on exactly the terms it counts on the month grid and the week list. The unit test that exercises all five shapes INV-04 distinguishes includes a tentative row for this reason. |
| `INV-07` | The summary band is the first figure in the product aggregating a whole year across the whole team, so a differently scoped read would put another team's rows in it. It makes the **same three seam calls the year grid makes**, in the same combination, adding no fourth — so it inherits `entry_select_team`, `member_select_team` and `holiday_select_all` unchanged, and no policy was added. Observable: FIXTURE_OTHER_TEAM_ENTRY is two `full` September days belonging to the other team, and AC-5's test asserts the year total is 3 and not 5 and that 2026-09-21 carries no type. Held negatively too — the picture's five sub-team subtitles are refused in § 1 Out-of-scope and appear nowhere. |

INV-01, INV-02, INV-03 and INV-06 are not engaged, decided rather than omitted: this ticket writes no
entry, edits none and constructs no entry value. INV-06's usual surface is ADR-032 § Consequences
item 2's accepted loss and is not amended here.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | same. No output at all — the § Language rule is in force on `src/**` and this screen adds no diacritic |
| `pnpm exec vitest run` | 0 | 12 files, **208 tests**, all pass. Was 202 before this ticket; the six added are CAL-10's |
| `pnpm exec playwright test` | 0 | **185 tests in 19 spec files**, all pass. Was 171 in 18; the fourteen added are CAL-10's, and the two edited files pass unchanged in substance |
| `node scripts/check-docs.mjs` | 0 | 6 errors, all pre-existing on `main` and all in `.ai/registry/features.md`, which this ticket does not touch — MD-031 is the debt row, opened by commit `929ff6a` |
| `git diff --name-only` subset of `allowed_paths` | yes | ten paths, exactly `allowed_paths`, plus `ticket.yaml` and this log inside the ticket folder the guard exempts |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `year-overview` | `src/routes/YearOverview.tsx:305` (carries `data-year`) |
| `year-overview-loading` | `:232` |
| `year-overview-not-on-a-team` | `:244` |
| `year-overview-unavailable` | `:258` |
| `year-overview-sign-in` | `:248` — the one addition, § Deviations 3 |
| `year-summary-card` | `:317` (carries `data-kind`, `data-value`) |
| `year-month-card` | `:358` (carries `data-month`, `data-count`, `data-empty`) |
| `year-month-card-link` | `:482` |
| `year-month-weekday` | `:380` |
| `year-day-cell` | `:410` (carries `data-date`, `data-day-status`, `data-types`) |
| `year-month-face` | `:456` (carries `data-member-id`) |
| `year-month-face-overflow` | `:468` (carries `data-overflow`) |

No existing selector was renamed, moved or deleted. The `year-` ids CAL-06 and CAL-08 shipped —
`year-grid`, `year-row`, `year-cell`, `year-total`, `year-daystatus-cell`, `year-not-on-a-team`,
`year-sign-in`, `year-holidays-empty` — are untouched and still resolve to exactly one node each,
because the two screens never render together.

## Open questions

**One, and it is the operator's rather than the reviewer's.** The ticket was implemented at
`state: BACKLOG` with `gates.plan.passed: false`. `/plan` behaved correctly — `plan.md:114-115`
forbids it to set state and assigns the DoR grading and the board move to the orchestrator — but
`/next-ticket` has not run, so the PLAN→READY transition and the plan gate's timestamp are unrecorded.
I raised this and the operator re-issued `/implement`, which I took as the decision. **The Definition
of Done requires both gates `passed: true` with timestamps**, so the plan gate still has to be
recorded by the orchestrator before `/ship`, and it should be recorded with the time `/plan` actually
finished (`01-plan.md` front-matter: `2026-09-09T09:42:15+0700`) rather than back-filled with a
later one. All six DoR items were checked and all six pass, so nothing about the work is in doubt —
only the board's record of how it got here.

**Not a question, but the reviewer should not have to rediscover it:** the twelve month cards render
from twelve **slices of one range read**, never twelve reads. § 8 alternative 4 is why, AC-15 depends
on it, and it is the property that makes the band and the cards incapable of describing two different
years. Anything later that fetches a month card on its own breaks that silently.
