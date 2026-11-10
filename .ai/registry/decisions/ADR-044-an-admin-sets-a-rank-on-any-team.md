---
doc_version: 3
last_updated: 2026-09-24
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-044 — An admin sets a rank on any team

> **WRITTEN BY `solo`, NOT BY A HUMAN, ON THE OPERATOR'S INSTRUCTION TO COMMIT AND OPEN A PULL
> REQUEST (2026-09-26).** `.ai/registry/**` is human-only under RULE-01, whose enforcement is
> CODEOWNERS review on the pull request rather than a hook — so this file arriving in a pull request
> rather than on `main` is RULE-01 working, not RULE-01 bypassed. It records a decision the operator
> made in words; the words are quoted in § Status and nothing here is the agent's own.

## Status

> **Decision 1 SUPERSEDED by [ADR-065](ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md)**,
> accepted by the operator on 2026-10-20 at `/plan MIR-03`. An admin now sets ranks on their own team
> only, and promotion to admin goes through its own function. Decisions 2, 3 and 4 still stand. The
> body below is unchanged.

`ACCEPTED by the operator` — 2026-09-24, in words: asked *"why it cannot make an account as manager"*,
shown the two routes with their costs, and answered **`2`** — *cho admin đổi role xuyên team thật*,
the route whose cost was stated as "đảo ADR-039 § Decision 1, nên cần một ADR do bạn accept trước".
Drafted by `solo` in the session that implemented it (ADR-033).

## Context

ADR-039 gave every admin three powers over every team: create and rename a team, admit a sign-up onto
any team, and move an approved member between teams. It gave them no fourth, and said so — the
`move_member` body in `supabase/migrations/20260911180000_solo_many_teams.sql` records the boundary
in terms: *"an admin moving somebody gains no power to promote or remove them on a team the admin is
not on."*

**The reads moved and the rank write did not.** `list_all_members()` shipped with ADR-039 and
`list_members_for_team()` with CAL-11, so the `/members` screen has listed every team since
2026-09-11. `promoteMember` and `setMemberRole` stayed a plain `update public.member set role = …`,
admitted only by TEA-04's `member_update_admin`, whose `using` carries
`team_id = public.member_team_id(auth.uid())`.

So the screen drew *Make manager* and *Promote* on rows the datastore would not let the caller touch.
The PATCH matched no row, PostgREST answered `200 []`, and the seam reported
*"That person's role could not be changed."* — a correct sentence under a button that should not have
been drawn. That is ADR-005 read backwards: the affordance was wider than the control.

Two things could fix it. Narrow the affordance, and an admin is told the truth and still cannot do
the thing. Widen the control, and ADR-039 § Decision 1 gains a fourth power. The operator chose the
second.

## Decision

1. **An admin may set any approved member's rank, on any team** — `member` ⇄ `manager`, and
   `member`/`manager` → `admin`. Team membership of the caller is no longer consulted.
2. **Demotion is untouched and still not decided.** *Demote an admin to member* remains ❌ in
   `.ai/standards/rbac-and-security.md`. This ADR was not asked about it and does not decide it.
3. **Removal did NOT move with it.** `removeMember` stays own-team, on `member_update_admin`.
   Nothing decided otherwise, and widening a destructive power because it sits beside the one that
   was asked for is the drift ADR-039's enumerated list exists to prevent. `src/routes/MemberList.tsx`
   hides `Delete account` on another team's row — an affordance (ADR-005); the policy is the control.
4. **Mechanism:** one `security definer` function, `public.set_member_role(p_member_id, p_role)`,
   testing `public.is_admin` as its first statement — the shape ADR-039 chose for every cross-team
   operation. No table policy is widened. `member_update_admin` is untouched and still governs every
   plain table write on `public.member`.

## Rationale

The rejected alternative is `or public.is_admin((select auth.uid()))` on `member_update_admin`, and
it is rejected for the two reasons ADR-039 § Rationale already records, neither of which has changed:

- an UPDATE carrying a `WHERE`, and any `RETURNING`, is **also** checked against the SELECT policies,
  so a cross-team write needs the caller to SELECT the other team's rows;
- letting an admin SELECT every `member` row silently rewrites `listMembers()`, which selects
  unfiltered because `member_select_team` **was** the team boundary — and that list is INV-04's
  denominator on every calendar screen.

A definer function checks `is_admin` in its own body and changes no read anybody else makes. The cost
is one more function whose first line is load-bearing, which is the cost ADR-039 already accepted
seven times.

**One function rather than two.** `promoteMember(id)` is `setMemberRole(id, "admin")` with a narrower
sentence, which `src/lib/data/index.ts` has said since ADR-035. Both seam functions now reach the
same RPC, so there is one place where the conditions below are written.

**The four conditions in the function's `where`**, each standing in for something the policy or the
column grant used to carry: the row is on a team (a pending sign-up is `admit_member`'s), is
`approved` (`is_admin` and `may_decide` both filter on it, so a rank set on an undecided sign-up
answers false everywhere), is not removed (TEA-04's trigger clause), and is not already `admin`
(decision 2). TEA-04's `member_enforce_role_and_removal` trigger still fires behind all four and
still reads the real caller's `auth.uid()`, because that function reads a per-request GUC and not the
current role.

## Consequences

- **An admin can now change the rank of somebody on a team they cannot see the calendar of.** CAL-12
  gives them the calendar read-only; this write does not wait for it.
- **Promotion to admin is still one-way and now reaches every team**, so a mis-aimed promotion on
  another team is not reversible by any control in the product.
- **`removeMember` and the rank write now sit on different mechanisms**, and `MemberList.tsx`
  compares teams for one and not the other. That asymmetry is decision 3 and reads like a bug if
  decision 3 is not read with it.
- **The function is unverified against a running PostgreSQL.** No project is provisioned;
  `tests/permission-model.test.ts` is still owed — `.ai/standards/rbac-and-security.md` § Known
  weaknesses 1. `tests/cross-team-role.test.ts` asserts the mock's reproduction of the function body
  and nothing more.
- **`supabase/db.sql` does not carry this function**, and does not carry ADR-039's seven or CAL-11's
  three either. That file has been behind since 2026-09-11 and standing a fresh project up from it
  alone produces a product missing every cross-team operation. Pre-existing, named here because this
  ADR adds the eleventh.

## Documents this changes

| Document | What changes | Status |
|----------|--------------|--------|
| `.ai/registry/decisions/ADR-039-every-admin-manages-every-team.md` | § Decision 1 gains a fourth cross-team power; annotate, do not rewrite | owed |
| `.ai/standards/rbac-and-security.md` | the *Promote a member* and *Set a rank* rows lose their own-team qualifier; *Remove a member* keeps it | owed |
| `supabase/migrations/20260911180000_solo_many_teams.sql` | the `move_member` header's *"gains no power to promote"* sentence is now half true — promotion moved, removal did not | owed |
