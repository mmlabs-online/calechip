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
