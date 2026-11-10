// EVT-06 — the guest page, `/guest/:token`. 01-plan.md § 2 AC-9..AC-17; § 2b; § 4.4. ADR-052.
//
// **THE PAGE KNOWS ONE FACT ABOUT THE SESSION: WHETHER IT IS AN APPROVED MEMBER'S** (EVT-13, ADR-061
// decision 8, which replaces AC-16 for a reader of the event). That member is asked about first —
// `getGuestLinkEventId` — and a reader of the event is sent on to `/events/<id>`, replacing this
// history entry so Back does not bounce them forward again. A signed-out caller, a pending, rejected,
// removed or member-less session, and an approved member who cannot read the event all see exactly
// the same page; the definer function, not this page, decides who is a reader. It renders inside
// `BareLayout`, so there is no sidebar, no top bar and no sign-in screen (AC-9).
//
// **"NEVER EXISTED", "MALFORMED", "CLOSED" AND "DELETED" ARE ONE SCREEN** — `guest-event-not-found`,
// one sentence, nothing onward (AC-13). A failed read is the same screen too: a second sentence for
// it would be an oracle for which tokens were once good.
//
// **WHAT IS DRAWN IS WHAT `GuestEvent` CARRIES, AND IT CARRIES ONLY AC-12'S FIELDS.** No creator,
// scope, deadline or avatar is on this page because none reaches it.
//
// EVT-07 — 01-plan.md § 2 AC-1..AC-14, AC-20, AC-22; § 2b; § 4.4. ADR-052.
//
// **THE REGISTER BLOCK LEARNS TWO FACTS FROM ITS OWN READ**, `getGuestRegistrationTerms` (AC-22), so
// `GuestEvent` keeps exactly EVT-06's fields. A null or failed terms read leaves the page as EVT-06
// draws it, with no form. Every check here is an AFFORDANCE: `register_guest` and
// `event_guest_guard` refuse what this page lets through (ADR-005).
//
// **THE MANAGE TOKEN IS ON SCREEN ONCE**, in the block that replaces the form after registering, and
// is held in that component's state and nowhere else — no storage, no URL of this page (AC-3).
//
// UIE-12 — 01-plan.md § 2 AC-11..AC-13, AC-15; § 2b; § 4.4. **THE REGISTER BLOCK LEFT THE CARD**
// for `guest-join-bar`, a sibling after it that stays in view while the page scrolls: beside the card
// from `xl`, pinned to the bottom of the screen below. What it holds is `GuestRegisterPanel` as EVT-07
// shipped it — same states, same test ids; only its outer classes changed. A null terms read still
// draws no block, and the page is EVT-06's single column.
//
// EVT-14 — 01-plan.md § 2 AC-1..AC-6, AC-11, AC-12; § 2b; § 4.3. **A SIGNED-OUT READER IS OFFERED
// SIGN-IN AND SIGN-UP**, in `guest-auth-prompt`, a sticky strip above the page on a `ready` event and
// nowhere else — never to a signed-in caller in any state (AC-2), never while loading, on the
// not-found screen or on the manage page (AC-3). *Sign in* carries the way back to this address
// (`signInReturningTo`); *Sign up* carries nothing (Q4-C). Dismissing it is component state only, so a
// remount shows it again and nothing is written anywhere (AC-6). Both are links to public screens: an
// affordance, granting nothing (ADR-005).
//
// **THE MANAGE PAGE, `/guest/registration/:token`, IS THE NAMED EXPORT `GuestRegistration`**, sharing
// `useGuestMeta` and the card. "Never existed", "malformed" and a failed read are one screen (AC-13).
import { useCallback, useEffect, useState, type FormEvent, type JSX } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { seam } from "@/lib/data";
import { signInReturningTo } from "@/lib/return-to";
import type {
  GuestEvent as GuestEventData,
  GuestRegistrationReceipt,
  GuestRegistrationTerms,
  GuestRegistrationView,
  GuestStatus,
} from "@/lib/domain/types";
import { GUEST_EMAIL_MAX, GUEST_EMAIL_PATTERN, GUEST_NAME_MAX } from "@/lib/domain/types";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import { DescriptionHtml } from "@/components/DescriptionHtml";
import { eventDateLabel } from "./Events";

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; event: GuestEventData; terms: GuestRegistrationTerms | null };

/** EVT-07 AC-3. The manage link — `<origin>/guest/registration/<manage-token>`. */
export function guestManageUrl(origin: string, token: string): string {
  return `${origin}/guest/registration/${token}`;
}

/** EVT-07 AC-4. § 4.1's checks on the trimmed values, as the table's checks state them — lengths in
 *  code points, as `char_length` counts. An affordance; the seam and the database check again. */
export function guestRegistrationProblem(
  name: string,
  email: string,
): "invalid_guest_name" | "invalid_guest_email" | null {
  const n = name.trim();
  const e = email.trim();
  if (n === "" || [...n].length > GUEST_NAME_MAX) return "invalid_guest_name";
  if ([...e].length > GUEST_EMAIL_MAX || !GUEST_EMAIL_PATTERN.test(e)) return "invalid_guest_email";
  return null;
}

// The sentences the form shows for its own two checks — the seam's, word for word.
const PROBLEM_TEXT: Record<"invalid_guest_name" | "invalid_guest_email", string> = {
  invalid_guest_name: "Please give your name, in 100 characters or fewer.",
  invalid_guest_email: "Please give a valid email address, in 254 characters or fewer.",
};

/** AC-9. The seats line's three strings. */
export function guestSeatsLabel(capacity: number | null, seatsTaken: number): string {
  if (capacity === null) return "No seat limit";
  if (seatsTaken >= capacity) return "Full";
  return `${capacity - seatsTaken} of ${capacity} seats left`;
}

/** AC-15. The two `<meta>` tags, on this page only — added on mount and removed on unmount, so no
 *  other address carries them once the reader leaves. */
function useGuestMeta(): void {
  useEffect(() => {
    const tags = [
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ].map(({ name, content }) => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", name);
      meta.setAttribute("content", content);
      document.head.appendChild(meta);
      return meta;
    });
    return () => {
      for (const meta of tags) meta.remove();
    };
  }, []);
}

const CARD = "flex flex-col gap-4 rounded-card bg-card p-6 shadow-soft md:p-8";

const PRIMARY_BUTTON =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const QUIET_BUTTON =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:border-ink-3 hover:text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const FIELD =
  "w-full rounded-pill bg-field px-3 py-2 text-sm text-ink focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function GuestEvent({
  signedInMember,
  signedOut,
}: {
  signedInMember: boolean;
  signedOut: boolean;
}): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  // EVT-14 AC-6. This page view only: a remount — a reload, a new token — shows the prompt again.
  const [promptDismissed, setPromptDismissed] = useState(false);
  useGuestMeta();

  useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    void (async () => {
      // EVT-13 AC-1, AC-8. Asked on every opening, and only for an approved member (AC-4, AC-5). A
      // failed read is read as "not a reader": the guest page is never lost to it.
      if (signedInMember) {
        const eventId = await seam.getGuestLinkEventId(token ?? "").catch(() => null);
        if (!live) return;
        if (eventId !== null) {
          // The state stays `loading`, so no guest content is drawn before the redirect.
          navigate(`/events/${eventId}`, { replace: true });
          return;
        }
      }
      try {
        // EVT-07 AC-22. The terms read failing never costs the guest the page EVT-06 draws.
        const terms = seam.getGuestRegistrationTerms(token ?? "").catch(() => null);
        const [event, termsRead] = await Promise.all([seam.getGuestEvent(token ?? ""), terms]);
        if (live) {
          setState(event ? { phase: "ready", event, terms: termsRead } : { phase: "missing" });
        }
      } catch {
        if (live) setState({ phase: "missing" });
      }
    })();
    return () => {
      live = false;
    };
  }, [token, signedInMember, navigate]);

  // EVT-07 AC-1. After a registration, the seats and the names are read again in place — no loading
  // phase, so the block holding the manage link is not unmounted.
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const event = await seam.getGuestEvent(token ?? "");
      if (event) setState((s) => (s.phase === "ready" ? { ...s, event } : s));
    } catch {
      // The registration stands; a stale count is the cost.
    }
  }, [token]);

  const barShown = state.phase === "ready" && state.terms !== null;
  // EVT-14 AC-1..AC-3. Signed out, and an event to come back to.
  const promptShown = signedOut && state.phase === "ready" && !promptDismissed;

  return (
    <>
      {/* EVT-14 § 2b. A sibling before the section, not inside its grid, so UIE-12's columns and row
          placements are untouched; the section's own width, so the two line up. */}
      {promptShown ? (
        <GuestAuthPrompt
          token={token ?? ""}
          width={barShown ? "max-w-xl xl:max-w-[55.5rem]" : "max-w-xl"}
          onDismiss={() => setPromptDismissed(true)}
        />
      ) : null}
      <section
        className={
          barShown
            ? "mx-auto flex max-w-xl flex-col gap-3 xl:grid xl:max-w-[55.5rem] xl:grid-cols-[minmax(0,36rem)_18rem] xl:items-start xl:gap-x-6"
            : "mx-auto flex max-w-xl flex-col gap-3"
        }
      >
        {/* § 2b. The product name, not a link: a guest has nowhere in it to go. UIE-12: over the card. */}
        <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-3">CaleChip</p>

        {state.phase === "loading" ? (
          <p role="status" className="p-8 text-center text-sm text-ink-2">
            <Loader label="Loading the event…" />
          </p>
        ) : state.phase === "missing" ? (
          <div data-testid="guest-event-not-found" className={`${CARD} text-center text-sm text-ink-2`}>
            <p>This link does not work. It may have been closed, or the address may be incomplete.</p>
          </div>
        ) : (
          <>
            <GuestEventCard event={state.event} />
            {/* UIE-12 § 2b, § 4.4. Right of the card from `xl`, pinned to the bottom of the screen below.
                The wrapper is `contents` below `xl` so the block's sticky range is the whole column. */}
            {state.terms ? (
              <div className="contents xl:col-start-2 xl:row-start-2 xl:block xl:self-stretch">
                <div
                  data-testid="guest-join-bar"
                  className={`sticky bottom-0 z-10 rounded-card bg-card p-5 shadow-soft xl:bottom-auto ${
                    // EVT-14 § 2b, AC-4. From `xl` both are pinned to the top; below the prompt while
                    // it is shown, so neither covers the other. Below `xl` they are at opposite ends.
                    promptShown ? "xl:top-24" : "xl:top-6"
                  }`}
                >
                  <GuestRegisterPanel
                    token={token ?? ""}
                    event={state.event}
                    terms={state.terms}
                    onRegistered={() => void refresh()}
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

/**
 * EVT-14 § 2b, § 4.3 — the sign-in and sign-up prompt. `sticky top-0` over the join bar's `z-10`
 * (AC-5); one line from `sm`, wrapping below. No navigation but its two links (AC-12, EVT-06 AC-9).
 * `width` is the section's, so the two edges line up whether or not UIE-12's grid is in use.
 */
function GuestAuthPrompt({
  token,
  width,
  onDismiss,
}: {
  token: string;
  width: string;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <aside
      data-testid="guest-auth-prompt"
      aria-label="Sign in or sign up"
      className={`sticky top-0 z-20 mx-auto mb-3 w-full ${width} rounded-card bg-card shadow-soft`}
    >
      {/* `cc-orbit` (index.css) runs a pastel highlight round the whole prompt. It cannot sit on the
          aside, whose `sticky` its `position: relative` would undo, so it is this inner frame. */}
      <div className="cc-orbit">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-3xl bg-card px-4 py-3">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-semibold text-ink">Have a CaleChip account? Sign in to join as yourself.</p>
            <p className="text-xs text-ink-3">New accounts are approved by an admin before they can be used.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              data-testid="guest-auth-prompt-signin"
              to={signInReturningTo(`/guest/${token}`)}
              className={PRIMARY_BUTTON}
            >
              Sign in
            </Link>
            <Link data-testid="guest-auth-prompt-signup" to="/signup" className={QUIET_BUTTON}>
              Sign up
            </Link>
            <button
              data-testid="guest-auth-prompt-dismiss"
              type="button"
              aria-label="Dismiss"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {/* An SVG and not a typed U+00D7, which the § Language lint rule matches — as `Modal.tsx`. */}
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function GuestEventCard({ event }: { event: GuestEventData }): JSX.Element {
  const full = event.capacity !== null && event.seatsTaken >= event.capacity;
  const names = event.attendeeNames;

  // AC-9. Top to bottom: name; dates; location; description; seats; who is coming.
  return (
    <article data-testid="guest-event" className={`${CARD} xl:col-start-1`}>
      <h1 data-testid="guest-event-name" className="break-words text-xl font-extrabold text-ink">
        {event.name}
      </h1>

      <p data-testid="guest-event-dates" className="text-sm font-semibold text-ink-2">
        {eventDateLabel(event)}
      </p>

      {event.location !== null ? (
        <p data-testid="guest-event-location" className="text-sm text-ink-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Where</span>{" "}
          <span className="text-ink">{event.location}</span>
        </p>
      ) : null}

      {/* EVT-10 AC-8. The guest page is on the open internet: sanitised against ADR-056's
          allow-list on the way to the DOM, whatever was stored. */}
      <DescriptionHtml html={event.description} testId="guest-event-description" />

      <div>
        {/* § 2b. *Full* is the overloaded-day pink, never red. */}
        <span
          data-testid="guest-event-seats"
          className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${full ? "bg-overload text-ink" : "bg-field text-ink-2"}`}
        >
          {guestSeatsLabel(event.capacity, event.seatsTaken)}
        </span>
      </div>

      {/* AC-10. Names only, in join order; no avatar, because AC-12 sends none. EVT-07 AC-14:
          attending guests' names are among them, unmarked. */}
      <div data-testid="guest-event-attendees" className="flex flex-col gap-2 border-t border-line pt-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Going ({names.length})</h2>
        {names.length === 0 ? (
          <p data-testid="guest-event-attendees-empty" className="text-sm text-ink-3">
            Nobody has joined yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {names.map((name, index) => (
              <li
                // Names are not unique and there is no id to key on (AC-12); join order is stable.
                key={index}
                data-testid="guest-event-attendee"
                className="rounded-pill bg-field px-2.5 py-0.5 text-xs font-semibold text-ink"
              >
                {name ?? "Former member"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

/** EVT-07 § 2b. The register block: the form, or closed, or full, or — after submitting — the status
 *  and the manage link, once. */
function GuestRegisterPanel({
  token,
  event,
  terms,
  onRegistered,
}: {
  token: string;
  event: GuestEventData;
  terms: GuestRegistrationTerms;
  onRegistered: () => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<GuestRegistrationReceipt | null>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle");

  const heading = terms.requiresApproval ? "Request to join" : "Register";
  const full = event.capacity !== null && event.seatsTaken >= event.capacity;
  const address = receipt ? guestManageUrl(window.location.origin, receipt.manageToken) : "";

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const problem = guestRegistrationProblem(name, email);
    if (problem) {
      setError(PROBLEM_TEXT[problem]);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await seam.registerGuest(token, name, email);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setReceipt(result.value);
    onRegistered();
  }

  // EVT-06 AC-8's copy: where the browser refuses the clipboard, the address stays on screen.
  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopy("copied");
    } catch {
      setCopy("refused");
    }
  }

  const label = <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">{heading}</h2>;

  if (receipt) {
    return (
      <div data-testid="guest-registered" className="flex flex-col gap-3">
        {label}
        <p
          data-testid="guest-registered-status"
          data-status={receipt.status}
          className="text-sm font-semibold text-ink"
        >
          {receipt.status === "pending"
            ? "Your request is waiting for the organiser's decision."
            : "You're going."}
        </p>
        {/* § 2b. The soft lavender callout. */}
        <div className="flex flex-col gap-2 rounded-card bg-holiday/30 p-4">
          <p className="text-sm text-ink">
            Save this link. It is shown only once, and it is the only way to check your registration or
            cancel it.
          </p>
          <div className="flex gap-2">
            <input
              data-testid="guest-manage-link"
              type="text"
              readOnly
              value={address}
              aria-label="Your registration link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-pill bg-card px-3 py-1.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              data-testid="guest-manage-copy-button"
              type="button"
              onClick={() => void onCopy()}
              className={QUIET_BUTTON}
            >
              Copy
            </button>
          </div>
          <p data-testid="guest-manage-copied" role="status" aria-live="polite" className="text-xs text-ink-2">
            {copy === "copied"
              ? "Copied"
              : copy === "refused"
                ? "Copying is blocked here. Select the address and copy it yourself."
                : ""}
          </p>
        </div>
      </div>
    );
  }

  if (!terms.registrationOpen) {
    return (
      <div data-testid="guest-register" className="flex flex-col gap-2">
        {label}
        <p data-testid="guest-register-closed" className="text-sm text-ink-2">
          Registration closed
        </p>
      </div>
    );
  }

  // AC-6. A request holds no seat, so a full event still takes one (AC-2).
  if (full && !terms.requiresApproval) {
    return (
      <div data-testid="guest-register" className="flex flex-col gap-2">
        {label}
        <p data-testid="guest-register-full" className="text-sm text-ink-2">
          <span className="rounded-pill bg-overload px-2.5 py-0.5 text-xs font-bold text-ink">Full</span>{" "}
          This event is full.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="guest-register" className="flex flex-col gap-3">
      {label}
      {terms.requiresApproval ? (
        <p className="text-xs text-ink-3">The organiser approves each request.</p>
      ) : null}
      {/* UIE-12 § 2b. The two fields side by side from `sm` while the block is pinned under the text,
          to keep it short; stacked again in the narrow side column at `xl`. */}
      <form className="flex flex-col gap-3" noValidate onSubmit={(e) => void onSubmit(e)}>
        <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-ink-3">
          Your name
          <input
            data-testid="guest-register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-ink-3">
          Your email
          <input
            data-testid="guest-register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </label>
        </div>
        {error !== null ? (
          <p data-testid="guest-register-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div>
          <button data-testid="guest-register-submit" type="submit" disabled={busy} className={PRIMARY_BUTTON}>
            {heading}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EVT-07 — the manage page, `/guest/registration/:token`. AC-11, AC-12, AC-13, AC-20.
// ---------------------------------------------------------------------------

type RegistrationState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; view: GuestRegistrationView };

/** AC-11. One sentence per state. */
const GUEST_STATUS_TEXT: Record<GuestStatus, string> = {
  pending: "Your request is waiting for a decision.",
  attending: "You're going.",
  rejected: "Your request was declined.",
  removed: "You were taken off the list for this event.",
  cancelled: "You cancelled your registration.",
};

/** § 2b. Peach for waiting, mint for going, the field grey for the other three. */
const GUEST_STATUS_PILL: Record<GuestStatus, string> = {
  pending: "bg-pto text-ink",
  attending: "bg-wfh text-ink",
  rejected: "bg-field text-ink-2",
  removed: "bg-field text-ink-2",
  cancelled: "bg-field text-ink-2",
};

export function GuestRegistration(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<RegistrationState>({ phase: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useGuestMeta();

  const load = useCallback(async (): Promise<void> => {
    try {
      const view = await seam.getGuestRegistration(token ?? "");
      setState(view ? { phase: "ready", view } : { phase: "missing" });
    } catch {
      setState({ phase: "missing" });
    }
  }, [token]);

  useEffect(() => {
    setState({ phase: "loading" });
    void load();
  }, [load]);

  async function onCancel(): Promise<void> {
    setConfirming(false);
    setBusy(true);
    setError(null);
    const result = await seam.cancelGuestRegistration(token ?? "");
    setBusy(false);
    if (!result.ok) setError(result.error.message);
    await load();
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-3">CaleChip</p>

      {state.phase === "loading" ? (
        <p role="status" className="p-8 text-center text-sm text-ink-2">
          <Loader label="Loading your registration…" />
        </p>
      ) : state.phase === "missing" ? (
        <div data-testid="guest-registration-not-found" className={`${CARD} text-center text-sm text-ink-2`}>
          <p>This link does not work. Check that you copied the whole address.</p>
        </div>
      ) : (
        <GuestRegistrationCard
          view={state.view}
          busy={busy}
          error={error}
          onCancel={() => {
            setError(null);
            setConfirming(true);
          }}
        />
      )}

      {confirming ? (
        <Modal testIdPrefix="guest-cancel" label="Cancel your registration" onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-4 pr-8">
            <h2 className="text-lg font-extrabold text-ink">Cancel your registration?</h2>
            <p className="text-sm text-ink-2">
              Your seat or request will be given up. You cannot register again with this email.
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="guest-cancel-cancel"
                type="button"
                onClick={() => setConfirming(false)}
                className={QUIET_BUTTON}
              >
                Keep it
              </button>
              <button
                data-testid="guest-cancel-confirm"
                type="button"
                disabled={busy}
                onClick={() => void onCancel()}
                className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Cancel registration
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function GuestRegistrationCard({
  view,
  busy,
  error,
  onCancel,
}: {
  view: GuestRegistrationView;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
}): JSX.Element {
  const canCancel =
    !view.eventDeleted &&
    view.registrationOpen &&
    (view.status === "pending" || view.status === "attending");

  // AC-11. Top to bottom: event name; dates; location; the guest's name; the status. No email, no
  // other person, no seat count.
  return (
    <article data-testid="guest-registration" className={CARD}>
      <h1 data-testid="guest-registration-event" className="break-words text-xl font-extrabold text-ink">
        {view.eventName}
      </h1>

      {view.eventDeleted ? (
        // AC-20.
        <p className="text-sm font-semibold text-ink-2">This event was cancelled.</p>
      ) : view.startDate !== null && view.endDate !== null ? (
        <p data-testid="guest-registration-dates" className="text-sm font-semibold text-ink-2">
          {eventDateLabel({ startDate: view.startDate, endDate: view.endDate })}
        </p>
      ) : null}

      {view.location !== null ? (
        <p data-testid="guest-registration-location" className="text-sm text-ink-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Where</span>{" "}
          <span className="text-ink">{view.location}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="text-sm text-ink-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Registered as</span>{" "}
          <span data-testid="guest-registration-name" className="font-semibold text-ink">
            {view.guestName}
          </span>
        </p>
        <p
          data-testid="guest-registration-status"
          data-status={view.status}
          className="flex flex-wrap items-center gap-2 text-sm text-ink"
        >
          <span className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${GUEST_STATUS_PILL[view.status]}`}>
            {view.status === "pending" ? "Waiting" : view.status === "attending" ? "Going" : "Not going"}
          </span>
          {GUEST_STATUS_TEXT[view.status]}
        </p>

        {error !== null ? (
          <p data-testid="guest-registration-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {canCancel ? (
          <div>
            <button
              data-testid="guest-registration-cancel-button"
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="text-xs font-semibold text-danger underline disabled:opacity-50"
            >
              Cancel my registration
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
