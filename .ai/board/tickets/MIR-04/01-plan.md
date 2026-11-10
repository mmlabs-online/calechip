---
ticket: MIR-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-20T15:34:34+07:00
inputs_read:
  - .ai/board/tickets/MIR-04/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-03/01-plan.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261014090000_evt12_invite_every_scope.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/routes/EventEditor.tsx
  - tests/events.test.ts
  - tests/e2e/evt-01-events.spec.ts
  - src/routes/EventDetail.tsx                    # 2026-10-21 amendment, 99-questions.md
  - tests/e2e/evt-03-calendar-events.spec.ts      # 2026-10-21 amendment, 99-questions.md
  - tests/e2e/evt-08-event-invitation.spec.ts     # 2026-10-21 amendment, 99-questions.md
consulted:
  - with: operator
    asked: "Q1: what list_member_directory() returns to a non-admin — A own team only, B own team plus people the caller already shares an event or notification with (picker offers teammates only), C no change until MIR-15. Q2: the invitee check — A narrow to the event's team, B keep any team and record the audit."
    answer: "Q1. B / Q2. B"
    resulted_in_amendment: true
chat_before_verdict: "one round: the BLOCKED version of this file, 2026-10-20T15:23:22+07:00, answered by the operator"
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-04 — PLAN

## 1. Problem and scope

**Feature implemented**, transcribed from `.ai/registry/features.md:293`:

> | MIR-04 | The member directory returns only members of the caller's own teams, and the event-invitee
> check is audited | MIR | PLANNED | |

Plan item P0-4 (`.ai/board/plans/calechip-multi-tenancy-plan.md:88-90`), verbatim:

> - `list_member_directory` (`evt01:154-163`) currently returns every member of every team to **any**
>   member. Scope it to the caller's own teams.
> - Audit the event-invitee check (`evt01:215-220`) — it only requires the invitee to have a team

**Decided by the operator on 2026-10-20 and recorded in
[ADR-066](../../../registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md).**
Q1 B: the directory is the caller's own team **plus** the people the caller already shares an event
or a notification with, and the picker offers teammates only. This supersedes the picker clause of
ADR-045 Decision 3. Q2 B: the invitee check is audited and stays as it is.

**"Own teams" today means one team.** Until MIR-12 a member has one `member.team_id`, so "the caller's
own teams" is `public.member_team_id(auth.uid())`. MIR-13 rewrites it against `membership`.

**Who loses what, and why it matters.** Today any member can list every member of every team, with
their team's name, in one call. That is the whole company's roster, handed to anyone who has signed
up and been approved. After this ticket a member sees their own team, plus the specific people the
event feature already shows them: the creator of an event they read, its visible attendees, and the
actor of a notification addressed to them. Phase 0's exit criterion *"No endpoint returns members
outside the caller's scope"* (plan:97) is met for this endpoint.

**Out of scope**
- Narrowing the invitee check (`save_event`, `event_invitee_insert_manage`, `invite_to_event`). The
  operator's Q2 B keeps it. The audit is § 4.5, and the org bound comes with **MIR-13 / MIR-15**.
- The admin's directory and the admin's picker. Both are unchanged (ADR-066 2(a)). The role split
  is **MIR-16 / MIR-17**.
- The org-wide directory for a licensed org, and the Org public case (P3-6): **MIR-15**.
- Public-event reach and `notify_event_created` across teams: **MIR-15**. The admin and public
  branches of `may_read_event`: **MIR-13 / MIR-15**.
- `list_all_members`, `list_members_for_team`, and the other admin cross-team reads: **MIR-13**.
- `list_guest_event_attendees` (token-scoped, ADR-052): unchanged.
- The `rbac-and-security.md` *read the invitee picker* row. It is human-owned, and owed under
  ADR-066 *Affected documents*.
- `supabase/db.sql`: **MIR-08**.

`size_estimate: M`: one migration (one function replaced), the mock, one screen, tests, and manual
verification.

## 2. Acceptance criteria

The **directory** is what `listMemberDirectory()` returns, and its database read is
`public.list_member_directory()`. **Listed** means a row with exactly the five fields `id`,
`displayName`, `avatar`, `teamId` and `teamName`. A **current member** is approved and not removed.
In each AC the caller C is a current member of team T who is not an admin, unless the AC says
otherwise. U is another team.

**AC-1. Teammates are listed.**
- Given C, and current members of T (C included)
- When C reads the directory
- Then every current member of T is listed, C included, with five fields each.

**AC-2. An unconnected member of another team is not listed.**
- Given a current member X of team U who has created no event C may read, has no attendance C can
  see, is not named on an event C may manage, and is the actor of no notification addressed to C
- When C reads the directory
- Then X is not listed, and U's name appears on no row.

**AC-3. The creator of an event C reads is listed.**
- Given X of team U creates a public event
- When C reads the directory
- Then X is listed with `teamName` = U's name.
- And when X's event is instead a Limited people event that does not name C
- Then X is not listed (AC-2 holds).

**AC-4. Visible attendees of an event C reads are listed.**
- Given a public event created by C's teammate, and a member Y of team U who is attending it
- When C reads the directory
- Then Y is listed.
- And given Y's attendance is pending, and C neither created the event nor is an admin
- Then Y is not listed, because C cannot see that attendance.
- And when the creator of that event reads the directory
- Then Y is listed whether the attendance is pending or attending.

**AC-5. Invitees are listed to someone who may manage the event, and only to them.**
- Given C creates a Limited people event that names Z of team U (through the seam or by email,
  § 4.5)
- When C reads the directory
- Then Z is listed.
- And when another member of the event, Z2 of team U named on the same event, reads the directory
- Then the other invitees reach Z2 by no clause of this AC. They are listed only if another clause
  (own team, creator, visible attendance, notification actor) admits them.

**AC-6. The actor of a notification addressed to C is listed.**
- Given X of team U caused a notification whose recipient is C
- When C reads the directory
- Then X is listed. This holds even after the event is deleted and the notification's `event_id` is
  null.

**AC-7. Non-current members are never listed, by any clause.**
- Given a pending sign-up, a rejected one, and a removed member, each of whom would otherwise satisfy
  one of AC-1 or AC-3 to AC-6
- When C reads the directory
- Then none of them is listed. Names that resolved through them render as *Former member*, as today.

**AC-8. A caller with no team gets nothing.**
- Given a pending sign-up, a rejected one, or a removed member as the caller
- When they read the directory
- Then the list is empty. Without a signed-in caller the read is refused (no `execute` for `anon`).

**AC-9. An admin's directory is unchanged.**
- Given an admin A of team T
- When A reads the directory
- Then every current member of every team is listed, as before this ticket.

**AC-10. The picker offers a non-admin their teammates, and keeps people already named.**
- Given C opens the new-event form and chooses *Limited people*
- Then the picker offers every current member of T except C, under one group headed with T's name,
  and offers nobody from another team, even someone AC-3, AC-4 or AC-6 lists.
- And given C edits their own event that already names Z of team U
- Then Z is offered, checked, under a group headed with U's name, and C can uncheck Z and save.
- And for an admin, the picker offers every other current member of every team, as before.

**AC-11. The invitee check is unchanged (operator Q2 B).**
- Given C
- When C saves a Limited people event naming a current member of team U, through the seam
- Then it succeeds as before, and the named member reads the event.
- And naming a pending, rejected or removed member, or an unknown id, is still refused (EVT-01
  AC-11).

**AC-12. The names the event screens show still resolve.**
- Given the cases in AC-3, AC-4, AC-5 and AC-6
- When C opens the event list, the event's detail page, and the notification bell
- Then the creator, attendee, invitee and actor names show as display names, never as *Former
  member*.

**AC-13. Nothing else about members widens or narrows.**
- Given the migration is applied
- Then no policy on `public.member` is created, dropped or changed, `listMembers()` returns what it
  returned before for every caller, and `list_member_directory()` still returns five columns.

**Invariants touched: `[INV-04]`.**
- **INV-04**: `listMembers()` is the absence count's denominator. This ticket changes a separate
  definer read, and AC-13 asserts that no `public.member` policy and no `listMembers()` result
  changes. It is listed for the reason EVT-01 listed it.

**Open questions.** None. Q1 and Q2 were answered by the operator (front-matter `consulted`). One
clause of Q1 B was narrowed when the source was read. AC-5 takes invitees only from events the caller
may **manage**, not from events the caller may read. ADR-066 § Status records why and how to revert
it, and so does the Changelog below.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

Nothing new is drawn. The picker keeps its shape: an inline checklist grouped under team names, with
the filter above it (`EventEditor.tsx` header, EVT-01 § 2b). For a non-admin it normally has one
group, their team's. A group for another team appears only to hold people already named on the event
being edited, and it sits in the directory's order (team name, then display name). No hint text is
added to explain that other teams are no longer offered.

## 3. Permission model

The datastore holds the control. The picker filter is an affordance only (ADR-005).

| Action | Member / Manager | Admin | Where it is held |
|---|---|---|---|
| Read the directory: own team | ✅ | ✅ | `list_member_directory`, clause (b) |
| Read the directory: another team's member connected by an event or notification | ✅ only that person (**new bound**) | ✅ | clauses (c), (d), (e) |
| Read the directory: every member of every team | ❌ (**was ✅**) | ✅ (unchanged) | clause (a) `is_admin` |
| Read the directory with no team / signed out | empty / refused | n/a | `member_team_id(uid) is not null`, and no grant for `anon` |
| Name an invitee of any team on an event they manage | ✅ (unchanged, Q2 B) | ✅ | `save_event`, `event_invitee_insert_manage`, `invite_to_event` |
| Be offered another team's member in the picker | ❌ unless already named (**new**) | ✅ | client only (`EventEditor.tsx`) |
| Read `public.member` rows | unchanged | unchanged | `member_select_team` etc. Not touched |

A manager gains nothing over a member (ADR-045 point 5).

## 4. Contract

### 4.1 Migration `supabase/migrations/20261020180000_mir04_scoped_member_directory.sql` (new)

`begin; … commit;`, idempotent (`create or replace` only), applied by a human (RULE-09). The header
cites ADR-066 and this plan, says it supersedes the picker clause of ADR-045 Decision 3, says no
policy on `public.member` changes, and carries the same **NOT VERIFIED AGAINST A RUNNING
POSTGRESQL** line as the EVT migrations, pointing at `verification.md`.

The function keeps its signature, so `create or replace` keeps its grants. The grants are restated
exactly as `evt01:344,350` wrote them.

```sql
create or replace function public.list_member_directory()
  returns table (id uuid, display_name text, avatar text, team_id uuid, team_name text)
  language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.avatar, m.team_id, t.name
    from public.member m
    join public.team t on t.id = m.team_id
   where public.member_team_id((select auth.uid())) is not null
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and (
       -- (a) ADR-066 2(a): an admin, unchanged.
       public.is_admin((select auth.uid()))
       -- (b) own team.
       or m.team_id = public.member_team_id((select auth.uid()))
       -- (c) creator of an event the caller reads; invitee of an event the caller manages.
       or exists (select 1 from public.event e
                   where e.creator_id = m.id
                     and public.may_read_event(e.id, (select auth.uid())))
       or exists (select 1 from public.event_invitee i
                   where i.member_id = m.id
                     and public.may_manage_event(i.event_id, (select auth.uid())))
       -- (d) attendance the caller can see: event_attendance_select_visible's predicate.
       or exists (select 1 from public.event_attendance a
                   where a.member_id = m.id
                     and public.may_read_event(a.event_id, (select auth.uid()))
                     and (a.status = 'attending'::public.attendance_status
                          or public.may_manage_event(a.event_id, (select auth.uid()))))
       -- (e) actor of a notification addressed to the caller.
       or exists (select 1 from public.notification n
                   where n.actor_id = m.id
                     and n.recipient_id = (select auth.uid()))
     );
$$;

revoke all on function public.list_member_directory() from public, anon;
grant execute on function public.list_member_directory() to authenticated;
```

Keep the select list text `select m.id, m.display_name, m.avatar, m.team_id, t.name` as it is.
`tests/events.test.ts` matches it.

### 4.2 Real seam `src/lib/data/supabase.ts`: no change

The RPC name, the columns, the ordering and the `ROSTER_LIMIT` guard are all unchanged. It is not in
`allowed_paths`.

### 4.3 Mock seam `src/lib/data/mock.ts`

`listMemberDirectory()` reproduces § 4.1 clause for clause, using the existing helpers. Keep the early
`memberTeamId(currentMemberId) === null → []`, the approved / not-removed / has-team filter, and the
one-row-per-id rule. Then admit `m` only if:

```ts
eventIsAdmin(uid)
|| m.teamId === memberTeamId(uid)
|| events.some((e) => e.creatorId === m.id && mayReadEvent(e, uid))
|| eventInvitees.some((i) => i.memberId === m.id && mayManageEventId(i.eventId, uid))
|| eventAttendance.some((a) => a.memberId === m.id && attendanceVisibleTo(a, uid))
|| notifications.some((n) => n.actorId === m.id && n.recipientId === uid)
```

`mayManageEventId` and `attendanceVisibleTo` are local helpers. The first finds the event and calls
`mayManageEvent`. The second finds the event and returns `mayReadEvent(e, uid) && (a.status ===
"attending" || mayManageEvent(e, uid))`, which is `listEventAttendance`'s filter minus the caller's
own row, already covered by (b). Rewrite the comment above the function so that it cites ADR-066 and
names the five clauses.

### 4.4 Seam interface `src/lib/data/index.ts`

Doc comments only. The comment on `listMemberDirectory()` becomes: *the caller's own team, plus the
creator of any event they may read, the invitees of any event they may manage, attendees they can
see, and actors of their notifications; every team for an admin; empty without a team. ADR-066.* The
EVT-01 block comment that says *"every approved, non-removed member of every team"* is corrected the
same way. **No signature, type or export changes.**

### 4.5 Screen `src/routes/EventEditor.tsx`

`groups` (the `useMemo` building the picker) skips a person when all of these hold: `me` is not an
admin (`me?.role !== "admin"`), `person.teamId !== me?.teamId`, and `person.id` is not in
`initial.inviteeIds`. Key it on `initial.inviteeIds`, not the live `values.inviteeIds`. A
cross-team invitee unchecked during an edit stays on screen and can be checked again before saving.
The *"AC-10. Every approved member of every team except the caller"* comment and the header paragraph
on the picker are rewritten to cite ADR-066 1 and say the filter is an affordance. The datastore
still accepts any team (Q2 B). Nothing else on the form changes.

**The invitee check, as audited (operator Q2 B: recorded, not changed).**

| Path | Check today | Admits another team? |
|---|---|---|
| `save_event` (`20260929140000_evt02_attendance.sql:192-197`; EVT-01's original at `evt01:215-220`) | `member_team_id(i.member_id) is null` → `invalid_event_invitee` | **yes**. Only approved members with a team pass; pending, rejected, removed and unknown are refused |
| policy `event_invitee_insert_manage` (`evt01:306-311`) | `may_manage_event(event_id, uid) and member_team_id(member_id) is not null` | **yes**, same predicate. Reachable directly over `/rest/v1/event_invitee` by someone who may manage the event |
| `invite_to_event`, member branch (`20261014090000_evt12_invite_every_scope.sql`, ADR-061) | resolves an email to an approved member and adds them to `event_invitee` if they cannot read the event | **yes**, by design (ADR-061, `ACCEPTED by the operator`) |

After this ticket the screen offers a non-admin no other-team member, but all three paths still
accept one, given an id or an email. ADR-066 *Consequences* records this. The org bound is MIR-13 /
MIR-15. None of the three is edited.

### 4.5b Screen `src/routes/EventDetail.tsx` (added 2026-10-21, AC-12)

The directory is no longer a fixed roster: an invite sent from the detail page can create the
connection (clause (c), an invitee of an event the caller manages) that admits the new person. The
directory read at page load predates that connection, so the new invitee renders as *Former member*
until a reload. That is a defect against AC-12, reproduced by `evt-08-event-invitation.spec.ts:178`.

`onInvited()` re-reads the directory with the rest, and stores it in the same `setState`. Exactly:

```ts
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
```

The comment above `onInvited` gains one sentence: *MIR-04, ADR-066 2(c): the directory too, because
the invite may be what admits the new invitee's name.* The `catch` stays as it is. No other line of
the file changes: no seam call is re-signed, no type changes, no selector is added, and `load()` is
untouched.

### 4.6 Tests

**`tests/member-directory-scope.test.ts` (new, drives the mock seam).** One `it` per row, named as
written. Each test builds its own events through the seam and deletes them afterwards, so the order
of tests does not matter.

| AC | `it(...)` |
|---|---|
| AC-1 | `"a member's directory lists every current member of their own team, themselves included"` |
| AC-2 | `"a member of another team with no shared event or notification is not listed"` |
| AC-3 | `"the creator of a public event from another team is listed; of a Limited people event that does not name the caller, is not"` |
| AC-4 | `"an attending member of another team is listed to a reader; a pending one only to the event's creator"` |
| AC-5 | `"an invitee from another team is listed to the event's creator and not, by that clause, to a fellow invitee"` |
| AC-6 | `"the actor of a notification addressed to the caller is listed, after the event is deleted too"` |
| AC-7 | `"a removed, pending or rejected member is listed by no clause"` |
| AC-8 | `"a caller with no team receives an empty directory"` |
| AC-9 | `"an admin's directory lists every current member of every team"` |
| AC-11 | `"naming a current member of another team still saves, and they read the event"` |
| AC-13 | `"listMembers answers the same for every caller as before the change"`: compare against the fixture roster for T |
| AC-1–AC-13 | `"the migration replaces list_member_directory with the five clauses and touches no policy"`. A static read of the migration asserting: the unchanged `returns table (...)` and select list, `is_admin`, `m.team_id = public.member_team_id`, `may_read_event` (twice), `may_manage_event` (twice), `public.notification n`, `n.recipient_id = (select auth.uid())`, the restated revoke and grant, and **no** `create policy`, `drop policy` or `alter policy`. **This is not verification.** It guards the file until MIR-05 can run it |

**`tests/events.test.ts` (edit).** `"AC-10: the directory is every approved, current member of every
team — five fields and no more"` asserts the superseded behaviour. Rename it to `"AC-10 (ADR-066): a
member's directory is their own team — five fields and no more"`, and change its assertion to: own
team listed, `FIXTURE_OTHER_TEAM_MEMBER` and `MEMBER_B2` (if on another team) **not** listed while no
event connects them, and the five-field and pending/rejected/removed parts unchanged. Add one dated
comment line above it citing MIR-04 / ADR-066. Every other `it` keeps its name and assertion. If one
starts failing because of the narrower directory, re-aim it at a teammate or add the connecting event,
and say so in `03-impl-log.md`.

**`tests/e2e/evt-01-events.spec.ts` (edit, two tests).**
- `"AC-10, AC-13, AC-23: the picker groups every other member by team…"` becomes `"AC-10, AC-13,
  AC-23 (ADR-066): the picker offers the caller's own team, and the creator sees who is named"`. It
  expects **one** group and the team's name, the caller not offered, `OTHER_TEAM.name` offered
  **0** times, and `TEAMMATE` named instead. The AC-13 half switches to `TEAMMATE` as the named
  reader, and the AC-7 half switches to `OTHER_TEAM.email` as the unnamed person who cannot see it.
  The filter step filters on the teammate's name.
- `"AC-14, AC-23: the edit form opens with the current values, including who is named"` names
  `TEAMMATE` instead of `OTHER_TEAM`. Nothing else changes.

**`tests/e2e/evt-03-calendar-events.spec.ts` (edit, one test; added 2026-10-21).** `"AC-4, AC-9,
AC-11: what a member cannot read is not drawn; an admin on team B sees team B's events"` creates
"Named B" as the team-A member by clicking `NAMES.otherTeam` in the picker. AC-10 now removes that
option, so the step is superseded, not broken. The re-aim:
- The `createEvent` helper's `values` gains one optional field, `inviteEmail?: string`. When it is
  set, the helper fills `event-form-invite-input` with it before `event-save`. The existing `invite`
  field and its picker click are kept as they are, for "Named A".
- "Named B" is created with `scope: "named"`, no `invite`, and `inviteEmail: OTHER_TEAM`. On save,
  `createEventWithInvitations` creates the event and then `inviteToEvent`'s member branch adds the
  team-B member to `event_invitee` (ADR-061; legal under Q2 B / AC-11). It is still a Limited people
  event created by the team-A member and naming the team-B member.
- Every assertion keeps its value: 4 events on the member's 2026-09-23, "B team day" absent there,
  and `["B team day", "Named B", "Open day"]` with `data-taking-part="false"` on team B's view.
- One dated comment line above the "Named B" call cites MIR-04 / ADR-066 1 and says the picker no
  longer offers another team. The test name and every other test in the file are unchanged.

**`tests/e2e/evt-08-event-invitation.spec.ts`: not listed, and must pass unchanged.** Its failure at
line 184 is the AC-12 defect § 4.5b fixes.

**The whole existing suite must stay green**, including `tests/e2e/`. `evt-08-event-invitation.spec.ts:178-184`
invites `OTHER_TEAM` by email and expects their name under `event-invitees`. That is AC-5 and AC-12,
and it must still pass unchanged. If any other test fails because a name no longer resolves, it is a
defect against AC-12, not a test to re-aim: raise it in `99-questions.md`.

### 4.7 Manual verification `.ai/board/tickets/MIR-04/verification.md` (new)

This is the same form as MIR-02 and MIR-03: the developer writes the steps, the operator fills in the
results, and no key or token goes in the file. P0 exit criteria (plan:98) make it the verification of
record until MIR-05.

1. **Before the migration**: reproduce the finding. As a member of team T, call `POST
   /rest/v1/rpc/list_member_directory`, and record the count and the distinct `team_name` values.
2. **After the migration**: one step per AC-1 to AC-9, AC-11 and AC-13. Each step gives the setup
   (which event, attendance or notification to create, in the app or the SQL editor), the exact
   `curl`, the token it runs as, and the ids expected present and absent. AC-13 is `select
   policyname, cmd, qual from pg_policies where tablename = 'member'`, compared before and after.
   AC-10 and AC-12 go through the application.

### Selectors

| `data-testid` | Element | Status |
|---|---|---|
| `event-picker` | the inline checklist | existing |
| `event-picker-group` | one team's group | existing. Normally one group for a non-admin |
| `event-picker-option` | one person | existing. Own team, plus people already named |
| `event-invitees` | named people on the detail page | existing. Names must still resolve (AC-12) |

No selector is added.

## 5. Seam impact

**No seam function is added, removed or re-signed.** `listMemberDirectory()` changes behaviour in
both implementations: in the real one through the replaced SQL function, and in the mock by
reproduction. Seam parity holds. RULE-02 is unchanged, because the screens still reach the datastore
only through the seam.

## 6. Schema delta

**Not `none`.** It replaces the definer function `public.list_member_directory()` (same signature,
grants restated). No table, column, policy, trigger or constraint changes.

**ADR: [ADR-066](../../../registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md),
`ACCEPTED by the operator` 2026-10-20 ("Q1. B / Q2. B").** It supersedes the picker clause of ADR-045
Decision 3, and ADR-045 gets the note. `requires_adr: true`. Applying the migration is human (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261020180000_mir04_scoped_member_directory.sql"
  - "src/lib/data/mock.ts"
  - "src/lib/data/index.ts"
  - "src/routes/EventEditor.tsx"
  - "tests/member-directory-scope.test.ts"
  - "tests/events.test.ts"                  # the one superseded AC-10 assertion, § 4.6
  - "tests/e2e/evt-01-events.spec.ts"       # two picker tests re-aimed at a teammate, § 4.6
  - "src/routes/EventDetail.tsx"            # onInvited re-reads the directory, § 4.5b (2026-10-21)
  - "tests/e2e/evt-03-calendar-events.spec.ts"   # "Named B" invited by email, § 4.6 (2026-10-21)
  - ".ai/registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md"
  - ".ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md"   # supersession note under § Status only
  - ".ai/board/tickets/MIR-04/**"
```

`glossary_owed` is `[]`. No glossary row is written and `.ai/registry/glossary.md` is not listed.

The list holds nine source and test files plus two ADRs, eleven in all: **`size: M`**. That agrees
with `size_estimate: M`. *Until 2026-10-21: seven source and test files; the two added by the
amendment below leave the bucket unchanged.*

**Not XL.** No seam signature or shared type changes, and no caller of the seam has to change to
follow a contract. `EventDetail.tsx` (§ 4.5b) changes because the directory's *content* now depends on
connections an invite can create, not because a signature moved. That is the
test `.ai/01-operating-model.md` gives for a schema change, applied as MIR-03 § 7 applied it.

`tests/events.test.ts`, `tests/e2e/evt-01-events.spec.ts`, `src/routes/EventDetail.tsx`,
`tests/e2e/evt-03-calendar-events.spec.ts` and `ADR-045` are files this run did not create. Each is listed only for the narrow edit § 4.6 and § 6 name.

## 8. Rejected alternatives

**A. Filter in the client only.** The directory stays global and the picker shows only teammates. No
migration and no ADR on the datastore side. Rejected because the roster still crosses the wire to
every member. P0-4 is about what the endpoint returns, and an affordance is not a control (ADR-005).

**B. A second, own-team read for the picker, with the global directory kept for name resolution.**
Two functions, each simple. Rejected because the global one is the finding. Keeping it for names
leaves `POST /rpc/list_member_directory` returning every team, and plan:97 unmet.

**C. Resolve names through the rows that carry them.** `listEvents`, `listEventAttendance` and
`listNotifications` would return the display name beside each id, and the directory would shrink to
the own team. Each name would travel with the row that justifies it, and the five-clause predicate
would not exist. Rejected for this ticket because it re-signs three seam functions and their types,
changes four screens and the mock, and turns an `M` into an `L` that must split. ADR-066's clauses
reach the same exposure with one function replaced. It is a fair shape for MIR-13, when these reads
are rewritten anyway.

## Changelog

- `2026-10-20T15:23:22+07:00`: written `BLOCKED` at section 2 on Q1 (directory scope versus ADR-045
  Decision 3) and Q2 (the invitee check). Raised by `tech-lead-design`.
- `2026-10-20T15:34:34+07:00`: all sections written after the operator answered "Q1. B / Q2. B",
  recorded as ADR-066. Raised by the operator. Amended by `tech-lead-design`. **Order honesty:** the
  BLOCKED round had already read the directory's consumers (`EventEditor`, `Events`, `EventDetail`,
  `NotificationBell`) to word the options, so sections 1 and 2 were not written cold. **One clause of
  Q1 B was narrowed when the source was read.** `event_invitee_select_manage` shows invitees only to
  someone who may manage the event, and EVT-01 AC-13 asserts that a named reader does not see who else
  is named. AC-5 therefore takes invitees from managed events, not readable ones, so the directory
  does not leak more than the invitee list does. ADR-066 § Status records this and the one-word
  revert. No AC was narrowed to make the build easier.
- `2026-10-21T08:17:08+07:00`: § 4.5b added (`EventDetail.tsx`'s `onInvited` re-reads
  `listMemberDirectory()`), § 4.6 gains the `evt-03-calendar-events.spec.ts` re-aim ("Named B" named
  through `event-form-invite-input`) and states that `evt-08-event-invitation.spec.ts` stays
  unchanged, § 7 gains both paths (`size` stays M, 11 files). Both failures were reproduced on the
  branch by `tech-lead-design` before amending. **The plan was wrong here:** § 4.6 required evt-08
  to pass while § 7 left out the one consumer whose stale directory read breaks it. Raised by
  `developer` in 99-questions.md. Amended by `tech-lead-design`.
