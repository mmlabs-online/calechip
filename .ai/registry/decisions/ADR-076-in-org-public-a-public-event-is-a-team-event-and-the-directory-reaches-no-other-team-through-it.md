---
doc_version: 3
last_updated: 2026-11-05
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-076 — In Org public a `public` event reaches only its own team, its notification follows it, and the directory reaches no other team through it; MIR-15 splits into four

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-05 — at `/plan` for MIR-15 (ADR-008, ADR-067).

**It narrows two accepted decisions inside Org public only**, which is why it is delegated rather
than authored freely: [ADR-045](ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md)
decision 3 (*Q4: a `public` event is read by every approved member of every team*) and
[ADR-066](ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md)
decision 2 (the directory's disjuncts (c)–(e) reach anyone who shares an event with the caller).
Both narrowings are what [ADR-059](ADR-059-calechip-becomes-multi-tenant-system-org-team.md)
decision 2 already says — *"Org public … with every org-wide visibility feature disabled"* — so this
ADR fixes the shape, not the direction. In a dedicated org (`is_shared_tenant = false`) neither
ADR-045 nor ADR-066 changes.

## Context

- **Feature MIR-15** (`.ai/registry/features.md:304`), plan item P3-6
  (`.ai/board/plans/calechip-multi-tenancy-plan.md:206-211`): five bullets — the directory, the
  reach of a `public` event, `notify_event_created`, Org public's holidays, and moving a team to
  another org.
- **Every team and member today is in Org public** (MIR-12,
  `supabase/migrations/20261031120000_mir12_backfill_org_public.sql`). The rule below therefore
  applies to all of today's data, and to every fixture of the mock seam, which models one tenant.
- **MIR-13-b bounded every one of these reads by org and left Org public's own reach to MIR-15**
  (`supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:605`,
  `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:64-96`, `:166-187`, `:264-299`).
- **Glossary, *Org public*** (`.ai/registry/glossary.md:64`): *"every cross-team or org-wide
  visibility surface (member directory, `public`-scope events and event notifications) stays within a
  single team when `is_shared_tenant = true` (MIR-15)"*.

## Decision

1. **In an org with `is_shared_tenant = true`, an event with `scope = 'public'` is read and joined as
   an event with `scope = 'team'` is.** The `scope = 'public'` disjunct of `may_read_event`,
   `event_select_visible` and `is_event_audience` admits a caller only when `event.team_id` is one of
   `member_team_ids(caller)`, or the event's org is not shared. Every other disjunct — admin, creator,
   named invitee, participant — is unchanged. `scope` itself is not rewritten: the stored value stays
   `public`, so an event's guest link, its email invitations (EVT-08, EVT-12's public branch) and the
   creator's choice all survive, and the event regains its full reach if its team is moved to a
   dedicated org (MIR-15-c).
2. **`notify_event_created` follows decision 1.** In a shared org a `public` event notifies the
   members of `event.team_id` and nobody else — the same recipients as a `team` event.
3. **`list_member_directory()` is not given a fourth special case; decision 1 is what fences it.**
   Its disjuncts (c) and (d) read through `may_read_event`, so once a `public` event stops reaching
   other teams, its creator and its attendees stop reaching other teams' directories. **What remains
   cross-team in Org public is exactly a named invitation and the notification it carries** (ADR-066
   (c), (e)) — a person deliberately naming another person, which the operator decided in EVT-01 Q5
   (*"Bất kỳ team nào"*, `.ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md:95`) and which this ADR does not revisit.
4. **The admin disjunct is unchanged in all three.** An `is_admin` caller of Org public still reads
   every event and every member of Org public (ADR-040, ADR-045 decision 5, ADR-066 (a)). Who
   administers Org public is the role split's (MIR-16, ADR-059 decision 2), not this ADR's.
5. **One predicate, written once.** `public.org_is_shared(p_org_id uuid) returns boolean` answers
   the shared flag; each of the four objects above calls it rather than repeating the subquery, so a
   later Org public special case (plan:324) has one place to read it from.
6. **Delivery is split four ways** (`.ai/01-operating-model.md` § Sizing). **MIR-15** ships
   decisions 1, 2 and 5 in the database — one migration, its pgTAP test, the two catalogue and
   read-path suites it touches — and the scope label in the two screens that print it. **MIR-15-d**
   transcribes the same predicate into the mock seam and changes the eleven seam and e2e test files
   that assert today's cross-team reach; between the two, the mock is looser than SQL on this one
   predicate, and only on it. The split is by surface because the fence itself cannot be split by
   operation: narrowing the read without the join would let a member join an event they cannot read.
   **MIR-15-b** ships Org public's holidays (plan:209, ADR-070 § 4) — the write policies, the read
   bound, and the panel screen. **MIR-15-c** ships moving a team to another org (plan:210), whose
   open questions are listed in its `ticket.yaml`. MIR-15's feature row stays `PLANNED` until all
   four ship.

## Options considered

- **Rewrite `scope` to `team` for every `public` event in Org public, and refuse `public` on save.**
  Rejected. It loses the creator's choice irreversibly, breaks every guest link and email invitation
  on those events (EVT-06, EVT-08 read `scope = 'public'`), and a team moved to a dedicated org would
  arrive with its public events demoted.
- **Strip the directory to (a) and (b) in a shared org — own teams only, nothing through events.**
  Rejected. A named invitation across teams remains possible (decision 3), and its invitee would then
  read an event whose creator has no name, and the creator an attendee list with a nameless row. The
  directory would be stricter than the events it exists to label.
- **Also bound named invitations and `invite_to_event`'s member branch to the creator's teams in
  Org public.** Not taken here. It reverses an operator answer (EVT-01 Q5) rather than an
  `is_shared_tenant` reading, and no source names it. It is the next Org public special case the plan
  predicts (plan:324), recorded for `/idea`.

## Consequences

- **EVT-01 is superseded and EVT-02, EVT-04 changed in Org public** (`.ai/board/tickets/MIR-15/ticket.yaml`
  `expected_impact`). The event editor's description of the `public` scope must stop saying it reaches
  every team.
- **A cross-team `public` event created before this migration** stops being readable by members of
  other teams who neither attend it nor were invited. A member of another team who already attends
  keeps reading it (the participant disjunct) and may withdraw, but cannot re-join after withdrawing.
  A notification already delivered stays readable by its recipient (`notification_select_own`); the
  event it names may no longer open.
- **`scope = 'public'` now means two things depending on the org.** The glossary row *Org public*
  already says so; no new term is owed.

## Revert condition

A member of Org public reads, joins, or is notified of a `public` event of a team they are not on,
without being its creator, an admin, a named invitee or a participant. Or a dedicated org's `public`
event stops reaching one of that org's teams.
