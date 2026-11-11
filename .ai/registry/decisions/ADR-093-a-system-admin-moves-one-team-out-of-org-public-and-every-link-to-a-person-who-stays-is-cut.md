---
doc_version: 3
last_updated: 2026-11-11
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-093 — A system admin moves one team out of Org public into a dedicated org; its people and their rows go with it, every link to a person who stays is cut, and a link that records a decision refuses the move

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-11 — at `/plan` for MIR-15-c (ADR-008, ADR-067).

**This ADR narrows one accepted decision**, which is why it is written under ADR-067 rather than
ADR-008 alone: [ADR-070](ADR-070-the-org-and-multi-team-membership-schema.md) § 3 says *"leaving a
team sets `left_at := now()` … rather than deleting the row, preserving the historical membership
window required by INV-04"*. Decision 5 below deletes ended `membership` rows that would otherwise
span two orgs. It also changes ADR-070 § 4's nineteen composite foreign keys from non-deferrable to
`deferrable initially immediate` (decision 6), and adds one clause to two EVT trigger guards
(decision 7). It supplies the move ADR-074 decision 8 and ADR-075 § Context assign to MIR-15
(*"Move-team-between-orgs is MIR-15's"*), split to MIR-15-c by ADR-076 decision 6.

## Context

- **Plan item P3-6, last bullet** (`.ai/board/plans/calechip-multi-tenancy-plan.md:211`): *"Build
  "move a team to another org" in the system panel — needed the day a customer buys a licence"*.
  Plan:317: *"Org-to-org team transfer UI — Needed by Phase 3 for Org public; polish later"*.
- **ADR-059 decision 1:** *"A user belongs to exactly one org."* ADR-070 § 4 makes it structural:
  `member.id` is the primary key, `member.org_id` is not null, and every child row carries a
  composite foreign key `(parent_id, org_id) → parent (id, org_id)`. A row whose two parents sit in
  two orgs cannot exist.
- **The three questions MIR-15-c's `mir_detail` carries, which no source answers:** which
  membership survives for a person on the moved team and on another Org public team; which rows
  move and what happens to cross-team rows left behind; and whether a move is allowed only from Org
  public, and whether the target org's caps refuse it.
- **ADR-059 § Out of scope, items 3 and 4, and ADR-075 decision 6:** over-cap behaviour and member
  counting are deferred; caps are *"stored and shown; nothing enforces them"*.
- **ADR-077 decision 1:** a removed member's roster team is the team of the row their removal
  closed — a person with no active membership still belongs, for INV-04, to the team they left last.
- **The composite foreign keys are `NO ACTION` on update and not deferrable**
  (`supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:161-436`,
  `20261103210000_mir14_multi_team_decisions.sql:41-45`). Changing `org_id` on a team and on its
  rows is several statements, and each statement's end would see a parent and child in two orgs.
- **Two trigger guards refuse any update that is not a `status` transition:**
  `event_attendance_guard` and `event_guest_guard`
  (`20261009150000_evt07_guest_registration.sql`), so `org_id` on those rows cannot be rewritten
  today by anyone.
- **`entry_enforce_decision` refuses a change to `approved_by` by anyone who may not decide the
  entry** (`20261103210000_mir14_multi_team_decisions.sql`), and the system admin is never a member
  (`member_refuse_system_admin`, `20261104150000_mir18_system_admin.sql:74`). Its CAL-01 comment:
  *"Nulling `approved_by` would erase who approved."*

## Decision

1. **One team per move, from Org public only, into a dedicated org only.** `move_team_to_org`
   refuses (SQLSTATE `22023`) a team whose org is not the shared tenant and a target that is.
   Moving between two dedicated orgs, moving back into Org public, and moving several teams in one
   call are not built. The title of the ticket (*"from Org public to another org"*) is the scope.
2. **The caps of the target org do not refuse a move.** ADR-075 decision 6 and ADR-059 § Out of
   scope items 3–4. A move that takes an org over its `max_members` or `max_teams` succeeds.
3. **Who goes.** The *movers* are every member with an active membership on the team, plus every
   member with no active membership whose most recently ended membership row is on the team
   (ADR-077 decision 1, extended from removed members to every team-less one). Their `member` row
   moves, and with it every row they own: `membership`, `entry`, `busy_day`, `issue_report`, the
   `notification` rows they receive. `task` and `member_role_change` carry no `org_id` and need
   nothing. The team row moves, and with it every `event` whose `team_id` is the team, and that
   event's `event_invitee`, `event_attendance`, `event_guest_link` and `event_guest` rows. `role`,
   `status`, `role_in_team`, `is_primary` and every team setting are carried unchanged. Nothing is
   re-dated, and no row is inserted.
4. **A link that records a decision or an authorship refuses the move.** Each refusal names who or
   what is in the way in the error's `detail`, and changes nothing:
   - `MT001` — a mover also holds an active membership on another team (the first question: neither
     membership is silently ended; an org admin of Org public ends one first);
   - `MT002` — an event whose team and whose creator would land in different orgs;
   - `MT003` — an entry whose owner and whose `approved_by` or `rejected_by` would land in different
     orgs (nulling the decider is what CAL-01 refused, and `entry_enforce_decision` refuses it too);
   - `MT004` — a member who stays has an entry whose `primary_team_id` is the moved team and holds no
     other team to re-point it at.
5. **A link that is only a connection is cut.** In Org public, before anything moves: every
   `notification` whose recipient and actor, or recipient and event, would land in different orgs;
   every `event_invitee` and `event_attendance` whose member and event would; and every **ended**
   `membership` row that joins a mover to a team that stays or a member who stays to the moved team
   — **deleted**. This is the narrowing of ADR-070 § 3. The rows cannot stay (the composite keys
   refuse them) and cannot move (their other parent stays); the entries they would have counted
   leave or stay with their owner, so the deleted window would have counted nothing the reader can
   still see. `entry.primary_team_id` is re-pointed, not deleted: a mover's entry to the moved team,
   a stayer's to their active primary team, or for a team-less stayer to the team they left last.
   The function returns how many rows it deleted.
6. **The nineteen composite foreign keys become `deferrable initially immediate`.** Nothing that
   does not ask changes: every other statement still checks at its own end. `move_team_to_org`
   alone runs `set constraints … deferred` over those nineteen, writes, then `set constraints …
   immediate`, so a row the design missed fails the call inside the function rather than at commit.
7. **`event_attendance_guard` and `event_guest_guard` let an update that changes `org_id` and
   nothing else through**, as their first clause. The column grants on both tables are `status` only
   (`evt02:407`, `evt07:483`) and the composite keys allow only the event's own org, so no caller
   gains a write.
8. **`list_shared_teams()` and `move_team_to_org(uuid, uuid)`**, each `security definer`, each
   refusing with `42501` unless `public.is_system_admin()` (ADR-074 decision 4), executable by
   `authenticated` only. The panel lists Org public's teams and moves one; nothing else in the panel
   reads team data.

## Options considered

- **Cut every cross-org link, decisions included: null `approved_by` / `rejected_by`, delete the
  straddling event.** One rule, never refuses. Rejected: it erases the only audit trail of a
  decision (CAL-01, ADR-016 § 1) and deletes an event other people attend, and it would need a third
  trigger change to get past `entry_enforce_decision`.
- **Refuse on every cross-org link, connections included.** Nothing is ever deleted. Rejected: before
  MIR-15 every `public` event notified every team, so nearly every team of today has a cross-team
  notification or attendance nobody in the app can remove. The move would refuse for every existing
  team and for any team that ever joined a named event across teams.
- **One statement with a data-modifying CTE per table, so the `NO ACTION` keys are checked once at
  the end.** No constraint change. Rejected: correctness rests on when PostgreSQL fires queued
  referential triggers for sub-statements, which no test in this repository can name, and a
  fourteen-CTE statement is the hardest thing in the migration to review.
- **`on update cascade` on the composite keys.** Rejected: a cascade from `team` reaches `entry`
  through `primary_team_id` while `entry`'s member key still points at the old org, so the order of
  cascades decides success; and every future team write would cascade silently.
- **Copy the team's rows into the target org under new ids and delete the originals.** Rejected:
  every insert trigger fires — `notify_event_created`, `entry_apply_approval_setting`,
  `event_attendance_guard`'s registration and capacity checks — and every id a link or a bookmark
  holds changes.

## Consequences

- **INV-04: past absence counts change for exactly the people cut apart.** A team that stays loses
  a mover's past entries on dates the mover was on it; the moved team loses a stayer's. Each count
  is still taken by the one definition, over the membership rows that exist. Entries' `status`,
  dates, portion and decision columns are not written, so INV-01, INV-02, INV-03, INV-05 and INV-06
  are not reached.
- **The moved team reads its new org's holidays** (ADR-079 decision 3) and its `public` events
  regain their org-wide reach (ADR-076 decision 1, *"regains its full reach if its team is moved to
  a dedicated org"*).
- **A mover who was an `org_admin` of Org public is an `org_admin` of the target org after the
  move**, because `member.role` is carried unchanged. Appointing a dedicated org's first org admin
  is not built anywhere; a move does not solve it and does not try to.
- **There is no undo in the panel.** Moving back is decision 1's refusal. A mistaken move is
  corrected by a person in the database, as ADR-075 decision 2 leaves a mistaken org.
- `supabase/tests/010-catalogue.test.sql`'s definer census gains the two RPCs.
- `.ai/standards/data-model.md`'s composite-key paragraph and `.ai/standards/rbac-and-security.md`'s
  system-admin rows are human-owned and are not edited by MIR-15-c; both still describe the keys as
  ADR-070 wrote them.

## Revert condition

The operator decides that a move must also run between dedicated orgs, take several teams at once,
enforce caps, or keep the history this ADR deletes. Each supersedes the decision it names; the
deferrable keys and the guard clause can stay, since nothing but this function defers them.
