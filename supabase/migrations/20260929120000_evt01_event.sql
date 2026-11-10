-- EVT-01. A member announces an event to their own team, to named people, or to every team, and
-- those it is for can read it.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like CAL-11's
-- (20260922150000_cal11_cross_team_reads.sql). `tests/permission-model.test.ts` against a real
-- PostgreSQL is still owed project-wide (.ai/standards/rbac-and-security.md § Known weaknesses 1).
-- `tests/events.test.ts` asserts every denial below against the MOCK seam, which reproduces these
-- policies; it cannot prove this file.
--
-- Decided by ADR-045 decision points 3–6 and ADR-046, both ACCEPTED by the operator. The names and
-- shapes are 01-plan.md § 4.3's, transcribed; the permission table they hold is § 3's.
--
-- **THE FIRST READ A NON-ADMIN HAS EVER HAD ACROSS A TEAM BOUNDARY.** Two things follow and both are
-- deliberate:
--
--   1. `member_select_team` and EVERY OTHER POLICY ON `public.member` IS UNTOUCHED. `listMembers()`
--      returns what those policies return and is INV-04's denominator; widening one would silently
--      join every team's roster to every team's absence arithmetic (ADR-045 point 4 and
--      § Rationale). The picker reads `public.list_member_directory()` instead — five columns, no
--      role, no status, no `removed_at`.
--   2. EVENTS ARE READ THROUGH A SELECT POLICY, NOT A DEFINER FUNCTION (01-plan.md § 8, rejected
--      alternative 1). A policy fails closed on a case it does not handle; a definer function that
--      loses a clause leaks across every team at once.
--
-- **EVERY PREDICATE STARTS FROM `member_team_id(uid) is not null` OR FROM `is_admin(uid)`**, which
-- carries the same clause (20260910100000_solo_member_approval.sql). That is what shuts out a
-- pending sign-up, a rejected one and a removed member (AC-6, AC-9) — including from an event they
-- created or were named on before they were removed.
--
-- **"SOMEONE ELSE'S EVENT" IS KEYED ON `is_admin`, NEVER ON `may_decide`.** `may_decide` answers
-- true for a manager and is for entry decisions alone (ADR-035). A manager gains nothing here (Q9,
-- Q24).
--
-- **ONE CASCADE, CHOSEN** — `event_invitee.event_id … on delete cascade`. data-model.md objects to a
-- cascade nobody chose; this one is chosen in 01-plan.md § 6. `creator_id`, `team_id` and
-- `member_id` stay restrict, as every other reference to `member` and `team` does.
--
-- **IDEMPOTENT** in the shape ADR-024 requires: a guarded `do` block for the enum, `create table if
-- not exists`, `create or replace` for functions, `drop … if exists` then `create` for the trigger
-- and the policies. One transaction.
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The enum and the two tables.
-- ---------------------------------------------------------------------------------------------

do $$ begin
  create type public.event_scope as enum ('team', 'named', 'public');
exception when duplicate_object then null;
end $$;

create table if not exists public.event (
  id          uuid primary key default gen_random_uuid(),
  -- The caller, always. The column is WITHHELD from the insert grant below, so a request naming a
  -- creator is refused with 42501 before any policy runs (AC-4); the default is the only way in.
  creator_id  uuid not null default auth.uid() references public.member(id),
  -- The creator's team, set by `event_stamp()` and never by the wire — also withheld (AC-4, Q6).
  team_id     uuid not null references public.team(id),
  name        text not null,
  description text null,
  location    text null,
  start_date  date not null,
  end_date    date not null,
  scope       public.event_scope not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- AC-2. The control; the form and the seam refuse first as an affordance.
  constraint event_name_present  check (btrim(name) <> ''),
  -- AC-3. A derivation, recorded as one in 01-plan.md § 2: an end before the start describes no
  -- dates at all.
  constraint event_dates_ordered check (end_date >= start_date)
);

create table if not exists public.event_invitee (
  event_id   uuid not null references public.event(id) on delete cascade,
  member_id  uuid not null references public.member(id),
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

alter table public.event enable row level security;
alter table public.event_invitee enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. The trigger. `team_id` on insert, `updated_at` on update.
-- ---------------------------------------------------------------------------------------------
-- `security definer` so it may call `member_team_id` for the creator whatever the caller's grants.
-- It never reads the wire's `team_id` — that column is ungranted anyway. On an UPDATE it does not
-- touch `team_id` at all, so an admin's edit leaves an own-team event on the CREATOR'S team, not
-- the admin's (AC-16).
--
-- A pending or removed creator gets `null` here, and the insert is refused by `event_insert_own`'s
-- `with check` — PostgreSQL evaluates the row-level WITH CHECK before the NOT NULL constraint, so the
-- refusal is 42501 rather than 23502.

create or replace function public.event_stamp() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.team_id := public.member_team_id(new.creator_id);
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists event_stamp on public.event;
create trigger event_stamp
  before insert or update on public.event
  for each row execute function public.event_stamp();

-- ---------------------------------------------------------------------------------------------
-- 3. The two helpers the policies consult.
-- ---------------------------------------------------------------------------------------------
-- Each exists so one table's policy can consult the other without recursing through that table's
-- own policy: `event`'s select policy reads the named list, and `event_invitee`'s policies read the
-- event. `stable`, `set search_path = ''`, schema-qualified throughout.

create or replace function public.is_event_invitee(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_invitee i
     where i.event_id = p_event_id
       and i.member_id = p_uid
  );
$$;

create or replace function public.may_manage_event(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event e
     where e.id = p_event_id
       and ((e.creator_id = p_uid and public.member_team_id(p_uid) is not null)
            or public.is_admin(p_uid))
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. The directory — the picker's only source (AC-10, ADR-045 point 4).
-- ---------------------------------------------------------------------------------------------
-- **FIVE COLUMNS, AND THAT IS THE WHOLE CROSS-TEAM EXPOSURE.** No role, no status, no `removed_at`,
-- no email. It is not a `member` row and must never be widened into one.
--
-- The CALLER must have a team (a pending sign-up receives an empty list); the ROW must be
-- `approved` with `removed_at` null. The caller is included — the picker omits them, as an
-- affordance. No `order by`: ordering is the seam's (CAL-11's header).

create or replace function public.list_member_directory()
  returns table (id uuid, display_name text, avatar text, team_id uuid, team_name text)
  language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.avatar, m.team_id, t.name
    from public.member m
    join public.team t on t.id = m.team_id
   where public.member_team_id((select auth.uid())) is not null
     and m.status = 'approved'::public.member_status
     and m.removed_at is null;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. The write — `save_event`, SECURITY INVOKER.
-- ---------------------------------------------------------------------------------------------
-- **IT ADDS ATOMICITY AND NOTHING ELSE.** Every statement inside runs under the caller's policies
-- and grants, so it cannot be used to reach a row or a column the caller could not reach with
-- separate requests (01-plan.md § 8, rejected alternative 3). A failure anywhere rolls back the row
-- and its named list together.
--
-- Null `p_event_id` inserts; otherwise it updates and raises 42501 when no row was updated — a
-- filtered UPDATE matches nothing, and success must not be reported for it (AC-17).
--
-- The invitee test runs AFTER the row write, so a caller who may not write the event is told 42501
-- and never learns anything about the ids they sent. It raises 22023 `invalid_event_invitee` — a
-- clearer code than the policy's 42501; `event_invitee_insert_manage` stays the control (AC-11).

create or replace function public.save_event(
  p_event_id    uuid,
  p_name        text,
  p_description text,
  p_location    text,
  p_start_date  date,
  p_end_date    date,
  p_scope       public.event_scope,
  p_invitee_ids uuid[]
) returns public.event
  language plpgsql security invoker set search_path = '' as $$
declare
  v_event   public.event;
  v_invitee uuid[] := coalesce(p_invitee_ids, '{}'::uuid[]);
begin
  if p_event_id is null then
    insert into public.event (name, description, location, start_date, end_date, scope)
    values (p_name, p_description, p_location, p_start_date, p_end_date, p_scope)
    returning * into v_event;
  else
    update public.event
       set name        = p_name,
           description = p_description,
           location    = p_location,
           start_date  = p_start_date,
           end_date    = p_end_date,
           scope       = p_scope
     where id = p_event_id
    returning * into v_event;

    if not found then
      raise exception 'event_not_permitted' using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1 from unnest(v_invitee) as i(member_id)
     where public.member_team_id(i.member_id) is null
  ) then
    raise exception 'invalid_event_invitee' using errcode = '22023';
  end if;

  -- Everybody not in the new list goes; all of them when the scope is not `named`.
  delete from public.event_invitee x
   where x.event_id = v_event.id
     and (p_scope <> 'named'::public.event_scope or x.member_id <> all (v_invitee));

  if p_scope = 'named'::public.event_scope then
    insert into public.event_invitee (event_id, member_id)
    select v_event.id, n.member_id
      from (select distinct unnest(v_invitee) as member_id) n
     where not exists (
       select 1 from public.event_invitee x
        where x.event_id = v_event.id
          and x.member_id = n.member_id
     );
  end if;

  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Policies. `to authenticated`, `(select auth.uid())` wrapped, drop-then-create.
-- ---------------------------------------------------------------------------------------------

-- AC-5 to AC-9. Admin reads everything (Q24); the creator reads their own; `public` is every
-- approved member of every team (Q4); `team` is the creator's team only (Q6); `named` is the named
-- people and nobody else — being on the creator's team grants nothing (Q25).
drop policy if exists event_select_visible on public.event;
create policy event_select_visible on public.event
  for select to authenticated
  using (
    public.member_team_id((select auth.uid())) is not null
    and (
      public.is_admin((select auth.uid()))
      or creator_id = (select auth.uid())
      or scope = 'public'::public.event_scope
      or (scope = 'team'::public.event_scope
          and team_id = public.member_team_id((select auth.uid())))
      or (scope = 'named'::public.event_scope
          and public.is_event_invitee(id, (select auth.uid())))
    )
  );

-- AC-1, AC-4, AC-9. Any approved member of any role; the row is theirs.
drop policy if exists event_insert_own on public.event;
create policy event_insert_own on public.event
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

-- AC-14, AC-16, AC-17. The creator (still approved and not removed) or an admin. Never a manager.
drop policy if exists event_update_manage on public.event;
create policy event_update_manage on public.event
  for update to authenticated
  using (
    (creator_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null)
    or public.is_admin((select auth.uid()))
  )
  with check (
    (creator_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null)
    or public.is_admin((select auth.uid()))
  );

-- AC-15, AC-16, AC-17.
drop policy if exists event_delete_manage on public.event;
create policy event_delete_manage on public.event
  for delete to authenticated
  using (
    (creator_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null)
    or public.is_admin((select auth.uid()))
  );

-- AC-13. The named list is read by whoever may edit the event — the creator and admins. A person
-- who is named does NOT see who else is: that is this plan's default denial, not an operator answer.
drop policy if exists event_invitee_select_manage on public.event_invitee;
create policy event_invitee_select_manage on public.event_invitee
  for select to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())));

-- AC-11, AC-17. Only someone who may manage the event adds to its list, and only an approved,
-- not-removed member may be named.
drop policy if exists event_invitee_insert_manage on public.event_invitee;
create policy event_invitee_insert_manage on public.event_invitee
  for insert to authenticated
  with check (
    public.may_manage_event(event_id, (select auth.uid()))
    and public.member_team_id(member_id) is not null
  );

drop policy if exists event_invitee_delete_manage on public.event_invitee;
create policy event_invitee_delete_manage on public.event_invitee
  for delete to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- 7. Grants. `to authenticated`, never `public`.
-- ---------------------------------------------------------------------------------------------
-- EXPLICIT, NOT INHERITED — the shape CAL-01 and the issue report use. Supabase's default privileges
-- hand every new table in `public` to `anon` and `authenticated` whole, and a column grant means
-- nothing beside a table-wide one. So everything is revoked first, and then exactly § 4.3's list is
-- granted.
--
-- `creator_id`, `team_id`, `created_at` and `updated_at` are in NEITHER column list: a request
-- naming any of them is refused 42501 before a policy runs (AC-4, TEA-04's shape). No update grant
-- on `event_invitee`: a named person is added or removed, never edited.

revoke all on public.event from anon, authenticated;
revoke all on public.event_invitee from anon, authenticated;

grant select, delete on public.event to authenticated;
grant insert (name, description, location, start_date, end_date, scope) on public.event to authenticated;
grant update (name, description, location, start_date, end_date, scope) on public.event to authenticated;
grant select, delete on public.event_invitee to authenticated;
grant insert (event_id, member_id) on public.event_invitee to authenticated;

-- Supabase also grants EXECUTE on new functions to `anon` by default, which `from public` does not
-- remove — so both are named.
revoke all on function public.event_stamp() from public, anon;
revoke all on function public.is_event_invitee(uuid, uuid) from public, anon;
revoke all on function public.may_manage_event(uuid, uuid) from public, anon;
revoke all on function public.list_member_directory() from public, anon;
revoke all on function public.save_event(uuid, text, text, text, date, date, public.event_scope, uuid[]) from public, anon;

grant execute on function public.event_stamp() to authenticated;
grant execute on function public.is_event_invitee(uuid, uuid) to authenticated;
grant execute on function public.may_manage_event(uuid, uuid) to authenticated;
grant execute on function public.list_member_directory() to authenticated;
grant execute on function public.save_event(uuid, text, text, text, date, date, public.event_scope, uuid[]) to authenticated;

commit;
