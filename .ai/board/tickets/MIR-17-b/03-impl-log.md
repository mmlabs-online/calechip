---
ticket: MIR-17-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-08T18:25:00+08:00
inputs_read:
  - .ai/board/tickets/MIR-17-b/01-plan.md
  - .ai/board/tickets/MIR-17-b/ticket.yaml
  - src/lib/roles.ts
  - src/routes/AdminHub.tsx
  - src/routes/NewSignups.tsx
  - src/routes/Threshold.tsx
  - src/routes/Teams.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/Holidays.tsx
  - src/components/AdminLayout.tsx
  - tests/member-rpc-roster-team.test.ts
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/AdminHub.tsx` | modified | guard now asks `mayAdminister`; import added | §4 row 1 |
| `src/routes/NewSignups.tsx` | modified | guard now asks `mayAdminister`; import added | §4 row 2 |
| `src/routes/Threshold.tsx` | modified | guard now asks `mayAdminister`; import added | §4 row 3 |
| `src/routes/Teams.tsx` | modified | guard now asks `mayAdminister`; roster row label now reads `ROLE_LABELS[person.role]`; imports added | §4 rows 4–5 |
| `src/routes/TeamEntries.tsx` | modified | guard now asks `mayAdminister`; import added | §4 row 6 |
| `src/routes/Holidays.tsx` | modified | all three spellings of the admin test (`:181`, `:275`, `:355`) now ask `mayAdminister`; import added | §4 rows 7–8 |
| `src/components/AdminLayout.tsx` | modified | guard now asks `mayAdminister`, with a `role === null` disjunct (see Deviations); `mayAdminister` added to the existing `@/lib/roles` import | §4 row 9 |
| `tests/role-guards.test.ts` | created | the source-text test named at §4.1: pins the absence of the literal role comparison and the presence of the `@/lib/roles` import in each of the seven files, plus the `ROLE_LABELS[person.role]` text in `Teams.tsx` | §4.1 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `AdminHub.tsx:72` | `src/routes/AdminHub.tsx:73` (line moved by the added import) | `!me \|\| !mayAdminister(me.role)` |
| `NewSignups.tsx:76` | `src/routes/NewSignups.tsx:77` | `!me \|\| !mayAdminister(me.role)` |
| `Threshold.tsx:125` | `src/routes/Threshold.tsx:126` | `!me \|\| !mayAdminister(me.role)` |
| `Teams.tsx:81` | `src/routes/Teams.tsx:82` | `!me \|\| !mayAdminister(me.role)` |
| `Teams.tsx:337` | `src/routes/Teams.tsx:338` | `{ROLE_LABELS[person.role]}` |
| `TeamEntries.tsx:82` | `src/routes/TeamEntries.tsx:83` | `!mayAdminister(me.role)` |
| `Holidays.tsx:181` | `src/routes/Holidays.tsx:182` | `me !== null && mayAdminister(me.role)` |
| `Holidays.tsx:275` | `src/routes/Holidays.tsx:276` | `… && mayAdminister(me.role) && …` |
| `Holidays.tsx:355` | `src/routes/Holidays.tsx:356` | `me !== null && mayAdminister(me.role) && …` |
| `AdminLayout.tsx:143` | `src/components/AdminLayout.tsx:143` | `role === null \|\| !mayAdminister(role)` — see Deviations |
| imports (§4 closing paragraph) | each of the seven files | `mayAdminister` imported from `@/lib/roles`; `Teams.tsx` also imports `ROLE_LABELS`; `AdminLayout.tsx` adds `mayAdminister` to its existing `mayDecide` import |
| `tests/role-guards.test.ts` (§4.1) | `tests/role-guards.test.ts` | source-text test, comments stripped before the literal-pattern check, per file |

## Deviations from the design

**`AdminLayout.tsx:143`** — §4's table gives `!mayAdminister(role)` verbatim. `role` on this prop is
typed `MemberRole | null` (`AdminLayoutProps.role`, unchanged by this ticket), and `mayAdminister`
takes `MemberRole`. The literal replacement fails `pnpm exec tsc --noEmit` with
`Argument of type 'MemberRole | null' is not assignable to parameter of type 'MemberRole'`.

Recommended option taken and applied: `role === null || !mayAdminister(role)`. This is the same
refusal `role !== "admin"` gave for a `null` role (refuse, blank the badges) — `null !== "admin"` was
`true` and so is `role === null`, so no caller's outcome moves. No field was invented and no file
outside `allowed_paths` was touched; `src/lib/roles.ts` stays unchanged, as §1 required. This was a
mechanical type-correctness consequence of the contract's literal text rather than a design
judgment call, so it is recorded here rather than put through `99-questions.md`.

Nothing else was built differently from §1 through §7. `none` otherwise.

## Invariants

`invariants_touched: []` (ticket.yaml, 01-plan.md § 2). No invariant applies: every guard touched is
an affordance under ADR-005, each kept its existing truth table (01-plan.md § 3), and no data path or
schema changed (§5, §6).

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | 11 changed files (10 tracked + 1 new), all within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-17-b` | 0 | 8 uncommitted paths, all carried from `allowed_paths` |
| `pnpm typecheck` (`pnpm exec tsc --noEmit`) | 0 | failed once on `AdminLayout.tsx` before the deviation above; 0 after |
| `pnpm lint` (`pnpm exec eslint .`) | 0 | |
| `pnpm exec vitest run` | 0 | 53 files, 1047 tests, all pass (includes the 15 new in `tests/role-guards.test.ts`) |
| `git diff --name-only` subset of `allowed_paths` | yes | 7 modified + `tests/role-guards.test.ts` untracked; both sets checked above |

End-to-end was not run: no screen's markup, route, or `data-testid` changed (AC-1 through AC-3 are
about which `ROLE_LABELS` entry and which boolean a guard reads, not about any element added, moved,
or removed), so no `tests/e2e/*` spec addresses this ticket's surface differently than before it.

## Testability contract

01-plan.md carries no § 6 selector table for this ticket (§ 2b: no new markup; the `Teams` row keeps
its existing span and class). No selector was added, renamed, or removed.

## Open questions

None.
