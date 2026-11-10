---
doc_version: 3
last_updated: 2026-09-29
governed_by: [RULE-01, RULE-09]
---

# ADR-045 — Charter refusals 4 and 5 are removed; a member may announce an event and others join it, across teams

## Status

`ACCEPTED by the operator` — 2026-09-29, in words, at `/idea` of
`.ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md` § *Evidence*.
Drafted by `product` at `/triage` of that file.

**Decision 2 amended 2026-10-08 by [ADR-049](ADR-049-events-are-drawn-on-the-week-and-month-grids.md)**, `ACCEPTED by the operator`: events are drawn on the week and month grids as their own layer, and still never counted. Decision 2's text below is left as written.

**Decision 6 amended 2026-10-08 by [ADR-051](ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md)**, `ACCEPTED by the operator`: event email is sent by a server-side component that authorizes nothing. Decision 6's text below is left as written.

**Decision 3 overridden for an event opened to guests, 2026-10-08, by [ADR-052](ADR-052-an-event-can-be-opened-to-guests-without-an-account.md)**, `ACCEPTED by the operator`: anyone holding its unguessable link reads it and its attendee names, whatever its scope. Every other event is unchanged. Decision 3's text below is left as written.

**The picker clause of Decision 3 SUPERSEDED 2026-10-20 by [ADR-066](ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md)**, `ACCEPTED by the operator` at `/plan MIR-04`: a non-admin creator chooses named invitees from their own team, and the member directory returns their own team plus the people an event or a notification already connects them to. Every other clause of Decision 3 stands, and its text below is left as written.

**Recorded, not authored.** The operator was shown both refusals by number and text and offered three
options — remove #4 and #5, a narrow amendment opening only a separate event concept, or keep the
charter. The question and the answer, verbatim from Q1:

> *"Request này đụng thẳng hai điều charter từ chối: #4 'never model group activity — everyone
> registers independently' và #5 'never a booking tool — no invitations' (.ai/00-charter.md). Event +
> mời + bấm tham gia chính là hai thứ đó. Anh chọn hướng nào?"*
>
> **"Gỡ #4 và #5"**

The cross-team exposure in *Decision* point 3 is likewise the operator's, from three answers in the
same file, verbatim: Q4 *"Mọi member mọi team"*, Q5 *"Bất kỳ team nào"*, Q8 *"Ai thấy event thì
thấy"*. What is **not** theirs, and is marked where it appears, is the fence in point 4 — how the
exposure is kept narrow — which is `product`'s, inside the envelope those answers open (ADR-008).

## Context

`.ai/00-charter.md:53-58` carries two refusals:

- **4.** *"It will never model group activity. Everyone registers independently. Whether people are
  travelling together is outside the system."*
- **5.** *"It will never be a booking tool. No reserving slots, no invitations, no negotiating a day
  with another person inside the app. This is an information board; the negotiating happens between
  people."*

The operator asked for the thing both refuse: *"Người dùng tạo event, người khác bấm tham gia; phạm vi
mời: một team, người cụ thể, hoặc public"*. The charter says a refusal *"can be removed, but only by
arguing with the reason beside it"*. The argument, as the idea states it: a gathering is organised in
chat, with the headcount and any cap kept by hand, and the operator has decided the product should
hold that.

Two further facts bear on it:

- **Every member-facing read today is team-scoped** through `public.member_team_id`. ADR-018 records
  the member list as own-team, and its revert condition is *"any read of `public.member` that returns
  a row belonging to a team the caller is not on"*. ADR-040 opened a cross-team read for **admins**
  only, by `security definer` functions testing `public.is_admin`.
- **The charter's *"Who uses it. One team of five to thirty people"* (`:30`) is already stale** —
  ADR-039 made the product many-team. This ADR does not repair that sentence; it records that the
  amendment below lands beside it.

## Decision

1. **Refusals 4 and 5 are removed from `.ai/00-charter.md`**, whole. Not carved: the narrower option
   (keep #5 for entries, open only a separate event concept) was offered and not chosen.
2. **An event is a new concept and not an entry.** It creates no entry, is not in the absence count,
   and is not drawn on the month, week or year grids (Q2 *"Không liên quan"*). INV-04, INV-05 and
   INV-07 are untouched by construction, and charter refusal 6 — a warning never blocks — is untouched.
3. **Members gain a cross-team read, bounded by the event.** An approved member of any team may read:
   an event whose scope is public (Q4); an event whose invite list names them (Q5, Q25); and the
   attendee list of any event they may read (Q8). To choose invitees, a creator may read the identity
   of approved members of every team (Q5). This is new information exposure — a member of team A
   learns who is on team B — and it is decided, not incidental.
4. **The fence** (`product`'s, not the operator's): the exposure is carried **without widening
   `member_select_team`** or any other select policy on `public.member`. ADR-018's revert condition
   stays live for the table itself. The invitee picker and the attendee list read a narrow projection
   — identity and display name, no `role`, no `removed_at`, no `team_id` beyond what the picker needs
   to group by team — through a dedicated read, in the shape ADR-040 used. The exact shape is
   `tech-lead-design`'s at `/plan`.
5. **Manager gains nothing** (Q9, Q24). Admin gains, on every event regardless of scope or team:
   read, edit, delete, decide a join request, remove an attendee (Q9, Q17, Q24).
6. **ADR-005 stands.** No server, no email (Q20). Authorization is row-level security.

## Rationale

**Rejected: keep the charter** — offered, not chosen. **Rejected: the narrow amendment** — offered,
not chosen; it would have left *"no invitations"* standing while the product ships invitations,
which is the charter contradicting the product on the day it merges.

**Rejected, for point 4: widening `member_select_team` to every team.** It is the one-line version and
it is wrong for a reason already written down: the 2026-09-11 migration header and ADR-018 both show
that `listMembers()` returns whatever the policy returns, and that list is INV-04's denominator. A
wider policy makes every team's roster count toward every team's overload arithmetic with no error
anywhere. A dedicated read cannot reach that function.

## Consequences

- **The product stops being purely an information board.** An event is a statement *to* other people
  that expects a response, which is what refusal 5 existed to keep out. The negotiation the charter
  kept *"between people"* now partly happens in the app.
- **The first cross-team read available to a non-admin.** Every future policy review has one more
  scope to keep in mind, and a definer function that loses its filter leaks names across every team.
  The permission test must assert the **denials**: a member not invited to a specific-people event
  cannot see it (Q25), a pending sign-up sees no public event (Q4), and a manager can decide no
  other person's join request (Q24).
- **Capacity is a cross-row rule that must hold under concurrency** (Q7, Q10, Q13): two approvals of
  the last seat, or an instant join racing an approval, must not exceed the cap. A read-then-write
  check does not hold it. Under ADR-005 the only places it can be held are the database's own
  mechanisms. **It is not issued as an invariant here** — recording an invariant needs the operator's
  words for it as an invariant, and `invariants.md` is not `product`'s to write. It becomes acceptance
  criteria at `/plan`, enforced in the database; the steward may later propose it for the ledger.
- **Glossary rows are owed** — `Event`, `Attendee`, `Invitation`, `Capacity` — with the word
  *Invitation* distinguished from the sign-up path ADR-033 describes, which the `TEA` group's
  expansion already calls *invitations*.
- **Email stays out.** Q21 records when mail would be sent; that is a later idea needing its own ADR
  against ADR-005.

## Revert condition

Either, one occurrence:

1. **A `public.member` read returns a row of another team to a non-admin** — ADR-018's condition,
   unchanged, now also watching this feature. On observation: revoke `execute` on the event reads;
   events go dark, entries are unaffected.
2. **An event's approved attendees exceed its capacity** in the running system or in a concurrency
   test. On observation: the capacity mechanism is wrong and the ticket that shipped it reopens as a
   `BUG-nnn`; this ADR stands.

The charter amendment itself reverts only by a later operator decision restoring the refusals, which
supersedes this ADR.

## Affected documents

| File | Change | `doc_version` |
|------|--------|---------------|
| `.ai/00-charter.md` | Refusals 4 and 5 removed, with the old wording kept beside an *Amended 2026-09-29 by ADR-045* note, as the Roles section already does | 2 → 3 |
| `.ai/standards/rbac-and-security.md` | Rows for create, read, edit, delete an event; request/join, withdraw, decide a request, remove an attendee; read the invitee picker. Manager column default denials | bump at the ticket |
| `.ai/registry/glossary.md` | `Event`, `Attendee`, `Invitation`, `Capacity` | glossary row write (ADR-007) |
| `.ai/standards/data-model.md` | The event and attendance tables | bump at the ticket |

The charter edit is not applied by this triage — `product` does not rewrite a file it did not create
in the run. It must land before or with the first event ticket: either `/thuki` applies it, or that
ticket's `allowed_paths` carries `.ai/00-charter.md`.
