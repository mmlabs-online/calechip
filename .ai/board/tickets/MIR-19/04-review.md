---
ticket: MIR-19
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T13:14:29Z
inputs_read: [ .ai/board/tickets/MIR-19/01-plan.md, .ai/board/tickets/MIR-19/03-impl-log.md, .ai/board/tickets/MIR-19/99-questions.md, .ai/board/tickets/MIR-19/ticket.yaml, .ai/registry/invariants.md, "git diff origin/main...HEAD" ]
consulted: []
chat_before_verdict: none
gate: FAIL
blocking_reason: "R5: the § 4.5 contract `<BrowserRouter key={base} basename={base}>` is not implemented. src/App.tsx:680 renders a bare `<BrowserRouter>`; the string `key={base} basename={base}` exists only inside a doc comment at src/App.tsx:98. Under an org base the shell routes therefore never match the prefixed pathname, and tests/e2e/mir-19-org-routing.spec.ts fails 8 of its 11 AC tests when run here (AC-1, 2, 3, 4, 6, 7, 9, 10)."
next_state: REWORK
verdict: FAIL
failed_checks: [R5]
invariant_violation: false
route_to: developer
increments_rework: true
---

## Checklist

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

## R5 detail

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

## R7 detail

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

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R5 | **The router is never given the base.** Plan § 4.5 specifies `<BrowserRouter key={base} basename={base}>`. `src/App.tsx:680` renders `<BrowserRouter>` with neither prop, and `key={base} basename={base}` exists only in the rewritten doc comment at `src/App.tsx:98`, which looks like a replace that hit the comment and not the element. The consequences are as follows. Under base `/shared`, the router sees the full pathname `/shared/month/2026-10`. No shell route matches it, and the shell's catch-all (`src/App.tsx:674`) navigates to `/`, dropping the prefix (AC-1, AC-2, AC-3). `LeaveOrg`'s `through` arm crosses with the prefixed pathname (`src/App.tsx:146`), so it never leaves the org (AC-9). The `sign-in` arm builds `orgPath("shared", "/shared/week/…")`, which doubles the prefix (`src/App.tsx:147`, AC-7). Running `pnpm exec playwright test tests/e2e/mir-19-org-routing.spec.ts` here fails AC-1, 2, 3, 4, 6, 7, 9 and 10, and passes 4 tests: seam-guard, AC-5, AC-8 and AC-11. The fix is implementable as specified. Put `key={base} basename={base}` on the element at `src/App.tsx:680`, restore the comment at `:98`, and re-run the spec | `developer` (operating model routing row "R5 implementable") | Yes |
| 2 | R5 (evidence) | `03-impl-log.md` reports the Playwright spec as "not run — browsers cannot be installed here". In this environment the spec runs (`[WebServer]` builds, chromium launches, and 12 tests execute). A spec that was never run was the only thing that could have caught Finding #1. The rework must run it and record its exit code | `developer` (same row, the same rework) | No (same failure as #1) |

`pgTAP` (`370-own-org-code.test.sql`, `010-catalogue.test.sql`) was not run by this reviewer. It is not a gate item, and the gate fails on R5 regardless. `psql` and `pg_prove` are on PATH, so the rework can try it.

## Verdict

**FAIL** on R5. It is implementable as specified, so it routes to `developer`, `rework_count` +1, and `next_state: REWORK`. R1 to R4 and R6 to R8 pass.
