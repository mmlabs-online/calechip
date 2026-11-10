# UIE-06 — the visual reference. It is a transcription, and much of what it shows already exists

**THIS IS THE CANONICAL COPY of the month-view image the operator showed on 2026-09-07.** It is a
different image from the week-view one transcribed hours earlier the same day
(`.ai/board/tickets/UIE-05/design/README.md`) and a different one again from the shell mockup UIE-02,
UIE-03 and UIE-04 were built against. **Do not read any two of them as one document.**

## Status of this file, stated exactly, because three different things are easy to confuse

- **The image is the operator's.** It was shown in conversation on 2026-09-07 and **it is not on
  disk.** `git ls-files` holds no image for this request, and nothing was moved into this folder.
- **What follows is a hand transcription written by an agent**, at the canonical path
  (`.ai/standards/ui-design-system.md:115-119`) because there was no file to move. **A later reader
  cannot check a single sentence of it against the picture it describes.**
- **It is evidence of intent. It is not a specification.**
  `.ai/standards/ui-design-system.md:137-138` — *"looks like the screenshot" is not an acceptance
  criterion*, because it cannot be observed from outside the system by a reader who cannot ask a
  question. `:125-129` is sharper: **no stage downstream ever reopens the reference**, there is no
  visual check at REVIEW, none in CI, and no QA stage since ADR-022.
- **The image was attached at exactly one stage and that stage has happened** (`:103-123`). **`/plan`
  must not be handed a second one.** A revised design replaces this file; it does not join it.
- **Under `.ai/standards/ui-design-system.md:140-155` the layout is `tech-lead-design`'s at PLAN, with
  the obligation that comes with the grant:** `01-plan.md` § 2b says the layout is its own and where
  this transcription was silent. The grant covers **visual arrangement and nothing else** — not
  behaviour, not permissions, not invariants, not feature IDs.

**Written by `product` at `/triage` on 2026-09-07**, from
`.ai/board/ideas/2026-09-07-the-month-grid-is-the-only-calendar-surface-still-drawn-in-defaults.md`,
on a PROMOTE verdict on the arrangement half of that idea. **The other half is
`.ai/board/ideas/2026-09-07-the-month-cell-number-is-what-stops-the-avatars-being-counted.md`**, ruled
NEEDS-ADR, with
[ADR-031](../../../../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md) drafted
and `PROPOSED — awaiting the operator`. See § 4.

---

## 1. The transcription

Desktop viewport, roughly 1563x1010. The whole page fits the viewport; nothing scrolls. Page ground is
a pale lavender off-white.

### 1.1 Left sidebar (~240px, white, full viewport height) — **OUT OF SCOPE, see § 4**

Identical in kind to the week-view image: `Ai Nghỉ?`, `Lịch vắng mặt team`, `TEAM (8)`, eight member
rows each with an emoji avatar and a grey team subtitle (Core Engineering / Frontend Team / Backend
Team / QA / Testing / Design / Product), a rounded pale-lavender legend card with **four** rows —
peach `Nghỉ phép (PTO)`, mint `Làm ở nhà (WFH)`, violet `Ngày lễ`, pink `Quá tải (>50%)` — and at the
bottom the signed-in user `Min` / `ADMIN` with a palette icon and a sign-out icon.

### 1.2 Top bar — **OUT OF SCOPE, see § 4**

A `‹` chevron; `Tháng 04, 2026` in large bold deep indigo with a small `▾`; a `›` chevron; a
pale-lavender pill `Hôm nay`. Right: a segmented pill `Tuần` / `Tháng` (active — white pill) / `Năm`;
an outlined pill `Quản trị & Duyệt`; a solid near-black pill `+ Đăng ký`.

### 1.3 The month grid — **this is what the operator is asking to change**

**A weekday header strip ABOVE the card, sitting directly on the lavender page ground**: seven centred
labels `T2 T3 T4 T5 T6 T7 CN`, small, semibold, grey-violet. No white behind them.

**Beneath it ONE large white rounded card** (~20px radius, soft shadow) holding the whole grid and
filling the pane's full width and the remaining viewport height.

- **Five rows of seven cells.** Cells are RECTANGULAR and separated by 1px light-grey hairlines that
  run edge to edge — **a true ruled grid, not a set of rounded tiles with gutters.** Only the card's
  four outer corners are rounded.
- Each cell is roughly 170px tall; the five rows fill the viewport exactly and nothing scrolls.
  **See § 3 — five rows is a property of April 2026 and not a property of a month.**
- **The day number sits at the top-left** of each cell, small, deep indigo.
- **Out-of-month days are greyed and their cells carry a pale lavender tint** — `30`, `31` at the
  start; `1`, `2`, `3` at the end. **See § 4 for the one clause this needs.**
- **Avatars**: a wrapping row of small circular chips (~22px) just under the day number, ~4px apart.
  Each is a filled coloured circle holding an animal emoji — mint/green for WFH, peach/orange for PTO.
  **Nothing else is written in the cell: no name, no count, no type label, no note.**
- **An overloaded day's whole cell background is a soft pink.** Two of them: `17` (five avatars) and
  `29` (six avatars).
- **`29` also carries a small FILLED pink pill at the cell's top-RIGHT reading `CẦU`** — uppercase,
  tiny. **Both the fill and the word are refused; the position is taken. § 4.**

Day by day, as drawn: row 1 — `30`,`31` greyed; `1` empty; `2` one mint; `3` one mint + one peach;
`4`,`5` empty. Row 2 — `6`,`7` empty; `8` one peach; `9` peach+mint; `10` peach+mint; `11`,`12` empty.
Row 3 — `13` mint; `14` mint; `15` empty; `16` peach; `17` PINK CELL, five avatars; `18`,`19` empty.
Row 4 — `20`,`21` empty; `22` mint; `23` mint; `24` peach+mint; `25`,`26` empty.
Row 5 — `27` peach+mint; `28` four avatars (peach, mint, peach, mint); `29` PINK CELL, six avatars,
`CẦU` badge; `30` empty; `1`,`2`,`3` greyed.

### 1.4 Elsewhere

A small dark circular floating `?` button, fixed at the bottom-right corner of the viewport. **Out of
scope** — it corresponds to no decision taken anywhere.

---

## 2. What is already on screen today, and this is the most useful thing in this file

**Much of the image's cell is already shipped.** A plan that does not know this rewrites working code
to arrive where it already is. Measured by `tech-lead-design` at the technical half of this triage,
against `src/routes/MonthView.tsx`:

- **The day numeral top-left** — `:390`. `CAL-04/01-plan.md:192` already specifies it.
- **Avatars as small filled coloured circles holding an emoji, wrapping under the numeral** — `:434`
  (`flex flex-wrap gap-1`), `:447` (`rounded-full`), `:459`.
- **Mint for WFH, peach for PTO** — `:452`.
- **No name, no type label and no note in the cell** — only `title={person.displayName}` at `:445`.
  **OPS-002 AC-7 does not engage here**, unlike the week image: the month cell names no type in words.
- **An overloaded day's WHOLE CELL background is soft pink** — `:379`. `CAL-04/01-plan.md:194-195`
  chose background-not-badge deliberately, because a crowded day has to be findable by scanning.
- **Monday-first, seven columns, whole weeks with leading and trailing cells** — `:83`, `:305-309`.
- **Out-of-month days greyed** — `:375` (`bg-slate-100/60 text-slate-400`; grey, not lavender).
- **Five rows for April 2026** — true by construction. 30 March to 3 May is exactly 5 × 7.
- **The whole top bar and the whole sidebar** — shipped by UIE-02 and UIE-03, **in English**.

**One domain fact the picture states correctly, and it is worth recording.** Against its roster of
eight, day 28 carries four avatars (50%) and is **not** pink, while day 17 carries five (62.5%) and day
29 six (75%) and both **are**. That is `>` and not `>=`, which agrees exactly with INV-04 and with
CAL-04 AC-7 (`CAL-04/01-plan.md:111-118`). The picture did not get that by accident.

**What is genuinely being asked for is in `ticket.yaml` § 3**, and it is six things: the full-pane
width, the weekday strip on the page ground, the single ruled card, the taller cells, the out-of-month
tint, and the bridge badge's position.

---

## 3. SILENCE IS NOT REMOVAL — five things the image omits that the screen draws today

**Every one of these exists on the month screen today**, and a cell rebuilt from this transcription
alone would drop shipped CAL-04 and CAL-08 behaviour that spec files assert. **All of them survive
UIE-06 unchanged in substance:**

1. **The holiday name** — `month-cell-holiday`, carrying `data-kind` (`MonthView.tsx:407-416`), drawn
   for a row of **either** kind so a mandated working Saturday is named too, and drawn on an overloaded
   cell as well, because a signal hidden by a colour is the suppression ADR-015 forbids (CAL-08 AC-10).
   **It is asserted by TEXT** in `tests/e2e/cal-08-holiday-shading.spec.ts` — `:197`, `:225`, `:235`,
   `:388` — so it is the one of the five that a rebuild cannot drop silently.
2. **The lavender holiday tint and `data-day-status`** (`:365`, `:384`), asserted in the same spec.
3. **The bridge badge** — `month-cell-bridge`, **outlined** (`:417-423`), asserted at `:254-279` of
   that spec by count, not by text or colour.
4. **The tentative dashed border at reduced opacity** (`:456`) — CAL-04 AC-5, INV-05.
5. **The approved star** (`:460`), and the empty-month sentence `month-empty` (`:475-479`, CAL-04 AC-9,
   asserted at `tests/e2e/cal-04-month-view.spec.ts:176`).

**Two more, of a different kind, and they are the ones most easily lost in a rebuild:**

- **The overload threshold readout** — `month-threshold` (`:330-332`). **The image is silent about it,
  not negative.** It is what explains the pink cell, `MonthView.tsx:327-329` says so, and
  `tests/e2e/adm-01-threshold.spec.ts:222-224` is **ADM-01's only proof that a saved threshold reaches
  the calendar**. It stays.
- **The drag-select gesture** (`:371-372`, `:484-507`, CAL-04 AC-13) and its create panel
  `month-entry-panel`, asserted at `tests/e2e/cal-04-month-view.spec.ts:203-217`. The image shows no
  selected date and no form, and **this is the only creation path on this screen.** A grid rebuilt as
  one ruled card must still carry `onMouseDown` and `onMouseEnter` on every in-month cell.

**And the image does not show:** a day with more avatars than fit on one line; any width narrower than
desktop; dark mode; hover, focus, active or selected states; or **a month that needs six rows rather
than five**. That last one is not decoration — six rows at ~170px is ~1020px before the weekday strip,
so the height criterion is written as **at least** and never as *fills the viewport*, which would be
unsatisfiable half the year.

---

## 4. What this document shows and this ticket does not build

**The per-day absence count.** `month-cell-count` (`MonthView.tsx:391-395`) is the **only rendered fact
this image positively removes** — § 1.3 says *nothing else is written in the cell*. **That is a domain
amendment, not arrangement**: CAL-04 AC-3 states INV-04's formula in words, and the
§ *Visual specification* grant reaches arrangement only. It went to a second idea at the same triage
and the decision is drafted as
[ADR-031](../../../../registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md), status
`PROPOSED — awaiting the operator`. **UIE-06 is planned on the assumption that decision is NOT taken:
the count keeps its top-right slot and the bridge badge goes elsewhere.** Do not delete it, and do not
anticipate the decision.

**The filled pink `CẦU` badge — the fill and the word, not the position.** Pink is the overload fill
(`MonthView.tsx:379`), and the image's own legend says so with a pink dot reading `Quá tải (>50%)`.
Filling the badge paints the crowded-day colour onto a **working** day and reverses the reason written
at `:403-404`. **And `CẦU` fails the build**: `eslint.config.js:84-92` lints JSX text against
`[À-ɏḀ-ỿ]` and `Ầ` is U+1EA6.

**Every Vietnamese string in the image**, including `T2`…`CN`, `Hôm nay` and `Tháng 04, 2026`. The
interface is English — `.ai/standards/ui-design-system.md:46-48`, **the operator's own instruction of
2026-09-03** — it is lint-enforced, and `ui-language.json:21` has `copyDebt: []`, a list that only ever
shrinks with adding a file back named in the file as *the* failure mode. UIE-01 refused the identical
request and UIE-05 refused it again this morning. `Mon`…`Sun` stays; **no test asserts the weekday
labels either way, so keeping them is free and changing them is expensive.**

**Lavender for out-of-month days — refused as drawn, promoted as read.** `CLAUDE.md` § *Visual
direction* spends lavender on holidays, CAL-08 spends `--color-holiday: #c9bff0` there and nowhere
else, and `src/index.css:137-138` records that the tokens are *"named for what they MEAN and not for
what they look like"*. **But the transcription's own § 1.3 calls the page ground *a pale lavender
off-white*, which is `--color-bg: #f1effa`** (`src/index.css:102`), and the tint in the picture is
almost certainly that ground reading through the card. **So the tint is built, bound to `--color-bg`,
with one clause that is an acceptance criterion and not a comment:**

> The out-of-month tint is `--color-bg` and is never `--color-holiday`. An out-of-month cell and a
> non-working holiday cell must remain distinguishable side by side.

Without the clause this is a real collision: **CAL-08 AC-14 keeps out-of-month cells stateless**
(`MonthView.tsx:350`, `:365`; `tests/e2e/cal-08-holiday-shading.spec.ts:501` asserts `data-count=""` on
an October cell viewed from September), so an out-of-month day that *is* a holiday is not tinted today
— and a lavender out-of-month cell would then be indistinguishable from an in-month non-working
holiday except by the greyed numeral.

**The sidebar and the top bar entirely.** The operator said *month view*, and UIE-02 and UIE-03 shipped
that chrome. Specifically out: the `TEAM (8)` roster and its five team subtitles (§ 4.1); the fourth
legend row `Quá tải (>50%)` (§ 4.2); the `▾` after the period title; the palette and sign-out icon
buttons; the `Quản trị & Duyệt` pill; and the floating `?`. **The trap is the one UIE-05 named:** this
ticket owns the grid, so adjusting a sidebar swatch to match a cell it has just restyled will feel like
finishing the job. It is still a shell edit.

### 4.1 A finding about this image that belongs to no ticket, recorded where a later reader stands

**The sidebar in § 1.1 shows eight members carrying five different team subtitles** — Core
Engineering, Frontend Team, Backend Team, QA / Testing, Design / Product.

**That contradicts INV-07 — every entry belongs to exactly one member and is counted only against the
team that member belongs to — and the charter's one-team scope. It is not a restyle; it is a different
product.** The same defect is in the week-view image and is recorded at `UIE-05/ticket.yaml` § 8 and
`UIE-05/design/README.md` § 4.1. **It has now been shown twice and acted on nowhere.** The sidebar is
out of scope here so nothing acts on it, and this paragraph exists for one reason: **whoever next opens
this transcription must not read those five subtitles as a requirement.**

**And the `8` is fictional.** `src/lib/fixtures.ts` holds **four** unremoved members of the main team
(`:39`, `:72`, `:149`, `:319`; `:108` is another team, `:123` carries `removedAt`). Nothing may be
asserted from that literal — including the image's own overload arithmetic in § 2, which only works
against it.

### 4.2 `Quá tải (>50%)` hardcodes a number an admin can change, and that one is new

The overload threshold is **per-team and settable by an admin** — ADM-01 shipped it, and
`MonthView.tsx:331` renders it as `Crowded above {Math.round(team.overloadThreshold * 100)}% of
{active} people` precisely so it tracks the stored value. `tests/e2e/adm-01-threshold.spec.ts:222-224`
exists to prove the month screen follows a saved **60%**. **A legend row reading `>50%` is correct only
while the fixture value is 0.5 and becomes a lie the moment an admin uses the feature.** If that row is
ever built, it reads the team's threshold or it says nothing.

### 4.3 A stale claim in the tree, load-bearing for the legend row this image draws

`src/index.css:141-143` and `src/components/Sidebar.tsx:62-65` both state that **no calendar view
computes an overload state** and that `seam.getTeam()` is **deliberately not called by any of them**.
**`MonthView.tsx:175` calls it and `:347` computes `isOverloaded`** — and has done since CAL-04 shipped
on 2026-09-04, the day *before* UIE-02 wrote those comments. **Verified independently against source by
the dispatching session at this triage.**

**Both clauses are false, and they are the recorded reason the sidebar has no overload legend row** —
the row both of the operator's images draw. Correcting the two comments is a two-line factual fix a
plan may take under § *Autonomy*'s small-defect grant; **adding a `--color-overload` token, the legend
row and the `getTeam()` read is a shell change and belongs to whoever picks up the sidebar.**

### 4.4 Not a contradiction, recorded because it reads like one

The image's month is **April 2026** and every fixture holiday sits in June, September and October
(`.ai/board/tickets/CAL-08/01-plan.md` § 2). **The image showing no holiday is a property of the month
it drew, not a statement about holidays.** § 3 is what governs.
