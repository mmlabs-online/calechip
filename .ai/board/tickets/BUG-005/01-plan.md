---
ticket: BUG-005
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T04:37:27+00:00
inputs_read:
  - .ai/board/tickets/BUG-005/ticket.yaml
  - .ai/registry/features.md              # EVT-02 and EVT-10 rows
  - .ai/registry/invariants.md
  - .ai/board/tickets/EVT-02/01-plan.md   # § 2 AC-28
  - .ai/board/tickets/EVT-10/01-plan.md   # § 2 AC-2, AC-3, AC-4
  - .ai/board/tickets/CICD-01/01-plan.md  # § 2.0 Group C, § 4.3 rows 22-23
  - .ai/board/tickets/BUG-004/01-plan.md  # sibling shape, Group B
  - docs/ops/e2e-quarantine.md
  - scripts/check-docs.mjs                # D15, :1026-1215; parseQuarantineRegister :1078-1109
  - playwright.config.ts                  # fullyParallel, retries
  - tests/e2e/evt-02-attendance.spec.ts
  - tests/e2e/evt-10-description.spec.ts
  - src/routes/EventEditor.tsx            # load :133-202, loading branch :205-211, form :364
  - src/components/DescriptionEditor.tsx  # ToolButton :108-123, applyLink :203-207, swatches :359-386
  - node_modules/.pnpm/@tiptap+core@3.31.4_@tiptap+pm@3.31.4/node_modules/@tiptap/core/dist/index.js  # focus :496-525, dom.editor :6635
  - node_modules/.pnpm/prosemirror-view@1.42.6/node_modules/prosemirror-view/dist/index.js        # onSelectionChange :4773-4788, focus :5754-5760
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-005 — two end-to-end tests act before the screen they act on has caught up

## 1. Problem and scope

**Features implemented, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| EVT-02 | A member joins an event they can read, within its capacity, approval mode and deadline, and everyone who can read it sees who is coming |
| EVT-10 | A creator formats an event's description, and every surface that shows it renders it sanitised |

Both are `DONE`. This ticket changes no behaviour of either. It makes two end-to-end tests
deterministic — EVT-02 AC-28 (`tests/e2e/evt-02-attendance.spec.ts:80`) and EVT-10 AC-2/AC-3/AC-4
(`tests/e2e/evt-10-description.spec.ts:244`) — which CICD-01 registered as `flaky` under ADR-060
after each failed a first attempt under full-suite load and passed on retry, and it deletes both
register rows. The capability regained is the operator's: the bounded retry in
`playwright.config.ts` stops absorbing two known failures, and the register stops carrying two rows
that expire on **2026-11-12**, after which check D15 fails the documentation audit everywhere.

**Root cause, EVT-02 AC-28 — read from the source, high confidence.** The test clicks
`events-new-button` and immediately reads every `[data-testid]` inside `event-form` with
`evaluateAll` (`:83-88`). `evaluateAll` does not wait for anything. `EventEditor` renders a bare
`role="status"` loader until two seam reads resolve (`src/routes/EventEditor.tsx:133-137`,
`:205-211`), and `event-form` exists only after that (`:364`). On an idle machine the reads win the
race; under full-suite load the test reads an empty list, every `indexOf` is `-1`, and
`expect(-1).toBeLessThan(-1)` fails at `:90`. A retry on a quieter worker passes. The form renders
all its fields at once once ready — `SCOPE_CHOICES` is a constant (`:73`, `:451`) — so waiting for
`event-form` is sufficient.

**Root cause, EVT-10 AC-2/3/4 — read from the source, most probable, not proven.** The failure
recorded is the `ul > li` text assertion (`:300`), i.e. the bullet list landed on the wrong line.
`onLine` (`:134-138`) clicks a line, presses End (and Shift+Home), and the caller then presses a
toolbar button. Two windows sit between those steps, both widened by load:

1. **A delayed focus pulls the caret back.** `applyLink` (`src/components/DescriptionEditor.tsx:203-207`)
   and every colour swatch (`:359-386`) run `editor.chain().focus()…` after focus has left the editor
   (the link field has it; the swatch buttons, unlike `ToolButton` at `:117`, do not prevent the
   mousedown). TipTap's `focus` command, when the view lacks focus, defers `view.focus()` to the next
   animation frame (`@tiptap/core` `dist/index.js:501-507`), and ProseMirror's `focus()` writes the
   editor's *stored* selection into the page (`prosemirror-view` `dist/index.js:5754-5760`). The test's
   next step is `onLine(page, editor, "Bullet item", false)` straight after `event-description-link-apply`
   (`:273-274`). If that frame fires after the click on *Bullet item*, the caret returns to *Venue link*
   and the bullet list wraps *Venue link* — a text mismatch on `ul > li`, exactly what was recorded.
2. **The editor's selection trails the page's.** End and Shift+Home are not handled by ProseMirror;
   the browser moves the page selection and ProseMirror copies it into its state on `selectionchange`
   (`dist/index.js:4773-4788`), a separate task. Chromium prioritises input tasks, so a toolbar click
   dispatched right after the key can run against the previous selection.

Both are test-ordering defects: a person cannot click a line within one frame of pressing Apply.
**The fix is in the tests:** drain the pending animation frame before clicking a line, and wait until
the editor's own selection holds that line before returning from `onLine`. Each wait is correct on
its face whether or not it is the cause CI saw.

**Out of scope:**

- **Any change to `src/`.** Making the swatches keep editor focus, or Apply not defer, would change
  shipped EVT-10 behaviour to serve a test (§ 8 alternative 1).
- **`playwright.config.ts`.** `retries`, `workers` and `fullyParallel` stay as they are; they are the
  load the tests must survive, not the defect.
- **Other `evaluateAll` reads elsewhere in `tests/e2e/`** (`adm-02`, `adm-03`, `cal-05`, `cal-06`).
  None is registered or reported flaky; auditing them is a separate ticket if one ever flakes.
- **The `openEvents` helper in `evt-02-attendance.spec.ts`.** Every other caller follows it with an
  auto-retrying locator; only AC-28 reads raw.
- **Restoring the CI e2e job**, disabled by the operator on 2026-10-17 — their decision.
- **Deleting either test.** The ticket allows it, but each is the only end-to-end check of a shipped
  criterion. A test that still fails after this fix is a FAIL to report (AC-5), not a licence to delete.
- **Re-dating the register rows.** ADR-060: only the operator re-dates.

**`size_estimate: S`** — three files: one wait in one test, one helper in another, two register rows.

## 2. Acceptance criteria

Vocabulary: *the AC-28 test* is the test titled exactly
`AC-28: the three fields sit after the dates and before the scope, empty and off by default` in
`tests/e2e/evt-02-attendance.spec.ts`. *The format test* is the test titled exactly
`AC-2, AC-3, AC-4: every format is shown on both surfaces, and re-saving changes nothing` in
`tests/e2e/evt-10-description.spec.ts`. *The register* is `docs/ops/e2e-quarantine.md`.

**AC-1 — the AC-28 test reads the form only once it is there**
- Given the AC-28 test
- When it has clicked `events-new-button`
- Then its next statement waits, with an auto-retrying `expect`, for `event-form` to be visible
- And only after that does it run the `evaluateAll` that reads the order of `[data-testid]`

**AC-2 — no assertion of EVT-02 AC-28 is weakened**
- Given the AC-28 test after this ticket
- Then it still asserts, with the same matchers: `event-end-input` before `event-capacity-input`
  before `event-approval-input` before `event-deadline-input` before `event-scope-team`; the capacity
  and deadline inputs empty; the approval input not checked
- And its title is unchanged character for character

**AC-3 — `onLine` returns only when the editor itself holds the line**
- Given `onLine(page, editor, text, select)` in `tests/e2e/evt-10-description.spec.ts`
- When it is called
- Then before clicking the line it waits for one animation frame of the page to run
- And after the click, End, and (when `select`) Shift+Home, it polls the editor's own selection until
  the selection lies in one text block whose text is `text`, and either selects exactly `text`
  (`select` true) or is an empty caret at the end of that block (`select` false)
- And it neither types, nor sets the selection, nor writes anything to the editor

**AC-4 — no assertion of EVT-10 AC-2, AC-3 or AC-4 is weakened**
- Given the format test and `tests/e2e/evt-10-description.spec.ts` after this ticket
- Then the format test's body is byte-identical to `origin/main`; only `onLine` and one type
  declaration above it change
- And every other test in the file is unchanged in title and body
- And no `waitForTimeout` is added and no timeout is raised anywhere

**AC-5 — both tests pass repeatedly, and in the full suite**
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/evt-02-attendance.spec.ts tests/e2e/evt-10-description.spec.ts --repeat-each=10 --retries=0` runs
- Then every test in both files passes, 10 of 10 each
- And when the full suite runs once with `pnpm exec playwright test --retries=0`, the AC-28 test and
  the format test both pass, and `03-impl-log.md` records the suite's totals
- And if either test fails, the ticket stops at FAIL with the failure recorded — neither test is
  deleted, quarantined or re-registered by this ticket. Failures elsewhere in the full suite are
  recorded, not fixed

**AC-6 — the causes are tested under slowed timing, and the result recorded either way**
- Given a temporary, uncommitted CPU throttle at the top of the AC-28 test and of the format test (§ 4.4)
- When each runs `--repeat-each=10 --retries=0` once **without** this ticket's change and once **with** it
- Then `03-impl-log.md` records the four pass counts
- And if a run without the change does not fail, the impl-log says that cause remains unconfirmed —
  the change still ships (§ 1)
- And the throttle lines are absent from the committed files

**AC-7 — the register no longer carries either row, and D15 agrees**
- Given the register
- Then the two rows naming `BUG-005` are deleted
- And the header row, its separator row, and every other line of the file are unchanged
- And `node scripts/check-docs.mjs` reports no D15 finding

**Invariants touched: `[]`.** Two tests' ordering and two register rows. No entry, member, team,
event or count is read or written by anything that changes; INV-01–INV-07 constrain entries,
membership and the absence count, none of which is touched.

**Open questions.** None that block. One for the operator, not this ticket: both rows expire
**2026-11-12**. If this ticket has not merged by then, D15 fails the audit on every branch until it
does or the operator re-dates the rows.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(Nothing is laid out: no screen, element or class changes. The line is written because the gate
requires exactly one.)

## 3. Permission model

None changes. Both tests sign in as `thanh@example.com` (FIXTURE_MEMBER), who may create an event and
edit their own — EVT-01/EVT-08 rows in `.ai/standards/rbac-and-security.md`, unchanged. Nothing on
either side of the boundary is touched; the editor probe in § 4.2 only reads in-page state.

## 4. Contract

### 4.1 `tests/e2e/evt-02-attendance.spec.ts`, the AC-28 test

Insert between line 83 (`    await page.getByTestId("events-new-button").click();`) and line 85
(`    const ids = await page`), replacing the blank line 84, exactly:

```ts
    // BUG-005. `EventEditor` shows a loader until its seam reads resolve, and `evaluateAll` does not
    // wait — so under load it read an empty list and every index was -1. Wait for the form first.
    await expect(page.getByTestId("event-form")).toBeVisible();

```

Every other line of the file is unchanged. `event-form` is an existing test ID
(`src/routes/EventEditor.tsx:364`, already awaited at `:67` of this file).

### 4.2 `tests/e2e/evt-10-description.spec.ts`, `onLine`

Replace lines 133-138 (the doc comment and the body of `onLine`) with exactly:

```ts
/** BUG-005. The editor's own state, read through the `editor` property TipTap sets on its root
 *  (`@tiptap/core` dist/index.js:6635). Read only — the test never drives the editor through it. */
type EditorRoot = HTMLElement & {
  editor?: {
    state: {
      selection: {
        from: number;
        to: number;
        empty: boolean;
        $from: { parent: { textContent: string; content: { size: number } }; parentOffset: number };
        $to: { parent: unknown };
      };
      doc: { textBetween(from: number, to: number): string };
    };
  };
};

/** Puts the caret on the line holding `text`, and selects that line when `select` is set. Returns
 *  only once the editor itself holds that selection, so the next toolbar press lands on it. */
async function onLine(page: Page, editor: Locator, text: string, select = true): Promise<void> {
  // BUG-005 (1). Apply on the link row, or a colour swatch, ends in TipTap's `focus()` with focus
  // outside the editor, which hands focus back on the NEXT animation frame and writes the editor's
  // old selection into the page as it does. Clicking a line before that frame lets it drag the caret
  // back. Frame callbacks run in the order they were requested, so once this one has run, that has.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await editor.getByText(text, { exact: true }).click();
  await page.keyboard.press("End");
  if (select) await page.keyboard.press("Shift+Home");
  // BUG-005 (2). End and Shift+Home move the page's selection; ProseMirror copies it into its state
  // on `selectionchange`, a later task a toolbar click can overtake under load.
  await expect
    .poll(() =>
      editor.evaluate((root) => {
        const state = (root as EditorRoot).editor?.state;
        if (!state) return null;
        const { selection: sel, doc } = state;
        return {
          line: sel.$from.parent.textContent,
          oneBlock: sel.$from.parent === sel.$to.parent,
          selected: doc.textBetween(sel.from, sel.to),
          caretAtEnd: sel.empty && sel.$from.parentOffset === sel.$from.parent.content.size,
        };
      }),
    )
    .toEqual({ line: text, oneBlock: true, selected: select ? text : "", caretAtEnd: !select });
}
```

Names introduced, and no others: `EditorRoot` (type), and the probe keys `line`, `oneBlock`,
`selected`, `caretAtEnd`. No import is added — `expect`, `Locator` and `Page` are already imported at
`:1`. The format test's body (`:244-327`) and every other test are unchanged. `onLine` is also called
by the AC-7 link test (`:389`, `:395`, `:402`); it gains the same two waits and no assertion changes —
stated here so the reviewer does not read it as drift.

### 4.3 `docs/ops/e2e-quarantine.md`

Delete exactly the two table rows at `:26` and `:27` — the ones beginning
``| `tests/e2e/evt-02-attendance.spec.ts` › AC-28:`` and
``| `tests/e2e/evt-10-description.spec.ts` › AC-2, AC-3, AC-4:``. The header and separator rows stay;
`parseQuarantineRegister` (`scripts/check-docs.mjs:1078-1109`) accepts a table with no rows.

### 4.4 The throttle for AC-6 — temporary, never committed

As the first lines inside each test body, for the four measurement runs only:

```ts
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
```

A "without" run is the throttle on the `origin/main` version of the test (no § 4.1 wait; the original
three-line `onLine`). Both edits are removed before commit; `git diff origin/main` of each spec shows
only § 4.1 or § 4.2.

## 5. Seam impact

None. No function in `src/lib/data/` changes, and nothing calls `window.__calechipMockSeam` that did
not before.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/evt-02-attendance.spec.ts"
  - "tests/e2e/evt-10-description.spec.ts"
  - "docs/ops/e2e-quarantine.md"
```

`glossary_owed` is `[]`; no glossary row is written. `size: S` from three paths; agrees with
`size_estimate: S`, ADR-012 not engaged.

## 8. Rejected alternatives

1. **Fix the editor: give the swatches and the link row's Apply `onMouseDown={preventDefault}` so the
   editor never loses focus.** Removes window 1 at its source. Rejected: the link field must take
   focus to be typed into, so Apply still runs from outside the editor; it changes a shipped EVT-10
   component the reviewer would then re-judge against EVT-10 AC-1; and window 2 is untouched.
2. **Drive the selection programmatically** — `editor.commands.setTextSelection` through the same
   `editor` property. Fully deterministic. Rejected: it skips the click and the keys, which are what a
   person does and what the test exists to exercise; § 4.2 reads that property and never writes it.
3. **Run the two files serially, or lower `workers`.** Less load, fewer flakes. Rejected: it hides the
   ordering defects rather than removing them, slows the suite, and `playwright.config.ts` is shared
   by every test.
4. **Wait for `toBeFocused()` on the editor at the top of `onLine`** instead of one animation frame.
   Rejected: `applyLink` only calls `focus()` for an accepted address, so after a refused one in the AC-7
   test (`javascript:`, `ftp:`) focus never returns and `onLine` would hang there.
5. **Delete the tests.** Rejected — § 1 Out of scope.

## Changelog

- `2026-11-11T04:37:27+00:00` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
