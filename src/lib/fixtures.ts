// The shared fixture module. 02-design.md section 1.5 names this file, closing the
// `TODO(project): name the shared fixture module` in .ai/standards/testing-standards.md.
//
// supabase/seed.sql inserts the SAME rows with the SAME literals. That is the whole point: the
// standard forbids tests inventing entities inline because a fixture that exists in one place drifts
// from the seed and produces failures that reproduce in CI and not locally. Change a value here and
// change it there in the same commit.
//
// The uuids are fixed literals and never generated, for the same reason.
import type { AuthUser, Entry, Holiday, IssueReport, Member, Team } from "./domain/types";

/**
 * CAL-04 gives this row a TYPE and a `createdAt`. The inline object literal that stood here predated
 * `Team`, which 01-plan.md section 4 promotes to a domain type because `getTeam()` returns it — the
 * same promotion 02-design.md made for `AllowedEmail`. The literal is unchanged in every field it
 * already had, and `createdAt` is transcribed from the row supabase/seed.sql already inserts
 * (seed.sql:51), so nothing here claims a value the seed does not hold.
 *
 * `overloadThreshold` is a SHARE, not a count (glossary.md, Threshold), and INV-04 compares it with
 * `>` and never `>=`. At 0.5 a team of four is overloaded at 2.5 and not at 2.0.
 */
export const FIXTURE_TEAM: Team = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "CaleChip",
  overloadThreshold: 0.5,
  // SOLO, 2026-09-11. Both `true`, which is the columns' default and today's behaviour — every entry
  // waits. `supabase/seed.sql` names neither column, so the seeded row gets the default and this
  // transcription stays exact.
  wfhNeedApprove: true,
  ptoNeedApprove: true,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/**
 * The seeded first admin. The story puts the first team and the first admin out of scope as a
 * capability — a human applies the seed — so this row exists only because `allowed_email.added_by`
 * references a member and AC-11/AC-12 need an admin to read the allow-list as.
 *
 * `id` is the Supabase Auth user id (data-model.md): the same literal is the auth user in the seed.
 */
export const FIXTURE_ADMIN: Member = {
  id: "22222222-2222-4222-8222-222222222222",
  teamId: FIXTURE_TEAM.id,
  displayName: "Quản trị",
  avatar: "1.png",
  // SOLO, 2026-09-12. The address the `/members` screen renders. `Member.email` is a COPY of
  // `auth.users.email` in the real seam (20260912120000_solo_member_email.sql); here it is the
  // address this person's seeded credential names, so the mock and supabase/seed.sql agree.
  email: "quan@example.com",
  role: "admin",
  status: "approved",
  lastSignInAt: "2026-09-09T08:00:00+00:00",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/** Not on the list at all, for AC-5: sign-up succeeds and no member row is created. */
export const FIXTURE_UNLISTED_EMAIL: string = "khach@example.com";

// ---------------------------------------------------------------------------
// TEA-02. 02-design.md section 1.5.
// ---------------------------------------------------------------------------

/**
 * A member-role member. The permission-model test needs a token per role and the seed had only an
 * admin, so AC-8's denials had nobody to be denied as.
 *
 * DEVIATION from 02-design.md section 1.5, which names the id
 * `33333333-3333-4333-8333-333333333333`. That literal was taken by an operator-added admin account
 * in supabase/seed.sql on 2026-09-01, after the design was written. Reusing it would have made the
 * seed's `on conflict (id) do nothing` silently drop this row and leave the member-role member
 * absent - the exact gap section 4.2 exists to close. Everything else in section 1.5 is unchanged.
 */
export const FIXTURE_MEMBER: Member = {
  id: "55555555-5555-4555-8555-555555555555",
  teamId: FIXTURE_TEAM.id,
  displayName: "Thành viên",
  avatar: "1.png",
  // SOLO, 2026-09-12. The address the `/members` screen renders. `Member.email` is a COPY of
  // `auth.users.email` in the real seam (20260912120000_solo_member_email.sql); here it is the
  // address this person's seeded credential names, so the mock and supabase/seed.sql agree.
  email: "thanh@example.com",
  role: "member",
  status: "approved",
  lastSignInAt: "2026-09-09T08:00:00+00:00",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/** A second team, for AC-4. Nothing renders it; it exists so that "another team" is a real id. */
export const FIXTURE_OTHER_TEAM_ID: string = "44444444-4444-4444-8444-444444444444";

// ---------------------------------------------------------------------------
// TEA-03. 02-design.md section 1.5.
// ---------------------------------------------------------------------------

/**
 * The second team, behind the id above. `FIXTURE_OTHER_TEAM_ID` was a bare id and needs a real
 * `team` row now, because `member.team_id` references `team(id)` and AC-2 needs a member on it.
 *
 * Exactly one team exists in v1, so AC-2 is unobservable through the interface and is asserted
 * against seeded data instead — ADR-018's revert condition names this data specifically. A one-team
 * fixture passes whether the team scope is in the policy predicate or absent from it.
 */
export const FIXTURE_OTHER_TEAM: Team = {
  id: FIXTURE_OTHER_TEAM_ID,
  name: "Nhóm khác",
  overloadThreshold: 0.5,
  // SOLO, 2026-09-11. Both `true`, which is the columns' default and today's behaviour — every entry
  // waits. `supabase/seed.sql` names neither column, so the seeded row gets the default and this
  // transcription stays exact.
  wfhNeedApprove: true,
  ptoNeedApprove: true,
  // CAL-04, and the same transcription as FIXTURE_TEAM above: supabase/seed.sql:196 already inserts
  // this literal. `team_select_own` means no caller on FIXTURE_TEAM can ever read this row, which is
  // CAL-04 AC-12 on the team table.
  createdAt: "2026-08-31T00:00:00+00:00",
};

/** A member of the OTHER team. AC-2: no read by anybody on FIXTURE_TEAM may ever return this row. */
export const FIXTURE_OTHER_TEAM_MEMBER: Member = {
  id: "66666666-6666-4666-8666-666666666666",
  teamId: FIXTURE_OTHER_TEAM.id,
  displayName: "Người nhóm khác",
  avatar: "1.png",
  // SOLO, 2026-09-12. The address the `/members` screen renders. `Member.email` is a COPY of
  // `auth.users.email` in the real seam (20260912120000_solo_member_email.sql); here it is the
  // address this person's seeded credential names, so the mock and supabase/seed.sql agree.
  email: "chi@other.example.com",
  role: "member",
  status: "approved",
  lastSignInAt: "2026-09-09T08:00:00+00:00",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/**
 * A removed member of FIXTURE_TEAM. AC-4: the READ returns this row carrying `removedAt`, and the
 * screen does not list it. The two halves are different layers and this fixture is what separates
 * them — a seam that filtered it would pass every component test and leave INV-04 uncomputable.
 */
/**
 * SOLO, 2026-09-10. Somebody who has signed up and is waiting for an admin to decide.
 *
 * **INVISIBLE TO EVERY ROSTER READ, WHICH IS WHY ADDING IT BREAKS NOTHING.** `listMembers` filters
 * `m.teamId === me.teamId` and this row's `teamId` is null, so it appears in no team's roster, is
 * counted by no `currentMemberCount`, and moves no overload threshold. It shows up in exactly one
 * place: `listPendingMembers`, which is scoped by `team_id is null` instead of by a team.
 *
 * **SOLO (TEA-09), 2026-09-29 — THE PARAGRAPH ABOVE WAS TRUE OF THE MOCK ONLY, UNTIL THEN.** The real
 * `listMembers` had no filter and relied on row-level policy, and `member_select_pending_admin` admits
 * this row to an admin — so on the real datastore an admin's sidebar, year grid and INV-04
 * denominator all carried waiting sign-ups. `supabase.ts` now filters `team_id` not null, and
 * `tests/roster-excludes-signups.test.ts` pins both halves.
 *
 * It exists so the new sign-ups screen has a row to draw in the suite. Without it that list renders
 * `signups-empty` in every test and the list markup is never exercised at all.
 */
export const FIXTURE_PENDING_SIGNUP: Member = {
  id: "88888888-8888-4888-8888-888888888888",
  teamId: null,
  displayName: "Người mới",
  avatar: "1.png",
  // SOLO, 2026-09-12. The address the `/members` screen renders. `Member.email` is a COPY of
  // `auth.users.email` in the real seam (20260912120000_solo_member_email.sql); here it is the
  // address this person's seeded credential names, so the mock and supabase/seed.sql agree.
  email: "moi@example.com",
  role: "member",
  status: "pending",
  lastSignInAt: "2026-09-09T08:00:00+00:00",
  removedAt: null,
  createdAt: "2026-09-09T00:00:00+00:00",
};

export const FIXTURE_REMOVED_MEMBER: Member = {
  id: "77777777-7777-4777-8777-777777777777",
  teamId: FIXTURE_TEAM.id,
  displayName: "Đã rời nhóm",
  avatar: "1.png",
  // SOLO, 2026-09-12. The address the `/members` screen renders. `Member.email` is a COPY of
  // `auth.users.email` in the real seam (20260912120000_solo_member_email.sql); here it is the
  // address this person's seeded credential names, so the mock and supabase/seed.sql agree.
  email: "cu@example.com",
  role: "member",
  status: "approved",
  lastSignInAt: "2026-09-09T08:00:00+00:00",
  removedAt: "2026-08-31T12:00:00+00:00",
  createdAt: "2026-08-31T00:00:00+00:00",
};

// ---------------------------------------------------------------------------
// TEA-04. 01-plan.md section 6.1.
// ---------------------------------------------------------------------------

/**
 * A SECOND admin on FIXTURE_TEAM. AC-13 needs an admin row that is not the caller, in order to
 * assert *a remove control and no promote control* on it — and today FIXTURE_ADMIN is the only admin
 * fixture on this team, so the caller and the only admin row are the same row and the criterion is
 * unobservable.
 *
 * It also makes AC-9 concrete rather than hypothetical: with two admins, refusing self-removal costs
 * nobody the ability to leave.
 *
 * `createdAt` is the shared literal, so this row's position in the roster is decided by the `id`
 * tiebreaker — 02-design.md section 1.4, and the reason that tiebreaker exists.
 */
export const FIXTURE_SECOND_ADMIN: Member = {
  id: "88888888-8888-4888-8888-888888888888",
  teamId: FIXTURE_TEAM.id,
  displayName: "Quản trị hai",
  avatar: "1.png",
  // SOLO, 2026-09-12. The address the `/members` screen renders. `Member.email` is a COPY of
  // `auth.users.email` in the real seam (20260912120000_solo_member_email.sql); here it is the
  // address this person's seeded credential names, so the mock and supabase/seed.sql agree.
  email: "dung@example.com",
  role: "admin",
  status: "approved",
  lastSignInAt: "2026-09-09T08:00:00+00:00",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

// ---------------------------------------------------------------------------
// TEA-05. 01-plan.md section 5.1.
// ---------------------------------------------------------------------------

/**
 * An auth user with NO `member` row. AC-4 needs one and none exists: every seeded account has a
 * member row, so the state ADR-009 §Consequences says "must be handled in the interface, not left
 * to look like a bug" has nobody to be.
 *
 * This is the state sign-up produces for an address that was not on the allow-list — the trigger
 * fires, finds no entry, and creates nothing. The seed reproduces it the same way: an `auth.users`
 * row with `email_confirmed_at` set and no allow-list entry for the address.
 *
 * It is an `AuthUser` and not a `Member` on purpose. The two are separate types precisely so that
 * "signed in" and "on a team" cannot be confused, which is the whole of `Membership`.
 */
export const FIXTURE_MEMBER_LESS: AuthUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "hoa@example.com",
  emailConfirmed: true,
};

/**
 * An auth user who has signed up and NOT confirmed their address. AC-3.
 *
 * NOT NAMED IN 01-plan.md, and declared as a deviation in 03-impl-log.md. Section 5's mock table
 * requires "an address flagged unconfirmed in the fixture" and section 5.1 scopes
 * `FIXTURE_CREDENTIALS` to SEEDED addresses, so an unconfirmed address has to be both — a fixture
 * flag with no seed row behind it is the drift section 5.1 exists to repair, one file over.
 *
 * `emailConfirmed: false` is the whole of it: `admit_allow_listed_member` returns early on a null
 * `email_confirmed_at`, so this account has no member row either, and GoTrue refuses the sign-in
 * before membership is ever consulted.
 */
export const FIXTURE_UNCONFIRMED: AuthUser = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "khanh@example.com",
  emailConfirmed: false,
};

/**
 * The password every seeded fixture account carries. One literal, in one place, matching the
 * `extensions.crypt(...)` argument in supabase/seed.sql for each of these rows.
 *
 * The operator's own account in the seed is deliberately absent from this module: it was added by
 * hand on 2026-09-01, it is not a fixture, and mirroring its credential here would put a
 * development password in a file the tests import.
 */
export const FIXTURE_PASSWORD: string = "password123";

/** What a fixture account is expected to resolve to once it is signed in. */
export type FixtureMembership = "member" | "member-less";

/**
 * A seeded account, as a sign-in sees it. AC-1, AC-2, AC-3, AC-4, AC-10.
 *
 * `userId` is the `auth.users` id, which is `member.id` when a member row exists (data-model.md).
 * `emailConfirmed` is false for exactly one row, and that row is what makes AC-3 observable.
 * `membership` is the state a successful sign-in resolves to, so a test can name an account by the
 * criterion it serves rather than by remembering which uuid is which.
 */
export interface FixtureCredential {
  email: string;
  password: string;
  userId: string;
  emailConfirmed: boolean;
  membership: FixtureMembership;
}

/**
 * Every seeded address, with its password and its expected membership. The mock's `signIn` answers
 * from this list and from nothing else, which is what makes the mock's refusals the seed's refusals
 * rather than a second story about who can sign in.
 *
 * EVERY ROW HERE HAS A ROW IN supabase/seed.sql, and that is the point — the standard's own reason
 * is that a fixture existing in one place drifts from the seed and produces failures that reproduce
 * in CI and not locally. Two of these rows are new in TEA-05 (`FIXTURE_MEMBER`'s, whose seed row was
 * missing entirely, and `FIXTURE_MEMBER_LESS`'s); one more is `FIXTURE_UNCONFIRMED`'s.
 */
export const FIXTURE_CREDENTIALS: readonly FixtureCredential[] = [
  {
    email: "quan@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_ADMIN.id,
    emailConfirmed: true,
    membership: "member",
  },
  // AC-10's other half. Until TEA-05 this account had no seed row at all, so the only member-role
  // person in the product was unseeded and "no allow-list link for a member" had nobody to be.
  {
    email: "thanh@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_MEMBER.id,
    emailConfirmed: true,
    membership: "member",
  },
  {
    email: "dung@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_SECOND_ADMIN.id,
    emailConfirmed: true,
    membership: "member",
  },
  {
    email: "chi@other.example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_OTHER_TEAM_MEMBER.id,
    emailConfirmed: true,
    membership: "member",
  },
  {
    email: "cu@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_REMOVED_MEMBER.id,
    emailConfirmed: true,
    membership: "member",
  },
  // AC-4. Signed in, and on no team.
  {
    email: FIXTURE_MEMBER_LESS.email,
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_MEMBER_LESS.id,
    emailConfirmed: true,
    membership: "member-less",
  },
  // AC-3. The one unconfirmed row. Its `membership` is `member-less` because that is what it is —
  // the trigger never ran for it — but no sign-in ever reaches that state, because the refusal
  // happens first.
  {
    email: FIXTURE_UNCONFIRMED.email,
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_UNCONFIRMED.id,
    emailConfirmed: false,
    membership: "member-less",
  },
];

// ---------------------------------------------------------------------------
// CAL-02. 01-plan.md section 7.
//
// AC-5 and AC-6 need an entry that is ALREADY APPROVED, and nothing in the product can create one:
// the insert grant excludes `status`, this ticket's update grant excludes it too, and ADM-05 does
// not exist. So the only way an approved entry can exist for a test to edit is for a human to seed
// it — which is what section 7 puts this file and supabase/seed.sql in `allowed_paths` for.
// ---------------------------------------------------------------------------

/**
 * A THIRD member-role account on FIXTURE_TEAM, and it exists so the approved entry below has an
 * owner who is nobody else's fixture.
 *
 * DEVIATION from 01-plan.md section 7, which names the entry and not a member to own it. Declared in
 * 03-impl-log.md. FIXTURE_MEMBER cannot own it: tests/e2e/cal-01-create-entry.spec.ts asserts
 * `own-entries-empty` on that account's first screen and exact row counts afterwards, and section 4.3
 * requires that suite to pass UNEDITED — seeding an entry for `thanh@example.com` breaks it. The same
 * is true of FIXTURE_ADMIN, whose list CAL-01 AC-10 and AC-11 count. Reusing FIXTURE_SECOND_ADMIN
 * would have avoided a new row but would have observed AC-5 and AC-6 as an ADMIN editing their own
 * approved entry, which 01-plan.md Open questions item 3 keeps as a separate case on purpose.
 *
 * Role `member`, because that is who AC-5 and AC-6 are written about.
 */
export const FIXTURE_APPROVED_MEMBER: Member = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  teamId: FIXTURE_TEAM.id,
  displayName: "Đã duyệt",
  avatar: "1.png",
  // SOLO, 2026-09-12. The address the `/members` screen renders. `Member.email` is a COPY of
  // `auth.users.email` in the real seam (20260912120000_solo_member_email.sql); here it is the
  // address this person's seeded credential names, so the mock and supabase/seed.sql agree.
  email: "nga@example.com",
  role: "member",
  status: "approved",
  lastSignInAt: "2026-09-09T08:00:00+00:00",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/**
 * The approved entry AC-5 and AC-6 edit. `approvedBy` is FIXTURE_ADMIN and `approvedAt` is set,
 * because INV-02's whole subject is a decision that must not survive a substantive edit — an entry
 * seeded `approved` with no approver would let AC-5 pass against a trigger that clears nothing.
 *
 * `status` is `approved`, so `rejectionReason` is null: INV-03's check is a BICONDITIONAL and a
 * reason on a non-rejected row is refused by the datastore.
 *
 * The dates sit clear of every date CAL-01's and this ticket's other criteria use, so a test that
 * creates an entry for this member cannot collide with it under INV-01 by accident.
 */
export const FIXTURE_APPROVED_ENTRY: Entry = {
  id: "dd000000-0000-4000-8000-000000000001",
  memberId: FIXTURE_APPROVED_MEMBER.id,
  type: "pto",
  portion: "full",
  startDate: "2026-09-14",
  endDate: "2026-09-16",
  tentative: false,
  status: "approved",
  rejectionReason: null,
  note: "Nghỉ đã được duyệt",
  approvedBy: FIXTURE_ADMIN.id,
  approvedAt: "2026-09-01T02:00:00+00:00",
  createdAt: "2026-09-01T01:00:00+00:00",
  // Equal to `createdAt`, which is what the datastore stores for a row that has never been updated
  // (`updated_at` defaults to `now()` at insert and never moves again on its own). AC-12 is
  // observable against this row precisely because the two start equal.
  updatedAt: "2026-09-01T01:00:00+00:00",
};

/** The credential for FIXTURE_APPROVED_MEMBER. Its seed row is in supabase/seed.sql, as every row of
 *  FIXTURE_CREDENTIALS above has one — a fixture with no seed row behind it is the drift this module
 *  exists to prevent. It is a separate constant rather than an eighth element of the array above so
 *  that a reader of TEA-05's list sees TEA-05's accounts. */
export const FIXTURE_APPROVED_MEMBER_CREDENTIAL: FixtureCredential = {
  email: "linh@example.com",
  password: FIXTURE_PASSWORD,
  userId: FIXTURE_APPROVED_MEMBER.id,
  emailConfirmed: true,
  membership: "member",
};

// ---------------------------------------------------------------------------
// CAL-03. 01-plan.md section 7.
//
// ONE new row, and it is AC-8's. Everything else AC-1 to AC-12 needs already exists:
// FIXTURE_APPROVED_ENTRY belongs to FIXTURE_APPROVED_MEMBER, who is NOT the admin, so AC-3, AC-4
// and AC-12 have an approved entry of somebody else's to act on without a new fixture.
// ---------------------------------------------------------------------------

/**
 * An entry owned by FIXTURE_OTHER_TEAM_MEMBER. AC-8: an admin of FIXTURE_TEAM may not edit it and
 * may not delete it, and no read by anybody on FIXTURE_TEAM may return it.
 *
 * The fixtures have held a second team since TEA-03 and a member on it, and no ENTRY on it — so
 * until now "an admin of one team may not touch another team's entry" had nothing to be refused
 * against, and a policy missing its team predicate would have passed every test in the repository.
 * That is the gap ADR-018's revert condition names for TEA-03's read, arriving on the write side.
 *
 * IT IS A FIXTURE AND NOT A TEST'S CREATION, because no test can create it. `entry_insert_own`
 * admits only `member_id = auth.uid()`, so an entry on the other team can be created only by that
 * team's own member signing in, and every suite here signs in on FIXTURE_TEAM.
 *
 * `status` is `pending` — the plain case, so that a refusal observed against this row is the TEAM
 * boundary refusing and not INV-02's trigger doing something else. Its dates sit clear of every date
 * used by CAL-01's, CAL-02's and this ticket's criteria, so nothing collides with it by accident
 * under INV-01 — though nothing on FIXTURE_TEAM could, since INV-01 keys on `member_id`.
 */
export const FIXTURE_OTHER_TEAM_ENTRY: Entry = {
  id: "dd000000-0000-4000-8000-000000000002",
  memberId: FIXTURE_OTHER_TEAM_MEMBER.id,
  type: "pto",
  portion: "full",
  startDate: "2026-09-21",
  endDate: "2026-09-22",
  tentative: false,
  status: "pending",
  rejectionReason: null,
  note: "Nghỉ của nhóm khác",
  approvedBy: null,
  approvedAt: null,
  createdAt: "2026-09-01T01:00:00+00:00",
  updatedAt: "2026-09-01T01:00:00+00:00",
};

// ---------------------------------------------------------------------------
// ADM-02. 01-plan.md section 4.5, which transcribes ADR-015 section 5.
//
// THE SYNTHETIC SET, AND IT IS DELIBERATELY NOT THE REAL VIETNAMESE CALENDAR. ADR-015 section 5:
// *"A test asserting '30/4/2026 is a bridge day' asserts a fact about the world that an admin may
// correctly change, and it would then fail for the right reason in the wrong place."* The real rows
// arrive through supabase/migrations/20260905120100_adm02_holiday_seed.sql, which a human fills and
// a human applies (RULE-09).
//
// EVERY WEEKDAY BELOW WAS COMPUTED, NOT RECALLED. ADR-015 section 4's worked example turns on
// 11 June 2026 being a Thursday and 13 June 2026 a Saturday; 15 October 2026 is a Thursday. A
// fixture whose weekday is wrong makes the bridge-day case it exists to represent silently not that
// case — and CAL-08 is the ticket that would discover it, far from here.
//
// 2027 CARRIES NO ROW AT ALL. That is ADR-015 section 5's *"one year with no rows"* and it is
// AC-10's fixture: the year the calendar does not reach.
//
// THE NAMES ARE VIETNAMESE AND SAY THEY ARE SYNTHETIC. This file is on the `userContent` list in
// ui-language.json, which tests/ui-language.test.ts asserts MUST contain diacritics — holiday names
// are user content, so this is the standard's exception working rather than an exception being made.
//
// The same literals are inserted by supabase/seed.sql. Change a value here and change it there in
// the same commit, which is the rule this module states at its own head.
// ---------------------------------------------------------------------------

const HOLIDAY_SEEDED_AT = "2026-09-05T00:00:00+00:00";

/** Thursday. The holiday of ADR-015 section 4's worked example. */
export const FIXTURE_HOLIDAY_THURSDAY: Holiday = {
  id: "cc000000-0000-4000-8000-000000000001",
  date: "2026-06-11",
  name: "Ngày lễ thử nghiệm",
  kind: "non_working",
  createdAt: HOLIDAY_SEEDED_AT,
};

/**
 * Saturday, and `working` — a mandated Saturday, the exact inverse of a holiday (ADR-015 section
 * 2). WITH IT, Friday 12 June is NOT a bridge day, which is the false positive a two-input
 * computation produces. It is the row that makes `kind` worth having at all.
 */
export const FIXTURE_HOLIDAY_WORKING_SATURDAY: Holiday = {
  id: "cc000000-0000-4000-8000-000000000002",
  date: "2026-06-13",
  name: "Làm bù thử nghiệm",
  kind: "working",
  createdAt: HOLIDAY_SEEDED_AT,
};

/** Monday. The compensatory day off ADR-015 section 5 asks for — `non_working`, because `kind`
 *  names the effect and not the Vietnamese label. */
export const FIXTURE_HOLIDAY_COMPENSATORY: Holiday = {
  id: "cc000000-0000-4000-8000-000000000003",
  date: "2026-06-15",
  name: "Nghỉ bù thử nghiệm",
  kind: "non_working",
  createdAt: HOLIDAY_SEEDED_AT,
};

/** Thursday, with an ordinary Friday and an ordinary weekend after it — so Friday 16 October IS a
 *  bridge day. CAL-08 draws that highlight; nothing in ADM-02 computes it. */
export const FIXTURE_HOLIDAY_BRIDGED: Holiday = {
  id: "cc000000-0000-4000-8000-000000000004",
  date: "2026-10-15",
  name: "Ngày nghỉ thử nghiệm",
  kind: "non_working",
  createdAt: HOLIDAY_SEEDED_AT,
};

/** The four rows, in the order supabase/seed.sql inserts them — which is NOT date order, so that a
 *  seam returning them unsorted fails AC-4 rather than passing it by accident. */
export const FIXTURE_HOLIDAYS: readonly Holiday[] = [
  FIXTURE_HOLIDAY_BRIDGED,
  FIXTURE_HOLIDAY_COMPENSATORY,
  FIXTURE_HOLIDAY_THURSDAY,
  FIXTURE_HOLIDAY_WORKING_SATURDAY,
];

// ---------------------------------------------------------------------------
// SOLO, 2026-09-26 — report an issue. One row, and it is the same reasoning FIXTURE_HOLIDAYS
// carries: the admin list screen would render its empty state in every spec that had not sent a
// report first, and the list markup would be exercised by nothing at all.
//
// supabase/seed.sql inserts THIS ROW with THESE literals. Change one and change the other in the
// same commit.
// ---------------------------------------------------------------------------

/**
 * A report sent by an ordinary member, still `open`.
 *
 * **`memberId` IS `FIXTURE_MEMBER`'s AND NOT THE ADMIN'S**, deliberately: the screen that reads this
 * belongs to an admin, and a fixture written by the admin themselves would let a list that showed
 * only the reader's own reports pass every test. The one this file holds is somebody else's.
 *
 * `message` CARRIES VIETNAMESE DIACRITICS, and that is not decoration — this file is the product's
 * only coverage for the type requirement in `CLAUDE.md` § Visual direction, which
 * `ui-language.json` names it for and `tests/ui-language.test.ts` asserts. A report is USER CONTENT:
 * a person writes it in their own language, so an English literal here would be the wrong fixture as
 * well as a lost assertion.
 *
 * `page` is a pathname the product actually has, so a reader of the admin list can follow it.
 */
export const FIXTURE_ISSUE_REPORT: IssueReport = {
  id: "dd000000-0000-4000-8000-000000000001",
  memberId: FIXTURE_MEMBER.id,
  kind: "bug",
  message: "Lịch tuần không hiển thị ngày nghỉ bù, chỉ thấy ô trắng.",
  page: "/week",
  status: "open",
  createdAt: "2026-09-25T02:30:00+00:00",
  // SOLO, 2026-09-26 (second run). **EMPTY, AND THAT IS THE RIGHT FIXTURE.** Attachments are
  // optional — the operator's word was *"if they want"* — so the seeded row is the ordinary case,
  // and the admin screen's no-images arm is the one every spec exercises for free. A fixture with
  // images would need an object in a bucket that no seed can create, and the mock's own uploads are
  // what `tests/issue-reports.test.ts` drives the other arm with.
  images: [],
};
