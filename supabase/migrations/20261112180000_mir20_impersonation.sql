-- MIR-20: a system admin's impersonation session — start, read the roster, end, and the log.
--
-- Implements ADR-100 (01-plan.md § 4.1):
--
--   * decision 1 — a session is a row of `public.impersonation`; "live" is defined once, in
--     `impersonated_org_id()`: the caller's row with `ended_at is null` and `expires_at > now()`. The
--     database clock ends a session, not the client.
--   * decision 2 — a session unlocks definer reads only. No write path accepts a session; a system
--     admin has no `member` row, so every own-row and `is_org_admin` write policy and RPC refuses.
--   * decision 5 — a dedicated org is impersonated whole; Org public only through one of its teams.
--   * decision 7 — `impersonation.actor_id` and `team_id` carry no foreign key, so the log outlives
--     its actor and does not pin a team (`move_team_to_org`, `delete_team`).
--
-- Both tables are closed: RLS is on with no policy, and every table privilege is revoked. The org's
-- read of its own log is MIR-20-b.
--
-- **IDEMPOTENT** (ADR-024): `if not exists`, `create or replace`, and the grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The tables.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.impersonation (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        not null,          -- auth.uid() at start. No FK: ADR-100 decision 7
  actor_email text        not null,          -- snapshot of auth.users.email at start
  org_id      uuid        not null references public.org (id) on delete restrict,
  team_id     uuid        null,              -- Org public's team. No FK: AC-18 (move, delete_team)
  team_name   text        null,              -- snapshot of team.name at start
  reason      text        not null,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  ended_at    timestamptz null,
  constraint impersonation_reason_length check (char_length(btrim(reason)) between 1 and 500),
  constraint impersonation_box check (expires_at >= started_at + interval '30 minutes'
                                  and expires_at <= started_at + interval '60 minutes'),
  constraint impersonation_ended_after_start check (ended_at is null or ended_at >= started_at),
  constraint impersonation_team_named check ((team_id is null) = (team_name is null))
);
create unique index if not exists impersonation_one_open_per_actor_idx
  on public.impersonation (actor_id) where ended_at is null;

create table if not exists public.impersonation_action (
  id               uuid        primary key default gen_random_uuid(),
  impersonation_id uuid        not null references public.impersonation (id) on delete restrict,
  action           text        not null,
  at               timestamptz not null default now(),
  constraint impersonation_action_known check (action in ('start', 'end', 'read_roster'))
);
create index if not exists impersonation_action_impersonation_id_idx
  on public.impersonation_action (impersonation_id);

alter table public.impersonation        enable row level security;   -- no policy, deliberately
alter table public.impersonation_action enable row level security;   -- no policy, deliberately
revoke all on table public.impersonation        from public, anon, authenticated;
revoke all on table public.impersonation_action from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. The one place "live" is defined (decision 1). Null unless the caller is a system admin with a
--    row where ended_at is null and expires_at > now().
-- ---------------------------------------------------------------------------------------------

create or replace function public.impersonated_org_id() returns uuid
  language sql stable security definer set search_path = '' as $$
  select i.org_id
    from public.impersonation i
   where public.is_system_admin()
     and i.actor_id = (select auth.uid())
     and i.ended_at is null
     and i.expires_at > now();
$$;
revoke all on function public.impersonated_org_id() from public, anon;
grant execute on function public.impersonated_org_id() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Start. Every column reference is qualified: `returns table` names are PL/pgSQL variables.
-- ---------------------------------------------------------------------------------------------

create or replace function public.start_impersonation(
  p_org_id uuid, p_team_id uuid, p_reason text, p_minutes integer
) returns uuid
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org       public.org%rowtype;
  v_team_name text;
  v_email     text;
  v_id        uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes < 30 or p_minutes > 60 then
    raise exception 'the box is 30 to 60 minutes' using errcode = '22023';
  end if;

  select o.* into v_org from public.org o where o.id = p_org_id;
  if not found then
    raise exception 'no such org' using errcode = 'P0002';
  end if;

  if v_org.is_shared_tenant then
    if p_team_id is null then
      raise exception 'Org public is impersonated through one team' using errcode = '22023';
    end if;
    select t.name into v_team_name
      from public.team t
     where t.id = p_team_id and t.org_id = p_org_id;
    if not found then
      raise exception 'no such team in that org' using errcode = 'P0002';
    end if;
  elsif p_team_id is not null then
    raise exception 'a dedicated org is impersonated whole' using errcode = '22023';
  end if;

  -- An expired row that was never ended ends at its own `expires_at` (ADR-100 § Consequences).
  update public.impersonation i
     set ended_at = i.expires_at
   where i.actor_id = (select auth.uid())
     and i.ended_at is null
     and i.expires_at <= now();

  if exists (select 1 from public.impersonation i
              where i.actor_id = (select auth.uid()) and i.ended_at is null) then
    raise exception 'an impersonation session is already open' using errcode = 'IM001';
  end if;

  select u.email::text into v_email from auth.users u where u.id = (select auth.uid());

  -- The reason's checks are the table's own: null is 23502, empty or over 500 is 23514.
  insert into public.impersonation (actor_id, actor_email, org_id, team_id, team_name, reason, expires_at)
  values ((select auth.uid()), v_email, p_org_id, p_team_id, v_team_name, btrim(p_reason),
          now() + make_interval(mins => p_minutes))
  returning id into v_id;

  insert into public.impersonation_action (impersonation_id, action) values (v_id, 'start');
  return v_id;
end;
$$;
revoke all on function public.start_impersonation(uuid, uuid, text, integer) from public, anon;
grant execute on function public.start_impersonation(uuid, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. End.
-- ---------------------------------------------------------------------------------------------

create or replace function public.end_impersonation() returns void
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;

  update public.impersonation i
     set ended_at = i.expires_at
   where i.actor_id = (select auth.uid())
     and i.ended_at is null
     and i.expires_at <= now();

  update public.impersonation i
     set ended_at = now()
   where i.actor_id = (select auth.uid())
     and i.ended_at is null
  returning i.id into v_id;

  if v_id is not null then
    insert into public.impersonation_action (impersonation_id, action) values (v_id, 'end');
  end if;
end;
$$;
revoke all on function public.end_impersonation() from public, anon;
grant execute on function public.end_impersonation() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. The caller's own live session. Writes nothing.
-- ---------------------------------------------------------------------------------------------

create or replace function public.current_impersonation()
  returns table (
    id         uuid,
    org_id     uuid,
    org_code   text,
    org_name   text,
    team_id    uuid,
    team_name  text,
    reason     text,
    started_at timestamptz,
    expires_at timestamptz
  )
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  return query
    select i.id, i.org_id, o.org_code, o.name, i.team_id, i.team_name, i.reason,
           i.started_at, i.expires_at
      from public.impersonation i
      join public.org o on o.id = i.org_id
     where i.actor_id = (select auth.uid())
       and i.ended_at is null
       and i.expires_at > now();
end;
$$;
revoke all on function public.current_impersonation() from public, anon;
grant execute on function public.current_impersonation() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. The roster of the impersonated org, or of the one team of Org public. Refused with 42501
--    BEFORE any write; every read that succeeds is logged.
-- ---------------------------------------------------------------------------------------------

create or replace function public.impersonated_roster()
  returns table (
    member_id    uuid,
    display_name text,
    member_role  text,
    status       text,
    team_names   text[]
  )
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org     uuid;
  v_id      uuid;
  v_team_id uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  v_org := public.impersonated_org_id();
  if v_org is null then
    raise exception 'no live impersonation session' using errcode = '42501';
  end if;

  select i.id, i.team_id into v_id, v_team_id
    from public.impersonation i
   where i.actor_id = (select auth.uid())
     and i.ended_at is null
     and i.expires_at > now();
  if v_id is null then
    raise exception 'no live impersonation session' using errcode = '42501';
  end if;

  insert into public.impersonation_action (impersonation_id, action) values (v_id, 'read_roster');

  if v_team_id is null then
    return query
      select m.id, m.display_name, m.role::text, m.status::text,
             coalesce((select array_agg(t.name order by t.name)
                         from public.membership ms
                         join public.team t on t.id = ms.team_id and t.org_id = ms.org_id
                        where ms.member_id = m.id and ms.org_id = v_org and ms.left_at is null),
                      '{}'::text[])
        from public.member m
       where m.org_id = v_org and m.removed_at is null
       order by m.display_name, m.id;
  else
    return query
      select m.id, m.display_name, m.role::text, m.status::text,
             array[(select t.name from public.team t where t.id = v_team_id)]
        from public.member m
       where m.org_id = v_org and m.removed_at is null
         and exists (select 1 from public.membership ms
                      where ms.member_id = m.id and ms.team_id = v_team_id
                        and ms.org_id = v_org and ms.left_at is null)
       order by m.display_name, m.id;
  end if;
end;
$$;
revoke all on function public.impersonated_roster() from public, anon;
grant execute on function public.impersonated_roster() to authenticated;

commit;
