---
ticket: CAL-12
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-01T09:24:52Z
inputs_read:
  - .ai/board/tickets/CAL-12/01-plan.md
  - .ai/board/tickets/CAL-12/03-impl-log.md
  - .ai/board/tickets/CAL-12/99-questions.md
  - .ai/board/tickets/CAL-12/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
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

# CAL-12 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carry clean | PASS | `git diff --name-only origin/main...HEAD` minus `.ai/board/tickets/CAL-12/**` and `.ai/board/backlog.md` (ship-owned) is exactly the twelve paths of `ticket.yaml` `allowed_paths`. `node scripts/check-carry.mjs CAL-12` → `0 uncommitted path(s)` / `PASS — nothing stray`, exit 0. `tests/e2e/uie-10-sidebar.spec.ts` is not in the diff (`git diff --quiet` exit 0) |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint <the 12 changed .ts/.tsx>` → exit 0; repo-wide `pnpm exec eslint .` → exit 0, so no out-of-diff chore to note |
| R4 | Nothing outside the seam reaches the datastore | PASS | Every added read goes through `seam` from `@/lib/data`: `src/hooks/useViewedTeam.tsx:17`, `:78`; `src/hooks/useRoster.ts:58` (`teamReadsFor(seam, viewed)`); `src/lib/viewed-team.ts:17` imports the `DataSeam` **type** only. No added line in `src/**` imports `@/lib/data/*`, `./mock` or `supabase` (grep of the branch diff: no match) |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | Picker only for an admin, >1 team, calendar path: `src/lib/viewed-team.ts:76-79`, `src/hooks/useViewedTeam.tsx:124-128`, rendered iff `teams.length > 0` at `src/components/Sidebar.tsx:329-330`. Parameter ignored for non-admin: `src/lib/viewed-team.ts:53`. `listTeams()` called only for an admin: `src/hooks/useViewedTeam.tsx:56`, `:76` (`mayAdminister` is `role === "admin"`, `src/lib/roles.ts:24`). Create affordances absent while read-only: `src/components/TopBar.tsx:296`, `src/routes/MonthView.tsx:654-655`, `:899`; busy toggles absent: `src/routes/WeekView.tsx:1047`, `src/routes/MonthView.tsx:795`. Admin-panel routes never read the parameter: `src/hooks/useViewedTeam.tsx:61`. No seam write method touched (`src/lib/data/**` not in diff) |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

**Tests run by this review** (supporting, not gate items): `pnpm exec vitest run` → 28 files, 471 passed. `pnpm exec playwright test tests/e2e/cal-12-team-picker.spec.ts tests/e2e/uie-10-sidebar.spec.ts` → 21 passed, 3 failed; the CAL-12 spec's 11 tests all pass, and UIE-10 AC-10 (`tests/e2e/uie-10-sidebar.spec.ts:433`) passes unedited. The three failures (`uie-10-sidebar.spec.ts:178`, `:366`, `:468`, waiting on `home-week-link`) were reproduced identically on a detached `origin/main` worktree — pre-existing, not introduced here, and already recorded in `03-impl-log.md` § Open questions as a `/ship` concern.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `TEAM_PARAM` | `src/lib/viewed-team.ts:21` | yes |
| § 4.1 `ViewedTeam` (four kinds) | `src/lib/viewed-team.ts:24-28` | yes |
| § 4.1 `ViewedTeamResolution` | `src/lib/viewed-team.ts:30-34` | yes |
| § 4.1 `resolveViewedTeam`, rules 1–7 in order | `src/lib/viewed-team.ts:46-61` (one line per rule, `:53`–`:60`) | yes |
| § 4.1 `isCalendarPath`, eight shapes, trailing slash | `src/lib/viewed-team.ts:66`, `:70-72` | yes |
| § 4.1 `pickableTeams` (sort by name, then id) | `src/lib/viewed-team.ts:76-79` | yes |
| § 4.1 `isReadOnly` | `src/lib/viewed-team.ts:82-84` | yes |
| § 4.1 `withTeamParam` (`?`/`&`, encodeURIComponent) | `src/lib/viewed-team.ts:88-92` | yes |
| § 4.1 `TeamReads` | `src/lib/viewed-team.ts:95-100` | yes |
| § 4.1 `teamReadsFor` own → today's four calls; other → `*ForTeam`, busy `[]` | `src/lib/viewed-team.ts:109-129` | yes |
| § 4.2 `ViewedTeamValue` with `hrefFor` (amended; `select` absent) | `src/hooks/useViewedTeam.tsx:22-33` | yes |
| § 4.2 `ViewedTeamProvider`, `useViewedTeam` | `src/hooks/useViewedTeam.tsx:52`, `:153` | yes |
| § 4.2 `listTeams()` admin-only, re-read for an id not loaded, throw → `"failed"` | `src/hooks/useViewedTeam.tsx:69-89` | yes |
| § 4.2 drop param with `{ replace: true }` | `src/hooks/useViewedTeam.tsx:99-109` | yes |
| § 4.2 default context value | `src/hooks/useViewedTeam.tsx:39` | yes |
| § 4.2 value memoised on identity key | `src/hooks/useViewedTeam.tsx:115-122`, `:145-148` | yes |
| § 4.2 `hrefFor` semantics (delete for own, set otherwise, other params kept, off-calendar → pathname) | `src/hooks/useViewedTeam.tsx:133-143` | yes |
| § 4.3 provider wraps the shell | `src/components/AppShell.tsx:108` | yes; `AppShellProps`/`ShellContext` unchanged |
| § 4.3 notice above `<Outlet>`, `to={pathname}` back link | `src/components/AppShell.tsx:83-100`, `:133` | yes; ids `shell-viewing-other-team` `:89`, `shell-back-to-own-team` `:95` |
| § 4.4 picker as `<nav>`/`<p>`/`<ul>`/`<Link>` with `data-team-id`, `data-own`, `aria-current` | `src/components/Sidebar.tsx:329-362` | yes (amended markup) |
| § 4.4 roster `useRoster(viewed)`, team name, `shell-roster-count[data-team-id]` | `src/components/Sidebar.tsx:243`, `:386-391` | yes |
| § 4.5 `useRoster(viewed)` — resolving → loading, unavailable → unavailable, reset on change, removed filter kept | `src/hooks/useRoster.ts:46-81` | yes |
| § 4.6 every period link carries `team` | `src/components/TopBar.tsx:139`, `:168`, `:179`, `:211` | yes |
| § 4.6 `home-new-entry-link` iff `!isReadOnly` | `src/components/TopBar.tsx:296` | yes |
| § 4.7 reads via `teamReadsFor`, deps gain `viewed`, resolving/unavailable phases | Week `src/routes/WeekView.tsx:316-324`, `:373`; Month `src/routes/MonthView.tsx:241-247`, `:306`; Year `src/routes/YearView.tsx:159-167`, `:211`; Overview `src/routes/YearOverview.tsx:148-156`, `:194` | yes |
| § 4.7 holidays and `getCurrentMember` unchanged | e.g. `src/routes/MonthView.tsx:275` (`seam.listHolidays`) | yes |
| § 4.7 redirects carry `team` | `src/routes/WeekView.tsx:522`, `src/routes/MonthView.tsx:456`, `src/routes/YearView.tsx:292`, `src/routes/YearOverview.tsx:254`, `:546` | yes |
| § 4.7 `year-month-card-link` carries `team` | `src/routes/YearOverview.tsx:510` | yes |
| § 4.7 Month threshold from `reads.team()` | `src/routes/MonthView.tsx:272` | yes |
| § 4.7 Week busy strip hidden; Month no drag/draft/busy while read-only | `src/routes/WeekView.tsx:1047`; `src/routes/MonthView.tsx:654-655`, `:795`, `:899` | yes |
| § 4.8 unit tests | `tests/viewed-team.test.ts:40-185` — rules 1–7, pickableTeams, isCalendarPath/withTeamParam, isReadOnly, AC-6 `:135`, AC-12 stub `:156`, AC-13 `:179` | yes |
| § 4.8 e2e, incl. amended no-form-control assertion under AC-2 | `tests/e2e/cal-12-team-picker.spec.ts:84-99` | yes |

`03-impl-log.md` Deviation 1 (a `loadSeq` stale-answer guard the plan assumed existed) adds no export and no field; it is what makes § 4.7's AC-12 sentence true. Deviation 2 (a loaded list treated as stale for a new parameter until re-read, `src/hooks/useViewedTeam.tsx:69-73`, `:95`) changes only ordering; rules 1–7 at `src/lib/viewed-team.ts:53-60` are untouched. Neither departs from a contract item.

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | Counting still calls `absenceCountsFor` with the same arguments, now fed by `reads.roster()` — the **full** roster, removed members included (`teamReadsFor` returns `listMembers()` / `listMembersForTeam()` unfiltered). The removed-member filter lives only in `useRoster`, which feeds the sidebar display and never a count. No count is computed in `viewed-team.ts`, the hook or the sidebar | `src/routes/MonthView.tsx:328`, `:489`, `:613`; `src/lib/viewed-team.ts:116`, `:124`; `src/hooks/useRoster.ts:66-70` |
| INV-05 — tentative counts like non-tentative | No added line reads or filters on `tentative`; another team's entries go through the same unchanged drawing and counting code | `src/lib/viewed-team.ts:117`, `:125` (entries passed through untouched); `src/routes/MonthView.tsx:328` |
| INV-07 — counted only against the member's own team | An `other` `TeamReads` calls only the `*ForTeam` reads scoped to `team.id` and never an own-team read, so A's entries cannot be merged into B's view; the stale-load guard drops a late A answer after the team changed; the datastore scoping is CAL-11's definer functions | `src/lib/viewed-team.ts:121-128`; `src/routes/MonthView.tsx:240-241`, `:278`; unit proof `tests/viewed-team.test.ts:156` |

## Findings

None.

## Verdict

PASS. All eight checks pass; the ticket advances to DONE.
