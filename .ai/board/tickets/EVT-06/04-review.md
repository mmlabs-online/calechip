---
ticket: EVT-06
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-09T11:00:41+07:00
inputs_read:
  - .ai/board/tickets/EVT-06/01-plan.md
  - .ai/board/tickets/EVT-06/03-impl-log.md
  - .ai/board/tickets/EVT-06/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - git diff origin/main...HEAD
  - eslint.config.js
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

# EVT-06 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (exit 0, 16 changed files; the extras are the ticket folder and `.ai/board/backlog.md`, ship-owned). `node scripts/check-carry.mjs EVT-06` → `0 uncommitted path(s) … PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0, whole-program | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint <the 11 changed .ts/.tsx files>` → exit 0. Repo-wide `pnpm exec eslint .` → exit 1 on `scripts/check-allowed-paths.mjs:144:7` `no-useless-assignment`, a file this diff does not touch — ADR-041 exemption, see Findings |
| R4 | Nothing outside the seam reaches the datastore | PASS | `eslint.config.js:69` forbids `@supabase/*` outside the seam and lint passes; `src/routes/GuestEvent.tsx:58` and `src/routes/EventDetail.tsx:86` reach data only through `seam` (`src/lib/data/index.ts:1479`); no `supabase`/`createClient` reference in either route or `src/App.tsx` |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches § 3 | PASS | `supabase/migrations/20261009120000_evt06_guest_link.sql:53-65` (three `to authenticated` policies on `may_manage_event`), `:105-112` (no anon table grant; `insert (event_id)` only; no update grant; execute on the two reads only); mock `src/lib/data/mock.ts:3341-3371` reproduces each clause; panel gated at `src/routes/EventDetail.tsx:238`, link read gated at `:86` |
| R7 | No invariant violated | PASS | see R7 detail |
| R8 | No dependency without an ADR | PASS | `git diff --name-only origin/main...HEAD` touches no `package.json` or lockfile; the only new import is `eventDateLabel` from an existing module (`src/routes/GuestEvent.tsx:18`, defined at `src/routes/Events.tsx:58`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `EventGuestLink` | `src/lib/domain/types.ts:1077` | yes — `eventId`, `token`, `openedAt` |
| 4.1 `GuestEvent` | `src/lib/domain/types.ts:1087` | yes — exactly the eight keys of AC-12 |
| 4.1 `GUEST_LINK_TOKEN_PATTERN` | `src/lib/domain/types.ts:1104` | yes — `/^[0-9a-f]{64}$/` |
| 4.2 `getEventGuestLink(eventId)` | `src/lib/data/index.ts:1437`, `src/lib/data/mock.ts:3341`, `src/lib/data/supabase.ts:3508` | yes — null for not-open and may-not-manage alike; 42501/PGRST301 → null for signed out |
| 4.2 `openEventToGuests(eventId)` | `src/lib/data/index.ts:1442`, `src/lib/data/mock.ts:3350`, `src/lib/data/supabase.ts:3525` | yes — sends `{ event_id }` only; 23505 reads back at `supabase.ts:3534`, null read-back → `event_not_permitted` |
| 4.2 `closeEventToGuests(eventId)` | `src/lib/data/index.ts:1446`, `src/lib/data/mock.ts:3363`, `src/lib/data/supabase.ts:3545` | yes — zero rows back → `event_not_permitted` |
| 4.2 `getGuestEvent(token)` | `src/lib/data/index.ts:1454`, `src/lib/data/mock.ts:3374`, `src/lib/data/supabase.ts:3563` | yes — pattern check before any round trip; `seatsTaken` from `get_guest_event`; attendee read `.limit(DATASTORE_MAX_ROWS)` and throws at the bound (`supabase.ts:3583`) |
| 4.2 mock cascade on `deleteEvent` (§ 5) | `src/lib/data/mock.ts:3120`; reset at `:595` | yes |
| 4.3 table, PK cascade, unique token default, shape check, RLS | `supabase/migrations/20261009120000_evt06_guest_link.sql:37-44` | yes — statement for statement with § 4.3 |
| 4.3 three policies | `…_evt06_guest_link.sql:52-65` | yes |
| 4.3 `get_guest_event(text)` | `…_evt06_guest_link.sql:73-83` | yes — seven fixed columns, filtered on `l.token = p_token` |
| 4.3 `list_guest_event_attendees(text)` | `…_evt06_guest_link.sql:88-99` | yes — one `text` column, null unless approved and not removed |
| 4.3 grants | `…_evt06_guest_link.sql:105-112` | yes |
| 4.4 route `/guest/:token` in `BareLayout`, no guard | `src/App.tsx:151` | yes |
| 4.4 `GuestEvent` default export, three states, thrown read = missing | `src/routes/GuestEvent.tsx:54`, not-found at `:85` | yes |
| 4.4 AC-15 `<meta>` on mount, removed on unmount | `src/routes/GuestEvent.tsx:34` | yes |
| 4.4 `guestSeatsLabel(capacity, seatsTaken)` | `src/routes/GuestEvent.tsx:26` | yes — the three AC-9 strings |
| 4.4 link loaded only when `mayEditEvent` | `src/routes/EventDetail.tsx:86` | yes in effect — after the `Promise.all` rather than inside it, because the predicate needs that call's results (impl log Deviation 1); the AC-18 property § 4.4 states holds |
| 4.4 `EventGuestPanel({ event, link, onChange })` rendered when `canEdit` | `src/routes/EventDetail.tsx:292`, rendered at `:238` | yes |
| 4.4 `guestLinkUrl(origin, token)` | `src/routes/EventDetail.tsx:56` | yes |
| 4.5 selectors | `src/routes/EventDetail.tsx:345` (panel) and the rest of the panel; `src/routes/GuestEvent.tsx:85` and the guest card | yes — every selector in § 4.5 present; `tests/guest-link.test.ts` 17/17 pass |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | The diff reads no `entry` row and writes no count; nothing computes or redefines the absence count. The plan's concern is the denominator via `member` visibility: the migration adds no policy, grant or column on `public.member` — the only reference to `member` is the join inside a `security definer` function returning one nullable `text` column, gated on an open event's token. `listMembers()` is untouched in both seams (no hunk in `listMembers` in `src/lib/data/mock.ts` or `src/lib/data/supabase.ts`). | `supabase/migrations/20261009120000_evt06_guest_link.sql:88-99` (the only `member` reference), `:105-112` (grants name only `event_guest_link` and the two functions) |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R3 (exempt) | `scripts/check-allowed-paths.mjs:144:7` fails `no-useless-assignment` in the repo-wide lint. Outside this diff and outside `allowed_paths`; predates the branch (impl log Open question 1). R3 still passes per ADR-041 | human, as an `OPS-nnn` chore | false |

## Verdict

**PASS.** EVT-06 advances to DONE.
