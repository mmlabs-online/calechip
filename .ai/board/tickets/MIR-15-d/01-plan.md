---
ticket: MIR-15-d
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T07:50:00Z
inputs_read:
  - .ai/board/tickets/MIR-15-d/ticket.yaml
  - .ai/board/tickets/MIR-15/01-plan.md
  - .ai/board/tickets/MIR-15-e/ticket.yaml
  - .ai/board/tickets/MIR-15-c/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md
  - .ai/templates/plan.md
  - supabase/migrations/20261014090000_evt12_invite_every_scope.sql
  - src/lib/data/mock.ts
  - src/lib/data/index.ts
  - src/components/EventAttendancePanel.tsx
  - tests/events.test.ts
  - tests/member-directory-scope.test.ts
  - tests/event-attendance.test.ts
  - tests/notifications.test.ts
  - tests/event-email.test.ts
  - tests/event-invitation.test.ts
  - tests/guest-link.test.ts
  - tests/guest-registration.test.ts
  - tests/event-layer.test.ts
  - tests/mock-sql-parity.test.ts
  - tests/e2e/evt-01-events.spec.ts
  - tests/e2e/evt-02-attendance.spec.ts
  - tests/e2e/evt-03-calendar-events.spec.ts
  - tests/e2e/evt-06-guest-link.spec.ts
  - tests/e2e/evt-08-event-invitation.spec.ts
  - tests/e2e/evt-14-guest-sign-in.spec.ts
  - tests/e2e/uie-12-sticky-join.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-15-d — the mock seam reproduces Org public's team-bound public events, and the seam tests assert it

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:304`):

| ID | Feature | Group |
|---|---|---|
| MIR-15 | In Org public, the directory, public events and event notifications stay within the team, only system_admin sets its holidays, and a team can be moved to another org | MIR |

**This ticket is the mock-seam slice of MIR-15** (ADR-076 decision 6). MIR-15 shipped the fence in
SQL: in an org with `is_shared_tenant = true`, a `public` event is read, joined and notified as a
`team` event is, and the member directory stops reaching other teams through it. The mock seam
(`src/lib/data/mock.ts`) still lets a `public` event reach every team, so it is **looser than SQL on
this one predicate** — the one thing MIR-07 says the mock must never be — and the acceptance suite,
which drives the mock, currently asserts the cross-team reach the database now refuses.

**Who gains what.** Nobody gains a capability; the developer and the reviewer gain a mock that answers
the same as the database. Every vitest and e2e assertion about who reads, joins, is notified of, or
is named through a `public` event becomes an assertion about the behaviour production has, rather
than about the behaviour it had before MIR-15. The ticket adds no behaviour (`expected_impact: []`).

`size_estimate: M` — three predicate edits in one file, and ten test files whose assertions move
from "every team" to "own team". No new seam function, no screen, no migration.

**Out of scope — and where each goes:**

- **The dedicated-org branch of the predicate** (`not org_is_shared(e.org_id)` → org-wide reach). The
  mock models Org public only for events: `CalEvent` carries no org, and MIR-15-e's test-only
  dedicated-org set (`mock.ts:536-575`) scopes holidays alone; events in the mock are not org-bound at
  all (MIR-13-b's bound was never reproduced). The shared branch is implemented; MIR-15's AC-3, AC-5,
  AC-7 and AC-13 stay asserted against the database only (`supabase/tests/210-org-public-team-bound.test.sql`).
  Reproducing org on events is a mock ticket of its own, needed the day an e2e test exercises a
  dedicated org's events. § 8 records why it is not done here.
- **The join affordance, `inAudience`** (`src/components/EventAttendancePanel.tsx:130-142`, `case
  "public": return true`). The question the ticket asked at PLAN, answered **not here**. The one
  reader it misleads is an admin viewing another team's `public` event: they are offered *Join* and
  the server refuses (the refusal is reported in the bar, UIE-12 AC-9). A faithful fix needs the
  shared flag in the component (`isOwnOrgShared()` exists since MIR-15-e) and changes `inAudience`'s
  signature, `src/components/EventJoinBar.tsx:49`, and their tests — three or four more paths, past
  the M ceiling. The cheap fix, `me.teamId === event.teamId`, would hide a join a dedicated org's
  member can make, which is worse than offering one that is refused. A follow-up UI ticket.
- **An address of another team's member invited to a `public` event in Org public goes nowhere**
  (AC-10). Since MIR-15 the database answers `sent` while mailing nobody and naming nobody:
  `invite_to_event`'s public branch names no one (EVT-08), and `email_invitation()` returns early
  when `may_read_event` is false (`supabase/migrations/20261014090000_evt12_invite_every_scope.sql:237-241`,
  whose comment *"A no-op on a public event, which every approved member can read"* is no longer true
  in Org public). ADR-076 did not name this consequence. This ticket transcribes it and asserts it so
  it cannot drift; deciding what it should do (convert to `named` as the `team` branch does, or
  refuse the address) is a product decision for `/idea`.
- **The admin's calendar layer** (`src/lib/event-layer.ts:74`) and the tests that read it
  (`tests/event-layer.test.ts:157-168`, `:224`; `tests/description-pictures.test.ts:134-136`;
  `tests/e2e/evt-03-calendar-events.spec.ts:251`) — ADR-076 decision 4, admin unchanged.
- **Named invitations across teams** (by picker or by address to a `team`/`named` event) — unchanged,
  EVT-01 Q5, ADR-076 decision 3.
- **`src/lib/data/supabase.ts`** — the SQL already decides; the Supabase seam passes the rows through.
- **`supabase/tests/030-member-reads.test.sql:19-23`, `:40-44`** — the two `todo()` tests MIR-15 left
  "for MIR-15-d or F-3". They are pgTAP against SQL, not the mock; they go to F-3.
- **Multi-team membership in the mock.** `memberTeamId` (`mock.ts:1388-1390`) answers one team per
  member; MIR-15's Carol (on both teams) is not representable and is asserted in SQL only.

## 2. Acceptance criteria

Throughout: everything is observed **through the mock seam** (`seam` from `src/lib/data/mock.ts`,
the caller set by `__setCurrentMember`), except AC-12, which is observed in the browser against the
mock. Every mock member is in Org public. **Team A** is `FIXTURE_TEAM`, **Team B** is
`FIXTURE_OTHER_TEAM`. **Alice** is `FIXTURE_MEMBER` (Team A), **Tam** is `FIXTURE_APPROVED_MEMBER`
(Team A), **Ada** is `FIXTURE_ADMIN` (admin, Team A), **Bob** is `FIXTURE_OTHER_TEAM_MEMBER`
(Team B), **Bea** is a second approved member of Team B created through the seam. These ACs are
MIR-15's AC-1, -2, -4, -6, -8, -9, -11, -12, -14 and -15, re-observed at the mock.

**AC-1 — a public event is read by its own team, and keeps its scope** (MIR-15 AC-1, AC-15)
- Given Alice has created an event with scope `public`
- When Tam and Ada each call `listEvents()` and `getEvent(id)`
- Then both return it, with `scope` equal to `"public"`

**AC-2 — and by nobody on another team only** (MIR-15 AC-2)
- Given the event of AC-1, opened to guests by Alice
- When Bob calls `listEvents()`, `getEvent(id)` and `getGuestLinkEventId(token)`
- Then the list does not contain it, and both of the others answer `null`

**AC-3 — joining follows reading** (MIR-15 AC-4)
- Given the event of AC-1, with no capacity and approval off
- When Bob calls `joinEvent(id)`
- Then the result is `{ ok: false }` with `error.code` `"attendance_not_permitted"`, and no attendance
  row for Bob exists
- And when Tam calls `joinEvent(id)`, it succeeds with status `"attending"`

**AC-4 — a public event notifies only its own team** (MIR-15 AC-6)
- Given no notification exists
- When Alice creates an event with scope `public`
- Then Tam and Ada each have exactly one `event_created` notification for it
- And Bob has none, and Alice has none

**AC-5 — the directory does not reach another team through a public event's creator** (MIR-15 AC-8)
- Given Bob has created an event with scope `public`, and Alice shares no other event and no
  notification with Bob
- When Alice calls `listMemberDirectory()`
- Then Bob is not in it

**AC-6 — nor through an attendee of one** (MIR-15 AC-9)
- Given Bob has created an event with scope `public`, and Bea has joined it
- When Alice calls `listMemberDirectory()`
- Then neither Bob nor Bea is in it

**AC-7 — what still crosses teams is a named invitation and what it carries** (MIR-15 AC-11;
ADR-066 (c), (d), (e), unchanged)
- Given Tam has created an event with scope `named` naming Alice and Bea, and Bea has joined it
- When Alice calls `listMemberDirectory()`
- Then Bea is in it
- And given Bob has created an event with scope `named` naming Alice, so Alice holds an
  `event_invited` notification whose actor is Bob, and Bob has then deleted that event
- When Alice calls `listMemberDirectory()`
- Then Bob is in it

**AC-8 — the admin is unchanged** (MIR-15 AC-12; ADR-076 decision 4)
- Given Bob has created an event with scope `public`
- When Ada calls `getEvent(id)` and `listMemberDirectory()`
- Then she reads the event and the directory contains Bob
- And when Ada calls `joinEvent(id)`, it is refused with `"attendance_not_permitted"` (no admin clause
  in the audience, EVT-02 AC-11)

**AC-9 — an existing cross-team attendee keeps their place and loses the right to come back**
(MIR-15 AC-14)
- Given Alice created an event with scope `named` naming Bob, Bob joined it, and Alice then changed its
  scope to `public`
- When Bob calls `getEvent(id)`
- Then he reads it
- And when Bob calls `leaveEvent(id)` and then `joinEvent(id)`, the leave succeeds, the join is refused
  with `"attendance_not_permitted"`, and `getEvent(id)` answers `null`

**AC-10 — an address of another team's member on a public event is accepted and reaches nobody**
(the database's behaviour since MIR-15, transcribed; § 1 *Out of scope*)
- Given the event of AC-1
- When Alice calls `inviteToEvent(id, [Bob's email])`
- Then the outcome for that address is `"sent"`, no invitation email is queued, `listEventInvitees(id)`
  is empty, and the event's `scope` is still `"public"`
- And when Alice invites Tam's email instead, one `invitation_member` email is queued to Tam and Tam is
  not named

**AC-11 — the roster is untouched** (INV-04's denominator)
- Given any of the connections above
- When Alice, Bob and Ada each call `listMembers()`
- Then each answers exactly what it answered before the connection existed

**AC-12 — on screen, another team does not see the event** (e2e, against the mock)
- Given Alice has created an event with scope `public` on the Events page
- When Bob signs in and opens the Events page
- Then the event is not listed, and the attendance flows of `tests/e2e/evt-02-attendance.spec.ts` that
  used Bob as a reader or a requester run with readers on Alice's team

**Invariants touched.** `[INV-04]`. `listMemberDirectory()` narrows through `mayReadEvent`, and
INV-04's denominator is `listMembers()`, which no edit here reaches — AC-11 and
`tests/member-directory-scope.test.ts:219-245` assert it. No entry, portion, approval or membership is
read or written: INV-01, INV-02, INV-03, INV-05, INV-06 and INV-07 are not reached.

**Open questions.** None that block. AC-10 records a gap for `/idea`; it does not change what this
ticket builds.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

There is no layout: no screen, component, string or test id changes. AC-12 is observed on the existing
Events page with its existing test ids (`events-empty`, `event-row`, `event-join-button`).

## 3. Permission model

The controls are the SQL MIR-15 shipped — `event_select_visible`, `may_read_event`,
`is_event_audience` (via `event_attendance_insert_own` and `event_attendance_guard`), and
`notify_event_created`. This ticket moves the mock's copies of them; the mock is a reproduction, not a
control. No interface gate changes.

| Action, in Org public | Member, own team | Member, another team only | Admin, another team | Creator / named invitee / participant |
|---|---|---|---|---|
| Read a `public` event — `mayReadEvent` | ✅ | ❌ (AC-2) | ✅ (AC-8) | ✅ (AC-9) |
| Join a `public` event — `isEventAudience` | ✅ (AC-3) | ❌ (AC-3) | ❌ (AC-8) | creator ✅; participant ❌ after leaving (AC-9) |
| Receive `event_created` — `createEvent`'s filter | ✅ (AC-4) | ❌ (AC-4) | ❌ unless on its team | actor ❌ (unchanged) |
| Reach a member through a `public` event in the directory | ✅ (already own team) | ❌ (AC-5, AC-6) | ✅ by (a) (AC-8) | — |
| Reach a member through a named invitation or notification | ✅ | ✅ (AC-7) | ✅ | ✅ |

Denials each asserted by an AC: AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 (join), AC-9 (re-join). Non-changes
asserted so the fence is not drawn wider than SQL: AC-7, AC-8 (read, directory), AC-11.

## 4. Contract

### 4.1 `src/lib/data/mock.ts` — three predicates, nothing else in code

No signature, type, export or field name changes. Each edit replaces one expression.

**(1) `mayReadEvent`** (`mock.ts:812-825`, `event_select_visible` / `may_read_event`): the disjunct

```ts
    event.scope === "public" ||
```

becomes

```ts
    // MIR-15, ADR-076 decision 1. Org public's branch only: every mock event is in Org public
    // (01-plan.md § 1). SQL: `scope = 'public' and (not org_is_shared(org_id) or team_id in
    // member_team_ids(uid))`.
    (event.scope === "public" && event.teamId === mine) ||
```

**(2) `isEventAudience`** (`mock.ts:859-868`, `is_event_audience`): the same replacement, same comment,
`mine` being the `memberTeamId(uid)` the function already computes.

**(3) `createEvent`'s `notify_event_created`** (`mock.ts:3621-3628`):

```ts
        approvedMemberIds().filter((id) => row.scope === "public" || memberTeamId(id) === row.teamId),
```

becomes

```ts
        approvedMemberIds().filter((id) => memberTeamId(id) === row.teamId),
```

and the comment above it says: own team and `public` both notify the creator's team (ADR-076
decision 2, Org public's branch); named people is nobody.

**(4) Comments only.** `listMemberDirectory` (`mock.ts:3536-3585`) is unchanged in code; a
comment beside `admitted` says disjuncts (c) and (d) now reach through the narrowed `mayReadEvent`
(ADR-076 decision 3). No other line of `mock.ts` changes — in particular `emailInvitation`
(`:1229-1245`) already reads `mayReadEvent`, which is what makes AC-10 the database's behaviour.

Verified at PLAN in a scratch copy: with exactly edits (1)–(3), `vitest run` gives 1040 passed, 23
failed, all 23 in the census of § 4.2; and every scenario of AC-1 to AC-10 is reachable through the
seam as written.

### 4.2 Tests changed — each block changed to assert MIR-15's ACs, never deleted

The census below is the 23 failing vitest blocks (assertion line first) plus the e2e spec, read at
PLAN. **The rule for each:** where the block's subject *is* the `public` scope's reach, it now asserts
the fence (own team reads/joins/is notified, the other team does not). Where another team's member is
incidental — a seat-filler, a requester, a second reader — they are replaced by a member of the
event's own team, **or** the cross-team point is kept by moving it to a mechanism that still crosses
(a named invitation, an admin), as noted. Titles that say "every team" are retitled. No block is
removed and no `it.skip`/`todo` is added.

| File:line | Block | Change |
|---|---|---|
| `tests/events.test.ts:224-229` | AC-6 every-team event read by every team | Retitle; Tam, `MANAGER_A`, `FIXTURE_SECOND_ADMIN` read it, `FIXTURE_OTHER_TEAM_MEMBER` and `MEMBER_B2` do not (AC-1, AC-2) |
| `tests/events.test.ts:305` | AC-9 removed member | "still there for everybody else" is asserted with a reader on the leaver's team |
| `tests/events.test.ts:448-450` | AC-14 widen to every team | Widening to `public`: Tam reads it, `MEMBER_B2` does not |
| `tests/member-directory-scope.test.ts:127-135` | creator of a public event from another team is listed | Asserts X is **not** listed (AC-5); retitle |
| `tests/member-directory-scope.test.ts:137-150` | attending member of another team | Two halves: on a `public` event Y's join is refused and Y is not listed (AC-6); the (d) point is kept on a `named` event naming Y and C (AC-7), pending half likewise |
| `tests/member-directory-scope.test.ts:170-179` | actor of a notification | The notification is `event_invited` from a `named` event X creates naming C (AC-7); a `public` event of X gives C none |
| `tests/member-directory-scope.test.ts:219-245` | listMembers unchanged | The widening connection is X naming C on a `named` event, so the directory still widens (AC-11) |
| `tests/event-attendance.test.ts:194` | AC-4 capacity | Seat-filler is an own-team member |
| `tests/event-attendance.test.ts:257-261` | AC-6 joining | Joiner is an own-team member |
| `tests/event-attendance.test.ts:453-459` | AC-16 any event, any team | Keep "any team" on the decider: the event and requester on Team B, the admin on Team A decides |
| `tests/notifications.test.ts:176-177` | AC-1 every-team event notifies everyone | Own team and same-team admin notified, other team not (AC-4); retitle |
| `tests/notifications.test.ts:222-226`, `:289-291`, `:318` | AC-4, AC-6, AC-7 | Joiners are own-team members |
| `tests/event-email.test.ts:186` | AC-1 | The in-app `event_created` row is read by an own-team recipient |
| `tests/event-email.test.ts:216-224`, `:250` | AC-3, AC-4 | Joiners are own-team members |
| `tests/event-invitation.test.ts:393-400` | another team's member invited to a public event | Asserts AC-10 both halves; a comment cites § 1 *Out of scope* |
| `tests/guest-link.test.ts:293-312` | AC-10 attendees any team | Attendees are own-team members; "any team" is dropped from the title |
| `tests/guest-link.test.ts:446-447` | EVT-13 AC-1, AC-2 every kind of reader | `FIXTURE_OTHER_TEAM_MEMBER` moves to the non-reader assertions (`null`) (AC-2) |
| `tests/guest-registration.test.ts:445-458` | AC-14 | Member attendees are own-team members |
| `tests/guest-registration.test.ts:478-481` | AC-15 | `MEMBER_B2` is no longer a reader: it joins the "gets nothing" set |
| `tests/event-layer.test.ts:271-272` | listOwnEventAttendance AC-11 | The other attendee is an own-team member; the admin-own-rows point is unchanged |
| `tests/e2e/evt-02-attendance.spec.ts:153-158` | reader on another team sees the list | The non-attending reader is `ADMIN` (Team A); then `OTHER_TEAM` opens Events and the event is absent (AC-12) |
| `tests/e2e/evt-02-attendance.spec.ts:173-191` | second requester from another team | The second requester is `ADMIN` (Team A); approve/reject flow unchanged |

E2E census, by reading (no Playwright browser on the PLAN machine): `evt-01`, `evt-03`, `evt-06`,
`evt-08`, `evt-14` and `uie-12` use the other-team member only on `team`/`named` events or through the
admin's layer, and are unaffected. Only `evt-02` changes. The developer runs `pnpm e2e` (or the
project's equivalent) to confirm.

No new test-only export is needed: every scenario above is reachable through `seam`,
`__setCurrentMember`, `__resetEvents` and `__sentInvitationEmails`, which exist.

## 5. Seam impact

None. No `DataSeam` function is added, removed or re-shaped; `tests/seam-parity.test.ts` is untouched.
`listEvents`, `getEvent`, `joinEvent`, `leaveEvent`, `listMemberDirectory`, `listNotifications`,
`getGuestLinkEventId` and `inviteToEvent` keep their signatures and now answer, in the mock, what
MIR-15's SQL answers in Org public. After this ticket the mock is no looser than SQL on the `public`
disjunct; it remains unable to represent a dedicated org's events (§ 1).

## 6. Schema delta

`none` — confirmed. The mock and its tests only; no migration, policy, trigger or function changes.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/data/mock.ts"
  - "tests/events.test.ts"
  - "tests/member-directory-scope.test.ts"
  - "tests/event-attendance.test.ts"
  - "tests/notifications.test.ts"
  - "tests/event-email.test.ts"
  - "tests/event-invitation.test.ts"
  - "tests/guest-link.test.ts"
  - "tests/guest-registration.test.ts"
  - "tests/event-layer.test.ts"
  - "tests/e2e/evt-02-attendance.spec.ts"
```

`size: M` — 11 paths. `size_estimate` and `size` agree at M. The ticket's `mir_detail` and ADR-076
decision 6 counted "11 test files plus mock.ts — 12 paths"; the list it gives is ten test files, so
the real count is 11, and the census at PLAN found no eleventh. The one path the ticket offered to add
(`EventAttendancePanel.tsx`) would bring three more with it, and goes to a follow-up (§ 1).

`glossary_owed` is `[]`; no row is written.

## 8. Rejected alternatives

- **Reproduce the full predicate, dedicated branch included** — give `CalEvent` rows in the mock an
  org (the creator's `mockOrgOf` at creation) and write `event.scope === "public" && (orgOf(event) ===
  "dedicated" || event.teamId === mine)`. Genuinely closer to SQL, and MIR-15-e's dedicated-org set
  makes it look one line away. Rejected: the mock's events are not org-bound at all (MIR-13-b's
  `org_id = member_org_id(uid)` conjunct was never reproduced), so a dedicated-org `public` event
  would reach every Org public member in the mock — a half-modelled org that is looser than SQL in a
  new way and invites tests that assert the dedicated branch against a mock that cannot hold it. Org on
  events is a mock ticket of its own.
- **Make the join affordance follow, `case "public": return me.teamId === event.teamId`.** One line in
  `EventAttendancePanel.tsx`, the 12th path, the ceiling. Rejected: since MIR-15-c a dedicated org can
  have members, and there the line hides a join the server allows. A correct version needs the shared
  flag in the component (§ 1).
- **Keep the cross-team tests, and seed the other-team member as a named invitee wherever they join.**
  Preserves every "any team" title literally. Rejected as the default: for seat-fillers and requesters
  the other team was incidental, and dressing each as a named invitee tests the named branch twenty
  times while hiding that the `public` branch changed. Used only where the cross-team point is the
  block's subject (§ 4.2: directory (d), (e); attendance AC-16).

## Changelog

- `2026-11-11T07:50:00Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from `ticket.yaml`, MIR-15's plan and ADR-076 before `mock.ts` and the tests were read; two
  amendments followed from reading them, below.
- `2026-11-11T07:50:00Z` — § 1, § 2: MIR-15's dedicated-org ACs (AC-3, -5, -7, -13) and Carol (two
  teams) dropped from the mock's AC set, because `CalEvent` has no org and `memberTeamId` one team;
  they stay asserted in SQL. Reason: reading `mock.ts:536-575`, `:1388-1390`. Amended by
  `tech-lead-design`.
- `2026-11-11T07:50:00Z` — § 2 AC-10 added. Reading `emailInvitation` (`mock.ts:1229-1245`) and its SQL
  (`20261014090000_evt12_invite_every_scope.sql:237-241`) showed that since MIR-15 an other-team
  member's address on a `public` event is reported `sent` and reaches nobody; `tests/event-invitation.test.ts:396`
  asserts the opposite. Transcribed, not decided; the decision is for `/idea`. Amended by
  `tech-lead-design`.
