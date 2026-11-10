---
ticket: EVT-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-09T09:47:11+0700
inputs_read:
  - .ai/board/tickets/EVT-05/01-plan.md
  - .ai/board/tickets/EVT-05/03-impl-log.md
  - .ai/board/tickets/EVT-05/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md
  - supabase/migrations/20261009090000_evt05_event_email.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/functions/send-event-email/index.ts
  - supabase/functions/send-event-email/template.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/Profile.tsx
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
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

# EVT-05 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs EVT-05` → `17 changed file(s)` … `exempt .ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md <- the idea that promoted EVT-05 (ADR-054)` … `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs EVT-05` → `0 uncommitted path(s)` … `PASS — nothing stray`, exit 0. `.ai/board/backlog.md` is ship-owned. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint` on the 8 changed `.ts`/`.tsx` files exit 0. Repo-wide `eslint .` reports 1 error outside the diff: `scripts/check-allowed-paths.mjs:144:7 no-useless-assignment` — chore, see Findings |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/routes/Profile.tsx:48` imports only `seam`; reads at `Profile.tsx:218`, writes at `Profile.tsx:317`. Datastore calls only in `src/lib/data/supabase.ts:3409-3440`. `grep -rn "send-event-email\|functions.invoke" src/` → no match (AC-13) |
| R5 | Every § 4 contract item implemented | PASS | R5 detail below |
| R6 | Permission gating matches § 3 | PASS | `supabase/migrations/20261009090000_evt05_event_email.sql:84-91` (own row, `removed_at is null`, no member id); `:76` no column update grant; `:181-185` execute revoked from `public, anon`, granted to `authenticated`; `:141-144` switch and own-team scope; `supabase/functions/send-event-email/index.ts:64-68` secret checked first, constant-time (`:46-55`); mock `src/lib/data/mock.ts:3280-3286` refuses no row / removed |
| R7 | No invariant violated | PASS | `invariants_touched: []`; R7 detail below |
| R8 | No dependency without an ADR | PASS | `supabase/functions/send-event-email/index.ts:23` `npm:nodemailer@10` is covered by `ADR-053…md:53-54` ("the only dependency this ADR adds"). `package.json` and `pnpm-lock.yaml` unchanged on `origin/main...HEAD` |

Tests, run by this review: `pnpm exec vitest run` — 31 files, 549 passed. `pnpm exec playwright test tests/e2e/evt-05-event-email.spec.ts tests/e2e/solo-profile.spec.ts` — 15 passed.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 no domain type change | `src/lib/domain/types.ts` absent from the branch diff | yes |
| § 4.2 `getEventEmailEnabled(): Promise<boolean \| null>` | `src/lib/data/index.ts:1416`, `src/lib/data/supabase.ts:3409-3421`, `src/lib/data/mock.ts:3273-3277` | yes — null for no user / no row, throws on read error (`supabase.ts:3419`) |
| § 4.2 `setEventEmailEnabled(enabled): Promise<Result<boolean>>` | `src/lib/data/index.ts:1421`, `src/lib/data/supabase.ts:3425-3440` (`rpc("set_event_email", { p_enabled })`, non-boolean → `unknown` "Your email setting could not be saved.", `status === 0` → `network`), `src/lib/data/mock.ts:3280-3286` | yes |
| § 4.2 mock switch map, absent = `true`, reset by `__resetEvents` | `src/lib/data/mock.ts:834-836`, `:587` | yes |
| § 4.2 mock trigger in `notify` + `MockEventEmail` + `__sentEventEmails` | `src/lib/data/mock.ts:807-808` (call after push), `:838-843`, `:850-862`, `:866-868` | yes — not on the `seam` object |
| § 4.3.1 `create extension if not exists pg_net` | migration `:64` | yes |
| § 4.3.2 `event_email_enabled boolean not null default true`, no update grant | migration `:70-76` | yes |
| § 4.3.3 `set_event_email(p_enabled boolean) returns boolean`, sql, definer, `search_path = ''` | migration `:84-91` | yes, verbatim |
| § 4.3.4 `email_notification()` — Vault names, body joins/where, `net.http_post`, `exception when others … raise warning`, `return new` | migration `:103-163`; names `:113`, `:116`; where `:140-144`; post `:150-157`; handler `:158-159`; return `:161` | yes — columns and enums confirmed against `20261008120000_evt04_notification.sql:62,72,75,78` and `20260929120000_evt01_event.sql:53,66,69` |
| § 4.3 trigger `after insert … when (kind in five)` | migration `:167-173` | yes |
| § 4.3 body shape, camelCase, dates `YYYY-MM-DD` | migration `:121-133` | yes; parser keys `template.ts:88`, `:95` |
| § 4.3 grants | migration `:181-185` | yes |
| § 4.3 header with the human steps in order | migration `:43-56` | yes |
| § 4.4 subjects and headlines | `supabase/functions/send-event-email/template.ts:147-166` | yes, all five |
| § 4.4 greeting, button, footer, plain text | `template.ts:185-188`, `:200-214` | yes |
| § 4.5 `template.ts` exports, imports nothing | `template.ts:18`, `:26`, `:41`, `:86`, `:115`, `:192`; no `import` in the file | yes |
| § 4.5 escaping `& < > " '` in html only | `template.ts:137-144`; used `:227`, `:239-245`, `:220`, `:251`, `:257` | yes |
| § 4.5 `index.ts` env (7 names), 405/401/500/400/502/200, secret before env and body, log never names address | `index.ts:26-34`, `:58-60`, `:64-68`, `:70-83`, `:85-94`, `:114-125` (address redacted `:117-120`), `:127` | yes |
| § 4.6 `profile-event-email`, `role="switch"`, `aria-checked`, `aria-label`, `data-enabled`, disabled until loaded | `src/routes/Profile.tsx:596-604` | yes |
| § 4.6 loaded in `load()` with own `catch` | `Profile.tsx:214-223` | yes |
| § 4.6 switch-only change is a change; profile → switch → password | `Profile.tsx:268-269`, `:314-329`, then password | yes |
| § 4.6 header paragraph | `Profile.tsx:37-41` | yes |
| § 6 standards rows | `.ai/standards/data-model.md:41`, `.ai/standards/rbac-and-security.md:74-79` | yes |

## R7 detail

`invariants_touched` is `[]`. No ID to reason through; the plan's reason it is empty (§ 2, *Invariants touched*) holds in the code:

| Invariant | Held by | Citation |
|---|---|---|
| (none listed) — INV-04 `removed_at`, INV-07 `team_id` | The migration adds one column and writes only it; no policy on `public.member` is created, dropped or altered; `member_enforce_role_and_removal` and every EVT-04 function are untouched | `supabase/migrations/20261009090000_evt05_event_email.sql:70-71`, `:86-90`; the file contains no `policy` statement and no `create or replace` of an EVT-04 function |
| (none listed) — INV-01/02/03/05/06, entries | No entry table is read or written by any changed file | `src/lib/data/mock.ts:850-862`, `src/lib/data/supabase.ts:3409-3440` touch only `member` and the outbox |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R3 (outside the diff) | `scripts/check-allowed-paths.mjs:144:7` — `no-useless-assignment` on `fm`. Not in this branch's diff; R3 passes. | human, as an `OPS-nnn` chore (ADR-041) | no |

## Verdict

PASS.
