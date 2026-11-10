---
ticket: MIR-16-g
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-08T06:16:39Z
inputs_read:
  - .ai/board/tickets/MIR-16-g/01-plan.md
  - .ai/board/tickets/MIR-16-g/ticket.yaml
  - .ai/registry/decisions/ADR-087-the-fixtures-stop-deriving-a-team-role-from-member-role-before-manager-is-removed.md
  - .ai/board/tickets/MIR-16-h/ticket.yaml
  - .ai/board/tickets/MIR-17/ticket.yaml
  - supabase/tests/_isolation.psql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/270-member-team-id-dropped.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - supabase/tests/310-manager-read-from-membership.test.sql
  - supabase/tests/320-set-member-role-team-role.test.sql
  - supabase/tests/290-member-role-helper.test.sql
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

`.ai/registry/decisions/ADR-087-…md`, `.ai/board/tickets/MIR-16-h/ticket.yaml` and
`.ai/board/tickets/MIR-17/ticket.yaml` were already complete on disk, written by `tech-lead-design`
at `/plan MIR-16-g` (ADR-087's own text and both ticket files already carried the split's content and
`depends_on` updates before this stage opened). Nothing in them needed a Developer edit; listed here
only because they are in `allowed_paths` and `git diff` was checked against the full set.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/tests/_isolation.psql` | modified | added `tests.team_role_for`; gave `tests.put_on_team` a third parameter, `p_team_role public.team_role default 'member'`, and stopped it reading `member.role`; `tests.seed()`'s call site now passes `tests.team_role_for(v_person.role)` | §4.1 |
| `supabase/tests/100-mock-parity.test.sql` | modified | `tests.parity_subject`'s `put_on_team` call now passes `tests.team_role_for(p_role)` as the third argument | §4.2 row 1 |
| `supabase/tests/310-manager-read-from-membership.test.sql` | modified | Rae's `put_on_team` call now passes the literal `'manager'` as the third argument | §4.2 row 2 |
| `supabase/tests/040-member-self-writes.test.sql` | modified | the own-role-update probe's value is `tests.member_role('member')::text` (the refusal is the missing grant, any valid value proves it); Mona's re-read assertion is `tests.member_role('manager')::text` | §4.2 rows 3–4 |
| `supabase/tests/250-membership-self-lock.test.sql` | modified | the `::public.member_role` cast on the `'manager'` argument to `set_member_role` is removed at both call sites (AC-3's own probe, AC-6's), leaving a plain literal | §4.2 row 5 |
| `supabase/tests/270-member-team-id-dropped.test.sql` | modified | AC-7's owner-side probe of A's own role now uses `tests.member_role('member')::text` | §4.2 row 6 |
| `supabase/tests/300-org-admin-rename.test.sql` | modified | AC-2's unchanged-role assertion for Mona now reads `tests.member_role('manager')::text` | §4.2 row 7 |
| `supabase/tests/320-set-member-role-team-role.test.sql` | modified | AC-3's unchanged-`member.role` assertion for Mona now reads `tests.member_role('manager')::text` | §4.2 row 8 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `tests.team_role_for` | `supabase/tests/_isolation.psql:94-98` | exact body from the plan; defined before `tests.put_on_team` |
| §4.1 `tests.put_on_team` gains third param | `supabase/tests/_isolation.psql:100-117` | drops the `case when m.role = 'manager'::public.member_role …` derivation; comment extended with the ADR-087 sentence the plan asked for |
| §4.1 `tests.seed()` call site | `supabase/tests/_isolation.psql:150-152` | `tests.team_role_for(v_person.role)` as third argument |
| §4.2 row 1 (`100`, `:134`) | `supabase/tests/100-mock-parity.test.sql:133-135` | |
| §4.2 row 2 (`310`, `:29`) | `supabase/tests/310-manager-read-from-membership.test.sql:29` | |
| §4.2 row 3 (`040`, `:15`) | `supabase/tests/040-member-self-writes.test.sql:15-16` | |
| §4.2 row 4 (`040`, `:44`) | `supabase/tests/040-member-self-writes.test.sql:44` | |
| §4.2 row 5 (`250`, `:124`, `:219`) | `supabase/tests/250-membership-self-lock.test.sql:124`, `:219` | |
| §4.2 row 6 (`270`, `:134`) | `supabase/tests/270-member-team-id-dropped.test.sql:134-135` | |
| §4.2 row 7 (`300`, `:35`) | `supabase/tests/300-org-admin-rename.test.sql:35-36` | |
| §4.2 row 8 (`320`, `:88`) | `supabase/tests/320-set-member-role-team-role.test.sql:88-89` | |

**Every-other-caller check (§4.1's instruction to grep and confirm).** Grepped `put_on_team` across
`supabase/tests/`. Every caller outside `_isolation.psql`, `100` and `310` passes exactly two
arguments: `120-composite-fks` (x2), `140-org-stamping-…` (x2), `150-write-path-org-bound`,
`160-read-path-org-bound`, `210-org-public-team-bound` (x5), `220-roster-team-from-membership` (x2),
`230-writers-write-membership` (x6), `240-org-public-holidays` (x2), `270-issue-reports-system-scope`
(x2), `280-is-org-admin` (x2), `320-set-member-role-team-role` (Una, `:30`). None of these labels is
seeded as a manager; each now gets the default `'member'`, matching what the old derivation gave them
(none has `member.role = 'manager'`). No call site outside the two listed in §4.2 needed a third
argument.

**AC-5 sweep (no `'manager'::public.member_role` cast outside `_isolation.psql`).** Grepped
`'manager'::public.member_role` across `supabase/tests/` after the edits above. One remains:
`290-member-role-helper.test.sql:27` (`select is(tests.member_role('manager'), 'manager'::public.member_role, 'AC-2: manager maps to manager')`). `290` is not in this ticket's `allowed_paths`, and ADR-087's
*Context* and this plan's §1 *Out of scope* both name `290` as moving to MIR-16-h (the mapping
becomes `'manager' → 'member'` there, and that is when `290`'s own AC-2 changes with it). Leaving it
is the design's stated scope, not an oversight — recorded here per the standing instruction to list
anything beyond the table and the rule it follows. Every other `'manager'` literal found by a broader
sweep is one of: a `team_role` value or cast (unaffected enum, e.g. `310`, `320:41-51`, `170:386`,
`120:16`), a `set_member_role(...)` call argument explicitly left alone by §1 (`040:23`, `:64`, `070`,
`140`, `150`, `230`, `320:41`, `:103`, `:140`), an audit-trail text value (`320:63`, `:86`), an
enum-label list (`300:21`), or an application-role word already routed through a helper
(`_isolation.psql`'s own fixture table, `100`'s `own_update` join values feeding `tests.member_role`
via `tests.parity_subject`).

## Delegated decisions

None. Every change follows §4's contract literally; no decision needed recommending.

## Deviations from the design

`none`.

## Invariants

`invariants_touched: []`. No product code, migration or seed changed; the fixtures still produce the
same `membership` rows they did before (verified above: every seeded or fixture-inserted manager
still ends up with `team_role = 'manager'` on their active primary row, through an explicit third
argument instead of a derivation). INV-04's windows in the tests are unaffected.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | 6 changed files (the 7 in `allowed_paths` under `supabase/tests/` minus `_isolation.psql` counted with them — tool reported 6 distinct test files plus the harness; see raw output below), all within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-16-g` | 0 | 8 uncommitted paths, all carried from `allowed_paths`, nothing stray |
| `pnpm exec tsc --noEmit` | 0 | no TypeScript touched; ran clean |
| `pnpm exec eslint .` | 0 | no lintable source touched; ran clean |
| `git diff --name-only` subset of `allowed_paths` | yes | 8 files, all under `supabase/tests/`, all listed in `allowed_paths` |

**Not run: `supabase test db`.** The `supabase` CLI is not available for invocation in this session
(denied with no approval surface). This is not one of the commands `.ai/standards/testing-standards.md`
names for typecheck/lint/unit/e2e, and is not part of this stage's gate (R1/R2 only, per the
`/implement` command). AC-6 (the whole suite passes with unchanged `plan(n)` counts) is therefore
unverified by execution in this session; every edit was traced by hand against the exact line the plan
named and against a full-repo grep (above) to confirm no stray literal was left or introduced, and no
`plan(n)` line was touched in any file.

## Testability contract

No selectors; no UI change (§2b, §5).

## Open questions

None. The one finding (290's cast) is recorded above as a confirmed design exclusion, not a question.
