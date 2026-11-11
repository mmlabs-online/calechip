---
ticket: MIR-19
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T13:27:16Z
inputs_read: [ .ai/board/tickets/MIR-19/01-plan.md, .ai/board/tickets/MIR-19/03-impl-log.md, .ai/board/tickets/MIR-19/ticket.yaml, .ai/registry/invariants.md, "git diff origin/main...HEAD", "git status (clean)" ]
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

## Review pass 2 — after rework 1

Fresh session. Every command below was run by this reviewer, one per call, on `feat/MIR-19` at
`4454255` with a clean tree. Pass 1's FAIL is kept at the end of this file, unedited, for the record.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`, no stray uncommitted paths | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-19, 19 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-19` → `0 uncommitted path(s)` / `PASS — nothing stray`. The 13 paths are at `.ai/board/tickets/MIR-19/ticket.yaml:17-30` |
| R2 | typecheck exit 0, whole program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 with no diagnostics |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`, repo-wide, so it covers the changed files) exited 0 with no output. `pnpm test`: 57 files, 1109 tests passed |
| R4 | Nothing outside the data-access seam reaches the datastore (RULE-02) | PASS | `src/App.tsx:18` imports only `seamName` from `./lib/data`. `src/hooks/useSession.ts:105` reads the code through `seam.getOwnOrgCode()`. The only `rpc("own_org_code")` is inside the seam at `src/lib/data/supabase.ts:1709-1712`. `src/lib/org-path.ts:1-66` imports nothing. The RULE-02 lint rule (`eslint.config.js:64`) is green under R3 |
| R5 | Every § 4 contract item is implemented (RULE-04) | PASS | Every row of R5 detail below. Pass 1's finding is closed: `src/App.tsx:680` is now `<BrowserRouter key={base} basename={base}>` |
| R6 | Permission gating matches plan § 3 | PASS | **Read own org code:** `own_org_code()` takes no argument and is `security definer` over `member_org_id((select auth.uid()))` (`supabase/migrations/20261111150000_mir19_own_org_code.sql:13-18`). `member_org_id` returns an org only for `removed_at is null` and `status = 'approved'` (`supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:33-39`), and no later migration redefines it. `public` and `anon` are revoked and `authenticated` is granted (`…mir19_own_org_code.sql:20-21`). **Be served `/{code}/…`:** affordance only, as § 3 says. The shell is placed only when `orgGate === null` (`src/App.tsx:792-793`), meaning a member whose `orgCode === base.slice(1)` (`src/App.tsx:205-214`). **Another org's address:** `OrgNotFound` inside `BareLayout` mounts no screen (`src/App.tsx:795-797`, `:155-173`). The client never sends the URL's code to the database, because `getOwnOrgCode()` takes no argument (`src/lib/data/index.ts:338`). **Register `tasks`:** refused by the constraint (`…mir19_own_org_code.sql:37-55`) |
| R7 | No invariant violated (RULE-07) | PASS | `invariants_touched: []` (`.ai/board/tickets/MIR-19/ticket.yaml:16`). Each of INV-01 to INV-07 is reasoned through in R7 detail below |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. The new imports are `useParams` and `useLocation` from the existing `react-router-dom` (`src/App.tsx:8-17`) and the new local module `@/lib/org-path` (`src/App.tsx:63`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `own_org_code()`: `sql stable security definer`, `search_path = ''`, no argument | `supabase/migrations/20261111150000_mir19_own_org_code.sql:13-18` | Yes |
| § 4.1 revoke `public, anon`; grant `authenticated` | `…mir19_own_org_code.sql:20-21` | Yes |
| § 4.1 guard raising `mir19 refused: …` with a hint when an org holds `tasks` | `…mir19_own_org_code.sql:27-34` | Yes |
| § 4.1 drop and re-add `org_code_not_reserved`, same name, the 50 MIR-11 tokens verbatim and in order, then `tasks` | `…mir19_own_org_code.sql:37-55`. Tokens extracted from both files and compared: identical to `20261027120000_mir11_composite_foreign_keys.sql:48-62`, with `tasks` appended | Yes |
| § 4.1 one transaction | `…mir19_own_org_code.sql:5`, `:57` | Yes |
| § 4.2 `ORG_CODE_SHAPE` | `src/lib/org-path.ts:8` | Yes |
| § 4.2 `RESERVED_ORG_CODES` (51, same order as the migration) | `src/lib/org-path.ts:14-26`; drift test `tests/org-path.test.ts:40-52` | Yes |
| § 4.2 `isOrgCode` (shape, 2..32, not reserved) | `src/lib/org-path.ts:29-36` | Yes |
| § 4.2 `OrgPath`, `splitOrgPath` | `src/lib/org-path.ts:38-55` | Yes |
| § 4.2 `orgPath`, `routerBase` | `src/lib/org-path.ts:58-66` | Yes |
| § 4.3 `DataSeam.getOwnOrgCode(): Promise<string \| null>` | `src/lib/data/index.ts:333-338` | Yes |
| § 4.3 supabase: `rpc("own_org_code")`, throws `getOwnOrgCode failed: …`, `data ?? null` | `src/lib/data/supabase.ts:1709-1712` | Yes |
| § 4.3 mock: `mockOrgOf` → `null` / `"shared"` / `"acme"`, the two module constants | `src/lib/data/mock.ts:541-542`, `:1778-1781` | Yes |
| § 4.4 `SessionState.orgCode: string \| null` | `src/hooks/useSession.ts:26`, returned at `:161` | Yes |
| § 4.4 read only for an approved member, after `getCurrentMember`, in the same `resolve()` pass; a throw fails closed | `src/hooks/useSession.ts:105` (guarded on `next.state === "member"`), `:114` (catch nulls it), `:118-119` (set with `membership`) | Yes |
| § 4.4 `Membership` unchanged | `src/lib/domain/types.ts` is not in the diff | Yes |
| § 4.5 `base` state from `routerBase(window.location.pathname)`, `syncBase`, `popstate` listener removed on unmount | `src/App.tsx:186-191` | Yes |
| § 4.5 `cross(path)`: `replaceState` keeping `history.state`, then `syncBase()` | `src/App.tsx:194-200` | Yes |
| § 4.5 `<BrowserRouter key={base} basename={base}>` (pass 1's finding) | `src/App.tsx:680` | Yes |
| § 4.5 `base === "/"`: the `BareLayout` auth/guest block unchanged, plus `/:orgCode/*` → `EnterOrg` | `src/App.tsx:727-782`; `EnterOrg` at `:119-126` (`onEnter` in an effect and `null` when `isOrgCode`, else `<Navigate to="/" replace />`) | Yes |
| § 4.5 `base !== "/"`: `/signin`, `/signup`, `/guest/*` cross through | `src/App.tsx:789-791`; `LeaveOrg` `through` arm `:144` | Yes |
| § 4.5 signed out → `cross(signInReturningTo(…))` | `src/App.tsx:208-209`, `:145`. Built with `orgPath(base.slice(1), pathname)` rather than `base + pathname`, a deviation disclosed in `03-impl-log.md` that differs only on the trailing slash at `/shared/`. AC-7's exact query string is asserted at `tests/e2e/mir-19-org-routing.spec.ts:101-102` | Yes |
| § 4.5 `undecided` / `member-less` → `cross("/")` | `src/App.tsx:210-211`, `:146` | Yes |
| § 4.5 wrong org → `OrgNotFound` in `BareLayout`; the button **pushes** `orgPath(orgCode, "/")` then `syncBase()`; `null` code crosses to `/` | `src/App.tsx:212-213`, `:795-797`; push at `:110-113` | Yes |
| § 4.5 `shellRoutes` written once and placed in both tables | defined `src/App.tsx:241-676`, placed at `:783` and `:793`. `tests/route-role-guards.test.ts` passes under `pnpm test` | Yes |
| § 4.5 `EnterOrg`, `LeaveOrg`, `OrgNotFound` module-level in `App.tsx`; selectors `org-not-found`, `org-not-found-home`; `app-root`, `seam-banner` unchanged | `src/App.tsx:119`, `:133`, `:155`; testids `:158`, `:165`; `:697`, `:705` | Yes |
| § 4.6 `tests/org-path.test.ts` | `tests/org-path.test.ts:15-76`; green under `pnpm test` | Yes |
| § 4.6 `supabase/tests/370-own-org-code.test.sql` (AC-12, AC-13 DB half, `anon` privilege) | `supabase/tests/370-own-org-code.test.sql:13`, `:49-72`, `:80-95` | Present. **Not run**: `pnpm db:test` needs the local Supabase stack and there is no Docker daemon here (`docker info` fails). CI's `database` job runs it (`scripts/db-test.mjs:1-2`) |
| § 4.6 census line in `010-catalogue.test.sql` | `supabase/tests/010-catalogue.test.sql:80-81` | Present. Not run, same reason |
| § 4.6 `tests/e2e/mir-19-org-routing.spec.ts`, one test per AC-1 to AC-11 | `tests/e2e/mir-19-org-routing.spec.ts:29-168`. `pnpm exec playwright test tests/e2e/mir-19-org-routing.spec.ts` → **12 passed**. Full suite `pnpm exec playwright test` → **523 passed** (AC-11, nothing existing edited) | Yes |

Every root route's first segment (`admin`, `entries`, `events`, `guest`, `holidays`, `members`,
`month`, `profile`, `reports`, `setting`, `signin`, `signup`, `signups`, `tasks`, `teams`,
`threshold`, `week`, `year`) is on `RESERVED_ORG_CODES` (`src/lib/org-path.ts:15-25`), so
`/:orgCode/*` at `src/App.tsx:782` can never treat an existing root address as an org.

## R7 detail

`invariants_touched: []`. Plan § 2 says this ticket routes and writes no entry. Each invariant was
checked against the diff on its own. The only database change is a no-argument read function and a
check constraint on `public.org` (`supabase/migrations/20261111150000_mir19_own_org_code.sql:13-55`).
The only seam change is the one new read (`src/lib/data/supabase.ts:1709-1712`,
`src/lib/data/mock.ts:1778-1781`).

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Not touched. No entry table, trigger or write path in the diff | `…mir19_own_org_code.sql:13-55` touches only `public.org` and `public.own_org_code()` |
| INV-02 approval does not survive an edit | Not touched. No entry update path changed, and the seam gains only a read | `src/lib/data/index.ts:333-338` is the whole interface delta |
| INV-03 rejection carries a reason | Not touched. No reject path in the diff | `src/lib/data/index.ts:333-338` |
| INV-04 one definition of the absence count | Not touched. No count is computed. `org-path.ts` is string functions only, and no count module is in the diff | `src/lib/org-path.ts:29-66` |
| INV-05 tentative still counts | Not touched, same reason as INV-04 | `src/lib/org-path.ts:29-66` |
| INV-06 one portion per entry | Not touched. The only constraint changed is on `public.org` | `…mir19_own_org_code.sql:37-55` |
| INV-07 one member, every team | Not touched. Membership is read and never written. `own_org_code` reads `member_org_id` | `…mir19_own_org_code.sql:15-17`; `src/hooks/useSession.ts:105` |

## Findings

None. All eight checks pass.

## Verdict

**PASS.** `next_state: DONE`.

The pgTAP suites (`370`, `010`) were not run in this review, and neither the implementation nor this
reviewer could run them. That is a gap in evidence, not a gate item. CI's `database` job is where they
run first. Applying the migration to the hosted project is human (RULE-09).

---

# Review pass 1 — 2026-11-11T13:14:29Z, FAIL on R5 (closed by rework 1)

Front-matter at the time: `gate: FAIL`, `next_state: REWORK`, `failed_checks: [R5]`,
`route_to: developer`, `increments_rework: true`. Body below, unedited.

### Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`, no stray uncommitted paths | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-19, 18 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-19` → `0 uncommitted path(s)` / `PASS — nothing stray`. Every source path in the diff is listed at `.ai/board/tickets/MIR-19/ticket.yaml:17-30` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 with no output, run by this reviewer |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exited 0 with no output, run by this reviewer. `pnpm test`: 57 files and 1109 tests passed |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/App.tsx:18` imports only `seamName` from `./lib/data`. `src/hooks/useSession.ts:16` imports `seam` from `@/lib/data` and reads the code through it at `src/hooks/useSession.ts:105`. The only `rpc("own_org_code")` is inside the seam at `src/lib/data/supabase.ts:1709-1712`. `src/lib/org-path.ts` imports nothing |
| R5 | Every § 4 contract item is implemented | **FAIL** | § 4.5 `<BrowserRouter key={base} basename={base}>` is missing. `src/App.tsx:680` is `<BrowserRouter>`. The contract text appears only in a comment at `src/App.tsx:98`. See Findings #1 |
| R6 | Permission gating matches plan § 3 | PASS | `own_org_code()` takes no argument and is `security definer` over `member_org_id(auth.uid())` (`supabase/migrations/20261111150000_mir19_own_org_code.sql:13-18`). `member_org_id` requires approved and non-removed (`supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:33-38`). Anon and public are revoked and authenticated is granted (`…mir19_own_org_code.sql:20-21`). `tasks` is reserved by the constraint (`…mir19_own_org_code.sql:38-54`), behind a guard (`:28-34`). Plan § 3 says route gating is affordance only. The not-found arm mounts no screen (`src/App.tsx:205-215`, `:793-797`). The client never sends the URL's code to the database: `getOwnOrgCode` takes no argument (`src/lib/data/index.ts:338`) |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:16`). Per-ID reasoning for INV-01 to INV-07 is in R7 detail below |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. The only new import is `react-router-dom`'s existing `useLocation` and `useParams` (`src/App.tsx:8-17`) |

### R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `own_org_code()` definer, no arg, `search_path = ''` | `supabase/migrations/20261111150000_mir19_own_org_code.sql:13-18` | Yes |
| § 4.1 revoke public and anon, grant authenticated | `…mir19_own_org_code.sql:20-21` | Yes |
| § 4.1 `tasks` guard, then re-create `org_code_not_reserved` with the 50 MIR-11 tokens verbatim and in order, then `tasks` | `…mir19_own_org_code.sql:28-54`. Tokens compared against `20261027120000_mir11_composite_foreign_keys.sql:48-62` and found identical | Yes |
| § 4.2 `ORG_CODE_SHAPE`, `RESERVED_ORG_CODES`, `isOrgCode` | `src/lib/org-path.ts:8`, `:14-26`, `:29-36` | Yes |
| § 4.2 `OrgPath`, `splitOrgPath`, `orgPath`, `routerBase` | `src/lib/org-path.ts:38-66` | Yes |
| § 4.3 `DataSeam.getOwnOrgCode(): Promise<string \| null>` | `src/lib/data/index.ts:333-338` | Yes |
| § 4.3 supabase: `rpc("own_org_code")`, throws on error | `src/lib/data/supabase.ts:1709-1712` | Yes |
| § 4.3 mock: `MOCK_ORG_PUBLIC_CODE`, `MOCK_DEDICATED_ORG_CODE`, over `mockOrgOf` | `src/lib/data/mock.ts:541-542`, `:1778-1781` | Yes |
| § 4.4 `SessionState.orgCode`, read only for an approved member, fails closed | `src/hooks/useSession.ts:26`, `:105`, `:114`, `:119`, `:161` | Yes |
| § 4.5 `base` state, `syncBase`, popstate listener | `src/App.tsx:186-191` | Yes |
| § 4.5 `cross(path)` replaces history and keeps state | `src/App.tsx:194-201` | Yes |
| **§ 4.5 `<BrowserRouter key={base} basename={base}>`** | **absent. `src/App.tsx:680` is `<BrowserRouter>`** | **No** |
| § 4.5 root table: `/:orgCode/*` → `EnterOrg` | `src/App.tsx:119-127`, `:782` | Yes |
| § 4.5 org table: `/signin`, `/signup`, `/guest/*` → `LeaveOrg` | `src/App.tsx:133-150`, `:789-791` | Yes, but it depends on the basename (Finding #1) |
| § 4.5 signed out → sign-in returning here; undecided or member-less → `/`; wrong org → `OrgNotFound` with a push | `src/App.tsx:205-215`, `:110-113` | Yes, but it depends on the basename (Finding #1) |
| § 4.5 `shellRoutes` written once and placed in both tables | `src/App.tsx:241`, `:783`, `:793-794` | Yes |
| § 4.5 selectors `org-not-found`, `org-not-found-home` | `src/App.tsx:155-175` | Yes |
| § 4.6 `tests/org-path.test.ts` | `tests/org-path.test.ts:35-42` and the rest of the file. Green under `pnpm test` | Yes |
| § 4.6 `supabase/tests/370-own-org-code.test.sql` | `supabase/tests/370-own-org-code.test.sql:13-100`, 13 assertions | Present. Not run by this reviewer |
| § 4.6 census line | `supabase/tests/010-catalogue.test.sql:80-81` | Yes |
| § 4.6 `tests/e2e/mir-19-org-routing.spec.ts`, one test per AC | Present. **8 of 11 AC tests fail** when run here (`pnpm exec playwright test tests/e2e/mir-19-org-routing.spec.ts`) | The spec is right; the code under it is not |

### R7 detail

`invariants_touched: []`. Plan § 2 states this, and each invariant is checked against the diff below. The diff writes no entry, changes no entry state and computes no count. Its only database change is a no-argument read function and a check constraint on `public.org`.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Not touched. No entry write path changed, and the migration touches only `public.org` and a new function | `supabase/migrations/20261111150000_mir19_own_org_code.sql:13-54` |
| INV-02 approval does not survive an edit | Not touched. No entry update path or trigger changed | `…mir19_own_org_code.sql:13-54`. Seam diff adds only `getOwnOrgCode` (`src/lib/data/supabase.ts:1709-1712`, `src/lib/data/mock.ts:1778-1781`) |
| INV-03 rejection carries a reason | Not touched. No reject path changed | Same as above |
| INV-04 one definition of the absence count | Not touched. No count is computed in the diff, and `src/lib/org-path.ts:1-66` is string functions only | `src/lib/org-path.ts:29-66` |
| INV-05 tentative still counts | Not touched. No count path changed | Same as INV-04 |
| INV-06 one portion per entry | Not touched. No entry column or constraint changed | `…mir19_own_org_code.sql:37-54` (the only constraint changed is on `public.org`) |
| INV-07 one member, every team | Not touched. Membership and the team mirror are unchanged. `own_org_code` only reads `member_org_id` | `…mir19_own_org_code.sql:15-17` |

### Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R5 | **The router is never given the base.** Plan § 4.5 specifies `<BrowserRouter key={base} basename={base}>`. `src/App.tsx:680` renders `<BrowserRouter>` with neither prop, and `key={base} basename={base}` exists only in the rewritten doc comment at `src/App.tsx:98`, which looks like a replace that hit the comment and not the element. The consequences are as follows. Under base `/shared`, the router sees the full pathname `/shared/month/2026-10`. No shell route matches it, and the shell's catch-all (`src/App.tsx:674`) navigates to `/`, dropping the prefix (AC-1, AC-2, AC-3). `LeaveOrg`'s `through` arm crosses with the prefixed pathname (`src/App.tsx:146`), so it never leaves the org (AC-9). The `sign-in` arm builds `orgPath("shared", "/shared/week/…")`, which doubles the prefix (`src/App.tsx:147`, AC-7). Running `pnpm exec playwright test tests/e2e/mir-19-org-routing.spec.ts` here fails AC-1, 2, 3, 4, 6, 7, 9 and 10, and passes 4 tests: seam-guard, AC-5, AC-8 and AC-11. The fix is implementable as specified. Put `key={base} basename={base}` on the element at `src/App.tsx:680`, restore the comment at `:98`, and re-run the spec | `developer` (operating model routing row "R5 implementable") | Yes |
| 2 | R5 (evidence) | `03-impl-log.md` reports the Playwright spec as "not run — browsers cannot be installed here". In this environment the spec runs (`[WebServer]` builds, chromium launches, and 12 tests execute). A spec that was never run was the only thing that could have caught Finding #1. The rework must run it and record its exit code | `developer` (same row, the same rework) | No (same failure as #1) |

`pgTAP` (`370-own-org-code.test.sql`, `010-catalogue.test.sql`) was not run by this reviewer. It is not a gate item, and the gate fails on R5 regardless. `psql` and `pg_prove` are on PATH, so the rework can try it.

### Verdict

**FAIL** on R5. It is implementable as specified, so it routes to `developer`, `rework_count` +1, and `next_state: REWORK`. R1 to R4 and R6 to R8 pass.
