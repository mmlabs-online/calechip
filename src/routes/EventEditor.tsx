// EVT-01 — create and edit an event. One form for `/events/new` and `/events/:id/edit`.
// 01-plan.md § 2 AC-1 to AC-4, AC-10, AC-11, AC-14, AC-16, AC-23; § 2b; § 4.4.
//
// **NO FIELD HERE CAN NAME A CREATOR OR A TEAM** (AC-4, Q6). `SaveEventInput` has neither, and an
// own-team event is always the creator's team — the database sets it and withholds the column.
//
// **NO TIME OF DAY ANYWHERE** (AC-3, Q11): two date inputs and nothing finer.
//
// **EVERY REFUSAL THIS FORM SHOWS IS THE SEAM'S SENTENCE**, in the one `event-form-error` line. The
// empty-name and reversed-date refusals are made by the seam before any request leaves (AC-2, AC-3);
// both are affordances, and `event_name_present` / `event_dates_ordered` are the controls. The one
// check made here is that both dates were picked at all, because an unpicked date input is an empty
// string and not a date either implementation could compare.
//
// EVT-02. Three fields between the dates and the scope — seats, needs approval, registration closes
// (01-plan.md § 2 AC-1 to AC-4, AC-28; § 2b). The seam refuses a capacity that is not a whole number
// ≥ 1 and a deadline after the end date before the round trip, as affordances;
// `event_capacity_positive`, `event_deadline_by_end` and `event_capacity_guard` are the controls.
// The form always sends all three.
//
// **THE PICKER IS INLINE, NOT A DIALOG** (§ 2b): a scrollable checklist grouped under team names,
// with a text filter, drawn only while `Limited people` is chosen. It omits the caller — an
// affordance; `list_member_directory()` returns them and the policy would accept them. Since MIR-04
// (ADR-066 1) it offers a non-admin only their own team, plus anyone already named on the event being
// edited. That is an affordance too: the directory carries the other people it connects the caller
// to, for names, and the datastore still accepts an invitee of any team (operator Q2 B).
//
// EVT-09. On the create form only, an email field under the scope choice — below the picker when it
// is drawn (01-plan.md § 2b, § 4.2). **IT ADDS A SURFACE, NOT A BEHAVIOUR**: the addresses go through
// `inviteToEvent`, EVT-08's seam function, unchanged — after `createEvent` succeeds and never before,
// and not at all when one address is malformed (AC-4). EVT-12 AC-2: for every scope, no longer public
// only; what each address gets on an Own team or Limited people event is the seam's.
import { useCallback, useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { seam, type DataSeam, type SaveEventInput } from "@/lib/data";
import { mayAdminister } from "@/lib/roles";
import type { DirectoryMember, EventScope, Failure, Member } from "@/lib/domain/types";
import Avatar from "@/components/Avatar";
import Loader from "@/components/Loader";
import DescriptionEditor from "@/components/DescriptionEditor";
import { sanitizeDescription } from "@/components/DescriptionHtml";
import {
  invalidInvitationEmails,
  inviteHint,
  mayEditEvent,
  parseInvitationInput,
  type InviteHandoff,
} from "./EventDetail";

interface FormValues {
  name: string;
  startDate: string;
  endDate: string;
  scope: EventScope;
  inviteeIds: string[];
  location: string;
  description: string;
  // EVT-02. Kept as the input's text so an empty field means no limit; parsed at submit.
  capacity: string;
  requiresApproval: boolean;
  /** `""` means registration runs to the end date. */
  registrationDeadline: string;
  /** EVT-09. The create form's invite field, as typed; sent for every scope (EVT-12 AC-2). */
  inviteText: string;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; me: Member | null; directory: DirectoryMember[]; initial: FormValues };

const SCOPE_CHOICES: readonly { scope: EventScope; label: string; hint: string }[] = [
  { scope: "team", label: "Own team", hint: "Everyone on your team" },
  { scope: "named", label: "Limited people", hint: "Only the people you pick, from any team" },
  { scope: "public", label: "Public", hint: "Your whole organisation — or only your team, on the shared space" },
];

const FIELD =
  "w-full rounded-xl bg-field px-3 py-2 text-sm text-ink placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const LABEL = "text-xs font-bold text-ink-3";

// EVT-08's `invalid_invitation_email` sentence, verbatim (EVT-09 AC-4).
const INVITE_INVALID = "Each address must look like name@example.com, in 254 characters or fewer.";
// A thrown invitation call carries no sentence of its own; the seam's generic one.
const INVITE_THREW = "Something went wrong. Please try again.";

/** EVT-09 AC-2..AC-6. Validates the addresses, creates the event, then invites. Never invites
 *  before the event exists and never creates when an address is malformed.
 *  - no address after parsing → `createEvent` only; `handoff: null`. Every scope (EVT-12 AC-2).
 *  - any malformed address → `{ ok: false, malformed }`, and neither call is made.
 *  - `createEvent` refused → `{ ok: false, error }`, and `inviteToEvent` is not called.
 *  - created, invite refused or thrown → `{ ok: true, id, handoff: { kind: "failed", … } }`.
 *  - created and invited → `{ ok: true, id, handoff: { kind: "invited", outcomes } }`. */
export async function createEventWithInvitations(
  data: Pick<DataSeam, "createEvent" | "inviteToEvent">,
  input: SaveEventInput,
  inviteText: string,
): Promise<
  | { ok: true; id: string; handoff: InviteHandoff | null }
  | { ok: false; error: Failure }
  | { ok: false; malformed: string[] }
> {
  const emails = parseInvitationInput(inviteText);
  const malformed = invalidInvitationEmails(emails);
  if (malformed.length > 0) return { ok: false, malformed };

  const created = await data.createEvent(input);
  if (!created.ok) return { ok: false, error: created.error };
  const id = created.value.id;
  if (emails.length === 0) return { ok: true, id, handoff: null };

  try {
    const sent = await data.inviteToEvent(id, emails);
    return sent.ok
      ? { ok: true, id, handoff: { kind: "invited", outcomes: sent.value } }
      : { ok: true, id, handoff: { kind: "failed", message: sent.error.message, emails } };
  } catch {
    return { ok: true, id, handoff: { kind: "failed", message: INVITE_THREW, emails } };
  }
}

const fold = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function EventEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async (): Promise<void> => {
    try {
      const [me, directory] = await Promise.all([seam.getCurrentMember(), seam.listMemberDirectory()]);

      if (!editing) {
        const today = format(new Date(), "yyyy-MM-dd");
        setState({
          phase: "ready",
          me,
          directory,
          initial: {
            name: "",
            startDate: today,
            endDate: today,
            scope: "team",
            inviteeIds: [],
            location: "",
            description: "",
            capacity: "",
            requiresApproval: false,
            registrationDeadline: "",
            inviteText: "",
          },
        });
        return;
      }

      const event = id ? await seam.getEvent(id) : null;
      // § 4.4: an id the caller may not edit renders `event-not-found`, the same as one that does
      // not exist. The affordance; `event_update_manage` refuses the write regardless.
      if (!event || !mayEditEvent(event, me)) {
        setState({ phase: "missing" });
        return;
      }
      const inviteeIds = await seam.listEventInvitees(event.id);
      setState({
        phase: "ready",
        me,
        directory,
        initial: {
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          scope: event.scope,
          inviteeIds,
          location: event.location ?? "",
          description: event.description ?? "",
          // EVT-02, AC-28. The edit form opens holding the event's current three values.
          capacity: event.capacity === null ? "" : String(event.capacity),
          requiresApproval: event.requiresApproval,
          registrationDeadline: event.registrationDeadline ?? "",
          // EVT-09 AC-1. The edit form draws no invite field; the detail page's panel invites.
          inviteText: "",
        },
      });
    } catch {
      setState({ phase: "missing" });
    }
  }, [editing, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // AC-23: cancel returns to where they came from. `location.key` is "default" only on a first
  // load with no in-app history behind it, and then the list is where they would have come from.
  const goBack = (): void => {
    if (location.key !== "default") navigate(-1);
    else navigate(editing && id ? `/events/${id}` : "/events");
  };

  if (state.phase === "loading") {
    return (
      <p role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-ink-2">
        <Loader label="Loading…" />
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

  return (
    <EventForm
      editing={editing}
      eventId={id ?? null}
      me={state.me}
      directory={state.directory}
      initial={state.initial}
      onCancel={goBack}
      onSaved={(savedId, handoff) =>
        navigate(`/events/${savedId}`, handoff ? { state: handoff } : undefined)
      }
    />
  );
}

interface EventFormProps {
  editing: boolean;
  eventId: string | null;
  me: Member | null;
  directory: DirectoryMember[];
  initial: FormValues;
  onCancel(): void;
  onSaved(eventId: string, handoff?: InviteHandoff | null): void;
}

function EventForm({
  editing,
  eventId,
  me,
  directory,
  initial,
  onCancel,
  onSaved,
}: EventFormProps): JSX.Element {
  const [values, setValues] = useState<FormValues>(initial);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  // EVT-09 AC-4. The addresses that failed the check; non-null draws `event-form-invite-error`.
  const [inviteMalformed, setInviteMalformed] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]): void =>
    setValues((v) => ({ ...v, [key]: value }));

  // AC-10 (ADR-066 1). Everyone in the directory except the caller, grouped under their team's name —
  // and for a non-admin, only their own team plus whoever the event already names. Keyed on
  // `initial.inviteeIds`, not the live list, so someone unchecked during an edit stays on screen.
  // An affordance only; the datastore accepts an invitee of any team (Q2 B).
  const groups = useMemo(() => {
    const needle = fold(filter.trim());
    const byTeam = new Map<string, { teamName: string; people: DirectoryMember[] }>();
    for (const person of directory) {
      if (me !== null && person.id === me.id) continue;
      if (
        !(me !== null && mayAdminister(me.role)) &&
        person.teamId !== me?.teamId &&
        !initial.inviteeIds.includes(person.id)
      )
        continue;
      if (needle !== "" && !fold(`${person.displayName} ${person.teamName}`).includes(needle)) continue;
      const group = byTeam.get(person.teamId) ?? { teamName: person.teamName, people: [] };
      group.people.push(person);
      byTeam.set(person.teamId, group);
    }
    return [...byTeam.entries()].map(([teamId, group]) => ({ teamId, ...group }));
  }, [directory, filter, me, initial.inviteeIds]);

  const toggleInvitee = (memberId: string, on: boolean): void =>
    set(
      "inviteeIds",
      on
        ? [...values.inviteeIds.filter((x) => x !== memberId), memberId]
        : values.inviteeIds.filter((x) => x !== memberId),
    );

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setInviteMalformed(null);

    if (values.startDate === "" || values.endDate === "") {
      setError("Please choose a start date and an end date.");
      return;
    }

    setSaving(true);
    const input: SaveEventInput = {
      name: values.name,
      // EVT-10 AC-9, ADR-056 decision 3. DEFENCE IN DEPTH ONLY — the API can be called without this
      // form (ADR-005), so the render's sanitise is the security layer, not this one. `""` reaches
      // the seam's `blankToNull` and is stored as no description, as before.
      description: sanitizeDescription(values.description),
      location: values.location,
      startDate: values.startDate,
      endDate: values.endDate,
      scope: values.scope,
      inviteeIds: values.scope === "named" ? values.inviteeIds : [],
      // EVT-02. Empty is no limit; anything else is handed to the seam as a number, which refuses a
      // value that is not a whole number ≥ 1 (AC-2) — `NaN` included.
      capacity: values.capacity.trim() === "" ? null : Number(values.capacity.trim()),
      requiresApproval: values.requiresApproval,
      registrationDeadline: values.registrationDeadline === "" ? null : values.registrationDeadline,
    };
    if (editing && eventId !== null) {
      const result = await seam.updateEvent(eventId, input);
      setSaving(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // AC-1, AC-23. The creator lands on the detail page.
      onSaved(result.value.id);
      return;
    }

    // EVT-09 AC-7. `saving` holds across both calls; the button stays disabled until they answer.
    const result = await createEventWithInvitations(seam, input, values.inviteText);
    if (!result.ok) {
      setSaving(false);
      if ("malformed" in result) setInviteMalformed(result.malformed);
      else setError(result.error.message);
      return;
    }
    // AC-1, AC-23; EVT-09 AC-3, AC-6. The creator lands on the detail page, which is never left for
    // the form again once the event exists — a second press could create a second event.
    onSaved(result.id, result.handoff);
  }

  const inviteHasAddress = parseInvitationInput(values.inviteText).length > 0;

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      {/* AC-23. Top to bottom: name; start and end side by side; scope as three choices; the picker
          only while Limited people is chosen; location; description; save and cancel. */}
      <form
        data-testid="event-form"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5 rounded-card bg-card p-6 shadow-soft md:p-8"
      >
        <h1 className="text-xl font-extrabold text-ink">{editing ? "Edit event" : "New event"}</h1>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Name</span>
          <input
            data-testid="event-name-input"
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Team lunch"
            className={FIELD}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Start date</span>
            <input
              data-testid="event-start-input"
              type="date"
              value={values.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>End date</span>
            <input
              data-testid="event-end-input"
              type="date"
              value={values.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        {/* EVT-02, AC-28. Seats, needs approval, registration closes — in that order. Seats and the
            deadline sit side by side from `sm`, as § 2b draws them, and stack at phone width. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Seats</span>
            <input
              data-testid="event-capacity-input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={values.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="No limit"
              className={FIELD}
            />
          </label>
          <label className="flex items-center gap-2 sm:order-3 sm:col-span-2">
            <input
              data-testid="event-approval-input"
              type="checkbox"
              role="switch"
              checked={values.requiresApproval}
              onChange={(e) => set("requiresApproval", e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            <span className="text-sm font-semibold text-ink">Needs approval</span>
            <span className="text-[11px] text-ink-3">You decide who gets a seat</span>
          </label>
          <label className="flex flex-col gap-1.5 sm:order-2">
            <span className={LABEL}>Registration closes (optional)</span>
            <input
              data-testid="event-deadline-input"
              type="date"
              value={values.registrationDeadline}
              onChange={(e) => set("registrationDeadline", e.target.value)}
              placeholder="At the end date"
              className={FIELD}
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL} mb-1.5`}>Who is it for?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCOPE_CHOICES.map((choice) => {
              const on = values.scope === choice.scope;
              return (
                <label
                  key={choice.scope}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2 transition-colors ${
                    on ? "border-ink bg-field" : "border-line hover:border-ink-3"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-ink">
                    <input
                      data-testid={`event-scope-${choice.scope}`}
                      type="radio"
                      name="event-scope"
                      value={choice.scope}
                      checked={on}
                      onChange={() => set("scope", choice.scope)}
                      className="accent-ink"
                    />
                    {choice.label}
                  </span>
                  <span className="text-[11px] text-ink-3">{choice.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {values.scope === "named" ? (
          <div data-testid="event-picker" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={LABEL}>People</span>
              <span className="text-xs text-ink-3">{values.inviteeIds.length} chosen</span>
            </div>
            <input
              data-testid="event-picker-filter"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or team"
              className={FIELD}
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-line p-2">
              {groups.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-ink-3">Nobody matches.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.teamId} data-testid="event-picker-group" data-team-id={group.teamId} className="mb-2 last:mb-0">
                    <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">
                      {group.teamName}
                    </p>
                    <ul>
                      {group.people.map((person) => {
                        const on = values.inviteeIds.includes(person.id);
                        return (
                          <li key={person.id}>
                            <label
                              data-testid="event-picker-option"
                              data-member-id={person.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-ink hover:bg-field"
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={(e) => toggleInvitee(person.id, e.target.checked)}
                                className="accent-ink"
                              />
                              <Avatar value={person.avatar} className="h-6 w-6 rounded-full" />
                              {person.displayName}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* EVT-09 AC-1, § 2b; EVT-12 AC-2. The create form only, every scope — after the picker. */}
        {!editing ? (
          <div data-testid="event-form-invite" className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Invite by email (optional)</span>
              <span data-testid="event-form-invite-hint" className="text-[11px] text-ink-3">
                {inviteHasAddress
                  ? inviteHint(values.scope, "Creating")
                  : "People outside CaleChip get the guest link by email."}
              </span>
              <textarea
                data-testid="event-form-invite-input"
                rows={3}
                value={values.inviteText}
                onChange={(e) => set("inviteText", e.target.value)}
                placeholder="name@example.com, another@example.com"
                aria-label="Email addresses"
                className={FIELD}
              />
            </label>
            {inviteMalformed !== null ? (
              <div data-testid="event-form-invite-error" role="alert" className="text-sm text-danger">
                <p>{INVITE_INVALID}</p>
                {inviteMalformed.length > 0 ? (
                  <p className="break-all font-semibold">{inviteMalformed.join(", ")}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Location (optional)</span>
          <input
            data-testid="event-location-input"
            type="text"
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            className={FIELD}
          />
        </label>

        {/* EVT-10. A `div`, not a `label`: a label around the toolbar would send every press on
            one of its buttons to the first labelable control inside it. */}
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>Description (optional)</span>
          <DescriptionEditor
            value={values.description}
            onChange={(html) => set("description", html)}
          />
        </div>

        {error !== null ? (
          <p data-testid="event-form-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            data-testid="event-cancel"
            type="button"
            onClick={onCancel}
            className="rounded-pill border border-line px-4 py-2 text-xs font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cancel
          </button>
          <button
            data-testid="event-save"
            type="submit"
            disabled={saving}
            className="rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
          </button>
        </div>
      </form>
    </section>
  );
}
