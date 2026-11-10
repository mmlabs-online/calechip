---
ticket: UIE-10
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-09T15:36:04+0700
inputs_read:
  - .ai/board/tickets/UIE-10/01-plan.md
  - .ai/board/tickets/UIE-10/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/standards/ui-design-system.md
  - .ai/templates/impl-log.md
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/routes/AdminHub.tsx
  - src/hooks/useRoster.ts
  - src/lib/fixtures.ts
  - tests/e2e/ (every spec naming a `home-*-link` id, and the three that only mention one in a comment)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-10 — implementation log

## Files touched

Thirteen files, which is exactly `allowed_paths`. `node scripts/check-allowed-paths.mjs` passes and
`git status --porcelain` names nothing outside it that this session wrote — see § Open questions for
the two files that arrived dirty from PLAN and are not this ticket's.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/components/Sidebar.tsx` | modified | The four admin `<Link>`s and the `isAdmin` conditional wrapping them are removed; every roster row gains a second stacked line carrying `shell-roster-role`. The whole product change is in this one file. | § 4.1, § 4.2 |
| `tests/e2e/adm-01-threshold.spec.ts` | modified | Two navigation sites and three visibility assertions named `home-threshold-link`. The helper became two clicks; AC-10's negative moved onto `shell-admin-link`. | § 4.3, § 4.4 |
| `tests/e2e/adm-04-worklist.spec.ts` | modified | One navigation site, two negatives and one positive-with-text. AC-9's assertion moved to the hub row — **and it is the one declared deviation below**. | § 4.3, § 4.4 |
| `tests/e2e/adm-05-approve-reject.spec.ts` | modified | Two navigation sites, in two helpers, one per destination. | § 4.3 |
| `tests/e2e/adm-06-bulk-reject.spec.ts` | modified | One navigation site in `openWorklist`. | § 4.3 |
| `tests/e2e/cal-03-admin-edit-entry.spec.ts` | modified | One navigation site, one positive and two negatives — the file with the most sites after `adm-01`. | § 4.3, § 4.4 |
| `tests/e2e/cal-07-overload-warning.spec.ts` | modified | One navigation site in `openTeamList`. | § 4.3 |
| `tests/e2e/cal-08-holiday-shading.spec.ts` | modified | One navigation site, and the comment above it claimed the threshold link was a sidebar control. | § 4.3 |
| `tests/e2e/tea-05-sign-in.spec.ts` | modified | AC-10's positive and negative both named `home-allow-list-link`. Its three `home-member-role` reads are untouched and are the reason § 4.2 forbids reusing that id. | § 4.4 |
| `tests/e2e/uie-09-admin-hub.spec.ts` | modified | Four loops over the four ids, three asserting `toHaveCount(1)`. They are inverted rather than deleted, and AC-10's title changed with its meaning. | § 4.5 |
| `tests/e2e/uie-10-sidebar.spec.ts` | **created** | AC-1 to AC-11. The only place the suite states the migration as a property rather than as an edit — and the only home AC-5 can have, since it reads the whole suite. | § 2 |
| `.ai/board/tickets/UIE-02/01-plan.md` | modified | AC-6's id list shortened from twelve to eight; AC-8 marked superseded, kept in the past tense. | § 4.5 |
| `.ai/board/tickets/UIE-09/01-plan.md` | modified | AC-9 and AC-10 given one *Amended by UIE-10* block that scopes each to UIE-09 and names which clause moved. | § 4.5 |

## Contract items

The plan's contract is § 4 (this plan merges story and design under ADR-019, so § 4 is what the
template calls "design section 1").

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 — the nav block loses four links and `isAdmin` | `src/components/Sidebar.tsx:277-291` | Renders exactly the three `<Link>`s the plan's snippet shows. `isAdmin` had one reader and is gone with it; `member.role` is still read, only ever to display a word. |
| 4.2 — the roster row | `src/components/Sidebar.tsx:203-246` | `shell-roster-role` with `data-role`, `text-[9px] uppercase tracking-wider text-ink-3`, beneath the name inside a `flex min-w-0 flex-col`. `roleLabel` is REUSED — a second call site at `:242` beside the footer's at `:330`, in the file that already declares it, so no third copy of the mapping is created. |
| 4.3 — the nine navigation sites | `adm-01:64-71` (and `:114`, which calls it) and `:217-218`, `adm-04:146-147`, `adm-05:115-116` and `:124-125`, `adm-06:126-127`, `cal-03:117-118` and `:489-491`, `cal-07:128-129`, `cal-08:368-369` | Every one is `shell-admin-link` then the destination's `admin-hub-*-link`. Seven of the nine live inside a helper that already existed, so the inserted step is written once per file rather than once per call. |
| 4.4 — the thirteen visibility sites | positives at `adm-01:68` and `:218`, `adm-04:433` and `:441-442`, `cal-03:490`, `tea-05:158`; negatives at `adm-01:230`, `adm-04:333` and `:354`, `cal-03:310` and `:506`, `tea-05:172` | All six negatives are now `shell-admin-link` `toHaveCount(0)`. One positive deviates — below. |
| 4.5 — the two shipped plans, and the spec that asserts them | `.ai/board/tickets/UIE-02/01-plan.md`, `.ai/board/tickets/UIE-09/01-plan.md`, `tests/e2e/uie-09-admin-hub.spec.ts:94-110` (the array), `:306-317` (AC-9), `:334-372` (AC-10) | Both prose amendments landed. UIE-09's two criteria are additionally amended **as assertions**, which the plan did not spell out but which § 4.5's table requires to be true: a plan saying AC-10 changed while its spec still asserted the old thing would be a contradiction shipped on purpose. |

## Deviations from the design

**One, and it is a factual error in the plan rather than a preference.**

**§ 4.4 says `adm-04:415`'s (now `adm-04:441`) `toHaveText("Waiting for a decision")` "moves to `admin-hub-pending-link`
and keeps the text it asserts, since the hub row for that destination carries the same words". IT
DOES NOT.** `src/routes/AdminHub.tsx:59-63` gives that destination the name `Pending approvals` and
the blurb `Entries waiting for a decision. Approve or reject them one at a time or together.` —
UIE-09 chose its own copy for the hub. `toHaveText` asserts the element's WHOLE text, so the string
in the plan cannot pass against that row under any casing.

**What was built instead, and why it holds ADM-04 AC-9 rather than weakening it.** AC-9 is *the admin
link is offered, and it carries no count of its own*, and `.ai/registry/features.md:103` is the row
that forbids the count. Two assertions replace the one:

```ts
await expect(link).toContainText("Pending approvals");
expect(((await link.textContent()) ?? "").match(/\d/)).toBeNull();
```

The first is `toContainText` on the destination's name rather than `toHaveText` on the row, because
the blurb beneath it is UIE-09's copy and not ADM-04's to pin — a criterion that froze another
ticket's sentence would fail the next time somebody edited it, for no reason connected to what it is
about. **The second is the half that matters and the half the original assertion only got for free:**
`toHaveText` on a fixed string forbade a badge by accident, and this forbids one on purpose, over the
row's whole text. The test's title changed from *the admin link is on Home for an admin* to *the
admin link is offered to an admin*, because it is no longer on Home.

**Two smaller departures, declared because the reviewer would otherwise have to work out whether they
were intended.** Neither changes what any criterion asserts.

1. **`SIDEBAR_ADMIN_LINKS` is renamed `RETIRED_SIDEBAR_ADMIN_LINKS`** (`uie-09-admin-hub.spec.ts:105`).
   § 4.5 said the two criteria must change and did not say how the array should read. The name is
   kept rather than the array deleted, because it is the only place in the suite that names the four
   retired ids, and a name nothing mentions is a name somebody re-adds. Its doc comment says the
   meaning inverted.
2. **`adm-04`'s two negatives (`:333` and `:354`) are now the same locator.** They named
   `home-pending-entries-link` and `home-team-entries-link`, which were different nodes; § 4.4 sends
   both to `shell-admin-link`. The second is kept rather than dropped because what it observes is
   different — the member is offered nothing *after* the round trip through the refusal, on the page
   that refusal returned them to — and the comment there says so.

**And one thing that reads like a deviation and is not.** `uie-10-sidebar.spec.ts`'s AC-7 uses
`allTextContents()` where `allInnerTexts()` would be the more usual call. The class carries
`uppercase`, so `innerText` reports `ADMIN` — what was painted — while `roleLabel` returns `Admin`.
UIE-02 AC-7 drew exactly this distinction for `home-member-role` (*"any uppercase presentation is a
CSS transform and never a different string"*), and this criterion is about the words. AC-11's
diacritic checks deliberately keep `innerText`, because there the painted text is the point.

## Invariants

`invariants_touched: []`, and the plan's § 2 makes it an answer rather than a default.

| ID | Still holds because |
|----|---------------------|
| INV-01 … INV-06 | Nothing in this ticket creates, edits, approves, rejects or counts an entry. `src/components/Sidebar.tsx` imports `useRoster` and `react-router-dom` and nothing from `src/lib/data/`; `src/lib/data/absence.ts` is imported by neither file changed here. No arithmetic, table, policy or definition is touched. |
| INV-07 | Named in the plan because the DEFERRED sub-group work would engage it — a count pill per sub-group is one question away from a threshold per sub-group, which would give INV-04 a second arithmetic scoped to something INV-07 does not recognise. Nothing here reaches that question: the roster is still one flat list of the caller's team, `shell-roster-count` still states the same number over the same rows, and no new grouping exists. |

**The one exposure change, restated here because it is real and is not an invariant** (plan § 3):
every member can now see every teammate's role. It is not new data — `member_select_team` has
returned `role` to both roles since TEA-03, and `/members` renders it for an admin — but it is newly
on screen for a member. It needed **no new read**: `useRoster` already returns `role` on every member,
which is what the account footer has rendered all along.

## Verification run

Every command executed in this session, on this tree, in this order. Exit codes read, not assumed.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | lint, same. Includes the § Language diacritic rule, which the sidebar's new copy passes |
| `pnpm exec vitest run` | 0 | 208 passed, 12 files. Unchanged by this ticket — nothing here is below the seam |
| `pnpm exec playwright test` | 0 | **208 passed, 0 failed, 28.9s.** 197 shipped tests plus this ticket's 11 |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | 13 files, exactly the list |

**The end-to-end command was RUN and not skipped, and that is worth one line.**
`.ai/board/model-debt.md` MD-029 records CAL-09 declining this command on the strength of a stale
*4 pass, 6 fail* table, and names a stale `fail` as *"a standing permission to skip a gate command"*.
This is the ticket where skipping it would have meant the most: 197 of the 208 tests were shipped
before today, thirty of their executable statements addressed ids this change removes, and nothing
short of running them establishes that the nine files were migrated correctly rather than plausibly.

**Two failures were found by that run and both were mine, in the new spec, not in the product.**
Recorded because a log that shows only the green run hides how the green was reached:

1. **All eleven new tests failed on the sign-in helper.** It did `goto("/week")` and waited for
   `sign-in-submit`. Six routes inside the shell — `/week`, `/month`, `/year`, `/allow-list`,
   `/members`, `/holidays` — render their OWN refusal to a caller with no session instead of
   redirecting, so `/week` shows `week-sign-in` and no sign-in form at all. The helper now signs in
   at `/`, which resolves by membership, and then navigates. The comment on it carries the reason.
2. **AC-7 failed on `Admin` vs `ADMIN`** — the `allInnerTexts` case above, now `allTextContents`.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `shell-roster-role` | `src/components/Sidebar.tsx:238` (text at `:242`) — **new**, one node per roster row, carrying `data-role` |
| `home-member-role` | `src/components/Sidebar.tsx:327` (text at `:330`) — unchanged, still exactly one node, still the account footer's |
| `home-week-link` | `src/components/Sidebar.tsx:278` |
| `home-year-link` | `src/components/Sidebar.tsx:281` |
| `home-holidays-link` | `src/components/Sidebar.tsx:285` |
| `shell-roster-row`, `shell-roster-count`, `shell-sidebar`, `shell-brand`, `home-member-name`, `home-member-avatar`, `home-sign-out` | `src/components/Sidebar.tsx` — untouched by this ticket, all asserted in `uie-10-sidebar.spec.ts` AC-8 and AC-9 |
| `shell-admin-link` | `src/components/TopBar.tsx:211` — UIE-09's, **read and never written here**, and now the node that carries the member denial in six assertions across four other spec files |
| `admin-hub-pending-link`, `admin-hub-team-entries-link`, `admin-hub-allow-list-link`, `admin-hub-threshold-link` | `src/routes/AdminHub.tsx:59,65,77,83` — UIE-09's, read and never written here |
| `home-pending-entries-link`, `home-team-entries-link`, `home-allow-list-link`, `home-threshold-link` | **Nowhere. Removed by AC-1, for both roles.** Named in two spec files as retired so that the suite goes on saying they must not come back |

## Open questions

**1. Two comments outside `allowed_paths` now say something false, and both were left alone.**
RULE-03 forbids the edit and neither is executable, so neither can break a test — but a reviewer
should know they were seen rather than missed:

- `src/components/TopBar.tsx:193-196` — *"the approval worklist shipped with its own link,
  `home-pending-entries-link`, and that link is in the sidebar"*. It is not, since AC-1. The
  reasoning around it still holds and reaches the right conclusion: there is still no second control
  to that address in the top bar.
- `tests/e2e/adm-02-holidays.spec.ts:296-300` — names `home-allow-list-link`,
  `home-team-entries-link` and `home-threshold-link` while explaining why `home-holidays-link` is
  *unlike* them. The contrast it draws is now stronger than when it was written, not weaker.

Both are one-line comment edits for whichever ticket next opens those files. Neither is worth a
fourteenth path in a ticket the operator already accepted as `L` unsplit.

**2. `prettier --check` fails on 9 of the files this ticket touched — and it failed on 20 spec files
before this ticket started.** Measured with `git stash`, on the untouched tree. Prettier is not the
lint gate (`.ai/standards/testing-standards.md` names `pnpm exec eslint .`, which exits 0), and the
new file and `Sidebar.tsx` are both prettier-clean. Reformatting nine shipped spec files wholesale
would bury this ticket's edits under unrelated diff, so it was not done. It is a repository-wide
condition and belongs to whoever decides whether prettier joins the gate.

**3. `ticket.yaml` arrived at `state: BACKLOG` with `gates.plan.passed: false`, while
`01-plan.md`'s front-matter reads `gate: PASS` and `next_state: READY`.** PLAN wrote the plan and the
`size`/`allowed_paths` fields but did not advance the state. This session set `state: REVIEW` and
`gates.plan` from the plan's own front-matter, which is the record; flagged here because the gap is
upstream of this stage and would otherwise read as this session's bookkeeping.

**4. `node scripts/check-docs.mjs` exits 1 with 6 errors, and this ticket caused none of them.**
Measured rather than assumed: `git stash -u`, run on the untouched tree, `errors: 6 warnings: 2
pending: 3` — character for character the same list. All six are in `.ai/registry/features.md`, which
is human plane under RULE-01: five D5 rows where a product ROUTE (`/admin`, `/allow-list`,
`/threshold`, `/members`, `/holidays`) is read as a slash command with no file in
`.claude/commands/`, and one D6 row naming the idea file `.ai/board/model-debt.md` MD-031 already
records as lost. The audit is not in the Definition of Done — MD-031 part (2) is the row that says it
should be — so this is reported rather than treated as a gate failure.
