---
ticket: EVT-12
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-14T23:33:56+07:00
inputs_read:
  - .ai/board/tickets/EVT-12/01-plan.md
  - .ai/board/tickets/EVT-12/03-impl-log.md
  - .ai/board/tickets/EVT-12/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - git diff origin/main...HEAD
  - supabase/migrations/20261014090000_evt12_invite_every_scope.sql
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - src/lib/data/mock.ts
  - src/routes/EventDetail.tsx
  - src/routes/EventEditor.tsx
  - src/routes/Events.tsx
  - tests/event-invitation.test.ts
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

# EVT-12 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (16 changed files; the remainder are the ticket folder and `.ai/board/backlog.md`, ship-owned). `node scripts/check-carry.mjs EVT-12` → `0 uncommitted path(s)`, `PASS — nothing stray`. `git status --porcelain` empty |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` on the nine changed `src/`/`tests/` files → exit 0; repo-wide `pnpm exec eslint .` → exit 0, nothing outside the diff to note |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The three screens import data only through `seam` — `src/routes/EventDetail.tsx:34`, `src/routes/EventEditor.tsx:33`, `src/routes/Events.tsx:17`; the new reads in `onInvited` are seam calls, `src/routes/EventDetail.tsx:224-229`. No `@supabase` import in any changed screen |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | `may_manage_event` → 42501 before anything, null uid included, `supabase/migrations/20261014090000_evt12_invite_every_scope.sql:68-70`; no scope refusal remains (`:72-77`); public branch reads no `member`/`auth.users` and writes no `event_invitee`, `:95-111`; add/convert only after `may_manage_event` and only for a resolved member who cannot read, `:152-175`; suppression setting is set/cleared only inside the definer, `:159`, `:167`, and read by both triggers, `:297`, `:323`; grants restated as EVT-04/EVT-08 wrote them, `:343-350` vs `20261012100000_evt08_event_email_invitation.sql:277-280` and `20261008120000_evt04_notification.sql:435-448`. Mock mirrors the refusal, `src/lib/data/mock.ts:3816-3818`. Panel is an affordance gated on `canEdit`, `src/routes/EventDetail.tsx:363`. Denials asserted in `tests/event-invitation.test.ts` (diff `describe` "EVT-12 AC-1, AC-3, AC-13", case "anybody else is refused on a team event, and nothing changes"). Standards rows match § 3, `.ai/standards/rbac-and-security.md:99-108` |
| R7 | No invariant violated (RULE-07) | PASS | `invariants_touched: []`; see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 step 1 — `may_manage_event` false → 42501 | `supabase/migrations/20261014090000_evt12_invite_every_scope.sql:68-70` | yes — `invite_to_event(uuid, text[]) returns table (email text, outcome text)`, definer, `search_path = ''`, `#variable_conflict use_column`, `:51-54` |
| § 4.1 step 2 — `for update`, `invitation_not_public` removed | `…evt12_invite_every_scope.sql:73-77` | yes |
| § 4.1 step 3 — trim, validate, dedupe, EV008 | `…evt12_invite_every_scope.sql:79-93`, identical to `20261012100000_evt08_event_email_invitation.sql` step 3 | yes |
| § 4.1 step 4 — public branch EVT-08 verbatim, no member read | `…evt12_invite_every_scope.sql:95-111` | yes |
| § 4.1 step 5.1 — resolve each address, `email_invitation()`'s lookup text | `…evt12_invite_every_scope.sql:115-125` (same predicate as `:227-234`) | yes |
| § 4.1 step 5.2 — open link if any outsider | `…evt12_invite_every_scope.sql:129-132` | yes |
| § 4.1 step 5.3 — insert or `ignored`; outsider/reader → return; else convert (team) under the setting, snapshot without creator, clear, then add member | `…evt12_invite_every_scope.sql:135-177`; snapshot `:161-166` uses `member_team_id`, which filters approved and not removed (`20260910100000_solo_member_approval.sql:57-63`) — AC-7's "approved, not removed" | yes |
| § 4.1 step 6 — nothing but `sent`/`ignored` returned | `…evt12_invite_every_scope.sql:106-108`, `:143-149` | yes |
| § 4.1 `email_invitation()` — one added `may_read_event` skip | `…evt12_invite_every_scope.sql:239-241`; rest identical to EVT-08's body | yes — `returns trigger`, trigger `after insert … for each row` unchanged (`20261012100000_evt08_event_email_invitation.sql:252-255`) |
| § 4.1 `notify_event_updated()` — early return under the setting | `…evt12_invite_every_scope.sql:297-299`; body otherwise EVT-04's (`20261008120000_evt04_notification.sql:182-197`) | yes — row-level `after update`, not deferred, so the setting is live when it fires |
| § 4.1 `notify_event_invited()` — early return under the setting | `…evt12_invite_every_scope.sql:323-325`; body otherwise EVT-04's | yes |
| § 4.1 nothing else replaced | `…evt12_invite_every_scope.sql:46-352` contains four `create or replace function` and grants only | yes |
| § 4.2 banner sentence "on a public event" | `src/lib/data/mock.ts:1037` | yes |
| § 4.2 `inviteToEvent` — `INVITATION_NOT_PUBLIC` removed; public → existing body; team/named → resolve, open on outsider, per-row `emailInvitation`, convert silently with `updatedAt`, add member and `notify` | `src/lib/data/mock.ts:3811-3883` (`insert` calls `emailInvitation` per row; public branch; `resolved`; conversion without `notify`; added member with `notify([member.id], "event_invited", event)`) | yes — signature unchanged |
| § 4.2 `emailInvitation` — skip a member who cannot read | `src/lib/data/mock.ts:1111` (`if (!mayReadEvent(event, member.id)) return;`) | yes |
| § 4.2 no new export | `approvedMemberByEmail` is module-private, `src/lib/data/mock.ts:1094` | yes |
| § 4.3 `inviteHint(scope, verb)` exported, § 2b's three sentences | `src/routes/EventDetail.tsx:91-105` | yes |
| § 4.3 panel on every scope, `event-invite-not-public` removed, `event-invite-hint` | `src/routes/EventDetail.tsx:363`, `:648-650` | yes |
| § 4.3 `onInvited` re-reads four, null event leaves state | `src/routes/EventDetail.tsx:222-239` | yes |
| § 4.3 create form — no scope gate in `createEventWithInvitations` | `src/routes/EventEditor.tsx:101` | yes |
| § 4.3 create form — field for every scope, after the picker | `src/routes/EventEditor.tsx:520-521` (picker at `:467`) | yes |
| § 4.3 create form — `event-form-invite-hint`, `inviteHint(scope, "Creating")` with an address | `src/routes/EventEditor.tsx:524-527` | yes |
| § 4.3 label *Limited people* — choice and badge (badge reused by detail `event-scope`) | `src/routes/EventEditor.tsx:71`, `src/routes/Events.tsx:24`, `src/routes/EventDetail.tsx:298` | yes — no screen string "Named people" remains under `src/` |
| § 4.4 selectors | `event-invite-hint` `src/routes/EventDetail.tsx:648`; `event-form-invite-hint` `src/routes/EventEditor.tsx:524`; `event-invite-not-public` absent from `src/` | yes |
| § 5 no seam signature change | `src/lib/data/mock.ts:3811` — `inviteToEvent(eventId: string, emails: string[]): Promise<Result<EmailInvitationOutcome[]>>`, unchanged; `src/lib/data/supabase.ts` not in diff | yes |

## R7 detail

`invariants_touched` is `[]`. Each registry invariant reasoned against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Nothing in the diff reads or writes `public.entry`; the migration writes only `event_email_invitation`, `event_guest_link`, `event.scope`, `event_invitee` | `supabase/migrations/20261014090000_evt12_invite_every_scope.sql:97-105`, `:130-175` |
| INV-02 approval does not survive an edit | No entry is updated | same lines |
| INV-03 rejected carries reason | No entry is written | same lines |
| INV-04 absence count | No policy or grant on `public.member` changes, so `listMembers()` is untouched; the member reads happen inside the definer and return only `sent`/`ignored`; no team assignment changes | `…evt12_invite_every_scope.sql:117-123`, `:143-149`, `:343-350` (grants on functions only); mock writes only `eventInvitees`/`events`/`emailInvitations`, `src/lib/data/mock.ts:3830-3881` |
| INV-05 tentative counts | No entry or count computed | as INV-04 |
| INV-06 one portion per entry | No entry written | as INV-01 |
| INV-07 one member, every team | No `member.team_id` written; the snapshot reads `member_team_id`, writes `event_invitee` | `…evt12_invite_every_scope.sql:161-166` |

## Findings

None.

Noted, not a finding: the migration is unapplied against a running PostgreSQL (header, `…evt12_invite_every_scope.sql:6-8`), as every EVT migration before it; the mock reproduces it and the per-row trigger timing, and the vitest files the ticket edits pass (96 tests). The full Playwright suite was not run at IN_PROGRESS (`03-impl-log.md` § Verification run); R1–R8 do not require it.

## Verdict

`PASS`.
