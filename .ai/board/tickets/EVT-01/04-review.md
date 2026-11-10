---
ticket: EVT-01
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-29T11:23:57+0700
inputs_read:
  - .ai/board/tickets/EVT-01/01-plan.md
  - .ai/board/tickets/EVT-01/03-impl-log.md
  - .ai/board/tickets/EVT-01/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/templates/review-report.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/App.tsx
  - src/components/TopBar.tsx
  - src/routes/Events.tsx
  - src/routes/EventDetail.tsx
  - src/routes/EventEditor.tsx
  - tests/events.test.ts
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

# EVT-01 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carried | PASS | `git diff --name-only origin/main...HEAD` is empty — nothing committed on `feat/EVT-01`. `node scripts/check-carry.mjs EVT-01` exit 0: `check-carry: PASS — nothing stray`, 19 paths carried — the 12 `allowed_paths` entries, `.ai/board/backlog.md` and `.ai/registry/features.md` (ship-owned), the promoting idea, `EVT-01/` ticket files, sibling `EVT-02/ticket.yaml` |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint` on the 11 changed `.ts`/`.tsx` files → exit 0; repo-wide `pnpm exec eslint .` → exit 0, so no out-of-diff finding to route |
| R4 | Nothing outside the seam reaches the datastore (RULE-02) | PASS | Route files import only `seam` from `@/lib/data` — `src/routes/Events.tsx:17`, `src/routes/EventDetail.tsx:16`, `src/routes/EventEditor.tsx:21`; no `supabase` identifier in any of the three. The only datastore calls are inside the seam: `src/lib/data/supabase.ts:2888-3012`, `supabase.ts:195` |
| R5 | Every § 4 contract item implemented (RULE-04) | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | Every row of § 3 held in the migration: select `supabase/migrations/20260929120000_evt01_event.sql:250-263`; insert `:267-272`; update `:276-285`; delete `:289-294`; invitee select/insert/delete `:299-316`; withheld `creator_id`/`team_id`/`created_at`/`updated_at` column privileges `:330-335`; manager keyed on `is_admin`, never `may_decide` (`:140`, `:255`, `:280`, `:293`); pending/rejected/removed shut out by `member_team_id`, which carries `status = 'approved'` (`supabase/migrations/20260910100000_solo_member_approval.sql:57-62`) and `is_admin` likewise (`:69-75`). Mock reproduces clause for clause: `src/lib/data/mock.ts:612-635`. Interface affordances as § 3 lists: `src/routes/EventDetail.tsx:40-42`, `:133`, `:180`; `src/routes/EventEditor.tsx:89`, `:193` |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` → empty; new imports are existing packages only (`src/routes/Events.tsx:14-19`, `src/routes/EventEditor.tsx:18-25`, `src/routes/EventDetail.tsx:14-21`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `EventScope` | `src/lib/domain/types.ts:955` | yes — `"team" \| "named" \| "public"` |
| 4.1 `CalEvent` | `src/lib/domain/types.ts:959-975` | yes — eleven fields, names and nullability as § 4.1 |
| 4.1 `DirectoryMember` | `src/lib/domain/types.ts:980-986` | yes — five fields, no sixth |
| 4.1 four `FailureCode` members | `src/lib/domain/types.ts:240-248` | yes |
| 4.2 `SaveEventInput` | `src/lib/data/index.ts:224-232` | yes — no `creatorId`, no `teamId` |
| 4.2 `listEvents()` | `index.ts:1288`; `supabase.ts:2888` (`order start_date, id`); `mock.ts:2671` | yes |
| 4.2 `getEvent(eventId)` | `index.ts:1292`; `supabase.ts:2912`; `mock.ts:2681` — null for missing and unreadable alike | yes |
| 4.2 `listEventInvitees(eventId)` | `index.ts:1296`; `supabase.ts:2929`; `mock.ts:2688` | yes |
| 4.2 `listMemberDirectory()` | `index.ts:1300`; `supabase.ts:2955` (`rpc("list_member_directory")`, ordered team name, display name); `mock.ts:2699` | yes |
| 4.2 `createEvent(input)` | `index.ts:1304`; `supabase.ts:2984` → `saveEventThroughRpc` `supabase.ts:195` (one `rpc("save_event")`); `mock.ts:2728` | yes |
| 4.2 `updateEvent(eventId, input)` | `index.ts:1307`; `supabase.ts:2988`; `mock.ts:2764` | yes |
| 4.2 `deleteEvent(eventId)` | `index.ts:1311`; `supabase.ts:2994` (`delete().eq().select("id")`, zero rows → `event_not_permitted`); `mock.ts:2797` | yes |
| 4.2 English failure sentences, refusal never confirms existence | `supabase.ts` `EVENT_*` constants above `toEventFailure` `:177`; mirrored in `mock.ts` beside `eventFailure` | yes |
| 4.3 `public.event_scope` enum | migration `:52-55` (guarded `do` block) | yes |
| 4.3 `public.event` + `event_name_present`, `event_dates_ordered` | migration `:57-77` | yes |
| 4.3 `public.event_invitee`, cascade on `event_id` only | migration `:79-84` | yes |
| 4.3 `event_stamp()` + trigger | migration `:101-116` — definer, `search_path = ''`, `team_id` on insert, `updated_at` on update | yes |
| 4.3 `is_event_invitee(uuid, uuid)` | migration `:125-132` | yes |
| 4.3 `may_manage_event(uuid, uuid)` | migration `:134-142` | yes |
| 4.3 `list_member_directory()` | migration `:154-163` — five columns, caller has a team, row approved and not removed, no `order by` | yes |
| 4.3 `save_event(...)` security invoker | migration `:180-240` — 42501 on zero rows `:210-212`, 22023 `invalid_event_invitee` `:215-220`, delete-then-insert invitees `:223-236` | yes |
| 4.3 seven policies | migration `:250`, `:267`, `:276`, `:289`, `:299`, `:306`, `:314` — predicates match the § 4.3 table | yes |
| 4.3 grants | migration `:333-337`, execute `:347-351`, preceded by revokes `:330-331`, `:341-345` | yes |
| 4.4 four routes, member guard, inside shell | `src/App.tsx:545`, `:549`, `:553`, `:557` | yes |
| 4.4 selectors | every id in the § 4.4 table present at the lines `03-impl-log.md` § *Testability contract* lists — spot-checked `src/components/TopBar.tsx:280`, `src/routes/Events.tsx:97`, `:104`, `:173`, `src/routes/EventDetail.tsx:85`, `:135`, `:139`, `:181`, `:220`, `:228` | yes |
| 5 `__resetEvents()` beside `seam` | `src/lib/data/mock.ts:568` | yes |
| 5 `listMembers()` unchanged | `git diff src/lib/data/` contains no hunk in `listMembers` (`supabase.ts:1193`, `mock.ts:1096`) | yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 | The absence count's denominator is `listMembers()`, which returns what the select policies on `public.member` return. The migration creates, alters and drops no policy on `public.member` — its only `create policy` statements are on `public.event` and `public.event_invitee` (`supabase/migrations/20260929120000_evt01_event.sql:250-316`), and `member_select_team` appears only in the header comment (`:18`). The cross-team identity read is a separate definer function with five columns (`:154-163`), consumed only by `listMemberDirectory` (`src/lib/data/supabase.ts:2955`). `listMembers` is untouched in both seams (`supabase.ts:1193`, `mock.ts:1096`). No event path writes or reads an entry. Asserted from outside by `tests/events.test.ts:368` and `:381`, which pass (`pnpm exec vitest run tests/events.test.ts tests/seam-parity.test.ts` → 45 passed). | `supabase/migrations/20260929120000_evt01_event.sql:250-316`, `src/lib/data/supabase.ts:1193`, `tests/events.test.ts:368` |

## Findings

None.

## Verdict

PASS.
