Record the multi-tenancy migration plan in the repository, with a single feature-code
family, back-references into the existing feature records, and a process gate that
keeps those back-references alive. Do not implement anything.

## Step 0 — Report before writing

Do not create or modify any file yet. Report:
1. Full contents of `.ai/standards/rbac-and-security.md`.
2. What exists under `.ai/`, and whether `.ai/plans/` exists.
3. Where the existing feature status table (CAL-xx, ADM-xx, TEA-xx, UIE-xx, EVT-xx)
   lives. Give the path and its full contents. If it is not in the repo, say so.
4. The exact naming convention of `supabase/migrations/` and `tests/`, quoted from
   real filenames, showing how the feature ID is embedded.
5. Whether this repository is public or private, as far as the repo reveals.
6. Whether `.github/pull_request_template.md` (or any PR template) exists, and its
   full contents if so.
7. Full contents of `.github/workflows/verify.yml` and any other workflow file.
   Report which jobs run, what triggers them, and whether any job inspects changed
   files or the PR body.
8. Whether the repo has `CONTRIBUTING.md`, husky hooks, lint-staged, or any other
   commit-time gate.

Stop and wait for my go-ahead.

## After I approve

Sources: `multi-tenancy-audit-2026-10-12.md` and `calechip-multi-tenancy-plan.md`,
both attached. Use only what is in them. Do not add findings of your own.

### Feature code

Every item in the plan gets one ID from a single family: MIR-01, MIR-02, …
Number them in the order they appear in the plan, phase by phase.

Rules to state at the top of the plan file and enforce throughout:
- An ID is permanent once assigned. It appears in migration filenames and test
  filenames, so it is never renumbered or reused.
- A cancelled item keeps its ID with status WONTDO.
- The number does NOT imply execution order. `Blocked by` is the only ordering.
- New items are appended with the next free number, never inserted.

Filenames follow the existing convention with this family, e.g.
`supabase/migrations/<timestamp>_mir07_<slug>.sql`, `tests/mir07-<slug>.test.sql`.

### File 1 — `.ai/plans/multi-tenancy.md`

The full plan, grouped by phase, each item carrying its MIR ID and the source
file:line references from the audit. Do not drop those references.

For each item add a line `Expected impact:` listing the existing feature IDs it is
predicted to affect, each tagged CHANGED or SUPERSEDED:
- CHANGED — the feature still does what its description says, but behaves differently.
- SUPERSEDED — the feature's current behaviour becomes wrong, or is replaced outright.
Write `Expected impact: none` where it touches no existing feature.
Mark this section as a prediction, to be corrected at ship time.

### File 2 — `.ai/plans/multi-tenancy-status.md`

One table, all phases, columns exactly:

| ID | Phase | Item | Status | Blocked by | Affects | Verified |

- Status: `—`, `IN_PROGRESS`, `DONE`, `WONTDO`. Everything starts at `—`.
- Blocked by: MIR IDs that must be DONE first. Derive from the plan's dependency
  statements — between phases, and within a phase where the plan says so.
- Affects: the predicted feature IDs with their CHANGED / SUPERSEDED tag.
- Verified: required for every phase 0 and phase 3 item before it may be marked DONE.
  State how it was proven and against what. A passing mock test is not verification.

Header line: this file is the only place status is updated.

### File 3 — `.ai/plans/feature-change-log.md`

The back-reference, keyed by existing feature ID. One section per affected feature:

```
## ADM-05 — Duyệt/từ chối entry, có lý do khi từ chối
- [predicted] MIR-23 CHANGED — one manager's decision is sufficient for a
  multi-team member
```

Rules to state in the file:
- At plan time every entry is `[predicted]`.
- When a MIR item ships, its PR replaces the prediction with a dated entry:
  `- 2026-11-04 MIR-23 CHANGED — <what actually changed>`
- A shipped item that touched a feature nobody predicted adds a new entry; the
  prediction in file 1 is left as-is, as a record of what was missed.
- A SUPERSEDED entry must say what replaces the old behaviour.
- A feature marked SUPERSEDED gets its row in the original feature table annotated,
  not deleted.

Based on the audit, seed predictions for at least: ADM-01, ADM-04, ADM-05, ADM-06,
CAL-11, CAL-12, TEA-02, TEA-08, UIE-09, EVT-01, EVT-02. Add others the audit supports.

### File 4 — update `.ai/standards/rbac-and-security.md`

Append a section listing the open weaknesses from the audit, each with its MIR ID,
so this file and the plan name the same items. Preserve all existing content verbatim.

### File 5 — PR template

Create `.github/pull_request_template.md`, or extend the existing one additively if
Step 0 found one — preserve every existing section verbatim and append.

Add a section that a PR touching a MIR item must fill in:

```
## MIR tracking

- MIR item(s): MIR-__
- Status after this PR: IN_PROGRESS | DONE
- Verified (required for phase 0 and phase 3): <how, against what>
- Feature impact:
  - [ ] No existing feature behaviour changed — `FEATURE-IMPACT: none`
  - [ ] Features changed, and `.ai/plans/feature-change-log.md` updated with a
        dated entry for each, tagged CHANGED or SUPERSEDED

- [ ] `.ai/plans/multi-tenancy-status.md` updated in this PR
```

State in the template that a PR marking an item DONE without a `Verified` entry,
where one is required, does not merge.

### File 6 — CI check

Add a workflow job (new file, or a new job appended to an existing workflow —
do not alter existing jobs) that runs on pull_request and enforces:

1. If any changed file matches `_mir[0-9]+_` or `mir[0-9]+-`, then
   `.ai/plans/multi-tenancy-status.md` must also be changed in the same PR.
2. If condition 1 holds, the PR body must contain either a line
   `FEATURE-IMPACT: none` or a change to `.ai/plans/feature-change-log.md`.
   An empty or whitespace-only change to the log file does not count.
3. If the PR body sets status DONE for a phase 0 or phase 3 item, the `Verified`
   line must be non-empty. Read the phase from
   `.ai/plans/multi-tenancy-status.md`, do not hardcode the ID ranges.

The job fails with a message naming which of the three conditions was not met.
Write it as a shell or Node script under `.github/scripts/`, not as inline YAML
longer than a few lines, so it can be run locally.

## Wording constraint for security items

Phase 0 item titles and descriptions state what will change, not how the current
system can be abused. Reproduction steps and payloads go in `.ai/plans/sec-details.md`;
if the repo is public, add that path to `.gitignore` and say so in your summary.

## Constraints

- Additive only. Do not reorganise or reformat any file you did not create, and do
  not modify any existing CI job.
- Match the existing repo's markdown style; name the file you used as reference.
- No SQL, no migrations, no application code in this session.
- Nothing is marked DONE.
- Output the complete contents of every file you created or changed.