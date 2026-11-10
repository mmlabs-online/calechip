---
ticket: MIR-06
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-23T09:11:03+07:00
inputs_read:
  - .ai/board/tickets/MIR-06/01-plan.md
  - .ai/board/tickets/MIR-06/03-impl-log.md
  - .ai/board/tickets/MIR-06/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD (14 files) and the working tree (clean)
  - supabase/tests/_isolation.psql and the nine 0n0-*.test.sql files
  - supabase/migrations/20261020180000_mir04_scoped_member_directory.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260905230000_adm06_reject_entries.sql
  - supabase/migrations/20260911090000_solo_busy_day.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

# MIR-06 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS`, exit 0 (14 changed files; `.ai/board/backlog.md` is ship-owned). `node scripts/check-carry.mjs MIR-06` → `0 uncommitted path(s) … PASS — nothing stray`, exit 0. `001-isolation-helpers.test.sql` not shipped, as plan § 7 requires when `\ir` is used (`supabase/tests/010-catalogue.test.sql:4`) |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 (`package.json:10`). No `src/` file in the diff |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint .` → exit 0, repo-wide (`package.json:11`). The diff holds no lintable file — `.sql` / `.psql` / `.md` only |
| R4 | No datastore access outside the seam | PASS | No file under `src/` changed (`git diff origin/main...HEAD --stat`); every statement is a pgTAP test against the database itself, e.g. `supabase/tests/020-entry-reads.test.sql:12-15` |
| R5 | Every plan § 4 contract item implemented | PASS | See *R5 detail* |
| R6 | Permission gating matches plan § 3 | PASS | Each § 3 row is asserted against the server-side holder it names, as a real role: entry reads `020-entry-reads.test.sql:12-59`; member reads `030-member-reads.test.sql:11-44`; own role/status/team `040-member-self-writes.test.sql:15-28`; entry decide/edit/delete and team/member writes `050-cross-team-writes.test.sql:13-42`; removed/pending `060-removed-and-pending.test.sql:14-41`; definer RPCs `070-definer-callers.test.sql:39-111`; signed out `010-catalogue.test.sql:82-105`, `080-guest-tokens.test.sql:18-33` |
| R7 | No invariant violated | PASS | See *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD --name-only -- package.json pnpm-lock.yaml` is empty. pgTAP is created `if not exists` inside the rolled-back transaction (`supabase/tests/_isolation.psql:7`), the extension MIR-05's harness already uses |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 file layout, per-file shape (`begin; \ir; plan; seed; …; finish; rollback`) | `010-catalogue.test.sql:3-9,107-108`; same shape in each of `020`…`090` (e.g. `090-event-boundaries.test.sql:4-7,112-113`) | Yes. `010` and `080` add `set local search_path = extensions` (`010:7`, `080:7`) — transaction-local, changes only how `regprocedure` text prints |
| § 4.1 `\ir` vs fallback | `_isolation.psql:1-2`; `001-isolation-helpers.test.sql` absent | Yes. `TODO(verify)` resolved for psql only; container mount unverified (impl log § Contract items) |
| § 4.2 `tests` schema + grants | `_isolation.psql:9-10,167` | Yes |
| § 4.2 `tests.seed()` | `_isolation.psql:74-165` | Yes |
| § 4.2 `tests.authenticate_as(uuid)` | `_isolation.psql:32-39` | Yes — claims `sub`+`role`, role `authenticated`, both local |
| § 4.2 `tests.authenticate_anon()` | `_isolation.psql:42-48` | Yes |
| § 4.2 `tests.clear_authentication()` | `_isolation.psql:51-57` | Yes |
| § 4.2 `tests.rows_affected(text)` | `_isolation.psql:61-70` | Yes |
| § 4.3 fixed uuids, labels | `_isolation.psql:14-28` | Deviation 1: an immutable `tests.id(label)` instead of psql constants; same labels and NN. Accepted — a psql variable cannot be read inside a pgTAP SQL string |
| § 4.3 fixture rows | `_isolation.psql:79-163` | Yes — two teams 0.5/true/true (`:79-81`), twelve people with `email_confirmed_at` null (`:84-108`), three entries (`:111-117`), four events (`:119-123`), busy_day/task/notification/issue_report (`:125-138`), invitees (`:140-142`), attendance (`:144-146`), four links a–d (`:148-152`), two guests e/f (`:155-159`), two email invitations (`:161-163`) |
| § 4.4 AC-2 | `020-entry-reads.test.sql:9-53`; control `:63-74` | Yes |
| § 4.4 AC-3 | `030-member-reads.test.sql:8-44`; controls `:47-79` | Yes; `list_member_directory` rows under `todo` F-3 (`:19`, `:40`) |
| § 4.4 AC-4 | `040-member-self-writes.test.sql:9-39`; re-read `:42-49` | Yes, 3 callers × 7 refusals |
| § 4.4 AC-5 | `050-cross-team-writes.test.sql:10-33`; re-reads `:45-60`; control `:63-66` | Yes, all seven statements |
| § 4.4 AC-6 | `050-cross-team-writes.test.sql:36-42`; control `:83-85` | Yes |
| § 4.4 AC-7 / AC-8 | `060-removed-and-pending.test.sql:9-55` | Yes — 12 tables, own `member` row (`:21`), 8 RPCs, `member_role_change` 42501 (`:40`), × `removed_t`, `removed_admin_t`, `pending_p` |
| § 4.5 AC-12 census | `010-catalogue.test.sql:16-78` | Yes — 19 RPC + 10 predicate + 6 guest + 17 trigger, matching every name in plan § 4.5 |
| § 4.5 AC-9 RPC table, every row and caller | `070-definer-callers.test.sql:39-111` | Yes — each row's callers, arguments and refusal form; writes re-read at `:46,50,55,61,70,78,96,102` |
| § 4.5 controls | `070-definer-callers.test.sql:114-135` | Yes, all four |
| § 4.6 AC-10 privileges | `010-catalogue.test.sql:81-105` | Yes; six-function set under `todo` F-1 (`:81`) |
| § 4.6 AC-10 anon table selects | `080-guest-tokens.test.sql:13-33` | Yes — AC-7's 13 tables + `holiday` + `member_role_change`; `busy_day` under `todo` F-2 (`:31`) |
| § 4.6 AC-11 | `080-guest-tokens.test.sql:37-106` | Yes — column shapes (`:37-48`), t₁ (`:52-63`), m₁ (`:64-67`), unknown token (`:70-77`), t₂ control (`:80-87`), cancel m₁ only (`:90-96`), deleted t₁ (`:99-106`) |
| § 4.7 mirror, all 18 rows | descriptions quote each mock location: `020:14,19,23,33,59`; `030:17,28,57`; `050:15,27,30,33`; `070:75,83-88,118,121`; `090:44,61,77-80,88,101` | Yes. Deviation 2 at `090-event-boundaries.test.sql:17` inserts `(event_id)` only: plan's `(event_id, member_id)` would raise on the column grant (`supabase/migrations/20260929140000_evt02_attendance.sql:406`), so the refusal would come from the wrong lock and the `member_t2` control (`090:82`) could never pass. The boundary under test is `event_attendance_insert_own` (`evt02:366-371`). Accepted as the only implementable reading |
| AC-1 role check per file | `010:12`, `020:10`, `030:9`, `040:34`, `050:11`, `060:47`, `070:35`, `080:29`, `090:42` | Yes |
| AC-13 controls | listed per row above | Yes |
| AC-14 `todo()` form | `010:81`, `030:19,40`, `080:31` — text starts `MIR-06 finding F-<n>:`; each in `03-impl-log.md` § Findings with the migration line | Yes. F-1 checked: `tea01_membership.sql:70` revokes `from public` only; F-2 checked: `solo_busy_day.sql:79` revokes `from authenticated` only |

## R7 detail

`invariants_touched: []`. No migration, policy, trigger or grant is in the diff. The plan names three
invariants the fixture writes rely on; each checked:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 | Fixture entries do not overlap per member — `member_t` and `member_u` 11-02..03, `member_u2` 11-04; constraint untouched | `supabase/tests/_isolation.psql:111-117` |
| INV-02 | The only edits of an existing entry are status decisions and a note edit, neither a date/type/portion change; trigger untouched | `050-cross-team-writes.test.sql:65,76,84` |
| INV-03 | Every reject statement carries `rejection_reason = 'x'` | `050-cross-team-writes.test.sql:17,41,84` |
| INV-07 | Each entry is inserted with one `member_id`; team moves go only through the existing RPCs | `_isolation.psql:111-117`; `040-member-self-writes.test.sql:74` |

## Findings

None against R1–R8.

Not gate items, recorded for the operator:

- **F-3 is a mis-specified AC-3, not a hole.** `list_member_directory()` admits the creator of an event
  the caller reads and its attending members (`supabase/migrations/20261020180000_mir04_scoped_member_directory.sql:33-45`,
  ADR-066). `event_u_public` is public scope, so `member_u` and `member_u2` are visible to T by
  design. As shipped, the two `todo` rows at `030-member-reads.test.sql:19,40` describe accepted
  behaviour as a finding and will never turn green. Needs a decision on AC-3 (impl log § Open
  questions 1).
- **The suite has not run on the Supabase image.** `pnpm db:test` needs Docker, absent on the
  developer's machine and on this one; CI runs it on `release/**` only. F-1 and F-2 depend on the
  image's default privileges; if they differ, those TODOs pass unexpectedly and the suite still exits 0.
- F-1 and F-2 each need a migration ticket.

## Verdict

PASS. MIR-06 advances to DONE.
