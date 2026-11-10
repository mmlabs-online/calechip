---
ticket: MIR-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-21T16:36:00+07:00
inputs_read:
  - .ai/board/tickets/MIR-01/01-plan.md
  - .ai/board/tickets/MIR-01/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/board/tickets/MIR-04/verification.md
  - .ai/board/tickets/MIR-04/03-impl-log.md
  - .gitignore
  - docs/ops/ci-cd.md
  - .github/workflows/build-image.yml
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-01: implementation log

No key was requested, read, echoed or used. `5a29434` was checked for reachability only
(`git cat-file -t`, `git branch -r --contains`), never shown.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `docs/ops/key-rotation.md` | created | the permanent, append-only rotation record, with one placeholder row for the operator | § 4.1 |
| `.ai/board/tickets/MIR-01/verification.md` | created | the manual steps for AC-1..AC-9 with empty `Result` lines; no agent may hold a key to run them | § 4.2 |
| `.gitignore` | modified | one comment line under the leak record, pointing at the rotation log | § 4.3 |
| `docs/ops/ci-cd.md` | modified | one bullet after the secrets list: rotation changes the value, not the name, and needs a new image | § 4.3 |
| `.ai/board/tickets/MIR-01/03-impl-log.md` | created | this log | gate |
| `.ai/board/tickets/MIR-01/ticket.yaml` | modified | `state: REVIEW` on this log's PASS | gate |

`.ai/board/backlog.md` and `01-plan.md` appear in `git diff origin/main` from the PLAN checkpoint
commit `c52d27e`, not from this stage.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 front-matter, heading, intro | `docs/ops/key-rotation.md:1-11` | `last_updated` filled with the creation date — see Deviations |
| 4.1 table, placeholder row | `docs/ops/key-rotation.md:13-15` | placeholders verbatim from the plan |
| 4.1 *Consequences* | `docs/ops/key-rotation.md:17-21` | first bullet as written; second left as the AC-6 placeholder |
| 4.2 front-matter (`steps_written_by`, `results_filled_by`) | `verification.md:1-9` | MIR-04 shape |
| 4.2 Setup, variables only | `verification.md` § Setup | `OLD_SERVICE` via `git show 5a29434:.env` into a variable; `OLD_ANON`/`NEW_ANON` via `read -rs`; only lengths printed |
| 4.2 curl prints status only | every `curl` | `-s -o /dev/null -w '%{http_code}\n'` |
| 4.2 Part 1 | `verification.md` § Part 1 | AC-1 |
| 4.2 Part 2, in order | `verification.md` § Part 2 | AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9 |
| 4.2 closing line | `verification.md` § When every `Result` is filled | row in `key-rotation.md`, then `Verified` cell |
| 4.3 `.gitignore` pointer | `.gitignore:21` | directly under line 20 |
| 4.3 `ci-cd.md` bullet | `docs/ops/ci-cd.md:64` | text verbatim from the plan |

## Deviations from the design

1. **AC-8's diff grep uses a tightened pattern.** The plan's pattern,
   `eyJ[A-Za-z0-9_-]{20,}|sb_secret_|sb_publishable_`, matches the plan's own AC-8 line
   (`01-plan.md`, committed in `c52d27e`, so it is in `git diff origin/main`): run as written it can
   never find nothing. `verification.md` uses `sb_(secret|publishable)_[A-Za-z0-9]`, which still
   catches any real new-format key (prefix followed by key characters) but does not match the
   pattern text itself. Run on this branch: `0`. No consultation — the intent of AC-8 is unchanged
   and only the self-match is removed; the reviewer should confirm.
2. **`last_updated` in `key-rotation.md` is `2026-10-21`, not `<YYYY-MM-DD>`.** It is the document's
   date, not the rotation's; the row's `date` field stays a placeholder for the operator.
3. **AC-3 gains a control request** with `NEW_ANON`, expecting `200`, so a non-2xx on the old key is
   attributable to the key and not to a wrong URL. Uses only a variable the plan already lists.
4. **`verification.md` includes the operator's install step** (`gh secret set VITE_SUPABASE_ANON_KEY`,
   `.env.local`, merge → build → release → deploy) before AC-2, because AC-4 depends on it and the
   plan places it in Part 2's precondition ("after rotation and deploy").

## Invariants

`invariants_touched: []`. No entry, count or membership is read or written: the diff is two
Markdown files and two comment/prose lines.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| unit tests | not run | no code changed; nothing under `src/`, `supabase/`, `tests/` |
| `node scripts/check-docs.mjs` | 0 | |
| `git diff origin/main -- . \| grep -cE '<tightened AC-8 pattern>'` | — | `0` |
| `git diff --name-only` subset of `allowed_paths` | yes | plus the PLAN-commit files noted above |

## Testability contract

No selectors — no screen changes (01-plan.md § 2b).

## Open questions

- AC-1..AC-9 results, the § 4.1 row and the `Verified` cell are the operator's, after rotation.
  Empty operator fields are not an implementation FAIL (01-plan.md § 3).
- The plan's AC-8 text in `01-plan.md` still carries the self-matching pattern; this stage may edit
  the ticket folder but does not rewrite the plan. Deviation 1 is the record.
