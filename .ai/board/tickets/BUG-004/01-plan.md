---
ticket: BUG-004
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T03:51:15+00:00
inputs_read:
  - .ai/board/tickets/BUG-004/ticket.yaml
  - .ai/registry/features.md              # EVT-09 row (and EVT-08, which it depends on)
  - .ai/registry/invariants.md
  - .ai/board/tickets/EVT-09/01-plan.md   # § 2 AC-6, AC-8
  - .ai/board/tickets/CICD-01/01-plan.md  # § 2.0 Group B, § 4.2 row 21, § 8 alternative 2
  - .ai/board/tickets/BUG-003/ticket.yaml # sibling shape
  - docs/ops/e2e-quarantine.md
  - scripts/check-docs.mjs                # D15, :1026-1199
  - playwright.config.ts
  - .github/workflows/verify.yml          # e2e job, :101-114
  - tests/e2e/evt-09-create-invitation.spec.ts
  - src/App.tsx                           # <BrowserRouter>, events routes :587-602
  - src/routes/EventDetail.tsx            # handoff read :159-167, panel seed :653-661
  - src/routes/EventEditor.tsx            # handoff produced :91-120, navigate :237-238
  - src/hooks/useViewedTeam.tsx           # ruled out, see § 1
  - node_modules/.pnpm/react-router@7.18.3_*/node_modules/react-router/dist/development/chunk-BV7QT456.mjs  # BrowserRouter :10489-10514
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-004 — EVT-09 AC-6's end-to-end test hands its state in before the list has rendered

## 1. Problem and scope

**Feature implemented, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| EVT-09 | A creator enters email addresses to invite while creating a public event |

EVT-09 is `DONE`. This ticket changes no behaviour of it. It restores the one end-to-end test of
EVT-09 AC-6 (*the event is created but the invitations fail*) that CICD-01 quarantined as `fixme`
under ADR-060 after it failed both attempts in CI run 281 while passing locally, and it deletes that
test's row from the quarantine register. The capability regained is the operator's, not a role's: a
shipped criterion is once again exercised by the suite instead of being silently skipped, and the
register stops carrying a row that expires on **2026-11-12** — after which check D15 fails the
documentation audit for every ticket.

**Root cause — most probable, not proven.** The CI log was never readable (403, CICD-01 § 2.0 Group
B), and the CI e2e job has run only `echo "e2e"` since 2026-10-17 (`.github/workflows/verify.yml:110-114`),
so CI cannot confirm it either way. What the source shows:

1. The test (`tests/e2e/evt-09-create-invitation.spec.ts:192-229`) creates the event, lands on its
   page, calls `openEvents` — which waits only for `toHaveURL(/\/events$/)` (`:30-33`) — and then
   immediately `pushState`s the failed handoff onto `/events/<id>` and dispatches `popstate`.
2. The installed `BrowserRouter` (react-router 7.18.3, `chunk-BV7QT456.mjs:10504-10514`) applies
   every location change inside `React.startTransition`. `history.pushState` updates the URL
   synchronously; the route swap commits later. So `toHaveURL` can pass while the event's page is
   still the committed screen.
3. If the `popstate` arrives before the `/events` transition commits, React folds both transitions
   into one render whose result is `/events/<id>` again — the same `<Route>` element, so
   `EventDetail` is **never unmounted**. Its handoff is read once, at mount
   (`src/routes/EventDetail.tsx:162`, `useState(() => readInviteHandoff(location.state))`), and that
   mount saw no state. The panel then opens empty: no `event-invite-error`, an empty
   `event-invite-input` — exactly the assertions at `:217-220`.
4. On a fast machine the list commits in the gap between `toHaveURL` and `page.evaluate`; on a loaded
   CI runner it does not. That matches *passes locally 10/10, fails both CI attempts*.

Ruled out: `useViewedTeam`'s `replace` navigation (`src/hooks/useViewedTeam.tsx:99-109`) — it never
fires off the calendar paths, nor for a member. The real user path is unaffected: the form navigates
from `/events/new` (`EventEditor`, a different `<Route>`), so `EventDetail` always mounts fresh with
the state (`src/routes/EventEditor.tsx:237-238`). The defect is in the test's ordering, not in the
product.

**The fix is in the test:** before handing the state in, wait until the list has actually rendered
and the event's page is gone. That wait is correct whether or not the hypothesis above is the CI
cause — a test that injects a history entry from a screen it has not confirmed it is on is wrong on
its face.

**Out of scope:**

- **Any change to `src/`.** `EventDetail`'s read-once handoff is EVT-09 § 4's design and correct for
  every path a person can take (§ 8 alternative 1).
- **The `openEvents` helper and every other test in the file.** Each other caller follows
  `openEvents` with an auto-retrying locator on the list; only AC-6 hands in raw history. Widening the
  helper is a change to six tests to fix one.
- **The two `flaky` rows (EVT-02 AC-28, EVT-10 AC-2/3/4).** Those are BUG-005's.
- **Restoring the CI e2e job.** The operator disabled it on 2026-10-17 (`verify.yml:110`); turning it
  back on is their decision, not this ticket's.
- **Deleting the test.** The ticket allows it, but removing the only end-to-end check of a shipped
  criterion is a product decision. If the fixed test fails locally, that is a FAIL to report, not a
  licence to delete (§ 2 AC-4).
- **Re-dating the register row.** ADR-060: only the operator re-dates.

**`size_estimate: S`** — two files: one test's ordering and one register row.

## 2. Acceptance criteria

Vocabulary: *the AC-6 test* is the test titled exactly
`AC-6: a failed handoff opens the panel with the sentence and the addresses ready to resend` in
`tests/e2e/evt-09-create-invitation.spec.ts`. *The register* is `docs/ops/e2e-quarantine.md`.

**AC-1 — the AC-6 test runs again, under the same title**
- Given `tests/e2e/evt-09-create-invitation.spec.ts`
- When it is read
- Then the AC-6 test is declared with `test(`, not `test.fixme(`, under its title unchanged
  character for character
- And the comment `// QUARANTINED BUG-004 under ADR-060 …` above it is gone
- And no other test in the file is quarantined, skipped or retitled

**AC-2 — the state is handed in only from the rendered list**
- Given the AC-6 test has created *Failed send* and seen `event-detail`
- When it goes to the events list
- Then before its `page.evaluate` that pushes the handoff it waits until `event-detail` has a count
  of 0 **and** one `event-row` containing *Failed send* is present
- And the `pushState` + `popstate` that follows is unchanged

**AC-3 — no assertion of EVT-09 AC-6 is weakened**
- Given the AC-6 test after this ticket
- Then it still asserts, in order and with the same matchers and values as before: `event-detail`
  visible after the `popstate`; `event-invite-error` matching
  `/^The event was created, but the invitations were not sent\. Check your connection\./`;
  `event-invite-input` holding `a@outside.example, b@outside.example`; `event-invite-result` count 0;
  then after `event-invite-submit`, `event-invite-result` visible, `event-invite-sent` listing exactly
  `["a@outside.example", "b@outside.example"]`, `event-invite-error` count 0, and two
  `event-invited-row`
- And no timeout is raised and no `waitForTimeout` is added

**AC-4 — it passes locally, repeatedly**
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/evt-09-create-invitation.spec.ts --repeat-each=10 --retries=0`
  runs
- Then every test passes, the AC-6 test included, 10 of 10
- And if the AC-6 test fails, the ticket stops at FAIL with the failure recorded — the test is not
  deleted and not re-quarantined by this ticket

**AC-5 — the register no longer carries the row, and D15 agrees**
- Given the register
- Then the row for `tests/e2e/evt-09-create-invitation.spec.ts` › the AC-6 test is deleted
- And the other two rows, and every other line of the file, are unchanged
- And `node scripts/check-docs.mjs` reports no D15 finding

**AC-6 — the cause is tested under slowed timing, and the result recorded either way**
- Given a temporary, uncommitted CPU throttle at the top of the AC-6 test (§ 4.3)
- When the AC-6 test runs `--repeat-each=10 --retries=0` once **without** the AC-2 wait and once
  **with** it
- Then `03-impl-log.md` records both pass counts
- And if the run without the wait does not fail, the impl-log says the CI cause remains unconfirmed —
  the AC-2 wait still ships (§ 1, last paragraph)
- And the throttle lines are absent from the committed file

**Invariants touched: `[]`.** The change is a test's ordering and a register row. No entry, member,
team or count is read or written by anything that changes; INV-01–INV-07 constrain entries and the
absence count, which nothing here touches.

**Open questions.** None that block. One for the operator, not this ticket: the register row expires
**2026-11-12**. If this ticket has not merged by then, D15 fails the audit on every branch until it
does or the operator re-dates the row.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(Nothing is laid out: no screen, element or class changes. The line is written because the gate
requires exactly one.)

## 3. Permission model

None changes. The test signs in as `thanh@example.com` (FIXTURE_MEMBER), the creator of the event,
who may manage it — EVT-08's rows in `.ai/standards/rbac-and-security.md`, unchanged. The mock seam
enforces the same `mayEditEvent` gate as before; nothing on either side of the boundary is touched.

## 4. Contract

### 4.1 `tests/e2e/evt-09-create-invitation.spec.ts`, the AC-6 test

Delete line 191 (`// QUARANTINED BUG-004 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.`).
Change line 192's `test.fixme(` to `test(`. Replace line 202 (`    await openEvents(page);`) with
exactly:

```ts
    // BUG-004. `toHaveURL` passes once `pushState` has run, but the router commits the new route
    // inside `startTransition`. Handing the state in before the list has committed lets React fold
    // both transitions into one render that never unmounts this event's page, and its handoff is
    // read once, at mount (EventDetail.tsx). So wait for the list itself, and for the page to go.
    await openEvents(page);
    await expect(page.getByTestId("event-detail")).toHaveCount(0);
    await expect(page.getByTestId("event-row").filter({ hasText: "Failed send" })).toHaveCount(1);
```

Every other line of the test, and of the file, is unchanged. Test IDs used are existing ones:
`event-detail` (`src/routes/EventDetail.tsx:302`), `event-row` (already used at `:149`, `:175`,
`:243`).

### 4.2 `docs/ops/e2e-quarantine.md`

Delete exactly the table row beginning
``| `tests/e2e/evt-09-create-invitation.spec.ts` › AC-6: a failed handoff …``. Nothing else.

### 4.3 The throttle for AC-6 — temporary, never committed

As the first lines inside the AC-6 test body, for the two measurement runs only:

```ts
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
```

The "without" run additionally omits the two `expect` lines added in § 4.1. Both edits are removed
before commit; `git diff` of the committed file shows only § 4.1.

## 5. Seam impact

None. No function in `src/lib/data/` changes.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/evt-09-create-invitation.spec.ts"
  - "docs/ops/e2e-quarantine.md"
```

`glossary_owed` is `[]`; no glossary row is written. `size: S` from two paths; agrees with
`size_estimate: S`, ADR-012 not engaged.

## 8. Rejected alternatives

1. **Make `EventDetail` re-read the handoff whenever `location.key` changes.** Would make the
   component immune to the folded transition. Rejected: it changes shipped product code to serve a
   sequence no person can produce — the real handoff always arrives from `EventEditor`, a different
   route, so `EventDetail` mounts fresh — and it reopens EVT-09 AC-8's *read once, then dropped*
   design, which the reviewer would then have to re-judge against a criterion this ticket does not own.
2. **Move the wait into `openEvents` for every caller.** Fixes any future test that hands in history
   the same way. Rejected for now: six other tests change behaviour to fix one, and each already
   follows the helper with a retrying locator on the list. Worth doing if a second test grows the
   same pattern.
3. **Drive the failure through the real form by making the mock refuse `inviteToEvent`.** The truest
   test — no synthetic `popstate`. Rejected: the mock has no fault-injection switch, and adding one is
   a change to the seam's mock (`src/lib/data/mock.ts`) and its parity surface, for a ticket that
   exists to close a quarantine. EVT-09's own unit test (`tests/event-create-invitation.test.ts`)
   already asserts the thrown and refused invitation at the seam level.
4. **Re-register the row as `flaky`.** Rejected, as CICD-01 § 8 alternative 2 did: it failed both
   attempts in CI, and ADR-060 reserves *flaky* for a test that passes on retry.

## Changelog

- `2026-11-11T03:51:15+00:00` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
