-- EVT-07. A guest registers for an opened event with a name and an email, and manages it from a link
-- shown once.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's to EVT-06's. `tests/permission-model
-- .test.ts` against a real PostgreSQL is still owed project-wide (.ai/standards/rbac-and-security.md
-- § Known weaknesses 1). `tests/guest-registration.test.ts` asserts the permission table against the
-- MOCK seam, which reproduces it, and reads this file for its shape; it cannot prove it.
--
-- **THE CONCURRENCY TEST IS STILL OWED** (EVT-02's header). The cap now spans two tables. Every write
-- that can raise seats taken — an `event_attendance` insert or update to `attending`, an
-- `event_guest` insert or update to `attending` — runs a guard whose FIRST statement locks the event
-- row `for update`, and every capacity change is an UPDATE of that row. Each guard counts attending
-- members AND attending guests by a fresh statement after it holds the lock (01-plan.md § 3). A guard
-- that counted only its own table would let a member and a guest take the last seat together.
--
-- Decided by ADR-052 (ACCEPTED by the operator). The names and shapes are 01-plan.md § 4.3's,
-- transcribed; the permission table they hold is § 3's.
--
-- **FOUR EXISTING FUNCTIONS ARE REPLACED, SAME SIGNATURES** (ADR-014 — listed in 01-plan.md § 6):
-- `event_attendance_guard` and `event_capacity_guard` (EVT-02), `get_guest_event` and
-- `list_guest_event_attendees` (EVT-06). Each body is its original's verbatim with the guest count or
-- the guest names added. `create or replace` keeps a function's grants, so none is re-granted.
--
-- **THE ANON ROLE'S FIRST WRITES** are `register_guest` and `cancel_guest_registration`, definer
-- functions taking a token and nothing an anonymous caller could widen. No role holds an insert or a
-- delete grant on `event_guest`; the anon role holds no grant on it at all (AC-21).
--
-- **THE MANAGE TOKEN IS STORED NOWHERE.** Only its SHA-256 is kept; `register_guest` returns the plain
-- token once and no other object can (AC-3). `sha256(bytea)` is core PostgreSQL 11+.
--
-- **GUEST DATA IS NEVER DELETED** (ADR-052 decision 8). `event_id … on delete set null`, not cascade;
-- no delete grant or policy. The guard's first branch exists because the `set null` is itself an
-- UPDATE that fires it.
--
-- **`public.member` IS UNTOUCHED** — no policy or grant on it changes, and `event_guest` has no
-- reference to it (INV-04).
--
-- **THREE MORE CUSTOM SQLSTATES**, beside EVT-02's `EV001`–`EV003`: `EV004` (the guest link is not an
-- open event's), `EV005` (no registration for that manage token), `EV006` (the name), `EV007` (the
-- email). The seam's mapper matches on SQLSTATE, never on message text.
--
-- **IDEMPOTENT** in the shape ADR-024 requires: a guarded `do` block for the enum, `create table if
-- not exists`, `create unique index if not exists`, `create or replace` for functions, `drop … if
-- exists` then `create` for the trigger and policies. One transaction.
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The enum and the table.
-- ---------------------------------------------------------------------------------------------

do $$ begin
  create type public.guest_status as enum ('pending', 'attending', 'rejected', 'removed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.event_guest (
  id                uuid primary key default gen_random_uuid(),
  -- AC-20. SET NULL, NOT CASCADE: guest data is never deleted (Q8). The second `set null` in the
  -- schema after EVT-04's notification.
  event_id          uuid null references public.event(id) on delete set null,
  -- Written by the guard from the event at insert; read only once the event is gone.
  event_name        text not null,
  name              text not null,
  email             text not null,
  -- encode(sha256(convert_to(<token>, 'UTF8')), 'hex'). The token itself is stored nowhere (AC-3).
  manage_token_hash text not null unique,
  status            public.guest_status not null,          -- set by the guard
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint event_guest_name_shape  check (btrim(name) = name and name <> '' and char_length(name) <= 100),
  constraint event_guest_email_shape check (btrim(email) = email and char_length(email) <= 254
                                            and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint event_guest_hash_shape  check (manage_token_hash ~ '^[0-9a-f]{64}$')
);

-- AC-5, AC-9. Any state, cancelled included.
create unique index if not exists event_guest_event_email on public.event_guest (event_id, lower(email));

alter table public.event_guest enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. The guard. THE CAP HOLDS HERE FOR GUESTS, under the same lock EVT-02's guard takes.
-- ---------------------------------------------------------------------------------------------
-- VOLATILE so each statement takes a fresh snapshot; `security definer` so the counts see every row
-- whatever the caller's select policy shows them.

create or replace function public.event_guest_guard() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_event public.event;
  v_taken integer;
begin
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

drop trigger if exists event_guest_guard on public.event_guest;
create trigger event_guest_guard
  before insert or update on public.event_guest
  for each row execute function public.event_guest_guard();

-- ---------------------------------------------------------------------------------------------
-- 3. EVT-02's two guards, REPLACED. Bodies verbatim, each seat count gaining attending guests.
-- ---------------------------------------------------------------------------------------------

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

-- AC-4 (Q13). The UPDATE already holds the row's lock, so a concurrent approval waits for it, and
-- this count waits for nothing. EVT-07: attending guests count too.
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
    v_taken := v_taken
      + (select count(*) from public.event_guest g
          where g.event_id = new.id and g.status = 'attending'::public.guest_status);
    if new.capacity < v_taken then
      raise exception 'event_capacity_below_attendees' using errcode = 'EV003';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. EVT-06's two guest reads, REPLACED. Same signatures, so `GuestEvent` keeps its keys (AC-22).
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_guest_event(p_token text)
  returns table (name text, description text, location text, start_date date, end_date date,
                 capacity integer, seats_taken integer)
  language sql stable security definer set search_path = '' as $$
  select e.name, e.description, e.location, e.start_date, e.end_date, e.capacity,
         (select count(*)::integer from public.event_attendance a
           where a.event_id = e.id and a.status = 'attending'::public.attendance_status)
         + (select count(*)::integer from public.event_guest g
             where g.event_id = e.id and g.status = 'attending'::public.guest_status)
    from public.event_guest_link l
    join public.event e on e.id = l.event_id
   where l.token = p_token;
$$;

-- AC-14 (F3-A). Attending guests' names join the members', unmarked, in join order. Still ONE TEXT
-- COLUMN: no id, no email, nothing that says which kind of person a name belongs to.
create or replace function public.list_guest_event_attendees(p_token text)
  returns table (display_name text)
  language sql stable security definer set search_path = '' as $$
  select x.display_name
    from (
      select case when m.status = 'approved'::public.member_status and m.removed_at is null
                  then m.display_name end as display_name,
             a.created_at,
             a.member_id::text as row_id
        from public.event_guest_link l
        join public.event_attendance a on a.event_id = l.event_id
                                      and a.status = 'attending'::public.attendance_status
        join public.member m on m.id = a.member_id
       where l.token = p_token
      union all
      select g.name, g.created_at, g.id::text
        from public.event_guest_link l
        join public.event_guest g on g.event_id = l.event_id
                                 and g.status = 'attending'::public.guest_status
       where l.token = p_token
    ) x
   order by x.created_at, x.row_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. The five new functions. SECURITY DEFINER, `set search_path = ''`, schema-qualified.
-- ---------------------------------------------------------------------------------------------

-- AC-22. Zero rows for any token but an open event's.
create or replace function public.get_guest_event_terms(p_token text)
  returns table (requires_approval boolean, registration_open boolean)
  language sql stable security definer set search_path = '' as $$
  select e.requires_approval, public.event_registration_open(e.id)
    from public.event_guest_link l
    join public.event e on e.id = l.event_id
   where l.token = p_token;
$$;

-- AC-1..AC-10. The ONLY door for a guest insert: no role holds an insert grant on `event_guest`.
-- Takes no state, no event id and no token of its own choosing — the guard sets the state and the
-- event's name, and the manage token is drawn here from two `gen_random_uuid()` (EVT-06's source).
-- Returns the plain token: the only place it ever leaves the database (AC-3).
create or replace function public.register_guest(p_token text, p_name text, p_email text)
  returns table (manage_token text, status public.guest_status)
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_name     text := btrim(coalesce(p_name, ''));
  v_email    text := btrim(coalesce(p_email, ''));
  v_event_id uuid;
  v_token    text;
  v_status   public.guest_status;
begin
  -- AC-4. The table's checks are the control; these give the seam a code per field.
  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'invalid_guest_name' using errcode = 'EV006';
  end if;
  if char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_guest_email' using errcode = 'EV007';
  end if;

  -- AC-8. Never-existed, malformed, closed and deleted are one answer.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'guest_link_not_found' using errcode = 'EV004';
  end if;
  select l.event_id into v_event_id from public.event_guest_link l where l.token = p_token;
  if v_event_id is null then
    raise exception 'guest_link_not_found' using errcode = 'EV004';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.event_guest (event_id, name, email, manage_token_hash)
  values (v_event_id, v_name, v_email, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  returning event_guest.status into v_status;

  manage_token := v_token;
  status := v_status;
  return next;
end;
$$;

-- AC-11, AC-20. By the hash. Zero rows for an unknown or malformed token. The live event's fields
-- when it exists; once deleted, the name as stored, nulls, closed, and `event_deleted`.
create or replace function public.get_guest_registration(p_manage_token text)
  returns table (event_name text, start_date date, end_date date, location text,
                 guest_name text, status public.guest_status,
                 registration_open boolean, event_deleted boolean)
  language sql stable security definer set search_path = '' as $$
  select coalesce(e.name, g.event_name), e.start_date, e.end_date, e.location,
         g.name, g.status,
         case when e.id is null then false else public.event_registration_open(e.id) end,
         e.id is null
    from public.event_guest g
    left join public.event e on e.id = g.event_id
   where p_manage_token ~ '^[0-9a-f]{64}$'
     and g.manage_token_hash = encode(sha256(convert_to(p_manage_token, 'UTF8')), 'hex');
$$;

-- AC-12, AC-13. The ONLY writer of `cancelled`: the update policy's check refuses it to everyone
-- else. No row for the hash → EV005. A deleted event's registration is over (EV002), as the manage
-- page draws it; the guard refuses a closed registration (EV002) or an illegal transition (22023).
create or replace function public.cancel_guest_registration(p_manage_token text)
  returns public.guest_status
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id       uuid;
  v_event_id uuid;
  v_status   public.guest_status;
begin
  if p_manage_token is null or p_manage_token !~ '^[0-9a-f]{64}$' then
    raise exception 'guest_registration_not_found' using errcode = 'EV005';
  end if;
  select g.id, g.event_id into v_id, v_event_id
    from public.event_guest g
   where g.manage_token_hash = encode(sha256(convert_to(p_manage_token, 'UTF8')), 'hex');
  if v_id is null then
    raise exception 'guest_registration_not_found' using errcode = 'EV005';
  end if;
  if v_event_id is null then
    raise exception 'event_registration_closed' using errcode = 'EV002';
  end if;

  update public.event_guest g
     set status = 'cancelled'::public.guest_status
   where g.id = v_id
  returning g.status into v_status;
  return v_status;
end;
$$;

-- AC-15. The creator (still approved) or an admin — `may_manage_event`, NEVER `may_decide`. Zero rows
-- to anyone else. Authenticated only.
create or replace function public.list_event_guest_emails(p_event_id uuid)
  returns table (guest_id uuid, email text)
  language sql stable security definer set search_path = '' as $$
  select g.id, g.email
    from public.event_guest g
   where g.event_id = p_event_id
     and public.may_manage_event(p_event_id, (select auth.uid()))
   order by g.created_at, g.id;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Policies. `to authenticated`, `(select auth.uid())` wrapped, drop-then-create.
-- ---------------------------------------------------------------------------------------------
-- No insert or delete policy. The definer functions write as their owner, as EVT-04's `notify`
-- inserts into `notification` with no insert policy.

-- AC-14, AC-15, AC-16. The `exists` runs under the caller's OWN `event` policy, so a person who
-- cannot read the event receives nothing of it. Attending guests to every reader; every guest to
-- whoever manages the event. The email is not in the column grant.
drop policy if exists event_guest_select_visible on public.event_guest;
create policy event_guest_select_visible on public.event_guest
  for select to authenticated
  using (
    public.member_team_id((select auth.uid())) is not null
    and exists (select 1 from public.event e where e.id = event_id)
    and (
      status = 'attending'::public.guest_status
      or public.may_manage_event(event_id, (select auth.uid()))
    )
  );

-- AC-16, AC-17, AC-18. The creator or an admin; which transitions is the guard's; `cancelled` is the
-- manage link's alone.
drop policy if exists event_guest_update_manage on public.event_guest;
create policy event_guest_update_manage on public.event_guest
  for update to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())))
  with check (
    public.may_manage_event(event_id, (select auth.uid()))
    and status <> 'cancelled'::public.guest_status
  );

-- ---------------------------------------------------------------------------------------------
-- 7. Grants. Explicit, never inherited.
-- ---------------------------------------------------------------------------------------------
-- `email` and `manage_token_hash` are WITHHELD from the select grant (AC-3, AC-15); only `status` is
-- updatable; nothing is insertable or deletable by any role.
revoke all on public.event_guest from anon, authenticated;
grant select (id, event_id, name, status, created_at, updated_at) on public.event_guest to authenticated;
grant update (status) on public.event_guest to authenticated;

-- Supabase grants EXECUTE on new functions to `anon` by default, which `from public` does not
-- remove — so all three are named.
revoke all on function public.event_guest_guard() from public, anon;
revoke all on function public.get_guest_event_terms(text) from public, anon, authenticated;
revoke all on function public.register_guest(text, text, text) from public, anon, authenticated;
revoke all on function public.get_guest_registration(text) from public, anon, authenticated;
revoke all on function public.cancel_guest_registration(text) from public, anon, authenticated;
revoke all on function public.list_event_guest_emails(uuid) from public, anon, authenticated;

grant execute on function public.event_guest_guard() to authenticated;
grant execute on function public.get_guest_event_terms(text) to anon, authenticated;
grant execute on function public.register_guest(text, text, text) to anon, authenticated;
grant execute on function public.get_guest_registration(text) to anon, authenticated;
grant execute on function public.cancel_guest_registration(text) to anon, authenticated;
grant execute on function public.list_event_guest_emails(uuid) to authenticated;

commit;
