-- MIR-15-c: a system admin moves one team out of Org public into a dedicated org (ADR-093, accepted
-- by `tech-lead-design` under the operator's delegation, ADR-067; RULE-09 — applying this file to a
-- remote database is human).
--
--   * decision 1 — one team per move, from Org public only, into a dedicated org only (`22023`).
--   * decision 2 — the target's caps (`max_members`, `max_teams`) do not refuse a move.
--   * decision 3 — the movers (a team's active members, plus team-less members whose last team it was)
--     and everything they own, and the team's events with everything hanging off them, change `org_id`
--     and nothing else.
--   * decision 4 — four refusals, each naming what is in the way in `detail`: `MT001` a mover on
--     another team, `MT002` an event split from its creator, `MT003` an entry split from who decided
--     it, `MT004` a stayer with nowhere to keep an entry.
--   * decision 5 — connections that would span the new boundary are deleted, and counted.
--   * decision 6 — the nineteen composite foreign keys of ADR-070 § 4 become
--     `deferrable initially immediate`. Nothing that does not ask changes; `move_team_to_org` alone
--     defers them, writes, and sets them immediate again before it returns.
--   * decision 7 — `event_attendance_guard` and `event_guest_guard` let an update that rewrites
--     `org_id` and nothing else through, as their first clause.
--   * decision 8 — `list_shared_teams()` and `move_team_to_org(uuid, uuid)`, `security definer`, each
--     refusing with `42501` unless `public.is_system_admin()`, executable by `authenticated` only.
--
-- `is_system_admin()` is `security invoker` and reads `auth.uid()` and `auth.jwt()` from the request
-- settings, so it still refuses from inside a definer function (ADR-075, MIR-18-b).
--
-- **IDEMPOTENT** (ADR-024): `alter constraint` restated, `create or replace`, grants restated. The
-- migration updates no row.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The nineteen keys become deferrable (decision 6). Each stays `initially immediate`, so every
--    statement that does not say otherwise is checked at its own end exactly as before.
-- ---------------------------------------------------------------------------------------------

alter table public.membership       alter constraint membership_team_org_fk         deferrable initially immediate;
alter table public.membership       alter constraint membership_member_org_fk       deferrable initially immediate;
alter table public.entry            alter constraint entry_member_org_fk            deferrable initially immediate;
alter table public.entry            alter constraint entry_primary_team_org_fk      deferrable initially immediate;
alter table public.entry            alter constraint entry_approved_by_org_fk       deferrable initially immediate;
alter table public.entry            alter constraint entry_rejected_by_org_fk       deferrable initially immediate;
alter table public.busy_day         alter constraint busy_day_member_org_fk         deferrable initially immediate;
alter table public.issue_report     alter constraint issue_report_member_org_fk     deferrable initially immediate;
alter table public.event            alter constraint event_creator_org_fk           deferrable initially immediate;
alter table public.event            alter constraint event_team_org_fk              deferrable initially immediate;
alter table public.event_invitee    alter constraint event_invitee_event_org_fk     deferrable initially immediate;
alter table public.event_invitee    alter constraint event_invitee_member_org_fk    deferrable initially immediate;
alter table public.event_attendance alter constraint event_attendance_event_org_fk  deferrable initially immediate;
alter table public.event_attendance alter constraint event_attendance_member_org_fk deferrable initially immediate;
alter table public.event_guest_link alter constraint event_guest_link_event_org_fk  deferrable initially immediate;
alter table public.event_guest      alter constraint event_guest_event_org_fk       deferrable initially immediate;
alter table public.notification     alter constraint notification_recipient_org_fk  deferrable initially immediate;
alter table public.notification     alter constraint notification_actor_org_fk      deferrable initially immediate;
alter table public.notification     alter constraint notification_event_org_fk      deferrable initially immediate;

-- ---------------------------------------------------------------------------------------------
-- 2. The list (decision 8). Every column reference is qualified: `returns table` names are
--    PL/pgSQL variables in scope.
-- ---------------------------------------------------------------------------------------------

create or replace function public.list_shared_teams()
  returns table (
    id             uuid,
    name           text,
    active_members integer,
    created_at     timestamptz
  )
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  return query
    select t.id, t.name,
           (select count(*)::integer
              from public.membership ms
             where ms.team_id = t.id
               and ms.left_at is null),
           t.created_at
      from public.team t
      join public.org o on o.id = t.org_id
     where o.is_shared_tenant
     order by t.name, t.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. The move (decisions 1 to 6). Steps are numbered as in 01-plan.md § 4.1 item 3.
-- ---------------------------------------------------------------------------------------------

create or replace function public.move_team_to_org(p_team_id uuid, p_target_org_id uuid)
  returns table (moved_members integer, deleted_links integer)
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team     public.team;
  v_target   public.org;
  v_source   public.org;
  v_movers   uuid[];
  v_list     text;
  v_stay     record;
  v_stay_ids   uuid[] := '{}'::uuid[];
  v_stay_homes uuid[] := '{}'::uuid[];
  v_missing  text;
  v_deleted  integer := 0;
  v_n        integer;
begin
  -- 1. The gate, before any row is read.
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;

  -- 2. Lock the team, then the target org.
  select * into v_team from public.team t where t.id = p_team_id for update;
  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
  select * into v_target from public.org o where o.id = p_target_org_id for update;
  if not found then
    raise exception 'org not found' using errcode = 'P0002';
  end if;

  -- 3. Decision 1: from Org public only, into a dedicated org only.
  select * into v_source from public.org o where o.id = v_team.org_id;
  if not v_source.is_shared_tenant then
    raise exception 'only a team of Org public can be moved' using errcode = '22023';
  end if;
  if v_target.is_shared_tenant then
    raise exception 'a team cannot be moved into Org public' using errcode = '22023';
  end if;

  -- 4. Decision 3: the movers. Every member with an active membership on the team, plus every member
  --    with no active membership whose most recently ended row is on the team (ADR-077 decision 1).
  select coalesce(array_agg(x.member_id), '{}'::uuid[])
    into v_movers
    from (
      select ms.member_id
        from public.membership ms
       where ms.team_id = p_team_id
         and ms.left_at is null
      union
      select m.id
        from public.member m
       where m.org_id = v_source.id
         and not exists (select 1 from public.membership a
                          where a.member_id = m.id and a.left_at is null)
         and (select l.team_id
                from public.membership l
               where l.member_id = m.id
               order by l.left_at desc, l.joined_at desc, l.id desc
               limit 1) = p_team_id
    ) x;

  -- 5. MT001. A mover who also holds an active membership on another team.
  select string_agg(distinct m.display_name, ', ' order by m.display_name)
    into v_list
    from public.member m
   where m.id = any (v_movers)
     and exists (select 1 from public.membership ms
                  where ms.member_id = m.id
                    and ms.left_at is null
                    and ms.team_id <> p_team_id);
  if v_list is not null then
    raise exception 'a member of this team is on another team'
      using errcode = 'MT001', detail = v_list;
  end if;

  -- 6. MT002. An event whose team and whose creator would land in different orgs.
  select string_agg(distinct e.name, ', ' order by e.name)
    into v_list
    from public.event e
   where e.org_id = v_source.id
     and coalesce(e.team_id = p_team_id, false) is distinct from (e.creator_id = any (v_movers));
  if v_list is not null then
    raise exception 'an event would be split from its creator'
      using errcode = 'MT002', detail = v_list;
  end if;

  -- 7. MT003. An entry whose owner and whose decider would land in different orgs.
  select string_agg(distinct m.display_name, ', ' order by m.display_name)
    into v_list
    from public.entry en
    join public.member m on m.id = en.member_id
   where en.org_id = v_source.id
     and ((en.approved_by is not null
           and (en.member_id = any (v_movers)) is distinct from (en.approved_by = any (v_movers)))
       or (en.rejected_by is not null
           and (en.member_id = any (v_movers)) is distinct from (en.rejected_by = any (v_movers))));
  if v_list is not null then
    raise exception 'an entry would be split from who decided it'
      using errcode = 'MT003', detail = v_list;
  end if;

  -- 8. The home team of a stayer with an entry tied to the moved team: their active primary team; or,
  --    holding no active membership at all, the team of the row they left last.
  for v_stay in
    select s.member_id, m.display_name,
           coalesce(
             (select ms.team_id from public.membership ms
               where ms.member_id = s.member_id and ms.left_at is null and ms.is_primary),
             case when not exists (select 1 from public.membership a
                                    where a.member_id = s.member_id and a.left_at is null)
                  then (select l.team_id from public.membership l
                         where l.member_id = s.member_id
                         order by l.left_at desc, l.joined_at desc, l.id desc
                         limit 1)
             end
           ) as home_team_id
      from (select distinct en.member_id
              from public.entry en
             where en.org_id = v_source.id
               and en.primary_team_id = p_team_id
               and en.member_id <> all (v_movers)) s
      join public.member m on m.id = s.member_id
     order by m.display_name, s.member_id
  loop
    if v_stay.home_team_id is null then
      v_missing := case when v_missing is null then v_stay.display_name
                        else v_missing || ', ' || v_stay.display_name end;
    else
      v_stay_ids   := v_stay_ids   || v_stay.member_id;
      v_stay_homes := v_stay_homes || v_stay.home_team_id;
    end if;
  end loop;
  if v_missing is not null then
    raise exception 'a member who stays has no team to keep an entry on'
      using errcode = 'MT004', detail = v_missing;
  end if;

  -- 9. From here the keys are checked at the end of the function, not of each statement.
  set constraints
    public.membership_team_org_fk, public.membership_member_org_fk,
    public.entry_member_org_fk, public.entry_primary_team_org_fk,
    public.entry_approved_by_org_fk, public.entry_rejected_by_org_fk,
    public.busy_day_member_org_fk, public.issue_report_member_org_fk,
    public.event_creator_org_fk, public.event_team_org_fk,
    public.event_invitee_event_org_fk, public.event_invitee_member_org_fk,
    public.event_attendance_event_org_fk, public.event_attendance_member_org_fk,
    public.event_guest_link_event_org_fk, public.event_guest_event_org_fk,
    public.notification_recipient_org_fk, public.notification_actor_org_fk,
    public.notification_event_org_fk
    deferred;

  -- 10. Decision 5. The cut, in the source org, before anything moves. "Side" of a member is
  --     `= any (v_movers)`; of an event, `team_id = p_team_id`.
  delete from public.notification n
   where n.org_id = v_source.id
     and ((n.actor_id is not null
           and (n.recipient_id = any (v_movers)) is distinct from (n.actor_id = any (v_movers)))
       or (n.event_id is not null
           and exists (select 1 from public.event e
                        where e.id = n.event_id
                          and coalesce(e.team_id = p_team_id, false)
                              is distinct from (n.recipient_id = any (v_movers)))));
  get diagnostics v_n = row_count;
  v_deleted := v_deleted + v_n;

  delete from public.event_invitee i
   where i.org_id = v_source.id
     and exists (select 1 from public.event e
                  where e.id = i.event_id
                    and coalesce(e.team_id = p_team_id, false)
                        is distinct from (i.member_id = any (v_movers)));
  get diagnostics v_n = row_count;
  v_deleted := v_deleted + v_n;

  delete from public.event_attendance a
   where a.org_id = v_source.id
     and exists (select 1 from public.event e
                  where e.id = a.event_id
                    and coalesce(e.team_id = p_team_id, false)
                        is distinct from (a.member_id = any (v_movers)));
  get diagnostics v_n = row_count;
  v_deleted := v_deleted + v_n;

  delete from public.membership ms
   where ms.org_id = v_source.id
     and ms.left_at is not null
     and (ms.member_id = any (v_movers)) is distinct from (ms.team_id = p_team_id);
  get diagnostics v_n = row_count;
  v_deleted := v_deleted + v_n;

  -- 11. Re-point `entry.primary_team_id`: a mover's entry to the moved team, a stayer's to the home
  --     team of step 8.
  update public.entry en
     set primary_team_id = p_team_id
   where en.org_id = v_source.id
     and en.member_id = any (v_movers)
     and en.primary_team_id <> p_team_id;

  update public.entry en
     set primary_team_id = h.team_id
    from unnest(v_stay_ids, v_stay_homes) as h(member_id, team_id)
   where en.org_id = v_source.id
     and en.member_id = h.member_id
     and en.primary_team_id = p_team_id;

  -- 12. The move. `org_id` and no other column.
  update public.team t
     set org_id = p_target_org_id
   where t.id = p_team_id;

  update public.member m
     set org_id = p_target_org_id
   where m.id = any (v_movers);

  update public.membership ms
     set org_id = p_target_org_id
   where ms.member_id = any (v_movers);

  update public.entry en
     set org_id = p_target_org_id
   where en.member_id = any (v_movers);

  update public.busy_day b
     set org_id = p_target_org_id
   where b.member_id = any (v_movers);

  update public.issue_report r
     set org_id = p_target_org_id
   where r.member_id = any (v_movers);

  update public.notification n
     set org_id = p_target_org_id
   where n.recipient_id = any (v_movers);

  update public.event e
     set org_id = p_target_org_id
   where e.team_id = p_team_id;

  update public.event_invitee i
     set org_id = p_target_org_id
   where i.event_id in (select e.id from public.event e where e.team_id = p_team_id);

  update public.event_attendance a
     set org_id = p_target_org_id
   where a.event_id in (select e.id from public.event e where e.team_id = p_team_id);

  update public.event_guest_link l
     set org_id = p_target_org_id
   where l.event_id in (select e.id from public.event e where e.team_id = p_team_id);

  update public.event_guest g
     set org_id = p_target_org_id
   where g.event_id in (select e.id from public.event e where e.team_id = p_team_id);

  -- 13. A row the design missed fails here, inside the call, and not at commit.
  set constraints
    public.membership_team_org_fk, public.membership_member_org_fk,
    public.entry_member_org_fk, public.entry_primary_team_org_fk,
    public.entry_approved_by_org_fk, public.entry_rejected_by_org_fk,
    public.busy_day_member_org_fk, public.issue_report_member_org_fk,
    public.event_creator_org_fk, public.event_team_org_fk,
    public.event_invitee_event_org_fk, public.event_invitee_member_org_fk,
    public.event_attendance_event_org_fk, public.event_attendance_member_org_fk,
    public.event_guest_link_event_org_fk, public.event_guest_event_org_fk,
    public.notification_recipient_org_fk, public.notification_actor_org_fk,
    public.notification_event_org_fk
    immediate;

  -- 14.
  return query select coalesce(cardinality(v_movers), 0), v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. The two guards (decision 7). Each is its latest body, `20261009150000_evt07_guest_registration.sql`
--    (`event_guest_guard` lines 92-181, `event_attendance_guard` lines 192-255), copied character for
--    character, with one clause inserted as the first statement after `begin`. The triggers that
--    point at them are not touched. `authenticated` holds `update (status)` only on both tables, so
--    no caller gains a write.
-- ---------------------------------------------------------------------------------------------

create or replace function public.event_guest_guard() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_event public.event;
  v_taken integer;
begin
  -- MIR-15-c, ADR-093 decision 7. A team moving to another org rewrites org_id and nothing else.
  if tg_op = 'UPDATE'
     and new.org_id is distinct from old.org_id
     and (to_jsonb(new) - 'org_id') = (to_jsonb(old) - 'org_id') then
    return new;
  end if;

  -- AC-20. The `on delete set null` from deleting the event: nothing else may move, and no lock is
  -- taken — the event row is already gone.
  if tg_op = 'UPDATE' and old.event_id is not null and new.event_id is null then
    if new.id                is distinct from old.id
       or new.event_name        is distinct from old.event_name
       or new.name              is distinct from old.name
       or new.email             is distinct from old.email
       or new.manage_token_hash is distinct from old.manage_token_hash
       or new.status            is distinct from old.status
       or new.created_at        is distinct from old.created_at
       or new.updated_at        is distinct from old.updated_at then
      raise exception 'invalid_attendance_change' using errcode = '22023';
    end if;
    return new;
  end if;

  -- The lock. Every seat-raising write on this event, member or guest, waits here.
  select * into v_event from public.event where id = new.event_id for update;
  if not found then
    raise exception 'guest_link_not_found' using errcode = 'EV004';
  end if;

  if tg_op = 'INSERT' then
    -- AC-5, AC-9. The unique index is the control; raised here so EV001/EV002 never mask it.
    if exists (
      select 1 from public.event_guest g
       where g.event_id = new.event_id
         and lower(g.email) = lower(new.email)
    ) then
      raise exception 'guest_already_registered' using errcode = '23505';
    end if;
    -- AC-7.
    if not public.event_registration_open(new.event_id) then
      raise exception 'event_registration_closed' using errcode = 'EV002';
    end if;
    -- AC-2, AC-18. Nobody chooses the state on creating it.
    new.status := case when v_event.requires_approval
                       then 'pending'::public.guest_status
                       else 'attending'::public.guest_status end;
    new.event_name := v_event.name;
    new.created_at := now();
    new.updated_at := now();
  else
    -- AC-18. Only `status` (and the guard's own `updated_at`) moves, and only these five ways.
    if not ((old.status = 'pending'   and new.status = 'attending')
         or (old.status = 'pending'   and new.status = 'rejected')
         or (old.status = 'attending' and new.status = 'removed')
         or (old.status = 'pending'   and new.status = 'cancelled')
         or (old.status = 'attending' and new.status = 'cancelled'))
       or new.id                is distinct from old.id
       or new.event_id          is distinct from old.event_id
       or new.event_name        is distinct from old.event_name
       or new.name              is distinct from old.name
       or new.email             is distinct from old.email
       or new.manage_token_hash is distinct from old.manage_token_hash
       or new.created_at        is distinct from old.created_at then
      raise exception 'invalid_attendance_change' using errcode = '22023';
    end if;
    -- AC-12. A cancel closes with registration; a decision does not (EVT-02 AC-18).
    if new.status = 'cancelled'::public.guest_status
       and not public.event_registration_open(new.event_id) then
      raise exception 'event_registration_closed' using errcode = 'EV002';
    end if;
    new.updated_at := now();
  end if;

  -- AC-6, AC-10. Members AND guests, counted under the lock taken above.
  if new.status = 'attending'::public.guest_status and v_event.capacity is not null then
    select (select count(*) from public.event_attendance a
             where a.event_id = new.event_id
               and a.status = 'attending'::public.attendance_status)
         + (select count(*) from public.event_guest g
             where g.event_id = new.event_id
               and g.status = 'attending'::public.guest_status
               and g.id <> new.id)
      into v_taken;
    if v_taken >= v_event.capacity then
      raise exception 'event_full' using errcode = 'EV001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.event_attendance_guard() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_event public.event;
  v_taken integer;
begin
  -- MIR-15-c, ADR-093 decision 7. A team moving to another org rewrites org_id and nothing else.
  if tg_op = 'UPDATE'
     and new.org_id is distinct from old.org_id
     and (to_jsonb(new) - 'org_id') = (to_jsonb(old) - 'org_id') then
    return new;
  end if;

  select * into v_event from public.event where id = new.event_id for update;

  if tg_op = 'INSERT' then
    -- The event is missing, or the caller is not in its audience: the same 42501 the insert policy
    -- would give, raised first so a refusal never confirms that an event exists or is closed.
    -- `event_attendance_insert_own` remains the control.
    if not found or not public.is_event_audience(new.event_id, new.member_id) then
      raise exception 'attendance_not_permitted' using errcode = '42501';
    end if;
    -- AC-13, AC-19. The primary key is the control; raised here so it is not masked by EV001/EV002.
    if exists (
      select 1 from public.event_attendance a
       where a.event_id = new.event_id and a.member_id = new.member_id
    ) then
      raise exception 'already_on_event' using errcode = '23505';
    end if;
    -- AC-10.
    if not public.event_registration_open(new.event_id) then
      raise exception 'event_registration_closed' using errcode = 'EV002';
    end if;
    -- Q22. The wire never chooses a state; the column is ungranted anyway.
    new.status := case when v_event.requires_approval
                       then 'pending'::public.attendance_status
                       else 'attending'::public.attendance_status end;
    new.created_at := now();
    new.updated_at := now();
  else
    -- AC-16, AC-17, AC-20. Only these three transitions, and only `status` moves. No registration
    -- clause: deciding does not close with registration (AC-18).
    if not ((old.status = 'pending'   and new.status = 'attending')
         or (old.status = 'pending'   and new.status = 'rejected')
         or (old.status = 'attending' and new.status = 'removed'))
       or new.event_id   is distinct from old.event_id
       or new.member_id  is distinct from old.member_id
       or new.created_at is distinct from old.created_at then
      raise exception 'invalid_attendance_change' using errcode = '22023';
    end if;
    new.updated_at := now();
  end if;

  -- AC-8, AC-9. Counted under the lock taken above. EVT-07: attending guests count too.
  if new.status = 'attending' and v_event.capacity is not null then
    select count(*) into v_taken
      from public.event_attendance a
     where a.event_id = new.event_id
       and a.status = 'attending'::public.attendance_status
       and a.member_id <> new.member_id;
    v_taken := v_taken
      + (select count(*) from public.event_guest g
          where g.event_id = new.event_id and g.status = 'attending'::public.guest_status);
    if v_taken >= v_event.capacity then
      raise exception 'event_full' using errcode = 'EV001';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Privileges. The two guards keep the grants they already carry (`create or replace` does not
--    reset them).
-- ---------------------------------------------------------------------------------------------

revoke all on function public.list_shared_teams() from public, anon;
revoke all on function public.move_team_to_org(uuid, uuid) from public, anon;
grant execute on function public.list_shared_teams() to authenticated;
grant execute on function public.move_team_to_org(uuid, uuid) to authenticated;

commit;
