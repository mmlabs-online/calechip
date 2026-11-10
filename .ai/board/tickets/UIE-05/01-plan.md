---
ticket: UIE-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-08T08:12:05+07:00
inputs_read:
  - .ai/board/tickets/UIE-05/ticket.yaml
  - .ai/board/tickets/UIE-05/design/README.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/architecture.md
  - .ai/01-operating-model.md
  - src/routes/WeekView.tsx
  - src/components/AppShell.tsx
  - src/components/AuthCard.tsx
  - src/components/Sidebar.tsx
  - src/lib/labels.ts
  - src/index.css
  - ui-language.json
  - tests/e2e/cal-05-week-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-05 — the week column fills the viewport, and its header strip and entry chip are restacked

## 0. What was measured, and the one thing the shell got wrong

**`depends_on: []` re-checked.** UIE-01 through UIE-04 are all `DONE`, OPS-004 shipped in PR #71, and
no ticket on the board holds a non-empty `allowed_paths`. Nothing collides. **ADR-029 is
`PROPOSED — awaiting the operator`**, confirmed at its own `## Status`, so § 5's refusal stands
unchanged and this ticket neither waits on it nor anticipates it.

**§ 2's "already shipped" list is accurate**, verified in `src/routes/WeekView.tsx`: the seven columns
are `xl:grid xl:grid-cols-7 xl:gap-2` with `grid-cols-7` resolving to `repeat(7, minmax(0,1fr))`, the
card is `rounded-card bg-card shadow-soft`, the columns share one grid row and no height is set — so
they already stretch to equal height — and the chips are already mint and peach. **A plan that did not
know this would rewrite working code to arrive where it already is.**

**§ 3.4 is wrong, and it is the one correction this plan makes to the shell.** It says the card radius
is *"A token value, not a layout. Free."* It is not free: **`rounded-card` is shared**, used by
`src/components/AuthCard.tsx` (UIE-01's sign-in card), `src/components/Sidebar.tsx` (UIE-02's shell)
and `WeekView.tsx`. Moving `--radius-card` from 26px would repaint the auth screen and the sidebar,
both out of scope under § 7.4. **This is the same class of collision `src/index.css:117-123` already
records for `--radius-lg`**, one token over. § 4.4 resolves it without touching `index.css` at all.

**Two measurements decide what is *not* in `allowed_paths`:**

- **`tests/e2e/cal-05-week-view.spec.ts:145-146` assert `toContainText("Monday")` and `("Sunday")`.**
  `toContainText` is a substring test, so `Mon` would **not** satisfy it — abbreviating the weekday
  costs the two-line spec edit § 3.2 predicts. § 4.3 keeps the full name and the file stays out.
- **No spec asserts the star**, and `week-row-approver` is asserted only by
  `toContainText(ADMIN_NAME)` at `:216` and by `toHaveCount` at `:229` and `:239`. So the star may
  move out of that element and the assertions hold.

## 1. Problem and scope

The feature ID this plan implements, transcribed from `.ai/registry/features.md:153` without
paraphrase:

| ID | Capability | Group | Status | Invariants touched |
|---|---|---|---|---|
| UIE-05 | The week column fills the viewport, and its header strip and entry chip are restacked | UIE | PLANNED | [] |

**No role gains a capability**, and this ticket exists hours after UIE-04 shipped the same screen
because the operator looked at the result and drew a different one. **The defect it answers is already
written into the file it governs.** `WeekView.tsx:39-46` records the arithmetic UIE-04 decided
against: at ~161px a column, a chip is 90–110px, one member may hold an `am` **and** a `pm` entry on
one date, so sixteen chips is ~1520px of content in ~910px of body. What a person meets is that **one
crowded Wednesday pushes the rest of the week below the fold, and the four-fifths of every quiet
column that is white space goes down there with it** — on a screen whose whole purpose is seeing the
shape of a week at once. A member gains a week that looks like a week when it is quiet, and behaves
exactly as UIE-04 promised when it is busy.

**Out of scope.** The first three are the ones this ticket would cross by accident, and each is an
amendment to a registry row rather than a layout choice.

1. **The footer absence count, and any approximation of it — including the day's own chip count.**
   ADR-029 is `PROPOSED` and awaiting the operator; this is behaviour, the § *Visual specification*
   grant does not reach it, and CAL-05's registry row plus UIE-04's shipped AC-13 both say this screen
   renders no number. **A day holding one full-day and two half-day entries has three chips and an
   absence count of two** — the second definition INV-04 forbids, reached without opening
   `absence.ts`. UIE-04 refused that substitute and the refusal stands.
2. **Deleting any of the five facts the chip carries**, or collapsing the type label to `PTO`/`WFH`.
   Each is load-bearing: the portion pill is INV-06's only visible surface, the note is CAL-05 AC-6,
   the word `Tentative` is AC-9's accessible half, `Approved by <name>` is CAL-05's registry row —
   *who* approved is the whole of v1's audit answer, and a bare star says only that somebody did —
   and `Leave`/`Working from home` is OPS-002 AC-7, which requires every screen naming a type to say
   the member is **working**. **UIE-04 refused exactly this as its Option 2, even behind an expand
   where the information still existed; the image deletes it outright.**
3. **Deleting the empty-state sentence.** `week-day-empty` keeps its element, its selector and its
   words. It may be de-emphasised — smaller, lighter, muted — and its words may **not** become a dash
   or a glyph. It is what stops *"an ordinary Tuesday"* and *"we did not look"* being the same column,
   and it is **coupled to item 1**: a footer reading `0/4` would remove the ambiguity the sentence
   exists to remove, so the deletion follows from the count and must be decided with it or not at all.
4. **Translating any copy into Vietnamese.** Every string in the image is Vietnamese — `T2`…`CN`,
   `vắng`, the legend, the buttons. It reverses `.ai/standards/ui-design-system.md:46-48`, the
   operator's own instruction of 2026-09-03; it is lint-enforced; `ui-language.json` has
   `copyDebt: []` — the sweep is finished and that list only ever shrinks; and UIE-01 already refused
   the identical request.
5. **The shell.** `Sidebar.tsx`, `TopBar.tsx`, `AppShell.tsx`, `App.tsx`. That covers the
   `Quá tải (>50%)` legend row, the `▾` after the period title, the palette and sign-out icon
   buttons, the `Quản trị & Duyệt` pill and the floating `?` button. **The trap is the one UIE-04
   named**: this ticket owns the grid, so adjusting a sidebar swatch to match a column it just
   restyled will feel like finishing the job.
6. **The 1280px breakpoint and the stacked layout below it.** UIE-04 originated both; the image shows
   one desktop width and says nothing about narrow ones. **Silence is not removal** — § 4.2's
   min-height applies only where columns exist.
7. **Changing `--radius-card`, or any shared token.** § 0 and § 4.4.
8. **The month and year views**, and **`src/lib/fixtures.ts`** — nothing here makes the image's eight
   names real.
9. **Dark mode**, stated rather than left silent.

`size_estimate: S`. One component's layout, with half the target property already shipped.

## 2. Acceptance criteria

**AC-1 — a quiet week fills the pane**
- Given a signed-in member on a week route at 1280px wide or wider, in a week where no day holds
  enough entries to fill a column
- When it renders
- Then every one of the seven columns reaches the bottom of the visible pane, so the row of columns
  has a straight bottom edge and no band of background shows beneath it

**AC-2 — a busy week still behaves as UIE-04 requires**
- Given a week in which one day holds more entries than fit the pane's height
- When it renders in the seven-column layout
- Then every entry on that day is reachable by scrolling the page, no column has a scrollbar of its
  own, nothing is clipped, and the other six columns scroll with it so the seven stay in horizontal
  register

**AC-3 — the seven columns are the same height as each other, in both cases**
- Given any week at 1280px or wider
- When it renders
- Then all seven columns are the same height, whether that height is the pane's or the busiest day's

**AC-4 — the header strip is centred and separated from the body**
- Given any day column
- When its header renders
- Then the weekday and the date are centred, the date sits beneath the weekday, and a hairline rule
  separates the strip from the entries below it

**AC-5 — the weekday is named in full and in English**
- Given the column for a Monday and the column for a Sunday
- When their headers render
- Then they read `Monday` and `Sunday` respectively, each still addressable as `week-day-label`

**AC-6 — the date is in the short numeric form**
- Given the column for 14 September 2026
- When its header renders
- Then the date is shown as `14/09`, in the same `week-day-label` element and beneath the weekday

**AC-7 — the chip is a stack, not a wrapping row**
- Given a day holding an entry
- When its chip renders
- Then the member's avatar appears as a circular bubble at the left of the first line, the member's
  name is on that same line, and the entry's type label is on a second line beneath the name rather
  than trailing the name on the same line

**AC-8 — an approved entry carries a star beside the name**
- Given an approved entry
- When its chip renders
- Then a star appears immediately after the member's name on the first line

**AC-9 — every one of the five facts is still on the chip at rest**
- Given an entry that is tentative, carries a note, and has been approved
- When its chip renders, with no hover, click or expansion
- Then all five are present and addressable: `week-row-type` carrying `data-type`,
  `week-row-portion` carrying `data-portion`, `week-row-tentative`, `week-row-note`, and
  `week-row-approver` carrying `data-approver-id` and naming who approved

**AC-10 — one row per entry, never per member**
- Given a member holding both a morning and an afternoon entry on the same date
- When that day renders
- Then it shows two `week-row` elements, each with its own `data-entry-id`, carrying the same
  `data-member-id`

**AC-11 — CAL-08's shading survives unchanged**
- Given a week containing a non-working holiday, a mandated working Saturday and a bridge day
- When it renders
- Then each `week-day` still carries `data-day-status` and `data-bridge` with the values it carried
  before; the holiday's name still renders as `week-day-holiday` carrying `data-kind`; the bridge day
  still renders `week-day-bridge` as an outlined badge with no fill and no `week-day-holiday`; and the
  lavender tint still applies to the day heading only and only for a non-working holiday

**AC-12 — a quiet day still says so, in words**
- Given a week in which nobody is away
- When it renders
- Then all seven columns show `week-day-empty` carrying a sentence, which may be smaller or lighter
  than before but is not replaced by a dash, a glyph or a number

**AC-13 — the tentative marking survives in both forms**
- Given a tentative entry
- When its chip renders
- Then it carries a dashed border at reduced opacity **and** the word `Tentative` in
  `week-row-tentative`

**AC-14 — the screen still counts nothing**
- Given any week, empty or full
- When it renders
- Then no element displays a count of absences, a total, a proportion or a threshold, and the screen
  makes no team read

**AC-15 — the empty-week card survives**
- Given a week in which nobody is away, at 1280px or wider
- When it renders
- Then `week-empty-card` is present over the columns

**AC-16 — nothing shared is repainted**
- Given the sign-in card and the shell's sidebar
- When they render after this change
- Then their corner radius, background and shadow are exactly what they were before it

**AC-17 — no selector is renamed or removed, and no test changes**
- Given the week view's selectors and data attributes before this change
- When the same screen is read after it
- Then every one is present with the same name on an element playing the same role, and the whole
  unit and end-to-end suite passes with no edit to any test file

**AC-18 — no string becomes Vietnamese**
- Given `src/` after this change
- When the lint command runs
- Then it exits 0, with no file added to `copyDebt`

**Invariants touched: `[INV-04, INV-06]`.** § 6 of `ticket.yaml` instructs PLAN to look rather than
copy, and looking gives two rather than the `[]` its own first reading proposes.

- **INV-04** — *no second definition of the absence count exists anywhere in the system.* This ticket
  **adds no number**, so UIE-04's first reason for listing it does not repeat. **Its second reason
  applies unchanged**: this ticket rewrites the presentation of the exact set that count sums, and the
  tempting space-saving in a 161px column is merging a member's morning and afternoon entries into one
  chip — after which the week list disagrees with the month cell for that date. AC-10 forbids it in
  the terms the file already uses.
- **INV-06** — *an entry carries exactly one portion, and that portion applies to every date in its
  range.* **The portion pill is the product's only visible surface for this invariant**, and this
  ticket moves it. A five-day `pm` entry renders five afternoons, and the pill is how a reader sees
  that it is not five whole days. Dropping or merging it — which is what the image does — would make
  INV-06 invisible on the one screen that shows it. AC-9 keeps it, at rest, with `data-portion`.

INV-01, INV-02, INV-03, INV-05 and INV-07 are properties of stored entries and their members. This
ticket writes nothing, reads nothing new, makes no seam call it did not make before, and changes no
arithmetic.

**Open questions.**

1. **Whether a min-height resolves through this exact `flex-1` / `min-h-0` / `overflow-y-auto` chain,
   or needs an explicit `calc(…)`, cannot be settled from the source.** It needs a rendered viewport,
   which PLAN has no more access to than triage did. § 4.2 states the **property** and names the
   likely declaration; the Developer measures. It changes one declaration and no conclusion.
2. **A chip carrying five facts will be two or three lines tall, not the image's ~44px.** Those two
   are not simultaneously satisfiable, and § 4.5 chooses the facts. The image's density is
   approached, not reached.
3. **The image's sidebar shows eight members under five different team subtitles**, which contradicts
   INV-07 and the charter's one-team scope. The sidebar is out of scope so nothing acts on it; it is
   recorded in `design/README.md` § 4.1 and in `ticket.yaml` § 8, and it belongs to no ticket.
4. **After this ticket the day column and the auth card have different corner radii.** § 4.4 accepts
   that deliberately rather than move a shared token; if the product later wants one card shape, that
   is a token decision with more than one consumer and a standard behind it.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**This is the accurate line even though `design/README.md` exists**, for the fourth time in this
group and for the same reason: an image was shown in conversation on 2026-09-07 and **was never on
disk**, so `product` wrote a hand transcription at the canonical path because there was no file to
move. `.ai/standards/ui-design-system.md:115-119` describes moving an attached file; nothing was
attached in the sense that section means. **No second image was handed to `/plan`**, which
`ticket.yaml` requires and which is satisfied.

**It is a different image from the one UIE-02, UIE-03 and UIE-04 were built against**, and that is
why this screen is being drawn twice in one day.

**What the transcription gives, this plan takes**: columns that fill the viewport, a centred header
strip with a hairline and a short numeric date, a two-line chip with a circular avatar bubble and a
star beside the name, and a smaller corner radius.

**What it asks for and this plan refuses**, each with its reason in § 1: the footer count, the five
facts the chip drops, the empty-state sentence, and the Vietnamese.

**What it is silent about and this plan keeps anyway** — § 4.6 — because **silence is not removal**:
the holiday name, the bridge badge, the lavender tint, the tentative dashed border and the empty-week
card. The image shows no holiday and no bridge day at all, and its header has no room drawn for
either, which is precisely where they go.

## 3. Permission model

**Nothing changes.** This ticket re-lays-out one component: no control is added, no guard moved, no
seam function called that was not called before, and no data read that was not read before.

| Action | Who | Where the check lives | Changed here |
|---|---|---|---|
| Read the team's entries for a week | member | row-level select policy on `entry` (ADR-005) | no |
| Read the team's holidays | member | row-level select policy | no |
| Reach the week route with no session or no member row | anybody | the screen's own refusal states | no |

**The refusal states are what a layout rewrite breaks by deletion.** `week-loading`,
`week-not-on-a-team`, `week-sign-in` and `week-unavailable` render *instead of* the grid and sit
outside it; UIE-02's `BareLayout` exists so a member-less or signed-out caller still reaches them.
AC-17 keeps all four, and none is inside the container this ticket changes.

**One line worth a reviewer's attention, because it is a permission fact in the shape of a chip.**
`week-row-note` and `week-row-approver` are readable by the whole team, which follows from
`entry_select_team` being a row-level select policy rather than from any decision this screen takes.
Demoting them to a secondary line changes how prominent they are and not who may read them.

## 4. Contract

No seam function changes, no component gains a prop, no new file, and nothing outside
`src/routes/WeekView.tsx` is opened.

### 4.1 What is already true and is not rebuilt

Seven equal columns at `xl:grid xl:grid-cols-7 xl:gap-2`; `grid-cols-7` is `repeat(7, minmax(0,1fr))`,
so the tracks are equal and each may shrink below its content; the columns share one grid row with the
default `align-items: stretch` and no height is set, **so AC-3 is already satisfied and stays
satisfied by leaving it alone**; the card is `bg-card` with `shadow-soft`; the chips are mint and
peach; Monday is first.

### 4.2 AC-1 — the column fills the pane, by `min-height` and never by `height`

**The property**: the grid is at least as tall as the visible content pane, and free to grow past it.

`height` or a fixed `h-*` would clip a busy column or introduce a second scroller, which reverses
UIE-04 AC-4 and AC-5. **`min-height` reverses UIE-04's *prose* and neither of its acceptance
criteria** — a column at least the pane tall, free to grow, renders the image on a quiet week and
behaves exactly as AC-4 and AC-5 require on a busy one. § 8 states that reversal in one line, which
`ticket.yaml` § 3.1 requires and which is the honest form of doing the opposite of a shipped ticket's
stated decision.

**The declaration is the Developer's to measure** (*Open questions* item 1). The chain is
`AppShell.tsx`'s `flex min-h-0 flex-1` row → the pane's `flex min-w-0 flex-1 flex-col overflow-y-auto`
→ `TopBar` at `h-[70px] shrink-0` → `<div className="min-w-0 flex-1 px-6 pb-6">` → this screen. A
percentage min-height resolves only if every ancestor has a definite height; if it does not, the
fallback is a viewport-relative `calc(…)` subtracting the top bar and the pane's padding. **Whichever
is used must introduce no second scroller and must apply only at `xl` and above**, because below the
breakpoint there are no columns to fill.

### 4.3 AC-4 to AC-6 — the header strip

Today it is `-mx-4 -mt-4 mb-2 flex flex-wrap items-baseline gap-2 rounded-t-card px-4 py-2 text-sm
font-semibold`, left-aligned, carrying the full weekday name and the raw `yyyy-MM-dd` date side by
side. It becomes:

- **centred**, with the weekday on the first line and the date beneath it — a stack rather than a
  wrapping row, which is what makes a centred two-part label read as one label at 161px;
- **the date as `dd/MM`** — `14/09` — derived from the `yyyy-MM-dd` the component already holds. No
  date library, no locale, no new import: § *Language* governs strings and the idea's open question 4
  put formats outside it, so this is a slice and a join;
- **a hairline beneath the strip**, `border-b` in `--color-line`, which is the token UIE-01 shipped
  for exactly this and is already used by the shell;
- **the full weekday name kept**, in English. `T2`/`CN` is Vietnamese and refused (§ 1 item 4); `Mon`
  is available and is layout, **but it breaks `cal-05-week-view.spec.ts:145-146`, whose
  `toContainText("Monday")` is a substring test.** Keeping the full name is free and keeps every spec
  file out of `allowed_paths`. **§ 3.2 of `ticket.yaml` asks PLAN to say which it did: it kept the
  full name.**

**`week-day-holiday` and `week-day-bridge` stay inside this element**, on a line below the date, which
is the room the image does not draw because it shows neither.

### 4.4 The corner radius — `rounded-2xl`, and **not** a change to `--radius-card`

**`rounded-card` (26px) is shared**: `AuthCard.tsx`, `Sidebar.tsx` and `WeekView.tsx`. Moving
`--radius-card` would repaint UIE-01's sign-in card and UIE-02's sidebar — AC-16 forbids it, § 7.4
forbids the second outright, and `src/index.css:117-123` already records this exact class of collision
one token over.

**So the day column and its header take `rounded-2xl` / `rounded-t-2xl` (16px), a Tailwind built-in,
and `src/index.css` is not opened.** A new `--radius-day` token was considered and rejected: a token
is how a value gets more than one consumer, this has one, and adding a file to hold a corner radius
buys nothing the utility does not. If a second consumer appears, that is when it becomes a token —
with a standard behind it, which is a human's.

**The mascot card at `week-empty-card` keeps `rounded-card`.** It is a card in UIE-01's sense, not a
day column, and AC-15 asks only that it survive.

### 4.5 AC-7 to AC-9 — the chip, restacked with all five facts kept

Today: one wrapping flex row of seven children, with the note and the approver forced onto their own
lines by `basis-full`. It becomes a deliberate three-row stack inside the same `week-row` element,
with the same seven children and the same selectors:

| Row | Holds |
|---|---|
| 1 | the avatar as a **circular bubble** (`week-row-avatar`), then `week-row-name`, then the star when approved |
| 2 | `week-row-type` and `week-row-portion` |
| 3, only when non-empty | `week-row-tentative`, `week-row-note`, `week-row-approver` — smaller and at reduced weight |

**The star moves; it is not added.** It exists today *inside* `week-row-approver`, which renders
`★ Approved by <name>`. It moves to the first line beside the name, and **`week-row-approver` keeps
`data-approver-id` and the words `Approved by <name>`** — which is what `cal-05:216`'s
`toContainText(ADMIN_NAME)` asserts, and what CAL-05's registry row is about: a bare star says
somebody approved, and the product's entire audit answer is *who*. `CLAUDE.md` § *Visual direction*
asks that approved entries carry a small star, and this is where it becomes visible at a glance.

**Row 3 is demotion, not disclosure.** Every element renders at rest, with no hover, click or
expansion — AC-9. UIE-04 refused hiding them even behind an expand; this reproduces the image's
silhouette and its density without amending anything.

**It will be two or three lines tall rather than the image's ~44px**, and *Open questions* item 2
records that as chosen rather than missed.

### 4.6 What the image is silent about and this ticket keeps

`week-day-holiday` with `data-kind`; `week-day-bridge` as an outlined badge with no fill; the lavender
tint on the day heading only and only for a non-working holiday; the tentative dashed border at
reduced opacity; `week-day-empty` with its sentence; `week-empty-card`. **Dropping the bridge badge
because a 161px column has no room for it would reverse CAL-08's own decision that a bridge day is a
working day**, which is a feature-row amendment and not a layout call.

## 5. Seam impact

**None.** No function in `src/lib/data/` is added, removed, renamed or changed, and
`tests/seam-parity.test.ts` is untouched. The screen makes exactly the calls it makes today —
including the one it does not make: `seam.getTeam()` stays uncalled, which AC-14 asserts from the
outside. `src/lib/data/absence.ts` is not opened, so INV-04's single implementation is untouched and
this ticket adds no second one.

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint, no column; nothing under `supabase/` is
opened. ADR-014 does not engage. Every file in scope sits above the data seam.

`requires_adr: false`, and § 1 is what keeps that honest rather than merely unflipped: the three
changes that would have needed a human — rendering the footer count, deleting any of the chip's five
facts, and deleting the empty-state sentence — are each refused, so the stop-and-ask `ticket.yaml`
arms does not fire. ADR-029 remains `PROPOSED` and this ticket does not depend on its outcome.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-05/**"
  - "src/routes/WeekView.tsx"
```

**One file outside the ticket folder. `size: S`** — `.ai/01-operating-model.md:372` puts S at up to
six. **`size_estimate` and `size` agree at S**, so ADR-012 never engages. `ticket.yaml` deliberately
withheld triage's proposed S so that PLAN would measure rather than inherit it; measured, it is S, and
it is S for a reason triage could not have known — § 0's finding that half the target property is
already shipped.

**Both conditional files named in § 2 are out, and each for a measured reason rather than a judgement:**

- **`tests/e2e/cal-05-week-view.spec.ts`** would enter only if the weekday were abbreviated.
  `:145-146` use `toContainText`, so `Mon` fails where `Monday` passes. § 4.3 keeps the full name and
  the file stays out. Nothing else in that file is layout-dependent: it addresses days by
  `[data-testid="week-day"][data-date=…]`, rows by `data-member-id` and `data-entry-id`, and asserts
  `week-day-empty` by count.
- **`src/index.css`** would enter only if the radius needed a token. § 4.4 uses a Tailwind built-in on
  the one element that wants it, because moving the shared `--radius-card` would repaint the auth card
  and the sidebar.

**`tests/e2e/cal-08-holiday-shading.spec.ts` was never a candidate and is confirmed out**: every
assertion it makes on this screen is `toHaveAttribute`, `toHaveText` or `toHaveCount`, and § 4.6 keeps
all of them true.

## 8. Rejected alternatives

**1. Set a fixed height on the column instead of a min-height.** The literal reading of the image,
which shows a crisp bottom edge, and the simplest declaration. **Rejected because it reverses UIE-04
AC-4 and AC-5 rather than its prose.** A fixed height either clips a busy column or gives it a
scrollbar of its own, and seven independent scrollers put the days out of horizontal register — after
which a day whose entries all sit below its own fold reads as a quiet day, which is the opposite of
what this screen is for. **This plan reverses UIE-04's stated prose decision that the columns do not
fill the viewport, and reverses neither of its acceptance criteria**; that sentence is the one
`ticket.yaml` § 3.1 requires and it is stated here rather than left to be discovered in a diff.

**2. Build the image's chip — avatar, name, star, type code, and nothing else.** It is what the
operator drew, it reaches the image's ~44px, and it makes seven columns genuinely dense. **Rejected
because every one of the five things it drops is load-bearing and dropping any of them amends a
registry row**: the portion pill is INV-06's only visible surface, the note is CAL-05 AC-6, the word
`Tentative` is AC-9's accessible half for a reader who cannot see a dashed border, `Approved by
<name>` is CAL-05's registry row and v1's only audit answer, and `PTO`/`WFH` in place of
`Leave`/`Working from home` reverses OPS-002 AC-7, which exists so that no screen naming a type
implies a WFH member is away. **UIE-04 refused this same trade as its Option 2 even behind an expand,
where the information still existed.** § 4.5 takes the silhouette and keeps the facts.

**3. Change `--radius-card` to 16px so the whole product shares the image's radius.** One value, one
file, and it makes the day column exactly right. **Rejected because that token is shared with
`AuthCard.tsx` and `Sidebar.tsx`**, so it would silently restyle the sign-in screen and the shell —
UIE-01's and UIE-02's, both shipped, both out of scope, and neither reviewed against this image. It is
the same collision `src/index.css:117-123` records for `--radius-lg`, which is why that comment
exists. The cost is accepted and named in *Open questions* item 4: two card shapes in one product
until somebody decides otherwise with a standard behind it.

**4. Abbreviate the weekday to `Mon`…`Sun` to buy width.** The image abbreviates, the column is
161px, and a centred two-line header is tight. **Rejected because it buys very little and costs a spec
file.** `cal-05:145-146` assert `toContainText("Monday")`, so the change pulls that file into
`allowed_paths` for two lines — and the image's own abbreviations are `T2`…`CN`, which are Vietnamese
and refused on their own terms, so there is no version of this that is faithful to the image anyway.
Stacking the date beneath the weekday recovers the width the abbreviation would have.

## Changelog

- `2026-09-08T08:12:05+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-08T08:12:05+07:00` — **`invariants_touched` set to `[INV-04, INV-06]`, and § 3.4 of
  `ticket.yaml` corrected.** § 6 of that file proposes `[]` as the honest first reading and instructs
  PLAN to look rather than copy; looking gives two. INV-04 repeats UIE-04's *second* reason unchanged
  — this ticket rewrites the presentation of the set the count sums — and **INV-06 is engaged because
  the portion pill is its only visible surface and this ticket moves it**, which is the failure mode
  the image walks straight into. **The correction is § 3.4's "the card radius … a token value, not a
  layout. Free."** Reading `src/` showed `rounded-card` has three consumers, two of them out of scope,
  so it is not free; § 4.4 uses a Tailwind built-in instead and `src/index.css` stays out of § 7.
  **No AC was reshaped to fit what was easy to build**: AC-9 is the one that costs the most and it is
  the one the image argues against. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
