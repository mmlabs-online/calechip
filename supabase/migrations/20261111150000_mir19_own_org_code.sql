-- MIR-19, ADR-097 decisions 2 and 3 (01-plan.md § 4.1, § 6).
--   1. public.own_org_code() — the caller's own org code, for the member app's router.
--   2. 'tasks' joins org_code_not_reserved (TSK-01's `/tasks`), after refusing if an org holds it.
-- Idempotent (ADR-024). One transaction. Applying it to the hosted project is human (RULE-09).
begin;

-- ---------------------------------------------------------------------------------------------
-- 1. own_org_code(). Takes no argument, so it cannot be used to look up an org: it answers the
--    org_code of member_org_id(auth.uid()), which is null for anyone not approved or removed.
--    `anon` as well as `public` is revoked: Supabase's default privileges grant a new function to
--    `anon` directly (010-catalogue.test.sql, F-1).
-- ---------------------------------------------------------------------------------------------
create or replace function public.own_org_code() returns text
  language sql stable security definer set search_path = '' as $$
  select o.org_code
    from public.org o
   where o.id = public.member_org_id((select auth.uid()));
$$;

revoke all on function public.own_org_code() from public, anon;
grant execute on function public.own_org_code() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. 'tasks' is reserved. Guard first: a constraint that cannot be added would otherwise fail
--    with a message that does not name the row to rename.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.org where org_code = 'tasks') then
    raise exception 'mir19 refused: public.org holds org_code = ''tasks'''
      using hint = 'Rename that org''s org_code by hand (update public.org set org_code = ... where org_code = ''tasks''), then apply this migration again.';
  end if;
end
$$;

-- The constraint name is unchanged: supabase/tests/120-composite-fks.test.sql:43 checks it.
alter table public.org drop constraint if exists org_code_not_reserved;
alter table public.org add constraint org_code_not_reserved check (
  org_code <> all (array[
    -- ADR-070 § 2 (29 reserved tokens: 15 P3-1 + 14 SPA route segments):
    'system', 'api', 'admin', 'login', 'signin', 'signup', 'app',
    'static', 'public', 'assets', 'healthz', 'fonts', 'images',
    '_next', 'index.html',
    'signups', 'members', 'entries', 'month', 'week', 'year',
    'setting', 'threshold', 'teams', 'reports', 'holidays',
    'events', 'profile', 'guest',
    -- Additional reserved route/slug tokens in MIR-11 01-plan.md § 4.1:
    'auth', 'billing', 'calechip', 'calendar', 'create', 'dashboard',
    'dev', 'docs', 'help', 'invite', 'join', 'logout', 'manage',
    'new', 'onboarding', 'org', 'orgs', 'settings', 'support',
    'team', 'www',
    -- MIR-19, ADR-097 decision 3: TSK-01's `/tasks`.
    'tasks'
  ])
);

commit;
