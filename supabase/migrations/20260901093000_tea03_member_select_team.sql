-- TEA-03. ADR-018: who may read the member list, and the policy that carries it.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- The entire content of this migration is one statement, and every part of what it does NOT do is
-- as deliberate as what it does — ADR-018 Decision and Consequences, 02-design.md section 4:
--
--   * No `drop policy`. `member_select_own` is KEPT. Policies are permissive and OR together, so
--     the two compose without either being rewritten. Replacing it would leave a removed member
--     unable to read even their own row, because `member_team_id` filters `removed_at is null` and
--     `team_id = null` is never true — byte-identical to the answer for somebody never admitted,
--     which is the distinction TEA-03's AC-7 exists to keep.
--   * No `grant`. TEA-01's migration already granted `select on public.member` to `authenticated`
--     and revoked all from `anon`.
--   * No `alter table`, no column, no table, no new helper. `public.member_team_id(uuid)` exists
--     from TEA-01 and is `security definer`, so a policy on `member` may consult `member` without
--     recursing through `member`'s own policies.
--   * No `removed_at` condition. ADR-018 Decision point 2: a removed member's row is returned to
--     their teammates carrying `removed_at`, because ADR-013 and the INV-04 note require the
--     counting function to be GIVEN the roster with `removed_at` per member — it cannot derive
--     membership-as-of-a-date from the entries. Which rows the SCREEN draws is a display decision
--     above the seam; which rows the READ returns is not.
--   * No insert, update or delete policy, now or by any later ticket. ADR-018 Decision point 3.
--     The admission trigger is the only writer of `member`: any insert policy a signed-in person
--     can satisfy lets them choose their own `team_id` and their own `role`. The specific risk of
--     widening a `select` is that a write is dragged along with it (TEA-03 AC-5).
--
-- `to authenticated`, not `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design (rbac-and-security.md, "Secrets"). TEA-03 AC-6.
--
-- INV-07 now lives in exactly one predicate. ADR-018's revert condition is any read of
-- `public.member` that returns a row belonging to a team the caller is not on — one occurrence, no
-- threshold, because this is the fail-open mode rbac-and-security.md records as known weakness 1.

create policy member_select_team on public.member
  for select to authenticated
  using (team_id = public.member_team_id((select auth.uid())));
