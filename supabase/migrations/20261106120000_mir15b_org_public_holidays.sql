-- MIR-15-b: only a system admin sets Org public's holidays, and each org reads only its own.
--
-- Implements ADR-079 (01-plan.md § 4.1):
--
--   * decision 3 — `holiday_select_all` (ADR-015, `using (true)`) is replaced by
--     `holiday_select_own_org`: a caller reads the rows of the org their approved, unremoved member
--     row is in, and nothing else. A caller with no such row — pending, removed, a system admin —
--     reads none. Since `create_org` copies Org public's rows, a date has one row per org, and this
--     is what keeps "the status of date D" single-valued for each reader.
--   * decision 2 — the three member write policies keep MIR-13's bodies
--     (20261103120000_mir13_write_path_org_bound.sql:830-856) and gain one conjunct,
--     `not public.org_is_shared(org_id)`. A dedicated org's admin keeps the write until MIR-16.
--   * decision 1 — four `security definer` RPCs, each refusing with `42501` unless
--     `public.is_system_admin()` is true, each resolving Org public itself. The panel never names
--     an org, so the door cannot be aimed at a dedicated org's rows (`P0002`).
--
-- `holiday_stamp_org_id` is unchanged: every RPC supplies `org_id`. The table grant is unchanged.
--
-- **IDEMPOTENT** (ADR-024): `drop policy if exists` before each policy, `create or replace` for the
-- functions, and the grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The read bound (decision 3).
-- ---------------------------------------------------------------------------------------------

drop policy if exists holiday_select_all on public.holiday;
drop policy if exists holiday_select_own_org on public.holiday;
create policy holiday_select_own_org on public.holiday
  for select to authenticated
  using (org_id = public.member_org_id((select auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- 2. Member writes exclude the shared tenant (decision 2).
-- ---------------------------------------------------------------------------------------------

drop policy if exists holiday_insert_admin on public.holiday;
create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  );

drop policy if exists holiday_update_admin on public.holiday;
create policy holiday_update_admin on public.holiday
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  )
  with check (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  );

drop policy if exists holiday_delete_admin on public.holiday;
create policy holiday_delete_admin on public.holiday
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  );

-- ---------------------------------------------------------------------------------------------
-- 3. The door (decision 1). Every column reference is qualified: `returns table` names are
--    PL/pgSQL variables in scope.
-- ---------------------------------------------------------------------------------------------

create or replace function public.list_national_holidays(p_start date, p_end date)
  returns table (
    id         uuid,
    date       date,
    name       text,
    kind       public.holiday_kind,
    created_at timestamptz
  )
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  select o.id into v_org from public.org o where o.is_shared_tenant;
  return query
    select h.id, h.date, h.name, h.kind, h.created_at
      from public.holiday h
     where h.org_id = v_org
       and h.date >= p_start
       and h.date <= p_end
     order by h.date asc;
end;
$$;

-- A taken date raises 23505 from `holiday_org_id_date_key`, uncaught.
create or replace function public.add_national_holiday(
  p_date date, p_name text, p_kind public.holiday_kind
) returns uuid
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org uuid;
  v_id  uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  select o.id into v_org from public.org o where o.is_shared_tenant;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'holiday name is required' using errcode = '22023';
  end if;

  insert into public.holiday (org_id, date, name, kind)
  values (v_org, p_date, btrim(p_name), p_kind)
  returning public.holiday.id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_national_holiday(
  p_id uuid, p_date date, p_name text, p_kind public.holiday_kind
) returns void
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  select o.id into v_org from public.org o where o.is_shared_tenant;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'holiday name is required' using errcode = '22023';
  end if;

  update public.holiday h
     set date = p_date,
         name = btrim(p_name),
         kind = p_kind
   where h.id = p_id
     and h.org_id = v_org;
  if not found then
    raise exception 'holiday not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_national_holiday(p_id uuid) returns void
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  select o.id into v_org from public.org o where o.is_shared_tenant;

  delete from public.holiday h
   where h.id = p_id
     and h.org_id = v_org;
  if not found then
    raise exception 'holiday not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Privileges. `anon` as well as `public`: Supabase's default privileges grant a new function to
--    `anon` directly (010-catalogue.test.sql, F-1).
-- ---------------------------------------------------------------------------------------------

revoke all on function public.list_national_holidays(date, date) from public, anon;
revoke all on function public.add_national_holiday(date, text, public.holiday_kind) from public, anon;
revoke all on function public.update_national_holiday(uuid, date, text, public.holiday_kind) from public, anon;
revoke all on function public.delete_national_holiday(uuid) from public, anon;
grant execute on function public.list_national_holidays(date, date) to authenticated;
grant execute on function public.add_national_holiday(date, text, public.holiday_kind) to authenticated;
grant execute on function public.update_national_holiday(uuid, date, text, public.holiday_kind) to authenticated;
grant execute on function public.delete_national_holiday(uuid) to authenticated;

commit;
