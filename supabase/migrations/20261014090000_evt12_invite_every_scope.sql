-- EVT-12. The creator or an admin of an Own team or Limited people event invites people by email, a
-- member outside its reach is added to its named list, and Named people is relabelled Limited people.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's to EVT-11's. `tests/permission-model
-- .test.ts` against a real PostgreSQL is still owed project-wide. `tests/event-invitation.test.ts`
-- asserts the behaviour against the MOCK seam, which reproduces this file; it cannot prove it.
--
-- Decided by ADR-061 (ACCEPTED by the operator). The steps are 01-plan.md § 4.1's, transcribed.
--
-- **FOUR FUNCTIONS REPLACED IN PLACE, NOTHING ELSE.** No table, column, index, constraint, policy or
-- grant changes. Each function keeps its signature, so `create or replace` keeps its grants and its
-- trigger; the grants are restated anyway, exactly as the original migrations wrote them.
--
-- **A PUBLIC EVENT IS UNCHANGED** (AC-12, ADR-061 revert condition 1). `invite_to_event`'s public
-- branch is EVT-08's text and still reads neither `public.member` nor `auth.users`. On a public event
-- every approved member can read it, so `email_invitation()`'s added line is a no-op there.
--
-- **AN OWN TEAM OR LIMITED PEOPLE EVENT** (AC-4 to AC-9). The function resolves each address to an
-- approved member. An outsider's address opens the event to guests. A member who cannot read the
-- event is added to `event_invitee` — AFTER their invitation row is inserted, so `email_invitation()`
-- sees a member who cannot read and sends nothing (Q3-A: their one mail is EVT-05's "invited", from
-- the notification `notify_event_invited` writes). On an Own team event that first converts it to
-- named, naming its team as it stands, without the creator (Q1-A).
--
-- **THE CONVERSION IS SILENT** (Q6-A, ADR-061 revert condition 2). `calechip.event_conversion` is a
-- transaction-local setting the function sets to the event id around the scope update and the
-- snapshot insert, and clears before the added member's own row. `notify_event_updated` and
-- `notify_event_invited` return early while it names their event. No caller can set it: PostgREST
-- exposes no function that takes a setting name.
--
-- **`for update`, NOT `for share`** on the event row: two submissions on one event run one after the
-- other (AC-8), and a scope change or a delete waits for the submission.
--
-- **IDEMPOTENT** in the shape ADR-024 requires: `create or replace` only. One transaction.
--
-- `EV009` (`invitation_not_public`) is no longer raised by anything.
--
-- `supabase/db.sql` is NOT updated here — MD-033.
--
-- ---------------------------------------------------------------------------------------------
-- THE HUMAN STEPS (RULE-09): apply this migration. No Edge Function change, no redeploy.
-- ---------------------------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. `invite_to_event`. 01-plan.md § 4.1 steps 1-6.
-- ---------------------------------------------------------------------------------------------
create or replace function public.invite_to_event(p_event_id uuid, p_emails text[])
  returns table (email text, outcome text)
  language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_scope   public.event_scope;
  v_team    uuid;
  v_creator uuid;
  v_addr    text;
  v_clean   text[] := '{}'::text[];
  v_seen    text[] := '{}'::text[];
  v_members uuid[] := '{}'::uuid[];
  v_member  uuid;
  v_id      uuid;
  v_i       integer;
begin
  if v_uid is null or not coalesce(public.may_manage_event(p_event_id, v_uid), false) then
    raise exception 'event_not_permitted' using errcode = '42501';
  end if;

  -- AC-8. Submissions on one event serialise; a scope change or a delete waits.
  select e.scope, e.team_id, e.creator_id
    into v_scope, v_team, v_creator
    from public.event e
   where e.id = p_event_id
     for update;

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

  if v_scope = 'public'::public.event_scope then
    -- EVT-08, verbatim. NO READ OF `public.member` OR `auth.users` IN THIS BRANCH (AC-12).
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
    return;
  end if;

  -- Own team or Limited people. Step 5.1: each address to an approved member, or null —
  -- `email_invitation()`'s lookup, the same text.
  foreach v_addr in array v_clean loop
    v_member := null;
    select m.id into v_member
      from public.member m
      join auth.users u on u.id = m.id
     where lower(u.email) = lower(v_addr)
       and m.status = 'approved'::public.member_status
       and m.removed_at is null
     limit 1;
    v_members := array_append(v_members, v_member);         -- a null element for an outsider
  end loop;

  -- Step 5.2. AC-4, AC-9: an outsider's address, invited now or before, opens the event to guests.
  -- Members only leave it as it was (AC-5, AC-6).
  if array_position(v_members, null) is not null then
    insert into public.event_guest_link (event_id) values (p_event_id)
    on conflict (event_id) do nothing;
  end if;

  -- Step 5.3. One address after another, each seeing what the earlier ones left (AC-8).
  for v_i in 1 .. cardinality(v_clean) loop
    v_addr   := v_clean[v_i];
    v_member := v_members[v_i];
    v_id     := null;
    insert into public.event_email_invitation (event_id, email, invited_by)
    values (p_event_id, v_addr, v_uid)
    on conflict do nothing
    returning id into v_id;
    email := v_addr;
    if v_id is null then
      outcome := 'ignored';                                   -- AC-9
      return next;
      continue;
    end if;
    outcome := 'sent';

    -- AC-4 (an outsider) and AC-5 (a reader): the trigger above has mailed, or chosen not to.
    if v_member is null or public.may_read_event(p_event_id, v_member) then
      return next;
      continue;
    end if;

    -- AC-7. Own team: convert to named, naming the team as it stands, silently (Q1-A, Q6-A).
    if v_scope = 'team'::public.event_scope then
      perform set_config('calechip.event_conversion', p_event_id::text, true);
      update public.event set scope = 'named'::public.event_scope where id = p_event_id;
      insert into public.event_invitee (event_id, member_id)
      select p_event_id, m.id
        from public.member m
       where public.member_team_id(m.id) = v_team
         and m.id <> v_creator
      on conflict do nothing;
      perform set_config('calechip.event_conversion', '', true);
      v_scope := 'named'::public.event_scope;
    end if;

    -- AC-6. The member outside its reach joins the event's people. `notify_event_invited` writes
    -- their `event_invited` row, and EVT-05's `email_notification` mails it when on (Q3-A).
    insert into public.event_invitee (event_id, member_id)
    values (p_event_id, v_member)
    on conflict do nothing;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. `email_invitation()`. EVT-08's body with one added line: a member who cannot read the event is
--    sent nothing — `invite_to_event` is about to add them, and EVT-05 mails them (AC-6).
-- ---------------------------------------------------------------------------------------------
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
      -- EVT-12 AC-6. Outside the event's reach: `invite_to_event` adds them next. A no-op on a public
      -- event, which every approved member can read (AC-12).
      if not public.may_read_event(new.event_id, v_member_id) then
        return new;
      end if;
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

-- ---------------------------------------------------------------------------------------------
-- 3. `notify_event_updated()`. EVT-04's body, silent for a conversion (AC-7). The trigger and its
--    `when` clause are unchanged; an edit made with the edit form notifies as before (AC-15).
-- ---------------------------------------------------------------------------------------------
create or replace function public.notify_event_updated() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
begin
  if coalesce(current_setting('calechip.event_conversion', true), '') = new.id::text then
    return null;
  end if;
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

-- ---------------------------------------------------------------------------------------------
-- 4. `notify_event_invited()`. EVT-04's body, silent for the snapshot of a conversion (AC-7).
-- ---------------------------------------------------------------------------------------------
create or replace function public.notify_event_invited() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_name text;
begin
  if coalesce(current_setting('calechip.event_conversion', true), '') = new.event_id::text then
    return null;
  end if;
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

-- ---------------------------------------------------------------------------------------------
-- 5. Grants, restated exactly as EVT-04 and EVT-08 wrote them.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.invite_to_event(uuid, text[]) from public, anon, authenticated;
grant execute on function public.invite_to_event(uuid, text[]) to authenticated;
revoke all on function public.email_invitation() from public, anon;
grant execute on function public.email_invitation() to authenticated;
revoke all on function public.notify_event_updated() from public, anon;
grant execute on function public.notify_event_updated() to authenticated;
revoke all on function public.notify_event_invited() from public, anon;
grant execute on function public.notify_event_invited() to authenticated;

commit;
