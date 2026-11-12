-- MIR-18-c AC-6 to AC-12: `public.mfa_failed_verification` and `public.hook_mfa_verification_attempt`
-- log every wrong second-factor code, and refuse the factor after five in fifteen minutes (ADR-095
-- decision 4).
--
-- Fixture, added here on top of `tests.seed()` (01-plan.md § 2):
--   * `mfa_a`, `mfa_b` — `auth.users` rows with `email_confirmed_at` null, so no member row is created.
--   * `factor_a`, `factor_b` — factor uuids. They reference nothing: the log keeps the id and no more.
-- The hook is called as the session user (`postgres`); its privileges are asserted with `has_*_privilege`.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(29);
select tests.seed();

-- The fixture ids local to this file. Labels are fixture names, not schema fields.
create function tests.mfa(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('00000000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values ('mfa_a', 'b1'), ('mfa_b', 'b2'), ('factor_a', 'c1'), ('factor_b', 'c2')) as v(label, nn)
   where v.label = p_label;
$$;

-- Event(u, f, v), as the hook receives it.
create function tests.ev(p_user uuid, p_factor uuid, p_valid boolean) returns jsonb
  language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('user_id', p_user, 'factor_id', p_factor, 'valid', p_valid);
$$;

-- `p_n` rows of one reason for one identity, `p_age` old.
create function tests.fail_rows(p_user uuid, p_reason text, p_n int, p_age interval) returns void
  language sql security invoker set search_path = '' as $$
  insert into public.mfa_failed_verification (user_id, factor_id, reason, attempted_at)
  select p_user, ('00000000-0000-4000-8000-0000000000' || 'c1')::uuid, p_reason, now() - p_age
    from generate_series(1, p_n);
$$;

create function tests.n_rows(p_user uuid, p_reason text) returns bigint
  language sql security invoker set search_path = '' as $$
  select count(*) from public.mfa_failed_verification where user_id = p_user and reason = p_reason;
$$;

insert into auth.users (id, email) values
  (tests.mfa('mfa_a'), 'mfa_a@mir18c.test'),
  (tests.mfa('mfa_b'), 'mfa_b@mir18c.test');

-- "Continue" and "reject" of 01-plan.md § 2.
create function tests.continue_() returns jsonb
  language sql immutable security invoker set search_path = '' as $$
  select '{"decision": "continue"}'::jsonb;
$$;
create function tests.reject_() returns jsonb
  language sql immutable security invoker set search_path = '' as $$
  select '{"decision": "reject", "message": "Too many incorrect codes. Try again in 15 minutes."}'::jsonb;
$$;

-- ---------------------------------------------------------------------------------------------
-- AC-6. The table and the hook exist and are closed to every client role.
-- ---------------------------------------------------------------------------------------------
select has_table('public', 'mfa_failed_verification', 'AC-6: public.mfa_failed_verification exists');
select is((select c.relrowsecurity from pg_class c where c.oid = 'public.mfa_failed_verification'::regclass),
  true, 'AC-6: row-level security is enabled');
select columns_are('public', 'mfa_failed_verification',
  array['id', 'user_id', 'factor_id', 'reason', 'attempted_at'], 'AC-6: the table has the columns of § 4.1');
select ok(not has_table_privilege('anon', 'public.mfa_failed_verification',
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'AC-6: anon holds no privilege on the table');
select ok(not has_table_privilege('authenticated', 'public.mfa_failed_verification',
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'AC-6: authenticated holds no privilege on the table');
select ok(has_table_privilege('supabase_auth_admin', 'public.mfa_failed_verification', 'SELECT'),
  'AC-6: supabase_auth_admin holds SELECT');
select ok(has_table_privilege('supabase_auth_admin', 'public.mfa_failed_verification', 'INSERT'),
  'AC-6: supabase_auth_admin holds INSERT');
select ok(not has_function_privilege('anon', 'public.hook_mfa_verification_attempt(jsonb)', 'EXECUTE'),
  'AC-6: anon cannot execute the hook');
select ok(not has_function_privilege('authenticated', 'public.hook_mfa_verification_attempt(jsonb)', 'EXECUTE'),
  'AC-6: authenticated cannot execute the hook');
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_mfa_verification_attempt(jsonb)', 'EXECUTE'),
  'AC-6: supabase_auth_admin can execute the hook');
select is((select p.prosecdef from pg_proc p where p.oid = 'public.hook_mfa_verification_attempt(jsonb)'::regprocedure),
  false, 'AC-6: the hook is not security definer');

-- ---------------------------------------------------------------------------------------------
-- AC-7. A wrong code is logged and, under the limit, goes through.
-- ---------------------------------------------------------------------------------------------
select is(public.hook_mfa_verification_attempt(tests.ev(tests.mfa('mfa_a'), tests.mfa('factor_a'), false)),
  tests.continue_(), 'AC-7: a wrong code under the limit continues');
select is((select count(*) from public.mfa_failed_verification where user_id = tests.mfa('mfa_a')),
  1::bigint, 'AC-7: exactly one row is logged');
select results_eq(
  format('select factor_id, reason, attempted_at = now() from public.mfa_failed_verification where user_id = %L::uuid',
         tests.mfa('mfa_a')),
  format('values (%L::uuid, ''invalid_code'', true)', tests.mfa('factor_a')),
  'AC-7: the row carries the factor, invalid_code and now()');

-- ---------------------------------------------------------------------------------------------
-- AC-8. A right code under the limit is not logged.
-- ---------------------------------------------------------------------------------------------
delete from public.mfa_failed_verification;
select tests.fail_rows(tests.mfa('mfa_a'), 'invalid_code', 4, interval '1 minute');
select is(public.hook_mfa_verification_attempt(tests.ev(tests.mfa('mfa_a'), tests.mfa('factor_a'), true)),
  tests.continue_(), 'AC-8: a right code under the limit continues');
select is(tests.n_rows(tests.mfa('mfa_a'), 'invalid_code'), 4::bigint, 'AC-8: nothing was logged');

-- ---------------------------------------------------------------------------------------------
-- AC-9. The fifth wrong code in the window is refused.
-- ---------------------------------------------------------------------------------------------
select is(public.hook_mfa_verification_attempt(tests.ev(tests.mfa('mfa_a'), tests.mfa('factor_a'), false)),
  tests.reject_(), 'AC-9: the fifth wrong code is rejected');
select is(tests.n_rows(tests.mfa('mfa_a'), 'invalid_code'), 5::bigint, 'AC-9: it is logged as the fifth');

-- ---------------------------------------------------------------------------------------------
-- AC-10. While locked, a right code is refused and logged as locked_out, which does not count.
-- ---------------------------------------------------------------------------------------------
delete from public.mfa_failed_verification;
select tests.fail_rows(tests.mfa('mfa_a'), 'invalid_code', 5, interval '1 minute');
select is(public.hook_mfa_verification_attempt(tests.ev(tests.mfa('mfa_a'), tests.mfa('factor_a'), true)),
  tests.reject_(), 'AC-10: a right code while locked is rejected');
select is(public.hook_mfa_verification_attempt(tests.ev(tests.mfa('mfa_a'), tests.mfa('factor_a'), true)),
  tests.reject_(), 'AC-10: and again');
select is(tests.n_rows(tests.mfa('mfa_a'), 'locked_out'), 2::bigint, 'AC-10: two locked_out rows');
select is(tests.n_rows(tests.mfa('mfa_a'), 'invalid_code'), 5::bigint, 'AC-10: still five invalid_code rows');

-- ---------------------------------------------------------------------------------------------
-- AC-11. Rows older than the window do not count.
-- ---------------------------------------------------------------------------------------------
delete from public.mfa_failed_verification;
select tests.fail_rows(tests.mfa('mfa_b'), 'invalid_code', 10, interval '16 minutes');
select tests.fail_rows(tests.mfa('mfa_b'), 'invalid_code', 4, interval '1 minute');
select is(public.hook_mfa_verification_attempt(tests.ev(tests.mfa('mfa_b'), tests.mfa('factor_b'), true)),
  tests.continue_(), 'AC-11: ten old failures and four recent ones do not lock');

-- ---------------------------------------------------------------------------------------------
-- AC-12. The count is per identity, and a malformed event is refused.
-- ---------------------------------------------------------------------------------------------
delete from public.mfa_failed_verification;
select tests.fail_rows(tests.mfa('mfa_a'), 'invalid_code', 5, interval '1 minute');
select is(public.hook_mfa_verification_attempt(tests.ev(tests.mfa('mfa_b'), tests.mfa('factor_b'), true)),
  tests.continue_(), 'AC-12: mfa_b is not locked by mfa_a''s failures');
select is((select count(*) from public.mfa_failed_verification where user_id = tests.mfa('mfa_b')),
  0::bigint, 'AC-12: and nothing was logged for mfa_b');
select throws_ok(
  format('select public.hook_mfa_verification_attempt(%L::jsonb)',
         jsonb_build_object('factor_id', tests.mfa('factor_a'), 'valid', false)),
  '22023', 'malformed MFA verification event', 'AC-12: an event without user_id is refused');
select throws_ok(
  format('select public.hook_mfa_verification_attempt(%L::jsonb)',
         jsonb_build_object('user_id', tests.mfa('mfa_a'), 'valid', false)),
  '22023', 'malformed MFA verification event', 'AC-12: an event without factor_id is refused');
select throws_ok(
  format('select public.hook_mfa_verification_attempt(%L::jsonb)',
         jsonb_build_object('user_id', tests.mfa('mfa_a'), 'factor_id', tests.mfa('factor_a'))),
  '22023', 'malformed MFA verification event', 'AC-12: an event without valid is refused');
select is((select count(*) from public.mfa_failed_verification), 5::bigint,
  'AC-12: the malformed events wrote no row');

select * from finish();
rollback;
