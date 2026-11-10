# CaleChip

A planning board on which every member of a team declares, as far ahead as they know, when they
will be on leave (PTO) or working from home (WFH) — so the team can see a crowded day while it is
being created rather than the night before. **It is multi-tenant** (ADR-059): one deployment holds
many organisations, each isolated from the others and each holding teams, and a person belongs to
exactly one organisation and to one or more of its teams. The target roles follow those levels:
**system admin** (the deployment), **org admin** (one organisation), **manager** (one team),
**member**, and **guest** (no account, reaches a public event only through its link). Until the role
split ships (MIR-16, MIR-17), the running system enforces three roles: member, manager and admin.
It is not an HR system, it holds no leave quota, and a warning here never blocks an action —
[.ai/00-charter.md](.ai/00-charter.md) carries the four standing refusals and the reason for each,
and the roles.
*Until 2026-10-13 this paragraph said "every member of one team" and "exactly two roles". Both had
been stale since ADR-039 and ADR-035.*

**This repository was stood up from `aifw-template`.** Until the `TODO(project):` markers below and
in `.ai/` are resolved, the loop will run and produce nothing useful: `/plan` has no feature ID to
work from and no architecture to design against, and the verify commands have no project to run
against. The ordered checklist is in [SETUP.md](SETUP.md).

## Read these before doing anything

| File | What it is |
|------|------------|
| [.ai/00-charter.md](.ai/00-charter.md) | What this system is for and what it refuses to do |
| [.ai/01-operating-model.md](.ai/01-operating-model.md) | Lifecycle, stage ownership, gates, chat topology, dispatch loop |
| [.ai/registry/rules.md](.ai/registry/rules.md) | All 18 process rules, each stated exactly once. 17 are in force — RULE-05 was retired with the QA stage (ADR-022) and its number is never reused |
| [.ai/registry/invariants.md](.ai/registry/invariants.md) | The domain invariants |
| [.ai/registry/features.md](.ai/registry/features.md) | The only valid source of feature IDs |
| [.ai/standards/](.ai/standards/) | Tech stack, architecture, coding, data model, RBAC, testing, UI, git, sessions, integrations |
| [.claude/PERMISSIONS.md](.claude/PERMISSIONS.md) | Why each permission and hook exists |
| [.ai/steward/context.md](.ai/steward/context.md) | **How the operator wants to be worked with.** Standing instructions, and the log of what changed and why |

**Read the standing instructions in `.ai/steward/context.md` before your first reply in a session,
whichever agent you are.** They are durable operator preferences — autonomy, answer length, language,
what to verify before speaking — and they apply whether or not the current message repeats them. The
operator named "having to explain the same preference again" as a standing cost; that file is the
mechanism against it. It is board plane and agent-writable, but only the steward appends to it.

## Three rules reproduced here

These are copied verbatim from `.ai/registry/rules.md` because they are too important to sit one
indirection away. `scripts/check-docs.mjs` check D7 verifies the copies match character-for-character.
Every other rule is cited by ID, never restated.

- **RULE-01** — Changing `.ai/registry/**` requires human approval, and an ADR for everything except feature and glossary rows. Enforcement is CODEOWNERS review on the pull request, not a hook.
- **RULE-02** — No component may bypass the data-access seam declared in `.ai/standards/architecture.md`. Enforced by a lint rule, not convention.
- **RULE-03** — An agent may not edit any file outside the active ticket's `allowed_paths`.

## Two planes

`.ai/registry/` and `.ai/standards/` are permanent and human-only. `.ai/board/` is transient and
agent-writable. A ticket's working directory is `.ai/board/tickets/` — never under the registry.

## Stack

**[.ai/standards/tech-stack.md](.ai/standards/tech-stack.md) is the single source.** Language,
framework, datastore, runners and package manager are named there once, and cited everywhere else.
Do not restate any of them here — a second copy is a second thing to keep true, and the copy is
always the one that goes stale.

Two things that file will tell you and that are worth knowing before you write a line of config:
it records **majors, never resolved versions** (the manifest and the lockfile carry those), and it
carries a list of dependencies that are **past reliable recall**. For anything on that list, open the
real file — the installed types, the package's own docs, the config on disk — before writing config
against it. `TODO(verify):` is the correct output when a fact cannot be confirmed; a confident guess
is not.

## Visual direction

Pastel and rounded on the surface, dense and precise in the grid. PTO is peach, WFH is mint,
holidays are lavender, an overloaded day is a soft pink that is deliberately not an alarming red.
Tentative entries are a dashed border at reduced opacity; approved ones carry a small star. Type is a
rounded face with correct Vietnamese diacritics — Nunito or Baloo 2, never Quicksand.

**The calendar grid is the most-used screen and information density wins there every time.** Charm
belongs in the empty states, the mascots and the approval moment; it never costs a row in the year
view. Details, and the Vui/Gọn density toggle, are in
[.ai/standards/ui-design-system.md](.ai/standards/ui-design-system.md).

## Working agreements

- **Windows-native.** No `.sh` files, no `chmod`, no shebang execution. Every hook is `.mjs` run via
  `node`. Delete this bullet only if the whole team is on POSIX — the hooks themselves are portable
  and stay `.mjs` either way.
- **No invention.** No invented feature IDs, acceptance criteria, database fields, or invariants.
  Missing information becomes a placeholder plus an entry under `OPEN QUESTIONS`.
  **One carve-out, added 2026-09-04: the visual arrangement of a screen.** With no image attached at
  `/triage` or `/plan`, `tech-lead-design` originates the layout rather than stopping, and marks it
  as its own in `01-plan.md` § 2b. Behaviour, permissions and invariants are not covered by this and
  are still never invented — `.ai/standards/ui-design-system.md` § *Visual specification*.
- **Additive only.** Do not delete or rewrite a file you did not create in the current run.
- **No agent merges. Agents commit at the `/advance` checkpoint and at `/ship`, and push only at
  `/ship`** — ADR-048, ADR-067. Each stage leaves the tree dirty; the `/advance` after it commits the ticket's
  ship set on `feat/<ID>` locally (`/handoff`). *Until 2026-10-01: "Agents commit at `/ship` only.
  Every stage leaves the tree dirty, from `/plan` all the way to the end."* `/ship` classifies the tree, commits the ticket and the three ship-owned
  board and registry files on one branch, records the state transition and opens **one** pull request
  — ADR-023. Chore work is not its to commit: it names those paths and leaves them dirty for the
  session that wrote them. A pull request is merged by a person, or by the runner's own code once its
  merge gate passes — RULE-09, ADR-067. *Until 2026-10-23: "Humans merge … Merging is permanently
  human."* Scope and limits in
  [.ai/standards/git-conventions.md](.ai/standards/git-conventions.md).
- **One working directory.** Every role is launched in the same folder, and one working tree holds
  one branch — so exactly one ticket is ever in flight, enforced by git rather than by policy
  (ADR-006). **Read `git branch --show-current` and `git status` before the first instruction of a
  session.** The current stage's work stays uncommitted until the next `/advance` checkpoint, so a
  `git switch` on a dirty tree is still the loss — CAL-12 lost a whole ticket that way before
  ADR-048.
  [.ai/standards/session-model.md](.ai/standards/session-model.md).

## Replying — the sign-off is the reply

**Default to the sign-off block and nothing else.** A command that ran and passed is four lines. This
is a rule about the operator's time: they read every reply, and a wall of confirmed-fine detail buries
the one line that was not.

Add prose *above* the block only when one of these is true, and only as much as it takes:

- **You stopped.** What stopped you, and what would unblock it. Here the detail is the whole value.
- **You found something the operator has to decide**, or something true that nobody asked about and
  nobody would otherwise notice. One or two sentences.
- **You did something other than what was asked**, or did nothing where something was expected.

**Never include:**

- A narration of the steps you ran. Git, the artifacts and the gate front-matter are the record; a
  transcript of them in chat is a second, worse copy that goes stale immediately.
- A table of checks that all passed. *Passed* is one word.
- The file classification you already acted on — `git show --stat` holds it, and the commit has
  happened, so printing it invites review of something already done.
- A restatement of what the command file says the command does. The operator can read it, and it is
  in the repository where it stays true.

**Evidence belongs in the repository, not in the reply.** If a claim you want to make cannot be
checked from a file or a commit, that is a reason to write the file — not a reason to write more chat.

### When the caller is a program, none of the above applies

**Everything in this section describes a reply to a person.** When a prompt says in terms that its
caller is a program and names the shape it wants — JSON, a bare value, a single line — produce
exactly that shape and nothing else. No block, no prose around it, no Vietnamese envelope. The
strings *inside* a JSON answer may be Vietnamese; the JSON may not be.

**This is not a licence to drop the block when it feels like overhead.** The carve-out needs the
prompt to say so. A prompt that does not say so is a person asking.

*Added 2026-09-22, after it cost a real run. `scripts/run-loop.mjs` asked `product` for JSON with
`--json-schema`; `product` returned four well-cited questions in Vietnamese ending with the
four-line block, because that is what this file tells it to do and a flag does not outrank a
standing instruction. The content was right and the run discarded it. Two things changed: this
carve-out, so the instruction is no longer in conflict; and the runner, which no longer throws away
a step it has paid for.*

### The block

**End every reply to the operator with this block, whoever you are.** Four lines, this order, nothing
else in it.

**The labels are in the conversation language named in `.ai/steward/context.md`.** That file ships
carrying the origin operator's preference, which is Vietnamese; the block below is shown in that form
because a template that showed English would silently contradict the standing instruction beside it.
The conversation language here **is** Vietnamese, confirmed 2026-08-31, so the four labels below
stand as shipped and no translation is owed.

```
---
**Tôi là `<agent>`.** Vừa <what you did> — <TICKET-ID>, gate <PASS | FAIL | BLOCKED | n/a>.
**Xong lúc:** <output of `date '+%Y-%m-%d %H:%M %Z'`>
**Branch:** <output of `git branch --show-current`, or `detached @ <sha>`>
**Tiếp theo:** <command> — trong session <agent>
```

- **Read the time and the branch. Never supply them from context.** `date` and
  `git branch --show-current`, every time, even when you are confident. A sign-off is a claim about a
  machine's state, and an invented one is worse than none because it looks measured.
- **No `Bash` tool means `unavailable — no Bash tool`**, not a guess. `product` is the only agent in
  this position today.
- **Quote the gate from your artifact's front-matter.** If your reply completes no command, write
  `gate n/a` and say what you are waiting on in the *Tiếp theo* line.
- **Name the session, not just the command.** RULE-13 makes a correct command in a reused session a
  review or a QA pass that did not really happen.
- **On a FAIL, *Tiếp theo* is the routed command**, per the routing table in
  `.ai/01-operating-model.md` — not the next happy-path stage. On `ESCALATED`, it is a human decision
  and there is no command; say so.
- **Never put this block in an artifact.** It is conversation. Artifacts carry front-matter, and that
  is the record.

## Commands

**The loop**, which builds the product — `/triage` `/next-ticket` `/plan` `/implement` `/review`
`/advance` `/handoff` `/ship` `/sprint-status` `/pull-tickets` `/sync-tracker` `/docs-audit`

**`/advance <ID>` is the recording step** — ADR-036. It reads the front-matter of the artifact the
last stage produced and transcribes the gate and the next state into `ticket.yaml`. Until it existed
the loop above specified that step and no command performed it, so `state` never passed through
`PLAN`, `READY` or `REWORK` and `gates.*` was written by nobody.

**The two-step, which is how a ticket is meant to start** — ADR-038:

```
/idea "<the request, in words>"             ← asks until every decision is settled, writes the file
node scripts/run-loop.mjs auto <name>       ← asks nothing, runs to a pull request
```

**`/idea` is where the operator is needed, and it is the only place.** It runs in a session, takes
as long as it takes, and writes `.ai/board/ideas/<yyyy-mm-dd>-<slug>.md` with the verdict left
empty — capture is not judgement. `<name>` is any unambiguous fragment of that filename.

The loop then reads the file and asks nothing. If a decision turns out to be missing it **stops**
with the gap named — a BLOCKED triage, or an `OPEN QUESTIONS` entry at PLAN — rather than guessing
past it.

**Unattended** — the runner reads the board, decides the next step in deterministic code, and spawns
each stage as its own top-level `claude` process, which is what makes the session lifetimes real
rather than a matter of which window someone typed into (ADR-036). `auto "<request>"` without a file
still asks its own questions at the terminal; `/auto` starts a run detached and **cannot ask**, so
it is for a file or a ticket that is already settled.

**Outside the loop** — `/solo`, for work where the loop's overhead exceeds its value. It skips every
stage and every gate, deliberately.

`/spec` and `/design` are **retired** — ADR-019 merged them into PLAN. **`/qa` is retired too** —
ADR-022 removed the QA stage outright. Their files are kept, carrying a retirement banner, so
tickets shipped before 2026-09-01 stay readable against the commands that produced them.

**`/idea` was retired by ADR-019 and un-retired by ADR-038, with a different job.** The old one was
the first half of *write the idea, then triage it*. The new one is the interactive half of an
unattended pipeline: the loop runs without a person, so every decision a person owns is made here
first. Tickets shipped before 2026-09-01 cite the old meaning.

**The model**, which maintains the loop — `/thuki` (steward: rules, hooks, checks, registry; never
ticket work) and `/status` (reads the board; reports what is true and what waits on a human).

One file each in [.claude/commands/](.claude/commands/); policy lives in the operating model.
