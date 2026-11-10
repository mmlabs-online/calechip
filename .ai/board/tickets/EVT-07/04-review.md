---
ticket: EVT-07
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-09T11:45:31+0700
inputs_read:
  - .ai/board/tickets/EVT-07/01-plan.md
  - .ai/board/tickets/EVT-07/03-impl-log.md
  - .ai/board/tickets/EVT-07/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/steward/context.md
  - supabase/migrations/20261009150000_evt07_guest_registration.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - supabase/migrations/20260929120000_evt01_event.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/components/EventAttendancePanel.tsx
  - src/routes/GuestEvent.tsx
  - src/routes/EventDetail.tsx
  - src/App.tsx
  - git diff origin/main...HEAD
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

# EVT-07 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths inside `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs EVT-07` → `16 changed file(s)` … `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs EVT-07` → `0 uncommitted path(s)` … `PASS — nothing stray`, exit 0. Non-ticket paths in the diff besides the twelve allowed: `.ai/board/backlog.md` (ship-owned) only |
| R2 | Typecheck, whole program | PASS | `pnpm typecheck` exit 0 |
| R3 | Lint on the changed lintable files | PASS | `npx eslint` over the 10 `.ts`/`.tsx` paths in `git diff --name-only origin/main...HEAD` exit 0. Repo-wide `npx eslint .` reports one error outside the diff: `scripts/check-allowed-paths.mjs:144:7` `no-useless-assignment` — not this ticket's (ADR-041); noted for a human as an `OPS-nnn` chore, gate unaffected |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/routes/GuestEvent.tsx:28` and `src/components/EventAttendancePanel.tsx:24` import only `seam` from `@/lib/data`; every datastore call is in `src/lib/data/supabase.ts:3719-3855`; the seam lint rule is part of R3's clean run |
| R5 | Every § 4 contract item implemented | PASS | See *R5 detail* |
| R6 | Permission gating matches § 3 | PASS | Server: `event_guest_select_visible` migration `:453-463`, `event_guest_update_manage` `:467-474` (check refuses `cancelled`), grants `:481-499` (select excludes `email` and `manage_token_hash`; update `(status)` only; no insert/delete grant; anon holds only four function grants), `list_event_guest_emails` gated on `may_manage_event` `:434-442`. Interface: remove/approve/reject drawn under `canManage` (`EventAttendancePanel.tsx:273, 366`), which is `mayEditEvent` = creator or admin (`EventDetail.tsx:52, 234`) — never `may_decide`, so a manager gets nothing more (§ 3 row *Read guests' emails*). Mock reproduces: `mock.ts:3616-3628` (email only when `manages`), `mock.ts:3637` (decide refused without `mayManageEvent`), `mock.ts:3645-3650` (`cancelled` refused) |
| R7 | No invariant violated | PASS | See *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff --stat origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `GuestStatus` | `src/lib/domain/types.ts:1124` | yes, verbatim |
| 4.1 `EventGuest` | `src/lib/domain/types.ts:1128` | yes |
| 4.1 `GuestRegistrationTerms` | `src/lib/domain/types.ts:1140` | yes |
| 4.1 `GuestRegistrationReceipt` | `src/lib/domain/types.ts:1148` | yes |
| 4.1 `GuestRegistrationView` | `src/lib/domain/types.ts:1154` | yes |
| 4.1 `GUEST_NAME_MAX`, `GUEST_EMAIL_MAX`, `GUEST_EMAIL_PATTERN` | `src/lib/domain/types.ts:1169-1171` | yes, same values and pattern |
| 4.1 five `FailureCode` members | `src/lib/domain/types.ts:267-277` | yes, appended before `unknown` |
| 4.1 `GuestEvent` unchanged (AC-22) | no hunk touches it in `types.ts` | yes |
| 4.2 `getGuestRegistrationTerms` | `index.ts:1472`; `supabase.ts:3719` (`rpc get_guest_event_terms`); `mock.ts:3510` | yes |
| 4.2 `registerGuest` | `index.ts:1477`; `supabase.ts:3733` (shape pre-check, trim, `rpc register_guest`); `mock.ts:3525` (digest awaited before check-and-write) | yes |
| 4.2 `getGuestRegistration` | `index.ts:1481`; `supabase.ts:3759`; `mock.ts:3573` | yes |
| 4.2 `cancelGuestRegistration` | `index.ts:1485`; `supabase.ts:3781`; `mock.ts:3593` | yes |
| 4.2 `listEventGuests` | `index.ts:1491`; `supabase.ts:3798-3826` (granted six columns, never `*`, bounded, emails merged by id from `list_event_guest_emails`); `mock.ts:3616` | yes |
| 4.2 `decideGuest` | `index.ts:1495`; `supabase.ts:3833-3855` (only `status` sent; zero rows → `attendance_not_permitted`; email null); `mock.ts:3631` | yes |
| 4.2 `toGuestFailure` on SQLSTATE only, nine codes | `supabase.ts:472-496` | yes |
| 4.2 mock: `eventGuests` with hash only, reset, `seatsTaken` counts guests, `deleteEvent` sets null, `getGuestEvent` merges names | `mock.ts:827`, `:604-606`, `:735-740`, `:3211-3214`, `:3473-3491` | yes |
| 4.3 enum, table, three checks, unique hash, unique `(event_id, lower(email))`, RLS | migration `:56-84` | yes, verbatim to § 4.3 |
| 4.3 `event_guest_guard` — `set null` branch first, then lock, insert duplicate/open/state/name, update transitions, cancel needs open, cap counts both tables | migration `:92-186` | yes |
| 4.3 `event_attendance_guard` replaced: EVT-02 body verbatim plus guest count | migration `:192-255` vs `evt02_attendance.sql:232-292` | yes — only the `v_taken` addition and a comment differ |
| 4.3 `event_capacity_guard` replaced | migration `:259-278` | yes |
| 4.3 `get_guest_event` replaced, same return type | migration `:284-296` | yes |
| 4.3 `list_guest_event_attendees` replaced, `union all`, ordered `created_at` then id as text | migration `:300-322` | yes |
| 4.3 `get_guest_event_terms` | migration `:329-336` | yes |
| 4.3 `register_guest` — trims, EV006/EV007, EV004, two `gen_random_uuid()`, inserts hash only, returns plain token | migration `:342-381` | yes |
| 4.3 `get_guest_registration` — by hash, deleted-event branch | migration `:385-398` | yes |
| 4.3 `cancel_guest_registration` — EV005 on no row | migration `:403-430` | yes; the extra EV002 for a deleted event (`:420-422`) is declared in the impl log as deviation 1 and lies inside § 4.3's "the Developer writes the SQL" |
| 4.3 `list_event_guest_emails` — `may_manage_event` only | migration `:434-442` | yes |
| 4.3 two policies | migration `:453-474` | yes |
| 4.3 grants, replaced functions not re-granted | migration `:481-499` | yes |
| 4.4 route `/guest/registration/:token` in `BareLayout`, no guard | `src/App.tsx:157` | yes |
| 4.4 guest page reads terms beside `getGuestEvent`; null/thrown terms → no block | `src/routes/GuestEvent.tsx:120-124, 163` | yes |
| 4.4 `GuestRegisterPanel`, `GuestRegistration`, `guestManageUrl`, `guestRegistrationProblem` | `src/routes/GuestEvent.tsx:253, 451, 47, 53` | yes; manage page `missing` on null or thrown (`:461-465`) |
| 4.4 panel loads guests, `taken` counts them, merged by join order, decisions through `decideGuest` | `src/components/EventAttendancePanel.tsx:155-161, 185-192, 293, 303, 512`; `EventDetail.tsx` unchanged | yes |
| 4.5 selectors | `GuestEvent.tsx:308-415, 492-607`; `EventAttendancePanel.tsx:98, 281-300, 361-368, 485-506` | yes, every row of § 4.5 present |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count, over entries whose member was on the team | Guests live in their own table with no member reference: `event_guest` columns are `id, event_id, event_name, name, email, manage_token_hash, status, timestamps` (migration `:61-79`), no `member_id` and no FK to `public.member`. `grep "on public.member\|references public.member\|entry"` over the migration returns nothing: no policy or grant on `public.member` and no entry table is created, altered or read. The one `public.member` join (migration `:312`) is EVT-06's existing definer read, reproduced verbatim inside `list_guest_event_attendees`, and changes no policy. The mock adds guests to `eventGuests` only (`mock.ts:3555-3565`) — never to `members` — so `listMembers()`, the denominator, is untouched; no entry function is in the diff. Held server-side, not by an affordance | migration `:61-79, :300-322`; `mock.ts:827, 3555-3565` |

## Findings

None that fail a check.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | R3 | `scripts/check-allowed-paths.mjs:144:7` `no-useless-assignment`, outside the diff and outside `allowed_paths`. Gate unaffected (ADR-041) | human — an `OPS-nnn` chore | false |

## Verdict

`PASS`. The ticket advances to DONE.
