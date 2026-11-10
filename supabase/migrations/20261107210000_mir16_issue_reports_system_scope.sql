-- MIR-16: issue reports move to the system panel. The role split's first slice.
--
-- Implements ADR-082 decision 1 (01-plan.md § 4.1):
--
--   * Member reads and writes end. `issue_report_select_admin`, `issue_report_update_admin` and the
--     storage policy `issue_image_select_admin` are dropped: no org admin reads or marks a report any
--     more (AC-1, AC-2, AC-3).
--   * A new storage policy, `issue_image_select_system`, lets a system admin read a report's image —
--     and mint a signed URL for it, since that check runs against the same policy.
--   * Two `security definer` RPCs are the only door onto `public.issue_report`:
--     `list_issue_reports()` and `set_issue_report_status(uuid, public.issue_status)`, each refusing
--     with `42501` unless `public.is_system_admin()` is true (AC-4 to AC-6).
--
-- NO TABLE, COLUMN, CONSTRAINT, INDEX OR GRANT CHANGES (01-plan.md § 6). The existing table grants
-- (`select`, `update (status)`, `insert (...)` to `authenticated`) stay in place: with no select or
-- update policy left admitting a member, they now admit zero rows rather than being revoked — which
-- is what keeps the member app's interim read (MIR-17's to replace) answering an empty list instead
-- of a `42501` throw (01-plan.md § 8, "Rejected alternatives").
--
-- **IDEMPOTENT** (ADR-024): `drop policy if exists`, `create or replace` for the two functions,
-- `drop policy if exists` before the one new policy, and the grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09). NOT VERIFIED AGAINST A RUNNING
-- POSTGRESQL — `pnpm db:test` needs the local Supabase stack, which this environment does not have;
-- the SQL below is written from the sibling pattern `list_national_holidays` and its three write RPCs
-- already use (20261106120000_mir15b_org_public_holidays.sql).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Member reads and writes end (ADR-082 decision 1).
-- ---------------------------------------------------------------------------------------------

drop policy if exists issue_report_select_admin on public.issue_report;
drop policy if exists issue_report_update_admin on public.issue_report;
drop policy if exists issue_image_select_admin on storage.objects;

-- ---------------------------------------------------------------------------------------------
-- 2. The image read a system admin needs for the panel — and for minting a signed URL, which is
--    checked against this same policy.
-- ---------------------------------------------------------------------------------------------

drop policy if exists issue_image_select_system on storage.objects;
create policy issue_image_select_system on storage.objects
  for select to authenticated
  using (bucket_id = 'issue-report' and public.is_system_admin());

-- ---------------------------------------------------------------------------------------------
-- 3. The door. Every column reference is qualified: the `returns table` names are PL/pgSQL
--    variables in scope, not the table's own columns — the pattern list_national_holidays already
--    uses.
-- ---------------------------------------------------------------------------------------------

create or replace function public.list_issue_reports()
  returns table (
    id          uuid,
    org_id      uuid,
    org_name    text,
    member_id   uuid,
    member_name text,
    kind        public.issue_kind,
    message     text,
    page        text,
    status      public.issue_status,
    created_at  timestamptz,
    images      text[]
  )
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  return query
    select r.id, r.org_id, o.name, r.member_id, m.display_name,
           r.kind, r.message, r.page, r.status, r.created_at, r.images
      from public.issue_report r
      left join public.member m on m.id = r.member_id
      join public.org o on o.id = r.org_id
     order by r.created_at desc, r.id desc
     limit 500; -- ISSUE_REPORT_LIMIT (src/lib/domain/types.ts); the seam refuses a list at this size.
end;
$$;

create or replace function public.set_issue_report_status(p_id uuid, p_status public.issue_status)
  returns void
  language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  update public.issue_report r set status = p_status where r.id = p_id;
  if not found then
    raise exception 'issue report not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Privileges. `anon` as well as `public`: Supabase's default privileges grant a new function to
--    `anon` directly (010-catalogue.test.sql, F-1).
-- ---------------------------------------------------------------------------------------------

revoke all on function public.list_issue_reports() from public, anon;
grant execute on function public.list_issue_reports() to authenticated;
revoke all on function public.set_issue_report_status(uuid, public.issue_status) from public, anon;
grant execute on function public.set_issue_report_status(uuid, public.issue_status) to authenticated;

commit;
