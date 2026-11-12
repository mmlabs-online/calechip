---
ticket: MIR-19-f
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-12T04:00:10Z
inputs_read: [ .ai/board/tickets/MIR-19-f/01-plan.md, .ai/board/tickets/MIR-19-f/03-impl-log.md, .ai/board/tickets/MIR-19-f/ticket.yaml, "git diff origin/main...HEAD", .ai/registry/invariants.md, .ai/registry/decisions/ADR-099-a-sign-up-at-an-org-address-lands-in-that-org-and-an-unknown-code-is-refused.md, .ai/standards/architecture.md, supabase/migrations/20261106130000_mir21c_membership_self_lock.sql, supabase/migrations/20261107230000_mir16b_is_org_admin.sql, supabase/migrations/20261104150000_mir18_system_admin.sql, supabase/tests/190-system-admin.test.sql, supabase/tests/010-catalogue.test.sql, supabase/tests/_isolation.psql ]
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

# MIR-19-f — review

Branch `feat/MIR-19-f`, tree clean at start (`git status --porcelain` empty), HEAD `b5b3dbf`.
Every command below was run by this reviewer, one per call.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-19-f, 15 changed file(s)` … `allowed-paths: PASS` (exit 0). `node scripts/check-carry.mjs MIR-19-f` → `0 uncommitted path(s)` … `PASS — nothing stray` (exit 0). Non-ticket paths in `git diff --stat origin/main...HEAD` are the ten Developer paths plus ADR-099, all listed at `.ai/board/tickets/MIR-19-f/ticket.yaml:19-29`; the rest are the ticket folder and `.ai/board/backlog.md` (ship-owned) |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` → `eslint .`, exit 0, no output (repo-wide, so every changed lintable file is covered) |
| R4 | Nothing outside the seam reaches the datastore | PASS | Seam is `src/lib/data/` (`.ai/standards/architecture.md:17`). The only datastore call changed is inside it (`src/lib/data/supabase.ts:1663-1674`). `src/routes/SignUp.tsx` reaches data only through `seam` (`src/routes/SignUp.tsx:15`, call at `:76`); `src/App.tsx:833` passes a prop and imports no client. `tests/signup-org.test.ts:24` imports the mock seam, not a client |
| R5 | Every § 4 contract item implemented | PASS | See *R5 detail* |
| R6 | Permission gating matches § 3 | PASS | Org resolved by the database, the client's code is an input only: `supabase/migrations/20261112150000_mir19f_sign_up_lands_in_org.sql:20-24`, written as `org_id` at `:52`, `:55`. Unknown/reserved code refused on insert: `:28-30`. Pending only, role hard-coded, no membership row: `:52-61` (no `status`, `'member'::public.member_role`). Never falls to the stamp fallback on confirmation: `:40-43`. Org admin bounds unchanged and already org-scoped: `20261107230000_mir16b_is_org_admin.sql:777-784` (`member_select_pending_admin` … `org_id = public.member_org_id(auth.uid())`), `:551-560` (`reject_member` `m.org_id = …`). Mock reproduces the `org_id` clause: `src/lib/data/mock.ts:1813` (list), `:3524` (count), `:1861` (decide). Sign-up itself ungated, as at the root: `src/App.tsx:832-834` |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:17`). Per-ID reasoning in *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty (0 lines). New imports in changed files are in-repo only (`tests/signup-org.test.ts:5-6`, vitest already a dev dependency) |

### Acceptance evidence

- `pnpm test` → `Test Files 62 passed (62)`, `Tests 1216 passed (1216)`, exit 0. Covers AC-10.1–10.4
  (`tests/signup-org.test.ts:40-104`) and AC-8's unedited `tests/signup-confirmation.test.ts`.
- `pnpm exec playwright test tests/e2e/mir-19-f-org-signup.spec.ts tests/e2e/mir-19-org-routing.spec.ts tests/e2e/tea-01-signup.spec.ts tests/e2e/solo-new-signups.spec.ts tests/e2e/mir-19-d-flip.spec.ts`
  (2 workers) → 41 passed, 1 failed: `mir-19-d-flip.spec.ts:84` AC-5 (`/shared/year/2026` where
  `/shared/year` was polled, `:91`). Rerun of that file alone, `--workers=1` → 10 passed, exit 0.
  The failing step is the year-link navigation of a signed-in member, which reaches no line this diff
  changes (the only routing change is the org-base `/signup` route, `src/App.tsx:832-834`). The impl
  log reports the same test failing under load and passing in isolation and on baseline. Load flake,
  not charged to this ticket; note N-1.
- AC-1 to AC-7 pass: `tests/e2e/mir-19-f-org-signup.spec.ts:20-77`. AC-11 passes:
  `tests/e2e/mir-19-org-routing.spec.ts:124-128` (title amended, `/shared/signup` stays), header line `:10`.
- AC-8, real seam: a root sign-up sends no `org_code` key — the spread is conditional on a truthy
  `orgCode` (`src/lib/data/supabase.ts:1671`), and the root route renders `<SignUp />` with the
  `null` default (`src/routes/SignUp.tsx:43`).
- **AC-9 (pgTAP) not executed by this reviewer**: no PostgreSQL on `/var/run/postgresql:5432`
  (`pg_isready` → no response) and no Docker daemon, so `pnpm db:test` cannot run here. CI runs it
  (`.github/workflows/verify.yml:99`). Note N-2. Static check of the file in its place:
  `plan(17)` (`supabase/tests/380-sign-up-lands-in-org.test.sql:13`) equals the 17 assertions at
  `:46-53` (4), `:60,63` (2), `:71,75` (2), `:83` (1), `:89-106` (4), `:114` (1), `:123,126` (2),
  `:133` (1). Fixture shape follows `370-own-org-code.test.sql:23-25`. The migration source names no
  `team_id` (grep empty), so AC-9.8 and `250-membership-self-lock.test.sql:249-251` hold.
  `190-system-admin.test.sql:108-112` (confirming a system admin's email lives, creates no row) still
  holds: no `org_code` resolves to Org public (`migration :20-21`), the member insert is refused by
  MIR-18's guard inside the sub-block and caught at `:62-65`.

### Migration body check

Diff of `20261112150000_mir19f_sign_up_lands_in_org.sql:13-70` against the live definition
`20261106130000_mir21c_membership_self_lock.sql:74-108`: the guards (`:32-37`), the hard-coded role,
the display-name and avatar coalesces, `on conflict (id) do nothing` and the warning text are unchanged.
Added: the `declare` (`:15-17`), the org resolution (`:20-24`), the insert-time refusal (`:28-30`), the
confirmation-time no-org exit (`:40-43`) and `org_id` in the insert (`:52`, `:55`). The outer
`exception when others` became an inner block around the insert (`:51-66`), which is what lets the
refusal at `:29` reach GoTrue, as § 4.1 specifies. No grant, trigger or policy statement in the file.
No later migration redefines the function (grep of `supabase/migrations` for
`function public.admit_allow_listed_member` ends at this file).

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 migration: header (decisions 2, 3, 5; IDEMPOTENT; RULE-09), `begin; … commit;` | `supabase/migrations/20261112150000_mir19f_sign_up_lands_in_org.sql:1-11`, `:70` | Yes |
| § 4.1 function re-created, same name, `returns trigger`, `language plpgsql security definer set search_path = extensions`; trigger untouched | `migration :13-14` | Yes |
| § 4.1 body in plan order: code/org resolution, insert-time `P0002 sign_up_org_unknown`, guards, no-org warning exit, insert with `org_id` inside `exception when others` | `migration :15-24`, `:28-30`, `:32-37`, `:40-43`, `:51-66` | Yes — statement for statement against plan § 4.1; prior comments kept at `:45-50`, `:63-64` |
| § 4.2 `SignUpInput.orgCode?: string \| null` with docblock | `src/lib/data/index.ts:64-69` | Yes |
| § 4.2 `DataSeam.signUp` signature kept, docblock sentence added | `src/lib/data/index.ts:312-313`, signature `:315` unchanged | Yes |
| § 4.3 `options.data` gains conditional `org_code`; `toFailure` not edited | `src/lib/data/supabase.ts:1666-1673`; `toFailure` at `:1340` absent from the diff | Yes |
| § 4.4.1 `mockRowOrgOf` beside `mockOrgOf` | `src/lib/data/mock.ts:586-589` | Yes |
| § 4.4.2 unknown code refused after `weak_password`, before `members.push`; dedicated code adds the id after the push | `src/lib/data/mock.ts:1694-1699`, `:1731-1732` | Yes — refusal returns before any push or credential |
| § 4.4.3 list and count gain the same `org_id` clause | `src/lib/data/mock.ts:1810-1813`, `:3521-3525` | Yes |
| § 4.4.4 `decideMember` target lookup gains the org clause; team check unchanged | `src/lib/data/mock.ts:1855-1862`, team check `:1865` unchanged | Yes |
| § 4.4 no export added to `seam` | `git diff` of `mock.ts` adds no `seam` key; `tests/seam-parity.test.ts` passes in `pnpm test` | Yes |
| § 4.5 `SignUpProps`, default export takes `{ orgCode = null }`, passes `orgCode` to `seam.signUp` | `src/routes/SignUp.tsx:38-43`, `:76` | Yes — the plan's `: JSX.Element` annotation is omitted; the plan made it conditional (*"if the return annotation needs it"*) and the inferred return type is the same |
| § 4.5 org-base `/signup` → `<BareLayout>` + `<SignUp orgCode={base.slice(1)} />`, same position; root `<SignUp />` and `org-path.ts` untouched | `src/App.tsx:830-834`; `src/lib/org-path.ts` not in the diff | Yes |
| § 4.6 pgTAP file shape and AC-9.1–9.8 | `supabase/tests/380-sign-up-lands-in-org.test.sql:9-140` | Yes — impl log's two deviations (Fay's role via `tests.member_role('admin')`, `_isolation.psql:107-112`; local `tests.shared_org_380()`, `:28-31`) are equivalent values / helpers, not contract changes |
| § 4.7 Vitest, `resetModules` + Confirm email ON, one `it` per AC-10 item | `tests/signup-org.test.ts:21-25`, `:40`, `:52`, `:67`, `:91` | Yes |
| § 4.8 new e2e, one test per AC-1–AC-7 | `tests/e2e/mir-19-f-org-signup.spec.ts:20-77` | Yes |
| § 4.8 routing spec AC-9 amended only, header line | `tests/e2e/mir-19-org-routing.spec.ts:10`, `:124-128`; signin/guest assertions after `:129` unchanged | Yes |

## R7 detail

`invariants_touched: []` (`ticket.yaml:17`). Every registered invariant
(`.ai/registry/invariants.md:33-39`) is about entries; this diff writes only `public.member` at sign-up
and the mock's member list. Reasoned per ID:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 (no overlapping portions per member/date) | No entry is written or read by the diff; the trigger inserts only into `public.member` | `migration :52` |
| INV-02 (approved entry returns to pending on edit) | No entry update path touched; mock entry writers not in the diff hunks | `src/lib/data/mock.ts` hunks at `:586-589`, `:1694-1732`, `:1810-1813`, `:1855-1862`, `:3521-3525` only |
| INV-03 (rejection reason non-empty) | Concerns entries; `decideMember` decides members, and the diff only narrows its target lookup | `src/lib/data/mock.ts:1856-1862` |
| INV-04 (one absence-count definition) | A pending row is on no team (no membership row written) so it adds to no team's count; no count function touched | `migration :52-61`; `380-…test.sql:52` asserts no membership row |
| INV-05 (tentative counts) | No entry or count code touched | same hunks as INV-02 |
| INV-06 (one portion per entry) | No entry written | `migration :52` |
| INV-07 (entry counted against every team of its member) | The new member has no team; the set "every team that member belongs to" stays empty until an org admin admits them through the unchanged `admit_member` | `migration :52-61`; `20261107230000_mir16b_is_org_admin.sql:551-560` |

## Findings

None that fail a check.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

Notes for a human, not gate findings:

- **N-1** — `tests/e2e/mir-19-d-flip.spec.ts:84` AC-5 failed once under 2 workers and passed alone
  (`--workers=1`). MIR-19-e's review recorded load flakes in other specs. Candidate `OPS-nnn` chore for
  e2e stability; outside this ticket's `allowed_paths`.
- **N-2** — `supabase/tests/380-sign-up-lands-in-org.test.sql` and the migration have not been executed
  by the Developer or this reviewer (no PostgreSQL here). CI's `database` job
  (`.github/workflows/verify.yml:99`, `pnpm db:test`) is the first execution; the merge gate should be
  read for it. Applying the migration to the hosted project is human (RULE-09).

## Verdict

`PASS`. Advances to DONE.
