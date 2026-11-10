-- MIR-18: the system panel's door — a separate account table, and a second factor the database
-- checks.
--
-- Implements ADR-074 decisions 1 to 5 (01-plan.md § 4.1):
--
--   * decision 1 — `public.system_admin` is the account store: one row per system admin, keyed on
--     the Supabase Auth identity, with no `org_id`. Identity stays in Supabase Auth (ADR-005).
--   * decision 2 — an identity is a system admin or holds a `public.member` row, never both. Two
--     BEFORE INSERT triggers, one on each table. The member-side refusal makes
--     `admit_allow_listed_member()` log a warning and create nothing, as it does on any failure.
--   * decision 3 — `grant_system_admin(uuid)` is the only way one is made, and only `service_role`
--     (and the owner) may run it. It removes the `pending`, team-less member row the confirmation
--     trigger creates, and refuses any other.
--   * decision 4 — `is_system_admin()` is true only with the row AND a JWT at `aal = 'aal2'`. The
--     panel's own check is an affordance; this function is the control.
--   * decision 5 — a caller reads their own `system_admin` row at any assurance level, and no other.
--
-- NO FUNCTION HERE IS `security definer`, so the census in `010-catalogue.test.sql` is unchanged.
-- No existing table, column, policy or function changes.
--
-- **IDEMPOTENT** (ADR-024): `if not exists`, `create or replace`, `drop … if exists`, and the
-- grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The account store (decisions 1 and 5).
-- ---------------------------------------------------------------------------------------------

create table if not exists public.system_admin (
  id         uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.system_admin enable row level security;
revoke all on table public.system_admin from public, anon, authenticated;
grant select on table public.system_admin to authenticated;

drop policy if exists system_admin_select_self on public.system_admin;
create policy system_admin_select_self on public.system_admin
  for select to authenticated
  using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- 2. The second factor (decision 4). Invoker: it reads only the caller's own row, which the
--    policy above allows. A session with no `aal` claim is not `aal2`.
-- ---------------------------------------------------------------------------------------------

create or replace function public.is_system_admin() returns boolean
  language sql stable security invoker set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.system_admin s where s.id = (select auth.uid()));
$$;
-- `anon` as well as `public`: Supabase's default privileges grant a new function to `anon`
-- directly, and `from public` alone leaves that grant in place (010-catalogue.test.sql, F-1).
revoke all on function public.is_system_admin() from public, anon;
grant execute on function public.is_system_admin() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Disjointness, both directions (decision 2).
-- ---------------------------------------------------------------------------------------------

create or replace function public.system_admin_refuse_member() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.member m where m.id = new.id) then
    raise exception 'a member cannot be a system admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.member_refuse_system_admin() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.system_admin s where s.id = new.id) then
    raise exception 'a system admin cannot hold a member row' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.system_admin_refuse_member() from public, anon, authenticated;
revoke all on function public.member_refuse_system_admin() from public, anon, authenticated;

drop trigger if exists system_admin_refuse_member on public.system_admin;
create trigger system_admin_refuse_member
  before insert on public.system_admin
  for each row execute function public.system_admin_refuse_member();

drop trigger if exists member_refuse_system_admin on public.member;
create trigger member_refuse_system_admin
  before insert on public.member
  for each row execute function public.member_refuse_system_admin();

-- ---------------------------------------------------------------------------------------------
-- 4. Making one (decision 3). Run by a person, as `service_role` or `postgres`.
--
--    The `delete` removes only the row the confirmation trigger creates: `pending`, no team, no
--    `membership`. Every foreign key into `public.member` is `on delete restrict` or `set null`,
--    and such a row owns nothing in the current schema, so nothing refuses it. A uuid with no
--    `auth.users` row is refused by the foreign key on insert (SQLSTATE 23503).
-- ---------------------------------------------------------------------------------------------

create or replace function public.grant_system_admin(p_user_id uuid) returns void
  language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.system_admin s where s.id = p_user_id) then
    return;
  end if;
  if exists (select 1 from public.member m where m.id = p_user_id) then
    if exists (
      select 1 from public.member m
       where m.id = p_user_id
         and m.status = 'pending'
         and m.team_id is null
         and not exists (select 1 from public.membership ms where ms.member_id = m.id)
    ) then
      delete from public.member m where m.id = p_user_id;
    else
      raise exception 'only a pending member with no team can become a system admin'
        using errcode = '42501';
    end if;
  end if;
  insert into public.system_admin (id) values (p_user_id);
end;
$$;
revoke all on function public.grant_system_admin(uuid) from public, anon, authenticated;
grant execute on function public.grant_system_admin(uuid) to service_role;

commit;
