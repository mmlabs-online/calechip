---
ticket: TEA-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-08-31T15:45:55Z
revision_of: 2026-08-31T15:02:29Z
branch: feat/TEA-01
inputs_read:
  - .ai/board/tickets/TEA-01/ticket.yaml
  - .ai/board/tickets/TEA-01/02-design.md          # revision of 2026-08-31T15:35:07Z, incl. 6.2-6.4 and Appendix A
  - .ai/board/tickets/TEA-01/04-review.md          # REVIEW gate PASS, 2026-08-31T15:08:58Z
  - .ai/board/tickets/TEA-01/06-test-report.md     # QA gate FAIL, 2026-08-31T15:18:06Z — failure 1 routed here
  - .ai/board/tickets/TEA-01/99-questions.md       # qa -> tech-lead-design, both answers
  - .ai/board/tickets/TEA-01/01-story.md           # revision of 2026-08-31T09:23:25Z
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/git-conventions.md
  - .ai/01-operating-model.md
  - eslint.config.js, tsconfig.json, vite.config.ts, playwright.config.ts
  - node_modules/@supabase/auth-js@2.112.4 (installed types)
  - node_modules/react-router@7.18.3 (installed types)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TEA-01 — Sign up and establish the member record — implementation log

**Rework revision.** The REVIEW gate passed on the first cycle; the QA gate failed and routed one
finding here — *a sign-up that fails renders no `signup-error` and strands `signup-submit` disabled*
(`06-test-report.md`, failure 1). QA's other two failures went to `tech-lead-design`, which amended
the design at `15:24:54Z` and `15:35:07Z` with §6.2, §6.3, §6.4 and Appendix A. **This cycle
implements failure 1 and the two new subsections that are Developer work, §6.2 and §6.3.** Three
files changed; nothing else was touched. The first cycle's nine files stand and are re-listed below
so this log still stands alone under RULE-16.

Nine of the twelve files in `allowed_paths` are written. **The other three are QA's**, and that is
the one thing in this log a reviewer should check first — it is reasoned in *Scope* below rather than
left as an absence.

## What changed in this cycle

| file | change | answers |
|------|--------|---------|
| `src/lib/data/index.ts` | Gains `seamName` and `seam` — the resolver that chooses an implementation from the environment. | §6.2 |
| `src/routes/SignUp.tsx` | Imports `{ seam } from "@/lib/data"` instead of `./supabase`; the submit handler now catches as well as branches. | §6.2, §6.3 — QA failure 1 |
| `src/App.tsx` | Renders `seam-banner` with `data-seam="mock"` whenever the build resolved to the in-memory seam. | §6.2 rule 2, §6 selector table |

**Failure 1 is Developer-caused and increments `rework_count` under RULE-08.** `ticket.yaml` still
reads `rework_count: 0`; that field belongs to the orchestrator's dispatch loop (RULE-06) and this
session did not write it. Flagged rather than corrected here, because the RULE-06 budget escalates at
two and a count that silently stays at zero defeats it.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | created | The domain vocabulary the other eight files are written in. Placed outside `src/lib/data/` so a component can hold a `Member` without importing the seam. | §1.1 |
| `src/lib/data/index.ts` | modified | The seam grows `signUp` and `getOwnMember`; `ready()` untouched, so no existing caller changes. **Rework:** it also became the one door that resolves which implementation a build uses. | §1.2, §6.2 |
| `src/lib/data/supabase.ts` | modified | The real implementation: `auth.signUp` with `options.data`, and a single `maybeSingle()` read of `member`. The only place snake_case columns and camelCase domain fields meet. | §1.2, §3 |
| `src/lib/data/mock.ts` | modified | The in-memory implementation, seeded from the fixtures. It reproduces the **trigger's** admission rule, not the interface's, so a component test cannot pass against a broken trigger. | §1.2, §3 |
| `src/lib/fixtures.ts` | created | The shared fixture module design §1.5 names, closing the `TODO(project)` in `testing-standards.md`. Same literals as `supabase/seed.sql`. | §1.5 |
| `src/routes/SignUp.tsx` | created, modified in rework | The one screen. One local form state, one seam call, terminal on its own notice (AC-13). Carries every selector in design §6. **Rework:** repointed at `@/lib/data`, and the submit handler now has a terminal state for a call that throws. | §1.4, §6.2, §6.3 |
| `src/App.tsx` | modified | The routed shell. `app-root` keeps its name and moves onto the element wrapping `<Routes>`, which is why `tests/e2e/smoke.spec.ts` needed no edit and still passes. **Rework:** it now renders `seam-banner`. | §1.3, §6.2 |
| `supabase/migrations/20260831150024_tea01_membership.sql` | created | The feature. `team`, `member`, `allowed_email`, the two rank helpers, the admission trigger, and the two select policies. Under ADR-005 this file **is** the enforcement. | §4.1, §2 |
| `supabase/seed.sql` | created | One team, one admin auth user and member row, one unconsumed and one consumed allow-list entry — AC-3, AC-11 and AC-12 have nothing to run against otherwise. | §4.2 |

## Scope: the three files not written, and why

`tests/permission-model.test.ts` and `tests/e2e/tea-01-signup.spec.ts` are in `allowed_paths` and are
**not** written here. `.ai/01-operating-model.md` gives *the test tree* to `qa` as its artifacts out,
and `/implement`'s artifacts out are code plus this log. `allowed_paths` is read by
`guard-allowed-paths.mjs` from the branch name, and QA works on this same branch — so the design
listing those two paths is what lets QA write them at all, not an instruction to the Developer. A
Developer-written test for these criteria would also defeat RULE-05 outright: it would be derived
from the implementation it is meant to judge.

`tests/seam-parity.test.ts` needed no edit, exactly as design §5 predicted. It compares exported key
sets and arity generically, and both implementations gained the same two names at the same arity. It
passes — see *Verification run*.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §1.1 `MemberRole` | `src/lib/domain/types.ts:8` | |
| §1.1 `Member` | `src/lib/domain/types.ts:11` | |
| §1.1 `AuthUser` | `src/lib/domain/types.ts:22` | |
| §1.1 `Session` | `src/lib/domain/types.ts:28` | |
| §1.1 `FailureCode` | `src/lib/domain/types.ts:34` | All six codes reachable in `supabase.ts`; see the mapping note below. |
| §1.1 `Failure` | `src/lib/domain/types.ts:42` | |
| §1.1 `Result<T>` | `src/lib/domain/types.ts:47` | |
| §1.1 `AVATAR_CHOICES` | `src/lib/domain/types.ts:60` | Twelve placeholder values, as the design specifies. Still the operator's to set. |
| §1.2 `SignUpInput` | `src/lib/data/index.ts:14` | |
| §1.2 `SignUpOutcome` | `src/lib/data/index.ts:21` | |
| §1.2 `DataSeam.ready` | `index.ts:31`, `supabase.ts:96`, `mock.ts:57` | Unchanged. |
| §1.2 `DataSeam.signUp` | `index.ts:38`, `supabase.ts:107`, `mock.ts:69` | |
| §1.2 `DataSeam.getOwnMember` | `index.ts:49`, `supabase.ts:129`, `mock.ts:103` | No interface caller in this half, by design. Its caller is QA's permission-model test. |
| §1.3 routed shell | `src/App.tsx:13` | `/signup`, plus the temporary catch-all redirect. |
| §1.4 `SignUpFormState` | `src/routes/SignUp.tsx:15` | Three phases; `submitted` is terminal. |
| §6.2 seam resolution | `src/lib/data/index.ts:65,72,74` | `usesMock` is `VITE_DATA_SEAM === "mock"` or an absent `VITE_SUPABASE_URL`, exactly as §6.2 specifies. `SignUp.tsx:11` imports `{ seam } from "@/lib/data"` and names no implementation. |
| §6.2 rule 2 — `seam-banner` | `src/App.tsx:19-27` | Rendered whenever `seamName === "mock"`. Permanent, not dismissible. |
| §6.3 terminal states | `src/routes/SignUp.tsx:47-58` | Three rows of §6.3's table: `ok: true` → `signup-confirm-notice` (`:52`); `ok: false` → `signup-error` (`:52`); **throws** → `signup-error` and the form editable again (`:53-58`). |
| §1.5 fixtures | `src/lib/fixtures.ts:12,25,36,39,42` | Exactly the five exports named. Nothing added. |
| §4.1 migration | `supabase/migrations/20260831150024_tea01_membership.sql` | Transcribed from the design; two `TODO(verify)` markers carried forward verbatim. |
| §4.2 seed | `supabase/seed.sql` | |

**`FailureCode` mapping, since design §1.1 names the codes but not their sources.** `supabase.ts:74`
maps `AuthError.code` — `email_exists` / `user_already_exists` → `email_already_registered`,
`weak_password`, `over_request_rate_limit` / `over_email_send_rate_limit` → `rate_limited`,
`invalid_credentials`, and `isAuthRetryableFetchError` → `network`, everything else `unknown`. Every
code name was read from `@supabase/auth-js@2.112.4` `lib/error-codes.d.ts`, not recalled. This is a
choice of mapping, not a new name: all six `FailureCode` values are the design's.

## Deviations from the design

`none`.

Two things that look like deviations and are not, recorded so the reviewer does not have to decide
they are:

- **The mock never returns `email_already_registered`.** Design §3 says the mock reproduces the
  trigger's behaviour; AC-7 requires Confirm email **on**; and under that setting Supabase returns an
  obfuscated user for an already-registered address rather than an error (design's own verification
  table). So a second sign-up for a consumed address falls through to the `consumedAt` guard and
  creates nothing, which is AC-3 rather than a failure. The only failure the mock models is a weak
  password. Parity is names and arity, and it holds.
- **`getOwnMember` throws on a transport or policy error** (`supabase.ts:137`) rather than returning
  `null`. The contract gives it no failure shape, and returning `null` would report "you are not a
  member" for a broken connection — which is the AC-5 answer given for the wrong reason. Throwing is
  what `coding-standards.md` prescribes for a programmer error.
- **The catch in `SignUp.tsx:53` builds a `Failure` the seam never returned.** §6.3's third row
  requires a terminal state for a call that *throws*, and `signup-error` renders `Failure.message`, so
  the screen has to have one to render. It uses the existing `unknown` code — no seventh `FailureCode`
  was added. The thrown value itself is deliberately not surfaced: it is a configuration or transport
  fault, and its text is for a log rather than for the person signing up.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | This ticket computes no absence count, but it creates the rows that form the denominator. The trigger's first guard (`migration:93`) returns without admitting anybody while `email_confirmed_at is null`, so an account that was created and never confirmed never enters the count and never raises the overload threshold for the rest of the team. `removed_at` is written null and nothing in this ticket ever sets it. |
| `INV-07` | `member.team_id` is `not null` and references `team(id)` (`migration:33`), and the single insert that creates a member row (`migration:113`) takes `team_id` from `v_team_id`, which comes only from the `UPDATE ... RETURNING` against the claimed allow-list entry. There is no other writer: `member` has no insert policy, and `revoke all` plus `grant select` is the whole of the `authenticated` privilege. So a member belongs to exactly one team from the instant they exist, and no path in this ticket creates a member without a team. The mock upholds the same rule at `mock.ts:88`. |

Neither is violated, so nothing escalates under RULE-07.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, per `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | lint, same. Includes the RULE-02 `no-restricted-imports` rule. |
| `pnpm exec vitest run` | 0 | 2 tests, 1 file — `tests/seam-parity.test.ts`, still unedited and still passing |
| `pnpm exec vite build` | 0 | |
| `pnpm exec playwright test` | 0 | **8 tests, 8 passed.** Was 3 passed / 5 failed at the QA gate. The five QA left failing — AC-1, AC-4, AC-5, AC-7, AC-13 — are green, and `tests/e2e/tea-01-signup.spec.ts` was not edited to make them so. |
| `git diff --name-only` subset of `allowed_paths` | yes | nine files, listed above; verified by reading them against the globs |

**Two behaviours were driven in a browser rather than inferred**, because both are new and neither is
covered by a test QA has written yet. A throwaway script drove the built preview through the section 6
selectors only; it lives in the session scratchpad and no file was added to the repository.

| Build | `seam-banner` | On submit |
|---|---|---|
| default, no environment — what `pnpm exec playwright test` gets | present, `data-seam="mock"` | `signup-confirm-notice` rendered, no page error |
| `VITE_SUPABASE_URL` set with no anon key, so `createClient` throws | absent, as §6.2 requires | `signup-error` rendered reading *Đăng ký không thành công…*, `signup-submit` enabled again, **no uncaught page error** |

The second row is QA's failure 1 reproduced and closed: before this cycle it left the button disabled
on "Đang gửi…" forever with the throw escaping as an uncaught page error.

**On the allowed-paths script.** `node scripts/check-allowed-paths.mjs` exits 0 but reports
`0 changed file(s)`: it reads a committed diff, and under ADR-006 nothing is committed until `/ship`.
Its PASS is therefore vacuous here and the subset claim above rests on the manual comparison, not on
it.

**The SQL was not executed.** No Supabase project is provisioned and the CLI is not installed —
design §5 *Prerequisites* records both as `TODO(project)` in `tech-stack.md`. The migration and the
seed are syntactically reviewed and unrun, and applying them is human anyway (RULE-09).

## Testability contract

Every selector in design §6, and where it now is. QA never reads this source (RULE-05), so a selector
renamed in passing would break the QA gate with no way for QA to discover why. None was renamed.

| selector | Exists at |
|----------|-----------|
| `app-root` | `src/App.tsx:13` |
| `seam-banner` | `src/App.tsx:21` — **new this cycle**, with `data-seam="mock"` at `:22`. Rendered only when `seamName === "mock"` (`:19`); absent on a build that resolved to the real seam, verified in both directions above. |
| `signup-form` | `src/routes/SignUp.tsx:79` |
| `signup-email` | `src/routes/SignUp.tsx:88` |
| `signup-password` | `src/routes/SignUp.tsx:100` |
| `signup-display-name` | `src/routes/SignUp.tsx:114` |
| `signup-avatar-picker` | `src/routes/SignUp.tsx:126` |
| `signup-avatar-option` | `src/routes/SignUp.tsx:135` — one per `AVATAR_CHOICES` entry, each carrying `data-avatar="<emoji>"` at `:136` |
| `signup-submit` | `src/routes/SignUp.tsx:159` — never left disabled without a terminal state beside it (§6.3); `disabled` at `:161` clears when the phase leaves `submitting`, which every path now does |
| `signup-error` | `src/routes/SignUp.tsx:153` — rendered when `phase === "editing"` and an error is present, which now includes a call that threw |
| `signup-confirm-notice` | `src/routes/SignUp.tsx:64` — the terminal panel, identical whether or not the address was allow-listed |

## Open questions

**Resolved by the design amendment of 2026-08-31T15:24:54Z**, and kept here rather than deleted so a
reader can see the loop closing:

1. ~~`SignUp.tsx` imports the seam directly, skipping the hook layer.~~ **Half closed.** §6.2 answers
   the part that mattered: nothing above the seam names an implementation any more, and
   `src/routes/SignUp.tsx:11` imports `{ seam } from "@/lib/data"`. The hook layer of
   `.ai/standards/architecture.md` is still skipped — a hook is a thirteenth file — and that stays
   open for whoever designs the sign-in half, where `useSession.ts` already lands. `04-review.md`
   reached the same conclusion independently and did not treat it as a finding.
2. ~~There is no seam-selection mechanism.~~ **Closed.** It is `src/lib/data/index.ts:65-74`. The mock
   now has a consumer in the product, which is what made the five failing end-to-end tests runnable.

**Still open:**

3. **Emoji in source, which `coding-standards.md` forbids in one line and `data-model.md` requires in
   another.** `AVATAR_CHOICES` (`types.ts:60`), the trigger's last-resort avatar (`migration:118`) and
   the seeded admin's avatar are emoji literals. `data-model.md` says the prototype stores an emoji and
   the design specifies these exact values; the coding-standards bullet sits under *Comments* and reads
   as a rule about prose. Implemented as designed and flagged rather than silently resolved — the two
   standards are human-owned and one of them should say so explicitly. Unchanged from the first cycle;
   `04-review.md` did not raise it.

4. **The tree carries uncommitted work outside `allowed_paths` that is not this ticket's**, and there
   is more of it than there was: `ADM-01..03`, `CAL-01..07`, five ADRs, and steward edits to the
   registry and standards. `04-review.md` confirmed the first cycle's version of this by content and
   by mechanism and evaluated R1 against the nine files. The same reasoning holds; `/ship` is where it
   is separated.

5. **Two `TODO(verify)` markers are carried into the migration unchanged**, both from §4.3: whether
   `citext` is available on a hosted project (with the named `lower()` fallback written into the
   file's header), and whether `raw_user_meta_data` is the real column name on `auth.users`. Appendix
   A step 3 is where both are settled — the first execution of this migration.

6. **The end-to-end suite is green against the mock, and that is not coverage of this ticket.**
   §6.2 says it in terms and it bears repeating where the numbers are: eight passing tests prove the
   screen and the mock's imitation of the trigger. They prove nothing about the policies or the real
   trigger. Ten of the twelve criteria still run through `tests/permission-model.test.ts`, which stays
   unwritten until the chore in Appendix A lands — the operator chose to provision, `ticket.yaml`
   carries the dependency with no ID yet, and `product` assigns `OPS-nnn` at `/triage`. **TEA-01
   cannot reach DONE before that.**

## Changelog

- `2026-08-31T15:02:29Z` — nine files implemented against `02-design.md` of `09:34:46Z`. Gate PASS.
  REVIEW passed on it at `15:08:58Z` with no findings; QA failed at `15:18:06Z`.
- `2026-08-31T15:45:55Z` — **rework, routed here by the QA gate** (`06-test-report.md`, failure 1: a
  failing sign-up rendered no `signup-error` and stranded `signup-submit`). Implemented §6.3's three
  terminal states in `src/routes/SignUp.tsx`, and §6.2's seam resolution across
  `src/lib/data/index.ts`, `src/routes/SignUp.tsx` and `src/App.tsx`, the last gaining `seam-banner`.
  Three files; no file added; `size` stays M. The five end-to-end tests QA left failing are green
  without being edited. Gate PASS.
