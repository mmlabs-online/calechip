-- MIR-16-h. `'manager'` leaves `public.member_role`: the type is re-created as
-- (`'member'`, `'org_admin'`), `member.role` is re-typed with every `manager` row becoming
-- `member`, `member_role_change.from_role` / `to_role` keep their words as `text`, and
-- `set_member_role` takes `text` (ADR-086 decision 2, ADR-087 decision 2;
-- .ai/board/tickets/MIR-16-h/01-plan.md § 4.1).
--
-- Nobody's power changes. After this file a person's global role is one of two things, `member` or
-- `org_admin`, and *manager* exists only where it is decided and read: on the team (ADR-073,
-- MIR-16-c, MIR-16-f). The audit trail still says, in its own words, who was made a manager and
-- when — `member_role_change.from_role` / `to_role` are `text` now, not the enum, precisely so a
-- row that once said `manager` keeps saying it after the word leaves the type.
--
-- Steps 1-7 are guarded so a second run is a no-op (ADR-024): the audit trigger is dropped and
-- re-created regardless (`drop trigger if exists` / `create trigger`, idempotent by nature), but the
-- type swap itself only runs while the old type still carries the `manager` label. Step 8 is
-- `create or replace`, idempotent on its own.
--
-- Applying this file to a remote database is human (RULE-09). The person applying it first runs the
-- `pg_depend` query from 01-plan.md § 4.1 against the hosted catalogue — an extra dependent there is
-- ADR-086's revert condition.

begin;

do $mig$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typnamespace = 'public'::regnamespace
       and t.typname = 'member_role' and e.enumlabel = 'manager'
  ) then

    -- -------------------------------------------------------------------------------------------
    -- 1. The audit trigger names `role` in its column list and `when` clause, which blocks a
    --    re-type of the column. Dropped here and re-created in step 8, against the new type.
    -- -------------------------------------------------------------------------------------------
    drop trigger if exists member_record_role_change on public.member;

    -- -------------------------------------------------------------------------------------------
    -- 2. The history keeps its words (ADR-086 decision 2). Re-typed to `text` before the enum that
    --    typed it is touched, so no cast through the old or the new type is in play.
    -- -------------------------------------------------------------------------------------------
    alter table public.member_role_change
      alter column from_role type text using from_role::text,
      alter column to_role   type text using to_role::text;
    alter table public.member_role_change
      add constraint member_role_change_roles_known
      check (from_role in ('member', 'manager', 'org_admin')
         and to_role   in ('member', 'manager', 'org_admin'));

    -- -------------------------------------------------------------------------------------------
    -- 3. The only function whose signature names the type. Re-created in step 8 against `text`.
    -- -------------------------------------------------------------------------------------------
    drop function if exists public.set_member_role(uuid, public.member_role);

    -- -------------------------------------------------------------------------------------------
    -- 4.-7. The type swap. A column re-type fires no row trigger, so neither the demotion and
    --    removed-member clauses of member_enforce_role_and_removal nor the audit trigger (dropped
    --    above) is met by it. `'manager'` rows become `'member'`; every other row is unchanged.
    --    No `cascade` anywhere: anything still on the old type after this makes the `drop type`
    --    fail rather than vanish silently.
    -- -------------------------------------------------------------------------------------------
    alter type public.member_role rename to member_role_old;
    create type public.member_role as enum ('member', 'org_admin');
    alter table public.member alter column role drop default;
    alter table public.member
      alter column role type public.member_role
      using (case when role::text = 'manager' then 'member' else role::text end)::public.member_role;
    alter table public.member alter column role set default 'member'::public.member_role;
    drop type public.member_role_old;

  end if;
end;
$mig$;

-- ---------------------------------------------------------------------------------------------
-- 8. Re-created against the new type. `create or replace`, so this half is idempotent on its own
--    and runs whether or not the guard above fired.
-- ---------------------------------------------------------------------------------------------

create or replace function public.member_record_role_change() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_role_change (member_id, from_role, to_role, changed_by)
  values (new.id, old.role::text, new.role::text, (select auth.uid()));
  return null;
end;
$$;
revoke all on function public.member_record_role_change() from public;

drop trigger if exists member_record_role_change on public.member;
create trigger member_record_role_change
  after update of role on public.member
  for each row
  when (old.role is distinct from new.role)
  execute function public.member_record_role_change();

-- `set_member_role(uuid, text)`. MIR-16-f's body (20261108150000 :22-77), with three changes:
--   - after the door check, the `org_admin` refusal keeps its message and errcode; a new `elsif`
--     refuses any word that is not a rank with `22023` (new, this PLAN's — § 2 AC-6);
--   - `v_to := p_role::public.team_role` replaces the `case` that compared against the enum, since
--     `p_role` is now `text` and `public.team_role`'s labels are the same two words;
--   - the audit insert writes `text` directly: `from_role = coalesce(v_from::text, 'member')`,
--     `to_role = p_role`. Every other line is verbatim, including
--     `m.role <> 'org_admin'::public.member_role`, which still resolves: the enum still exists, it
--     just no longer has a `manager` label.
create or replace function public.set_member_role(p_member_id uuid, p_role text)
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
  if p_role = 'org_admin' then
    raise exception 'promotion to admin is promote_member_to_admin, not a rank change'
      using errcode = '42501';
  elsif p_role is null or p_role not in ('member', 'manager') then
    raise exception 'not a rank: %', p_role using errcode = '22023';
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

  v_to := p_role::public.team_role;

  select ms.team_role into v_from
    from public.membership ms
   where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;

  -- ADR-086 decision 1. A change writes the row and its audit; no change writes nothing.
  if v_from is distinct from v_to then
    update public.membership ms
       set team_role = v_to, updated_at = now()
     where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;

    insert into public.member_role_change (member_id, from_role, to_role, changed_by)
    values (p_member_id, coalesce(v_from::text, 'member'), p_role, (select auth.uid()));
  end if;

  return v_row;
end;
$$;
revoke all on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;

commit;
