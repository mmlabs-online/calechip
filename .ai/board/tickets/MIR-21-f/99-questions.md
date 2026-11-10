---
from: developer
to: tech-lead-design
asked_at: 2026-11-07
---

**Q.** `01-plan.md` § 1 and § 7 keep `supabase/tests/070-definer-callers.test.sql` out of scope, but
the drop breaks it. Measured, not predicted, against the local stack (`pnpm db:test`):

- with every MIR-21-f file except the migration: `070` **PASS**;
- with the migration `20261107180000_mir21f_drop_member_team_id.sql` applied: `070` aborts at line 118
  with `ERROR: column "team_id" does not exist` (`Bad plan. You planned 73 tests but ran 67`).

```
supabase/tests/070-definer-callers.test.sql:117-119
select is_empty(
  $$select 1 from public.list_members_for_team(tests.id('team_t')) where team_id = tests.id('team_u')$$,
  'AC-9 admin_t: list_members_for_team(T) holds no member of U (cross-team-reads.test.ts:52)');
```

`public.list_members_for_team(uuid)` returns `setof public.member`
(`20261105150000_mir21_reads_off_member_team_id.sql:102`), so after the drop its rows have no
`team_id`. This is the only consumer the plan's sweep missed: the seam selects `MEMBER_COLUMNS`
from that RPC, which reads `team_id:roster_team_id` (a computed field on `public.member`, which
PostgREST resolves on a `setof public.member` result), so the application is unaffected — only this
test's filter names the column. No other pgTAP file fails because of this ticket.

AC-11 ("the existing suite passes against the dropped schema") cannot be met without changing it,
and RULE-03 forbids me editing it.

**Recommended:** amend § 7 and `ticket.yaml` `allowed_paths` to add
`supabase/tests/070-definer-callers.test.sql`, with the narrow change that line 118's filter becomes
`where public.member_roster_team_id(id) = tests.id('team_u')`. Same assertion (no member of U in T's
roster), read from `membership`, which is what every other post-MIR-21 test reads. `plan(73)`
unchanged. Path count becomes 12; `size` stays `M`.

**Separately, for the record — not a question:** `170-multi-team-decisions.test.sql` test 42
(`AC-20: admin_u does not select E`, have 1, want 0) fails **with and without** this ticket's
migration. It is pre-existing and not caused by the drop; it is noted in `03-impl-log.md` and not
touched.

---
answered_by: tech-lead-design
answered_at: 2026-11-07T07:42:15Z
---

**A.** Agreed; verified against `070-definer-callers.test.sql:116-118` and
`20261105150000_mir21_reads_off_member_team_id.sql:102-111`. The sweep missed this reader. Added as
`01-plan.md` § 4.12 and to § 7 / `allowed_paths` (12 paths, `size` stays `M`). The exact change: the
query string on line 117 becomes
`$$select 1 from public.list_members_for_team(tests.id('team_t')) where public.member_roster_team_id(id) = tests.id('team_u')$$,`
— nothing else in the file changes; the label on line 118 and `plan(73)` stay. (Your "line 118" is the
statement's error position; the string itself sits on 117.) `member_roster_team_id(uuid)` is granted to
`authenticated` (same migration, line 49), and the statement runs as `admin_t`. The 170 test 42
note is acknowledged as pre-existing and stays out of scope.
