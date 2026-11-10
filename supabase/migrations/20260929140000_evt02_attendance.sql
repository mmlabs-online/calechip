-- EVT-02. A member joins an event they can read, within its capacity, approval mode and deadline,
-- and everyone who can read it sees who is coming.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's (20260929120000_evt01_event.sql).
-- `tests/permission-model.test.ts` against a real PostgreSQL is still owed project-wide
-- (.ai/standards/rbac-and-security.md § Known weaknesses 1). `tests/event-attendance.test.ts`
-- asserts every refusal below against the MOCK seam, which reproduces these policies and triggers;
-- it cannot prove this file.
--
-- **THE CONCURRENCY TEST IS OWED.** ADR-045 revert condition 2 is "attendees exceed the cap". The
-- mechanism below (§ 4) serialises every seat-raising write and every capacity change on one event
-- behind that event row's lock. The mock can prove the DECISION is right under `Promise.all`; only
-- two real sessions racing against PostgreSQL can prove the LOCK, and that test does not exist yet.
--
-- Decided by ADR-045 (ACCEPTED by the operator), § Consequences on capacity. The names and shapes
-- are 01-plan.md § 4.4's, transcribed; the permission table they hold is § 3's.
--
-- **THE CAP IS HELD BY A TRIGGER ON THE TABLE, NOT BY A FUNCTION THAT COUNTS AND WRITES**
-- (01-plan.md § 8, rejected alternative 1). A trigger runs on every write whatever its source; a
-- counting RPC protects only the callers that go through it.
--
-- **`public.member` IS UNTOUCHED — NO POLICY ON IT IS CREATED, DROPPED OR REPLACED HERE.**
-- `listMembers()` returns what those policies return and is INV-04's denominator (ADR-045 point 4).
-- An attendance carries ids and a state; names resolve through EVT-01's `list_member_directory()`.
--
-- **EVERY PREDICATE STARTS FROM `member_team_id(uid) is not null`**, directly or through a helper
-- that does (`is_event_audience`, `may_manage_event`), which shuts out a pending sign-up, a rejected
-- one and a removed member (AC-11, AC-26).
--
-- **THREE CUSTOM SQLSTATES.** The project so far raises only `42501` and `22023`. `EV001` (full),
-- `EV002` (registration closed) and `EV003` (capacity below attendees) are custom codes — PostgreSQL
-- accepts any five-character SQLSTATE in `raise … using errcode` — because the seam's mapper matches
-- on SQLSTATE and never on message text, and the three need three distinct sentences (§ 6).
--
-- **ONE MORE CASCADE, CHOSEN** — `event_attendance.event_id … on delete cascade` (AC-25, § 6).
-- `member_id` stays restrict.
--
-- **IDEMPOTENT** in the shape ADR-024 requires: guarded `do` blocks for the enum and the two
-- constraints, `add column if not exists`, `create table if not exists`, `drop function if exists`
-- for the old `save_event` signature, `create or replace` for the rest, `drop … if exists` then
-- `create` for triggers and policies. One transaction.
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The enum, the three columns on `event`, their two constraints, and the attendance table.
-- ---------------------------------------------------------------------------------------------

do $$ begin
  create type public.attendance_status as enum ('pending', 'attending', 'rejected', 'removed');
exception when duplicate_object then null;
end $$;

alter table public.event
  add column if not exists capacity              integer null,
  add column if not exists requires_approval     boolean not null default false,
  add column if not exists registration_deadline date    null;

-- AC-2. A derivation, recorded as one in 01-plan.md § 2: a cap of zero is an event nobody can join.
do $$ begin
  alter table public.event
    add constraint event_capacity_positive check (capacity is null or capacity >= 1);
exception when duplicate_object then null;
end $$;

-- AC-3 (Q19). Also refuses moving the end date before an existing deadline.
do $$ begin
  alter table public.event
    add constraint event_deadline_by_end
    check (registration_deadline is null or registration_deadline <= end_date);
exception when duplicate_object then null;
end $$;

create table if not exists public.event_attendance (
  event_id   uuid not null references public.event(id) on delete cascade,
  -- The caller, always. WITHHELD from the insert grant (§ 7), so the default is the only way in.
  member_id  uuid not null default auth.uid() references public.member(id),
  -- Set by `event_attendance_guard` from `requires_approval`, never by the wire — also withheld.
  status     public.attendance_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- AC-13, AC-19. One attendance per person per event, in any state — so a rejected or removed
  -- person cannot join again.
  primary key (event_id, member_id)
);

alter table public.event_attendance enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. The three helpers the policies and the guard consult.
-- ---------------------------------------------------------------------------------------------
-- `stable`, `security definer`, `set search_path = ''`, schema-qualified throughout.

-- Open through the whole of the last day, compared as a DATE in Asia/Ho_Chi_Minh (AC-10).
-- `src/lib/event-registration.ts` reproduces it for the mock and the screen.
create or replace function public.event_registration_open(p_event_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event e
     where e.id = p_event_id
       and (now() at time zone 'Asia/Ho_Chi_Minh')::date
           <= coalesce(e.registration_deadline, e.end_date)
  );
$$;

-- AC-11. Who may JOIN, which is not who may READ: **NO `is_admin` CLAUSE.** An admin reads every
-- event to manage it, not to attend it.
create or replace function public.is_event_audience(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select public.member_team_id(p_uid) is not null
     and exists (
       select 1 from public.event e
        where e.id = p_event_id
          and (e.creator_id = p_uid
               or e.scope = 'public'::public.event_scope
               or (e.scope = 'team'::public.event_scope
                   and e.team_id = public.member_team_id(p_uid))
               or (e.scope = 'named'::public.event_scope
                   and public.is_event_invitee(e.id, p_uid)))
     );
$$;

-- AC-5. Exists so `event`'s select policy can consult attendance without recursing through
-- `event_attendance`'s own policy, which reads `event`.
create or replace function public.is_event_participant(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_attendance a
     where a.event_id = p_event_id
       and a.member_id = p_uid
       and a.status in ('pending'::public.attendance_status, 'attending'::public.attendance_status)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. `save_event`, recreated with three trailing defaulted parameters.
-- ---------------------------------------------------------------------------------------------
-- Dropped by its OLD eight-argument signature first: `create or replace` with a different argument
-- list creates an overload, and two candidates for an eight-argument call is an ambiguity error.
-- The defaults keep an eight-argument call valid. Still SECURITY INVOKER — it adds atomicity and
-- nothing else (EVT-01's header). The body is EVT-01's with the three columns written in.

drop function if exists public.save_event(uuid, text, text, text, date, date, public.event_scope, uuid[]);

create or replace function public.save_event(
  p_event_id              uuid,
  p_name                  text,
  p_description           text,
  p_location              text,
  p_start_date            date,
  p_end_date              date,
  p_scope                 public.event_scope,
  p_invitee_ids           uuid[],
  p_capacity              integer default null,
  p_requires_approval     boolean default false,
  p_registration_deadline date    default null
) returns public.event
  language plpgsql security invoker set search_path = '' as $$
declare
  v_event   public.event;
  v_invitee uuid[] := coalesce(p_invitee_ids, '{}'::uuid[]);
begin
  if p_event_id is null then
    insert into public.event (name, description, location, start_date, end_date, scope,
                              capacity, requires_approval, registration_deadline)
    values (p_name, p_description, p_location, p_start_date, p_end_date, p_scope,
            p_capacity, coalesce(p_requires_approval, false), p_registration_deadline)
    returning * into v_event;
  else
    update public.event
       set name                  = p_name,
           description           = p_description,
           location              = p_location,
           start_date            = p_start_date,
           end_date              = p_end_date,
           scope                 = p_scope,
           capacity              = p_capacity,
           requires_approval     = coalesce(p_requires_approval, false),
           registration_deadline = p_registration_deadline
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

  -- Everybody not in the new list goes; all of them when the scope is not `named`. An attendance is
  -- NOT touched — a person taken off the list keeps their place (AC-5).
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
-- 4. The two guards. THIS IS WHERE THE CAP HOLDS (AC-9, ADR-045 revert condition 2).
-- ---------------------------------------------------------------------------------------------
-- Every write that can RAISE seats taken — an insert the guard makes `attending`, and an update to
-- `attending` — runs `event_attendance_guard`, whose FIRST statement locks the event row
-- `for update`. Every capacity change is an UPDATE of that same row and takes the same lock. So on
-- one event these writes are serialised, and the count each one reads is taken AFTER it holds the
-- lock, by a fresh statement under READ COMMITTED — it sees every seat committed before it.
--
-- VOLATILE (the default for plpgsql) so each statement inside takes a fresh snapshot. `security
-- definer` so the count sees every row whatever the caller's select policy shows them.

create or replace function public.event_attendance_guard() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_event public.event;
  v_taken integer;
begin
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

  -- AC-8, AC-9. Counted under the lock taken above.
  if new.status = 'attending' and v_event.capacity is not null then
    select count(*) into v_taken
      from public.event_attendance a
     where a.event_id = new.event_id
       and a.status = 'attending'::public.attendance_status
       and a.member_id <> new.member_id;
    if v_taken >= v_event.capacity then
      raise exception 'event_full' using errcode = 'EV001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists event_attendance_guard on public.event_attendance;
create trigger event_attendance_guard
  before insert or update on public.event_attendance
  for each row execute function public.event_attendance_guard();

-- AC-4 (Q13). The UPDATE already holds the row's lock, so a concurrent approval waits for it, and
-- this count waits for nothing.
create or replace function public.event_capacity_guard() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_taken integer;
begin
  if new.capacity is not null then
    select count(*) into v_taken
      from public.event_attendance a
     where a.event_id = new.id
       and a.status = 'attending'::public.attendance_status;
    if new.capacity < v_taken then
      raise exception 'event_capacity_below_attendees' using errcode = 'EV003';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists event_capacity_guard on public.event;
create trigger event_capacity_guard
  before update of capacity on public.event
  for each row execute function public.event_capacity_guard();

-- ---------------------------------------------------------------------------------------------
-- 5. Policies. `to authenticated`, `(select auth.uid())` wrapped, drop-then-create.
-- ---------------------------------------------------------------------------------------------

-- REPLACED (ADR-014: a policy change). EVT-01's predicate, clause for clause, with ONE more
-- disjunct: someone pending or attending keeps reading the event after its scope or named list
-- stops including them (AC-5).
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
      or public.is_event_participant(id, (select auth.uid()))
    )
  );

-- AC-21, AC-22. The `exists` runs under the caller's OWN `event` policy, so a person who cannot read
-- the event receives nothing of it. Then: attendees to every reader (Q8); every row to whoever
-- manages the event; the caller's own row to the caller.
drop policy if exists event_attendance_select_visible on public.event_attendance;
create policy event_attendance_select_visible on public.event_attendance
  for select to authenticated
  using (
    public.member_team_id((select auth.uid())) is not null
    and exists (select 1 from public.event e where e.id = event_id)
    and (
      status = 'attending'::public.attendance_status
      or member_id = (select auth.uid())
      or public.may_manage_event(event_id, (select auth.uid()))
    )
  );

-- AC-6, AC-7, AC-11. The row is the caller's, and the caller is in the event's audience.
drop policy if exists event_attendance_insert_own on public.event_attendance;
create policy event_attendance_insert_own on public.event_attendance
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and public.is_event_audience(event_id, (select auth.uid()))
  );

-- AC-16, AC-17, AC-20. The creator (still approved) or an admin — `may_manage_event`, keyed on
-- `is_admin` and NEVER on `may_decide`. Which transitions is the guard's.
drop policy if exists event_attendance_update_manage on public.event_attendance;
create policy event_attendance_update_manage on public.event_attendance
  for update to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())))
  with check (public.may_manage_event(event_id, (select auth.uid())));

-- AC-14, AC-15, AC-19. Own row, pending or attending, registration open. A rejected or removed row
-- cannot be deleted by its person, so it cannot be cleared to start over.
drop policy if exists event_attendance_delete_own on public.event_attendance;
create policy event_attendance_delete_own on public.event_attendance
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
    and status in ('pending'::public.attendance_status, 'attending'::public.attendance_status)
    and public.event_registration_open(event_id)
  );

-- ---------------------------------------------------------------------------------------------
-- 6. Grants. `to authenticated`, never `public`.
-- ---------------------------------------------------------------------------------------------
-- The three new `event` columns join EVT-01's column lists. On `event_attendance`, everything is
-- revoked first (Supabase's default privileges hand a new table over whole), then exactly § 4.4's
-- list. `member_id` and `status` are WITHHELD from the insert grant: a request naming either is
-- refused 42501 before a policy runs (AC-20, TEA-04's shape). Only `status` is updatable.

revoke all on public.event_attendance from anon, authenticated;

grant insert (capacity, requires_approval, registration_deadline) on public.event to authenticated;
grant update (capacity, requires_approval, registration_deadline) on public.event to authenticated;
grant select, delete on public.event_attendance to authenticated;
grant insert (event_id) on public.event_attendance to authenticated;
grant update (status)   on public.event_attendance to authenticated;

-- Supabase also grants EXECUTE on new functions to `anon` by default, which `from public` does not
-- remove — so both are named.
revoke all on function public.event_registration_open(uuid) from public, anon;
revoke all on function public.is_event_audience(uuid, uuid) from public, anon;
revoke all on function public.is_event_participant(uuid, uuid) from public, anon;
revoke all on function public.event_attendance_guard() from public, anon;
revoke all on function public.event_capacity_guard() from public, anon;
revoke all on function public.save_event(uuid, text, text, text, date, date, public.event_scope, uuid[], integer, boolean, date) from public, anon;

grant execute on function public.event_registration_open(uuid) to authenticated;
grant execute on function public.is_event_audience(uuid, uuid) to authenticated;
grant execute on function public.is_event_participant(uuid, uuid) to authenticated;
grant execute on function public.event_attendance_guard() to authenticated;
grant execute on function public.event_capacity_guard() to authenticated;
grant execute on function public.save_event(uuid, text, text, text, date, date, public.event_scope, uuid[], integer, boolean, date) to authenticated;

commit;
