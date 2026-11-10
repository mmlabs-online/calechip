---
ticket: UIE-06
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-08T09:19:04+07:00
inputs_read:
  - .ai/board/tickets/UIE-06/01-plan.md
  - .ai/board/tickets/UIE-06/03-impl-log.md
  - .ai/board/tickets/UIE-06/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/standards/testing-standards.md
  - src/routes/MonthView.tsx
  - src/index.css
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-06 — review report

**Numbering note.** The checks below are numbered from `.ai/01-operating-model.md` § *Review
checklist* — **R7 is the invariant check and R8 is the dependency check**, which is also what
`/review`'s own command file states. `.ai/templates/review-report.md` carries those two the other way
round in its detail sections. The operating model is the governing copy and is what this report
follows.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/UIE-06/ticket.yaml:82-85` lists the three globs; the working tree holds `.ai/board/tickets/UIE-06/ticket.yaml`, `src/index.css`, `src/routes/MonthView.tsx` modified and `.ai/board/tickets/UIE-06/01-plan.md`, `.ai/board/tickets/UIE-06/03-impl-log.md` untracked — every one inside a glob, nothing outside |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, the command named at `.ai/standards/testing-standards.md:16` |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, `.ai/standards/testing-standards.md:17`. This is also RULE-02's enforcement and AC-20's (no file added to `copyDebt`, no Vietnamese string) |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/MonthView.tsx:79` imports `seam` from `@/lib/data` and nothing else; the only datastore calls are `:197`, `:212-215`, `:298`, all on `seam`, all unchanged by this diff. No `./supabase` or `./mock` import exists in the file |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | table below |
| R6 | Permission gating matches plan section 3 | PASS | `src/routes/MonthView.tsx:486-487` — `onMouseDown`/`onMouseEnter` are `undefined` on an out-of-month cell, byte-for-byte the gating § 3 says must survive the rebuild; the four refusal states survive at `:311`, `:319`, `:321`, `:330`; no control was added and no seam call was added (R4) |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) | PASS | table below |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` is empty — neither file is modified, added or removed, so no dependency entered the tree |

## R5 detail

One row per contract item in `01-plan.md` § 4. § 4.1 is the list of what is **not** rebuilt, so its
row records that the diff left it alone.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — what is already true and is not rebuilt | `src/routes/MonthView.tsx:521-527` (numeral top-left), `:596` (peach/mint chips), `:504` (overloaded whole background), `:454-455` (Monday-first seven columns, `cells` unchanged) | yes — the numeral-and-count row is byte-for-byte the pre-change block, and the only listed item that changes is the out-of-month colour, which is § 4.5's business |
| § 4.2 — AC-1, the grid fills the pane | `src/routes/MonthView.tsx:383` | yes — `mx-auto flex max-w-5xl flex-col gap-6` → `flex h-full flex-col gap-6`. The cap is deleted and no width cap replaces it |
| § 4.3 — AC-2, the weekday strip lifts out | `src/routes/MonthView.tsx:424-430` | yes — the seven labels are now a sibling `grid grid-cols-7 gap-px` **above** the card at `:441`, no longer children of `month-grid` at `:454`. Still `data-testid="month-weekday"` at `:426`, still `Mon`…`Sun` from `WEEKDAYS` |
| § 4.4 — AC-3 and AC-4, one ruled card and taller cells | `src/routes/MonthView.tsx:441` (`flex flex-1 flex-col overflow-hidden rounded-card bg-card shadow-soft`), `:455` (`grid flex-1 auto-rows-[minmax(170px,1fr)] grid-cols-7 gap-px bg-line`), `:489-493` (`min-h-24 rounded-xl` deleted from the cell) | yes — 170px is a row **minimum** inside a `minmax`, which is § 4.4's "`min-height`, never `height`" for the cell. `overflow-hidden` on the card with rectangular cells is what leaves only the four outer corners rounded (AC-3). `bg-line` behind `gap-px` is the hairline scheme, so cells are separated by rules and not by gutters of ground |
| § 4.5 — AC-5 and AC-6, the out-of-month tint | `src/routes/MonthView.tsx:498` | yes, and the clause is honoured exactly: `bg-bg` (`--color-bg: #f1effa`, `src/index.css:102`) and **not** `bg-holiday` (`--color-holiday: #c9bff0`, `src/index.css:170`), which is the collision § 4.5 forbids. AC-6's statelessness is untouched code — `:458-465`, `:474-481` still key every attribute off `inMonth`/`status` — and `cal-08` AC-14 passes unedited |
| § 4.6 — AC-7 and AC-8, the token conversion | `src/routes/MonthView.tsx:512` `bg-card`, `:498` `bg-bg`, `:511` `bg-holiday`, `:596` `bg-pto`/`bg-wfh`, `:504` `bg-overload`, `:455` `bg-line`; `src/index.css:174` defines `--color-overload: #ffe4e6` | yes — all six rows of the table, plus the two the log declares as additions (`text-ink-3` at `:498`, `ring-ink-3` at `:518`). Every one resolves to a `--color-*` defined in `src/index.css:102-174`; no framework default colour is left in the grid. The new token's value is `#ffe4e6`, which § 4.6 requires to be exactly today's `rose-100`, so no pixel changes value. AC-8 holds because `bg-pto`, `bg-wfh` and `bg-holiday` are the same three tokens `src/components/Sidebar.tsx:68-70` draws the legend swatches from |
| § 4.7 — the false comment, corrected in one file and reported in the other | `src/index.css:141-162` corrects it; `src/components/Sidebar.tsx` is absent from `git diff --name-only` and from `allowed_paths` | yes — the correction names all three false clauses and the shell file was never opened, so no shell file entered `allowed_paths`. The sidebar's line is reported at `03-impl-log.md` *Open questions* item 2 |
| § 4.8 — AC-9 and AC-10, the top-right collision | `src/routes/MonthView.tsx:521-528` (numeral-and-count row unchanged), `:540-549` (badge on its own `flex justify-end` line below it) | yes — the count keeps the top-right of the numeral's line and nothing else occupies it (AC-9); `month-cell-bridge` is present once, reads `Bridge`, is `border border-current` with no `bg-*` class (AC-10's outline, unfilled), and sits on the next line rather than on the count's |
| § 4.9 — AC-17, the gesture survives the rebuild | `src/routes/MonthView.tsx:486-487`, `:518` | yes — the two handlers are on the cell element, unchanged in body and unchanged in their `inMonth` guard; the ring is `ring-2 ring-inset ring-ink-3`. `ring-inset` is load-bearing rather than cosmetic here: an outside ring across a 1px hairline paints onto the neighbour. `tests/e2e/cal-04-month-view.spec.ts:199-218` passes unedited |
| § 4.10 — no breakpoint | `src/routes/MonthView.tsx:455` | yes — `grid-cols-7` carries no responsive prefix and no `md:`/`lg:` variant appears anywhere in the file's grid classes |
| § 4 preamble — no seam function changes, no new prop, no new file, no test file opened | `git status --porcelain tests/` is empty; `git diff --name-only` names three files, none new outside the ticket folder | yes — and `pnpm exec playwright test` reports 165 passed with no test file modified, which is AC-19's evidence |

**The criteria § 4 preserves rather than changes, each still present:** AC-11 `month-cell-holiday`
with `data-kind` and the name at `:557-565`; AC-12 the lavender conditional at `:511-512` with the
overload branch at `:504` still winning; AC-13 `absentMembersFor` at `:273` still deciding the faces
and `month-cell-count` at `:524` still drawing the number; AC-14 the dashed border at `:600`;
AC-15 the star at `:604`; AC-16 `month-threshold` with both attributes at `:399`; AC-18
`month-empty` at `:622`.

## R7 detail

**One row per ID in `invariants_touched`** (`ticket.yaml:48`).

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — no second definition of the absence count exists anywhere | The screen still computes nothing. Every number comes from `absenceCountsFor`, and which faces appear comes from `absentMembersFor` in the same pass, so the count and the avatars cannot disagree. Grepped for a second implementation: the only `.filter(` or `.length` in the file is `view.entries.length === 0`, which is the empty-state test and not an arithmetic on entries. `src/lib/data/absence.ts` is not in `git diff --name-only`. The count itself survives the rebuild, which is what AC-13 and `01-plan.md` § 1 item 1 required and what the diff shows was done — the taller cell did not become a reason to delete it | `src/routes/MonthView.tsx:265`, `:273`, `:462`, `:524`, `:621` |
| INV-05 — a tentative entry counts exactly as a non-tentative one does | The dashed-border branch is unchanged, and nothing about counting changed (INV-04 row). The risk `01-plan.md` § 2 named was the dashed border being lost against a **new** border treatment in a ruled grid — and the ruled grid has no borders: the rules are `gap-px` over `bg-line` (`#e4e0f4`, `src/index.css:104`), while the tentative border is `border-current` ink on a `rounded-full` chip. No cell, card or chip gained a `border-*` class in this diff | `src/routes/MonthView.tsx:600`, `:455`, `src/index.css:104` |
| INV-06 — an entry carries exactly one portion, applying to every date in its range | A half day's avatar is identical to a full day's on this screen, so `month-cell-count` is the only surface on which a portion is expressible here at all, and it is still drawn — top-right, on the line it already owned. § 4.8 gave the bridge badge the **next** line rather than that slot, which is precisely what keeps this true. ADR-031 stays `PROPOSED` and nothing in the diff anticipates it | `src/routes/MonthView.tsx:521-528`, `:540-549` |

**Held by code and not by an affordance.** None of the three rests on a class, a colour or a
position that a person could restyle away: INV-04 and INV-06 rest on `absenceCountsFor` and
`absentMembersFor` being the file's only arithmetic, and INV-05 rests on the counting path being
untouched. The visual clauses above are the *reason the plan listed them*, not the mechanism holding
them.

## R8 detail

No dependency was added, removed or upgraded. `package.json` and `pnpm-lock.yaml` are both absent
from `git status --porcelain`, so no ADR is owed.

## Findings

None. No check failed and nothing routes.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

## Two things recorded rather than found

Neither is a check and neither affects the gate. They are here because the `orchestrator` reads this
artifact and both bear on what happens next.

1. **`ticket.yaml:104` still reads `gates.plan: { passed: false, at: null }`** although
   `01-plan.md`'s front-matter reads `gate: PASS`. `03-impl-log.md` *Open question 4* reports it and
   is right that the row is not the Developer's to write. `/ship` requires both gates, so the
   `orchestrator` reconciles `plan` and records `review` from this file's front-matter before that
   command can run.
2. **`month-entry-panel` now opens below the fold**, reported at `03-impl-log.md` *Open question 1*
   and confirmed as out of this gate rather than dismissed. AC-17 is satisfied literally — the range
   selects, the cells ring at `src/routes/MonthView.tsx:518`, the panel renders at `:631`, and
   `tests/e2e/cal-04-month-view.spec.ts:199-218` passes — and the panel's position is a **direct consequence of AC-4's first
   clause**, which the plan chose deliberately after `01-plan.md` § 4.4 weighed it. It is therefore
   not an implementation defect and does not route: no contract item and no criterion places that
   panel. It is a layout question for `tech-lead-design` on a future ticket, and `01-plan.md` § 2b
   records that the image this group is built against shows no form at all.

## Verdict

**PASS.** R1 through R8 all pass, each citing `file:line`. `next_state: DONE` — `.ai/01-operating-model.md:36`
takes REVIEW straight to DONE, the QA stage having been removed by ADR-022.
