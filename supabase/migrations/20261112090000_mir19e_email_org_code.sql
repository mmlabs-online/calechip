-- MIR-19-e, ADR-098 (01-plan.md § 4.1, § 6). Two trigger functions replaced in place, nothing else:
-- `email_notification()` and `email_invitation()` each put the recipient's own org code in the request
-- they post to `send-event-email`, so a member's link opens under their org (`/{org_code}/events/<id>`).
-- A guest's request carries null (ADR-097 decision 6). No trigger, table, policy or grant changes; the
-- four grant lines are restated as they stand. A recipient with no approved org (removed between the
-- notification and the mail) is still mailed, with `orgCode: null` and so a root link — hence the left
-- join. Idempotent (`create or replace`, ADR-024). One transaction. Applying it to the hosted project
-- is human (RULE-09); the function and the migration may deploy in either order (ADR-098 decision 4).
begin;

-- ---------------------------------------------------------------------------------------------
-- 1. email_notification(): EVT-05's body, with the two added lines.
-- ---------------------------------------------------------------------------------------------
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
             'orgCode',        o.org_code,
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
      left join public.org o on o.id = public.member_org_id(r.id)
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

-- ---------------------------------------------------------------------------------------------
-- 2. email_invitation(): EVT-12's body, with the two added lines.
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
                  'orgCode',       (select o.org_code from public.org o where o.id = public.member_org_id(v_member_id)),
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
                  'orgCode',       null::text,
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
-- 3. Grants, restated exactly as EVT-05 and EVT-12 wrote them.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.email_notification() from public, anon;
grant execute on function public.email_notification() to authenticated;
revoke all on function public.email_invitation() from public, anon;
grant execute on function public.email_invitation() to authenticated;

commit;
