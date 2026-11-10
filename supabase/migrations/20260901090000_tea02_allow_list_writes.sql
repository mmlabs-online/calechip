-- TEA-02. The write half of the allow-list. ADR-009 for the decision, ADR-014 for why this file
-- makes the ticket's schema_delta not `none`. 02-design.md section 4.1.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- It adds POLICIES AND GRANTS ONLY. No table is altered, no column is added, and no helper is
-- defined: `public.is_admin(uuid)` and `public.member_team_id(uuid)` already exist from
-- 20260831150024_tea01_membership.sql and both are `security definer`, so a policy on
-- `allowed_email` may consult `member` without recursing through `member`'s own policies.

-- TEA-01 revoked everything and granted only select. Writes need their own grants; a policy alone
-- cannot admit a statement the role has no privilege to issue. `anon` is granted nothing and stays
-- that way — rbac-and-security.md known weakness 1 is that a policy fails open silently, and the
-- grant is the second lock that does not.
grant insert, delete on public.allowed_email to authenticated;

-- AC-2, AC-4. `with check` and not `using`: an insert has no existing row to test.
--
-- The team is DERIVED from the caller rather than accepted from them, so AC-4 has no path through
-- any client. INV-07 is decided here: `allowed_email.team_id` is the value the admission trigger
-- copies onto the `member` row, and this predicate is what stops an admin choosing another team's.
--
-- `added_by = auth.uid()` is not in the story and is deliberate: without it an admin could
-- attribute an entry to a colleague, and .ai/standards/data-model.md calls `added_by` the only
-- provenance for who let somebody in. It refuses nothing a legitimate client would send.
create policy allowed_email_insert_admin on public.allowed_email
  for insert to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
    and added_by = (select auth.uid())
    and consumed_at is null
  );

-- AC-6, AC-7, AC-8. `consumed_at is null` is the whole of AC-7 and it is HERE rather than in the
-- interface: a consumed row is invisible to this policy, so the delete matches nothing whoever
-- issues it. Hiding the remove control on a joined row is the affordance over this and never the
-- check itself (ADR-005).
create policy allowed_email_delete_admin_unconsumed on public.allowed_email
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
    and consumed_at is null
  );

-- Still no update policy on any of the three tables, deliberately. An entry that is wrong is removed
-- and re-added, which keeps added_by and added_at describing an act that actually happened
-- (01-story.md, Permissions; 02-design.md section 7). `member` still has no insert policy and must
-- never gain one — the trigger is its only writer.
