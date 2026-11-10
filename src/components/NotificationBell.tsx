// EVT-04 — the bell and its panel. 01-plan.md § 2b, § 4.4 and § 4.5. ADR-050.
//
// **IT WRITES NO NOTIFICATION AND READS NOBODY ELSE'S.** Every row is written by a trigger in
// `supabase/migrations/20261008120000_evt04_notification.sql`, and `notification_select_own` returns
// the caller's own rows and nothing else — admin included (AC-11). What this component shows is
// exactly what the seam returned; nothing here is a control.
//
// **NO LIVE DELIVERY** (01-plan.md § 1). The count is read on mount and whenever the pathname changes;
// the list and the count each time the panel opens; both again after a mark (AC-17). No polling and
// no realtime subscription.
//
// **THE ACTOR IS A NAME FROM `listMemberDirectory()`**, read once on the first open and kept for the
// life of the component, or *Former member* when the directory no longer lists them (AC-14). No
// policy on `public.member` is read for it — INV-04's denominator is untouched.
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { seam } from "@/lib/data";
import type { EventNotification, NotificationKind } from "@/lib/domain/types";

/** EVT-04 AC-14. One English sentence per kind. `actor` is a display name or "Former member";
 *  `event` is `EventNotification.eventName`. The three (c) sentences deliberately do not name who
 *  decided, as EVT-02's `event-my-status` does not (§ 4.4). */
export function notificationSentence(kind: NotificationKind, actor: string, event: string): string {
  switch (kind) {
    case "event_created":
      return `${actor} announced ${event}.`;
    case "event_invited":
      return `${actor} invited you to ${event}.`;
    case "event_updated":
      return `${actor} changed ${event}.`;
    case "event_cancelled":
      return `${actor} cancelled ${event}.`;
    case "attendance_requested":
      return `${actor} asked to join ${event}.`;
    case "attendance_withdrawn":
      return `${actor} withdrew from ${event}.`;
    case "attendance_approved":
      return `Your request to join ${event} was approved.`;
    case "attendance_rejected":
      return `Your request to join ${event} was declined.`;
    case "attendance_removed":
      return `You were removed from ${event}.`;
  }
}

const FORMER_MEMBER = "Former member";

// TopBar's `ICON_BUTTON`, repeated: the bell is the same 32-pixel round icon button the period arrows
// use (§ 2b), and TopBar.tsx changes by one render and one header sentence only (§ 4.5).
const BELL_BUTTON =
  "relative flex h-8 w-8 items-center justify-center rounded-pill text-lg leading-none text-ink-2 " +
  "transition-colors hover:bg-card hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The bell glyph. Inline SVG rather than `lucide-react`, the choice `DayPicker.tsx`, `Sidebar.tsx`
 *  and `ReportIssueButton.tsx` record. */
function BellGlyph(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** The sentence, with the event's name struck through on a cancelled row (§ 2b). The name is the
 *  LAST occurrence: every template puts the event after the actor. */
function Sentence({ n, actor }: { n: EventNotification; actor: string }): JSX.Element {
  const text = notificationSentence(n.kind, actor, n.eventName);
  if (n.kind !== "event_cancelled") return <>{text}</>;
  const at = text.lastIndexOf(n.eventName);
  return (
    <>
      {text.slice(0, at)}
      <s>{n.eventName}</s>
      {text.slice(at + n.eventName.length)}
    </>
  );
}

export default function NotificationBell(): JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EventNotification[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [names, setNames] = useState<Map<string, string> | null>(null);

  // A failed count keeps the last one shown: the bell is not the place to report a read failure.
  const refreshCount = useCallback(async () => {
    try {
      setUnread(await seam.countUnreadNotifications());
    } catch {
      /* the previous count stands */
    }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const [rows, count] = await Promise.all([
        seam.listNotifications(),
        seam.countUnreadNotifications(),
      ]);
      setItems(rows);
      setUnread(count);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  // AC-17. On mount and on every navigation inside the shell.
  useEffect(() => {
    void refreshCount();
  }, [pathname, refreshCount]);

  // AC-14. Opening reads the list and the count; the directory once.
  useEffect(() => {
    if (!open) return;
    void refreshList();
    if (names === null) {
      seam
        .listMemberDirectory()
        .then((rows) => setNames(new Map(rows.map((r) => [r.id, r.displayName]))))
        .catch(() => setNames(new Map()));
    }
  }, [open, names, refreshList]);

  // AC-14. Escape, or a press outside, closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const press = async (n: EventNotification) => {
    if (n.readAt === null) await seam.markNotificationRead(n.id);
    // AC-14, AC-18. A live event is opened — the detail screen decides what the reader may see; a
    // cancelled one leads nowhere.
    if (n.eventId !== null) {
      setOpen(false);
      void refreshCount();
      navigate(`/events/${n.eventId}`);
    } else {
      void refreshList();
    }
  };

  const markAll = async () => {
    await seam.markAllNotificationsRead();
    void refreshList();
  };

  const actorName = (id: string): string => names?.get(id) ?? FORMER_MEMBER;
  const anyUnread = unread > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid="notification-bell"
        data-unread={unread}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={BELL_BUTTON}
      >
        <BellGlyph />
        {anyUnread ? (
          <span
            data-testid="notification-unread-count"
            className="absolute -top-1 -right-1 min-w-4.5 rounded-pill bg-primary px-1 text-center text-[10px] leading-4.5 font-bold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          data-testid="notification-panel"
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-17.5 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-card bg-card shadow-soft sm:absolute sm:inset-x-auto sm:top-10 sm:right-0 sm:w-90"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold text-ink">Notifications</h2>
            {/* AC-15. The count is every unread row, beyond the window — so is the mark. */}
            {anyUnread ? (
              <button
                type="button"
                data-testid="notification-mark-all-read"
                onClick={() => void markAll()}
                className="text-xs font-semibold text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="overflow-y-auto">
            {loadFailed ? (
              <p className="px-4 py-6 text-center text-sm text-ink-2">
                Notifications could not be loaded. Please try again.
              </p>
            ) : items === null ? null : items.length === 0 ? (
              <p data-testid="notification-empty" className="px-4 py-8 text-center text-sm text-ink-2">
                All quiet. When an event concerns you, it lands here.
              </p>
            ) : (
              <ul>
                {items.map((n) => {
                  const isUnread = n.readAt === null;
                  const leads = n.eventId !== null;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        data-testid="notification-item"
                        data-notification-id={n.id}
                        data-kind={n.kind}
                        data-read={isUnread ? "false" : "true"}
                        data-event-id={n.eventId ?? ""}
                        onClick={() => void press(n)}
                        className={
                          "flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 " +
                          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink " +
                          (isUnread ? "bg-field/60 " : "bg-card ") +
                          (leads ? "transition-colors hover:bg-field" : "cursor-default")
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 size-2 shrink-0 rounded-pill ${isUnread ? "bg-primary" : ""}`}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-ink">
                            <Sentence n={n} actor={actorName(n.actorId)} />
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-3">
                            {format(parseISO(n.createdAt), "d MMM, HH:mm")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
