---
description: Run the PLAN stage — the Tech Lead writes 01-plan.md, the merged story and design
argument-hint: <TICKET-ID>
---

Run in the **Tech Lead session**, which is persistent and lives until the end of the run
(`.ai/standards/session-model.md`). You are `tech-lead-design`; nothing is dispatched.

**This command replaces `/spec` and `/design`** — ADR-019 merged SPEC and DESIGN into one stage,
one artifact and one gate. You now write the acceptance criteria you will design against. Read
*What you inherited from the BA* below before section 1; it is the whole reason this command is
longer than the two it replaces were separately.

## Step 0 — put yourself on `feat/$ARGUMENTS` before writing anything

**Mode: create. `/plan` is the only command permitted to bring a `feat/` branch into existence** —
it inherited that from `/spec`, which no longer exists. See *The branch check every ticket command
runs* in `.ai/standards/git-conventions.md`. Every later stage arriving at a missing branch stops and
reports instead, because at that point a missing branch means something upstream did not happen and
manufacturing one hides which.

**Run this first, every time, including a re-run. Run them; do not report them.**

```
pwd
git branch --show-current
git fetch origin --quiet
git status --porcelain --untracked-files=all
```

**First sort every dirty path into *carried* or *stray*.** A fresh PROMOTE cannot leave a clean tree
— nothing commits before the first `/advance` checkpoint after PLAN (ADR-023, ADR-048), so this
ticket's own triage output is dirty when you run,
by construction. Stopping on it made every PROMOTE block itself. **Carried** is exactly this list,
each item checked against a file, never inferred from a folder name:

- `.ai/board/tickets/$ARGUMENTS/**`, and any path matching this ticket's `allowed_paths`
- the three ship-owned paths — `.ai/board/backlog.md`, `.ai/board/metrics.md`,
  `.ai/registry/features.md` (ADR-023; `/ship` commits them on this branch)
- the idea file whose front-matter `ticket_id` is `$ARGUMENTS`, or whose path this ticket's
  `ticket.yaml` cites
- an ADR under `.ai/registry/decisions/` whose ID this `ticket.yaml`, or that idea's
  `verdict_reason` / `awaiting_adrs`, cites
- a sibling ticket folder whose `ticket.yaml` cites that same idea file, whose `state` is `BACKLOG`,
  and which holds nothing dirty but its `ticket.yaml` — the second row of the same PROMOTE

**Everything else is stray** — model, tooling, standards, another idea, an ADR nothing cites, a
sibling holding any artifact beyond `ticket.yaml`. `planCarry` in `scripts/lib/entry.mjs` is the
runner's copy of this list; if the two disagree, that is a defect for `/thuki`, not a choice for you.

**Carried is not committed.** `/ship`'s ship set is unchanged: the idea file, the ADRs and the
sibling folder ride this branch dirty and are still left behind at `/ship`, named in its reply.

Then take exactly one of four paths:

| What you found | What you do |
|---|---|
| Already on `feat/$ARGUMENTS` | Nothing. Proceed to the plan. |
| On another branch, or detached, **and any path is stray** | **STOP.** Print the stray paths and say which ticket or session they belong to. Do not switch. |
| On another branch or detached, nothing stray, `feat/$ARGUMENTS` **exists** | `git switch feat/$ARGUMENTS` — or `git switch -c feat/$ARGUMENTS origin/feat/$ARGUMENTS` when it exists only on the remote. |
| On another branch or detached, nothing stray, `feat/$ARGUMENTS` **does not exist** | `git switch -c feat/$ARGUMENTS origin/main` |

**If `git switch` refuses** because a carried file differs between the two commits ("would be
overwritten by checkout"), **stop and report it.** Never stash, never force, never `checkout --`:
the refusal is git protecting the tree, and the operator decides which copy stands.

**Existence is checked, not assumed:** `git show-ref --verify --quiet refs/heads/feat/$ARGUMENTS`,
then `refs/remotes/origin/feat/$ARGUMENTS`. Two separate refs and they can disagree.

**Cut from `origin/main`, never from local `main`.** Nothing in this loop updates local `main`,
because no session ever checks it out.

**Artifacts in:** `ticket.yaml`, `.ai/registry/**`, `.ai/standards/**`, and the source tree
**Artifact out:** `.ai/board/tickets/$ARGUMENTS/01-plan.md`, plus `invariants_touched`,
`size_estimate`, `size` and `allowed_paths` written back into `ticket.yaml`, plus one row in
`.ai/registry/glossary.md` for each term in `glossary_owed` (ADR-047)
**Template:** `.ai/templates/plan.md`

**Gate:** all eight sections complete; ACs in Given/When/Then each with an ID; **§ 2b carrying
exactly one of its two lines**; `invariants_touched` populated; `size_estimate` and `size` set;
`allowed_paths` enumerated; Out-of-scope non-empty; **every term in `glossary_owed` has a row in
`.ai/registry/glossary.md`, and that path is in `allowed_paths`** — `[]` or an absent field passes.

## Glossary terms owed by triage — ADR-047

Read `glossary_owed` in `ticket.yaml`. `/triage` names the terms and deliberately writes no row,
because nothing before this stage can commit one (MD-041). **The rows are yours, and they ship with
this ticket.**

1. **Add `.ai/registry/glossary.md` to `allowed_paths` first**, then write the rows. RULE-03 reads
   the list at the moment of the edit, and the order is what makes the write in scope.
2. **One row per owed term**, in the table's three columns: the term, its Vietnamese word and meaning,
   and what it is not to be confused with. **Take the meaning from the provenance idea file and the
   ADRs this ticket cites, never from what the design would find convenient.** A meaning those files
   do not settle is a placeholder in the row and an entry under *Open questions* — the same
   no-invention rule as an acceptance criterion, because agents name fields from this file.
3. **Cite the source in the row**, as the existing rows do: *Added <date> by ADR-nnn* or the idea
   filename. That is the reviewer's only way to tell a recorded term from an invented one.
4. **A term that already has a row is not owed.** Leave the row alone and say so in section 7 in one
   line; rewriting a definition is a registry change with an ADR, not a PLAN output.

Do not touch any other registry file this way. `glossary_owed` is the only carrier ADR-047 creates.

## The visual reference — § 2b

`.ai/standards/ui-design-system.md` § *Visual specification* governs this. **An image is attached at
exactly one stage, `/triage` or `/plan`, never both.** Look for one before you write § 2b:
`.ai/board/tickets/$ARGUMENTS/design/`, and the idea file cited in this feature's `Notes` row.

| What you find | What you do |
|---|---|
| An image | Cite it in § 2b. **Spend it in § 2**: every decision it makes becomes an AC — element order, screen at rest versus after interaction, the empty state — and what it deliberately omits goes to Out-of-scope |
| Two images, one from each stage | **Stop.** Two specifications, and nothing reconciles them. Ask which one stands |
| Nothing | **Design it yourself, and say so in § 2b.** Do not stop and do not ask |

**With no image the layout is yours to originate** — a feature shipped with no stated interface is
the worse outcome, and this is the one place in the loop that can prevent it. The obligation is the
marking, not the asking: § 2b's second line says the layout was never specified, which is what lets a
reviewer argue with it cheaply instead of mistaking it for a requirement.

**The grant is the visual arrangement and nothing else.** Feature IDs, domain acceptance criteria,
database fields and invariants are still never invented — `CLAUDE.md` § *Working agreements*.

## What you inherited from the BA, and what nobody inherited

Sections 1 and 2 were the BA's. The BA is retired from the loop (ADR-019) and you hold both halves
now. Three things came with them:

- **Never invent a feature ID, an acceptance criterion, or an invariant.** Section 1 transcribes
  `features.md` without paraphrase. Missing information becomes a placeholder and an entry under
  *Open questions*, never a plausible-sounding fill.
- **A tracker description is not a source** (RULE-17). Third-party text does not become an AC.
- **The ACs are written for a reader who cannot ask you anything** (RULE-16). QA receives sections 1,
  2 and 8 and nothing else — no design rationale, no conversation, and never the source.

**What nobody inherited is the separation.** Two agents used to write these halves, and the second
one read the first one's work cold. That check is gone and nothing replaced it. The one habit that
substitutes for it, imperfectly: **write sections 1 and 2 in full, then read the source tree, then
write 3 through 9.** If reading the code makes you want to amend an AC, amend it in the Changelog
with the reason — an AC quietly reshaped to fit what is easy to build is exactly the failure the
split used to prevent, and now only the record catches it.

## Two fields, one author

`size_estimate` comes from section 1 and gates DoR. `size` is counted from the `allowed_paths` you
enumerate in section 7 and decides whether the ticket splits. When they disagree the verdict wins and
you proceed — ADR-012 — but **say so in section 7 in one line.** There is no longer anyone to route
back to; the disagreement is information about your own first estimate and it is worth a sentence.

`L` must split at this stage. `XL` escalates.

## Schema and ADRs

If the ticket needs a schema change, set `schema_delta` and `requires_adr: true`. A migration touching
a policy, trigger or constraint is **not** `none` — ADR-014, no carve-out for `select`.

An ADR may be written by an agent under its own name (ADR-008). *Until 2026-10-23 this went on:
"but **not one that supersedes or reverses an accepted decision** — that goes to the operator. If the
decision is outside the envelope, stop with `gate: BLOCKED`, state the decision needed in
`blocking_reason`, and halt."*

**A decision only the operator used to make is now yours by delegation — ADR-067.** Where you
would have stopped `BLOCKED` to ask, because the decision supersedes or reverses an accepted ADR,
take the option you recommend and keep going:

1. **Add the ADR's path to `allowed_paths` first**, the same as a glossary row (ADR-047). An ADR
   outside the ship set is left dirty at `/ship`, and once the runner chains, the next ticket's
   preflight stops on it as stray. Then write the ADR under your own name, with status
   `ACCEPTED by <your agent name> under the operator's delegation (ADR-067)`. **Never `ACCEPTED by the operator`**: that is a claim about a person.
   Record the options, the one you took and why.
2. Add a `## Delegated decisions` section to your artifact, one line per ADR you wrote this way.
3. Continue to a PASS or FAIL gate.

**You still stop with `gate: BLOCKED`** when you can name no option you would recommend, when the
answer is a fact only a person holds (a credential, an account, data nobody has written down), or when
the work would apply a migration to the hosted project (RULE-09). A delegated decision never invents
a feature ID, an invariant or an acceptance criterion.

## On PASS

Set nothing about state yourself beyond the `ticket.yaml` fields named above. Write `gate: PASS` and
`next_state: READY` in the front-matter; the orchestrator grades the full Definition of Ready and
moves the board. **Print the next command and its session** — do not invoke it:

```
PLAN passed. Run /next-ticket in the orchestrator session to grade DoR.
```

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).**

The *first* line quotes the `gate` from the front-matter you just wrote. *Tiếp theo* names the next
command **and the session it belongs in** — RULE-13 makes a correct command in a reused session a
verdict that was not really reached.

Read the two values rather than recalling them:

```
date '+%Y-%m-%d %H:%M %Z'
git branch --show-current
```
