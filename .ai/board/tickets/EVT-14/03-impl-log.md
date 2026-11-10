---
ticket: EVT-14
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-15T14:29:44+0700
inputs_read:
  - .ai/board/tickets/EVT-14/01-plan.md
  - .ai/board/tickets/EVT-14/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - src/App.tsx
  - src/routes/GuestEvent.tsx
  - src/components/Modal.tsx
  - src/lib/fixtures.ts
  - tests/e2e/evt-06-guest-link.spec.ts
  - tests/e2e/uie-12-sticky-join.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-14 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/return-to.ts` | created | The one place the return-to's name and its open-redirect rule live, pure so it is unit-testable | § 4.1 |
| `src/App.tsx` | modified | `/signin`'s signed-in arm honours `?next=` through `safeReturnTo`; the guest route passes `signedOut` | § 4.2 |
| `src/routes/GuestEvent.tsx` | modified | The prompt, its dismissal state, and the join bar's `xl` offset while the prompt is shown | § 4.3, § 4.4, § 2b |
| `tests/return-to.test.ts` | created | AC-9's refusal list value by value, AC-7's address, and the round trip through `URLSearchParams` | § 4.1 |
| `tests/e2e/evt-14-guest-sign-in.spec.ts` | created | AC-1..AC-12 as a person sees them, at AC-5's two viewports | § 2, § 4.4 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `RETURN_TO_PARAM` | `src/lib/return-to.ts:12` | `"next"` |
| 4.1 `safeReturnTo` | `src/lib/return-to.ts:31` | Control/whitespace check is a code-point loop, not a regex class: `no-control-regex` refuses `\u0000` in a character class |
| 4.1 `signInReturningTo` | `src/lib/return-to.ts:40` | |
| 4.2 `AfterSignIn` | `src/App.tsx:88`, used at `src/App.tsx:193` | Exactly the plan's body, `replace` kept. `import type { JSX } from "react"` added: `App.tsx` imported nothing from `react` before |
| 4.2 `signedOut` prop | `src/App.tsx:174` | `useSession` still called once |
| 4.3 `GuestEvent` props | `src/routes/GuestEvent.tsx:136` | |
| 4.3 `promptDismissed` | `src/routes/GuestEvent.tsx:142` | Component state only |
| 4.3 `promptShown` | `src/routes/GuestEvent.tsx:189` | Exactly the plan's expression |
| 4.3 fragment, prompt before `<section>` | `src/routes/GuestEvent.tsx:196` | |
| 4.3 join bar `xl:top-*` conditional | `src/routes/GuestEvent.tsx:232` | See Deviations for the value |
| 4.3 `GuestAuthPrompt` | `src/routes/GuestEvent.tsx:256` | One extra prop, `width` — see Deviations |

## Deviations from the design

1. **`GuestAuthPrompt` takes a third prop, `width`**, beyond § 4.3's `{ token, onDismiss }`. § 2b says
   the prompt is "same width as the section", and the section's width depends on `barShown`
   (`max-w-xl` alone when there is no join bar, `xl:max-w-[55.5rem]` only with one). Passing the
   class string is the smallest way to keep the two edges aligned in both cases; the alternative,
   always `xl:max-w-[55.5rem]`, would make the prompt wider than a single-column page. Private
   component, no test id or behaviour affected.
2. **The join bar's offset while the prompt is shown is `xl:top-24` (6 rem).** § 2b says "below the
   prompt" without a value. The prompt is one line at `xl` and measures about 4 rem stuck at
   `top-0`; 6 rem clears it with about 2 rem to spare. AC-4's non-overlap is asserted at 1440 × 900 in the e2e spec.
3. **The dismiss button draws its `×` as an inline SVG**, copied from `Modal.tsx:61-75`, not as the
   character § 2b names. A typed U+00D7 fails the § Language lint rule (`eslint.config.js`), as
   `Modal.tsx`'s own comment records. Same glyph, `aria-label="Dismiss"` as specified.
4. **The prompt's root is an `<aside aria-label="Sign in or sign up">`** — § 2b names the classes,
   not the element. A landmark so a screen-reader user can find or skip it.
5. **The `<section>` in `GuestEvent` is re-indented by two spaces** because it now sits inside a
   fragment (§ 4.3). The diff of `GuestEvent.tsx` is large for that reason; no line inside it changed
   except the join bar's `className`. `git diff -w` shows the real change.

## Invariants

`invariants_touched: []`. INV-01..INV-07 concern entries and the absence count; this ticket reads
and writes neither — no seam call is added, changed or made anew (§ 5).

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 1 | 770 / 771. `tests/return-to.test.ts` 28 / 28. **The one failure is `tests/event-email.test.ts:437`**, which expects `logo.png` while `supabase/functions/send-event-email/template.ts` now emits `logo.png?v=2` since `be22c3b` (2026-10-15, `chore(email)`, on `main` before this branch). Neither file is in `allowed_paths`; not touched (RULE-03) |
| `pnpm exec playwright test tests/e2e/evt-14-guest-sign-in.spec.ts` | 0 | 20 / 20 incl. the seam-guard setup |
| `pnpm exec playwright test` on `evt-06-guest-link`, `uie-12-sticky-join`, `tea-05-sign-in`, `tea-01-signup`, `smoke` | 0 | 41 / 41 — the guest page, the join bar and `/signin` unchanged for their own criteria |
| `git status --porcelain` subset of `allowed_paths` | yes | plus this file, in the ticket folder |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `guest-auth-prompt` | `src/routes/GuestEvent.tsx:267` |
| `guest-auth-prompt-signin` | `src/routes/GuestEvent.tsx:278` |
| `guest-auth-prompt-signup` | `src/routes/GuestEvent.tsx:284` |
| `guest-auth-prompt-dismiss` | `src/routes/GuestEvent.tsx:288` |

No existing `guest-*`, `sign-in-*`, `sign-up-*` or `auth-*` id was renamed or moved.

## How each criterion is asserted

| AC | Where |
|----|-------|
| AC-1 | e2e "AC-1" |
| AC-2 | e2e "AC-2" ×2 — an approved member outside a team-scoped event (asserting the `data-testid` list differs by the prompt only), and a member-less session. **A pending sign-up is not driven**: no fixture credential signs in as one (`FIXTURE_PENDING_SIGNUP` has no row in `FIXTURE_CREDENTIALS`). The code path is the same — any state but `signed-out` gives `signedOut=false` (`App.tsx:174`) |
| AC-3 | e2e "AC-3" ×2 — not-found and manage page. The loading state is not asserted in the browser (the mock resolves too fast to observe); `promptShown` requires `state.phase === "ready"` (`GuestEvent.tsx:189`) |
| AC-4 | e2e "AC-4, AC-5" — no prompt control intersects the bar or its controls, at both ends, both viewports; then a registration succeeds with the prompt shown |
| AC-5 | e2e "AC-4, AC-5" — both links in view at both ends, prompt `y ≤ 1` at the foot, 390 × 844 and 1440 × 900 |
| AC-6 | e2e "AC-6" — storage, cookie and URL snapshot identical; rest of the page's test ids unchanged; shown again after a remount. **A real reload is not driven**: `page.goto`/`reload` empties the mock datastore and the token with it (recorded in the spec header) |
| AC-7 | e2e "AC-7, AC-8" — URL is `/signin?next=%2Fguest%2F<token>`; unit "signInReturningTo" |
| AC-8 | e2e "AC-7, AC-8" (reader → `/events/<id>`, Back shows no sign-in screen), "AC-8" ×2 (outside the audience, member-less → `/guest/<token>` without the prompt) |
| AC-9 | unit, every listed value and the boundaries; e2e, five hostile shapes land on `/` on this origin, and an in-app `next` is honoured |
| AC-10 | e2e "AC-10"; `tea-05-sign-in.spec.ts` passes unchanged |
| AC-11 | e2e "AC-11" |
| AC-12 | e2e "AC-12" (no app nav, two links in the prompt, meta tags present) and "AC-7, AC-8" (meta tags gone on `/signin`) |

## Open questions

None.
