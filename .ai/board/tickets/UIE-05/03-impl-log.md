---
ticket: UIE-05
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-08T08:30:38+07:00
inputs_read:
  - .ai/board/tickets/UIE-05/01-plan.md
  - .ai/board/tickets/UIE-05/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/01-operating-model.md
  - src/routes/WeekView.tsx
  - src/components/AppShell.tsx
  - src/components/TopBar.tsx
  - src/App.tsx
  - src/index.css
  - tests/e2e/cal-05-week-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-05 — implementation log

**The plan is the merged story and design (ADR-019), so its contract is § 4 and not § 1** — § 1 is
*Problem and scope*. Every reference below to a "contract item" is to a numbered sub-section of
§ 4, and the acceptance criteria it serves are named beside it.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/WeekView.tsx` | modified | The one component the ticket re-lays-out: the grid gains a minimum height, the header strip becomes a centred stack with a hairline and a `dd/MM` date, the day column's corner radius drops to a Tailwind built-in, and the entry chip becomes a three-row stack with a circular avatar bubble and the star beside the name. | § 4.2, § 4.3, § 4.4, § 4.5, § 4.6 |
| `.ai/board/tickets/UIE-05/03-impl-log.md` | created | This file. | — |

`.ai/board/tickets/UIE-05/ticket.yaml` and `01-plan.md` are dirty from PLAN, not from this stage;
this run's only edit to the ticket folder is the file you are reading, plus the state transition
recorded at the end of it. **No test file was opened for writing and none needed to be** — AC-17,
and § 7 predicted it for both conditional files.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 — what is already true and is not rebuilt | untouched | Seven equal tracks at `xl:grid-cols-7`, one grid row with the default `align-items: stretch`, `bg-card`, `shadow-soft`, mint and peach chips, Monday first. § 0's finding held: none of it was rewritten. |
| 4.2 — AC-1, the column fills the pane by `min-height` | `WeekView.tsx:361`, `:423`, `:424` | `xl:min-h-full` on the grid, carried there by `xl:h-full` on the section and the positioning wrapper. **The declaration differs from the one the plan named; see *Deviations*.** |
| 4.3 — AC-4 to AC-6, the header strip | `WeekView.tsx:457-513` | `flex flex-col items-center` with `border-b border-line`; the full English weekday on line 1, `dd/MM` on line 2 in the same `week-day-label`; `week-day-holiday` and `week-day-bridge` keep their line beneath. |
| 4.4 — the corner radius is `rounded-2xl`, not a token change | `WeekView.tsx:454`, `:464` | `rounded-2xl` on the day column, `rounded-t-2xl` on its header. `src/index.css` was never opened, so `--radius-card` is unmoved and `week-empty-card` at `:717` still carries `rounded-card`. |
| 4.5 — AC-7 to AC-9, the chip restacked with all five facts kept | `WeekView.tsx:546-694` | Three rows in the same `week-row` element: bubble + name + star; type + portion; then the demoted line. All seven children survive with their selectors. |
| 4.6 — what the image is silent about and this ticket keeps | `WeekView.tsx:496-521`, `:558-566`, `:711-723` | Holiday name with `data-kind`, the outlined bridge badge, the lavender tint on the heading only for a non-working holiday, the tentative dashed border, `week-day-empty` with its sentence, and `week-empty-card`. None was edited. |
| 5 — seam impact | n/a | Nothing under `src/lib/data/` was opened; the import list at the top of the file is byte-identical. `seam.getTeam()` is still not called, which is AC-14 from the outside. |
| 6 — schema delta `none` | n/a | Nothing under `supabase/` was opened. |

## Deviations from the design

**One, and it is the open question the plan deliberately left to this stage.**

**§ 4.2 named `calc(100vh - 70px - 1.5rem)` as the likely declaration and a percentage as the thing
that might not resolve. Measured in a rendered viewport, the two swap places: the percentage
resolves, and the `calc` is wrong.** *Open questions* item 1 says in terms that this needs a
rendered viewport, that the Developer measures it, and that it changes one declaration and no
conclusion. It changed one declaration and no conclusion.

**What was measured.** A throw-away Playwright probe outside the repository — no file was added to
`tests/` — signed in and reported every `week-day`'s box, whether any column scrolled itself, and
whether the document scrolled.

- **The `calc` put the columns 56px below the fold on a quiet week, and made the page scroll 80px.**
  At 1280x800 the seven bottom edges landed at 856px against an 800px viewport, with
  `document.scrollHeight` 880. The cause is not the arithmetic: `App.tsx:88` renders `seam-banner`
  **above** the shell on every build that resolves to the mock seam — which is every build the
  acceptance suite drives and every build a reviewer can run — so this grid's top edge is not the
  top bar's height. **A viewport-relative constant is only correct at one offset, and the offset is
  not fixed.**
- **`min-h-full` is offset-independent and absorbs the banner without knowing it exists.** The same
  measurement gives bottom edges at 776px, plus the pane's own 24px of `pb-6`, which is exactly 800,
  and `document.scrollHeight` equal to `clientHeight` — **no page scroll on a quiet week**.
- It resolves because `AppShell.tsx:42` is a flex **item** whose height the flex algorithm settles,
  which is what a percentage below it resolves against. `xl:h-full` on this screen's section and on
  the positioning wrapper is what carries that definite height down to the grid; without those two
  the percentage would resolve against an auto height and silently do nothing.

**The property § 4.2 specifies is unchanged and is what was built**: a minimum and never a height,
so a busy column still grows past the pane. Measured at 1280x420 with entries: the seven columns are
533px inside a 270px pane, the **page** scrolls, **no column has a scrollbar of its own**, and all
seven share one top and one height — UIE-04's AC-4 and AC-5, and this ticket's AC-2 and AC-3.

**Two judgement calls inside § 4.5's grant, recorded because a reviewer would otherwise have to
find them by rendering the screen.** Neither changes a criterion.

1. **The star is inline with the name rather than a third flex child** (`WeekView.tsx:588-604`).
   Built the obvious way — bubble, name, star as three siblings with the star `shrink-0` — the
   rendered column at 1280px left the name about 24px and `Đã duyệt` broke **mid-word**, as
   `Đã / du / yệt`. A Vietnamese name pulled apart across three lines is the opposite of what
   `CLAUDE.md` § *Visual direction* asks of this typeface. Inline, the star flows after the last
   word instead of reserving a column, and the name wraps between words.
2. **The avatar bubble is `h-6 w-6` and not `h-7 w-7`**, for the same reason: at 1280px a column is
   ~137px, not the ~161px the plan's arithmetic assumed, and every 4px of bubble is 4px the name
   does not get.

**No selector was renamed, no element removed, no string translated, no count added, no fact
deleted, and no shared token moved.**

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | **The tempting space-saving was not taken.** Nothing merges a member's `am` and `pm` entries into one chip: the `li` is still keyed on `entry.id`, still carries its own `data-entry-id`, and is still produced by one `people.map` over `absentEntriesFor`'s output — so a member holding both on one date is two `week-row` elements with one `data-member-id`, which is AC-10 and is what keeps the week and the month cell from disagreeing. No `.filter` on `status` was written anywhere in this file, `absence.ts` was not opened, and **no count of any kind was added** — the screen renders no absence total, no proportion and no threshold, so INV-04's single definition gains no second one. `cal-05-week-view.spec.ts:172` (two rows, two different `data-portion` values on one date) passes unedited. |
| `INV-06` | **The portion pill moved and was not dropped, which is the whole of the invariant's visibility.** `week-row-portion` still carries `data-portion` read off `entry.portion` on **every** date the entry covers — the value is read per rendered row, not per entry, so a five-day `pm` entry still renders five afternoons and cannot render a whole day in the middle. The image deletes this pill; deleting it would have made INV-06 invisible on the only screen in the product that shows it. Verified rather than argued: `cal-05-week-view.spec.ts:193` — the five-day `pm` case — passes unedited, as does the two-different-portions case above. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | lint, same. **AC-18**: no file entered `copyDebt`, and no string on this screen became Vietnamese. |
| `pnpm exec vitest run` | 0 | 10 files, 186 tests, all pass. No test file edited. |
| `pnpm exec playwright test` | 0 | **165 tests, all pass, no test file edited** — AC-17. `cal-05-week-view.spec.ts` and `cal-08-holiday-shading.spec.ts` are the two that read this screen and both are green, which carries AC-11's day-status assertions unchanged. |
| `git diff --name-only` subset of `allowed_paths` | yes | `src/routes/WeekView.tsx` and this ticket folder. `ticket.yaml` and `01-plan.md` are PLAN's, still uncommitted per ADR-006. |

**AC-16 is satisfied by the diff being what it is**: `src/index.css`, `src/components/AuthCard.tsx`
and `src/components/Sidebar.tsx` are not in it, so the sign-in card's and the sidebar's radius,
background and shadow are byte-for-byte what they were.

## Testability contract

Every `data-testid` this screen carried before the change is present after it, on an element playing
the same role. **The stage that consumed this table is retired (ADR-022 removed QA and RULE-05 with
it)**; the table is kept because AC-17 is a criterion about exactly this list and a reviewer checking
it should not have to grep for fourteen names.

| selector | Exists at |
|----------|-----------|
| `week-day` | `WeekView.tsx:435` |
| `week-day-label` | `WeekView.tsx:457` |
| `week-day-holiday` (`data-kind`) | `WeekView.tsx:498` |
| `week-day-bridge` | `WeekView.tsx:507` |
| `week-day-empty` | `WeekView.tsx:516` |
| `week-row` (`data-member-id`, `data-entry-id`) | `WeekView.tsx:546` |
| `week-row-avatar` | `WeekView.tsx:584` |
| `week-row-name` | `WeekView.tsx:597` |
| `week-row-type` (`data-type`) | `WeekView.tsx:623` |
| `week-row-portion` (`data-portion`) | `WeekView.tsx:635` |
| `week-row-tentative` | `WeekView.tsx:654` |
| `week-row-note` | `WeekView.tsx:666` |
| `week-row-approver` (`data-approver-id`) | `WeekView.tsx:678` |
| `week-empty-card` | `WeekView.tsx:717` |
| `week-loading`, `week-not-on-a-team`, `week-unavailable`, `week-sign-in` | unchanged, outside the container this ticket touched |

`data-day-status` and `data-bridge` on `week-day`, and `week-anchor`'s `data-week-start` in the top
bar, are likewise untouched.

## Open questions

1. **A chip carrying five facts is three lines tall at 1280px, not the image's ~44px, and at that
   width the name itself takes two of them.** The plan's *Open questions* item 2 records the choice;
   what the rendering adds is that the column is ~137px rather than the ~161px the arithmetic
   assumed, so the squeeze is tighter than either document expected. **It reads as intended from
   about 1500px upward.** Nothing here is a defect against a criterion — every fact is present and
   addressable at rest — but if the operator looks at 1280px and calls it too dense, the honest
   answers are a narrower sidebar or a smaller chip type scale, and both are their own ticket.
2. **`week-day-empty` was left exactly as it was.** AC-12 permits it to be smaller or lighter and
   requires only that its words survive; "may" is not "must", so nothing was changed and the
   criterion is met by the element still being there with its sentence.
3. **The `seam-banner` offset that decided the declaration is a demo-build artifact.** In a build
   with a real datastore the banner is absent, the grid's top edge *is* the top bar's height, and
   `min-h-full` gives the same answer there as it does here — it is correct in both, which the
   `calc` was not. Worth knowing that no build was available in which to observe the production
   case directly.
