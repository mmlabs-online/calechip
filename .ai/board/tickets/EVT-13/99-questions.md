---
ticket: EVT-13
from: developer
to: tech-lead-design
asked_at: 2026-10-15T08:10:00+07:00
---

# Q1 — two more e2e specs open the guest page signed in as the creator

**Evidence.** With § 4 implemented, `CI=1 pnpm exec playwright test tests/e2e/evt-10-description.spec.ts
tests/e2e/evt-11-description-pictures.spec.ts --retries=0` fails 5 tests, all of the same shape as the
`evt-07` journeys § 7 names: the creator, still signed in, `navigate`s to the guest link to check the
guest surface and is now — correctly, AC-1 — sent to `/events/<id>`.

- `tests/e2e/evt-10-description.spec.ts:237` (AC-2/3/4, navigate at `:315`), `:329` (AC-6, `:361`),
  `:418` (AC-8, `:435`)
- `tests/e2e/evt-11-description-pictures.spec.ts:206` (AC-3, `:216`), `:266` (AC-7, `:296`)

Neither file is in `allowed_paths`, so RULE-03 forbids the fix.

**Proposed fix**, the same as § 7's for `evt-07`: before each guest-surface `navigate`, sign out (each
file's own `home-sign-out` + wait for `sign-in-submit`), so the guest page is asserted as a signed-out
caller sees it — a change of who drives the journey, not of what it asserts. If a later step in the
same test needs the creator again, sign back in by client-side navigation to `/`.

**Ask.** Add both paths to `allowed_paths` (plan § 7 and `ticket.yaml`), or say what to do instead.

## Answer to Q1

from: tech-lead-design
answered_at: 2026-10-15T08:04:35+0700

**Agreed.** Both paths are added to `allowed_paths` in `01-plan.md` § 7 and in `ticket.yaml`.

**Reason.** The evidence holds on reading: `evt-10-description.spec.ts` AC-2/3/4 (`:237`, navigate
`:315`), AC-6 (`:329`, `:361`) and AC-8 (`:418`, `:435`), and `evt-11-description-pictures.spec.ts`
AC-3 (`:206`, `:216`) and AC-7 (`:266`, `:296`) each sign in as `MEMBER`, create the event — so the
driver is its creator, a reader under AC-2 — and then open the guest link in the same session. AC-1
now sends that caller to `/events/<id>`, so the guest-surface assertions cannot run. This is the same
case § 7 already planned for `evt-07` and missed for these two files; the plan was incomplete, not
the story.

**What the fix may and may not do.** Sign out before each guest-surface `navigate` (the file's own
`home-sign-out`, then wait for `sign-in-submit`), and sign back in by client-side navigation only if a
later step needs the creator — never `page.goto` after the first, which resets the mock's tables. Do
not change any assertion on either surface, and do not switch the driver to a non-reader member in
these files: a signed-out caller is what the guest page under test is for (AC-5).
