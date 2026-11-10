// The data-access seam. Declared in .ai/standards/architecture.md; RULE-02 says nothing outside this
// directory may import the Supabase client, and eslint.config.js enforces it.
//
// This file carries the SHAPE only. The functions a feature needs are declared by the Tech Lead in
// design section 1 and added here — RULE-04 forbids inventing them ahead of a design.
//
// Two implementations exist and must stay in parity: `supabase.ts` and `mock.ts`. The seam-parity
// test in tests/ asserts identical exported names and equal arity, which is what makes swapping them
// a configuration change rather than a rewrite.
import type {
  MemberDecision,
  BulkRejectionOutcome,
  BusyDay,
  DateRange,
  Entry,
  // MIR-14-b, 01-plan.md section 4.3.
  EntryOwner,
  EntryPortion,
  EntryType,
  Holiday,
  HolidayKind,
  CreateIssueReportInput,
  IssueReport,
  IssueStatus,
  Member,
  PendingEntryPage,
  PendingEntryQuery,
  Result,
  Session,
  Team,
  MemberRole,
  // EVT-01, 01-plan.md section 4.2.
  CalEvent,
  DirectoryMember,
  EventScope,
  // EVT-02, 01-plan.md section 4.3.
  EventAttendance,
  // EVT-04, 01-plan.md section 4.2.
  EventNotification,
  // EVT-06, 01-plan.md section 4.2.
  EventGuestLink,
  GuestEvent,
  // EVT-07, 01-plan.md section 4.2.
  EventGuest,
  GuestRegistrationReceipt,
  GuestRegistrationTerms,
  GuestRegistrationView,
  // EVT-08, 01-plan.md section 4.2.
  EmailInvitationOutcome,
  EventEmailInvitation,
  // TSK-01, 01-plan.md section 4.2.
  Task,
} from "../domain/types";
import { seam as mockSeam } from "./mock";
import { seam as supabaseSeam } from "./supabase";

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  avatar: string;
}

// SOLO, 2026-09-10. `AddAllowedEmailInput` stood here until the allow-list was removed whole.
// Joining is now sign-up plus an admin decision — see `MemberDecision` in the domain types.

/**
 * SOLO 2026-09-10. The profile screen's two editable facts, sent together because the screen saves
 * them together — one form, one button, which is what the transcription's *leave all three password
 * boxes empty* sentence implies about the rest of the page.
 *
 * NO `memberId`. The row is the caller's own and is resolved from the session inside the seam.
 */
export interface UpdateOwnProfileInput {
  displayName: string;
  /** Must be one of `AVATAR_CHOICES`. Both implementations refuse anything else — `invalid_avatar`. */
  avatar: string;
}

/** SOLO 2026-09-10. See `changePassword` below for why the current password is here. */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** TEA-05, 01-plan.md section 4.2. Email and password only — it is what TEA-01's sign-up creates. */
export interface SignInInput {
  email: string;
  password: string;
}

/** CAL-01, 01-plan.md section 4.2.
 *
 *  NO `status`, `approvedBy`, `approvedAt` or `rejectionReason`. Not an oversight and not a
 *  convenience: those columns are withheld from the insert grant (plan section 3), so a field here
 *  would be a field the datastore refuses — a DTO that accepts a value the database rejects invites
 *  the write that AC-11 exists to refuse.
 *
 *  NO `memberId` EITHER. The policy's `with check` supplies it from `auth.uid()`; a parameter would
 *  imply a caller could pass somebody else's and be answered. Same reasoning that kept `teamId` off
 *  `addAllowedEmail`. */
export interface CreateEntryInput {
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive; equal to startDate for a single day
  tentative: boolean;
  note: string | null;
}

/** CAL-02, 01-plan.md section 4.1.
 *
 *  The same six fields as `CreateEntryInput`, and a SEPARATE interface rather than an alias. Two
 *  reasons: the two diverge the moment ADM-05 adds a decision path that updates `status` and creates
 *  nothing, and an alias would make `createEntry` and `updateEntry` look interchangeable to a caller
 *  who never reads the seam.
 *
 *  NO `memberId`, NO `status`, NO `rejectionReason`, NO `approvedBy`, NO `approvedAt`. Each is
 *  withheld from the update grant (plan section 6), so a field here would be a field the datastore
 *  refuses — and `memberId`'s absence is INV-07's control, not a convenience.
 *
 *  THIS IS A FULL REPLACEMENT OF THE SIX FIELDS, not a patch of the changed ones. A partial shape
 *  would make "the caller did not send `note`" and "the caller cleared `note`" the same request,
 *  and it would create a second place where "is this edit substantive" is answered — INV-02's
 *  trigger compares OLD against NEW and is the only judge of that (plan section 8). */
export interface UpdateEntryInput {
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive
  tentative: boolean;
  note: string | null;
}

/**
 * SOLO, 2026-09-11 — many teams. A new team's name, and nothing else: the threshold takes the column
 * default and `created_at` is the datastore's. A SEPARATE interface from `RenameTeamInput` for the
 * reason `CreateEntryInput` and `UpdateEntryInput` are two — the two diverge the day one of them
 * grows a field, and an alias would make them look interchangeable to a caller.
 */
export interface CreateTeamInput {
  /** Both implementations trim, and refuse what is left empty. */
  name: string;
}

/**
 * SOLO, 2026-09-11. The team's new name, and nothing else.
 *
 * NO `teamId` in the body — it is `renameTeam`'s first argument, the way `deleteTeam` and
 * `moveMember` take theirs. NO `overloadThreshold`: the grant in
 * `20260911160000_solo_team_name_update.sql` names `name` alone, so a second field here would be a
 * field the datastore refuses, which is the shape `CreateEntryInput` and `SetOverloadThresholdInput`
 * both already refuse to take.
 */
export interface RenameTeamInput {
  /** Trimmed by the caller or not; both implementations trim, and refuse what is left empty. */
  name: string;
}

/**
 * SOLO, 2026-09-11. Whether each entry type waits for an admin — the operator's `WFH_NEED_APPROVE`
 * and `PTO_NEED_APPROVE`.
 *
 * **BOTH FLAGS, ALWAYS, AND NOTHING ELSE.** They are one decision an admin makes on one form and
 * saves with one press; sending one at a time would let a stale value held by the form overwrite the
 * other. `overloadThreshold` and `name` are NOT here for the reason `setOverloadThreshold` and
 * `renameTeam` each record — a field the grant does not name is a field the datastore refuses.
 */
export interface SetApprovalSettingsInput {
  wfhNeedApprove: boolean;
  ptoNeedApprove: boolean;
}

/**
 * SOLO, 2026-09-11. One date and which way to move it.
 *
 * NO `memberId`, for the reason `setOwnBusyDay` records: the policy supplies it from `auth.uid()`.
 * NO range — the gesture is a press on one day, and the row is one date (`BusyDay`).
 */
export interface SetOwnBusyDayInput {
  date: string; // yyyy-MM-dd
  /** `true` marks it, `false` unmarks it. Both are idempotent. */
  busy: boolean;
}

/** ADM-01, 01-plan.md section 4.1.
 *
 *  ONE FIELD, and that is a contract rather than an omission: `setOverloadThreshold` carries no
 *  `name`, no `id` and no `createdAt`, so there is no shape in which a caller could send another
 *  column and have it reach the datastore (AC-9). The column-level grant in the migration is what
 *  makes the same thing true one layer down.
 *
 *  NO `teamId`. The policy resolves the row from `auth.uid()`; a team parameter would be a value
 *  the CALLER supplies, which is the shape `addAllowedEmail`, `listMembers` and `getTeam` all
 *  refused before it. */
export interface SetOverloadThresholdInput {
  /**
   * A FRACTION in [0, 1] inclusive, never a percentage. `Team.overloadThreshold` is a share
   * (glossary, *Threshold*) and `src/lib/data/absence.ts` compares against a share; the screen is
   * the one edge that speaks percent and it converts there. Two representations of one number on
   * the seam is how a factor of one hundred gets applied twice.
   */
  overloadThreshold: number;
}

/** MIR-09, ADR-069. The datastore's `team_overload_threshold_range`, restated for the pre-send guard. */
export function isValidThreshold(share: number): boolean {
  return Number.isFinite(share) && share >= 0 && share <= 1;
}
export const INVALID_THRESHOLD_MESSAGE = "The threshold must be between 0% and 100%.";

/** ADM-03, 01-plan.md section 4.2. AC-1, AC-2, AC-5.
 *
 *  THE THREE COLUMNS AN ADMIN MAY SET, and no more. `id` and `createdAt` are the datastore's — the
 *  grant behind this one is table-wide rather than column-scoped, unlike ADM-01's and TEA-04's, so
 *  unusually for this seam the DTO is the only thing withholding them. 01-plan.md Open question 1
 *  records why the grant is transcribed that way and carries the narrowing to the operator.
 *
 *  NO `teamId`, and here that is not a refusal of a caller-supplied value the way it is on
 *  `addAllowedEmail` — the calendar is NATIONAL and the column does not exist (ADR-015 section 1).
 *
 *  `name` ARRIVES TRIMMED. The screen refuses a blank or whitespace-only name before calling
 *  (AC-5), the way `EntryForm` already trims `note` on its way out. */
export interface AddHolidayInput {
  date: string; // yyyy-MM-dd. Never a Date — see the note beside `Holiday.date`.
  name: string;
  kind: HolidayKind;
}

/** ADM-03, 01-plan.md section 4.2. AC-7, AC-8.
 *
 *  The same three fields: an edit may move the date, correct the label and flip the effect. A
 *  SEPARATE interface rather than an alias, for the reason `CreateEntryInput` and `UpdateEntryInput`
 *  are separate — the two writes answer to different policies and will not stay identical, and an
 *  alias would make `addHoliday` and `updateHoliday` look interchangeable to a caller who never
 *  reads the seam.
 *
 *  A FULL REPLACEMENT OF THE THREE FIELDS, not a patch of the changed ones: a partial shape would
 *  make "the caller did not send `kind`" and "the caller chose `non_working`" the same request. */
export interface UpdateHolidayInput {
  date: string;
  name: string;
  kind: HolidayKind;
}

/** EVT-01. NO `creatorId` AND NO `teamId`: both are the database's (AC-4), and a field here would
 *  invite a caller to pass somebody else's. `inviteeIds` is ignored and stored empty unless
 *  `scope === "named"`. `description` and `location` are sent as null when blank after trimming. */
export interface SaveEventInput {
  name: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  scope: EventScope;
  inviteeIds: string[];
  // EVT-02, 01-plan.md section 4.3. OPTIONAL so no existing caller has to change; absent means the
  // default. The editor always sends all three.
  /** EVT-02. Absent or null: no limit. */
  capacity?: number | null;
  /** EVT-02. Absent: false. */
  requiresApproval?: boolean;
  /** EVT-02. Absent or null: registration runs to `endDate`. */
  registrationDeadline?: string | null;
}

/** TSK-01. A new task's three fields. NO `memberId`: the row is the caller's, by the column default
 *  and the policy, and a parameter would imply a caller could name someone else (CreateEntryInput's
 *  reasoning). NO `done`: a task is created not done. */
export interface CreateTaskInput {
  date: string; // yyyy-MM-dd, today or later in Asia/Ho_Chi_Minh
  title: string;
  note: string | null;
  /** TSK-06. Absent, null or "" = no time. Otherwise "HH:MM". */
  timeOfDay?: string | null;
}

/** TSK-01, TSK-06. A full replacement of title, note and time, never the date — re-dating is
 *  `moveTask`, because it carries a refusal (`task_date_past`) an edit of a past task's title must
 *  not meet. */
export interface UpdateTaskInput {
  title: string;
  note: string | null;
  /** TSK-06. Required: null or "" clears the time. */
  timeOfDay: string | null;
}

export interface SignUpOutcome {
  /** True when the project has Confirm email on and the address is not yet confirmed. */
  needsEmailConfirmation: boolean;
  /** Non-null only when the project has Confirm email off. AC-13: the screen ignores it either way. */
  session: Session | null;
}

/** Every implementation of the seam satisfies this. It grows one entry per designed contract item. */
export interface DataSeam {
  /** Liveness probe. Present so the seam and its parity test are exercisable before any feature. */
  ready(): Promise<boolean>;

  /**
   * AC-1, AC-5, AC-8, AC-13. Creates the auth user and nothing else — the `member` row is the
   * trigger's work, never this function's. It returns the same shape whether or not the address is
   * allow-listed, and it cannot tell the difference; that is what makes AC-5 hold.
   */
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome>>;

  /**
   * AC-1, AC-9. Null means "this auth user has no member row", which is a normal answer and not an
   * error. Under `member_select_own` (design section 4) a caller can only ever address their own
   * row, so `userId` is a readability parameter and not a permission surface.
   *
   * Nothing in this ticket's interface calls it — the sign-up screen ends on its own notice (AC-13).
   * Its caller here is tests/permission-model.test.ts, which is how AC-1 and AC-9 are observed
   * through the seam rather than only through raw SQL.
   */
  getOwnMember(userId: string): Promise<Member | null>;

  // -------------------------------------------------------------------------
  // TEA-02 - manage the allow-list. 02-design.md section 1.2.
  // -------------------------------------------------------------------------

  /**
   * AC-1, AC-9. The caller's own member row, or null when nobody is signed in or the auth user has
   * no member row. Null is a normal answer and not an error.
   *
   * The sign-in half of TEA-01 does not exist, so in a real build this returns null on every call -
   * see "Prerequisites this ticket does not own" in 02-design.md section 5.
   */
  getCurrentMember(): Promise<Member | null>;

  /**
   * SOLO, 2026-09-10. Everybody who has signed up and whom no admin has decided on yet, newest
   * first. Replaces `listAllowedEmails`.
   *
   * **`pending` ONLY, AND NOT EVERYTHING THAT IS NOT `approved`.** A rejected person is a decision
   * already made, and leaving them on a queue whose two controls are *approve* and *reject* would be
   * a worklist that never empties. `member_select_pending_admin` is deliberately WIDER than this —
   * `status <> 'approved'` — so a later screen can show what was decided without a migration; which
   * rows a screen draws is a display decision above the seam, and this is that decision.
   *
   * **TAKES NO TEAM PARAMETER, AND HERE THAT IS NOT THE USUAL REASON.** Every other list read on this
   * seam omits one because the policy scopes rows to the caller's team; `member_select_pending_admin`
   * scopes by `team_id is null` instead, because a pending person is on no team yet. So the answer
   * is every waiting sign-up the datastore holds, for any admin.
   *
   * THROWS on a transport failure, the shape `listMembers` uses.
   */
  listPendingMembers(): Promise<Member[]>;

  /**
   * SOLO, 2026-09-10. Approve or reject one waiting sign-up.
   *
   * **SOLO, 2026-09-11 — THE TEAM IS NOW ANY TEAM THE ADMIN CHOOSES.** It used to be the caller's
   * own: `member_decide_admin`s `with check` compared the incoming `team_id` to
   * `member_team_id(auth.uid())`. The operator decided every admin manages every team, so an
   * APPROVAL goes through `public.admit_member`, which checks `is_admin` and that the team exists
   * and nothing about ownership.
   *
   * **MIR-02, ADR-064 — A REJECTION IS `public.reject_member`, NO LONGER A TABLE UPDATE.**
   * `update (status, team_id)` is revoked from `authenticated`, because with `member_update_own` it
   * let a pending sign-up admit themselves. The function is the control: an admin, and a row still
   * pending with no team.
   *
   * Refused for a non-admin and for a row already decided, both as `not_permitted`.
   */
  decideMember(memberId: string, decision: MemberDecision): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // TEA-03 - the team member list. 02-design.md section 1.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8. The caller's team roster.
   *
   * Takes no team parameter: `member_select_team` scopes the rows to the caller's own team, and a
   * parameter would imply the caller could ask for another team's and be answered - the same
   * reasoning that kept `teamId` off `addAllowedEmail`.
   *
   * RETURNS REMOVED MEMBERS, carrying `removedAt`. Which rows the screen draws is a display
   * decision above the seam; which rows the read returns is not - ADR-013 and the INV-04 note
   * require the counting function to be GIVEN the roster with `removedAt` per member, because it
   * cannot derive membership-as-of-a-date from the entries. A filter here would make INV-04
   * uncomputable for every past date, and CAL-04 and CAL-06 unbuildable against this read.
   *
   * Ordered by `createdAt` ascending, then `id` ascending. Deterministic in both implementations -
   * `FIXTURE_ADMIN` and `FIXTURE_MEMBER` share a `createdAt` literal, so the id tiebreaker is what
   * stops the two implementations disagreeing about row order (02-design.md section 1.4).
   *
   * An empty array is a normal answer and not an error: it is what the policy returns to a caller
   * with no member row (AC-7) and to a caller with no session (AC-6).
   *
   * THROWS on a transport failure and on a possibly-truncated answer (AC-8). There is no
   * caller-visible failure shape, so a `Result` would have nothing to carry; returning `[]` for a
   * broken connection would report "you are on no team" for what is a network fault, and returning
   * a short list for a capped read is the exact failure AC-8 exists to prevent.
   */
  listMembers(): Promise<Member[]>;

  // -------------------------------------------------------------------------
  // TEA-04 - remove a member, and promote a member to admin. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12. Soft-removes a member of the caller's own team.
   *
   * TAKES NO TIMESTAMP. `removed_at` is written by the datastore's own clock and a caller-supplied
   * value is discarded by the trigger (AC-3) - ADR-013's revert condition is a backdated removal
   * moving every past absence count silently and everywhere, so there is no parameter here that
   * could carry one.
   *
   * `memberId` is an ADDRESS and not a permission surface. It names an existing row that the policy
   * then filters by team and by the caller's role - the shape `removeAllowedEmail(email)` already
   * uses. It is unlike the `teamId` deliberately kept off `addAllowedEmail`, which would have
   * SUPPLIED a value that landed in the row.
   *
   * Returns the updated row. The `.select()` in the real implementation is not a convenience: under
   * row-level security a refused UPDATE is FILTERED, not errored - it matches nothing and PostgREST
   * answers 200 with an empty body (ADR-016 section 4, behaviour 2). Zero rows returned is a
   * refusal and is mapped to `not_permitted`; treating `!error` as success would report a refusal
   * as done.
   */
  removeMember(memberId: string): Promise<Result<Member>>;

  /**
   * TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12. Promotes a member to admin. ONE-WAY: there is no
   * `demoteMember`, and adding one would be inventing a permission - `Demote an admin to member` is
   * not decided and is denied until it is.
   *
   * **SOLO, 2026-09-24 — ADR-044: "of the caller's own team" WAS TRUE HERE UNTIL THIS DATE AND IS
   * NOT ANY MORE.** Any team, and the reason it had to change is in `setMemberRole` below.
   *
   * **MIR-03, 2026-10-20 — ADR-065: OWN TEAM AGAIN, AND ITS OWN FUNCTION.** Promotion is
   * `public.promote_member_to_admin`, admin-only and own-team, and no longer goes through
   * `public.set_member_role`, which now refuses `admin`. The screen asks for a confirmation first
   * because the action is one-way.
   *
   * Returns the updated row. A refusal arrives as a 42501 from `public.promote_member_to_admin`; the
   * seam maps it to `not_permitted` and no caller branches on the difference.
   */
  promoteMember(memberId: string): Promise<Result<Member>>;

  /**
   * SOLO 2026-09-12, ADR-035. Sets a member's rank outright.
   *
   * **IT DOES NOT REPLACE `promoteMember`, AND THE OVERLAP IS DELIBERATE.** That function is
   * member-to-admin and is what sixty-odd shipped assertions address; rewriting it to take a
   * parameter would edit a shipped contract to add a rank. This is the general form, and the two
   * agree because both end in the same `update { role }` against the same policy and the same
   * trigger. `promoteMember(id)` is `setMemberRole(id, "admin")` with a narrower refusal message.
   *
   * **MIR-03, 2026-10-20 — ADR-065: THE PARAGRAPH ABOVE IS NO LONGER TRUE.** This refuses `"admin"`
   * as `not_permitted`; promotion is `promoteMember` alone, through its own function. And an admin
   * sets a rank on their OWN TEAM only — ADR-065 supersedes the "any team" paragraph below, which is
   * kept as the history of why this became a definer function.
   *
   * **ADMIN-ONLY, AND THE DATASTORE IS WHAT SAYS SO** — `public.set_member_role`, which tests
   * `public.is_admin` as its first statement. A manager calling this is refused by the function, not
   * by this seam.
   *
   * **ANY TEAM, SINCE 2026-09-24 — ADR-044, AND THE REASON IS WORTH THE PARAGRAPH.** This was a
   * plain `update public.member set role = …` admitted by `member_update_admin`, whose `using`
   * carries `team_id = member_team_id(auth.uid())` — the CALLER'S OWN TEAM. The Members screen has
   * read every team since `list_all_members()` shipped on 2026-09-11, so it drew *Make manager* on
   * rows the datastore then refused, and the refusal was correct and the button was not. The write
   * is now a `security definer` function, the shape ADR-039 chose for every cross-team operation;
   * `member_update_admin` is untouched and still governs `removeMember` and every other table write.
   *
   * **REMOVAL DID NOT MOVE WITH IT.** `removeMember` above is still own-team, because ADR-039
   * § Decision 1's list of cross-team powers does not carry it and ADR-044 did not add it.
   *
   * **IT CANNOT DEMOTE AN ADMIN.** `.ai/standards/rbac-and-security.md` carries *Demote an admin to
   * member* as not decided; the function's `where` carries `role <> 'admin'` and the member trigger
   * refuses it behind that. Moving somebody between `member` and `manager` is what this is for,
   * which is the one pair ADR-035 § Decision item 6 settled.
   *
   * **A 42501 IS THE REFUSAL, NOT ZERO ROWS.** A definer function raises where a policy filtered.
   * Both reach a caller as `not_permitted`, so nothing downstream changed.
   */
  setMemberRole(memberId: string, role: MemberRole): Promise<Result<Member>>;

  /**
   * SOLO, 2026-09-10. Move a member to a team.
   *
   * **`member_update_admin`s `with check` IS THE CONTROL AND IT PINS THE DESTINATION TO THE CALLER'S
   * OWN TEAM** — `team_id = member_team_id(auth.uid())`. So today this can only ever write the team
   * the member is already on, because `member_select_team` scoped the caller's view to that same
   * team. It is not inert by design: it becomes a real move the day there is a second team AND a
   * policy that lets an admin write a team id they are not on, which is a security decision on its
   * own.
   *
   * ZERO ROWS RETURNED IS A REFUSAL, not a success — the shape `removeMember` and `promoteMember`
   * already document.
   *
   * **MIR-02, ADR-064 — THE CONTROL IS NOW `public.set_member_team`.** `team_id` is no longer
   * granted to `authenticated`, so this is an RPC and not a table update. The function carries the
   * same bound the policy did — an admin, the member on the caller's own team, the destination the
   * caller's own team — and refuses with a 42501 rather than returning zero rows. The paragraph
   * above describes the policy it replaced.
   */
  setMemberTeam(memberId: string, teamId: string): Promise<Result<Member>>;

  // -------------------------------------------------------------------------
  // SOLO 2026-09-10 — the profile screen's two writes. No ticket, no plan; ADR-033.
  // -------------------------------------------------------------------------

  /**
   * Writes the caller's OWN display name and avatar. There is no `memberId` parameter and there
   * must never be one: the row written is the caller's, resolved from the session inside the
   * implementation, so no argument exists that could aim this at somebody else. That is the same
   * affordance `createEntry` uses for `member_id` and it is the reason `updateMember(id, …)` was
   * not the shape chosen.
   *
   * **THIS IS A NEW PERMISSION AND IT NEEDED A NEW GRANT.** `20260901120000_tea04_member_writes.sql`
   * withheld `display_name` and `avatar` from EVERYBODY on purpose;
   * `20260910093000_solo_profile_self_update.sql` grants exactly those two columns and adds
   * `member_update_own` beside `member_update_admin`. `.ai/standards/rbac-and-security.md` has no
   * row for this action — the two rows to add are printed for the operator in the reply that
   * shipped this, because that file is human-owned.
   *
   * Returns the updated row. **Zero rows back is a REFUSAL and not an error**, the trap
   * `removeMember` above records: under row-level security a filtered UPDATE returns no
   * representation and PostgREST does not raise.
   */
  updateOwnProfile(input: UpdateOwnProfileInput): Promise<Result<Member>>;

  /**
   * Changes the caller's own password. **It takes the CURRENT password and verifies it**, which
   * `supabase.auth.updateUser({ password })` does NOT do on its own — a live session is all that
   * call requires, so an unlocked laptop is enough to lock the owner out of their own account. The
   * implementation re-authenticates first and that is the whole reason `currentPassword` is on this
   * type; removing it would silently remove the check.
   *
   * A wrong current password is `wrong_password` and NEVER `invalid_credentials`: the caller is
   * already signed in, so there is no address to enumerate here and the message may say plainly
   * which of the two boxes is wrong.
   *
   * The confirmation box on the screen is not in this input. Two boxes that must match is a
   * typing-mistake check with no meaning below the seam, and sending it would invite a second,
   * disagreeing copy of the comparison.
   */
  changePassword(input: ChangePasswordInput): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // TEA-05 - sign in, sign out, and the session. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-05 AC-7, AC-8, AC-9. The session as it stands right now, or null. Null is a normal answer
   * and not an error: nobody being signed in is the ordinary state of the application.
   *
   * It READS persisted state and prompts for nothing. AC-7 is the client persisting the session
   * across a reload, which is library behaviour rather than behaviour this seam builds.
   */
  getSession(): Promise<Session | null>;

  /**
   * TEA-05 AC-6, AC-7, AC-8. Calls `listener` whenever the session appears, changes or goes away.
   * Returns the unsubscribe function; the caller MUST call it on unmount, because a leaked
   * subscription survives a hot reload and then re-resolves against a stale closure.
   *
   * The listener takes `Session | null` and NOT the underlying client's event union. That union is
   * a datastore type, and .ai/standards/architecture.md ("Layers") says code above the seam works
   * in domain types and never in a client's vocabulary - passing it through would put a Supabase
   * type in a hook and make RULE-02 a matter of which import you happened to write.
   *
   * It is lossless for every criterion here: each event the hook reacts to carries the session or
   * null, and nothing above the seam branches on which one arrived. The day a screen needs to tell
   * a deliberate sign-out from a failed refresh, the seam can carry a domain enum of its own
   * (01-plan.md section 9).
   *
   * **EVERY IMPLEMENTATION CALLS THE LISTENER ONCE, ASYNCHRONOUSLY, IMMEDIATELY AFTER SUBSCRIBING** —
   * with the current session, or with `null` when there is none or the read failed. **SUBSCRIBING IS
   * THEREFORE ALSO A READ, and a caller must not do a `getSession()` of its own beside it.** SOLO
   * 2026-09-10 promoted this from an accident of the real client to a term of the contract: GoTrue
   * has always behaved this way (`@supabase/auth-js@2.112.4/dist/module/GoTrueClient.js:3633-3644`,
   * read on disk), the mock did not, and `useSession` compensated by reading once itself — so every
   * mount of the application made two `auth.getUser()` calls and two `member` selects, one of which
   * was discarded by a sequence guard.
   *
   * An implementation that stops emitting leaves `useSession` with `resolving` never clearing and
   * the application on its loading screen for ever. Every acceptance test renders the application
   * before it does anything else, so the failure is loud rather than subtle.
   */
  onAuthStateChange(listener: (session: Session | null) => void): () => void;

  /**
   * TEA-05 AC-1, AC-2, AC-3. Email and password only.
   *
   * Expected failures are RETURNED, not thrown (.ai/standards/coding-standards.md). Two codes reach
   * a sentence on screen: `invalid_credentials` for AC-2, which must stay ONE message for both an
   * unknown address and a wrong password - two messages would let anybody test whether a colleague
   * has an account here - and `email_not_confirmed` for AC-3.
   */
  signIn(input: SignInInput): Promise<Result<Session>>;

  /**
   * TEA-05 AC-6. Ends the session. Returns `Result<void>`; a failure here is rare and is still
   * returned rather than thrown, because a sign-out that silently did nothing on a shared machine
   * is the failure this function exists to prevent.
   */
  signOut(): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // CAL-01 — create an entry. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * CAL-01 AC-1 … AC-11. Creates ONE entry for the CALLER, over one date or a run of consecutive
   * dates. A contiguous range declared in one action is one entry and never one per day (AC-2) —
   * .ai/registry/invariants.md records that as considered and rejected as an invariant precisely so
   * it would land as an acceptance criterion.
   *
   * Expected failures are RETURNED, not thrown (.ai/standards/coding-standards.md). Three codes
   * reach a sentence on screen and each maps to a specific database refusal (plan section 4.3):
   *   `overlapping_entry`   — INV-01's exclusion constraint, SQLSTATE 23P01, arriving as a 409
   *   `invalid_date_range`  — end before start, refused in the seam BEFORE the round trip (AC-9)
   *   `entry_not_permitted` — the insert policy or a withheld column privilege, 42501 / 403
   *
   * Returns the created row. The `.select()` is not a convenience: under row-level security a
   * refused INSERT that the policy filters returns no representation, and treating `!error` as
   * success would report a refusal as done — the same trap TEA-04's `removeMember` records.
   */
  createEntry(input: CreateEntryInput): Promise<Result<Entry>>;

  /**
   * CAL-01 AC-1, AC-2, AC-3, AC-5, AC-6, AC-8. The CALLER'S OWN entries, newest start date first.
   *
   * Deliberately narrow, and this is the boundary with CAL-04. It takes NO date range and NO member
   * parameter, so it cannot become the team-wide, range-shaped read that CAL-04 owns — that read
   * filters `date_range=ov.…` and feeds INV-04's counting function, and building it here would put
   * a second entry read in the seam before the one that matters exists.
   *
   * It exists because every criterion in plan section 2 has to be observable from outside the system
   * and a confirmation message proves only that the form ran. `entry_select_team` admits the whole
   * team's rows; this function narrows to the caller's in the query, which is an affordance and not
   * a control — the policy is what stops anybody reading another team's.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers` uses:
   * there is no caller-visible failure to carry, `[]` for a broken connection would report "you have
   * no entries", and a short list for a capped read is the failure OWN_ENTRY_LIMIT exists to
   * prevent.
   */
  listOwnEntries(): Promise<Entry[]>;

  // -------------------------------------------------------------------------
  // CAL-02 — edit or delete their own entry. 01-plan.md section 4.1.
  // -------------------------------------------------------------------------

  /**
   * CAL-02 AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-10, AC-11, AC-12. Replaces the six substantive
   * fields of ONE entry belonging to the caller.
   *
   * `entryId` is an ADDRESS and not a permission surface — the shape `removeMember(memberId)` uses.
   * It names a row that `entry_update_own` then filters by owner.
   *
   * Expected failures are RETURNED, not thrown. Three codes, all three already in `FailureCode`
   * from CAL-01 — this ticket adds none:
   *   `overlapping_entry`   — INV-01's exclusion constraint, SQLSTATE 23P01, arriving as a 409
   *   `invalid_date_range`  — end before start, refused in the seam BEFORE the round trip (AC-11)
   *   `entry_not_permitted` — the policy filtered the row, or a withheld column privilege refused
   *                           the statement (42501 / 403)
   *
   * RETURNS THE UPDATED ROW, AND ZERO ROWS IS A REFUSAL. Under row-level security a refused UPDATE
   * is FILTERED rather than errored: it matches nothing and PostgREST answers 200 with an empty
   * body (ADR-016 section 4, behaviour 2). An `!error` check would report AC-9's refusal as success.
   *
   * `entry_not_permitted` deliberately covers BOTH "this entry is not yours" and "no such entry".
   * Under the policy the two are indistinguishable and must stay so — a distinct `not_found` would
   * turn this function into an oracle for which entry ids exist in the team.
   *
   * INV-02 IS NOT IMPLEMENTED HERE AND MUST NOT BE. The reset of `status`, `approved_by`,
   * `approved_at` and `rejection_reason` on a substantive edit is `entry_enforce_decision()`'s,
   * shipped by CAL-01; this function observes it in the row it reads back.
   */
  updateEntry(entryId: string, input: UpdateEntryInput): Promise<Result<Entry>>;

  /**
   * CAL-02 AC-3, AC-4, AC-9. Hard-deletes ONE entry belonging to the caller. There is no soft
   * delete: `entry` carries no such column and the feature row settles that the row and its
   * `approved_by` disappear together.
   *
   * Returns `Result<void>`. **The real implementation must ask for the deleted representation and
   * count it** — a DELETE the policy filters answers 200 with an empty body exactly as an UPDATE
   * does, so zero rows deleted is `entry_not_permitted` and not success. This is AC-9's delete half
   * and it is the one an implementation is most likely to get wrong, because a delete has no
   * obvious return value to inspect.
   */
  deleteEntry(entryId: string): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // CAL-03 — edit or delete another member's entry, as an admin. 01-plan.md section 4.1.
  //
  // ONE READ IS ADDED AND NO WRITE IS. `updateEntry` and `deleteEntry` above were written at CAL-02
  // as POLICY-DRIVEN operations: they take an entry id, issue the statement, and read the affected
  // row count to tell success from a filtered refusal. Neither mentions ownership, because ownership
  // was never theirs to decide. `entry_update_admin` and `entry_delete_admin` widen what those same
  // two functions may reach, with no change to either signature or body — which is what ADR-005
  // predicts when authorization lives entirely in the datastore, and is the cleanest available
  // evidence that CAL-02 put the check in the right place.
  // -------------------------------------------------------------------------

  /**
   * CAL-03 AC-1, AC-2, AC-3, AC-4, AC-9, AC-10, AC-12. Every entry of the caller's team, newest
   * start date first — the caller's own included.
   *
   * DELIBERATELY FLAT, and this is the boundary with CAL-04. It takes NO date range, returns no
   * count, and is not the read the month grid issues: CAL-04's is range-shaped (`date_range=ov.…`),
   * feeds INV-04's `absenceCountsFor`, and is given the roster. This one answers "which entries
   * exist for this team" so an admin can reach a row, and it must not grow a range parameter — the
   * moment it does there are two team-entry reads and one of them will be the one nobody updated.
   * The same reasoning that kept `listOwnEntries` narrow at CAL-01.
   *
   * NO ROLE PARAMETER AND NO `is_admin` CHECK INSIDE IT. `entry_select_team` admits the team's rows
   * to every member, because `Read any entry in the team` is checked for BOTH roles in
   * .ai/standards/rbac-and-security.md — so this read is not where the admin capability lives. What
   * an admin may do with a row it returns is decided by `entry_update_admin`, in the datastore.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers` and
   * `listOwnEntries` use. There is no caller-visible failure to carry; `[]` for a broken connection
   * would report "this team has no entries", and a short list would hide entries from the one person
   * able to correct them — which is the failure TEAM_ENTRY_LIMIT exists to turn into an error.
   */
  listTeamEntries(): Promise<Entry[]>;

  // -------------------------------------------------------------------------
  // CAL-04 — the month grid. 01-plan.md section 4.
  //
  // TWO READS AND NO WRITE. Neither function computes a count: `absenceCountsFor` in
  // ./absence.ts is INV-04's single implementation and it is deliberately NOT a seam method
  // (01-plan.md section 5). With zero copies of the arithmetic in the seam there is nothing for
  // tests/seam-parity.test.ts to miss — the seam only ever returns rows.
  // -------------------------------------------------------------------------

  /**
   * CAL-04 AC-7, AC-14. The caller's own team row, or null when the caller has no member row.
   *
   * NO PARAMETER. The team is resolved by `team_select_own` from `auth.uid()`; a `teamId` argument
   * would be a value the caller SUPPLIES, which is the shape `addAllowedEmail` deliberately refused.
   *
   * `null` rather than a throw for the member-less caller, matching `getCurrentMember` — it is the
   * NotOnATeam state, which is a normal answer and already has a screen.
   *
   * IT CARRIES NO WRITE HALF AND MUST NOT GROW ONE. `Set the overload threshold` is ADM-01's and
   * `rbac-and-security.md:48` grants it to `admin` alone; the migration this ticket ships grants
   * `select` and nothing else, so an `updateTeam` here would be a function every call refuses.
   */
  getTeam(): Promise<Team | null>;

  /**
   * ADM-01 AC-2, AC-5, AC-9, AC-12, AC-14. Sets the caller's OWN team's threshold. Admin only; the
   * policy is the control and this function is the affordance.
   *
   * TAKES NO TEAM PARAMETER, for the reason `getTeam()` already records above: `team_update_admin`
   * resolves the row from `auth.uid()`, and a `teamId` argument would be a value the CALLER
   * supplies.
   *
   * IT IS A SEPARATE FUNCTION AND NOT A WRITE HALF OF `getTeam()`, which the comment above forbids
   * in terms.
   *
   * IT CARRIES NO OTHER COLUMN (AC-9). `SetOverloadThresholdInput` has one field and the column
   * grant in supabase/migrations/20260905000000_adm01_team_threshold.sql withholds every other.
   *
   * Returns the updated row. The `.select()` in the real implementation is NOT a convenience: under
   * row-level security a refused UPDATE is FILTERED, not errored — it matches nothing and PostgREST
   * answers 200 with an empty body, which `removeMember` and `promoteMember` already document in
   * src/lib/data/supabase.ts. Zero rows returned is a refusal and maps to `not_permitted`; treating
   * `!error` as success would report a refusal as done. This is the one behaviour in this contract a
   * developer will get wrong in good faith, and AC-5 is the test that catches it.
   *
   * `[0, 100]` IN WHOLE PERCENTAGE POINTS IS STILL A SCREEN DECISION (AC-7, AC-8, 01-plan.md section
   * 4.3), enforced there before anything is sent. **MIR-09, ADR-069 — THIS PARAGRAPH USED TO END "and
   * there is no `check` constraint behind this", AND THAT IS NO LONGER TRUE.** The datastore now
   * carries `team_overload_threshold_range`, checking `[0, 1]` as a fraction; both implementations
   * refuse the same fraction before sending, with `isValidThreshold` (this module), and map the
   * constraint's own SQLSTATE `23514` to the same code — `invalid_threshold` — if a caller reaches it
   * some other way. The value check runs BEFORE the permission check, so a non-admin sending an
   * out-of-range value is told the value is wrong rather than that they lack permission.
   */
  setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>>;

  /**
   * SOLO, 2026-09-11 — many teams. Every team on the system, for an ADMIN; an empty list for anybody
   * else.
   *
   * **A FUNCTION CALL AND NOT A TABLE READ, AND THE REASON IS THE OTHER READS.** `team_select_own`
   * still admits only the caller's own row, and `getTeam()` depends on that: it reads `team` with no
   * filter and `maybeSingle()`. Widening the table policy so an admin could list every team would
   * have turned that call into a multi-row error for every admin, on every screen that reads the
   * threshold. `public.list_teams()` is `security definer`, tests `is_admin` in its own body, and
   * leaves the table's policies as they were. Every cross-team function below is shaped the same
   * way for the same reason; `20260911180000_solo_many_teams.sql` carries the argument in full.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers` uses.
   */
  listTeams(): Promise<Team[]>;

  /**
   * SOLO, 2026-09-11. Every member row on ANY team, for an admin — REMOVED ones included, because the
   * screen needs them to say why a team cannot be deleted. Pending sign-ups have no team and are
   * `listPendingMembers`'.
   *
   * **`listMembers()` IS UNCHANGED AND STAYS THE CALLER'S OWN TEAM.** It is INV-04's denominator on
   * every calendar screen, so it must never start returning other teams' people for an admin — which
   * is exactly what widening `member`'s select policy would have done. A separate function, so the
   * two cannot be mistaken for each other.
   *
   * THROWS on a transport failure and on a possibly-truncated answer.
   */
  listAllMembers(): Promise<Member[]>;

  // -------------------------------------------------------------------------
  // CAL-11 — the read half of a two-row split (ADR-039, ADR-040). 01-plan.md section 4.2. CAL-12
  // is the only consumer; no screen, hook or component is this ticket's.
  //
  // Three functions, none changed: the cross-team twins of `listMembers`, `listTeamEntries` and
  // `listTeamEntriesOverlapping`, each returning exactly what an approved member of the named team
  // receives from its own-team twin — same rows, same shapes, same order — for an ADMIN caller, and
  // an EMPTY list for anybody else. Neither table policy is widened (ADR-039 § Rationale); each is
  // `security definer` and tests `public.is_admin` in its own body, the shape
  // `listAllMembers`/`listTeams` above already use.
  // -------------------------------------------------------------------------

  /**
   * CAL-11 AC-1, AC-2, AC-6, AC-7, AC-8, AC-12. Team `teamId`'s roster, REMOVED members included,
   * for an ADMIN; an empty list for anybody else. `listMembers()` is unchanged and stays the
   * caller's own team.
   * Ordered by `createdAt` ascending, then `id` ascending — `listMembers`' order.
   * THROWS on a transport failure and on a possibly-truncated answer (ROSTER_LIMIT).
   */
  listMembersForTeam(teamId: string): Promise<Member[]>;

  /**
   * CAL-11 AC-3, AC-6, AC-7, AC-8, AC-12. Every entry of team `teamId`, note included, for an
   * ADMIN; an empty list for anybody else. The cross-team twin of `listTeamEntries()`: same rows a
   * member of that team would receive, same order (`startDate` descending, then `id` ascending).
   * THROWS on a transport failure and on a possibly-truncated answer (TEAM_ENTRY_LIMIT).
   */
  listTeamEntriesForTeam(teamId: string): Promise<Entry[]>;

  /**
   * CAL-11 AC-4, AC-5, AC-6, AC-7, AC-8, AC-12. Every entry of team `teamId` whose inclusive range
   * OVERLAPS `range`, rejected rows included, for an ADMIN; an empty list for anybody else. The
   * cross-team twin of `listTeamEntriesOverlapping(range)`: same rows, same order (`startDate`
   * ascending, then `id` ascending), same page-and-assemble completeness rule (CAL-09).
   * THROWS on a transport failure and on any answer it cannot prove complete.
   */
  listTeamEntriesOverlappingForTeam(teamId: string, range: DateRange): Promise<Entry[]>;

  /**
   * SOLO, 2026-09-11. Creates an EMPTY team. Admin only (`public.create_team`); its threshold is the
   * column default, 0.5. `empty_team_name` for a name that is empty once trimmed.
   */
  createTeam(input: CreateTeamInput): Promise<Result<Team>>;

  /**
   * SOLO, 2026-09-11. Renames ANY team, by id. Admin only (`public.rename_team`).
   *
   * **IT TAKES A `teamId` NOW, WHICH `setOverloadThreshold` STILL REFUSES TO.** That function omits
   * one because its policy scopes the write to the caller's own team, and the THRESHOLD IS STILL
   * THE CALLER'S OWN TEAM ONLY. The operator decided on 2026-09-11 that every admin manages every
   * team, so for a NAME the team is the caller's choice, and the function checks `is_admin` rather
   * than ownership.
   *
   * `empty_team_name` for an empty name; `not_permitted` for a non-admin or a team that is not there.
   */
  renameTeam(teamId: string, input: RenameTeamInput): Promise<Result<Team>>;

  /**
   * SOLO, 2026-09-11. Deletes a team, and ONLY AN EMPTY ONE — the operator's decision.
   *
   * **"EMPTY" IS THE FOREIGN KEY'S DEFINITION, NOT A COUNT OF ACTIVE PEOPLE.** A removed member still
   * names the team (ADR-013 keeps them for history), so a team whose people have all been removed
   * still cannot be deleted — and never can be. `team_not_empty` says so; `member.team_id ... on
   * delete restrict` is the second lock behind the function's own test.
   */
  deleteTeam(teamId: string): Promise<Result<void>>;

  /**
   * SOLO, 2026-09-11. Moves an APPROVED, not-removed member onto another team. Admin only
   * (`public.move_member`), and ANY admin, between any two teams — the operator's decision.
   *
   * **HISTORY FOLLOWS THE PERSON, AND THE OPERATOR WAS TOLD SO BEFORE CHOOSING IT.** An entry has no
   * `team_id`; INV-07 counts it against the team its member is on NOW. So after a move every past
   * absence of that person leaves the old team's calendar and appears in the new team's past, and the
   * old team's past counts change. INV-07 holds as written; what changes is which team it names.
   *
   * It writes `team_id` and nothing else — not the role, not the removal, not the status.
   *
   * **MIR-02, ADR-064 decision 3 — NEVER THE CALLER THEMSELVES.** The control is the trigger clause
   * in `20261020120000_mir02_member_self_writes.sql`, which refuses anybody changing their own
   * `role`, `status` or `team_id` and fires inside `move_member` too. An admin moving their own id
   * is refused as `not_permitted`.
   */
  moveMember(memberId: string, teamId: string): Promise<Result<void>>;

  /**
   * SOLO, 2026-09-11. Sets whether a NEW WFH entry and a NEW PTO entry wait for an admin, for the
   * caller's OWN team. Admin only; the policy is the control and this function is the affordance.
   *
   * **IT CHANGES WHAT HAPPENS TO THE NEXT ENTRY AND NOTHING ELSE.** No entry already stored moves:
   * one that is pending stays pending and sits in the worklist until an admin decides it — the
   * operator chose that over a sweep that would approve a backlog in one press nobody reviewed. The
   * approval itself happens in the datastore at insert time
   * (`20260911170000_solo_approval_settings.sql`), because the insert grant withholds `status` from
   * every caller; this function only moves the two switches it reads.
   *
   * TAKES NO TEAM PARAMETER, and RETURNS THE UPDATED ROW with ZERO ROWS BACK A REFUSAL — both for
   * the reasons `setOverloadThreshold` spells out above, under the same `team_update_admin` policy.
   */
  setApprovalSettings(input: SetApprovalSettingsInput): Promise<Result<Team>>;

  /**
   * CAL-04 AC-1 to AC-6, AC-12. Every entry of the caller's team whose date range OVERLAPS `range`.
   *
   * THIS IS THE RANGE-SHAPED READ `listTeamEntries` refuses to become. That boundary is recorded on
   * `listTeamEntries` above and at CAL-01 on `listOwnEntries`: the flat read answers "which entries
   * exist for this team", and the moment it grows a range parameter there are two team-entry reads
   * and one of them is the one nobody updated. This is the second read, declared separately on
   * purpose.
   *
   * OVERLAP, NOT CONTAINMENT: an entry running 2026-03-28 to 2026-04-02 MUST be returned for April,
   * because AC-2 draws its avatar on 1 and 2 April. The real implementation filters on the generated
   * `date_range` column ADR-011 created for exactly this; the mock compares
   * `startDate <= range.end && endDate >= range.start`, which is the same predicate.
   *
   * RETURNS REJECTED ROWS TOO. Filtering `status` here would put a second copy of INV-04's rule
   * outside `absenceCountsFor`, which is what INV-04 exists to prevent. The one implementation of
   * the rule excludes them (AC-4).
   *
   * THROWS on a transport failure, and on any answer the seam cannot prove complete. The read PAGES
   * and assembles rather than truncating (CAL-09): it requests windows of TEAM_ENTRY_PAGE_SIZE rows
   * in the read's own order until it holds as many DISTINCT rows as the datastore says match, and it
   * refuses if it cannot. There is no partial success — a caller receives every matching entry or an
   * error, which is what lets absenceCountsFor be handed the set and called once.
   */
  listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]>;

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-11 — the busy day. One range read and one write.
  //
  // **TWO FUNCTIONS AND NOT FOUR.** There is no `listOwnBusyDays`: the caller's own marks are a
  // subset of the team's, and `busyDatesOf` in `src/lib/data/busy.ts` takes them out of the rows
  // this read already returns. A second read would be a second answer to *which days are mine*,
  // free to disagree on screen with the number drawn beside it. There is no `removeOwnBusyDay`
  // either — see `setOwnBusyDay`.
  // -------------------------------------------------------------------------

  /**
   * SOLO, 2026-09-11. Every busy-day row of the caller's team whose date falls inside `range`.
   *
   * **A PLAIN TWO-SIDED FILTER ON A SCALAR COLUMN**, the shape `listHolidays` uses and not the
   * `date_range=ov.` shape entries need: a busy day IS one date, so there is no range to overlap,
   * no generated column and no `btree_gist`. ADR-011's pattern is deliberately not copied here for
   * the reason ADR-015 § 6 gives for holidays — cost with no property bought.
   *
   * **TEAM-SCOPED, unlike `listHolidays`.** `busy_day_select_team` is keyed on `member_team_id`,
   * exactly as `entry_select_team` is, so INV-07's mechanism is the one already in the product.
   *
   * **IT PAGES AND ASSEMBLES RATHER THAN TRUNCATING**, and it refuses an answer it cannot prove
   * complete — CAL-09's shape, reused because the failure it prevents is the same one: a short read
   * here does not error, it draws a quieter day than the team really has, which is the silent wrong
   * answer that BUG-002 closed for entries. A caller receives every matching row or an error.
   *
   * THROWS on a transport failure and on a possibly-truncated answer.
   */
  listTeamBusyDaysOverlapping(range: DateRange): Promise<BusyDay[]>;

  /**
   * SOLO, 2026-09-11. Mark or unmark ONE date as busy, for the CALLER. Idempotent in both
   * directions: marking a marked day succeeds and changes nothing, and so does unmarking an
   * unmarked one.
   *
   * **ONE FUNCTION WITH A BOOLEAN, NOT `addBusyDay` AND `removeBusyDay`.** The gesture the operator
   * chose is a toggle on the day itself, and a toggle has exactly one call site; two functions
   * would make the SCREEN decide which datastore operation a press is, from state it read a moment
   * earlier. That decision belongs where the row's existence is known, which is inside the seam.
   *
   * **NO `memberId`.** The row is the caller's own and is resolved from the session inside the
   * seam — `busy_day_insert_own`s `with check` supplies it from `auth.uid()`. A parameter would
   * imply a caller could pass somebody else's and be answered, which is the reasoning `createEntry`
   * and `addAllowedEmail` both recorded before it.
   *
   * **NO APPROVAL PATH, AND THAT IS THE OPERATOR'S DECISION RATHER THAN AN OMISSION** — *"vẫn đi
   * làm bình thường. Nên không cần approve"*. There is no `status` on the row to move, so nothing
   * here can be pending and no admin screen has anything to decide.
   *
   * Returns `busy_not_permitted` when the policy refuses: a caller with no member row, a removed
   * member, or one who is not `approved`. A refused INSERT is an error under row-level security; a
   * refused DELETE is FILTERED and matches no row, so the unmark path cannot distinguish "refused"
   * from "there was nothing there" — and it must not try, because both mean the same thing to a
   * toggle whose next read is the truth.
   */
  setOwnBusyDay(input: SetOwnBusyDayInput): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // ADM-02 — the national holiday calendar, read only. 01-plan.md section 4.2.
  //
  // ONE READ AND NO WRITE. `holiday_insert_admin`, `holiday_update_admin` and
  // `holiday_delete_admin` are ADM-03's, and until they ship NEITHER ROLE can change the calendar
  // (AC-13) — so an `addHoliday` here would be a function every call refuses, which is the shape
  // `getTeam()` above already forbids itself.
  // -------------------------------------------------------------------------

  /**
   * ADM-02 AC-1, AC-2, AC-4, AC-12. Every holiday row whose date falls inside `range`, ascending.
   *
   * NO TEAM PARAMETER AND NO TEAM SCOPE. The calendar is national (ADR-015 section 1), so unlike
   * every other list read on this seam there is nothing here to narrow — `holiday_select_all` is
   * `using (true)` and a caller on any team reads the same rows (AC-14).
   *
   * A PLAIN TWO-SIDED FILTER ON A SCALAR COLUMN, and this is where ADR-011's pattern deliberately
   * does NOT transfer. `entry` needed the generated `date_range` column and `ov.` because an entry
   * SPANS a range and PostgREST filters columns rather than expressions. `holiday.date` is a scalar
   * served by the btree index `unique (date)` already builds, so there is no daterange, no
   * generated column and no `btree_gist` here. Copying that shape would be cost with no property
   * bought — ADR-015 section 6.
   *
   * INCLUSIVE AT BOTH ENDS, matching `DateRange` everywhere else on this seam.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers`,
   * `listOwnEntries`, `listTeamEntries` and `listTeamEntriesOverlapping` all use. The throw is
   * AC-12, and the reason it matters more here than anywhere else is in that criterion: one
   * truncation produces two opposite errors — a holiday rendered as an ordinary working day AND a
   * mandated Saturday rendered as an inert weekend — and both surface on a date other than the one
   * whose row was dropped.
   */
  listHolidays(range: DateRange): Promise<Holiday[]>;

  // -------------------------------------------------------------------------
  // ADM-03 — the WRITE half of the same table. 01-plan.md section 4.2.
  //
  // THE THREE FUNCTIONS THE COMMENT ABOVE SAID WOULD ARRIVE HERE, and the sentence that forbade
  // them is now spent: `holiday_insert_admin`, `holiday_update_admin` and `holiday_delete_admin`
  // ship in supabase/migrations/20260905140000_adm03_holiday_writes.sql, so these are no longer
  // functions every call would refuse. `listHolidays` above is UNCHANGED — not one character —
  // which is AC-18.
  //
  // NO TEAM PARAMETER ON ANY OF THE THREE, for the reason `listHolidays` already records: the
  // calendar is national and there is nothing to narrow. This is the only place on this seam where
  // that is true of a WRITE, and the three policies carry no team conjunct for the same reason.
  //
  // THEY DO NOT SHARE ONE SUCCESS TEST, and that is the single thing a developer gets wrong here in
  // good faith. Under row-level security a refused INSERT is REFUSED — `42501` arrives as an error
  // — but a refused UPDATE or DELETE is FILTERED: it matches no row and PostgREST answers 200 with
  // an empty body. So `addHoliday` may read an error, and the two below must count rows.
  // -------------------------------------------------------------------------

  /**
   * ADM-03 AC-1, AC-2, AC-6, AC-15, AC-16. Adds one row. Admin only; `holiday_insert_admin` is the
   * control and this function is the affordance.
   *
   * Returns the stored row, so the screen can say which year it landed in (AC-4) rather than
   * assuming the one it is displaying.
   *
   * `holiday_date_taken` ON A SECOND ROW FOR ONE DATE (AC-6). That is `unique (date)`, which ADM-02
   * created and this ticket only makes a person meet — the seam translates `23505` into a sentence
   * and nothing above it re-implements the constraint.
   */
  addHoliday(input: AddHolidayInput): Promise<Result<Holiday>>;

  /**
   * ADM-03 AC-7, AC-8, AC-10, AC-15, AC-16. Replaces the three writable columns of ONE row.
   *
   * ZERO ROWS RETURNED IS A REFUSAL, not a success — the shape `removeMember`, `promoteMember` and
   * `setOverloadThreshold` all document. Treating `!error` as success would report a member's
   * refused edit as done (AC-15).
   *
   * `holiday_date_taken` when the edit moves the row onto an occupied date (AC-7). Deliberately the
   * same code and the same sentence as `addHoliday`'s: it is the same constraint, and a second code
   * would be a second thing for a screen to branch on for no difference in what happened.
   */
  updateHoliday(holidayId: string, input: UpdateHolidayInput): Promise<Result<Holiday>>;

  /**
   * ADM-03 AC-11, AC-13, AC-15, AC-16. Removes one row. HARD delete: nothing references `holiday`,
   * there is no cascade anywhere in this model (data-model.md) and there is no trash — 01-plan.md
   * section 8 rejects a `deleted_at` column and says why.
   *
   * IT COUNTS THE DELETED ROW AS ITS SUCCESS TEST, for the reason `deleteEntry` records: a refused
   * DELETE is filtered, matches nothing, and answers 200 with an empty body. A delete has no
   * obvious return value to inspect, so without asking for the deleted representation every refusal
   * would be reported as a completed delete. Zero rows is `not_permitted` (AC-15).
   */
  deleteHoliday(holidayId: string): Promise<Result<void>>;

  /**
   * MIR-15-e. Whether the caller's org is Org public, the shared tenant: `public.member_org_id` for
   * the signed-in user, then `public.org_is_shared` on it. `false` when there is no session, no
   * member row, or the member is not approved or is removed — `member_org_id` is null for each and
   * `org_is_shared(null)` is false. An affordance for `/holidays` only (ADR-079 decision 2); the
   * write policies are the control. THROWS on any failure; the caller fails closed.
   */
  isOwnOrgShared(): Promise<boolean>;

  // -------------------------------------------------------------------------
  // ADM-04 — the worklist of entries awaiting a decision. 01-plan.md section 4.2.
  //
  // ONE READ AND NO WRITE, and the absence is the ticket's defining constraint rather than an
  // omission. `product` argued at triage that a read-only worklist is not separable from the action
  // and lost; the losing argument is kept in .ai/registry/features.md:103 precisely so nobody
  // re-argues it here. Approving and rejecting are ADM-05's, they consume `entry_update_admin` and
  // `public.entry_enforce_decision()`, and neither is reachable from this surface (AC-9).
  // -------------------------------------------------------------------------

  /**
   * ADM-04 AC-1 to AC-8, AC-11, AC-13. One page of the entries awaiting a decision, with the EXACT
   * size of the matching set.
   *
   * NOT `listTeamEntries` WITH ARGUMENTS. That read is deliberately flat and its own comment above
   * says it must not grow a parameter — "the moment it does there are two team-entry reads and one
   * of them will be the one nobody updated". This is a different question over a different set with
   * a different failure mode, and it answers with a different shape.
   *
   * NO ROLE PARAMETER AND NO `is_admin` CHECK INSIDE IT, for the reason `listTeamEntries` already
   * records: `entry_select_team` admits the team's rows to BOTH roles, so this read is not where the
   * admin capability lives. There is no admin capability behind this screen at all — the refusal on
   * it is an affordance, and a member who deleted it would see rows they can already read at
   * `/entries/team` (01-plan.md section 3).
   *
   * THE TEAM PREDICATE IS NOT WRITTEN IN THE QUERY. `entry_select_team` supplies it, and a copy here
   * would be a second expression of INV-07 above the seam (AC-13).
   *
   * ONE RESPONSE CARRIES BOTH HALVES, AND THAT IS THE DECISION. `features.md:103` requires the
   * outstanding count to derive from an exact count and never from `data.length`, and requires that
   * the badge and the list not be able to disagree. Two calls — one counting, one listing — CAN
   * disagree, because a write can land between them; one response cannot. 01-plan.md section 8,
   * rejected alternative 1.
   *
   * IT PAGES RATHER THAN TRUNCATING, which is the one read on this seam that does. A ceiling turns a
   * long queue into an error, and a queue long enough to trip it is precisely the queue an admin
   * most needs to work through (01-plan.md section 8, rejected alternative 4).
   *
   * THROWS on a transport failure, and on a SHORT PAGE THAT IS NOT THE LAST PAGE — `rows.length <
   * pageSize` while `page * pageSize + rows.length < total`. That is the datastore capping the read,
   * and it is the truncation hazard in the direction the feature row names: a queue that comes back
   * short reads as *the queue is empty*, with no error anywhere and no decision ever made (AC-5). It
   * does NOT throw on a full page — a full page is normal and is what `total` and `page` exist to
   * navigate.
   */
  listPendingEntries(query: PendingEntryQuery): Promise<PendingEntryPage>;

  /**
   * MIR-14-b AC-8, AC-9. The owners among `memberIds` whose entries the caller may decide, each with
   * every active team they belong to. An id the caller may not decide, or that names nobody, is
   * absent from the result — never an error. Order is not significant; callers key by `memberId`.
   *
   * WHY A SECOND READ AND NOT A WIDER `listMembers()`. The roster is primary-team only because it
   * feeds the absence count (ADR-072 decision 1), so a second-team decider's queue holds entries
   * whose owners it cannot name. This read names them to a decider and to nobody else —
   * `public.list_entry_owners` filters through `may_decide_entry` (01-plan.md section 8, rejected
   * alternative 1). `listPendingEntries` above is UNCHANGED.
   *
   * `[]` resolves to `[]` without a request. THROWS before any request when `memberIds` holds more
   * than PENDING_PAGE_SIZE distinct ids — the one caller passes one page's owners — and on a
   * transport failure.
   */
  listEntryOwners(memberIds: string[]): Promise<EntryOwner[]>;

  // -------------------------------------------------------------------------
  // ADM-05 — the decision itself, over ADM-04's surface. 01-plan.md section 4.2.
  //
  // THE TWO WRITES THE COMMENT ABOVE SAID WERE NOT ADM-04'S, and the sentence that forbade them is
  // now spent: `entry_update_admin` shipped with CAL-03 and clause (a) of
  // `public.entry_enforce_decision()` ships in
  // supabase/migrations/20260905190000_adm05_entry_decision.sql, so these are no longer functions
  // every call would refuse. `listPendingEntries` above is UNCHANGED — not one character.
  //
  // NEITHER TAKES A ROLE AND NEITHER CHECKS ONE, the property `updateEntry` and `deleteEntry`
  // already have and for the same reason: ownership and rank were never the seam's to decide. The
  // control is `entry_update_admin` plus clause (a); these are the affordance.
  //
  // TWO FUNCTIONS AND NOT ONE `decideEntry(entryId, decision)`. The two have DIFFERENT
  // PRECONDITIONS — a rejection carries a mandatory reason and an approval must carry none — so a
  // single function would take a `reason?: string` that is required for one value of its own
  // parameter and forbidden for the other, and the runtime check that followed would be a third
  // place INV-03 is written, after the constraint and the field (01-plan.md section 8, rejected
  // alternative 3).
  //
  // NOTHING RETURNS AN ENTRY TO `pending`. That transition is named in no permission row, and
  // `rbac-and-security.md` is human-only under RULE-01 — `approved → rejected` carries a reason and
  // is the available path (AC-11). The only route back to `pending` is INV-02's trigger, on a
  // substantive edit, which is `updateEntry`'s and not a decision at all.
  // -------------------------------------------------------------------------

  /**
   * ADM-05 AC-1, AC-4, AC-6, AC-7, AC-10, AC-16, AC-17. Approves ONE entry. Admin only, and the
   * control is clause (a) of `public.entry_enforce_decision()` — not this function, and not the
   * screen that calls it.
   *
   * IT SENDS `status` AND NOTHING ELSE. `approved_by` and `approved_at` are written by the datastore
   * from `auth.uid()` and `now()`, and anything sent for them is discarded (AC-7); `rejection_reason`
   * is nulled by the same clause, because INV-03's check is a biconditional and a transition off
   * `rejected` that leaves the reason standing is refused with a raw 23514 (AC-4). A seam that sent
   * those columns would be a second expression of clause (b) that agrees with it until one is edited.
   *
   * IT MUST COUNT THE AFFECTED ROWS. A row the policy does not admit is FILTERED, not errored:
   * PostgREST answers 200 with an empty body, so an `!error` check is green on a refusal. Zero rows is
   * `entry_not_permitted` — the shape `updateEntry` and `deleteEntry` already use (AC-16, AC-17).
   *
   * 42501 from clause (a) maps to `entry_decision_not_permitted` with a sentence (AC-8).
   *
   * `tentative` IS NOT TOUCHED (INV-05, AC-6). Approval and tentativeness are two independent axes,
   * and the column is not in this ticket's grant either.
   */
  approveEntry(entryId: string): Promise<Result<Entry>>;

  /**
   * ADM-05 AC-2, AC-3, AC-5, AC-9, AC-16, AC-17. Rejects ONE entry with a reason, and REWRITES the
   * reason on an entry that is already rejected — one function, because they are one statement:
   * `status = 'rejected'` and `rejection_reason = reason` written together. AC-5 is `rejectEntry`
   * called on a rejected row, which is why the idea calls the per-entry reason edit *"the same field
   * on the same form"*.
   *
   * REFUSES A BLANK REASON BEFORE ISSUING THE WRITE — `rejection_reason_required`, empty or
   * whitespace-only (AC-3). That is an AFFORDANCE. `entry_rejection_reason_iff_rejected` is the
   * control and it refuses the same write with 23514; this exists so the interface never renders a
   * SQLSTATE, which is the failure ADR-011 recorded for 23P01.
   *
   * NOT `public.reject_entries(uuid[], text)`. That is ADM-06's, for the batch only — ADR-016 section
   * 4: "the single approve and the single reject stay a plain PATCH", and a second path for N=1 is a
   * second thing to keep correct.
   */
  rejectEntry(entryId: string, reason: string): Promise<Result<Entry>>;

  // -------------------------------------------------------------------------
  // ADM-06 — the batch, over the same surface. 01-plan.md section 4.2.
  //
  // `approveEntry` and `rejectEntry` above are UNCHANGED — not one character — and so are
  // `listPendingEntries`, `updateEntry` and `deleteEntry`. This is one addition to the seam and no
  // amendment to it, which is why the XL clause of .ai/01-operating-model.md:375 is not engaged:
  // no existing caller changes.
  //
  // THERE IS NO BULK APPROVAL BESIDE IT. No feature row asks for one, and the asymmetry is the
  // ticket's rather than an oversight: a rejection carries a reason, which is what makes a batch of
  // them ONE act with ONE justification, and an approval carries none — so a batch of approvals is a
  // sequence of unrelated judgements with nothing binding them (01-plan.md section 1, Out of scope).
  // -------------------------------------------------------------------------

  /**
   * ADM-06 AC-1 to AC-11, AC-18. Rejects SEVERAL entries in ONE statement, with ONE reason written
   * onto every one of them.
   *
   * IT IS `public.reject_entries(p_ids uuid[], p_reason text)` AND NOT A PATCH WITH `id=in.(…)`.
   * ADR-016 section 4, verified there against the installed @supabase/postgrest-js: `in()` appends
   * the ids TO THE QUERY STRING at 37 bytes per uuid, so a few hundred meets a proxy's request-line
   * cap as an opaque 414 — at the exact moment an admin clears a backlog. Chunking to avoid that
   * reintroduces the cross-chunk partial failure a single statement does not have.
   *
   * NEITHER TAKES A ROLE NOR CHECKS ONE, the property every write on this seam has: the controls are
   * `entry_update_admin` and clause (a) of `public.entry_enforce_decision()`, both of which still run
   * AS THE CALLER because the function is `security invoker` (01-plan.md section 3).
   *
   * IT RETURNS BOTH NUMBERS. A row the policy does not admit is FILTERED, not errored — the batch
   * succeeds and changes fewer rows than it named — so `rejected` comes from the function's
   * `get diagnostics row_count` and `requested` from the de-duplicated id list, and a caller is
   * expected to compare them (AC-5, AC-18).
   *
   * IT REFUSES TWO THINGS BEFORE ISSUING ANYTHING, and both are AFFORDANCES: a blank or
   * whitespace-only reason (`rejection_reason_required`, AC-3) and an empty id list
   * (`no_entries_selected`, AC-4). The controls are `entry_rejection_reason_iff_rejected` and the
   * function's own `22023`; these exist so the interface never renders a SQLSTATE.
   *
   * FAILURE IS ATOMIC (AC-7). One statement, one transaction: if the datastore raises on any row,
   * none are rejected and this returns a failure rather than a partial count.
   *
   * NOT FOR N=1. `rejectEntry` above stays the single path — ADR-016 section 4 in terms — and this
   * function is never called to reject one entry from the row-level panel.
   */
  rejectEntries(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>>;

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-26 — report an issue. No ticket, no plan; ADR-033.
  //
  // Three functions: one write every member makes, one read only an admin is answered, and one
  // write only an admin makes. The operator's four decisions of 2026-09-26 are transcribed in
  // `supabase/migrations/20260926100000_solo_issue_report.sql`'s header and are the authority for
  // all three.
  // -------------------------------------------------------------------------

  /**
   * Sends a report. The author is the caller, resolved from the session by
   * `issue_report_insert_own`'s `with check (member_id = auth.uid())` — `CreateIssueReportInput`
   * carries no `memberId` and must never grow one.
   *
   * **`Result<void>` AND NOT `Result<IssueReport>`, WHICH IS A CONSEQUENCE OF THE POLICIES AND NOT A
   * SHORTCUT.** There is no `issue_report_select_own`: a reporter has no screen that reads a report
   * back, so that permission would exist for nothing. A `RETURNING` clause is checked against the
   * SELECT policies, so an insert that asked for its own row would be answered with nothing for the
   * very person who just wrote it — success indistinguishable from refusal. So it does not ask.
   *
   * **`!error` IS SUCCESS HERE, AND ONLY HERE.** Every other write in this seam documents the
   * opposite, because a refused UPDATE or SELECT under row-level security is FILTERED and answers an
   * empty body. An INSERT is not: `with check` RAISES `42501`. The asymmetry is the policy's, not
   * this seam's, and it is written out at both implementations' call sites so neither can be read as
   * having forgotten the rule the other follows.
   *
   * A blank or over-long message is refused in the seam as `invalid_issue_message`, before a request
   * is issued — the two check constraints are still the control.
   *
   * **SOLO, 2026-09-26 (second run) — IT UPLOADS THE IMAGES TOO, AND THE ORDER MATTERS.** Every
   * refusal this function can make is made FIRST, before a byte is sent: the message rule, then the
   * count, size and type of each file. Only then are the objects uploaded and only then is the row
   * inserted. A person who attached a fourth image learns that immediately rather than after three
   * successful uploads.
   *
   * **AN UPLOAD THAT SUCCEEDS BEFORE AN INSERT THAT FAILS LEAVES AN ORPHANED OBJECT**, and there is
   * no delete path to collect it. No transaction spans storage and a table, so a window like this
   * exists in every design of this feature; this is where it is, and its residue is invisible rather
   * than harmful.
   */
  createIssueReport(input: CreateIssueReportInput): Promise<Result<void>>;

  /**
   * SOLO, 2026-09-26 (second run). How many reports are still `open`.
   *
   * **A COUNT AND NOT `listIssueReports().length`**, which is what the admin tab strip needs and the
   * only thing it needs. The real implementation asks PostgREST for a count with no body at all;
   * reading five hundred rows on every admin navigation to render one number is the shape this
   * function exists to avoid.
   *
   * A NON-ADMIN IS ANSWERED `0`, not refused. `issue_report_select_admin` filters, so the count of
   * what they may see is genuinely zero — the badge is simply absent for them, which is the same
   * answer by a different route and leaks nothing.
   */
  countOpenIssueReports(): Promise<number>;

  /**
   * SOLO, 2026-09-26 (third run). How many people have signed up and are still waiting for an admin
   * to decide — `listPendingMembers()`'s count, and the badge on the `New sign-ups` tab.
   *
   * **IT SITS BESIDE `countOpenIssueReports` AND IS THE SAME SHAPE ON PURPOSE.** The operator asked
   * for *"the same number"* on this tab, so the two are one pattern rather than two: a count
   * function per badge, read in one place by `AdminLayout`, each answering `0` for somebody the
   * policy filters and THROWING rather than guessing when the read fails.
   *
   * A count and not `listPendingMembers().length` for the reason that one records: reading whole
   * member rows on every admin navigation to render one digit is what these functions exist instead
   * of. `member_select_pending_admin` is the policy either way.
   */
  countPendingMembers(): Promise<number>;

  /**
   * SOLO, 2026-09-26 (second run). Exchanges the object paths on a report for URLs a browser can
   * load.
   *
   * **THE BUCKET IS PRIVATE, WHICH IS WHY THIS EXISTS.** A path is not loadable; a signed URL is,
   * for a short time. Minting one is checked against `issue_image_select_admin` exactly as a direct
   * read would be, so this widens nothing — it moves the check to minting time and lets an `<img>`
   * tag load without carrying a session.
   *
   * Answers in the SAME ORDER it was given, and DROPS nothing: a path that cannot be signed comes
   * back as `null` in its own position, so a caller rendering a gallery shows a broken slot rather
   * than silently shifting the images that follow it.
   */
  issueImageUrls(paths: string[]): Promise<(string | null)[]>;

  /**
   * Every report, newest first. **EVERY ADMIN READS EVERY REPORT** — the operator's fourth decision,
   * and `issue_report_select_admin` carries no team predicate at all.
   *
   * A non-admin is answered an EMPTY ARRAY and not an error, which is what a filtering select policy
   * does and what every other admin read in this seam already documents: a screen asking is told
   * "no reports" rather than "forbidden", and the screen is what decides to say *this page is for
   * admins* instead.
   *
   * Throws — never returns a short list — when the row count reaches `ISSUE_REPORT_LIMIT`. A report
   * silently not shown is the whole feature failing quietly.
   */
  listIssueReports(): Promise<IssueReport[]>;

  /**
   * Marks one report `done`, or puts it back to `open`. Admin-only, by
   * `issue_report_update_admin` plus the `grant update (status)` column list — which is also what
   * stops an admin editing the `message` of a report they disagree with. That grant is the control;
   * this signature's inability to carry a message is only an affordance.
   *
   * ZERO ROWS RETURNED IS A REFUSAL, not a success — the shape `removeMember`, `promoteMember`,
   * `updateHoliday` and `setOverloadThreshold` all document, and the reason this one does `.select()`
   * where `createIssueReport` above does not: an admin holds the select policy, so the row comes
   * back and its absence means something.
   */
  setIssueReportStatus(reportId: string, status: IssueStatus): Promise<Result<IssueReport>>;

  // -------------------------------------------------------------------------
  // EVT-01 — events. 01-plan.md section 4.2. ADR-045, ADR-046.
  //
  // Seven functions, none of them changing an existing one. Every check below the seam is a policy,
  // a column grant, a constraint or one of two `security definer` helpers in
  // `supabase/migrations/20260929120000_evt01_event.sql` (ADR-005); anything either implementation
  // refuses before the round trip is an affordance and says so.
  //
  // `listMembers()` IS UNTOUCHED, AND SO IS EVERY POLICY ON `public.member` (AC-12, INV-04). The
  // picker reads `listMemberDirectory()`, a separate definer read with five columns — since MIR-04
  // (ADR-066) not every member of every team, but the caller's own team plus the people an event or
  // a notification already connects them to, and every team for an admin.
  // -------------------------------------------------------------------------

  /** Every event the caller may read (§ 3), ordered by `startDate` ascending, then `id`. The policy
   *  does the filtering; this function adds none. */
  listEvents(): Promise<CalEvent[]>;

  /** One event, or null when it does not exist OR the caller may not read it — deliberately the same
   *  answer (AC-22). */
  getEvent(eventId: string): Promise<CalEvent | null>;

  /** The member ids named on an event. Empty for a caller who may not edit it (AC-13) — the policy
   *  returns no rows, and that is the whole mechanism. */
  listEventInvitees(eventId: string): Promise<string[]>;

  /** The picker's and the name resolvers' source: approved, non-removed members who are the
   *  caller's own team, plus the creator of any event they may read, the invitees of any event they
   *  may manage, attendees they can see, and actors of their notifications; every team for an admin;
   *  empty without a team. ADR-066 (MIR-04). The caller included, ordered by `teamName` then
   *  `displayName`. */
  listMemberDirectory(): Promise<DirectoryMember[]>;

  /** AC-1, AC-2, AC-3, AC-11. One call to `public.save_event`, so the row and its named list are
   *  written in one transaction. */
  createEvent(input: SaveEventInput): Promise<Result<CalEvent>>;

  /** AC-14, AC-16, AC-17. Replaces every field and the named list. */
  updateEvent(eventId: string, input: SaveEventInput): Promise<Result<CalEvent>>;

  /** AC-15, AC-16, AC-17. The named list goes with the row (`on delete cascade`, § 6). A delete that
   *  touches zero rows is `event_not_permitted`, not success. */
  deleteEvent(eventId: string): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // EVT-02 — attendance. 01-plan.md section 4.3. ADR-045.
  //
  // Four functions. Every check below the seam is a policy, a column grant, a constraint or a trigger
  // in `supabase/migrations/20260929140000_evt02_attendance.sql` (ADR-005). THE CAP IS HELD BY
  // `event_attendance_guard` UNDER THE EVENT ROW'S LOCK — anything either implementation checks
  // before the round trip is an affordance, never the control (ADR-045 § Consequences).
  //
  // `listMembers()` IS UNTOUCHED, AND SO IS EVERY POLICY ON `public.member` (AC-23, INV-04). An
  // attendance carries ids and a state only; names resolve through `listMemberDirectory()`.
  // -------------------------------------------------------------------------

  /** EVT-02. The attendance rows of one event the caller may read (§ 3): every `attending` row to any
   *  reader of the event; every row to its creator and admins; the caller's own row to the caller.
   *  Empty for an event the caller cannot read. Ordered `createdAt` ascending, then `memberId`.
   *  Bounded by `DATASTORE_MAX_ROWS` and throws at the bound, as `listEvents` does. */
  listEventAttendance(eventId: string): Promise<EventAttendance[]>;

  /** EVT-02. AC-6, AC-7, AC-8, AC-10, AC-11, AC-13, AC-19. Inserts the caller's row; the DATABASE
   *  decides whether it is `pending` or `attending`. No parameter can name a member or a state. */
  joinEvent(eventId: string): Promise<Result<EventAttendance>>;

  /** EVT-02. AC-14, AC-15. Deletes the caller's own `pending` or `attending` row. Zero rows deleted is
   *  a refusal: `event_registration_closed` when the caller can read a row of theirs that is pending
   *  or attending (so the only clause left is the date), otherwise `attendance_not_permitted`. */
  leaveEvent(eventId: string): Promise<Result<void>>;

  /** EVT-02. AC-16, AC-17, AC-18. `attending` approves a pending row, `rejected` rejects it,
   *  `removed` removes an attendee. Zero rows updated is `attendance_not_permitted`. */
  decideAttendance(
    eventId: string,
    memberId: string,
    status: "attending" | "rejected" | "removed",
  ): Promise<Result<EventAttendance>>;

  // -------------------------------------------------------------------------
  // EVT-03 — events on the week and month grids. 01-plan.md § 4.3. ADR-049.
  //
  // Two reads, none changed, no migration. Both are filters over rows existing policies already
  // return the caller; neither widens what anybody can read (ADR-049 revert condition 2).
  // -------------------------------------------------------------------------

  /** EVT-03 AC-6..AC-8, AC-11. The CALLER's own attendance rows across every event, any status.
   *  Filtered by `member_id = caller` explicitly, because the policy returns an admin every row.
   *  Empty for a caller with no member row. Ordered `eventId` asc. Bounded by DATASTORE_MAX_ROWS and
   *  throws at the bound, as `listEventAttendance` does. */
  listOwnEventAttendance(): Promise<EventAttendance[]>;

  /** EVT-03 AC-9, AC-10. Of the events `listEvents()` returns the caller, those relevant to team
   *  `teamId` (`eventsRelevantToTeam`, § 4.2), with "on the team" read from `listMembersForTeam(teamId)`
   *  restricted to `removedAt === null && status === "approved"`. A non-admin's `listMembersForTeam`
   *  is empty, so for them it is never wider than `listEvents()`. Same order as `listEvents()`.
   *  THROWS on any failure of its reads, and at the DATASTORE_MAX_ROWS bound. */
  listEventsForTeam(teamId: string): Promise<CalEvent[]>;

  // -------------------------------------------------------------------------
  // EVT-04 — notifications. 01-plan.md section 4.2. ADR-050.
  //
  // Four functions. Every row is written by a trigger in
  // `supabase/migrations/20261008120000_evt04_notification.sql`; NO SEAM FUNCTION WRITES ONE. Reads
  // and marks are the caller's own rows only — the policy has no admin clause (AC-11).
  // -------------------------------------------------------------------------

  /** EVT-04 AC-14, AC-16. The caller's notifications, newest first (`createdAt` desc, then `id`
   *  desc), at most NOTIFICATION_LIMIT. Empty for a caller with no member row or no team. Throws on a
   *  read failure, as the other reads do. */
  listNotifications(): Promise<EventNotification[]>;

  /** EVT-04 AC-13. The exact number of the caller's notifications with `readAt` null — all of them,
   *  not only the window. 0 for a caller with no member row or no team. Throws on a read failure. */
  countUnreadNotifications(): Promise<number>;

  /** EVT-04 AC-14. Sets `readAt` on one of the caller's notifications if it is unread. Already read,
   *  or not the caller's: ok, and nothing changes — the same answer, so it confirms nothing. */
  markNotificationRead(notificationId: string): Promise<Result<void>>;

  /** EVT-04 AC-15. Sets `readAt` on every unread notification of the caller's, beyond the window too.
   *  Returns how many were marked. */
  markAllNotificationsRead(): Promise<Result<number>>;

  // -------------------------------------------------------------------------
  // EVT-05 — the event email switch. 01-plan.md section 4.2. ADR-051, ADR-053.
  //
  // Two functions. NOTHING IN THE SEAM SENDS, QUEUES OR NAMES AN EMAIL: the database hands email-kind
  // notifications to the sender from a trigger (`supabase/migrations/20261009090000_evt05_event_email.sql`),
  // and ADR-051 decision 3 forbids the browser calling it.
  // -------------------------------------------------------------------------

  /** EVT-05 AC-14. Whether the caller receives event email. Null when nobody is signed in or the
   *  caller has no member row — a normal answer, as `getCurrentMember` gives. Throws on a read
   *  failure, as the other reads do. */
  getEventEmailEnabled(): Promise<boolean | null>;

  /** EVT-05 AC-14, AC-15. Sets the caller's own switch and returns the saved value. No member id
   *  parameter, and there must never be one. No row written (no member row, or removed): fails with
   *  `unknown` and the sentence "Your email setting could not be saved." */
  setEventEmailEnabled(enabled: boolean): Promise<Result<boolean>>;

  // -------------------------------------------------------------------------
  // EVT-06 — the guest link. 01-plan.md section 4.2. ADR-052.
  //
  // Four functions, none changing an existing one. Open, close and the link read are a table and
  // three policies in `supabase/migrations/20261009120000_evt06_guest_link.sql`; the guest read is
  // two `security definer` functions, THE ONLY OBJECTS THE ANON ROLE MAY CALL. `listMembers()` and
  // every policy on `public.member` are untouched (INV-04).
  // -------------------------------------------------------------------------

  /** EVT-06 AC-1, AC-3. The event's guest link, or null when it is not open OR the caller may not
   *  manage it — deliberately the same answer. Throws on a read failure. */
  getEventGuestLink(eventId: string): Promise<EventGuestLink | null>;

  /** EVT-06 AC-1, AC-2, AC-3, AC-5, AC-6. Inserts the row; the database chooses the token. A 23505
   *  (already open) is NOT an error: the existing link is read back and returned (AC-6). 42501, or
   *  a 23505 whose read-back finds nothing, is `event_not_permitted`. */
  openEventToGuests(eventId: string): Promise<Result<EventGuestLink>>;

  /** EVT-06 AC-3, AC-4. Deletes the row and reads back what it removed; zero rows is
   *  `event_not_permitted`, not success — `deleteEvent`'s shape. */
  closeEventToGuests(eventId: string): Promise<Result<void>>;

  /** EVT-06 AC-9..AC-14, AC-16, AC-17. Works with no session. Null for a token failing
   *  GUEST_LINK_TOKEN_PATTERN (no round trip), and for one that is not an open event's. Two calls —
   *  `get_guest_event` then `list_guest_event_attendees` — merged; `seatsTaken` comes from the
   *  first, never from the length of the second. The attendee read is bounded by
   *  DATASTORE_MAX_ROWS and throws at the bound, as `listEventAttendance` does. Throws on any other
   *  read failure. */
  getGuestEvent(token: string): Promise<GuestEvent | null>;

  // -------------------------------------------------------------------------
  // EVT-07 — guest registration. 01-plan.md section 4.2. ADR-052.
  //
  // Six functions. Four work with no session and take only a token: they are the anon role's only
  // writes. Members read guests through `event_guest`'s select policy; emails through a definer
  // function that answers the creator and admins only. The cap is `event_guest_guard`'s, under the
  // event row's lock — nothing here counts seats to decide a write.
  // -------------------------------------------------------------------------

  /** EVT-07 AC-22. Null for a token failing GUEST_LINK_TOKEN_PATTERN (no round trip) and for one that
   *  is not an open event's. Throws on a read failure. */
  getGuestRegistrationTerms(token: string): Promise<GuestRegistrationTerms | null>;

  /** EVT-07 AC-1..AC-10. Works with no session. Trims both values. A token failing the pattern is
   *  `guest_link_not_found` with no round trip; name and email failing § 4.1's checks are refused
   *  before the round trip with the same codes the database would give. */
  registerGuest(token: string, name: string, email: string): Promise<Result<GuestRegistrationReceipt>>;

  /** EVT-07 AC-11, AC-13, AC-20. Works with no session. Null for a malformed or unknown manage token.
   *  Throws on a read failure. */
  getGuestRegistration(manageToken: string): Promise<GuestRegistrationView | null>;

  /** EVT-07 AC-12, AC-13. Works with no session. A malformed token is `guest_registration_not_found`
   *  with no round trip. */
  cancelGuestRegistration(manageToken: string): Promise<Result<void>>;

  /** EVT-07 AC-14, AC-15, AC-16. The guests of one event the caller may read: attending guests to any
   *  reader; every guest to its creator and admins. `email` filled only for the creator and admins.
   *  Empty for an event the caller cannot read, and signed out. Ordered `createdAt`, then `id`.
   *  Bounded by DATASTORE_MAX_ROWS and throws at the bound. */
  listEventGuests(eventId: string): Promise<EventGuest[]>;

  /** EVT-07 AC-16, AC-17, AC-18. `attending` approves a pending guest, `rejected` rejects one,
   *  `removed` removes an attending one. Zero rows updated is `attendance_not_permitted`. */
  decideGuest(guestId: string, status: "attending" | "rejected" | "removed"): Promise<Result<EventGuest>>;

  // -------------------------------------------------------------------------
  // EVT-13 — a signed-in reader leaves the guest page. 01-plan.md section 4.2. ADR-061 decision 8.
  // -------------------------------------------------------------------------

  /** EVT-13 AC-1..AC-7. The id of the event behind an OPEN guest link, only when the signed-in caller
   *  can read that event; null otherwise — signed out, not a reader, a closed, deleted or unknown
   *  link alike. Null for a token failing GUEST_LINK_TOKEN_PATTERN, with no round trip. Throws on a
   *  read failure. */
  getGuestLinkEventId(token: string): Promise<string | null>;

  // -------------------------------------------------------------------------
  // EVT-08 — email invitations. 01-plan.md section 4.2. ADR-055.
  //
  // Two functions. NOTHING IN THE SEAM SENDS, QUEUES OR NAMES A MAIL: `invite_to_event` writes the
  // rows and an after-insert trigger hands each to the sender (ADR-051 decision 3, ADR-055 decision
  // 7). Nothing here says whether an address belongs to a member, and nothing may (AC-7).
  // -------------------------------------------------------------------------

  /** EVT-08 AC-1..AC-11. Trims each address and drops empties; refuses the whole call before the
   *  round trip with `invalid_invitation_email` when nothing is left or any address fails § 4.1's
   *  checks. One outcome per distinct address (ignoring case), in first-entered order. Opens the
   *  event to guests when it is not open. */
  inviteToEvent(eventId: string, emails: string[]): Promise<Result<EmailInvitationOutcome[]>>;

  /** EVT-08 AC-12, AC-13. The event's invitations, newest first (`createdAt` desc, then `id`), to its
   *  creator and admins; empty to everyone else and signed out. Bounded by DATASTORE_MAX_ROWS and
   *  throws at the bound. */
  listEventEmailInvitations(eventId: string): Promise<EventEmailInvitation[]>;

  // -------------------------------------------------------------------------
  // TSK-01 — a member's own tasks. 01-plan.md section 4.2. ADR-057.
  //
  // Seven functions. Every read and write is the CALLER'S OWN ROWS ONLY — the four policies on
  // `public.task` have no admin, manager or team arm. "Today" is `eventToday()`, Asia/Ho_Chi_Minh.
  // -------------------------------------------------------------------------

  /** TSK-01 AC-1, AC-22; TSK-06 AC-8. The caller's tasks with from <= date <= to, ordered `date`,
   *  then `done` (false first), then `timeOfDay` ascending with null last, then `createdAt`, then
   *  `id` (ADR-062 decision 5). Empty when from > to (no round trip), signed out, or not an approved member.
   *  Bounded by DATASTORE_MAX_ROWS and throws at the bound. Throws on any other read failure. */
  listTasks(from: string, to: string): Promise<Task[]>;

  /** TSK-01 AC-13, AC-14. The caller's tasks with done = false and date < today, ordered `date`,
   *  `createdAt`, `id` ascending. `today` is the caller's `eventToday()`, passed in so the screen and
   *  the read agree on one instant. Empty signed out. Bounded and throwing as `listTasks`. TSK-06
   *  AC-10: this order is NOT `listTasks`' — the time does not enter it. */
  listOverdueTasks(today: string): Promise<Task[]>;

  /** TSK-01 AC-6, AC-7, AC-8; TSK-06 AC-1, AC-4. Trims title and note (an empty note becomes
   *  null), then refuses `invalid_task_title`, `invalid_task_note`, `invalid_task_time`, or
   *  `task_date_past` (date < eventToday()) before the request; "" or null time is no time. Returns the saved row. 42501 or no session is `task_not_permitted`. */
  createTask(input: CreateTaskInput): Promise<Result<Task>>;

  /** TSK-01 AC-8, AC-10; TSK-06 AC-2, AC-4. Trims and refuses as `createTask` does for title, note
   *  and time; the date is not written. Zero rows updated is `task_not_permitted`. Returns the saved row. */
  updateTask(taskId: string, input: UpdateTaskInput): Promise<Result<Task>>;

  /** TSK-01 AC-11. Refuses `task_date_past` when date < eventToday(), before the request. Writes the
   *  date only — TSK-06 AC-3: the time is kept. Zero rows updated is `task_not_permitted`. Returns the saved row. */
  moveTask(taskId: string, date: string): Promise<Result<Task>>;

  /** TSK-01 AC-9. Writes `done` only. Zero rows updated is `task_not_permitted`. Returns the saved
   *  row. */
  setTaskDone(taskId: string, done: boolean): Promise<Result<Task>>;

  /** TSK-01 AC-12. Deletes and reads back what it removed; zero rows is `task_not_permitted`, not
   *  success — `deleteEvent`'s shape. */
  deleteTask(taskId: string): Promise<Result<void>>;
}

export type { DataSeam as Seam };

// Which implementation a build resolves to. 02-design.md section 6.2.
//
// This file is the one door, and it makes the choice — nothing above the seam names an
// implementation. The first two revisions of the design were silent on this, so SignUp.tsx imported
// `./supabase` by hand and the end-to-end build constructed a real client against an absent
// VITE_SUPABASE_URL, which raises `supabaseUrl is required.` on submit. QA found it as five failing
// tests with no error on screen.
//
// Importing both implementations is safe: supabase.ts builds its client lazily, and that laziness
// already exists for this exact reason. The two `import type` lines back from mock.ts and
// supabase.ts are erased at build, so there is no runtime cycle.
const usesMock = import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL;

/**
 * Read by `App.tsx` to render `seam-banner`. A silent fallback to a fake datastore is the failure
 * that rule exists to prevent: a deployment that forgets one environment variable would otherwise
 * accept sign-ups into memory and look entirely normal.
 */
export const seamName: "mock" | "supabase" = usesMock ? "mock" : "supabase";

export const seam: DataSeam = usesMock ? mockSeam : supabaseSeam;
