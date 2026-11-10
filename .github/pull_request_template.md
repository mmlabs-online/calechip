## MIR tracking

<!--
Fill this section when the pull request touches a MIR item — any path matching `_mir[0-9]+_` or
`mir-[0-9]+-`, e.g. `supabase/migrations/<timestamp>_mir07_<slug>.sql` or
`tests/e2e/mir-07-<slug>.spec.ts`. Otherwise leave it as it is.

Status index:        .ai/board/plans/multi-tenancy-status.md  (the only place MIR status is updated)
Feature change log:  .ai/board/plans/feature-change-log.md

`.github/scripts/check-mir-tracking.mjs` reads this section:
- "Status after this PR" must name one value, not both.
- For "no feature behaviour changed", add a line of its own that reads exactly:
  FEATURE-IMPACT: none
-->

- MIR item(s): MIR-__
- Status after this PR: IN_PROGRESS | DONE
- Verified (required for phase 0 and phase 3): <how, against what>
- Feature impact:
  - [ ] No existing feature behaviour changed — `FEATURE-IMPACT: none`
  - [ ] Features changed, and the feature change log updated with a dated entry
        for each, tagged CHANGED or SUPERSEDED

- [ ] Status index updated in this PR

**A pull request that marks a phase 0 or phase 3 item DONE without a `Verified` entry does not
merge.** The entry says how the item was proven and against what — the real database, not the mock.
A passing mock test is not verification.
