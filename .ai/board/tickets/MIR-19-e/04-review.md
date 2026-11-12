---
ticket: MIR-19-e
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-12T02:58:41Z
inputs_read: [ .ai/board/tickets/MIR-19-e/01-plan.md, .ai/board/tickets/MIR-19-e/03-impl-log.md, .ai/board/tickets/MIR-19-e/ticket.yaml, "git diff origin/main...HEAD", .ai/registry/invariants.md, .ai/registry/decisions/ADR-098-an-email-to-a-member-carries-their-org-code-in-the-request-the-database-posts.md, .ai/standards/architecture.md, supabase/migrations/20261009090000_evt05_event_email.sql, supabase/migrations/20261014090000_evt12_invite_every_scope.sql, supabase/migrations/20261103120000_mir13_write_path_org_bound.sql, supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql ]
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

# MIR-19-e — review

Branch `feat/MIR-19-e`, tree clean at start (`git status --porcelain` empty), HEAD `5dea4b7`.
Every command below was run by this reviewer, one per call.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-19-e, 13 changed file(s)` … `allowed-paths: PASS` (exit 0). `node scripts/check-carry.mjs MIR-19-e` → `0 uncommitted path(s)` … `PASS — nothing stray` (exit 0). The non-ticket paths in the diff are exactly the eight Developer paths plus ADR-098, all at `.ai/board/tickets/MIR-19-e/ticket.yaml:18-27`; the remaining paths are the ticket folder and `.ai/board/backlog.md` (ship-owned) |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` → `eslint .`, exit 0, no output (repo-wide, so the changed lintable files are covered) |
| R4 | Nothing outside the seam reaches the datastore | PASS | The seam is `src/lib/data/` (`.ai/standards/architecture.md:17`). The only `src/` change is inside it (`src/lib/data/system.ts:770`). `supabase/functions/send-event-email/template.ts` has no `import` line at all (grep `^import` returns nothing); the new code there is pure (`template.ts:106-117`). Tests read files with `readFileSync` and never import a client (`tests/system-reserved-org-codes.test.ts:9-12`) |
| R5 | Every § 4 contract item implemented | PASS | See *R5 detail* |
| R6 | Permission gating matches § 3 | PASS | Org code computed from the recipient, never a request parameter: `supabase/migrations/20261112090000_mir19e_email_org_code.sql:52` (`member_org_id(r.id)`), `:148` (`member_org_id(v_member_id)`). Guest gets null: `:166`, and the parser refuses a guest request carrying a string: `template.ts:529`. Sender gains no credential or query: `template.ts` still imports nothing; `index.ts` not in the diff. Functions stay `security definer set search_path = ''` and return `trigger`: migration `:14-15`, `:81-82`. Grants restated unchanged: migration `:191-194`, identical to `20261009090000_evt05_event_email.sql:182,185` and `20261014090000_evt12_invite_every_scope.sql:345-346`. `tasks` refused by the mock mirror: `src/lib/data/system.ts:770` read at `:970-971`; the control (`org_code_not_reserved`) untouched |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:17`). Per-ID reasoning in *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. The only new import in any changed file is `RESERVED_ORG_CODES` from the in-repo `@/lib/org-path` (`tests/system-reserved-org-codes.test.ts:7`) |

### Acceptance evidence (AC-10)

- `pnpm test` → `Test Files 61 passed (61)`, `Tests 1211 passed (1211)`, exit 0. Covers AC-1–AC-7, AC-9
  (`tests/email-org-links.test.ts:92-269`, `tests/nginx-spa-fallback.test.ts:15-41`,
  `tests/system-reserved-org-codes.test.ts:21-31`).
- `pnpm exec playwright test tests/e2e/mir-19-e-reserved-tasks.spec.ts tests/e2e/mir-18-b-org-management.spec.ts`
  → 8 passed, exit 0. AC-8 at `tests/e2e/mir-19-e-reserved-tasks.spec.ts:21-38`.
- `pnpm exec playwright test` (full, 533 tests, 2 workers) → exit 1 with 3 failures; `--last-failed`
  → `tsk-02-overdue-prompt` AC-2 passed, `tsk-01-tasks.spec.ts:279` and `uie-10-sidebar.spec.ts:208`
  failed again; both files rerun with `--workers=1` → 23 passed, exit 0. Neither spec can reach a line
  this diff changes: both drive the member app on the mock member seam (`src/lib/data/mock.ts`, not in
  the diff), and the only `src/` change is the system panel's mock array (`src/lib/data/system.ts:770`).
  The impl log saw a different pair fail and pass on rerun (`03-impl-log.md`, *Verification run*).
  Not charged to this ticket; see *Findings*, note N-1.

### Migration body check (independent of the test)

`diff` of `20261112090000_mir19e_email_org_code.sql:14-76` against
`20261009090000_evt05_event_email.sql:103-…` and of `:81-186` against
`20261014090000_evt12_invite_every_scope.sql:185-…` shows only the four added lines (`:38`, `:52`,
`:148`, `:166`). No later migration redefines either function (grep of `supabase/migrations` for
`function public.email_notification()` / `email_invitation()` finds only EVT-05, EVT-08, EVT-12 and
this file), so the bodies replaced are the live ones.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 one transaction, header, no `drop function` | `supabase/migrations/20261112090000_mir19e_email_org_code.sql:1-9`, `:196` | Yes |
| 4.1 `email_notification()`: `'orgCode', o.org_code` | migration `:38` | Yes, one physical line containing `org` |
| 4.1 `left join public.org o on o.id = public.member_org_id(r.id)` after the actor join | migration `:51-52` | Yes |
| 4.1 `email_invitation()` member branch `orgCode` from `member_org_id(v_member_id)` | migration `:148` | Yes, after `'recipientName'` at `:147` |
| 4.1 guest branch `'orgCode', null::text` | migration `:166` | Yes, after `'recipientName', null::text` at `:165` |
| 4.1 four grant lines last, before `commit;` | migration `:191-196` | Yes, verbatim |
| 4.2 `ORG_CODE_SHAPE` | `supabase/functions/send-event-email/template.ts:41` | Yes, regex verbatim |
| 4.2 `EventEmailRequest.orgCode?: string \| null` | `template.ts:52` | Yes |
| 4.2 `InvitationEmailRequest.orgCode?: string \| null` | `template.ts:499` | Yes |
| 4.2 `readOrgCode(input): string \| null \| undefined \| false` | `template.ts:106-112` | Yes |
| 4.2 `memberBase(appUrl, orgCode): string` | `template.ts:115-117` | Yes |
| 4.2 `parseEventEmailRequest` refuses `false`, conditional spread | `template.ts:138-139`, `:147` | Yes |
| 4.2 `parseInvitationEmailRequest` same, plus guest-with-string → `null` | `template.ts:527-529`, `:539` | Yes |
| 4.2 `renderEventEmail` uses `base` for profile and button; `renderLayout`'s `appUrl` unchanged | `template.ts:294-295`, `:302` | Yes |
| 4.2 `renderInvitationEmail` member branch passes `orgCode` | `template.ts:564` | Yes; guest branch not in the diff |
| 4.2 header paragraph; still imports nothing; `index.ts` not edited | `template.ts:24-28`; no `import`; `index.ts` absent from `git diff --stat` | Yes |
| 4.3 `location /` → `try_files $uri /index.html;`, comment without the literal | `docker/nginx.conf:77-82` | Yes; other blocks unchanged (`:40`, `:48`, `:56-59`, `:63`, `:69`, `:75`) |
| 4.4 `"tasks"` last on its own line; comment replaced; nothing else | `src/lib/data/system.ts:757-758`, `:770` | Yes; diff touches only those lines |
| 4.5 `tests/email-org-links.test.ts` | `tests/email-org-links.test.ts:92-269` | Yes; names start with the AC ID; AC-6 normalisation as specified (`:195-208`) |
| 4.5 `tests/nginx-spa-fallback.test.ts` | `tests/nginx-spa-fallback.test.ts:15-41` | Yes |
| 4.5 `tests/system-reserved-org-codes.test.ts` (read as text, not imported) | `tests/system-reserved-org-codes.test.ts:9-19` | Yes |
| 4.5 `tests/e2e/mir-19-e-reserved-tasks.spec.ts`, sign-in copied not imported | `tests/e2e/mir-19-e-reserved-tasks.spec.ts:10-18`, `:21-38` | Yes |

## R7 detail

`invariants_touched` is `[]`. Each registered invariant (`.ai/registry/invariants.md:33-39`) was
checked against the diff individually.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping portions for one member | Untouched: no entry insert/update path changed. The migration re-creates only two `after insert` trigger functions on `notification` / invitation rows, whose bodies do not read or write `entry` | migration `:14-76`, `:81-186` (no `entry` reference); entry constraints not in the diff |
| INV-02 — an edited approved entry returns to `pending` | Untouched: no entry write path or approval state in the diff | Diff files: `.ai/board/…`, ADR-098, `docker/nginx.conf`, `src/lib/data/system.ts:757-770`, `template.ts`, the migration, four tests |
| INV-03 — rejection carries a reason | Untouched: no rejection path changed. `attendance_rejected` is an event-attendance email kind, not an entry rejection, and its rendering changes only the link base | `template.ts:294-302` |
| INV-04 — one definition of the absence count | Untouched: no count computed or added anywhere; the seam's count function is not in the diff | `src/lib/data/system.ts` change limited to `:757-758`, `:770` |
| INV-05 — tentative counts as non-tentative | Untouched: no count or tentative flag read | as INV-04 |
| INV-06 — one portion per entry | Untouched: no entry shape changed; no `alter table` in the migration | migration `:1-196` contains no `alter table` / `create table` (asserted at `tests/email-org-links.test.ts:210-226`) |
| INV-07 — one member, counted against every team | Untouched: `member_org_id` is only read (`:52`, `:148`), never membership; recipient selection `where` clauses are byte-identical to EVT-05/EVT-12 | migration `:53-57`, `:123-130` |

## Findings

None that fail a check.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| N-1 | — (outside the diff, AC-10 evidence) | The full Playwright suite at 2 workers is not deterministic: this review saw `tsk-01-tasks.spec.ts:279` and `uie-10-sidebar.spec.ts:208` fail twice and pass at `--workers=1`; the impl log saw `mir-19-d-flip` AC-5 and `tsk-02-overdue-prompt` AC-2 fail and pass on rerun. No file this ticket changes is reachable from those specs. Outside `allowed_paths`, so no loop role may fix it | human, as an `OPS-nnn` chore | false |

## Verdict

**PASS.** All eight checks pass; MIR-19-e advances to DONE. The human steps in `01-plan.md` § 6
(apply the migration, redeploy `send-event-email`, the two `TODO(verify)` checks) remain owed after
merge.
