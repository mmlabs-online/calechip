---
ticket: UIE-09
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-09T14:46:31+0700
inputs_read:
  - .ai/board/tickets/UIE-09/01-plan.md
  - .ai/board/tickets/UIE-09/03-impl-log.md
  - .ai/board/tickets/UIE-09/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - .ai/board/tickets/CAL-10/04-review.md
  - src/App.tsx
  - src/components/AppShell.tsx
  - src/components/TopBar.tsx
  - src/components/Sidebar.tsx
  - src/routes/AdminHub.tsx
  - src/routes/Threshold.tsx
  - tests/e2e/uie-09-admin-hub.spec.ts
  - eslint.config.js
  - .claude/hooks/guard-allowed-paths.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-09 — review report

**`next_state: DONE`, not `QA`.** ADR-022 removed the QA stage and the lifecycle at
`.ai/01-operating-model.md:36` runs `IN_PROGRESS -> REVIEW -> DONE`.
`.ai/templates/review-report.md:30` still prints `next_state: QA`; that is a stale line in the
template and not a state this board has. CAL-10's report records the same reading.

**The template's R7/R8 headings are stale in the same way and the operating model is followed.** The
checklist rows at `.ai/templates/review-report.md:44-45` are right — R7 is invariants, R8 is
dependencies, matching `.ai/01-operating-model.md:133-134` — but the heading at
`.ai/templates/review-report.md:55` asks for the per-invariant table under *R8 detail* and `:76` says
R8 escalates. `.ai/01-operating-model.md:147` is authoritative: **R7 escalates**, so the per-ID
reasoning is under *R7 detail* below.

**Every command below was re-run in this session.** The Developer's verification table was not taken
on its word; the one place the two disagree is recorded at the end of R2/R3 detail.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/UIE-09/ticket.yaml:73-77`, `.claude/hooks/guard-allowed-paths.mjs:207` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/AdminHub.tsx:23`, `eslint.config.js:64-77` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `src/App.tsx:387-390`, `src/components/TopBar.tsx:63-71`, `:210-214`, `src/components/AppShell.tsx:49`, `src/routes/AdminHub.tsx:34-38`, `:52-88`, `:100-116` — and the R5 table |
| R6 | Permission gating matches plan section 3 | PASS | `src/App.tsx:389`, `src/components/AppShell.tsx:49`, `src/components/TopBar.tsx:210-214`, `src/routes/AdminHub.tsx:106-109` |
| R7 | No invariant violated — reasoned per ID (RULE-07) | PASS | `src/routes/AdminHub.tsx:19-24`, `src/components/TopBar.tsx:1-2` imports — and the R7 table |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` absent from `git status --porcelain` |

### R1 detail

Seven paths are dirty. Five are `allowed_paths` character for character
(`.ai/board/tickets/UIE-09/ticket.yaml:73-77`): `src/routes/AdminHub.tsx` and
`tests/e2e/uie-09-admin-hub.spec.ts` new, `src/App.tsx`, `src/components/TopBar.tsx` and
`src/components/AppShell.tsx` modified. The other two — `01-plan.md` and `03-impl-log.md` — plus the
modified `ticket.yaml` are all under `.ai/board/tickets/UIE-09/`, which the guard exempts
unconditionally at `.claude/hooks/guard-allowed-paths.mjs:207`.

`node scripts/check-allowed-paths.mjs` → exit 0, `allowed-paths: PASS`, ticket UIE-09. It reports
`0 changed file(s)` because it reads the committed diff and this ticket is entirely uncommitted until
`/ship`, so the subset property above is established from `git status --porcelain` rather than from
that line.

**`src/components/Sidebar.tsx` is unmodified**, and so is every one of the nineteen pre-existing spec
files — `git status --porcelain tests/` names only `tests/e2e/uie-09-admin-hub.spec.ts`, untracked.
That is the property the two-row split exists to buy (01-plan.md § 1, § 7) and it is the one thing in
this ticket a diff could silently destroy. `package.json`, `pnpm-lock.yaml`, `.ai/registry/**` and
`.ai/standards/**` are all clean, so RULE-01 is not engaged.

### R2 / R3 detail, and the suite

| Command | Exit | Result |
|---|---|---|
| `pnpm exec tsc --noEmit` | 0 | no output |
| `pnpm exec eslint .` | 0 | no output — this is the mechanical half of R4 and of AC-12 at the source level |
| `pnpm exec vitest run` | 0 | 12 files, 208 tests, all pass, none edited |
| `pnpm exec playwright test` | 0 | **197 tests, all pass**, of which 12 are `tests/e2e/uie-09-admin-hub.spec.ts` |

**One count in `03-impl-log.md` is wrong and the total it reaches is right.** That table says
*"197 tests in 19 spec files … 184 before this ticket, 13 added here"*. Measured here: the spec file
holds **12** `test(` blocks and Playwright runs 12 from it, `tests/e2e/` now holds **20** `*.spec.ts`
files against 19 before, and the baseline was therefore **185**. The total, 197, and the claim that
matters — that no existing spec was edited — are both confirmed. This is a decomposition off by one
in a log table, not a defect in the code, and no R-check turns on it; it is recorded so a later
reader who recomputes the baseline is not left wondering which number moved.

### R4 detail

`src/routes/AdminHub.tsx:19-24` is the whole import list: React, `react-router-dom`, `seam` from
`@/lib/data` (`:23`) and a type-only `Member` from `@/lib/domain/types` (`:24`). **`seam.getCurrentMember`
is the only member of `seam` the file names** — `src/routes/AdminHub.tsx:100` is the sole call site,
which is what makes 01-plan.md § 4.4's *"no write function is imported"* a property of the file rather
than a claim about it.

`src/components/TopBar.tsx:1-2` and `src/components/AppShell.tsx` import nothing from the data layer
at all — TopBar takes `react-router-dom` and `@/lib/period`, AppShell takes `react-router-dom`, its
two children and a type. No `@supabase/*`, no `./mock`, no `./supabase` anywhere in the diff, so the
restricted-import rule at `eslint.config.js:64-77` has nothing to fire on and R3's clean exit is the
mechanical confirmation.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 the `/admin` route, guarded on `member` | `src/App.tsx:387-390`, import at `:11` | Yes — verbatim, `<Navigate to="/" replace />` otherwise |
| § 4.1 no children, no route re-addressed | `src/App.tsx:387-390`; `/threshold` still at `:363-366` | Yes — the route is added above the four and moves none of them |
| § 4.2 `TopBarProps` | `src/components/TopBar.tsx:63-69` | Yes — `isAdmin: boolean`, the only prop |
| § 4.2 `TopBar({ isAdmin }: TopBarProps)` | `src/components/TopBar.tsx:71` | Yes |
| § 4.2 the control, `PILL_OUTLINE`, in the right cluster | `src/components/TopBar.tsx:210-214`; `PILL_OUTLINE` at `:47` | Yes — after the switcher block (`:168`), before `home-new-entry-link` (`:217`), and **outside** the `nav !== null` condition so it renders on every route inside the shell |
| § 4.2 the amended `IT TAKES NO PROPS` comment | `src/components/TopBar.tsx:3-15` | Yes — the superseded sentence is quoted rather than deleted, and `:8-15` is the paragraph `ticket.yaml` § 6 requires, saying the period derivation is untouched |
| § 4.2 the period derivation genuinely untouched | `src/components/TopBar.tsx:72-73` `periodNavFor(pathname)` off `useLocation()`, `:107`, `:168` | Yes — the anchor, the step controls, `Today` and the three segments still come from `nav` and nothing else; AC-11 asserts it from the page |
| § 4.3 the shell passes the boolean | `src/components/AppShell.tsx:49` | Yes — `member.role === "admin"`, the expression `Sidebar.tsx:127` already uses |
| § 4.3 `AppShellProps` unchanged | `src/components/AppShell.tsx` — `git diff` touches only the comment at `:41-48` and the line at `:49` | Yes |
| § 4.4 the four-phase `View` union | `src/routes/AdminHub.tsx:34-38` | Yes — `loading` / `refused` / `unavailable` / `ready`, in the plan's order |
| § 4.4 one seam call, refusal branch | `src/routes/AdminHub.tsx:100-111` | Yes — `if (!me \|\| me.role !== "admin")` → `refused`, verbatim |
| § 4.4 the `unavailable` branch | `src/routes/AdminHub.tsx:112-116` | Yes — the `catch`, and it is the only path to that phase |
| § 4.4 `DESTINATIONS` declared once as data | `src/routes/AdminHub.tsx:52-88` | Yes — `testId`, `to`, `name`, `blurb`, the five in § 2b's order: pending, team entries, members, allow list, threshold |
| § 4.5 all twelve selectors | `:211` `shell-admin-link`; `:179` `admin-hub`; `:126` `-loading`; `:138` `-refused`; `:159` `-unavailable`; `:195` `-link`; `:197` the five from `:59`, `:65`, `:71`, `:77`, `:83`; `:148`/`:170`/`:209` `-back` | Yes — all new, one `-back` per phase so exactly one renders on any page |
| § 4.5 no `home-*` id added, moved, renamed or removed | `git diff -U0 \| grep '^+.*data-testid'` returns exactly one line, `src/components/TopBar.tsx:211` | Yes |
| § 4.6 the copy, English | `:181` heading `Admin`, `:182-185` the sentence, `:59-88` name and blurb per row, `:212` the pill, `:149`/`:171`/`:210` `Back to the start` | Yes |

**The two declared deviations, judged rather than accepted on the Developer's word.**

1. **`admin-hub-link` on the `<li>` and the five individual ids on the `<Link>` inside it**
   (`src/routes/AdminHub.tsx:195-197`). This is not a deviation from § 4.5, it is § 4.5's own wording:
   the table calls `admin-hub-link` *"every destination row"* and the five *"the five, individually"*,
   and one element carries one `data-testid`. The Developer's reading is the one that keeps AC-4
   clicking a link rather than a list item, and the spec follows it at
   `tests/e2e/uie-09-admin-hub.spec.ts:166-180`.
2. **`data-to` on the row** (`src/routes/AdminHub.tsx:195`). An attribute and not a selector, so AC-9
   is not engaged — it constrains `data-testid` ids and nothing else. It carries § 2b's ordering
   claim, which otherwise has nothing to hang on:
   `tests/e2e/uie-09-admin-hub.spec.ts:171-174` asserts the five addresses **and their order** in one
   read. `team-entry-row`'s `data-created-at` is the same move under CAL-02.

**`view.me` is carried and never read** (`src/routes/AdminHub.tsx:38`, `:111`). It is the contract
§ 4.4 declares and `Threshold.tsx:48` carries the same field on the same terms; the log names it so a
reviewer does not have to guess whether it was an oversight. Not a finding.

**One plan-internal tension, resolved consistently and named here so it is not rediscovered at
UIE-10.** AC-9 says *"every id in the product still resolves to exactly one node on any single page"*
while § 4.5 defines `admin-hub-link` as the id of a row and AC-3 counts five of them. The
implementation and the spec both take the reading that `admin-hub-link` is a deliberate multiple —
`tests/e2e/uie-09-admin-hub.spec.ts:305-313` asserts count 1 for every singular id and states the
exception in terms, citing `shell-roster-row` and `year-month-card` as the existing precedent. The
property AC-9 exists to protect — that no `home-*` id gains a second node and breaks Playwright strict
mode for UIE-10 — is intact and asserted at `:297-303`.

## R6 detail

`invariants_touched` is `[]` and § 3 changes no policy, so this check is about whether the affordances
match the table 01-plan.md § 3 gives.

| § 3 row | `member` | `admin` | Held at |
|---|---|---|---|
| See the admin control in the top bar | ❌ | ✅ | `src/components/TopBar.tsx:210-214` — `{isAdmin ? … : null}`, absent and not disabled; the boolean is computed at `src/components/AppShell.tsx:49` from the member row `App.tsx` resolved |
| Open `/admin` and see the five destinations | ❌ | ✅ | `src/routes/AdminHub.tsx:106-109` — a non-admin gets `refused` and the list at `:193-206` is never reached |
| Reach any of the five addresses by typing it | unchanged | unchanged | `src/App.tsx:238`, `:267`, `:289`, `:365` are untouched by this diff, and `src/routes/AdminHub.tsx` renders only `<Link>` elements |

**The route is guarded on `member` and the refusal is in-screen** (`src/App.tsx:389`), which is the
choice `/threshold` (`:365`), `/entries/team` (`:267`) and `/entries/pending` (`:289`) each already
record — a member who types the address reaches the component and is refused by it. A caller with no
member row is not `membership.state === "member"` and lands on `/`, which resolves by membership
(`src/App.tsx:203-206`); `src/routes/AdminHub.tsx:102-109` folds that caller into the same branch as
the belt to that brace.

**The denials, which is the half a permission table cannot be tested without.** A member sees no
control (`tests/e2e/uie-09-admin-hub.spec.ts:155-160`), a member at `/admin` sees none of the five and
is not redirected (`:231-248`), and **no element added by this ticket performs an action** — checkable
by reading `src/routes/AdminHub.tsx:23`, the file's only data-layer import, against `:100` as its only
call site.

## R7 detail

**One row per ID, reasoned individually.** `invariants_touched: []` is an answer here and not the
template default — `.ai/board/tickets/UIE-09/ticket.yaml:41-47` says so in terms and 01-plan.md § 2
reasons through every ID. `.ai/registry/invariants.md:63` warns that observing the safest behaviour
and concluding no invariant is engaged is circular; the reason that does not apply is that **no
behaviour was chosen** — this ticket adds no write path, so there is no statement, derivation or
number in it to get wrong.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — overlap | Untouched. No entry is created or edited anywhere in the diff; no entry type is imported | `src/routes/AdminHub.tsx:19-24` is the complete import list, and it names no entry type |
| INV-02 — approval does not survive an edit | Untouched. Nothing here approves, rejects or edits. The hub links to `/entries/pending`; that screen's controls are ADM-05's and are unmodified | `src/routes/AdminHub.tsx:196-203` renders a `<Link>` and nothing else |
| INV-03 — a rejected entry carries a reason | Untouched. No rejection path exists in this ticket | `src/routes/AdminHub.tsx:100` — the only seam call is `getCurrentMember()` |
| INV-04 — one definition of the absence count | Untouched, and this is the one worth the mechanical check because a second definition is how it dies. `src/lib/data/absence.ts` is imported by none of the four files; the hub renders five constant strings and five constant addresses | `src/routes/AdminHub.tsx:52-88`; `grep` for `absence` over the four files returns nothing |
| INV-05 — tentative still counts | Untouched. No count is computed, displayed or passed | as INV-04 |
| INV-06 — one portion per entry | Untouched. No portion is read or written | `src/routes/AdminHub.tsx:19-24` |
| INV-07 — one member, one team | Held, and it is the one worth arguing with. `/members` goes from *reachable only by typing* to two clicks for an admin, so the **exposure** changes. What may be done there does not: TEA-04's writes are held by `member_update_admin` in the datastore, this ticket ships no migration and no policy, and `src/routes/MemberList.tsx` is unmodified. Reaching a destination more easily is not the same as changing what may be done at it — and an invariant held only by the absence of a link was never held | `src/routes/AdminHub.tsx:70-75` is the whole of the change to `/members`' reachability; `.ai/board/tickets/UIE-09/ticket.yaml:78` `schema_delta: none`, confirmed by `git status --porcelain supabase/` being empty |

No invariant is held here by a UI affordance, because none of the seven is engaged by a screen that
only links.

## R8 detail

No dependency was added, removed or upgraded. `git status --porcelain` names neither `package.json`
nor `pnpm-lock.yaml`, and the diff introduces no import from a package not already used by the files
it touches — `react`, `react-router-dom` and the two local aliases
(`src/routes/AdminHub.tsx:19-24`). No ADR is owed.

## Findings

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | None. R1 through R8 all pass | — | No |

The one thing recorded above that is not a finding is the off-by-one decomposition in
`03-impl-log.md`'s Playwright row (R2/R3 detail). It is a wrong number in a log table beside a right
total; it changes no code, fails no check, and is left where a reader recomputing the baseline will
meet it.

## Verdict

**PASS.** `next_state: DONE`, `rework_count` unchanged at 0.

The property this row exists to buy is the one that was checked hardest and it holds:
`src/components/Sidebar.tsx` is unmodified, no existing spec file is edited, and the four
`home-*-link` ids still resolve to exactly one node each on the hub itself
(`tests/e2e/uie-09-admin-hub.spec.ts:297-299`). UIE-10 inherits the migration it was promised.
