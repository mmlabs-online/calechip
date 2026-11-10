-- MIR-16-f. `set_member_role` writes `membership.team_role` and its own `member_role_change` row,
-- and no longer writes `member.role` (ADR-086 decision 1; .ai/board/tickets/MIR-16-f/01-plan.md § 4.1).
--
-- Nobody's power changes. The refusals are unchanged — only an org admin, over an approved,
-- not-removed, not-org-admin member of a team they share, in the same org, and never promotion to
-- `org_admin` (that stays `promote_member_to_admin`'s). What changes is what the call writes: the
-- rank is now recorded only where it is read, `membership.team_role` (ADR-073, MIR-16-c), and the
-- audit row is inserted here rather than left to `member_record_role_change`, which fires on
-- `member.role` and therefore no longer sees this change at all. A call that changes nothing writes
-- nothing, as the trigger's `when` clause did.
--
-- Legacy rows that already hold `member.role = 'manager'` are untouched and keep reading as
-- managers through `team_role` (MIR-16-c). Removing the value from the type is MIR-16-g
-- (ADR-086 decision 2).
--
-- Idempotent (ADR-024): `create or replace`, same signature, so existing grants are kept.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

create or replace function public.set_member_role(p_member_id uuid, p_role public.member_role)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row  public.member;
  v_from public.team_role;
  v_to   public.team_role;
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can change a rank' using errcode = '42501';
  end if;

  -- ADR-065 decision 2.
  if p_role = 'org_admin'::public.member_role then
    raise exception 'promotion to admin is promote_member_to_admin, not a rank change'
      using errcode = '42501';
  end if;

  -- The five predicates of 20261107235000 :110-116, as a select: nothing on `member` is written.
  select m.* into v_row
    from public.member m
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'org_admin'::public.member_role;

  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;

  v_to := case when p_role = 'manager'::public.member_role
               then 'manager'::public.team_role else 'member'::public.team_role end;

  select ms.team_role into v_from
    from public.membership ms
   where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;

  -- ADR-086 decision 1. A change writes the row and its audit; no change writes nothing.
  if v_from is distinct from v_to then
    update public.membership ms
       set team_role = v_to, updated_at = now()
     where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;

    insert into public.member_role_change (member_id, from_role, to_role, changed_by)
    values (p_member_id,
            case when v_from = 'manager'::public.team_role
                 then 'manager'::public.member_role else 'member'::public.member_role end,
            p_role,
            (select auth.uid()));
  end if;

  return v_row;
end;
$$;

commit;
