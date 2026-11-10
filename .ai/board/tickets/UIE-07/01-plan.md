---
ticket: UIE-07
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-08T11:54:35+07:00
inputs_read:
  - .ai/board/tickets/UIE-07/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/MemberList.tsx
  - src/lib/data/absence.ts
  - src/lib/domain/types.ts
  - src/hooks/useRoster.ts
  - src/components/Sidebar.tsx
  - src/index.css
  - src/lib/fixtures.ts
  - tests/e2e/cal-05-week-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - tests/absence.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-07 — the week view renders a per-day absence count

## 1. Problem and scope

The feature ID this plan implements, transcribed from `.ai/registry/features.md` without paraphrase:

| ID | Capability | Group | Status | Invariants touched |
|---|---|---|---|---|
| UIE-07 | The week view renders a per-day absence count | UIE | PLANNED | [INV-04] |

**Nobody gains a capability and nothing new is read.** Every member already sees, on the month grid,
the number of people away on a date; on the week view — the screen that lists *who* — that number has
been absent through three shipped tickets, so a member reading a column counts chips and gets a
different answer from the one the month gives for the same date. A day with one full-day entry and
two half-day entries is three chips and an absence count of two. This ticket renders the count itself,
under each of the seven columns, as `n/N`, from the one function that defines it.

**It is obliged by a decision already taken, not by a judgement made here.** ADR-029 is `ACCEPTED by
orchestrator`, 2026-09-08, and its § *Consequences* says in its own words that the decision creates no
ticket and that the idea re-triages into a `UIE` row *"carrying the four clauses above as the
substance of its criteria"*. `requires_adr: false` follows from that rather than from optimism: the
three artifacts that refused this number — CAL-05's registry row, CAL-05's `01-plan.md:95-97`, and
UIE-04's shipped AC-13 — are the envelope ADR-029 opened. This plan builds inside the four clauses.
**Had it needed anything outside them — the overload state, a team read, or an amendment to INV-04 —
the verdict would be `BLOCKED` with `requires_adr: true`.** It did not.

**`size_estimate: S`.** One route file and one new spec file. No new module, no new state, no new seam
call, no new token, and no new arithmetic anywhere.

### Out of scope

1. **The overload state, the threshold, and any `seam.getTeam()` call.** Clause 3. ADR-029 rejected
   bringing them as its own option 4, because they drag in the sidebar's fourth legend row and
   deserve their own terms rather than arriving as a side effect of a footer strip. **UIE-04's AC-13
   keeps its second clause intact and only its first is superseded**, which is the amendment already
   recorded on that row.
2. **The sidebar's `Quá tải (>50%)` legend row.** Same reason, and strictly the more expensive of the
   two, because it genuinely does need the team read. UIE-02 already deferred it.
3. **The month and year views.** ADR-031 is `REJECTED`, so `month-cell-count` stays exactly where it
   is (`src/routes/MonthView.tsx:523-527`) and this ticket must not touch it. That the two screens
   agree is the whole argument for the strip, and the agreement stays *visible* precisely because
   ADR-031 was declined.
4. **Amending INV-04, or editing `.ai/registry/invariants.md` at all.** ADR-029:133-134 says INV-04 is
   *satisfied* by this decision rather than amended and that the ledger is not edited. § 2 states the
   mechanism.
5. **Re-amending CAL-05's or UIE-04's registry rows.** Both landed with the ADR's acceptance and were
   verified on disk at triage. A second amendment is a second thing to keep true.
6. **Vietnamese copy anywhere on this screen, including the transcription's `vắng`.** Clause 4 and
   `.ai/standards/ui-design-system.md` § *Language*, the operator's instruction of 2026-09-03, lint
   enforced at `eslint.config.js:84-92`.
7. **Any of the five chip facts UIE-05 refused to delete, and any shell edit.** Settled on other
   tickets; a footer reopens neither.
8. **BUG-002's row limits.** Different files, and it is upstream of the arithmetic. **Honest residue,
   recorded rather than glossed:** BUG-002 is now `DONE` and merged (PR #76), so the truncated-read
   exposure CAL-05 AC-15 records is repaired ahead of this work rather than inherited by it. Either
   way this ticket must not touch a limit constant.
9. **Deleting `"Everybody is in."`** — the open decision ADR-029 hands to this ticket. **It stays.**
   § 8 alternative 1 carries the argument, so `tests/e2e/cal-05-week-view.spec.ts` does not enter
   `allowed_paths` and CAL-05 AC-13 and UIE-04 AC-10 are not reversed.
10. **Consolidating the roster filter that `src/hooks/useRoster.ts:56` hand-rolls.** Named here rather
    than passed over in silence, because `ticket.yaml` § 13.3 recommends taking it and this plan
    declines. **The recommendation's stated shape is not available**, and § 8 alternative 2 gives the
    measurement: `currentMemberCount` returns a `number`, the filter's product is the `Member[]` the
    sidebar renders as a list, and the duplication is three copies rather than two. It wants its own
    ticket.
11. **Explaining the arithmetic on the screen.** ADR-029 accepted CAL-05's objection — three chips
    over `1.5/N` — *"rather than answering"* it, and its secondary revert condition retires the strip
    on the first real report instead of spending a row on an explanation. This plan must not
    pre-emptively spend that row.
12. **Pinning the strip to the viewport.** It pins to the column, so on a busy week it goes below the
    fold with the rest of that column. Accepted by ADR-029; a viewport-pinned strip is a different
    feature and is not proposed.
13. **The four other items this board owes**, none of them this: the `§ Colour` and `§ Type` stubs in
    `.ai/standards/ui-design-system.md` plus UIE-04's `1280px` breakpoint; the product showing two
    names; the `PLAN -> READY` transition `.ai/01-operating-model.md:285` declares and no command
    runs; and the false three-clause comment at `src/components/Sidebar.tsx:63-64` that UIE-06 left
    standing.

## 2. Acceptance criteria

**AC-1 — every day column carries the absence count for its own date**
- Given a week the caller can read
- When the seven day columns render
- Then each one carries exactly one count element, and the number in it is the absence count for that
  column's own date

**AC-2 — the number is the one the month grid shows for the same date**
- Given the same date rendered on the week view and on the month grid
- When both screens are read
- Then the two numbers are equal, for every date, including dates where they are not whole

**AC-3 — a half day is a half**
- Given one member with a single half-day entry on a date, and nothing else on that date
- When the week view renders that date's column
- Then the column shows **one** entry row and the count reads `0.5`, not `0` and not `1`

**AC-4 — one member's morning and afternoon on one date is one whole day**
- Given one member holding both an `am` and a `pm` entry on the same date, and nothing else on that
  date
- When the week view renders that date's column
- Then the column shows **two** entry rows and the count reads `1`, not `2` and not `1.5`

**AC-5 — the count is never derived from what is on the screen**
- Given any date whose entry-row count differs from its absence count
- When the column renders
- Then the number shown is the absence count and not the number of rows, the number of people, or any
  other figure computed on that screen

**AC-6 — the denominator is the team's current member count, and it is computed**
- Given the roster the screen already read
- When any day column renders
- Then the denominator is the number of members whose `removedAt` is null, and it is the same number
  on all seven columns, and it is not a literal

**AC-7 — the strip renders on every day, including a day with nobody away**
- Given a week in which nobody is away on any day
- When the seven columns render
- Then all seven still carry their count element and each reads `0/N`

**AC-8 — two numbers and a slash, and never a percentage**
- Given any day column
- When its count element is read
- Then it shows the absence count, a slash, and the current member count, in that order, with no
  percentage, no division, and no rounding of either number

**AC-9 — a team with no current members still renders**
- Given a roster in which every member carries a `removedAt`
- When a day column renders
- Then the element reads `n/0` and the screen neither divides, nor omits the strip, nor shows `NaN`

**AC-10 — the visible strip names nothing, and the accessible reading names it**
- Given a day column's count element
- When its visible text is read
- Then it contains no noun and no word in any language — only the two numbers and the slash
- And when its accessible text is read, it is named with the glossary's own English term for the
  number

**AC-11 — the strip is not the overload state**
- Given any day column, including one on which most of the team is away
- When it renders
- Then it carries no threshold, no overload colour and no overload attribute, and the screen makes no
  team read

**AC-12 — the screen is still read-only**
- Given a day column carrying the new strip, for either role
- When the column is read
- Then it contains no `button`, `form`, `select`, `textarea` or `a`

**AC-13 — nothing shipped is renamed or removed**
- Given the week view after this change
- When the existing selectors are read
- Then `week-day`, `week-day-label`, `week-day-empty`, `week-day-holiday`, `week-day-bridge`,
  `week-row` and every `week-row-*` element keep their names, their attributes and their content, all
  seven `week-day-empty` elements still render on an empty week, and every existing spec file passes
  unedited

**Invariants touched: `[INV-04, INV-06]`.** The mechanism, per invariant, rather than the conclusion —
`.ai/registry/invariants.md:63` warns that observing the safest behaviour and concluding no invariant
is engaged is circular.

**INV-04** — *the absence count for a date is the sum, over that date's pending and approved entries
whose member was still on the team on that date, of 1 per `full` portion and 0.5 per `am` or `pm`,
with PTO and WFH counted alike. Rejected entries are excluded. No second definition of this number
exists anywhere in the system.* **Engaged, and it is the whole content of the ticket.** ADR-029 says
the invariant is *satisfied* by this decision rather than amended, and *satisfied* is not *unengaged*:
this ticket puts that number on a second screen, so the only thing standing between the permitted
number and a forbidden second definition is that AC-5 is a criterion rather than a comment. The
cheapest wrong path is no longer the chip count — clause 1 and UIE-04 closed that — it is a local sum
over the `absent` map, which is already in scope three lines from where the strip renders, needs no
new data, reads as reuse, and would pass every existing test. AC-3 and AC-4 are the two assertions
that catch it.

**INV-06** — *an entry carries exactly one portion, and that portion applies to every date in its
range.* **Engaged as a display, and it is the one most likely to be missed.** A half day weighs 0.5,
so the number is a decimal on some days, and the strip renders directly beneath a column whose entry
chips carry `week-row-portion` — INV-06's only visible surface in the product (UIE-05). A strip
showing `1` where the pill beside it says *Morning* makes the screen contradict itself about the
invariant on the one screen that shows it. **The mechanism is AC-8's "no rounding":** the risk is not
a second definition, it is a display decision — `Math.round`, `toFixed(0)`, or an integer format
chosen for tidiness on a dense grid — taken entirely inside clause 1, where the count is still
INV-04's and the screen still lies about the half day. That is a failure mode this ticket creates and
no other surface has.

**INV-05 considered and deliberately not listed, which is a decision and not an omission.** *A
tentative entry counts toward the absence count exactly as a non-tentative one does.* It is an input
to the same sum, and the strip could visibly contradict it — a column showing a `week-row-tentative`
chip over a count that excluded it would be the first place in the product where that contradiction is
on screen. It is not listed because **the contradiction is unreachable without first breaking INV-04**:
`absenceCountsFor` never consults `tentative` (`src/lib/data/absence.ts:194-195` and its docstring),
so the only way to exclude a tentative entry is the local sum AC-5 forbids. INV-05 has no display-only
failure mode of INV-06's kind, and listing an invariant that is held entirely by another invariant's
mechanism is the over-declaration that makes the field stop meaning anything.

INV-01, INV-02, INV-03 and INV-07 are properties of stored entries and their members. This ticket
writes nothing, reads nothing new, and adds no comparison.

**Open questions.** None that block. Two decisions this ticket was handed rather than asked are taken
in § 8 — `"Everybody is in."` stays (alternative 1), and the `useRoster` denominator consolidation is
declined and named in *Out of scope* item 10 (alternative 2). Both are decided here rather than
deferred, because `ticket.yaml` § 13.3 is right that not answering is the one indefensible option.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**There is no `design/` directory on this ticket and there is not to be one.** The operator's image
was attached at exactly one stage and that stage has happened — `.ai/standards/ui-design-system.md`
§ *Visual specification*, *Never both stages*. It is transcribed by hand at
`.ai/board/tickets/UIE-05/design/README.md` § *The footer strip*, and that transcription is **evidence
of intent and not a specification**: it settles that a strip goes under each column, and it settles
nothing about the number. It shows two full-day chips and five empty days, so **the one case that
decides this ticket — what the strip reads on a day holding a half-day entry — does not appear in
it**, and its `n/8 vắng` is wrong twice over, on clause 2 (the denominator is computed, and the
fixtures give 4) and on clause 4 (the word and the language).

**So the arrangement below is originated here, and saying so is what makes it cheap to argue with.**

```
┌─ week-day ─────────────────────┐
│ ┌ week-day-label ────────────┐ │   header strip, shipped, untouched
│ │        Wednesday           │ │
│ │          16/09             │ │
│ │      [holiday] [Bridge]    │ │
│ └────────────────────────────┘ │
│                                │
│  week-day-empty                │   one or the other, shipped, untouched
│    OR  ul of week-row          │
│                                │
│           (grows)              │   mt-auto eats the slack
│                                │
│ ┌ week-day-count ────────────┐ │   NEW — the footer strip
│ │           0.5/4            │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

Four decisions the prose would otherwise drop, each an AC above:

- **It is the mirror of the header strip and nothing new.** Same full-bleed negative margin, same
  hairline, same centred small type, same corner — `border-t` and `rounded-b-2xl` where the header has
  `border-b` and `rounded-t-2xl` (`src/routes/WeekView.tsx:464`). No new token: `--color-line` is at
  `src/index.css:104` and `--color-ink-3` at `:109`.
- **At rest, always, and identical after any interaction.** There is no interaction on this screen.
  AC-7 makes it render at `0/N` too, which the month's own precedent would not have — `month-cell-count`
  renders only when `count > 0` (`src/routes/MonthView.tsx:523`), and a developer following it would
  make the strip vanish on all seven columns of an empty week.
- **The empty state keeps both.** On a quiet week a column reads *label / "Everybody is in." / a large
  gap / `0/4`*. That is the honest cost of § 8 alternative 1 and it is what the operator will see.
- **No pink, and no colour that carries a state.** The transcription puts `vắng` in soft pink; pink is
  `--color-overload` (`src/index.css:174`), UIE-06 already refused painting it on a working day for
  giving one colour two meanings on one grid (`src/routes/MonthView.tsx:537-540`), and clause 3
  forbids anything overload-shaped here independently. Two reasons, either sufficient.

## 3. Permission model

**Nothing changes. No read is added, no read becomes wider or narrower, and no control appears.**

| Action | Who | Where the check lives | Changed here |
|---|---|---|---|
| Read the team's entries overlapping the week | member and admin alike | `entry_select_team`, a row-level select policy (ADR-005) | no |
| Read the roster | member and admin alike | `member_select_team`, which admits both roles and scopes rows to the caller's own team inside the policy body | no |
| Read the team's overload threshold | — | `seam.getTeam()` | **not called, and clause 3 forbids it** |

**The denials, and where each is held.** No role may approve, reject, edit or delete from this screen,
and the mechanism is **absence** — `01-plan.md` § 3 of CAL-05 named that the weakest mechanism in its
plan, and `tests/e2e/cal-05-week-view.spec.ts:247-253` is where the absence is checked rather than
assumed. **The strip must not weaken it**: a `<p>` holding two `<span>`s is none of the five elements
those seven assertions forbid, so CAL-05 AC-8 survives untouched and that spec file stays out of
`allowed_paths`. AC-12 restates the property for this ticket so a reviewer does not have to infer it
from a file this ticket never opens.

**The screen branches on neither role, before or after this change.** Both roles see the same number,
because both may already read every row it is computed from.

## 4. Contract

**No seam function, no module export and no type changes.** Two functions already exported from
INV-04's module are called from a file that already imports that module. What follows is
copy-pasteable and every name in it exists on disk today.

### 4.1 The two calls, and why neither is new

```ts
// src/lib/data/absence.ts, both already exported, both pure, neither takes a team or a threshold.
export function absenceCountsFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): AbsenceCounts;                                            // :197-206

export const currentMemberCount: (roster: readonly Member[]) => number;   // :348-349

// src/lib/domain/types.ts:360
export type AbsenceCounts = ReadonlyMap<string, number>;
```

`AbsenceCounts` is **total over its range** — `zeroed(range)` fills every date before the walk
(`absence.ts:173`) — so `counts.get(date)` is defined for every drawn day and the fallback below
exists only for the `loading` and `unavailable` phases.

### 4.2 The two derivations added to `src/routes/WeekView.tsx`

Placed beside `absent` (`:277-284`), which already calls the sibling derivation over the exact same
three arguments. The import at `:115` is widened by two names and no new import is added.

```ts
import { absenceCountsFor, absentEntriesFor, addDays, currentMemberCount, eachDateInRange } from "@/lib/data/absence";

// AC-1, AC-2, AC-5. INV-04's count, from the same module, the same three arguments and the same pass
// shape as `absent`. NOTHING IN THIS FILE SUMS, FILTERS OR NARROWS `entries`.
const counts = useMemo<AbsenceCounts>(
  () =>
    view.phase === "ready" && range
      ? absenceCountsFor(view.entries, range, view.roster)
      : new Map<string, number>(),
  [view, range],
);

// AC-6, AC-9. The denominator, from INV-04's module and never a literal and never a local filter.
// The roster is the UNFILTERED one `seam.listMembers()` returns (ADR-013), which is the shape both
// functions require and the same shape MonthView.tsx:213 feeds them.
const activeMembers = view.phase === "ready" ? currentMemberCount(view.roster) : 0;
```

### 4.3 The strip, inside the `dates.map` at `:425`

`count` is read beside `people` (`:426`) and `status` (`:429`):

```tsx
const count = counts.get(date) ?? 0;
```

`data-count` joins the existing attributes on the `week-day` section (`:433-441`), **borrowed verbatim
from `MonthView.tsx:474`** so the two screens' attributes agree by name rather than by luck. Every day
of the week is in range, so there is no out-of-range empty-string case as the month has:

```tsx
data-count={count}
```

And the strip itself, as the **last child of the section**, after the `week-day-empty` / `week-row`
branch closes at `:690`:

```tsx
{/* UIE-07 AC-1, AC-7, AC-8, AC-10, AC-11. THE MIRROR OF THE HEADER STRIP at :464 — same full-bleed
    negative margin, same hairline token, same centred small type, `border-t` and `rounded-b-2xl`
    where the header has `border-b` and `rounded-t-2xl`. No token is added: `--color-line` and
    `--color-ink-3` both already exist (src/index.css:104, :109).

    `mt-auto` IS THE PIN AND IT NEEDS NO WRAPPER. UIE-05 shipped `xl:grid xl:min-h-full` at :424 with
    each day a `flex min-w-0 flex-col` section at :454, so grid items stretch and the auto margin eats
    the slack — the strip sits on the column's bottom edge whatever the tallest day is. Below `xl` the
    stack is content-height and `mt-auto` is inert, which is the correct behaviour there.

    IT RENDERS ALWAYS, INCLUDING `0/N`, and that is a decision rather than the month's default:
    `month-cell-count` renders only when `count > 0` (MonthView.tsx:523), and following that here
    would make the strip vanish on all seven columns of an empty week (AC-7).

    NO NOUN IS VISIBLE (AC-10). Clause 4 forbids "away", and its other half — the glossary's own name
    — carries the same claim about a member working from home that the clause exists to prevent
    (glossary.md:34, "Absence count", *số người vắng*). So the visible strip is two numbers and a
    slash, which also spends the least density on the screen CLAUDE.md § Visual direction is written
    about, and the glossary's exact English term is in the ACCESSIBLE reading only.

    TWO NUMBERS AND A SLASH, NEVER A PERCENTAGE, AND NO SPECIAL CASE AT `N = 0` (AC-8, AC-9). Under
    ADR-013 the numerator is DATE-SENSITIVE (absence.ts:192) while the denominator is READ-TIME
    (:333-336, a consequence INV-04 records as accepted), so on a past week after a removal `n` can
    exceed `N`, and `N` can be 0 while `n` is not. THIS IS THE FIRST SURFACE THAT JUXTAPOSES THEM.
    Nothing here divides, so it is a display oddity and not a defect — and dividing is exactly where
    an oddity becomes a NaN on screen, which is why `isOverloaded` guards `currentMembers <= 0`
    before it (absence.ts:343) and why this element does not need to.

    NO ROUNDING, AND THAT IS INV-06 (AC-3, AC-8). A half day weighs 0.5, so `{count}` renders `0.5`
    and `1` — never `1.0`, never `Math.round(count)`, never `toFixed`. The chip three lines above
    carries `week-row-portion`, INV-06's only visible surface in the product (UIE-05), and a strip
    reading `1` beside a pill reading `Morning` makes the screen contradict itself. */}
<p
  data-testid="week-day-count"
  data-current-members={activeMembers}
  className="-mx-4 -mb-4 mt-auto rounded-b-2xl border-t border-line px-4 py-2 text-center text-sm text-ink-3"
>
  <span className="sr-only">Absence count: </span>
  {count}/{activeMembers}
</p>
```

**`data-current-members` is borrowed verbatim from `MonthView.tsx:399`**, where it sits on
`month-threshold` and is already read by `tests/e2e/cal-04-month-view.spec.ts:226` and
`cal-07-overload-warning.spec.ts:202`. **`week-day-count` was verified free** — zero occurrences
anywhere in `src/` or `tests/` — and it matches the shipped `week-day-*` family while mirroring
`month-cell-count` slot for slot. **Nothing existing is renamed** (AC-13).

**`sr-only` is a shipped Tailwind utility already used at `src/routes/YearView.tsx:457`**, and an
`aria-label` on a `<p>` is deliberately not used: the sr-only span adds the name to the reading order
without overriding the numbers, so the accessible reading is *"Absence count: 0.5/4"* and the visible
one is `0.5/4`. Both are English (§ *Language*).

### 4.4 The four stale comment blocks — rewritten, and the requirement on the replacement

**ADR-029 § *Consequences* assigns `src/routes/WeekView.tsx:11-17` to this ticket. There are four, and
rewriting one while leaving three inherits the wrong reason in the other three**, which is the exact
failure the rewrite exists to prevent. All four are in the one file `allowed_paths` already names, so
no path is added.

| Block | What it says today | What must change |
|---|---|---|
| `:11-17` (CAL-05) | *"**IT COUNTS NOTHING.**"*, and `seam.getTeam()` *"would be the first step toward the number"* | **Both of its first two reasons are false and the replacement must say so.** A count never needed a team read — `getTeam()` supplies `overloadThreshold`, which a bare `n/N` does not use, and the denominator comes from the roster the screen already reads. And INV-04 was never the obstacle: CAL-05's own plan says so at `01-plan.md:528-531`. **A replacement that merely describes the new footer satisfies the letter and loses the whole point** — ADR-029 requires the correction that *"a count never needed a team read"*, or the next reader inherits the same wrong reason in new words |
| `:50-57` (UIE-04) | *"IT STILL COUNTS NOTHING, AND AFTER THIS TICKET THAT IS A DECISION TAKEN THREE TIMES"*, and *"there is no footer strip either: a column ends where its content ends"* | Both sentences are now false. **Its refusal of the chip count is still correct and must survive**, because it is the argument AC-5 rests on |
| `:73-75` (UIE-05) | *"Nothing is pinned there today"* | False the moment the strip lands. **The rest of that paragraph stays true and is not deleted** — anything pinned to the bottom of a column goes below the fold on a busy week, which is *Out of scope* item 12 |
| `:95-100` (UIE-05) | *"a decision now taken FOUR times"*, and *"ADR-029 is PROPOSED and awaiting the operator"* | False since 2026-09-08. The coupling it records — that the sentence and the count are decided together — is **resolved by § 8 alternative 1 and the replacement says which way** |

**What survives every one of the four rewrites**, because these three reasons are still true and clause
3 preserves them: this screen computes no overload state, reads no threshold, and does not call
`seam.getTeam()`. And `:14-17`'s warning against a local `.filter(...)` written in this file becomes
**more** important rather than less — it is now the guard rail on AC-5 rather than the reason for a
refusal.

**These four are contract items and deliberately not acceptance criteria.** A comment cannot be
observed from outside the system by a reader who cannot ask a question, which is what § 2 requires of
every AC. Review check R5 reads this section, which is where they are held.

## 5. Seam impact

**None.** No function in `src/lib/data/` is added, removed, renamed or changed in signature or return
type, and neither implementation file is opened. `tests/seam-parity.test.ts` passes unedited.

`absenceCountsFor` and `currentMemberCount` are imported **directly from `@/lib/data/absence`, not
through the seam** — the same import `MonthView.tsx` makes and the one `WeekView.tsx:115` already
makes for `absentEntriesFor`. That is deliberate and predates this ticket: neither seam implementation
counts or derives anything, so there is no second answer for the parity test to miss. RULE-02 is not
engaged — the seam is `src/lib/data/`, this file imports from inside it through `@/lib/data`, and it
names no implementation.

**No new read.** The three reads at `:252-256` are unchanged, and clause 3 forbids the only fourth
that was ever in question.

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint and no column; nothing under `supabase/` is
opened. **ADR-014 is not engaged, because there is no migration of any kind** — not because a
policy-only one would have been `none`.

`requires_adr: false`, and § 1 records that it is a fact rather than a first reading: ADR-029 carries
the decision this ticket would otherwise have had to stop for.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-07/**"
  - "src/routes/WeekView.tsx"
  - "tests/e2e/uie-07-week-absence-count.spec.ts"
```

**Two files outside the ticket folder. `size: S`** — `.ai/01-operating-model.md:372` puts S at up to
six. **`size_estimate` and `size` agree at S**, so ADR-012 never engages and there is nothing to
report under it.

**`tests/e2e/cal-05-week-view.spec.ts` is deliberately absent.** It enters this list if and only if
`"Everybody is in."` is deleted, and § 8 alternative 1 declines that. Its `:247-253` forbid `button`,
`form`, `select`, `textarea` and `a` inside a `week-day`, and a `<p>`/`<span>` strip is none of the
five, so CAL-05 AC-8's absence mechanism survives untouched and `:266`'s count of seven
`week-day-empty` elements is unaffected.

**`src/hooks/useRoster.ts` is deliberately absent**, against `ticket.yaml` § 13.3's recommendation.
§ 8 alternative 2 and *Out of scope* item 10.

**`src/index.css` is not opened.** `--color-line` (`:104`) and `--color-ink-3` (`:109`) already exist,
so the strip adds no token and UIE-06's collision note at `:117-123` is not reopened.

**The new spec file, and the two assertions that carry the ticket.** Both are reachable today through
the shipped `declare()` helper at `tests/e2e/cal-05-week-view.spec.ts:97-120`, which creates an entry
through CAL-01's form and returns to the week, all client-side, so neither needs a fixture change:

1. **A half-day entry renders one `week-row` over `0.5/4`** (AC-3). This is the case the operator's
   image cannot show and the one CAL-05's objection is about.
2. **One member's `am` and `pm` on one date render two `week-row`s over `1/4`** (AC-4). **This is the
   direct rendered refutation of both wrong paths** — the chip count would read `2` and a local sum
   over `absent` would read `1.5`. INV-01 is what makes it `1` (`src/lib/data/absence.ts:194-195`),
   and `tests/absence.test.ts:151-157` already fixes that arithmetic at the unit level. What this
   adds is that the **screen** shows what the module says, which is the only thing a unit test cannot
   reach.

## 8. Rejected alternatives

**1. Delete `"Everybody is in."`, which ADR-029 authorises this ticket to consider.** Genuinely
plausible, and it follows from the decision: a footer reading `0/4` removes the ambiguity
`week-day-empty` exists to remove, so *an ordinary Tuesday* and *we did not look* stop being the same
column even with the sentence gone. **Rejected, and the argument that decides it is geometry rather
than test cost.** The sentence renders only when `people.length === 0` (`src/routes/WeekView.tsx:515`)
and the strip pins to the bottom of a column UIE-05 made at least a viewport tall (`:424`), so **the
two are only ever co-visible on a column with nothing else in it** — the redundancy costs a row exactly
where there is spare room, and costs nothing on the crowded columns `CLAUDE.md` § *Visual direction* is
written about. The density argument does not survive being located on the screen. The costs it avoids
are real but secondary: deleting the element would drag a `DONE` ticket's spec into `allowed_paths` in
order to **weaken** an assertion (`tests/e2e/cal-05-week-view.spec.ts:266`, `toHaveCount(7)` → `0`, the
only reference to that selector outside `WeekView.tsx`) and would reverse two shipped criteria, CAL-05
AC-13 and UIE-04 AC-10, which is a RULE-01 amendment on two feature rows. **The middle path — keeping
the element and emptying it so the count of seven survives — is refused for UIE-05's own recorded
reason**: *"an empty third row is a line of padding that claims a fact exists"* (`WeekView.tsx:535-537`).
An empty `week-day-empty` passes `:266` while saying nothing, which is a green test standing over a
deleted fact.

**2. Consolidate the denominator by replacing `src/hooks/useRoster.ts:56`'s hand-rolled filter with
`currentMemberCount`.** `ticket.yaml` § 13.3 recommends taking it, and the motivation is real and
sharp: the sidebar prints `Team (4)` from that filter (`src/components/Sidebar.tsx:167-171`), about
200px from where `n/4` will now render, while `currentMemberCount`'s own docstring at
`src/lib/data/absence.ts:347` reads *"INV-04's denominator, in one place"*. **Rejected, and the reason
is that the recommendation's stated shape is not available on disk.** § 13.3 measures it as *"one
line, number-preserving, in one file"*; it is not. `currentMemberCount` returns a `number`
(`absence.ts:348-349`), and the filter's product is the `Member[]` the sidebar renders as a list at
`Sidebar.tsx:174` — so the swap breaks `RosterState` (`useRoster.ts:27`), the list render, and the
typecheck. The two shapes that *are* available are both worse than deferring:

- **Print `currentMemberCount(roster.members)` in the sidebar.** `roster.members` is already filtered,
  so this is a second filter over a filtered array — a call that reads as authoritative while being a
  no-op, leaving the real filter in place. Two filters where there was one.
- **Export a `currentMembers(roster): Member[]` from `absence.ts`** and have both callers use it, with
  `currentMemberCount` becoming its `.length`. This is the real consolidation, and it is the right
  answer — but it opens **INV-04's own module** inside a ticket whose entire discipline is that it adds
  no arithmetic and opens nothing, and the duplication is **three copies rather than the two § 13.3
  counted**: `useRoster.ts:56`, `MemberList.tsx:179` and the one inside `currentMemberCount` itself.
  Fixing two of three is not consolidation, and fixing three is three more paths.

**So it is named in *Out of scope* item 10 rather than passed over in silence**, which is what § 13.3
asks of a plan that declines. **The measurement it was declined on is the correction**: the
duplication is wider and the fix is larger than the recommendation had it, and it wants a ticket whose
`allowed_paths` can hold `absence.ts`.

**3. Render the count only when it is greater than zero, following `month-cell-count`.** The month's
shipped precedent (`src/routes/MonthView.tsx:523`), and it is the cheaper-looking default: an empty
week shows seven `0/4` strips that say nothing a reader did not already see from seven empty columns.
**Rejected because it dissolves the question this ticket was asked to answer.** ADR-029's empty-state
paragraph assumes a footer reading `0/4` exists; no clause says it does. Following the month here makes
the strip vanish on all seven columns of an empty week, and alternative 1's whole argument — which
turns on `0/4` being visible beside the sentence — silently stops being decidable. AC-7 exists because
this is not inheritable. The cases also differ: the month cell is one number in a 42-cell grid where a
zero in every empty cell is noise, and this is one number per column in a seven-column layout where
its absence is the anomaly.

**4. Name the number in the visible strip, using the glossary's term.** Clause 4 offers exactly this as
the alternative to saying nothing, and an unlabelled `0.5/4` on a dense screen is genuinely opaque the
first time it is seen. **Rejected because one half of clause 4's own escape hatch defeats the clause.**
The glossary's name is *"Absence count"* (`.ai/registry/glossary.md:34`), and the English term of art
carries the same claim about a member working from home that the clause exists to prevent — INV-04
counts PTO and WFH alike, a WFH member is working, and `src/lib/labels.ts:24-29` calls that the most
costly confusion in this domain. `vắng` is unavailable independently, on § *Language*. So the second
half is taken: a bare `n/N`, with the glossary's exact term in the accessible name only (AC-10). It
also spends the least density, which is the one thing `CLAUDE.md` § *Visual direction* asks of this
screen.

## Changelog

- `2026-09-08T11:54:35+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-08T11:54:35+07:00` — **`ticket.yaml` § 13.3's recommended consolidation was declined, and
  the reason is a correction to its measurement rather than a scoping preference.** Sections 1 and 2
  were written from the registry row and ADR-029's four clauses before the source tree was read.
  Reading it changed one decision and no acceptance criterion. § 13.3 describes replacing
  `useRoster.ts:56`'s filter with `currentMemberCount` as *"one line, number-preserving, in one
  file"*; on disk `currentMemberCount` returns a `number` while the filter's product is the `Member[]`
  the sidebar renders as a list, so the swap does not typecheck, and the same filter appears a third
  time at `MemberList.tsx:179`. § 8 alternative 2 carries the measurement and *Out of scope* item 10
  names the deferral. **No AC was reshaped by this**: AC-6 requires the denominator to be computed
  from the roster on this screen and is satisfied either way. Raised by `tech-lead-design`.
- `2026-09-08T11:54:35+07:00` — **`invariants_touched` decided as `[INV-04, INV-06]`, with INV-05
  considered and explicitly excluded.** `ticket.yaml` § 6 named all three and settled none. The
  distinction taken is whether the invariant has a failure mode this ticket creates that is not
  already closed by AC-5: INV-06 does — a rounding or integer format chosen inside clause 1, where the
  count is still INV-04's and the screen still lies about a half day — and INV-05 does not, because
  excluding a tentative entry requires the local sum AC-5 already forbids. Raised by
  `tech-lead-design`.
