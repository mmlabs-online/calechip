-- TSK-01. A member keeps a private list of tasks for each day, and only they can read or change it.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's and EVT-04's. A permission test against
-- a real PostgreSQL is still owed project-wide (.ai/standards/rbac-and-security.md § Known weaknesses
-- 1). `tests/tasks.test.ts` asserts every denial below against the MOCK seam, which reproduces these
-- four policies clause for clause, and reads this file for its shape; it cannot prove it.
--
-- Decided by ADR-057 (ACCEPTED by the operator). The names and shapes are 01-plan.md § 4.3's,
-- transcribed; the permission table they hold is § 3's.
--
-- **ONLY THE OWNER READS OR WRITES A TASK — NO TEAMMATE, MANAGER OR ADMIN, ON ANY TEAM** (ADR-057
-- decisions 1, 2 and 4). The four policies below carry ONE predicate: the caller owns the row and is
-- an approved, not-removed member. There is NO admin arm, NO decide arm and NO team arm in any of
-- them. Almost every other policy in the schema has an admin arm; copying one here would be the
-- natural mistake.
--
-- **NO OTHER PATH READS THE TABLE** (ADR-057 decision 3): no function, no trigger, no notify, no
-- realtime, no view is created here. `public.member_team_id` is called by the policies and reads
-- `public.member` only.
--
-- **THE DATABASE HOLDS NO DATE FLOOR.** "Today or later" (Q13-A) is held by the page and refused by
-- the seam before a request (01-plan.md § 1 decision 2, § 8 alternatives 1 and 2). A direct call that
-- dates a task in the past changes only the caller's own private list.
--
-- **A TASK CARRIES NO TIME** (ADR-057 decision 6, charter refusal 3): a date and two states.
-- `created_at` is an instant used for ordering only and is never displayed.
--
-- **THE SCOPE OF THE GUARANTEE IS EVERY TOKEN THE APP ISSUES** (ADR-057 decision 5). The project
-- owner, the dashboard and the service-role key bypass row-level security by design.
--
-- `member_id` references `member` with the default restrict, as every other reference to `member`
-- does: a member row is never deleted (ADR-013), so a removed member's tasks stay, and nobody reads
-- them (AC-18).
--
-- **IDEMPOTENT** in the shape ADR-024 requires: `create table if not exists`, `create index if not
-- exists`, `drop policy if exists` then `create`. One transaction.
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The table and its index.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.task (
  id          uuid        primary key default gen_random_uuid(),
  -- Not in the insert grant: whoever creates a task owns it (AC-17).
  member_id   uuid        not null default auth.uid() references public.member (id),
  date        date        not null,
  title       text        not null,
  note        text        null,
  done        boolean     not null default false,
  created_at  timestamptz not null default now(),
  constraint task_title_shape check (btrim(title) = title and title <> '' and char_length(title) <= 200),
  constraint task_note_shape  check (note is null or (btrim(note) = note and note <> '' and char_length(note) <= 1000))
);

create index if not exists task_member_date on public.task (member_id, date);

alter table public.task enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. Four policies, one predicate. `(select auth.uid())` wrapped so it is evaluated once.
-- ---------------------------------------------------------------------------------------------

drop policy if exists task_select_own on public.task;
create policy task_select_own on public.task
  for select to authenticated
  using (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

drop policy if exists task_insert_own on public.task;
create policy task_insert_own on public.task
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

drop policy if exists task_update_own on public.task;
create policy task_update_own on public.task
  for update to authenticated
  using (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  )
  with check (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

drop policy if exists task_delete_own on public.task;
create policy task_delete_own on public.task
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

-- ---------------------------------------------------------------------------------------------
-- 3. Grants. `to authenticated`, never `public`.
-- ---------------------------------------------------------------------------------------------
-- EXPLICIT, NOT INHERITED. Supabase's default privileges hand every new table in `public` to `anon`
-- and `authenticated` whole, so everything is revoked first. Then: select and delete; insert of the
-- three fields a person writes, so `member_id` takes `auth.uid()`; update of the four a person
-- changes, so `id`, `member_id` and `created_at` are refused 42501 before a policy runs.

revoke all on public.task from anon, authenticated;
grant select, delete on public.task to authenticated;
grant insert (date, title, note) on public.task to authenticated;
grant update (date, title, note, done) on public.task to authenticated;

commit;
