-- MIR-11: Composite foreign keys make a cross-org insert impossible at the database.
--
-- Implements ADR-070 §§ 1-4 (structural DDL phase):
--   1. `public.team_role` enum ('member', 'manager').
--   2. `public.org` table, check constraints, `org_one_shared_tenant_idx`, and
--      `org_enforce_immutable_org_code` trigger.
--   3. Nullable `org_id` on all 12 existing org-scoped tables + nullable `primary_team_id`
--      on `public.entry` (backfilled and set NOT NULL in MIR-12).
--   4. Parent `(id, org_id)` unique constraints on `team`, `member`, `event`, and `membership`.
--   5. `public.membership` table, constraints, partial unique indexes, and supporting indexes.
--   6. All 18 composite foreign keys `(parent_id, org_id) -> parent (id, org_id)` across
--      `membership`, `entry`, `busy_day`, `issue_report`, `event`, `event_invitee`,
--      `event_attendance`, `event_guest_link`, `event_guest`, and `notification`.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. `public.team_role` enum (ADR-070 § 1)
-- ---------------------------------------------------------------------------------------------
do $$ begin
  create type public.team_role as enum ('member', 'manager');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. `public.org` table, constraints, index, and immutability trigger (ADR-070 § 2)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.org (
  id                uuid primary key default gen_random_uuid(),
  org_code          text not null,
  name              text not null,
  is_shared_tenant  boolean not null default false,
  plan              text not null default 'free',
  max_members       integer null,
  max_teams         integer null,
  timezone          text not null default 'Asia/Ho_Chi_Minh',
  created_by        uuid null references public.member (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint org_org_code_key unique (org_code),
  constraint org_code_shape check (
    org_code ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$'
    and char_length(org_code) between 2 and 32
  ),
  constraint org_code_not_reserved check (
    org_code <> all (array[
      -- ADR-070 § 2 (29 reserved tokens: 15 P3-1 + 14 SPA route segments):
      'system', 'api', 'admin', 'login', 'signin', 'signup', 'app',
      'static', 'public', 'assets', 'healthz', 'fonts', 'images',
      '_next', 'index.html',
      'signups', 'members', 'entries', 'month', 'week', 'year',
      'setting', 'threshold', 'teams', 'reports', 'holidays',
      'events', 'profile', 'guest',
      -- Additional reserved route/slug tokens in MIR-11 01-plan.md § 4.1:
      'auth', 'billing', 'calechip', 'calendar', 'create', 'dashboard',
      'dev', 'docs', 'help', 'invite', 'join', 'logout', 'manage',
      'new', 'onboarding', 'org', 'orgs', 'settings', 'support',
      'team', 'www'
    ])
  ),
  constraint org_name_not_blank check (btrim(name) <> '' and char_length(name) <= 80),
  constraint org_plan_not_blank check (btrim(plan) <> ''),
  constraint org_timezone_not_blank check (btrim(timezone) <> ''),
  constraint org_max_members_positive check (max_members is null or max_members >= 1),
  constraint org_max_teams_positive check (max_teams is null or max_teams >= 1)
);

create unique index if not exists org_one_shared_tenant_idx
  on public.org ((true))
  where is_shared_tenant = true;

create or replace function public.org_enforce_immutable_org_code()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if new.org_code is distinct from old.org_code then
    raise exception 'org_code_immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.org_enforce_immutable_org_code() from public, anon, authenticated;

drop trigger if exists org_enforce_immutable_org_code on public.org;
create trigger org_enforce_immutable_org_code
  before update on public.org
  for each row execute function public.org_enforce_immutable_org_code();

alter table public.org enable row level security;
revoke all on table public.org from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Parent tables: `org_id` and `unique (id, org_id)` on `team`, `member`, `event` (ADR-070 § 4)
-- ---------------------------------------------------------------------------------------------
alter table public.team
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.team
    add constraint team_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.team
    add constraint team_id_org_id_key unique (id, org_id);
exception when duplicate_object or duplicate_table then null;
end $$;

create index if not exists team_org_id_idx on public.team (org_id);

alter table public.member
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.member
    add constraint member_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.member
    add constraint member_id_org_id_key unique (id, org_id);
exception when duplicate_object or duplicate_table then null;
end $$;

create index if not exists member_org_id_idx on public.member (org_id);

alter table public.event
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event
    add constraint event_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event
    add constraint event_id_org_id_key unique (id, org_id);
exception when duplicate_object or duplicate_table then null;
end $$;

create index if not exists event_org_id_idx on public.event (org_id);

-- ---------------------------------------------------------------------------------------------
-- 4. `public.membership` table, constraints, and indexes (ADR-070 § 3 & MIR-11 plan P3-2)
-- ---------------------------------------------------------------------------------------------
-- INV-04, INV-07: N:M team membership with [joined_at, left_at) interval history and same-org FKs.
create table if not exists public.membership (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.org (id) on delete restrict,
  team_id     uuid not null,
  member_id   uuid not null,
  team_role   public.team_role not null default 'member',
  is_primary  boolean not null default false,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint membership_id_org_id_key unique (id, org_id),
  constraint membership_team_org_fk
    foreign key (team_id, org_id) references public.team (id, org_id) on delete restrict,
  constraint membership_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict,
  constraint membership_left_after_joined
    check (left_at is null or left_at >= joined_at),
  constraint membership_inactive_not_primary
    check (left_at is null or is_primary = false)
);

create unique index if not exists membership_active_team_member_idx
  on public.membership (team_id, member_id)
  where left_at is null;

create unique index if not exists membership_one_active_primary_idx
  on public.membership (member_id)
  where left_at is null and is_primary = true;

create index if not exists membership_member_active_idx
  on public.membership (member_id, org_id)
  where left_at is null;

create index if not exists membership_org_id_idx
  on public.membership (org_id)
  where left_at is null;

create index if not exists membership_team_history_idx
  on public.membership (team_id, joined_at, left_at);

alter table public.membership enable row level security;
revoke all on table public.membership from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Child tables: `org_id`, `primary_team_id`, and composite foreign keys (ADR-070 § 4)
-- ---------------------------------------------------------------------------------------------

-- 5a. `public.entry` (INV-07)
alter table public.entry
  add column if not exists org_id uuid null,
  add column if not exists primary_team_id uuid null;

do $$ begin
  alter table public.entry
    add constraint entry_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.entry
    add constraint entry_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.entry
    add constraint entry_primary_team_org_fk
    foreign key (primary_team_id, org_id) references public.team (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.entry
    add constraint entry_approved_by_org_fk
    foreign key (approved_by, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists entry_org_id_idx on public.entry (org_id);
create index if not exists entry_primary_team_org_idx on public.entry (primary_team_id, org_id);

-- 5b. `public.holiday`
alter table public.holiday
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.holiday
    add constraint holiday_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists holiday_org_id_idx on public.holiday (org_id);

-- 5c. `public.busy_day`
alter table public.busy_day
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.busy_day
    add constraint busy_day_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.busy_day
    add constraint busy_day_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists busy_day_org_id_idx on public.busy_day (org_id);

-- 5d. `public.issue_report`
alter table public.issue_report
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.issue_report
    add constraint issue_report_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.issue_report
    add constraint issue_report_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists issue_report_org_id_idx on public.issue_report (org_id);

-- 5e. `public.event` composite foreign keys
do $$ begin
  alter table public.event
    add constraint event_creator_org_fk
    foreign key (creator_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event
    add constraint event_team_org_fk
    foreign key (team_id, org_id) references public.team (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

-- 5f. `public.event_invitee`
alter table public.event_invitee
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_invitee
    add constraint event_invitee_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_invitee
    add constraint event_invitee_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_invitee
    add constraint event_invitee_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists event_invitee_org_id_idx on public.event_invitee (org_id);

-- 5g. `public.event_attendance`
alter table public.event_attendance
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_attendance
    add constraint event_attendance_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_attendance
    add constraint event_attendance_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_attendance
    add constraint event_attendance_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists event_attendance_org_id_idx on public.event_attendance (org_id);

-- 5h. `public.event_guest_link`
alter table public.event_guest_link
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_guest_link
    add constraint event_guest_link_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_guest_link
    add constraint event_guest_link_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists event_guest_link_org_id_idx on public.event_guest_link (org_id);

-- 5i. `public.event_guest`
alter table public.event_guest
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_guest
    add constraint event_guest_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_guest
    add constraint event_guest_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete set null (event_id);
exception when duplicate_object then null;
end $$;

create index if not exists event_guest_org_id_idx on public.event_guest (org_id);

-- 5j. `public.notification`
alter table public.notification
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.notification
    add constraint notification_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.notification
    add constraint notification_recipient_org_fk
    foreign key (recipient_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.notification
    add constraint notification_actor_org_fk
    foreign key (actor_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.notification
    add constraint notification_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete set null (event_id);
exception when duplicate_object then null;
end $$;

create index if not exists notification_org_id_idx on public.notification (org_id);

commit;
