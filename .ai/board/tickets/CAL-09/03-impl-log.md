---
ticket: CAL-09
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-08T16:45:33+0700
inputs_read:
  - .ai/board/tickets/CAL-09/01-plan.md
  - .ai/board/tickets/CAL-09/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/absence.ts
  - src/lib/fixtures.ts
  - tests/row-limits.test.ts
  - tests/pending-entries.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-09 — implementation log

**The plan is the merged story and design (ADR-019), so its contract is section 4 and not
"section 1".** The template's wording predates the merge; the table below cites `01-plan.md` § 4.1 to
§ 4.5, which is what section 1 used to be.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| [src/lib/domain/types.ts](../../../../src/lib/domain/types.ts) | modified | The two constants the assembly reads, plus the paragraph on `MONTH_ENTRY_LIMIT` recording that CAL-09 retired its only reader and why it was not deleted | § 4.1 |
| [src/lib/data/index.ts](../../../../src/lib/data/index.ts) | modified | One paragraph of the seam's doc comment: the read now throws on anything it cannot prove complete rather than on a possibly-truncated answer. No declaration changed | § 4.2 |
| [src/lib/data/supabase.ts](../../../../src/lib/data/supabase.ts) | modified | The assembly, and the import list loses `MONTH_ENTRY_LIMIT` and gains the two new constants | § 4.3 |
| [src/lib/data/mock.ts](../../../../src/lib/data/mock.ts) | modified | The same walk over the same order, so the two implementations tell one story; same import change | § 4.4 |
| [tests/row-limits.test.ts](../../../../tests/row-limits.test.ts) | modified | AC-13, in the file that already owns arithmetic about the row constants. `CEILINGS` untouched | § 4.1, AC-13 |
| [tests/team-entries-paging.test.ts](../../../../tests/team-entries-paging.test.ts) | created | AC-1 to AC-4, AC-9 and AC-10 against the mock seam directly, and the header declares what is asserted nowhere | § 7 |

Nothing else in the working tree changed. `git status --porcelain` outside
`.ai/board/tickets/CAL-09/` lists exactly those six paths, and every one is in `allowed_paths`.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `TEAM_ENTRY_PAGE_SIZE` | [types.ts:380](../../../../src/lib/domain/types.ts#L380) | 500, verbatim from the plan, with the plan's docblock |
| § 4.1 `TEAM_ENTRY_MAX_PAGES` | [types.ts:394](../../../../src/lib/domain/types.ts#L394) | 8, verbatim |
| § 4.1 `MONTH_ENTRY_LIMIT` docblock | [types.ts:353-364](../../../../src/lib/domain/types.ts#L353-L364) | Value and name unchanged at 1000. The paragraph names the six files outside `allowed_paths` that still cite it and says the removal is a chore |
| § 4.2 seam signature | [index.ts:512](../../../../src/lib/data/index.ts#L512) | `listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]>` — unchanged character for character. AC-14 |
| § 4.2 doc comment | [index.ts:506-510](../../../../src/lib/data/index.ts#L506-L510) | The plan's replacement paragraph, verbatim |
| § 4.3 the real assembly | [supabase.ts:1174-1244](../../../../src/lib/data/supabase.ts#L1174-L1244) | AC-7 at :1200, AC-6 at :1218, the one refusal site at :1236. The offset is `assembled.length` |
| § 4.4 the mock assembly | [mock.ts:1229-1279](../../../../src/lib/data/mock.ts#L1229-L1279) | Same walk, same order. The team filter is applied to the whole array before the first window (INV-07) |
| § 4.5 nothing added to the surface | — | No new seam function, no new type, no new field, no parameter naming a page. `tests/seam-parity.test.ts` is unedited and passes |
| § 7 AC-13 | [row-limits.test.ts:79-102](../../../../tests/row-limits.test.ts#L79-L102) | Three assertions, one per clause |
| § 7 the new test file | [team-entries-paging.test.ts](../../../../tests/team-entries-paging.test.ts) | Six tests: AC-1, AC-2, AC-3, AC-4, AC-9, AC-10 |

## Deviations from the design

`none`.

Two things worth a reviewer's attention that are *not* deviations, because the plan authorised each
in words:

- **`MONTH_ENTRY_LIMIT` was removed from the import list of both seam files.** The plan says the
  constant keeps its name and value and is not deleted, which it does — but it was imported into
  `supabase.ts` and `mock.ts` solely for the ceiling this ticket removes, and leaving the import
  behind fails lint. The constant, its export and its docblock are all intact in `types.ts`; only the
  two now-unused imports are gone.
- **The assembly bodies are the plan's code, transcribed.** Where the plan printed a body it was
  copied rather than re-derived, comments included. The one comment added beyond it is on the mock's
  final comparison, recording that the bound *is* reachable there while the other two refusals are
  not — which the plan states in prose at § 4.4 and which belongs beside the code.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The absence count is still computed in exactly one place. The seam returns `Entry[]` and no count, so there is nowhere for a partial total to live: no `length`, `reduce` or `+` appears anywhere in either assembly except the offset arithmetic and the completeness comparison, neither of which is an absence count. The rows are proved complete *before* any caller sums them — `assembled.length !== matching` throws rather than returning a short array — so `absenceCountsFor` is handed the whole set or nothing at all. AC-10 asserts the outcome: the total over the range equals the number of matching rows, which a first-page-only read would understate by exactly one page. |
| `INV-07` | Every request in the real walk is the same query with a different window, so `entry_select_team` filters each identically and no offset, page index or count can widen the set — `count: "exact"` counts policy-visible rows only. The mock applies `sameTeam` to the whole array *before* the first window is taken, which is the same property written the other way round; a window taken first would page over another team's rows and then drop them, which reads as a short page rather than as a scope error, and the comment at `mock.ts:1234-1237` says so. AC-9 asserts that the other team's April entry is absent from a paged read. |

`INV-01`, `INV-02`, `INV-03`, `INV-05` and `INV-06` are untouched and were checked rather than
assumed: this ticket writes no entry, edits none, constructs no entry value, and adds and removes no
`status` or `tentative` predicate. The one place the tests create entries, they create them through
`seam.createEntry`, which enforces INV-01 itself — and the fixture is built as consecutive single
days for that reason.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck |
| `pnpm exec eslint .` | 0 | lint. RULE-02 unaffected — every line added is inside `src/lib/data/` or is a constant in `src/lib/domain/types.ts` |
| `pnpm exec vitest run` | 0 | 12 files, **202 tests, 0 failures**. Nine of them are this ticket's — three AC-13 cases in `row-limits.test.ts` and six in the new file — and no existing test was edited or removed, `CEILINGS` and `tests/seam-parity.test.ts` included |
| `git diff --name-only` subset of `allowed_paths` | yes | Checked against the working tree by hand — see below |
| `node scripts/check-allowed-paths.mjs` | 0 | **Reports `0 changed file(s)` and that is expected, not a pass to lean on.** It diffs `origin/main...HEAD` (`scripts/check-allowed-paths.mjs:123`), and a ticket is uncommitted until `/ship` (ADR-006), so at IN_PROGRESS it has nothing to look at. It becomes meaningful on the pull request. The working-tree check was done separately and is the one that counts here |

End-to-end was **not run**. It is pinned to the mock by `playwright.config.ts:49-51` and the suite's
six known failures are MD-021's harness defect, not this ticket's; AC-11 and AC-12 are its criteria
and neither is claimed here.

## Testability contract

`none`. The plan adds no selector and changes no screen — § 2b records that the visual decision is
the absence of one, and § 5 that the four consuming surfaces are unchanged. There is no
`data-testid` owed by this ticket.

## Open questions

**One, and it is a reviewer's call rather than a blocker: the mock's `TEAM_ENTRY_MAX_PAGES` loop can
never exhaust in any test that exists.** The plan says so at § 4.4 and the new test file's header
declares it, so nothing here is hidden — but it means the bound is carried by the arithmetic in
`tests/row-limits.test.ts` and by reading the code, and a future change that broke the loop's exit
conditions would be caught by neither. The honest fix is a 4001-row fixture, which the plan weighed
and rejected. Recorded so R6 does not have to rediscover it.

**Noted in passing, and outside this ticket: `ticket.yaml` arrives at IN_PROGRESS with
`state: BACKLOG`, `branch: ""` and `gates.plan.passed: false`.** `/plan` writes only
`size_estimate`, `size`, `invariants_touched` and `allowed_paths` (`.claude/commands/plan.md:114`),
and the orchestrator grades the Definition of Ready and moves the ticket to `READY` — that never ran.
This log does not fix it: the developer's only state write is the one `/implement` names, `REVIEW`,
and back-dating a gate nobody graded would be worse than leaving the gap visible. `/ship` requires
`gates.plan`, so it has to be settled before then.
