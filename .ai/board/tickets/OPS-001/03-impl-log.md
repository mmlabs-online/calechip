---
ticket: OPS-001
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-03T16:50:13+07:00
inputs_read:
  - .ai/board/tickets/OPS-001/01-plan.md
  - .ai/board/tickets/OPS-001/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - ui-language.json
  - eslint.config.js
  - tests/ui-language.test.ts
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-02-edit-delete-entry.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# OPS-001 — implementation log

Seventy-two lines carrying a Vietnamese diacritic across seven shipped screens became English, and
`copyDebt` lost the seven entries those files had held. Nothing else moved: no selector, no control,
no route, no seam call, no signature, no `.sql` file. Nine files were in `allowed_paths`, nine files
were touched, and none was created — this is the first ticket on this board whose whole output is a
change to the characters inside strings.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/App.tsx` | modified | The two strings the shell renders on every path — the mock-seam banner and the session loading state — were Vietnamese. | §4.1 row 1 |
| `src/routes/Home.tsx` | modified | `roleLabel`, the body line, the two navigation links and the sign-out control, in both its states. | §4.1 row 2 |
| `src/routes/SignIn.tsx` | modified | Heading, password label, submit in both states, and the catch-branch refusal. | §4.1 row 3 |
| `src/routes/SignUp.tsx` | modified | Both headings, four field labels, submit in both states, the avatar `<legend>` and its `aria-label`. | §4.1 row 4, §4.2 |
| `src/routes/NotOnATeam.tsx` | modified | The whole empty state — heading, body and sign-out control. | §4.1 row 5 |
| `src/routes/AllowList.tsx` | modified | Twenty-three lines: headings, table headers, both entry states, the add form, the removal confirmation and two `aria-label`s. | §4.1 row 6, §4.2 |
| `src/routes/MemberList.tsx` | modified | Twenty-five lines: the second `roleLabel`, three view states, table headers, both row controls, the removal confirmation and one `aria-label`. | §4.1 row 7, §4.2 |
| `ui-language.json` | modified | `copyDebt` 12 → 5. Not optional and not deferrable: `tests/ui-language.test.ts` fails a listed entry the moment its file is clean, so translating and de-listing are one commit or neither (§4.4, §8 rejected alternative 3). | §4.4 |
| `tests/e2e/tea-05-sign-in.spec.ts` | modified | The three `home-member-role` assertions read the label at `Home.tsx:29`, so they move with it. The three `home-member-name` assertions two lines away read seed data and did not move. | §4.3 |

## Contract items

Section 4 pins *which strings move and which do not* rather than an entry point or a signature —
RULE-04 has nothing to fix here, because every string written replaces one already in that position
and no name was invented. Section 4.5 hands the wording itself to the implementer; what it binds is
that each string keeps its role and its register.

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 — 72 diacritic lines across seven files | all seven files | Re-measured after the edit with `ui-language.json`'s own pattern: **0 remaining in all seven.** |
| §4.2 — the five accessible names | `SignUp.tsx:124` `<legend>`, `SignUp.tsx:128`, `AllowList.tsx:162`, `AllowList.tsx:271`, `MemberList.tsx:313` | The four `aria-label`s render nothing visible. All five are now inside the lint rule's reach — see the AC-12 probe below. |
| §4.3 — three assertions move, three stay | `tea-05-sign-in.spec.ts:65,146,155` moved | `:63`, `:137`, `:140` (`home-member-name`) untouched, and so are the seed-data comments at `:9-11`. `git diff` on that file is exactly three lines. |
| §4.4 — `copyDebt` loses seven, keeps five | `ui-language.json:20-26` | `userContent`, `diacritic` and `$comment` byte-identical. Nothing added; nothing moved out of `userContent`. |
| §4.5 — role and register preserved | every string | `SignIn.tsx`'s catch-branch refusal stayed deliberately vague — "Sign-in failed. Please try again." names neither an unknown address nor a wrong password, which is TEA-05 AC-2 and a security property carried in a string. `NotOnATeam.tsx` still does not say whether the address is on the allow-list (ADR-009, TEA-01 AC-5): it asks the reader to have an admin *add* the address, which reveals nothing about whether it is already there. |
| §5 — seam impact none | — | No file under `src/lib/data/` was opened. `tests/seam-parity.test.ts` untouched and passing. |
| §6 — schema delta none | — | No `.sql` file of any kind. `supabase/seed.sql` shows no diff. |

**Two comments were corrected rather than left false**, both inside `allowed_paths` and both quoting
a string this ticket changed:

- `src/routes/Home.tsx:23-28` said `MemberList.tsx` *"is not in this ticket's `allowed_paths`"*. It
  was written at TEA-05 and OPS-001 holds both files, so the sentence had become untrue. It now
  records the deliberate decision and cites 01-plan.md §8 rejected alternative 1 and Open questions
  item 1.
- `src/routes/MemberList.tsx:185` quoted the Vietnamese `"Trang này chỉ để xem"` to explain why the
  sentence below it is now conditional. It quotes the English it was replaced with.

Neither is caught by the lint rule — comments are not `Literal`, `TemplateElement` or `JSXText`
nodes — so both are a judgement rather than a mechanism, and they are named here for that reason.

## Deviations from the design

`none`.

## Invariants

`invariants_touched` is `[]`, and 01-plan.md section 2 reaches that rather than defaulting to it.
Restated as the mechanism, because "unaffected" is the sentence that hides a missed case:

| ID | Still holds because |
|----|---------------------|
| — (`[]`) | No file touched reads or writes a row. All seven screens sit above the seam, none is under `src/lib/data/`, none imports the Supabase client, and none contains a query, a policy, a migration or an arithmetic. The two seam files that do carry copy are OPS-002's and were not opened. |
| `INV-03` (nearest, not touched) | It is the only invariant whose subject is text: a rejected entry must carry a non-empty `rejection_reason`. That text is user-authored, and no default for it, no validation of it and no storage of it appears anywhere in this diff. An entry whose reason was typed in Vietnamese satisfies INV-03 exactly as before. |

## Verification run

Commands actually executed, with exit codes.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, per `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | lint, same. The seven files are now **inside** the § Language rule rather than exempt from it. |
| `pnpm exec vitest run` | 0 | 15 tests, 2 files. `tests/ui-language.test.ts` passed **unedited** — AC-10 and AC-11. |
| `pnpm exec playwright test` | 0 | 56 passed. Not in the IN_PROGRESS gate; run because AC-13 claims every shipped suite passes and the claim is cheap to check and expensive to be wrong about. |
| `git diff --name-only` subset of `allowed_paths` | yes | Nine modified files, all nine in `allowed_paths`. The only other dirty paths are the ticket's own folder. |

**AC-12 was verified by probe, not by assertion.** A diacritic was reintroduced into
`src/routes/Home.tsx`'s `roleLabel` and `eslint` exited 1 with the § Language message at `29:69`; the
file was restored and `eslint` exited 0. The seven files were exempt before this ticket and are
guarded after it, which is the ratchet turning.

**AC-9 was verified by diff, not by inspection.** `git diff --stat -- src/lib/fixtures.ts
supabase/seed.sql` is empty. Both files are outside `allowed_paths`, so `guard-allowed-paths.mjs` and
`scripts/check-allowed-paths.mjs` would have refused an edit anyway — but the empty diff is the
evidence rather than the guard's existence.

## Testability contract

No selector changed. Every `data-testid` in the seven files is byte-identical to what shipped, which
is what lets every acceptance suite except `tea-05-sign-in.spec.ts` pass unedited (AC-13). The three
attributes whose *value* is not a selector and did change are the accessible names in §4.2, plus
`AllowList.tsx:162`'s form `aria-label` and `MemberList.tsx:313`'s dialog `aria-label`.

| selector | Exists at |
|----------|-----------|
| `seam-banner` | `src/App.tsx:38` |
| `app-session-loading` | `src/App.tsx:52` |
| `home-member-role` | `src/routes/Home.tsx:56` |
| `home-allow-list-link` | `src/routes/Home.tsx:75` |
| `home-sign-out` | `src/routes/Home.tsx:114` |
| `sign-in-submit` | `src/routes/SignIn.tsx:102` |
| `signup-submit` | `src/routes/SignUp.tsx:159` |
| `signup-avatar-picker` | `src/routes/SignUp.tsx:126` |
| `not-on-a-team-sign-out` | `src/routes/NotOnATeam.tsx:49` |
| `allow-list-refused` | `src/routes/AllowList.tsx:130` |
| `allow-list-remove-confirm` | `src/routes/AllowList.tsx:268` |
| `member-list-remove-confirm` | `src/routes/MemberList.tsx:310` |
| `member-list-row-role` | `src/routes/MemberList.tsx:249` |

## Open questions

1. **`ticket.yaml` still reads `state: BACKLOG` with `gates.plan.passed: false`, and this command did
   not fix that half.** `01-plan.md` carries `gate: PASS` and `next_state: READY`, but the PLAN gate
   was never recorded and the Definition of Ready was never evaluated — that transition belongs to
   `orchestrator` (`.ai/01-operating-model.md:82`), not to the developer. `state` is set to `REVIEW`
   below because this command instructs it; `gates.plan` is deliberately left alone. **It will block
   at `/ship`**, which requires both gates `passed: true`. DoR item 3 is satisfiable now — CAL-03 is
   `DONE`, which is 01-plan.md Open questions item 3.

2. **`backlog.md:46` still shows OPS-001 as `BACKLOG`.** It is a view of `ticket.yaml` and is not in
   `allowed_paths`; the orchestrator owns it. Named so the reviewer does not read the row as a
   contradiction.

3. **`tests/e2e/tea-01-signup.spec.ts:165` now quotes a string that no longer exists** — a comment
   describing an old defect as *"a permanently disabled button reading `Đang gửi…`"*. It is a comment
   in a file outside `allowed_paths`, it asserts nothing and no test depends on it. It is stale
   rather than wrong, and correcting it would require claiming a file this ticket has no reason to
   write. Recorded so the next reader finds it rather than treats it as a missed translation.

4. **The lint rule is scoped `files: ["src/**"]`, so nothing enforces § Language across `tests/`.**
   This ticket translated three assertions there and left three Vietnamese *correctly*, which is
   exactly the judgement no mechanism makes. 01-plan.md Open questions item 2 already routes this to
   `.ai/board/model-debt.md`; repeated here because this log is what the reviewer reads and the
   negative half of §4.3 is the thing worth a second pair of eyes.

5. **`roleLabel` is still defined twice**, at `src/routes/Home.tsx:29` and
   `src/routes/MemberList.tsx:22`, and both now return the same two English strings. Left standing
   deliberately — 01-plan.md §8 rejected alternative 1. This was the one ticket holding both files,
   so the next ticket that wants to fold them must claim two files it otherwise has no reason to
   touch. That cost was weighed at PLAN and accepted.

## Changelog

- `2026-09-03T16:50:13+07:00` — seven screens translated, `copyDebt` 12 → 5, three spec assertions
  moved. typecheck, lint, unit and end-to-end all exit 0. Raised by `developer`.
