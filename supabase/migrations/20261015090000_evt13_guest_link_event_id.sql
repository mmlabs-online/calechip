-- EVT-13. A signed-in member who opens a guest link to an event they can read is taken to the event
-- in the app.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like EVT-01's to EVT-12's. `tests/permission-model
-- .test.ts` against a real PostgreSQL is still owed project-wide. `tests/guest-link.test.ts` asserts
-- the behaviour against the MOCK seam, which reproduces this file; it cannot prove it.
--
-- Decided by ADR-061 decision 8 (ACCEPTED by the operator). The function is 01-plan.md § 4.1's,
-- transcribed.
--
-- **ONE DEFINER FUNCTION AND ITS EXECUTE GRANT, NOTHING ELSE.** No table, column, index, constraint,
-- policy, trigger or table grant changes. `get_guest_event`, `list_guest_event_attendees`,
-- `may_read_event` and `event_guest_link`'s policies are read, not changed.
--
-- **IT RETURNS THE EVENT ID ONLY TO A READER OF THE EVENT** (AC-7). There is no path to `event_id`
-- that does not pass `may_read_event(l.event_id, auth.uid())`, and "no such open link" and "not a
-- reader" are the same null. `may_read_event` starts from `member_team_id(uid)`, so a pending,
-- rejected, removed or member-less session is never a reader.
--
-- **NOT GRANTED TO `anon`** (AC-5, AC-7). The guest read, its fields and its anon grant are untouched,
-- so `EVT-06` AC-12 and AC-14 and ADR-052 decision 3 stand.
--
-- Idempotent: `create or replace` and the grants restated (ADR-024).

begin;

-- EVT-13 AC-1, AC-7. The event behind an open guest link, to a reader of that event only.
create or replace function public.guest_link_event_id(p_token text) returns uuid
  language sql stable security definer set search_path = '' as $$
  select l.event_id
    from public.event_guest_link l
   where l.token = p_token
     and public.may_read_event(l.event_id, (select auth.uid()));
$$;

revoke all on function public.guest_link_event_id(text) from public, anon, authenticated;
grant execute on function public.guest_link_event_id(text) to authenticated;

commit;
