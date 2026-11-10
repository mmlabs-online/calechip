---
ticket: MIR-03
from: developer
to: tech-lead-design
asked_at: 2026-10-20
round: 1
---

# Q1 — two existing test files outside `allowed_paths` break under ADR-065

**What happened.** With § 4.1–4.6 implemented, `pnpm exec vitest run` fails two files, both in
`beforeAll`, both for the reason ADR-065 exists:

- `tests/notifications.test.ts:140` — `as(FIXTURE_ADMIN.id); mock.setMemberRole(ADMIN_B, "admin")`,
  where `ADMIN_B` was approved onto `FIXTURE_OTHER_TEAM`.
- `tests/tasks.test.ts:105` — `as(FIXTURE_ADMIN.id); mock.setMemberRole(ADMIN_OTHER_TEAM, "admin")`,
  where `ADMIN_OTHER_TEAM` was approved onto `FIXTURE_OTHER_TEAM`. Its comment says
  *"`set_member_role` is any-team for an admin (ADR-044)."*

Each is refused twice now: the rank write refuses `admin` (AC-3), and the target is on another team
(AC-2). Plan § 4.6 says the whole suite must stay green and names only `tests/cross-team-role.test.ts`
as an existing test to edit; these two were not listed. Result: 2 files failed, 45 passed;
839 tests passed, 56 skipped.

**Proposed fix (fixture setup only, no assertion changes).** Seed the other team's admin the way
ADR-065 *Consequences* says is still possible: approve onto `FIXTURE_TEAM`, `promoteMember` as
`FIXTURE_ADMIN` (own team), then `moveMember(id, FIXTURE_OTHER_TEAM.id)`. The mock's `moveMember`
(`src/lib/data/mock.ts:2576`) admits an approved, non-removed admin. The person ends in the same
state as before (an admin on the other team), so every test that reads them is unchanged. Update the
ADR-044 comment in `tasks.test.ts` to cite ADR-065.

**Asked.** Add `tests/notifications.test.ts` and `tests/tasks.test.ts` to `allowed_paths` for that
narrow edit, or say what to do instead.

## Answer

**Approved (tech-lead-design, 2026-10-20).** Add `tests/notifications.test.ts` and `tests/tasks.test.ts` to `allowed_paths`, for the `beforeAll` fixture setup only: approve onto `FIXTURE_TEAM`, `promoteMember` as `FIXTURE_ADMIN`, then `moveMember(id, FIXTURE_OTHER_TEAM.id)`, and re-cite the comment in `tasks.test.ts` to ADR-065. No `it`, assertion or other line changes.

Verified: both files call `setMemberRole(<other-team id>, "admin")` at the lines named, which ADR-065 decisions 1 and 2 now refuse twice; the mock's `setRank` admits an own-team non-admin for `promoteMember`, and `moveMember` (`mock.ts:2576`) moves an approved, non-removed member without touching `role`, which is the two-step path ADR-065 *Consequences* names as still open until MIR-13. The person ends in the same state as before, so no test that reads them changes; this was a gap in plan § 4.6, now amended with a Changelog row.
