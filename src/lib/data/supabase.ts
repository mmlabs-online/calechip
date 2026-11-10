// The real implementation. The ONLY file in the repository that may import the Supabase client —
// RULE-02, enforced by eslint.config.js and declared again as a boundary D12 reads.
import {
  createClient,
  isAuthRetryableFetchError,
  type AuthError,
  type Session as SupabaseSession,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
// SOLO, 2026-09-11. Names the dates an overlap refusal is about — `overlapFailure` below.
import { clashingDates, overlapMessage, type OverlapCandidate } from "./overlap";
// EVT-03. The admin's other-team narrowing (Q4-A) — one rule, shared with mock.ts.
import { eventsRelevantToTeam } from "@/lib/event-layer";
// TSK-01. "Today" for the date floor — one clock with EVT-02 (01-plan.md § 1 decision 1).
import { eventToday } from "@/lib/event-registration";
import type {
  AddHolidayInput,
  ChangePasswordInput,
  CreateEntryInput,
  CreateTeamInput,
  DataSeam,
  RenameTeamInput,
  SetApprovalSettingsInput,
  SetOverloadThresholdInput,
  SetOwnBusyDayInput,
  SignInInput,
  SignUpInput,
  SignUpOutcome,
  UpdateEntryInput,
  UpdateHolidayInput,
  UpdateOwnProfileInput,
  // EVT-01, 01-plan.md section 4.2.
  SaveEventInput,
  // TSK-01, 01-plan.md section 4.2.
  CreateTaskInput,
  UpdateTaskInput,
} from "./index";
// MIR-09, ADR-069. A RUNTIME import: both implementations share this one guard rather than holding a
// second copy of it, 01-plan.md section 4.
import { isValidThreshold, INVALID_THRESHOLD_MESSAGE } from "./index";
import type {
  // EVT-01, 01-plan.md section 4.1.
  CalEvent,
  DirectoryMember,
  EventScope,
  // EVT-02, 01-plan.md section 4.1.
  AttendanceStatus,
  EventAttendance,
  // EVT-04, 01-plan.md section 4.1.
  EventNotification,
  NotificationKind,
  // EVT-06, 01-plan.md section 4.1.
  EventGuestLink,
  GuestEvent,
  MemberDecision,
  MemberStatus,
  BulkRejectionOutcome,
  BusyDay,
  DateRange,
  Entry,
  // MIR-14-b, 01-plan.md section 4.3.
  EntryOwner,
  EntryPortion,
  EntryStatus,
  EntryType,
  Failure,
  CreateIssueReportInput,
  Holiday,
  HolidayKind,
  IssueKind,
  IssueReport,
  IssueStatus,
  Member,
  MemberRole,
  PendingEntryPage,
  PendingEntryQuery,
  Result,
  Session,
  Team,
  // EVT-07, 01-plan.md section 4.1.
  EventGuest,
  GuestRegistrationReceipt,
  GuestRegistrationTerms,
  GuestRegistrationView,
  GuestStatus,
  // EVT-08, 01-plan.md section 4.1.
  EmailInvitationOutcome,
  EventEmailInvitation,
  // TSK-01, 01-plan.md section 4.1.
  Task,
} from "../domain/types";
// TEA-03, CAL-01 for the second constant, CAL-04 for the fourth. RUNTIME imports, not type ones:
// each is needed as a value at the call. They come from ../domain/types and not from ./index, which
// imports this file back - 02-design.md section 1.1.
// CAL-09 removed MONTH_ENTRY_LIMIT from this list: `listTeamEntriesOverlapping` was its only reader
// here and now pages instead. The constant itself still exists — its docblock in ../domain/types
// records why it was not deleted.
import {
  AVATAR_CHOICES,
  // EVT-01. The bound `listEvents` asks for and refuses at — see its comment.
  DATASTORE_MAX_ROWS,
  // EVT-11 AC-6. The cap, and the count `octet_length` makes of it.
  DESCRIPTION_MAX_BYTES,
  descriptionBytes,
  HOLIDAY_LIMIT,
  ISSUE_IMAGE_MAX_BYTES,
  ISSUE_IMAGE_MAX_COUNT,
  ISSUE_IMAGE_TYPES,
  ISSUE_REPORT_LIMIT,
  // EVT-06 AC-13. The token's shape, checked before any round trip.
  GUEST_LINK_TOKEN_PATTERN,
  // EVT-07 AC-4. The ceilings and the shape, checked before the round trip.
  GUEST_EMAIL_MAX,
  GUEST_EMAIL_PATTERN,
  GUEST_NAME_MAX,
  // EVT-04. The panel's window — AC-16.
  NOTIFICATION_LIMIT,
  OWN_ENTRY_LIMIT,
  PENDING_PAGE_SIZE,
  ROSTER_LIMIT,
  TEAM_ENTRY_LIMIT,
  TEAM_ENTRY_MAX_PAGES,
  TEAM_ENTRY_PAGE_SIZE,
  // TSK-01 AC-8. The bounds, checked before the round trip.
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
} from "../domain/types";

// ---------------------------------------------------------------------------
// EVT-01 — events. The rows, their mappers, the sentences and the SQLSTATEs.
// 01-plan.md sections 4.2 and 4.3; `supabase/migrations/20260929120000_evt01_event.sql`.
// ---------------------------------------------------------------------------

/** MIR-14-b. One row of `public.list_entry_owners(uuid[])`: an owner and ONE of their active teams. */
interface EntryOwnerRow {
  member_id: string;
  display_name: string;
  avatar: string;
  team_id: string;
  team_name: string;
}

interface EventRow {
  id: string;
  creator_id: string;
  team_id: string;
  name: string;
  /** EVT-11. Absent on list reads, which select EVENT_LIST_COLUMNS. */
  description?: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  scope: EventScope;
  // EVT-02. 01-plan.md § 4.4.
  capacity: number | null;
  requires_approval: boolean;
  registration_deadline: string | null;
  created_at: string;
  updated_at: string;
}

// Named explicitly rather than `*`, the shape this file uses everywhere.
const EVENT_COLUMNS =
  "id, creator_id, team_id, name, description, location, start_date, end_date, scope, " +
  "capacity, requires_approval, registration_deadline, created_at, updated_at";

/** EVT-11, ADR-056 decision 6. EVENT_COLUMNS without `description`: the lists and grids never draw
 *  it, and with pictures embedded it is the heaviest column the row has. */
const EVENT_LIST_COLUMNS =
  "id, creator_id, team_id, name, location, start_date, end_date, scope, " +
  "capacity, requires_approval, registration_deadline, created_at, updated_at";

function toEvent(row: EventRow): CalEvent {
  return {
    id: row.id,
    creatorId: row.creator_id,
    teamId: row.team_id,
    name: row.name,
    description: row.description ?? null,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    scope: row.scope,
    capacity: row.capacity,
    requiresApproval: row.requires_approval,
    registrationDeadline: row.registration_deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** `public.save_event` returns ONE `public.event`, which PostgREST answers as an OBJECT. Anything
 *  else is a contract violation and is reported as one — `isTeamRow`'s reasoning. */
const isEventRow = (value: unknown): value is EventRow =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as EventRow).id === "string";

/** `public.list_member_directory()`'s five columns. There is no sixth to select. */
interface DirectoryRow {
  id: string;
  display_name: string;
  avatar: string;
  team_id: string;
  team_name: string;
}

const DIRECTORY_COLUMNS = "id, display_name, avatar, team_id, team_name";

// Repeated verbatim in src/lib/data/mock.ts, so the two implementations cannot drift a sentence
// apart. The two refusals never confirm that the event exists (01-plan.md § 4.2).
const EVENT_NAME_REQUIRED = "Please give the event a name.";
const EVENT_DATES_REVERSED = "The end date must be the same as, or after, the start date.";
const EVENT_INVITEE_INVALID =
  "One of the people you named can no longer be invited. Please choose again.";
const EVENT_SAVE_REFUSED = "This event could not be saved.";
const EVENT_DELETE_REFUSED = "This event could not be deleted.";
// EVT-02. 01-plan.md § 4.3. Repeated verbatim in mock.ts.
const EVENT_CAPACITY_INVALID = "Seats must be a whole number of at least 1, or left empty for no limit.";
const EVENT_DEADLINE_AFTER_END = "Registration must close on or before the event's end date.";
const EVENT_CAPACITY_BELOW_ATTENDEES =
  "Seats cannot be fewer than the number of people already attending.";
// EVT-11. 01-plan.md § 4.5. Repeated verbatim in mock.ts.
const DESCRIPTION_TOO_LARGE = "The description is larger than 1 MB. Remove a picture to save.";

/** The four seam-side refusals, before the round trip — AFFORDANCES; `event_name_present`,
 *  `event_dates_ordered`, `event_capacity_positive` and `event_deadline_by_end` are the controls.
 *  Repeated in mock.ts. */
function eventInputFailure(input: SaveEventInput): Failure | null {
  if (input.name.trim() === "") return { code: "empty_event_name", message: EVENT_NAME_REQUIRED };
  if (input.endDate < input.startDate) {
    return { code: "invalid_event_dates", message: EVENT_DATES_REVERSED };
  }
  if (input.capacity != null && !(Number.isInteger(input.capacity) && input.capacity >= 1)) {
    return { code: "invalid_event_capacity", message: EVENT_CAPACITY_INVALID };
  }
  if (input.registrationDeadline != null && input.registrationDeadline > input.endDate) {
    return { code: "invalid_event_deadline", message: EVENT_DEADLINE_AFTER_END };
  }
  // EVT-11 AC-6. `event_description_bounded` is the control; measured as it will be sent.
  if (descriptionBytes(blankToNull(input.description)) > DESCRIPTION_MAX_BYTES) {
    return { code: "description_too_large", message: DESCRIPTION_TOO_LARGE };
  }
  return null;
}

/** Blank after trimming is null — `SaveEventInput`'s docblock. */
function blankToNull(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The SQLSTATEs `save_event` and the event tables answer with — a separate mapper for the reason
 * `toEntryFailure` records: one function answering two tables with one sentence is how a wrong
 * message reaches a screen.
 *
 * MATCHED ON THE SQLSTATE, NEVER ON THE MESSAGE. `23514` is both check constraints and only this
 * application's own refusals above tell them apart, so the INPUT decides which of the two it was —
 * the constraint name is not read. It is unreachable from this application for the same reason.
 */
function toEventFailure(error: PostgrestError, input: SaveEventInput | null, refusal: string): Failure {
  switch (error.code) {
    // Five check constraints, told apart by the input in eventInputFailure's order (EVT-02 § 4.3,
    // EVT-11 § 4.5).
    case "23514":
      if (input && input.name.trim() === "") {
        return { code: "empty_event_name", message: EVENT_NAME_REQUIRED };
      }
      if (input && input.endDate < input.startDate) {
        return { code: "invalid_event_dates", message: EVENT_DATES_REVERSED };
      }
      if (input && input.capacity != null && !(Number.isInteger(input.capacity) && input.capacity >= 1)) {
        return { code: "invalid_event_capacity", message: EVENT_CAPACITY_INVALID };
      }
      // EVT-11. `event_description_bounded` — before the deadline branch, which takes the rest.
      if (input && descriptionBytes(blankToNull(input.description)) > DESCRIPTION_MAX_BYTES) {
        return { code: "description_too_large", message: DESCRIPTION_TOO_LARGE };
      }
      if (input && input.registrationDeadline != null) {
        return { code: "invalid_event_deadline", message: EVENT_DEADLINE_AFTER_END };
      }
      return { code: "invalid_event_dates", message: EVENT_DATES_REVERSED };
    // EVT-02. `event_capacity_guard` — AC-4.
    case "EV003":
      return { code: "event_capacity_below_attendees", message: EVENT_CAPACITY_BELOW_ATTENDEES };
    case "22023":
      return { code: "invalid_event_invitee", message: EVENT_INVITEE_INVALID };
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "event_not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

/** Both writes are ONE call to `public.save_event` (01-plan.md § 8, rejected alternative 3), so the
 *  row and its named list are written in one transaction. `null` id inserts. */
async function saveEventThroughRpc(
  eventId: string | null,
  input: SaveEventInput,
): Promise<Result<CalEvent>> {
  const invalid = eventInputFailure(input);
  if (invalid) return { ok: false, error: invalid };

  const { data, error } = await client().rpc("save_event", {
    p_event_id: eventId,
    p_name: input.name.trim(),
    p_description: blankToNull(input.description),
    p_location: blankToNull(input.location),
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_scope: input.scope,
    // Ignored and stored empty unless `named` — `SaveEventInput`'s docblock.
    p_invitee_ids: input.scope === "named" ? [...new Set(input.inviteeIds)] : [],
    // EVT-02. Absent is the default — `SaveEventInput`'s docblock.
    p_capacity: input.capacity ?? null,
    p_requires_approval: input.requiresApproval ?? false,
    p_registration_deadline: input.registrationDeadline ?? null,
  });

  if (error) return { ok: false, error: toEventFailure(error, input, EVENT_SAVE_REFUSED) };
  if (!isEventRow(data)) return { ok: false, error: { code: "unknown", message: EVENT_SAVE_REFUSED } };

  return { ok: true, value: toEvent(data) };
}

// ---------------------------------------------------------------------------
// EVT-02 — attendance. The row, its mapper, the sentences and the SQLSTATEs.
// 01-plan.md sections 4.3 and 4.4; `supabase/migrations/20260929140000_evt02_attendance.sql`.
// ---------------------------------------------------------------------------

/** Five columns and no more — AC-23. No name, avatar, team or role is selectable here. */
interface AttendanceRow {
  event_id: string;
  member_id: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

const ATTENDANCE_COLUMNS = "event_id, member_id, status, created_at, updated_at";

function toAttendance(row: AttendanceRow): EventAttendance {
  return {
    eventId: row.event_id,
    memberId: row.member_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Repeated verbatim in src/lib/data/mock.ts. `EVENT_FULL` promises no waitlist (§ 4.3); the
// not-permitted sentences never confirm that the event exists (AC-21).
const EVENT_FULL = "This event is full.";
const EVENT_REGISTRATION_CLOSED = "Registration for this event has closed.";
const EVENT_ALREADY_ON = "You have already responded to this event.";
const ATTENDANCE_CHANGE_INVALID = "That change cannot be made to this person's place.";
const ATTENDANCE_JOIN_REFUSED = "You cannot join this event.";
const ATTENDANCE_LEAVE_REFUSED = "You cannot leave this event.";
const ATTENDANCE_DECIDE_REFUSED = "This request could not be changed.";

/**
 * The SQLSTATEs the attendance table and its guard answer with — a separate mapper, as
 * `toEventFailure` is separate from `toEntryFailure`. MATCHED ON THE SQLSTATE, NEVER ON THE MESSAGE:
 * `EV001`–`EV002` are the custom codes the migration header documents.
 */
function toAttendanceFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    case "EV001":
      return { code: "event_full", message: EVENT_FULL };
    case "EV002":
      return { code: "event_registration_closed", message: EVENT_REGISTRATION_CLOSED };
    case "23505":
      return { code: "already_on_event", message: EVENT_ALREADY_ON };
    case "22023":
      return { code: "invalid_attendance_change", message: ATTENDANCE_CHANGE_INVALID };
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
    case "22P02": // a malformed id is an event that does not exist — the same answer (AC-21)
    case "23503": // no such event: the foreign key, answered the same as a policy refusal
      return { code: "attendance_not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// EVT-06 — the guest link. The rows, their mappers and the sentences.
// 01-plan.md sections 4.2 and 4.3; `supabase/migrations/20261009120000_evt06_guest_link.sql`.
// ---------------------------------------------------------------------------

interface GuestLinkRow {
  event_id: string;
  token: string;
  opened_at: string;
}

const GUEST_LINK_COLUMNS: string = "event_id, token, opened_at";

function toGuestLink(row: GuestLinkRow): EventGuestLink {
  return { eventId: row.event_id, token: row.token, openedAt: row.opened_at };
}

/** `public.get_guest_event`'s seven columns. There is no eighth to read. */
interface GuestEventRow {
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  capacity: number | null;
  seats_taken: number;
}

// Named explicitly, and typed `string` as EVENT_COLUMNS is, so the client does not re-derive a row
// type from the literal. `list_guest_event_attendees` has one column and no second to select.
const GUEST_EVENT_COLUMNS: string =
  "name, description, location, start_date, end_date, capacity, seats_taken";
const GUEST_ATTENDEE_COLUMNS: string = "display_name";

// Repeated verbatim in src/lib/data/mock.ts. Neither confirms that the event exists.
const EVENT_GUEST_OPEN_REFUSED = "This event could not be opened to guests.";
const EVENT_GUEST_CLOSE_REFUSED = "The guest link could not be closed.";

/** The SQLSTATEs the link's three writes answer with. A refusal by policy (42501), no session
 *  (PGRST301), an id that is not a uuid (22P02) and an event that is not there (23503) are ONE
 *  answer, so none of them says whether the event exists. */
function toGuestLinkFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    case "42501":
    case "PGRST301":
    case "22P02":
    case "23503":
      return { code: "event_not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// EVT-07 — guest registration. The rows, their mappers, the sentences and the SQLSTATEs.
// 01-plan.md sections 4.2 and 4.3; `supabase/migrations/20261009150000_evt07_guest_registration.sql`.
// ---------------------------------------------------------------------------

/** The six columns of `event_guest` in the select grant. `email` and `manage_token_hash` are not
 *  granted, so `select("*")` is refused — never use it here. */
interface GuestRow {
  id: string;
  event_id: string;
  name: string;
  status: GuestStatus;
  created_at: string;
  updated_at: string;
}

const GUEST_COLUMNS: string = "id, event_id, name, status, created_at, updated_at";

// Typed `string`, GUEST_EVENT_COLUMNS' reason: the client must not re-derive a row type from the
// literal. Each is its function's full return list.
const GUEST_TERMS_COLUMNS: string = "requires_approval, registration_open";
const GUEST_RECEIPT_COLUMNS: string = "manage_token, status";
const GUEST_REGISTRATION_COLUMNS: string =
  "event_name, start_date, end_date, location, guest_name, status, registration_open, event_deleted";
const GUEST_EMAIL_COLUMNS: string = "guest_id, email";

function toEventGuest(row: GuestRow, email: string | null): EventGuest {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** `public.get_guest_registration`'s eight columns. */
interface GuestRegistrationRow {
  event_name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  guest_name: string;
  status: GuestStatus;
  registration_open: boolean;
  event_deleted: boolean;
}

// Repeated verbatim in src/lib/data/mock.ts. Neither "does not work" sentence says why.
const GUEST_NAME_INVALID = "Please give your name, in 100 characters or fewer.";
const GUEST_EMAIL_INVALID = "Please give a valid email address, in 254 characters or fewer.";
const GUEST_ALREADY_REGISTERED = "That email is already registered for this event.";
const GUEST_LINK_NOT_FOUND = "This link does not work.";
const GUEST_REGISTRATION_NOT_FOUND = "This link does not work.";
const GUEST_DECIDE_REFUSED = "This guest's place could not be changed.";

/** § 4.1's checks, made before the round trip in both implementations — AFFORDANCES; the table's
 *  `event_guest_name_shape` and `event_guest_email_shape` are the controls. Lengths in code points,
 *  as `char_length` counts. Repeated in mock.ts. */
function guestInputFailure(name: string, email: string): Failure | null {
  if (name === "" || [...name].length > GUEST_NAME_MAX) {
    return { code: "invalid_guest_name", message: GUEST_NAME_INVALID };
  }
  if ([...email].length > GUEST_EMAIL_MAX || !GUEST_EMAIL_PATTERN.test(email)) {
    return { code: "invalid_guest_email", message: GUEST_EMAIL_INVALID };
  }
  return null;
}

/**
 * The SQLSTATEs `event_guest_guard` and the guest functions answer with. MATCHED ON THE SQLSTATE,
 * NEVER ON THE MESSAGE. `EV004`–`EV007` are the custom codes the migration header documents.
 */
function toGuestFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    case "EV001":
      return { code: "event_full", message: EVENT_FULL };
    case "EV002":
      return { code: "event_registration_closed", message: EVENT_REGISTRATION_CLOSED };
    case "EV004":
      return { code: "guest_link_not_found", message: GUEST_LINK_NOT_FOUND };
    case "EV005":
      return { code: "guest_registration_not_found", message: GUEST_REGISTRATION_NOT_FOUND };
    case "EV006":
      return { code: "invalid_guest_name", message: GUEST_NAME_INVALID };
    case "EV007":
      return { code: "invalid_guest_email", message: GUEST_EMAIL_INVALID };
    case "23505":
      return { code: "guest_already_registered", message: GUEST_ALREADY_REGISTERED };
    case "22023":
      return { code: "invalid_attendance_change", message: ATTENDANCE_CHANGE_INVALID };
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "attendance_not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// EVT-08 — email invitations. The row, its mapper, the sentences and the SQLSTATEs.
// 01-plan.md sections 4.2 and 4.3; `supabase/migrations/20261012100000_evt08_event_email_invitation.sql`.
// ---------------------------------------------------------------------------

/** The five columns of `event_email_invitation` in the select grant — there is no sixth. */
interface EmailInvitationRow {
  id: string;
  event_id: string;
  email: string;
  invited_by: string;
  created_at: string;
}

const EMAIL_INVITATION_COLUMNS: string = "id, event_id, email, invited_by, created_at";
// Typed `string`, GUEST_EVENT_COLUMNS' reason. `invite_to_event`'s full return list.
const INVITATION_OUTCOME_COLUMNS: string = "email, outcome";

function toEmailInvitation(row: EmailInvitationRow): EventEmailInvitation {
  return {
    id: row.id,
    eventId: row.event_id,
    email: row.email,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
  };
}

// Repeated verbatim in src/lib/data/mock.ts. Neither says whether an address belongs to a member, and
// the refusal never confirms that the event exists.
const INVITATION_EMAIL_INVALID =
  "Each address must look like name@example.com, in 254 characters or fewer.";
const INVITATION_NOT_PUBLIC = "Invitations can only be sent for public events.";
const INVITATION_REFUSED = "Invitations could not be sent for this event.";

/** § 4.1's checks, made before the round trip in both implementations — AFFORDANCES; the function's
 *  EV008 and the table's `event_email_invitation_email_shape` are the controls. Trims, drops
 *  empties; null when nothing is left or any address fails. Repeated in mock.ts. */
function invitationAddresses(emails: string[]): string[] | null {
  const trimmed = emails.map((e) => e.trim()).filter((e) => e !== "");
  if (trimmed.length === 0) return null;
  if (trimmed.some((e) => [...e].length > GUEST_EMAIL_MAX || !GUEST_EMAIL_PATTERN.test(e))) return null;
  return trimmed;
}

/** `invite_to_event`'s answers. MATCHED ON THE SQLSTATE, NEVER ON THE MESSAGE. A refusal by
 *  `may_manage_event` (42501), no session (PGRST301) and an id that is not a uuid (22P02) are ONE
 *  answer, so none of them says whether the event exists (AC-3). */
function toInvitationFailure(error: PostgrestError): Failure {
  switch (error.code) {
    case "EV008":
      return { code: "invalid_invitation_email", message: INVITATION_EMAIL_INVALID };
    case "EV009":
      return { code: "invitation_not_public", message: INVITATION_NOT_PUBLIC };
    case "42501":
    case "PGRST301":
    case "22P02":
      return { code: "event_not_permitted", message: INVITATION_REFUSED };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// TSK-01 — tasks. The row, its mapper, the sentences and the SQLSTATEs.
// 01-plan.md sections 4.2 to 4.4; `supabase/migrations/20261015120000_tsk01_task.sql`. ADR-057.
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  member_id: string;
  date: string;
  title: string;
  note: string | null;
  time_of_day: string | null; // TSK-06. Postgres returns "HH:MM:SS"
  done: boolean;
  created_at: string;
}

// Named explicitly rather than `*`, the shape this file uses everywhere. Eight columns; TSK-06's
// `time_of_day` is the only one holding a time (ADR-062). *Until TSK-06: "Seven columns, none a time."*
const TASK_COLUMNS = "id, member_id, date, title, note, time_of_day, done, created_at";

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    title: row.title,
    note: row.note,
    timeOfDay: row.time_of_day === null ? null : row.time_of_day.slice(0, 5),
    done: row.done,
    createdAt: row.created_at,
  };
}

// 01-plan.md § 4.2. Repeated verbatim in src/lib/data/mock.ts. `TASK_NOT_PERMITTED` never confirms
// that the task exists (AC-17).
const TASK_TITLE_INVALID = "Give the task a title of at most 200 characters.";
const TASK_NOTE_INVALID = "Keep the note to at most 1000 characters.";
const TASK_DATE_PAST = "A task can be dated today or later.";
const TASK_NOT_PERMITTED = "This task could not be changed. It may have been deleted.";
const TASK_SAVE_FAILED = "This task could not be saved.";
const TASK_TIME_INVALID = "Pick a time as HH:MM, or leave it empty.";

/** AC-8. Trims title and note (an empty note becomes null) and refuses in the order title, note.
 *  AFFORDANCES: `task_title_shape` and `task_note_shape` are the controls. Repeated in mock.ts. */
function taskText(
  title: string,
  note: string | null,
): { ok: true; title: string; note: string | null } | { ok: false; error: Failure } {
  const t = title.trim();
  if (t === "" || [...t].length > TASK_TITLE_MAX) {
    return { ok: false, error: { code: "invalid_task_title", message: TASK_TITLE_INVALID } };
  }
  const n = note === null ? "" : note.trim();
  if ([...n].length > TASK_NOTE_MAX) {
    return { ok: false, error: { code: "invalid_task_note", message: TASK_NOTE_INVALID } };
  }
  return { ok: true, title: t, note: n === "" ? null : n };
}

/** TSK-06 AC-4. "" and null are no time; "HH:MM" 00:00..23:59 is a time; anything else refuses.
 *  AFFORDANCE: the `time` type and `task_time_of_day_shape` are the control. Repeated in mock.ts. */
function taskTime(
  value: string | null | undefined,
): { ok: true; timeOfDay: string | null } | { ok: false; error: Failure } {
  if (value === undefined || value === null || value === "") return { ok: true, timeOfDay: null };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return { ok: false, error: { code: "invalid_task_time", message: TASK_TIME_INVALID } };
  }
  return { ok: true, timeOfDay: value };
}

/** AC-7, AC-11. The date floor, held HERE AND ON THE PAGE ONLY — the database holds none (01-plan.md
 *  § 1 decision 2). `yyyy-MM-dd` compares correctly as a string. */
const taskDatePast = (date: string): boolean => date < eventToday();

/** MATCHED ON THE SQLSTATE, NEVER ON THE MESSAGE. A policy refusal (42501), no session (PGRST301) and
 *  an id that is not a uuid (22P02) are ONE answer, so none of them says whether the task exists. */
function toTaskFailure(error: PostgrestError): Failure {
  switch (error.code) {
    case "42501":
    case "PGRST301":
    case "22P02":
      return { code: "task_not_permitted", message: TASK_NOT_PERMITTED };
    default:
      // 23514 lands here and is unreachable: `taskText` refuses both shapes first.
      return { code: "unknown", message: TASK_SAVE_FAILED };
  }
}

/** The three writes that return one row. ZERO ROWS BACK IS A REFUSAL: an UPDATE that
 *  `task_update_own` filters answers 200 with an empty body. */
async function updateTaskRow(
  taskId: string,
  values: { title?: string; note?: string | null; time_of_day?: string | null; date?: string; done?: boolean },
): Promise<Result<Task>> {
  const { data, error } = await client()
    .from("task")
    .update(values)
    .eq("id", taskId)
    .select(TASK_COLUMNS)
    .returns<TaskRow[]>();
  if (error) return { ok: false, error: toTaskFailure(error) };
  const row = (data ?? [])[0];
  if (!row) return { ok: false, error: { code: "task_not_permitted", message: TASK_NOT_PERMITTED } };
  return { ok: true, value: toTask(row) };
}

/** `listTasks` and `listOverdueTasks`' shared bound. Throws at DATASTORE_MAX_ROWS, `listEventGuests`'
 *  sentence shape. */
function boundedTasks(name: string, rows: TaskRow[]): Task[] {
  if (rows.length >= DATASTORE_MAX_ROWS) {
    throw new Error(
      `${name} returned ${rows.length} rows at the ${DATASTORE_MAX_ROWS} limit: ` +
        `the list may be truncated and must not be shown as complete`,
    );
  }
  return rows.map(toTask);
}

// ---------------------------------------------------------------------------
// EVT-04 — notifications. The row, its mapper and the sentences.
// 01-plan.md sections 4.2 and 4.3; `supabase/migrations/20261008120000_evt04_notification.sql`.
// ---------------------------------------------------------------------------

interface NotificationRow {
  id: string;
  recipient_id: string;
  kind: NotificationKind;
  event_id: string | null;
  event_name: string;
  actor_id: string;
  created_at: string;
  read_at: string | null;
}

// The eight columns, named explicitly — the shape this file uses everywhere.
const NOTIFICATION_COLUMNS =
  "id, recipient_id, kind, event_id, event_name, actor_id, created_at, read_at";

function toNotification(row: NotificationRow): EventNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    kind: row.kind,
    eventId: row.event_id,
    eventName: row.event_name,
    actorId: row.actor_id,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

// Repeated verbatim in src/lib/data/mock.ts. A mark can fail only on the network or unexpectedly —
// a row that is not the caller's is filtered by the policy and is not a failure (§ 4.1).
const NOTIFICATION_MARK_NETWORK = "Could not reach the server. Please try again.";
const NOTIFICATION_MARK_FAILED = "Notifications could not be marked as read. Please try again.";

// EVT-05 § 4.2. Repeated verbatim in src/lib/data/mock.ts. No row written — no member row, or a
// removed member — is the one refusal; a transport failure is `network` with the sentence above.
const EVENT_EMAIL_SAVE_FAILED = "Your email setting could not be saved.";

/** `status === 0` is postgrest-js's answer when the request never reached the server (verified in
 *  node_modules/@supabase/postgrest-js/dist/index.mjs, the fetch `catch`); everything else is
 *  `unknown`. */
function toNotificationFailure(status: number): Failure {
  return status === 0
    ? { code: "network", message: NOTIFICATION_MARK_NETWORK }
    : { code: "unknown", message: NOTIFICATION_MARK_FAILED };
}

// ---------------------------------------------------------------------------
// SOLO, 2026-09-26 — report an issue. The row, its mapper, its sentences and its SQLSTATEs.
// ---------------------------------------------------------------------------

interface IssueReportRow {
  id: string;
  member_id: string;
  kind: IssueKind;
  message: string;
  page: string;
  status: IssueStatus;
  created_at: string;
  /** Optional in the TYPE and `not null` in the table, for the reason `toIssueReport` records: a
   *  build whose database predates the images migration is answered without this column. */
  images?: string[] | null;
}

// Named explicitly rather than selected with `*`, the shape this file uses everywhere: a column
// added to the table by a later migration stays invisible here until somebody names it.
const ISSUE_REPORT_COLUMNS = "id, member_id, kind, message, page, status, created_at, images";

/** The bucket, named once. It is PRIVATE — see `20260926140000_solo_issue_report_images.sql` § 2 for
 *  why that is the whole security property of this feature. */
const ISSUE_BUCKET = "issue-report";

/** How long a signed URL lives. Long enough to read a page of reports without a re-mint, short
 *  enough that a URL pasted into a chat stops working the same afternoon. */
const ISSUE_URL_TTL_SECONDS = 60 * 60;

function toIssueReport(row: IssueReportRow): IssueReport {
  return {
    id: row.id,
    memberId: row.member_id,
    kind: row.kind,
    message: row.message,
    page: row.page,
    status: row.status,
    createdAt: row.created_at,
    // `?? []` because a build running against a database where
    // `20260926140000_solo_issue_report_images.sql` has not been applied selects a column that does
    // not exist and PostgREST answers without it. The column is `not null` once it exists, so this
    // is about the unapplied state and nothing else — and it is the difference between the admin
    // list rendering and `report.images.length` throwing on every row.
    images: row.images ?? [],
  };
}

// Repeated verbatim in src/lib/data/mock.ts, the shape the team and rank refusals already use, so
// the two implementations cannot drift a sentence apart.
const ISSUE_SEND_REFUSED = "That report could not be sent.";
const ISSUE_STATUS_REFUSED = "That report could not be updated.";
const ISSUE_MESSAGE_REQUIRED = "Please write what went wrong before sending.";
const ISSUE_MESSAGE_TOO_LONG = "That report is too long. Please keep it under 2000 characters.";

/**
 * The longest message `issue_report_message_length` accepts. **A SECOND COPY OF A NUMBER IN THE
 * MIGRATION, AND IT IS DELIBERATE.** The constraint is the control and this is a courtesy: refusing
 * in the seam means a person is told before a request leaves rather than meeting a raw 23514. Both
 * copies moving together is the cost, and the constant is named so a diff shows it.
 */
const ISSUE_MESSAGE_MAX = 2000;

// SOLO, 2026-09-26 (second run) — the image refusals, repeated verbatim in src/lib/data/mock.ts for
// the reason `issueMessageFailure` records below.
const ISSUE_TOO_MANY_IMAGES = `Please attach at most ${ISSUE_IMAGE_MAX_COUNT} images.`;
const ISSUE_IMAGE_TOO_LARGE = "One of those images is over 5 MB. Please attach a smaller one.";
const ISSUE_IMAGE_WRONG_TYPE = "Images must be PNG, JPEG or WebP.";
const ISSUE_UPLOAD_FAILED = "That image could not be uploaded. Please try again.";

/**
 * SOLO, 2026-09-26 — the SQLSTATEs the report writes answer with, and a SIXTH mapper rather than
 * more cases in `toPostgrestFailure`, for the reason `toEntryFailure` and `toTeamFailure` both
 * record: `23514` here means "the message is blank or too long" and nowhere else in this file means
 * that, and one function answering two tables with one sentence is how a wrong message reaches a
 * screen.
 *
 * `23514` should be unreachable — the seam refuses both conditions before the request is issued —
 * so it is mapped rather than left in `unknown` for the caller that is NOT this application.
 */
function toIssueFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    case "23514":
      return { code: "invalid_issue_message", message: ISSUE_MESSAGE_REQUIRED };
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

/**
 * The two seam-side refusals of a message: blank once trimmed, or longer than the check constraint
 * accepts. Returns the failure, or `null` when the message is acceptable.
 *
 * **REPEATED IN `src/lib/data/mock.ts` RATHER THAN IMPORTED FROM HERE, AND THE CHOICE IS THE FILE'S
 * OWN CONVENTION.** Every shared sentence in these two implementations is written twice with a note
 * saying so — `TEAM_RENAME_REFUSED`, `MEMBER_MOVE_REFUSED`, `MEMBER_RANK_REFUSED` and the entry
 * refusals all do it. The alternative was exporting this and having the mock import the real seam,
 * which adds a runtime import edge between two implementations that are meant to be swappable, to
 * save eight lines. `tests/issue-reports.test.ts` asserts the two agree on the code, which is what
 * makes the duplication checkable rather than merely intended.
 */
function issueMessageFailure(message: string): Failure | null {
  const trimmed = message.trim();
  if (trimmed === "") {
    return { code: "invalid_issue_message", message: ISSUE_MESSAGE_REQUIRED };
  }
  if (trimmed.length > ISSUE_MESSAGE_MAX) {
    return { code: "invalid_issue_message", message: ISSUE_MESSAGE_TOO_LONG };
  }
  return null;
}

/**
 * SOLO, 2026-09-26 (second run). The three refusals of the optional attachments, in the order a
 * person is most likely to hit them. Repeated in `src/lib/data/mock.ts`, like the rule above.
 *
 * **THE BUCKET'S `file_size_limit` AND `allowed_mime_types` ARE THE CONTROL AND THIS IS THE
 * COURTESY** — but it is a courtesy worth the duplication here and nowhere else in this seam,
 * because the thing it saves is five megabytes leaving somebody's machine before they are told no.
 *
 * ONE CODE FOR THREE CONDITIONS: they all reach the same file input, and `FailureCode`'s own entry
 * records why that means one code with three sentences rather than three codes.
 */
function issueImageFailure(files: readonly File[]): Failure | null {
  if (files.length > ISSUE_IMAGE_MAX_COUNT) {
    return { code: "invalid_issue_image", message: ISSUE_TOO_MANY_IMAGES };
  }
  for (const file of files) {
    // TYPE BEFORE SIZE, so somebody who attached a PDF is told what is wrong with it rather than
    // being told it is too big — which would send them to compress a file that would be refused at
    // any size.
    if (!ISSUE_IMAGE_TYPES.includes(file.type)) {
      return { code: "invalid_issue_image", message: ISSUE_IMAGE_WRONG_TYPE };
    }
    if (file.size > ISSUE_IMAGE_MAX_BYTES) {
      return { code: "invalid_issue_image", message: ISSUE_IMAGE_TOO_LARGE };
    }
  }
  return null;
}

/**
 * The object path an uploaded image gets: `<the caller's uid>/<a uuid>.<ext>`.
 *
 * **THE FIRST SEGMENT IS LOAD-BEARING AND IS NOT A TIDY-UP.** `issue_image_insert_own` compares
 * `(storage.foldername(name))[1]` with `auth.uid()`, so this shape is what makes an upload the
 * caller's own; a flat path would be refused by that policy, and a path built from anything the
 * caller controls would be the policy's whole predicate handed to them.
 *
 * **THE NAME IS A UUID AND NOT THE FILE'S OWN NAME.** A person's filename can carry their identity,
 * their employer, a customer's name or a path from their machine, and a bucket's object names are
 * not covered by the row-level story the rest of this feature tells. The extension is derived from
 * the TYPE — which the browser set — and not from the name, for the same reason.
 */
function issueObjectPath(uid: string, file: File): string {
  const extension =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return `${uid}/${crypto.randomUUID()}.${extension}`;
}

// Vite exposes only variables prefixed VITE_. The anon key is public by design and ships in the
// bundle; the service role key must never appear here. See "Secrets" in
// .ai/standards/rbac-and-security.md.
const url = () => import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// Constructed lazily, and deliberately.
//
// The first version built the client at module load. `createClient` throws on an empty URL, so
// importing this file without environment variables crashed — which meant the seam-parity test
// could not import the very implementation it exists to compare. The test caught it on its first
// run, which is what a mandatory test is for.
let cached: SupabaseClient | null = null;

export function client(): SupabaseClient {
  if (!cached) cached = createClient(url(), anonKey());
  return cached;
}

/** MIR-16-e, ADR-084 decision 2. The database's spelling of a member's role. The application keeps
 *  `MemberRole` ("member" | "manager" | "admin") until MIR-17; these two functions are the only
 *  place the two vocabularies meet. */
type DbMemberRole = "member" | "manager" | "org_admin";

const fromDbRole = (role: DbMemberRole): MemberRole => (role === "org_admin" ? "admin" : role);
const toDbRole = (role: MemberRole): DbMemberRole => (role === "admin" ? "org_admin" : role);

/** MIR-17-d, ADR-091 decision 1. The application's one role per person: org_admin from
 *  `member.role`, manager when the person manages any team (`manages_a_team`), member otherwise. */
const appRole = (row: MemberRow): MemberRole =>
  row.role === "org_admin" ? fromDbRole(row.role) : row.manages_a_team ? "manager" : "member";

// The `member` row as PostgREST returns it: snake_case, straight off the column names in
// supabase/migrations. This file is the only place the database casing and the domain casing meet
// (.ai/standards/architecture.md, "Layers" — code above the seam never sees a column name).
interface MemberRow {
  id: string;
  team_id: string | null;
  display_name: string;
  avatar: string;
  role: DbMemberRole;
  manages_a_team: boolean;
  status: MemberStatus;
  email: string | null;
  last_sign_in_at: string | null;
  removed_at: string | null;
  created_at: string;
}

// SOLO, 2026-09-10. `status` joins the list. Selecting it explicitly rather than with `*` is the
// shape this file already uses everywhere, and it is what makes a column added to the table by a
// later migration invisible here until somebody names it.
//
// MIR-21, ADR-077 decision 2. `team_id` is the computed field `roster_team_id`, aliased so that
// `MemberRow` and `toMember` are unchanged: the roster team read from `membership`, which equals the
// column under ADR-071's mirror. The bare column is no longer read, so MIR-21-b can drop it.
const MEMBER_COLUMNS =
  "id, team_id:roster_team_id, display_name, avatar, role, manages_a_team, status, email, last_sign_in_at, removed_at, created_at";

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    teamId: row.team_id,
    displayName: row.display_name,
    avatar: row.avatar,
    role: appRole(row),
    status: row.status,
    email: row.email,
    lastSignInAt: row.last_sign_in_at,
    removedAt: row.removed_at,
    createdAt: row.created_at,
  };
}

// SOLO, 2026-09-10. The `allowed_email` row shape, its column list and its mapper stood here until
// the table was dropped. Nothing in this file models it any more.

// CAL-01. The `entry` row as PostgREST returns it.
//
// `date_range` and `portion_slots` are NOT selected and not declared here. ADR-011 creates them as
// stored generated columns for the exclusion constraint and for CAL-04's `date_range=ov.…` filter;
// this ticket has no read that filters on them, and selecting a column nobody consumes would put a
// PostgreSQL range literal one destructuring away from a component.
interface EntryRow {
  id: string;
  member_id: string;
  type: EntryType;
  portion: EntryPortion;
  start_date: string;
  end_date: string;
  tentative: boolean;
  status: EntryStatus;
  rejection_reason: string | null;
  note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

const ENTRY_COLUMNS =
  "id, member_id, type, portion, start_date, end_date, tentative, status, rejection_reason, note, " +
  "approved_by, approved_at, created_at, updated_at";

// AC-3 lives here. `end_date` is read from the PLAIN COLUMN and never derived from `date_range`'s
// upper bound: PostgreSQL canonicalises a stored discrete range to `[)`, so an entry ending on the
// 9th is stored as `['2026-10-05','2026-10-10')` and the upper bound is the day AFTER the entry ends
// (ADR-011 section 1). Deriving it would be silently off by one, on every entry, in the direction
// nobody checks.
function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    memberId: row.member_id,
    type: row.type,
    portion: row.portion,
    startDate: row.start_date,
    endDate: row.end_date,
    tentative: row.tentative,
    status: row.status,
    rejectionReason: row.rejection_reason,
    note: row.note,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// CAL-04. The `team` row as PostgREST returns it. `overload_threshold` is `numeric` in PostgreSQL
// and PostgREST renders it as a JSON number, so it arrives as a `number` and needs no parse — a
// column that ever grows past double precision would need one, and 0 to 1 never will.
interface TeamRow {
  id: string;
  name: string;
  overload_threshold: number;
  // SOLO, 2026-09-11. `boolean not null default true`, from 20260911170000_solo_approval_settings.sql.
  wfh_need_approve: boolean;
  pto_need_approve: boolean;
  created_at: string;
}

// SOLO, 2026-09-11 adds the two approval columns. **EVERY TEAM READ NOW NAMES THEM, SO A BUILD WHERE
// THAT MIGRATION HAS NOT BEEN APPLIED FAILS EVERY TEAM READ** — PostgREST answers 400 for an unknown
// column, `getTeam` throws, and each calendar view lands in its `unavailable` state. That is loud on
// purpose: the alternative, a read that silently omits the columns, would draw the approval screen
// with both switches reading `undefined` and save whatever the form defaulted to.
const TEAM_COLUMNS = "id, name, overload_threshold, wfh_need_approve, pto_need_approve, created_at";

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    overloadThreshold: row.overload_threshold,
    wfhNeedApprove: row.wfh_need_approve,
    ptoNeedApprove: row.pto_need_approve,
    createdAt: row.created_at,
  };
}

// ADM-02. The `holiday` row as PostgREST returns it. NO `team_id` COLUMN EXISTS to select — the
// calendar is national (ADR-015 section 1), which is why this row shape is the only one in this file
// with nothing to scope.
//
// `date` arrives as `yyyy-MM-dd`: PostgREST renders a `date` column as that string and nothing here
// parses it into a `Date`. ADR-015 Consequences names why that matters on this table specifically —
// `new Date('2026-06-11')` is UTC midnight, so a weekday read west of UTC yields Wednesday for a
// Thursday holiday and the bridge day moves.
interface HolidayRow {
  id: string;
  date: string;
  name: string;
  kind: HolidayKind;
  created_at: string;
}

const HOLIDAY_COLUMNS = "id, date, name, kind, created_at";

// SOLO, 2026-09-11. The `busy_day` row, in datastore casing.
//
// FOUR COLUMNS AND NO FIFTH. There is no `status`, no `tentative`, no `note` and no `updated_at`:
// the row is never edited, only created and destroyed, so there is nothing an update timestamp could
// record. `src/lib/domain/types.ts` carries the reasoning for each absence.
interface BusyDayRow {
  id: string;
  member_id: string;
  date: string;
  created_at: string;
}

const BUSY_DAY_COLUMNS = "id, member_id, date, created_at";

function toBusyDay(row: BusyDayRow): BusyDay {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    createdAt: row.created_at,
  };
}

// Repeated verbatim in src/lib/data/mock.ts so the two implementations carry the same words — the
// rule CAL-01's three refusal constants state.
const BUSY_DAY_REFUSED = "This day could not be marked. You may only mark your own days.";

// SOLO, 2026-09-11. Repeated verbatim in src/lib/data/mock.ts so the two implementations carry the
// same words.
const TEAM_RENAME_REFUSED = "Only an admin can rename the team.";
const EMPTY_TEAM_NAME = "The team needs a name.";
// SOLO, 2026-09-11 — many teams. Repeated verbatim in src/lib/data/mock.ts.
const TEAM_CREATE_REFUSED = "Only an admin can create a team.";
const TEAM_DELETE_REFUSED = "Only an admin can delete a team.";
const TEAM_NOT_EMPTY =
  "This team still has people on it and cannot be deleted. Anybody who was removed from it stays " +
  "on it for history, so a team that has ever had somebody removed can never be deleted.";
const MEMBER_MOVE_REFUSED = "That person could not be moved.";
// SOLO, 2026-09-24 — ADR-044. Repeated verbatim in src/lib/data/mock.ts, and they are the sentences
// TEA-04 and ADR-035 already shipped: the write moved off the table, the words a person reads did
// not, so nothing on the Members screen changed wording under somebody mid-task.
const MEMBER_PROMOTE_REFUSED = "That person could not be promoted.";
const MEMBER_RANK_REFUSED = "That person's role could not be changed.";

/**
 * SOLO, 2026-09-11 — the SQLSTATEs the seven team functions raise, and a FOURTH mapper rather than
 * more cases in `toPostgrestFailure`, for the reason `toEntryFailure` records: `23503` here means
 * "the team still has people on it" and nowhere else in this file means that, and one function
 * answering two tables with one sentence is how a wrong message reaches a screen.
 *
 * MATCHED ON THE SQLSTATE, NEVER ON THE MESSAGE — the function bodies' wording is not a contract.
 */
function toTeamFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    case "23503":
      return { code: "team_not_empty", message: TEAM_NOT_EMPTY };
    case "22023":
      return { code: "empty_team_name", message: EMPTY_TEAM_NAME };
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the function as nobody
      return { code: "not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

/** A function returning one `public.team` row answers with an OBJECT, not a one-element array.
 *  Anything else is a contract violation and is reported as one, never cast and trusted. */
const isTeamRow = (value: unknown): value is TeamRow =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as TeamRow).id === "string";

/** SOLO, 2026-09-24. `isTeamRow`'s twin, and the same reason: `public.set_member_role` (and, since
 *  MIR-03, `public.promote_member_to_admin`) returns ONE `public.member`, which PostgREST answers as
 *  an OBJECT and not a one-element array. Anything else is a contract violation and is reported as
 *  one, never cast and trusted. */
const isMemberRow = (value: unknown): value is MemberRow =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as MemberRow).id === "string";

/**
 * SOLO, 2026-09-24 — ADR-044. The rank write, which `setMemberRole` reaches.
 *
 * **MIR-03, 2026-10-20 — ADR-065: OWN TEAM ONLY, AND NOT `admin`.** `public.set_member_role` now
 * carries `team_id = member_team_id(auth.uid())` and refuses `p_role = 'admin'` with a `42501`.
 * Promotion has its own RPC, `promote_member_to_admin`, and `promoteMember` no longer comes here.
 * The paragraphs below are ADR-044's and still describe why this is an RPC.
 *
 * **IT IS AN RPC AND NOT A TABLE UPDATE, WHICH IS THE WHOLE CHANGE.** `member_update_admin` carries
 * `team_id = member_team_id(auth.uid())`, so the update it admits is the caller's OWN team's — while
 * the Members screen has read every team since `list_all_members()` shipped. The mismatch reached a
 * person as *"That person's role could not be changed."* on a button the screen had just drawn for
 * them. `public.set_member_role` is `security definer` and tests `is_admin` in its own body, the
 * shape ADR-039 chose for every cross-team operation; the table policy is untouched.
 *
 * **A 42501 IS THE REFUSAL, WHERE ZERO ROWS USED TO BE.** A definer function raises rather than
 * filtering, so the "no row matched" case that `removeMember` still documents does not arise here —
 * `if not found` inside the function becomes the same `42501` as the admin test. `!error` is
 * success, and the row guard below is what stops a body of some other shape being read as one.
 *
 * The sentence is a PARAMETER for `toEntryFailure`'s reason: "That person could not be promoted."
 * on a press of *Make manager* is the wrong message, and the two callers press different buttons.
 */
async function setRankThroughRpc(
  memberId: string,
  role: MemberRole,
  refusal: string,
): Promise<Result<Member>> {
  // MIR-21-c, ADR-080 decision 1. The column is about to go stale, so `team_id` is the roster team:
  // `MEMBER_COLUMNS` reads it through the computed field over the returned row.
  const { data, error } = await client()
    .rpc("set_member_role", { p_member_id: memberId, p_role: toDbRole(role) })
    .select(MEMBER_COLUMNS)
    .single<MemberRow>();

  if (error) return { ok: false, error: toRankFailure(error, refusal) };
  if (!isMemberRow(data)) return { ok: false, error: { code: "unknown", message: refusal } };

  // MIR-16-f, ADR-086 decision 3. The rank was written to `membership.team_role` by this call; the
  // computed field read over the returned row may see the statement's starting snapshot, so the
  // rank the call set is the answer.
  return { ok: true, value: { ...toMember(data), role } };
}

/**
 * SOLO, 2026-09-24. The SQLSTATEs `public.set_member_role` (and, since MIR-03,
 * `public.promote_member_to_admin`) can answer with, and a FIFTH mapper for
 * the reason `toTeamFailure` and `toEntryFailure` both record: the sentence differs per screen even
 * where the code does not.
 *
 * `22P02` is reachable and is deliberately NOT `not_permitted`: it is PostgREST failing to cast a
 * string to `public.member_role` before the function body runs, which means a caller that is not
 * this application, and calling that "you may not" would be false.
 */
function toRankFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the function as nobody
      return { code: "not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}
const APPROVAL_SETTINGS_REFUSED = "Only an admin can change which entries need approval.";

function toHoliday(row: HolidayRow): Holiday {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

// The read half of `getCurrentMember`, shared with `getOwnMember` so the two cannot answer
// differently about the same row.
async function readMember(userId: string): Promise<Member | null> {
  const { data, error } = await client()
    .from("member")
    .select(MEMBER_COLUMNS)
    .eq("id", userId)
    .maybeSingle<MemberRow>();

  if (error) throw new Error(`getOwnMember failed for ${userId}: ${error.message}`);
  return data ? toMember(data) : null;
}

// TEA-02. Module-level rather than a call through `this`: `addAllowedEmail` needs the caller's own
// row, and a seam method reaching for a sibling through `this` breaks the moment the object is
// destructured — which is exactly what tests/seam-parity.test.ts does to it.
async function readCurrentMember(): Promise<Member | null> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) return null;
  return readMember(data.user.id);
}

function toAuthUser(user: User): Session["user"] {
  return {
    id: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
  };
}

function toSession(session: SupabaseSession): Session {
  return { user: toAuthUser(session.user), accessToken: session.access_token };
}

// Expected failures are returned, not thrown (.ai/standards/coding-standards.md, Error handling).
// The message is what the sign-up screen renders, so it is English — `.ai/standards/ui-design-system.md`
// § Language covers the `message` half of every refusal that crosses the seam; the code is what a
// caller branches on and never moves (OPS-002 AC-6).
function toFailure(error: AuthError): Failure {
  if (isAuthRetryableFetchError(error)) {
    return { code: "network", message: "Could not reach the server. Please try again." };
  }
  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return { code: "email_already_registered", message: "That address already has an account." };
    case "weak_password":
      return { code: "weak_password", message: "That password is too weak. Please choose a longer one." };
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return { code: "rate_limited", message: "Too many attempts. Please wait a moment and try again." };
    case "invalid_credentials":
      return { code: "invalid_credentials", message: "That email or password is not correct." };
    // TEA-05 AC-3. Deliberately NOT folded into the line above. GoTrue returns this code whatever
    // this file renders, so the account-existence signal is already at the API and hiding it here
    // would buy nothing while sending somebody to reset a password that is correct. What ADR-009
    // protects — whether an address is on the ALLOW-LIST — stays hidden in both branches.
    // SOLO, 2026-09-10. Hosted Supabase refuses an address whose domain does not resolve or cannot
    // receive mail. Nothing in this application can turn that off, so the honest answer is to say
    // what would work rather than to offer a retry of the same address.
    case "email_address_invalid":
      return {
        code: "email_address_invalid",
        message: "That email address was not accepted. Use an address at a domain that can receive mail.",
      };
    case "email_not_confirmed":
      return {
        code: "email_not_confirmed",
        message: "Open the confirmation link in your email before signing in.",
      };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// TEA-02. The same contract as `toFailure` above, for the PostgREST side of the client: expected
// failures are RETURNED, not thrown (.ai/standards/coding-standards.md, Error handling).
//
// ONE CODE REMAINS HERE — `42501`/`PGRST301` — SINCE MIR-09. The `23505` arm mapped to the
// allow-list's own refusal and was removed with the table: none of this mapper's four callers
// (`removeMember`, `updateOwnProfile`, `setOverloadThreshold`, `setApprovalSettings`) writes a column
// with a unique constraint, so a `23505` reaching any of them now falls to `unknown`.
function toPostgrestFailure(error: PostgrestError): Failure {
  switch (error.code) {
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "not_permitted", message: "You do not have permission to do this." };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// CAL-01. 01-plan.md section 4.3, and it is a SEPARATE mapper from `toPostgrestFailure` above
// rather than three more cases inside it. The two tables answer the same SQLSTATE with different
// sentences - `42501` on `member` or `team` means "you are not an admin", and on `entry` it means
// "this is not your entry or you named a column you may not write" - and one function returning both
// would be the wrong message on one of the two screens.
//
// MATCHED ON THE SQLSTATE, NEVER ON THE CONSTRAINT NAME OR THE MESSAGE TEXT. A name match breaks
// silently the day `entry_no_overlapping_portion` is renamed, and PostgREST's message wording is not
// a contract.
//
// CAL-02 TAKES THE `entry_not_permitted` SENTENCE AS A PARAMETER, and the codes are unchanged. The
// three SQLSTATE mappings are 01-plan.md section 4.2's, identical to CAL-01's; what could not stay
// identical is the one sentence that names a verb. "This entry could not be created." on a screen where a
// member just pressed save on an EDIT is the wrong message, which is the exact failure the paragraph
// above records for `toPostgrestFailure` — one function answering two screens with one sentence.
// Callers branch on the CODE and it is the same code, so nothing downstream changes.
function toEntryFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    // INV-01's exclusion constraint. AC-7.
    case "23P01":
      // SOLO, 2026-09-11 — the DATELESS form of `overlapMessage`. `createEntry` and `updateEntry`
      // never reach this case for a 23P01: they route it to `overlapFailure` below, which names the
      // dates. This remains for any other caller, and says nothing about dates it does not know.
      return { code: "overlapping_entry", message: overlapMessage([]) };
    // The `entry_end_after_start` check. AC-9's SECOND lock - the seam refuses an inverted range
    // before the request is sent, so reaching this case means a caller that is not this application.
    case "23514":
      return {
        code: "invalid_date_range",
        message: "The end date must be the same as, or after, the start date.",
      };
    // AC-10 and AC-11. The insert policy filtered the row, or a withheld column privilege refused
    // the statement before any policy ran. The two are deliberately one message: a caller who
    // learned WHICH of the two refused them would be learning the shape of the grant.
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "entry_not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// ADM-03. 01-plan.md section 4.3, and it is a THIRD mapper rather than three more cases inside
// either of the two above — the rule `toEntryFailure` already states, applied one table further on.
// `23505` on `allowed_email` means "this address is already listed" and on `holiday` it means "this
// date already has a row", and one function returning both would put the wrong sentence in front of
// one of the two admins.
//
// MATCHED ON THE SQLSTATE, NEVER ON THE CONSTRAINT NAME OR THE MESSAGE TEXT, for the reason
// `toEntryFailure` records: a name match breaks silently the day the constraint is renamed, and
// PostgREST's wording is not a contract.
//
// THE REFUSAL SENTENCE IS A PARAMETER, exactly as CAL-02 made `toEntryFailure`'s: "Could not add
// this date to the calendar." in front of an admin who just pressed save on an EDIT is the wrong
// message. The CODES are the same on all three verbs, so nothing downstream branches differently.
function toHolidayFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    // `unique (date)` on `public.holiday`, created by ADM-02's migration. AC-6 on the add and AC-7
    // on the edit — the same constraint, so the same code and the same sentence.
    //
    // IT NAMES THE DATE, which is what makes it something an admin can act on rather than a
    // database error: the row they are looking for is already in the calendar, in a year the screen
    // may not be showing.
    case "23505":
      return {
        code: "holiday_date_taken",
        message: "The calendar already has a row for that date. Edit that row instead.",
      };
    // The policy refused the write, or the JWT never reached it. `not_permitted` and NOT a
    // `holiday_not_permitted` of its own: the sentence is written at the call site the way
    // `removeMember`, `promoteMember` and `setOverloadThreshold` all write theirs, so there is no
    // shared constant that would need a code to disambiguate it (01-plan.md section 4.1).
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}

// ADM-03. The three refusal sentences, one per verb, beside CAL-01's three and for the same reason:
// mock.ts repeats these literals so the two implementations of the seam carry the same words.
//
// EACH NAMES THE CALENDAR AS AN ADMIN'S TO CHANGE rather than saying "not permitted", because the
// only caller who can reach one of these through the interface is somebody who bypassed a control
// that was never rendered for them (AC-14, AC-15).
//
// MIR-15-e, ADR-079 decision 5. Each sentence now also names Org public's exception: since
// MIR-15-b `holiday_insert_admin`, `holiday_update_admin` and `holiday_delete_admin` each carry
// `and not public.org_is_shared(org_id)`, so an admin of Org public reaches this refusal through the
// interface too (AC-1), and "Only an admin can …" alone would then be false for the person reading
// it.
const HOLIDAY_ADD_REFUSED =
  "Only an admin can add to the holiday calendar, and in Org public only a system admin can.";
const HOLIDAY_UPDATE_REFUSED =
  "Only an admin can change the holiday calendar, and in Org public only a system admin can.";
const HOLIDAY_DELETE_REFUSED =
  "Only an admin can remove a day from the holiday calendar, and in Org public only a system admin can.";

// The three refusal sentences, one per verb, held here so the two implementations of the seam can
// carry the same words — mock.ts repeats these literals for the same reason src/lib/fixtures.ts and
// supabase/seed.sql repeat theirs.
// SOLO, 2026-09-11 — the overlap refusal, WITH ITS DATES. The operator asked that the sentence say
// which dates collide.
//
// **THE CONSTRAINT HAS ALREADY DECIDED AND THIS ONLY EXPLAINS.** It runs after a 23P01, so INV-01 is
// enforced exactly as before; what is added is one read of the owner's entries over the attempted
// range, and `clashingDates` names the days both ranges and both portions share.
//
// **WHY A READ AND NOT THE ERROR'S OWN `details`.** PostgreSQL's exclusion error does carry the
// conflicting key, but as `(member_id, date_range, portion_slots)=(…, [2026-10-12,2026-10-15), [0,2))`
// — a canonicalised half-open range in server text, whose shape is PostgreSQL's to change. Parsing it
// would put ADR-011's canonicalisation footgun one regex away from a sentence a person acts on.
//
// **THE OWNER, NOT THE CALLER.** On an edit the collision is with the entry's OWNER's calendar, which
// under CAL-03 may not be the caller's — so the edit path reads the owner from the row first.
//
// **EVERY FAILURE HERE FALLS BACK TO THE DATELESS SENTENCE AND NEVER TO A SQLSTATE.** The refusal is
// already true; a failed explanation must not turn it into a different error or a thrown one. No
// limit is set on the read: it is one member's entries over one range, and a capped answer could only
// shorten the list of dates, never make the refusal wrong.
async function overlapFailure(
  memberId: string | null,
  candidate: OverlapCandidate,
  excludeId: string | null,
): Promise<Failure> {
  const fallback: Failure = { code: "overlapping_entry", message: overlapMessage([]) };
  try {
    let owner = memberId;
    if (owner === null && excludeId !== null) {
      const { data, error } = await client()
        .from("entry")
        .select("member_id")
        .eq("id", excludeId)
        .returns<{ member_id: string }[]>();
      if (error) return fallback;
      owner = (data ?? [])[0]?.member_id ?? null;
    }
    if (owner === null) return fallback;

    const { data, error } = await client()
      .from("entry")
      .select(ENTRY_COLUMNS)
      .eq("member_id", owner)
      .filter("date_range", "ov", `[${candidate.startDate},${candidate.endDate}]`)
      .returns<EntryRow[]>();
    if (error) return fallback;

    const dates = clashingDates((data ?? []).map(toEntry), owner, candidate, excludeId);
    return { code: "overlapping_entry", message: overlapMessage(dates) };
  } catch {
    return fallback;
  }
}

const CREATE_REFUSED = "This entry could not be created.";
const UPDATE_REFUSED = "This entry could not be edited.";
const DELETE_REFUSED = "This entry could not be deleted.";

// ---------------------------------------------------------------------------
// ADM-05. 01-plan.md sections 4.1 and 4.2.
// ---------------------------------------------------------------------------

// The four ADM-05 sentences, repeated in mock.ts so the two implementations of the seam carry the
// same words — the rule CAL-01's three refusal constants and ADM-03's four already state.
//
// ENGLISH, unlike CAL-01's three above. `.ai/standards/ui-design-system.md` § Language requires it,
// and this file's Vietnamese literals are `copyDebt` that OPS-002 pays off rather than a precedent to
// extend — the same choice ADM-03 made for the holiday sentences. Declared in 03-impl-log.md.
//
// NONE OF THEM NAMES A QUOTA, A BALANCE OR AN ENTITLEMENT, and none says a member may not go
// (AC-18, AC-20). A refusal here is about who records the decision, never about whether the absence
// is allowed.
const DECISION_REFUSED =
  "Only an admin, or a manager of one of this person's teams, can decide this entry — and only whoever rejected it, or an admin, can change a rejection. Nothing about this entry has changed.";
const APPROVE_REFUSED = "This entry could not be approved.";
const REJECT_REFUSED = "This entry could not be rejected.";
const REASON_REQUIRED =
  "A rejection needs a reason. Say what would work instead, so the entry can be re-planned.";

// ---------------------------------------------------------------------------
// ADM-06. 01-plan.md section 4.2.
// ---------------------------------------------------------------------------

// Two more sentences, repeated in mock.ts so the two implementations of the seam carry the same
// words — the rule CAL-01's three refusal constants, ADM-03's four and ADM-05's four already state.
//
// ENGLISH, for ADM-05's reason: `.ai/standards/ui-design-system.md` § Language requires it, and this
// file's Vietnamese literals are `copyDebt` that OPS-002 pays off rather than a precedent to extend.
//
// NEITHER NAMES A QUOTA, A BALANCE OR AN ENTITLEMENT, and neither says a member may not go (AC-16).
const BULK_REJECT_REFUSED = "These entries could not be rejected.";
const NOTHING_SELECTED = "Select at least one entry before rejecting.";

// A FOURTH mapper rather than three more cases inside `toEntryFailure`, and this one is the case the
// rule those three mappers state was written for: `entry` answers the SAME TWO SQLSTATEs with
// different meanings on the decision path than on the edit path.
//
//   * `42501` on an edit means "this is not your entry, or you named a column you may not write".
//     On a decision the two columns ARE granted, so the only thing that raises it is clause (a) of
//     `public.entry_enforce_decision()` — "yours, but not this column" — which is a different
//     sentence and a different code (`entry_decision_not_permitted`, 01-plan.md section 4.1).
//   * `23514` on an edit is `entry_end_after_start`. On a decision NO DATE IS WRITTEN, so that check
//     cannot fire and the only reachable one is INV-03's biconditional
//     `entry_rejection_reason_iff_rejected`. Routing it through `toEntryFailure` would put "the end
//     date must be on or after the start date" in front of an admin who wrote no date at all.
//
// MATCHED ON THE SQLSTATE, NEVER ON THE CONSTRAINT NAME OR THE MESSAGE TEXT, for the reason
// `toEntryFailure` records: a name match breaks silently the day the constraint is renamed, and
// PostgREST's wording is not a contract.
//
// IT TAKES NO REFUSAL SENTENCE, and that is the one place it departs from `toEntryFailure` and
// `toHolidayFailure`. Those two take the verb's sentence as a parameter because the SAME code means
// "could not create" on one screen and "could not save" on another. Neither case here is
// verb-specific: clause (a) does not distinguish approving from rejecting, so its sentence names
// both acts, and INV-03's is about the reason on either path. The verb-specific sentence is the
// ZERO-ROW refusal, which each call site writes for itself with `APPROVE_REFUSED` or
// `REJECT_REFUSED`. A parameter here would be a parameter no branch could use.
function toDecisionFailure(error: PostgrestError): Failure {
  switch (error.code) {
    // INV-03's biconditional check. UNREACHABLE FROM THIS APPLICATION — `rejectEntry` refuses a
    // blank reason before the request is sent — so reaching this case means a caller that is not
    // this application, and the honest answer is still the one about the reason.
    case "23514":
      return { code: "rejection_reason_required", message: REASON_REQUIRED };
    // ADM-06. `public.reject_entries` raises this for a blank reason — ADR-016 section 4, "an empty
    // reason is refused with a sentence rather than a raw 23514". UNREACHABLE FROM THIS APPLICATION,
    // because `rejectEntries` refuses it first; reaching it means a caller that is not this
    // application, and the honest answer is still the one about the reason. It shares 23514's
    // sentence because it is the same missing thing, not because the two codes were folded.
    case "22023":
      return { code: "rejection_reason_required", message: REASON_REQUIRED };
    // AC-8 and AC-9. Clause (a) refused the write: somebody who is not an admin moved a decision
    // column. It is NOT `entry_not_permitted` — a filtered row means "not yours to touch" and this
    // means "yours, but not this column", and the two reach different people on different screens.
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the trigger as nobody
      return { code: "entry_decision_not_permitted", message: DECISION_REFUSED };
    default:
      // Kept, rather than folded into the 42501 case: an unknown failure that claimed to be a
      // permission refusal would send an admin to look for a permission they already have.
      return { code: "unknown", message: "Something went wrong. Please try again." };
  }
}


// CAL-01 AC-9 and CAL-02 AC-11, refused BEFORE the request is sent and in both write paths. ADR-011
// Consequences records that an inverted pair fails INSIDE the generated column with "range lower
// bound must be less than or equal to range upper bound" - a database error text where a sentence
// about dates belongs, and it never reaches the check constraint that would have said so legibly.
// String comparison is correct for `yyyy-MM-dd` (CAL-01 plan section 4.5) and no Date is constructed.
const invertedRange = (startDate: string, endDate: string): Failure | null =>
  endDate < startDate
    ? { code: "invalid_date_range", message: "The end date must be the same as, or after, the start date." }
    : null;

export const seam: DataSeam = {
  async ready() {
    return Boolean(url() && anonKey());
  },

  // AC-1, AC-5, AC-8, AC-13. This creates the auth user and NOTHING else. The `member` row is the
  // work of the `admit_allow_listed_member` trigger on auth.users, which is why this function has no
  // branch on whether the address is allow-listed: it cannot see the allow-list, and that is exactly
  // what makes AC-5 hold against anybody signing up rather than only against this screen.
  //
  // `options.data` maps to auth.users.raw_user_meta_data, which is where the trigger reads
  // display_name and avatar from (verified against @supabase/auth-js 2.112.4 lib/types.d.ts).
  async signUp(input: SignUpInput): Promise<Result<SignUpOutcome>> {
    const { data, error } = await client().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.displayName, avatar: input.avatar } },
    });

    if (error) return { ok: false, error: toFailure(error) };

    // With Confirm email ON, signUp returns a user and a null session; with it OFF, both. AC-13's
    // screen ignores the session either way, so a null one is a normal outcome and not a failure.
    return {
      ok: true,
      value: {
        needsEmailConfirmation: data.session === null,
        session: data.session ? toSession(data.session) : null,
      },
    };
  },

  // AC-1, AC-9. `member_select_own` lets a caller address only their own row, so "no row" and "a row
  // I may not see" collapse into one answer — null — and that is a normal answer, not an error.
  //
  // A transport or policy failure is a programmer error at this seam, not an expected outcome:
  // there is no caller-visible failure shape on this function, and returning null would report
  // "you are not a member" for what is actually a broken connection. `readMember` throws.
  async getOwnMember(userId: string): Promise<Member | null> {
    return readMember(userId);
  },

  // -------------------------------------------------------------------------
  // TEA-02. 02-design.md section 3.
  // -------------------------------------------------------------------------

  // TEA-02 AC-1, AC-9. Null when nobody is signed in and null when the auth user has no member row;
  // both are normal answers. `auth.getUser()` returns an AuthSessionMissingError rather than a null
  // user when there is no session, so the error is folded into the same null.
  //
  // Until the sign-in half of TEA-01 exists nothing ever creates a session, so in a real build this
  // returns null on every call and the screen renders `allow-list-refused` for everybody, admin
  // included. 02-design.md section 5, "Prerequisites this ticket does not own".
  async getCurrentMember(): Promise<Member | null> {
    return readCurrentMember();
  },

  /**
   * SOLO, 2026-09-10. Everybody waiting on a decision, newest first. Replaces `listAllowedEmails`.
   *
   * **THE `is` FILTER ON `roster_team_id` IS NOT THE SECURITY BOUNDARY AND MUST NOT BE READ AS ONE.**
   * `member_select_pending_admin` is, and it already says `member_roster_team_id(id) is null and
   * status <> 'approved'` for an admin (MIR-21, ADR-077: both read the roster team, not the column). The filters here narrow a read the policy has already decided — the same
   * relationship every other read in this file has to its own policy.
   *
   * A member receives zero rows rather than an error, which is why an empty list is the honest
   * return and a failure shape would be a lie about what the policy did.
   *
   * THROWS on a transport failure, the shape `listMembers` uses.
   */
  async listPendingMembers(): Promise<Member[]> {
    const { data, error } = await client()
      .from("member")
      .select(MEMBER_COLUMNS)
      .is("roster_team_id", null)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<MemberRow[]>();

    if (error) throw new Error(`listPendingMembers failed: ${error.message}`);
    return (data ?? []).map(toMember);
  },

  /**
   * SOLO, 2026-09-10. Approve or reject one waiting sign-up.
   *
   * **MIR-02, ADR-064 — BOTH HALVES ARE NOW DEFINER FUNCTIONS, AND NEITHER IS A TABLE WRITE.**
   * `20261020120000_mir02_member_self_writes.sql` revokes `update (status, team_id)` from
   * `authenticated`, because that grant plus `member_update_own` let a pending sign-up admit
   * themselves with one PATCH. An approval is `public.admit_member`, a rejection is
   * `public.reject_member`; each tests `is_admin` and that the row is still pending and teamless in
   * its own body, the bound `member_decide_admin`'s `using` clause used to supply.
   *
   * **A 42501 IS THE REFUSAL, WHERE ZERO ROWS USED TO BE.** A definer function raises on `not found`
   * rather than filtering, so `!error` is success — `setRankThroughRpc` records the same change.
   */
  async decideMember(memberId: string, decision: MemberDecision): Promise<Result<void>> {
    // SOLO, 2026-09-11 — an APPROVAL is `public.admit_member`, onto any team the admin chose. It is a
    // `security definer` function for the reason `listTeams` records: the approved row lands on a
    // team the caller may not be able to SELECT, and an UPDATE whose new row fails the SELECT policy
    // under a `.select()` is an error rather than a success. MIR-02: the REJECTION is
    // `public.reject_member` now, for the revoke the doc comment above records.
    if (decision.approve) {
      const { error } = await client().rpc("admit_member", {
        p_member_id: memberId,
        p_team_id: decision.teamId,
      });
      if (error) {
        return {
          ok: false,
          error: toTeamFailure(error, "That sign-up could not be decided. It may already have been."),
        };
      }
      return { ok: true, value: undefined };
    }

    const { error } = await client().rpc("reject_member", { p_member_id: memberId });
    if (error) {
      return {
        ok: false,
        error: toTeamFailure(error, "That sign-up could not be decided. It may already have been."),
      };
    }
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // TEA-03. 02-design.md sections 1.2, 1.4 and 3.
  // -------------------------------------------------------------------------

  // TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8.
  //
  // No team parameter and no `eq` on team_id: `member_select_team` IS the team boundary (INV-07),
  // and a filter here would be a second, weaker copy of it. The two policies on this table are
  // permissive and OR together, so an active caller receives their whole team and a removed caller
  // receives their own row - ADR-018 Consequences, reproduced in mock.ts.
  //
  // NO `removed_at` FILTER. ADR-013 and the INV-04 note require the counting function to be GIVEN
  // the roster carrying `removedAt` per member; filtering here makes INV-04 uncomputable for every
  // past date. MemberList.tsx does the filtering, above the seam, where it is a display decision.
  //
  // Two `order` calls, not one: `FIXTURE_ADMIN` and `FIXTURE_MEMBER` share a `created_at` literal,
  // so created_at alone leaves their order undefined in PostgreSQL (02-design.md section 1.4).
  //
  // SOLO (TEA-09), 2026-09-29 — THE `roster_team_id` NOT-NULL FILTER, AND WHY IT IS NOT A SECOND COPY
  // OF THE TEAM BOUNDARY. "The policies OR together" above has a third party: `member_select_pending_admin`
  // (20260910100000_solo_member_approval.sql) admits every row with no roster team and `status <>
  // 'approved'` to an ADMIN. MIR-21, ADR-077: the filter names the computed field, not the column. Without this filter an admin's roster carried every waiting and every
  // rejected sign-up — drawn in the sidebar as ordinary members, drawn as rows in the year grid, and
  // counted in INV-04's denominator so an admin saw fewer overloaded days than a member did for the
  // same date. The filter only NARROWS: `member_select_team` stays the boundary, and a teamless row
  // is on no team's roster by definition. The mock already behaves this way (`mock.ts`, the
  // `m.teamId === me.teamId` filter); this makes the real seam agree with it.
  async listMembers(): Promise<Member[]> {
    const { data, error } = await client()
      .from("member")
      .select(MEMBER_COLUMNS)
      .not("roster_team_id", "is", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(ROSTER_LIMIT)
      .returns<MemberRow[]>();

    if (error) throw new Error(`listMembers failed: ${error.message}`);

    const rows = data ?? [];

    // AC-8. Under ADR-005 the browser reads PostgREST directly and PostgREST caps rows server-side,
    // so a capped read returns a believable short answer with no error anywhere. The roster is
    // INV-04's denominator, so a roster short by two people raises the ratio on every date and makes
    // days look overloaded that are not. Throwing is what keeps a truncated roster out of every
    // screen and every computation; the caller renders `member-list-unavailable`.
    if (rows.length >= ROSTER_LIMIT) {
      throw new Error(
        `listMembers returned ${rows.length} rows at the ${ROSTER_LIMIT} limit: the roster may be ` +
          `truncated and must not be consumed (TEA-03 AC-8)`,
      );
    }

    return rows.map(toMember);
  },

  // -------------------------------------------------------------------------
  // TEA-04. 01-plan.md sections 4.2 and 6.
  // -------------------------------------------------------------------------

  // TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12.
  //
  // No `eq` on team_id and no role check: `member_update_admin` IS the team boundary and the role
  // boundary (INV-07), and a filter here would be a second, weaker copy of it. What this file does
  // is issue the statement and read the answer honestly.
  //
  // ZERO ROWS BACK IS A REFUSAL. Under row-level security a refused UPDATE is FILTERED rather than
  // errored - it matches no row and PostgREST answers 200 with an empty body - so `!error` is not
  // success and treating it as such would report every policy refusal as a completed removal. The
  // `.select()` exists to make the difference visible.
  //
  // The trigger's four refusals arrive the other way, as `42501`, and become `not_permitted`
  // through `toPostgrestFailure`. There is no FailureCode per reason (01-plan.md section 4.1):
  // demotion, promoting a removed member, undoing a removal and self-removal are all unreachable
  // through the controls MemberList.tsx draws, so a code per reason would be a branch no screen
  // can take.
  //
  // The `removed_at` sent here is NEVER the value stored. An UPDATE must name a value for the
  // column, and the trigger overwrites whatever arrives with `now()` (AC-3) - which is the point:
  // this column is INV-04's denominator and ADR-013's per-date condition, so a client clock has no
  // business in it. It is deliberately not read back into anything either; the returned row carries
  // the datastore's own value.
  async removeMember(memberId: string): Promise<Result<Member>> {
    const { data, error } = await client()
      .from("member")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", memberId)
      .select(MEMBER_COLUMNS)
      .returns<MemberRow[]>();

    if (error) return { ok: false, error: toPostgrestFailure(error) };

    const row = (data ?? [])[0];
    if (!row) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "That member could not be removed." },
      };
    }

    return { ok: true, value: toMember(row) };
  },

  // TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12.
  //
  // One-way, and the one direction is written literally: `role` is set to `admin` and there is no
  // parameter that could carry the other value. That is an affordance and not the check - the
  // trigger refuses a demotion issued by any route, because `role` is granted `update` for exactly
  // this path and the column is therefore writable in the direction that must be refused (AC-5).
  //
  // Zero rows back is a refusal, for the same reason as `removeMember` above.
  // SOLO, 2026-09-10; MIR-02, ADR-064. `public.set_member_team`, not a table update: `team_id` is no
  // longer granted to `authenticated`. The function carries the bound `member_update_admin`s `using`
  // and `with check` used to — the member AND the destination are the caller's own team — so no
  // value sent here can move somebody to a team the caller is not on. It is deliberately NOT
  // `move_member`, which is any team (01-plan.md § 8 alternative B).
  //
  // A 42501 is the refusal; the row guard stops a body of some other shape being read as a member.
  async setMemberTeam(memberId: string, teamId: string): Promise<Result<Member>> {
    // MIR-21-c, ADR-080 decision 1. The column is about to go stale, so `team_id` is the roster
    // team: `MEMBER_COLUMNS` reads it through the computed field over the returned row.
    const { data, error } = await client()
      .rpc("set_member_team", { p_member_id: memberId, p_team_id: teamId })
      .select(MEMBER_COLUMNS)
      .single<MemberRow>();

    if (error) return { ok: false, error: toTeamFailure(error, "That member could not be moved.") };
    if (!isMemberRow(data)) {
      return { ok: false, error: { code: "unknown", message: "That member could not be moved." } };
    }
    return { ok: true, value: toMember(data) };
  },

  // MIR-03, 2026-10-20 — ADR-065 decision 3. Promotion has its own RPC, own team only, and no longer
  // goes through `set_member_role`, which now refuses `admin`. A `42501` is the refusal, the same as
  // the rank write's, so `toRankFailure` maps it with the promotion sentence.
  async promoteMember(memberId: string): Promise<Result<Member>> {
    // MIR-21-c, ADR-080 decision 1. The column is about to go stale, so `team_id` is the roster
    // team: `MEMBER_COLUMNS` reads it through the computed field over the returned row.
    const { data, error } = await client()
      .rpc("promote_member_to_admin", { p_member_id: memberId })
      .select(MEMBER_COLUMNS)
      .single<MemberRow>();

    if (error) return { ok: false, error: toRankFailure(error, MEMBER_PROMOTE_REFUSED) };
    if (!isMemberRow(data)) {
      return { ok: false, error: { code: "unknown", message: MEMBER_PROMOTE_REFUSED } };
    }

    return { ok: true, value: toMember(data) };
  },

  // SOLO 2026-09-12, ADR-035; the write moved off the table on 2026-09-24 by ADR-044.
  // MIR-03, 2026-10-20 — ADR-065: own team only. An `"admin"` argument reaches the function and comes
  // back as a `42501`, which `toRankFailure` maps to `not_permitted` with the rank sentence.
  async setMemberRole(memberId: string, role: MemberRole): Promise<Result<Member>> {
    return setRankThroughRpc(memberId, role, MEMBER_RANK_REFUSED);
  },

  // -------------------------------------------------------------------------
  // SOLO 2026-09-10 — the profile screen's two writes.
  // -------------------------------------------------------------------------

  // **THE UPDATE NAMES TWO COLUMNS AND `.eq("id", …)` NAMES THE CALLER'S OWN ROW.** Both are
  // load-bearing and neither is the control:
  //
  //  - the CONTROL for "which row" is `member_update_own` plus the trigger clause added by
  //    `20260910093000_solo_profile_self_update.sql`, which refuses a `display_name` or `avatar`
  //    change on a row that is not `auth.uid()`'s. It has to be a TRIGGER and not a policy, because
  //    `member_update_admin` already lets an admin update rows across their team and a `with check`
  //    cannot see WHICH columns moved — known weakness 6 in `.ai/standards/rbac-and-security.md`;
  //  - the CONTROL for "which columns" is the column grant. Naming `role`, `status` or `team_id` in
  //    this update would be refused with `42501 permission denied for column` before a policy runs
  //    — true again since MIR-02's revoke; between `20260910100000_solo_member_approval.sql` and
  //    it, `status` and `team_id` were granted and this sentence was false. The MIR-02 trigger
  //    clause refuses the caller's own three columns on every other path too.
  //
  // ZERO ROWS BACK IS A REFUSAL, the trap `removeMember` and `createEntry` both record: a filtered
  // UPDATE returns no representation and PostgREST does not error, so `!error` is not success.
  //
  // The avatar is checked against `AVATAR_CHOICES` BEFORE the request, and again by the
  // `member_avatar_is_offered` check constraint in the migration. Two locks on purpose: the local
  // one produces a sentence beside the picker, and the remote one is what holds for a caller that
  // is not this application.
  async updateOwnProfile(input: UpdateOwnProfileInput): Promise<Result<Member>> {
    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      return {
        ok: false,
        error: { code: "invalid_display_name", message: "Enter a display name." },
      };
    }
    const { data: auth } = await client().auth.getUser();
    if (!auth.user) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "Sign in again to save your profile." },
      };
    }

    // **OR THE ONE THEY ALREADY HAVE.** SOLO, 2026-09-13: the offered set is the files in
    // `public/images/` at build time, so a row can hold a name that is not in it — a file removed
    // from the folder, or `DEFAULT_AVATAR` when the folder has no `1.png`. Without the second clause,
    // everyone holding such a value is refused on every save, including one that only changes their
    // display name. Same rule as `mock.ts`; the migration explains why the column carries no check
    // constraint of its own.
    //
    // THE READ HAPPENS ONLY WHEN THE VALUE IS NOT AN OFFERED ONE, which is the rare path — the
    // picker cannot produce anything else, so the ordinary save costs no extra round trip.
    if (!AVATAR_CHOICES.includes(input.avatar)) {
      const me = await readMember(auth.user.id);
      if (!me || me.avatar !== input.avatar) {
        return {
          ok: false,
          error: { code: "invalid_avatar", message: "Choose one of the avatars offered." },
        };
      }
    }

    const { data, error } = await client()
      .from("member")
      .update({ display_name: displayName, avatar: input.avatar })
      .eq("id", auth.user.id)
      .select(MEMBER_COLUMNS)
      .returns<MemberRow[]>();

    if (error) return { ok: false, error: toPostgrestFailure(error) };

    const row = (data ?? [])[0];
    if (!row) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "Your profile could not be saved." },
      };
    }

    return { ok: true, value: toMember(row) };
  },

  // **IT RE-AUTHENTICATES FIRST, AND THAT IS THE WHOLE OF WHY THIS FUNCTION IS LONGER THAN ONE
  // LINE.** `auth.updateUser({ password })` accepts any live session and verifies NOTHING — the
  // reauthentication flow GoTrue ships (`auth.reauthenticate()`) sends a nonce by email and is a
  // different product decision. So the current password is checked the only way a client can check
  // it: by signing in with it.
  //
  // **`signInWithPassword` ON A SIGNED-IN CLIENT REPLACES THE SESSION WITH AN EQUIVALENT ONE FOR THE
  // SAME USER.** That is why the wrong-password branch below is safe to return from: the failed
  // attempt leaves the existing session untouched, so a member who mistypes their current password
  // is not signed out by the attempt. On success the session is replaced twice — once here and once
  // by `updateUser` — and `onAuthStateChange` fires for both, which `useSession` already re-resolves
  // against.
  //
  // The address comes from `auth.getUser()` and NEVER from a parameter. An email on this input would
  // be a value the caller could vary, which turns a password check into a password oracle for other
  // accounts.
  async changePassword(input: ChangePasswordInput): Promise<Result<void>> {
    const { data: auth } = await client().auth.getUser();
    const email = auth.user?.email;
    if (!email) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "Sign in again before changing your password." },
      };
    }

    const { error: reauth } = await client().auth.signInWithPassword({
      email,
      password: input.currentPassword,
    });

    if (reauth) {
      // MAPPED, not passed through. `toFailure` answers `invalid_credentials` here — the code that
      // means "an address or a password is wrong" on a screen where the address is not in question
      // and cannot be wrong. The caller is already signed in, so naming the field costs nothing and
      // puts the message beside the box that is wrong.
      const failure = toFailure(reauth);
      if (failure.code === "invalid_credentials") {
        return {
          ok: false,
          error: { code: "wrong_password", message: "That is not your current password." },
        };
      }
      return { ok: false, error: failure };
    }

    const { error } = await client().auth.updateUser({ password: input.newPassword });
    if (error) return { ok: false, error: toFailure(error) };
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // TEA-05. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  // TEA-05 AC-7, AC-8, AC-9. Null is a normal answer.
  //
  // An error is folded into the same null, the way `readCurrentMember` folds `auth.getUser()`'s
  // AuthSessionMissingError: every error this call can produce means the stored session is unusable,
  // and an unusable session is one nobody is holding. Reporting it as a session would render a
  // signed-in screen to somebody the datastore will refuse on the next request (AC-8).
  async getSession(): Promise<Session | null> {
    const { data, error } = await client().auth.getSession();
    if (error || !data.session) return null;
    return toSession(data.session);
  },

  // TEA-05 AC-6, AC-7, AC-8.
  //
  // `persistSession` and `autoRefreshToken` are the client's DEFAULTS (verified on disk in
  // @supabase/auth-js@2.112.4 GoTrueClient.js), so AC-7 and AC-8 are behaviour this subscribes to
  // rather than behaviour it builds: the client persists the session across a reload, refreshes the
  // token on its own, and emits with a null session when a refresh finally fails. A timer of our own
  // here would be a SECOND source of truth about whether somebody is signed in.
  //
  // The event is dropped on purpose. It is a Supabase type and would be a datastore vocabulary above
  // the seam; nothing above branches on it, only on whether a session came with it. 01-plan.md
  // section 9 records what to do the day that stops being true.
  onAuthStateChange(listener: (session: Session | null) => void): () => void {
    const { data } = client().auth.onAuthStateChange((_event, session) => {
      listener(session ? toSession(session) : null);
    });
    return () => data.subscription.unsubscribe();
  },

  // TEA-05 AC-1, AC-2, AC-3.
  //
  // ONE message for an unknown address and for a wrong password, and it is one message because
  // GoTrue returns the single code `invalid_credentials` for both — `toFailure` maps it to a
  // sentence that names neither field. Nothing here looks the address up first, so this function
  // cannot become an address-enumeration oracle even by accident (AC-2).
  //
  // No write of any kind, here or anywhere in this ticket: `public.member` has no insert policy and
  // its only writer is the `admit_allow_listed_member` trigger on auth.users, which fires on
  // `email_confirmed_at` and not on sign-in (AC-11).
  async signIn(input: SignInInput): Promise<Result<Session>> {
    const { data, error } = await client().auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) return { ok: false, error: toFailure(error) };
    return { ok: true, value: toSession(data.session) };
  },

  // TEA-05 AC-6. A failure is RETURNED rather than thrown: on a shared machine a sign-out that
  // silently did nothing is the failure this function exists to prevent, so the caller has to be
  // able to see it.
  async signOut(): Promise<Result<void>> {
    const { error } = await client().auth.signOut();
    if (error) return { ok: false, error: toFailure(error) };
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-01. 01-plan.md sections 4.2, 4.3 and 6.
  // -------------------------------------------------------------------------

  // CAL-01 AC-1 ... AC-11.
  //
  // The INSERT names six columns and no more. `status`, `rejection_reason`, `approved_by` and
  // `approved_at` are absent from the insert grant (migration step 10), so naming any of them is
  // refused with `42501 permission denied for column` before a policy runs - AC-11 is held there and
  // not here. `member_id` is absent for the opposite reason: it is REQUIRED by the row and is
  // supplied from the caller's own identity, never from a parameter, so AC-10 has no path through
  // this interface at all and the policy's `with check (member_id = auth.uid())` is the control.
  //
  // AC-9 IS REFUSED BEFORE THE REQUEST IS SENT, and this is the one validation in this file. ADR-011
  // section Consequences records that an inverted pair fails INSIDE the generated column with "range
  // lower bound must be less than or equal to range upper bound" - a database error text where a
  // sentence about dates belongs, and it never reaches the check constraint that would have said so
  // legibly. String comparison is correct for `yyyy-MM-dd` (plan section 4.5) and no Date is
  // constructed anywhere on this path.
  //
  // ZERO ROWS BACK IS A REFUSAL. Under row-level security a refused INSERT that the policy filters
  // returns no representation and PostgREST does not error, so `!error` is not success - the same
  // trap TEA-04's `removeMember` records. `.select()` is what makes the difference visible.
  async createEntry(input: CreateEntryInput): Promise<Result<Entry>> {
    const inverted = invertedRange(input.startDate, input.endDate);
    if (inverted) return { ok: false, error: inverted };

    const me = await readCurrentMember();
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: CREATE_REFUSED } };
    }

    const { data, error } = await client()
      .from("entry")
      .insert({
        member_id: me.id, // INV-07, and the policy re-derives it from auth.uid() and refuses a mismatch
        type: input.type,
        portion: input.portion,
        start_date: input.startDate,
        end_date: input.endDate,
        tentative: input.tentative,
        note: input.note,
      })
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) {
      // SOLO, 2026-09-11. A collision is explained with its dates; every other refusal is unchanged.
      if (error.code === "23P01") return { ok: false, error: await overlapFailure(me.id, input, null) };
      return { ok: false, error: toEntryFailure(error, CREATE_REFUSED) };
    }

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: CREATE_REFUSED } };
    }

    return { ok: true, value: toEntry(row) };
  },

  // CAL-01 AC-1, AC-2, AC-3, AC-5, AC-6, AC-8.
  //
  // The `eq` on `member_id` is an AFFORDANCE and not a control. `entry_select_team` admits the whole
  // team's rows; this narrows to the caller's because that is what the screen shows, and the policy
  // is what stops anybody reading another team's. Deliberately no date filter and no member
  // parameter - the team-wide, range-shaped read is CAL-04's (plan section 4.2).
  //
  // Two `order` calls, not one: two entries can share a `start_date`, so `start_date` alone leaves
  // their order undefined in PostgreSQL and the two implementations would disagree about row order
  // while failing nothing - the flake TEA-03 recorded on the roster read.
  async listOwnEntries(): Promise<Entry[]> {
    const { data: userData, error: userError } = await client().auth.getUser();
    if (userError || !userData.user) return [];

    const { data, error } = await client()
      .from("entry")
      .select(ENTRY_COLUMNS)
      .eq("member_id", userData.user.id)
      .order("start_date", { ascending: false })
      .order("id", { ascending: true })
      .limit(OWN_ENTRY_LIMIT)
      .returns<EntryRow[]>();

    if (error) throw new Error(`listOwnEntries failed: ${error.message}`);

    const rows = data ?? [];

    // The same assertion as `listMembers`, for the same reason: PostgREST caps rows server-side, so
    // a capped read returns a believable short answer with no error anywhere. Here the loss is a
    // member being told an entry they created does not exist, which is worse than an error.
    if (rows.length >= OWN_ENTRY_LIMIT) {
      throw new Error(
        `listOwnEntries returned ${rows.length} rows at the ${OWN_ENTRY_LIMIT} limit: the list may ` +
          `be truncated and must not be consumed`,
      );
    }

    return rows.map(toEntry);
  },

  // -------------------------------------------------------------------------
  // CAL-02. 01-plan.md sections 4.1, 4.2 and 6.
  // -------------------------------------------------------------------------

  // CAL-02 AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12.
  //
  // Six columns and no more, exactly the six the update grant carries (migration step 1).
  // `member_id`, `status` and `rejection_reason` are absent from that grant, so a statement naming
  // one is refused with `42501 permission denied for column` BEFORE any policy runs - AC-8 and AC-10
  // are held there, and `UpdateEntryInput` carrying none of the three is the affordance.
  //
  // NO `eq` ON `member_id` AND NO OWNER CHECK. `entry_update_own` IS the owner boundary, and a
  // filter here would be a second, weaker copy of it - the shape `removeMember` already uses. What
  // this file does is issue the statement and read the answer honestly.
  //
  // ZERO ROWS BACK IS A REFUSAL (AC-9). Under row-level security a refused UPDATE is FILTERED rather
  // than errored: it matches no row and PostgREST answers 200 with an empty body (ADR-016 section 4,
  // behaviour 2), so `!error` is not success. The `.select()` is what makes the difference visible,
  // and it is also what returns the row the TRIGGER rewrote - AC-5's reset and AC-12's `updated_at`
  // are read back from the datastore rather than assumed here.
  //
  // NOTHING BELOW IMPLEMENTS INV-02. `entry_enforce_decision()` decides whether an edit is
  // substantive by comparing OLD against NEW, and it is the only judge of that (01-plan.md section
  // 8). A note-only edit sends the same six columns as any other and the trigger is what makes AC-6
  // differ from AC-5.
  async updateEntry(entryId: string, input: UpdateEntryInput): Promise<Result<Entry>> {
    const inverted = invertedRange(input.startDate, input.endDate);
    if (inverted) return { ok: false, error: inverted };

    const { data, error } = await client()
      .from("entry")
      .update({
        type: input.type,
        portion: input.portion,
        start_date: input.startDate,
        end_date: input.endDate,
        tentative: input.tentative,
        note: input.note,
      })
      .eq("id", entryId)
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) {
      // SOLO, 2026-09-11. `null` owner: the edited row's owner is read inside, because under CAL-03
      // the caller may be an admin editing somebody else's entry.
      if (error.code === "23P01") return { ok: false, error: await overlapFailure(null, input, entryId) };
      return { ok: false, error: toEntryFailure(error, UPDATE_REFUSED) };
    }

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: UPDATE_REFUSED } };
    }

    return { ok: true, value: toEntry(row) };
  },

  // CAL-02 AC-3, AC-4, AC-9. A HARD delete: `entry` carries no soft-delete column, so the row and
  // its `approved_by` disappear together, and INV-01's constraint releases the slots the row held -
  // which is AC-4 and is the half a test written only from the happy path would miss.
  //
  // THE `.select()` IS THE WHOLE CORRECTNESS OF THIS FUNCTION. A DELETE the policy filters answers
  // 200 with an empty body exactly as an UPDATE does, and a delete has no obvious return value to
  // inspect - so without asking for the deleted representation and counting it, every refusal would
  // be reported as a completed delete. Zero rows is `entry_not_permitted` (AC-9).
  async deleteEntry(entryId: string): Promise<Result<void>> {
    const { data, error } = await client()
      .from("entry")
      .delete()
      .eq("id", entryId)
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) return { ok: false, error: toEntryFailure(error, DELETE_REFUSED) };

    if (!(data ?? [])[0]) {
      return { ok: false, error: { code: "entry_not_permitted", message: DELETE_REFUSED } };
    }

    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-03. 01-plan.md sections 4.1 and 5.
  //
  // `updateEntry` and `deleteEntry` above are UNCHANGED by this ticket — not one character. They
  // issue the statement and count the rows the datastore let through; `entry_update_admin` and
  // `entry_delete_admin` widen what those same statements reach. That is ADR-005 working as
  // designed, and it is the evidence that CAL-02 put the check in the datastore rather than here.
  // -------------------------------------------------------------------------

  // CAL-03 AC-1, AC-2, AC-3, AC-4, AC-9, AC-10, AC-12.
  //
  // NO FILTER OF ANY KIND, and that is the difference from `listOwnEntries`. That function narrows
  // to `member_id = auth.uid()` as an AFFORDANCE, because the own-entry screen shows only the
  // caller's rows; `entry_select_team` was always what stopped anybody reading another team's. Here
  // the screen shows the whole team, so there is nothing to narrow and the policy is the only scope.
  // A `member_team_id` filter written here would be a second, weaker copy of the policy.
  //
  // NO `is_admin` CHECK. `Read any entry in the team` is checked for BOTH roles in
  // rbac-and-security.md, so this read is not where the admin capability lives — TeamEntries.tsx
  // refuses a non-admin as an affordance, and `entry_update_admin` is the control.
  //
  // Two `order` calls, not one, for the reason `listOwnEntries` and `listMembers` both record: two
  // entries can share a `start_date`, so `start_date` alone leaves their order undefined in
  // PostgreSQL and the two implementations would disagree about row order while failing nothing.
  // Across a whole team, shared start dates are the normal case rather than the edge one.
  async listTeamEntries(): Promise<Entry[]> {
    const { data, error } = await client()
      .from("entry")
      .select(ENTRY_COLUMNS)
      .order("start_date", { ascending: false })
      .order("id", { ascending: true })
      .limit(TEAM_ENTRY_LIMIT)
      .returns<EntryRow[]>();

    if (error) throw new Error(`listTeamEntries failed: ${error.message}`);

    const rows = data ?? [];

    // The same assertion as `listOwnEntries` and `listMembers`, and here the loss is the worst of
    // the three: a truncated read hides an entry from the one person able to correct it, and it
    // hides it silently — PostgREST caps rows server-side and answers a believable short list with
    // no error anywhere.
    if (rows.length >= TEAM_ENTRY_LIMIT) {
      throw new Error(
        `listTeamEntries returned ${rows.length} rows at the ${TEAM_ENTRY_LIMIT} limit: the list ` +
          `may be truncated and must not be consumed`,
      );
    }

    return rows.map(toEntry);
  },

  // -------------------------------------------------------------------------
  // CAL-04. 01-plan.md sections 4, 5 and 6.
  //
  // NEITHER FUNCTION COUNTS ANYTHING. `absenceCountsFor` in ./absence.ts is INV-04's single
  // implementation and this file does not import it: with zero copies of the arithmetic in the seam
  // there is nothing for tests/seam-parity.test.ts to miss. 01-plan.md section 8 rejects computing
  // the count as a view or an RPC for a reason that is not style — CAL-07 must count a day a DRAFT
  // would produce, an unsaved entry has no row, and a datastore-side aggregate could therefore never
  // be the only implementation.
  // -------------------------------------------------------------------------

  // CAL-04 AC-7, AC-14.
  //
  // NO `.eq()` AND NO TEAM PARAMETER. `team_select_own` — shipped by this ticket's migration — is
  // what narrows the table to `id = member_team_id(auth.uid())`, and a filter written here would be
  // a second, weaker copy of the policy. Before that migration is applied this read answers zero
  // rows to everybody, because `public.team` carries no grant and no policy at all
  // (`supabase/migrations/20260904100000_cal04_team_select.sql`).
  //
  // `maybeSingle` and not `single`: zero rows is the answer for a caller with no member row, for a
  // removed one, and for a build where the migration has not been applied. All three are the
  // NotOnATeam shape rather than an error, which is what `getCurrentMember` already returns null
  // for. More than one row would be a broken policy and `maybeSingle` reports it as an error rather
  // than silently picking one, which is the behaviour worth having.
  async getTeam(): Promise<Team | null> {
    const { data, error } = await client()
      .from("team")
      .select(TEAM_COLUMNS)
      .maybeSingle<TeamRow>();

    if (error) throw new Error(`getTeam failed: ${error.message}`);
    return data ? toTeam(data) : null;
  },

  // -------------------------------------------------------------------------
  // ADM-01. 01-plan.md sections 4.1, 4.2 and 6.
  // -------------------------------------------------------------------------

  // ADM-01 AC-2, AC-5, AC-9, AC-12, AC-14.
  //
  // NO `.eq("id", …)`. `team_update_admin`'s `using` clause resolves the row from the caller, and a
  // client-supplied id would be the parameter section 4.1 refuses. This matches `getTeam()` above,
  // which issues no filter either.
  //
  // `.not("id", "is", null)` IS NOT A FILTER, IT IS A `WHERE`. The hosted datastore runs
  // pg_safeupdate, which refuses a bare UPDATE with `21000 UPDATE requires a WHERE clause`. The
  // clause is true for every row, so the policy still does all the narrowing and no id is sent.
  //
  // ONE COLUMN IN THE UPDATE, and it is the only one the grant admits. `name`, `id` and
  // `created_at` are withheld by `grant update (overload_threshold)` in
  // 20260905000000_adm01_team_threshold.sql, so a field added here would be refused with `42501
  // permission denied for column` before any policy ran (AC-9).
  //
  // ZERO ROWS BACK IS A REFUSAL. Under row-level security a refused UPDATE is FILTERED rather than
  // errored - it matches no row and PostgREST answers 200 with an empty body - so `!error` is not
  // success and treating it as such would report a member's refused write as a saved threshold
  // (AC-5). The same trap `removeMember` and `promoteMember` above record; `.select()` is what makes
  // the difference visible.
  //
  // `.returns<TeamRow[]>()` AND NOT `.maybeSingle()`. On zero rows `maybeSingle()` gives
  // `data: null` with no error, which is indistinguishable from a successful update of a row that no
  // longer exists. `promoteMember` uses the array form for exactly this reason and is the shape
  // copied here.
  //
  // `[0, 100]` IN WHOLE PERCENTAGE POINTS IS STILL THE SCREEN'S (AC-7, AC-8). MIR-09, ADR-069: the
  // datastore now carries `team_overload_threshold_range`, checking `[0, 1]` as a fraction, and this
  // paragraph used to end "and there is no `check` constraint behind this" — no longer true. The
  // guard below restates the same fraction before sending, and the mapping after the write catches a
  // 23514 reaching this function some other way.
  async setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>> {
    if (!isValidThreshold(input.overloadThreshold)) {
      return { ok: false, error: { code: "invalid_threshold", message: INVALID_THRESHOLD_MESSAGE } };
    }

    const { data, error } = await client()
      .from("team")
      .update({ overload_threshold: input.overloadThreshold })
      .not("id", "is", null)
      .select(TEAM_COLUMNS)
      .returns<TeamRow[]>();

    if (error) {
      if (error.code === "23514") {
        return { ok: false, error: { code: "invalid_threshold", message: INVALID_THRESHOLD_MESSAGE } };
      }
      return { ok: false, error: toPostgrestFailure(error) };
    }

    const row = (data ?? [])[0];
    if (!row) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "Could not save the threshold." },
      };
    }

    return { ok: true, value: toTeam(row) };
  },

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-11 — many teams. Seven `.rpc()` calls, one per function in
  // `20260911180000_solo_many_teams.sql`.
  //
  // **FUNCTIONS AND NOT TABLE BUILDERS, AND THAT IS THE MIGRATION'S ARGUMENT RATHER THAN A STYLE.**
  // A cross-team write through `.from("team")` needs the caller to SELECT the other team's row, and
  // letting an admin SELECT every row would silently turn `getTeam()` into a multi-row error and
  // `listMembers()` into every team's roster. The functions check `is_admin` in their own bodies and
  // change no read anybody else makes. `rejectEntries` below was this file's first `.rpc()`; these
  // follow its shape.
  //
  // THE PARAMETER NAMES ARE THE FUNCTIONS' — PostgREST matches RPC arguments by name, so a rename
  // here is a 404 at runtime and not a type error.
  // -------------------------------------------------------------------------

  // THROWS on a possibly-truncated answer, the rule `listMembers` states: a short list of teams would
  // hide a team from the one screen that manages them. `ROSTER_LIMIT` is reused rather than a new
  // constant — there cannot usefully be more teams than there are people to put on them.
  async listTeams(): Promise<Team[]> {
    const { data, error } = await client().rpc("list_teams").limit(ROSTER_LIMIT);
    if (error) throw new Error(`listTeams failed: ${error.message}`);
    if (!Array.isArray(data)) throw new Error("listTeams received a body that is not a list");
    if (data.length >= ROSTER_LIMIT) {
      throw new Error(
        `listTeams returned ${data.length} rows at the ${ROSTER_LIMIT} limit: the list may be ` +
          `truncated and must not be consumed`,
      );
    }
    return (data as TeamRow[]).map(toTeam);
  },

  // Every team's roster in one read. `listMembers` is untouched and stays the caller's own team.
  async listAllMembers(): Promise<Member[]> {
    // MIR-21: `.select(MEMBER_COLUMNS)`, the shape `listMembersForTeam` uses, so `team_id` is the
    // computed field rather than the column `setof public.member` would otherwise return.
    const { data, error } = await client()
      .rpc("list_all_members")
      .select(MEMBER_COLUMNS)
      .limit(ROSTER_LIMIT);
    if (error) throw new Error(`listAllMembers failed: ${error.message}`);
    if (!Array.isArray(data)) throw new Error("listAllMembers received a body that is not a list");
    if (data.length >= ROSTER_LIMIT) {
      throw new Error(
        `listAllMembers returned ${data.length} rows at the ${ROSTER_LIMIT} limit: the roster may ` +
          `be truncated and must not be consumed`,
      );
    }
    return (data as MemberRow[]).map(toMember);
  },

  // -------------------------------------------------------------------------
  // CAL-11 — the read half of a two-row split (ADR-039, ADR-040). 01-plan.md section 4.3. Three
  // more `.rpc()` calls, the shape SOLO's own-team twins above already use: each names ITS
  // function, and `is_admin` is tested inside that function's body rather than here — this file
  // issues the request and maps rows, exactly as `listAllMembers` does above.
  // -------------------------------------------------------------------------

  // The cross-team twin of `listMembers`. Same columns, same order, same truncation refusal;
  // `ROSTER_LIMIT` is reused for the reason `listTeams` reuses it above — one cap on "how many
  // people can this read believably return".
  async listMembersForTeam(teamId: string): Promise<Member[]> {
    const { data, error } = await client()
      .rpc("list_members_for_team", { p_team_id: teamId })
      .select(MEMBER_COLUMNS)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(ROSTER_LIMIT)
      .returns<MemberRow[]>();

    if (error) throw new Error(`listMembersForTeam failed: ${error.message}`);
    if (!Array.isArray(data)) {
      throw new Error("listMembersForTeam received a body that is not a list");
    }
    if (data.length >= ROSTER_LIMIT) {
      throw new Error(
        `listMembersForTeam returned ${data.length} rows at the ${ROSTER_LIMIT} limit: the roster ` +
          `may be truncated and must not be consumed`,
      );
    }
    return data.map(toMember);
  },

  // The cross-team twin of `listTeamEntries`. Same columns, same order, same truncation refusal.
  async listTeamEntriesForTeam(teamId: string): Promise<Entry[]> {
    const { data, error } = await client()
      .rpc("list_team_entries_for_team", { p_team_id: teamId })
      .select(ENTRY_COLUMNS)
      .order("start_date", { ascending: false })
      .order("id", { ascending: true })
      .limit(TEAM_ENTRY_LIMIT)
      .returns<EntryRow[]>();

    if (error) throw new Error(`listTeamEntriesForTeam failed: ${error.message}`);
    if (!Array.isArray(data)) {
      throw new Error("listTeamEntriesForTeam received a body that is not a list");
    }
    if (data.length >= TEAM_ENTRY_LIMIT) {
      throw new Error(
        `listTeamEntriesForTeam returned ${data.length} rows at the ${TEAM_ENTRY_LIMIT} limit: the ` +
          `list may be truncated and must not be consumed`,
      );
    }
    return data.map(toEntry);
  },

  // The cross-team twin of `listTeamEntriesOverlapping` — the same page-and-assemble loop
  // (CAL-09), with the request replaced by an RPC call carrying the team and the range as
  // arguments rather than a table filter. NO `.filter("date_range", ...)`: the range is the
  // function's own argument, matched server-side by `daterange(p_start, p_end, '[]')`.
  async listTeamEntriesOverlappingForTeam(teamId: string, range: DateRange): Promise<Entry[]> {
    const assembled: EntryRow[] = [];
    const seen = new Set<string>();
    let matching: number | null = null;

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      const from = assembled.length;
      const to = from + TEAM_ENTRY_PAGE_SIZE - 1;

      const { data, error, count } = await client()
        .rpc(
          "list_team_entries_overlapping_for_team",
          { p_team_id: teamId, p_start: range.start, p_end: range.end },
          { count: "exact" },
        )
        .select(ENTRY_COLUMNS)
        .order("start_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
        .returns<EntryRow[]>();

      if (error) throw new Error(`listTeamEntriesOverlappingForTeam failed: ${error.message}`);

      if (count === null || count === undefined) {
        throw new Error(
          "listTeamEntriesOverlappingForTeam got no exact count: completeness must never be " +
            "derived from the number of rows received",
        );
      }

      if (matching === null) matching = count;

      const rows = data ?? [];

      for (const row of rows) {
        if (seen.has(row.id)) {
          throw new Error(
            `listTeamEntriesOverlappingForTeam received entry ${row.id} twice across pages: the ` +
              `result is not a set and must not be counted`,
          );
        }
        seen.add(row.id);
        assembled.push(row);
      }

      if (assembled.length >= matching) break;
      if (rows.length === 0) break; // no progress; the comparison below is the refusal
    }

    if (matching === null || assembled.length !== matching) {
      throw new Error(
        `listTeamEntriesOverlappingForTeam assembled ${assembled.length} rows while ` +
          `${matching ?? "no"} match: the range may be incomplete and must not be counted`,
      );
    }

    return assembled.map(toEntry);
  },

  // The empty name is refused BEFORE the round trip, as `createEntry` refuses an inverted range; the
  // function's own 22023 is the second lock.
  async createTeam(input: CreateTeamInput): Promise<Result<Team>> {
    const name = input.name.trim();
    if (name === "") {
      return { ok: false, error: { code: "empty_team_name", message: EMPTY_TEAM_NAME } };
    }

    const { data, error } = await client().rpc("create_team", { p_name: name });
    if (error) return { ok: false, error: toTeamFailure(error, TEAM_CREATE_REFUSED) };
    if (!isTeamRow(data)) {
      return { ok: false, error: { code: "unknown", message: TEAM_CREATE_REFUSED } };
    }
    return { ok: true, value: toTeam(data) };
  },

  async renameTeam(teamId: string, input: RenameTeamInput): Promise<Result<Team>> {
    const name = input.name.trim();
    if (name === "") {
      return { ok: false, error: { code: "empty_team_name", message: EMPTY_TEAM_NAME } };
    }

    const { data, error } = await client().rpc("rename_team", { p_team_id: teamId, p_name: name });
    if (error) return { ok: false, error: toTeamFailure(error, TEAM_RENAME_REFUSED) };
    if (!isTeamRow(data)) {
      return { ok: false, error: { code: "unknown", message: TEAM_RENAME_REFUSED } };
    }
    return { ok: true, value: toTeam(data) };
  },

  // A function returning `void` answers with no body; success is the absence of an error. The
  // "no such team" and "not an admin" cases both arrive as 42501 and are one sentence on purpose.
  async deleteTeam(teamId: string): Promise<Result<void>> {
    const { error } = await client().rpc("delete_team", { p_team_id: teamId });
    if (error) return { ok: false, error: toTeamFailure(error, TEAM_DELETE_REFUSED) };
    return { ok: true, value: undefined };
  },

  async moveMember(memberId: string, teamId: string): Promise<Result<void>> {
    const { error } = await client().rpc("move_member", {
      p_member_id: memberId,
      p_team_id: teamId,
    });
    if (error) return { ok: false, error: toTeamFailure(error, MEMBER_MOVE_REFUSED) };
    return { ok: true, value: undefined };
  },

  // SOLO, 2026-09-11. The same statement shape as `setOverloadThreshold` and `renameTeam` above, two
  // columns over, and for the same reasons: NO `.eq("id", …)` because `team_update_admin` does the
  // narrowing, and ZERO ROWS BACK IS A REFUSAL because a refused UPDATE under row-level security is
  // filtered rather than errored.
  //
  // **BOTH COLUMNS IN ONE UPDATE, ALWAYS.** The screen saves the pair with one press, and two
  // statements would open a window in which a failure between them leaves one switch moved and the
  // other not — a setting nobody chose.
  async setApprovalSettings(input: SetApprovalSettingsInput): Promise<Result<Team>> {
    const { data, error } = await client()
      .from("team")
      .update({ wfh_need_approve: input.wfhNeedApprove, pto_need_approve: input.ptoNeedApprove })
      .not("id", "is", null)
      .select(TEAM_COLUMNS)
      .returns<TeamRow[]>();

    if (error) return { ok: false, error: toPostgrestFailure(error) };

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "not_permitted", message: APPROVAL_SETTINGS_REFUSED } };
    }

    return { ok: true, value: toTeam(row) };
  },

  // CAL-04 AC-1 to AC-6, AC-11, AC-12.
  //
  // `date_range=ov.[start,end]` IS THE WHOLE READ, and the column it filters is the one ADR-011
  // created for exactly this. `ov` is PostgREST's range-overlap operator, so an entry running
  // 2026-03-28 to 2026-04-02 comes back for April — OVERLAP, not containment, which AC-2 needs
  // because it draws that member's avatar on 1 and 2 April.
  //
  // THE LITERAL IS `[start,end]`, INCLUSIVE AT BOTH ENDS, matching `Entry.endDate` and ADR-011's own
  // `'[]'` constructor. A `[start,end)` here would drop every entry that only touches the last day
  // of the month, on every month, in the direction nobody checks. `date_range` itself is stored
  // canonicalised to `[)` and that is invisible to this filter: PostgreSQL canonicalises both sides
  // before comparing, so the two agree.
  //
  // `date_range` IS STILL NOT SELECTED and still absent from `EntryRow`. It is a filter here and
  // nothing more — surfacing it would put a PostgreSQL range literal one destructuring away from a
  // component, where ADR-011's canonicalisation footgun reads as "the entry ends the following day".
  //
  // NO `status` FILTER. Rejected rows come back and `absenceCountsFor` excludes them (AC-4); a
  // filter here would be a second copy of INV-04's rule outside the one function that owns it.
  //
  // Two `order` calls for the reason every other list read here records: across a whole team, two
  // entries sharing a `start_date` is the normal case rather than the edge one, and `start_date`
  // alone leaves their order undefined in PostgreSQL. ASCENDING, unlike the three reads above: this
  // one feeds a grid that reads left to right through the month rather than a list that shows the
  // newest first.
  //
  // CAL-09 REPLACED THE CEILING WITH AN ASSEMBLY. The `.limit(MONTH_ENTRY_LIMIT)` and the
  // `rows.length >= MONTH_ENTRY_LIMIT` raise that stood here until 2026-09-08 were CORRECT and are
  // gone: a correct refusal is not a calendar, and a team above the cap lost the year view outright
  // for the rest of the year. What replaces them is strictly stronger — the read requests windows and
  // compares what it assembled against the datastore's own exact count, which detects a shortened
  // window, a skipped row and an exhausted bound alike WITHOUT KNOWING the cap's value. CAL-09 AC-1
  // to AC-8; the ADM-04 precedent for `count: "exact"` with `.range()` is at `listPendingEntries`
  // below.
  async listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]> {
    const assembled: EntryRow[] = [];
    const seen = new Set<string>();
    let matching: number | null = null;

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      // THE OFFSET IS THE NUMBER OF ROWS IN HAND, not `request * TEAM_ENTRY_PAGE_SIZE`. A page
      // shortened by a lowered cap then costs another request rather than opening a gap the
      // completeness check would only report after the rows were already lost.
      const from = assembled.length;
      const to = from + TEAM_ENTRY_PAGE_SIZE - 1;

      const { data, error, count } = await client()
        .from("entry")
        .select(ENTRY_COLUMNS, { count: "exact" })
        .filter("date_range", "ov", `[${range.start},${range.end}]`)
        .order("start_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
        .returns<EntryRow[]>();

      if (error) throw new Error(`listTeamEntriesOverlapping failed: ${error.message}`);

      // AC-7. The count is asked for explicitly, so a null one means the datastore did not answer
      // the half completeness is decided on. Falling back to `rows.length` would report a page as
      // the whole year — the silent short calendar BUG-002 closed, arriving by a new route.
      if (count === null || count === undefined) {
        throw new Error(
          "listTeamEntriesOverlapping got no exact count: completeness must never be derived from " +
            "the number of rows received (CAL-09 AC-7)",
        );
      }

      // The FIRST count is the target. Later counts are read and ignored: a count that grew means a
      // concurrent write, which is not by itself a loss, and refusing on it would fail the year view
      // whenever anybody created an entry. What a concurrent write can actually DO to an offset walk
      // is caught below — a skipped row by the length comparison, a repeated row by `seen`.
      if (matching === null) matching = count;

      const rows = data ?? [];

      // AC-6. Offset paging is not atomic: a row inserted ahead of the cursor shifts the window and
      // returns a row already held. Summed twice it inflates a day's absence count, which is INV-04
      // wrong in the loud direction rather than the silent one — still wrong.
      for (const row of rows) {
        if (seen.has(row.id)) {
          throw new Error(
            `listTeamEntriesOverlapping received entry ${row.id} twice across pages: the result is ` +
              `not a set and must not be counted (CAL-09 AC-6)`,
          );
        }
        seen.add(row.id);
        assembled.push(row);
      }

      if (assembled.length >= matching) break;
      if (rows.length === 0) break; // no progress; the comparison below is the refusal
    }

    // AC-1, AC-5, AC-8. THE ONE REFUSAL SITE, and it is strictly stronger than the ceiling it
    // replaces: it detects a shortened window, a skipped row and an exhausted bound alike, without
    // knowing the datastore's cap. Reached with `matching` non-null — the loop bound is at least 2
    // (AC-13), so the body runs and either assigns it or throws.
    if (matching === null || assembled.length !== matching) {
      throw new Error(
        `listTeamEntriesOverlapping assembled ${assembled.length} rows while ${matching ?? "no"} ` +
          `match: the range may be incomplete and must not be counted (CAL-09 AC-5)`,
      );
    }

    return assembled.map(toEntry);
  },

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-11. The busy day.
  // -------------------------------------------------------------------------

  // **A PLAIN TWO-SIDED FILTER ON A SCALAR COLUMN**, the shape `listHolidays` uses — and this is
  // where ADR-011's `date_range=ov.` pattern deliberately does NOT transfer. An entry SPANS a range
  // and needed a generated column because PostgREST filters columns rather than expressions; a busy
  // day IS one date, served by the btree index `unique (member_id, date)` already builds. Copying
  // that shape would be cost with no property bought — ADR-015 § 6's reasoning for holidays.
  //
  // **NO `.eq("team_id", …)`, AND THAT IS NOT THE HOLIDAY REASON.** `busy_day` has no `team_id`
  // column, but unlike `holiday` it IS team-scoped: `busy_day_select_team` joins through
  // `member_team_id`, so the policy narrows the read and a filter here would be a second, weaker
  // copy of it. Every other team-scoped read in this file says the same.
  //
  // **IT PAGES AND ASSEMBLES**, CAL-09's shape and for CAL-09's reason: a short read here does not
  // error, it draws a quieter day than the team really has. The completeness check compares what was
  // assembled against the datastore's own exact count, which detects a shortened window, a skipped
  // row and an exhausted bound alike WITHOUT knowing the cap's value.
  async listTeamBusyDaysOverlapping(range: DateRange): Promise<BusyDay[]> {
    const assembled: BusyDayRow[] = [];
    const seen = new Set<string>();
    let matching: number | null = null;

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      // THE OFFSET IS THE NUMBER OF ROWS IN HAND, not `request * TEAM_ENTRY_PAGE_SIZE` — a page
      // shortened by a lowered cap then costs another request rather than opening a gap.
      const from = assembled.length;
      const to = from + TEAM_ENTRY_PAGE_SIZE - 1;

      const { data, error, count } = await client()
        .from("busy_day")
        .select(BUSY_DAY_COLUMNS, { count: "exact" })
        .gte("date", range.start)
        .lte("date", range.end)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
        .returns<BusyDayRow[]>();

      if (error) throw new Error(`listTeamBusyDaysOverlapping failed: ${error.message}`);

      // The count is asked for explicitly, so a null one means the datastore did not answer the half
      // completeness is decided on. Falling back to `rows.length` would report a page as the whole
      // range — the silent short calendar, arriving by a new route.
      if (count === null || count === undefined) {
        throw new Error(
          "listTeamBusyDaysOverlapping got no exact count: completeness must never be derived " +
            "from the number of rows received",
        );
      }

      // The FIRST count is the target. Later counts are read and ignored: a count that grew means a
      // concurrent write, and refusing on it would fail the week view whenever anybody pressed the
      // control. What an offset walk can actually LOSE is caught below.
      if (matching === null) matching = count;

      const rows = data ?? [];

      for (const row of rows) {
        if (seen.has(row.id)) {
          throw new Error(
            `listTeamBusyDaysOverlapping received busy day ${row.id} twice across pages: the ` +
              `result is not a set and must not be counted`,
          );
        }
        seen.add(row.id);
        assembled.push(row);
      }

      if (assembled.length >= matching) break;
      if (rows.length === 0) break; // no progress; the comparison below is the refusal
    }

    if (matching === null || assembled.length !== matching) {
      throw new Error(
        `listTeamBusyDaysOverlapping assembled ${assembled.length} rows while ` +
          `${matching ?? "no"} match: the range may be incomplete and must not be counted`,
      );
    }

    return assembled.map(toBusyDay);
  },

  // **AN UPSERT AND A DELETE, AND NEITHER NEEDS TO READ FIRST.**
  //
  // The MARK is `upsert` on `(member_id, date)`, which is what makes a double press succeed rather
  // than raising the 23505 the unique constraint would otherwise return. `member_id` is NOT sent:
  // the column default is `auth.uid()` and `busy_day_insert_own`s `with check` compares against it,
  // so a caller cannot name somebody else's row — the shape `createEntry` records for `entry`.
  //
  // The UNMARK is `delete().eq("date", …)`, with NO member filter, and that is the policy doing the
  // narrowing rather than a second copy of it here: `busy_day_delete_own` admits only
  // `member_id = auth.uid()`, so this statement cannot reach another person's row even though it
  // names no member.
  //
  // **ZERO ROWS BACK IS NOT A REFUSAL HERE, WHICH IS THE OPPOSITE OF `updateHoliday`.** Under
  // row-level security a refused DELETE is FILTERED and matches no row — indistinguishable from
  // there having been nothing to delete. For a toggle those two ARE the same outcome: the day is not
  // marked, the next read says so, and reporting "nothing happened" as a failure would put an error
  // on screen for a press that left the world in exactly the state the person asked for. The insert
  // path is where a real refusal is observable, and it errors.
  async setOwnBusyDay(input: SetOwnBusyDayInput): Promise<Result<void>> {
    if (input.busy) {
      const { error } = await client()
        .from("busy_day")
        .upsert({ date: input.date }, { onConflict: "member_id,date", ignoreDuplicates: true });

      if (error) return { ok: false, error: { code: "busy_not_permitted", message: BUSY_DAY_REFUSED } };
      return { ok: true, value: undefined };
    }

    const { error } = await client().from("busy_day").delete().eq("date", input.date);

    if (error) return { ok: false, error: { code: "busy_not_permitted", message: BUSY_DAY_REFUSED } };
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // ADM-02. 01-plan.md sections 4.2, 4.3 and 6.
  // -------------------------------------------------------------------------

  // ADM-02 AC-1, AC-2, AC-4, AC-12.
  //
  // A PLAIN TWO-SIDED FILTER ON A SCALAR COLUMN and nothing more — ADR-011's `date_range=ov.` shape
  // deliberately does NOT transfer here. `entry` needed a generated column and `btree_gist` because
  // an entry SPANS a range; `holiday.date` is a scalar served by the btree index `unique (date)`
  // already builds, so copying that shape would be cost with no property bought (ADR-015 section 6).
  //
  // `gte`/`lte`, INCLUSIVE AT BOTH ENDS, matching `DateRange` everywhere else on this seam.
  //
  // NO TEAM FILTER, and this is the one read in this file where that is correct rather than a gap.
  // MIR-15-e, ADR-079 decision 3 — this comment used to say `holiday_select_all` is `using (true)`,
  // which stopped being true at MIR-15-b: the policy is now `holiday_select_own_org`, scoping every
  // caller to their own org's rows rather than every row. There is still no `.eq("team_id", …)`
  // here because `holiday` has no team column (ADR-015 section 1) and never did; the org scope is
  // the policy's `using` clause and not a filter this function adds.
  //
  // ORDER FIXED ABOVE THE DATASTORE, in both implementations, for the reason
  // src/lib/data/absence.ts already records: tests/seam-parity.test.ts compares names and arity and
  // not row order, so two implementations returning rows in different orders is a divergence it
  // cannot see (AC-4). One `order` call and no tiebreaker is enough here and on no other read in
  // this file — `unique (date)` makes the sort key single-valued, which is the same constraint AC-5
  // turns on.
  async listHolidays(range: DateRange): Promise<Holiday[]> {
    const { data, error } = await client()
      .from("holiday")
      .select(HOLIDAY_COLUMNS)
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: true })
      .limit(HOLIDAY_LIMIT)
      .returns<HolidayRow[]>();

    if (error) throw new Error(`listHolidays failed: ${error.message}`);

    const rows = data ?? [];

    // AC-12, and it is the assertion `listMembers` already carries with this table's own sentence.
    // A short calendar is not a short list, it is a WRONG WORKING CALENDAR: a dropped `non_working`
    // row renders a holiday as an ordinary working day and a dropped `working` row renders a
    // mandated Saturday as an inert weekend — two opposite errors from one cause. And the error is
    // non-local: a dropped Thursday row moves FRIDAY's bridge highlight, so nobody looking at the
    // wrong day suspects the missing one.
    if (rows.length >= HOLIDAY_LIMIT) {
      throw new Error(
        `listHolidays returned ${rows.length} rows at the ${HOLIDAY_LIMIT} limit: the calendar may ` +
          `be truncated and must not be consumed (ADM-02 AC-12)`,
      );
    }

    return rows.map(toHoliday);
  },

  // -------------------------------------------------------------------------
  // ADM-03. 01-plan.md sections 4.2, 4.3 and 6.
  //
  // `listHolidays` above is UNCHANGED by this ticket — not one character. The three functions below
  // issue statements the datastore was refusing everybody until this branch's migration; that is
  // ADR-005 working as designed, and it is the evidence that ADM-02 put the denial in the datastore
  // rather than in the absence of a function here.
  //
  // NO `.eq("team_id", …)` ON ANY OF THE THREE, and unlike everywhere else in this file that is
  // correct rather than a gap: `holiday` has no `team_id` (ADR-015 section 1) and the three policies
  // carry no team conjunct either.
  // -------------------------------------------------------------------------

  // ADM-03 AC-1, AC-2, AC-6, AC-15, AC-16.
  //
  // `.single()`, AND IT IS THE ONLY ONE OF THE THREE THAT MAY USE IT. A refused INSERT is REFUSED
  // rather than filtered — `holiday_insert_admin`'s `with check` raises `42501 new row violates
  // row-level security policy` — so there is no silent zero-row case to count here, and a refusal
  // arrives as an error. The two below cannot use it and say why.
  //
  // THREE COLUMNS AND NO MORE. The grant behind this is table-wide (01-plan.md Open question 1), so
  // unlike CAL-01's insert and ADM-01's update nothing one layer down would refuse a fourth — the
  // object literal here and `AddHolidayInput` are what withhold `id` and `created_at`.
  async addHoliday(input: AddHolidayInput): Promise<Result<Holiday>> {
    const { data, error } = await client()
      .from("holiday")
      .insert({ date: input.date, name: input.name, kind: input.kind })
      .select(HOLIDAY_COLUMNS)
      .single<HolidayRow>();

    if (error) return { ok: false, error: toHolidayFailure(error, HOLIDAY_ADD_REFUSED) };
    if (!data) {
      return { ok: false, error: { code: "not_permitted", message: HOLIDAY_ADD_REFUSED } };
    }

    return { ok: true, value: toHoliday(data) };
  },

  // ADM-03 AC-7, AC-8, AC-10, AC-15, AC-16.
  //
  // ZERO ROWS BACK IS A REFUSAL (AC-15). Under row-level security a refused UPDATE is FILTERED
  // rather than errored: it matches no row and PostgREST answers 200 with an empty body, so
  // `!error` is not success — the trap `updateEntry`, `promoteMember` and `setOverloadThreshold` all
  // record. `.select()` is what makes the difference visible.
  //
  // `.returns<HolidayRow[]>()` AND NOT `.maybeSingle()`, for the reason `setOverloadThreshold`
  // records: on zero rows `maybeSingle()` gives `data: null` with no error, which is
  // indistinguishable from a successful update of a row that no longer exists.
  //
  // ONE ROW, BY ID (AC-10). `.eq("id", holidayId)` is the whole scope, and `holiday_update_admin`
  // is what stops a member issuing the same statement — the filter here is not a second, weaker copy
  // of the policy, it is which row this call is about.
  async updateHoliday(holidayId: string, input: UpdateHolidayInput): Promise<Result<Holiday>> {
    const { data, error } = await client()
      .from("holiday")
      .update({ date: input.date, name: input.name, kind: input.kind })
      .eq("id", holidayId)
      .select(HOLIDAY_COLUMNS)
      .returns<HolidayRow[]>();

    if (error) return { ok: false, error: toHolidayFailure(error, HOLIDAY_UPDATE_REFUSED) };

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "not_permitted", message: HOLIDAY_UPDATE_REFUSED } };
    }

    return { ok: true, value: toHoliday(row) };
  },

  // ADM-03 AC-11, AC-13, AC-15, AC-16. A HARD delete: nothing references `holiday`, there is no
  // cascade anywhere in this model, and 01-plan.md section 8 rejects a `deleted_at` column.
  //
  // THE `.select()` IS THE WHOLE CORRECTNESS OF THIS FUNCTION, exactly as it is on `deleteEntry`. A
  // DELETE the policy filters answers 200 with an empty body just as an UPDATE does, and a delete
  // has no obvious return value to inspect — so without asking for the deleted representation and
  // counting it, every refusal would be reported as a completed delete.
  async deleteHoliday(holidayId: string): Promise<Result<void>> {
    const { data, error } = await client()
      .from("holiday")
      .delete()
      .eq("id", holidayId)
      .select(HOLIDAY_COLUMNS)
      .returns<HolidayRow[]>();

    if (error) return { ok: false, error: toHolidayFailure(error, HOLIDAY_DELETE_REFUSED) };

    if (!(data ?? [])[0]) {
      return { ok: false, error: { code: "not_permitted", message: HOLIDAY_DELETE_REFUSED } };
    }

    return { ok: true, value: undefined };
  },

  // MIR-15-e, ADR-079 decision 5. `public.member_org_id` for the signed-in user, then
  // `public.org_is_shared` on it. `false` for no session, no member row, or a member not approved
  // or removed — `member_org_id` returns null for each of those and `org_is_shared(null)` is false.
  // An affordance for `/holidays` only; the write policies above are the control, and this function
  // THROWS on any transport failure rather than guessing, so a caller fails closed (AC-6).
  async isOwnOrgShared(): Promise<boolean> {
    const { data: auth } = await client().auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return false;

    const { data: orgId, error: orgError } = await client().rpc("member_org_id", { p_uid: uid });
    if (orgError) throw new Error(`isOwnOrgShared failed: ${orgError.message}`);
    if (orgId === null) return false;

    const { data: shared, error } = await client().rpc("org_is_shared", { p_org_id: orgId });
    if (error) throw new Error(`isOwnOrgShared failed: ${error.message}`);
    return shared === true;
  },

  // -------------------------------------------------------------------------
  // ADM-04. 01-plan.md section 4.2.
  //
  // ONE READ AND NO WRITE. Nothing here writes `status`, `rejection_reason`, `approved_by` or
  // `approved_at` — `entry_update_admin` and `public.entry_enforce_decision()` are ADM-05's, and
  // this ticket's registry row forbids an approve control on this surface (AC-9).
  // -------------------------------------------------------------------------

  // ADM-04 AC-1 to AC-8, AC-11, AC-13.
  //
  // NO TEAM FILTER, exactly as `listTeamEntries` has none: `entry_select_team` is the scope, and a
  // `member_team_id` predicate written here would be a second, weaker copy of the policy (AC-13).
  //
  // NO `is_admin` CHECK. `Read any entry in the team` is checked for BOTH roles in
  // rbac-and-security.md, so this read is not where the admin capability lives — PendingEntries.tsx
  // refuses a non-admin as an AFFORDANCE, and there is no control behind it at all.
  //
  // `{ count: "exact" }` WITH `.range()` IS THE WHOLE OF AC-3, and it was verified against the
  // installed client rather than recalled: the option is at
  // @supabase/postgrest-js@2.112.4/dist/index.d.mts:4303-4306, the response field at :646, `.range`
  // at :1351, and :3519 documents that with `count` and `range` together the count is the TOTAL
  // matching set rather than the page. One request answers both halves, which is what makes the
  // number on screen and the rows under it unable to disagree — two calls could, because a write can
  // land between them (01-plan.md section 8, rejected alternative 1).
  //
  // THREE `order` CALLS, and the order is written twice — once here, once in mock.ts — which
  // `tests/seam-parity.test.ts` cannot see. Paging is what forces the duplication: a page boundary
  // needs a stable SERVER-side order, so unlike `absence.ts` the order cannot be applied above the
  // seam. 01-plan.md section 2, Open questions item 5.
  //
  // ASCENDING BY `start_date`, unlike `listTeamEntries` and `listOwnEntries`: this is a worklist and
  // the entries running out of time belong at the top. `created_at` is the first tiebreaker, so
  // within one date the first-in-first-out order still applies (01-plan.md section 8, rejected
  // alternative 5).
  async listPendingEntries(query: PendingEntryQuery): Promise<PendingEntryPage> {
    const from = query.page * PENDING_PAGE_SIZE;
    const to = from + PENDING_PAGE_SIZE - 1;

    // Built in steps because two of the three predicates are conditional. Each call returns the same
    // builder, so this is one request and not three.
    let request = client()
      .from("entry")
      .select(ENTRY_COLUMNS, { count: "exact" })
      .eq("status", "pending");

    // AC-8. `null` means both types, so no predicate at all rather than an `in` over both values —
    // an `in` would be a filter that can be got wrong for no behaviour it buys.
    if (query.type !== null) request = request.eq("type", query.type);

    // AC-6, AC-7 and AC-16. `end_date` against the CALLER's `yyyy-MM-dd`. NOT `current_date`: that
    // is evaluated in the datastore's timezone, which is UTC, so between 00:00 and 07:00 ICT the
    // boundary would sit on yesterday for the only team this product has (01-plan.md section 8,
    // rejected alternative 3).
    if (query.window === "upcoming") request = request.gte("end_date", query.today);
    else if (query.window === "past") request = request.lt("end_date", query.today);

    const { data, error, count } = await request
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
      .returns<EntryRow[]>();

    if (error) throw new Error(`listPendingEntries failed: ${error.message}`);

    const rows = data ?? [];

    // AC-3. `count` is asked for explicitly, so a null one means the datastore did not answer the
    // half this screen is built on. Falling back to `rows.length` is the one simplification the
    // feature row rules out in words — it would report a page as the whole queue, which is the
    // silent short queue this ticket exists to make impossible.
    if (count === null || count === undefined) {
      throw new Error(
        "listPendingEntries got no exact count: the outstanding figure must never be derived from " +
          "the number of rows on the page (ADM-04 AC-3)",
      );
    }

    // AC-5. THE ASSERTION THAT REPLACES THE CEILING every other read in this file uses, and it is
    // strictly stronger than one: it detects a lowered `max-rows` WITHOUT KNOWING ITS VALUE, which
    // is the unknown ROSTER_LIMIT, OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT, MONTH_ENTRY_LIMIT and
    // HOLIDAY_LIMIT have each carried a `TODO(verify)` for.
    //
    // A short page is normal on the LAST page and only there. Short while more rows remain means
    // PostgREST capped the window — and the loss here points the wrong way round: the queue reads as
    // EMPTY, nothing looks wrong, and the entries nobody can see are never decided.
    if (rows.length < PENDING_PAGE_SIZE && from + rows.length < count) {
      throw new Error(
        `listPendingEntries returned ${rows.length} of ${PENDING_PAGE_SIZE} rows on page ` +
          `${query.page} while ${count} match: the page was shortened and must not be consumed, ` +
          `because a queue that comes back short reads as an empty queue (ADM-04 AC-5)`,
      );
    }

    return { rows: rows.map(toEntry), total: count, page: query.page, pageSize: PENDING_PAGE_SIZE };
  },

  // MIR-14-b AC-8, AC-9. `public.list_entry_owners(uuid[])`: one row per (owner, active team), for
  // owners the caller may decide, ordered by owner then team name. Grouped here into one
  // `EntryOwner` per id, keeping the rows' team order. No `.limit()`: the bound is the argument —
  // at most PENDING_PAGE_SIZE owners, each on a handful of teams — and it is checked before the call.
  async listEntryOwners(memberIds: string[]): Promise<EntryOwner[]> {
    const ids = [...new Set(memberIds)];
    if (ids.length > PENDING_PAGE_SIZE) {
      throw new Error(
        `listEntryOwners was asked for ${ids.length} owners, more than one page (${PENDING_PAGE_SIZE})`,
      );
    }
    if (ids.length === 0) return [];

    const { data, error } = await client()
      .rpc("list_entry_owners", { p_member_ids: ids })
      .returns<EntryOwnerRow[]>();

    if (error) throw new Error(`listEntryOwners failed: ${error.message}`);
    if (!Array.isArray(data)) {
      throw new Error("listEntryOwners received a body that is not a list");
    }

    const byId = new Map<string, EntryOwner>();
    for (const row of data) {
      const owner = byId.get(row.member_id);
      if (owner) owner.teams.push({ id: row.team_id, name: row.team_name });
      else
        byId.set(row.member_id, {
          memberId: row.member_id,
          displayName: row.display_name,
          avatar: row.avatar,
          teams: [{ id: row.team_id, name: row.team_name }],
        });
    }
    return [...byId.values()];
  },

  // -------------------------------------------------------------------------
  // ADM-05. 01-plan.md sections 4.2 and 6.
  //
  // `updateEntry` and `deleteEntry` above are UNCHANGED by this ticket — not one character — and
  // `listPendingEntries` with them. One BEHAVIOUR of `updateEntry` does change and a reviewer will
  // look for it: a member's edit of an APPROVED entry now has an approval to revoke, so INV-02's
  // reset becomes observable through a function this ticket does not edit (AC-12, AC-14). That is
  // ADR-005 working as designed, exactly as CAL-03 recorded for the widening it shipped.
  // -------------------------------------------------------------------------

  // ADM-05 AC-1, AC-4, AC-6, AC-7, AC-10, AC-16, AC-17.
  //
  // ONE COLUMN ON THE WIRE. `approved_by`, `approved_at` and `rejection_reason` are clause (b)'s and
  // are not sent: the first two are not even granted, and a seam that sent them would be a second
  // expression of the clause that agrees with it until one of the two is edited. AC-7 is held there
  // and not here — there is no parameter on this function that could carry a forged approver.
  //
  // `tentative` is not sent either, which is INV-05 and AC-6: approval and tentativeness are two
  // independent axes and this write touches only one of them.
  //
  // ZERO ROWS BACK IS A REFUSAL, not a success (AC-16, AC-17). Under row-level security a refused
  // UPDATE is FILTERED rather than errored — it matches no row and PostgREST answers 200 with an
  // empty body — so `!error` is green on a refusal. The `.select()` is what makes the difference
  // visible, and it is also what returns the row the TRIGGER rewrote: the approver, the timestamp
  // and the cleared reason are read back rather than assumed.
  async approveEntry(entryId: string): Promise<Result<Entry>> {
    const { data, error } = await client()
      .from("entry")
      .update({ status: "approved" })
      .eq("id", entryId)
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) return { ok: false, error: toDecisionFailure(error) };

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: APPROVE_REFUSED } };
    }

    return { ok: true, value: toEntry(row) };
  },

  // ADM-05 AC-2, AC-3, AC-5, AC-9, AC-16, AC-17.
  //
  // AC-3, AND IT IS AN AFFORDANCE. `entry_rejection_reason_iff_rejected` is the control and refuses
  // the same write with a raw 23514; this refusal exists so the interface never renders a SQLSTATE,
  // which is the failure ADR-011 recorded for 23P01. `trim()` only DECIDES — the reason is stored as
  // the admin wrote it, because the constraint tests emptiness with `btrim` and nothing else.
  //
  // THE TWO COLUMNS GO IN ONE STATEMENT, and they have to: INV-03's check is a biconditional, so a
  // statement that set `status` without the reason is refused, and one that set the reason without
  // the status is refused too. AC-5 is this same function on a row that is ALREADY rejected — one
  // path, because rejecting and re-wording a rejection are one statement.
  async rejectEntry(entryId: string, reason: string): Promise<Result<Entry>> {
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    const { data, error } = await client()
      .from("entry")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", entryId)
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) return { ok: false, error: toDecisionFailure(error) };

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: REJECT_REFUSED } };
    }

    return { ok: true, value: toEntry(row) };
  },

  // -------------------------------------------------------------------------
  // ADM-06. 01-plan.md sections 4.2 and 6.
  //
  // `approveEntry` and `rejectEntry` above are UNCHANGED by this ticket — not one character — and so
  // are `listPendingEntries`, `updateEntry` and `deleteEntry`.
  // -------------------------------------------------------------------------

  // ADM-06 AC-1 to AC-11, AC-18.
  //
  // `.rpc()` AND NOT `.update()`, and the reason is ADR-016 section 4's rather than a preference:
  // the ids travel in the POST body instead of the query string, so the 414 ceiling is gone; and the
  // function returns the affected count, which is the only way the filtered-row case is detectable at
  // all. This is the FIRST `.rpc()` call in this file, which is worth a reviewer's attention rather
  // than a note in passing — it is a second shape of request beside the table builders.
  //
  // THE PARAMETER NAMES ARE THE FUNCTION'S — `p_ids` and `p_reason`. PostgREST matches an RPC's
  // arguments by name, so a rename here is a 404 at runtime and not a type error.
  //
  // `toDecisionFailure` IS REUSED UNCHANGED and no fourth mapper is written. It already answers the
  // three codes this path can produce — 42501 from clause (a), 23514 from INV-03's biconditional, and
  // PGRST301 for a missing or expired token — and 22023 is the one addition, which is the same
  // sentence 23514 already carries because it is the same missing thing.
  //
  // NO ZERO-ROW REFUSAL HERE, unlike `approveEntry` and `rejectEntry` above, and the difference is
  // the ticket: zero of eight is a PARTIAL RESULT and not an error (AC-5, AC-11). A batch that
  // reached nothing is reported as "0 of 8" by the caller comparing the two numbers, because the
  // datastore filtering every row and the datastore refusing are different facts.
  async rejectEntries(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>> {
    // AC-3, AND IT IS AN AFFORDANCE. `entry_rejection_reason_iff_rejected` is the control, and the
    // function's own 22023 is the sentence in front of it; this refusal exists so no request is
    // issued for a batch that cannot possibly land. `trim()` only DECIDES — the reason is stored as
    // the admin wrote it, because the constraint tests emptiness with `btrim` and nothing else.
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    // AC-6. De-duplicated HERE rather than left to `= any(p_ids)`, which collapses them silently:
    // `requested` must be a number the returned count can be compared against, and the raw array
    // length is not one.
    const ids = [...new Set(entryIds)];

    // AC-4. A refusal and not a no-op: `update ... where id = any('{}')` succeeds and changes
    // nothing, so an empty batch would otherwise report `{ requested: 0, rejected: 0 }` — ok:true on
    // a write that never happened, which is the fail-quiet shape this whole ticket exists to expose.
    if (ids.length === 0) {
      return { ok: false, error: { code: "no_entries_selected", message: NOTHING_SELECTED } };
    }

    const { data, error } = await client().rpc("reject_entries", {
      p_ids: ids,
      p_reason: reason,
    });

    // AC-7. FAILURE IS ATOMIC and that property is the datastore's, not this function's: one
    // statement in one transaction, so an error here means NONE of the batch was rejected.
    if (error) return { ok: false, error: toDecisionFailure(error) };

    // AC-18. The count is the datastore's. A null or non-numeric body is a contract violation rather
    // than a zero — reporting "0 of 8" for a response nobody could read would be the fail-quiet
    // answer to a fail-quiet problem.
    if (typeof data !== "number") {
      return { ok: false, error: { code: "unknown", message: BULK_REJECT_REFUSED } };
    }

    return { ok: true, value: { requested: ids.length, rejected: data } };
  },

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-26 — report an issue.
  // -------------------------------------------------------------------------

  // **`!error` IS SUCCESS, AND THIS IS THE ONE WRITE IN THIS FILE WHERE THAT IS TRUE.** Every other
  // one documents the opposite: a refused UPDATE or SELECT under row-level security is FILTERED, so
  // PostgREST answers 200 with an empty body and `!error` would report a refusal as done. An INSERT
  // is not filtered — `issue_report_insert_own`'s `with check` RAISES 42501 — so there is nothing to
  // detect by asking for the row back.
  //
  // AND THERE IS A SECOND REASON NOT TO ASK. No `issue_report_select_own` policy exists, by design,
  // so a `RETURNING` clause here would be checked against the select policies and answer NOTHING for
  // the person who just wrote the row: `.select()` would turn every successful report into an
  // apparent failure.
  //
  // `member_id` IS SENT AND IS NOT TRUSTED. It is the caller's own id read from the session, and the
  // policy re-derives it from `auth.uid()` and refuses a mismatch — so the value on the wire cannot
  // aim this at somebody else. It is sent because the column is `not null` with no default; the
  // policy is what makes sending it safe.
  async createIssueReport(input: CreateIssueReportInput): Promise<Result<void>> {
    const files = input.images ?? [];

    // **EVERY REFUSAL FIRST, BEFORE A BYTE IS SENT.** Somebody who attached a fourth image, or a
    // PDF, learns it immediately rather than after three successful five-megabyte uploads. The
    // bucket would refuse them anyway; this is what makes the refusal cheap.
    const invalid = issueMessageFailure(input.message) ?? issueImageFailure(files);
    if (invalid) return { ok: false, error: invalid };

    const { data: auth } = await client().auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, error: { code: "not_permitted", message: ISSUE_SEND_REFUSED } };

    // **UPLOADS BEFORE THE INSERT, AND THE ORDER IS FORCED.** The row stores the paths, so the paths
    // have to exist first. The cost is stated in the seam contract and in the migration's § 4: an
    // upload that succeeds before an insert that fails leaves an orphan nothing can collect, because
    // this feature has no delete path by decision. No transaction spans storage and a table, so a
    // window like this is in every design of this feature; this is where it is.
    //
    // SEQUENTIAL AND NOT `Promise.all`. Three files at five megabytes on a phone tether is a lot of
    // parallel upstream, and the first failure should stop the rest rather than race them.
    const paths: string[] = [];
    for (const file of files) {
      const path = issueObjectPath(uid, file);
      const { error: uploadError } = await client()
        .storage.from(ISSUE_BUCKET)
        // `upsert: false` so a path collision is an ERROR rather than a silent overwrite. The name
        // is a fresh uuid, so a collision means something is wrong that nobody should paper over.
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        return { ok: false, error: { code: "invalid_issue_image", message: ISSUE_UPLOAD_FAILED } };
      }
      paths.push(path);
    }

    const { error } = await client()
      .from("issue_report")
      .insert({
        member_id: uid,
        kind: input.kind,
        // TRIMMED HERE AND STORED TRIMMED, exactly as `updateOwnProfile` stores the display name: a
        // seam that refused on the trimmed value and stored the untrimmed one would disagree with
        // itself about what it checked.
        message: input.message.trim(),
        page: input.page,
        images: paths,
      });

    if (error) return { ok: false, error: toIssueFailure(error, ISSUE_SEND_REFUSED) };
    return { ok: true, value: undefined };
  },

  // **`head: true` — NO ROWS COME BACK AT ALL**, only the count in a `Content-Range` header. The tab
  // strip needs one number on every admin navigation, and reading five hundred rows to compute it is
  // what this function exists instead of.
  //
  // A NON-ADMIN IS ANSWERED `0` AND NOT REFUSED: `issue_report_select_admin` filters, so the count
  // of what they may see is genuinely zero. The badge is absent for them by arithmetic rather than
  // by a branch, which is the same shape every other admin read in this seam has.
  //
  // A THROW IS NOT A ZERO. A transport failure must not render as *nothing to look at*, which is the
  // one wrong answer this number can give — so it throws and `AdminLayout` draws no badge at all.
  async countOpenIssueReports(): Promise<number> {
    const { count, error } = await client()
      .from("issue_report")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");

    if (error) throw new Error(`countOpenIssueReports failed: ${error.message}`);
    return count ?? 0;
  },

  // SOLO, 2026-09-26 (third run). `listPendingMembers`'s two filters, counted rather than listed —
  // `head: true`, so no member rows come back at all, only the count in a `Content-Range` header.
  //
  // **THE TWO FILTERS ARE THE QUEUE'S DEFINITION AND ARE COPIED FROM THAT FUNCTION, NOT INVENTED
  // HERE.** A waiting sign-up is `roster_team_id is null` AND `status = 'pending'`: the first is what
  // makes them invisible to every team-scoped read, the second is what an admin decides. A count that
  // dropped either would put a number on the tab that the screen behind it disagrees with.
  //
  // A non-admin is answered `0` because `member_select_pending_admin` filters, and a throw is not a
  // zero — both for the reasons `countOpenIssueReports` above records at length.
  async countPendingMembers(): Promise<number> {
    const { count, error } = await client()
      .from("member")
      .select("id", { count: "exact", head: true })
      .is("roster_team_id", null)
      .eq("status", "pending");

    if (error) throw new Error(`countPendingMembers failed: ${error.message}`);
    return count ?? 0;
  },

  // **MINTED, NOT STORED.** The bucket is private, so a path is not loadable; `createSignedUrl` is
  // checked against `issue_image_select_admin` exactly as a direct read would be, so this widens
  // nothing — it moves the check to minting time and lets an `<img>` tag load with no session.
  //
  // SAME ORDER, SAME LENGTH, AND A `null` IN PLACE RATHER THAN A DROPPED ENTRY. A caller rendering a
  // gallery shows a broken slot instead of silently shifting every image after the failed one, which
  // would attach the wrong caption to the wrong picture.
  async issueImageUrls(paths: string[]): Promise<(string | null)[]> {
    if (paths.length === 0) return [];

    const { data, error } = await client()
      .storage.from(ISSUE_BUCKET)
      .createSignedUrls(paths, ISSUE_URL_TTL_SECONDS);

    // A REFUSAL IS NOT A THROW HERE. A member who somehow reached the admin screen is refused by the
    // storage policy, and the screen should draw broken slots rather than fall into its
    // `unavailable` phase — the reports themselves were readable or it would not have got this far.
    if (error || !data) return paths.map(() => null);

    // The API answers in order, one entry per path, each carrying either a URL or its own error.
    // Read positionally rather than by matching `path`, because the returned `path` is not
    // guaranteed to be spelled as it was sent.
    return paths.map((_, index) => data[index]?.signedUrl ?? null);
  },

  // NEWEST FIRST, and the order is the seam's rather than the policy's — `issue_report_select_admin`
  // says who, not in what sequence. A list read oldest-first buries today's report under a year of
  // history on the one screen whose job is to surface what just arrived. `id` is the tiebreaker, as
  // `listMembers` uses it, so two reports written in the same millisecond have a stable order rather
  // than the one the planner happened to produce.
  //
  // A NON-ADMIN GETS `[]` AND NOT A THROW. The select policy filters, so that is the datastore's own
  // answer and not a check this function makes; `IssueReports.tsx` is what decides to say *this page
  // is for admins* rather than *no reports*.
  async listIssueReports(): Promise<IssueReport[]> {
    const { data, error } = await client()
      .from("issue_report")
      .select(ISSUE_REPORT_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(ISSUE_REPORT_LIMIT)
      .returns<IssueReportRow[]>();

    if (error) throw new Error(`listIssueReports failed: ${error.message}`);

    const rows = data ?? [];

    // The assertion every bounded read in this file carries, with this table's own sentence. A short
    // list computes nothing incorrectly — no derivation reads it — and is worse than that: a report
    // somebody wrote is silently not shown to the person it was written for, which is the whole
    // feature failing quietly.
    if (rows.length >= ISSUE_REPORT_LIMIT) {
      throw new Error(
        `listIssueReports returned ${rows.length} rows at the ${ISSUE_REPORT_LIMIT} limit: the ` +
          `list may be truncated and must not be shown as complete`,
      );
    }

    return rows.map(toIssueReport);
  },

  // ZERO ROWS BACK IS A REFUSAL, and here the trap is real: an UPDATE refused by
  // `issue_report_update_admin` is FILTERED, matches no row, and PostgREST answers 200 with an empty
  // array — so `!error` would report a member's refused press as done.
  //
  // `.returns<IssueReportRow[]>()` and NOT `.maybeSingle()`, for the reason `setOverloadThreshold`
  // records: on zero rows `maybeSingle()` gives `data: null` with no error, which is
  // indistinguishable from a successful update of a row that no longer exists.
  //
  // ONE COLUMN. `status` is the only column in the update grant, so a statement naming `message` is
  // refused with `42501 permission denied for column` before the policy runs — that grant is what
  // stops an admin rewriting what somebody wrote, and this signature's shape is only the affordance.
  async setIssueReportStatus(reportId: string, status: IssueStatus): Promise<Result<IssueReport>> {
    const { data, error } = await client()
      .from("issue_report")
      .update({ status })
      .eq("id", reportId)
      .select(ISSUE_REPORT_COLUMNS)
      .returns<IssueReportRow[]>();

    if (error) return { ok: false, error: toIssueFailure(error, ISSUE_STATUS_REFUSED) };

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "not_permitted", message: ISSUE_STATUS_REFUSED } };
    }

    return { ok: true, value: toIssueReport(row) };
  },

  // -------------------------------------------------------------------------
  // EVT-01 — events. 01-plan.md § 5: reads through `from("event")` and `from("event_invitee")` under
  // row-level security, the directory through `rpc("list_member_directory")`, both writes through
  // `rpc("save_event")`, and the delete as a table delete that reads back what it removed.
  // -------------------------------------------------------------------------

  // `event_select_visible` does all the filtering; this adds none. `DATASTORE_MAX_ROWS` is the bound
  // because no event limit was designed and a new constant would be a name the contract never
  // declared — the throw is the shape every bounded read in this file carries: a short list would
  // hide an event from the people it is for.
  // EVT-11 AC-8. EVENT_LIST_COLUMNS: no description on a list read.
  async listEvents(): Promise<CalEvent[]> {
    const { data, error } = await client()
      .from("event")
      .select(EVENT_LIST_COLUMNS)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .limit(DATASTORE_MAX_ROWS)
      .returns<EventRow[]>();

    if (error) throw new Error(`listEvents failed: ${error.message}`);

    const rows = data ?? [];
    if (rows.length >= DATASTORE_MAX_ROWS) {
      throw new Error(
        `listEvents returned ${rows.length} rows at the ${DATASTORE_MAX_ROWS} limit: the list may ` +
          `be truncated and must not be shown as complete`,
      );
    }
    return rows.map(toEvent);
  },

  // Null for "does not exist" and "may not read" alike — the policy filters, and zero rows is the
  // same body either way (AC-22). A malformed id (`22P02`, PostgREST failing to cast it to uuid) is
  // also an event that does not exist, not a fault.
  async getEvent(eventId: string): Promise<CalEvent | null> {
    const { data, error } = await client()
      .from("event")
      .select(EVENT_COLUMNS)
      .eq("id", eventId)
      .returns<EventRow[]>();

    if (error) {
      if (error.code === "22P02") return null;
      throw new Error(`getEvent failed: ${error.message}`);
    }
    const row = (data ?? [])[0];
    return row ? toEvent(row) : null;
  },

  // `event_invitee_select_manage`: a caller who may not edit the event is answered no rows, and that
  // is the whole of AC-13's mechanism.
  async listEventInvitees(eventId: string): Promise<string[]> {
    const { data, error } = await client()
      .from("event_invitee")
      .select("member_id")
      .eq("event_id", eventId)
      .order("member_id", { ascending: true })
      .limit(ROSTER_LIMIT)
      .returns<{ member_id: string }[]>();

    if (error) {
      if (error.code === "22P02") return [];
      throw new Error(`listEventInvitees failed: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length >= ROSTER_LIMIT) {
      throw new Error(
        `listEventInvitees returned ${rows.length} rows at the ${ROSTER_LIMIT} limit: the list ` +
          `may be truncated and must not be consumed`,
      );
    }
    return rows.map((r) => r.member_id);
  },

  // `public.list_member_directory()`. FIVE COLUMNS AND NO MORE (ADR-045 point 4); ordering is here,
  // not in the function (CAL-11's header). `ROSTER_LIMIT` for the reason `listTeams` reuses it — one
  // cap on how many people a read can believably return.
  async listMemberDirectory(): Promise<DirectoryMember[]> {
    const { data, error } = await client()
      .rpc("list_member_directory")
      .select(DIRECTORY_COLUMNS)
      .order("team_name", { ascending: true })
      .order("display_name", { ascending: true })
      .order("id", { ascending: true })
      .limit(ROSTER_LIMIT)
      .returns<DirectoryRow[]>();

    if (error) throw new Error(`listMemberDirectory failed: ${error.message}`);
    if (!Array.isArray(data)) {
      throw new Error("listMemberDirectory received a body that is not a list");
    }
    if (data.length >= ROSTER_LIMIT) {
      throw new Error(
        `listMemberDirectory returned ${data.length} rows at the ${ROSTER_LIMIT} limit: the ` +
          `directory may be truncated and must not be consumed`,
      );
    }
    return data.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      avatar: row.avatar,
      teamId: row.team_id,
      teamName: row.team_name,
    }));
  },

  async createEvent(input: SaveEventInput): Promise<Result<CalEvent>> {
    return saveEventThroughRpc(null, input);
  },

  async updateEvent(eventId: string, input: SaveEventInput): Promise<Result<CalEvent>> {
    return saveEventThroughRpc(eventId, input);
  },

  // ZERO ROWS BACK IS A REFUSAL: a DELETE that `event_delete_manage` filters answers 200 with an
  // empty body, exactly as `deleteEntry` records. The named list goes with the row by the cascade.
  async deleteEvent(eventId: string): Promise<Result<void>> {
    const { data, error } = await client()
      .from("event")
      .delete()
      .eq("id", eventId)
      .select("id")
      .returns<{ id: string }[]>();

    if (error) {
      if (error.code === "22P02") {
        return { ok: false, error: { code: "event_not_permitted", message: EVENT_DELETE_REFUSED } };
      }
      return { ok: false, error: toEventFailure(error, null, EVENT_DELETE_REFUSED) };
    }
    if (!(data ?? [])[0]) {
      return { ok: false, error: { code: "event_not_permitted", message: EVENT_DELETE_REFUSED } };
    }
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // EVT-02 — attendance. 01-plan.md § 5: every read and write is a table call on
  // `event_attendance` under row-level security. THE CAP IS HELD BY `event_attendance_guard` UNDER
  // THE EVENT ROW'S LOCK; nothing here counts seats before writing (ADR-045 § Consequences).
  // -------------------------------------------------------------------------

  // `event_attendance_select_visible` does all the filtering: attending rows to every reader, every
  // row to the creator and admins, the caller's own to the caller. `DATASTORE_MAX_ROWS` and the throw
  // for `listEvents`'s reason.
  async listEventAttendance(eventId: string): Promise<EventAttendance[]> {
    const { data, error } = await client()
      .from("event_attendance")
      .select(ATTENDANCE_COLUMNS)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .order("member_id", { ascending: true })
      .limit(DATASTORE_MAX_ROWS)
      .returns<AttendanceRow[]>();

    if (error) {
      if (error.code === "22P02") return [];
      throw new Error(`listEventAttendance failed: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length >= DATASTORE_MAX_ROWS) {
      throw new Error(
        `listEventAttendance returned ${rows.length} rows at the ${DATASTORE_MAX_ROWS} limit: the ` +
          `list may be truncated and must not be shown as complete`,
      );
    }
    return rows.map(toAttendance);
  },

  // ONLY `event_id` IS SENT. `member_id` defaults to `auth.uid()` and `status` is set by the guard
  // from `requires_approval`; both are withheld from the insert grant, so naming either is 42501
  // (AC-20). `.select()` reads back the state the guard chose.
  async joinEvent(eventId: string): Promise<Result<EventAttendance>> {
    const { data, error } = await client()
      .from("event_attendance")
      .insert({ event_id: eventId })
      .select(ATTENDANCE_COLUMNS)
      .returns<AttendanceRow[]>();

    if (error) return { ok: false, error: toAttendanceFailure(error, ATTENDANCE_JOIN_REFUSED) };
    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "attendance_not_permitted", message: ATTENDANCE_JOIN_REFUSED } };
    }
    return { ok: true, value: toAttendance(row) };
  },

  // ZERO ROWS BACK IS A REFUSAL — `deleteEvent`'s reasoning. `event_attendance_delete_own` filters on
  // ownership, state and open registration together, so the zero-row case reads the caller's own row
  // back to tell the date apart from the rest (§ 4.3's docblock). That read is for the SENTENCE only;
  // the policy already refused.
  async leaveEvent(eventId: string): Promise<Result<void>> {
    const { data: auth } = await client().auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      return { ok: false, error: { code: "attendance_not_permitted", message: ATTENDANCE_LEAVE_REFUSED } };
    }

    const { data, error } = await client()
      .from("event_attendance")
      .delete()
      .eq("event_id", eventId)
      .eq("member_id", uid)
      .select("event_id")
      .returns<{ event_id: string }[]>();

    if (error) return { ok: false, error: toAttendanceFailure(error, ATTENDANCE_LEAVE_REFUSED) };
    if ((data ?? [])[0]) return { ok: true, value: undefined };

    const { data: own } = await client()
      .from("event_attendance")
      .select("status")
      .eq("event_id", eventId)
      .eq("member_id", uid)
      .in("status", ["pending", "attending"])
      .returns<{ status: AttendanceStatus }[]>();
    if ((own ?? [])[0]) {
      return {
        ok: false,
        error: { code: "event_registration_closed", message: EVENT_REGISTRATION_CLOSED },
      };
    }
    return { ok: false, error: { code: "attendance_not_permitted", message: ATTENDANCE_LEAVE_REFUSED } };
  },

  // ONLY `status` IS SENT — the one column in the update grant. `event_attendance_update_manage`
  // decides who; `event_attendance_guard` decides which transitions, and the cap on `attending`.
  async decideAttendance(
    eventId: string,
    memberId: string,
    status: "attending" | "rejected" | "removed",
  ): Promise<Result<EventAttendance>> {
    const { data, error } = await client()
      .from("event_attendance")
      .update({ status })
      .eq("event_id", eventId)
      .eq("member_id", memberId)
      .select(ATTENDANCE_COLUMNS)
      .returns<AttendanceRow[]>();

    if (error) return { ok: false, error: toAttendanceFailure(error, ATTENDANCE_DECIDE_REFUSED) };
    const row = (data ?? [])[0];
    if (!row) {
      return {
        ok: false,
        error: { code: "attendance_not_permitted", message: ATTENDANCE_DECIDE_REFUSED },
      };
    }
    return { ok: true, value: toAttendance(row) };
  },

  // -------------------------------------------------------------------------
  // EVT-03 — events on the week and month grids. 01-plan.md § 4.3. ADR-049. No migration: both reads
  // are filters over rows existing policies already return the caller (§ 6).
  // -------------------------------------------------------------------------

  // `member_id = caller` is explicit because `event_attendance_select_visible` returns an admin every
  // row, and AC-11 marks the ADMIN's own participation, not anybody's. No user, no rows.
  async listOwnEventAttendance(): Promise<EventAttendance[]> {
    const { data: auth, error: authError } = await client().auth.getUser();
    if (authError || !auth.user) return [];

    const { data, error } = await client()
      .from("event_attendance")
      .select(ATTENDANCE_COLUMNS)
      .eq("member_id", auth.user.id)
      .order("event_id", { ascending: true })
      .limit(DATASTORE_MAX_ROWS)
      .returns<AttendanceRow[]>();

    if (error) throw new Error(`listOwnEventAttendance failed: ${error.message}`);
    const rows = data ?? [];
    if (rows.length >= DATASTORE_MAX_ROWS) {
      throw new Error(
        `listOwnEventAttendance returned ${rows.length} rows at the ${DATASTORE_MAX_ROWS} limit: ` +
          `the list may be truncated and must not be shown as complete`,
      );
    }
    return rows.map(toAttendance);
  },

  // The same `select` `listEvents` issues (EVT-11: no description), plus the invitee embed. `event_invitee_select_manage`
  // returns invitees only to the creator and admins — exactly the set this filter can use — and a
  // non-admin's `list_members_for_team` is empty, so for them nothing named is ever added (AC-12).
  // The roster goes through `seam.` rather than `this.` for `readCurrentMember`'s reason: a method
  // reaching for a sibling through `this` breaks when the object is destructured.
  async listEventsForTeam(teamId: string): Promise<CalEvent[]> {
    const [eventsRead, members] = await Promise.all([
      client()
        .from("event")
        .select(`${EVENT_LIST_COLUMNS}, event_invitee(member_id)`)
        .order("start_date", { ascending: true })
        .order("id", { ascending: true })
        .limit(DATASTORE_MAX_ROWS)
        .returns<(EventRow & { event_invitee: { member_id: string }[] | null })[]>(),
      seam.listMembersForTeam(teamId),
    ]);

    if (eventsRead.error) throw new Error(`listEventsForTeam failed: ${eventsRead.error.message}`);
    const rows = eventsRead.data ?? [];
    if (rows.length >= DATASTORE_MAX_ROWS) {
      throw new Error(
        `listEventsForTeam returned ${rows.length} rows at the ${DATASTORE_MAX_ROWS} limit: the ` +
          `list may be truncated and must not be shown as complete`,
      );
    }

    const inviteesByEvent = new Map<string, string[]>(
      rows.map((row) => [row.id, (row.event_invitee ?? []).map((i) => i.member_id)]),
    );
    const teamMemberIds = new Set(
      members.filter((m) => m.removedAt === null && m.status === "approved").map((m) => m.id),
    );
    return eventsRelevantToTeam(rows.map(toEvent), teamId, inviteesByEvent, teamMemberIds);
  },

  // -------------------------------------------------------------------------
  // EVT-04 — notifications. 01-plan.md § 5. Reads through `from("notification")` under
  // `notification_select_own`, which returns the caller's own rows and nothing else — no admin clause
  // (AC-11) — so neither read filters by recipient itself. Both marks are one RPC, so `read_at` is the
  // database's clock. NOTHING HERE WRITES A ROW: the triggers do (ADR-050 decision 2).
  // -------------------------------------------------------------------------

  // A WINDOW, not a bound that throws: nothing is computed from this list, and the 51st-newest is
  // deliberately not shown (AC-16).
  async listNotifications(): Promise<EventNotification[]> {
    const { data, error } = await client()
      .from("notification")
      .select(NOTIFICATION_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(NOTIFICATION_LIMIT)
      .returns<NotificationRow[]>();

    if (error) throw new Error(`listNotifications failed: ${error.message}`);
    return (data ?? []).map(toNotification);
  },

  // `head: true` returns no rows and the exact count in `Content-Range` — every unread row, beyond the
  // window too (AC-13, AC-16).
  async countUnreadNotifications(): Promise<number> {
    const { count, error } = await client()
      .from("notification")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);

    if (error) throw new Error(`countUnreadNotifications failed: ${error.message}`);
    return count ?? 0;
  },

  // Zero rows marked is ok: already read and not the caller's are the same answer (§ 4.2).
  async markNotificationRead(notificationId: string): Promise<Result<void>> {
    const { error, status } = await client().rpc("mark_notifications_read", {
      p_ids: [notificationId],
    });
    if (error) return { ok: false, error: toNotificationFailure(status) };
    return { ok: true, value: undefined };
  },

  async markAllNotificationsRead(): Promise<Result<number>> {
    const { data, error, status } = await client().rpc("mark_notifications_read", { p_ids: null });
    if (error) return { ok: false, error: toNotificationFailure(status) };
    return { ok: true, value: typeof data === "number" ? data : 0 };
  },

  // -------------------------------------------------------------------------
  // EVT-05 — the event email switch. 01-plan.md § 4.2. NOTHING HERE SENDS OR NAMES AN EMAIL: the
  // trigger `email_notification()` hands email-kind notifications to the sender (ADR-051 decision 3).
  // -------------------------------------------------------------------------

  // `member_select_own` returns the caller's row. No user, or no row: null, a normal answer.
  async getEventEmailEnabled(): Promise<boolean | null> {
    const { data: auth, error: authError } = await client().auth.getUser();
    if (authError || !auth.user) return null;

    const { data, error } = await client()
      .from("member")
      .select("event_email_enabled")
      .eq("id", auth.user.id)
      .maybeSingle<{ event_email_enabled: boolean }>();

    if (error) throw new Error(`getEventEmailEnabled failed: ${error.message}`);
    return data ? data.event_email_enabled : null;
  },

  // `set_event_email` writes `auth.uid()`'s row and no other, and only while it is not removed; a
  // null answer is no row written. There is no member-id argument to pass, and there must never be.
  async setEventEmailEnabled(enabled: boolean): Promise<Result<boolean>> {
    const { data, error, status } = await client().rpc("set_event_email", { p_enabled: enabled });
    if (error) {
      return {
        ok: false,
        error:
          status === 0
            ? { code: "network", message: NOTIFICATION_MARK_NETWORK }
            : { code: "unknown", message: EVENT_EMAIL_SAVE_FAILED },
      };
    }
    if (typeof data !== "boolean") {
      return { ok: false, error: { code: "unknown", message: EVENT_EMAIL_SAVE_FAILED } };
    }
    return { ok: true, value: data };
  },

  // -------------------------------------------------------------------------
  // EVT-06 — the guest link. 01-plan.md § 4.2. Open, close and the link read are table calls on
  // `event_guest_link` under its three policies; the guest read is the two definer functions, THE
  // ONLY OBJECTS THE ANON KEY MAY CALL. Nothing here reads or writes `event` or `member`.
  // -------------------------------------------------------------------------

  // `event_guest_link_select_manage` filters; not open and may-not-manage are the same null (AC-3).
  // Signed out, the table has no `anon` grant and answers 42501 — also null (AC-14).
  async getEventGuestLink(eventId: string): Promise<EventGuestLink | null> {
    const { data, error } = await client()
      .from("event_guest_link")
      .select(GUEST_LINK_COLUMNS)
      .eq("event_id", eventId)
      .maybeSingle<GuestLinkRow>();

    if (error) {
      if (error.code === "22P02" || error.code === "42501" || error.code === "PGRST301") return null;
      throw new Error(`getEventGuestLink failed: ${error.message}`);
    }
    return data ? toGuestLink(data) : null;
  },

  // ONLY `event_id` IS SENT — the insert grant names no other column, so the token and the time are
  // the database's. A 23505 is the primary key: already open, so the link in place is the answer
  // (AC-6) — and if the read-back finds nothing, the caller may not see it, which is a refusal.
  async openEventToGuests(eventId: string): Promise<Result<EventGuestLink>> {
    const { data, error } = await client()
      .from("event_guest_link")
      .insert({ event_id: eventId })
      .select(GUEST_LINK_COLUMNS)
      .single<GuestLinkRow>();

    if (error) {
      if (error.code === "23505") {
        const existing = await this.getEventGuestLink(eventId);
        if (existing) return { ok: true, value: existing };
        return { ok: false, error: { code: "event_not_permitted", message: EVENT_GUEST_OPEN_REFUSED } };
      }
      return { ok: false, error: toGuestLinkFailure(error, EVENT_GUEST_OPEN_REFUSED) };
    }
    return { ok: true, value: toGuestLink(data) };
  },

  // ZERO ROWS BACK IS A REFUSAL — `deleteEvent`'s shape: a DELETE that the policy filters answers 200
  // with an empty body.
  async closeEventToGuests(eventId: string): Promise<Result<void>> {
    const { data, error } = await client()
      .from("event_guest_link")
      .delete()
      .eq("event_id", eventId)
      .select("event_id")
      .returns<{ event_id: string }[]>();

    if (error) return { ok: false, error: toGuestLinkFailure(error, EVENT_GUEST_CLOSE_REFUSED) };
    if (!(data ?? [])[0]) {
      return { ok: false, error: { code: "event_not_permitted", message: EVENT_GUEST_CLOSE_REFUSED } };
    }
    return { ok: true, value: undefined };
  },

  // Two definer reads, merged. A malformed token makes no round trip (AC-13). `seatsTaken` is the
  // first read's count, never the length of the second; the second is bounded and throws at the
  // bound, `listEventAttendance`'s reason.
  async getGuestEvent(token: string): Promise<GuestEvent | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) return null;

    const { data: events, error: eventError } = await client()
      .rpc("get_guest_event", { p_token: token })
      .select(GUEST_EVENT_COLUMNS)
      .returns<GuestEventRow[]>();
    if (eventError) throw new Error(`getGuestEvent failed: ${eventError.message}`);
    const row = (events ?? [])[0];
    if (!row) return null;

    const { data: attendees, error: attendeeError } = await client()
      .rpc("list_guest_event_attendees", { p_token: token })
      .select(GUEST_ATTENDEE_COLUMNS)
      .limit(DATASTORE_MAX_ROWS)
      .returns<{ display_name: string | null }[]>();
    if (attendeeError) throw new Error(`getGuestEvent failed: ${attendeeError.message}`);
    const names = attendees ?? [];
    if (names.length >= DATASTORE_MAX_ROWS) {
      throw new Error(
        `getGuestEvent returned ${names.length} attendees at the ${DATASTORE_MAX_ROWS} limit: the ` +
          `list may be truncated and must not be shown as complete`,
      );
    }

    return {
      name: row.name,
      description: row.description,
      location: row.location,
      startDate: row.start_date,
      endDate: row.end_date,
      capacity: row.capacity,
      seatsTaken: row.seats_taken,
      attendeeNames: names.map((a) => a.display_name),
    };
  },

  // -------------------------------------------------------------------------
  // EVT-07 — guest registration. 01-plan.md § 4.2. Four definer functions taking a token, the anon
  // key's only writes; members read `event_guest` under its select policy, and emails through
  // `list_event_guest_emails`. THE CAP IS `event_guest_guard`'S, UNDER THE EVENT ROW'S LOCK — nothing
  // here counts seats before writing. Nothing else in this file changed for EVT-07.
  // -------------------------------------------------------------------------

  // `get_guest_event_terms`. A malformed token makes no round trip; zero rows is null.
  async getGuestRegistrationTerms(token: string): Promise<GuestRegistrationTerms | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) return null;
    const { data, error } = await client()
      .rpc("get_guest_event_terms", { p_token: token })
      .select(GUEST_TERMS_COLUMNS)
      .returns<{ requires_approval: boolean; registration_open: boolean }[]>();
    if (error) throw new Error(`getGuestRegistrationTerms failed: ${error.message}`);
    const row = (data ?? [])[0];
    if (!row) return null;
    return { requiresApproval: row.requires_approval, registrationOpen: row.registration_open };
  },

  // `register_guest`. Trimmed here and again in the function; the checks here are affordances. The
  // one row back carries the plain manage token — the only read that ever does (AC-3).
  async registerGuest(
    token: string,
    name: string,
    email: string,
  ): Promise<Result<GuestRegistrationReceipt>> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) {
      return { ok: false, error: { code: "guest_link_not_found", message: GUEST_LINK_NOT_FOUND } };
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const invalid = guestInputFailure(trimmedName, trimmedEmail);
    if (invalid) return { ok: false, error: invalid };

    const { data, error } = await client()
      .rpc("register_guest", { p_token: token, p_name: trimmedName, p_email: trimmedEmail })
      .select(GUEST_RECEIPT_COLUMNS)
      .returns<{ manage_token: string; status: GuestStatus }[]>();
    if (error) return { ok: false, error: toGuestFailure(error, GUEST_LINK_NOT_FOUND) };
    const row = (data ?? [])[0];
    if (!row || (row.status !== "pending" && row.status !== "attending")) {
      return { ok: false, error: { code: "unknown", message: "Something went wrong. Please try again." } };
    }
    return { ok: true, value: { manageToken: row.manage_token, status: row.status } };
  },

  // `get_guest_registration`. A malformed token makes no round trip; zero rows is null (AC-13).
  async getGuestRegistration(manageToken: string): Promise<GuestRegistrationView | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(manageToken)) return null;
    const { data, error } = await client()
      .rpc("get_guest_registration", { p_manage_token: manageToken })
      .select(GUEST_REGISTRATION_COLUMNS)
      .returns<GuestRegistrationRow[]>();
    if (error) throw new Error(`getGuestRegistration failed: ${error.message}`);
    const row = (data ?? [])[0];
    if (!row) return null;
    return {
      eventName: row.event_name,
      startDate: row.start_date,
      endDate: row.end_date,
      location: row.location,
      guestName: row.guest_name,
      status: row.status,
      registrationOpen: row.registration_open,
      eventDeleted: row.event_deleted,
    };
  },

  // `cancel_guest_registration`. A malformed token makes no round trip and gets EV005's answer.
  async cancelGuestRegistration(manageToken: string): Promise<Result<void>> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(manageToken)) {
      return {
        ok: false,
        error: { code: "guest_registration_not_found", message: GUEST_REGISTRATION_NOT_FOUND },
      };
    }
    const { error } = await client().rpc("cancel_guest_registration", {
      p_manage_token: manageToken,
    });
    if (error) return { ok: false, error: toGuestFailure(error, GUEST_REGISTRATION_NOT_FOUND) };
    return { ok: true, value: undefined };
  },

  // `event_guest_select_visible` does the row filtering; the column list is the grant's — NEVER
  // `select("*")`. Then `list_event_guest_emails`, which answers the creator and admins only, merged
  // by id. Bounded and throws at the bound, `listEventAttendance`'s reason.
  async listEventGuests(eventId: string): Promise<EventGuest[]> {
    const { data, error } = await client()
      .from("event_guest")
      .select(GUEST_COLUMNS)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(DATASTORE_MAX_ROWS)
      .returns<GuestRow[]>();
    if (error) {
      if (error.code === "22P02" || error.code === "42501" || error.code === "PGRST301") return [];
      throw new Error(`listEventGuests failed: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length >= DATASTORE_MAX_ROWS) {
      throw new Error(
        `listEventGuests returned ${rows.length} rows at the ${DATASTORE_MAX_ROWS} limit: the ` +
          `list may be truncated and must not be shown as complete`,
      );
    }
    if (rows.length === 0) return [];

    const { data: emails, error: emailError } = await client()
      .rpc("list_event_guest_emails", { p_event_id: eventId })
      .select(GUEST_EMAIL_COLUMNS)
      .limit(DATASTORE_MAX_ROWS)
      .returns<{ guest_id: string; email: string }[]>();
    if (emailError) throw new Error(`listEventGuests failed: ${emailError.message}`);
    const byId = new Map((emails ?? []).map((e) => [e.guest_id, e.email]));
    return rows.map((row) => toEventGuest(row, byId.get(row.id) ?? null));
  },

  // ONLY `status` IS SENT — the one column in the update grant. `event_guest_update_manage` decides
  // who and refuses `cancelled`; `event_guest_guard` decides which transitions, and the cap. The row
  // read back carries no email; the panel reloads through `listEventGuests`.
  async decideGuest(
    guestId: string,
    status: "attending" | "rejected" | "removed",
  ): Promise<Result<EventGuest>> {
    const { data, error } = await client()
      .from("event_guest")
      .update({ status })
      .eq("id", guestId)
      .select(GUEST_COLUMNS)
      .returns<GuestRow[]>();
    if (error) {
      if (error.code === "22P02") {
        return { ok: false, error: { code: "attendance_not_permitted", message: GUEST_DECIDE_REFUSED } };
      }
      return { ok: false, error: toGuestFailure(error, GUEST_DECIDE_REFUSED) };
    }
    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "attendance_not_permitted", message: GUEST_DECIDE_REFUSED } };
    }
    return { ok: true, value: toEventGuest(row, null) };
  },

  // -------------------------------------------------------------------------
  // EVT-13 — a signed-in reader leaves the guest page. 01-plan.md § 4.2. ADR-061 decision 8.
  // `guest_link_event_id` is granted to `authenticated` only and answers null for "no such open
  // link" and "not a reader" alike; the control is the function, never this method.
  // -------------------------------------------------------------------------

  // A malformed token makes no round trip; a null answer is null.
  async getGuestLinkEventId(token: string): Promise<string | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) return null;
    const { data, error } = await client().rpc("guest_link_event_id", { p_token: token });
    if (error) throw new Error(`getGuestLinkEventId failed: ${error.message}`);
    return typeof data === "string" ? data : null;
  },

  // -------------------------------------------------------------------------
  // EVT-08 — email invitations. 01-plan.md § 4.2. One definer function writes; the table's select
  // policy reads. NOTHING HERE SENDS, AND NOTHING HERE SAYS WHICH ADDRESSES ARE MEMBERS' (AC-7) — the
  // function's two columns are the address and `sent` or `ignored`.
  // -------------------------------------------------------------------------

  // `invite_to_event`. The checks here are affordances; the function repeats them (EV008), dedupes
  // ignoring case, and opens the guest link.
  async inviteToEvent(eventId: string, emails: string[]): Promise<Result<EmailInvitationOutcome[]>> {
    const addresses = invitationAddresses(emails);
    if (addresses === null) {
      return { ok: false, error: { code: "invalid_invitation_email", message: INVITATION_EMAIL_INVALID } };
    }
    const { data, error } = await client()
      .rpc("invite_to_event", { p_event_id: eventId, p_emails: addresses })
      .select(INVITATION_OUTCOME_COLUMNS)
      .returns<{ email: string; outcome: string }[]>();
    if (error) return { ok: false, error: toInvitationFailure(error) };
    const rows = data ?? [];
    if (rows.some((r) => r.outcome !== "sent" && r.outcome !== "ignored")) {
      return { ok: false, error: { code: "unknown", message: "Something went wrong. Please try again." } };
    }
    return {
      ok: true,
      value: rows.map((r) => ({ email: r.email, outcome: r.outcome as EmailInvitationOutcome["outcome"] })),
    };
  },

  // `event_email_invitation_select_manage` does the filtering; the column list is the grant's — NEVER
  // `select("*")`. Not permitted, signed out and a malformed id are the same empty list (AC-13).
  async listEventEmailInvitations(eventId: string): Promise<EventEmailInvitation[]> {
    const { data, error } = await client()
      .from("event_email_invitation")
      .select(EMAIL_INVITATION_COLUMNS)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(DATASTORE_MAX_ROWS)
      .returns<EmailInvitationRow[]>();
    if (error) {
      if (error.code === "22P02" || error.code === "42501" || error.code === "PGRST301") return [];
      throw new Error(`listEventEmailInvitations failed: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length >= DATASTORE_MAX_ROWS) {
      throw new Error(
        `listEventEmailInvitations returned ${rows.length} rows at the ${DATASTORE_MAX_ROWS} limit: ` +
          `the list may be truncated and must not be shown as complete`,
      );
    }
    return rows.map(toEmailInvitation);
  },

  // -------------------------------------------------------------------------
  // TSK-01 — a member's own tasks. 01-plan.md § 4.4. ADR-057.
  //
  // EVERY CALL IS A TABLE CALL ON `task` UNDER ROW-LEVEL SECURITY, AND NONE FILTERS ON `member_id`.
  // The four policies are the filter; a client-side `.eq("member_id", …)` would make the test of
  // AC-16 pass whatever the policy said. The refusals before each request are affordances.
  // -------------------------------------------------------------------------

  async listTasks(from: string, to: string): Promise<Task[]> {
    if (from > to) return [];
    const { data, error } = await client()
      .from("task")
      .select(TASK_COLUMNS)
      .gte("date", from)
      .lte("date", to)
      // TSK-06 AC-8, ADR-062 decision 5. Reproduced clause for clause by mock.ts's `byDayOrder`.
      .order("date")
      .order("done")
      .order("time_of_day", { nullsFirst: false })
      .order("created_at")
      .order("id")
      .limit(DATASTORE_MAX_ROWS)
      .returns<TaskRow[]>();
    if (error) {
      if (error.code === "42501" || error.code === "PGRST301") return [];
      throw new Error(`listTasks failed: ${error.message}`);
    }
    return boundedTasks("listTasks", data ?? []);
  },

  async listOverdueTasks(today: string): Promise<Task[]> {
    const { data, error } = await client()
      .from("task")
      .select(TASK_COLUMNS)
      .eq("done", false)
      .lt("date", today)
      .order("date")
      .order("created_at")
      .order("id")
      .limit(DATASTORE_MAX_ROWS)
      .returns<TaskRow[]>();
    if (error) {
      if (error.code === "42501" || error.code === "PGRST301") return [];
      throw new Error(`listOverdueTasks failed: ${error.message}`);
    }
    return boundedTasks("listOverdueTasks", data ?? []);
  },

  // NO `member_id` IN THE INSERT: the column is not in the insert grant and takes `auth.uid()`.
  async createTask(input: CreateTaskInput): Promise<Result<Task>> {
    const text = taskText(input.title, input.note);
    if (!text.ok) return { ok: false, error: text.error };
    const time = taskTime(input.timeOfDay);
    if (!time.ok) return { ok: false, error: time.error };
    if (taskDatePast(input.date)) {
      return { ok: false, error: { code: "task_date_past", message: TASK_DATE_PAST } };
    }
    const { data, error } = await client()
      .from("task")
      .insert({ date: input.date, title: text.title, note: text.note, time_of_day: time.timeOfDay })
      .select(TASK_COLUMNS)
      .single<TaskRow>();
    if (error) return { ok: false, error: toTaskFailure(error) };
    return { ok: true, value: toTask(data) };
  },

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Result<Task>> {
    const text = taskText(input.title, input.note);
    if (!text.ok) return { ok: false, error: text.error };
    const time = taskTime(input.timeOfDay);
    if (!time.ok) return { ok: false, error: time.error };
    return updateTaskRow(taskId, { title: text.title, note: text.note, time_of_day: time.timeOfDay });
  },

  async moveTask(taskId: string, date: string): Promise<Result<Task>> {
    if (taskDatePast(date)) {
      return { ok: false, error: { code: "task_date_past", message: TASK_DATE_PAST } };
    }
    return updateTaskRow(taskId, { date });
  },

  async setTaskDone(taskId: string, done: boolean): Promise<Result<Task>> {
    return updateTaskRow(taskId, { done });
  },

  // ZERO ROWS BACK IS A REFUSAL, `deleteEvent`'s shape.
  async deleteTask(taskId: string): Promise<Result<void>> {
    const { data, error } = await client()
      .from("task")
      .delete()
      .eq("id", taskId)
      .select("id")
      .returns<{ id: string }[]>();
    if (error) return { ok: false, error: toTaskFailure(error) };
    if (!(data ?? [])[0]) {
      return { ok: false, error: { code: "task_not_permitted", message: TASK_NOT_PERMITTED } };
    }
    return { ok: true, value: undefined };
  },
};
