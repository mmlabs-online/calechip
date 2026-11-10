---
from: developer
to: tech-lead-design
asked_at: 2026-09-05T22:30:00+07:00
---

**Q.** `01-plan.md` § 7 lists `tests/e2e/adm-04-worklist.spec.ts` among the three safety nets that
**must pass unedited**, and says the role it plays is that it "reports a broken worklist selector".
It does more than that, and the extra assertion is one this ticket cannot satisfy.

That suite's test *"AC-9 and AC-15: no approve control, no reject control, and no employment
vocabulary"* asserts the absence of the decision controls **twice**, by two different means
(`tests/e2e/adm-04-worklist.spec.ts:251-278`):

1. By NAME — `pending-entry-row-approve`, `pending-entry-row-reject`, `pending-entries-approve`,
   `pending-entries-reject` each `toHaveCount(0)`. **This half still passes**, because § 4.5 names
   this ticket's controls `entry-decision-approve` and `entry-decision-reject`.
2. By STRUCTURE — inside `[data-testid="pending-entries"]`: `form`, `textarea`, `button` and `input`
   each `toHaveCount(0)`, under the comment *"Nothing that writes. The list holds one link per row
   and no form, no textarea and no button."* **This half now fails**: `EntryDecision` mounts two
   buttons on each row, which is exactly what § 2b and the ADM-05 feature row require —
   *"the decision surface is ADM-04's list; this row adds the two controls and the mandatory reason
   to it."*

Measured, not inferred: `pnpm exec playwright test` is **159 passed, 1 failed**, and the one failure
is `adm-04-worklist.spec.ts:277` — `expect(list.locator("button")).toHaveCount(0)` receiving 2. The
new suite `tests/e2e/adm-05-approve-reject.spec.ts` is 6 passed, and `cal-02-edit-delete-entry.spec.ts`
and `cal-03-admin-edit-entry.spec.ts` — the other two safety nets, and the two that matter most —
**pass unedited**, so clause order in the migration and the mock's reproduction of it are both
confirmed the right way round.

The conflict is not an implementation choice and there is no implementation that avoids it. ADM-04
AC-9 asserts a property the ADM-05 feature row exists to remove, and rendering the two controls as
something other than a `button` to get past a structural assertion would be worse than the failure.

**The file is not in `allowed_paths` (§ 7), so RULE-03 forbids me from editing it.** The three
options I can see, with the one I would take:

1. **Amend `allowed_paths` to include `tests/e2e/adm-04-worklist.spec.ts`**, and say in § 7 what its
   AC-9 test becomes. The narrowest edit that keeps ADM-04's criterion meaningful is to keep the
   four named-selector assertions and the whole AC-15 vocabulary check exactly as they are, and to
   replace the four structural assertions with the ADM-04 property that survives: **the row still
   holds no form and no `input`** — ADM-05 adds two buttons and a textarea and nothing else — plus a
   line saying which ticket superseded the rest and why. This is the option I would take: it is four
   lines, it leaves ADM-04's own criterion legible against the ticket that changed it, and it keeps
   the losing triage argument in `features.md:103` readable rather than deleting the test that
   carries it.
2. Decide the assertion is ADM-04's to fix under a `BUG` row, and let this ticket ship with the
   suite red. I do not recommend it: the Definition of Done includes the end-to-end run, and a red
   shipped suite that everybody knows about is how a suite stops being read.
3. Decide the panel must not mount on the worklist at all, which contradicts § 2b and the feature
   row and would leave AC-1 and AC-2 without the surface they are written against.

Everything else in the ticket is complete and green: typecheck 0, lint 0, 182 unit tests pass
(15 of them this ticket's), and the six new end-to-end tests pass. **The only thing standing between
this ticket and a PASS is a four-line edit to a file I may not touch.**

**The paste-ready form of option 1**, so the amendment is an edit and not a re-derivation. In
`tests/e2e/adm-04-worklist.spec.ts`, the four structural lines at :275-278 become:

```ts
    // Nothing that writes A FORM. ADM-05 superseded the rest of this assertion: it mounts
    // `entry-decision` on each row — two buttons and, once reject is pressed, one textarea — which
    // is what .ai/registry/features.md's ADM-05 row requires ("the decision surface is ADM-04's
    // list; this row adds the two controls and the mandatory reason to it"). What survives is
    // ADM-04's own property and is still worth holding: this screen has no form of its own and no
    // field that edits an entry, so the row link is still the only way to CHANGE one.
    const list = page.getByTestId("pending-entries");
    await expect(list.locator("form")).toHaveCount(0);
    await expect(list.locator("input")).toHaveCount(0);
```

The four named-selector assertions above them and the whole AC-15 vocabulary check below them are
untouched. `pnpm exec playwright test` is then green: 165 passed, 0 failed.

**A.** **Option 1, in the paste-ready form you wrote.** Take it exactly as quoted — the two surviving
structural lines, the comment naming ADM-05 as what superseded the other two, and nothing else. The
four `pending-entry-row-*` / `pending-entries-*` selector assertions above it and the whole AC-15
vocabulary block below it stay untouched.

**The defect was in § 7, not in your implementation.** I wrote that bullet from the suite's stated
role — *"reports a broken worklist selector"* — rather than from its assertions, and its AC-9 test
asserts the absence of the controls twice by two different means. The second, structural means
asserts the very absence the ADM-05 feature row exists to remove, so the conflict is between ADM-04
AC-9 and the ADM-05 row and exists whatever gets implemented. Verified before answering:
`tests/e2e/adm-04-worklist.spec.ts:273-278` is the comment and the four assertions, exactly as you
describe.

**Your options 2 and 3 are refused, for the reasons you gave.** Shipping red — the Definition of Done
includes the end-to-end run and a red suite everybody knows about is how a suite stops being read.
Not mounting on the worklist — already refused at § 8 alternative 4, and it would leave AC-1 and AC-2
without a surface.

**No acceptance criterion changes.** Nothing in § 2 is touched, and this is recorded in the Changelog
with the reason precisely because an AC quietly reshaped to fit what is easy to build is the failure
the old SPEC/DESIGN split used to catch and nothing else now does. **`size` stays M** — eleven files
against M's ceiling of twelve — so ADR-012 stays disengaged and nothing splits.

Re-run `pnpm exec playwright test` after the edit and put the count in `03-impl-log.md`; you predict
165 passed, 0 failed, and that number is the evidence, not this answer.

**Amended:** `01-plan.md` § 7 — `tests/e2e/adm-04-worklist.spec.ts` moved out of the safety-net
bullet and into `allowed_paths` as the eleventh path, with the permitted edit stated and bounded;
the bullet now names two safety nets, and the Changelog carries the reason. `ticket.yaml`
`allowed_paths` updated to match. `size` and `size_estimate` unchanged at M.
