// EVT-01 — one event. 01-plan.md § 2 AC-13, AC-15, AC-16, AC-17, AC-22; § 2b; § 4.4.
//
// **"DOES NOT EXIST" AND "YOU MAY NOT READ IT" ARE ONE SCREEN** — `event-not-found`, and nothing
// else (AC-22). `getEvent` answers null for both because a filtered select cannot tell them apart,
// and this page must not either: a second sentence would be an oracle for which event ids exist.
//
// **THE EDIT AND DELETE CONTROLS AND THE NAMED LIST ARE AFFORDANCES.** They render for the creator
// and for admins (AC-17, AC-13); `event_update_manage`, `event_delete_manage` and
// `event_invitee_select_manage` are the controls, and `listEventInvitees` answers an empty list to
// anybody else whatever this page draws.
//
// EVT-02. Beneath EVT-01's fields, `EventAttendancePanel` — seats, deadline, the join panel, the
// requests and who is coming (01-plan.md § 2 AC-27, § 2b). EVT-01's order above it is unchanged.
//
// EVT-06. Last in the card, `EventGuestPanel` — open, copy and close the guest link (01-plan.md § 2b,
// § 4.4). **AN AFFORDANCE**, drawn for the creator and admins: `event_guest_link_select_manage`,
// `_insert_manage` and `_delete_manage` are the controls, and `getEventGuestLink` answers null to
// anybody else whatever this page draws. A non-manager's load makes no guest-link call (AC-18).
//
// EVT-08. Under it, `EventInvitePanel` — invite addresses by email, and the list of who was invited
// (01-plan.md § 2b, § 4.5); on every scope since EVT-12. **AN AFFORDANCE**, drawn for the creator and
// admins: `invite_to_event` and `event_email_invitation_select_manage` are the controls. A
// non-manager's load makes no invitation call (AC-3). Nothing on it says which addresses belong to
// members (AC-7) — on an Own team or Limited people event the event's people may (EVT-12 AC-10).
//
// EVT-09. The create form may hand this page an `InviteHandoff` through the router's location state
// (01-plan.md § 4.1): the panel then opens holding the send's result, or the error and the addresses
// to resend (AC-3, AC-6). Read once and cleared from history, so a reload shows neither (AC-8).
//
// UIE-12. The reader's own join, status and withdraw left the attendance panel for `EventJoinBar`,
// which stays in view while the page scrolls (01-plan.md § 2b, § 4.3): beside the article from `xl`,
// pinned under it below. One attendance load feeds both. A reader the bar has nothing for gets this
// page exactly as before — one column (AC-6).
//
// The delete confirmation is a dialog; the picker on the form is deliberately not, so the route
// family never stacks one dialog on another (§ 2b).
import { useCallback, useEffect, useState, type JSX } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { seam } from "@/lib/data";
import { mayAdminister } from "@/lib/roles";
import { format, parseISO } from "date-fns";
import type {
  CalEvent,
  DirectoryMember,
  EmailInvitationOutcome,
  EventEmailInvitation,
  EventGuestLink,
  EventScope,
  Member,
} from "@/lib/domain/types";
// EVT-08 AC-10. The ceiling and the shape, as the database's check states them — runtime imports.
import { GUEST_EMAIL_MAX, GUEST_EMAIL_PATTERN } from "@/lib/domain/types";
import Avatar from "@/components/Avatar";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import EventAttendancePanel, {
  seatsTaken,
  useEventAttendance,
  type EventAttendanceLoad,
} from "@/components/EventAttendancePanel";
import EventJoinBar, { joinBarState } from "@/components/EventJoinBar";
import { eventToday, registrationOpen } from "@/lib/event-registration";
import { DescriptionHtml } from "@/components/DescriptionHtml";
import { EventScopeBadge, creatorName, eventDateLabel } from "./Events";

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | {
      phase: "ready";
      event: CalEvent;
      me: Member | null;
      directory: DirectoryMember[];
      invitees: string[];
      // EVT-06. Null when not open — and always null for a non-manager, who never asks.
      guestLink: EventGuestLink | null;
      // EVT-08. Always empty for a non-manager, who never asks.
      invitations: EventEmailInvitation[];
    };

const ACTION_BUTTON =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:border-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The creator, or an admin (ADR-092 decision 2) — the affordance over `event_update_manage`
 *  (AC-17). Admin is asked through `mayAdminister` and never through `mayDecide`: a manager gains
 *  nothing here (Q9, Q24). The database compares no team, so this does not either. */
export function mayEditEvent(event: CalEvent, me: Member | null): boolean {
  return me !== null && (me.id === event.creatorId || mayAdminister(me.role));
}

/** EVT-08 AC-1. Splits on commas, semicolons and whitespace; drops empties. Order kept. */
export function parseInvitationInput(text: string): string[] {
  return text.split(/[,;\s]+/).filter((part) => part !== "");
}

/** EVT-08 AC-10. The entries failing GUEST_EMAIL_MAX or GUEST_EMAIL_PATTERN, in order. */
export function invalidInvitationEmails(emails: string[]): string[] {
  return emails.filter((e) => [...e].length > GUEST_EMAIL_MAX || !GUEST_EMAIL_PATTERN.test(e));
}

/** EVT-12 § 2b, AC-11. The invite hint for a scope; `verb` is "Sending" on the panel and "Creating"
 *  on the create form, used only in the public sentence. */
export function inviteHint(scope: EventScope, verb: "Sending" | "Creating"): string {
  const guests = "Anyone else gets the guest link, which opens this event to guests.";
  switch (scope) {
    case "public":
      return `Each address gets one invitation with the guest link. ${verb} opens this event to guests.`;
    case "team":
      return (
        "Members of other teams are added to this event, which then becomes Limited people: this team " +
        "as it is now, plus them. People who join the team later won't see it. " +
        guests
      );
    case "named":
      return `Members who can't see this event yet are added to its people. ${guests}`;
  }
}

/** EVT-09 § 4. What the create form hands the event page through the router's location state,
 *  after inviting at creation. `invited`: `inviteToEvent`'s outcomes, unchanged. `failed`: the event
 *  exists, the invitation call did not succeed (AC-6). */
export type InviteHandoff =
  | { kind: "invited"; outcomes: EmailInvitationOutcome[] }
  | { kind: "failed"; message: string; emails: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

const isOutcome = (value: unknown): value is EmailInvitationOutcome =>
  isRecord(value) &&
  typeof value.email === "string" &&
  (value.outcome === "sent" || value.outcome === "ignored");

/** EVT-09 AC-3, AC-6, AC-8. `location.state` read as an InviteHandoff, or null unless it is exactly
 *  one of the two shapes. History state is untyped input; anything else is null. */
export function readInviteHandoff(state: unknown): InviteHandoff | null {
  if (!isRecord(state)) return null;
  if (state.kind === "invited" && Array.isArray(state.outcomes) && state.outcomes.every(isOutcome)) {
    return { kind: "invited", outcomes: state.outcomes.map((o) => ({ email: o.email, outcome: o.outcome })) };
  }
  if (state.kind === "failed" && typeof state.message === "string" && isStringArray(state.emails)) {
    return { kind: "failed", message: state.message, emails: [...state.emails] };
  }
  return null;
}

/** EVT-06 AC-1. The guest page's full address. */
export function guestLinkUrl(origin: string, token: string): string {
  return `${origin}/guest/${token}`;
}

export default function EventDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // EVT-09 AC-8. Read once, then dropped from history: the browser keeps `history.state` across a
  // reload, and a reloaded page must not show a send it did not make.
  const [handoff] = useState<InviteHandoff | null>(() => readInviteHandoff(location.state));
  useEffect(() => {
    if (location.state !== null && location.state !== undefined) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!id) {
      setState({ phase: "missing" });
      return;
    }
    try {
      const [event, me, directory, invitees] = await Promise.all([
        seam.getEvent(id),
        seam.getCurrentMember(),
        seam.listMemberDirectory(),
        seam.listEventInvitees(id),
      ]);
      if (!event) {
        setState({ phase: "missing" });
        return;
      }
      // EVT-06, AC-18. Asked only by someone who may manage the event, so nobody else's load
      // changes by a single call.
      // EVT-08, AC-3. The invited list beside it, under the same condition.
      const [guestLink, invitations] = mayEditEvent(event, me)
        ? await Promise.all([seam.getEventGuestLink(id), seam.listEventEmailInvitations(id)])
        : [null, []];
      setState({ phase: "ready", event, me, directory, invitees, guestLink, invitations });
    } catch {
      setState({ phase: "missing" });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <p role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-ink-2">
        <Loader label="Loading the event…" />
      </p>
    );
  }

  if (state.phase === "missing") {
    return (
      <section
        data-testid="event-not-found"
        className="mx-auto flex max-w-xl flex-col gap-4 rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
      >
        <p>We could not find that event.</p>
        <p>
          <Link to="/events" className="font-semibold text-ink underline">
            Back to events
          </Link>
        </p>
      </section>
    );
  }

  const { event, me, directory, invitees, guestLink, invitations } = state;
  const canEdit = mayEditEvent(event, me);

  // EVT-08, AC-5. After a send, the link the invitation opened and the list it grew, re-read so the
  // page never draws what the datastore did not return. EVT-12 AC-6, AC-7: the event and its people
  // too, so a conversion shows its scope and the added member in place. A null event leaves state.
  // MIR-04, ADR-066 2(c): the directory too, because the invite may be what admits the new invitee's name.
  async function onInvited(): Promise<void> {
    try {
      const [fresh, people, link, list, names] = await Promise.all([
        seam.getEvent(event.id),
        seam.listEventInvitees(event.id),
        seam.getEventGuestLink(event.id),
        seam.listEventEmailInvitations(event.id),
        seam.listMemberDirectory(),
      ]);
      if (!fresh) return;
      setState((current) =>
        current.phase === "ready"
          ? { ...current, event: fresh, invitees: people, guestLink: link, invitations: list, directory: names }
          : current,
      );
    } catch {
      // The send succeeded; a failed re-read leaves what is on screen until the next load.
    }
  }

  async function onConfirmDelete(): Promise<void> {
    setDeleting(true);
    setDeleteError(null);
    const result = await seam.deleteEvent(event.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    // AC-15. Gone for every reader; the creator lands on the list.
    navigate("/events");
  }

  // AC-13. Names, never ids; somebody no longer in the directory is a former member.
  const named = invitees.map((memberId) => ({
    memberId,
    person: directory.find((m) => m.id === memberId) ?? null,
  }));

  return (
    <WithEventAttendance event={event}>
      {(attendance) => {
        // § 4.3. The page reads the bar's own answer to choose its arrangement, so it is decided once.
        const barShown =
          joinBarState({
            event,
            me,
            invitees,
            rows: attendance.rows,
            taken: seatsTaken(attendance.rows, attendance.guests),
            open: registrationOpen(event, eventToday()),
          }).kind !== "hidden";
        return (
            <section
              className={
                barShown
                  ? "mx-auto flex max-w-xl flex-col gap-4 xl:grid xl:max-w-[55.5rem] xl:grid-cols-[minmax(0,36rem)_18rem] xl:items-start xl:gap-x-6"
                  : "mx-auto flex max-w-xl flex-col gap-4"
              }
            >
              <Link to="/events" className="self-start text-xs font-semibold text-ink-3 hover:text-ink xl:justify-self-start">
                &lsaquo; Events
              </Link>

              {/* AC-22. Top to bottom: name; date range; scope badge; creator; location; description; and,
                  for the creator and admins on a named-people event, the named list. */}
              <article data-testid="event-detail" className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-soft md:p-8 xl:col-start-1">
                <div className="flex flex-wrap items-start gap-3">
                  <h1 data-testid="event-name" className="min-w-0 flex-1 break-words text-xl font-extrabold text-ink">
                    {event.name}
                  </h1>
                  {canEdit ? (
                    <div className="flex gap-2">
                      <Link data-testid="event-edit-button" to={`/events/${event.id}/edit`} className={ACTION_BUTTON}>
                        Edit
                      </Link>
                      <button
                        data-testid="event-delete-button"
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirming(true);
                        }}
                        className={`${ACTION_BUTTON} hover:border-danger hover:text-danger`}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>

                <p data-testid="event-dates" className="text-sm font-semibold text-ink-2">
                  {eventDateLabel(event)}
                </p>

                <div>
                  <EventScopeBadge scope={event.scope} testId="event-scope" />
                </div>

                <p data-testid="event-creator" data-creator-id={event.creatorId} className="text-sm text-ink-2">
                  Announced by{" "}
                  <span className="font-semibold text-ink">{creatorName(event.creatorId, directory)}</span>
                </p>

                {/* AC-2. Absent, not an empty label, when the event has none. */}
                {event.location !== null ? (
                  <p data-testid="event-location" className="text-sm text-ink-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Where</span>{" "}
                    <span className="text-ink">{event.location}</span>
                  </p>
                ) : null}

                {/* EVT-10 AC-8. Sanitised against ADR-056's allow-list on the way to the DOM. */}
                <DescriptionHtml html={event.description} testId="event-description" />

                {canEdit && event.scope === "named" ? (
                  <div data-testid="event-invitees" className="flex flex-col gap-2 border-t border-line pt-4">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">
                      Invited ({named.length})
                    </h2>
                    {named.length === 0 ? (
                      <p className="text-sm text-ink-3">Nobody is named yet.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {named.map(({ memberId, person }) => (
                          <li
                            key={memberId}
                            data-member-id={memberId}
                            className="flex items-center gap-1.5 rounded-pill bg-field py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-ink"
                          >
                            <Avatar value={person?.avatar ?? ""} className="h-5 w-5 rounded-full" />
                            {person ? person.displayName : "Former member"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                {/* EVT-02, AC-27. UIE-12 § 4.2: the load is the page's, and reloads on `updatedAt` itself. */}
                <EventAttendancePanel event={event} directory={directory} canManage={canEdit} attendance={attendance} />

                {/* EVT-06, AC-2, AC-3. Managers only, last in the card. */}
                {canEdit ? (
                  <EventGuestPanel
                    event={event}
                    link={guestLink}
                    onChange={(next) =>
                      setState((current) => (current.phase === "ready" ? { ...current, guestLink: next } : current))
                    }
                  />
                ) : null}

                {/* EVT-08, AC-1, AC-12. Managers only, under the guest link — on every scope (EVT-12 AC-1). */}
                {canEdit ? (
                  <EventInvitePanel
                    event={event}
                    invitations={invitations}
                    directory={directory}
                    onInvited={onInvited}
                    handoff={handoff}
                  />
                ) : null}
              </article>

              {/* UIE-12 § 2b. Right of the article from `xl`, last in the column below it. */}
              <div className="contents xl:col-start-2 xl:row-start-2 xl:block xl:self-stretch">
                <EventJoinBar event={event} me={me} invitees={invitees} attendance={attendance} />
              </div>

              {confirming ? (
                <Modal testIdPrefix="event-delete" label="Delete this event" onClose={() => setConfirming(false)}>
                  <div className="flex flex-col gap-4 pr-8">
                    {/* AC-15. The confirmation names the event. */}
                    <h2 className="text-lg font-extrabold text-ink">Delete &ldquo;{event.name}&rdquo;?</h2>
                    <p className="text-sm text-ink-2">
                      It will disappear for everyone it was announced to. This cannot be undone.
                    </p>
                    {deleteError !== null ? (
                      <p role="alert" className="text-sm text-danger">
                        {deleteError}
                      </p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <button
                        data-testid="event-delete-cancel"
                        type="button"
                        onClick={() => setConfirming(false)}
                        className={ACTION_BUTTON}
                      >
                        Cancel
                      </button>
                      <button
                        data-testid="event-delete-confirm"
                        type="button"
                        disabled={deleting}
                        onClick={() => void onConfirmDelete()}
                        className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        {deleting ? "Deleting…" : "Delete event"}
                      </button>
                    </div>
                  </div>
                </Modal>
              ) : null}
            </section>
        );
      }}
    </WithEventAttendance>
  );
}

/** UIE-12. `useEventAttendance` needs the event, which exists only past the loading and missing
 *  returns above — so the ready page calls it here, inside a component of its own. */
function WithEventAttendance({
  event,
  children,
}: {
  event: CalEvent;
  children: (attendance: EventAttendanceLoad) => JSX.Element;
}): JSX.Element {
  return children(useEventAttendance(event));
}

type CopyState = "idle" | "copied" | "refused";

/** EVT-06 § 2b. Open, copy and close the guest link. `onChange` reports the link the datastore now
 *  holds, so the page never draws one the datastore did not return. */
function EventGuestPanel({
  event,
  link,
  onChange,
}: {
  event: CalEvent;
  link: EventGuestLink | null;
  onChange: (link: EventGuestLink | null) => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<CopyState>("idle");
  const [confirming, setConfirming] = useState(false);
  const address = link ? guestLinkUrl(window.location.origin, link.token) : "";

  async function onOpen(): Promise<void> {
    setBusy(true);
    setError(null);
    setCopy("idle");
    const result = await seam.openEventToGuests(event.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onChange(result.value);
  }

  async function onClose(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await seam.closeEventToGuests(event.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setConfirming(false);
    setCopy("idle");
    onChange(null);
  }

  // AC-8. Where the browser refuses the clipboard, the address stays on screen to copy by hand.
  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopy("copied");
    } catch {
      setCopy("refused");
    }
  }

  return (
    <div data-testid="event-guest-panel" className="flex flex-col gap-2 border-t border-line pt-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Guest link</h2>
      <p className="text-sm text-ink-2">
        Anyone with the link can see this event and who is coming, without signing in.
      </p>

      {link ? (
        <>
          <div className="flex gap-2">
            <input
              data-testid="event-guest-link"
              type="text"
              readOnly
              value={address}
              aria-label="Guest link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-pill bg-field px-3 py-1.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              data-testid="event-guest-copy-button"
              type="button"
              onClick={() => void onCopy()}
              className={ACTION_BUTTON}
            >
              Copy
            </button>
          </div>
          <p data-testid="event-guest-copied" role="status" aria-live="polite" className="text-xs text-ink-2">
            {copy === "copied"
              ? "Copied"
              : copy === "refused"
                ? "Copying is blocked here. Select the address and copy it yourself."
                : ""}
          </p>
        </>
      ) : null}

      {error !== null && !confirming ? (
        <p data-testid="event-guest-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div>
        {link ? (
          <button
            data-testid="event-guest-close-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
            className="text-xs font-semibold text-danger underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Close the link
          </button>
        ) : (
          <button
            data-testid="event-guest-open-button"
            type="button"
            disabled={busy}
            onClick={() => void onOpen()}
            className={`${ACTION_BUTTON} disabled:opacity-50`}
          >
            {busy ? "Opening…" : "Open to guests"}
          </button>
        )}
      </div>

      {confirming ? (
        <Modal testIdPrefix="event-guest-close" label="Close the guest link" onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-4 pr-8">
            <h2 className="text-lg font-extrabold text-ink">Close the guest link?</h2>
            <p className="text-sm text-ink-2">
              The link will stop working for everyone who has it. Opening it again makes a new link.
            </p>
            {error !== null ? (
              <p data-testid="event-guest-error" role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                data-testid="event-guest-close-cancel"
                type="button"
                onClick={() => setConfirming(false)}
                className={ACTION_BUTTON}
              >
                Cancel
              </button>
              <button
                data-testid="event-guest-close-confirm"
                type="button"
                disabled={busy}
                onClick={() => void onClose()}
                className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {busy ? "Closing…" : "Close the link"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// Repeated from the seam's `invalid_invitation_email` sentence, so the panel's own check and the
// datastore's refusal read the same.
const INVITE_INVALID = "Each address must look like name@example.com, in 254 characters or fewer.";

// EVT-09 AC-6. Prefixed to the refusal's own sentence when the event exists and the send did not.
const INVITE_NOT_SENT = "The event was created, but the invitations were not sent.";

const PRIMARY_BUTTON =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** EVT-08 § 2b. Invite addresses by email, and the list of who was invited. `onInvited` re-reads the
 *  guest link and the list after a send (AC-5). Every address is drawn the same way whoever owns it —
 *  the panel is never told (AC-7). */
function EventInvitePanel({
  event,
  invitations,
  directory,
  onInvited,
  handoff,
}: {
  event: CalEvent;
  invitations: EventEmailInvitation[];
  directory: DirectoryMember[];
  onInvited: () => Promise<void>;
  /** EVT-09 § 4.1. Seeds the starting state when the create form invited; null is EVT-08's. */
  handoff: InviteHandoff | null;
}): JSX.Element {
  const [text, setText] = useState(() => (handoff?.kind === "failed" ? handoff.emails.join(", ") : ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    handoff?.kind === "failed" ? `${INVITE_NOT_SENT} ${handoff.message}` : null,
  );
  const [malformed, setMalformed] = useState<string[]>([]);
  const [result, setResult] = useState<EmailInvitationOutcome[] | null>(() =>
    handoff?.kind === "invited" ? handoff.outcomes : null,
  );

  async function onSend(): Promise<void> {
    const emails = parseInvitationInput(text);
    const bad = invalidInvitationEmails(emails);
    setResult(null);
    // AC-10. Nothing leaves the page; the field keeps what was typed.
    if (emails.length === 0 || bad.length > 0) {
      setError(INVITE_INVALID);
      setMalformed(bad);
      return;
    }
    setBusy(true);
    setError(null);
    setMalformed([]);
    const sent = await seam.inviteToEvent(event.id, emails);
    if (!sent.ok) {
      setBusy(false);
      setError(sent.error.message);
      return;
    }
    setResult(sent.value);
    setText("");
    await onInvited();
    setBusy(false);
  }

  const invited = result?.filter((r) => r.outcome === "sent") ?? [];
  const already = result?.filter((r) => r.outcome === "ignored") ?? [];

  return (
    <div data-testid="event-invite-panel" className="flex flex-col gap-2 border-t border-line pt-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Invite by email</h2>

      <p data-testid="event-invite-hint" className="text-sm text-ink-2">
        {inviteHint(event.scope, "Sending")}
      </p>
      <textarea
        data-testid="event-invite-input"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="name@example.com, another@example.com"
        aria-label="Email addresses"
        className="w-full rounded-card bg-field px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      />
      {error !== null ? (
        <div data-testid="event-invite-error" role="alert" className="text-sm text-danger">
          <p>{error}</p>
          {malformed.length > 0 ? (
            <p className="break-all font-semibold">{malformed.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          data-testid="event-invite-submit"
          type="button"
          disabled={busy || text.trim() === ""}
          onClick={() => void onSend()}
          className={PRIMARY_BUTTON}
        >
          {busy ? "Sending…" : "Send invitations"}
        </button>
      </div>
      {result !== null ? (
        <div data-testid="event-invite-result" role="status" className="flex flex-col gap-2">
          {invited.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-ink-2">Invited</h3>
              <ul data-testid="event-invite-sent" className="flex flex-wrap gap-1.5">
                {invited.map((r) => (
                  <li
                    key={r.email}
                    data-email={r.email}
                    className="break-all rounded-pill bg-wfh px-2.5 py-0.5 text-xs font-semibold text-ink"
                  >
                    {r.email}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {already.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-ink-2">Already invited</h3>
              <ul data-testid="event-invite-ignored" className="flex flex-wrap gap-1.5">
                {already.map((r) => (
                  <li
                    key={r.email}
                    data-email={r.email}
                    className="break-all rounded-pill bg-field px-2.5 py-0.5 text-xs font-semibold text-ink"
                  >
                    {r.email}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div data-testid="event-invited-list" className="flex flex-col gap-1">
        <h3 className="text-xs font-bold text-ink-2">Invited by email ({invitations.length})</h3>
        {invitations.length === 0 ? (
          <p className="text-sm text-ink-3">Nobody has been invited by email yet.</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {invitations.map((i) => (
              <li
                key={i.id}
                data-testid="event-invited-row"
                data-email={i.email}
                className="flex flex-wrap items-baseline gap-x-2 text-sm"
              >
                <span className="break-all text-ink">{i.email}</span>
                <span className="text-xs text-ink-3">
                  {format(parseISO(i.createdAt), "d MMM yyyy")} · by{" "}
                  {directory.find((m) => m.id === i.invitedBy)?.displayName ?? "Former member"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
