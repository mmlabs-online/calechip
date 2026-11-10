-- MIR-12 AC-1, AC-8, AC-9, AC-10 (AC-13): the checks a reset database can answer.
-- AC-2..AC-7 and AC-11 need rows that exist *before* the migration runs; `db reset` seeds after
-- migrations, so those are verified by re-applying the migration (01-plan.md § 2, verification.md).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(9);
select tests.seed();

-- AC-1: exactly one shared tenant, and it is Org public.
select is(
  (select count(*)::int from public.org where is_shared_tenant),
  1,
  'AC-1: exactly one public.org row has is_shared_tenant = true'
);
select results_eq(
  $$select org_code, name from public.org where is_shared_tenant$$,
  $$values ('shared'::text, 'Org public'::text)$$,
  'AC-1: the shared tenant has org_code = ''shared'' and name = ''Org public'''
);

-- AC-8: every org_id column, and entry.primary_team_id, is NOT NULL. MIR-12 wrote this as "still
-- nullable, until MIR-13"; MIR-13 (20261103120000_mir13_write_path_org_bound.sql § 4.3) closed it.
select is_empty(
  $$select table_name::text, column_name::text
      from information_schema.columns
     where table_schema = 'public'
       and ((column_name = 'org_id'
             and table_name in ('team', 'member', 'entry', 'holiday', 'busy_day', 'issue_report',
                                'event', 'event_invitee', 'event_attendance', 'event_guest_link',
                                'event_guest', 'notification'))
            or (table_name = 'entry' and column_name = 'primary_team_id'))
       and is_nullable = 'YES'$$,
  'AC-8: every org_id column and entry.primary_team_id is NOT NULL (MIR-13)'
);

-- AC-9: holiday uniqueness is one row per date per org. MIR-12 wrote this as "unique (date), until
-- MIR-13"; MIR-13 § 4.4 swapped the key.
select col_is_unique('public', 'holiday', array['org_id', 'date'],
  'AC-9: public.holiday is unique on (org_id, date)');
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.holiday'::regclass and conname = 'holiday_date_key'),
  0,
  'AC-9: holiday_date_key no longer exists (MIR-13)'
);
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.holiday'::regclass and conname = 'holiday_org_id_date_key'),
  1,
  'AC-9: holiday_org_id_date_key exists (MIR-13)'
);

insert into public.holiday (date, name, org_id)
values ('2099-01-02', 'MIR-12 first', (select id from public.org where is_shared_tenant));

select throws_ok(
  $$insert into public.holiday (date, name, org_id)
    values ('2099-01-02', 'MIR-12 second', (select id from public.org where is_shared_tenant))$$,
  '23505', null,
  'AC-9: a second holiday on the same date in the same org is refused with 23505'
);

-- AC-10: RLS on, no grant, so an authenticated session cannot read Org public.
select is(
  (select relrowsecurity from pg_class where oid = 'public.org'::regclass),
  true,
  'AC-10: RLS is enabled on public.org'
);

select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  $$select * from public.org$$,
  '42501', null,
  'AC-10: an authenticated session cannot read public.org (no grant until MIR-13)'
);
select tests.clear_authentication();

select * from finish();
rollback;
