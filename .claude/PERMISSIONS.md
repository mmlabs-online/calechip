# Permissions and hooks — why each entry exists

`.claude/settings.json` is parsed as strict JSON. A `//` comment makes the file unparseable, and an
unparseable settings file **drops the entire deny list** — failing open on exactly the thing the file
exists to close. So the rationale lives here instead.

## disableClaudeAiConnectors

`true`, and load-bearing rather than cosmetic.

Connectors attach to an account, not to a repository. Without this flag a coding agent inherits
whatever mail, calendar, drive and design connectors that account happens to have. Nothing in this
repository needs them, and the blast radius of an agent with mailbox access is enormously larger than
the task.

There is a second effect worth knowing. The tracker tools this repository uses come from the server
declared in `.mcp.json` and carry that server's prefix. A connector-provided integration with the
same vendor would carry a *different* prefix and **would not match the hook matcher**, so
`guard-tracker-scope.mjs` would never see those calls. Turning connectors off keeps exactly one
tracker surface, and it is the guarded one.

## The allow list, and why read-only commands are on it

Two groups, and they are on the list for different reasons.

**Git and `gh` verbs** are the ones the loop needs to run: reading state, staging, committing,
switching branches, opening and viewing a pull request. `git push` is **deliberately absent**, so
every push prompts once. That prompt is the last point at which a human sees a branch name before
history exists.

**Read-only commands** — `ls`, `cat`, `head`, `tail`, `wc`, `find`, `grep`, `rg`, `tree`, `pwd`,
`echo`, `date`, the two audit scripts, `node --test`. These are allowlisted deliberately rather than
prompted for one at a time, and the reasoning is about attention, not convenience. A prompt for `ls`
teaches that prompts are noise to be cleared, and that habit is then spent on the one prompt that
actually matters. Every rule in that group names a command that cannot change the repository, so
approving it carries no information and asking for it costs vigilance.

`.claude/hooks/tests/settings-integrity.test.mjs` asserts both groups are present. Losing them fails
nothing visibly — it just restores the noise that trains reflexive approval. **Do not delete one to
tidy the list.**

**A guard on the guard.** `Bash(cat:*)` is read-only; `Bash(cat:* > f)` is a file write wearing the
same name. The permission matcher does not parse shell grammar, so a metacharacter inside an allow
pattern smuggles a write primitive past a list everyone reads as read-only. The same test asserts
that no read-only rule contains one.

**The project's own verify commands are on both lists**, added 2026-08-31 in one commit:
`pnpm exec tsc`, `pnpm exec eslint`, `pnpm exec vitest`, `pnpm exec playwright`, and the two audit
scripts. They are the invocations named once in `.ai/standards/testing-standards.md`; commands are
allowed under the names that file gives them, so a shorthand invented in a command file would prompt.
`REQUIRED_READONLY_ALLOW` in `settings-integrity.test.mjs` knows about each of them, because an
allow rule the test does not know about is one a clobber can drop silently.

## The push prompt, and the unattended runner

`scripts/run-loop.mjs` (ADR-036) runs every stage with `--permission-prompts none`, so **anything
that would prompt is denied instead**. The allow list is therefore the runner's whole vocabulary.

**`git push origin feat/*` is on it since ADR-067** (operator, 2026-10-23), with its `-u` form.
*Until then this section read: "`git push` is still not on it … the prompt is the last point at which
a person sees a branch name before history exists. … Allowing `Bash(git push origin feat/*)` would
close that gap and would reverse a control this file argues for in writing. It is the operator's
decision and wants its own ADR, not an edit to the list."* The operator made that decision, and the
ADR is ADR-067. `git push --force` and `git push origin main` stay denied, so the trunk is unchanged.
A push reaches a ticket branch and nothing else.

`pnpm db:test`, `pnpm exec supabase` and `node_modules/.bin/supabase` were added in the same change.
A PLAN that cannot read the Supabase CLI's own `--help` writes a `TODO(verify)` where a fact belongs.
That CLI is on the past-reliable-recall list in `.ai/standards/tech-stack.md`.

`Bash(git pull --ff-only)` was added for the runner: the branch decision table in
`.ai/standards/git-conventions.md` reaches for it when a ticket branch already exists on the remote,
and `--ff-only` cannot rewrite anything. It is the only verb ADR-036 added.

## Denied tracker tools

**A workspace-wide search** takes no argument that constrains it to a list. There is no way to write
an allow rule or a hook check that narrows it, because the scope is not in the call — it is in the
tool. Use a filter call with an explicit list ID instead, which `guard-tracker-scope.mjs` can
validate against `allowed_list_ids`.

**A workspace-hierarchy read** enumerates everything. The binding is already resolved in
`.ai/registry/tracker.yaml` — workspace, space and list IDs are all there — so nothing in this system
needs to discover them. A tool whose only purpose is discovery, in a system where discovery is
already done, can only widen scope.

**Delete, merge and move** are destructive or move data across lists, which is how a task leaves the
guarded scope while every individual call looks valid.

**Chat message** posts to workspace chat. The loop communicates through artifacts and pull requests;
an agent that can message a channel can produce side effects nobody reviews.

## Denied git operations

`git push --force` and `git push origin main` protect the trunk. `gh pr merge` enforces RULE-09:
**no agent merges**. Since ADR-067 the runner's own code merges a ticket's pull request once
`mergeGate` in `scripts/run-loop.mjs` passes. It calls `gh` itself and never through an agent, so
this deny rule still holds for every agent session. *Until ADR-067: "merging is permanently human, and
the loop's terminal output is an open pull request."*

`git reset --hard` is denied because it is what an agent reaches for when it is confused, and what it
discards includes the artifacts that would explain the confusion.

## Hooks

All six are Node, invoked as `node "$CLAUDE_PROJECT_DIR/..."`. None is a `.sh` file, and that is not
a style preference. A `.sh` hook on Windows dies with `bad interpreter: /bin/sh^M` once Git rewrites
line endings, and it fails **silently** — the guard simply stops guarding, which is worse than having
no guard at all because the deny list still looks configured.

| Hook | Matcher | Enforces | Failure direction | Wired? |
|---|---|---|---|---|
| `guard-project-root.mjs` | `Edit\|Write` | the project boundary | closed | **no — ADR-004** |
| `guard-registry.mjs` | `Edit\|Write` | RULE-01 | closed | **no — ADR-004** |
| `guard-allowed-paths.mjs` | `Edit\|Write` | RULE-03 | closed | **no — ADR-004** |
| `guard-tracker-scope.mjs` | `mcp__clickup__.*` | RULE-18 | closed | yes |
| `chat-guard.mjs` | `Edit\|Write` and `Agent\|Task\|SendMessage` | RULE-12, RULE-15 | open with no active ticket, closed otherwise | yes |
| `guard-read-scope.mjs` | `Read\|Grep\|Glob\|NotebookEdit` | RULE-05 | open for agents other than `ba` and `qa` | yes |

**Three guards ship on disk and unwired, and this is carried forward honestly rather than quietly
reversed.** ADR-004 removed `guard-project-root.mjs`, `guard-registry.mjs` and
`guard-allowed-paths.mjs` from the `Edit|Write` matcher. Their files are unchanged and their own
tests still pass, so **restoring them is one edit to `settings.json` plus one list change in
`settings-integrity.test.mjs`.** What that buys and what it costs is written out in ADR-004; read it
before deciding either way. `settings-integrity.test.mjs` names them in a `DELIBERATELY_UNWIRED` set,
so a guard that quietly falls out of `settings.json` still fails the test — an unwired guard has to
be listed by a human who decided to unwire it.

`chat-guard.mjs` is wired **twice**, on purpose. It guards two transports: the tool transport
(`Agent|Task|SendMessage`) and the file transport (a write to `99-questions.md`), and the file
transport only fires if the hook is wired to `Edit|Write` as well. Wiring it to one and not the other
leaves half of RULE-12 as prose.

Every hook has a test file under `.claude/hooks/tests/`, runnable with
`node --test .claude/hooks/tests/*.test.mjs` — the shell expands the list, because `node --test <dir>`
works on Node 20 but fails on Node 23, and the quoted-glob form needs Node 21 or later. **A control
that has never been observed to fire is not a control, it is a belief about a control.**

### Why guard-read-scope exists as a hook at all

The restriction it enforces — `ba` and `qa` may not read the implementation source — is not
expressible in subagent frontmatter: `tools` and `disallowedTools` are tool-level, not path-level,
and denying `Read` outright would leave those agents unable to read the story they work from. A
path-scoped hook is the only mechanism that expresses it. It is wired twice — session-wide in
`settings.json`, and in the `ba` and `qa` frontmatter — so the restriction is visible in the agent
definition, which is where someone will look for it.

**Its source root is a constant.** `SOURCE_ROOTS` at the top of `guard-read-scope.mjs` is one of the
three places in this kit that assume a directory layout. TODO(project): change it if the
implementation source is not `src/`.

**It does not, and cannot, cover `Bash`.** A shell read of the source tree walks around it. The
agent definitions for `ba` and `qa` forbid that by name, and that is a convention rather than a
control — recorded in `.ai/board/model-debt.md` so nobody later mistakes it for one.

### Why guard-project-root exists

During a real run an agent created a file on an unrelated drive from a mistaken path. It was
disclosed and deleted, but nothing would have stopped it. `guard-registry.mjs` and
`guard-allowed-paths.mjs` both compute a repo-relative path and then test a prefix, so a target on
another drive, or above the root, fails every prefix test and is *allowed through* — the two guards
that look like they cover the filesystem cover only the inside of it. A write outside the repository
is also invisible to `git status`, so no gate, no review and no CI check would ever have reported it.

One rule covers absolute paths elsewhere, a different drive, `../` traversal above the root, and
`~`-relative targets. Symlinked roots are resolved on both sides before comparison, because a
temporary directory is itself symlinked on some platforms and a naive real-path comparison rejects
every legitimate write.

**Known limitation, retained for reference.** ADR-006 removed worktrees from this project, so the
case below no longer arises here; it is kept because the guard is still on disk and a project that
rewires it will meet the same edge. A git worktree created outside the project directory is treated as outside the
boundary. That is the intended reading of "outside the project root", and the fix is to point
`CLAUDE_PROJECT_DIR` at the worktree rather than to widen the guard.

### Why chat-guard fails open

It exits 0 when there is no active ticket. Outside a live ticket there is no verdict to protect and
no budget to spend, and a guard that blocked every subagent dispatch on `main` would stop the loop
rather than constrain it.

It also exits 0 when the payload has no `agent_type`, which means the call came from the main thread
— the orchestrator dispatching a stage, not an agent talking to another agent. Orchestrator dispatch
and agent chat use the same tool, and blocking the former to constrain the latter would break the
loop at every transition.

**`agent_type` is populated only when the caller is a subagent.** Under the session model each role
runs as its own top-level session, so any guard that wants to key on the running role has nothing to
key on. This is recorded in `.ai/board/model-debt.md`; it makes `chat-guard.mjs` quieter and
`guard-read-scope.mjs` broader than their rules read.

**Forward edges are not hook-enforced, and that is accepted as designed.** `chat-guard.mjs` blocks
only the three forbidden pairs in the chat topology. An edge that is simply absent from the table
passes the hook, because it is indistinguishable at the tool layer from orchestrator dispatch, which
uses the same tool. The topology table in `.ai/01-operating-model.md` governs those edges; the hook
governs the three where a wrong answer corrupts a verdict.

### Why the others fail closed

An unreadable payload, an unresolvable project root, a missing `ticket.yaml` on a `feat/` branch, a
missing `tracker.yaml` — all block. A guard that cannot tell whether an action is in scope must not
conclude that it is.

## Settings integrity

This file is the rationale for `settings.json`. `settings.json` itself is load-bearing, and **it has
been observed being overwritten**: some environments append session permission grants to
`.claude/settings.json` rather than to `.claude/settings.local.json`, and doing so rewrote the
governance config four times in one run of the origin project. When that happens the deny list and
every hook vanish, and nothing about the session looks different — the guards simply stop guarding.

Two detectors:

1. `git diff .claude/settings.json`. Only useful if a human looks.
2. `.claude/hooks/tests/settings-integrity.test.mjs`. Asserts `disableClaudeAiConnectors`, every
   allow rule, every deny rule, every hook entry on the right matcher in the right order, that every
   wired hook exists on disk, and that no hook on disk is left unwired without being named. It runs
   in CI on every push and pull request, where nobody has to remember to look.

If that test fails, the fix is to restore `settings.json` — **not** to update the expected list.
Update the list only alongside a deliberate change, in the same commit.

**Session approvals must be directed to `.claude/settings.local.json`, never to
`.claude/settings.json`.** `settings.local.json` is gitignored and carries no governance content, so
a grant landing there is harmless; a grant landing in `settings.json` rewrites the file and takes the
deny list and every hook with it. This is a standing configuration requirement, not a one-time
cleanup — the two detectors catch the symptom, and this is the cause.

**`additionalDirectories` ships empty, deliberately.** In the origin project it accumulated absolute
paths from one machine, which is untracked configuration wearing a tracked file's clothes. If a
session genuinely needs a directory outside the repository, grant it in `settings.local.json`.

## Per-agent restrictions

Eight of the nine agents carry `disallowedTools: mcp__clickup`, which removes every tool from that
server. `orchestrator` is the exception and is the only agent that can reach the tracker at all.

This is defence in depth with the allow list: the allow list says which tracker tools may ever be
called, `disallowedTools` says who may call them, and `guard-tracker-scope.mjs` says what they may be
pointed at.

## Running from Antigravity — none of this file applies

**Antigravity reads nothing under `.claude/`.** Added 2026-10-31, with the adapter in `.agents/`:
`.agents/skills/<name>/SKILL.md` per live command, each a pointer to `.claude/commands/<name>.md`, and
`.agents/rules/claude-md.md`, which inlines `CLAUDE.md`. That makes the commands reachable from
Antigravity. It does not make anything above this section true there.

| Claude Code mechanism | Under Antigravity |
|---|---|
| Deny list — `git push --force`, `git push origin main`, `git reset --hard`, `gh pr merge`, six tracker tools | **Absent.** The rule file tells the agent never to run the four git/`gh` ones; that is an instruction, not a refusal. RULE-09 rests on GitHub branch protection alone |
| `chat-guard`, `guard-read-scope`, `guard-tracker-scope` (wired) | **Absent.** Antigravity has its own hooks (`.agents/hooks.json`, with a `deny` decision), but a different payload shape; none of ours is ported — MD-045 |
| `guard-allowed-paths`, `guard-registry`, `guard-project-root` | Unwired here too (ADR-004), so **nothing changes**. RULE-03 is R1 and CI's `allowed-paths`, and both still run on work done from Antigravity |
| `disableClaudeAiConnectors`, `.mcp.json` | Not read. Antigravity loads MCP servers from its own `mcp_config.json`; no tracker server is configured there |
| Agent dispatch and each agent's `tools:` / `disallowedTools` | No dispatch. The agent reads `.claude/agents/<name>.md` and acts as that role, unrestricted. RULE-13's fresh session for `/review` is a new conversation, by instruction only |
| `/auto`, `scripts/run-loop.mjs` | **Unchanged.** The runner spawns `claude`, so every stage it runs is a Claude Code session with all of the above |

**The practical rule: a stage run from Antigravity is a stage run with no guards and an honest
agent.** CI, CODEOWNERS and branch protection are server-side and hold either way. Everything that
was refused at the keyboard is, there, only asked.

`scripts/check-docs.mjs` D16 holds the adapter to the commands: a shim for every live command, none for
a retired one, the same `description:`, and the rule file under Antigravity's 24,000-byte limit with
`CLAUDE.md` inlined.
