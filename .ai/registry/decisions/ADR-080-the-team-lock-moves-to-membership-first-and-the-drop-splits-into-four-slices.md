---
doc_version: 3
last_updated: 2026-11-06
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-080 — The team lock moves to `membership` first, and the drop of `member.team_id` splits into four slices

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-06 — at `/plan MIR-21-c` (ADR-008, ADR-067).

This ADR re-allocates the work that
[ADR-078](ADR-078-writers-write-membership-alongside-the-column-and-the-drop-moves-to-mir-21-c.md)
decision 5 gave to MIR-21-c, and extends decision 7's blocker list. ADR-078 decision 5 foresaw it
(*"splits again if its count is `L`"*). It reverses no decision. Both obligations of ADR-078
decision 6 still hold; *Decision* says which slice carries each one.

## Context

Counted on 2026-11-06, at `origin/main` `1c48e41`.

- **Done whole, MIR-21-c is about 24 paths, which is `L`.** These paths name `member.team_id`:
  - 15 pgTAP files: `_isolation.psql`, 010, 030, 040, 070, 100, 110, 120, 140, 150, 160, 190, 210,
    220 and 230;
  - `seed.sql`, `bootstrap.sql` and `create-account.sql`;
  - `src/lib/data/supabase.ts`, for its three row-returning RPC calls;
  - `.ai/standards/data-model.md` and `.ai/standards/rbac-and-security.md`.

  The drop's own migration and test come on top.
- **The drop cannot be made small by moving database work out of it.** Most of the paths are
  fixtures. A fixture names the column in its `insert into public.member`, and it gets its
  `membership` row from the mirror's INSERT branch. So every fixture breaks at the moment the column
  goes. A drop slice is small only if the fixtures have already stopped naming the column.
- **A fixture can stop naming the column only once nothing asserts that the column is true.** The
  fixture would write `membership` itself and leave the column null. Some tests assert that the
  column equals the roster team, or read the column back after a fixture insert or a writer call:
  - `220` AC-1 and AC-2;
  - `230`'s AC-9 helper;
  - `140`'s `tests.mirror_violations()`;
  - reads of the column in 030, 040, 070, 150, 160, 190 and 230.

  Each of these would fail first. So those reads move before the fixtures do.
- **Writers can stop writing the column only once two other things have moved.** First, the seam
  must stop reading the column back. `set_member_role`, `set_member_team` and
  `promote_member_to_admin` return a `public.member` row, and `toMember` reads its `team_id`
  (`src/lib/data/supabase.ts:1224`, `:1851`, `:1865`). Second, ADR-064 decision 3's team lock must
  reach `membership`. Today the lock is a clause on the column, in
  `member_enforce_role_and_removal`. It fires on a team change only because every writer still
  assigns the column first. The moment a writer stops, `move_member` on the caller's own id would
  move them.
- **Every slice also carries board overhead.** Each split adds an ADR, the new tickets' `ticket.yaml`
  and the four dependants' `depends_on`. That is eight paths at this split, which is why the first
  slice carries only four paths of work.

## Decision

1. **MIR-21-c: the team lock reaches `membership`, and the seam reads the roster team.** The column
   stays, and every writer still assigns it, so the column stays true.
   - It adds a `before insert or update or delete` trigger on `public.membership`. The trigger
     refuses, with `42501`, any write to a row whose `member_id` is the caller. This carries
     ADR-078 decision 6's first obligation. It uses ADR-064's message, so a caller sees one refusal
     whichever lock fires.
   - The column clause in `member_enforce_role_and_removal` stays until MIR-21-f.
   - The seam's three RPC calls select `MEMBER_COLUMNS`, so their `team_id` is the computed field
     `roster_team_id`.
   - `admit_allow_listed_member` stops naming the column in its insert.
2. **MIR-21-d: writers stop writing the column, and tests stop reading it.**
   - `admit_member`, `reject_member`, `move_member` and `set_member_team` stop assigning `team_id`,
     and so does `create-account.sql`.
   - Every test that reads the column reads `member_roster_team_id(id)` instead: 030, 040, 070, 150,
     160, 190 and 230.
   - The tests that assert the column is true are retired: `140`'s `tests.mirror_violations()` and
     `230` AC-9's column half.

   From then on the column is written only by fixture inserts, and read by nothing but
   `stamp_org_id`, `member_decide_admin` and `public.member_team_id(uuid)`. Predicted about eleven
   paths.
3. **MIR-21-e: fixtures stop naming the column.** Every `insert into public.member` that names
   `team_id` writes `membership` itself instead. Where a fixture relied on `stamp_org_id`'s team
   lookup to get an org, it names `org_id`.
   - The pgTAP fixtures: `tests.seed()`, and the inline fixtures of 100, 120, 140, 150, 160, 190,
     210, 220 and 230.
   - `seed.sql` and `bootstrap.sql`.
   - `220` AC-1 and AC-2 are retired.

   It needs no migration. Predicted about twelve paths.
4. **MIR-21-f: the drop.** It drops:
   - the column, `member_team_id_idx` and the column's `update` grant;
   - `public.member_team_id(uuid)`;
   - the mirror's INSERT branch;
   - the column clause of `member_enforce_role_and_removal`;
   - `stamp_org_id`'s team lookup;
   - `member_decide_admin`.

   It rewrites the catalogue and self-lock tests that name the column (010, 040, 100, 110, 160), and
   `.ai/standards/data-model.md` and `rbac-and-security.md`. The removal branch of
   `member_sync_membership` stays verbatim. That carries ADR-078 decision 6's second obligation.
   Predicted about nine paths.
5. **No test or fixture written from now on names `member.team_id`.** This covers the new tests of
   MIR-21-c and MIR-21-d. A new fixture inserts its member without `team_id` and writes `membership`
   directly, so MIR-21-e does not grow.
6. **Features MIR-16, MIR-17, MIR-19 and MIR-20 are blocked by MIR-21-d, MIR-21-e and MIR-21-f as
   well.** They were blocked on the column being dropped (ADR-077 decision 6, ADR-078 decision 7),
   and the drop is now MIR-21-f.

   Each slice plans its own contract, and splits again if its count is `L`.

## Options considered

- **Plan the next slice only, and leave the rest as one `L` ticket.** This is what ADR-077 and
  ADR-078 did. Rejected. The remainder is about twenty paths, so it would split again at its own
  PLAN, and pay the ADR and four-dependant overhead a second time. The count that decides the next
  three boundaries has been made here, and it is recorded so the next PLAN does not repeat it.
- **Writers stop writing the column in MIR-21-c.** Rejected. It needs the seam, the lock, five
  tests and `create-account.sql` in one slice. With the board overhead that is about fifteen paths,
  which is `L`.
- **Fixtures first.** Rejected. A fixture that leaves the column null fails every test that still
  reads the column (*Context*).
- **Make MIR-21-c the drop, and put the preparation in new tickets that it depends on.** That would
  leave the four dependants untouched. Rejected. It writes the drop's contract against a fixture
  layout that does not exist yet, and the plan would be stale by the time it is built.
- **Keep the column true from `membership` with a reverse trigger, so fixtures can change at any
  time.** Rejected. It adds a mechanism whose only purpose is to be deleted two slices later.
- **Put the team lock in MIR-21-d, beside the writers that make it necessary.** That keeps the
  lock next to its cause. Rejected on size: MIR-21-d is already about eleven paths, and the lock
  needs its own test. For the one ticket's lifetime between MIR-21-c and MIR-21-d, both locks fire
  on a self-move, and they raise the same message.

## Consequences

- Between MIR-21-c and MIR-21-d, a team change on the caller's own id meets two locks. The column
  clause fires first, because every writer assigns the column before it writes `membership`.
- After MIR-21-d, the column is stale for anybody admitted or moved. Nothing reads it for an answer
  any more: the seam reads the roster team (decision 1), and ADR-077 moved every database reader.
- `rbac-and-security.md` § 161 describes `member_decide_admin`. It stays true until MIR-21-f drops
  the policy.

## Revert condition

A path is found that writes a person's own `membership` row legitimately while their JWT is the
caller's. If one is, the lock gains a carve-out for that path, named in an ADR.
