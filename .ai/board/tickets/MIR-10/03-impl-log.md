---
ticket: MIR-10
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-27T03:23:38Z
inputs_read:
  - .ai/board/tickets/MIR-10/01-plan.md
  - .ai/board/tickets/MIR-10/ticket.yaml
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/glossary.md
  - .ai/registry/invariants.md
  - .ai/standards/data-model.md
  - .ai/standards/testing-standards.md
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/git-conventions.md
  - .ai/templates/impl-log.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - src/lib/data/absence.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-10 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `.ai/standards/data-model.md` | modified | Bump `doc_version` to `9` (`last_updated: 2026-10-27`), update `### team` intro to link ADR-070 and the target schema section, and append `## Multi-tenancy target schema (MIR-10, ADR-070)` covering `public.team_role`, `public.org`, `public.membership`, composite FKs across all 12 existing data tables, and the temporal `INV-04` / `INV-07` absence-count contract | §4.2 items 1, 2, 3 |
| `.ai/board/tickets/MIR-10/verification.md` | created | Record Phase 3 schema design verification against AC-1..AC-8, audit sections (`A:81-305`, `A:799-813`, `A:917-983`), downstream tickets `MIR-11..MIR-21`, and verification command outputs | §4.3 items 1, 2, 3, 4 |
| `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md` | created | Authored and accepted at PLAN under ADR-067 delegation (`doc_version: 3`, `last_updated: 2026-10-27`); verified present and unaltered at `IN_PROGRESS` | §4.1 item 1 |
| `.ai/registry/glossary.md` | modified | Updated at PLAN (`last_updated: 2026-10-27`) with rows for **Org**, **Org public** and **Membership** (`glossary_owed`); verified present and unaltered at `IN_PROGRESS` | §4.1 item 2 |
| `.ai/board/tickets/MIR-10/ticket.yaml` | modified | Set `state: REVIEW` on `IN_PROGRESS` gate PASS per `.claude/commands/implement.md` | stage transition (`state: REVIEW`) |
| `.ai/board/tickets/MIR-10/03-impl-log.md` | created | Record `IN_PROGRESS` implementation log, contract mapping, invariant reasoning and verification runs | `IN_PROGRESS` stage artifact |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 item 1 — `ADR-070-the-org-and-multi-team-membership-schema.md` | `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md:1-281` | Verified complete and unaltered (`doc_version: 3`, status `` `ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)` `` at line 11, DDL and temporal contract in §§ 1–5 at lines 58–245). |
| §4.1 item 2 — `.ai/registry/glossary.md` (`Org`, `Org public`, `Membership`) | `.ai/registry/glossary.md:1-5,63-65` | Verified complete and unaltered (`last_updated: 2026-10-27` at line 3; **Org** at line 63, **Org public** at line 64, **Membership** at line 65). |
| §4.2 item 1 — `.ai/standards/data-model.md` front-matter bump | `.ai/standards/data-model.md:1-5` | `doc_version: 9`, `last_updated: 2026-10-27`. |
| §4.2 item 2 — `.ai/standards/data-model.md` `### team` intro | `.ai/standards/data-model.md:21-25` | Updated to link `[ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md)` and point to `## Multi-tenancy target schema (MIR-10, ADR-070)` below. |
| §4.2 item 3 — `.ai/standards/data-model.md` `## Multi-tenancy target schema (MIR-10, ADR-070)` | `.ai/standards/data-model.md:288-402` | Appended after item 5 of `## OPEN QUESTIONS` with all five required subsections: `### New enum: team_role` (`:295-306`), `### org` (`:308-335`), `### membership` (`:337-363`), `### Composite foreign keys and org_id across existing tables (MIR-11, MIR-12, MIR-14, MIR-21)` (`:365-385`), and `### Temporal multi-team absence count (INV-04, INV-07)` (`:387-402`). |
| §4.3 — `.ai/board/tickets/MIR-10/verification.md` | `.ai/board/tickets/MIR-10/verification.md:1-92` | Created with the required front-matter (`:1-7`) and four sections: `## 1. Acceptance criteria verification (AC-1 to AC-8)` (`:11-22`), `## 2. Audit coverage matrix (A:81-305, A:799-813, A:917-983)` (`:24-43`), `## 3. Downstream ticket handoff matrix (MIR-11 to MIR-21)` (`:45-59`), and `## 4. Verification commands run` (`:61-69`). |

## Deviations from the design

`none`

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | This ticket changes no runtime code or database table (`schema_delta: none`), and in the target schema (`ADR-070:123-178,229-245`, `.ai/standards/data-model.md:337-363,387-402`) `absenceCountsFor` in `src/lib/data/absence.ts:197-207` remains the sole calculation of the absence count while `public.membership` preserves historical `[joined_at, left_at)` team windows (soft-leaving sets `left_at` instead of deleting the row, and MIR-12 backfills `joined_at = member.created_at` and `left_at = member.removed_at`) so every date's count evaluates whether the member was on that team on that date. |
| `INV-07` | `public.entry` remains owned by a single member (`member_id`, with `entry_no_overlapping_portion` keyed on `member_id` and `primary_team_id` recording the primary team at creation) while team membership becomes N:M via `public.membership` (`ADR-070:123-203,233-245`, `.ai/standards/data-model.md:337-376,392-402`), so an entry of a member on *k* active teams on date `d` is counted once against each of those *k* teams. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | same |
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS` |
| `node scripts/check-carry.mjs MIR-10` | 0 | `check-carry: PASS — nothing stray` |
| `node scripts/check-docs.mjs` | 1 | Zero errors on any file in `MIR-10`'s `allowed_paths` (`ADR-070`, `glossary.md`, `data-model.md`); the single `FAIL D9` is pre-existing on `ADR-068` (`doc_version: 2`), which is outside `allowed_paths` per RULE-03 (`01-plan.md` AC-8). |
| `git diff --name-only` subset of `allowed_paths` | yes | verified by `node scripts/check-allowed-paths.mjs` and `node scripts/check-carry.mjs MIR-10` |

## Testability contract

Plan section 2b specifies no UI or selector changes (`Visual reference: none`).

## Open questions

`none`
