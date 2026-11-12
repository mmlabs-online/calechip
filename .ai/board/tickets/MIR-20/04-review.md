---
ticket: MIR-20
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-12T07:14:51Z
inputs_read: [ .ai/board/tickets/MIR-20/01-plan.md, .ai/board/tickets/MIR-20/03-impl-log.md, .ai/board/tickets/MIR-20/ticket.yaml, .ai/registry/invariants.md, .ai/standards/architecture.md, "git diff origin/main...HEAD" ]
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

# MIR-20 — review

Branch `feat/MIR-20`, tree clean (`git status --porcelain` empty). Subject is the
`origin/main...HEAD` diff: 13 files.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-20, 13 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-20` → `0 uncommitted path(s)` … `PASS — nothing stray`. The six source paths are `.ai/board/tickets/MIR-20/ticket.yaml:20-25`; `.ai/board/backlog.md` is ship-owned |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0 repo-wide, no output; nothing outside the diff to route as a chore |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/system/main.tsx:8-29` imports only React, date-fns, `@/lib/data/system` (`:27`) and domain types; every call goes through `systemSeam` (`:1115`, `:1330`, `:1362`). The Supabase client stays in the seam: `src/lib/data/system.ts:14`, `:360`, used at `:626-670`. `supabase-client-in-seam` is in the clean `pnpm lint` above |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | `supabase/migrations/20261112180000_mir20_impersonation.sql:93-95` (start, first statement), `:197-199` + `:205` (current, caller's row only), `:232-238` (roster: system admin and `impersonated_org_id()` non-null before the write at `:249`), `:155-157` + `:165-168` (end, own row only), `:57-60` (both log tables: RLS with no policy, all privileges revoked from `public, anon, authenticated`), `:71-74` (`impersonated_org_id()` null for anyone not a system admin). No existing policy, function or table is altered by the diff, so the "no write under a session" row holds by the absence of any write path that consults a session. The panel's hidden button (`src/system/main.tsx:1462-1472`) is an affordance only; `IM001` at migration `:126-129` is the refusal |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:15`); see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` contains no `package.json` or `pnpm-lock.yaml`; the one new import is `Fragment` from `react` (`src/system/main.tsx:8`), already a dependency |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `public.impersonation`, its four checks, partial unique index | migration `:27-45` | yes — column for column with plan § 4.1 |
| § 4.1 `public.impersonation_action`, action check, index | migration `:47-55` | yes |
| § 4.1 RLS on, no policy, revokes | migration `:57-60` | yes |
| § 4.1 `impersonated_org_id()` — sole definition of "live" | migration `:67-77` | yes; `sql stable security definer set search_path = ''`, revoke/grant `:76-77` |
| § 4.1 `start_impersonation(uuid,uuid,text,integer)` — order gate, minutes, org, team, close expired, refuse live, insert, log | migration `:83-144`; order `:93`, `:96`, `:100-103`, `:105-117`, `:120-124`, `:126-129`, `:134-137`, `:139` | yes; reason stored `btrim`'d (`:135`), table checks raise `23514`/`23502` (`:38`, `:34`) |
| § 4.1 `end_impersonation()` | migration `:150-177` | yes; closes expired at `expires_at` (`:159-163`), ends live and logs `end` only when one existed (`:165-173`) |
| § 4.1 `current_impersonation()` returns table | migration `:183-211` | yes; nine columns as specified, writes nothing |
| § 4.1 `impersonated_roster()` — refusal before any write, logged, two branches | migration `:218-276`; refusal `:232-247`, log `:249`, dedicated `:251-261`, Org public `:262-271` | yes; `removed_at is null`, `left_at is null`, sorted team names, `'{}'` default (`:254-258`) |
| § 4.2 types, constants, messages | `src/lib/data/system.ts:282-341` | yes, names and strings verbatim |
| § 4.2 four `SystemSeam` methods | interface `src/lib/data/system.ts:80-86`; Supabase `:626-670`; mock `:1321-1377` | yes |
| § 4.2 private helpers `impersonationRefusal`, `impersonationFailureCode`, `toImpersonation`, `toRosterRow` | `src/lib/data/system.ts:336`, `:720`, `:695`, `:709` | yes; SQLSTATE map `:720-737` matches the plan's comment column |
| § 4.2 `signOut()` ends the session first | Supabase `src/lib/data/system.ts:455-458`; mock `:1179-1180` | Supabase calls `endImpersonation()` as specified. The mock assigns `mockImpersonation = null` instead of calling its own `endImpersonation()`, disclosed in `03-impl-log.md` § Deviations: the mock's `endImpersonation()` refuses below `aal2` (`:1360-1361`), so a call would not clear the state on a sign-out from the verify screen. The contract item is "changes behaviour, not signature" and the behaviour (AC-7) holds; e2e AC-7 passes |
| § 4.2 mock mirrors the database's refusal order | `src/lib/data/system.ts:1327-1358` | yes — gate, minutes, org, team rule, shared team, reason, live |
| § 4.2 `mockRosters` and `localeCompare("vi")` sort | `src/lib/data/system.ts:1096-1106`, `:1366-1377` | yes |
| § 4.3 `ImpersonationBanner`, `ImpersonatedRoster`, `StartImpersonationForm` | `src/system/main.tsx:1063`, `:1105`, `:1200` | yes |
| § 4.3 `OrgManagement` state, read on mount, 15 s countdown, re-read at zero, `not_permitted` roster ends it | `src/system/main.tsx:1323-1366`, tick `:1053` and `:1354`, roster `:1117-1122` | yes |
| § 4.3 org label | `src/system/main.tsx:1055-1057` | yes |
| § 4.3 every `data-testid` | banner `:1063-1100`, roster `:1105-1198`, form `:1200-1310`, impersonate button `:1464`, expired `:1502`; submit disabled for Org public without a team `:1302` | yes — all 25 present |
| § 4.4 `390-impersonation.test.sql` AC-8..AC-18 (+ AC-19 definer check) | `supabase/tests/390-impersonation.test.sql:18` (`plan(89)`), AC blocks `:198-499` | file present; 89 assertion calls counted against `plan(89)`. **Not executed in this review either**: no Docker daemon (`/var/run/docker.sock` absent), so `pnpm db:test` cannot start the local stack. Its first run is CI's `database` job |
| § 4.4 `010-catalogue.test.sql` census | `supabase/tests/010-catalogue.test.sql:85-90` | yes, the five signatures verbatim |
| § 4.4 `mir-20-impersonation.spec.ts` AC-1..AC-7 | `tests/e2e/mir-20-impersonation.spec.ts:37-127` | run here: `pnpm exec playwright test tests/e2e/mir-20-impersonation.spec.ts` → 8 passed (7 + seam guard) |

`pnpm test` run here: 62 files, 1217 tests passed.

## R7 detail

`invariants_touched` is `[]`. Each ledger ID (`.ai/registry/invariants.md:33-39`) reasoned against the
diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | No `entry` row is written or altered. The only DML in the migration targets `public.impersonation` (`:120-124`, `:134-137`, `:159-169`) and `public.impersonation_action` (`:139`, `:172`, `:249`) | migration `:120-249` |
| INV-02 approval does not survive an edit | No entry is edited; no existing trigger or function is replaced | migration `:21-278` (no `entry` reference) |
| INV-03 rejection carries a reason | No entry status is written | same |
| INV-04 one absence count | The roster returns names, role, status and team names only (`:218-225`); no count is computed in SQL or in the seam (`src/lib/data/system.ts:1366-1378`, `:662-670`). The panel only displays the list (`src/system/main.tsx:1170-1188`) | migration `:218-271` |
| INV-05 tentative counts | No count, no entry read | migration `:218-271` |
| INV-06 one portion per entry | No entry written | migration `:120-249` |
| INV-07 one member, every team | Membership is read, never written (`:255-257`, `:268-270`). AC-15 asserts a system admin under a live session cannot insert an `entry` nor delete a `membership` (`supabase/tests/390-impersonation.test.sql:341-352`), and the diff alters no existing policy that would grant it | migration `:251-271` |

No invariant is held only by a UI affordance: the panel adds no write path at all.

## Findings

None.

## Verdict

PASS. Next state `DONE`.

## Delegated decisions

none.
