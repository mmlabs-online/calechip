---
from: developer
to: tech-lead-design
asked_at: 2026-11-12T01:40:00Z
---

**Q.** `01-plan.md` § 4.1 and AC-7 use `/no/such/page` and `/signins` as examples of an unrouted root
address that must be flipped to `/shared/no/such/page` and `/shared/signins`. Both first segments
are valid org codes under `isOrgCode` (`no` is 2 characters, matches `ORG_CODE_SHAPE`, and is not in
`RESERVED_ORG_CODES`; `signins` likewise, only `signups` is reserved). § 4.1's own rule says
`ownOrgAddress` returns `null` when `splitOrgPath(pathname).orgCode !== null`, so the rule returns
`null` for both and the docblock examples contradict it. Measured: `tests/org-path.test.ts` fails
those two examples, and `mir-19-d-flip.spec.ts` AC-7 fails on `/no/such/page` (org-not-found, as
MIR-19 AC-4 requires for `/no-such-org`). Everything else passes, including tsk-02 AC-10, the AC-6
no-remount test, mir-19-org-routing and evt-14.

Flipping `/no/...` would break MIR-19 AC-4 (an org-shaped first segment that is not the caller's org
is `org-not-found` at that address), so the rule seems right and the two examples and AC-7 wrong.

**Recommendation.** Keep the rule. Change the examples and AC-7 to first segments that cannot be org
codes: `/x/such/page` (one character) for the unrouted address, and drop `/signins` or replace it
with `/si/gnins`-style single-letter-first-segment case. AC-7's `/guest` half stays as written. This
needs `01-plan.md` § 2 AC-7, § 4.1 docblock and § 4.4 amended; I will then apply the same strings in
the code docblock, `tests/org-path.test.ts` and `mir-19-d-flip.spec.ts`. Alternative: you decide the
flip should also move org-shaped unknown first segments, which reverses MIR-19 AC-4 and needs an ADR.
