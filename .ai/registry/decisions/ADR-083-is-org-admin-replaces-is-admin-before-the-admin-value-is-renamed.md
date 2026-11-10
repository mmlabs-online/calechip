---
doc_version: 3
last_updated: 2026-11-07
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-083 — `is_org_admin(uid, org_id)` replaces `is_admin(uid)` first, and renaming the value `'admin'` is a fourth slice, MIR-16-d

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-07 — at `/plan MIR-16-b` (ADR-008, ADR-067).

This ADR amends ADR-082 decision 1's description of MIR-16-b. That decision allowed this:
*"It plans its own count, and splits again if it is `L`."* It reverses no other decision. ADR-082
decisions 2 and 3 stand as written.

## Context

- ADR-082 decision 1 gave MIR-16-b four things. It renames the enum value, replaces `is_admin(uid)`
  with `is_org_admin(uid, org_id)`, resolves the demotion trigger, and updates the bootstrap, seed
  and fixtures. The member seam maps `'org_admin'` back to `"admin"`.
- **Counted against the local database on 2026-11-07** (migrations through `20261107180000`):
  - Besides `is_admin` itself, 21 `public` functions call `is_admin(` or spell `'admin'`. 19 of them
    call it, at 20 call sites.
  - 15 policies call `is_admin(` (`pg_policies`). Three of them are the issue-report policies MIR-16
    drops (`20261107210000_mir16_issue_reports_system_scope.sql`). That leaves 12.
  - No function outside `public` and no view calls it.
- **The rename reaches 13 pgTAP files that insert `role = 'admin'`**, plus `_isolation.psql`,
  `seed.sql`, `bootstrap.sql`, `supabase.ts`, the migration and its test. That is about 19 paths,
  which is `L` (`.ai/01-operating-model.md` § Sizing).
- **Replacing the predicate reaches none of those files.** Every call site is already bounded by
  `member_org_id`, and a person belongs to exactly one org. So `is_admin(u)` and
  `is_org_admin(u, member_org_id(u))` always give the same answer. The suite that already proves
  each admin power (150, 160, 170, 200, 210, 240 and others) is the regression proof. Only
  `010-catalogue` (its definer census) and `100-mock-parity` (it calls `is_admin`) name the function.
- **The rename cannot be split by fixture file.** Once the value is renamed, every insert that
  spells `'admin'` fails at once. To split it, `'org_admin'` would be added beside `'admin'`, writers
  would write it, and readers would accept both for a while (expand, then contract). That is a
  decision about the rename, and it belongs to the ticket that does the rename.

## Decision

1. **MIR-16-b replaces the predicate and nothing else.**
   - `public.is_org_admin(p_uid uuid, p_org_id uuid)` is added. It still reads
     `role = 'admin'::public.member_role`.
   - Every call of `public.is_admin(` in a `public` function body or in a policy is replaced, as
     listed in MIR-16-b `01-plan.md` § 4.1.
   - `public.is_admin(uuid)` is dropped without `cascade`. A policy that was missed then makes the
     migration fail.
   - No enum value, row, fixture, seed, bootstrap or seam line changes.
2. **MIR-16-d is a new slice: the value `'admin'` becomes `'org_admin'`.** It covers the enum
   value, every body that spells `'admin'` (`is_org_admin` included), the demotion trigger's wording
   (`member_enforce_role_and_removal`), `bootstrap.sql`, `seed.sql`, the pgTAP fixtures, and the
   member seam's mapping of `'org_admin'` to `"admin"`. It shares MIR-16's feature row and plans its
   own count. If it counts `L`, the expand-then-contract shape above is the split this ADR expects
   it to take, but its PLAN decides.
3. **The demotion trigger's "ambiguity between the two admin kinds" is gone at the database.** It is
   recorded here so that no slice reopens it. Since MIR-18, a system admin is a row in
   `public.system_admin`, not a value of `member.role` (ADR-074). So the trigger can only ever see
   one kind of admin. Naming that kind `org_admin` is a rename, and it belongs to MIR-16-d.
4. **Order.** MIR-16-d depends on MIR-16-b. MIR-16-c depends on MIR-16-d, because MIR-16-c
   re-creates `public.member_role` without `'manager'`, and that is simpler once `'admin'` is
   already `'org_admin'`. MIR-17 is blocked by MIR-16-d as well. MIR-20 stays blocked through MIR-17,
   unchanged (ADR-082 decision 5).

## Options considered

- **Keep MIR-16-b whole, at about 19 paths.** Rejected: `L` must split at PLAN.
- **MIR-16-b renames the value and MIR-16-d replaces the predicate.** Rejected. The rename is the
  `L` half, so this would only move the split onto the other ticket. The predicate is also the half
  that changes nothing observable, so it is the safer one to ship first.
- **Expand-then-contract inside MIR-16-b**: add `'org_admin'`, re-point everything, and accept both
  values. Rejected for this slice. `ALTER TYPE … ADD VALUE` needs its own migration transaction
  before a `language sql` body may spell the new value. It also puts a period where two enum values
  mean one thing into a ticket whose job is a predicate swap. If MIR-16-d needs that shape, it can
  choose it.
- **Keep `is_admin(uid)` as a wrapper over `is_org_admin`.** Rejected. P4-1 says *replace*, and a
  wrapper keeps the call sites that carry no org.

## Consequences

- Between MIR-16-b and MIR-16-d, `is_org_admin` checks `role = 'admin'`. The function's name and
  the value it reads disagree for one slice. Its own body comment says so.
- Comments in `src/lib/data/supabase.ts` and `src/lib/data/index.ts` still say `is_admin`. They go
  stale and are left alone. They are not behaviour, and MIR-17 rewrites those guards.
- Old migrations keep spelling `is_admin`, because migrations are append-only. The vitest files that
  read a specific old migration's text (`tests/cross-team-reads.test.ts:234`,
  `tests/notifications.test.ts:549`) are unaffected.

## Revert condition

If MIR-16-d finds the rename should not happen (the value stays `'admin'` and means org admin), its
PLAN supersedes decision 2. This slice stands either way.
