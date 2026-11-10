---
ticket: UIE-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-07T15:33:12+07:00
inputs_read:
  - .ai/board/tickets/UIE-03/01-plan.md
  - .ai/board/tickets/UIE-03/03-impl-log.md
  - .ai/board/tickets/UIE-03/ticket.yaml
  - git diff (13 tracked files) and git ls-files --others (2 untracked)
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/01-operating-model.md
  - .ai/standards/testing-standards.md
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-03 — review report

**Isolated dispatch.** Fresh session, files only, no message channel. No Developer was spoken to and
none will be. `chat_before_verdict: none` is true rather than asserted.

All four commands were run **here**, in this tree, rather than read out of `03-impl-log.md`. A
verification table copied from the artifact being judged is not evidence.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | **PASS** | 13 modified + 2 untracked paths, each matching a glob at `.ai/board/tickets/UIE-03/ticket.yaml:55-68`; the only `.ai/` writes are `01-plan.md`, `03-impl-log.md` and `ticket.yaml`, all under `.ai/board/tickets/UIE-03/**` (`ticket.yaml:56`). `tests/e2e/smoke.spec.ts` and `tests/e2e/adm-01-threshold.spec.ts` are absent from the diff, as `01-plan.md` § 1 item 6 and § 4.5’s closing paragraph require |
| R2 | typecheck exit 0 | **PASS** | `pnpm exec tsc --noEmit` — exit 0, run in this tree at 2026-09-07 15:31 +07 (command named at `.ai/standards/testing-standards.md:16`) |
| R3 | lint exit 0 | **PASS** | `pnpm exec eslint .` — exit 0 (`.ai/standards/testing-standards.md:17`). This is also the enforcement of RULE-02 (`eslint.config.js:64-73`) and of § Language (`eslint.config.js:86-92`), so AC-15 is carried by the same run |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | **PASS** | The diff adds and removes no seam import: `git diff -U0 -- src/` contains no `+`/`-` line matching `supabase` or `lib/data`. The four screens keep the seam handle they had — `src/routes/WeekView.tsx:38`, `src/routes/MonthView.tsx:42`, `src/routes/YearView.tsx:43`, `src/routes/Holidays.tsx:44`. The two shell files import no data module at all: `src/components/TopBar.tsx:29-30` imports `react-router-dom` and `@/lib/period`, and `src/lib/period.ts` imports nothing |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | **PASS** | Row-by-row below |
| R6 | Permission gating matches plan section 3 | **PASS** | `01-plan.md:289-298` says nothing changes and nothing does. `src/routes/Holidays.tsx:212` (`mayWrite = me !== null && me.removedAt === null && me.role === "admin"`) is outside the file’s only hunk, the replacement comment at `:469-478`. The four screens' own refusal states are likewise outside every hunk — `src/routes/MonthView.tsx:282` (`month-not-on-a-team`), `:293` (`month-unavailable`). The six deliberately-unguarded routes named at `01-plan.md:300-304`, listed by line at `01-plan.md:122-125` are in files that do not appear in `git diff --name-only` at all, so AC-11 holds by absence |
| R7 | No invariant violated — reasoned per ID (RULE-07) | **PASS** | Row-by-row below |
| R8 | No dependency added without an ADR | **PASS** | `git diff -- package.json pnpm-lock.yaml` is empty. No import of a package not already imported: the only new import edges in the diff are subtractions — `src/routes/MonthView.tsx:70` drops `monthLabel` and `shiftMonth`, `src/routes/YearView.tsx:69` drops `shiftYear`, both from the first-party `@/lib/period` |

## R5 detail

`01-plan.md` numbers its contract as § 4. One row per item.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — the grant is narrow: `TopBar.tsx` and `period.ts` may change test ids and the data attributes beside them, nothing else | `src/components/TopBar.tsx:95`, `:114-118`, `:124`, `:157`; `src/lib/period.ts:249` | Yes. Read against the diff: every `+` line in `TopBar.tsx` is a `data-testid`, one of the three `data-*` attributes, a comment, or the `segments` literal losing its now-computed `testId` field. No `className`, no `to=`, no new element, no removed element. `src/components/TopBar.tsx:82`, `:135`, `:180` are byte-identical to their pre-ticket form |
| § 4.2 — `PeriodNav` gains `anchorValue`; for `week` it is the Monday | declared `src/lib/period.ts:249`; set at `:304` (landing arm), `:327` (`/week/:day`), `:342` (month), `:357` (year) | Yes. Both week arms pass `monday`, the same local the adjacent `prevTo`/`nextTo` step from (`src/lib/period.ts:305-306`, `:328-329`), so no second normalisation exists to disagree with UIE-02's. `PeriodNav` is imported by name nowhere else in `src/` or `tests/`, so this is a one-consumer view-model field and not a shared type module — the XL trigger at `.ai/01-operating-model.md:375` does not engage |
| § 4.3 — anchor id and the three mutually-exclusive attributes | `src/components/TopBar.tsx:114-118` | Yes. `data-testid={`${nav.kind}-anchor`}`; `data-week-start`, `data-month`, `data-year` each guarded on `nav.kind` with `undefined` otherwise, which React omits — so a month anchor carries `data-month` alone. `data-period-kind` kept at `:115` |
| § 4.3 — previous / next | `src/components/TopBar.tsx:95`, `:124` | Yes. `` `${nav.kind}-prev` ``, `` `${nav.kind}-next` ``, both inside the `nav !== null` branch opened at `:89` |
| § 4.3 — switcher segments, `<current>-<target>`, no special case for the active one | `src/components/TopBar.tsx:157` | Yes. `` `${nav.kind}-${segment.kind}` `` over the three segments at `:72-74`. The guard was tightened from `segments.length > 0` to `nav !== null` at `:150` so `nav.kind` narrows without an inference — that is a type-narrowing change, not a rendering one: `segments` is non-empty exactly when `nav !== null` (`:69-75`) |
| § 4.3 — today, create, the bar unchanged | `src/components/TopBar.tsx:135`, `:180`, `:82` | Yes. AC-14 |
| § 4.4 — `WeekView.tsx`: the whole `<header>` goes, nothing below it is touched |  `src/routes/WeekView.tsx:278-286` | Yes. Single hunk. `week-day-holiday`, `week-day-bridge`, `data-day-status` and `data-bridge` are outside it and unmodified, which is AC-10 |
| § 4.4 — `MonthView.tsx`: the navigation goes, `month-threshold` survives with both attributes | `src/routes/MonthView.tsx:315-325` (the comment replacing the six controls), `:330` | Yes. `month-threshold` carries `data-threshold={team.overloadThreshold}` and `data-current-members={active}` at `:330`, unmodified. **The `<header>` wrapper is kept rather than deleted** — § 4.4 wrote "the `<header>` element *may* go with it", so keeping it is inside the permission, and `src/routes/MonthView.tsx:321-325` gives the layout reason (`ml-auto` needs a flex row; the section is a flex column) |
| § 4.4 — `YearView.tsx`: the whole `<header>` goes | `src/routes/YearView.tsx:323-330` | Yes |
| § 4.4 — `Holidays.tsx`: `holidays-back` only; the year controls stay | `src/routes/Holidays.tsx:469-478`; kept at `:272`, `:278` (carrying `data-year`), `:282` | Yes, and this is the departure from `ticket.yaml` § 2 that `01-plan.md:115-121` argues and AC-4 states |
| § 4.4 — any now-unused import removed | `src/routes/MonthView.tsx:70`, `src/routes/YearView.tsx:69` | Yes. `monthLabel`, `shiftMonth`, `shiftYear` gone; `isRealMonth`, `mondayIndex`, `MONTH_ABBR`, `isRealYear` kept because the grid and the route guards still use them. `WeekView.tsx` and `Holidays.tsx` needed none. Lint is the check and it exits 0 |
| § 4.5 — six spec files, each edit a deletion of a click on a dead id | `tests/e2e/cal-04-month-view.spec.ts:87`, `cal-05-week-view.spec.ts:104`, `cal-06-year-view.spec.ts:137` and `:336`, `adm-02-holidays.spec.ts:121-122` and `:280`, `adm-03-holiday-writes.spec.ts:398`, `cal-08-holiday-shading.spec.ts:183`, `:358` and `:478` | Yes for ten of ten clicks. **One file carries a second change and it was declared, not absorbed** — `tests/e2e/cal-04-month-view.spec.ts:96-97` adds `page.goForward()` and a visibility assertion. Checked rather than accepted: `openMonthAs` (`:77-83`) leaves history as `[/month/2026-09, /]` with the cursor on the grid, so the forward step lands on the same landing address the deleted `month-home` click reached, and `switchTo` signs out from where it always signed out from. It is a harness call, not a click on a shell control, so AC-12's last clause holds; the grid's reachability through `backToMonth` (`:68-74`) is "anything that became unreachable only because of" the deleted click, which AC-12's first clause contemplates |
| § 4.5 — `cal-08` in scope for three references and nothing else | `tests/e2e/cal-08-holiday-shading.spec.ts` — three hunks, at `:183`, `:358`, `:478` | Yes. Its `week-anchor`, `week-next`, `month-anchor`, `month-next`, `year-anchor`, `year-prev`, `week-day-holiday` and `week-day-bridge` references are all outside those hunks and unmodified |
| AC-5 — the four dead ids exist nowhere | `grep -rn "week-home\|month-home\|year-home\|holidays-back" src/ tests/` returns nothing (exit 1) | Yes, comments included — each of the four sites describes the removed id without spelling it (`src/routes/WeekView.tsx:279-282`, `src/routes/MonthView.tsx:316-319`, `src/routes/YearView.tsx:323-325`, `src/routes/Holidays.tsx:470-471`) |
| AC-9 — every relocated id resolves to exactly one element | `grep -rn 'data-testid="(week|month|year)-(anchor|prev|next|week|month|year)"' src/` returns nothing (exit 1); the only site computing these names is `src/components/TopBar.tsx` (sole file matching `nav.kind`) | Yes. Playwright resolves `getByTestId` strictly, so 165 green tests over the untouched 83 references is the positive proof |
| § 5 — seam impact none | no `src/lib/data/**` path in `git diff --name-only` | Yes |
| § 6 — schema delta none | nothing under `supabase/` in `git diff --name-only`; `ticket.yaml:69` `schema_delta: none` | Yes |

**Suite state, run here.** `pnpm exec vitest run` — 186 passed, 10 files. `pnpm exec playwright test` —
**165 passed**, whole suite, 23.8s. That is AC-13: the 83 references to relocated ids pass with no edit
to the files holding them, which is the ticket's own evidence that it moved chrome and changed no
behaviour.

## R7 detail

`invariants_touched: []` at `.ai/board/tickets/UIE-03/ticket.yaml:29`. An empty list is a legitimate
answer (`.ai/registry/invariants.md:60`) and it is not a licence to skip the check, so every row in the
ledger is reasoned individually below rather than dismissed as a group.

**The structural fact all seven rest on, verified against the diff and not quoted from the plan:** no
path under `src/lib/data/` appears in `git diff --name-only`; no `+` or `-` line in `src/` mentions
`supabase` or `lib/data`; and the four screens make exactly the seam calls they made before
(`src/routes/WeekView.tsx:38`, `src/routes/MonthView.tsx:42,53,58`, `src/routes/YearView.tsx:43,52,56`,
`src/routes/Holidays.tsx:44`, all outside every hunk).

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no two entries of one member overlapping the same portion of a date | Untouched. Overlap is decided in the seam and in the entry form, neither of which is in scope. The diff writes no `entry` row and opens no file that does | `git diff --name-only` contains no `src/lib/data/**` and no `src/routes/NewEntry.tsx` / `EditEntry.tsx` |
| INV-02 — an approved entry whose substance changes returns to `pending` | Untouched. No approval state is read or written anywhere in the diff | `grep` over the diff finds no `approved`, `pending` or `status` write; the four hunks in `src/routes/` delete chrome markup only |
| INV-03 — a rejected entry carries a non-empty reason | Untouched. Rejection is ADM-05's surface and no file of it is in `allowed_paths` | `.ai/board/tickets/UIE-03/ticket.yaml:55-68` |
| INV-04 — one definition of the absence count | Held, and this is the one row with a real surface here. `MonthView.tsx` still reads `team.overloadThreshold` and the active roster count and publishes both unchanged; the count itself is computed in `@/lib/data/absence`, which is neither opened nor re-imported | `src/routes/MonthView.tsx:330` (`data-threshold`, `data-current-members` intact), `:53` (`@/lib/data/absence` import unchanged). The deleted header carried no arithmetic — it held `month-home`, `month-prev`, `month-anchor`, `month-next`, `month-week`, `month-year` and nothing else. The top bar computes no count: `src/lib/period.ts` is pure date arithmetic over the URL and imports nothing |
| INV-05 — a tentative entry counts as a non-tentative one does | Untouched. Same reasoning as INV-04, one level down: the diff adds no counting path in which tentativeness could be treated differently | `src/lib/period.ts:249` is a `string` anchor derived from the pathname; no entry is read there |
| INV-06 — one portion per entry, applied to every date in its range | Untouched. No entry shape is constructed or destructured in the diff | no `portion` token appears on any `+` or `-` line of the diff |
| INV-07 — every entry belongs to one member and counts against that member's team | Untouched. No membership or team scoping is read, written or moved | `src/routes/Holidays.tsx:212`'s membership read is outside the file’s only hunk, the replacement comment at `:469-478` |

No invariant here is held only by a UI affordance: each is held because the code that could violate it
is not in the diff, which is checkable rather than asserted.

## Findings

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | None. R1 through R8 pass | — | — |

## Verdict

**PASS.** The ticket advances to `DONE` (`.ai/01-operating-model.md:36`), where `/ship` builds, commits
and opens the pull request.

**What this reviewer checked hardest, because it is where the ticket could have lied.** The change is a
deletion, and a deletion that passes its suite can pass by having deleted the assertions too. It did
not: five of the six spec files lose exactly one line each and gain only a comment, the sixth loses
three, and the 83 references to the relocated ids were not edited at all — they pass because
`src/components/TopBar.tsx:114-118` and `:157` now carry the names and the attributes the four deleted
headers carried. `tests/e2e/adm-01-threshold.spec.ts` and `tests/e2e/smoke.spec.ts` never entered the
diff.

**The plan's two widenings are legitimate and were verified against their source, not taken on trust.**
`src/components/TopBar.tsx` and `src/lib/period.ts` sit outside `ticket.yaml` § 7's out-of-scope list;
`01-plan.md` § 4.1 takes the grant from UIE-02's own `01-plan.md` § 4.8, which named UIE-03 as the
ticket that may move those ids. The grant is narrow and the diff stays inside it — no layout, styling,
navigation target or control changed in either file.
