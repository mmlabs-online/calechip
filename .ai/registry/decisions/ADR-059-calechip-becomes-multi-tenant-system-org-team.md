---
doc_version: 3
last_updated: 2026-10-13
governed_by: [RULE-01, RULE-09]
---

# ADR-059 — CaleChip becomes multi-tenant: System → Org → Team

## Status

`ACCEPTED by the operator` — 2026-10-13, in chat, in words. Recorded by the steward (`/thuki`).

**Recorded, not authored.** The operator asked *"nếu đi theo system như thế có gọi là system SaaS
không"*, was told that the charter's *"Who uses it. One team of five to thirty people"*
(`.ai/00-charter.md:30` as it stood) contradicts the multi-tenancy plan and needs an ADR before
MIR-10, and replied, verbatim:

> **"thay đổi charter theo multi-tanent"**

**Three follow-up answers, the same day**, given in chat after the first draft of this ADR listed
them as open, relayed to the steward by the launching session (not quoted from a file), verbatim:

> **"1. Bỏ cấm, cho phép tự duyệt đơn của bản thân**
> **2. Tính vào tất cả team người đó thuộc về**
> **3. Treo những tính năng này, chưa làm bây giờ"**

Answer 1 confirms decision 4's manager self-approval and lifts ADR-035's ban. Answer 2 settles what
was open question 7 and is decision 7. Answer 3 parks every other open question (*Deferred by the
operator* below).

The model adopted is the one in [the multi-tenancy plan](../../board/plans/calechip-multi-tenancy-plan.md)
§ *Target model (agreed)* (plan:10-47). Nothing in *Decision* below goes beyond that section
except decision 7, which is answer 2. What the operator deferred is listed under *Out of scope of
this decision*, and none of it may be read as settled because this ADR is accepted.

## Context

- **The charter scoped the product to one team.** *"Who uses it. One team of five to thirty people.
  Every member reads the whole team's calendar"* (`.ai/00-charter.md:30-31`, before this ADR). That
  sentence has been stale since 2026-09-11, when ADR-039 made the product many-team; ADR-045 and
  ADR-052 both said so and neither repaired it.
- **The MIR plan builds something the charter does not describe.** Phase 3 (MIR-10 to MIR-15, MIR-18,
  MIR-21) introduces an `org` tenant boundary and multi-team membership; phase 4 (MIR-16, MIR-17)
  splits `admin` into three roles. MIR-10 — the schema design, *"approve before any migration"*
  (plan:167) — cannot be approved against a charter that says one team.
- **The charter's roles are three** — member, manager, admin (ADR-035). The plan's are five.
- **INV-07** reads *"Every entry belongs to exactly one member, and is counted only against the team
  that member belongs to."* With a member on several teams, *"the team that member belongs to"* no
  longer names one team.

## Decision

1. **CaleChip is multi-tenant, in three levels** (plan:12-16):
   - **System** — the whole deployment. One `system_admin` panel at an unguessable path.
   - **Org** — the tenant boundary. Fully isolated data, its own configuration, its own holidays,
     reachable at `/{org_code}`, with member and team caps set at creation. **A user belongs to
     exactly one org.**
   - **Team** — inside an org. Its own entry register, its own manager, its own approval switches
     and overload threshold. **A user may belong to several teams within their org.**
2. **Org public** (plan:18) — a shared tenant holding teams that have not bought a licence,
   administered by `system_admin`, marked `is_shared_tenant = true`, with every org-wide visibility
   feature disabled.
3. **Five roles** (plan:20-28):

   | Role | Scope |
   |---|---|
   | `system_admin` | The whole system. A separate panel. May impersonate — read-only, time-boxed and logged. |
   | `org_admin` | One org. What today's `admin` becomes. |
   | `manager` | One team. Approves PTO/WFH and sets team configuration. Also a member who registers entries. |
   | `member` | One org, one or more teams. Sees the calendars of the teams they belong to. |
   | `guest` | No account. Sees and registers for public events through a token (as ADR-052 already allows). |

4. **Approval across several teams** (plan:30-35): if any one of a person's teams requires approval,
   the entry requires approval; one manager's decision is enough and the first decision wins; one
   rejection rejects the entry; a manager may approve their own entry, recorded as
   `self_approved = true` (confirmed by answer 1, *"Bỏ cấm, cho phép tự duyệt đơn của bản thân"*,
   superseding decision 3 of ADR-035); a team with no manager falls back to `org_admin`.
5. **Configuration ownership** (plan:37-47) is split across system, org and team as the plan's table
   gives it. Teams may add their own non-working days and may not remove days set by the org.
6. **Every cross-team read already granted is bounded by the org.** ADR-039 (*every admin manages
   every team*), ADR-040 (*an admin reads any team's calendar*), ADR-044 and ADR-045 (*members of any
   team* reading events and the invitee picker) were written when the deployment was one tenant.
   Under decision 1's *"fully isolated data"*, *"every team"* in each of them means every team **of
   the caller's org** from the moment org isolation ships. This is a reading of what the operator
   decided, not a new decision; it is stated so that no MIR ticket treats those ADRs as licence for a
   cross-org read.
7. **An entry counts against every team its owner belongs to** — answer 2, *"Tính vào tất cả team
   người đó thuộc về"*. A member of three teams who takes a day off adds to that day's absence count
   in all three, for the overload warning and every other use of the count. INV-04 and INV-07 are
   restated to say so in `.ai/registry/invariants.md`.

**The charter's standing refusals are not touched.** Refusals 1 (no leave quota), 2 (never replaces
the official leave request), 3 (no timekeeping or payroll) and 6 (a warning never blocks) are each
about what the product does with one person's plan; none is contradicted by how many organisations
one deployment holds. Refusals 4 and 5 stay retired under ADR-045.

## Out of scope of this decision — deferred by the operator

**Deferred by the operator 2026-10-13 — not in scope of MIR; revisit before any commercial launch.**
Answer 3, verbatim: *"Treo những tính năng này, chưa làm bây giờ"*. None of these is built, ticketed
or designed for now. No MIR ticket may fill one in. A MIR design that finds it needs one stops with
the item named.

1. **Billing and payment.** Whether, how and by whom an org is charged. This ADR records tenancy,
   not a business model, so it does not answer *"is CaleChip SaaS"* in the commercial sense. The
   plan's `plan` and `licence_expires_at` columns (plan:168) are schema placeholders, not a pricing
   decision.
2. **Licence-expiry behaviour.** The plan's proposal (plan:313) stays a proposal.
3. **Over-cap behaviour**, including after a downgrade (plan:314). **When it is taken up, read it
   against refusal 6.** A cap that refuses a new member does not by itself contradict refusal 6; a
   cap that refuses an *entry* would, and the decision should say which it is.
4. **Member counting** against a cap — distinct users or memberships (plan:315). This is the cap
   question, and it is distinct from decision 7, which is about the absence count.
5. **Self-serve org signup.** Not in the plan. Org creation stays in the system panel (plan:41,
   MIR-18).
6. **Per-tenant data export and deletion.** Not in the plan.
7. **Team and org size limits.** The charter's five to thirty per team stands as the sizing figure.
   Nothing sizes an org, and cap defaults are undecided.

*Until the follow-up answers the same day, this section listed eight open questions. The eighth —
which team or teams an entry is counted against — is now decision 7. Self-approval was a flag for
the operator to confirm at merge, and is now confirmed in decision 4.*

## Rationale

**Rejected: keep the charter and treat multi-tenancy as an implementation detail.** The charter is
what `/triage` and `/plan` reason from. A MIR ticket designed against *"one team"* either blocks or
quietly ignores the charter, and the second is the worse outcome.

**Rejected: amend only the *Who uses it* sentence.** The roles section, the reading principle and
`CLAUDE.md` would still describe one tenant with three roles, and an agent picks whichever text
suits it.

## Consequences

- **The deployed product and the charter differ until the MIR items ship.** The charter now names
  the target scope and roles; the running system has one implicit tenant and three roles until
  MIR-12 (backfill into *Org public*), MIR-16 and MIR-17 (role split). The charter's Roles section
  keeps the three-role table as *what is deployed today*, and `.ai/standards/rbac-and-security.md`
  stays the table a review is checked against until the ticket that changes it.
- **Decision 4 supersedes decision 3 of ADR-035.** ADR-035 read *"A manager may not decide their
  OWN entry"*. The operator lifted that ban (answer 1). ADR-035 carries a supersession note under its
  Status, and its body is unchanged. The deployed product enforces the ban until MIR-14 ships.
- **INV-04 and INV-07 are restated** to decision 7: an entry is counted against every team its owner
  belongs to, and a team's count takes entries of members who were on that team on that date. The
  old wording is kept as a revision note. The deployed schema, with one team per member, satisfies
  both readings, so nothing is violated today. MIR-10 must design for the new wording.
- **Glossary rows are owed**: `Org`, `Org public`, `Membership`, `System admin`, `Org admin`, `Guest`.
  They are written at PLAN by the MIR ticket that first uses each (ADR-047), not here.
- **`.ai/standards/rbac-and-security.md`, `data-model.md` and `architecture.md` change with the MIR
  tickets** that change the schema and policies, not with this ADR. Only their single-team
  statements of fact were corrected here.

## Revert condition

The operator decides that CaleChip serves one organisation. That decision supersedes this ADR. The
charter's *Who uses it* paragraph is then restored from the revision note kept beside it, and any MIR
item not yet shipped from phase 3 onward becomes `WONTDO`.

## Affected documents

| File | Change | `doc_version` |
|------|--------|---------------|
| `.ai/00-charter.md` | *Who uses it* rewritten to the three-level scope; target roles added above the deployed three-role table; the reading principle scoped to a member's own teams; the P2 note records that multiple teams were taken up. Old wording kept beside an *Amended 2026-10-13 by ADR-059* note | 3 → 4 |
| `CLAUDE.md` | Intro paragraph: one team and two roles replaced by the tenant model and the five roles | n/a |
| `.ai/registry/glossary.md` | `Team` row: *"Exactly one team exists in v1"* corrected | 2 → 3 |
| `.ai/registry/invariants.md` | INV-04 and INV-07 restated to decision 7, old wording kept beside them | 3 → 4 |
| `.ai/registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md` | Supersession note under Status for its decision 3; body unchanged | 2 → 3 |
| `.ai/standards/rbac-and-security.md` | *"v1 has one team"* (pending-queue paragraph) corrected | 4 → 5 |
| `.ai/standards/data-model.md` | `team` *"One row in v1"* corrected | 7 → 8 |
