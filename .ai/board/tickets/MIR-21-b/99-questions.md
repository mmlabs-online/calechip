---
from: developer
to: tech-lead-design
asked_at: 2026-11-05T21:40:00+07:00
---

**Q.** `01-plan.md` § 4.6 says no existing test changes, and that a failing one is a defect in the
contract to route here. One does fail: `supabase/tests/160-read-path-org-bound.test.sql`. Measured
with `pnpm db:test`: with this ticket's migration, 160 stops at `:267` with
`ERROR: attendance_not_permitted` (`event_attendance_guard`), "Bad plan. You planned 49 tests but
ran 44". With the ticket stashed, 160 passes. (170 fails test 42 either way; it is pre-existing and
not this ticket's.)

The cause is its AC-9 fixture, `160:263-268`:

```sql
update public.member set status = 'approved', team_id = tests.id('team_t') where id = tests.id('pending_p');
insert into public.event_attendance (...) values (..., tests.id('pending_p'), 'attending');
update public.member set status = 'pending', team_id = null where id = tests.id('pending_p');
```

It is a direct column write, as the owner, that relied on the mirror's team-change branch to open a
`membership` row for the guard to see. § 4.4 removes that branch, so the guard now sees no team.
§ 8's list of tests that "pass as written" missed this one: it is the only direct `team_id` write in
`supabase/tests/**` outside a refusal check (grep of `set … team_id =`; 040:19 is a `throws_ok`,
120:267 and :441 pass).

160 is outside `allowed_paths`, so I cannot fix it (RULE-03). Recommended resolution: add
`supabase/tests/160-read-path-org-bound.test.sql` to `allowed_paths`, limited to the AC-9 fixture
at `:263-268`, which writes `membership` the way the writers now do:

```sql
update public.member set status = 'approved', team_id = tests.id('team_t') where id = tests.id('pending_p');
-- ADR-078: the mirror no longer writes on a team change; the fixture writes the row the writers write.
select public.membership_make_primary(tests.id('pending_p'), tests.id('team_t'));
insert into public.event_attendance (...);
update public.member set status = 'pending', team_id = null where id = tests.id('pending_p');
-- and closes it again, as the mirror's team-change branch did on the way back.
update public.membership set left_at = now(), is_primary = false, updated_at = now()
 where member_id = tests.id('pending_p') and left_at is null;
```

That leaves pending_p exactly as before this ticket: one closed row, no active row, and
`member_roster_team_id` null. No assertion in 160 changes. Ten paths, still `M`.

The alternative — keeping the mirror's team-change branch — re-creates § 8's rejected
"writers write both" double row on every move, so I do not recommend it.

**A.**

```yaml
from: tech-lead-design
answered_at: 2026-11-05T21:30:27+07:00
resulted_in_amendment: true
```

Accepted as recommended. It is a defect in § 4.6, not in the migration: § 4.4 is right to remove the
team-change branch, and keeping it is § 8's rejected double row.

`supabase/tests/160-read-path-org-bound.test.sql` is now in `allowed_paths` (`01-plan.md` § 7,
`ticket.yaml`), limited to the AC-9 fixture at `:263-268`:

- after `:265`, add `select public.membership_make_primary(tests.id('pending_p'), tests.id('team_t'));`;
- after `:268`, add `update public.membership set left_at = now(), is_primary = false, updated_at = now() where member_id = tests.id('pending_p') and left_at is null;`;
- an ADR-078 comment beside each, and the comment at `:263-264` may be reworded to match.

No assertion, plan count or other line of 160 changes. § 4.6 and § 7 are amended (ten paths, still
`M`), with a Changelog row. `170` test 42 is pre-existing and not this ticket's; leave it.
