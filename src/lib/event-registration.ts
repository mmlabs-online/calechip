// EVT-02 — when registration for an event is open. 01-plan.md section 4.2.
//
// **AN AFFORDANCE AND NOT A CONTROL (ADR-005).** What refuses a join after the deadline is
// `event_attendance_guard` (EV002) and what refuses a late withdrawal is
// `event_attendance_delete_own`, both calling `public.event_registration_open` in
// `supabase/migrations/20260929140000_evt02_attendance.sql`. The mock reproduces that function with
// this one, and the detail page uses it to decide which control to draw.
//
// ABOVE THE SEAM AND IMPORTING ONLY DOMAIN TYPES, so RULE-02 is untouched.
import type { CalEvent } from "@/lib/domain/types";

/** The zone the database compares in: `(now() at time zone 'Asia/Ho_Chi_Minh')::date`. */
const EVENT_TIME_ZONE = "Asia/Ho_Chi_Minh";

// `en-CA` formats a date as `yyyy-MM-dd`, which is the ISO shape every date string here uses.
const todayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** EVT-02. Today's date in Asia/Ho_Chi_Minh as `yyyy-MM-dd` — the zone the database compares in.
 *  `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })`, which formats as ISO. */
export function eventToday(now: Date = new Date()): string {
  return todayFormat.format(now);
}

/** EVT-02. `today <= (registrationDeadline ?? endDate)`. The mock's reproduction of
 *  `public.event_registration_open`, and the screen's affordance. Not a control. Open through the
 *  whole of the last day (AC-10): the comparison is on dates, never on instants. */
export function registrationOpen(
  event: Pick<CalEvent, "registrationDeadline" | "endDate">,
  today: string,
): boolean {
  return today <= (event.registrationDeadline ?? event.endDate);
}
