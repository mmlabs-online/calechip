---
ticket: MIR-16-g
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-08T06:19:51Z
inputs_read: [ .ai/board/tickets/MIR-16-g/01-plan.md, .ai/board/tickets/MIR-16-g/03-impl-log.md, .ai/board/tickets/MIR-16-g/ticket.yaml, .ai/templates/review-report.md, .ai/board/tickets/MIR-16-f/04-review.md ]
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

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed ⊆ `allowed_paths`; uncommitted carried | PASS | `node scripts/check-allowed-paths.mjs` → "ticket MIR-16-g, 15 changed file(s) … allowed-paths: PASS". The 8 `supabase/tests/` files in the diff are `allowed_paths` entries (`ticket.yaml:23-30`); the ADR-087 file, `MIR-16-h/ticket.yaml`, `MIR-17/ticket.yaml` are `ticket.yaml:20-22`; `backlog.md` is ship-owned; the rest is the ticket folder. `node scripts/check-carry.mjs MIR-16-g` → "0 uncommitted path(s) … PASS — nothing stray" |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. No `.ts` in the diff |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, no errors. The diff has no lintable files (`.sql`/`.psql`/`.md`/`.yaml` only) |
| R4 | Nothing bypasses the data-access seam (RULE-02) | PASS | No `src/` file in `git diff origin/main...HEAD --stat`. All writes are pgTAP fixtures in the `tests` schema, e.g. `supabase/tests/_isolation.psql:91` |
| R5 | Every §4 contract item implemented | PASS | See R5 detail. 11 of 11 |
| R6 | Permission gating matches §3 ("no change") | PASS | New helper `supabase/tests/_isolation.psql:73-77` is in the `tests` schema, `immutable`, `search_path = ''`, no grant; `put_on_team` stays `security invoker` (`_isolation.psql:90`). No policy, grant or function in `public` changed (no migration in the diff) |
| R7 | No invariant violated | PASS | See R7 detail. `invariants_touched: []` (`ticket.yaml:18`) is correct: the membership rows produced are the same as before (`_isolation.psql:75-76`, `:151-152` vs the removed `case when m.role = 'manager'` derivation) |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

**pgTAP run by the reviewer** (AC-6; the impl log did not run it). `pnpm exec supabase test db`:
34 files, 1311 tests; every file this ticket touches reports `ok` — `040`, `100`, `250`,
`270-member-team-id-dropped`, `300`, `310`, `320`, and all files loading `_isolation.psql`, except
one. The one failure is `supabase/tests/170-multi-team-decisions.test.sql:214-215` (test 42, "AC-20:
admin_u does not select E", have 1, want 0). This ticket did not cause it:

- It is already recorded as pre-existing in `.ai/board/tickets/MIR-16-f/04-review.md:84-92`.
- It is about `admin_u`. That row's team role was `member` before (`member.role` = `org_admin` ≠
  `'manager'`) and is `member` now (`tests.team_role_for('admin')` → else-branch,
  `_isolation.psql:75-76`). The seeded rows are the same.
- `170` is not in the diff.

It is outside `allowed_paths`, so it is not this gate's failure. It stays the open human chore that
MIR-16-f's review named. No `plan(n)` line appears in the diff.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 `tests.team_role_for(p_role text) returns public.team_role`, immutable, `'manager'`→manager else member | `supabase/tests/_isolation.psql:73-77` | yes, body identical to plan §4.1 |
| §4.1 `team_role_for` defined before `put_on_team` | `_isolation.psql:73` < `:87` | yes |
| §4.1 `tests.put_on_team(uuid, uuid, public.team_role default 'member')`, no read of `member.role` | `_isolation.psql:87-99`; team role is `p_team_role` at `:93` | yes. `m.role` no longer referenced in the body (AC-2) |
| §4.1 comment sentence (ADR-087) | `_isolation.psql:85-86` | yes |
| §4.1 `tests.seed()` passes `tests.team_role_for(v_person.role)` | `_isolation.psql:151-152` | yes. `manager_t`/`manager_u` carry word `'manager'` (`:127`, `:133`), so they get `manager` (AC-1) |
| §4.1 other two-arg callers get `'member'` | callers at `120:271-272`, `140:44-45`, `150:39`, `160:48`, `210:61-65`, `220:37-38`, `230:88-93`, `240:83-84`, `270-issue-reports:70-71`, `280:57-58`, `320:30` | yes. No member those files insert carries `'manager'` on `member.role`. The only `'manager'` hits there are `set_member_role` arguments or `team_role` values (e.g. `230:204`, `140:242`, `320:41`) |
| §4.2 `100:134` | `supabase/tests/100-mock-parity.test.sql:134-135` | yes (AC-4) |
| §4.2 `310:29` | `supabase/tests/310-manager-read-from-membership.test.sql:29` | yes |
| §4.2 `040:15` and `040:44` | `supabase/tests/040-member-self-writes.test.sql:15-16`, `:45` | yes |
| §4.2 `250:124`, `:219` | `supabase/tests/250-membership-self-lock.test.sql:124`, `:219` | yes, cast removed, plain literal |
| §4.2 `270:134` | `supabase/tests/270-member-team-id-dropped.test.sql:134-135` | yes |
| §4.2 `300:35` | `supabase/tests/300-org-admin-rename.test.sql:35-36` | yes |
| §4.2 `320:88` | `supabase/tests/320-set-member-role-team-role.test.sql:88-89` | yes |

**AC-5 versus the plan's own scope.** AC-5 (`01-plan.md:93-96`) says no file outside
`_isolation.psql` has a `'manager'::public.member_role` cast. One cast remains:
`supabase/tests/290-member-role-helper.test.sql:27`. The plan's out-of-scope list
(`01-plan.md:58-60`) sends `290` to MIR-16-h by name. `290` is also not in `allowed_paths`
(`ticket.yaml:19-30`), and §4 does not list it. The implementation matches the contract. The gap is
in the AC's wording, and it closes when MIR-16-h changes `290`. MIR-16-h's PLAN must include
`290:27`.

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:18`; `01-plan.md:102-103`). That leaves no ID to reason
about, so this checks whether the empty list is true.

| Invariant | Held by | Citation |
|---|---|---|
| (none listed). Checked that the list is correct | No migration, no `src/`, no `seed.sql` in the diff. Only the pgTAP `tests` schema changes. Each fixture produces the same `membership.team_role`. **Seed:** old body read `member.role = 'manager'`. `member.role` was `tests.member_role(word)`, so it was `'manager'` exactly when the word was `'manager'`, which is the condition `team_role_for` now tests. **100:** same reasoning, since `member.role` is `tests.member_role(p_role)`. **310:** Rae is inserted as `tests.member_role('manager')` and now gets an explicit `'manager'`. **Two-arg callers:** none inserts a manager, so they get `member` as before | `_isolation.psql:146`, `:151-152`, `:75-76`; `100-mock-parity.test.sql:128`, `:134-135`; `310-manager-read-from-membership.test.sql:28-29` |
| INV-04 (named by the plan as unaffected) | `joined_at`/`left_at`/`is_primary` in `put_on_team` are byte-identical to the previous body | `_isolation.psql:94-96` |

## Findings

None that gate.

**Not part of this gate (recorded so nobody loses them):**

- `supabase/tests/170-multi-team-decisions.test.sql:214-215` (test 42) still fails locally. It is
  pre-existing and is the same item as `.ai/board/tickets/MIR-16-f/04-review.md:84-92`. It is an
  open `OPS-nnn` chore for a human.
- `03-impl-log.md`'s *Contract items* table cites `_isolation.psql:94-98`, `:100-117` and `:150-152`.
  The code is actually at `:73-77`, `:85-99` and `:151-152`. The code is correct and the citations
  are stale. The R5 detail above uses the verified lines.
- Carry into MIR-16-h's PLAN: `290-member-role-helper.test.sql:27` (see the AC-5 note above).

## Verdict

PASS. All eight checks pass.
