// EVT-02 — who is coming, and the controls to join, leave and decide. 01-plan.md § 2 AC-6 to AC-22,
// AC-27, AC-29; § 2b; § 4.5.
//
// **EVERY CONTROL HERE IS AN AFFORDANCE, NOT A CONTROL (ADR-005).** The join button renders only for
// the audience, with registration open, no attendance and — without approval — a seat free; approve
// is disabled when full; leave only while registration is open; the requests and the remove controls
// only for the creator and admins. What refuses each write is a policy or a trigger in
// `supabase/migrations/20260929140000_evt02_attendance.sql`, whatever this panel draws — above all
// the cap, which `event_attendance_guard` holds under the event row's lock (ADR-045). Nothing here
// counts seats in order to decide whether a write is allowed.
//
// **NAMES COME FROM THE DIRECTORY AND NOWHERE ELSE** (AC-23). An attendance is ids and a state; a
// person the directory no longer lists is a *Former member* (AC-21, AC-26).
//
// Remove and leave each confirm in the existing `Modal`, never stacked on another dialog (§ 2b).
//
// EVT-07 — 01-plan.md § 2 AC-14..AC-17; § 2b; § 4.4. Guests sit in the same Requests and Going lists,
// merged with members by join order, and count in the seats line. A guest's name is what they gave;
// their email is drawn only when `listEventGuests` filled it, which it does for the creator and
// admins alone (AC-15). Approve, reject and remove go through `decideGuest`; `event_guest_guard` and
// `event_guest_update_manage` are the controls.
//
// UIE-12 — 01-plan.md § 4.2. **THE READER'S OWN ROW LEFT THIS PANEL FOR `EventJoinBar`**: the join
// button, the status sentence, withdraw and its dialog. The load moved into `useEventAttendance`,
// called once by `EventDetail` and handed to both, so the bar and the panel read one list and share
// one `busy`. What stays here — seats, deadline, requests, *Going*, the two remove dialogs — is
// unchanged, test ids included.
import { useCallback, useEffect, useState, type JSX } from "react";
import { format, parseISO } from "date-fns";
import { seam } from "@/lib/data";
import { mayAdminister } from "@/lib/roles";
import type {
  CalEvent,
  DirectoryMember,
  EventAttendance,
  EventGuest,
  Member,
} from "@/lib/domain/types";
import { eventToday, registrationOpen } from "@/lib/event-registration";
import Avatar from "@/components/Avatar";
import Modal from "@/components/Modal";

export interface EventAttendancePanelProps {
  event: CalEvent;
  directory: DirectoryMember[];
  /** The creator or an admin — the affordance over `event_attendance_update_manage`. */
  canManage: boolean;
  attendance: EventAttendanceLoad;
}

type WriteResult = { ok: true } | { ok: false; error: { message: string } };

/** UIE-12 § 4.2. One load of the attendance and the guests, shared by the panel and the join bar. */
export interface EventAttendanceLoad {
  /** `null` until the first load answers; `[]` after a failed load. */
  rows: EventAttendance[] | null;
  guests: EventGuest[];
  /** True after a failed load — the panel shows today's sentence for it. */
  loadFailed: boolean;
  /** One write at a time, across the bar and the panel. */
  busy: boolean;
  /** Runs one write, then reloads both lists. Resolves the write's message on failure, else null. */
  run(write: () => Promise<WriteResult>): Promise<string | null>;
}

/** Loads on mount and whenever `event.id` or `event.updatedAt` changes — the job the
 *  `key={event.updatedAt}` remount on the panel used to do. */
export function useEventAttendance(event: CalEvent): EventAttendanceLoad {
  const [rows, setRows] = useState<EventAttendance[] | null>(null);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const eventId = event.id;
  const updatedAt = event.updatedAt;

  const load = useCallback(async (): Promise<void> => {
    try {
      // EVT-07. Guests beside the attendance, in one load.
      const [attendance, guestRows] = await Promise.all([
        seam.listEventAttendance(eventId),
        seam.listEventGuests(eventId),
      ]);
      setRows(attendance);
      setGuests(guestRows);
      setLoadFailed(false);
    } catch {
      setRows([]);
      setGuests([]);
      setLoadFailed(true);
    }
  }, [eventId]);

  // `updatedAt` is in the list only to reload after an edit elsewhere.
  useEffect(() => {
    void load();
  }, [load, updatedAt]);

  const run = useCallback(
    async (write: () => Promise<WriteResult>): Promise<string | null> => {
      setBusy(true);
      const result = await write();
      setBusy(false);
      await load();
      return result.ok ? null : result.error.message;
    },
    [load],
  );

  return { rows, guests, loadFailed, busy, run };
}

/** Members and guests attending — the seats taken. */
export function seatsTaken(rows: readonly EventAttendance[] | null, guests: readonly EventGuest[]): number {
  return (
    (rows ?? []).filter((a) => a.status === "attending").length +
    guests.filter((g) => g.status === "attending").length
  );
}

const QUIET_BUTTON =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:border-ink-3 hover:text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * `public.is_event_audience`, as far as the screen can see it — an affordance. No admin clause
 * (AC-11). On a named event a non-admin reader who is not the creator can only be reading it because
 * they are named or already on it, and `listEventInvitees` answers them an empty list, so the scope
 * alone is the answer; an admin reads the named list and is checked against it.
 */
export function inAudience(event: CalEvent, me: Member | null, invitees: readonly string[]): boolean {
  if (me === null || me.teamId === null || me.status !== "approved" || me.removedAt !== null) return false;
  if (me.id === event.creatorId) return true;
  switch (event.scope) {
    case "public":
      return true;
    case "team":
      return me.teamId === event.teamId;
    case "named":
      return mayAdminister(me.role) ? invitees.includes(me.id) : true;
  }
}

/** EVT-07. One row of a merged list — a member's attendance or a guest — in join order. */
type Seat = { kind: "member"; row: EventAttendance } | { kind: "guest"; row: EventGuest };

const seatKey = (s: Seat): string => (s.kind === "member" ? s.row.memberId : s.row.id);

/** `created_at`, then the row's id — `list_guest_event_attendees`' order. */
function byJoinOrder(a: Seat, b: Seat): number {
  return a.row.createdAt.localeCompare(b.row.createdAt) || seatKey(a).localeCompare(seatKey(b));
}

/** EVT-07 § 2b. No avatar; the name as given; a small *Guest* tag; the email only when it was read. */
function GuestPill({ guest }: { guest: EventGuest }): JSX.Element {
  return (
    <>
      {guest.name}
      <span className="text-[10px] font-semibold text-ink-3">Guest</span>
      {guest.email !== null ? (
        <span data-testid="event-guest-email" className="font-normal text-ink-3">
          {guest.email}
        </span>
      ) : null}
    </>
  );
}

const REMOVE_ICON = (
  // An SVG, not the multiplication sign — Modal.tsx records why.
  <svg
    viewBox="0 0 16 16"
    width="8"
    height="8"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

function PersonPill({
  memberId,
  directory,
}: {
  memberId: string;
  directory: readonly DirectoryMember[];
}): JSX.Element {
  const person = directory.find((m) => m.id === memberId) ?? null;
  return (
    <>
      <Avatar value={person?.avatar ?? ""} className="h-5 w-5 rounded-full" />
      {person ? person.displayName : "Former member"}
    </>
  );
}

export default function EventAttendancePanel({
  event,
  directory,
  canManage,
  attendance,
}: EventAttendancePanelProps): JSX.Element {
  const { rows, guests, loadFailed, busy } = attendance;
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removingGuest, setRemovingGuest] = useState<EventGuest | null>(null);

  async function run(write: () => Promise<WriteResult>): Promise<boolean> {
    setError(null);
    const message = await attendance.run(write);
    if (message !== null) setError(message);
    return message === null;
  }

  const all = rows ?? [];
  // EVT-07 AC-14, AC-16. Members and guests together, in join order.
  const seats = [
    ...all.map((row): Seat => ({ kind: "member", row })),
    ...guests.map((row): Seat => ({ kind: "guest", row })),
  ].sort(byJoinOrder);
  const attendees = seats.filter((s) => s.row.status === "attending");
  const pending = seats.filter((s) => s.row.status === "pending");
  const taken = attendees.length;
  const full = event.capacity !== null && taken >= event.capacity;
  const open = registrationOpen(event, eventToday());
  const closesOn = event.registrationDeadline ?? event.endDate;
  const shownError = error ?? (loadFailed ? "We could not load who is coming. Please reload the page." : null);

  const removingName =
    removing === null
      ? ""
      : (directory.find((m) => m.id === removing)?.displayName ?? "Former member");

  return (
    <div data-testid="event-attendance" className="flex flex-col gap-4 border-t border-line pt-4">
      {/* AC-27. The seats line beside the deadline line. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          data-testid="event-seats"
          data-taken={taken}
          data-capacity={event.capacity ?? ""}
          className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${full ? "bg-overload text-ink" : "bg-field text-ink-2"}`}
        >
          {taken} going
          {event.capacity === null ? null : full ? " · Full" : ` · ${event.capacity} seats`}
        </span>
        <span data-testid="event-deadline" data-open={open ? "true" : "false"} className="text-xs text-ink-2">
          {open ? `Registration open until ${format(parseISO(closesOn), "d MMM yyyy")}` : "Registration closed"}
        </span>
        {event.requiresApproval ? (
          <span className="text-xs text-ink-3">· Joining needs approval</span>
        ) : null}
      </div>

      {shownError !== null ? (
        <p data-testid="event-attendance-error" role="alert" className="text-sm text-danger">
          {shownError}
        </p>
      ) : null}

      {/* AC-22. The creator and admins only, and only when non-empty. */}
      {canManage && pending.length > 0 ? (
        <div data-testid="event-requests" className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Requests ({pending.length})</h2>
          <ul className="flex flex-col gap-2">
            {pending.map((s) =>
              s.kind === "guest" ? (
                <li
                  key={s.row.id}
                  data-testid="event-guest-request"
                  data-guest-id={s.row.id}
                  className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink"
                >
                  <span className="flex items-center gap-1.5">
                    <GuestPill guest={s.row} />
                  </span>
                  <span className="ml-auto flex gap-2">
                    <button
                      data-testid="event-guest-request-approve"
                      type="button"
                      // AC-16. Disabled when full — the guard's EV001 is the control.
                      disabled={busy || full}
                      onClick={() => void run(() => seam.decideGuest(s.row.id, "attending"))}
                      className={QUIET_BUTTON}
                    >
                      Approve
                    </button>
                    <button
                      data-testid="event-guest-request-reject"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => seam.decideGuest(s.row.id, "rejected"))}
                      className={QUIET_BUTTON}
                    >
                      Reject
                    </button>
                  </span>
                </li>
              ) : (
              <li
                key={s.row.memberId}
                data-testid="event-request"
                data-member-id={s.row.memberId}
                className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink"
              >
                <span className="flex items-center gap-1.5">
                  <PersonPill memberId={s.row.memberId} directory={directory} />
                </span>
                <span className="ml-auto flex gap-2">
                  <button
                    data-testid="event-request-approve"
                    type="button"
                    // AC-8. Disabled when full — the guard's EV001 is the control.
                    disabled={busy || full}
                    onClick={() => void run(() => seam.decideAttendance(event.id, s.row.memberId, "attending"))}
                    className={QUIET_BUTTON}
                  >
                    Approve
                  </button>
                  <button
                    data-testid="event-request-reject"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => seam.decideAttendance(event.id, s.row.memberId, "rejected"))}
                    className={QUIET_BUTTON}
                  >
                    Reject
                  </button>
                </span>
              </li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      {/* AC-21. Every reader of the event sees who is coming, whatever team each is on. */}
      <div data-testid="event-attendees" className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Going ({taken})</h2>
        {rows !== null && attendees.length === 0 ? (
          <p data-testid="event-attendees-empty" className="text-sm text-ink-3">
            Nobody has joined yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {attendees.map((s) =>
              s.kind === "guest" ? (
                <li
                  key={s.row.id}
                  data-testid="event-guest-attendee"
                  data-guest-id={s.row.id}
                  className="flex items-center gap-1.5 rounded-pill bg-field py-0.5 pl-2.5 pr-2.5 text-xs font-semibold text-ink"
                >
                  <GuestPill guest={s.row} />
                  {canManage ? (
                    <button
                      data-testid="event-guest-attendee-remove"
                      type="button"
                      aria-label="Remove from the list"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setRemovingGuest(s.row);
                      }}
                      className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-ink-3 hover:bg-line hover:text-ink"
                    >
                      {REMOVE_ICON}
                    </button>
                  ) : null}
                </li>
              ) : (
              <li
                key={s.row.memberId}
                data-testid="event-attendee"
                data-member-id={s.row.memberId}
                className="flex items-center gap-1.5 rounded-pill bg-field py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-ink"
              >
                <PersonPill memberId={s.row.memberId} directory={directory} />
                {canManage ? (
                  <button
                    data-testid="event-attendee-remove"
                    type="button"
                    aria-label="Remove from the list"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setRemoving(s.row.memberId);
                    }}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-ink-3 hover:bg-line hover:text-ink"
                  >
                    {REMOVE_ICON}
                  </button>
                ) : null}
              </li>
              ),
            )}
          </ul>
        )}
      </div>

      {removing !== null ? (
        <Modal testIdPrefix="event-remove" label="Remove from this event" onClose={() => setRemoving(null)}>
          <div className="flex flex-col gap-4 pr-8">
            {/* AC-29. The confirmation names the person. */}
            <h2 className="text-lg font-extrabold text-ink">Remove {removingName}?</h2>
            <p className="text-sm text-ink-2">
              They will be taken off the list for &ldquo;{event.name}&rdquo; and cannot join it again.
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="event-remove-cancel"
                type="button"
                onClick={() => setRemoving(null)}
                className={QUIET_BUTTON}
              >
                Cancel
              </button>
              <button
                data-testid="event-remove-confirm"
                type="button"
                disabled={busy}
                onClick={() => {
                  const memberId = removing;
                  setRemoving(null);
                  void run(() => seam.decideAttendance(event.id, memberId, "removed"));
                }}
                className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {removingGuest !== null ? (
        <Modal
          testIdPrefix="event-guest-remove"
          label="Remove a guest from this event"
          onClose={() => setRemovingGuest(null)}
        >
          <div className="flex flex-col gap-4 pr-8">
            {/* EVT-07 AC-17. The confirmation names the guest. */}
            <h2 className="text-lg font-extrabold text-ink">Remove {removingGuest.name}?</h2>
            <p className="text-sm text-ink-2">
              They will be taken off the list for &ldquo;{event.name}&rdquo; and cannot register again with
              this email.
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="event-guest-remove-cancel"
                type="button"
                onClick={() => setRemovingGuest(null)}
                className={QUIET_BUTTON}
              >
                Cancel
              </button>
              <button
                data-testid="event-guest-remove-confirm"
                type="button"
                disabled={busy}
                onClick={() => {
                  const guestId = removingGuest.id;
                  setRemovingGuest(null);
                  void run(() => seam.decideGuest(guestId, "removed"));
                }}
                className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
