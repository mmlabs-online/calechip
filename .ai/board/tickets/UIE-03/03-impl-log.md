---
ticket: UIE-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-07T15:22:00+07:00
inputs_read:
  - .ai/board/tickets/UIE-03/01-plan.md
  - .ai/board/tickets/UIE-03/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - src/lib/period.ts
  - src/components/TopBar.tsx
  - src/components/Sidebar.tsx
  - src/App.tsx
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/Holidays.tsx
  - tests/e2e/ (the six files in allowed_paths, plus cal-08's helpers and App.tsx's routing to
    confirm every deleted click's successor renders in place)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-03 — implementation log

## Files touched

Thirteen files. Twelve are the source and spec files of § 7's `allowed_paths`; the thirteenth is this
log. `ticket.yaml` is modified in the tree by PLAN, not by this stage.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/period.ts` | modified | `PeriodNav` gains `anchorValue` — the raw `yyyy-MM-dd` Monday / `yyyy-MM` / `yyyy` the deleted screen headings published, which `label` cannot supply because it is display copy | § 4.2 |
| `src/components/TopBar.tsx` | modified | the bar adopts the screens' own ids: `<kind>-anchor` with the matching `data-*`, `<kind>-prev`, `<kind>-next`, `<current>-<target>` segments | § 4.3 |
| `src/routes/WeekView.tsx` | modified | the whole `<header>` deleted; nothing from the day list down is touched | § 4.4 |
| `src/routes/MonthView.tsx` | modified | the header's navigation deleted, `month-threshold` kept; two now-unused imports dropped | § 4.4 |
| `src/routes/YearView.tsx` | modified | the whole `<header>` deleted; one now-unused import dropped | § 4.4 |
| `src/routes/Holidays.tsx` | modified | the back-link deleted; the year controls kept, per § 1 item 3 | § 4.4 |
| `tests/e2e/cal-04-month-view.spec.ts` | modified | one dead-id click removed from `switchTo`, plus the history repair in *Deviations* | § 4.5 |
| `tests/e2e/cal-05-week-view.spec.ts` | modified | one dead-id click removed from `declare` | § 4.5 |
| `tests/e2e/cal-06-year-view.spec.ts` | modified | two dead-id clicks removed | § 4.5 |
| `tests/e2e/adm-02-holidays.spec.ts` | modified | two dead-id clicks removed | § 4.5 |
| `tests/e2e/adm-03-holiday-writes.spec.ts` | modified | one dead-id click removed | § 4.5 |
| `tests/e2e/cal-08-holiday-shading.spec.ts` | modified | three dead-id clicks removed, and nothing else in the file | § 4.5 |
| `.ai/board/tickets/UIE-03/03-impl-log.md` | created | this log | — |

Ten clicks removed in total, which is the count § 0's *Class B* row predicted.

## Contract items

`01-plan.md` numbers its contract as § 4, not § 1; the rows below follow its numbering.

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 the grant | `src/components/TopBar.tsx:19-28`, `src/lib/period.ts:249` | the shell edit is confined to test ids, the data attributes beside them, and the one field that feeds them. No layout, styling, navigation target or control changed |
| 4.2 `PeriodNav.anchorValue` | `src/lib/period.ts:249`, set at `:304`, `:327`, `:342`, `:357` | for `week` it is the MONDAY — the same value `prevTo`/`nextTo` step from, so there is no second normalisation to disagree with UIE-02's. Both week arms (`/` and `/week/:day`) set it |
| 4.3 anchor id and attribute | `src/components/TopBar.tsx:114-118` | `data-testid={`${nav.kind}-anchor`}`; the three `data-*` are written as three fixed attributes, mutually exclusive by kind, the two inapplicable ones `undefined` so React omits them. `data-period-kind` kept |
| 4.3 previous / next | `src/components/TopBar.tsx:95`, `:124` | `<kind>-prev`, `<kind>-next` |
| 4.3 switcher segments | `src/components/TopBar.tsx:157` | `` `${nav.kind}-${segment.kind}` `` — the nine names § 4.3 writes out, no special case for the active segment |
| 4.3 today, create, the bar | `src/components/TopBar.tsx:135`, `:180`, `:82` | unchanged, as the table requires |
| 4.4 `WeekView.tsx` | `src/routes/WeekView.tsx:278-285` (the comment that replaces the header) | header gone entire; the day list and CAL-08's cell selectors below it are untouched |
| 4.4 `MonthView.tsx` | `src/routes/MonthView.tsx:311-332` | navigation gone, `month-threshold` at `:330` intact with both `data-threshold` and `data-current-members` |
| 4.4 `YearView.tsx` | `src/routes/YearView.tsx:319-325` | header gone entire; the grid below it untouched |
| 4.4 `Holidays.tsx` | `src/routes/Holidays.tsx:469-478` | the back-link gone; `holidays-prev` `:272`, `holidays-year` `:278`, `holidays-next` `:282` all kept |
| 4.4 unused imports | `src/routes/MonthView.tsx:70`, `src/routes/YearView.tsx:69` | `monthLabel` and `shiftMonth` left MonthView, `shiftYear` left YearView. `WeekView.tsx` and `Holidays.tsx` needed no import change — lint is the check, and it found exactly these three |
| 4.5 the six spec files | the six rows in *Files touched* | every edit is the removal of a click; one file needed a second, declared change (*Deviations*) |

## Deviations from the design

**One, and it is in `tests/e2e/cal-04-month-view.spec.ts`.**

`switchTo` ended one session and began another without a document load, and it did so by first
clicking the month screen's landing-route link — a Class B id, so the click had to go. Sign-out is a
sidebar control and renders on the grid, so it is now clicked where the caller already stands, and no
shell control was put in the deleted click's place (AC-12's last clause holds).

**What the deleted click also did, and what nothing else does, is push a history entry.** The helper
returns to the grid through `backToMonth`, which walks `page.goBack()` rather than reloading — a
`page.goto` would reset the mock seam's module state and lose the entry the test wrote two lines
earlier, which is the whole reason that helper exists. Measured in this tree: **signing out and
signing back in each REPLACE the current history entry rather than pushing one** (sign-out navigates
to `/signin`, sign-in to `/`, both with `replace`). With the pushed entry gone, the walk back from
the grid found `about:blank`, and `AC-3 and AC-7: a half day is 0.5…` failed on a missing
`month-grid`. That is AC-12's "anything that became unreachable only because of it" — except that
what became unreachable is the rest of the test rather than a step in it, and deleting it would take
AC-3 and AC-7's interface coverage with it.

**The repair is one `page.goForward()`, at `cal-04-month-view.spec.ts:87-98`, and it is a harness
call rather than a navigation.** `openMonthAs` leaves an entry in FRONT of the grid; stepping into it
restores the depth `backToMonth` needs, adds no click on any control, asserts nothing new, and leaves
the helper signing out from exactly the address it signed out from before this ticket. An assertion
on `home-sign-out` follows it so the helper fails loudly if that forward entry ever stops existing,
rather than silently no-opping back into the failure above.

**Why this is declared rather than absorbed.** § 4.5 states that each spec edit is *the removal of a
click and nothing else*, and this file carries a second line. It is worth a reviewer's eye precisely
because it is the one place where AC-12's letter and AC-13's whole-suite requirement pulled apart.

Nothing else departs from § 1 through § 7. `Holidays.tsx` keeps its period controls (§ 1 item 3), no
refusal or content heading was touched (AC-11), and no string became Vietnamese (AC-15).

## Invariants

`invariants_touched: []`. The plan's structural argument was checked against the diff rather than
restated: no file under `src/lib/data/` is opened, no seam call is added, removed or re-shaped, and
`period.ts` remains pure with no data import. `src/routes/MonthView.tsx` still reads
`team.overloadThreshold` and the active roster count and publishes both unchanged, so INV-04's two
numbers reach the screen exactly as before.

| ID | Still holds because |
|----|---------------------|
| — | No row in `.ai/registry/invariants.md` governs the appearance of a screen, and this change writes no row, alters no query and moves no policy. The observable forms are AC-10 and AC-13, both green below |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the typecheck named in `.ai/standards/testing-standards.md:16` |
| `pnpm exec eslint .` | 0 | `:17`. It found the three now-unused imports; they are removed |
| `pnpm exec vitest run` | 0 | `:18` — 186 tests, 10 files |
| `pnpm exec playwright test` | 0 | `:19` — **165 passed**, the whole suite. AC-13's evidence: the 83 references to relocated ids pass with no edit to the files holding them |
| `git diff --name-only` subset of `allowed_paths` | yes | twelve source and spec files, plus `.ai/board/tickets/UIE-03/**`. `smoke.spec.ts` untouched, `adm-01-threshold.spec.ts` untouched |

The first run of the suite failed one test; the cause and the fix are in *Deviations*. It is recorded
rather than quietly re-run, because the fix is the deviation.

## Testability contract

`01-plan.md` carries no § 6 selector table — its § 6 is the schema delta, and the selector contract is
§ 4.3. The relocated names and their single homes:

| selector | Exists at |
|----------|-----------|
| `week-anchor` / `month-anchor` / `year-anchor` | `src/components/TopBar.tsx:114`, one element, named from `nav.kind` |
| `data-week-start` / `data-month` / `data-year` | `src/components/TopBar.tsx:116-118`, one of the three present at a time |
| `week-prev` / `month-prev` / `year-prev` | `src/components/TopBar.tsx:95` |
| `week-next` / `month-next` / `year-next` | `src/components/TopBar.tsx:124` |
| `week-month`, `week-year`, `month-week`, `month-year`, `year-month` (and `week-week`, `month-month`, `year-year`, `year-week`) | `src/components/TopBar.tsx:157` |
| `shell-topbar`, `shell-period-today`, `home-new-entry-link` | `src/components/TopBar.tsx:82`, `:135`, `:180` — unchanged (AC-14) |
| `month-threshold` | `src/routes/MonthView.tsx:330` (AC-2) |
| `holidays-prev`, `holidays-year`, `holidays-next` | `src/routes/Holidays.tsx:272`, `:278`, `:282` (AC-4) |
| the four Class B ids | nowhere in `src/` or `tests/` — `grep` over both trees returns nothing (AC-5) |

**AC-5 also governs the comments.** The four dead ids are described and never spelled in the source
comments that explain their removal, because AC-5 says the strings appear in neither tree and a
comment is in the tree. Each of the four places says so in one clause, so a later reader does not
"fix" the omission.

**AC-9, exactly one element per id**, is not asserted by a new test and does not need one: Playwright
resolves `getByTestId` strictly and fails on two matches, so the 83 untouched references passing is
the proof. `shell-period-prev`, `shell-period-next` and `shell-period-anchor` no longer exist —
nothing asserted them (§ 0 measurement 1), and *Open questions* 3 records the documentary cost.

## Open questions

1. **`year-week`, `week-week`, `month-month` and `year-year` are rendered and referenced by
   nothing.** The plan accepts this (*Open questions* 1 and 2) as the price of a naming rule with no
   special case for the segment you are already on. Named again here because a reviewer grepping a
   new id for its assertions will find none, four times.
2. **`/holidays` is now the only period-shaped screen with its own controls**, per § 1 item 3 and
   § 8 alternative 2. Unchanged by this implementation and still a deliberate inconsistency.
3. **`cal-04-month-view.spec.ts`'s `switchTo` now depends on a FORWARD history entry.** It is
   asserted rather than assumed, so a future change to `openMonthAs` that stops leaving one fails
   there with a clear message instead of in `backToMonth`. A reviewer who dislikes the dependency
   should know the alternatives were: a shell-control click, which AC-12 forbids in as many words,
   or a `page.goto`, which resets the mock seam and voids the test.
