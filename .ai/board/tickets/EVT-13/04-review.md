---
ticket: EVT-13
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-15T08:15:16+0700
inputs_read:
  - .ai/board/tickets/EVT-13/01-plan.md
  - .ai/board/tickets/EVT-13/03-impl-log.md
  - .ai/board/tickets/EVT-13/99-questions.md
  - .ai/board/tickets/EVT-13/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
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

# EVT-13 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs EVT-13` → `allowed-paths: PASS` (17 changed, exit 0; `.ai/board/backlog.md` is ship-owned). `node scripts/check-carry.mjs EVT-13` → `0 uncommitted path(s)`, `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` over the ten changed `.ts`/`.tsx` files, exit 0 |
| R4 | No datastore access outside the seam | PASS | `src/routes/GuestEvent.tsx:129` calls `seam.getGuestLinkEventId`; no `supabase` import in `src/App.tsx` or `src/routes/GuestEvent.tsx`; the only `rpc` is `src/lib/data/supabase.ts:3953` |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches § 3 | PASS | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:35` (id only through `may_read_event`), `:38-39` (revoke from `public, anon, authenticated`; grant to `authenticated` only); `may_read_event` starts from `member_team_id(p_uid) is not null` at `supabase/migrations/20261008120000_evt04_notification.sql:99`; mock `src/lib/data/mock.ts:3807-3811`; § 3 denials asserted at `tests/guest-link.test.ts` (AC-3, AC-4, AC-5/7, AC-6 blocks) |
| R7 | No invariant violated | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` lists no `package.json` or lockfile |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `public.guest_link_event_id(p_token text) returns uuid`, `language sql stable security definer set search_path = ''`, body as planned | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:30-36` | yes — body identical to § 4.1 |
| § 4.1 revoke / grant | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:38-39` | yes |
| § 4.1 one transaction, nothing else | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:28`, `:41` (`begin`/`commit`); no table, policy or trigger statement in the file | yes |
| § 4.2 `DataSeam.getGuestLinkEventId(token: string): Promise<string \| null>` under an EVT-13 banner | `src/lib/data/index.ts:1500-1508` | yes |
| § 4.2 supabase: pattern check → null; `rpc("guest_link_event_id", { p_token })`; error throws `getGuestLinkEventId failed: <message>` | `src/lib/data/supabase.ts:3951-3956` | yes |
| § 4.2 mock: pattern check; `guestEventId`; `mayReadEvent(event, currentMemberId)`; no await between | `src/lib/data/mock.ts:3806-3812` | yes |
| § 4.3 App route passes `signedInMember={membership.state === "member"}`, comment updated, stays in `BareLayout` | `src/App.tsx:150-154` | yes |
| § 4.3 GuestEvent takes `{ signedInMember: boolean }`; asks only when signed-in member; failure → null; id → `navigate(..., { replace: true })` with state left `loading`; otherwise the unchanged guest reads; effect keyed on `token`, `signedInMember` | `src/routes/GuestEvent.tsx:116`, `:126-135`, `:136-146`, `:151` | yes (`navigate` added to the deps, as the hooks lint requires) |
| § 4.3 header comment rewritten | `src/routes/GuestEvent.tsx:4-9` | yes |
| § 4.4 no selectors added | AC-1 observed through `event-detail`/`event-name`/URL at `tests/e2e/evt-06-guest-link.spec.ts:213-227`; AC-3 through `guest-event` at `:230-241` | yes |
| § 7 standards row and *Signed out* sentence | `.ai/standards/rbac-and-security.md:89`, `:124-125` | yes |

Routes are not rendered while the session resolves (`src/App.tsx:125`), so `signedInMember` is
settled before `GuestEvent` mounts and a signed-in reader is never first served the guest reads.

## R7 detail

`invariants_touched: []`. Checked per invariant anyway, since the change adds a read:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | not reached — the function reads `event_guest_link` and `may_read_event` only; no entry table | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:31-36` |
| INV-02 approval does not survive an edit | not reached — no write anywhere in the change | same; `tests/guest-link.test.ts` AC-9 block asserts state unchanged across askers |
| INV-03 rejection reason | not reached — no entry write | same |
| INV-04 one definition of the absence count | `listMembers()` and every policy/grant on `public.member` untouched; the migration has no grant on any table | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:38-39`; `tests/guest-link.test.ts` AC-7 block (no table grant), AC-9 block (`listMembers()` unchanged) |
| INV-05 tentative still counts | not reached — no entry read or write | `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql:31-36` |
| INV-06 one portion per entry | not reached — no entry write | same |
| INV-07 one member per entry | not reached — no entry write | same |

## Findings

None.

## Verdict

`PASS`. `EVT-13` advances to DONE.
