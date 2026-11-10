// Domain types. Shared and importable from any layer (.ai/standards/architecture.md, "Layers") —
// they live outside src/lib/data/ precisely so a component can hold a Member without importing the
// seam and tripping the RULE-02 lint rule.
//
// Every name here comes from 02-design.md section 1.1 or from .ai/standards/data-model.md. RULE-04:
// nothing is invented at implementation time.

import avatarImages from "virtual:avatar-images";

/**
 * The three ranks, **in rank order** — `.ai/standards/rbac-and-security.md` § *Roles*.
 *
 * `manager` was added 2026-09-12 by ADR-035 and adds exactly ONE power to `member`: approving or
 * rejecting ANOTHER member's entry. Not their own, and nothing else.
 *
 * **THE SHAPE TO WATCH FOR WHEN READING THIS TYPE'S CALLERS IS `role !== "admin"` USED TO MEAN "AN
 * ORDINARY MEMBER".** That test was exhaustive while there were two ranks and silently admits a
 * manager now. Every site in `src/` was read when this value was added; a new one should say which
 * of the two questions it is asking — *may this person administer* or *may this person decide*.
 */
export type MemberRole = "member" | "manager" | "admin";

/** A row of `public.member`, in application casing. */
/**
 * SOLO, 2026-09-10. Where a signed-up person stands with the admins.
 *
 * Three values and not a boolean, for the reason the migration records: `pending` and `rejected` are
 * different answers, and folding them makes a rejected person indistinguishable from one still
 * waiting on the screen that lists them.
 */
export type MemberStatus = "pending" | "approved" | "rejected";

export interface Member {
  id: string; // = the Supabase Auth user id (data-model.md)
  /**
   * **NULL UNTIL AN ADMIN APPROVES THEM — SOLO, 2026-09-10.** It was `string` while joining went
   * through the allow-list, because the team came from the consumed row (ADR-009). The operator
   * chose "the admin picks the team at approval" when asked, so at sign-up there is nothing to put
   * here.
   *
   * **INV-07 IS NOT WEAKENED BY THIS.** It says an ENTRY is counted only against the team its member
   * belongs to; a member with no team has no entries, because `entry_insert_own` is keyed on
   * `member_team_id`, which returns null for anybody not `approved`.
   */
  teamId: string | null;
  displayName: string;
  avatar: string;
  /**
   * SOLO, 2026-09-12. The account's address, COPIED onto the member row by
   * `20260912120000_solo_member_email.sql` — GoTrue owns the authoritative one and `auth` is not
   * reachable from the browser, so this is the only place a screen can read it from.
   *
   * **NULL MEANS THE SYNC HAS NOT RUN FOR THIS ROW, NOT THAT THE ACCOUNT HAS NO ADDRESS.** Every
   * account has one; the copy can lag by a write on a path the migration's trigger did not cover, so
   * the screens render a dash rather than an empty cell that reads as an account without an address.
   *
   * **IT IS DISPLAY DATA AND IS NEVER AN IDENTITY.** Nothing signs in, matches or authorises on this
   * field — `auth.users.email` is what does all three. The migration's header carries the privacy
   * consequence of the copy existing at all.
   */
  email: string | null;
  role: MemberRole;
  /**
   * SOLO, 2026-09-10. **DISPLAYED AND ACTED ON, unlike `role`** — this one really does decide what a
   * caller may do, but it decides it IN THE DATABASE and not here: `public.member_team_id` returns
   * null for anything but `approved`, and every row-level policy in the product is keyed on that
   * function. Reading this field in a component chooses a SCREEN; it grants nothing.
   */
  status: MemberStatus;
  /**
   * SOLO, 2026-09-10. When GoTrue last saw them, copied onto this row by a trigger on
   * `auth.users` — `auth` is not exposed through PostgREST, so the browser cannot read the original.
   *
   * **NULL MEANS NEVER, NOT UNKNOWN.** An account that has signed in has a GoTrue timestamp, and the
   * migration backfills every one that existed when it ran.
   *
   * DISPLAY ONLY. No policy, trigger or count consults it; a stale value makes a cell say the wrong
   * date and grants nobody anything.
   */
  lastSignInAt: string | null; // ISO 8601
  removedAt: string | null; // ISO 8601, null means active
  createdAt: string; // ISO 8601
}

/** The authenticated identity. Never the member; the two are separate on purpose (AC-5). */
export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
}

/**
 * TEA-05, 01-plan.md section 4.1. The three states a caller can be in, and they are three rather
 * than two on purpose: "signed in" and "on a team" are different facts, and ADR-009 creates people
 * who are the first without being the second.
 *
 * TEA-01's design reserved this union for the sign-in half rather than defining it with no consumer
 * (02-design.md:160-163). This is that consumer: `useSession` resolves to exactly one of these and
 * `App.tsx` routes on it.
 */
export type Membership =
  | { state: "signed-out" }
  | { state: "member-less"; user: AuthUser }
  /**
   * SOLO, 2026-09-10. Signed in, HAS a member row, and an admin has not decided yet — or has
   * decided against them. A fourth state and not a variant of `member-less`, because the two are
   * different facts and the screens that follow from them are different sentences: `member-less` is
   * *the datastore has no row for you*, this is *you are in the queue*.
   *
   * The DECISION is not this state's to make. `member_team_id` already refuses everything to
   * anybody who is not `approved`; routing on this only chooses which true sentence to show.
   */
  | { state: "undecided"; user: AuthUser; member: Member }
  | { state: "member"; user: AuthUser; member: Member };

/** Expected failures are returned, not thrown (.ai/standards/coding-standards.md, Error handling). */
export type FailureCode =
  | "invalid_credentials"
  | "email_already_registered"
  | "weak_password"
  | "rate_limited"
  | "network"
  // TEA-02, 02-design.md section 1.1. The allow-list's two refusal codes stood here until MIR-09
  // removed the table they described, whole — see `invalid_threshold` below, added the same ticket.
  | "not_permitted" // AC-4, AC-8: the policy refused the write
  // TEA-05, 01-plan.md section 4.1. AC-3: an account that exists and has not confirmed its address.
  // Kept out of `invalid_credentials` deliberately — folding the two would send somebody to reset a
  // password that is correct. Verified on disk: the code is in
  // @supabase/auth-js@2.112.4/dist/module/lib/error-codes.d.ts.
  | "email_not_confirmed"
  // SOLO, 2026-09-10. GoTrue's `email_address_invalid`, which a HOSTED project returns for an
  // address it considers undeliverable — an unregistered domain, or one with no MX record. It was
  // landing in `unknown` and rendering "Something went wrong", which sends somebody to retry an
  // address that will never be accepted.
  | "email_address_invalid"
  // CAL-01, 01-plan.md section 4.1. The three expected failures of creating an entry.
  | "overlapping_entry" // AC-7: INV-01's exclusion constraint refused the write (SQLSTATE 23P01)
  | "invalid_date_range" // AC-9: end_date is before start_date
  // AC-10, AC-11: the insert policy or a withheld column privilege refused the write. NOT
  // `not_permitted`: that code's message is written about the allow-list, and one code carrying two
  // sentences is how a wrong message reaches a screen.
  | "entry_not_permitted"
  // SOLO, 2026-09-11. `renameTeam` was given a name that is empty once trimmed. The column is
  // `not null` and a not-null column accepts `''` happily, so without this the product would show a
  // team with no name everywhere it draws one.
  //
  // NOT `not_permitted`, which means the policy refused the caller. This one means the caller is
  // allowed and the value is not — a different sentence for the screen to show, and beside a
  // different control.
  | "empty_team_name"
  // SOLO, 2026-09-11 — many teams. `delete_team` refused because people still name the team: an
  // active member, or a REMOVED one kept for history (ADR-013) — `member.team_id` is
  // `on delete restrict`. NOT `not_permitted`: the caller is allowed and the team is not empty, and
  // the sentence says what that means.
  | "team_not_empty"
  // SOLO, 2026-09-11. The insert or the delete on `public.busy_day` was refused by its policy — a
  // caller with no team, a removed member, or somebody's date that is not their own.
  //
  // NOT `entry_not_permitted`: a busy day is not an entry, and that code's message is written about
  // one. One code carrying two sentences is how a wrong message reaches a screen.
  | "busy_not_permitted"
  // ADM-03, 01-plan.md section 4.1. AC-6, AC-7: `unique (date)` refused the write (SQLSTATE 23505).
  //
  // A SEPARATE CODE FROM EVERY OTHER 23505 THIS SEAM MAPS, each of whose message names a different
  // thing. One code carrying two sentences is how a wrong message reaches a screen — the reason
  // CAL-01 gave for `entry_not_permitted`, applied to the constraint rather than to the policy.
  //
  // THERE IS NO `holiday_not_permitted` BESIDE IT. The policy refusal reuses `not_permitted` with a
  // sentence written at its own call site, which is what `removeMember`, `promoteMember` and
  // ADM-01's `setOverloadThreshold` all do; CAL-01's contrary precedent turned on a shared constant
  // message, which is not the shape here.
  | "holiday_date_taken"
  // ADM-05, 01-plan.md section 4.1. Clause (a) of `public.entry_enforce_decision()` refused the
  // write: somebody who is not an admin tried to move a decision column. It arrives as SQLSTATE
  // 42501, which PostgREST answers as 403.
  //
  // NOT `entry_not_permitted`, which is the code CAL-01 and CAL-02 map for a policy refusal and
  // whose sentence is written about creating and editing. One code carrying two sentences is how a
  // wrong message reaches a screen — CAL-01's own reasoning for keeping this code out of
  // `not_permitted`, applied one layer further in. The distinction is real and not cosmetic: a
  // filtered row means "not yours to touch", and 42501 here means "yours, but not this column".
  | "entry_decision_not_permitted"
  // SOLO 2026-09-10, the profile screen. Three codes and not one, because the three refusals reach
  // three different controls: `wrong_password` belongs beside the current-password box and NEVER
  // beside the new one, and the other two belong beside the field whose value was refused. A single
  // `not_permitted` here would put every message under the save button, where a member cannot see
  // which of four inputs to fix.
  //
  // `weak_password` above is REUSED for a new password that is too short — GoTrue raises exactly
  // that code and the sentence already reads correctly on this screen, so a second code for the same
  // condition would be two names for one fact.
  | "wrong_password" // the current password given does not match the account
  | "invalid_display_name" // blank after trimming, or longer than the column allows
  | "invalid_avatar" // not one of AVATAR_CHOICES
  // ADM-05, AC-3. INV-03 refused: a rejection with no reason. Raised in the SEAM before the write is
  // issued, so the interface never meets the raw 23514 the biconditional check would answer with —
  // the shape ADR-016 section 4 gives `reject_entries`, which raises 22023 with a sentence for the
  // same reason. The CHECK CONSTRAINT is still the control; this is the sentence.
  | "rejection_reason_required"
  // ADM-06, AC-4. A batch with nothing in it, refused in the SEAM before a request is issued.
  //
  // It is a refusal rather than a no-op because `update ... where id = any('{}')` succeeds and
  // changes nothing, so an empty batch would otherwise report `{ requested: 0, rejected: 0 }` —
  // ok:true on a write that never happened, which is the exact fail-quiet shape this whole ticket
  // exists to make visible. NOT `rejection_reason_required`: the two refusals name different missing
  // things and one code carrying two sentences is how a wrong message reaches a screen (CAL-01's
  // reasoning, applied a third time).
  | "no_entries_selected"
  // SOLO, 2026-09-26 — the report form. The message is blank once trimmed, or longer than
  // `issue_report_message_length` allows. Raised in the SEAM before the request is issued, so the
  // interface never meets the raw 23514 the two check constraints would answer with — the shape
  // ADM-05's `rejection_reason_required` gives the same class of refusal, for the same reason: the
  // CHECK is still the control and this is the sentence.
  //
  // NOT `not_permitted`, which means the policy refused the caller. This one means the caller is
  // allowed and the value is not, and the message belongs beside the text box rather than under the
  // send button — `empty_team_name` above draws the same distinction in the same words.
  | "invalid_issue_message"
  // SOLO, 2026-09-26 (second run) — the optional images. Too many, too large, or a type the bucket
  // does not accept. Raised in the SEAM before anything is uploaded, so a person is told before five
  // megabytes leave their machine rather than after.
  //
  // **ONE CODE FOR THREE CONDITIONS, AND THE SENTENCE IS WRITTEN AT THE CALL SITE** — the shape
  // `not_permitted` has carried since TEA-02 and `holiday_date_taken`'s docblock explains. The rule
  // this file states for splitting a code is that the two refusals reach DIFFERENT CONTROLS; these
  // three all reach the same file input, so three codes would be three names for one place.
  //
  // NOT `invalid_issue_message`: that one belongs beside the text box and this one beside the
  // attachments, and a screen showing either message under the wrong control is the exact failure
  // the profile screen's three codes were split to avoid.
  | "invalid_issue_image"
  // EVT-01. The name is empty once trimmed — AC-2. `event_name_present` (23514).
  | "empty_event_name"
  // EVT-01. End before start — AC-3. `event_dates_ordered` (23514). Not `invalid_date_range`,
  // whose sentence is written about entries.
  | "invalid_event_dates"
  // EVT-01. A named person is not an approved member — AC-11. Raised by `save_event` as 22023.
  | "invalid_event_invitee"
  // EVT-01. A policy or a withheld column refused the write, or the row is not the caller's to
  // change — AC-4, AC-17. 42501, or an update/delete that touched zero rows.
  | "event_not_permitted"
  // EVT-02. Capacity is not a whole number ≥ 1 — AC-2. `event_capacity_positive` (23514).
  | "invalid_event_capacity"
  // EVT-02. Deadline after the end date — AC-3. `event_deadline_by_end` (23514).
  | "invalid_event_deadline"
  // EVT-02. Capacity below seats taken — AC-4. `event_capacity_guard` (EV003).
  | "event_capacity_below_attendees"
  // EVT-02. No seat — AC-8, AC-9. `event_attendance_guard` (EV001).
  | "event_full"
  // EVT-02. Registration is closed — AC-10, AC-15. `event_attendance_guard` (EV002), or a
  // withdrawal the delete policy filtered once registration closed.
  | "event_registration_closed"
  // EVT-02. The caller already has an attendance of any state — AC-13, AC-19. 23505.
  | "already_on_event"
  // EVT-02. Not a transition the guard allows — AC-16, AC-17. 22023.
  | "invalid_attendance_change"
  // EVT-02. A policy refused, or the write touched zero rows — AC-11, AC-20. 42501. Never
  // confirms that the event exists.
  | "attendance_not_permitted"
  // EVT-07. Name blank after trimming, or over GUEST_NAME_MAX — AC-4. `register_guest` (EV006).
  | "invalid_guest_name"
  // EVT-07. Email over GUEST_EMAIL_MAX or not GUEST_EMAIL_PATTERN — AC-4. `register_guest` (EV007).
  | "invalid_guest_email"
  // EVT-07. That email already has a registration on this event, in any state — AC-5, AC-9. 23505.
  | "guest_already_registered"
  // EVT-07. The guest link is not an open event's — AC-8. `register_guest` (EV004). One sentence for
  // every cause.
  | "guest_link_not_found"
  // EVT-07. The manage token matches no registration — AC-13. `cancel_guest_registration` (EV005).
  | "guest_registration_not_found"
  // EVT-08. Nothing entered, or an address over GUEST_EMAIL_MAX or not GUEST_EMAIL_PATTERN — AC-10.
  // `invite_to_event` (EV008). The whole submission is refused.
  | "invalid_invitation_email"
  // EVT-08. The event is not public-scope — AC-4. `invite_to_event` (EV009).
  | "invitation_not_public"
  // EVT-11. The description is over DESCRIPTION_MAX_BYTES as UTF-8 — AC-6.
  // `event_description_bounded` (23514).
  | "description_too_large"
  // EVT-11. The picked file is not an accepted picture, too large, or would not decode — AC-4.
  // Raised by `downscaleToDataUrl` in the browser; never by the datastore.
  | "description_image_refused"
  // TSK-01. Title empty once trimmed, or over TASK_TITLE_MAX — AC-8. Refused in the SEAM before the
  // request; `task_title_shape` (23514) is the control.
  | "invalid_task_title"
  // TSK-01. Note over TASK_NOTE_MAX once trimmed — AC-8. `task_note_shape` (23514) is the control.
  | "invalid_task_note"
  // TSK-06. A time that is not "HH:MM" on a 24-hour clock — AC-4. Refused in the SEAM before the
  // request; the `time` type and `task_time_of_day_shape` (23514) are the control.
  | "invalid_task_time"
  // TSK-01. A create or a move to a date before today in Asia/Ho_Chi_Minh — AC-7, AC-11. Refused in
  // the SEAM only; the database holds no date floor (01-plan.md § 1 decision 2).
  | "task_date_past"
  // TSK-01. 42501, no session, or a write that touched zero rows — AC-17, AC-18. Never confirms that
  // the task exists.
  | "task_not_permitted"
  | "invalid_threshold" // MIR-09: overload_threshold outside [0, 1], or not finite (SQLSTATE 23514)
  | "unknown";

export interface Failure {
  code: FailureCode;
  message: string; // already in the conversation language; safe to render
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };

/** SOLO, 2026-09-10. `AllowedEmail` and `AddAllowedEmailInput` stood here until the allow-list was
 *  removed whole — table, policies, seam and screen. TEA-02 is superseded; joining is now sign-up
 *  plus an admin decision on `Member.status`. The names are recorded here, retired, because a name
 *  nothing mentions is a name somebody re-adds. */


/**
 * SOLO, 2026-09-10. What an admin decides about a person who has signed up.
 *
 * `teamId` is required on an approval and forbidden on a rejection, which is the shape
 * `member_decide_admin`s `with check` enforces in the database. The union makes that unrepresentable
 * rather than merely checked.
 */
export type MemberDecision =
  | { approve: true; teamId: string }
  | { approve: false };

/**
 * The avatar set offered at sign-up (AC-8) and on the profile screen.
 *
 * **SOLO, 2026-09-13 — IT IS THE CONTENTS OF `public/images/`, AND THE THIRTY-TWO EMOJI ARE GONE.**
 * Operator's instruction: the list comes from that folder and `member.avatar` stores the image's
 * file name, with its extension (`12.png`). `vite.config.ts` reads the folder when the app is built
 * and `src/lib/avatars.ts` filters it to image files and orders it numerically. Every existing row
 * was moved to `DEFAULT_AVATAR` by `20260913090000_solo_avatar_images.sql`, so no emoji value is
 * left to keep offering.
 *
 * **IT CAN BE EMPTY**, and nothing breaks when it is: every avatar draws the neutral placeholder in
 * `src/components/Avatar.tsx`, and sign-up sends `DEFAULT_AVATAR` instead of blocking.
 *
 * **REMOVING A FILE FROM THE FOLDER IS STILL THE FAILURE MODE TO WATCH.** A member whose saved name is
 * no longer in this list renders the default, and may keep that value on save — the *keep what you
 * have* clause in both seam implementations — but cannot choose it again once they move away.
 */
export const AVATAR_CHOICES: readonly string[] = avatarImages;

export { DEFAULT_AVATAR } from "../avatars";

// ---------------------------------------------------------------------------
// BUG-002. 01-plan.md section 4.2.
//
// The cap the five ceilings below are all written against. It sits ABOVE the first of them because
// each one's validity is a statement about this number, and until BUG-002 the number appeared
// nowhere in the tree — which is how two ceilings drifted above it with nothing to notice.
// ---------------------------------------------------------------------------

/**
 * The most rows a single request may return, whatever a query asks for.
 *
 * NOT a choice this repository makes, and not a threshold anyone here may tune: PostgREST caps a
 * response and Supabase projects ship that cap at 1000. The figure is documented in the installed
 * client's own types — @supabase/postgrest-js, the `select()` remarks: "By default, Supabase
 * projects return a maximum of 1,000 rows."
 *
 * CITED BY PACKAGE AND NOT BY LINE NUMBER. The declaration file lives at a pnpm store path carrying
 * the package version, so a line citation goes stale at the next dependency bump — the same class of
 * staleness this ticket exists to fix.
 *
 * A ceiling ABOVE this cannot be reached, so its `rows.length >= LIMIT` assertion is unreachable and
 * the server's silent truncation happens first. A ceiling EQUAL to it is reached exactly when the cap
 * is — which is why `HOLIDAY_LIMIT` is correct at 1000 and why tests/row-limits.test.ts asserts `<=`
 * rather than `<`.
 *
 * The limit of what this constant buys is recorded rather than papered over: it is a figure this
 * repository asserts, not the value the project actually serves. Nothing in the tree can read the
 * real setting — the anon key cannot, and ADR-024 declined a drift detector. Lowering the project's
 * own `max-rows` below 1000 puts the ceilings wrong again with this test still passing. 01-plan.md
 * section 2, Open questions item 3.
 */
export const DATASTORE_MAX_ROWS = 1000;

// ---------------------------------------------------------------------------
// TEA-03. 02-design.md section 1.1.
// ---------------------------------------------------------------------------

/**
 * AC-8. The explicit row limit the roster read asks for, and the count at which it refuses to
 * answer. Above any plausible team size — the glossary records exactly one team in v1 and the
 * brief's worked example is ten people — and deliberately far below the datastore's own cap, so
 * that this assertion fires before the server's silent one does.
 *
 * It lives here and NOT in src/lib/data/index.ts because both implementations need it at RUNTIME.
 * They already import types from `./index`, and those imports are erased at build; a runtime import
 * would not be, and `index.ts` imports both implementations — that is a real cycle at load time.
 * This module imports nothing from src/lib/data/.
 *
 * The constant's validity has one external dependency, cited rather than re-raised: the assertion
 * only fires if this number does not EXCEED the datastore's own `max-rows` cap. That cap is no
 * longer unknown — BUG-002 named it as DATASTORE_MAX_ROWS above, and tests/row-limits.test.ts holds
 * this ceiling and the four below it against it. 500 is far under it and was never at risk.
 */
export const ROSTER_LIMIT = 500;

// ---------------------------------------------------------------------------
// CAL-01. 01-plan.md section 4.1.
//
// Every name below is .ai/standards/data-model.md's or ADR-011's, in the application casing this
// file already uses. Nothing here is invented (RULE-04).
// ---------------------------------------------------------------------------

/** `entry_type` in the datastore. A WFH member IS working - glossary.md calls this the single most
 *  costly confusion in the domain. */
export type EntryType = "pto" | "wfh";

/** `entry_portion`. One value per entry, applying to every date in the range (INV-06). */
export type EntryPortion = "full" | "am" | "pm";

/** `entry_status`. Independent of `tentative` - glossary.md keeps the two axes apart deliberately. */
export type EntryStatus = "pending" | "approved" | "rejected";

/**
 * A row of `public.entry`, in application casing.
 *
 * `date_range` and `portion_slots` are DELIBERATELY ABSENT. ADR-011 creates them as stored generated
 * columns and says they are never written; they exist for the exclusion constraint and for
 * PostgREST's `date_range=ov.…` filter, both of which live inside the seam. Surfacing them here
 * would put a PostgreSQL range literal above the seam, which architecture.md's "Layers" forbids, and
 * would put a second representation of the same three fields in reach of a component - where
 * ADR-011's canonicalisation footgun (a one-day entry reads back as `[d, d+1)`) would be read as
 * "the entry ends the following day". The seam may name them; nothing above it may.
 */
export interface Entry {
  id: string;
  memberId: string;
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd. Never a Date - see 01-plan.md section 4.5.
  endDate: string; // yyyy-MM-dd, INCLUSIVE. Equal to startDate for a single day.
  tentative: boolean;
  status: EntryStatus;
  rejectionReason: string | null;
  note: string | null;
  approvedBy: string | null;
  approvedAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * The explicit row limit `listOwnEntries` asks for, and the count at which it refuses to answer.
 * Same shape and same reasoning as ROSTER_LIMIT (TEA-03): it must not EXCEED the datastore's own
 * `max-rows` cap, or the server's silent truncation happens before this assertion can fire. A
 * truncated read here is a member being told an entry they created does not exist.
 *
 * The cap it is written against is DATASTORE_MAX_ROWS, named above by BUG-002 and asserted by
 * tests/row-limits.test.ts. 500 is far under it and was never at risk.
 */
export const OWN_ENTRY_LIMIT = 500;

// ---------------------------------------------------------------------------
// CAL-03. 01-plan.md section 4.1.
// ---------------------------------------------------------------------------

/**
 * The explicit row limit `listTeamEntries` asks for, and the count at which it refuses to answer.
 *
 * SEPARATE from OWN_ENTRY_LIMIT rather than shared with it, for the same reason ROSTER_LIMIT is its
 * own constant: a team's entries outnumber one member's, and the two numbers move for different
 * reasons. One constant serving both would be raised for whichever pressed first and would silently
 * move the other.
 *
 * It must not EXCEED the datastore's own `max-rows` cap or the assertion never fires and the
 * server's silent truncation happens first. A short list here hides entries from the one person able
 * to correct them, which is worse than an error and is what this limit exists to turn into one.
 *
 * IT WAS 2000, AND 2000 IS ABOVE THE CAP — BUG-002. The read asked for 2000, the datastore returned
 * at most 1000, so `rows.length >= 2000` at the call site could never be true: the read came back
 * short, came back as a SUCCESS, and was summed. Lowering it to DATASTORE_MAX_ROWS costs no row that
 * was ever being fetched — the datastore never returned more than 1000 anyway — and turns a silent
 * truncation into the error this limit exists to raise. 1000 is not a guess about a real team's row
 * count; it is the LARGEST value this ceiling can take and still be reachable.
 *
 * WRITTEN AS A LITERAL AND NOT AS DATASTORE_MAX_ROWS, deliberately. The two numbers are equal today
 * for a reason, not by definition: this is a product ceiling that happens to sit at the largest
 * reachable value, and binding it to the cap would make a future change to the cap silently move a
 * product threshold while tests/row-limits.test.ts passed vacuously. Kept separate, that same change
 * makes the test NAME this constant — which is the whole mechanism BUG-002 adds.
 */
export const TEAM_ENTRY_LIMIT = 1000;

// ---------------------------------------------------------------------------
// CAL-04. 01-plan.md section 4.
//
// Every name below is .ai/standards/data-model.md's or the plan's contract, in the application
// casing this file already uses. Nothing here is invented (RULE-04).
// ---------------------------------------------------------------------------

/** The caller's own team. One row in v1; `data-model.md` section team. */
export interface Team {
  id: string;
  name: string;
  /** The Threshold. A SHARE, not a count. Compared with `>`, never `>=` — INV-04, AC-7. */
  overloadThreshold: number;
  /**
   * SOLO, 2026-09-11. `wfh_need_approve` — the operator's own name, `WFH_NEED_APPROVE`. When `false`,
   * a NEW WFH entry is stored already `approved`, with `approvedBy` null because no member decided it.
   * The datastore does that and this flag only reports it: `src/lib/data/approval.ts` says why the
   * application could not.
   */
  wfhNeedApprove: boolean;
  /** SOLO, 2026-09-11. `pto_need_approve` — the same switch for PTO, independent of the one above. */
  ptoNeedApprove: boolean;
  createdAt: string; // ISO 8601
}

/**
 * Both ends INCLUSIVE, matching `Entry.endDate` and ADR-011's `'[]'` constructor.
 *
 * It is two `yyyy-MM-dd` strings and never two `Date`s, for the reason `Entry` already records:
 * `new Date('2026-04-30')` parses as UTC midnight and a day-of-month read west of UTC yields the
 * previous day.
 */
export interface DateRange {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

/**
 * The explicit row limit `listTeamEntriesOverlapping` asks for, and the count at which it refuses to
 * answer.
 *
 * Same shape and same reasoning as TEAM_ENTRY_LIMIT: it must not EXCEED the datastore's own
 * `max-rows` cap so a truncated read is detectable here rather than invisible. A month of one team
 * cannot approach it; the number exists so AC-11 has something to assert against, and AC-11 matters
 * more here than on any earlier read — a capped read SUMS what it was given and produces a
 * believable wrong count with no error anywhere, and on this screen the count is the product.
 *
 * SEPARATE from TEAM_ENTRY_LIMIT rather than shared with it, for the reason ROSTER_LIMIT is its own
 * constant: the two reads are bounded by different things — a whole team's entries against one
 * month's — and one constant serving both would be raised for whichever pressed first and would
 * silently move the other.
 *
 * IT WAS 2000, AND IT GOVERNS THREE OF THE FOUR CALENDAR SCREENS — BUG-002. `YearView`, `MonthView`
 * and `WeekView` all read through `listTeamEntriesOverlapping`, so this constant and not
 * TEAM_ENTRY_LIMIT is the one the year read runs against, and the year read is the largest
 * legitimate row count in the product. Above the cap its assertion could never fire; at
 * DATASTORE_MAX_ROWS it fires, and no read loses a row it was previously getting.
 *
 * ONE CONSEQUENCE IS RECORDED RATHER THAN HIDDEN: a large team's year view CAN legitimately exceed
 * 1000 rows, and after this change it sees a refusal instead of a silently short year. That is what
 * CAL-06 AC-14 requires and is strictly better than a believable wrong calendar, but it is a
 * refusal, not a calendar. The answer is explicit paging with `range()` — pre-authorised by CAL-04's
 * plan and ADR-015, and the ticket that follows this one. 01-plan.md section 2, Open questions
 * item 2.
 *
 * A LITERAL AND NOT DATASTORE_MAX_ROWS, for the reason recorded on TEAM_ENTRY_LIMIT above.
 *
 * CAL-09 RETIRED ITS ONLY READER AND LEFT THE CONSTANT STANDING. The ticket that follows this one,
 * promised two paragraphs above, is CAL-09, and it took the paging answer: `listTeamEntriesOverlapping`
 * now assembles windows of TEAM_ENTRY_PAGE_SIZE rows and refuses what it cannot prove complete, so
 * nothing reads this value any more. It is NOT deleted, and that is a decision rather than an
 * oversight — six files outside CAL-09's `allowed_paths` still name it in comments
 * (src/routes/YearView.tsx, src/routes/WeekView.tsx and the four tests/e2e/cal-0*.spec.ts headers),
 * and putting four route and end-to-end files into a ticket for comment-only edits is worse than one
 * honest paragraph here. Removing it is a chore, and this sentence is what a later reader needs in
 * order to know the constant is dead rather than merely quiet. tests/row-limits.test.ts keeps
 * asserting it: the row is now vacuously true, and deleting it would edit BUG-002's list for no
 * property gained.
 */
export const MONTH_ENTRY_LIMIT = 1000;

/**
 * CAL-09. The window `listTeamEntriesOverlapping` reads in, and NOT a ceiling.
 *
 * The read pages and assembles; it does not truncate. Like PENDING_PAGE_SIZE and unlike the five
 * limits above it, this must sit strictly BELOW DATASTORE_MAX_ROWS so a page shortened by a lowered
 * cap is distinguishable from a full one.
 *
 * 500 rather than 50: this read serves the YEAR view, whose legitimate row count is the largest in
 * the product, and every sequential request is a round trip on the slowest screen in the app. At 500
 * the month, the week and the draft-entry warning are one request each, and a year is a small
 * handful. The cost is paid in the unit test, which must create 501 entries to cross a boundary —
 * arithmetic in a mock, not four minutes in a browser.
 */
export const TEAM_ENTRY_PAGE_SIZE = 500;

/**
 * CAL-09. The most requests one assembly may issue.
 *
 * A BOUND ON WORK, NOT A CEILING ON CORRECTNESS, and the difference is the whole point: exceeding it
 * cannot return a short array, because the completeness comparison refuses first. What it prevents
 * is an unbounded loop against a datastore that keeps answering.
 *
 * It does leave the product with a maximum, and that is stated rather than hidden: a range matching
 * more than TEAM_ENTRY_PAGE_SIZE * TEAM_ENTRY_MAX_PAGES entries is REFUSED. That figure is four
 * times the cap this ticket removes, and unlike the cap it is this product's own, named here, and
 * detected in the response rather than invisible in it.
 */
export const TEAM_ENTRY_MAX_PAGES = 8;

/**
 * The absence count for each date in a range. Keys are `yyyy-MM-dd`; EVERY date in the range is
 * present, including those with a count of 0 — a caller that had to distinguish "absent key" from
 * "zero" would be re-deciding INV-04's arithmetic at the call site.
 */
export type AbsenceCounts = ReadonlyMap<string, number>;

// ---------------------------------------------------------------------------
// CAL-05. 01-plan.md section 4.1.
//
// One shape, and it is beside `AbsenceCounts` because it is the third answer derived from the same
// pass: the count, the members, and — here — the members WITH the entry that puts them there.
// ---------------------------------------------------------------------------

/**
 * CAL-05. One absent person on one date, and the entry that puts them there.
 *
 * It is a domain shape rather than a seam one: `absentEntriesFor` builds it from rows the seam
 * already returns, and a component holds it without importing the seam
 * (.ai/standards/architecture.md, "Layers").
 *
 * BOTH HALVES, and not an entry carrying a display name. The week view draws the member (avatar,
 * display name) and the entry (type, portion, note, approver) side by side, and flattening the two
 * into one record would put a second representation of `Member` in reach of a component — the same
 * reason `Entry` does not carry `date_range`.
 */
export interface AbsenceDetail {
  entry: Entry;
  member: Member;
}

// ---------------------------------------------------------------------------
// SOLO, 2026-09-11 — the busy day.
//
// **A `BusyDay` IS NOT AN `Entry`, AND THAT IS THE WHOLE DESIGN.** A member marking a day busy is
// saying *I am at work and my hands are full* — the operator's words: *"task nhiều hoặc có plan sau
// ngày nghỉ chứ vẫn đi làm bình thường"*. The person is PRESENT. Four consequences follow, and each
// is why a third value on `EntryType` was refused rather than merely not chosen:
//
//   * **INV-04.** The absence count is *"the sum ... of 1 per `full` portion and 0.5 per `am` or
//     `pm`, with PTO and WFH counted alike"*, and that number drives the crowded-day warning. A busy
//     person added to it would make the product say the team is short-staffed on a day when nobody
//     is away. Excluding a third type from the sum instead would edit INV-04, which is
//     `.ai/registry/**` and needs a human and an ADR (RULE-01). A separate row and a separate number
//     touch it not at all — INV-04 forbids a SECOND DEFINITION OF THE ABSENCE COUNT, not a second
//     number about a day.
//   * **INV-02**, an approved entry returning to `pending` when it is edited. The operator asked for
//     no approval at all, so a busy day has no `status` to return to and nothing to revoke.
//   * **INV-01, INV-05, INV-06** are all statements about entries with portions, tentativeness and
//     ranges. A busy day has none: it is one member, one date, marked or not marked.
//   * **INV-07** holds by the same mechanism entries use — the row is reached through
//     `member_team_id`, so it is only ever counted against its member's team.
//
// `invariants_touched` for this work is `[]`, and that is an argued `[]` rather than an unfilled
// one: the shape was chosen so that it would be, and the paragraph above is the argument.
// ---------------------------------------------------------------------------

/**
 * A row of `public.busy_day`, in application casing. One member, one date, marked.
 *
 * **ONE DATE AND NOT A RANGE**, unlike `Entry`. The operator's request is *"mark ngày cụ thể nào
 * đó"* and the gesture they chose is a press on the day itself, so a range would be a shape with no
 * caller. Marking a run of days is five presses, and five rows, which is also what makes unmarking
 * one of them a single delete rather than a range split.
 *
 * **NO `status`, NO `tentative`, NO `portion`, NO `note`.** Each absence is the operator's decision
 * rather than an omission: no approval was asked for, a half-day of busy is not a distinction
 * anybody asked to draw, and a reason field is a thing to read that nobody committed to reading.
 * The row's whole content is that it exists.
 */
export interface BusyDay {
  id: string;
  memberId: string;
  date: string; // yyyy-MM-dd
  createdAt: string;
}

/**
 * How many members marked each date busy. Keys are `yyyy-MM-dd`; EVERY date in the range is present,
 * including those with a count of 0 — the same contract `AbsenceCounts` keeps, so a caller iterating
 * one map can index the other without a fallback.
 *
 * **IT IS A WHOLE NUMBER AND `AbsenceCounts` IS NOT.** An absence weighs 0.5 for a half day
 * (INV-06); a busy day has no portion, so this counts people and the two numbers are never added,
 * compared or drawn as one figure.
 */
export type BusyCounts = ReadonlyMap<string, number>;

// ---------------------------------------------------------------------------
// ADM-02. 01-plan.md section 4.1.
//
// Three additions and nothing existing changes shape — which is why this is not the "changes a
// shared type module" clause of .ai/01-operating-model.md:375: that clause is about a shape that
// ripples outward, and no existing caller must change. The precedent is direct — CAL-04 added
// `Team`, `AbsenceCounts` and `AbsenceDetail` to this file and was sized M.
// ---------------------------------------------------------------------------

/**
 * ADM-02. ADR-015 section 2. THE VALUES NAME THE EFFECT ON THE WORKING CALENDAR, NOT THE
 * VIETNAMESE LABEL — `name` already carries the label.
 *
 * `working` is a mandated Saturday: a weekend day the government turns into a working day, the
 * exact inverse of a holiday. A `holiday` row with `kind = 'working'` is a holiday that is not a
 * holiday, and ADR-015 records that naming smell rather than renaming the table: `holiday` is the
 * word glossary.md defines and the word rbac-and-security.md's permission row uses.
 */
export type HolidayKind = "non_working" | "working";

/** A row of `public.holiday`, in application casing. ADR-015 section 3. NO `teamId`: the calendar
 *  is national and there is no foreign key. */
export interface Holiday {
  id: string;
  date: string; // yyyy-MM-dd. Never a Date — see below.
  name: string;
  kind: HolidayKind;
  createdAt: string; // ISO 8601
}

/**
 * The explicit row limit `listHolidays` asks for, and the count at which it refuses to answer. Same
 * shape and same reasoning as ROSTER_LIMIT, OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT and
 * MONTH_ENTRY_LIMIT: it must not EXCEED the datastore's own `max-rows` cap so this assertion fires
 * before the server's silent one does.
 *
 * ADR-015 asks for "an explicit limit above the widest possible range (366 plus margin)". A
 * Vietnamese year carries on the order of fifteen rows, so 1000 is roughly sixty years of calendar
 * and comfortably above any range this screen can request.
 *
 * IT IS AT THE CAP, AND IT IS CORRECT THERE — BUG-002 changed it not at all. A ceiling EQUAL to
 * DATASTORE_MAX_ROWS is reached exactly when the cap is reached, and the comparison at the call site
 * is `>=` and not `>`, so its assertion already fires. That is why tests/row-limits.test.ts asserts
 * `<=` rather than `<`: a strictly-below test would force this working threshold down, and changing
 * a working threshold inside a bug fix is what 01-plan.md section 1 item 9 puts out of scope.
 *
 * ITS 1000 IS ALSO NOT THE CAP'S 1000. ADR-015 asks for a limit above the widest possible range —
 * 366 plus margin — and roughly sixty years of Vietnamese calendar is the reason this number is what
 * it is. That it coincides with DATASTORE_MAX_ROWS is a coincidence worth not encoding.
 */
export const HOLIDAY_LIMIT = 1000;

// `date` IS A STRING AND NEVER A `Date`, and on this table it is the difference between a correct
// and an incorrect feature. ADR-015 Consequences names the trap and predicts it will pass every test
// run in Vietnam: `new Date('2026-06-11')` parses as UTC midnight, and a weekday read west of UTC
// yields the previous day — so a Thursday holiday becomes a Wednesday and the bridge day moves. ICT
// is UTC+7 and CI is UTC, so it is correct in both and wrong for a developer in the Americas. Every
// comparison in this feature is on `yyyy-MM-dd` strings, which sort lexicographically, exactly as
// src/lib/data/absence.ts already does.

// ---------------------------------------------------------------------------
// CAL-08. 01-plan.md section 4.1.
//
// Two additions beside `Holiday`, and nothing existing changes shape — so no existing caller
// changes and this is not the "changes a shared type module" clause of
// .ai/01-operating-model.md:375. The precedent is direct and immediately above: ADM-02 added
// `HolidayKind`, `Holiday` and `HOLIDAY_LIMIT` here and was sized M, as CAL-04 was before it.
// ---------------------------------------------------------------------------

/**
 * CAL-08. Why a day is not a working day, when it is not one.
 *
 * `holiday` wins over `weekend` when a `non_working` row falls on a Saturday or a Sunday: the row is
 * the more specific fact and it carries a name to draw.
 */
export type NonWorkingReason = "weekend" | "holiday";

/**
 * CAL-08. The status of one date.
 *
 * NOT a flat `"working" | "weekend" | "holiday" | "bridge"` union. A bridge day IS a working day, and
 * a caller asking "is this a working day" must be able to read the answer without knowing that
 * `bridge` implies it — .ai/registry/features.md:95 states that as a requirement on this type.
 */
export interface DayStatus {
  date: string; // yyyy-MM-dd. Never a Date — the trap is named beside `Holiday.date` above.
  /** The one question every caller asks. True for a bridge day and for a mandated `working` Saturday. */
  working: boolean;
  /** Null EXACTLY when `working` is true. */
  nonWorkingReason: NonWorkingReason | null;
  /** The row on this date, of EITHER kind, or null when there is none. It carries the name to draw. */
  holiday: Holiday | null;
  /** Implies `working === true`. A bridge day is a working day and gets no lavender (glossary.md). */
  bridge: boolean;
}

/**
 * Every date in the requested range, present as a key including the ordinary ones — the contract
 * `AbsenceCounts` already keeps, so a caller iterating one map can index the other with no fallback.
 */
export type DayStatuses = ReadonlyMap<string, DayStatus>;

// ---------------------------------------------------------------------------
// ADM-04. 01-plan.md section 4.1.
//
// Three shapes and one constant, added at the end beside the five row limits above. Nothing existing
// changes shape, so no existing caller changes and the "changes a shared type module" clause of
// .ai/01-operating-model.md:375 is not engaged — the CAL-04, ADM-02 and CAL-08 precedent.
// ---------------------------------------------------------------------------

/**
 * Which side of `today` the worklist is asking for. 01-plan.md section 2, Open questions item 2:
 * `upcoming` is the default the screen opens on and `past` is the explicit filter that reaches the
 * entries nobody ever decided. They stay `pending` in every window — there is no fourth
 * `entry_status` and none is proposed.
 */
export type PendingWindow = "upcoming" | "past" | "all";

/** ADM-04. What the worklist is asking for. */
export interface PendingEntryQuery {
  /** `null` means both types. The type filter Open questions item 1's recommendation asks for. */
  type: EntryType | null;
  window: PendingWindow;
  /**
   * `yyyy-MM-dd`, SUPPLIED BY THE CALLER from its own clock and never read from the datastore's.
   *
   * "What day is it for the person looking at the screen" is a fact about their clock — the one
   * place a local date read is correct, which src/routes/MonthView.tsx already records for
   * `currentMonth()`. A server-side `current_date` would be evaluated in the datastore's timezone
   * and would flip the boundary seven hours early for a Vietnamese team. It is a parameter rather
   * than a module read so the filter is testable without a clock (AC-16).
   */
  today: string;
  /** 0-based. */
  page: number;
}

/**
 * ADM-04. One page of the worklist, AND the exact size of the set it was drawn from.
 *
 * ONE SHAPE FROM ONE READ, and that is the decision this type exists to hold. The feature row
 * requires that the outstanding count derive from an exact count and never from `data.length`, and
 * that the badge and the list not be able to disagree. Two seam calls — one counting, one listing —
 * can disagree, because a write can land between them. One response carrying both cannot.
 */
export interface PendingEntryPage {
  /** This page's rows, in the order 01-plan.md section 4.2 fixes. Never more than `pageSize`. */
  rows: Entry[];
  /** The EXACT number of entries matching the query, from the datastore. Never `rows.length`. */
  total: number;
  /** Echoed back, so a caller rendering a stale page cannot mislabel it. */
  page: number;
  pageSize: number;
}

/**
 * The worklist's page size, and the number the short-page assertion in both seam implementations is
 * written against.
 *
 * UNLIKE the five limits above it, this is NOT a refuse-above-this ceiling — it is a window, and the
 * read pages rather than truncating. It must still sit below the datastore's `max-rows`, and for the
 * first time in this file that number is known rather than deferred: the installed client documents
 * the platform default as 1000
 * (@supabase/postgrest-js@2.112.4/dist/index.d.mts:3522). 50 is far below it, and the short-page
 * assertion in both implementations detects a LOWERED cap without needing to know its value — which
 * is what the `TODO(verify)` markers on ROSTER_LIMIT, OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT,
 * MONTH_ENTRY_LIMIT and HOLIDAY_LIMIT were waiting for. This note asked for the BUG row that two of
 * those five needed; that row was BUG-002, all five markers are discharged above, and the figure now
 * has a name — DATASTORE_MAX_ROWS — and a test.
 */
export const PENDING_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// ADM-06. 01-plan.md section 4.1.
//
// One interface, added at the end beside ADM-04's three shapes. Nothing existing changes shape, so
// no existing caller changes and the "changes a shared type module" clause of
// .ai/01-operating-model.md:375 is not engaged — the CAL-04, ADM-02, CAL-08 and ADM-04 precedent.
// ---------------------------------------------------------------------------

/**
 * ADM-06. What a bulk rejection actually did.
 *
 * BOTH NUMBERS, and that is the whole reason this is a shape rather than a `number`. A row the policy
 * does not admit is FILTERED rather than errored, so a batch of eight can reject five and report
 * success; a caller holding only the count cannot tell that from a batch of five that rejected five.
 * `requested` is what was asked for and `rejected` is what the datastore says it changed, and the
 * screen is required to say both (AC-5, AC-18).
 */
export interface BulkRejectionOutcome {
  /** DISTINCT ids sent, after de-duplication in the seam (AC-6). Never the raw array length. */
  requested: number;
  /** `get diagnostics row_count` from `public.reject_entries`. NEVER derived from `requested`. */
  rejected: number;
}

// ---------------------------------------------------------------------------
// SOLO, 2026-09-26 — a member reports an issue; an admin reads the reports.
//
// Four types and one constant, added at the END beside every other feature's shapes. Nothing
// existing changes shape, so no existing caller changes — the CAL-04, ADM-02, CAL-08, ADM-04 and
// ADM-06 precedent, each recorded in the block above its own additions.
//
// The authority is the operator's four answers of 2026-09-26, transcribed in
// `supabase/migrations/20260926100000_solo_issue_report.sql`'s header. `CLAUDE.md` § No invention
// names database fields as the one thing an agent may not originate, which is why those four
// questions were asked before a line of this was written.
// ---------------------------------------------------------------------------

/**
 * What kind of thing is being reported. `public.issue_kind`.
 *
 * THREE AND NOT TWO: *other* exists so the picker never forces somebody to mis-file a report in
 * order to send it, which is the failure mode of a required category with no escape. It is the
 * DEFAULT the form opens on for the same reason — a person who does not care which of three it is
 * should be able to type and send.
 */
export type IssueKind = "bug" | "idea" | "other";

/**
 * Whether an admin has dealt with it. `public.issue_status`.
 *
 * **TWO VALUES, AND `done` DOES NOT MEAN FIXED.** It means an admin has read it and taken it off
 * their list. A third value — *wont_fix*, *duplicate* — is a triage vocabulary nobody asked for, and
 * the operator's answer was *"xem + đánh dấu đã xử lý"*, which is two states.
 */
export type IssueStatus = "open" | "done";

/** A row of `public.issue_report`, in application casing. NO `teamId`: a report is about the
 *  product, not about a team, which is the operator's fourth decision and the reason no policy
 *  below the seam carries a team predicate. */
export interface IssueReport {
  id: string;
  /** The author. Resolved from the session by the datastore's own `with check`, never from an
   *  argument the caller chose — see `CreateIssueReportInput`, which has no such field. */
  memberId: string;
  kind: IssueKind;
  message: string;
  /** The pathname the reporter was on, as the client sent it. A hint for whoever reads the report;
   *  nothing derives behaviour from it. */
  page: string;
  status: IssueStatus;
  createdAt: string; // ISO 8601
  /**
   * SOLO, 2026-09-26 (second run) — OBJECT PATHS IN THE `issue-report` BUCKET, NEVER URLS.
   *
   * The bucket is PRIVATE, so a path is not something a browser can load: it has to be exchanged for
   * a short-lived signed URL, which is what `issueImageUrls` is for. Storing the URL instead would
   * put a credential in a table row and a stale one in every read after it expired.
   *
   * Empty for a report sent without images, which is most of them — the operator asked for optional.
   */
  images: string[];
}

/**
 * What a person sends.
 *
 * **THERE IS NO `memberId`, AND THERE MUST NEVER BE ONE.** The row written is the caller's, resolved
 * inside the implementation from the session, so no argument exists that could aim this at somebody
 * else. That is the affordance `createEntry` uses for `member_id` and `updateOwnProfile` uses for
 * the whole row, and the reason both are shaped that way: a field a caller can set is a field a
 * caller can set to a stranger, and the policy then becomes the only thing standing there.
 *
 * **AND NO `status`.** A report arrives `open`, from the column default, and the insert grant does
 * not name the column — so neither this type nor a hand-written request can deliver one already
 * dealt with.
 */
export interface CreateIssueReportInput {
  kind: IssueKind;
  message: string;
  page: string;
  /**
   * SOLO, 2026-09-26 (second run). The files a person chose, if any. **`File` AND NOT A PATH OR A
   * DATA URL**: the seam is what uploads them, so nothing above the seam has to know there is a
   * bucket, and no component can be handed a half-finished upload to carry around.
   *
   * OPTIONAL, which is the operator's word — *"if they want"*. An omitted field and an empty array
   * mean the same thing and both are ordinary.
   */
  images?: File[];
}

/**
 * How many images one report may carry, how large each may be, and which types are accepted.
 *
 * **THE OPERATOR CHOSE THESE THREE NUMBERS ON 2026-09-26**, asked with their costs: three images at
 * five megabytes each, which is enough for a few screenshots of one fault and leaves a ceiling the
 * seam can refuse against instead of letting the datastore throw.
 *
 * **THEY ARE REPEATED IN THE MIGRATION'S CHECK CONSTRAINT AND IN THE BUCKET'S OWN LIMITS**, and both
 * copies have to move together. That is the same arrangement `ISSUE_MESSAGE_MAX` already has and for
 * the same reason: the datastore is the control, and this is what lets a person be told before a
 * five-megabyte upload leaves their machine rather than after.
 */
export const ISSUE_IMAGE_MAX_COUNT = 3;
export const ISSUE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** MIME types, not extensions: a file's name is the caller's and its type is the browser's. The
 *  bucket repeats this list in `allowed_mime_types`, which is the control. */
export const ISSUE_IMAGE_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

/**
 * The explicit row limit `listIssueReports` asks for, and the count at which it refuses to answer.
 * Same shape and same reasoning as ROSTER_LIMIT, HOLIDAY_LIMIT and the entry limits above: it must
 * not EXCEED DATASTORE_MAX_ROWS, so this assertion fires before the server's silent one does.
 *
 * **A TRUNCATED REPORT LIST IS A DIFFERENT KIND OF WRONG FROM A TRUNCATED CALENDAR**, and it is
 * worth saying which: no derivation reads this list, so nothing is computed incorrectly. What
 * happens is that a report somebody wrote is silently not shown to the person it was written for,
 * which is the whole feature failing quietly. Hence the same refusal rather than a softer one.
 */
export const ISSUE_REPORT_LIMIT = 500;

// ---------------------------------------------------------------------------
// EVT-01 — events. 01-plan.md section 4.1. ADR-045, ADR-046.
// ---------------------------------------------------------------------------

/** EVT-11. ADR-056 decision 5 — the database's `event_description_bounded` holds it. */
export const DESCRIPTION_MAX_BYTES = 1048576;
/** EVT-11. Accepted picker input; the stored picture is WebP or JPEG. */
export const DESCRIPTION_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const DESCRIPTION_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const DESCRIPTION_IMAGE_MAX_EDGE = 1200;

/** UTF-8 byte length, as PostgreSQL's `octet_length` counts it. Null is 0. */
export function descriptionBytes(html: string | null): number {
  return html === null ? 0 : new TextEncoder().encode(html).length;
}

/** EVT-01. Glossary *Event*. `named` is the glossary's "named people"; `team` is the creator's own
 *  team and never another (Q6). The values are the database enum's, verbatim. */
export type EventScope = "team" | "named" | "public";

/** EVT-01. Named `CalEvent`, not `Event`, because `Event` is the DOM global and shadowing it in
 *  every file that imports this one is a trap. */
export interface CalEvent {
  id: string;
  creatorId: string;
  /** The creator's team at creation, set by the database. Meaningful for `scope: "team"`; carried
   *  for every scope because it never changes and is the only team an event has. */
  teamId: string;
  name: string;
  /** Null, never "", when absent — AC-2. Null on `listEvents` and `listEventsForTeam` reads,
   *  which never carry it (ADR-056 decision 6). Read it through `getEvent`. */
  description: string | null;
  location: string | null;
  /** `yyyy-MM-dd`, inclusive both ends, as `Entry` does. */
  startDate: string;
  endDate: string;
  scope: EventScope;
  /** EVT-02. Glossary *Capacity*. Null is no limit; otherwise a whole number ≥ 1. */
  capacity: number | null;
  /** EVT-02. True: every join is a request the creator or an admin decides (Q22). */
  requiresApproval: boolean;
  /** EVT-02. `yyyy-MM-dd`, on or before `endDate`, or null — registration then runs to `endDate`. */
  registrationDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

/** EVT-01, ADR-045 point 4. THE NARROW PROJECTION: exactly these five fields, and never `role`,
 *  `status`, `removedAt`, `email` or anything else on `Member`. It is NOT a `Member` and must never
 *  be widened into one — the reason is INV-04's denominator. */
export interface DirectoryMember {
  id: string;
  displayName: string;
  avatar: string;
  teamId: string;
  teamName: string;
}

// ---------------------------------------------------------------------------
// EVT-02 — attendance. 01-plan.md section 4.1. ADR-045.
// ---------------------------------------------------------------------------

/** EVT-02. The four states of one person's standing on one event. The database enum's values,
 *  verbatim. Withdrawing deletes the row; there is no fifth state. */
export type AttendanceStatus = "pending" | "attending" | "rejected" | "removed";

/** EVT-02. One row of `public.event_attendance`, and nothing else — no name, avatar, team or role
 *  (AC-23). Names come from `listMemberDirectory()`. */
export interface EventAttendance {
  eventId: string;
  memberId: string;
  status: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// EVT-04 — notifications. 01-plan.md section 4.1. ADR-050.
// ---------------------------------------------------------------------------

/** EVT-04. The nine kinds, the database enum's values verbatim. (a) `event_created`; (b)
 *  `event_invited`; (c) `attendance_approved`, `attendance_rejected`, `attendance_removed`;
 *  (d) `event_updated`, `event_cancelled`; (e) `attendance_requested`, `attendance_withdrawn`. */
export type NotificationKind =
  | "event_created"
  | "event_invited"
  | "event_updated"
  | "event_cancelled"
  | "attendance_requested"
  | "attendance_withdrawn"
  | "attendance_approved"
  | "attendance_rejected"
  | "attendance_removed";

/** EVT-04. Glossary *Notification*. One row of `public.notification`. Named `EventNotification`, not
 *  `Notification`, because `Notification` is the DOM global — `CalEvent`'s reason. */
export interface EventNotification {
  id: string;
  /** Always the caller — the policy returns nothing else. Carried so the row is the table's shape. */
  recipientId: string;
  kind: NotificationKind;
  /** Null once the event is deleted (`event_cancelled` is written with null from the start). */
  eventId: string | null;
  /** The event's name when the notification was written. Survives the event's deletion. */
  eventName: string;
  /** Who caused it. Resolved to a name through `listMemberDirectory()`, or *Former member*. */
  actorId: string;
  createdAt: string;
  /** Null while unread. */
  readAt: string | null;
}

/** EVT-04, AC-16. The panel's window: the newest this many, never more. NOT a truncation of a
 *  derivation — nothing is computed from the list — so it is a window, not a bound that throws. Must
 *  not exceed DATASTORE_MAX_ROWS. */
export const NOTIFICATION_LIMIT = 50;

// ---------------------------------------------------------------------------
// EVT-06 — the guest link. 01-plan.md section 4.1. ADR-052.
// ---------------------------------------------------------------------------

/** EVT-06. Glossary *Guest link*. One row of `public.event_guest_link`. Readable only by those who
 *  may manage the event (AC-3). `token` is 64 lowercase hex characters, chosen by the database. */
export interface EventGuestLink {
  eventId: string;
  token: string;
  /** ISO 8601. When this link was created; a reopened event has a later one (AC-5). */
  openedAt: string;
}

/** EVT-06. What the guest page reads, and EXACTLY that — AC-12, ADR-052 revert condition 1. No id,
 *  no creator, no scope, no deadline, no member id. Adding a field here is widening what the anon
 *  key reads, and needs its own decision. */
export interface GuestEvent {
  name: string;
  description: string | null;
  location: string | null;
  /** `yyyy-MM-dd`, inclusive both ends, as `CalEvent` does. */
  startDate: string;
  endDate: string;
  capacity: number | null;
  /** Attendances in state `attending`. */
  seatsTaken: number;
  /** One per attendee, in join order. Null for a person no longer an approved member — rendered
   *  "Former member" (AC-10). */
  attendeeNames: Array<string | null>;
}

/** EVT-06 AC-1. The token's shape, as the database's check states it. The guest page does not call
 *  the datastore for a token that fails it, and shows the same not-found (AC-13). */
export const GUEST_LINK_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// EVT-07 — guest registration. 01-plan.md section 4.1. ADR-052.
// ---------------------------------------------------------------------------

/** EVT-07. The five states of one guest's registration — `EVT-02`'s four and `cancelled`, which only
 *  the guest's manage link writes. The database enum `public.guest_status`, verbatim. A cancelled
 *  row is kept (Q8). */
export type GuestStatus = "pending" | "attending" | "rejected" | "removed" | "cancelled";

/** EVT-07. Glossary *Guest*. One row of `public.event_guest`, as a member reads it. `email` is null
 *  to everyone but the event's creator and admins (AC-15) — never omitted, always present. */
export interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  email: string | null;
  status: GuestStatus;
  createdAt: string;
  updatedAt: string;
}

/** EVT-07 AC-22. The two facts the guest page needs to offer the right form. Not part of
 *  `GuestEvent` on purpose — `EVT-06` AC-12. */
export interface GuestRegistrationTerms {
  requiresApproval: boolean;
  /** `EVT-02`'s *registration is open*, by the database's clock. */
  registrationOpen: boolean;
}

/** EVT-07 AC-1, AC-2, AC-3. What a successful registration returns — the ONLY place a manage token
 *  ever leaves the database. */
export interface GuestRegistrationReceipt {
  manageToken: string;
  status: "pending" | "attending";
}

/** EVT-07 AC-11, AC-20. What the manage page reads. No email, no id, no other person. */
export interface GuestRegistrationView {
  /** The live name, or the name as it was when the event was deleted. */
  eventName: string;
  /** Null once the event is deleted (AC-20). */
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  guestName: string;
  status: GuestStatus;
  /** False once the event is deleted. */
  registrationOpen: boolean;
  eventDeleted: boolean;
}

/** EVT-07 AC-4. The ceilings and the shape, as the database's checks state them. */
export const GUEST_NAME_MAX = 100;
export const GUEST_EMAIL_MAX = 254;
export const GUEST_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------------------
// EVT-08 — email invitations to a public event. 01-plan.md section 4.1. ADR-055.
// ---------------------------------------------------------------------------

/** EVT-08. Glossary *Email invitation*. One row of `public.event_email_invitation`, as the event's
 *  creator or an admin reads it. Deliberately nothing about whether the address is a member's, or
 *  which mail it received (AC-7). */
export interface EventEmailInvitation {
  id: string;
  eventId: string;
  email: string;
  /** The inviter's member id. */
  invitedBy: string;
  createdAt: string;
}

/** EVT-08 AC-1, AC-6, AC-7. One distinct address of a submission, in the order first entered.
 *  `sent`: invited by this call. `ignored`: already invited for this event. Nothing else. */
export interface EmailInvitationOutcome {
  email: string;
  outcome: "sent" | "ignored";
}

// ---------------------------------------------------------------------------
// TSK-01, 01-plan.md section 4.1. ADR-057.
// ---------------------------------------------------------------------------

/** TSK-01, TSK-06. One task: the caller's own, always — no other person's task ever reaches the
 *  browser. ADR-062: one optional time of day, as extra information only; NO OTHER TIME-BEARING
 *  FIELD (end time, duration, estimate, hours, lead time). *Until TSK-06: "NO TIME FIELD OF ANY KIND"
 *  (ADR-057 decision 6), superseded as to a time of day by ADR-062.* */
export interface Task {
  id: string;
  memberId: string;
  date: string; // yyyy-MM-dd
  title: string; // trimmed, 1..TASK_TITLE_MAX characters
  note: string | null; // trimmed, 1..TASK_NOTE_MAX characters, or null
  timeOfDay: string | null; // "HH:MM", 24-hour, wall-clock Asia/Ho_Chi_Minh; null = no time (ADR-062)
  done: boolean;
  createdAt: string; // ISO 8601 instant; ordering only, never displayed
}

/** TSK-01. Bounds, in characters. Mirrored by `task_title_shape` and `task_note_shape`. */
export const TASK_TITLE_MAX = 200;
export const TASK_NOTE_MAX = 1000;

// ---------------------------------------------------------------------------
// MIR-14-b. 01-plan.md section 4.3.
//
// Two interfaces, added at the end. Nothing existing changes shape, so no existing caller changes and
// the shared-type clause of .ai/01-operating-model.md § Sizing is not engaged — the ADM-06 precedent.
// ---------------------------------------------------------------------------

/** MIR-14-b. One of the teams an entry's owner actively belongs to (ADR-073 decision 1). */
export interface EntryOwnerTeam {
  id: string;
  name: string;
}

/**
 * MIR-14-b. The owner of an entry the caller may decide: who they are, and every team the entry
 * affects. Derived at read time from `membership`, never stored.
 */
export interface EntryOwner {
  memberId: string;
  displayName: string;
  avatar: string;
  /** Ordered by name. Never empty: an owner with no active team is not returned. */
  teams: EntryOwnerTeam[];
}
