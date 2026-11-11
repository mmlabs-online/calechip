---
ticket: MIR-17-g
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T09:25:30Z
inputs_read: [ .ai/board/tickets/MIR-17-g/01-plan.md, .ai/board/tickets/MIR-17-g/03-impl-log.md, .ai/board/tickets/MIR-17-g/ticket.yaml, .ai/registry/invariants.md, .ai/standards/architecture.md ]
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

Subject: `git diff origin/main...HEAD` at `a6c118e` (7 files; code paths `src/App.tsx` +9/−1 and
`tests/route-role-guards.test.ts` +128). Working tree clean (`git status --porcelain` empty).

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-17-g, 7 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-17-g` → `0 uncommitted path(s)` / `PASS — nothing stray`. Code paths `src/App.tsx:291-299`, `tests/route-role-guards.test.ts:1-128` and ADR-096 are the three entries at `.ai/board/tickets/MIR-17-g/ticket.yaml` `allowed_paths` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output — repo-wide, so no outside-diff errors to route either |
| R4 | Nothing bypasses the seam (RULE-02) | PASS | Seam is `src/lib/data/` (`.ai/standards/architecture.md:17`). The `src/App.tsx` change is comment-only (`src/App.tsx:291-298`, the single removed line re-added at `:299`); the new test imports only `node:fs`, `node:url`, `vitest` (`tests/route-role-guards.test.ts:3-5`) and reads source text |
| R5 | Every § 4 contract item implemented | PASS | § 4.1 at `src/App.tsx:291-299`; § 4.2 at `tests/route-role-guards.test.ts:1-128`. See R5 detail. `pnpm test` exit 0: 56 files, 1098 tests |
| R6 | Permission gating matches plan § 3 | PASS | No route element changed: refusing routes `src/App.tsx:326`, `:374`, `:396-397`, `:484`, `:494`, `:536`; open routes `:329`, `:487`, `:510`, `:573`, `:579`. Screen refusals untouched (`git diff origin/main...HEAD -- src/routes src/components tests/e2e` empty): `src/routes/NewSignups.tsx:77-78`, `TeamEntries.tsx:83-84`, `PendingEntries.tsx:293-294`, `Threshold.tsx:126-127`, `Teams.tsx:82-83`, `AdminHub.tsx:73-74` |
| R7 | No invariant violated | PASS | `invariants_touched: []`; reasoned per candidate in R7 detail |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` absent from the branch diff (`git diff --stat origin/main...HEAD` lists 7 files, neither among them); test imports at `tests/route-role-guards.test.ts:3-5` are node built-ins and the existing `vitest` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 comment paragraph prefixed to the SOLO 2026-09-09 comment; heading `MIR-17-g, ADR-096` and the sentence `The role guards are the screens' own refusals.` on one line | `src/App.tsx:291` (heading + sentence on one line), `:292-297` (re-wrapped body, allowed by § 4.1), `:299` (original first line unchanged) | Yes. No import, no `<Route>` changed (diff is 9 added comment lines, 1 removed line re-added verbatim) |
| § 4.2 `stripComments`, `normalise` | `tests/route-role-guards.test.ts:10-12`, `:16-18` | Yes, verbatim |
| § 4.2 `RefusingRoute`, `OpenRoute`, `RoleHelper` | `tests/route-role-guards.test.ts:20-34` | Yes — fields `path`, `element`, `file`, `asks`, `refusal`, `why` |
| § 4.2 `MEMBER_ONLY`, `REFUSING_ROUTES` (6 rows), `SIGNED_IN`, `OPEN_ROUTES` (5 rows) | `tests/route-role-guards.test.ts:36-56` | Yes, every row as specified |
| § 4.2 `adminLayoutPaths` | `tests/route-role-guards.test.ts:63-69` | Yes; `m[1] as string` is the logged typing deviation (`03-impl-log.md` § Deviations), behaviour identical |
| § 4.2 `routeElement` | `tests/route-role-guards.test.ts:73-77` | Yes; `match[1] ?? null` is the logged typing deviation, behaviour identical |
| AC-1 `describe` (`>= 4` blocks, sorted path sets equal) | `tests/route-role-guards.test.ts:79-86` | Yes |
| AC-2 per-row element + no `@/lib/roles` import / no `mayAdminister(` / `mayDecide(` | `tests/route-role-guards.test.ts:88-99` | Yes |
| AC-6 inside the AC-2 `describe` | `tests/route-role-guards.test.ts:101-104` | Yes |
| AC-3 per-row import regex, `${asks}(me.role)`, `setView({ phase: "refused" })`, `data-testid` | `tests/route-role-guards.test.ts:107-120` | Yes. Held in source: `NewSignups.tsx:32,77,78,158`; `TeamEntries.tsx:37,83,84,144`; `PendingEntries.tsx:106,293,294,404`; `Threshold.tsx:49,126,127,291`; `Teams.tsx:32,82,83,137`; `AdminHub.tsx:37,73,74,105` |
| AC-4 per open row, title includes `why` | `tests/route-role-guards.test.ts:122-128` | Yes |
| AC-5 (e2e, `git diff` empty) | `git diff origin/main...HEAD -- tests/e2e src/routes src/components` empty | Run by the reviewer: `CI=1 pnpm exec playwright test` on the 10 specs that address the six `*-refused` selectors gave 87 passed, 1 flaky, 1 failed. The failure was `tests/e2e/uie-09-admin-hub.spec.ts:252` (`/holidays` landed on `/holidays/2026`), which is a hub-link navigation assertion and not a refusal. Re-run alone, that spec passed 13/13 on this branch and 13/13 on `origin/main`. The branch's only `src/` change is a JSX comment (`src/App.tsx:291-298`), and no comment can change runtime behaviour. So this is a load-sensitive flake that predates this diff |

## R7 detail

`invariants_touched: []` (`ticket.yaml`). Reasoned per invariant, because the change is comment-plus-test only:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | No entry write path touched; the diff has no `src/lib/data/` or `supabase/` path | `.ai/registry/invariants.md:33`; diff = `src/App.tsx:291-298` (comment) + `tests/route-role-guards.test.ts` |
| INV-02 approval resets on edit | No edit path touched | `.ai/registry/invariants.md:34`; same diff |
| INV-03 rejection reason | No decide path touched; `PendingEntries` unchanged | `.ai/registry/invariants.md:35`; `src/routes/PendingEntries.tsx:293-294` unchanged |
| INV-04 one absence-count definition | Plan's named candidate via `/entries/team`. Route element unchanged at `src/App.tsx:374`. No count computed in the diff | `.ai/registry/invariants.md:36` |
| INV-05 tentative counts | No counting code in diff | `.ai/registry/invariants.md:37` |
| INV-06 one portion per entry | No entry shape touched | `.ai/registry/invariants.md:38` |
| INV-07 entry counted against every team | Plan's named candidate via `/entries/pending`. Route element unchanged at `src/App.tsx:396-397`; screen admission unchanged at `src/routes/PendingEntries.tsx:293` | `.ai/registry/invariants.md:39` |

None of these depends on a UI affordance here. The diff removes or moves no guard, and every control in plan § 3 lives server-side and is untouched.

## Findings

None against this diff.

**For a human, outside the gate** (the e2e analogue of ADR-041's outside-diff lint row). `tests/e2e/uie-09-admin-hub.spec.ts:247` *AC-4: each destination opens the screen it names* failed twice under two workers, but it passes alone on both `origin/main` and this branch. It is not registered as flaky in `docs/ops/e2e-quarantine.md`. `tests/e2e/uie-10-sidebar.spec.ts:208` *AC-3* was flaky in the same run. Suggest an `OPS-nnn` chore. No loop role on MIR-17-g may touch either file (RULE-03).

## Verdict

PASS.
