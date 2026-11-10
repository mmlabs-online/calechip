---
ticket: UIE-07
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-08T14:30:38+07:00
inputs_read:
  - .ai/board/tickets/UIE-07/01-plan.md
  - .ai/board/tickets/UIE-07/03-impl-log.md
  - .ai/board/tickets/UIE-07/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/templates/review-report.md
  - git diff (src/routes/WeekView.tsx, .ai/board/tickets/UIE-07/ticket.yaml)
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/lib/data/absence.ts
  - src/index.css
  - tests/e2e/uie-07-week-absence-count.spec.ts
  - package.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-07 — review report

**Isolated dispatch, RULE-13.** Fresh session, files only, no message channel. No Developer was
spoken to before this verdict and none will be.

**`next_state: DONE` and not the template's `QA`.** ADR-022 removed the QA stage; `QA` is not in the
state enum at `.ai/01-operating-model.md:70`, and `DONE` is what every 04-review.md written since
carries — `.ai/board/tickets/UIE-06/04-review.md:20`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/UIE-07/ticket.yaml:87-90` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`, `package.json:10`) exit 0 |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`, `package.json:11`) exit 0 |
| R4 | Nothing outside the seam reaches the datastore directly (RULE-02) | PASS | `src/routes/WeekView.tsx:146-150` |
| R5 | Every contract item in plan § 4 is implemented (RULE-04) | PASS | table below |
| R6 | Permission gating matches plan § 3 | PASS | `src/routes/WeekView.tsx:268,288-290` |
| R7 | No invariant violated — reasoned per ID (RULE-07) | PASS | table below |
| R8 | No dependency added without an ADR | PASS | `package.json:19-26,29-44` unmodified |

### R1 — the four working-tree paths against the three globs

`git status --porcelain` reports exactly five entries, and every one falls inside a glob at
`ticket.yaml:87-90`:

| Path | Glob it falls under |
|---|---|
| `.ai/board/tickets/UIE-07/ticket.yaml` (M) | `.ai/board/tickets/UIE-07/**` |
| `.ai/board/tickets/UIE-07/01-plan.md` (??) | `.ai/board/tickets/UIE-07/**` |
| `.ai/board/tickets/UIE-07/03-impl-log.md` (??) | `.ai/board/tickets/UIE-07/**` |
| `src/routes/WeekView.tsx` (M) | `src/routes/WeekView.tsx` |
| `tests/e2e/uie-07-week-absence-count.spec.ts` (??) | `tests/e2e/uie-07-week-absence-count.spec.ts` |

**Nothing outside the list was touched, and two files the plan deliberately excluded are provably
untouched**: `tests/e2e/cal-05-week-view.spec.ts` (01-plan.md § 7, § 8 alternative 1) and
`src/hooks/useRoster.ts` (§ 8 alternative 2) do not appear in `git status` at all. `src/index.css` is
likewise unopened, which is what makes the "no new token" claim at `01-plan.md` § 2b checkable rather
than asserted.

### R2, R3 — and the two runs beyond the gate

| Command | Exit |
|---|---|
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 |
| `pnpm test` (`vitest run`) | 0 — 193 passed, 11 files |
| `pnpm e2e` (`playwright test`) | 0 — 171 passed, including the 7 new |

The last two are outside R2 and R3 and were run anyway, because **AC-13 is a claim about other
tickets' spec files** and the only way to check it is to run them. They pass unedited —
`cal-05-week-view.spec.ts` among them, whose `:247-253` forbid `button`, `form`, `select`, `textarea`
and `a` inside a `week-day` and whose `:266` counts seven `week-day-empty`. The impl-log's verification
table (`03-impl-log.md` § *Verification run*) reproduces on this tree.

### R4 — the seam is not bypassed

`src/routes/WeekView.tsx:146` imports `seam` from `@/lib/data` and names no implementation; the file
contains no `./supabase`, no `./mock` and no `createClient`. The two names this ticket adds are
imported at `:150` from `@/lib/data/absence` — **inside** the seam directory, the same import
`MonthView.tsx` already makes for the same functions, and the identical shape `:150` already carried
for `absentEntriesFor` before this diff. No seam function changed signature, so `tests/seam-parity.test.ts`
is unedited and passes (`pnpm test`, above). RULE-02 is not engaged by this change and is not weakened
by it.

## R5 detail

One row per item in `01-plan.md` § 4. The plan merges story and design (ADR-019), so § 4 is the
contract and its § 4.3 carries the selector table.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — `absenceCountsFor(entries, range, roster): AbsenceCounts`, called not redefined | `src/lib/data/absence.ts:197-206`, called at `src/routes/WeekView.tsx:329` | yes — three arguments in the declared order, return type unchanged |
| § 4.1 — `currentMemberCount(roster): number` | `src/lib/data/absence.ts:348-349`, called at `src/routes/WeekView.tsx:337` | yes |
| § 4.1 — `AbsenceCounts` imported as a type, not restated | `src/routes/WeekView.tsx:155` | yes — `ReadonlyMap<string, number>` from `@/lib/domain/types` |
| § 4.2 — the `counts` memo beside `absent`, same phase guard, empty-Map fallback | `src/routes/WeekView.tsx:326-332` | yes — `view.phase === "ready" && range`, deps `[view, range]`, identical shape to `absent` at `:312-318` |
| § 4.2 — `activeMembers`, computed and never a literal | `src/routes/WeekView.tsx:337` | yes — `currentMemberCount(view.roster)` over the **unfiltered** roster, `0` off the ready phase |
| § 4.2 — the import widened by two names, no new import added | `src/routes/WeekView.tsx:150` | yes — one line, four names to six, and the import count in the file is unchanged |
| § 4.3 — `const count = counts.get(date) ?? 0` read beside `people` and `status` | `src/routes/WeekView.tsx:487` | yes |
| § 4.3 — `data-count` on the `week-day` section, borrowed from the month cell | `src/routes/WeekView.tsx:497`, against `src/routes/MonthView.tsx:474` | yes — same attribute name, and no out-of-range empty-string case, as the plan predicted |
| § 4.3 — the strip as the **last child** of the section | `src/routes/WeekView.tsx:806-813`, after the `week-day-empty`/`ul` branch closes at `:752` and before `</section>` at `:814` | yes |
| § 4.3 — `data-testid="week-day-count"`, `data-current-members`, the mirror className, the `sr-only` span, `{count}/{activeMembers}` | `src/routes/WeekView.tsx:807-812` | yes — character-for-character the plan's snippet |
| § 4.4 block 1 — CAL-05's *"IT COUNTS NOTHING"* rewritten **with the correction ADR-029 requires** | `src/routes/WeekView.tsx:11-34` | yes — see below |
| § 4.4 block 2 — UIE-04's *"STILL COUNTS NOTHING"*, chip-count refusal preserved | `src/routes/WeekView.tsx:67-79` | yes |
| § 4.4 block 3 — UIE-05's *"Nothing is pinned there today"* | `src/routes/WeekView.tsx:95-99` | yes — the below-the-fold cost is kept, not deleted |
| § 4.4 block 4 — *"a decision now taken FOUR times"*, and the coupling | `src/routes/WeekView.tsx:119-135` | yes — records which way § 8 alternative 1 went |

**§ 4.4 is the item most easily satisfied in letter and lost in substance, so it was read rather than
counted.** The plan's requirement is that block 1 *correct the two wrong reasons* rather than describe
the new footer. `src/routes/WeekView.tsx:17-22` states both corrections explicitly — a count never
needed a team read, because `getTeam()` supplies `overloadThreshold` and a bare `n/N` does not use it;
and INV-04 forbids a second definition, not a second screen. `:29-34` keeps the `.filter(...)`
warning and restates it as the guard rail on AC-5, which is what the plan asked for. Block 2 keeps
UIE-04's chip-count refusal intact at `:69-76` and retires only its conclusion at `:77-79`. Block 3
keeps the below-the-fold cost at `:97-99`, which is *Out of scope* item 12. Nothing that was true was
deleted.

**The new selector was verified free rather than assumed.** `grep -rn "week-day-count" src tests`
returns matches in `src/routes/WeekView.tsx` and the new spec only, so nothing shipped is renamed or
shadowed (AC-13).

**No contract item is missing and none was added.** The two deviations the impl-log declares —
comments on the `count` read and on `data-count` that the plan's snippet does not show
(`03-impl-log.md` § *Deviations*, items 1 and 2) — are commentary on lines the contract does specify,
not changes to them.

## R6 detail

`01-plan.md` § 3 says nothing changes: no read added, no read widened or narrowed, no control.

- **The three reads are the same three.** `src/routes/WeekView.tsx:288-290` — `seam.listMembers()`,
  `seam.listTeamEntriesOverlapping(range)`, `seam.listHolidays(...)` — appear unchanged in the diff,
  and `:268` `seam.getCurrentMember()` is untouched. **No fourth read was added.**
- **`seam.getTeam()` is not called.** The only occurrences of that string in the file are `:12`, `:26`
  and `:798`, all inside comments saying it is deliberately not called. Clause 3 of ADR-029 holds.
- **No role branch was introduced.** The diff contains no `role`, no `isAdmin` and no conditional on
  the caller; both roles read the same number, which § 3 requires.
- **No control was added.** The strip is a `<p>` holding a `<span>` (`:806-813`) — none of the five
  elements CAL-05 AC-8's absence mechanism forbids inside a `week-day`, and the new spec re-asserts all
  five plus `a` at `tests/e2e/uie-07-week-absence-count.spec.ts:285-291` rather than inferring it from
  a file this ticket never opened.

## R7 detail

**One row per ID in `invariants_touched` (`ticket.yaml:34`), each reasoned individually.** An
invariant held only by a UI affordance is not held; both below are held by a function inside the data
seam, and the UI's role is only to display it unmodified.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | `absenceCountsFor`, called and not reimplemented. The screen adds **no** second definition: `src/routes/WeekView.tsx` contains no `.reduce`, no `.filter` over `entries`, and no arithmetic over the `absent` map — the one cheapest wrong path, in scope three lines away. The denominator is `currentMemberCount`, not a hand-rolled `removedAt === null` filter and not a literal. | Definition: `src/lib/data/absence.ts:197-206`. Call: `src/routes/WeekView.tsx:329`. Denominator: `src/lib/data/absence.ts:348-349`, called at `src/routes/WeekView.tsx:337`. Rendered proof: `tests/e2e/uie-07-week-absence-count.spec.ts:210-212` |
| INV-06 — one portion per entry, applying to every date in its range | Nothing rounds anywhere on the path. `{count}` is interpolated as React receives it — no `Math.round`, no `toFixed`, no integer format — so a half day renders `0.5` directly beneath a `week-row-portion` pill reading *Morning* rather than contradicting it. | `src/routes/WeekView.tsx:812`; asserted together on one column at `tests/e2e/uie-07-week-absence-count.spec.ts:185-191` |

**INV-04, the sub-check that actually decides it.** The invariant's own note says *"the absence count
for a date is no longer a function of that date's entries alone"* and that the computing function
must be **given** the roster (`.ai/registry/invariants.md:119-121`). `src/routes/WeekView.tsx:337`
passes `view.roster` — the **unfiltered** roster `seam.listMembers()` returns — to both functions, so
ADR-013's date-sensitive membership rule is evaluated inside `absence.ts` and not approximated here.
A pre-filtered roster would have made INV-04 uncomputable for past dates, which is the failure the
seam's docstring at `src/lib/data/absence.ts:185-187` names.

**The one case that separates reuse from a second definition was checked on the running screen, not
on the source.** One member's `am` and `pm` on a single date renders **two rows over `1`**
(`tests/e2e/uie-07-week-absence-count.spec.ts:210-212`, passing). The chip count would have read `2`
and a local sum over `absent` would have read `1.5`; INV-01 is what makes it `1`
(`src/lib/data/absence.ts:194-195`). This is the assertion the whole ticket rests on and it is green.

**AC-2 is what makes the uniqueness claim visible rather than argued.** The week and the month are
compared on a date whose count is not whole, through the attribute the week borrowed from the month
(`tests/e2e/uie-07-week-absence-count.spec.ts:220-236`, passing). Two screens, one function, one
number.

**INV-05 was excluded at PLAN, and the exclusion was verified rather than accepted.** `absenceCountsFor`
reaches its sum through `walk(...)` and never consults `entry.tentative`
(the docstring rule at `src/lib/data/absence.ts:191`, and the function itself at `:197-206`), so a tentative entry is counted
exactly as a non-tentative one and **the only way to exclude one is the local sum AC-5 forbids** —
which the file does not contain. The invariant has no display-only failure mode of INV-06's kind here.
Its absence from `invariants_touched` is a decision recorded at `ticket.yaml:57-59` and it stands.

**INV-01, INV-02, INV-03 and INV-07 are properties of stored entries and their members.** This ticket
writes nothing, adds no read and adds no comparison; the diff contains no write path at all.

**AC-9 is asserted by no test, and that is declared rather than skipped** (`03-impl-log.md` § *Open
questions* item 2, and the spec file's own header at
`tests/e2e/uie-07-week-absence-count.spec.ts:18-23`). It is held by the shape of the code: the strip
divides nothing (`src/routes/WeekView.tsx:812`), so there is no `NaN` branch to reach, and
`isOverloaded` — the one place that does divide — guards `currentMembers <= 0` before it
(`src/lib/data/absence.ts:343`) and is not called from this screen. **This does not fail R7**: no
invariant is at stake in `n/0`, INV-04 is silent on the denominator's display, and an untestable
criterion declared with its reason is the shape CAL-05 AC-10, AC-11 and AC-15 already carry.

## R8 detail

**No dependency was added, removed or moved.** `package.json` and `pnpm-lock.yaml` are absent from
`git status --porcelain` entirely, so the eight `dependencies` (`package.json:19-26`) and the sixteen
`devDependencies` (`:29-44`) are byte-identical to `origin/main`. Nothing was vendored either: the
diff adds two names to one existing import line (`src/routes/WeekView.tsx:150`) and the new spec file
imports only `@playwright/test`, already a devDependency at `:30`. No ADR is owed.

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | none | — | — |

`rework_count` stays `0` (`ticket.yaml:94`).

## Verdict

**`PASS`.** All eight checks pass with a citation, and R5 and R7 are cited per item and per invariant
rather than in summary.

The two things this ticket could most cheaply have got wrong were both checked on the running screen
rather than argued from the source: a local sum over the `absent` map already in scope (INV-04's
forbidden second definition, refuted at `tests/e2e/uie-07-week-absence-count.spec.ts:210-212`) and a
rounding chosen for tidiness on a dense grid (INV-06, refuted at `:185-191`). Neither is present.

**Nothing outside R1-R8 was folded into this verdict.** The strip's colour token and its spacing are
`01-plan.md` § 2b decisions implemented verbatim, and the R checklist carries no design-system item —
a comment about them is not part of this gate.
