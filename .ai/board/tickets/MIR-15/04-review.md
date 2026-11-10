---
ticket: MIR-15
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-05T13:59:00+07:00
inputs_read: [ .ai/board/tickets/MIR-15/01-plan.md, .ai/board/tickets/MIR-15/03-impl-log.md ]
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

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs MIR-15` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-15/ticket.yaml:16-27`, `.ai/board/tickets/MIR-15/01-plan.md:334-345`; `node scripts/check-allowed-paths.mjs` exit 0 (`allowed-paths: ticket MIR-15, 15 changed file(s) ... allowed-paths: PASS`); `node scripts/check-carry.mjs MIR-15` exit 0 (`check-carry: ticket MIR-15, 1 uncommitted path(s) / carried .ai/board/tickets/MIR-15/04-review.md <- this ticket / check-carry: PASS — nothing stray`) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm exec tsc --noEmit` exit 0 (0 errors) |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm exec eslint .` exit 0 (0 errors, 0 warnings across the repo including `src/routes/EventEditor.tsx`, `src/routes/Events.tsx`, and `tests/e2e/evt-01-events.spec.ts`) |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/EventEditor.tsx:36` (`import { seam, type DataSeam, type SaveEventInput } from "@/lib/data"`), `src/routes/Events.tsx:17` (`import { seam } from "@/lib/data"`), `src/lib/data/supabase.ts:1-11` (the sole importer of `@supabase/supabase-js`) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:33-133`, `supabase/tests/210-org-public-team-bound.test.sql:13-299`, `supabase/tests/010-catalogue.test.sql:64-65`, `supabase/tests/160-read-path-org-bound.test.sql:138-139,161-162,172-190`, `src/routes/EventEditor.tsx:75`, `src/routes/Events.tsx:25,28`, `tests/e2e/evt-01-events.spec.ts:117,174` |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:33-41` (`org_is_shared(uuid)` definer, revoked from `public, anon`, granted to `authenticated`), `:48-66` (`may_read_event`), `:68-84` (`event_select_visible`), `:88-104` (`is_event_audience`), `:112-133` (`notify_event_created`), `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:264-297` (`list_member_directory` reading `may_read_event` at `:282` and `:289`); verified in `supabase/tests/210-org-public-team-bound.test.sql:65-297` |
| R7 | No invariant violated (RULE-07) | PASS | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:34-48` (`member_select_team`, `team_select_own`, `entry_select_team` untouched), `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:26-135` (no `public.member` or `public.entry` policy touched), `src/lib/data/absence.ts:197-207` (`absenceCountsFor` is INV-04's single definition and is untouched) |
| R8 | No dependency added without an ADR | PASS | `package.json:19-52` (unchanged vs `origin/main`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 (1) `public.org_is_shared(p_org_id uuid) returns boolean` (`language sql stable security definer set search_path = ''`, revoked from `public, anon`, granted to `authenticated`) | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:33-41` | Yes — exact signature, security mode, body, `revoke all ... from public, anon` (`:40`) and `grant execute ... to authenticated` (`:41`) |
| § 4.1 (2) `public.may_read_event(p_event_id uuid, p_uid uuid) returns boolean` — `public` disjunct narrowed with `(not public.org_is_shared(e.org_id) or e.team_id in (select public.member_team_ids(p_uid)))` | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:48-66` | Yes — MIR-13-b body (`supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:64-80`) verbatim except the `scope = 'public'` disjunct (`:57-59`) |
| § 4.1 (2) Policy `event_select_visible` on `public.event` (`drop policy if exists` + `create policy ... for select to authenticated`) with narrowed `public` disjunct | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:68-84` | Yes — MIR-13-b policy (`supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:82-96`) verbatim except the `scope = 'public'` disjunct (`:76-78`) |
| § 4.1 (2) `public.is_event_audience(p_event_id uuid, p_uid uuid) returns boolean` with narrowed `public` disjunct | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:88-104` | Yes — MIR-13 body (`supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:606-620`) verbatim except the `scope = 'public'` disjunct (`:96-98`) |
| § 4.1 (3) `public.notify_event_created() returns trigger` — recipient predicate `((new.scope = 'public'::public.event_scope and not public.org_is_shared(new.org_id)) or new.team_id in (select public.member_team_ids(m.id)))` | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:112-133` | Yes — MIR-13-b body (`supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:166-187`) verbatim except the recipient predicate (`:124-125`) |
| § 4.1 `list_member_directory()`, `save_event`, `invite_to_event`, `may_manage_event`, `is_event_participant` not redefined | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:14-16,26-135` | Yes — none of those functions is redefined in the migration |
| § 4.2 pgTAP suite `supabase/tests/210-org-public-team-bound.test.sql` covering `org_is_shared` answers/grants and AC-1 through AC-15 | `supabase/tests/210-org-public-team-bound.test.sql:13-299` | Yes — `plan(41)` (`:13`), `org_is_shared` checks and grants (`:65-71`), AC-1..AC-15 (`:77-297`) |
| § 4.3 Census in `supabase/tests/010-catalogue.test.sql` adding `'public.org_is_shared(uuid)'` | `supabase/tests/010-catalogue.test.sql:64-65` | Yes — added to AC-12 security-definer array citing `210-org-public-team-bound.test.sql` |
| § 4.4 Mock seam unchanged (split to MIR-15-d) | `.ai/board/tickets/MIR-15-d/ticket.yaml:7-71` | Yes — `src/lib/data/mock.ts` is untouched on the branch and sub-tickets `.ai/board/tickets/MIR-15-b/ticket.yaml:7`, `.ai/board/tickets/MIR-15-c/ticket.yaml:7`, `.ai/board/tickets/MIR-15-d/ticket.yaml:7` are created with ADR-076 (`.ai/registry/decisions/ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md:7-109`) |
| § 4.5 Screen strings in `src/routes/EventEditor.tsx` and `src/routes/Events.tsx` | `src/routes/EventEditor.tsx:75`, `src/routes/Events.tsx:25,28` | Yes — `{ scope: "public", label: "Public", hint: "Your whole organisation — or only your team, on the shared space" }` (`EventEditor.tsx:75`) and `public: "Public"` with comment `Public peach` (`Events.tsx:25,28`) |
| § 4.6 Updated assertions in `supabase/tests/160-read-path-org-bound.test.sql` and `tests/e2e/evt-01-events.spec.ts` | `supabase/tests/160-read-path-org-bound.test.sql:138-139,161-162,172-190`, `tests/e2e/evt-01-events.spec.ts:117,174` | Yes — AC-6 `set_eq` expects `team_t` members only (`160:182-190`), comments added at `:138-139` and `:161-162`, and both e2e scope badge assertions expect `"Public"` (`evt-01-events.spec.ts:117,174`) |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 | `absenceCountsFor` in `src/lib/data/absence.ts` is the single definition of the absence count, fed by `listMembers()` and `listTeamEntriesOverlapping()` whose database policies (`member_select_team`, `team_select_own`, `entry_select_team`) remain on `member_primary_team_id`. MIR-15 modifies only `org_is_shared`, `may_read_event`, `event_select_visible`, `is_event_audience` and `notify_event_created`, and does not alter `public.member` select policies, `public.entry` policies, or `absenceCountsFor`. | `src/lib/data/absence.ts:197-207`, `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:34-48`, `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:26-135` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

PASS
