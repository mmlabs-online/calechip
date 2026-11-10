# UIE-02 — the visual reference, and it is not an image

**THIS IS A TRANSCRIPTION OF ONE IMAGE SHOWN IN CONVERSATION ON 2026-09-05 THAT WAS NEVER ON DISK.
IT IS NOT AN ATTACHED IMAGE.** No file was committed, `git ls-files` holds no image of any kind, and
nothing moved into this folder from the idea's `Evidence` section.
`.ai/standards/ui-design-system.md:105-125` describes an image attached at `/triage` moving to
`.ai/board/tickets/<ID>/design/` on PROMOTE; **there was no file to move**, so this file was written
by hand at that canonical path instead. It is the same situation as `UIE-01` and it is handled the
same way.

**THIS IS THE CANONICAL COPY FOR ALL THREE TICKETS FROM THIS IDEA.**
`.ai/board/tickets/UIE-03/design/README.md` and `.ai/board/tickets/UIE-04/design/README.md` quote
only the part each ticket owns and cite this file for the whole. One full copy, not three — three
copies of a description nobody can check against a picture is three things to keep in step, and the
copy is always the one that goes stale.

**What that costs, stated rather than glossed.** A later reader cannot check a single statement below
against the picture it came from. Under `.ai/standards/ui-design-system.md:140-150` the absence of an
image puts the layout in `tech-lead-design`'s hands at PLAN, **including the obligation that comes
with the grant**: `01-plan.md` § 2b must carry the line that the layout is the Tech Lead's own and was
never specified. This document is evidence of intent; it is not a specification, and
`.ai/standards/ui-design-system.md:137-138` already says *"looks like the screenshot" is not an
acceptance criterion*. A transcription of an image nobody can reopen is weaker than that again.

**Written by `product` at `/triage` on 2026-09-05**, from
`.ai/board/ideas/2026-09-05-the-product-has-no-shell-and-every-screen-starts-over.md`, whose
`Evidence` section is the source of every word in § 2 below.

---

## 1. The operator's request, verbatim

> chnage the layout UI of the app like this

Reproduced with its typo intact. One image was attached to that message. It is not in the repository.

---

## 2. The screenshot, transcribed — one screen, the week view inside an application shell

**Overall.** A full-bleed two-pane desktop layout on a very pale lavender ground. No page margin —
the panes reach every edge. Roughly 1:6 split.

**Left sidebar**, ~215px wide, white or near-white, full height, no visible border — separated from
the grid by colour alone.

- At the top, the brand lockup: `Ai Nghỉ?` in a heavy rounded face, deep indigo, ~20px, and beneath
  it in ~11px muted grey-purple, `Lịch vắng mặt team`.
- Then a section label `TEAM (8)` — uppercase, ~10px, letter-spaced, muted.
- Then eight roster rows, one per member: a ~26px circular pale-lavender avatar chip holding an
  animal emoji, then the display name at ~13px in a muted indigo. The rows read `Min (Bạn)`, `Huy`,
  `Trâm`, `Đạt`, `Ngọc`, `Khoa`, `Linh`, `Bảo`. The first is the signed-in person and is marked
  `(Bạn)` — *you*. No role badges, no counts, no controls on the rows.
- A large empty gap, so the next block is pinned to the bottom.
- A legend card: a rounded pale-lavender panel holding four rows, each a small filled dot then a
  label at ~11px — `Nghỉ phép (PTO)` peach, `Làm ở nhà (WFH)` mint, `Ngày lễ` lavender,
  `Quá tải (>50%)` pink.
- At the very bottom, a footer row: the same circular avatar chip, then `Min` at ~12px with `ADMIN`
  beneath it in ~9px uppercase letter-spaced muted text, then pushed to the right two small outline
  icon buttons — a painter's palette and a sign-out arrow.

**Top bar**, spanning the grid pane only, not the sidebar, ~70px tall, on the lavender ground with no
card behind it.

- Left cluster: a `‹` chevron button, then `01/12 – 07/12, 2025` at ~17px semibold deep indigo with a
  small `▾` after it, then a `›` chevron button, then a pill-shaped outline button `Hôm nay`.
- Right cluster: a segmented control — one pale-lavender rounded track holding three equal segments
  `Tuần` / `Tháng` / `Năm`, with `Tuần` active as a white inset pill with a soft shadow. Then a
  separate pill-shaped outline button `Duyệt phép`. Then a solid deep-indigo pill button
  `+ Đăng ký`.

**The grid pane.** Seven equal columns filling the remaining width, each a tall white rounded card
(~16px radius) with a very soft shadow, separated by ~8px gutters, running from just under the top
bar to just above the bottom of the viewport.

- Each column has a header strip: a bold `T2`…`T7`, `CN` immediately followed by a lighter
  `01/12`…`07/12`, centred.
- Each column has a footer strip in a small monospace-looking grey: `0/8 vắng`.
- The bodies are empty in this screenshot. **One card floats over the fourth column (`T5 04/12`),
  vertically centred in the pane and not inside a column:** a small white rounded card with a soft
  shadow, holding a mouse emoji at left, then two lines — `Chưa ai đăng ký tuần này.` in ~13px deep
  indigo, and beneath it `+ Đăng ký ngay` in ~12px peach, as a link.
- A small circular `?` button floats at the bottom-right corner of the viewport.

---

## 3. What the image does not show

Any screen other than the week view; the month and year views behind their segments; a week that
actually has entries in it, so nothing about how an entry chip looks, how a column behaves when full,
or what an overloaded day looks like; hover, focus and active states; the sidebar at any narrower
width, or whether it collapses; what the `▾` after the date range opens; what the palette icon does;
what the `?` button opens; any error or loading state; and dark mode.

**Every one of those exists on screen today or is specified by a shipped ticket, and silence is not
removal.** The list above is what PLAN must originate under the § *Visual specification* grant, and
each ticket's `ticket.yaml` names the ones it owns.

**One item on that list is not an omission but the whole subject of a ticket.** *A week that actually
has entries in it* is `UIE-04` § 3: at ~168px per column an entry chip costs 90–110px and a day may
hold sixteen of them, so the transcription's crisp fill-the-viewport grid overflows by sixty per cent
in the case the image does not draw.

---

## 4. Which ticket owns which part

| Part of § 2 | Ticket |
|---|---|
| The two-pane frame, the sidebar in full, the top bar in full | `UIE-02` |
| The `Ngày lễ` legend row | `UIE-02` — **moved here 2026-09-05, see below** |
| The four period screens giving up their own headers so the top bar is the only one | `UIE-03` |
| The grid pane — seven columns, the header and footer strips, the empty-state card | `UIE-04` |
| `Duyệt phép`, the palette icon, the `?` button | **NONE. Deferred.** |

**The last row is deliberate and is not an oversight.** Each of those points at something that does
not exist: `Duyệt phép` at ADM-04, ADM-05 and ADM-06, all `PLANNED` with no route and no screen; and
the palette icon and the `?` button at nothing decided in either direction. The idea file's *Triage
verdict* section records the deferral and what each waits on.

**The `Ngày lễ` legend row was in that last row until 2026-09-05 and is not any more. Marked rather
than deleted**, because a reader has to be able to see that the deferral was made, on what evidence,
and what overtook it.

> ~~`Ngày lễ` at CAL-08, `PLANNED`, so the colour never appears beside the legend that names it.~~

**What overtook it.** `CAL-08` merged (PR #56) and is `DONE`. The deferral's argument was never that
the colour is unimportant — it was *a legend row for a colour that never appears beside it is a legend
that lies*. **The colour now appears.** The file the deferral cited now says the opposite of what was
quoted from it: `src/routes/WeekView.tsx:28-29` reads *"Holidays are lavender, and CAL-08 draws them
HERE — the sentence this replaces said they were not drawn on this screen"*. So the legend stops lying
by **gaining** the row, and omitting it now would be the misleading omission instead — a lavender day
heading on the grid with nothing in the legend naming it. `UIE-02` builds the sidebar, so the row is
`UIE-02`'s. **One lavender dot only:** lavender means *not working* and tints the day heading alone,
and a bridge day gets no lavender at all — it is a working day carrying an outlined badge
(`src/routes/WeekView.tsx:362`). `.ai/board/tickets/UIE-02/ticket.yaml` § 9.3 carries the full
correction and the constraint that comes with it.

**The other three are untouched by this**, and `Quá tải (>50%)` — which was never in that row, being
scoped out for a different reason in all three shells — is untouched too. `CAL-08` brought a colour
for holidays; it brought no threshold, no team read and no overload state.

---

## 5. Four things this transcription asserts that the tickets do NOT adopt

Recorded here so nobody reads the transcription as scope. Each is scoped out as a negative
requirement in every one of the three `ticket.yaml` files, with its citation.

1. **Every string above is Vietnamese.** The interface is English —
   `.ai/standards/ui-design-system.md` § Language, the operator's own instruction of 2026-09-03,
   lint-enforced at `eslint.config.js:83-92`. This is the third mockup in a row to do so.
2. **`Duyệt phép` names a screen that does not exist**, and a disabled control would assert that the
   capability exists and is merely unavailable to this caller. It exists for nobody.
3. **`TEAM (8)`, the eight named roster rows and `0/8 vắng` are fictional.** `src/lib/fixtures.ts`
   holds **four** members on the main team who have not been removed — `:39`, `:72`, `:149`, `:319`;
   `:108` is another team and `:123` carries `removedAt`. Nothing may be asserted from the eight.
4. **`0/8 vắng` and `Quá tải (>50%)` are an absence count and an overload state on a screen built
   deliberately without either.** `src/routes/WeekView.tsx:11-17` says so and names CAL-05's registry
   row as the reason. Both are **behaviour**, so the § *Visual specification* grant does not reach
   them, and reproducing them needs a feature-row amendment rather than an acceptance criterion.
   **Re-checked on 2026-09-05 after the CAL-08 rebase rather than assumed:** that paragraph survives
   the rewrite, `:11` still opens *"IT COUNTS NOTHING"*, and `seam.getTeam()` is still deliberately
   not called. The `Ngày lễ` correction in § 4 does not reach this item.

**The visual arrangement is what these tickets take from this image. The copy, the fictional roster,
the count and the three controls that point at nothing are not.**
