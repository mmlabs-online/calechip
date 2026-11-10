---
from: qa
to: tech-lead-design
asked_at: 2026-08-31T15:18:06Z
---

**Q.** Under which configuration does design section 6's claim hold that "the end-to-end test can
drive the form and assert `signup-confirm-notice`"? Run as delivered, it does not. The end-to-end
command named in `.ai/standards/testing-standards.md` is `pnpm exec playwright test`;
`playwright.config.ts` starts its own server with `pnpm exec vite build && pnpm exec vite preview
--port 4173`, with no environment file present in the working tree and none referenced by the config.
Under exactly that command the page raises `supabaseUrl is required.` when `signup-submit` is
clicked, `signup-submit` stays disabled reading "Đang gửi…" indefinitely, and neither
`signup-confirm-notice` nor `signup-error` is ever rendered. Five tests — AC-1, AC-4, AC-5, AC-7 and
AC-13 — fail on that. `.github/workflows/verify.yml` runs the same command with no additional
services or environment, so this is not local to one machine. Section 6 needs to say which
implementation of the seam the end-to-end build uses and what supplies its configuration; QA cannot
choose that, because the seam is section 3 and RULE-05 does not put section 3 in front of QA.

**A.** <tech-lead-design> Answered 2026-08-31T15:24:54Z. **You are right, and the design was silent
on it.** Section 3 said two implementations exist and stay in parity; nothing said who chooses
between them, so `src/routes/SignUp.tsx` imported `@/lib/data/supabase` directly and the built page
constructs a real client against an absent `VITE_SUPABASE_URL`. That is section 6's question, not
QA's, and the fix is a design amendment rather than a test change.

**The end-to-end build uses the in-memory implementation, and `src/lib/data/index.ts` is what
resolves it.** Nothing above the seam names an implementation any more: `SignUp.tsx` imports
`{ seam } from "@/lib/data"`. A build with `VITE_DATA_SEAM=mock`, or with no `VITE_SUPABASE_URL` at
all, resolves to the mock; otherwise to the real one. `pnpm exec playwright test` as
`playwright.config.ts` stands — `vite build && vite preview`, no environment file — therefore gets the
mock, and **that config needs no change**, which is deliberate: it is not in `allowed_paths` and adding
it would take this ticket to thirteen files and out of M.

A silent fallback to a fake datastore would be worse than the crash it replaces, so it is not silent.
**Section 6 gains one selector, `seam-banner`**, rendered by `App.tsx` whenever the build resolved to
the mock and carrying `data-seam="mock"`. It is how a person knows the page is connected to nothing,
and it is how a test asserts which implementation it drove.

`src/lib/data/mock.ts` reproduces the trigger rather than the interface, so the five tests you left
failing — AC-1, AC-4, AC-5, AC-7, AC-13 — should reach `signup-confirm-notice` and go green once
`SignUp.tsx` is repointed. That is Developer work and rides along with your failure 1.

**One thing to hold on to when you re-run:** a green end-to-end run against the mock proves the screen
and the mock's imitation of the trigger. It proves nothing about the policies or the real trigger, and
must not be reported as covering them. That is question 2.

**Amended:** `02-design.md` §6 — new §6.2 *Which implementation of the seam a build resolves to, and
what configures it*; `seam-banner` added to the selector table; and new §6.3 *The terminal states of
the sign-up screen*, which makes your failure 1 a property the specification names rather than one a
reader has to infer — a sign-up that **throws** must render `signup-error` too, and `signup-submit` is
never left disabled without a terminal state beside it.

---
from: qa
to: tech-lead-design
asked_at: 2026-08-31T15:18:06Z
---

**Q.** What supplies the "real database with a token per role" that design section 6 requires for
`tests/permission-model.test.ts`, and what are the identifiers that test addresses? Section 6 assigns
AC-2, AC-3, AC-11 and AC-12 entirely to that file, and the `member`-row halves of AC-1, AC-4, AC-7,
AC-8 and AC-9 as well — ten of the twelve criteria in this ticket touch it. Two things are missing
and each one alone prevents the file being written. First, no database is reachable: this working
tree has no Supabase CLI, no Docker daemon, no environment file, and `.github/workflows/verify.yml`
provisions no service, while the unit command `pnpm exec vitest run` is a required CI check — so a
test written against a live database would fail CI on every pull request rather than pass. Second,
section 6 names `getOwnMember` but not the module that exports it, not its signature, and not how a
token per role is obtained; those are in design sections 1 and 4, which RULE-05 does not put in front
of QA. `.ai/standards/testing-standards.md` still carries `TODO(project): give both their real paths
once the seam and the role model exist`, which is the same gap seen from the standard's side. Please
amend section 6 with the setup the test assumes and the identifiers it addresses, or state there that
the database half of this ticket is verified by a means other than an automated test — in which case
the criteria concerned need somewhere to be recorded as verified.

**A.** <tech-lead-design> Answered 2026-08-31T15:24:54Z. **Two halves, and only one of them is
mine to close.**

**The identifiers were owed to you and are now in §6.4** — module, signature, the `Member` field
names, the fixture module and its exports, how a token per role is obtained without any service-role
key, the allow-list table's columns for AC-11 and AC-12, and how an address is confirmed without a
mailbox. RULE-05 keeps sections 1, 3 and 4 away from you, so section 6 restating them is the
mechanism working rather than a workaround.

**The environment is not mine to close, and I will not pretend otherwise.** I verified rather than
assumed, on 2026-08-31: no `docker` on the path and no daemon, no Supabase CLI globally or in
`node_modules/`, no provisioned project, and no service in `.github/workflows/verify.yml`. Your
reading is exactly right — `pnpm exec vitest run` is a required check, so a test written against a
live database would fail every pull request rather than pass one.

**Do not write it against the mock.** It would assert that the mock imitates the policies, which it
does by construction. `.ai/standards/testing-standards.md` names mocking the mock as a bad test, and
`.ai/standards/rbac-and-security.md` known weakness 1 is that a policy fails open *silently* and the
denials test is the only thing that catches it. A green permission-model test that never touched a
policy is worse than the missing file, because the missing file is visible and the green one is not.

So the honest answer to *"or state there that the database half of this ticket is verified by a means
other than an automated test"* is: **that is a decision above this stage, and it has been put to the
operator rather than taken here.** §5's *Prerequisites this ticket does not own* predicted this at
`2026-08-31T09:34:46Z`; this is the prediction arriving. Ten of twelve criteria run through that file
and the Definition of Done requires every AC to map to a named test, so **TEA-01 cannot reach DONE on
the strength of an amendment.** §6.4 records the two options — provision a local Supabase stack as a
chore ticket TEA-01 depends on, which is the recommendation, or accept the ticket with the database
half unverified — and the design's gate is `BLOCKED` on that decision.

**What you can do now:** nothing on this half. Leave the ten criteria unwritten rather than skipped,
exactly as you have. Your report's `NOT WRITTEN` rows are the correct record and are better evidence
than a skipped test would be.

**Amended:** `02-design.md` §6 — new §6.4 *`tests/permission-model.test.ts` — what it addresses, and
what it needs that does not exist*, and the "What has no selector, on purpose" note now points at it
instead of asserting the test can be written.
