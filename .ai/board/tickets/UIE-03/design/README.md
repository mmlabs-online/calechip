# UIE-03 — the visual reference, in one line: there is no second header

**THE CANONICAL COPY IS `.ai/board/tickets/UIE-02/design/README.md`. READ IT FOR THE WHOLE.** It is a
transcription of one image shown in conversation on 2026-09-05 that was never on disk, written by
hand at the canonical path because there was no file to move
(`.ai/standards/ui-design-system.md:105-125`). This file quotes only the part `UIE-03` owns. **One
full copy, not three.**

**What this ticket takes from the transcription is what the transcription does *not* contain**, which
is why it is short. The top bar is described once, in § 2 of the canonical copy, and it is the only
header on the screen:

> **Top bar**, spanning the grid pane only, not the sidebar, ~70px tall, on the lavender ground with
> no card behind it.
>
> - Left cluster: a `‹` chevron button, then `01/12 – 07/12, 2025` at ~17px semibold deep indigo with
>   a small `▾` after it, then a `›` chevron button, then a pill-shaped outline button `Hôm nay`.
> - Right cluster: a segmented control — one pale-lavender rounded track holding three equal segments
>   `Tuần` / `Tháng` / `Năm`, with `Tuần` active as a white inset pill with a soft shadow.

**There is no second row of prev/next controls anywhere in that image, no second date anchor, and no
Home button of any kind.** `UIE-02` shipped that top bar and left the four period screens carrying
their own headers underneath it, so the application is doubled at the moment this ticket starts. This
ticket is where the doubling ends. The twenty-two elements and the four `data-testid` names that die
are enumerated in `.ai/board/tickets/UIE-03/ticket.yaml` § 1 and § 3, with a line citation on each.

**Two things the image is silent about that this ticket must not read as removal.** It shows no
screen other than the week view, so it says nothing about the allow-list, member-list, team-entries
or threshold screens — their headings, their back-links and their refusal messages are page content
and stay (`ticket.yaml` § 4). And it shows no error, loading or refusal state at all; `UIE-02`'s
`BareLayout` exists so those are still reachable, and deleting one here would finish the job that
layout was built to prevent.

**This document is evidence of intent; it is not a specification.**
`.ai/standards/ui-design-system.md:137-138` says *"looks like the screenshot" is not an acceptance
criterion*, and a transcription of an image nobody can reopen is weaker than that again. Under
`.ai/standards/ui-design-system.md:140-150` the layout is `tech-lead-design`'s at PLAN, **including
the obligation that comes with the grant**: `01-plan.md` § 2b must say the layout is its own and was
never specified.

**Written by `product` at `/triage` on 2026-09-05**, from
`.ai/board/ideas/2026-09-05-the-product-has-no-shell-and-every-screen-starts-over.md`.
