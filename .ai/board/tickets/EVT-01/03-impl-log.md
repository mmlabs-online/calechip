---
ticket: EVT-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-29T11:05:10+0700
inputs_read:
  - .ai/board/tickets/EVT-01/01-plan.md
  - .ai/board/tickets/EVT-01/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/coding-standards.md
  - .ai/standards/tech-stack.md
  - .ai/steward/context.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260922150000_cal11_cross_team_reads.sql
  - supabase/migrations/20260926100000_solo_issue_report.sql
  - supabase/db.sql
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/components/TopBar.tsx
  - src/components/Modal.tsx
  - src/components/Avatar.tsx
  - src/routes/EditEntry.tsx
  - tests/issue-reports.test.ts
  - tests/e2e/solo-report-issue.spec.ts
  - tests/e2e/solo-sidebar-role-groups.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-01 — implementation log

## Files touched

Twelve files, exactly the twelve in `allowed_paths`; no thirteenth (01-plan.md § 7). The four
board/registry paths dirty in the tree (`backlog.md`, `features.md`, the idea, `EVT-02/`) were
dirty before this stage began and were not touched here.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260929120000_evt01_event.sql` | created | The enum, both tables, the trigger, the four functions, seven policies and the grants that hold every check in § 3 | § 4.3 |
| `src/lib/domain/types.ts` | modified | `EventScope`, `CalEvent`, `DirectoryMember` and the four `FailureCode` members | § 4.1 |
| `src/lib/data/index.ts` | modified | `SaveEventInput` and the seven `DataSeam` signatures | § 4.2 |
| `src/lib/data/mock.ts` | modified | The seven functions reproducing § 3's policies, the in-memory tables and `__resetEvents()` | § 4.2, § 5 |
| `src/lib/data/supabase.ts` | modified | The seven functions over `from("event")`, `from("event_invitee")`, `rpc("list_member_directory")` and `rpc("save_event")` | § 4.2, § 5 |
| `src/App.tsx` | modified | The four routes, guarded `membership.state === "member"` inside the shell layout | § 4.4 routes |
| `src/components/TopBar.tsx` | modified | `nav-events-link` immediately before `home-new-entry-link` | § 4.4, AC-19 |
| `src/routes/Events.tsx` | created | The list: Upcoming / Past, rows, empty state | § 4.4, AC-20, AC-21 |
| `src/routes/EventDetail.tsx` | created | The detail card, the named list, edit/delete controls and the delete confirmation | § 4.4, AC-13, AC-15, AC-22 |
| `src/routes/EventEditor.tsx` | created | The one form for create and edit, with the inline picker | § 4.4, AC-2, AC-3, AC-10, AC-23 |
| `tests/events.test.ts` | created | AC-1 to AC-18 against the mock seam, plus five assertions that read the migration file itself | § 2 (test naming) |
| `tests/e2e/evt-01-events.spec.ts` | created | AC-1 to AC-3, AC-5, AC-7, AC-10, AC-13 to AC-17, AC-19 to AC-23 through the interface | § 2, § 4.4 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 `EventScope` | `src/lib/domain/types.ts:955` | Values verbatim from the enum |
| 4.1 `CalEvent` | `src/lib/domain/types.ts:959` | |
| 4.1 `DirectoryMember` | `src/lib/domain/types.ts:980` | Five fields; a unit test asserts the key set of every row |
| 4.1 four `FailureCode` members | `src/lib/domain/types.ts:240-248` | Appended before `unknown` |
| 4.2 `SaveEventInput` | `src/lib/data/index.ts:224` | No `creatorId`, no `teamId` |
| 4.2 `listEvents` | `index.ts:1288`, `mock.ts:2671`, `supabase.ts:2888` | `start_date` then `id` ascending |
| 4.2 `getEvent` | `index.ts:1292`, `mock.ts:2681`, `supabase.ts:2912` | Null for missing and unreadable alike |
| 4.2 `listEventInvitees` | `index.ts:1296`, `mock.ts:2688`, `supabase.ts:2929` | Empty for a non-manager — the policy is the mechanism |
| 4.2 `listMemberDirectory` | `index.ts:1300`, `mock.ts:2699`, `supabase.ts:2955` | Ordered team name, display name, id |
| 4.2 `createEvent` | `index.ts:1304`, `mock.ts:2728`, `supabase.ts:2984` → `saveEventThroughRpc` at `supabase.ts:195` | One `save_event` call |
| 4.2 `updateEvent` | `index.ts:1307`, `mock.ts:2764`, `supabase.ts:2988` | Same RPC with an id |
| 4.2 `deleteEvent` | `index.ts:1311`, `mock.ts:2797`, `supabase.ts:2994` | Zero rows back is `event_not_permitted` |
| 4.2 four English failure sentences | `mock.ts` `EVENT_*` constants beside `eventFailure`; repeated verbatim in `supabase.ts` beside `toEventFailure` (`:177`) | The two refusals never confirm existence |
| 4.3 `public.event_scope` | migration `:53` | Guarded `do` block |
| 4.3 `public.event` | migration `:57` | Both named constraints |
| 4.3 `public.event_invitee` | migration `:79` | `on delete cascade` on `event_id` only |
| 4.3 `public.event_stamp()` + trigger | migration `:101`, `:116` | `team_id` on insert, `updated_at` on update |
| 4.3 `public.is_event_invitee` | migration `:125` | |
| 4.3 `public.may_manage_event` | migration `:134` | Keyed on `is_admin`, never `may_decide` |
| 4.3 `public.list_member_directory()` | migration `:154` | No `order by` |
| 4.3 `public.save_event` | migration `:180` | `security invoker`; 42501 on zero rows; 22023 `invalid_event_invitee` |
| 4.3 seven policies | migration `:250`, `:267`, `:276`, `:289`, `:299`, `:306`, `:314` | Predicates transcribed from the § 4.3 table |
| 4.3 grants | migration `:333-337`, `:347-351` | See deviation 1 for the revokes before them |
| 4.4 routes | `src/App.tsx:545`, `:549`, `:553`, `:557` | |
| 5 `__resetEvents()` | `src/lib/data/mock.ts:568` | Named export beside `seam`; parity untouched |
| 5 `listMembers()` and every `public.member` policy untouched | — | AC-12, asserted by two tests |

## Deviations from the design

Each is additive or a choice the plan left open; none changes a name, a signature or a permission.

1. **The migration revokes before it grants.** § 4.3 lists the grants only. Supabase's default
   privileges give every new `public` table to `anon` and `authenticated` whole, and a column grant
   means nothing beside a table-wide one, so `revoke all on public.event / public.event_invitee from
   anon, authenticated` precedes them — the shape CAL-01 and the issue-report migration already use.
   Function revokes name `public, anon` rather than `public` alone, because Supabase's defaults also
   grant `execute` to `anon` explicitly. Without the table revoke, AC-4's refusal would not exist.
2. **The event name is stored trimmed**, in both seams. § 4.2 says description and location go as
   null when blank; it says nothing about the name. Trimming it means the stored name is the one
   `event_name_present` judged, and a list never shows leading spaces.
3. **Bounds on the three reads.** No limit was designed. `listEvents` asks for and refuses at
   `DATASTORE_MAX_ROWS`; `listEventInvitees` and `listMemberDirectory` at `ROSTER_LIMIT`. Both
   constants already exist — no new name was introduced (RULE-04). Each throws at the bound, the
   shape every bounded read in `supabase.ts` has.
4. **`22P02` (a malformed uuid) is "not found"** in `getEvent` (null), `listEventInvitees` (`[]`) and
   `deleteEvent` (`event_not_permitted`), so `/events/nonsense` renders `event-not-found` instead of
   throwing.
5. **`listEventInvitees` is ordered by `member_id` ascending** in both seams. The plan named no order.
6. **`23514` is told apart by the input, not by the constraint name** (`toEventFailure`,
   `supabase.ts:177`) — the file's standing rule is never to match on message text. It is
   unreachable from this application, which refuses both conditions before the round trip.
7. **`save_event` runs the invitee test after the row write**, so a caller who may not write the
   event receives 42501 and learns nothing about the ids they sent. § 4.3 says "before touching
   invitees", which this satisfies; the order relative to the row write was open.
8. **The mock has its own `eventIsAdmin`.** The existing `currentAdmin()` omits `is_admin`'s
   `status = 'approved'` clause; the event predicates need the whole of it, so `eventIsAdmin` is
   `memberTeamId(uid) !== null && role === "admin"`.
9. **One check on the form that is not the seam's:** both date inputs must hold a date
   ("Please choose a start date and an end date."). An unpicked date input is an empty string, which
   neither seam could compare. Every other refusal on the form is the seam's own sentence.
10. **Shared UI helpers are exported from route files** — `EventScopeBadge`, `eventDateLabel` and
    `creatorName` from `Events.tsx`, `mayEditEvent` from `EventDetail.tsx` — because a shared module
    would be the thirteenth file that makes this ticket L (§ 7). `YearOverview.tsx` already exports a
    second component, so the shape has precedent.
11. **Selectors beyond § 4.4** — `event-delete-modal` and `event-delete-close` (from `Modal`),
    `data-creator-id` on `event-creator`, `data-team-id` on `event-picker-group`, `data-member-id` on
    each named-list item. § 4.4 says no others are required, not that none may exist.
12. **Cross-year date labels** write both years (`d MMM yyyy – d MMM yyyy`). § 4.4 gives the
    same-year form only; dropping the first year would make a December-to-January event read
    backwards.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | Its denominator is `listMembers()`, which returns what the select policies on `public.member` return. The migration creates no policy on `public.member`, alters none, and does not mention `member_select_team` outside comments — `tests/events.test.ts` asserts all three against the file with comments stripped. The one cross-team read of member identity is `list_member_directory()`, a separate definer function with five columns, and `listMembers()` in both seams is unchanged by a single character. AC-12's test also calls `listMembers()` as a team A member and a team A manager before and after cross-team events exist and gets identical rows, none from team B. No entry is created or read by any event path (AC-18's test compares `listTeamEntries`, `listTeamEntriesOverlapping` and `listOwnEntries` before and after). |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 26 files, 418 tests, all pass — `tests/events.test.ts` is 34 of them |
| `pnpm exec playwright test tests/e2e/evt-01-events.spec.ts` | 0 | 12 passed (11 + the seam guard) |
| `pnpm exec playwright test` | 1 | 296 passed, **20 failed — the same 20 fail on a clean `HEAD` worktree** (see Open questions); none is in the EVT-01 spec |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git status --porcelain` ⊆ `allowed_paths` | yes | Plus the four board/registry paths that were dirty before this stage |

**The migration was not run against PostgreSQL.** Nothing in this repository can: no project is
provisioned and `tests/permission-model.test.ts` is owed project-wide (01-plan.md § 3). Its header
says so. Every denial is asserted against the mock, which reproduces the policies clause for clause.
One claim in the trigger's comment — that PostgreSQL evaluates the row-level `WITH CHECK` before the
`NOT NULL` constraint, so a pending creator is refused 42501 rather than 23502 — is from recall of
`ExecInsert`'s order and was not observed. Either code maps to a refusal the application shows; only
the SQLSTATE would differ (23502 would reach `unknown`).

## Testability contract

| selector | Exists at |
|----------|-----------|
| `nav-events-link` | `src/components/TopBar.tsx:280` |
| `events-new-button` | `src/routes/Events.tsx:164` (list), `:194` (inside `events-empty`) — never both at once |
| `events-upcoming` | `src/routes/Events.tsx:201` |
| `events-past` | `src/routes/Events.tsx:212` |
| `event-row` | `src/routes/Events.tsx:97` |
| `event-row-scope` | `src/routes/Events.tsx:104` |
| `events-empty` | `src/routes/Events.tsx:173` |
| `event-detail` | `src/routes/EventDetail.tsx:128` |
| `event-name` | `src/routes/EventDetail.tsx:130` |
| `event-dates` | `src/routes/EventDetail.tsx:153` |
| `event-scope` | `src/routes/EventDetail.tsx:158` |
| `event-creator` | `src/routes/EventDetail.tsx:161` |
| `event-location` | `src/routes/EventDetail.tsx:168` |
| `event-description` | `src/routes/EventDetail.tsx:175` |
| `event-invitees` | `src/routes/EventDetail.tsx:181` |
| `event-edit-button` | `src/routes/EventDetail.tsx:135` |
| `event-delete-button` | `src/routes/EventDetail.tsx:139` |
| `event-delete-confirm` | `src/routes/EventDetail.tsx:228` |
| `event-delete-cancel` | `src/routes/EventDetail.tsx:220` |
| `event-not-found` | `src/routes/EventDetail.tsx:85`, `src/routes/EventEditor.tsx:135` |
| `event-form` | `src/routes/EventEditor.tsx:248` |
| `event-name-input` | `src/routes/EventEditor.tsx:258` |
| `event-start-input` | `src/routes/EventEditor.tsx:271` |
| `event-end-input` | `src/routes/EventEditor.tsx:281` |
| `event-location-input` | `src/routes/EventEditor.tsx:377` |
| `event-description-input` | `src/routes/EventEditor.tsx:388` |
| `event-scope-team`, `event-scope-named`, `event-scope-public` | `src/routes/EventEditor.tsx:304` |
| `event-picker` | `src/routes/EventEditor.tsx:322` |
| `event-picker-filter` | `src/routes/EventEditor.tsx:328` |
| `event-picker-group` | `src/routes/EventEditor.tsx:340` |
| `event-picker-option` | `src/routes/EventEditor.tsx:350` (the `<label>`, carrying `data-member-id`) |
| `event-save` | `src/routes/EventEditor.tsx:412` |
| `event-cancel` | `src/routes/EventEditor.tsx:404` |
| `event-form-error` | `src/routes/EventEditor.tsx:397` |

## Open questions

1. **Twenty end-to-end tests fail on `HEAD` without this ticket** — 9 in `adm-02-holidays`, 3 each
   in `uie-09-admin-hub` and `uie-10-sidebar`, 2 in `adm-03-holiday-writes`, 1 each in
   `adm-01-threshold`, `adm-04-worklist` and `cal-06-year-view`. Verified by running exactly those
   specs in a detached worktree of `d85c91b`: the same 20 fail. They look for sidebar links
   (`home-week-link`, the holidays link) that the commented-out navigation block in
   `src/components/Sidebar.tsx` no longer draws. `.ai/board/model-debt.md` carries no entry for it
   and is outside this ticket's `allowed_paths`, so it is reported here rather than recorded there.
   `testing-standards.md`'s *all pass* table is stale for the same reason.
2. **Owed to `/thuki`, unchanged by this stage** (01-plan.md § 6): the event rows in
   `.ai/standards/rbac-and-security.md` and the two tables in `.ai/standards/data-model.md`.
