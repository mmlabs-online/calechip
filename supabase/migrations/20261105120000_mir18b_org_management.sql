-- MIR-18-b: what is behind the system panel's door — list, create and edit orgs.
--
-- Implements ADR-075 decisions 1 to 7 (01-plan.md § 4.1):
--
--   * decision 1 — three `security definer` RPCs, `list_orgs()`, `create_org(text,text,text)` and
--     `update_org(uuid,text,integer,integer,text,date)`, each refusing with `42501` unless
--     `public.is_system_admin()` is true. `public.org` keeps every table privilege revoked.
--   * decision 2 — create, read and update only. No delete, no suspend.
--   * decision 3 — `create_org` copies Org public's holiday rows into the new org in the same
--     transaction, and refuses a timezone PostgreSQL does not know (`22023`).
--   * decision 4 — `update_org` never sets `org_code` or `timezone`.
--   * decision 5 — `licence_expires_at` is added (ADR-070 § 2's column, which MIR-11 left out). It
--     crosses the RPC boundary as a `date`: the start of that day in the org's timezone.
--   * decision 6 — caps and plan are stored and shown; nothing here enforces them.
--   * decision 7 — `update_org` refuses Org public with `42501`.
--
-- Every value check is the table's own constraint (`org_code_shape`, `org_code_not_reserved`,
-- `org_name_not_blank`, `org_plan_not_blank`, `org_max_*_positive`, `org_org_code_key`, the
-- `not null`s). None is repeated in a function.
--
-- `is_system_admin()` is `security invoker` and reads `auth.uid()` and `auth.jwt()` from the request
-- settings, which a definer call does not change; `200-org-management.test.sql` AC-2's `aal1` and
-- `admin_t` cases are what show the gate still refuses from inside a definer function.
--
-- **IDEMPOTENT** (ADR-024): `if not exists`, `create or replace`, and the grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The licence column (decision 5).
-- ---------------------------------------------------------------------------------------------

alter table public.org add column if not exists licence_expires_at timestamptz null;

-- ---------------------------------------------------------------------------------------------
-- 2. List (decision 1). Every column reference is qualified: `returns table` names are PL/pgSQL
--    variables in scope.
-- ---------------------------------------------------------------------------------------------

create or replace function public.list_orgs()
  returns table (
    id                 uuid,
    org_code           text,
    name               text,
    is_shared_tenant   boolean,
    timezone           text,
    max_members        integer,
    max_teams          integer,
    plan               text,
    licence_expires_on date,
    created_at         timestamptz
  )
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  return query
    select o.id, o.org_code, o.name, o.is_shared_tenant, o.timezone,
           o.max_members, o.max_teams, o.plan,
           (o.licence_expires_at at time zone o.timezone)::date,
           o.created_at
      from public.org o
     order by o.is_shared_tenant desc, o.org_code asc;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Create, with the national holidays (decision 3).
-- ---------------------------------------------------------------------------------------------

create or replace function public.create_org(p_org_code text, p_name text, p_timezone text)
  returns uuid
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_timezone) then
    raise exception 'unknown timezone' using errcode = '22023';
  end if;

  insert into public.org (org_code, name, timezone)
  values (p_org_code, btrim(p_name), p_timezone)
  returning public.org.id into v_id;

  -- `org_id` is set, so `holiday_stamp_org_id` leaves it alone; the new org has no rows, so
  -- `holiday_org_id_date_key` cannot collide.
  insert into public.holiday (org_id, date, name, kind)
  select v_id, h.date, h.name, h.kind
    from public.holiday h
    join public.org o on o.id = h.org_id
   where o.is_shared_tenant;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Edit a dedicated org (decisions 4, 5 and 7).
-- ---------------------------------------------------------------------------------------------

create or replace function public.update_org(
  p_org_id             uuid,
  p_name               text,
  p_max_members        integer,
  p_max_teams          integer,
  p_plan               text,
  p_licence_expires_on date
) returns void
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org public.org%rowtype;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  select * into v_org from public.org o where o.id = p_org_id for update;
  if not found then
    raise exception 'org not found' using errcode = 'P0002';
  end if;
  if v_org.is_shared_tenant then
    raise exception 'Org public is not edited from the panel' using errcode = '42501';
  end if;

  update public.org o
     set name               = btrim(p_name),
         max_members        = p_max_members,
         max_teams          = p_max_teams,
         plan               = btrim(p_plan),
         licence_expires_at = case when p_licence_expires_on is null then null
                                   else p_licence_expires_on::timestamp at time zone v_org.timezone end
   where o.id = p_org_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Privileges. `anon` as well as `public`: Supabase's default privileges grant a new function to
--    `anon` directly (010-catalogue.test.sql, F-1).
-- ---------------------------------------------------------------------------------------------

revoke all on function public.list_orgs() from public, anon;
revoke all on function public.create_org(text, text, text) from public, anon;
revoke all on function public.update_org(uuid, text, integer, integer, text, date) from public, anon;
grant execute on function public.list_orgs() to authenticated;
grant execute on function public.create_org(text, text, text) to authenticated;
grant execute on function public.update_org(uuid, text, integer, integer, text, date) to authenticated;

commit;
