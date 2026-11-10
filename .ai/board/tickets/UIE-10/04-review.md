---
ticket: UIE-10
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-09T15:48:45+0700
inputs_read:
  - .ai/board/tickets/UIE-10/01-plan.md
  - .ai/board/tickets/UIE-10/03-impl-log.md
  - .ai/board/tickets/UIE-10/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - .ai/standards/git-conventions.md
  - .claude/PERMISSIONS.md
  - .claude/hooks/guard-allowed-paths.mjs
  - scripts/check-allowed-paths.mjs
  - .ai/board/tickets/UIE-09/04-review.md
  - .ai/board/tickets/CAL-10/04-review.md
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/routes/AdminHub.tsx
  - tests/e2e/uie-10-sidebar.spec.ts
  - tests/e2e/uie-09-admin-hub.spec.ts
  - tests/e2e/adm-01-threshold.spec.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/adm-05-approve-reject.spec.ts
  - tests/e2e/adm-06-bulk-reject.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/cal-07-overload-warning.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - tests/e2e/tea-05-sign-in.spec.ts
  - .ai/board/tickets/UIE-02/01-plan.md
  - .ai/board/tickets/UIE-09/01-plan.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-10 — review report

`next_state: DONE` rather than `QA`: ADR-022 removed the QA stage, and the template's front-matter
sample still carries the retired value. UIE-09 and CAL-10 both wrote `DONE` from this stage.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/UIE-10/ticket.yaml:76-88`, `.ai/standards/git-conventions.md:139`, `.claude/hooks/guard-allowed-paths.mjs:207` — and the R1 detail, which names two dirty paths that are **not** this ticket's |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/components/Sidebar.tsx:39-42` — the complete import list, no `@/lib/data`, no `@supabase/*` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `src/components/Sidebar.tsx:277-291`, `:198-245`, and the R5 table below |
| R6 | Permission gating matches plan section 3 | PASS | `src/components/Sidebar.tsx:146-150`, `src/components/TopBar.tsx:210-211`, `tests/e2e/uie-10-sidebar.spec.ts:191-215` |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) | PASS | `.ai/board/tickets/UIE-10/ticket.yaml:44`, and the R7 table below |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` → empty |

**The template numbers its two detail sections `R5 detail` and `R8 detail`, and the second is headed
*one row per ID in `invariants_touched`* — that is stale numbering from before ADR-022.** The
operating model's checklist (`.ai/01-operating-model.md:127-134`) and the routing table (`:144-147`)
both put invariants at R7 and dependencies at R8, and this report follows them. It is a defect in
`.ai/templates/review-report.md`, not in this ticket, and it is `/thuki`'s to fix on an `ops/` branch.

### R1 detail

**Eighteen paths are dirty. Thirteen are `allowed_paths` character for character**
(`.ai/board/tickets/UIE-10/ticket.yaml:76-88`): `src/components/Sidebar.tsx` and nine shipped spec
files modified, `tests/e2e/uie-10-sidebar.spec.ts` new, and the two shipped plan files
`.ai/board/tickets/UIE-02/01-plan.md` and `.ai/board/tickets/UIE-09/01-plan.md`. Three more —
`ticket.yaml`, `01-plan.md`, `03-impl-log.md` — are under `.ai/board/tickets/UIE-10/`, which the
guard exempts unconditionally at `.claude/hooks/guard-allowed-paths.mjs:207`.

`package.json`, `pnpm-lock.yaml`, `src/components/TopBar.tsx`, `src/routes/AdminHub.tsx` and
`.ai/registry/**` are all clean — RULE-01 is not engaged, and both amended plan files are board plane.

**TWO PATHS ARE DIRTY THAT ARE IN NEITHER SET, AND UNLIKE THE LAST TWO REVIEWS THIS ONE CANNOT
CERTIFY `.ai/standards/**` CLEAN.**

| Path | Plane | What the edit is |
|---|---|---|
| `.ai/board/model-debt.md` | board | An `AMENDED 2026-09-09` block inside MD-030, recording that `.ai/board/tickets/CAL-10/design/year-overview-2026-09-08.jpg` landed in commit `ea2da6d` and that the row stays open because the file was placed by the dispatching session rather than by `product` |
| `.ai/standards/ui-design-system.md` | **human-only** (`CLAUDE.md` § *Two planes*) | The same amendment, as a block appended to § *Visual specification*'s `CORRECTION 2026-09-09` |

**Neither is this ticket's work, and that is established from content rather than from the log's
word.** Both concern MD-030 and CAL-10's image provenance; neither names the sidebar, the roster,
`shell-roster-role`, or any id, file or criterion in UIE-10's contract. Neither is executable and
neither can affect a test.

**R1 still passes, and the reason is the model's own file classification rather than tolerance.**
`.ai/standards/git-conventions.md:139` puts *model, standards, hooks, scripts, tooling* in the
*Everything else* set: **not committed by `/ship`, left dirty, landed on `ops/<slug>` by the session
that wrote it.** `scripts/check-allowed-paths.mjs:123` computes its diff as `origin/main...HEAD`, so
what R1 is finally about — what reaches the branch and the pull request — excludes both by
construction. `CLAUDE.md` § *Working agreements* states the same thing from `/ship`'s side: chore work
is *"not its to commit: it names those paths and leaves them dirty for the session that wrote them."*
A dirty tree carrying non-ticket work is a sanctioned state here, provided it is named. It is named.

**Two things about them the operator should have rather than not, neither a finding:**

1. **`.ai/standards/**` is human plane and this edit is unattributed.** `04-review.md` for UIE-09
   certified `.ai/standards/**` clean at `2026-09-09T14:46:31+0700`
   (`.ai/board/tickets/UIE-09/04-review.md:77-78`), so both edits landed after that time — inside
   UIE-10's PLAN (15:04) and IMPLEMENT (15:36) window, or by the operator's own hand. **Mechanism
   proves nothing either way**: `guard-allowed-paths.mjs` would have refused an agent write to that
   path, and it ships unwired by ADR-004 (`.claude/PERMISSIONS.md:89`). This review does not assert
   who wrote them, because it cannot, and RULE-03 is a claim about an author. **Whoever did owes them
   an `ops/<slug>` branch**; left dirty they are lost the next time the tree is cleaned, which is the
   loss MD-031 already records happening twice.
2. **`03-impl-log.md` promises a disclosure it does not contain.** Its § *Files touched* preamble
   says *"see § Open questions for the two files that arrived dirty from PLAN and are not this
   ticket's"* — and § Open questions 1 through 4 discuss two stale **comments**, prettier, the
   `ticket.yaml` state gap and `check-docs.mjs`, and never mention either file. The cross-reference
   is broken, so the one place a reviewer was told to look for the two dirty paths does not name
   them. A log defect, not a code defect.

`node scripts/check-allowed-paths.mjs` → exit 0, `allowed-paths: PASS`. **That line is true and
carries no information**: it reports `0 changed file(s)`, because it reads the committed diff and this
ticket is entirely uncommitted until `/ship`. The subset property above is established from
`git status --porcelain`, as it was for UIE-09 and CAL-10.

### R2 / R3 detail, and the suite

Every command re-run in this session on this tree, exit code read.

| Command | Exit | Result |
|---|---|---|
| `pnpm exec tsc --noEmit` | 0 | no output |
| `pnpm exec eslint .` | 0 | no output — this is the mechanical half of R4, and of AC-11 at the source level |
| `pnpm exec vitest run` | 0 | 12 files, 208 tests, all pass, none edited by this ticket |
| `pnpm exec playwright test` | 0 | **208 passed, 0 failed, 28.6s** — 197 shipped plus this ticket's 11 |

Every number in `03-impl-log.md` § *Verification run* reproduces exactly. **The end-to-end command
was genuinely run and this ticket is the one where skipping it would have cost the most**: thirty
executable statements in nine shipped spec files addressed ids this change removes, and nothing short
of the suite distinguishes *migrated* from *plausibly migrated*.

### R4 detail

`src/components/Sidebar.tsx:39-42` is the complete import list — `react`, `react-router-dom`,
`@/hooks/useRoster`, and a type-only import from `@/lib/domain/types`. No `@/lib/data`, no
`./mock`, no `./supabase`, no `@supabase/*` anywhere in the file, so the restricted-import rule has
nothing to fire on and R3's clean exit is this check's mechanical half. **The ticket makes no new read
of any kind**: `useRoster` already returned `role` on every member, which is what the account footer
has rendered since UIE-02, and `src/components/Sidebar.tsx:242` draws a field the component already
held. The nine amended spec files change locators only; none of them touches the seam.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — the nav block loses its four admin links and `isAdmin` | `src/components/Sidebar.tsx:277-291` | Yes — three `<Link>`s, `home-week-link` `:278`, `home-year-link` `:281`, `home-holidays-link` `:285`, byte-for-byte the plan's snippet |
| § 4.1 — `isAdmin` removed with them | `src/components/Sidebar.tsx:146-150` | Yes — the binding is gone, replaced by the comment recording why; `grep isAdmin src/components/Sidebar.tsx` returns only comment lines |
| § 4.1 — the four ids render for nobody | `grep -rn` over `src/` returns only comments at `Sidebar.tsx:21-22`, `:253-254` and `TopBar.tsx:194` | Yes — no `data-testid` anywhere carries one |
| § 4.2 — the roster row, two stacked lines | `src/components/Sidebar.tsx:198-245` | Yes — `AvatarChip`, then `div.flex.min-w-0.flex-col` holding the name span and the role span |
| § 4.2 — `shell-roster-role`, never `home-member-role` | `:238` new id, `:327` the footer's, untouched | Yes — two different ids, and `tea-05-sign-in.spec.ts:155`/`:171` still read `home-member-role` by text and pass |
| § 4.2 — `data-role` carries the raw value | `:239` | Yes — `data-role={m.role}` beside the rendered word |
| § 4.2 — `roleLabel` reused, not copied | declared `:53`, called `:242` and `:330` | Yes — a second call site in the file that already declares it; `MemberList.tsx` untouched, so no third copy |
| § 4.3 — the nine navigation sites, each two clicks | `adm-01:67-69` (helper, called at `:62` and `:115`) and `:217-218`; `adm-04:146-147`; `adm-05:115-116` and `:124-125`; `adm-06:126-127`; `cal-03:117-118` and `:489-491`; `cal-07:128-129`; `cal-08:368-369` | Yes — every one is `shell-admin-link` then the destination's `admin-hub-*-link` |
| § 4.4 — the seven positives move to the hub's link | `adm-01:66-68` and `:216-218`, `adm-04:431-433`, `cal-03:488-490`, `tea-05:156-158` | Yes for six; the seventh is the declared deviation below |
| § 4.4 — the six negatives become `shell-admin-link` `toHaveCount(0)` | `adm-01:230`, `adm-04:333`, `adm-04:354`, `cal-03:310`, `cal-03:506`, `tea-05:172` | Yes — exactly six, one per site the plan named |
| § 4.5 — UIE-02 AC-6 and AC-8 amended | `.ai/board/tickets/UIE-02/01-plan.md:214-228`, `:243-259` | Yes — AC-6's list shortened twelve → eight, AC-8 marked superseded and kept in the past tense |
| § 4.5 — UIE-09 AC-9 and AC-10 amended | `.ai/board/tickets/UIE-09/01-plan.md:181-211` | Yes — one *Amended by UIE-10* block scoping each clause and naming which moved |
| § 4.5 — and the spec that asserts them | `tests/e2e/uie-09-admin-hub.spec.ts:105`, `:315`, `:334`, `:345`, `:352`, `:367` | Yes — four loops inverted `toHaveCount(1)` → `toHaveCount(0)`, AC-10 retitled |

**No contract item is missing and none is impossible as specified except the one below.**

### The declared deviation, judged rather than accepted on the Developer's word

**§ 4.4 asserted a fact about UIE-09's copy that is false, and the Developer was right to refuse
it.** The plan says `adm-04`'s `toHaveText("Waiting for a decision")` *"moves to
`admin-hub-pending-link` and keeps the text it asserts, since the hub row for that destination
carries the same words."* `src/routes/AdminHub.tsx:59-62` names that row **`Pending approvals`**, with
the blurb *"Entries waiting for a decision. Approve or reject them one at a time or together."*
`toHaveText` asserts the whole text of the element, so the plan's string cannot pass against that row
under any casing. This is a **plan defect** — routing row *R5 impossible as specified* — and under
RULE-08 it is not chargeable to the Developer. It is not routed, because it is already resolved
correctly on disk and no further stage work exists to do.

**What replaced it holds ADM-04 AC-9 rather than weakening it**
(`tests/e2e/adm-04-worklist.spec.ts:441-442`):

```ts
await expect(link).toContainText("Pending approvals");
expect(((await link.textContent()) ?? "").match(/\d/)).toBeNull();
```

AC-9 is *the admin link is offered, and it carries no count* — `.ai/registry/features.md:117` is the
row that constrains it, requiring that a badge derive from an exact count and that badge and list
never disagree. The first line asserts the destination is named without pinning another ticket's
blurb; **the second is the half the original only got by accident.** `toHaveText` on a fixed string
forbade a badge as a side effect of pinning the whole string; the digit scan forbids one on purpose,
over the row's entire text. Verified against the rendered copy: the row's name and blurb contain no
digit, so the assertion is live rather than trivially true.

**One stale citation rode along in that hunk and is worth a line rather than a finding.** The
comment at `tests/e2e/adm-04-worklist.spec.ts:436` still names `.ai/registry/features.md:103`,
which is CAL-07's row; ADM-04's is `:117`. The number was already wrong in the line this hunk
replaced, so the ticket carried it rather than introduced it, and it is a comment.

The two smaller departures are correct and both are declared. Renaming `SIDEBAR_ADMIN_LINKS` to
`RETIRED_SIDEBAR_ADMIN_LINKS` (`tests/e2e/uie-09-admin-hub.spec.ts:105`) keeps the only place the
suite names the four retired ids. `adm-04:333` and `:354` collapsing onto one locator is right for the
reason given at `:349-353`: the second observes the member after the round trip through the refusal,
which is a different moment on a different page.

### R6 detail

Plan § 3's table has four rows and three of them say *unchanged*. Each is checked against the tree:

| § 3 row | Verdict | Citation |
|---|---|---|
| See a link to an admin address in the sidebar — ❌ for a member (unchanged), ❌ for an admin (**changed**) | Holds | `src/components/Sidebar.tsx:277-291` renders three links under no condition at all; `:146-150` records that the file's one role condition is gone. The pane's length is no longer a function of role, which `tests/e2e/uie-09-admin-hub.spec.ts:345`, `:352`, `:367` assert for both roles |
| See a link to an admin address on the hub — ❌ member, ✅ admin (unchanged, UIE-09) | Holds | `src/components/TopBar.tsx:210-211` — `shell-admin-link` still behind `isAdmin`, and `TopBar.tsx` is unmodified by this ticket |
| Reach any of the four addresses by typing it — unchanged for both | Holds | `tests/e2e/uie-10-sidebar.spec.ts:260-272` — a member reaches all four and gets `pending-entries-refused`, `team-entries-refused`, `allow-list-refused`, `threshold-refused`; none of the four screens is touched by the diff |
| See every teammate's role — ✅ **new** for both | Holds, and it is a display only | `src/components/Sidebar.tsx:238-243` — a `<span>`, not a control; `tests/e2e/uie-10-sidebar.spec.ts:382-416` (AC-10) reads every element of the sidebar and finds nothing that writes |

**Nothing here restricts anything, which is the property plan § 3 says the ticket must not lose.**
The only role condition removed rendered an affordance; the four screens' own refusals are untouched
and are asserted from a member's session. The one exposure change plan § 3 states — a member now sees
every teammate's role — is real, is on screen at `:242`, and is not new data: `member.role` has been
returned to both roles by `member_select_team` since TEA-03 and is what the account footer at `:330`
has always rendered for the caller. `.ai/standards/rbac-and-security.md` carries no row it contradicts.

### R7 detail

`invariants_touched: []` (`.ai/board/tickets/UIE-10/ticket.yaml:44`), and the plan makes it an answer
rather than the template default. Reasoned per ID, as the check requires:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping entries for one member | Untouched. Nothing in the diff creates, edits or reads an entry | `src/components/Sidebar.tsx:39-42` — the file imports no entry module |
| INV-02 — an edited approved entry returns to `pending` | Untouched. No approval path is in the diff; `adm-05`, `adm-06` and `cal-03` change locators only | `git diff tests/e2e/adm-05-approve-reject.spec.ts` — the only hunks are `:115-116` and `:124-125` |
| INV-03 — a rejected entry carries a reason | Untouched. `adm-06-bulk-reject.spec.ts` changes one navigation helper and asserts the same outcomes | `tests/e2e/adm-06-bulk-reject.spec.ts:126-127` |
| INV-04 — the single definition of the absence count | Untouched. `src/lib/data/absence.ts` is clean and is imported by neither file this ticket changes | `git status --porcelain src/lib/` → empty |
| INV-05 — a tentative entry counts as a non-tentative one | Untouched. No counting code, no tentative flag, no threshold read in the diff | `src/components/Sidebar.tsx:39-42` |
| INV-06 — one portion per entry, applied to every date | Untouched. No entry shape is read or written | `src/components/Sidebar.tsx:39-42` |
| INV-07 — an entry is counted only against its member's team | **Named in the plan and not engaged.** The roster stays one flat list of the caller's team; no sub-group, no group header and no count pill is added, so nothing reaches the *is a sub-group ever a counting unit* question the plan defers | `src/components/Sidebar.tsx:198-245` — one `<li>` per member and no grouping; `tests/e2e/uie-10-sidebar.spec.ts:357-381` asserts `shell-roster-count` still states the same number over the same rows |

**The role word is displayed and never acted on**, which is the property that keeps INV-07's neighbour
questions out of scope: `src/components/Sidebar.tsx:238-243` is a `<span>` with a `data-role`
attribute and no handler. **Displaying a role neither grants nor withholds anything**, and no
invariant here is held by a UI affordance — every refusal in this area is a row-level-security policy
the diff does not touch (ADR-005).

### R8 detail

`git status --porcelain package.json pnpm-lock.yaml` → empty. No import in the diff names a package
that was not already imported: `src/components/Sidebar.tsx:39-42` is `react`, `react-router-dom`,
`@/hooks/useRoster` and a type import, all pre-existing; the new spec's only imports are
`@playwright/test` and, inside AC-5, dynamic `node:fs` and `node:path`
(`tests/e2e/uie-10-sidebar.spec.ts:227-228`), both Node built-ins. No ADR is owed.

## Findings

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | None. R1 through R8 all pass | — | No |

## Two things recorded that are not findings

**1. AC-5's scan is narrower than AC-5's sentence, and the gap is a loop.** AC-5 reads *"none of them
asserts the absence of an id that renders for nobody"*, and its implementation
(`tests/e2e/uie-10-sidebar.spec.ts:239-242`) only reports a line that contains **both** a negative
matcher and a **literal** removed id. The four loops at `tests/e2e/uie-09-admin-hub.spec.ts:315`,
`:345`, `:352` and `:367` assert exactly that absence, and are invisible to the scan because the id
arrives through a loop variable from the array at `:105`; the same is true of this ticket's own loops
at `tests/e2e/uie-10-sidebar.spec.ts:135` and `:255`.

**Those particular loops are legitimate and their comments say why** — an assertion that a *retired*
id has not come back can still fail, which is the one thing that separates a regression guard from a
vacuous denial. **What does not hold is the comment's claim** at `:225-226`, that reading the shipped
files rather than a hand list means *"an eighth site added later by a ticket that never read this
comment is caught too."* A later ticket that writes its vacuous denial in the loop form the two newest
spec files both model will pass AC-5 unnoticed. All six of the denials this ticket had to migrate were
in the inline form and all six are gone, so nothing is wrong today; the standing guard is weaker than
its own prose. Cheapest repair when someone next opens that file: resolve the array names the scan
already knows about, or assert on the file's parsed source rather than line by line.

**2. `src/components/TopBar.tsx:194` and `tests/e2e/adm-02-holidays.spec.ts:298` now contain false or
weakened comments, and leaving them was correct.** Both are outside `allowed_paths`, RULE-03 forbids
the edit, and neither is executable. `TopBar.tsx:194` says `home-pending-entries-link` *"is in the
sidebar"*, which AC-1 made false — though the paragraph's conclusion, that no second control to that
address exists in the top bar, still holds. `adm-02:298` draws a contrast against three ids that no
longer exist, which makes the contrast stronger rather than wrong. Both are one-line edits for
whichever ticket next opens those files, and `03-impl-log.md` § *Open questions* 1 already names them.

## Verdict

**PASS.** R1 through R8 all pass, each cited above.

**What this ticket actually bought, in one sentence, because it is the thing a reviewer should
confirm and not merely check off:** the six assertions that were the only shipped statements anywhere
that a member is offered no admin surface were the ones most likely to be lost in this migration —
they would have gone on passing, green and empty, against four names that render for nobody — and all
six now stand on `shell-admin-link`, which renders for an admin and not for a member and can
therefore still fail (`adm-01:230`, `adm-04:333`, `:354`, `cal-03:310`, `:506`, `tea-05:172`).

`size: L` proceeding unsplit is the operator's recorded decision of 2026-09-09
(`.ai/board/tickets/UIE-10/ticket.yaml:27-36`, `01-plan.md` § 7) and is not this gate's to re-open.
Two things upstream of this stage are already flagged in `03-impl-log.md` and are named here only so
the `/ship` session does not meet them cold: `ticket.yaml` arrived at `state: BACKLOG` with
`gates.plan.passed: false` while `01-plan.md`'s front-matter read `PASS` / `READY`, and
`node scripts/check-docs.mjs` exits 1 with the same 6 errors it produces on the untouched tree — all
six in `.ai/registry/features.md`, which is human plane, and none of them caused by this ticket.
