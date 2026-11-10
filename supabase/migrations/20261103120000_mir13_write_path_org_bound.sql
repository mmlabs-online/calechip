-- MIR-13: the write path is bounded by org, `org_id` is stamped by the database, and `membership`
-- mirrors `member.team_id` until MIR-21.
--
-- Implements ADR-071 decisions 1 to 4 and ADR-070 § 4's constraints, which MIR-12 deferred here
-- (.ai/board/tickets/MIR-12/01-plan.md Changelog 2026-10-31T12:17:00Z). Write slice only: every
-- `select` policy and every read definer function is MIR-13-b (ADR-071 decision 5).
--
-- Sections run in this order because each depends on the one before (01-plan.md § 4):
--
--   1. helpers: member_org_id, member_team_ids, member_primary_team_id, shares_active_team
--   2. the mirror trigger on `member`, so every writer of team_id, role and removed_at keeps
--      `membership` true without being touched
--   3. one `before insert` stamping trigger per org-scoped table
--   4. MIR-12's backfill re-run, the AC-4 guard, `SET NOT NULL`, and the holiday key swap
--   5. the admin-gated write functions and write policies, rewritten against org and membership
--
-- `SET NOT NULL` SCANS EACH TABLE INLINE, under an ACCESS EXCLUSIVE lock, as MIR-12 § 8 Alt 3
-- recorded. At this deployment's size that is milliseconds; a `check (org_id is not null) not valid`
-- step first would buy nothing here.
--
-- **IDEMPOTENT** (ADR-024): `create or replace`, `drop … if exists` before every trigger and policy,
-- a backfill that only touches null rows, and a key swap that tolerates having run.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Helpers (01-plan.md § 4.1). Each one applies the three conjuncts `is_admin` and
--    `member_team_id` apply: the row exists, it is not removed, and it is approved.
-- ---------------------------------------------------------------------------------------------

create or replace function public.member_org_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.org_id from public.member m
   where m.id = p_uid
     and m.removed_at is null
     and m.status = 'approved'::public.member_status;
$$;

-- Set-valued, replacing the single-valued `member_team_id` on every write path (P3-4). Under this
-- ticket the mirror keeps it at one row per member; MIR-13-b and MIR-14 are where it grows.
create or replace function public.member_team_ids(p_uid uuid) returns setof uuid
  language sql stable security definer set search_path = '' as $$
  select ms.team_id
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_uid
     and ms.left_at is null
     and m.removed_at is null
     and m.status = 'approved'::public.member_status;
$$;

create or replace function public.member_primary_team_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select ms.team_id
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_uid
     and ms.left_at is null
     and ms.is_primary
     and m.removed_at is null
     and m.status = 'approved'::public.member_status;
$$;

create or replace function public.shares_active_team(p_a uuid, p_b uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.member_team_ids(p_a) a(team_id)
      join public.member_team_ids(p_b) b(team_id) on a.team_id = b.team_id
  );
$$;

-- `anon` as well as `public`: Supabase's default privileges grant a new function to `anon`
-- directly, and `from public` alone leaves that grant in place (010-catalogue.test.sql, F-1).
revoke all on function public.member_org_id(uuid) from public, anon;
revoke all on function public.member_team_ids(uuid) from public, anon;
revoke all on function public.member_primary_team_id(uuid) from public, anon;
revoke all on function public.shares_active_team(uuid, uuid) from public, anon;
grant execute on function public.member_org_id(uuid) to authenticated;
grant execute on function public.member_team_ids(uuid) to authenticated;
grant execute on function public.member_primary_team_id(uuid) to authenticated;
grant execute on function public.shares_active_team(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. The mirror (ADR-071 decision 2). The one writer of `membership` until MIR-21 moves the
--    writers onto it and drops `member.team_id`, this function and its trigger together.
--
--    One trigger rather than a line in each writer: seven functions and the admission trigger
--    change these columns, and the admission trigger's `exception when others` would turn a
--    failed mirror write there into a sign-up nobody is warned about (01-plan.md § 8 Alt 4).
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

  if new.team_id is distinct from old.team_id then
    update public.membership ms
       set left_at = now(), is_primary = false, updated_at = now()
     where ms.member_id = new.id
       and ms.left_at is null
       and ms.is_primary;

    if new.team_id is not null and new.removed_at is null then
      -- An active row already on the new team becomes primary; the trigger never opens a second
      -- active row for one (team, member) — membership_active_team_member_idx would refuse it.
      update public.membership ms
         set is_primary = true, team_role = v_team_role, updated_at = now()
       where ms.member_id = new.id
         and ms.team_id = new.team_id
         and ms.left_at is null;
      if not found then
        insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at)
        values (new.org_id, new.team_id, new.id, v_team_role, true, now());
      end if;
    end if;
  end if;

  -- The day ADR-013 stops counting a removed member is the day their window closes (INV-04).
  if old.removed_at is null and new.removed_at is not null then
    update public.membership ms
       set left_at = greatest(new.removed_at, ms.joined_at), is_primary = false, updated_at = now()
     where ms.member_id = new.id
       and ms.left_at is null;
  end if;

  if new.role is distinct from old.role then
    update public.membership ms
       set team_role = v_team_role, updated_at = now()
     where ms.member_id = new.id
       and ms.left_at is null
       and ms.is_primary;
  end if;

  return null;
end;
$$;
revoke all on function public.member_sync_membership() from public, anon;

drop trigger if exists member_sync_membership on public.member;
create trigger member_sync_membership
  after insert or update of team_id, role, removed_at on public.member
  for each row execute function public.member_sync_membership();

-- ---------------------------------------------------------------------------------------------
-- 3. Stamping (ADR-071 decision 1). `org_id` is filled only when the inserted value is null; a
--    supplied value is kept, and the composite foreign keys refuse one that disagrees with the
--    parent. `team` and `holiday` have no parent; their write policies bound a supplied value.
--
--    The parent lookups read the row by id, not through `member_org_id`: the composite FK binds a
--    child to its parent's org whatever that member's status, and a status filter here would turn
--    a legitimate owner-side insert into a 23502.
-- ---------------------------------------------------------------------------------------------

create or replace function public.stamp_org_id() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_shared uuid := (select o.id from public.org o where o.is_shared_tenant);
begin
  -- Nested, not `and`: `new.primary_team_id` exists only on `entry`, and PL/pgSQL resolves every
  -- field an expression names before it evaluates any of it.
  if tg_table_name = 'entry' then
    if new.primary_team_id is null then
      -- INV-07: the author's active primary team. Null for a member with none, and the column's
      -- `not null` then refuses the entry (AC-8).
      new.primary_team_id := public.member_primary_team_id(new.member_id);
    end if;
  end if;

  if new.org_id is not null then
    return new;
  end if;

  case tg_table_name
    when 'team', 'holiday' then
      -- The caller's org; the shared tenant when there is no caller (an owner-side insert).
      new.org_id := coalesce(public.member_org_id((select auth.uid())), v_shared);
    when 'member' then
      -- The shared tenant for a sign-up, which has no team: MIR-19's `/{org_code}` is where a
      -- sign-up first gets an org of its own (ADR-071 decision 1).
      new.org_id := coalesce((select t.org_id from public.team t where t.id = new.team_id), v_shared);
    when 'entry', 'busy_day', 'issue_report' then
      new.org_id := (select m.org_id from public.member m where m.id = new.member_id);
    when 'event' then
      new.org_id := (select m.org_id from public.member m where m.id = new.creator_id);
    when 'notification' then
      new.org_id := (select m.org_id from public.member m where m.id = new.recipient_id);
    when 'event_invitee', 'event_attendance', 'event_guest_link', 'event_guest' then
      new.org_id := (select e.org_id from public.event e where e.id = new.event_id);
  end case;

  return new;
end;
$$;
revoke all on function public.stamp_org_id() from public, anon;

drop trigger if exists team_stamp_org_id on public.team;
create trigger team_stamp_org_id
  before insert on public.team for each row execute function public.stamp_org_id();
drop trigger if exists member_stamp_org_id on public.member;
create trigger member_stamp_org_id
  before insert on public.member for each row execute function public.stamp_org_id();
drop trigger if exists entry_stamp_org_id on public.entry;
create trigger entry_stamp_org_id
  before insert on public.entry for each row execute function public.stamp_org_id();
drop trigger if exists holiday_stamp_org_id on public.holiday;
create trigger holiday_stamp_org_id
  before insert on public.holiday for each row execute function public.stamp_org_id();
drop trigger if exists busy_day_stamp_org_id on public.busy_day;
create trigger busy_day_stamp_org_id
  before insert on public.busy_day for each row execute function public.stamp_org_id();
drop trigger if exists issue_report_stamp_org_id on public.issue_report;
create trigger issue_report_stamp_org_id
  before insert on public.issue_report for each row execute function public.stamp_org_id();
drop trigger if exists event_stamp_org_id on public.event;
create trigger event_stamp_org_id
  before insert on public.event for each row execute function public.stamp_org_id();
drop trigger if exists event_invitee_stamp_org_id on public.event_invitee;
create trigger event_invitee_stamp_org_id
  before insert on public.event_invitee for each row execute function public.stamp_org_id();
drop trigger if exists event_attendance_stamp_org_id on public.event_attendance;
create trigger event_attendance_stamp_org_id
  before insert on public.event_attendance for each row execute function public.stamp_org_id();
drop trigger if exists event_guest_link_stamp_org_id on public.event_guest_link;
create trigger event_guest_link_stamp_org_id
  before insert on public.event_guest_link for each row execute function public.stamp_org_id();
drop trigger if exists event_guest_stamp_org_id on public.event_guest;
create trigger event_guest_stamp_org_id
  before insert on public.event_guest for each row execute function public.stamp_org_id();
drop trigger if exists notification_stamp_org_id on public.notification;
create trigger notification_stamp_org_id
  before insert on public.notification for each row execute function public.stamp_org_id();

-- ---------------------------------------------------------------------------------------------
-- 4. Constraints (ADR-070 § 4; 01-plan.md § 4.5).
-- ---------------------------------------------------------------------------------------------

-- 4.1 MIR-12's backfill, copied from 20261031120000_mir12_backfill_org_public.sql (a migration must
--     not `\i` another). It catches every row written with a null `org_id` between MIR-12 and now.
--     Idempotent: each step touches only null rows or guards with `not exists`.
do $$
declare
  v_org_id   uuid;
begin
  select o.id into v_org_id from public.org o where o.is_shared_tenant;

  if v_org_id is null then
    if exists (select 1 from public.org o where o.org_code = 'shared') then
      raise exception 'mir13 refused: public.org holds org_code = ''shared'' that is not the shared tenant'
        using hint = 'Org public must be the only row with org_code = ''shared''. Inspect public.org before applying.';
    end if;

    insert into public.org (org_code, name, is_shared_tenant, timezone)
    values ('shared', 'Org public', true, 'Asia/Ho_Chi_Minh')
    returning id into v_org_id;
  end if;

  update public.team             set org_id = v_org_id where org_id is null;
  update public.member           set org_id = v_org_id where org_id is null;
  update public.event            set org_id = v_org_id where org_id is null;

  update public.entry e
     set org_id = coalesce(e.org_id, v_org_id),
         primary_team_id = coalesce(e.primary_team_id, m.team_id)
    from public.member m
   where m.id = e.member_id
     and (e.org_id is null or e.primary_team_id is null);

  update public.holiday          set org_id = v_org_id where org_id is null;
  update public.busy_day         set org_id = v_org_id where org_id is null;
  update public.issue_report     set org_id = v_org_id where org_id is null;
  update public.event_invitee    set org_id = v_org_id where org_id is null;
  update public.event_attendance set org_id = v_org_id where org_id is null;
  update public.event_guest_link set org_id = v_org_id where org_id is null;
  update public.event_guest      set org_id = v_org_id where org_id is null;
  update public.notification     set org_id = v_org_id where org_id is null;

  insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at)
  select m.org_id,
         m.team_id,
         m.id,
         case when m.role = 'manager'::public.member_role
              then 'manager'::public.team_role
              else 'member'::public.team_role end,
         m.removed_at is null,
         m.created_at,
         case when m.removed_at is null then null
              else greatest(m.removed_at, m.created_at) end
    from public.member m
   where m.team_id is not null
     and not exists (
       select 1 from public.membership ms
        where ms.member_id = m.id
          and ms.team_id = m.team_id
     );
end
$$;

-- 4.2 AC-4. An entry whose author has no team has no primary team to take, and guessing one would
--     put a past absence on a calendar it never belonged to. Stop, and leave every column nullable.
do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.entry where primary_team_id is null;
  if v_n > 0 then
    raise exception 'MIR-13: % entries have no primary team', v_n
      using hint = 'select e.id, e.member_id from public.entry e where e.primary_team_id is null;';
  end if;
end
$$;

-- 4.3 ADR-070 § 4.
alter table public.team             alter column org_id set not null;
alter table public.member           alter column org_id set not null;
alter table public.entry            alter column org_id set not null;
alter table public.entry            alter column primary_team_id set not null;
alter table public.holiday          alter column org_id set not null;
alter table public.busy_day         alter column org_id set not null;
alter table public.issue_report     alter column org_id set not null;
alter table public.event            alter column org_id set not null;
alter table public.event_invitee    alter column org_id set not null;
alter table public.event_attendance alter column org_id set not null;
alter table public.event_guest_link alter column org_id set not null;
alter table public.event_guest      alter column org_id set not null;
alter table public.notification     alter column org_id set not null;

-- 4.4 One holiday per date per org. ADM-02's reason for `unique (date)` — the status of a date is a
--     function — holds within an org, which is the only scope a calendar reads.
alter table public.holiday drop constraint if exists holiday_date_key;
do $$ begin
  alter table public.holiday
    add constraint holiday_org_id_date_key unique (org_id, date);
exception when duplicate_object or duplicate_table then null;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Rewritten (01-plan.md § 4.4): same names, signatures, error codes and messages. The rewrite
--    rules, applied to the bodies below and nowhere else:
--      member_team_id(a) = member_team_id(b)        -> shares_active_team(a, b)
--      member_team_id(x) is not null                -> exists (select 1 from member_team_ids(x))
--      team_id = member_team_id(caller)             -> team_id in (select member_team_ids(caller))
--      is_admin(caller) over a target row or team   -> … and <target>.org_id = member_org_id(caller)
-- ---------------------------------------------------------------------------------------------

-- 5.1 Teams. `create_team` is unchanged: `team_stamp_org_id` supplies the caller's org (AC-12).

create or replace function public.rename_team(p_team_id uuid, p_name text) returns public.team
  language plpgsql security definer set search_path = '' as $$
declare v_row public.team;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can rename a team' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a team needs a name' using errcode = '22023';
  end if;

  update public.team set name = btrim(p_name)
   where id = p_team_id
     and org_id = public.member_org_id((select auth.uid()))
  returning * into v_row;
  if not found then
    raise exception 'no such team' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- The org check comes before the occupancy check, so a team of another org answers 42501 whether or
-- not it has people on it (AC-12), and 23503 never confirms that it exists. The occupancy check
-- itself is unchanged.
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
  if exists (select 1 from public.member m where m.team_id = p_team_id) then
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

-- 5.2 Putting people on teams. The mirror in § 2 writes `membership` from each of these updates.

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
     and team_id is null
     and status = 'pending'::public.member_status
     and org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;
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
     and m.team_id is null
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
     and m.team_id is not null
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'that person cannot be moved' using errcode = '42501';
  end if;
end;
$$;

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
     and m.team_id in (select public.member_team_ids((select auth.uid())))
     and p_team_id = m.team_id
  returning m.* into v_row;
  if not found then
    raise exception 'that member could not be moved' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- 5.3 Ranks (ADR-065). Same refusals; "the caller's team" is now any active team of the caller.

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
     -- ADR-065 decision 1. Also excludes a null team_id: `in` never matches a null.
     and m.team_id in (select public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  -- Not on the caller's teams, another org, pending, removed, an admin, or nobody. One answer.
  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;

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
     and m.team_id in (select public.member_team_ids((select auth.uid())))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  if not found then
    raise exception 'that member could not be promoted' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- 5.4 Events. Every policy that calls `may_manage_event` — invitee select and delete, attendance
--     update, the guest link, guest updates, and `list_event_guest_emails` — inherits the org
--     bound from it without being re-created.

create or replace function public.event_stamp() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.team_id := public.member_primary_team_id(new.creator_id);
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.may_manage_event(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event e
     where e.id = p_event_id
       and ((e.creator_id = p_uid and exists (select 1 from public.member_team_ids(p_uid)))
            or (public.is_admin(p_uid) and e.org_id = public.member_org_id(p_uid)))
  );
$$;

-- A public event is public within its org (AC-15). Org public's own reach across orgs is MIR-15.
create or replace function public.is_event_audience(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.member_team_ids(p_uid))
     and exists (
       select 1 from public.event e
        where e.id = p_event_id
          and e.org_id = public.member_org_id(p_uid)
          and (e.creator_id = p_uid
               or e.scope = 'public'::public.event_scope
               or (e.scope = 'team'::public.event_scope
                   and e.team_id in (select public.member_team_ids(p_uid)))
               or (e.scope = 'named'::public.event_scope
                   and public.is_event_invitee(e.id, p_uid)))
     );
$$;

-- EVT-12's body with two changes: an address is a member's only within the event's org — any other
-- address is an outsider and gets the guest path (AC-16) — and "the team as it stands" is every
-- member with an active membership on it.
create or replace function public.invite_to_event(p_event_id uuid, p_emails text[])
  returns table (email text, outcome text)
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_scope   public.event_scope;
  v_team    uuid;
  v_creator uuid;
  v_addr    text;
  v_clean   text[] := '{}'::text[];
  v_seen    text[] := '{}'::text[];
  v_members uuid[] := '{}'::uuid[];
  v_member  uuid;
  v_id      uuid;
  v_i       integer;
begin
  if v_uid is null or not coalesce(public.may_manage_event(p_event_id, v_uid), false) then
    raise exception 'event_not_permitted' using errcode = '42501';
  end if;

  -- AC-8. Submissions on one event serialise; a scope change or a delete waits.
  select e.scope, e.team_id, e.creator_id
    into v_scope, v_team, v_creator
    from public.event e
   where e.id = p_event_id
     for update;

  foreach v_addr in array coalesce(p_emails, '{}'::text[]) loop
    v_addr := btrim(coalesce(v_addr, ''));
    continue when v_addr = '';
    if char_length(v_addr) > 254
       or v_addr !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'invalid_invitation_email' using errcode = 'EV008';
    end if;
    if not (lower(v_addr) = any (v_seen)) then
      v_seen  := v_seen || lower(v_addr);
      v_clean := v_clean || v_addr;
    end if;
  end loop;
  if cardinality(v_clean) = 0 then
    raise exception 'invalid_invitation_email' using errcode = 'EV008';
  end if;

  if v_scope = 'public'::public.event_scope then
    -- EVT-08, verbatim. NO READ OF `public.member` OR `auth.users` IN THIS BRANCH (AC-12).
    insert into public.event_guest_link (event_id) values (p_event_id)
    on conflict (event_id) do nothing;

    foreach v_addr in array v_clean loop
      v_id := null;
      insert into public.event_email_invitation (event_id, email, invited_by)
      values (p_event_id, v_addr, v_uid)
      on conflict do nothing
      returning id into v_id;
      email   := v_addr;
      outcome := case when v_id is null then 'ignored' else 'sent' end;
      return next;
    end loop;
    return;
  end if;

  -- Own team or Limited people. Step 5.1: each address to an approved member of the event's org,
  -- or null.
  foreach v_addr in array v_clean loop
    v_member := null;
    select m.id into v_member
      from public.member m
      join auth.users u on u.id = m.id
     where lower(u.email) = lower(v_addr)
       and m.status = 'approved'::public.member_status
       and m.removed_at is null
       and m.org_id = (select e.org_id from public.event e where e.id = p_event_id)
     limit 1;
    v_members := array_append(v_members, v_member);         -- a null element for an outsider
  end loop;

  -- Step 5.2. AC-4, AC-9: an outsider's address, invited now or before, opens the event to guests.
  -- Members only leave it as it was (AC-5, AC-6).
  if array_position(v_members, null) is not null then
    insert into public.event_guest_link (event_id) values (p_event_id)
    on conflict (event_id) do nothing;
  end if;

  -- Step 5.3. One address after another, each seeing what the earlier ones left (AC-8).
  for v_i in 1 .. cardinality(v_clean) loop
    v_addr   := v_clean[v_i];
    v_member := v_members[v_i];
    v_id     := null;
    insert into public.event_email_invitation (event_id, email, invited_by)
    values (p_event_id, v_addr, v_uid)
    on conflict do nothing
    returning id into v_id;
    email := v_addr;
    if v_id is null then
      outcome := 'ignored';                                   -- AC-9
      return next;
      continue;
    end if;
    outcome := 'sent';

    -- AC-4 (an outsider) and AC-5 (a reader): the trigger above has mailed, or chosen not to.
    if v_member is null or public.may_read_event(p_event_id, v_member) then
      return next;
      continue;
    end if;

    -- AC-7. Own team: convert to named, naming the team as it stands, silently (Q1-A, Q6-A).
    if v_scope = 'team'::public.event_scope then
      perform set_config('calechip.event_conversion', p_event_id::text, true);
      update public.event set scope = 'named'::public.event_scope where id = p_event_id;
      insert into public.event_invitee (event_id, member_id)
      select p_event_id, m.id
        from public.member m
       where v_team in (select public.member_team_ids(m.id))
         and m.id <> v_creator
      on conflict do nothing;
      perform set_config('calechip.event_conversion', '', true);
      v_scope := 'named'::public.event_scope;
    end if;

    -- AC-6. The member outside its reach joins the event's people. `notify_event_invited` writes
    -- their `event_invited` row, and EVT-05's `email_notification` mails it when on (Q3-A).
    insert into public.event_invitee (event_id, member_id)
    values (p_event_id, v_member)
    on conflict do nothing;
    return next;
  end loop;
end;
$$;

-- 5.5 Write policies. `drop … if exists` then `create`, each for the same command as before.

drop policy if exists member_update_admin on public.member;
create policy member_update_admin on public.member
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id in (select public.member_team_ids((select auth.uid())))
  )
  with check (
    team_id in (select public.member_team_ids((select auth.uid())))
  );

drop policy if exists member_decide_admin on public.member;
create policy member_decide_admin on public.member
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id is null
    and status = 'pending'::public.member_status
    and org_id = public.member_org_id((select auth.uid()))
  )
  with check (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
    and (
      (status = 'approved'::public.member_status
         and team_id in (select public.member_team_ids((select auth.uid()))))
      or (status = 'rejected'::public.member_status and team_id is null)
    )
  );

-- ADR-071 decision 3. The two setters send no team id, so the row is the caller's primary team and
-- no client-supplied id is trusted. Naming a team from a screen is MIR-16/MIR-17.
drop policy if exists team_update_admin on public.team;
create policy team_update_admin on public.team
  for update to authenticated
  using      (id = public.member_primary_team_id((select auth.uid()))
              and public.is_admin((select auth.uid())))
  with check (id = public.member_primary_team_id((select auth.uid()))
              and public.is_admin((select auth.uid())));

-- INV-02's reset to `pending` is `entry_enforce_decision()`'s, which is actor-blind and untouched.
drop policy if exists entry_update_admin on public.entry;
create policy entry_update_admin on public.entry
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.shares_active_team(member_id, (select auth.uid()))
  )
  with check (
    public.shares_active_team(member_id, (select auth.uid()))
  );

drop policy if exists entry_delete_admin on public.entry;
create policy entry_delete_admin on public.entry
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.shares_active_team(member_id, (select auth.uid()))
  );

drop policy if exists entry_update_manager on public.entry;
create policy entry_update_manager on public.entry
  for update to authenticated
  using (
    public.may_decide((select auth.uid()))
    and not public.is_admin((select auth.uid()))
    and public.shares_active_team(member_id, (select auth.uid()))
  )
  with check (
    public.shares_active_team(member_id, (select auth.uid()))
  );

drop policy if exists holiday_insert_admin on public.holiday;
create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
  );

drop policy if exists holiday_update_admin on public.holiday;
create policy holiday_update_admin on public.holiday
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
  )
  with check (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
  );

drop policy if exists holiday_delete_admin on public.holiday;
create policy holiday_delete_admin on public.holiday
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
  );

drop policy if exists issue_report_update_admin on public.issue_report;
create policy issue_report_update_admin on public.issue_report
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
  )
  with check (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
  );

drop policy if exists busy_day_insert_own on public.busy_day;
create policy busy_day_insert_own on public.busy_day
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

drop policy if exists busy_day_delete_own on public.busy_day;
create policy busy_day_delete_own on public.busy_day
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

drop policy if exists event_insert_own on public.event;
create policy event_insert_own on public.event
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

drop policy if exists event_update_manage on public.event;
create policy event_update_manage on public.event
  for update to authenticated
  using (
    (creator_id = (select auth.uid())
     and exists (select 1 from public.member_team_ids((select auth.uid()))))
    or (public.is_admin((select auth.uid()))
        and org_id = public.member_org_id((select auth.uid())))
  )
  with check (
    (creator_id = (select auth.uid())
     and exists (select 1 from public.member_team_ids((select auth.uid()))))
    or (public.is_admin((select auth.uid()))
        and org_id = public.member_org_id((select auth.uid())))
  );

drop policy if exists event_delete_manage on public.event;
create policy event_delete_manage on public.event
  for delete to authenticated
  using (
    (creator_id = (select auth.uid())
     and exists (select 1 from public.member_team_ids((select auth.uid()))))
    or (public.is_admin((select auth.uid()))
        and org_id = public.member_org_id((select auth.uid())))
  );

drop policy if exists event_invitee_insert_manage on public.event_invitee;
create policy event_invitee_insert_manage on public.event_invitee
  for insert to authenticated
  with check (
    public.may_manage_event(event_id, (select auth.uid()))
    and exists (select 1 from public.member_team_ids(member_id))
  );

drop policy if exists event_attendance_delete_own on public.event_attendance;
create policy event_attendance_delete_own on public.event_attendance
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
    and status in ('pending'::public.attendance_status, 'attending'::public.attendance_status)
    and public.event_registration_open(event_id)
  );

drop policy if exists notification_update_own on public.notification;
create policy notification_update_own on public.notification
  for update to authenticated
  using (
    recipient_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  )
  with check (
    recipient_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

commit;
