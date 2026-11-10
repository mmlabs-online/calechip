---
doc_version: 3
last_updated: 2026-11-05
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-078 — Writers write `membership` alongside `member.team_id`; the mirror keeps only inserts and removal; the drop moves to MIR-21-c

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-05 — at `/plan MIR-21-b` (ADR-008, ADR-067).

This ADR re-allocates work that
[ADR-077](ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md)
decision 5 gave to MIR-21-b, and extends decision 6's blocker list. ADR-077 decision 5 foresaw it
(*"splits again at its own PLAN if its count is `L`"*). It reverses no decision. ADR-071 decision 2
(the mirror goes when the writers move) and ADR-064 decision 3 (nobody changes their own team, by
any path) both still hold. *Consequences* says how each one is carried.

## Context

- **Done whole, MIR-21-b is `L`.** The writers, the drop, and every file that names the column come
  to about twenty paths. Almost all of them are tests that the drop breaks: `_isolation.psql`, 010,
  030, 040, 070, 100, 110, 120, 140, 150, 160, 190, 210, 220, plus `seed.sql`, `bootstrap.sql`,
  `create-account.sql`, `.ai/standards/data-model.md` and the seam. The seam is affected because
  `set_member_role`, `set_member_team` and `promote_member_to_admin` return a whole `public.member`
  row, and `toMember` reads `team_id` from it (`src/lib/data/supabase.ts:1224`, `:1851`, `:1865`).
- **A writer that writes `membership` and stops writing the column leaves the column stale.** Under
  the mirror today, every person's column equals their roster team. If the writers stop writing the
  column, it goes stale for every person admitted or moved afterwards. The stale value then reaches
  the UI through those three returned rows, and it breaks
  `220-roster-team-from-membership.test.sql` AC-1.
- **A writer that writes both, with the mirror unchanged, writes `membership` twice.** The mirror's
  team-change branch closes the row the writer has just opened, then opens another one.
- **The mirror has two callers that are not writers.** Its INSERT branch is the only thing that gives
  a fixture-inserted member a `membership` row: `tests.seed()` (`_isolation.psql:102`), seven other
  test files, `seed.sql` and `bootstrap.sql`. Its removal branch is the only thing that closes a
  member's rows when the seam removes them. Removal is a table PATCH of `removed_at`
  (`supabase.ts:1808`), not a definer function.
- **Outside the writers, one path changes `team_id`:** `supabase/create-account.sql:153`, an
  operator script. It relies on the mirror's team-change branch.
- **ADR-064 decision 3's lock is on the column.** `member_enforce_role_and_removal` refuses a change
  to the caller's own `team_id`. That is the only lock on the definer paths. `membership` is closed
  to `authenticated` (`20261027120000_mir11_composite_foreign_keys.sql:204`), so its rows can only be
  reached through definer functions.

## Decision

1. **MIR-21-b moves the writers, and keeps the column true.** Every writer that changes a person's
   team or rank writes `membership` directly, in its own body, and keeps writing `member.team_id` and
   `member.role` as it does today. The column stays equal to the roster team for every row, so
   ADR-077's equivalence test keeps holding until the column is dropped.
2. **One private helper writes a primary membership: `public.membership_make_primary(uuid, uuid)`.**
   `admit_member`, `move_member` and `create-account.sql` call it. It does what the mirror's
   team-change branch does:
   - it closes the active primary row on another team;
   - it then promotes an active row on the target team, or else opens a new one.

   It is `security invoker` and is revoked from `public`, `anon` and `authenticated`. So it runs only
   as the owner, inside a definer function or an owner-run script.
3. **The mirror keeps only what no writer covers.** The `member_sync_membership` trigger becomes
   `after insert or update of removed_at`. The function loses its team-change and rank-change
   branches. Its INSERT branch (fixtures) and its removal branch (the seam's PATCH) are unchanged.
4. **The write-side predicates read the roster team.** In `admit_member`, `reject_member`,
   `move_member`, `set_member_team`, `set_member_role`, `promote_member_to_admin`, `delete_team` and
   the `member_update_admin` policy, every comparison against `member.team_id` becomes a comparison
   against `public.member_roster_team_id(id)`. `grant_system_admin` drops its `m.team_id is null`
   clause, because its `not exists (… membership …)` clause already implies it.
5. **MIR-21-c drops the column, and takes everything that names it.** It drops:
   - the column, its index and its `update` grant;
   - `public.member_team_id(uuid)`;
   - the mirror's INSERT branch;
   - the column assignments that decision 1 keeps.

   It also rewrites:
   - every fixture and test that names the column;
   - `stamp_org_id`'s `member` branch;
   - `admit_allow_listed_member`'s column list;
   - `member_decide_admin`, which is inert since ADR-064 decision 1;
   - the seam's three row-returning RPC calls;
   - `.ai/standards/data-model.md`.

   It plans its own contract, and splits again if its count is `L`.
6. **MIR-21-c inherits two obligations it may not drop:**
   - **ADR-064 decision 3.** When the column goes, the refusal of a change to the caller's own team
     moves to `membership`, and still reaches every definer path.
   - **The removal branch** (decision 3). Something must still close a removed member's rows at
     `greatest(removed_at, joined_at)`.

   How each one is carried is MIR-21-c's PLAN.
7. **Features MIR-16, MIR-17, MIR-19 and MIR-20 are blocked by MIR-21-c as well.** They were blocked
   on the column being dropped (ADR-077 decision 6), and the drop is now MIR-21-c.

## Options considered

- **One ticket: writers and drop.** Rejected: it is `L` (*Context*).
- **Writers write only `membership`, and the column goes stale until the drop.** Rejected. The stale
  value reaches the UI through three seam methods, and it breaks ADR-077's equivalence test. Fixing
  the seam in this slice puts it at thirteen paths, which is `L`.
- **Writers write both, and the mirror stays whole.** Rejected: each move writes `membership` twice,
  and the second write undoes the first (*Context*).
- **Fixtures first, then writers.** Rejected. While the writers' predicates still read the column, a
  fixture that stopped setting it would make every writer refuse that person.
- **The membership logic inlined in `admit_member` and `move_member`.** Rejected. That gives two
  copies of the mirror's rule plus a third in `create-account.sql`, and the copies can drift. One
  helper is one definition.
- **A `membership` trigger refusing the caller's own rows, added now.** Deferred to MIR-21-c. Under
  decision 1 every writer still writes the column, so ADR-064's existing lock still fires on every
  path. A second lock now would duplicate it for one ticket's lifetime.

## Consequences

- During MIR-21-b, `membership` is written by the writers and the column is written by the same
  statements. ADR-077's AC-1 (`220-roster-team-from-membership.test.sql`) is unchanged and still
  passes.
- Until MIR-21-c ships, the column is read only by:
  - `member_enforce_role_and_removal` (the self lock);
  - `stamp_org_id` (on insert);
  - `member_decide_admin`;
  - `public.member_team_id(uuid)`, which nothing in the database calls.
- An owner-run `update public.member set team_id = …` no longer changes `membership`. No product
  path does this. The one script that did, `create-account.sql`, calls the helper instead.
- MIR-21-c is predicted `L` (about twenty paths), so its PLAN splits it again.

## Revert condition

A writer is found that changes `team_id` or `role` outside the functions decision 4 names. If so,
the mirror's branch for that column comes back until that writer moves.
