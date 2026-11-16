---
doc_version: 1
last_updated: 2026-11-16
governed_by: [RULE-16]
---

# Template: bug report

Written by `/bug` as `.ai/board/tickets/<ID>/00-bug-report.md`, beside the `ticket.yaml` it copies
from `.ai/templates/ticket.yaml` — [ADR-101](../registry/decisions/ADR-101-a-defect-is-recorded-by-bug-and-fixed-by-the-loop-with-a-regression-test.md).
Copy everything below the line.

**This is the defect's record, not its plan.** It says what is wrong, how to see it and, if known,
why. It never says how to fix it. That is `01-plan.md`'s job, written by `tech-lead-design`, who
reads this file at `/plan`.

**Every section is filled or says `unknown`.** A section left blank cannot be told apart from one
nobody looked at, and RULE-16 requires the file to stand alone.

---

```yaml
---
ticket: <ID>               # BUG-nnn
stage: TRIAGE              # a defect's intake; /bug writes it, not /triage
agent: orchestrator
produced_at: <ISO8601>     # read from `date`, never recalled
inputs_read: []            # every file and command output the root cause rests on
consulted: []
gate: PASS                 # PASS once every section is filled or says unknown
blocking_reason: ""
next_state: BACKLOG
severity: S2               # S1 | S2 | S3 — see Severity below
found_in: ""               # the release or environment the operator named, else "unknown"
introduced_in: ""          # <commit> (<TICKET-ID>, <release>) from git history, else "unknown"
root_cause: suspected      # confirmed | suspected | unknown
batch: ops/record-<first-id>   # the record branch this was committed on
regression_of: ""          # a DONE BUG-nnn this reopens, else ""
---
```

# <ID> — <what is wrong, stated as the wrong behaviour>

## Report

The operator's words, **verbatim**, and the date. Not summarised, not corrected. If they attached an
image, describe what it shows. Do not commit it if it shows a person's name, an email address or any
other personal data.

## Environment

- Where: production / staging / local (`pnpm dev`), and which release or commit
- Role and scope of the account that saw it: system admin / org admin / manager / member / guest;
  which org and team, by fixture name and never by a real person's address
- Browser and viewport, when the defect is on screen

## Steps to reproduce

1. …

## Expected

What should happen, and **where that is written**: the `features.md` row, the acceptance criterion
(`<TICKET>/01-plan.md` § 2, `AC-n`), the invariant, or the ADR. A defect is a difference from
something written down. If nothing written says what should happen, this is not a defect, and `/bug`
stops and names `/idea`.

## Actual

What happens instead, with the exact error text or test output.

## Root cause

`file:line` and why, marked **confirmed** or **suspected**:

- **confirmed** — the defect was reproduced, and the reproduction is named here: the test command and
  its failing output, or the steps above run against a named commit.
- **suspected** — the code path was read and not run. Say what would confirm it.
- **unknown** — say what was read. `tech-lead-design` continues from there at `/plan`.

`introduced_in` names the commit and how it was found (`git log -S`, `git log -L`, a bisect). It is
never inferred from a date.

## Severity

`S1` · `S2` · `S3`, and one sentence on why.

| Severity | Means here |
|---|---|
| S1 | Data lost or exposed across an org or team boundary; a security or authentication defect; an invariant in `.ai/registry/invariants.md` broken in shipped code; or a core flow impossible — signing in, registering or editing an entry, deciding an approval |
| S2 | A feature is broken but has a workaround, or the screen misleads — a wrong count, a wrong date, a warning that does not appear |
| S3 | Cosmetic. Nothing is wrong except how it looks |

Severity informs where the operator places the backlog row. `/bug` appends the row and does not place
it (`.ai/01-operating-model.md` § *Backlog*).

## Regression test, proposed

The test level that can see the defect, and why: unit, database (`pnpm db:test`) or end-to-end. Use
the levels in `.ai/standards/testing-standards.md`. This is a proposal. `01-plan.md` § 2 decides, and
names the test (ADR-101 decision 7).

## Open questions

Anything the fix would have to decide that changes behaviour, permissions or an invariant. Example:
restore a removed control, or reword the criterion it broke. `/plan` takes these under ADR-067 or
writes an ADR. `/bug` does not decide them.

## Further reports

Later reports of the same defect, appended by `/bug`'s duplicate check, each one dated and verbatim.
