// EVT-03 — the event layer the week and month grids draw. 01-plan.md § 4.2. ADR-049.
//
// **PURE, AND IT IMPORTS NOTHING FROM `src/lib/data/`.** No React, no seam instance, no clock. It is
// string comparison over `yyyy-MM-dd` and set membership; RULE-02 holds by construction.
//
// **AN EVENT IS A LAYER OF ITS OWN AND NEVER AN ENTRY (ADR-049 decision 6).** Nothing here imports
// `absence.ts`, `day-status.ts` or `busy.ts`, and nothing here returns a shape any of them accepts —
// so no event can reach `absenceCountsFor`, `isOverloaded` or the overload warning (INV-04, INV-07).
import { datesInRange } from "@/lib/date-selection";
import type { CalEvent, DateRange, EventAttendance } from "@/lib/domain/types";

/** The month cell's cap (AC-17). */
export const MONTH_EVENT_LIMIT = 2;

/** Events whose inclusive [startDate, endDate] overlaps `range` (inclusive). Input order kept. */
export function eventsOverlapping(events: readonly CalEvent[], range: DateRange): CalEvent[] {
  return events.filter((e) => e.startDate <= range.end && e.endDate >= range.start);
}

/** AC-17's order: startDate ascending, then name (localeCompare), then id. */
function compareEvents(a: CalEvent, b: CalEvent): number {
  return (
    a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
}

/** For every date of `range` (each `yyyy-MM-dd` key present, possibly with []), the events covering
 *  it, ordered by startDate asc, then name (localeCompare), then id. */
export function eventsByDate(
  events: readonly CalEvent[],
  range: DateRange,
): Map<string, CalEvent[]> {
  const out = new Map<string, CalEvent[]>();
  const dates = datesInRange(range.start, range.end);
  for (const date of dates) out.set(date, []);

  const sorted = eventsOverlapping(events, range).sort(compareEvents);
  for (const event of sorted) {
    for (const date of dates) {
      if (date >= event.startDate && date <= event.endDate) out.get(date)!.push(event);
    }
  }
  return out;
}

/** The ids of events `memberId` takes part in: creatorId === memberId, or an `attending` row of
 *  theirs in `ownAttendance`. Rows of any other member are ignored. */
export function takingPartIds(
  events: readonly CalEvent[],
  memberId: string,
  ownAttendance: readonly EventAttendance[],
): Set<string> {
  // AC-8: pending, rejected and removed are not taking part — only `attending` counts.
  const attending = new Set(
    ownAttendance
      .filter((a) => a.memberId === memberId && a.status === "attending")
      .map((a) => a.eventId),
  );
  return new Set(
    events.filter((e) => e.creatorId === memberId || attending.has(e.id)).map((e) => e.id),
  );
}

/** Q4-A. Of `events`, those relevant to team `teamId`:
 *  scope "public"; or scope "team" with teamId === `teamId`; or scope "named" with at least one id
 *  of `inviteesByEvent.get(e.id)` in `teamMemberIds`. Input order kept. */
export function eventsRelevantToTeam(
  events: readonly CalEvent[],
  teamId: string,
  inviteesByEvent: ReadonlyMap<string, readonly string[]>,
  teamMemberIds: ReadonlySet<string>,
): CalEvent[] {
  return events.filter((e) => {
    if (e.scope === "public") return true;
    if (e.scope === "team") return e.teamId === teamId;
    return (inviteesByEvent.get(e.id) ?? []).some((id) => teamMemberIds.has(id));
  });
}
