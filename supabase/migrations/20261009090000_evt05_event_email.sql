-- EVT-05. A person is emailed when an event for their team is created, when they are invited, and
-- when their request is decided.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's to EVT-04's. `tests/permission-model
-- .test.ts` against a real PostgreSQL is still owed project-wide (.ai/standards/rbac-and-security.md
-- § Known weaknesses 1). `tests/event-email.test.ts` asserts the recipient rule and the switch against
-- the MOCK seam, which reproduces them, and reads this file for its shape; it cannot prove it.
--
-- Decided by ADR-051 (ACCEPTED by the operator) and ADR-053 (ACCEPTED by tech-lead-design). The names
-- and shapes are 01-plan.md § 4.3's, transcribed; the permission table they hold is § 3's.
--
-- **THE DATABASE DECIDES WHO IS MAILED; THE SENDER DECIDES NOTHING** (ADR-051 decision 2, ADR-053
-- decisions 2 and 3). An email is handed over only for a `public.notification` row EVT-04 already
-- wrote — so only ever to someone who can read the event, never to the actor, never for a write with
-- no signed-in person, and once per row. The one rule added here: the recipient's switch is on, the
-- recipient has an address, and an `event_created` row is for an OWN-TEAM event (Q3 — not public).
--
-- **NOTHING IN `src/` CALLS THE SENDER** (ADR-051 decision 3). The request goes from the trigger
-- below through `pg_net`, authenticated with a shared secret held in Vault.
--
-- **A FAILED HAND-OFF NEVER FAILS THE WRITE** (AC-12, ADR-053 decision 6). The whole body of
-- `email_notification()` sits inside `exception when others`, and it returns `new` on every path. No
-- Vault secret, no `pg_net`, an unreachable sender: the user's write commits and its in-app
-- notifications are written, and the email is not sent and never retried.
--
-- **`public.member`: ONE COLUMN ADDED, AND NO POLICY CREATED, DROPPED OR REPLACED.** There is NO
-- `update` GRANT ON `event_email_enabled`, to anybody: `member_update_admin` lets an admin update any
-- row of their team, so a column grant would let an admin turn a colleague's email off (01-plan.md
-- § 3, § 8 alternative 2). The only writer is `set_event_email`, a definer function that writes the
-- caller's own row and nothing else. `member_enforce_role_and_removal` is untouched.
--
-- **EVT-04 IS UNTOUCHED** — `notify`, `may_read_event`, the seven `notify_*` triggers and
-- `mark_notifications_read` are read, not replaced. The trigger below is additional, `after insert`.
--
-- **IDEMPOTENT** in the shape ADR-024 requires: `create extension if not exists`, `add column if not
-- exists`, `create or replace` for functions, `drop trigger if exists` then `create`. One transaction.
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).
--
-- ---------------------------------------------------------------------------------------------
-- THE HUMAN STEPS, IN ORDER (RULE-09). Until all of them are done nothing is mailed and nothing fails.
-- ---------------------------------------------------------------------------------------------
--   1. Apply this migration.
--   2. Add two variables to the gitignored `supabase/functions/.env`, beside the five already there:
--        APP_URL=<the application's address, e.g. https://calechip.example — no trailing slash needed>
--        EMAIL_HOOK_SECRET=<a long random string>
--   3. supabase secrets set --env-file supabase/functions/.env
--   4. supabase functions deploy send-event-email --no-verify-jwt
--      (the function checks its own secret; the platform's JWT check is off for it — ADR-053.)
--   5. In the SQL editor, the two Vault secrets this trigger reads:
--        select vault.create_secret('<the function URL>', 'event_email_function_url');
--        select vault.create_secret('<the same value as EMAIL_HOOK_SECRET>', 'event_email_hook_secret');
--   6. One real send — create an own-team event with a second approved member on the team — to
--      confirm Gmail on port 465 from the hosted Edge Runtime. TODO(verify).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The extension. `pg_net` creates its own `net` schema. TODO(verify) against the hosted project.
-- ---------------------------------------------------------------------------------------------

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------------------------
-- 2. The switch. AC-7: `default true` covers every existing row and every future admission.
-- ---------------------------------------------------------------------------------------------

alter table public.member
  add column if not exists event_email_enabled boolean not null default true;

-- NO GRANT FOLLOWS. The table-level grant on `member` is `select` only (TEA-01); every update grant
-- on it names its columns. This revoke is a statement of intent, not the fence — a column revoke does
-- not undo a table-level grant, and none exists to undo.
revoke update (event_email_enabled) on public.member from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. The only writer (AC-14, AC-15). No member-id parameter, and there must never be one: the row
--    written is `auth.uid()`'s, and a removed member writes nothing. Returns the saved value, or
--    null when no row was written.
-- ---------------------------------------------------------------------------------------------

create or replace function public.set_event_email(p_enabled boolean) returns boolean
  language sql volatile security definer set search_path = '' as $$
  update public.member
     set event_email_enabled = p_enabled
   where id = (select auth.uid())
     and removed_at is null
  returning event_email_enabled;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. The hand-off (AC-1 to AC-6, AC-12). One request per email-kind notification, through `pg_net`.
-- ---------------------------------------------------------------------------------------------
-- In order: the two Vault secrets (either missing → nothing); the body, from the row, the recipient's
-- member row and `auth.users` address, the event and the actor's member row, WHERE the switch is on,
-- the address exists, and an `event_created` row is for an own-team event (no row → nothing); then
-- the post. TODO(verify) `net.http_post`'s parameter names against the installed `pg_net`. The queued
-- request is a row in `pg_net`'s own table, so a write that rolls back takes its email with it —
-- TODO(verify).

create or replace function public.email_notification() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
  v_body   jsonb;
begin
  begin
    select s.decrypted_secret into v_url
      from vault.decrypted_secrets s
     where s.name = 'event_email_function_url';
    select s.decrypted_secret into v_secret
      from vault.decrypted_secrets s
     where s.name = 'event_email_hook_secret';
    if v_url is null or v_secret is null then
      return new;
    end if;

    select jsonb_build_object(
             'notificationId', new.id,
             'kind',           new.kind::text,
             'to',             u.email,
             'recipientName',  r.display_name,
             'actorName',      a.display_name,
             'event', jsonb_build_object(
               'id',        e.id,
               'name',      e.name,
               'startDate', to_char(e.start_date, 'YYYY-MM-DD'),
               'endDate',   to_char(e.end_date, 'YYYY-MM-DD'),
               'location',  e.location
             )
           )
      into v_body
      from public.member r
      join auth.users u    on u.id = new.recipient_id
      join public.event e  on e.id = new.event_id
      join public.member a on a.id = new.actor_id
     where r.id = new.recipient_id
       and r.event_email_enabled
       and u.email is not null
       and (new.kind <> 'event_created'::public.notification_kind
            or e.scope = 'team'::public.event_scope);

    if v_body is null then
      return new;
    end if;

    perform net.http_post(
      url     := v_url,
      body    := v_body,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-event-email-secret', v_secret
                 )
    );
  exception when others then
    raise warning 'event email not queued for notification %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- The five kinds of ADR-051 decision 4, and no others. `event_updated`, `event_cancelled`,
-- `attendance_requested` and `attendance_withdrawn` stay in-app only (AC-4).
drop trigger if exists email_notification on public.notification;
create trigger email_notification
  after insert on public.notification
  for each row
  when (new.kind in ('event_created', 'event_invited',
                     'attendance_approved', 'attendance_rejected', 'attendance_removed'))
  execute function public.email_notification();

-- ---------------------------------------------------------------------------------------------
-- 5. Grants. Supabase grants EXECUTE on new functions to `anon` by default, which `from public` does
--    not remove — so both are named. The trigger function returns `trigger` and cannot be called
--    through PostgREST; it is granted as EVT-04 grants its seven.
-- ---------------------------------------------------------------------------------------------

revoke all on function public.set_event_email(boolean) from public, anon;
revoke all on function public.email_notification() from public, anon;

grant execute on function public.set_event_email(boolean) to authenticated;
grant execute on function public.email_notification() to authenticated;

commit;
