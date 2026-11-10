---
from: developer
to: tech-lead-design
asked_at: 2026-11-05T10:13:00Z
---

**Q.** § 4.4 changes `listMembers`' filter from `.not("team_id", "is", null)` to
`.not("roster_team_id", "is", null)`. `tests/roster-excludes-signups.test.ts:67-69` pins the old
string with a regex over the source of `src/lib/data/supabase.ts`:

```ts
it("listMembers() filters team_id not null, so member_select_pending_admin's rows never reach it", () => {
  expect(body).toMatch(/\.not\(\s*"team_id"\s*,\s*"is"\s*,\s*null\s*\)/);
});
```

That file is not in `allowed_paths`. With § 4.4 implemented exactly as written, `pnpm test` has one
failure, that assertion, out of 1010 tests (49 of 50 files pass). Can `allowed_paths` gain
`tests/roster-excludes-signups.test.ts`?

This is the only file outside `allowed_paths` that § 4.4 breaks. `pnpm test` finds no other failure,
and the pgTAP suite on a scratch PG17 shows no regression from the migration.

**Recommendation.** Add `tests/roster-excludes-signups.test.ts` to `allowed_paths`, with one edit:
the regex and the test title name `roster_team_id` instead of `team_id`, citing ADR-077. The test's
purpose is that the real seam narrows `member_select_pending_admin`'s rows out of the roster, and that
purpose does not change. Its mock half (`:1-49`) is untouched.

**Rejected: keeping `.not("team_id", "is", null)` in `listMembers`.** It would keep the unit test
green, but it leaves a seam filter on the column. AC-9 then fails, and MIR-21-b cannot drop the
column.

**Rejected: deleting the assertion.** It is the only test pinning the filter that keeps waiting
sign-ups out of an admin's roster (TEA-09).

**A.** Yes, as recommended. `allowed_paths` gains `tests/roster-excludes-signups.test.ts`, for one
edit only. In the source-text assertion at `:67-69`, the regex and the test title name `roster_team_id`
instead of `team_id`, and a comment cites ADR-077. The mock half (`:1-49`) and the `body` extractor
stay as they are.

The reason: that assertion exists to pin the seam filter that keeps `member_select_pending_admin`'s
rows off the roster (TEA-09). § 4.4 moves the filter to the computed field and does not change what
it does, so the pin moves with it. Your two rejections stand:
- Keeping the column filter fails AC-9 and leaves MIR-21-b a reader to drop.
- Deleting the assertion leaves TEA-09 with no pin on the real seam.

This was a gap in the plan. § 4.4 changed a string that a test outside `allowed_paths` pins, and I
did not search `tests/` for it.

**Amended:** `01-plan.md`:
- § 4.4: the `listMembers` row names the test that moves with the filter.
- § 7: `allowed_paths` gains the file. That is eleven paths, so size stays M.
- Changelog row added.

`ticket.yaml` `allowed_paths` is updated to match. The gate is unchanged.

---
from: developer
to: tech-lead-design
asked_at: 2026-11-05T10:14:24Z
---

**Q2.** `node scripts/check-allowed-paths.mjs` and `node scripts/check-carry.mjs MIR-21` both exit 1
on one path. Neither flags any file this stage wrote:

```
.ai/registry/decisions/ADR-076-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md
```

That path is the deleted side of the PLAN changelog's 09:53:29Z renumber. `git status` shows it as a
staged rename, `RM ADR-076-… -> ADR-077-…`, and the rename was already in the tree when
IN_PROGRESS began. The file is committed at `7a50eaa`, so the deletion loses nothing. `check-carry`
reports it as "exists on no ref", and that is wrong for a deletion. But `allowed_paths` lists only
the ADR-077 side, so both checks count the ADR-076 side as outside the ticket. `/advance` and R1
would hit the same thing.

**Recommendation.** Add the ADR-076 path to `allowed_paths` in § 7 and in `ticket.yaml`, with a
note that it is the source side of the renumber and is deleted, not edited. The deletion's content
has a home on HEAD.

**Rejected: restoring ADR-076 with `git restore --staged`/`--worktree`.** It would leave two ADRs
with the same content and undo an operator-raised amendment.

**A2.** Yes, as recommended. `allowed_paths` gains
`.ai/registry/decisions/ADR-076-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md`,
listed as the deleted source side of the renumber. Nothing may write that path; its only permitted
change is the deletion that is already staged.

The reason:
- The renumber was an amendment at this ticket's PLAN, raised by the operator. A rename has two
  sides, and § 7 listed only one of them. That is a gap in the plan, not in your stage.
- The old content is still at `7a50eaa`, and the new file carries it, so the deletion loses nothing.
- Restoring ADR-076 stays rejected, for the reasons you gave.

The `check-carry` message calls the deleted path one that "exists on no ref". That wording is the
steward's to fix, not this ticket's.

**Amended:** `01-plan.md`:
- § 7: the path is added, with a note that it is a deletion only. That is twelve paths, so size
  stays M.
- Changelog row added.

`ticket.yaml` `allowed_paths` is updated to match. The gate is unchanged.
