---
ticket: ADM-06
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-06T10:30:08+07:00
inputs_read:
  - .ai/board/tickets/ADM-06/01-plan.md
  - .ai/board/tickets/ADM-06/03-impl-log.md
  - .ai/board/tickets/ADM-06/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/steward/context.md
  - scripts/check-allowed-paths.mjs
  - supabase/db.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260903160000_cal03_admin_entry_writes.sql
  - supabase/migrations/20260905190000_adm05_entry_decision.sql
  - package.json
  - the working tree (`git diff`, and the six untracked files)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# ADM-06 — review report

**R1 through R8 pass.** `next_state: DONE` and not the template's `QA`: ADR-022 removed the stage and
the enum at `.ai/01-operating-model.md:70` carries no `QA` value.

**Read on a fresh session, files only, no channel to the Developer (RULE-13).** An `04-review.md`
already stood in the working tree when this session opened; it was overwritten, not read past its
front-matter, and every citation below was reached from the implementation.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | ten code paths in the tree, ten literals at `ticket.yaml:77-86`, one-for-one; the fourth changed board file is `ticket.yaml` itself, inside the ticket folder, exempt at `scripts/check-allowed-paths.mjs:131`. Verified by hand — see *Findings* on why the script alone does not verify it here |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, under Node v22.11.0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, same toolchain |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/components/BulkRejection.tsx:39` and `src/routes/PendingEntries.tsx:57` both take `seam` from `@/lib/data`; the only `.rpc(` in `src/` is `src/lib/data/supabase.ts:1558`; the three `@supabase/` hits outside `src/lib/data/` are comments (`src/lib/draft-entry.ts:13`, `src/lib/domain/types.ts:61`, `:490`) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | the table below, every row read at the line cited |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260905230000_adm06_reject_entries.sql:74` is `security invoker`, so `entry_update_admin` (`20260903160000_cal03_admin_entry_writes.sql:80-88`) and clause (a) (`20260905190000_adm05_entry_decision.sql:84-92`) both still run as the caller; the mock reproduces both at `src/lib/data/mock.ts:1581-1598`; the screen refuses a non-admin before the bar exists at `src/routes/PendingEntries.tsx:170-171` |
| R7 | No invariant violated (RULE-07) | PASS | one ID in `invariants_touched` (`ticket.yaml:39`), reasoned through below |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` is empty — neither manifest nor lockfile is in the diff, and `package.json:18-27` carries the same eight runtime dependencies |

## R5 detail

One row per contract item in `01-plan.md` § 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `BulkRejectionOutcome` | `src/lib/domain/types.ts:516-521` | Yes — both fields, both comments, verbatim |
| § 4.1 `no_entries_selected` on `FailureCode` | `src/lib/domain/types.ts:105` | Yes — added beside ADM-05's two; `unknown` still closes the union at `:106` |
| § 4.2 `rejectEntries` on `DataSeam` | `src/lib/data/index.ts:761` | Yes — `(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>>`, character for character. `rejectEntry` above at `:715` is untouched |
| § 4.2 supabase implementation | `src/lib/data/supabase.ts:1537-1575` | Yes — reason refusal, dedup, empty refusal, `.rpc("reject_entries", { p_ids, p_reason })` at `:1558`, `typeof data !== "number"` guard at `:1570`, `{ requested: ids.length, rejected: data }` at `:1574` |
| § 4.2 `22023` in `toDecisionFailure` | `src/lib/data/supabase.ts:478-479` | Yes — a new `case` in the existing switch; `23514`, `42501` and `PGRST301` keep their codes and sentences at `:471`, `:485-487` |
| § 4.2 mock implementation | `src/lib/data/mock.ts:1556-1607` | Yes — the datastore's order: reason `:1559`, dedup `:1565`, empty `:1569`, the two policies composing `:1581-1584`, clause (a) over the whole admitted set `:1591-1596`, then the write `:1601-1603` |
| § 4.2 the two sentences | `src/lib/data/supabase.ts:439-440`, `src/lib/data/mock.ts:436-437` | Yes — identical strings in both implementations |
| § 4.3 the migration | `supabase/migrations/20260905230000_adm06_reject_entries.sql:73-86, 98-99` | Yes — the function body is byte-identical to `supabase/db.sql:553-566` and the two privileges to `supabase/db.sql:697-698`, `revoke` before `grant`, `create or replace`, `security invoker`, `set search_path = ''` |
| § 4.4 `BulkRejectionProps` | `src/components/BulkRejection.tsx:42-66` | **Deviated, declared, accepted** — a fifth prop `outcome` (`:60`) and `onRejected: (outcome) => …` (`:65`). See below |
| § 4.4 the four screen additions | `src/routes/PendingEntries.tsx:145` (selection), `:216-219` (the AC-14 reset), `:381-390` (the bar, outside the `<ul>`), `:417-435` (the row checkbox) | Yes. `load` (`:160-201`), the four view phases, both filters, the pager, the count paragraph, the row link and `<EntryDecision>` are unchanged — `git diff src/routes/PendingEntries.tsx` removes no line |
| § 4.4 the copy table | `src/components/BulkRejection.tsx:129-215` | Yes, except the reason label at `:183` — **deviated, declared, accepted**. See below |
| § 4.5 the selector table | `BulkRejection.tsx:122, 141, 151, 185, 208, 226, 243`; `PendingEntries.tsx:422` | All eight exist; `data-selected`, `data-required`, `data-requested`/`data-rejected` and `data-code` all carried |

**The three declared deviations were checked rather than accepted on the log's word, and none of them
changes a behaviour, a permission, an invariant or a field name.**

1. **The reason label reads `What would work instead for these entries?`**
   (`src/components/BulkRejection.tsx:183`). § 4.4's table fixes the panel's exact string, and it
   cannot be that string: `tests/e2e/adm-05-approve-reject.spec.ts:306` addresses that label by text,
   which under Playwright's strict mode resolves to two elements the moment the bar renders. That file
   is not in `allowed_paths` and § 7 requires it to pass unedited, so the wording is the only half
   that could move. AC-16 is unweakened — the object is still an *entry*, and no quota, balance or
   entitlement word appears (`tests/e2e/adm-06-bulk-reject.spec.ts:294`).
2. **`outcome` is the caller's, not the bar's** (`src/routes/PendingEntries.tsx:153`,
   `src/components/BulkRejection.tsx:60`). Verified as forced rather than preferred:
   `load()` sets `{ phase: "loading" }` at `src/routes/PendingEntries.tsx:161` and the component
   returns at `:221` before the bar is rendered, so the bar unmounts during the re-read AC-12
   requires. § 2b requires the result sentence to survive that. The error stays in the bar
   (`BulkRejection.tsx:93`) and is correct there — a refusal calls neither `onRejected` nor `load`,
   so nothing unmounts (`:107-110`), which is AC-13's first half.
3. **The submit is disabled on `busy` alone** (`src/components/BulkRejection.tsx:210`). § 3 lists a
   disabled submit among the affordances and does not say what disables it. Disabling on an empty
   selection would make AC-4 unreachable through the interface and the same argument would take AC-3
   — `src/components/EntryDecision.tsx:20-24` is the precedent.

## R7 detail

**One row per ID in `invariants_touched` (`ticket.yaml:39`).**

| Invariant | Held by | Citation |
|---|---|---|
| `INV-03` — a rejected entry always carries a non-empty rejection reason | The check constraint `entry_rejection_reason_iff_rejected`, **unamended by this ticket**, and it is a biconditional: `(status = 'rejected') = (rejection_reason is not null and btrim(rejection_reason) <> '')`. The batch writes both columns **in one statement, per record**, which is the only shape that constraint admits. The two refusals above it are affordances and neither is the control | `supabase/migrations/20260903103000_cal01_entry.sql:93-96` (the constraint, and `grep` finds no `create` or `alter` touching it in this ticket's migration); `supabase/migrations/20260905230000_adm06_reject_entries.sql:80-82` (the one statement); `:77-79` (the `22023` refusal — `coalesce` is load-bearing, since `btrim(null)` is null and `null = ''` is not true); `src/lib/data/supabase.ts:1542-1544` and `src/lib/data/mock.ts:1559-1561` (the seam refusal, before any request); `tests/bulk-rejection.test.ts:123` (AC-2, the reason on every record across two members) and `:259` (AC-3, a blank batch leaves every row `pending` with a null reason) |

**The four absent IDs were reasoned through rather than taken from the plan.** `INV-02`: no trigger is
created or replaced — the migration contains three statements and none of them names
`entry_enforce_decision` (`supabase/migrations/20260905230000_adm06_reject_entries.sql:73, 98, 99`), so
AC-9's clearing of `approvedBy`/`approvedAt` is clause (b) doing what it already does
(`20260905190000_adm05_entry_decision.sql:112-119`). `INV-05`: `tentative` appears in neither the
function's `set` list (`:81`) nor in any grant this ticket writes. `INV-01`: a rejected entry still
occupies its slots (ADR-011), and the `set` list touches no date, portion or member column, so the
exclusion constraint sees what it saw. `INV-04`: nothing here computes an absence count.

**The `security invoker` line is the one this gate exists to check, and it is correct at
`supabase/migrations/20260905230000_adm06_reject_entries.sql:74`.** A `security definer` rewrite would
make `entry_update_admin` and clause (a) evaluate against the owner rather than the caller and turn
this feature into an authorization bypass with every test in the repository still green. Two further
things were checked rather than assumed: `entry_update_admin`'s `with check` constrains only the team
of the new row (`20260903160000_cal03_admin_entry_writes.sql:86-88`) and `member_id` is ungranted, so
an unadmitted row is **filtered and never raises** — which is what makes AC-11 a partial result rather
than an error; and `entry_update_own` admits a member's own rows, so clause (a) is genuinely the only
thing between a member and a bulk rejection of their own entries (`tests/bulk-rejection.test.ts:299`).

## Findings

None blocking. Two observations, neither a gate item and neither routed:

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R1, method | `scripts/check-allowed-paths.mjs:123` diffs `origin/main...HEAD`, and this ticket is entirely uncommitted, so the script printed `0 changed file(s)` and passed **vacuously**. `03-impl-log.md` cites its exit 0 as R1 evidence. R1 was therefore verified here against the working tree by hand — seven modified and six untracked files, less the three under `.ai/board/tickets/ADM-06/`, is exactly the ten at `ticket.yaml:77-86`. The script is not wrong; it is a `/ship`-time check being read as a REVIEW-time one | nobody — the check passes on the facts | No |
| 2 | none | `pnpm exec vitest run` → **10 files, 195 tests, 0 fail** and `pnpm exec playwright test` → **165 pass**, both re-run in this session on the dirty tree under Node v22.11.0. `tests/seam-parity.test.ts`, `tests/entry-decision.test.ts`, `tests/pending-entries.test.ts` and `tests/e2e/adm-05-approve-reject.spec.ts` pass **unedited**, which is what § 7 claimed and is the load-bearing half of deviation 1 | — | No |

## Verdict

`PASS`. `next_state: DONE`.

The board is the `orchestrator`'s to move; this artifact's front-matter is the record
(`.ai/01-operating-model.md`, stage ownership — the REVIEW row writes `04-review.md` and nothing else).
