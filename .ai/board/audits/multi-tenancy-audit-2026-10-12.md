# CaleChip — Multi-tenancy readiness audit

- **Date:** 2026-10-12
- **Branch audited:** `claude/calechip-multi-tenancy-audit-r34xa8` (clean tree)
- **Mode:** read-only. No file in the repository was changed and no migration was run.
- **Live schema:** not reachable. The container has no `SUPABASE_DB_URL`, no service key and no
  `supabase/config.toml`; `psql` is installed but there is nothing to connect to. Section 1 is
  reconstructed from `supabase/migrations/`. Its "discrepancy" list compares the migrations with
  `supabase/db.sql` (the file that calls itself the target schema), not with a live database.

## ⚠ Most severe finding — read first

**Any approved member can make themselves admin, or move themselves to another team, with one direct
PATCH.** This comes from static reading and has not been tried against a real database. It is the
combination of three things:

- Column privileges on `member`, granted to the whole `authenticated` role:
  - `tea04:29`: `grant update (role, removed_at) on public.member to authenticated;`
  - `profile_self_update:39`: `grant update (display_name, avatar) …`
  - `member_approval:173`: `grant update (status, team_id) on public.member to authenticated;`
- Policy `member_update_own` (`profile_self_update:61-64`):
  ```sql
  using (id = (select auth.uid()) and removed_at is null)
  with check (id = (select auth.uid()));
  ```
- Trigger `member_enforce_role_and_removal` (final version `profile_self_update:117-204`). It
  refuses demoting an admin, promoting a removed member, undoing or re-dating a removal, removing
  yourself, someone else changing your name or avatar, and a blank name. It does **not** refuse a
  person changing their own `role`, `status` or `team_id`.

Consequence: `PATCH /rest/v1/member?id=eq.<self>` with `{"role":"admin"}` from an ordinary member
succeeds, and because `is_admin` is global they become admin over every team.

The comment at `profile_self_update.sql:13-17` says *"`team_id` … still ungranted to everybody"*.
That was true at 09:30 and was made false by `member_approval.sql` at 10:00 the same day. The mock's
`updateOwnProfile` writes only name and avatar, so no test can catch this.

## File legend

Short names below are files in `supabase/migrations/`. `supabase.ts` is `src/lib/data/supabase.ts`.

| Short | File |
|---|---|
| tea01 | `20260831150024_tea01_membership.sql` |
| tea02 | `20260901090000_tea02_allow_list_writes.sql` |
| tea03 | `20260901093000_tea03_member_select_team.sql` |
| tea04 | `20260901120000_tea04_member_writes.sql` |
| cal01 | `20260903103000_cal01_entry.sql` |
| cal02 | `20260903143000_cal02_own_entry_writes.sql` |
| cal03 | `20260903160000_cal03_admin_entry_writes.sql` |
| cal04 | `20260904100000_cal04_team_select.sql` |
| adm01 | `20260905000000_adm01_team_threshold.sql` |
| adm02 / adm02seed | `20260905120000_adm02_holiday.sql` / `20260905120100_adm02_holiday_seed.sql` |
| adm03 | `20260905140000_adm03_holiday_writes.sql` |
| adm05 | `20260905190000_adm05_entry_decision.sql` |
| adm06 | `20260905230000_adm06_reject_entries.sql` |
| profile_self_update | `20260910093000_solo_profile_self_update.sql` |
| member_approval | `20260910100000_solo_member_approval.sql` |
| last_sign_in | `20260910140000_solo_member_last_sign_in.sql` |
| busy_day | `20260911090000_solo_busy_day.sql` |
| team_name | `20260911160000_solo_team_name_update.sql` |
| approval_settings | `20260911170000_solo_approval_settings.sql` |
| many_teams | `20260911180000_solo_many_teams.sql` |
| manager_role | `20260912100000_solo_manager_role.sql` |
| member_email | `20260912120000_solo_member_email.sql` |
| avatar_images | `20260913090000_solo_avatar_images.sql` |
| mgr_gen_cols | `20260913120000_solo_manager_decision_generated_columns.sql` |
| cal11 | `20260922150000_cal11_cross_team_reads.sql` |
| cross_team_role | `20260924100000_solo_cross_team_role.sql` |
| issue | `20260926100000_solo_issue_report.sql` |
| issue_img | `20260926140000_solo_issue_report_images.sql` |
| evt01 | `20260929120000_evt01_event.sql` |
| evt02 | `20260929140000_evt02_attendance.sql` |
| evt04 | `20261008120000_evt04_notification.sql` |
| evt05 | `20261009090000_evt05_event_email.sql` |
| evt06 | `20261009120000_evt06_guest_link.sql` |
| evt07 | `20261009150000_evt07_guest_registration.sql` |

---

## 1. Schema (net state after all 33 migrations)

### Enums

```sql
create type public.member_role as enum ('member', 'manager', 'admin');                -- tea01:22 + manager_role:36 ('manager' before 'admin')
create type public.member_status as enum ('pending', 'approved', 'rejected');          -- member_approval:37
create type public.entry_type    as enum ('pto', 'wfh');                               -- cal01:36
create type public.entry_portion as enum ('full', 'am', 'pm');                         -- cal01:37
create type public.entry_status  as enum ('pending', 'approved', 'rejected');          -- cal01:38
create type public.holiday_kind  as enum ('non_working', 'working');                   -- adm02:14
create type public.issue_kind    as enum ('bug', 'idea', 'other');                     -- issue:25
create type public.issue_status  as enum ('open', 'done');                             -- issue:30
create type public.event_scope   as enum ('team', 'named', 'public');                  -- evt01:53
create type public.attendance_status as enum ('pending','attending','rejected','removed');            -- evt02:54
create type public.notification_kind as enum ('event_created','event_invited','event_updated','event_cancelled',
  'attendance_requested','attendance_withdrawn','attendance_approved','attendance_rejected','attendance_removed'); -- evt04:62-66
create type public.guest_status  as enum ('pending','attending','rejected','removed','cancelled');    -- evt07:57
```

Extensions: `citext` (tea01:20), `btree_gist` (cal01:33), `pg_net` (evt05:64).

### `public.team`

```sql
create table public.team (
  id                 uuid primary key default gen_random_uuid(),   -- tea01:25
  name               text not null,                                 -- tea01:26  (no unique, no check)
  overload_threshold numeric not null default 0.5,                  -- tea01:27  (no check constraint)
  created_at         timestamptz not null default now(),            -- tea01:28
  wfh_need_approve   boolean not null default true,                 -- approval_settings:97
  pto_need_approve   boolean not null default true                  -- approval_settings:98
);
```

- Indexes: primary key only.
- RLS on (tea01:138).
- Grants: `select` (cal04:34), `update (overload_threshold)` (adm01:43), `update (name)`
  (team_name:44), `update (wfh_need_approve, pto_need_approve)` (approval_settings:100).

### `public.member`

```sql
create table public.member (
  id                  uuid primary key references auth.users (id) on delete restrict,  -- tea01:32
  team_id             uuid null references public.team (id) on delete restrict,        -- tea01:33; NOT NULL dropped member_approval:50
  display_name        text not null,                                                   -- tea01:34
  avatar              text not null,                                                   -- tea01:35
  role                public.member_role not null default 'member',                    -- tea01:36
  removed_at          timestamptz,                                                     -- tea01:37
  created_at          timestamptz not null default now(),                              -- tea01:38
  status              public.member_status not null default 'pending',                 -- member_approval:46-47 (added with default 'approved', then default → 'pending')
  last_sign_in_at     timestamptz,                                                     -- last_sign_in:30
  email               text,                                                            -- member_email:52 (nullable, NOT unique)
  event_email_enabled boolean not null default true                                    -- evt05:71
);
```

- Indexes: primary key only. **No index on `team_id`.**
- RLS on (tea01:139).
- Grants: `select` (tea01:146), `update (role, removed_at)` (tea04:29), `update (display_name,
  avatar)` (profile_self_update:39), `update (status, team_id)` (member_approval:173),
  `revoke update (event_email_enabled)` (evt05:76).
- Trigger on `public.member`: `member_enforce_role_and_removal`, BEFORE UPDATE (tea04:109).
- Triggers on `auth.users`:
  - `admit_allow_listed_member`, AFTER INSERT OR UPDATE OF email_confirmed_at (tea01:134). Final
    function body is avatar_images:46-81 and inserts `team_id = null`.
  - `sync_member_last_sign_in` (last_sign_in:67).
  - `sync_member_email` (member_email:100).

### `public.allowed_email`

Created at tea01:41-47 and **dropped** at member_approval:185
(`drop table if exists public.allowed_email cascade;`). It no longer exists.

### `public.entry`

```sql
create table public.entry (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.member (id) on delete restrict,
  type             public.entry_type not null,
  portion          public.entry_portion not null default 'full',
  start_date       date not null,
  end_date         date not null,
  tentative        boolean not null default false,
  status           public.entry_status not null default 'pending',
  rejection_reason text,
  note             text,
  approved_by      uuid references public.member (id) on delete restrict,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  date_range       daterange generated always as (daterange(start_date, end_date, '[]')) stored,
  portion_slots    int4range generated always as (case portion when 'full' then int4range(0, 2)
                     when 'am' then int4range(0, 1) when 'pm' then int4range(1, 2) end) stored,
  constraint entry_end_after_start check (end_date >= start_date),
  constraint entry_rejection_reason_iff_rejected check (
    (status = 'rejected'::public.entry_status) = (rejection_reason is not null and btrim(rejection_reason) <> ''))
);                                                                                       -- cal01:45-97
alter table public.entry add constraint entry_no_overlapping_portion
  exclude using gist (member_id with =, date_range with &&, portion_slots with &&);      -- cal01:111-117
```

- **No `team_id` column.** An entry's team is derived through `member_team_id(member_id)`.
- Indexes: primary key and the exclusion constraint's GiST index.
- Grants: `select` (cal01:191); `insert (member_id, type, portion, start_date, end_date, tentative,
  note)` (cal01:192); `update (start_date, end_date, type, portion, tentative, note)` (cal02:41);
  `delete` (cal02:48); `update (status, rejection_reason)` (adm05:170).
- Triggers: `entry_enforce_decision`, BEFORE UPDATE (cal01:163; final body mgr_gen_cols:20-136);
  `entry_apply_approval_setting`, BEFORE INSERT (approval_settings:132).

### `public.holiday`

```sql
create table public.holiday (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,                      -- global: one row per date for the whole system
  name text not null,
  kind public.holiday_kind not null default 'non_working',
  created_at timestamptz not null default now()
);                                                 -- adm02:31-37
```

- Seeded at adm02seed:30-33.
- Grants: `select` (adm02:48), `insert, update, delete` (adm03:63).

### `public.busy_day`

```sql
create table public.busy_day (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null default auth.uid() references public.member (id) on delete restrict,
  date date not null,
  created_at timestamptz not null default now(),
  constraint busy_day_one_per_member_per_date unique (member_id, date)
);                                                  -- busy_day:54-65
create index busy_day_date_idx on public.busy_day (date);   -- busy_day:70
```

Grants: `select (id, member_id, date, created_at)`, `insert (date)`, `delete` (busy_day:80-82).

### `public.issue_report` (bug reports)

```sql
create table public.issue_report (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member(id) on delete restrict,
  kind public.issue_kind not null,
  message text not null,
  page text not null,
  status public.issue_status not null default 'open',
  created_at timestamptz not null default now(),
  images text[] not null default '{}',                                   -- issue_img:35-36
  constraint issue_report_message_not_blank check (btrim(message) <> ''),
  constraint issue_report_message_length   check (char_length(message) <= 2000),
  constraint issue_report_page_not_blank   check (btrim(page) <> ''),
  constraint issue_report_page_length      check (char_length(page) <= 200),
  constraint issue_report_images_bounded check (coalesce(array_length(images, 1), 0) <= 3 and '' <> all(images))  -- issue_img:66-69
);                                                                        -- issue:47-60
```

- Grants: `insert (member_id, kind, message, page, images)` (issue_img:78), `select` (issue:112),
  `update (status)` (issue:122).
- Storage bucket `issue-report`, private, 5 MiB (issue_img:100-111).
- `issue.sql` has no `begin/commit`, unlike the migrations around it.

### `public.event`

```sql
create table public.event (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references public.member(id),   -- no ON DELETE clause (NO ACTION)
  team_id uuid not null references public.team(id),                          -- set by trigger event_stamp (evt01:105)
  name text not null, description text null, location text null,
  start_date date not null, end_date date not null,
  scope public.event_scope not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  capacity integer null, requires_approval boolean not null default false, registration_deadline date null,  -- evt02:59-61
  constraint event_name_present check (btrim(name) <> ''),
  constraint event_dates_ordered check (end_date >= start_date),
  constraint event_capacity_positive check (capacity is null or capacity >= 1),                  -- evt02:66
  constraint event_deadline_by_end check (registration_deadline is null or registration_deadline <= end_date)  -- evt02:73-74
);                                                                            -- evt01:57-77
```

- Indexes: primary key only.
- Triggers: `event_stamp` (evt01:114), `event_capacity_guard` (evt02:320),
  `notify_event_created` / `notify_event_updated` / `notify_event_cancelled` (evt04:177/202/237).

### Event participant tables

```sql
create table public.event_invitee (event_id uuid not null references public.event(id) on delete cascade,
  member_id uuid not null references public.member(id), created_at timestamptz not null default now(),
  primary key (event_id, member_id));                                                        -- evt01:79-84
create table public.event_attendance (event_id uuid not null references public.event(id) on delete cascade,
  member_id uuid not null default auth.uid() references public.member(id),
  status public.attendance_status not null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), primary key (event_id, member_id));         -- evt02:78-89
create table public.event_guest_link (event_id uuid primary key references public.event(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  opened_at timestamptz not null default now(),
  constraint event_guest_link_token_shape check (token ~ '^[0-9a-f]{64}$'));                 -- evt06:37-43
create table public.event_guest (id uuid primary key default gen_random_uuid(),
  event_id uuid null references public.event(id) on delete set null, event_name text not null,
  name text not null, email text not null, manage_token_hash text not null unique,
  status public.guest_status not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint event_guest_name_shape check (btrim(name) = name and name <> '' and char_length(name) <= 100),
  constraint event_guest_email_shape check (btrim(email) = email and char_length(email) <= 254
                                            and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint event_guest_hash_shape check (manage_token_hash ~ '^[0-9a-f]{64}$'));            -- evt07:61-79
create unique index event_guest_event_email on public.event_guest (event_id, lower(email));   -- evt07:82
```

### `public.notification`

```sql
create table public.notification (id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.member(id), kind public.notification_kind not null,
  event_id uuid null references public.event(id) on delete set null, event_name text not null,
  actor_id uuid not null references public.member(id), created_at timestamptz not null default now(),
  read_at timestamptz null);                                                                -- evt04:70-82
create index notification_recipient_created on public.notification (recipient_id, created_at desc);  -- evt04:85
```

### Discrepancies between the migrations and `supabase/db.sql`

`db.sql` stops at roughly 2026-09-05 but calls itself "the whole schema" (db.sql:1).

1. **`member.team_id`**: `not null` in db.sql (around db.sql:146); the migrations dropped it
   (member_approval:50).
2. **`member` columns missing from db.sql**: `status`, `last_sign_in_at`, `email`,
   `event_email_enabled`.
3. **`team` columns missing from db.sql**: `wfh_need_approve`, `pto_need_approve`.
4. **`allowed_email`**: db.sql still creates the table (db.sql:157) and its three policies
   (db.sql:825/841/854). The migrations dropped it.
5. **Tables entirely missing from db.sql**: `busy_day`, `issue_report`, `event`, `event_invitee`,
   `event_attendance`, `event_guest_link`, `event_guest`, `notification`, with all their enums,
   triggers and functions.
6. **Functions missing from db.sql**:
   - `list_teams`, `list_all_members`, `create_team`, `rename_team`, `delete_team`,
     `admit_member`, `move_member`
   - `list_members_for_team`, `list_team_entries_for_team`, `list_team_entries_overlapping_for_team`
   - `set_member_role`, `entry_apply_approval_setting`
   - the sync triggers on `auth.users`
7. **Policies missing from db.sql**: `team_select_own` (cal04:36), `team_update_admin` (adm01:62),
   `member_update_own`, `member_select_pending_admin`, `member_decide_admin`.
8. **db.sql §9.1 and §9.2 are stale**: they say "`public.team` has no select policy … no update
   policy"; cal04 and adm01 added both.
9. **db.sql §9.3 is stale**: it says holidays are "not seeded"; adm02seed seeds them.
10. **Old function bodies in db.sql**: `is_admin` and `member_team_id` (db.sql:317/329) are the
    TEA-01 versions without `status = 'approved'` (member_approval:57-78).
11. **Admission trigger**: db.sql:343 is the TEA-01 version (reads the allow-list and assigns a
    team). The migrations insert `team_id null`.
12. **`member_role` enum**: db.sql:82 declares `('member','manager','admin')` directly; the
    migrations add `'manager'` with `alter type` (manager_role:36). Same result, different path.

---

## 2. Tenant scoping — every query touching the listed tables

General state:

- **There is no org-level key anywhere** in the schema or the code.
- **No client query filters `.eq("team_id", …)`.** Team scope comes either from RLS via
  `member_team_id(auth.uid())` or from `security definer` RPCs that take `p_team_id`.

Legend for the last column:

- **ISO-team**: returns only the caller's team. Safe by org too, if teams belong to one org.
- **⚠ CROSS**: the predicate is global or `is_admin`-only, so it would return another org's rows.
- **UNSURE**: not certain.

### entries (`public.entry`)

| file:line | Code | team_id? | org? | Verdict |
|---|---|---|---|---|
| supabase.ts:1865-1877 `createEntry` | `.from("entry").insert({ member_id: me.id, … })` | no; policy `entry_insert_own` `with check (member_id = (select auth.uid()))` cal01:214-216 | no | ISO (own entry only) |
| supabase.ts:1907-1914 `listOwnEntries` | `.from("entry").select(ENTRY_COLUMNS).eq("member_id", userData.user.id)` | no | no | ISO |
| supabase.ts:1233-1237, 1243-1248 `overlapFailure` | `.eq("id", excludeId)` / `.eq("member_id", owner).filter("date_range","ov",…)` | via RLS | no | ISO |
| supabase.ts:1962-1974 `updateEntry` | `.from("entry").update({…}).eq("id", entryId)` | RLS: `entry_update_own` / `entry_update_admin` / `entry_update_manager` compare `member_team_id(member_id) = member_team_id(auth.uid())` | no | ISO-team |
| supabase.ts:2000-2005 `deleteEntry` | `.from("entry").delete().eq("id", entryId)` | RLS `entry_delete_own` / `entry_delete_admin` (cal03:101) | no | ISO-team |
| supabase.ts:2042-2048 `listTeamEntries` | `.from("entry").select(ENTRY_COLUMNS).order(…).limit(TEAM_ENTRY_LIMIT)` | RLS `entry_select_team` (cal01:203-207) | no | ISO-team |
| supabase.ts:2437-2444 `listTeamEntriesOverlapping` | `.from("entry").select(ENTRY_COLUMNS,{count:"exact"}).filter("date_range","ov",…)` | RLS | no | ISO-team |
| supabase.ts:2804-2825 `listPendingEntries` | `.from("entry").select(…).eq("status","pending")` | RLS | no | ISO-team |
| supabase.ts:2887-2892 `approveEntry` | `.update({ status: "approved" }).eq("id", entryId)` | RLS | no | ISO-team |
| supabase.ts:2920-2925 `rejectEntry` | `.update({ status: "rejected", rejection_reason: reason }).eq("id", entryId)` | RLS | no | ISO-team |
| supabase.ts:2985-2988 `rejectEntries` → adm06:73-86 | `update public.entry set status = 'rejected'… where id = any (p_ids);` (security **invoker**) | RLS applies to the caller | no | ISO-team |
| supabase.ts:2234-2240 → cal11:45-52 `list_team_entries_for_team` | `where public.is_admin((select auth.uid())) and public.member_team_id(e.member_id) = p_team_id;` (definer) | client-supplied `p_team_id` | no | **⚠ CROSS**: any admin reads any team |
| supabase.ts:2268-2278 → cal11:56-65 `list_team_entries_overlapping_for_team` | same, plus `e.date_range && daterange(p_start, p_end, '[]')` | client-supplied `p_team_id` | no | **⚠ CROSS** |
| approval_settings:111-118 trigger `entry_apply_approval_setting` | `from public.member m join public.team t on t.id = m.team_id where m.id = new.member_id` | by the owner's team | no | ISO |
| mgr_gen_cols:20-136 trigger `entry_enforce_decision` | calls `may_decide(v_uid)` and `is_admin(v_uid)` with no team | no | no | Relies on the policies for the team boundary (see §7) |

### members (`public.member`)

| file:line | Code | team_id? | org? | Verdict |
|---|---|---|---|---|
| supabase.ts:1021-1025 `readMember` (used by `getOwnMember(userId)` and `getCurrentMember`) | `.from("member").select(MEMBER_COLUMNS).eq("id", userId).maybeSingle()` | RLS `member_select_own` / `member_select_team` | no | ISO-team. `userId` is caller-supplied but RLS still filters |
| supabase.ts:1523-1530 `listMembers` | `.from("member").select(MEMBER_COLUMNS).not("team_id","is",null)…` | RLS `member_select_team` (tea03:34-36) | no | ISO-team. An admin also sees pending sign-ups via `member_select_pending_admin`; `not team_id is null` excludes them |
| supabase.ts:1430-1436 `listPendingMembers` | `.from("member").select(…).is("team_id", null).eq("status","pending")` | RLS `member_select_pending_admin` (member_approval:138-144): `is_admin(...) and team_id is null and status <> 'approved'` | no | **⚠ CROSS**: the sign-up queue is global |
| supabase.ts:3107-3111 `countPendingMembers` | `.select("id",{count:"exact",head:true}).is("team_id", null).eq("status","pending")` | same | no | **⚠ CROSS** |
| supabase.ts:1461-1464 `decideMember` (approve) → many_teams:151-170 `admit_member` | `update public.member set status = 'approved', team_id = p_team_id where id = p_member_id and team_id is null and status = 'pending'` (definer, checks only `is_admin`) | client-supplied `p_team_id`; **no check that the admin belongs to that team** | no | **⚠ CROSS** |
| supabase.ts:1476-1481 `decideMember` (reject) | `.from("member").update({status:"rejected", team_id:null}).eq("id", memberId)` | RLS `member_decide_admin` (member_approval:153-167) | no | **⚠ CROSS** (any admin) |
| supabase.ts:1578-1583 `removeMember` | `.update({ removed_at: … }).eq("id", memberId)` | RLS `member_update_admin` (tea04:42-50) | no | ISO-team |
| supabase.ts:1609-1614 `setMemberTeam` | `.update({ team_id: teamId }).eq("id", memberId)` | RLS `member_update_admin` `with check (team_id = member_team_id(auth.uid()))`, **plus** `member_update_own` | no | ISO-team for an admin. **Not ISO for the person themselves** (see the ⚠ finding at the top) |
| supabase.ts:1699-1704 `updateOwnProfile` | `.update({ display_name, avatar }).eq("id", auth.user.id)` | RLS `member_update_own` | no | ISO |
| supabase.ts:3582-3586 `getEventEmailEnabled` | `.select("event_email_enabled").eq("id", auth.user.id)` | RLS | no | ISO |
| supabase.ts:3595 → evt05:84-91 `set_event_email` | `update public.member set event_email_enabled = p_enabled where id = (select auth.uid())` | — | no | ISO |
| supabase.ts:2188 → many_teams:64-71 `list_all_members` | `select m.* from public.member m where public.is_admin((select auth.uid())) and m.team_id is not null` | no | no | **⚠ CROSS** |
| supabase.ts:2211-2217 → cal11:33-40 `list_members_for_team` | `where public.is_admin((select auth.uid())) and m.team_id = p_team_id;` | client-supplied `p_team_id` | no | **⚠ CROSS** |
| supabase.ts:2357-2360 → many_teams:186-206 `move_member` | `update public.member set team_id = p_team_id where id = p_member_id and team_id is not null …` (checks only `is_admin`) | client-supplied `p_team_id` | no | **⚠ CROSS** (write) |
| supabase.ts:977 → cross_team_role:92-120 `set_member_role` | `update public.member m set role = p_role where m.id = p_member_id and m.team_id is not null and … and m.role <> 'admin'` | no | no | **⚠ CROSS** (write; can promote to admin) |
| supabase.ts:3285-3292 → evt01:154-163 `list_member_directory` | `select m.id, m.display_name, m.avatar, m.team_id, t.name from public.member m join public.team t … where public.member_team_id((select auth.uid())) is not null and m.status = 'approved' …` | no | no | **⚠ CROSS**: **every member** (not only admins) sees every member of every team |
| evt06:88-99 / evt07:300-322 `list_guest_event_attendees` (anon) | returns `display_name` of attending members, by token | by event | no | UNSURE: token-scoped, not tenant-scoped |
| evt05:103-163 `email_notification` | `join public.member r … join auth.users u …` on `new.recipient_id` | — | no | ISO, follows the notification |

### teams (`public.team`)

| file:line | Code | team_id? | org? | Verdict |
|---|---|---|---|---|
| supabase.ts:2092-2095 `getTeam` | `.from("team").select(TEAM_COLUMNS).maybeSingle()` | RLS `team_select_own` (cal04:36-38) | no | ISO-team |
| supabase.ts:2135-2140 `setOverloadThreshold` | `.update({ overload_threshold }).not("id","is",null)` | RLS `team_update_admin` (adm01:62-67) | no | ISO-team. No id is sent: every row the policy admits is updated |
| supabase.ts:2374-2379 `setApprovalSettings` | `.update({ wfh_need_approve, pto_need_approve }).not("id","is",null)` | same | no | ISO-team, same "update every admitted row" risk |
| supabase.ts:2174 → many_teams:53-59 `list_teams` | `select t.* from public.team t where public.is_admin((select auth.uid()))` | no | no | **⚠ CROSS** |
| supabase.ts:2326 → many_teams:81-96 `create_team` | `insert into public.team (name) values (btrim(p_name))` | — | no | **⚠ CROSS** (team belongs to no org) |
| supabase.ts:2340 → many_teams:102-119 `rename_team` | `update public.team set name = btrim(p_name) where id = p_team_id` | client-supplied `p_team_id` | no | **⚠ CROSS** |
| supabase.ts:2351 → many_teams:126-141 `delete_team` | `delete from public.team where id = p_team_id` | client-supplied `p_team_id` | no | **⚠ CROSS** |

### holidays (`public.holiday`)

| file:line | Code | Verdict |
|---|---|---|
| supabase.ts:2641-2648 `listHolidays` | `.from("holiday").select(…).gte("date",…).lte("date",…)`; policy `holiday_select_all … using (true)` adm02:58-59 | **⚠ CROSS**: global table, no team or org column |
| supabase.ts:2694-2698 `addHoliday` | `.from("holiday").insert({ date, name, kind })`; `with check (public.is_admin(...))` adm03:35-37 | **⚠ CROSS**: any team's admin writes the calendar everyone sees |
| supabase.ts:2723-2728 `updateHoliday` | `.update({…}).eq("id", holidayId)`; adm03:43-46 | **⚠ CROSS** |
| supabase.ts:2748-2753 `deleteHoliday` | `.delete().eq("id", holidayId)`; adm03:48-50 | **⚠ CROSS** |

### events (`event`, `event_invitee`)

| file:line | Code | Verdict |
|---|---|---|
| supabase.ts:3218-3224 `listEvents` | `.from("event").select(EVENT_COLUMNS)…`; policy `event_select_visible` evt02:332-346: `is_admin(...) or creator_id = … or scope = 'public' or (scope='team' and team_id = member_team_id(...)) or …` | **⚠ CROSS** on two branches: `is_admin` (an admin sees every event) and `scope = 'public'` (everyone sees it) |
| supabase.ts:3242-3246 `getEvent` | `.from("event").select(…).eq("id", eventId)` | **⚠ CROSS**, as above |
| supabase.ts:3495-3501 `listEventsForTeam(teamId)` | `.from("event").select(\`${EVENT_COLUMNS}, event_invitee(member_id)\`)…`, then filtered in JS by `eventsRelevantToTeam(…)` | **⚠ CROSS**: filtered only on the client |
| supabase.ts:261 → evt02:149-218 `save_event` (invoker) | `insert into public.event (name, …)`; `team_id` set by `event_stamp` from `member_team_id(new.creator_id)` (evt01:105) | ISO on insert. **On update: ⚠ CROSS**, because `event_update_manage` admits `is_admin` (evt01:276-285) |
| evt01:215-220 / evt02:192-197 (invitee check in `save_event`) | `where public.member_team_id(i.member_id) is null` → only requires the invitee to have a team | **⚠ CROSS**: members of other teams or orgs can be invited |
| supabase.ts:3324-3329 `deleteEvent` | `.from("event").delete().eq("id", eventId)`; `event_delete_manage` evt01:289-294 `… or public.is_admin(...)` | **⚠ CROSS** |
| supabase.ts:3259-3265 `listEventInvitees` | `.from("event_invitee").select("member_id").eq("event_id", eventId)`; `may_manage_event` (evt01:134-142 has `or public.is_admin(p_uid)`) | **⚠ CROSS** for an admin |
| evt01:306-311 policy `event_invitee_insert_manage` | `may_manage_event(...) and public.member_team_id(member_id) is not null` | **⚠ CROSS** |
| evt04:154-174 trigger `notify_event_created` | `select m.id from public.member m where … (new.scope = 'public' or member_team_id(m.id) = new.team_id)` | **⚠ CROSS**: a `public` event notifies every member of every team |
| evt04:97-112 `may_read_event` | includes `is_admin(p_uid)` and `scope='public'` | **⚠ CROSS** |

### event participants (`event_attendance`, `event_guest`, `event_guest_link`)

| file:line | Code | Verdict |
|---|---|---|
| supabase.ts:3353-3360 `listEventAttendance` | `.from("event_attendance").select(…).eq("event_id", eventId)`; policy evt02:352-362 | Follows event visibility: **⚠ CROSS** (public / admin) |
| supabase.ts:3380-3384 `joinEvent` | `.insert({ event_id: eventId })`; `is_event_audience` (evt02:112-125) includes `scope = 'public'` | **⚠ CROSS** (another org's public event) |
| supabase.ts:3405-3411, 3416-3422 `leaveEvent` | `.eq("event_id", eventId).eq("member_id", uid)` | ISO |
| supabase.ts:3439-3445 `decideAttendance` | `.update({ status }).eq("event_id", eventId).eq("member_id", memberId)`; `event_attendance_update_manage` → `may_manage_event` | **⚠ CROSS** for an admin |
| supabase.ts:3469-3475 `listOwnEventAttendance` | `.eq("member_id", auth.user.id)` | ISO |
| supabase.ts:3620-3624 / 3637-3641 / 3657-3662 `getEventGuestLink` / `openEventToGuests` / `closeEventToGuests` | `.from("event_guest_link")…eq("event_id", eventId)`; policies `may_manage_event` (evt06:52-65) | **⚠ CROSS** for an admin |
| supabase.ts:3799-3806 `listEventGuests` | `.from("event_guest").select(GUEST_COLUMNS).eq("event_id", eventId)`; policy evt07:454-463 | **⚠ CROSS** (`status = 'attending'` → anyone who can read the event sees them) |
| supabase.ts:3820-3824 → evt07:434-442 `list_event_guest_emails` | `where g.event_id = p_event_id and public.may_manage_event(p_event_id, (select auth.uid()))` | **⚠ CROSS**: another org's admin reads guests' email addresses (PII) |
| supabase.ts:3837-3842 `decideGuest` | `.from("event_guest").update({ status }).eq("id", guestId)`; evt07:468-474 | **⚠ CROSS** for an admin |
| supabase.ts:3677-3790 (`get_guest_event`, `list_guest_event_attendees`, `get_guest_event_terms`, `register_guest`, `get_guest_registration`, `cancel_guest_registration`), granted `to anon` (evt06:111-112, evt07:495-498) | token-scoped | UNSURE: no cross-tenant leak, but no org context either |
| evt02:232-292 / evt07:192-255 / evt02:301-317 / evt07:92-181 (guard triggers) | count attendance and guests by `event_id` | ISO, follows the event |

### bug reports (`issue_report` and storage)

| file:line | Code | Verdict |
|---|---|---|
| supabase.ts:3047-3051 upload | `.storage.from(ISSUE_BUCKET).upload(\`${uid}/…\`)`; issue_img:129-134 | ISO (writes only your own files) |
| supabase.ts:3059-3070 `createIssueReport` | `.from("issue_report").insert({ member_id: uid, … })`; issue:91-93 | ISO |
| supabase.ts:3087-3090 `countOpenIssueReports` | `.select("id",{count:"exact",head:true}).eq("status","open")`; `issue_report_select_admin using (public.is_admin(...))` issue:108-110 | **⚠ CROSS** |
| supabase.ts:3152-3158 `listIssueReports` | `.from("issue_report").select(…)` | **⚠ CROSS** |
| supabase.ts:3190-3195 `setIssueReportStatus` | `.update({ status }).eq("id", reportId)`; issue:129-132 | **⚠ CROSS** |
| supabase.ts:3127-3129 `issueImageUrls` | `.storage.from(ISSUE_BUCKET).createSignedUrls(paths, …)`; `issue_image_select_admin` issue_img:148-153 | **⚠ CROSS** |

### Tables outside the list that also carry team data

- `busy_day`:
  - `listTeamBusyDaysOverlapping` (supabase.ts:2528-2536) relies on RLS `busy_day_select_team`
    (busy_day:97-105): ISO-team.
  - `setOwnBusyDay` writes with `upsert` (supabase.ts:2602-2604) and deletes with
    `.delete().eq("date", …)` (supabase.ts:2610) without a member filter; only RLS
    `busy_day_delete_own` narrows it: ISO.
- `notification`: `listNotifications` (supabase.ts:3533-3539) and `countUnreadNotifications`
  (supabase.ts:3548-3551) rely on RLS `recipient_id = auth.uid()`: ISO.

---

## 3. Role checks and what each one actually means

### In the database (the real controls)

| Location | Check | Meaning |
|---|---|---|
| tea04:42-50 `member_update_admin` | `is_admin(...) and team_id = member_team_id(...)` | **manages this team** |
| cal03:80-88 `entry_update_admin`, cal03:101-106 `entry_delete_admin` | `is_admin(...) and member_team_id(member_id) = member_team_id(...)` | **manages this team** |
| adm01:62-67 `team_update_admin` (threshold, name, approval switches) | `id = member_team_id(...) and is_admin(...)` | **manages this team** |
| manager_role:90-99 `entry_update_manager` | `may_decide(...) and not is_admin(...) and <same team>` | team |
| mgr_gen_cols:49-61, 78-87 `entry_enforce_decision` | `may_decide(v_uid)`; `not is_admin(v_uid) and old.member_id = v_uid`; `not is_admin … and may_decide …` | Global role; the team comes from the policy. Admins are exempt from "no self-approval" |
| tea04:69 / profile_self_update:165 (trigger) | `old.role = 'admin' … raise 'an admin may not be demoted'` | Global invariant |
| member_approval:138-144 `member_select_pending_admin`, member_approval:153-167 `member_decide_admin` | `is_admin(...) and team_id is null …` | **operates the whole system** (shared sign-up queue) |
| many_teams:53-206 `list_teams`, `list_all_members`, `create_team`, `rename_team`, `delete_team`, `admit_member`, `move_member` | `is_admin(...)` | **manages the org**; today org = whole system |
| cal11:33-65 (three cross-team functions) | `is_admin(...)` | **manages the org** (today: whole system) |
| cross_team_role:98 `set_member_role` | `if not public.is_admin(...)` | **manages the org** (today: whole system) |
| adm03:35-50 `holiday_*_admin` | `is_admin(...)` | **operates the whole system** (national calendar) |
| issue:108-132, issue_img:148-153 | `is_admin(...)` | **operates the whole system** (product feedback) |
| evt01:134-142 `may_manage_event`, evt02:332-346 `event_select_visible`, evt01:276-294 `event_update_manage` / `event_delete_manage`, evt04:97-112 `may_read_event` | `or public.is_admin(...)` | **whole system**: an admin manages every event of every team |

**Distribution in the database:**

- 4 checks mean *team*.
- 3 groups mean *org*: the 7 team and member management RPCs, the 3 cross-team read RPCs, and
  `set_member_role`.
- 4 groups mean *system*: the sign-up pool, holidays, issue reports, and the event override.

With a single deployment today, *org* and *system* are the same thing in code. The classification
above is by the reach of the data each check touches.

### On the client (affordances, not controls)

| Location | Code | Meaning |
|---|---|---|
| `src/lib/roles.ts:24` | `export const mayAdminister = (role: MemberRole): boolean => role === "admin";` | global |
| `src/lib/roles.ts:36-37` | `role === "admin" \|\| role === "manager"` | global, no team parameter |
| `src/lib/roles.ts:46-49` `mayDecideEntriesOf` | role, plus "not the owner unless admin" | no team comparison |
| `src/lib/viewed-team.ts:61` | `if (role !== "admin") return { viewed: { kind: "own" }, dropParam: false };` | org (team picker) |
| `src/lib/viewed-team.ts:85` | `if (role !== "admin" \|\| teams.length <= 1) return [];` | org |
| `src/hooks/useViewedTeam.tsx:56,76` | `mayAdminister(member.role)` → `seam.listTeams()` | org |
| `src/components/AdminLayout.tsx:133-137` | `if (role !== "admin")` → open-report and sign-up badges | system |
| `src/components/AdminLayout.tsx:190-192` | `mayDecide(role) ? <AdminTabs …/>` | team |
| `src/components/AdminTabs.tsx:323` | `mayAdminister(role) ? ADMIN_TABS : ADMIN_TABS.filter((tab) => tab.forManager)` | mixed (see each route below) |
| `src/components/TopBar.tsx:274-283` | `mayDecide(role)` → `mayAdminister(role) ? "/admin" : "/entries/pending"` | team |
| `src/routes/AdminHub.tsx:72` | `if (!me \|\| me.role !== "admin")` | mixed |
| `src/routes/NewSignups.tsx:76` | `me.role !== "admin"` | system (sign-up pool) |
| `src/routes/Threshold.tsx:125` | `me.role !== "admin"` | team |
| `src/routes/Teams.tsx:81` | `me.role !== "admin"` | org |
| `src/routes/IssueReports.tsx:94` | `me.role !== "admin"` | system |
| `src/routes/TeamEntries.tsx:82` | `if (me.role !== "admin")` | team |
| `src/routes/PendingEntries.tsx:245` | `if (!me \|\| !mayDecide(me.role))` | team |
| `src/routes/PendingEntries.tsx:621` | `mayDecideEntriesOf(view.me, entry.memberId)` | team |
| `src/routes/EditEntry.tsx:88-91` | `const isAdmin = me?.role === "admin"; … isAdmin ? await seam.listTeamEntries() : await seam.listOwnEntries();` | team |
| `src/routes/MemberList.tsx:148-153` | `isAdmin ? seam.listAllMembers() : seam.listMembers(), isAdmin ? seam.listTeams() : …` | org |
| `src/routes/MemberList.tsx:349-350` `canRemove` | `me.role === "admin" && m.id !== me.id && m.teamId === me.teamId` | team |
| `src/routes/MemberList.tsx:351-352` `canPromote` | `me.role === "admin" && m.id !== me.id && m.role === "member"` | org (any team) |
| `src/routes/MemberList.tsx:365-366` `canSetManager` | `me.role === "admin" && m.id !== me.id && m.role !== "admin"` | org |
| `src/routes/Holidays.tsx:216` | `me.role === "admin"` | system |
| `src/routes/EventDetail.tsx:51-53` `mayEditEvent` | `me.id === event.creatorId \|\| me.role === "admin"` | system (no team comparison) |
| `src/components/EventAttendancePanel.tsx:68-79` | `case "named": return me.role === "admin" ? invitees.includes(me.id) : true;` | global |
| `src/routes/Teams.tsx:337` | `person.role === "admin" ? "Admin" : "Member"` | display only; managers are labelled "Member" |

The **router** (`src/App.tsx`) has no role-based guards. Every guard is on `membership.state`.

---

## 4. The cross-team seam (CAL-11, CAL-12, TEA-08)

### CAL-11

Three `security definer` functions (they bypass RLS) at cal11:33-65, each with the single predicate
`where public.is_admin((select auth.uid()))`. For example:

```sql
create or replace function public.list_members_for_team(p_team_id uuid) returns setof public.member
  language sql stable security definer set search_path = '' as $$
  select m.* from public.member m
   where public.is_admin((select auth.uid())) and m.team_id = p_team_id;
$$;
```

- `p_team_id` comes from the client and is checked against nothing except `is_admin`.
- Results include removed members and entry notes.
- `execute` is granted only to `authenticated` (cal11:71-73).

### CAL-12

Client-only:

- The `?team=` query parameter is read at `useViewedTeam.tsx:61` (`searchParams.get(TEAM_PARAM)`).
- It is honoured only when the role is admin (`viewed-team.ts:61`) and the id is in what
  `listTeams()` returned (`viewed-team.ts:66-67`).
- Reads go through `teamReadsFor` (`viewed-team.ts:120-143`), which calls `listMembersForTeam` /
  `listTeamEntriesOverlappingForTeam` / `listEventsForTeam`.
- "Read-only" is only `isReadOnly(viewed)` (`viewed-team.ts:90-92`), an affordance. What actually
  stops a write to another team is that every write policy compares against the caller's own
  `member_team_id(...)` (cal03:80-106, adm01:62-67, tea04:42-50).

### TEA-08

`set_member_role` (cross_team_role:92-120): `security definer`, gated by `is_admin`, and requires
only `m.team_id is not null and status approved and removed_at is null and role <> 'admin'`.
**There is no team condition.**

### The only thing keeping the seam in bounds

`public.is_admin(auth.uid())`. There is no org condition anywhere, because there is no org.

That gate depends on "nobody can grant themselves admin", and **that is broken** (the ⚠ finding at
the top). In addition, `set_member_role` lets any admin promote anyone on any team to admin
(`promoteMember` → `setRankThroughRpc(memberId, "admin", …)`, supabase.ts:1628-1634).

---

## 5. Privilege-escalation surface

### Which tables have RLS

RLS is enabled on every public table:

- `team`, `member` (tea01:138-139)
- `entry` (cal01:173)
- `holiday` (adm02:45)
- `busy_day` (busy_day:72)
- `issue_report` (issue:67)
- `event`, `event_invitee` (evt01:86-87)
- `event_attendance` (evt02:91)
- `notification` (evt04:88)
- `event_guest_link` (evt06:44)
- `event_guest` (evt07:84)

### Every policy in force

```sql
-- member
create policy member_select_own on public.member for select to authenticated using (id = (select auth.uid()));                              -- tea01:153-155
create policy member_select_team on public.member for select to authenticated using (team_id = public.member_team_id((select auth.uid())));  -- tea03:34-36
create policy member_update_admin on public.member for update to authenticated
  using (public.is_admin((select auth.uid())) and team_id = public.member_team_id((select auth.uid())))
  with check (team_id = public.member_team_id((select auth.uid())));                                                                        -- tea04:42-50
create policy member_update_own on public.member for update to authenticated
  using (id = (select auth.uid()) and removed_at is null) with check (id = (select auth.uid()));                                             -- profile_self_update:61-64
create policy member_select_pending_admin on public.member for select to authenticated
  using (public.is_admin((select auth.uid())) and team_id is null and status <> 'approved'::public.member_status);                            -- member_approval:138-144
create policy member_decide_admin on public.member for update to authenticated
  using (public.is_admin((select auth.uid())) and team_id is null and status = 'pending'::public.member_status)
  with check (public.is_admin((select auth.uid())) and ((status = 'approved'::public.member_status
     and team_id = public.member_team_id((select auth.uid()))) or (status = 'rejected'::public.member_status and team_id is null)));          -- member_approval:153-167
-- team
create policy team_select_own on public.team for select to authenticated using (id = public.member_team_id((select auth.uid())));          -- cal04:36-38
create policy team_update_admin on public.team for update to authenticated
  using (id = public.member_team_id((select auth.uid())) and public.is_admin((select auth.uid())))
  with check (id = public.member_team_id((select auth.uid())) and public.is_admin((select auth.uid())));                                    -- adm01:62-67
-- entry
create policy entry_select_team on public.entry for select to authenticated
  using (public.member_team_id(member_id) = public.member_team_id((select auth.uid())));                                                      -- cal01:203-207
create policy entry_insert_own on public.entry for insert to authenticated with check (member_id = (select auth.uid()));                    -- cal01:214-216
create policy entry_update_own on public.entry for update to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));                                                      -- cal02:134-137
create policy entry_delete_own on public.entry for delete to authenticated using (member_id = (select auth.uid()));                          -- cal02:148-150
create policy entry_update_admin on public.entry for update to authenticated
  using (public.is_admin((select auth.uid())) and public.member_team_id(member_id) = public.member_team_id((select auth.uid())))
  with check (public.member_team_id(member_id) = public.member_team_id((select auth.uid())));                                                -- cal03:80-88
create policy entry_delete_admin on public.entry for delete to authenticated
  using (public.is_admin((select auth.uid())) and public.member_team_id(member_id) = public.member_team_id((select auth.uid())));            -- cal03:101-106
create policy entry_update_manager on public.entry for update to authenticated
  using (public.may_decide((select auth.uid())) and not public.is_admin((select auth.uid()))
         and public.member_team_id(member_id) = public.member_team_id((select auth.uid())))
  with check (public.member_team_id(member_id) = public.member_team_id((select auth.uid())));                                                -- manager_role:90-99
-- holiday
create policy holiday_select_all on public.holiday for select to authenticated using (true);                                                -- adm02:58-59
create policy holiday_insert_admin on public.holiday for insert to authenticated with check (public.is_admin((select auth.uid())));         -- adm03:35-37
create policy holiday_update_admin on public.holiday for update to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));                                           -- adm03:43-46
create policy holiday_delete_admin on public.holiday for delete to authenticated using (public.is_admin((select auth.uid())));              -- adm03:48-50
-- busy_day
create policy busy_day_select_team on public.busy_day for select to authenticated using (exists (select 1 from public.member m
  where m.id = public.busy_day.member_id and m.team_id = public.member_team_id((select auth.uid()))));                                       -- busy_day:97-105
create policy busy_day_insert_own on public.busy_day for insert to authenticated
  with check (member_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null);                                  -- busy_day:119-124
create policy busy_day_delete_own on public.busy_day for delete to authenticated
  using (member_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null);                                        -- busy_day:131-136
-- issue_report + storage
create policy issue_report_insert_own on public.issue_report for insert to authenticated with check (member_id = (select auth.uid()));      -- issue:91-93
create policy issue_report_select_admin on public.issue_report for select to authenticated using (public.is_admin((select auth.uid())));    -- issue:108-110
create policy issue_report_update_admin on public.issue_report for update to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));                                           -- issue:129-132
create policy issue_image_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'issue-report' and (storage.foldername(name))[1] = (select auth.uid())::text);                                    -- issue_img:129-134
create policy issue_image_select_admin on storage.objects for select to authenticated
  using (bucket_id = 'issue-report' and public.is_admin((select auth.uid())));                                                               -- issue_img:148-153
-- event
create policy event_select_visible on public.event for select to authenticated using (
  public.member_team_id((select auth.uid())) is not null and (public.is_admin((select auth.uid())) or creator_id = (select auth.uid())
  or scope = 'public'::public.event_scope or (scope = 'team'::public.event_scope and team_id = public.member_team_id((select auth.uid())))
  or (scope = 'named'::public.event_scope and public.is_event_invitee(id, (select auth.uid())))
  or public.is_event_participant(id, (select auth.uid()))));                                                                                 -- evt02:332-346
create policy event_insert_own on public.event for insert to authenticated
  with check (creator_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null);                                 -- evt01:267-272
create policy event_update_manage on public.event for update to authenticated
  using ((creator_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null) or public.is_admin((select auth.uid())))
  with check ((creator_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null) or public.is_admin((select auth.uid())));  -- evt01:276-285
create policy event_delete_manage on public.event for delete to authenticated
  using ((creator_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null) or public.is_admin((select auth.uid())));  -- evt01:289-294
create policy event_invitee_select_manage on public.event_invitee for select to authenticated using (public.may_manage_event(event_id, (select auth.uid())));  -- evt01:299-301
create policy event_invitee_insert_manage on public.event_invitee for insert to authenticated
  with check (public.may_manage_event(event_id, (select auth.uid())) and public.member_team_id(member_id) is not null);                     -- evt01:306-311
create policy event_invitee_delete_manage on public.event_invitee for delete to authenticated using (public.may_manage_event(event_id, (select auth.uid())));  -- evt01:314-316
create policy event_attendance_select_visible on public.event_attendance for select to authenticated using (
  public.member_team_id((select auth.uid())) is not null and exists (select 1 from public.event e where e.id = event_id)
  and (status = 'attending'::public.attendance_status or member_id = (select auth.uid()) or public.may_manage_event(event_id, (select auth.uid()))));  -- evt02:352-362
create policy event_attendance_insert_own on public.event_attendance for insert to authenticated
  with check (member_id = (select auth.uid()) and public.is_event_audience(event_id, (select auth.uid())));                                 -- evt02:366-371
create policy event_attendance_update_manage on public.event_attendance for update to authenticated
  using (public.may_manage_event(event_id, (select auth.uid()))) with check (public.may_manage_event(event_id, (select auth.uid())));      -- evt02:376-379
create policy event_attendance_delete_own on public.event_attendance for delete to authenticated using (member_id = (select auth.uid())
  and public.member_team_id((select auth.uid())) is not null and status in ('pending'::public.attendance_status, 'attending'::public.attendance_status)
  and public.event_registration_open(event_id));                                                                                            -- evt02:384-391
-- notification
create policy notification_select_own on public.notification for select to authenticated
  using (recipient_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null);                                    -- evt04:398-403
create policy notification_update_own on public.notification for update to authenticated
  using (recipient_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null)
  with check (recipient_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null);                                -- evt04:406-415
-- guest
create policy event_guest_link_select_manage on public.event_guest_link for select to authenticated using (public.may_manage_event(event_id, (select auth.uid())));  -- evt06:53-55
create policy event_guest_link_insert_manage on public.event_guest_link for insert to authenticated with check (public.may_manage_event(event_id, (select auth.uid())));  -- evt06:58-60
create policy event_guest_link_delete_manage on public.event_guest_link for delete to authenticated using (public.may_manage_event(event_id, (select auth.uid())));  -- evt06:63-65
create policy event_guest_select_visible on public.event_guest for select to authenticated using (
  public.member_team_id((select auth.uid())) is not null and exists (select 1 from public.event e where e.id = event_id)
  and (status = 'attending'::public.guest_status or public.may_manage_event(event_id, (select auth.uid()))));                               -- evt07:454-463
create policy event_guest_update_manage on public.event_guest for update to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())))
  with check (public.may_manage_event(event_id, (select auth.uid())) and status <> 'cancelled'::public.guest_status);                       -- evt07:468-474
```

### Service role and other RLS bypasses

**The service role key appears nowhere in code.** The only client is created at `supabase.ts:726`:

```ts
if (!cached) cached = createClient(url(), anonKey());
```

The `send-event-email` edge function creates no Supabase client. It authenticates with a shared
header secret (`index.ts:64-67`) and is deployed with `--no-verify-jwt`.

One note outside the code: `.gitignore:18` records that a real `SUPABASE_SERVICE_ROLE_KEY` was once
committed at `5a29434`. The repository does not say whether that key has been rotated.

**The real RLS bypasses** are the `security definer` functions that `authenticated` or `anon` can
call:

- Team and member management: `list_teams`, `list_all_members`, `create_team`, `rename_team`,
  `delete_team`, `admit_member`, `move_member`.
- Cross-team reads: `list_members_for_team`, `list_team_entries_for_team`,
  `list_team_entries_overlapping_for_team`.
- `set_member_role`.
- Events: `list_member_directory`, `set_event_email`, `may_manage_event`, `may_read_event`,
  `is_event_audience`, `is_event_invitee`, `is_event_participant`, `event_registration_open`.
- Guests, callable by **anon**: `get_guest_event`, `list_guest_event_attendees`,
  `get_guest_event_terms`, `register_guest`, `get_guest_registration`, `cancel_guest_registration`.
- `list_event_guest_emails`.
- Trigger functions running as definer: `admit_allow_listed_member`, the `sync_*` functions,
  `event_stamp`, the `notify*` functions, `email_notification`, and the guards.

### Where identity comes from

- In SQL: always `auth.uid()` from the JWT.
- On the client:
  - `readCurrentMember` (supabase.ts:1034-1038) calls `client().auth.getUser()`, then reads the
    `member` row by `id`.
  - `toAuthUser` / `toSession` (supabase.ts:1042-1052) read only `id`, `email`,
    `email_confirmed_at` and `access_token`. No custom claims, `app_metadata` or `user_metadata`.
- Role and team always come from the `public.member` row.

### Can the client influence the team_id / member_id used for authorization?

**Yes, at these points:**

1. **The severe hole**: `member_update_own` plus the `update (role, status, team_id)` grant lets a
   person set their own `role`, `status` and `team_id` (see the ⚠ finding at the top).
2. `admit_member(p_member_id, p_team_id)`: any admin can put a sign-up into **any team**.
   - The RPC bypasses `member_decide_admin`'s `with check`.
   - The test at `tests/signup-confirmation.test.ts:195-211` is named "refuses an approval that
     names a team the admin is not on", but the mock (`mock.ts:1412`) only refuses a team that
     **does not exist**, so the test does not check what its name says.
3. `move_member` / `rename_team` / `delete_team` / `list_*_for_team`: client-supplied `p_team_id`,
   gated only by `is_admin`.
4. `save_event(p_invitee_ids)`: members of any team can be invited.
5. `decideAttendance(eventId, memberId, …)`: client-supplied `memberId`, checked by
   `may_manage_event`.

**No, at these points:**

- `entry.member_id` on insert: forced to `auth.uid()` by `with check`.
- `event.team_id`: set by the `event_stamp` trigger; the column has no grant.
- `busy_day.member_id` and `event_attendance.member_id`: take the `auth.uid()` default; the column
  has no insert grant.
- `issue_report.member_id`: forced by `with check`.
- `raw_user_meta_data` at sign-up only affects `display_name` and `avatar`; role is forced to
  `'member'` (avatar_images:70).

---

## 6. Routing and auth

### Current routes (`src/App.tsx`)

`<BrowserRouter>` at :88 has no `basename`. Routes:

- `/signup` :148, `/guest/:token` :153, `/guest/registration/:token` :157, `/signin` :163
- `/` (index) :236-254
- `/signups` :291, `/members` :294
- `/entries/new` :308, `/entries/:id/edit` :322, `/entries/team` :339, `/entries/pending` :361
- `/month` and `/month/:month` :378-379
- `/week` and `/week/:day` :394-395
- `/year`, `/year/:year`, `/year/:year/members` :422-424
- `/setting` :449, `/threshold` :452 (redirect)
- `/teams` :459, `/reports` :475, `/admin` :501
- `/holidays` and `/holidays/:year` :535/541
- `/events`, `/events/new`, `/events/:id`, `/events/:id/edit` :558-570
- `/profile` :589
- `*` :604 → `<Navigate to="/" replace />`

### Possible collisions with `/{org_code}`

**First path segments already in use:**

- App routes: `signup`, `signin`, `guest`, `signups`, `members`, `entries`, `month`, `week`,
  `year`, `setting`, `threshold`, `teams`, `reports`, `admin`, `holidays`, `events`, `profile`.
- Static and server paths:
  - `assets`: nginx `location /assets/` with `try_files $uri =404` (`docker/nginx.conf`).
  - `healthz`: `location = /healthz`.
  - `fonts`, `images`, `logo.svg`: from `public/`.
  - `index.html`.
  - Dev server only: `src`, `@vite`, `@fs`, `@id`, `node_modules`.

`location /` uses `try_files $uri $uri/ /index.html`, so an org_code equal to a static directory
name (`fonts`, `images`) would match the directory instead of falling through to the SPA.

### Sessions

- Issued by Supabase Auth through `signInWithPassword` (supabase.ts:1815-1818) and `signUp`
  (supabase.ts:1372-1376).
- `createClient` uses default options, so the session is kept in localStorage and refreshed
  automatically.
- **The app reads no custom claims.** The JWT carries only GoTrue's standard claims.
- `useSession.ts:72-93` derives the state from `getSession()` plus `getCurrentMember()`:
  `member-less`, `undecided` or `member`.

### Routes reachable without signing in

- `/signup`, `/signin`, `/guest/:token`, `/guest/registration/:token`.
- These render inside `BareLayout` when signed out and refuse inside the screen: `/signups`,
  `/members`, `/month*`, `/week*`, `/year*`, and the `/threshold` redirect.
- In the database, `anon` can call six guest RPCs (evt06:111-112, evt07:495-498).

---

## 7. Approval flow (ADM-04 / ADM-05 / ADM-06)

**ADM-04 (worklist):** `listPendingEntries` (supabase.ts:2804-2825) has no team filter. Its scope is
entirely RLS `entry_select_team`, i.e. the caller's own team. The worklist does **not** use the
CAL-11 cross-team seam.

**Who the approver is:** not stored on the entry; decided at write time.

- The approver must be an approved admin or manager (`may_decide`, manager_role:55-64) on the same
  team as the entry's owner (`entry_update_admin` cal03:80-88 or `entry_update_manager`
  manager_role:90-99).
- A manager may not decide their own entry (mgr_gen_cols:58-61).
- An admin may approve their own entry; this is known weakness 4 in
  `.ai/standards/rbac-and-security.md:251`.
- A manager may change only the four decision columns (mgr_gen_cols:78-87).

**Statuses:** `entry_status` is `'pending'`, `'approved'`, `'rejected'` (cal01:38).

On insert, the `entry_apply_approval_setting` trigger (approval_settings:102-129) moves an entry to
`approved` when the team does not require approval; in that case `approved_by := null` and
`approved_at := now()`.

Editing the dates, type, portion or tentative flag of an entry that is no longer pending sends it
back to `pending` (mgr_gen_cols:122-132).

**Is the actor recorded:** only half the time.

- **On approval**, the trigger records the actor:
  ```sql
  new.approved_by := v_uid; new.approved_at := now();
  ```
  (mgr_gen_cols:102-106).
- **On rejection there is no actor**:
  ```sql
  elsif new.status is distinct from 'approved' then new.approved_by := null; new.approved_at := null;
  ```
  (mgr_gen_cols:107-109). Only `rejection_reason` remains.
- Auto-approval records no actor either.
- There is no audit or change-history table.

**ADM-06:** `reject_entries` (adm06:73-86) is `security invoker`, so policies and triggers still run
as the caller. It records no actor.

---

## 8. Test coverage

- **Every test runs against the mock.** No test executes SQL or a real RLS policy:
  - No pgTAP and no `supabase/tests/`.
  - CI (`.github/workflows/verify.yml:39,51`) runs only vitest and Playwright.
  - Playwright is pinned to the mock: `VITE_DATA_SEAM: "mock"`, `VITE_SUPABASE_URL: ""`, enforced by
    `tests/e2e/seam.setup.ts:17,32`.
- The repository says so itself:
  - `tests/cross-team-reads.test.ts:6-8`: "AC-12's Supabase refusals are exercised by no test until
    a project is provisioned".
  - `tests/cross-team-role.test.ts:7-11`: "`tests/permission-model.test.ts` still does not exist".
- Isolation assertions exist, **but all of them run against the mock**:
  - `tests/entry-decision.test.ts:286-300`: "AC-17: an admin of another team may not decide this
    team's entries".
  - `tests/pending-entries.test.ts:182-183`.
  - `tests/seam-parity.test.ts:84-92`, `127-136`.
  - `tests/cross-team-reads.test.ts:52`, `117-174` (member, manager and removed member all get `[]`).
  - `tests/cross-team-role.test.ts:76`, `86`, `100`, `138`.
  - `tests/threshold.test.ts:130-137`.
  - `tests/approval-settings.test.ts:101-109`.
  - `tests/events.test.ts:207-221`, `485-505`.
  - `tests/event-attendance.test.ts:367-386`.
  - `tests/guest-link.test.ts:167-174`.
  - `tests/viewed-team.test.ts:179-183`.
  - e2e: `cal-03-admin-edit-entry.spec.ts:412-427`, `cal-04-month-view.spec.ts:159-167`,
    `cal-12-team-picker.spec.ts:111-121`.
- Some tests only scan migration text with regexes and never execute it:
  `tests/cross-team-reads.test.ts` around lines 186-255, `draft-entry.test.ts:299-342`.
- **The mock is looser than SQL**: `currentAdmin` (`mock.ts:366-369`) does not check
  `status === 'approved'`; the real `is_admin` does.
- **No test can catch the self-escalation hole**, because the mock's `updateOwnProfile` writes only
  name and avatar.
- **No test asserts "user A cannot read user B's data"** at the database level.

---

## What would break under each change

### a) Adding `org_id NOT NULL` to every table in section 2

- Sign-up stops creating a `member` row: the admission trigger inserts without `org_id`, and
  `exception when others` swallows the error — `avatar_images:63-79`
- A pending sign-up has no org to attach, since its `team_id` is null — `member_approval:50`, `avatar_images:66`
- `createEntry` sends no `org_id`, and the column-list insert grant does not include it — `supabase.ts:1865-1877`, `cal01:192`
- `entry_apply_approval_setting` joins through `m.team_id` with no org — `approval_settings:111-118`
- `create_team` inserts without `org_id` — `many_teams:93`
- The bootstrap inserts team and member without `org_id` — `supabase/bootstrap.sql:175`, `:186`
- The seed inserts without `org_id` — `supabase/seed.sql:51`, `:91`, `:182`, `:505`, `:548`, `:601`
- The account script updates member without `org_id` — `supabase/create-account.sql:152`
- The `holiday` seed inserts without `org_id`, and `unique(date)` becomes wrong across orgs — `adm02seed:30`, `adm02:33`
- `addHoliday` inserts without `org_id` — `supabase.ts:2694-2698`
- `save_event` inserts the event without `org_id`; `event_stamp` sets only `team_id` — `evt02:168-172`, `evt01:105`
- `joinEvent` has only an `insert (event_id)` grant — `evt02:406`, `supabase.ts:3380-3384`
- `save_event` inserts `event_invitee` without `org_id` — `evt02:206-213`
- `register_guest` (anon) inserts `event_guest` without `org_id` — `evt07:373-375`
- `notify()` inserts `notification` without `org_id` — `evt04:133-142`
- `createIssueReport` has no `org_id`, and the grant is column-scoped — `supabase.ts:3059-3070`, `issue_img:78`
- `setOwnBusyDay` has only an `insert (date)` grant — `busy_day:81`, `supabase.ts:2602-2604`
- Existing rows: `ADD COLUMN … NOT NULL` without a default fails on a non-empty table — every table in §1
- Client types and the mock do not know `org_id`, and seam parity with them — `src/lib/domain/types.ts`, `src/lib/data/mock.ts`, `src/lib/fixtures.ts`
- `db.sql` is already out of date and drifts further — `supabase/db.sql`

### b) Splitting `admin` into `org_admin` (own org only) and `system_admin` (cross-org)

- The enum value `'admin'` and the rank order — `tea01:22`, `manager_role:36`
- `is_admin` has no org parameter and is called in about 25 policies and functions — `member_approval:69-78`
- `may_decide` hardcodes `in ('admin','manager')` — `manager_role:62`
- The trigger refusing demotion of `'admin'` becomes ambiguous between the two kinds — `profile_self_update:165`
- `set_member_role` has `m.role <> 'admin'` and can promote to `'admin'` — `cross_team_role:108`, `supabase.ts:1628-1634`
- The bootstrap writes `'admin'::public.member_role` — `supabase/bootstrap.sql:193`
- A `system_admin` has no `member` row or team, so lands on the member-less screen (NotOnATeam) — `src/hooks/useSession.ts:89-93`
- `list_teams`, `list_all_members`, `create_team`, `rename_team`, `delete_team`, `admit_member`, `move_member`: an `org_admin` would see and change every org — `many_teams:53-206`
- Cross-team reads are not bounded by org — `cal11:33-65`
- The sign-up queue is global and has no org — `member_approval:138-167`
- Holidays need an owner (system or org) — `adm03:35-50`
- Issue reports: an `org_admin` would read other orgs' reports — `issue:108-132`, `issue_img:148-153`
- `may_manage_event` and `event_select_visible` have an `is_admin` branch — `evt01:134-142`, `evt02:332-346`
- The `MemberRole` type — `src/lib/domain/types.ts:21`
- `mayAdminister` and `ROLE_LABELS` — `src/lib/roles.ts:24`, `:59`
- The admin-only team picker — `src/lib/viewed-team.ts:61`, `:85`
- The `me.role !== "admin"` checks — `AdminHub.tsx:72`, `NewSignups.tsx:76`, `Threshold.tsx:125`, `Teams.tsx:81`, `IssueReports.tsx:94`, `TeamEntries.tsx:82`, `Holidays.tsx:216`
- `canPromote`, `canSetManager`, `canRemove` — `src/routes/MemberList.tsx:148-153`, `349-366`
- `mayEditEvent` — `src/routes/EventDetail.tsx:51-53`
- The `named` branch keyed on the admin role — `src/components/EventAttendancePanel.tsx:77`
- `currentAdmin`, `eventIsAdmin`, `setRank` — `src/lib/data/mock.ts:366-369`, `661-662`, `413-431`

### c) A per-team `manager` role that can approve only within its team

- `role` is one column on `member`, not per team — `tea01:36`
- A user on several teams cannot be represented, since `member.team_id` holds one value — `tea01:33`
- `member_team_id()` returns exactly one uuid and sits in almost every policy — `member_approval:57-63`
- Entries have no `team_id`, so an entry's team is ambiguous when its owner is on several teams — `cal01:45-97`
- `entry_select_team`, `entry_update_manager`, `entry_update_admin` — `cal01:203-207`, `manager_role:90-99`, `cal03:80-106`
- `may_decide(p_uid)` has no team parameter — `manager_role:55-64`
- The trigger checks `may_decide(v_uid)` without a team — `mgr_gen_cols:49-61`, `78-87`
- `entry_apply_approval_setting` reads the approval switches from a single team — `approval_settings:111-118`
- `set_member_role` sets a global role — `cross_team_role:92-120`
- `mayDecide(role)` and `mayDecideEntriesOf` have no team parameter — `src/lib/roles.ts:36-49`
- The worklist gate `mayDecide(me.role)` — `src/routes/PendingEntries.tsx:245`, `:621`
- `mayDecide(role)` decides whether the tab and link appear — `src/components/AdminLayout.tsx:190`, `src/components/TopBar.tsx:274`
- `forManager` is computed globally — `src/components/AdminTabs.tsx:323`
- `getTeam()` uses `.maybeSingle()` and errors when a user can see more than one team — `supabase.ts:2092-2095`
- `listMembers` / `member_select_team` assume one team — `supabase.ts:1523-1530`, `tea03:34-36`
- Busy days and event visibility key on `member_team_id` — `busy_day:97-136`, `evt02:112-125`, `evt02:332-346`
- `deciderMayReach`, `memberTeamId` — `src/lib/data/mock.ts:1127-1168`

### d) Moving the overload threshold config to per-team

**The threshold is already per team:** the column `team.overload_threshold` (`tea01:27`). The change
itself breaks no schema. What breaks once a person manages or belongs to more than one team:

- `setOverloadThreshold` sends no id, so it updates every team the policy admits — `supabase.ts:2135-2140`
- `setApprovalSettings` carries the same risk — `supabase.ts:2374-2379`
- `team_update_admin` is tied to the single-valued `member_team_id` — `adm01:62-67`
- `getTeam().maybeSingle()` errors with more than one team — `supabase.ts:2092-2095`
- The Threshold screen reads only the caller's own team — `src/routes/Threshold.tsx:125-145`, `:252`
- The overload warning always uses the caller's own `getTeam()`, even while another team is viewed — `src/hooks/usePageOverload.ts:118-135`, `src/components/OverloadWarning.tsx:199`

### e) Serving every authenticated page under `/{org_code}`

- `BrowserRouter` has no `basename`, and every route is an absolute path — `src/App.tsx:88`, `:148-604`
- The catch-all `*` route redirects to `/` — `src/App.tsx:604`
- The calendar-path regex is anchored at `^\/` — `src/lib/viewed-team.ts:74`
- `isAdminAddress` / `ADMIN_ADDRESSES` — `src/components/AdminTabs.tsx:251-271`
- `periodNavFor(pathname)` — `src/lib/period.ts`
- `navigate("/signin")` and absolute links — `src/components/Sidebar.tsx:293`, `src/components/TopBar.tsx:278-307`, `src/components/BrandLogo.tsx:31`, `src/components/AuthCard.tsx:60`, `:68`
- Redirects that build absolute paths — `src/routes/MonthView.tsx:512`, `src/routes/WeekView.tsx:577`
- Guest links carry no org — `src/routes/EventDetail.tsx:57`, `src/routes/GuestEvent.tsx:48`
- Email links carry no org — `supabase/functions/send-event-email/template.ts:197`
- Static paths `assets`, `healthz`, and `try_files $uri/` (collides with `fonts`, `images`) — `docker/nginx.conf`
- The e2e specs hardcode absolute paths — `tests/e2e/*.spec.ts`

### f) Read-only impersonation: a system_admin acting inside an org, time-boxed and logged

- Every policy uses `auth.uid()`; there is no notion of "acting as" — all migrations in §5
- Authorization is by the shared `authenticated` role, with nothing that can tell a read-only session from a writing one — the grants in §1
- Identity is hard-wired to `getUser()` and then the `member` row by `id` — `supabase.ts:1034-1038`
- The session carries only `id`, `email` and the token, with no claim that could carry a time box — `supabase.ts:1042-1052`
- `useSession` derives its state from the caller's own `member` row — `src/hooks/useSession.ts:72-93`
- "Read-only" today is only an affordance — `src/lib/viewed-team.ts:90-92`
- There is no audit or log table anywhere; the only actor fields are `approved_by` and `notification.actor_id` — `mgr_gen_cols:102-106`, `evt04:78`
- The definer functions are gated only by `is_admin` — `cal11:33-65`, `many_teams:53-206`
- The mock sets identity from `currentMemberId`, read from localStorage — `src/lib/data/mock.ts:244-310`