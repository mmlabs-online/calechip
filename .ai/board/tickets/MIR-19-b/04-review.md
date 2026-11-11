---
ticket: MIR-19-b
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T14:12:15Z
inputs_read: [ .ai/board/tickets/MIR-19-b/01-plan.md, .ai/board/tickets/MIR-19-b/03-impl-log.md, .ai/board/tickets/MIR-19-b/ticket.yaml, .ai/registry/invariants.md, .ai/templates/review-report.md, "git diff origin/main...HEAD (453e3b6..11c933c)" ]
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

# MIR-19-b — review

Branch `feat/MIR-19-b` at 11c933c, tree clean, 0 uncommitted paths. Diff against `origin/main`
(453e3b6): 16 files, of which 11 are code (all under `tests/`), and none is under `src/`,
`supabase/`, `docker/`, `package.json` or `pnpm-lock.yaml`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carry clean | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-19-b, 16 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-19-b` → `0 uncommitted path(s)` / `PASS — nothing stray`. Allowed set at `.ai/board/tickets/MIR-19-b/ticket.yaml:18-30`. |
| R2 | typecheck exit 0, whole program | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0. `tsconfig.json:19` includes `tests`, so the helper and the vitest file are covered. |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, no output. `eslint.config.js:51` ignores only `dist`, `node_modules`, `_figma`, `coverage`, so `tests/**` is linted. |
| R4 | Nothing bypasses the data-access seam (RULE-02) | PASS | The diff has no `src/` path. The helper's only import is type-only, `tests/e2e/support/org-prefix.ts:7`, and it imports nothing from `src/`. The vitest file imports `node:fs`, `node:url`, `vitest` and the helper only, `tests/e2e-org-prefix.test.ts:2-5`. |
| R5 | Every § 4 contract item implemented (RULE-04) | PASS | See R5 detail. |
| R6 | Permission gating matches § 3 (none changed) | PASS | No `src/` change, so no gate moved. Denial assertions on the migrated specs are untouched, e.g. the member who sees no tab strip, `tests/e2e/solo-admin-tabs.spec.ts:182`. Every hunk in the nine specs replaces only a `toHaveAttribute("href", …)` line or adds the import (§ R5 detail). |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail. |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. New imports are `node:` built-ins and already-present `vitest` / `@playwright/test` (type only), `tests/e2e-org-prefix.test.ts:2-4`, `tests/e2e/support/org-prefix.ts:7`. |

Also run: `pnpm test` (vitest) exit 0, 58 files, 1145 tests, including `tests/e2e-org-prefix.test.ts`.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `E2E_ORG_CODE = "shared"` | `tests/e2e/support/org-prefix.ts:13` | yes |
| § 4.1 `stripOrg(path: string): string`, one leading `/shared` segment on `/`, `?`, `#` or end | `tests/e2e/support/org-prefix.ts:24-32` | yes. Logic traced against every AC-1 row: `startsWith` guard returns `/admin`, `/`, `/acme/…`, `/admin/shared`, `https://…`, `""` unchanged; `rest[0]` not in `/?#` returns `/sharedx/admin` unchanged; only one segment stripped from `/shared/shared/admin`. |
| § 4.1 `appPathname(page: Pick<Page,"url">): string`, pathname only | `tests/e2e/support/org-prefix.ts:35-37` | yes |
| § 4.1 `appHref(locator: Pick<Locator,"getAttribute">): Promise<string \| null>` | `tests/e2e/support/org-prefix.ts:43-46` | yes |
| § 4.1 no runtime import, no `src/` import | `tests/e2e/support/org-prefix.ts:7` (`import type` only) | yes |
| § 4.2 `solo-admin-back-to-calendar` ×5 | `tests/e2e/solo-admin-back-to-calendar.spec.ts:2,88,93,94,95,108` | yes, `"/admin"`, `"/week"`, `"/month"`, `"/year"`, `"/admin"`; neighbouring `data-state`/`toHaveText`/`aria-current` at `:87,89,90,107,109,110` unedited |
| § 4.2 `solo-admin-tabs` ×1 (`tab.path`) | `tests/e2e/solo-admin-tabs.spec.ts:2,95` | yes; `data-to` read above it not edited |
| § 4.2 `solo-approval-settings` (`SETTING`) | `tests/e2e/solo-approval-settings.spec.ts:3,103` | yes |
| § 4.2 `solo-profile` ×2 (`"/profile"`, `"/"`) | `tests/e2e/solo-profile.spec.ts:2,54,274` | yes |
| § 4.2 `solo-team-settings` (`THRESHOLD`) | `tests/e2e/solo-team-settings.spec.ts:2,89` | yes |
| § 4.2 `solo-teams` (`"/teams"`) | `tests/e2e/solo-teams.spec.ts:2,81` | yes |
| § 4.2 `tsk-01-tasks` ×2 (`"/tasks"`, `"/week"`) | `tests/e2e/tsk-01-tasks.spec.ts:2,99,111` | yes; `aria-current` at `:100,112` unedited |
| § 4.2 `tsk-04-week-task-badge` (`` `/tasks/${TODAY}` ``) | `tests/e2e/tsk-04-week-task-badge.spec.ts:2,324` | yes |
| § 4.2 `uie-09-admin-hub` poll (`destination.path`) | `tests/e2e/uie-09-admin-hub.spec.ts:2,232` | yes |
| § 4.2 `uie-09-admin-hub` `evaluateAll` snapshot through `stripOrg` | `tests/e2e/uie-09-admin-hub.spec.ts:241` | yes, verbatim to § 4.2; callback at `:238-240` unchanged |
| § 4.3 vitest file, `MIGRATED_SPECS` (9 names) | `tests/e2e-org-prefix.test.ts:8-18` | yes |
| § 4.3 `describe("stripOrg")`: `E2E_ORG_CODE` + one `it.each` row per AC-1 row (14) | `tests/e2e-org-prefix.test.ts:20-43` | yes; AC-6 corollary at `:45-49` |
| § 4.3 `describe("appPathname / appHref")` on stubs (AC-2) | `tests/e2e-org-prefix.test.ts:51-62` | yes |
| § 4.3 `describe("migrated specs")`: no raw `href` regex, imports helper (AC-3) | `tests/e2e-org-prefix.test.ts:64-76` | yes, regex `/toHaveAttribute\(\s*["']href["']/` spans line breaks |

**AC-4** (the nine specs pass, and the whole suite passes) — see *Delegated decisions*. Run here:
nine specs, 77 tests, 76 passed, 1 failed (`tsk-01-tasks.spec.ts:279`); full suite, 523 tests, 1
failed (`uie-10-sidebar.spec.ts:208`). Both failures reproduce at `origin/main` 453e3b6 with the
diff absent, and neither reaches a line this diff changed.

## R7 detail

`invariants_touched` is `[]` (`.ai/board/tickets/MIR-19-b/ticket.yaml:17`). Every registered
invariant is reasoned through anyway, because an empty list is itself a claim. The common fact under
each row: the diff changes no file under `src/`, `supabase/` or `docker/` (`git diff --name-only
origin/main...HEAD -- src supabase docker` is empty). Only test-side reading of `href` and URL text
changes, and the expected values are unchanged (§ R5 detail).

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | No entry write path or overlap check is in the diff; the helper is pure string work | `tests/e2e/support/org-prefix.ts:24-46` |
| INV-02 approval resets on edit | No entry edit or status logic is in the diff | `tests/e2e/support/org-prefix.ts:24-46`; spec hunks are `href` reads only, e.g. `tests/e2e/tsk-04-week-task-badge.spec.ts:324` |
| INV-03 rejection carries a reason | No reject path in the diff | as INV-02 |
| INV-04 one definition of the absence count | No count computed anywhere in the diff; no second definition introduced | `tests/e2e/support/org-prefix.ts:13-46` (the whole of the new non-test-runner code) |
| INV-05 tentative counts | No count, no tentative flag handled | as INV-04 |
| INV-06 one portion per entry | No entry shape touched | as INV-01 |
| INV-07 one member, every team | No membership or counting code touched | as INV-04 |

## Findings

None that fail a check.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

Two pre-existing e2e failures, outside this diff's reach, recorded for a human as chores (not a
gate finding — see *Delegated decisions*):

- `tests/e2e/uie-10-sidebar.spec.ts:208` (AC-3), timeout in `returnToCalendar` at `:149-150`
  (`count() > 0` then `click()` races the period group). Failed 1/1 in the full run and 2/3 alone on
  this branch; 1/3 at `origin/main` 453e3b6. The spec imports only `@playwright/test` (`:1`) and is
  not in the diff.
- `tests/e2e/tsk-01-tasks.spec.ts:279` (AC-13 to AC-15), `addTask` visibility timeout at `:59`,
  called from `:284`. Failed 1/77 on this branch; 4/10 at `origin/main` 453e3b6. The test body
  `:279-317` holds no migrated site; this diff's edits in the file are `:2`, `:99`, `:111`, in a
  different test.
- Neither is registered in `docs/ops/e2e-quarantine.md`. Owed: a `BUG-nnn` per test and either a fix
  or an ADR-060 quarantine row. MIR-19-b cannot fix either: `uie-10-sidebar.spec.ts` is outside
  `allowed_paths` (RULE-03), and `tsk-01-tasks.spec.ts` is inside them but no § 4 item covers that
  test, so a fix there would be scope drift.

## Delegated decisions

ADR-067: the verdict waited on one decision a reviewer can recommend, so it is taken here.

- **Decision:** AC-4's "the whole suite passes" is judged as "no e2e failure is attributable to this
  diff", and a failure that reproduces at `origin/main` with the diff absent, in a test the diff does
  not change, is recorded as a chore and does not fail the gate.
- **Why:** it is the same exemption ADR-041 writes for R3 (an error outside the diff is cited and
  routed as a chore, the gate still passes), for the same reason: failing the gate on it charges the
  Developer for a defect it did not cause, and routes REWORK to a role that has no contract item to
  fix it with (RULE-08).
- **Evidence:** both failures were reproduced in a detached `origin/main` worktree (since removed),
  with the same stack traces (§ Findings).
- **Rejected:** FAIL routed to `developer` — would burn RULE-06 budget on `main`'s flakes. BLOCKED to
  `human` — the fact needed (does the diff cause it?) was checkable and was checked.

## Verdict

**PASS.** R1 to R8 pass, each cited above. Next state DONE.
