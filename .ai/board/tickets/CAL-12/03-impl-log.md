---
ticket: CAL-12
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-01T08:49:05Z
inputs_read:
  - .ai/board/tickets/CAL-12/01-plan.md
  - .ai/board/tickets/CAL-12/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
consulted:
  - with: tech-lead-design
    asked: "§ 4.4's <select> picker fails UIE-10 AC-10 at tests/e2e/uie-10-sidebar.spec.ts:444 (admin, /week, sidebar select count 0), which § 4.8 says must pass unedited. Add that spec to allowed_paths (13 files), or move the picker out of the sidebar?"
    answer: "Neither: keep the picker in the sidebar above the roster as a list of <Link>s. ViewedTeamValue.select(teamId) is replaced by hrefFor(teamId): string; options gain data-team-id and aria-current; the e2e spec adds a no-form-control assertion under AC-2. UIE-10 unedited, twelve files, size M."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-12 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/viewed-team.ts` | created | The pure resolution rules and the single own/other read switch, testable without a browser | § 4.1 |
| `src/hooks/useViewedTeam.tsx` | created | One resolution per shell, from the address, shared by sidebar, top bar and outlet | § 4.2 (amended) |
| `src/hooks/useRoster.ts` | modified | The roster must follow the viewed team through `teamReadsFor`, not always `listMembers()` | § 4.5 |
| `src/components/AppShell.tsx` | modified | Hosts the provider and the read-only notice above the outlet | § 4.3 |
| `src/components/Sidebar.tsx` | modified | The team picker (links) and a roster header naming the viewed team | § 4.4 (amended) |
| `src/components/TopBar.tsx` | modified | Period links dropped `?team=`; new-entry link must be absent while read-only | § 4.6 |
| `src/routes/WeekView.tsx` | modified | Reads through `teamReadsFor`; busy strip hidden while read-only; redirect keeps the team | § 4.7 |
| `src/routes/MonthView.tsx` | modified | Reads (incl. threshold) through `teamReadsFor`; drag, draft and busy hidden while read-only; redirect keeps the team | § 4.7 |
| `src/routes/YearView.tsx` | modified | Reads through `teamReadsFor`; redirect keeps the team | § 4.7 |
| `src/routes/YearOverview.tsx` | modified | Reads through `teamReadsFor`; month-card link and both redirects keep the team | § 4.7 |
| `tests/viewed-team.test.ts` | created | Unit half of the ACs, and the only place AC-12 and AC-13 can be proved | § 4.8 |
| `tests/e2e/cal-12-team-picker.spec.ts` | created | AC-1 to AC-11 through the interface on the mock seam | § 4.8 (amended) |
| `.ai/board/tickets/CAL-12/99-questions.md` | created | The consultation above, with `tech-lead-design`'s answer | — (board) |
| `.ai/board/tickets/CAL-12/ticket.yaml` | modified | `chat_budget.developer->tech-lead-design.used` 0 → 1 for that consultation | — (board) |
| `.ai/board/tickets/CAL-12/01-plan.md` | modified by `tech-lead-design` | The amendment that answer made (§ 2b, § 4.2, § 4.4, § 4.8, Changelog) | — (board) |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `TEAM_PARAM`, `ViewedTeam`, `ViewedTeamResolution` | `src/lib/viewed-team.ts:21`, `:24`, `:30` | |
| 4.1 `resolveViewedTeam` rules 1–7 | `src/lib/viewed-team.ts:46` | One `if` per rule, in the plan's order |
| 4.1 `isCalendarPath` | `src/lib/viewed-team.ts:70` | One regex over the eight shapes, trailing slash tolerated |
| 4.1 `pickableTeams`, `isReadOnly`, `withTeamParam` | `src/lib/viewed-team.ts:76`, `:82`, `:88` | |
| 4.1 `TeamReads`, `teamReadsFor` | `src/lib/viewed-team.ts:95`, `:109` | `other` never touches an own-team method; busy days `[]` |
| 4.2 `ViewedTeamValue`, `ViewedTeamProvider`, `useViewedTeam` | `src/hooks/useViewedTeam.tsx:22`, `:52`, `:153` | `hrefFor` per the amendment (`:133`); `select` removed |
| 4.2 `listTeams()` admin-only, re-read for an unknown id, throw → `"failed"` | `src/hooks/useViewedTeam.tsx:78` | See Deviations 2 for the "stale list" rule |
| 4.2 drop param with `{ replace: true }` | `src/hooks/useViewedTeam.tsx:100` | |
| 4.2 value memoised on the identity key | `src/hooks/useViewedTeam.tsx:117` | Keyed on `kind` + the team row from `loaded` |
| 4.3 provider wraps the shell; notice above outlet | `src/components/AppShell.tsx:108`, `:89`, `:95` | Notice is a local, non-exported component (it must render inside the provider) |
| 4.4 picker (links) | `src/components/Sidebar.tsx:330`, `:344` | `<nav>` / `<ul>` / `<Link>`, selected pill = `aria-current` |
| 4.4 roster `useRoster(viewed)`, team name, `data-team-id` | `src/components/Sidebar.tsx:243`, `:388` | |
| 4.5 `useRoster(viewed)` | `src/hooks/useRoster.ts:46`, `:58` | `resolving` → loading, `unavailable` → unavailable; reset to loading on change |
| 4.6 period links carry `team` | `src/components/TopBar.tsx:139`, `:168`, `:179`, `:211` | |
| 4.6 new-entry link absent while read-only | `src/components/TopBar.tsx:296` | |
| 4.7 reads via `teamReadsFor`, deps gain `viewed` | Week `:324`/`:373`, Month `:247`/`:306`, Year `:167`/`:211`, Overview `:156`/`:194` | |
| 4.7 redirects carry `team` | Week `:522`, Month `:456`, Year `:292`, Overview `:254`, `:546` | |
| 4.7 `year-month-card-link` carries `team` | `src/routes/YearOverview.tsx:510` | |
| 4.7 Week: busy strip hidden | `src/routes/WeekView.tsx:1047` | An empty `mt-auto` spacer keeps the count strip pinned |
| 4.7 Month: no drag, no draft, no busy | `src/routes/MonthView.tsx:235`, `:654`–`:655`, `:795`, `:899` | |
| 4.8 tests | `tests/viewed-team.test.ts`, `tests/e2e/cal-12-team-picker.spec.ts` | 17 unit, 12 e2e (11 ACs + seam guard) |

## Deviations from the design

1. **A stale-load guard was added to the four screens; the plan assumed one existed.** § 4.7 says
   "the existing `live` guard drops a stale answer". None of `WeekView`, `MonthView`, `YearView`,
   `YearOverview` had one; their `load()` set state unconditionally. Each now has a `loadSeq` ref
   and a `stale()` check after every await (e.g. `MonthView.tsx:247`–`:306`). This is what makes the
   plan's own AC-12 claim — A's rows never drawn under B's notice — true when a slow read for one team
   resolves after the team changed. No new export, no new field.
2. **The provider treats a loaded team list as stale for a new parameter until it is re-read.**
   § 4.2 says re-read "whenever the requested parameter changes to an id not in the loaded list" but
   does not say what to resolve to in between. Feeding the old list to `resolveViewedTeam` would hit
   rule 7 and drop a valid parameter before the re-read lands, so in that window `teams` is passed as
   `null` (rule 4, `resolving`). Purely ordering; rules 1–7 are unchanged.
3. **§ 4.4 and § 4.2 as amended, not as first written** — the `<select>`/`select()` became links and
   `hrefFor()`. Authorised by the consultation in the front-matter; the plan's Changelog records it.

Not a deviation, but worth a reviewer's eye: `/` is the week screen, so `isCalendarPath("/")` is true
and `/?team=<B>` views B. That is what AC-2's "(or `/`, which is the week screen)" says.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | Every count still comes from `absenceCountsFor` / `isOverloaded` with the same arguments, now fed by `teamReadsFor(...).roster()` (full roster, removed included) and `.entriesOverlapping()`. Nothing in `viewed-team.ts`, the hook or the sidebar counts. The removed-member filter in `useRoster` is display only and never reaches a count. Unit test AC-6 proves an admin's counts for B equal B's member's own counts. |
| `INV-05` | No code added here reads `tentative`; tentative entries of B are drawn and counted by the same unchanged screen code as A's. |
| `INV-07` | `teamReadsFor` returns B's reads only and never an own-team read for `other` (unit test AC-12, where every own-team method throws if called). The stale-load guard (Deviation 1) prevents a late A answer being set while B is viewed. In the datastore, CAL-11's definer functions scope by `member_team_id`. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 28 files, 471 tests |
| `pnpm exec playwright test` | 1 | **317 passed, 20 failed. All 20 fail identically on the clean tree** (stashed and re-run: same 20 test ids). They are in ADM-01, ADM-02, ADM-03, ADM-04, CAL-06, UIE-09 and UIE-10; the failures inspected wait on `home-week-link` / `home-holidays-link`, which are commented out in `Sidebar.tsx` (pre-existing). Root cause of each of the 20 was not individually traced. None is introduced by CAL-12; `tests/e2e/cal-12-team-picker.spec.ts` is 12/12 and UIE-10 AC-10 passes. |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-docs.mjs` | 0 | |
| `git status --porcelain` ⊆ `allowed_paths` + ticket folder | yes | 10 source/test paths changed or created, all in `allowed_paths`; the rest are under `.ai/board/tickets/CAL-12/` |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `shell-viewing-other-team` (`data-team-id`) | `src/components/AppShell.tsx:89` |
| `shell-back-to-own-team` | `src/components/AppShell.tsx:95` |
| `shell-team-picker`, `shell-team-picker-label` | `src/components/Sidebar.tsx:330` and the `<p>` beneath it |
| `shell-team-option` (`data-team-id`, `data-own`, `aria-current`) | `src/components/Sidebar.tsx:344` |
| `shell-roster-count[data-team-id]` | `src/components/Sidebar.tsx:388` |

## Open questions

- **The e2e suite is not green on `main`'s own code**, and `.ai/standards/testing-standards.md`'s
  2026-09-08 table still says "all pass". `/ship` requires the e2e command to exit 0, so this ticket
  cannot satisfy that item as the suite stands. Out of this ticket's scope to fix (the 20 tests and
  `Sidebar.tsx`'s commented-out nav are UIE-10/SOLO territory); recorded so the reviewer and `/ship`
  do not rediscover it.
- `ticket.yaml` `state` is left at `READY`: `/advance` (ADR-036) transcribes `next_state: REVIEW`
  from this front-matter.
