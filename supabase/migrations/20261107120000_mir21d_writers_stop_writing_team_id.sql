-- MIR-21-d: writers stop writing `member.team_id`, and no test reads it.
--
-- Implements ADR-080 decision 2 (.ai/board/tickets/MIR-21-d/01-plan.md § 4.1):
--
--   admit_member, reject_member, move_member and set_member_team stop assigning `team_id`.
--
-- The column is stale from here on for anybody admitted, rejected or moved: it is written only by
-- fixture inserts (MIR-21-e) until it is dropped (MIR-21-f). And the self-move refusal a caller
-- meets is now `membership_refuse_own_rows`'s (MIR-21-c) alone — the column clause of
-- `member_enforce_role_and_removal` no longer has a changed column in front of it to refuse first.
--
-- Every body below is the latest definition (20261105210000_mir21b_writers_write_membership.sql
-- § 2), changed only as 01-plan.md § 4.1 states. Each keeps its name, signature, return type,
-- volatility, security mode and `set search_path = ''`, so `create or replace` keeps its grants. No
-- table, column, constraint, policy, trigger or grant changes.
--
-- **IDEMPOTENT** (ADR-024): `create or replace` for every function.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

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
     set status = 'approved'::public.member_status
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
     set status = 'rejected'::public.member_status
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

  if not exists (
    select 1 from public.member m
     where m.id = p_member_id
       and public.member_roster_team_id(m.id) is not null
       and m.status = 'approved'::public.member_status
       and m.removed_at is null
       and m.org_id = public.member_org_id((select auth.uid()))
  ) then
    raise exception 'that person cannot be moved' using errcode = '42501';
  end if;

  perform public.membership_make_primary(p_member_id, p_team_id);
end;
$$;

-- Accepts only the member's current roster team, so it never changes a team and writes no
-- `membership` row. It no longer writes `member` at all.
create or replace function public.set_member_team(p_member_id uuid, p_team_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can move a member' using errcode = '42501';
  end if;

  select m.* into v_row
    from public.member m
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and p_team_id = public.member_roster_team_id(m.id);
  if not found then
    raise exception 'that member could not be moved' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

commit;
