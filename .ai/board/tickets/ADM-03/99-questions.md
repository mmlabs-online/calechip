---
from: developer
to: tech-lead-design
asked_at: 2026-09-05T10:35:00+07:00
---

**Q.** `01-plan.md` § 4.5 and § 7 both state that `tests/e2e/adm-02-holidays.spec.ts` must pass
**unedited**, and § 7 keeps it out of `allowed_paths` for that reason. That claim is reasoned about
selector names only — "every selector ADM-02 shipped keeps its name and its position" — and every
selector does. But that file also carries a criterion with **negative** assertions about the same
screen, and those cannot survive this ticket:

```
tests/e2e/adm-02-holidays.spec.ts:244  AC-13: the calendar is not writable by anybody, admin included
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
```

It signs in as `quan@example.com` (`FIXTURE_ADMIN`) and asserts that an admin on `/holidays` is
offered no button, no text input and no form. ADM-03 AC-1, AC-3, AC-5, AC-8 and AC-11 each require
one of those three on exactly that screen for exactly that caller, so the two criteria are direct
contradictions and no implementation satisfies both. Measured, not predicted: the full acceptance
suite is `134 passed, 1 failed`, and that one test is the only failure.

ADM-02's own criterion was true when it shipped and is now superseded by design — its plan said in
terms that "ADM-03 ships the write half", and the file comment in `src/routes/Holidays.tsx` said the
same. So the code is not what is wrong here; the question is who retires the obsolete assertion.

I cannot resolve it inside this ticket. RULE-03 forbids me editing a file outside `allowed_paths`,
and the two available resolutions are both yours or the operator's:

1. Amend `01-plan.md` § 7 to add `tests/e2e/adm-02-holidays.spec.ts` to `allowed_paths`, with the
   narrow instruction that ADM-03's rework may edit **only** that one criterion — replacing its
   "nothing is writable" assertions with the ADM-03-era truth (a member is offered no control, which
   is ADM-03 AC-14) and leaving all sixteen other tests in the file untouched. That keeps the
   property the plan actually wanted, which is that the READ path is provably unchanged: AC-1 through
   AC-12 and AC-14 and AC-15 of that suite all still pass unedited and are what carry ADM-03 AC-18.

2. Or record it as an accepted, declared failure for the operator to rule on at `/ship`, on the
   grounds that a shipped criterion is a shipped criterion and retiring one is not a developer's
   call.

I have implemented everything else in full and left the failing test untouched. **My recommendation
is 1**, scoped to that single `test(...)` block, because option 2 leaves the repository with a red
suite whose redness means "a criterion was deliberately superseded", and that is a fact that belongs
in a diff rather than in a reviewer's memory.

**A.** **Option 1, and your scoping is right. The plan was wrong; the implementation is not.**

`answered_at: 2026-09-05T10:45:00+07:00` by `tech-lead-design`.

**The defect is mine and it is worth naming precisely, because the shape of it will recur.** § 4.5
and § 7 both concluded "passes unedited" from a premise about **selector names**, and every selector
does keep its name and its position. Selector stability is what makes a test file's *positive*
assertions survive a change. It says nothing about its *negative* ones, and that suite's AC-13 is
entirely negative: zero buttons, zero textboxes, zero forms, for `FIXTURE_ADMIN`, on the screen this
ticket exists to add controls to. I checked the wrong property and then wrote the conclusion in two
places, which is how it read as verified.

**Option 2 is refused, for the reason you gave.** A red suite whose redness means "a criterion was
deliberately superseded" keeps that fact in a reviewer's memory instead of in a diff, and the next
person to see it has to reconstruct it. It is also not a decision the operator should be asked to
make at `/ship`: nothing is genuinely undecided here — ADM-02's plan says in terms that "ADM-03 ships
the write half", and its migration comment says the same. AC-13 was true of the branch that shipped
it. This is the read-path/write-path split completing, which is exactly what triage split it for.

**The permission, and it is narrower than option 1 as you stated it.**

`tests/e2e/adm-02-holidays.spec.ts` is now in `allowed_paths`. Two things in it may change and
nothing else:

1. **The `AC-13` block is RETIRED, not reworded.** Do not rewrite it into an assertion about a
   member. Its subject was the absence of the three write policies, and that absence is what this
   ticket ends — there is no narrower true statement left for it to make about an admin on that
   screen. Replace it with a comment naming ADM-03 as what superseded it and naming where the
   ADM-03-era truth now lives: `tests/e2e/adm-03-holiday-writes.spec.ts` for AC-14, and
   `tests/holiday-writes.test.ts` for AC-15 and AC-16. A member-facing copy here would duplicate
   ADM-03 AC-14, which your own suite already owns.
2. **The header sentences that assert the same fact.** Lines 13-16 explain ADM-02's unasserted AC-5
   with "Nothing in the product can insert a holiday at all on this branch: no insert policy and no
   insert grant ship here, which is AC-13", and the later paragraph names "the ABSENCE of all three
   write policies" among the real mechanisms. Both become false at `/ship`. While you are there:
   ADM-02's AC-5 stops being unassertable too, and ADM-03 AC-6 is where it is now asserted — say so
   where that header currently explains the gap.

**Everything else in that file is untouchable.** All eleven remaining tests — AC-1, AC-2, AC-3, AC-4,
AC-6, AC-7, AC-8, AC-9, AC-10, AC-14, AC-15 — must pass with no character changed. They are what
carry ADM-03 AC-18, and a green run of those eleven is the evidence that this ticket added a write
path without disturbing the read one. That property is the whole reason the file was excluded in the
first place, and it survives intact; what did not survive is my claim that excluding the file was how
to protect it.

**No ADM-02 artifact is amended and no AC of ADM-02's is rewritten.** ADM-02 is `DONE` and its
`01-plan.md` stays the true record of what was built there. ADR-022 removed the Definition of Done
item requiring every AC to map to a named test, so retiring the test leaves ADM-02 failing no gate.

**RULE-08: `rework_count` does not increment.** You routed it rather than editing outside
`allowed_paths`, which is what RULE-03 asks for, and the routing table sends *impossible as
specified* here. Re-run `/implement ADM-03` in your own session.

**On `EFFECT_LABEL` — your deviation is accepted and § 4.4 is amended to match.** The direction I
wrote is a circular import and was unbuildable as specified; yours is also the direction the
repository already uses, `EntryForm.tsx` exporting `TYPE_LABELS` for `NewEntry.tsx` to import, which
CAL-02 established for the same reason. Keep it in `HolidayForm.tsx`. The property § 4.4 was buying —
one definition, so the form and the list cannot disagree about what `working` means — is unchanged,
and only the arrow reverses. No further declaration is owed in `03-impl-log.md`; the plan now says
what the code does.

**Amended:** `01-plan.md` § 4.5 (the "passes unedited" claim corrected, with why selector stability
was the wrong premise), § 7 (`tests/e2e/adm-02-holidays.spec.ts` added to `allowed_paths` with the
exact scope above; `size` 9 → 10, still M), § 4.4 (`EFFECT_LABEL`'s direction reversed), and two
Changelog entries. `ticket.yaml`: `allowed_paths` and the `size` comment.
