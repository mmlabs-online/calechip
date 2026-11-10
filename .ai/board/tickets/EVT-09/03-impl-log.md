---
ticket: EVT-09
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-12T22:35:01+0700
inputs_read:
  - .ai/board/tickets/EVT-09/01-plan.md
  - .ai/board/tickets/EVT-09/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - tests/event-invitation.test.ts
  - tests/e2e/evt-08-event-invitation.spec.ts
  - tests/e2e/seam.setup.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# EVT-09 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/EventDetail.tsx` | modified | The page has to accept what the form hands it and open the panel already holding the send's result or the failure | § 4.1 |
| `src/routes/EventEditor.tsx` | modified | The create form gains the invite field and the validate → create → invite order | § 4.2, § 4.3 |
| `tests/event-create-invitation.test.ts` | created | The order of the two calls, every refusal path and the history-state reader, without a browser | § 4.1, § 4.2; AC-2..AC-8 |
| `tests/e2e/evt-09-create-invitation.spec.ts` | created | What the creator sees on the form and on the page they land on | § 4.3; AC-1..AC-8 |

`git diff --name-only` plus the two untracked files equals `allowed_paths` exactly.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `InviteHandoff` | `src/routes/EventDetail.tsx:89` | Exported, as specified |
| 4.1 `readInviteHandoff(state: unknown)` | `src/routes/EventDetail.tsx:106` | Accepts exactly the two shapes; rebuilds the value so no extra field passes through |
| 4.1 `EventDetail` reads it once, passes `handoff` | `src/routes/EventDetail.tsx:128`, `:346` | Captured in a `useState` initialiser |
| 4.1 `EventInvitePanel` prop `handoff`, seeds `result` / `error` + `text` | `src/routes/EventDetail.tsx:580-591` | Later sends replace the seeded state as before |
| 4.1 `INVITE_NOT_SENT` | `src/routes/EventDetail.tsx:560` | Joined to the refusal's sentence with one space |
| 4.2 `FormValues.inviteText` | `src/routes/EventEditor.tsx:57` | `""` on both forms; only the create form draws the field |
| 4.2 `createEventWithInvitations` | `src/routes/EventEditor.tsx:88` | Signature as the plan's; reuses `parseInvitationInput` and `invalidInvitationEmails` from `./EventDetail` |
| 4.2 `EventForm.onSubmit` create path | `src/routes/EventEditor.tsx:325` | `saving` stays true across both calls (AC-7); reset only on a refusal, since success navigates away |
| 4.2 `onSaved(eventId, handoff?)` and `navigate(…, { state })` | `src/routes/EventEditor.tsx:243`, `:230` | Edit path calls `onSaved(id)` as before |
| 4.2 malformed sentence = EVT-08's, verbatim | `src/routes/EventEditor.tsx:77` | Unit test asserts the string |

## Deviations from the design

Two additions the plan did not spell out, both inside its ACs, neither changing a name in § 4:

1. **The handoff is cleared from history after it is read** (`src/routes/EventDetail.tsx:126-133`,
   a `navigate(pathname, { replace: true, state: null })`). React Router keeps `location.state` in
   `window.history.state`, which survives a reload, so without this a reload would show the send
   result again and break AC-8 (*"a reload … shows … no `event-invite-result`"*). The e2e asserts
   `history.state.usr` is null after landing, because a real reload resets the mock seam.
2. **A thrown `inviteToEvent` reports *"Something went wrong. Please try again."***
   (`src/routes/EventEditor.tsx:79`). The plan says "refused or thrown → failed" without saying what
   a throw's `message` is; this is the seam's existing generic `unknown` sentence, not raw exception
   text.

## Invariants

`invariants_touched: []`. Nothing here reads or writes an entry, a member or a count: the form's
save is `createEvent` (EVT-01, unchanged) and the invitation is `inviteToEvent` (EVT-08, unchanged),
whose plan answered `[]` for the same reason. INV-01–INV-07 constrain entries and the absence count.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 35 files, 675 tests; `tests/event-create-invitation.test.ts` 33 of them |
| `pnpm exec playwright test tests/e2e/evt-09-create-invitation.spec.ts` | 0 | 7 tests + setup |
| `pnpm exec playwright test` (full) | 0 | 353 passed; 14 tests in adm-02, adm-03, adm-04, cal-06, uie-09 and uie-10 listed as passing only on retry. None touch events, and neither file changed here touches those screens |
| `git diff --name-only` subset of `allowed_paths` | yes | `tests/event-invitation.test.ts` and `evt-08`/`evt-01` specs untouched and passing |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `event-form-invite` | `src/routes/EventEditor.tsx:514` |
| `event-form-invite-input` | `src/routes/EventEditor.tsx:523` |
| `event-form-invite-error` | `src/routes/EventEditor.tsx:533` |

## Open questions

- **AC-6 in the e2e is driven by injecting the handoff into history**, not by a real failing
  `inviteToEvent`: the mock never refuses a creator on their own public event and the spec may not
  edit the mock. The refusal and the throw themselves are covered by the unit test's stub.
