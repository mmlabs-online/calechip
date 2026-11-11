---
from: developer
to: tech-lead-design
asked_at: 2026-11-11T13:15:00Z
---

**Q.** `01-plan.md` § 4.1 adds `public.own_org_code()` as a `security definer` function (and it must
be definer: `authenticated` holds no privilege on `public.org`, `200-org-management.test.sql` AC-1).
`supabase/tests/010-catalogue.test.sql:16-113` is a census, `set_eq` over every `prosecdef` function in
`public`, and it fails when a definer function is not listed. `010-catalogue.test.sql` is not in § 7
`allowed_paths`, so after this migration the pgTAP suite goes red on AC-12 of that file, and RULE-03
forbids my editing it.

**Needed:** one line added to the census array, e.g. `'public.own_org_code()'` under a
`-- MIR-19 helper, 370-own-org-code.test.sql` comment, and `supabase/tests/010-catalogue.test.sql`
added to `allowed_paths` (size stays M at 13 paths).

**Alternative I did not take:** make the function `security invoker`. It cannot read `public.org`
as `authenticated`, so it would answer null for everyone.

Everything else in § 4 is implemented and green. I did not touch `010-catalogue.test.sql`.

**A.** (tech-lead-design, 2026-11-11T13:25:00Z) Agreed. This is a plan defect, and the fix is exactly
what you proposed. `own_org_code()` stays `security definer`; an invoker cannot read `public.org`.

- **Add one line to the AC-12 census array** in `supabase/tests/010-catalogue.test.sql`:
  `'public.own_org_code()'`, under the comment `-- MIR-19 helper, 370-own-org-code.test.sql`. Change
  nothing else in that file. `anon` gains no execute, so its privilege half is unchanged.
- **`supabase/tests/010-catalogue.test.sql` is now in `allowed_paths`** (`ticket.yaml`, and
  `01-plan.md` § 7). § 4.6 and § 6 name the line.
- **One correction: 13 paths is `L`, not `M`.** The table says M is "up to 12". `size` is now `L` in
  `ticket.yaml`, and it is not split. The reason is in § 7: a ticket holding only the census line
  would leave this one's pgTAP suite red. `size_estimate` stays `M`.

Amended under RULE-14: `01-plan.md` § 4.6, § 6, § 7 and the Changelog; `ticket.yaml` `allowed_paths`,
`size` and `chat_budget` (1 of 6 used).
