---
ticket: EVT-11
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-13T07:20:39+00:00
inputs_read:
  - .ai/board/tickets/EVT-11/01-plan.md
  - .ai/board/tickets/EVT-11/03-impl-log.md
  - .ai/board/tickets/EVT-11/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - "git diff origin/main...HEAD (15 files) and the working tree (clean)"
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/lib/viewed-team.ts
  - eslint.config.js
  - playwright.config.ts
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

# EVT-11 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (15 changed files: the eleven `allowed_paths`, the ticket folder, `.ai/board/backlog.md` ship-owned). `node scripts/check-carry.mjs EVT-11` → `0 uncommitted path(s)`, `PASS — nothing stray` |
| R2 | typecheck exit 0, whole-program | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint <9 changed .ts/.tsx>` exit 0; repo-wide `pnpm exec eslint .` exit 0, nothing outside the diff to route |
| R4 | Nothing outside the seam reaches the datastore (RULE-02) | PASS | Only `src/lib/data/supabase.ts:3308`, `:3585` change datastore reads. `src/lib/description-image.ts:1-78`, `src/components/DescriptionEditor.tsx:7-31`, `src/components/DescriptionHtml.tsx` import no `@supabase/*` (grep, no match); the rule that would refuse it is `eslint.config.js:64-69`, and lint is clean |
| R5 | Every § 4 contract item implemented (RULE-04) | PASS | See *R5 detail*. `pnpm exec vitest run` 37 files / 710 tests pass; Playwright `evt-11-description-pictures.spec.ts` + `evt-10-description.spec.ts` 15 passed (run with a temporary config pointing at `/opt/pw-browsers/chromium`, deleted afterwards) |
| R6 | Permission gating matches § 3 | PASS | No grant, policy, RPC or function changed: the only migration is `supabase/migrations/20261013090000_evt11_description_bounded.sql:9-14`, a row-local `CHECK` — the server-side control § 3 names. Content control is the render: `src/components/DescriptionHtml.tsx:38`, `:100-102`, `:137`; links still bound by `:126` (`ALLOWED_URI_REGEXP: DESCRIPTION_HREF`). Editor and seam checks are affordances only (`src/components/DescriptionEditor.tsx:236-240`, `src/lib/data/supabase.ts:220-222`) |
| R7 | No invariant violated (RULE-07) | PASS | `invariants_touched: []`; per-ID reasoning in *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` absent from `git diff --stat origin/main...HEAD`. `Node` comes from the already-installed `@tiptap/react` (`src/components/DescriptionEditor.tsx:8`), not `@tiptap/extension-image` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `DESCRIPTION_MAX_BYTES = 1048576` | `src/lib/domain/types.ts:994` | yes |
| 4.1 `DESCRIPTION_IMAGE_TYPES` | `src/lib/domain/types.ts:996` | yes, `as const` |
| 4.1 `DESCRIPTION_IMAGE_MAX_INPUT_BYTES`, `DESCRIPTION_IMAGE_MAX_EDGE` | `src/lib/domain/types.ts:997-998` | yes |
| 4.1 `descriptionBytes(html: string \| null): number` | `src/lib/domain/types.ts:1001` | yes — `TextEncoder`, null → 0 |
| 4.1 `CalEvent.description` docblock | `src/lib/domain/types.ts:1018-1019` | yes |
| 4.2 `DESCRIPTION_IMAGE_REFUSED` | `src/lib/description-image.ts:12` | yes, verbatim |
| 4.2 `downscaleToDataUrl(file: File): Promise<Result<string>>` | `src/lib/description-image.ts:43`; scale never > 1 at `:55`; WebP 0.8 at `:63`, JPEG 0.85 fallback at `:69` | yes |
| 4.3 `img` in `DESCRIPTION_TAGS`, `img: ["src","alt"]` | `src/components/DescriptionHtml.tsx:19`, `:30` | yes |
| 4.3 `DESCRIPTION_IMAGE_SRC` | `src/components/DescriptionHtml.tsx:38` | yes, verbatim |
| 4.3 hook drops non-matching `src` on `img` | `src/components/DescriptionHtml.tsx:100-102` | yes |
| 4.3 `img` without `src` removed after the walk | `src/components/DescriptionHtml.tsx:137` | yes |
| 4.3 `ALLOWED_URI_REGEXP` stays `DESCRIPTION_HREF` | `src/components/DescriptionHtml.tsx:126` | yes |
| 4.3 picture rule on `DESCRIPTION_RENDER_CLASS` | `src/components/DescriptionHtml.tsx:152` | yes |
| 4.4 `DescriptionImage` node, `Node` from `@tiptap/react` | `src/components/DescriptionEditor.tsx:8`, `:37-50` | yes, as specified |
| 4.4 pick steps 1–4 | `src/components/DescriptionEditor.tsx:227-245` (step 4 at `:231`, before the await) | yes |
| 4.4 `DESCRIPTION_PICTURE_TOO_LARGE` | `src/components/DescriptionEditor.tsx:53-54` | yes, verbatim |
| 4.4 selectors | `src/components/DescriptionEditor.tsx:306`, `:311`, `:320` | yes |
| 4.5 `EVENT_LIST_COLUMNS`, `DESCRIPTION_TOO_LARGE` | `src/lib/data/supabase.ts:147-149`, `:203` | yes, verbatim |
| 4.5 list reads select `EVENT_LIST_COLUMNS`; `getEvent` keeps `EVENT_COLUMNS` | `src/lib/data/supabase.ts:3308`, `:3585`; `:3332` | yes |
| 4.5 `EventRow.description` optional, `toEvent` maps absent to null | `src/lib/data/supabase.ts:127`, `:157` | yes |
| 4.5 `eventInputFailure` cap check after the four | `src/lib/data/supabase.ts:220-222` | yes |
| 4.5 `toEventFailure` 23514 cap branch before the deadline branch | `src/lib/data/supabase.ts:256-258` precedes `:259` | yes |
| 4.6 mock list reads `description: null` | `src/lib/data/mock.ts:3152`; `listEventsForTeam` reads through it at `:3478` | yes |
| 4.6 mock `description_too_large`, same wording | `src/lib/data/mock.ts:640`, `:662-664` | yes |
| 4.7 migration | `supabase/migrations/20261013090000_evt11_description_bounded.sql:9-14` | yes, verbatim; idempotent via `duplicate_object` |
| 4.8 tests | `tests/description-html.test.ts:50-68`, `:134-137`; `tests/description-pictures.test.ts:64-179`; `tests/e2e/evt-11-description-pictures.spec.ts:163-307`; `tests/e2e/evt-10-description.spec.ts:418`, `:445` | yes — every test name carries its AC ID |

The two `FailureCode` members (`src/lib/domain/types.ts:285`, `:288`) are the impl log's deviation 1:
the plan names both codes in § 4.2 and § 4.5, and the union edit is required for them to typecheck.
No new name. Deviation 2 (`hasPicture`, `src/components/DescriptionEditor.tsx:173`) keeps a
picture-only description from saving as null; deviation 3 (white fill on the JPEG fallback) changes
no specified behaviour. None contradicts § 4.

AC-8's risk was a consumer that reads `description` from a list read and writes it back. None does:
the editor loads through `seam.getEvent` (`src/routes/EventEditor.tsx:155`, mapped at `:174`),
`EventDetail` through `seam.getEvent` (`src/routes/EventDetail.tsx:147`), and the guest page through
`get_guest_event`; list reads feed only `src/lib/viewed-team.ts:130`, `:141` and
`src/routes/Events.tsx:117`, none of which draws or saves a description.

## R7 detail

`invariants_touched: []`. An event is not an entry; each invariant is about entries.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Not engaged: no entry table, RPC or check is changed | `.ai/registry/invariants.md:33`; diff touches only `public.event` (`supabase/migrations/20261013090000_evt11_description_bounded.sql:10`) |
| INV-02 approval resets on edit | Not engaged: no entry write path changed | `.ai/registry/invariants.md:34`; `src/lib/data/supabase.ts` changes are confined to the event functions (`:127-258`, `:3308`, `:3585`) |
| INV-03 rejection reason | Not engaged | `.ai/registry/invariants.md:35`; no rejection code in the diff |
| INV-04 one absence count | Not engaged: no count is computed or redefined | `.ai/registry/invariants.md:36`; list reads still return every event (`src/lib/data/mock.ts:3152`), and events never fed the count |
| INV-05 tentative counts | Not engaged | `.ai/registry/invariants.md:37` |
| INV-06 one portion | Not engaged | `.ai/registry/invariants.md:38` |
| INV-07 one member, one team | Not engaged: the event's team is unchanged in both list columns | `.ai/registry/invariants.md:39`; `team_id` kept at `src/lib/data/supabase.ts:148` |

Charter refusal 6 ("a warning never blocks") is about the overload warning on entries; the cap is a
size refusal on an event, as `01-plan.md` § 2 states.

## Findings

None.

Noted, not a finding: the impl log reports 20 full-suite Playwright failures (ADM, CAL-06, UIE)
that it reproduced on the PLAN checkpoint with this ticket's changes stashed. This review did not
re-run the full suite; the two description specs pass. A `/ship` that runs the full suite will meet
them.

## Verdict

`PASS`. All eight checks pass; the ticket advances to DONE.
