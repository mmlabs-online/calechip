-- EVT-06. A creator opens an event to guests, and anyone with its link reads it and who is coming.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's to EVT-05's. `tests/permission-model
-- .test.ts` against a real PostgreSQL is still owed project-wide (.ai/standards/rbac-and-security.md
-- § Known weaknesses 1). `tests/guest-link.test.ts` asserts the permission table against the MOCK
-- seam, which reproduces it, and reads this file for its shape; it cannot prove it.
--
-- Decided by ADR-052 (ACCEPTED by the operator). The names and shapes are 01-plan.md § 4.3's,
-- transcribed; the permission table they hold is § 3's.
--
-- **NOTHING EXISTING IS REPLACED.** No policy, trigger or function from EVT-01 to EVT-05 changes,
-- nothing is written to `public.event`, and no policy or grant on `public.member` changes (INV-04).
-- Opening is an INSERT into a table of its own, so EVT-04's `notify_event_updated` never fires and
-- the event's `updated_at` never moves (AC-1).
--
-- **THE TWO GUEST READS ARE THE ONLY OBJECTS THE ANON ROLE MAY CALL** (AC-14). Each filters on the
-- token and on nothing the caller can widen, so no call lists opened events or says whether an event
-- exists (ADR-052 § Consequences). Each returns a FIXED COLUMN LIST — AC-12 is a property of the
-- signature, and a reviewer sees any widening as a signature change (01-plan.md § 8 alternative 3).
--
-- **IDEMPOTENT** in the shape ADR-024 requires: `create table if not exists`, `drop policy if exists`
-- then `create`, `create or replace` for functions. One transaction.
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The table. A row is "open to guests"; no row is closed. The token is the database's.
-- ---------------------------------------------------------------------------------------------
-- `event_id` is the primary key, so an event has at most one link (AC-6), and the cascade kills the
-- link with the event (AC-7). Two v4 UUIDs, dashes removed, give 64 lowercase hex characters and 244
-- random bits from the strong source — `gen_random_uuid()` is core PostgreSQL 13+ and every table
-- since TEA-01 already defaults its id to it (`20260831150024_tea01_membership.sql:25`).
create table if not exists public.event_guest_link (
  event_id  uuid primary key references public.event(id) on delete cascade,
  token     text not null unique
            default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  opened_at timestamptz not null default now(),
  constraint event_guest_link_token_shape check (token ~ '^[0-9a-f]{64}$')
);
alter table public.event_guest_link enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. Policies. `to authenticated`, `(select auth.uid())` wrapped, drop-then-create.
-- ---------------------------------------------------------------------------------------------
-- `may_manage_event` is EVT-01's: the creator while still an approved, non-removed member, or any
-- admin — never a manager as such (AC-2, AC-3). No `update` policy and no `update` grant: a link is
-- opened or closed, never edited.
drop policy if exists event_guest_link_select_manage on public.event_guest_link;
create policy event_guest_link_select_manage on public.event_guest_link
  for select to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())));

drop policy if exists event_guest_link_insert_manage on public.event_guest_link;
create policy event_guest_link_insert_manage on public.event_guest_link
  for insert to authenticated
  with check (public.may_manage_event(event_id, (select auth.uid())));

drop policy if exists event_guest_link_delete_manage on public.event_guest_link;
create policy event_guest_link_delete_manage on public.event_guest_link
  for delete to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- 3. The guest read. SECURITY DEFINER, and the ONLY anon-callable objects in the schema.
-- ---------------------------------------------------------------------------------------------
-- Each joins FROM the link table on the token, so a token that is not an open event's returns zero
-- rows — the same answer for never-existed, closed and deleted (AC-13). `seats_taken` is counted
-- here, never derived from the attendee list's length.
create or replace function public.get_guest_event(p_token text)
  returns table (name text, description text, location text, start_date date, end_date date,
                 capacity integer, seats_taken integer)
  language sql stable security definer set search_path = '' as $$
  select e.name, e.description, e.location, e.start_date, e.end_date, e.capacity,
         (select count(*)::integer from public.event_attendance a
           where a.event_id = e.id and a.status = 'attending'::public.attendance_status)
    from public.event_guest_link l
    join public.event e on e.id = l.event_id
   where l.token = p_token;
$$;

-- ONE TEXT COLUMN, and null for anyone no longer an approved, non-removed member — "Former member"
-- on the page (AC-10). No id, avatar, team, role or email. This is the only path from the anon key to
-- a name; no policy on `public.member` is added or widened (INV-04).
create or replace function public.list_guest_event_attendees(p_token text)
  returns table (display_name text)
  language sql stable security definer set search_path = '' as $$
  select case when m.status = 'approved'::public.member_status and m.removed_at is null
              then m.display_name end
    from public.event_guest_link l
    join public.event_attendance a on a.event_id = l.event_id
                                  and a.status = 'attending'::public.attendance_status
    join public.member m on m.id = a.member_id
   where l.token = p_token
   order by a.created_at, a.member_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Grants. Explicit, never inherited (EVT-01 § 7's reason).
-- ---------------------------------------------------------------------------------------------
-- `insert (event_id)` only: the token and the time are the database's, never the caller's (§ 3).
revoke all on public.event_guest_link from anon, authenticated;
grant select, delete on public.event_guest_link to authenticated;
grant insert (event_id) on public.event_guest_link to authenticated;

revoke all on function public.get_guest_event(text) from public, anon, authenticated;
revoke all on function public.list_guest_event_attendees(text) from public, anon, authenticated;
grant execute on function public.get_guest_event(text) to anon, authenticated;
grant execute on function public.list_guest_event_attendees(text) to anon, authenticated;

commit;
