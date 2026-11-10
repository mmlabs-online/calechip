---
ticket: MIR-21-d
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-07T04:31:21Z
inputs_read:
  - .ai/board/tickets/MIR-21-d/01-plan.md
  - .ai/board/tickets/MIR-21-d/03-impl-log.md
  - .ai/board/tickets/MIR-21-d/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261106130000_mir21c_membership_self_lock.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - "git diff origin/main...HEAD"
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

# MIR-21-d — review

Branch `feat/MIR-21-d`, tree clean at review time (`git status --porcelain` empty). Subject: `git diff
origin/main...HEAD`, 15 files, of which 11 are outside the ticket folder and `backlog.md`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-21-d, 15 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-21-d` → `0 uncommitted path(s)` … `PASS — nothing stray`. The 11 non-exempt paths match `ticket.yaml:19-29` one for one |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`), run by the reviewer, exit 0 with no output. No `.ts` file is in the diff |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`), run by the reviewer, exit 0 with no output. The diff has no lintable file (only `.sql` and board `.md`/`.yaml`). No out-of-diff errors to route |
| R4 | No datastore access outside the seam (RULE-02) | PASS | No path under `src/` is in the diff. Every change is under `supabase/`: `supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql:1-120`, `supabase/create-account.sql:150-152`, `supabase/tests/*`. The datastore's own functions and tests are the far side of the seam, not a bypass of it |
| R5 | Every plan § 4 contract item implemented | PASS | See R5 detail. pgTAP, `pnpm db:test`, run by the reviewer: `260-writers-stop-writing-team-id.test.sql … ok`, and 030, 040, 070, 140, 150, 160, 190, 230 each `ok` |
| R6 | Permission gating matches plan § 3 | PASS | Admin gate kept on all four: `…mir21d…sql:26`, `:52`, `:71`, `:103`. Same-org on admit/reject/move: `:40`, `:61`, `:86`, team-org on `:29-31`, `:74-76`. `set_member_team` limited to the caller's teams and the member's own roster team: `:110-111`. Self-move refused by `20261106130000_mir21c_membership_self_lock.sql:41`, reached through `…mir21d…sql:91`. Asserted with the exact message at `supabase/tests/260-writers-stop-writing-team-id.test.sql:138-141`, membership unchanged at `:144` |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | No `package.json` or `pnpm-lock.yaml` in the diff (`git diff --stat origin/main...HEAD`, 15 files listed, none a manifest). No new extension: the migration contains only `create or replace function` statements, `…mir21d…sql:23`, `:49`, `:68`, `:97` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `admit_member` — `set status` only, `membership_make_primary` verbatim | `supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql:35-40`, `:45` | Yes. `(p_member_id uuid, p_team_id uuid) returns void`, `security definer set search_path = ''` (`:23-24`). The rest is identical to `20261105210000_mir21b_writers_write_membership.sql:113-137` except `:126`'s `team_id = p_team_id` |
| § 4.1 `reject_member` — `set status` only | `…mir21d…sql:56-61` | Yes (`:49-50`). Identical to `mir21b…sql:139-156` except `:147`'s `team_id = null` |
| § 4.1 `move_member` — existence check with the same five predicates and the same raise, then `membership_make_primary` | `…mir21d…sql:80-89`, `:91` | Yes (`:68-69`). The predicates at `:82-86` are `mir21b…sql:172-176` verbatim, and the raise at `:88` is `mir21b…sql:178` verbatim |
| § 4.1 `set_member_team` — `select … into v_row`, same predicates, same raise and return | `…mir21d…sql:107-116` | Yes. `returns public.member`, `volatile security definer set search_path = ''` (`:97-99`). Predicates `:109-111` = `mir21b…sql:199-201` |
| § 4.1 file header: column stale from here on, self-move refusal now `membership_refuse_own_rows`'s, citing ADR-080 decision 2 | `…mir21d…sql:3-10` | Yes. Wrapped in `begin;` `:21` / `commit;` `:120`. Idempotency stated `:17` |
| § 4.2 260 — own fixture, members without `team_id`, `membership` inserted directly | `supabase/tests/260-writers-stop-writing-team-id.test.sql:39-54` | Yes. `\ir _isolation.psql` `:17`, `plan(18)` `:19`, helper `tests.m21d` `:21-29` with `c2600000-…` ids |
| § 4.2 AC-1 | `260…sql:57-72` | status `:64-65`, roster team `:66-67`, one active primary row `:68-72` |
| § 4.2 AC-2 | `260…sql:75-87` | status `:82-83`, roster null `:84-85`, no membership `:86-87` |
| § 4.2 AC-4 (run before AC-3, the reorder is logged in `03-impl-log.md:80-83`) | `260…sql:90-108` | returns M on T1 `:97-98`, T2 refused `42501` `:99-102`, membership unchanged by both `:105-108` |
| § 4.2 AC-3 | `260…sql:111-129` | roster T2 `:118-119`, T1 closed and not primary `:120-124`, only active row T2 primary `:125-129` |
| § 4.2 AC-5 — `throws_ok` with exact message, membership digest before/after | `260…sql:132-144` | `throws_ok` `:138-141`, message matches `mir21c…sql:41`. Digest helper `:32-37`, compared `:144` |
| § 4.2 AC-6 — `prosrc ~ '\mteam_id\s*='` over the four bodies = 0 | `260…sql:147-155` | Yes. Checked against the bodies by hand: the only `team_id` tokens are `p_team_id` (`…mir21d…sql:30`, `:45`, `:75`, `:91`, `:111`), where `\m` cannot match after `p_` |
| § 4.3 `create-account.sql` sets `status` only, comment reworded | `supabase/create-account.sql:150-152` | Yes. `membership_make_primary` is kept at `:156` |
| § 4.4 030 | `supabase/tests/030-member-reads.test.sql:12-13`, `:34-35`, `:62`, `:78` | Yes |
| § 4.4 040 | `040-member-self-writes.test.sql:43`, `:80` | Yes |
| § 4.4 070 | `070-definer-callers.test.sql:62`, `:70` | Yes |
| § 4.4 140 — `mirror_violations()` and its six `is(…)` retired, `plan` 42→36, `:178` read moved, header reworded | `140-org-stamping-and-membership-mirror.test.sql:13` (`plan(36)`), `:168`, `:1-3`. Function and the six `is(tests.mirror_violations() …)` are gone (branch diff) | Yes |
| § 4.4 150 | `150-write-path-org-bound.test.sql:128`, `:133` | Yes |
| § 4.4 160, plus `:92` found beyond the table (logged at `03-impl-log.md:71-72`) | `160-read-path-org-bound.test.sql:92-93`, `:96`, `:109` | Yes. The rule in plan § 4.4 is followed |
| § 4.4 190 | `190-system-admin.test.sql:129` | Yes |
| § 4.4 230 — drift helper loses the column disjunct and its last disjunct reads the roster team, `:249` rewritten, `:230`/`:331` moved, header reworded; plus `:168` found beyond (logged `03-impl-log.md:72-76`) | `230-writers-write-membership.test.sql:40-47` (`:46`), `:168`, `:229`, `:248`, `:329`, `:1-2` | Yes |

`pnpm db:test` (exit 1) also fails `170` test 42 and `220` tests 2 and 7. `170`:42 fails on `origin/main` too, per `MIR-21-b/03-impl-log.md` and `MIR-21-c/03-impl-log.md`. `220` AC-1 and AC-2 fail by design. `supabase/tests/220-roster-team-from-membership.test.sql:42-46` calls the writers this ticket changes, and `:66` and `:79` then assert that the column equals the roster team. Plan § 1 assigns their retirement to MIR-21-e, and so does ADR-080 decision 3 (`ADR-080…md:87`). The file is outside `ticket.yaml:18-29`. Implementing that assignment is not a contract defect, and `db:test` is not one of the four DoD commands (`.ai/01-operating-model.md:425`, `:430-432`).

## R7 detail

`invariants_touched: []` (`ticket.yaml:17`). Each invariant that a team-placement writer could reach was reasoned through anyway:

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — count only members still on the team on that date | Team tenure lives in `membership.joined_at`/`left_at`. A move still closes the old primary row with `left_at = now()` through `membership_make_primary`, unchanged. Removal still closes rows through the mirror's `removed_at` branch, which this ticket does not touch. `move_member` still refuses a removed member | `…mir21d…sql:91` → `mir21b…sql:59-63`; `mir21b…sql:367-371`; `…mir21d…sql:85` |
| INV-07 — an entry counts against every team its member belongs to | Membership rows are still written by the same helper for admit and move. No writer now relies on the column, and readers have used the roster team since MIR-21 | `…mir21d…sql:45`, `:91`; `mir21b…sql:65-72` |
| INV-01, INV-02, INV-03, INV-05, INV-06 | These are about entries. No function or table in the diff touches `public.entry`: the migration changes only the four member writers (`…mir21d…sql:23`, `:49`, `:68`, `:97`) | `.ai/registry/invariants.md:33-39` |

## Findings

None.

## Verdict

PASS.
