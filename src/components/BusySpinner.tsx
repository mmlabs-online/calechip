// SOLO, 2026-09-11 (second pass) — the "still writing" indicator inside a busy control.
//
// **ONE COMPONENT BECAUSE THERE ARE TWO CONTROLS.** The week strip's pill and the month cell's badge
// both show it, and a ring drawn from a class list copied into two files is two things to keep in
// step for no benefit.
//
// PRESENTATIONAL, the boundary claim `Modal.tsx` makes in the same words: it imports react and
// nothing else — no seam, no hook, no domain type — so RULE-02 holds here by construction.
//
// **IT IS A BORDERED CIRCLE AND NOT AN ICON.** `lucide-react` is a dependency and `Loader2` would
// have done, but this element is 10-12px inside a pill whose text is 10-12px; a stroked glyph at
// that size reads as a smudge, and a ring with one transparent quarter reads as motion. It costs no
// import.
//
// **IT IS `aria-hidden` AND SAYS NOTHING.** The button carries `aria-busy` while the write is in
// flight, which is the announcement; a second one here would have a screen reader read the state
// twice. `motion-reduce:animate-none` leaves the ring drawn and still for somebody who asked the
// system for less motion — the control is disabled at the same time, so the state is not carried by
// the animation alone.
import type { JSX } from "react";

export interface BusySpinnerProps {
  /** The selector family of the control it sits in — `week-day-busy` or `month-cell-busy`. The
   *  spinner's own id is that prefix plus `-spinner`, so it needs no vocabulary of its own. */
  testIdPrefix: string;
}

export default function BusySpinner({ testIdPrefix }: BusySpinnerProps): JSX.Element {
  return (
    <span
      data-testid={`${testIdPrefix}-spinner`}
      aria-hidden="true"
      className="inline-block size-3 shrink-0 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}
