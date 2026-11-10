# UIE-08 — the visual reference. It is a transcription, and most of what it shows is NOT this ticket

**THIS IS THE CANONICAL COPY of the year-view image the operator showed on 2026-09-08.** It is a
different image from the month-view one transcribed on 2026-09-07
(`.ai/board/tickets/UIE-06/design/README.md`), a different one again from the week-view image
(`.ai/board/tickets/UIE-05/design/README.md`), and a different one again from the shell mockup UIE-02,
UIE-03 and UIE-04 were built against. **Do not read any two of them as one document.**

## Status of this file, stated exactly, because three different things are easy to confuse

- **The image is the operator's.** It was pasted into conversation on 2026-09-08 and **it is not on
  disk.** Nothing exists for it under `git ls-files`, the harness wrote no temp copy, and nothing was
  moved into this folder.
- **What follows is a hand transcription**, written by the dispatching session — the only party that
  could see the picture — at the canonical path
  (`.ai/standards/ui-design-system.md` § *Visual specification*) because there was no file to move.
  **A later reader cannot check a single sentence of it against the picture it describes.**
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

**Written by `product` at `/triage` on 2026-09-08**, from
`.ai/board/ideas/2026-09-08-the-year-grid-is-the-last-calendar-surface-still-drawn-in-defaults.md`, on
a PROMOTE verdict on the **repaint** half of that request. **The other half is
`.ai/board/ideas/2026-09-08-the-year-view-is-the-only-screen-that-shows-who-declared-nothing.md`**,
ruled NEEDS-ADR, with
[ADR-032](../../../../registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md)
drafted and `PROPOSED — awaiting the operator`.

***READ § 4 BEFORE § 1.*** **Most of what this picture draws is not this ticket.** UIE-08 repaints the
screen that exists; the twelve month cards, the four summary cards and the removal of the member
dimension are all ADR-032's and are **not** to be anticipated.

---

## 1. The transcription

### 1.1 The frame

Desktop viewport, roughly 1821 × 1251. **The whole page fits the viewport; nothing scrolls** — neither
the page nor any pane, horizontally or vertically. Page ground is a pale lavender off-white.
Bottom-right corner carries a small floating circular `?` help button (dark ground, white glyph).

### 1.2 Left sidebar (~262px, white, full viewport height) — **OUT OF SCOPE, see § 4**

Same in kind as the week- and month-view images:

- `Ai Nghỉ?` large bold deep indigo, `Lịch vắng mặt team` grey subtitle beneath.
- `TEAM (8)` small-caps grey-violet label.
- Eight member rows, each an emoji avatar on a pale rounded square, the display name in deep indigo,
  and a small grey sub-team line under it:
  Min (Bạn) / Core Engineering · Huy / Frontend Team · Trâm / Core Engineering · Đạt / Backend Team ·
  Ngọc / Frontend Team · Khoa / Backend Team · Linh / QA / Testing · Bảo / Design / Product.
- Pinned to the bottom: a rounded pale-lavender legend card with **four** rows — peach dot
  `Nghỉ phép (PTO)`, mint dot `Làm ở nhà (WFH)`, violet dot `Ngày lễ`, pink dot `Quá tải (>50%)`.
- Below it the account footer: avatar, `Min`, `ADMIN` in small pink caps, and at the right a palette
  icon and a sign-out icon.

### 1.3 Top bar — **OUT OF SCOPE, see § 4** — showing its year state

Left: a `‹` chevron, then **`2026`** large bold deep indigo with a small `▾` after it, then a `›`
chevron. **No `Hôm nay` pill is visible in this image** (the month-view image had one at this
position); whether that is a deliberate omission for the year anchor or simply not drawn cannot be told
from the picture.

Right, in order: a segmented pill `Tuần` / `Tháng` / `Năm` with **`Năm` active** (white pill riding a
pale-lavender track); an outlined pill `Quản trị & Duyệt`; a solid near-black/deep-indigo pill
`+ Đăng ký`.

### 1.4 The main pane

Two stacked blocks, both on the lavender page ground, with a consistent gutter (~20px) between every
card.

#### 1.4.1 A row of four summary cards — **NOT THIS TICKET, see § 4**

Four equal-width white cards, rounded ~20px, soft shadow, in one 4-column row across the full pane
width. Each holds a small-caps label above a large bold number with a smaller grey unit word beside it:

| # | Label | Label colour | Number | Number colour | Unit |
|---|---|---|---|---|---|
| 1 | `TỔNG ĐƠN PHÉP 2026` | grey-violet | `21` | deep indigo | `đơn` |
| 2 | `NGÀY PTO` | peach/orange | `10` | peach/orange | `lượt` |
| 3 | `NGÀY WFH` | mint/green | `11` | mint/green | `lượt` |
| 4 | `NGÀY LỄ LỚN` | violet | `3` | violet | `ngày` |

The label of cards 2–4 is tinted the same hue as its number; card 1's label is neutral. The year is
interpolated into card 1's label text.

#### 1.4.2 Twelve month cards, 4 columns × 3 rows — **NOT THIS TICKET, see § 4**

White, rounded ~20px, soft shadow, generous padding, **uniform height across all twelve regardless of
how many week rows the month needs** — the slack sits between the last day row and the footer, not
distributed.

Each card, top to bottom:

1. **Header row.** `Tháng 01` … `Tháng 12` bold deep indigo at the left. At the right either the word
   `Trống` in small grey when the month holds nothing, or a count when it does — `21` bold beside a
   smaller `Lượt`. **In this image only `Tháng 04` carries a count (`21 Lượt`); the other eleven all
   say `Trống`.**
2. **A weekday header row inside the card:** seven centred labels `T2 T3 T4 T5 T6 T7 CN`, small,
   semibold, grey-violet. **Monday-first.**
3. **The month's days as pill-shaped cells** — capsule/oval rounded, wider than tall — one per day in a
   7-column grid with leading blanks for the first weekday offset. Default cell: very pale
   lavender-grey ground, deep-indigo centred number. Trailing days of the month simply end the grid; no
   next-month spill-over is drawn.
4. **Card footer.** At the left, only on a month that has something: a stack of overlapping circular
   emoji avatars (four visible, overlapping left-to-right) ending in a small `+4` chip. At the right, on
   **every** card including empty ones: `Xem →`, small, grey/indigo, reading as a link.

#### 1.4.3 The tinted days

Four fills observed, number rendered in white on all of them:

- **peach/orange** — PTO
- **mint/teal-green** — WFH
- **violet** — a holiday
- **a peach→mint blend/gradient across one pill** — a day carrying **both** a PTO and a WFH entry. This
  is a fill the shipped product has nowhere else, and it is the picture's only answer to a day holding
  two types. **Refused — § 4.**

Every marked day in the image, exhaustively:

- **Tháng 04** — 2 mint · 3 blend · 8 peach · 9 mint · 10 blend · 13 mint · 14 mint · 16 peach ·
  17 blend · 22 mint · 23 mint · 24 peach · 27 peach · 28 peach · 29 blend · 30 violet
- **Tháng 05** — 1 violet
- **Tháng 09** — 2 violet
- every other month — nothing

The three violet days are 30/4, 1/5 and 2/9, which are real Vietnamese national holidays and agree with
the `NGÀY LỄ LỚN 3` card. **They are fictional against the fixtures — § 4.3.**

**No pink `Quá tải` cell appears anywhere in the image**, although the sidebar legend carries the row.
The picture is silent on how an overloaded day looks here.

---

## 2. WHAT THIS TICKET ACTUALLY IS, and it is one thing

**The four semantic colour tokens and the card treatment reach this screen.** The year view is the last
calendar surface still painted in raw framework defaults while `src/index.css:168-174` carries
`--color-pto`, `--color-wfh`, `--color-holiday` and `--color-overload`, and the sidebar legend beside it
already draws from them.

Measured against `src/routes/YearView.tsx` at the triage that promoted this ticket:

- **`:385`** — `status?.nonWorkingReason === "holiday" ? "bg-violet-200" : "bg-slate-100"`.
- **`:445`** — `!mark ? "bg-slate-100" : mark.type === "wfh" ? "bg-emerald-200" : "bg-orange-200"`.
- **`:339`** — the one `overflow-x-auto rounded-2xl bg-white p-4 shadow-sm` box. No `--radius-card`
  (`src/index.css:124`), no `--shadow-soft` (`:127-128`).
- **`:270`, `:281`, `:296`, `:508`** — the loading, member-less, unavailable and empty-calendar cards
  carry the same default `rounded-2xl … shadow-sm` pair. **Whether they come with the repaint is
  PLAN's**; they are the same screen and the same two token values.

**Three things make the substitution safe, and all three are written in the file already:**

1. **CAL-06 AC-5 turns on the attribute and not the colour.** `src/routes/YearView.tsx:433-437` says so
   in terms: `data-type` is what the criterion reads, *so it keeps AC-5 true when the palette is finally
   written*. The criterion was authored in anticipation of exactly this change.
2. **CAL-06 AC-6 and INV-05 are held by opacity plus an `sr-only` word**, not by a border
   (`:446-460`). Both survive a fill substitution untouched; neither survives a change of cell geometry,
   and this ticket proposes none.
3. **The per-cell render budget is load-bearing** (`:332-338`, `:363-365`). Roughly 10,950 cells is why
   every cell is an element reading precomputed values. **No lookup, no derivation and no class function
   may enter the cell loop.**

---

## 3. SILENCE IS NOT REMOVAL — what the image omits that this screen draws today

**All of these exist on the year screen today and all of them survive UIE-08 unchanged in substance.**
Under ADR-032 some of them are in question; **under this ticket none of them is.**

1. **The sticky member-name column and the one row per roster member** (`:398-466`, `:412`) — CAL-06
   AC-3.
2. **The month ruler** (`:341-354`), `year-month-label` with `data-month`.
3. **The `Calendar` day-status strip** (`:366-396`) — `data-day-status`, `data-bridge`, the lavender
   non-working tint and the bridge dot. CAL-08 AC-7 and AC-11, asserted in
   `tests/e2e/cal-08-holiday-shading.spec.ts`.
4. **The `Away` totals strip** (`:475-492`) — `year-total` with `data-count` on every date, from
   `absenceCountsFor`. CAL-06 AC-9 and AC-10.
5. **The tentative treatment** — reduced opacity plus the `sr-only` `Tentative` span (`:446-460`).
   CAL-06 AC-6, INV-05.
6. **The empty-calendar sentence** `year-holidays-empty` (`:505-514`) — CAL-08 AC-8.
7. **The three non-list states** — `year-loading`, `year-not-on-a-team`, `year-unavailable`
   (`:265-302`) — CAL-06 AC-13 and AC-14.

**And the image does not show:** hover, focus or selected states; any width narrower than desktop; dark
mode; a year with no entries at all; or a leap year. None of those is a removal either.

---

## 4. What this document shows and this ticket does not build

### 4.1 The twelve month cards, the four summary cards, and the removal of the member dimension

**The whole information architecture of the picture is
[ADR-032](../../../../registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md)'s,
status `PROPOSED — awaiting the operator`.** It is not arrangement: **nine shipped domain acceptance
criteria stop being observable** — CAL-06 AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-10 and CAL-08 AC-7 and
AC-11 — and `.ai/standards/ui-design-system.md:152-155` puts behaviour, permissions and invariants
outside the layout grant.

**UIE-08 is planned on the assumption that decision is NOT taken: the member grid stays exactly where it
is and only its paint changes. Do not anticipate the decision, and do not build any part of the summary
band.**

**The peach→mint blend is refused here for an independent reason as well**: it is a new derivation — the
set of types present on a date, team-wide — and `src/routes/YearView.tsx:18-22` forbids this file
deriving anything of its own. **A gradient is also not expressible in the token vocabulary**: the four
tokens are flat hexes named for meaning (`src/index.css:136-139`) and no gradient token exists.

### 4.2 Every Vietnamese string in the image

`TỔNG ĐƠN PHÉP 2026`, `NGÀY PTO`, `NGÀY WFH`, `NGÀY LỄ LỚN`, `Tháng 01`…`Tháng 12`, `Trống`, `Lượt`,
`đơn`, `ngày`, `Xem →`, and the weekday row `T2 T3 T4 T5 T6 T7 CN`.

The interface is English — `.ai/standards/ui-design-system.md:46-48`, **the operator's own instruction
of 2026-09-03** — it is lint-enforced (`eslint.config.js:84-92` reports a Vietnamese diacritic in JSX
text under `src/`, so several of these strings **fail the build** rather than failing review), and
`ui-language.json:21` carries an empty `copyDebt`, a list that only ever shrinks and whose growth is
named in the file itself as the failure mode. **UIE-01, UIE-05 and UIE-06 each refused the identical
request.** This is the fourth time.

### 4.3 The sidebar and the top bar entirely

The operator said *calendar view*, and UIE-02 and UIE-03 shipped that chrome. Specifically out: the
`TEAM (8)` roster and its five team subtitles; the fourth legend row `Quá tải (>50%)`; the `▾` after the
year; the palette and sign-out icon buttons; the `Quản trị & Duyệt` pill; and the floating `?`.

**The trap is the one UIE-05 and UIE-06 both named:** this ticket owns the grid, so adjusting a sidebar
swatch to match the cells it has just repainted will feel like finishing the job. It is still a shell
edit.

**`Quá tải (>50%)` hardcodes a number an admin can change.** ADM-01 shipped a per-team threshold and
`tests/e2e/adm-01-threshold.spec.ts:222-224` proves the month screen follows a saved 60%. A legend row
reading `>50%` is correct only while the fixture value is 0.5. If that row is ever built, it reads the
team's threshold or it says nothing.

**And no `--color-overload` reaches this screen.** `src/routes/YearView.tsx:24-26` records that
`seam.getTeam()` is deliberately not called and that no soft pink appears here. **Adding it is a read
and a domain state, not a colour** — ADR-032 open question 5.

### 4.4 A finding about this image that belongs to no ticket, recorded where a later reader stands

**The sidebar in § 1.2 shows eight members carrying five different team subtitles** — Core Engineering,
Frontend Team, Backend Team, QA / Testing, Design / Product.

**That contradicts INV-07 — every entry belongs to exactly one member and is counted only against the
team that member belongs to — and the charter's one-team scope. It is not a restyle; it is a different
product.** The same defect is in the week-view image and in the month-view image, and is recorded at
`.ai/board/tickets/UIE-05/design/README.md` § 4.1 and `.ai/board/tickets/UIE-06/design/README.md`
§ 4.1. ***IT HAS NOW BEEN SHOWN THREE TIMES AND ACTED ON NOWHERE.*** The sidebar is out of scope here so
nothing acts on it, and this paragraph exists for one reason: **whoever next opens one of these
transcriptions must not read those five subtitles as a requirement.**

**And the `8` is fictional.** `src/lib/fixtures.ts` holds **four** unremoved members of the main team
(`:39`, `:72`, `:149`, `:319`; `:108` is another team, `:123` carries `removedAt`). Nothing may be
asserted from that literal — including the `+4` avatar chip in § 1.4.2, which cannot occur against these
fixtures.

**The three violet days are fictional too.** Every fixture holiday is 2026-06-11, 2026-06-13 (`working`),
2026-06-15 and 2026-10-15 (`src/lib/fixtures.ts:442`, `:455`, `:465`, `:475`) — not 30/4, 1/5 or 2/9. **No
test against these fixtures can reproduce the picture's `3`.**

### 4.5 A stale comment in the file this ticket opens

`src/routes/YearView.tsx:174` still cites `MONTH_ENTRY_LIMIT` as the truncation mechanism. CAL-09
removed that constant's only reader. `src/routes/WeekView.tsx:296` carries the same stale line and is a
different file and not this ticket's.

**One comment line, in a file already in scope.** Correcting it is available to PLAN under the
small-defect grant in `.ai/steward/context.md` § *Autonomy*; leaving it is also defensible, since the
sentence around it is about a refusal that is still correct. **PLAN says which it did rather than
discovering it at REVIEW.**
