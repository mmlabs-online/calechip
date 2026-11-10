---
ticket: EVT-14
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-15T14:49:49+0700
inputs_read: [ .ai/board/tickets/EVT-14/01-plan.md, .ai/board/tickets/EVT-14/03-impl-log.md, .ai/board/tickets/EVT-14/ticket.yaml, .ai/registry/invariants.md, .ai/standards/architecture.md, .ai/templates/review-report.md ]
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

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket EVT-14, 9 changed file(s)` … `allowed-paths: PASS` (exit 0). `node scripts/check-carry.mjs EVT-14` → `0 uncommitted path(s)` … `check-carry: PASS — nothing stray` (exit 0). Code paths changed: `src/lib/return-to.ts:1`, `src/App.tsx:7`, `src/routes/GuestEvent.tsx:43`, `tests/return-to.test.ts`, `tests/e2e/evt-14-guest-sign-in.spec.ts` — all five listed in `ticket.yaml` `allowed_paths`; the rest is the ticket folder and `.ai/board/backlog.md` (SHIP_OWNED) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint src/lib/return-to.ts src/App.tsx src/routes/GuestEvent.tsx tests/return-to.test.ts tests/e2e/evt-14-guest-sign-in.spec.ts` → exit 0; repo-wide `pnpm exec eslint .` → exit 0, nothing outside the diff to route |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/lib/return-to.ts:1-42` imports nothing. `src/routes/GuestEvent.tsx:46` still imports only `seam` from `@/lib/data`; the new code (`src/routes/GuestEvent.tsx:189`, `:256-311`) makes no seam call at all. `src/App.tsx:50` imports only `@/lib/return-to`. No `@supabase/*` import added |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | Prompt shown only when signed out on a `ready` page: `src/App.tsx:174` (`signedOut={membership.state === "signed-out"}`) and `src/routes/GuestEvent.tsx:189`. `/signin` still guards a signed-in caller away from the form: `src/App.tsx:189-194`. Return-to only to an in-app path: `src/App.tsx:90` → `src/lib/return-to.ts:31-37`; the target is `/guest/<token>`, never `/events/<id>` (`src/routes/GuestEvent.tsx:280`), so EVT-13's database check is not shortcut. `/signup` link carries no parameter: `src/routes/GuestEvent.tsx:284`. No `rbac-and-security.md` row changes, matching § 3 |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` lists no `package.json` or lockfile. New imports are `react` types (`src/App.tsx:7`), `useSearchParams` from the existing `react-router-dom` (`src/App.tsx:8`) and `Link` from the same (`src/routes/GuestEvent.tsx:44`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `RETURN_TO_PARAM = "next"` | `src/lib/return-to.ts:12` | Yes |
| 4.1 `safeReturnTo(raw: string \| null): string` — exactly one leading `/`, next char not `/` or `\`, no `\`, no U+0000..U+001F / U+007F, no whitespace; no second decode | `src/lib/return-to.ts:31-37`, helper `:16-22` | Yes. Null/empty/non-`/` → `/` (`:32`); `//`, `/\`, any `\` → `/` (`:34`); control/whitespace → `/` (`:35`); value never decoded. `tests/return-to.test.ts` 28/28 pass |
| 4.1 `signInReturningTo(path: string): string` | `src/lib/return-to.ts:40-42` | Yes — `"/signin?next=" + encodeURIComponent(path)` |
| 4.2 `AfterSignIn`, `useSearchParams`, `Navigate … replace` | `src/App.tsx:88-91` | Yes, body as specified, `replace` kept |
| 4.2 `/signin` signed-in arm uses `<AfterSignIn />` | `src/App.tsx:193` | Yes |
| 4.2 `/guest/:token` passes `signedOut`; `useSession` called once | `src/App.tsx:170-177`, `:99` | Yes |
| 4.2 `SignIn.tsx` unchanged | not in `git diff --name-only origin/main...HEAD` | Yes |
| 4.3 `GuestEvent({ signedInMember, signedOut })` | `src/routes/GuestEvent.tsx:131-137` | Yes |
| 4.3 `promptDismissed` component state | `src/routes/GuestEvent.tsx:142` | Yes |
| 4.3 `promptShown = signedOut && state.phase === "ready" && !promptDismissed` | `src/routes/GuestEvent.tsx:189` | Yes, verbatim |
| 4.3 fragment, prompt before `<section>` | `src/routes/GuestEvent.tsx:191-203` | Yes |
| 4.3 join bar `xl:top-6` conditional on `promptShown` | `src/routes/GuestEvent.tsx:228-233` | Yes (`xl:top-24` while shown; § 2b gave no value) |
| 4.3 `GuestAuthPrompt({ token, onDismiss })` | `src/routes/GuestEvent.tsx:256-311` | Yes, plus a private `width` prop (impl-log deviation 1). Additive on a private component, no test id or behaviour changed; it implements § 2b's "same width as the section" |
| 4.3 sign-in `<Link to={signInReturningTo(\`/guest/${token}\`)}>` | `src/routes/GuestEvent.tsx:277-283` | Yes |
| 4.3 sign-up `<Link to="/signup">` | `src/routes/GuestEvent.tsx:284` | Yes |
| 4.3 dismiss `<button type="button">` calling `onDismiss` | `src/routes/GuestEvent.tsx:287-292` | Yes, `aria-label="Dismiss"` |
| 4.4 `guest-auth-prompt` | `src/routes/GuestEvent.tsx:267` | Yes |
| 4.4 `guest-auth-prompt-signin` | `src/routes/GuestEvent.tsx:278` | Yes |
| 4.4 `guest-auth-prompt-signup` | `src/routes/GuestEvent.tsx:284` | Yes |
| 4.4 `guest-auth-prompt-dismiss` | `src/routes/GuestEvent.tsx:288` | Yes |
| 4.4 existing ids frozen | `src/routes/GuestEvent.tsx:217` (`guest-event-not-found`), `:228` (`guest-join-bar`) — `git diff -w` shows only the join bar's `className` changed inside the section | Yes |

## R7 detail

`invariants_touched: []`. Each registry invariant reasoned individually against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Not reachable: the diff creates, edits and reads no entry; no seam call added | `src/routes/GuestEvent.tsx:189-311`, `src/lib/return-to.ts:1-42` — no `seam.*` call |
| INV-02 approval does not survive an edit | Not reachable: no entry is edited | same |
| INV-03 rejection reason | Not reachable: no entry is rejected | same |
| INV-04 absence count | Not reachable: no count is computed or displayed | same |
| INV-05 tentative counts | Not reachable: no count | same |
| INV-06 one portion | Not reachable: no entry written | same |
| INV-07 entry belongs to one member | Not reachable: no entry written; the guest registration path (`src/routes/GuestEvent.tsx:410`) is unchanged | `src/routes/GuestEvent.tsx:410` |

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

Noted, not a finding of this gate: `03-impl-log.md` records `tests/event-email.test.ts:437` failing on
`main` since `be22c3b` (`logo.png?v=2`). Outside this diff and `allowed_paths`; a chore for a human.

## Verdict

`PASS` — the ticket advances to DONE.
