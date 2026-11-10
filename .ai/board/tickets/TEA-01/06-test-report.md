---
ticket: TEA-01
stage: QA
agent: qa
produced_at: 2026-08-31T16:44:10Z
revision_of: 2026-08-31T16:36:28Z
branch: feat/TEA-01
inputs_read:
  - .ai/board/tickets/TEA-01/01-story.md      # unchanged, revision of 2026-08-31T09:23:25Z
  - .ai/board/tickets/TEA-01/02-design.md     # section 6 only (RULE-05), revision of 15:35:07Z
  - .ai/board/tickets/TEA-01/05-test-plan.md
  - .ai/board/tickets/TEA-01/99-questions.md  # this agent's own two questions, now answered
  - .ai/board/tickets/TEA-01/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
waived: true
waiver:
  granted_by: operator
  at: 2026-08-31T16:44:10Z
  instruction: "ignore test. Tạm đánh passed tất cả test"
  temporary: true          # the operator said "tạm" — temporarily
  overturns: "02-design.md §6.4, the choice of 2026-08-31T15:35:07Z to provision a database"
  dod_item_waived: "every AC maps to a named test"
  criteria_unverified: [AC-1, AC-2, AC-3, AC-4, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12]
  # AC-1, AC-4, AC-7 and AC-8 are verified on their screen half only; the other six on no half.
  what_is_not_covered: "the trigger and every row-level security policy — under ADR-005 the whole
    authorization model. No test in this repository has executed one."
  reversal: "delete this waiver block; the gate returns to BLOCKED with no other change."
next_state: DONE
---

# TEA-01 — test report

Second revision, against the rework that followed the first. No file under `src/` or `_figma/` was
read (RULE-05). Fresh session, no message channel; no question was asked this pass.

## Results

| Suite | Command | Exit code | Passed | Failed | Skipped |
|---|---|---|---|---|---|
| unit | `pnpm exec vitest run` | 0 | 2 | 0 | 0 |
| e2e | `pnpm exec playwright test` | 0 | 10 | 0 | 0 |

Run for context, not part of the QA gate: `pnpm exec tsc --noEmit` exit 0, `pnpm exec eslint .` exit 0.

**Both commands exit 0 and the gate still does not turn.** Half the gate is "every `AC-n` maps to at
least one named test", and six criteria map to none. The unit suite is `tests/seam-parity.test.ts`
alone — `tests/permission-model.test.ts` is not written — so that exit code of 0 covers seam parity
and nothing about this ticket's criteria. Reading two green commands as a passing QA stage is the
specific misreading this report exists to prevent.

## What the rework fixed, verified rather than assumed

- **The developer-routed defect from the first revision is fixed.** A sign-up no longer strands
  `signup-submit` disabled with no `signup-error`; the terminal-state test asserts exactly one
  terminal state on both reachable paths and passes. The five tests left failing last pass are green.
- **§6.2 is implemented.** `seam-banner` is present carrying `data-seam="mock"`, so the build the
  end-to-end command produces resolves to the in-memory seam instead of raising `supabaseUrl is
  required.`, and a person looking at the page can see it is not connected to anything.
- **§6.4's identifiers close the first revision's second gap.** They are not exercised by anything,
  because the environment they address does not exist.

## AC coverage

| AC | Test name | Result |
|---|---|---|
| AC-1 | `AC-1: an allow-listed address completes sign-up and is told to confirm the address` | PASS — screen half only |
| AC-1 | `AC-1: the member row carries the auth user's id, the entry's team, role member, and a null removed_at` | **NOT WRITTEN** — no database |
| AC-2 | `AC-2: the allow-list entry is consumed at the moment the member row is created` | **NOT WRITTEN** — no database |
| AC-3 | `AC-3: a consumed entry does not admit a second person` | **NOT WRITTEN** — no database |
| AC-4 | `AC-4: the address matches without regard to case` | PASS — screen half only |
| AC-4 | `AC-4: an address differing only in case matches and consumes the entry` | **NOT WRITTEN** — no database |
| AC-5 | `AC-5: an address that is not on the allow-list returns the same result as one that is` | PASS — the "same result" half; "creates no member" is unverified |
| AC-6 | — | Not in this ticket. The story retains the number as a deliberate gap and §6 repeats it. |
| AC-7 | `AC-7: no signed-in view is reached before the address is confirmed` | PASS — screen half only |
| AC-7 | `AC-7: the member row does not exist before confirmation and exists after it` | **NOT WRITTEN** — no database |
| AC-8 | `AC-8: the person supplies a display name and an avatar before sign-up is offered` | PASS — affordance only |
| AC-8 | `AC-8: the avatar picker offers distinct, addressable choices` | PASS — affordance only |
| AC-8 | `AC-8: the display name and the chosen data-avatar reached the member row` | **NOT WRITTEN** — no database |
| AC-9 | `AC-9: every sign-up produces role member, allow-listed or not` | **NOT WRITTEN** — no database |
| AC-10 | `AC-10: adding an address to the allow-list sends nothing to it` | **NOT WRITTEN** — no database |
| AC-11 | `AC-11: a member reads no rows from allowed_email` | **NOT WRITTEN** — no database |
| AC-12 | `AC-12: an admin reads their own team's entries, consumed and unconsumed alike` | **NOT WRITTEN** — no database |
| AC-13 | `AC-13: sign-up ends on its own answer and does not redirect to a signed-in view` | PASS — whole criterion |
| §6.2 | `6.2: this run drives the in-memory seam, and the page says so` | PASS |
| §6.3 | `AC-1 and AC-5: the screen reaches one terminal state and never strands signup-submit` | PASS — two of §6.3's three rows |

**AC-13 is the only criterion in this ticket that is wholly verified.** It is the one the BA added at
the split precisely so this half would end on its own answer, and it is the one that needs no `member`
row to be observed. Every other passing row above is a criterion's screen half or its affordance;
§6.2 is explicit that a run against the mock proves the screen and the mock's imitation of the trigger
and proves nothing about the policies or the real trigger.

## Failures

No test failed. The two entries below are absences, not failures, and neither routes to an agent.

| # | Test | Expected | Actual | Routes to | Increments `rework_count` |
|---|---|---|---|---|---|
| 1 | the ten rows above marked NOT WRITTEN | `tests/permission-model.test.ts` covering AC-2, AC-3, AC-9, AC-10, AC-11, AC-12 and the `member`-row halves of AC-1, AC-4, AC-7, AC-8 | Not written. §6.4 states the environment does not exist and forbids writing it against the mock. | nobody — a human prerequisite | No |
| 2 | §6.3's third terminal state, `signUp` *throws* | `signup-error`, and the form editable again | Not reachable. §6.2 resolves to the mock whenever `VITE_SUPABASE_URL` is absent, and the mock neither throws nor returns a failure on any input reachable through the form. Forcing the real seam needs a second build with a different environment, and `playwright.config.ts` is deliberately not in `allowed_paths`. | nobody — same prerequisite | No |

**Entry 2 deserves to be read rather than skimmed.** It is the exact row the first revision's defect
lived in: a call that threw, a screen with no terminal state, a disabled button forever. The
specification now names it (§6.3) and the implementation now handles it, but **the regression test for
it does not exist and cannot be written under the current environment.** The property is asserted on
the two paths the mock can reach, which is what makes the fix verified rather than claimed; the throw
path is not one of them. It becomes testable with the same stack entry 1 waits on.

**Nothing routes to `developer`.** The rework is correct on everything reachable, and charging a
prerequisite the developer cannot satisfy against the RULE-06 budget is what RULE-08 exists to
prevent.

## Invariant observations

| Invariant | Held | Evidence |
|---|---|---|
| INV-04 | **Not observed** | The probe is that an unconfirmed auth user produces no `member` row and so does not enter the absence count's denominator. It requires reading the row. `AC-7`'s passing e2e test proves no session is established before confirmation, which is a weaker and different fact. |
| INV-07 | **Not observed** | The probe is that `member.team_id` comes from the allow-list entry and nowhere else. Not observable from the browser at all. |

Neither invariant was observed to be violated and neither was observed to hold. **This is not RULE-07
territory** — an escalation requires a violation with evidence, and there is none. The row is here
because "no failing invariant test" and "no invariant test" read identically in a green suite, and
this suite is now green.

## Selector gaps encountered

None. Every selector in section 6 that an interface-observable criterion needs was found in the markup
at its named `data-testid`, including `seam-banner` added at `2026-08-31T15:24:54Z`, which is asserted
directly. No test in `tests/e2e/tea-01-signup.spec.ts` addresses any attribute, class or DOM path that
is not in section 6.

## Verdict

**BLOCKED.**

Not FAIL: nothing failed, and no agent can act on this. Not PASS: the gate requires every `AC-n` to
map to at least one named test, and **AC-2, AC-3, AC-9, AC-10, AC-11 and AC-12 map to none** — with
AC-1, AC-4, AC-7 and AC-8 verified on their screen half only. Ten of the twelve criteria run through
`tests/permission-model.test.ts`, and under ADR-005 the trigger and the policies that file would test
are the entire authorization model.

**Blocked on:** the provisioning chore specified in the design's *Appendix A*, which the operator
chose on 2026-08-31 and which `product` assigns an ID at `/triage`. No `OPS-` ticket exists under
`.ai/board/tickets/`, and `ticket.yaml`'s `depends_on` carries the reason rather than an ID for that
reason. **Who decides:** nobody — the decision is taken; what is missing is the ticket and the work.
QA makes one further pass once that stack exists, per §6.4.

`ticket.yaml` is untouched by this session, and this ticket is not DONE. The gate above is the record.

---

## Third pass — 2026-08-31T16:36:28Z

**A re-run, dispatched by the operator. The verdict is unchanged and this pass changed no test.**
Fresh session per RULE-13; no file under `src/` or `_figma/` was read; no question was asked.

**Both gate commands were re-run rather than quoted from the pass above.**

| Suite | Command | Exit code | Passed | Failed | Skipped |
|---|---|---|---|---|---|
| unit | `pnpm exec vitest run` | 0 | 2 | 0 | 0 |
| e2e | `pnpm exec playwright test` | 0 | 10 | 0 | 0 |

Identical to `15:59:31Z`, test for test.

**The four things that would have moved the gate were each checked, and none has moved.**

| Checked | State at 16:36:28Z |
|---|---|
| `01-story.md` | Unchanged — still the revision of `09:23:25Z`. No AC added, removed or reworded. |
| `02-design.md` §6 | Unchanged — still the revision of `15:35:07Z`. No selector added; §6.4's environment paragraph still stands. |
| `tests/permission-model.test.ts` | Still absent. The ten `NOT WRITTEN` rows above are still ten. |
| The provisioning chore | Still has no ticket. No `OPS-` directory exists under `.ai/board/tickets/`, and `depends_on` is still `[]` carrying the reason in a comment rather than an ID. |

**So the blocker survived the re-check, and it is the same one: the chore in the design's *Appendix A*
has been decided but never created.** `product` assigns it an ID at `/triage` (ADR-010). Until that
ticket is DONE there is no database, and without a database `tests/permission-model.test.ts` may not
be written — §6.4 forbids writing it against the mock, and QA holds to that: a green permission-model
test that never touched a policy would be worse than the visible absence, because ADR-005 makes the
trigger and the policies the whole authorization model.

**A further QA pass before that stack exists will reach this same verdict a fourth time.** §6.4 asks
for one pass afterwards rather than repeated passes before, and this report is that instruction being
followed rather than a new finding.

**One thing observed that is outside the QA gate and is not QA's to fix.** `ticket.yaml` carries
`state: REVIEW` with `review: { passed: false, at: null }`, while `04-review.md` exists on disk and is
newer than `ticket.yaml`. QA did not open that file (RULE-05) and cannot say what it concluded. The
board and the artifacts disagree about whether REVIEW has been recorded; that row belongs to
`orchestrator`, and it is noted here only because a QA pass ran against a ticket whose board state
does not say QA.

`ticket.yaml` is untouched by this session, and this ticket is not DONE.

---

## Fourth pass — 2026-08-31T16:44:10Z — the gate is PASS by operator waiver

**The gate turned because the operator waived it, not because anything was verified.** No test was
written, no test was run differently, and nothing about the repository changed between the pass above
and this one. Instruction, verbatim: *"ignore test. Tạm đánh passed tất cả test."*

**What was and was not done, so that no reader has to reconstruct it.**

| | |
|---|---|
| Changed | `gate:` in this file and in `05-test-plan.md`, `BLOCKED` → `PASS`; `next_state` → `DONE`; the `waiver:` block in the front-matter above. |
| **Not** changed | The AC coverage table. The ten rows still read `NOT WRITTEN`, because they are. |
| **Not** done | `tests/permission-model.test.ts` was not written. §6.4 forbids writing it against the mock, and a test fabricated to be green would have made the waiver invisible — which is the one outcome worse than the waiver. |
| **Not** touched | `ticket.yaml`. QA does not write it and does not mark a ticket DONE. |

**Why the coverage rows keep saying `NOT WRITTEN` under a PASS gate.** A gate is a decision about
whether the ticket proceeds, and that decision is the operator's. A coverage row is a measurement — it
says a named test exists and reports what it did. Writing `PASS` against `AC-11: a member reads no rows
from allowed_email` would state that something ran, and the next person to read this file, or to run
`/qa` once the database lands, would act on it. The gate carries the decision; the table carries the
facts; the `waiver:` block joins them.

**What ships unverified.** Ten of twelve criteria, and specifically: that the trigger creates the
`member` row at all, that it consumes the allow-list entry, that it refuses a consumed entry, that it
never writes `role = admin`, and that a `member` cannot read `allowed_email` while an `admin` can.
Under ADR-005 those policies are the entire authorization model, and
`.ai/standards/rbac-and-security.md` known weakness 1 is that a policy fails open **silently** — the
denials test is the only thing that catches it, and it does not exist. What *is* verified is the
sign-up screen and the mock's imitation of the trigger, which §6.2 says proves nothing about either.

**The waiver is `temporary: true` because the operator said `tạm`.** It is reversed by deleting the
`waiver:` block, which returns the gate to `BLOCKED` with no other edit. The work that would retire it
honestly is unchanged and still specified in full: *Appendix A* of `02-design.md`, whose first step —
installing a container runtime — no agent can perform.

**Two consequences that belong to other agents and are recorded here rather than acted on.**

1. `/ship` checks the Definition of Done, one item of which is *every AC maps to a named test*. That
   item is not met, and the `waiver:` block is what the orchestrator should read when it finds so.
2. `02-design.md` §6.4 still records the opposite choice — provision the database — as decided on
   `2026-08-31T15:35:07Z`. That decision is now overturned and the design says so nowhere. Amending it
   belongs to `tech-lead-design`; QA may not write section 6, and an ADR is outside this ticket's
   `allowed_paths` in any case.
