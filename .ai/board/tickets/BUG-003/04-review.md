---
ticket: BUG-003
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T03:41:57+00:00
inputs_read: [ .ai/board/tickets/BUG-003/01-plan.md, .ai/board/tickets/BUG-003/03-impl-log.md, .ai/board/tickets/BUG-003/ticket.yaml, .ai/registry/invariants.md, "git diff origin/main...HEAD", src/components/Sidebar.tsx, src/components/AdminTabs.tsx, src/lib/roles.ts, tests/role-guards.test.ts, docs/ops/e2e-quarantine.md ]
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

# BUG-003 — review

Branch `feat/BUG-003`, two commits over `origin/main` (`8eaf39e` PLAN checkpoint, `5ec9fe7` IMPLEMENT
checkpoint). Working tree clean before and after review. Every command below was run by the reviewer,
one per call.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → "ticket BUG-003, 13 changed file(s) … allowed-paths: PASS" (the 4 non-allowed paths are the ticket folder ×3 and the ship-owned `.ai/board/backlog.md`). `node scripts/check-carry.mjs BUG-003` → "0 uncommitted path(s) … PASS — nothing stray". Allowed list: `ticket.yaml:16-25` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0 repo-wide, no output. Removal of the `eslint-disable-next-line @typescript-eslint/no-unused-vars` above `NAV_LINK` (`src/components/Sidebar.tsx:105-107`) is lint-clean because `NAV_LINK` is used at `:533`, `:536`, `:540` |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The diff adds no data access: only an import of `mayAdminister` (`src/components/Sidebar.tsx:75`) and JSX at `:532-544`. The file's existing data path is still `seam` (`:73`, `:265`) |
| R5 | Every plan § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | week/year shown to all roles: `src/components/Sidebar.tsx:533-538` (no condition). Holidays hidden for admin only: `:539` `mayAdminister(member.role) ? null : …`, with `mayAdminister` = `role === "admin"` (`src/lib/roles.ts:24`) — manager and member see it. Admin's single route is the hub tab `admin-hub-holidays-link` (`src/components/AdminTabs.tsx:191`), `forManager: false` (`:197`), filtered at `:315`. No route guard touched (diff has no `src/routes/**`). Four admin links stay absent (`Sidebar.tsx:496-497` comment, no JSX); confirmed by e2e `uie-10-sidebar.spec.ts:157` AC-1 passing |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:20`). See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty (0 lines); the 13 changed files contain no manifest |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1.1 import line becomes `import { mayAdminister, ROLE_LABELS } from "@/lib/roles";` | `src/components/Sidebar.tsx:75` | yes, verbatim |
| § 4.1.2 `<nav>` uncommented, role test is `mayAdminister(member.role)` | `src/components/Sidebar.tsx:532-544`; no literal role comparison — `pnpm test` passed `tests/role-guards.test.ts:37-45` (regex `:37`, Sidebar listed at `:33`) | yes, byte-for-byte with the plan block |
| § 4.1.3 `NAV_LINK` comment replaced, eslint-disable removed | `src/components/Sidebar.tsx:105-106` | yes, verbatim |
| § 4.1.4 long comment above `<nav>` untouched | `src/components/Sidebar.tsx:496-531`; diff hunk `@@ -530,19 +529,19 @@` touches only the delimiters and the role test | yes |
| § 4.2 twenty `test.fixme(` → `test(`, marker comment deleted, title/body unchanged | adm-01 `tests/e2e/adm-01-threshold.spec.ts:240`; adm-02 `tests/e2e/adm-02-holidays.spec.ts:130,141,157,184,227,246,263,308,325`; adm-03 `tests/e2e/adm-03-holiday-writes.spec.ts:397,416`; adm-04 `tests/e2e/adm-04-worklist.spec.ts:322`; cal-06 `tests/e2e/cal-06-year-view.spec.ts:325`; uie-09 `tests/e2e/uie-09-admin-hub.spec.ts:283,343,395`; uie-10 `tests/e2e/uie-10-sidebar.spec.ts:181,369,471` — 1/9/2/1/1/3/3 = 20; each diff hunk is a two-line delete + one-line add with identical title text | yes. Remaining `test.fixme` in `tests/e2e/`: only `evt-09-create-invitation.spec.ts:192`, as § 4.2 predicts |
| § 4.2 postcondition `grep -rn "BUG-003" tests/` empty | Not empty: `tests/e2e/adm-03-holiday-writes.spec.ts:496,501` — prose comments on the MIR-15-e AC-4 workaround test | Not a contract miss: the plan's own § 1 out-of-scope item 3 excludes that test, and the plan's prediction did not account for its comments. Disclosed as impl-log deviation 1. No behaviour depends on it |
| § 4.3 twenty BUG-003 register rows deleted, others byte-identical | `docs/ops/e2e-quarantine.md:26-28` now hold only the BUG-004 and two BUG-005 rows; diff on that file is 20 `-` lines and 0 `+` lines | yes. `node scripts/check-docs.mjs` reports no D15 finding |
| § 4.4 verification, e2e selection reports the twenty passed, not skipped | Reviewer's own run of the § 4.4 Playwright line (browser revision symlinked from scratchpad via `PLAYWRIGHT_BROWSERS_PATH`, no repo file touched): **89 passed (46.2 s)**, 0 failed, 0 skipped; e.g. `uie-10-sidebar.spec.ts:181` AC-2, `:369` AC-8, `:471` AC-11 listed as run | yes. `pnpm test`: 54 files, 1062 tests passed |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:20`), explicit. Checked each registered invariant against the
diff rather than accepting the empty list:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Untouched — the diff creates, edits and reads no `entry` row | `.ai/registry/invariants.md:33`; diff to `src/` is `src/components/Sidebar.tsx:75,105-106,532-544` only, all navigation/JSX |
| INV-02 approval does not survive an edit | Untouched — no entry write path changed | `.ai/registry/invariants.md:34`; no seam call added (`Sidebar.tsx:75` adds a pure role helper, `src/lib/roles.ts:24`) |
| INV-03 rejection carries a reason | Untouched — no decide path changed | `.ai/registry/invariants.md:35`; same diff extent |
| INV-04 one definition of the absence count | Untouched — no count computed or displayed by the change | `.ai/registry/invariants.md:36`; links at `Sidebar.tsx:533-543` carry no anchor and no computed value |
| INV-05 tentative still counts | Untouched — no count | `.ai/registry/invariants.md:37` |
| INV-06 one portion per entry | Untouched — no entry shape | `.ai/registry/invariants.md:38` |
| INV-07 one member, every team | Untouched — no membership read or write | `.ai/registry/invariants.md:39`; `member.role` read at `Sidebar.tsx:539` is the caller's own role for an affordance, not a membership decision |

No invariant is held by the restored links; the `/holidays` route remains session-guarded, not
role-guarded, so the affordance protects nothing (plan § 3, `Sidebar.tsx:524-526`).

## Findings

None.

Notes for a human, not findings against this gate:

- `node scripts/check-docs.mjs` exits 1 on three D9 errors in
  `.ai/registry/decisions/ADR-068-…md` and `ADR-073-…md` (`doc_version` below cited rule version).
  Neither file is in this diff; outside `allowed_paths`. Worth an `OPS-nnn` chore.
- Playwright pins chromium rev 1234 while the environment has 1243 under `/opt/pw-browsers`; the plain
  § 4.4 command fails at browser launch here. Environment, not code.

## Delegated decisions

none

## Verdict

PASS. Ticket advances to DONE.
