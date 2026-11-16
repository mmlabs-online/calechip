---
description: Record a defect as a BUG-nnn ticket, then ask whether to open the record pull request, record another, or fix the batch through the loop
argument-hint: "<what is wrong, in words> [S1|S2|S3]"
---

Run in a **fresh session that acts as the orchestrator**, the same kind of session as
`/run-ticket`. Option C below dispatches the loop's stage agents as subagents, and only the lead
session can do that. Decided by
[ADR-101](../../.ai/registry/decisions/ADR-101-a-defect-is-recorded-by-bug-and-fixed-by-the-loop-with-a-regression-test.md).

`$ARGUMENTS` is the operator's description of what is wrong, plus any image they attached. A trailing
`S1`, `S2` or `S3` is their severity, and it overrides yours.

## What this is not

- **Not a request for new behaviour.** If no row in `.ai/registry/features.md`, no acceptance
  criterion and no invariant says what *should* happen, nothing is broken. Something is missing, and
  that is `/idea`. Say so and stop.
- **Not a defect in the operating model.** A command, hook, check or rule that misbehaves is
  `/thuki`'s, recorded in `.ai/board/model-debt.md`. `.ai/board/model-defects.md` says the same
  thing: domain defects are `BUG-nnn`, and model defects are not.
- **Not a fix.** Steps 1 to 6 write nothing but the record. The fix is the loop's, under option C or
  after option A's pull request merges.

## 0. Preflight — stop and report on any failure

1. `git fetch origin --quiet`, then `git status --porcelain --untracked-files=all` must be empty.
   A dirty tree is somebody's uncommitted work. Name the paths and the ticket they belong to, and
   stop.
2. **Continuing a batch?** If this conversation already recorded a bug and the operator answered B,
   you must be on that batch branch. If you are not, stop. Otherwise this is the first bug of a new
   batch, and step 1 creates the branch once the ID is known.

## 1. Look for a duplicate, then issue the ID

**Duplicate first.** Read every `.ai/board/tickets/BUG-*/ticket.yaml` and its `00-bug-report.md` on
this branch and on `origin/main`, plus the rows in `docs/ops/e2e-quarantine.md`, which name a
`BUG-nnn` per quarantined test (ADR-060).

- **It matches a bug that is not `DONE`.** Append the report, dated and verbatim, under
  `## Further reports` in that bug's `00-bug-report.md`, commit it as in step 5, and go to step 6.
  Do not issue a new ID.
- **It matches a `DONE` bug.** It is a regression. Issue a new ID, and set `regression_of` to the
  old one.

**The ID** is `BUG-` and three digits, one above the highest already issued anywhere it could be.
That is not only this tree:

```
git ls-tree -r --name-only origin/main .ai/board/tickets
git ls-remote --heads origin "feat/BUG-*" "ops/record-*"
git branch --list "ops/record-*"
```

For each `ops/record-*` ref, list its ticket folders with `git ls-tree`. A record branch nobody has
merged still holds the IDs it issued.

**The first bug of a batch creates the batch branch here**, from `origin/main` and never from local
`main`:

```
git switch -c ops/record-<id> origin/main
```

`<id>` is this bug's ID in lower case, for example `ops/record-bug-006`. When the first report turns
out to be a duplicate, use the ID it was added to. Later bugs of the batch reuse the branch.

A not-`DONE` bug recorded before ADR-101 has no `00-bug-report.md`. For a duplicate of one, create
that file holding only `## Further reports`.

## 2. Investigate — read-only

Write nothing in the tree. Read source, history and tests. **Run** whatever already exists: a unit
test, `pnpm db:test`, an end-to-end spec with `pnpm exec playwright test <spec>`, or the app
locally. A scratch script, if you need one, goes outside the repository and is deleted afterwards.

- **Expected.** Find where it is written: the `features.md` row, the shipped ticket's `01-plan.md`
  § 2 `AC-n`, the invariant, or the ADR. That row's feature ID becomes `feature_ids`, and its group
  becomes `group`. **Never issue or invent a feature ID.**
- **Root cause.** Find the code path to `file:line`. If you reproduced it, mark it **confirmed** and
  name the reproduction. If you only read it, mark it **suspected** and say what would confirm it.
  If you found nothing, mark it **unknown** and say what you read.
- **`found_in`.** Use the release or environment the operator named. Otherwise `unknown`.
- **`introduced_in`.** Use `git log -S '<string>'`, `git log -L <range>:<file>` or `git blame` on
  the root-cause line. Take the ticket ID from that commit's message, and run
  `git branch -r --contains <sha> "origin/release/*"` for the first release that carried it. If
  history does not tell you, write `unknown` rather than a date-based guess. The repository is often
  a shallow clone, so run `git fetch --deepen` before concluding.
- **Severity**, from the table in `.ai/templates/bug-report.md`, unless the operator gave one.

## 3. Write the record

1. `.ai/board/tickets/<ID>/00-bug-report.md`, from `.ai/templates/bug-report.md`. Fill every section
   or write `unknown`. Read `produced_at` from `date`.
2. `.ai/board/tickets/<ID>/ticket.yaml`, copied from `.ai/templates/ticket.yaml`. Replace its first
   line with `# Created by /bug (ADR-101) from 00-bug-report.md, <date>.` Fill:
   - `id`, `title` (the wrong behaviour, stated as in the report), `state: BACKLOG`
   - **Definition of Ready items 1, 3, 4 and 6**, exactly as `/triage` fills them:
     - `feature_ids` and `group`: one feature group per ticket, or two tickets.
     - `depends_on`.
     - `schema_delta`: `none`, or a description if the root cause sits in the schema. The ADR that
       description owes is written at `/plan` (ADR-067), as for every schema change.
   - Leave `invariants_touched`, `size_estimate`, `size` and `allowed_paths` for PLAN. Name a
     suspected invariant in the report, not here.
3. Append one row to the `## BACKLOG` table in `.ai/board/backlog.md`. Then add one line under it:
   *"Row n was appended by `/bug` on <date>, severity <S>. Appended, not placed."* Placing it is the
   operator's (`.ai/01-operating-model.md` § *Backlog*). Never move another row.

## 4. Do not commit anything else

The record commit holds `.ai/board/tickets/<ID>/**` and `.ai/board/backlog.md`, and nothing more. If
anything else is dirty, step 2 wrote where it must not. Restore it and say so.

## 5. Commit the record on the batch branch

```
git add .ai/board/tickets/<ID> .ai/board/backlog.md
git commit -m "<ID>: record — <title>"
```

One commit per record. **Do not push.** Pushing is option A's, and nothing else pushes this branch.

## 6. Ask the operator — A, B or C

Use `AskUserQuestion` with the header `Bug`. If the tool is not available, ask the same three options
in plain text and wait. **The question opens with every bug recorded in this batch so far**, one line
each in Vietnamese: ID, severity, what is wrong, root cause (confirmed / suspected / unknown) with
`file:line`, and `found_in` / `introduced_in`.

| Option | Label |
|---|---|
| A | **Mở PR ghi nhận và dừng** — push the record branch and open one pull request carrying only the records |
| B | **Ghi nhận thêm bug** — record another bug on the same branch, then ask again |
| C | **Sửa luôn cả batch** — run each bug through the loop now, one pull request per bug |

**Offer C only at WIP 0.** If any `ticket.yaml` on `origin/main` is in `PLAN`, `READY`,
`IN_PROGRESS`, `REVIEW` or `REWORK`, leave C out, and say in the question which ticket is in flight
(ADR-006, `.ai/01-operating-model.md` § *WIP*).

An answer that is none of the three: follow it if it is clear, otherwise ask again.

### A — the record pull request

1. `git push -u origin ops/record-<first-id>`. This is an `ask` rule, so the operator approves the
   push.
2. Run `gh pr create --base main`. The title is `Record <ID>: <title>`, or `Record bugs <ID>, <ID>…`
   for a batch. The body is in English. For each bug it gives the severity, `found_in` and
   `introduced_in`, actual against expected in one line, the root cause with its status and
   `file:line`, and the link to the ticket folder. Then add one line, *"Fix: `/run-ticket <ID>` once
   this merges"*. Last, say that the backlog rows are appended, not placed. If one is S1, ask in so
   many words for it to be placed.
3. Stop. Give the operator the pull request link. **Never merge it** (RULE-09).

### B — another bug

Reply *"Mô tả bug tiếp theo (kèm ảnh nếu có)."* and end the turn. The operator's next message is the
next bug, and they do not type `/bug` again. Run steps 1 to 6 for it on this same branch.

### C — fix the batch now

For each bug in the batch, **S1 first, then in record order**, one at a time:

1. Prepare a tree that holds **only this bug's record**, uncommitted, on top of `origin/main`:

   ```
   git switch --detach origin/main
   git restore --source=ops/record-<first-id> -- .ai/board/tickets/<ID>
   ```

   Then append this bug's row, and only this bug's row, to `.ai/board/backlog.md`. Do not restore
   the whole file from the batch branch, because it carries the other bugs' rows.
   `/plan` step 0 reads what you made as *carried*: the ticket's own folder and a ship-owned path.
2. Run `/run-ticket <ID>` from its **§ 1**, with this tree in place of its preflight. Its § 0
   item 3 allows this. Everything after that is `/run-ticket`, unchanged: `/plan` creates
   `feat/<ID>` from `origin/main`, the stage agents run as subagents, and `/ship` opens this bug's
   pull request.
3. **A bug that stops** — `BLOCKED`, `ESCALATED`, or the 12-step limit — keeps its work on
   `feat/<ID>`. Note it and go on with the next bug.

**One pull request per bug, not one for the batch.** The loop ships one ticket per branch and per
pull request (ADR-006, ADR-023), and RULE-03's CI check resolves one ticket per branch. A single pull
request for the batch is an open question in ADR-101 for the operator. Do not build it here.

The batch branch is not pushed under C. Each fix pull request carries its own record. If any bug
stopped, offer A for the records the fix pull requests do not carry.

## You do NOT

- **Change product code, tests or the schema.** Steps 1 to 6 write the record and nothing else.
- **Issue a feature ID** or write anything under `.ai/registry/**`.
- **Reorder the backlog.** Append only.
- **Merge, or enable auto-merge.** RULE-09. `gh pr merge` stays denied.
- **Copy personal data** from a screenshot or a report into the record: an email address, a real
  person's name, a token. Describe instead.

## Your reply

Per `## Replying` in `CLAUDE.md`. While asking, the question is the reply. After A, give the pull
request link. After C, give one line per bug: its pull request, or the stage it stopped at and what
the operator must decide.

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** Read `date '+%Y-%m-%d %H:%M %Z'`
and `git branch --show-current` rather than recalling them. After a record, the first line ends
`gate n/a` and *Tiếp theo* is the operator's A, B or C. After C, quote the last gate a stage
artifact recorded, as `/run-ticket` does.
