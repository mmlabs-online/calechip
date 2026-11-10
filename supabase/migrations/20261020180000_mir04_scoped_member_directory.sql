-- MIR-04 — the member directory is the caller's own team plus the people they already share an
-- event or a notification with.
--
-- ADR-066 (ACCEPTED by the operator 2026-10-20, "Q1. B / Q2. B") and
-- .ai/board/tickets/MIR-04/01-plan.md § 4.1. Supersedes the picker clause of ADR-045 Decision 3.
--
-- Replaces public.list_member_directory() with the same signature, so `create or replace` keeps its
-- grants; they are restated below exactly as 20260929120000_evt01_event.sql wrote them.
-- No policy on public.member is created, dropped or changed: listMembers() is still INV-04's
-- denominator. The invitee check (save_event, event_invitee_insert_manage, invite_to_event) is
-- audited and unchanged by decision (ADR-066 decision 3).
--
-- NOT VERIFIED AGAINST A RUNNING POSTGRESQL. The steps of record are in
-- .ai/board/tickets/MIR-04/verification.md. Applied by a human (RULE-09). Idempotent.

begin;

create or replace function public.list_member_directory()
  returns table (id uuid, display_name text, avatar text, team_id uuid, team_name text)
  language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.avatar, m.team_id, t.name
    from public.member m
    join public.team t on t.id = m.team_id
   where public.member_team_id((select auth.uid())) is not null
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and (
       -- (a) ADR-066 2(a): an admin, unchanged.
       public.is_admin((select auth.uid()))
       -- (b) own team.
       or m.team_id = public.member_team_id((select auth.uid()))
       -- (c) creator of an event the caller reads; invitee of an event the caller manages.
       or exists (select 1 from public.event e
                   where e.creator_id = m.id
                     and public.may_read_event(e.id, (select auth.uid())))
       or exists (select 1 from public.event_invitee i
                   where i.member_id = m.id
                     and public.may_manage_event(i.event_id, (select auth.uid())))
       -- (d) attendance the caller can see: event_attendance_select_visible's predicate.
       or exists (select 1 from public.event_attendance a
                   where a.member_id = m.id
                     and public.may_read_event(a.event_id, (select auth.uid()))
                     and (a.status = 'attending'::public.attendance_status
                          or public.may_manage_event(a.event_id, (select auth.uid()))))
       -- (e) actor of a notification addressed to the caller.
       or exists (select 1 from public.notification n
                   where n.actor_id = m.id
                     and n.recipient_id = (select auth.uid()))
     );
$$;

revoke all on function public.list_member_directory() from public, anon;
grant execute on function public.list_member_directory() to authenticated;

commit;
