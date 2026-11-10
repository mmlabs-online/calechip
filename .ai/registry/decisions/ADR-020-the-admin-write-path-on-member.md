---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-01, RULE-09]
---

# ADR-020 — The admin write path on `member`, and ADR-018 point 3 narrowed

## Status

`ACCEPTED by the operator` — 2026-09-01.

Recorded, not authored. The question below was put to the operator as two options; they answered
*"chọn A"* — narrow ADR-018 point 3, admit a column-limited `update` under three conditions.

**It was put to them rather than decided, and that was the whole point.** This ADR amends the Decision
of ADR-018, which is accepted, and ADR-008 makes that a stop-and-ask rather than a judgement call.
The aggravating fact was whose clause it is: the steward wrote ADR-018 the day before and would
otherwise have been deleting the sentence blocking the ticket in front of it. Being confident the
sentence was wrong is not a reason to be the one who deletes it.

## Context

TEA-04 fails Definition of Ready item 4. Its `schema_delta` is not `none` — ADR-014, no carve-out —
and no ADR exists to link.

**The permissions are settled and none of them move.** `.ai/standards/rbac-and-security.md` carries
*Remove a member* ✅ for admin, *Promote a member to admin* ✅ for admin, and *Demote an admin to
member* ❌ for both, marked *not decided — denied until it is*. All were decided by the operator on
2026-08-31. TEA-04 adds one narrowing (an admin may not remove themselves) and one application of
ADR-013 (`removed_at` is the server's clock, not the caller's). Both are inside the envelope.

**The blocker is a sentence I wrote.** ADR-018, Decision point 3, verbatim:

> **No insert, update or delete policy is added, now or by any later ticket.** Restated here because
> this is the ticket that opens this table's `select`, and the specific risk of widening a read is
> that a write is dragged along with it.

TEA-04's plan adds `member_update_admin`, an `update` policy on `public.member`. Point 3 forbids it in
terms.

**The plan does not know this.** It cites ADR-018 §Decision 3 four times and each time paraphrases it
as forbidding an *insert* policy, or *insert or delete* — `01-plan.md:165`, `:296`, `:544`, and the
`schema_delta` field in `ticket.yaml`. The word `update` is in the clause and is missing from every
citation of it. The Tech Lead was not evading the constraint; it read the clause as the narrower thing
TEA-01's design says, which is about `insert` alone and for a reason specific to `insert`.

## Decision — proposed, in two halves

### Half one: ADR-018 Decision point 3 is narrowed

From *"No insert, update or delete policy is added, now or by any later ticket"* to:

> **No insert or delete policy is added to `public.member`, now or by any later ticket.** An `update`
> policy is admissible only when all three of these hold together: the `update` privilege is granted
> **by column** and never blanket; the policy is scoped to an admin of the caller's own team; and a
> `BEFORE UPDATE` trigger enforces every constraint that `WITH CHECK` structurally cannot express.

`insert` and `delete` stay permanent, and they keep the reason TEA-01 gave them, which is real and
specific: the admission trigger is the only creator of a `member` row, and any insert policy a
signed-in person can satisfy lets them choose their own `team_id` and their own `role`. A `delete`
is refused by `on delete restrict` and would destroy the `removed_at` that ADR-013 requires.

### Half two: what TEA-04 may add

Four objects in one new migration under `supabase/migrations/`, altering no table:

1. `grant update (role, removed_at) on public.member to authenticated` — **column-level, never
   blanket.** This is what withholds `id`, `team_id`, `display_name`, `avatar` and `created_at` from
   everybody, admin included. The privilege is withheld rather than predicated, which is the shape
   `rbac-and-security.md` known weakness 6 says works on `team` and does not work on `entry`; it works
   here for the same reason it works on `team` — *nobody* may write those columns, so no predicate has
   to distinguish who.
2. `member_update_admin`, `for update to authenticated`, `using` an admin of the caller's own team,
   with a `with check` on `team_id`. The `with check` is redundant while `team_id` is ungranted and is
   kept as the second lock.
3. `public.member_enforce_role_and_removal()`, `security invoker`, refusing demotion, refusing the
   promotion of a removed member, refusing a removal being undone or re-dated, refusing an admin
   removing themselves, and overwriting a caller-supplied `removed_at` with `now()`.
4. The `BEFORE UPDATE` trigger of the same name.

No `alter table`, no column, no `drop policy`, no insert or delete policy, no blanket grant. Applying
the migration is human — RULE-09.

## Rationale

**Point 3 was over-broad, and the way it was over-broad is instructive.** ADR-018 answers *who may
read the member list*. Its point 3 legislates on writes, permanently, for every future ticket, in a
document nobody would think to consult when designing a write. It took TEA-01's reasoning about
`insert` — an insert policy lets a person choose their own `team_id` and `role` — and extended it to
`update` and `delete` without saying why, because no `update` was in front of me to test it against.
The reasoning does not transfer: a **column-limited** `update` that withholds `team_id` and `role`'s
downward direction cannot do the thing the `insert` argument is about.

**But the clause was not merely noise, and the narrowing keeps what was right in it.** The risk it
named — a read being widened and a write dragged along with it — is real, and the three conditions
above are what make an `update` safe rather than a licence to add one. A future ticket that wants a
blanket `grant update` still runs into this ADR.

**The plan's own rejected alternatives were rejected correctly, and two of them matter here.** A
blanket grant with the policy as the only control fails because `WITH CHECK` sees only the new row and
cannot say *this column did not change*, so an admin's `PATCH {"team_id": …}` passes every predicate
and INV-07 is gone silently. A `security definer` function — `remove_member(uuid)` — was the obvious
way to keep point 3 intact without amending anything, and it was rejected on ADR-005: it moves
authorization out of row-level security into a function body, which is the whole model bypassed by
design. ADR-016 §4 already drew that exact line, allowing a bulk operation to become a function only
on condition that it stayed `security invoker` so the policy still ran.

**That is the finding worth stating: the only shape that satisfies point 3 as written is the one shape
ADR-005 forbids.** A constraint that leaves no compliant implementation is not a constraint, it is a
deadlock, and it is why this is a narrowing rather than an exception.

**Rejected: an exception for TEA-04 alone**, leaving point 3 otherwise intact. It reads as more
conservative and is less so — the next write ticket arrives at the same wall and either gets its own
exception or argues from TEA-04's. A rule with a growing list of exceptions has no readers left.

## Consequences

- **`public.member` gains an `update` verb for the first time.** Nothing about the table is
  append-only after this, and AC-7 — no role may write any other column — is the criterion holding the
  line. It is held by a withheld privilege rather than by a predicate, which is the stronger of the
  two.
- **Two invariants sit downstream of one trigger.** INV-04's denominator is the team's members with
  `removed_at` null, and INV-07 is the team boundary. A defect in
  `member_enforce_role_and_removal()` changes numbers no screen recomputes.
- **A `security definer` write path on `member` remains out of the question**, and this ADR does not
  open one. Only the admission trigger from TEA-01 holds that privilege.
- **ADR-018 gets an amendment note.** Its Decision changes; its Status stays `ACCEPTED`, because the
  read decision it exists for is untouched.
- **TEA-04's plan cites the old wording four times.** Those citations become correct by this
  amendment rather than by an edit to the plan, and the plan's `schema_delta` field should be
  re-read once this is accepted — it currently paraphrases a clause that will have changed.

## Revert condition

**Any `member` row observed with a changed `team_id`, `display_name`, `avatar`, `id` or `created_at`.**
One occurrence. Those columns are ungranted, so a change to any of them means the grant, the policy or
the trigger is not doing what this ADR says, and the failure mode is silent — a moved `team_id` breaks
INV-07 and INV-04's denominator with no error anywhere.

**On revert:** drop `member_update_admin` and the grant, leave the trigger, and restore ADR-018 point
3 to its original wording. The removal and promotion controls go dark; nothing already written is
undone, because removal is one-way by the trigger.

A second signal, slower: **a second ticket asking to widen the column grant.** Two would mean the
column-level grant is being used as a starting position to negotiate from rather than as the control,
and this ADR should be superseded by one that decides the whole write surface of `member` at once.

## The question, and the answer

**May ADR-018 Decision point 3 be narrowed as *Half one* above, so TEA-04 can proceed?**

- **A — narrow it.** `insert` and `delete` stay permanent; `update` is admissible under the three
  conditions together.
- **B — leave point 3 as written.** Per the Rationale that leaves TEA-04 with no implementation
  satisfying both it and ADR-005, and returns the ticket to PLAN with the escalation that follows.

**The operator chose A, 2026-09-01.** Kept here rather than deleted on acceptance: the alternative
that was refused, and the fact that a person refused it, is what the `Status` line above rests on.

## Affected documents

| File | Change |
|---|---|
| `.ai/registry/decisions/ADR-018-who-may-read-the-member-list.md` | **Done 2026-09-01.** Decision point 3 replaced with the wording in *Half one*, the original wording kept beside it, `doc_version` 3 |
| `.ai/board/tickets/TEA-04/ticket.yaml` | `schema_delta` re-read and this ADR linked. Written by `orchestrator` at the READY transition |
