---
ticket: EVT-10
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-13T00:20:38+0700
inputs_read:
  - .ai/board/tickets/EVT-10/01-plan.md
  - .ai/board/tickets/EVT-10/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
  - .ai/registry/glossary.md
  - src/main.tsx
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/lib/data/index.ts
  - src/index.css
  - vite.config.ts
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
  - tests/events.test.ts
  - tests/e2e/evt-06-guest-link.spec.ts
  - "node_modules: dompurify 3.4.17 dist/purify.es.d.mts; @tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-text-style, @tiptap/extension-text-align, @tiptap/extension-list 3.31.4 dist/index.d.ts and dist/index.js"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-10 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `package.json` | modified | the editor's five packages and the sanitiser, added with `pnpm add` at major 3 (resolved 3.31.4 and 3.4.17) | § 4.7 |
| `pnpm-lock.yaml` | modified | written by `pnpm add`; resolves § 4.7's packages | § 4.7 |
| `src/components/DescriptionHtml.tsx` | created | the allow-list, the one sanitiser and the one render — the security layer on both surfaces | § 4.1 |
| `src/components/DescriptionEditor.tsx` | created | the one Tiptap editor, toolbar, link row and swatches | § 4.3, § 4.4, § 2b |
| `src/routes/EventEditor.tsx` | modified | the textarea becomes `DescriptionEditor`; the save sanitises as defence in depth | § 4.3 |
| `src/routes/EventDetail.tsx` | modified | the plain `<p>` becomes `DescriptionHtml` | § 4.2 |
| `src/routes/GuestEvent.tsx` | modified | the plain `<p>` becomes `DescriptionHtml` | § 4.2 |
| `src/main.tsx` | modified | the mock-build-only door the e2e suite writes straight to the datastore through | § 4.5 |
| `supabase/migrations/20261012230000_evt10_description_html.sql` | created | converts existing plain descriptions to HTML with both triggers disabled | § 4.6 |
| `tests/description-html.test.ts` | created | policy constants, fail-closed path, AC-12 source scan, migration shape | § 4.8 |
| `tests/e2e/evt-10-description.spec.ts` | created | AC-1 to AC-9 in a real browser, both surfaces | § 4.8 |
| `.ai/board/tickets/EVT-10/03-impl-log.md` | created | this file | gate |

`.ai/registry/glossary.md` is in `allowed_paths` and was **not** touched: the *Sanitised description*
row was already at line 57, written at PLAN.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `DESCRIPTION_TAGS` | `src/components/DescriptionHtml.tsx:17` | exact |
| 4.1 `DESCRIPTION_ATTRIBUTES` | `src/components/DescriptionHtml.tsx:22` | exact |
| 4.1 `DESCRIPTION_HREF` | `src/components/DescriptionHtml.tsx:32` | exact |
| 4.1 `DESCRIPTION_STYLES` | `src/components/DescriptionHtml.tsx:38` | exact; rebuilt by `rebuildStyle`, declarations joined with `; ` |
| 4.1 `LINK_TARGET`, `LINK_REL` | `src/components/DescriptionHtml.tsx:47-48` | exact |
| 4.1 own instance, lazy, fail-closed | `src/components/DescriptionHtml.tsx:75-104`, `:109-111` | `DOMPurify(window)` on first call; no `window` or `!isSupported` → `""` |
| 4.1 config | `src/components/DescriptionHtml.tsx:112-120` | `ALLOWED_TAGS`, `ALLOWED_ATTR` (union), `ALLOWED_URI_REGEXP`, `ALLOW_DATA_ATTR: false`, `ALLOW_ARIA_ATTR: false` — plus `RETURN_DOM: true`, see Deviations 1 |
| 4.1 `uponSanitizeAttribute` hook | `src/components/DescriptionHtml.tsx:82-92` | per-tag attribute check; `style` rebuilt, dropped when empty |
| 4.1 `afterSanitizeAttributes` hook | `src/components/DescriptionHtml.tsx:97-101` | `target`/`rel` set on an `a` with `href`; the unwrap of one without is after the walk — Deviations 1 |
| 4.1 `sanitizeDescription` | `src/components/DescriptionHtml.tsx:109` | |
| 4.1 `DescriptionHtml` | `src/components/DescriptionHtml.tsx:141` | null or `""` after sanitising → draws nothing |
| 4.2 EventDetail | `src/routes/EventDetail.tsx:289` | nothing else in the file changed but the import at `:49` |
| 4.2 GuestEvent | `src/routes/GuestEvent.tsx:209` | nothing else in the file changed but the import at `:39` |
| 4.3 `DescriptionEditor` | `src/components/DescriptionEditor.tsx:97` | extensions exactly as § 4.3 (`:108-125`); `onChange` `""` on no text (`:133`); link Apply prepends `https://` then checks `DESCRIPTION_HREF` (`:44`, `:163-166`) |
| 4.3 EventEditor wiring | `src/routes/EventEditor.tsx:563` (editor), `:305` (save sanitise, commented as defence in depth) | `FormValues.description` stays `string` |
| 4.5 test door | `src/main.tsx:8-15` | `seam`, `DataSeam` from `@/lib/data` |
| 4.6 migration | `supabase/migrations/20261012230000_evt10_description_html.sql` | body transcribed character for character; header in EVT-08's shape |
| 4.7 dependencies | `package.json` `dependencies` | six packages, no devDependency |
| 4.8 tests | `tests/description-html.test.ts`, `tests/e2e/evt-10-description.spec.ts` | |

## Deviations from the design

1. **The unwrap of an `a` whose `href` was removed runs after DOMPurify's walk, not inside the
   `afterSanitizeAttributes` hook** (`src/components/DescriptionHtml.tsx:112-124`). Moving a node's
   children in front of it from inside the hook puts them *behind* DOMPurify's `NodeIterator`, so they
   would never be visited — the unwrap would hand unsanitised descendants to the DOM. So the sanitise
   asks for `RETURN_DOM: true`, unwraps `a:not([href])` on the returned `body`, and returns its
   `innerHTML`. Same output § 4.1 describes; the hook keeps the half that is safe inside the walk
   (setting `target`/`rel`). No consultation: it is the contract's behaviour, made safe.
2. **`DESCRIPTION_RENDER_CLASS` is exported from `DescriptionHtml.tsx`** (`:131`) and worn by the
   editor's text area, so § 2b's "the same typography as the render" is one string, not two copies.
   Not a field, type or seam name; a class string.
3. **The editor's field is wrapped in a `div`, not the `label` the textarea had**
   (`src/routes/EventEditor.tsx:559-567`). A `label` around the toolbar sends a press on any of its
   buttons to the first labelable control inside it. The visible label text is unchanged; the
   editable carries `aria-label="Description"` as § 4.3 says.
4. **Toolbar buttons `preventDefault` on `mousedown`** (`src/components/DescriptionEditor.tsx:82`) so
   the editor keeps focus and its selection while a format is pressed. Found by AC-2's spec: without
   it, a press after clicking a new line could apply to the previous selection.
5. **The placeholder *Tell people what to expect* is an overlay span**, shown while the editor is
   empty (`src/components/DescriptionEditor.tsx`, bottom). Tiptap's own Placeholder extension lives in
   `@tiptap/extensions`, a seventh package § 4.7 does not name.

## Invariants

`invariants_touched: []`. Nothing in this diff reads or writes an entry, a portion, an approval, a
member's team or the absence count: the code changes are a render, an editor and one column's values
on `public.event`, and an event is not an entry (glossary *Event*). The migration's only writes are
`update public.event set description = …`, plus disabling and re-enabling two `public.event`
triggers inside its own transaction.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 36 files, 693 tests, all pass (17 new in `tests/description-html.test.ts`) |
| `pnpm exec playwright test tests/e2e/evt-10-description.spec.ts` | 0 | 8 passed |
| `pnpm exec playwright test tests/e2e/evt-01-events.spec.ts tests/e2e/evt-06-guest-link.spec.ts tests/e2e/evt-10-description.spec.ts` | 0 | 26 passed — AC-5: the existing specs pass unchanged |
| `pnpm exec playwright test` (full suite) | 1 | 358 passed, 22 failed — **all in specs this ticket does not touch** (ADM-02, ADM-03, ADM-04, CAL-06, UIE-09, UIE-10, one EVT-09). See Open questions 1 |
| `git diff --name-only` subset of `allowed_paths` | yes | plus this log |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `event-description-input` | `src/components/DescriptionEditor.tsx:128` |
| `event-description-toolbar` | `src/components/DescriptionEditor.tsx:193` |
| `event-description-bold` / `-italic` / `-underline` / `-strike` | `src/components/DescriptionEditor.tsx:198`, `:201`, `:204`, `:207` |
| `event-description-h2` / `-h3` | `src/components/DescriptionEditor.tsx:211`, `:214` |
| `event-description-bullet-list` / `-ordered-list` / `-blockquote` | `src/components/DescriptionEditor.tsx:218`, `:221`, `:224` |
| `event-description-link` | `src/components/DescriptionEditor.tsx:228` |
| `event-description-link-input` / `-link-apply` / `-link-remove` | `src/components/DescriptionEditor.tsx:249`, `:260`, `:269` |
| `event-description-color` | `src/components/DescriptionEditor.tsx:231` |
| `event-description-color-default` | `src/components/DescriptionEditor.tsx:283` |
| `event-description-color-ink` / `-ink-2` / `-pto-ink` / `-wfh-ink` / `-event-ink` / `-danger` | `src/components/DescriptionEditor.tsx:296` (from `SWATCHES`, `:33-40`) |
| `event-description-align-left` / `-align-center` / `-align-right` | `src/components/DescriptionEditor.tsx:235`, `:238`, `:241` |
| `event-description` | `src/routes/EventDetail.tsx:289` → `DescriptionHtml` |
| `guest-event-description` | `src/routes/GuestEvent.tsx:209` → `DescriptionHtml` |

## Open questions

1. **22 end-to-end failures predate this ticket.** The same four spec files (ADM-02, UIE-09, EVT-09,
   CAL-06) were run with this ticket's changes stashed and `pnpm install --frozen-lockfile` against
   the committed lockfile: 14 failed there, 13 with the changes — the same tests, EVT-09 AC-6 being
   the one that flips. Most are ADM-02 holiday-calendar journeys timing out on a click; they look
   date-dependent (the run was on 2026-10-13). Not this ticket's to fix and outside `allowed_paths`;
   `testing-standards.md`'s "171 tests, all pass" line is also stale (380 now).
2. **The three standards pages ADR-056 names** (`tech-stack.md`, `data-model.md`,
   `rbac-and-security.md`) are still owed by a human or the steward, as 01-plan.md § 1 says.
3. **Human step at `/ship`:** apply the migration before deploying the build (§ 4.6).
