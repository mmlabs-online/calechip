-- MIR-15-b AC-1 to AC-13: only a system admin at `aal2` writes Org public's holidays, through four
-- `security definer` RPCs that resolve Org public themselves; a dedicated org's admin keeps the
-- write on their own org; each org reads only its own rows (ADR-079 decisions 1 to 3).
--
-- Fixture, added here on top of `tests.seed()` as `postgres` (01-plan.md § 2). The seed's org is
-- Org public; `admin_t` is Ada, `member_t` is Alice, `pending_p` is Pat.
--   * Org D (`org_d`, `org_code = 'mir15b-d'`) with team D1, Dora (`admin`) and Dan (`member`), both
--     approved; the fixture writes each a membership on D1 with `tests.put_on_team` (MIR-21-f).
--   * Sam — an `auth.users` row made a system admin with `grant_system_admin`, as in
--     `200-org-management.test.sql`. No member row.
--   * H-P — Org public, 2031-01-01, `Tet Duong lich`, `non_working`.
--   * H-P2 — Org public, 2031-02-08, `Lam bu`, `working`: the "another Org public row" of AC-6.
--   * H-D — Org D, 2031-01-01, `New Year (D)`, `non_working`.
--
-- "At aal2" is claims `{"sub", "role": "authenticated", "aal": "aal2"}`; `tests.authenticate_at` is
-- copied from `200-org-management.test.sql:33-40`. `_isolation.psql` is not edited.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(54);
select tests.seed();

-- The fixture ids local to this file. Labels are fixture names, not schema fields.
create function tests.m15b(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('b2400000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('sam', 'a1'), ('org_d', 'b1'), ('team_d1', 'b2'), ('dora', 'c1'), ('dan', 'c2'),
      ('h_p', 'd1'), ('h_p2', 'd2'), ('h_d', 'd3')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- Become X at an assurance level. Transaction-local, like `tests.authenticate_as`.
create function tests.authenticate_at(p_id uuid, p_aal text) returns void
  language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Org public's id. Definer, so a test running as `authenticated` can name it in a call.
create function tests.shared_org() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- "The holiday table is as it was" (AC-8): every row's text, before and after. Definer, so it runs
-- under any role.
create table tests.baseline (holiday_rows text not null);
create function tests.holiday_text() returns text
  language sql stable security definer set search_path = '' as $$
  select coalesce(string_agg(h::text, ',' order by h.id), '') from public.holiday h;
$$;
create function tests.snapshot() returns void
  language sql volatile security definer set search_path = '' as $$
  delete from tests.baseline;
  insert into tests.baseline (holiday_rows) select tests.holiday_text();
$$;
create function tests.unchanged() returns boolean
  language sql stable security definer set search_path = '' as $$
  select b.holiday_rows = tests.holiday_text() from tests.baseline b;
$$;

-- The ids the RPCs return, captured by the caller.
create table tests.created (label text primary key, id uuid not null);
grant select, insert on table tests.created to authenticated;

-- Org D, D1, Dora and Dan.
insert into public.org (id, org_code, name, is_shared_tenant)
values (tests.m15b('org_d'), 'mir15b-d', 'Org D', false);
insert into public.team (id, name, org_id) values (tests.m15b('team_d1'), 'Team D1', tests.m15b('org_d'));
insert into auth.users (id, email) values
  (tests.m15b('dora'), 'dora@mir15b.test'),
  (tests.m15b('dan'), 'dan@mir15b.test'),
  (tests.m15b('sam'), 'sam@mir15b.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m15b('dora'), tests.m15b('org_d'), 'Dora', '1.png', tests.member_role('admin'), 'approved', 'dora@mir15b.test'),
  (tests.m15b('dan'), tests.m15b('org_d'), 'Dan', '1.png', 'member', 'approved', 'dan@mir15b.test');
select tests.put_on_team(tests.m15b('dora'), tests.m15b('team_d1'));
select tests.put_on_team(tests.m15b('dan'), tests.m15b('team_d1'));
select public.grant_system_admin(tests.m15b('sam'));

insert into public.holiday (id, org_id, date, name, kind) values
  (tests.m15b('h_p'), tests.shared_org(), '2031-01-01', 'Tet Duong lich', 'non_working'),
  (tests.m15b('h_p2'), tests.shared_org(), '2031-02-08', 'Lam bu', 'working'),
  (tests.m15b('h_d'), tests.m15b('org_d'), '2031-01-01', 'New Year (D)', 'non_working');

-- ---------------------------------------------------------------------------------------------
-- The read policy is replaced.
-- ---------------------------------------------------------------------------------------------
select ok(not exists (select 1 from pg_catalog.pg_policies p
                       where p.schemaname = 'public' and p.tablename = 'holiday'
                         and p.policyname = 'holiday_select_all'),
  'holiday_select_all no longer exists');
select ok(exists (select 1 from pg_catalog.pg_policies p
                   where p.schemaname = 'public' and p.tablename = 'holiday'
                     and p.policyname = 'holiday_select_own_org' and p.cmd = 'SELECT'),
  'holiday_select_own_org exists, for select');

-- ---------------------------------------------------------------------------------------------
-- AC-11. Each org reads only its own row for a date.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_t'));
select results_eq($$select h.id from public.holiday h where h.date = '2031-01-01'$$,
  format('values (%L::uuid)', tests.m15b('h_p')),
  'AC-11: Alice (Org public) reads exactly H-P on 2031-01-01');
select tests.authenticate_as(tests.m15b('dan'));
select results_eq($$select h.id from public.holiday h where h.date = '2031-01-01'$$,
  format('values (%L::uuid)', tests.m15b('h_d')),
  'AC-11: Dan (Org D) reads exactly H-D on 2031-01-01');

-- ---------------------------------------------------------------------------------------------
-- AC-12. A caller with no org reads none.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('pending_p'));
select is((select count(*)::int from public.holiday), 0, 'AC-12: Pat (pending) reads zero holiday rows');
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select is((select count(*)::int from public.holiday), 0,
  'AC-12: Sam at aal2, with no member row, reads zero rows from public.holiday');

-- ---------------------------------------------------------------------------------------------
-- AC-10. The door lists Org public's calendar, and only it.
-- ---------------------------------------------------------------------------------------------
select results_eq($$select l.id from public.list_national_holidays('2031-01-01', '2031-12-31') l$$,
  format('values (%L::uuid), (%L::uuid)', tests.m15b('h_p'), tests.m15b('h_p2')),
  'AC-10: Sam at aal2 lists Org public''s 2031 rows, ascending by date, and not H-D');
select results_eq(
  format($$select l.date, l.name, l.kind::text from public.list_national_holidays('2031-01-01', '2031-12-31') l
            where l.id = %L::uuid$$, tests.m15b('h_p')),
  $$values ('2031-01-01'::date, 'Tet Duong lich'::text, 'non_working'::text)$$,
  'AC-10: H-P is listed with its date, name and kind');
select isnt(
  (select l.created_at from public.list_national_holidays('2031-01-01', '2031-12-31') l
    where l.id = tests.m15b('h_p')),
  null,
  'AC-10: H-P is listed with its created_at');

-- ---------------------------------------------------------------------------------------------
-- AC-1. An admin of Org public cannot add to its calendar.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select throws_ok($$insert into public.holiday (date, name) values ('2031-03-01', 'Ada''s day')$$,
  '42501', null, 'AC-1: Ada inserting a holiday with no org_id is refused with 42501');
select throws_ok(
  format($$insert into public.holiday (date, name, org_id) values ('2031-03-01', 'Ada''s day', %L::uuid)$$,
         tests.shared_org()),
  '42501', null, 'AC-1: Ada inserting a holiday with Org public''s org_id is refused with 42501');
select tests.clear_authentication();
select is((select count(*)::int from public.holiday h
            where h.org_id = tests.shared_org() and h.date = '2031-03-01'), 0,
  'AC-1: Org public has no row on 2031-03-01');

-- ---------------------------------------------------------------------------------------------
-- AC-2. Nor change or remove one of its rows.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is(tests.rows_affected(format($$update public.holiday set name = 'x' where id = %L::uuid$$,
                                     tests.m15b('h_p'))),
  0::bigint, 'AC-2: Ada updating H-P affects zero rows');
select is(tests.rows_affected(format($$delete from public.holiday where id = %L::uuid$$, tests.m15b('h_p'))),
  0::bigint, 'AC-2: Ada deleting H-P affects zero rows');
select tests.clear_authentication();
select results_eq(
  format($$select h.date, h.name, h.kind::text from public.holiday h where h.id = %L::uuid$$, tests.m15b('h_p')),
  $$values ('2031-01-01'::date, 'Tet Duong lich'::text, 'non_working'::text)$$,
  'AC-2: H-P is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-3. An admin of a dedicated org still maintains that org's calendar (until MIR-16).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15b('dora'));
select lives_ok($$insert into public.holiday (date, name) values ('2031-03-02', 'Dora''s day')$$,
  'AC-3: Dora inserts a holiday on 2031-03-02 with no org_id');
select tests.clear_authentication();
select is((select h.org_id from public.holiday h where h.date = '2031-03-02'), tests.m15b('org_d'),
  'AC-3: and it lands in Org D');
select tests.authenticate_as(tests.m15b('dora'));
select is(tests.rows_affected($$update public.holiday set name = 'Dora renamed' where date = '2031-03-02'$$),
  1::bigint, 'AC-3: Dora renames it');
select tests.clear_authentication();
select is((select h.name from public.holiday h where h.date = '2031-03-02'), 'Dora renamed',
  'AC-3: and it takes the new name');
select tests.authenticate_as(tests.m15b('dora'));
select is(tests.rows_affected($$delete from public.holiday where date = '2031-03-02'$$),
  1::bigint, 'AC-3: Dora deletes it');
select tests.clear_authentication();
select is((select count(*)::int from public.holiday h where h.date = '2031-03-02'), 0,
  'AC-3: and it is gone');

-- ---------------------------------------------------------------------------------------------
-- AC-8. Nobody else can use the door.
-- ---------------------------------------------------------------------------------------------
select tests.snapshot();

select tests.authenticate_at(tests.m15b('sam'), 'aal1');
select throws_ok($$select * from public.list_national_holidays('2031-01-01', '2031-12-31')$$,
  '42501', null, 'AC-8: Sam at aal1 — list_national_holidays is refused with 42501');
select throws_ok($$select public.add_national_holiday('2031-03-05', 'x', 'non_working')$$,
  '42501', null, 'AC-8: Sam at aal1 — add_national_holiday is refused with 42501');
select throws_ok(
  format($$select public.update_national_holiday(%L::uuid, '2031-03-05', 'x', 'non_working')$$, tests.m15b('h_p')),
  '42501', null, 'AC-8: Sam at aal1 — update_national_holiday is refused with 42501');
select throws_ok(format($$select public.delete_national_holiday(%L::uuid)$$, tests.m15b('h_p')),
  '42501', null, 'AC-8: Sam at aal1 — delete_national_holiday is refused with 42501');

select tests.authenticate_at(tests.id('admin_t'), 'aal2');
select throws_ok($$select * from public.list_national_holidays('2031-01-01', '2031-12-31')$$,
  '42501', null, 'AC-8: Ada — list_national_holidays is refused with 42501');
select throws_ok($$select public.add_national_holiday('2031-03-05', 'x', 'non_working')$$,
  '42501', null, 'AC-8: Ada — add_national_holiday is refused with 42501');
select throws_ok(
  format($$select public.update_national_holiday(%L::uuid, '2031-03-05', 'x', 'non_working')$$, tests.m15b('h_p')),
  '42501', null, 'AC-8: Ada — update_national_holiday is refused with 42501');
select throws_ok(format($$select public.delete_national_holiday(%L::uuid)$$, tests.m15b('h_p')),
  '42501', null, 'AC-8: Ada — delete_national_holiday is refused with 42501');

select tests.authenticate_as(tests.id('member_t'));
select throws_ok($$select * from public.list_national_holidays('2031-01-01', '2031-12-31')$$,
  '42501', null, 'AC-8: Alice — list_national_holidays is refused with 42501');
select throws_ok($$select public.add_national_holiday('2031-03-05', 'x', 'non_working')$$,
  '42501', null, 'AC-8: Alice — add_national_holiday is refused with 42501');
select throws_ok(
  format($$select public.update_national_holiday(%L::uuid, '2031-03-05', 'x', 'non_working')$$, tests.m15b('h_p')),
  '42501', null, 'AC-8: Alice — update_national_holiday is refused with 42501');
select throws_ok(format($$select public.delete_national_holiday(%L::uuid)$$, tests.m15b('h_p')),
  '42501', null, 'AC-8: Alice — delete_national_holiday is refused with 42501');

select tests.clear_authentication();
select ok(tests.unchanged(), 'AC-8: the holiday table is as it was');

select ok(not has_function_privilege('anon', 'public.list_national_holidays(date,date)', 'EXECUTE'),
  'AC-8: anon has no EXECUTE on list_national_holidays(date,date)');
select ok(not has_function_privilege('anon', 'public.add_national_holiday(date,text,public.holiday_kind)', 'EXECUTE'),
  'AC-8: anon has no EXECUTE on add_national_holiday(date,text,holiday_kind)');
select ok(not has_function_privilege('anon',
            'public.update_national_holiday(uuid,date,text,public.holiday_kind)', 'EXECUTE'),
  'AC-8: anon has no EXECUTE on update_national_holiday(uuid,date,text,holiday_kind)');
select ok(not has_function_privilege('anon', 'public.delete_national_holiday(uuid)', 'EXECUTE'),
  'AC-8: anon has no EXECUTE on delete_national_holiday(uuid)');

-- ---------------------------------------------------------------------------------------------
-- AC-7. A blank name is refused.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select throws_ok($$select public.add_national_holiday('2031-03-04', '   ', 'non_working')$$,
  '22023', null, 'AC-7: a name of only spaces is refused with 22023');
select tests.clear_authentication();
select is((select count(*)::int from public.holiday h where h.date = '2031-03-04'), 0,
  'AC-7: and no row exists on 2031-03-04');

-- ---------------------------------------------------------------------------------------------
-- AC-9. The door does not reach a dedicated org.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select throws_ok(
  format($$select public.update_national_holiday(%L::uuid, '2031-01-09', 'Moved', 'working')$$, tests.m15b('h_d')),
  'P0002', null, 'AC-9: update_national_holiday on H-D is refused with P0002');
select throws_ok(format($$select public.delete_national_holiday(%L::uuid)$$, tests.m15b('h_d')),
  'P0002', null, 'AC-9: delete_national_holiday on H-D is refused with P0002');
select tests.clear_authentication();
select results_eq(
  format($$select h.org_id, h.date, h.name, h.kind::text from public.holiday h where h.id = %L::uuid$$,
         tests.m15b('h_d')),
  format($$values (%L::uuid, '2031-01-01'::date, 'New Year (D)'::text, 'non_working'::text)$$,
         tests.m15b('org_d')),
  'AC-9: H-D is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-6. A second row for a date Org public already has is refused.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select throws_ok($$select public.add_national_holiday('2031-01-01', 'Again', 'non_working')$$,
  '23505', null, 'AC-6: adding a second row on 2031-01-01 is refused with 23505');
select throws_ok(
  format($$select public.update_national_holiday(%L::uuid, '2031-01-01', 'Lam bu', 'working')$$, tests.m15b('h_p2')),
  '23505', null, 'AC-6: moving H-P2 onto 2031-01-01 is refused with 23505');
select tests.clear_authentication();
select is((select count(*)::int from public.holiday h
            where h.org_id = tests.shared_org() and h.date = '2031-01-01'), 1,
  'AC-6: Org public still has exactly one row on 2031-01-01');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A system admin at aal2 adds a day to Org public.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select lives_ok(
  $$insert into tests.created (label, id)
    select 'gio_to', public.add_national_holiday('2031-03-03', 'Gio To', 'non_working')$$,
  'AC-4: Sam at aal2 adds 2031-03-03');
select tests.clear_authentication();
select results_eq(
  $$select h.org_id, h.date, h.name, h.kind::text
      from public.holiday h join tests.created c on c.id = h.id where c.label = 'gio_to'$$,
  format($$values (%L::uuid, '2031-03-03'::date, 'Gio To'::text, 'non_working'::text)$$, tests.shared_org()),
  'AC-4: the returned id is an Org public row on 2031-03-03 with that name and kind');

-- ---------------------------------------------------------------------------------------------
-- AC-13. A new org still arrives with Org public's calendar.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select lives_ok(
  $$insert into tests.created (label, id)
    select 'new_org', public.create_org('mir15b-new', 'New Org', 'Asia/Ho_Chi_Minh')$$,
  'AC-13: Sam at aal2 creates an org');
select tests.clear_authentication();
select results_eq(
  $$select h.date, h.name, h.kind::text
      from public.holiday h join tests.created c on c.id = h.org_id
     where c.label = 'new_org' and h.date = '2031-03-03'$$,
  $$values ('2031-03-03'::date, 'Gio To'::text, 'non_working'::text)$$,
  'AC-13: the new org''s rows include the added row''s date, name and kind');

-- ---------------------------------------------------------------------------------------------
-- AC-5. And edits and removes one.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select lives_ok(
  format($$select public.update_national_holiday(%L::uuid, '2031-01-02', 'Tet (moved)', 'working')$$,
         tests.m15b('h_p')),
  'AC-5: Sam at aal2 edits H-P');
select tests.clear_authentication();
select results_eq(
  format($$select h.date, h.name, h.kind::text from public.holiday h where h.id = %L::uuid$$, tests.m15b('h_p')),
  $$values ('2031-01-02'::date, 'Tet (moved)'::text, 'working'::text)$$,
  'AC-5: H-P carries the new date, name and kind');
select tests.authenticate_at(tests.m15b('sam'), 'aal2');
select lives_ok(format($$select public.delete_national_holiday(%L::uuid)$$, tests.m15b('h_p')),
  'AC-5: Sam at aal2 deletes H-P');
select tests.clear_authentication();
select is((select count(*)::int from public.holiday h where h.id = tests.m15b('h_p')), 0,
  'AC-5: H-P no longer exists');

select * from finish();
rollback;
