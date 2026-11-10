-- ADM-06. Bulk rejection, as ONE function and its two privilege statements. 01-plan.md section 6.
--
-- THREE STATEMENTS AND NO FOURTH, all transcribed from supabase/db.sql — the function at :553-566
-- and the two privileges at :697-698, each marked `[OWED] ADM-06` under ADR-026 decision point 1.
-- Nothing is designed in this file: ADR-016 section 4 decided the function and gave its body.
--
-- VERIFIED OWED AGAINST supabase/migrations/ rather than read off those labels, five of which are
-- stale (01-plan.md Open questions item 3):
--   * `grep -rn "reject_entries" supabase/migrations/` returns nothing.
--   * the only `grant execute` statements in supabase/migrations/ are TEA-01's, on `is_admin` and on
--     the membership trigger's function. Neither names this one.
--
-- `security invoker` IS THE WHOLE SAFETY ARGUMENT AND IS THE SENTENCE A REVIEWER SHOULD CHECK.
-- ADR-016 section 4: "No authorization moves into the function: `entry_update_admin` and clause (a)
-- both still run, exactly as for a single PATCH. The function is a transport change, not an
-- enforcement layer." A `security definer` version would run as the OWNER, both mechanisms would
-- evaluate against the owner rather than the caller, and this feature would have become an
-- authorization bypass that nothing in src/ would report. 01-plan.md section 3.
--
-- ADR-005 for why the controls are in the database rather than in the seam; ADR-014 for why a
-- migration creating a function and changing two privileges is NOT `schema_delta: none`; ADR-016 for
-- the decision this file implements.
--
-- Applying this file is human (RULE-09). It is a SMALLER step than ADM-05's, and the difference is
-- worth stating rather than assuming: that file opened two columns to `authenticated` in the same
-- breath as the guard that constrains them, so applying it in the wrong order was a real hazard.
-- This file opens nothing. The columns are already granted
-- (20260905190000_adm05_entry_decision.sql:170), the guard is already installed, and the function is
-- a new call path over both.
--
-- WHAT THIS FILE DOES NOT CONTAIN, and each absence is a decision:
--   * NO second `before update` trigger on `entry`, and no `create or replace` on
--     `public.entry_enforce_decision()`. A second `BEFORE UPDATE` trigger appearing on `entry` is
--     ADR-016's own third revert signal, and same-event triggers fire ALPHABETICALLY BY NAME — a
--     second one would make the guard's correctness depend on spelling.
--   * NO new policy. `entry_update_admin` shipped with CAL-03
--     (20260903160000_cal03_admin_entry_writes.sql:80) and is what filters a row this caller may not
--     reach, silently, which is the behaviour AC-5 and AC-11 are written against.
--   * NO new column, NO new table, NO enum change, NO new grant on `public.entry`. The `set` list
--     below names `status` and `rejection_reason`, which ADM-05 already granted to `authenticated`,
--     and the function runs as the caller so it needs exactly those and no more. `approved_by` and
--     `approved_at` stay UNGRANTED: clause (b) writes them and the wire never can (AC-9).
--   * NO edit of a shipped migration.

-- Step 1. `public.reject_entries(p_ids uuid[], p_reason text)`.
--
-- `create or replace function`, not `create function` — matching supabase/db.sql and every function
-- migration in this repository, so re-applying the file is not an error.
--
-- ONE STATEMENT, ONE TRANSACTION, AND THAT IS THE FEATURE. `status` and `rejection_reason` are
-- written TOGETHER because INV-03's check `entry_rejection_reason_iff_rejected` is a BICONDITIONAL
-- (.ai/standards/data-model.md:162): a statement setting one without the other is refused. Per
-- record, so INV-03 is satisfied once per entry rather than once per batch — the operator's answer
-- of 2026-08-31, and the reason a shared reason row is not available.
--
-- THE 22023 IS A LEGIBLE REFUSAL AND NOT THE CONTROL. The check constraint is the control and would
-- answer a raw 23514 for the same write; this raises earlier, with a sentence the seam maps to
-- `rejection_reason_required`, so no SQLSTATE reaches the interface. `coalesce` is load-bearing:
-- `btrim(null)` is null, and `null = ''` is null, which is not true — a null reason would pass a
-- test written without it and then be refused by the constraint with the error this line exists to
-- avoid.
--
-- `get diagnostics row_count` IS WHAT MAKES THE PARTIAL CASE VISIBLE AT ALL. Rows
-- `entry_update_admin` does not admit are FILTERED rather than errored, so "reject 8" updates 5 and
-- returns success; the seam compares this integer against the number of ids it sent and says "5 of
-- 8" rather than "done" (AC-5, AC-18). Failure, by contrast, is atomic: one statement, so if any row
-- fails the check or the guard, NONE are rejected.
--
-- NO UPPER BOUND ON `p_ids`, and that is recorded rather than hidden. ADR-016 section 4 removed the
-- query-string ceiling by moving the ids into the body and put no ceiling in their place. The
-- reachable maximum from this product's own interface is one page — `PENDING_PAGE_SIZE` is 50 — and
-- that bound lives in the interface, not here (01-plan.md Open questions item 4).
create or replace function public.reject_entries(p_ids uuid[], p_reason text) returns integer
  language plpgsql security invoker set search_path = '' as $$
declare v_n integer;
begin
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'a rejection carries a reason' using errcode = '22023';  -- INV-03, legibly
  end if;
  update public.entry
     set status = 'rejected'::public.entry_status, rejection_reason = p_reason
   where id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Step 2. The two privilege statements, IN THIS ORDER.
--
-- THE REVOKE IS NOT COSMETIC AND IS NOT IMPLIED BY THE GRANT. PostgreSQL grants `execute` on a newly
-- created function to `public` BY DEFAULT, so without this line the function is callable by `anon`
-- and the grant that follows changes nothing. This is the redundant-grant trap ADM-03 recorded, in
-- its dangerous direction rather than its harmless one — the ticket shell's original `schema_delta`
-- named "its execute grant" and omitted this, and was corrected at PLAN for exactly that reason.
--
-- `anon` losing it costs nothing this product uses: every caller of this function holds a session,
-- and a caller without one is refused by clause (a) anyway — as nobody, which is PGRST301.
revoke all on function public.reject_entries(uuid[], text) from public;
grant execute on function public.reject_entries(uuid[], text) to authenticated;
