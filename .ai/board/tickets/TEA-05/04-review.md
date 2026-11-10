---
ticket: TEA-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-03T09:47:46+07:00   # cycle 2; cycle 1 was 2026-09-01T15:18:50+07:00
inputs_read:
  - .ai/board/tickets/TEA-05/01-plan.md
  - .ai/board/tickets/TEA-05/03-impl-log.md
  - .ai/board/tickets/TEA-05/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/01-operating-model.md
  - git diff origin/main...HEAD, and the uncommitted working tree
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# Cycle 1 — 2026-09-01. Kept verbatim.

**Appended, not rewritten.** Everything between here and *Cycle 2* is the first pass as it stood on
2026-09-01, including its nine-item numbering and its `mock.ts` line citations, both of which have
since moved. The front-matter above now carries cycle 2's verdict, which is the record.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | [.ai/board/tickets/TEA-05/ticket.yaml:41-53](file:///Users/mpa/Downloads/aifw-template/.ai/board/tickets/TEA-05/ticket.yaml#L41-L53); `scripts/check-allowed-paths.mjs` exits 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | [src/hooks/useSession.ts:16](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L16); [src/App.tsx:8-9](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L8-L9); [eslint.config.js:30-55](file:///Users/mpa/Downloads/aifw-template/eslint.config.js#L30-L55) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | [src/lib/domain/types.ts:42,62](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts#L42-L62); [src/lib/data/index.ts:27,167,184,194,201](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L27-L201); [src/lib/data/supabase.ts:446,463,480,493](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L446-L493); [src/lib/data/mock.ts:407,418,440,474](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L407-L474); [src/hooks/useSession.ts:19-88](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L19-L88); [src/routes/SignIn.tsx:22-118](file:///Users/mpa/Downloads/aifw-template/src/routes/SignIn.tsx#L22-L118); [src/routes/NotOnATeam.tsx:20-59](file:///Users/mpa/Downloads/aifw-template/src/routes/NotOnATeam.tsx#L20-L59); [src/routes/Home.tsx:28-89](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L28-L89); [src/App.tsx:23,44-110](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L23-L110) |
| R6 | Permission gating matches plan section 3 | PASS | [src/App.tsx:67,87](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L67-L87); [src/routes/Home.tsx:70-76](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L70-L76); [src/lib/data/supabase.ts:480-488](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L480-L488) |
| R7 | Every test selector in plan section 8 exists in the markup | PASS | [src/App.tsx:27,35,49](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L27-L49); [src/routes/SignIn.tsx:72,85,96,102](file:///Users/mpa/Downloads/aifw-template/src/routes/SignIn.tsx#L72-L102); [src/routes/NotOnATeam.tsx:37,49](file:///Users/mpa/Downloads/aifw-template/src/routes/NotOnATeam.tsx#L37-L49); [src/routes/Home.tsx:46,50,53,72,79](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L46-L79); [src/routes/MemberList.tsx:235](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L235) |
| R8 | No invariant violated (RULE-07) | PASS | INV-04 verified; see detail below |
| R9 | No dependency added without an ADR | PASS | [package.json:1-47](file:///Users/mpa/Downloads/aifw-template/package.json#L1-L47) untouched in diff |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 `Membership` three-state union | [src/lib/domain/types.ts:42-45](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts#L42-L45) | Yes |
| §4.1 `email_not_confirmed` FailureCode | [src/lib/domain/types.ts:62](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts#L62) | Yes |
| §4.1 No other types changed | [src/lib/domain/types.ts](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts) | Yes |
| §4.2 `SignInInput` interface | [src/lib/data/index.ts:27](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L27) | Yes |
| §4.2 `getSession(): Promise<Session \| null>` (DataSeam) | [src/lib/data/index.ts:167](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L167) | Yes |
| §4.2 `getSession` (Supabase seam) | [src/lib/data/supabase.ts:446](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L446) | Yes |
| §4.2 `getSession` (Mock seam) | [src/lib/data/mock.ts:407](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L407) | Yes |
| §4.2 `onAuthStateChange(listener: (session: Session \| null) => void): () => void` (DataSeam) | [src/lib/data/index.ts:184](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L184) | Yes |
| §4.2 `onAuthStateChange` (Supabase seam) | [src/lib/data/supabase.ts:463](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L463) | Yes |
| §4.2 `onAuthStateChange` (Mock seam) | [src/lib/data/mock.ts:418](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L418) | Yes |
| §4.2 `signIn(input: SignInInput): Promise<Result<Session>>` (DataSeam) | [src/lib/data/index.ts:194](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L194) | Yes |
| §4.2 `signIn` (Supabase seam) | [src/lib/data/supabase.ts:480](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L480) | Yes |
| §4.2 `signIn` (Mock seam) | [src/lib/data/mock.ts:440](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L440) | Yes |
| §4.2 `signOut(): Promise<Result<void>>` (DataSeam) | [src/lib/data/index.ts:201](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L201) | Yes |
| §4.2 `signOut` (Supabase seam) | [src/lib/data/supabase.ts:493](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L493) | Yes |
| §4.2 `signOut` (Mock seam) | [src/lib/data/mock.ts:474](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L474) | Yes |
| §4.3 `SessionState` interface & `useSession()` hook | [src/hooks/useSession.ts:19,33](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L19-L33) | Yes |
| §4.3 Resolution order & cleanup | [src/hooks/useSession.ts:47-88](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L47-L88) | Yes |
| §4.3 `useSession` called once in `App.tsx`, passed as props | [src/App.tsx:23](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L23) | Yes |
| §4.4 `SignIn.tsx` | [src/routes/SignIn.tsx:22-118](file:///Users/mpa/Downloads/aifw-template/src/routes/SignIn.tsx#L22-L118) | Yes |
| §4.4 `NotOnATeam.tsx` | [src/routes/NotOnATeam.tsx:20-59](file:///Users/mpa/Downloads/aifw-template/src/routes/NotOnATeam.tsx#L20-L59) | Yes |
| §4.4 `Home.tsx` | [src/routes/Home.tsx:28-89](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L28-L89) | Yes |
| §4.4 Routing table in `App.tsx` | [src/App.tsx:44-110](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L44-L110) | Yes |

## R8 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | Nothing in this ticket writes `public.member` on any path. `signIn` and `signOut` touch authentication only. Presenting `NotOnATeam` creates no member row (AC-11). The sole writer of `public.member` remains the `admit_allow_listed_member` trigger on `auth.users` firing on confirmation. The denominator cannot move. | [src/lib/data/supabase.ts:480-488](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L480-L488); [src/lib/data/mock.ts:440-470](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L440-L470) |

## Findings

None. All checks pass.

## Verdict

`PASS`. Under ADR-021 re-arming the QA stage, `next_state` is `QA`.

---

# Cycle 2 — 2026-09-03. Re-review after the AC-7 fix

**Fresh session, files only, no message channel (RULE-13).** Nothing was inherited from the pass
above; it was read as an input artifact, not recalled. `chat_before_verdict: none` is truthful.

**What is under review.** The whole ticket diff, not only the delta — `origin/main...HEAD` (18 files)
plus the uncommitted working tree (`src/lib/data/mock.ts`, `.ai/board/tickets/TEA-05/03-impl-log.md`).
`origin/main` is the merge base at `a446536`, so BUG-001 is in the baseline rather than in this diff.

**Renumbered to R1-R8.** Cycle 1 ran a nine-item checklist in which R7 was the selector table, R8 the
invariants and R9 the dependencies. ADR-022 removed the QA stage and with it the selector check, and
`.ai/01-operating-model.md:123-134` now carries eight items in which **R7 is the invariants** and R8
the dependencies. This pass uses the eight. The selector table is not dropped silently — it is
re-checked under R5, because `01-plan.md` section 8 is a contract item of the plan.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `node scripts/check-allowed-paths.mjs` exit 0, "ticket TEA-05, 18 changed file(s) … PASS"; the twelve globs at `.ai/board/tickets/TEA-05/ticket.yaml:41-53`. The six non-source paths are this ticket's own folder. `tests/e2e/tea-05-sign-in.spec.ts` is inside the globs; `playwright.config.ts` and `tests/e2e/seam.setup.ts` are BUG-001's and are in the baseline, not the diff. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0, run in this session |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` exit 0, run in this session. The RULE-02 rule is live at `eslint.config.js:31-50`. |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `grep -rn "@supabase" src/ \| grep -v "^src/lib/data/"` returns one hit and it is a comment naming a version: `src/lib/domain/types.ts:61`. The two files that could have crossed go through the one door: `src/hooks/useSession.ts:16` imports `@/lib/data`, `src/App.tsx:8` imports `./lib/data`. Cycle 2's `localStorage` use is *inside* the mock implementation (`src/lib/data/mock.ts:118-177`) and above nothing. |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | Row per item below. |
| R6 | Permission gating matches plan section 3 | PASS | Row per denial below. |
| R7 | No invariant violated — INV-04 (RULE-07) | PASS | Reasoned per ID below. |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD --name-only -- package.json pnpm-lock.yaml` is empty, and so is the working-tree diff for both. No import of a package not already present; the cycle-2 fix uses the platform `localStorage` and `JSON`, not a library. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 `Membership` three-state union | `src/lib/domain/types.ts:42-45` | Yes — three arms and payloads verbatim |
| §4.1 `email_not_confirmed` added to `FailureCode` | `src/lib/domain/types.ts:62` | Yes |
| §4.1 no other type changes | `Member`, `AuthUser`, `Session`, `Result` unchanged in `src/lib/domain/types.ts`; no existing caller edited | Yes |
| §4.2 `SignInInput` | `src/lib/data/index.ts:27-30` | Yes |
| §4.2 `getSession(): Promise<Session \| null>` — seam / real / mock | `src/lib/data/index.ts:167`, `src/lib/data/supabase.ts:446`, `src/lib/data/mock.ts:485` | Yes |
| §4.2 `onAuthStateChange(listener): () => void` — seam / real / mock | `src/lib/data/index.ts:184`, `src/lib/data/supabase.ts:463`, `src/lib/data/mock.ts:496` | Yes, and the listener takes `Session \| null`; the library event is dropped at `src/lib/data/supabase.ts:464` |
| §4.2 `signIn(input): Promise<Result<Session>>` — seam / real / mock | `src/lib/data/index.ts:194`, `src/lib/data/supabase.ts:480`, `src/lib/data/mock.ts:518` | Yes. Neither implementation looks the address up before checking the password, so neither can become an enumeration oracle: `supabase.ts:481` calls `signInWithPassword` directly, `mock.ts:519-528` collapses unknown address and wrong password into one `invalid_credentials` return |
| §4.2 `signOut(): Promise<Result<void>>` — seam / real / mock | `src/lib/data/index.ts:201`, `src/lib/data/supabase.ts:493`, `src/lib/data/mock.ts:552` | Yes |
| §4.3 `SessionState` and `useSession()` | `src/hooks/useSession.ts:19-31`, `:33` | Yes, including `resolving` |
| §4.3 resolution order 1→2→3 | `src/hooks/useSession.ts:52` then `:57`, member-less at `:60`, member at `:59` | Yes |
| §4.3 `resolving` false after the first resolution and thereafter | `src/hooks/useSession.ts:72` | Yes |
| §4.3 subscription created in an effect, unsubscribe called on cleanup | `src/hooks/useSession.ts:77`, `:86` | Yes |
| §4.3 `useSession()` called exactly once, result passed as props | `src/App.tsx:23`; `grep -rn "useSession(" src/` returns the definition and this one call site | Yes |
| §4.4 `SignIn.tsx` — fields, one error line, no navigation of its own | `src/routes/SignIn.tsx:22`, error at `:95-99` (`data-testid` at `:96`); no `Navigate`/`useNavigate` in the file | Yes |
| §4.4 `NotOnATeam.tsx` — says signed-in and not on a team, says nothing about the allow-list, carries sign-out | `src/routes/NotOnATeam.tsx:35-56`; the copy at `:39-43` names no allow-list status | Yes |
| §4.4 `Home.tsx` — own `display_name`, `avatar`, `role`, sign-out, admin-only link | `src/routes/Home.tsx:46`, `:50`, `:53`, `:78-84`, `:71-75` | Yes |
| §4.4 routing table, four columns × three states | `src/App.tsx:59` (`/signup` in every state), `:65-72` (`/signin`), `:80-89` (`/`), `:109` (catch-all `→ /`) | Yes |
| §4.4 `resolving` shown on every path | `src/App.tsx:48-55` | Yes |
| §4.4 `app-root` and `seam-banner` keep names and positions | `src/App.tsx:27` (wrapping `<Routes>`), `:35` | Yes — `tests/e2e/smoke.spec.ts` passes unedited |
| §4.4 `/allow-list` and `/members` left unguarded | `src/App.tsx:100`, `:103`; neither route file is in the diff | Yes |
| §5 four functions in `DataSeam` and both implementations, same name and arity | `tests/seam-parity.test.ts` passes **unedited** — `pnpm exec vitest run` exit 0, 2 tests | Yes |
| §5 no existing seam function changed | the eight prior functions are untouched in the diff; `getCurrentMember` is called from `src/hooks/useSession.ts:57` exactly as `AllowList.tsx` and `MemberList.tsx` already call it | Yes |
| §5 the mock's five rows of behaviour | `src/lib/data/mock.ts:518-556`, in the table's order | Yes |
| §5 expiry not modelled in the mock | `src/lib/data/mock.ts:487-495`, stated at the call site | Yes |
| §5 `__setCurrentMember` kept, now redundant | `src/lib/data/mock.ts:194` | Yes |
| §5.1 `FIXTURE_MEMBER_LESS`, `FIXTURE_CREDENTIALS` | `src/lib/fixtures.ts:157`, `:220` | Yes |
| §5.1 `FIXTURE_MEMBER` seed drift repaired | `supabase/seed.sql` gains an `auth.users` row and the `public.member` row for `5555…` | Yes |
| §5.1 MD-014's four token columns set to `''` on every new account | `supabase/seed.sql`, all three new `auth.users` inserts | Yes |
| §6 `schema_delta: none` condition discharged | `src/routes/Home.tsx` reads no `public.team` — `grep -in "team" src/routes/Home.tsx` returns four comment lines and one Vietnamese string, no query; `git diff origin/main...HEAD --name-only -- supabase/migrations/` is empty | Yes |
| §8 the twelve selectors exist in the markup | `src/App.tsx:27`, `:35`, `:49`; `src/routes/SignIn.tsx:72`, `:85`, `:96`, `:102`; `src/routes/NotOnATeam.tsx:37`, `:49`; `src/routes/Home.tsx:46`, `:50`, `:53`, `:72`, `:79`; `src/routes/MemberList.tsx:235` | Yes, and nothing beyond the table was added |
| **Cycle 2 — §5 / AC-7: `getSession` after `signIn` and before `signOut` returns the session** | `src/lib/data/mock.ts:118`, `:124-175`, `:179`, `:184`, `:209` | Yes. A reload sits inside that window, so this is the plan's own row being met rather than a behaviour added to it — no plan change is owed and none was made. The store is guarded three ways and each guard was checked: absent or throwing `localStorage` returns `null` (`:124-130`), so `tests/seam-parity.test.ts` still imports the module under the vitest `node` environment; the stored value is shape-checked field by field rather than cast (`:135-162`), so a hand-edited entry lands on the sign-in screen; and a failed write is swallowed (`:164-175`), so a blocked store costs persistence and not the sign-in. The key is the mock's own, `calechip.mock.session`, which the real client never reads. |
| **Cycle 2 — AC-6 still ends the session** | `src/lib/data/mock.ts:203-213` | Yes. `signOut` passes `null` through the one `setSession`, which removes the stored copy in the same call that clears the in-memory one — the shared-machine gap AC-6 exists to close is not reopened by adding persistence. |

## R7 detail

**One row per ID in `invariants_touched`.**

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — the absence count has one definition | **No write path to `public.member` exists in this ticket, on any branch, in either implementation.** In the real seam the four `from("member")` statements are two reads and TEA-04's two updates (`src/lib/data/supabase.ts:96`, `:334`, `:388-389` `removed_at`, `:417-418` `role`); the only `.insert` in the file is on `allowed_email` (`:263-264`), TEA-02's. The two functions this ticket adds there touch `auth` only (`src/lib/data/supabase.ts:481`, `:494`). In the mock the sole `members.push` is inside `signUp` (`src/lib/data/mock.ts:244`, push at `:261`), which is TEA-01's admission trigger reproduced; `signIn` returns on one of three branches (`src/lib/data/mock.ts:518-546`) and names `members` on none of them, so a refused sign-in, a successful one, and a sign-in by somebody with no member row all leave the array identical. Cycle 2 changed nothing here: `setSession` (`src/lib/data/mock.ts:203-213`) writes `currentSession`, `currentMemberId` and the browser store, and no row. The sole writer of the table remains the `admit_allow_listed_member` trigger on `auth.users`, and `supabase/migrations/` is untouched. The ticket computes no count and creates no row, so the denominator cannot move. **This is a mechanism, not a UI affordance**: the control is the absent write path and the missing insert policy, not the fact that no screen offers the action. | as cited |

**INV-01, INV-02, INV-03, INV-05, INV-06** constrain `entry` rows and `entry` does not exist yet
(CAL-01 creates it). **INV-07** binds an entry to one member's team; this ticket fixes no membership
and reads what TEA-01's trigger already wrote. The plan argues both exclusions at
`01-plan.md:233-238` and the argument holds against the diff.

## Findings

None. All eight checks pass.

## Verdict

`PASS`. ADR-022 removed the QA stage, so the lifecycle at `.ai/01-operating-model.md:36` runs
`IN_PROGRESS -> REVIEW -> DONE` and `next_state` is `DONE`. The `qa` gate row still present in
`ticket.yaml` is a shell that predates that ADR; grading it is the orchestrator's, not this
artifact's.

**Two things that are true and are not findings**, recorded because a later reader will meet both and
should not have to re-derive that they were seen:

1. **Cycle 1's `mock.ts` line citations no longer resolve.** The cycle-2 fix inserted roughly eighty
   lines above the TEA-05 block, so `03-impl-log.md`'s cycle-1 rows and this artifact's cycle-1 table
   point at TEA-04's code — `mock.ts:407` is now inside `removeMember`. Both documents declare
   themselves append-only records of the day they were written, and the citations above are this
   pass's own, read from the file in this session. It is a cost of the additive rule, not a defect in
   the implementation, and no check covers it.
2. **`tests/e2e/tea-05-sign-in.spec.ts` was written by the `qa` role, which ADR-022 abolished.** The
   file is inside `allowed_paths`, it was not edited in cycle 2, and the suite passes on a plain
   `pnpm exec playwright test` — 21 tests, exit 0, verified in this session. Reviewing it is not an
   R-check and it is not reviewed here; it is named so that its provenance is on the record before
   `/ship`.

**AC-3 and AC-8 remain unobserved against a real Supabase project**, exactly as `01-plan.md` section
8.1 says, and MD-014 is the standing proof that the difference is not theoretical. That is the plan's
own declared limit rather than a gap this implementation opened, so it is not a finding — but it is
the sentence to read before treating a green suite as coverage of Supabase Auth.
