---
ticket: EVT-11
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-13T05:03:35+00:00
inputs_read:
  - .ai/board/tickets/EVT-11/01-plan.md
  - .ai/board/tickets/EVT-11/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-10/03-impl-log.md
  - src/components/DescriptionHtml.tsx
  - src/components/DescriptionEditor.tsx
  - src/routes/EventEditor.tsx
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - tests/description-html.test.ts
  - tests/events.test.ts
  - tests/e2e/evt-10-description.spec.ts
  - playwright.config.ts
  - "node_modules: dompurify 3.4.17 dist/purify.es.mjs (_isValidAttribute, DEFAULT_DATA_URI_TAGS, DEFAULT_URI_SAFE_ATTRIBUTES, _sanitizeAttributes); @tiptap/react 3.31.4 dist/index.d.ts"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-11 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | the four constants and `descriptionBytes` every layer measures with; two `FailureCode` members the new refusals need; the `CalEvent.description` docblock | § 4.1 |
| `src/lib/description-image.ts` | created | the browser-side downscale: decode, scale to a 1200 px longest edge, WebP 0.8 / JPEG 0.85, `data:` URL | § 4.2 |
| `src/components/DescriptionHtml.tsx` | modified | `img` joins the allow-list with `src`/`alt`; `src` narrowed to `DESCRIPTION_IMAGE_SRC`; `img` without `src` removed; picture rule on the render class | § 4.3, § 2b |
| `src/components/DescriptionEditor.tsx` | modified | in-house `image` node, the "Insert picture" button, hidden file input, inline refusal, insertion-time cap check | § 4.4, § 2b |
| `src/lib/data/supabase.ts` | modified | `EVENT_LIST_COLUMNS` on both list reads; `description_too_large` before the round trip and on 23514 | § 4.5 |
| `src/lib/data/mock.ts` | modified | list reads return `description: null`; the same `description_too_large` refusal, same wording | § 4.6 |
| `supabase/migrations/20261013090000_evt11_description_bounded.sql` | created | `event_description_bounded`, idempotent | § 4.7 |
| `tests/description-html.test.ts` | modified | EVT-10's allow-list assertions now expect `img` with `src`/`alt`; AC-7's `DESCRIPTION_IMAGE_SRC` cases and a source check of the hook | § 4.8 |
| `tests/description-pictures.test.ts` | created | AC-6 (mock create/update, UTF-8 counting, real seam's order by source), AC-8 (mock and real-seam columns), AC-9 (migration text) | § 4.8 |
| `tests/e2e/evt-10-description.spec.ts` | modified | `HOSTILE` gains one valid `data:` picture carrying `onerror`/`style`/`width`; AC-8 and AC-9 assert it survives alone, stripped to `src`/`alt` | § 4.8 |
| `tests/e2e/evt-11-description-pictures.spec.ts` | created | AC-1 to AC-5, AC-7, AC-10 in Chromium; PNGs generated in the test with `zlib` | § 4.8 |

`git diff --name-only` plus untracked files is exactly the eleven `allowed_paths`, plus this log.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `DESCRIPTION_MAX_BYTES`, `DESCRIPTION_IMAGE_TYPES`, `DESCRIPTION_IMAGE_MAX_INPUT_BYTES`, `DESCRIPTION_IMAGE_MAX_EDGE` | `src/lib/domain/types.ts:994-998` | |
| 4.1 `descriptionBytes` | `src/lib/domain/types.ts:1001` | `TextEncoder`, so a three-byte "ệ" counts 3 — tested |
| 4.1 `CalEvent.description` docblock | `src/lib/domain/types.ts:1018-1019` | |
| 4.2 `DESCRIPTION_IMAGE_REFUSED`, `downscaleToDataUrl` | `src/lib/description-image.ts:12`, `:43` | |
| 4.3 `img` in `DESCRIPTION_TAGS`, `img: ["src","alt"]` | `src/components/DescriptionHtml.tsx:19`, `:30` | |
| 4.3 `DESCRIPTION_IMAGE_SRC` | `src/components/DescriptionHtml.tsx:38` | verbatim from the plan |
| 4.3 hook drops non-matching `src` | `src/components/DescriptionHtml.tsx:100` | |
| 4.3 `img` without `src` removed after the walk | `src/components/DescriptionHtml.tsx:137` | |
| 4.3 `ALLOWED_URI_REGEXP` unchanged | `src/components/DescriptionHtml.tsx` `sanitizeDescription` | links still refuse `data:` — EVT-10 AC-7 e2e still green |
| 4.3 picture rule on `DESCRIPTION_RENDER_CLASS` | `src/components/DescriptionHtml.tsx:152` | block, `max-w-full`, `h-auto`, `rounded-xl`, `my-2` |
| 4.4 `DescriptionImage` node | `src/components/DescriptionEditor.tsx:37` | as specified; `Node` from `@tiptap/react` |
| 4.4 pick steps 1–4 | `src/components/DescriptionEditor.tsx:227` | the input is reset before the await, so step 4 holds on every path |
| 4.4 `DESCRIPTION_PICTURE_TOO_LARGE` | `src/components/DescriptionEditor.tsx:53` | |
| 4.5 `EVENT_LIST_COLUMNS`, `DESCRIPTION_TOO_LARGE` | `src/lib/data/supabase.ts:147`, `:203` | |
| 4.5 list reads use `EVENT_LIST_COLUMNS`, `getEvent` keeps `EVENT_COLUMNS` | `src/lib/data/supabase.ts:3308`, `:3585` | |
| 4.5 `EventRow.description` optional, `toEvent` maps absent to null | `src/lib/data/supabase.ts:127`, `:157` | |
| 4.5 `eventInputFailure` cap check, after the four | `src/lib/data/supabase.ts:220-222` | |
| 4.5 `toEventFailure` 23514 cap branch before the deadline branch | `src/lib/data/supabase.ts:256-258` | |
| 4.6 mock list reads `description: null` | `src/lib/data/mock.ts:3152` | `listEventsForTeam` inherits it from `seam.listEvents` |
| 4.6 mock `description_too_large` | `src/lib/data/mock.ts:640`, `:662-664` | in `eventInputFailure`, which both `createEvent` and `updateEvent` call first |
| 4.7 migration | `supabase/migrations/20261013090000_evt11_description_bounded.sql` | verbatim statement; not applied (RULE-09) |
| 4.8 tests | four files above | every test name carries its AC ID |

## Deviations from the design

1. **`FailureCode` gains `description_too_large` and `description_image_refused`**
   (`src/lib/domain/types.ts:285`, `:288`). The plan names both codes in § 4.2 and § 4.5 but does not
   list the union edit; without it the code does not typecheck. No new name — both are the plan's.
2. **An editor holding only a picture is not empty.** EVT-10's `onUpdate` sent `""` whenever
   `getText()` was blank, and a picture has no text — so a description that is only a picture would
   have been saved as null, silently losing it. `hasPicture` (`DescriptionEditor.tsx:79`) keeps it.
   EVT-10 AC-6 (empty blocks save nothing) is still green; EVT-11 AC-2 saves a picture-only
   description and asserts it is stored.
3. **On the JPEG fallback, transparent pixels are filled white before encoding**
   (`description-image.ts`). JPEG has no alpha; without the fill a transparent PNG would show black.
   Only reached in a browser that cannot encode WebP. No behaviour the plan specifies changes.

## Invariants

`invariants_touched: []`. An event is not an entry, so INV-01..INV-07 are not engaged (01-plan.md
§ 2). The cap is a size refusal on an event, not a warning on an entry, so charter refusal 6 does not
apply either.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 37 files, 710 tests |
| `pnpm exec playwright test tests/e2e/evt-11-description-pictures.spec.ts tests/e2e/evt-10-description.spec.ts` | 0 | 15 passed (incl. seam guard). Run with a throwaway config pointing `executablePath` at `/opt/pw-browsers/chromium` — the installed Playwright expects a newer browser build than the container has; the config was not committed |
| `pnpm exec playwright test` (full suite) | 1 | 367 passed, 20 failed — ADM-01 AC-13, ADM-02 (9), ADM-03 AC-14/AC-18, ADM-04 AC-10/12, CAL-06 AC-12, UIE-09 (3), UIE-10 (3). **The same 20 fail on the PLAN checkpoint `4b75d95` with this ticket's changes stashed**: none are this ticket's. Holidays, admin hub and sidebar; no event surface |
| `node scripts/check-docs.mjs` | 0 | errors 0 |
| `git diff --name-only` subset of `allowed_paths` | yes | plus this log |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `event-description-picture` | `src/components/DescriptionEditor.tsx:306` |
| `event-description-picture-input` | `src/components/DescriptionEditor.tsx:311` |
| `event-description-picture-error` | `src/components/DescriptionEditor.tsx:320` |

## Open questions

- **The `TODO(verify)` in § 4.3 is settled.** DOMPurify 3.4.17 `_isValidAttribute`
  (`purify.es.mjs:2164`) returns true for any `data:` `src` on a tag in `DATA_URI_TAGS`, which
  includes `img` by default (`:1253-1260`), regardless of `ALLOWED_URI_REGEXP`. The
  `uponSanitizeAttribute` hook runs before that check (`:2298`) and sets `keepAttr = false`, which
  wins. `alt` passes because it is in `DEFAULT_URI_SAFE_ATTRIBUTES` (`:1263`). AC-7's e2e proves the
  result in Chromium.
- **The § 4.4 `TODO(verify)` is settled.** `@tiptap/react` 3.31.4 `dist/index.d.ts:5` is
  `export * from "@tiptap/core"`; no dependency was added.
- **The 20 pre-existing e2e failures** are outside this ticket and were not touched. Worth a
  `/status` look; they will block any `/ship` that runs the full suite.
