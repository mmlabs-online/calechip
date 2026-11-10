-- MIR-12: Backfill every org-scoped row into Org public and seed `membership`.
--
-- Implements ADR-070 § 2 (Org public row) and § 3 (membership backfill rule), on top of MIR-11's
-- nullable columns:
--
--   1. Create the Org public row (`org_code = 'shared'`, `is_shared_tenant = true`), or reuse it.
--   2. Backfill `org_id` on every row of the 12 org-scoped tables — parents first, so every composite
--      foreign key `(x_id, org_id) -> parent (id, org_id)` already has its target when a child row
--      gains its `org_id`.
--   3. Backfill `entry.primary_team_id` from the author's `member.team_id`.
--   4. Insert one `membership` row per `member` with a non-null `team_id`.
--
-- NOT HERE, and why (01-plan.md Changelog 2026-10-31): `SET NOT NULL` on the 12 `org_id` columns
-- and `entry.primary_team_id`, and the holiday swap from `unique (date)` to `unique (org_id, date)`,
-- move to MIR-13, in the same migration as the writers that must supply `org_id`. Until then the
-- columns stay nullable, so every unrewritten writer keeps working. MIR-13 re-runs this file's
-- backfill immediately before `SET NOT NULL` to catch rows written in between.
-- `member.team_id` is dropped by MIR-21.
--
-- Idempotent: every step either targets rows still `null` or guards with `not exists`.
-- Re-applying it changes nothing.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

do $$
declare
  v_org_id   uuid;
  v_orphans  integer;
begin
  -- -------------------------------------------------------------------------------------------
  -- 1. Org public (ADR-070 § 2). Identified by `is_shared_tenant = true`, which
  --    `org_one_shared_tenant_idx` makes unique. `org_code` is 'shared' because 'public' is on the
  --    reserved list (`org_code_not_reserved`). `plan` keeps its column default: MIR-11 made it
  --    `not null default 'free'`, so ADR-070's "null" is not expressible.
  -- -------------------------------------------------------------------------------------------
  select o.id into v_org_id from public.org o where o.is_shared_tenant;

  if v_org_id is null then
    if exists (select 1 from public.org o where o.org_code = 'shared') then
      raise exception 'mir12 refused: public.org holds org_code = ''shared'' that is not the shared tenant'
        using hint = 'Org public must be the only row with org_code = ''shared''. Inspect public.org before applying.';
    end if;

    insert into public.org (org_code, name, is_shared_tenant, timezone)
    values ('shared', 'Org public', true, 'Asia/Ho_Chi_Minh')
    returning id into v_org_id;
  end if;

  -- -------------------------------------------------------------------------------------------
  -- Report, do not refuse (AC-6). An entry's primary team has one source, its author's
  -- `member.team_id`; an entry whose author has none keeps `primary_team_id` null. MIR-13 must
  -- resolve these before its `SET NOT NULL`, so the count is printed for whoever applies this.
  -- -------------------------------------------------------------------------------------------
  select count(*) into v_orphans
    from public.entry e
    join public.member m on m.id = e.member_id
   where e.primary_team_id is null
     and m.team_id is null;

  if v_orphans > 0 then
    raise notice 'mir12: % entry row(s) belong to a member with no team_id; primary_team_id stays null',
      v_orphans
      using hint = 'select e.id, e.member_id from public.entry e join public.member m on m.id = e.member_id where m.team_id is null;';
  end if;

  -- -------------------------------------------------------------------------------------------
  -- 2. `org_id` backfill. Parents (team, member, event) before the children whose composite
  --    foreign keys point at them. Every row lands in Org public: before this migration the
  --    deployment holds exactly one tenant.
  -- -------------------------------------------------------------------------------------------
  update public.team             set org_id = v_org_id where org_id is null;
  update public.member           set org_id = v_org_id where org_id is null;
  update public.event            set org_id = v_org_id where org_id is null;

  -- 3. `entry.primary_team_id` is the author's team at the time of this migration (INV-07).
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

  -- -------------------------------------------------------------------------------------------
  -- 4. `membership` backfill (ADR-070 § 3 backfill rule; INV-04). `joined_at = created_at` keeps
  --    every entry dated before today inside the member's window. A removed member gets
  --    `left_at = removed_at` and therefore `is_primary = false`: `membership_inactive_not_primary`
  --    forbids an inactive primary row. `greatest` keeps `membership_left_after_joined` true if a
  --    row's `removed_at` was ever written before its `created_at`.
  -- -------------------------------------------------------------------------------------------
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

commit;
