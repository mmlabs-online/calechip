---
doc_version: 3
last_updated: 2026-11-07
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-084 — The pgTAP fixtures name the admin role through one helper first, and the value is then renamed in place, with no expand-then-contract window

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-07 — at `/plan MIR-16-d` (ADR-008, ADR-067).

This ADR takes the decision ADR-083 decision 2 left to MIR-16-d's PLAN: *"If it counts `L`, the
expand-then-contract shape above is the split this ADR expects it to take, but its PLAN decides."*
It takes a different shape from the one ADR-083 expected. It reverses no accepted decision.
ADR-082 decision 3 (in Org public, today's admins become its `org_admin`s) stands, and this ADR is
how it is carried out.

## Context

- **Counted against the local database on 2026-11-07** (migrations through `20261107230000`):
  - Five `public` functions spell `'admin'` in their stored text: `is_org_admin`,
    `member_enforce_role_and_removal`, `may_decide`, `set_member_role` and
    `promote_member_to_admin`.
  - No policy, check constraint, column default, index predicate or view spells the role value.
    The only `'admin'` in a constraint is `org_code_not_reserved`, which is text and unrelated.
- **Outside the database**, the rename reaches `bootstrap.sql`, `seed.sql`, `_isolation.psql`,
  `src/lib/data/supabase.ts`, and 12 pgTAP files that insert or read back `'admin'` (040, 100, 120,
  140, 220, 230, 240, 250, 260, both 270s and 280). With the migration and its own test that is
  about 18 paths. That is `L` (`.ai/01-operating-model.md` § Sizing).
- **The demotion trigger refuses every change away from `'admin'`.**
  `member_enforce_role_and_removal` raises `42501` when `old.role = 'admin'` and the role changes,
  and it has no carve-out for a session with no user token. An expand-then-contract split would add
  `'org_admin'` and then move each admin row to it with an `update`. The trigger refuses that
  update. `member_record_role_change` would also write one audit row per admin for a change no
  person made.
- **`alter type public.member_role rename value 'admin' to 'org_admin'`** updates no row and fires no
  trigger. There is never a moment when two values mean one role. It is one statement, and it is
  atomic with the five bodies re-created in the same migration.
- **What makes the rename `L` is the fixtures, not the schema.** Once the value is renamed, every
  test that spells `'admin'` fails at once. But a test does not have to spell the value. If it asks
  one helper for it, the rename changes the helper's body and not the test.

## Decision

1. **MIR-16-d adds a pgTAP helper and moves the harness and seven fixture files onto it.** It
   changes no migration, no function, no row and no application code.
   - `tests.member_role(p_role text) returns public.member_role` is created in
     `supabase/tests/_isolation.psql`. A test names a role in the application's words (`'member'`,
     `'manager'`, `'admin'`). The helper returns the `public.member_role` value that means it. It is
     the one place in `supabase/tests/` that spells the database value of the admin role.
   - `_isolation.psql`'s `tests.seed()` and the files 040, 100, 120, 140, 220, 230 and 240 name the
     admin role only through it.
   - A new file, `290-member-role-helper.test.sql`, asserts that what the helper returns for
     `'admin'` is the value `is_org_admin` recognises and `promote_member_to_admin` writes. Those
     assertions hold on both sides of the rename, so MIR-16-e does not edit that file.
2. **MIR-16-e is a new slice: the value is renamed in place.** It holds:
   - one migration that runs `alter type … rename value 'admin' to 'org_admin'` and re-creates the
     five bodies;
   - the helper's `'admin'` branch, `bootstrap.sql` and `seed.sql`;
   - the member seam, which maps `'org_admin'` to the application's `"admin"` both ways until
     MIR-17. That includes the `p_role` argument of `set_member_role`, because an `"admin"`
     argument would otherwise fail as `22P02` instead of the `42501` refusal the seam maps today;
   - the last five fixture files: 250, 260, 270-issue-reports, 270-member-team-id and 280.

   It shares MIR-16's feature row and plans its own count. It was counted at about 11 paths on
   2026-11-07.
3. **No expand-then-contract.** `'org_admin'` is never added beside `'admin'`, and no reader
   accepts both. ADR-083 *Options considered* and its decision 2 expected that shape. This ADR
   replaces it with decisions 1 and 2.
4. **Order.** MIR-16-e depends on MIR-16-d. MIR-16-c depends on MIR-16-e as well, for ADR-083
   decision 4's reason: it re-creates the type, which is simpler once `'admin'` is `'org_admin'`.
   MIR-17 depends on MIR-16-c, so it waits for MIR-16-e through MIR-16-c and its `depends_on` is not
   edited (ADR-082 decision 5's precedent).
5. **Any pgTAP file written between MIR-16-d and MIR-16-e names the admin role through
   `tests.member_role`.** Otherwise MIR-16-e's count grows by one file for each.

## Options considered

- **The rename in one ticket.** Rejected: about 18 paths, `L`, and `L` must split at PLAN.
- **Expand then contract, ADR-083's expectation.** Add `'org_admin'`, have writers write it,
  readers accept both, move the rows, then move the fixtures and remove `'admin'`. Rejected:
  - moving the rows needs the demotion trigger re-created with an exception for this one
    transition;
  - it writes a role-change audit row per admin that no person made;
  - for at least one slice, two enum values mean one role in five bodies and the seam;
  - removing `'admin'` re-creates the type, which ties the contract to MIR-16-c.

  It does let the fixtures move one file at a time. Decision 1 gets the same freedom without the
  window.
- **Split the fixtures by file with no helper.** Each slice would rewrite `'admin'` to `'org_admin'`
  in its files. Rejected: before the rename `'org_admin'` is not a value, so a file moved early
  fails. Only the slice that renames can move them.
- **Do not rename. `'admin'` stays and means org admin** (ADR-083's revert condition). Rejected.
  P4-1 says *"`member.role` becomes `org_admin` | `member`"*, and ADR-082 decision 3 and ADR-083
  decision 2 both name the value. The name is also what stops the next reader confusing it with
  `system_admin`, now that both exist.

## Consequences

- Between MIR-16-d and MIR-16-e, `tests.member_role('admin')` returns `'admin'`, and five fixture
  files still spell `'admin'` directly. Both are expected. MIR-16-e removes the second.
- The pgTAP fixtures now speak the application's role vocabulary. The parity document in
  `100-mock-parity.test.sql` already did, and it is the same vocabulary `src/lib/data/mock.ts` reads.
  MIR-17 decides whether the application's `"admin"` is renamed as well. If it is, the helper's
  `'admin'` branch is where the tests follow.
- Unlike `add value`, `rename value` may run inside the migration's `begin; … commit;`, so the
  rename and the five bodies land together or not at all. Applying it to the hosted project is
  human-only (RULE-09).

## Revert condition

MIR-16-e's PLAN finds a reason the in-place rename cannot ship, for example a hosted object that
stores the value as text and that the local catalogue does not hold. Then decision 3 is superseded
and expand-then-contract returns. The helper stands either way, because it shortens any rename.
