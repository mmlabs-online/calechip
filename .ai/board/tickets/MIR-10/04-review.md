---
ticket: MIR-10
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-27T03:29:30Z
inputs_read:
  - .ai/board/tickets/MIR-10/01-plan.md
  - .ai/board/tickets/MIR-10/03-impl-log.md
  - .ai/board/tickets/MIR-10/ticket.yaml
  - .ai/board/tickets/MIR-10/verification.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/glossary.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/boundaries.json
  - .ai/standards/data-model.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - src/lib/data/absence.ts
  - eslint.config.js
  - package.json
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
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs <ID>` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-10/ticket.yaml:16-20`, `.ai/board/tickets/MIR-10/01-plan.md:379-384`; `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-10, 8 changed file(s)` / `allowed-paths: PASS` (exit 0); `node scripts/check-carry.mjs MIR-10` → `check-carry: ticket MIR-10, 0 uncommitted path(s)` / `check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm exec tsc --noEmit` exited 0 with no output (`package.json:10`) |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm exec eslint .` exited 0 with no output (`eslint.config.js:50-94`) |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `eslint.config.js:20,60-79` and `.ai/registry/boundaries.json:17-32` enforce `@supabase/*` imports only inside `src/lib/data/`; no file under `src/**` is modified in `origin/main...HEAD` (`.ai/board/tickets/MIR-10/01-plan.md:363-367`) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md:1-281`, `.ai/registry/glossary.md:1-5,63-65`, `.ai/standards/data-model.md:1-5,21-25,288-402`, `.ai/board/tickets/MIR-10/verification.md:1-69` |
| R6 | Permission gating matches plan section 3 | PASS | `.ai/board/tickets/MIR-10/01-plan.md:254-268` declares `schema_delta: none` and specifies six target database permission boundaries, all present in `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md:58-227` and `.ai/standards/data-model.md:295-385`: composite FKs on all 12 tables (`ADR-070:135-138,179-227`, `data-model.md:345-346,365-385`), `org_code` uniqueness/shape/29-token reserved list/immutability trigger (`ADR-070:86-116`, `data-model.md:315,325-331`), `org_one_shared_tenant_idx` (`ADR-070:109-111`, `data-model.md:317`), one org per user via `member.id` PK + `member.org_id` (`ADR-070:186-188`, `data-model.md:375`), `membership_active_team_member_idx` + `membership_one_active_primary_idx` + `membership_inactive_not_primary` (`ADR-070:141-151`, `data-model.md:348,352-354`), and `public.team_role` vs `public.member_role` vs `system_admin` split (`ADR-070:58-70`, `data-model.md:295-306`) |
| R7 | No invariant violated (RULE-07) | PASS | `.ai/registry/invariants.md:36,39,170-185`, `src/lib/data/absence.ts:106-107,121-148,197-207`, `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md:123-203,229-245`, `.ai/standards/data-model.md:337-376,387-402` |
| R8 | No dependency added without an ADR | PASS | `package.json:20-52` is unchanged in `git diff origin/main...HEAD` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 item 1 — `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md` accepted at PLAN (`doc_version: 3`, `last_updated: 2026-10-27`, `governed_by: [RULE-01, RULE-04, RULE-07, RULE-09]`, §§ 1–5 DDL and temporal contract) | `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md:1-5,11,58-245` | Yes — front-matter matches (`:1-5`), status is `` `ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)` `` (`:11`), and §§ 1–5 specify `public.team_role` (`:58-70`), `public.org` (`:72-122`), `public.membership` (`:123-178`), composite FKs across all 12 tables (`:179-227`), and the temporal `INV-04`/`INV-07` contract (`:229-245`) |
| §4.1 item 2 — `.ai/registry/glossary.md` updated (`last_updated: 2026-10-27`) with `glossary_owed` rows **Org**, **Org public**, **Membership** | `.ai/registry/glossary.md:1-5,63-65` | Yes — `last_updated: 2026-10-27` (`:3`), **Org** (`:63`), **Org public** (`:64`), and **Membership** (`:65`) present and match `ticket.yaml:21` |
| §4.2 item 1 — `.ai/standards/data-model.md` front-matter bump to `doc_version: 9` and `last_updated: 2026-10-27` | `.ai/standards/data-model.md:1-5` | Yes — `doc_version: 9` (`:2`) and `last_updated: 2026-10-27` (`:3`) |
| §4.2 item 2 — `.ai/standards/data-model.md` `### team` intro updated to link ADR-070 and reference `## Multi-tenancy target schema (MIR-10, ADR-070)` | `.ai/standards/data-model.md:21-25` | Yes — matches the exact replacement text in `01-plan.md:293-297` |
| §4.2 item 3 — Append `## Multi-tenancy target schema (MIR-10, ADR-070)` at the end of `.ai/standards/data-model.md` with all five required subsections | `.ai/standards/data-model.md:288-402` | Yes — contains `### New enum: team_role` (`:295-306`), `### org` (`:308-335`, with all 29 reserved tokens as bare strings at `:326-331`), `### membership` (`:337-363`), `### Composite foreign keys and org_id across existing tables (MIR-11, MIR-12, MIR-14, MIR-21)` (`:365-385`, covering all 12 tables and `on delete set null (event_id)` on `event_guest` and `notification`), and `### Temporal multi-team absence count (INV-04, INV-07)` (`:387-402`) |
| §4.3 — Create `.ai/board/tickets/MIR-10/verification.md` with required front-matter and sections 1–4 (`AC-1..AC-8`, audit coverage `A:81-305`, `A:799-813`, `A:917-983`, downstream handoff `MIR-11..MIR-21`, and verification command outputs) | `.ai/board/tickets/MIR-10/verification.md:1-69` | Yes — front-matter matches (`:1-7`), §1 AC-1..AC-8 table (`:11-22`), §2 audit coverage matrix (`:24-43`), §3 downstream ticket handoff matrix (`:45-59`), and §4 verification commands run (`:61-69`) |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| `INV-04` — The absence count for a team on a date is the sum, over that date's `pending` and `approved` entries whose member was still on that team on that date, of 1 per `full` portion and 0.5 per `am` or `pm` portion, with PTO and WFH counted alike; rejected entries excluded; no second definition exists anywhere in the system | `MIR-10` modifies no runtime code or SQL migration (`schema_delta: none`), so `absenceCountsFor` and `walk` in `src/lib/data/absence.ts:106-107,121-148,197-207` remain untouched in the running system. In the target schema designed by `MIR-10`, `absenceCountsFor` in `src/lib/data/absence.ts` is explicitly preserved as the single calculation site (no SQL view, RPC or second TypeScript function, `ADR-070:231-233`, `.ai/standards/data-model.md:389-391`), and `public.membership` records `[joined_at, left_at)` historical windows where leaving a team sets `left_at` instead of deleting the row (`ADR-070:133-140,167-170`, `.ai/standards/data-model.md:349-350`) and `MIR-12` backfills `joined_at = member.created_at` and `left_at = member.removed_at` (`ADR-070:171-177`, `.ai/standards/data-model.md:359-363`), so every date's count evaluates whether the member was on that team on that date (`joined_at::date <= d and (left_at is null or left_at::date > d)`). | `src/lib/data/absence.ts:106-107,121-148,197-207`, `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md:133-140,167-177,231-245`, `.ai/standards/data-model.md:349-350,359-363,389-402` |
| `INV-07` — Every entry belongs to exactly one member, and is counted against every team that member belongs to | `public.entry` remains owned by a single member via `member_id uuid not null` with composite FK `entry_member_org_fk` (`(member_id, org_id) references public.member (id, org_id) on delete restrict`) and `entry_no_overlapping_portion` keyed on `member_id` (`ADR-070:191-198`, `.ai/standards/data-model.md:376`), while team membership is N:M through `public.membership` (`ADR-070:125-162`, `.ai/standards/data-model.md:339-358`). Under the temporal contract (`ADR-070:234-245`, `.ai/standards/data-model.md:392-402`), an entry of a member on *k* active teams on date `d` is included in the absence count of each of those *k* teams and excluded from teams joined after `d` or left on or before `d`. | `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md:125-162,191-198,234-245`, `.ai/standards/data-model.md:339-358,376,392-402` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS`
