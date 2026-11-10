---
doc_version: 3
last_updated: 2026-10-13
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-035 — A third role, `manager`, decides entries and nothing else

## Status

`ACCEPTED by the operator` — 2026-09-12.

**Decision 3 superseded 2026-10-13 by [ADR-059](ADR-059-calechip-becomes-multi-tenant-system-org-team.md)**, `ACCEPTED by the operator`: a manager may approve their own entry, recorded as `self_approved = true` — verbatim, *"Bỏ cấm, cho phép tự duyệt đơn của bản thân"*. It takes effect when MIR-14 ships. Until then the deployed product enforces decision 3 as written. Decision 3's text, and the consequence that follows from it, are left below as written.

Recorded, not authored. The operator's instruction, verbatim: *"Thêm 1 role manager cho user, thêm
quyền approve cho user với quyền manager."* — add a manager role, and give the approve permission to
a user holding it.

**That sentence decides ONE cell of a nineteen-row permission table, and this document does not
invent the other eighteen.** They are denied, under the convention the table already carries in
writing: *"a denial that turns out to be wrong surfaces as a blocked story, which is cheap; a
permission that turns out to be wrong surfaces as data somebody should not have touched."* Each one
is marked in `.ai/standards/rbac-and-security.md` as denied-until-decided rather than as decided, so
a reader can tell the operator's sentence from its consequences.

## Context

**The charter says two roles, in terms, and this is the first change that makes that false.**
`.ai/00-charter.md` § *Roles* opens *"Two, and the difference is narrow on purpose"*;
`.ai/standards/rbac-and-security.md` § *Roles* says *"There is no third rank, no owner, and no
billing role"* and names the charter as the authority. Neither can stay as written, which is why an
instruction that sounds like a feature needs an ADR: it is an amendment to what the product IS.

**The power being delegated is the one the glossary uses to define `Admin`.** *"A member who can
also approve and reject, maintain the holiday calendar, invite people, and set the threshold."*
Taking the first of four away from that definition is what creates a rank between the two.

**Where approval is actually enforced, verified on disk rather than recalled.** It is NOT the update
policy. `entry_update_admin` (`supabase/db.sql:856-865`) admits the ROW; the decision itself is
guarded inside `public.entry_enforce_decision()` (`:467-487`), which raises `42501` when any of
`status`, `rejection_reason`, `approved_by` or `approved_at` moves and the caller fails
`public.is_admin`. That trigger's own comment records why it cannot be a policy — a `with check`
sees only the NEW row, so *"`status` did not change"* is not expressible — and why it cannot be a
column grant: **`member` and `admin` are the same PostgreSQL role, `authenticated`**, so a grant
revoked from one is revoked from both. The same sentence now binds `manager`, and it is the whole
reason § *Decision* item 4 is shaped the way it is.

## Decision

**`manager` is rank 2, between `member` and `admin`, and it adds exactly one power to `member`:
approving or rejecting ANOTHER member's entry on its own team.** Everything else a manager may do is
what a member may do.

1. `public.member_role` gains the value `manager`. The rank order becomes `member` < `manager` <
   `admin`.
2. **`public.is_admin` does not change and must not.** It keeps meaning `role = 'admin'` exactly, so
   the holiday calendar, the threshold, the member list, the sign-up queue, the team list and the
   edit-and-delete-anybody's-entry power stay where they are by construction rather than by review.
   A new helper, `public.may_decide(uuid)`, is what widens — approved, not removed, and
   `role in ('admin','manager')`.
3. **A manager may not decide their OWN entry.** An admin may (charter, amended 2026-08-31); that
   row was decided for `admin` and for nothing else, and extending it here would be a second
   decision the operator did not make. Denied until decided.
4. **A manager may change ONLY the four decision columns on somebody else's entry**, and this is
   enforced in the trigger rather than in the policy for the reason § *Context* names. The check is
   a masked comparison of the whole row — `to_jsonb(new) - <decision columns> is distinct from
   to_jsonb(old) - <decision columns>` — so a column added to `entry` later is covered on the day it
   is added rather than on the day somebody remembers this document.
5. **A manager's route to the decision is `/entries/pending` and only that.** The admin tab strip
   renders for them carrying that one tab. `/entries/team` stays admin-only: it is the edit-and-
   delete surface, which is item 2's list.
6. **An admin promotes and demotes a manager**, by the path that already promotes an admin.

## Rationale

**The alternative was to widen `entry_update_admin` to the new helper and stop there.** It is one
line, it passes an approve test, and it is wrong: that policy admits the whole row for update, so a
manager would silently acquire *edit or delete another member's entry* — the power the charter calls
the one that *"changes what the product is"*, because an entry stops being only its author's
statement. The trigger-side mask is more code and is the only place the distinction can live, since
both roles are one PostgreSQL role.

**The alternative to a third rank was a per-member `may_approve` flag.** Rejected because the rank is
what the model already compares — `.ai/standards/rbac-and-security.md` § *Roles* says in terms that
*"two unrelated role names are not comparable, two ranks are"* — and a boolean beside `role` is a
second, ungoverned dimension of authority that no policy, test or permission table is written
against.

## Consequences

- **`.ai/00-charter.md` § *Roles* and `.ai/standards/rbac-and-security.md` § *Roles* both stop
  saying two.** The charter's amendment note pattern of 2026-08-31 is followed: the old wording is
  kept beside the new one.
- **The permission table gains a column, and seventeen of its rows gain a `❌` that is a default
  rather than a decision.** They are marked as such in place.
- **Every `role === "admin"` in `src/` had to be read and left alone or changed deliberately.** The
  dangerous shape is `role !== "admin"` used to mean *is an ordinary member*, which silently admits
  a manager. Each site is named in the implementation.
- **`is_admin` answering false for a manager is what keeps this change small, and it is also the
  thing most likely to be "fixed" by a later reader** who sees a manager refused by the holiday
  calendar and assumes an oversight. The helper carries a comment saying so.
- **INV-02 is untouched.** A substantive edit still revokes an approval; who may perform the
  approval changed, not what an approval means.
- **A manager cannot approve their own entry, so a team whose only decider is a manager cannot get
  that manager's own entries approved.** This is the first thing to revisit if it bites, and it is
  the reason item 3 says *denied until decided* rather than *refused*.

## Revert condition

**The observable signal is a manager performing any write this decision did not grant.** Concretely:
a row in `entry` whose non-decision columns changed under a caller whose role is `manager`, or any
successful write by a manager to `holiday`, `team`, or another member's `member` row. One occurrence
retires the role — `member_role` keeps the value so no data is destroyed, every manager is demoted to
`member`, and the power returns to `admin` alone. The mask in item 4 is the whole of the containment,
and a containment observed to leak has nothing behind it.

**The secondary condition is about the rank rather than the leak.** If the team finds itself
promoting managers to admin routinely in order to get ordinary work done, the rank is drawn in the
wrong place and the correction is to widen `manager` by decided rows — not to abolish it.

## Affected documents

| File | Change | `doc_version` moves to |
|---|---|---|
| `.ai/00-charter.md` | § *Roles* gains the third row and an amendment note | **3** |
| `.ai/standards/rbac-and-security.md` | § *Roles* gains rank 2; the permission table gains a `manager` column | **4** |
| `.ai/standards/data-model.md` | `member.role`'s enum gains `manager` | **7** |
| `.ai/registry/glossary.md` | A `Manager` row; the `Admin` and `Approval status` rows stop implying the admin is the only decider | **unchanged** — glossary rows do not move it, the precedent set at ADR-032 for feature rows |
| `.ai/registry/invariants.md` | **Deliberately absent.** No invariant is amended — INV-02 is about what an approval means, not about who may make one | unchanged |
