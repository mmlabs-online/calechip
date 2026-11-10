-- EVT-04. A person is notified in the app when an event concerns them.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's and EVT-02's. `tests/permission-model
-- .test.ts` against a real PostgreSQL is still owed project-wide (.ai/standards/rbac-and-security.md
-- § Known weaknesses 1). `tests/notifications.test.ts` asserts every recipient rule and every denial
-- below against the MOCK seam, which reproduces these policies and triggers, and reads this file for
-- its shape; it cannot prove it.
--
-- Decided by ADR-050 (ACCEPTED by product), inside ADR-005 — no server. The names and shapes are
-- 01-plan.md § 4.3's, transcribed; the permission table they hold is § 3's.
--
-- **ROWS ARE WRITTEN BY THE DATABASE AND BY NOTHING ELSE** (ADR-050 decision 2). There is no insert
-- grant and no insert policy on `public.notification`; the seven trigger functions below reach the
-- table through `public.notify`, a definer function that NO SESSION MAY EXECUTE — called through the
-- RPC surface it would let a caller write a notification to anyone.
--
-- **NOBODY READS ANOTHER PERSON'S NOTIFICATIONS, ADMIN INCLUDED** (ADR-050 decision 4, revert
-- condition 2). `notification_select_own` and `notification_update_own` have NO `is_admin` DISJUNCT.
-- Every other events policy has one; copying one here would be the natural mistake.
--
-- **A RECIPIENT IS ONLY EVER SOMEONE WHO CAN READ THE EVENT** (ADR-050 decision 3, ADR-045 decision
-- 3). `public.may_read_event` is A SECOND COPY OF `event_select_visible`'s PREDICATE as EVT-02 left
-- it, keyed on a given uid instead of `auth.uid()`. IT MUST STAY CLAUSE-FOR-CLAUSE EQUAL TO THE
-- POLICY: a future change to `event_select_visible` must change both (01-plan.md § 8, alternative 2
-- records why the policy is not rewritten to call it).
--
-- **NEVER TO THE ACTOR, AND ONLY FROM A PERSON** (ADR-050 decision 5, AC-9). `notify` skips
-- `auth.uid()` and writes nothing at all when it is null — a console write has nobody to name.
--
-- **`public.member` IS UNTOUCHED — NO POLICY ON IT IS CREATED, DROPPED OR REPLACED HERE.**
-- `listMembers()` returns what those policies return and is INV-04's denominator. Recipients are
-- enumerated inside definer triggers that return nothing to any caller; the only person a row names
-- is its actor, resolved to a name through EVT-01's `list_member_directory()`.
--
-- **NO EXISTING POLICY, TRIGGER OR FUNCTION IS REPLACED.** The triggers below are additional. On
-- `event`, `event_stamp` and `event_capacity_guard` run first and may refuse; an `after` trigger
-- only runs on a write that succeeded. `notify_event_cancelled` is `before delete` so the attendance
-- rows still exist when it reads them, and a delete that later fails rolls its rows back with it.
--
-- **THE REFERENCE TO THE EVENT IS `on delete set null`, CHOSEN** (01-plan.md § 6, ADR-050
-- § Consequences: notifications must not cascade away with their event). The first `set null` in the
-- schema. `event_name` is the snapshot that keeps a nulled row readable. `recipient_id` and
-- `actor_id` stay restrict — a member row is never deleted (ADR-013).
--
-- **NO SCHEDULER AND NO PRUNING** (ADR-050 decision 6, 01-plan.md § 1 and § 8 alternative 4).
--
-- **IDEMPOTENT** in the shape ADR-024 requires: a guarded `do` block for the enum, `create table if
-- not exists`, `create index if not exists`, `create or replace` for functions, `drop … if exists`
-- then `create` for triggers and policies. One transaction.
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The enum, the table and its index.
-- ---------------------------------------------------------------------------------------------

do $$ begin
  create type public.notification_kind as enum (
    'event_created', 'event_invited', 'event_updated', 'event_cancelled',
    'attendance_requested', 'attendance_withdrawn',
    'attendance_approved', 'attendance_rejected', 'attendance_removed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.notification (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.member(id),
  kind         public.notification_kind not null,
  -- Null once the event is deleted; `event_cancelled` is written null from the start.
  event_id     uuid null references public.event(id) on delete set null,
  -- The event's name when the row was written. Survives the event's deletion.
  event_name   text not null,
  actor_id     uuid not null references public.member(id),
  created_at   timestamptz not null default now(),
  -- Null while unread. The ONLY column a session may update (§ 6).
  read_at      timestamptz null
);

-- Serves the only two reads: the 50 newest, and the unread count.
create index if not exists notification_recipient_created
  on public.notification (recipient_id, created_at desc);

alter table public.notification enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. The two helpers. `set search_path = ''`, schema-qualified throughout.
-- ---------------------------------------------------------------------------------------------

-- AC-8. `event_select_visible`'s predicate as EVT-02 left it (20260929140000_evt02_attendance.sql
-- § 5), clause for clause, with `p_uid` for `auth.uid()`. KEEP THE TWO EQUAL — a change to the
-- policy must change this, and the reverse.
create or replace function public.may_read_event(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select public.member_team_id(p_uid) is not null
     and exists (
       select 1 from public.event e
        where e.id = p_event_id
          and (public.is_admin(p_uid)
               or e.creator_id = p_uid
               or e.scope = 'public'::public.event_scope
               or (e.scope = 'team'::public.event_scope
                   and e.team_id = public.member_team_id(p_uid))
               or (e.scope = 'named'::public.event_scope
                   and public.is_event_invitee(e.id, p_uid))
               or public.is_event_participant(e.id, p_uid))
     );
$$;

-- The single insert path. One row per DISTINCT recipient (AC-10), never the actor (AC-9), only a
-- reader of the event (AC-8), nothing at all without a signed-in actor (AC-9).
--
-- THE ONE SUBTLE LINE: the read check uses `p_event_id`, the insert writes null for
-- `event_cancelled` — that row's event is about to go, and `set null` would null it anyway.
create or replace function public.notify(
  p_recipients uuid[],
  p_kind       public.notification_kind,
  p_event_id   uuid,
  p_event_name text
) returns void
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    return;
  end if;

  insert into public.notification (recipient_id, kind, event_id, event_name, actor_id)
  select r.member_id,
         p_kind,
         case when p_kind = 'event_cancelled'::public.notification_kind then null else p_event_id end,
         p_event_name,
         v_actor
    from (select distinct unnest(coalesce(p_recipients, '{}'::uuid[])) as member_id) r
   where r.member_id is not null
     and r.member_id <> v_actor
     and (p_event_id is null or public.may_read_event(p_event_id, r.member_id));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. The seven trigger functions and their triggers. Each is definer and calls `notify` once.
-- ---------------------------------------------------------------------------------------------
-- "Approved member" is `member_team_id(m.id) is not null`, which carries `status = 'approved'` and
-- `removed_at is null`.

-- (a) AC-1. Own team: the creator's team's approved members. Every team: every approved member.
-- Named people: nobody — the named are told by (b).
create or replace function public.notify_event_created() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
begin
  if new.scope = 'named'::public.event_scope then
    return null;
  end if;

  perform public.notify(
    array(
      select m.id from public.member m
       where public.member_team_id(m.id) is not null
         and (new.scope = 'public'::public.event_scope
              or public.member_team_id(m.id) = new.team_id)
    ),
    'event_created'::public.notification_kind,
    new.id,
    new.name
  );
  return null;
end;
$$;

drop trigger if exists notify_event_created on public.event;
create trigger notify_event_created
  after insert on public.event
  for each row execute function public.notify_event_created();

-- (d) AC-5. The nine fields of the `when` clause and no others — a save that changes only the named
-- list, or nothing, does not fire. Recipients: whoever takes part (pending or attending).
create or replace function public.notify_event_updated() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.notify(
    array(
      select a.member_id from public.event_attendance a
       where a.event_id = new.id
         and a.status in ('pending'::public.attendance_status,
                          'attending'::public.attendance_status)
    ),
    'event_updated'::public.notification_kind,
    new.id,
    new.name
  );
  return null;
end;
$$;

drop trigger if exists notify_event_updated on public.event;
create trigger notify_event_updated
  after update on public.event
  for each row
  when (old.name                  is distinct from new.name
     or old.description           is distinct from new.description
     or old.location              is distinct from new.location
     or old.start_date            is distinct from new.start_date
     or old.end_date              is distinct from new.end_date
     or old.scope                 is distinct from new.scope
     or old.capacity              is distinct from new.capacity
     or old.requires_approval     is distinct from new.requires_approval
     or old.registration_deadline is distinct from new.registration_deadline)
  execute function public.notify_event_updated();

-- (d) AC-6. BEFORE delete: the attendance cascade has not run yet, so the participants are still
-- there to read, and the event still exists for the read check.
create or replace function public.notify_event_cancelled() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.notify(
    array(
      select a.member_id from public.event_attendance a
       where a.event_id = old.id
         and a.status in ('pending'::public.attendance_status,
                          'attending'::public.attendance_status)
    ),
    'event_cancelled'::public.notification_kind,
    old.id,
    old.name
  );
  return old;
end;
$$;

drop trigger if exists notify_event_cancelled on public.event;
create trigger notify_event_cancelled
  before delete on public.event
  for each row execute function public.notify_event_cancelled();

-- (b) AC-2, AC-3. One per row inserted on the named list, so a person already named receives
-- nothing when the event is saved again (`save_event` only inserts the missing), and a person taken
-- off and named again receives a second one.
create or replace function public.notify_event_invited() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_name text;
begin
  select e.name into v_name from public.event e where e.id = new.event_id;
  if not found then
    return null;
  end if;

  perform public.notify(
    array[new.member_id],
    'event_invited'::public.notification_kind,
    new.event_id,
    v_name
  );
  return null;
end;
$$;

drop trigger if exists notify_event_invited on public.event_invitee;
create trigger notify_event_invited
  after insert on public.event_invitee
  for each row execute function public.notify_event_invited();

-- (e) AC-7. A request — the guard made it `pending` because the event needs approval. A join on an
-- event needing none is `attending` and does not fire.
create or replace function public.notify_attendance_inserted() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_event public.event;
begin
  select * into v_event from public.event e where e.id = new.event_id;
  if not found then
    return null;
  end if;

  perform public.notify(
    array[v_event.creator_id],
    'attendance_requested'::public.notification_kind,
    v_event.id,
    v_event.name
  );
  return null;
end;
$$;

drop trigger if exists notify_attendance_inserted on public.event_attendance;
create trigger notify_attendance_inserted
  after insert on public.event_attendance
  for each row
  when (new.status = 'pending'::public.attendance_status)
  execute function public.notify_attendance_inserted();

-- (c) AC-4. The guard admits only pending→attending, pending→rejected and attending→removed, so the
-- new status names the kind. The read check runs AFTER the change: a person rejected or removed from
-- a named event they are no longer named on cannot read it, and receives nothing (AC-8).
create or replace function public.notify_attendance_changed() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_name text;
  v_kind public.notification_kind;
begin
  v_kind := case new.status
              when 'attending'::public.attendance_status then 'attendance_approved'::public.notification_kind
              when 'rejected'::public.attendance_status  then 'attendance_rejected'::public.notification_kind
              when 'removed'::public.attendance_status   then 'attendance_removed'::public.notification_kind
            end;
  if v_kind is null then
    return null;
  end if;

  select e.name into v_name from public.event e where e.id = new.event_id;
  if not found then
    return null;
  end if;

  perform public.notify(array[new.member_id], v_kind, new.event_id, v_name);
  return null;
end;
$$;

drop trigger if exists notify_attendance_changed on public.event_attendance;
create trigger notify_attendance_changed
  after update of status on public.event_attendance
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_attendance_changed();

-- (e) AC-7. Leaving, or cancelling one's own request. ONLY WHEN THE ROW WAS THE ACTOR'S OWN AND THE
-- EVENT STILL EXISTS: a cascade from the event's deletion finds no event, and no other path deletes
-- an attendance — so neither fires it.
create or replace function public.notify_attendance_deleted() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_event public.event;
begin
  if old.member_id is distinct from (select auth.uid()) then
    return null;
  end if;

  select * into v_event from public.event e where e.id = old.event_id;
  if not found then
    return null;
  end if;

  perform public.notify(
    array[v_event.creator_id],
    'attendance_withdrawn'::public.notification_kind,
    v_event.id,
    v_event.name
  );
  return null;
end;
$$;

drop trigger if exists notify_attendance_deleted on public.event_attendance;
create trigger notify_attendance_deleted
  after delete on public.event_attendance
  for each row
  when (old.status in ('pending'::public.attendance_status, 'attending'::public.attendance_status))
  execute function public.notify_attendance_deleted();

-- ---------------------------------------------------------------------------------------------
-- 4. The mark — `mark_notifications_read`, SECURITY INVOKER.
-- ---------------------------------------------------------------------------------------------
-- **IT ADDS THE DATABASE'S CLOCK AND NOTHING ELSE.** The update runs under the caller's policy and
-- column grant, so it cannot reach a row the caller could not reach with a table update. Null
-- `p_ids` is every unread row of the caller's (AC-15), beyond the panel's window too. Another
-- person's id matches nothing and changes nothing — the same answer as an already-read one.

create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns integer
  language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_count integer;
begin
  update public.notification
     set read_at = now()
   where recipient_id = (select auth.uid())
     and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Policies. `to authenticated`, `(select auth.uid())` wrapped, drop-then-create.
-- ---------------------------------------------------------------------------------------------
-- NO `is_admin` DISJUNCT IN EITHER — ADR-050 decision 4. `member_team_id(uid) is not null` shuts out
-- a pending sign-up, a rejected one and a removed member, including from rows written before their
-- removal (AC-11).

drop policy if exists notification_select_own on public.notification;
create policy notification_select_own on public.notification
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

drop policy if exists notification_update_own on public.notification;
create policy notification_update_own on public.notification
  for update to authenticated
  using (
    recipient_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  )
  with check (
    recipient_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

-- ---------------------------------------------------------------------------------------------
-- 6. Grants. `to authenticated`, never `public`.
-- ---------------------------------------------------------------------------------------------
-- EXPLICIT, NOT INHERITED. Supabase's default privileges hand every new table in `public` to `anon`
-- and `authenticated` whole, so everything is revoked first. Then: select, and update of `read_at`
-- ONLY — any other column is refused 42501 before a policy runs. NO INSERT AND NO DELETE GRANT, and
-- no insert or delete policy (AC-12, ADR-050 decision 2).

revoke all on public.notification from anon, authenticated;

grant select on public.notification to authenticated;
grant update (read_at) on public.notification to authenticated;

-- Supabase also grants EXECUTE on new functions to `anon` by default, which `from public` does not
-- remove — so both are named.
revoke all on function public.may_read_event(uuid, uuid) from public, anon;
revoke all on function public.notify(uuid[], public.notification_kind, uuid, text) from public, anon, authenticated;
revoke all on function public.notify_event_created() from public, anon;
revoke all on function public.notify_event_updated() from public, anon;
revoke all on function public.notify_event_cancelled() from public, anon;
revoke all on function public.notify_event_invited() from public, anon;
revoke all on function public.notify_attendance_inserted() from public, anon;
revoke all on function public.notify_attendance_changed() from public, anon;
revoke all on function public.notify_attendance_deleted() from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;

-- `notify` IS NOT IN THIS LIST. No session calls it; the trigger functions reach it as its definer.
grant execute on function public.may_read_event(uuid, uuid) to authenticated;
grant execute on function public.notify_event_created() to authenticated;
grant execute on function public.notify_event_updated() to authenticated;
grant execute on function public.notify_event_cancelled() to authenticated;
grant execute on function public.notify_event_invited() to authenticated;
grant execute on function public.notify_attendance_inserted() to authenticated;
grant execute on function public.notify_attendance_changed() to authenticated;
grant execute on function public.notify_attendance_deleted() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

commit;
