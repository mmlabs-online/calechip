---
ticket: MIR-15-d
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T07:57:00Z
inputs_read: [ .ai/board/tickets/MIR-15-d/01-plan.md, .ai/board/tickets/MIR-15-d/03-impl-log.md, .ai/board/tickets/MIR-15-d/ticket.yaml, .ai/registry/invariants.md, supabase/migrations/20261105180000_mir15_org_public_team_bound.sql, "git diff origin/main...HEAD" ]
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
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-15-d, 15 changed file(s)` … `allowed-paths: PASS` (the 11 non-board paths are exactly `ticket.yaml` `allowed_paths`; `.ai/board/backlog.md` is ship-owned). `node scripts/check-carry.mjs MIR-15-d` → `0 uncommitted path(s)`, `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output, run by the reviewer |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output, repo-wide, run by the reviewer. Also `pnpm test`: 54 files, 1065 tests passed |
| R4 | Nothing bypasses the data-access seam (RULE-02) | PASS | The only source file changed is `src/lib/data/mock.ts` (hunks at `:818-821`, `:867-870`, `:3557-3558`, `:3629-3633`), which is inside the seam `src/lib/data/`; no import added. Seam rule enforced at `eslint.config.js:64` and lint exits 0 |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | Read: `src/lib/data/mock.ts:816` (admin), `:821` (public ∧ own team), `:826` (participant keeps reading, AC-9). Join: `mock.ts:866-872` — no admin disjunct, no participant disjunct, public ∧ own team at `:870`. `event_created`: `mock.ts:3633`, actor excluded by `notify` unchanged. Directory: `mock.ts:3559-` `admitted` unchanged, reaching through narrowed `mayReadEvent`. Each matches the shared-org branch of `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:57-59`, `:76-78`, `:95-97`, `:124-125`. Denials asserted: `tests/events.test.ts:226`, `:240`; `tests/notifications.test.ts:177`; `tests/member-directory-scope.test.ts:129`, `:139`; `tests/guest-link.test.ts:450` |
| R7 | No invariant violated | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --stat origin/main...HEAD` lists no `package.json` or `pnpm-lock.yaml`; the only `src/` change is `src/lib/data/mock.ts` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 (1) `mayReadEvent` public disjunct → `scope === "public" && teamId === mine`, with comment | `src/lib/data/mock.ts:818-821` | Yes — signature `(event, uid) => boolean` unchanged, `mock.ts:812` |
| 4.1 (2) `isEventAudience` same replacement | `src/lib/data/mock.ts:867-870` | Yes — unchanged signature, `mine` from `mock.ts:863` |
| 4.1 (3) `createEvent` notify filter → `memberTeamId(id) === row.teamId`, comment rewritten | `src/lib/data/mock.ts:3629-3633` | Yes |
| 4.1 (4) comment beside `admitted`, no code change in `listMemberDirectory` | `src/lib/data/mock.ts:3557-3558` | Yes |
| 4.1 "no other line of mock.ts changes" | `git diff origin/main...HEAD -- src/` shows four hunks only; `emailInvitation` unchanged, still reads `mayReadEvent` at `mock.ts:1239` | Yes |
| 4.2 `tests/events.test.ts` :224-229, :305, :448-450 | `tests/events.test.ts:226`, `:344`, `:489`; plus new block for AC-3/AC-8/AC-9 `:240` | Yes |
| 4.2 `tests/member-directory-scope.test.ts` :127-135, :137-150, :170-179, :219-245 | `tests/member-directory-scope.test.ts:129`, AC-6 block `:139`, (d) on named `:155`, actor on named `:192`, roster `:267` | Yes |
| 4.2 `tests/event-attendance.test.ts` :194, :257-261, :453-459 | `tests/event-attendance.test.ts:194`, `:257-263`, `:453-459` (named event, cross-team decider kept) | Yes |
| 4.2 `tests/notifications.test.ts` :176-177, :222-226, :289-291, :318 | `tests/notifications.test.ts:177` (AC-1), and own-team joiners in the AC-4, AC-6, AC-7 blocks that follow it | Yes |
| 4.2 `tests/event-email.test.ts` :186, :216-224, :250 | `tests/event-email.test.ts:184-189`, `:220-228`, `:254-255` | Yes |
| 4.2 `tests/event-invitation.test.ts` :393-400 (AC-10 both halves) | `tests/event-invitation.test.ts:398` | Yes |
| 4.2 `tests/guest-link.test.ts` :293-312, :446-447 | `tests/guest-link.test.ts:303` (AC-10 retitled), `:450` | Yes |
| 4.2 `tests/guest-registration.test.ts` :445-458, :478-481 | `tests/guest-registration.test.ts:445-461`, `:480-485` | Yes |
| 4.2 `tests/event-layer.test.ts` :271-272 | `tests/event-layer.test.ts:272-274` | Yes |
| 4.2 `tests/e2e/evt-02-attendance.spec.ts` :153-158, :173-191 (AC-12) | `tests/e2e/evt-02-attendance.spec.ts:166` (ADMIN reader above it, then OTHER_TEAM's Events list lacks the row), and ADMIN as second requester in the AC-7/AC-16/AC-22 test that follows | Yes |
| 4.2 "no block removed, no skip/todo" | Every changed `it(` in the diff is retitled or edited in place; no `it.skip`/`todo` in the diff | Yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 (one definition of the absence count, `.ai/registry/invariants.md:36`) | The count is defined once in `src/lib/data/absence.ts:197` (`absenceCountsFor`), which the diff does not touch; its membership denominator, `listMembers`, is at `src/lib/data/mock.ts:1859` and lies outside all four changed hunks (`:818-821`, `:867-870`, `:3557-3558`, `:3629-3633`). The edits read and write only events, attendance eligibility and notifications — no entry, portion or membership row. A second definition is not introduced. The roster staying fixed while the directory widens is asserted at `tests/member-directory-scope.test.ts:267` | `src/lib/data/absence.ts:197`, `src/lib/data/mock.ts:1859`, `tests/member-directory-scope.test.ts:267` |

## Findings

None.

## Verdict

PASS. MIR-15-d advances to DONE.
