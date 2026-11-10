---
ticket: UIE-02
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-07T14:42:19+07:00
cycle: 2   # REVIEW pass 2, against the tree REWORK cycle 3 left. Pass 1's report (gate: FAIL,
           # produced_at 13:45:35) is superseded by this file; its finding 1 is re-checked below
           # and its finding 2 was closed by `tech-lead-design` at 14:20, not by this session.
inputs_read:
  - .ai/board/tickets/UIE-02/01-plan.md (as amended at PLAN rework 1 and at 14:20)
  - .ai/board/tickets/UIE-02/03-impl-log.md (cycles 2 and 3)
  - .ai/board/tickets/UIE-02/ticket.yaml
  - .ai/board/tickets/UIE-02/99-questions.md
  - git diff / git status (working tree, feat/UIE-02)
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - src/App.tsx
  - src/components/{AppShell,Sidebar,TopBar,AuthCard}.tsx
  - src/hooks/useRoster.ts
  - src/lib/period.ts
  - src/routes/{WeekView,MonthView,YearView}.tsx
  - src/index.css
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/tea-05-sign-in.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-02 — review report

Fresh session, files only, no message channel. I did not talk to the Developer and there is no
`consulted` entry to declare. Every command below was run in **this** session, on **this** tree.

*`next_state` is `DONE` and not the template's `QA`. ADR-022 removed the QA stage;
`.ai/01-operating-model.md:36` reads `IN_PROGRESS -> REVIEW -> DONE`, and `/ship` is what performs
the transition. `.ai/templates/review-report.md:30` is stale against that and is a steward matter,
not this ticket's.*

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | **PASS** | Seventeen paths in the tree — tracked: `.ai/board/tickets/UIE-02/ticket.yaml`, `src/App.tsx`, `src/index.css`, `src/routes/{Home.tsx (D),MonthView.tsx,WeekView.tsx,YearView.tsx}`, `tests/e2e/cal-03-admin-edit-entry.spec.ts`; untracked: `.ai/board/tickets/UIE-02/{01-plan.md,03-impl-log.md,04-review.md,99-questions.md}`, `src/components/{AppShell,Sidebar,TopBar}.tsx`, `src/hooks/useRoster.ts`, `src/lib/period.ts`. Each matches a line in `ticket.yaml:66-87` — the twelve source paths, the one spec file at `:86`, and the ticket-folder glob at `:67`. Nothing outside. `tests/` holds exactly one edit and it is the one PLAN admitted. No file under `.ai/registry/**` is touched, so RULE-01 is not engaged |
| R2 | typecheck exit 0 | **PASS** | `pnpm exec tsc --noEmit` → **exit 0**, run in this session on this tree |
| R3 | lint exit 0 | **PASS** | `pnpm exec eslint .` → **exit 0**, run in this session. AC-18 holds by the same run: the diacritic rule at `eslint.config.js:83-92` fires on no file in scope, `ui-language.json` is not in the diff, and the one accented string is composed from its code point at `src/components/Sidebar.tsx:47` |
| R4 | Nothing outside the seam reaches the datastore directly (RULE-02) | **PASS** | The whole ticket makes **one** seam call and it goes through the one door: `src/hooks/useRoster.ts:11` imports `@/lib/data` and `:52` calls `seam.listMembers()`. A `grep "seam\.[a-zA-Z]*("` over all twelve source paths returns that line, the three period screens' pre-existing calls (`src/routes/WeekView.tsx:160,180-182`, `MonthView.tsx:156,171-174,257`, `YearView.tsx:142,162-164` — none added, none removed by this ticket: `git diff -w` on those three files is import swaps and deleted now-shared definitions only), and comments. No file in scope imports `@/lib/data/mock`, `@/lib/data/supabase` or `@supabase/*`; `src/lib/period.ts` imports nothing at all — `grep -c "^import" src/lib/period.ts` returns **0**, and the file's first statement is the export at `src/lib/period.ts:42` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | **PASS** | Twenty rows below, each cited. § 4.7's gutter — pass 1's blocking finding — is fixed at `src/App.tsx:122-140` and **re-measured in this session**: 32px a side at both 360px and 320px, on both auth routes |
| R6 | Permission gating matches plan section 3 | **PASS** | The four admin-only affordances sit under one `member.role === "admin"` condition — `src/components/Sidebar.tsx:127`, `:218` — the condition `Home.tsx` used, moved rather than rewritten. Proven live, not only read: `tests/e2e/tea-05-sign-in.spec.ts:143-158` signs in as each role and asserts `home-allow-list-link` visible for the admin and `toHaveCount(0)` for the member; it passes. The five membership guards are untouched — every removed non-comment line in `git diff -w -- src/App.tsx` is the old `/` route, the `Home` import, the `app-root` class list and the spinner's margin; not one `Navigate` guard or route element is among them. The six deliberately unguarded routes still refuse rather than redirect, because the layout's non-member arm is `<BareLayout />` and not a `Navigate` (`src/App.tsx:165-173`). No new capability: the ticket's only read is `seam.listMembers()` (`src/hooks/useRoster.ts:52`), already made by `src/routes/MemberList.tsx:54` under a policy admitting both roles |
| R7 | No invariant violated (RULE-07) | **PASS** | Per-ID below. `invariants_touched: []` is reached structurally: one seam call in the entire ticket and it is a read |
| R8 | No dependency added without an ADR | **PASS** | `git status --porcelain package.json pnpm-lock.yaml` returns **nothing** — neither manifest nor lockfile is in the tree's changes. `src/lib/period.ts` adds no import at all: the day arithmetic at `:84-96` and the leap rule at `:124-130` are written in the standard library rather than pulled from a package, which is Deviation 2 in `03-impl-log.md` and the direct consequence of § 5 forbidding this module a data import |

*The template heads the invariant section `R8 detail`. `.ai/01-operating-model.md:133-134` numbers the
invariant check **R7** and the dependency check R8, and both the failure-routing table at `:147` and
`.claude/commands/review.md` say R7. The numbering here follows the operating model; the template and
`.ai/registry/rules.md` are stale against it and are a steward matter, not this ticket's.*

## R5 detail

One row per item in `01-plan.md` § 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `AppShell`, `AppShellProps` | `src/components/AppShell.tsx:21-25`, `:27` | Yes. `member` / `signOut` as contracted; renders `Sidebar` at `:34`, `TopBar` at `:41`, `Outlet` at `:43`. The return type is inferred rather than annotated `JSX.Element` — the same type, and `tsc` agrees |
| 4.2 `Sidebar`, `SidebarProps` | `src/components/Sidebar.tsx:25-28`, `:86` | Yes |
| 4.3 `TopBar` | `src/components/TopBar.tsx:49-51` | Yes. Takes no props and reads `useLocation().pathname` at `:50`, not `useParams()` — the trap § 4.3 and § 4.5 both name |
| 4.4 `RosterState`, `useRoster` | `src/hooks/useRoster.ts:24-27`, `:42` | Yes. Three phases; exactly one call at `:52`; `removedAt` filtered above the seam at `:56`; `unavailable` is the throw at `:58-59`, and `[]` stays a normal `ready` answer |
| 4.5 `MONTH_NAMES` | `src/lib/period.ts:42-55` | Yes, months in full, January first. `MONTH_ABBR` at `:65` is declared Deviation 1 and is measured correct — `git diff src/routes/YearView.tsx` shows that screen's twelve were the three-letter forms, so one export could not have carried both |
| 4.5 `mondayIndex` | `src/lib/period.ts:111-112` | Yes, character-identical to the two copies it replaces (`git diff -w -- src/routes/WeekView.tsx` and `MonthView.tsx` each delete the same one-line definition) |
| 4.5 `isRealDay`, `isRealMonth`, `isRealYear` | `src/lib/period.ts:140`, `:150`, `:154` | Yes. `MONTH_PATTERN` (`:119`) and `YEAR_PATTERN` (`:120`) are the same regexes the two screens deleted, so `isRealMonth` / `isRealYear` accept exactly what `MONTH_PATTERN.test` / `YEAR_PATTERN.test` accepted. Deviation 2 stands: the `addDays` round trip becomes `daysInMonth` at `:124-130`, leap rule in full; `2026-02-30` still rejected at `:142-145` |
| 4.5 `shiftMonth`, `shiftYear`, `monthLabel` | `src/lib/period.ts:161`, `:169`, `:173` | Yes, moved verbatim — each body matches the deleted one line for line |
| 4.5 `weekLabel` | `src/lib/period.ts:191` | Yes, from the Monday. Deviation 3 (both years printed across a 31 December, `:199-203`) is a superset of the contracted form, and the dash is U+2013, outside the diacritic rule's range |
| 4.5 `currentDay` | `src/lib/period.ts:226-229` | Yes, and it is the module's only clock. Moved from `WeekView.tsx`, whose `today()` is deleted in the same diff |
| 4.5 `PeriodKind`, `PeriodNav` | `src/lib/period.ts:231`, `:233-247` | Yes, all seven fields, named as contracted |
| 4.5 `periodNavFor` | `src/lib/period.ts:277`, `/` first at `:285-298` | Yes. `/` is a period route, `kind: "week"`, anchored at `currentDay()`; `/week/:day` at `:307`, `/month/:month` at `:322`, `/year/:year` at `:336`; every other address returns `null` at `:301` or `:352`, so `/allow-list`, `/entries/new` and `/threshold` draw no cluster (AC-15) and `/week/banana` fails `isRealDay` at `:308` (AC-16). **The stepping is from the Monday at `:287`, `:309` and `:313-314`, which is what § 4.5 now fixes** — see the note under Findings |
| 4.5 the switcher targets keep the date | `src/lib/period.ts:295-296`, `:316-318`, `:330-332`, `:346-348` | Yes, and each matches the screen's own cross-view link: from a week the month is the one containing the **day in the URL** (`WeekView.tsx:294`); from a month `weekTo` is `/week/<month>-01`; from a year `monthTo` is January |
| 4.6 the layout route | `src/App.tsx:165-173` | Yes — a `<Route element={…}>` with a conditional element and children, not a wrapper around `<Routes>` |
| 4.6 `BareLayout` | `src/App.tsx:48-54` | Yes, `<div className="p-8"><Outlet /></div>`, exactly as contracted |
| 4.6 the index route | `src/App.tsx:197-208` | Yes. `<Route index>`, the three-way element, `<WeekView landing />` for a member at `:201`, `NotOnATeam` at `:203`, `<Navigate to="/signin" replace />` at `:205`. No redirect on the member arm and no `replace` trap |
| 4.6 `/signin` and `/signup` outside the shell layout route | `src/App.tsx:125`, `:130-139` | Yes. They are children of a `BareLayout` parent (`:122`) and **not** of the shell layout route at `:165`; no membership condition is evaluated for either, and neither gets a sidebar or a top bar |
| 4.7 `app-root` and `seam-banner` keep names and positions | `src/App.tsx:82`, `:88-97` | Yes. `app-root` still wraps the router's output and gives up only `p-8`, becoming `flex min-h-screen flex-col`; `seam-banner` is still its first child and still not dismissible. `tests/e2e/smoke.spec.ts:7` passes unedited |
| 4.7 the `p-8` lands where the auth screens' gutter is | `src/App.tsx:122-140` | **Yes — pass 1's blocking finding is fixed.** Re-measured in this session, not taken from the log: `pnpm exec vite build && pnpm exec vite preview`, Chromium, `auth-card`'s bounding box against the viewport — 360px `/signin` **32 / 32**, 360px `/signup` **32 / 32**, 320px `/signin` **32 / 32**, 320px `/signup` **32 / 32**, no horizontal scroll on any of the four. 32px is what `app-root`'s `p-8` gave before this ticket, so UIE-01 AC-16 has its gutter back at the value it shipped against, and § 4.6 is not weakened — see the R5 note below |
| 4.8 the selector allocation | 27 ids. `shell-*` at `src/components/Sidebar.tsx:135,138,150,158,167,177,260` and `src/components/TopBar.tsx:64,70,76,87,100,108,115,126`; the eleven relocated `home-*` at `src/components/Sidebar.tsx:202,205,209,221,228,235,242,277,280,286,293` and the twelfth at `src/components/TopBar.tsx:169` | Yes. Counted rather than asserted: each of the 27 has **exactly one** definition site across `src/`, `src/routes/Home.tsx` is deleted so no `home-*` id has a second copy, and no screen id (`week-prev`, `month-anchor`, `year-month` and siblings) is reused by the shell — so nothing doubles under Playwright strict mode. `pnpm exec playwright test --workers=1` → **165 passed, exit 0**, run in this session, level with the pre-ticket baseline `03-impl-log.md` records |
| 4.9 the layout | `src/components/Sidebar.tsx:134-136` (216px, `bg-card`, `shrink-0`, no border), `src/components/TopBar.tsx:86-88` (70px, on `--color-bg`, no card), `src/components/AppShell.tsx:33`, `:40`, `:42`; the three tokens at `src/index.css:145-147` | Yes. `min-w-0` on the content pane (`AppShell.tsx:40`) is what keeps a wide grid's overflow inside the pane (AC-21); the focus treatment is UIE-01's on every interactive element (`Sidebar.tsx:57`, `:298`, `TopBar.tsx:31`, `:36`, `:42`, `:171`); the active segment carries fill, weight **and** `aria-current="page"` (`TopBar.tsx:148`), never colour alone; the legend is exactly three rows (`Sidebar.tsx:67-71`) |
| 4.10 `WeekViewProps.landing` | `src/routes/WeekView.tsx:109-123`, `:125`, `:137-138`, `:231` | Yes. Optional, defaulting to false; three lines inside the component; `landing` memoised on mount at `:137`; `weekStart` derives from `anchorDay` at `:143-145`; the `day as string` assertion is deleted. `/week` and `/week/:day` are unchanged and `tests/e2e/cal-05-week-view.spec.ts` passes unedited |

**On § 4.6 and § 4.7 together, because the fix touches both.** § 4.6 requires `/signin` and `/signup`
to stay outside the layout route, and they do: `src/App.tsx:122`'s `BareLayout` parent evaluates no
membership condition, has no `AppShell` arm, and is not the route at `:165`. What the two auth routes
gain is the padding and nothing else. `ticket.yaml` § 3's requirement that the auth screens carry no
chrome is intact — the measurement above shows the card in the same 32px gutter it had before this
ticket, with no sidebar and no top bar on either route.

## R7 detail — invariants

`invariants_touched: []`, so every ID in the ledger is reasoned through individually rather than
dismissed as a group. **Nothing in the twelve source paths writes anything**, which is the fact each
row below rests on: `grep "seam\.[a-zA-Z]*("` over all of them returns one call in new code —
`seam.listMembers()` — and it is a read.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — two entries of one member may not cover the same portion of a date | No entry is created, edited, or read for conflict anywhere in the ticket. `src/lib/period.ts` is string arithmetic over `yyyy-MM-dd` and cannot reach an entry — it imports nothing | `src/hooks/useRoster.ts:52` is the only `seam.*` call in new code; `grep -c "^import" src/lib/period.ts` → 0 |
| INV-02 — an approved entry whose substance changes returns to `pending` | No entry is written and no entry field is constructed. `src/routes/EditEntry.tsx` and `NewEntry.tsx` are not in the diff | `git status --porcelain` lists neither; `src/lib/domain/types.ts` is untouched |
| INV-03 — a rejected entry carries a non-empty reason | Nothing in scope reaches a rejection path; the decision and bulk-rejection components are not in the diff | `git status --porcelain` lists neither `src/components/EntryDecision.tsx` nor `BulkRejection.tsx` |
| INV-04 — the absence count, and no second definition of it | **The one place this ticket could have gone wrong quietly, and it did not.** `useRoster` filters `removedAt !== null` **for display, above the seam**, so the seam still returns removed members carrying `removedAt` (ADR-013) and every counting function still gets the roster INV-04's *"still on the team on that date"* clause needs. The sidebar's count is a display count: it is rendered and never returned, and nothing divides by it | Filter at `src/hooks/useRoster.ts:56`; the count that consumes it at `src/components/Sidebar.tsx:167-172`; `src/lib/data/absence.ts` is not in the diff, and `src/lib/period.ts` does not import it (`:86-88` writes the same conversion rather than importing) |
| INV-05 — a tentative entry counts as a non-tentative one does | No counting code in scope. The legend deliberately carries no overload row, so no threshold and no count is read: `seam.getTeam()` is called nowhere in the shell | `src/components/Sidebar.tsx:67-71` — three rows, no fourth; `src/components/Sidebar.tsx:63-64` records the omission and its reason |
| INV-06 — one portion per entry, applied to every date | No entry shape is constructed or altered anywhere in the twelve paths | No `Entry` type is imported in any of them (`grep "Entry" src/components/*.tsx src/hooks/useRoster.ts src/lib/period.ts` returns nothing outside route-path strings); `src/lib/domain/types.ts` is not in the diff |
| INV-07 — every entry belongs to one member, counted against that member's team | Scoping stays inside `member_select_team`, in the policy body, below the seam. The shell adds no filter of its own and passes no team argument | `src/hooks/useRoster.ts:52` — `seam.listMembers()` with no argument, exactly as `src/routes/MemberList.tsx:54` calls it |

An invariant held only by a UI affordance is not held. None of the seven is held that way here: none
is engaged, because nothing in this ticket writes.

## Findings

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | **None gating.** | — | — |
| 1 | R5 (recorded, not a failure) | One comment went stale inside this ticket's own rework. `src/components/Sidebar.tsx:115` justifies signing out to `/signin` with *"`/` now sends a member to `/week` (AC-5)"* — which is what AC-5 required at cycle 1 and is the opposite of what it requires now: after PLAN rework 1 `/` **is** the current week and moves nobody (`src/App.tsx:197-208`). **The code is right and unaffected** — navigating to `/signin` on a successful sign-out is still correct, and for a reason the same sentence gives second: the membership has not necessarily re-resolved when the line runs. Only the first half of the justification is stale. Not a contract item, not an AC, and no behaviour turns on it | nobody — recorded for the next reader | No |

**Pass 1's two findings, and where each stands.**

- **Finding 1 (R5, gating) — fixed and re-measured here.** The auth-screen gutter is 32px a side at
  360px and at 320px on both routes, measured in this session against `vite build && vite preview`
  rather than read from `03-impl-log.md`. The mechanism is the `BareLayout` parent at
  `src/App.tsx:122-140`, and it is the shape pass 1 named.
- **Finding 2 (R5, recorded) — closed upstream, not by this session and not by the Developer.**
  `tech-lead-design` amended AC-12 and § 4.5 at `2026-09-07T14:20:00+07:00`
  (`01-plan.md:1062-1074`), taking option A from `99-questions.md`: the Monday normalisation is the
  contract, because it is what CAL-05 shipped at `WeekView.tsx:287,293` and what
  `tests/e2e/cal-05-week-view.spec.ts:271-289` already asserts. AC-12 now names
  `/week/2026-10-12`, `/week/2026-10-05`, `/week/2026-09-28` (`01-plan.md:255-258`), which is what
  `src/lib/period.ts:313-314` produces. **No code changed and none needed to** — the disagreement
  was between the artifact and the code, and the artifact was the wrong one. `03-impl-log.md`'s
  front-matter still records the answer as *pending*, because it was written at 14:00 and the
  amendment landed at 14:20; that is a stale front-matter line in a superseded log, not an open
  question.

**Nothing else was found.** The 165-test acceptance suite and the 186 unit tests are green in this
session, the twelve relocated `home-*` ids resolve exactly once each with `src/routes/Home.tsx`
deleted, the six unguarded routes still refuse rather than redirect, the five membership guards are
untouched, and the roster read is filtered above the seam where INV-04's denominator needs it.

## Verdict

**`PASS`.** R1 through R8 all pass, each with a `file:line` or a command run in this session.

The verdict stops here. `ticket.yaml` is the `orchestrator`'s to move, and this artifact's
front-matter is the record it reads.
