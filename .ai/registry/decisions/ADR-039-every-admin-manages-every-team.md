---
doc_version: 3
last_updated: 2026-09-22
governed_by: [RULE-01, RULE-09]
---

# ADR-039 — Every admin manages every team

## Status

`ACCEPTED by the operator` — 2026-09-22, in words: *"làm những thứ này thay tôi"* (2026-09-22) — the operator delegated the check; the steward compared this ADR against `supabase/migrations/20260911180000_solo_many_teams.sql` lines 10–13 and found the three decisions recorded as given. Drafted by `product` at `/triage` of
`.ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md`.

**This ADR records a decision that was made and shipped without one.** The operator's three
decisions of 2026-09-11 exist only as a `/solo` agent's summary in the header of
`supabase/migrations/20260911180000_solo_many_teams.sql` (lines 10–17), which says in terms: *"This
file must not be applied before that ADR exists."* The ADR it asked for was printed in a chat reply
and never entered `.ai/registry/decisions/`. This is that ADR, written from the migration.

**Not `ACCEPTED by the operator`**, because the only record of the operator's words is an agent's
paraphrase, and a signature written from a paraphrase is a signature nobody gave. **Not
`ACCEPTED by product`** either: decision 1 reverses the approval clause of ADR-033 (*"an approval
writes the admin's own team"*), and an agent asks rather than decides when an ADR reverses an
accepted one (ADR-008). One confirmation from the operator turns this into `ACCEPTED by the
operator` with no other edit.

## Context

- `.ai/00-charter.md` puts multiple teams in one workspace on the brief's P2 **deferred** list, not
  among the refusals.
- `.ai/standards/data-model.md` (v7) still says the `team` table holds *"One row in v1"* (line 20) and
  that `member → team` refuses deletion because *"No delete path exists for a team in v1"* (line 129).
- `.ai/standards/rbac-and-security.md` (v4) still permits approving a sign-up only *"onto the
  approving admin's own team"* (line 63), and says *"v1 has one team"* (line 120).
- ADR-033 names cross-team sign-up claiming as *"the first thing to revisit if a second is created"*.
- `20260911180000_solo_many_teams.sql` has since created that second team's machinery: seven
  `security definer` functions — `list_teams`, `list_all_members`, `create_team`, `rename_team`,
  `delete_team`, `admit_member`, `move_member` — each testing `public.is_admin` in its own body, and
  `/teams` (`src/routes/Teams.tsx`) consumes them.

So the product, the migrations and the code say *many teams*, and the registry says *one*. Every
triage and plan that touches a team reads the registry, and reads the wrong answer.

## Decision

Recorded from the migration header, decision numbers as it gives them:

1. **Every admin manages every team** — two roles as the charter says for team management, and no
   third. An admin may create and rename any team, admit a waiting sign-up onto any team, and move an
   approved member between teams.
2. **Only an empty team may be deleted.** *Empty* is the foreign key's definition: no `member` row
   names it, removed members included. A team that has ever had somebody removed can never be deleted.
3. **An approved member may be moved between teams, and their history follows them.** `entry` has no
   `team_id`; INV-07 counts an entry against the team its member belongs to now, so a move carries
   every past absence to the new team's past and out of the old team's.

**Mechanism:** each cross-team operation is a `security definer` function that tests `is_admin` in
its own body. The table policies on `team` and `member` are not widened.

## Rationale

The rejected alternative is four wider policies (`team_select_admin_all` and the like, plus plain table
writes). The migration refuses it for two concrete reasons, recorded here so nobody re-derives it and
reaches the other answer:

- An UPDATE or DELETE with a `WHERE`, and any `RETURNING`, is also checked against the SELECT policies,
  so every cross-team write would need the admin to SELECT every team's rows.
- Letting an admin SELECT every row **silently changes two shipped reads.** `getTeam()` selects `team`
  with no filter and `maybeSingle()`, and would throw for an admin on every screen reading the
  threshold. `listMembers()` selects `member` unfiltered because `member_select_team` was the team
  boundary, and it is INV-04's denominator on every calendar view.

A function per operation changes no read anybody else makes. The cost is seven functions to review
instead of four policies, and each one is an open door if it ever loses its first line.

## Consequences

- **Moving a person rewrites two teams' past absence counts.** Chosen knowingly (decision 3); INV-07
  still holds as written. A backdated or mistaken move is not reversible except by moving them back.
- **A team with any removed member is undeletable**, forever, because ADR-013 keeps the row.
- **Moving a team's last admin leaves that team with nobody able to approve its entries** until an
  admin promotes somebody.
- `member_decide_admin` stays in place for rejections; its `with check` no longer lies on the approve
  path. A policy nothing uses grants nothing, but it is one more thing a reader must be told.
- **The cross-team functions are unverified against a running PostgreSQL.** No project is
  provisioned; `tests/permission-model.test.ts` is recorded as owed in `.ai/registry/features.md`.
  These seven functions carry more authority than anything before them.
- **Every calendar read stays scoped to the caller's own team.** An admin can administer a team they
  cannot see — the gap ADR-040 addresses.

## Revert condition

Any cross-team function observed returning a row to, or accepting a write from, a caller for whom
`public.is_admin` is false — in the permission-model test once it exists, or in production. On
observation, revoke `execute` on the offending function and re-open this ADR.

## Affected documents

| File | Change | `doc_version` |
|---|---|---|
| `.ai/standards/data-model.md` | *"One row in v1"* and *"No delete path exists for a team in v1"* replaced by decisions 1 and 2 | **8** |
| `.ai/standards/rbac-and-security.md` | *"Approve a sign-up onto the approving admin's own team"* widened to any team; rows added for create, rename, delete-empty and move; *"v1 has one team"* (line 120) corrected | **5** |
| `.ai/registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md` | Its approval clause is partly superseded by decision 1; annotate, do not rewrite | unchanged |
| `.ai/registry/invariants.md` | **Deliberately absent.** INV-07 is unchanged; decision 3 is its consequence, not an amendment | unchanged |
