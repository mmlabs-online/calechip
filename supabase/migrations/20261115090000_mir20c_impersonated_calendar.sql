-- MIR-20-c: a system admin reads an org's calendar only under a live, logged impersonation.
--
-- Implements ADR-100 (01-plan.md § 4.1):
--
--   * decision 2 — a session unlocks definer reads only, each checking `public.impersonated_org_id()`
--     and writing one action row per call. This is the second such read, after `impersonated_roster()`.
--   * decision 6 — one action value per read function: `read_calendar` joins the known set. Every row
--     already stored is in the new set.
--   * decision 8, third bullet — the calendar read is MIR-20-c's.
--
-- The function returns the PTO and WFH entries of the impersonated org (or, in Org public, of the
-- session's one team) that overlap `[p_start, p_end]`, pending and approved only. It computes no
-- absence count (INV-04): no sum, no portion weight, no per-day total.
--
-- **IDEMPOTENT** (ADR-024): `drop constraint if exists` then `add constraint`, `create or replace`,
-- and the grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The log's action vocabulary gains one value.
-- ---------------------------------------------------------------------------------------------

alter table public.impersonation_action drop constraint if exists impersonation_action_known;
alter table public.impersonation_action add constraint impersonation_action_known
  check (action in ('start', 'end', 'read_roster', 'read_calendar'));

-- ---------------------------------------------------------------------------------------------
-- 2. The calendar read. Every reference is qualified: `returns table` names are PL/pgSQL variables.
--    42501 — not a system admin, or no live session. 22023 — a null bound, p_end < p_start, or a
--    range wider than 31 days. All three checks run BEFORE any write; a refused call logs nothing.
-- ---------------------------------------------------------------------------------------------

create or replace function public.impersonated_calendar(p_start date, p_end date)
  returns table (
    entry_id     uuid,
    member_id    uuid,
    display_name text,
    type         text,
    portion      text,
    start_date   date,
    end_date     date,
    tentative    boolean,
    status       text
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

  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 30 then
    raise exception 'a calendar read is one range of at most 31 days' using errcode = '22023';
  end if;

  select i.id, i.team_id into v_id, v_team_id
    from public.impersonation i
   where i.actor_id = (select auth.uid())
     and i.ended_at is null
     and i.expires_at > now();
  if v_id is null then
    raise exception 'no live impersonation session' using errcode = '42501';
  end if;

  insert into public.impersonation_action (impersonation_id, action) values (v_id, 'read_calendar');

  return query
    select e.id, e.member_id, m.display_name, e.type::text, e.portion::text,
           e.start_date, e.end_date, e.tentative, e.status::text
      from public.entry e
      join public.member m on m.id = e.member_id
     where e.org_id = v_org
       and m.removed_at is null
       and e.status <> 'rejected'::public.entry_status
       and e.start_date <= p_end
       and e.end_date >= p_start
       and (v_team_id is null
            or exists (select 1 from public.membership ms
                        where ms.member_id = m.id and ms.team_id = v_team_id
                          and ms.org_id = v_org and ms.left_at is null))
     order by e.start_date, m.display_name, e.id
     limit 1000;
end;
$$;
revoke all on function public.impersonated_calendar(date, date) from public, anon;
grant execute on function public.impersonated_calendar(date, date) to authenticated;

commit;
