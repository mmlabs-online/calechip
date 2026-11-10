---
ticket: UIE-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-07T15:54:51+07:00
inputs_read:
  - .ai/board/tickets/UIE-04/ticket.yaml
  - .ai/board/tickets/UIE-04/design/README.md
  - .ai/board/tickets/UIE-02/design/README.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - .ai/01-operating-model.md
  - src/routes/WeekView.tsx
  - src/components/AppShell.tsx
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/index.css
  - src/lib/fixtures.ts
  - tests/e2e/cal-05-week-view.spec.ts
  - tests/e2e/cal-07-overload-warning.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-04 — the week view as seven day columns

## 0. What was measured here rather than inherited

`ticket.yaml` § 2 leaves two spec files as "POSSIBLY" in scope and tells PLAN to check. Checked, in
this tree, after UIE-03 merged:

- **`cal-07-overload-warning.spec.ts` addresses no week-view selector at all.** Every id it uses is
  `new-entry-*`, `edit-entry-*`, `own-entry*`, `home-*` or `app-session-loading`. **Out of scope.**
- **`cal-08-holiday-shading.spec.ts` addresses `week-day`, `week-day-holiday` and `week-day-bridge`
  directly** — the cells whose container this ticket rewrites. But every assertion on them is
  `toHaveAttribute`, `toHaveText`, `toHaveCount` or `textContent()`. **None depends on layout,
  position or viewport.** Preserve the ids and attributes and the file needs no edit.
- **`cal-05-week-view.spec.ts` is the same shape.** It addresses days by
  `[data-testid="week-day"][data-date=…]`, rows by `data-member-id` and `data-entry-id`, asserts
  `week-day` has count 7, and reads their `data-date` values in **document order** (`:130`). A
  seven-column grid keeps Monday-to-Sunday DOM order, so that passes too. Its three `toBeVisible()`
  calls are on `week-anchor` and `home-sign-out` — both now the shell's — and on
  `week-row-tentative` at `:227`, which Playwright counts as visible whenever it has a box, whether
  or not it is scrolled into view.

**So no test file is in scope, and that is a result rather than an assumption.** § 7 is one source
file. It is also the reason § 3's chosen option had to be one that renames nothing: the moment a
selector moves, three spec files arrive with it.

**Two arithmetic corrections, both small and both in the same direction.** The sidebar is **216px**,
not the 215 § 3 assumes (`Sidebar.tsx:136`), and the content pane adds `px-6` — 48px
(`AppShell.tsx`). At 1440px: 1440 − 216 − 48 = 1176, less six 8px gutters = 1128, **≈161px per
column**, not 168. § 3's conclusion is unchanged and slightly strengthened.

**One thing § 3 asks for that cannot be produced here.** Its `TODO(verify)` wants the wrapped column
header measured at that width; that needs a rendered viewport and PLAN has no more access to one than
triage did. It is carried forward as *Open questions* item 3. It makes the overflow worse, never
better, so no conclusion below turns on it.

## 1. Problem and scope

The feature ID this plan implements, transcribed from `.ai/registry/features.md:152` without
paraphrase:

| ID | Capability | Group | Status | Invariants touched |
|---|---|---|---|---|
| UIE-04 | The week view as seven day columns | UIE | PLANNED | [] |

**No role gains a capability**, and this is the last of the four tickets from one idea. UIE-01 gave
the product a palette and a face, UIE-02 gave it a shell, UIE-03 removed the chrome the shell made
redundant, and **this ticket is the grid itself**. A member looking at a week stops reading a
vertical list of seven headed sections and starts reading seven columns side by side, so a week is
one glance rather than one scroll — which is the whole reason the screen exists.

**Out of scope.** Every item is a decision, and the first three are the ones this ticket would
otherwise take by accident.

1. **Any absence count, anywhere on this screen — including the mockup's `0/8 vắng` footer strip.**
   § 4.1 is the argument; it is the single most consequential *omission* in this plan and it is not
   a layout choice.
2. **The `Quá tải (>50%)` legend row.** It needs `overloadThreshold`, which comes from the
   `seam.getTeam()` call this screen deliberately does not make. Behaviour, not visual arrangement,
   and it would reverse a decision in CAL-05's registry row.
3. **Re-deciding any of CAL-08's holiday shading.** It is shipped behaviour this ticket must carry
   through the rewrite unchanged: do not re-decide which days are lavender, do not tint the rows
   below the heading, and do not give a bridge day a fill — a bridge day is a *working* day and that
   is CAL-08's decision, not this ticket's.
4. **The shell.** `App.tsx`, `AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx` and `useRoster`. The trap
   here is the opposite of UIE-03's: this ticket owns the grid the lavender is drawn on, so the
   temptation is to adjust the sidebar's legend swatch to match a column heading it just restyled.
   That is still a shell edit.
5. **The `Vui`/`Gọn` density toggle.** This is the one ticket where adding it would look justified —
   density is a grid property and this is the grid. It is still out: § *Direction* and
   § *Components* in `.ai/standards/ui-design-system.md` are bare stubs, so the toggle is named in
   one file and specified in none, and what a control *does* is behaviour.
6. **The `Duyệt phép` button, the palette icon and the `?` button.** Shell controls, none
   corresponding to a decision taken anywhere.
7. **The month and year views.** The transcription shows neither and their layouts are untouched.
8. **`src/lib/data/absence.ts`.** Three shipped consumers use one implementation and nothing here
   opens that file. See § 2's invariant note.
9. **Translating any copy into Vietnamese.** The transcription's `0/8 vắng`,
   `Chưa ai đăng ký tuần này.`, `+ Đăng ký ngay`, `Nghỉ phép (PTO)` and `Làm ở nhà (WFH)` are all
   Vietnamese; § *Language* is lint-enforced and `copyDebt` is empty. **The empty-state mascot is the
   trap**: it is new copy, it is charming, and it is the one string here a developer would write from
   the transcription rather than from the file.
10. **A second create control.** The transcription's `+ Đăng ký ngay` inside the mascot card is a
    link to `/entries/new`, and `home-new-entry-link` already sits in the top bar on every route.
    A second control to one address either duplicates an id — the strict-mode failure UIE-02 § 4.8
    refused — or gives the product two names for one destination. AC-12 says the card carries no
    link.
11. **The fixtures.** The mockup's roster of eight is fictional: `src/lib/fixtures.ts` holds four
    members on the main team who have not been removed. `TEAM (8)` and `0/8 vắng` cannot be produced
    from this repository, so nothing may be asserted from them.
12. **Dark mode**, stated rather than left silent.

`size_estimate: S`. One component's layout, no new dependency, no seam call, no selector renamed.

## 2. Acceptance criteria

**AC-1 — seven columns on a wide viewport**
- Given a signed-in member on a week route, in a viewport 1280px wide or wider
- When the week renders
- Then the seven days are laid out as seven columns of equal width, side by side, in Monday-to-Sunday
  order left to right, each separated from the next by a visible gutter

**AC-2 — the shipped stacked layout below that width**
- Given the same member in a viewport narrower than 1280px
- When the week renders
- Then the seven days are stacked vertically, one full-width block per day, in the same
  Monday-to-Sunday order

**AC-3 — every day is present at both widths**
- Given any viewport width
- When the week renders
- Then exactly seven day elements are present, one per date of the week, each addressable as
  `week-day` carrying its `data-date`

**AC-4 — a column is as tall as its content and no column scrolls on its own**
- Given a week in which one day holds more entries than fit the viewport height
- When the week renders in the seven-column layout
- Then every entry on that day is reachable by scrolling the page vertically, no day column has a
  scrollbar of its own, and no entry is clipped or hidden

**AC-5 — the whole week stays legible as one week**
- Given the same overfull week
- When a member scrolls to read the busiest day
- Then the other six days scroll with it, so the seven columns stay in horizontal register and no
  day can be scrolled out of alignment with the others

**AC-6 — the column header names its day**
- Given the seven-column layout
- When a column renders
- Then its header carries the weekday name and the date, addressable as `week-day-label`, at the top
  of the column and above its entries

**AC-7 — every entry keeps its whole chip**
- Given a day with an entry that has a note and an approver
- When the column renders it
- Then the chip shows the member's avatar and name, the entry's type and portion, the tentative
  marker when tentative, and the note and the approver — each still addressable as `week-row-avatar`,
  `week-row-name`, `week-row-type`, `week-row-portion`, `week-row-tentative`, `week-row-note` and
  `week-row-approver`, with none of them behind an expand or a hover

**AC-8 — one row per entry, never per member**
- Given a member holding both a morning and an afternoon entry on the same date
- When that day renders
- Then it shows two `week-row` elements, each carrying its own `data-entry-id`, and the same member's
  `data-member-id` on both

**AC-9 — CAL-08's holiday shading survives the rewrite unchanged**
- Given a week containing a non-working holiday, a mandated working Saturday and a bridge day
- When the week renders
- Then each `week-day` still carries `data-day-status` and `data-bridge` with the same values as
  before this change; the holiday's name still renders as `week-day-holiday` carrying `data-kind`;
  the bridge day still renders `week-day-bridge` and no `week-day-holiday`; the lavender tint still
  applies to the day heading only and only for a non-working holiday; and a bridge day still has no
  fill

**AC-10 — a quiet day says so, in every column**
- Given a week in which nobody is away
- When it renders
- Then all seven days show their own empty state, each addressable as `week-day-empty`

**AC-11 — an empty week is charming rather than blank**
- Given a week in which nobody is away, in the seven-column layout
- When it renders
- Then a single card is shown over the columns, carrying a mascot and one sentence in English saying
  nobody has booked this week, in addition to the seven per-day empty states of AC-10

**AC-12 — the empty-state card carries no control**
- Given the card of AC-11
- When it renders
- Then it contains no link and no button, and the only create control on the screen remains the one
  the shell's top bar renders

**AC-13 — the screen still counts nothing**
- Given any week, empty or full
- When it renders at either width
- Then no element on it displays a count of absences, a total, a proportion or a threshold, and the
  screen makes no team read

**AC-14 — no selector is renamed or removed, and no test changes**
- Given the week view's selectors and data attributes before this change
- When the same screen is read after it
- Then every one is present with the same name on an element playing the same role, and the whole
  unit and end-to-end suite passes with no edit to any test file

**AC-15 — nothing scrolls sideways**
- Given any viewport width from 360px upward
- When the week renders
- Then the page does not scroll horizontally

**AC-16 — no string becomes Vietnamese**
- Given `src/` after this change
- When the lint command runs
- Then it exits 0, with no file added to `copyDebt`

**Invariants touched: `[INV-04]`.** This departs from the `[]` that ADR-028 predicts for almost every
UIE row, and `ticket.yaml` § 6 is right that this is the row most likely to be the exception.

**INV-04** — *the absence count for a date is the sum, over that date's pending and approved entries
whose member was still on the team on that date, of 1 per `full` portion and 0.5 per `am` or `pm`,
with PTO and WFH counted alike; no second definition of this number exists anywhere in the system.*
This ticket engages it twice and satisfies it twice, and neither is automatic:

- **It adds no count** (AC-13), so no second definition is created. § 4.1 records the count this
  ticket was invited to add and why a chip count would have been a *different* number wearing the
  same name.
- **It rewrites the presentation of the exact set that count sums**, which is why CAL-05's own row
  lists INV-04. A week list that disagreed with a month cell is the divergence the invariant
  forbids — and the tempting space-saving at 161px is exactly the one that would cause it: merging a
  member's morning and afternoon entries into one chip. AC-8 forbids it in the terms the file
  already uses.

No other row is engaged. INV-01, INV-02, INV-03, INV-05, INV-06 and INV-07 are properties of stored
entries, and this ticket writes nothing, reads nothing new, and changes no arithmetic — `absence.ts`
is not opened and the screen makes the same seam calls it makes today.

**Open questions.**

1. **1280px is originated here and is the number most worth arguing with.** At it a column is ~138px
   and at 1440px ~161px; below it the stacked layout. Nothing in the repository states a breakpoint —
   `.ai/standards/ui-design-system.md:165` is a bare `TODO(project)` for exactly this — so this is
   the first one the product has, and a later screen will inherit it by copying rather than by
   reading a standard.
2. **The seven-column layout is not obviously better than the stacked one on a busy week, and this
   plan ships it anyway.** § 8's first rejected alternative is *doing nothing*, argued seriously.
   AC-4 and AC-5 are what keep the worst case merely tall rather than unreadable.
3. **The wrapped column header's height at ~161px is still unmeasured** — `ticket.yaml` § 3's
   `TODO(verify)`, inherited rather than answered, because it needs a rendered viewport. It makes a
   full column taller, never shorter, so AC-4's "the page scrolls" is the behaviour that absorbs it.
4. **Whether the mascot card should also appear in the stacked layout is unstated.** AC-11 requires
   it only in the seven-column layout, where the transcription puts it. Below the breakpoint the
   seven per-day empty states are already the whole screen and a card over them has nothing to float
   over.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**Same as the three tickets before it.** No image exists at `.ai/board/tickets/UIE-04/design/`; that
folder holds a `README.md`, a hand-written transcription pointing at UIE-02's canonical copy of one
image shown in conversation on 2026-09-05 that was never on disk.

**What the transcription gives, this plan takes**: seven equal columns filling the width beside the
sidebar, ~8px gutters, each a white rounded card with a soft shadow, a header strip carrying a bold
weekday then a lighter date, and a mascot card over the columns when the week is empty.

**What it asks for and this plan refuses**, each with its reason in § 1's *Out of scope*: the
`0/8 vắng` footer strip (§ 4.1), the Vietnamese copy, the `+ Đăng ký ngay` link, and the roster of
eight.

**The one property the transcription cannot justify, and the substance of this ticket.** It shows the
columns *filling the viewport* with a crisp bottom edge — on an **empty week**, which is the single
case in which that property costs nothing. § 4.2 abandons it. **Everything about a non-empty week is
originated here**: what a full column does, what sixteen chips do, what happens below 1280px, and
what an empty week says. A reviewer should read every one of those as invented, because it was.

## 3. Permission model

**Nothing changes, and this ticket cannot change it.** It re-lays-out one component. No control is
added, no guard moved, no seam function called that was not called before.

| Action | Who | Where the check lives | Changed here |
|---|---|---|---|
| Read the team's entries for a week | member | row-level select policy on `entry` (ADR-005) | no |
| Read the team's holidays | member | row-level select policy | no |
| Reach the week route with no session or no member row | anybody | the screen's own refusal states, not a route guard | no |

**The refusal states are the part a rewrite can break by deletion.** `week-loading`,
`week-not-on-a-team`, `week-sign-in` and `week-unavailable` render *instead of* the grid and are
outside it; UIE-02's `BareLayout` exists so a member-less or signed-out caller still reaches them.
AC-14 keeps all four, and none is touched by a change to the grid's container.

**The screen still makes no team read**, which is a permission-model fact as much as a domain one:
`seam.getTeam()` is the call `0/8 vắng` would have required, and AC-13 keeps it uncalled.

## 4. Contract

No seam function changes, no signature moves, no component gains a prop, and no file outside
`src/routes/WeekView.tsx` is opened. The contract here is **a layout and two refusals**.

### 4.1 The refusal that matters: no count, and no footer strip

`ticket.yaml` § 4 tells PLAN to choose, and warns that reproducing the mockup's footer would reverse
a decision in CAL-05's registry row and need a feature-row amendment — RULE-01, human plane.
**Triage's recommendation was to render the day's own chip count instead, as a fact the screen
already has in hand. This plan declines even that, and renders no count and no footer strip at all.**

**Because a chip count is a different number wearing the same name.** INV-04 defines the absence
count as **1 per `full` and 0.5 per `am` or `pm`**. A day holding one full-day and two half-day
entries has three chips and an absence count of **2**. Put `3` at the foot of that column and the
product now shows two different numbers for one day on two screens — the month grid says 2, the week
says 3 — which is precisely the divergence INV-04's last sentence forbids, arrived at without ever
calling `absence.ts`. Labelling it carefully does not help: a bare number under a day, on a screen
whose subject is who is away, will be read as how many are away.

**So the footer strip goes with it.** Without a count it holds nothing the transcription put there,
and inventing content for it would be inventing behaviour. The columns end where their content ends.

**This keeps `requires_adr: false` true rather than merely unchanged.** The stop-and-ask
`ticket.yaml` § 4 arms is not fired, because nothing here amends CAL-05's row. `WeekView.tsx:11`
still opens *"IT COUNTS NOTHING"*, and after this ticket that is a decision taken three times by
three tickets rather than twice.

### 4.2 The layout decision

`ticket.yaml` § 3 enumerates three options. **This plan takes Option 3's breakpoint and Option 1's
overflow behaviour together, because neither answers both questions on its own** — Option 3 says what
happens on a narrow viewport and is silent about a full column on a wide one; Option 1 says what a
full column does and is silent about narrow. Option 2 is refused outright in § 8.

| Width | Layout |
|---|---|
| ≥ 1280px | seven equal columns, Monday to Sunday, 8px gutters, each a `bg-card` `rounded-card` `shadow-soft` block |
| < 1280px | the shipped stacked layout, one full-width block per day, unchanged |

**Above the breakpoint the columns are as tall as the tallest day, and the page scrolls once.**
The mockup's fill-the-viewport property is abandoned deliberately, and it is the only property of the
transcription this plan drops on grounds of evidence rather than policy: it is shown on an empty
week, and § 0's arithmetic gives ~161px columns against chips of 90–110px, so sixteen chips on one
day is ~1520px of content in ~910px of body.

**No column scrolls on its own, and AC-5 is why.** Seven independent scrollers means the seven days
fall out of horizontal register and **you cannot see the whole week at once** — which is the purpose
of the screen and a direct contradiction of `CLAUDE.md` § *Visual direction*, where information
density wins on the grid every time. One page scroll keeps the days aligned; seven column scrolls
lose the week to save a bottom edge.

### 4.3 The column, element by element

| Element | Shape | Selector |
|---|---|---|
| the grid | seven equal tracks with 8px gutters at ≥1280px; a single column below it | — |
| a day | `bg-card`, `rounded-card`, `shadow-soft`, no border, full track width | `week-day`, keeping `data-date`, `data-day-status`, `data-bridge` |
| the header strip | weekday then date, the date lighter, at the top of the column; holiday name and bridge badge beside them when present; lavender tint on a non-working holiday only | `week-day-label`, `week-day-holiday` (keeping `data-kind`), `week-day-bridge` |
| an entry | the shipped chip, unchanged in content — PTO peach, WFH mint, tentative dashed at reduced opacity | `week-row` and its seven children, all unchanged |
| a quiet day | the shipped sentence | `week-day-empty` |
| an empty week | one card over the columns: a mascot and one English sentence, no control | `week-empty-card` — new |

**`week-empty-card` is the only new selector**, and it is additive: AC-10 keeps all seven
`week-day-empty` elements, which `cal-05-week-view.spec.ts:266` asserts by count.

**Every token this needs already exists** — `--color-card`, `--radius-card`, `--shadow-soft`,
`--color-ink`, `--color-ink-3`, `--color-line`, `--color-pto`, `--color-wfh`, `--color-holiday` are
all in `src/index.css` from UIE-01 and UIE-02, so that file is not opened and no token is added.

### 4.4 What the container was and becomes

`WeekView.tsx:277` is today `<section className="mx-auto flex max-w-3xl flex-col gap-6">` wrapping a
`<div className="flex flex-col gap-3">` of seven `<section data-testid="week-day">` elements.
**`max-w-3xl` and `mx-auto` go** — seven columns need the pane's full width, which `AppShell.tsx`
already grants with `min-w-0 flex-1`. The seven day sections keep their identity, their attributes
and their children; what changes is the container's display and each day's own chrome.

## 5. Seam impact

**None.** No function in `src/lib/data/` is added, removed, renamed or changed, and
`tests/seam-parity.test.ts` is untouched. The screen makes exactly the calls it makes today —
including the one it does not make: `seam.getTeam()` stays uncalled, which AC-13 asserts from the
outside. `src/lib/data/absence.ts` is not opened, so INV-04's single implementation is untouched and
this ticket adds no second one.

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint, no column; nothing under `supabase/` is
opened. ADR-014 does not engage.

`requires_adr: false`, and § 4.1 is what keeps that honest rather than merely unflipped: the one
change that would have needed a human — reproducing the mockup's absence count, which amends CAL-05's
registry row under RULE-01 — is refused, so the stop-and-ask `ticket.yaml` § 4 arms does not fire.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-04/**"
  - "src/routes/WeekView.tsx"
```

**One file outside the ticket folder. `size: S`** — `.ai/01-operating-model.md:372` puts S at up to
six. **`size_estimate` and `size` agree at S**, so ADR-012 never engages.

**`ticket.yaml` § 2 says two files, possibly four, and warns that the option chosen in § 3 changes the
cost by more than the file count suggests. It does — downward.** The three candidate spec files are
all out, and § 0 is the measurement rather than an assumption: `cal-07` addresses no week selector,
and `cal-05` and `cal-08` address this screen only through ids, data attributes and DOM order, every
one of which § 4.3 preserves. **The layout option was chosen partly for that property**: Option 2
would have deleted `week-row-note` and `week-row-approver` from the resting view and pulled
`cal-05-week-view.spec.ts` in behind them, along with an amendment to two of CAL-05's acceptance
criteria.

**Nothing in `src/` outside this file is needed either.** Every token the columns use was shipped by
UIE-01 and UIE-02, so `src/index.css` stays shut, and the shell already grants the pane full width
with `min-w-0 flex-1`.

## 8. Rejected alternatives

**1. Ship nothing — keep the stacked layout.** This deserves to be first because `ticket.yaml` § 3
half-argues it: today's layout scrolls once, never hides a day, and *"is not obviously an improvement
on it once the week has entries in it, and nobody has seen it with entries in it."* That is a real
case and the density arithmetic supports it. **Rejected because the objection is to
fill-the-viewport, not to columns**, and § 4.2 drops exactly that property. What survives is seven
days side by side, which is the one thing a stacked list cannot do at any height: compare Tuesday
with Thursday without scrolling between them. On a quiet week — which the fixtures and most real
weeks are — the columns win outright, and on a heavy week AC-4 and AC-5 make them merely tall.

**2. Option 2 — compress the chip for 161px, with the note and approver behind an expand.** The only
option that makes seven columns genuinely fit the viewport, which is what the mockup shows.
**Rejected because it is an acceptance-criterion amendment wearing a layout's clothes.** CAL-05's
AC-6 and AC-7 put the note and the approver on the resting screen and
`tests/e2e/cal-05-week-view.spec.ts` tests them; hiding either behind an interaction reverses a
shipped decision in a registry row, which is RULE-01 and a human's. It would also make this the one
UIE ticket that takes something away from a member to make a screenshot true.

**3. Seven independently scrolling columns, keeping the crisp bottom edge.** The most faithful
reading of the transcription: every column fills the viewport exactly and overflow scrolls inside it.
**Rejected because it defeats the screen.** Seven scrollers put the days out of horizontal register,
so Wednesday's third entry and Thursday's third entry are no longer on the same line and the week
stops being one picture — and a day whose entries are all below its own fold reads as a quiet day.
`CLAUDE.md` § *Visual direction* is explicit that density wins on the grid; this trades the week for
a bottom edge. AC-5 exists to forbid it by name.

**4. Render the day's own chip count in the footer, as triage recommends.** Cheap, needs no seam
call, no roster read and no threshold, and it fills the strip the transcription draws. **Rejected in
§ 4.1**: three chips on a day holding one full-day and two half-day entries is an absence count of
two, so the number would contradict the month grid for the same date — INV-04's forbidden second
definition, reached without touching `absence.ts`. A number under a day on this screen will be read
as how many are away, whatever it is labelled.

## Changelog

- `2026-09-07T15:54:51+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-07T15:54:51+07:00` — **`invariants_touched` set to `[INV-04]` rather than the `[]` that
  ADR-028 predicts for a UIE row, and § 7 shrank rather than grew after the source tree was read.**
  Sections 1 and 2 were drafted against `ticket.yaml`'s scope of two-to-four files. Reading the three
  candidate spec files showed all three address this screen only through ids, attributes and DOM
  order, so none is in scope and § 7 is one file — but that is true *only* of a layout option that
  renames nothing, which is part of why § 4.2 chose as it did. **The AC that reading the code
  produced is AC-8**, which forbids merging a member's morning and afternoon entries into one chip:
  it is the space-saving a developer at 161px would reach for, and it is the one that would make the
  week list disagree with the month count. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
