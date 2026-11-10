---
from: developer
to: tech-lead-design
asked_at: 2026-10-23T15:45:00+07:00
---

**Q.** With every § 4 contract item implemented, `pnpm test` fails one existing test outside this
ticket's `allowed_paths`:

```
tests/draft-entry.test.ts > AC-14 — nothing in the datastore consults the threshold >
20261023120000_mir09_schema_cleanup.sql: no policy, CHECK or BEFORE trigger refers to overload_threshold
```

That `describe` block (`tests/draft-entry.test.ts:280-343`) pins Charter refusal 6: no migration may
let anything in the datastore *consult* `overload_threshold` to refuse a write to something else — a
plan, an entry. Its regex `CAN_REFUSE_A_WRITE` flags any `check(` in a statement that mentions
`overload_threshold`, with no further distinction, so it also flags `team_overload_threshold_range` —
the new constraint this ticket's migration adds on the column `overload_threshold` ITSELF.

I read this as a false positive rather than a real refusal-6 violation: the new constraint validates
an admin's OWN input when setting the threshold (`[0, 1]`, same range ADM-01 AC-7 already asks the
screen to hold) and does not read `overload_threshold` to decide whether some OTHER write — an entry,
a plan — is admitted. It never appears on the right-hand side of a `using` or a `with check` guarding
a different table, which is the shape the test's own positive control (`:331-343`) injects to prove
the scanner fires. ADR-069, which this ticket's plan cites, says nothing about refusal 6 and does not
appear to have been checked against it.

I cannot fix the test myself: `tests/draft-entry.test.ts` is not in `allowed_paths`, and RULE-03
forbids the edit until the plan lists it.

**Asked:** either (a) add `tests/draft-entry.test.ts` to `allowed_paths` and narrow
`CAN_REFUSE_A_WRITE`, or the per-migration assertion, so a `CHECK` constraining the column's own value
does not count as "consulting" it — my proposed narrowing is to exclude a statement whose only
`overload_threshold` token is on the constrained column of its own `alter table public.team …
add constraint` (i.e. this migration's two added lines), while keeping the scanner exactly as
sensitive to a `using`/`with check`/trigger clause that reads the column to gate a different table —
or (b) say what to do instead, if refusal 6 is read more broadly than I have above and the new
constraint should not ship at all.

**A.** Option (a) approved (tech-lead-design, 2026-10-27). The diagnosis holds: Charter refusal 6
forbids consulting `overload_threshold` to refuse a plan or entry write, whereas
`team_overload_threshold_range` (ADR-069) validates the admin's own `[0, 1]` input on `public.team`
itself. Add `IS_OWN_COLUMN_RANGE_CHECK` in `tests/draft-entry.test.ts` and filter it out in
`mentioningThreshold` exactly as specified in `01-plan.md` § 4, leaving `CAN_REFUSE_A_WRITE`, the
per-migration loop and the positive control untouched. `tests/draft-entry.test.ts` is now in
`allowed_paths` (`size` stays `M` at 12 paths).

**Amended:** `01-plan.md` § 4 (`tests/draft-entry.test.ts` contract added), § 7 and `ticket.yaml`
`allowed_paths` (`tests/draft-entry.test.ts` added, 12 paths, `size: M`), and Changelog row added.
