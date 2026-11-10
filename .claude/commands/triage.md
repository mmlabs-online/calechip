---
description: Capture a request as an idea and triage it into REJECT, NEEDS-ADR, or PROMOTE
argument-hint: <raw request in quotes> | <idea-filename>
---

Dispatch `product` and `tech-lead-design`.

**This command absorbed `/idea` — ADR-019.** There is no longer a separate IDEA stage: writing the
idea and judging it happen in one run. `$ARGUMENTS` is therefore one of two things, and you decide
which by looking:

| `$ARGUMENTS` is | What you do |
|---|---|
| A filename that exists under `.ai/board/ideas/` | Skip step 0. Judge the file as it stands. |
| Anything else — a sentence, a paragraph, a complaint | Step 0 first: write the idea file, then judge it. |

## Step 0 — write the idea, when there is not one yet

**Template:** `.ai/templates/idea.md`
**Output:** a new file in `.ai/board/ideas/`, named `<yyyy-mm-dd>-<kebab-slug>.md`
**Gate for this half:** the file states a **problem, not a solution**, and carries no feature ID.

**Write it before you judge it, and write it as though somebody else would judge it.** That order is
the only thing left of the separation this command absorbed — the same run now states the problem and
rules on it, so a problem quietly narrowed to fit the verdict its author already has in mind is the
failure mode, and nothing catches it except writing the problem down first.

An idea has no feature ID. The ID is issued below, on PROMOTE, and not before.

## When the runner dispatched you

`scripts/run-loop.mjs` invokes this command with the operator's request and, when there was an
intake step, their answers to your own questions. Three things change, and none of them is a
judgement call:

- **Copy the request into `operator_request` verbatim.** Not summarised, not corrected, not
  reordered. It is the only line in the file that is not yours.
- **Copy the intake answers verbatim too**, under `## Evidence`, each beside the question it
  answers. An answer paraphrased into a finding is a finding nobody gave you.
- **You cannot ask a follow-up.** There is no operator at the other end of an unattended run. A
  question that would have been a chat message is an `## Open questions` entry, and if the answer
  would change behaviour, permissions or an invariant, say so there in those words — the runner stops
  the run on exactly that.

**Never REJECT an idea for being shaped like a solution.** REJECT means *not worth doing, or already
covered*, and the shape of a sentence is evidence of neither. Operator requests arrive as solutions
because that is how people think. Derive the problem, mark the derivation as yours, and keep their
sentence intact — `.ai/templates/idea.md` § *When the request is shaped like a solution*.

## You still have no clock and no branch

You hold no `Bash` tool, so `produced_at` is a value you cannot measure. Under the runner the
timestamp is supplied to you; write what you were given rather than recalling one. A recalled
timestamp on an artifact is the kind of wrong that looks measured.

## The verdict

**Input:** the idea file, plus `.ai/registry/**`
**Output:** the verdict appended to that idea file, **and written into its front-matter**
**Gate:** exactly one verdict, with a reason.

**Write `verdict`, `verdict_reason` and `ticket_id` into the idea file's front-matter** —
`.ai/templates/idea.md`, added by ADR-037. Keep writing the heading too; the heading is for a person
and the front-matter is for `scripts/run-loop.mjs`, which reads the verdict **from disk** and never
from a reply.

That reading was previously impossible. `gate:` is `PASS` on every idea file in
`.ai/board/ideas/` including the one that was REJECTed, `next_state:` is `TRIAGE` on some promoted
ideas and `BACKLOG` on others, and the verdict itself lives in a free-form heading with at least
eight shapes on disk — `## Triage verdict: PROMOTE`, `# Verdict — PROMOTE, as CAL-10`,
`# Re-triage verdict — PROMOTE, as \`UIE-07\` — **THIS IS THE LIVE VERDICT**`, and five more. Two
files carry two verdicts and only one says which is live.

On a re-triage, **overwrite the front-matter fields** and leave both headings in the body. The
front-matter is the live answer; the body is the history.

| Verdict | Means |
|---|---|
| REJECT | Not worth doing, or already covered. Say which. |
| NEEDS-ADR | Needs a registry, schema, or dependency decision. **Write the ADR** — see below. |
| PROMOTE | Worth building. Write the feature row. |

**On NEEDS-ADR, draft the ADR — do not hand the operator homework.** Every ADR in this repository
was written by an agent from a sentence the operator said; asking them to author one contradicts how
the model actually works. Produce the whole document: context, the options with their trade-offs, a
recommendation, consequences including what gets worse, and a revert condition.
**Copy the front-matter of `ADR-000-template.md` as it stands**, `doc_version: 2` included — a new
ADR written at `doc_version: 1` cites RULE-01 and RULE-09 at a version above its own, and check D9
fails the audit on it. ADR-039 and ADR-040 were both drafted that way on 2026-09-22.

Then one of two things, and the test is not a judgement call:

- **The decision sits inside what is already decided** — accept it yourself, `ACCEPTED by <agent>`
  (RULE-09, ADR-008). The operator reviews it at merge.
- **The decision would supersede or reverse an accepted ADR** — take the option you recommend
  under the operator's delegation (ADR-067), and write the ADR as `ACCEPTED by <agent> under the
  operator's delegation (ADR-067)`. Never write `ACCEPTED by the operator` on their behalf. Stop and
  ask only when you can name no option you would recommend. *Until 2026-10-23: "stop and ask, in one
  question. That is changing the envelope rather than working inside it."*

**Where the idea file already quotes the operator confirming the decision, verbatim, under
`## Evidence`, that quote is the words you point at**: write `ACCEPTED by the operator`, cite the
idea file and quote them. `/idea` asks for exactly this so that the unattended run does not stop here.

**Name every ADR the verdict waits on in `awaiting_adrs`** (`.ai/templates/idea.md`). That list is
the NEEDS-ADR verdict's only exit: `scripts/run-loop.mjs` reads each ADR's `## Status` line, and
once none of them is `PROPOSED` it re-triages the file and the new verdict replaces this one. Before
2026-09-22 there was no such exit — the runner re-read the stale NEEDS-ADR on every run and stopped
with the same words, however many ADRs the operator had accepted in between.

**The question you ask goes in the ADR's `## Status` as well as in `## Open questions`.** The
operator answers it by editing that line — `ACCEPTED by the operator` or `REJECTED by the operator`
— which is a signature they write themselves and you never write for them.

**On PROMOTE, `product` writes the row to `.ai/registry/features.md`** — ADR-007. Allocate the next
free number in the group, set `Status` to `PLANNED`, and **put the idea filename in the `Notes`
column**. That citation is not decoration: it is the only provenance a reviewer has, and a row
without one is indistinguishable from an invented feature.

**Then create the ticket, per row** — ADR-010. A promoted feature that appears in no ticket and no
backlog row is a decision to build something the board cannot see, and `/next-ticket` will correctly
report nothing to do.

0. **If the operator attached an image, move it to `.ai/board/tickets/<ID>/design/`** and cite that
   path from the idea's `Evidence` section. It is now this ticket's visual reference and `/plan` § 2b
   will find it there — `.ai/standards/ui-design-system.md` § *Visual specification*. **An image is
   attached at exactly one stage;** having taken it here, `/plan` must not be handed a second one.
   On REJECT or NEEDS-ADR there is no ticket, the image stays with the idea, and it specifies
   nothing.
1. `.ai/board/tickets/<ID>/ticket.yaml`, copied from `.ai/templates/ticket.yaml`, `state: BACKLOG`.
2. Fill **Definition of Ready items 1, 3, 4 and 6** — all four are produced at BACKLOG:
   `feature_ids`, `depends_on`, `schema_delta` with its ADR linked when it is not `none`, and one
   feature group per ticket. Fill `glossary_owed` too — see below.
3. Append a row to `## BACKLOG` in `.ai/board/backlog.md`.

**A term the idea needs and `.ai/registry/glossary.md` lacks goes in `glossary_owed`, never in
`glossary.md`** — ADR-047. Write the bare term names into the ticket shell (`glossary_owed: [Event,
Attendee]`), and nothing else about them; the meaning comes from the idea file and the ADRs this
ticket cites, which is where `tech-lead-design` will read it. **Do not edit `glossary.md` at
triage.** No stage commits a registry file written here other than `features.md`: `planCarry` calls
it stray and `/plan` step 0 stops on it (MD-041, observed on the EVT PROMOTE of 2026-09-29). PLAN
puts `glossary.md` in `allowed_paths` and writes the rows, so they ship in the ticket's own pull
request. `[]` means you looked and nothing is owed. An ADR you draft here still lists the terms
under *Affected documents*; the row write itself is PLAN's.

**Leave `invariants_touched` and `size_estimate` empty.** They are items 2 and 5, they belong to
PLAN, and the gate sits after PLAN precisely so they can. Filling them here is inventing an
acceptance criterion's worth of judgement before the plan exists.

**`product` writes the row, not `tech-lead-design`** — including here, where both are dispatched
together. `tech-lead-design` writes the plan later, at `/plan`, and the role that will write the plan
is never the role that granted the ID it writes against. That separation survived ADR-019; it is the
last one in the front half of the loop, which is why it is stated rather than assumed.

The operator approves at merge, under CODEOWNERS — which is where RULE-01 says enforcement lives.
Nothing here is committed; the row travels with the ticket and lands on the ticket branch at
`/ship`, in the same pull request as the ship — ADR-023.

Policy lives in `.ai/01-operating-model.md`.

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** It is not a footer on the reply —
for most runs it *is* the reply. Do not stop at the step above and leave the operator to work out who
answered, whether it passed, where the repository is, and what runs next.

This command writes no artifact and passes no gate, so the first line ends `gate n/a`. *Tiếp theo* names
whatever the board says runs next, **with the session it belongs in** — not a topic, a command.
**You hold no `Bash` tool**, so you cannot run `date` or `git branch --show-current`. Write
`unavailable — no Bash tool` on both lines. Guessing either is worse than leaving them blank.
