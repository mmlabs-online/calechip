-- MIR-21-b: the writer slice. Every function that puts a person on a team or changes their rank
-- writes `membership` itself, and the mirror stops copying team and rank changes.
--
-- Implements ADR-078 decisions 1 to 3, within ADR-077 decision 5 and ADR-071 decision 2
-- (.ai/board/tickets/MIR-21-b/01-plan.md § 4):
--
--   1. the owner-only helper `membership_make_primary(uuid, uuid)` (§ 4.1)
--   2. eight writers off the column for every predicate (§ 4.2): admit_member, reject_member,
--      move_member, set_member_team, set_member_role, promote_member_to_admin, delete_team,
--      grant_system_admin
--   3. the `member_update_admin` policy off the column (§ 4.3)
--   4. the mirror loses its team-change and rank-change branches, and its trigger fires on insert
--      and on `removed_at` only (§ 4.4)
--
-- THE COLUMN IS STILL WRITTEN, by the same statements as before (ADR-078 decision 1), so it stays
-- equal to `member_roster_team_id(id)` until MIR-21-c drops it. Every writer updates `member`
-- first and `membership` second: `member_enforce_role_and_removal` (ADR-064 decision 3) then raises
-- on a self change before any `membership` row is touched, and the statement's writes roll back.
--
-- Every body below is the latest definition (20261103120000_mir13_write_path_org_bound.sql § 5,
-- 20261104150000_mir18_system_admin.sql § 4), changed only as 01-plan.md § 4.2 states. Each keeps
-- its name, signature, return type, volatility and security mode, so `create or replace` keeps its
-- grants. No table, column or constraint changes.
--
-- **IDEMPOTENT** (ADR-024): `create or replace` for every function, `drop … if exists` before every
-- trigger and policy.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The helper (01-plan.md § 4.1).
-- ---------------------------------------------------------------------------------------------

-- ADR-078 decision 2. What the mirror's team-change branch did (mir13_write_path_org_bound.sql
-- :119-140): close the active primary row on another team, then promote an active row on the target
-- team, or open one. A no-op when the target is already the active primary. Owner-only.
create or replace function public.membership_make_primary(p_member_id uuid, p_team_id uuid)
  returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  v_org  uuid;
  v_role public.team_role;
begin
  select m.org_id,
         case when m.role = 'manager'::public.member_role
              then 'manager'::public.team_role else 'member'::public.team_role end
    into v_org, v_role
    from public.member m
   where m.id = p_member_id;

  if exists (select 1 from public.membership ms
              where ms.member_id = p_member_id and ms.team_id = p_team_id
                and ms.left_at is null and ms.is_primary) then
    return;
  end if;

  update public.membership ms
     set left_at = now(), is_primary = false, updated_at = now()
   where ms.member_id = p_member_id
     and ms.left_at is null
     and ms.is_primary;

  update public.membership ms
     set is_primary = true, team_role = v_role, updated_at = now()
   where ms.member_id = p_member_id
     and ms.team_id = p_team_id
     and ms.left_at is null;
  if not found then
    insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at)
    values (v_org, p_team_id, p_member_id, v_role, true, now());
  end if;
end;
$$;
revoke all on function public.membership_make_primary(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Writers (01-plan.md § 4.2). Every predicate that read the column reads the roster team.
--    The `membership` write, where there is one, comes after the `not found` check.
-- ---------------------------------------------------------------------------------------------

-- The org check comes before the occupancy check, so a team of another org answers 42501 whether or
-- not it has people on it, and 23503 never confirms that it exists. "People on it" is now everyone
-- whose roster team it is, removed members included, exactly the rows the column named.
create or replace function public.delete_team(p_team_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can delete a team' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t
                  where t.id = p_team_id
                    and t.org_id = public.member_org_id((select auth.uid()))) then
    raise exception 'no such team' using errcode = '42501';
  end if;
  if exists (select 1 from public.member m where public.member_roster_team_id(m.id) = p_team_id) then
    raise exception 'a team with people on it cannot be deleted' using errcode = '23503';
  end if;

  delete from public.team
   where id = p_team_id
     and org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'no such team' using errcode = '42501';
  end if;
end;
$$;

-- Putting people on teams. The mirror no longer writes on a team change (§ 4 below), so the two
-- writers that put somebody on a team call the helper themselves.

create or replace function public.admit_member(p_member_id uuid, p_team_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can decide a sign-up' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t
                  where t.id = p_team_id
                    and t.org_id = public.member_org_id((select auth.uid()))) then
    raise exception 'no such team' using errcode = '42501';
  end if;

  update public.member
     set status = 'approved'::public.member_status, team_id = p_team_id
   where id = p_member_id
     and public.member_roster_team_id(id) is null
     and status = 'pending'::public.member_status
     and org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;

  perform public.membership_make_primary(p_member_id, p_team_id);
end;
$$;

create or replace function public.reject_member(p_member_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can decide a sign-up' using errcode = '42501';
  end if;

  update public.member m
     set status = 'rejected'::public.member_status, team_id = null
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) is null
     and m.status = 'pending'::public.member_status
     and m.org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.move_member(p_member_id uuid, p_team_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can move somebody between teams' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t
                  where t.id = p_team_id
                    and t.org_id = public.member_org_id((select auth.uid()))) then
    raise exception 'no such team' using errcode = '42501';
  end if;

  update public.member m
     set team_id = p_team_id
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) is not null
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'that person cannot be moved' using errcode = '42501';
  end if;

  perform public.membership_make_primary(p_member_id, p_team_id);
end;
$$;

-- Accepts only the member's current roster team, so it never changes a team and writes no
-- `membership` row.
create or replace function public.set_member_team(p_member_id uuid, p_team_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can move a member' using errcode = '42501';
  end if;

  update public.member m
     set team_id = p_team_id
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and p_team_id = public.member_roster_team_id(m.id)
  returning m.* into v_row;
  if not found then
    raise exception 'that member could not be moved' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- Ranks (ADR-065). Same refusals; "the caller's team" is any active team of the caller. The team
-- role written is the one the mirror's rank branch wrote: `manager` for a manager, else `member`.

create or replace function public.set_member_role(p_member_id uuid, p_role public.member_role)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can change a rank' using errcode = '42501';
  end if;

  -- ADR-065 decision 2.
  if p_role = 'admin'::public.member_role then
    raise exception 'promotion to admin is promote_member_to_admin, not a rank change'
      using errcode = '42501';
  end if;

  update public.member m
     set role = p_role
   where m.id = p_member_id
     -- ADR-065 decision 1. Also excludes a person with no roster team: `in` never matches a null.
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  -- Not on the caller's teams, another org, pending, removed, an admin, or nobody. One answer.
  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;

  update public.membership ms
     set team_role = case when p_role = 'manager'::public.member_role
                          then 'manager'::public.team_role else 'member'::public.team_role end,
         updated_at = now()
   where ms.member_id = p_member_id
     and ms.left_at is null
     and ms.is_primary;

  return v_row;
end;
$$;

create or replace function public.promote_member_to_admin(p_member_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can promote a member' using errcode = '42501';
  end if;

  update public.member m
     set role = 'admin'::public.member_role
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  if not found then
    raise exception 'that member could not be promoted' using errcode = '42501';
  end if;

  update public.membership ms
     set team_role = 'member'::public.team_role, updated_at = now()
   where ms.member_id = p_member_id
     and ms.left_at is null
     and ms.is_primary;

  return v_row;
end;
$$;

-- Making a system admin (ADR-074 decision 3). "No team" is now "no `membership` row", which the
-- existing clause below already says; the column clause it duplicated is gone.
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

-- ---------------------------------------------------------------------------------------------
-- 3. The removal policy (01-plan.md § 4.3). `member_roster_team_id` is `stable`, so inside the
--    removal `update` it reads the row as it stood at statement start: active, on its team. The
--    `with check` therefore admits a removal exactly as the column did.
-- ---------------------------------------------------------------------------------------------

drop policy if exists member_update_admin on public.member;
create policy member_update_admin on public.member
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.member_roster_team_id(id) in (select public.member_team_ids((select auth.uid())))
  )
  with check (
    public.member_roster_team_id(id) in (select public.member_team_ids((select auth.uid())))
  );

-- ---------------------------------------------------------------------------------------------
-- 4. The mirror (01-plan.md § 4.4). The INSERT branch and the removal branch are kept verbatim;
--    the team-change and rank-change branches are gone, because the writers above now do that
--    work. The INSERT branch and the removal close go with the column, in MIR-21-c.
-- ---------------------------------------------------------------------------------------------

create or replace function public.member_sync_membership() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_team_role public.team_role := case when new.role = 'manager'::public.member_role
                                       then 'manager'::public.team_role
                                       else 'member'::public.team_role end;
begin
  if tg_op = 'INSERT' then
    -- The row MIR-12's backfill would have written (ADR-070 § 3), so a member inserted now and one
    -- backfilled then look the same.
    if new.team_id is not null
       and not exists (select 1 from public.membership ms
                        where ms.member_id = new.id
                          and ms.team_id = new.team_id
                          and ms.left_at is null) then
      insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at)
      values (new.org_id, new.team_id, new.id, v_team_role,
              new.removed_at is null,
              new.created_at,
              case when new.removed_at is null then null
                   else greatest(new.removed_at, new.created_at) end);
    end if;
    return null;
  end if;

  -- The day ADR-013 stops counting a removed member is the day their window closes (INV-04).
  if old.removed_at is null and new.removed_at is not null then
    update public.membership ms
       set left_at = greatest(new.removed_at, ms.joined_at), is_primary = false, updated_at = now()
     where ms.member_id = new.id
       and ms.left_at is null;
  end if;

  return null;
end;
$$;
revoke all on function public.member_sync_membership() from public, anon;

drop trigger if exists member_sync_membership on public.member;
create trigger member_sync_membership
  after insert or update of removed_at on public.member
  for each row execute function public.member_sync_membership();

commit;
