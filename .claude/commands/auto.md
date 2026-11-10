---
description: Start the unattended loop runner in the background and return immediately
argument-hint: "<ticket id, idea file path, or the request in words>"
---

Run in **any session**. This command starts a process and returns; it does not run the loop and it
does not orchestrate anything.

## Read this before using it

**`/auto` cannot ask you anything.** The runner's intake step is the one interactive moment of a run —
`product` proposes up to seven questions whose answers change behaviour, permissions, invariants,
scope or size, and reads your answers from stdin. A background process has no stdin, so `/auto`
passes `--no-ask` and **those questions are never asked**. Whatever they would have settled is
settled by `tech-lead-design` at PLAN instead, as an assumption, in a plan nobody reviewed first.

For a new idea that is not yet written down, use the terminal form and answer the questions:

```
node scripts/run-loop.mjs auto "<the request>"
```

Use `/auto` for a ticket that already exists, or an idea file that has already been triaged. There is
nothing left to ask about either.

**It also steps around a permission decision, and you should know which one.** The runner spawns
`claude` processes. In a Claude Code session that spawn is subject to this machine's own checks — one
refused it outright while ADR-036 was being built. A detached process started by this command is not
subject to them. That is not a defect in the runner, which is a checked-in tool you asked for; it is
a reason to run it from a terminal when you want your session's checks to apply.

## What to do

1. **Generate a run id**: `date '+%Y%m%d-%H%M%S'` plus a short random suffix.
2. **Make the run directory**: `.runner/<run-id>/`.
3. **Start the process detached**, with stdout and stderr both going to
   `.runner/<run-id>/runner.log`, and do not wait for it:

   ```
   node -e "const{spawn}=require('child_process'),fs=require('fs');const o=fs.openSync('.runner/<run-id>/runner.log','a');spawn(process.execPath,['scripts/run-loop.mjs','auto','$ARGUMENTS','--no-ask','--run-id','<run-id>'],{detached:true,stdio:['ignore',o,o]}).unref()"
   ```

4. **Print three paths and stop**:
   - the run id
   - `.runner/<run-id>/runner.log` — live output
   - `.runner/<run-id>/REPORT.md` — written when the run ends, however it ends

**Do not poll the log. Do not wait for the run. Do not summarise what it is doing.** A full run
outlives any tool timeout, and a session that sits watching it is a session that cannot do anything
else. The run writes its own record; that record is the report.

## Stopping one

The run id is the handle. `.runner/<run-id>/STOPPED.md` says why a run ended early and what you have
to decide. To end one in progress, kill the process — nothing in the tree is left inconsistent,
because the runner never commits and never edits `ticket.yaml`; the stage that was mid-flight either
wrote its artifact or did not.

## Your reply

Per `## Replying` in `CLAUDE.md`. The three paths, and nothing else. The run has not finished, so
there is no gate to quote: write `gate n/a` and name the report path in *Tiếp theo*.
