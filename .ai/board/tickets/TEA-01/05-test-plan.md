---
ticket: TEA-01
stage: QA
agent: qa
produced_at: 2026-08-31T15:59:31Z
revision_of: 2026-08-31T15:18:06Z
branch: feat/TEA-01
inputs_read:
  - .ai/board/tickets/TEA-01/01-story.md      # unchanged, revision of 2026-08-31T09:23:25Z
  - .ai/board/tickets/TEA-01/02-design.md     # section 6 only (RULE-05), revision of 15:35:07Z
  - .ai/board/tickets/TEA-01/99-questions.md  # this agent's own two questions, now answered
  - .ai/board/tickets/TEA-01/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
  - tests/seam-parity.test.ts
  - tests/e2e/smoke.spec.ts
  - playwright.config.ts
  - vite.config.ts
  - package.json
  - .github/workflows/verify.yml
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
waived: true   # operator waiver 2026-08-31T16:44:10Z — the full block is in 06-test-report.md's
               # front-matter. The plan below is UNCHANGED: AC-2, AC-3, AC-9, AC-10, AC-11 and AC-12
               # still have no planned test, and tests/permission-model.test.ts is still unwritten.
next_state: DONE
---

# TEA-01 — test plan

Second revision. The first was written at `2026-08-31T15:18:06Z` against the design as it stood then;
section 6 has since gained 6.2, 6.3 and 6.4 in answer to this agent's two questions, and the
implementation has been reworked. Written from `01-story.md` and section 6 of `02-design.md`. No file
under `src/` or `_figma/` was read (RULE-05).

## What changed since the first revision

- **The interface half is now runnable and is fully covered.** §6.2 resolves a build with no
  `VITE_SUPABASE_URL` to the in-memory seam instead of to a page that throws, so AC-1, AC-4, AC-5,
  AC-7 and AC-13 are exercisable end to end. The five tests the first revision left failing pass.
- **§6.2 added `seam-banner`**, and this plan uses it to make the suite state its own scope rather
  than leave it to the report — see *Fixtures and scope* below.
- **§6.3 named the terminal states of the sign-up screen**, which is the property behind the first
  revision's developer-routed failure. It has a test, with one row of it out of reach; see
  *Out of scope*.
- **§6.4 supplied the identifiers** the first revision asked for — module, `getOwnMember`'s signature,
  the `Member` fields, the fixture exports, how a token per role is obtained without a service-role
  key, the `allowed_email` columns, and how an address is confirmed without a mailbox. **The database
  those identifiers address still does not exist**, and §6.4 says so plainly. So the blocked half of
  this plan is blocked for one reason now instead of two, and it is the reason QA cannot remove.

## Coverage map

**AC-6 has no row on purpose** — the story moved it to the sign-in half of the split and retained the
number as a deliberate gap; §6 repeats it.

### Written and passing — `tests/e2e/tea-01-signup.spec.ts`

| AC | Test name | Level | Selectors used |
|---|---|---|---|
| §6.2 | `6.2: this run drives the in-memory seam, and the page says so` | e2e | `seam-banner` (`data-seam`) |
| AC-8 | `AC-8: the person supplies a display name and an avatar before sign-up is offered` | e2e | `signup-form`, `signup-email`, `signup-password`, `signup-display-name`, `signup-avatar-option`, `signup-submit` |
| AC-8 | `AC-8: the avatar picker offers distinct, addressable choices` | e2e | `signup-avatar-picker`, `signup-avatar-option` (`data-avatar`) |
| AC-1 | `AC-1: an allow-listed address completes sign-up and is told to confirm the address` | e2e | the form selectors, `signup-confirm-notice`, `signup-error` |
| AC-4 | `AC-4: the address matches without regard to case` | e2e | as AC-1 |
| AC-5 | `AC-5: an address that is not on the allow-list returns the same result as one that is` | e2e | as AC-1 |
| AC-13 | `AC-13: sign-up ends on its own answer and does not redirect to a signed-in view` | e2e | as AC-1 |
| AC-7 | `AC-7: no signed-in view is reached before the address is confirmed` | e2e | as AC-1 |
| AC-1, AC-5 (§6.3) | `AC-1 and AC-5: the screen reaches one terminal state and never strands signup-submit` | e2e | `signup-submit`, `signup-confirm-notice`, `signup-error` |

**The first row is a guard, not a criterion.** §6.2 states that an end-to-end run against the mock
"proves the screen and the mock's imitation of the trigger" and "proves nothing about the policies or
the real trigger". A suite that asserts which implementation it drove cannot have that claim quietly
overturned by a later configuration change; without it, the honesty of every row beneath depends on a
sentence in a report.

### Specified and blocked — `tests/permission-model.test.ts`

Not written. §6.4 gives every identifier these need and states that the environment does not exist.
The module is `@/lib/data` forced to the real implementation, the reader is
`getOwnMember(userId: string): Promise<Member | null>`, the fixtures are `FIXTURE_TEAM`,
`FIXTURE_ADMIN`, `FIXTURE_ALLOWED_EMAIL`, `FIXTURE_CONSUMED_EMAIL` and `FIXTURE_UNLISTED_EMAIL` from
`@/lib/fixtures`, and the three identities are anonymous, member and admin with no service-role key.

| AC | Test name | Level | Reaches the system by |
|---|---|---|---|
| AC-1 | `AC-1: the member row carries the auth user's id, the entry's team, role member, and a null removed_at` | unit (real database) | confirm the address at the database level, then `getOwnMember` |
| AC-2 | `AC-2: the allow-list entry is consumed at the moment the member row is created` | unit (real database) | `allowed_email.consumed_at` against the row's `createdAt` |
| AC-3 | `AC-3: a consumed entry does not admit a second person` | unit (real database) | a second auth user for `FIXTURE_CONSUMED_EMAIL`; assert no second member row and the first unchanged |
| AC-4 | `AC-4: an address differing only in case matches and consumes the entry` | unit (real database) | sign up as the upper-cased `FIXTURE_ALLOWED_EMAIL` |
| AC-7 | `AC-7: the member row does not exist before confirmation and exists after it` | unit (real database) | `getOwnMember` before confirming returns null; set `email_confirmed_at`; read again |
| AC-8 | `AC-8: the display name and the chosen data-avatar reached the member row` | unit (real database) | the `data-avatar` value the e2e suite selects, read back off `Member.avatar` |
| AC-9 | `AC-9: every sign-up produces role member, allow-listed or not` | unit (real database) | `Member.role` after an allow-listed and an unlisted sign-up |
| AC-10 | `AC-10: adding an address to the allow-list sends nothing to it` | unit (real database) | assert the allow-list write triggers no outbound mail |
| AC-11 | `AC-11: a member reads no rows from allowed_email` | unit (real database) | the member client against `allowed_email` |
| AC-12 | `AC-12: an admin reads their own team's entries, consumed and unconsumed alike` | unit (real database) | the admin client against `allowed_email` |

### Already in the tree

| Covers | Test name | Level |
|---|---|---|
| the seam-parity obligation in `.ai/standards/testing-standards.md` | `data-access seam parity` (2 tests, `tests/seam-parity.test.ts`) | unit |

## Refusal cases

| Refusal | Test | Probes | Status |
|---|---|---|---|
| An unlisted address is indistinguishable from an allow-listed one at the screen | `AC-5: …` | AC-5's enumeration-oracle reasoning | **passing** |
| Sign-up does not sign anybody in | `AC-13: …`, `AC-7: …` | AC-7, AC-13 | **passing** |
| The screen never strands the person with no answer | `AC-1 and AC-5: … never strands signup-submit` | §6.3 | **passing, one row unreachable** |
| A consumed entry admits nobody else | `AC-3: …` | ADR-009, INV-07 | blocked |
| An unlisted address produces no member row | `AC-9: …` | INV-04 denominator | blocked |
| A member reads no allow-list rows | `AC-11: …` | RBAC table | blocked |
| Nobody, of either role, may insert into `member` directly | companion to `AC-11`/`AC-12` | story *Permissions* | blocked |

**Every refusal that touches a row-level security policy is still in the blocked half.** The story
says the trigger and the policies **are** the feature and the interface is decoration over them; §6.2
says the same from the other side. The passing refusals above are the mock's imitation of the trigger,
which it satisfies by construction. This has not changed since the first revision and is the single
most important fact in this plan.

## Invariant probes

| Invariant | Probe test | If absent, why |
|---|---|---|
| INV-04 | `AC-7: the member row does not exist before confirmation and exists after it` | Blocked. The exposure is the denominator: an unconfirmed account holding a member row would raise the absence-count threshold for a whole team. The passing `AC-7` e2e test proves no *session* is established before confirmation, which is a weaker and different fact. |
| INV-07 | `AC-1: the member row carries the auth user's id, the entry's team, role member, and a null removed_at` | Blocked. The probe is that `team_id` comes from the allow-list entry and nowhere else. Not observable from the browser. |

Both probes remain unwritten. Neither invariant is observed to be violated; both are **unobserved**.

## Fixtures and scope

§6.4 names `@/lib/fixtures` and its five exports, and says `supabase/seed.sql` inserts the same
literals — which closes the first revision's fixture gap for the blocked half. Those fixtures cannot
be used by the e2e suite here: it drives the mock, and the addresses it needs are the ones the mock's
own seed holds.

The e2e suite therefore still uses `an@example.com` and `khach@example.com`, transcribed from AC-1 and
AC-5. That remains sound for these tests and only for these tests, because AC-5 makes the two
indistinguishable from the browser, so no assertion depends on which address the running seam holds an
entry for. The `6.2` test is what keeps that reasoning checkable rather than assumed.

## Out of scope for this plan

- **Everything in the story's *Out of scope*** — the sign-in half of the split, TEA-02, TEA-03, TEA-04,
  and the seed that creates the first team and first admin.
- **§6.3's third terminal state — `signUp` *throws*.** This is the row the first revision's
  developer-routed defect actually lived in, and it is not reachable under the build the end-to-end
  command produces: §6.2 resolves to the mock whenever `VITE_SUPABASE_URL` is absent, and the mock
  neither throws nor returns a failure on any input this plan can supply. Forcing the real seam needs
  a second build with a different environment, and `playwright.config.ts` is not in `allowed_paths` —
  §6.2 says keeping it out is deliberate. The property is asserted on both reachable paths; the throw
  path becomes testable with the same stack the blocked half waits on.
- **Accessibility and performance** beyond the standards baseline. The avatar radiogroup is exercised
  through `data-testid` only.
- **The mechanism behind AC-4.** The story states the behaviour, not the mechanism, so `citext` and a
  normalising constraint both satisfy it.
- **Whether the migration and the policies are correct.** Read by nobody in this stage and asserted by
  nothing that runs. That is the blocked half, not a decision.

## Selector and environment gaps

**No selector gap.** Every control section 6 lists that an interface-observable criterion needs was
found in the markup at its named `data-testid`, `seam-banner` included.

**One environment gap, and it is not QA's to close.** `tests/permission-model.test.ts` needs a
database. §6.4 records that none exists — no Docker daemon, no Supabase CLI, no provisioned project,
no service in `.github/workflows/verify.yml` — and that `pnpm exec vitest run` is a required check, so
a test written against a live database would fail every pull request rather than pass one. §6.4 also
forbids writing it against the mock, and gives the reason: it would assert that the mock imitates the
policies, which it does by construction, and a green permission-model test that never touched a policy
is worse than the missing file because the missing file is visible.

The operator has chosen to provision the stack; the chore is specified in the design's *Appendix A*
and `product` assigns it an ID at `/triage`. **That ticket does not exist on the board yet.** No new
question is raised here — asking again would consume the `qa->tech-lead-design` budget for something
already answered and already decided. The plan simply records what it is waiting for.
