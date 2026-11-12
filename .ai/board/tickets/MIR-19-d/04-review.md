---
ticket: MIR-19-d
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-12T01:58:40Z
inputs_read: [ .ai/board/tickets/MIR-19-d/01-plan.md, .ai/board/tickets/MIR-19-d/03-impl-log.md, .ai/board/tickets/MIR-19-d/99-questions.md, .ai/board/tickets/MIR-19-d/ticket.yaml, .ai/registry/invariants.md, .ai/01-operating-model.md, "git diff origin/main...HEAD", src/App.tsx, src/lib/org-path.ts, src/hooks/useSession.ts, tests/org-path.test.ts, tests/e2e/mir-19-d-flip.spec.ts, tests/e2e/mir-19-org-routing.spec.ts, tests/e2e/evt-14-guest-sign-in.spec.ts, tests/e2e/cal-08-holiday-shading.spec.ts, tests/e2e/uie-10-sidebar.spec.ts ]
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `ticket MIR-19-d, 14 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-19-d` → `0 uncommitted path(s)` … `PASS — nothing stray`. The non-exempt changed paths are `src/App.tsx`, `src/lib/org-path.ts`, `tests/org-path.test.ts`, the four e2e specs and `.ai/board/tickets/MIR-19-e/ticket.yaml`, `.ai/board/tickets/MIR-19-f/ticket.yaml`, all listed at `.ai/board/tickets/MIR-19-d/ticket.yaml:22-31` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. Run by this reviewer |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`, repo-wide) exit 0, no output. Run by this reviewer |
| R4 | No datastore access outside the seam | PASS | `src/lib/org-path.ts:70-96` adds pure string functions and imports nothing. `src/App.tsx:63` imports only from `@/lib/org-path`; the org code comes from `useSession` (`src/App.tsx:203`), which reads it through `seam.getOwnOrgCode()` (`src/hooks/useSession.ts:105`). No new import of a client or of `src/lib/data/` in the diff |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | Flip on only for `membership.state === "member"` with a non-null `orgCode`: `src/App.tsx:211`, and the arm switches on it at `src/App.tsx:816-823`. The target org is `ownOrg`, never taken from the URL: `src/App.tsx:216`, `src/App.tsx:140`. `/signin`, `/signup`, `/guest/:token`, `/guest/registration/:token` routes are unchanged above the switch (`src/App.tsx:776-810`) and `ROOT_ONLY_SEGMENTS` keeps them at the root (`src/lib/org-path.ts:70`, `:94`). Org-shaped first segments are not flipped (`src/lib/org-path.ts:92`), so MIR-19 AC-4's `org-not-found` stands. `shellRoutes` and its guards are not in the diff; `tests/route-role-guards.test.ts` passes under `pnpm test` (1188 passed) |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; the only new imports are of local modules (`src/App.tsx:63`, `tests/e2e/evt-14-guest-sign-in.spec.ts:2`, `tests/org-path.test.ts:5-13`) |

**Test runs by this reviewer.** `pnpm test`: 58 files, 1188 passed. `pnpm exec playwright test`: 529 passed,
3 failed (`tsk-01-tasks.spec.ts:279`, `tsk-02-overdue-prompt.spec.ts:109`, `uie-10-sidebar.spec.ts:208`). All
four specs this ticket edits or adds passed in that run (mir-19-d-flip 9/9, mir-19-org-routing 11/11, evt-14 19/19,
cal-08 11/11), as did tsk-02 AC-10 (`tsk-02-overdue-prompt.spec.ts:215`) and evt-09. The three failures pass when
their files are rerun (31 passed). They are **not attributable to this diff**: the same suite run on an export of
`origin/main` fails `tsk-01:279` and `tsk-02:109` (plus `evt-07-guest-registration.spec.ts:149`), and
`uie-10-sidebar.spec.ts:208` run with `--repeat-each=24` fails 5/24 on `origin/main` and 7/24 on this branch, each
time with the same `locator.click: Test timeout of 30000ms exceeded` at `uie-10-sidebar.spec.ts:150`. Test count
is 523 on main and 532 here, i.e. +9 from the new spec. AC-12 is met to the extent the baseline allows; see
Findings for the chore.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `ROOT_ONLY_SEGMENTS` | `src/lib/org-path.ts:70` | yes — `readonly string[]`, `["signin", "signup", "guest"]` |
| § 4.1 `ownOrgAddress` (docblock with the amended examples, rule: org-shaped first segment → null, root-only → null, else `orgPath + suffix`) | `src/lib/org-path.ts:72-96` | yes — `(orgCode: string, pathname: string, suffix: string): string \| null`; docblock matches plan § 4.1 line for line after the 01:27 amendment |
| § 4.2 `ownOrg` after `useSession()` | `src/App.tsx:211` | yes |
| § 4.2 root arm: `ownOrg === null` keeps `EnterOrg` + `shellRoutes`, else one `path="*"` → `EnterOwnOrg` | `src/App.tsx:816-823` | yes; `base !== "/"` arm unchanged (`src/App.tsx:824-840`) |
| § 4.2 `EnterOwnOrg`, module-level, three branches | `src/App.tsx:128-148` — branch 1 `:139`, `:142`, `:144`; branch 2 `:146`; branch 3 `:143` via `cross` (replaceState, `src/App.tsx:228-233`) | yes — props `{orgCode, cross, syncBase}`, returns `JSX.Element \| null` |
| § 4.3 capture-phase `popstate` listener rewriting the entry with `history.state` passed through, then `syncBase` | `src/App.tsx:212-225` | yes — deps `[ownOrg, syncBase]`, `capture: true` on add and remove. The TODO(verify) on ordering is settled by `mir-19-d-flip.spec.ts:98-113` (AC-6, `isConnected` at `:112`) and `tsk-02-overdue-prompt.spec.ts:215` both passing in this reviewer's run |
| § 4.4 `describe("MIR-19-d ownOrgAddress")`, one `it` per docblock example plus `ROOT_ONLY_SEGMENTS` | `tests/org-path.test.ts:82-105` (12 cases, `:103`); imports `tests/org-path.test.ts:6`, `:10` | yes; no existing `describe` edited |
| § 4.5 new spec, AC-1..AC-9 | `tests/e2e/mir-19-d-flip.spec.ts:31`, `:39`, `:59`, `:70`, `:84`, `:98`, `:115`, `:126`, `:139` | yes; AC-7 uses `/x/such/page` per amendment (`:118`) |
| § 4.5 mir-19-org-routing AC-11 amended, header line added | `tests/e2e/mir-19-org-routing.spec.ts:9`, `:154-168` | yes — title as specified, `expect.poll` on each pathname |
| § 4.5 evt-14: one import, four landings | `tests/e2e/evt-14-guest-sign-in.spec.ts:2`, `:296`, `:336`, `:343`, `:350` | yes; no other line in the diff |
| § 4.5 cal-08: two `backTo` targets, one comment line each | `tests/e2e/cal-08-holiday-shading.spec.ts:407-408`, `:548-549` | yes; nothing else in the file changed |
| § 7 MIR-19-e / MIR-19-f `ticket.yaml` | `.ai/board/tickets/MIR-19-e/ticket.yaml`, `.ai/board/tickets/MIR-19-f/ticket.yaml` (written at PLAN, commit c6311df) | yes |

## R7 detail

`invariants_touched` is `[]` (`.ai/board/tickets/MIR-19-d/ticket.yaml:21`). The empty list was checked against each
ledger ID rather than accepted:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Not reachable: the diff writes no entry. Changes are confined to routing (`src/App.tsx:128-148`, `:211-225`, `:816-823`) and a pure path function (`src/lib/org-path.ts:70-96`) | `.ai/registry/invariants.md:33` |
| INV-02 approval reset on edit | Not reachable: no entry edit path changed; `shellRoutes` (which mounts `EditEntry`) is not in the diff | `.ai/registry/invariants.md:34`; `src/App.tsx:410` unchanged |
| INV-03 rejection reason | Not reachable: no review/reject path in the diff | `.ai/registry/invariants.md:35` |
| INV-04 absence count | Not reachable: no count computed or read differently; screens mount unchanged under `/shared` | `.ai/registry/invariants.md:36`; `src/App.tsx:822` renders no screen |
| INV-05 tentative counts | As INV-04 | `.ai/registry/invariants.md:37` |
| INV-06 one portion | Not reachable: no entry shape touched | `.ai/registry/invariants.md:38` |
| INV-07 one member, every team | Not reachable: membership is read, not written; the org used is the one the seam returned | `.ai/registry/invariants.md:39`; `src/hooks/useSession.ts:105` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | — (not a gate failure) | Pre-existing e2e flakes on `origin/main`, outside this diff: `uie-10-sidebar.spec.ts:208` (5/24 failures on main under `--repeat-each=24`, hang at `:150`), `tsk-01-tasks.spec.ts:279`, `tsk-02-overdue-prompt.spec.ts:109`, `evt-07-guest-registration.spec.ts:149`. No loop role can fix them inside MIR-19-d's `allowed_paths`. Recorded for a human as a `BUG-`/`OPS-` chore; it does not fail this gate | human (chore) | false |

## Verdict

PASS.
