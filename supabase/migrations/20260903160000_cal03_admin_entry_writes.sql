-- CAL-03. The admin's update and delete policies on `public.entry`. 01-plan.md section 6.
--
-- TWO POLICIES AND NOTHING ELSE. This is the smallest migration on this board, and the shortness is
-- the finding rather than an accident: CAL-02 already granted `update (start_date, end_date, type,
-- portion, tentative, note)` and `delete` on `public.entry` to `authenticated`, and both grants are
-- ROLE-BLIND — `member` and `admin` are the same PostgreSQL role. The privilege an admin needs is
-- therefore already held, and the policy is the only thing that was missing.
--
-- ADR-005 for why the control is here and not in the seam; ADR-014 for why a migration touching a
-- policy is NOT `schema_delta: none`; ADR-016 for the shape of the predicate below and for the
-- failure it names; ADR-018 for `public.member_team_id()` on both sides of a comparison.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- WHAT THIS FILE DOES NOT CONTAIN, and each absence is a decision:
--   * NO `insert` policy, permanently. `.ai/registry/features.md` CAL-03: "this row must not grow a
--     create path." Creating an entry on another member's behalf is denied for BOTH roles in
--     rbac-and-security.md, and that asymmetry against editing is decided rather than incidental.
--     `entry_insert_own`'s `with check (member_id = (select auth.uid()))` stays the only insert path
--     for everybody, and AC-6 is that policy — unmodified — doing its job.
--   * NO grant of any kind. See the paragraph above; a second `grant` here would read as a control
--     and be none. This inverts the trap found three times in this repository (TEA-01, ADR-016
--     Consequences, CAL-02 step 2), where the policy existed and the grant did not.
--   * NO grant of `member_id`, `status` or `rejection_reason`. `member_id` is INV-07. `status` and
--     `rejection_reason` are ADM-05's, in the same migration that adds clauses (a) and (b) to
--     `entry_enforce_decision()` — CAL-02 step 1 records why they cannot be granted before then.
--   * NO edit to `entry_update_own` or `entry_delete_own`. Permissive policies OR together, so the
--     admin's rule composes with the member's by the engine's own rule rather than by an author
--     merging two predicates into one. A reviewer who finds CAL-02's policies modified has found the
--     defect (01-plan.md section 3, property 1, and section 8, rejected alternative 1).
--   * NO change to `public.entry_enforce_decision()`. INV-02 is ACTOR-BLIND by decision (ADR-016
--     section 2): an admin's substantive edit revokes the approval exactly as the owner's does
--     (AC-3), and a note-only edit revokes nothing (AC-4). Adding an actor carve-out here would be
--     reversing an accepted ADR, which is the operator's call and not this ticket's.
--   * No constraint change, no enum change, no new column, no new function.
--   * No edit of any shipped migration. Both policies are new objects in this ticket's own file.
--
-- WHAT THIS FILE DOES NOT CLOSE. `.ai/standards/rbac-and-security.md` known weakness 3 — "an admin
-- may edit any member's entry, and v1 records no trace of it" — was a statement about a capability
-- nobody had. After this file it is a statement about one that exists. `updated_at` moves (AC-11)
-- and says WHEN; nothing says WHO. `data-model.md` OPEN QUESTIONS item 5 offers `updated_by` as the
-- cheapest close, and it is a schema change with its own decision (RULE-09). 01-plan.md Open
-- questions item 1 carries it to the operator.

-- Step 1. The admin's update policy. AC-1, AC-3, AC-4, AC-5, AC-7, AC-8, AC-9, AC-11.
--
-- THE TEAM PREDICATE IS LOAD-BEARING AND IS THE HALF WITH NO TEST BEHIND IT. A policy of
-- `using (public.is_admin((select auth.uid())))` alone reads correct, passes every test that can be
-- written against the one-team fixture this repository has, and lets an admin of any team edit every
-- entry in the product at P2. That is rbac-and-security.md known weakness 1 — a policy written too
-- permissively fails open and SILENTLY — and ADR-016 Consequences names this exact shape by ticket.
-- It is in writing here rather than left to a test to catch, because no test here can catch it.
--
-- `using` CARRIES `is_admin` AND `with check` DOES NOT, and the asymmetry is deliberate. `using`
-- sees the OLD row and answers *may this caller touch this row at all* — that is where the role
-- belongs, and it is AC-5 and AC-8. `with check` sees the NEW row and answers *may the row look like
-- this afterwards*; repeating `is_admin` there would re-assert a fact `using` has already
-- established and would read as a second control while being none. What `with check` must catch is a
-- MOVE ACROSS TEAMS, which `using` structurally cannot see because `using` is evaluated against the
-- old row's team.
--
-- The `with check` is REDUNDANT while `member_id` is ungranted — CAL-02's column list omits it
-- permanently, so `new.member_id` always equals `old.member_id` — and it is kept anyway as the
-- second lock, exactly as `entry_update_own` and TEA-04's `member_update_admin` keep theirs. AC-7 is
-- held by the grant first and by this clause second.
--
-- Both helpers are TEA-01's `security definer` functions, so a policy on `entry` may consult
-- `member` without recursing through `member`'s own policies. Both also filter `removed_at is null`,
-- so a removed admin is not an admin and a removed member's entries have no team — which is the
-- correct answer in both directions and is TEA-04's decision, not this ticket's.
--
-- `to authenticated`, never `to public`, or the anon key that ships in the browser bundle by design
-- re-opens the table (rbac-and-security.md, "Secrets").
--
-- INV-01 NEEDS NOTHING HERE, and the subtlety is whose entries it compares. `entry_no_overlapping_
-- portion` keys on `member_id`, so an admin editing somebody else's row collides with THAT MEMBER's
-- other entries and never with the admin's own. AC-9 asserts exactly that; it is the case an
-- implementation written from the admin's point of view gets wrong, and the constraint gets it right
-- without being told.
create policy entry_update_admin on public.entry
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  )
  with check (
    public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  );

-- Step 2. The admin's delete policy. AC-2, AC-5, AC-8, AC-12.
--
-- No `with check` — a delete has no new row.
--
-- A HARD delete, as `entry_delete_own` is: `entry` carries no soft-delete column, so the row and its
-- `approved_by` disappear together (AC-12) and INV-01's constraint releases the slots the row held
-- the moment it is gone. The feature row settles that the approving admin learns nothing, because v1
-- has no notification channel and the change feed is on the brief's P1 list.
--
-- The same team predicate, for the same reason, and it is not shortened because the delete "reads
-- smaller": a delete across teams is the more destructive half of the same hole.
create policy entry_delete_admin on public.entry
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  );
