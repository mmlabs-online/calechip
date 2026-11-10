# CAL-10 — the visual reference. **It is a real file, and this is the first time on this board**

**The reference is `year-overview-2026-09-08.jpg`, the JPEG sitting beside this README.**

**IT IS A PHOTOGRAPH OF THE OPERATOR'S INTENT, NOT A TRANSCRIPTION OF IT.** Every other
`design/README.md` in `.ai/board/tickets/` — UIE-05's, UIE-06's, UIE-08's — opens by saying the image
is not on disk and that what follows is a hand transcription written by the only party who could see
the picture. **This file says the opposite.** The image is here. A later reader can open it and check
any sentence anybody has written about it, which no reader of the other three has ever been able to
do.

That is the defect recorded as **MD-030** (`.ai/board/model-debt.md:30`): `/triage` and `/plan` are
both instructed to move an attached design image into this folder, no role in the loop can do it, and
in 33 tickets it had happened zero times. **This ticket is the first exception and does not close the
row** — the file was placed by the dispatching session, not by a role in the loop, so the instruction
is still unexecutable by the agent it is addressed to.

## What it is, and what it is not

- **It is the same image the operator showed on 2026-09-08.** That day it was transcribed by hand at
  `.ai/board/tickets/UIE-08/design/README.md`, because there was no file to move. **That
  transcription remains the only prose description of the picture and is worth reading** — its § 1.4
  describes the summary band and the twelve month cards, and its § 4 records what it refused. It is
  now checkable against the image for the first time.
- **Do not read it together with any other image on this board.** The week-view image
  (`UIE-05/design/README.md`), the month-view image (`UIE-06/design/README.md`) and the shell mockup
  UIE-02, UIE-03 and UIE-04 were built against are four different pictures.
- **It is evidence of intent. It is not a specification.**
  `.ai/standards/ui-design-system.md` § *Visual specification* — *"looks like the screenshot"* is not
  an acceptance criterion, because it cannot be observed from outside the system by a reader who
  cannot ask a question. The file being real does not change that: **no stage downstream reopens the
  reference**, there is no visual check at REVIEW and none in CI.
- **The image was attached at exactly one stage and that stage has happened.** `/plan` must not be
  handed a second one. A revised design replaces this folder's contents; it does not join them.
- **The layout is `tech-lead-design`'s at PLAN**, under the carve-out in `CLAUDE.md` § *Working
  agreements* and `.ai/standards/ui-design-system.md` § *Visual specification*. The grant covers
  **visual arrangement and nothing else** — not behaviour, not permissions, not invariants, not
  feature IDs, and not the definitions of the four summary numbers.

## Three things the picture does NOT settle, and PLAN must not take from it

1. **The four summary numbers.** Its own figures are inconsistent — `21 đơn` against `10` + `11`
   *lượt* mixes two units in one identity, `Tháng 04` reads `21 Lượt` while drawing fifteen absence
   days, and all of it is fictional against the fixtures
   (`UIE-08/design/README.md:90-93`, `:108-109`, `:133-134`, `:140`). Definitions are acceptance
   criteria written at PLAN.
2. **The Vietnamese strings.** The interface is English and it is lint-enforced as a build failure.
3. **The peach→mint gradient pill** for a day carrying both a PTO and a WFH entry. The token set is
   flat hexes named for meaning and no gradient token exists (`UIE-08/design/README.md:220`).

**And its sidebar's five sub-team subtitles are not a requirement** — they contradict INV-07 and the
charter's one-team scope, and have been recorded three times and acted on nowhere
(`UIE-08/design/README.md:262-264`). The picture is real now, which makes that misreading easier
rather than harder.

**Written by `product` at `/triage` on 2026-09-09**, from
`.ai/board/ideas/2026-09-09-the-year-view-cannot-answer-what-the-year-looked-like.md`, on a PROMOTE
verdict. The decision behind the ticket is
[ADR-032](../../../../registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md),
`ACCEPTED by the operator` 2026-09-09.
