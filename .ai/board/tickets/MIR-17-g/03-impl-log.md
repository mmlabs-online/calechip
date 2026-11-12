---
ticket: MIR-17-g
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T09:24:00Z
inputs_read: [ .ai/board/tickets/MIR-17-g/01-plan.md, .ai/board/tickets/MIR-17-g/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/App.tsx` | modified | one paragraph added at the top of the existing JSX comment above the first `AdminLayout` block; no code change, no import | § 4.1, AC-6 |
| `tests/route-role-guards.test.ts` | created | source-text test classifying every path under `AdminLayout` as refusing or open | § 4.2, AC-1 to AC-4, AC-6 |

`.ai/registry/decisions/ADR-096-…md` is in `allowed_paths` but was written at PLAN (ADR-067) and is
not touched by this stage.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `src/App.tsx:291` | The sentence `The role guards are the screens' own refusals.` is on one line. The other lines are wrapped to the file's existing comment width. |
| 4.2 | `tests/route-role-guards.test.ts` | Constants, helper names and fields are exactly as in the plan. 20 tests. |

## Deviations from the design

Typing only. The repo's `tsc` rejects the plan's snippet under `noUncheckedIndexedAccess`
(`m[1]` and `match[1]` are `string | undefined`). Two edits: `m[1] as string` in `adminLayoutPaths`
and `match[1] ?? null` in `routeElement`. Behaviour is identical. No consultation needed.

## Invariants

`invariants_touched: []`. No read, write or rendered screen changes: `src/App.tsx` gains a comment
only and the test reads source text.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | after the typing fix above |
| `pnpm exec eslint .` | 0 | |
| `pnpm test` | 0 | 56 files, 1098 tests |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | `src/App.tsx`, `tests/route-role-guards.test.ts` |

AC-5: `src/routes`, `src/components` and `tests/e2e` are not modified. The e2e suite was not run
here; no rendered output changed.

## Testability contract

No new selectors. The test reads the six existing `*-refused` ids from the screens' source.

## Open questions

None.
