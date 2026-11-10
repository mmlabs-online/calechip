# UIE-04 — the visual reference, and it shows the one case that proves nothing

**THE CANONICAL COPY IS `.ai/board/tickets/UIE-02/design/README.md`. READ IT FOR THE WHOLE.** It is a
transcription of one image shown in conversation on 2026-09-05 that was never on disk, written by
hand at the canonical path because there was no file to move
(`.ai/standards/ui-design-system.md:105-125`). This file quotes only the part `UIE-04` owns. **One
full copy, not three.**

## The part this ticket owns, quoted from § 2 of the canonical copy

> **The grid pane.** Seven equal columns filling the remaining width, each a tall white rounded card
> (~16px radius) with a very soft shadow, separated by ~8px gutters, running from just under the top
> bar to just above the bottom of the viewport.
>
> - Each column has a header strip: a bold `T2`…`T7`, `CN` immediately followed by a lighter
>   `01/12`…`07/12`, centred.
> - Each column has a footer strip in a small monospace-looking grey: `0/8 vắng`.
> - The bodies are empty in this screenshot. **One card floats over the fourth column (`T5 04/12`),
>   vertically centred in the pane and not inside a column:** a small white rounded card with a soft
>   shadow, holding a mouse emoji at left, then two lines — `Chưa ai đăng ký tuần này.` in ~13px deep
>   indigo, and beneath it `+ Đăng ký ngay` in ~12px peach, as a link.

## Two things about that quotation, and they are the whole ticket

**THE BODIES ARE EMPTY, WHICH IS THE ONE CASE THAT PROVES NOTHING.** The image does not show an entry
chip, a full column, or an overloaded day — and *filling the viewport with seven columns* is a
property that only fails once there is something in them. `ticket.yaml` § 3 is the arithmetic:
~168px per column, 90–110px per chip, up to sixteen chips on one day, and an overflow of sixty per
cent in the worst realistic case. It enumerates three answers and recommends one. **PLAN chooses;
this document does not, and neither did triage.**

**`0/8 vắng` IS NOT LAYOUT.** It is an absence count on a screen that
`src/routes/WeekView.tsx:11-17` says counts nothing, deliberately, because CAL-05's registry row says
so and because a second count is the second definition INV-04 exists to forbid. (Citation re-measured
by `product` on 2026-09-05 after `CAL-08` rewrote that file; it read `:11-16`. The paragraph survives
the rewrite and `:11` still opens *"IT COUNTS NOTHING"*.) The same goes for the
`Quá tải (>50%)` row in the sidebar legend, which needs the team read that same paragraph refuses.
Both are **behaviour**, so the § *Visual specification* grant does not reach them, and reproducing
either needs an amendment to a registry row rather than an acceptance criterion — `ticket.yaml` § 4,
including the instruction to stop and ask rather than write one.

**And the eight in `0/8` is fictional.** `src/lib/fixtures.ts` holds four members on the main team who
have not been removed (`:39`, `:72`, `:149`, `:319`; `:108` is another team, `:123` carries
`removedAt`). No test can assert that number against this repository.

## What the image does not show, restated for this ticket only

A week with entries in it; how an entry chip looks at 168px; a column that is full; an overloaded
day; hover, focus and active states; any width narrower than desktop; and dark mode. **Silence is not
removal** — every one of those exists on screen today under CAL-05, and `ticket.yaml` § 7 scopes out
the ones that are somebody else's.

**Added 2026-09-05, after `CAL-08` merged in PR #56: the image shows no holiday and no bridge day
either, and that is now a silence about something the screen actually draws.** The transcription's
column header is a weekday and a date and nothing else. The real one carries a holiday name
(`src/routes/WeekView.tsx:355`), a bridge badge (`:364`), and a lavender tint on the heading for a
non-working holiday (`:345`). **Silence is not removal here more sharply than anywhere else on this
list**, because a header strip drawn from this transcription alone would drop shipped behaviour that
`tests/e2e/cal-08-holiday-shading.spec.ts` asserts. `ticket.yaml` § 2 carries the four names and both
attribute vocabularies that must survive the rewrite.

**This document is evidence of intent; it is not a specification.**
`.ai/standards/ui-design-system.md:137-138` says *"looks like the screenshot" is not an acceptance
criterion* — which in this ticket is not a formality, because the screenshot is of an empty week and
the criterion has to hold for a full one. Under `.ai/standards/ui-design-system.md:140-150` the
layout is `tech-lead-design`'s at PLAN, **including the obligation that comes with the grant**:
`01-plan.md` § 2b must say the layout is its own and was never specified.

**Written by `product` at `/triage` on 2026-09-05**, from
`.ai/board/ideas/2026-09-05-the-product-has-no-shell-and-every-screen-starts-over.md`.
