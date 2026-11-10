-- MIR-15 AC-1 to AC-15: in Org public a `public` event is read, joined and notified within its own
-- team, and the member directory reaches no other team through one; a dedicated org keeps the
-- org-wide `public` scope (ADR-076).
--
-- Org public is the seed's org. Team A is `team_t`, Team B is `team_u`, and Ada is `admin_t`.
-- Alice (Team A only), Bob (Team B only) and Carol (both) are this file's, so none of them shares an
-- event or a notification with another through the seed. Org D, D1, D2, Dan and Dee are this file's
-- too, created as 160-read-path-org-bound.test.sql creates Org B (01-plan.md § 2, § 4.2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(41);
select tests.seed();

create function tests.m15(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('b2100000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_d', 'd0'), ('team_d1', 'd1'), ('team_d2', 'd2'), ('dan', 'a1'), ('dee', 'a2'),
      ('alice', 'c1'), ('bob', 'c2'), ('carol', 'c3')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- An event created as an authenticated caller, by its name: `id` is not an insertable column.
-- Definer, so it answers whatever the caller's select policy shows.
create function tests.m15_event(p_name text) returns uuid
  language sql stable security definer set search_path = '' as $$
  select e.id from public.event e where e.name = p_name;
$$;

-- Definer: it is read while authenticated, and `authenticated` holds no grant on `public.org`.
create function tests.m15_org_public() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- Org D, a dedicated org, as the owner.
insert into public.org (id, org_code, name) values (tests.m15('org_d'), 'org-d-mir15-210', 'Org D');
insert into public.team (id, name, org_id) values
  (tests.m15('team_d1'), 'Team D1', tests.m15('org_d')),
  (tests.m15('team_d2'), 'Team D2', tests.m15('org_d'));

insert into auth.users (id, email) values
  (tests.m15('dan'),   'dan@mir15-210.test'),
  (tests.m15('dee'),   'dee@mir15-210.test'),
  (tests.m15('alice'), 'alice@mir15-210.test'),
  (tests.m15('bob'),   'bob@mir15-210.test'),
  (tests.m15('carol'), 'carol@mir15-210.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m15('dan'), tests.m15('org_d'), 'Dan', '1.png', 'member', 'approved', 'dan@mir15-210.test'),
  (tests.m15('dee'), tests.m15('org_d'), 'Dee', '1.png', 'member', 'approved', 'dee@mir15-210.test');
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m15('alice'), 'Alice', '1.png', 'member', 'approved', 'alice@mir15-210.test'),
  (tests.m15('bob'),   'Bob',   '1.png', 'member', 'approved', 'bob@mir15-210.test'),
  (tests.m15('carol'), 'Carol', '1.png', 'member', 'approved', 'carol@mir15-210.test');

-- MIR-21-e (ADR-080 decision 3): the mirror's INSERT branch no longer runs, because the member
-- inserts above do not name team_id. Write each one's membership row directly.
select tests.put_on_team(tests.m15('dan'),   tests.m15('team_d1'));
select tests.put_on_team(tests.m15('dee'),   tests.m15('team_d2'));
select tests.put_on_team(tests.m15('alice'), tests.id('team_t'));
select tests.put_on_team(tests.m15('bob'),   tests.id('team_u'));
select tests.put_on_team(tests.m15('carol'), tests.id('team_t'));

-- Carol: primary Team A (put_on_team above), plus an active non-primary membership on Team B.
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.m15_org_public(), tests.id('team_u'), tests.m15('carol'), 'member', false);

-- ---------------------------------------------------------------------------------------------
-- The predicate (§ 4.2).
-- ---------------------------------------------------------------------------------------------
select is(public.org_is_shared(tests.m15_org_public()), true, 'org_is_shared(Org public) is true');
select is(public.org_is_shared(tests.m15('org_d')), false, 'org_is_shared(Org D) is false');
select is(public.org_is_shared(gen_random_uuid()), false, 'org_is_shared(an unknown id) is false');
select ok(not has_function_privilege('anon', 'public.org_is_shared(uuid)', 'EXECUTE'),
  'anon lacks EXECUTE on org_is_shared(uuid)');
select ok(has_function_privilege('authenticated', 'public.org_is_shared(uuid)', 'EXECUTE'),
  'authenticated holds EXECUTE on org_is_shared(uuid)');

-- ---------------------------------------------------------------------------------------------
-- AC-9. The directory does not reach Bob through a Team B public event he attends. Event U public
-- is member_u's, on Team B; Alice shares no team, event or notification with Bob.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15('bob'));
select lives_ok($$insert into public.event_attendance (event_id) values (tests.id('event_u_public'))$$,
  'AC-9: Bob joins Event U public, on his own team');
select tests.authenticate_as(tests.m15('alice'));
select ok(not exists (select 1 from public.list_member_directory() d where d.id = tests.m15('bob')),
  'AC-9: Alice''s directory does not contain Bob, an attendee of a Team B public event');
select tests.clear_authentication();
select is(public.may_read_event(tests.id('event_u_public'), tests.m15('alice')), false,
  'AC-9: may_read_event(Event U public, Alice) is false');

-- ---------------------------------------------------------------------------------------------
-- AC-8. Nor through a Team B public event he created.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15('bob'));
insert into public.event (name, start_date, end_date, scope) values
  ('B public mir15', current_date + 10, current_date + 11, 'public');
select tests.authenticate_as(tests.m15('alice'));
select ok(not exists (select 1 from public.list_member_directory() d where d.id = tests.m15('bob')),
  'AC-8: Alice''s directory does not contain Bob, creator of a Team B public event');
select tests.clear_authentication();
select is((select team_id from public.event where id = tests.m15_event('B public mir15')), tests.id('team_u'),
  'AC-8: Bob''s public event is on Team B');
select is(
  (select count(*)::int from public.notification
    where recipient_id = tests.m15('alice') and event_id = tests.m15_event('B public mir15')),
  0,
  'AC-8: Alice was not notified of it'
);

-- ---------------------------------------------------------------------------------------------
-- AC-1, AC-2, AC-6. Alice creates a public event on Team A.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15('alice'));
insert into public.event (name, start_date, end_date, scope) values
  ('A public mir15', current_date + 10, current_date + 11, 'public');
select tests.clear_authentication();
select is((select team_id from public.event where id = tests.m15_event('A public mir15')), tests.id('team_t'),
  'AC-1: Alice''s public event is on Team A');

select tests.authenticate_as(tests.m15('carol'));
select ok(exists (select 1 from public.event where id = tests.m15_event('A public mir15')),
  'AC-1: Carol reads it');
select tests.authenticate_as(tests.id('admin_t'));
select ok(exists (select 1 from public.event where id = tests.m15_event('A public mir15')),
  'AC-1: Ada reads it');
select tests.authenticate_as(tests.m15('bob'));
select is_empty($$select id from public.event where name = 'A public mir15'$$,
  'AC-2: Bob''s select on events does not return it');
select tests.clear_authentication();
select is(public.may_read_event(tests.m15_event('A public mir15'), tests.m15('bob')), false,
  'AC-2: may_read_event(it, Bob) is false');
select tests.authenticate_as(tests.m15('bob'));
select is_empty(format('select id from public.event where id = %L', tests.m15_event('A public mir15')),
  'AC-2: Bob''s select by its id returns nothing');
select tests.clear_authentication();

select is(
  (select count(*)::int from public.notification
    where kind = 'event_created' and event_id = tests.m15_event('A public mir15')
      and recipient_id = tests.m15('carol')),
  1,
  'AC-6: Carol has exactly one event_created notification for it'
);
select is(
  (select count(*)::int from public.notification
    where kind = 'event_created' and event_id = tests.m15_event('A public mir15')
      and recipient_id = tests.id('admin_t')),
  1,
  'AC-6: Ada has exactly one'
);
select is(
  (select count(*)::int from public.notification
    where event_id = tests.m15_event('A public mir15') and recipient_id = tests.m15('bob')),
  0,
  'AC-6: Bob has none'
);
select is(
  (select count(*)::int from public.notification
    where event_id = tests.m15_event('A public mir15') and recipient_id = tests.m15('alice')),
  0,
  'AC-6: Alice, the actor, has none'
);

-- ---------------------------------------------------------------------------------------------
-- AC-4. Joining follows reading in Org public. Open, no capacity, approval off (the defaults).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15('bob'));
select throws_ok(
  format('insert into public.event_attendance (event_id) values (%L)', tests.m15_event('A public mir15')),
  '42501', null,
  'AC-4: Bob''s join of Alice''s public event raises 42501'
);
select tests.authenticate_as(tests.m15('carol'));
select lives_ok(
  format('insert into public.event_attendance (event_id) values (%L)', tests.m15_event('A public mir15')),
  'AC-4: Carol''s join succeeds'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.event_attendance
    where event_id = tests.m15_event('A public mir15') and member_id = tests.m15('bob')),
  0,
  'AC-4: no attendance row exists for Bob'
);

-- ---------------------------------------------------------------------------------------------
-- AC-3, AC-5, AC-7, AC-13. A dedicated org keeps the org-wide public scope.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15('dan'));
insert into public.event (name, start_date, end_date, scope) values
  ('D public mir15', current_date + 10, current_date + 11, 'public');
select tests.authenticate_as(tests.m15('dee'));
select ok(exists (select 1 from public.event where id = tests.m15_event('D public mir15')),
  'AC-3: Dee, on D2, reads Dan''s public event on D1');
select lives_ok(
  format('insert into public.event_attendance (event_id) values (%L)', tests.m15_event('D public mir15')),
  'AC-5: Dee joins it'
);
select ok(exists (select 1 from public.list_member_directory() d where d.id = tests.m15('dan')),
  'AC-13: Dee''s directory contains Dan');
select tests.clear_authentication();
select is((select team_id from public.event where id = tests.m15_event('D public mir15')), tests.m15('team_d1'),
  'AC-3: Dan''s public event is on D1');
select is(public.may_read_event(tests.m15_event('D public mir15'), tests.m15('dee')), true,
  'AC-3: may_read_event(it, Dee) is true');
select is(
  (select count(*)::int from public.notification
    where kind = 'event_created' and event_id = tests.m15_event('D public mir15')
      and recipient_id = tests.m15('dee')),
  1,
  'AC-7: Dee has exactly one event_created notification for it'
);
select is(
  (select count(*)::int from public.notification
    where event_id = tests.m15_event('D public mir15') and recipient_id = tests.m15('dan')),
  0,
  'AC-7: Dan, the actor, has none'
);

-- ---------------------------------------------------------------------------------------------
-- AC-10. The directory still names the people of the caller's own teams.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15('carol'));
select set_eq(
  $$select d.id, d.team_name from public.list_member_directory() d
     where d.id in (tests.m15('alice'), tests.m15('bob'))$$,
  $$values (tests.m15('alice'), 'Team T'), (tests.m15('bob'), 'Team U')$$,
  'AC-10: Carol''s directory contains Alice and Bob, each with their team''s name'
);

-- ---------------------------------------------------------------------------------------------
-- AC-12. The admin of Org public is unchanged (ADR-076 decision 4).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select ok(exists (select 1 from public.event where id = tests.m15_event('B public mir15')),
  'AC-12: Ada reads Bob''s Team B public event');
select ok(exists (select 1 from public.list_member_directory() d where d.id = tests.m15('bob')),
  'AC-12: Ada''s directory contains Bob');

-- ---------------------------------------------------------------------------------------------
-- AC-11. A named invitation still connects across teams (ADR-066 (c), unchanged). Run after AC-8
-- and AC-9, which need Alice to share nothing with Bob.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m15('bob'));
insert into public.event (name, start_date, end_date, scope) values
  ('B named mir15', current_date + 10, current_date + 11, 'named');
insert into public.event_invitee (event_id, member_id) values
  (tests.m15_event('B named mir15'), tests.m15('alice'));
select tests.authenticate_as(tests.m15('alice'));
select ok(exists (select 1 from public.list_member_directory() d where d.id = tests.m15('bob')),
  'AC-11: Alice''s directory contains Bob, who named her');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-14. A cross-team attendee from before keeps their place and loses the right to come back.
-- `event_attendance_guard` now refuses that row, so it goes in while Bob holds a Team A
-- membership, which then ends — the state a pre-migration attendance leaves behind.
-- ---------------------------------------------------------------------------------------------
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.m15_org_public(), tests.id('team_t'), tests.m15('bob'), 'member', false);
insert into public.event_attendance (event_id, member_id, status) values
  (tests.id('event_t_public'), tests.m15('bob'), 'attending');
update public.membership set left_at = now()
 where member_id = tests.m15('bob') and team_id = tests.id('team_t') and left_at is null;

select tests.authenticate_as(tests.m15('bob'));
select ok(exists (select 1 from public.event where id = tests.id('event_t_public')),
  'AC-14: Bob, attending, still reads Event T public');
select is(
  tests.rows_affected(format('delete from public.event_attendance where event_id = %L and member_id = %L',
                             tests.id('event_t_public'), tests.m15('bob'))),
  1::bigint,
  'AC-14: Bob withdraws'
);
select throws_ok(
  format('insert into public.event_attendance (event_id) values (%L)', tests.id('event_t_public')),
  '42501', null,
  'AC-14: Bob''s second join raises 42501'
);
select is_empty(format('select id from public.event where id = %L', tests.id('event_t_public')),
  'AC-14: and once withdrawn Bob no longer reads it');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-15. No stored scope is rewritten: the migration has run before the seed, and every public
-- event this file and the seed wrote is still `public`.
-- ---------------------------------------------------------------------------------------------
select set_eq(
  $$select id from public.event where scope = 'public'$$,
  format('values (%L::uuid), (%L::uuid), (%L::uuid), (%L::uuid), (%L::uuid)',
         tests.id('event_t_public'), tests.id('event_u_public'), tests.m15_event('B public mir15'),
         tests.m15_event('A public mir15'), tests.m15_event('D public mir15')),
  'AC-15: every public event is still public'
);
select ok(
  not exists (select 1 from pg_catalog.pg_proc p
               where p.pronamespace = 'public'::regnamespace
                 and p.proname in ('may_read_event', 'is_event_audience', 'notify_event_created', 'org_is_shared')
                 and p.prosrc ~* 'update\s+public\.event\M'),
  'AC-15: none of the four functions MIR-15 replaces or adds updates public.event'
);

select * from finish();
rollback;
