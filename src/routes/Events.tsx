// EVT-01 — the events list. 01-plan.md § 2 AC-20, AC-21; § 2b; § 4.4.
//
// **IT SHOWS WHAT `listEvents()` RETURNS AND FILTERS NOTHING.** Who may read an event is
// `event_select_visible`'s question (and the mock's reproduction of it), never this screen's: a
// filter here would be a second, weaker copy of the policy that could only ever hide more.
//
// Creator names come from `listMemberDirectory()` — the one read that crosses a team boundary, five
// columns wide. A creator who is no longer in it (removed) is **Former member**, never a raw id
// (§ 4.4).
//
// `eventDateLabel` and `EventScopeBadge` are exported for `EventDetail.tsx`, so the row and the
// card cannot draw one event two ways. They live here rather than in a shared module because
// `allowed_paths` has twelve entries and a thirteenth would make this ticket L (01-plan.md § 7).
import { useCallback, useEffect, useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { seam } from "@/lib/data";
import type { CalEvent, DirectoryMember, EventScope } from "@/lib/domain/types";
import Loader from "@/components/Loader";

/** § 2b. The written label is what carries the scope; the colour is decorative. */
const SCOPE_LABELS: Record<EventScope, string> = {
  team: "Own team",
  named: "Limited people", // EVT-12 AC-14. The label only; the value stays `named`.
  public: "Public",
};

/** § 2b. Own team mint, Limited people lavender, Public peach — the pastel set, reused. */
const SCOPE_CLASSES: Record<EventScope, string> = {
  team: "bg-wfh/50 text-wfh-ink",
  named: "bg-holiday/60 text-ink",
  public: "bg-pto/50 text-pto-ink",
};

export interface EventScopeBadgeProps {
  scope: EventScope;
  testId: string;
}

/** The scope, written and tinted. `data-scope` is the enum value, for a spec to read. */
export function EventScopeBadge({ scope, testId }: EventScopeBadgeProps): JSX.Element {
  return (
    <span
      data-testid={testId}
      data-scope={scope}
      className={`inline-flex shrink-0 items-center rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${SCOPE_CLASSES[scope]}`}
    >
      {SCOPE_LABELS[scope]}
    </span>
  );
}

/**
 * § 4.4. `d MMM yyyy` for one day, `d MMM – d MMM yyyy` for a range inside one year, and both years
 * written when the range crosses one — dropping the first year there would say a December-to-January
 * event runs backwards.
 */
export function eventDateLabel(event: Pick<CalEvent, "startDate" | "endDate">): string {
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  if (event.startDate === event.endDate) return format(start, "d MMM yyyy");
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
  }
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
}

/** § 4.4. The creator's display name, or **Former member** when the directory no longer has them. */
export function creatorName(creatorId: string, directory: readonly DirectoryMember[]): string {
  return directory.find((m) => m.id === creatorId)?.displayName ?? "Former member";
}

/** "Today" is the caller's local date, as the calendar screens resolve it (§ 4.4). */
const todayIso = (): string => format(new Date(), "yyyy-MM-dd");

const NEW_BUTTON =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

type LoadState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "ready"; events: CalEvent[]; directory: DirectoryMember[] };

function EventRow({
  event,
  directory,
}: {
  event: CalEvent;
  directory: readonly DirectoryMember[];
}): JSX.Element {
  // AC-20. One compact row; activating it opens the detail page. A link, because the event IS an
  // address a member can share.
  return (
    <li>
      <Link
        data-testid="event-row"
        data-event-id={event.id}
        to={`/events/${event.id}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-card px-4 py-2.5 shadow-soft transition-colors hover:bg-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{event.name}</span>
        <span className="text-xs font-semibold text-ink-2">{eventDateLabel(event)}</span>
        <EventScopeBadge scope={event.scope} testId="event-row-scope" />
        <span className="text-xs text-ink-3">{creatorName(event.creatorId, directory)}</span>
      </Link>
    </li>
  );
}

export default function Events(): JSX.Element {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async (): Promise<void> => {
    try {
      const [events, directory] = await Promise.all([
        seam.listEvents(),
        seam.listMemberDirectory(),
      ]);
      setState({ phase: "ready", events, directory });
    } catch {
      setState({ phase: "failed" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <p role="status" className="mx-auto max-w-2xl p-8 text-center text-sm text-ink-2">
        <Loader label="Loading events…" />
      </p>
    );
  }

  if (state.phase === "failed") {
    return (
      <p role="alert" className="mx-auto max-w-2xl rounded-card bg-card p-8 text-center text-sm text-danger shadow-soft">
        The events could not be loaded. Please try again.
      </p>
    );
  }

  const { events, directory } = state;
  const today = todayIso();

  // AC-20. Upcoming: ends today or later, soonest start first — `listEvents` already orders by start
  // ascending. Past: ended before today, most recent start first.
  const upcoming = events.filter((e) => e.endDate >= today);
  const past = events
    .filter((e) => e.endDate < today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id));

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-extrabold text-ink">Events</h1>
        {/* AC-20 and AC-21 name the same control in two places. It is drawn in exactly ONE of them
            at a time, so the id resolves to one element: here when there is a list, inside
            `events-empty` when there is not. */}
        {events.length > 0 ? (
          <Link data-testid="events-new-button" to="/events/new" className={`ml-auto ${NEW_BUTTON}`}>
            + New event
          </Link>
        ) : null}
      </div>

      {events.length === 0 ? (
        // AC-21. The empty state alone — no empty Upcoming or Past heading is drawn.
        <div
          data-testid="events-empty"
          className="flex flex-col items-center gap-4 rounded-card bg-card px-6 py-10 text-center shadow-soft"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="40"
            height="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="text-holiday"
          >
            <rect x="3" y="5" width="18" height="16" rx="4" />
            <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-bold text-ink">No events yet</p>
          <p className="max-w-sm text-sm text-ink-2">
            Planning a team lunch, an offsite or a farewell? Announce it here so the people it is
            for can find it in one place.
          </p>
          <Link data-testid="events-new-button" to="/events/new" className={NEW_BUTTON}>
            + New event
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <div data-testid="events-upcoming" className="flex flex-col gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Upcoming</h2>
              <ul className="flex flex-col gap-2">
                {upcoming.map((event) => (
                  <EventRow key={event.id} event={event} directory={directory} />
                ))}
              </ul>
            </div>
          ) : null}

          {past.length > 0 ? (
            <div data-testid="events-past" className="flex flex-col gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Past</h2>
              <ul className="flex flex-col gap-2 opacity-80">
                {past.map((event) => (
                  <EventRow key={event.id} event={event} directory={directory} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
