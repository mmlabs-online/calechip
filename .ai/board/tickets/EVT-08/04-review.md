---
ticket: EVT-08
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-12T22:08:46+0700
inputs_read:
  - .ai/board/tickets/EVT-08/01-plan.md
  - .ai/board/tickets/EVT-08/03-impl-log.md
  - .ai/board/tickets/EVT-08/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/glossary.md
  - .ai/standards/rbac-and-security.md
  - git diff origin/main...HEAD
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/functions/send-event-email/template.ts
  - supabase/functions/send-event-email/index.ts
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/EventDetail.tsx
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

# EVT-08 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted scope | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (exit 0; 16 changed files, of which the ticket folder and `.ai/board/backlog.md` are exempt, the other 12 are exactly `allowed_paths`). `node scripts/check-carry.mjs EVT-08` → `0 uncommitted path(s)`, `PASS — nothing stray` (exit 0). |
| R2 | typecheck | PASS | `pnpm exec tsc --noEmit` exit 0. `pnpm exec vitest run`: 34 files, 642 tests passed. |
| R3 | lint, changed files | PASS | `pnpm exec eslint` on the nine changed lintable files exit 0; `pnpm exec eslint .` exit 0 — nothing outside the diff to route. |
| R4 | No seam bypass (RULE-02) | PASS | `src/routes/EventDetail.tsx:115` and `:156` reach data only through `seam.getEventGuestLink` / `seam.listEventEmailInvitations` / `seam.inviteToEvent`; no `supabase` import in `EventDetail.tsx` or the new e2e spec (grep empty). The datastore calls are in `src/lib/data/supabase.ts:3930`–`:3975`. The mail is sent only from the trigger, `supabase/migrations/20261012100000_evt08_event_email_invitation.sql:235`. |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. |
| R6 | Permission gating matches § 3 | PASS | `invite_to_event`: `may_manage_event` → 42501 at migration `:98`–`:100`, public scope → EV009 at `:103`–`:106`, shape → EV008 at `:111`–`:122` before any write; opens link at `:126`. Select policy `may_manage_event` only, null `event_id` read by nobody, `:264`–`:266`. No insert/update/delete policy; grants `:274`–`:280` give `authenticated` column select and execute only, nothing to `anon`. Function takes no token, inviter, time or version (`:86`, `:132` uses `auth.uid()`). Mock mirrors it: `src/lib/data/mock.ts:3790`–`:3794`, `:3836`–`:3837`. UI affordance on `mayEditEvent` (`EventDetail.tsx:152`, `:115`), no invitation call for others. |
| R7 | No invariant violated | PASS | See R7 detail. |
| R8 | No dependency without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. `date-fns` imported at `src/routes/EventDetail.tsx` is already a dependency. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `EventEmailInvitation` | `src/lib/domain/types.ts:1185` | yes — five fields, nothing about membership |
| 4.1 `EmailInvitationOutcome` | `src/lib/domain/types.ts:1196` | yes |
| 4.1 `invalid_invitation_email`, `invitation_not_public` | `src/lib/domain/types.ts:280`, `:282`; messages `src/lib/data/supabase.ts:531`–`:533`, `src/lib/data/mock.ts:1051`–`:1053` | yes, verbatim in both |
| 4.2 `inviteToEvent` | `src/lib/data/index.ts:1512`; `src/lib/data/supabase.ts:3930`; `src/lib/data/mock.ts:3786` | yes |
| 4.2 `listEventEmailInvitations` | `src/lib/data/index.ts:1517`; `src/lib/data/supabase.ts:3952` (named columns, `created_at desc`, `id`, `limit`, throws at bound); `src/lib/data/mock.ts:3834` | yes |
| 4.2 `toInvitationFailure` (SQLSTATE only) | `src/lib/data/supabase.ts:549` | yes; `22P02` added — impl-log deviation 2, same answer as 42501, consistent with AC-3 |
| 4.2 mock `emailInvitations`, outbox, `__sentInvitationEmails`, opener shared with `openEventToGuests` | `src/lib/data/mock.ts:1082`, `:1116`, `:817` | yes |
| 4.2 mock `deleteEvent` keeps rows with null `eventId` | `src/lib/data/mock.ts:3326`–`:3330` | yes |
| 4.3 table, check, unique `(event_id, lower(email))`, RLS | migration `:57`–`:74` | yes, `on delete set null` |
| 4.3 `invite_to_event` steps 1–6 | migration `:86`–`:140` | yes; no read of `public.member` or `auth.users` in its body |
| 4.3 `email_invitation()` and trigger | migration `:151`–`:255` | yes; whole body in `exception when others`, returns `new`; never to inviter or event email off `:204`; guest token or nothing `:218`–`:223` |
| 4.3 policy, grants | migration `:263`–`:280` | yes, as § 4.3 |
| 4.4 `InvitationEmailKind`, `InvitationEmailRequest`, `parseInvitationEmailRequest`, `renderInvitationEmail` | `supabase/functions/send-event-email/template.ts:446`, `:449`, `:465`, `:509` | yes; member delegates to `renderEventEmail` `event_invited`; guest button `/guest/<token>`, no profile link |
| 4.4 `index.ts` dispatch, log, `invitationId` answer | `supabase/functions/send-event-email/index.ts:107`–`:131` | yes; log names id and kind only |
| 4.5 `LoadState.invitations`, load only when managing, panel, `onInvited` | `src/routes/EventDetail.tsx:115`–`:118`, `:156`, `:297`, `:521` | yes |
| 4.5 `parseInvitationInput`, `invalidInvitationEmails` | `src/routes/EventDetail.tsx:73`, `:78` | yes |
| 4.6 selectors | `src/routes/EventDetail.tsx:568`, `:577`, `:586`, `:595`, `:605`, `:609`, `:625`, `:642`, `:647`, `:656` | all ten present |
| § 7 glossary row | `.ai/registry/glossary.md:56` | written at PLAN |
| § 7 standards rows | `.ai/standards/rbac-and-security.md:99`–`:103` | yes |

## R7 detail

`invariants_touched: []`. Each standing invariant reasoned individually:

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 (the absence denominator is `listMembers()`) | No policy or grant on `public.member` changes; the only read of `member`/`auth.users` is inside the definer trigger, which returns nothing to a caller | migration `:193`–`:200`, `:247`; diff touches no `member` policy |
| INV-01, INV-02, INV-03, INV-05, INV-06, INV-07 | They constrain entries; nothing in this diff reads or writes an entry — the migration touches only `event_email_invitation` and inserts into `event_guest_link` | migration `:126`, `:131` |

## Findings

None.

## Verdict

`PASS`.
