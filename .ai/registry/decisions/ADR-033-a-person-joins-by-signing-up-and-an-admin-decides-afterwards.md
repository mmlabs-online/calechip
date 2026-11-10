---
doc_version: 3
last_updated: 2026-09-10
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-033 — A person joins by signing up; an admin decides afterwards

## Status

`ACCEPTED by the operator` — 2026-09-10. **Supersedes [ADR-009](ADR-009-how-a-person-becomes-a-member.md).**

Recorded, not authored. The operator gave this decision in words on 2026-09-10 and handed back the
text of §§ *Context*, *Decision* and *Consequences* below; those three sections are theirs and are
reproduced rather than improved. § *Rationale* and § *Revert condition* are written here — the
template requires both, and each is grounded in a choice already on disk, cited where it is.

The `solo` run that implemented this could not write `.ai/registry/**` (RULE-01) and said so in the
migration it left behind — `supabase/migrations/20260910100000_solo_member_approval.sql:4-11`, which
states in terms that the file *"must not be applied before it exists"*. This is that file. Reviewed
at merge under CODEOWNERS, like every registry change.

## Context

ADR-009 made the allow-list the gate: an admin typed an address, and a trigger on `auth.users`
created a `member` row only for a listed address. The operator's instruction of 2026-09-10 reverses
the ORDER while keeping everything ADR-009 decided about the mechanism — still `signUp` on the
ordinary client, still no server, still no service-role key. ADR-005 is untouched.

## Decision

Everybody who signs up gets a `member` row immediately, with no team and `status = 'pending'`. An
admin approves or rejects them from `/signups`, and an approval writes the admin's own team.

`public.member_team_id` gains `and m.status = 'approved'`. That single function is what every
row-level policy in the product is keyed on, so an undecided member is refused by all of them at
once. `public.allowed_email` is dropped.

## Rationale

**The alternative was to change the screen and keep the table.** The `solo` run offered three depths
— the sign-up screen only, the screen and the seam, or the screen, the seam and the table — and the
operator took the deepest (`supabase/migrations/20260910100000_solo_member_approval.sql:153-155`).
Keeping `allowed_email` alongside a `status` column would have cost a second gate that answers the
same question: an address could be listed and its member rejected, or unlisted and approved, and
nothing in the schema says which one wins. Two gates on one door is the drift ADR-009 itself avoided
by making the trigger — not the interface — the enforcement point.

**Gating `member_team_id` rather than each policy was the choice that made this cheap.** Every
row-level policy in the product resolves through that one function, so one `and m.status =
'approved'` closes all of them together and no policy below TEA-01 changes
(`supabase/migrations/20260910100000_solo_member_approval.sql:13-18`). The alternative — a `status`
predicate repeated in each policy — is a dozen places to keep in agreement, where the first one
missed is a stranger reading the team's calendar.

**What this costs against ADR-009 is the closed door.** Under the allow-list, a person who was not
vouched for got an auth user and nothing else. Now they get a row, and the product's defence is that
the row grants nothing until an admin acts. That is a stronger dependency on one SQL clause than
ADR-009 had, and it is why the revert condition below is written against that clause.

## Consequences

- `member.team_id` becomes nullable. INV-07 is unaffected: a member with no team has no entries.
- With more than one team, every admin sees every pending sign-up and may claim one for their own
  team. v1 has one team; this is the first thing to revisit if a second is created.
- Dropping `allowed_email` destroys its rows and is not reversible.
- `.ai/standards/data-model.md` and `.ai/standards/rbac-and-security.md` must lose the
  `allowed_email` table and its three permission rows.

**Three further consequences, recorded here rather than left to be discovered:**

- **`TEA-02 — Manage the allow-list` is retired.** It shipped (`.ai/registry/features.md:129`) and
  this decision removes the table, the three policies and the screen it built. The row is annotated,
  not deleted — a shipped feature that was reversed is part of the record.
- **ADR-030's bootstrap admin still works and is now the only path that writes `role = 'admin'`.**
  The trigger hard-codes `'member'` and never reads `raw_user_meta_data`
  (`supabase/migrations/20260910100000_solo_member_approval.sql:100-105`), which mattered under
  ADR-009 and matters more here, because the caller is no longer somebody an admin vouched for
  before they arrived.
- **A rejected admin stops being an admin.** `is_admin` takes the same `status = 'approved'` clause,
  so the two functions cannot disagree about who is admitted.

## Revert condition

**The observable signal is any read or write reaching team data from a member whose `status` is not
`'approved'`.** One occurrence retires this decision: the correction is not a patch to a policy but a
return to ADR-009's shape, where the door is closed before the row exists rather than after. The
`status = 'approved'` clause in `member_team_id` is the whole of the defence, and a defence that has
been observed to fail once has no second layer behind it here.

**The secondary condition is about the queue rather than the security.** If pending sign-ups
accumulate unanswered — a person waiting more than a working week for a decision, on a team of five
to thirty where the admin sits beside them — the gate has moved from an address an admin types to a
screen an admin forgets, which is the failure ADR-009's allow-list did not have. The correction there
is a notification, not a revert.

## Affected documents

| File | Change | `doc_version` moves to |
|---|---|---|
| `.ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md` | `Status` becomes `SUPERSEDED by ADR-033`; the body is not edited | **3** |
| `.ai/standards/data-model.md` | The `allowed_email` entity removed; `member` gains `status` and `team_id` becomes nullable; open question 4's answer rewritten | **6** |
| `.ai/standards/rbac-and-security.md` | The three allow-list rows replaced by the two sign-up decision rows; the allow-list paragraph rewritten | **3** |
| `.ai/registry/features.md` | The `TEA-02` row annotated as retired by this ADR | **unchanged** — feature-row edits do not move it, the precedent set at ADR-032 |
| `.ai/registry/invariants.md` | **Deliberately absent.** INV-07 is unaffected — a member with no team has no entries, and the invariant constrains entries | unchanged |
