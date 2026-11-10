---
ticket: CICD-02
stage: IN_PROGRESS
agent: devops
produced_at: 2026-10-13T21:58:59+07:00
inputs_read:
  - .ai/board/tickets/CICD-02/01-plan.md
  - .ai/board/tickets/CICD-02/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/steward/context.md
  - .github/workflows/verify.yml
  - .github/workflows/allowed-paths.yml
  - .github/workflows/mir-tracking.yml
  - .ai/standards/git-conventions.md
  - SETUP.md
  - docs/ops/e2e-quarantine.md
  - "local: pnpm exec playwright --version — prints `Version 1.62.1`"
  - "gh api repos/actions/cache/contents/action.yml?ref=v6.1.0 — output `cache-hit`, exact-match boolean"
  - "docs.github.com REST — Update branch protection (apiVersion 2022-11-28)"
  - "gh repo view --json nameWithOwner — didi-code0980/calechip"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CICD-02 — Implementation log

Implemented by the Developer session acting as `devops`, the implementer `01-plan.md` § 0 names.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `.github/workflows/ci-fast.yml` | created | lint, typecheck, unit on push to `feat/**` only | § 4.1 |
| `.github/workflows/verify.yml` | modified | split into `static`, `scripts`, `e2e` ×2 shards plus aggregate `verify`; caches, `concurrency`, `permissions` | § 4.2, § 4.3 |
| `.github/workflows/allowed-paths.yml` | modified | `permissions: contents: read`, nothing else | § 4.4 |
| `.github/workflows/mir-tracking.yml` | modified | `permissions: contents: read`, nothing else | § 4.4 |
| `docs/ops/branch-protection.md` | created | the settings the operator applies by hand, nine sections in plan order | § 4.5 |
| `docs/ops/branch-protection.json` | created | the PUT payload the document's first command sends | § 4.6 |
| `.ai/standards/git-conventions.md` | modified | "exactly two status checks" and the "ships empty" TODO were stale; `doc_version` 6 | § 4.7 |
| `SETUP.md` | modified | Step 8's two-checks bullets were stale | § 4.8 |
| `.ai/board/tickets/CICD-02/03-impl-log.md` | created | this log | gate |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 | `.github/workflows/ci-fast.yml:1-43` | byte-for-byte the plan's block |
| 4.2 | `.github/workflows/verify.yml:1-136` | header, body and job names as written; the `awk '{print $2}'` field verified (below) |
| 4.3 | `.github/workflows/verify.yml:46-56`, `ci-fast.yml:37-43` | `static` keeps typecheck→lint→unit→audit; `ci-fast` is lint→typecheck→unit |
| 4.4 | `allowed-paths.yml:13-14`, `mir-tracking.yml:12-13` | between `on:` and `jobs:`, one blank line each side; diff is +3/−0 per file |
| 4.5 | `docs/ops/branch-protection.md` | §§ 1–8 of the document carry plan items 2–9; item 1 is the title paragraph |
| 4.6 | `docs/ops/branch-protection.json` | equals the plan's object field for field; `JSON.parse` exits 0 |
| 4.7 | `.ai/standards/git-conventions.md:2-3`, `:276-280`, `:286-288` | `doc_version: 6`, `last_updated: 2026-10-13`; "do not enable" paragraph unchanged |
| 4.8 | `SETUP.md:181-187` | three names, pointer to the document, history line; "those three names" |

**Facts the plan told the implementer to verify, not recall:**

- `pnpm exec playwright --version` on the installed 1.62.1 prints `Version 1.62.1`, so
  `awk '{print $2}'` yields `1.62.1`. No change.
- `actions/cache@v6.1.0` `action.yml` still declares the `cache-hit` output, "an exact match was
  found for the primary key"; step outputs are strings, so `'true'` is the right comparison. No change.
- GitHub REST *Update branch protection*: `required_status_checks`, `enforce_admins`,
  `required_pull_request_reviews` and `restrictions` are the required body fields; `checks[].context`
  without `app_id` is accepted ("Omit this field to automatically select the GitHub App…");
  `restrictions: null` disables it; `required_approving_review_count: 0` means no reviewers;
  `allow_force_pushes`, `allow_deletions`, `required_linear_history`,
  `required_conversation_resolution` are booleans. The payload needed no correction.

## Deviations from the design

none.

**One conflict inside the plan, resolved by § 4 and recorded here for the reviewer.** AC-16 says
neither standing document contains "exactly two status check", and also that each keeps the old
sentence as an *Until 2026-10-13* history line. § 4.7 prescribes that history line verbatim — it
quotes "exactly two status checks: `verify` and `allowed-paths`" — and § 4.8 asks for the old
clause quoted too. The quoted history therefore contains the phrase (`git-conventions.md:279`,
`SETUP.md:184`). The phrase appears **only inside the history quotation**; no live sentence claims
two checks, and "Do not split into six" appears in neither file. I read AC-16's first clause as "no
current claim", which is what the rest of the criterion and § 4 imply.

## Invariants

`invariants_touched: []`. INV-01..INV-07 constrain entries and the absence count; no file under
`src/`, no seam, no schema changed — `git diff --name-only` lists only CI and documentation paths.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck |
| `pnpm exec eslint .` | 0 | lint |
| `pnpm exec vitest run` | 0 | 710 passed |
| `node scripts/check-docs.mjs` | 0 | errors 0, warnings 2 (pre-existing D6 absent-by-design rows) |
| `npx js-yaml` on all four workflows | 0 | each parses |
| `node -e "JSON.parse(…branch-protection.json…)"` | 0 | AC-15 |
| grep `: write\|write-all\|read-all\|secrets.\|gh \|curl\|api.github` over `.github/workflows/` | 1 (no match) | AC-11, AC-13 |
| `uses:` inventory | — | only `checkout@v7`, `pnpm/action-setup@v6`, `setup-node@v7`, `cache@v6` — AC-17 |
| `git diff --name-only` + untracked ⊆ `allowed_paths` ∪ ticket folder | yes | AC-18; `src/`, `tests/`, `scripts/`, `.claude/`, `playwright.config.ts` untouched |

**Not runnable here, owed at `/ship`:** AC-2 (`ci-fast` duration on the push), AC-7 (shard totals
and `seam-guard` in each), AC-8 (the three checks green on the PR), AC-9's cache-step log line, and
Open question 2's per-shard durations. They need GitHub runs, which exist only after the push.

## Testability contract

No selectors — no screen in this ticket (plan § 2b).

## Open questions

1. The AC-16 wording conflict above. If the reviewer reads AC-16 literally, the fix is to rephrase
   both history lines so the quotation avoids the exact phrase — a plan amendment, not a code fix.
2. Plan Open question 2 (shard count) stays open until the PR's `e2e (1/2)` and `e2e (2/2)`
   durations exist.
