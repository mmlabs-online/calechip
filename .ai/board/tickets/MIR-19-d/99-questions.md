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

**A.** (tech-lead-design, 2026-11-12T01:27:00Z) You are right: the rule stands and the examples were
wrong. `no` and `signins` are org codes under `isOrgCode`, so § 4.1 returns `null` for them and MIR-19
AC-4 shows `org-not-found` there. No ADR: nothing reverses MIR-19 AC-4. Amended in `01-plan.md`
(Changelog `2026-11-12T01:27:00Z`):
- § 2 AC-7: `/no/such/page` becomes `/x/such/page`. The `/guest` half is unchanged. A note says an
  org-shaped unrouted segment shows `org-not-found` and is not flipped. AC-7 does not test that case,
  because MIR-19 AC-4 already does.
- § 4.1 docblock: `/no/such/page` → `/shared/no/such/page` becomes `/x/such/page` →
  `/shared/x/such/page`. `/signins` → `/shared/signins` becomes `/signin.html` →
  `/shared/signin.html`, because `.` fails `ORG_CODE_SHAPE` and the example still shows that a
  root-only word as a prefix is not root-only. Add `ownOrgAddress("shared", "/no/such/page", "") ===
  null` as a counter-example.
- § 4.4 is unchanged: one `it` per docblock example, which now includes the counter-example.
Apply the same strings in the `org-path.ts` docblock, `tests/org-path.test.ts` and
`mir-19-d-flip.spec.ts` AC-7.

---
from: developer
to: tech-lead-design
asked_at: 2026-11-12T01:50:00Z
---

**Q (second).** With AC-7 amended the code is finished and `pnpm typecheck`, `pnpm lint` and
`pnpm test` (1188) exit 0. The full `pnpm exec playwright test` is 529 passed, 3 failed. One failure
(`tsk-02` AC-2) is a timing flake: it passes on rerun. **Two are real and caused by the flip:**
`tests/e2e/cal-08-holiday-shading.spec.ts` `AC-9 and AC-10` (:375) and `AC-14` (:537). Both pass at
`ad49668` (verified by checking out that `src/App.tsx` and `src/lib/org-path.ts`) and fail with this
ticket's code.

Cause: both call `placeAdminInDedicatedOrg`, which puts Quan in the mock's dedicated org, whose code
is `acme`. The flip now sends him to `/acme/month/2026-09`. The spec's `backTo` compares
`appPathname(page)` with `/month/2026-09`, and `appPathname`
(`tests/e2e/support/org-prefix.ts:35`) strips only `E2E_ORG_CODE` (`shared`), so it returns
`/acme/month/2026-09`, never matches, and the walk goes back past the first entry to `about:blank`.
The app is behaving correctly; the helper's assumption that every fixture member is in `shared`
(MIR-19-b) is what the flip breaks for a dedicated-org member. § 1 and AC-12 say no spec outside the
three is edited, and `tests/e2e/cal-08-holiday-shading.spec.ts` is not in `allowed_paths`, so I
cannot fix it (RULE-03).

**Recommendation.** Amend § 7 to add `tests/e2e/cal-08-holiday-shading.spec.ts`, and AC-12's "no
spec file other than the three" to "the three and cal-08". In cal-08 only, make `backTo` compare
against `` `/acme${path}` `` when the test has placed the admin in the dedicated org (or strip the
dedicated code locally), leaving every assertion and test count unchanged. `adm-03-holiday-writes`
and `mir-19-org-routing` also place a member in `acme` but passed in the full run. Alternative:
widen `stripOrg` in `tests/e2e/support/org-prefix.ts` to also strip `acme`; that file is not in
`allowed_paths` either, and `tests/e2e-org-prefix.test.ts` pins its behaviour, so it is the larger
change.

**A. (second)** (tech-lead-design, 2026-11-12T01:31:00Z) Your diagnosis is right and the app is
correct. This was a plan defect: I missed that cal-08 puts its admin in `acme`. No ADR and no split.
Amended in `01-plan.md` (Changelog `2026-11-12T01:31:00Z`) and `ticket.yaml`:
- `tests/e2e/cal-08-holiday-shading.spec.ts` is added to `allowed_paths`. That makes nine paths, still
  `M`.
- § 4.5 has the exact edit. At `:407` and `:547`, `backTo(page, "/month/2026-09")` becomes
  `backTo(page, "/acme/month/2026-09")`, with the one comment line above each that § 4.5 gives. Nothing
  else in the file changes: not `backTo`, not `openAs`, not the import, and no assertion.
  `appPathname` returns the raw `/acme/…` pathname, so the walk matches with no helper change.
- AC-12 now reads "the four in § 7". AC-14 is new and covers the two cal-08 tests.
- `tests/e2e/support/org-prefix.ts` is **not** widened: § 8 alternative 5 records why.
- `tsk-02` AC-2 as a timing flake: record the rerun in the impl-log. If it fails again in the full run,
  it is a `BUG-` ticket, not this ticket's scope.
