---
ticket: EVT-05
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-09T09:12:55+0700
inputs_read:
  - .ai/board/tickets/EVT-05/01-plan.md
  - .ai/board/tickets/EVT-05/ticket.yaml
  - .ai/registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md
  - .ai/standards/testing-standards.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/functions/.env  # variable names only; no value read into any file
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/routes/Profile.tsx
  - src/components/NotificationBell.tsx
  - src/index.css
  - tests/notifications.test.ts
  - tests/e2e/solo-profile.spec.ts
  - tests/e2e/evt-04-notifications.spec.ts
  - eslint.config.js
  - tsconfig.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-05 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261009090000_evt05_event_email.sql` | created | The column, the only writer, the hand-off trigger and their grants; the header lists the six human steps in order | § 4.3 |
| `supabase/functions/send-event-email/template.ts` | created | The pure, import-free module both Deno and Vitest load: the request parser, the date formatter, the renderer | § 4.4, § 4.5 `template.ts`, § 2b email |
| `supabase/functions/send-event-email/index.ts` | created | The Deno entry point: secret first, then environment, then body; one SMTP send to `to` alone | § 4.5 `index.ts` |
| `src/lib/data/index.ts` | modified | The two seam signatures and their docblocks, verbatim from the plan | § 4.2 |
| `src/lib/data/supabase.ts` | modified | Real read (`member.event_email_enabled`) and write (`rpc("set_event_email")`), the failure sentence | § 4.2 `supabase.ts` |
| `src/lib/data/mock.ts` | modified | The switch map (absent = on), the trigger reproduced inside `notify`, the outbox and `__sentEventEmails`, reset by `__resetEvents` | § 4.2 `mock.ts` |
| `src/routes/Profile.tsx` | modified | The **Email** card with `profile-event-email`, loaded in `load()`, saved by the one save button between profile and password | § 4.6, § 2b switch |
| `tests/event-email.test.ts` | created | AC-1 to AC-16 through the mock, the template and by reading the migration and the sender | § 5 tests |
| `tests/e2e/evt-05-event-email.spec.ts` | created | AC-7 and AC-14 on `/profile` | § 5 tests |
| `.ai/standards/data-model.md` | modified | The `event_email_enabled` row under `member` | § 6 standards |
| `.ai/standards/rbac-and-security.md` | modified | The § 3 rows for the switch, the trigger and the sender, in § *The permission table* | § 6 standards |
| `.ai/board/tickets/EVT-05/03-impl-log.md` | created | This file | gate |
| `.ai/board/tickets/EVT-05/ticket.yaml` | modified | `state: REVIEW` | gate |

**Dirty on the tree and not mine:** `.ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md`
(+2 lines, `orchestrator`'s record of the Q6 answers). It was dirty when this stage began and is not
touched here. ADR-053 is on `allowed_paths` and was not edited (§ 7).

## Contract items

| Plan item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 no domain type changes | — | `src/lib/domain/types.ts` untouched |
| § 4.2 `getEventEmailEnabled` | `src/lib/data/index.ts:1416`, `supabase.ts:3409`, `mock.ts:3273` | null for no user / no row |
| § 4.2 `setEventEmailEnabled` | `src/lib/data/index.ts:1421`, `supabase.ts:3425`, `mock.ts:3280` | null RPC result or removed/no row → `unknown`, "Your email setting could not be saved."; `status === 0` → `network` with the existing network sentence |
| § 4.2 mock switch map, absent = `true` | `mock.ts:832-836` | cleared in `__resetEvents` (`mock.ts:587`) |
| § 4.2 mock trigger + outbox, `MockEventEmail`, `__sentEventEmails` | `mock.ts:808`, `mock.ts:838-868` | Called from `notify` after each push, so every EVT-04 recipient rule is inherited. `to` is `Member.email` — recorded in the comment |
| § 4.3 1 `create extension if not exists pg_net` | migration `:64` | TODO(verify) kept |
| § 4.3 2 `event_email_enabled boolean not null default true`, no update grant | migration `:70-76` | plus a no-op `revoke update (event_email_enabled)` as a statement of intent; its comment says why it is not the fence |
| § 4.3 3 `set_event_email(p_enabled)` | migration `:84-91` | shape transcribed verbatim |
| § 4.3 4 `email_notification()` and trigger | migration `:103-172` | Vault → body (switch, address, own-team for `event_created`) → `net.http_post`; whole body in `exception when others … raise warning`, `return new` on every path; `when` lists the five kinds |
| § 4.3 body shape | migration `:117-131` | camelCase, dates via `to_char(…, 'YYYY-MM-DD')`, `kind` as text |
| § 4.3 grants | migration `:181-185` | revoke from `public, anon`; grant to `authenticated`, both functions |
| § 4.3 header and human steps | migration `:1-58` | in the order § 4.3 lists |
| § 4.4 subjects, headlines, greeting, button, footer, plain text | `template.ts:146-171`, `:192-` | headline equals `notificationSentence` for each kind — asserted |
| § 4.5 `template.ts` exports | `template.ts:18`, `:26`, `:41`, `:86`, `:115`, `:192` | exactly the five plan exports; imports nothing |
| § 4.5 `index.ts` | `index.ts:57` | `npm:nodemailer@10`; 405 / 401 / 500 / 400 / 502 / 200 as tabulated; constant-time secret compare; secret checked before env and body |
| § 4.6 `profile-event-email` | `Profile.tsx:598` | `role="switch"`, `aria-checked`, `aria-label="Event email"`, `data-enabled`; disabled until the read answers non-null |
| § 4.6 save sequencing | `Profile.tsx:268`, `:317` | switch-only change is a change; profile → switch → password |
| § 4.6 header paragraph | `Profile.tsx:38-41` | |
| § 6 standards | `data-model.md:41`, `rbac-and-security.md:74-79` | |

## Deviations from the design

1. **The e2e "reload" step is driven as leaving `/profile` and opening it again by clicking, not a
   browser reload.** § 5 says "reload, still off". A `page.goto`/reload resets the mock's module
   state (recorded in `evt-04-notifications.spec.ts` and `solo-profile.spec.ts`), so a reload would
   put the switch back to its default and could only ever fail. Unmounting the screen and opening it
   again runs `load()` → `getEventEmailEnabled()` again, which is the same read a reload makes against
   the real datastore. Recorded in the spec's header.
2. **Email colours.** § 2b says "the primary colour" and "dark ink" without values; the template uses
   the app's own tokens, `--color-primary` `#2A2145` and `--color-ink` `#241F45` from `src/index.css`,
   and the grey `#6E6A80` for the greeting and footer. The page, border and panel tints are § 2b's
   values exactly.
3. **The sender's failure log redacts anything shaped like an address** from the SMTP error message.
   § 4.5 says the log never names the address; an SMTP refusal often quotes the recipient back, so
   logging the raw message would have broken that sentence.
4. **A missing `EMAIL_HOOK_SECRET` answers 401, not 500.** § 4.5 orders the secret check before the
   environment check "so an unauthenticated caller learns nothing about the configuration"; answering
   500 when the expected secret is unset would tell exactly that. Every other missing variable is 500.
5. **Outcome copy.** A save that changes only the switch reports `Profile saved.`; switch plus
   password reports `Profile and password saved.`; a switch failure after a saved profile reports
   `Your profile was saved, but your email setting was not.` § 4.6 says failures go to
   `profile-outcome` "as the others do" without fixing sentences; these follow the existing ones.

## Invariants

`invariants_touched: []`, and nothing above reaches one. The migration creates, drops and alters no
policy on `public.member`, grants no update on the new column, and replaces no EVT-04 function —
asserted by `tests/event-email.test.ts` › *the migration* › AC-16. INV-04 (`removed_at`) and INV-07
(`team_id`) are untouched; `listMembers()` is equal before and after a switch change and a fan-out
(asserted). No entry is created, read or changed.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | lints `supabase/functions/**/*.ts` too; no config widened |
| `pnpm exec vitest run` | 0 | 31 files, 549 tests; `tests/event-email.test.ts` 32 |
| `pnpm exec playwright test` | 0 | 328 passed, including `evt-05-event-email.spec.ts` (3), `solo-profile.spec.ts` and `evt-04-notifications.spec.ts` unchanged and green |
| `node scripts/check-docs.mjs` | 0 | errors 0; the 2 D8 warnings are pre-existing and not in files touched here |
| `git diff --name-only` ⊆ `allowed_paths` + ticket folder | yes | bar the idea file named above, which is not this stage's |

`tests/notifications.test.ts` was not edited and passes — the mock's `notify` changed no in-app
behaviour.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `profile-event-email` | `src/routes/Profile.tsx:598` |

## Open questions

None blocking. Still owed by humans before the first email leaves (migration header, RULE-09):
`APP_URL` and `EMAIL_HOOK_SECRET` in `supabase/functions/.env`, `supabase secrets set`,
`supabase functions deploy send-event-email --no-verify-jwt`, the two Vault secrets, and one real send.
Three TODO(verify)s stand: `net.http_post`'s parameter names, `pg_net`'s queue rolling back with the
write, and `nodemailer@10` on 465 under the Edge Runtime. Owed to `/thuki` per § 1: the
`tech-stack.md` line, `integrations.md`, and the `boundaries.json` entry for ADR-053 revert
condition 2.
