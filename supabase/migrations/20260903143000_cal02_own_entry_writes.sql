-- CAL-02. The update and delete policies on `public.entry`, the two grants that make them reachable,
-- and one line added to INV-02's trigger function. 01-plan.md section 6.
--
-- ADR-005 for why every one of these is in the database rather than in the seam; ADR-014 for why a
-- migration touching a policy, a trigger or a constraint is NOT `schema_delta: none`; ADR-016 for the
-- function name, the trigger shape, and the column grant this file narrows.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- WHAT THIS FILE DOES NOT CONTAIN, and each absence is a decision:
--   * NO admin policy on update or delete. `rbac-and-security.md` gives an admin `Edit or delete
--     another member's entry`, and that row is CAL-03's - it is known weakness 3, "an admin may edit
--     any member's entry, and v1 records no trace of it", which the charter amendment of 2026-08-31
--     treats as a change to what the product is. Nothing below mentions `is_admin`; an admin acting
--     here acts only on their own rows.
--   * NO grant of `status` or `rejection_reason`. See step 1.
--   * NO grant of `member_id`, ever. It is INV-07, and it is not ADM-05's to add either.
--   * No insert policy change, no constraint change, no enum change, no new column.
--   * No edit of 20260903103000_cal01_entry.sql. A shipped migration is never edited; the function
--     change below is a `create or replace` in this ticket's own file.

-- Step 1. The update grant, AND ITS COLUMN LIST IS AC-8 AND AC-10'S CONTROL.
--
-- A statement naming any column absent from this list is refused with `42501 permission denied for
-- column` BEFORE any policy runs. `member_id` absent is INV-07; `status` and `rejection_reason`
-- absent is AC-10; `approved_by`, `approved_at`, `id`, `created_at`, `updated_at`, `date_range` and
-- `portion_slots` are absent for the reasons CAL-01's step 10 records for the insert grant.
--
-- THIS IS NARROWER THAN THE LIST ADR-016 Consequences WRITES, and the narrowing is deliberate.
-- ADR-016's list also names `status` and `rejection_reason`, and it assumes clauses (a) and (b) of
-- `entry_enforce_decision()` exist. THEY DO NOT: CAL-01 shipped the function in its INV-02-only
-- form, clause (c) alone, because nothing in that ticket approved, rejected or updated anything.
-- Granting `status` now would hand every member the exact write ADR-016 exists to refuse, with no
-- guard behind it - a member PATCHing {"status":"approved"} against their own row satisfies
-- `entry_update_own` and nothing else looks.
--
-- So `status` and `rejection_reason` are granted by ADM-05, in the same migration that adds clauses
-- (a) and (b). That is one statement in a later ticket, written here so the later ticket does not
-- have to rediscover why this column list was short. It narrows ADR-016's text and reverses none of
-- its reasoning: the decision that `status` is admin-only is exactly what is being preserved.
grant update (start_date, end_date, type, portion, tentative, note)
  on public.entry to authenticated;

-- Step 2. The delete grant. `delete` is a TABLE-level privilege with no column form, and CAL-01's
-- `revoke all on public.entry from anon, authenticated` was table-wide - so the policy in step 5 is
-- not sufficient on its own and neither is this. Both are required. This is the third finding of the
-- same shape in this repository (TEA-01's, ADR-016 Consequences, and now this one).
grant delete on public.entry to authenticated;

-- Step 3. `public.entry_enforce_decision()`, REPLACED, gaining one line.
--
-- This ticket is the first that can update a row, so it is the first for which `updated_at` can be
-- FALSE. data-model.md declares the column `not null` and CAL-01 gave it `default now()`, which is
-- correct at insert and never moves again on its own - an entry whose `updated_at` equals its
-- `created_at` after three edits is a false record of the same kind INV-02 exists to prevent. AC-12
-- is what observes it.
--
-- IT GOES INSIDE THIS FUNCTION AND NOT INTO A SECOND TRIGGER. PostgreSQL fires same-event triggers
-- ALPHABETICALLY BY NAME (ADR-016 Consequences), so a second `before update` trigger on `entry`
-- would make the guard's correctness depend on spelling, and the next person to add a third would
-- inherit the problem invisibly. One function is what keeps the order explicit, and spending that
-- property on a timestamp would be the cheapest possible reason to lose it (01-plan.md section 8,
-- rejected alternative 2).
--
-- THE NEW LINE IS PLACED BEFORE CLAUSE (c), so an edit that trips the INV-02 reset still records its
-- own timestamp.
--
-- CLAUSE (c) BELOW IS CHARACTER-IDENTICAL TO 20260903103000_cal01_entry.sql, comments included. A
-- `create or replace` is a whole function body, so a reviewer sees a new file rather than a change:
-- a replacement that quietly altered the reset would be a broken invariant with a passing diff, and
-- R8 reads it line by line against that file.
--
-- NOTE FOR ADM-05: this function now has TWO responsibilities and ADM-05 replaces it a third time.
-- That version must carry clause (c) AND the `updated_at` line, in addition to the clauses (a) and
-- (b) it adds.
create or replace function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  -- CAL-02 AC-12. The datastore's own clock, never the client's: an UPDATE must name a value for
  -- every column it writes, and this line overwrites whatever a caller might send - which is why
  -- `updated_at` is absent from the update grant above and cannot be sent at all. Same shape as
  -- TEA-04's `removed_at`, and the same reason: a timestamp a client can set is a record that can be
  -- backdated.
  new.updated_at := now();

  -- INV-02, and the rejected-entry hole closed with it (ADR-016 section 3). A substantive edit
  -- revokes the decision: dates, type, portion and tentative are substantive; `note` alone is NOT,
  -- which is data-model.md's own carve-out.
  --
  -- It is ACTOR-BLIND on purpose: an admin's edit under CAL-03 revokes approval exactly as the
  -- owner's does. INV-02's text carries no actor qualifier.
  --
  -- `rejection_reason` is cleared in the same statement, and that is forced rather than chosen: the
  -- biconditional check above refuses any transition off `rejected` that leaves the reason standing.
  -- Clearing `approved_by` and `approved_at` too is ADR-011 Consequences — a `pending` entry still
  -- naming its approver is the false record INV-02 exists to prevent.
  if (new.start_date is distinct from old.start_date
   or new.end_date   is distinct from old.end_date
   or new.type       is distinct from old.type
   or new.portion    is distinct from old.portion
   or new.tentative  is distinct from old.tentative)
     and old.status <> 'pending'::public.entry_status then
    new.status           := 'pending'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

-- The trigger itself is NOT recreated. `create or replace function` replaces the body in place and
-- `entry_enforce_decision` on `public.entry` already points at this name - dropping and recreating
-- the trigger would be a window in which no guard is attached, for no gain.

-- Step 4. The update policy. AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-9, AC-12.
--
-- `using` sees the OLD row and decides which rows the caller may touch at all - that is AC-9, and it
-- is a FILTER rather than an error: a row that does not match is not visible to the statement, so
-- PostgREST answers 200 with an empty body and the seam counts rows rather than trusting `!error`
-- (ADR-016 section 4, behaviour 2).
--
-- `with check` sees the NEW row and refuses a reassignment - AC-8's second lock. It is REDUNDANT
-- while `member_id` is ungranted, and it is kept anyway, exactly as TEA-04's `member_update_admin`
-- keeps its own: if a later ticket ever grants that column, this policy already refuses the move.
--
-- `to authenticated`, never `to public`, or the anon key that ships in the browser bundle by design
-- re-opens the table (rbac-and-security.md, "Secrets").
--
-- NO ROLE PREDICATE. `Edit their own entry` is checked for both roles in rbac-and-security.md, and
-- an admin has no more power here than a member. The admin's extra capability is over OTHER
-- members' entries, and that is CAL-03's policy and not this one.
create policy entry_update_own on public.entry
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

-- Step 5. The delete policy. AC-3, AC-4, AC-9.
--
-- No `with check`: a delete has no new row. Deleting is a HARD delete - `entry` carries no
-- soft-delete column and the feature row settles that the row and its `approved_by` disappear
-- together, and that the approving admin learns nothing because v1 has no notification channel and
-- the change feed is P1.
--
-- INV-01 needs nothing here: the exclusion constraint compares live rows, so a deleted row stops
-- conflicting the moment it is gone, which is AC-4.
create policy entry_delete_own on public.entry
  for delete to authenticated
  using (member_id = (select auth.uid()));
