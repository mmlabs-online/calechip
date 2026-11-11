---
description: Run every stage of one ticket through the loop runner, in the foreground, and report how it ended
argument-hint: "<TICKET-ID> [run-loop flags, e.g. --until READY]"
---

Run in **any session**. This is `/auto` for one existing ticket, **waited on** instead of detached:
the same runner, the same stages, the same stops. It adds no behaviour of its own.

| | `/auto` | `/run-ticket` |
|---|---|---|
| Input | ticket id, idea file or free text | an existing ticket id only |
| Process | detached; the command returns at once | background task this session waits on |
| Reply | three paths, no outcome | the outcome, read from `REPORT.md` |

**What runs is `scripts/run-loop.mjs` (ADR-036), and only that.** It reads the board, spawns each
stage as its own `claude` process (`/plan`, `/implement`, `/review`, `/advance`, `/ship`) and merges
once `mergeGate` passes (ADR-067). This command starts it and reads what it wrote. It does not
dispatch a stage itself, edit `ticket.yaml`, commit or push.

## What to do

1. **Check the argument.** The first word of `$ARGUMENTS` is the ticket id; the rest are passed to the
   runner unchanged. Stop, and say why, if the id is empty or
   `.ai/board/tickets/<ID>/ticket.yaml` does not exist. For a new idea use `/idea`, then `/auto`.
2. **Generate a run id**: `date '+%Y%m%d-%H%M%S'` plus a short random suffix, and make
   `.runner/<run-id>/`.
3. **Start the runner as a background task of this session** (Bash `run_in_background`, the longest
   timeout allowed), stdout and stderr to the log:

   ```
   node scripts/run-loop.mjs auto --ticket <ID> --run-id <run-id> <rest of $ARGUMENTS> > .runner/<run-id>/runner.log 2>&1
   ```

   A ticket takes longer than any foreground tool call, which is why it is a background task and not
   a plain command. Tell the operator the run id and the log path in one line, then **wait for the
   task's completion notice. Do not poll the log, and do not narrate the stages.**
4. **When it ends, read** `.runner/<run-id>/REPORT.md` and, if it exists,
   `.runner/<run-id>/STOPPED.md`. If neither exists, read the tail of `runner.log`.

## Your reply

Per `## Replying` in `CLAUDE.md`. Above the block, only:

- **how it ended**: merged, an open pull request, or stopped, and at which stage;
- **if it stopped, what `STOPPED.md` says you have to decide**, in its own words, and the resume
  command it names.

The gate in the first line of the block is the last gate `REPORT.md` records, or `n/a` if none.
*Tiếp theo* is what `REPORT.md` or `STOPPED.md` says runs next.
