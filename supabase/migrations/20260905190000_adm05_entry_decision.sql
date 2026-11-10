-- ADM-05. The decision guard on `public.entry`, and the two columns it guards. 01-plan.md section 6.
--
-- TWO OBJECTS AND NO THIRD. `create or replace function public.entry_enforce_decision()` gaining
-- clauses (a) and (b), and `grant update (status, rejection_reason) on public.entry to
-- authenticated`. Both are transcribed from supabase/db.sql, which marks each `[OWED] ADM-05` under
-- ADR-026 decision point 1, and both were VERIFIED OWED against supabase/migrations/ rather than
-- read off those labels — five of which are stale (01-plan.md Open questions item 3):
--   * `grep "only an admin may decide an entry" supabase/migrations/` returns nothing.
--   * the only `grant update` on `entry` in any migration is CAL-02's six-column list.
--
-- `entry_update_admin` IS NOT HERE, and ticket.yaml's `schema_delta` names it because that shell was
-- written on 2026-08-31, three days before CAL-03 shipped the policy in
-- 20260903160000_cal03_admin_entry_writes.sql:80 with its team predicate. Recreating it would be a
-- drop and create against a policy that already exists and is already correct. 01-plan.md section 6.
--
-- ADR-005 for why every one of these is in the database rather than in the seam; ADR-014 for why a
-- migration touching a policy, a trigger or a grant is NOT `schema_delta: none`; ADR-016 for the
-- decision this file implements, and for the tension it states about itself — clause (a) is
-- authorization in the database but NOT in a policy, which is the single most reviewable thing in
-- this ticket and is argued in that ADR's Status section rather than here.
--
-- Applying this file is human (RULE-09), and this one more than most: it opens two columns to
-- `authenticated` in the same file that closes them behind the guard.
--
-- WHAT THIS FILE DOES NOT CONTAIN, and each absence is a decision:
--   * NO second `before update` trigger on `entry`. PostgreSQL fires same-event triggers
--     ALPHABETICALLY BY NAME, so a second one would make the guard's correctness depend on spelling
--     — and a second `BEFORE UPDATE` trigger appearing on `entry` is ADR-016's own third revert
--     signal. The trigger `entry_enforce_decision` already exists and already points at this name.
--   * NO new grant on `public.is_admin(uuid)`. TEA-01 granted execute to `authenticated`
--     (20260831150024_tea01_membership.sql:71); a second grant reads as a control and is not one —
--     the redundant-grant trap ADM-03 recorded.
--   * NO new column, NO new policy, NO new table, NO enum change. `approved_by` and `approved_at`
--     already exist and stay UNGRANTED: clause (b) writes them and the wire never can.
--   * NO edit of a shipped migration. CAL-01 created this function and CAL-02 replaced it; this is
--     the third `create or replace` on the same name, in this ticket's own file.
--   * NOT `public.reject_entries(uuid[], text)`. Bulk rejection is ADM-06's — ADR-016 section 4 says
--     the single approve and the single reject stay a plain PATCH.

-- Step 1. `public.entry_enforce_decision()`, REPLACED a third time, gaining clauses (a) and (b).
--
-- ORDER INSIDE THE FUNCTION IS THE WHOLE DESIGN, and it is `updated_at`, then (a), then (b), then
-- (c). The guard reads the values the client SENT, before anything below has touched them. A member
-- editing dates on an approved entry passes (a) — at that point `new.status` still equals
-- `old.status` — and is then reset by (c). Reversed, the guard sees a `status` change made by the
-- reset itself and refuses a member's legitimate edit. ADR-016 section 1.
--
-- THE `updated_at` LINE AND CLAUSE (c) ARE TRANSCRIBED UNCHANGED from
-- 20260903143000_cal02_own_entry_writes.sql, comments included. A `create or replace` is a whole
-- function body, so a reviewer sees a new file rather than a change: a replacement that quietly
-- altered the reset would be a broken invariant with a passing diff. A diff against that file should
-- show ADDITIONS ONLY.
--
-- `security invoker`, unchanged: the function needs no privilege of its own. It reads `auth.uid()`
-- and calls `public.is_admin`, which is already `security definer` and already granted.
create or replace function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- CAL-02 AC-12. The datastore's own clock, never the client's: an UPDATE must name a value for
  -- every column it writes, and this line overwrites whatever a caller might send - which is why
  -- `updated_at` is absent from the update grant above and cannot be sent at all. Same shape as
  -- TEA-04's `removed_at`, and the same reason: a timestamp a client can set is a record that can be
  -- backdated.
  new.updated_at := now();

  -- (a) ADM-05 — ADR-016 section 1. THE GUARD. Only an admin may move the four decision columns.
  --
  -- THIS IS NOT EXPRESSIBLE AS A POLICY, and that is why it is here. An RLS `with check` sees the
  -- NEW row and has no OLD, so "`status` did not change" cannot be written; CAL-02's
  -- `entry_update_own` admits a member's own row, so a raw PATCH {"status":"approved"} against it
  -- satisfies the policy and the entry is approved by the person who wrote it. A column grant cannot
  -- help either: `member` and `admin` are the SAME PostgreSQL role, `authenticated`, so revoking
  -- `status` from it would block the admin too.
  --
  -- ALL FOUR COLUMNS, not just the two granted in step 2. `approved_by` and `approved_at` are
  -- ungranted and a wire caller cannot name them, so those two conjuncts are unreachable from
  -- PostgREST today — they are here because clause (b) is what writes them and the guard must be
  -- true of the columns rather than of the current grant.
  --
  -- v_uid is null in a migration, the SQL editor or a service-role call; that context is not
  -- blocked, because nothing blocks a service-role key anyway (known weakness 1).
  if (new.status           is distinct from old.status
   or new.rejection_reason is distinct from old.rejection_reason
   or new.approved_by      is distinct from old.approved_by
   or new.approved_at      is distinct from old.approved_at)
     and v_uid is not null
     and not public.is_admin(v_uid) then
    raise exception 'only an admin may decide an entry'
      using errcode = '42501';
  end if;

  -- (b) ADM-05 — ADR-016 section 1. PROVENANCE, NEVER TRUSTED FROM THE WIRE, IN EITHER DIRECTION.
  --
  -- `approved_by` is the only audit trail v1 has, and known weakness 3 means nothing anywhere would
  -- contradict a forged one. Written here, it also makes CAL-05's "displaying who approved is not
  -- approving" true by construction rather than by a story remembering it.
  --
  -- The two roles are treated differently on purpose (ADR-016 section 2): a MEMBER sending a forged
  -- `approved_by` is refused by clause (a) above, because the request is illegitimate and should say
  -- so; an ADMIN sending another admin's id is silently corrected to their own, because the request
  -- is legitimate and only its provenance is wrong.
  --
  -- Nulling `rejection_reason` on approval is FORCED, not chosen: the biconditional check
  -- `entry_rejection_reason_iff_rejected` refuses any transition off `rejected` that leaves the
  -- reason standing, and would surface as a raw 23514 (INV-03).
  --
  -- `tentative` IS NOT TOUCHED HERE OR ANYWHERE BELOW (INV-05). Approval and tentativeness are two
  -- independent axes, and an approval that cleared the flag would change what the entry contributes
  -- on the absence count's own terms.
  if new.status = 'approved'::public.entry_status
     and old.status is distinct from 'approved'::public.entry_status then
    new.approved_by      := v_uid;
    new.approved_at      := now();
    new.rejection_reason := null;
  elsif new.status is distinct from 'approved'::public.entry_status then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  -- (c) INV-02, and the rejected-entry hole closed with it (ADR-016 section 3). CAL-01's and
  -- CAL-02's, TRANSCRIBED UNCHANGED. RUNS LAST, ON PURPOSE — see the order note at the top.
  --
  -- A substantive edit revokes the decision: dates, type, portion and tentative are substantive;
  -- `note` alone is NOT, which is data-model.md's own carve-out.
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

-- The trigger itself is NOT recreated, for the reason CAL-02 recorded: `create or replace function`
-- replaces the body in place and `entry_enforce_decision` on `public.entry` already points at this
-- name, so dropping and recreating it would be a window in which no guard is attached, for no gain.

-- Step 2. The two columns CAL-02 deferred BY NAME, granted now — and only now, because they must
-- land in the same file as clause (a).
--
-- 20260903143000_cal02_own_entry_writes.sql step 1 says it in words: granting `status` while the
-- function is in its INV-02-only form hands every member the exact write ADR-016 exists to refuse,
-- with no guard behind it. supabase/db.sql:681-687 says the same. Step 1 above is what makes this
-- statement safe, and the two are one migration for that reason and no other.
--
-- IT IS ADDITIVE. PostgreSQL's `grant` on a column list adds privileges; CAL-02's six columns are
-- untouched, so `updateEntry`'s six-field statement keeps working exactly as it did — which is what
-- AC-12, AC-13 and AC-14 observe.
--
-- `member_id` IS STILL ABSENT, permanently: it is INV-07, and CAL-02 recorded that it is not ADM-05's
-- to add either. So are `approved_by` and `approved_at` — clause (b) writes them and the wire never
-- can, which is AC-7.
grant update (status, rejection_reason) on public.entry to authenticated;
