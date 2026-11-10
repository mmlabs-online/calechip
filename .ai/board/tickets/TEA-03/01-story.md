---
ticket: TEA-03
stage: SPEC
agent: ba
produced_at: 2026-08-31T17:53:58Z
branch: feat/TEA-03
inputs_read:
  - .ai/board/tickets/TEA-03/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-013-removed-members-count-until-removal.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/architecture.md
  - .ai/board/ideas/2026-08-31-nobody-can-join-the-board.md
  - .ai/board/tickets/TEA-01/02-design.md   # sections 4 and 5 only, for the policies that already exist
  - .ai/board/tickets/TEA-02/01-story.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TEA-03 — Team member list

## Feature

**TEA-03 — Team member list**, transcribed from `.ai/registry/features.md`:

> From 2026-08-31-nobody-can-join-the-board.md. The blocking gap is closed — rbac-and-security.md
> carries a `Read the member list` row (member ✅, admin ✅) for the select policy to be written
> against. It was derived rather than decided, flagged as such, and **confirmed by the operator on
> 2026-08-31**. That file. The operator confirming or overturning it is the last thing between this
> row and READY.

Invariants named on that row: `[]`. **This story lists two.** The divergence and its reasoning are in
*Invariants touched* below, written out rather than left for a reviewer to reconcile.

## User value

Today every member of this board can read every entry in the team and cannot read the team. TEA-01
shipped `member_select_own`, a policy that returns the caller's own row and nothing else — so the
product knows who you are and cannot tell you who anybody else is. The cost is not only the missing
screen: a member sees entries with no names on them, an admin cannot see who they are about to
promote or remove, and the absence count that the whole product exists to compute has no roster to be
taken against. This ticket widens that policy to the team and puts one plain list over it — who is on
this team, what they look like, and which of them are admins. It is the smallest ticket in the group
and four later ones are blocked behind it.

## Acceptance criteria

**AC-1 — a member sees every current member of their own team**
- Given a signed-in member of team T, and team T has several members including the caller
- When they open the member list
- Then every member of team T whose `removed_at` is null is shown — the caller included — each with
  their `display_name`, their `avatar` and their `role`

**AC-2 — the list is scoped to the caller's own team**
- Given a signed-in member of team T, and a member row belonging to a different team U
- When they read the member list, by any route including one that does not go through this
  application's interface
- Then no row belonging to team U is returned

  *INV-07. Exactly one team exists in v1 (glossary, *Team*), so this criterion is unobservable
  through the interface and is asserted against seeded data with a second team. It is written anyway
  because the policy is where the team boundary is held, and a policy that omits the scope passes
  every test a one-team fixture can run.*

**AC-3 — an admin sees the same list, and no more**
- Given a signed-in admin of team T
- When they open the member list
- Then they see the same rows and the same fields as a member of team T sees, and no field and no row
  that a member does not see

  *`Read the member list` in `.ai/standards/rbac-and-security.md` is ✅ for both roles, which is one
  permission and not two. The failure this criterion exists to catch is the natural-looking
  implementation where an admin's read is written separately and quietly returns more.*

**AC-4 — a removed member is not dropped from the read**
- Given a member of team T whose `removed_at` is set
- When the team's roster is read through the data-access seam
- Then that member is returned, carrying their `removed_at`, and they are **not** listed on the
  member list screen

  *This is the criterion most likely to be lost, and it is the reason INV-04 is listed below. ADR-013
  and the INV-04 note in `.ai/registry/invariants.md` require that the counting function **be given**
  the roster including `removed_at` per member, because it cannot derive membership-as-of-a-date from
  the entries. If the policy — or the seam read — filters `removed_at is null`, the roster CAL-04 and
  CAL-06 consume can no longer answer "was this member on the team on that date", and INV-04 becomes
  uncomputable for every past date. Which members the **screen** draws is a display decision and
  belongs above the seam; which rows the **read** returns is not.*

**AC-5 — no role may write a `member` row**
- Given a signed-in member or a signed-in admin
- When they attempt to insert, update or delete any row of `member`, by any route including one that
  does not go through this application's interface
- Then the write is refused

  *TEA-01's design records that the admission trigger is the only writer and that `member` must never
  gain an insert policy — an insert policy on this table lets a signed-in person choose their own
  `team_id` and `role`. It is restated here because this is the ticket that changes this table's
  policy set, and the specific risk of widening a `select` is that a write is dragged along with it.*

**AC-6 — a caller with no session reads nothing**
- Given a caller with no session, holding only the anon key
- When they read `member`
- Then no rows are returned

  *TEA-01's migration revokes all on `public.member` from `anon` and grants `select` to
  `authenticated` only. The widened policy must be granted `to authenticated`; a policy written `to
  public` re-opens the table to the key that ships in the bundle by design
  (`.ai/standards/rbac-and-security.md`, *Secrets*).*

**AC-7 — a signed-in person with no member row sees an empty list, not everyone**
- Given a signed-in auth user who has no `member` row, because they signed up with an address that
  was not on the allow-list (TEA-01)
- When they read the member list
- Then no rows are returned, and the screen says they are not on a team rather than showing an empty
  team

  *The policy scopes to the caller's team by way of the caller's own member row. When that row does
  not exist there is no team, and the two available answers are "nothing" and "everything". This is
  the fail-open case known weakness 1 in `.ai/standards/rbac-and-security.md` describes: no error, no
  log, just rows that should not have been returned.*

**AC-8 — the roster read asserts its own completeness**
- Given the member list is read with an explicit row limit above any plausible team size
- When the datastore returns as many rows as that limit
- Then the read raises instead of returning them, and no screen and no computation consumes the
  possibly-truncated result

  *Under ADR-005 the browser reads PostgREST directly and PostgREST caps rows server-side, so a
  capped read returns a believable short answer with no error anywhere. On this table the consequence
  is arithmetic rather than cosmetic: the roster is INV-04's **denominator** — the team's members with
  `removed_at` null — so a roster short by two people raises the ratio on every date and makes days
  look overloaded that are not. The mitigation is the one `.ai/registry/features.md` already
  prescribes on ADM-02: an explicit limit with margin, and an assertion that the returned count is
  below it. The `TODO(verify):` on the datastore's default row cap is carried by CAL-04, ADM-02 and
  ADM-04 already and is not re-raised here.*

## Invariants touched

- **INV-07 — one member, one team.** The widened select policy is the only thing deciding which
  member rows a caller may see, so it is where the team boundary is either held or lost. AC-2 asserts
  it directly.
- **INV-04 — one definition of the absence count.** Reached indirectly and listed for that reason,
  per the instruction in `.ai/registry/invariants.md` that an invariant reached through a cascade is
  still reached. This ticket computes no count. It produces the **roster** the single counting
  function must be given — ADR-013 — and that roster is both INV-04's denominator (members with
  `removed_at` null) and the input to its per-date membership condition. Two ways this ticket could
  break a number it never computes: dropping removed members from the read (AC-4), and returning a
  silently truncated one (AC-8).

**Neither is discharged by this ticket's mitigation, and that is not the test.** Both are listed
because the behaviour had to be chosen, which is the evidence the invariant was in play.

## Permissions

Against the table in `.ai/standards/rbac-and-security.md`.

| Action | `member` | `admin` |
|---|---|---|
| Read the member list | ✅ | ✅ |

One row, ✅ for both roles, and the equality is itself a criterion (AC-3).

That row *"was derived rather than decided, and the operator confirmed it on 2026-08-31"*. The
derivation is worth keeping in front of whoever designs the policy, because it bounds it: a member can
already read every entry in the team, and the year view renders one row per member, so a member who
could not read the member list could still enumerate it from entries they are entitled to read.
The policy is therefore permitted to return the whole team and is **not** permitted to return more.

What must not be possible:

- Reading a member row of any other team, in either role (AC-2).
- An admin reading more rows or more fields than a member (AC-3).
- Any insert, update or delete of a `member` row, in either role (AC-5).
- Reading anything without a session (AC-6), or with a session but no member row (AC-7).

## Out of scope

- **The sign-in half of feature TEA-01 — and there is still no ticket for it.** TEA-01 shipped the
  sign-up half; `useSession`, `SignIn`, `NotOnATeam`, `Home` and the session half of the seam were
  carved out and never ticketed, as TEA-02's story also records. Every criterion above begins "given
  a signed-in…" and today there is no way to sign in. This ticket does not build it.
- **Removing a member, and promotion to admin** — TEA-04. This story displays `role` and reads
  `removed_at`; it changes neither, and AC-5 forbids the write that would.
- **What a removed member looks like on this screen.** AC-4 requires only that the read keep them.
  Whether they are ever drawn, greyed, or filtered behind a control is TEA-04's question, arriving
  with the surface that can produce one.
- **The absence count, the overload comparison, and every calendar view** — CAL-04, CAL-06, CAL-07.
  This ticket supplies a roster and computes nothing. Putting any arithmetic over it here would
  create the second definition INV-04 exists to forbid.
- **The `team` select policy and the grant it needs** — owned by CAL-04, stated on that row in
  `.ai/registry/features.md`. Nothing here reads `team`; the caller's team is reached through their
  own `member` row.
- **Editing your own `display_name` or `avatar`.** No permission row exists for it in
  `.ai/standards/rbac-and-security.md`, there is no update policy on `member`, and this ticket adds
  none. Inventing one would be inventing a permission.
- **The allow-list** — TEA-02. That screen lists addresses of people who have not arrived; this one
  lists people who have.
- **Search, sort, filter and pagination.** One team exists (glossary, *Team*) and the brief's worked
  example is ten people. AC-8 requires a bounded read that refuses to truncate, which is not the same
  as paging and must not be built as it.
- **The embedded member names in the admin worklist** — ADM-04, which consumes this policy and does
  not extend it.

## Open questions

None blocking. Three things this story decided rather than deferred:

- **Each row shows the member's `role`.** It is a column on the row being listed, the charter's
  central role model is that exactly two roles exist, and a roster that does not say which of the two
  each person is leaves a member with no way to see whom to ask for an approval — and leaves TEA-04's
  *Promote a member to admin* with no surface to act on. The alternative, name and avatar only, was
  not chosen for those reasons.
- **The screen shows current members; the read returns removed ones** (AC-4). The split is between
  the seam and what is drawn above it, and it is placed there because INV-04's roster requirement is a
  property of the read.
- **A person with no member row is told so, rather than shown an empty team** (AC-7). The two states
  are indistinguishable on screen and mean opposite things.

One thing outside this story that changes how it reaches DESIGN, and is not the BA's field to fix.
**`ticket.yaml` arrived with `schema_delta: none` and `requires_adr: false`, and neither can be
right.** The whole ticket is a policy change: TEA-01's design (section 4) records `member_select_own`
as the only select policy on `public.member` and names TEA-03 as the ticket that widens it, so AC-1
through AC-3 are unreachable without a migration that creates or replaces a row-level security policy.
**ADR-014 settles that such a migration is not `none`**, explicitly with no carve-out for a `select`
policy — *"a permissive `select` is precisely how data leaks"*. The field has been corrected to say
so, and `requires_adr` set to `true`.

**Unlike TEA-02, there is no existing ADR to link, and Definition of Ready item 4 will fail without
one.** TEA-02 could cite ADR-009, which had already decided that its writes were ordinary. Nothing in
`.ai/registry/decisions/` decides who may read the member list: ADR-013 requires the roster but does
not say who may read it, and ADR-005 says only that authorization lives in policies — citing it for a
particular policy would exempt every policy from ADR-014 and defeat the rule.

**The missing ADR is a recording, not a new decision, and that is what makes it cheap.** The operator
confirmed the `Read the member list` row on 2026-08-31; `.ai/standards/rbac-and-security.md` carries
the confirmation and the derivation behind it. Under ADR-008 an agent may accept an ADR under its own
name where the decision sits inside an already-accepted envelope, which this one does. Writing it
belongs to `product` and `tech-lead-design` at BACKLOG — Definition of Ready item 4 names them — and
not to the BA at SPEC, which is why it is reported here rather than fixed.

## Changelog

- `2026-08-31T17:53:58Z` — sections 1–8 created. Raised by `ba`. Amended by `ba`.
