---
ticket: EVT-13
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-15T08:08:10+0700
inputs_read:
  - .ai/board/tickets/EVT-13/01-plan.md
  - .ai/board/tickets/EVT-13/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/impl-log.md
consulted:
  - with: tech-lead-design
    asked: "Q1 (99-questions.md): evt-10-description.spec.ts and evt-11-description-pictures.spec.ts open the guest page signed in as the creator, who AC-1 now redirects — 5 tests fail. Add both paths to allowed_paths?"
    answer: "Agreed. Both added to 01-plan.md § 7 and ticket.yaml. Sign out before each guest-surface navigate; change no assertion; do not switch the driver to a non-reader."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-13 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql` | created | The client cannot map a token to an event without a definer read gated on `may_read_event` | § 4.1 |
| `src/lib/data/index.ts` | modified | `getGuestLinkEventId` added to `DataSeam` under an EVT-13 banner after EVT-07's functions | § 4.2 |
| `src/lib/data/supabase.ts` | modified | Real implementation: pattern check, then `rpc("guest_link_event_id")` | § 4.2 |
| `src/lib/data/mock.ts` | modified | Mock reproduces the function: `guestEventId` then `mayReadEvent`, no await between | § 4.2 |
| `src/App.tsx` | modified | `/guest/:token` passes `signedInMember`; comment says what is now true | § 4.3 |
| `src/routes/GuestEvent.tsx` | modified | Load effect asks for an approved member and redirects a reader with `replace: true`; header paragraph rewritten | § 4.3 |
| `.ai/standards/rbac-and-security.md` | modified | § 3 row for the new read, and the not-granted-to-`anon` sentence in *Signed out* | § 7 standards |
| `tests/guest-link.test.ts` | modified | § 3's denials through the mock, and the migration's shape | § 3, § 7 |
| `tests/e2e/evt-06-guest-link.spec.ts` | modified | AC-16 journey becomes the redirect (AC-1) and a non-reader case (AC-3); AC-10 asserted signed out; AC-5's reopened link opened signed out | § 7 |
| `tests/e2e/evt-07-guest-registration.spec.ts` | modified | AC-4/5 and AC-17 register as a guest signed out, not as the redirected creator | § 7 |
| `tests/e2e/evt-10-description.spec.ts` | modified | Guest-surface checks (AC-2/3/4, AC-6, AC-8) signed out — Q1 | § 7 (amended at Q1) |
| `tests/e2e/evt-11-description-pictures.spec.ts` | modified | Guest-surface checks (AC-3, AC-7) signed out — Q1 | § 7 (amended at Q1) |
| `.ai/board/tickets/EVT-13/99-questions.md` | created | Q1 to `tech-lead-design`, and its answer | consultation |
| `.ai/board/tickets/EVT-13/01-plan.md` | modified (by `tech-lead-design`) | § 7 gained the two spec paths, Changelog line | Q1 amendment |
| `.ai/board/tickets/EVT-13/ticket.yaml` | modified | `allowed_paths` + chat budget (by `tech-lead-design`); `state` to `REVIEW` (here) | Q1, gate |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `guest_link_event_id(text) returns uuid`, definer, `search_path = ''` | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:30` | Body transcribed; one transaction |
| 4.1 revoke from `public, anon, authenticated`; grant to `authenticated` | `…evt13_guest_link_event_id.sql:38-39` | |
| 4.2 `getGuestLinkEventId(token): Promise<string \| null>` | `src/lib/data/index.ts:1508` | Doc comment as § 4.2 |
| 4.2 supabase | `src/lib/data/supabase.ts:3951` | Error message `getGuestLinkEventId failed: <message>`; a non-string `data` reads as null |
| 4.2 mock | `src/lib/data/mock.ts:3806` | |
| 4.3 App route prop | `src/App.tsx:154` | |
| 4.3 GuestEvent prop, ask, redirect, fallback | `src/routes/GuestEvent.tsx:116`, `:128-135` | Failure of the ask read as null; state stays `loading` on redirect |
| 4.4 selectors | none added | |

## Deviations from the design

`none` against § 1–6. Test scope grew by two files at Q1, recorded in `consulted` and in the plan's
Changelog. One more journey in `evt-06-guest-link.spec.ts` than § 7 named — AC-4/AC-5 at `:280-288`
opened the reopened link as the signed-in creator — is fixed the same way (sign out first), inside an
already-allowed file.

## Invariants

`invariants_touched: []`. The new read writes nothing (AC-9 unit test asserts events, attendance,
guests, the guest link and `listMembers()` unchanged across askers), and no policy or grant on
`public.member` changes, so INV-04's denominator is untouched; INV-01–07 constrain entries, which
nothing here reads or writes.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 37 files, 735 tests |
| `CI=1 pnpm exec playwright test` | 0 | 370 passed, 21 skipped (ADR-060 quarantine) |
| `node scripts/check-docs.mjs` | 0 | 0 errors, 2 pre-existing warnings |
| `git status` paths ⊆ `allowed_paths` + ticket folder | yes | |

The migration is **not** applied or run against PostgreSQL (RULE-09); the mock reproduces it.

## Testability contract

No selectors added. AC-1 is observed through `event-detail`, `event-name` and the URL
(`tests/e2e/evt-06-guest-link.spec.ts:213`); AC-3 through `guest-event` (`:230`).

## Open questions

None.
