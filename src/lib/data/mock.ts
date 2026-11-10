// The in-memory implementation. Component tests run against this.
// Parity with supabase.ts is asserted by the seam-parity test, not by convention.
//
// It reproduces the TRIGGER's behaviour, not the interface's (02-design.md section 3): an
// allow-listed address gets a member row and consumes the entry, an unlisted or already-consumed one
// succeeds and creates nothing. A mock that always created a member would make every component test
// pass against a broken trigger, which is the one failure a mock seam can cause and not catch.
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
// SOLO 2026-09-12, ADR-035. The role predicates, above the seam and shared with the screens so
// the mock and the interface cannot disagree about who may decide.
import { mayAdminister, mayDecide, mayDecideEntriesOf } from "@/lib/roles";
// EVT-02, 01-plan.md section 4.2. `public.event_registration_open`, reproduced.
import { eventToday, registrationOpen } from "@/lib/event-registration";
// EVT-03. The admin's other-team narrowing (Q4-A) — one rule, shared with supabase.ts.
import { eventsRelevantToTeam } from "@/lib/event-layer";
import type {
  MemberDecision,
  BulkRejectionOutcome,
  BusyDay,
  DateRange,
  Entry,
  // MIR-14-b, 01-plan.md section 4.3.
  EntryOwner,
  EntryStatus,
  // SOLO, 2026-09-26 — report an issue.
  CreateIssueReportInput,
  Holiday,
  IssueReport,
  IssueStatus,
  Member,
  PendingEntryPage,
  PendingEntryQuery,
  Result,
  Session,
  Team,
  MemberRole,
  // EVT-01, 01-plan.md section 4.1.
  CalEvent,
  DirectoryMember,
  Failure,
  // EVT-02, 01-plan.md section 4.1.
  EventAttendance,
  // EVT-04, 01-plan.md section 4.1.
  EventNotification,
  NotificationKind,
  // EVT-06, 01-plan.md section 4.1.
  EventGuestLink,
  GuestEvent,
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
// EVT-04. The panel's window — AC-16. A runtime import.
import { NOTIFICATION_LIMIT } from "../domain/types";
// EVT-06 AC-13. The token's shape, checked before any lookup — a runtime import.
import { GUEST_LINK_TOKEN_PATTERN } from "../domain/types";
// EVT-07 AC-4. The ceilings and the shape, checked as the table's checks state them — runtime imports.
import { GUEST_EMAIL_MAX, GUEST_EMAIL_PATTERN, GUEST_NAME_MAX } from "../domain/types";
// EVT-11 AC-6. The cap, counted as `octet_length` counts it — runtime imports.
import { DESCRIPTION_MAX_BYTES, descriptionBytes } from "../domain/types";
// TSK-01 AC-8. The bounds, checked before the write as the real seam checks them.
import { TASK_NOTE_MAX, TASK_TITLE_MAX } from "../domain/types";
// TEA-03, and CAL-04 for the third. RUNTIME imports, not type ones - 02-design.md section 1.1.
// ADM-04 adds PENDING_PAGE_SIZE, which is a WINDOW and not a ceiling - see its own comment there.
// CAL-09 adds TEAM_ENTRY_PAGE_SIZE and TEAM_ENTRY_MAX_PAGES, which are a window and a bound on work
// for the same reason, and removes MONTH_ENTRY_LIMIT: `listTeamEntriesOverlapping` was its only
// reader here and now pages instead. The constant still exists and its docblock says why.
import { requiresEmailConfirmation } from "../config";
// SOLO, 2026-09-10. `FixtureCredential` is the shape `signIn` already searches, so an account
// created at sign-up is stored in it rather than in a second shape that would have to be kept
// compatible with it by hand.
import type { FixtureCredential } from "../fixtures";
// SOLO, 2026-09-11. The one answer to "does this type wait for an admin", which `createEntry` below
// runs in place of `entry_apply_approval_setting()`. Imported rather than inlined so the mock holds no
// second copy of the rule — `approval.ts` records why the SQL one is unavoidable and this is not.
import { needsApproval } from "./approval";
// SOLO, 2026-09-11. INV-01's comparison, and the dates it collides on — one predicate for the refusal
// and the sentence. See the note where `PORTION_SLOTS` used to be.
import { clashingDates, overlapMessage } from "./overlap";
// SOLO, 2026-09-26 — report an issue. A ceiling, imported as a value at the call, exactly as the
// four limits above it are.
import { ISSUE_IMAGE_MAX_BYTES, ISSUE_IMAGE_MAX_COUNT, ISSUE_IMAGE_TYPES } from "../domain/types";
import {
  AVATAR_CHOICES,
  DEFAULT_AVATAR,
  HOLIDAY_LIMIT,
  PENDING_PAGE_SIZE,
  ROSTER_LIMIT,
  TEAM_ENTRY_LIMIT,
  TEAM_ENTRY_MAX_PAGES,
  TEAM_ENTRY_PAGE_SIZE,
} from "../domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_APPROVED_MEMBER_CREDENTIAL,
  FIXTURE_CREDENTIALS,
  FIXTURE_HOLIDAYS,
  FIXTURE_ISSUE_REPORT,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_PENDING_SIGNUP,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "../fixtures";

// SOLO, 2026-09-10. `AllowedEmailRow` aliased the domain type until the allow-list was removed
// whole. Nothing in this file models that table any more.

// AC-4: `allowed_email.email` is citext in the migration, so the database compares without regard to
// case. The mock has no citext, so it folds on the way in and on the way out — same behaviour, and
// the fold is in one place so it cannot drift between the two lookups.
const fold = (email: string): string => email.trim().toLowerCase();


// Seeded from the shared fixture module, which holds the same rows as supabase/seed.sql
// (.ai/standards/architecture.md: "a mock, in memory, seeded from the shared fixture module").
//
// TEA-02 adds FIXTURE_MEMBER: the denial half of AC-8 needs somebody to be denied as, and
// `__setCurrentMember` below is how a test becomes them.
//
// TEA-03 adds the other two. Both exist to make a criterion OBSERVABLE that a one-team, all-active
// roster cannot show: FIXTURE_OTHER_TEAM_MEMBER is the row AC-2 says must never come back, and
// FIXTURE_REMOVED_MEMBER is the row AC-4 says the read must keep and the screen must not draw.
//
// TEA-04 adds FIXTURE_SECOND_ADMIN, for the same kind of reason: AC-13 asserts that an admin row
// which is NOT the caller carries a remove control and no promote control, and with one admin
// fixture the caller and that row are the same row.
//
// EACH ROW IS COPIED rather than referenced. TEA-04 is the first ticket whose writes MUTATE a
// seeded row - `removeMember` sets `removedAt` and `promoteMember` sets `role` - and the fixtures
// are shared module-level objects that every test and both implementations import. Holding the
// references here would let one mock write change what `FIXTURE_MEMBER` means everywhere for the
// rest of the process.
//
// CAL-02 adds FIXTURE_APPROVED_MEMBER, and it is the entry below rather than the roster that needs
// it: AC-5 and AC-6 edit an APPROVED entry, nothing in the product can create one, and neither
// FIXTURE_MEMBER nor FIXTURE_ADMIN can own it without breaking CAL-01's suite, which must pass
// unedited (01-plan.md section 4.3).
const members: Member[] = [
  { ...FIXTURE_ADMIN },
  { ...FIXTURE_MEMBER },
  { ...FIXTURE_SECOND_ADMIN },
  { ...FIXTURE_OTHER_TEAM_MEMBER },
  { ...FIXTURE_REMOVED_MEMBER },
  { ...FIXTURE_APPROVED_MEMBER },
  // SOLO, 2026-09-10. Waiting on an admin: no team, `pending`. Invisible to every roster read
  // (`listMembers` filters on `teamId`), so it moves no count and no threshold. LAST in the array
  // deliberately: two shipped tests index into this list, and inserting ahead of them changed which
  // member they were about.
  { ...FIXTURE_PENDING_SIGNUP },
];

// TEA-03, 02-design.md section 1.4. `createdAt` ascending, then `id` ascending. The id tiebreaker is
// not decoration: FIXTURE_ADMIN, FIXTURE_MEMBER and FIXTURE_REMOVED_MEMBER share a `createdAt`
// literal, so `createdAt` alone leaves their order dependent on insertion order here and on physical
// row order in PostgreSQL - two implementations that disagree about order fail nothing and produce a
// flaky test.
const byCreatedAtThenId = (a: Member, b: Member): number =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

// CAL-04. The mock's `team` table, and it is the first read of it anywhere.
//
// Both rows are COPIED rather than referenced, for the reason `members` records: the fixtures are
// shared module-level objects that every test imports, and nothing should be able to mutate one
// through this array. Nothing writes `team` today - `Set the overload threshold` is ADM-01's and
// this ticket's migration grants `select` and nothing else - so the copy is a precaution against the
// ticket that adds the update, not against anything here.
//
// TWO rows and not one, and the second is the whole of AC-12 on this table: `team_select_own` scopes
// the read to `id = member_team_id(auth.uid())`, and a one-team fixture passes whether that
// predicate is in the policy or absent from it. ADR-018's revert condition, one table over.
const teams: Team[] = [{ ...FIXTURE_TEAM }, { ...FIXTURE_OTHER_TEAM }];

// SOLO, 2026-09-11 — many teams. The id a team created through the product gets, in the shape the
// other generators use: an `aa` prefix, which no other table's ids in this file or the fixtures use.
let nextTeamId = 0;
const newTeamId = (): string =>
  `aa000000-0000-4000-8000-${String(++nextTeamId).padStart(12, "0")}`;

// SOLO, 2026-09-10 — accounts created through the sign-up form, when the project is configured not
// to require email confirmation (`src/lib/config.ts`).
//
// **IT IS EMPTY AT MODULE LOAD AND RESETS WITH EVERY DOCUMENT LOAD**, exactly as `members` and
// `allowedEmails` do. Nothing seeded goes in here: this list is what the running session created,
// and a fixture that appeared in it would be a seed row with no counterpart in `supabase/seed.sql`
// — the drift `fixtures.ts` § 5.1 exists to repair.
//
// It is searched LAST by `signIn`, so a sign-up that reused a seeded address cannot shadow the
// fixture's password and change what every other spec file's sign-in means.
const signedUp: FixtureCredential[] = [];

// SOLO, 2026-09-10. The seeded allow-list stood here. The table is gone; a person who signs up now
// gets a pending member row instead, and an admin decides.

let nextUserId = 0;
const newUserId = (): string => `00000000-0000-4000-8000-${String(++nextUserId).padStart(12, "0")}`;

// TEA-05. The mock's session, and the mock now HAS one.
//
// Until this ticket there was no sign-in anywhere, so `currentMemberId` below was seeded to
// FIXTURE_ADMIN and moved only by the test hook - the mock fabricated an identity because nothing
// could establish one. It no longer fabricates: `signIn` sets both of these together and `signOut`
// clears both, which is what the real seam does by way of `auth.getUser()` reading the stored
// session. With nobody signed in, `getCurrentMember()` answers null in BOTH implementations, and
// /allow-list and /members fail safe against the mock exactly as they already do against Supabase.
//
// AMENDED on the second cycle. This paragraph read "Starting at null is the consequence, and it is
// the correct one" - and null was the wrong start, because the real seam does not start at null
// after a reload. See the block immediately below; the amendment is that sentence and nothing else.
// TEA-05 AC-7. Where the mock's session survives a page load.
//
// The real seam does not IMPLEMENT AC-7 either, it inherits it: `persistSession` is a
// @supabase/auth-js default, so the client writes the session to `localStorage` and restores it on
// the next load (supabase.ts:454). A mock holding the session only in module state answers null
// after a reload while the real one answers the session - parity in the seam's KEYS and not in its
// behaviour, and AC-7 is the criterion that difference shows up in. 01-plan.md section 5 puts
// `getSession` after `signIn` and before `signOut` opposite AC-7, and a reload sits inside that
// window. So the mock stores it too, under its own key, which the real client never reads.
const SESSION_STORAGE_KEY = "calechip.mock.session";

// `localStorage` is absent under the vitest `node` environment (vite.config.ts:17), which imports
// this module at the top of tests/seam-parity.test.ts, and a browser can refuse it outright in a
// private context. Both are read as "no stored session" rather than as an error: persistence is what
// AC-7 needs and nothing else in the mock depends on it.
function sessionStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

// Shape-checked rather than cast. The value comes back from a store a person can edit by hand, and a
// malformed one has to land on the sign-in screen rather than render a signed-in screen for a user
// with no id.
function readStoredSession(): Session | null {
  const store = sessionStore();
  if (!store) return null;

  try {
    const raw = store.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { user, accessToken } = parsed as { user?: unknown; accessToken?: unknown };
    if (typeof accessToken !== "string") return null;
    if (typeof user !== "object" || user === null) return null;

    const { id, email, emailConfirmed } = user as {
      id?: unknown;
      email?: unknown;
      emailConfirmed?: unknown;
    };
    if (typeof id !== "string" || typeof email !== "string") return null;
    if (typeof emailConfirmed !== "boolean") return null;

    return { user: { id, email, emailConfirmed }, accessToken };
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null): void {
  const store = sessionStore();
  if (!store) return;

  try {
    if (session) store.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else store.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // A full quota or a blocked store costs persistence, not the sign-in: the in-memory session
    // stands and this load behaves exactly as the mock did before AC-7 was reproduced.
  }
}

// Restored on module load, which is the reload path: nothing above the seam re-establishes a session
// after a navigation, and `useSession` reads this through `getSession()` on its first effect.
let currentSession: Session | null = readStoredSession();

// TEA-02. Who `getCurrentMember` answers as. Since TEA-05 it follows `currentSession` and is never
// set independently except by the test hook below - including across a reload, where it is derived
// from the restored session rather than persisted a second time.
let currentMemberId: string | null = currentSession ? currentSession.user.id : null;

/** Test-only. Sets which seeded member `getCurrentMember` answers as. Not part of the seam - it is a
 *  named export beside `seam`, so seam parity, which compares the keys of `seam`, is untouched.
 *
 *  TEA-05 leaves this in place and it is now REDUNDANT rather than load-bearing: nothing in the
 *  repository calls it, and after this ticket a test signs in rather than asserting its way into a
 *  session. Removing it is a tidy-up with no criterion behind it; the next ticket to touch this file
 *  can delete it. Note that it moves the member and NOT the session, so a caller that uses it is
 *  choosing a state the application cannot reach. */
export function __setCurrentMember(id: string | null): void {
  currentMemberId = id;
}

/** Test-only, MIR-07. Inserts `member`, or replaces the row with the same id. A named export beside
 *  `seam`, as `__setCurrentMember` is, so seam parity is untouched. It exists so the parity suite
 *  can put a row in a state no seam call reaches — an admin who is pending, a manager who is
 *  rejected — and ask the mock what SQL answers for it. */
export function __putMemberForTest(member: Member): void {
  const at = members.findIndex((m) => m.id === member.id);
  if (at === -1) members.push({ ...member });
  else members[at] = { ...member };
}

/** Test-only, MIR-07. The three shared predicates as the mock answers them for `uid`, without
 *  touching the session: `public.is_admin`, `public.member_team_id` and `public.may_decide`.
 *  `mayDecide` passes an owner id of "" so the own-entry clause of `mayDecideEntriesOf` is inert. */
export function __permissionDecisions(uid: string): {
  isAdmin: boolean;
  memberTeamId: string | null;
  mayDecide: boolean;
} {
  const me = members.find((m) => m.id === uid);
  return {
    isAdmin: adminOf(uid) !== null,
    memberTeamId: memberTeamId(uid),
    mayDecide: me !== undefined && mayDecideEntriesOf(me, ""),
  };
}

// SOLO, 2026-09-10 — the profile screen changes passwords, and `signIn` answers from
// `FIXTURE_CREDENTIALS`, which is a FROZEN array shared with every other spec file. Rewriting an
// entry in it would change what `quan@example.com` means for the whole suite, in file order, for
// the rest of the run.
//
// So the change is recorded HERE, keyed by auth user id, and `signIn` consults this map BEFORE the
// account's own password. Module state, like `members` and `signedUp`: it resets on a document load,
// so no spec inherits a password another spec set.
const passwordOverrides = new Map<string, string>();

/** The password that is currently correct for an account — the changed one if there is one. */
const currentPasswordOf = (account: FixtureCredential): string =>
  passwordOverrides.get(account.userId) ?? account.password;

/** Every account `signIn` searches, in the order it searches them. Named once because
 *  `changePassword` has to find the caller in exactly the same list, by the same rule. */
const accounts = (): FixtureCredential[] => [
  ...FIXTURE_CREDENTIALS,
  FIXTURE_APPROVED_MEMBER_CREDENTIAL,
  ...signedUp,
];

// TEA-05 AC-6, AC-7, AC-8. The subscribers of `onAuthStateChange`, and a real unsubscribe rather
// than a no-op: a listener this mock kept forever would survive a hot reload and re-resolve against
// a stale closure, which is the leak the seam's own contract warns about.
const sessionListeners = new Set<(session: Session | null) => void>();

function setSession(session: Session | null): void {
  currentSession = session;
  currentMemberId = session ? session.user.id : null;
  // AC-7 on the way in, AC-6 on the way out: `signOut` passes null here, so the stored copy is
  // removed in the same call that clears the in-memory one. A sign-out that ended the session for
  // this page and left it in the store would be the shared-machine gap AC-6 exists to close.
  writeStoredSession(session);
  // A copy per listener, so one subscriber cannot hand a mutated session to the next.
  for (const listener of sessionListeners) listener(session ? { ...session } : null);
}

// AC-4, AC-8. The refusals below reproduce the POLICY, not the screen (02-design.md section 3): a
// mock that let a member add an address would make every component test pass against a missing
// policy. `allowed_email_insert_admin` and `allowed_email_delete_admin_unconsumed` both require an
// admin whose team is the row's team, so that is what this asks.
//
// MIR-07, 2026-10-23. `public.is_admin(p_uid)`, reproduced with all three of its conjuncts: approved,
// not removed, admin (`20260910100000_solo_member_approval.sql:69-77`). Until this ticket it lacked
// `status === "approved"`, so a pending or rejected admin row was an admin here and nobody in SQL.
const adminOf = (uid: string | null): Member | null => {
  const m = members.find((x) => x.id === uid) ?? null;
  return m && m.status === "approved" && m.removedAt === null && m.role === "admin" ? m : null;
};
const currentAdmin = (): Member | null => adminOf(currentMemberId);

// ADM-03 adds `holiday_date_taken` to the union. It is widened rather than replaced by
// `FailureCode`: the narrow list is what stops this file returning a code no mock path can produce,
// and a code added here is a code some function below must actually be able to reach.
const refused = (
  // SOLO, 2026-09-11 adds `empty_team_name`. The union is written out rather than widened to
  // `FailureCode` on purpose: it is the list of codes a MOCK refusal may carry, and every addition
  // is a deliberate one. Widening it would let a typo in a code reach a screen as a failure nobody
  // wrote a sentence for.
  //
  // MIR-09 removes the allow-list's two codes, whole, and adds `invalid_threshold`.
  code:
    | "not_permitted"
    | "invalid_threshold"
    | "holiday_date_taken"
    | "empty_team_name"
    | "team_not_empty",
  message: string,
): { ok: false; error: { code: typeof code; message: string } } => ({
  ok: false,
  error: { code, message },
});

// SOLO, 2026-09-24 — ADR-044. Repeated verbatim in src/lib/data/supabase.ts, the shape the team
// refusals above already use, so the two implementations cannot drift a sentence apart.
const MEMBER_PROMOTE_REFUSED = "That person could not be promoted.";
const MEMBER_RANK_REFUSED = "That person's role could not be changed.";

/**
 * SOLO, 2026-09-24 — ADR-044. `public.set_member_role` reproduced, and `promoteMember` and
 * `setMemberRole` are both it.
 *
 * **MIR-03, 2026-10-20 — ADR-065: THE OWN-TEAM FILTER IS BACK.** `public.set_member_role` and
 * `public.promote_member_to_admin` both carry `m.team_id = member_team_id(auth.uid())`, so this
 * predicate carries `m.teamId === me.teamId`. It replaces `m.teamId !== null`: the caller is an admin
 * and has a team, so the equality cannot match a pending sign-up. `promoteMember` reaches this
 * directly; `setMemberRole` refuses `"admin"` before it gets here, as the function does.
 *
 * **NO `member_role_change` RECORD IS KEPT HERE.** No seam function reads it, so a mock copy would be
 * untested state. The record is verified in `.ai/board/tickets/MIR-03/verification.md`.
 *
 * **THE FOUR CONDITIONS ARE THE FUNCTION'S `where`, IN ITS ORDER**, and the function's header is the
 * authority for each. They collapse to ONE sentence here exactly as the function collapses them to
 * one `if not found`: a caller who is refused learns that they were refused and nothing about the
 * row.
 */
const setRank = (
  memberId: string,
  role: MemberRole,
  notAnAdmin: string,
  refusal: string,
): Result<Member> => {
  const me = currentAdmin();
  if (!me) return refused("not_permitted", notAnAdmin);

  const target = members.find(
    (m) =>
      m.id === memberId &&
      m.teamId === me.teamId &&
      m.status === "approved" &&
      m.removedAt === null &&
      m.role !== "admin",
  );
  if (!target) return refused("not_permitted", refusal);

  target.role = role;
  return { ok: true, value: { ...target } };
};

// ---------------------------------------------------------------------------
// CAL-01. 01-plan.md section 5.
// ---------------------------------------------------------------------------

// The mock's entry table. CAL-01 left it EMPTY and said so: an entry a test needs, a test creates,
// the way a person does.
//
// CAL-02 SEEDS EXACTLY ONE ROW, and it is the one no person can create. AC-5 and AC-6 edit an entry
// that is already APPROVED, and `status` is withheld from both grants and from ADM-05, which does
// not exist - so this row is a human's seed statement in supabase/seed.sql and the same literals
// here, which is what the shared-fixture rule asks for rather than the drift it forbids. Every other
// entry in every test is still created through the form.
//
// In memory only, and unlike the session this is NOT persisted across a page load. The seam banner
// in App.tsx already tells every reader, on every screen, that the data lives in browser memory and
// is lost on reload - a mock that quietly contradicted its own banner would be a worse lie than the
// one it fixed. Nothing in plan section 2 requires an entry to survive a navigation, and a reload
// restores this row exactly as re-running the seed would.
// CAL-03 SEEDS A SECOND ROW, and it is the row AC-8 has nothing to assert against otherwise. The
// fixtures have held a second team and a member on it since TEA-03 and no ENTRY on it, so
// "an admin of one team may not touch an entry of another" had no entry to be refused.
//
// It is here rather than created by a test for the same reason FIXTURE_APPROVED_ENTRY is: nobody can
// create it through the product. `entry_insert_own` admits only `member_id = auth.uid()`, so an
// entry on the other team can be created only by that team's own member signing in — and every
// suite in this repository signs in on FIXTURE_TEAM.
const entries: Entry[] = [{ ...FIXTURE_APPROVED_ENTRY }, { ...FIXTURE_OTHER_TEAM_ENTRY }];

// ---------------------------------------------------------------------------
// SOLO, 2026-09-11. The mock's `busy_day` table.
// ---------------------------------------------------------------------------
//
// **SEEDED EMPTY, UNLIKE `entries`.** The two fixture entries exist because nobody can create them
// through the product — `entry_insert_own` admits only `member_id = auth.uid()`, so an approved row
// and another team's row are unreachable from a suite that signs in on FIXTURE_TEAM. A busy day has
// neither problem: it needs no approval and a test creates one with one press, so a seeded row would
// be a row every count has to remember to subtract.
//
// Module state, like `members` and `entries`: it resets on a document load, which is why the e2e
// helpers that walk browser history avoid `page.goto` mid-test.
const busyDays: BusyDay[] = [];

// The id shape `newEntryId` and `newHolidayId` already use — a `bb` prefix, so a reader can tell at
// a glance which table an id belongs to.
let nextBusyDayId = 0;
const newBusyDayId = (): string =>
  `bb000000-0000-4000-8000-${String(++nextBusyDayId).padStart(12, "0")}`;

// ---------------------------------------------------------------------------
// ADM-02. 01-plan.md sections 4.3 and 4.5.
// ---------------------------------------------------------------------------

// MIR-15-e, ADR-079. The two orgs the mock's holiday table knows. Internal; not exported — a test
// reaches the dedicated org through `__setDedicatedOrgMembersForTest`, never through this type.
type MockOrg = "org_public" | "dedicated";

// MIR-15-e. localStorage key: a JSON array of member ids placed in the dedicated org. Read once at
// module load, the way SESSION_STORAGE_KEY is above, so an e2e spec sets it with
// `page.addInitScript` before the application's first load.
const DEDICATED_ORG_STORAGE_KEY = "calechip.mock.dedicatedOrgMembers";

function readDedicatedOrgMemberIds(): Set<string> {
  const store = sessionStore();
  if (!store) return new Set();

  try {
    const raw = store.getItem(DEDICATED_ORG_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

// Member ids in the dedicated org. Every other member is in Org public (MIR-12's backfill puts
// every real member there, and no fixture places one in a dedicated org — 01-plan.md § 1 *Out of
// scope*). Module state, like `members` and `holidays`: it resets on a document load.
let dedicatedOrgMemberIds: Set<string> = readDedicatedOrgMemberIds();

/** Test-only, MIR-15-e. Replaces the dedicated org's member set; `[]` restores the default (every
 *  member in Org public). A named export beside `seam`, so seam parity — which compares the keys of
 *  `seam` — is untouched. */
export function __setDedicatedOrgMembersForTest(memberIds: string[]): void {
  dedicatedOrgMemberIds = new Set(memberIds);
}

// MIR-15-e. `public.member_org_id` reproduced: null unless the member exists, is `approved` and not
// removed — the same three conjuncts `adminOf` already checks for `is_admin`, minus the role test.
// `null` stands for "no row in `member_org_id`'s own view", and `org_is_shared(null)` is false, so a
// pending, removed or member-less caller is never in either org here.
const mockOrgOf = (memberId: string | null): MockOrg | null => {
  const m = members.find((x) => x.id === memberId) ?? null;
  if (!m || m.status !== "approved" || m.removedAt !== null) return null;
  return dedicatedOrgMemberIds.has(m.id) ? "dedicated" : "org_public";
};

// The mock's `holiday` table, one row per (org, date) — ADR-079 decision 3's `holiday_org_id_date_key`
// reproduced. Seeded with FIXTURE_HOLIDAYS for Org public, under their own fixture ids, and a COPY of
// each for the dedicated org, under a fresh id from `newHolidayId()` — the same thing
// `public.create_org` does in SQL (MIR-18-b decision 3) when a new org is made.
//
// COPIED, never referenced, for the reason `members` and `teams` above record: the fixtures are
// shared module-level objects that every test imports.
//
// NO TEAM COLUMN ON A ROW, which is still AC-14's point reproduced: a holiday carries no team. What
// changed at MIR-15-e is which ORG a caller's read is scoped to — `listHolidays` below filters by
// `mockOrgOf(currentMemberId)` rather than returning every row, because `holiday_select_own_org`
// replaced `holiday_select_all` (ADR-079 decision 3) and a mock still returning every row would be
// looser than SQL rather than a reproduction of it.
let nextHolidayId = 0;
const newHolidayId = (): string =>
  `cc000000-0000-4000-8000-${String(++nextHolidayId + 900).padStart(12, "0")}`;

const holidays: { org: MockOrg; row: Holiday }[] = [
  ...FIXTURE_HOLIDAYS.map((h) => ({ org: "org_public" as MockOrg, row: { ...h } })),
  ...FIXTURE_HOLIDAYS.map((h) => ({
    org: "dedicated" as MockOrg,
    row: { ...h, id: newHolidayId() },
  })),
];

// ADM-03, MIR-15-e. The four sentences, repeated from src/lib/data/supabase.ts so the two
// implementations of the seam carry the same words — the rule CAL-01's three refusal constants
// already state, and the reason src/lib/fixtures.ts and supabase/seed.sql repeat their literals too.
//
// MIR-15-e, ADR-079 decision 5. Each now also names Org public's exception, matching
// supabase.ts: since MIR-15-b an admin of Org public is refused too (AC-7), and "Only an admin
// can …" alone would then be false for the person reading it.
const HOLIDAY_ADD_REFUSED =
  "Only an admin can add to the holiday calendar, and in Org public only a system admin can.";
const HOLIDAY_UPDATE_REFUSED =
  "Only an admin can change the holiday calendar, and in Org public only a system admin can.";
const HOLIDAY_DELETE_REFUSED =
  "Only an admin can remove a day from the holiday calendar, and in Org public only a system admin can.";
const HOLIDAY_DATE_TAKEN = "The calendar already has a row for that date. Edit that row instead.";

// SOLO, 2026-09-11. Repeated verbatim in src/lib/data/supabase.ts so the two implementations carry
// the same words — the rule CAL-01's three refusal constants state.
const BUSY_DAY_REFUSED = "This day could not be marked. You may only mark your own days.";

// SOLO, 2026-09-11. Repeated verbatim in src/lib/data/supabase.ts so the two implementations carry
// the same words — the rule CAL-01's three refusal constants state.
const TEAM_RENAME_REFUSED = "Only an admin can rename the team.";
const EMPTY_TEAM_NAME = "The team needs a name.";
// SOLO, 2026-09-11 — many teams. Repeated verbatim in src/lib/data/supabase.ts.
const TEAM_CREATE_REFUSED = "Only an admin can create a team.";
const TEAM_DELETE_REFUSED = "Only an admin can delete a team.";
const TEAM_NOT_EMPTY =
  "This team still has people on it and cannot be deleted. Anybody who was removed from it stays " +
  "on it for history, so a team that has ever had somebody removed can never be deleted.";
const MEMBER_MOVE_REFUSED = "That person could not be moved.";
// MIR-02. The sentences `src/lib/data/supabase.ts` shows for `decideMember`'s and `setMemberTeam`'s
// refusals, repeated verbatim so the mock and the real seam say the same thing.
const SIGNUP_DECISION_REFUSED = "That sign-up could not be decided. It may already have been.";
const MEMBER_TEAM_SAVE_REFUSED = "That member could not be moved.";
const APPROVAL_SETTINGS_REFUSED = "Only an admin can change which entries need approval.";

// ---------------------------------------------------------------------------
// SOLO, 2026-09-26 — report an issue. The mock's table, its id shape, its sentences and the one
// rule it repeats from src/lib/data/supabase.ts.
// ---------------------------------------------------------------------------

// **SEEDED WITH ONE ROW, WHICH IS THE OPPOSITE OF WHAT CAL-01 DID FOR `entry` AND FOR A DIFFERENT
// REASON.** An entry a test needs, a test creates, because a person can create one. A report a test
// needs could also be created — but the ADMIN list screen then renders its empty state in every
// spec that has not sent one first, and the list markup is never exercised at all. One fixture row
// is what `FIXTURE_HOLIDAYS` does for the calendar, and the same argument.
//
// NO TEAM COLUMN, so unlike every other read in this file `listIssueReports` applies no team filter.
// That is the operator's fourth decision of 2026-09-26, and `issue_report_select_admin` carries no
// team predicate either.
const reports: IssueReport[] = [{ ...FIXTURE_ISSUE_REPORT }];

/**
 * Test-only. Puts this table back to the one seeded row.
 *
 * **IT EXISTS BECAUSE THIS FEATURE HAS NO DELETE PATH AND MUST NOT GROW ONE.** The operator's third
 * decision stopped at *mark done*; there is no delete policy, no `grant delete`, and no seam
 * function. So a test that sends a report has no way to undo it, and `reports` lives for the whole
 * module — which would make every count after it wrong.
 *
 * A NAMED EXPORT BESIDE `seam`, exactly as `__setCurrentMember` is, so seam parity — which compares
 * the keys of `seam` — is untouched. Nothing under `src/` may call it, and nothing does.
 */
export function __resetIssueReports(): void {
  reports.length = 0;
  reports.push({ ...FIXTURE_ISSUE_REPORT });
  // The objects go with them. A test that uploaded and then reset would otherwise leave bytes in the
  // map keyed by a path no row names any more — an orphan the real seam also has, reproduced here by
  // accident rather than on purpose, which is the kind of agreement nobody wants.
  issueObjects.clear();
}

/**
 * MIR-17, ADR-088. The reports this table holds, as stored, newest first — for a test that needs to
 * check a write landed now that no seam read answers any caller (`listIssueReports`,
 * `countOpenIssueReports`, `issueImageUrls` and `setIssueReportStatus` all changed to the database's
 * post-MIR-16 answer, ADR-082 decision 1).
 *
 * **A TEST-ONLY EXPORT BESIDE `seam`, EXACTLY AS `__sentEventEmails` IS**, so seam parity — which
 * compares the keys of `seam` — does not see it. It is not a seam member: nothing under `src/` may
 * call it, and nothing does.
 */
export function __storedIssueReports(): IssueReport[] {
  return reports
    .slice()
    // The real seam's own order, reproduced — same as `listIssueReports` below, so a test reading
    // this instead of that sees the same arrangement it would have.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map((r) => ({ ...r }));
}

// ---------------------------------------------------------------------------
// EVT-01 — events. 01-plan.md sections 3, 4 and 5.
//
// **THESE REPRODUCE `20260929120000_evt01_event.sql`'S POLICIES, GRANTS AND CONSTRAINTS, NOT THE
// SCREEN**, which is this file's standing contract: the acceptance suite drives this seam, so a mock
// that let a member of team B read team A's own-team event would make every denial in
// `tests/events.test.ts` pass against nothing.
//
// Both tables start EMPTY — an event a test needs, a test creates, because any approved member can
// create one (01-plan.md § 7: no fixture literal, so none can drift from the seed).
// ---------------------------------------------------------------------------

const events: CalEvent[] = [];

/** `public.event_invitee`, reproduced. `createdAt` is carried so the row is the table's shape. */
const eventInvitees: { eventId: string; memberId: string; createdAt: string }[] = [];

/**
 * Test-only. Empties both event tables.
 *
 * A NAMED EXPORT BESIDE `seam`, exactly as `__resetIssueReports` is, so seam parity — which compares
 * the keys of `seam` — is untouched. Nothing under `src/` may call it, and nothing does.
 */
export function __resetEvents(): void {
  events.length = 0;
  eventInvitees.length = 0;
  // EVT-02. The attendance table goes with the events, as the cascade would take it.
  eventAttendance.length = 0;
  // EVT-04. A notification is about an event, so it goes with them (01-plan.md § 5).
  notifications.length = 0;
  // EVT-05. The switches and the outbox go with them (01-plan.md § 4.2).
  eventEmailSwitches.clear();
  eventEmailOutbox.length = 0;
  // EVT-06. The guest links go with the events, as the cascade would take them.
  eventGuestLinks.clear();
  // EVT-07. The guest registrations are emptied here only because a test needs a clean slate; no
  // seam function deletes one (AC-20).
  eventGuests.length = 0;
  // EVT-08. Emptied here only for a clean slate, as the guests are; no seam function deletes one
  // (AC-14).
  emailInvitations.length = 0;
  invitationEmailOutbox.length = 0;
}

// The id an event gets, in the shape the other generators use: an `ec` prefix, which no other
// table's ids in this file or the fixtures use.
let nextEventId = 0;
const newEventId = (): string =>
  `ec000000-0000-4000-8000-${String(++nextEventId).padStart(12, "0")}`;

// Repeated verbatim in src/lib/data/supabase.ts, the shape every shared sentence in these two files
// uses, so the two implementations cannot drift a sentence apart. `EVENT_SAVE_REFUSED` and
// `EVENT_DELETE_REFUSED` never confirm that the event exists (01-plan.md § 4.2).
const EVENT_NAME_REQUIRED = "Please give the event a name.";
const EVENT_DATES_REVERSED = "The end date must be the same as, or after, the start date.";
const EVENT_INVITEE_INVALID =
  "One of the people you named can no longer be invited. Please choose again.";
const EVENT_SAVE_REFUSED = "This event could not be saved.";
const EVENT_DELETE_REFUSED = "This event could not be deleted.";

// EVT-02. 01-plan.md § 4.3. Repeated verbatim in supabase.ts.
const EVENT_CAPACITY_INVALID = "Seats must be a whole number of at least 1, or left empty for no limit.";
const EVENT_DEADLINE_AFTER_END = "Registration must close on or before the event's end date.";
const EVENT_CAPACITY_BELOW_ATTENDEES =
  "Seats cannot be fewer than the number of people already attending.";
// EVT-11. 01-plan.md § 4.6. Repeated verbatim from supabase.ts.
const DESCRIPTION_TOO_LARGE = "The description is larger than 1 MB. Remove a picture to save.";

const eventFailure = (
  code: Failure["code"],
  message: string,
): { ok: false; error: Failure } => ({ ok: false, error: { code, message } });

/** The four seam-side refusals, made before the round trip in both implementations — AFFORDANCES;
 *  `event_name_present`, `event_dates_ordered`, `event_capacity_positive` and `event_deadline_by_end`
 *  are the controls. Repeated in supabase.ts. */
const eventInputFailure = (input: SaveEventInput): { ok: false; error: Failure } | null => {
  if (input.name.trim() === "") return eventFailure("empty_event_name", EVENT_NAME_REQUIRED);
  if (input.endDate < input.startDate) {
    return eventFailure("invalid_event_dates", EVENT_DATES_REVERSED);
  }
  if (input.capacity != null && !(Number.isInteger(input.capacity) && input.capacity >= 1)) {
    return eventFailure("invalid_event_capacity", EVENT_CAPACITY_INVALID);
  }
  if (input.registrationDeadline != null && input.registrationDeadline > input.endDate) {
    return eventFailure("invalid_event_deadline", EVENT_DEADLINE_AFTER_END);
  }
  // EVT-11 AC-6. `event_description_bounded`.
  if (descriptionBytes(blankToNull(input.description)) > DESCRIPTION_MAX_BYTES) {
    return eventFailure("description_too_large", DESCRIPTION_TOO_LARGE);
  }
  return null;
};

/** Blank after trimming is null — `SaveEventInput`'s docblock, and AC-2's "never an empty label". */
const blankToNull = (value: string | null): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

// `public.is_admin`, with its `status = 'approved'` and `removed_at is null` clauses — which
// `currentAdmin()` above does not carry, so it is not reused here. `memberTeamId` carries both.
// MIR-07, 2026-10-23: `currentAdmin()` now carries both too (`adminOf`); this is left as it was.
const eventIsAdmin = (uid: string | null): boolean =>
  memberTeamId(uid) !== null && members.find((m) => m.id === uid)?.role === "admin";

// `public.is_event_invitee`.
const isEventInvitee = (eventId: string, uid: string | null): boolean =>
  eventInvitees.some((i) => i.eventId === eventId && i.memberId === uid);

// `public.may_manage_event`, and `event_update_manage` / `event_delete_manage`'s shared predicate.
// Keyed on `is_admin` and NEVER on `mayDecide`: a manager gains nothing here (Q9, Q24).
const mayManageEvent = (event: CalEvent, uid: string | null): boolean =>
  (event.creatorId === uid && memberTeamId(uid) !== null) || eventIsAdmin(uid);

// `event_select_visible`, clause for clause.
const mayReadEvent = (event: CalEvent, uid: string | null): boolean => {
  const mine = memberTeamId(uid);
  if (mine === null) return false;
  return (
    eventIsAdmin(uid) ||
    event.creatorId === uid ||
    event.scope === "public" ||
    (event.scope === "team" && event.teamId === mine) ||
    (event.scope === "named" && isEventInvitee(event.id, uid)) ||
    // EVT-02, AC-5. The disjunct `event_select_visible` gains: someone pending or attending keeps
    // reading the event after its scope or named list stops including them.
    isEventParticipant(event.id, uid)
  );
};

// ---------------------------------------------------------------------------
// EVT-02 — attendance. 01-plan.md sections 3, 4.4 and 5.
//
// **THESE REPRODUCE `20260929140000_evt02_attendance.sql`'S POLICIES, GRANTS AND TRIGGERS**, the
// standing contract above. CHECK AND WRITE RUN WITH NO `await` BETWEEN THEM, so `Promise.all` against
// this seam proves the DECISION under concurrency — never the LOCK, which only PostgreSQL can
// (01-plan.md § 3).
// ---------------------------------------------------------------------------

/** `public.event_attendance`, reproduced. Starts EMPTY, as `events` does. */
const eventAttendance: EventAttendance[] = [];

// Repeated verbatim in src/lib/data/supabase.ts.
const EVENT_FULL = "This event is full.";
const EVENT_REGISTRATION_CLOSED = "Registration for this event has closed.";
const EVENT_ALREADY_ON = "You have already responded to this event.";
const ATTENDANCE_CHANGE_INVALID = "That change cannot be made to this person's place.";
const ATTENDANCE_JOIN_REFUSED = "You cannot join this event.";
const ATTENDANCE_LEAVE_REFUSED = "You cannot leave this event.";
const ATTENDANCE_DECIDE_REFUSED = "This request could not be changed.";

const findAttendance = (eventId: string, uid: string | null): EventAttendance | undefined =>
  eventAttendance.find((a) => a.eventId === eventId && a.memberId === uid);

// `public.is_event_participant`: a row for the pair, pending or attending.
function isEventParticipant(eventId: string, uid: string | null): boolean {
  const row = findAttendance(eventId, uid);
  return row !== undefined && (row.status === "pending" || row.status === "attending");
}

// `public.is_event_audience`. **NO ADMIN CLAUSE** — AC-11: an admin reads every event to manage it,
// not to attend it.
const isEventAudience = (event: CalEvent, uid: string | null): boolean => {
  const mine = memberTeamId(uid);
  if (mine === null) return false;
  return (
    event.creatorId === uid ||
    event.scope === "public" ||
    (event.scope === "team" && event.teamId === mine) ||
    (event.scope === "named" && isEventInvitee(event.id, uid))
  );
};

// Seats taken — every `attending` row, whoever holds it (AC-26: a removed member's seat stays).
// EVT-07 AC-10, AC-14: attending GUESTS too, as all three guards count them. `except` is a member id
// or a guest id — the two never collide, guest ids carrying their own prefix.
const seatsTaken = (eventId: string, except: string | null = null): number =>
  eventAttendance.filter(
    (a) => a.eventId === eventId && a.status === "attending" && a.memberId !== except,
  ).length +
  eventGuests.filter((g) => g.eventId === eventId && g.status === "attending" && g.id !== except)
    .length;

// `event_attendance_guard`'s transition table, and nothing else.
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["attending", "rejected"],
  attending: ["removed"],
};

/** `save_event`'s invitee half: the 22023 test, then delete-what-is-not-listed, then insert-what-is-
 *  missing. Called only after the row write was admitted, as the SQL orders it. */
const writeEventInvitees = (
  eventId: string,
  input: SaveEventInput,
): { ok: false; error: Failure } | null => {
  const ids = [...new Set(input.scope === "named" ? input.inviteeIds : [])];
  if (ids.some((id) => memberTeamId(id) === null)) {
    return eventFailure("invalid_event_invitee", EVENT_INVITEE_INVALID);
  }
  for (let i = eventInvitees.length - 1; i >= 0; i--) {
    const row = eventInvitees[i];
    if (row && row.eventId === eventId && !ids.includes(row.memberId)) eventInvitees.splice(i, 1);
  }
  const now = new Date().toISOString();
  const added: string[] = [];
  for (const memberId of ids) {
    if (!isEventInvitee(eventId, memberId)) {
      eventInvitees.push({ eventId, memberId, createdAt: now });
      added.push(memberId);
    }
  }
  // EVT-04 AC-2, AC-3. `notify_event_invited`, after insert on `event_invitee`: one per row INSERTED,
  // so a person already named receives nothing on a second save.
  const event = events.find((e) => e.id === eventId);
  if (event) {
    for (const memberId of added) notify([memberId], "event_invited", event);
  }
  return null;
};

// ---------------------------------------------------------------------------
// EVT-06 — the guest link. 01-plan.md sections 3, 4.2 and 4.3. ADR-052.
//
// **THESE REPRODUCE `20261009120000_evt06_guest_link.sql`'S POLICIES, GRANTS AND DEFINER READS**, the
// standing contract above. The open, close and link read are `may_manage_event` — EVT-01's
// `mayManageEvent` — and nothing else; the guest read takes a token and reads NO session.
// ---------------------------------------------------------------------------

/** `public.event_guest_link`, keyed by event id — the primary key, so one link per event (AC-6).
 *  Starts EMPTY and is not persisted, as `events` is not. */
const eventGuestLinks = new Map<string, { token: string; openedAt: string }>();

// Repeated verbatim in src/lib/data/supabase.ts. Neither confirms that the event exists.
const EVENT_GUEST_OPEN_REFUSED = "This event could not be opened to guests.";
const EVENT_GUEST_CLOSE_REFUSED = "The guest link could not be closed.";

/** The column default: 32 bytes from the strong source, 64 lowercase hex characters. */
const newGuestToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const toGuestLink = (eventId: string, row: { token: string; openedAt: string }): EventGuestLink => ({
  eventId,
  token: row.token,
  openedAt: row.openedAt,
});

/** The insert, or the row already there — the primary key. EVT-08 opens through this too, so
 *  `invite_to_event` and `openEventToGuests` open a link the same way (01-plan.md § 4.2). */
const openGuestLink = (eventId: string): { token: string; openedAt: string } => {
  const existing = eventGuestLinks.get(eventId);
  if (existing) return existing;
  const row = { token: newGuestToken(), openedAt: new Date().toISOString() };
  eventGuestLinks.set(eventId, row);
  return row;
};

/** The event a token opens, or null — `from event_guest_link l join event e … where l.token = p_token`. */
const guestEventId = (token: string): string | null => {
  for (const [eventId, row] of eventGuestLinks) {
    if (row.token === token && events.some((e) => e.id === eventId)) return eventId;
  }
  return null;
};

// ---------------------------------------------------------------------------
// EVT-07 — guest registration. 01-plan.md sections 3, 4.2 and 4.3. ADR-052.
//
// **THESE REPRODUCE `20261009150000_evt07_guest_registration.sql`'S GUARD, POLICIES, GRANTS AND
// DEFINER FUNCTIONS.** The four token functions read NO session. CHECK AND WRITE RUN WITH NO `await`
// BETWEEN THEM — the one `await` in each, the SHA-256, comes first — so `Promise.all` proves the
// DECISION, never the LOCK (EVT-02 § 3).
// ---------------------------------------------------------------------------

/** `public.event_guest`, reproduced. Never spliced by a seam function — guest data is kept (Q8).
 *  `eventId` is null once the event is deleted (AC-20). The manage token is NOT stored; its hash is. */
const eventGuests: {
  id: string;
  eventId: string | null;
  eventName: string;
  name: string;
  email: string;
  manageTokenHash: string;
  status: GuestStatus;
  createdAt: string;
  updatedAt: string;
}[] = [];

// An `eg` prefix, which no other table's ids in this file or the fixtures use.
let nextGuestId = 0;
const newGuestId = (): string =>
  `eg000000-0000-4000-8000-${String(++nextGuestId).padStart(12, "0")}`;

// Repeated verbatim in src/lib/data/supabase.ts. Neither "does not work" sentence says why.
const GUEST_NAME_INVALID = "Please give your name, in 100 characters or fewer.";
const GUEST_EMAIL_INVALID = "Please give a valid email address, in 254 characters or fewer.";
const GUEST_ALREADY_REGISTERED = "That email is already registered for this event.";
const GUEST_LINK_NOT_FOUND = "This link does not work.";
const GUEST_REGISTRATION_NOT_FOUND = "This link does not work.";
const GUEST_DECIDE_REFUSED = "This guest's place could not be changed.";

/** § 4.1's checks, made before the round trip in both implementations — AFFORDANCES; the table's
 *  `event_guest_name_shape` and `event_guest_email_shape` are the controls. Lengths in code points,
 *  as `char_length` counts. Repeated in supabase.ts. */
const guestInputFailure = (name: string, email: string): { ok: false; error: Failure } | null => {
  if (name === "" || [...name].length > GUEST_NAME_MAX) {
    return eventFailure("invalid_guest_name", GUEST_NAME_INVALID);
  }
  if ([...email].length > GUEST_EMAIL_MAX || !GUEST_EMAIL_PATTERN.test(email)) {
    return eventFailure("invalid_guest_email", GUEST_EMAIL_INVALID);
  }
  return null;
};

/** `encode(sha256(convert_to(<token>, 'UTF8')), 'hex')`. */
const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

type GuestRow = (typeof eventGuests)[number];

/** A member's view of one row: `email` only to whoever may manage the event (AC-15). Only called
 *  for a row whose event still exists, so `eventId` is a string. */
const toEventGuest = (row: GuestRow, eventId: string, withEmail: boolean): EventGuest => ({
  id: row.id,
  eventId,
  name: row.name,
  email: withEmail ? row.email : null,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// `event_guest_guard`'s update transitions — the creator's three and the manage link's two.
const GUEST_TRANSITIONS: Record<string, readonly GuestStatus[]> = {
  pending: ["attending", "rejected", "cancelled"],
  attending: ["removed", "cancelled"],
};

// ---------------------------------------------------------------------------
// EVT-04 — notifications. 01-plan.md sections 3, 4.3 and 5. ADR-050.
//
// **THESE REPRODUCE `20261008120000_evt04_notification.sql`'S TRIGGERS AND POLICIES**, the standing
// contract above. `notify` is the migration's `notify`; each trigger point calls it AFTER the write
// it reacts to, except `event_cancelled`, called BEFORE the event and its attendances are removed.
// Reads and marks are the caller's own rows and have NO ADMIN CLAUSE (ADR-050 decision 4).
// ---------------------------------------------------------------------------

/** `public.notification`, reproduced. Starts EMPTY, as `events` does. */
const notifications: EventNotification[] = [];

// Increasing and zero-padded, so `id` desc breaks a `createdAt` tie in write order — the real seam's
// second `order`.
let nextNotificationId = 0;
const newNotificationId = (): string =>
  `nf000000-0000-4000-8000-${String(++nextNotificationId).padStart(12, "0")}`;

// Every approved member — `member_team_id(m.id) is not null` — once each (the fixtures carry two rows
// under one id; the table cannot).
const approvedMemberIds = (): string[] => [
  ...new Set(members.filter((m) => memberTeamId(m.id) !== null).map((m) => m.id)),
];

// Pending or attending — `is_event_participant` — on one event.
const eventParticipantIds = (eventId: string): string[] =>
  eventAttendance
    .filter((a) => a.eventId === eventId && (a.status === "pending" || a.status === "attending"))
    .map((a) => a.memberId);

/** `public.notify`. Nothing without a signed-in actor (AC-9); one row per DISTINCT recipient (AC-10);
 *  never the actor (AC-9); only a reader of the event, read NOW (AC-8) — `may_read_event`, which is
 *  `mayReadEvent` here: the mock has one copy of the predicate for the policy and the triggers. */
function notify(recipients: string[], kind: NotificationKind, event: CalEvent): void {
  const actor = currentMemberId;
  if (actor === null) return;
  const now = new Date().toISOString();
  for (const recipientId of new Set(recipients)) {
    if (recipientId === actor || !mayReadEvent(event, recipientId)) continue;
    notifications.push({
      id: newNotificationId(),
      recipientId,
      kind,
      // The one subtle line: checked against the event, written null for a cancellation.
      eventId: kind === "event_cancelled" ? null : event.id,
      eventName: event.name,
      actorId: actor,
      createdAt: now,
      readAt: null,
    });
    // EVT-05. `email_notification()`, after insert on `public.notification`.
    emailNotification(notifications[notifications.length - 1]!, event);
  }
}

// ---------------------------------------------------------------------------
// EVT-05 — event email. 01-plan.md §§ 4.2 and 4.3. ADR-051, ADR-053.
//
// **THIS REPRODUCES `20261009090000_evt05_event_email.sql`'S SWITCH AND TRIGGER.** The outbox holds
// what the trigger would have handed the sender; nothing here sends. An email exists only beside a
// notification `notify` just wrote, so every EVT-04 recipient rule — a reader of the event, never the
// actor, a signed-in person only, once per row — is inherited, not repeated (AC-5).
//
// **`to` IS `Member.email` HERE AND `auth.users.email` IN THE DATABASE.** The mock has no auth table;
// `Member.email` is the copy `20260912120000_solo_member_email.sql` keeps of it.
// ---------------------------------------------------------------------------

/** The five kinds of ADR-051 decision 4 — the trigger's `when` clause. */
const EMAIL_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  "event_created",
  "event_invited",
  "attendance_approved",
  "attendance_rejected",
  "attendance_removed",
]);

/** `member.event_email_enabled`, reproduced. ABSENT MEANS `true` — the column's default (AC-7). */
const eventEmailSwitches = new Map<string, boolean>();

const eventEmailOn = (memberId: string): boolean => eventEmailSwitches.get(memberId) ?? true;

export interface MockEventEmail {
  notificationId: string;
  kind: "event_created" | "event_invited" | "attendance_approved" | "attendance_rejected" | "attendance_removed";
  to: string;
  eventId: string;
}

const eventEmailOutbox: MockEventEmail[] = [];

/** `public.email_notification()`: an email kind; for `event_created`, an own-team event (Q3); the
 *  recipient's switch on; an address to send to. Nothing else is checked, because `notify` already
 *  decided who receives the notification. */
function emailNotification(n: EventNotification, event: CalEvent): void {
  if (!EMAIL_KINDS.has(n.kind)) return;
  if (n.kind === "event_created" && event.scope !== "team") return;
  if (!eventEmailOn(n.recipientId)) return;
  const to = members.find((m) => m.id === n.recipientId)?.email ?? null;
  if (to === null || to === "") return;
  eventEmailOutbox.push({
    notificationId: n.id,
    kind: n.kind as MockEventEmail["kind"],
    to,
    eventId: event.id,
  });
}

/** EVT-05. The emails the database would have handed the sender since the last `__resetEvents()`.
 *  Test-only, a named export beside `seam` — NOT a seam member, so seam parity is untouched. */
export function __sentEventEmails(): MockEventEmail[] {
  return eventEmailOutbox.map((e) => ({ ...e }));
}

// Repeated verbatim in src/lib/data/supabase.ts.
const EVENT_EMAIL_SAVE_FAILED = "Your email setting could not be saved.";

// ---------------------------------------------------------------------------
// EVT-08 — email invitations. 01-plan.md sections 3, 4.2 and 4.3. ADR-055.
//
// **THESE REPRODUCE `20261012100000_evt08_event_email_invitation.sql`'S FUNCTION, TRIGGER AND
// POLICY.** `inviteToEvent` is `invite_to_event` then `email_invitation()` per new row, in one
// synchronous block. On a public event the function half NEVER READS `members` — the outcome is
// decided from `emailInvitations` alone (AC-7); only the trigger half looks an address up, and its
// only effect is the outbox, which no seam function reads.
//
// EVT-12 (`20261014090000_evt12_invite_every_scope.sql`, ADR-061). On an Own team or Limited people
// event the function half resolves each address to a member, adds a member who cannot read the event
// to `eventInvitees` — converting an Own team event to named, silently — and still answers only
// `sent` or `ignored` (EVT-12 AC-10).
// ---------------------------------------------------------------------------

/** `public.event_email_invitation`, reproduced. Never spliced by a seam function (AC-14); `eventId` is
 *  null once the event is deleted. */
const emailInvitations: {
  id: string;
  eventId: string | null;
  email: string;
  invitedBy: string;
  createdAt: string;
}[] = [];

// An `ei` prefix, which no other table's ids in this file or the fixtures use. Increasing and
// zero-padded, so `id` breaks a `createdAt` tie in write order.
let nextInvitationId = 0;
const newInvitationId = (): string =>
  `ei000000-0000-4000-8000-${String(++nextInvitationId).padStart(12, "0")}`;

// Repeated verbatim in src/lib/data/supabase.ts.
const INVITATION_EMAIL_INVALID =
  "Each address must look like name@example.com, in 254 characters or fewer.";
const INVITATION_REFUSED = "Invitations could not be sent for this event.";

/** § 4.1's checks, made before the round trip in both implementations — AFFORDANCES; the function's
 *  EV008 and the table's `event_email_invitation_email_shape` are the controls. Trims, drops
 *  empties; null when nothing is left or any address fails. Repeated in supabase.ts. */
const invitationAddresses = (emails: string[]): string[] | null => {
  const trimmed = emails.map((e) => e.trim()).filter((e) => e !== "");
  if (trimmed.length === 0) return null;
  if (trimmed.some((e) => [...e].length > GUEST_EMAIL_MAX || !GUEST_EMAIL_PATTERN.test(e))) return null;
  return trimmed;
};

/** EVT-08. What `email_invitation()` would have handed the sender. Test-only. */
export interface MockInvitationEmail {
  invitationId: string;
  kind: "invitation_guest" | "invitation_member";
  to: string;
  eventId: string;
  inviterName: string;
  /** The guest token in the request; null for the member version. */
  guestToken: string | null;
}

const invitationEmailOutbox: MockInvitationEmail[] = [];

/** The approved, not removed member whose `Member.email` — the mock's substitute for
 *  `auth.users.email`, as EVT-05's is — equals the address ignoring case; null for an outsider. The
 *  lookup `email_invitation()` and, on an Own team or Limited people event, `invite_to_event` share. */
const approvedMemberByEmail = (email: string): Member | null => {
  const address = email.toLowerCase();
  return (
    members.find(
      (m) => (m.email ?? "").toLowerCase() === address && m.status === "approved" && m.removedAt === null,
    ) ?? null
  );
};

/** `public.email_invitation()`. A member who cannot read the event: nothing — `inviteToEvent` adds
 *  them next, and EVT-05 mails them (EVT-12 AC-6). A member: nothing when they are the inviter or their
 *  event email is off. Anyone else: the event's guest token. */
function emailInvitation(row: (typeof emailInvitations)[number], event: CalEvent): void {
  const inviterName = members.find((m) => m.id === row.invitedBy)?.displayName ?? null;
  if (inviterName === null) return;
  const member = approvedMemberByEmail(row.email);
  if (member !== null) {
    if (!mayReadEvent(event, member.id)) return;
    if (member.id === row.invitedBy || !eventEmailOn(member.id) || !member.email) return;
    invitationEmailOutbox.push({
      invitationId: row.id,
      kind: "invitation_member",
      to: member.email,
      eventId: event.id,
      inviterName,
      guestToken: null,
    });
    return;
  }
  const link = eventGuestLinks.get(event.id);
  if (!link) return;
  invitationEmailOutbox.push({
    invitationId: row.id,
    kind: "invitation_guest",
    to: row.email,
    eventId: event.id,
    inviterName,
    guestToken: link.token,
  });
}

/** EVT-08. The invitation mails the database would have handed the sender since the last
 *  `__resetEvents()`. Test-only, a named export beside `seam` — NOT a seam member. */
export function __sentInvitationEmails(): MockInvitationEmail[] {
  return invitationEmailOutbox.map((e) => ({ ...e }));
}

// `notification_select_own` / `notification_update_own`: the caller's row, and the caller still has
// a team. No admin clause.
const ownsNotification = (n: EventNotification, uid: string | null): boolean =>
  uid !== null && n.recipientId === uid && memberTeamId(uid) !== null;

// The id a row added through the product gets, in the shape `newEntryId` and `newHolidayId` already
// use — a `dd` prefix, matching the fixture row so a reader can tell at a glance which table an id
// belongs to.
let nextReportId = 0;
// The mock bucket's object counter. Separate from `nextReportId` because a report may carry none or
// three, so the two sequences cannot be one.
let nextObjectId = 0;
const newReportId = (): string =>
  `dd000000-0000-4000-8000-${String(++nextReportId).padStart(12, "0")}`;

// Repeated verbatim in src/lib/data/supabase.ts so the two implementations carry the same words —
// the rule CAL-01's three refusal constants state.
const ISSUE_SEND_REFUSED = "That report could not be sent.";
const ISSUE_STATUS_REFUSED = "That report could not be updated.";
const ISSUE_MESSAGE_REQUIRED = "Please write what went wrong before sending.";
const ISSUE_MESSAGE_TOO_LONG = "That report is too long. Please keep it under 2000 characters.";
const ISSUE_MESSAGE_MAX = 2000;
const ISSUE_TOO_MANY_IMAGES = `Please attach at most ${ISSUE_IMAGE_MAX_COUNT} images.`;
const ISSUE_IMAGE_TOO_LARGE = "One of those images is over 5 MB. Please attach a smaller one.";
const ISSUE_IMAGE_WRONG_TYPE = "Images must be PNG, JPEG or WebP.";

/**
 * SOLO, 2026-09-26 (second run) — **THE MOCK'S BUCKET, WHICH IS A `Map`.**
 *
 * The real seam uploads to Supabase Storage and stores object paths; the mock has no storage and
 * cannot have one. So it mints the same SHAPE of path and keeps the bytes here, as a data URL, which
 * is the one form that loads in a browser (the acceptance suite) and exists under node (vitest)
 * without a DOM — `URL.createObjectURL` would work in only one of the two.
 *
 * **`IssueReport.images` HOLDS PATHS IN BOTH IMPLEMENTATIONS, AND THAT IS WHAT KEEPS THEM
 * SWAPPABLE.** The screen never reads a path directly; it calls `issueImageUrls`, which is identity
 * -shaped here and a signing round trip there. A mock that put data URLs in the column would be a
 * different seam shape wearing the same type.
 */
const issueObjects = new Map<string, string>();

/**
 * `issueMessageFailure` from src/lib/data/supabase.ts, repeated rather than imported.
 *
 * **THE DUPLICATION IS THIS FILE'S CONVENTION AND NOT AN OVERSIGHT.** Importing it would put a
 * runtime import edge from the mock to the real implementation, between two modules whose whole
 * point is that either can be swapped for the other. Every shared sentence above is written twice
 * for the same reason. What makes it checkable rather than merely intended is
 * `tests/issue-reports.test.ts`, which asserts both implementations refuse the same two inputs with
 * the same code — so a copy that drifts fails a test instead of reaching a person.
 */
const issueMessageFailure = (
  message: string,
): { ok: false; error: { code: "invalid_issue_message"; message: string } } | null => {
  const trimmed = message.trim();
  if (trimmed === "") {
    return { ok: false, error: { code: "invalid_issue_message", message: ISSUE_MESSAGE_REQUIRED } };
  }
  if (trimmed.length > ISSUE_MESSAGE_MAX) {
    return { ok: false, error: { code: "invalid_issue_message", message: ISSUE_MESSAGE_TOO_LONG } };
  }
  return null;
};

/** `issueImageFailure` from src/lib/data/supabase.ts, repeated for the reason above it. Same order —
 *  count, then type, then size — because the order decides which of three sentences a person is
 *  shown, and the two implementations disagreeing about that is exactly the drift these tests pin. */
const issueImageFailure = (
  files: readonly File[],
): { ok: false; error: { code: "invalid_issue_image"; message: string } } | null => {
  if (files.length > ISSUE_IMAGE_MAX_COUNT) {
    return { ok: false, error: { code: "invalid_issue_image", message: ISSUE_TOO_MANY_IMAGES } };
  }
  for (const file of files) {
    if (!ISSUE_IMAGE_TYPES.includes(file.type)) {
      return { ok: false, error: { code: "invalid_issue_image", message: ISSUE_IMAGE_WRONG_TYPE } };
    }
    if (file.size > ISSUE_IMAGE_MAX_BYTES) {
      return { ok: false, error: { code: "invalid_issue_image", message: ISSUE_IMAGE_TOO_LARGE } };
    }
  }
  return null;
};

/** The bytes, as a data URL. `arrayBuffer` and a manual base64 rather than `FileReader`, which is a
 *  DOM API and absent under the vitest `node` environment this file also runs in. */
async function issueDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // `btoa` is available in both node 18+ and every browser. The mock holds test-sized files, so the
  // single-pass concatenation above is not worth optimising.
  return `data:${file.type};base64,${btoa(binary)}`;
}

let nextEntryId = 0;
const newEntryId = (): string => `ee000000-0000-4000-8000-${String(++nextEntryId).padStart(12, "0")}`;

// INV-01, reproduced. THIS IS A SECOND IMPLEMENTATION OF AN INVARIANT and it is acceptable only
// because the mock is not a datastore anybody's data lives in - the real mechanism is the exclusion
// constraint `entry_no_overlapping_portion` (ADR-011 section 3), and this exists so AC-7 and AC-8
// are observable end-to-end without a provisioned project.
//
// SOLO, 2026-09-11 — **THE PREDICATE MOVED TO `./overlap.ts` AND IS NOT WRITTEN HERE ANY MORE.** It
// was `PORTION_SLOTS`, `datesIntersect` and `slotsIntersect`, used at exactly the two clash sites in
// `createEntry` and `updateEntry`. The operator asked that the refusal name the colliding dates, and
// the dates must come from the same test that refuses — so `clashingDates` is now both: a non-empty
// answer IS the refusal, and its contents are the sentence. Keeping the old helpers beside it would
// have been two copies of INV-01's comparison in one file, free to disagree about a half day.
// ADR-011's slot table — `full` both halves, `am` the first, `pm` the second — is in that file,
// unchanged.

// ---------------------------------------------------------------------------
// CAL-03. 01-plan.md section 5, "the subtle shape is the mock's team scoping".
// ---------------------------------------------------------------------------

// `public.member_team_id(uuid)`, reproduced (TEA-01's migration, line 64). It answers the member's
// team and NULL for a member who does not exist OR HAS BEEN REMOVED — that `removed_at is null` is
// in the function body, not in the policies that call it, so every policy built on it inherits the
// removal filter without naming it.
//
// MIR-07, 2026-10-23. And `status = 'approved'`, which `20260910100000_solo_member_approval.sql:57-63`
// added to the SQL function and this reproduction never carried: a pending or rejected row with a
// `teamId` was on that team here and on no team in SQL.
const memberTeamId = (memberId: string | null): string | null =>
  members.find((m) => m.id === memberId && m.removedAt === null && m.status === "approved")
    ?.teamId ?? null;

// The SQL comparison those policies write, and the reason it is a function rather than `===`.
//
// `entry_select_team`, `entry_update_admin` and `entry_delete_admin` all compare
// `member_team_id(member_id) = member_team_id(auth.uid())`. In SQL `null = null` is NULL and NOT
// true, so a comparison with an unknown side admits NOTHING — which means a removed member's entries
// are invisible and untouchable to everybody, and a removed caller reads no entry at all. A
// JavaScript `===` would answer TRUE for two nulls and open exactly the rows PostgreSQL closes.
const sameTeam = (a: string | null, b: string | null): boolean => a !== null && a === b;

// `entry_update_admin` and `entry_delete_admin`'s shared `using` clause, reproduced. Both policies
// carry the identical predicate, so it is one function here for the same reason it is two identical
// clauses there: they are the same rule about the same rows.
//
// THE TEAM HALF IS THE ONE WITH NO TEST BEHIND IT and is why this function exists at all. Dropping
// it leaves `me.role === "admin"`, which passes every test a one-team fixture can carry while
// letting an admin of any team edit every entry in the product — rbac-and-security.md known weakness
// 1, and the shape ADR-016 Consequences names for this ticket by name.
//
// `me.removedAt === null` is `public.is_admin`'s own filter (same migration, line 54): a removed
// admin is not an admin.
const adminMayReach = (me: Member, entry: Entry): boolean =>
  me.role === "admin" &&
  me.removedAt === null &&
  sameTeam(memberTeamId(entry.memberId), memberTeamId(me.id));

// SOLO 2026-09-12, ADR-035 — `entry_update_manager`'s `using` clause, and the reason it is a SECOND
// function rather than a widening of the one above.
//
// **THE POLICY ABOVE IS WHAT LETS AN ADMIN EDIT AND DELETE; THIS ONE IS ONLY EVER CONSULTED BY THE
// THREE DECISION PATHS.** `updateEntry` and `deleteEntry` keep asking `adminMayReach` and must:
// widening them is exactly the mistake ADR-035 § Rationale refuses, and in SQL it is the difference
// between `entry_update_admin` and `entry_update_manager` plus clause (a2) of the trigger.
//
// The team half is load-bearing for the same reason it is there: without it a decider on ANY team
// reaches EVERY entry in the product, and it fails open and silently.
const deciderMayReach = (me: Member, entry: Entry): boolean =>
  mayDecide(me.role) &&
  me.removedAt === null &&
  sameTeam(memberTeamId(entry.memberId), memberTeamId(me.id));

// `entry_update_own` and `entry_delete_own`'s `using (member_id = (select auth.uid()))`, CAL-02's
// and unchanged by this ticket. It is named here only so the OR below reads as the two permissive
// policies it stands for rather than as one merged predicate — 01-plan.md section 8 rejects merging
// them in the migration, and merging them here would lose the same property one layer up.
const ownsEntry = (me: Member, entry: Entry): boolean => entry.memberId === me.id;

// ---------------------------------------------------------------------------
// ADM-05. 01-plan.md sections 4.2 and 5.
// ---------------------------------------------------------------------------

// The four sentences, repeated from src/lib/data/supabase.ts so the two implementations of the seam
// carry the same words — the rule CAL-01's three refusal constants and ADM-03's four already state.
const DECISION_REFUSED =
  "Only an admin, or a manager of one of this person's teams, can decide this entry — and only whoever rejected it, or an admin, can change a rejection. Nothing about this entry has changed.";
const APPROVE_REFUSED = "This entry could not be approved.";
const REJECT_REFUSED = "This entry could not be rejected.";
const REASON_REQUIRED =
  "A rejection needs a reason. Say what would work instead, so the entry can be re-planned.";

// ---------------------------------------------------------------------------
// ADM-06. 01-plan.md section 4.2.
// ---------------------------------------------------------------------------

// Two more sentences, repeated from src/lib/data/supabase.ts so the two implementations of the seam
// carry the same words — the rule CAL-01's three refusal constants and ADM-05's four already state.
const BULK_REJECT_REFUSED = "These entries could not be rejected.";
const NOTHING_SELECTED = "Select at least one entry before rejecting.";

// CLAUSES (a) AND (b) OF `public.entry_enforce_decision()`, REPRODUCED — AND THAT IS DECLARED
// RATHER THAN HIDDEN. This is a SECOND IMPLEMENTATION OF A CONTROL, not of an invariant, which is
// the strongest form of the thing this file does three times already (INV-01, INV-02, the policies).
// It is acceptable on the terms this file already states for INV-01 — the mock is not a datastore
// anybody's data lives in and the real mechanism is the trigger — and it exists so AC-8, AC-9,
// AC-16 and AC-17 are observable end to end with no provisioned project.
//
// WHAT IT PROVES AND WHAT IT DOES NOT is 01-plan.md Open questions item 2, and the honest half is
// this: ADR-016's own headline consequence asks for a member PATCHing {"status":"approved"} against
// a REAL PostgreSQL with a member's token, and no project is provisioned. Against this file AC-8 and
// AC-9 demonstrate THE SENTENCE, not the refusal. The refusal is held by the trigger.
//
// ONE FUNCTION FOR BOTH CLAUSES, because the SQL is one function: `approveEntry` and `rejectEntry`
// both go through it, so clause (a) is written once here exactly as it is written once there.
//
// CLAUSE (c) IS NOT HERE. No decision writes a substantive column, so the reset cannot fire on this
// path — and it already lives in `updateEntry`, where the edits that do fire it go through.
// MIR-14 — ADR-073 decision 4, clause (a1) of the trigger. WHO REJECTED EACH ENTRY, keyed by entry
// id. `rejected_by` is not on `Entry` (a shared-type change, MIR-14-b), so the mock holds it here,
// module-private: set on every transition into `rejected` and every reason change, deleted when the
// row leaves `rejected` — through a decision or through `updateEntry`'s INV-02 reset. A rejected row
// with no key is a rejection whose rejecter nobody recorded, as every row rejected before MIR-14 is
// in the database, and only an admin may change it.
const rejectedByOf = new Map<string, string>();

// Clause (a1): a non-admin moving a decision column of an entry somebody else rejected.
const overturnsAnotherRejection = (me: Member, row: Entry): boolean =>
  row.status === "rejected" && !mayAdminister(me.role) && rejectedByOf.get(row.id) !== me.id;

function applyDecision(
  me: Member,
  row: Entry,
  next: { status: EntryStatus; rejectionReason: string | null },
): Result<Entry> {
  // (a) THE GUARD. `is_admin` filters `removed_at is null` (TEA-01's migration, line 54), so a
  // removed admin is not an admin — the same filter `adminMayReach` above inherits.
  //
  // The condition is "a decision column MOVES", not "an admin is acting": an admin re-rejecting with
  // the identical wording moves nothing and would pass the guard in PostgreSQL too, and writing
  // `role !== "admin"` alone here would refuse a case the trigger admits.
  const moves = next.status !== row.status || next.rejectionReason !== row.rejectionReason;

  // SOLO 2026-09-12, ADR-035. `mayDecideEntriesOf` is `may_decide(uid)`. MIR-14: the own-entry
  // clause it also carried left with ADR-073 decision 3 — a manager may decide their own entry.
  // Then clause (a1): a rejection is changed only by its rejecter or an admin.
  if (moves && (!mayDecideEntriesOf(me, row.memberId) || overturnsAnotherRejection(me, row))) {
    return { ok: false, error: { code: "entry_decision_not_permitted", message: DECISION_REFUSED } };
  }

  const wasApproved = row.status === "approved";
  const reasonChanged = next.rejectionReason !== row.rejectionReason;
  const wasRejected = row.status === "rejected";

  // The two columns this ticket's grant names, and no others. `tentative` is untouched (INV-05,
  // AC-6) and so are the dates, the type and the portion.
  row.status = next.status;
  row.rejectionReason = next.rejectionReason;

  // (b) PROVENANCE, NEVER FROM THE WIRE. `approvedBy` is the acting member and never a parameter —
  // there is no parameter on either seam function that could carry one (AC-7).
  //
  // Nulling `rejectionReason` on approval is FORCED, not chosen: INV-03's check is a biconditional
  // and refuses any transition off `rejected` that leaves the reason standing (AC-4).
  if (row.status === "approved" && !wasApproved) {
    row.approvedBy = me.id;
    row.approvedAt = new Date().toISOString();
    row.rejectionReason = null;
  } else if (row.status !== "approved") {
    row.approvedBy = null;
    row.approvedAt = null;
  }

  // MIR-14 — the rejecter, clause (b)'s second branch: recorded on the way into `rejected` and on a
  // reason rewrite, and forgotten when the row leaves `rejected`.
  if (row.status === "rejected" && (!wasRejected || reasonChanged)) {
    rejectedByOf.set(row.id, me.id);
  } else if (row.status !== "rejected") {
    rejectedByOf.delete(row.id);
  }

  // The trigger's `new.updated_at := now()`, which is AC-15's "when the decision was recorded" —
  // the datastore's clock in the real seam, and here the only clock there is.
  row.updatedAt = new Date().toISOString();

  return { ok: true, value: { ...row } };
}

// ---------------------------------------------------------------------------
// TSK-01 — tasks. 01-plan.md § 4.5. ADR-057.
//
// `public.task` and its four policies, reproduced CLAUSE FOR CLAUSE (ADR-057 § Consequences). The
// table starts EMPTY: a task a test needs, a test creates, because every approved member can.
// ---------------------------------------------------------------------------

const tasks: Task[] = [];

/**
 * Test-only. Empties the task table.
 *
 * A NAMED EXPORT BESIDE `seam`, `__resetEvents`' shape, so seam parity is untouched. Nothing under
 * `src/` may call it, and nothing does.
 */
export function __resetTasks(): void {
  tasks.length = 0;
}

// Padded so `id` ascending is creation order, the tie-break the real seam's third `order` makes.
let nextTaskId = 0;
const newTaskId = (): string => `7a000000-0000-4000-8000-${String(++nextTaskId).padStart(12, "0")}`;

/**
 * § 3's predicate, the one expression in all four policies:
 * `member_id = auth.uid() and member_team_id(auth.uid()) is not null`.
 *
 * **NO ROLE CLAUSE, AND THERE MUST NEVER BE ONE.** Every other ownership helper in this file has an
 * admin arm; this one does not, by ADR-057 decisions 1 and 4.
 */
const ownsTask = (row: Task): boolean =>
  currentMemberId !== null && row.memberId === currentMemberId && memberTeamId(currentMemberId) !== null;

// Repeated verbatim from src/lib/data/supabase.ts.
const TASK_TITLE_INVALID = "Give the task a title of at most 200 characters.";
const TASK_NOTE_INVALID = "Keep the note to at most 1000 characters.";
const TASK_DATE_PAST = "A task can be dated today or later.";
const TASK_NOT_PERMITTED = "This task could not be changed. It may have been deleted.";
const TASK_SAVE_FAILED = "This task could not be saved.";
const TASK_TIME_INVALID = "Pick a time as HH:MM, or leave it empty.";

/** supabase.ts's `taskText`, repeated: trims, refuses title then note. */
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

/** supabase.ts's `taskTime`, repeated. TSK-06 AC-4: "" and null are no time; "HH:MM" 00:00..23:59
 *  is a time; anything else refuses `invalid_task_time`. */
function taskTime(
  value: string | null | undefined,
): { ok: true; timeOfDay: string | null } | { ok: false; error: Failure } {
  if (value === undefined || value === null || value === "") return { ok: true, timeOfDay: null };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return { ok: false, error: { code: "invalid_task_time", message: TASK_TIME_INVALID } };
  }
  return { ok: true, timeOfDay: value };
}

const taskDatePast = (date: string): boolean => date < eventToday();

// A `date` column refuses anything that is not a calendar date (22007/22008), which the real seam
// maps to `unknown`. Reproduced so a malformed date cannot be stored here and read back.
const isTaskDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
};

const byTaskOrder = (a: Task, b: Task): number =>
  a.date !== b.date
    ? a.date < b.date ? -1 : 1
    : a.createdAt !== b.createdAt
      ? a.createdAt < b.createdAt ? -1 : 1
      : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** TSK-06 AC-8, ADR-062 decision 5. `listTasks`' order, supabase.ts's `order by` clause for clause:
 *  date, done (false first), time of day ascending with null last, then `byTaskOrder`'s tail.
 *  `listOverdueTasks` keeps `byTaskOrder` (AC-10). "HH:MM" compares correctly as a string. */
const byDayOrder = (a: Task, b: Task): number =>
  a.date !== b.date
    ? a.date < b.date ? -1 : 1
    : a.done !== b.done
      ? a.done ? 1 : -1
      : a.timeOfDay !== b.timeOfDay
        ? a.timeOfDay === null ? 1 : b.timeOfDay === null ? -1 : a.timeOfDay < b.timeOfDay ? -1 : 1
        : byTaskOrder(a, b);

const taskNotPermitted = (): { ok: false; error: Failure } => ({
  ok: false,
  error: { code: "task_not_permitted", message: TASK_NOT_PERMITTED },
});

/** `task_update_own`: `using` and `with check` are the same predicate and `member_id` is not in the
 *  update grant, so the row stays the caller's. Zero rows is `task_not_permitted`. */
function updateOwnTask(
  taskId: string,
  values: { title?: string; note?: string | null; timeOfDay?: string | null; date?: string; done?: boolean },
): Result<Task> {
  const row = tasks.find((t) => t.id === taskId && ownsTask(t));
  if (!row) return taskNotPermitted();
  Object.assign(row, values);
  return { ok: true, value: { ...row } };
}

export const seam: DataSeam = {
  async ready() {
    return true;
  },

  // AC-1, AC-2, AC-3, AC-4, AC-5, AC-8, AC-9, AC-13.
  //
  // Sign-up itself never reports whether the address was allow-listed — the outcome is identical
  // either way (AC-5). The only failure modelled here is one the auth service raises before the
  // trigger ever runs; an address that already has an account is NOT one of them, because with
  // Confirm email on (which AC-7 requires) Supabase returns an obfuscated user rather than an error.
  // A second sign-up for a consumed address therefore lands on the `consumedAt` guard below, which
  // is AC-3.
  async signUp(input: SignUpInput): Promise<Result<SignUpOutcome>> {
    if (input.password.length < 6) {
      return {
        ok: false,
        error: { code: "weak_password", message: "That password is too weak. Please choose a longer one." },
      };
    }

    const userId = newUserId();
    const now = new Date().toISOString();

    // **SOLO, 2026-09-10 — EVERY SIGN-UP GETS A MEMBER ROW, AND NOBODY GETS A TEAM.** This is the
    // mock reproducing the rewritten `admit_allow_listed_member`: no allow-list lookup, `team_id`
    // null, `status` pending. The allow-list block that stood here consumed an entry and set the
    // team from it; the table is gone.
    //
    // `role` is still hard-coded and still never read from anything the caller supplied — TEA-01
    // AC-9, and it matters MORE now, because the caller is no longer somebody an admin vouched for
    // before they arrived.
    members.push({
      id: userId,
      teamId: null,
      displayName: input.displayName,
      // SOLO, 2026-09-13. The trigger's `coalesce(nullif(btrim(avatar), ''), '1.png')`, reproduced:
      // a sign-up that carries no avatar gets the default rather than a blank face.
      avatar: input.avatar.trim() || DEFAULT_AVATAR,
      role: "member",
      status: "pending",
      // SOLO, 2026-09-12. The address the account was created with, which is what
      // `sync_member_email` copies onto the row in the real datastore — here the trigger and the
      // insert are the same statement, so it is simply carried across.
      email: input.email,
      // A sign-up IS a sign-in in the mock: `signUp` hands back a live session when the project does
      // not confirm addresses, so GoTrue would have stamped this at the same moment.
      lastSignInAt: now,
      removedAt: null,
      createdAt: now,
    });

    // TEA-01 AC-7 requires Confirm email ON, and under that setting signUp returns no session. That
    // was unconditional until SOLO, 2026-09-10; the mock now models WHICHEVER setting the project is
    // configured for, and `playwright.config.ts` pins the flag ON so AC-7 still runs against the one
    // it was written for. `src/lib/config.ts` carries the reasoning and the warning that goes with
    // it — this flag does not turn confirmation off in a real project and cannot.
    if (requiresEmailConfirmation()) {
      return { ok: true, value: { needsEmailConfirmation: true, session: null } };
    }

    // **WITHOUT CONFIRMATION THE ACCOUNT HAS TO BECOME SIGN-IN-ABLE, AND THAT IS THE REAL WORK
    // HERE.** `signIn` above answers from `FIXTURE_CREDENTIALS` and nothing else — a frozen array —
    // so before this every account created through the form was one that could never sign in again,
    // under either setting. That was invisible while sign-up ended on a terminal notice: nobody got
    // as far as trying. It stops being invisible the moment sign-up hands back a session.
    //
    // `signedUp` is the mutable half of that list. It is module state and resets on a document load,
    // exactly as `members` and `allowedEmails` do, so no test inherits an account from another file.
    signedUp.push({
      email: input.email,
      password: input.password,
      userId,
      emailConfirmed: true, // Supabase sets `email_confirmed_at` at insert time with Confirm email OFF
      // SOLO, 2026-09-10. EVERY sign-up now has a member row, so this is never `member-less` — but
      // that row carries no team until an admin approves it, which is what `status` says.
      membership: "member",
    });

    // **AC-5 IS NOW TRUE BY CONSTRUCTION RATHER THAN BY CARE.** It required the success branch to be
    // identical whether or not the address was allow-listed; there is no allow-list, so there is no
    // second branch left to keep identical. Everybody gets the same session and the same pending
    // member row, and what differs afterwards is only what an admin decides.
    const session: Session = {
      user: { id: userId, email: input.email, emailConfirmed: true },
      accessToken: `mock-access-token-${userId}`,
    };
    setSession(session);
    return {
      ok: true,
      value: { needsEmailConfirmation: false, session: { ...session } },
    };
  },

  // AC-1, AC-9. Null means "this auth user has no member row" — a normal answer, not an error.
  async getOwnMember(userId: string): Promise<Member | null> {
    return members.find((m) => m.id === userId) ?? null;
  },

  // -------------------------------------------------------------------------
  // TEA-02. 02-design.md section 3.
  // -------------------------------------------------------------------------

  // TEA-02 AC-1, AC-9.
  async getCurrentMember(): Promise<Member | null> {
    return members.find((m) => m.id === currentMemberId) ?? null;
  },

  /**
   * SOLO, 2026-09-10. Everybody waiting on a decision, newest first. Replaces `listAllowedEmails`.
   *
   * **NOT TEAM-SCOPED, WHICH IS UNLIKE EVERY OTHER LIST READ HERE**, and it reproduces
   * `member_select_pending_admin` rather than inventing a rule: that policy is
   * `is_admin(uid) and team_id is null and status <> 'approved'`. A pending person is on no team, so
   * there is nothing to scope by.
   *
   * A member gets an empty list rather than an error, the shape `listAllowedEmails` used, because a
   * policy that matches no rows is not a refusal.
   */
  async listPendingMembers(): Promise<Member[]> {
    if (!currentAdmin()) return [];
    return members
      .filter((m) => m.teamId === null && m.status === "pending")
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({ ...m }));
  },

  /**
   * SOLO, 2026-09-10. Approve or reject one waiting sign-up.
   *
   * **SOLO, 2026-09-11 — THE TEAM WRITTEN IS THE ONE THE ADMIN CHOSE, AS LONG AS IT EXISTS.** This
   * is `public.admit_member` reproduced: it tests `is_admin` and the team's existence and nothing
   * about which team the admin is on. It used to reproduce `member_decide_admin`'s `with check`,
   * which confined an approval to the admin's own team; the operator decided every admin manages
   * every team.
   *
   * The `using` clause admits only rows that are still `pending` with no team, so re-deciding
   * somebody already on a team is refused — that is `member_update_admin`'s territory.
   */
  //
  // MIR-02: the two refusals carry the sentence the real seam shows for `admit_member` and
  // `reject_member`'s 42501, not the function bodies' wording. They differed, and MIR-02 AC-9 names
  // the shipped sentence; the behaviour — who is refused, and when — is unchanged.
  async decideMember(memberId: string, decision: MemberDecision): Promise<Result<void>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", SIGNUP_DECISION_REFUSED);

    const target = members.find(
      (m) => m.id === memberId && m.teamId === null && m.status === "pending",
    );
    if (!target) return refused("not_permitted", SIGNUP_DECISION_REFUSED);

    if (decision.approve && !teams.some((t) => t.id === decision.teamId)) {
      return refused("not_permitted", "That team does not exist.");
    }

    if (decision.approve) {
      target.status = "approved";
      target.teamId = decision.teamId;
    } else {
      target.status = "rejected";
      target.teamId = null;
    }
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // TEA-03. 02-design.md sections 1.2, 1.4 and 3.
  // -------------------------------------------------------------------------

  // TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8.
  //
  // This reproduces the two POLICIES composing, not the screen (02-design.md section 3). Row-level
  // security policies are permissive and OR together (ADR-018), and `member_team_id` filters
  // `removed_at is null`, so there are three distinct answers and the middle one is the state
  // ADR-018 created on purpose:
  //
  //   no member row      -> []                     AC-6, AC-7
  //   a REMOVED caller   -> their own row only     `member_select_own` answers; the team policy
  //                                                does not, because member_team_id filtered them
  //                                                out. Collapsing this into [] would erase the
  //                                                difference between removed and never admitted.
  //   an active caller   -> their whole team, REMOVED MEMBERS INCLUDED
  //
  // The role is not consulted anywhere below, which is AC-3: an admin cannot receive a row or a
  // field a member does not, because there is no second policy and no branch on role.
  //
  // NO `removedAt` FILTER on the team answer. A mock that filtered would make every component test
  // pass against a seam that has already made INV-04 uncomputable, and MemberList.tsx's own filter
  // would hide the difference. ADR-013, and 02-design.md section 3, "Shape 1".
  async listMembers(): Promise<Member[]> {
    const me = members.find((m) => m.id === currentMemberId) ?? null;
    if (!me) return [];

    const rows =
      me.removedAt !== null
        ? [me]
        : members.filter((m) => m.teamId === me.teamId); // INV-07: the team boundary, and nothing else

    // AC-8. The same limit and the same raise as supabase.ts. This array is bounded by the fixtures
    // so it never fires; it is here so the two implementations tell one story rather than because
    // the mock can truncate.
    const bounded = rows.slice().sort(byCreatedAtThenId).slice(0, ROSTER_LIMIT);
    if (bounded.length >= ROSTER_LIMIT) {
      throw new Error(
        `listMembers returned ${bounded.length} rows at the ${ROSTER_LIMIT} limit: the roster may ` +
          `be truncated and must not be consumed (TEA-03 AC-8)`,
      );
    }

    return bounded;
  },

  // -------------------------------------------------------------------------
  // TEA-04. 01-plan.md section 5, "What the mock must reproduce".
  // -------------------------------------------------------------------------

  // TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12.
  //
  // This reproduces the POLICY AND THE TRIGGER, never the screen, and it matters more here than in
  // any earlier ticket because six of the fifteen criteria are refusals. A mock that let a member
  // remove somebody would make every component test pass against a missing policy, and the policy
  // is the entire feature.
  //
  // The order below is the datastore's, read from the outside: `member_update_admin`'s `using`
  // tests admin-and-own-team and a row failing it simply does not match (zero rows, which is a
  // refusal); then the trigger's clauses raise `42501`. Both arrive at the seam as
  // `not_permitted`, which is why they collapse to one code here (01-plan.md section 4.1).
  async removeMember(memberId: string): Promise<Result<Member>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Only an admin can remove a member.");

    // `member_update_admin.using`, both halves - INV-07 is the team comparison and nothing else.
    // A row on another team and a row that does not exist are the same answer, because the policy
    // filters rather than errors and the caller learns nothing either way.
    const target = members.find((m) => m.id === memberId && m.teamId === me.teamId);
    if (!target) return refused("not_permitted", "That member could not be removed.");

    // AC-9, the trigger comparing `old.id` to `auth.uid()`.
    if (target.id === me.id) {
      return refused("not_permitted", "You cannot remove yourself from the team.");
    }

    // The trigger's one-way clause. Removal is not undone and not re-dated - restoring a member is
    // not a decided permission, and re-dating one is ADR-013's revert condition as an ordinary
    // write.
    if (target.removedAt !== null) {
      return refused("not_permitted", "That person has already left the team.");
    }

    // AC-3. The mock's own clock, standing for the trigger's `now()`. Nothing the caller passed can
    // reach this line, here or in the real seam.
    target.removedAt = new Date().toISOString();
    return { ok: true, value: { ...target } };
  },

  // TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12.
  //
  // SOLO, 2026-09-24 — ADR-044. **THE DIVERGENCE THAT STOOD HERE IS GONE**, and the note is kept
  // rather than deleted because a reader of the old file will come looking for it: this mock used to
  // refuse promoting somebody who is already an admin while the datastore's bare `update` reported
  // success on zero changed columns. The rank write is now `public.set_member_role`, whose `where`
  // carries `role <> 'admin'`, so the datastore refuses it too and the two agree by construction.
  // SOLO, 2026-09-10. The mock reproduces the POLICY: an admin, the caller's own team on both sides.
  // MIR-02: that bound is `public.set_member_team` now, unchanged; the three refusals carry the one
  // sentence the real seam shows for its 42501 (MIR-02 AC-10), where they used to differ.
  async setMemberTeam(memberId: string, teamId: string): Promise<Result<Member>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", MEMBER_TEAM_SAVE_REFUSED);
    if (teamId !== me.teamId) return refused("not_permitted", MEMBER_TEAM_SAVE_REFUSED);
    const target = members.find((m) => m.id === memberId && m.teamId === me.teamId);
    if (!target) return refused("not_permitted", MEMBER_TEAM_SAVE_REFUSED);
    target.teamId = teamId;
    return { ok: true, value: { ...target } };
  },

  // MIR-03, 2026-10-20 — ADR-065. `public.promote_member_to_admin` reproduced: `setRank`'s own-team
  // predicate, and it does not go through `setMemberRole`, so that one's `admin` refusal never
  // touches it.
  async promoteMember(memberId: string): Promise<Result<Member>> {
    return setRank(memberId, "admin", "Only an admin can promote a member.", MEMBER_PROMOTE_REFUSED);
  },

  // SOLO 2026-09-12, ADR-035. The general form of the function above. **IT REPRODUCES THE FUNCTION,
  // NOT THE SCREEN**, which is this file's standing contract: the acceptance suite drives this seam,
  // so a mock that let a manager set a role would make the refusal pass against nothing.
  //
  // MIR-03, 2026-10-20 — ADR-065 decision 2. `"admin"` is refused after the admin check and before
  // any row lookup, the order `public.set_member_role` uses.
  async setMemberRole(memberId: string, role: MemberRole): Promise<Result<Member>> {
    if (!currentAdmin()) return refused("not_permitted", "Only an admin can change a role.");
    if (role === "admin") return refused("not_permitted", MEMBER_RANK_REFUSED);
    return setRank(memberId, role, "Only an admin can change a role.", MEMBER_RANK_REFUSED);
  },

  // -------------------------------------------------------------------------
  // SOLO 2026-09-10 — the profile screen's two writes.
  // -------------------------------------------------------------------------

  // **THE REFUSALS HERE REPRODUCE THE MIGRATION, NOT THE SCREEN**, which is the contract every other
  // function in this file keeps: a mock that accepted a blank name or a stranger's avatar would make
  // the screen's tests pass against a datastore that refuses both.
  //
  // `20260910093000_solo_profile_self_update.sql` is the authority for each branch below:
  //  - the row written is `auth.uid()`'s and no other — `member_update_own`'s `using` and the
  //    trigger clause that refuses these two columns on somebody else's row. There is no `memberId`
  //    parameter, so the mock has nothing to check here and neither does the type;
  //  - a removed member writes nothing — the same policy's `removed_at is null`;
  //  - a blank display name is refused by the trigger, which trims and then raises;
  //  - an avatar outside `AVATAR_CHOICES` is refused by the `member_avatar_is_offered` check.
  async updateOwnProfile(input: UpdateOwnProfileInput): Promise<Result<Member>> {
    const me = members.find((m) => m.id === currentMemberId) ?? null;
    if (!me || me.removedAt !== null) {
      return refused("not_permitted", "Your profile could not be saved.");
    }

    // MIR-07. The columns `authenticated` may write on its own row and have the write succeed:
    // `display_name` and `avatar`. Any other key is a column the grant revokes or the trigger refuses
    // — MIR-02 (`20261020120000_mir02_member_self_writes.sql:62-66,136-139,163`). The type names two
    // fields; a caller that is not this application can name more, as a hand-written PATCH can, and
    // ignoring them silently would answer `ok` where SQL raises 42501.
    const OWN_PROFILE_KEYS: readonly string[] = ["displayName", "avatar"];
    if (Object.keys(input).some((k) => !OWN_PROFILE_KEYS.includes(k))) {
      return refused("not_permitted", "Your profile could not be saved.");
    }

    // Trimmed HERE and stored trimmed, exactly as the trigger's `btrim` does it. A mock that stored
    // the untrimmed string would disagree with the datastore about what was saved, one space at a
    // time, and the disagreement would surface as a roster that renders differently after a reload.
    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      return {
        ok: false,
        error: { code: "invalid_display_name", message: "Enter a display name." },
      };
    }
    // NO UPPER BOUND, and its absence is deliberate. `member.display_name` is `text not null` with
    // no check constraint (`20260831150024_tea01_membership.sql:34`), `.ai/standards/data-model.md`
    // records no limit, and sign-up imposes none — so a cap invented here would be a rule the
    // datastore does not hold and the OTHER screen that writes this column does not apply. The
    // `invalid_display_name` code covers blank only, which is what the trigger actually raises.

    // **OR THE ONE THEY ALREADY HAVE, AND THE SECOND CLAUSE IS NOT A COURTESY.** SOLO, 2026-09-13:
    // the offered set is the files in `public/images/` at build time, so a row can hold a name that
    // is not in it — a file removed from the folder, or `DEFAULT_AVATAR` when the folder has no
    // `1.png`. Without this clause, everyone holding such a value is refused on every save —
    // including a save that only changes their display name — with a message telling them to choose
    // an avatar they had not touched. The rule is *keep what you have, or take one that is
    // offered*, and it is the same rule in `supabase.ts`.
    if (input.avatar !== me.avatar && !AVATAR_CHOICES.includes(input.avatar)) {
      return {
        ok: false,
        error: { code: "invalid_avatar", message: "Choose one of the avatars offered." },
      };
    }

    me.displayName = displayName;
    me.avatar = input.avatar;
    return { ok: true, value: { ...me } };
  },

  // **IT VERIFIES THE CURRENT PASSWORD, and that is the branch worth having a mock for.**
  // `supabase.auth.updateUser({ password })` verifies nothing — a live session is the whole of its
  // authorisation — so the check exists only because the real implementation performs it
  // deliberately. A mock that skipped it would let the screen's tests pass against an implementation
  // that had quietly dropped the re-authentication, which is the one failure this pair can hide.
  //
  // It is keyed on the SESSION and not on the member row: an account with no member row still has a
  // password, and changing it is not a team matter.
  async changePassword(input: ChangePasswordInput): Promise<Result<void>> {
    const session = currentSession;
    if (!session) {
      return refused("not_permitted", "Sign in again before changing your password.");
    }

    const account = accounts().find((c) => c.userId === session.user.id);
    if (!account) {
      return refused("not_permitted", "Your account could not be read.");
    }

    if (currentPasswordOf(account) !== input.currentPassword) {
      return {
        ok: false,
        error: { code: "wrong_password", message: "That is not your current password." },
      };
    }

    // The same threshold `signUp` above enforces and the same code, because it is the same
    // condition — GoTrue raises `weak_password` for both.
    if (input.newPassword.length < 6) {
      return {
        ok: false,
        error: {
          code: "weak_password",
          message: "That password is too weak. Please choose a longer one.",
        },
      };
    }

    passwordOverrides.set(account.userId, input.newPassword);
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // TEA-05. 01-plan.md section 5, "What the mock must reproduce".
  // -------------------------------------------------------------------------

  // TEA-05 AC-7. The session as it stands, or null.
  async getSession(): Promise<Session | null> {
    return currentSession ? { ...currentSession } : null;
  },

  // TEA-05 AC-6, AC-7, AC-8.
  //
  // EXPIRY IS NOT MODELLED, deliberately (01-plan.md section 5). AC-8 is the real client refreshing
  // a token and finally emitting with a null session; this mock has no clock and no token, and a
  // fake expiry would be a SECOND definition of when a session ends - one that drifts in the
  // direction that matters, where the mock says expired and the real client has quietly refreshed.
  // AC-8 is a real-project criterion and section 8.1 records it as one.
  onAuthStateChange(listener: (session: Session | null) => void): () => void {
    sessionListeners.add(listener);

    // **SOLO 2026-09-10 — IT EMITS ONCE ON SUBSCRIBE, BECAUSE THE REAL CLIENT DOES.** GoTrue calls
    // every new subscriber back with `INITIAL_SESSION` — the session if there is one, `null` if the
    // read failed — immediately after registering it, unconditionally
    // (`@supabase/auth-js@2.112.4/dist/module/GoTrueClient.js:3633-3644`, read on disk). Until this
    // ticket the mock did NOT, so `useSession` had to read once itself AND subscribe, and against
    // the real client that meant two `auth.getUser()` calls and two `member` selects on every mount.
    // Now one path serves both implementations, and the divergence that forced the second read is
    // gone.
    //
    // ASYNCHRONOUS, matching the real client, which emits from an async IIFE after awaiting its own
    // initialisation. A synchronous callback here would run inside the caller's `useEffect` before
    // the effect had returned its cleanup, which is a state update during an effect body rather than
    // after it — a shape React tolerates and nobody should rely on.
    //
    // The membership check is not a formality: a subscriber that unsubscribed inside the same tick —
    // which is exactly what React's StrictMode does on its throwaway first mount — must not be
    // called after its cleanup has run.
    queueMicrotask(() => {
      if (!sessionListeners.has(listener)) return;
      listener(currentSession ? { ...currentSession } : null);
    });

    return () => {
      sessionListeners.delete(listener);
    };
  },

  // TEA-05 AC-1, AC-2, AC-3, AC-4.
  //
  // This answers from FIXTURE_CREDENTIALS and from nothing else, so the mock's refusals are the
  // SEED's refusals rather than a second story about who can sign in. Reproducing the service, not
  // the screen: a mock that accepted any password would make every component test pass against a
  // sign-in that refuses nobody.
  //
  // The two refusals are in the order GoTrue answers them. An unknown address and a wrong password
  // are ONE answer with one message (AC-2) - anything else here would be an address-enumeration
  // oracle against the team roster. An unconfirmed address is a different answer (AC-3), because
  // folding it into the first would send somebody to reset a password that is correct.
  //
  // It writes NOTHING (AC-11). `members` is not touched on any path through this function, on
  // success or on either refusal, which is the mock reproducing the fact that `public.member` has
  // no insert policy and that the admission trigger fires on confirmation rather than on sign-in.
  //
  // CAL-02 adds one account to the list it searches, and adds it here rather than to
  // FIXTURE_CREDENTIALS itself so that a reader of TEA-05's array sees TEA-05's accounts. It has a
  // seed row like every other row in it.
  async signIn(input: SignInInput): Promise<Result<Session>> {
    const email = fold(input.email);
    // SOLO, 2026-09-10 — `signedUp` is third and last, so a seeded address always wins. A sign-up
    // that reused a fixture address must not shadow the fixture's password and quietly rewrite what
    // every other spec file's sign-in means.
    // SOLO, 2026-09-10 — the list moved into `accounts()` above, unchanged in order and in content,
    // because `changePassword` must find the caller by exactly the same rule.
    const account = accounts().find((c) => fold(c.email) === email);

    // `currentPasswordOf` and not `account.password`: a password changed on the profile screen is
    // held in `passwordOverrides` and the OLD one must stop working in the same call — which is the
    // only observable difference between a password that changed and one that did not.
    if (!account || currentPasswordOf(account) !== input.password) {
      return {
        ok: false,
        error: { code: "invalid_credentials", message: "That email or password is not correct." },
      };
    }

    if (!account.emailConfirmed) {
      return {
        ok: false,
        error: {
          code: "email_not_confirmed",
          message: "Open the confirmation link in your email before signing in.",
        },
      };
    }

    // AC-4's whole mechanism, and it needs no branch here: the session is established for the auth
    // user, and whether that user has a `member` row is `getCurrentMember`'s answer a moment later.
    // A mock that decided membership at sign-in would be deciding it in the wrong place.
    const session: Session = {
      user: { id: account.userId, email: account.email, emailConfirmed: true },
      accessToken: `mock-access-token-${account.userId}`,
    };
    setSession(session);
    return { ok: true, value: { ...session } };
  },

  // TEA-05 AC-6. Clears the session and notifies, which is what the listener in useSession re-
  // resolves against. It cannot fail here; the `Result` exists because it can fail in the real one.
  async signOut(): Promise<Result<void>> {
    setSession(null);
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-01. 01-plan.md section 5.
  // -------------------------------------------------------------------------

  // CAL-01 AC-1 ... AC-11.
  //
  // The refusals below reproduce the DATASTORE, not the screen: the policy's `with check`, the
  // withheld column grant, and INV-01's exclusion constraint. A mock that accepted an overlap would
  // make every component test pass against a missing constraint, which is the one failure a mock
  // seam can cause and not catch.
  //
  // AC-10 and AC-11 need no branch here and that is the point. `CreateEntryInput` carries neither a
  // `memberId` nor any decision column, so there is no value a caller could pass that this function
  // would have to refuse - the type is the affordance and the policy plus the grant are the control.
  // `memberId` comes from the current session and `status` is written as `pending` below.
  async createEntry(input: CreateEntryInput): Promise<Result<Entry>> {
    // AC-9, refused before anything else, exactly as the real seam refuses it before the round trip.
    if (input.endDate < input.startDate) {
      return {
        ok: false,
        error: {
          code: "invalid_date_range",
          message: "The end date must be the same as, or after, the start date.",
        },
      };
    }

    // The insert policy, reproduced: an entry belongs to a member row, and a caller with no session
    // or no member row has none. INV-07 is the not-null reference behind that.
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be created." },
      };
    }

    // AC-7 and AC-8, and the pair is the test: AC-7 asserts the refusal and AC-8 asserts it is not
    // over-broad.
    const clash = clashingDates(entries, me.id, input);
    if (clash.length > 0) {
      return { ok: false, error: { code: "overlapping_entry", message: overlapMessage(clash) } };
    }

    const now = new Date().toISOString();
    const myTeam = teams.find((t) => t.id === memberTeamId(me.id));
    const autoApproved = myTeam !== undefined && !needsApproval(myTeam, input.type);
    const row: Entry = {
      id: newEntryId(),
      memberId: me.id,
      type: input.type,
      portion: input.portion,
      startDate: input.startDate,
      endDate: input.endDate, // AC-2 and AC-3: ONE row spanning the range, end inclusive
      tentative: input.tentative,
      // AC-6 and AC-11. `status` is the column default and never the caller's, and `tentative` does
      // not touch it - glossary.md keeps the two axes apart deliberately.
      //
      // SOLO, 2026-09-11 — `entry_apply_approval_setting()`, reproduced. When the member's team says
      // this type needs no approval, the row is stored `approved` with `approvedBy` null: no member
      // decided it, and naming an admin would put a name on a decision nobody took. The CALLER still
      // cannot choose the status — `CreateEntryInput` carries none — so this is the datastore's
      // decision made on their behalf, exactly as the trigger makes it. A team that cannot be found
      // leaves the entry `pending`, which is the trigger's fail-closed direction too.
      status: autoApproved ? "approved" : "pending",
      rejectionReason: null,
      note: input.note,
      approvedBy: null,
      approvedAt: autoApproved ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    entries.push(row);
    return { ok: true, value: { ...row } };
  },

  // CAL-01 AC-1, AC-2, AC-3, AC-5, AC-6, AC-8. Newest start date first, then id ascending - the same
  // two-key ordering the real implementation asks PostgreSQL for, so the two cannot disagree about
  // row order when two entries share a start date.
  //
  // An empty array is a normal answer: it is what a caller with no session gets, and it is what a
  // member with no entries gets.
  async listOwnEntries(): Promise<Entry[]> {
    if (!currentMemberId) return [];
    return entries
      .filter((e) => e.memberId === currentMemberId)
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : b.startDate.localeCompare(a.startDate),
      )
      .map((e) => ({ ...e }));
  },

  // -------------------------------------------------------------------------
  // CAL-02. 01-plan.md sections 4.1 and 5.
  // -------------------------------------------------------------------------

  // CAL-02 AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12.
  //
  // The refusals below reproduce the DATASTORE, not the screen: `entry_update_own`'s `using` clause,
  // the update grant's column list, INV-01's exclusion constraint and INV-02's trigger. Three of the
  // four are a SECOND IMPLEMENTATION of a mechanism that lives in PostgreSQL, and that is acceptable
  // only because the mock is not a datastore anybody's data lives in - BUG-001 pinned the acceptance
  // suite to this implementation, so this is what AC-5 to AC-9 are observed against.
  //
  // THE OWNER COMPARISON IS THE ONE THAT MATTERS. A mock that edited any id it was handed would pass
  // seam parity, pass every happy path, and leave AC-9 untestable - 01-plan.md section 5 names this
  // as the subtle shape of this ticket. The real mechanism is the policy; this is its stand-in.
  //
  // AC-8 and AC-10 need no branch here, exactly as CAL-01's `createEntry` needs none:
  // `UpdateEntryInput` carries no `memberId`, no `status` and no `rejectionReason`, so there is no
  // value a caller could pass that this function would have to refuse. The type is the affordance;
  // the withheld column privileges are the control.
  async updateEntry(entryId: string, input: UpdateEntryInput): Promise<Result<Entry>> {
    // AC-11, refused before anything else, exactly as the real seam refuses it before the round trip.
    if (input.endDate < input.startDate) {
      return {
        ok: false,
        error: {
          code: "invalid_date_range",
          message: "The end date must be the same as, or after, the start date.",
        },
      };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be edited." },
      };
    }

    // AC-9, and the two cases are DELIBERATELY ONE ANSWER: "this entry is not yours" and "no such
    // entry" are indistinguishable under the policy and must stay so here, or the mock becomes an
    // oracle for which entry ids exist in the team while the real seam is not one.
    //
    // CAL-03 AC-1, AC-5, AC-8. The `||` is the two PERMISSIVE policies composing, which is what
    // PostgreSQL does by its own rule: `entry_update_own` admits the caller's own rows and
    // `entry_update_admin` admits their team's rows when the caller is an admin, and a caller gets
    // the union. CAL-02's half is `ownsEntry` and is untouched — an implementation that replaced it
    // with a single merged predicate would be the rejected alternative 1 of 01-plan.md section 8,
    // one layer up.
    //
    // CAL-03 AC-3's `entry_not_permitted` still covers "not yours", "no such entry" AND now
    // "another team's" alike, and must keep doing so. A distinct answer for the cross-team case
    // would tell an admin that an id exists in a team they cannot read.
    const row =
      entries.find((e) => e.id === entryId && (ownsEntry(me, e) || adminMayReach(me, e))) ?? null;
    if (!row) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be edited." },
      };
    }

    // AC-7. INV-01 reached on UPDATE, which is what a constraint over (member_id, date_range,
    // portion_slots) does without being told: the row being edited is EXCLUDED from the comparison,
    // because an entry cannot clash with itself.
    //
    // CAL-03 AC-9, AND THE COMPARISON KEYS ON `row.memberId` RATHER THAN ON `me.id`. That was the
    // same value through CAL-02, because the only editable row was the caller's own; it stops being
    // the same value the moment an admin edits somebody else's. `entry_no_overlapping_portion` keys
    // on the ROW's `member_id`, so an admin's edit collides with THAT MEMBER's other entries and
    // never with the admin's own — and this is the line an implementation written from the admin's
    // point of view gets wrong, in both directions at once: it would refuse an edit that clashes
    // with the ADMIN's calendar and accept one that double-books the OWNER.
    const clash = clashingDates(entries, row.memberId, input, row.id);
    if (clash.length > 0) {
      return { ok: false, error: { code: "overlapping_entry", message: overlapMessage(clash) } };
    }

    // INV-02, reproduced. THIS IS A SECOND IMPLEMENTATION OF AN INVARIANT: the real mechanism is
    // `public.entry_enforce_decision()` (ADR-016 clause (c), shipped by CAL-01), and the four lines
    // it writes are the four written below.
    //
    // The comparison is against the row as it stands, which is the trigger's OLD, and the carve-out
    // is data-model.md's: dates, type, portion and tentative are substantive, `note` alone is not
    // (AC-6). It is ACTOR-BLIND, as the trigger is - an admin editing their own approved entry loses
    // the approval exactly as a member does (01-plan.md Open questions item 3).
    const substantive =
      input.startDate !== row.startDate ||
      input.endDate !== row.endDate ||
      input.type !== row.type ||
      input.portion !== row.portion ||
      input.tentative !== row.tentative;

    if (substantive && row.status !== "pending") {
      row.status = "pending";
      row.approvedBy = null;
      row.approvedAt = null;
      // Forced rather than chosen: `entry_rejection_reason_iff_rejected` refuses any transition off
      // `rejected` that leaves the reason standing (INV-03).
      row.rejectionReason = null;
      // MIR-14: and the rejecter, which clause (c) clears with the rest.
      rejectedByOf.delete(row.id);
    }

    row.type = input.type;
    row.portion = input.portion;
    row.startDate = input.startDate;
    row.endDate = input.endDate;
    row.tentative = input.tentative;
    row.note = input.note;
    // AC-12. In the real datastore this line is the trigger's `new.updated_at := now()`, added to
    // `entry_enforce_decision()` by this ticket's migration - never the client's clock. Here there
    // is no clock but this one, and the value is the mock's stand-in for the datastore's.
    row.updatedAt = new Date().toISOString();

    return { ok: true, value: { ...row } };
  },

  // CAL-02 AC-3, AC-4, AC-9. A HARD delete: the row leaves the array and its `approvedBy` leaves
  // with it, and the dates it held are free for INV-01's next comparison (AC-4) because nothing
  // remains to intersect.
  //
  // The owner comparison is the policy's `using (member_id = auth.uid())`, and zero rows removed is
  // `entry_not_permitted` and not success - the shape the real implementation reads off the deleted
  // representation it asks for.
  //
  // CAL-03 AC-2, AC-5, AC-8, AC-12. The same `||` as `updateEntry` above, standing for the same two
  // permissive policies — `entry_delete_own` and `entry_delete_admin`. AC-12 needs no line of its
  // own: the row leaves the array carrying its `approvedBy` and `approvedAt` with it, because they
  // are fields OF the row and there is nothing left to refer to either.
  async deleteEntry(entryId: string): Promise<Result<void>> {
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    const index = me
      ? entries.findIndex((e) => e.id === entryId && (ownsEntry(me, e) || adminMayReach(me, e)))
      : -1;

    if (index === -1) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be deleted." },
      };
    }

    entries.splice(index, 1);
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-03. 01-plan.md sections 4.1 and 5.
  // -------------------------------------------------------------------------

  // CAL-03 AC-1, AC-2, AC-3, AC-4, AC-9, AC-10, AC-12. Newest start date first, then id ascending -
  // the same two-key ordering the real implementation asks PostgreSQL for, so the two cannot
  // disagree about row order when two entries share a start date. Across a whole team a shared start
  // date is the normal case rather than the edge one.
  //
  // THIS FUNCTION FILTERS BY TEAM AND THE REAL ONE DOES NOT, and that asymmetry is the subtle shape
  // 01-plan.md section 5 names. The real implementation issues an unfiltered select and is scoped by
  // `entry_select_team`; the mock has no policy, so the scope has to be written. A mock that returned
  // every entry it holds would pass seam parity, pass every happy path, and leave AC-8 UNTESTABLE
  // against the seam the acceptance suite actually drives - BUG-001 pinned that suite to this
  // implementation.
  //
  // `sameTeam` and not `===`: `member_team_id` is null for a removed member, and `null = null` is
  // NULL in SQL rather than true. So a removed member's entries are invisible here exactly as they
  // are there, and a removed caller reads none - which is the policy's answer and not a choice this
  // function makes.
  async listTeamEntries(): Promise<Entry[]> {
    const mine = memberTeamId(currentMemberId);

    const rows = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : b.startDate.localeCompare(a.startDate),
      )
      .slice(0, TEAM_ENTRY_LIMIT);

    // The same limit and the same raise as supabase.ts, and the same reason as `listMembers`: this
    // array is bounded by the fixtures so it never fires, and it is here so the two implementations
    // tell one story rather than because the mock can truncate.
    if (rows.length >= TEAM_ENTRY_LIMIT) {
      throw new Error(
        `listTeamEntries returned ${rows.length} rows at the ${TEAM_ENTRY_LIMIT} limit: the list ` +
          `may be truncated and must not be consumed`,
      );
    }

    return rows.map((e) => ({ ...e }));
  },

  // -------------------------------------------------------------------------
  // CAL-04. 01-plan.md sections 4 and 5.
  //
  // NEITHER FUNCTION COUNTS ANYTHING. `absenceCountsFor` in ./absence.ts is INV-04's single
  // implementation and this file does not import it: with zero copies of the arithmetic in the seam
  // there is nothing for tests/seam-parity.test.ts to miss (01-plan.md section 5).
  // -------------------------------------------------------------------------

  // CAL-04 AC-7, AC-14. `team_select_own`, reproduced: `id = member_team_id(auth.uid())`.
  //
  // `memberTeamId` is null for a caller with no member row AND for a removed one, and `id = null` is
  // never true in SQL - so both read no team at all, which is the policy's answer and not a choice
  // this function makes. Null is a normal answer here for the same reason it is on
  // `getCurrentMember`: it is the NotOnATeam state and it already has a screen.
  //
  // THE OTHER TEAM'S ROW IS IN `teams` AND MUST NEVER COME BACK. A mock that returned the only row
  // it holds would pass every test a one-team fixture can carry while hiding a missing team
  // predicate - the failure ADR-018's revert condition names on `member`.
  async getTeam(): Promise<Team | null> {
    const mine = memberTeamId(currentMemberId);
    if (mine === null) return null;
    const row = teams.find((t) => t.id === mine);
    return row ? { ...row } : null;
  },

  // -------------------------------------------------------------------------
  // ADM-01. 01-plan.md sections 4.1 and 5.
  // -------------------------------------------------------------------------

  // ADM-01 AC-2, AC-5, AC-9, AC-12, AC-14.
  //
  // THIS REPRODUCES THE POLICY AND NOT THE SCREEN, for the reason `currentAdmin` above records: the
  // acceptance suite drives this seam (BUG-001 pins it, tests/e2e/seam.setup.ts), so a mock that let
  // a member through would make AC-4, AC-5 and AC-10 pass against nothing.
  //
  // `currentAdmin()` IS `team_update_admin`'s two predicates in one call. It already filters
  // `removedAt === null` and `role === "admin"`, so AC-14 is inherited here exactly as it is
  // inherited in SQL from `is_admin`'s own body - written once rather than twice.
  //
  // THE CALLER'S OWN TEAM ONLY, resolved through `memberTeamId` the way `getTeam` above does.
  // `FIXTURE_OTHER_TEAM` is in `teams` and must never be the row this writes: a mock that wrote the
  // only row it held would pass every test a one-team fixture can carry while hiding a missing team
  // predicate - the failure ADR-018's revert condition names, one table over.
  //
  // ONE FIELD IS ASSIGNED (AC-9). `name`, `id` and `createdAt` are untouched, which is the column
  // grant's effect reproduced: there is no path here that could write them.
  //
  // `[0, 100]` IN WHOLE PERCENTAGE POINTS IS STILL THE SCREEN'S (AC-7, AC-8); the datastore's own
  // `team_overload_threshold_range` check holds `[0, 1]` as a fraction, which `isValidThreshold`
  // restates for this pre-send guard — MIR-09, ADR-069, 01-plan.md section 6. This paragraph read
  // "NO RANGE CHECK ... there is no `check` constraint behind the real one" until that ticket.
  //
  // A COPY GOES BACK, never the stored object, so a caller cannot mutate the mock's table through
  // the value it was handed - the shape `getTeam` above already uses.
  async setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>> {
    // MIR-09, ADR-069. The value check precedes the permission check (AC-4): a non-admin sending an
    // out-of-range value is told the value is wrong, not that they lack permission to send it.
    if (!isValidThreshold(input.overloadThreshold)) {
      return refused("invalid_threshold", INVALID_THRESHOLD_MESSAGE);
    }

    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Only an admin can change the threshold.");

    const row = teams.find((t) => t.id === memberTeamId(me.id));
    if (!row) return refused("not_permitted", "Could not save the threshold.");

    row.overloadThreshold = input.overloadThreshold;
    return { ok: true, value: { ...row } };
  },

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-11 — many teams. The seven `security definer` functions in
  // `20260911180000_solo_many_teams.sql`, reproduced. Each one's FIRST test is `is_admin`, as each
  // function body's is; that line is the whole control, and a mock that skipped it would let every
  // component test pass against a function that forgot it.
  // -------------------------------------------------------------------------

  // `public.list_teams()`: every team for an admin, nothing for anybody else, `created_at` then `id`.
  async listTeams(): Promise<Team[]> {
    if (!currentAdmin()) return [];
    return teams
      .slice()
      .sort((a, b) =>
        a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
      )
      .map((t) => ({ ...t }));
  },

  // `public.list_all_members()`: every member on ANY team, removed ones included, for an admin.
  // Pending sign-ups have no team and are `listPendingMembers`'. `listMembers` above is unchanged and
  // stays the caller's own team — it is INV-04's denominator and must never widen.
  async listAllMembers(): Promise<Member[]> {
    if (!currentAdmin()) return [];
    return members
      .filter((m) => m.teamId !== null)
      .slice()
      .sort(byCreatedAtThenId)
      .map((m) => ({ ...m }));
  },

  // -------------------------------------------------------------------------
  // CAL-11 — the read half of a two-row split (ADR-039, ADR-040). 01-plan.md section 4.4. The
  // three `security definer` functions in 20260922150000_cal11_cross_team_reads.sql, reproduced.
  // Each one's FIRST test is `is_admin`, as each function body's is — the reason above.
  // -------------------------------------------------------------------------

  // `public.list_members_for_team(p_team_id)`: team `teamId`'s roster, removed members included,
  // for an admin. Filtered on `m.teamId === teamId` DIRECTLY — the SQL body compares
  // `m.team_id = p_team_id` on the row itself and not through `member_team_id`, so a removed
  // member's own row still matches, exactly as AC-1 requires.
  async listMembersForTeam(teamId: string): Promise<Member[]> {
    if (!currentAdmin()) return [];

    const rows = members
      .filter((m) => m.teamId === teamId)
      .slice()
      .sort(byCreatedAtThenId)
      .slice(0, ROSTER_LIMIT);

    if (rows.length >= ROSTER_LIMIT) {
      throw new Error(
        `listMembersForTeam returned ${rows.length} rows at the ${ROSTER_LIMIT} limit: the roster ` +
          `may be truncated and must not be consumed`,
      );
    }

    return rows.map((m) => ({ ...m }));
  },

  // `public.list_team_entries_for_team(p_team_id)`: every entry of team `teamId`, for an admin.
  // `sameTeam`, not `===`: the SQL predicate is `member_team_id(e.member_id) = p_team_id`, and
  // `member_team_id` answers null for a removed member — so a removed member's entries are
  // excluded here exactly as they are from `listTeamEntries` (parity; INV-04 note).
  async listTeamEntriesForTeam(teamId: string): Promise<Entry[]> {
    if (!currentAdmin()) return [];

    const rows = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), teamId))
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : b.startDate.localeCompare(a.startDate),
      )
      .slice(0, TEAM_ENTRY_LIMIT);

    if (rows.length >= TEAM_ENTRY_LIMIT) {
      throw new Error(
        `listTeamEntriesForTeam returned ${rows.length} rows at the ${TEAM_ENTRY_LIMIT} limit: the ` +
          `list may be truncated and must not be consumed`,
      );
    }

    return rows.map((e) => ({ ...e }));
  },

  // `public.list_team_entries_overlapping_for_team(p_team_id, p_start, p_end)`: the cross-team
  // twin of `listTeamEntriesOverlapping`, with the same page-and-assemble walk (CAL-09) over the
  // same order, the team filter applied to the whole array BEFORE the first window is taken
  // (INV-07), exactly as `listTeamEntriesOverlapping` above.
  async listTeamEntriesOverlappingForTeam(teamId: string, range: DateRange): Promise<Entry[]> {
    if (!currentAdmin()) return [];

    const matched = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), teamId))
      .filter((e) => e.startDate <= range.end && e.endDate >= range.start)
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : a.startDate.localeCompare(b.startDate),
      );

    const matching = matched.length;
    const assembled: Entry[] = [];
    const seen = new Set<string>();

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      const from = assembled.length;
      const rows = matched.slice(from, from + TEAM_ENTRY_PAGE_SIZE);

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
      if (rows.length === 0) break;
    }

    if (assembled.length !== matching) {
      throw new Error(
        `listTeamEntriesOverlappingForTeam assembled ${assembled.length} rows while ${matching} ` +
          `match: the range may be incomplete and must not be counted`,
      );
    }

    return assembled.map((e) => ({ ...e }));
  },

  // `public.create_team`. The empty name is refused FIRST here, as supabase.ts refuses it before the
  // round trip — the two implementations tell one story from the caller's side. The threshold is the
  // column default.
  async createTeam(input: CreateTeamInput): Promise<Result<Team>> {
    const name = input.name.trim();
    if (name === "") return refused("empty_team_name", EMPTY_TEAM_NAME);
    if (!currentAdmin()) return refused("not_permitted", TEAM_CREATE_REFUSED);

    // Every column takes its default, as the function's `insert ... (name)` does: 0.5, and both
    // approval switches ON — `20260911170000_solo_approval_settings.sql` declares them
    // `boolean not null default true`, so a new team starts requiring approval like every team did.
    const row: Team = {
      id: newTeamId(),
      name,
      overloadThreshold: 0.5,
      wfhNeedApprove: true,
      ptoNeedApprove: true,
      createdAt: new Date().toISOString(),
    };
    teams.push(row);
    return { ok: true, value: { ...row } };
  },

  // `public.rename_team`: ANY team, by id. It used to reproduce `team_update_admin` and resolve the
  // row from the caller; the operator decided every admin manages every team.
  async renameTeam(teamId: string, input: RenameTeamInput): Promise<Result<Team>> {
    const name = input.name.trim();
    if (name === "") return refused("empty_team_name", EMPTY_TEAM_NAME);
    if (!currentAdmin()) return refused("not_permitted", TEAM_RENAME_REFUSED);

    const row = teams.find((t) => t.id === teamId);
    if (!row) return refused("not_permitted", TEAM_RENAME_REFUSED);

    row.name = name;
    return { ok: true, value: { ...row } };
  },

  // `public.delete_team`: only an EMPTY team, and "empty" is the foreign key's test — ANY member row
  // naming it, removed ones included. `members.some` with no `removedAt` filter is that test; adding
  // one would let this mock delete a team the datastore refuses.
  async deleteTeam(teamId: string): Promise<Result<void>> {
    if (!currentAdmin()) return refused("not_permitted", TEAM_DELETE_REFUSED);

    const at = teams.findIndex((t) => t.id === teamId);
    if (at === -1) return refused("not_permitted", TEAM_DELETE_REFUSED);
    if (members.some((m) => m.teamId === teamId)) return refused("team_not_empty", TEAM_NOT_EMPTY);

    teams.splice(at, 1);
    return { ok: true, value: undefined };
  },

  // `public.move_member`: an approved, not-removed member, onto a team that exists. `teamId` is the
  // ONLY field written — role, removal and status are untouched, so an admin moving somebody gains
  // no power to promote or remove them on a team the admin is not on.
  //
  // MIR-02, ADR-064 decision 3: NOT THE CALLER THEMSELVES. The trigger clause in
  // `20261020120000_mir02_member_self_writes.sql` refuses anybody changing their own `team_id`, and
  // it fires inside `move_member` too. Checked before the move, so the mock is never looser than it.
  async moveMember(memberId: string, teamId: string): Promise<Result<void>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", MEMBER_MOVE_REFUSED);
    if (memberId === me.id) return refused("not_permitted", MEMBER_MOVE_REFUSED);
    if (!teams.some((t) => t.id === teamId)) return refused("not_permitted", MEMBER_MOVE_REFUSED);

    const target = members.find(
      (m) =>
        m.id === memberId && m.teamId !== null && m.status === "approved" && m.removedAt === null,
    );
    if (!target) return refused("not_permitted", MEMBER_MOVE_REFUSED);

    target.teamId = teamId;
    return { ok: true, value: undefined };
  },

  // SOLO, 2026-09-11. `team_update_admin` with `grant update (wfh_need_approve, pto_need_approve)`,
  // reproduced — the same two refusals in the same order as `setOverloadThreshold` and `renameTeam`
  // above, because it is the same policy.
  //
  // **NO ENTRY IS TOUCHED.** The operator chose that switching a type to "no approval" applies to
  // entries written from then on; a pending row stays pending. A mock that swept them here would
  // pass a test the datastore fails.
  async setApprovalSettings(input: SetApprovalSettingsInput): Promise<Result<Team>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", APPROVAL_SETTINGS_REFUSED);

    const row = teams.find((t) => t.id === memberTeamId(me.id));
    if (!row) return refused("not_permitted", APPROVAL_SETTINGS_REFUSED);

    row.wfhNeedApprove = input.wfhNeedApprove;
    row.ptoNeedApprove = input.ptoNeedApprove;
    return { ok: true, value: { ...row } };
  },

  // CAL-04 AC-1 to AC-6, AC-11, AC-12.
  //
  // OVERLAP, NOT CONTAINMENT, and the comparison is the same predicate PostgreSQL evaluates for
  // `date_range=ov.[start,end]`: an entry running 2026-03-28 to 2026-04-02 comes back for April
  // because AC-2 draws its avatar on 1 and 2 April. Written as two string comparisons rather than
  // through a Date, exactly as `datesIntersect` above is - `yyyy-MM-dd` sorts lexicographically and
  // no Date is constructed anywhere in this file.
  //
  // REJECTED ROWS COME BACK. Filtering `status` here would put a second copy of INV-04's rule
  // outside `absenceCountsFor`, which is what INV-04 exists to prevent (AC-4).
  //
  // `sameTeam` and not `===`, for the reason `listTeamEntries` records: `member_team_id` is null for
  // a removed member and `null = null` is NULL in SQL rather than true, so a removed member's
  // entries are invisible here exactly as they are there.
  //
  // CAL-09 REPLACED THE CEILING WITH THE SAME ASSEMBLY supabase.ts runs, over the same order, so the
  // two implementations tell one story and the unit test can exercise the walk. The team filter, the
  // overlap predicate and the sort are unchanged; `.slice(0, MONTH_ENTRY_LIMIT)` and its raise are
  // gone, and `matching` is the filtered array's length.
  //
  // THE TEAM FILTER IS APPLIED TO THE WHOLE ARRAY BEFORE THE FIRST WINDOW IS TAKEN (INV-07, AC-9),
  // which is the mock's copy of `entry_select_team` filtering every request in the real one. A window
  // taken before the filter would page over another team's rows and then drop them, which reads as a
  // short page rather than as a scope error.
  async listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]> {
    const mine = memberTeamId(currentMemberId);

    const matched = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
      .filter((e) => e.startDate <= range.end && e.endDate >= range.start)
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : a.startDate.localeCompare(b.startDate),
      );

    const matching = matched.length;
    const assembled: Entry[] = [];
    const seen = new Set<string>();

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      const from = assembled.length;
      const rows = matched.slice(from, from + TEAM_ENTRY_PAGE_SIZE);

      // The same two refusals as supabase.ts, and NEITHER CAN FIRE HERE: the count and the windows
      // come from one array, so a row cannot be skipped or repeated between them. They are written
      // because the two implementations must tell one story, not because the mock can truncate —
      // the same reason `listMembers` and `listTeamEntries` carry their raises.
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
      if (rows.length === 0) break;
    }

    // AC-1, AC-5, AC-8. The bound IS reachable here, unlike the two refusals above: a fixture of more
    // than TEAM_ENTRY_PAGE_SIZE * TEAM_ENTRY_MAX_PAGES matching entries exhausts the loop and this
    // comparison throws rather than returning a short array.
    if (assembled.length !== matching) {
      throw new Error(
        `listTeamEntriesOverlapping assembled ${assembled.length} rows while ${matching} match: ` +
          `the range may be incomplete and must not be counted (CAL-09 AC-5)`,
      );
    }

    return assembled.map((e) => ({ ...e }));
  },

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-11. The busy day.
  // -------------------------------------------------------------------------

  // `busy_day_select_team`, reproduced. The team filter is applied to the WHOLE array before the
  // first window is taken, which is the mock's copy of a policy filtering every request in the real
  // one — a window taken before the filter would page over another team's rows and then drop them,
  // which reads as a short page rather than as a scope error. `listTeamEntriesOverlapping` above
  // records the same reasoning at length.
  //
  // `sameTeam` and not `===`: `member_team_id` is null for a removed member and `null = null` is
  // NULL in SQL rather than true, so a removed member's marks are invisible here exactly as their
  // entries are.
  //
  // IT FILTERS NO MEMBER AND COUNTS NOTHING. `busyCountsFor` applies the removed-member rule, and it
  // is the only thing that may — the same division of labour `absenceCountsFor` has with this file.
  async listTeamBusyDaysOverlapping(range: DateRange): Promise<BusyDay[]> {
    const mine = memberTeamId(currentMemberId);

    const matched = busyDays
      .filter((b) => sameTeam(memberTeamId(b.memberId), mine))
      .filter((b) => b.date >= range.start && b.date <= range.end)
      .slice()
      .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

    const matching = matched.length;
    const assembled: BusyDay[] = [];
    const seen = new Set<string>();

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      const from = assembled.length;
      const rows = matched.slice(from, from + TEAM_ENTRY_PAGE_SIZE);

      // The same two refusals supabase.ts carries, and NEITHER CAN FIRE HERE: the count and the
      // windows come from one array, so a row cannot be skipped or repeated between them. They are
      // written because the two implementations must tell one story, not because the mock can
      // truncate — the reason `listTeamEntriesOverlapping` gives for its own copies.
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
      if (rows.length === 0) break;
    }

    if (assembled.length !== matching) {
      throw new Error(
        `listTeamBusyDaysOverlapping assembled ${assembled.length} rows while ${matching} match: ` +
          `the range may be incomplete and must not be counted`,
      );
    }

    return assembled.map((b) => ({ ...b }));
  },

  // `busy_day_insert_own` and `busy_day_delete_own`, reproduced.
  //
  // ONE REFUSAL AND IT IS THE POLICY'S: a caller with no session, no member row, or a removed one
  // has nothing `auth.uid()` resolves to. `status` is not tested here for the same reason no other
  // mock write tests it — `member_team_id` is what gates approval in the real datastore, and the
  // mock's `memberTeamId` is that function.
  //
  // IDEMPOTENT IN BOTH DIRECTIONS, which is the contract `setOwnBusyDay` states and the reason the
  // real one can be a bare `upsert` and a bare `delete`: marking a marked day writes nothing and
  // succeeds, and unmarking an unmarked one deletes nothing and succeeds. A toggle whose next read
  // is the truth must not report "there was nothing there" as a failure.
  async setOwnBusyDay(input: SetOwnBusyDayInput): Promise<Result<void>> {
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me || memberTeamId(me.id) === null) {
      return {
        ok: false,
        error: { code: "busy_not_permitted", message: BUSY_DAY_REFUSED },
      };
    }

    const at = busyDays.findIndex((b) => b.memberId === me.id && b.date === input.date);

    if (input.busy) {
      // `unique (member_id, date)` reproduced. The constraint is the real mechanism; this exists so
      // a double press is observable end-to-end without a provisioned project.
      if (at === -1) {
        busyDays.push({
          id: newBusyDayId(),
          memberId: me.id,
          date: input.date,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (at !== -1) {
      busyDays.splice(at, 1);
    }

    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // ADM-02. 01-plan.md sections 4.2, 4.3 and 5.
  // -------------------------------------------------------------------------

  // ADM-02 AC-1, AC-2, AC-4, AC-7, AC-12, AC-14.
  //
  // MIR-15-e, ADR-079 decision 3. NO CALLER-ROLE CHECK, and that absence is still the policy
  // reproduced: `holiday_select_own_org` has no role predicate, so a member and an admin of the same
  // org read exactly the same rows. What changed from ADM-02 is the SCOPE — this used to read every
  // row for any caller (`holiday_select_all`, `using (true)`); now it reads only `mockOrgOf`'s org,
  // and a caller `mockOrgOf` cannot place in either org (no member row, pending, removed) reads none
  // — `[]`, not a throw, the same normal-answer shape `getTeam()` and `listMembers()` already use for
  // "no row to read from".
  //
  // WHAT IS NOT REPRODUCED: the grant is `to authenticated`, so `anon` reads nothing (AC-6). The
  // mock has no anon role to be, and the application never reaches this screen without a session —
  // App.tsx sends a signed-out caller to `/`. The real control is the grant and it is exercised by
  // no test until a project is provisioned.
  //
  // THE SAME TWO STRING COMPARISONS supabase.ts issues as `gte`/`lte`, inclusive at both ends. No
  // Date is constructed anywhere in this file, and on this table that is load-bearing rather than
  // stylistic — ADR-015 Consequences: a weekday read west of UTC turns a Thursday holiday into a
  // Wednesday one and moves the bridge day.
  //
  // SORTED HERE, above the datastore, exactly as supabase.ts sorts in the query (AC-4).
  // tests/seam-parity.test.ts compares names and arity and not row order, so an unsorted mock is a
  // divergence it cannot see — which is why FIXTURE_HOLIDAYS is deliberately not in date order.
  async listHolidays(range: DateRange): Promise<Holiday[]> {
    const org = mockOrgOf(currentMemberId);
    if (org === null) return [];

    const rows = holidays
      .filter((h) => h.org === org && h.row.date >= range.start && h.row.date <= range.end)
      .map((h) => h.row)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, HOLIDAY_LIMIT);

    // AC-12. The same limit and the same raise as supabase.ts, and the same reason as every other
    // read here: this array is bounded by the fixtures so it never fires, and it exists so the two
    // implementations tell one story rather than because the mock can truncate.
    if (rows.length >= HOLIDAY_LIMIT) {
      throw new Error(
        `listHolidays returned ${rows.length} rows at the ${HOLIDAY_LIMIT} limit: the calendar may ` +
          `be truncated and must not be consumed (ADM-02 AC-12)`,
      );
    }

    return rows.map((h) => ({ ...h }));
  },

  // -------------------------------------------------------------------------
  // ADM-03. 01-plan.md sections 4.2, 4.3 and 5.
  //
  // THESE REPRODUCE THE POLICIES AND NOT THE SCREEN, for the reason `currentAdmin` above records and
  // ADM-01's `setOverloadThreshold` repeats: the acceptance suite drives this seam (BUG-001,
  // tests/e2e/seam.setup.ts), so a mock that let a member through would make AC-14, AC-15 and AC-16
  // pass against nothing at all.
  //
  // `currentAdmin()` IS ALL THREE POLICIES' is_admin PREDICATE. It already filters
  // `removedAt === null` and `role === "admin"`, which is `public.is_admin` reproduced — AC-16 is
  // inherited here exactly as it is inherited in SQL from that function's own body, written once
  // rather than three times.
  //
  // MIR-15-e, ADR-079 decision 2 adds the org conjunct EACH POLICY NOW CARRIES:
  // `and not public.org_is_shared(org_id)`. So `currentAdmin()` alone is no longer enough — an admin
  // of Org public passes it and must still be refused (AC-7). `mockOrgOf(me.id) === "dedicated"` is
  // that conjunct reproduced, and it is checked beside `currentAdmin()` on every one of the three
  // writes below rather than folded into a second helper, so a reviewer can read each refusal against
  // its policy's two conjuncts directly.
  //
  // THERE IS STILL NO TEAM CHECK — `holiday` has no `team_id` (ADR-015 section 1) and none of the
  // three policies carries a team conjunct. The scope that changed at MIR-15-e is the ORG, not the
  // team.
  //
  // ALL THREE CHECK `unique (org_id, date)` BEFORE WRITING, WITHIN THE CALLER'S OWN ORG ONLY
  // (AC-9) — `holiday_org_id_date_key` reproduced. That is a widening from ADM-02's single-org
  // `unique (date)`: a dedicated org's row on a date Org public also holds is not a collision,
  // because the two orgs' calendars are now separate tables in one array.
  // -------------------------------------------------------------------------

  // ADM-03 AC-1, AC-2, AC-4, AC-6, AC-15, AC-16. MIR-15-e AC-7, AC-8, AC-9.
  //
  // NO YEAR FILTER OF ANY KIND. A row may be added in any year, including one the screen is not
  // showing — the calendar is one table and `listHolidays` is what narrows a READ to a year. AC-4 is
  // the screen noticing afterwards, not this function refusing.
  //
  // A COPY GOES BACK, never the stored object, so a caller cannot write the mock's table through the
  // value it was handed — the shape every read here already uses.
  async addHoliday(input: AddHolidayInput): Promise<Result<Holiday>> {
    const me = currentAdmin();
    const org = me ? mockOrgOf(me.id) : null;
    if (!me || org !== "dedicated") return refused("not_permitted", HOLIDAY_ADD_REFUSED);

    // AC-6, widened to AC-9: `unique (org_id, date)` met by a person, within the caller's own org
    // only. The refusal names the date rather than reporting a constraint, and it is checked against
    // the WHOLE table for that org and not the displayed year — which is the reason 01-plan.md
    // section 8 rejected doing this in the form.
    if (holidays.some((h) => h.org === org && h.row.date === input.date)) {
      return refused("holiday_date_taken", HOLIDAY_DATE_TAKEN);
    }

    const row: Holiday = {
      id: newHolidayId(),
      date: input.date,
      name: input.name,
      kind: input.kind,
      createdAt: new Date().toISOString(),
    };
    holidays.push({ org, row });
    return { ok: true, value: { ...row } };
  },

  // ADM-03 AC-7, AC-8, AC-10, AC-15, AC-16. MIR-15-e AC-7, AC-8, AC-9.
  //
  // A MISSING ROW IS `not_permitted` AND NOT A DISTINCT ANSWER, which is the filtered UPDATE
  // reproduced: in the datastore a row the policy refuses and a row that does not exist are the same
  // empty body, and a mock that told them apart would be reporting something the real seam cannot
  // know. MIR-15-e widens the search for that row to the caller's OWN ORG ONLY, so an admin of a
  // dedicated org naming an Org public row's id gets this same `not_permitted` rather than a lookup
  // that finds it (AC-8).
  //
  // ONE ROW IS ASSIGNED, field by field (AC-10). There is no path here that touches another row, and
  // `id` and `createdAt` are untouched — the three writable columns and no more.
  async updateHoliday(holidayId: string, input: UpdateHolidayInput): Promise<Result<Holiday>> {
    const me = currentAdmin();
    const org = me ? mockOrgOf(me.id) : null;
    if (!me || org !== "dedicated") return refused("not_permitted", HOLIDAY_UPDATE_REFUSED);

    const entry = holidays.find((h) => h.org === org && h.row.id === holidayId);
    if (!entry) return refused("not_permitted", HOLIDAY_UPDATE_REFUSED);

    // AC-7, widened to AC-9: the same constraint and the same sentence as the add, checked within
    // the caller's own org only, and `h.row.id !== holidayId` is what makes saving a row onto its OWN
    // date an ordinary edit rather than a duplicate — the behaviour `unique (org_id, date)` has in
    // the datastore, where a row does not collide with itself.
    if (holidays.some((h) => h.org === org && h.row.id !== holidayId && h.row.date === input.date)) {
      return refused("holiday_date_taken", HOLIDAY_DATE_TAKEN);
    }

    entry.row.date = input.date;
    entry.row.name = input.name;
    entry.row.kind = input.kind;
    return { ok: true, value: { ...entry.row } };
  },

  // ADM-03 AC-11, AC-13, AC-15, AC-16. MIR-15-e AC-7, AC-8. A HARD delete, matching supabase.ts: the
  // row leaves the array and there is no trash to restore it from (01-plan.md section 8).
  //
  // EXACTLY ONE ROW LEAVES (AC-13), AND ONLY WHEN IT IS IN THE CALLER'S OWN ORG (AC-8) — the same
  // widened lookup `updateHoliday` above uses. `splice` at the found index and nothing else, so a
  // delete cannot reach a neighbour — the failure a filter-and-reassign would make possible if the
  // predicate were ever widened.
  async deleteHoliday(holidayId: string): Promise<Result<void>> {
    const me = currentAdmin();
    const org = me ? mockOrgOf(me.id) : null;
    if (!me || org !== "dedicated") return refused("not_permitted", HOLIDAY_DELETE_REFUSED);

    const at = holidays.findIndex((h) => h.org === org && h.row.id === holidayId);
    if (at < 0) return refused("not_permitted", HOLIDAY_DELETE_REFUSED);

    holidays.splice(at, 1);
    return { ok: true, value: undefined };
  },

  // MIR-15-e, ADR-079 decision 5. `mockOrgOf(currentMemberId) === "org_public"` is the whole of it:
  // `mockOrgOf` already answers null for no session, no member row, pending or removed (the same
  // cases `public.member_org_id` answers null for), and `org_is_shared(null)` is false in SQL, so the
  // mock folds that into one comparison rather than two. An affordance for `/holidays` only; the
  // write checks above are the control.
  async isOwnOrgShared(): Promise<boolean> {
    return mockOrgOf(currentMemberId) === "org_public";
  },

  // -------------------------------------------------------------------------
  // ADM-04. 01-plan.md section 4.2.
  //
  // ONE READ AND NO WRITE. Nothing here sets `status`, `rejection_reason`, `approved_by` or
  // `approved_at` — those are ADM-05's and this ticket carries no approve control and no reject
  // control (AC-9).
  // -------------------------------------------------------------------------

  // ADM-04 AC-1 to AC-8, AC-11, AC-13.
  //
  // THIS FUNCTION FILTERS BY TEAM AND THE REAL ONE DOES NOT, the same asymmetry `listTeamEntries`
  // above records: the real implementation is scoped by `entry_select_team`, the mock has no policy
  // so the scope has to be written, and a mock that returned every entry it holds would pass seam
  // parity, pass every happy path, and leave AC-13 untestable against the seam the acceptance suite
  // actually drives (BUG-001 pinned that suite to this implementation).
  //
  // `sameTeam` and not `===`, for the reason that function records: `member_team_id` is null for a
  // removed member and `null = null` is NULL in SQL rather than true.
  //
  // THE ORDER IS WRITTEN TWICE, ONCE PER IMPLEMENTATION, AND `tests/seam-parity.test.ts` CANNOT SEE
  // A DIVERGENCE — it compares names and arity, not row order. That is the one duplication this
  // codebase otherwise refuses (`absence.ts` sorts above the seam precisely to avoid it), and paging
  // is what forces it: a page boundary needs a stable SERVER-side order, and an order applied after
  // the slice would reorder one page rather than the set. 01-plan.md section 2, Open questions item
  // 5 names it, and tests/pending-entries.test.ts asserts this copy.
  //
  // `start_date` ascending, then `created_at`, then `id`. Soonest-concerning first, because the
  // decision is wanted before the date arrives (01-plan.md section 8, rejected alternative 5); two
  // deterministic tiebreakers because a boundary that shuffles between requests either repeats a row
  // or drops one, and dropping one here is an entry nobody ever decides.
  async listPendingEntries(query: PendingEntryQuery): Promise<PendingEntryPage> {
    const mine = memberTeamId(currentMemberId);

    const matching = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
      .filter((e) => e.status === "pending")
      // `null` means both types (AC-8). 01-plan.md section 2, Open questions item 1: a WFH entry
      // goes through approval exactly as a PTO entry does, and the filter is what makes the volume
      // manageable if the operator's objection turns out to be noise rather than principle.
      .filter((e) => query.type === null || e.type === query.type)
      // AC-6 and AC-7. `yyyy-MM-dd` STRING comparison, which sorts lexicographically and carries no
      // timezone — the vocabulary `Entry.startDate`, `Holiday.date` and ./absence.ts all use. The
      // boundary is the CALLER's date and never a clock read here (AC-16).
      .filter((e) =>
        query.window === "upcoming"
          ? e.endDate >= query.today
          : query.window === "past"
            ? e.endDate < query.today
            : true,
      )
      .slice()
      .sort((a, b) =>
        a.startDate !== b.startDate
          ? a.startDate.localeCompare(b.startDate)
          : a.createdAt !== b.createdAt
            ? a.createdAt.localeCompare(b.createdAt)
            : a.id.localeCompare(b.id),
      );

    // AC-3. THE EXACT SIZE OF THE MATCHING SET, and it is NOT `rows.length` — here more than
    // anywhere, because in this implementation the two happen to agree on the last page and the
    // simplification would pass every test until a queue outgrew one page.
    const total = matching.length;

    const from = query.page * PENDING_PAGE_SIZE;
    const rows = matching.slice(from, from + PENDING_PAGE_SIZE);

    // AC-5. The assertion that replaces the ceiling every other read here uses, in the same words as
    // supabase.ts. It cannot fire in this implementation — the slice and the count come from one
    // array — and it is written anyway so the two tell one story, which is the reason every other
    // truncation raise in this file exists.
    if (rows.length < PENDING_PAGE_SIZE && from + rows.length < total) {
      throw new Error(
        `listPendingEntries returned ${rows.length} of ${PENDING_PAGE_SIZE} rows on page ` +
          `${query.page} while ${total} match: the page was shortened and must not be consumed, ` +
          `because a queue that comes back short reads as an empty queue (ADM-04 AC-5)`,
      );
    }

    return {
      rows: rows.map((e) => ({ ...e })),
      total,
      page: query.page,
      pageSize: PENDING_PAGE_SIZE,
    };
  },

  // MIR-14-b AC-8, AC-9. `public.list_entry_owners(uuid[])`, as far as a one-team mock can model it.
  // Every member here has at most one team, so "a decider on any of the owner's active teams" is
  // "a decider on the owner's team", and `teams` has one element. The SAME bound and the same
  // sentence as supabase.ts, so the two tell one story; the raise fires before anything is read.
  async listEntryOwners(memberIds: string[]): Promise<EntryOwner[]> {
    const ids = [...new Set(memberIds)];
    if (ids.length > PENDING_PAGE_SIZE) {
      throw new Error(
        `listEntryOwners was asked for ${ids.length} owners, more than one page (${PENDING_PAGE_SIZE})`,
      );
    }
    if (ids.length === 0) return [];

    const me = members.find((m) => m.id === currentMemberId);
    if (!me || me.status !== "approved" || me.removedAt !== null || !mayDecide(me.role)) return [];

    return members
      .filter(
        (owner) =>
          ids.includes(owner.id) &&
          owner.status === "approved" &&
          owner.removedAt === null &&
          owner.teamId !== null &&
          owner.teamId === me.teamId,
      )
      .flatMap((owner) => {
        const team = teams.find((t) => t.id === owner.teamId);
        return team
          ? [
              {
                memberId: owner.id,
                displayName: owner.displayName,
                avatar: owner.avatar,
                teams: [{ id: team.id, name: team.name }],
              },
            ]
          : [];
      });
  },

  // -------------------------------------------------------------------------
  // ADM-05. 01-plan.md sections 4.2 and 5.
  //
  // TWO STEPS IN THIS ORDER, IN BOTH FUNCTIONS, AND THE ORDER IS THE DATASTORE'S: the POLICIES
  // filter the row first, and the TRIGGER runs on what survives. So a row the caller may not reach
  // at all answers `entry_not_permitted` (AC-16, AC-17), and a row they CAN reach but may not decide
  // answers `entry_decision_not_permitted` (AC-8, AC-9). Reversed, a member would learn that an
  // entry of another team exists, and an admin's cross-team refusal would name a permission rather
  // than a row.
  // -------------------------------------------------------------------------

  // ADM-05 AC-1, AC-4, AC-6, AC-7, AC-10, AC-16, AC-17.
  //
  // AC-10 needs no branch and that is the point: self-approval is PERMITTED
  // (rbac-and-security.md), so an admin's own entry reaches the row through `ownsEntry` and then
  // passes the guard because they are an admin. A carve-out here would be inventing a permission row.
  async approveEntry(entryId: string): Promise<Result<Entry>> {
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: APPROVE_REFUSED } };
    }

    // The two PERMISSIVE policies composing, exactly as `updateEntry` above composes them:
    // `entry_update_own` admits the caller's own rows and `entry_update_admin` their team's rows
    // when the caller is an admin. "Not yours", "no such entry" and "another team's" stay ONE
    // answer, or this file becomes an oracle for which entry ids exist in a team nobody may read.
    const row =
      entries.find((e) => e.id === entryId && (ownsEntry(me, e) || deciderMayReach(me, e))) ?? null;
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: APPROVE_REFUSED } };
    }

    return applyDecision(me, row, { status: "approved", rejectionReason: row.rejectionReason });
  },

  // ADM-05 AC-2, AC-3, AC-5, AC-9, AC-16, AC-17.
  //
  // AC-3 FIRST, before anything else, exactly as the real seam refuses it before the round trip and
  // as `createEntry` and `updateEntry` refuse an inverted range. `trim()` only DECIDES: the reason is
  // stored as the admin wrote it, because `entry_rejection_reason_iff_rejected` tests emptiness with
  // `btrim` and nothing else.
  //
  // AC-5 IS THIS FUNCTION ON AN ALREADY-REJECTED ROW. `status` and `rejectionReason` are written
  // together because INV-03's biconditional refuses either one alone, and re-wording a rejection
  // creates and destroys no approval — clause (b)'s `else` branch nulls two columns that are already
  // null.
  async rejectEntry(entryId: string, reason: string): Promise<Result<Entry>> {
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: REJECT_REFUSED } };
    }

    const row =
      entries.find((e) => e.id === entryId && (ownsEntry(me, e) || deciderMayReach(me, e))) ?? null;
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: REJECT_REFUSED } };
    }

    return applyDecision(me, row, { status: "rejected", rejectionReason: reason });
  },

  // -------------------------------------------------------------------------
  // ADM-06. 01-plan.md sections 4.2 and 5.
  // -------------------------------------------------------------------------

  // ADM-06 AC-1 to AC-11, AC-18.
  //
  // IT REPRODUCES `public.reject_entries` PLUS THE TWO CONTROLS AROUND IT, which is the third thing
  // this file reproduces and is declared for the reason it already states for INV-01 and for clauses
  // (a) and (b): the mock is not a datastore anybody's data lives in, the real mechanisms are the
  // policy and the trigger, and this exists so AC-5, AC-7, AC-8 and AC-11 are observable end to end
  // with no provisioned project. What it proves is THE SENTENCE and the arithmetic; the refusal is
  // clause (a)'s and is verified the day a project exists (01-plan.md section 3).
  //
  // THE ORDER IS THE DATASTORE'S: reason, then selection, then the policy filter, then the guard,
  // then the write. Reversed anywhere it stops modelling the thing it is modelling.
  //
  // ATOMIC ON FAILURE (AC-7): the guard is evaluated over the WHOLE admitted set before a single row
  // is written, so a refusal leaves every entry exactly as it was. Nothing here writes as it goes.
  async rejectEntries(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>> {
    // AC-3 FIRST, exactly as `rejectEntry` above refuses it and as the real seam refuses it before
    // the round trip. `trim()` only DECIDES: the reason is stored as the admin wrote it.
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    // AC-6. De-duplicated HERE rather than left to `= any(p_ids)`, which collapses them silently:
    // `requested` must be a number the returned count can be compared against.
    const ids = [...new Set(entryIds)];

    // AC-4. A refusal and not a no-op — an empty batch reporting `{ requested: 0, rejected: 0 }`
    // would be ok:true on a write that never happened.
    if (ids.length === 0) {
      return { ok: false, error: { code: "no_entries_selected", message: NOTHING_SELECTED } };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: BULK_REJECT_REFUSED } };
    }

    // The two PERMISSIVE policies composing, exactly as `approveEntry` and `rejectEntry` compose
    // them. A row neither admits is FILTERED — dropped from the set and counted out — and is never an
    // error (AC-11). An id that names no entry at all is filtered by the same expression, which is
    // what `= any(p_ids)` does in PostgreSQL: it matches rows, it does not resolve ids.
    const admitted = ids
      .map((id) => entries.find((e) => e.id === id && (ownsEntry(me, e) || deciderMayReach(me, e))))
      .filter((e): e is Entry => e !== undefined);

    // Clause (a), over the whole admitted set and BEFORE any write. A rejection moves `status` or
    // `rejection_reason` on every row it touches, so a non-admin is refused for the batch as a whole
    // — which is what one statement and one transaction means (AC-7, AC-8). The condition is "a
    // decision column MOVES" and not "an admin is acting", for `applyDecision`'s reason: an admin
    // re-rejecting with the identical wording moves nothing and would pass the guard in PostgreSQL.
    const moves = admitted.some((e) => e.status !== "rejected" || e.rejectionReason !== reason);
    // SOLO 2026-09-12, ADR-035, as in `applyDecision`. **EVERY ROW, NOT ANY ROW** — one statement and
    // one transaction, so a manager whose batch contains their OWN entry is refused for the batch as
    // a whole rather than partially. That is what the trigger does too: it raises on the first row it
    // reaches that fails, and the whole statement rolls back.
    //
    // MIR-14: the own-entry refusal left with ADR-073 decision 3, so a manager's own entry no longer
    // fails the batch. Clause (a1) joins it, per row that moves: one rejection somebody else made
    // refuses the whole batch, as the trigger's single statement does.
    const rowMoves = (e: Entry): boolean => e.status !== "rejected" || e.rejectionReason !== reason;
    if (
      moves &&
      !admitted.every(
        (e) =>
          mayDecideEntriesOf(me, e.memberId) && !(rowMoves(e) && overturnsAnotherRejection(me, e)),
      )
    ) {
      return {
        ok: false,
        error: { code: "entry_decision_not_permitted", message: DECISION_REFUSED },
      };
    }

    // The write, through the SAME function the single path uses, so clause (b)'s nulling of
    // `approved_by` and `approved_at` is written once in this file rather than twice (AC-9).
    for (const row of admitted) {
      applyDecision(me, row, { status: "rejected", rejectionReason: reason });
    }

    // AC-18. `rejected` is the number of rows that were actually changed and `requested` the number
    // of distinct ids asked for. The two are separate numbers even when they are equal.
    return { ok: true, value: { requested: ids.length, rejected: admitted.length } };
  },

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-26 — report an issue.
  //
  // **THESE REPRODUCE THE POLICIES AND THE GRANTS, NOT THE SCREEN**, which is this file's standing
  // contract: the acceptance suite drives this seam (BUG-001, tests/e2e/seam.setup.ts), so a mock
  // that let a member read the report list would make the refusal on `IssueReports.tsx` pass against
  // nothing at all.
  // -------------------------------------------------------------------------

  // `issue_report_insert_own`, which is one clause: the row is the caller's.
  //
  // **NO ROLE PREDICATE AND NO `status`/`removedAt` PREDICATE**, because the policy has none — see
  // its comment in the migration for why the interface makes the question moot rather than why the
  // datastore answers it. `currentMemberId` being null stands for `auth.uid()` being null, which
  // `with check (member_id = auth.uid())` refuses.
  //
  // IT RETURNS `void`, matching the real seam, and the reason is the real seam's: there is no
  // `issue_report_select_own`, so a report the caller just wrote is not a row they can read back.
  async createIssueReport(input: CreateIssueReportInput): Promise<Result<void>> {
    const files = input.images ?? [];

    // The real seam's order, reproduced: every refusal before anything is uploaded. Here nothing
    // leaves the process either way, and the order is kept so the two tell one story.
    const invalid = issueMessageFailure(input.message) ?? issueImageFailure(files);
    if (invalid) return invalid;

    const me = members.find((m) => m.id === currentMemberId) ?? null;
    if (!me) return refused("not_permitted", ISSUE_SEND_REFUSED);

    // `<uid>/<something>` — the SHAPE `issue_image_insert_own` requires, reproduced so a path built
    // wrongly would look wrong here too. The second segment is a counter rather than a uuid, because
    // a fixed sequence is what lets a test name a path it expects.
    const paths: string[] = [];
    for (const file of files) {
      const path = `${me.id}/${++nextObjectId}-${file.name}`;
      issueObjects.set(path, await issueDataUrl(file));
      paths.push(path);
    }

    reports.push({
      id: newReportId(),
      memberId: me.id,
      kind: input.kind,
      // Trimmed HERE and stored trimmed, exactly as the real seam stores it and as
      // `updateOwnProfile` stores the display name. A mock that stored the untrimmed string would
      // disagree with the datastore about what was saved, one space at a time.
      message: input.message.trim(),
      page: input.page,
      // The column default. `status` is withheld from the insert grant, so nothing a caller sends
      // can reach it — which is why this is a literal here and not a field on the input.
      status: "open",
      createdAt: new Date().toISOString(),
      images: paths,
    });

    return { ok: true, value: undefined };
  },

  // MIR-17, ADR-088. `issue_report_select_admin` is gone — MIR-16
  // (`20261107210000_mir16_issue_reports_system_scope.sql`) drops it, so only a system admin at
  // `aal2` reads or triages a report now and no member-seam caller is answered anything else
  // (ADR-082 decision 1). `0` for every caller, not a role branch any more.
  async countOpenIssueReports(): Promise<number> {
    return 0;
  },

  // SOLO, 2026-09-26 (third run). `listPendingMembers` above, counted — the same two filters in the
  // same order, so the badge and the queue cannot say different numbers. `member_select_pending_admin`
  // is what answers a non-admin nothing, reproduced here as `currentAdmin()` exactly as that function
  // does it.
  async countPendingMembers(): Promise<number> {
    if (!currentAdmin()) return 0;
    return members.filter((m) => m.teamId === null && m.status === "pending").length;
  },

  // MIR-17, ADR-088. `issue_image_select_admin` is gone with MIR-16
  // (`20261107210000_mir16_issue_reports_system_scope.sql`): the storage read is a system admin's, not
  // a member-seam caller's (ADR-082 decision 1). SAME ORDER, SAME LENGTH kept regardless, as the real
  // seam's contract still promises it — only now every path signs to `null`, for every caller.
  async issueImageUrls(paths: string[]): Promise<(string | null)[]> {
    return paths.map(() => null);
  },

  // MIR-17, ADR-088. `issue_report_select_admin` is gone with MIR-16 — only a system admin at `aal2`
  // reads a report now (ADR-082 decision 1), so the member seam answers every caller, Quan included,
  // the empty list a filtered SELECT used to give only a non-admin.
  async listIssueReports(): Promise<IssueReport[]> {
    return [];
  },

  // MIR-17, ADR-088. `issue_report_update_admin` is gone with MIR-16 — only a system admin triages a
  // report now (ADR-082 decision 1), so every member-seam caller is refused, uniformly, the way a
  // missing row already was: one answer for "not yours to touch" and "does not exist" alike. Both
  // parameters are kept, unused, so the signature matches `DataSeam` and seam parity sees no change.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for signature parity, see above
  async setIssueReportStatus(_reportId: string, _status: IssueStatus): Promise<Result<IssueReport>> {
    return refused("not_permitted", ISSUE_STATUS_REFUSED);
  },

  // -------------------------------------------------------------------------
  // EVT-01 — events. The seven functions of 01-plan.md § 4.2, each reproducing the policy, grant or
  // constraint named beside it rather than the screen.
  // -------------------------------------------------------------------------

  // `event_select_visible`. `startDate` ascending, then `id` — the real seam's `order`.
  async listEvents(): Promise<CalEvent[]> {
    return events
      .filter((e) => mayReadEvent(e, currentMemberId))
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
      // EVT-11 AC-8. EVENT_LIST_COLUMNS: a list read never carries the description.
      .map((e) => ({ ...e, description: null }));
  },

  // Null for "does not exist" and for "may not read" alike (AC-22) — a filtered select cannot tell
  // them apart, and this must not either.
  async getEvent(eventId: string): Promise<CalEvent | null> {
    const row = events.find((e) => e.id === eventId);
    return row && mayReadEvent(row, currentMemberId) ? { ...row } : null;
  },

  // `event_invitee_select_manage`: only whoever may manage the event reads its list (AC-13). Member
  // id ascending — the real seam's `order`.
  async listEventInvitees(eventId: string): Promise<string[]> {
    const row = events.find((e) => e.id === eventId);
    if (!row || !mayManageEvent(row, currentMemberId)) return [];
    return eventInvitees
      .filter((i) => i.eventId === eventId)
      .map((i) => i.memberId)
      .sort((a, b) => a.localeCompare(b));
  },

  // `public.list_member_directory()` as MIR-04 replaced it (ADR-066): the caller must have a team;
  // the row must be approved and not removed; then one of five clauses admits it — (a) the caller is
  // an admin, (b) own team, (c) creator of an event the caller reads or invitee of one the caller
  // manages, (d) attendance the caller can see, (e) actor of a notification addressed to the caller.
  // FIVE FIELDS AND NO MORE (ADR-045 point 4). Ordered as the real seam orders it.
  async listMemberDirectory(): Promise<DirectoryMember[]> {
    const uid = currentMemberId;
    const ownTeam = memberTeamId(uid);
    if (ownTeam === null) return [];
    const mayManageEventId = (eventId: string): boolean => {
      const e = events.find((x) => x.id === eventId);
      return e !== undefined && mayManageEvent(e, uid);
    };
    // `event_attendance_select_visible` minus the caller's own row, which (b) already covers.
    const attendanceVisibleTo = (a: EventAttendance): boolean => {
      const e = events.find((x) => x.id === a.eventId);
      return (
        e !== undefined && mayReadEvent(e, uid) && (a.status === "attending" || mayManageEvent(e, uid))
      );
    };
    const admitted = (m: Member): boolean =>
      eventIsAdmin(uid) ||
      m.teamId === ownTeam ||
      events.some((e) => e.creatorId === m.id && mayReadEvent(e, uid)) ||
      eventInvitees.some((i) => i.memberId === m.id && mayManageEventId(i.eventId)) ||
      eventAttendance.some((a) => a.memberId === m.id && attendanceVisibleTo(a)) ||
      notifications.some((n) => n.actorId === m.id && n.recipientId === uid);
    const rows: DirectoryMember[] = [];
    for (const m of members) {
      if (m.status !== "approved" || m.removedAt !== null || m.teamId === null) continue;
      if (!admitted(m)) continue;
      // The fixtures carry two rows under one id (FIXTURE_SECOND_ADMIN and FIXTURE_PENDING_SIGNUP);
      // the table cannot, so the first approved row is the one the join would return.
      if (rows.some((r) => r.id === m.id)) continue;
      const team = teams.find((t) => t.id === m.teamId);
      if (!team) continue;
      rows.push({
        id: m.id,
        displayName: m.displayName,
        avatar: m.avatar,
        teamId: m.teamId,
        teamName: team.name,
      });
    }
    return rows.sort(
      (a, b) =>
        a.teamName.localeCompare(b.teamName) ||
        a.displayName.localeCompare(b.displayName) ||
        a.id.localeCompare(b.id),
    );
  },

  // `save_event` with a null id: the seam-side refusals, then `event_insert_own`, then
  // `event_stamp()` setting the team, then the named list. A refused invitee undoes the row, as the
  // transaction would.
  async createEvent(input: SaveEventInput): Promise<Result<CalEvent>> {
    const invalid = eventInputFailure(input);
    if (invalid) return invalid;

    const teamId = memberTeamId(currentMemberId);
    if (currentMemberId === null || teamId === null) {
      return eventFailure("event_not_permitted", EVENT_SAVE_REFUSED);
    }

    const now = new Date().toISOString();
    const row: CalEvent = {
      id: newEventId(),
      creatorId: currentMemberId,
      teamId,
      name: input.name.trim(),
      description: blankToNull(input.description),
      location: blankToNull(input.location),
      startDate: input.startDate,
      endDate: input.endDate,
      scope: input.scope,
      // EVT-02. Absent is the default — `SaveEventInput`'s docblock.
      capacity: input.capacity ?? null,
      requiresApproval: input.requiresApproval ?? false,
      registrationDeadline: input.registrationDeadline ?? null,
      createdAt: now,
      updatedAt: now,
    };
    events.push(row);

    const refusedInvitee = writeEventInvitees(row.id, input);
    if (refusedInvitee) {
      events.splice(events.indexOf(row), 1);
      return refusedInvitee;
    }

    // EVT-04 AC-1. `notify_event_created`: own team is the creator's team, every team is everyone,
    // named people is nobody.
    if (row.scope !== "named") {
      notify(
        approvedMemberIds().filter((id) => row.scope === "public" || memberTeamId(id) === row.teamId),
        "event_created",
        row,
      );
    }

    return { ok: true, value: { ...row } };
  },

  // `save_event` with an id: `event_update_manage` filters, zero rows is 42501. `creatorId` and
  // `teamId` never move — they are not in the update grant (AC-16).
  async updateEvent(eventId: string, input: SaveEventInput): Promise<Result<CalEvent>> {
    const invalid = eventInputFailure(input);
    if (invalid) return invalid;

    const row = events.find((e) => e.id === eventId);
    if (!row || !mayManageEvent(row, currentMemberId)) {
      return eventFailure("event_not_permitted", EVENT_SAVE_REFUSED);
    }

    // EVT-02, AC-4. `event_capacity_guard` (EV003), which runs under the row's lock in the real
    // seam. No `await` between this count and the write below.
    const capacity = input.capacity ?? null;
    if (capacity !== null && capacity < seatsTaken(row.id)) {
      return eventFailure("event_capacity_below_attendees", EVENT_CAPACITY_BELOW_ATTENDEES);
    }

    // Snapshots, so a refused invitee rolls the whole write back as the transaction does.
    const before = { ...row };
    const listBefore = eventInvitees.map((i) => ({ ...i }));

    row.name = input.name.trim();
    row.description = blankToNull(input.description);
    row.location = blankToNull(input.location);
    row.startDate = input.startDate;
    row.endDate = input.endDate;
    row.scope = input.scope;
    row.capacity = capacity;
    row.requiresApproval = input.requiresApproval ?? false;
    row.registrationDeadline = input.registrationDeadline ?? null;
    row.updatedAt = new Date().toISOString();

    // EVT-04. A refused invitee is refused before `writeEventInvitees` inserts — and so before it
    // notifies anyone — so the rollback below has no notification to undo.
    const refusedInvitee = writeEventInvitees(row.id, input);
    if (refusedInvitee) {
      Object.assign(row, before);
      eventInvitees.length = 0;
      eventInvitees.push(...listBefore);
      return refusedInvitee;
    }

    // EVT-04 AC-5. `notify_event_updated`'s `when` clause: the nine fields, and no others.
    const changed = (
      [
        "name",
        "description",
        "location",
        "startDate",
        "endDate",
        "scope",
        "capacity",
        "requiresApproval",
        "registrationDeadline",
      ] as const
    ).some((field) => before[field] !== row[field]);
    if (changed) notify(eventParticipantIds(row.id), "event_updated", row);

    return { ok: true, value: { ...row } };
  },

  // `event_delete_manage`, and the cascade on `event_invitee.event_id`. Zero rows is a refusal.
  async deleteEvent(eventId: string): Promise<Result<void>> {
    const row = events.find((e) => e.id === eventId);
    if (!row || !mayManageEvent(row, currentMemberId)) {
      return eventFailure("event_not_permitted", EVENT_DELETE_REFUSED);
    }
    // EVT-04 AC-6. `notify_event_cancelled`, BEFORE delete: the participants are still there and the
    // event still reads. The cascade below sends no `attendance_withdrawn` (AC-7).
    notify(eventParticipantIds(row.id), "event_cancelled", row);
    events.splice(events.indexOf(row), 1);
    for (let i = eventInvitees.length - 1; i >= 0; i--) {
      if (eventInvitees[i]?.eventId === eventId) eventInvitees.splice(i, 1);
    }
    // EVT-02, AC-25. The cascade on `event_attendance.event_id`.
    for (let i = eventAttendance.length - 1; i >= 0; i--) {
      if (eventAttendance[i]?.eventId === eventId) eventAttendance.splice(i, 1);
    }
    // EVT-06, AC-7. The cascade on `event_guest_link.event_id`.
    eventGuestLinks.delete(eventId);
    // EVT-07, AC-20. `event_guest.event_id … on delete set null`: the rows are KEPT.
    for (const guest of eventGuests) {
      if (guest.eventId === eventId) guest.eventId = null;
    }
    // EVT-08, AC-14. `event_email_invitation.event_id … on delete set null`: the rows are KEPT, and
    // nothing is handed to the sender.
    for (const invitation of emailInvitations) {
      if (invitation.eventId === eventId) invitation.eventId = null;
    }
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // EVT-02 — attendance. The four functions of 01-plan.md § 4.3, each reproducing the policy, grant
  // or trigger named beside it rather than the screen.
  // -------------------------------------------------------------------------

  // `event_attendance_select_visible`: the caller must have a team and read the event; then attending
  // rows to anyone, every row to whoever manages it, the caller's own to the caller (AC-21, AC-22).
  async listEventAttendance(eventId: string): Promise<EventAttendance[]> {
    const uid = currentMemberId;
    const event = events.find((e) => e.id === eventId);
    if (!event || memberTeamId(uid) === null || !mayReadEvent(event, uid)) return [];
    const manages = mayManageEvent(event, uid);
    return eventAttendance
      .filter(
        (a) => a.eventId === eventId && (a.status === "attending" || a.memberId === uid || manages),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.memberId.localeCompare(b.memberId))
      .map((a) => ({ ...a }));
  },

  // `event_attendance_guard` on insert, then `event_attendance_insert_own`, then the primary key —
  // in the order the guard raises them: audience (42501), an existing row (23505), registration
  // (EV002), capacity (EV001). The state is the guard's, from `requiresApproval` (Q22).
  async joinEvent(eventId: string): Promise<Result<EventAttendance>> {
    const uid = currentMemberId;
    const event = events.find((e) => e.id === eventId);
    if (uid === null || !event || !isEventAudience(event, uid)) {
      return eventFailure("attendance_not_permitted", ATTENDANCE_JOIN_REFUSED);
    }
    if (findAttendance(eventId, uid)) return eventFailure("already_on_event", EVENT_ALREADY_ON);
    if (!registrationOpen(event, eventToday())) {
      return eventFailure("event_registration_closed", EVENT_REGISTRATION_CLOSED);
    }
    const status = event.requiresApproval ? "pending" : "attending";
    if (status === "attending" && event.capacity !== null && seatsTaken(eventId) >= event.capacity) {
      return eventFailure("event_full", EVENT_FULL);
    }
    const now = new Date().toISOString();
    const row: EventAttendance = { eventId, memberId: uid, status, createdAt: now, updatedAt: now };
    eventAttendance.push(row);
    // EVT-04 AC-7. `notify_attendance_inserted`, when the guard made it `pending`.
    if (status === "pending") notify([event.creatorId], "attendance_requested", event);
    return { ok: true, value: { ...row } };
  },

  // `event_attendance_delete_own`: own row, a team, pending or attending, registration open. Zero
  // rows is a refusal, told apart as the real seam tells it (§ 4.3).
  async leaveEvent(eventId: string): Promise<Result<void>> {
    const uid = currentMemberId;
    const event = events.find((e) => e.id === eventId);
    const row = findAttendance(eventId, uid);
    if (
      !event ||
      !row ||
      memberTeamId(uid) === null ||
      (row.status !== "pending" && row.status !== "attending")
    ) {
      return eventFailure("attendance_not_permitted", ATTENDANCE_LEAVE_REFUSED);
    }
    if (!registrationOpen(event, eventToday())) {
      return eventFailure("event_registration_closed", EVENT_REGISTRATION_CLOSED);
    }
    eventAttendance.splice(eventAttendance.indexOf(row), 1);
    // EVT-04 AC-7. `notify_attendance_deleted`: the row was the actor's own, pending or attending,
    // and the event still exists.
    notify([event.creatorId], "attendance_withdrawn", event);
    return { ok: true, value: undefined };
  },

  // `event_attendance_update_manage` (the creator or an admin, never a manager as such), then
  // `event_attendance_guard` on update: a legal transition (22023), then the cap on `attending`
  // (EV001). No registration clause — AC-18.
  async decideAttendance(
    eventId: string,
    memberId: string,
    status: "attending" | "rejected" | "removed",
  ): Promise<Result<EventAttendance>> {
    const event = events.find((e) => e.id === eventId);
    const row = findAttendance(eventId, memberId);
    if (!event || !row || !mayManageEvent(event, currentMemberId)) {
      return eventFailure("attendance_not_permitted", ATTENDANCE_DECIDE_REFUSED);
    }
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes(status)) {
      return eventFailure("invalid_attendance_change", ATTENDANCE_CHANGE_INVALID);
    }
    if (
      status === "attending" &&
      event.capacity !== null &&
      seatsTaken(eventId, memberId) >= event.capacity
    ) {
      return eventFailure("event_full", EVENT_FULL);
    }
    row.status = status;
    row.updatedAt = new Date().toISOString();
    // EVT-04 AC-4, AC-8. `notify_attendance_changed`, read check AFTER the change.
    notify(
      [memberId],
      status === "attending"
        ? "attendance_approved"
        : status === "rejected"
          ? "attendance_rejected"
          : "attendance_removed",
      event,
    );
    return { ok: true, value: { ...row } };
  },

  // -------------------------------------------------------------------------
  // EVT-03 — events on the week and month grids. 01-plan.md § 4.3. ADR-049.
  // -------------------------------------------------------------------------

  // `event_attendance_select_visible`'s own-row clause, with `member_id = caller` explicit — the
  // policy hands an admin every row, and AC-11 marks only the admin's own. `eventId` ascending.
  async listOwnEventAttendance(): Promise<EventAttendance[]> {
    const uid = currentMemberId;
    if (memberTeamId(uid) === null) return [];
    return eventAttendance
      .filter((a) => {
        if (a.memberId !== uid) return false;
        const event = events.find((e) => e.id === a.eventId);
        return event !== undefined && mayReadEvent(event, uid);
      })
      .sort((a, b) => a.eventId.localeCompare(b.eventId))
      .map((a) => ({ ...a }));
  },

  // The same rows `listEvents` returns, narrowed to team `teamId`. Invitees are read only for events
  // the caller may manage — `event_invitee_select_manage`, as the real embed is filtered — and the
  // roster comes from `listMembersForTeam`, empty for a non-admin (AC-12). Through `seam.`, never
  // `this.`, so a destructured seam still works.
  // EVT-11 AC-8. `description: null` arrives with `seam.listEvents`.
  async listEventsForTeam(teamId: string): Promise<CalEvent[]> {
    const [visible, roster] = await Promise.all([
      seam.listEvents(),
      seam.listMembersForTeam(teamId),
    ]);
    const inviteesByEvent = new Map<string, string[]>();
    for (const event of visible) {
      if (!mayManageEvent(event, currentMemberId)) continue;
      inviteesByEvent.set(
        event.id,
        eventInvitees.filter((i) => i.eventId === event.id).map((i) => i.memberId),
      );
    }
    const teamMemberIds = new Set(
      roster.filter((m) => m.removedAt === null && m.status === "approved").map((m) => m.id),
    );
    return eventsRelevantToTeam(visible, teamId, inviteesByEvent, teamMemberIds);
  },

  // -------------------------------------------------------------------------
  // EVT-04 — notifications. The four functions of 01-plan.md § 4.2. No seam function writes a row.
  // -------------------------------------------------------------------------

  // `notification_select_own`. `createdAt` desc, then `id` desc, the newest NOTIFICATION_LIMIT.
  async listNotifications(): Promise<EventNotification[]> {
    return notifications
      .filter((n) => ownsNotification(n, currentMemberId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, NOTIFICATION_LIMIT)
      .map((n) => ({ ...n }));
  },

  async countUnreadNotifications(): Promise<number> {
    return notifications.filter((n) => ownsNotification(n, currentMemberId) && n.readAt === null)
      .length;
  },

  // `mark_notifications_read([id])` under `notification_update_own`: someone else's row matches
  // nothing, and that is ok — the same answer as an already-read one.
  async markNotificationRead(notificationId: string): Promise<Result<void>> {
    const row = notifications.find((n) => n.id === notificationId);
    if (row && ownsNotification(row, currentMemberId) && row.readAt === null) {
      row.readAt = new Date().toISOString();
    }
    return { ok: true, value: undefined };
  },

  // `mark_notifications_read(null)`: every unread row of the caller's, beyond the window.
  async markAllNotificationsRead(): Promise<Result<number>> {
    const now = new Date().toISOString();
    let marked = 0;
    for (const n of notifications) {
      if (ownsNotification(n, currentMemberId) && n.readAt === null) {
        n.readAt = now;
        marked++;
      }
    }
    return { ok: true, value: marked };
  },

  // -------------------------------------------------------------------------
  // EVT-05 — the event email switch. 01-plan.md § 4.2. Nothing here sends or names an email.
  // -------------------------------------------------------------------------

  // `member_select_own`. No caller, or no member row: null.
  async getEventEmailEnabled(): Promise<boolean | null> {
    const me = members.find((m) => m.id === currentMemberId) ?? null;
    if (!me) return null;
    return eventEmailOn(me.id);
  },

  // `set_event_email`: the caller's own row, and only while it is not removed. No member id.
  async setEventEmailEnabled(enabled: boolean): Promise<Result<boolean>> {
    const me = members.find((m) => m.id === currentMemberId) ?? null;
    if (!me || me.removedAt !== null) {
      return { ok: false, error: { code: "unknown", message: EVENT_EMAIL_SAVE_FAILED } };
    }
    eventEmailSwitches.set(me.id, enabled);
    return { ok: true, value: enabled };
  },

  // -------------------------------------------------------------------------
  // EVT-06 — the guest link. The four functions of 01-plan.md § 4.2, each reproducing the policy,
  // grant or definer read named beside it rather than the screen.
  // -------------------------------------------------------------------------

  // `event_guest_link_select_manage`. Not open and may-not-manage are the same null (AC-3).
  async getEventGuestLink(eventId: string): Promise<EventGuestLink | null> {
    const event = events.find((e) => e.id === eventId);
    const row = eventGuestLinks.get(eventId);
    if (!event || !row || !mayManageEvent(event, currentMemberId)) return null;
    return toGuestLink(eventId, row);
  },

  // `event_guest_link_insert_manage`, then the primary key: a second open is the 23505 the real seam
  // reads back, so the link already in place is the answer (AC-6). A refused open writes nothing.
  async openEventToGuests(eventId: string): Promise<Result<EventGuestLink>> {
    const event = events.find((e) => e.id === eventId);
    if (!event || !mayManageEvent(event, currentMemberId)) {
      return eventFailure("event_not_permitted", EVENT_GUEST_OPEN_REFUSED);
    }
    return { ok: true, value: toGuestLink(eventId, openGuestLink(eventId)) };
  },

  // `event_guest_link_delete_manage`. Zero rows — not open, or not permitted — is a refusal.
  async closeEventToGuests(eventId: string): Promise<Result<void>> {
    const event = events.find((e) => e.id === eventId);
    if (!event || !mayManageEvent(event, currentMemberId) || !eventGuestLinks.has(eventId)) {
      return eventFailure("event_not_permitted", EVENT_GUEST_CLOSE_REFUSED);
    }
    eventGuestLinks.delete(eventId);
    return { ok: true, value: undefined };
  },

  // `get_guest_event` and `list_guest_event_attendees`. NO SESSION IS READ: the token is the whole
  // address. A name is the member's while they are approved and not removed, otherwise null (AC-10).
  async getGuestEvent(token: string): Promise<GuestEvent | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) return null;
    const eventId = guestEventId(token);
    const event = eventId === null ? undefined : events.find((e) => e.id === eventId);
    if (!event) return null;
    // EVT-07 AC-14 (F3-A). Attending guests' names join the members', unmarked, by `created_at`
    // then the row's id — `list_guest_event_attendees`' `union all`.
    const attendeeNames = [
      ...eventAttendance
        .filter((a) => a.eventId === event.id && a.status === "attending")
        .map((a) => ({
          createdAt: a.createdAt,
          rowId: a.memberId,
          name:
            members.find(
              (m) => m.id === a.memberId && m.status === "approved" && m.removedAt === null,
            )?.displayName ?? null,
        })),
      ...eventGuests
        .filter((g) => g.eventId === event.id && g.status === "attending")
        .map((g) => ({ createdAt: g.createdAt, rowId: g.id, name: g.name as string | null })),
    ]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.rowId.localeCompare(b.rowId))
      .map((row) => row.name);
    return {
      name: event.name,
      description: event.description,
      location: event.location,
      startDate: event.startDate,
      endDate: event.endDate,
      capacity: event.capacity,
      seatsTaken: seatsTaken(event.id),
      attendeeNames,
    };
  },

  // -------------------------------------------------------------------------
  // EVT-07 — guest registration. The six functions of 01-plan.md § 4.2, each reproducing the guard,
  // policy or definer function named beside it rather than the screen.
  // -------------------------------------------------------------------------

  // `get_guest_event_terms`. NO SESSION IS READ.
  async getGuestRegistrationTerms(token: string): Promise<GuestRegistrationTerms | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) return null;
    const eventId = guestEventId(token);
    const event = eventId === null ? undefined : events.find((e) => e.id === eventId);
    if (!event) return null;
    return {
      requiresApproval: event.requiresApproval,
      registrationOpen: registrationOpen(event, eventToday()),
    };
  },

  // `register_guest`, then `event_guest_guard` on insert, in the order they raise: the link's shape
  // (EV004, the seam's pre-check), the name (EV006), the email (EV007), the link (EV004), the
  // duplicate (23505), registration (EV002), the cap (EV001). The state is the guard's. NO SESSION
  // IS READ.
  async registerGuest(
    token: string,
    name: string,
    email: string,
  ): Promise<Result<GuestRegistrationReceipt>> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) {
      return eventFailure("guest_link_not_found", GUEST_LINK_NOT_FOUND);
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const invalid = guestInputFailure(trimmedName, trimmedEmail);
    if (invalid) return invalid;

    const manageToken = newGuestToken();
    const manageTokenHash = await sha256Hex(manageToken);

    // From here to the push: no `await`.
    const eventId = guestEventId(token);
    const event = eventId === null ? undefined : events.find((e) => e.id === eventId);
    if (!event) return eventFailure("guest_link_not_found", GUEST_LINK_NOT_FOUND);
    const lower = trimmedEmail.toLowerCase();
    if (eventGuests.some((g) => g.eventId === event.id && g.email.toLowerCase() === lower)) {
      return eventFailure("guest_already_registered", GUEST_ALREADY_REGISTERED);
    }
    if (!registrationOpen(event, eventToday())) {
      return eventFailure("event_registration_closed", EVENT_REGISTRATION_CLOSED);
    }
    const status = event.requiresApproval ? "pending" : "attending";
    if (status === "attending" && event.capacity !== null && seatsTaken(event.id) >= event.capacity) {
      return eventFailure("event_full", EVENT_FULL);
    }
    const now = new Date().toISOString();
    eventGuests.push({
      id: newGuestId(),
      eventId: event.id,
      eventName: event.name,
      name: trimmedName,
      email: trimmedEmail,
      manageTokenHash,
      status,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, value: { manageToken, status } };
  },

  // `get_guest_registration`, by the hash. The live event when it exists; otherwise the stored name,
  // closed, deleted (AC-20). NO SESSION IS READ.
  async getGuestRegistration(manageToken: string): Promise<GuestRegistrationView | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(manageToken)) return null;
    const hash = await sha256Hex(manageToken);
    const row = eventGuests.find((g) => g.manageTokenHash === hash);
    if (!row) return null;
    const event = row.eventId === null ? undefined : events.find((e) => e.id === row.eventId);
    return {
      eventName: event?.name ?? row.eventName,
      startDate: event?.startDate ?? null,
      endDate: event?.endDate ?? null,
      location: event?.location ?? null,
      guestName: row.name,
      status: row.status,
      registrationOpen: event ? registrationOpen(event, eventToday()) : false,
      eventDeleted: !event,
    };
  },

  // `cancel_guest_registration`, then `event_guest_guard` on update: no row (EV005), a deleted event
  // (EV002), an illegal transition (22023), registration closed (EV002). NO SESSION IS READ.
  async cancelGuestRegistration(manageToken: string): Promise<Result<void>> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(manageToken)) {
      return eventFailure("guest_registration_not_found", GUEST_REGISTRATION_NOT_FOUND);
    }
    const hash = await sha256Hex(manageToken);
    const row = eventGuests.find((g) => g.manageTokenHash === hash);
    if (!row) return eventFailure("guest_registration_not_found", GUEST_REGISTRATION_NOT_FOUND);
    const event = row.eventId === null ? undefined : events.find((e) => e.id === row.eventId);
    if (!event) return eventFailure("event_registration_closed", EVENT_REGISTRATION_CLOSED);
    if (!(GUEST_TRANSITIONS[row.status] ?? []).includes("cancelled")) {
      return eventFailure("invalid_attendance_change", ATTENDANCE_CHANGE_INVALID);
    }
    if (!registrationOpen(event, eventToday())) {
      return eventFailure("event_registration_closed", EVENT_REGISTRATION_CLOSED);
    }
    row.status = "cancelled";
    row.updatedAt = new Date().toISOString();
    return { ok: true, value: undefined };
  },

  // `event_guest_select_visible` and the column grant, then `list_event_guest_emails`: the caller
  // must have a team and read the event; attending guests to anyone, every guest to whoever manages
  // it; the email to whoever manages it and to nobody else (AC-14, AC-15).
  async listEventGuests(eventId: string): Promise<EventGuest[]> {
    const uid = currentMemberId;
    const event = events.find((e) => e.id === eventId);
    if (!event || memberTeamId(uid) === null || !mayReadEvent(event, uid)) return [];
    const manages = mayManageEvent(event, uid);
    return eventGuests
      .filter((g) => g.eventId === eventId && (g.status === "attending" || manages))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((g) => toEventGuest(g, eventId, manages));
  },

  // `event_guest_update_manage`'s `using` (the creator or an admin, never a manager as such), then
  // `event_guest_guard` on update — a legal transition (22023), registration for a cancel (EV002),
  // the cap on `attending` (EV001) — then the policy's `with check`, which refuses `cancelled` to
  // everyone (AC-18). The row read back carries no email: `email` is not in the select grant.
  async decideGuest(
    guestId: string,
    status: "attending" | "rejected" | "removed",
  ): Promise<Result<EventGuest>> {
    const row = eventGuests.find((g) => g.id === guestId);
    const event = row?.eventId ? events.find((e) => e.id === row.eventId) : undefined;
    if (!row || !event || !mayManageEvent(event, currentMemberId)) {
      return eventFailure("attendance_not_permitted", GUEST_DECIDE_REFUSED);
    }
    // Widened on purpose: a caller outside TypeScript can send `cancelled`, and the database answers.
    const next = status as GuestStatus;
    if (!(GUEST_TRANSITIONS[row.status] ?? []).includes(next)) {
      return eventFailure("invalid_attendance_change", ATTENDANCE_CHANGE_INVALID);
    }
    if (next === "cancelled") {
      if (!registrationOpen(event, eventToday())) {
        return eventFailure("event_registration_closed", EVENT_REGISTRATION_CLOSED);
      }
      return eventFailure("attendance_not_permitted", GUEST_DECIDE_REFUSED);
    }
    if (
      next === "attending" &&
      event.capacity !== null &&
      seatsTaken(event.id, row.id) >= event.capacity
    ) {
      return eventFailure("event_full", EVENT_FULL);
    }
    row.status = next;
    row.updatedAt = new Date().toISOString();
    return { ok: true, value: toEventGuest(row, event.id, false) };
  },

  // -------------------------------------------------------------------------
  // EVT-13 — a signed-in reader leaves the guest page. 01-plan.md § 4.2. ADR-061 decision 8.
  // -------------------------------------------------------------------------

  // `guest_link_event_id`: the open link's event, through `may_read_event` for the caller. Null for
  // "no such open link" and "not a reader" alike. Lookup and check with no `await` between them.
  async getGuestLinkEventId(token: string): Promise<string | null> {
    if (!GUEST_LINK_TOKEN_PATTERN.test(token)) return null;
    const eventId = guestEventId(token);
    const event = eventId === null ? undefined : events.find((e) => e.id === eventId);
    if (!event) return null;
    return mayReadEvent(event, currentMemberId) ? event.id : null;
  },

  // -------------------------------------------------------------------------
  // EVT-08 — email invitations. The two functions of 01-plan.md § 4.2, each reproducing the definer
  // function, trigger or policy named beside it rather than the screen.
  // -------------------------------------------------------------------------

  // The seam's affordance, then `invite_to_event` in its order — may manage (one answer for missing
  // and not permitted, AC-3), then by scope (EVT-12 § 4.1): public opens the link and inserts each
  // distinct address (EVT-08 AC-5, AC-6); Own team or Limited people resolves each address to a
  // member, opens the link only for an outsider, and adds a member who cannot read (EVT-12 AC-4..AC-9).
  // `email_invitation()` runs for each row AS IT IS INSERTED — before the add, as the trigger fires
  // per statement. NO `await`: check and write are one block, as the function is one statement.
  async inviteToEvent(eventId: string, emails: string[]): Promise<Result<EmailInvitationOutcome[]>> {
    const addresses = invitationAddresses(emails);
    if (addresses === null) return eventFailure("invalid_invitation_email", INVITATION_EMAIL_INVALID);
    const event = events.find((e) => e.id === eventId);
    const uid = currentMemberId;
    if (!event || uid === null || !mayManageEvent(event, uid)) {
      return eventFailure("event_not_permitted", INVITATION_REFUSED);
    }

    // Distinct by `lower()`, the first spelling kept, in first-entered order.
    const seen = new Set<string>();
    const distinct: string[] = [];
    for (const email of addresses) {
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      distinct.push(email);
    }

    // The unique index on `(event_id, lower(email))`, and `on conflict do nothing`: the row, or null.
    const insert = (email: string): (typeof emailInvitations)[number] | null => {
      const key = email.toLowerCase();
      if (emailInvitations.some((i) => i.eventId === eventId && i.email.toLowerCase() === key)) return null;
      const row = { id: newInvitationId(), eventId, email, invitedBy: uid, createdAt: new Date().toISOString() };
      emailInvitations.push(row);
      // `after insert … for each row`. Returns nothing to the caller.
      emailInvitation(row, event);
      return row;
    };

    const outcomes: EmailInvitationOutcome[] = [];

    if (event.scope === "public") {
      // EVT-08, unchanged. NO READ OF `members` IN THIS BRANCH (EVT-12 AC-12).
      openGuestLink(eventId);
      for (const email of distinct) outcomes.push({ email, outcome: insert(email) ? "sent" : "ignored" });
      return { ok: true, value: outcomes };
    }

    // EVT-12 step 5.1, 5.2. An outsider's address, invited now or before, opens the event to guests.
    const resolved = distinct.map((email) => approvedMemberByEmail(email));
    if (resolved.some((m) => m === null)) openGuestLink(eventId);

    // Step 5.3. One address after another, each seeing what the earlier ones left (AC-8).
    distinct.forEach((email, i) => {
      if (!insert(email)) {
        outcomes.push({ email, outcome: "ignored" }); // AC-9
        return;
      }
      outcomes.push({ email, outcome: "sent" });
      const member = resolved[i] ?? null;
      if (member === null || mayReadEvent(event, member.id)) return; // AC-4, AC-5

      if (event.scope === "team") {
        // AC-7. Convert, naming the team as it stands without the creator — `event_stamp` moves
        // `updatedAt`; `notify_event_updated` and `notify_event_invited` are silent for it (Q6-A).
        event.scope = "named";
        event.updatedAt = new Date().toISOString();
        const now = new Date().toISOString();
        for (const m of members) {
          if (m.id === event.creatorId || memberTeamId(m.id) !== event.teamId) continue;
          if (!isEventInvitee(eventId, m.id)) eventInvitees.push({ eventId, memberId: m.id, createdAt: now });
        }
      }

      // AC-6. `notify_event_invited` for this row; EVT-05's mail follows the notification (Q3-A).
      if (!isEventInvitee(eventId, member.id)) {
        eventInvitees.push({ eventId, memberId: member.id, createdAt: new Date().toISOString() });
        notify([member.id], "event_invited", event);
      }
    });
    return { ok: true, value: outcomes };
  },

  // `event_email_invitation_select_manage`: a live event the caller may manage; newest first, then
  // `id` ascending — the real seam's two `order`s.
  async listEventEmailInvitations(eventId: string): Promise<EventEmailInvitation[]> {
    const event = events.find((e) => e.id === eventId);
    if (!event || !mayManageEvent(event, currentMemberId)) return [];
    return emailInvitations
      .filter((i) => i.eventId === eventId)
      .sort((a, b) =>
        a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? 1 : -1) : a.id < b.id ? -1 : 1,
      )
      .map((i) => ({
        id: i.id,
        eventId,
        email: i.email,
        invitedBy: i.invitedBy,
        createdAt: i.createdAt,
      }));
  },

  // -------------------------------------------------------------------------
  // TSK-01 — a member's own tasks. 01-plan.md § 4.5. Every read filters on `ownsTask` and every
  // write finds its row through it — the four policies, and nothing else.
  // -------------------------------------------------------------------------

  async listTasks(from: string, to: string): Promise<Task[]> {
    if (from > to) return [];
    return tasks
      .filter((t) => ownsTask(t) && t.date >= from && t.date <= to)
      .sort(byDayOrder)
      .map((t) => ({ ...t }));
  },

  async listOverdueTasks(today: string): Promise<Task[]> {
    return tasks
      .filter((t) => ownsTask(t) && !t.done && t.date < today)
      .sort(byTaskOrder)
      .map((t) => ({ ...t }));
  },

  // `task_insert_own`: `member_id` takes `auth.uid()` and the `with check` holds the predicate.
  async createTask(input: CreateTaskInput): Promise<Result<Task>> {
    const text = taskText(input.title, input.note);
    if (!text.ok) return { ok: false, error: text.error };
    const time = taskTime(input.timeOfDay);
    if (!time.ok) return { ok: false, error: time.error };
    if (taskDatePast(input.date)) {
      return { ok: false, error: { code: "task_date_past", message: TASK_DATE_PAST } };
    }
    if (currentMemberId === null || memberTeamId(currentMemberId) === null) return taskNotPermitted();
    if (!isTaskDate(input.date)) return { ok: false, error: { code: "unknown", message: TASK_SAVE_FAILED } };
    const row: Task = {
      id: newTaskId(),
      memberId: currentMemberId,
      date: input.date,
      title: text.title,
      note: text.note,
      timeOfDay: time.timeOfDay,
      done: false,
      createdAt: new Date().toISOString(),
    };
    tasks.push(row);
    return { ok: true, value: { ...row } };
  },

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Result<Task>> {
    const text = taskText(input.title, input.note);
    if (!text.ok) return { ok: false, error: text.error };
    const time = taskTime(input.timeOfDay);
    if (!time.ok) return { ok: false, error: time.error };
    return updateOwnTask(taskId, { title: text.title, note: text.note, timeOfDay: time.timeOfDay });
  },

  async moveTask(taskId: string, date: string): Promise<Result<Task>> {
    if (taskDatePast(date)) {
      return { ok: false, error: { code: "task_date_past", message: TASK_DATE_PAST } };
    }
    if (!tasks.some((t) => t.id === taskId && ownsTask(t))) return taskNotPermitted();
    if (!isTaskDate(date)) return { ok: false, error: { code: "unknown", message: TASK_SAVE_FAILED } };
    return updateOwnTask(taskId, { date });
  },

  async setTaskDone(taskId: string, done: boolean): Promise<Result<Task>> {
    return updateOwnTask(taskId, { done });
  },

  // `task_delete_own`. Zero rows is `task_not_permitted`, not success.
  async deleteTask(taskId: string): Promise<Result<void>> {
    const index = tasks.findIndex((t) => t.id === taskId && ownsTask(t));
    if (index === -1) return taskNotPermitted();
    tasks.splice(index, 1);
    return { ok: true, value: undefined };
  },
};
