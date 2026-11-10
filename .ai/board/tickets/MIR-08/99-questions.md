---
from: developer
to: tech-lead-design
asked_at: 2026-10-23T05:00:00Z
---

**Q.** `pnpm exec eslint .` (the repo-wide lint command named in testing-standards.md, and AC-4's
"all three pass") fails with one pre-existing error in `scripts/run-loop.mjs`, a file not in
`allowed_paths` and not part of this ticket's contract. Does MIR-08's implement gate require that
unrelated failure fixed, or may it be reported as a pre-existing defect outside this ticket's scope?

**The fact.** `pnpm exec eslint .` on the branch, before any MIR-08 edit, reports:
`scripts/run-loop.mjs:46:7  error  'PROTECTED_BRANCHES' is assigned a value but never used`. `git
diff --name-only` after my edits shows only `src/lib/data/supabase.ts`, `src/routes/MonthView.tsx`
and the deletion of `supabase/db.sql` — `scripts/run-loop.mjs` is untouched by this ticket.
`git log -1 -- scripts/run-loop.mjs` points to `a73808d` ("chore: ADR-067 — the runner pushes,
merges..."), which predates MIR-08's branch (`PLAN` checkpoint `0a099ad`). The declared constant has
no other reference in the file, so it is a plain unused-variable defect, not something this ticket's
change touches or could fix without editing a file RULE-03 does not grant me.

**Options as I see them. Neither is mine to choose unilaterally — one touches a file outside
`allowed_paths`, the other reports the gate as something other than literally green.**

- **A — report it.** `pnpm exec tsc --noEmit` and the lint of every file this ticket touched are
  clean; the one remaining `eslint .` failure is named in `03-impl-log.md` as pre-existing,
  unrelated, and outside `allowed_paths`, with the evidence above. Gate recorded PASS on the basis
  that AC-4 covers the comments changed in `src/` ("Only comments changed in `src/`" — AC-4's own
  text), and the whole-repo lint defect is flagged for a separate ticket/steward fix.
- **B — widen `allowed_paths`** to add `scripts/run-loop.mjs` for a one-line unused-var deletion.
  Rejected by me: it is scope growth into a file this ticket's contract (section 4) never named, and
  RULE-03 directs raising this rather than widening the glob.

My recommendation is **A**.

**A.** Pending. `tech-lead-design` has no live session in this run to answer synchronously
(`.ai/templates/questions.md:9`: "there is no live message API"), and this decision crosses into
plan authority — section 7's `allowed_paths` is `tech-lead-design`'s to widen, not mine to decide by
reading AC-4's wording my own way. Reported to the operator in `03-impl-log.md` as `gate: BLOCKED`
rather than assumed.

**Amended:** none yet — pending the answer above.
