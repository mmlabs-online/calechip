// UIE-12 — the reader's own place on an event, kept in view while the page scrolls. 01-plan.md § 2
// AC-1..AC-10, AC-15, AC-16; § 2b; § 4.1.
//
// **EVERY CONTROL HERE IS AN AFFORDANCE, NOT A CONTROL (ADR-005).** `joinBarState` answers exactly
// today's `canJoin` for the button — what refuses the write is `event_attendance_guard` and the
// attendance policies, whatever this bar draws. The two sentences it adds, *Registration closed* and
// *This event is full.*, tell a reader in the audience what `event-deadline` and `event-seats` already
// tell them.
//
// **ONE ELEMENT AT EVERY WIDTH** (AC-15). Wide and narrow are one card restyled by the page that
// places it; nothing here is drawn twice and hidden once.
import { useState, type JSX } from "react";
import { seam } from "@/lib/data";
import type { AttendanceStatus, CalEvent, EventAttendance, Member } from "@/lib/domain/types";
import { eventToday, registrationOpen } from "@/lib/event-registration";
import Modal from "@/components/Modal";
import { inAudience, seatsTaken, type EventAttendanceLoad } from "@/components/EventAttendancePanel";

/** What the join block shows. Decided here and nowhere else (AC-16). */
export type JoinBarState =
  | { kind: "hidden" }
  | { kind: "join"; requiresApproval: boolean }
  | { kind: "status"; status: AttendanceStatus; canLeave: boolean }
  | { kind: "closed" }
  | { kind: "full" };

/** § 4.1's table, first match wins. */
export function joinBarState(input: {
  event: CalEvent;
  me: Member | null;
  invitees: readonly string[];
  /** `null` until the attendance load answers. */
  rows: readonly EventAttendance[] | null;
  /** Members and guests attending. */
  taken: number;
  /** `registrationOpen(event, eventToday())`. */
  open: boolean;
}): JoinBarState {
  const { event, me, invitees, rows, taken, open } = input;
  if (rows === null) return { kind: "hidden" };
  const mine = me ? (rows.find((a) => a.memberId === me.id) ?? null) : null;
  if (mine !== null) {
    return {
      kind: "status",
      status: mine.status,
      canLeave: open && (mine.status === "pending" || mine.status === "attending"),
    };
  }
  if (!inAudience(event, me, invitees)) return { kind: "hidden" };
  if (!open) return { kind: "closed" };
  if (!event.requiresApproval && event.capacity !== null && taken >= event.capacity) return { kind: "full" };
  return { kind: "join", requiresApproval: event.requiresApproval };
}

const MY_STATUS: Record<AttendanceStatus, string> = {
  pending: "Your request is waiting for a decision.",
  attending: "You're going.",
  rejected: "Your request was declined.",
  removed: "You were taken off the list for this event.",
};

const PRIMARY_BUTTON =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const QUIET_BUTTON =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:border-ink-3 hover:text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export interface EventJoinBarProps {
  event: CalEvent;
  me: Member | null;
  invitees: string[];
  attendance: EventAttendanceLoad;
}

export default function EventJoinBar({
  event,
  me,
  invitees,
  attendance,
}: EventJoinBarProps): JSX.Element | null {
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const state = joinBarState({
    event,
    me,
    invitees,
    rows: attendance.rows,
    taken: seatsTaken(attendance.rows, attendance.guests),
    open: registrationOpen(event, eventToday()),
  });
  const { busy } = attendance;

  if (state.kind === "hidden") return null;

  async function run(write: Parameters<EventAttendanceLoad["run"]>[0]): Promise<void> {
    setError(null);
    setError(await attendance.run(write));
  }

  // § 2b. The label names the action while there is one, and the reader's place once there is not.
  const heading =
    state.kind === "join" ? (state.requiresApproval ? "Request to join" : "Join") : "Your place";

  return (
    // § 2b. Narrow: last in the column, pinned to the bottom of the scrolling pane, its content kept
    // 4 rem clear of the report bubble (AC-8). Wide: the right-hand column, pinned under the top.
    <div
      data-testid="event-join-bar"
      className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-card bg-card p-5 pr-16 shadow-soft xl:top-6 xl:bottom-auto xl:self-start xl:pr-5"
    >
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">{heading}</h2>

      {state.kind === "join" ? (
        <div>
          <button
            data-testid="event-join-button"
            type="button"
            disabled={busy}
            onClick={() => void run(() => seam.joinEvent(event.id))}
            className={PRIMARY_BUTTON}
          >
            {state.requiresApproval ? "Request to join" : "Join"}
          </button>
        </div>
      ) : state.kind === "status" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p data-testid="event-my-status" data-status={state.status} className="text-sm font-semibold text-ink">
            {MY_STATUS[state.status]}
          </p>
          {state.canLeave ? (
            <button
              data-testid="event-leave-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setLeaving(true);
              }}
              className="text-xs font-semibold text-ink-3 underline hover:text-ink disabled:opacity-50"
            >
              {state.status === "pending" ? "Cancel request" : "Withdraw"}
            </button>
          ) : null}
        </div>
      ) : state.kind === "closed" ? (
        <p data-testid="event-join-closed" className="text-sm text-ink-2">
          Registration closed
        </p>
      ) : (
        <p data-testid="event-join-full" className="text-sm text-ink-2">
          {/* § 2b. *Full* is the overloaded-day pink, never red. */}
          <span className="rounded-pill bg-overload px-2.5 py-0.5 text-xs font-bold text-ink">Full</span>{" "}
          This event is full.
        </p>
      )}

      {error !== null ? (
        <p data-testid="event-join-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {leaving ? (
        <Modal testIdPrefix="event-leave" label="Leave this event" onClose={() => setLeaving(false)}>
          <div className="flex flex-col gap-4 pr-8">
            {/* EVT-02 AC-29. The confirmation names the event. */}
            <h2 className="text-lg font-extrabold text-ink">Leave &ldquo;{event.name}&rdquo;?</h2>
            <p className="text-sm text-ink-2">
              {state.kind === "status" && state.status === "pending"
                ? "Your request will be withdrawn."
                : "Your seat will be given up. You can join again while registration is open."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="event-leave-cancel"
                type="button"
                onClick={() => setLeaving(false)}
                className={QUIET_BUTTON}
              >
                Cancel
              </button>
              <button
                data-testid="event-leave-confirm"
                type="button"
                disabled={busy}
                onClick={() => {
                  setLeaving(false);
                  void run(() => seam.leaveEvent(event.id));
                }}
                className={PRIMARY_BUTTON}
              >
                Leave
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
