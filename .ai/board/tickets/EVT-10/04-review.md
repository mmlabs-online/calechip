---
ticket: EVT-10
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-13T00:31:11+07:00
inputs_read:
  - .ai/board/tickets/EVT-10/01-plan.md
  - .ai/board/tickets/EVT-10/03-impl-log.md
  - .ai/board/tickets/EVT-10/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/registry/decisions/ADR-056-an-event-description-is-sanitised-html-from-one-editor.md
  - .ai/registry/glossary.md
  - "git diff origin/main...HEAD (16 files)"
  - src/components/DescriptionHtml.tsx
  - src/components/DescriptionEditor.tsx
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/main.tsx
  - src/lib/data/index.ts
  - supabase/migrations/20261012230000_evt10_description_html.sql
  - tests/description-html.test.ts
  - tests/e2e/evt-10-description.spec.ts
  - package.json
  - pnpm-lock.yaml
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

# EVT-10 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed subset of `allowed_paths`; uncommitted carry | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (16 changed files, exit 0); `node scripts/check-carry.mjs EVT-10` → `0 uncommitted path(s) … PASS — nothing stray` (exit 0). Every source path in the diff is listed at `ticket.yaml:15-27` |
| R2 | Typecheck | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | Lint on the changed lintable files | PASS | `pnpm exec eslint <the 9 changed .ts/.tsx files>` exit 0 |
| R4 | Nothing outside the seam reaches the datastore (RULE-02) | PASS | `src/main.tsx:4` imports `seam` from `@/lib/data`, the seam's own entry; `src/routes/EventEditor.tsx:305` hands the value to `SaveEventInput` as before; no `@supabase` import in either new component (`src/components/DescriptionHtml.tsx:10-11`, `src/components/DescriptionEditor.tsx:7-28`). RULE-02's lint rule (`eslint.config.js:64`) passes |
| R5 | Every § 4 contract item implemented (RULE-04) | PASS | see *R5 detail* |
| R6 | Permission gating matches § 3 | PASS | No grant, policy or RPC change in the migration (`supabase/migrations/20261012230000_evt10_description_html.sql:29-64` touches only `description` and two triggers). Edit form still gated by `mayEditEvent` (`src/routes/EventEditor.tsx:158`). § 3's one new control — stored markup outside the allow-list never reaches a reader — is held on both read surfaces, including the anon one: `src/routes/EventDetail.tsx:289`, `src/routes/GuestEvent.tsx:209` → `src/components/DescriptionHtml.tsx:149-152`. The test door exists only in a mock-seam build (`src/main.tsx:15`; `VITE_DATA_SEAM` is a build-time constant, `src/lib/data/index.ts:1533`) and grants nothing the real API does not already allow its caller |
| R7 | No invariant violated (RULE-07) | PASS | see *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `package.json` adds five `@tiptap/*` and `dompurify`, exactly § 4.7's six; covered by ADR-056 (§ *Status*: `ACCEPTED by the operator` 2026-10-12; § *Consequences* names the editor and the sanitiser). No devDependency added |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `DESCRIPTION_TAGS` | `src/components/DescriptionHtml.tsx:17-19` | Yes — 14 tags, identical to § 4.1 |
| 4.1 `DESCRIPTION_ATTRIBUTES` | `src/components/DescriptionHtml.tsx:22-29` | Yes |
| 4.1 `DESCRIPTION_HREF` | `src/components/DescriptionHtml.tsx:32` | Yes |
| 4.1 `DESCRIPTION_STYLES` | `src/components/DescriptionHtml.tsx:38-43`; rebuilt by `rebuildStyle` `:54-70`, joined with `; ` | Yes |
| 4.1 `LINK_TARGET`, `LINK_REL` | `src/components/DescriptionHtml.tsx:47-48` | Yes |
| 4.1 own instance, lazy, fail-closed | `src/components/DescriptionHtml.tsx:74-80`, `:110-111` | Yes — `DOMPurify(window)`; no `window` / `!isSupported` → `""` (asserted `tests/description-html.test.ts:100-103`) |
| 4.1 config | `src/components/DescriptionHtml.tsx:112-118` | Yes, plus `RETURN_DOM: true` (impl-log Deviation 1) |
| 4.1 `uponSanitizeAttribute` hook | `src/components/DescriptionHtml.tsx:82-92` | Yes |
| 4.1 `afterSanitizeAttributes` hook | `src/components/DescriptionHtml.tsx:97-101` (target/rel); unwrap of `a` without `href` at `:122-124`, after the walk | Same output as § 4.1. Moving the unwrap out of the hook is the correct call: children re-inserted before the current node inside a `NodeIterator` walk would not be visited. Unwrapped children were already sanitised by the walk, so the post-walk unwrap introduces no unsanitised node |
| 4.1 `sanitizeDescription(html: string): string` | `src/components/DescriptionHtml.tsx:109` | Yes |
| 4.1 `DescriptionHtml({ html, testId })` | `src/components/DescriptionHtml.tsx:141-154` | Yes — null or `""` → `null`; the only `dangerouslySetInnerHTML` in `src/` (grep: no other hit) |
| 4.2 EventDetail | `src/routes/EventDetail.tsx:49`, `:289` | Yes — `whitespace-pre-wrap` block gone |
| 4.2 GuestEvent | `src/routes/GuestEvent.tsx:39`, `:209` | Yes |
| 4.3 `DescriptionEditor({ value, onChange })` | `src/components/DescriptionEditor.tsx:97-103` | Yes |
| 4.3 extensions | `src/components/DescriptionEditor.tsx:108-124` | Yes — StarterKit config, `TextStyle`, `Color`, `TextAlign` exactly as § 4.3 |
| 4.3 `onChange` `""` on no text, else `getHTML()` | `src/components/DescriptionEditor.tsx:133` | Yes |
| 4.3 link Apply: prepend `https://` when no scheme, then `DESCRIPTION_HREF` | `src/components/DescriptionEditor.tsx:42-49`, `:163-167` | Yes |
| 4.3 editable carries `data-testid` and `aria-label` via `editorProps.attributes` | `src/components/DescriptionEditor.tsx:126-131` | Yes |
| 4.3 EventEditor wiring | `src/routes/EventEditor.tsx:563` (editor), `:305` (save sanitise, commented as defence in depth); `FormValues.description` stays `string` (`:52`) | Yes. The wrapper became a `div` (`:559`) rather than a `label`; visible label text unchanged — impl-log Deviation 3, a correctness fix for toolbar clicks, not a contract change |
| 4.4 selectors | `src/components/DescriptionEditor.tsx:128`, `:193`, `:198-241`, `:249`, `:260`, `:269`, `:283`, `:296` (+ `SWATCHES` `:32-39`); `src/routes/EventDetail.tsx:289`; `src/routes/GuestEvent.tsx:209` | Yes — every § 4.4 id present |
| 4.5 test door | `src/main.tsx:4`, `:8-15` | Yes — character for character |
| 4.6 migration | `supabase/migrations/20261012230000_evt10_description_html.sql:29-64` | Yes — body identical to § 4.6; disable `:34-35` before first `update` `:38`, enable `:61-62` after last `update` `:46`; `&` escaped before `<`/`>` |
| 4.7 dependencies | `package.json` `dependencies`; `pnpm-lock.yaml:14-17` | Yes — six, majors 3 |
| 4.8 unit tests | `tests/description-html.test.ts` | Yes — `pnpm exec vitest run`: 36 files, 693 tests, all pass |
| 4.8 e2e | `tests/e2e/evt-10-description.spec.ts:183`, `:226`, `:310`, `:318`, `:355`, `:407`, `:434` | Yes — AC-1..AC-9. See *Findings* note on one run |

## R7 detail

`invariants_touched: []` (`ticket.yaml:14`). With no ID listed, the check is that the diff writes
nothing an invariant governs.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01..INV-07 (entries, portions, approvals, team membership, absence count) | Not engaged: the only datastore write in the diff is `public.event.description`, and an event is not an entry (glossary *Event*). No route touched reads or writes an entry | `supabase/migrations/20261012230000_evt10_description_html.sql:38-41`, `:46-59` (the only two `update`s, both `public.event … set description`); `src/routes/EventEditor.tsx:305` (form save changes only how `description` is built) |

## Findings

None that fail a check.

Noted, not a gate item: on the first run of `tests/e2e/evt-10-description.spec.ts` alongside the
EVT-01 and EVT-06 specs, the AC-2/3/4 test failed at `tests/e2e/evt-10-description.spec.ts:278`
(`rel` on the venue link); an immediate rerun with `--repeat-each=3` reported `22 passed`, 0 failed. The
spec is timing-sensitive under parallel workers. The impl-log's 22 pre-existing full-suite failures
are outside this diff and `allowed_paths`.

## Verdict

`PASS` — R1 to R8 hold. Next state `DONE` via `/advance` then `/ship`. Human step owed at `/ship`:
apply the migration before deploying the build (01-plan.md § 4.6).
