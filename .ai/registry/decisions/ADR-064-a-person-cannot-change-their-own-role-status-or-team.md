---
doc_version: 3
last_updated: 2026-10-20
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-064 — A person cannot change their own role, status or team, and nobody writes those columns through the table

## Status

`ACCEPTED by the operator` — 2026-10-20T13:46:24+0700, in the `/plan MIR-02` session. Asked one
question with two options — **(a)** accept as written, an admin refused too; **(b)** let an admin move
themselves, the self clause narrowed to `role` and `status` — the operator answered, verbatim:
**"a"**. Decision 3 and the first *Consequences* bullet stand as written.

*Until then `PROPOSED`, and the paragraph below is what it said.* Drafted by `tech-lead-design` at
`/plan MIR-02`, 2026-10-20T13:37:06+0700, under ADR-008.
**Not `ACCEPTED by the operator`.** It records no operator words; it is the design the plan
`.ai/board/tickets/MIR-02/01-plan.md` needs approved before Definition of Ready (ADR-014: the change
creates functions, alters a trigger and revokes column privileges, so `schema_delta` is not `none`).

It supersedes no ADR. Decision 3 removes one behaviour that no ADR decided — an admin moving
**themselves** through `move_member` — and that is named under *Consequences* so it is accepted or
refused in terms, not discovered.

## Context

The audit's most severe finding (`.ai/board/audits/multi-tenancy-audit-2026-10-12.md:11-36`), from
static reading and not yet reproduced:

- `authenticated` holds `update (role, removed_at)` (`20260901120000_tea04_member_writes.sql:29`),
  `update (display_name, avatar)` (`20260910093000_solo_profile_self_update.sql:39`) and
  `update (status, team_id)` (`20260910100000_solo_member_approval.sql:173`) on `public.member`;
- `member_update_own` (`20260910093000_solo_profile_self_update.sql:61-64`) admits the caller's own
  row, pending or approved, while `removed_at` is null;
- `member_enforce_role_and_removal` (final body in `20260910093000_solo_profile_self_update.sql`)
  refuses demoting an admin, promoting a removed member, undoing a removal, removing yourself, and
  renaming somebody else — and does not refuse a person changing their own `role`, `status` or
  `team_id`.

So `PATCH /rest/v1/member?id=eq.<self>` with `{"role":"admin"}` from an ordinary member is admitted,
and `is_admin` is global. A pending sign-up can equally write `{"status":"approved","team_id":…}` and
admit themselves. Plan item P0-2 (`.ai/board/plans/calechip-multi-tenancy-plan.md:76-81`) is the
remedy this ADR makes concrete.

Since ADR-044 the role write already goes through `public.set_member_role`, a definer function. The
only application writes that still use the `role`, `status` or `team_id` column grants are:

- rejecting a sign-up — a plain update of `status` and `team_id` through `member_decide_admin`
  (`src/lib/data/supabase.ts`, `decideMember`, reject branch);
- `setMemberTeam` — a plain update of `team_id` through `member_update_admin`
  (`src/lib/data/supabase.ts`, `setMemberTeam`), which can only ever write the team the member is
  already on (`src/lib/data/index.ts`, its doc comment).

## Decision

1. **`revoke update (role, status, team_id) on public.member from authenticated`.** After it,
   `authenticated` holds update on exactly `removed_at`, `display_name` and `avatar` of
   `public.member`. A table statement naming any of the three is refused with `42501` before any
   policy runs, for every caller, the caller's own row included.
2. **The two remaining writes move behind `security definer` functions that carry, in their own
   body, exactly the conditions the policy they replace carried — no wider:**
   - `public.reject_member(p_member_id uuid) returns void` — caller is an admin; the row is pending
     and teamless; it becomes `rejected` with `team_id` null. The same bound as
     `member_decide_admin`'s rejection branch.
   - `public.set_member_team(p_member_id uuid, p_team_id uuid) returns public.member` — caller is an
     admin; the target row's team and `p_team_id` are both the caller's own team. The same bound as
     `member_update_admin`'s `using` and `with check`.
3. **`member_enforce_role_and_removal` refuses any change to `role`, `status` or `team_id` on the
   row whose `id` is the caller's (`auth.uid()`), whatever the role and whatever the path** — a
   table write, or any definer function including `move_member`, `set_member_role`, `admit_member`
   and the two above. `auth.uid()` null (migration, SQL editor, service role) is not refused, the
   carve-out the trigger's existing clauses already make. It is the second lock behind decision 1,
   and the only lock on the definer paths, which bypass column grants.
4. **No policy is created, altered or dropped.** `member_decide_admin` and `member_update_admin`
   stay; the first becomes inert for writes and the second still carries `removeMember`.

## Rationale

- **Revoke, not trigger alone.** A trigger that raises is one lock, written in procedural code that a
  later `create or replace` can quietly drop a clause from — this trigger has been replaced twice
  already. The column grant is declarative and is checked before any policy. Both, because the grant
  does not reach a definer function and the trigger does.
- **New functions bounded like the policies they replace, not routed through `move_member`.**
  `move_member` is any-admin, any-team (ADR-039). Routing `setMemberTeam` through it would widen an
  own-team write to every team as a side effect of a security fix, which is the drift ADR-039's
  enumerated list exists to prevent.
- **The self clause covers admins.** The finding is that a person can raise their own authority; an
  admin changing their own `status` or `team_id` is the same shape, and the plan item says "a member
  changing their own", not "a non-admin". A carve-out for admins would be a rule with a hole in the
  exact place the hole was.

## Consequences

- **An admin can no longer move themselves to another team through `move_member`.** Its header in
  `20260911180000_solo_many_teams.sql` says *"Moving an admin — the caller included — is allowed"*;
  that sentence was written by `/solo` and is not in ADR-039. After this, another admin moves them.
  **This is the one line the operator is asked to accept or refuse in terms.**
- An admin can no longer change their own role through `set_member_role` — already true, since their
  row is `admin` and the function excludes it.
- Rejecting a sign-up and the member edit panel's save keep their behaviour and their sentences; the
  mechanism moves from a table write to a function call inside the real seam only. No seam signature
  changes.
- `supabase/db.sql` is not updated — MIR-08 regenerates or retires it.
- The cross-team findings on `admit_member`, `move_member`, `reject`-by-any-admin and
  `set_member_role` stand unchanged; they are MIR-03 and MIR-13.
- Verification against a real database is manual until MIR-05 stands up pgTAP (plan:81), recorded in
  `verification.md` in the MIR-02 ticket folder (written at IN_PROGRESS) and the pull request.

## Revert condition

Revert if a legitimate application write is found that needs `role`, `status` or `team_id` through a
table statement, or if the operator decides an admin may move themselves — in the second case clause
3 is narrowed to `role` and `status` only through a new ADR, never by editing the trigger in passing.

## Affected documents

| Document | Change | Who |
|---|---|---|
| `.ai/standards/rbac-and-security.md` | Known gap **A2** closes; *Move an approved member between teams* gains "not themselves"; *Reject a sign-up* names `reject_member` | human — standards are human-only |
| `20260910093000_solo_profile_self_update.sql:13-17` | Stale comment gains a dated correction line, original kept | MIR-02 |
| `20260911180000_solo_many_teams.sql` `move_member` header | Not edited; superseded in effect by decision 3, cited from the new migration | — |
