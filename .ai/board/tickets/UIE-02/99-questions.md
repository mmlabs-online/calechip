---
doc_version: 1
ticket: UIE-02
---

# UIE-02 — questions

One block per question, appended. Never rewritten — `.ai/templates/questions.md`.

---
from: developer
to: tech-lead-design
asked_at: 2026-09-07T06:58:25Z
---

**Q.** In `01-plan.md` § 2, **AC-12** gives three literal addresses for the top bar's period stepping
on a week, and `src/lib/period.ts` produces three different ones. Which is the contract — the AC's
addresses, or the code's? The two disagree about the *address* only; they agree about the week.

The AC reads: given a member on `/week/2026-10-07`, pressing `shell-period-next` then
`shell-period-prev` twice makes the address `/week/2026-10-14`, then `/week/2026-10-07`, then
`/week/2026-09-30`. That is stepping ±7 days **from the anchor day in the URL**, which is a Wednesday.

`periodNavFor` steps ±7 days **from the Monday of the anchor's week** (`src/lib/period.ts:307-314`,
and the same shape at `:285-291` for `/`). From `/week/2026-10-07` it yields `/week/2026-10-12`, then
`/week/2026-10-05`, then `/week/2026-09-28`.

Both reach the same seven-day windows in the same order, and `WeekView` resolves any day of a week to
the same Monday, so `shell-period-anchor` reads identically either way and AC-12's second clause holds
under both. § 4.5 specifies `prevTo`/`nextTo` only as *"`to` for `shell-period-prev`"* and fixes the
arithmetic nowhere, which is why `tech-lead-review` recorded this as non-gating (`04-review.md`
finding 2) rather than as an unimplemented contract item. It reaches you because no shipped spec file
covers AC-12's stepping, the QA stage that would have caught the difference is retired (ADR-022), and
`03-impl-log.md` declared it as neither a deviation nor an open question.

The one behavioural difference worth naming: under Monday normalisation the address is **not** a
round trip. Next-then-prev from `/week/2026-10-07` lands on `/week/2026-10-05`, not back on
`/week/2026-10-07`. Under anchor-day stepping it does return. Nothing observable depends on it today
— the rendered week is identical, and no spec asserts the URL after a step — but a shared link that
changes shape when someone steps away and back is the cost of the normalisation, and canonical
week addresses are the benefit.

Two answers close this, and either is implementable inside `allowed_paths` with no new selector:

- **A — the code is right, amend AC-12.** Rewrite AC-12's three addresses as `/week/2026-10-12`,
  `/week/2026-10-05`, `/week/2026-09-28`, and say in § 4.5 that a week's `prevTo`/`nextTo` are
  normalised to the Monday. Costs no code change; the week route already accepts any day.
- **B — the AC is right, change the code.** Step `prevTo`/`nextTo` from `anchor` rather than from
  `monday` at `src/lib/period.ts:307-314`; `label` keeps using `monday` and is unaffected. Three
  lines, one file, and the `/` arm at `:285-291` needs the same decision stated for it — there the
  anchor is `currentDay()`, so the two forms differ there too.

I have not amended `01-plan.md` or changed the arithmetic. Which side is wrong is § 4.5's sentence to
write, not mine — the normalisation may well be the better behaviour and I did not want to encode a
preference as a fix.

**A.** **Answer A. The code is right, AC-12 was wrong, and I have amended it.** You were right not to
touch the arithmetic.

**It is firmer than "either is defensible", and the evidence is a shipped test rather than a
preference.** Monday normalisation is not a decision `period.ts` made — it is what CAL-05 shipped and
what the suite already asserts:

- `src/routes/WeekView.tsx:287` and `:293` are `addDays(start, ∓7)`, where `start` is the Monday.
  `periodNavFor` reproduces that exactly.
- `tests/e2e/cal-05-week-view.spec.ts:271-289` walks it **from the very anchor AC-12 uses**. It opens
  `/week/2026-10-07`, asserts `data-week-start` is `2026-10-05`, presses `week-prev` to `2026-09-28`,
  presses `week-next` twice to `2026-10-12`, and closes on
  `await expect(page).toHaveURL(/\/week\/2026-10-12$/)` — **the address itself, asserted, and it is a
  Monday.** So your option A's three addresses are not a new contract; they are the one the product
  has been keeping since CAL-05.
- `tests/e2e/cal-08-holiday-shading.spec.ts:406-407` steps `week-next` twice and annotates the
  results "week of 2026-10-05" and "week of 2026-10-12". Same rule, second file.

**The decisive argument against B is that it would create the defect § 4.5 exists to remove.** That
section's whole purpose is that `mondayIndex` was duplicated character-for-character in `WeekView`
and `MonthView` and that moving it here "deletes a duplicate rather than creating a third copy."
Stepping `prevTo`/`nextTo` from the anchor day would put **two different week-stepping rules on one
screen** — the top bar moving by Wednesdays while `week-prev` and `week-next` sit beside it moving by
Mondays, until UIE-03 removes the in-page pair. That is the same duplication one layer up, in
behaviour instead of in code, and it is worse than the code kind because no lint rule can see it.

**Your round-trip observation is correct and I am accepting the cost knowingly**, so it is recorded
in § 4.5 rather than left for a reviewer to rediscover: next-then-prev from `/week/2026-10-07` lands
on `/week/2026-10-05` and not back where it began. That is canonicalisation, not loss — the rendered
week is identical, `shell-period-anchor` reads identically, and `/week/2026-10-05` is already the
name CAL-05 gives that week. Worth noticing that the corrected sequence still returns the member to
**the week they started on** at its first `prev`; only the address is canonical rather than the one
they arrived by.

**On your reason for routing here rather than to `/review`: it was the right call, and it cost
nothing.** The answer happens to be A, so no code moves and the reviewer is not judging a tree about
to shift — but that was not knowable before the question was answered, and asking was cheaper than a
review that might have been invalidated. `04-review.md` finding 2 is discharged by this reply.

**A note on `03-impl-log.md` declaring it as neither a deviation nor an open question.** That is the
one thing worth doing differently. § 4.5 specified `prevTo`/`nextTo` only as *"`to` for
`shell-period-prev`"* and fixed the arithmetic nowhere, so implementing it required a choice the plan
had not made — which is an open question at `/implement` even when the choice turns out to be right.
It was caught by REVIEW; with QA retired (ADR-022) and no spec covering AC-12's stepping, REVIEW was
the last gate that could have.

**Amended:** `01-plan.md` § 2 AC-12 — the three addresses corrected to `/week/2026-10-12`,
`/week/2026-10-05`, `/week/2026-09-28`, with the superseded form and its reason kept beneath rather
than deleted; § 4.5 — the Monday rule now stated for both the `/week/:day` and the `/` arm, with the
round-trip cost named; and the Changelog. **No code changed and `rework_count` is not incremented** —
this was a defect in the artifact, not in the implementation.

---
from: tech-lead-design
to: operator
asked_at: 2026-09-07T14:25:00+07:00
---

**Q.** **`node scripts/check-docs.mjs` now fails, and nothing in the loop will stop this ticket
because of it.** Raised here rather than in chat alone so the finding survives in the repository.

```
FAIL D6 (2)
  - .ai/registry/features.md: mentions src/routes/Home.tsx, which does not exist on disk
```

`src/routes/Home.tsx` is deleted by this ticket — correctly, and the feature row itself says so:
`features.md:150` reads *"`src/routes/Home.tsx` does not survive it"*. D6 checks that paths a
human-owned document names exist on disk, so the row describing the deletion is now reported as a
broken reference. Two other mentions at `:128` and `:130` are **historical** — they record which
files OPS-001 and OPS-002 touched at the time — and are correct as written.

**Nobody in this ticket can fix it, and that is by design rather than by oversight.**

- `.ai/registry/features.md` is registry plane (RULE-01) and is **not** in this ticket's
  `allowed_paths`, so neither the Developer nor I may edit it.
- `scripts/check-docs.mjs` carries the `OWED_PATHS` waiver map, and its own comment at `:42-44` says
  the waiver is deliberately expensive and that `.github/CODEOWNERS` puts `scripts/` behind owner
  review **"so that no agent can add one to get past its own gate"**. That is the check working. It
  also means an agent adding a waiver here would be doing exactly what the comment forbids.

**It does not block `/ship`, and that is the part worth knowing.** The Definition of Done
(`.ai/01-operating-model.md:349-353`) is five items — both gates, the diff inside `allowed_paths`,
the four test commands at exit 0, zero invariant violations, and a complete `03-impl-log.md`. **The
docs audit is not among them**, `/ship` does not run it, and neither `03-impl-log.md` nor
`04-review.md` mentions it. So UIE-02 can ship green while the audit is red, and the failure is then
inherited by the next ticket, which will meet it having done nothing to cause it.

**Three ways it closes, and the choice is yours:**

1. **Amend `features.md:150`** so the row states the removal in a form D6 does not read as a live
   reference. A feature-row edit needs no ADR under RULE-01; CODEOWNERS review at merge is the
   approval. Smallest change, and it leaves `:128` and `:130` — also stale for the same reason —
   still failing unless they are reworded too.
2. **Teach D6 a third category.** It already tells an *owed* path from a *broken* one, as of
   `e1c8549`. A path a document records as **removed** is neither, and this is the first ticket to
   produce one. Steward work on `scripts/`, behind CODEOWNERS.
3. **Add `src/routes/Home.tsx` to `OWED_PATHS`.** Named only to reject it: that map is for a path
   whose absence is *owed*, and it errors the moment the file exists. A deleted file is the opposite
   case and would sit there permanently, which is the waiver-outliving-its-reason failure the map's
   own comment warns about.

**My reading is 2, with 1 as the immediate unblock** — but this is a registry and steward decision
and I have made neither change.

**A.** <awaiting operator>

**Amended:** none — nothing in `01-plan.md` is wrong about this. The finding is outside the ticket.
