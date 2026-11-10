---
ticket: EVT-09
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-12T22:52:48+07:00
inputs_read:
  - .ai/board/tickets/EVT-09/01-plan.md
  - .ai/board/tickets/EVT-09/03-impl-log.md
  - .ai/board/tickets/EVT-09/ticket.yaml
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - supabase/migrations/20261012100000_evt08_event_email_invitation.sql
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

# EVT-09 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (8 changed files; non-ticket, non-ship-owned paths are exactly `src/routes/EventEditor.tsx`, `src/routes/EventDetail.tsx`, `tests/event-create-invitation.test.ts`, `tests/e2e/evt-09-create-invitation.spec.ts`), exit 0. `node scripts/check-carry.mjs EVT-09` → `0 uncommitted path(s) … PASS — nothing stray`, exit 0. `.ai/board/backlog.md` is ship-owned |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` on the four changed files exit 0; repo-wide `pnpm exec eslint .` exit 0 |
| R4 | No datastore access outside the seam | PASS | `src/routes/EventEditor.tsx:32` imports `seam` from `@/lib/data`; both calls go through it (`src/routes/EventEditor.tsx:101`, `:107`, injected at `:325`). No `supabase` / `@/lib/data/*` import in either route file (grep empty) |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | No new client-side permission. Field drawn only on create + public (`src/routes/EventEditor.tsx:513`); non-public sends nothing (`src/routes/EventEditor.tsx:97`); server holds manage + public at `supabase/migrations/20261012100000_evt08_event_email_invitation.sql:98` (`may_manage_event`) and `:105` (`EV009`), unchanged by this diff. Landing result shows only `inviteToEvent` outcomes (`src/routes/EventDetail.tsx:589-591`) — no membership signal |
| R7 | No invariant violated | PASS | `invariants_touched: []`; see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` touches no `package.json` or lockfile; new imports are in-repo (`src/routes/EventEditor.tsx:35-41`) and `useLocation` from the existing `react-router-dom` (`src/routes/EventDetail.tsx:32`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `InviteHandoff` (two-kind union) | `src/routes/EventDetail.tsx:89-91` | Yes |
| § 4.1 `readInviteHandoff(state: unknown): InviteHandoff \| null`, exact shapes only | `src/routes/EventDetail.tsx:106-115` | Yes — rebuilds the value; anything else returns null |
| § 4.1 `EventDetail` reads it once from `useLocation().state` | `src/routes/EventDetail.tsx:128` | Yes (`useState` initialiser) |
| § 4.1 passes `handoff` to `EventInvitePanel` | `src/routes/EventDetail.tsx:346`; prop typed at `:581` | Yes |
| § 4.1 `invited` → `result = outcomes` | `src/routes/EventDetail.tsx:589-591` | Yes |
| § 4.1 `failed` → `error = INVITE_NOT_SENT + " " + message`, `text = emails.join(", ")` | `src/routes/EventDetail.tsx:583`, `:585-587` | Yes |
| § 4.1 `INVITE_NOT_SENT` sentence | `src/routes/EventDetail.tsx:560` | Yes, verbatim |
| § 4.2 `FormValues.inviteText`, `""` initially | `src/routes/EventEditor.tsx:57`; initial values `:147`, `:178` | Yes |
| § 4.2 `createEventWithInvitations(data, input, inviteText)` | `src/routes/EventEditor.tsx:88-114` | Yes — return union as specified |
| § 4.2 non-public or no address → create only, `handoff: null` | `src/routes/EventEditor.tsx:97`, `:104` | Yes |
| § 4.2 malformed → `{ ok: false, malformed }`, neither call | `src/routes/EventEditor.tsx:98-99` (before `:101`) | Yes |
| § 4.2 create refused → `{ ok: false, error }`, no invite | `src/routes/EventEditor.tsx:102` | Yes |
| § 4.2 invite refused or thrown → `ok: true`, `failed` handoff | `src/routes/EventEditor.tsx:108-113` | Yes |
| § 4.2 reuses `parseInvitationInput` / `invalidInvitationEmails` from `./EventDetail` | `src/routes/EventEditor.tsx:36-41` | Yes, not copied |
| § 4.2 malformed sentence = EVT-08's verbatim | `src/routes/EventEditor.tsx:77` vs `src/routes/EventDetail.tsx:557` | Yes |
| § 4.2 `onSubmit` create path → malformed / error / `onSaved(id, handoff)`; edit path unchanged | `src/routes/EventEditor.tsx:312-334` | Yes |
| § 4.2 `onSaved(eventId, handoff?)` and `navigate(..., { state })` | `src/routes/EventEditor.tsx:243`, `:229-231` | Yes |
| § 4.3 `event-form-invite` (create, public only) | `src/routes/EventEditor.tsx:513-514` | Yes |
| § 4.3 `event-form-invite-input` | `src/routes/EventEditor.tsx:523` | Yes |
| § 4.3 `event-form-invite-error` | `src/routes/EventEditor.tsx:533` | Yes |
| AC-7 `saving` held across both calls | `src/routes/EventEditor.tsx:298`, `:325-329` (reset only on refusal) | Yes |

Developer deviation 1 (clearing history state, `src/routes/EventDetail.tsx:129-133`) serves AC-8 and renames nothing in § 4. Deviation 2 (thrown invite → `src/routes/EventEditor.tsx:79`) uses the seam's own `unknown` sentence (`src/lib/data/supabase.ts:251`). Neither is a contract change.

## R7 detail

`invariants_touched: []` (`ticket.yaml`, plan § 2). Checked against each registry invariant's subject:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 – INV-07 (entries and the absence count) | Not reached: the diff writes only through `createEvent` (EVT-01, unchanged) and `inviteToEvent` (EVT-08, unchanged); no entry, member or count is read or written | `src/routes/EventEditor.tsx:101`, `:107`; no change under `src/lib/data/**` or `supabase/**` in `git diff --name-only origin/main...HEAD` |

## Findings

None.

## Verdict

PASS.
