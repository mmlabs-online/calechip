# UIE-05 — the visual reference. It is a transcription, and half of what it shows already exists

**THIS IS THE CANONICAL COPY of the image the operator showed on 2026-09-07.** It is a different
image from the one UIE-02, UIE-03 and UIE-04 were built against
(`.ai/board/tickets/UIE-02/design/README.md`, 2026-09-05) — that one showed an *empty* week; this one
shows a week with two chips in it and a footer strip that the other did not have in the same form.
**Do not read the two as one document.**

## Status of this file, stated exactly, because three different things are easy to confuse

- **The image is the operator's.** It was shown in conversation on 2026-09-07 and **it is not on
  disk.** `git ls-files` holds no image for this request.
- **What follows is a hand transcription written by an agent**, at the canonical path
  (`.ai/standards/ui-design-system.md:115-119`) because there was no file to move. **A later reader
  cannot check a single sentence of it against the picture it describes.**
- **It is evidence of intent. It is not a specification.**
  `.ai/standards/ui-design-system.md:137-138` — *"looks like the screenshot" is not an acceptance
  criterion*, because it cannot be observed from outside the system by a reader who cannot ask a
  question. `:127-129` is sharper: **no stage downstream ever reopens the reference**, there is no
  visual check at REVIEW, none in CI, and no QA stage since ADR-022.
- **The image was attached at exactly one stage and that stage has happened** (`:103-123`). **`/plan`
  must not be handed a second one.** A revised design replaces this file; it does not join it.
- **Under `.ai/standards/ui-design-system.md:140-155` the layout is `tech-lead-design`'s at PLAN, with
  the obligation that comes with the grant:** `01-plan.md` § 2b says the layout is its own and where
  the transcription was silent. The grant covers **visual arrangement and nothing else** — not
  behaviour, not permissions, not invariants.

**Written by `product` at `/triage` on 2026-09-07**, from
`.ai/board/ideas/2026-09-07-a-busy-week-does-not-fit-and-a-day-does-not-say-how-full-it-is.md`, on a
PROMOTE verdict on the arrangement half of that idea.

---

## 1. The transcription

Desktop viewport, roughly 1580x1017. The whole page fits the viewport; nothing scrolls. Page ground is
a pale lavender off-white.

### 1.1 Left sidebar (~260px, white, full viewport height) — **OUT OF SCOPE, see § 4**

- `Ai Nghỉ?` in large bold deep-indigo rounded type; beneath it `Lịch vắng mặt team` in small grey.
- Section label `TEAM (8)` — small, uppercase, letter-spaced, grey-violet.
- Eight member rows. Each row: a circular pastel avatar (~28px) holding an animal emoji, then two
  stacked lines — the display name in deep indigo semibold ~13px, and under it a small grey ~11px
  subtitle naming a team: `Min (Bạn)` / Core Engineering; `Huy` / Frontend Team; `Trâm` / Core
  Engineering; `Đạt` / Backend Team; `Ngọc` / Frontend Team; `Khoa` / Backend Team; `Linh` /
  QA / Testing; `Bảo` / Design / Product.
- A large vertical gap, then near the bottom a rounded pale-lavender legend card, four rows, each a
  small filled dot then a label: peach `Nghỉ phép (PTO)`; mint `Làm ở nhà (WFH)`; violet `Ngày lễ`;
  pink `Quá tải (>50%)`.
- Below a hairline: the signed-in user — avatar, `Min` in bold, `ADMIN` beneath in small uppercase
  peach. At the right of that row two grey icon buttons: a palette, and a sign-out arrow.

### 1.2 Top bar — **OUT OF SCOPE, see § 4**

Left group: a `‹` chevron button; `30/03 – 05/04, 2026` in large bold deep indigo with a small `▾`
immediately after it; a `›` chevron button; then a small pale-lavender pill button `Hôm nay`.

Right group: a segmented control in a pale-lavender rounded pill — `Tuần` active (white pill, deep
indigo, semibold), `Tháng` and `Năm` inactive; then an outlined pill button `Quản trị & Duyệt`; then a
solid near-black/deep-indigo pill button `+ Đăng ký` in white.

### 1.3 The grid pane — **this is what the operator is asking to change**

Seven equal columns filling the pane's full width, ~8px gutters. Each column is a white rounded card
(~16-20px radius) with a very soft shadow.

**ALL SEVEN COLUMNS ARE EXACTLY THE SAME HEIGHT AND FILL THE VIEWPORT.** They run from just under the
top bar to just above the bottom of the viewport. An empty column is exactly as tall as the column
holding two chips. Nothing on the page scrolls at this content volume.

**Header strip**, at the top of each card, centred: the weekday in bold deep indigo immediately
followed, with no space, by the date in a lighter, smaller, monospace-looking grey — `T2 30/03`,
`T3 31/03`, `T4 01/04`, `T5 02/04`, `T6 03/04`, `T7 04/04`, `CN 05/04`. A hairline separator runs
across the card under the strip.

**Body**: entry chips stacked from the top, small gaps, inset ~8px from the card edges. Five of the
seven bodies are EMPTY, and an empty body shows NOTHING AT ALL — no text, no placeholder.

**Chips.** Two days carry content.

- `T5 02/04` — one chip. A mint/green rounded card (~14px radius), full width of the body, ~44px tall.
  At its left a circular pale/white avatar holding a rabbit emoji. To the right, two stacked lines:
  `Min` in deep green-ink semibold ~13px followed on the same line by a small gold-amber star `★`;
  beneath it `WFH` in small uppercase letter-spaced mint-green ~10px.
- `T6 03/04` — two chips stacked. First the same mint `Min ★` / `WFH`. Second a peach/orange chip,
  mouse emoji avatar, `Linh ★` / `PTO`, the type line in small uppercase peach.

The chip carries NOTHING ELSE: no portion pill, no note, no `Approved by <name>` text, no `Tentative`
word. The star alone stands for approval.

### 1.4 The footer strip — **NOT THIS TICKET'S. IT IS A DECISION AWAITING THE OPERATOR**

At the bottom of each card, pinned to the bottom edge, separated by a hairline, centred, small
monospace-looking type: `0/8 vắng` on the five empty days, `1/8 vắng` under `T5 02/04`, `2/8 vắng`
under `T6 03/04`. The word `vắng` reads in a soft pink; the fraction in grey.

**This strip is behaviour, not arrangement, and UIE-05 does not build it.** It went to a second idea
at the same triage — `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md` — and the
decision is drafted as
[ADR-029](../../../../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md),
status `PROPOSED — awaiting the operator`. **Do not add it, do not approximate it, and above all do
not substitute the day's chip count for it**: a day holding one full-day and two half-day entries has
three chips and an absence count of two, which is the second definition INV-04 exists to forbid.

**And the `8` is fictional.** `src/lib/fixtures.ts` holds **four** unremoved members of the main team
(`:39`, `:72`, `:149`, `:319`; `:108` is another team, `:123` carries `removedAt`). No test can assert
that number against this repository.

### 1.5 Elsewhere

A small dark circular floating `?` button, fixed at the bottom-right corner of the viewport. **Out of
scope** — it corresponds to no decision taken anywhere.

---

## 2. What is already on screen today, and this is the most useful thing in this file

**Roughly half of the image's headline property is already shipped.** A plan that does not know this
rewrites working code to arrive where it already is. Measured by `tech-lead-design` at the technical
half of this triage:

- **Seven equal columns at the pane's full width, ~8px gutters** — already true.
- **The white rounded card with its soft shadow** — already true; the radius differs by a token value,
  which is not a layout.
- **ALL SEVEN COLUMNS ARE ALREADY EXACTLY THE SAME HEIGHT.** They are one CSS grid row, the default is
  `align-items: stretch`, and no height is set on the card.
- **Mint WFH and peach PTO chip fills** — already true.
- **Monday-first column order** — already true.

**What is genuinely missing is only that a column *fills* the viewport on a quiet week**, plus the
header strip's alignment and format, the hairline, and the chip's silhouette. See `ticket.yaml` § 2
and § 3.

---

## 3. SILENCE IS NOT REMOVAL — five things the image omits that the screen draws today

A header and a chip rebuilt from this transcription alone would drop shipped behaviour that spec files
assert. **Every one of these survives UIE-05 unchanged in substance:**

1. **The holiday name** — `week-day-holiday`, carrying `data-kind`.
2. **The bridge badge** — `week-day-bridge`, outlined and not filled. Dropping it because a 161px
   column has no room reverses CAL-08's own decision that a bridge day is a working day, and that is a
   feature-row amendment rather than a layout choice.
3. **The lavender tint on the day heading**, for a non-working holiday only.
4. **The tentative dashed border at reduced opacity**, and the word `Tentative` beside it — the word
   is what says it for a reader who cannot see a border (CAL-05 AC-9).
5. **The empty-week mascot card.**

`tests/e2e/cal-08-holiday-shading.spec.ts:287-298` pins the first three. **The image shows no holiday
week and no bridge day at all**, so its header strip has no room drawn for either — and a header strip
is exactly where they go.

**A sixth, of a different kind: `week-day-empty` and its sentence.** The image's empty body shows
nothing. That sentence is what stops *an ordinary Tuesday* and *we did not look* being the same column
(CAL-05 AC-13, UIE-04 AC-10; `tests/e2e/cal-05-week-view.spec.ts:266` asserts seven of them). **It
keeps its element, its selector and its words, and may only be de-emphasised** — the deletion is
coupled to the footer count in § 1.4 and is decided there or not at all.

---

## 4. What this document shows and this ticket does not build

**The sidebar and the top bar.** The operator said *lịch tuần*, and UIE-02 and UIE-03 shipped that
chrome. Specifically out: the `Quá tải (>50%)` legend row — a fourth row against the three shipped,
needing the `overloadThreshold` from a `seam.getTeam()` call the shell does not make, and a legend row
for a colour no calendar view draws is a legend that lies; the `▾` after the period title; the palette
and sign-out icon buttons; the `Quản trị & Duyệt` pill; and the floating `?`.

**Every Vietnamese string in the image**, including `T2`…`CN` and `vắng`. The interface is English —
`.ai/standards/ui-design-system.md:46-48`, the operator's own instruction of 2026-09-03 — it is
lint-enforced, `copyDebt` is empty and only ever shrinks, and UIE-01 refused the identical request.
`Mon 30/03` is available and is layout; it costs a two-line edit to
`tests/e2e/cal-05-week-view.spec.ts:145-146`, which asserts `Monday` and `Sunday`.

**The chip's four deletions and its `WFH` / `PTO` micro-label.** All five are acceptance-criterion
amendments to CAL-05 and OPS-002, not arrangement. `ticket.yaml` § 3 carries the middle path that
reproduces this silhouette while keeping all five facts.

### 4.1 A finding about this image that belongs to no ticket, recorded where a later reader stands

**The sidebar in § 1.1 shows eight members carrying five different team subtitles** — Core
Engineering, Frontend Team, Backend Team, QA / Testing, Design / Product.

**That contradicts INV-07 — one member belongs to exactly one team — and the charter's one-team
scope.** It is not a restyle; it is a different product. The sidebar is out of scope for UIE-05 so
nothing acts on it, and this paragraph exists for one reason: **whoever next opens this transcription
must not read those five subtitles as a requirement.**

---

## 5. What the image does not show

A week with more than two chips on a day; a full or overflowing column; an overloaded day; a holiday
or a bridge day in a column header; the tentative treatment; a note; hover, focus or active states;
any width narrower than desktop; dark mode; and what the footer count does when a day holds a half-day
entry.

**Two of those are worth naming twice.**

- **The narrow width is UIE-04's shipped stacked layout below 1280px** — the product's first
  breakpoint, originated by that ticket — and the image says nothing about it. It is not removed by
  being unshown.
- **The half-day case is the one that decides the footer count**, and it is the one case the image
  does not contain. That is why § 1.4 is a decision and not a drawing.

**This is the third transcription in a row for the same screen family and the second for this screen.**
UIE-04 shipped against a transcription of an empty week; this one shows two chips. For the purpose of
every claim about density, **they are the same picture** — neither contains a busy day, and a busy day
is what the layout has to survive.
