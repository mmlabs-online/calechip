---
ticket: TEA-01
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-08-31T15:52:48Z
revision_of: 2026-08-31T15:08:58Z
branch: feat/TEA-01
inputs_read:
  - .ai/board/tickets/TEA-01/ticket.yaml
  - .ai/board/tickets/TEA-01/01-story.md          # revision of 2026-08-31T09:23:25Z
  - .ai/board/tickets/TEA-01/02-design.md         # revision of 2026-08-31T15:35:07Z, incl. 6.2-6.4 and Appendix A
  - .ai/board/tickets/TEA-01/03-impl-log.md       # revision of 2026-08-31T15:45:55Z
  - .ai/registry/rules.md
  - .ai/registry/invariants.md                    # doc_version 3 — INV-04 amended by ADR-013
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/session-model.md
  - .ai/01-operating-model.md
  - eslint.config.js
  - .claude/hooks/guard-allowed-paths.mjs
  - git diff --name-only, git ls-files --others --exclude-standard
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
# RULE-13 DISCLOSURE — read this before reading the verdict.
# This second pass was run in the SAME session that produced the 15:08:58Z verdict, not a fresh one.
# .ai/standards/session-model.md gives tech-lead-review an ephemeral lifetime closing "after each
# verdict, including a re-review", and says a re-review never reuses the session that produced the
# previous verdict. The reviewer stopped and put this to the operator, who directed it to proceed
# here. Recorded in front-matter rather than in chat so the verdict is readable as what it is: every
# check below was re-derived from the current files and every command was re-run, but the session
# carried its own prior PASS into the pass, which is the exposure RULE-13 exists to remove.
---

# TEA-01 — Sign up and establish the member record — review

Second pass. The first (`15:08:58Z`) passed with no findings; the QA gate then failed at `15:18:06Z`
and routed one failure to the Developer and two to `tech-lead-design`. The design was amended twice
— §6.2, §6.3, §6.4 and Appendix A — and `03-impl-log.md` of `15:45:55Z` changed three files:
`src/lib/data/index.ts`, `src/routes/SignUp.tsx` and `src/App.tsx`.

Files only. No message channel to the Developer existed and none was used.

**Every check below was re-derived from the tree as it stands now**, and every command was re-run in
this pass rather than quoted from `03-impl-log.md` or from the previous revision of this file. Where
the log and this report cite the same line, the line was opened.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | ten files, all matching a glob in `ticket.yaml`; scoping evidence below |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` re-run this pass → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` re-run this pass → exit 0, no output |
| R4 | Nothing outside the seam reaches the datastore directly (RULE-02) | PASS | `src/lib/data/supabase.ts:10` is the only `@supabase/*` import under `src/`; `src/lib/data/index.ts:11-12` are the only imports of an implementation |
| R5 | Every contract item in design section 1 is implemented (RULE-04) | PASS | eighteen section-1 items plus the four added by §6.2 and §6.3; table below |
| R6 | Permission gating matches design section 2 | PASS | `supabase/migrations/20260831150024_tea01_membership.sql:138-172` |
| R7 | Every selector in design section 6 exists in the markup | PASS | eleven selectors, including `seam-banner` added at `15:24:54Z`; table below |
| R8 | No invariant violated (RULE-07) | PASS | per-ID table below, against `invariants.md` at `doc_version: 3` |
| R9 | No dependency added without an ADR | PASS | `git diff --stat -- package.json pnpm-lock.yaml` empty; `react-router-dom` was already a dependency before this ticket |

## R1 detail — what was compared, and against what

The complete set of modified-or-untracked files under `src/`, `tests/` and `supabase/`, each against
the glob it satisfies in `ticket.yaml`:

| File | Glob | Written by |
|---|---|---|
| `supabase/migrations/20260831150024_tea01_membership.sql` | `supabase/migrations/*.sql` | developer, cycle 1 |
| `supabase/seed.sql` | `supabase/seed.sql` | developer, cycle 1 |
| `src/App.tsx` | `src/App.tsx` | developer, cycles 1 and 2 |
| `src/lib/domain/types.ts` | `src/lib/domain/types.ts` | developer, cycle 1 |
| `src/lib/data/index.ts` | `src/lib/data/index.ts` | developer, cycles 1 and 2 |
| `src/lib/data/supabase.ts` | `src/lib/data/supabase.ts` | developer, cycle 1 |
| `src/lib/data/mock.ts` | `src/lib/data/mock.ts` | developer, cycle 1 |
| `src/lib/fixtures.ts` | `src/lib/fixtures.ts` | developer, cycle 1 |
| `src/routes/SignUp.tsx` | `src/routes/SignUp.tsx` | developer, cycles 1 and 2 |
| `tests/e2e/tea-01-signup.spec.ts` | `tests/e2e/tea-01-signup.spec.ts` | qa |

Ten of ten inside `allowed_paths`. **No file was added by the rework**, which is what keeps `size` at
M: `02-design.md` section 5 states that a thirteenth file tips this ticket to L, and §6.2 says in
terms that its change needs no new file. `src/vite-env.d.ts` and `playwright.config.ts` are both
outside `allowed_paths` and both are unmodified, which matters because `VITE_DATA_SEAM` is a new
environment variable and a typing or config edit for it would have been the natural thirteenth file.

`src/lib/data/mock.ts` and `src/lib/data/supabase.ts` carry cycle-1 mtimes and were not touched by
the rework, matching `03-impl-log.md`'s claim of three changed files.

**The tree also carries changes outside `allowed_paths`, and there is more of it than at the first
pass** — `ADM-01..03`, `CAL-01..08`, five ADRs, and steward edits to `.ai/registry/glossary.md`,
`.ai/registry/invariants.md`, `.ai/registry/features.md`, `.ai/standards/rbac-and-security.md`,
`.ai/standards/data-model.md` and `.ai/board/**`. It is not this Developer's, and that was
re-established this pass rather than carried over:

- The ticket's own stage artifacts (`01-story.md`, `02-design.md`, `03-impl-log.md`,
  `05-test-plan.md`, `06-test-report.md`, `99-questions.md`, `ticket.yaml`) are the loop's outputs.
  `.claude/hooks/guard-allowed-paths.mjs:8-11` allows the ticket folder unconditionally, and the
  stage-ownership table in `.ai/01-operating-model.md:82` assigns each to the stage that wrote it.
- The registry, standards and other ticket folders are `/triage` and steward work. Content is
  decisive — the `invariants.md` diff is ADR-013's amendment to INV-04, which is a registry change
  requiring human approval under RULE-01 and contains no sign-up code. Mechanism is decisive too:
  `guard-allowed-paths.mjs:1-15` blocks any Edit or Write outside `allowed_paths` on a `feat/`
  branch, and none of those paths is in this ticket's list.
- `_figma/.figma/make/site.json` predates both implementation cycles and is excluded from lint at
  `eslint.config.js:22`.

Separating these onto their own branch is `/ship`'s job (`CLAUDE.md`, *Working agreements*). R1 is
evaluated against the ten files above; a FAIL charged to the Developer here would burn a rework
increment under RULE-08 for files the guard prevented them from touching and that they cannot fix.

## R5 detail

Section 1 first. Every item was re-opened this pass; the line numbers in `src/lib/data/index.ts`,
`src/App.tsx` and `src/routes/SignUp.tsx` moved in the rework and are re-read, not carried over.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §1.1 `MemberRole` | `src/lib/domain/types.ts:8` | yes — `"member" \| "admin"` |
| §1.1 `Member` | `src/lib/domain/types.ts:11-19` | yes — seven fields, `removedAt: string \| null` |
| §1.1 `AuthUser` | `src/lib/domain/types.ts:22-26` | yes |
| §1.1 `Session` | `src/lib/domain/types.ts:28-31` | yes |
| §1.1 `FailureCode` | `src/lib/domain/types.ts:34-40` | yes — six codes, no seventh added by the rework |
| §1.1 `Failure` | `src/lib/domain/types.ts:42-45` | yes |
| §1.1 `Result<T>` | `src/lib/domain/types.ts:47` | yes |
| §1.1 `AVATAR_CHOICES` | `src/lib/domain/types.ts:60-73` | yes — `readonly string[]`, twelve values, `TODO(project)` carried |
| §1.2 `SignUpInput` | `src/lib/data/index.ts:14-19` | yes — four fields |
| §1.2 `SignUpOutcome` | `src/lib/data/index.ts:21-26` | yes |
| §1.2 `DataSeam.ready` | `index.ts:31`, `supabase.ts:96`, `mock.ts:57` | yes — unchanged, arity 0 |
| §1.2 `DataSeam.signUp` | `index.ts:38`, `supabase.ts:107`, `mock.ts:69` | yes — arity 1, `Promise<Result<SignUpOutcome>>` in both |
| §1.2 `DataSeam.getOwnMember` | `index.ts:49`, `supabase.ts:129`, `mock.ts:103` | yes — arity 1, `Promise<Member \| null>` in both |
| §1.2 `needsEmailConfirmation` semantics | `src/lib/data/supabase.ts:121` | yes — `data.session === null` |
| §1.3 routed shell | `src/App.tsx:12-38` | yes — `/signup` at `:31`, catch-all `Navigate` at `:35`, `app-root` on the element wrapping `<Routes>` at `:13` |
| §1.4 `SignUpFormState` | `src/routes/SignUp.tsx:15-18` | yes — three phases, `submitted` terminal at `:61-73` |
| §1.4 submit disabled until complete | `src/routes/SignUp.tsx:31`, `:161` | yes — all four fields, with the affordance-not-a-control comment at `:27-30` as ADR-005 requires |
| §1.5 fixtures | `src/lib/fixtures.ts:12,25,36,39,42` | yes — the five named exports, fixed uuid literals, mirrored in `supabase/seed.sql:16-84` |

The four items the amendment added, checked to the same standard because §6.2 specifies them in code
and RULE-04 therefore binds them:

| Item | Implemented at | Matches |
|---|---|---|
| §6.2 `usesMock` | `src/lib/data/index.ts:65` | yes — `VITE_DATA_SEAM === "mock" \|\| !VITE_SUPABASE_URL`, character-for-character the design's expression |
| §6.2 `seamName` | `src/lib/data/index.ts:72` | yes — `"mock" \| "supabase"` |
| §6.2 `seam` | `src/lib/data/index.ts:74` | yes — `DataSeam`, resolved from `usesMock` |
| §6.2 nothing above the seam names an implementation | `src/routes/SignUp.tsx:11` | yes — `{ seam } from "@/lib/data"`. `grep -rn "lib/data/supabase\|lib/data/mock"` over `src/` returns only `index.ts:11-12` |
| §6.3 terminal state on `ok: true` | `src/routes/SignUp.tsx:52`, rendering at `:61-73` | yes — `signup-confirm-notice` |
| §6.3 terminal state on `ok: false` | `src/routes/SignUp.tsx:52`, rendering at `:152-156` | yes — `signup-error`, phase back to `editing` |
| §6.3 terminal state on **throw** | `src/routes/SignUp.tsx:53-58` | yes — the row that was missing. `catch` sets `phase: "editing"` with an `unknown` `Failure`, so `signup-error` renders and `:161`'s `disabled` clears |

**No name was invented.** `seamName`, `seam`, `usesMock`, `VITE_DATA_SEAM`, `seam-banner` and
`data-seam` all appear in `02-design.md` §6.2 and §6; the catch reuses the existing `unknown`
`FailureCode` rather than adding one.

**The import cycle §6.2 creates was checked rather than assumed.** `index.ts:11-12` import values
from `./mock` and `./supabase`; both import back from `./index` with `import type` only
(`mock.ts:8`, `supabase.ts:11`), which is erased at build, so there is no runtime cycle. Eager client
construction — the failure that would have made this arrangement crash on import — does not occur:
`supabase.ts:26-31` builds lazily.

Parity is asserted mechanically as well as by inspection: `pnpm exec vitest run` re-run this pass →
2 tests passed, `tests/seam-parity.test.ts` still unedited.

**§1.2's three deliberate absences are still absent.** No `signIn`/`signOut`/`getSession`/
`onSessionChange` in `src/lib/data/index.ts:29-50`; no `listAllowedEmails`; no permission check in
either implementation — `supabase.ts:95-143` and `mock.ts:56-105` contain no role branch.

## R6 detail

`02-design.md` section 2 is unchanged by the amendment, and so is the migration — it carries a
cycle-1 mtime and no rework touched it. The file was re-opened and the line numbers below re-read.
Under ADR-005 this check is read against the migration, never against TypeScript.

| Design section 2 row | Where the gate is, as built |
|---|---|
| Sign up — no gate, by design | no policy or grant governs it; the gate is the trigger at `migration:78-136` |
| Read own `member` row — `member_select_own` | `migration:153-155`, `for select to authenticated using (id = (select auth.uid()))` |
| Read another member's row — denied by absence | `migration:153-164` declares exactly two policies; neither widens `member` |
| Insert / update / delete `member` — denied by absence | `grep -n "for insert\|for update\|for delete\|for all"` over the migration returns nothing; `migration:166-172` states it and says why |
| Read the allow-list — `allowed_email_select_admin` | `migration:159-164` — AC-11 and AC-12 |
| Insert / update / delete allow-list — denied by absence | same grep, nothing |
| Read `team` — RLS on, no policy | `migration:138` enables it; no `team` policy exists in the file |

The three load-bearing denials section 2 names as easy to lose are each held:

1. **No insert policy on `member`.** `migration:166-172`. The trigger at `:78` is `security definer`
   and is the only writer.
2. **`role` is never read from user metadata.** `migration:118` writes the literal
   `'member'::public.member_role`. `raw_user_meta_data` is read at `:115` and `:117` only, for
   `display_name` and `avatar`; grepping the file for `role` on a metadata line returns only the
   comment at `:118`, so there is no `->> 'role'` anywhere.
3. **The `authenticated` grants are explicit, not inherited.** `migration:145` revokes all on all
   three tables from `anon` and `authenticated`; `:146-147` grant `select` on `member` and
   `allowed_email` and on nothing else. `team` receives no grant.

`public.is_admin` and `public.member_team_id` are `security definer` with `set search_path = ''` and
fully qualified relations (`migration:54-68`); execute is revoked from `public` and granted to
`authenticated` only (`:70-71`), which the two policies require since a policy is evaluated as the
calling role.

**One thing re-checked because the standards moved under this ticket.**
`.ai/standards/rbac-and-security.md` was amended this cycle to confirm `Read the member list` as ✅
for a `member`. That widening belongs to TEA-03 and section 2 says so on its own row; TEA-01's
`member_select_own` is narrower than the eventual target rather than in conflict with it, so the
amendment changes nothing here.

## R7 detail

Eleven selectors, one more than at the first pass.

| Selector | Exists at |
|---|---|
| `app-root` | `src/App.tsx:13` |
| `seam-banner` | `src/App.tsx:21`, with `data-seam="mock"` at `:22`, rendered only when `seamName === "mock"` (`:19`) |
| `signup-form` | `src/routes/SignUp.tsx:79` |
| `signup-email` | `src/routes/SignUp.tsx:88` |
| `signup-password` | `src/routes/SignUp.tsx:100` |
| `signup-display-name` | `src/routes/SignUp.tsx:114` |
| `signup-avatar-picker` | `src/routes/SignUp.tsx:126` |
| `signup-avatar-option` | `src/routes/SignUp.tsx:135`, one per `AVATAR_CHOICES` entry, with `data-avatar` at `:136` |
| `signup-submit` | `src/routes/SignUp.tsx:159` |
| `signup-error` | `src/routes/SignUp.tsx:153` |
| `signup-confirm-notice` | `src/routes/SignUp.tsx:64` |

`seam-banner` satisfies §6's requirement in both directions: it is conditioned on `seamName` at
`src/App.tsx:19`, so it is present on a build that resolved to the mock and absent on one that
resolved to the real implementation, and it carries `data-seam="mock"` so a test can assert which
implementation it drove rather than infer it.

`signup-submit`'s `disabled` at `src/routes/SignUp.tsx:161` is `!complete || submitting`, and
`submitting` is derived from the phase at `:75`. Every path out of `onSubmit` leaves the phase as
`submitted` (`:52`), `editing` with an error (`:52`), or `editing` with an error (`:53-58`) — so
there is no path that leaves the button disabled with no terminal state beside it, which is the
property §6's `signup-submit` row now asserts.

## R8 detail

One row per ID in `invariants_touched`, reasoned against `.ai/registry/invariants.md` at
**`doc_version: 3`** — INV-04 was amended by ADR-013 between the two passes, so this row was
re-derived against the new text rather than the old.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | **No definition is added.** `invariants.md:36` makes the *uniqueness* of the definition the invariant, and this ticket computes no count: `grep -rni "absence\|overload\|threshold" src/` returns one hit, `overloadThreshold` as an inert fixture field never read by any code. The amendment **increases** what this ticket must get right rather than what it must avoid: INV-04 now reads *"whose member was still on the team on that date"*, so the count depends on `member.removed_at`, and the migration creates that column nullable with no default and the trigger's insert omits it, which writes null — an active member, which is what a newly admitted one is. Nothing in this ticket ever sets it: there is no update policy on `member` and the trigger contains no `update public.member`. The denominator exposure the first pass reasoned about also still holds — the trigger's first guard returns without admitting anybody while `email_confirmed_at is null`, so an unconfirmed account never enters the team's current member count. | `src/lib/fixtures.ts:15`; `migration:37`; `migration:111-122`; `migration:91-93`; `migration:166-172` |
| INV-07 — one member, one team | `member.team_id` is `not null` and references `team(id)`, so no member can exist without exactly one team. The single insert that creates a member takes `team_id` from `v_team_id`, set only by the `update ... returning` against the claimed allow-list entry and from nowhere else. There is no second writer — no insert policy on `member`, and `revoke all` plus `grant select` is the whole `authenticated` privilege. A member cannot acquire a second team on a later confirmation: the `tg_op = 'UPDATE' and old.email_confirmed_at is not null` guard returns first, and `on conflict (id) do nothing` is the backstop behind it. The mock upholds the same rule. | `migration:33`; `migration:101-114`; `migration:94-96`; `migration:122`; `migration:145-147`; `src/lib/data/mock.ts:88` |

Neither invariant is violated. Nothing escalates under RULE-07.

**The rework touched no path either invariant runs through.** The three changed files are the seam
resolver, the sign-up screen and the routed shell; none writes to `member`, and `src/lib/data/mock.ts`
— which holds the mock's INV-07 guarantee — carries a cycle-1 mtime and was not edited.

**The exception handler at `migration:125-131` was reasoned through again rather than carried over.**
A PL/pgSQL block with an `exception` clause establishes an implicit savepoint at its `begin`, so a
failure inside it rolls the `update` of `allowed_email` back together with the `insert` into
`member`. There is no path that consumes an allow-list entry and creates no member, and none that
creates a member and leaves the entry unconsumed.

## Findings

None. No check failed.

## Verdict

`PASS`. TEA-01 advances to QA.

Four things this gate did **not** treat as findings, recorded because a later reader will otherwise
wonder whether they were seen.

- **The session that produced this verdict is not fresh.** See the RULE-13 disclosure in the
  front-matter. It is not a finding against the implementation; it is an exposure on this artifact.
- **`src/routes/SignUp.tsx:11` still skips the hook layer.** §6.2 closed the half that caused QA's
  failure — nothing above the seam names an implementation any more — and the hook layer of
  `.ai/standards/architecture.md:59-76` is still skipped. It is not an R4 failure on R4's terms: the
  component reaches the seam, not the datastore, and imports no Supabase client. A hook is the
  thirteenth file that `02-design.md` section 5 says tips this ticket to L, so it belongs to whoever
  designs the sign-in half, where `useSession.ts` already lands.
- **The end-to-end suite is green and that is not coverage of this ticket.**
  `pnpm exec playwright test` was re-run this pass: **8 passed**, up from 3 passed / 5 failed at the
  QA gate, and `tests/e2e/tea-01-signup.spec.ts` was not edited to make them so. Those eight run
  against the mock. §6.2 says in terms that they prove the screen and the mock's imitation of the
  trigger and prove nothing about the policies or the real trigger — so R6 and R8 above are verified
  by reading SQL that has never been executed, and this report must not be read as evidence that the
  policies work.
- **Ten of the twelve criteria still have no test**, because `tests/permission-model.test.ts` needs a
  disposable database that does not exist. The operator chose to provision it and §6.4 plus Appendix
  A specify the chore; `product` assigns it an `OPS-nnn` at `/triage`. **This is a QA-gate matter, not
  a REVIEW one** — the R-checks do not include test coverage — but it is the reason a PASS here does
  not put TEA-01 near DONE.

One thing that belongs to the `orchestrator` and to no check on this list: `ticket.yaml` reads
`rework_count: 0` while `03-impl-log.md` records QA failure 1 as Developer-caused. Per RULE-08's
third column that cycle increments the count, and RULE-06's budget escalates at two. This reviewer
does not write `ticket.yaml`.

## Changelog

- `2026-08-31T15:08:58Z` — first pass, against `02-design.md` of `09:34:46Z` and `03-impl-log.md` of
  `15:02:29Z`. Nine files. R1-R9 all PASS, no findings. Raised by `tech-lead-review`.
- `2026-08-31T15:52:48Z` — second pass, against `02-design.md` of `15:35:07Z` (§6.2, §6.3, §6.4,
  Appendix A) and `03-impl-log.md` of `15:45:55Z` (three files reworked). R5 gained the seven items
  §6.2 and §6.3 specify in code; R7 gained `seam-banner`; R8's INV-04 row was re-derived against
  `invariants.md` at `doc_version: 3` after ADR-013 amended the invariant between the passes. All
  commands re-run. R1-R9 all PASS, no findings. **Run in the session that produced the previous
  verdict, at the operator's direction — see the front-matter disclosure.** Raised by
  `tech-lead-review`.
