---
ticket: CAL-06
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-04T16:38:07+07:00
inputs_read:
  - .ai/board/tickets/CAL-06/01-plan.md
  - .ai/board/tickets/CAL-06/03-impl-log.md
  - .ai/board/tickets/CAL-06/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - .claude/hooks/guard-allowed-paths.mjs
  - scripts/check-allowed-paths.mjs
  - eslint.config.js
  - ui-language.json
  - src/lib/data/absence.ts
  - src/routes/YearView.tsx
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - tests/absence.test.ts
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/cal-05-week-view.spec.ts
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-06 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true.

`next_state` is `DONE` and not `QA`: ADR-022 removed the QA stage and the lifecycle at
`.ai/01-operating-model.md:36` reads `IN_PROGRESS -> REVIEW -> DONE`. The template still ships
`next_state: QA` and still numbers the invariant check `R8` in its detail headings; the operating
model's checklist at `.ai/01-operating-model.md:127-134` is authoritative and numbers it `R7`, which
is the numbering used below. CAL-02 through CAL-05 each recorded the same staleness and it is
repeated here only so this artifact stands alone (RULE-16).

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/CAL-06/ticket.yaml:64-72` — see R1 detail |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/YearView.tsx:39`, `:44-48`; `src/lib/data/absence.ts:20-29` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | see R5 detail |
| R6 | Permission gating matches plan section 3 | PASS | `src/routes/YearView.tsx:144-161`, `tests/e2e/cal-06-year-view.spec.ts:362-390` |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` → empty |

Tests are not an R-check since ADR-022 and were run anyway: `pnpm exec vitest run` → exit 0, 3 files
/ **71 tests**; `pnpm exec playwright test` → exit 0, **84 tests**. `tests/e2e/cal-04-month-view.spec.ts`
and `tests/e2e/cal-05-week-view.spec.ts` both pass **unedited** — neither appears in `git diff
--name-only`, which is what `01-plan.md` section 7 puts them outside `allowed_paths` for: they are
the safety net for the two one-line header links added at `src/routes/MonthView.tsx:334` and
`src/routes/WeekView.tsx:284`.

## R1 detail

Ten paths in the tree. **Eight are source files and each matches a glob** at
`.ai/board/tickets/CAL-06/ticket.yaml:64-72`:

| Changed path | Glob it matches | M / new |
|---|---|---|
| `src/lib/data/absence.ts` | `src/lib/data/absence.ts` | M |
| `src/routes/YearView.tsx` | `src/routes/YearView.tsx` | new |
| `src/routes/MonthView.tsx` | `src/routes/MonthView.tsx` | M |
| `src/routes/WeekView.tsx` | `src/routes/WeekView.tsx` | M |
| `src/routes/Home.tsx` | `src/routes/Home.tsx` | M |
| `src/App.tsx` | `src/App.tsx` | M |
| `tests/absence.test.ts` | `tests/absence.test.ts` | M |
| `tests/e2e/cal-06-year-view.spec.ts` | `tests/e2e/cal-06-year-view.spec.ts` | new |

**The other two are this ticket's own folder** — `.ai/board/tickets/CAL-06/{ticket.yaml,03-impl-log.md}`,
plus `01-plan.md` from the previous stage — which `.claude/hooks/guard-allowed-paths.mjs:206-207`
makes always writable because that is where the stage artifacts go, and which
`scripts/check-allowed-paths.mjs` exempts in CI for the same reason. Same treatment as CAL-01 through
CAL-05. `node scripts/check-allowed-paths.mjs` → exit 0, though its answer is vacuous here (it diffs
against `main` and nothing is committed until `/ship`), so the subset above was read from the working
tree rather than from that exit code.

**`package.json`, `pnpm-lock.yaml`, `src/lib/domain/types.ts`, `src/lib/data/index.ts`, `mock.ts`,
`supabase.ts`, `ui-language.json`, `src/lib/fixtures.ts`, `supabase/seed.sql`, every migration and
`_figma/**` are all absent from the diff**, as `01-plan.md` section 7 requires. `ui-language.json`
carries no `YearView` entry, so the new file is covered by the § *Language* lint rule from its first
line and was never added to `copyDebt`.

## R4 detail

`src/routes/YearView.tsx:39` imports `seam` from `@/lib/data` — the seam's one door — and
`:44-48` imports `absenceCountsFor`, `absentDatesByMember`, `absentEntriesFor` and `eachDateInRange`
from `@/lib/data/absence`, which `src/lib/data/absence.ts:20-29` shows imports nothing from
`./index` and nothing from either implementation. `grep` for `supabase` in the new file matches one
comment and no import. The three seam calls are at `:144`, `:158` and `:159`; there is no fourth.
`pnpm exec eslint .` exits 0 with `no-restricted-imports` on `@supabase/*` in force
(`eslint.config.js:64-75`).

## R5 detail

| Contract item (01-plan.md § 4) | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `absentDatesByMember(entries, range, roster): ReadonlyMap<string, ReadonlySet<string>>` | `src/lib/data/absence.ts:309-325` | Yes — parameter order, types and return type are character-identical to the plan's block |
| § 4.1 fourth derivation from the SAME pass, not a second definition | `src/lib/data/absence.ts:319` — the one `walk` call, the same helper `absenceCountsFor:203`, `absentMembersFor:228` and `absentEntriesFor:271` read | Yes |
| § 4.1 every roster member is a key, empty set where never away (AC-3) | `src/lib/data/absence.ts:315` — the map is seeded from `roster`, not from `entries` | Yes |
| § 4.1 no new domain type, no new constant | `src/lib/domain/types.ts` absent from the diff | Yes |
| § 4.1 type carried separately, one lookup per FILLED cell | `src/routes/YearView.tsx:207-222` — `CellMark` built from `absentEntriesFor`, keyed `memberId\|date` | Yes |
| § 4.2 exactly three reads: `getCurrentMember`, `listMembers`, `listTeamEntriesOverlapping` | `src/routes/YearView.tsx:144`, `:158`, `:159` | Yes |
| § 4.2 no `getTeam()`, no write call, no fourth read | `grep` over `YearView.tsx` for `getTeam|createEntry|updateEntry|deleteEntry|approve|reject` matches comment lines `:11`, `:13`, `:24` only | Yes |
| § 4.2 `MONTH_ENTRY_LIMIT` reused, no new constant | no constant added; the throw is caught at `src/routes/YearView.tsx:162-167` | Yes |
| § 4.3 route `/year/:year` plus `/year` | `src/App.tsx:197-198` | Yes |
| § 4.3 malformed or absent anchor redirects to the current year | `src/routes/YearView.tsx:55`, `:133`, `:239` | Yes |
| § 4.3 header: home, previous, year label, next, month link | `src/routes/YearView.tsx:300`, `:306`, `:309`, `:312`, `:320` | Yes |
| § 4.3 row order `displayName` then `id`, collated `vi` | `src/routes/YearView.tsx:227-236` | Yes |
| § 4.3 every roster member gets a row, including removed | `src/routes/YearView.tsx:349`, `:358` — `rows` is the roster, never the entries | Yes |
| § 4.3 month ruler | `src/routes/YearView.tsx:281`, `:285-293`, `:336-346` | Yes |
| § 4.3 totals strip from `absenceCountsFor` | `src/routes/YearView.tsx:193-198`, `:426-443` | Yes |
| § 4.3 no React component per cell | `src/routes/YearView.tsx:372-419` — a cell is a `<div>` in a CSS grid, no component declared | Yes |
| § 4.3 nothing computed per cell | `src/routes/YearView.tsx:376-377` — `dayset.has(date)` and `marks.get(key)`, both precomputed | Yes |
| § 4.3 the maps built once in `useMemo` | `src/routes/YearView.tsx:183`, `:193`, `:207`, `:227` | Yes |
| § 4.3 horizontal scroll is the grid's, member column sticky | `src/routes/YearView.tsx:332` (`overflow-x-auto`), `:333` (`w-max`), `:335`, `:363`, `:427` (`sticky left-0`) | Yes |
| § 4.3 shared column template so ruler, rows and totals cannot drift | `src/routes/YearView.tsx:295`, used at `:334`, `:361`, `:426` | Yes |
| § 4.3 selector table, all sixteen ids | `src/routes/YearView.tsx:244`, `:256`, `:270`, `:300`, `:306`, `:309`, `:312`, `:320`, `:333`, `:339`, `:358`, `:364`, `:367`, `:382`, `:408`, `:433` | Yes |
| § 4.3 (AC-12) `month-year`, `week-year`, and the Home link | `src/routes/MonthView.tsx:334`, `src/routes/WeekView.tsx:284`, `src/routes/Home.tsx:142` | Yes |
| § 4.3 no overload colour, no threshold | no `getTeam` call; `tests/e2e/cal-06-year-view.spec.ts:389` asserts `month-threshold` has count 0 | Yes |

**The four declared deviations were each read against the contract and none changes one.**
`year-sign-in` (`src/routes/YearView.tsx:260`) and `home-year-link` (`src/routes/Home.tsx:142`) are
additions to the selector table, not substitutions — `year-sign-in` is how AC-13's *sent to sign in*
is expressed on a screen that refuses in place, the identical shape CAL-05 shipped at
`src/routes/WeekView.tsx:222`. `year-month-label`'s `data-month` and `year-row` as the cell container
are shapes § 4.3 implies. The `CellMark` tie-break rules at `src/routes/YearView.tsx:214-216` are
inside the space § 4.1 leaves to the component, and both choices are conservative: the type is
`absentEntriesFor`'s own fixed order rather than the datastore's, and tentative is true when any
entry filling the cell is tentative, which under-claims settledness rather than over-claiming it.
The thirty inline members at `tests/absence.test.ts:788-792` are a scale property of a pure function,
invent no threshold and time nothing.

**AC-13's third clause and AC-14 are implemented and not asserted end-to-end.** The failure state
exists at `src/routes/YearView.tsx:162-167` and `:270`; no test drives a throw, because neither seam
implementation can be made to truncate a read from a spec. R5 asks whether the contract item is
implemented, and it is. The gap is recorded, not charged — see *Note*.

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| **INV-04** — one definition of the absence count, no second definition anywhere | The screen renders two things derived from the same numbers and derives neither itself. Filled cells come from `absentDatesByMember`, which is one `walk` call; the totals come from `absenceCountsFor`, the same function the month cell's count comes from. The status test exists once in the product, inside `walk`. `grep` over `YearView.tsx` for `.filter(`, `status` and `portion` returns comment lines and `role="status"` only — the component never narrows `entries`, it only passes them. Asserted both ways: the unit test compares the filled set against `absentMembersFor` on **all 365 columns** and bounds each total by its filled count, and the e2e reads a date's count off the year strip and then off the month cell, which is the divergence invisible on either screen alone. | `src/lib/data/absence.ts:309-325`, `:319`, `:121-148` (the one `status` test at `:133`); `src/routes/YearView.tsx:183-198`, `:376-377`; `tests/absence.test.ts:741-748`, `:750-763`, `:766-773`; `tests/e2e/cal-06-year-view.spec.ts:260-296` |
| **INV-05** — a tentative entry counts exactly as a non-tentative one | `walk` reads `status` and never `tentative`, and the fourth derivation adds nothing to it, so a tentative entry fills its cells identically. The marking is decoration the component adds after filled-ness is decided: `mark` is read only for colour, `title` and the screen-reader span, never for `filled`. The unit test asserts the settled and the tentative answers are equal maps. | `src/lib/data/absence.ts:121-148` (no `tentative` read anywhere in the file), `:319`; `src/routes/YearView.tsx:376` (filled-ness) vs `:401`, `:407-411` (marking); `tests/absence.test.ts:663-676`; `tests/e2e/cal-06-year-view.spec.ts:240-258` |
| **INV-07** — one member, one team; counted only against that member's team | Every row and every entry comes from `listMembers()` and `listTeamEntriesOverlapping()`, both team-scoped reads shipped by TEA-03 and CAL-01; this ticket introduces no read of its own and no filter of its own. `walk`'s `countsOn` refuses an entry whose member is not in the roster, so a cross-team row could not fill a cell even if one arrived. Asserted against the fixture that exists for it: the other team's entry on 21-22 September leaves those columns empty and its member has no row, while the caller's own team's days are still drawn. | `src/routes/YearView.tsx:158-159`; `src/lib/data/absence.ts:106` (`countsOn`), `:126-129`; `tests/absence.test.ts:713-721`; `tests/e2e/cal-06-year-view.spec.ts:365-372` |

**INV-06 is not in `invariants_touched` and is not contradicted.** A year cell is one day wide and
carries no portion; `grep` confirms `entry.portion` is not read anywhere in `YearView.tsx`, so a
five-day `pm` entry fills five cells exactly as a `full` one does and the view cannot disagree with
the column shape CAL-01 shipped.

**INV-01, INV-02 and INV-03 are unreachable on this surface.** Nothing here writes: no write function
is imported, and the e2e asserts zero `button`, `input`, `select`, `textarea`, `form` and `a`
elements inside `year-grid` for an **admin** as well as for a member — the denial is held by absence,
which `01-plan.md` section 3 names the weakest mechanism in the plan, so it is checked rather than
assumed. `src/routes/YearView.tsx:44-48`, `tests/e2e/cal-06-year-view.spec.ts:379-387`.

## R6 detail

Plan section 3 says: no permission changes, no policy, no grant; every read already permitted; the
read-only denial held by absence; the route deliberately unguarded so the screen refuses in place.
All four are true. `src/App.tsx:197-198` wraps neither route in a guard, and the comment there gives
the same reason `/month` and `/week` already record. The refusal is
`src/routes/YearView.tsx:149-152` and `:256`, reached for a caller with no session and for one with
no member row alike, with the way out at `:260`. No branch anywhere in the file reads
`member.role` — the screen is identical for both roles, asserted at
`tests/e2e/cal-06-year-view.spec.ts:362-390`. No `.sql` file, no migration and no policy is in the
diff, matching `schema_delta: none`.

## Findings

None. No check failed, so no routing row applies.

## Note — not a finding, and outside R1-R8

`ticket.yaml`'s `gates.plan` was flipped to `passed: true` during IN_PROGRESS
(`.ai/board/tickets/CAL-06/ticket.yaml:92`), and `03-impl-log.md` § *Open questions* item 4 declares
it. The value it records is true — `01-plan.md`'s front-matter carries `gate: PASS` and the
timestamp written is that artifact's own `produced_at` — and the path is inside the ticket's own
folder, so R1 is unaffected. It is recorded here because **the stage that writes a gate row is the
`orchestrator`, not the Developer** (`.ai/01-operating-model.md:83`), and a stage filling in another
stage's gate is the shape worth a human's eye even when the fact behind it is correct. Five earlier
tickets patched their own gate keys by hand; check D14 now catches key-set drift but not
authorship. Whether that needs a guard is a `steward` question, not this gate's.

Two coverage gaps carried forward, neither a defect in this ticket: **AC-7, AC-8 and AC-14 are
asserted in `tests/absence.test.ts` or nowhere** — no control in the product can set `status` to
`rejected`, remove a member partway through a displayed year, or make a seam implementation truncate
a read. CAL-04 recorded this for its AC-11 and CAL-05 for its AC-10, AC-11 and AC-15; CAL-06 is the
third ticket running. It is a fixture-level question and it is now old enough to be decided.

## Verdict

**PASS.** All eight checks pass with citations. `next_state: DONE`.
