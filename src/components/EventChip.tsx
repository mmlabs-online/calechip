// EVT-03 — one event, drawn on one day of the week or month grid. 01-plan.md § 4.5, § 2b. ADR-049.
//
// **A LINK AND NOTHING ELSE (AC-13).** No join, no withdraw, no decide — the chip issues no seam call
// at all, so no write can start from it. `/events/:id` already answers "cannot read" (EVT-01 AC-22).
//
// **NEVER AN ENTRY (AC-16).** Coral, not the PTO peach or the WFH mint, and no dashed tentative
// border: a gathering is not an absence and must not read as one.
import { Link } from "react-router-dom";
import type { CalEvent } from "@/lib/domain/types";

export interface EventChipProps {
  event: CalEvent;
  takingPart: boolean;
  /** "week" | "month" — chooses the testid prefix and the text size. */
  surface: "week" | "month";
  /** The `yyyy-MM-dd` of the day this chip is drawn in — `data-date` in § 4.8. A multi-day event has
   *  one chip per day, and the selector tells them apart. */
  date: string;
}

export default function EventChip({ event, takingPart, surface, date }: EventChipProps) {
  return (
    <Link
      to={`/events/${event.id}`}
      data-testid={`${surface}-event`}
      data-event-id={event.id}
      data-date={date}
      data-taking-part={takingPart ? "true" : "false"}
      title={event.name}
      aria-label={event.name}
      // The month cell starts a drag selection on mouse down — the reason `month-cell-busy` carries
      // the same line. Without it a click on the chip would also open the entry form beneath it.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={[
        "block w-full min-w-0 truncate rounded-md px-1.5 leading-snug",
        surface === "month" ? "text-[10px]" : "text-xs",
        // AC-6. Filled when the reader takes part, outlined otherwise — and a `●` for readers who
        // cannot rely on the fill.
        takingPart
          ? "bg-event font-semibold text-event-ink"
          : "border border-event bg-card text-event-ink",
      ].join(" ")}
    >
      {takingPart ? <span aria-hidden="true">● </span> : null}
      {event.name}
    </Link>
  );
}
