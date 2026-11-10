---
stage: TRIAGE
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-010-triage-creates-the-ticket-shell.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/ui-design-system.md
  - .ai/board/backlog.md
  - .claude/commands/triage.md
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# Nothing distinguishes a plan somebody typed from one the lead has actually accepted

## Problem

Every declaration on the board looks equally solid. A colleague reading the calendar cannot tell the
difference between a date somebody entered five minutes ago and one the lead has seen, weighed
against everything else that week, and accepted. So the reader plans around all of it, or around none
of it, and both are wrong.

From the other side: **an admin has no way to say "yes, this one is settled"** and no worklist of
what is waiting for them. Nothing accumulates, nothing is visibly outstanding, and the review happens
— if it happens — by scrolling the calendar looking for things that look new.

And when the answer is no, there is no way for the refusal to carry the one thing that makes it
actionable: the reason.

The brief writes this as requirement 7.4 with a gold star. The problem underneath is **the absence of
a confidence signal**: the board carries intentions of wildly different firmness and renders them
identically.

## Who has it

- **An admin**, whenever entries arrive — bursty, concentrated before holiday clusters, and today
  entirely invisible to them until they go looking.
- **Every member reading the calendar**, each time they plan around somebody else's absence. This is
  the larger group and the one the brief cares about: the star exists so others can *"yên tâm né"*.
- **The member who was refused**, once per refusal, needing to know why so they can propose something
  else.

## Evidence

- Brief section 6 states the meaning explicitly — the star is the signal *"cái này chắc chắn rồi"* —
  and gives it a second purpose: a light incentive to declare early.
- **INV-02 and INV-03 exist today with no surface.** INV-02 says an approved entry returns to pending
  when its substance changes, and `.ai/standards/data-model.md` already specifies the trigger that
  enforces it. INV-03 says a rejected entry always carries a non-empty reason. Both were written for a
  feature that does not exist.
- The charter's Roles table was **amended on 2026-08-31** to settle four admin powers, two of which
  are inside this idea: an admin may approve their own entry, and an admin may edit or delete any
  member's entry.
- `.ai/standards/data-model.md` records `approved_by` and `approved_at` as **the only audit trail v1
  has** — a decision made because an admin can change another member's entry with no other trace.
- The brief's own late success measure is the share of tentative entries that later become approved,
  which only means something if approval exists.

## Impact if ignored

The board's central social mechanism does not work. Tentative entries were invented so people dare to
declare four months out; the approval star is the other half of that bargain — the thing that
eventually converts a maybe into something the team can rely on. Without it, everything on the
calendar stays a maybe forever, and a calendar of maybes is planned around by nobody.

Concretely: a lead who wants to intervene on a crowded day has no lever except a chat message, which
is the arrangement the product was built to replace.

## Constraints already known

- **INV-02** — an approved entry whose dates, type, portion or tentative flag change returns to
  pending; editing only the note does not. So the star is not permanent, and this idea must not build
  an interface that assumes it is.
- **INV-03** — a rejected entry always carries a non-empty rejection reason. This is a hard
  constraint on any bulk-rejection interface, which is the interesting collision inside 7.4.
- **INV-05** — tentative and approval are two independent axes. An admin may approve an entry that is
  still tagged tentative, and doing so does not clear the tag.
- **`.ai/00-charter.md`** — an admin may approve their own entry (operator decision, 2026-08-31).
  Recorded there and in `.ai/standards/rbac-and-security.md` with the consequence stated: the star on
  an admin's own entry means "an admin said so", where that admin is themselves.
- **Charter refusal 2** — an approval here is a team-coordination signal, **not an employment
  decision** and not a substitute for the HR request. Whatever this becomes must not read like an
  HR approval, because people will treat it as one if it looks like one.
- **`.ai/standards/rbac-and-security.md`** — fifteen actions, both directions, with the denials
  written down. The permission model is settled; this idea consumes it rather than deciding it.

## Out of scope

- **Telling the member anything.** v1 has no notification channel. Reminders and chat integration are
  P1, and this idea must not quietly acquire an email sender.
- **The change feed** of who registered, edited or cancelled what. P1, and the thing that would fix
  the admin-edit blind spot — it is named here as a known gap, not built here.
- **Any HR consequence**, quota deduction, or forwarding to an official leave request. Charter
  refusals 1 and 2.
- **Escalation, delegation or multi-step approval.** Two roles only, per the charter.
- **Blocking a save because a day is crowded.** Charter refusal 6, and a different idea entirely.

## Open questions

1. **How does a rejection reason reach the person it is about?** INV-03 guarantees it exists on the
   record. With no notification channel in v1, the member only sees it if they come back and look —
   which makes the reason satisfied as data and useless as communication. This is the sharpest
   question in this idea.
2. ~~**How does bulk rejection satisfy INV-03?**~~ **Answered by the operator, 2026-08-31: one
   reason is typed for the batch and written onto every entry in it.** INV-03 is satisfied per
   entry — each rejected record still carries its own non-empty reason — and bulk rejection stays
   faster than rejecting one at a time, which is the only thing that makes it worth building. An
   admin may then edit an individual reason afterwards. What remains open is whether the per-entry
   edit is in v1 or later.
3. **Does a work-from-home entry need approval at all?** WFH reduces office presence without reducing
   capacity, which the glossary treats as the load-bearing distinction between the two types. Sending
   both down the same approval path may be right, but it has not been decided.
4. **Can an approval be withdrawn by an admin without editing the entry?** INV-02 covers approval
   lost through an edit. Deliberate un-approval is not mentioned anywhere.
5. **Is there any state between pending and a decision for an entry whose date has already passed?**
   Nothing says what happens to a pending entry nobody ever looked at, and those will accumulate.

## Triage verdict: PROMOTE

**Decided 2026-08-31 by `product` and `tech-lead-design`**, running the two halves independently and
then reconciling. Three feature rows were written to
[.ai/registry/features.md](../../registry/features.md) under ADR-007 — **ADM-04**, **ADM-05** and
**ADM-06** — each citing this file in `Notes`, and a ticket shell and a backlog row exist for each
under ADR-010.

### The run went NEEDS-ADR → ADR-016 → PROMOTE in one pass

Both halves reached `NEEDS-ADR` on the same blocker, independently and before comparing notes, and it
is the finding that is the substance of this run.

**This idea says it *"consumes the permission model rather than deciding it"*. That is false: the
model as written cannot be built.** `.ai/standards/rbac-and-security.md` says a member may not approve
their own entry. Under ADR-005 the browser holds the member's own token and PATCHes PostgREST
directly, so the only thing between them and `{"status":"approved"}` on their own row is a policy —
and there is no policy that stops it:

- **An RLS `UPDATE` policy has `using`, which sees the OLD row, and `with check`, which sees the NEW
  row, and no expression sees both.** *"`status` did not change"* is not expressible. Permissive
  policies OR together, so CAL-02's own-entry policy admits the forged row on its own, whatever the
  admin policy beside it says.
- **A restrictive policy ANDs rather than ORs and still has no OLD row**, so it cannot say *"did not
  change"* either.
- **A column `GRANT`, which is what ADM-01 used on `team.overload_threshold`, cannot help here**, and
  the contrast is the instructive part rather than a near-miss. ADM-01 works because *nobody* may
  rename the team, so the privilege is uniform across roles. Here `member` and `admin` are the same
  PostgreSQL role, `authenticated` — the rank is a column read through `public.is_admin(uuid)` — so
  revoking `status` from `authenticated` blocks the admin too. **A control that cannot express the
  distinction cannot enforce it.**

This is `rbac-and-security.md` known weakness 1 in its purest form: the policy fails open and
silently — no error, no log — and it is not written too permissively, it is written as permissively as
the mechanism allows. The permission row would have been held **by intent rather than by a control**,
which that file names as the most expensive kind of documentation error.

The answer is [**ADR-016**](../../registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md),
drafted and `ACCEPTED by tech-lead-design` under ADR-008: one `before update` trigger,
`public.entry_enforce_decision()`, merged into the one INV-02 already needs rather than added beside
it, because PostgreSQL fires same-event triggers alphabetically by name and one function is what keeps
the clause order explicit.

**The verdict recorded here is `PROMOTE`, not `NEEDS-ADR`.** Under ADR-008 a self-acceptable ADR no
longer stops the loop, and under ADR-010 a promoted row must reach the board the same run; recording
`NEEDS-ADR` would have issued no rows, since ADR-007 authorises a row on `PROMOTE` only.

### The tension ADR-016 states about itself, carried here so the idea file does not hide it

ADR-016's own `Status` section says it is the closest call of the four ADRs written today. ADR-005
says row-level security *"is the only mechanism that enforces"* authorization, and the guard decided
above is authorization **in the database but not in a policy** — read literally, that sentence is
reversed. It is nevertheless inside the envelope on two grounds, the second decisive: ADR-005's own
revert condition names the failure as a requirement that cannot be expressed *"without duplicating the
rule in application code"*, and nothing here reaches application code; and **ADR-005 already puts
INV-02 in a trigger**, so a trigger on `entry` is a mechanism that ADR itself names.

**If the operator reads *"and nowhere else"* literally and disagrees at merge, ADR-008's revert
condition fires and RULE-09 returns to v1.** That is the correct outcome of a disagreement, and it is
recorded in both places rather than smoothed into a rationale.

### The split was disagreed on twice, and it went one way each time

**`product` lost on read-versus-write.** It argued the worklist is not separable from the action:
CAL-05 says displaying who approved is not approving, CAL-04 and CAL-06 are grids, so no existing
surface can carry a per-entry admin control and splitting invents a throwaway one. It lost because a
read-only worklist is genuinely exercisable end to end at its own QA gate and delivers half of this
idea's own Problem statement — *"no worklist of what is waiting for them"* — and because read path
before write path is the operating model's stated rule, the same one that settled ADM-02 against
ADM-03 earlier the same day. The losing argument is kept because it fixes what **ADM-04 must not do**:
it carries no approve control and no reject control.

**`tech-lead-design` lost on the fourth row.** It proposed one in the `CAL` group for the star and
the owner-visible rejection reason. **No ID is written here, deliberately** — an unissued row named by
number reads as a planned feature, and check D1 fails a token that resolves to nothing in
`features.md`, which is the correct behaviour and not an obstacle to work around. The star needs no row here at all: CAL-04 fixes the star and dashed-border
vocabulary, CAL-05 displays `approved_by`, CAL-06 inherits both, and **this idea's whole contribution
to the read signal is that `status` ever changes**. The stronger half of the argument was the
restraint: whether a *rejected* entry is drawn at all is CAL-04's open `TODO(project):`, so a row
presupposing an answer would be inventing a surface against an unanswered question. The requirement
became an acceptance criterion on ADM-05 instead.

### Two things ADR-016 decided that neither half had proposed

- **`approved_by` and `approved_at` become unwritable from the wire.** The trigger overwrites them
  from `auth.uid()` and `now()` on any transition into `approved` and nulls them on any transition
  out, discarding whatever the client sent. Before this, **the only audit trail v1 has was forgeable
  by any admin in a PATCH body they composed** — one admin could write another's id into it, and
  known weakness 3 means nothing anywhere would contradict them. It also makes CAL-05's *displaying
  who approved is not approving* true **by construction** rather than by the story remembering it.
- **Bulk rejection is `public.reject_entries(p_ids uuid[], p_reason text)`, `security invoker`** —
  not the naive PATCH with `id=in.(…)`, which puts 37 bytes per uuid in the **query string** and meets
  a proxy's request-line cap as an opaque **414** at a few hundred ids, which is exactly the moment an
  admin clears a backlog. `security invoker` is what keeps it inside ADR-005: `entry_update_admin` and
  the guard both still run as the caller, so it is a **transport change and not an enforcement layer**.
  The behaviour worth writing into the story: **rows an RLS policy does not admit are filtered rather
  than errored**, so *reject 8* updates 5 and returns HTTP 200 and an `!error` check passes —
  `get diagnostics row_count` is what makes that detectable, so the seam says *"5 of 8"* instead of
  *"done"*.

### The five open questions, dispositioned

1. **How does a rejection reason reach the person it is about? — Blocks nothing, and the honest answer
   is that v1 does not tell them.** There is no notification channel and this idea must not grow one.
   What is owed instead is that the reason be **readable on pull**, which is an acceptance criterion on
   ADM-05: the owner of a rejected entry can read the reason, and who rejected it and when, without an
   admin telling them. **Today that is not merely unbuilt, it may be unreachable** — whether a rejected
   entry is drawn on any surface is CAL-04's `TODO(project):`, inherited by CAL-05 and CAL-06 and
   inherited here rather than re-asked. If it is answered *not drawn*, INV-03's reason exists on a
   record nobody can open, and supplying a surface is a scope change raised at SPEC rather than
   invented now.
2. **Per-entry edit of a bulk-written reason — story-level, in v1.** Editing `rejection_reason` is not
   in INV-02's trigger list, so it revokes nothing; it is the same field on the same form ADM-05
   already builds. If it is ever cut, it must be cut explicitly rather than assumed.
3. **Does WFH need approval? — `TODO(project):` on ADM-04, and it blocks that row's acceptance
   criteria because it decides what the list contains.** The schema already answers the data question:
   every entry has `status` defaulting to `pending` with no `type` condition, and INV-04 counts both
   types alike. Recommendation: one path for both, with a type filter on the worklist. A status-less
   type would be a schema change and a second rule.
4. **Can an approval be withdrawn without editing the entry? — Denied by default, and it blocks
   nothing.** *Approve or reject another member's entry* carries no state restriction, so
   `approved → rejected` is already permitted and carries a reason. `approved → pending` is named in no
   permission row, and `rbac-and-security.md` is human-only under RULE-01, so it is denied until
   decided — the same footing as known weakness 6's two rows. ADM-05's story enumerates the permitted
   transitions rather than leaving them to be discovered.
5. **A pending entry whose date has passed — `TODO(project):` on ADM-04, blocking that row.** It is
   the worklist's defining filter. Recommendation: **no fourth `entry_status` value** — that is a
   schema change and an ADR nobody has asked for — and instead a default filter of `end_date >= today`
   with past-dated pending entries behind an explicit one. They stay `pending`, which is truthful:
   nobody ever decided. INV-04 is unaffected either way. **It compounds with ADM-04's truncation
   hazard**, since a capped read eats exactly these first.

### Charter refusal 2, as seven acceptance criteria rather than a principle

*An approval here is a team-coordination signal, not an employment decision.* **The trap is that the
domain word — *duyệt* — is the HR word**, so the guard has to be everything around it. Cited from
ADM-05, and testable:

1. **The object is an entry (*đăng ký*), never a request, an application or *đơn*.** The glossary
   fixes the term and `coding-standards.md` forbids names that are not in it, so this one is enforced
   rather than reviewed. *"Đơn nghỉ phép được duyệt"* is a defect.
2. **No quota, balance, entitlement or remaining-days number appears on any approval surface.**
   Charter refusal 1 at the copy level.
3. **Rejection removes nothing and locks nothing.** A rejected entry stays on the board, stays its
   member's, and stays editable — the charter says a member edits their own entries *at any time*. If
   rejecting deleted, hid or froze it, the approval would have become a gate.
4. **Nothing in the product is disabled because an entry is `pending` or `rejected`.** No control, no
   copy implying the member may not go. Rejection removes the entry from the absence count (INV-04)
   and does nothing else.
5. **The star's meaning is readable in the interface, once** — an admin has seen this and accepted it
   against the team's schedule. One sentence, in the product, not only in the documents.
6. **The rejection copy proposes rather than refuses.** The reason field's label and placeholder ask
   what would work instead. This is the concrete content of *"the one thing that makes it actionable"*
   in the Problem above.
7. **No path from this surface reaches HR.** No export, no submit, no field for an HR request id, no
   email. This is the screen where somebody would build it.

### Out of scope — additions from triage

- **Deliberate un-approval (`approved → pending`).** No permission row names it; denied by default.
  Rejecting with a reason is the available path.
- **Any fourth `entry_status` value**, and any auto-approval, auto-expiry, or rule that changes a
  status without an admin acting. A status that changes itself is exactly the false record INV-02
  exists to prevent.
- **Approval controls on the calendar views.** CAL-05 says it from its side; this idea says it from
  the other, so nobody adds a button there.
- **A member acknowledging, replying to or appealing a rejection.** Charter refusal 5 — the
  negotiating happens between people.
- **Rendering the star and `approved_by`.** CAL-04, CAL-05 and CAL-06 own it. This idea only makes
  `status` change.
- **`updated_by`, or a change feed recording who approved and then rejected.** `data-model.md`
  OPEN QUESTIONS item 5, and the brief's P1.
- **Any HR-facing export or *submit to HR* path.** Implied by refusal 2 and named here because this is
  where it would be built.

### Recorded for the steward, not acted on

**`.ai/board/tickets/CAL-02/ticket.yaml:16` and `CAL-03/ticket.yaml:16` both say
`schema_delta: none`**, while CAL-02's own comment at lines 36-38 says *"This ticket adds the update
and delete policies"*. Under [ADR-014](../../registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md),
`ACCEPTED by the operator`, that is not `none` — and ADR-014's *Consequences* exempt *"CAL-04 through
CAL-07"* by name and are silent on these two. Two backlog rows are inconsistent with an
operator-accepted decision. ADR-016 records the same finding. Correcting a ticket outside the one
being promoted is not this run's to do.
