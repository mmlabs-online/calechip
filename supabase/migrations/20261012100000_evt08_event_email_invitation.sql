-- EVT-08. The creator or an admin of a public event invites people by email from the event's page,
-- and each address is mailed once.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's to EVT-07's. `tests/permission-model
-- .test.ts` against a real PostgreSQL is still owed project-wide (.ai/standards/rbac-and-security.md
-- § Known weaknesses 1). `tests/event-invitation.test.ts` asserts the permission table against the
-- MOCK seam, which reproduces it, and reads this file for its shape; it cannot prove it.
--
-- Decided by ADR-055 (ACCEPTED by the operator). The names and shapes are 01-plan.md § 4.3's,
-- transcribed; the permission table they hold is § 3's.
--
-- **THE INVITER NEVER LEARNS WHO IS A MEMBER** (AC-7, ADR-055 revert condition 1). `invite_to_event`
-- answers from the invitation table alone — `sent` if this call inserted the row, `ignored` if it was
-- there — and NO BRANCH OF IT READS `public.member` OR `auth.users`. The member lookup happens only in
-- `email_invitation()`, an after-insert trigger whose whole body sits inside `exception when others`
-- and whose only effect is a `pg_net` request. The table has no column for the version sent, for the
-- member, or for whether a mail left.
--
-- **NOTHING IN `src/` CALLS THE SENDER** (ADR-051 decision 3, ADR-055 decision 7). The request goes
-- from the trigger below through `pg_net`, with EVT-05's shared secret from Vault, to the same
-- `send-event-email` function, which gains a second request shape.
--
-- **A FAILED HAND-OFF NEVER FAILS THE INVITATION** (EVT-05 AC-12's rule). No Vault secret, no
-- `pg_net`, an unreachable sender: the row commits, the inviter reads `sent`, and the mail is not sent
-- and never retried. A `warning` in the database log is the only trace.
--
-- **NOTHING EXISTING IS REPLACED.** `event_guest_link`, its policies, `email_notification()`, every
-- `notify_*` trigger and every policy on `public.member` are read, not changed (INV-04). Inserting into
-- `event_guest_link` from the definer function fires nothing — EVT-06 put no trigger on it.
--
-- **IDEMPOTENT** in the shape ADR-024 requires: `create table if not exists`, `create unique index if
-- not exists`, `drop policy if exists` then `create`, `create or replace` for functions, `drop trigger
-- if exists` then `create`. One transaction.
--
-- **ONE MORE CUSTOM SQLSTATE PAIR**, beside EVT-02's and EVT-07's `EV001`–`EV007`: `EV008` (nothing
-- entered, or an address over 254 characters or not of the shape) and `EV009` (the event is not
-- public-scope).
--
-- `supabase/db.sql` is NOT updated here — MD-033 owns bringing it level (01-plan.md § 6).
--
-- ---------------------------------------------------------------------------------------------
-- THE HUMAN STEPS, IN ORDER (RULE-09). NO STEP BEYOND APPLYING IT AND REDEPLOYING IS NEEDED: the Vault
-- secrets and the function's environment are EVT-05's.
-- ---------------------------------------------------------------------------------------------
--   1. Apply this migration.
--   2. supabase functions deploy send-event-email --no-verify-jwt
--      (`template.ts` and `index.ts` changed; until it is redeployed an invitation's request is a 400
--      and nothing is mailed — the invitation itself still commits.)

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The table. One row per address per event, kept indefinitely (Q9-A).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.event_email_invitation (
  id          uuid primary key default gen_random_uuid(),
  -- AC-14. SET NULL, NOT CASCADE: kept indefinitely (Q9-A, ADR-052 decision 8's terms).
  event_id    uuid null references public.event(id) on delete set null,
  email       text not null,
  invited_by  uuid not null references public.member(id),
  created_at  timestamptz not null default now(),
  constraint event_email_invitation_email_shape check (
    btrim(email) = email and char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- AC-6. One per address per event, ignoring case. The control for the race: two submissions with the
-- same address insert it once, and the other's `on conflict do nothing` reads `ignored`.
create unique index if not exists event_email_invitation_event_email
  on public.event_email_invitation (event_id, lower(email));

alter table public.event_email_invitation enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 2. The only door. SECURITY DEFINER; takes no token, no inviter, no time and no version (§ 3).
-- ---------------------------------------------------------------------------------------------
-- In order, nothing written before step 4: may manage (42501 — the same answer for an event that does
-- not exist or that the caller cannot read, AC-3); public scope (EV009, AC-4); every address trimmed,
-- empties dropped, none left or any malformed (EV008, the whole submission, AC-10). Then the guest
-- link is opened or reopened with a database-chosen token (AC-5), and each distinct address — ignoring
-- case, first spelling kept, first-entered order — is inserted or found already there (AC-6).
--
-- **NO BRANCH OF THIS FUNCTION READS `public.member` OR `auth.users`** (AC-7, 01-plan.md § 6).
create or replace function public.invite_to_event(p_event_id uuid, p_emails text[])
  returns table (email text, outcome text)
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_scope public.event_scope;
  v_addr  text;
  v_clean text[] := '{}'::text[];
  v_seen  text[] := '{}'::text[];
  v_id    uuid;
begin
  if v_uid is null or not coalesce(public.may_manage_event(p_event_id, v_uid), false) then
    raise exception 'event_not_permitted' using errcode = '42501';
  end if;

  -- `for share`: a scope change or a delete waits for this submission to finish (AC-4).
  select e.scope into v_scope from public.event e where e.id = p_event_id for share;
  if v_scope is distinct from 'public'::public.event_scope then
    raise exception 'invitation_not_public' using errcode = 'EV009';
  end if;

  foreach v_addr in array coalesce(p_emails, '{}'::text[]) loop
    v_addr := btrim(coalesce(v_addr, ''));
    continue when v_addr = '';
    if char_length(v_addr) > 254
       or v_addr !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'invalid_invitation_email' using errcode = 'EV008';
    end if;
    if not (lower(v_addr) = any (v_seen)) then
      v_seen  := v_seen || lower(v_addr);
      v_clean := v_clean || v_addr;
    end if;
  end loop;
  if cardinality(v_clean) = 0 then
    raise exception 'invalid_invitation_email' using errcode = 'EV008';
  end if;

  -- AC-5. Opens a closed event, keeps an open one's link. EVT-06's opener, by a new path (ADR-055
  -- decision 2); the token and the time are the column defaults.
  insert into public.event_guest_link (event_id) values (p_event_id)
  on conflict (event_id) do nothing;

  foreach v_addr in array v_clean loop
    v_id := null;
    insert into public.event_email_invitation (event_id, email, invited_by)
    values (p_event_id, v_addr, v_uid)
    on conflict do nothing
    returning id into v_id;
    email   := v_addr;
    outcome := case when v_id is null then 'ignored' else 'sent' end;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. The hand-off (AC-8, AC-9). One request per new row at most, through `pg_net`.
-- ---------------------------------------------------------------------------------------------
-- In order: the two Vault secrets (either missing → nothing); the event and the inviter's display
-- name; then the member, if any, whose sign-in address equals this one ignoring case and who is
-- approved and not removed. Found: nothing when they are the inviter or their event email is off,
-- otherwise the member version. Not found: the event's guest token (none → nothing) and the guest
-- version. Then the post, exactly as `email_notification()` posts. Returns `new` on every path and
-- raises nothing a caller sees.
create or replace function public.email_invitation() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_url          text;
  v_secret       text;
  v_event        jsonb;
  v_inviter      text;
  v_member_id    uuid;
  v_member_name  text;
  v_member_email text;
  v_member_on    boolean;
  v_token        text;
  v_body         jsonb;
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
             'id',        e.id,
             'name',      e.name,
             'startDate', to_char(e.start_date, 'YYYY-MM-DD'),
             'endDate',   to_char(e.end_date, 'YYYY-MM-DD'),
             'location',  e.location
           )
      into v_event
      from public.event e
     where e.id = new.event_id;
    select m.display_name into v_inviter
      from public.member m
     where m.id = new.invited_by;
    if v_event is null or v_inviter is null then
      return new;
    end if;

    select m.id, m.display_name, u.email, m.event_email_enabled
      into v_member_id, v_member_name, v_member_email, v_member_on
      from public.member m
      join auth.users u on u.id = m.id
     where lower(u.email) = lower(new.email)
       and m.status = 'approved'::public.member_status
       and m.removed_at is null
     limit 1;

    if v_member_id is not null then
      -- AC-9. Never to the inviter; only with event email on (Q6-B, idea assumption 5).
      if v_member_id = new.invited_by or not v_member_on or v_member_email is null then
        return new;
      end if;
      v_body := jsonb_build_object(
                  'invitationId',  new.id,
                  'kind',          'invitation_member',
                  'to',            v_member_email,
                  'inviterName',   v_inviter,
                  'recipientName', v_member_name,
                  'event',         v_event,
                  'guestToken',    null::text
                );
    else
      -- AC-8. The link `invite_to_event` just opened, or the one already open.
      select l.token into v_token
        from public.event_guest_link l
       where l.event_id = new.event_id;
      if v_token is null then
        return new;
      end if;
      v_body := jsonb_build_object(
                  'invitationId',  new.id,
                  'kind',          'invitation_guest',
                  'to',            new.email,
                  'inviterName',   v_inviter,
                  'recipientName', null::text,
                  'event',         v_event,
                  'guestToken',    v_token
                );
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
    -- The id only — never the address, the token or the body.
    raise warning 'event invitation email not queued for invitation %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists email_invitation on public.event_email_invitation;
create trigger email_invitation
  after insert on public.event_email_invitation
  for each row
  execute function public.email_invitation();

-- ---------------------------------------------------------------------------------------------
-- 4. Policy. `to authenticated`, `(select auth.uid())` wrapped, drop-then-create. Read by the
--    creator (still approved) and admins — `may_manage_event`, NEVER `may_decide` (AC-12, AC-13). A
--    deleted event's rows have a null `event_id` and are read by nobody. No insert, update or delete
--    policy: `invite_to_event` is the only writer, and nothing deletes or edits a row (AC-14).
-- ---------------------------------------------------------------------------------------------
drop policy if exists event_email_invitation_select_manage on public.event_email_invitation;
create policy event_email_invitation_select_manage on public.event_email_invitation
  for select to authenticated
  using (event_id is not null and public.may_manage_event(event_id, (select auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- 5. Grants. Explicit, never inherited (EVT-01 § 7's reason). Supabase grants EXECUTE on new
--    functions to `anon` by default, which `from public` does not remove — so both are named. The
--    trigger function returns `trigger` and cannot be called through PostgREST; it is granted as
--    EVT-05 grants `email_notification()`.
-- ---------------------------------------------------------------------------------------------
revoke all on public.event_email_invitation from anon, authenticated;
grant select (id, event_id, email, invited_by, created_at) on public.event_email_invitation to authenticated;

revoke all on function public.invite_to_event(uuid, text[]) from public, anon, authenticated;
grant execute on function public.invite_to_event(uuid, text[]) to authenticated;
revoke all on function public.email_invitation() from public, anon;
grant execute on function public.email_invitation() to authenticated;

commit;
